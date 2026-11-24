// research/edge/pair-divergence-ifvg/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): one market of a pair sweeps its
// last H1 swing while its partner does not in the same three H1 candles; trade against the sweep on an M15 inversion of a
// gap of the sweep leg; stop past the extreme; targets 2R and the opposite H1 swing; against the same sweep without the
// divergence. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/pair-divergence-ifvg/run.mjs market <m> <outDir>
//   node research/edge/pair-divergence-ifvg/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PARTNER = { eurusd: 'gbpusd', gbpusd: 'eurusd', xau: 'xag', xag: 'xau' };
export const MARKETS = ['eurusd', 'gbpusd', 'xau', 'xag'];
export const SCOPES = { fx: ['eurusd', 'gbpusd'], metals: ['xau', 'xag'], pooled: MARKETS };
export const ASSUMED = ['xag'];
export const KSW = 3, LEG = 32, WAIT = 24, HOLD = 5 * 86400, MIN_COSTS = 3, SWING_BACK = 10;
export const FROM = Date.UTC(2005, 0, 1) / 1000, SPLIT = Date.UTC(2015, 0, 1) / 1000, TO = Date.UTC(2026, 10, 1) / 1000;
export const GROUPS = ['div', 'all'], TARGETS = ['2R', 'swing'];
export const CELLS = []; for (const g of GROUPS) for (const x of TARGETS) for (const s of Object.keys(SCOPES)) CELLS.push({ group: g, target: x, scope: s, name: `${g} ${x} ${s}` });

// The live last swing level standing BEFORE each candle: hi[q] / lo[q] = the price of the most recent swing high / low
// confirmed by the close of candle q-1, or NaN when there is none or a candle after it and before q traded through it.
export function liveLevels(H1, Ksw = KSW) {
  const sw = K.swings(H1, Ksw).sort((a, b) => a.ci - b.ci || a.i - b.i);
  const hi = new Float64Array(H1.length).fill(NaN), lo = new Float64Array(H1.length).fill(NaN);
  const lows = [], highs = [], lowAt = new Int32Array(H1.length), highAt = new Int32Array(H1.length); // lowAt[q] = swing lows confirmed by the close of q
  let k = 0, c = 0, H = NaN, L = NaN;
  for (let q = 0; q < H1.length; q++) {
    while (k < sw.length && sw[k].ci < q) { const s = sw[k++]; if (s.type === 'H') H = s.price; else L = s.price; }
    hi[q] = H; lo[q] = L;
    if (H1[q].h > H) H = NaN;
    if (H1[q].l < L) L = NaN;
    while (c < sw.length && sw[c].ci <= q) { (sw[c].type === 'L' ? lows : highs).push(sw[c].price); c++; }
    lowAt[q] = lows.length; highAt[q] = highs.length;
  }
  return { hi, lo, lows, highs, lowAt, highAt };
}

// Sweeps of the primary's live last swing with the partner's class. side -1 = a swept high (short), +1 = a swept low (long).
export function sweeps(H1, P1, Ksw = KSW) {
  const A = liveLevels(H1, Ksw), B = liveLevels(P1, Ksw);
  const at = new Map(); for (let q = 0; q < P1.length; q++) at.set(P1[q].t, q);
  const out = [];
  for (let j = 0; j < H1.length; j++) {
    const b = H1[j];
    for (const side of [-1, 1]) {
      const level = side < 0 ? A.hi[j] : A.lo[j];
      if (!(side < 0 ? b.h > level && b.c < level : b.l < level && b.c > level)) continue;
      const q0 = at.get(b.t - 7200), q1 = at.get(b.t - 3600), q2 = at.get(b.t);
      if (q0 == null || q1 == null || q2 == null) continue;
      const pl = side < 0 ? B.hi[q0] : B.lo[q0];
      let cls = 'nolevel';
      if (Number.isFinite(pl)) {
        const took = side < 0 ? Math.max(P1[q0].h, P1[q1].h, P1[q2].h) > pl : Math.min(P1[q0].l, P1[q1].l, P1[q2].l) < pl;
        cls = took ? 'conf' : 'div';
      }
      out.push({ j, side, level, T: b.e, t: b.t, cls });
    }
  }
  out.levels = A;
  return out;
}

// The M15 inversion entry of one sweep. Returns { entryT, stop (without the cost buffer), k } or { why }.
export function inversion(M15, s, i0) { // i0 = index of the first M15 candle with t >= s.t
  let x = -1, kT = -1;
  for (let i = i0; i < M15.length && M15[i].t < s.T; i++) { kT = i; if (x < 0 || (s.side < 0 ? M15[i].h > M15[x].h : M15[i].l < M15[x].l)) x = i; }
  if (x < 0) return { why: 'nodata' };
  const up = s.side < 0; // short: a rising leg into a high
  let ls = x; for (let i = x; i >= Math.max(0, x - LEG + 1); i--) if (up ? M15[i].l < M15[ls].l : M15[i].h > M15[ls].h) ls = i;
  const gaps = [];
  for (let a = ls; a + 2 <= x; a++) { const c = a + 2;
    if (up ? M15[c].l > M15[a].h : M15[c].h < M15[a].l) gaps.push({ c, edge: up ? M15[a].h : M15[a].l, dead: false }); }
  if (!gaps.length) return { why: 'nogap' };
  let ext = up ? -Infinity : Infinity; // the extreme from the leg start to T
  for (let i = ls; i <= kT; i++) ext = up ? Math.max(ext, M15[i].h) : Math.min(ext, M15[i].l);
  const past = (c, e) => (up ? c < e : c > e);
  for (const g of gaps) for (let m = g.c + 1; m < kT; m++) if (past(M15[m].c, g.edge)) { g.dead = true; break; }
  let run = ext;
  for (let k = kT; k < M15.length && k < kT + WAIT; k++) {
    const b = M15[k];
    run = up ? Math.max(run, b.h) : Math.min(run, b.l);
    if (up ? b.c > ext : b.c < ext) return { why: 'cancel' };
    let hit = false;
    for (const g of gaps) if (!g.dead && k > g.c && past(b.c, g.edge)) { hit = true; g.dead = true; }
    if (hit && k > x) return { entryT: Math.max(b.e, s.T), stop: run, k, x, ls };
  }
  return { why: 'noinv' };
}

// Every signal of one market: the sweep, its class, the entry time and the stop (cost buffer added). No fills here.
export function signals(M5, P1, cost, Ksw = KSW) {
  const H1 = K.resample(M5, 3600), M15 = K.resample(M5, 900);
  const sw = sweeps(H1, P1, Ksw); const funnel = { sweeps: sw.length, nodata: 0, nogap: 0, cancel: 0, noinv: 0, entries: 0 };
  const out = []; let i0 = 0;
  for (const s of sw) {
    while (i0 < M15.length && M15[i0].t < s.t) i0++;
    const r = inversion(M15, s, i0);
    if (r.why) { funnel[r.why]++; continue; }
    funnel.entries++;
    const lv = sw.levels; const list = s.side < 0 ? lv.lows : lv.highs; const n = s.side < 0 ? lv.lowAt[s.j] : lv.highAt[s.j];
    out.push({ side: s.side, cls: s.cls, level: s.level, sweepT: s.t, T: s.T, entryT: r.entryT, stop: r.stop - s.side * cost,
      opp: list.slice(Math.max(0, n - SWING_BACK), n).reverse() });
  }
  return { sig: out, funnel };
}

// One trade from the fill candle i0 with several targets (NaN = none). R per target, null = unresolved. Stop first.
export function exits(M5, i0, side, stop, targets, hold = HOLD) {
  const fill = M5[i0].o, risk = side * (fill - stop); if (!(risk > 0)) return null;
  const R = targets.map((x) => (Number.isFinite(x) ? null : NaN)); let left = R.filter((x) => x === null).length;
  const deadline = M5[i0].t + hold; const set = (v) => { for (let q = 0; q < R.length; q++) if (R[q] === null) R[q] = v; left = 0; };
  for (let j = i0; j < M5.length && left; j++) {
    const b = M5[j];
    if (j > i0) {
      if (side * (b.o - stop) <= 0) { set((side * (b.o - fill)) / risk); break; }
      for (let q = 0; q < R.length; q++) if (R[q] === null && side * (b.o - targets[q]) >= 0) { R[q] = (side * (b.o - fill)) / risk; left--; }
    }
    if (side > 0 ? b.l <= stop : b.h >= stop) { set(-1); break; }
    for (let q = 0; q < R.length; q++) if (R[q] === null && (side > 0 ? b.h >= targets[q] : b.l <= targets[q])) { R[q] = (side * (targets[q] - fill)) / risk; left--; }
    if (b.e >= deadline) { set((side * (b.c - fill)) / risk); break; }
  }
  return { fill, risk, R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const key = (s) => [s.sweepT, s.side, s.cls, s.entryT, s.stop.toFixed(6)].join('|');

export function runMarket(market) {
  const cost = COSTS[market]; if (!(cost > 0)) throw new Error('no cost for ' + market);
  let P5 = K.load(PARTNER[market], '5m', { from: '2005-01-01', to: '2026-11-01' }); const P1 = K.resample(P5, 3600); P5 = null;
  const M5 = K.load(market, '5m', { from: '2005-01-01', to: '2026-11-01' });
  const { sig, funnel } = signals(M5, P1, cost);
  const X = exclusions(market); const meta = { market, first: new Date(M5[0].t * 1000).toISOString().slice(0, 10), ...funnel, dropped: 0, past: 0, small: 0, open: 0 };
  const trades = []; let i = 0;
  for (const s of sig) {
    while (i < M5.length && M5[i].t < s.entryT) i++;
    if (i >= M5.length) { meta.open++; continue; }
    const t = M5[i].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { meta.dropped++; continue; }
    const fill = M5[i].o, risk = s.side * (fill - s.stop);
    if (!(risk > 0)) { meta.past++; continue; }
    if (risk < MIN_COSTS * cost) { meta.small++; continue; }
    const sw = s.opp.find((p) => s.side * (p - fill) >= risk);
    const r = exits(M5, i, s.side, s.stop, [fill + s.side * 2 * risk, sw == null ? NaN : sw]);
    if (r.R[0] === null) { meta.open++; continue; }
    if (s.side * (s.stop - fill) >= 0) throw new Error('stop on the wrong side');
    trades.push([t, s.side, s.cls === 'div' ? 0 : s.cls === 'conf' ? 1 : 2, +(cost / risk).toFixed(5), +r.R[0].toFixed(5), r.R[1] === null || Number.isNaN(r.R[1]) ? null : +r.R[1].toFixed(5),
      sw == null ? null : +((s.side * (sw - fill)) / risk).toFixed(3)]);
  }
  // cut test: the signals known by a cut date equal those found when the candles end there
  const cut = [];
  for (const d of ['2009-06-17', '2016-03-09', '2022-10-12']) {
    const c = Date.parse(d + 'T00:00:00Z') / 1000;
    const a = signals(M5.filter((b) => b.e <= c), P1.filter((b) => b.e <= c), cost).sig.filter((s) => s.entryT <= c).map(key);
    const full = sig.filter((s) => s.entryT <= c).map(key); const A = new Set(a), F = new Set(full);
    cut.push({ market, cut: d, known: full.length, missing: full.filter((x) => !A.has(x)).length, extra: a.filter((x) => !F.has(x)).length });
  }
  return { meta, trades, cut };
}

// ---- report --------------------------------------------------------------------------------------------------------
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function cellStat(rows) { // rows: [{ t, g, n }] gross and net R
  const n = rows.length; if (!n) return { n: 0, win: null, gross: null, net: null, tNet: null, tGross: null, months: 0, p: null, costR: null };
  const sum = (f) => rows.reduce((a, x) => a + f(x), 0);
  const tOf = (f) => { const m = new Map(); let a = Infinity, b = -Infinity; for (const x of rows) { const k = mk(x.t); m.set(k, (m.get(k) || 0) + f(x)); a = Math.min(a, k); b = Math.max(b, k); }
    const v = []; for (let k = a; k <= b; k++) v.push(m.get(k) || 0); const N = v.length, mean = v.reduce((p, q) => p + q, 0) / N;
    const sd = N > 1 ? Math.sqrt(v.reduce((p, q) => p + (q - mean) ** 2, 0) / (N - 1)) : 0; return { t: sd > 0 ? mean / (sd / Math.sqrt(N)) : null, N }; };
  const tn = tOf((x) => x.n), tg = tOf((x) => x.g);
  return { n, win: sum((x) => (x.n > 0 ? 1 : 0)) / n, gross: sum((x) => x.g) / n, net: sum((x) => x.n) / n, tNet: tn.t, tGross: tg.t, months: tn.N,
    p: tn.t == null ? null : K.pFromT(tn.t, tn.N - 1), costR: sum((x) => x.g - x.n) / n };
}
export function welch(a, b) { const m = (v) => v.reduce((p, q) => p + q, 0) / v.length, va = (v, mu) => v.reduce((p, q) => p + (q - mu) ** 2, 0) / (v.length - 1);
  if (a.length < 2 || b.length < 2) return null; const ma = m(a), mb = m(b); return { diff: ma - mb, t: (ma - mb) / Math.sqrt(va(a, ma) / a.length + va(b, mb) / b.length) }; }

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
const N = (x) => x.toLocaleString('en-US');

export function report(dir) {
  const per = {}; for (const m of MARKETS) per[m] = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8'));
  const rowsOf = (markets, pick, ti, win) => { const out = [];
    for (const m of markets) for (const r of per[m].trades) { if (!pick(r[2])) continue; const R = r[4 + ti]; if (R == null) continue;
      if (win === 0 ? r[0] >= SPLIT : r[0] < SPLIT) continue; out.push({ t: r[0], g: R, n: R - r[3] }); } return out; };
  const stat2 = (markets, pick, ti) => ({ disc: cellStat(rowsOf(markets, pick, ti, 0)), conf: cellStat(rowsOf(markets, pick, ti, 1)) });
  const cells = CELLS.map((c) => { const s = stat2(SCOPES[c.scope], c.group === 'div' ? (k) => k === 0 : () => true, TARGETS.indexOf(c.target)); return { cell: c.name, ...c, ...s }; });
  const hp = K.holm(cells.map((c) => c.conf.p)); cells.forEach((c, i) => { c.holm = hp[i];
    c.pass = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.net > 0 && c.conf.net > 0 && c.disc.tNet >= 2 && c.conf.tNet >= 2 && c.holm < 0.05; });
  const beside = []; for (const [scope, ms] of Object.entries(SCOPES)) TARGETS.forEach((x, ti) => {
    const row = { scope, target: x, conf: stat2(ms, (k) => k === 1, ti), nolevel: stat2(ms, (k) => k === 2, ti), rest: stat2(ms, (k) => k !== 0, ti), diff: {} };
    [['disc', 0], ['conf', 1]].forEach(([w, wi]) => { row.diff[w] = welch(rowsOf(ms, (k) => k === 0, ti, wi).map((r) => r.n), rowsOf(ms, (k) => k !== 0, ti, wi).map((r) => r.n)); });
    beside.push(row); });
  const perMarket = []; for (const m of MARKETS) TARGETS.forEach((x, ti) => perMarket.push({ market: m, target: x, div: stat2([m], (k) => k === 0, ti), all: stat2([m], () => true, ti) }));
  const div = cells.filter((c) => c.group === 'div'); const passed = cells.filter((c) => c.pass).map((c) => c.cell);
  const verdict = div.some((c) => c.pass) ? 'PASS' : div.every((c) => c.disc.n < 300 || c.conf.n < 300) ? 'INCONCLUSIVE' : 'FAIL';
  const big = div.filter((c) => c.disc.n >= 300 && c.conf.n >= 300); const best = (big.length ? big : div).slice().sort((a, b) => b.conf.net - a.conf.net)[0];
  const headline = `best divergence cell "${best.cell}" made ${f3(best.conf.net)}R a trade after costs in 2015-26 (n ${N(best.conf.n)}, month t ${f2(best.conf.tNet)}; ${f3(best.conf.gross)}R before costs) and ${f3(best.disc.net)}R in 2005-14 (n ${N(best.disc.n)}, month t ${f2(best.disc.tNet)}); ${passed.length} of 12 cells pass`;
  const o = { study: 'pair-divergence-ifvg', built: '2026-11-24', verdict, headline, basis: 'judged after costs on calendar-month sums (pre-registered)',
    windows: { discovery: '2005-01-01 to 2014-12-31', confirmation: '2015-01-01 to 2026-10-31' }, markets: MARKETS, assumedCosts: ASSUMED,
    costs: Object.fromEntries(MARKETS.map((m) => [m, COSTS[m]])), best: best.cell, passed, cells, beside, perMarket,
    meta: MARKETS.map((m) => ({ ...per[m].meta, trades: per[m].trades.length, div: per[m].trades.filter((r) => r[2] === 0).length, conf: per[m].trades.filter((r) => r[2] === 1).length, nolevel: per[m].trades.filter((r) => r[2] === 2).length })),
    cut: MARKETS.flatMap((m) => per[m].cut) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(o, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), markdown(o));
  return o;
}

function markdown(o) {
  const L = ['# Pair divergence at an H1 sweep, M15 inversion-gap entry (result)', '', `**Verdict: ${o.verdict}. ${o.headline[0].toUpperCase() + o.headline.slice(1)}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). EUR/USD with GBP/USD and gold with silver, OANDA mid',
    '5-minute candles from the `edgekit` cache (M15 and H1 built from them), discovery 2005-2014, confirmation 2015 to October 2026,',
    '`combo-grid-2` costs (silver ASSUMED) and data-quality exclusions. Judged after costs on calendar-month sums. Research only: nothing',
    'live changed, no rule is proposed, and nothing of the ICT desk was read or used.', '',
    'The rule, in short: an H1 candle trades through the market\'s last live H1 swing high (low) and closes back; "div" = the partner',
    'market still has its own last swing high (low) and does not trade through it in the same three H1 candles; then, within 6 hours,',
    'an M15 candle closes back through a three-candle gap of the leg that made the sweep; market entry against the sweep at the next',
    '5-minute open, stop past the extreme plus one round trip, target 2R or the opposite H1 swing (1R or more away), 5-day limit.', '',
    '## The 12 cells', '',
    'R a trade; "gross" = before costs, "net" = after; t = t of calendar-month sums of net R; Holm over the 12 confirmation p values.', '',
    '| Cell | n 05-14 | gross 05-14 | net 05-14 (t) | n 15-26 | gross 15-26 | net 15-26 (t) | win 15-26 | cost R | Holm | Pass |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const c of o.cells) L.push(`| ${c.cell} | ${N(c.disc.n)} | ${f3(c.disc.gross)} | ${f3(c.disc.net)} (${f2(c.disc.tNet)}) | ${N(c.conf.n)} | ${f3(c.conf.gross)} | ${f3(c.conf.net)} (${f2(c.conf.tNet)}) | ${c.conf.win == null ? 'n/a' : (c.conf.win * 100).toFixed(0) + '%'} | ${c.conf.costR == null ? 'n/a' : c.conf.costR.toFixed(3)} | ${c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('', '## With the divergence against without it', '',
    'Not judged cells. "rest" = the same sweep and entry where the partner confirmed (traded through its own level in the window) or had',
    'no live level; difference = div minus rest, net R a trade, Welch t on trades.', '',
    '| Scope | Target | Window | div n | div net | conf n | conf net | nolevel n | nolevel net | div - rest (t) |', '|---|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const b of o.beside) for (const w of ['disc', 'conf']) { const d = o.cells.find((c) => c.group === 'div' && c.scope === b.scope && c.target === b.target)[w];
    L.push(`| ${b.scope} | ${b.target} | ${w === 'disc' ? '2005-14' : '2015-26'} | ${N(d.n)} | ${f3(d.net)} | ${N(b.conf[w].n)} | ${f3(b.conf[w].net)} | ${N(b.nolevel[w].n)} | ${f3(b.nolevel[w].net)} | ${b.diff[w] ? f3(b.diff[w].diff) + ' (' + f2(b.diff[w].t) + ')' : 'n/a'} |`); }
  L.push('', '## Per market', '', 'Net R a trade (month t); * = cost ASSUMED.', '',
    '| Market | Target | div n 05-14 | div net (t) | div n 15-26 | div net (t) | all n 15-26 | all gross | all net (t) |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const p of o.perMarket) L.push(`| ${p.market}${o.assumedCosts.includes(p.market) ? '*' : ''} | ${p.target} | ${N(p.div.disc.n)} | ${f3(p.div.disc.net)} (${f2(p.div.disc.tNet)}) | ${N(p.div.conf.n)} | ${f3(p.div.conf.net)} (${f2(p.div.conf.tNet)}) | ${N(p.all.conf.n)} | ${f3(p.all.conf.gross)} | ${f3(p.all.conf.net)} (${f2(p.all.conf.tNet)}) |`);
  const bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), known = o.cut.reduce((a, x) => a + x.known, 0);
  L.push('', '## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${o.markets.join(', ')}: ${N(known)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under 3 round trips are no trades.', '',
    '| Market | candles from | sweeps | no leg gap | cancelled | no inversion in 6 h | entries | trades | div | conf | nolevel | bad data | past the stop | risk under 3 costs | unresolved |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.sweeps)} | ${N(m.nogap)} | ${N(m.cancel)} | ${N(m.noinv)} | ${N(m.entries)} | ${N(m.trades)} | ${N(m.div)} | ${N(m.conf)} | ${N(m.nolevel)} | ${m.dropped} | ${m.past} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  const dv = o.cells.filter((c) => c.group === 'div'), al = o.cells.filter((c) => c.group === 'all');
  const rng = (a, f) => `${f3(Math.min(...a.map(f)))} to ${f3(Math.max(...a.map(f)))}`;
  const ts = o.beside.flatMap((b) => ['disc', 'conf'].map((w) => b.diff[w]?.t)).filter((x) => x != null);
  if (o.verdict === 'PASS') L.push('A divergence cell clears the pre-registered bar after costs in both windows. It is one study on mid candles: a forward',
    'record and the owner decide anything further; nothing is adopted here.');
  else if (o.verdict === 'INCONCLUSIVE') L.push('Too few divergence trades in a window to judge any cell.');
  else L.push(`No divergence cell clears the bar. After costs the six divergence cells make ${rng(dv, (c) => c.conf.net)}R a trade in 2015-26 and`,
    `${rng(dv, (c) => c.disc.net)}R in 2005-14; before costs ${rng(dv, (c) => c.conf.gross)}R and ${rng(dv, (c) => c.disc.gross)}R. The same sweep and entry`,
    `whatever the partner did makes ${rng(al, (c) => c.conf.net)}R after costs in 2015-26. The partner condition does not pick the better`,
    `sweeps: the Welch t of "div minus the rest" runs from ${f2(Math.min(...ts))} to ${f2(Math.max(...ts))} over the twelve scope / target / window`,
    'comparisons. Not an edge and not a filter; do not re-test variants of these cells on these years. Nothing live changed; no rule',
    'is proposed.');
  L.push('', 'Limits: OANDA mid candles (no bid / ask at the entry); one swing definition (3 candles a side) and one gap definition; silver\'s',
    'cost is assumed; trades of one market can overlap and the two markets of a pair are correlated, which the month sums absorb only',
    'in part.', '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, JSON.stringify(r.meta), 'trades', r.trades.length, JSON.stringify(r.cut), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir>');
}

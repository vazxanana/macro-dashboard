// research/edge/ef-chain-h4-h1-m15/run.mjs - the chain of failed engulfs of PREREGISTRATION.md (24 Nov 2026): an H4 engulf
// zone fails and becomes a level for the other side; on the first return an H1 engulf zone of the old side fails too; the
// first M15 engulf with the new side is the entry (market), stop past that M15 zone; targets 1R / 2R / the nearest standing
// H4 engulf zone of the other side. Six cells, five markets pooled, discovery 2005-14, confirmation 2015 to Oct 2026,
// judged AFTER costs on calendar-month sums. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/ef-chain-h4-h1-m15/run.mjs run     (all markets, the cut test, result.json, RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { zones, turnBack } from '../../../council/eg-methods.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const VARS = ['at', 'any'], EXITS = ['1R', '2R', 'opp'];
export const NCELL = 6, cellOf = (v, x) => v * 3 + x, cellName = (c) => `${VARS[(c - (c % 3)) / 3]} ${EXITS[c % 3]}`;
export const P = { serve: 20 * 86400, back: 24, win: 24, trig: 24, atrK: 0.1, hold: 3 * 86400, late: 3600 };
const y = (yr, m = 0) => Date.UTC(yr, m, 1) / 1000;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10), NM = 262, DM = 120;
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
export const frames = (M5) => ({ '5m': M5, '15m': K.resample(M5, 900), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400) });
const lower = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };

// mean true range of the 14 candles ending with candle i (null before 14 candles and a prior close exist)
export function atr14(B, i) {
  if (i < 14) return null; let s = 0;
  for (let j = i - 13; j <= i; j++) { const b = B[j], pc = B[j - 1].c; s += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); }
  return s / 14;
}

// ---- the chain (closed candles only). Returns { signals, zh4, counts }.
// signal: { v (0 at / 1 any), d, at (the M15 completing close), i (that M15 candle), stop, zt, zb, lvFail, hf } ----------------
export function chain(F) {
  const H4 = F['4h'], H1 = F['1h'], M15 = F['15m'];
  const Z4 = turnBack(conv(H4), zones(conv(H4), '4h'), 14400), Zh = zones(conv(H1), '1h'), Zm = zones(conv(M15), '15m');
  const failAt = new Map(); // H1 fail candle index -> H1 zones failing there
  for (const z of Zh) if (z.fail != null) { if (!failAt.has(z.fi)) failAt.set(z.fi, []); failAt.get(z.fi).push(z); }
  const trig = { 1: Zm.filter((z) => z.dir > 0), '-1': Zm.filter((z) => z.dir < 0) }; // each ascending by completing candle
  const counts = { levels: 0, returns: 0, h1fail: [0, 0], trigger: [0, 0], ended: [0, 0] }; const signals = []; const seen = [new Set(), new Set()];
  for (const L of Z4) {
    if (L.fail == null) continue; counts.levels++;
    const d = -L.dir, end = Math.min(L.fail + P.serve, L.back != null ? L.back : Infinity);
    let k = lower(H1, L.fail);
    while (k < H1.length && H1[k].t < end && !(H1[k].l <= L.top && H1[k].h >= L.bot)) k++;
    if (k >= H1.length || H1[k].t >= end) continue; counts.returns++;
    const got = [null, null];
    for (let j = k; j < k + P.win && j < H1.length && H1[j].e <= end && (got[0] == null || got[1] == null); j++) {
      const list = (failAt.get(j) || []).filter((z) => z.dir === -d && z.i >= k - P.back).sort((a, b) => b.i - a.i);
      for (const z of list) { const here = z.bot <= L.top && z.top >= L.bot;
        if (got[1] == null) got[1] = { z, j }; if (here && got[0] == null) got[0] = { z, j }; }
      if (d > 0 ? H1[j].c < L.bot : H1[j].c > L.top) break; // an H1 close through the level's far side ends the setup
    }
    for (let v = 0; v < 2; v++) { const g = got[v]; if (!g) continue; counts.h1fail[v]++;
      const hf = H1[g.j].e, T = trig[d]; let lo = 0, hi = T.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M15[T[m].i].t < hf) lo = m + 1; else hi = m; }
      const z = T[lo]; if (!z || z.at > hf + P.trig * 900 || z.at >= end) continue;
      let dead = false; for (let q = lower(M15, hf); q <= z.i && !dead; q++) dead = d > 0 ? M15[q].c < L.bot : M15[q].c > L.top;
      if (dead) { counts.ended[v]++; continue; }
      const a = atr14(M15, z.i); if (!(a > 0)) continue; counts.trigger[v]++;
      const key = z.i + '|' + d; if (seen[v].has(key)) continue; seen[v].add(key);
      signals.push({ v, d, at: z.at, i: z.i, stop: d > 0 ? z.bot - P.atrK * a : z.top + P.atrK * a, zt: z.top, zb: z.bot, lvFail: L.fail, hf });
    }
  }
  signals.sort((a, b) => a.at - b.at || a.v - b.v || a.d - b.d);
  return { signals, zh4: Z4, counts };
}

// the near side of the nearest H4 engulf zone of the other side standing at T and ahead of the fill (null = none)
export function oppTarget(Z4, d, T, fill) {
  let best = null;
  for (const z of Z4) { if (z.dir !== -d || z.at > T || z.end <= T) continue; const near = d > 0 ? z.bot : z.top;
    if (d * (near - fill) > 0 && (best == null || d * (near - best) < 0)) best = near; }
  return best;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
export function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

// one signal -> its trades: [{ x (exit index), R, Rm (the mirror) }] with fill, risk; null when there is no trade (why)
export function tradesOf(g, M5, Z4, cost) {
  const fi = lower(M5, g.at); if (fi >= M5.length || M5[fi].t >= g.at + P.late) return { why: 'late' };
  const fill = M5[fi].o, risk = g.d * (fill - g.stop);
  if (!(risk > 0)) return { why: 'bad' }; if (risk < cost) return { why: 'small' };
  const opp = oppTarget(Z4, g.d, g.at, fill), oppR = opp == null ? null : (g.d * (opp - fill)) / risk;
  const ks = [1, 2, oppR != null && oppR >= 1 ? oppR : null], out = [];
  ks.forEach((k, x) => { if (k == null) return;
    const r = K.simulate({ side: g.d, entry: fill, stop: g.stop, target: fill + g.d * k * risk, t: g.at, type: 'market', maxHold: P.hold }, M5);
    const m = K.simulate({ side: -g.d, entry: fill, stop: fill + g.d * risk, target: fill - g.d * k * risk, t: g.at, type: 'market', maxHold: P.hold }, M5);
    if (r.status === 'open' || m.status === 'open' || r.status === 'bad' || m.status === 'bad') { out.push({ x, open: true }); return; }
    if (!(g.d * (r.fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    out.push({ x, R: r.R, Rm: m.R }); });
  return { t: M5[fi].t, fill, risk, oppR, out };
}

export function runMarket(market, dir) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01', ...(dir ? { dir } : {}) }); const F = frames(M5);
  const { signals, zh4, counts } = chain(F), cost = COSTS[market], X = exclusions(market);
  const A = newAcc(), M = newAcc(); const c2 = { signals: signals.length, late: 0, bad: 0, small: 0, dropped: 0, open: 0, trades: 0 };
  for (const g of signals) {
    const r = tradesOf(g, M5, zh4, cost); if (r.why) { c2[r.why]++; continue; }
    if (r.t < FROM || r.t >= TO) continue;
    if (X.length && inBad(X, r.t)) { c2.dropped++; continue; }
    const m = monthOf(r.t), w = r.t < SPLIT ? 0 : 1, cr = cost / r.risk;
    for (const o of r.out) { if (o.open) { c2.open++; continue; } const c = cellOf(g.v, o.x); add(A, c, w, m, o.R, cr); add(M, c, w, m, o.Rm, cr); c2.trades++; }
  }
  const J = (S) => Object.fromEntries(Object.entries(S).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, counts, ...c2, chain: J(A), mirror: J(M) };
}

// the signals known by a date, computed on candles cut there, equal the full run's
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07'], dir) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01', ...(dir ? { dir } : {}) });
  const key = (g) => [g.v, g.d, g.at, g.stop.toFixed(8), g.hf, g.lvFail].join('|'); const full = chain(frames(M5)).signals; const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const A = new Set(chain(frames(M5.filter((b) => b.e <= T))).signals.filter((g) => g.at <= T).map(key)), B = new Set(full.filter((g) => g.at <= T).map(key));
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- statistics -------------------------------------------------------------------------------------------------------
export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return sd > 0 ? mean / (sd / Math.sqrt(n)) : 0; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function pool(list, kind) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d[kind][k][i]; return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? +(A.sum[c * 2 + w] / n).toFixed(6) : null, t: +mstat(ms, a, b).toFixed(4), net: n ? +(A.net[c * 2 + w] / n).toFixed(6) : null, tNet: +mstat(msn, a, b).toFixed(4),
      win: n ? +(A.win[c * 2 + w] / n).toFixed(4) : null, costR: n ? +(A.cr[c * 2 + w] / n).toFixed(4) : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export function judge(data) {
  const A = pool(data, 'chain'), M = pool(data, 'mirror'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(A, c), m = cellStats(M, c);
    rows.push({ cell: cellName(c), disc: s.d, conf: s.c, p: p1(s.c.tNet, s.c.months - 1), mirror: { disc: m.d, conf: m.c },
      perMarket: data.map((d) => { const q = cellStats(pool([d], 'chain'), c); return { market: d.market, disc: q.d, conf: q.c }; }) }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.p = +r.p.toFixed(6); r.holm = +H[i].toFixed(6);
    r.checks = { n: r.disc.n >= 300 && r.conf.n >= 300, disc: r.disc.net > 0 && r.disc.tNet >= 2, conf: r.conf.net > 0 && r.conf.tNet >= 2, holm: H[i] < 0.05 };
    r.pass = r.checks.n && r.checks.disc && r.checks.conf && r.checks.holm; });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
export function build(data, cut) {
  const rows = judge(data), pass = rows.filter((r) => r.pass), anyN = rows.some((r) => r.checks.n);
  const verdict = pass.length ? 'PASS' : anyN ? 'FAIL' : 'INCONCLUSIVE';
  const best = [...(pass.length ? pass : rows)].sort((a, b) => b.conf.net - a.conf.net)[0];
  const headline = `${pass.length} of 6 cells pass; the best confirmation cell (highest after-cost R), ${best.cell}, made ${f3(best.conf.net)}R a trade after costs in 2015-26 `
    + `(n ${N(best.conf.n)}, month t ${f2(best.conf.tNet)}; ${f3(best.conf.mean)}R before costs; discovery ${f3(best.disc.net)}R after costs, n ${N(best.disc.n)}, t ${f2(best.disc.tNet)})`;
  return { study: 'ef-chain-h4-h1-m15', built: '2026-11-24', verdict, headline, best: best.cell,
    basis: 'judged after costs on calendar-month sums (pre-registered); before costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10), counts: d.counts,
      signals: d.signals, late: d.late, bad: d.bad, small: d.small, dropped: d.dropped, open: d.open, trades: d.trades })),
    passed: pass.map((r) => r.cell), cut, cells: rows };
}

export function resultMd(o) {
  const L = []; const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => o.cells.filter(f).length;
  L.push('# A chain of failed engulfs: H4 fails, H1 fails, M15 engulfs (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone before any run). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'An H4 engulf zone that failed (an H4 close through its far side) is a level for the other side for 20 days or until an H4',
    'close back through it. On the first H1 return into it, an H1 engulf zone of the OLD side must fail too within 24 H1 candles',
    '("at": that H1 zone overlaps the level; "any": anywhere). Then the first M15 engulf WITH the new side within 6 hours is the',
    'entry: market at the next 5-minute open, stop past the M15 zone by 0.1 x ATR(14) of M15. Exits: 1R, 2R, or "opp" = the near',
    'side of the nearest standing H4 engulf zone of the other side when it is 1R or more away; the stop; 3 days. Engulf zones are',
    'the desk\'s own (`council/eg-methods.mjs` `zones`, imported). Five markets pooled (' + o.markets.join(', ') + '), OANDA mid',
    '5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026. Judged AFTER costs (the demo',
    'account\'s round trips, flat for every year) on calendar-month sums; Holm over the 6 confirmation tests.', '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 6.`,
    `- After costs, mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- **All: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`, '',
    '## Every cell', '',
    'R a trade (month-sum t). "cost R" = mean round trip / risk in 2015-26. Mirror = the same fill traded the other way with the',
    'same stop distance and the same targets in R, after costs.', '',
    '| Cell | n 05-14 | before 05-14 (t) | after 05-14 (t) | n 15-26 | before 15-26 (t) | after 15-26 (t) | win 15-26 | cost R | Holm | Mirror after 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of o.cells) L.push(`| ${r.cell} | ${N(r.disc.n)} | ${f3(r.disc.mean)} (${f2(r.disc.t)}) | ${f3(r.disc.net)} (${f2(r.disc.tNet)}) | ${N(r.conf.n)} | ${f3(r.conf.mean)} (${f2(r.conf.t)}) | ${f3(r.conf.net)} (${f2(r.conf.tNet)}) | ${r.conf.win == null ? 'n/a' : (100 * r.conf.win).toFixed(0) + ' %'} | ${r.conf.costR == null ? 'n/a' : r.conf.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${f3(r.mirror.conf.net)} (${f2(r.mirror.conf.tNet)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## Per market', '', 'After costs, R a trade (month-sum t) [n]; before costs in the second line of each cell.', '',
    '| Cell | Window | ' + o.markets.join(' | ') + ' |', '|---|---|' + o.markets.map(() => '---:').join('|') + '|');
  for (const r of o.cells) for (const w of ['disc', 'conf']) {
    L.push(`| ${r.cell} | ${w === 'disc' ? '05-14' : '15-26'} | ` + r.perMarket.map((m) => `${f3(m[w].net)} (${f2(m[w].tNet)}) [${N(m[w].n)}]<br>before ${f3(m[w].mean)}`).join(' | ') + ' |'); }
  L.push('', '## Down the chain', '',
    '| Market | candles from | failed H4 zones | first returns | H1 failure (at / any) | M15 trigger (at / any) | signals | no 5m candle in 1 h | past the stop | risk under cost | bad data | unresolved | trades (cells) |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.counts.levels)} | ${N(m.counts.returns)} | ${N(m.counts.h1fail[0])} / ${N(m.counts.h1fail[1])} | ${N(m.counts.trigger[0])} / ${N(m.counts.trigger[1])} | ${N(m.signals)} | ${m.late} | ${m.bad} | ${N(m.small)} | ${m.dropped} | ${m.open} | ${N(m.trades)} |`);
  L.push('', '## Checks', '',
    `- Cut test on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${o.cut.length} cuts, ${N(nCut)} signals known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a 5-minute candle that holds stop and target is a stop (`edgekit.simulate`).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '## What it means', '');
  if (o.verdict === 'PASS') L.push('A cell clears the pre-registered bar on mid candles with flat costs. That is a result to replicate on other data and at the',
    'broker\'s own quotes, not an edge; nothing is adopted or proposed.');
  else if (o.verdict === 'INCONCLUSIVE') L.push('No cell reaches 300 trades in both windows: the chain is too rare on five markets to judge. Nothing is concluded.');
  else L.push('No cell clears the bar. Waiting for a failed H4 zone, a failed H1 zone on the return and an M15 engulf with the new side does',
    'not make money after costs in both decades; the tight stop past the M15 zone makes the round trip a large share of 1R (the',
    '"cost R" column). Read with `eg-ef-choch-ladder`, `h4-ef-to-eg`, `grid7-ltf-ef` and `grid7-wide-eg-chain`: the failed-engulf',
    'ladders are closed on these years. Do not re-test variants of these 6 cells. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd] = process.argv.slice(2);
  if (cmd === 'run') {
    const data = []; for (const m of MARKETS) { const t0 = Date.now(); const r = runMarket(m); data.push(r);
      console.log(m, 'signals', r.signals, 'trades', r.trades, JSON.stringify(r.counts), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
    const cut = cutTest('xau'); console.log(JSON.stringify(cut));
    const o = build(data, cut);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(o, null, 1) + '\n'); fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(o));
    console.log(o.verdict, o.headline);
  } else console.log('usage: run.mjs run');
}

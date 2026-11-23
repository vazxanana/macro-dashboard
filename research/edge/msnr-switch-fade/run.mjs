// research/edge/msnr-switch-fade/run.mjs - the moment right after an MSNR switch (PREREGISTRATION.md, 23 Nov 2026): fade the
// first lower-timeframe pullback against a fresh call, take the first break with it, or enter on the switch candle; against
// old-call and plain-fade controls. Two ladders, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before
// costs. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/msnr-switch-fade/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/msnr-switch-fade/run.mjs cut <m> <outDir>
//   node research/edge/msnr-switch-fade/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { exits } from '../grid7-wide-fade/run.mjs';
import { direction, DIR } from '../../../council/eg-methods.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LADDERS = [
  { name: 'L4', work: '4h', key: '1d', keySec: 86400, trig: '15m', cap: 86400 },
  { name: 'LH', work: '1h', key: '4h', keySec: 14400, trig: '5m', cap: 8 * 3600 },
];
export const GROUPS = ['a0-1', 'a2-5', 'a6-20', 'b0-1', 'b2-5', 'b6-20', 'c'];
export const CTRLS = ['aOld', 'aPlain', 'bOld', 'cOld'];
export const EXITS = ['1R', '2R', 'key'];
export const ATRK = 0.1, KSW = 3, MAXAGE = 20, OLD_AT = 21;
export const NCELL = LADDERS.length * GROUPS.length * EXITS.length;            // 42
export const NSLOT = NCELL + LADDERS.length * CTRLS.length * EXITS.length;    // 66
export const cellIndex = (l, g, x) => (l * GROUPS.length + g) * EXITS.length + x;
export const ctrlIndex = (l, k, x) => NCELL + (l * CTRLS.length + k) * EXITS.length + x;
export function cellName(i) { const x = i % 3, r = (i - x) / 3, g = r % GROUPS.length, l = (r - g) / GROUPS.length;
  return { l, g, x, ladder: LADDERS[l].name, group: GROUPS[g], exit: EXITS[x], name: `${LADDERS[l].name} ${GROUPS[g]} ${EXITS[x]}` }; }
export const ageGroup = (age) => (age <= 1 ? 0 : age <= 5 ? 1 : 2);
// the controls a cell is judged against
export const controlsOf = (i) => { const { l, g, x } = cellName(i); const t = GROUPS[g][0];
  return t === 'a' ? [ctrlIndex(l, 0, x), ctrlIndex(l, 1, x)] : t === 'b' ? [ctrlIndex(l, 2, x)] : [ctrlIndex(l, 3, x)]; };
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// ---- key levels of the key timeframe: turns of the closes, DIR.K a side ---------------------------------------------------
// { m, p, s (-1 = A level, a sell level above; +1 = V level below), known (close of candle m + K), broken (time of the first
// close beyond it after it was known, Infinity if none) }
export function keyLevels(A, Kk = DIR.K) {
  const out = [];
  for (let m = Kk; m + Kk < A.length; m++) { const x = A[m].c; let hi = true, lo = true;
    for (let j = 1; j <= Kk; j++) { if (!(x > A[m - j].c && x > A[m + j].c)) hi = false; if (!(x < A[m - j].c && x < A[m + j].c)) lo = false; }
    if (!hi && !lo) continue; const s = hi ? -1 : 1; let broken = Infinity;
    for (let q = m + Kk + 1; q < A.length; q++) if (s < 0 ? A[q].c > x : A[q].c < x) { broken = A[q].e; break; }
    out.push({ m, p: x, s, known: A[m + Kk].e, broken }); }
  return out;
}
// the nearest opposite key level for a trade of side s filled at price fill, time t (closed key candles only)
export function keyTarget(A, levels, byM, s, fill, t) {
  const cc = K.closedCount(A, t); let best = NaN;
  for (let m = Math.max(0, cc - 1 - DIR.AGE); m < cc; m++) { const L = byM.get(m); if (!L) continue;
    if (L.known > t || L.broken <= t) continue;
    if (s > 0 && L.s < 0 && L.p > fill && !(L.p >= best)) best = L.p;
    if (s < 0 && L.s > 0 && L.p < fill && !(L.p <= best)) best = L.p; }
  return best;
}

// ---- signals (closed candles only) ------------------------------------------------------------------------------------
// { l, slot ('g:<i>' cell group or 'k:<i>' control), s (side of the trade), ts (moment the order is sent), stop, age }
export function signals(F) {
  const out = [];
  LADDERS.forEach((L, l) => {
    const W = F[L.work], A = F[L.key], T = F[L.trig], atr = atr14(T);
    const keyOf = (t) => { const k = K.barAt(A, t); return k < 0 ? t : A[k].t; };
    const D = direction(conv(W), keyOf, L.keySec);
    const push = (kind, idx, s, ts, stop, age) => { if (!Number.isFinite(stop)) return; out.push({ l, kind, idx, s, ts, stop, age }); };
    // (a) / (b) and their controls, from the trigger chart's structure breaks
    const seen = new Set();
    for (const e of K.structure(T, KSW).events) {
      const j = e.i, a = atr[j]; if (!(a > 0)) continue;
      let lo = Infinity, hi = -Infinity; for (let q = e.from; q <= j; q++) { if (T[q].l < lo) lo = T[q].l; if (T[q].h > hi) hi = T[q].h; }
      const stopFor = (s) => (s > 0 ? lo - ATRK * a : hi + ATRK * a);
      const ts = T[j].e;
      push('k', 1, -e.dir, ts, stopFor(-e.dir), -1);                     // plain fade
      const wi = K.closedCount(W, ts) - 1; if (wi < 0) continue;
      const c = D.call[wi], li = D.last[wi]; if (!c || li < 0) continue;
      const ev = D.events[li], age = wi - ev.i;
      if (T[j].t < W[ev.i].e) continue;                                   // starts before the switch candle closed
      if (age <= MAXAGE) {
        const t = e.dir === -c ? 'a' : 'b', key = li + t; if (seen.has(key)) continue; seen.add(key);
        push('g', (t === 'a' ? 0 : 3) + ageGroup(age), c, ts, stopFor(c), age);
      } else push('k', e.dir === -c ? 0 : 2, c, ts, stopFor(c), age);
    }
    // (c) the switch candle, and its old-call control at age 21
    const zoneStop = (ev, s, ts) => { const jj = K.closedCount(T, ts) - 1; const a = jj >= 0 ? atr[jj] : 0; if (!(a > 0)) return NaN;
      return s > 0 ? ev.bottom - ATRK * a : ev.top + ATRK * a; };
    D.events.forEach((ev, k) => {
      const ts = W[ev.i].e; push('g', 6, ev.s, ts, zoneStop(ev, ev.s, ts), 0);
      const i2 = ev.i + OLD_AT; if (i2 < W.length && D.last[i2] === k && D.call[i2] === ev.s) { const t2 = W[i2].e; push('k', 3, ev.s, t2, zoneStop(ev, ev.s, t2), OLD_AT); }
    });
  });
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NSLOT * NM), msNet: new Float64Array(NSLOT * NM), n: new Float64Array(NSLOT * 2), sum: new Float64Array(NSLOT * 2),
  sq: new Float64Array(NSLOT * 2), net: new Float64Array(NSLOT * 2), win: new Float64Array(NSLOT * 2), cr: new Float64Array(NSLOT * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; const k = c * 2 + w; A.n[k]++; A.sum[k] += R; A.sq[k] += R * R;
  A.net[k] += R - cr; A.cr[k] += cr; if (R > 0) A.win[k]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const lv = LADDERS.map((L) => { const A = F[L.key], levels = keyLevels(A); return { A, levels, byM: new Map(levels.map((x) => [x.m, x])) }; });
  const acc = newAcc(); const cnt = { signals: sigs.length, sims: 0, dropped: 0, bad: 0, small: 0, open: 0, noKey: 0 };
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { cnt.dropped++; continue; }
    const fill = M5[fi].o, s = g.s, risk = s * (fill - g.stop);
    if (!(risk > 0)) { cnt.bad++; continue; }
    if (risk < cost) { cnt.small++; continue; }
    if (!(s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const kp = keyTarget(lv[g.l].A, lv[g.l].levels, lv[g.l].byM, s, fill, t), kr = Number.isFinite(kp) ? (s * (kp - fill)) / risk : NaN;
    const ks = [1, 2, kr >= 1 ? kr : NaN]; if (!(kr >= 1)) cnt.noKey++;
    const r = exits(M5, s, fi, g.stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), LADDERS[g.l].cap); cnt.sims++;
    if (!r) { cnt.open++; continue; }
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    for (let x = 0; x < 3; x++) { if (!Number.isFinite(ks[x])) continue;
      const c = g.kind === 'g' ? cellIndex(g.l, g.idx, x) : ctrlIndex(g.l, g.idx, x); add(acc, c, w, m, r.R[x], cr); }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, ...cnt, acc: J(acc) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.l, g.kind, g.idx, g.s, g.ts, g.stop.toFixed(8), g.age].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function slotStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const k = c * 2 + w, n = A.n[k], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[k] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[k] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[k] / n : null, costR: n ? A.cr[k] / n : null, months: b - a, sum: A.sum[k], sq: A.sq[k] }; };
  return { d: win(0), c: win(1) };
}
export function judge(data) {
  const P = pool(data); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = slotStats(P, c), nm = cellName(c);
    const ctl = controlsOf(c).map((k) => { const cs = slotStats(P, k), kn = CTRLS[((k - NCELL) / 3 | 0) % CTRLS.length];
      return { name: kn, d: cs.d, c: cs.c, vs: { d: welch(s.d, cs.d), c: welch(s.c, cs.c) } }; });
    rows.push({ cell: c, ...nm, d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: r.ctl.every((k) => k.vs.d != null && k.vs.c != null && k.vs.d >= 2 && k.vs.c >= 2) };
    r.pass = Object.values(r.checks).every(Boolean); });
  return rows;
}
export function verdictOf(rows) {
  if (rows.some((r) => r.pass)) return 'PASS';
  if (rows.some((r) => (r.checks.n && r.checks.disc && r.checks.conf && r.checks.holm) || (!r.checks.n && r.checks.disc && r.checks.conf && r.checks.control))) return 'INCONCLUSIVE';
  return 'FAIL';
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : (x >= 0 ? '' : '-') + Math.abs(x).toFixed(2));
const N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(4), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), verdict = data.length < 10 ? 'INCONCLUSIVE' : verdictOf(rows);
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], b = [...pass].sort((p, q) => q.c.t - p.c.t)[0] || best;
  const vsTxt = (r) => r.ctl.map((k) => `${k.name} Welch t ${f2(k.vs.d)} / ${f2(k.vs.c)}`).join(', ');
  const headline = verdict === 'PASS'
    ? `${pass.length} of 42 cells pass before costs; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), ${f3(b.c.meanNet)}R after costs`
    : `${pass.length} of 42 cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}; ${vsTxt(b)})`;
  const ctlRows = []; const P = pool(data);
  LADDERS.forEach((L, l) => CTRLS.forEach((k, ki) => EXITS.forEach((x, xi) => { const s = slotStats(P, ctrlIndex(l, ki, xi)); ctlRows.push({ control: `${L.name} ${k} ${x}`, disc: slim(s.d), conf: slim(s.c) }); })));
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = slotStats(pool([d]), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const out = { study: 'msnr-switch-fade', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums and against controls (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, noKey: d.noKey })),
    passed: pass.map((r) => r.name), bestConfirmation: best.name,
    cut, cells: rows.map((r) => ({ cell: r.name, ladder: r.ladder, group: r.group, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
      controls: r.ctl.map((k) => ({ name: k.name, vsDisc: k.vs.d == null ? null : +k.vs.d.toFixed(2), vsConf: k.vs.c == null ? null : +k.vs.c.toFixed(2) })),
      checks: r.checks, pass: r.pass })),
    controls: ctlRows, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Right after an MSNR switch: fade the first pullback, take the first break, enter on the switch (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The desk\'s direction call (`council/eg-methods.mjs` `direction()`, imported unchanged) on two ladders: **L4** working H4 with',
    'Daily key levels, trades on M15; **LH** working H1 with H4 key levels, trades on M5. After each switch of the call to side s:',
    '**(a)** the first trigger-chart structure break AGAINST s, faded (entered with s); **(b)** the first break WITH s, entered with',
    'it; **(c)** entry with s on the switch candle\'s close. (a) and (b) split by the call\'s age at the trigger (0-1, 2-5, 6-20',
    'working candles). Market entry at the next 5-minute open; stop past the trigger leg + 0.1 ATR (a, b) or past the tapped key',
    'zone + 0.1 ATR (c); exits 1R, 2R or the nearest opposite key-timeframe turn of the closes (only when 1R or more away); time',
    'limit 1 day (L4) / 8 hours (LH). 42 cells, ten markets pooled, OANDA mid 5-minute candles, discovery 2005-14, confirmation',
    '2015 to October 2026. Judged before costs on month sums, Holm over the 42, and against controls: the same triggers under a call',
    'older than 20 working candles (and, for (a), the plain fade of every break whatever the call).',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 42.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its control(s) by Welch t >= 2 in both windows: ${cnt((r) => r.checks.control)}.`,
    `- **All: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t); after costs beside ("net"). "vs ctl" = trade-level Welch t of the cell minus each control,',
    'discovery / confirmation (for (a): old-call fade, then plain fade).', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | vs ctl | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${r.ctl.map((k) => `${f2(k.vs.d)} / ${f2(k.vs.c)}`).join('; ')} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## The controls', '', '| Control | n 05-14 | R 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 |', '|---|---:|---:|---:|---:|---:|');
  for (const c of o.controls) L.push(`| ${c.control} | ${N(c.disc.n)} | ${f3(c.disc.mean)} (${f2(c.disc.t)}) | ${N(c.conf.n)} | ${f3(c.conf.mean)} (${f2(c.conf.t)}) | ${f3(c.conf.meanNet)} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (cells and controls alike).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | unresolved at data end | no key level 1R+ away |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} | ${N(m.noKey)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cell(s) clear the pre-registered bar before costs: the moment after a switch adds something the same trigger under an old call`,
    'does not. A before-cost result on mid candles; the after-cost column says how much the bid / ask takes. Nothing is adopted; a forward',
    'record or any live change needs the owner. One run, no variants on these years.');
  else L.push('No cell clears the bar. Fading the first pullback after a fresh switch, taking the first break with it, or entering on the',
    'switch candle does not do measurably better than the same triggers under an old call (or, for the fade, than the plain fade of every',
    'break): the timing of the switch adds nothing the fade or the call did not already show. Never call any of these an edge; do not',
    're-test variants of these 42 cells on these years. Nothing live changed; no rule is proposed.');
  if (o.verdict === 'INCONCLUSIVE') { const r = rows.find((x) => x.checks.n && x.checks.disc && x.checks.conf && x.checks.holm) || rows.find((x) => !x.checks.n && x.checks.disc && x.checks.conf && x.checks.control);
    L.push('', `INCONCLUSIVE, not a pass, by the pre-registered rule: ${r.name} clears the before-cost and Holm checks but not its control(s)`,
      `(${r.ctl.map((k) => `${k.name} Welch t ${f2(k.vs.d)} / ${f2(k.vs.c)}`).join(', ')}). The same exit under an old call and on every break faded does`,
      'about as well, so the result belongs to fading a lower-timeframe break with a far target, not to the switch; and after costs it',
      `loses (${f3(r.c.meanNet)}R a trade in 2015-26).`); }
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}

// research/edge/equal-hl-sweep/run.mjs - equal highs / lows swept or broken, PREREGISTRATION.md (23 Nov 2026): the pool of
// research/edge/ict-equal-lows/eq.mjs on M15 and H1, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged
// before costs on month sums, each cell against a single-swing control. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/equal-hl-sweep/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/equal-hl-sweep/run.mjs cut <m> <outDir>
//   node research/edge/equal-hl-sweep/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { exits, sessionOf, SESS } from '../grid7-wide-fade/run.mjs';
import { sweptSwings, equalPool } from '../ict-equal-lows/eq.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['15m', '1h'], TFN = ['m15', 'h1'], POOLS = ['2', '3+'], EXITS = ['1R', '2R', 'range'], TYPES = ['sweep', 'break'];
export const ATRK = 0.1, CAP = { '15m': 86400, '1h': 2 * 86400 };
export const NS = 36, NCELL = 48;
export const sweepCell = (tf, pz, se, x) => ((tf * 2 + pz) * 3 + se) * 3 + x;
export const breakCell = (tf, pz, x) => NS + (tf * 2 + pz) * 3 + x;
export function cellName(i) {
  if (i < NS) { const x = i % 3; let r = (i - x) / 3; const se = r % 3; r = (r - se) / 3; const pz = r % 2; const tf = (r - pz) / 2;
    return { type: 'sweep', tf: TFN[tf], pool: POOLS[pz], session: SESS[se], exit: EXITS[x], name: `sweep ${TFN[tf]} pool ${POOLS[pz]} ${SESS[se]} ${EXITS[x]}` }; }
  const j = i - NS, x = j % 3, r = (j - x) / 3, pz = r % 2, tf = (r - pz) / 2;
  return { type: 'break', tf: TFN[tf], pool: POOLS[pz], session: 'all', exit: EXITS[x], name: `break ${TFN[tf]} pool ${POOLS[pz]} all ${EXITS[x]}` };
}

// daily ATR(14) of the 17:00 New York days that ENDED at or before closeT (end time, so a day still running is never read)
export function dailyAtrE(D, closeT) {
  let lo = 0, hi = D.length; while (lo < hi) { const m = (lo + hi) >> 1; if (D[m].e <= closeT) lo = m + 1; else hi = m; }
  const di = lo - 1; if (di < 13) return null;
  let s = 0; for (let i = di - 13; i <= di; i++) s += D[i].h - D[i].l; return s / 14;
}

// ---- events (closed candles only) ---------------------------------------------------------------------------------------
// { tf, grp: 'single' | 2 | 3, type: 'sweep' | 'break', side (+1 lows, -1 highs), k, ts (close of k), L, edge, ext, a }
export function events(F) {
  const out = [], D = F['1d'];
  TFS.forEach((tfk, tf) => {
    const T = F[tfk], atr = atr14(T), H = T.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
    for (let s = 1; s < T.length; s++) for (const side of [1, -1]) {
      if (side > 0 ? !(T[s].l < T[s - 1].l) : !(T[s].h > T[s - 1].h)) continue;   // an untouched swing is at or past the previous candle
      const sw = sweptSwings(H, s, side); if (!sw.length) continue;
      let grp;
      if (sw.length === 1) grp = 'single';
      else { const atrD = dailyAtrE(D, T[s].e); if (!(atrD > 0)) continue; const p = equalPool(H, s, side, atrD); if (!p.eq) continue; grp = p.pool >= 3 ? 3 : 2; }
      const lv = sw.map((x) => x.level), L = side > 0 ? Math.min(...lv) : Math.max(...lv), i0 = Math.min(...sw.map((x) => x.i));
      let edge = side > 0 ? -Infinity : Infinity;
      for (let q = i0; q < s; q++) edge = side > 0 ? Math.max(edge, T[q].h) : Math.min(edge, T[q].l);
      let k = -1, type = null;
      for (let q = s; q <= s + 2 && q < T.length; q++) { const c = T[q].c;
        if (side > 0 ? c < L : c > L) { type = 'break'; k = q; break; }
        if (side > 0 ? c > L : c < L) { type = 'sweep'; k = q; break; } }
      if (!type) continue;
      let ext = side > 0 ? Infinity : -Infinity;
      for (let q = s; q <= k; q++) ext = side > 0 ? Math.min(ext, T[q].l) : Math.max(ext, T[q].h);
      out.push({ tf, grp, type, side, k, ts: T[k].e, L, edge, ext, a: atr[k] });
    }
  });
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const ev = events(F), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), ctrl = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0;
  const cnt = { sweep: { single: 0, 2: 0, 3: 0 }, break: { single: 0, 2: 0, 3: 0 } };
  for (const g of ev) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, dir = g.type === 'sweep' ? g.side : -g.side;
    const stop = g.type === 'sweep' ? g.ext - dir * ATRK * g.a : fill - dir * g.a, risk = dir * (fill - stop);
    if (!(g.a > 0) || !(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(dir * (fill - stop) > 0)) throw new Error('stop on the wrong side');
    const tgR = g.type === 'sweep' ? (dir * (g.edge - fill)) / risk : (dir * (2 * g.L - g.edge - fill)) / risk;
    const ks = [1, 2, tgR >= 1 ? tgR : NaN];
    const r = exits(M5, dir, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + dir * k * risk : NaN)), CAP[TFS[g.tf]]); sims++;
    if (!r) { open++; continue; }
    cnt[g.type][g.grp]++;
    const cr = cost / risk, m = monthOf(t), w = t < SPLIT ? 0 : 1, se = sessionOf(t);
    const pzs = g.grp === 'single' ? [0, 1] : [g.grp === 3 ? 1 : 0], A = g.grp === 'single' ? ctrl : real;
    for (const pz of pzs) for (let x = 0; x < 3; x++) { if (!Number.isFinite(ks[x])) continue;
      add(A, g.type === 'sweep' ? sweepCell(g.tf, pz, se, x) : breakCell(g.tf, pz, x), w, m, r.R[x], cr); }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    events: ev.length, sims, dropped, bad, small, open, counts: cnt, real: J(real), ctrl: J(ctrl) };
}

// ---- cut test: the events known by a date, computed on candles cut there, equal the full run's -----------------------------
export const evKey = (g) => [g.tf, g.grp, g.type, g.side, g.ts, g.L, g.edge, g.ext, g.a.toFixed(10)].join('|');
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const full = events(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + "T00:00:00Z") / 1000;
    const cut = events(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(evKey);
    const want = full.filter((g) => g.ts <= T).map(evKey); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w], mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null,
      tNet: mstat(msn, a, b).t, win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export function judge(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctrl'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), k = cellStats(C, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, ctl: { d: k.d, c: k.c }, wd: welch(s.d, k.d), wc: welch(s.c, k.c), p: p1(s.c.t, s.c.months - 1) }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: r.wd != null && r.wc != null && r.wd >= 2 && r.wc >= 2 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...rows].filter((r) => r.c.n > 0).sort((a, b) => b.c.t - a.c.t)[0], b = [...pass].sort((x, y) => y.c.t - x.c.t)[0] || best;
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 48 cells pass before costs; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 48 cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}; against its single-swing control Welch t ${f2(b.wc)})`;
  const RW = rows.map((r) => ({ cell: r.name, type: r.type, tf: r.tf, pool: r.pool, session: r.session, exit: r.exit, disc: slim(r.d), conf: slim(r.c),
    control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) }, welchDisc: r.wd == null ? null : +r.wd.toFixed(4), welchConf: r.wc == null ? null : +r.wc.toFixed(4),
    holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass }));
  const out = { study: 'equal-hl-sweep', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums, each cell against its single-swing control (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      events: d.events, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, counts: d.counts })),
    passed: pass.map((r) => r.name), bestConfirmation: best.name,
    passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name),
    beatControlBoth: rows.filter((r) => r.checks.control).map((r) => r.name),
    cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Equal highs / lows: the sweep and the break of a pool (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'On M15 and H1, every candle that takes two or more equal, untouched swing lows / highs (the detector of',
    '`research/edge/ict-equal-lows/eq.mjs`: 3 candles a side, last 96 candles, within 0.1 x the daily ATR, 4+ candles apart).',
    'Sweep = within that candle and the next two, a close back on the pool\'s side before any close beyond it: traded back at the',
    'next 5-minute open, stop past the sweep\'s extreme + 0.1 ATR. Break = a close beyond the deepest swept swing first: traded with',
    'it, stop 1 ATR. Exits 1R, 2R, or the range (sweep: the range\'s far edge; break: the measured move; only when 1R or more away).',
    'Ten markets pooled, OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026. Each cell is',
    'judged before costs on month sums and against its control: the same event on a single swing taken alone.',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 48.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its single-swing control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs ("net") beside; control = the same cell on single-swing events;',
    'W = Welch t, cell minus control.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | ctrl R 05-14 | W 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctrl R 15-26 | W 15-26 | Holm | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${f3(r.ctl.d.mean)} | ${f2(r.wd)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.ctl.c.mean)} | ${f2(r.wc)} | ${r.holm.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] |', '|---|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'none'}: ${N(nCut)} events known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | events | simulated | sweeps pool / single | breaks pool / single | dropped (bad data) | past the stop | risk under cost | unresolved |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.events)} | ${N(m.sims)} | ${N(m.counts.sweep[2] + m.counts.sweep[3])} / ${N(m.counts.sweep.single)} | ${N(m.counts.break[2] + m.counts.break[3])} / ${N(m.counts.break.single)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cells clear the pre-registered bar before costs, including beating a single swing taken the same way. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' stay positive after costs in both windows.' : 'None stays positive after costs in both windows: it is a before-cost tilt, not something to trade.'}`,
    'Nothing is adopted; a forward record or a live change needs the owner.');
  else {
    const sw = rows.filter((r) => r.type === 'sweep'), br = rows.filter((r) => r.type === 'break');
    L.push(`No cell clears the bar. **Sweeps**: traded back, a swept pool makes about zero before costs and does not beat a single`,
      `swing swept the same way (${sw.filter((r) => r.checks.control).length} of 36 sweep cells beat the control in both windows; in the M15 "other hours" cells the single`,
      'swing does better). **Breaks**: traded with the break, an equal pool loses less than a single swing broken the same way',
      `(${br.filter((r) => r.checks.control).length} of 12 break cells beat the control in both windows), but the pool breaks themselves are about zero or negative`,
      'before costs (every break cell between -0.05R and +0.14R a trade, none with a month t of 2 in both windows): "loses less than the control" is not',
      'a trade. After costs every cell loses in the confirmation window. Silver: about a third of its events had a risk under the',
      'ASSUMED round trip and were no trades. Do not re-test variants of these 48 cells on these years. Nothing live changed; no rule',
      'is proposed.');
  }
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'events', r.events, 'sims', r.sims, JSON.stringify(r.counts), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}

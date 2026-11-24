// research/edge/structure-break-improve/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): a fixed 324-cell search for an
// improvement of the structure-break trades (exits 2R / 3R / 4R / trail x nine filters x three entries x M15 / H1 / H4) on the ten
// markets already read, judged after costs; a mechanical pick of at most five cells; those five, unchanged, on eight markets no
// structure-break study had read (the verdict). Signals are structure-bos-choch-wide's (imported, unchanged).
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node run.mjs market <m> <outDir>            (search markets: every cell)
//   node run.mjs pick <outDir>                                      (writes <outDir>/picks.json)
//   EDGE_DATA=<cache> node run.mjs holdout <m> <outDir>           (holdout markets: the picked cells only)
//   EDGE_DATA=<cache> node run.mjs cut <m> <outDir>
//   node run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { exits } from '../grid7-wide-fade/run.mjs';
import { signals, cutTest, TFS, CAP, MARKETS as SEARCH } from '../structure-bos-choch-wide/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export { SEARCH };
export const HOLD = ['gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const ENTRIES = ['with', 'fade', 'retest'], TFN = ['m15', 'h1', 'h4'], EXITS = ['2R', '3R', '4R', 'trail'];
export const FILTERS = ['all', 'cost10', 'big', 'small', 'bos3', 'choch', 'htfWith', 'htfAgainst', 'day'];
export const NCELL = 3 * 3 * 4 * 9, NPICK = 5;
export const cellOf = (en, tf, x, f) => ((en * 3 + tf) * 4 + x) * 9 + f;
export function cellName(i) { const f = i % 9; let r = (i - f) / 9; const x = r % 4; r = (r - x) / 4; const tf = r % 3; const en = (r - tf) / 3;
  return { entry: ENTRIES[en], tf: TFN[tf], exit: EXITS[x], filter: FILTERS[f], name: `${ENTRIES[en]} ${TFN[tf]} ${EXITS[x]} ${FILTERS[f]}` }; }
// the filters a trade belongs to (facts known at the entry)
export function filtersOf(g, cr) {
  const h = new Date(g.fillT * 1000).getUTCHours();
  return [true, cr <= 0.10, g.rng >= 1.5, g.rng < 1.0, g.kd === 0 && g.cnt === 2, g.kd === 1, g.h === 0, g.h === 1, h >= 7 && h < 17];
}

// no target; from +1R the stop trails 1R behind the best price reached (updated at each 5-minute close, in force from the next
// candle, never moved back); a gap through the stop fills at the open; out at the time limit. R or null (data ends).
export function trail(M5, s, fi, stop0, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop0); if (!(risk > 0)) return null;
  let stop = stop0, best = fill; const dl = M5[fi].t + cap;
  for (let j = fi; j < M5.length; j++) { const b = M5[j];
    if (j > fi && s * (b.o - stop) <= 0) return (s * (b.o - fill)) / risk;
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) return (s * (stop - fill)) / risk;
    if (b.e >= dl) return (s * (b.c - fill)) / risk;
    const hi = s > 0 ? b.h : b.l; if (s * (hi - best) > 0) best = hi;
    if (s * (best - fill) >= risk) { const ns = best - s * risk; if (s * (ns - stop) > 0) stop = ns; }
  }
  return null;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.net[c * 2 + w] += R - cr;
  A.cr[c * 2 + w] += cr; if (R - cr > 0) A.win[c * 2 + w]++; }

// one market; only: a Set of cell indexes to accumulate (null = every cell)
export function runMarket(market, only = null) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market); if (!(cost > 0)) throw new Error('no cost for ' + market);
  const T = TFS.map((k) => F[k]), A = TFS.map((k) => atr14(F[k]));
  const acc = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0;
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const s = g.s, fill = M5[fi].o, risk = s * (fill - g.stop);
    if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const bi = K.closedCount(T[g.tf], g.brk) - 1, b = T[g.tf][bi], a = A[g.tf][bi];
    g.rng = a > 0 ? (b.h - b.l) / a : NaN; g.fillT = t;
    const cr = cost / risk, fl = filtersOf(g, cr);
    const want = (x) => !only || fl.some((ok, f) => ok && only.has(cellOf(g.en, g.tf, x, f)));
    const R = [NaN, NaN, NaN, NaN]; const cap = CAP[TFS[g.tf]];
    if (want(0) || want(1) || want(2)) { const r = exits(M5, s, fi, g.stop, [2, 3, 4].map((k) => fill + s * k * risk), cap); if (!r) { open++; continue; } R[0] = r.R[0]; R[1] = r.R[1]; R[2] = r.R[2]; }
    if (want(3)) { const r = trail(M5, s, fi, g.stop, cap); if (r == null) { open++; continue; } R[3] = r; }
    sims++;
    const m = monthOf(t), w = t < SPLIT ? 0 : 1;
    for (let x = 0; x < 4; x++) { if (Number.isNaN(R[x])) continue;
      for (let f = 0; f < 9; f++) if (fl[f]) { const c = cellOf(g.en, g.tf, x, f); if (!only || only.has(c)) add(acc, c, w, m, R[x], cr); } }
  }
  const J = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, signals: sigs.length, sims, dropped, bad, small, open, acc: J(acc) };
}

export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      winNet: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null }; };
  const all = { n: A.n[c * 2] + A.n[c * 2 + 1], mean: null, meanNet: null, t: mstat(ms, 0, NM).t, tNet: mstat(msn, 0, NM).t };
  if (all.n) { all.mean = (A.sum[c * 2] + A.sum[c * 2 + 1]) / all.n; all.meanNet = (A.net[c * 2] + A.net[c * 2 + 1]) / all.n; }
  return { d: win(0), c: win(1), all };
}
// the pre-registered pick: after costs, n >= 300 and mean > 0 in both windows; rank by the smaller after-cost month t; top five
export function pick(A) {
  const rows = []; for (let c = 0; c < NCELL; c++) { const s = cellStats(A, c);
    const ok = s.d.n >= 300 && s.c.n >= 300 && s.d.meanNet > 0 && s.c.meanNet > 0; rows.push({ c, ok, key: Math.min(s.d.tNet, s.c.tNet), s }); }
  return rows.filter((r) => r.ok).sort((a, b) => b.key - a.key || a.c - b.c).slice(0, NPICK).map((r) => r.c);
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v == null ? null : +(+v).toFixed(k === 'n' ? 0 : 4)]));
const readAll = (dir, list, pre = '') => list.filter((m) => fs.existsSync(path.join(dir, pre + m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, pre + m + '.json'), 'utf8')));

export function report(dir) {
  const S = readAll(dir, SEARCH), H = readAll(dir, HOLD, 'hold-');
  const picks = JSON.parse(fs.readFileSync(path.join(dir, 'picks.json'), 'utf8'));
  const cut = HOLD.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const AS = pool(S), AH = pool(H);
  if (JSON.stringify(pick(AS)) !== JSON.stringify(picks)) throw new Error('picks.json does not match the search');
  const search = Array.from({ length: NCELL }, (_, c) => ({ cell: cellName(c).name, ...cellName(c), ...(({ d, c: cc, all }) => ({ disc: slim(d), conf: slim(cc), all: slim(all) }))(cellStats(AS, c)) }));
  const hold = picks.map((c) => { const s = cellStats(AH, c); return { cell: cellName(c).name, search: search[c], d: s.d, c: s.c, all: s.all, p: p1(s.all.tNet, NM - 1),
    perMarket: H.map((d) => { const q = cellStats(pool([d]), c).all; return { market: d.market, n: q.n, mean: q.mean, meanNet: q.meanNet, tNet: q.tNet }; }) }; });
  const hl = K.holm(hold.map((h) => h.p)); hold.forEach((h, i) => { h.holm = hl[i]; h.pass = h.all.n >= 300 && h.all.meanNet > 0 && h.all.tNet >= 2 && hl[i] < 0.05; });
  const pass = hold.filter((h) => h.pass);
  const verdict = H.length < 6 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const b = [...hold].sort((x, y) => y.all.tNet - x.all.tNet)[0];
  const headline = !picks.length ? 'no search cell was positive after costs in both windows with 300+ trades, so nothing went to the holdout'
    : verdict === 'PASS' ? `${pass.length} of ${picks.length} picked cells pass on the eight unread markets; best ${b.cell}, ${f3(b.all.meanNet)}R a trade after costs (n ${N(b.all.n)}, month t ${f2(b.all.tNet)})`
    : `0 of ${picks.length} picked cells pass on the eight unread markets; the best, ${b.cell}, made ${f3(b.all.meanNet)}R a trade after costs (n ${N(b.all.n)}, month t ${f2(b.all.tNet)}; ${f3(b.all.mean)}R before costs)`;
  const out = { study: 'structure-break-improve', built: '2026-11-24', verdict, headline, basis: 'search on ten read markets (in sample, not evidence); the verdict is the holdout on eight unread markets, after costs, Holm over the picks',
    searchMarkets: S.map((d) => d.market), holdoutMarkets: H.map((d) => d.market), costs: Object.fromEntries([...S, ...H].map((d) => [d.market, d.cost])),
    eligible: search.filter((r) => r.disc.n >= 300 && r.conf.n >= 300 && r.disc.meanNet > 0 && r.conf.meanNet > 0).map((r) => r.cell),
    picked: picks.map((c) => cellName(c).name), passed: pass.map((h) => h.cell),
    holdout: hold.map((h) => ({ cell: h.cell, all: slim(h.all), disc: slim(h.d), conf: slim(h.c), holm: +h.holm.toFixed(4), pass: h.pass, perMarket: h.perMarket.map(slim0) })),
    meta: [...S, ...H].map((d) => ({ market: d.market, set: HOLD.includes(d.market) ? 'holdout' : 'search', first: new Date(d.first * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })), cut, search };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}
function slim0(x) { return { market: x.market, n: x.n, mean: x.mean == null ? null : +x.mean.toFixed(4), meanNet: x.meanNet == null ? null : +x.meanNet.toFixed(4), tNet: +x.tNet.toFixed(2) }; }

function resultMd(o) {
  const L = []; const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  L.push('# Structure breaks: looking for an improvement, then a holdout on eight unread markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The structure-break trades of `structure-bos-choch-wide` (imported unchanged: breaks on M15 / H1 / H4, entries with, fade and',
    'retest) searched over 324 fixed cells: exits 2R / 3R / 4R / a 1R trailing stop from +1R, and nine filters (all; cost at most',
    '0.10 of the risk; a big or small break candle; BOS 3rd+; ChoCh; the next timeframe up with or against; London + New York',
    'hours). Search = the ten markets already read, 2005 to Oct 2026, AFTER costs (in sample: not evidence). Pick = the cells',
    'with n >= 300 and an after-cost mean > 0 in both 2005-14 and 2015-26, ranked by the smaller after-cost month t, top five.',
    `Holdout = those cells unchanged on ${o.holdoutMarkets.join(', ')} (never read by a structure-break study; \`combo-grid-3\``,
    'read their 2020-26 candles under other rules), after costs, Holm over the picks. All holdout costs are ASSUMED.', '',
    '## The search (in sample)', '',
    `Eligible after costs in both windows: **${o.eligible.length} of 324**${o.eligible.length ? ' (' + o.eligible.join('; ') + ')' : ''}.`,
    `Picked: ${o.picked.length ? o.picked.join('; ') : 'none'}.`, '');
  if (o.holdout.length) {
    L.push('## The holdout (the test)', '', 'After costs (before costs beside); month t over 2005-01 to 2026-10; Holm over the picks.', '',
      '| Cell | search net R (t) 05-14 / 15-26 | holdout n | holdout R before | holdout net R (t) | net 05-14 / 15-26 | Holm | Pass |', '|---|---:|---:|---:|---:|---:|---:|---|');
    for (const h of o.holdout) { const s = o.search.find((x) => x.cell === h.cell);
      L.push(`| ${h.cell} | ${f3(s.disc.meanNet)} (${f2(s.disc.tNet)}) / ${f3(s.conf.meanNet)} (${f2(s.conf.tNet)}) | ${N(h.all.n)} | ${f3(h.all.mean)} | ${f3(h.all.meanNet)} (${f2(h.all.tNet)}) | ${f3(h.disc.meanNet)} / ${f3(h.conf.meanNet)} | ${h.holm.toFixed(3)} | ${h.pass ? 'yes' : 'no'} |`); }
    L.push('', '### Per holdout market (after costs; all costs ASSUMED)', '', `| Cell | ${o.holdoutMarkets.join(' | ')} |`, `|---|${o.holdoutMarkets.map(() => '---:').join('|')}|`);
    for (const h of o.holdout) L.push(`| ${h.cell} | ${h.perMarket.map((m) => `${f3(m.meanNet)} (n ${N(m.n)})`).join(' | ')} |`);
    L.push('');
  }
  L.push('## What it means', '');
  if (o.verdict === 'PASS') L.push('A picked cell held on markets it was not picked on, after assumed costs. That is one holdout on assumed costs, not',
    'an edge yet: the costs must be measured and a forward record kept before anything is adopted; nothing live changed.');
  else L.push('Nothing found in the search survived on the unread markets (or nothing was eligible to try). The improvements tried here',
    '(longer targets, a trailing stop, wider stops against the cost, the kind of break, the bigger timeframe, the busy hours) do not',
    'turn the structure-break trades into a rule that makes money after costs. Do not search these cells again on these markets.',
    'Nothing live changed; no rule is proposed.');
  L.push('', '## Checks', '',
    `- Cut test on the holdout markets: ${o.cut.length} cuts, ${N(nCut)} signals known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.', '',
    '| Market | set | candles from | signals | simulated | dropped | past the stop | risk under cost | unresolved |', '|---|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.set} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## Every search cell (ten read markets, in sample)', '', 'R a trade before costs, after costs, (after-cost month t).', '',
    '| Cell | n 05-14 | R | net (t) | n 15-26 | R | net (t) |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const r of o.search) L.push(`| ${r.cell} | ${N(r.disc.n)} | ${f3(r.disc.mean)} | ${f3(r.disc.meanNet)} (${f2(r.disc.tNet)}) | ${N(r.conf.n)} | ${f3(r.conf.mean)} | ${f3(r.conf.meanNet)} (${f2(r.conf.tNet)}) |`);
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const r = runMarket(a); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'sims', r.sims); }
  else if (cmd === 'pick') { const P = pick(pool(readAll(a, SEARCH))); fs.writeFileSync(path.join(a, 'picks.json'), JSON.stringify(P)); console.log(P.map((c) => cellName(c).name)); }
  else if (cmd === 'holdout') { const P = new Set(JSON.parse(fs.readFileSync(path.join(b, 'picks.json'), 'utf8'))); const r = runMarket(a, P);
    fs.writeFileSync(path.join(b, 'hold-' + a + '.json'), JSON.stringify(r)); console.log(a, 'holdout sims', r.sims); }
  else if (cmd === 'cut') { const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(a, r.map((x) => x.missing + x.extra).join(',')); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market|pick|holdout|cut|report ...');
}

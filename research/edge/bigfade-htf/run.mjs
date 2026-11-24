// research/edge/bigfade-htf/run.mjs - PREREGISTRATION.md (24 Nov 2026): big-candle-fade's rule on H4 candles, judged AFTER costs.
// Two tests (H4 k1.5 / k2 nobreak half), ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, Holm over 2.
// Research only: nothing live imports it, nothing is placed.
//   node research/edge/bigfade-htf/run.mjs market <m> <outDir>
//   node research/edge/bigfade-htf/run.mjs cut <m> <outDir>
//   node research/edge/bigfade-htf/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { breaks, exits, ATRK } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KS = [1.5, 2], SPLITS = ['break', 'nobreak'], EXITS = ['1R', '2R', 'half'], CAP = 8 * 86400;   // fade-htf's H4 cap
export const NCELL = 12, NPLAIN = 3;
export const cellIndex = (k, sp, x) => (k * 2 + sp) * 3 + x;
export function cellName(i) { const x = i % 3, r = (i - x) / 3, sp = r % 2, k = (r - sp) / 2;
  return { k: KS[k], split: SPLITS[sp], exit: EXITS[x], name: `h4 k${KS[k]} ${SPLITS[sp]} ${EXITS[x]}` }; }
export const TESTS = [cellIndex(0, 1, 2), cellIndex(1, 1, 2)];   // T1 h4 k1.5 nobreak half, T2 h4 k2 nobreak half
export const h4 = (M5) => K.resample(M5, 14400);

// big-candle-fade's signals() on one timeframe T (closed candles only; ATR of the 14 candles before the candle)
export function signals(T) {
  const big = [], plain = [], atr = atr14(T), ev = breaks(T), dirAt = new Map(ev.map((e) => [e.i, e.dir]));
  for (const e of ev) { const a = atr[e.i]; if (!(a > 0)) continue; const b = T[e.i];
    plain.push({ j: e.i, d: e.dir, ts: b.e, ext: e.dir > 0 ? b.h : b.l, mid: (b.h + b.l) / 2, a }); }
  for (let j = 15; j < T.length; j++) { const b = T[j], a = atr[j - 1]; if (!(a > 0)) continue;
    const body = Math.abs(b.c - b.o); let kmax = -1; for (let k = 0; k < KS.length; k++) if (body > KS[k] * a) kmax = k;
    if (kmax < 0) continue; const d = b.c > b.o ? 1 : -1;
    big.push({ j, d, ts: b.e, ext: d > 0 ? b.h : b.l, mid: (b.h + b.l) / 2, a, kmax, brk: dirAt.get(j) === d }); }
  return { big, plain };
}

// big-candle-fade's trade(), H4 time limit; returns the fade and the with-the-candle mirror
export function trade(M5, g, cost) {
  const fi = startIdx(M5, g.ts); if (fi >= M5.length) return null;
  const fill = M5[fi].o, s = -g.d, stop = g.ext + g.d * ATRK * g.a, risk = s * (fill - stop);
  if (!(risk > 0)) return { skip: 'bad' };
  if (risk < cost) return { skip: 'small' };
  if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
  const hr = (s * (g.mid - fill)) / risk; const ks = [1, 2, hr >= 1 ? hr : NaN];
  const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), CAP);
  const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), CAP);
  if (!r || !p) return { skip: 'open' };
  return { fi, t: M5[fi].t, fill, stop, risk, s, ks, R: r.R, M: p.R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc(n) { return { ms: new Float64Array(n * NM), msNet: new Float64Array(n * NM), n: new Float64Array(n * 2), sum: new Float64Array(n * 2),
  net: new Float64Array(n * 2), netSq: new Float64Array(n * 2), win: new Float64Array(n * 2), cr: new Float64Array(n * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R;
  A.net[c * 2 + w] += R - cr; A.netSq[c * 2 + w] += (R - cr) * (R - cr); A.cr[c * 2 + w] += cr; if (R - cr > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const { big, plain } = signals(h4(M5));
  const cost = COSTS[market], X = exclusions(market);
  const fade = newAcc(NCELL), mirr = newAcc(NCELL), pl = newAcc(NPLAIN); const cnt = { dropped: 0, bad: 0, small: 0, open: 0, sims: 0 };
  const run = (g, fn) => {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) return; const t = M5[fi].t; if (t < FROM || t >= TO) return;
    if (X.length && inBad(X, t)) { cnt.dropped++; return; }
    const r = trade(M5, g, cost); if (!r) return; if (r.skip) { cnt[r.skip]++; return; } cnt.sims++;
    fn(r, monthOf(t), t < SPLIT ? 0 : 1, cost / r.risk);
  };
  for (const g of big) run(g, (r, m, w, cr) => {
    for (let x = 0; x < 3; x++) { if (!Number.isFinite(r.ks[x])) continue;
      for (let k = 0; k <= g.kmax; k++) { const c = cellIndex(k, g.brk ? 0 : 1, x); add(fade, c, w, m, r.R[x], cr); add(mirr, c, w, m, r.M[x], cr); } } });
  const bigCnt = { ...cnt }; for (const k of Object.keys(cnt)) cnt[k] = 0;
  for (const g of plain) run(g, (r, m, w, cr) => { for (let x = 0; x < 3; x++) if (Number.isFinite(r.ks[x])) add(pl, x, w, m, r.R[x], cr); });
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    bigSignals: big.length, plainSignals: plain.length, big: bigCnt, plainCnt: { ...cnt }, fade: J(fade), mirror: J(mirr), plain: J(pl) };
}

export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.ts, g.d, g.ext, g.mid, g.a.toFixed(10), g.kmax, g.brk].join('|');
  const full = signals(h4(M5)).big; const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(h4(M5.filter((b) => b.e <= T))).big.filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

export function pool(list, kind, n) { const A = newAcc(n); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      winNet: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (x, h) => x.d.n >= 200 && x.c.n >= 200 && x.d.meanNet > 0 && x.c.meanNet > 0 && x.c.tNet >= 2 && h < 0.05;

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(4), t: +w.t.toFixed(2), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(4),
  tNet: +w.tNet.toFixed(2), winNet: w.winNet == null ? null : +w.winNet.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });
// big-candle-fade's own H1 figures (its result.json), the half of the question it already answered
export const H1_PARENT = { 'h1 k1.5 nobreak half': { d: { n: 15349, mean: 0.189, net: -0.043 }, c: { n: 18425, mean: 0.070, t: 3.68, net: -0.190 } },
  'h1 k2 nobreak half': { d: { n: 6603, mean: 0.122, net: -0.107 }, c: { n: 7256, mean: 0.057, t: 1.73, net: -0.189 } } };

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const F = pool(data, 'fade', NCELL), M = pool(data, 'mirror', NCELL), P = pool(data, 'plain', NPLAIN);
  const cells = Array.from({ length: NCELL }, (_, c) => ({ cell: c, ...cellName(c), ...cellStats(F, c), mir: cellStats(M, c) }));
  const tests = TESTS.map((c) => cells[c]); const H = K.holm(tests.map((r) => p1(r.c.tNet, r.c.months - 1)));
  tests.forEach((r, i) => { r.holm = H[i]; r.pass = passOf(r, H[i]);
    r.checks = { n: r.d.n >= 200 && r.c.n >= 200, discNet: r.d.meanNet > 0, confNet: r.c.meanNet > 0, confT: r.c.tNet >= 2, holm: H[i] < 0.05 }; });
  const plain = EXITS.map((x, i) => ({ name: `h4 plain fade ${x}`, ...cellStats(P, i) }));
  const verdict = data.length < 10 ? 'INCONCLUSIVE' : tests.some((r) => r.pass) ? 'PASS' : 'FAIL';
  const b = [...tests].sort((a, c) => c.c.meanNet - a.c.meanNet)[0];
  const headline = `${tests.filter((r) => r.pass).length} of 2 H4 big-candle fade tests pass after costs; the better, ${b.name}, made ${f3(b.c.meanNet)}R a trade after costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.tNet)}; ${f3(b.c.mean)}R before costs, t ${f2(b.c.t)}; discovery ${f3(b.d.meanNet)}R after costs, ${f3(b.d.mean)}R before)`;
  const perMarket = Object.fromEntries(tests.map((r) => [r.name, data.map((d) => { const s = cellStats(pool([d], 'fade', NCELL), r.cell);
    return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; })]));
  const out = { study: 'bigfade-htf', built: '2026-11-24', verdict, headline,
    basis: 'judged after costs on calendar-month sums; Holm over the 2 tests',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' },
    markets: data.map((d) => d.market), assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    h1FromParent: H1_PARENT,
    tests: tests.map((r) => ({ test: r.name, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass,
      mirror: { disc: slim(r.mir.d), conf: slim(r.mir.c) } })),
    cells: cells.map((r) => ({ cell: r.name, disc: slim(r.d), conf: slim(r.c), mirror: { disc: slim(r.mir.d), conf: slim(r.mir.c) } })),
    plainFade: plain.map((p) => ({ name: p.name, disc: slim(p.d), conf: slim(p.c) })),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      bigSignals: d.bigSignals, plainSignals: d.plainSignals, big: d.big, plain: d.plainCnt })), cut, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, cells, tests, plain));
  return out;
}

function resultMd(o, cells, tests, plain) {
  const row = (nm, r, extra = '') => `| ${nm} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} (${f2(r.d.tNet)}) | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} (${f2(r.c.tNet)}) | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} |${extra}`;
  const hdr = '| Cell | n 05-14 | before (t) | after (t) | n 15-26 | before (t) | after (t) | cost R 15-26 |';
  const L = [];
  L.push('# Big-candle fade on H4 candles, after costs (result)', '');
  L.push(`**Verdict: ${o.verdict}. ${o.headline}.**`, '');
  L.push('Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live changed, nothing is proposed. One run, no variants.', '');
  L.push('## H1: already answered by big-candle-fade (not re-run)', '');
  L.push('That study\'s own H1 cells, same rule and costs, R a trade (after costs):', '');
  L.push('| Cell | n 05-14 | before | after | n 15-26 | before (t) | after |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const [k, v] of Object.entries(H1_PARENT)) L.push(`| ${k} | ${N(v.d.n)} | ${f3(v.d.mean)} | ${f3(v.d.net)} | ${N(v.c.n)} | ${f3(v.c.mean)} (${f2(v.c.t)}) | ${f3(v.c.net)} |`);
  L.push('', 'Every one of its 18 H1 cells is negative after costs in 2015-26.', '');
  L.push('## The two tests (H4), judged after costs', '');
  L.push('R a trade, month-sum t in brackets; "after" = after the round-trip cost (`combo-grid-2` `COSTS`; ASSUMED, not measured, for ' + o.assumedCosts.join(', ') + ').', '');
  L.push(hdr + ' Holm | Pass |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of tests) L.push(row(r.name, r, ` ${r.holm.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`));
  L.push('', 'Checks per test: ' + tests.map((r) => `${r.name}: ` + Object.entries(r.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')).join('; ') + '.', '');
  L.push('## Controls', '');
  L.push(hdr, '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of tests) L.push(row(r.name + ' (mirror: with the candle)', r.mir));
  for (const p of plain) L.push(row(p.name, p));
  L.push('', '## Every H4 cell (reported, not judged)', '', hdr, '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of cells) L.push(row(r.name, r));
  L.push('', '## Per market, the two tests (after costs in brackets; * = cost ASSUMED)', '');
  for (const [nm, list] of Object.entries(o.perMarket)) {
    L.push(`### ${nm}`, '', '| Market | n 05-14 | before [after] | n 15-26 | before (t) [after] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
    for (const m of list) L.push(`| ${m.market}${m.assumed ? '*' : ''} | ${N(m.d.n)} | ${f3(m.d.mean)} [${f3(m.d.meanNet)}] | ${N(m.c.n)} | ${f3(m.c.mean)} (${f2(m.c.t)}) [${f3(m.c.meanNet)}] | ${m.c.costR == null ? 'n/a' : m.c.costR.toFixed(3)} |`);
    L.push('');
  }
  L.push('## Checks', '');
  L.push(`- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((c) => c.market))].join(', ')}: ${N(o.cut.reduce((s, c) => s + c.n, 0))} big-candle signals known by the cut dates, ${o.cut.reduce((s, c) => s + c.missing + c.extra, 0)} missing or extra when the candles are cut there.`);
  L.push('- Every trade has its stop on the losing side of the fill (the run throws otherwise); a risk under the round-trip cost is no trade; the ATR that sizes a candle is taken on the 14 candles before it; the fill is the next 5-minute open; time limit 8 days.');
  L.push('- Exclusions: the data-quality audit\'s bad intervals.', '');
  L.push('## What it means', '');
  L.push(o.verdict === 'PASS' ? 'A test cleared the after-cost bar on these years; a forward record or any live change needs the owner. Never call it an edge on this alone.'
    : 'The big-candle fade does not survive costs on H4 either. A before-cost tilt is not an edge. Nothing is adopted; do not re-test variants on these years.', '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, m, dir] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify(runMarket(m))); console.log('done', m); }
  else if (cmd === 'cut') { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'cut-' + m + '.json'), JSON.stringify(cutTest(m))); console.log('cut', m); }
  else if (cmd === 'report') { const o = report(m); console.log(o.verdict, o.headline); }
  else console.log('usage: market <m> <dir> | cut <m> <dir> | report <dir>');
}

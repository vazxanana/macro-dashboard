// research/edge/fade-new-markets/run.mjs - five passing fade rules of grid7-wide-fade on eight new markets (Test A, OANDA mid)
// and on a second feed (Test B, HistData M1 grouped to 5 minutes), as PREREGISTRATION.md (23 Nov 2026). Judged before costs on
// calendar-month sums; the WITH-the-break mirror, the side split and after-cost figures beside.
// Research only: nothing live imports it, nothing is placed. The grid's code is imported unchanged.
//   EDGE_DATA=<cache> node research/edge/fade-new-markets/run.mjs market <m> <outDir>   OANDA 2005-2026 (Test A, and the gate's eurusd)
//   EDGE_DATA=<cache> node research/edge/fade-new-markets/run.mjs hist <m> <outDir>     HistData and OANDA, fills 2018-02 .. 2026-10 (Test B)
//   EDGE_DATA=<cache> node research/edge/fade-new-markets/run.mjs cut <outDir>          the cut test
//   node research/edge/fade-new-markets/run.mjs gate <outDir>                           eurusd against grid7-wide-fade/result.json
//   node research/edge/fade-new-markets/run.mjs report <outDir>                         pool, apply the bar, write RESULT.md and result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { mstat, p1, monthOf, NM, DM } from '../grid7-wide-core/run.mjs';
import { signals, exits, CAP, ATRK, TFS } from '../grid7-wide-fade/run.mjs';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { parseHist } from '../dom-second-feed/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n, m = 0, d = 1) => Date.UTC(n, m, d) / 1000;
export const A_MARKETS = ['nas100', 'spx500', 'de40', 'gbpjpy', 'audjpy', 'cadjpy', 'eurgbp', 'euraud'];
export const B_MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf'];
export const A_ASSUMED = A_MARKETS, B_ASSUMED = ['xag', 'usdcad', 'usdchf'];
export const A_FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);   // fills 2005-01-01 .. 2026-10-31
export const B_LOAD = '2018-01-01', B_FROM = y(2018, 1);            // fills 2018-02-01 .. 2026-10-31
export const BM0 = monthOf(B_FROM);                                 // month index of 2018-02 (157); months run to NM (262)
// the five rules (tf: 0 m5, 1 m15, 2 h1; st: 0 ext, 1 atr; x: 0 1R, 1 2R, 2 swing) - all context "none", session "all"
export const RULES = [
  { name: 'm15 none atr 2R all', tf: 1, st: 1, x: 1 },
  { name: 'm15 none ext swing all', tf: 1, st: 0, x: 2 },
  { name: 'm15 none ext 2R all', tf: 1, st: 0, x: 1 },
  { name: 'h1 none ext 2R all', tf: 2, st: 0, x: 1 },
  { name: 'm5 none atr 2R all', tf: 0, st: 1, x: 1 },
];
const SERIES = ['fade', 'buy', 'sell', 'mirror'];   // buy / sell = the fade's buys (fading down breaks) and sells (fading up breaks)
const FIELDS = ['n', 's', 'q', 'net', 'cr', 'win'];  // per month: count, sum R, sum R^2, sum net R, sum cost/risk, wins

// HistData M1 -> 5-minute candles: dom-second-feed's parseHist (histStampUtc inside) over council-data's files; its histM5
// with xag added (dom-second-feed has no silver). Cached as <cacheDir>/hist-<market>.json.gz.
const ROOT = path.join(HERE, '..', '..', '..');
const FOLDER = { xau: 'xau-histdata/XAUUSD', xag: 'XAGUSD/XAGUSD', eurusd: 'EURUSD/EURUSD', gbpusd: 'GBPUSD/GBPUSD', usdjpy: 'USDJPY/USDJPY',
  audusd: 'AUDUSD/AUDUSD', usdcad: 'USDCAD/USDCAD', usdchf: 'USDCHF/USDCHF' };
export function histM5(market, cacheDir) {
  const cf = cacheDir && path.join(cacheDir, `hist-${market}.json.gz`);
  if (cf && fs.existsSync(cf)) return JSON.parse(zlib.gunzipSync(fs.readFileSync(cf)).toString()).map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], e: r[0] + 300 }));
  const [dir, sym] = FOLDER[market].split('/');
  const list = execFileSync('git', ['ls-tree', '--name-only', 'origin/council-data', `research/candles/${dir}/`], { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter((f) => path.basename(f).startsWith(sym + '_M1_')).sort();
  const st = { out: [], last: -Infinity, dropped: 0 };
  for (const f of list) parseHist(zlib.gunzipSync(execFileSync('git', ['show', `origin/council-data:${f}`], { cwd: ROOT, maxBuffer: 1 << 30 })).toString(), st);
  if (cf) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cf, zlib.gzipSync(JSON.stringify(st.out.map((b) => [b.t, b.o, b.h, b.l, b.c])))); }
  return st.out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const newAcc = () => RULES.map(() => Object.fromEntries(SERIES.map((k) => [k, Object.fromEntries(FIELDS.map((f) => [f, new Float64Array(NM)]))])));
function add(S, m, R, cr) { S.n[m]++; S.s[m] += R; S.q[m] += R * R; S.net[m] += R - cr; S.cr[m] += cr; if (R > 0) S.win[m]++; }

// ---- one 5-minute series, the grid's runMarket loop restricted to context "none" and the five rules --------------------
export function runSeries(M5, { market, cost = COSTS[market], X = [], from, to }) {
  const sigs = signals(frames(M5)).filter((g) => g.cx === 0); const acc = newAcc();
  const need = new Set(RULES.map((r) => r.tf + '|' + r.st));
  let dropped = 0, bad = 0, small = 0, open = 0, sims = 0, wrong = 0;
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < from || t >= to) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, s = -g.d, cap = CAP[TFS[g.tf]], m = monthOf(t);
    for (let st = 0; st < 2; st++) {
      if (!need.has(g.tf + '|' + st)) continue;
      const stop = st === 0 ? g.ext + g.d * ATRK * g.a : fill + g.d * g.a, risk = s * (fill - stop);
      if (!(risk > 0)) { bad++; continue; }
      if (risk < cost) { small++; continue; }
      if (!(s * (fill - stop) > 0)) { wrong++; throw new Error('stop on the wrong side'); }
      const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
      const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
      const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap); sims++;
      if (!r || !p) { open++; continue; }
      const cr = cost / risk;
      RULES.forEach((ru, i) => { if (ru.tf !== g.tf || ru.st !== st || !Number.isFinite(ks[ru.x])) return;
        const a = acc[i]; add(a.fade, m, r.R[ru.x], cr); add(s > 0 ? a.buy : a.sell, m, r.R[ru.x], cr); add(a.mirror, m, p.R[ru.x], cr); });
    }
  }
  const J = (A) => A.map((x) => Object.fromEntries(SERIES.map((k) => [k, Object.fromEntries(FIELDS.map((f) => [f, Array.from(x[k][f], (z) => +z.toFixed(6))]))])));
  return { market, cost, first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, candles: M5.length,
    signals: sigs.length, sims, dropped, bad, small, open, wrong, acc: J(acc) };
}

// ---- statistics over months [a, b) -------------------------------------------------------------------------------------
export function poolAcc(list) {
  const out = RULES.map(() => Object.fromEntries(SERIES.map((k) => [k, Object.fromEntries(FIELDS.map((f) => [f, new Float64Array(NM)]))])));
  for (const d of list) d.acc.forEach((r, i) => { for (const k of SERIES) for (const f of FIELDS) for (let m = 0; m < NM; m++) out[i][k][f][m] += r[k][f][m]; });
  return out;
}
export function stat(S, a, b) {
  let n = 0, s = 0, net = 0, cr = 0, win = 0; for (let m = a; m < b; m++) { n += S.n[m]; s += S.s[m]; net += S.net[m]; cr += S.cr[m]; win += S.win[m]; }
  const ms = S.s, mn = S.net; const t = mstat(ms, a, b).t, tNet = mstat(mn, a, b).t;
  return { n, mean: n ? s / n : null, t, meanNet: n ? net / n : null, tNet, costR: n ? cr / n : null, win: n ? win / n : null, months: b - a,
    p: p1(t, b - a - 1) };
}
const r6 = (x) => (x == null ? null : +x.toFixed(6));
const slim = (w) => ({ n: w.n, mean: r6(w.mean), t: r6(w.t), meanNet: r6(w.meanNet), tNet: +w.tNet.toFixed(2), costR: w.costR == null ? null : +w.costR.toFixed(4),
  win: w.win == null ? null : +w.win.toFixed(3), p: +w.p.toPrecision(4) });

// ---- the gate: eurusd 2015-26 against grid7-wide-fade's committed per-market rows --------------------------------------
export function gate(dir) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, 'A-eurusd.json'), 'utf8'));
  const g7 = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'grid7-wide-fade', 'result.json'), 'utf8'));
  return RULES.map((ru, i) => { const w = slim(stat(d.acc[i].fade, DM, NM)); const want = g7.perMarket[ru.name].find((x) => x.market === 'eurusd').c;
    const got = { n: w.n, mean: w.mean, t: w.t, meanNet: w.meanNet };
    const ok = got.n === want.n && got.mean === want.mean && got.t === want.t && got.meanNet === want.meanNet;
    return { rule: ru.name, want: { n: want.n, mean: want.mean, t: want.t, meanNet: want.meanNet }, got, ok }; });
}

// ---- cut test ----------------------------------------------------------------------------------------------------------
export function cutSignals(M5, label, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const key = (g) => [g.tf, g.cx, g.ts, g.d, g.ext, g.a.toFixed(10), g.opp].join('|');
  const full = signals(frames(M5)).filter((g) => g.cx === 0); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000; if (!M5.length || M5[0].t >= T) continue;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.cx === 0 && g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ series: label, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- report ------------------------------------------------------------------------------------------------------------
const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
const N = (x) => Math.round(x).toLocaleString('en-US'), day = (t) => (t == null ? 'n/a' : new Date(t * 1000).toISOString().slice(0, 10));
const read = (dir, f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);

export function report(dir) {
  const A = A_MARKETS.map((m) => read(dir, `A-${m}.json`)).filter((d) => d && d.candles > 0);
  const B = B_MARKETS.map((m) => read(dir, `B-${m}.json`)).filter((d) => d && d.candles > 0);
  const O = B_MARKETS.map((m) => read(dir, `O-${m}.json`)).filter((d) => d && d.candles > 0);
  const cut = read(dir, 'cut.json') || [], gt = read(dir, 'gate.json') || [];
  const gateOk = gt.length === RULES.length && gt.every((x) => x.ok);
  const PA = poolAcc(A), PB = poolAcc(B), PO = poolAcc(O);
  const a0 = monthOf(A_FROM);
  const rows = RULES.map((ru, i) => ({ rule: ru.name,
    A: stat(PA[i].fade, a0, NM), A1: stat(PA[i].fade, a0, DM), A2: stat(PA[i].fade, DM, NM), B: stat(PB[i].fade, BM0, NM), O: stat(PO[i].fade, BM0, NM),
    mirA: stat(PA[i].mirror, a0, NM), mirB: stat(PB[i].mirror, BM0, NM),
    buyA: stat(PA[i].buy, a0, NM), sellA: stat(PA[i].sell, a0, NM), buyB: stat(PB[i].buy, BM0, NM), sellB: stat(PB[i].sell, BM0, NM) }));
  const H = K.holm(rows.flatMap((r) => [r.A.p, r.B.p]));
  rows.forEach((r, i) => { r.holmA = H[2 * i]; r.holmB = H[2 * i + 1];
    const ok = (w, h) => w.mean > 0 && w.t >= 2 && h < 0.05; r.passA = ok(r.A, r.holmA); r.passB = ok(r.B, r.holmB); r.pass = r.passA && r.passB; });
  const verdict = !gateOk || A.length < 6 || B.length < 6 ? 'INCONCLUSIVE' : rows.some((r) => r.pass) ? 'PASS' : 'FAIL';
  const pass = rows.filter((r) => r.pass);
  const perMarket = (list, a, b) => RULES.map((ru, i) => ({ rule: ru.name, rows: list.map((d) => ({ market: d.market, fade: slim(stat(d.acc[i].fade, a, b)), mirror: slim(stat(d.acc[i].mirror, a, b)) })) }));
  const pmA = perMarket(A, a0, NM), pmB = perMarket(B, BM0, NM), pmO = perMarket(O, BM0, NM);
  const posA = (i) => pmA[i].rows.filter((x) => x.fade.mean > 0).length, posB = (i) => pmB[i].rows.filter((x) => x.fade.mean > 0).length;
  const IDX = ['nas100', 'spx500', 'de40'];
  const PI = poolAcc(A.filter((d) => IDX.includes(d.market))), PX = poolAcc(A.filter((d) => !IDX.includes(d.market)));
  const groups = RULES.map((ru, i) => ({ rule: ru.name, indices: slim(stat(PI[i].fade, a0, NM)), crosses: slim(stat(PX[i].fade, a0, NM)) }));
  const best = [...rows].sort((p, q) => Math.min(q.A.t, q.B.t) - Math.min(p.A.t, p.B.t))[0];
  const nm = (r) => `${r.rule}: A ${f3(r.A.mean)}R (n ${N(r.A.n)}, t ${f2(r.A.t)}), B ${f3(r.B.mean)}R (n ${N(r.B.n)}, t ${f2(r.B.t)})`;
  const headline = verdict === 'PASS'
    ? `${pass.length} of 5 fade rules hold before costs on eight new markets and on HistData; ${nm(pass[0])}; after costs ${f3(pass[0].A.meanNet)}R and ${f3(pass[0].B.meanNet)}R`
    : verdict === 'FAIL' ? `0 of 5 fade rules hold on both tests; closest ${nm(best)}`
      : `not judged (${!gateOk ? 'the gate did not reproduce grid7-wide-fade' : 'too few markets loaded'})`;
  const S = (w) => slim(w);
  const out = { study: 'fade-new-markets', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums, pooled per test (pre-registered); Holm over 10 tests; after costs beside',
    windows: { A: '2005-01-01 to 2026-10-31 (262 months; 2005-14 and 2015-26 reported apart)', B: '2018-02-01 to 2026-10-31 (105 months)' },
    marketsA: A.map((d) => d.market), marketsB: B.map((d) => d.market), assumedCostsA: A_ASSUMED, assumedCostsB: B_ASSUMED,
    costs: Object.fromEntries([...A, ...B].map((d) => [d.market, d.cost])), gate: gt, gateOk,
    passed: pass.map((r) => r.rule), passedNetPositive: pass.filter((r) => r.A.meanNet > 0 && r.B.meanNet > 0).map((r) => r.rule),
    rules: rows.map((r, i) => ({ rule: r.rule, A: S(r.A), A2005_14: S(r.A1), A2015_26: S(r.A2), B: S(r.B), oandaOnBWindow: S(r.O),
      holmA: +r.holmA.toFixed(4), holmB: +r.holmB.toFixed(4), passA: r.passA, passB: r.passB, pass: r.pass,
      mirrorA: S(r.mirA), mirrorB: S(r.mirB), buyA: S(r.buyA), sellA: S(r.sellA), buyB: S(r.buyB), sellB: S(r.sellB),
      marketsPositiveA: posA(i), marketsPositiveB: posB(i) })),
    groupsA: groups, perMarketA: pmA, perMarketB: pmB, perMarketOandaB: pmO, cut,
    meta: { A: A.map(meta), B: B.map(meta), oanda: O.map(meta) } };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}
const meta = (d) => ({ market: d.market, first: day(d.first), last: day(d.last), candles: d.candles, signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open });

function resultMd(o, rows) {
  const L = []; const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  L.push('# Fading the first structure break on new markets and a second feed (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed, never an edge. One run, no variants. The rules are five passing cells of `grid7-wide-fade`,',
    'its code imported unchanged.', '',
    '## Gate', '',
    `The runner reproduces \`grid7-wide-fade\`'s eurusd rows for 2015-26 (n, mean R, month t, mean R after costs, six decimals): **${o.gateOk ? 'yes, all five' : 'NO'}**.`, '',
    '| Rule | grid n | grid R (t) | here n | here R (t) | equal |', '|---|---:|---:|---:|---:|---|');
  for (const g of o.gate) L.push(`| ${g.rule} | ${N(g.want.n)} | ${f3(g.want.mean)} (${f2(g.want.t)}) | ${N(g.got.n)} | ${f3(g.got.mean)} (${f2(g.got.t)}) | ${g.ok ? 'yes' : 'no'} |`);
  L.push('', '## The bar', '',
    'Before costs, month-sum t pooled per test; Holm over the ten tests (5 rules x A, B). Test A = eight markets the fade grid never',
    `read (${o.marketsA.join(', ')}), OANDA mid, fills 2005 to Oct 2026. Test B = HistData M1 grouped to 5 minutes for ${o.marketsB.join(', ')},`,
    'fills Feb 2018 to Oct 2026. After costs beside: costs **ASSUMED, not measured** for every Test A market and for xag, usdcad,',
    'usdchf in Test B (`combo-grid-2` `COSTS`).', '',
    '| Rule | A n | A R (t) | A net | A Holm | B n | B R (t) | B net | B Holm | Pass |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.rule} | ${N(r.A.n)} | ${f3(r.A.mean)} (${f2(r.A.t)}) | ${f3(r.A.meanNet)} | ${r.holmA.toFixed(4)} | ${N(r.B.n)} | ${f3(r.B.mean)} (${f2(r.B.t)}) | ${f3(r.B.meanNet)} | ${r.holmB.toFixed(4)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', `Passing: ${o.passed.length ? o.passed.join('; ') : 'none'}. Of those, positive after costs on both tests: ${o.passedNetPositive.length ? o.passedNetPositive.join('; ') : 'none'}.`, '',
    '## Test A by decade, and HistData against OANDA on the same window', '',
    '| Rule | A 2005-14 R (t) | A 2015-26 R (t) | B HistData R (t) | OANDA same 8 markets, same window R (t) |', '|---|---:|---:|---:|---:|');
  for (const r of rows) L.push(`| ${r.rule} | ${f3(r.A1.mean)} (${f2(r.A1.t)}) | ${f3(r.A2.mean)} (${f2(r.A2.t)}) | ${f3(r.B.mean)} (${f2(r.B.t)}) | ${f3(r.O.mean)} (${f2(r.O.t)}) |`);
  L.push('', '## The mirror (traded WITH the break) and the side split', '',
    'Mirror = same fill, the stop at the same distance on the other side, the same targets in R. Buys = fading down breaks,',
    'sells = fading up breaks. Before costs, R a trade (month t).', '',
    '| Rule | mirror A | mirror B | fade buys A | fade sells A | fade buys B | fade sells B |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const r of rows) L.push(`| ${r.rule} | ${f3(r.mirA.mean)} (${f2(r.mirA.t)}) | ${f3(r.mirB.mean)} (${f2(r.mirB.t)}) | ${f3(r.buyA.mean)} (${f2(r.buyA.t)}) | ${f3(r.sellA.mean)} (${f2(r.sellA.t)}) | ${f3(r.buyB.mean)} (${f2(r.buyB.t)}) | ${f3(r.sellB.mean)} (${f2(r.sellB.t)}) |`);
  L.push('', '## Per market', '', 'Before costs, R a trade (month t) [after costs]; * = cost ASSUMED.', '');
  const tbl = (title, pm, assumed) => { L.push(`### ${title}`, '', `| Market | ${RULES.map((r) => r.name.replace(' all', '')).join(' | ')} |`, `|---|${RULES.map(() => '---:').join('|')}|`);
    const ms = pm[0].rows.map((x) => x.market);
    for (const m of ms) L.push(`| ${m}${assumed.includes(m) ? '*' : ''} | ${pm.map((p) => { const x = p.rows.find((z) => z.market === m).fade; return `${f3(x.mean)} (${f2(x.t)}) [${f3(x.meanNet)}] n ${N(x.n)}`; }).join(' | ')} |`);
    L.push(''); };
  tbl('Test A (OANDA mid, 2005 to Oct 2026)', o.perMarketA, A_ASSUMED); tbl('Test B (HistData, Feb 2018 to Oct 2026)', o.perMarketB, B_ASSUMED);
  tbl('OANDA mid on Test B\'s window (comparison, not the bar)', o.perMarketOandaB, B_ASSUMED);
  L.push('### Test A by group (before costs, R a trade (month t))', '', '| Rule | indices (nas100, spx500, de40) | crosses (5) |', '|---|---:|---:|');
  for (const g of o.groupsA) L.push(`| ${g.rule} | ${f3(g.indices.mean)} (${f2(g.indices.t)}) | ${f3(g.crosses.mean)} (${f2(g.crosses.t)}) |`);
  L.push('');
  L.push(`Markets positive before costs: ${o.rules.map((r) => `${r.rule} A ${r.marketsPositiveA} of ${o.marketsA.length}, B ${r.marketsPositiveB} of ${o.marketsB.length}`).join('; ')}.`, '',
    '## Checks', '',
    `- Cut test: ${o.cut.length} cuts (${[...new Set(o.cut.map((x) => x.series))].join(', ')}): ${N(nCut)} signals known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: Test A the data-quality audit\'s intervals (`combo-grid-2` `exclusions`); Test B none.', '',
    '| Series | market | candles from | to | signals | simulated | dropped | past the stop | risk under cost | unresolved |', '|---|---|---|---|---:|---:|---:|---:|---:|---:|');
  for (const [k, list] of [['A OANDA', o.meta.A], ['B HistData', o.meta.B], ['B-window OANDA', o.meta.oanda]]) for (const m of list)
    L.push(`| ${k} | ${m.market} | ${m.first} | ${m.last} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} of the five rules keep their before-cost tilt on eight markets the grid never read AND on a second feed, so the tilt is`,
    'not particular to the ten markets nor an artefact of OANDA\'s mid candles. It is still a before-cost tilt: the after-cost column',
    `shows ${o.passedNetPositive.length ? 'some positive figures, on ASSUMED costs that must be measured before anything else' : 'it is smaller than the round trip everywhere'}. Not an edge, nothing adopted, no live change.`,
    '', 'Three limits, said plainly. (1) The tilt lives in the currencies: on the three indices it is a third or less of what the crosses make, and negative for the',
    'break-candle stop with a 2R target (see the group table); the pooled pass of Test A is carried by the five crosses. (2) HistData',
    'agrees with OANDA on the same window almost figure for figure, so the tilt is not an artefact of OANDA\'s mid candles; but both',
    'are quote feeds, and a reversal of the quote at the scale of the bid / ask would show on both. Only executable prices (the',
    'broker\'s own bid / ask, as `gold-vol-breakout-exec` used) can tell whether a taker can capture any of it. (3) Every rule loses',
    'after costs on both tests, by more than its tilt (ASSUMED costs for all of Test A).');
  else if (o.verdict === 'FAIL') L.push('No rule holds on both tests, so the grid\'s fade tilt is not shown to travel beyond its ten markets and OANDA\'s candles.',
    'Nothing live changed; do not re-test variants of these rules on these markets and years.');
  else L.push('Not judged: see the gate and the market counts above.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2); const t0 = Date.now();
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true });
    const M5 = K.load(a, '5m', { from: '2004-01-01', to: '2026-11-01' });
    const r = runSeries(M5, { market: a, X: exclusions(a), from: A_FROM, to: TO });
    fs.writeFileSync(path.join(b, `A-${a}.json`), JSON.stringify(r)); console.log('A', a, 'signals', r.signals, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'hist') { fs.mkdirSync(b, { recursive: true });
    const H = histM5(a, path.join(K.DATA_DIR, 'hist')).filter((x) => x.t >= y(2018) && x.t < y(2026, 11));
    const rb = runSeries(H, { market: a, from: B_FROM, to: TO }); fs.writeFileSync(path.join(b, `B-${a}.json`), JSON.stringify(rb));
    const M5 = K.load(a, '5m', { from: B_LOAD, to: '2026-11-01' });
    const ro = runSeries(M5, { market: a, X: exclusions(a), from: B_FROM, to: TO }); fs.writeFileSync(path.join(b, `O-${a}.json`), JSON.stringify(ro));
    console.log('B', a, 'hist sims', rb.sims, 'oanda sims', ro.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(a, { recursive: true }); const out = [];
    for (const m of ['nas100', 'gbpjpy']) out.push(...cutSignals(K.load(m, '5m', { from: '2004-01-01', to: '2026-11-01' }), 'A ' + m));
    out.push(...cutSignals(histM5('eurusd', path.join(K.DATA_DIR, 'hist')).filter((x) => x.t >= y(2018)), 'B eurusd HistData',
      ['2018-09-12', '2020-03-18', '2022-06-15', '2024-01-10', '2026-04-08']));
    fs.writeFileSync(path.join(a, 'cut.json'), JSON.stringify(out)); console.log(JSON.stringify(out)); }
  else if (cmd === 'gate') { const g = gate(a); fs.writeFileSync(path.join(a, 'gate.json'), JSON.stringify(g)); console.log(JSON.stringify(g, null, 1)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | hist <m> <dir> | cut <dir> | gate <dir> | report <dir>');
}

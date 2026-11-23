// research/edge/box-touch-trend/run.mjs - the pre-registered box-edge touch with the H1 trend (PREREGISTRATION.md, 23 Nov 2026).
// Research only: nothing live reads it. Candles from the overnight toolkit's cache (research/edge/_lib/edgekit.mjs).
//   node research/edge/box-touch-trend/run.mjs          runs T1 / T2 / T3, writes result.json, trades.json, RESULT.md
// The rule, as pre-registered (no other setting is tried):
//   box = edgekit.boxesHL(bars, 3) on M15 (T1, T3) or M5 (T2), known at the close of candle s, cancelled at its end close (bt);
//   side = edgekit.structure(H1, 3).side of the last H1 candle closed at the moment (placement and fill); 0 = no trade;
//   up: buy limit at the box low; down: sell limit at the box high; only if the last close is inside the box;
//   order life = min(box end close, placement + 24 h); stop 0.20 x box height beyond the edge; target the opposite edge;
//   time exit 24 h after the fill; no order when the stop distance is under 4 x the round-trip cost;
//   fills / exits by edgekit.simulate on 5m; one open position at a time per market and test, in order of fill time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { swing: 3, stopFrac: 0.20, life: 24 * 3600, hold: 24 * 3600, minStopCosts: 4 };
const D = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;
export const W = {
  rep: [D('2010-01-01'), D('2020-01-01')],
  is: [D('2020-01-01'), D('2024-01-01')],
  oos: [D('2024-01-01'), D('2026-11-14')], // entries through 13 Nov 2026; the week the rule was shaped is left out
};
export const TESTS = [
  { id: 'T1', name: 'M15 boxes, five markets pooled', tf: 900, markets: K.MARKETS },
  { id: 'T2', name: 'M5 boxes, five markets pooled', tf: 300, markets: K.MARKETS },
  { id: 'T3', name: 'M15 boxes, gold alone', tf: 900, markets: ['xau'] },
];

// All trades of one market on one box timeframe. bars5 = 5m candles; cost = round trip in price units.
export function runMarket(bars5, market, { tf = 900, cost = K.COSTS[market], swing = P.swing } = {}) {
  const B = tf === 300 ? bars5 : K.resample(bars5, tf);
  const H1 = K.resample(bars5, 3600);
  const side = K.structure(H1, swing).side;
  const sideAt = (t) => { const n = K.closedCount(H1, t); return n ? side[n - 1] : 0; };
  const boxes = K.boxesHL(B, swing);
  const cand = [];
  for (const bx of boxes) {
    const t = B[bx.s].e, c = B[bx.s].c;
    const h = bx.hi - bx.lo;
    if (!(h > 0) || c < bx.lo || c > bx.hi) continue;
    const s = sideAt(t);
    if (!s) continue;
    const dist = P.stopFrac * h;
    if (dist < P.minStopCosts * cost) continue;
    const entry = s > 0 ? bx.lo : bx.hi, stop = entry - s * dist, target = s > 0 ? bx.hi : bx.lo;
    const expire = Math.min(bx.bt ?? Infinity, t + P.life);
    const r = K.simulate({ side: s, entry, stop, target, t, type: 'limit', expire, maxHold: P.hold }, bars5, { cost });
    if (r.status === 'nofill' || r.status === 'bad' || r.status === 'open') continue;
    if (sideAt(r.fillT) !== s) continue; // the H1 side turned before the fill: not taken
    cand.push({ market, side: s, placed: t, entryT: r.fillT, entry, fill: r.fill, stop, target, exitT: r.exitT, exit: r.exit,
      reason: r.reason, risk: r.risk, R: r.R, Rnet: r.Rnet, Rnet2: r.R - (2 * cost) / r.risk, boxH: h, mfe: r.mfe });
  }
  cand.sort((a, b) => a.entryT - b.entryT || a.placed - b.placed);
  const out = []; let freeAt = -Infinity;
  for (const x of cand) if (x.entryT >= freeAt) { out.push(x); freeAt = x.exitT; }
  return out;
}

const inW = (x, w) => x.entryT >= w[0] && x.entryT < w[1];
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
function summ(trades, key) {
  const s = K.stats(trades, { key, time: 'exitT' });
  return { n: s.n, wins: s.wins, meanR: r4(s.meanR), total: r4(s.total), tTrade: r4(s.tTrade), months: s.months, tMonth: r4(s.tMonth),
    pMonth: r4(s.pMonth), maxDD: r4(s.maxDD) };
}
export function block(trades) {
  const o = {};
  for (const [k, w] of Object.entries(W)) {
    const xs = trades.filter((x) => inW(x, w));
    o[k] = { net: summ(xs, 'Rnet'), net2x: summ(xs, 'Rnet2'), gross: summ(xs, 'R') };
  }
  return o;
}
export function verdictOf(b, holmP) {
  const o = b.oos, i = b.is, r = b.rep;
  const fail = !(o.net.meanR > 0) || !(i.net.meanR > 0) || !(o.net2x.meanR > 0) || !(r.net.meanR > 0);
  if (fail) return 'FAIL';
  const pass = o.net.tMonth >= 2 && holmP < 0.05 && o.net.n >= 30 && r.net.tMonth >= 2;
  return pass ? 'PASS' : 'INCONCLUSIVE';
}

function detail(trades) {
  const all = trades.filter((x) => x.entryT >= W.rep[0] && x.entryT < W.oos[1]);
  const byMarket = {}, bySide = {}, byReason = {}, byYear = {};
  for (const m of new Set(all.map((x) => x.market))) byMarket[m] = block(all.filter((x) => x.market === m));
  for (const s of [1, -1]) bySide[s > 0 ? 'buy' : 'sell'] = block(all.filter((x) => x.side === s));
  for (const x of all) { const g = (byReason[x.reason] ||= { n: 0, R: 0, Rnet: 0 }); g.n++; g.R += x.R; g.Rnet += x.Rnet; }
  for (const g of Object.values(byReason)) { g.meanR = r4(g.R / g.n); g.meanRnet = r4(g.Rnet / g.n); g.R = r4(g.R); g.Rnet = r4(g.Rnet); }
  for (const x of all) { const y = new Date(x.entryT * 1000).getUTCFullYear(); const g = (byYear[y] ||= { n: 0, Rnet: 0, R: 0 }); g.n++; g.Rnet += x.Rnet; g.R += x.R; }
  for (const g of Object.values(byYear)) { g.meanRnet = r4(g.Rnet / g.n); g.Rnet = r4(g.Rnet); g.R = r4(g.R); }
  const med = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
  return { byMarket, bySide, byReason, byYear, medianStopCostR: r4(med(all.map((x) => x.Rnet - x.R).map((v) => -v))) };
}

const f = (v, d = 3) => (v == null ? '-' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const ft = (v) => (v == null ? '-' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
export function report(res) {
  const L = [];
  L.push('# Box-edge touch with the H1 trend: result (23 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** ${res.headline}`, '');
  L.push('Pre-registered in PREREGISTRATION.md (committed before any trade was computed); run by `run.mjs` on the toolkit\'s OANDA mid 5m',
    'cache. R after the toolkit\'s round-trip costs unless said; t on calendar-month sums (by exit month); windows by entry time.', '');
  L.push('| Test | Window | n | R a trade after costs | month t | at 2x costs | before costs | Holm p (OOS) | verdict |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) for (const k of ['rep', 'is', 'oos']) {
    const b = t.windows[k];
    L.push(`| ${t.id} ${t.name} | ${{ rep: '2010-2019', is: '2020-2023 (IS)', oos: '2024 - 13 Nov 2026 (OOS)' }[k]} | ${b.net.n} | ${f(b.net.meanR)} | ${ft(b.net.tMonth)} | ${f(b.net2x.meanR)} | ${f(b.gross.meanR)} | ${k === 'oos' ? ft(t.holmP) : ''} | ${k === 'oos' ? t.verdict : ''} |`);
  }
  L.push('', '## Per market, M15 (T1), R a trade after costs (n)', '', '| Market | 2010-2019 | 2020-2023 | 2024-2026 | before costs 2024-2026 |', '|---|---|---|---|---|');
  for (const [m, b] of Object.entries(res.tests[0].detail.byMarket))
    L.push(`| ${m} | ${f(b.rep.net.meanR)} (${b.rep.net.n}) | ${f(b.is.net.meanR)} (${b.is.net.n}) | ${f(b.oos.net.meanR)} (${b.oos.net.n}) | ${f(b.oos.gross.meanR)} |`);
  L.push('', '## In plain words', '');
  L.push(...res.plain.map((s) => '- ' + s));
  L.push('', '## What it does NOT show', '');
  L.push('- It does not test the owner\'s own reading of a box on a chart: it tests one mechanical reading (3-candle swings, the toolkit\'s chaining).',
    '- It does not test other stop distances, targets, swing sizes, timeframes or filters; none was tried after the result (pre-registered).',
    '- Costs are today\'s demo figures charged on every year; slippage on the stop is not modelled beyond a gap at the open.',
    '- A FAIL here is about this rule on these five markets; it does not judge the owner\'s discretionary trades.',
    '- trades.json holds the T1 trades (T3 = its gold rows); the T2 (M5) trades are left out to keep it under 3 MB, their numbers are in result.json.', '');
  L.push('Nothing live changed. Files: result.json (every number), trades.json (every trade), tests/box-touch-trend.test.mjs.');
  return L.join('\n') + '\n';
}

export function main() {
  const per = {}; // per[tf][market] = trades
  for (const tf of [900, 300]) per[tf] = {};
  for (const m of K.MARKETS) {
    const bars5 = K.load(m, '5m', { from: '2010-01-01', to: '2026-11-23' });
    for (const tf of [900, 300]) { per[tf][m] = runMarket(bars5, m, { tf }); console.error(m, tf, per[tf][m].length); }
  }
  const tests = TESTS.map((T) => {
    const trades = T.markets.flatMap((m) => per[T.tf][m]).sort((a, b) => a.entryT - b.entryT);
    return { ...T, trades, windows: block(trades) };
  });
  const hp = K.holm(tests.map((t) => t.windows.oos.net.pMonth ?? 1));
  tests.forEach((t, i) => { t.holmP = r4(hp[i]); t.verdict = verdictOf(t.windows, hp[i]); t.detail = detail(t.trades); });
  const t1 = tests[0];
  const o = t1.windows.oos.net, rp = t1.windows.rep.net;
  const headline = `T1 (M15 boxes, five markets): ${f(o.meanR)}R a trade after costs out of sample (n ${o.n}, month t ${ft(o.tMonth)}), `
    + `${f(t1.windows.is.net.meanR)}R in sample (n ${t1.windows.is.net.n}), ${f(rp.meanR)}R on untouched 2010-2019 (n ${rp.n}, month t ${ft(rp.tMonth)}). `
    + `T2 (M5) ${tests[1].verdict}, T3 (gold) ${tests[2].verdict}.`;
  const g = (t, k) => t.windows[k];
  const plain = [
    `Before costs the rule is ${f(g(t1, 'oos').gross.meanR)}R a trade out of sample and ${f(g(t1, 'rep').gross.meanR)}R on 2010-2019 (M15); the costs take the rest.`,
    `On M5 the boxes are smaller, so costs weigh more: ${f(g(tests[1], 'oos').gross.meanR)}R before costs and ${f(g(tests[1], 'oos').net.meanR)}R after, out of sample (n ${g(tests[1], 'oos').net.n}).`,
    `Gold alone (the market the rule was shaped on): ${f(g(tests[2], 'oos').net.meanR)}R a trade after costs out of sample (n ${g(tests[2], 'oos').net.n}), ${f(g(tests[2], 'rep').net.meanR)}R on 2010-2019 (n ${g(tests[2], 'rep').net.n}).`,
    `Exits (T1, all windows): ` + Object.entries(t1.detail.byReason).map(([k, v]) => `${k} ${v.n} (${f(v.meanR, 2)}R before costs)`).join(', ') + '.',
    `Buys ${f(t1.detail.bySide.buy.oos.net.meanR)}R and sells ${f(t1.detail.bySide.sell.oos.net.meanR)}R a trade after costs out of sample (T1).`,
  ];
  const res = { study: 'box-touch-trend', built: '2026-11-23', verdict: t1.verdict, headline, params: P, windows: W,
    costs: K.COSTS, plain,
    tests: tests.map(({ trades, ...t }) => ({ ...t, markets: t.markets })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  // trades.json: compact rows, one header
  const cols = ['test', 'market', 'side', 'entryT', 'entry', 'stop', 'target', 'exitT', 'exit', 'reason', 'R', 'Rnet'];
  const rows = [];
  for (const t of tests) for (const x of t.trades) if (x.entryT >= W.rep[0] && x.entryT < W.oos[1])
    rows.push([t.id, x.market, x.side, x.entryT, +x.fill.toPrecision(7), +x.stop.toPrecision(7), +x.target.toPrecision(7), x.exitT,
      +x.exit.toPrecision(7), x.reason, +x.R.toFixed(3), +x.Rnet.toFixed(3)]);
  let tj = { cols, note: 'times unix s UTC; entry = the filled price (the limit, or a better open); R before costs, Rnet after 1x costs', rows };
  // T3 rows are exactly T1's gold rows: kept once (under T1)
  tj.rows = rows.filter((r) => r[0] !== 'T3'); tj.note += '; T3 (gold alone) = the T1 rows of market xau';
  const ser = (o) => JSON.stringify(o).replace(/\],\[/g, '],\n[') + '\n';
  let s = ser(tj);
  if (s.length > 3e6) { // keep under 3 MB: drop T2 rows that are not needed for the headline
    tj = { cols, note: tj.note + '; T2 (M5) rows left out to keep the file under 3 MB (its numbers are in result.json)', rows: tj.rows.filter((r) => r[0] !== 'T2') };
    s = ser(tj);
  }
  fs.writeFileSync(path.join(HERE, 'trades.json'), s);
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(headline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

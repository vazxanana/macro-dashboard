// research/edge/h4-pullback-end/run.mjs - the pre-registered end of an H1 pullback inside an H4 trend, taken only from the
// right half of the range (PREREGISTRATION.md, 23 Nov 2026). Research only: nothing live reads it. Candles from the overnight
// toolkit's cache (research/edge/_lib/edgekit.mjs).
//   node research/edge/h4-pullback-end/run.mjs      runs T1-T4, writes result.json, trades.json, RESULT.md
// The rule, as pre-registered (no other setting is tried):
//   H1, H4 = edgekit.resample of the 5m candles (UTC blocks); structure = edgekit.structure(bars, 3) on each.
//   s = H4 side after the last closed H4 candle. Leg = the last H4 break (in direction s). O = lowest low (buys) of the H4
//   candles from the broken swing to the break candle; X = highest H1 high from the H4 break's close to the pullback start.
//   Pullback start = the first H1 ChoCh against s closing after the H4 break's close while the H4 side is s (one per leg).
//   Entry = the next H1 break in direction s, market at its close. P = lowest low from the start to the entry candle.
//   Location: P <= M = (O + X) / 2 -> entry close <= M; else entry close <= (P + X) / 2 (sells mirror).
//   Void: H4 side flips, an H1 close beyond O, or 120 H1 candles without an entry.
//   Stop P - cost (buys), target X; skip when target < 1R or stop < 3 costs; out after 10 days; one position per market.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { swing: 3, voidH1: 120, minR: 1, minStopCosts: 3, hold: 864000 };
const D = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;
export const W = {
  rep: [D('2010-01-01'), D('2020-01-01')],
  is: [D('2020-01-01'), D('2024-01-01')],
  oos: [D('2024-01-01'), D('2100-01-01')], // to the end of the cache
};
const WNAME = { rep: '2010-2019 (replication)', is: '2020-2023 (IS)', oos: '2024 - end of cache (OOS)' };

// Candidates of one market: every pullback end the rule reads, with or without the location step (flag `loc`).
// bars5 = 5m candles; cost = round trip in price units. Returns simulated candidates (not yet one-at-a-time).
export function candidates(bars5, market, { cost = K.COSTS[market], swing = P.swing } = {}) {
  const H1 = K.resample(bars5, 3600), H4 = K.resample(bars5, 14400);
  const s1 = K.structure(H1, swing), s4 = K.structure(H4, swing);
  const side4At = (t) => { const n = K.closedCount(H4, t); return n ? s4.side[n - 1] : 0; };
  const lastBrk4 = (t) => { // the last H4 break closed by t
    let lo = 0, hi = s4.events.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s4.events[m].t <= t) lo = m + 1; else hi = m; }
    return lo ? s4.events[lo - 1] : null;
  };
  const ev1 = s1.events;
  const used = new Set(); // one pullback start per H4 break
  const out = [];
  for (let k = 0; k < ev1.length; k++) {
    const ch = ev1[k];
    if (ch.kind !== 'ChoCh') continue;
    const t0 = ch.t; // close of the ChoCh candle
    const s = side4At(t0);
    if (!s || ch.dir !== -s) continue;
    const brk = lastBrk4(t0);
    if (!brk || brk.dir !== s || !(t0 > brk.t) || used.has(brk.i)) continue;
    used.add(brk.i);
    // external origin O from the H4 candles of the broken swing to the break candle
    let O = s > 0 ? Infinity : -Infinity;
    for (let x = brk.from; x <= brk.i; x++) O = s > 0 ? Math.min(O, H4[x].l) : Math.max(O, H4[x].h);
    // external extreme X: H1 candles from the H4 break's close to the pullback start (the ChoCh candle included)
    let X = s > 0 ? -Infinity : Infinity;
    const a = K.closedCount(H1, brk.t); // first H1 candle starting at or after the break's close
    for (let x = a; x <= ch.i; x++) X = s > 0 ? Math.max(X, H1[x].h) : Math.min(X, H1[x].l);
    if (!Number.isFinite(X) || !(s * (X - O) > 0)) continue;
    // walk H1 from the ChoCh candle to the entry
    let Pp = s > 0 ? Infinity : -Infinity, entryI = -1, voidWhy = null;
    let q = k + 1;
    for (let j = ch.i; j <= ch.i + P.voidH1 && j < H1.length; j++) {
      const b = H1[j];
      Pp = s > 0 ? Math.min(Pp, b.l) : Math.max(Pp, b.h);
      if (side4At(b.e) !== s) { voidWhy = 'h4 flip'; break; }
      if (s * (b.c - O) < 0) { voidWhy = 'beyond origin'; break; }
      while (q < ev1.length && ev1[q].i < j) q++;
      if (j > ch.i && q < ev1.length && ev1[q].i === j && ev1[q].dir === s) { entryI = j; break; }
    }
    if (entryI < 0) continue;
    const E = H1[entryI], close = E.c, M = (O + X) / 2;
    const deep = s > 0 ? Pp <= M : Pp >= M;
    const line = deep ? M : (Pp + X) / 2;
    const loc = s > 0 ? close <= line : close >= line;
    const stop = Pp - s * cost, target = X;
    const risk0 = s * (close - stop);
    if (!(risk0 >= P.minStopCosts * cost)) continue;
    if (!(s * (target - close) >= P.minR * risk0)) continue;
    const r = K.simulate({ side: s, entry: close, stop, target, t: E.e, type: 'market', maxHold: P.hold }, bars5, { cost });
    if (r.status === 'bad' || r.status === 'open' || r.status === 'nofill') continue;
    out.push({ market, side: s, signalT: E.e, entryT: r.fillT, entry: r.fill, planned: close, stop, target, exitT: r.exitT,
      exit: r.exit, reason: r.reason, risk: r.risk, R: r.R, Rnet: r.Rnet, Rnet2: r.R - (2 * cost) / r.risk,
      loc, range: deep ? 'external' : 'internal', O, X, P: Pp, startT: t0, h4BreakT: brk.t, h4Kind: brk.kind });
  }
  return out;
}

export const oneAtATime = (cand) => {
  const xs = [...cand].sort((a, b) => a.entryT - b.entryT || a.signalT - b.signalT);
  const out = []; let freeAt = -Infinity;
  for (const x of xs) if (x.entryT >= freeAt) { out.push(x); freeAt = x.exitT; }
  return out;
};
// the rule as written (location step kept) and the rejected stream (one position at a time per stream)
export function runMarket(bars5, market, opts = {}) {
  const c = candidates(bars5, market, opts);
  return { kept: oneAtATime(c.filter((x) => x.loc)), rejected: oneAtATime(c.filter((x) => !x.loc)) };
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
export const oneSided = (t, p) => (t == null || p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2);
export function welch(a, b) {
  const m = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = (xs, mu) => xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1);
  if (a.length < 2 || b.length < 2) return { t: null, df: null, p: null };
  const ma = m(a), mb = m(b), va = v(a, ma) / a.length, vb = v(b, mb) / b.length;
  const t = (ma - mb) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { t, df, p: oneSided(t, K.pFromT(t, df)), diff: ma - mb, na: a.length, nb: b.length };
}
// every line of the pre-registered bar; `stat` = the test's own statistic line (month t, or Welch t for T4)
export function verdictOf(b, holmP, { statT = b.oos.net.tMonth } = {}) {
  const o = b.oos, lines = {
    oosMean: o.net.meanR > 0, oosT: statT >= 2, holm: holmP < 0.05, isMean: b.is.net.meanR > 0, oos2x: o.net2x.meanR > 0,
    n30: o.net.n >= 30, repMean: b.rep.net.meanR > 0,
  };
  return { lines, pass: Object.values(lines).every(Boolean) };
}
export function overall(t1) { // PASS / FAIL / INCONCLUSIVE from T1
  if (!(t1.windows.oos.net.n >= 30)) return 'INCONCLUSIVE';
  return t1.pass ? 'PASS' : 'FAIL';
}

function detail(trades) {
  const byMarket = {}, bySide = {}, byReason = {}, byYear = {}, byRange = {};
  for (const m of new Set(trades.map((x) => x.market))) byMarket[m] = block(trades.filter((x) => x.market === m));
  for (const s of [1, -1]) bySide[s > 0 ? 'buy' : 'sell'] = block(trades.filter((x) => x.side === s));
  for (const g of ['external', 'internal']) byRange[g] = block(trades.filter((x) => x.range === g));
  for (const x of trades) { const g = (byReason[x.reason] ||= { n: 0, R: 0, Rnet: 0 }); g.n++; g.R += x.R; g.Rnet += x.Rnet; }
  for (const g of Object.values(byReason)) { g.meanR = r4(g.R / g.n); g.meanRnet = r4(g.Rnet / g.n); g.R = r4(g.R); g.Rnet = r4(g.Rnet); }
  for (const x of trades) { const y = new Date(x.entryT * 1000).getUTCFullYear(); const g = (byYear[y] ||= { n: 0, Rnet: 0, R: 0 }); g.n++; g.Rnet += x.Rnet; g.R += x.R; }
  for (const g of Object.values(byYear)) { g.meanRnet = r4(g.Rnet / g.n); g.meanR = r4(g.R / g.n); g.Rnet = r4(g.Rnet); g.R = r4(g.R); }
  const med = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
  return { byMarket, bySide, byRange, byReason, byYear, medianTargetR: r4(med(trades.map((x) => Math.abs(x.target - x.entry) / x.risk))),
    medianCostR: r4(med(trades.map((x) => x.R - x.Rnet))) };
}

const f = (v, d = 3) => (v == null ? '-' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const ft = (v) => (v == null ? '-' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
export function report(res) {
  const L = [];
  L.push('# The end of an H1 pullback inside an H4 trend, from the right half of the range: result (23 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** ${res.headline}`, '');
  L.push('Pre-registered in PREREGISTRATION.md (committed before any trade was computed); run by `run.mjs` on the toolkit\'s OANDA mid 5m',
    'cache. R after the toolkit\'s round-trip costs unless said; t on calendar-month sums (by exit month); windows by entry time;',
    'p one-sided (mean > 0); Holm across T1-T4.', '');
  L.push('| Test | Window | n | R a trade after costs | month t | at 2x costs | before costs | Holm p (OOS) | passes |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) for (const k of ['rep', 'is', 'oos']) {
    const b = t.windows[k];
    L.push(`| ${t.id} ${t.name} | ${WNAME[k]} | ${b.net.n} | ${f(b.net.meanR)} | ${ft(b.net.tMonth)} | ${f(b.net2x.meanR)} | ${f(b.gross.meanR)} | ${k === 'oos' ? ft(t.holmP) : ''} | ${k === 'oos' ? (t.pass ? 'yes' : 'no') : ''} |`);
  }
  const t4 = res.tests[3];
  L.push('', `T4 (out of sample, location kept against rejected): kept ${f(t4.welch.meanKept)}R (n ${t4.welch.na}), rejected ${f(t4.welch.meanRejected)}R (n ${t4.welch.nb}), difference ${f(t4.welch.diff)}R, Welch t ${ft(t4.welch.t)}, one-sided p ${ft(t4.welch.p)}, Holm ${ft(t4.holmP)}. The T4 rows of the table are the rejected stream.`);
  L.push('', '## Per market (T1 rows), R a trade after costs (n)', '', '| Market | 2010-2019 | 2020-2023 | 2024 on | before costs 2024 on |', '|---|---|---|---|---|');
  for (const [m, b] of Object.entries(res.tests[0].detail.byMarket))
    L.push(`| ${m} | ${f(b.rep.net.meanR)} (${b.rep.net.n}) | ${f(b.is.net.meanR)} (${b.is.net.n}) | ${f(b.oos.net.meanR)} (${b.oos.net.n}) | ${f(b.oos.gross.meanR)} |`);
  L.push('', '## By year (T1), R a trade after costs (n)', '', Object.entries(res.tests[0].detail.byYear).map(([y, g]) => `${y} ${f(g.meanRnet)} (${g.n})`).join(' · '));
  L.push('', '## In plain words', '');
  L.push(...res.plain.map((s) => '- ' + s));
  L.push('', '## What it does NOT show', '');
  L.push('- It tests one mechanical reading of the market cycle (3-candle swings, the toolkit\'s structure), not the owner\'s own reading on a chart.',
    '- No other swing size, half, target, stop or timeframe was tried, before or after the result (pre-registered).',
    '- X is taken from the H1 candles after the H4 break\'s close, as written; a peak inside the break candle itself is not counted.',
    '- Costs are today\'s demo figures charged on every year; financing (gold buys pay it) is not charged; stop slippage beyond a gap is not modelled.',
    '- The 2x-costs line charges twice the cost on the same trades (the stop keeps its one-cost buffer).',
    '- A FAIL is about this rule on these five markets; it does not judge discretionary trades.', '');
  L.push('Nothing live changed. Files: result.json (every number), trades.json (every T1 and T4-rejected trade), tests/h4-pullback-end.test.mjs.');
  return L.join('\n') + '\n';
}

export function main() {
  const per = {};
  for (const m of K.MARKETS) {
    const bars5 = K.load(m, '5m', { from: '2010-01-01' });
    per[m] = runMarket(bars5, m);
    console.error(m, per[m].kept.length, per[m].rejected.length);
  }
  const pick = (ms, k) => ms.flatMap((m) => per[m][k]).filter((x) => x.entryT >= W.rep[0]).sort((a, b) => a.entryT - b.entryT);
  const fx = K.MARKETS.filter((m) => m !== 'xau');
  const tests = [
    { id: 'T1', name: 'five markets pooled', trades: pick(K.MARKETS, 'kept') },
    { id: 'T2', name: 'gold alone', trades: pick(['xau'], 'kept') },
    { id: 'T3', name: 'four forex pairs pooled', trades: pick(fx, 'kept') },
    { id: 'T4', name: 'rejected by the location step (comparison)', trades: pick(K.MARKETS, 'rejected') },
  ];
  for (const t of tests) t.windows = block(t.trades);
  const oosK = tests[0].trades.filter((x) => inW(x, W.oos)).map((x) => x.Rnet);
  const oosR = tests[3].trades.filter((x) => inW(x, W.oos)).map((x) => x.Rnet);
  const w = welch(oosK, oosR);
  const welchOut = { t: r4(w.t), df: r4(w.df), p: r4(w.p), diff: r4(w.diff), na: w.na, nb: w.nb,
    meanKept: r4(oosK.reduce((a, b) => a + b, 0) / oosK.length), meanRejected: r4(oosR.reduce((a, b) => a + b, 0) / oosR.length) };
  const praw = tests.slice(0, 3).map((t) => oneSided(t.windows.oos.net.tMonth, t.windows.oos.net.pMonth)).concat([w.p ?? 1]);
  const hp = K.holm(praw);
  tests.forEach((t, i) => {
    t.pRaw = r4(praw[i]); t.holmP = r4(hp[i]);
    // T4's bar is read on the kept stream with the Welch t as its statistic
    const v = i === 3 ? verdictOf(tests[0].windows, hp[i], { statT: w.t }) : verdictOf(t.windows, hp[i]);
    t.lines = v.lines; t.pass = v.pass; t.detail = detail(t.trades);
  });
  tests[3].welch = welchOut;
  const t1 = tests[0];
  const verdict = overall(t1);
  const o = t1.windows.oos.net, rp = t1.windows.rep.net, is = t1.windows.is.net;
  const failed = Object.entries(t1.lines).filter(([, v]) => !v).map(([k]) => k);
  const headline = `T1 (five markets): ${f(o.meanR)}R a trade after costs out of sample (n ${o.n}, month t ${ft(o.tMonth)}), `
    + `${f(is.meanR)}R in sample (n ${is.n}), ${f(rp.meanR)}R on 2010-2019 (n ${rp.n}, month t ${ft(rp.tMonth)}). `
    + (failed.length ? `Lines missed: ${failed.join(', ')}. ` : '')
    + `T2 (gold) ${tests[1].pass ? 'passes' : 'fails'}, T3 (forex) ${tests[2].pass ? 'passes' : 'fails'}, T4 (location picks better) ${tests[3].pass ? 'passes' : 'fails'}.`;
  const g = (t, k) => t.windows[k];
  const d1 = t1.detail;
  const plain = [
    `Before costs the rule is ${f(g(t1, 'oos').gross.meanR)}R a trade out of sample, ${f(g(t1, 'is').gross.meanR)}R in sample and ${f(g(t1, 'rep').gross.meanR)}R on 2010-2019; the median cost is ${f(d1.medianCostR)}R a trade, the median target ${f(d1.medianTargetR, 2)}R away.`,
    `Gold alone: ${f(g(tests[1], 'oos').net.meanR)}R a trade after costs out of sample (n ${g(tests[1], 'oos').net.n}), ${f(g(tests[1], 'rep').net.meanR)}R on 2010-2019 (n ${g(tests[1], 'rep').net.n}). Forex pooled: ${f(g(tests[2], 'oos').net.meanR)}R (n ${g(tests[2], 'oos').net.n}) and ${f(g(tests[2], 'rep').net.meanR)}R (n ${g(tests[2], 'rep').net.n}).`,
    `The location step: out of sample the kept trades made ${f(welchOut.meanKept)}R a trade and the rejected ones ${f(welchOut.meanRejected)}R (Welch t ${ft(welchOut.t)}).`,
    `External range (pullback past the 50 % line) ${f(d1.byRange.external.oos.net.meanR)}R (n ${d1.byRange.external.oos.net.n}) against internal ${f(d1.byRange.internal.oos.net.meanR)}R (n ${d1.byRange.internal.oos.net.n}) out of sample, after costs.`,
    `Exits (T1, all windows): ` + Object.entries(d1.byReason).map(([k, v]) => `${k} ${v.n} (${f(v.meanR, 2)}R before costs)`).join(', ') + '.',
    `Buys ${f(d1.bySide.buy.oos.net.meanR)}R and sells ${f(d1.bySide.sell.oos.net.meanR)}R a trade after costs out of sample.`,
  ];
  const res = { study: 'h4-pullback-end', built: '2026-11-23', verdict, headline, params: P, windows: W, costs: K.COSTS, plain,
    oosEnd: new Date(Math.max(...t1.trades.map((x) => x.entryT)) * 1000).toISOString().slice(0, 10),
    tests: tests.map(({ trades, ...t }) => t) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const cols = ['stream', 'market', 'side', 'entryT', 'entry', 'stop', 'target', 'exitT', 'exit', 'reason', 'R', 'Rnet', 'range'];
  const rows = [];
  for (const t of [tests[0], tests[3]]) for (const x of t.trades)
    rows.push([t.id === 'T1' ? 'kept' : 'rejected', x.market, x.side, x.entryT, +x.entry.toPrecision(7), +x.stop.toPrecision(7), +x.target.toPrecision(7),
      x.exitT, +x.exit.toPrecision(7), x.reason, +x.R.toFixed(3), +x.Rnet.toFixed(3), x.range]);
  const tj = { cols, note: 'times unix s UTC; entry = the filled price (next 5m open after the H1 close); R before costs, Rnet after 1x costs; kept = T1 (T2 = its xau rows, T3 = the rest); rejected = T4 comparison stream', rows };
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify(tj).replace(/\],\[/g, '],\n[') + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(headline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

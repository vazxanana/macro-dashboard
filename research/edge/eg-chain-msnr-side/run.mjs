// research/edge/eg-chain-msnr-side/run.mjs - the H4 > H1 > M15 engulf chain with a limit at the middle of the M15 zone, its
// orders split by the H4 direction call (Daily key levels): WITH against AGAINST (PREREGISTRATION.md, 24 Nov 2026). 12 judged
// cells (2 sides x 2 fills x 3 exits), five markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged AFTER costs on
// calendar-month sums. Research only: nothing live imports it, it places nothing.
//   EDGE_DATA=<cache> node research/edge/eg-chain-msnr-side/run.mjs market <m> <outDir>   one market's accumulators + its cut test
//   node research/edge/eg-chain-msnr-side/run.mjs report <outDir>                         result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { mstat, p1, welch, monthOf, NM, DM, FROM, SPLIT, TO } from '../grid7-wide-core/run.mjs';
import { chainSignals, trade, oppTarget } from '../grid7-wide-eg-chain/run.mjs';
import { direction } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const SIDES = ['WITH', 'AGAINST', 'ALL'], FILLS = ['touch', 'through'], EXITS = ['1R', '2R', 'opp'];
export const CHAIN = 1, FILL = 24, CAP = 3 * 86400, SEC15 = 900;   // chain B of the imported chain code = H4 > H1 > M15
export const NS = 18, NJ = 12;                                    // slots (3 sides x 2 x 3); the first 12 (WITH, AGAINST) are judged
export const slot = (sd, f, x) => (sd * 2 + f) * 3 + x;
export const slotName = (i) => { const x = i % 3, r = (i - x) / 3, f = r % 2, sd = (r - f) / 2; return { sd, f, x, name: `${SIDES[sd]} ${FILLS[f]} ${EXITS[x]}` }; };

const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// the call of each closed 4h candle: H4 working, key levels from the 1d candles
export function h4Calls(F) {
  const A = F['1d']; const keyOf = (t) => { const k = K.barAt(A, t); return k < 0 ? t : A[k].t; };
  return direction(conv(F['4h']), keyOf, 86400).call;
}
// the chain's orders: { s, K, ci, entry, stop, call } (closed candles only; entry on the winning side of the stop)
export function orders(F) {
  const { sig, Z } = chainSignals(F); const calls = h4Calls(F), H4 = F['4h'];
  const out = [];
  for (const g of sig) { if (g.ch !== CHAIN) continue;
    if (!(g.s * (g.entry50 - g.stop) > 0)) continue;
    const i = K.closedCount(H4, g.K) - 1;
    out.push({ s: g.s, K: g.K, ci: g.ci, entry: g.entry50, stop: g.stop, call: i >= 0 ? calls[i] : 0 }); }
  return { ord: out, Z4: Z['4h'] };
}
// when the resting limit dies: 24 M15 candles after K, or the first M15 close past the stop
export function deadOf(M15, o) {
  let dead = M15[o.ci + FILL] ? M15[o.ci + FILL].t + SEC15 : o.K + FILL * SEC15;
  for (let j = o.ci + 1; j < M15.length && M15[j].t + SEC15 <= dead; j++) if (o.s > 0 ? M15[j].c < o.stop : M15[j].c > o.stop) { dead = M15[j].t + SEC15; break; }
  return dead;
}
// the fill of the limit: the first 5-minute candle from K that trades to the entry (thr 0) or through it by thr, before `dead`
export function fillOf(M5, o, dead, thr) {
  for (let i = startIdx(M5, o.K); i < M5.length; i++) { const b = M5[i]; if (b.e > dead) return null;
    if (o.s > 0 ? b.l <= o.entry - thr : b.h >= o.entry + thr) return { fi: i, fill: o.s > 0 ? Math.min(b.o, o.entry) : Math.max(b.o, o.entry) }; }
  return null;
}
// one order under one fill rule: null, or { t, risk, cr, R: [1R, 2R, opp | NaN] } before costs
export function runOrder(M5, M15, Z4, o, thr, cost) {
  const s = o.s, f = fillOf(M5, o, deadOf(M15, o), thr); if (!f) return { nofill: true };
  const rk = Math.abs(o.entry - o.stop), risk = s * (f.fill - o.stop), base = risk > 0 ? risk : rk;
  if (risk > 0 && risk < cost) return { small: true };
  let opp = oppTarget(Z4, s, o.K, o.entry); if (opp != null && Math.abs(opp - o.entry) < rk) opp = null;
  const tg = [f.fill + s * base, f.fill + 2 * s * base, opp == null ? NaN : opp];
  const r = trade(M5, s, 'lim', o.entry, o.stop, o.K, Infinity, tg, CAP, thr, f); if (!r) return { ran: true };
  if (!r.gap && !(s * (r.fill - o.stop) > 0)) throw new Error('stop on the wrong side');
  return { t: M5[f.fi].t, fill: f.fill, risk: base, cr: cost / base, R: r.R, gap: !!r.gap, noOpp: opp == null };
}

export function newAcc() { return { ms: new Float64Array(NS * NM), msNet: new Float64Array(NS * NM), n: new Float64Array(NS * 2), sum: new Float64Array(NS * 2),
  sq: new Float64Array(NS * 2), net: new Float64Array(NS * 2), win: new Float64Array(NS * 2), winNet: new Float64Array(NS * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; if (R - cr > 0) A.winNet[c * 2 + w]++; }
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

export function runFrames(F, market, cost, X = [], pre = null) {
  const M5 = F['5m'], M15 = F['15m']; const { ord, Z4 } = pre || orders(F); const A = newAcc();
  const cnt = { orders: ord.length, with: 0, against: 0, noCall: 0, filled: [0, 0], nofill: [0, 0], small: 0, dropped: 0, gaps: 0, noOpp: 0 };
  for (const o of ord) {
    const sd = o.call === 0 ? -1 : o.call === o.s ? 0 : 1; if (sd < 0) cnt.noCall++; else if (sd === 0) cnt.with++; else cnt.against++;
    for (let f = 0; f < 2; f++) {
      const x = runOrder(M5, M15, Z4, o, f === 0 ? 0 : cost / 2, cost);
      if (x.nofill) { cnt.nofill[f]++; continue; } if (x.small) { cnt.small++; continue; } if (x.ran) continue;
      if (x.t < FROM || x.t >= TO) continue;
      if (X.length && inBad(X, x.t)) { cnt.dropped++; continue; }
      cnt.filled[f]++; if (x.gap) cnt.gaps++; if (x.noOpp) cnt.noOpp++;
      const m = monthOf(x.t), w = x.t < SPLIT ? 0 : 1;
      for (let k = 0; k < 3; k++) { if (Number.isNaN(x.R[k])) continue; add(A, slot(2, f, k), w, m, x.R[k], x.cr); if (sd >= 0) add(A, slot(sd, f, k), w, m, x.R[k], x.cr); }
    }
  }
  return { cnt, acc: Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))])) };
}

export function cutTest(M5, market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07'], full = null) {
  const key = (o) => [o.s, o.K, o.entry.toFixed(8), o.stop.toFixed(8), o.call].join('|');
  full = full || orders(frames(M5)).ord; const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = orders(frames(M5.filter((b) => b.e <= T))).ord.filter((o) => o.K <= T).map(key);
    const want = full.filter((o) => o.K <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const pre = orders(F); const r = runFrames(F, market, COSTS[market], exclusions(market), pre);
  const cut = cutTest(M5, market, undefined, pre.ord);
  return { market, cost: COSTS[market], first: M5[0].t, last: M5[M5.length - 1].t, ...r.cnt, acc: r.acc, cut };
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, winNet: n ? A.winNet[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export function judge(A) {
  const rows = []; for (let c = 0; c < NS; c++) { const s = cellStats(A, c); rows.push({ cell: c, ...slotName(c), d: s.d, c: s.c, p: p1(s.c.tNet, s.c.months - 1) }); }
  const H = K.holm(rows.slice(0, NJ).map((r) => r.p));
  rows.forEach((r, i) => { if (i >= NJ) return; r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.meanNet > 0 && r.d.tNet >= 2, conf: r.c.meanNet > 0 && r.c.tNet >= 2, holm: H[i] < 0.05 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : (x < 0 ? '-' : '') + Math.abs(x).toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(6),
  win: w.win == null ? null : +w.win.toFixed(3), winNet: w.winNet == null ? null : +w.winNet.toFixed(3) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const rows = judge(pool(data)), J = rows.slice(0, NJ), pass = J.filter((r) => r.pass), anyN = J.some((r) => r.checks.n);
  const verdict = pass.length ? 'PASS' : anyN ? 'FAIL' : 'INCONCLUSIVE';
  const best = [...J].sort((a, b) => b.c.tNet - a.c.tNet)[0];
  const pairs = []; for (let f = 0; f < 2; f++) for (let x = 0; x < 3; x++) { const a = rows[slot(0, f, x)], b = rows[slot(1, f, x)];
    pairs.push({ cell: `${FILLS[f]} ${EXITS[x]}`, disc: { diff: +(a.d.mean - b.d.mean).toFixed(6), welch: +welch(a.d, b.d).toFixed(2), diffNet: +(a.d.meanNet - b.d.meanNet).toFixed(6) },
      conf: { diff: +(a.c.mean - b.c.mean).toFixed(6), welch: +welch(a.c, b.c).toFixed(2), diffNet: +(a.c.meanNet - b.c.meanNet).toFixed(6) } }); }
  const perMarket = data.map((d) => { const s = cellStats(pool([d]), best.cell); return { market: d.market, disc: slim(s.d), conf: slim(s.c) }; });
  const tot = (k) => data.reduce((a, d) => a + d[k], 0);
  const headline = verdict === 'PASS'
    ? `${pass.length} of 12 cells pass; best ${best.name}: ${f3(best.c.meanNet)}R a trade after costs in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)})`
    : verdict === 'FAIL'
      ? `0 of 12 cells pass; the best cell, ${best.name}, made ${f3(best.c.meanNet)}R a trade after costs in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)})`
      : `no cell reaches 300 trades in both windows; the best cell, ${best.name}, made ${f3(best.c.meanNet)}R a trade after costs in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)})`;
  const cellOut = (r) => ({ cell: r.name, side: SIDES[r.sd], fill: FILLS[r.f], exit: EXITS[r.x], disc: slim(r.d), conf: slim(r.c), ...(r.checks ? { holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass } : {}) });
  const out = { study: 'eg-chain-msnr-side', built: '2026-11-24', verdict, headline, basis: 'judged after costs on calendar-month sums (pre-registered); before costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), best: best.name, passed: pass.map((r) => r.name),
    counts: { orders: tot('orders'), with: tot('with'), against: tot('against'), noCall: tot('noCall') },
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10), orders: d.orders,
      with: d.with, against: d.against, noCall: d.noCall, filled: d.filled, nofill: d.nofill, small: d.small, dropped: d.dropped, gaps: d.gaps })),
    cells: J.map(cellOut), withVsAgainst: pairs, allOrders: rows.slice(NJ).map(cellOut), perMarket, cut: data.flatMap((d) => d.cut) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), c = o.counts;
  const L = ['# The H4 > H1 > M15 engulf chain, WITH against AGAINST the H4 direction call (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing is',
    'proposed. One run, no variants.', '',
    '## What was run', '',
    'The three-timeframe engulf chain on its H4 > H1 > M15 ladder (`grid7-wide-eg-chain`\'s `chainSignals`, imported; engulf zones from',
    '`council/eg-methods.mjs` `zones`): a live H4 engulf zone gives the side; price comes back into it and an H1 engulf of that side',
    'completes touching it; an M15 engulf of that side then completes touching the H1 zone within 24 candles. Order: a limit at the',
    'middle of the M15 zone for 24 M15 candles (cancelled by an M15 close past the stop), stop past the H1 zone\'s far side + 0.1 ATR(14)',
    'of H1, exits 1R, 2R or the nearest live opposite H4 zone (1R or more away), 3-day limit. Two fills: `touch` (a 5-minute candle',
    'trades to the entry: the desk\'s fill) and `through` (it trades through the entry by half the round trip). Each order is put in',
    'WITH or AGAINST by the direction call (`direction()`, unchanged) of the last H4 candle closed at the order: H4 working, Daily key',
    `levels. Five markets pooled (${o.markets.join(', ')}), OANDA mid 5-minute candles, discovery = fills 2005-2014, confirmation = 2015 to`,
    'October 2026. Costs: the demo round trips of `combo-grid-2`, in R of each trade\'s own risk.', '',
    `Orders: ${N(c.orders)}; side equal to the call ${N(c.with)} (${(100 * c.with / c.orders).toFixed(1)} %), opposite ${N(c.against)} (${(100 * c.against / c.orders).toFixed(1)} %), no call yet ${N(c.noCall)}.`, '',
    '## The 12 judged cells (the bar is after costs)', '',
    'R a trade (calendar-month-sum t). Pass = n >= 300 in both windows, after-cost R > 0 with month t >= 2 in both, Holm p < 0.05.', '',
    '| Cell | n 05-14 | before 05-14 (t) | after 05-14 (t) | n 15-26 | before 15-26 (t) | after 15-26 (t) | win 15-26 | Holm | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  const row = (r) => `| ${r.cell} | ${N(r.disc.n)} | ${f3(r.disc.mean)} (${f2(r.disc.t)}) | ${f3(r.disc.meanNet)} (${f2(r.disc.tNet)}) | ${N(r.conf.n)} | ${f3(r.conf.mean)} (${f2(r.conf.t)}) | ${f3(r.conf.meanNet)} (${f2(r.conf.tNet)}) | ${(100 * r.conf.win).toFixed(0)} % | ${r.holm == null ? '' : r.holm.toFixed(3)} | ${r.pass == null ? '' : r.pass ? 'yes' : 'no'} |`;
  for (const r of o.cells) L.push(row(r));
  L.push('', `Passing: ${o.passed.length} of 12${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}. Best cell (highest confirmation after-cost month t): ${o.best}.`, '',
    '## WITH against AGAINST (reported, not judged)', '',
    'Mean R WITH minus mean R AGAINST, before costs, and the Welch t of the trades.', '',
    '| Fill, exit | diff 05-14 | Welch t | diff 15-26 | Welch t |', '|---|---:|---:|---:|---:|');
  for (const p of o.withVsAgainst) L.push(`| ${p.cell} | ${f3(p.disc.diff)} | ${f2(p.disc.welch)} | ${f3(p.conf.diff)} | ${f2(p.conf.welch)} |`);
  L.push('', '## Every chain order, no call condition (reported)', '',
    '| Cell | n 05-14 | before 05-14 (t) | after 05-14 (t) | n 15-26 | before 15-26 (t) | after 15-26 (t) | win 15-26 | | |', '|---|---:|---:|---:|---:|---:|---:|---:|---|---|');
  for (const r of o.allOrders) L.push(row(r));
  L.push('', `## Per market, the best cell (${o.best})`, '', '| Market | n 05-14 | before (t) | after (t) | n 15-26 | before (t) | after (t) |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const x of o.perMarket) L.push(`| ${x.market} | ${N(x.disc.n)} | ${f3(x.disc.mean)} (${f2(x.disc.t)}) | ${f3(x.disc.meanNet)} (${f2(x.disc.tNet)}) | ${N(x.conf.n)} | ${f3(x.conf.mean)} (${f2(x.conf.t)}) | ${f3(x.conf.meanNet)} (${f2(x.conf.tNet)}) |`);
  L.push('', '## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} orders (side, time, entry, stop, call) known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every order has its stop on the losing side of its entry (the run throws otherwise); a trade whose risk is under the round trip is no trade; a fill candle that opens past the stop is booked at -1R; on the fill candle only the stop counts; stop first when one candle holds both.',
    '- Exclusions: the data-quality audit\'s bad intervals.', '',
    '| Market | candles from | orders | WITH / AGAINST / no call | filled touch / through | unfilled touch / through | risk under cost | dropped |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.orders)} | ${N(m.with)} / ${N(m.against)} / ${N(m.noCall)} | ${N(m.filled[0])} / ${N(m.filled[1])} | ${N(m.nofill[0])} / ${N(m.nofill[1])} | ${N(m.small)} | ${m.dropped} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted and is not called an edge.');
  else { const w = o.withVsAgainst.filter((p) => p.disc.welch >= 2 && p.conf.welch >= 2).length;
    L.push('Taking the chain\'s orders only on the side of the H4 direction call does not make the chain profitable after costs, and neither',
      `does taking them against it: no cell clears the bar. WITH beat AGAINST with a Welch t of 2 or more in both windows in ${w} of 6`,
      'fill x exit pairs' + (w ? ' (a difference between two losing groups is not a profit).' : '.') + ' Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.'); }
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'orders', r.orders, 'filled', r.filled.join('/'), 'cut', JSON.stringify(r.cut.map((x) => [x.n, x.missing, x.extra])), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir>');
}

// Edge research · replica-sides: do the replica's sells beat its buys? The raw replica signal (the research stream: every
// signal, market entry, 2R, 48 h) on ten markets, 2020 to Oct 2026, net of the council's 17 Nov 2026 cost model, IS 2020-23 vs
// OOS 2024 on, three pre-registered tests with Holm. See PREREGISTRATION.md (committed alone, before any of this ran).
// Usage:
//   node research/edge/replica-sides/run.mjs fetch <candleDir>                 candles from origin/council-data (git, no network)
//   node research/edge/replica-sides/run.mjs market <key> <candleDir> <outDir>  replay one market → <outDir>/<key>.json
//   node research/edge/replica-sides/run.mjs report <outDir>                   → months.json + result.json next to this file
// The signal is council/trader.mjs replicaSignals, copied verbatim at run time (research/edge/gold-systems/live.mjs); stops,
// fills, costs and the HistData clock are imported unchanged from council/fills.mjs and council/histdata.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARGV = process.argv.slice(2);
process.argv.length = Math.min(process.argv.length, 2);   // the imported study runs its own command line on import: hide ours
const PREV = await import('../shadow-scalp-filters/run.mjs');
export const { pOneSided, holm, monthKeys, monthOf, tStat, aggregate } = PREV;

// ─── the pre-registered constants ───
export const MARKETS = {
  xau: { dir: 'xau-histdata', sym: 'XAUUSD', base: '1m', M: { group: 'Metals', spot: true } },
  eurusd: { dir: 'EURUSD', sym: 'EURUSD', base: '1m', M: { group: 'Forex' } },
  gbpusd: { dir: 'GBPUSD', sym: 'GBPUSD', base: '1m', M: { group: 'Forex' } },
  audusd: { dir: 'AUDUSD', sym: 'AUDUSD', base: '1m', M: { group: 'Forex' } },
  usdcad: { dir: 'USDCAD', sym: 'USDCAD', base: '1m', M: { group: 'Forex' } },
  usdchf: { dir: 'USDCHF', sym: 'USDCHF', base: '1m', M: { group: 'Forex' } },
  btc: { dir: 'crypto5m', sym: 'BTCUSDT', base: '5m', M: { group: 'Crypto' } },
  eth: { dir: 'crypto5m', sym: 'ETHUSDT', base: '5m', M: { group: 'Crypto' } },
  sol: { dir: 'crypto5m', sym: 'SOLUSDT', base: '5m', M: { group: 'Crypto' } },
  xrp: { dir: 'crypto5m', sym: 'XRPUSDT', base: '5m', M: { group: 'Crypto' } },
};
const U = (y, m, d = 1) => Date.UTC(y, m - 1, d) / 1000;
export const WIN = { warm: { m1: U(2019, 7), c5: U(2022, 1) }, from: { m1: U(2020, 1), c5: U(2022, 3) }, oos: U(2024, 1), to: U(2026, 11) };
export const IS_MONTHS = monthKeys(WIN.from.m1, WIN.oos), OOS_MONTHS = monthKeys(WIN.oos, WIN.to);
// the council's cost model as the Trader computed it from council-data of 17 Nov 2026 (costModel over ctrader/symbols.json and
// every mirror file; 10:05 UTC). Coins: spread and demo entry fill as a share of the 17 Nov price (px17), applied to each entry.
export const MODEL = {
  xau: { spread: 0.06, commissionRT: 0.000024, entrySlip: -0.17, src: 'quotes+commission+mirror' },
  eurusd: { spread: 0, commissionRT: 0.000045, entrySlip: -0.00001, src: 'quotes+commission+mirror' },
  gbpusd: { spread: 0, commissionRT: 0.000045, entrySlip: 0, src: 'quotes+commission+mirror' },
  audusd: { spread: 0, commissionRT: 0.000045, entrySlip: 0, src: 'quotes+commission+mirror' },
  usdcad: { spread: 0, commissionRT: 0.000045, entrySlip: 0, src: 'quotes+commission+mirror' },
  usdchf: { spread: 0, commissionRT: 0.000045, entrySlip: 0, src: 'quotes+commission+mirror' },
  btc: { spread: 17.34, commissionRT: 0, entrySlip: -1.75, src: 'quotes+mirror', px17: 64349.4 },
  eth: { spread: 2.98, commissionRT: 0, entrySlip: 1.41, src: 'quotes+mirror', px17: 1806.69 },
  sol: { spread: 0.196, commissionRT: 0, entrySlip: 0.078, src: 'quotes+mirror', px17: 72.58 },
  xrp: { spread: null, commissionRT: null, entrySlip: null, src: 'default' },
};
// the forward research stream that raised the question (council-data research.json of 17 Nov 2026, k 'replica', 3-17 Nov,
// closed, not void; net = council/fills.mjs tradeCost with the 17 Nov model): descriptive, never part of a test
export const FORWARD = { from: '2026-11-03', to: '2026-11-17', all: { n: 1000, gross: -0.094, net: -0.3, t: -2.08 },
  buy: { n: 522, gross: -0.414, net: -0.62, t: -7.83 }, sell: { n: 478, gross: 0.256, net: 0.051, t: 3.58 },
  dollarUpForex: { n: 181, total: 50.2 }, dollarDownForex: { n: 208, total: -123.6 },
  demoSlip: { n: 157, mean: 0.062, t: 3.06, buy: -0.003, sell: 0.127, eth: 0.189, sol: 0.143, gbpusd: 0.071, xau: 0.027, eurusd: 0.001 } };
export const RULE = { minT: 2, alpha: 0.05, t2Min: 5, moveDays: 20, nTests: 3 };
const HOLD = 48 * 3600, NEXT_MAX = 900;

// the model for one entry (coins scale their price-based figures to the entry's price)
export function mmAt(key, entry) {
  const m = MODEL[key]; if (!m.px17) return m;
  const k = entry / m.px17;
  return { ...m, spread: m.spread * k, entrySlip: m.entrySlip * k };
}

// ─── fetch (council-data, git only) ───
function fetchCandles(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const git = (args, enc) => execFileSync('git', args, { encoding: enc, maxBuffer: 1 << 30, cwd: path.join(HERE, '../../..') });
  for (const [key, m] of Object.entries(MARKETS)) {
    const names = git(['ls-tree', '--name-only', 'origin/council-data', `research/candles/${m.dir}/`], 'utf8').split('\n').filter(Boolean)
      .filter((f) => path.basename(f).startsWith(m.sym + '_') && (m.base === '5m' || +path.basename(f).match(/_M1_(\d{4})/)[1] >= 2019));
    for (const f of names) { const out = path.join(dir, path.basename(f)); if (!fs.existsSync(out)) fs.writeFileSync(out, git(['show', `origin/council-data:${f}`], 'buffer')); }
    console.log(key, names.length, 'files');
  }
}

// ─── one market ───
async function replayMarket(key, cdir, odir) {
  const { histStampUtc } = await import('../../../council/histdata.mjs');
  const { spotSkip, stopFill, exitR, tradeCost } = await import('../../../council/fills.mjs');
  const { LIVE } = await import('../gold-systems/live.mjs');
  const mk = MARKETS[key], crypto = mk.M.group === 'Crypto', base = [];
  if (mk.base === '5m') {
    for (const r of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cdir, `${mk.sym}_5m.json.gz`)))))
      if (r[0] >= WIN.warm.c5 && r[0] < WIN.to) base.push({ time: r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4] });
  } else {
    for (const f of fs.readdirSync(cdir).filter((f) => f.startsWith(mk.sym + '_M1_')).sort())
      for (const line of zlib.gunzipSync(fs.readFileSync(path.join(cdir, f))).toString('utf8').split('\n')) {
        if (line.length < 20) continue;
        const p = line.split(';'), t = histStampUtc(p[0]);
        if (t < WIN.warm.m1 || t >= WIN.to || (base.length && t <= base[base.length - 1].time)) continue;
        base.push({ time: t, open: +p[1], high: +p[2], low: +p[3], close: +p[4] });
      }
  }
  const M5 = mk.base === '5m' ? base : aggregate(base, 300), M15 = aggregate(M5, 900), H1 = aggregate(M5, 3600), D1 = aggregate(M5, 86400);
  const skip = M5.map((b) => !crypto && spotSkip(b.time));
  const from = crypto ? WIN.from.c5 : WIN.from.m1;
  const dummy = { time: 0, open: 0, high: 0, low: 0, close: 0 };
  const seen = new Set(), rows = [];
  let j15 = 0, j1 = 0, jd = 0, nSig = 0;
  for (let i = 99; i < M5.length - 1; i++) {
    const T = M5[i].time + 300;                            // the decision: this M5 candle has just closed
    while (j15 < M15.length && M15[j15].time + 900 <= T) j15++;   // M15[0..j15) closed by T
    while (j1 < H1.length && H1[j1].time + 3600 <= T) j1++;
    while (jd < D1.length && D1[jd].time + 86400 <= T) jd++;
    if (T < from || skip[i]) continue;
    if (!crypto && skip[i + 1]) continue;
    const nx = M5[i + 1]; if (nx.time - T > NEXT_MAX) continue;   // no price soon after the decision (shut market, data hole)
    const src = { '5m': { bars: M5.slice(i - 99, i + 1).concat([dummy]) }, '15m': { bars: M15.slice(Math.max(0, j15 - 60), j15).concat([dummy]) },
      '1h': { bars: H1.slice(Math.max(0, j1 - 50), j1).concat([dummy]) } };
    let sigs = []; try { sigs = LIVE.replicaSignals(src); } catch (e) { sigs = []; }
    for (const g of sigs) {
      const sig = `${g.sell ? 's' : 'b'}|${g.tc}`; if (seen.has(sig)) continue; seen.add(sig); nSig++;
      // the Trader's research row (council/trader.mjs, the replica loop): entry at market, stop past the extreme, round numbers on gold
      const entry = nx.open, buf = key === 'xau' ? Math.max(0.1 * g.atr, 0.3) : 0.1 * g.atr, stop0 = g.sell ? g.ext + buf : g.ext - buf, r00 = Math.abs(entry - stop0);
      if (!(r00 > 0) || (g.sell ? entry >= stop0 : entry <= stop0)) continue;
      let stop = stop0;
      if (key === 'xau') { const rn = g.sell ? Math.ceil(stop0 / 10) * 10 : Math.floor(stop0 / 10) * 10; if (Math.abs(stop0 - rn) <= 2) stop = g.sell ? rn + 0.5 : rn - 0.5; }
      const r0 = Math.abs(entry - stop), s = g.sell, t1 = entry + (s ? -2 : 2) * r0, filled = nx.time;
      let R = null, closed = null, kind = null;
      for (let k = i + 1; k < M5.length; k++) {
        const b = M5[k]; if (skip[k]) continue;
        if (s ? b.high >= stop : b.low <= stop) { const px = stopFill(b, s, stop, b.time > filled); R = px === stop ? -1 : exitR(s, entry, px, r0); closed = b.time; kind = 'stop'; break; }
        if (s ? b.low <= t1 : b.high >= t1) { R = 2; closed = b.time; kind = 'target'; break; }
        if (b.time >= filled + HOLD) { R = +((s ? entry - b.close : b.close - entry) / r0).toFixed(2); closed = b.time; kind = 'time'; break; }
      }
      if (R == null) continue;                              // still open when the candles end: not counted
      const tr = { market: key, side: s ? 'sell' : 'buy', entry, stop, r0, rr: 2, opened: T, filled, closed, R, exitKind: kind, entryMode: 'market', status: R > 0 ? 'win' : R < 0 ? 'loss' : 'be' };
      const c = tradeCost(tr, mk.M, mmAt(key, entry));
      // the market's 20-day move at the signal: close of the last completed UTC day vs the close 20 completed days earlier
      const mv = jd > RULE.moveDays ? Math.sign(D1[jd - 1].close - D1[jd - 1 - RULE.moveDays].close) : 0;
      const wm = mv === 0 ? null : (s ? -1 : 1) === mv ? 1 : 0;
      const sp = MODEL[key].spread != null ? mmAt(key, entry).spread : null;
      rows.push([T, s ? 1 : 0, +R.toFixed(3), +c.costR.toFixed(4), wm, kind === 'target' ? 2 : kind === 'stop' ? 1 : 0, sp > 0 ? +(r0 / sp).toFixed(1) : null]);
    }
  }
  // each month's own move (first open to last close), for "did the month's winning side follow the month's move"
  const mm = {};
  for (const b of M5) { if (b.time < from) continue; const k = monthOf(b.time); if (!mm[k]) mm[k] = [b.open, b.close]; else mm[k][1] = b.close; }
  fs.mkdirSync(odir, { recursive: true });
  fs.writeFileSync(path.join(odir, key + '.json'), JSON.stringify({ key, signals: nSig, cols: ['opened', 'sell', 'R', 'costR', 'withMove', 'exit', 'stopSpreads'], rows, monthMove: mm }));
  console.log(key, 'M5', M5.length, 'signals', nSig, 'trades', rows.length);
}

// ─── statistics (pure; the test runs them on months.json) ───
const r3 = (v) => v == null || !Number.isFinite(v) ? null : +v.toFixed(3);
const r2 = (v) => v == null || !Number.isFinite(v) ? null : +v.toFixed(2);
// months.json: one cell per market | month | side | withMove: [n, gross, net (1x), net (2x), wins]
export function cellsOf(files) {
  const cells = {};
  for (const f of files) for (const r of f.rows) {
    const [t, sell, R, c, wm] = r, k = `${f.key}|${monthOf(t)}|${sell ? 's' : 'b'}|${wm == null ? '-' : wm}`;
    const a = cells[k] || (cells[k] = [0, 0, 0, 0, 0]); a[0]++; a[1] += R; a[2] += R - c; a[3] += R - 2 * c; if (R - c > 0) a[4]++;
  }
  for (const a of Object.values(cells)) for (let i = 1; i < 4; i++) a[i] = +a[i].toFixed(4);
  return cells;
}
const parse = (k) => { const [m, mo, s, w] = k.split('|'); return { m, mo, s, w: w === '-' ? null : +w }; };
export const windowOfMonth = (mo) => IS_MONTHS.includes(mo) ? 'IS' : OOS_MONTHS.includes(mo) ? 'OOS' : null;
// pooled stats of a selection of cells over a window: n, gross / net a trade, total, month-sum t
export function streamStats(cells, keep, win, col = 2, first = null) {
  const months = (win === 'IS' ? IS_MONTHS : OOS_MONTHS).filter((m) => !first || m >= first), by = Object.fromEntries(months.map((m) => [m, 0]));
  let n = 0, g = 0, net = 0, w = 0;
  for (const [k, a] of Object.entries(cells)) { const p = parse(k); if (windowOfMonth(p.mo) !== win || !keep(p)) continue; n += a[0]; g += a[1]; net += a[col]; w += a[4]; if (p.mo in by) by[p.mo] += a[col]; }
  const t = tStat(Object.values(by));
  return { n, gross: r3(n ? g / n : null), net: r3(n ? net / n : null), total: r2(net), win: r3(n ? w / n : null), t: r2(t), months: months.length };
}
// T2: per month with >= 5 sells and >= 5 buys, mean net of sells minus mean net of buys
export function diffStats(cells, win, keep = () => true) {
  const months = win === 'IS' ? IS_MONTHS : OOS_MONTHS, acc = {};
  for (const [k, a] of Object.entries(cells)) { const p = parse(k); if (windowOfMonth(p.mo) !== win || !keep(p)) continue; const o = acc[p.mo] || (acc[p.mo] = { s: [0, 0], b: [0, 0] }); o[p.s][0] += a[0]; o[p.s][1] += a[2]; }
  const d = months.filter((m) => acc[m] && acc[m].s[0] >= RULE.t2Min && acc[m].b[0] >= RULE.t2Min).map((m) => acc[m].s[1] / acc[m].s[0] - acc[m].b[1] / acc[m].b[0]);
  return { months: d.length, mean: r3(d.length ? d.reduce((x, y) => x + y, 0) / d.length : null), t: r2(tStat(d)) };
}
export function evaluate(cells) {
  const sel = { T1: (p) => p.s === 's', T3: (p) => p.w === 1 };
  const tests = {};
  for (const id of ['T1', 'T2', 'T3']) {
    const IS = id === 'T2' ? diffStats(cells, 'IS') : streamStats(cells, sel[id], 'IS'), OOS = id === 'T2' ? diffStats(cells, 'OOS') : streamStats(cells, sel[id], 'OOS');
    const k = OOS.months, mean = (x) => id === 'T2' ? x.mean : x.net;
    tests[id] = { IS, OOS, p: r3(pOneSided(OOS.t, k - 1)), isPos: mean(IS) > 0, oosPos: mean(OOS) > 0 };
  }
  const hp = holm(['T1', 'T2', 'T3'].map((id) => tests[id].p));
  ['T1', 'T2', 'T3'].forEach((id, i) => { const x = tests[id]; x.holm = r3(hp[i]); x.pass = x.OOS.t >= RULE.minT && x.holm <= RULE.alpha && x.isPos && x.oosPos; });
  return tests;
}

function report(odir) {
  const files = Object.keys(MARKETS).map((k) => JSON.parse(fs.readFileSync(path.join(odir, k + '.json'), 'utf8')));
  const cells = cellsOf(files);
  fs.writeFileSync(path.join(HERE, 'months.json'), JSON.stringify({ cols: ['n', 'gross', 'net', 'net2x', 'wins'], key: 'market|month|side|withMove', cells }));
  const tests = evaluate(cells);
  const all = (p) => true, W = ['IS', 'OOS'];
  const both = (keep) => Object.fromEntries(W.map((w) => [w, streamStats(cells, keep, w)]));
  const both2 = (keep) => Object.fromEntries(W.map((w) => [w, streamStats(cells, keep, w, 3)]));
  const markets = {};
  for (const f of files) {
    const m = f.key, first = MARKETS[m].M.group === 'Crypto' ? monthOf(WIN.from.c5) : null;
    const both = (keep) => Object.fromEntries(W.map((w) => [w, streamStats(cells, keep, w, 2, first)]));
    const rs = f.rows.filter((r) => r[0] >= (MARKETS[m].M.group === 'Crypto' ? WIN.from.c5 : WIN.from.m1));
    const cost = rs.length ? rs.reduce((s, r) => s + r[3], 0) / rs.length : null, tight = rs.filter((r) => r[6] != null && r[6] < 5).length;
    markets[m] = { signals: f.signals, trades: rs.length, costR: r3(cost), stopUnder5Spreads: r3(rs.length ? tight / rs.length : null),
      all: both((p) => p.m === m), buy: both((p) => p.m === m && p.s === 'b'), sell: both((p) => p.m === m && p.s === 's'),
      diff: Object.fromEntries(W.map((w) => [w, diffStats(cells, w, (p) => p.m === m)])) };
    // does the month's winning side (higher mean net) match the month's own move?
    let agree = 0, nm = 0; const acc = {};
    for (const [k, a] of Object.entries(cells)) { const p = parse(k); if (p.m !== m || !windowOfMonth(p.mo)) continue; const o = acc[p.mo] || (acc[p.mo] = { s: [0, 0], b: [0, 0] }); o[p.s][0] += a[0]; o[p.s][1] += a[2]; }
    for (const [mo, o] of Object.entries(acc)) { const mv = f.monthMove[mo]; if (!mv || o.s[0] < RULE.t2Min || o.b[0] < RULE.t2Min || mv[1] === mv[0]) continue; nm++; const sellWon = o.s[1] / o.s[0] > o.b[1] / o.b[0]; if (sellWon === (mv[1] < mv[0])) agree++; }
    markets[m].monthWinnerFollowsMove = { months: nm, agree, share: r3(nm ? agree / nm : null) };
  }
  const dollarUp = (p) => ['eurusd', 'gbpusd', 'audusd'].includes(p.m) ? p.s === 's' : ['usdcad', 'usdchf'].includes(p.m) ? p.s === 'b' : false;
  const fx = (p) => ['eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'].includes(p.m);
  const years = {}; for (const y of [2020, 2021, 2022, 2023, 2024, 2025, 2026]) { const inY = (p) => p.mo.startsWith(String(y)); const st = (keep) => { let n = 0, net = 0; for (const [k, a] of Object.entries(cells)) { const p = parse(k); if (!windowOfMonth(p.mo) || !inY(p) || !keep(p)) continue; n += a[0]; net += a[2]; } return { n, net: r3(n ? net / n : null), total: r2(net) }; }; years[y] = { buy: st((p) => p.s === 'b'), sell: st((p) => p.s === 's'), withMove: st((p) => p.w === 1), againstMove: st((p) => p.w === 0) }; }
  const passN = Object.values(tests).filter((x) => x.pass).length;
  const T = tests;
  const verdict = passN === 0 ? `FAIL, 0 of 3: the replica's sells do not beat its buys on 2020-26 (OOS sells ${T.T1.OOS.net}R a trade net, n ${T.T1.OOS.n}, month t ${T.T1.OOS.t}; sells minus buys ${T.T2.OOS.mean}R, t ${T.T2.OOS.t}); the forward split of 3-17 Nov is a regime artefact` : `PASS, ${passN} of 3`;
  const out = { study: 'replica-sides', title: 'Replica: do its sells really beat its buys?', built: '2026-11-17', preregistration: 'PREREGISTRATION.md', system: 'Gold replica (raw research signal, ten markets)', verdict,
    rule: RULE, windows: { is: '2020-01 to 2023-12 (coins 2022-03 on)', oos: '2024-01 to 2026-10', oosMonths: OOS_MONTHS.length, isMonths: IS_MONTHS.length },
    model: MODEL, forward: FORWARD, tests, pool: { all: both(all), buy: both((p) => p.s === 'b'), sell: both((p) => p.s === 's'), withMove: both((p) => p.w === 1), againstMove: both((p) => p.w === 0) },
    pool2x: { all: both2(all), sell: both2((p) => p.s === 's'), withMove: both2((p) => p.w === 1) },
    forexDollar: { up: both((p) => fx(p) && dollarUp(p)), down: both((p) => fx(p) && !dollarUp(p)) }, years, markets };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(verdict); for (const [id, x] of Object.entries(tests)) console.log(id, JSON.stringify(x));
  console.log('pool', JSON.stringify(out.pool)); console.log('fx dollar', JSON.stringify(out.forexDollar));
  for (const [m, x] of Object.entries(markets)) console.log(m, JSON.stringify({ trades: x.trades, cost: x.costR, tight: x.stopUnder5Spreads, all: x.all, buy: x.buy, sell: x.sell, diff: x.diff, follow: x.monthWinnerFollowsMove }));
  console.log('years', JSON.stringify(years));
}

const [cmd, a1, a2, a3] = ARGV;
if (cmd === 'fetch') fetchCandles(a1);
else if (cmd === 'market') await replayMarket(a1, a2, a3);
else if (cmd === 'report') report(a1);

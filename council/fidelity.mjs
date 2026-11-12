// Council · Replay fidelity: does the daily replay (backtest.mjs) produce the same signals, with the same outcomes,
// as the live Trader (trader.mjs) on the same days? Reads only local files; no network, no trading rule is touched.
// Usage: node council/fidelity.mjs [dataDir=data] [trades.json] [backtest.json]
// Writes <dataDir>/research/fidelity.json and prints a short summary.
//
// Matching: a live signal (live or shadow; shadows are the full signal stream) and a replay row match when market,
// setup and side are equal and their signal times are within ±10 minutes (one-to-one, closest first). The replay's
// '@mkt' twins are a research variant and are not matched. Only the overlap window counts: from the later of the replay's
// start and the first live signal, to the replay's end.
// Outcomes: live R is gross (no spread); the replay row has R_none (gross, no break-even) and its spread as cost in R.
// Both comparisons are reported: live R vs R_none, and live R vs R_none - cost.
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2] || 'data';
const TRADES = process.argv[3] || path.join(DIR, 'trades.json');
const BT = process.argv[4] || path.join(DIR, 'backtest.json');
const TOL = 10 * 60, NEAR = 60 * 60;
// the live trader takes gold/forex D1 labels from OANDA only since #384 (7 Nov 2026 16:01 UTC); before that its labels came from
// Kraken's candles, while the replay labels every day from OANDA. Comparing those two is comparing two label sources, not a fault.
const LIVE_OANDA_D1_SINCE = Date.parse('2026-11-07T16:01:37Z') / 1000;
// Candle feed, not just the D1 label: the live trader trades gold/forex on OANDA spot candles since #449 (merged 7 Nov 2026
// 19:00:06 UTC; first run 19:01), on Kraken (gold: PAXG shifted onto spot) before; crypto always on Kraken. The replay records its
// feed per market in bt.markets.source (OANDA for gold/forex since #463; crypto Kraken or, until Kraken's cache covers the window,
// Binance). A live signal and the replay only saw the same candles when those two agree: the 'sameFeed' block and the per-market
// 'sameFeed' numbers judge the replay on those; the rest is a feed comparison, not a replay fault.
const SPOT_MKTS = new Set(['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']);
const LIVE_OANDA_CANDLES_SINCE = Date.parse('2026-11-07T19:00:06Z') / 1000;
const liveFeed = (x) => (SPOT_MKTS.has(x.market) && x.opened >= LIVE_OANDA_CANDLES_SINCE ? 'OANDA' : 'Kraken');

const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const liveAll = (() => { const t = rd(TRADES); return Array.isArray(t) ? t : t.trades || []; })();
const bt = rd(BT);
const cols = bt.tradeCols || [];
const rows = (bt.trades || []).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
// replay row status: 'closed' / 'unfilled' / 'open' (still running at the end of the window, R null); older files have no status column
const rStatus = (r) => r.status || (r.fill ? 'closed' : 'unfilled');
const hasStatus = cols.includes('status');

const from0 = Date.parse(bt.from) / 1000, to = Date.parse(bt.to) / 1000;
const replayRows = rows.filter((r) => !String(r.setup).endsWith('@mkt'));
const liveSig = liveAll.filter((x) => x.opened && x.market && x.k && x.side && !x.addOf);
const firstLive = Math.min(...liveSig.map((x) => x.opened));
const from = Math.max(from0, firstLive);
const inWin = (t) => t >= from && t <= to;
const L = liveSig.filter((x) => inWin(x.opened));
const R = replayRows.filter((r) => inWin(r.opened));

const replaySetups = new Set(replayRows.map((r) => r.setup)), liveSetups = new Set(liveSig.map((x) => x.k));
const replayMarkets = new Set(Object.keys(bt.markets || {}).filter((k) => bt.markets[k] && bt.markets[k].steps));
const errors = (bt.markets && bt.markets.errors) || {};
const replayFeed = (m) => ((bt.markets || {}).source || {})[m] || null;
const sameFeed = (x) => replayFeed(x.market) === liveFeed(x);

// ─── one-to-one matching, closest in time first ───
const key = (m, k, s) => `${m}|${k}|${s}`;
const byKey = new Map();
R.forEach((r, i) => { const kk = key(r.market, r.setup, r.side); if (!byKey.has(kk)) byKey.set(kk, []); byKey.get(kk).push(i); });
const cands = [];
L.forEach((x, li) => { for (const ri of byKey.get(key(x.market, x.k, x.side)) || []) { const dt = R[ri].opened - x.opened; if (Math.abs(dt) <= TOL) cands.push([Math.abs(dt), li, ri, dt]); } });
cands.sort((a, b) => a[0] - b[0]);
const lMatch = new Array(L.length).fill(-1), rMatch = new Array(R.length).fill(-1), dts = [];
for (const [, li, ri, dt] of cands) if (lMatch[li] < 0 && rMatch[ri] < 0) { lMatch[li] = ri; rMatch[ri] = li; dts.push(dt); }

// ─── outcome agreement on matched pairs ───
const closedLive = (x) => ['win', 'loss', 'be'].includes(x.status);
const unfilledLive = (x) => ['missed', 'expired'].includes(x.status);
const sign = (v) => (v > 0.05 ? 1 : v < -0.05 ? -1 : 0);
const pairs = [];
L.forEach((x, li) => { if (lMatch[li] >= 0) pairs.push([x, R[lMatch[li]]]); });
const agree = (f) => { const ok = pairs.filter(f); return ok.length; };
const pct = (a, b) => (b ? +(a / b).toFixed(3) : null);
const median = (a) => { if (!a.length) return null; const v = [...a].sort((x, y) => x - y), n = v.length; return +(n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2).toFixed(3); };
const mean = (a) => (a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) : null);
const both = pairs.filter(([x, r]) => closedLive(x) && r.fill === 1 && rStatus(r) === 'closed' && r.R_none != null);
// a replay order still resting at the window's end is not judged on fill (undecided); one already filled counts as filled
const fillKnown = (r) => !(rStatus(r) === 'open' && !r.fill);
const fillAgree = pairs.filter(([x, r]) => (closedLive(x) || unfilledLive(x)) && fillKnown(r) && (closedLive(x) ? 1 : 0) === r.fill);
const fillJudged = pairs.filter(([x, r]) => (closedLive(x) || unfilledLive(x)) && fillKnown(r));
const dGross = both.map(([x, r]) => x.R - r.R_none), dNet = both.map(([x, r]) => x.R - (r.R_none - r.cost));
const signAgree = both.filter(([x, r]) => sign(x.R) === sign(r.R_none)).length;
const signAgreeNet = both.filter(([x, r]) => sign(x.R) === sign(r.R_none - r.cost)).length;
// live trades whose stop moved to break-even (config.be at the time): the replay's be1 variant is the closer comparison
const beLive = both.filter(([x]) => x.beMoved);
const outcomeFlip = both.filter(([x, r]) => sign(x.R) !== sign(r.R_none)).map(([x, r]) => ({ id: x.id, market: x.market, setup: x.k, side: x.side, opened: new Date(x.opened * 1000).toISOString(),
  liveStatus: x.status, liveR: x.R, liveExit: x.exit || null, beMoved: !!x.beMoved, replayR: r.R_none, replayR_be1: r.R_be1, cost: r.cost, dt: r.opened - x.opened, liveEntry: x.entry, liveRR: x.rr, replayRR: r.rr }));

const crossTab = (f, g) => { const o = {}; for (const [x, r] of pairs) { const k = `${f(x)}→${g(r)}`; o[k] = (o[k] || 0) + 1; } return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); };

// ─── why unmatched ───
const hours = (s) => +(s / 3600).toFixed(1);
// live run coverage proxy: every live signal is stamped with its run time, so long stretches with no signal on any market
// are candidate run gaps (GitHub Actions cron delays/skips)
const runTimes = [...new Set(liveAll.map((x) => x.opened))].sort((a, b) => a - b);
const gaps = []; for (let i = 1; i < runTimes.length; i++) if (runTimes[i] - runTimes[i - 1] > 3 * 3600) gaps.push([runTimes[i - 1], runTimes[i]]);
const inGap = (t) => gaps.some(([a, b]) => t > a + 600 && t < b - 600);
const forexClosed = (m, t) => { if (['xau', 'btc', 'eth', 'sol', 'xrp'].includes(m)) return false; const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21); };

function whyLive(x) {
  if (!replaySetups.has(x.k)) return ['setup not modelled in replay', 'replay gap'];
  if (errors[x.market] || !replayMarkets.has(x.market)) return ['market failed in replay', 'data feed'];
  if (x.status === 'skipped') return [x.reason === 'fill-near-stop' ? 'live skipped (market fill inside the minimum stop)' : 'live skipped (price past stop/target at signal)', 'live-only guard'];
  if (!hasStatus && (x.status === 'open' || x.status === 'pending') && x.opened > to - 2 * 86400) return ['still open live; replay drops trades not closed by its end', 'replay bug'];
  const near = R.filter((r) => r.market === x.market && r.setup === x.k && r.side === x.side && Math.abs(r.opened - x.opened) <= NEAR && rMatch[R.indexOf(r)] < 0);
  if (near.length) return ['replay fired the same signal 10-60 min apart (timing/candle-close drift)', 'data feed'];
  const other = R.find((r) => r.market === x.market && r.side === x.side && r.setup !== x.k && Math.abs(r.opened - x.opened) <= TOL);
  if (other) return [`replay fired ${other.setup} instead (same side, ±10 min)`, 'setup label'];
  const anyReplay = R.some((r) => r.market === x.market && Math.abs(r.opened - x.opened) <= 6 * 3600);
  if (!anyReplay) return ['replay silent on this market for ±6 h (replay feed gap / warm-up)', 'data feed'];
  if (!sameFeed(x)) return [`replay saw no READY signal; replay on ${replayFeed(x.market)} candles, live on ${liveFeed(x)}`, 'feed differs'];
  return ['replay saw no READY signal (different candles or analysis state)', 'data feed'];
}
function whyReplay(r) {
  if (!liveSetups.has(r.setup)) return ['setup not run live (replay-only research setup)', 'replay-only setup'];
  if (inGap(r.opened)) return ['inside a >3 h stretch with no live run output (Actions cron gap)', 'live run gap'];
  const near = L.filter((x) => x.market === r.market && x.k === r.setup && x.side === r.side && Math.abs(r.opened - x.opened) <= NEAR && lMatch[L.indexOf(x)] < 0);
  if (near.length) return ['live fired the same signal 10-60 min apart (timing/candle-close drift)', 'data feed'];
  const other = L.find((x) => x.market === r.market && x.side === r.side && x.k !== r.setup && Math.abs(r.opened - x.opened) <= TOL);
  if (other) return [`live logged ${other.k} instead (same side, ±10 min)`, 'setup label'];
  // the live dedupe: a live/shadow trade with the same setup and side still open/pending at that time suppresses a re-signal
  const busy = liveSig.find((x) => x.market === r.market && x.k === r.setup && x.side === r.side && x.opened < r.opened && (x.closed || Infinity) > r.opened);
  if (busy) return ['live had the same setup+side still open (dedupe on a different earlier trade: state cascade)', 'state cascade'];
  if (forexClosed(r.market, r.opened)) return ['market closed for live (weekend window)', 'live-only guard'];
  if (!sameFeed(r)) return [`live saw no READY signal; replay on ${replayFeed(r.market)} candles, live on ${liveFeed(r)}`, 'feed differs'];
  return ['live saw no READY signal (different candles, D1 source or seen-state)', 'data feed'];
}

const tally = (items, f) => { const o = {}; for (const it of items) { const [why, cls] = f(it); const k = `${cls}: ${why}`; (o[k] = o[k] || { cls, why, n: 0, bySetup: {}, byMarket: {}, examples: [] }); const e = o[k]; e.n++;
  const s = it.k || it.setup; e.bySetup[s] = (e.bySetup[s] || 0) + 1; e.byMarket[it.market] = (e.byMarket[it.market] || 0) + 1;
  if (e.examples.length < 3) e.examples.push({ market: it.market, setup: s, side: it.side, opened: new Date(it.opened * 1000).toISOString(), status: it.status || rStatus(it), ...(it.id ? { id: it.id, shadow: !!it.shadow, blockedBy: it.blockedBy } : {}) }); }
  return Object.values(o).sort((a, b) => b.n - a.n); };
const uL = L.filter((x, i) => lMatch[i] < 0), uR = R.filter((r, i) => rMatch[i] < 0);
const top = (items, f) => { const o = {}; for (const it of items) { const k = f(it); o[k] = (o[k] || 0) + 1; } return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => ({ k, n })); };

// comparable universe: setups both sides run, markets the replay covered
const comparableL = L.filter((x) => replaySetups.has(x.k) && replayMarkets.has(x.market) && !errors[x.market]);
const comparableR = R.filter((r) => liveSetups.has(r.setup));
const perSetup = {};
for (const k of [...new Set(comparableL.map((x) => x.k).concat(comparableR.map((r) => r.setup)))]) {
  const li = L.map((x, i) => [x, i]).filter(([x]) => x.k === k), ri = R.map((r, i) => [r, i]).filter(([r]) => r.setup === k);
  const lm = li.filter(([, i]) => lMatch[i] >= 0).length, rm = ri.filter(([, i]) => rMatch[i] >= 0).length;
  perSetup[k] = { live: li.length, liveMatched: lm, replay: ri.length, replayMatched: rm, liveRate: pct(lm, li.length), replayRate: pct(rm, ri.length) };
}
// D1 label and outcome agreement on a set of matched pairs; gap = mean (live R - replay R) over the trades both closed
// (gross: replay R_none; net: R_none - its cost), sums for the size of it
function agreeOn(ps) {
  const bc = ps.filter(([x, r]) => closedLive(x) && r.fill === 1 && rStatus(r) === 'closed' && r.R_none != null), sum = (a) => +a.reduce((s, v) => s + v, 0).toFixed(2);
  return { pairs: ps.length, d1Rate: pct(ps.filter(([x, r]) => (x.feat || {}).d1 === r.d1).length, ps.length), bothClosed: bc.length,
    signRate: pct(bc.filter(([x, r]) => sign(x.R) === sign(r.R_none)).length, bc.length), signRateNet: pct(bc.filter(([x, r]) => sign(x.R) === sign(r.R_none - r.cost)).length, bc.length),
    meanLiveR: mean(bc.map(([x]) => x.R)), meanReplayR: mean(bc.map(([, r]) => r.R_none)), meanReplayRNet: mean(bc.map(([, r]) => r.R_none - r.cost)),
    gapGross: mean(bc.map(([x, r]) => x.R - r.R_none)), gapNet: mean(bc.map(([x, r]) => x.R - (r.R_none - r.cost))),
    sumLiveR: sum(bc.map(([x]) => x.R)), sumReplayR: sum(bc.map(([, r]) => r.R_none)), sumReplayRNet: sum(bc.map(([, r]) => r.R_none - r.cost)) };
}
const perMarket = {};
for (const m of [...new Set(comparableL.map((x) => x.market).concat(comparableR.map((r) => r.market)))]) {
  const li = L.map((x, i) => [x, i]).filter(([x]) => x.market === m && replaySetups.has(x.k)), ri = R.map((r, i) => [r, i]).filter(([r]) => r.market === m && liveSetups.has(r.setup));
  const lm = li.filter(([, i]) => lMatch[i] >= 0).length, rm = ri.filter(([, i]) => rMatch[i] >= 0).length;
  const mp = pairs.filter(([x]) => x.market === m), ls = li.filter(([x]) => sameFeed(x)), lsm = ls.filter(([, i]) => lMatch[i] >= 0).length;
  const feeds = {}; for (const [x] of li) feeds[liveFeed(x)] = (feeds[liveFeed(x)] || 0) + 1;
  perMarket[m] = { live: li.length, liveMatched: lm, replay: ri.length, replayMatched: rm, liveRate: pct(lm, li.length), replayRate: pct(rm, ri.length),
    // how far the replay's Kraken cache reached for this market (backtest.mjs markets.krakenCoverage; covers: the replay used it)
    replayFeed: replayFeed(m), krakenCache: ((bt.markets || {}).krakenCoverage || {})[m] || null, liveFeeds: feeds, ...agreeOn(mp),
    sameFeed: { live: ls.length, liveMatched: lsm, liveRate: pct(lsm, ls.length), ...agreeOn(mp.filter(([x]) => sameFeed(x))) } };
}
// the whole replay judged only where both sides read the same candles
const sameFeedL = comparableL.filter(sameFeed), sameFeedPairs = pairs.filter(([x]) => sameFeed(x));
const sameFeedBlock = { live: sameFeedL.length, liveMatched: sameFeedL.filter((x) => lMatch[L.indexOf(x)] >= 0).length,
  liveInReplay: pct(sameFeedL.filter((x) => lMatch[L.indexOf(x)] >= 0).length, sameFeedL.length), ...agreeOn(sameFeedPairs),
  feedDiffersPairs: pairs.length - sameFeedPairs.length, markets: [...new Set(sameFeedL.map((x) => x.market))].sort(),
  note: `live gold/forex ran on Kraken candles before ${new Date(LIVE_OANDA_CANDLES_SINCE * 1000).toISOString().slice(0, 16)} UTC (OANDA after); crypto live is Kraken. Pairs where the replay's feed (markets.source) differs from the live feed at that time are left out here` };

const matched = pairs.length;
const out = {
  at: new Date().toISOString(),
  window: { from: new Date(from * 1000).toISOString(), to: new Date(to * 1000).toISOString(), replayFrom: bt.from, replayAt: bt.at, firstLive: new Date(firstLive * 1000).toISOString() },
  counts: { replayOpen: R.filter((r) => rStatus(r) === 'open').length, live: L.length, liveShadow: L.filter((x) => x.shadow).length, replay: R.length, matched, comparableLive: comparableL.length, comparableReplay: comparableR.length },
  matchRate: {
    liveInReplay: pct(matched, L.length), replayInLive: pct(matched, R.length),
    comparable: { liveInReplay: pct(comparableL.filter((x) => lMatch[L.indexOf(x)] >= 0).length, comparableL.length), replayInLive: pct(comparableR.filter((r) => rMatch[R.indexOf(r)] >= 0).length, comparableR.length) },
  },
  timing: { meanDtSec: mean(dts), absMeanDtSec: mean(dts.map(Math.abs)), note: 'replay opened minus live opened; the replay steps every 5 min on a fixed grid' },
  agreement: {
    pairs: matched,
    d1: { agree: agree(([x, r]) => (x.feat || {}).d1 === r.d1), rate: pct(agree(([x, r]) => (x.feat || {}).d1 === r.d1), matched), table: crossTab((x) => (x.feat || {}).d1, (r) => r.d1),
      // the replay labels gold/forex D1 from OANDA for every day (bt.markets.d1src); the live trader only since its switch, Kraken before
      bySource: Object.fromEntries(['OANDA', 'feed'].map((src) => { const p = pairs.filter(([x]) => ((bt.markets || {}).d1src || {})[x.market] === src); return [src, { n: p.length, rate: pct(p.filter(([x, r]) => (x.feat || {}).d1 === r.d1).length, p.length) }]; })),
      // like-for-like: both sides used the same label source (crypto on its feed; gold/forex live trades opened after the OANDA switch)
      likeForLike: (() => { const same = ([x]) => { const s = ((bt.markets || {}).d1src || {})[x.market]; return s !== 'OANDA' || x.opened >= LIVE_OANDA_D1_SINCE; };
        const p = pairs.filter(same), q = pairs.filter((pr) => !same(pr));
        return { n: p.length, rate: pct(p.filter(([x, r]) => (x.feat || {}).d1 === r.d1).length, p.length), labelSourceDiffers: q.length,
          note: `${q.length} gold/forex pairs were opened before ${new Date(LIVE_OANDA_D1_SINCE * 1000).toISOString().slice(0, 16)} UTC, when live D1 still came from Kraken: left out` }; })() },
    session: { agree: agree(([x, r]) => (x.feat || {}).session === r.session), rate: pct(agree(([x, r]) => (x.feat || {}).session === r.session), matched) },
    struct: { rate: pct(agree(([x, r]) => (x.feat || {}).struct === r.struct), matched) },
    cf: { rate: pct(agree(([x, r]) => (x.feat || {}).cf === r.cf), matched) },
    choch: { rate: pct(agree(([x, r]) => (x.feat || {}).choch === r.choch), matched) },
    m15c: { rate: pct(agree(([x, r]) => (x.feat || {}).m15c === r.m15c), matched) },
    fill: { judged: fillJudged.length, agree: fillAgree.length, rate: pct(fillAgree.length, fillJudged.length), table: crossTab((x) => x.status, (r) => (rStatus(r) === 'open' ? (r.fill ? 'open (filled)' : 'open (resting)') : r.fill ? 'filled' : 'unfilled')) },
    outcome: {
      bothClosed: both.length,
      signAgree: signAgree, signRate: pct(signAgree, both.length),
      signRateNet: pct(signAgreeNet, both.length),
      meanLiveR: mean(both.map(([x]) => x.R)), meanReplayR: mean(both.map(([, r]) => r.R_none)), meanReplayRNet: mean(both.map(([, r]) => r.R_none - r.cost)),
      meanDiffGross: mean(dGross), medianDiffGross: median(dGross), meanAbsDiffGross: mean(dGross.map(Math.abs)),
      sameSignDiffGross: mean(both.filter(([x, r]) => sign(x.R) === sign(r.R_none)).map(([x, r]) => x.R - r.R_none)),
      rrDiffer: both.filter(([x, r]) => Math.abs(x.rr - r.rr) > 0.05).length,
      biggestDiffs: both.map(([x, r]) => ({ id: x.id, liveR: x.R, replayR: r.R_none, liveRR: x.rr, replayRR: r.rr, d: +(x.R - r.R_none).toFixed(2) })).sort((p, q) => Math.abs(q.d) - Math.abs(p.d)).slice(0, 8), meanDiffNet: mean(dNet),
      exactR: both.filter(([x, r]) => Math.abs(x.R - r.R_none) <= 0.05).length,
      liveBeMoved: { n: beLive.length, signRateVsBe1: pct(beLive.filter(([x, r]) => sign(x.R) === sign(r.R_be1)).length, beLive.length) },
      flips: outcomeFlip,
    },
  },
  sameFeed: sameFeedBlock,
  perSetup, perMarket,
  unmatchedLive: { n: uL.length, top: top(uL, (x) => `${x.market}:${x.k}`), reasons: tally(uL, whyLive) },
  unmatchedReplay: { n: uR.length, top: top(uR, (r) => `${r.market}:${r.setup}`), reasons: tally(uR, whyReplay) },
  liveRunGaps: gaps.filter(([a, b]) => b > from && a < to).map(([a, b]) => ({ from: new Date(a * 1000).toISOString(), to: new Date(b * 1000).toISOString(), hours: hours(b - a) })),
};
fs.mkdirSync(path.join(DIR, 'research'), { recursive: true });
fs.writeFileSync(path.join(DIR, 'research', 'fidelity.json'), JSON.stringify(out, null, 1));

const P = (v) => (v == null ? '-' : `${(v * 100).toFixed(0)}%`), o = out.agreement.outcome;
console.log(`Replay fidelity ${out.window.from.slice(0, 16)} → ${out.window.to.slice(0, 16)}`);
console.log(`live signals ${L.length} (shadow ${out.counts.liveShadow}), replay rows ${R.length}, matched ${matched}`);
console.log(`match: live found in replay ${P(out.matchRate.liveInReplay)}, replay found in live ${P(out.matchRate.replayInLive)} | comparable setups/markets only: ${P(out.matchRate.comparable.liveInReplay)} / ${P(out.matchRate.comparable.replayInLive)}`);
console.log(`agreement: d1 ${P(out.agreement.d1.rate)} (like-for-like ${P(out.agreement.d1.likeForLike.rate)} n${out.agreement.d1.likeForLike.n}; ${out.agreement.d1.likeForLike.labelSourceDiffers} pairs left out: live D1 was Kraken then), session ${P(out.agreement.session.rate)}, struct ${P(out.agreement.struct.rate)}, cf ${P(out.agreement.cf.rate)}, fill ${P(out.agreement.fill.rate)} (n${fillJudged.length})`);
console.log(`outcome (both closed n${both.length}): sign ${P(o.signRate)} (net ${P(o.signRateNet)}), exact R ${o.exactR}, mean live ${o.meanLiveR} vs replay ${o.meanReplayR} (net ${o.meanReplayRNet}), mean diff ${o.meanDiffGross} gross (median ${o.medianDiffGross}) / ${o.meanDiffNet} net; rr differs on ${o.rrDiffer}`);
const sf = out.sameFeed;
console.log(`same feed only (n${sf.live} live, ${sf.markets.join(' ') || 'none'}): live found in replay ${P(sf.liveInReplay)}, d1 ${P(sf.d1Rate)}, sign ${P(sf.signRate)} (n${sf.bothClosed}), R gap ${sf.gapGross} gross / ${sf.gapNet} net; ${sf.feedDiffersPairs} pairs on different feeds left out`);
for (const [m, v] of Object.entries(out.perMarket)) console.log(`  ${m.padEnd(7)} replay ${v.replayFeed}${v.krakenCache && !v.krakenCache.covers && v.replayFeed !== 'Kraken' && v.replayFeed !== 'OANDA' ? ` (Kraken cache from ${v.krakenCache.from})` : ''}, live ${Object.entries(v.liveFeeds).map(([f, n]) => `${f}${n}`).join('/')}: match ${P(v.liveRate)}/${P(v.replayRate)}, d1 ${P(v.d1Rate)}, sign ${P(v.signRate)} (n${v.bothClosed}), live ${v.sumLiveR}R vs replay ${v.sumReplayR}R (net ${v.sumReplayRNet}), gap ${v.gapGross}/trade${v.sameFeed.live ? ` | same feed: match ${P(v.sameFeed.liveRate)} n${v.sameFeed.live}, gap ${v.sameFeed.gapGross}` : ''}`);
for (const s of ['unmatchedLive', 'unmatchedReplay']) { console.log(`${s} ${out[s].n}:`); for (const r of out[s].reasons.slice(0, 6)) console.log(`  ${String(r.n).padStart(4)}  ${r.cls}: ${r.why}  ${Object.entries(r.bySetup).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k}${n}`).join(' ')}`); }

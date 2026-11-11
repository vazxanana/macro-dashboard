// MeridianX Academy: the edge registry (docs/academy/ARCHITECTURE.md sections 2, 4 and 5).
//
// The seven edges are seven Meridian systems of council/decay.mjs SYSTEMS (all live on paper until 11 Nov 2026; since then Gold
// trend and the daily engulf are live and the other five are paper shadows). This file only DESCRIBES them: every rule
// is read from the authoritative replay code named in `ruleSource`, and the candidates in academy/data/cand-<id>.json are
// produced by running that code on the research candles (academy/gen/). Nothing here is imported by the council, and this
// file imports nothing (it is safe to load from the API).
//
//   version           first 12 hex of sha256 over the `ruleSource` files (academy/gen/study.mjs computeVersion); the test
//                     recomputes it, so a changed rule file means: regenerate the candidates and pin the new version
//   costPerRoundTrip  in price units of the market (gold: $ per ounce; NAS100: index points), as the study charges it
//   study             the published numbers the candidates must reproduce (n filled trades, net R per trade)
//
// Outcome files (out-<id>.json): R and netR are the POSITION as the study books it (first unit plus its pyramid add, with
// the rule's size where the rule sizes); exitT, exit, reason, mfeR and maeR describe the first unit, the one the candidate's
// entry and stop belong to. Extra keys: unitR (first unit alone at size 1, when it differs from R), add (an add opened),
// fillT (limit orders). An order that never filled keeps R = netR = 0 with reason 'missed' | 'expired' | 'cancelled'.
//
// Two tags every candidate may carry in `rule`:
//   pre2020     t is before 2020-01-01: kept, but outside the repo's evaluation window (rule 4: 2020 -> now)
//   clockShift  the week of t could not be verified against a second feed (the research files are too thin that week, or
//               the hourly match was not decisive; academy/data/quality.json `clock`). Do not replay these on another feed
//               or score exams on them. Until 10 Nov 2026 the tag meant "stamped one hour early": the loaders now convert
//               the HistData labels with council/histdata.mjs (research/edge/histdata-clock), so that error is gone and the
//               tag is kept only for the weeks nobody could check. The pre-correction files: academy/archive/pre-clock.

const GOLD_TFS = ['5m', '15m', '1h', '4h', '1d'];
const GS = 'research/edge/gold-systems/';
const CLOCK = 'council/histdata.mjs';   // the label-to-UTC rule is part of every edge's version

export const EDGES = [
  {
    id: 'replica', name: 'Gold replica', market: 'xau', marketLabel: 'XAU/USD', sides: 'both',
    signalTf: '5m', contextTfs: GOLD_TFS, status: 'ok',
    definition: {
      trigger: 'A leg of at least 2 M15 ATRs in the last 3 h or 6 h, then an M5 candle (one of the last two closed) closes back through the last M5 swing against the leg (the change of character). Taken only when the entry is clear of a live H1 origin zone (or the reversal has a starred engulfing at structure), the stop is at least 1 M15 ATR away, the H4 structure trend is against the trade and the D1 structure trend is with it.',
      filters: 'Volatility gate: gold\'s 20-day average daily range is in the top fifth of its last 365 days. No entry 08:25-08:45 New York (news). At most 3 open, no new trade after -1.5R on the day, half size while the equity curve is under its 50-trade average; size 1.5x when the H4 Malaysian SnR direction is against the trade, 0.5x when with it.',
      entry: 'Market, 4 minutes after the M5 close (the live run), at the last M1 close.',
      stop: 'Past the leg\'s extreme by max(0.1 M15 ATR, $0.30); moved $0.50 beyond a $10 round number when it sits within $2 of one.',
      exit: 'Stop to break-even at +2R; one add at +1.5R (its stop at the first entry); from +4R the stop trails 1R behind the best price; 10R cap; out after 48 h.',
    },
    exit: { beAtR: 2, addAtR: 1.5, trail: [4, 1], capR: 10, maxHoldH: 48 },
    ruleSource: [GS + 'replica.mjs', GS + 'core.mjs', GS + 'data.mjs', GS + 'live.mjs', CLOCK],
    liveSource: 'council/trader.mjs replicaSignals, platformEngulfs, goldLevels, msnrDirection (taken verbatim at run time by live.mjs); council/engine.mjs msAnalyze',
    costPerRoundTrip: 0.30, costUnit: '$ per ounce',
    study: { path: GS + 'replica.json', variant: 'live', n: 394, netR: 0.462, grossR: 0.518, data: 'HistData XAUUSD M1 2018-01 to 2026-10' },
    notes: 'Engine events run on the full history (live: a rolling 720-candle window). The equity filter starts empty. 2018 has no trades: the volatility gate needs 200 days of history.',
  },
  {
    id: 'mosha-bo', name: 'Mosha BO', market: 'xau', marketLabel: 'XAU/USD', sides: 'both',
    signalTf: '15m', contextTfs: GOLD_TFS, status: 'ok',
    definition: {
      trigger: 'A chain of structure breakouts (engine swing 6): the last H4 breakout points in direction d, then an H1 breakout against d after it (the retracement), then a new M15 breakout in direction d.',
      filters: 'The weekly structure (Monday weeks, swing 3) agrees with d. The pullback from the H1 extreme to the M15 breakout took at least 12 H1 candles (faster arrivals are shadow only). Price has not already passed the stop. At most 2 open or pending (adds count).',
      entry: 'Limit at the broken M15 level, placed 4 minutes after the M15 close, valid 24 h; cancelled if price reaches the target first.',
      stop: '$0.30 past the M15 origin zone of the breakout (its top for sells, its bottom for buys); the risk must exceed $0.50.',
      exit: 'Stop to break-even at +1.5R; one add at +1.5R; from +3R the stop trails 1R behind the best price; 10R cap; out 72 h after the fill.',
    },
    exit: { beAtR: 1.5, addAtR: 1.5, trail: [3, 1], capR: 10, maxHoldH: 72, orderValidH: 24 },
    ruleSource: [GS + 'mosha.mjs', GS + 'core.mjs', GS + 'data.mjs', GS + 'live.mjs', CLOCK],
    liveSource: 'council/trader.mjs config.moshaBo block; council/mosha.mjs; council/engine.mjs msAnalyze',
    costPerRoundTrip: 0.30, costUnit: '$ per ounce',
    study: { path: GS + 'mosha.json', variant: 'live', n: 64, netR: 0.531, grossR: 0.577, data: 'HistData XAUUSD M1 2018-01 to 2026-10' },
    notes: 'Candidates are the limit orders the live rule would place; 8 of the 72 never fill and carry a zero outcome.',
  },
  {
    id: 'gtrend', name: 'Gold trend', market: 'xau', marketLabel: 'XAU/USD', sides: 'long',
    signalTf: '1d', contextTfs: ['1h', '4h', '1d'], status: 'ok',
    definition: {
      trigger: 'A daily close above the highest high of the previous 20 daily candles, while no trend position is open.',
      filters: 'Buys only. One position at a time.',
      entry: 'Market, 4 minutes after the daily close (00:04 UTC), at the last M1 close.',
      stop: '2 x ATR(14, daily) below the entry.',
      exit: 'No target. After every closed day the stop is raised to that close minus 2 x ATR(14) when that is higher (it never moves down). One add at the next run once a daily close is at least +1R, with the same stop.',
    },
    exit: { ratchet: 'daily close - 2 x ATR14', addAtR: 1, capR: null, maxHoldH: null },
    ruleSource: [GS + 'daily.mjs', GS + 'core.mjs', GS + 'data.mjs', GS + 'live.mjs', CLOCK],
    liveSource: 'council/trader.mjs config.goldTrend { n: 20, k: 2 } + goldTrendAdd',
    costPerRoundTrip: 0.30, costUnit: '$ per ounce',
    study: { path: GS + 'daily.json', variant: 'trend_N20_add', n: 41, netR: 1.609, grossR: 1.619, data: 'HistData XAUUSD M1 2018-01 to 2026-10' },
    notes: 'Daily candles are UTC weekdays with Sunday evening folded into Monday (live: Kraken PAXG daily candles, which include weekends).',
  },
  {
    id: 'gtl', name: 'Gold H4 trendline', market: 'xau', marketLabel: 'XAU/USD', sides: 'long',
    signalTf: '4h', contextTfs: ['15m', '1h', '4h', '1d'], status: 'ok',
    definition: {
      trigger: 'An H4 close above the falling line drawn through the last two confirmed H4 pivot highs (3 candles each side, the newer one lower, at most 120 candles apart). Each line trades once.',
      filters: 'Buys only. The H4 Malaysian SnR direction (pivot width 2, daily key levels) is up. One position at a time.',
      entry: 'Market, 4 minutes after the H4 close, at the last M1 close.',
      stop: '$0.30 under the lowest low since the newer pivot high.',
      exit: 'From +2R the stop trails 1R behind the best price; 10R cap; out after 96 h.',
    },
    exit: { trail: [2, 1], capR: 10, maxHoldH: 96 },
    ruleSource: [GS + 'daily.mjs', GS + 'core.mjs', GS + 'data.mjs', GS + 'live.mjs', CLOCK],
    liveSource: 'council/trader.mjs config.goldTL { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 }; msnrDirection (verbatim)',
    costPerRoundTrip: 0.30, costUnit: '$ per ounce',
    study: { path: GS + 'daily.json', variant: 'tl_live', n: 315, netR: 0.159, grossR: 0.179, data: 'HistData XAUUSD M1 2018-01 to 2026-10' },
    notes: 'H4 candles are UTC buckets. The study found this edge flat before 2023.',
  },
  {
    id: 'geg', name: 'Gold daily engulf', market: 'xau', marketLabel: 'XAU/USD', sides: 'long',
    signalTf: '1d', contextTfs: ['1h', '4h', '1d'], status: 'ok',
    definition: {
      trigger: 'A green daily candle closes above the high of the nearest red daily candle within the last 3 days (the base). Each base trades once.',
      filters: 'Buys only. The daily close is above its 20-day average. At most 3 open or pending. Price is still above the entry when the order is placed.',
      entry: 'Limit at the base candle\'s high, placed 4 minutes after the daily close, valid 20 days; cancelled by a daily close under the base low.',
      stop: '$0.30 under the base candle\'s low.',
      exit: 'From +2R the stop trails 1R behind the best price; 10R cap; out 240 h after the fill.',
    },
    exit: { trail: [2, 1], capR: 10, maxHoldH: 240, orderValidH: 480 },
    ruleSource: [GS + 'daily.mjs', GS + 'core.mjs', GS + 'data.mjs', GS + 'live.mjs', CLOCK],
    liveSource: 'council/trader.mjs config.goldEG { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }',
    costPerRoundTrip: 0.30, costUnit: '$ per ounce',
    study: { path: GS + 'daily.json', variant: 'eg_live', n: 175, netR: 0.304, grossR: 0.321, data: 'HistData XAUUSD M1 2018-01 to 2026-10' },
    notes: 'Candidates are the limit orders the live rule would place; 59 of the 233 never fill and carry a zero outcome.',
  },
  {
    id: 'gmp', name: 'Gold momentum pullback', market: 'xau', marketLabel: 'XAU/USD', sides: 'both',
    signalTf: '5m', contextTfs: GOLD_TFS, status: 'ok',
    definition: {
      trigger: 'A closed H1 candle (closing 07:00-17:00 UTC) whose range is at least 1.5x the average of the previous 14 H1 ranges and which closes in its top 20% (buys) or bottom 20% (sells). Then the first M5 candle within 6 h that trades into the 38.2-61.8% pullback of that H1 candle and closes in the trade direction.',
      filters: 'The H1 candle points the way of the 20-day average (last daily close above it: buys only; below: sells only). The watch ends if price reaches the stop before the entry. The risk must exceed $0.50.',
      entry: 'Market at the open of the first M1 candle after that M5 close.',
      stop: '$0.10 beyond the far end of the H1 momentum candle.',
      exit: 'From +2R the stop trails 1R behind the best price; 10R cap; out after 8 h.',
    },
    exit: { trail: [2, 1], capR: 10, maxHoldH: 8 },
    ruleSource: ['research/edge/robustness/systems.mjs', 'research/edge/robustness/lib.mjs', CLOCK],
    liveSource: 'council/trader.mjs config.goldMP { mult: 1.5, top: 0.8, z1: 0.382, z2: 0.618, wait: 6, k: 2 } (the goldMP block)',
    costPerRoundTrip: 0.15, costUnit: '$ per ounce',
    study: { path: 'research/edge/robustness/out/gmp.json', variant: 'live', n: 1004, netR: 0.043, grossR: 0.076, data: 'HistData XAUUSD M1 2018-01 to 2026-10' },
    notes: 'Live this system is on test (recorded as shadow trades since 6 Nov 2026). The only replay of it is the robustness audit\'s port (goldMP in systems.mjs), which is run here unchanged: it charges $0.15 a round trip (at $0.30 the same trades make +0.008R), takes one position at a time (live can hold several watches), enters at the next M1 open with no run lag, and builds daily candles from 17:00 New York. The study rates the edge fragile: it loses 2018-22.',
  },
  {
    id: 'nq-open', name: 'NQ New York open run', market: 'nas100', marketLabel: 'NAS100', sides: 'both',
    signalTf: '1m', contextTfs: GOLD_TFS, status: 'ok',
    definition: {
      trigger: 'O is the 09:30 New York open. Between 09:31 and 10:59 price runs at least 0.08% of O through O; within 15 minutes of the first cross a 1-minute candle closes back across O in the reclaim colour. The trade goes WITH the run (against that reclaim).',
      filters: 'Only when the 00:00 New York opening price lies ahead of the trade (above the entry for buys, below for sells). One trade a day.',
      entry: 'Market at the close of that 1-minute candle.',
      stop: 'The same distance on the other side: |entry - (run extreme -/+ 2 points)| away from the entry.',
      exit: 'From +2R the stop trails 1R behind the best price; 10R cap; out at the open of the 11:00 New York candle. Stop before target inside a candle; a gap fills at the open.',
    },
    exit: { trail: [2, 1], capR: 10, timeExit: '11:00 New York' },
    ruleSource: ['research/edge/nq-open-oos/lib.mjs', 'research/edge/nq-open-oos/load.mjs', CLOCK],
    liveSource: 'council/trader.mjs nqOpenSweep(bars, day, 570, 0, 0.0008, 0.00011) + the nyflip block + the nqRun trail',
    costPerRoundTrip: 1, costUnit: 'index points',
    study: { path: 'research/edge/nq-open-oos/result.json', variant: 'histdata.all', n: 724, netR: 0.115, grossR: null, data: 'HistData NSXUSD M1 2018-01 to 2026-10 (the study\'s cross-check; its main run is OANDA 2004-26)' },
    notes: 'The study finds the edge regime-dependent: flat 2004-22, positive since 2023. HistData\'s 2023 is thin and disagrees with OANDA for that year.',
  },
];

// version pins (computeVersion over ruleSource). Kept apart so a regeneration changes one block.
const VERSIONS = {
  replica: '541d222feed2', 'mosha-bo': '824b0a70af71', gtrend: '02bb39e4cf4e', gtl: '02bb39e4cf4e', geg: '02bb39e4cf4e', gmp: 'b4351209ebba', 'nq-open': '6921f6e3264b',
};
for (const e of EDGES) e.version = VERSIONS[e.id];

export const EDGE_IDS = EDGES.map((e) => e.id);
export const edgeById = (id) => EDGES.find((e) => e.id === id) || null;

// 32-bit FNV-1a over the UTF-16 code units of a string, as an unsigned integer
export function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);   // 'YYYY-MM' of a UTC second
// The pool of a candidate: a whole UTC calendar month is 'exam' when fnv1a(edge + ':' + 'YYYY-MM') % 10 < 3, else 'train'.
export function poolOf(edge, t) {
  const id = typeof edge === 'string' ? edge : edge.id;
  return fnv1a(id + ':' + monthOf(t)) % 10 < 3 ? 'exam' : 'train';
}
// Evaluations run 2020 -> now (the repo's rule 4): earlier candidates are kept and marked rule.pre2020.
export const EVAL_FROM = Date.UTC(2020, 0, 1) / 1000;

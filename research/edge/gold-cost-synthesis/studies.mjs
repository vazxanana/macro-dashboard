// The 44 gold studies of 13-14 Nov 2026 and where each figure sits in its own result.json.
// Pure data: no imports. `w` = the window objects ({T} = the test's key); `f` = field -> key inside the window object
// ('g:' reads from the gross window object `wg` where a study stores gross and net apart). A field left out is "not reported".
// `stop` = the key of a stop size in $ (`stopKind` median or mean) or of an ATR multiple (`stopKind` 'atr'); `stopRule` and
// `hold` are the study's own rule in words (from its result.json / RESULT.md). `tBasis`: what the stored t is.

const IS_OOS = { is: 'tests.{T}.is', oos: 'tests.{T}.oos' };
const CAPS = { is: 'tests.{T}.IS', oos: 'tests.{T}.OOS' };
const ARR = { is: 'tests.{T}.is', oos: 'tests.{T}.oos' };
const T3 = (names) => names.map((name, i) => ({ id: `T${i + 1}`, key: `T${i + 1}`, name }));
const A3 = (names) => names.map((name, i) => ({ id: `T${i + 1}`, key: String(i), name }));

// field maps shared by studies written from one template
const F_VB = { n: 'n', g: 'grossR', net: 'netR', tg: 'grossT', tn: 't', costR: 'costR', finR: 'finR', stop: 'medianStop' };
const F_CAL = { n: 'n', g: 'gross', net: 'net', tg: 'tGross', tn: 'tNet' };
const F_LEAD = { n: 'n', g: 'gross', net: 'net', tg: 'tMonthGross', tn: 'tMonth', costR: 'meanCost', stop: 'meanRisk' };
const F_GN = { n: 'n', g: 'gross', net: 'net', tg: 'tGross', tn: 't' };
const F_DAY = { n: 'n', g: 'gross', net: 'net', tg: 'tGross', tn: 't', costR: 'cost', finR: 'fin' };

export const STUDIES = [
  { topic: 'gold-vol-breakout', tf: 'M5 intraday', hold: 'to 21:00 UTC the same day', stopRule: 'k x the previous day\'s range from the open (the opposite stop)', cost: '$0.60 a round trip', f: F_VB, stopKind: 'median', w: CAPS,
    tests: T3(['k 0.5, both sides', 'k 0.7, both sides', 'k 0.5, buys only, trend up']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-vol-breakout-replicate', tf: 'M5 intraday', hold: 'to 21:00 UTC the same day', stopRule: '0.5 x the previous day\'s range from the open', cost: '$0.60 a round trip', f: F_VB, stopKind: 'median', w: { only: 'main' },
    tests: [{ id: 'R1', key: 'R1', name: 'T1 rule on untouched 2007-15' }], windows: 'single window 2007-15' },
  { topic: 'gold-comex-orb', tf: 'M5 intraday', hold: 'flat by 12:00 New York', stopRule: 'the opposite side of the 08:20-08:45 NY range (T3 against the break)', cost: '$0.60 a round trip', f: F_VB, stopKind: 'median', w: CAPS,
    tests: T3(['breakout with the break, 2R', 'breakout on narrow-range days', 'against the break']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-london-orb', tf: 'M5 intraday', hold: 'out at 20:00 UTC', stopRule: 'the opposite side of the London first-hour range', cost: '$0.60 a round trip', f: F_VB, stopKind: 'median', w: CAPS,
    tests: T3(['breakout, out at 20:00 UTC', 'breakout with a target', 'variant T3']), windows: '2008-16 | 2017-2026-11' },
  { topic: 'gold-london-reversal', tf: 'M5 intraday', hold: 'flat at 16:00 New York', stopRule: 'the study\'s stop rule (median stop reported)', cost: '$0.60 a round trip', f: F_VB, stopKind: 'median', w: CAPS,
    tests: T3(['fade the London move at 09:30 NY', 'fade, variant T2', 'fade after a NY raid']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-pdhl-break', tf: 'M15 intraday', hold: 'out at 20:00 UTC', stopRule: 'the study\'s stop rule (median stop reported)', cost: '$0.60 a round trip', f: F_VB, stopKind: 'median', w: CAPS,
    tests: T3(['M15 close beyond the previous day\'s high / low, no target', 'same, with a target', 'same, variant T3']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'ict-silver-bullet-gold', tf: 'M5 intraday', hold: 'intraday, flat the same session', stopRule: 'beyond the FVG / sweep (median stop reported)', cost: '$0.30 a round trip', f: F_VB, stopKind: 'median', w: CAPS,
    tests: T3(['AM 10:00-11:00 NY', 'PM 14:00-15:00 NY', 'variant T3']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'mmxm-pdhl-raid-gold', tf: 'M15 intraday', hold: 'flat at 16:00 ET', stopRule: '$0.30 beyond the raid extreme (median risk reported)', cost: '$0.60 a round trip', f: { n: 'n', g: 'gross', net: 'avg', tn: 'tMonth', stop: 'medRisk' }, stopKind: 'median', w: IS_OOS,
    tests: T3(['previous-day high / low raid model', 'variant T2', 'variant T3']).concat([{ id: 'T4', key: 'T4', name: 'variant T4' }]), windows: '2017-19 (36 months) | 2021-2026-11' },
  { topic: 'gold-late-ny', tf: 'M5 intraday', hold: '18:00-02:00 New York', stopRule: '1 x the 20-day mean Asia range', cost: '$0.60 a round trip', f: { n: 'n', g: 'gross', net: 'avg', tg: 'tGross', tn: 't', finR: 'finR', stop: 'medStop' }, stopKind: 'median', w: IS_OOS,
    tests: T3(['follow the 13:30-16:30 NY move', 'follow, variant T2', 'fade the move']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-gap-open', tf: 'M5 intraday', hold: 'out at 02:00 New York', stopRule: '0.25 x ATR(20) beyond the entry', cost: '$0.60 a round trip', f: { n: 'n', g: 'gross', net: 'avg', tg: 'tGross', tn: 't', finR: 'finR', stop: 'medStop' }, stopKind: 'median', w: IS_OOS,
    tests: T3(['fade the 18:00 NY reopen gap', 'follow the gap', 'variant T3']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-volume-spike', tf: 'H1 / M5 intraday', hold: 'out after 4 hours', stopRule: '$0.30 past the spike candle\'s far extreme (at least $1)', cost: '$0.60 a round trip', f: { n: 'n', g: 'gross', net: 'net', tg: 'tGross', tn: 't', stop: 'stop$' }, stopKind: 'median', w: IS_OOS,
    tests: T3(['continuation', 'reversal against an outer-quarter close', 'with an outer-quarter close']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-hourly-shock', tf: 'H1 intraday', hold: 'out at the 6th H1 candle\'s close', stopRule: '$0.30 beyond the shock extreme (T2: at its 50%)', cost: '$0.60 a round trip + financing on buys', f: { n: 'n', g: 'gross', net: 'net', tg: 'tGross', tn: 't', stop: 'stop$' }, stopKind: 'median', w: IS_OOS,
    tests: T3(['fade the shock, target its 50%', 'follow the shock', 'fade, non-release hours']), windows: '2008-16 | 2017-2026-11' },
  { topic: 'gold-silver-lead-intraday', tf: 'M5 intraday', hold: '30 minutes (T2: 60)', stopRule: '1 x the 28-day mean 30-minute gold range (whole-study median $3.02, RESULT.md)', cost: '$0.60 a round trip', f: { n: 'n', g: 'grossAvg', net: 'avg', tg: 'tGross', tn: 't' }, w: { is: 'tests.{T}.windows.inSample', oos: 'tests.{T}.windows.outOfSample' },
    tests: T3(['follow a silver shock gold lags, 30 min', 'same, 60 min', 'variant T3, 30 min']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-round-numbers', tf: 'M5 intraday', hold: 'flat before the 17:00 NY rollover', stopRule: '0.25 x ATR(14) (T1), 0.1 x ATR (T3) past the $100 level', cost: '$0.45-0.60 (spread + slippage on market orders)', f: F_GN, w: IS_OOS,
    tests: T3(['stall at $100 (limit)', 'variant T2', 'break of $100']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-vwap', tf: 'M5 intraday', hold: 'out by 16:00 New York', stopRule: '3 sd band (fade), 1 sd band (follow, pullback); at least $1', cost: '$0.60 a round trip', f: F_GN, w: IS_OOS,
    tests: T3(['fade a 2 sd close to VWAP', 'follow', 'pullback limit']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-floor-pivots', tf: 'M5 intraday', hold: 'flat by 20:00 UTC', stopRule: '0.25 x ATR20 (T1, T2), 0.2 x ATR20 (T3)', cost: '$0.60 a round trip', f: { n: 'n', g: 'gross', net: 'net', tg: 'tGross', tn: 'tNet', finR: 'fin' }, w: IS_OOS,
    tests: T3(['fade R1 / S1', 'break of R1 / S1, held to 20:00', 'variant T3']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-ote-retrace', tf: 'H1 / M5', hold: 'out after 72 H1 candles', stopRule: '$0.30 beyond the leg origin', cost: '$0.60 a round trip', f: { n: 'net.n', g: 'gross.avg', net: 'net.avg', tg: 'tGross', tn: 'tNet' }, w: IS_OOS,
    tests: T3(['limit at 0.705 of an H1 break leg', 'variant T2', 'variant T3']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-squeeze', tf: 'H4 / D1', hold: 'up to 30 H4 / 20 D1 candles (median 12-15 candles held)', stopRule: '1.5 x ATR(20)', cost: '$0.60 a round trip + financing on buys', f: { n: 'n', g: 'gross', net: 'net', tg: 'tGross', tn: 't', finR: 'fin' }, w: IS_OOS,
    tests: T3(['H4 squeeze release', 'D1 squeeze release', 'H4 with the slope filter']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-regime-switch', tf: 'D1', hold: '30-candle time exit (median 6-13 held)', stopRule: '1.5 x ATR(14)', cost: '$0.60 a round trip + financing on buys', f: { n: 'n', g: 'gross', net: 'net', tg: 'tGross', tn: 't', finR: 'fin' }, w: IS_OOS,
    tests: T3(['ER regime switch', 'breakout leg', 'fade leg']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-comex-calendar', tf: 'D1', hold: '5 days, daily closes', stopRule: '2 x ATR(20)', cost: '$0.60 a round trip', f: F_CAL, w: IS_OOS,
    tests: T3(['short into options expiry', 'variant T2', 'variant T3']), windows: '2008-16 | 2017-2026-10' },
  { topic: 'gold-turn-of-month', tf: 'D1', hold: 'TD-2 to TD+3 (5 days)', stopRule: '2 x ATR(20)', cost: '$0.60 a round trip', f: F_CAL, w: IS_OOS,
    tests: T3(['long TD-2 to TD+3', 'variant T2', 'variant T3']), windows: '2008-16 | 2017-2026-10' },
  { topic: 'gold-china-holidays', tf: 'D1', hold: '10 trading days around the Lunar New Year', stopRule: '3 x ATR(20)', cost: '$0.60 a round trip + financing', f: { n: 'n', g: 'grossR', net: 'netR', tg: 'tGross', tn: 't', costR: 'costR', finR: 'finR' }, w: IS_OOS,
    tests: T3(['10 days before the closure', 'while Shanghai is shut', '5 days after the reopening']).concat([{ id: 'T4', key: 'T4', name: 'pooled windows' }]), windows: '2008-16 | 2017-26' },
  { topic: 'gold-record-high', tf: 'D1', hold: '20 days', stopRule: '3 x ATR(20)', cost: '$0.60 a round trip + financing', f: { n: 'trades', g: 'grossR', net: 'netR', tg: 'monthGrossT', tn: 'monthNetT', costR: 'costR', finR: 'finR' }, w: ARR,
    tests: A3(['long 20 days after an all-time closing high', 'variant T2', 'variant T3']), windows: '2008-16 | 2017-26' },
  { topic: 'gold-weekly-momentum', tf: 'W1 / D1', hold: 'one week', stopRule: '2 x ATR(20)', cost: '$0.60 a round trip + financing', f: { n: 'trades', g: 'grossR', net: 'netR', tg: 'monthGrossT', tn: 'monthNetT', costR: 'costR', finR: 'finR' }, w: ARR,
    tests: A3(['last week\'s sign', 'variant T2', 'fade a 2-sd week']), windows: '2008-16 | 2017-26' },
  { topic: 'gold-oil-lead', tf: 'D1', hold: 'to the close of the 3rd gold candle', stopRule: '2 x ATR(20)', cost: '$0.60 a round trip + financing on longs', f: F_LEAD, stopKind: 'mean', w: ARR,
    tests: A3(['follow a big WTI day', 'fade it', 'copper version']), windows: '2006-16 | 2017-2026-10' },
  { topic: 'gold-bond-lead', tf: 'W1 / D1', hold: 'to the close of the 5th gold candle (daily: one candle)', stopRule: '2 x 20-day ATR', cost: '$0.60 a round trip + financing on longs', f: F_LEAD, stopKind: 'mean', w: ARR,
    tests: A3(['long after a bond up week gold lagged', 'mirror short', 'daily 2-year']), windows: '2007-16 | 2017-2026-10' },
  { topic: 'gold-dollar-lead', tf: 'W1 / D1', hold: 'to the close of the 5th gold candle (daily: one candle)', stopRule: '2 x 20-day ATR', cost: '$0.60 a round trip + financing on longs', f: F_LEAD, stopKind: 'mean', w: ARR,
    tests: A3(['long after a dollar down week gold lagged', 'mirror short', 'daily version']), windows: '2007-16 | 2017-2026-10' },
  { topic: 'gold-platinum-ratio', tf: 'D1', hold: 'not reported', stopRule: '3 x 20-day ATR', cost: '$0.60 a round trip + financing on longs', f: F_LEAD, stopKind: 'mean', w: ARR,
    tests: A3(['gold / platinum ratio reversion', 'palladium', 'monthly relative momentum']), windows: '2006-16 | 2017-2026-10' },
  { topic: 'gold-dollar-divergence', tf: 'D1', hold: 'not reported', stopRule: '1.5 x ATR(14)', cost: '$0.60 a round trip + financing on buys', f: F_LEAD, stopKind: 'mean', w: ARR,
    tests: A3(['buy after gold and the dollar both rose', 'variant T2', 'variant T3']), windows: '2008-16 | 2017-2026-10' },
  { topic: 'gold-weekly-open', tf: 'M5 / W1', hold: 'to Friday\'s last candle before 16:00 New York', stopRule: '0.5 A (A = the study\'s weekly range unit)', cost: '$0.45-0.60', f: { n: 'n', g: 'gross', net: 'avg', tn: 'tMonth', stop: 'medRisk' }, stopKind: 'median', w: IS_OOS,
    tests: T3(['bullish-week buy limit', 'variant T2', 'both-sides limits']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-month-levels', tf: 'D1', hold: 'not reported', stopRule: 'the study\'s stop (median risk reported)', cost: '$0.60 a round trip', f: { n: 'n', g: 'gross', net: 'avg', tn: 'tMonth', stop: 'medRisk' }, stopKind: 'median', w: IS_OOS,
    tests: T3(['last month\'s high / low', 'variant T2', 'buys of T2']), windows: '2008-16 | 2017-2026-11' },
  { topic: 'gold-inside-week', tf: 'W1 / D1', hold: 'to the last close of the week after', stopRule: 'the other side of the range', cost: '$0.60 a round trip', f: { n: 'n', g: 'gross', net: 'net', tn: 't', stop: 'medianRisk' }, stopKind: 'median', w: { is: 'tests.{T}.windows.inSample', oos: 'tests.{T}.windows.outOfSample' },
    tests: T3(['inside-week OCO breakout', 'NR4 week', 'Monday range held to Wednesday']), windows: '2008-16 | 2017-2026-10' },
  { topic: 'gold-ibs', tf: 'D1 / H1', hold: 'to an IBS cross of 0.5 (mean about 1.7 days)', stopRule: '2 x ATR(20)', cost: '$0.60 a round trip + financing on buys', f: F_DAY, w: IS_OOS,
    tests: T3(['buy after a bottom-20 % IBS close', 'short version', 'trend version']), windows: '2008-16 | 2017-26' },
  { topic: 'gold-key-reversal', tf: 'D1 / H1', hold: 'to the close of the third day', stopRule: '$0.30 beyond the signal day\'s extreme, at least 0.5 x ATR(20)', cost: '$0.60 a round trip + financing on buys', f: { ...F_DAY, stop: 'riskAtr' }, stopKind: 'atr', w: IS_OOS,
    tests: T3(['short a bearish key reversal at a 20-day high', 'long the bullish one', 'both']), windows: '2008-16 | 2017-26' },
  { topic: 'gold-daily-turtle-soup', tf: 'D1 / H1', hold: 'about 0.6-1.7 days (mean, as reported)', stopRule: 'beyond the new extreme (median stop reported, RESULT.md)', cost: '$0.45-0.60 + financing', f: { ...F_DAY, stop: 'riskUsd' }, stopKind: 'median', w: IS_OOS,
    tests: T3(['Turtle Soup', 'Turtle Soup Plus One', 'variant T3']), windows: '2007-16 | 2017-26' },
  { topic: 'gold-h4-pinbar', tf: 'H4', hold: 'out after 12 H4 candles', stopRule: '$0.30 past the pin\'s extreme', cost: '$0.60 a round trip + financing on buys', f: F_DAY, w: IS_OOS,
    tests: T3(['pin bar at a 20-candle extreme', 'variant T2', 'longs']), windows: '2008-16 | 2017-26' },
  { topic: 'gold-streak', tf: 'D1', hold: 'to the close of the last day held', stopRule: '1.5 x ATR(14)', cost: '$0.60 a round trip + financing on buys', f: { n: 'n', g: 'g:mean', net: 'mean', tg: 'g:monthT', tn: 'monthT' }, w: { is: 'gold.tests.{T}.is', oos: 'gold.tests.{T}.oos' }, wg: { is: 'gold.tests.{T}.isGross', oos: 'gold.tests.{T}.oosGross' },
    tests: T3(['buy after 3+ down closes', 'sell after 3+ up closes', 'variant T3']), windows: '2008-16 | 2017-2026-10' },
  { topic: 'gold-premium-discount', tf: 'D1', hold: 'up to 10 days or the range\'s 50 %', stopRule: '1.5 x ATR(14)', cost: '$0.60 a round trip + financing on buys', f: { n: 'n', g: 'g:mean', net: 'mean', tg: 'g:monthT', tn: 'monthT' }, w: { is: 'gold.tests.{T}.is', oos: 'gold.tests.{T}.oos' }, wg: { is: 'gold.tests.{T}.isGross', oos: 'gold.tests.{T}.oosGross' },
    tests: T3(['buy the bottom quarter of the 20-day range', 'sell in premium', 'buy in discount, 100-day trend up']), windows: '2008-16 | 2017-2026-10' },
  { topic: 'gold-measured-move', tf: 'H1 / D1', hold: 'up to 30 candles', stopRule: 'the study\'s ATR-based stop', cost: '$0.60 a round trip + financing', f: { n: 'net.n', g: 'gross.avg', net: 'net.avg', tg: 'gross.t', tn: 'net.t' }, w: IS_OOS,
    tests: T3(['measured move to D', 'variant T2', 'variant T3']), windows: '2016-20 | 2021-2026-11' },
  { topic: 'gold-macd', tf: 'D1', hold: 'average 12-174 daily candles (as reported)', stopRule: 'k x ATR(14), never moved', cost: '$0.60 a round trip + financing', f: { n: 'n', g: 'gross', net: 'net', tn: 't' }, w: CAPS,
    tests: T3(['MACD cross', 'MACD long only', '50 / 200 cross']), windows: '2008-16 | 2017-2026-11' },
  { topic: 'gold-ichimoku', tf: 'D1', hold: 'median 3-20 days (as reported)', stopRule: '2 x ATR(14)', cost: '$0.60 a round trip + financing', f: { n: 'n', g: 'grossPer', net: 'netPer', tg: 'tGross', tn: 'monthT' }, w: IS_OOS,
    tests: T3(['daily cloud breakout', 'Tenkan / Kijun cross', 'variant T3']), windows: '2008-16 | 2017-26' },
  { topic: 'gold-pre-cpi', tf: 'H1', hold: 'from 17:00 NY days before the release to the release morning', stopRule: '2 x ATR20(H1) x sqrt(hours) (median risk reported)', cost: '$0.60 a round trip + financing', f: { n: 'n', g: 'gross', net: 'net', tn: 't', stop: 'medianRisk' }, stopKind: 'median', w: { only: 'tests.{T}' },
    tests: T3(['long before CPI', 'long before payrolls', 'variant T3']), windows: 'single window 2018-2026-11 (T2 2022-26)' },
  { topic: 'gold-pre-nfp-replicate', tf: 'H1', hold: '17:00 NY, third weekday before payrolls, to 08:00 NY on release day', stopRule: '2 x ATR20(H1) x sqrt(hours) (median risk reported)', cost: '$0.60 a round trip + financing', f: { n: 'n', g: 'gross', net: 'net', tg: 'tGross', tn: 't', stop: 'medianRisk' }, stopKind: 'median', w: { only: 'test' },
    tests: [{ id: 'R1', key: 'R1', name: 'gold-pre-cpi T2 on 2006-21' }], windows: 'single window 2006-21' },
  { topic: 'gold-vol-target', excluded: 'portfolio weights rebalanced weekly, not trades with a stop: no R a trade, no stop', tests: [] },
];

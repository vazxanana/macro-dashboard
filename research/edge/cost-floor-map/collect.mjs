// Builds collected.json: the decisive gross / net / t of every study of the 13-14 Nov 2026 research days (#815-#943),
// read from each study's own branch, plus the demo broker's measured costs of the day. Run once, by hand, after
// `git fetch origin` (no market data is fetched; only git objects):
//   node research/edge/cost-floor-map/collect.mjs
// run.mjs reads only the committed collected.json (offline). Rules: PREREGISTRATION.md sections 1, 2 and 4.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
const show = (branch, file) => JSON.parse(git('show', `origin/${branch}:${file}`));
const get = (o, path) => (path === '' ? o : path.split('.').reduce((v, k) => (v == null ? v : v[k]), o));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Field names tried in order on the decisive object (section 2). A mean is never a stored total: a candidate over
// MEAN_CAP in absolute value is skipped (a total of R, not a mean a trade).
const MEAN_CAP = 5;
const NAMES = {
  n: ['n', 'trades', 'positions', 'events', 'years'],
  gross: ['grossAvg', 'avgGross', 'meanGross', 'meanGrossR', 'grossMeanR', 'grossPerPos', 'avgGrossR', 'avgRgross', 'grossR', 'gross', 'meanG'],
  net: ['avg', 'meanNet', 'meanNetR', 'meanR', 'netR', 'net', 'exp', 'R', 'avgR', 'tradeR', 'expNet', 'mean'],
  tNet: ['tMonth', 'monthT', 'tMonths', 't', 'tTrade', 'tradeT', 'tTrades'],
  tGross: ['tGross', 'grossT', 't_gross'],
  fin: ['finR', 'fin', 'finAvg'],
  trans: ['costR', 'spreadR', 'costAvg', 'avgCost', 'costMeanR', 'costPerPos', 'cost', 'spread', 'medCostR'],
  finPct: ['finPct'],
  stopPct: ['medStopPct', 'riskPct', 'r0pct'],
  stopPips: ['medR0Pips', 'stopPips', 'r0pips', 'medianStopPips'],
};
const pick = (o, names, cap) => {
  for (const k of names) { const v = num(o?.[k]); if (v != null && (!cap || Math.abs(v) <= cap)) return { k, v }; }
  return null;
};

// One decisive test. `path` = the object holding the decisive figures; `f` overrides a field by name (relative to that
// object) or by an absolute path in result.json ('/a.b'); `fn` computes a field from the object (documented where used).
const T = (test, path, extra = {}) => ({ test, path, ...extra });
const NO = (test, why) => ({ test, cannot: why });

// #815-#899: the decisive tests of multiple-testing-1314nov (its inputs.json, read from its branch), with the stream =
// the object that holds the t it names. Per-study notes below give the instrument and any field the auto rule misreads.
const MT_INST = {
  'shadow-best-raw': (x) => x.test.split(' ')[1], 'turn-of-month': (x) => x.test, 'pre-fomc-drift': () => 'spx500',
  'intraday-momentum': (x) => x.test, 'overnight-drift': (x) => x.test, 'orb-nas100': (x) => x.test, 'rsi2-pullback': (x) => x.test,
  'audnzd-revert': () => 'audnzd', 'crypto-hour': () => 'btc', 'gold-week-raid': () => 'xau', 'rsi2-replicate': () => 'indices (6 non-US)',
  'fx-month-end': () => 'forex majors', 'gold-asia-break': () => 'xau', 'gap-fill': (x) => x.test.split(' ')[0], 'gold-shock-revert': () => 'xau',
  'crypto-weekend': () => 'btc / eth', 'turnaround-tuesday': (x) => x.test.split('-')[0], 'oil-wednesday': () => 'wtico', 'risk-spill-jpy': (x) => x.test,
  'vol-spike-rebound': () => 'spx500 / nas100 / us30', 'fomc-follow': (x) => x.test.split(' ')[0], 'turnaround-replicate': () => 'indices (6)',
  'nfp-follow': (x) => x.test.split('-')[1], 'gold-weekend-gap': () => 'xau', 'rebalance-flow': () => 'spx500', 'crypto-reversal': () => 'btc / eth',
  'nr7-breakout': () => 'indices', 'fx-london-orb': () => 'eurusd / gbpusd', 'gold-silver-divergence': () => 'xau / xag', 'cpi-follow': () => 'xau / nas100',
  'last-hour': () => 'spx500 / nas100', 'metals-rsi2': () => 'xau / xag', 'gold-session-drift': () => 'xau', 'fx-cycle': () => 'forex majors',
  gotobi: () => 'usdjpy', 'fx-weekend-gap': () => 'forex majors', 'index-pair': () => 'index pairs', 'opex-week': () => 'spx500',
  'london-fix': () => 'forex majors', 'index-spread-momentum': () => 'index spreads', 'eth-btc-ratio': () => 'eth / btc', 'crypto-cycle': () => 'btc / eth / sol',
  'gotobi-replicate': (x) => (x.test.startsWith('R2') ? 'usdjpy' : 'yen crosses'), 'crypto-weekend-reversal': (x) => x.test.split('-')[1] || 'btc / eth',
  'index-overnight': (x) => (x.test === 'T1' ? 'spx500' : 'nas100'), tsmom: () => 'multi-asset', 'gotobi-feed': () => 'usdjpy',
  'index-ibs': (x) => ({ T1: 'spx500', T2: 'nas100', T3: 'us30' })[x.test], 'ecb-boj-days': (x) => (x.test.startsWith('ECB') ? 'eurusd' : 'usdjpy'),
  'index-weekend-gap': () => 'indices', 'commodity-fx-lead': () => 'audusd / usdcad', 'tl-third-touch': () => 'xau', 'engulf-ladder': () => 'xau',
  'mcycle-base': () => 'xau', 'drd-metals-book': () => 'xau / xag', 'gold-tsmom': () => 'xau', 'tsmom-portfolio': () => 'multi-asset', 'gold-silver-ratio': () => 'xau / xag',
  'fx-carry': () => 'forex', 'crypto-weekly-mom': () => 'crypto', 'fx-reversal': () => 'forex', 'swing-day3': () => 'xau', 'high52-rotation': () => 'indices',
  'copper-gold': () => 'indices', 'sell-in-may': () => 'indices', 'index-cycle': () => 'indices', 'energy-seasonal': () => 'energies', 'risk-cross': () => 'audjpy / nzdjpy',
};
// Fields the auto rule cannot read right for a #815-#899 study (each says why).
const MT_FIX = {
  // rsi2 family and vol-spike: gross and net stored as % of price (avgGross, avgRet); avgR (R) has no gross twin.
  'rsi2-pullback': { unit: '%', f: { gross: 'avgGross', net: 'avgRet', tNet: 'tTrades' } },
  'vol-spike-rebound': { unit: '%', f: { gross: 'avgGross', net: 'avgRet', tNet: 'tTrades' } },
  'rsi2-replicate': { f: { gross: 'avgGrossR', net: 'avgR', tNet: 'tMonthsR' } },
  'metals-rsi2': { f: { gross: 'avgRgross', net: 'avgR', tNet: 'tMonths' } },
  // overnight-drift: avgR is the net mean in R, grossR the gross mean; the decisive t is the month t.
  'overnight-drift': { f: { gross: 'grossR', net: 'avgR', tNet: 't' } },
  // tsmom: grossPerPos is per position, the decisive t is on month sums; net per position = total / positions.
  tsmom: { fn: (o) => ({ n: o.positions, gross: o.grossPerPos, net: o.total / o.positions, tNet: o.t }) },
  // fx-month-end: means are meanR / grossMeanR (auto would take grossMeanR, and net 'meanR').
  'fx-month-end': { f: { gross: 'grossMeanR', net: 'meanR', tNet: 't', tGross: 'grossT' } },
  // index-overnight and gotobi family: the decisive t is the month t ('t'), tradeT is the trade t.
  gotobi: { f: { tNet: 't' } }, 'gotobi-replicate': { f: { tNet: 't' } }, 'gotobi-feed': { f: { tNet: 't' } },
  'crypto-hour': { f: { net: 'R', tNet: 'monthT' } }, 'crypto-weekend': { f: { net: 'R', tNet: 'monthT' } },
  'index-ibs': { f: { net: 'R', tNet: 'monthT' } },
  // opex-week, rebalance-flow: 'fin' is signed (negative = credit), cost = gross - net covers it.
  'nfp-follow': { f: { net: 'avg', tNet: 't' } },
  'turnaround-tuesday': { f: { net: 'R', gross: 'grossR' } },
  'eth-btc-ratio': { f: { n: 'trades' } },
  // oil-wednesday: the t names rules.<k>.decisive.net; gross and net are two sibling objects one level up.
  'oil-wednesday': { up: 1, fn: (o) => ({ n: o.net.n, gross: o.gross.mean, net: o.net.mean, tNet: o.net.t, tGross: o.gross.t }) },
  // cpi-follow: the decisive t is on the net per event; the gross per event is a sub-object with its own t.
  'cpi-follow': { fn: (o) => ({ n: o.events, gross: o.gross.eventR, net: o.eventR, tNet: o.t, tGross: o.gross.t, unit: 'R an event' }) },
  // fx-reversal: net and gross of the weekly book in % (mean a week), month-sum t for both.
  'fx-reversal': { fn: (o) => ({ n: o.n, gross: o.gross.mean, net: o.mean, tNet: o.tMonth, tGross: o.gross.tMonth, unit: '% a week' }) },
  // turnaround-replicate: the decisive t is the month t of pool.oos.month; the trade means are one level up (R, grossR).
  'turnaround-replicate': { up: 1, fn: (o) => ({ n: o.n, gross: o.grossR, net: o.R, tNet: o.month.t }) },
  'gold-tsmom': { cannot: 'monthly % returns; gross not stored apart from cost (costPct and finPct are sums over the window)' },
};

// #900-#943, written by hand from each study's verdict and RESULT.md (section 1). inst = instrument.
const LATER = [
  { pr: 901, branch: 'cb-days-other', topic: 'cb-days-other', window: '2018 → now', tests: () => [T('pooled five banks', 'pooled', { inst: 'gbp / cad / chf / aud / nzd', f: { tNet: 'monthT' } })] },
  { pr: 902, branch: 'fx-home-hours', topic: 'fx-home-hours', window: '2016-26', tests: () => [
    T('T1 EUR/USD sell', 'tests.T1.dec', { inst: 'eurusd', f: { net: 'exp' }, stopPips: 'r0pips' }),
    T('T2 USD/JPY buy', 'tests.T2.dec', { inst: 'usdjpy', f: { net: 'exp' } }),
    T('T3 GBP/USD sell', 'tests.T3.dec', { inst: 'gbpusd', f: { net: 'exp' }, stopPips: 'r0pips' }),
    T('T4 AUD/USD sell', 'tests.T4.dec', { inst: 'audusd', f: { net: 'exp' }, stopPips: 'r0pips' })] },
  { pr: 905, branch: 'gold-haven-shock', topic: 'gold-haven-shock', window: '2016 → now', tests: (j) => j.tests.map((x, i) => T(x.id, `tests.${i}.dec`, { inst: 'xau', f: { net: 'netExact', tNet: 'tMonthNet' } })) },
  { pr: 906, branch: 'bond-fomc-drift', topic: 'bond-fomc-drift', window: 'b: 2016 → now', tests: () => [
    T('T1 USB10Y', 'tests.T1.b', { inst: 'usb10y' }), T('T2 USB30Y', 'tests.T2.b', { inst: 'usb30y' })] },
  { pr: 907, branch: 'gold-month-of-year', topic: 'gold-month-of-year', window: '2016 → now', tests: () => [
    NO('T1 strong months vs the rest', 'a Welch difference between month books; the book figures carry a trade t only, not the decisive t'),
    NO('T2', 'a difference in % between month books, no cost split'), NO('T3', 'a difference between month books, no cost split')] },
  { pr: 909, branch: 'vol-managed-index', topic: 'vol-managed-index', window: 'decisive', tests: () => [NO('T1-T3', 'Sharpe differences of daily books; no gross / cost a trade')] },
  { pr: 910, branch: 'wmr-fix-reversal', topic: 'wmr-fix-reversal', window: '2016-26', tests: () => ['T1', 'T2', 'T3'].map((k) => T(k, `tests.${k}.dec`, { inst: 'forex majors', f: { net: 'exp' } })) },
  { pr: 911, branch: 'index-52w-high', topic: 'index-52w-high', window: '2016 → now', tests: () => [NO('T1-T3', 'a difference (signal minus base) in R; the decisive t is on that difference, not on a net stream')] },
  { pr: 912, branch: 'gotobi-minute-histdata', topic: 'gotobi-minute-histdata', window: 'HistData M1 2018-26', tests: () => [T('gotobi T2 on M1', 'gate.m1', { inst: 'usdjpy', f: { tNet: 't' } })] },
  { pr: 913, branch: 'us-asia-lead', topic: 'us-asia-lead', window: '2016-26', tests: () => [
    T('T1 JP225', 'tests.T1.decisive', { inst: 'jp225' }), T('T2 JP225 strong US days', 'tests.T2.decisive', { inst: 'jp225' }), T('T3 HK33', 'tests.T3.decisive', { inst: 'hk33' })] },
  { pr: 914, branch: 'index-midday-turn', topic: 'index-midday-turn', window: '2016 → now', tests: () => ['T1', 'T2', 'T3', 'T4'].map((k) => T(k, `tests.${k}.decisive`, { inst: 'spx500 / nas100' })) },
  { pr: 915, branch: 'gotobi-limit-entry', topic: 'gotobi-limit-entry', window: '2016 → now', tests: () => [NO('limit entries', 'a capture study of the gotobi T2 entry (rows of entry prices), no pre-registered test of its own')] },
  { pr: 916, branch: 'eu-gap-fade', topic: 'eu-gap-fade', window: '2016 → now', tests: () => [
    T('T1 DE40', 'tests.T1.decisive', { inst: 'de40' }), T('T2 UK100 + EU50', 'tests.T2.decisive', { inst: 'uk100 / eu50' }), T('T3 DE40 US-led gaps', 'tests.T3.decisive', { inst: 'de40' })] },
  { pr: 917, branch: 'tokyo-fix-daily', topic: 'tokyo-fix-daily', window: '2016 → now', tests: () => [
    T('T1 every day', 'T1', { inst: 'usdjpy', f: { tNet: 't' } }),
    NO('T2 gotobi vs other days', 'a difference of daily moves in pips, no cost'), NO('T3 month means', 'a difference of month means, no cost')] },
  { pr: 918, branch: 'fx-december-usd', topic: 'fx-december-usd', window: '2010-25', tests: () => [NO('T1-T3', 'excess returns in basis points against a base; cost and financing not split from the gross')] },
  { pr: 919, branch: 'fx-weekday', topic: 'fx-weekday', window: 'decisive', tests: () => [NO('weekdays', 'Welch t of one weekday against the rest; the per-side gross and net carry no t of their own')] },
  { pr: 920, branch: 'vol-spike-replicate', topic: 'vol-spike-replicate', window: '2016 → now (non-US indices)', tests: () => [
    T('R1', 'R1', { inst: 'de40 / uk100 / eu50 / ...', unit: '%', f: { gross: 'avgGross', net: 'avgRet', tNet: 't' } }),
    T('R2', 'R2', { inst: 'de40 / uk100 / eu50 / ...', unit: '%', f: { gross: 'avgGross', net: 'avgRet', tNet: 't' } })] },
  { pr: 921, branch: 'ecb-ref-fix', topic: 'ecb-ref-fix', window: '2016-26', tests: () => ['T1', 'T2', 'T3'].map((k) => T(k, `tests.${k}.dec`, { inst: 'eurusd and crosses', f: { net: 'exp' } })) },
  { pr: 922, branch: 'santa-rally', topic: 'santa-rally', window: 'decisive', tests: () => [NO('T1-T3', 'one row a year with excess over a base; no decisive t on a net stream stored')] },
  { pr: 923, branch: 'gold-us-asia', topic: 'gold-us-asia', window: '2016 → now', tests: () => ['T1', 'T2', 'T3'].map((k) => T(k, `tests.${k}.decisive`, { inst: 'xau', f: { net: 'avg' } })) },
  { pr: 924, branch: 'ibs-replicate', topic: 'ibs-replicate', window: '2016 → now (7 non-US indices)', tests: () => [
    T('R1 pooled', 'base.tests.R1', { inst: 'indices (7 non-US)', f: { net: 'R', tNet: 'monthT' } })] },
  { pr: 925, branch: 'pre-fomc-gold-usd', topic: 'pre-fomc-gold-usd', window: 'B 2016 →', tests: () => [
    T('T1 gold', 'tests.T1.windows.B', { inst: 'xau', f: { tNet: 't' } }), T('T2 dollar', 'tests.T2.windows.B', { inst: 'usd (dxy pairs)', f: { tNet: 't' } })] },
  { pr: 926, branch: 'bond-lead-intraday', topic: 'bond-lead-intraday', window: '2016 → now', tests: () => ['T1', 'T2', 'T3'].map((k) => T(k, `tests.${k}.windows.decisive`, { inst: 'spx500 / nas100 (bond lead)', f: { net: 'avg' } })) },
  { pr: 927, branch: 'cnh-fix', topic: 'cnh-fix', window: '2018-26', tests: () => ['T1', 'T2', 'T3'].map((k) => T(k, `tests.${k}.dec`, { inst: 'usdcnh', f: { net: 'exp', gross: 'gross' } })) },
  { pr: 928, branch: 'fx-weekend-gap-replicate', topic: 'fx-weekend-gap-replicate', window: 'other pairs, 2016 →', tests: () => [
    T('R1', 'tests.R1', { inst: 'forex (other pairs)', f: { tNet: 'tMonth' } }), T('R2', 'tests.R2', { inst: 'forex (other pairs)', f: { tNet: 'tMonth' } })] },
  { pr: 929, branch: 'fx-tokyo-orb', topic: 'fx-tokyo-orb', window: '2016 → now', tests: () => [
    T('T1 USD/JPY', 'tests.T1.decisive', { inst: 'usdjpy' }), T('T2 AUD/USD', 'tests.T2.decisive', { inst: 'audusd' }), T('T3 NZD/USD', 'tests.T3.decisive', { inst: 'nzdusd' })] },
  { pr: 930, branch: 'chf-haven', topic: 'chf-haven', window: 'decisive', tests: () => [0, 1, 2].map((i) => T(`T${i + 1}`, `tests.${i}.dec`, { inst: 'chf pairs' })) },
  { pr: 931, branch: 'fx-round-numbers', topic: 'fx-round-numbers', window: '2016 →', tests: () => [
    T('T1', 'rules.T1.real.decisive', { inst: 'forex majors' }), T('T2', 'rules.T2.real.decisive', { inst: 'forex majors' })] },
  { pr: 932, branch: 'metals-intraday-momentum', topic: 'metals-intraday-momentum', window: 'B 2016 →', tests: () => [
    T('gold', 'tests.xau.B', { inst: 'xau' }), T('silver', 'tests.xag.B', { inst: 'xag' }), T('WTI', 'tests.wtico.B', { inst: 'wtico' })] },
  { pr: 933, branch: 'brent-wti-spread', topic: 'brent-wti-spread', window: '2016 → now', tests: () => [T('base', 'base.dec', { inst: 'bco / wtico', f: { net: 'avg', tNet: 'monthT' } })] },
  { pr: 934, branch: 'grain-seasonality', topic: 'grain-seasonality', window: 'decisive years', tests: (j) => j.tests.filter((x) => x.judged !== false).map((x, i) => T(`${x.id} ${x.market}`, `tests.${j.tests.indexOf(x)}.decisive`, { inst: x.market, f: { gross: 'meanG', net: 'meanNet', tNet: 't' } })) },
  { pr: 935, branch: 'commodity-xs-momentum', topic: 'commodity-xs-momentum', window: '2016-26 (months)', tests: () => [
    T('book', 'decisive', { inst: 'commodities (12)', fn: (o) => ({ n: o.gross.n, gross: o.gross.mean, net: o.net.mean, tNet: o.net.tNW, tGross: o.gross.tNW, unit: 'R a month' }) })] },
  { pr: 936, branch: 'jp-fiscal-yearend', topic: 'jp-fiscal-yearend', window: '2016-26 (years)', tests: () => [
    T('T1', 'tests.T1.decisive', { inst: 'usdjpy', f: { n: 'years', gross: 'meanGrossR', net: 'meanNetR', tNet: 't' } }),
    T('T2', 'tests.T2.decisive', { inst: 'usdjpy', f: { n: 'years', gross: 'meanGrossR', net: 'meanNetR', tNet: 't' } })] },
  { pr: 937, branch: 'soybean-short-robust', topic: 'soybean-short-robust', window: '2016 → (years)', tests: () => [
    T('frozen short', 'base.decisive', { inst: 'soybn', f: { gross: 'meanG', net: 'meanNet', tNet: 't' } })] },
  { pr: 938, branch: 'fx-weekend-gap-replicate2', topic: 'fx-weekend-gap-replicate2', window: 'other pairs, 2016 →', tests: () => [
    T('S1', 'tests.S1', { inst: 'forex (other pairs)', f: { tNet: 'tMonth' } }), T('S2', 'tests.S2', { inst: 'forex (other pairs)', f: { tNet: 'tMonth' } })] },
  { pr: 939, branch: 'bond-month-end', topic: 'bond-month-end', window: '2016 → now', tests: () => [
    T('USB10Y', 'markets.usb10y.decisive', { inst: 'usb10y', f: { tNet: 't' } }), T('USB30Y', 'markets.usb30y.decisive', { inst: 'usb30y', f: { tNet: 't' } })] },
  { pr: 940, branch: 'fx-weekly-reversal', topic: 'fx-weekly-reversal', window: '2016 → now (months)', tests: () => [
    T('primary', 'primary.decisive.monthly', { inst: 'forex (10 currencies)', fn: (o) => ({ n: o.gross.n, gross: o.gross.mean, net: o.net.mean, tNet: o.net.t, tGross: o.gross.t, unit: 'R a month' }) })] },
  { pr: 941, branch: 'index-long-reversal', topic: 'index-long-reversal', window: '2016 → now (months)', tests: () => [
    T('main', 'main.decisive', { inst: 'indices', fn: (o) => ({ n: o.x1.months, gross: o.x0.mean, net: o.x1.mean, tNet: o.x1.tNW, tGross: o.x0.tNW, unit: 'R a month' }) })] },
  { pr: 942, branch: 'yield-fx-weekly', topic: 'yield-fx-weekly', window: '2016-26', tests: () => [
    T('T1 USD/JPY', 'tests.T1.windows.decisive', { inst: 'usdjpy', f: { gross: 'grossAvg', net: 'avg' } }),
    T('T2 USD/CHF', 'tests.T2.windows.decisive', { inst: 'usdchf', f: { gross: 'grossAvg', net: 'avg' } }),
    T('T3 EUR/USD', 'tests.T3.windows.decisive', { inst: 'eurusd', f: { gross: 'grossAvg', net: 'avg' } })] },
];
const NOT_STUDIES = [
  { pr: 893, topic: 'gotobi-cost', why: 'cost accounting, no rule tested (a source for the comparison)' },
  { pr: 900, topic: 'index-futures-cost', why: 'cost accounting, no rule tested (a source for the futures column)' },
  { pr: 943, topic: 'bond-month-end-futures', why: 'cost accounting of bond-month-end at futures cost (a source for the futures column; redone elsewhere, not here)' },
  { pr: 904, topic: 'multiple-testing-1314nov', why: 'a recount of tests, not a study' },
  { pr: 908, topic: 'gotobi-timing', why: 'a timing grid around gotobi T2 (its gate reproduces #878), no pre-registered test of its own' },
];

const readField = (j, o, spec) => (typeof spec === 'string' && spec.startsWith('/') ? num(get(j, spec.slice(1))) : num(o?.[spec]));

function extract(j, base, x, fix = {}) {
  const row = { pr: base.pr, topic: base.topic, branch: base.branch, window: base.window, test: x.test, inst: x.inst || null, path: x.path || null };
  if (x.cannot || fix.cannot) return { ...row, status: 'cannot', why: x.cannot || fix.cannot };
  const o = get(j, x.path);
  if (!o || typeof o !== 'object') return { ...row, status: 'cannot', why: `no object at ${x.path}` };
  let v;
  const fn = x.fn || fix.fn;
  if (fn) v = fn(o);
  else {
    const f = { ...(fix.f || {}), ...(x.f || {}) };
    const take = (key) => (f[key] ? { k: f[key], v: readField(j, o, f[key]) } : pick(o, NAMES[key], ['gross', 'net'].includes(key) ? MEAN_CAP : 0));
    const g = take('gross'); const ne = take('net'); const n = take('n'); const tn = x.tNet != null ? { k: 'stored t of the test', v: x.tNet } : take('tNet'); const tg = take('tGross');
    v = { n: n?.v ?? null, gross: g?.v ?? null, net: ne?.v ?? null, tNet: tn?.v ?? null, tGross: tg?.v ?? null, fields: { n: n?.k, gross: g?.k, net: ne?.k, tNet: tn?.k, tGross: tg?.k } };
  }
  const fin = pick(o, NAMES.fin, MEAN_CAP);
  const trans = pick(o, NAMES.trans, MEAN_CAP);
  const finPct = pick(o, NAMES.finPct, MEAN_CAP);
  const stopPct = x.stopPct ? num(o[x.stopPct]) : pick(o, NAMES.stopPct)?.v ?? null;
  const stopPips = x.stopPips ? num(o[x.stopPips]) : pick(o, NAMES.stopPips)?.v ?? null;
  const unit = v.unit || x.unit || fix.unit || 'R';
  const out = { ...row, unit, n: v.n, gross: v.gross, net: v.net, tNet: v.tNet, tGross: v.tGross ?? null, fin: fin ? fin.v : null, trans: trans ? trans.v : null, transField: trans ? trans.k : null, finPct: finPct ? finPct.v : null, stopPct, stopPips, fields: v.fields || 'computed (see collect.mjs)' };
  if (out.gross == null || out.net == null) return { ...out, status: 'cannot', why: `no ${out.gross == null ? 'gross' : 'net'} mean stored on the decisive object` };
  if (out.tNet == null && out.tGross == null) return { ...out, status: 'cannot', why: 'no t stored on the decisive object' };
  return { ...out, status: 'read' };
}

const rows = [];
const mt = show('multiple-testing-1314nov', 'research/edge/multiple-testing-1314nov/inputs.json');
for (const r of mt.rows) {
  const base = { pr: r.pr, topic: r.topic, branch: r.branch, window: r.window };
  if (r.role === 'excluded' || !r.topic) { if (r.topic) NOT_STUDIES.push({ pr: r.pr, topic: r.topic, why: r.why }); continue; }
  const j = show(r.branch, `research/edge/${r.topic}/result.json`);
  for (const t of r.tests) {
    const inst = MT_INST[r.topic] ? MT_INST[r.topic](t) : null;
    const fix = MT_FIX[r.topic];
    if (t.kind === 'p' && /^markets\.|^holds\./.test(t.path || '') && fix && fix.f) {
      // rsi2-pullback, vol-spike-rebound: the stored one-sided p comes from the trade t on the same object.
      rows.push(extract(j, base, { test: t.test, inst, path: t.path.split('.').slice(0, -1).join('.') }, fix));
      continue;
    }
    if (!t.path || !/\./.test(t.path) || t.kind !== 't') {
      rows.push({ ...base, test: t.test, inst, status: 'cannot', why: t.kind === 'p' ? 'decisive test stored as a p or bootstrap probability, no gross / net stream' : `decisive figure only in ${t.path || 'the report'}` });
      continue;
    }
    const parent = t.path.split('.').slice(0, -1 - ((fix && fix.up) || 0)).join('.');
    rows.push(extract(j, base, { test: t.test, inst, path: parent, tNet: fix && fix.fn ? undefined : t.t }, fix));
  }
}
for (const s of LATER) {
  const j = show(s.branch, `research/edge/${s.topic}/result.json`);
  for (const x of s.tests(j)) rows.push(extract(j, s, x));
}

// Demo broker, measured (section 4a).
const sym = show('council-data', 'ctrader/symbols.json');
const demo = { at: sym.at, source: 'origin/council-data ctrader/symbols.json', broker: sym.broker || null, symbols: {} };
for (const [k, v] of Object.entries(sym.symbols || {})) {
  if (!v || !v.spreadTypical || !num(v.bid)) continue;
  demo.symbols[k] = { bid: v.bid, spreadMedian: v.spreadTypical.median, quotes: v.spreadTypical.n, from: v.spreadTypical.from, to: v.spreadTypical.to, commissionRT: v.commissionRT ?? 0, pipPosition: v.pipPosition };
}

// Futures and published-spread sources (section 4b): only figures a committed cost study computed for the same test.
const ifc = show('index-futures-cost', 'research/edge/index-futures-cost/result.json');
const bmf = show('bond-month-end-futures', 'research/edge/bond-month-end-futures/result.json');
const gc = show('gotobi-cost', 'research/edge/gotobi-cost/result.json');
const fut = [];
for (const [k, tk, topic] of [['overnight', 'T1', 'index-overnight'], ['overnight', 'T2', 'index-overnight'], ['ibs', 'T1', 'index-ibs'], ['ibs', 'T2', 'index-ibs'], ['ibs', 'T3', 'index-ibs']]) {
  const d = ifc.studies[k].tests[tk].decisive;
  fut.push({ topic, test: tk, market: ifc.studies[k].tests[tk].market, gross: d.gross, futNet: d.fut, tFut: d.t_fut, cfdNet: d.cfdNet, cfdFin: d.cfdFin ?? null, medStopPct: d.medStopPct ?? null, src: 'index-futures-cost (#900) result.json studies.' + k + '.tests.' + tk + '.decisive' });
}
for (const m of ['spx500', 'nas100', 'us30']) {
  const d = ifc.studies.tom.tests[m]?.oos;
  if (d) fut.push({ topic: 'turn-of-month', test: m, market: ifc.studies.tom.tests[m].market, gross: d.gross, futNet: d.fut, tFut: d.t_fut ?? null, cfdNet: d.cfdNet, cfdFin: d.cfdFin ?? null, medStopPct: d.medStopPct ?? null, src: `index-futures-cost (#900) result.json studies.tom.tests.${m}.oos` });
}
for (const [m, test] of [['usb10y', 'USB10Y'], ['usb30y', 'USB30Y']]) {
  const d = bmf.markets[m].decisive;
  fut.push({ topic: 'bond-month-end', test, market: m, gross: d.gross, futNet: d.net, tFut: d.t, cfdNet: d.cfdNet, src: `bond-month-end-futures (#943) result.json markets.${m}.decisive` });
}
const gcs = gc.streams.usdjpy2016;
const yen = { topic: 'gotobi', test: 'T2', breakEvenPips: gcs.breakEven.netZero, t2Pips: gcs.breakEven.monthT2, publishedSpreadPips: gc.published.usdjpy, sources: gc.sources, src: 'gotobi-cost (#893) result.json streams.usdjpy2016' };

const out = { built: '2026-11-14', scope: 'pull requests #815-#943 (the 13-14 Nov 2026 research days)', notStudies: NOT_STUDIES, rows, demo, futures: fut, yen,
  futureSources: { 'index-futures-cost': ifc.sources, 'index-futures-cost.model': ifc.model ?? null, 'bond-month-end-futures.costModel': bmf.costModel } };
writeFileSync(join(HERE, 'collected.json'), JSON.stringify(out, null, 1) + '\n');
const c = (s) => rows.filter((r) => r.status === s).length;
console.log(rows.length, 'tests:', c('read'), 'read,', c('cannot'), 'cannot be read;', new Set(rows.map((r) => r.topic)).size, 'studies');

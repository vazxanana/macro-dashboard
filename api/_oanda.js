// OANDA instrument names for the page's market keys (shared by bars.js, stream.js, push.js and alert-cron.js).
// One row per market: [page key (lowercase), OANDA instrument, display decimals (OANDA displayPrecision), group].
// Every key below is served by /md/bars (candles), /md/stream (ticks) and the price alerts with the same rate limit (firewall
// /md 900/min per IP), edge caching and candle shape; the weekly daily-cache.yml workflow keeps D1 history of every row in
// council-data research/daily/<key>.json. Keys are stable: research and the page refer to them (de40 = DE30_EUR, spx500 = US500).
// Groups: metal, index, energy, bond, ag, fx. Tested in tests/oanda-symbols.test.mjs.
const LIST = [
  // metals (spot, USD)
  ['xau', 'XAU_USD', 3, 'metal'], ['xag', 'XAG_USD', 4, 'metal'], ['xpt', 'XPT_USD', 3, 'metal'], ['xpd', 'XPD_USD', 3, 'metal'], ['xcu', 'XCU_USD', 5, 'metal'],
  ['xaueur', 'XAU_EUR', 3, 'metal'], ['xaugbp', 'XAU_GBP', 3, 'metal'], ['xauxag', 'XAU_XAG', 3, 'metal'],
  // index CFDs
  ['nas100', 'NAS100_USD', 1, 'index'], ['spx500', 'SPX500_USD', 1, 'index'], ['us30', 'US30_USD', 1, 'index'], ['us2000', 'US2000_USD', 2, 'index'],
  ['de40', 'DE30_EUR', 1, 'index'], ['uk100', 'UK100_GBP', 1, 'index'], ['eu50', 'EU50_EUR', 1, 'index'], ['fr40', 'FR40_EUR', 1, 'index'],
  ['ch20', 'CH20_CHF', 1, 'index'], ['nl25', 'NL25_EUR', 2, 'index'], ['es35', 'ESPIX_EUR', 1, 'index'],
  ['jp225', 'JP225_USD', 1, 'index'], ['au200', 'AU200_AUD', 1, 'index'], ['hk33', 'HK33_HKD', 1, 'index'], ['cn50', 'CN50_USD', 1, 'index'],
  ['sg30', 'SG30_SGD', 1, 'index'], ['in50', 'IN50_USD', 1, 'index'],
  // energies
  ['bco', 'BCO_USD', 3, 'energy'], ['wtico', 'WTICO_USD', 3, 'energy'], ['natgas', 'NATGAS_USD', 3, 'energy'],
  // bonds (CFD price, not yield)
  ['usb02y', 'USB02Y_USD', 3, 'bond'], ['usb05y', 'USB05Y_USD', 3, 'bond'], ['usb10y', 'USB10Y_USD', 3, 'bond'], ['usb30y', 'USB30Y_USD', 3, 'bond'],
  ['de10yb', 'DE10YB_EUR', 3, 'bond'], ['uk10yb', 'UK10YB_GBP', 3, 'bond'],
  // agriculturals
  ['corn', 'CORN_USD', 3, 'ag'], ['wheat', 'WHEAT_USD', 3, 'ag'], ['soybn', 'SOYBN_USD', 3, 'ag'], ['sugar', 'SUGAR_USD', 4, 'ag'],
  // forex majors
  ['eurusd', 'EUR_USD', 5, 'fx'], ['gbpusd', 'GBP_USD', 5, 'fx'], ['audusd', 'AUD_USD', 5, 'fx'], ['nzdusd', 'NZD_USD', 5, 'fx'],
  ['usdjpy', 'USD_JPY', 3, 'fx'], ['usdcad', 'USD_CAD', 5, 'fx'], ['usdchf', 'USD_CHF', 5, 'fx'],
  // forex crosses
  ['eurgbp', 'EUR_GBP', 5, 'fx'], ['eurjpy', 'EUR_JPY', 3, 'fx'], ['eurchf', 'EUR_CHF', 5, 'fx'], ['euraud', 'EUR_AUD', 5, 'fx'], ['eurcad', 'EUR_CAD', 5, 'fx'], ['eurnzd', 'EUR_NZD', 5, 'fx'],
  ['gbpjpy', 'GBP_JPY', 3, 'fx'], ['gbpchf', 'GBP_CHF', 5, 'fx'], ['gbpaud', 'GBP_AUD', 5, 'fx'], ['gbpcad', 'GBP_CAD', 5, 'fx'], ['gbpnzd', 'GBP_NZD', 5, 'fx'],
  ['audjpy', 'AUD_JPY', 3, 'fx'], ['audnzd', 'AUD_NZD', 5, 'fx'], ['audcad', 'AUD_CAD', 5, 'fx'], ['audchf', 'AUD_CHF', 5, 'fx'],
  ['nzdjpy', 'NZD_JPY', 3, 'fx'], ['nzdcad', 'NZD_CAD', 5, 'fx'], ['nzdchf', 'NZD_CHF', 5, 'fx'],
  ['cadjpy', 'CAD_JPY', 3, 'fx'], ['cadchf', 'CAD_CHF', 5, 'fx'], ['chfjpy', 'CHF_JPY', 3, 'fx'],
  // dollar exotics
  ['usdmxn', 'USD_MXN', 5, 'fx'], ['usdzar', 'USD_ZAR', 5, 'fx'], ['usdsek', 'USD_SEK', 5, 'fx'], ['usdnok', 'USD_NOK', 5, 'fx'],
  ['usdsgd', 'USD_SGD', 5, 'fx'], ['usdhkd', 'USD_HKD', 5, 'fx'], ['usdcnh', 'USD_CNH', 5, 'fx'], ['usdtry', 'USD_TRY', 5, 'fx'], ['usdpln', 'USD_PLN', 5, 'fx'],
];
// null prototype: ?sym=constructor / __proto__ / toString must not resolve to Object.prototype members
const SYM = Object.create(null), DEC = Object.create(null), GROUP = Object.create(null);
for (const [k, inst, dec, group] of LIST) { SYM[k] = inst; DEC[k] = dec; GROUP[k] = group; }
module.exports = { SYM, DEC, GROUP, LIST };

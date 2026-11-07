// OANDA instrument names for the page's market keys (shared by bars.js and stream.js)
// null prototype: ?sym=constructor / __proto__ / toString must not resolve to Object.prototype members
const SYM = Object.assign(Object.create(null), { xau: 'XAU_USD', xag: 'XAG_USD', eurusd: 'EUR_USD', gbpusd: 'GBP_USD', audusd: 'AUD_USD', usdcad: 'USD_CAD', usdchf: 'USD_CHF',
  usdjpy: 'USD_JPY', nzdusd: 'NZD_USD', eurjpy: 'EUR_JPY', gbpjpy: 'GBP_JPY', nas100: 'NAS100_USD', spx500: 'SPX500_USD', us30: 'US30_USD', de40: 'DE30_EUR' });
module.exports = { SYM };

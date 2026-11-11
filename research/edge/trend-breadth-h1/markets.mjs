// The pre-registered market list of trend-breadth-h1 (PREREGISTRATION.md): chosen by liquidity and cost before any run.
// cost = round trip as a share of the entry price (the trend-breadth table); sides: 'long' = the live buy rule, 'both' = the
// rule and its mirror (currencies, where "long only" depends on which currency is quoted first).
export const COST = { fx: 0.00015, index: 0.0003, mid: 0.001 };
export const MARKETS = {
  xag: { name: 'Silver', group: 'metals', cost: 'mid', sides: 'long', spot: true },
  nas100: { name: 'Nasdaq 100', group: 'indices', cost: 'index', sides: 'long' },
  spx500: { name: 'S&P 500', group: 'indices', cost: 'index', sides: 'long' },
  us30: { name: 'Dow 30', group: 'indices', cost: 'index', sides: 'long' },
  de40: { name: 'DAX 40', group: 'indices', cost: 'index', sides: 'long' },
  jp225: { name: 'Nikkei 225', group: 'indices', cost: 'index', sides: 'long' },
  eurusd: { name: 'EUR/USD', group: 'forex', cost: 'fx', sides: 'both', spot: true },
  gbpusd: { name: 'GBP/USD', group: 'forex', cost: 'fx', sides: 'both', spot: true },
  usdjpy: { name: 'USD/JPY', group: 'forex', cost: 'fx', sides: 'both', spot: true },
  audusd: { name: 'AUD/USD', group: 'forex', cost: 'fx', sides: 'both', spot: true },
  usdcad: { name: 'USD/CAD', group: 'forex', cost: 'fx', sides: 'both', spot: true },
  wtico: { name: 'WTI crude', group: 'energy', cost: 'mid', sides: 'long' },
  bco: { name: 'Brent crude', group: 'energy', cost: 'mid', sides: 'long' },
};

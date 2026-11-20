// A realistic morning for the daily reports with every hard-data line of 20 Nov 2026 (tests/daily-email-hard.test.mjs):
// a US core PCE day with a nowcast, two Fed events, two Treasury auctions, the Fed odds, GDPNow and their week of readings.
export const T = (iso) => Date.parse(iso) / 1000;
export const now = T('2026-11-25T06:05:00Z');
const h = (t, p, pce, g) => ({ at: new Date(t * 1000).toISOString(), odds: { meeting: '2026-12-09', top: [{ label: 'Hike 25bps', p }, { label: 'Hold', p: 1 - p }] },
  nowcast: [{ month: '2026-10', pce: pce + 0.04, corePce: pce }], gdpnow: { quarter: '2026 Q4', value: g } });
export const hd = {
  nowcast: { months: [{ month: '2026-10', asOf: '2026-11-24', now: { pce: 0.31, corePce: 0.27, cpi: 0.24, coreCpi: 0.21 }, actual: { cpi: 0.35, coreCpi: 0.3 } }] },
  fed: { events: [{ day: '2026-11-25', time: '2:00 p.m.', type: 'Beige', title: 'Beige Book', topic: null },
    { day: '2026-11-25', time: '10:00 a.m.', type: 'Speeches', title: 'Speech - Governor Example', topic: 'Economic outlook' },
    { day: '2026-11-26', time: '9:00 a.m.', type: 'Speeches', title: 'Speech - Vice Chair', topic: null }] },
  auctions: { list: [{ day: '2026-11-25', term: '7-Year', type: 'Note', amount: 44 }, { day: '2026-11-25', term: '2-Year', type: 'FRN', amount: 28 }, { day: '2026-11-25', term: '17-Week', type: 'Bill', amount: 64 }] },
  odds: { meeting: '2026-12-09', line: 'Prediction markets on the 9 Dec Fed decision: Kalshi Hike 25bps 92%, Hold 8%; Polymarket Hike 25bps 92.5%. What traders pay, not a forecast of ours.' },
  gdpnow: { quarter: '2026 Q4', value: 3.21, prev: 3.27 },
  hist: [h(now - 7 * 86400, 0.85, 0.24, 3.4), h(now - 86400, 0.9, 0.26, 3.27), h(now - 1800, 0.92, 0.27, 3.21)],
};
const ev = (title, country, at, impact, forecast, previous, actual) => ({ title, country, at: T(at), impact, forecast, previous, ...(actual ? { actual } : {}) });
export const cache = { cal: [
  ev('CPI y/y', 'AUD', '2026-11-25T00:30:00Z', 'High', '3.6%', '3.5%', '3.8%'),
  ev('Official Cash Rate', 'NZD', '2026-11-25T01:00:00Z', 'High', '2.25%', '2.50%', '2.25%'),
  ev('German ifo Business Climate', 'EUR', '2026-11-25T09:00:00Z', 'Medium', '88.5', '88.4'),
  ev('Core PCE Price Index m/m', 'USD', '2026-11-25T13:30:00Z', 'High', '0.2%', '0.3%'),
  ev('Unemployment Claims', 'USD', '2026-11-25T13:30:00Z', 'High', '225K', '220K'),
  ev('Core Durable Goods Orders m/m', 'USD', '2026-11-25T13:30:00Z', 'Medium', '0.2%', '0.6%'),
  ev('Prelim GDP q/q', 'USD', '2026-11-25T13:30:00Z', 'High', '3.3%', '3.8%'),
  ev('New Home Sales', 'USD', '2026-11-25T15:00:00Z', 'Medium', '710K', '800K'),
  ev('Tokyo Core CPI y/y', 'JPY', '2026-11-26T23:30:00Z', 'High', '2.7%', '2.8%'),
] };
export const fc = { at: '2026-11-25T05:40:00Z',
  regime: { label: 'Dollar Smile left side · stress', smileDetail: 'The dollar is bid on fear, not on growth', vix: 24.6, vixTermRatio: 1.04, realYield: { level: 2.31, chg: 0.08 }, us2y: 4.8, eu2y: 2.41, dxyProxy: 104.32, dxy5d: 0.61, curve10y3m: -0.22, broadUsd20dPct: 1.35 },
  goldScore: { ok: true, score: -0.31 },
  news: [{ src: 'Fed', policy: 1, at: '2026-11-24T19:00:00Z', title: 'Minutes of the Federal Open Market Committee' }],
  assets: { gold: { last: 3547.8, pUp: 0.51, fit: { base: 0.53 }, expMovePct: 1.44 }, eurusd: { last: 1.0412, pUp: 0.49, fit: { base: 0.5 }, expMovePct: 0.52 },
    usdjpy: { last: 158.42, pUp: 0.52, fit: { base: 0.51 }, expMovePct: 0.61 }, nq: { last: 24310.5, pUp: 0.53, fit: { base: 0.55 }, expMovePct: 1.31, volRatio: 1.6 }, es: { last: 7145.6, pUp: 0.5, fit: { base: 0.54 }, expMovePct: 1.12, volRatio: 1.8 } } };
export const vet = { at: '2026-11-25T05:45:00Z',
  summary: { sentence: 'This week: gold is under pressure from higher interest rates and a stronger dollar; the US inflation figures today decide the tone.',
    levels: { mark: { px: 3547.8 }, above: { price: 3600, label: 'round number' }, below: { price: 3496, label: 'last week low' } } },
  research: { items: [{ text: 'Cuts priced: the 2-year sits 45 basis points under the policy rate; in the past that leaned gold up over 20 sessions.' }, { text: 'Funding gauges are quiet: the stress label has no funding-market confirmation.' }, { text: 'Positioning: managed money in gold is at the 12th percentile of three years.' }] } };
export const cot = { at: '2026-11-21T00:00:00Z', markets: [] };

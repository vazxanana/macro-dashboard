// ICT breadth test, part 2 (pre-registered in preregistration.md, committed before this ran): the UNCHANGED desk A-setup rule on the
// nine markets #545 (research/edge/ict-breadth) had to skip because the keyless OANDA proxy did not serve them yet (it does since
// #553): FTSE 100, Nikkei 225, ASX 200, Euro Stoxx 50, Hang Seng, China A50, Russell 2000, platinum and palladium. Same design as
// #545: this file only defines the market universe, the sets and the sensitivities and hands them to #545's harness
// research/edge/ict-breadth/run.mjs (run(), the same desk code: signals/isASetup/isAPlus/sizeOf from ict/tracker.mjs, simulate() from
// ict/replay.mjs, the replay's busy rule, 2008-17 and 2018-26 scored separately, costs x1 / x2 / gross, the drift controls).
//   node research/edge/ict-oos-2008/fetch.mjs <cache> 2007-06-01 2026-11-01 uk100,jp225,au200,eu50,hk33,cn50,us2000,xpt,xpd
//   node research/edge/ict-breadth-2/run.mjs <cache> [result.json]      (trades -> <cache>/breadth2-trades.json)
// Paper research only: nothing live changes.
import { run, UREF } from '../ict-breadth/run.mjs';

const [DIR, OUT = 'research/edge/ict-breadth-2/result.json'] = process.argv.slice(2);
if (!DIR) { console.error('usage: run.mjs <cacheDir> [result.json]'); process.exit(1); }

// Rules as #545: indices get the index rule (the tracker's default for a market without an aRule), metals the gold rule (as the
// tracker's silver shadow market). Costs = one round trip (spread + slippage) in price units: indices 0.02% of price + 1 point
// (#545's DAX model); metals = silver's model (spread + slippage of a third of the spread) scaled to each metal's typical OANDA
// spread, as a share of price because platinum/palladium prices span 3-15x over 2008-26 (preregistration.md).
// m5min 'adaptive' = a UTC day counts as complete for 5m exits when it has >= min(200, 0.9 x that year's median candles a day)
// (these CFDs were quoted 5-14 hours a day in 2008-13 and ~20-23 hours now; coverage probe in preregistration.md).
// ctrl 'both' = the two-sided random-entry drift control (index markets); the gold-rule markets get the buys control as #526/#545.
const idx = (label, short, tick = 0.1, dec = 1) => ({ label, short, tick, dec });
const metal = (label, short) => ({ label, short, tick: 0.01, dec: 3, aRule: 'gold' });
const idxCost = (p) => p * 0.0002 + 1.0;
export const U = {
  uk100:  { set: 'H1', sym: 'uk100',  rule: 'index', M: idx('FTSE 100 (UK100_GBP CFD)', 'UK100'), cost: idxCost, m5min: 'adaptive', ctrl: 'both' },
  jp225:  { set: 'H1', sym: 'jp225',  rule: 'index', M: idx('Nikkei 225 (JP225_USD CFD)', 'JP225'), cost: idxCost, m5min: 'adaptive', ctrl: 'both' },
  au200:  { set: 'H1', sym: 'au200',  rule: 'index', M: idx('ASX 200 (AU200_AUD CFD)', 'AU200'), cost: idxCost, m5min: 'adaptive', ctrl: 'both' },
  eu50:   { set: 'H1', sym: 'eu50',   rule: 'index', M: idx('Euro Stoxx 50 (EU50_EUR CFD)', 'EU50'), cost: idxCost, m5min: 'adaptive', ctrl: 'both' },
  hk33:   { set: 'H1', sym: 'hk33',   rule: 'index', M: idx('Hang Seng (HK33_HKD CFD)', 'HK33'), cost: idxCost, m5min: 'adaptive', ctrl: 'both' },
  cn50:   { set: 'H1', sym: 'cn50',   rule: 'index', M: idx('China A50 (CN50_USD CFD)', 'CN50'), cost: idxCost, m5min: 'adaptive', ctrl: 'both' },
  us2000: { set: 'H1', sym: 'us2000', rule: 'index', M: idx('Russell 2000 (US2000_USD CFD)', 'US2000', 0.01, 2), cost: idxCost, m5min: 'adaptive', ctrl: 'both' },
  xpt:    { set: 'H2', sym: 'xpt',    rule: 'gold',  M: metal('Platinum (XPT_USD spot)', 'XPT'), cost: (p) => p * 0.0030, m5min: 'adaptive' },
  xpd:    { set: 'H2', sym: 'xpd',    rule: 'gold',  M: metal('Palladium (XPD_USD spot)', 'XPD'), cost: (p) => p * 0.0080, m5min: 'adaptive' },
};
// sensitivity (reported only): every new market with the #526 harness's unchanged 200-candle day test (H1 exits on short days)
export const SENS = Object.fromEntries(Object.entries(U).map(([k, u]) => [k + '_m5min200', { ...u, set: 'sens', m5min: 200, base: k, ctrl: undefined }]));
export const SETS = { all: Object.keys(U), H1: Object.keys(U).filter((k) => U[k].set === 'H1'), H2: Object.keys(U).filter((k) => U[k].set === 'H2'), ref: Object.keys(UREF) };

run({ DIR, OUT, U: { ...U, ...UREF }, SENS, SETS, primary: 'all', tradesFile: 'breadth2-trades.json' });

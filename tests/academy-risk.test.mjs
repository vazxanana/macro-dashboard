// node --test tests/academy-risk.test.mjs — MeridianX Academy risk engine (assets/academy-risk.js, MXK): sizing, every block
// reason, the paper account across UTC days, and the prop-firm simulation on the replay lab's own rule sets. Offline, pure.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const MXK = require('../assets/academy-risk.js');
const BT = require('../assets/backtest-engine.js');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const DAY = 86400, MON = Date.UTC(2026, 0, 5, 13) / 1000;   // Monday 5 Jan 2026 13:00 UTC: New York session
const buy = (o = {}) => ({ market: 'xau', side: 'buy', entry: 4000, stop: 3995, target: 4010, t: MON, ...o });
const sell = (o = {}) => ({ market: 'xau', side: 'sell', entry: 4000, stop: 4005, target: 3990, t: MON, ...o });
const acct = (o = {}) => ({ ...MXK.account(100000, { t: MON }), ...o });
const codes = (order, account, limits) => MXK.check(order, account, limits).codes;

test('defaults are conservative and documented: 0.25 % a trade, no emergency stop, the two Academy markets', () => {
  const D = MXK.DEFAULTS;
  assert.equal(D.riskPct, 0.25); assert.equal(D.emergencyStop, false);
  for (const k of ['maxDailyLossPct', 'maxDrawdownPct', 'maxPositions', 'maxCorrelated', 'maxPositionSize']) assert.ok(Number.isFinite(D[k]) && D[k] > 0, k);
  assert.ok(D.maxDailyLossPct <= 2 && D.maxDrawdownPct <= 10 && D.maxPositions <= 5);
  assert.deepEqual(D.allowedInstruments, ['XAUUSD', 'NAS100']); assert.deepEqual(D.allowedSessions, ['asia', 'london', 'newyork']);
  assert.equal(MXK.instrument('xau'), 'XAUUSD'); assert.equal(MXK.instrument('XAU/USD'), 'XAUUSD'); assert.equal(MXK.instrument('nas100'), 'NAS100'); assert.equal(MXK.instrument('NAS100_USD'), 'NAS100');
});

test('sizing at 0.25 %: units = balance x risk % / stop distance, rounded down, capped by notional and by a unit cap', () => {
  const a = acct();
  assert.deepEqual(MXK.size(buy(), a), { units: 50, riskCash: 250, riskPct: 0.25, stopDistance: 5, notional: 200000, capped: false, cappedBy: null });   // 100,000 x 0.25 % = 250; 250 / 5 = 50
  assert.equal(MXK.size(sell(), a).units, 50, 'a sell is sized on the same distance');
  assert.equal(MXK.size(buy({ stop: 3990 }), a).units, 25, 'twice the stop distance, half the size');
  assert.equal(MXK.size(buy(), { ...a, balance: 50000 }).units, 25, 'sized on the balance now');
  const odd = MXK.size(buy({ stop: 3993 }), a); assert.equal(odd.units, 35.71); assert.equal(odd.riskCash, 249.97, 'rounded down (250 / 7 = 35.714...): never above the limit');
  // a 1.00 stop would be 250 units = 1,000,000 notional (10x): capped at 3x the balance
  assert.deepEqual(MXK.size(buy({ stop: 3999 }), a), { units: 75, riskCash: 75, riskPct: 0.075, stopDistance: 1, notional: 300000, capped: true, cappedBy: 'maxPositionSize' });
  assert.equal(MXK.size(buy(), a, { maxUnits: { XAUUSD: 10 } }).units, 10); assert.equal(MXK.size(buy(), a, { maxUnits: { XAUUSD: 10 } }).cappedBy, 'maxUnits');
  assert.equal(MXK.size(buy({ riskPct: 0.1 }), a).units, 20, 'an order may ask for less');
  assert.equal(MXK.size(buy({ riskPct: 2 }), a).units, 50, 'never for more than the limit');
  assert.equal(MXK.size(buy({ stop: 3990 }), a, { riskPct: 0.5 }).units, 50, 'the owner may set another limit');
  assert.equal(MXK.size(buy({ stop: null }), a).units, 0, 'no stop, no size'); assert.equal(MXK.size(buy({ stop: 4001 }), a).units, 0);
  assert.equal(MXK.size({ market: 'nas100', side: 'sell', entry: 25000, stop: 25050, t: MON }, a).units, 5);
});

test('an order inside every limit is allowed, with its size and risk', () => {
  const r = MXK.check(buy(), acct());
  assert.deepEqual(r, { allowed: true, blocks: [], codes: [], size: 50, riskCash: 250, riskPct: 0.25, session: 'newyork', proposed: { units: 50, riskCash: 250, riskPct: 0.25, capped: false, cappedBy: null } });
  assert.equal(MXK.check(sell({ target: null }), acct()).allowed, true, 'a target is optional; a stop is not');
});

test('every block reason', () => {
  const a = acct();
  // the absolute rule: every trade has a stop, on the losing side
  let r = MXK.check(buy({ stop: null }), a); assert.equal(r.allowed, false); assert.deepEqual(r.codes, ['no-stop']); assert.match(r.blocks[0], /every trade has a stop/); assert.equal(r.size, 0); assert.equal(r.riskCash, 0);
  assert.deepEqual(codes(buy({ stop: undefined }), a), ['no-stop']); assert.deepEqual(codes(buy({ stop: 0 }), a), ['no-stop']); assert.deepEqual(codes(buy({ stop: NaN }), a), ['no-stop']);
  r = MXK.check(buy({ stop: 4005 }), a); assert.deepEqual(r.codes, ['stop-wrong-side']); assert.match(r.blocks[0], /below the entry/);
  assert.match(MXK.check(sell({ stop: 3995 }), a).blocks[0], /above the entry/); assert.deepEqual(codes(buy({ stop: 4000 }), a), ['stop-wrong-side'], 'a stop at the entry is no stop');
  assert.deepEqual(codes(buy(), a, { riskPct: 0, maxPositionSize: 0, allowedSessions: null, allowedInstruments: null, maxDailyLossPct: null, maxDrawdownPct: null }).includes('no-stop'), false);
  for (const loose of [{}, { riskPct: 100, maxPositionSize: 1e9, maxPositions: 1e9, maxCorrelated: 1e9, maxDailyLossPct: 100, maxDrawdownPct: 100, allowedSessions: null, allowedInstruments: null }])
    assert.deepEqual(codes(buy({ stop: null }), a, loose), ['no-stop'], 'no limit can switch the stop rule off');
  assert.deepEqual(codes(buy({ target: 3990 }), a), ['target-wrong-side']);
  assert.deepEqual(codes({ market: 'xau', entry: 4000, stop: 3995, t: MON }, a), ['bad-order'], 'no side');
  // risk above the limit: asked as a % or carried by an explicit size
  r = MXK.check(buy({ riskPct: 1 }), a); assert.deepEqual(r.codes, ['risk']); assert.match(r.blocks[0], /risk above the limit: 1% asked, 0\.25% allowed/);
  r = MXK.check(buy({ stop: 3990, units: 50 }), a); assert.deepEqual(r.codes, ['risk']); assert.match(r.blocks[0], /risks 0\.5% of the balance/);
  assert.equal(MXK.check(buy({ units: 50 }), a).allowed, true); assert.equal(MXK.check(buy({ units: 20 }), a).riskCash, 100);
  // daily loss
  r = MXK.check(buy(), acct({ dayPnl: -1000 })); assert.deepEqual(r.codes, ['daily-loss']); assert.match(r.blocks[0], /daily loss limit reached: down 1000 today \(limit 1000/);
  assert.equal(MXK.check(buy(), acct({ dayPnl: -999 })).allowed, true); assert.equal(MXK.check(buy(), acct({ dayPnl: 5000 })).allowed, true, 'a winning day blocks nothing');
  // drawdown from the peak
  r = MXK.check(buy(), acct({ balance: 95000, peak: 100000, dayStart: 95000 })); assert.deepEqual(r.codes, ['drawdown']); assert.match(r.blocks[0], /5% under the peak balance \(limit 5%\)/);
  assert.equal(MXK.check(buy(), acct({ balance: 95001, peak: 100000, dayStart: 95001 })).allowed, true);
  // too many open positions
  const pos = (market, side, id) => ({ id, market, side, units: 1, entry: 100, stop: side === 'buy' ? 99 : 101 });
  r = MXK.check(buy(), acct({ positions: [pos('eurusd', 'buy', 1), pos('nas100', 'buy', 2), pos('usdjpy', 'buy', 3)] })); assert.deepEqual(r.codes, ['max-positions']); assert.match(r.blocks[0], /3 open \(limit 3\)/);
  // correlated exposure: gold longs and dollar shorts are one bet
  r = MXK.check(buy(), acct({ positions: [pos('xau', 'buy', 1), pos('dxy', 'sell', 2)] })); assert.deepEqual(r.codes, ['correlated']); assert.match(r.blocks[0], /short-dollar bet \(buy XAUUSD, sell DXY/);
  assert.deepEqual(codes(buy(), acct({ positions: [pos('eurusd', 'buy', 1), pos('usdjpy', 'sell', 2)] })), ['correlated'], 'a euro long and a dollar-yen short are short-dollar too');
  assert.equal(MXK.check(buy(), acct({ positions: [pos('xau', 'buy', 1)] })).allowed, true, 'two on one bet is the limit');
  assert.equal(MXK.check(buy(), acct({ positions: [pos('xau', 'sell', 1), pos('dxy', 'buy', 2)] })).allowed, true, 'the opposite bet does not count');
  assert.equal(MXK.check(sell(), acct({ positions: [pos('xau', 'buy', 1), pos('dxy', 'sell', 2)] })).allowed, true);
  assert.deepEqual(codes({ market: 'nas100', side: 'buy', entry: 25000, stop: 24950, t: MON }, acct({ positions: [pos('spx500', 'buy', 1), pos('us30', 'buy', 2)] })), ['correlated'], 'US indices together');
  assert.equal(MXK.check({ market: 'nas100', side: 'buy', entry: 25000, stop: 24950, t: MON }, acct({ positions: [pos('xau', 'buy', 1), pos('dxy', 'sell', 2)] })).allowed, true, 'a different group');
  // size above the maximum
  r = MXK.check(buy({ stop: 3999.5, units: 100 }), a); assert.deepEqual(r.codes, ['size']); assert.match(r.blocks[0], /size above the maximum: 100 units asked, 75 allowed/);
  assert.deepEqual(codes(buy({ units: 20 }), a, { maxUnits: { XAUUSD: 10 } }), ['size']);
  assert.deepEqual(codes(buy({ units: -5 }), a), ['bad-order']);
  assert.deepEqual(codes(buy({ stop: 1 }), MXK.account(1, { t: MON })), ['size'], 'a size that rounds to zero is no trade');
  // session and instrument
  const SAT = Date.UTC(2026, 0, 10, 13) / 1000, ASIA = Date.UTC(2026, 0, 6, 2) / 1000, LDN = Date.UTC(2026, 0, 6, 8) / 1000, FRI_LATE = Date.UTC(2026, 0, 9, 22, 30) / 1000, SUN_OPEN = Date.UTC(2026, 0, 11, 22, 30) / 1000;
  assert.deepEqual([MXK.session(MON), MXK.session(ASIA), MXK.session(LDN), MXK.session(SAT), MXK.session(FRI_LATE), MXK.session(SUN_OPEN)], ['newyork', 'asia', 'london', 'closed', 'closed', 'asia']);
  r = MXK.check(buy({ t: SAT }), acct()); assert.deepEqual(r.codes, ['session']); assert.match(r.blocks[0], /closed/);
  r = MXK.check(buy({ t: ASIA }), MXK.account(100000), { allowedSessions: ['london', 'newyork'] }); assert.deepEqual(r.codes, ['session']); assert.match(r.blocks[0], /the asia session is not allowed/);
  assert.equal(MXK.check(buy({ t: LDN }), MXK.account(100000), { allowedSessions: ['london', 'newyork'] }).allowed, true);
  assert.deepEqual(codes(buy({ t: undefined }), MXK.account(100000)), ['session'], 'no decision time: the session cannot be checked');
  r = MXK.check(buy({ market: 'eurusd', entry: 1.1, stop: 1.09, target: 1.12 }), a); assert.deepEqual(r.codes, ['instrument']); assert.match(r.blocks[0], /EURUSD is not an allowed instrument/);
  assert.equal(MXK.check(buy({ market: 'eurusd', entry: 1.1, stop: 1.09, target: 1.12 }), a, { allowedInstruments: ['eurusd'] }).allowed, true);
  // emergency stop
  r = MXK.check(buy(), a, { emergencyStop: true }); assert.deepEqual(r.codes, ['emergency-stop']); assert.match(r.blocks[0], /emergency stop is on/); assert.equal(r.size, 0);
  // several reasons at once are all listed, in plain words
  r = MXK.check(buy({ stop: null, market: 'btc' }), acct({ dayPnl: -2000 }), { emergencyStop: true, allowedSessions: ['london'] });
  assert.deepEqual(r.codes, ['emergency-stop', 'no-stop', 'instrument', 'session', 'daily-loss']); assert.equal(r.blocks.length, 5); for (const b of r.blocks) assert.equal(typeof b, 'string');
  assert.deepEqual(codes(buy(), { balance: 0 }).includes('no-balance'), true);
});

test('the paper account: balance, day P&L on UTC days, peak and drawdown; the daily limit resets with the day', () => {
  let a = MXK.account(100000); assert.equal(a.balance, 100000); assert.equal(a.peak, 100000); assert.equal(a.day, null); assert.deepEqual(a.positions, []);
  const frozen = JSON.stringify(a);
  a = MXK.apply(a, { net: -250, closedAt: MON }); assert.equal(JSON.stringify(MXK.account(100000)), frozen, 'apply returns a new account');
  assert.deepEqual([a.balance, a.day, a.dayPnl, a.drawdown, a.trades], [99750, '2026-01-05', -250, 250, 1]);
  a = MXK.apply(a, { R: -1, riskCash: 250, closedAt: MON + 3600 }); a = MXK.apply(a, { netR: -1, riskCash: 250, exitT: MON + 7200 }); a = MXK.apply(a, { net: -250, closedAt: MON + 9000 });
  assert.deepEqual([a.balance, a.dayPnl, a.drawdown, a.drawdownPct], [99000, -1000, 1000, 1]);
  assert.deepEqual(codes(buy({ t: MON + 9100 }), a), ['daily-loss'], 'four full losses: done for the day');
  // 23:59 UTC is still Monday; 00:00 UTC is a new day and a new daily budget, measured from the balance at the day's start
  const lateMon = Date.UTC(2026, 0, 5, 23, 59) / 1000, tue = Date.UTC(2026, 0, 6, 0, 0) / 1000;
  assert.deepEqual(codes(buy({ t: lateMon }), a), ['daily-loss']);
  assert.equal(MXK.check(buy({ t: tue }), a).allowed, true, 'the account still says Monday, the order is on Tuesday');
  assert.equal(MXK.check(buy({ t: tue }), a).size, 49.5, 'sized on the smaller balance: 99,000 x 0.25 % / 5');
  a = MXK.roll(a, tue); assert.deepEqual([a.day, a.dayStart, a.dayPnl, a.balance], ['2026-01-06', 99000, 0, 99000]);
  a = MXK.apply(a, { net: 600, closedAt: tue + 3600 }); assert.deepEqual([a.balance, a.dayPnl, a.drawdown, a.peak], [99600, 600, 400, 100000]);
  a = MXK.apply(a, { net: 900, closedAt: tue + DAY }); assert.deepEqual([a.day, a.dayStart, a.dayPnl, a.balance, a.peak, a.drawdown], ['2026-01-07', 99600, 900, 100500, 100500, 0]);
  assert.equal(a.maxDrawdown, 1000); assert.equal(a.maxDrawdownPct, 1, 'the worst drawdown is remembered after the recovery');
  // a slide over several days: no day breaks the daily limit, the drawdown limit stops it
  let b = MXK.account(100000);
  for (let d = 0; d < 6; d++) for (let i = 0; i < 3; i++) b = MXK.apply(b, { net: -300, closedAt: MON + d * DAY + i * 600 });
  assert.equal(b.balance, 94600); assert.equal(b.dayPnl, -900); assert.equal(b.drawdownPct, 5.4);
  assert.deepEqual(codes(buy({ t: MON + 5 * DAY + 3600 }), b, { allowedSessions: null }), ['drawdown']);
  // open positions: tracked, closed by id, and never without a stop
  let p = MXK.open(MXK.account(100000), { id: 'a', market: 'xau', side: 'buy', units: 50, entry: 4000, stop: 3995, t: MON });
  p = MXK.open(p, { id: 'b', market: 'XAU_USD', side: 'buy', units: 10, entry: 4001, stop: 3996, t: MON });
  assert.equal(p.positions.length, 2); assert.equal(p.positions[1].market, 'XAUUSD'); assert.deepEqual(codes(buy(), p), ['correlated']);
  p = MXK.apply(p, { id: 'a', net: 500, closedAt: MON + 600 }); assert.deepEqual(p.positions.map((x) => x.id), ['b']); assert.equal(MXK.check(buy(), p).allowed, true);
  assert.throws(() => MXK.open(p, { market: 'xau', side: 'buy', units: 1, entry: 4000 }), /every trade has a stop/);
  assert.throws(() => MXK.open(p, { market: 'xau', side: 'sell', units: 1, entry: 4000, stop: 3990 }), /wrong side/);
  assert.throws(() => MXK.apply(p, { closedAt: MON }), /net/);
});

test('prop-firm simulation: the rule sets are the replay lab\'s own objects, played with the lab\'s own rule code', () => {
  assert.equal(MXK.FIRMS, BT.FIRMS, 'the same array: no firm number is copied or invented');
  assert.ok(!/ftmo|topstep|fundingpips|lucid/i.test(src('assets/academy-risk.js')), 'no firm is named in the risk engine');
  assert.ok(!/0\.10|0\.05|100000 *,|50000/.test(src('assets/academy-risk.js').split('// ---- prop-firm simulation')[1]), 'no rule number in the simulation code');
  const F = BT.FIRMS.find((f) => f.id === 'ftmo2'), start = F.size, target = F.phases[0].target * start, daily = F.dailyLoss * start, max = F.maxLoss * start;
  // a steady run: one win of a tenth of the phase-1 target a day passes phase 1, then phase 2
  const wins = Array.from({ length: 40 }, (_, i) => ({ net: target / 10, closedAt: MON + i * DAY }));
  let r = MXK.propSim(wins.slice(0, 5), F);
  assert.equal(r.status, 'in-progress'); assert.equal(r.phaseName, F.phases[0].name); assert.equal(r.progress.pct, 50); assert.equal(r.tradingDays, 5); assert.deepEqual(r.breaches, []); assert.match(r.text, /^Still in .*50% of the way to the target/);
  r = MXK.propSim(wins.slice(0, 12), 'ftmo2');
  assert.deepEqual(r.phasesPassed, [F.phases[0].name]); assert.equal(r.phase, 1); assert.equal(r.status, 'in-progress'); assert.equal(r.progress.balance, start + 2 * target / 10, 'phase 2 starts again from the start balance'); assert.match(r.text, /passed/);
  r = MXK.propSim(wins, F);
  assert.equal(r.status, 'passed'); assert.equal(r.passed, true); assert.deepEqual(r.phasesPassed, F.phases.map((p) => p.name)); assert.equal(r.tradesUsed, 15); assert.equal(r.tradesTotal, 40); assert.match(r.text, /^Passed: .* completed in 15 trades\.$/);
  // the target in fewer days than the minimum: not passed yet, and it says why
  r = MXK.propSim([{ net: target / 2, closedAt: MON }, { net: target / 2, closedAt: MON + DAY }], F);
  assert.equal(r.status, 'in-progress'); assert.match(r.text, /more trading days? needed/); assert.equal(r.progress.minDays, F.minDays);
  // daily loss: one day down by more than the limit
  r = MXK.propSim([{ net: -(daily / 2), closedAt: MON }, { net: -(daily / 2) - 1, closedAt: MON + 3600 }, { net: 99999, closedAt: MON + DAY }], F);
  assert.equal(r.status, 'failed'); assert.equal(r.failed, true); assert.equal(r.breaches.length, 1); assert.equal(r.breaches[0].rule, 'daily-loss'); assert.equal(r.breaches[0].day, '2026-01-05'); assert.equal(r.tradesUsed, 2, 'nothing after the breach counts');
  assert.match(r.text, /^Failed in .* after 2 trades: daily loss limit/);
  // maximum loss: under the daily limit every day, through the floor in the end
  const slide = Array.from({ length: 6 }, (_, i) => ({ net: -(daily * 0.6), closedAt: MON + i * DAY }));
  r = MXK.propSim(slide, F); assert.equal(r.status, 'failed'); assert.equal(r.breaches[0].rule, 'max-loss'); assert.equal(r.tradesUsed, Math.ceil(max / (daily * 0.6))); assert.match(r.text, /maximum loss/);
  // trades given in R are sized at the Academy's risk % of the firm's start balance; order in the list does not matter
  r = MXK.propSim([{ R: 2, closedAt: MON + DAY }, { netR: -1, exitT: MON }], F);
  assert.equal(r.riskPct, 0.25); assert.equal(r.balance, start + (2 - 1) * start * 0.0025); assert.equal(r.tradesUsed, 2);
  assert.equal(MXK.propSim([{ R: 2, closedAt: MON }], F, { riskPct: 1 }).balance, start + 2 * start * 0.01);
  assert.equal(MXK.propSim([], F).status, 'in-progress'); assert.match(MXK.propSim([], F).text, /^Not started/);
  assert.throws(() => MXK.propSim(wins, 'no-such-firm'), /unknown prop-firm rule set/); assert.throws(() => MXK.propSim(wins, {}), /unknown prop-firm rule set/);
  assert.equal(JSON.stringify(BT.FIRMS.find((f) => f.id === 'ftmo2')), JSON.stringify(F), 'the rule set is not changed by a run');
});

test('prop-firm simulation: consistency and a trailing drawdown, on a rule set that has them', () => {
  const F = BT.FIRMS.find((f) => f.consistency > 0 && f.dd === 'eod'), start = F.size, target = F.phases[0].target * start, max = F.maxLoss * start;
  // the whole target in one day: reached, but one day is all of the profit
  let r = MXK.propSim([{ net: target + 10, closedAt: MON }, { net: 10, closedAt: MON + DAY }, { net: 10, closedAt: MON + 2 * DAY }], F);
  assert.equal(r.status, 'in-progress'); assert.equal(r.breaches.length, 1); assert.equal(r.breaches[0].rule, 'consistency'); assert.equal(r.breaches[0].fatal, false); assert.match(r.breaches[0].text, /best day is \d+% of the profit/); assert.match(r.text, /best day/);
  // spread over enough days: passed
  const n = Math.ceil(1 / F.consistency) + 2;
  r = MXK.propSim(Array.from({ length: n }, (_, i) => ({ net: target / n + 1, closedAt: MON + i * DAY })), F);
  assert.equal(r.status, 'passed'); assert.deepEqual(r.breaches, []);
  // the floor trails the end-of-day balance: profit first, then a loss smaller than the first floor distance still fails
  r = MXK.propSim([{ net: max / 2, closedAt: MON }, { net: -max / 2, closedAt: MON + DAY }, { net: -max / 2 - 1, closedAt: MON + 2 * DAY }], F);
  assert.equal(r.status, 'failed'); assert.equal(r.breaches[0].rule, 'max-loss'); assert.match(r.breaches[0].text, /trailing drawdown/); assert.ok(r.balance > start - max, 'still above the first floor: it trailed up');
  // a custom rule set of the same shape works too
  r = MXK.propSim([{ net: 600, closedAt: MON }, { net: 600, closedAt: MON + DAY }], { name: 'Mine', size: 10000, phases: [{ name: 'Only', target: 0.1 }], dailyLoss: 0.05, maxLoss: 0.1, dd: 'static', minDays: 0, maxDays: 0, consistency: 0, dayStartUtc: 0 });
  assert.equal(r.status, 'passed'); assert.equal(r.firm.id, 'custom');
});

test('deterministic, dependency-free, a browser global, and apart from everything that trades', () => {
  const s = src('assets/academy-risk.js');
  const a = acct({ positions: [{ id: 1, market: 'xau', side: 'buy', units: 1, entry: 4000, stop: 3990 }] }), o = buy(), before = JSON.stringify([a, o, MXK.DEFAULTS]);
  assert.deepEqual(MXK.check(o, a), MXK.check(o, a)); assert.equal(JSON.stringify([a, o, MXK.DEFAULTS]), before, 'check changes nothing it is given');
  assert.ok(!/Date\.now|new Date\(\)|Math\.random|fetch\(|XMLHttpRequest|WebSocket|localStorage|process\.env/.test(s), 'no clock, no randomness, no network, no environment');
  assert.equal(s.match(/council\/|council-data|ctrader|mt5\/|\bapi\/|tradovate|oanda|placeOrder|sendOrder|submitOrder|createOrder|OrderSend|ProtoOA/i), null);
  assert.deepEqual([...s.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]), ['./backtest-engine.js'], 'the only file it loads is the replay lab engine (the rule sets)');
  // in a browser: no module system, BT loaded by the page (in either order), MXK on the global
  const ctx = vm.createContext({}); vm.runInContext(s, ctx);
  assert.equal(typeof ctx.MXK.check, 'function'); assert.throws(() => ctx.MXK.FIRMS, /backtest-engine\.js is not loaded/);
  vm.runInContext(src('assets/backtest-engine.js'), ctx);
  assert.equal(ctx.MXK.FIRMS.length, BT.FIRMS.length); assert.equal(ctx.MXK.check(buy(), ctx.MXK.account(100000)).size, 50);
  assert.equal(ctx.MXK.propSim([{ net: -99999, closedAt: MON }], 'ftmo2').status, 'failed');
});

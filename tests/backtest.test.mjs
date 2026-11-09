// node --test tests/backtest.test.mjs — the Backtest lab engine (assets/backtest-engine.js): fills, stops, stats, prop-firm rules
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const BT = createRequire(import.meta.url)('../assets/backtest-engine.js');
const bar = (time, o, h, l, c) => ({ time, open: o, high: h, low: l, close: c });
const H = 3600, T0 = Date.UTC(2026, 0, 5, 8) / 1000;   // Mon 5 Jan 2026 08:00 UTC

test('a market buy with stop and target: sized by risk, closed at the target, R and net right', () => {
  const a = BT.newAccount(100000, { commission: 5 });
  const u = BT.units(1000, 100, 99); assert.equal(u, 1000);
  const p = BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 99, target: 102, units: u }, T0);
  assert.equal(a.positions.length, 1); assert.equal(p.entry, 100);
  assert.deepEqual(BT.onBar(a, bar(T0 + H, 100.2, 101, 99.5, 100.8)), []);
  const ev = BT.onBar(a, bar(T0 + 2 * H, 100.8, 102.5, 100.6, 102.2));
  assert.equal(ev[0].kind, 'close'); assert.equal(ev[0].trade.reason, 'target'); assert.equal(ev[0].trade.R, 2); assert.equal(ev[0].trade.net, 1995); assert.equal(a.balance, 101995);
  assert.equal(ev[0].trade.mfe, 2.5); assert.equal(ev[0].trade.mae, 0.5);
});
test('never without a stop; stop on the wrong side refused; worst case when stop and target sit in one bar; a gap fills at the open', () => {
  const a = BT.newAccount(10000);
  assert.throws(() => BT.place(a, { side: 'sell', type: 'market', price: 50, units: 10 }, T0), /stop/);
  assert.throws(() => BT.place(a, { side: 'sell', type: 'market', price: 50, stop: 49, units: 10 }, T0), /losing side/);
  BT.place(a, { side: 'sell', type: 'market', price: 50, stop: 51, target: 48, units: 10 }, T0);
  let ev = BT.onBar(a, bar(T0 + H, 50, 51.5, 47.5, 49)); assert.equal(ev[0].trade.reason, 'stop (both in one bar)'); assert.equal(ev[0].trade.net, -10);
  const b = BT.newAccount(10000, { slFirst: false }); BT.place(b, { side: 'sell', type: 'market', price: 50, stop: 51, target: 48, units: 10 }, T0);
  ev = BT.onBar(b, bar(T0 + H, 50, 51.5, 47.5, 49)); assert.equal(ev[0].trade.reason, 'target (both in one bar)'); assert.equal(ev[0].trade.net, 20);
  const c = BT.newAccount(10000); BT.place(c, { side: 'buy', type: 'market', price: 50, stop: 49, target: 55, units: 10 }, T0);
  ev = BT.onBar(c, bar(T0 + H, 47, 48, 46, 47.5)); assert.equal(ev[0].trade.reason, 'stop (gap)'); assert.equal(ev[0].trade.exit, 47); assert.equal(ev[0].trade.net, -30);
});
test('limit and stop orders fill when touched or gapped through; spread is paid on entry; cancel works', () => {
  const a = BT.newAccount(10000, { spread: 0.1 });
  const lim = BT.place(a, { side: 'buy', type: 'limit', price: 98, stop: 97, target: 101, units: 10 }, T0); assert.equal(a.orders.length, 1);
  assert.deepEqual(BT.onBar(a, bar(T0 + H, 100, 101, 99, 100.5)), []);
  let ev = BT.onBar(a, bar(T0 + 2 * H, 99, 99.5, 97.8, 99.2)); assert.equal(ev[0].kind, 'fill'); assert.equal(ev[0].pos.entry, 98.1); assert.equal(a.orders.length, 0);
  const b = BT.newAccount(10000); BT.place(b, { side: 'sell', type: 'stop', price: 95, stop: 96, target: 90, units: 10 }, T0);
  ev = BT.onBar(b, bar(T0 + H, 94, 94.5, 92, 93)); assert.equal(ev[0].kind, 'fill'); assert.equal(ev[0].pos.entry, 94, 'gapped through: filled at the open');
  const c = BT.newAccount(10000); const o = BT.place(c, { side: 'buy', type: 'limit', price: 90, stop: 89, units: 1 }, T0); BT.cancel(c, o.id); assert.equal(c.orders.length, 0);
});
test('stats: win rate, profit factor, expectancy, drawdown, streaks, by weekday', () => {
  const closed = [{ net: 200, R: 2, openedAt: T0, closedAt: T0 + H, side: 'buy', reason: 'target', mfe: 2, mae: 0.3 }, { net: -100, R: -1, openedAt: T0 + 2 * H, closedAt: T0 + 3 * H, side: 'sell', reason: 'stop', mfe: 0.2, mae: 1 },
    { net: -100, R: -1, openedAt: T0 + 86400, closedAt: T0 + 86400 + H, side: 'buy', reason: 'stop', mfe: 0.5, mae: 1 }, { net: 300, R: 3, openedAt: T0 + 2 * 86400, closedAt: T0 + 2 * 86400 + H, side: 'buy', reason: 'manual', mfe: 3.2, mae: 0.1 }];
  const s = BT.stats(closed, 10000);
  assert.equal(s.n, 4); assert.equal(s.winRate, 0.5); assert.equal(s.net, 300); assert.equal(s.netR, 3); assert.equal(s.profitFactor, 2.5); assert.equal(s.expectancy, 75);
  assert.equal(s.maxDD, 200); assert.equal(s.bestStreak, 1); assert.equal(s.worstStreak, 2); assert.equal(s.byWeekday[1].n, 2); assert.equal(s.returnPct, 3);
  assert.deepEqual(BT.byDay(closed), { '2026-01-05': 100, '2026-01-06': -100, '2026-01-07': 300 });
});
test('FTMO rules: daily loss fails, max loss fails, target needs the minimum days, two phases then funded', () => {
  const F = BT.FIRMS.find((f) => f.id === 'ftmo2');
  // daily loss: 5% of 100k = 5,000 in one day
  let a = BT.newAccount(100000), ch = BT.newChallenge(F);
  BT.evaluate(ch, a, 100, T0); a.balance = 95000; BT.evaluate(ch, a, 100, T0 + H);
  assert.equal(ch.status, 'failed'); assert.match(ch.reason, /daily loss/);
  // max loss: 2,500 a day over 4 days -> at 90,000 fails
  a = BT.newAccount(100000); ch = BT.newChallenge(F);
  for (let d = 0; d < 4; d++) { BT.evaluate(ch, a, 100, T0 + d * 86400); a.balance -= 2500; BT.evaluate(ch, a, 100, T0 + d * 86400 + H); }
  assert.equal(ch.status, 'failed'); assert.match(ch.reason, /maximum loss/);
  // target in 2 days: waits for 4 trading days, then phase 2, then funded
  a = BT.newAccount(100000); ch = BT.newChallenge(F);
  const tradeDay = (d, net) => { const t = T0 + d * 86400; BT.evaluate(ch, a, 100, t); a.balance = BT.r2(a.balance + net); a.closed.push({ net, closedAt: t + H, openedAt: t }); BT.evaluate(ch, a, 100, t + H); };
  tradeDay(0, 6000); tradeDay(1, 4500); assert.equal(ch.status, 'live'); assert.match(ch.progress.waiting, /2 more trading days/);
  tradeDay(2, 100); tradeDay(3, 100); assert.equal(ch.status, 'live'); assert.equal(ch.phase, 1, 'phase 2 begins'); assert.equal(a.balance, 100000, 'the verification account starts fresh');
  for (let d = 4; d < 8; d++) tradeDay(d, 1500);
  assert.equal(ch.status, 'funded'); assert.equal(ch.history.filter((h) => h.event === 'passed').length, 2);
});
test('Topstep rules: trailing EOD drawdown locks at the start balance; consistency holds the pass', () => {
  const F = BT.FIRMS.find((f) => f.id === 'ts50'); let a = BT.newAccount(50000), ch = BT.newChallenge(F);
  // day 1 ends at 51,000: the floor trails to 49,000 next day; a drop to 49,000 then fails
  BT.evaluate(ch, a, 100, T0); a.balance = 51000; BT.evaluate(ch, a, 100, T0 + H);
  BT.evaluate(ch, a, 100, T0 + 86400); assert.equal(ch.progress.floor, 49000);
  a.balance = 49000; BT.evaluate(ch, a, 100, T0 + 86400 + H); assert.equal(ch.status, 'failed'); assert.match(ch.reason, /trailing drawdown/);
  // the floor never rises above the start balance
  a = BT.newAccount(50000); ch = BT.newChallenge(F); BT.evaluate(ch, a, 100, T0); a.balance = 54000; BT.evaluate(ch, a, 100, T0 + H); BT.evaluate(ch, a, 100, T0 + 86400); assert.equal(ch.progress.floor, 50000);
  // consistency: one day with 2,900 of a 3,000 profit is 97% > 50%: target reached but not passed
  a = BT.newAccount(50000); ch = BT.newChallenge(F);
  const day = (d, net) => { const t = T0 + d * 86400; BT.evaluate(ch, a, 100, t); a.balance += net; a.closed.push({ net, closedAt: t + H, openedAt: t }); BT.evaluate(ch, a, 100, t + H); };
  day(0, 2900); day(1, 150); assert.equal(ch.status, 'live'); assert.match(ch.progress.waiting, /best day/);
  for (let d = 2; d < 6; d++) day(d, 800); assert.equal(ch.status, 'funded');
});

test('partial close books its own record and leaves the rest running; a trailing stop follows the highs and never retreats', () => {
  const a = BT.newAccount(10000); const p = BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 99, target: 104, units: 100 }, T0);
  const c = BT.closePartial(a, p, 101, T0 + H, 0.5); assert.equal(c.net, 50); assert.equal(c.R, 0.5, 'half the size at +1R'); assert.equal(c.Rmove, 1); assert.equal(p.units, 50); assert.equal(a.balance, 10050); assert.equal(a.positions.length, 1); assert.match(c.note, /50% closed/);
  p.trail = 1.5; BT.onBar(a, bar(T0 + 2 * H, 101, 102.5, 100.8, 102)); assert.equal(p.stop, 101, 'stop trails to high - 1.5');
  BT.onBar(a, bar(T0 + 3 * H, 102, 102.2, 101.5, 101.8)); assert.equal(p.stop, 101, 'never backwards');
  const ev = BT.onBar(a, bar(T0 + 4 * H, 101.8, 101.9, 100.5, 100.7)); assert.equal(ev[0].trade.reason, 'stop'); assert.equal(ev[0].trade.exit, 101); assert.equal(ev[0].trade.net, 50);
  const s = BT.stats(a.closed, 10000); assert.equal(s.n, 1, 'one trade'); assert.equal(s.netR, 1); assert.equal(s.holdAvg, 3); assert.deepEqual(s.rDist, { '1..2R': 1 });
});

test('Monte Carlo: a winning edge passes often, a losing one fails; daily loss and trailing rules bite; seeded and stable', () => {
  const good = [2, -1, 2, -1, 2, -1, -1, 3, -1, 2], bad = [1, -1, -1, -1, 1, -1, -1, 2, -1, -1];
  const g = BT.monteCarlo(good, { risk: 0.01, target: 0.10, maxLoss: 0.10, dailyLoss: 0.05, perDay: 2, n: 1500, seed: 3 });
  const b = BT.monteCarlo(bad, { risk: 0.01, target: 0.10, maxLoss: 0.10, dailyLoss: 0.05, perDay: 2, n: 1500, seed: 3 });
  assert.ok(g.pass > 0.8, `good passes ${g.pass}`); assert.ok(b.fail > 0.8, `bad fails ${b.fail}`); assert.equal(g.pass + g.fail + g.unfinished, 1);
  assert.deepEqual(BT.monteCarlo(good, { seed: 3, n: 500 }), BT.monteCarlo(good, { seed: 3, n: 500 }), 'same seed, same answer');
  const big = BT.monteCarlo(good, { risk: 0.03, target: 0.10, maxLoss: 0.10, dailyLoss: 0.05, perDay: 3, n: 1500, seed: 3 });
  assert.ok(big.failDaily > 0, 'three 3% losers in a day breach a 5% daily limit');
  const trail = BT.monteCarlo(good, { risk: 0.01, target: 0.06, maxLoss: 0.03, dd: 'eod', perDay: 2, n: 1500, seed: 3 }), stat = BT.monteCarlo(good, { risk: 0.01, target: 0.06, maxLoss: 0.03, dd: 'static', perDay: 2, n: 1500, seed: 3 });
  assert.ok(trail.fail >= stat.fail, 'a trailing floor never fails less than a static one');
  assert.equal(BT.monteCarlo([1, 2], {}), null, 'too few trades');
  const br = BT.bestRisk(good, { target: 0.10, maxLoss: 0.10, dailyLoss: 0.05, perDay: 2, seed: 3 }); assert.ok(br.risk > 0 && br.pass >= g.pass - 0.05);
});
test('Monte Carlo fan and risk curve are recording only: same answer with or without them', () => {
  const R = [2, -1, -1, 1.5, -1, 2, -1, 0.5, -1, 3], o = { risk: 0.01, target: 0.10, maxLoss: 0.10, dailyLoss: 0.05, perDay: 2, n: 1200, seed: 11 };
  const plain = BT.monteCarlo(R, o), { fan, ...rest } = BT.monteCarlo(R, { ...o, fan: 60 });
  assert.deepEqual(rest, plain, 'the fan does not change the simulation');
  assert.equal(fan.steps, 60); for (const p of [5, 25, 50, 75, 95]) assert.equal(fan.p[p].length, 60);
  for (let i = 0; i < 60; i++) { assert.ok(fan.p[5][i] <= fan.p[25][i] && fan.p[25][i] <= fan.p[50][i] && fan.p[50][i] <= fan.p[75][i] && fan.p[75][i] <= fan.p[95][i], 'percentiles ordered'); if (i) assert.ok(fan.done[i] >= fan.done[i - 1], 'finished share only grows'); }
  assert.ok(fan.p[5][59] >= -10.5 - 3 && fan.p[95][59] <= 10 + 3, 'paths stop at the floor / target (plus one trade)');
  assert.ok([-1, 0.5].includes(fan.p[50][0]), 'after one trade the median is one draw at 1% risk');
  const br = BT.bestRisk(R, { ...o, n: 600 }); assert.equal(br.curve.length, 9);
  assert.equal(br.pass, Math.max(...br.curve.map((c) => c.pass)), 'the best risk is the top of the curve');
  assert.equal(br.fan, undefined, 'no fan in the scan');
});
test('stats split by trading session and by mistake tag', () => {
  const H = 3600, d = Date.UTC(2026, 0, 6) / 1000;
  const closed = [{ net: 100, R: 1, openedAt: d + 8 * H, closedAt: d + 9 * H, side: 'buy', mistakes: [] }, { net: -100, R: -1, openedAt: d + 14 * H, closedAt: d + 15 * H, side: 'sell', mistakes: ['FOMO'] },
    { net: -50, R: -0.5, openedAt: d + 2 * H, closedAt: d + 3 * H, side: 'buy', mistakes: ['FOMO', 'Moved stop'] }];
  const s = BT.stats(closed, 10000);
  assert.equal(s.bySession.London.n, 1); assert.equal(s.bySession['New York'].net, -100); assert.equal(s.bySession.Asia.n, 1);
  assert.equal(s.byMistake.FOMO.n, 2); assert.equal(s.byMistake.FOMO.R, -1.5); assert.equal(s.byMistake.none.n, 1); assert.equal(s.byMistake['Moved stop'].n, 1);
});

// ---- correctness audit (9 Nov 2026): hand-computed expectations ------------------------------------------------------
test('stop and target in one bar that opened through the stop: exit at the open (worse than the stop)', () => {
  const a = BT.newAccount(10000); BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 99, target: 102, units: 10 }, T0);
  const ev = BT.onBar(a, bar(T0 + H, 98, 102.5, 97, 101)); // opened 98 under the 99 stop, then ran to 102.5
  assert.equal(ev[0].trade.exit, 98); assert.equal(ev[0].trade.net, -20); assert.equal(ev[0].trade.R, -2);
});
test('a bar that opens beyond the target takes the target even if it later reaches the stop (the order is known)', () => {
  const a = BT.newAccount(10000); BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 99, target: 102, units: 10 }, T0);
  const ev = BT.onBar(a, bar(T0 + H, 103, 103.5, 98.5, 99)); assert.equal(ev[0].trade.exit, 102); assert.equal(ev[0].trade.net, 20);
});
test('commission is charged once per trade, split across partial closes', () => {
  const a = BT.newAccount(10000, { commission: 10 }); const p = BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 99, units: 100 }, T0);
  assert.equal(BT.closePartial(a, p, 101, T0 + H, 0.5).net, 45); assert.equal(BT.close(a, p, 101, T0 + 2 * H, 'manual').net, 45);
  assert.equal(a.balance, 10090);
});
test('a scaled-out trade counts once in the stats and its R is size-weighted (half at +2R, half at -1R = +0.5R)', () => {
  const a = BT.newAccount(10000); const p = BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 99, units: 100 }, T0);
  BT.closePartial(a, p, 102, T0 + H, 0.5); BT.onBar(a, bar(T0 + 2 * H, 101, 101.2, 98.5, 99));
  assert.equal(a.balance, 10050); const s = BT.stats(a.closed, 10000);
  assert.equal(s.n, 1); assert.equal(s.netR, 0.5); assert.equal(s.net, 50); assert.equal(s.winRate, 1);
  assert.deepEqual(BT.trades(a.closed).map((t) => t.R), [0.5]);
});
test('daily loss counts a drop on the first bar of a new day (reference = previous day-end equity)', () => {
  const F = BT.FIRMS.find((f) => f.id === 'ftmo2'), a = BT.newAccount(100000), ch = BT.newChallenge(F);
  BT.evaluate(ch, a, 100, T0); a.balance = 95000; BT.evaluate(ch, a, 100, T0 + 86400);
  assert.equal(ch.status, 'failed'); assert.match(ch.reason, /daily loss/);
});
test('the rules see the worst equity inside the bar, not only the close', () => {
  const F = BT.FIRMS.find((f) => f.id === 'ftmo2'), a = BT.newAccount(100000), ch = BT.newChallenge(F);
  BT.evaluate(ch, a, 100, T0); BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 90, units: 1000 }, T0);
  BT.evaluate(ch, a, 99, T0 + H, bar(T0 + H, 100, 100.5, 94.9, 99));   // low 94.9: equity 94,900, down 5,100
  assert.equal(ch.status, 'failed'); assert.match(ch.reason, /daily loss/);
});
test('phase 2 does not inherit phase-1 trades closed on the same day', () => {
  const F = BT.FIRMS.find((f) => f.id === 'ftmo2'), a = BT.newAccount(100000), ch = BT.newChallenge(F);
  const tradeDay = (d, net) => { const t = T0 + d * 86400; BT.evaluate(ch, a, 100, t); a.balance = BT.r2(a.balance + net); a.closed.push({ net, closedAt: t + H, openedAt: t }); BT.evaluate(ch, a, 100, t + H); };
  tradeDay(0, 6000); tradeDay(1, 4500); tradeDay(2, 100); tradeDay(3, 100); assert.equal(ch.phase, 1);
  BT.evaluate(ch, a, 100, T0 + 3 * 86400 + 2 * H); const d = Object.values(ch.days)[0];
  assert.equal(d.trades, 0); assert.equal(d.net, 0); assert.equal(ch.progress.tradingDays, 0);
});

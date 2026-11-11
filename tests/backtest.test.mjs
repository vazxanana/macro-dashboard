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

// ---- changing the replay's timeframe in the middle of a session (11 Nov 2026) --------------------------------------------
// One-minute candles from a seeded walk (with a weekend-like hole), every other timeframe aggregated from them the way the
// candle proxy serves them: UTC-aligned, a candle of `sec` seconds covers [time, time + sec).
const M = 60, D0 = Date.UTC(2026, 0, 5) / 1000;   // Mon 5 Jan 2026 00:00 UTC
function walk(n, seed = 7, hole = null) { let a = seed >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = []; let px = 2000; for (let i = 0; i < n; i++) { const time = D0 + i * M; const o = px, c = +(o + (rnd() - 0.5) * 1.6).toFixed(2), h = +(Math.max(o, c) + rnd() * 0.5).toFixed(2), l = +(Math.min(o, c) - rnd() * 0.5).toFixed(2); px = c; if (hole && time >= hole[0] && time < hole[1]) continue; out.push({ time, open: o, high: h, low: l, close: c, volume: 1 + Math.floor(rnd() * 9) }); } return out; }
function agg(m1, sec) { const out = []; for (const b of m1) { const t = Math.floor(b.time / sec) * sec, k = out[out.length - 1]; if (k && k.time === t) { k.high = Math.max(k.high, b.high); k.low = Math.min(k.low, b.low); k.close = b.close; k.volume += b.volume; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }); } return out; }
const SECS = { '1m': 60, '2m': 120, '5m': 300, '10m': 600, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400 };
const M1 = walk(6 * 1440, 11, [D0 + 20 * 3600, D0 + 22 * 3600]), SER = Object.fromEntries(Object.entries(SECS).map(([k, s]) => [k, agg(M1, s)]));
// what the page does at a switch, with the candles of every timeframe at hand: seat the moment T on the new series
function seatOn(tf, T, series = SER) { const sec = SECS[tf], bars = series[tf].map((b) => ({ ...b })), plan = BT.tfPlan(bars, sec, T); let seat = { idx: plan.closed, part: null };
  if (plan.straddle >= 0) { const full = bars[plan.straddle], g = BT.tfFineSec(sec, full.time, T), gtf = Object.keys(SECS).find((k) => SECS[k] === g); seat = BT.tfPart(full, plan.straddle, sec, T, series[gtf].filter((b) => b.time >= full.time && b.time < full.time + sec), g); }
  BT.tfSeat(bars, seat.part); return { tf, sec, bars, idx: seat.idx, part: seat.part }; }
// one step, as the page's step(): the rest of a forming candle, else the next bar
function stepOn(V, a, ch = null) { const seq = BT.tfNext(V.bars, V.idx, V.part); if (!seq.length) return []; const ev = BT.advance(a, ch, seq); if (V.part) { BT.tfUnseat(V.bars, V.part); V.part = null; } else V.idx++; return ev; }
const visible = (V) => V.bars.slice(0, V.idx);
const m1Range = (from, to) => M1.filter((b) => b.time >= from && b.time < to);
const hiLo = (bs) => ({ high: Math.max(...bs.map((b) => b.high)), low: Math.min(...bs.map((b) => b.low)), open: bs[0].open, close: bs[bs.length - 1].close });

test('timeframe switch: the moment is the end of the last replayed bar; the plan counts the bars that ended by it', () => {
  const b15 = SER['15m'], T = BT.tfMoment(b15, 40, 900, null); assert.equal(T, b15[39].time + 900);
  for (const tf of Object.keys(SECS)) { const p = BT.tfPlan(SER[tf], SECS[tf], T), bars = SER[tf];
    assert.ok(bars.slice(0, p.closed).every((b) => b.time + SECS[tf] <= T), tf + ': closed bars ended by the moment');
    assert.ok(bars.slice(p.closed + (p.straddle >= 0 ? 1 : 0)).every((b) => b.time >= T), tf + ': the rest starts at or after it');
    if (p.straddle >= 0) { const s = bars[p.straddle]; assert.ok(s.time < T && s.time + SECS[tf] > T, tf + ': the forming bar contains the moment'); } }
  assert.equal(BT.tfPlan(b15, 900, T).straddle, -1); assert.equal(BT.tfPlan(b15, 900, T).closed, 40);
  assert.equal(BT.tfMoment(b15, 40, 900, { T: 123 }), 123, 'a forming candle carries its own moment');
});

test('timeframe switch: the finer timeframe tiles both halves of the cut candle', () => {
  assert.equal(BT.tfFineSec(3600, D0, D0 + 900), 900); assert.equal(BT.tfFineSec(3600, D0, D0 + 1500), 300); assert.equal(BT.tfFineSec(600, D0 + 600, D0 + 900), 300);
  assert.equal(BT.tfFineSec(300, D0, D0 + 120), 60, '2m to 5m is cut on one-minute candles'); assert.equal(BT.tfFineSec(86400, D0, D0 + 13 * 3600 + 25 * 60), 300);
  assert.equal(BT.tfFineSec(86400, D0, D0 + 4 * 3600), 14400); assert.equal(BT.tfFineSec(60, D0, D0 + 30), 0, 'nothing finer than a minute');
  for (const [k, sec] of Object.entries(SECS)) for (let T = D0 + 60; T < D0 + 86400; T += 60 * 7) { const s = Math.floor(T / sec) * sec; if (s === T) continue; const g = BT.tfFineSec(sec, s, T); assert.ok(g >= 60 && sec % g === 0 && (T - s) % g === 0, k); }
});

test('timeframe switch to a HIGHER timeframe mid-candle: the candle shows as forming from replayed prices only; no future data', () => {
  for (const [lo, hi, n] of [['5m', '15m', 200], ['5m', '1h', 500], ['15m', '4h', 70], ['1m', '5m', 333], ['2m', '5m', 501], ['10m', '15m', 100], ['15m', '1d', 150], ['1m', '1d', 2000]]) {
    const T = BT.tfMoment(SER[lo], n, SECS[lo], null), V = seatOn(hi, T), sec = SECS[hi];
    assert.ok(V.part, `${lo} → ${hi}: a candle is forming`); const f = V.bars[V.idx - 1], seen = hiLo(m1Range(V.part.full.time, T));
    assert.equal(f.forming, true); assert.equal(f.time, V.part.full.time); assert.deepEqual({ open: f.open, high: f.high, low: f.low, close: f.close }, seen, `${lo} → ${hi}: the forming candle is exactly what was replayed`);
    assert.equal(f.close, SER[lo][n - 1].close, 'the last price does not move at a switch');
    assert.ok(visible(V).every((b) => b.forming || b.time + sec <= T), 'every other visible candle ended by the moment');
    assert.ok(V.part.rest.every((b) => b.time >= T && b.time < f.time + sec) && V.part.rest[0].time >= T, 'what is left to process starts at the moment');
    // the proof: change every price from the moment on and the screen is the same
    const fut = Object.fromEntries(Object.keys(SECS).map((k) => [k, agg(M1.map((b) => (b.time >= T ? { ...b, open: b.open + 500, high: b.high + 900, low: b.low + 100, close: b.close + 500 } : b)), SECS[k])]));
    assert.deepEqual(visible(seatOn(hi, T, fut)), visible(V), `${lo} → ${hi}: nothing on screen depends on a price after the moment`);
  }
});

test('timeframe switch to a LOWER timeframe: only candles that closed by the moment; no future data; unaligned pairs form honestly', () => {
  for (const [hi, lo, n] of [['15m', '5m', 77], ['1h', '1m', 30], ['4h', '15m', 9], ['1d', '1h', 2], ['15m', '10m', 51], ['5m', '2m', 301], ['15m', '2m', 33]]) {
    const T = BT.tfMoment(SER[hi], n, SECS[hi], null), V = seatOn(lo, T), sec = SECS[lo];
    assert.ok(visible(V).every((b) => b.forming || b.time + sec <= T), `${hi} → ${lo}: closed candles only`);
    assert.equal(visible(V)[V.idx - 1].close, SER[hi][n - 1].close, `${hi} → ${lo}: the last price does not move`);
    if (T % sec === 0) { assert.equal(V.part, null, `${hi} → ${lo}: aligned, nothing forming`); assert.equal(V.bars[V.idx].time >= T, true); }
    else { assert.ok(V.part && V.part.T === T, `${hi} → ${lo}: the lower candle that contains the moment is forming`); const seen = hiLo(m1Range(V.part.full.time, T)), f = V.part.formed; assert.deepEqual({ open: f.open, high: f.high, low: f.low, close: f.close }, seen); }
    const fut = Object.fromEntries(Object.keys(SECS).map((k) => [k, agg(M1.map((b) => (b.time >= T ? { ...b, open: 1, high: 2, low: 0.5, close: 1 } : b)), SECS[k])]));
    assert.deepEqual(visible(seatOn(lo, T, fut)), visible(V), `${hi} → ${lo}: nothing on screen depends on a price after the moment`);
  }
});

test('timeframe switch: the account is untouched, and stepping the forming candle equals stepping the lower timeframe (each price once)', () => {
  const lo = '5m', hi = '1h', n = SER['5m'].findIndex((b, i) => i > 400 && (b.time + 300) % 3600 === 300) + 1, T = BT.tfMoment(SER[lo], n, 300, null), px = SER[lo][n - 1].close;
  const mk = () => { const a = BT.newAccount(100000, { commission: 2 }); BT.place(a, { side: 'buy', type: 'market', price: px, stop: px - 1.1, target: px + 2.2, units: 100 }, SER[lo][n - 1].time); BT.place(a, { side: 'sell', type: 'market', price: px, stop: px + 0.9, target: px - 3, units: 50 }, SER[lo][n - 1].time).trail = 0.9;
    BT.place(a, { side: 'buy', type: 'limit', price: px - 0.6, stop: px - 2, target: px + 2, units: 10 }, SER[lo][n - 1].time); BT.place(a, { side: 'sell', type: 'stop', price: px - 0.8, stop: px + 1, target: px - 4, units: 10 }, SER[lo][n - 1].time); return a; };
  const A = mk(), B = mk(), chA = BT.newChallenge(BT.FIRMS[0]), chB = BT.newChallenge(BT.FIRMS[0]), before = JSON.stringify(B);
  const V = seatOn(hi, T); assert.equal(JSON.stringify(B), before, 'seating the moment on another timeframe changes nothing in the account');
  assert.ok(V.part && V.part.g === 300);
  // A stays on 5m and steps to the end of the hour; B is on the hour and takes ONE step
  const VA = { bars: SER[lo], idx: n, part: null }, end = V.part.full.time + 3600; const evA = []; while (VA.idx < VA.bars.length && VA.bars[VA.idx].time < end) evA.push(...stepOn(VA, A, chA));
  const evB = stepOn(V, B, chB);
  assert.deepEqual(JSON.parse(JSON.stringify(B)), JSON.parse(JSON.stringify(A)), 'same positions, orders, stops, targets, MFE / MAE, hold, closed trades and balance');
  assert.deepEqual(JSON.parse(JSON.stringify(chB)), JSON.parse(JSON.stringify(chA)), 'same challenge state');
  assert.equal(evB.length, evA.length); assert.ok(evB.length > 0, 'the path really did something (fills or exits)');
  assert.equal(V.part, null); assert.equal(V.bars[V.idx - 1].forming, undefined, 'the full candle took the forming one\'s place');
  assert.deepEqual(V.bars[V.idx - 1], SER[hi][V.idx - 1]); assert.equal(BT.tfMoment(V.bars, V.idx, 3600, V.part), end, 'the moment is now the end of that candle');
  assert.equal(BT.tfMoment(V.bars, V.idx, 3600, null), BT.tfMoment(VA.bars, VA.idx, 300, null));
});

test('timeframe switch: a stop hit in the rest of the forming candle is taken once; one hit before the switch is not taken again', () => {
  // find a 15m bar in the middle of an hour and a stop that only the REST of the hour reaches
  const b15 = SER['15m']; let done = 0;
  for (let n = 30; n < b15.length - 8 && done < 12; n++) { const T = BT.tfMoment(b15, n, 900, null); if (T % 3600 !== 900) continue; const V = seatOn('1h', T); if (!V.part) continue;
    const px = b15[n - 1].close, restLow = Math.min(...V.part.rest.map((b) => b.low)), stop = +(restLow + 0.05).toFixed(2); if (!(stop < px - 0.2)) continue; done++;
    const a = BT.newAccount(100000); BT.place(a, { side: 'buy', type: 'market', price: px, stop, units: 10 }, b15[n - 1].time);
    const ev = stepOn(V, a).filter((e) => e.kind === 'close'); assert.equal(ev.length, 1, 'closed once'); assert.match(ev[0].trade.reason, /^stop/); assert.ok(ev[0].trade.exit <= stop);
    assert.ok(ev[0].trade.closedAt >= T, 'the exit is stamped inside the rest of the candle, never before the moment');
    for (let k = 0; k < 5; k++) assert.equal(stepOn(V, a).filter((e) => e.kind === 'close').length, 0); assert.equal(a.closed.length, 1); assert.equal(a.positions.length, 0);
    // switching straight back down after the stop: nothing left to take, nothing re-opened
    const V2 = seatOn('15m', BT.tfMoment(V.bars, V.idx, 3600, V.part)); for (let k = 0; k < 4; k++) stepOn(V2, a); assert.equal(a.closed.length, 1); }
  assert.ok(done >= 3, 'cases found: ' + done);
  // a low made BEFORE the moment (inside the formed part) must not fill an order placed at the moment, nor stop a position opened at it
  let seen = 0;
  for (let n = 30; n < b15.length - 8 && seen < 12; n++) { const T = BT.tfMoment(b15, n, 900, null); if (T % 3600 !== 2700) continue; const V = seatOn('1h', T); if (!V.part) continue;
    const f = V.part.formed, restLow = Math.min(...V.part.rest.map((b) => b.low)), px = f.close; if (!(f.low < restLow - 0.3 && f.low < px - 0.3)) continue; seen++;
    const level = +(f.low + 0.1).toFixed(2); assert.ok(level < restLow && level < px);
    const a = BT.newAccount(100000); BT.place(a, { side: 'buy', type: 'limit', price: level, stop: level - 5, units: 1 }, f.time); BT.place(a, { side: 'buy', type: 'market', price: px, stop: level, units: 1 }, f.time);
    const ev = stepOn(V, a); assert.equal(ev.length, 0, 'the earlier low is in the full candle but was replayed before the order existed'); assert.equal(a.orders.length, 1); assert.equal(a.positions.length, 1);
    assert.ok(V.bars[V.idx - 1].low <= level, 'the full candle does hold that low: processing it whole would have been wrong'); }
  assert.ok(seen >= 2, 'cases found: ' + seen);
});

test('timeframe switch: stops are never dropped or loosened; a chain of switches up and down keeps one account and one moment', () => {
  const order = ['15m', '5m', '1h', '10m', '4h', '2m', '15m', '1d', '1m', '30m', '2h', '5m']; let V = { tf: '15m', sec: 900, bars: SER['15m'].map((b) => ({ ...b })), idx: 120, part: null };
  const a = BT.newAccount(100000), ch = BT.newChallenge(BT.FIRMS[0]); let px = V.bars[V.idx - 1].close; BT.place(a, { side: 'buy', type: 'market', price: px, stop: px - 40, target: px + 60, units: 5 }, V.bars[V.idx - 1].time).trail = 40; BT.place(a, { side: 'sell', type: 'limit', price: px + 30, stop: px + 70, units: 2 }, V.bars[V.idx - 1].time);
  let Tprev = BT.tfMoment(V.bars, V.idx, V.sec, V.part);
  for (const tf of order) { const T = BT.tfMoment(V.bars, V.idx, V.sec, V.part); assert.ok(T >= Tprev, 'the moment never goes back'); Tprev = T;
    const snap = JSON.stringify(a), stops = a.positions.map((p) => p.stop).concat(a.orders.map((o) => o.stop));
    V = seatOn(tf, T); assert.equal(JSON.stringify(a), snap, tf + ': the switch itself changes nothing'); assert.equal(BT.tfMoment(V.bars, V.idx, V.sec, V.part), T, tf + ': same moment after the switch');
    assert.ok(visible(V).every((b) => b.forming || b.time + V.sec <= T)); assert.equal(V.bars[V.idx - 1].close, m1Range(0, T).pop().close, tf + ': the last price is the last replayed price');
    assert.deepEqual(a.positions.map((p) => p.stop).concat(a.orders.map((o) => o.stop)), stops); assert.ok(a.positions.every((p) => p.stop > 0) && a.orders.every((o) => o.stop > 0), 'every trade keeps its stop');
    const s0 = a.positions[0] ? a.positions[0].stop : null; for (let k = 0; k < 3; k++) stepOn(V, a, ch); if (s0 != null && a.positions[0]) assert.ok(a.positions[0].stop >= s0, 'a trailed stop only tightens'); }
  assert.equal(a.closed.length + a.positions.length + a.orders.length, 2, 'no trade lost, none doubled');
});

test('timeframe switch: a hole in the data (weekend) never makes a candle form from nothing or lose its rest', () => {
  const holeFrom = D0 + 20 * 3600, holeTo = D0 + 22 * 3600, b5 = SER['5m'];
  // moment = the last 5m bar before the hole ends at 20:00; on 4h (16:00-20:00) that is the bar's edge: nothing forms
  const n = b5.findIndex((b) => b.time >= holeFrom), T = BT.tfMoment(b5, n, 300, null); assert.equal(T, holeFrom); assert.equal(seatOn('4h', T).part, null);
  // on 1d the day is forming, and its rest starts after the hole
  const Vd = seatOn('1d', T); assert.ok(Vd.part && Vd.part.rest[0].time >= T && Vd.part.rest[0].open === m1Range(holeTo, holeTo + 60)[0].open, 'the rest opens with the first trade after the hole');
  // a moment inside a 2h candle whose first half is the hole (20:00-22:00 missing, 22:00-24:00 traded): 30 minutes in
  const T2 = holeTo + 1800, V4 = seatOn('4h', T2); assert.ok(V4.part); assert.equal(V4.part.formed.open, m1Range(holeTo, T2)[0].open);
  // rest empty → the candle is complete; formed empty → it is wholly ahead
  const full = { time: D0, open: 1, high: 2, low: 0.5, close: 1.5 }, f = (t) => ({ time: t, open: 1, high: 1, low: 1, close: 1 });
  assert.deepEqual(BT.tfPart(full, 7, 3600, D0 + 1800, [f(D0), f(D0 + 900)], 900), { idx: 8, part: null }); assert.deepEqual(BT.tfPart(full, 7, 3600, D0 + 1800, [f(D0 + 1800)], 900), { idx: 7, part: null });
  assert.throws(() => BT.tfPart(full, 7, 3600, D0 + 1000, [f(D0), f(D0 + 900)], 900), /crosses the replay moment/);
  assert.throws(() => BT.tfEnter(SER['1h'], 3600, D0 + 5400), /finer candles/, 'a forming candle is never guessed without finer candles');
});

test('timeframe switch: too many candles is refused with a count; saved sessions from before the switch still load', () => {
  const st = D0 + 86400, W = BT.tfWindow(st, st + 10 * 86400, 60, 40000); assert.equal(W.ok, true); assert.equal(W.from, st - 300 * 60); assert.equal(W.n, 14700);
  const W2 = BT.tfWindow(st, st + 30 * 86400, 60, 40000); assert.equal(W2.ok, false); assert.equal(W2.n, 43500); assert.equal(BT.tfWindow(st, st + 120 * 86400, 300, 40000).ok, true);
  const b15 = SER['15m'];
  // an old session: { idx } and no moment → the same index as before, capped at what was fetched
  assert.deepEqual(BT.tfResume({ idx: 44, tf: '15m' }, b15, 900), { idx: 44, straddle: -1, T: b15[43].time + 900 }); assert.equal(BT.tfResume({ idx: 99999 }, b15, 900).idx, b15.length);
  // a new one saved on a full bar: the moment gives the same index; saved while a candle was forming: the forming bar is named
  assert.equal(BT.tfResume({ idx: 44, mom: b15[43].time + 900 }, b15, 900).idx, 44);
  const r = BT.tfResume({ idx: 9, mom: D0 + 9 * 3600 + 1500 }, SER['1h'], 3600); assert.equal(r.straddle, 9); assert.equal(r.idx, 9);
  const V = seatOn('1h', D0 + 9 * 3600 + 1500); assert.equal(V.idx, 10); assert.equal(V.part.g, 300); assert.equal(V.part.rest.length, 7);
});

test('advance: one bar through it equals onBar + evaluate + the breach close the page has always done', () => {
  const b15 = SER['15m'], px = b15[99].close, mk = () => { const a = BT.newAccount(100000); BT.place(a, { side: 'buy', type: 'market', price: px, stop: px - 0.5, target: px + 1, units: 20000 }, b15[99].time); BT.place(a, { side: 'buy', type: 'market', price: px, stop: px - 30, units: 20000 }, b15[99].time); return a; };
  const A = mk(), B = mk(), chA = BT.newChallenge(BT.FIRMS[0]), chB = BT.newChallenge(BT.FIRMS[0]);
  for (let i = 100; i < 260; i++) { const b = b15[i], ev = BT.onBar(A, b); BT.evaluate(chA, A, b.close, b.time, b); if (chA.status === 'failed' && (A.positions.length || A.orders.length)) { for (const q of A.positions.slice()) BT.close(A, q, b.close, b.time, 'challenge breach'); A.orders = []; }
    const evB = BT.advance(B, chB, [b]); assert.equal(evB.filter((e) => !e.breach).length, ev.length); }
  assert.deepEqual(JSON.parse(JSON.stringify(B)), JSON.parse(JSON.stringify(A))); assert.deepEqual(JSON.parse(JSON.stringify(chB)), JSON.parse(JSON.stringify(chA))); assert.ok(A.closed.length >= 1);
});

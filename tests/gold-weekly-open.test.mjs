// research/edge/gold-weekly-open: the weekly open as a level on gold (offline; hand-made candles, the report against result.json)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { place, weeksOf, atrOf, manage, netOf, limitFill, trendTrade, magnetTrade, trades, holm, monthT, H, SPREAD, SLIP, ATR_N } from '../research/edge/gold-weekly-open/run.mjs';
import { FIN } from '../council/fills.mjs';

const U = (s) => Date.parse(s) / 1000;
const bar = (wd, o, h, l, c, t = 0) => ({ t, o, h, l, c, wd, min: 600 });

test('place: New York trading week, Sunday 18:00 opens it, shut hours dropped', () => {
  // 14 Nov 2026 calendar: Sunday 8 Nov 2026 18:00 New York = 23:00 UTC (EST)
  const sun = place(U('2026-11-08T23:00:00Z')), mon = place(U('2026-11-09T15:00:00Z')), fri = place(U('2026-11-13T20:00:00Z'));
  assert.equal(sun.wd, 0); assert.equal(mon.wd, 1); assert.equal(fri.wd, 5);
  assert.equal(sun.week, mon.week); assert.equal(fri.week, mon.week);
  assert.equal(place(U('2026-11-08T22:00:00Z')), null, 'Sunday 17:00 New York is before the open');
  assert.equal(place(U('2026-11-13T22:00:00Z')), null, 'Friday 17:00 New York is the weekend');
  assert.equal(place(U('2026-11-14T15:00:00Z')), null, 'Saturday');
  assert.equal(place(U('2026-11-26T19:00:00Z')), null, 'Thanksgiving afternoon is an early close (cmeShut)');
});

test('weeksOf: W0 is the first candle open, exit is the last candle before Friday 16:00 New York', () => {
  const t0 = U('2026-11-08T23:00:00Z'), rows = [];
  for (let k = 0; k < 120; k++) { const t = t0 + k * H; rows.push([t, 100 + k, 101 + k, 99 + k, 100.5 + k]); }
  const [w] = weeksOf(rows);
  assert.equal(w.W0, 100); assert.equal(w.ok, true);
  const ex = w.bars[w.exitIdx];
  assert.equal(new Date(ex.t * 1000).toISOString(), '2026-11-13T20:00:00.000Z', 'the 15:00-16:00 New York candle');
});

test('atrOf reads only completed weeks before this one', () => {
  const weeks = Array.from({ length: 20 }, (_, i) => ({ H: 110 + i, L: 90 + i, C: 100 + i }));
  assert.equal(atrOf(weeks, ATR_N), null);
  const a = atrOf(weeks, 18); weeks[18].H = 1e6; weeks[19].L = -1e6;
  assert.equal(atrOf(weeks, 18), a, 'changing this week and later weeks leaves its ATR');
  assert.equal(a, 20);
});

test('limitFill and manage: fill at min(open, limit), stop first, gapped stop at the open, target, time exit', () => {
  const b = [bar(2, 100, 101, 99, 100), bar(2, 97, 98, 96, 97), bar(3, 97, 99, 93, 94)];
  assert.deepEqual(limitFill(b, 0, 2, 1, 98), { k: 1, fill: 97 }, 'already under the limit: filled at the open');
  assert.equal(limitFill(b, 0, 0, 1, 98), null);
  const s = manage(b, 1, 1, 97, 95, null, 2); assert.equal(s.how, 'stop'); assert.equal(s.exit, 95); assert.equal(s.R, -1);
  const g = manage([bar(2, 100, 100, 99, 99), bar(3, 90, 91, 89, 90)], 0, 1, 100, 95, null, 1); assert.equal(g.exit, 90, 'gap through the stop fills at the open');
  const t = manage([bar(1, 100, 100, 99, 99), bar(1, 99, 101, 98.5, 100.5)], 0, 1, 99.5, 98, 101, 1); assert.equal(t.how, 'target'); assert.equal(t.exit, 101);
  const tf = manage([bar(1, 100, 102, 99, 99)], 0, 1, 99.5, 98, 101, 0); assert.equal(tf.how, 'time', 'no target on the fill candle');
  const tm = manage([bar(2, 100, 101, 99.5, 100), bar(5, 100, 101, 99.5, 100.7)], 0, 1, 100, 98, null, 1); assert.equal(tm.how, 'time'); assert.equal(tm.exit, 100.7);
  // costs: spread always, slippage on stop / time exits only, financing on buys
  const x = { side: -1, R: 1, how: 'target', risk: 10, entry: 100, nights: 2 };
  assert.equal(netOf(x), 1 - SPREAD / 10);
  assert.equal(netOf({ ...x, how: 'time' }), 1 - (SPREAD + SLIP) / 10);
  assert.ok(Math.abs(netOf({ ...x, side: 1, how: 'time' }) - (1 - (SPREAD + SLIP) / 10 - 2 * FIN.xau.long * 100 / 10)) < 1e-12);
  assert.ok(Math.abs(netOf({ ...x, how: 'time' }, 2) - (1 - 2 * (SPREAD + SLIP) / 10)) < 1e-12);
});

test('T1 / T2: only after a prior week of the same direction, only Tuesday-Wednesday, every trade has a stop', () => {
  const up = { W0: 100, C: 110 }, dn = { W0: 110, C: 100 };
  const wk = { bars: [bar(0, 100, 101, 90, 100), bar(1, 100, 100, 99, 99), bar(2, 99, 99, 96, 97), bar(3, 97, 98, 96, 97.5), bar(5, 97.5, 99, 97, 98.5)], exitIdx: 4 };
  const t = trendTrade(wk, up, 12, 1);   // limit 100 - 3 = 97; Sunday's 90 is before the window
  assert.equal(t.entry, 97); assert.equal(t.stop, 91); assert.ok(t.stop < t.entry); assert.equal(t.how, 'time'); assert.equal(t.exit, 98.5);
  assert.equal(trendTrade(wk, dn, 12, 1), null, 'a down prior week gives no buy');
  assert.equal(trendTrade(wk, up, 12, -1), null, 'an up prior week gives no sell');
  const s = trendTrade({ bars: [bar(0, 110, 110, 109, 110), bar(2, 110, 114, 109, 113), bar(3, 113, 113.5, 112, 113), bar(5, 113, 113, 111, 112)], exitIdx: 3 }, dn, 12, -1);
  assert.equal(s.entry, 113); assert.equal(s.stop, 119); assert.ok(s.stop > s.entry);
  // no look-ahead: a later candle cannot change the fill or the stop
  const wk2 = structuredClone(wk); wk2.bars[4].c = 200; wk2.bars[4].h = 200;
  const t2 = trendTrade(wk2, up, 12, 1); assert.equal(t2.entry, t.entry); assert.equal(t2.stop, t.stop);
});

test('T3: first limit wins, both in one candle skips, target the open', () => {
  const wk = { bars: [bar(0, 100, 100.5, 99.5, 100), bar(1, 100, 100.2, 94, 95), bar(2, 95, 101, 95, 100.5), bar(5, 100, 100, 99, 99.5)], exitIdx: 3 };
  const x = magnetTrade(wk, 10);   // buy limit 95, sell limit 105, stop 90, target 100
  assert.equal(x.side, 1); assert.equal(x.entry, 95); assert.equal(x.stop, 90); assert.equal(x.how, 'target'); assert.equal(x.exit, 100); assert.equal(x.R, 1);
  assert.deepEqual(magnetTrade({ bars: [bar(0, 100, 106, 94, 100), bar(5, 100, 100, 99, 100)], exitIdx: 1 }, 10), { skip: 'both in one candle' });
  assert.equal(magnetTrade({ bars: [bar(0, 100, 101, 99, 100), bar(4, 100, 120, 80, 100), bar(5, 100, 100, 99, 100)], exitIdx: 2 }, 10), null, 'Thursday is outside the window');
});

test('placebo anchors stay inside the allowed candles and are seeded', () => {
  const t0 = U('2026-01-04T23:00:00Z'), rows = [];
  for (let k = 0; k < 24 * 7 * 20; k++) { const t = t0 + k * H; const p = 100 + 10 * Math.sin(k / 9); rows.push([t, p, p + 2, p - 2, p + 0.5]); }
  const weeks = weeksOf(rows), mk = (s) => { let a = s; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; };
  for (const name of ['T1', 'T2', 'T3']) assert.deepEqual(trades(weeks, name, mk(7)).map((x) => x.entryT), trades(weeks, name, mk(7)).map((x) => x.entryT));
  for (const x of trades(weeks, 'T3')) assert.ok(x.side > 0 ? x.stop < x.entry : x.stop > x.entry);
});

test('statistics: Holm, month sums', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const T = [{ side: -1, R: 1, how: 'target', risk: 1e9, entry: 1, nights: 0, exitT: U('2021-01-10T00:00:00Z') }, { side: -1, R: 1, how: 'target', risk: 1e9, entry: 1, nights: 0, exitT: U('2021-03-10T00:00:00Z') }];
  assert.equal(monthT(T, U('2021-01-01T00:00:00Z'), U('2021-03-31T00:00:00Z')).months, 3, 'empty months count');
});

test('the report agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-weekly-open/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-weekly-open/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.ok(Object.values(r.tests).every((x) => !x.pass));
  const line = md.match(/\*\*Verdict: (.+?)\*\*/)[1]; assert.ok(line.length < 220 && /^FAIL/.test(line));
  const sg = (v, d = 3) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(d);
  for (const [k, x] of Object.entries(r.tests)) {
    for (const w of ['is', 'oos']) {
      const s = x[w]; assert.ok(md.includes(`| ${s.n} | ${sg(r.tests[k].gross[w].avg)} | ${sg(s.avg)} | ${s.pf.toFixed(2)} |`), `${k} ${w} row`);
      assert.ok(md.includes(`| ${s.tMonth.toFixed(2)} |`), `${k} ${w} t`);
    }
    assert.ok(md.includes(`${x.placebo.beat}; median ${sg(x.placebo.median)}`) || md.includes(`(${x.placebo.beat}; median ${sg(x.placebo.median)})`), `${k} placebo`);
  }
  assert.ok(line.includes(`n ${r.tests.T1.oos.n}`) && line.includes(`t ${r.tests.T1.oos.tMonth}`) && line.includes(`${r.tests.T1.placebo.beat} of 40`));
  assert.ok(/Holm p 0\.85/.test(line) && r.tests.T1.holmP.toFixed(2) === '0.85');
});

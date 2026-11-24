// vb-calendar-days: result figures, gates, and the calendar labels (offline, no candles).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tomSet, weekdayOf, monthDiff, ranks, kwH, kwPerm } from '../research/edge/vb-calendar-days/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-calendar-days/result.json', import.meta.url)));

test('verdict, gates and key figures', () => {
  assert.match(R.verdict, /^FAIL, 0 of 4/);
  assert.equal(R.tests.filter((t) => t.pass).length, 0);
  for (const m of ['xau', 'usdjpy']) assert.equal(R.markets[m].gate.ok, true, m);
  const g = R.markets.xau.tom;
  assert.equal(g.conf.tom.n, 407); assert.equal(g.conf.t, 1.89); assert.equal(g.disc.t, 2.81);
  assert.equal(R.tests.find((t) => t.id === 'T1').pHolm, 0.2414);
  assert.equal(R.tests.find((t) => t.id === 'T1').checks.confT, false);
  const md = fs.readFileSync(new URL('../research/edge/vb-calendar-days/RESULT.md', import.meta.url), 'utf8');
  assert.match(md.split('\n')[2], /Verdict: FAIL, 0 of 4/);
});

test('turn of the month labels: last built day of a complete month + first three', () => {
  const days = ['2024-01-29', '2024-01-30', '2024-01-31', '2024-02-01', '2024-02-02', '2024-02-05', '2024-02-06', '2024-02-07'].map((day) => ({ day }));
  const s = tomSet(days, '2024-02-06');
  assert.deepEqual([...s].sort(), ['2024-01-29', '2024-01-30', '2024-01-31', '2024-02-01', '2024-02-02', '2024-02-05']);
  // labels come from the day list alone; the incomplete month's last day is never TOM
  assert.equal(s.has('2024-02-07'), false);
  assert.equal(weekdayOf('2024-02-05'), 0); assert.equal(weekdayOf('2024-02-02'), 4);
});

test('monthly difference and Kruskal-Wallis', () => {
  const tr = [{ day: '2024-01-02', net: 1 }, { day: '2024-01-10', net: 0 }, { day: '2024-02-01', net: 2 }, { day: '2024-02-12', net: 1 }, { day: '2024-03-12', net: 1 }];
  assert.deepEqual(monthDiff(tr, (x) => x.day.slice(8) <= '02'), [1, 1]);
  assert.deepEqual(ranks([3, 1, 3, 2]), [3.5, 1, 3.5, 2]);
  const net = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], g = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  assert.ok(kwH(ranks(net), g) > 8);
  assert.ok(kwPerm(net, g, 200, 1).p < 0.05);
  assert.ok(kwPerm(net, [0, 1, 2, 3, 4, 4, 3, 2, 1, 0], 200, 1).p > 0.5);
});

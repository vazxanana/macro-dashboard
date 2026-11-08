// node --test tests/outlook.test.mjs — the veteran's dated week / month calls (council/outlook.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { calls, addSessions, outlook } from '../council/outlook.mjs';
const DAY = 86400, t0 = 1600000000;
let v = 2000, seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gold = Array.from({ length: 1500 }, (_, i) => ({ t: t0 + i * DAY, v: (v *= 1 + (rnd() - 0.49) * 0.02) }));
const now = gold.at(-1).t;
test('calls are specific, dated and bounded, and the tilt moves the up call', () => {
  const a = calls({ closes: gold, now, h: 20, unit: '$' }), b = calls({ closes: gold, now, h: 20, tilt: 0.1, unit: '$' });
  assert.equal(a.list.length, 7); assert.match(a.list[0].claim, /closes \d{4}-\d\d-\d\d above \$/);
  for (const c of a.list) assert.ok(c.p >= 0.05 && c.p <= 0.95);
  assert.ok(b.list[0].p > a.list[0].p); assert.ok(a.list[2].p < a.list[1].p, 'the stretch level is less likely');
});
test('sessions skip weekends; too little history gives no calls', () => {
  assert.equal(addSessions(Date.UTC(2026, 10, 6) / 1000, 1), '2026-11-09');
  assert.equal(calls({ closes: gold.slice(0, 50), now, h: 5 }), null);
  const o = outlook({ gold, dxy: [], now, tilt20: 0.08, ch: { list: [] }, fc: { goldScore: { score: 0.6 } } });
  assert.equal(o.week.list.length, 7); assert.equal(o.digest.list[0].says, 'a tested long edge');
});

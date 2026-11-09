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
test('COT keeps the main gold contract when the micro shares the report date', async () => {
  const { cotMain } = await import('../council/macro.mjs');
  const r = cotMain([{ t: 2, net: -118 }, { t: 1, net: 104206 }, { t: 1, net: -1 }, { t: 2, net: 105562, gross: 200000 }]);
  assert.deepEqual(r.map((x) => x.net), [104206, 105562]);
});
test('calls are recorded once, resolved after their date and scored', async () => {
  const { callsLedger, callsScore, resolveCall, cotCalls } = await import('../council/outlook.mjs');
  const d = (s) => Date.parse(s + 'T21:00:00Z') / 1000, px = [['2026-11-02', 100], ['2026-11-03', 103], ['2026-11-04', 99], ['2026-11-05', 101]].map(([s, v]) => ({ t: d(s), v }));
  const o = { week: { list: [{ claim: 'up', p: 0.6, asset: 'gold', kind: 'closeAbove', level: 100, by: '2026-11-05' }, { claim: 't', p: 0.3, asset: 'gold', kind: 'touchUp', level: 104, by: '2026-11-05' }] }, month: { list: [] } };
  let L = callsLedger([], { outlook: o, closesBy: { gold: px }, now: d('2026-11-02') });
  L = callsLedger(L, { outlook: o, closesBy: { gold: px }, now: d('2026-11-03') }); assert.equal(L.length, 2, 'not twice');
  assert.equal(L[0].hit, undefined, 'open until the date passes');
  L = callsLedger(L, { outlook: { week: { list: [] }, month: { list: [] } }, closesBy: { gold: px }, now: d('2026-11-07') });
  assert.equal(L[0].hit, true); assert.equal(L[1].hit, false); assert.equal(L[0].brier, 0.16);
  const sc = callsScore(L); assert.equal(sc.n, 2); assert.equal(sc.hitRate, 0.5);
  assert.equal(resolveCall({ kind: 'range', lo: 100, hi: 102, issued: '2026-11-02', by: '2026-11-05' }, px, d('2026-11-07')), true);
  const c = cotCalls({ markets: [{ k: 'chf', name: 'USD/CHF', signals: [{ kind: 'extreme', pairDir: -1, tested: { edge: true, n: 99, win: 0.61 } }, { kind: 'flow', pairDir: 1, tested: { edge: false } }] }] }, { chf: px }, d('2026-11-05'));
  assert.equal(c.length, 1); assert.equal(c[0].kind, 'pairDown'); assert.equal(c[0].p, 0.61);
});

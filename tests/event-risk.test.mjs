// research/edge/event-risk/analyse.mjs: the pre-registered event risk tests (paper research). Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REL, TYPES, WIN, inWindow, h1, h2, tagRows } from '../research/edge/event-risk/analyse.mjs';
import { HISTORY, EVENTS } from '../council/events.mjs';

test('releases: CPI, NFP and FOMC only, from HISTORY and EVENTS, sorted', () => {
  assert.deepEqual(TYPES, ['CPI', 'NFP', 'FOMC']);
  assert.ok(REL.every((r) => TYPES.includes(r.type)));
  assert.equal(REL.length, [...HISTORY, ...EVENTS].filter((e) => TYPES.includes(e.type)).length);
  for (let i = 1; i < REL.length; i++) assert.ok(REL[i].t >= REL[i - 1].t);
  assert.equal(REL[0].at.slice(0, 10), '2022-01-07');   // NFP, the first 2022 release
  assert.ok(!REL.some((r) => r.type === 'PCE'));
});

test('window [-30, +60] minutes, both ends included', () => {
  assert.deepEqual(WIN, [-30, 60]);
  const cpi = REL.find((r) => r.type === 'CPI' && r.at.startsWith('2024-06-12'));   // 08:30 New York = 12:30 UTC
  assert.equal(cpi.at, '2024-06-12T12:30:00Z');
  assert.ok(inWindow(cpi.t - 30 * 60));
  assert.equal(inWindow(cpi.t - 31 * 60), null);
  assert.ok(inWindow(cpi.t + 60 * 60));
  assert.equal(inWindow(cpi.t + 61 * 60), null);
  assert.equal(inWindow(cpi.t + 60).r.type, 'CPI');
  assert.ok(inWindow(cpi.t + 60).m > 0);
});

const rows = (n, net, win, t0 = Date.UTC(2023, 0, 1) / 1000) => Array.from({ length: n }, (_, i) => {
  const r = REL[(i * 3) % REL.length];
  return { e: win ? r.t + 600 : t0 + i * 86400 + 3 * 3600, net: typeof net === 'function' ? net(i) : net, gross: 0 };
});

test('H1 passes only when every pre-registered condition holds', () => {
  const bad = tagRows([...rows(40, (i) => -1 + (i % 4) * 0.2, true), ...rows(400, (i) => 0.3 + (i % 5) * 0.1 - 0.2, false)]);
  const o = h1(bad);
  assert.equal(o.in.n, 40);
  assert.ok(o.releases >= 10);
  assert.equal(o.verdict, 'PASS');
  // too few dropped trades
  assert.equal(h1(tagRows([...rows(20, (i) => -1 + (i % 4) * 0.2, true), ...rows(400, 0.3, false)])).pass.n, false);
  // the dropped group loses, but no more than the kept group (a losing system): Welch fails
  const allBad = h1(tagRows([...rows(40, (i) => -1 + (i % 4) * 0.2, true), ...rows(400, (i) => -1 + (i % 4) * 0.2, false)]));
  assert.equal(allBad.pass.tWelch, false);
  assert.equal(allBad.verdict, 'FAIL');
});

test('H2 is paired: held minus flattened, holding worse passes, holding better fails', () => {
  const mk = (d) => Array.from({ length: 40 }, (_, i) => ({ e: REL[i].t - 3600, net: -0.5 + (i % 3) * 0.1, flatNet: -0.5 + (i % 3) * 0.1 - d - (i % 2) * 0.05, flatRel: `r${i}` }));
  const worse = h2(mk(-0.4));   // flat = held + 0.4 - noise: holding is worse
  assert.ok(worse.d.exp < 0);
  assert.ok(worse.gainFromFlatten > 0);
  assert.equal(worse.verdict, 'PASS');
  const better = h2(mk(0.4));
  assert.ok(better.d.exp > 0);
  assert.equal(better.verdict, 'FAIL');
  assert.equal(h2([{ e: 1, net: 1, flatMissing: true }]).missing, 1);
});

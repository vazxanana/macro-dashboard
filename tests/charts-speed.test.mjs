// Charts speed (27 Nov 2026, owner: "Keep improving the charts, speed"): a refresh that only moved the last candle goes through the
// tick path, the background scanner waits while the Charts are on screen, and the page-wide watchers stand down there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const src = page.match(/window\.msPollPlan = \(old, nx\) => \{[\s\S]*?return nx\.slice\(Math\.min\(d, old\.length - 1\)\); \};/)[0];
const W = {}; new Function('window', src)(W); const plan = W.msPollPlan;
const bar = (t, c, v = 1) => ({ time: t, open: c, high: c + 1, low: c - 1, close: c, volume: v });
const old = [bar(60, 10), bar(120, 11), bar(180, 12)];

test('poll plan: nothing changed is "same"', () => {
  assert.equal(plan(old, old.map((b) => ({ ...b }))), 'same');
});
test('poll plan: the last candle moved = that candle only', () => {
  const nx = [old[0], old[1], { ...old[2], close: 12.5, high: 13.2 }];
  const r = plan(old, nx); assert.ok(Array.isArray(r)); assert.equal(r.length, 1); assert.equal(r[0].close, 12.5);
});
test('poll plan: a new candle = the old last one and the new one', () => {
  const nx = [...old.map((b) => ({ ...b })), bar(240, 13)];
  const r = plan(old, nx); assert.deepEqual(r.map((b) => b.time), [180, 240]);
});
test('poll plan: a changed older candle, a shifted history or a jump is a full rebuild', () => {
  assert.equal(plan(old, [old[0], { ...old[1], close: 9 }, old[2]]), null);
  assert.equal(plan(old, [old[1], old[2], bar(240, 13)]), null);
  assert.equal(plan(old, [...old, bar(240, 1), bar(300, 1), bar(360, 1), bar(420, 1)]), null);
  assert.equal(plan(old, old.slice(0, 2)), null);
  assert.equal(plan(null, old), null);
});
test('the refresh uses the plan and P.push, the full rebuild only otherwise', () => {
  const m = page.match(/const plan = same \? window\.msPollPlan\(P\.raw, nx\) : null;[\s\S]*?else \{ P\.raw = nx; P\.rebuild\(true\); \}/);
  assert.ok(m, 'poll tick wiring');
  assert.match(m[0], /P\.push\(Object\.assign\(\{\}, k, \{ closed: i < plan\.length - 1 \}\)\)/);
});
test('the background scanner waits while the Charts are on screen and runs when they are left', () => {
  assert.match(page, /const onCharts = \(\) => document\.documentElement\.dataset\.app === 'charts' \|\| document\.documentElement\.dataset\.view === 'charts';/);
  assert.match(page, /if \(onCharts\(\)\) \{ SCAN\.later = miss\.length > 0; return; \}/);
  assert.match(page, /if \(!force && onCharts\(\)\) \{ SCAN\.later = true; return; \}/);
  assert.match(page, /if \(SCAN\.later && !onCharts\(\)\) \{ SCAN\.later = false; scanAll\(\); \}/);
});
test('the panes tell the drawing layer they are visible without a layout read, and two page-wide watchers skip the Charts', () => {
  assert.match(page, /visible: \(\) => P\.vis !== false && !\(VCH && VCH\.hidden\) \}\)\);/);
  assert.match(page, /if \(wq \|\| chOn\(\) \|\| window\.msLiveOnly\(recs\)\) return;/);
  assert.match(page, /document\.documentElement\.dataset\.view === 'charts' \|\|/);
});

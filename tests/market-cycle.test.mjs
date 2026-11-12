// Meridian markup: the market cycle (msCycle in market-structure.html). A higher timeframe's move, the lower timeframe's ChoCh
// against it (the pullback starts), the lower timeframe breaking back (the pullback is over), and the targets of each.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('function msCycle'), html.indexOf('function msNextSetup'));
const msCycle = new Function(`${src}; return msCycle;`)();
const H4 = { id: '4h', label: 'H4', dir: -1, ext: 4000, move: { level: 4100, top: 4150, bot: 4100, t: 100 }, events: [] };
const H1 = (events) => ({ id: '1h', label: 'H1', dir: 1, events });

test('H4 move down, H1 agrees: the move runs', () => {
  const [r] = msCycle([H4, H1([{ dir: -1, level: 4120, t: 100, structure: true }])]);
  assert.equal(r.phase, 'move'); assert.deepEqual(r.target, { p50: 4075, origin: 4100, far: 4150, ext: 4000 });
});
test('H1 ChoCh up after the H4 break: the H4 pullback started, targets 50% then the origin', () => {
  const [r] = msCycle([H4, H1([{ dir: -1, level: 4120, t: 100 }, { dir: 1, level: 4030, t: 200, fromT: 150, structure: true }])]);
  assert.equal(r.phase, 'pullback'); assert.equal(r.choch.level, 4030); assert.equal(r.target.p50, 4075);
});
test('H1 breaks back down after its ChoCh: the pullback is over, target the H4 low', () => {
  const [r] = msCycle([H4, H1([{ dir: 1, level: 4030, t: 200, structure: true }, { dir: -1, level: 4010, t: 300, fromT: 250, structure: true }])]);
  assert.equal(r.phase, 'resumed'); assert.equal(r.resume.level, 4010); assert.equal(r.target.ext, 4000);
});
test('a break before the H4 move does not count; every pair down the chain is read', () => {
  const M15 = { id: '15m', label: 'M15', dir: 1, events: [] };
  const out = msCycle([H4, H1([{ dir: 1, level: 4300, t: 50, structure: true }]), M15]);
  assert.equal(out[0].phase, 'move'); assert.equal(out.length, 2); assert.equal(out[1].phase, 'none', 'H1 has no move of its own here');
});
test('wired into the Meridian markup, with its own layer switch, hidden for guests and the other markups', () => {
  assert.match(html, /data-show="cycle" checked/); assert.match(html, /show: \{[^}]*cycle: true/);
  assert.match(html, /id="ms-cycle"/); assert.match(html, /html\[data-role="public"\] #ms-cycle/);
  assert.match(html, /G\.show\.cycle !== false/); assert.match(html, /not a tested rule/);
});

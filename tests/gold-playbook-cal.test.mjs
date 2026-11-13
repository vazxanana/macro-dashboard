// The Gold playbook calendar counts closed trades only (13 Nov 2026, owner: "he counts the trades open as profit for the day,
// he shouldn't, only trades closed"). The function is lifted from the page and run on hand-made trades.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const at = src.indexOf('  function renderCal(A) {');
const body = src.slice(at, src.indexOf('\n  var TW = [', at));

test('the gold playbook calendar puts only closed trades on a day', () => {
  const el = {}; const $ = (id) => (el[id] = el[id] || { innerHTML: '', textContent: '' });
  const ST = { calSrc: 'all', off: 0 }, ls = { get: () => ({}) };
  const nyp = () => ({ d: '2026-11-13' });
  const esc = (s) => String(s), sR = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`, f2 = (v) => v.toFixed(2), dLbl = (d) => d;
  const run = new Function('$', 'ST', 'ls', 'nyp', 'esc', 'sR', 'f2', 'dLbl', `${body}; return renderCal;`)($, ST, ls, nyp, esc, sR, f2, dLbl);
  const A = { T: [
    { d: '2026-11-10', exitD: '2026-11-12', entryD: '2026-11-11', e: 4000, R: -1, how: 'stop' },
    { d: '2026-11-12', exitD: null, entryD: '2026-11-13', e: 3900, R: 2.4, open: true },
  ] };
  run(A);
  const cal = el['gp-cal'].innerHTML;
  assert.match(cal, /data-gk="2026-11-12"[^>]*aria-label="12 [^"]*: −1\.00R, 1 trades"/);
  assert.match(cal, /data-gk="2026-11-13"[^>]*disabled/, 'today holds no open trade');
  assert.ok(!cal.includes('+2.40R'), 'floating R is never a day result');
  assert.match(el['gp-cal-m'].innerHTML, /−1\.00R · 1 closed/);
  assert.match(el['gp-cal-y'].textContent, /1 open trade is not counted until it closes \(floating \+2\.40R\)/);
});

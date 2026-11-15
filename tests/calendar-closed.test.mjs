// The P&L calendars count closed trades only (owner, 15 Nov 2026: "Make sure the calendar count the closed trades of the day
// for the daily pnl"). The Gold playbook view's calendar listed an open trade on today's date and added its floating R into the
// day's figure; it now shows the open trade as "open, not counted". The council, guest and ICT calendars already counted closed only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');

function lift(name) {
  const i = html.indexOf(`  function ${name}(A) {`);
  assert.ok(i > 0, `${name} found`);
  let depth = 0, j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) { if (html[k] === '{') depth++; else if (html[k] === '}' && --depth === 0) return html.slice(i, k + 1); }
  throw new Error('unbalanced');
}

test('Gold playbook calendar: a day figure is closed trades only, an open trade is listed but not added', () => {
  const src = lift('renderCal');
  const out = {};
  const $ = (id) => (out[id] = out[id] || { innerHTML: '', textContent: '' });
  const today = '2026-11-15';
  const run = new Function('$', 'ls', 'ST', 'nyp', 'esc', 'dLbl', 'f2', 'sR', `${src}; return renderCal;`)(
    $, { get: () => ({}) }, { calSrc: 'all', cal: { y: 2026, m: 10 }, calDay: today, off: 0 },
    () => ({ d: today }), (s) => String(s), (s) => s, (v) => v.toFixed(2), (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R');
  run({ T: [
    { d: '2026-11-10', entryD: '2026-11-11', exitD: today, R: 2, e: 4000, how: 'target' },
    { d: '2026-11-13', entryD: '2026-11-14', open: true, R: -0.8, e: 4050 },
  ] });
  const cell = out['gp-cal'].innerHTML.split('data-gk="' + today + '"')[1].split('</button>')[0];
  assert.match(cell, /<b>\+2\.00R<\/b>/, 'the day shows the closed trade only');
  assert.match(cell, /1 closed · 1 open/);
  assert.match(cell, /open, not counted/);
  assert.doesNotMatch(cell, /\+1\.20R/, 'the open trade is not added in');
  assert.match(out['gp-cal-day'].innerHTML, /floating, not counted/);
  // a day with only an open trade has no result and no colour
  run({ T: [{ d: '2026-11-13', entryD: '2026-11-14', open: true, R: 1.5, e: 4050 }] });
  const c2 = out['gp-cal'].innerHTML.split('data-gk="' + today + '"')[0].split('<button').pop();
  assert.doesNotMatch(c2, / up| dn/);
});

test('council, guest and ICT calendars read closed trades only', () => {
  const body = (start) => { const i = html.indexOf(start); return html.slice(i, i + 3000); };
  assert.match(body('  function renderCalendar() {'), /\['win', 'loss', 'be'\]\.includes\(x\.status\) && x\.closed/);
  assert.match(html, /const sysClosed = \(\) => \{ const ok = \(x\) => !x\.shadow && \['win', 'loss', 'be'\]\.includes\(x\.status\) && x\.closed/);
  assert.match(body('  function renderCal(T) {'), /const C = T\.filter\(\(x\) => x\.closed\)/);
});

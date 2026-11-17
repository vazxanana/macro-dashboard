// The P&L calendars count closed trades only (owner, 15 Nov 2026: "Make sure the calendar count the closed trades of the day
// for the daily pnl"). The council, guest and ICT calendars count closed trades only (the Gold playbook view, whose calendar
// is the one that added a floating R, was removed on 17 Nov 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');

test('council, guest and ICT calendars read closed trades only', () => {
  const body = (start) => { const i = html.indexOf(start); return html.slice(i, i + 3000); };
  assert.match(body('  function renderCalendar() {'), /\['win', 'loss', 'be'\]\.includes\(x\.status\) && x\.closed/);
  assert.match(html, /const sysClosed = \(\) => \{ const ok = \(x\) => !x\.shadow && \['win', 'loss', 'be'\]\.includes\(x\.status\) && x\.closed/);
  assert.match(body('  function renderCal(T) {'), /const C = T\.filter\(\(x\) => x\.closed\)/);
});

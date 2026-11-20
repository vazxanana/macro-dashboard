// The Sunday preview carries up to three top lines of the Week ahead (council/week-ahead.mjs), only when that file covers the
// coming week; the weekday digest never does. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest, weekAheadLines } from '../council/digest.mjs';

const T = (iso) => Date.parse(iso) / 1000;
const wa = { next: true, from: '2026-11-23', to: '2026-11-27', lines: ['A short week: US markets closed Thursday.', 'Prediction markets on the 9 Dec Fed decision: Kalshi Hike 25bps 92%.', 'Before the print: PCE (Wednesday).', 'A fourth line.'] };

test('the Sunday preview has the week ahead, three lines at most; the daily digest does not', () => {
  const p = buildDigest({ weekAhead: wa }, { now: T('2026-11-22T21:20:00Z'), kind: 'preview', prev: {}, sbRows: null });
  const i = p.lines.indexOf('The week ahead:');
  assert.ok(i > 0, p.msg);
  assert.deepEqual(p.lines.slice(i + 1, i + 4), wa.lines.slice(0, 3).map((l) => '• ' + l));
  assert.ok(!p.msg.includes('A fourth line'));
  assert.ok(p.lines.length <= 22);
  // a file stuck from an earlier weekend is not sent
  assert.deepEqual(weekAheadLines({ ...wa, to: '2026-11-20' }, T('2026-11-22T21:20:00Z')), []);
  const d = buildDigest({ weekAhead: wa }, { now: T('2026-11-23T21:20:00Z'), kind: 'daily', prev: {}, sbRows: null });
  assert.ok(!d.msg.includes('The week ahead:'));
});

test('nothing when the file is missing, covers the rest of this week, or has no lines; long lines are cut', () => {
  assert.deepEqual(weekAheadLines(null), []);
  assert.deepEqual(weekAheadLines({ next: false, lines: ['x'] }), []);
  assert.deepEqual(weekAheadLines({ next: true, lines: [] }), []);
  const [, l] = weekAheadLines({ next: true, lines: ['y'.repeat(400)] });
  assert.ok(l.length <= 172 && l.endsWith('…'));
});

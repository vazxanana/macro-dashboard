// node --test tests/ict-nfp.test.mjs — the ICT jobs-report-morning rule uses the real NFP release days (council/events.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { nfpMorning } from '../ict/tracker.mjs';
const t = (iso) => Date.parse(iso) / 1000;
test('moved releases are caught and the first Friday is not assumed inside the calendar', () => {
  assert.equal(nfpMorning(t('2025-12-16T13:00:00Z')), true);    // delayed (shutdown) release on a Tuesday
  assert.equal(nfpMorning(t('2026-07-02T13:00:00Z')), true);    // holiday move to Thursday
  assert.equal(nfpMorning(t('2026-07-03T13:00:00Z')), false);   // the first Friday that had no report
  assert.equal(nfpMorning(t('2025-12-05T13:00:00Z')), false);
});
test('only before 10:00 New York, and the first-Friday fallback outside the calendar', () => {
  assert.equal(nfpMorning(t('2026-11-06T14:00:00Z')), true);    // 09:00 ET
  assert.equal(nfpMorning(t('2026-11-06T15:30:00Z')), false);   // 10:30 ET
  assert.equal(nfpMorning(t('2030-03-01T13:00:00Z')), true);    // far future: first Friday
  assert.equal(nfpMorning(null), false);
});

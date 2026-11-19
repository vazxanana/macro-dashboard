// node --test tests/yen-spread.test.mjs — council/yen-spread.mjs: the +-3 minute windows around 00:55 and 06:00 UTC on weekdays, the
// gotobi calendar (a copy of research/edge/gotobi/run.mjs on branch gotobi, pinned here by its own output), the gotobi / other split
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { windowOf, gotobiOfMonth, isGotobi, yenSpreads, MINUTES, HALF } from '../council/yen-spread.mjs';

const sec = (iso) => Date.parse(iso) / 1000;

test('window filter: +-3 minutes of 00:55 and 06:00 UTC on a weekday, nothing else', () => {
  assert.deepEqual(MINUTES.map((m) => m[0]), ['00:55', '06:00']); assert.equal(HALF, 180);
  assert.deepEqual(windowOf(sec('2026-11-10T00:55:00Z')), { day: '2026-11-10', minute: '00:55' });
  assert.deepEqual(windowOf(sec('2026-11-10T00:52:00Z')), { day: '2026-11-10', minute: '00:55' });   // edge, inside
  assert.deepEqual(windowOf(sec('2026-11-10T00:58:00Z')), { day: '2026-11-10', minute: '00:55' });
  assert.equal(windowOf(sec('2026-11-10T00:51:59Z')), null); assert.equal(windowOf(sec('2026-11-10T00:58:01Z')), null);
  assert.deepEqual(windowOf(sec('2026-11-10T05:57:30Z')), { day: '2026-11-10', minute: '06:00' });
  assert.equal(windowOf(sec('2026-11-10T03:00:00Z')), null);
  assert.equal(windowOf(sec('2026-11-14T00:55:00Z')), null);   // Saturday
  assert.equal(windowOf(sec('2026-11-15T06:00:00Z')), null);   // Sunday
});

test('gotobi calendar: the branch copy, pinned by its own output; holidays and weekends roll back', () => {
  // research/edge/gotobi/run.mjs gotobiSet(2026, 2026) on branch gotobi, 14 Nov 2026 (Nov, Dec)
  assert.deepEqual(gotobiOfMonth(2026, 11), ['2026-11-05', '2026-11-10', '2026-11-13', '2026-11-20', '2026-11-25', '2026-11-30']);
  assert.deepEqual(gotobiOfMonth(2026, 12), ['2026-12-04', '2026-12-10', '2026-12-15', '2026-12-18', '2026-12-25', '2026-12-30']);
  assert.deepEqual(gotobiOfMonth(2027, 1), ['2027-01-05', '2027-01-08', '2027-01-15', '2027-01-20', '2027-01-25', '2027-01-29']);
  assert.deepEqual(gotobiOfMonth(2026, 5), ['2026-05-01', '2026-05-08', '2026-05-15', '2026-05-20', '2026-05-25', '2026-05-29']);   // Golden Week
  assert.equal(isGotobi('2026-11-13'), true); assert.equal(isGotobi('2026-11-16'), false); assert.equal(isGotobi('2026-11-03'), false);
  assert.equal(isGotobi('2024-12-30'), true);   // 5 Jan 2025 rolls over the New Year into December
  // a copy, not an import of a branch: the council file names its source
  const src = fs.readFileSync(new URL('../council/yen-spread.mjs', import.meta.url), 'utf8');
  assert.match(src, /copied from research\/edge\/gotobi\/run\.mjs/); assert.doesNotMatch(src, /from ['"][^'"]*research\//);
});

test('reader: window reads and round reads in pips, split gotobi / other; the commission in pips; out-of-window reads ignored', () => {
  const file = { watch: {
    USDJPY: { pipPosition: 2, bid: 155, ask: 155.004, commissionRT: 0.000045,
      windows: [{ t: sec('2026-11-13T00:55:00Z'), atTarget: 0.004 }, { t: sec('2026-11-12T00:55:00Z'), atTarget: 0.002 }, { t: sec('2026-11-12T06:00:00Z'), atTarget: null },
        { t: sec('2026-11-13T06:00:00Z'), atTarget: 0.012 }],
      spreadLog: [[sec('2026-11-13T00:57:00Z'), 0.006], [sec('2026-11-12T00:53:10Z'), 0], [sec('2026-11-12T12:00:00Z'), 0.05], [sec('2026-11-14T00:55:00Z'), 0.09]] },
    CADJPY: null } };
  const r = yenSpreads(file), u = r.USDJPY;
  assert.equal(r.CADJPY, null); assert.equal(u.pip, 0.01); assert.equal(u.commissionPips, 0.698);
  assert.deepEqual(u.reads.map((x) => [x.day, x.minute, x.src, x.pips, x.gotobi]), [
    ['2026-11-12', '00:55', 'round', 0, false], ['2026-11-12', '00:55', 'ticks', 0.2, false],
    ['2026-11-13', '00:55', 'ticks', 0.4, true], ['2026-11-13', '00:55', 'round', 0.6, true], ['2026-11-13', '06:00', 'ticks', 1.2, true]]);
  assert.deepEqual(u.summary['00:55 gotobi'], { n: 2, median: 0.5, mean: 0.5, max: 0.6 });
  assert.deepEqual(u.summary['00:55 other'], { n: 2, median: 0.1, mean: 0.1, max: 0.2 });
  assert.deepEqual(u.summary['06:00 gotobi'], { n: 1, median: 1.2, mean: 1.2, max: 1.2 });
  assert.deepEqual(u.summary['06:00 other'], { n: 0 });
  assert.deepEqual(yenSpreads({ symbols: {} }), {});   // a file from before the watch list
});

test('the reader is not wired into anything: no council, api, ict, page or workflow file names it', () => {
  const hits = [];
  for (const d of ['council', 'api', 'ict', '.github/workflows']) for (const f of fs.readdirSync(new URL(`../${d}/`, import.meta.url))) {
    if (f === 'yen-spread.mjs') continue;
    const p = new URL(`../${d}/${f}`, import.meta.url); if (!fs.statSync(p).isFile()) continue;
    if (/yen-spread\.mjs/.test(fs.readFileSync(p, 'utf8'))) hits.push(`${d}/${f}`);
  }
  for (const f of ['market-structure.html', 'macro-desk.html', 'backtest.html']) if (/yen-spread\.mjs/.test(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))) hits.push(f);
  assert.deepEqual(hits, []);
});

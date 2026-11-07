// node --test tests/ict-calendar.test.mjs: the ICT desk's CME Globex calendar (ict/calendar.mjs) against the published holiday
// schedule 2018-2027, the shut rule around early closes / holiday eves, and the proof that nothing changes on a normal week:
// the tracker's signals() on the pinned candles (14 Oct - 6 Nov 2026, no holiday) are byte-identical with the old weekend-only filter.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { cmeYear, dayInfo, cmeShut, goodFriday, nyParts, upcoming, EARLY, REOPEN, CLOSE } from '../ict/calendar.mjs';
import { closedBar, inHalt, signals, MARKETS, cmeShut as trackerShut } from '../ict/tracker.mjs';
import { sessionOpen } from '../council/datacheck.mjs';
const T = (s) => Date.parse(s) / 1000;

// the published CME Group holiday calendars (equity index futures), full closures by year
const FULL = {
  2018: ['2018-01-01', '2018-03-30', '2018-12-25'], 2019: ['2019-01-01', '2019-04-19', '2019-12-25'], 2020: ['2020-01-01', '2020-04-10', '2020-12-25'],
  2021: ['2021-01-01', '2021-04-02', '2021-12-24'], 2022: ['2022-04-15', '2022-12-26'], 2023: ['2023-01-02', '2023-04-07', '2023-12-25'],
  2024: ['2024-01-01', '2024-03-29', '2024-12-25'], 2025: ['2025-01-01', '2025-04-18', '2025-12-25'], 2026: ['2026-01-01', '2026-04-03', '2026-12-25'],
  2027: ['2027-01-01', '2027-03-26', '2027-12-24'],
};
// early closes (13:00 New York; 13:15 published for the day after Thanksgiving and Christmas Eve)
const EARLYD = {
  2018: ['2018-01-15', '2018-02-19', '2018-05-28', '2018-07-03', '2018-07-04', '2018-09-03', '2018-11-22', '2018-11-23', '2018-12-24'],
  2019: ['2019-01-21', '2019-02-18', '2019-05-27', '2019-07-03', '2019-07-04', '2019-09-02', '2019-11-28', '2019-11-29', '2019-12-24'],
  2020: ['2020-01-20', '2020-02-17', '2020-05-25', '2020-07-03', '2020-09-07', '2020-11-26', '2020-11-27', '2020-12-24'],
  2021: ['2021-01-18', '2021-02-15', '2021-05-31', '2021-07-05', '2021-09-06', '2021-11-25', '2021-11-26'],
  2022: ['2022-01-17', '2022-02-21', '2022-05-30', '2022-06-20', '2022-07-04', '2022-09-05', '2022-11-24', '2022-11-25'],
  2023: ['2023-01-16', '2023-02-20', '2023-05-29', '2023-06-19', '2023-07-03', '2023-07-04', '2023-09-04', '2023-11-23', '2023-11-24'],
  2024: ['2024-01-15', '2024-02-19', '2024-05-27', '2024-06-19', '2024-07-03', '2024-07-04', '2024-09-02', '2024-11-28', '2024-11-29', '2024-12-24'],
  2025: ['2025-01-20', '2025-02-17', '2025-05-26', '2025-06-19', '2025-07-03', '2025-07-04', '2025-09-01', '2025-11-27', '2025-11-28', '2025-12-24'],
  2026: ['2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-11-27', '2026-12-24'],
  2027: ['2027-01-18', '2027-02-15', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-11-26'],
};
test('full holidays and early closes 2018-2027 match the published CME schedule', () => {
  for (let y = 2018; y <= 2027; y++) {
    const Y = cmeYear(y);
    assert.deepEqual([...Y.full.keys()].sort(), FULL[y], `full ${y}`);
    assert.deepEqual([...Y.early.keys()].sort(), EARLYD[y], `early ${y}`);
  }
  assert.equal(goodFriday(2024), '2024-03-29'); assert.equal(goodFriday(2021), '2021-04-02');
  assert.equal(dayInfo('2026-11-27').published, EARLY + 15);   // day after Thanksgiving: 13:15 published, 13:00 used
  assert.equal(dayInfo('2026-11-26').published, EARLY);
  assert.equal(dayInfo('2021-12-31').kind, 'open');             // New Year on a Saturday: the Friday traded
  assert.equal(dayInfo('2021-06-18').kind, 'open');             // Juneteenth before CME observed it (2022)
  assert.equal(dayInfo('2022-07-01').kind, 'open');             // 4 July on a Monday: the Friday before is a normal day
  assert.equal(dayInfo('2026-10-12').kind, 'open');             // Columbus Day: regular hours
  assert.equal(dayInfo('2025-12-24').name, 'Christmas Eve');
});
test('cmeShut: early-close afternoons, holiday eves, the Sunday reopen and the fixed 31 Dec 2021', () => {
  // Thanksgiving 2026 (Thu 26 Nov): open 12:59, shut 13:00-17:59, open 18:00
  assert.equal(cmeShut(T('2026-11-26T17:59:00Z')), false);
  assert.equal(cmeShut(T('2026-11-26T18:00:00Z')), true);
  assert.equal(cmeShut(T('2026-11-26T22:59:00Z')), true);
  assert.equal(cmeShut(T('2026-11-26T23:00:00Z')), false);
  // day after Thanksgiving: shut from 13:00 into the weekend; Sunday 18:00 reopens
  assert.equal(cmeShut(T('2026-11-27T18:30:00Z')), true);
  assert.equal(cmeShut(T('2026-11-29T23:00:00Z')), false);
  // Christmas Eve 2025 (Wed): 13:00 halt, no evening session (eve of a full holiday), Christmas shut, 18:00 reopen on the 25th
  assert.equal(cmeShut(T('2025-12-24T17:30:00Z')), false);   // 12:30
  assert.equal(cmeShut(T('2025-12-24T18:30:00Z')), true);    // 13:30
  assert.equal(cmeShut(T('2025-12-25T00:30:00Z')), true);    // 24th 19:30
  assert.equal(cmeShut(T('2025-12-25T20:00:00Z')), true);    // 25th 15:00
  assert.equal(cmeShut(T('2025-12-25T23:00:00Z')), false);   // 25th 18:00
  // eve of Good Friday 2026 (Thu 2 Apr): 16:59 open, no 18:00 reopen; Good Friday shut; Sunday 18:00 open
  assert.equal(cmeShut(T('2026-04-02T20:59:00Z')), false);
  assert.equal(cmeShut(T('2026-04-02T23:30:00Z')), true);
  assert.equal(cmeShut(T('2026-04-03T14:00:00Z')), true);
  assert.equal(cmeShut(T('2026-04-05T22:00:00Z')), false);
  // New Year observed Monday 2 Jan 2023: no Sunday-evening session, Monday shut, Monday 18:00 open
  assert.equal(cmeShut(T('2023-01-02T00:00:00Z')), true);    // Sun 19:00
  assert.equal(cmeShut(T('2023-01-02T15:00:00Z')), true);
  assert.equal(cmeShut(T('2023-01-02T23:00:00Z')), false);
  // 31 Dec 2021 (Fri, New Year on Saturday) traded: the old calendar wrongly shut it
  assert.equal(cmeShut(T('2021-12-31T15:00:00Z')), false);
  // 3 July 2025 (Thu, the 4th on Friday) early close; 4 July 2025 early close
  assert.equal(cmeShut(T('2025-07-03T18:00:00Z')), true);
  assert.equal(cmeShut(T('2025-07-03T23:30:00Z')), false);   // 18:30 reopen on the 3rd
  assert.equal(cmeShut(T('2025-07-04T18:00:00Z')), true);
  // a normal day: 13:30 and 18:30 open, 17:30 is the daily halt (inHalt, not the calendar)
  assert.equal(cmeShut(T('2026-10-20T17:30:00Z')), false);
  assert.equal(cmeShut(T('2026-10-20T22:30:00Z')), false);
  assert.equal(closedBar(T('2026-10-20T21:30:00Z')), true);
  assert.equal(inHalt(T('2026-10-20T21:30:00Z')), true);
  assert.equal(trackerShut, cmeShut);
  assert.deepEqual(upcoming(T('2026-11-23T15:00:00Z'), 7).map((d) => d.day), ['2026-11-26', '2026-11-27']);
  assert.equal(nyParts(T('2026-11-26T18:00:00Z')).min, EARLY); assert.equal(REOPEN - CLOSE, 60);
});
test('datacheck CME hours follow the same calendar (holiday eve evening is closed, early close afternoon is closed)', () => {
  assert.equal(sessionOpen('cme', T('2026-04-02T23:30:00Z')), false);   // eve of Good Friday 18:30
  assert.equal(sessionOpen('cme', T('2026-11-27T18:30:00Z')), false);   // day after Thanksgiving 13:30
  assert.equal(sessionOpen('cme', T('2026-11-26T23:30:00Z')), true);    // Thanksgiving 18:30 reopen
  assert.equal(sessionOpen('cme', T('2021-12-31T15:00:00Z')), true);
  assert.equal(sessionOpen('cme', T('2026-10-20T21:30:00Z')), false);   // daily halt 17:30 EDT
});
test('normal week: the new filter keeps exactly the candles the weekend-only filter kept and signals() is byte-identical', () => {
  const bars = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/ict/bars.json.gz', import.meta.url))));
  // the filter shipped in #521: weekend + New Year / Good Friday / Christmas until 18:00, nothing else
  const old = (t) => { const p = nyParts(t); if (p.wd === 'Sat' || (p.wd === 'Fri' && p.min >= CLOSE) || (p.wd === 'Sun' && p.min < REOPEN)) return true;
    return p.min < REOPEN && ['2026-01-01', '2026-04-03', '2026-12-25'].includes(p.ymd); };
  let candles = 0, sigs = 0;
  for (const [k, M] of Object.entries(MARKETS)) {
    const raw = bars[k].h1.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] })), D = bars[k].d1.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
    const A = raw.filter((b) => !inHalt(b.time) && !old(b.time)), B = raw.filter((b) => !closedBar(b.time));
    assert.ok(A.length < raw.length, `${k}: the pinned candles still hold weekend bars to drop`);
    assert.deepEqual(B, A, `${k}: same candles kept`);
    const sA = JSON.stringify([1, -1].map((s) => signals(A, D, s, M.tick))), sB = JSON.stringify([1, -1].map((s) => signals(B, D, s, M.tick)));
    assert.equal(sB, sA, `${k}: identical signals`);
    candles += B.length; sigs += JSON.parse(sA).flat().length;
  }
  assert.ok(candles > 1500 && sigs > 20, `${candles} candles, ${sigs} signals compared`);
  // and no hour of that window is newly shut
  for (let t = bars.es.h1[0][0]; t <= bars.es.h1.at(-1)[0]; t += 3600) assert.equal(cmeShut(t), old(t), new Date(t * 1000).toISOString());
});

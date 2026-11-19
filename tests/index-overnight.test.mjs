// index-overnight study (research/edge/index-overnight): New York clock, calendar, stop and gap fills, financing nights,
// and RESULT.md against result.json. Offline, hand-made candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../research/edge/index-overnight/run.mjs';

const DIR = new URL('../research/edge/index-overnight/', import.meta.url);
const utc = (s) => Date.parse(s) / 1000;

test('New York times follow each year\'s daylight-saving rule', () => {
  assert.equal(S.nyAt('2024-07-15', 16), utc('2024-07-15T20:00:00Z'));
  assert.equal(S.nyAt('2024-01-15', 16), utc('2024-01-15T21:00:00Z'));
  assert.equal(S.nyAt('2024-07-15', 9, 30), utc('2024-07-15T13:30:00Z'));
  assert.equal(S.nyAt('2024-12-02', 9, 30), utc('2024-12-02T14:30:00Z'));
  // the weeks where the 2007 rule differs from the old one
  assert.equal(S.nyAt('2007-03-12', 16), utc('2007-03-12T20:00:00Z'));
  assert.equal(S.nyAt('2006-03-13', 16), utc('2006-03-13T21:00:00Z'));
  assert.equal(S.nyAt('2005-10-28', 16), utc('2005-10-28T20:00:00Z'));
  assert.equal(S.nyAt('2005-10-31', 16), utc('2005-10-31T21:00:00Z'));
  // against the platform's own zone, every day of three years
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (const y of [2005, 2008, 2026]) for (let d = 0; d < 365; d++) {
    const date = new Date(Date.UTC(y, 0, 1 + d)).toISOString().slice(0, 10);
    assert.equal(fmt.format(new Date(S.nyAt(date, 16) * 1000)), '16:00', date);
    assert.equal(fmt.format(new Date(S.nyAt(date, 9, 30) * 1000)), '09:30', date);
  }
});

test('cash calendar: holidays, special closures, early closes', () => {
  for (const d of ['2024-01-01', '2024-01-15', '2024-03-29', '2024-06-19', '2024-07-04', '2024-11-28', '2024-12-25', '2021-12-24', '2012-10-29', '2025-01-09', '2026-04-03'])
    assert.equal(S.isCashDay(d), false, d);
  for (const d of ['2021-06-18', '2022-01-03', '2024-07-05', '2021-12-31', '2024-12-24']) assert.equal(S.isCashDay(d), true, d);
  assert.equal(S.isCashDay('2024-07-06'), false);
  assert.deepEqual(S.closeHour('2024-11-29'), [13, 0]);
  assert.deepEqual(S.closeHour('2024-12-24'), [13, 0]);
  assert.deepEqual(S.closeHour('2024-07-03'), [13, 0]);
  assert.deepEqual(S.closeHour('2024-07-05'), [16, 0]);
});

test('financing nights: one a weekday, three over a Friday, none in the session', () => {
  const tue = S.nyAt('2024-07-16', 16), wed = S.nyAt('2024-07-17', 9, 30);
  assert.equal(S.nightsHeld(tue, wed), 1);
  assert.equal(S.nightsHeld(S.nyAt('2024-07-19', 16), S.nyAt('2024-07-22', 9, 30)), 3);
  assert.equal(S.nightsHeld(S.nyAt('2024-07-16', 9, 30), S.nyAt('2024-07-16', 16)), 0);
  assert.equal(S.nightsHeld(S.nyAt('2024-07-03', 13), S.nyAt('2024-07-05', 9, 30)), 2); // over the 4 July holiday
  assert.equal(S.nightsHeld(S.nyAt('2024-01-16', 16), S.nyAt('2024-01-17', 9, 30)), 1); // winter time
  const tr = { t0: tue, t1: wed, entry: 5000, stop: 4950, R: 0.5 };
  const dgs2 = [['2024-07-12', 4.5]], c = S.costTrade(tr, dgs2);
  assert.ok(Math.abs(c.finR - (4.5 + 2.5) / 100 / 365 * 5000 / 50) < 1e-12);
  assert.ok(Math.abs(c.spreadR - 0.0003 * 5000 / 50) < 1e-12);
  assert.ok(Math.abs(c.net - (0.5 - c.spreadR - c.finR)) < 1e-12);
  assert.equal(S.rateOf([['2006-01-06', 4.36], ['2006-01-13', 4.34]], '2005-03-01'), 4.36);
  assert.equal(S.rateOf([['2006-01-06', 4.36], ['2006-01-13', 4.34]], '2006-01-12'), 4.36);
});

// hand-made M30 candles: flat around 100, with daily ranges for the ATR
function series(fromDate, days, fn) {
  const rows = []; const t0 = utc(fromDate + 'T00:00:00Z');
  for (let t = t0; t < t0 + days * 86400; t += 1800) { const w = new Date(t * 1000).getUTCDay(); if (w === 6) continue; const b = fn(t); if (b) rows.push([t, ...b]); }
  return S.makeSeries(rows);
}

test('the stop sits under the entry; a gap through it fills at the open, a touch at the stop', () => {
  const base = series('2024-05-01', 50, () => [100, 101, 99, 100]); // every day: range 2 -> ATR 2
  const days = S.dailyBars(base.bars);
  const date = '2024-06-18', next = '2024-06-19';
  const flat = S.overnight(base, days, date, next);
  assert.equal(flat.stop, 98); assert.ok(flat.stop < flat.entry); assert.equal(flat.how, 'open'); assert.equal(flat.R, 0);
  // a candle at 02:00 New York that opens at 97: gap through the stop
  const tg = S.nyAt(next, 2);
  const gapS = series('2024-05-01', 50, (t) => (t === tg ? [97, 97.5, 96, 97] : t > tg ? [97, 97.5, 96.5, 97] : [100, 101, 99, 100]));
  const g = S.overnight(gapS, S.dailyBars(gapS.bars), date, next);
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 97); assert.equal(g.R, -1.5);
  // a candle that trades down to 97.5 from an open of 99: exits at the stop
  const touchS = series('2024-05-01', 50, (t) => (t === tg ? [99, 99.5, 97.5, 99] : [100, 101, 99, 100]));
  const h = S.overnight(touchS, S.dailyBars(touchS.bars), date, next);
  assert.equal(h.how, 'stop'); assert.equal(h.exit, 98); assert.equal(h.R, -1);
  // the 09:30 candle opening below the stop is the exit, at its open
  const to = S.nyAt(next, 9, 30);
  const openS = series('2024-05-01', 50, (t) => (t === to ? [96, 97, 95, 96] : [100, 101, 99, 100]));
  const o = S.overnight(openS, S.dailyBars(openS.bars), date, next);
  assert.equal(o.how, 'gap-open'); assert.equal(o.exit, 96); assert.equal(o.R, -2);
  // a missing exit candle: no trade
  const holeS = series('2024-05-01', 50, (t) => (t === to ? null : [100, 101, 99, 100]));
  assert.equal(S.overnight(holeS, S.dailyBars(holeS.bars), date, next).drop, true);
  // the ATR reads only days that ended before the entry: a huge range later on the entry day changes nothing
  const lateS = series('2024-05-01', 50, (t) => (t === S.nyAt(date, 16, 30) ? [100, 150, 50, 100] : [100, 101, 99, 100]));
  assert.equal(S.overnight(lateS, S.dailyBars(lateS.bars), date, next).stop, 98);
  // the session leg (T3) enters at 09:30 and exits at the close
  const se = S.session(base, days, date);
  assert.equal(se.t0, S.nyAt(date, 9, 30)); assert.equal(se.t1, S.nyAt(date, 16)); assert.ok(se.stop < se.entry);
  assert.throws(() => S.simulate(base.bars, { entry: 100, stop: 101, t0: 0, from: 0, to: 0, exitPx: 100, exitT: 0 }));
});

test('statistics: month sums, Holm, one-sided p', () => {
  assert.deepEqual(S.holm([0.01, 0.04]), [0.02, 0.04]);
  assert.ok(Math.abs(S.pOne(1.96) - 0.025) < 1e-3);
  const m = S.monthSums([{ t0: utc('2024-01-03T00:00:00Z'), net: 1 }, { t0: utc('2024-01-20T00:00:00Z'), net: -0.5 }, { t0: utc('2024-02-01T00:00:00Z'), net: 2 }]);
  assert.deepEqual([...m.entries()], [['2024-01', 0.5], ['2024-02', 2]]);
});

test('RESULT.md matches result.json', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, S.report(res));
  assert.ok(md.includes(`## Verdict: ${res.verdict}.`));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(res.verdictClass));
  assert.ok(res.verdict.startsWith(res.verdictClass + ':'));
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['decisive', 'replication']) assert.ok(res.tests[k][w].n > 0);
  const fwd = (S.P.SEEDS === 40) && res.tests.T1.decisive.placebo.seeds === 40; assert.ok(fwd);
});

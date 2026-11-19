// research/edge/index-friday-pm: the calendar, the short's stop walk, the 20-day stop history (strictly before the day), the
// placebo, the pass bar, and the committed report against result.json. Offline (synthetic candles only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  P, WIN, nyseDay, eligibleDays, nyT, toBars, pxAt, trade, runMarket, placebo, verdictOf, summarize, monthT, wdOf, render,
} from '../research/edge/index-friday-pm/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/index-friday-pm');

test('calendar: Good Friday and closures out, the Friday after Thanksgiving is a half day, ordinary Fridays open', () => {
  assert.equal(nyseDay('2024-03-29'), 'closed');        // Good Friday 2024
  assert.equal(nyseDay('2025-04-18'), 'closed');        // Good Friday 2025
  assert.equal(nyseDay('2024-11-29'), 'half');          // day after Thanksgiving
  assert.equal(nyseDay('2021-12-24'), 'closed');        // Christmas observed on Friday
  assert.equal(nyseDay('2020-07-03'), 'closed');        // Independence Day observed on Friday
  assert.equal(nyseDay('2026-11-13'), 'open');
  const days = eligibleDays('2024-11-25', '2024-12-01');
  assert.deepEqual(days, ['2024-11-25', '2024-11-26', '2024-11-27']);
});

test('New York times follow daylight saving', () => {
  assert.equal(new Date(nyT('2026-07-10', '14:00') * 1000).toISOString(), '2026-07-10T18:00:00.000Z');
  assert.equal(new Date(nyT('2026-01-09', '14:00') * 1000).toISOString(), '2026-01-09T19:00:00.000Z');
});

// synthetic M5 candles over NY 13:00-16:00 of the given days; f(day index, minute index) gives the close
function synth(days, f) {
  const rows = [];
  days.forEach((d, k) => {
    const t0 = nyT(d, '13:00');
    let prev = f(k, 0);
    for (let i = 0; i < 36; i++) { const c = f(k, i); rows.push([t0 + i * 300, prev, Math.max(prev, c), Math.min(prev, c), c]); prev = c; }
  });
  return toBars(rows);
}

test('the short: time exit, stop and gap', () => {
  const d = '2026-11-13', tE = nyT(d, '14:00'), tX = nyT(d, '15:55');
  const down = synth([d], (_, i) => 100 - (i >= 12 ? (i - 11) * 0.1 : 0));
  const pE = pxAt(down, tE), pX = pxAt(down, tX);
  assert.equal(pE, 100);
  const a = trade(down, tE, tX, pE, pX, -1, 2);
  assert.equal(a.how, 'time'); assert.ok(a.R > 0); assert.ok(Math.abs(a.net - (a.R - P.COST * pE / 2)) < 1e-12);
  const up = synth([d], (_, i) => 100 + (i >= 12 ? (i - 11) * 0.5 : 0));
  const b = trade(up, tE, tX, pxAt(up, tE), pxAt(up, tX), -1, 2);
  assert.equal(b.how, 'stop'); assert.equal(b.exit, 102); assert.equal(b.R, -1);
  const gap = toBars([[tE - 300, 100, 100, 100, 100], [tE, 105, 106, 104, 105], [tX - 300, 105, 105, 105, 105]]);
  const g = trade(gap, tE, tX, 100, 105, -1, 2);
  assert.equal(g.how, 'gap'); assert.equal(g.R, -2.5);
});

test('the stop of a Friday comes from the 20 PREVIOUS Fridays only; Monday-Thursday days never feed it', () => {
  const days = eligibleDays('2026-01-01', '2026-11-13');
  const fridays = days.filter((d) => wdOf(d) === 5);
  // Friday k moves (k + 1) points down; other days move 50 points up
  const b = synth(days, (k, i) => { const fi = fridays.indexOf(days[k]); const mv = fi >= 0 ? -(fi + 1) : 50; return 1000 + (i >= 12 ? mv * Math.min(1, (i - 11) / 23) : 0); });
  const { recs } = runMarket(b, days);
  const fr = recs.filter((r) => r.w === 5);
  assert.equal(fr.filter((r) => r.fri).length, fr.length - P.N);
  const r21 = fr[P.N];                    // the 21st Friday: stop = 1.5 x mean of moves 1..20
  assert.ok(Math.abs(r21.fri.dist - P.K * 10.5) < 1e-9);
  assert.equal(r21.mth, undefined);
  assert.ok(recs.filter((r) => r.w !== 5).every((r) => r.fri === undefined));
});

test('placebo draws the requested number of Monday-Thursday days, seeded', () => {
  const recs = Array.from({ length: 200 }, (_, i) => ({ date: `2020-01-${String((i % 28) + 1).padStart(2, '0')}`, mth: { net: i / 100 } }));
  const a = placebo(recs, 30, ['2019-01-01', '2021-01-01']), b = placebo(recs, 30, ['2019-01-01', '2021-01-01']);
  assert.equal(a.length, 40); assert.ok(a.every((x) => x.n === 30)); assert.deepEqual(a, b);
});

test('pass bar: every line needed', () => {
  const pl = Array.from({ length: 40 }, (_, i) => ({ net: -0.1 + i * 0.001 }));
  const good = { IS: { net: 0.05 }, OOS: { net: 0.2, net2: 0.1, t: 2.5 } };
  assert.equal(verdictOf(good, pl).ok, true);
  assert.equal(verdictOf({ ...good, OOS: { ...good.OOS, t: 1.9 } }, pl).ok, false);
  assert.equal(verdictOf({ ...good, IS: { net: -0.01 } }, pl).ok, false);
  assert.equal(verdictOf({ ...good, OOS: { ...good.OOS, net2: -0.01 } }, pl).ok, false);
  assert.equal(verdictOf({ ...good, OOS: { ...good.OOS, net: -0.07 } }, pl).ok, false);
  assert.deepEqual(monthT([{ date: '2020-01-02', v: 1 }, { date: '2020-01-09', v: 1 }, { date: '2020-02-07', v: 3 }]).months, 2);
});

test('the windows split the data at its calendar midpoint', () => {
  assert.equal(WIN.IS[1], WIN.OOS[0]);
  assert.equal(P.SPLIT, '2017-04-23');
  assert.equal(summarize([], 'fri', WIN.OOS).n, 0);
});

test('committed result: report = render(result.json), the verdict follows the pass lines, headline is short', () => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8'), render(j));
  assert.equal(j.verdict, Object.values(j.pass).every(Boolean) ? 'PASS' : 'FAIL');
  const pri = j.markets.spx500.groups.fri;
  assert.ok(pri.OOS.n >= 300 && pri.IS.n >= 300);
  assert.equal(j.pass.oosT, pri.OOS.t >= 2);
  assert.equal(j.placebo.bySeed.length, 40);
  const m = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8').match(/\*\*Verdict: ([^*]+)\*\*/);
  assert.ok(m && m[1].length < 220, 'the bold verdict line reads as a short headline');
});

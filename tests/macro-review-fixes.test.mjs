// Fixes from the 20 Nov 2026 review of the day's macro work (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../council/hard-data.mjs';
import * as WA from '../council/week-ahead.mjs';
import * as PR from '../council/prep-record.mjs';
import * as DR from '../council/daily-report.mjs';

const T = (iso) => Date.parse(iso) / 1000;

test('odds wording: "Hike >25bps" and "50+ bps increase" are never "a 25 bp hike"', () => {
  assert.equal(H.outcomeWords('Hike 25bps'), 'a 25 bp hike');
  assert.equal(H.outcomeWords('Hike >25bps'), 'a hike of more than 25 bp');
  assert.equal(H.outcomeWords('Cut >25bps'), 'a cut of more than 25 bp');
  assert.equal(H.outcomeWords('50+ bps increase'), 'a hike of 50 bp or more');
  assert.equal(H.outcomeWords('Fed maintains rate'), 'no change');
});

test('the nowcast sits only beside a monthly CPI / PCE price row', () => {
  const nc = { core: 0.27, head: 0.31 };
  for (const t of ['Personal Income m/m', 'Personal Spending m/m', 'Core PCE Price Index q/q', 'CPI y/y', 'PCE (Personal Income and Outlays)'])
    assert.equal(WA.prepFor({ title: t, exp: '0.4%', type: 'PCE' }, nc, null), null, t);
  assert.ok(WA.prepFor({ title: 'Core PCE Price Index m/m', exp: '0.2%', type: 'PCE' }, nc, null));
  assert.ok(WA.prepFor({ title: 'CPI m/m', exp: '0.2%', type: 'CPI' }, nc, null));
  assert.equal(PR.monthlyPrice('Personal Income m/m'), false);
  assert.equal(PR.monthlyPrice('Core CPI m/m'), true);
});

test('the above / below gold record (sorted by the core surprise) is shown on the core row only', () => {
  const nc = { core: 0.27, head: 0.31 }, rec = { stats: { above: { n: 15, gold: 0.06 }, below: { n: 24, gold: -0.13 } } };
  assert.match(WA.prepFor({ title: 'Core CPI m/m', exp: '0.2%', type: 'CPI' }, nc, rec).text, /printed above consensus gold averaged/);
  const head = WA.prepFor({ title: 'CPI m/m', exp: '0.2%', type: 'CPI' }, nc, rec);
  assert.doesNotMatch(head.text, /printed above consensus/); assert.equal(head.record, null);
});

test('the morning report files Fed events and auctions under the London day it is headed with', () => {
  // a forced build at 02:00 UTC on Tuesday: New York is still on Monday
  const hd = { fed: { events: [{ day: '2026-11-23', title: 'Monday speech' }, { day: '2026-11-24', title: 'Tuesday speech' }] },
    auctions: { list: [{ day: '2026-11-23', term: '2-Year', type: 'Note', amount: 69 }, { day: '2026-11-24', term: '5-Year', type: 'Note', amount: 70 }] } };
  const today = DR.worldReport({ fc: {}, vet: null, cal: [], now: T('2026-11-24T02:00:00Z'), hd }).sections.find((s) => /^Today/.test(s.h)).lines.join('\n');
  assert.match(today, /Tuesday speech/); assert.match(today, /5-Year/);
  assert.doesNotMatch(today, /Monday speech|2-Year/);
});

test('the morning report: a broken history never stops it, and an unchanged reading adds no line', () => {
  const now = T('2026-11-25T06:30:00Z'), at = (t) => new Date(t * 1000).toISOString(), o = (t, p) => ({ at: at(t), odds: { meeting: '2026-12-09', top: [{ label: 'Hike 25bps', p }] } });
  const flat = DR.worldReport({ fc: {}, vet: null, cal: [], now, hd: { hist: [o(now - 7 * 86400, 0.92), o(now - 86400, 0.92), o(now - 1800, 0.92)] } });
  assert.ok(!flat.sections.flatMap((s) => s.lines).some((l) => /a day ago/.test(l)));
  assert.doesNotThrow(() => DR.worldReport({ fc: {}, vet: null, cal: [], now, hd: { hist: [{ at: at(now - 60), odds: { meeting: 'x', top: [null] } }] } }));
});

test('the morning report: next week\'s big US release from the council schedule before the calendar file is out', () => {
  const w = DR.worldReport({ fc: {}, vet: null, cal: [], now: T('2026-11-20T06:30:00Z'), hd: null });
  const week = w.sections.find((s) => s.h === 'Later this week').lines.join('\n');
  assert.match(week, /PCE/); assert.match(week, /from the council's release schedule; no consensus yet/);
  assert.doesNotMatch(week, /No high-impact release is on the calendar/);
});

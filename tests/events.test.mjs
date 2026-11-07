// node --test tests/events.test.mjs — the high-impact economic calendar (council/events.mjs) and the news-window study helpers
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EVENTS, TYPES, SOURCES, nearEvent, eventDay, eventsBetween, tradingDay, newsFeat, zonedToUtc } from '../council/events.mjs';
import { stat, welch, compare, clearlyNegative } from '../research/edge/news-filter/analyze.mjs';

const at = (iso) => Date.parse(iso) / 1000;
const find = (type, iso) => EVENTS.find((e) => e.type === type && e.at === iso);

test('every event is sourced, typed, in range and sorted', () => {
  assert.ok(EVENTS.length > 150);
  for (const e of EVENTS) {
    assert.ok(TYPES.includes(e.type), e.type); assert.ok(e.src && e.src.length > 20, `${e.type} has a source`);
    assert.ok(e.t >= at('2025-08-01T00:00:00Z') && e.t < at('2027-01-01T00:00:00Z'));
    assert.equal(new Date(e.t * 1000).toISOString().replace('.000', ''), e.at);
  }
  for (let i = 1; i < EVENTS.length; i++) assert.ok(EVENTS[i].t >= EVENTS[i - 1].t, 'sorted');
  for (const k of ['CPI', 'NFP', 'FOMC', 'PCE', 'ECB', 'BOJ', 'ISM', 'CLAIMS']) assert.ok(SOURCES[k]);
  assert.ok(Object.isFrozen(EVENTS) && Object.isFrozen(EVENTS[0]), 'callers cannot edit the calendar');
});

test('local release times become UTC with the right daylight-saving offset', () => {
  assert.ok(find('NFP', '2025-08-01T12:30:00Z'), 'NFP 08:30 EDT');
  assert.ok(find('NFP', '2026-11-06T13:30:00Z'), 'NFP 08:30 EST (matches the faireconomy feed of that week)');
  assert.ok(find('FOMC', '2025-09-17T18:00:00Z') && find('FOMC', '2025-12-10T19:00:00Z'), 'FOMC 14:00 ET, summer and winter');
  assert.ok(find('ECB', '2025-10-30T13:15:00Z') && find('ECB', '2026-07-23T12:15:00Z'), 'ECB 14:15 CET / CEST');
  assert.ok(find('BOJ', '2025-12-19T03:00:00Z').approx, 'BoJ ~12:00 JST, flagged approximate');
  assert.ok(find('PCE', '2025-12-05T15:00:00Z'), 'the shutdown-delayed PCE came at 10:00 ET');
  // Europe changed clocks a week before the US in Oct 2025: 08:30 New York was 13:30 Frankfurt, 14:15 Frankfurt = 13:15 UTC
  assert.equal(zonedToUtc('2025-10-30', '14:15', 'Europe/Berlin'), at('2025-10-30T13:15:00Z'));
  assert.equal(zonedToUtc('2026-03-11', '08:30', 'America/New_York'), at('2026-03-11T12:30:00Z'), 'US DST began 8 Mar 2026');
});

test('the 2025 shutdown and holiday shifts are in the calendar', () => {
  assert.ok(find('CPI', '2025-10-24T12:30:00Z'), 'Sep 2025 CPI moved to 24 Oct');
  assert.ok(!EVENTS.some((e) => e.type === 'CPI' && e.at.startsWith('2025-11')), 'Oct 2025 CPI never published');
  assert.ok(find('NFP', '2025-11-20T13:30:00Z') && find('NFP', '2025-12-16T13:30:00Z') && find('NFP', '2026-02-11T13:30:00Z'));
  assert.ok(!EVENTS.some((e) => e.type === 'NFP' && (e.at.startsWith('2025-10') || e.at.startsWith('2025-11-07'))));
  assert.ok(!EVENTS.some((e) => e.type === 'CLAIMS' && e.at >= '2025-10-01' && e.at < '2025-11-13'), 'no claims during the shutdown');
  assert.ok(find('CLAIMS', '2025-11-26T13:30:00Z'), 'Thanksgiving week claims on Wednesday');
  assert.ok(find('CLAIMS', '2025-12-31T13:30:00Z'), 'New Year week claims on Wednesday');
  assert.ok(find('ISM_M', '2026-01-05T15:00:00Z') && find('ISM_S', '2026-01-07T15:00:00Z'), 'ISM January dates from its calendar');
  assert.ok(find('ISM_M', '2025-09-02T14:00:00Z'), 'Labor Day pushes ISM to the next business day');
  assert.ok(EVENTS.filter((e) => e.scheduled).every((e) => e.t > at('2026-11-07T23:59:00Z')));
});

test('nearEvent: nearest event within the window, signed minutes, filters, seconds or ms', () => {
  const nfp = at('2026-11-06T13:30:00Z');
  assert.equal(nearEvent(nfp - 20 * 60, 30).type, 'NFP');
  assert.equal(nearEvent(nfp - 20 * 60, 30).minutes, -20);
  assert.equal(nearEvent(nfp + 30 * 60, 30).minutes, 30, 'window edge is inside');
  assert.equal(nearEvent(nfp + 31 * 60, 30), null);
  assert.equal(nearEvent((nfp + 600) * 1000, 30).type, 'NFP', 'milliseconds accepted');
  assert.equal(nearEvent(new Date((nfp + 600) * 1000), 30).type, 'NFP', 'Date accepted');
  assert.equal(nearEvent(nfp, 60, { type: 'CPI' }), null);
  assert.equal(nearEvent(nfp, 60, { tier: 1 }).type, 'NFP');
  assert.equal(nearEvent(nfp, 60, { country: 'EUR' }), null);
  // two events close together: the nearer one wins (ECB 12:15Z and PCE 12:30Z on 30 Apr 2026)
  assert.equal(nearEvent(at('2026-04-30T12:20:00Z'), 60).type, 'ECB');
  assert.equal(nearEvent(at('2026-04-30T12:25:00Z'), 60).type, 'PCE');
  assert.equal(nearEvent(NaN, 60), null);
  assert.equal(nearEvent(at('2025-08-02T12:00:00Z'), 120), null, 'a Saturday');
});

test('eventDay / tradingDay use the New York trading day (18:00 ET opens the next one)', () => {
  assert.equal(tradingDay(at('2026-11-05T23:30:00Z')), '2026-11-06', '18:30 ET belongs to the next day');
  assert.equal(tradingDay(at('2026-11-05T21:00:00Z')), '2026-11-05');
  assert.deepEqual(eventDay(at('2026-11-06T19:00:00Z')).map((e) => e.type), ['NFP']);
  // BoJ at 03:00Z on 30 Oct 2026 is 23:00 ET on the 29th: it falls in the 30 Oct trading day
  assert.ok(eventDay(at('2026-10-30T15:00:00Z')).some((e) => e.type === 'BOJ'));
  assert.equal(eventDay(at('2026-11-07T15:00:00Z')).length, 0, 'a Saturday');
  assert.deepEqual(eventsBetween(at('2026-11-06T13:00:00Z'), at('2026-11-06T14:00:00Z')).map((e) => e.type), ['NFP']);
});

test('newsFeat: the Meridian research tag (tier-1 within 120 min)', () => {
  assert.deepEqual(newsFeat(at('2026-11-06T15:00:00Z')), { newsT1: 'NFP', newsMin: 90 });
  assert.deepEqual(newsFeat(at('2026-11-06T16:00:00Z')), { newsT1: null, newsMin: null });
  assert.deepEqual(newsFeat(at('2026-11-05T13:30:00Z')), { newsT1: null, newsMin: null }, 'jobless claims are tier 2');
});

test('research/data/events.json is the generated calendar', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../research/data/events.json', import.meta.url), 'utf8'));
  assert.deepEqual(j.events, JSON.parse(JSON.stringify(EVENTS)), 'regenerate with: node council/events.mjs > research/data/events.json');
});

test('study stats: t, Welch t, halves and the clearly-negative bar', () => {
  const s = stat([1, -1, 1, -1, 2]); assert.equal(s.n, 5); assert.equal(s.exp, 0.4); assert.equal(s.wr, 0.6);
  assert.equal(stat([]).n, 0); assert.equal(welch([1], [2, 3]), null);
  assert.ok(welch([-1, -1.2, -0.8, -1], [1, 1.2, 0.8, 1]) < -5);
  const rows = []; for (let i = 0; i < 80; i++) rows.push({ t: i, R: i % 2 ? (i % 4 === 1 ? -1 : -0.6) : (i % 3 ? 1 : -1), news: i % 2 === 1, ev: i % 10 });
  const c = compare(rows, (x) => x.news, 40, (x) => x.ev);
  assert.equal(c.in.n, 40); assert.ok(c.in.t <= -2); assert.ok(c.h1.exp < 0 && c.h2.exp < 0); assert.ok(clearlyNegative(c));
  assert.equal(c.k, 5, 'one cluster per event');
  const few = compare(rows.slice(0, 40), (x) => x.news, 20); assert.equal(clearlyNegative(few), false, 'n < 30');
});

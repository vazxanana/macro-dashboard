// Week ahead: how big a day to expect for gold (council/week-ahead.mjs dayRange, 20 Nov 2026). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as WA from '../council/week-ahead.mjs';

const T = (iso) => Date.parse(iso) / 1000;
const fc = { assets: { gold: { expMovePct: 0.9, last: 4200 } } };
const rf = { study: { PCE: { name: 'core PCE', stats: { n: 34, absMed: 1.24 } }, PPI: { name: 'PPI', stats: { n: 5, absMed: 2 } } } };

test('a normal day: the expected move of the last price, in $ and %', () => {
  const r = WA.dayRange(fc, { releases: [] }, rf);
  assert.equal(r.normalPct, 0.9); assert.ok(Math.abs(r.normalUsd - 37.8) < 1e-9);
  assert.ok(r.text.startsWith('A typical day\'s move is about ±$38 (±0.9%), close to close.'));
  assert.ok(/not a forecast of direction/.test(r.text));
  assert.equal(r.eventPct, undefined);
});

test('a release day shows the bigger median move of past days of that type, with n', () => {
  const r = WA.dayRange(fc, { releases: [{ type: 'PCE', country: 'USD' }] }, rf);
  assert.equal(r.type, 'PCE'); assert.equal(r.n, 34); assert.equal(r.eventPct, 1.24);
  assert.ok(Math.abs(r.eventUsd - 52.08) < 1e-9);
  assert.ok(r.text.includes('On past core PCE days the median move was ±$52 (±1.2%, n 34).'));
});

test('fewer than 8 past releases: no release figure; signed rows alone give the median absolute move', () => {
  const r = WA.dayRange(fc, { releases: [{ type: 'PPI', country: 'USD' }] }, rf);
  assert.equal(r.eventPct, undefined); assert.ok(!/median move/.test(r.text));
  const rows = [1, -2, 0.5, -0.4, 3, -1.5, 0.8, -0.6].map((g) => ({ goldDay: g }));
  const r2 = WA.dayRange(fc, { releases: [{ type: 'CPI', country: 'USD' }] }, { study: { CPI: { name: 'CPI', rows } } });
  assert.equal(r2.n, 8); assert.equal(r2.eventPct, 0.9);
  const r3 = WA.dayRange(fc, { releases: [{ type: 'CPI', country: 'USD' }] }, { study: { CPI: { name: 'CPI', rows: rows.slice(0, 7) } } });
  assert.equal(r3.eventPct, undefined);
  assert.equal(WA.dayRange(fc, { releases: [{ type: 'PCE', country: 'EUR' }] }, rf).eventPct, undefined);
});

test('holidays and early closes say thin trading', () => {
  assert.ok(/thin trading/i.test(WA.dayRange(fc, { releases: [], market: { kind: 'holiday' } }, rf).text));
  assert.ok(/Early close: thin trading/.test(WA.dayRange(fc, { releases: [], market: { kind: 'early' } }, rf).text));
});

test('no forecast file, or no expected move: no range; build attaches one per day', () => {
  assert.equal(WA.dayRange(null, { releases: [] }, rf), null);
  assert.equal(WA.dayRange({ assets: { gold: { expMovePct: null, last: 4200 } } }, { releases: [] }, rf), null);
  const noPx = WA.dayRange({ assets: { gold: { expMovePct: 0.9 } } }, { releases: [] }, rf);
  assert.equal(noPx.normalUsd, null); assert.ok(noPx.text.startsWith('A typical day\'s move is about ±0.9%, close to close.'));
  const A = WA.build({ now: T('2026-11-20T10:00:00Z'), cal: [], rf, fc, v: {} });
  assert.ok(A.days.every((d) => d.range && d.range.normalPct === 0.9));
  assert.equal(A.days.find((d) => d.day === '2026-11-25').range.type, 'PCE');
  assert.ok(/closed/.test(A.days.find((d) => d.day === '2026-11-26').range.text));
  assert.ok(WA.build({ now: T('2026-11-20T10:00:00Z'), cal: [], rf, fc: null, v: {} }).days.every((d) => d.range === null));
});

test('the Macro desk draws the range as text under each day heading', () => {
  const md = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  const block = md.slice(md.indexOf('function renderAhead'), md.indexOf('function renderNext'));
  assert.ok(block.includes("'<p class=\"wa-rg\"><b>Gold, typical move:</b> ' + esc(d.range.text) + '</p>'"));
  assert.ok(block.indexOf('wa-rg') > block.indexOf('<h3>'));
});

test('a release-day median under today\'s normal day says to plan on today\'s range (20 Nov 2026)', () => {
  const src = fs.readFileSync(new URL('../council/week-ahead.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes("measured over other years and as a median, so it is not comparable one for one: plan on today\\'s figure"));
});

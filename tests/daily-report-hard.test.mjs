// The 06:30 world report carries the hard-to-find data (council/hard-data.mjs, 20 Nov 2026): the Cleveland Fed nowcast before
// today's US PCE / CPI, the Fed's own calendar of the day, the Fed-decision odds and GDPNow. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as DR from '../council/daily-report.mjs';

const T = (iso) => Date.parse(iso) / 1000;
const hd = {
  nowcast: { months: [{ month: '2026-10', asOf: '2026-11-24', now: { pce: 0.31, corePce: 0.27, cpi: 0.24, coreCpi: 0.21 }, actual: { cpi: 0.35, coreCpi: 0.3 } }] },
  fed: { events: [{ day: '2026-11-25', time: '2:00 p.m.', type: 'Beige', title: 'Beige Book', topic: null }, { day: '2026-11-26', time: '9:00 a.m.', type: 'Speeches', title: 'Speech - Governor', topic: null }] },
  odds: { meeting: '2026-12-09', line: 'Prediction markets on the 9 Dec Fed decision: Kalshi Hike 25bps 92%. What traders pay, not a forecast of ours.' },
  gdpnow: { quarter: '2026 Q4', value: 3.21, prev: 3.27 },
};
const cal = [{ title: 'Core PCE Price Index m/m', country: 'USD', at: T('2026-11-25T13:30:00Z'), impact: 'High', forecast: '0.2%', previous: '0.3%' }];

test('today: the nowcast before the PCE print and the Fed\'s calendar of the day; the frame: odds and GDPNow', () => {
  const w = DR.worldReport({ fc: {}, vet: null, cal, now: T('2026-11-25T06:30:00Z'), hd });
  const today = w.sections.find((s) => /^Today/.test(s.h)).lines, exp = w.sections.find((s) => s.h === 'What we expect').lines;
  assert.ok(today.some((l) => /^Before the print: the Cleveland Fed nowcast for October is core \+0\.27%/.test(l) && /not the consensus/.test(l)));
  assert.ok(today.some((l) => l === 'Fed: Beige Book · 19:00 London (2:00 p.m. New York)'));
  assert.ok(!today.some((l) => /Governor/.test(l)), 'only the day\'s Fed events');
  assert.ok(exp.some((l) => /Kalshi Hike 25bps 92%/.test(l) && /not a forecast of ours/.test(l)));
  assert.ok(exp.some((l) => /GDPNow for 2026 Q4: 3\.21%/.test(l)));
});

test('without the file the report is as before, and a printed month shows no nowcast', () => {
  const now = T('2026-11-25T06:30:00Z');
  assert.deepEqual(DR.worldReport({ fc: {}, vet: null, cal, now }), DR.worldReport({ fc: {}, vet: null, cal, now, hd: null }));
  const cpi = [{ title: 'Core CPI m/m', country: 'USD', at: T('2026-11-10T13:30:00Z'), impact: 'High' }];
  const w = DR.worldReport({ fc: {}, vet: null, cal: cpi, now: T('2026-11-10T06:30:00Z'), hd });
  assert.ok(!w.sections.flatMap((s) => s.lines).some((l) => /Before the print/.test(l)));
  const fs = require_('node:fs').readFileSync(new URL('../council/daily-report.mjs', import.meta.url), 'utf8');
  assert.ok(fs.includes("hd: read('macro/hard-data.json')"));
});
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);

test('what we expect: how the odds moved over the week (hard-data hist), never more than four lines', () => {
  const now = T('2026-11-25T06:30:00Z'), h = (t, p) => ({ at: new Date(t * 1000).toISOString(), odds: { meeting: '2026-12-09', top: [{ label: 'Hike 25bps', p }] } });
  const w = DR.worldReport({ fc: {}, vet: null, cal, now, hd: { ...hd, hist: [h(now - 7 * 86400, 0.85), h(now - 86400, 0.9), h(now - 1800, 0.92)] } });
  const exp = w.sections.find((s) => s.h === 'What we expect').lines;
  assert.ok(exp.some((l) => /^Kalshi odds of .*: 92% now, 90% a day ago, 85% a week ago\. What traders pay, not a forecast of ours\.$/.test(l)), exp.join('\n'));
});

test('today: the Treasury note and bond auctions of the New York day, never a bill', () => {
  const now = T('2026-11-23T06:30:00Z');
  const w = DR.worldReport({ fc: {}, vet: null, cal: [], now, hd: { auctions: { list: [{ day: '2026-11-23', term: '2-Year', type: 'Note', amount: 69 }, { day: '2026-11-23', term: '13-Week', type: 'Bill', amount: 95 }, { day: '2026-11-24', term: '5-Year', type: 'Note', amount: 70 }] } } });
  const today = w.sections.find((s) => /^Today/.test(s.h)).lines;
  assert.ok(today.includes('US Treasury 2-Year Note auction, $69 billion (results about 18:00 London).'), today.join('\n'));
  assert.ok(!today.some((l) => /13-Week|5-Year/.test(l)));
});

test('nyUnix: a New York clock time on a New York day, summer and winter; an unreadable time is null', () => {
  assert.equal(DR.nyUnix('2026-11-25', '2:00 p.m.'), T('2026-11-25T19:00:00Z'));
  assert.equal(DR.nyUnix('2026-07-15', '8:30 a.m.'), T('2026-07-15T12:30:00Z'));
  assert.equal(DR.nyUnix('2026-11-25', '12:15 p.m.'), T('2026-11-25T17:15:00Z'));
  assert.equal(DR.nyUnix('2026-11-25', '12:05 a.m.'), T('2026-11-25T05:05:00Z'));
  assert.equal(DR.nyUnix('2026-11-25', 'TBD'), null);
});

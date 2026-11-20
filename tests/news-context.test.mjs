// node --test tests/news-context.test.mjs — the veteran's 2022-24 release ledgers turned into facts beside the next releases
// (council/news-context.mjs, 19 Nov 2026). Offline: reads the committed batch files only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as N from '../council/news-context.mjs';

const F = N.facts(N.loadBatch()), T = (s) => Date.parse(s) / 1000;
const cal = N.calendarOf({ cal: [
  { title: 'Core CPI m/m', country: 'USD', at: T('2026-11-10T13:30:00Z'), actual: '0.3%' },
  { title: 'Core PCE Price Index m/m', country: 'USD', at: T('2026-12-04T15:00:00Z'), actual: '' },
  { title: 'Non-Farm Employment Change', country: 'USD', at: T('2026-12-04T13:30:00Z'), actual: '' },
  { title: 'ISM Services PMI', country: 'USD', at: T('2026-12-04T15:00:00Z'), actual: '' },
  { title: 'CPI m/m', country: 'USD', at: T('2026-12-09T13:30:00Z'), actual: '' },
  { title: 'Federal Funds Rate', country: 'USD', at: T('2026-12-10T19:00:00Z'), actual: '' },
  { title: 'PPI m/m', country: 'USD', at: T('2026-12-11T13:30:00Z'), actual: '' },
  { title: 'CPI y/y', country: 'GBP', at: T('2026-12-09T07:00:00Z'), actual: '' } ] });
const now = T('2026-12-01T00:00:00Z'), ctx = (title) => N.contextFor(cal.find((e) => e.title === title), { F, expectations: [], calendar: cal, now });

test('the facts equal the batch\'s own published figures', () => {
  const fp = JSON.parse(fs.readFileSync('research/macro-veteran/references/core-cpi-to-core-pce-fixed-proxy-2022-2024.json', 'utf8'));
  assert.equal(F.n, fp.count); assert.equal(F.ppiFirst, fp.ppi_scheduled_before_cpi);
  assert.equal(F.pce.same, fp.exact_one_decimal_matches); assert.equal(F.pce.gapMean, -+fp.mean_error_cpi_minus_pce_pp.toFixed(3));
  const ism = JSON.parse(fs.readFileSync('research/macro-veteran/references/ism-jobs-same-day-verified-2022-2024.json', 'utf8'));
  assert.equal(F.ism.n, ism.events.length); assert.equal(F.jobs.n, 36); assert.equal(F.jobs.revN, 35);
  assert.ok(F.pce.b > 0.5 && F.pce.b < 1 && F.pce.mae < 0.1);
});

test('each kind of upcoming release gets its facts; foreign releases and unknown titles get none', () => {
  const pce = ctx('Core PCE Price Index m/m'); assert.equal(pce.kind, 'PCE'); assert.equal(pce.points[0].kind, 'lead');
  assert.match(pce.points[0].text, /Core CPI printed 0\.3% m\/m \(2026-11-10\).*core PCE near 0\.2\d%.*not a forecast on the record/);
  const nfp = ctx('Non-Farm Employment Change'); assert.match(nfp.points[0].text, /negative in 22 of 35 releases/); assert.ok(nfp.points.some((p) => /ISM report is out the same day \(ISM Services PMI\)/.test(p.text)));
  assert.match(ctx('CPI m/m').points[0].text, /Fed statement follows within two days \(2026-12-10\)/);
  assert.match(ctx('Federal Funds Rate').points[0].text, /CPI came out 29\.5 h before this statement/);
  assert.match(ctx('PPI m/m').points[0].text, /CPI is already out \(2026-12-09\): PPI comes second, as in 31 of 36/);
  assert.match(ctx('ISM Services PMI').points[0].text, /Same day as the jobs report/);
  assert.equal(ctx('CPI y/y'), null, 'only US releases');
  assert.equal(N.kindOf('Retail Sales m/m'), null);
  // without this month's CPI print no PCE number is given
  const bare = N.contextFor({ title: 'Core PCE Price Index m/m', country: 'USD', at: '2026-12-04T15:00:00Z' }, { F, expectations: [], calendar: [], now });
  assert.match(bare.points[0].text, /not on file here.*core CPI 0\.2% went with core PCE near 0\.1\d%, 0\.3% .*0\.4% /);
});

test('the veteran\'s captured first print wins over the calendar, and only a print BEFORE the release counts', () => {
  const E = [{ event: 'Core CPI m/m', country: 'USD', scheduledUtc: '2026-11-10T13:30:00.000Z', firstPrint: { value: '0.4%' } },
    { event: 'Core CPI m/m', country: 'USD', scheduledUtc: '2026-12-10T13:30:00.000Z', firstPrint: { value: '0.9%' } }];
  const c = N.contextFor({ title: 'Core PCE Price Index m/m', country: 'USD', at: '2026-12-04T15:00:00Z' }, { F, expectations: E, calendar: [], now });
  assert.match(c.points[0].text, /printed 0\.4%/);
});

test('honest wording: never a surprise, an edge claim or advice to trade', () => {
  const all = ['Core PCE Price Index m/m', 'Non-Farm Employment Change', 'CPI m/m', 'Federal Funds Rate', 'PPI m/m', 'ISM Services PMI'].flatMap((t) => ctx(t).points.map((p) => p.text)).join(' ');
  assert.doesNotMatch(all, /surprise|\bbuy\b|\bsell\b|proven|guarantee/i);
  assert.match(ctx('CPI m/m').label, /not a tested edge or a forecast on the record/);
  assert.match(ctx('CPI m/m').noSurprise, /expectation captured before the release/);
  const A = N.ahead({ F, fc: null, calendar: cal, expectations: [], now, days: 14, schedule: [] });   // the calendar alone (20 Nov 2026: the council's schedule adds what the calendar does not hold; tests/brain-veteran.test.mjs)
  assert.deepEqual(A.map((x) => x.kind), ['NFP', 'PCE', 'CPI', 'FOMC', 'PPI']);
  assert.equal(N.facts(null), null); assert.deepEqual(N.ahead({ F: null, now }), []);
});

test('wiring: the veteran puts it on its cards and the desk shows it', () => {
  const v = fs.readFileSync('council/veteran.mjs', 'utf8'), d = fs.readFileSync('macro-desk.html', 'utf8');
  assert.match(v, /contextFor\(e, \{ F, expectations: E, calendar: calN, now, hd \}\)/); assert.match(v, /v\.newsAhead = /);
  assert.match(d, /id="nx-batch"/); assert.match(d, /What the 2022-24 record says/); assert.match(d, /news: \(v && v\.newsAhead/);
});

test('a Fed speaker or the minutes are not a statement', () => {
  for (const t of ['FOMC Member Waller Speaks', 'FOMC Meeting Minutes', 'Fed Chairman Warsh Speaks']) assert.equal(N.kindOf(t), null, t);
  assert.equal(N.kindOf('Federal Funds Rate'), 'FOMC'); assert.equal(N.kindOf('FOMC Statement'), 'FOMC');
});

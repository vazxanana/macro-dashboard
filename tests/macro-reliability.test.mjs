// Macro strategist failure handling (9 Nov reliability audit): a calendar week that fails to load keeps its last good events,
// an append-only log that does not parse is never overwritten, files are replaced atomically.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as M from '../council/macro.mjs';

const NOW = Date.UTC(2026, 10, 9, 12, 0) / 1000;   // Mon 9 Nov 2026 12:00 UTC
const res = (body, ok = true, status = 200) => ({ ok, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => body });
const CPI = { title: 'CPI m/m', country: 'USD', date: '2026-11-10T08:30:00-05:00', impact: 'High', forecast: '0.3%', previous: '0.6%' };
const GDP = { title: 'GDP m/m', country: 'GBP', date: '2026-11-19T02:00:00-05:00', impact: 'High', forecast: '0.1%', previous: '0.0%' };
// only the calendar answers (the rest of the network is down)
const calFetch = ({ thisweek, nextweek }) => async (url) => {
  if (url.includes('ff_calendar_thisweek')) return thisweek ? res(thisweek) : res('', false, 429);
  if (url.includes('ff_calendar_nextweek')) return nextweek ? res(nextweek) : res('', false, 404);
  throw new Error('network down');
};
const cachedCal = M.parseCalendar([CPI, { ...CPI, title: 'Old item', date: '2026-10-01T08:30:00-04:00' }]);

test('calendar: this week rate-limited, next week loaded → this week comes from the last good copy (was dropped)', async () => {
  const { data, src } = await M.gather(calFetch({ thisweek: null, nextweek: [GDP] }), NOW, { cal: cachedCal });
  const titles = data.cal.map((e) => e.title).sort();
  assert.deepEqual(titles, ['CPI m/m', 'GDP m/m'], 'tomorrow\'s CPI must not vanish because one of the two feeds was throttled');
  assert.match(src['calendar:cache'], /1 cached event/);
});

test('calendar: both weeks load → the cache adds nothing; both fail → the whole last good copy', async () => {
  const a = await M.gather(calFetch({ thisweek: [CPI], nextweek: [GDP] }), NOW, { cal: [...cachedCal, ...M.parseCalendar([{ ...CPI, forecast: '9.9%' }])] });
  assert.equal(a.data.cal.length, 2); assert.equal(a.data.cal.find((e) => e.title === 'CPI m/m').forecast, '0.3%');
  assert.equal(a.src['calendar:cache'], undefined);
  const b = await M.gather(calFetch({}), NOW, { cal: cachedCal });
  assert.deepEqual(b.data.cal.map((e) => e.title), ['CPI m/m'], 'events older than two weeks are not carried');
  assert.match(b.src['calendar:cache'], /cached/);
});

test('mergeCalendar: a fetched week replaces the cached copy of that week only', () => {
  const thisWeek = M.parseCalendar([CPI]), next = M.parseCalendar([GDP]);
  assert.deepEqual(M.mergeCalendar([thisWeek, []], next, NOW).map((e) => e.title), ['CPI m/m', 'GDP m/m']);
  const stale = M.parseCalendar([{ ...CPI, forecast: '0.9%' }, { ...CPI, title: 'Dropped since' }]);
  assert.deepEqual(M.mergeCalendar([thisWeek, []], stale, NOW).map((e) => [e.title, e.forecast]), [['CPI m/m', '0.3%']]);
  assert.deepEqual(M.mergeCalendar([[], next], thisWeek, NOW).map((e) => e.title).sort(), ['CPI m/m', 'GDP m/m']);
  assert.deepEqual(M.mergeCalendar([], [], NOW), []);
});

test('a history.json that does not parse is left as it is (it used to be replaced by a fresh empty log)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'macro-rel-')), md = path.join(dir, 'macro');
  fs.mkdirSync(md, { recursive: true });
  const cut = '[{"id":"2026-11-06-gold","at":"2026-11-05T21:00:00Z","pUp":0.54},{"id":"2026-11-0';
  fs.writeFileSync(path.join(md, 'history.json'), cut);
  fs.writeFileSync(path.join(md, 'events.json'), '[{"id":"x"');
  const logs = [];
  await M.run({ dir, now: NOW, fetchImpl: async () => { throw new Error('offline'); }, log: (...m) => logs.push(m.join(' ')) });
  assert.equal(fs.readFileSync(path.join(md, 'history.json'), 'utf8'), cut, 'the append-only log is kept for a repair');
  assert.equal(fs.readFileSync(path.join(md, 'events.json'), 'utf8'), '[{"id":"x"');
  assert.ok(logs.some((l) => /history\.json.*not valid JSON/.test(l)), 'the run says so');
  assert.ok(fs.existsSync(path.join(md, 'forecast.json')), 'the forecast is still written');
  const fc = JSON.parse(fs.readFileSync(path.join(md, 'forecast.json'), 'utf8'));
  assert.match(fc.sources['file:history.json'], /not valid JSON/, 'and the forecast\'s sources say so (the desk lists them)');
  assert.deepEqual(fs.readdirSync(md).filter((f) => f.includes('.tmp')), [], 'no temporary files left behind');
});

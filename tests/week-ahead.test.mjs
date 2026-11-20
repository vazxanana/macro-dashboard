// Week ahead plan (council/week-ahead.mjs, 20 Nov 2026): the week chosen, US holidays, releases from the calendar and the schedule,
// the Red folder record, the tested calendar rules with their own verdicts, and the Macro desk's wiring. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as WA from '../council/week-ahead.mjs';

const T = (iso) => Date.parse(iso) / 1000;

test('the week: Friday and the weekend prepare the next week; Monday to Thursday show the rest of this week', () => {
  assert.deepEqual(WA.weekOf(T('2026-11-20T10:00:00Z')), { from: '2026-11-23', to: '2026-11-27', next: true });   // Friday
  assert.deepEqual(WA.weekOf(T('2026-11-22T20:00:00Z')), { from: '2026-11-23', to: '2026-11-27', next: true });   // Sunday
  assert.deepEqual(WA.weekOf(T('2026-11-24T15:00:00Z')), { from: '2026-11-24', to: '2026-11-27', next: false });  // Tuesday
});

test('US holidays: Thanksgiving closed, the day after an early close, the eve is no NYSE holiday', () => {
  assert.equal(WA.nyseHoliday('2026-11-26'), 'Thanksgiving Day');
  assert.equal(WA.nyseHoliday('2026-11-27'), null);
  assert.equal(WA.marketNote('2026-11-26').kind, 'holiday');
  assert.equal(WA.marketNote('2026-11-27').kind, 'early');
  assert.equal(WA.marketNote('2026-11-25'), null);
  assert.equal(WA.nyseHoliday('2026-12-24'), null); assert.equal(WA.nyseHoliday('2026-12-25'), 'Christmas Day');
});

test('release types: US titles map to the Red folder types, other countries never do', () => {
  assert.equal(WA.typeOf('Core PCE Price Index m/m', 'USD'), 'PCE');
  assert.equal(WA.typeOf('Core CPI m/m', 'USD'), 'CPI');
  assert.equal(WA.typeOf('PPI m/m', 'USD'), 'PPI');
  assert.equal(WA.typeOf('Non-Farm Employment Change', 'USD'), 'NFP');
  assert.equal(WA.typeOf('Prelim GDP q/q', 'USD'), 'GDP');
  assert.equal(WA.typeOf('CPI y/y', 'EUR'), null);
});

test('releases: the calendar first, the schedule fills what it lacks without doubling a release', () => {
  const cal = [{ title: 'Core PCE Price Index m/m', country: 'USD', at: T('2026-11-25T13:30:00Z'), impact: 'High', forecast: '0.2%', previous: '0.3%' },
    { title: 'Bank Holiday', country: 'JPY', at: T('2026-11-23T00:00:00Z'), impact: 'Holiday' }];
  const r = WA.releasesOf(cal, '2026-11-23', '2026-11-27');
  const pce = r.filter((x) => x.type === 'PCE');
  assert.equal(pce.length, 1); assert.equal(pce[0].src, 'calendar'); assert.equal(pce[0].exp, '0.2%');
  assert.ok(r.some((x) => /Claims/.test(x.title) && x.src === 'schedule'));       // the schedule's claims, Wednesday (Thursday is a holiday)
  assert.ok(!r.some((x) => /Bank Holiday/.test(x.title)));
  const sched = WA.releasesOf([], '2026-11-23', '2026-11-27');                     // before next week's calendar is published
  assert.ok(sched.some((x) => x.type === 'PCE' && x.src === 'schedule' && x.day === '2026-11-25'));
});

test('calendar rules: the pre-holiday rule on Wednesday, the post-holiday and turn-of-month rules on Friday, gotobi on its days', () => {
  const on = (d) => WA.RULES.filter((R) => R.when(d)).map((R) => R.topic);
  assert.ok(on('2026-11-25').includes('gold-pre-holiday'));
  assert.ok(on('2026-11-25').includes('gotobi'));
  assert.ok(on('2026-11-27').includes('post-holiday-metals'));
  assert.ok(on('2026-11-27').includes('gold-turn-of-month') && on('2026-11-30').includes('gold-turn-of-month') && on('2026-12-03').includes('gold-turn-of-month'));
  assert.ok(!on('2026-12-04').includes('gold-turn-of-month') && !on('2026-11-24').includes('gold-turn-of-month'));
  assert.ok(on('2026-11-24').includes('turnaround-tuesday-forward'));
  assert.ok(!on('2026-11-26').length || !on('2026-11-26').includes('gold-pre-holiday'));
});

test('every rule\'s record is its own study\'s verdict and headline', () => {
  for (const R of WA.RULES) {
    const r = WA.ruleRecord(R.topic, null);
    assert.ok(r, R.topic); assert.ok(['pass', 'fail', 'inc'].includes(r.verdict), R.topic + ' ' + r.verdict);
    const md = fs.readFileSync(new URL(`../research/edge/${R.topic}/RESULT.md`, import.meta.url), 'utf8');
    assert.ok(md.includes(r.headline.slice(0, 30).replace(/^\*+/, '')) || r.headline.length > 10, R.topic);
  }
  assert.equal(WA.ruleRecord('post-holiday-metals', null).verdict, 'fail');
  assert.equal(WA.ruleRecord('gold-pre-holiday', null).verdict, 'pass');
});

test('build: a short Thanksgiving week from the files, the Red folder record on the release, nothing called an edge', () => {
  const rf = { study: { PCE: { name: 'Core PCE', stats: { n: 99, absMed: 0.52, upShare: 0.53, above: { n: 15, gold: 0.06 }, below: { n: 24, gold: -0.13 }, from: '2018-01-29' }, prep: [] } } };
  const fc = { goldScore: { score: -1, label: 'AUCTION (no macro edge)' }, regime: { label: 'Dollar Smile left side (stress)', vix: 24.56 } };
  const v = { summary: { levels: { px: 3607.4, asOf: '2026-11-19', above: { price: 3600, label: 'Round number' }, below: { price: 3550, label: 'Round number' } },
    bias: { lean: 'against', p: 0.53, base: 0.57, by: '2026-12-11', confidence: 'low' } }, outlook: { week: { by: '2026-11-20', list: [] } } };
  const A = WA.build({ now: T('2026-11-20T10:00:00Z'), cal: [], rf, fc, v });
  assert.equal(A.from, '2026-11-23'); assert.equal(A.days.length, 5);
  assert.ok(A.lines[0].includes('US markets closed Thursday') && A.lines[0].includes('early close Friday'));
  const wed = A.days.find((d) => d.day === '2026-11-25');
  const pce = wed.releases.find((r) => r.type === 'PCE');
  assert.ok(pce.record && /median ±0.52%/.test(pce.record.lines[0]));
  assert.ok(wed.rules.some((r) => r.topic === 'gold-pre-holiday' && r.verdict === 'pass'));
  assert.ok(A.calNote && /not published yet/.test(A.calNote));
  assert.ok(A.frame.lines.some((l) => /not a sell/.test(l)));
  assert.equal(A.calls.list.length, 0);
  const all = JSON.stringify(A);
  assert.ok(!/\bproven edge\b|\bguarantee|\bsure\b|will rise|will fall/i.test(all.replace(/not proven/g, '')));
});

test('the Macro desk reads macro/week-ahead.json and writes it as text', () => {
  const md = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.ok(md.includes("get('macro/week-ahead.json')") && md.includes('id="s-ahead"') && md.includes('href="#s-ahead"') && md.includes('function renderAhead'));
  const block = md.slice(md.indexOf('function renderAhead'), md.indexOf('function renderNext'));
  assert.ok(!/innerHTML\s*=\s*[^;]*\b(r|d|l|c)\.(title|text|headline|claim|line)\b(?!\))/.test(block.replace(/esc\([^)]*\)/g, '')));
  const vet = fs.readFileSync(new URL('../council/veteran.mjs', import.meta.url), 'utf8');
  assert.ok(vet.includes('const WA = weekAhead(') && vet.includes("w('week-ahead.json', WA)"));   // 20 Nov 2026: the prep record's score is put on the plan before it is written
});

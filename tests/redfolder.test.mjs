// council/redfolder.mjs: the Red folder study (19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, loadInputs, capturedFrom, typeOf, fredValue } from '../council/redfolder.mjs';
import { releaseSeries } from '../council/macro.mjs';

const DAY = 86400, now = Date.UTC(2026, 10, 19, 12) / 1000;
const monthly = (start, vals) => vals.map((v, i) => [new Date(Date.UTC(2026, start + i, 1)).toISOString().slice(0, 10), v]);
const rel = { day: '2026-11-19', series: {
  CPILFESL: monthly(5, [330, 331, 332, 333, 334.33]), CPIAUCSL: monthly(5, [330, 331, 332, 333, 334.3]),
  PAYEMS: monthly(5, [159000, 159100, 159050, 159110, 159275]), UNRATE: monthly(5, [4.1, 4.2, 4.1, 4.2, 4.1]),
  DFEDTARU: [['2026-09-15', 4], ['2026-09-17', 3.75]] } };
const closes = (pairs) => pairs.map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v }));

test('types match US calendar titles only', () => {
  assert.equal(typeOf('Core CPI m/m').f.k, 'core'); assert.equal(typeOf('CPI m/m').f.k, 'head');
  assert.equal(typeOf('Non-Farm Employment Change').T.k, 'NFP'); assert.equal(typeOf('Federal Funds Rate').T.k, 'FOMC');
  assert.equal(typeOf('FOMC Meeting Minutes'), null); assert.equal(typeOf('CPI m/m', 'GBP'), null); assert.equal(typeOf('Prelim GDP Price Index q/q'), null);
});

test('FRED values: m/m to one decimal as printed, payroll change in thousands', () => {
  const S = rel.series.CPILFESL.map(([d, v]) => ({ d, t: 0, v }));
  assert.deepEqual(fredValue(S, 'mom', '2026-10'), { v: 0.4, prev: 0.3 });
  assert.equal(fredValue(rel.series.PAYEMS.map(([d, v]) => ({ d, v })), 'diff', '2026-10').v, 165);
});

test('a release row: consensus captured before, printed from FRED, surprise, gold and dollar on the day', () => {
  const captured = [{ title: 'Core CPI m/m', country: 'USD', at: '2026-11-10T13:30:00.000Z', consensus: '0.3%', previous: '0.3%', capturedAt: '2026-11-08T10:00:00Z' },
    { title: 'Non-Farm Employment Change', country: 'USD', at: '2026-11-06T13:30:00.000Z', consensus: '65K', previous: '60K' }];
  const R = build({ inputs: { panel: [], jobs: [], bench: null, base: null }, rel, captured, calendar: [], now,
    gold: closes([['2026-11-09', 4000], ['2026-11-10', 3900], ['2026-11-05', 4000], ['2026-11-06', 4010]]), dxy: closes([['2026-11-09', 100], ['2026-11-10', 100.5]]) });
  const cpi = R.study.CPI.rows.find((r) => r.day === '2026-11-10'), core = cpi.fields.find((f) => f.k === 'core');
  assert.equal(core.actual, 0.4); assert.equal(core.exp, '0.3%'); assert.equal(core.surprise, 0.1); assert.equal(core.prev, 0.3); assert.equal(cpi.goldDay, -2.5); assert.equal(cpi.usdDay, 0.5);
  const nfp = R.study.NFP.rows.find((r) => r.day === '2026-11-06'); assert.equal(nfp.fields[0].actual, 165); assert.equal(nfp.fields[0].surprise, 100);
  assert.match(R.label, /not a forecast, not a tested edge/); assert.ok(R.study.CPI.next && R.study.CPI.next.fromSchedule, 'next CPI from the council release calendar');
});

test('the real inputs: first prints 2022-24 and the CPI model, with schedule dates through 2026', () => {
  const I = loadInputs(); assert.ok(I.bench && I.panel.length === 36 && I.jobs.length === 36 && I.base.rows.length > 100);
  const R = build({ inputs: I, rel: null, captured: [], calendar: [], now, gold: [], dxy: [] });
  const jan22 = R.study.CPI.rows.length; assert.ok(jan22 > 0);
  const R2 = build({ inputs: I, rel: null, captured: [], calendar: [], now, keep: 200, gold: [], dxy: [] });
  const r = R2.study.CPI.rows.find((x) => x.day === '2022-01-12'), core = r.fields.find((f) => f.k === 'core');
  assert.equal(core.actual, 0.6); assert.equal(core.actSrc, 'first print'); assert.equal(core.model, 0.4);
  const j = R2.study.NFP.rows.find((x) => x.day === '2022-01-07'); assert.equal(j.fields[0].actual, 199); assert.equal(j.fields[0].revision, 141);
});

test('capturedFrom reads the three files; the strategist fetches the release series once a day', async () => {
  const c = capturedFrom({ expectations: [{ event: 'CPI m/m', country: 'USD', scheduledUtc: 'x', expectation: { consensus: '0.3%' } }], events: [{ key: 'USD|PPI m/m', at: 'y', forecast: '0.2%' }], cal: [{ title: 'Retail Sales m/m', country: 'USD', at: 1794000000, forecast: '0.1%' }] });
  assert.deepEqual(c.map((x) => x.title), ['CPI m/m', 'PPI m/m', 'Retail Sales m/m']);
  let calls = 0; const f = async () => { calls++; return { ok: true, status: 200, text: async () => 'observation_date,X\n2026-10-01,1\n2026-11-01,2\n' }; };
  const a = await releaseSeries(f, now, null, true); assert.ok(calls >= 10 && a.day === '2026-11-19');
  const b = await releaseSeries(f, now, a, true); assert.equal(b, a); assert.ok(calls < 21, 'kept for the day');
  assert.equal(await releaseSeries(f, now, null, false), null, 'never while FRED is unreachable');
});

test('the desk and the veteran are wired', () => {
  const page = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  for (const w of ['id="s-red"', 'renderRed(rf)', "get('macro/redfolder.json')", 'href="#s-red"']) assert.ok(page.includes(w), w);
  const vet = fs.readFileSync(new URL('../council/veteran.mjs', import.meta.url), 'utf8'); assert.match(vet, /w\('redfolder\.json', RF\)/);
  const mod = fs.readFileSync(new URL('../council/redfolder.mjs', import.meta.url), 'utf8'); assert.ok(!/fetch\(/.test(mod));
});

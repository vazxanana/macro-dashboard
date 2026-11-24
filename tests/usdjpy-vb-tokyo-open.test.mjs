// usdjpy-vb-tokyo-open: day builders on hand-made candles, no look-ahead, the decision rule, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tokyoDays, nyDays, hourDays, trades, anchoredSkip, paired, decide, report } from '../research/edge/usdjpy-vb-tokyo-open/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/usdjpy-vb-tokyo-open/result.json', import.meta.url)));
const T0 = Date.UTC(2024, 0, 9, 15) / 1000;    // Tue 9 Jan 2024 15:00 UTC = 00:00 Wed 10 Jan Tokyo

function series(from, n, f) { const out = []; for (let i = 0; i < n; i++) { const t = from + i * 300, p = f(i); out.push([t, p, p + 0.02, p - 0.02, p]); } return out; }

test('the Tokyo day starts at 15:00 UTC and is dated by the Tokyo date', () => {
  const rows = series(T0 - 86400, 2 * 288, (i) => 140 + (i % 288) * 0.001);
  const d = tokyoDays(rows);
  assert.equal(d.length, 2);
  assert.equal(d[1].day, '2024-01-10');
  assert.equal(d[1].d0, T0);
  assert.equal(d[1].bars[0].t, T0);
  assert.equal(d[1].bars.at(-1).t, T0 + 86400 - 300);
  assert.ok(Math.abs(d[1].prevRange - (0.287 + 0.04)) < 1e-9);
});

test('no look-ahead: a day\'s trade does not change when later candles change', () => {
  const rows = series(T0 - 86400, 3 * 288, (i) => 140 + Math.sin(i / 20) * 0.6);
  const a = trades(tokyoDays(rows), anchoredSkip).find((x) => x.day === '2024-01-10');
  const cut = rows.map((r) => (r[0] >= T0 + 86400 ? [r[0], 150, 150.1, 149.9, 150] : r));
  const b = trades(tokyoDays(cut), anchoredSkip).find((x) => x.day === '2024-01-10');
  assert.ok(a && b);
  assert.deepEqual(a, b);
});

test('every trade has its stop at the open, on the losing side', () => {
  const rows = series(T0 - 86400, 3 * 288, (i) => 140 + Math.sin(i / 15) * 0.8);
  for (const tr of [trades(tokyoDays(rows), anchoredSkip), trades(nyDays(rows), anchoredSkip), trades(hourDays(rows, 6), anchoredSkip)])
    for (const x of tr) assert.ok(x.side * (x.entry - x.stop) > 0);
});

test('paired difference and the decision rule', () => {
  const v = [{ day: '2020-01-02', net: 1 }, { day: '2020-02-02', net: 0.5 }], u = [{ day: '2020-01-03', net: 0 }, { day: '2020-02-03', net: 0 }];
  const p = paired(v, u);
  assert.equal(p.months, 2); assert.equal(p.d, 0.75);
  const row = (d, net) => ({ discovery: { pair: { d }, v: { netR: net, n: 300 } }, confirmation: { pair: { d }, v: { netR: net, n: 300 } } });
  assert.equal(decide(row(0.1, 0.1), 0.01, 0.9), 'BETTER');
  assert.equal(decide(row(-0.1, 0.1), 0.9, 0.01), 'WORSE');
  assert.equal(decide(row(-0.1, 0.1), 0.9, 0.2), 'NO DIFFERENCE SHOWN');
});

test('result.json: gate, figures and verdict as reported', () => {
  assert.equal(R.gate.ok, true);
  assert.equal(R.gate.got.early.n, 2089); assert.equal(R.gate.got.late.n, 2079);
  assert.ok(R.verdict.startsWith('NO DIFFERENCE SHOWN'));
  for (const t of R.tests) assert.equal(t.decision, 'NO DIFFERENCE SHOWN');
  assert.equal(R.days['UTC (the rule)'].pooled.netR, 0.072);
  assert.equal(R.days['B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h)'].pooled.n, 3560);
  assert.equal(R.control.length, 24);
  const md = fs.readFileSync(new URL('../research/edge/usdjpy-vb-tokyo-open/RESULT.md', import.meta.url), 'utf8');
  assert.equal(md, report(R));
});

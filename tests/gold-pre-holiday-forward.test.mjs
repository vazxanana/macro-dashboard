// gold-pre-holiday-forward: the frozen pieces of the forward record (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../research/edge/gold-pre-holiday-forward/run.mjs';

test('the source study is the pinned copy and the baseline its 92 out-of-sample T1 trades', () => {
  F.checkSource();
  const b = F.baseline();
  assert.equal(b.length, 92);
  assert.equal(Math.round(b.reduce((s, v) => s + v, 0) / b.length * 1000) / 1000, 0.133);
});

test('the harness reproduces the study on real candles (Juneteenth, Independence Day 2026)', () => {
  const rows = JSON.parse(fs.readFileSync(new URL('./fixtures/xau-h1-2026-06.json', import.meta.url), 'utf8'));
  const study = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-pre-holiday/result.json', import.meta.url), 'utf8')).tests.T1.trades;
  const ev = F.forwardEvents(rows, Date.parse('2026-07-10') / 1000, '2026-06-10');
  assert.deepEqual(ev.events.map((x) => x.date), ['2026-06-19', '2026-07-03']);
  for (const x of ev.events) assert.equal(x.net, study.find((y) => y.date === x.date).net);
});

test('a holiday whose event day is not closed is not counted, and nothing before the cut is', () => {
  const rows = JSON.parse(fs.readFileSync(new URL('./fixtures/xau-h1-2026-06.json', import.meta.url), 'utf8'));
  const cut = rows.filter((r) => r[0] < Date.parse('2026-07-02T21:00:00Z') / 1000);
  assert.deepEqual(F.forwardEvents(cut, Date.parse('2026-07-03') / 1000, '2026-06-10').events.map((x) => x.date), ['2026-06-19']);
  assert.equal(F.forwardEvents(rows, Date.parse('2026-07-10') / 1000).events.length, 0);
});

test('bands, readings and checkpoints follow the pre-registration', () => {
  const b = F.baseline(), A = F.bands(b, 20, { draws: 4000 }), B = F.bands(b, 20, { draws: 4000, shift: 0.133 });
  assert.deepEqual(A, F.bands(b, 20, { draws: 4000 }));
  assert.ok(A.p50 > B.p50 && A.p5 < A.p50 && A.p50 < A.p95);
  const a = { p5: -3, p50: 2, p95: 7 }, n = { p95: 4 };
  assert.equal(F.reading(9, 50, a, n), 'too few');
  assert.equal(F.reading(10, -4, a, n), 'below the measured range');
  assert.equal(F.reading(10, 5, a, n), 'ahead of a no-edge rule');
  assert.equal(F.checkAt(20, -4, a, n, 0), 'fails');
  assert.equal(F.checkAt(20, 0, a, n, 0), 'holds so far');
  assert.equal(F.checkAt(40, 5, a, n, 2.1), 'confirmed');
  assert.equal(F.checkAt(40, 5, a, n, 1.5), 'not shown either way');
});

test('the first crossing stands', () => {
  const base = F.baseline(), ev = (n, net) => ({ events: Array.from({ length: n }, (_, i) => ({ date: `2028-01-${String(i + 1).padStart(2, '0')}`, net })), skipped: [], dataEnd: '2028-12-31' });
  const first = F.build(ev(20, -1), base, null);
  assert.equal(first.crossed[20].reading, 'fails');
  assert.match(first.verdict, /^FAIL/);
  assert.equal(F.build(ev(21, 1), base, first).crossed[20].reading, 'fails');
});

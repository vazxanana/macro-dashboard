// turnaround-tuesday-forward: the frozen pieces of the forward record (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../research/edge/turnaround-tuesday-forward/run.mjs';

const DIR = new URL('../research/edge/turnaround-tuesday-forward/', import.meta.url);
const bars = JSON.parse(fs.readFileSync(new URL('./fixtures/nas100-h1-2026-10.json', import.meta.url), 'utf8'));

test('the study copy is the pinned one, and the baseline is its 2016-26 NAS100 R2 record', () => {
  F.checkSource();
  const b = F.baseline();
  assert.equal(b.length, 81);
  assert.equal(F.AFTER, '2026-11-12');
  assert.equal(F.frozenRate()(0), F.frozenRate()(1e10));
});

test('the forward code rebuilds the study\'s own 2 Nov 2026 trade to the cent', () => {
  const ev = F.forwardTrades(bars, '2026-10-25');
  assert.equal(ev.trades.length, 1);
  const t = ev.trades[0], r = JSON.parse(fs.readFileSync(new URL('../turnaround-tuesday/result.json', DIR), 'utf8'));
  const s = r.cells['nas100-r2'].trades.find((x) => x[0] === '2026-11-02');
  assert.equal(t.day, s[0]); assert.equal(t.exitD, s[1]); assert.equal(t.how, s[2]); assert.equal(t.R, s[6]);
  assert.equal(F.forwardTrades(bars).trades.length, 0, 'no week after 12 Nov is in the fixture');
});

test('bands are seeded, B is centred near zero, readings and checkpoints follow the pre-registration', () => {
  const b = F.baseline(), A = F.bands(b, 20, { draws: 3000 }), A2 = F.bands(b, 20, { draws: 3000 });
  const m = b.reduce((s, v) => s + v, 0) / b.length, B = F.bands(b, 20, { draws: 3000, shift: m });
  assert.deepEqual(A, A2); assert.ok(A.p50 > B.p50 && Math.abs(B.p50) < 1);
  const a = { p5: -2, p50: 3, p95: 8 }, bb = { p95: 5 };
  assert.equal(F.reading(9, 100, a, bb), 'too few');
  assert.equal(F.reading(10, -3, a, bb), 'below the measured range');
  assert.equal(F.reading(10, 6, a, bb), 'ahead of a no-edge rule');
  assert.equal(F.reading(10, 1, a, bb), 'undecided');
  assert.equal(F.checkAt(20, -3, a, bb, 0), 'fails');
  assert.equal(F.checkAt(20, 0, a, bb, 0), 'holds so far');
  assert.equal(F.checkAt(40, 6, a, bb, 2.1), 'confirmed');
  assert.equal(F.checkAt(40, 6, a, bb, 1.9), 'not shown either way');
});

test('the first crossing of a checkpoint stands', () => {
  const base = F.baseline(), tr = (n, R) => ({ trades: Array.from({ length: n }, (_, i) => ({ day: `2027-01-${String(1 + (i % 28)).padStart(2, '0')}`, R })), skipped: [], dataEnd: '2027-06-01' });
  const first = F.build(tr(20, -1), base, null);
  assert.equal(first.crossed[20].reading, 'fails');
  assert.match(first.verdict, /^FAIL/);
  const later = F.build({ ...tr(22, 1), dataEnd: '2027-07-01' }, base, first);
  assert.equal(later.crossed[20].at, '2027-06-01');
  assert.match(F.build(tr(3, 0.1), base, null).verdict, /^INCONCLUSIVE so far/);
});

test('the pre-registration names the rule, the date and the output file', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(p, /2026-11-12/);
  assert.match(p, /research\/forward\/turnaround-tuesday\.json/);
});

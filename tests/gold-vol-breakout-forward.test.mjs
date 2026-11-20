// gold-vol-breakout-forward: the frozen pieces of the forward record (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as F from '../research/edge/gold-vol-breakout-forward/run.mjs';

const DIR = new URL('../research/edge/gold-vol-breakout-forward/', import.meta.url);

test('the rule copies are the pinned ones, and the cost is the committed hourcost profile', () => {
  F.checkCopies();
  const c = F.frozenCost();
  assert.equal(c.commission, 0.000024);
  assert.equal(c.profile.length >= 21, true);
  assert.equal(c.probe.days, 44);
});

test('the baseline is the W4 C1 trades, gated, up to 12 Nov 2026', () => {
  const b = JSON.parse(fs.readFileSync(new URL('baseline.json', DIR), 'utf8'));
  assert.deepEqual(b.gate, F.BASE_WANT);
  assert.equal(b.rows.length, 1121);
  assert.ok(b.rows.every(([d]) => d >= '2021-01-01' && d <= '2026-11-12'));
  assert.equal(F.START, '2026-11-13');
});

test('bands: seeded, A above B, and the no-edge world centred on zero', () => {
  const b = JSON.parse(fs.readFileSync(new URL('baseline.json', DIR), 'utf8')), m = F.monthsOf(b.rows);
  const A = F.bands(m, 120, { draws: 4000 }), A2 = F.bands(m, 120, { draws: 4000 }), B = F.bands(m, 120, { draws: 4000, shift: b.mean });
  assert.deepEqual(A, A2);
  assert.ok(A.p50 > B.p50 && A.p5 < A.p50 && A.p50 < A.p95);
  assert.ok(Math.abs(B.p50) < 2.5);
});

test('readings and checkpoints follow the pre-registration', () => {
  const A = { p5: -5, p50: 10, p95: 25 }, B = { p95: 15 };
  assert.equal(F.reading(19, 100, A, B), 'too few');
  assert.equal(F.reading(30, -6, A, B), 'below the measured range');
  assert.equal(F.reading(30, 16, A, B), 'ahead of a no-edge rule');
  assert.equal(F.reading(30, 5, A, B), 'undecided');
  assert.equal(F.checkpoint(119, 0, A, B, 3), null);
  assert.equal(F.checkpoint(120, -6, A, B, 0), 'fails');
  assert.equal(F.checkpoint(130, 0, A, B, 0), 'holds so far');
  assert.equal(F.checkpoint(240, 16, A, B, 2.1), 'confirmed');
  assert.equal(F.checkpoint(240, 16, A, B, 1.9), 'not shown either way');
});

test('the first crossing of a checkpoint stands', () => {
  const base = { mean: 0.1, rows: Array.from({ length: 240 }, (_, i) => [`2022-${String(1 + (i % 12)).padStart(2, '0')}-10`, i % 2 ? 0.5 : -0.3]) };
  const tr = (n, net) => Array.from({ length: n }, (_, i) => ({ day: `2027-${String(1 + (i % 12)).padStart(2, '0')}-0${1 + (i % 9)}`, net, R: net, side: 'buy', session: 'Asia' }));
  const first = F.build(tr(120, -1), base, '2027-06-01', null);
  assert.equal(first.crossed[120].reading, 'fails');
  const later = F.build(tr(125, 1), base, '2027-06-08', first);
  assert.equal(later.crossed[120].reading, 'fails');
  assert.equal(later.crossed[120].at, '2027-06-01');
});

test('the pre-registration was committed before run.mjs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(p, /2026-11-13/);
  assert.match(p, /20261120/);
  assert.ok(crypto.createHash('sha256').update(p).digest('hex').length === 64);
});

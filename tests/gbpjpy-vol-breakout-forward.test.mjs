// gbpjpy-vol-breakout-forward: the forward record of T1 on GBP/JPY (research/edge/gbpjpy-vol-breakout-forward). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { START, build, forwardTrades } from '../research/edge/gbpjpy-vol-breakout-forward/run.mjs';

const DIR = new URL('../research/edge/gbpjpy-vol-breakout-forward/', import.meta.url);
const base = JSON.parse(fs.readFileSync(new URL('baseline.json', DIR), 'utf8'));

test('gbpjpy forward: the baseline is the yen-crosses study\'s GBP/JPY 2016 on set, gated', () => {
  const fx = JSON.parse(fs.readFileSync(new URL('../research/edge/yen-crosses-vol-breakout/result.json', import.meta.url), 'utf8')).series.gbpjpy.b;
  assert.deepEqual(base.gate, { n: fx.n, netR: fx.netR });
  assert.equal(base.rows.length, fx.n);
  assert.ok(base.rows.every(([d]) => d >= '2016-01-01' && d < START), 'no baseline day reaches the forward window');
});

test('gbpjpy forward: only days from the start count; readings follow the gold record\'s rules; the first crossing stands', () => {
  const d0 = Date.parse('2026-11-24T00:00:00Z') / 1000, mk = (t0, day) => ({ day, d0: t0, prevRange: 1, bars: Array.from({ length: 240 }, (_, i) => ({ t: t0 + i * 300, o: 199 + i * 0.01, h: 199 + i * 0.01 + 0.02, l: 199 + i * 0.01 - 0.005, c: 199 + i * 0.01 + 0.01 })) });
  assert.equal(forwardTrades([mk(d0, '2026-11-24'), mk(d0 + 86400, '2026-11-25')]).length, 1);
  const tr = (n, v) => Array.from({ length: n }, (_, i) => ({ day: `2027-${String(1 + (i % 12)).padStart(2, '0')}-0${1 + (i % 5)}`, net: v, R: v }));
  assert.equal(build(tr(5, 1), base, 'x', null).reading, 'too few');
  const f = build(tr(130, -1), base, 'x', null); assert.equal(f.crossed[120].reading, 'fails'); assert.match(f.verdict, /^FAIL/);
  const later = build(tr(130, 1), base, 'y', f); assert.equal(later.crossed[120].reading, 'fails', 'the first crossing stands');
});

test('gbpjpy forward: the report matches result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`)); assert.equal(R.start, START);
});

test('gbpjpy forward: "confirmed" also needs the total at twice the cost above zero', () => {
  const tr = (n, R, net) => Array.from({ length: n }, (_, i) => ({ day: `2027-${String(1 + (i % 12)).padStart(2, '0')}-0${1 + (i % 5)}`, net, R }));
  const thin = build(tr(250, 0.6, 0.25), base, 'x', null); assert.ok(thin.total > 0 && thin.total2x < 0); assert.notEqual(thin.crossed[240].reading, 'confirmed');
  assert.equal(build(tr(5, 1, 0.9), base, 'x', null).total2x, 4);
});

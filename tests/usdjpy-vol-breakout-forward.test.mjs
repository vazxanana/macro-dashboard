// usdjpy-vol-breakout-forward: the forward record of T1 on USD/JPY (research/edge/usdjpy-vol-breakout-forward). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { START, build, forwardTrades } from '../research/edge/usdjpy-vol-breakout-forward/run.mjs';

const DIR = new URL('../research/edge/usdjpy-vol-breakout-forward/', import.meta.url);
const base = JSON.parse(fs.readFileSync(new URL('baseline.json', DIR), 'utf8'));

test('usdjpy forward: the baseline is fx-vol-breakout\'s USD/JPY 2016-26 set, gated', () => {
  const fx = JSON.parse(fs.readFileSync(new URL('../research/edge/fx-vol-breakout/result.json', import.meta.url), 'utf8')).series.usdjpy.all;
  assert.deepEqual(base.gate, { n: fx.n, netR: fx.netR });
  assert.equal(base.rows.length, fx.n);
  assert.ok(base.rows.every(([d]) => d >= '2016-01-01' && d < START), 'no baseline day reaches the forward window');
});

test('usdjpy forward: only days from the start count; readings follow the gold record\'s rules; the first crossing stands', () => {
  const d0 = Date.parse('2026-11-19T00:00:00Z') / 1000, mk = (t0, day) => ({ day, d0: t0, prevRange: 1, bars: Array.from({ length: 240 }, (_, i) => ({ t: t0 + i * 300, o: 150 + i * 0.01, h: 150 + i * 0.01 + 0.02, l: 150 + i * 0.01 - 0.005, c: 150 + i * 0.01 + 0.01 })) });
  assert.equal(forwardTrades([mk(d0, '2026-11-19'), mk(d0 + 86400, '2026-11-20')]).length, 1);
  const tr = (n, v) => Array.from({ length: n }, (_, i) => ({ day: `2027-${String(1 + (i % 12)).padStart(2, '0')}-0${1 + (i % 5)}`, net: v, R: v }));
  assert.equal(build(tr(5, 1), base, 'x', null).reading, 'too few');
  const f = build(tr(130, -1), base, 'x', null); assert.equal(f.crossed[120].reading, 'fails'); assert.match(f.verdict, /^FAIL/);
  const later = build(tr(130, 1), base, 'y', f); assert.equal(later.crossed[120].reading, 'fails', 'the first crossing stands');
});

test('usdjpy forward: the report matches result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`)); assert.equal(R.start, START);
});

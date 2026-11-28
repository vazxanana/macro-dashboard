// eurjpy-egr-forward: the forward record of the EUR/JPY engulf-retest sell (research/edge/eurjpy-egr-forward). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { START, build, costed, forwardTrades, marketOf } from '../research/edge/eurjpy-egr-forward/run.mjs';

const DIR = new URL('../research/edge/eurjpy-egr-forward/', import.meta.url);
const base = JSON.parse(fs.readFileSync(new URL('baseline.json', DIR), 'utf8'));

test('eurjpy forward: the baseline is the exec study\'s 106 window orders, gated, all before the start', () => {
  const ex = JSON.parse(fs.readFileSync(new URL('../research/edge/eurjpy-egr-exec/result.json', import.meta.url), 'utf8')).primary;
  assert.deepEqual(base.gate, { n: ex.orders, mid: ex.mid.mean });
  assert.equal(base.rows.length, 106);
  assert.ok(base.rows.every(([d]) => d >= '2023-12-01' && d < '2026-11-21' && d < START));
  assert.ok(base.mean > 0 && base.mean < ex.mid.mean, 'the cost comes off the mid R');
});

test('eurjpy forward: the cost is commission and the short\'s swap; twice the cost is lower', () => {
  const t0 = Date.parse('2026-12-01T10:00:00Z') / 1000, bars = Array.from({ length: 30 }, (_, i) => ({ t: t0 + i * 3600, o: 160, h: 160.05, l: 159.95, c: 160 }));
  const D = marketOf(bars), o = { ts: t0, fillM: 160, D: 0.2, stop: 160.2, tgt: 159.7, midR: 1.45, timeExit: false, deadEnd: t0 + 24 * 3600 };
  const c = costed(D, o); assert.ok(c.net < c.R && c.R2 < c.net); assert.equal(c.how, 'target');
});

test('eurjpy forward: no order before the start and no order whose hold is not on file is counted', () => {
  const t0 = Date.parse('2026-11-20T00:00:00Z') / 1000;
  const bars = Array.from({ length: 900 }, (_, i) => { const c = 160 + Math.sin(i / 7) * 0.8 + (i % 13) * 0.01; return { t: t0 - 800 * 3600 + i * 3600, o: c - 0.05, h: c + 0.2, l: c - 0.2, c }; });
  const tr = forwardTrades(marketOf(bars)), last = bars.at(-1).t + 3600;
  assert.ok(tr.every((x) => x.day >= START));
  assert.ok(tr.every((x) => x.ts + 24 * 3600 <= last));
});

test('eurjpy forward: readings follow the gold record\'s rules; the first crossing stands; the report matches', () => {
  const tr = (n, v) => Array.from({ length: n }, (_, i) => ({ day: `2027-${String(1 + (i % 12)).padStart(2, '0')}-0${1 + (i % 5)}`, net: v, R: v, R2: v }));
  assert.equal(build(tr(5, 1), base, 'x', null).reading, 'too few');
  const f = build(tr(130, -1), base, 'x', null); assert.equal(f.crossed[120].reading, 'fails'); assert.match(f.verdict, /^FAIL/);
  assert.equal(build(tr(130, 1), base, 'y', f).crossed[120].reading, 'fails');
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`)); assert.equal(R.start, START);
});

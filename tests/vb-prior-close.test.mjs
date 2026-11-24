// vb-prior-close: the split rule, the relabelling control and the committed result (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { clv, third, group, prevBars, evalWindow, control } from '../research/edge/vb-prior-close/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-prior-close/result.json', import.meta.url), 'utf8'));

test('vb-prior-close: thirds and with / against', () => {
  assert.equal(clv({ high: 10, low: 0, close: 8 }), 0.8);
  assert.equal(clv({ high: 5, low: 5, close: 5 }), null);
  assert.equal(third(2 / 3), 'top'); assert.equal(third(1 / 3), 'bottom'); assert.equal(third(0.5), 'mid'); assert.equal(third(null), null);
  assert.equal(group(1, 'top'), 'with'); assert.equal(group(-1, 'bottom'), 'with');
  assert.equal(group(1, 'bottom'), 'against'); assert.equal(group(-1, 'top'), 'against'); assert.equal(group(1, 'mid'), 'mid');
});

test('vb-prior-close: the previous day is known before the trade day (weekend folded, no look-ahead)', () => {
  // Fri 2024-01-05, Sat, Sun stub, Mon 2024-01-08, Tue
  const day = (iso, o, h, l, c) => { const t = Date.parse(iso + 'T00:00:00Z') / 1000; return [[t + 3600, o, h, l, o], [t + 7200, o, h, l, c]]; };
  const rows = [...day('2024-01-05', 10, 12, 9, 11), ...day('2024-01-07', 11, 13, 10, 12), ...day('2024-01-08', 12, 15, 11, 14), ...day('2024-01-09', 14, 16, 13, 15)];
  const P = prevBars(rows);
  assert.equal(P.get('2024-01-09').high, 15);                 // Tuesday sees Monday (Sunday folded in)
  assert.equal(P.get('2024-01-09').low, 10);
  assert.equal(P.get('2024-01-08').close, 11);                // Monday sees Friday
  // changing Tuesday's own prices never changes Tuesday's previous day
  const rows2 = rows.map((r) => (r[0] >= Date.parse('2024-01-09T00:00:00Z') / 1000 ? [r[0], 99, 99, 1, 50] : r));
  assert.deepEqual(prevBars(rows2).get('2024-01-09'), P.get('2024-01-09'));
});

test('vb-prior-close: control keeps the counts and is seeded', () => {
  const tr = Array.from({ length: 60 }, (_, i) => ({ mk: 'xau', day: `2020-0${1 + (i % 9)}-01`, side: i % 2 ? 1 : -1, R: (i % 5) - 2, net: (i % 5) - 2.1, clv: (i % 7) / 6 }));
  assert.deepEqual(control(tr, 20, 7), control(tr, 20, 7));
  const e = evalWindow(tr, 0);
  assert.equal(e.with.n + e.against.n + e.mid.n, 60);
});

test('vb-prior-close: committed result', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/vb-prior-close/PREREGISTRATION.md', import.meta.url))).digest('hex');
  assert.equal(R.planSha256, sha);
  assert.ok(R.gate.ok);
  assert.equal(R.verdictWord, 'FAIL');
  assert.equal(R.tests.T3.CONF.with.n, 1537); assert.equal(R.tests.T3.CONF.against.n, 1507);
  assert.equal(R.tests.T3.CONF.diff, 0.062); assert.equal(R.tests.T3.CONF.welchT, 1.43);
  assert.equal(R.tests.T3.DISC.diff, -0.035);
  for (const k of ['T1', 'T2', 'T3']) assert.equal(R.decision[k].pass, false);
  assert.match(fs.readFileSync(new URL('../research/edge/vb-prior-close/RESULT.md', import.meta.url), 'utf8'), /^# .*\n\n\*\*Verdict: FAIL/);
});

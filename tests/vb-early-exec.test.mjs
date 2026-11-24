// vb-early-exec: T1's early (fill candle before 06:00 UTC) against late fills at the broker's own fills. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isEarly, isEarlyBroker, welch, monthDiff, verdictOf, CUT_S, PROBES } from '../research/edge/vb-early-exec/run.mjs';

const DIR = new URL('../research/edge/vb-early-exec/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));

test('vb-early-exec: the split on a hand example (06:00 UTC is late; the broker clock in ms)', () => {
  assert.equal(CUT_S, 21600);
  const d0 = 1736121600;
  assert.equal(isEarly({ d0, fillT: d0 + 5 * 3600 + 55 * 60 }), true, '05:55 candle is early');
  assert.equal(isEarly({ d0, fillT: d0 + 6 * 3600 }), false, '06:00 candle is late');
  assert.equal(isEarly({ d0, fillT: d0 }), true);
  assert.equal(isEarlyBroker({ d0 }, { filled: true, tickMs: (d0 + 21599) * 1000 }), true);
  assert.equal(isEarlyBroker({ d0 }, { filled: true, tickMs: (d0 + 21600) * 1000 }), false);
  assert.equal(isEarlyBroker({ d0 }, { filled: false, tickMs: null }), false);
});

test('vb-early-exec: Welch t and the month difference on a hand example', () => {
  const w = welch([1, 2, 3], [0, 0, 1]);
  assert.ok(Math.abs(w.diff - (2 - 1 / 3)) < 1e-12);
  const se = Math.sqrt(1 / 3 + (1 / 3) / 3); assert.ok(Math.abs(w.t - (2 - 1 / 3) / se) < 1e-12);
  const m = monthDiff([{ day: '2025-01-02', early: true, net: 1 }, { day: '2025-01-03', early: false, net: 0 },
    { day: '2025-02-02', early: true, net: 2 }, { day: '2025-02-03', early: false, net: 1 }, { day: '2025-03-01', early: true, net: 5 }]);
  assert.equal(m.months, 2); assert.equal(m.mean, 1);
});

test('vb-early-exec: the gate reproduced both exec studies, and the verdict follows the pre-registered bar', () => {
  for (const k of ['xau', 'usdjpy']) {
    assert.equal(R.gate[k].ok, true, k);
    const pub = JSON.parse(fs.readFileSync(new URL(`../${k === 'xau' ? 'gold' : 'usdjpy'}-vol-breakout-exec/result.json`, DIR), 'utf8')).stats;
    assert.equal(R.gate[k].n, pub.n); assert.equal(R.gate[k].net, pub.net); assert.equal(R.gate[k].monthT, pub.monthT);
  }
  assert.equal(R.verdict.split(':')[0], verdictOf(R.tests));
  assert.equal(R.verdict.split(':')[0], 'PASS');
  const T = R.tests;
  assert.equal(T.pooled.early.n + T.pooled.late.n, T.xau.early.n + T.xau.late.n + T.usdjpy.early.n + T.usdjpy.late.n);
  assert.equal(T.pooled.early.n, 387); assert.equal(T.pooled.late.n, 756);
  assert.equal(T.pooled.diff, 0.2523); assert.equal(T.pooled.t, 2.4162); assert.equal(T.pooled.holm, 0.0481);
  assert.equal(T.xau.diff, 0.3782); assert.equal(T.usdjpy.diff, 0.1394); assert.equal(T.usdjpy.t, 0.9992);
  assert.ok(T.xau.diff > 0 && T.usdjpy.diff > 0 && T.pooled.month.t > 0);
  // the bar on made-up numbers
  const mk = (diff, t, holm, mt, thin = false) => ({ diff, t, holm, month: { t: mt }, thin });
  assert.equal(verdictOf({ pooled: mk(0.2, 2.5, 0.01, 1), xau: mk(0.1, 1, 1, 1), usdjpy: mk(-0.01, -0.1, 1, 1) }), 'FAIL');
  assert.equal(verdictOf({ pooled: mk(0.2, 2.5, 0.06, 1), xau: mk(0.1, 1, 1, 1), usdjpy: mk(0.1, 1, 1, 1) }), 'FAIL');
  assert.equal(verdictOf({ pooled: mk(0.2, 2.5, 0.01, 1), xau: mk(0.1, 1, 1, 1, true), usdjpy: mk(0.1, 1, 1, 1) }), 'INCONCLUSIVE');
});

test('vb-early-exec: the report says what it is, and the probe files are the exec studies\' own', () => {
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.startsWith('# ')); assert.ok(md.split('\n')[2].startsWith(`**Verdict: ${R.verdict}**`));
  assert.match(md, /in sample for T1/); assert.match(md, /never an edge or a rule change/);
  const g = fs.readFileSync(new URL('../gold-vol-breakout-exec/RESULT.md', DIR), 'utf8');
  assert.ok(g.includes('a00d5984d') && g.includes('5d2ae2dcd'));
  const u = JSON.parse(fs.readFileSync(new URL('../usdjpy-vol-breakout-exec/result.json', DIR), 'utf8'));
  assert.equal(u.probe.commit, `${PROBES['uj-a.json'][0]},${PROBES['uj-b.json'][0]}`);
});

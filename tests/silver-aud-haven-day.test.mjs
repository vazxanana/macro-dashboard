// research/edge/silver-aud-haven-day: the haven-day signal on hand-made closes, no look-ahead, the trade's stop and costs, and
// the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, tradeAt, simulate, holm, verdictOf, headline, report, DAY, RT, VOL_N, controlParts, parts, MIN_EVENTS } from '../research/edge/silver-aud-haven-day/run.mjs';

const T0 = Date.UTC(2020, 0, 6) / 1000;
const pts = (gs, as) => gs.map((g, i) => ({ t: T0 + i * DAY, g, a: as[i] }));
// alternating closes: every daily log return is +-ln(1.01)
const wiggle = (n, base) => Array.from({ length: n }, (_, i) => base * (i % 2 ? 1.01 : 1));

test('a haven day needs silver up and the Australian dollar down, each by the threshold', () => {
  const g = wiggle(VOL_N + 1, 100), a = wiggle(VOL_N + 1, 0.7);
  const last = (dg, da) => { const r = signals(pts([...g, g.at(-1) * dg], [...a, a.at(-1) * da]), 0.5, 0.5); return r.at(-1).s; };
  assert.equal(last(1.02, 0.98), 1);
  assert.equal(last(1.02, 1.0), 0); // AUD flat
  assert.equal(last(0.98, 0.98), 0); // gold down
  assert.equal(last(1.001, 0.98), 0); // gold up but below 0.5 sd
  assert.equal(signals(pts([...g, g.at(-1) * 1.008], [...a, a.at(-1) * 0.98]), 1.0, 0.5).at(-1).s, 0); // under 1 sd for T3
});

test('no look-ahead: a day\'s signal does not change when later closes change', () => {
  const n = VOL_N + 40;
  const g = Array.from({ length: n }, (_, i) => 100 + Math.sin(i) * 2 + i * 0.05), a = Array.from({ length: n }, (_, i) => 0.7 + Math.cos(i * 1.3) * 0.01);
  const x = signals(pts(g, a), 0.5, 0.5), g2 = g.slice(), a2 = a.slice();
  for (let i = VOL_N + 20; i < n; i++) { g2[i] *= 1.2; a2[i] *= 0.8; }
  const y = signals(pts(g2, a2), 0.5, 0.5);
  assert.ok(x.some((r) => r.s === 1));
  for (let i = 0; i < x.length; i++) if (x[i].t < T0 + (VOL_N + 20) * DAY) assert.deepEqual(x[i], y[i]);
});

test('a gap of more than five days restarts the 60-day history', () => {
  const p = pts(wiggle(VOL_N + 10, 100), wiggle(VOL_N + 10, 0.7));
  for (let i = 30; i < p.length; i++) p[i].t += 10 * DAY;
  assert.equal(signals(p, 0.5, 0.5).length, 0);
});

test('every trade has a stop below the entry; costs, no financing on silver', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ time: T0 + i * DAY, open: 100, high: 101, low: 99, close: 100 }));
  const b = tradeAt(bars, 25, 1, 5, 2);
  assert.ok(b.stop < b.e);
  assert.equal(b.risk, 4);
  assert.ok(Math.abs(b.cost - RT / 4) < 1e-12);
  bars[26] = { ...bars[26], low: 95 };
  const st = tradeAt(bars, 25, 1, 5, 2);
  assert.equal(st.kind, 'stop'); assert.equal(st.exit, 96);
  const tr = simulate([{ t: bars[20].time, s: 1 }, { t: bars[21].time, s: 1 }], bars.map((x) => ({ ...x, low: 99 })), 5, 2);
  assert.equal(tr.length, 1);
});

test('Holm and the verdict rule', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const mk = (id, t) => ({ id, holm: 0.01, placebo: { beaten: 39 }, is: { netExact: 0.1, signals: 120 }, oos: { tMonth: t, x2: 0.1, excessExact: 0.1, n: 50, signals: 120 } });
  assert.equal(verdictOf([mk('T1', 2.5), mk('T2', 1), mk('T3', 1)]), 'PASS');
  assert.equal(verdictOf([mk('T1', 1.9), mk('T2', 2.1), mk('T3', 1)]), 'PARTIAL');
  assert.equal(verdictOf([mk('T1', 1.9), mk('T2', 1), mk('T3', 1)]), 'FAIL');
});

test('the report agrees with result.json', () => {
  const dir = new URL('../research/edge/silver-aud-haven-day/', import.meta.url);
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.equal(md, report(r));
  assert.ok(md.includes(headline(r)));
  assert.ok(headline(r).length < 220);
  assert.equal(r.verdict, verdictOf(r.tests));
  assert.ok(md.includes(`**Verdict: ${r.verdict}`));
  assert.equal(r.tests.length, 3);
  for (const t of r.tests) { assert.equal(t.placebo.t.length, 40); assert.deepEqual(t.sides, [1]); }
  assert.ok(r.context.z05.is.haven < MIN_EVENTS);
  for (const t of r.tests) { assert.equal(t.checks.events100, false); assert.equal(t.control.t.length, 40); }
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.tests[0].is.signals, r.context.z05.is.haven);
});

test('under 100 events in a window no test passes, and the control keeps the metal real', () => {
  const mk = (id, t, ev) => ({ id, holm: 0.01, placebo: { beaten: 39 }, is: { netExact: 0.1, signals: ev }, oos: { tMonth: t, x2: 0.1, excessExact: 0.1, n: 50, signals: 120 } });
  assert.equal(verdictOf([mk('T1', 3, 86), mk('T2', 3, 86), mk('T3', 3, 37)]), 'FAIL');
  const n = VOL_N + 400, T = Date.UTC(2019, 0, 1) / 1000;
  const p = Array.from({ length: n }, (_, i) => ({ t: T + i * DAY, g: 20 + Math.sin(i * 0.7), a: 0.7 + 0.01 * Math.cos(i * 1.1) }));
  const ps = parts(p), c = controlParts(ps, 1001);
  for (let i = 0; i < ps.length; i++) { assert.equal(c[i].g, ps[i].g); assert.equal(c[i].sa, ps[i].sa); }
  const sorted = (a) => [...a].sort((x, y) => x - y);
  assert.deepEqual(sorted(c.map((x) => x.a)), sorted(ps.map((x) => x.a)));
});

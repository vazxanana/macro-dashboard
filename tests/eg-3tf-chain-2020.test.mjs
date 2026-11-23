// node --test tests/eg-3tf-chain-2020.test.mjs - the pre-registered three-timeframe engulf chain (research/edge/eg-3tf-chain-2020),
// offline: the close-based cut on hand-made candles (stop first, gap, target, cut only at a confirmation close), no look-ahead in
// the cut, the pass bar, the stop-buffer key for markets the desk does not list, and RESULT.md / result.json against each other.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withCut, judge, keyFor, TESTS, MARKETS18 } from '../research/edge/eg-3tf-chain-2020/run.mjs';

const DIR = new URL('../research/edge/eg-3tf-chain-2020/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const T0 = Date.UTC(2024, 0, 8) / 1000;
const bar = (i, o, h, l, c) => ({ t: T0 + i * 300, o, h, l, c, e: T0 + (i + 1) * 300 });
// a buy at 100, stop 98, target 104, confirmation zone 99..101 on M15 (three 5m candles a confirmation candle)
const TR = { side: 1, entry: 100, stop: 98, target: 104, l: '15m', t: T0, marks: [{}, {}, { top: 101, bot: 99 }] };

test('the cut ends a trade only at the close of a confirmation candle beyond the zone', () => {
  // 5m closes under 99 inside the candle (index 1) do not cut; the last 5m of the first M15 candle (index 2) closes at 98.6: cut
  const M5 = [bar(0, 100.5, 100.6, 99.9, 100.2), bar(1, 100.2, 100.3, 98.5, 98.7), bar(2, 98.7, 99.2, 98.4, 98.6), bar(3, 98.6, 99, 98.1, 98.9)];
  const r = withCut(M5, TR);
  assert.equal(r.how, 'cut'); assert.equal(r.endT, T0 + 900); assert.ok(Math.abs(r.R - (-0.7)) < 1e-9);
});
test('the stop comes first inside a candle, a gap exits at the open, the target is never taken on the fill candle', () => {
  assert.equal(withCut([bar(0, 100.5, 105, 97.9, 100), bar(1, 100, 101, 99.5, 100.5)], TR).how, 'stop');
  const g = withCut([bar(0, 100.5, 100.6, 99.9, 100.2), bar(1, 97, 97.5, 96, 97)], TR); assert.equal(g.how, 'stop'); assert.ok(Math.abs(g.R + 1.5) < 1e-9);
  const t = withCut([bar(0, 100.5, 104.5, 99.9, 100.2), bar(1, 100.2, 104.2, 100, 104)], TR); assert.equal(t.how, 'target'); assert.equal(t.endT, T0 + 300); assert.equal(t.R, 2);
  assert.equal(withCut([bar(0, 100.5, 100.6, 99.9, 100.2), bar(1, 100.2, 100.3, 99.9, 100.1)], TR), null, 'still open at the last candle');
});
test('no look-ahead in the cut: a trade that ended before T is the same when every later price changes', () => {
  const M5 = []; let p = 100; for (let i = 0; i < 60; i++) { const c = p + Math.sin(i / 3) * 0.6 - 0.05; M5.push(bar(i, p, Math.max(p, c) + 0.2, Math.min(p, c) - 0.2, c)); p = c; }
  const a = withCut(M5, TR); assert.ok(a && a.endT < M5[40].t);
  const B = M5.map((b, i) => (i < 40 ? b : { ...b, o: b.o + 9, h: b.h + 9, l: b.l + 9, c: b.c + 9 }));
  assert.deepEqual(withCut(B, TR), a);
});
test('the pass bar and the desk stop-buffer key', () => {
  const ok = { disc: { n: 120, mean: 0.1, t: 2.2 }, conf: { n: 60, mean: 0.1, t: 2.3, x2: 0.05 } };
  assert.equal(judge(ok, 0.01), 'PASS');
  assert.equal(judge(ok, 0.2), 'INCONCLUSIVE');
  assert.equal(judge({ ...ok, conf: { ...ok.conf, x2: -0.01 } }, 0.01), 'FAIL');
  assert.equal(judge({ ...ok, disc: { ...ok.disc, mean: -0.01 } }, 0.01), 'FAIL');
  assert.equal(keyFor('xau'), 'xau'); assert.equal(keyFor('nzdusd'), 'eurusd'); assert.equal(keyFor('de40'), 'de40');
  assert.equal(MARKETS18.length, 18); assert.equal(TESTS.length, 6);
});
test('result.json: six tests, Holm and verdicts consistent, the cut check clean', () => {
  assert.equal(R.tests.length, 6); assert.deepEqual(R.tests.map((t) => t.id), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
  for (const t of R.tests) { assert.equal(t.verdict, judge(t, t.holm)); assert.ok(t.holm >= t.pOne - 1e-12); }
  const v = R.tests.some((t) => t.verdict === 'PASS') ? 'PASS' : R.tests.every((t) => t.verdict === 'FAIL') ? 'FAIL' : 'INCONCLUSIVE';
  assert.equal(R.verdict, v);
  assert.ok(Array.isArray(R.cutCheck) && R.cutCheck.length >= 2);
  for (const c of R.cutCheck) for (const k of ['rr', 'zone']) { assert.ok(c[k].before > 0); assert.equal(c[k].missingInCut, 0); assert.equal(c[k].extraInCut, 0); assert.equal(c[k].cutDiff, 0); }
});
test('RESULT.md carries the verdict line and every test figure of result.json, before and after costs', () => {
  const line3 = MD.split('\n')[2];
  assert.ok(line3.startsWith(`**Verdict: ${R.verdict}.`), line3);
  assert.ok(MD.includes(`Before costs (a second verdict`) && MD.includes(`**${R.grossVerdict}**`));
  const f = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
  const rows = (id) => MD.split('\n').filter((l) => l.startsWith(`| ${id} `));
  for (const t of R.tests) {
    const [gross, net] = rows(t.id); assert.ok(gross && net, t.id);
    for (const s of [String(t.disc.n), f(t.disc.mean, 3), f(t.disc.t, 2), String(t.conf.n), f(t.conf.mean, 3), f(t.conf.t, 2), f(t.conf.x2, 3), t.verdict]) assert.ok(net.includes(s), `${t.id}: ${s} in ${net}`);
    const g = t.gross; assert.equal(g.verdict, judge({ disc: g.disc, conf: { ...g.conf, x2: 1 } }, g.holm));
    for (const s of [String(g.disc.n), f(g.disc.mean, 3), f(g.disc.t, 2), String(g.conf.n), f(g.conf.mean, 3), f(g.conf.t, 2), String(g.holm), g.verdict]) assert.ok(gross.includes(s), `${t.id} before costs: ${s} in ${gross}`);
  }
  const gv = R.tests.some((t) => t.gross.verdict === 'PASS') ? 'PASS' : R.tests.every((t) => t.gross.verdict === 'FAIL') ? 'FAIL' : 'INCONCLUSIVE';
  assert.equal(R.grossVerdict, gv);
});

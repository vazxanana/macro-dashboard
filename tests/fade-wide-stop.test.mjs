// tests/fade-wide-stop.test.mjs - wider stops on the two Equinox fades: pre-registration, the verdict follows the bar,
// RESULT.md agrees with result.json, and the stop / outcome rules on hand-made candles (no look-ahead). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { atr14 } from '../research/edge/dom-trade-through/run.mjs';
import { stopDists, kindOf, h1AtrAt, simAll, TESTS, cellName, NCELL, passOf } from '../research/edge/fade-wide-stop/run.mjs';

const DIR = new URL('../research/edge/fade-wide-stop/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration fixes the 8 tests, the windows, the after-cost bar, Holm, the mirror and the assumed costs', () => {
  for (const w of ['T1-T4', 'T5-T8', '1.5, 2 or 3', 'AFTER costs', 'Holm over the 8 tests', 'mirror', 'ASSUMED', 'discovery 2005-01 to 2014-12', 'n >= 200'])
    assert.ok(pre.includes(w), w);
});

test('8 tests, distinct cells, and the verdict follows the bar', () => {
  assert.equal(TESTS.length, 8); assert.equal(R.tests.length, 8);
  assert.equal(new Set(Array.from({ length: NCELL }, (_, i) => cellName(i))).size, NCELL);
  for (const t of R.tests) {
    const ok = t.disc.n >= 200 && t.conf.n >= 200 && t.disc.meanNet > 0 && t.conf.meanNet > 0 && t.conf.tNet >= 2 && t.holm < 0.05 && t.mirror.separated;
    assert.equal(t.pass, ok, t.name);
    assert.equal(passOf({ d: t.disc, c: t.conf }, t.holm) && t.mirror.separated, ok);
  }
  assert.equal(R.verdict, R.tests.some((t) => t.pass) ? 'PASS' : 'FAIL');
  assert.equal(R.verdict, 'FAIL');
  assert.ok(md.startsWith('# Wider stops') && md.includes('**Verdict: FAIL.'));
});

test('RESULT.md quotes result.json, and the gate reproduces the parents to three decimals', () => {
  for (const t of R.tests) {
    const line = md.split('\n').find((l) => l.startsWith(`| ${t.id} |`)); assert.ok(line, t.id);
    for (const x of [f3(t.disc.meanNet), f3(t.conf.meanNet), t.conf.tNet.toFixed(2), f3(t.conf.mean), t.conf.n.toLocaleString('en-US')]) assert.ok(line.includes(x), `${t.id} ${x}`);
  }
  const g = R.gate.break2R.got, b = R.gate.bigHalf.got;
  assert.equal(+g.d.mean.toFixed(3), 0.054); assert.equal(+g.c.mean.toFixed(3), 0.042);
  assert.equal(+b.d.mean.toFixed(3), 0.307); assert.equal(+b.c.mean.toFixed(3), 0.193);
  assert.ok(md.includes(g.c.n.toLocaleString('en-US')) && md.includes(b.c.n.toLocaleString('en-US')));
  for (const e of R.stoppedEitherWay) assert.ok(md.includes((100 * e.alsoStopped).toFixed(1) + '%'), e.rule + e.stop);
});

test('stops: every distance from the fill, losing side, and the outcome kinds', () => {
  assert.deepEqual(stopDists(1, 2, 3), [1, 3, 4, 6, 3]); assert.equal(stopDists(1, 0, 3), null); assert.equal(stopDists(1, 2, 0), null);
  assert.equal(kindOf(-1, 2), 0); assert.equal(kindOf(-1.4, 2), 0); assert.equal(kindOf(2, 2), 1); assert.equal(kindOf(0.3, 2), 2);
  // a buy at 100: with D 1 the low 98.9 stops it at -1R; with D 3 it survives and reaches 1R and 2R (106)
  const M5 = [{ t: 0, o: 100, h: 100.5, l: 98.9, c: 99.5, e: 300 }, { t: 300, o: 99.5, h: 106.2, l: 99.4, c: 106, e: 600 }];
  const s = simAll(M5, 0, 1, [1, 3]);
  assert.deepEqual(s.R[0], [-1, -1]); assert.deepEqual(s.R[1], [1, 2]);
});

test('the H1 ATR reads closed H1 candles only (no look-ahead)', () => {
  const rnd = K.rng(3); let p = 100; const M5 = [];
  for (let i = 0; i < 6000; i++) { const o = p, c = o + (rnd() - 0.5); M5.push({ t: i * 300, o, h: Math.max(o, c) + rnd() * 0.2, l: Math.min(o, c) - rnd() * 0.2, c, e: i * 300 + 300 }); p = c; }
  const ts = 200 * 3600 + 900, H1 = K.resample(M5, 3600), full = h1AtrAt(H1, atr14(H1), ts);
  const Hc = K.resample(M5.filter((b) => b.e <= ts), 3600).filter((b) => b.e <= ts);
  assert.ok(full > 0); assert.equal(full, h1AtrAt(Hc, atr14(Hc), ts));
});

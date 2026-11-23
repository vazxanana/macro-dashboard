// node --test tests/storyline-pairs-2020.test.mjs - the storyline pairs study (research/edge/storyline-pairs-2020).
// Offline and fast: RESULT.md's figures against result.json, the verdict against the pre-registered bar, and the
// no-look-ahead check and stop sides on a seeded synthetic market (no candle cache needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../research/edge/storyline-pairs-2020/run.mjs';
import * as K from '../research/edge/_lib/edgekit.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'storyline-pairs-2020');
const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
const f3 = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);

test('the verdict follows the pre-registered bar', () => {
  assert.equal(res.tests.length, 6);
  assert.deepEqual(res.tests.map((x) => x.test), R.TESTS);
  const holm = K.holm(res.tests.map((x) => x.conf.p1));
  res.tests.forEach((x, i) => assert.ok(Math.abs(holm[i] - x.holm) < 1e-3, x.test));
  const J = R.judge(res.tests.map((x) => ({ ...x })), res.tests.map((x) => x.holm));
  assert.deepEqual(J.map((x) => x.pass), res.tests.map((x) => x.pass));
  assert.equal(R.verdictOf(J), res.verdict);
  assert.match(md.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + res.verdict + '\\.'));
});

test('the second verdict, before costs, follows the same bar on R before costs', () => {
  const hb = K.holm(res.tests.map((x) => x.confBefore.p1));
  res.tests.forEach((x, i) => {
    const d = x.discBefore, c = x.confBefore, b = res.beforeCosts.tests[i];
    assert.equal(b.test, x.test); assert.ok(Math.abs(b.holm - hb[i]) < 1e-3);
    assert.equal(b.pass, d.n >= 100 && c.n >= 50 && d.meanR > 0 && d.tMonth >= 2 && c.meanR > 0 && c.tMonth >= 2 && hb[i] < 0.05);
  });
  const v = res.beforeCosts.tests.some((x) => x.pass) ? 'PASS' : res.beforeCosts.tests.some((x) => x.enough) ? 'FAIL' : 'INCONCLUSIVE';
  assert.equal(res.beforeCosts.verdict, v);
  assert.ok(md.includes('before costs (owner') && md.includes('**' + v + ','), 'second verdict line');
});

test('RESULT.md quotes every test as result.json has it', () => {
  for (const x of res.tests) {
    const rows = md.split('\n');
    const row = rows.find((l) => l.startsWith('| ' + x.test + ' |')), rowB = rows.find((l) => l.startsWith('| ' + x.test + ' before |'));
    assert.ok(row && rowB, 'rows for ' + x.test);
    for (const w of [x.discBefore, x.confBefore]) {
      assert.ok(rowB.includes(' ' + w.n + ' '), x.test + ' n before');
      if (w.meanR != null) assert.ok(rowB.includes(f3(w.meanR)), x.test + ' mean before ' + f3(w.meanR));
      if (w.tMonth != null) assert.ok(rowB.includes((w.tMonth < 0 ? '−' : '') + Math.abs(w.tMonth).toFixed(2)), x.test + ' t before');
    }
    for (const w of [x.disc, x.conf]) {
      assert.ok(row.includes(' ' + w.n + ' '), x.test + ' n ' + w.n);
      if (w.meanR != null) assert.ok(row.includes(f3(w.meanR)), x.test + ' mean ' + f3(w.meanR));
      if (w.tMonth != null) assert.ok(row.includes((w.tMonth < 0 ? '−' : '') + Math.abs(w.tMonth).toFixed(2)), x.test + ' t');
    }
  }
  assert.ok(md.includes(String(res.trades)), 'trade count');
});

test('the no-look-ahead check on the cache found nothing', () => {
  for (const m of Object.keys(res.cut.res)) { const c = res.cut.res[m]; assert.ok(c.compared > 0); assert.equal(c.onlyFull + c.onlyCut, 0, m); }
});

// a seeded random walk of 5-minute candles, weekdays only
function market(seed, days) {
  const rnd = K.rng(seed), B = []; let p = 100; const t0 = Date.UTC(2021, 0, 4) / 1000;
  for (let t = t0; t < t0 + days * 86400; t += 300) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 6 || wd === 0) continue;
    const o = p; let h = o, l = o; for (let k = 0; k < 5; k++) { p += (rnd() - 0.5) * 0.12; h = Math.max(h, p); l = Math.min(l, p); }
    B.push({ t, o, h, l, c: p, e: t + 300 });
  }
  return { B, t0 };
}

test('orders before a cut do not change when later candles are removed (synthetic)', () => {
  let compared = 0;
  for (const seed of [11, 12]) {
    const { B, t0 } = market(seed, 300);
    const c = R.cutCheck(B, 0.01, t0 + 220 * 86400);
    compared += c.compared; assert.equal(c.onlyFull + c.onlyCut, 0, 'seed ' + seed);
  }
  assert.ok(compared > 0);
});

test('every order has its stop on the losing side and a 3R target', () => {
  const { B } = market(11, 300);
  const O = R.orders(R.framesOf(B), 0.01);
  assert.ok(O.length > 0);
  for (const o of O) {
    assert.ok(o.side * (o.entry - o.stop) > 0, o.stream);
    assert.ok(Math.abs(o.target - (o.entry + o.side * 3 * Math.abs(o.entry - o.stop))) < 1e-9, o.stream);
  }
});

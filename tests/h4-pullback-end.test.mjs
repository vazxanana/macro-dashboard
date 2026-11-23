// node --test tests/h4-pullback-end.test.mjs - the pre-registered end of an H1 pullback inside an H4 trend
// (research/edge/h4-pullback-end), offline: no look-ahead on toolkit-style synthetic candles, every trade's stop on the
// losing side and its target on the winning side, the pass bar, and RESULT.md against result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { candidates, runMarket, verdictOf, overall, welch, P } from '../research/edge/h4-pullback-end/run.mjs';

const DIR = new URL('../research/edge/h4-pullback-end/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8) / 1000;
// waves (a slow H4 swing, a faster H1 swing) on a random drift, multiplicative so prices stay positive
function walk(n, seed = 5) {
  const r = K.rng(seed); const out = []; let p = 100, x = 0, ph1 = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    ph1 += (2 * Math.PI) / (288 * 6) * (0.7 + 0.6 * r()); ph2 += (2 * Math.PI) / (48 * 3) * (0.7 + 0.6 * r());
    x += (r() - 0.5) * 0.15;
    const mid = 100 * Math.exp(0.002 * x + 0.03 * Math.sin(ph1) + 0.008 * Math.sin(ph2));
    const o = p, c = mid * (1 + (r() - 0.5) * 0.002), h = Math.max(o, c) * (1 + r() * 0.0008), l = Math.min(o, c) * (1 - r() * 0.0008);
    out.push({ t: T0 + i * 300, o, h, l, c, e: T0 + (i + 1) * 300 }); p = c;
  }
  return out;
}
const perturb = (bars, T) => bars.map((b) => (b.t < T ? b : { ...b, o: b.o * 1.03 + 2, h: b.h * 1.03 + 4, l: b.l * 1.03 - 1, c: b.c * 1.03 - 1 }));

test('no look-ahead: trades closed before a cut do not move when every later price changes', () => {
  const B = walk(120000);
  const base = runMarket(B, 'syn', { cost: 0.01 });
  assert.ok(base.kept.length > 15, 'synthetic market gives trades');
  for (const frac of [0.3, 0.55, 0.8]) {
    const T = B[Math.floor(B.length * frac) + 7].t; // not on an hour boundary on purpose
    const A = runMarket(perturb(B, T), 'syn', { cost: 0.01 });
    for (const k of ['kept', 'rejected']) {
      const keep = (xs) => xs.filter((x) => x.exitT < T);
      if (k === 'kept') assert.ok(keep(base[k]).length > 3, k);
      assert.deepEqual(keep(A[k]), keep(base[k]));
    }
  }
});

test('every trade: stop on the losing side, target on the winning side, at least 1R and 3 costs, the location rule', () => {
  const cost = 0.01;
  const xs = candidates(walk(120000, 9), 'syn', { cost });
  assert.ok(xs.length > 15);
  for (const x of xs) {
    const s = x.side;
    assert.ok(s * (x.planned - x.stop) >= P.minStopCosts * cost - 1e-12);
    assert.ok(s * (x.target - x.planned) >= P.minR * s * (x.planned - x.stop) - 1e-12);
    assert.ok(Math.abs(x.stop - (x.P - s * cost)) < 1e-9 && x.target === x.X);
    const M = (x.O + x.X) / 2, deep = s > 0 ? x.P <= M : x.P >= M, line = deep ? M : (x.P + x.X) / 2;
    assert.equal(x.loc, s > 0 ? x.planned <= line : x.planned >= line);
    assert.equal(x.range, deep ? 'external' : 'internal');
    assert.ok(x.startT < x.signalT && x.h4BreakT < x.startT && x.entryT >= x.signalT && x.exitT > x.entryT);
    assert.ok(x.exitT - x.entryT <= P.hold + 3600);
  }
  const { kept } = runMarket(walk(120000, 9), 'syn', { cost });
  for (let i = 1; i < kept.length; i++) assert.ok(kept[i].entryT >= kept[i - 1].exitT, 'one position at a time');
  const tj = JSON.parse(fs.readFileSync(new URL('trades.json', DIR)));
  const c = Object.fromEntries(tj.cols.map((k, i) => [k, i]));
  assert.ok(tj.rows.length > 300);
  for (const r of tj.rows) {
    assert.ok(r[c.side] * (r[c.target] - r[c.stop]) > 0, 'target and stop on opposite sides');
    assert.ok(r[c.side] * (r[c.entry] - r[c.stop]) > 0, 'stop on the losing side of the fill');
  }
  assert.ok(fs.statSync(new URL('trades.json', DIR)).size < 3e6);
});

test('the pass bar as pre-registered', () => {
  const w = (n, m, t) => ({ net: { n, meanR: m, tMonth: t }, net2x: { meanR: m - 0.02 }, gross: { meanR: m + 0.02 } });
  const good = { rep: w(400, 0.05, 1), is: w(150, 0.05, 1), oos: w(100, 0.1, 2.5) };
  assert.equal(verdictOf(good, 0.01).pass, true);
  assert.equal(verdictOf(good, 0.06).pass, false);
  assert.equal(verdictOf({ ...good, rep: w(400, -0.01, 1) }, 0.01).pass, false);
  assert.equal(verdictOf({ ...good, is: w(150, -0.01, 1) }, 0.01).pass, false);
  assert.equal(verdictOf({ ...good, oos: { ...w(100, 0.01, 2.5), net2x: { meanR: -0.01 } } }, 0.01).pass, false);
  assert.equal(overall({ pass: true, windows: { oos: { net: { n: 29 } } } }), 'INCONCLUSIVE');
  assert.equal(overall({ pass: false, windows: { oos: { net: { n: 30 } } } }), 'FAIL');
  assert.equal(overall({ pass: true, windows: { oos: { net: { n: 30 } } } }), 'PASS');
  const ww = welch([1, 2, 3, 4], [0, 1, 0, 1]);
  assert.ok(ww.t > 0 && ww.p < 0.5);
});

test('RESULT.md says what result.json says', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${res.verdict}\\.\\*\\*`));
  assert.equal(res.verdict, overall(res.tests[0]));
  const fmt = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
  for (const t of res.tests) for (const k of ['rep', 'is', 'oos']) {
    const b = t.windows[k].net;
    assert.ok(md.includes(`| ${b.n} | ${fmt(b.meanR)} |`), `${t.id} ${k} row`);
  }
  assert.ok(!/\b(is|as|an) edge\b/i.test(md), 'never calls it an edge');
});

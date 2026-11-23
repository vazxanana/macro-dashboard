// node --test tests/holdout-pullback-deep.test.mjs - the end of an H4 pullback, only after it reached the 50 % line
// (research/edge/holdout-pullback-deep), offline: no look-ahead on synthetic candles, the deep-branch rule itself, every stored
// trade's stop on the losing side and target on the winning side, holdout windows only, and the files agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { runMarket, verdictOf, monthSums, SETS, pinsOk } from '../research/edge/holdout-pullback-deep/run.mjs';

const DIR = new URL('../research/edge/holdout-pullback-deep/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8) / 1000;
function walk(n, seed = 11) {
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
const B = walk(120000);
const base = runMarket(B, 'syn', { cost: 0.01 });

test('pinned module hash matches the pre-registration', () => {
  for (const v of Object.values(pinsOk())) assert.ok(v.ok, JSON.stringify(v));
});

test('no look-ahead: trades closed before a cut do not move when every later price changes', () => {
  assert.ok(base.kept.length > 5, 'synthetic market gives trades');
  for (const frac of [0.3, 0.55, 0.8]) {
    const T = B[Math.floor(B.length * frac) + 7].t;
    const A = runMarket(perturb(B, T), 'syn', { cost: 0.01 });
    for (const k of ['kept', 'internal']) {
      const keep = (xs) => xs.filter((x) => x.exitT < T);
      assert.deepEqual(keep(A[k]), keep(base[k]), k);
    }
  }
});

test('the rule: only pullbacks that reached the 50 % line, entry close on the discount side of it', () => {
  for (const x of base.kept) {
    const M = (x.O + x.X) / 2;
    assert.ok(x.side > 0 ? x.P <= M && x.planned <= M : x.P >= M && x.planned >= M);
    assert.equal(x.range, 'external');
  }
  for (const x of base.internal) assert.equal(x.range, 'internal');
});

const tj = JSON.parse(fs.readFileSync(new URL('trades.json', DIR), 'utf8'));
const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const rows = tj.rows.map((r) => Object.fromEntries(tj.cols.map((c, i) => [c, r[i]])));

test('stored trades: stop on the losing side, target on the winning side, deep rule, holdout windows only', () => {
  assert.ok(fs.statSync(new URL('trades.json', DIR)).size < 3e6);
  const sets = { A: [SETS.A.from, SETS.A.to, K.MARKETS], B: [SETS.B.from, SETS.B.to, K.HOLDOUT_MARKETS] };
  for (const x of rows) {
    assert.ok(x.side * (x.entry - x.stop) > 0, 'stop on the losing side');
    assert.ok(x.side * (x.target - x.entry) > 0, 'target on the winning side');
    const [a, b, ms] = sets[x.set];
    assert.ok(x.entryT >= a && x.entryT < b && ms.includes(x.market), 'holdout only');
    assert.ok(x.exitT >= x.entryT);
    const M = (x.O + x.X) / 2;
    if (x.stream === 'rule') assert.ok(x.side > 0 ? x.P <= M * (1 + 1e-6) && x.planned <= M * (1 + 1e-6) : x.P >= M * (1 - 1e-6) && x.planned >= M * (1 - 1e-6));
  }
});

test('files agree: result.json from trades.json, RESULT.md from result.json', () => {
  const rule = rows.filter((x) => x.stream === 'rule');
  const p = res.primary.net.pooled;
  assert.equal(rule.length, p.n);
  assert.ok(Math.abs(rule.reduce((a, x) => a + x.Rnet, 0) / rule.length - p.meanR) < 2e-4);
  for (const k of ['A', 'B']) assert.equal(rule.filter((x) => x.set === k).length, res.primary.net.sets[k].n);
  const months = ['A', 'B'].flatMap((k) => monthSums(rule.filter((x) => x.set === k), 'Rnet'));
  assert.equal(months.length, p.months);
  assert.equal(rows.filter((x) => x.stream === 'internal').length, res.internal.net.pooled.n);
  assert.ok(res.gate.ok, 'harness gate reproduced h4-pullback-end');
  assert.equal(verdictOf(res.primary, res.holm.holmP).verdict, res.verdict);
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.startsWith('# ') && md.includes(`**Verdict: ${res.verdict}.**`));
  assert.ok(md.includes(res.headline));
});

test('pass bar: under 100 trades is inconclusive, a missed line fails', () => {
  const b = (n, a, bb, t, x2) => ({ net: { sets: { A: { meanR: a }, B: { meanR: bb } }, pooled: { n, tMonth: t } }, net2x: { pooled: { meanR: x2 } } });
  assert.equal(verdictOf(b(80, 1, 1, 3, 1), 0.01).verdict, 'INCONCLUSIVE');
  assert.equal(verdictOf(b(200, 1, -1, 3, 1), 0.01).verdict, 'FAIL');
  assert.equal(verdictOf(b(200, 1, 1, 3, 1), 0.01).verdict, 'PASS');
  assert.equal(verdictOf(b(200, 1, 1, 3, 1), null).verdict, 'PENDING');
});

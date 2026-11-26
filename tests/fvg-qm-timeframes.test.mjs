// node --test tests/fvg-qm-timeframes.test.mjs - the pre-registered FVG tap on other timeframes (research/edge/fvg-qm-timeframes),
// offline: no look-ahead on synthetic candles, every trade's stop on the losing side and its target on the winning side,
// one position at a time, holdout sets never touch 2010 on for the five read markets, RESULT.md against result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { candidates, runMarket, P, READINGS, SETS } from '../research/edge/fvg-qm-timeframes/run.mjs';

const DIR = new URL('../research/edge/fvg-qm-timeframes/', import.meta.url);
const T0 = Date.UTC(2007, 0, 8) / 1000;
function walk(n, seed = 5) {
  const r = K.rng(seed); const out = []; let p = 100, x = 0, ph1 = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    ph1 += (2 * Math.PI) / (288 * 6) * (0.7 + 0.6 * r()); ph2 += (2 * Math.PI) / (48 * 3) * (0.7 + 0.6 * r());
    x += (r() - 0.5) * 0.15;
    const mid = 100 * Math.exp(0.002 * x + 0.03 * Math.sin(ph1) + 0.008 * Math.sin(ph2));
    const o = p, c = mid * (1 + (r() - 0.5) * 0.004), h = Math.max(o, c) * (1 + r() * 0.0012), l = Math.min(o, c) * (1 - r() * 0.0012);
    out.push({ t: T0 + i * 300, o, h, l, c, e: T0 + (i + 1) * 300 }); p = c;
  }
  return out;
}
const perturb = (bars, T) => bars.map((b) => (b.t < T ? b : { ...b, o: b.o * 1.03 + 2, h: b.h * 1.03 + 4, l: b.l * 1.03 - 1, c: b.c * 1.03 - 1 }));

test('no look-ahead: a setup signalled before a cut keeps its entry, stop and target when every later price changes', () => {
  const B = walk(150000);
  let total = 0;
  for (const rd of READINGS) {
    const base = candidates(B, 'syn', rd, { cost: 0.01 }); total += base.length;
    for (const frac of [0.3, 0.55, 0.8]) {
      const T = B[Math.floor(B.length * frac) + 7].t;
      const A = candidates(perturb(B, T), 'syn', rd, { cost: 0.01 });
      const pre = (xs) => xs.filter((x) => x.signalT <= T).map(({ entry, stop, target, signalT, tapT, breakT, side }) => ({ entry, stop, target, signalT, tapT, breakT, side }));
      assert.deepEqual(pre(A), pre(base), rd.id);
    }
  }
  assert.ok(total > 20, 'the synthetic market gives trades');
});

test('every trade: stop on the losing side, target on the winning side, at least 1R and 3 costs, one at a time', () => {
  const cost = 0.01, B = walk(150000, 9);
  for (const rd of READINGS) {
    for (const x of candidates(B, 'syn', rd, { cost })) {
      const s = x.side;
      assert.ok(s * (x.entry - x.stop) >= P.minStopCosts * cost - 1e-9);
      assert.ok(s * (x.target - x.entry) >= P.minR * s * (x.entry - x.stop) - 1e-9);
      assert.ok(x.breakT <= x.signalT && x.tapT < x.signalT && x.signalT - x.tapT <= P.entryCandles * rd.G + 1 && x.entryT >= x.signalT);
    }
    const kept = runMarket(B, 'syn', rd);
    for (let i = 1; i < kept.length; i++) assert.ok(kept[i].entryT >= kept[i - 1].exitT, 'one position at a time');
  }
});

test('the holdout sets: the five read markets end before 2010', () => {
  assert.equal(SETS.A.to, Date.UTC(2010, 0, 1) / 1000);
  assert.deepEqual(SETS.A.markets, K.MARKETS);
  assert.deepEqual(SETS.B.markets, K.HOLDOUT_MARKETS);
  assert.equal(READINGS.length, 5);
});

test('RESULT.md says what result.json says, and every stored trade has its stop on the losing side', () => {
  if (!fs.existsSync(new URL('result.json', DIR))) return;
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.match(md.split('\n')[2], new RegExp(`^\\*\\*Verdict: ${res.verdict}\\.`));
  assert.equal(res.tests.length, 5);
  assert.equal(res.verdict, 'FAIL');
  assert.equal(res.verdict === 'PASS', res.tests.some((t) => t.pass));
  const tj = JSON.parse(fs.readFileSync(new URL('trades.json', DIR)));
  const c = Object.fromEntries(tj.cols.map((k, i) => [k, i]));
  for (const r of tj.rows) assert.ok(r[c.side] * (r[c.target] - r[c.stop]) > 0 && r[c.side] * (r[c.entry] - r[c.stop]) > 0);
  assert.ok(fs.statSync(new URL('trades.json', DIR)).size < 6e6);
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('No variant'));
});

// node --test tests/holdout-weekly-fade.test.mjs - with the Weekly, against the Daily, at a Daily level, on the holdout (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import * as H from '../research/edge/holdout-weekly-fade/run.mjs';
import * as G from '../research/edge/direction-chain-gate/run.mjs';

const DIR = new URL('../research/edge/holdout-weekly-fade/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8) / 1000; // a Monday
function walk(nDays, seed = 3, p0 = 1.1) {
  const r = K.rng(seed), out = []; let p = p0, drift = 0;
  for (let i = 0; i < nDays * 288; i++) {
    const t = T0 + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 6 || wd === 0) continue;
    if (i % 2000 === 0) drift = (r() - 0.5) * 0.00006;
    const o = p, c = o * (1 + drift) + (r() - 0.5) * p * 0.0012, h = Math.max(o, c) + r() * p * 0.0005, l = Math.min(o, c) - r() * p * 0.0005;
    out.push({ t, o, h, l, c, e: t + 300 }); p = c;
  }
  return out;
}

test('the pinned entry module is unchanged', () => {
  for (const x of H.pinCheck()) assert.ok(x.ok, x.file + ' changed');
});

test('no look-ahead: the three conditions do not move when every price from the signal on changes; they match a brute-force reading', () => {
  const M5 = walk(1100, 9), C = H.context(M5);
  const cands = G.candidates('eurusd', M5);
  let n = 0, rule = 0; const z = [0, 0, 0];
  for (const x of cands.filter((_, i) => i % 20 === 0)) {
    const a = H.conditionsAt(C, x.sig, x.side);
    const changed = M5.map((b) => (b.t < x.sig ? b : { ...b, o: b.o * 1.04, h: b.h * 1.06, l: b.l * 0.94, c: b.c * 0.97 }));
    const b = H.conditionsAt(H.context(changed), x.sig, x.side);
    assert.deepEqual(b, a, 'a condition moved with prices at or after the signal');
    // brute force from candles closed by the signal only
    const D = K.closedBy(K.dailyNY(M5.filter((m) => m.e <= x.sig)), x.sig), W = K.closedBy(G.weekly(K.dailyNY(M5)), x.sig);
    assert.equal(a.dSide, D.length ? K.structure(D, 3).side.at(-1) : 0);
    assert.equal(a.wSide, W.length ? K.structure(W, 3).side.at(-1) : 0);
    if (D.length >= 15) {
      let s = 0; for (let i = D.length - 14; i < D.length; i++) s += Math.max(D[i].h - D[i].l, Math.abs(D[i].h - D[i - 1].c), Math.abs(D[i].l - D[i - 1].c));
      assert.ok(Math.abs(a.atr - s / 14) < 1e-12);
      const lv = K.swings(D, 3).filter((q) => q.ct <= x.sig).sort((p, q) => p.ct - q.ct || p.i - q.i).slice(-40);
      const brk = M5.find((m) => m.e === x.sig);
      const d = Math.min(...lv.map((q) => Math.abs(brk.c - q.price)));
      if (lv.length) assert.ok(Math.abs(a.near - d / a.atr) < 1e-9);
    }
    assert.equal(a.rule, a.wSide === x.side && a.dSide === -x.side && a.near != null && a.near <= 0.5);
    n++; if (a.rule) rule++; z[0] += a.c1; z[1] += a.c2; z[2] += a.c3;
  }
  assert.ok(n > 20, 'the walk gives candidates'); assert.ok(z.every((v) => v > 0), 'each condition holds somewhere in the walk');
});

test('trades.json: stops on the losing side, sets and windows as pre-registered, flags follow the rule, files agree', () => {
  const f = new URL('trades.json', DIR); assert.ok(fs.statSync(f).size < 3e6, 'trades.json under 3 MB');
  const T = JSON.parse(fs.readFileSync(f)), c = Object.fromEntries(T.cols.map((k, i) => [k, i]));
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const a2010 = Date.UTC(2010, 0, 1) / 1000;
  let rn = 0, rs = 0, cn = 0;
  for (const r of T.rows) {
    assert.ok(r[c.side] * (r[c.entry] - r[c.stop]) > 0, 'stop on the winning side');
    assert.ok(r[c.exitT] > r[c.fillT]);
    if (r[c.set] === 'A') { assert.ok(K.MARKETS.includes(r[c.market])); assert.ok(r[c.fillT] >= Date.UTC(2005, 0, 1) / 1000 && r[c.fillT] < a2010); }
    else { assert.equal(r[c.set], 'B'); assert.ok(K.HOLDOUT_MARKETS.includes(r[c.market])); assert.ok(r[c.fillT] >= a2010); }
    const all3 = r[c.weeklySide] === r[c.side] && r[c.dailySide] === -r[c.side] && r[c.nearATR] != null && r[c.nearATR] <= 0.5 + 0.005;
    if (r[c.allThree]) assert.ok(all3, 'allThree without the three conditions');
    if (r[c.ruleTaken]) { assert.equal(r[c.allThree], 1); rn++; rs += r[c.Rnet]; }
    if (r[c.controlTaken]) cn++;
  }
  assert.equal(rn, R.pooled.rule.n); assert.equal(cn, R.pooled.control.n);
  assert.ok(Math.abs(rs - R.pooled.rule.total) < 0.01 * rn + 0.05, 'rule total agrees with result.json');
  assert.equal(R.sets.A.rule.n + R.sets.B.rule.n, R.pooled.rule.n);
  assert.ok(R.gate.ok && R.pinsOk);
  assert.equal(R.verdictWord, 'FAIL');
  assert.ok(fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').startsWith('# '));
  assert.match(fs.readFileSync(new URL('RESULT.md', DIR), 'utf8'), /\*\*Verdict: FAIL/);
});

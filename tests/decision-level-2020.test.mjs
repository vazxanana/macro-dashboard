// tests/decision-level-2020.test.mjs - the Decision Level study (research/edge/decision-level-2020): RESULT.md figures pinned to
// result.json, the verdict line, no look-ahead on made-up candles, stops on the losing side, targets measured from the fill.
// Offline and fast: no candle cache is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../research/edge/decision-level-2020/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'decision-level-2020');
const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
const sgn = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
const n0 = (n) => n.toLocaleString('en-US');

test('verdict line and headline', () => {
  const line = md.split('\n')[2];
  assert.match(line, /^\*\*Verdict: (PASS|FAIL|INCONCLUSIVE)\. /);
  assert.ok(line.startsWith(`**Verdict: ${res.verdict}.`));
  assert.equal(res.verdict, 'FAIL');
  assert.ok(res.tests.every((t) => !t.pass));
  assert.match(res.headline, /^FAIL, 0 of 2/);
});

test('RESULT.md figures equal result.json', () => {
  const [t1, t2] = res.tests;
  for (const [t, tag] of [[t1, 'T1'], [t2, 'T2']]) {
    assert.ok(md.includes(`n ${n0(t.OOS.n)}, ${sgn(t.OOS.meanR)}R`), `${tag} OOS n and mean`);
    assert.ok(md.includes(`t ${t.OOS.tMonth.toFixed(2)}`), `${tag} OOS t`);
    assert.ok(md.includes(`n ${n0(t.IS.n)}, ${sgn(t.IS.meanR)}R, t ${t.IS.tMonth.toFixed(2)}, PF ${t.IS.pf.toFixed(2)}`), `${tag} IS`);
    assert.ok(md.includes(`${sgn(t.oos2c)}R`), `${tag} twice the cost`);
  }
  const g = res.gold.t1;
  assert.ok(md.includes(`T1 n ${g.all.n}, ${sgn(g.all.meanR)}R, PF ${g.all.pf.toFixed(2)}`));
  assert.ok(md.includes(`2024-now n ${g.OOS.n}, ${sgn(g.OOS.meanR)}R, t ${g.OOS.tMonth.toFixed(2)}`));
  const C = res.control;
  assert.ok(md.includes(`n ${n0(C.all.all.n)}, ${sgn(C.all.all.meanR)}R`));
  assert.ok(md.includes(`${sgn(C.rejectionDays.all.meanR)}R (n ${n0(C.rejectionDays.all.n)}, PF ${C.rejectionDays.all.pf.toFixed(2)})`));
  assert.ok(md.includes(`${sgn(C.otherDays.all.meanR)}R (n ${n0(C.otherDays.all.n)}, PF ${C.otherDays.all.pf.toFixed(2)})`));
  const pm = res.perMarket;
  assert.ok(md.includes(`usdjpy ${sgn(pm.usdjpy.t1.meanR)}R (n ${pm.usdjpy.t1.n}, t ${pm.usdjpy.t1.tMonth.toFixed(2)})`));
  assert.ok(md.includes(`${sgn(pm.eurusd.t1.meanR)}R (n ${pm.eurusd.t1.n}, t ${pm.eurusd.t1.tMonth.toFixed(2)})`));
  const above = Object.values(pm).filter((x) => x.t1.meanR > 0).length;
  assert.ok(md.includes(`${['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][above]} of 18 markets above zero`));
  assert.equal(Object.keys(res.markets).length, 18);
  for (const v of ['t1', 't2', 'c']) assert.ok(res.cutCheck[v].same, 'the cut test held in the real run: ' + v);
});

// ---- made-up candles: a seeded random walk, 5-minute, about 260 days ----------------------------------------------------
function walk(seed = 3, days = 260) {
  let a = seed >>> 0; const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = []; let px = 100, t = Date.UTC(2021, 0, 4) / 1000;
  for (let i = 0; i < days * 288; i++, t += 300) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue;
    const o = px, c = o + (r() - 0.5) * 0.3 + Math.sin(i / 900) * 0.02; const h = Math.max(o, c) + r() * 0.12, l = Math.min(o, c) - r() * 0.12;
    out.push({ t, o, h, l, c, e: t + 300 }); px = c;
  }
  return out;
}

test('no look-ahead: orders placed before a cut do not change when later candles are removed', () => {
  const M5 = walk();
  const cut = M5[Math.floor(M5.length * 0.6)].t + 7;
  const res2 = R.cutCheck(M5, 0.01, cut);
  for (const v of ['t1', 't2', 'c']) { assert.ok(res2[v].n > 0, 'orders exist: ' + v); assert.ok(res2[v].same, v); }
});

test('every order has its stop on the losing side and is placed after what it reads', () => {
  const F = R.framesOf(walk(5));
  for (const v of ['t1', 't2', 'c']) {
    const O = R.buildOrders(F, 0.01, v); assert.ok(O.length > 0);
    for (const o of O) {
      assert.ok(o.s * (o.entry - o.stop) >= 0.02 - 1e-12, 'stop on the losing side, at least twice the cost');
      if (v === 'c') assert.ok(o.P < F.D[o.j].e, 'Control C is placed before the Daily close');
      else assert.ok(o.P >= F.D[o.j].e, 'T1 / T2 are placed after the Daily close');
      assert.ok(o.P < o.expire);
    }
  }
});

test('targets are measured from the fill; a fill next to the stop is not a trade', () => {
  const b = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  // a buy limit at 100, stop 98: the candle opens at 99 (better than the entry), so risk = 1 and 2R = 101
  const M5 = [b(0, 101, 101, 100.5, 100.6), b(300, 99, 99.5, 98.9, 99.4), b(600, 99.4, 101.2, 99.3, 101.1)];
  const r = R.simLimit(M5, 1, 100, 98, 0, 1e9, 0, [1, 2]);
  assert.equal(r.status, 'done'); assert.equal(r.fill, 99); assert.equal(r.risk, 1);
  assert.deepEqual(r.R, [1, 2]); assert.deepEqual(r.reason, ['target', 'target']);
  // the open lands just above the stop: under twice the cost, so no trade
  const M5b = [b(0, 101, 101, 100.5, 100.6), b(300, 98.01, 98.5, 97, 97.5)];
  assert.equal(R.simLimit(M5b, 1, 100, 98, 0, 1e9, 0.05).status, 'thin');
  // on the fill candle only the stop counts
  const M5c = [b(0, 101, 101, 100.5, 100.6), b(300, 100.5, 105, 99.9, 104)];
  const rc = R.simLimit(M5c, 1, 100, 98, 0, 1e9, 0, [2], 3600);
  assert.equal(rc.status, 'open');
});

test('Daily rejection: a wick through a fresh level with the body on one side, known only at its close', () => {
  const d = (o, h, l, c) => ({ t: 0, o, h, l, c, e: 1 });
  // day 0 / day 1 make a level at 10 (close of day 0), day 1 / day 2 one at 10.8; day 3 wicks both with its body above:
  // the one it touched first (the higher, for a buy) is the event
  const D = [d(9, 10.2, 8.8, 10), d(10, 11, 9.9, 10.8), d(10.8, 11.5, 10.5, 11.2), d(11.2, 11.3, 9.8, 11.1)];
  const E = R.dailyEvents(D);
  assert.deepEqual(E[3].rej, [{ s: 1, L: 10.8 }]);
  assert.deepEqual(E[2].rej, [], 'day 2 touches nothing');
  // a level wicked once is no longer fresh: day 4 wicking 10.8 again is not a rejection of it
  const D3 = [...D, d(11.2, 11.4, 10.7, 11.3)];
  assert.ok(!R.dailyEvents(D3)[4].rej.some((x) => x.L === 10.8));
  // a body through it instead is not a rejection
  const D2 = [...D.slice(0, 3), d(11.2, 11.3, 9.5, 9.7)];
  assert.ok(!R.dailyEvents(D2)[3].rej.some((x) => x.L === 10 && x.s === 1));
});

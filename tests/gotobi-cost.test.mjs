// gotobi-cost: the frozen rule is byte for byte the gotobi study's run.mjs, the cost parameter reproduces PR #878's and
// PR #889's figures at the original cost, break-even is monotone, and RESULT.md says what result.json holds. Offline: the
// trades are read from trades.json (the frozen rule's own output), no candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/gotobi-cost/frozen.mjs';
import * as C from '../research/edge/gotobi-cost/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gotobi-cost');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const RES = JSON.parse(read('result.json'));
const TR = JSON.parse(read('trades.json'));
const rows = (k) => TR.trades[k].map(([day, entry, D, R]) => ({ day, entry, D, R, k }));
const UJ = rows('usdjpy').filter((t) => t.day >= '2016-01-01');
const POOL = Object.keys(C.CROSSES).flatMap(rows);
// sha256 of research/edge/gotobi/run.mjs at commit 5f341e069 of branch gotobi (the file gotobi-replicate froze too)
const FROZEN_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';

test('gotobi-cost: frozen.mjs is the original run.mjs byte for byte; run.mjs re-implements nothing of the rule', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA);
  assert.match(read('PREREGISTRATION.md'), new RegExp(FROZEN_SHA));
  const src = read('run.mjs').replace(/\/\/[^\n]*/g, '');
  assert.match(read('run.mjs'), /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['trade', 'stopDist', 'windowMove', 'legTimes', 'gotobiSet', 'jpHolidays', 'monthT'])
    assert.doesNotMatch(src, new RegExp(`(function\\s+${fn}\\b|(const|let)\\s+${fn}\\s*=)`), `run.mjs defines ${fn}`);
  assert.equal(C.LEG, F.TESTS.find((x) => x.id === 'T2').leg);
});

test('gotobi-cost: the cost parameter at x = 1.3 is the frozen costPx, and reproduces #878 and #889', () => {
  assert.ok(Math.abs(C.X_ORIG - 1.3) < 1e-12);
  for (const entry of [80, 113.5, 155.2]) assert.ok(Math.abs(C.costAt(C.X_ORIG, entry) - F.costPx(entry)) < 1e-12);
  // the frozen trade on a hand-made path: its net equals netAt at the original cost
  const day0 = Date.parse('2026-03-05T00:00:00Z') / 1000, { entry, exit } = F.legTimes('fade', '2026-03-05');
  const bars = []; for (let t = entry; t <= exit; t += 300) bars.push([t, 150 - (t - entry) / 1e5, 150.02, 149.9, 150 - (t - entry + 300) / 1e5]);
  assert.ok(day0 < entry);
  const tr = F.trade(F.index(bars), 'fade', '2026-03-05', 0.2);
  assert.ok(tr && Math.abs(C.netAt(tr, C.X_ORIG) - tr.net) < 1e-12);
  // #878 T2 2016-now: n 771, +0.148R, month t 2.74, and +0.035R / t 0.65 at twice the cost
  const u = C.statsAt(UJ, () => C.X_ORIG);
  assert.equal(u.n, 771); assert.equal(Math.round(u.netR * 1e3) / 1e3, 0.148); assert.equal(Math.round(u.t * 100) / 100, 2.74);
  assert.equal(RES.streams.usdjpy2016.twiceOriginal.netR.toFixed(3), (0.035).toFixed(3)); assert.equal(RES.streams.usdjpy2016.twiceOriginal.t, 0.65);
  // #889 R1 pooled: n 4784, +0.099R, month t 2.75
  const p = C.statsAt(POOL, () => C.X_ORIG);
  assert.equal(p.n, 4784); assert.equal(Math.round(p.netR * 1e3) / 1e3, 0.099); assert.equal(Math.round(p.t * 100) / 100, 2.75);
});

test('gotobi-cost: break-even is monotone and solves its equation', () => {
  for (const [s, key] of [[UJ, 'usdjpy2016'], [POOL, 'pooled']]) {
    const g = C.tGrid(s); assert.ok(g.decreasing);
    let prev = Infinity; for (const x of [-1, 0, 1, 2, 3, 5]) { const v = C.statsAt(s, () => x).netR; assert.ok(v < prev); prev = v; }
    const x0 = C.breakEvenNet(s), x2 = C.breakEvenT(s);
    assert.ok(Math.abs(C.statsAt(s, () => x0).netR) < 1e-9);
    assert.ok(Math.abs(C.tAt(s, x2) - 2) < 0.01);
    assert.ok(x2 < x0, 't = 2 comes before net 0');
    assert.equal(RES.streams[key].breakEven.netZero, Math.round(x0 * 1e3) / 1e3);
    assert.equal(RES.streams[key].breakEven.monthT2, Math.round(x2 * 1e3) / 1e3);
  }
});

test('gotobi-cost: result.json is what run.mjs computes from trades.json, and RESULT.md says it', () => {
  const T = Object.fromEntries(Object.keys(TR.trades).map((k) => [k, rows(k).map(({ k: _k, ...t }) => t)]));
  assert.deepEqual(JSON.parse(JSON.stringify(C.study(T))), RES.streams);
  const o = { ...RES, notes: RES.notes };
  assert.equal(C.report(o), read('RESULT.md'));
  const md = read('RESULT.md'), U = RES.streams.usdjpy2016, P = RES.streams.pooled;
  assert.match(md, new RegExp(`\\*\\*${U.breakEven.netZero.toFixed(2)} pips\\*\\*`));
  assert.match(md, new RegExp(`\\*\\*${U.breakEven.monthT2.toFixed(2)} pips\\*\\*`));
  assert.match(md, new RegExp(`\\*\\*${P.breakEven.netZero.toFixed(2)}\\*\\*`));
  // nothing is called measured that was not; no rule verdict
  for (const c of [...U.candidates, ...P.candidates]) assert.equal(c.measured, false);
  assert.match(md, /could be measured for any yen pair|could not be measured|not measured/);
  assert.match(RES.verdict, /^inconclusive on cost/);

});

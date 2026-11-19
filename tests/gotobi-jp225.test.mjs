// gotobi-jp225: the frozen rule is byte for byte the gotobi study's run.mjs, run.mjs changes only the market, the cost and the
// windows (no rule re-implemented), the side maps T2's sell to a sell, coverage counts candles only, and RESULT.md says what
// result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/gotobi-jp225/frozen.mjs';
import * as R from '../research/edge/gotobi-jp225/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gotobi-jp225');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
// sha256 of research/edge/gotobi/run.mjs at commit 5f341e069 of branch gotobi (the same pin as gotobi-replicate)
const FROZEN_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';

test('gotobi-jp225: frozen.mjs is the original run.mjs byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA);
  assert.match(read('PREREGISTRATION.md'), new RegExp(FROZEN_SHA));
});

test('gotobi-jp225: run.mjs re-implements nothing of the rule; the leg is T2 and the side maps to a sell', () => {
  const src = read('run.mjs').replace(/\/\/[^\n]*/g, '');
  assert.match(read('run.mjs'), /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['trade', 'stopDist', 'windowMove', 'legTimes', 'entryPx', 'exitPx', 'gotobiOfMonth', 'gotobiSet', 'jpHolidays', 'tseHolidays', 'monthT', 'draw', 'mulberry32', 'holm'])
    assert.doesNotMatch(src, new RegExp(`(function\\s+${fn}\\b|(const|let)\\s+${fn}\\s*=)`), `run.mjs defines ${fn}`);
  for (const k of ['STOP_K =', 'LOOKBACK =', '1.5 \\*']) assert.doesNotMatch(src, new RegExp(`(^|[^.\\w])${k}`, 'm'));
  const t2 = F.TESTS.find((x) => x.id === 'T2');
  assert.deepEqual({ pair: t2.pair, leg: t2.leg }, { pair: R.ORIGINAL.pair, leg: R.ORIGINAL.leg });
  assert.equal(R.LEG, 'fade'); assert.equal(R.MAP_SIGN, 1); assert.equal(F.LEGS[R.LEG].side * R.MAP_SIGN, -1);
  assert.deepEqual(F.legTimes('fade', '2024-03-05'), { entry: Date.parse('2024-03-05T00:55:00Z') / 1000, exit: Date.parse('2024-03-05T06:00:00Z') / 1000 });
  assert.equal(R.SEEDS, 40); assert.equal(R.P_RANK, 38); assert.equal(R.T_BAR, 2); assert.equal(R.COST_FRAC, 0.0004);
});

// a deterministic M5 path of 00:00-06:55 UTC candles, an index near 20,000
function path5m(from, to, seed = 3, holeYear = null) {
  const rnd = F.mulberry32(seed), out = []; let px = 20000;
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; t < Date.parse(to + 'T00:00:00Z') / 1000; t += 300) {
    if (t % 86400 >= 7 * 3600) continue;
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    if (holeYear && new Date(t * 1000).getUTCFullYear() === holeYear && (t % 86400) >= 3600) continue;   // a year without Tokyo hours
    const o = px, c = o + (rnd() - 0.5) * 20; px = c;
    out.push([t, o, Math.max(o, c) + rnd() * 5, Math.min(o, c) - rnd() * 5, c]);
  }
  return out;
}

test('gotobi-jp225: coverage counts candles and drops a year without the Tokyo morning', () => {
  const bars = path5m('2015-11-01', '2017-12-31', 3, 2016);
  const c = R.coverage(bars, 2016, 2017);
  assert.equal(c[2016].covered, false); assert.equal(c[2016].both, 0);
  assert.equal(c[2017].covered, true); assert.ok(c[2017].dayShare > 0.99 && c[2017].slotShare > 0.99);
});

test('gotobi-jp225: a JP225 trade is the frozen trade with the index cost; every trade has its stop above a sell', () => {
  const bars = path5m('2017-01-01', '2017-06-30'), ix = F.index(bars);
  const mv = (d) => F.windowMove(ix, 'fade', d);
  let n = 0;
  for (const d of R.businessDays('2017-03-01', '2017-06-29')) {
    const D = F.stopDist(mv, d), t = R.jpTrade(ix, d, D), f = F.trade(ix, 'fade', d, D);
    if (!t) { assert.equal(f, null); continue; }
    n++;
    assert.equal(t.R, f.R); assert.ok(t.stop > t.entry); assert.equal(t.stop, t.entry + D);
    assert.ok(Math.abs(t.costR - 0.0004 * t.entry / D) < 1e-12); assert.ok(Math.abs(t.net - (t.R - t.costR)) < 1e-12);
  }
  assert.ok(n > 60);
});

test('gotobi-jp225: secondary statistics on hand-made numbers', () => {
  const w = R.welch([1, 2, 3, 4], [0, 0, 1, 1]);
  assert.ok(Math.abs(w.diff - 2) < 1e-12);
  const p = R.pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10.5]);
  assert.ok(p.r > 0.99);
});

test('gotobi-jp225: RESULT.md says what result.json holds', () => {
  if (!fs.existsSync(path.join(DIR, 'result.json'))) return;
  const j = JSON.parse(read('result.json')), md = read('RESULT.md');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${j.verdict.replace(/[()]/g, '\\$&')}\\.\\*\\*`));
  const s = j.res.decisive, f = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  assert.ok(md.includes(`| ${s.n} | ${f(s.netR)} | ${f(s.grossR)} |`));
  assert.equal(j.res.pass, Object.values(j.res.checks).every(Boolean));
  assert.equal(j.verdict === 'PASS', j.res.pass);
  for (const y of j.res.decisiveYears) assert.ok(j.coverage[y].covered);
});

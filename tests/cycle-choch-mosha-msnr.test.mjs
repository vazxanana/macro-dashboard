// tests/cycle-choch-mosha-msnr.test.mjs - research/edge/cycle-choch-mosha-msnr: the 51 fixed cells, the H4 stage before a
// ChoCh, no look-ahead on synthetic candles, and RESULT.md pinned to result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CELLS, COMBOS, ALIGNED, comboName, inCombo, stageBefore, cutCheck, monthOf, NM, SPLIT_M } from '../research/edge/cycle-choch-mosha-msnr/run.mjs';
import { loadFns } from '../council/mosha-desk.mjs';

const DIR = new URL('../research/edge/cycle-choch-mosha-msnr/', import.meta.url);
function market(n, seed = 3, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out = []; let c = px, t = Date.UTC(2012, 0, 2) / 1000;
  for (let i = 0; i < n; i++) { const o = c; c = o + (r() - 0.5) * 0.6 + Math.sin(i / 900) * 0.02; const h = Math.max(o, c) + r() * 0.2, l = Math.min(o, c) - r() * 0.2;
    out.push({ t, o, h, l, c, e: t + 300 }); t += 300; if (new Date(t * 1000).getUTCDay() === 6) t += 2 * 86400; }
  return out;
}

test('51 cells fixed: 17 combinations x 3 exits, the all-aligned one named', () => {
  assert.equal(COMBOS.length, 17); assert.equal(CELLS.length, 51); assert.equal(CELLS.filter((c) => !c.control).length, 48);
  assert.equal(new Set(CELLS.map((c) => c.name)).size, 51);
  assert.equal(comboName(COMBOS[ALIGNED]), 'pullback end | msnr agrees | Mosha CF | past 50%');
  assert.equal(NM, 262); assert.equal(SPLIT_M, 120); assert.equal(monthOf(Date.UTC(2015, 0, 1) / 1000), 120);
  const s = { pos: 0, msnr: 1, cf: 1, deep: 1 };
  assert.ok(inCombo(COMBOS[ALIGNED], s)); assert.ok(!inCombo(COMBOS[ALIGNED], { ...s, deep: 0 })); assert.ok(inCombo(COMBOS[16], { pos: 3, msnr: 0, cf: 0, deep: 0 }));
});

test('H4 stage just before the ChoCh follows phase.mjs: move, pullback, continuation, range', () => {
  const E4 = [{ t: 100, dir: 1, kind: 'BO' }];
  assert.equal(stageBefore(E4, [], 200).stage, 'move');
  assert.equal(stageBefore(E4, [{ t: 150, dir: -1 }], 200).stage, 'pullback');
  assert.equal(stageBefore(E4, [{ t: 150, dir: -1 }, { t: 180, dir: 1 }], 200).stage, 'continuation');
  assert.equal(stageBefore(E4, [{ t: 150, dir: -1 }, { t: 200, dir: 1 }], 200).stage, 'pullback');   // the ChoCh itself is not read
  assert.equal(stageBefore([{ t: 50, dir: 1, kind: 'ChoCh' }, { t: 100, dir: -1, kind: 'ChoCh' }], [], 200).stage, 'range');
  assert.equal(stageBefore([{ t: 20, dir: 1, kind: 'BO' }, { t: 50, dir: -1, kind: 'ChoCh' }, { t: 100, dir: 1, kind: 'ChoCh' }], [], 200).stage, 'move');
  assert.equal(stageBefore(E4, [], 50).d4, 0);
});

test('no look-ahead: ChoChs and their readings known by a cut equal the ones computed on candles cut there', () => {
  const M5 = market(60000, 7), cuts = [0.4, 0.6, 0.8, 0.95].map((f) => Math.floor(M5[0].t + f * (M5[M5.length - 1].e - M5[0].t)));
  const out = cutCheck(M5, loadFns(), cuts);
  assert.ok(out.compared > 50, 'too few signals on the synthetic market: ' + out.compared);
  assert.equal(out.mismatches, 0);
});

test('RESULT.md is pinned to result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line3 = md.split('\n')[2];
  assert.equal(R.verdict, 'FAIL'); assert.match(line3, /^\*\*Verdict: FAIL\. 0 of 48 cells passed \(placebo 0\)/);
  assert.equal(R.passes, 0); assert.equal(R.placeboPasses, 0); assert.equal(R.cells.length, 51); assert.equal(R.sizeable, 28);
  const best = R.cells.find((c) => c.cell === R.best);
  assert.equal(R.best, 'pullback end | msnr agrees | not a CF | past 50% | 2R');
  assert.equal(best.conf.n, 2729); assert.equal(best.conf.meanR, 0.0192); assert.equal(best.conf.tMonth, 0.68);
  assert.equal(best.disc.n, 2373); assert.equal(best.disc.tMonth, 2.12);
  assert.ok(line3.includes('+0.019R a trade before costs in 2015-26 (n 2,729, month t 0.68)'));
  const al = R.cells.find((c) => c.ci === ALIGNED && c.x === 1);
  assert.equal(al.conf.n, 101); assert.equal(al.conf.meanR, 0.1067); assert.equal(al.conf.tMonth, 0.81);
  assert.ok(line3.includes('n 101 (2R +0.107R, month t 0.81)'));
  const sum = (k) => R.markets.reduce((a, m) => a + m[k], 0);
  assert.equal(sum('signals'), 49431); assert.equal(sum('trades'), 48942); assert.ok(md.includes('49,431 ChoChs, 48,942 simulated trades'));
  assert.equal(R.cutTest.mismatches, 0); assert.equal(R.cutTest.compared, 51861); assert.ok(md.includes('51,861 signals'));
  for (const c of R.cells) { const name = c.cell.replace(/\|/g, '·'); const line = md.split('\n').find((l) => l.startsWith('| ' + name + ' |'));
    assert.ok(line, 'no row for ' + name); const f = (x) => (x == null ? '-' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3));
    assert.ok(line.includes(`| ${c.conf.n.toLocaleString('en-US')} | ${f(c.conf.meanR)} |`), name); }
  assert.ok(R.cells.every((c) => !c.pass) && R.placebo.every((c) => !c.pass));
});

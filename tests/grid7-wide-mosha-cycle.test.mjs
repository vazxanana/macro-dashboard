// tests/grid7-wide-mosha-cycle.test.mjs - research/edge/grid7-wide-mosha-cycle: the 54 fixed cells, the H4 leg, the
// statistics, no look-ahead on synthetic candles, and RESULT.md pinned to result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CELLS, GROUPS, CONTROL_G, legAt, monthT, welch, monthOf, cutCheck, NM, SPLIT_M } from '../research/edge/grid7-wide-mosha-cycle/run.mjs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { loadFns } from '../council/mosha-desk.mjs';

const DIR = new URL('../research/edge/grid7-wide-mosha-cycle/', import.meta.url);
function market(n, seed = 3, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out = []; let c = px, t = Date.UTC(2012, 0, 2) / 1000;
  for (let i = 0; i < n; i++) { const o = c; c = o + (r() - 0.5) * 0.6 + Math.sin(i / 900) * 0.02; const h = Math.max(o, c) + r() * 0.2, l = Math.min(o, c) - r() * 0.2;
    out.push({ t, o, h, l, c, e: t + 300 }); t += 300; if (new Date(t * 1000).getUTCDay() === 6) t += 2 * 86400; }
  return out;
}

test('54 cells fixed: 9 groups x 2 filters x 3 exits', () => {
  assert.equal(CELLS.length, 54); assert.equal(GROUPS.length, 9); assert.equal(GROUPS[CONTROL_G], 'control every H1 break');
  assert.equal(new Set(CELLS.map((c) => c.name)).size, 54);
  assert.equal(NM, 262); assert.equal(SPLIT_M, 120);
  assert.equal(monthOf(Date.UTC(2005, 0, 1) / 1000), 0); assert.equal(monthOf(Date.UTC(2015, 0, 1) / 1000), 120); assert.equal(monthOf(Date.UTC(2026, 9, 31) / 1000), 261);
});

test('the H4 leg uses only H4 candles closed by the moment', () => {
  const H = [{ t: 0, h: 10, l: 8 }, { t: 1, h: 11, l: 9 }, { t: 2, h: 12, l: 10 }, { t: 3, h: 15, l: 11 }].map((b, i) => ({ ...b, o: b.l, c: b.h, e: (i + 1) * 100 }));
  const E = [{ t: 200, dir: 1, i: 1, from: 0 }];
  assert.deepEqual(legAt(H, E, 300), { hi: 12, lo: 8, d4: 1 });              // the forming fourth candle is not read
  assert.deepEqual(legAt(H, E, 400), { hi: 15, lo: 8, d4: 1 });
  assert.equal(legAt(H, E, 150), null);                                    // no break known yet
});

test('month t keeps empty months, Welch t', () => {
  const rows = [{ m: 0, r: 1 }, { m: 1, r: 1 }, { m: 3, r: 1 }];
  const t = monthT(rows, 'r', 0, 4); const ms = [1, 1, 0, 1], mean = 0.75, sd = Math.sqrt(ms.reduce((a, x) => a + (x - mean) ** 2, 0) / 3);
  assert.ok(Math.abs(t - mean / (sd / 2)) < 1e-12);
  assert.equal(welch([1], [1, 2]), null); assert.ok(welch([1, 2, 3], [0, 1, 2]) > 0);
});

test('no look-ahead: signals known by a cut equal the ones computed on candles cut there', () => {
  const M5 = market(60000, 7), cuts = [0.4, 0.6, 0.8, 0.95].map((f) => Math.floor(M5[0].t + f * (M5[M5.length - 1].e - M5[0].t)));
  const out = cutCheck(M5, loadFns(), cuts);
  assert.ok(out.compared > 100, 'too few signals on the synthetic market: ' + out.compared);
  assert.equal(out.mismatches, 0);
});

test('RESULT.md is pinned to result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(R.verdict, 'FAIL'); assert.ok(R.headline.length > 20);
  assert.match(md.split('\n')[2], /^\*\*Verdict: FAIL\. 0 of 54 cells passed \(placebo 0\)/);
  assert.equal(R.passes, 0); assert.equal(R.placeboPasses, 0); assert.equal(R.cells.length, 54); assert.equal(R.placebo.length, 54);
  assert.equal(R.sizeable, 40);
  const best = R.cells.find((c) => c.cell === R.best); assert.equal(R.best, 'mosha H4>H1 CF clear | msnr agrees | 2R');
  assert.equal(best.conf.n, 360); assert.equal(best.conf.meanR, 0.1104); assert.equal(best.conf.tMonth, 1.77);
  assert.equal(best.disc.n, 328); assert.equal(best.disc.meanR, -0.0323); assert.equal(best.disc.tMonth, -0.5);
  assert.ok(md.split('\n')[2].includes('+0.110R a trade before costs in 2015-26 (n 360, month t 1.77) after −0.032R in 2005-14 (n 328, t −0.50)'));
  const trades = R.markets.reduce((a, m) => a + m.trades, 0), sig = R.markets.reduce((a, m) => a + m.signals, 0);
  assert.equal(trades, 128570); assert.equal(sig, 129699); assert.ok(md.includes('128,570 simulated trades') && md.includes('129,699 signals'));
  assert.equal(R.markets.reduce((a, m) => a + m.droppedBadData, 0), 848); assert.equal(R.markets.reduce((a, m) => a + m.gateFail, 0), 0);
  assert.equal(R.cutTest.mismatches, 0); assert.equal(R.cutTest.compared, 56675); assert.ok(md.includes('56,675 signals'));
  const loss = R.cells.find((c) => c.cell === 'mosha H1>M15 CF clear | all | 1R');
  assert.equal(loss.conf.meanR, -0.0825); assert.equal(loss.conf.tMonth, -3.57); assert.equal(loss.conf.holm, 0.027);
  assert.ok(md.includes('−0.083R a trade in 2015-26 (n 1,920, month t −3.57, Holm p 0.027)'));
  // every cell row of the table equals result.json
  for (const c of R.cells) { const name = c.cell.replace(/\|/g, '·'); const line = md.split('\n').find((l) => l.startsWith('| ' + name + ' |'));
    assert.ok(line, 'no row for ' + name); const f = (x) => (x == null ? '-' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3));
    assert.ok(line.includes(`| ${c.conf.n.toLocaleString('en-US')} | ${f(c.conf.meanR)} |`), name); }
  assert.ok(R.cells.every((c) => !c.pass) && R.placebo.every((c) => !c.pass));
});

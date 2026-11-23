// tests/grid7-cf-engulf.test.mjs - research/edge/grid7-cf-engulf: the 48 fixed cells, the EG / EF flags, no look-ahead on
// synthetic candles, every stop on the losing side, and RESULT.md pinned to result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CELLS, NM, SPLIT_M, monthOf, flags, signals, frames, cutCheck, cellRows } from '../research/edge/grid7-cf-engulf/run.mjs';
import { loadFns } from '../council/mosha-desk.mjs';

const DIR = new URL('../research/edge/grid7-cf-engulf/', import.meta.url);
function market(n, seed = 3, px = 100) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out = []; let c = px, t = Date.UTC(2012, 0, 2) / 1000;
  for (let i = 0; i < n; i++) { const o = c; c = o + (r() - 0.5) * 0.6 + Math.sin(i / 900) * 0.02; const h = Math.max(o, c) + r() * 0.2, l = Math.min(o, c) - r() * 0.2;
    out.push({ t, o, h, l, c, e: t + 300 }); t += 300; if (new Date(t * 1000).getUTCDay() === 6) t += 2 * 86400; }
  return out;
}

test('48 cells fixed: 36 with the BO, 12 against it', () => {
  assert.equal(CELLS.length, 48); assert.equal(new Set(CELLS.map((c) => c.name)).size, 48);
  assert.equal(CELLS.filter((c) => c.set === 0).length, 36); assert.equal(CELLS.filter((c) => c.set === 1).length, 12);
  assert.ok(CELLS.filter((c) => c.set === 1).every((c) => c.x < 2 && c.p === -1));
  assert.equal(NM, 262); assert.equal(SPLIT_M, 120); assert.equal(monthOf(Date.UTC(2015, 0, 1) / 1000), 120);
});

test('EG / EF flags: an engulf on the candle, a first close through an opposite zone', () => {
  const B = [[10, 11, 9, 9.5], [9.5, 10.2, 9.2, 10], [10, 10.1, 8.5, 8.6], [8.6, 11.6, 8.5, 11.5]].map(([o, h, l, c], i) => ({ t: i * 300, o, h, l, c, e: (i + 1) * 300 }));
  const f = flags(B, '5m');
  assert.equal(f.eg[2], -1);            // closes under the low of the last up candle (index 1)
  assert.equal(f.eg[3], 1);             // closes over the high of the last down candle (index 2)
  assert.equal(f.ef[3], 1);             // and closes through the sell zone of index 2 (base = candle 1, 9.2-10.2): an EF of the buy side
});

test('no look-ahead: signals known by a cut equal the ones computed on candles cut there; stops on the losing side', () => {
  const M5 = market(60000, 7), Fn = loadFns();
  const S = signals(frames(M5), Fn);
  assert.ok(S.length > 100); assert.ok(S.some((s) => s.eg) && S.some((s) => !s.eg) && S.some((s) => s.ef));
  const F = frames(M5);
  for (const s of S) { const c = F[['1h', '15m', '5m'][s.l]][s.ci].c;
    assert.ok(s.d * (s.origin - s.stopW) > 0); assert.ok(s.d * (s.stopA - c) > 0); }
  const cuts = [0.4, 0.7, 0.95].map((f) => Math.floor(M5[0].t + f * (M5[M5.length - 1].e - M5[0].t)));
  const out = cutCheck(M5, Fn, cuts); assert.ok(out.compared > 100); assert.equal(out.mismatches, 0);
});

test('cell rows: signal, plain control and placebo split by the flag', () => {
  const t = (eg, ef, R, P) => ({ l: 0, set: 0, eg, ef, p: 0, m: 130, cr: 0.1, R, P, C2: {}, market: 'xau' });
  const all = [t(1, 0, [1, 2, null], [-1, -1, null]), t(0, 1, [-1, -1, null], [1, 2, null])];
  const c = CELLS[1];             // with | H4>H1 | EG | clear | 2R
  assert.deepEqual(cellRows(all, c).map((x) => x.r), [2]); assert.deepEqual(cellRows(all, c, 'plain').map((x) => x.r), [-1]);
  assert.deepEqual(cellRows(all, c, 'placebo').map((x) => x.r), [-1]);
});

test('RESULT.md is pinned to result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line = md.split('\n')[2];
  assert.match(line, new RegExp('^\\*\\*Verdict: ' + R.verdict + '\\. '));
  assert.equal(R.cells.length, 48); assert.equal(R.placebo.length, 48);
  const best = R.cells.find((c) => c.cell === R.best); assert.ok(best);
  const sg = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
  assert.ok(line.includes(`${R.passes} of 48 cells passed (placebo ${R.placeboPasses})`));
  assert.ok(line.includes(`${sg(best.conf.meanR)}R a trade before costs in 2015-26 (n ${best.conf.n}, month t ${best.conf.tMonth.toFixed(2)})`));
  const trades = R.markets.reduce((a, m) => a + m.trades, 0); assert.ok(md.includes(trades.toLocaleString('en-US') + ' simulated trades'));
  assert.equal(R.cutTest.mismatches, 0); assert.ok(R.cutTest.compared > 1000);
});

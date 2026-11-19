// node --test tests/gold-vol-breakout-costs.test.mjs — research/edge/gold-vol-breakout-costs (14 Nov 2026): cost accounting of
// gold-vol-breakout's T1, imported unchanged from a verbatim copy. The cost routes' arithmetic, the slippage window with no
// look-ahead past the fill candle, the break-even solver, T1 on hand-made days, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-vol-breakout-costs/run.mjs';
import * as O from '../research/edge/gold-vol-breakout-costs/original.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-vol-breakout-costs');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const R = JSON.parse(read('result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

// M5 rows [t,o,h,l,c] for weekday d0: flat at p (±0.2), a wide candle at 22:00 (D1 range 2 → T1 levels p ± 1), and a break
// up to p+1.5 at 09:00 when up
function dayRows(d0, p, up) {
  const rows = [];
  for (let m = 0; m < 24 * 60; m += 5) {
    let c = [p, p + 0.2, p - 0.2, p];
    if (up && m >= 9 * 60) c = m === 9 * 60 ? [p, p + 1.5, p + 0.05, p + 1.4] : [p + 1.4, p + 1.6, p + 1.2, p + 1.5];
    if (m === 22 * 60) c = [p, p + 1, p - 1, p];
    rows.push([d0 + m * 60, ...c]);
  }
  return rows;
}
const at = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

test('original.mjs is the verbatim copy and the rule is its T1', () => {
  assert.equal(sha(read('original.mjs')), S.ORIG_SHA);
  assert.deepEqual(S.T1, { name: 'k 0.5, both sides', k: 0.5, sides: 'both' });
});

test('cost routes: demo share of price, the studies\' $0.60, the era spreads', () => {
  near(S.DEMO_FRAC, 0.07 / 3884.75 + 0.000024);
  const x = { day: '2010-06-01', entry: 1000, r: 5, R: 0.5, finR: 0, M: 2 };
  near(S.netOf(x, 'D', 0), 0.5 - S.DEMO_FRAC * 1000 / 5);
  near(S.netOf(x, 'D$', 0), 0.5 - (0.07 + 0.024) / 5);
  near(S.netOf(x, 'S', 0), 0.5 - 0.6 / 5);
  near(S.netOf(x, 'P', 0), 0.5 - 1.0 / 5);
  near(S.netOf(x, 'P', 0.1), 0.5 - (1.0 + 0.2) / 5, 1e-12);
  assert.equal(S.eraSpread('2011-12-31'), 0.5); assert.equal(S.eraSpread('2012-01-01'), 0.35);
  assert.equal(S.eraSpread('2019-12-31'), 0.35); assert.equal(S.eraSpread('2020-01-01'), 0.3);
  assert.equal(S.sessionOf(0), 'Asia'); assert.equal(S.sessionOf(6 * 60 + 55), 'Asia'); assert.equal(S.sessionOf(7 * 60), 'London');
  assert.equal(S.sessionOf(12 * 60), 'New York'); assert.equal(S.sessionOf(20 * 60 + 55), 'New York');
});

test('slippage base: the 12 candles ending with the fill candle, nothing later', () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ h: 10 + i, l: 10 }));
  assert.equal(S.medRange(bars, 0), 0, 'the first candle alone');
  assert.equal(S.medRange(bars, 20), O.quantile([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 0.5));
  const later = bars.map((b, i) => (i > 20 ? { h: 999, l: 0 } : b));
  assert.equal(S.medRange(later, 20), S.medRange(bars, 20), 'later candles do not move it');
});

test('T1 on hand-made days: the trade, its slippage base, the window', () => {
  const ds = ['2015-12-29', '2015-12-30', '2015-12-31', '2016-01-01', '2016-01-04', '2016-01-05'];
  const rows = ds.flatMap((d) => dayRows(at(d), 100, d === '2015-12-31' || d === '2016-01-04'));
  rows.push([at('2016-01-06'), 100, 100, 100, 100]);
  const { days } = S.daysOf(rows);
  const { tr } = S.tradesIn(days, S.WINDOWS.W2);
  assert.equal(tr.length, 1); const x = tr[0];
  assert.equal(x.day, '2015-12-31'); assert.equal(x.side, 1); assert.equal(x.entry, 101); assert.equal(x.r, 1);
  near(x.R, 0.5);
  near(x.M, 0.4, 1e-12);   // eleven flat candles (0.4) and the fill candle (1.45): median 0.4
  near(S.netOf(x, 'S', 0), 0.5 - 0.6);
  assert.equal(S.tradesIn(days, S.WINDOWS.W3).tr.map((t) => t.day).join(), '2016-01-04');
});

test('break-even solver: mean net 0 at the break-even cost, month t 2 at the t-2 cost', () => {
  const tr = [];
  for (let m = 0; m < 24; m++) for (let k = 0; k < 10; k++) {
    const day = `${2007 + Math.floor(m / 12)}-${String(1 + (m % 12)).padStart(2, '0')}-${String(1 + k).padStart(2, '0')}`;
    tr.push({ day, entry: 1000, r: 4 + (k % 3), R: (k % 2 ? 1.2 : -0.8) + 0.05 * Math.sin(m * 7 + k), finR: 0 });
  }
  const b = S.breakEven(tr, () => 1);
  near(tr.reduce((s, x) => s + x.R - b.be / x.r, 0) / tr.length, 0, 1e-9);
  assert.ok(b.t2 > 0 && b.t2 < b.be);
  const t = O.monthT(tr.map((x) => ({ day: x.day, net: x.R - b.t2 / x.r }))).t;
  near(t, 2, 1e-6);
  const f = S.breakEven(tr, (x) => x.entry);
  near(f.be * 1000, b.be, 1e-9);
  const weak = tr.map((x, i) => ({ ...x, R: i % 2 ? 1 : -0.99 + (i % 5) * 0.3 }));
  if (S.breakEven(weak, () => 1).grossT < 2) assert.equal(S.breakEven(weak, () => 1).t2, null);
});

test('result.json and RESULT.md agree with the code', () => {
  assert.equal(R.planSha256, sha(read('PREREGISTRATION.md')));
  assert.equal(R.original.runSha256, S.ORIG_SHA);
  assert.ok(Object.values(R.gate.rows).every((g) => g.ok)); assert.equal(R.gate.sameNet, true);
  assert.deepEqual(R.gate.rows.main.got, S.GATE.main.want);
  assert.equal(R.verdict, S.verdictLine(R));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.ok(read('RESULT.md').includes(`**Verdict: ${R.verdict}**`));
  assert.ok(R.verdict.length < 220);
  assert.equal(studyVerdict(R, read('RESULT.md')).verdict, 'inc');
  // the $0.60 route with no slippage is the replicate's pooled record
  assert.equal(R.grid.S['0'].POOLED.netR, S.GATE.pooled.want.netR); assert.equal(R.grid.S['0'].POOLED.t, S.GATE.pooled.want.t);
  const W = Object.keys(S.WINDOWS);
  assert.equal(W.filter((w) => w !== 'POOLED').reduce((s, w) => s + R.grid.D['0'][w].n, 0), R.grid.D['0'].POOLED.n);
  for (const rk of Object.keys(S.ROUTES)) for (const w of W) {
    const col = S.SLIPS.map((s) => R.grid[rk][String(s)][w].netR);
    for (let i = 1; i < col.length; i++) assert.ok(col[i] <= col[i - 1], `${rk} ${w}: more slippage never helps`);
  }
  for (const w of W) assert.ok(R.breakEven[w].usd.t2 == null || R.breakEven[w].usd.t2 <= R.breakEven[w].usd.be);
  for (const ck of ['C1', 'C2']) for (const w of W) assert.ok(R.conditions[ck][w].placeboBeaten >= 0 && R.conditions[ck][w].placeboBeaten <= 40);
  const sn = Object.values(R.sessions.POOLED).reduce((s, x) => s + x.n, 0); assert.equal(sn, R.grid.D['0'].POOLED.n);
  assert.ok(/not a gate, exit, entry or size of the live gold book/.test(read('RESULT.md')));
  assert.ok(/no rule is tested/.test(read('RESULT.md')));
});

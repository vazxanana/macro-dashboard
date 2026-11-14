// silver-ny-range-share (gold-ny-range-share replicated on silver): the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { daysOf, segments, nyMade, signals, atr, tradeAt, rOf, excessOf, P } from '../research/edge/silver-ny-range-share/run.mjs';

const DIR = 'research/edge/silver-ny-range-share/';
const H = 3600, D = 86400, MON = Date.UTC(2020, 0, 6) / 1000;
const dayRows = (t0, o, cs) => cs.map((c, i) => { const op = i ? cs[i - 1] : o; return [t0 + i * H, op, Math.max(op, c), Math.min(op, c), c]; });
// closes of one day: the pre segment (00-12) moves `a`, New York (13-20) moves `n`, 21-23 flat
const shaped = (px, a, n) => { const cs = []; let p = px;
  for (let h = 0; h < 24; h++) { p += h <= 12 ? a / 13 : h <= 20 ? n / 8 : 0; cs.push(+p.toFixed(6)); } return cs; };

test('segments and the NY share', () => {
  const day = daysOf(dayRows(MON, 100, shaped(100, 2, 8)))[0], s = segments(day);
  assert.ok(Math.abs(s.pre.move - 2) < 1e-6 && Math.abs(s.ny.move - 8) < 1e-6);
  assert.equal(s.pre.n, 13); assert.equal(s.ny.n, 8);
  assert.ok(Math.abs(nyMade(s) - 0.8) < 1e-6); // range 10, pre made 2 of it
  const inside = segments(daysOf(dayRows(MON, 100, shaped(100, 6, -3)))[0]);
  assert.ok(Math.abs(nyMade(inside)) < 1e-9); // New York stayed inside the earlier range
  const short = dayRows(MON, 100, shaped(100, 2, 8)).filter((r) => new Date(r[0] * 1000).getUTCHours() < 16 || new Date(r[0] * 1000).getUTCHours() > 20);
  assert.equal(segments({ day: MON, bars: short }).ny, null);
});

function series(n, f) { const rows = []; let px = 100;
  for (let d = 0; d < n; d++) { const t0 = MON + (Math.floor(d / 5) * 7 + d % 5) * D, [a, ny] = f(d), cs = shaped(px, a, ny);
    rows.push(...dayRows(t0, px, cs)); px = cs[23]; }
  return rows; }

test('signals and sides; the future does not change a signal; entry is the next day', () => {
  const rows = series(80, (d) => d % 3 === 0 ? [1, -5] : d % 3 === 1 ? [3, -1] : [1, 1]);
  const days = daysOf(rows), S = signals(days);
  assert.equal(S[P.warm - 1], null);
  for (let i = P.warm; i < days.length; i++) {
    const k = i % 3;
    if (k === 0) { assert.ok(S[i].sigNy && S[i].ny === -1, String(i)); }
    else { assert.ok(!S[i].sigNy, String(i)); }
  }
  const cut = 60, S2 = signals(days.slice(0, cut + 1));
  assert.deepEqual(S2[cut], S[cut]);
  const A = atr(days), t = tradeAt(days, A, cut, 1, 5);
  assert.equal(t.entryT, days[cut + 1].bars[0][0]);
  assert.ok(t.stop < t.entry && Math.abs(t.entry - t.stop - P.k * A[cut]) < 1e-9);
  assert.ok(tradeAt(days, A, cut, -1, 5).stop > t.entry);
});

test('stop at the stop or the gapped open; costs and financing on buys only; excess by side and year', () => {
  const mk = (cs) => ({ bars: dayRows(0, 100, cs) });
  const t = tradeAt([mk(Array(24).fill(100)), { bars: [[D, 100, 100.5, 89, 96], ...dayRows(D + H, 96, Array(23).fill(96))] }], [5, 5], 0, 1, 1);
  assert.equal(t.why, 'stop'); assert.equal(t.exit, 90);
  const r = rOf({ side: 1, entry: 100, exit: 105, dist: 5, entryT: MON, exitT: MON + D });
  assert.ok(Math.abs(r.gross - 1) < 1e-12); assert.ok(Math.abs(r.cost - 0.006) < 1e-12); assert.equal(r.nights, 1);
  assert.equal(r.fin, 0); assert.ok(r.finProxy > 0); // no silver rate: nothing charged; gold's rate only as a reported proxy
  assert.equal(rOf({ side: -1, entry: 100, exit: 95, dist: 5, entryT: MON, exitT: MON + D }).finProxy, 0);
  assert.ok(Math.abs(rOf({ side: 1, entry: 100, exit: 105, dist: 5, entryT: MON, exitT: MON + D }, 2).cost - 0.012) < 1e-12);
  const J = Date.UTC(2020, 0, 10) / 1000, N = Date.UTC(2020, 10, 10) / 1000, X = Date.UTC(2021, 0, 10) / 1000;
  const m = (side, net, sig, entryT) => ({ side, net, net2: net, sig, entryT });
  assert.deepEqual(excessOf([m(1, 1, true, J), m(1, 0, false, N), m(1, 9, false, X), m(-1, -5, false, N), m(-1, 3, true, J)]).map((x) => x.ex), [0.5, 4]);
});

test('report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8')), md = fs.readFileSync(DIR + 'RESULT.md', 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.equal(r.pass, false); assert.equal(r.costs.finLong, 0); assert.equal(r.costs.roundTrip, 0.03);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 220 && line.includes('FAIL, 0 of 3'), String(line.length));
  const f = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
  const t1 = r.tests.T1;
  assert.ok(line.includes(`${f(t1.OOS.ex)}R out of sample (month t ${f(t1.OOS.t, 2)}, n ${t1.OOS.n}, Holm p ${t1.holmP.toFixed(2)})`), line);
  const label = { T1: 'T1 follow NY, 5 days', T2: 'T2 follow NY, 2 days', T3: 'T3 follow NY, 5 days, pooled' };
  const rows = { T1: [['IS', 'IS'], ['OOS', 'OOS']], T2: [['IS', 'IS'], ['OOS', 'OOS']], T3: [['ALL', '2007-26']] };
  for (const id of ['T1', 'T2', 'T3']) {
    const x = r.tests[id]; assert.equal(x.pass, false);
    assert.deepEqual(x.judged, id === 'T3' ? x.ALL : x.OOS);
    for (const [w, lab] of rows[id]) { const s = x[w];
      assert.ok(md.includes(`| ${label[id]} | ${lab} | ${s.n} | ${f(s.sigGross)} | ${f(s.sigNet)} | ${f(s.ex)} | ${f(s.t, 2)} | ${f(s.netT, 2)} |`), id + w); }
    const J = x.judged;
    assert.ok(md.includes(`| ${id} | ${x.holmP.toFixed(3)} | ${f(J.ex2)} / ${f(J.sigNet2)} | ${x.placebo.beaten} of 40 | ${x.control.beaten} of 40 |`), id + ' row');
    assert.equal(x.placebo.seeds.length, 40); assert.equal(x.control.seeds.length, 40);
    assert.equal(x.checks.monthT, false);
  }
  assert.equal(t1.checks.isSign, true);
  assert.equal(r.signals.nyDays, 478);
});

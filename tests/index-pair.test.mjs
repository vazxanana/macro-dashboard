// US equity index pairs study (research/edge/index-pair): the pre-registered constants, beta and z from past closes only, the
// entry at the next open, the pair's stop on every trade, the exits, the two-leg R, both legs' spreads and financing, the rates,
// and the committed RESULT.md against result.json. Offline: no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAIRS, P, SPREAD, FINANCE, WINDOWS, BAR, PLACEBO, olsSlope, signals, window, spreadAt, tradeFrom, simulate, costOf,
  rateAt, mergeRates, join, holm, placebo, report } from '../research/edge/index-pair/run.mjs';
import { nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/index-pair/PREREGISTRATION.md');
const T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

// joined days from leg A / leg B closes (opens = previous close unless given), weekdays only
function mkJ(ac, bc, o = {}) {
  const out = []; let t = T0;
  ac.forEach((c, i) => {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400;
    out.push({ time: t, ac: c, bc: bc[i], ao: o.ao?.[i] ?? (i ? ac[i - 1] : c), bo: o.bo?.[i] ?? (i ? bc[i - 1] : bc[i]) });
    t += 86400;
  });
  return out;
}
// leg B flat at 1 (ln B = 0): the spread is ln A whatever the beta, so a path of ln A is the spread
const flat = (n) => Array(n).fill(1);
const base = (n) => Array.from({ length: n }, (_, i) => Math.exp(i % 2 ? 0.01 : -0.01));
// a signal array for a flat-B series with beta 1 at close i
function sigAt(J, i) {
  const s = []; const w = window(J, i, 1);
  s[i] = { beta: 1, mean: w.mean, sd: w.sd, z: (spreadAt(J, i, 1) - w.mean) / w.sd };
  return s;
}

test('the pre-registered constants', () => {
  assert.deepEqual(PAIRS.map((p) => [p.a, p.b]), [['us2000', 'nas100'], ['spx500', 'us30']]);
  assert.deepEqual(P, { betaN: 250, zN: 60, zIn: 2, zStop: 3.5, hold: 20 });
  assert.deepEqual(SPREAD, { us2000: 0.4, nas100: 3, spx500: 1, us30: 4 });
  assert.deepEqual(FINANCE, { markup: 0.025 });
  assert.deepEqual(WINDOWS, { rep: { from: '2009-01-01', to: '2016-01-01' }, dec: { from: '2016-01-01', to: null } });
  assert.deepEqual(BAR, { minT: 2, alpha: 0.05, placeboPct: 0.95 });
  assert.equal(PLACEBO.draws, 40);
  for (const s of ['Committed on 14 Nov 2026, alone', 'over the 250 closes', 'the 60 closes', '`z_i > +2`', 'z = ±3.5',
    '20th joined day', 'US2000 **0.4** points, NAS100 **3**, SPX500 **1**, US30 **4**', '`r + 2.5 %`', '`max(0, 2.5 % - r)`',
    '`macro/cache.json`', 'Holm over the two pairs', '40 draws', "placebo's 95th percentile", '2009-01-01 to 2015-12-31',
    '2016-01-01 to the end of the data', '`foldWeekend`'])
    assert.ok(PRE.includes(s), s);
});

test('OLS slope with intercept', () => {
  near(olsSlope([1, 2, 3, 4], [3, 5, 7, 9]), 2);
  near(olsSlope([0, 1, 2], [5, 5.5, 6]), 0.5);
  assert.equal(olsSlope([1, 1, 1], [1, 2, 3]), null);
});

test('beta and z at a close come from closes up to that close only', () => {
  const n = 330, lb = Array.from({ length: n }, (_, i) => 9 + 0.002 * i + 0.01 * Math.sin(i / 3));
  const la = lb.map((x, i) => 0.8 * x + 0.004 * Math.cos(i * 1.7));
  const J = mkJ(la.map(Math.exp), lb.map(Math.exp)), s = signals(J);
  assert.equal(s[248], null, 'no beta before 250 closes');
  const i = 300;
  near(s[i].beta, olsSlope(lb.slice(i - 249, i + 1), la.slice(i - 249, i + 1)));
  const sp = []; for (let k = i - 59; k <= i; k++) sp.push(la[k] - s[i].beta * lb[k]);
  const m = sp.reduce((a, b) => a + b, 0) / 60, sd = Math.sqrt(sp.reduce((a, b) => a + (b - m) ** 2, 0) / 59);
  near(s[i].z, (sp[59] - m) / sd, 1e-9);
  // change every price after close 300: nothing at or before it moves
  const J2 = J.map((d, k) => (k > i ? { ...d, ac: d.ac * 1.5, bc: d.bc * 0.7, ao: d.ao * 2, bo: d.bo * 3 } : d)), s2 = signals(J2);
  for (let k = 249; k <= i; k++) { assert.equal(s2[k].beta, s[k].beta, `beta ${k}`); assert.equal(s2[k].z, s[k].z, `z ${k}`); }
});

test('entry at the next open, 1R to the 3.5 level, exit at the mean', () => {
  const ac = [...base(60), Math.exp(0.03), 1, 1], ao = []; ao[61] = Math.exp(0.025);
  const J = mkJ(ac, flat(63), { ao }), s = sigAt(J, 60);
  assert.ok(s[60].z > 2, `z ${s[60].z}`);
  const t = tradeFrom(J, s, 60, -1);
  assert.equal(t.e, 61); near(t.entry, 0.025);
  near(t.stop, s[60].mean + 3.5 * s[60].sd); near(t.risk, t.stop - 0.025);
  assert.ok(t.stop > t.entry, 'the stop of a short spread is above its entry');
  assert.equal(t.why, 'mean'); assert.equal(t.x, 61); near(t.R, (0.025 - 0) / t.risk);
  assert.equal(t.closed, J[61].time + 86400);
});

test('the stop at the close, the gap stop at the open, and time', () => {
  // the close runs past 3.5
  let ac = [...base(60), Math.exp(0.03), Math.exp(0.12)], ao = []; ao[61] = Math.exp(0.025);
  let J = mkJ(ac, flat(62), { ao }), s = sigAt(J, 60), t = tradeFrom(J, s, 60, -1);
  assert.equal(t.why, 'stop'); assert.equal(t.x, 61); near(t.R, -(0.12 - 0.025) / t.risk); assert.ok(t.R < -1);
  // the next day opens past 3.5 (measured against the previous close's window)
  ac = [...base(60), Math.exp(0.03), Math.exp(0.022), 1]; ao = []; ao[61] = Math.exp(0.025); ao[62] = Math.exp(0.2);
  J = mkJ(ac, flat(63), { ao }); s = sigAt(J, 60); t = tradeFrom(J, s, 60, -1);
  assert.equal(t.why, 'stop-gap'); assert.equal(t.x, 62); near(t.exit, 0.2); assert.equal(t.closed, J[62].time);
  // the spread stays between 0 and 3.5 sd: out at the close of the 20th day
  ac = [...base(60), Math.exp(0.03), ...Array.from({ length: 30 }, (_, k) => Math.exp(0.02 + (k % 2) * 0.001))];
  ao = []; ao[61] = Math.exp(0.025);
  J = mkJ(ac, flat(ac.length), { ao }); s = sigAt(J, 60); t = tradeFrom(J, s, 60, -1);
  assert.equal(t.why, 'time'); assert.equal(t.x, 61 + 19);
  // a long spread mirrors: stop below, mean above
  ac = [...base(60), Math.exp(-0.03), 1]; ao = []; ao[61] = Math.exp(-0.025);
  J = mkJ(ac, flat(62), { ao }); s = sigAt(J, 60); t = tradeFrom(J, s, 60, 1);
  assert.ok(t.stop < t.entry); assert.equal(t.why, 'mean'); near(t.R, 0.025 / t.risk);
});

test('a signal whose entry open is already past the stop or the mean is skipped', () => {
  const ac = [...base(60), Math.exp(0.03), 1, 1];
  for (const open of [0.2, -0.05]) {
    const ao = []; ao[61] = Math.exp(open);
    const J = mkJ(ac, flat(63), { ao }), s = sigAt(J, 60), t = tradeFrom(J, s, 60, -1);
    assert.equal(t.skip, true, `open ${open}`);
  }
});

test('the two-leg R is the log return of the legs weighted 1 and beta', () => {
  const ac = [...base(60), Math.exp(0.03), 1], bc = Array.from({ length: 62 }, (_, i) => 50 * Math.exp(0.001 * i));
  const ao = [], bo = []; ao[61] = Math.exp(0.025); bo[61] = 50 * Math.exp(0.06);
  const J = mkJ(ac, bc, { ao, bo }), beta = 0.7, w = window(J, 60, beta), s = [];
  s[60] = { beta, mean: w.mean, sd: w.sd, z: (spreadAt(J, 60, beta) - w.mean) / w.sd };
  const t = tradeFrom(J, s, 60, -1);
  const legs = -(Math.log(J[t.x].ac) - Math.log(J[61].ao)) + beta * (Math.log(J[t.x].bc) - Math.log(J[61].bo));
  near(t.R * t.risk, legs, 1e-12);
  near(t.entry, Math.log(J[61].ao) - beta * Math.log(J[61].bo));
});

test('costs: both legs\' spreads and financing on both legs', () => {
  const pair = PAIRS[0], mon = T0, rates = [['2019-12-27', 4], ['2020-01-03', 1]];
  // short spread: long leg B (weight beta), short leg A; Monday 00:00 to Tuesday's end = 2 rollovers
  const t = { dir: -1, beta: 0.5, Ae: 2000, Be: 20000, risk: 0.02, opened: mon, closed: mon + 2 * 86400 };
  assert.equal(nights(t.opened, t.closed), 2);
  const c = costOf(t, pair, rates);
  near(c.spr, (0.4 / 2000 + 0.5 * 3 / 20000) / 0.02);
  near(c.fin, 2 * (0.5 * (0.01 + 0.025) + 1 * (0.025 - 0.01)) / 365 / 0.02);
  near(c.total, c.spr + c.fin);
  // at a 4 % yield the short leg pays nothing; a long spread puts leg A long
  const c4 = costOf({ ...t, dir: 1 }, pair, [['2019-12-27', 4]]);
  near(c4.fin, 2 * (1 * 0.065 + 0.5 * 0) / 365 / 0.02);
  near(costOf(t, pair, rates, false).fin, 0);
  near(costOf(t, PAIRS[1], rates, false).spr, (1 / 2000 + 0.5 * 4 / 20000) / 0.02);
});

test('rates: the last value on or before the day; the daily series wins on a shared date', () => {
  const r = [['2020-01-03', 1.5], ['2020-01-10', 1.6]];
  assert.equal(rateAt(r, Date.UTC(2020, 0, 9) / 1000), 1.5);
  assert.equal(rateAt(r, Date.UTC(2020, 0, 10) / 1000), 1.6);
  assert.equal(rateAt(r, Date.UTC(2020, 0, 1) / 1000), null);
  const m = mergeRates({ score: { fred: { DGS2: [['2025-09-05', 3.6], ['2025-09-12', 3.7]] } }, fred: { DGS2: [['2025-09-12', 3.56], ['2025-09-11', 3.52]] } });
  assert.deepEqual(m, [['2025-09-05', 3.6], ['2025-09-11', 3.52], ['2025-09-12', 3.56]]);
  const file = JSON.parse(rd('../research/edge/index-pair/rates.json'));
  assert.ok(file.rows.length > 1000 && file.rows[0][0] <= '2006-01-06');
  for (let k = 1; k < file.rows.length; k++) assert.ok(file.rows[k - 1][0] < file.rows[k][0]);
});

test('legs are joined on common days; one position at a time; placebo is seeded', () => {
  const a = [{ time: 1, open: 1, close: 2 }, { time: 2, open: 3, close: 4 }], b = [{ time: 2, open: 5, close: 6 }];
  assert.deepEqual(join(a, b), [{ time: 2, ao: 3, ac: 4, bo: 5, bc: 6 }]);
  const n = 420, lb = Array.from({ length: n }, (_, i) => 9 + 0.001 * i + 0.02 * Math.sin(i / 5));
  const la = lb.map((x, i) => x + 0.01 * Math.cos(i * 2.3) + (i % 37 < 3 ? (i % 74 < 37 ? 0.06 : -0.06) : 0));
  const J = mkJ(la.map(Math.exp), lb.map(Math.exp)), s = signals(J), { trades } = simulate(J, s);
  assert.ok(trades.length > 1);
  for (let k = 1; k < trades.length; k++) assert.ok(trades[k].sig >= trades[k - 1].x, 'no overlap');
  for (const t of trades) assert.ok(t.dir > 0 ? s[t.sig].z < -2 : s[t.sig].z > 2);
  const rates = [['2000-01-01', 2]], p1 = placebo(J, s, [1, -1, -1], 0, 2e9, PAIRS[0], rates, { draws: 3 });
  assert.deepEqual(p1, placebo(J, s, [1, -1, -1], 0, 2e9, PAIRS[0], rates, { draws: 3 }));
  assert.equal(p1.length, 3);
  near(holm([0.01, 0.04])[0], 0.02); near(holm([0.01, 0.04])[1], 0.04);
});

test('RESULT.md is the report of result.json', () => {
  const res = JSON.parse(rd('../research/edge/index-pair/result.json')), md = rd('../research/edge/index-pair/RESULT.md');
  assert.equal(md, report(res));
  assert.ok(md.startsWith('# Result:'));
  assert.ok(md.includes(`**Verdict: ${res.verdict}.**`));
  const passed = res.pairs.filter((x) => x.pass).length;
  assert.equal(res.verdict.startsWith('PASS'), passed > 0);
  for (const x of res.pairs) {
    assert.equal(x.pass, Object.values(x.checks).every(Boolean));
    assert.equal(x.placebo.draws, 40);
    assert.ok(md.includes(`| ${x.id} ${x.name} | 2016-now (decisive) | ${x.dec.n} |`));
    assert.ok(md.includes(`| ${x.id} ${x.name} | 2009-15 | ${x.rep.n} |`));
  }
});

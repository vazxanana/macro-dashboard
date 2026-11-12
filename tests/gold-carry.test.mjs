// Gold-carry study (research/edge/gold-carry): the per-night carry on hand-made units, the roll count and futures fees, the
// as-of rate lookup (no later value), the basis arithmetic, the gate against the supported-book study, one route recomputed
// from the committed files, and the written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEMO, EXPIRY, MGC_RT, GRID, SOURCES, asOf, carryR, rolls, mgcFeesR, charge, dayBasis, basisSummary } from '../research/edge/gold-carry/run.mjs';
import { BOOKS, WINDOWS, bookStats, dayOf } from '../research/edge/supported-book/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const RES = rd('../research/edge/gold-carry/RESULT.md'), PRE = rd('../research/edge/gold-carry/PREREGISTRATION.md'), RUN = rd('../research/edge/gold-carry/run.mjs');
const R = JSON.parse(rd('../research/edge/gold-carry/result.json')), SB = JSON.parse(rd('../research/edge/supported-book/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T = (s) => Date.parse(s + 'Z') / 1000;

test('the demo route is the live cost model\'s own rate, and nothing in the cost model changed', () => {
  near(DEMO, FIN.xau.long * 365);
  assert.equal(FIN.xau.long, 0.000148);
  assert.match(RUN, /import \{ FIN, FIN_DAY \} from '\.\.\/\.\.\/\.\.\/council\/fills\.mjs'/);
  assert.doesNotMatch(RUN, /writeFileSync\([^)]*(council|config|fills)/);
  assert.match(PRE, /No trading rule is tested/);
});

test('a unit\'s carry is the nights() rule at the route\'s rate, as a share of its own risk', () => {
  // Monday 10:00 to the next Monday 10:00: Mon, Tue, Wed (x3), Thu, Fri = 7 nights
  const u = { t: T('2021-01-04T10:00:00'), c: T('2021-01-11T10:00:00'), e: 2000, r0: 40 };
  assert.equal(nights(u.t, u.c), 7);
  near(carryR(u, 0.0365), 7 * 0.0365 / 365 * 2000 / 40);
  near(carryR(u, DEMO), nights(u.t, u.c) * FIN.xau.long * 2000 / 40);
  // a rate that is zero on Wednesday 6 Jan: three of the seven nights drop out
  near(carryR(u, (d) => (d === '2021-01-06' ? 0 : 0.0365)), 4 * 0.0365 / 365 * 2000 / 40);
  near(carryR(u, -0.05), 0);                         // a rate is floored at 0
  near(carryR({ ...u, c: u.t }, 0.05), 0);
});

test('MGC rolls are futures.mjs\'s even-month dates inside the hold, each a round trip plus a tick', () => {
  // the April roll is 8 days before 1 April: 24 March
  assert.equal(rolls(T('2021-03-20T00:00:00'), T('2021-03-30T00:00:00')), 1);
  assert.equal(rolls(T('2021-03-25T00:00:00'), T('2021-05-20T00:00:00')), 0);
  assert.equal(rolls(T('2021-01-01T00:00:00'), T('2022-01-01T00:00:00')), 6);
  const u = { t: T('2021-03-20T00:00:00'), c: T('2021-03-30T00:00:00'), r0: 20 };
  near(mgcFeesR(u), (MGC_RT / 10 + (MGC_RT / 10 + 0.10)) / 20);
});

test('a rate is read as of the last value on or before the day, never a later one', () => {
  const f = asOf([['2020-01-10', 1.5], ['2020-01-03', 1.0], ['2020-01-17', 2.0]]);
  assert.equal(f('2020-01-02'), null); near(f('2020-01-03'), 0.01); near(f('2020-01-09'), 0.01); near(f('2020-01-10'), 0.015); near(f('2020-12-31'), 0.02);
});

test('the basis: median ln(F/S) a day, carry = basis / years to expiry, lease = SOFR - carry', () => {
  const t0 = EXPIRY - 0.5 * 365.25 * 86400;
  const d = dayBasis([[1020, 1000], [1019, 1000], [1021, 1000], [1020, 1000], [1020, 1000]], t0);
  near(d.b, Math.log(1.02)); near(d.tau, 0.5);
  assert.equal(dayBasis([[1, 1], [1, 1]], t0), null);   // fewer than 5 matched minutes
  const days = [{ day: '2026-06-01', b: 0.02, tau: 0.5, tauAlt: 0.4 }, { day: '2026-06-02', b: 0.018, tau: 0.5, tauAlt: 0.4 }, { day: '2026-12-20', b: 0.001, tau: 0.02, tauAlt: 0.01 }];
  const s = basisSummary(days, () => 0.04);
  assert.equal(s.days, 2);                               // under 30 days to expiry is left out
  near(s.k, 0.038, 1e-4); near(s.months['2026-06'].lease, 0.002, 1e-4);
});

test('the gate held: the demo route is supported-book x1F1, no financing is x1F0', () => {
  assert.equal(R.gate.ok, true);
  const a = SB.windows.W1.S2.x1F1, b = SB.windows.W1.S2.x1F0;
  for (const k of ['total', 'tDaily', 'maxDD', 'perYear']) { assert.equal(R.routes.demo.W1[k], a[k]); assert.equal(R.routes.none.W1[k], b[k]); }
  assert.equal(R.routes.demo.W1.financing, a.financing);
});

test('the futures route is recomputed from the committed files', () => {
  const legs = JSON.parse(rd('../research/edge/supported-book/legs.json')).units;
  const closes = new Map(JSON.parse(rd('../research/edge/honest-book/gold-1d.json')).bars.map(([t, c]) => [dayOf(t), c]));
  const o = bookStats(charge(legs, R.basis.kNow, mgcFeesR), BOOKS.S2, WINDOWS.W1, { mult: 1, fin: 0 }, closes).out;
  assert.equal(o.total, R.routes.mgc.W1.total); assert.equal(o.tDaily, R.routes.mgc.W1.tDaily); assert.equal(o.positions, 330);
});

test('the break-even rate is read off the grid between the two points around t = 2', () => {
  assert.equal(R.grid.length, GRID.length);
  const i = R.grid.findIndex((g) => g.tDaily < 2), a = R.grid[i - 1], b = R.grid[i];
  near(R.breakEven, +(a.rate + (a.tDaily - 2) / (a.tDaily - b.tDaily) * (b.rate - a.rate)).toFixed(4));
  for (let k = 1; k < R.grid.length; k++) assert.ok(R.grid[k].tDaily <= R.grid[k - 1].tDaily);
});

test('each CFD figure is turned into a rate with the gold price of its date', () => {
  for (const c of R.cfd) { near(c.rate, -c.perLot / (100 * c.px) * 365, 1e-4); near(c.markup, c.rate - c.sofr, 2e-4); }
  assert.ok(SOURCES.cfd.every((c) => /not opened/.test(c.src) || c.src === 'the same article'));
});

test('the report says what result.json says', () => {
  assert.equal(RES.split('\n')[0], `**Verdict:** ${R.verdict}`);
  const pct = (x) => (x * 100).toFixed(2) + ' %', sg = (x) => (x > 0 ? '+' : '') + x.toFixed(2);
  for (const k of ['demo', 'cfd-icm', 'cfd-afterprime', 'cfd-pepperstone', 'mgc', 'etf-gldm-e']) {
    const r = R.routes[k];
    assert.ok(RES.includes(pct(r.rate)), `${k} rate`); assert.ok(RES.includes(sg(r.W1.perYear)), `${k} R a year`); assert.match(RES, new RegExp(`[ *]${r.W1.tDaily.toFixed(2).replace(".", "\\.")}[ *]`), `${k} t`);
  }
  for (const k of ['demo-h', 'cfd-icm-h', 'mgc-h', 'etf-gldm-eh']) { const r = R.routes[k]; assert.ok(RES.includes(sg(r.W1.perYear)) && RES.includes(r.W1.tDaily.toFixed(2)), k); }
  assert.ok(RES.includes(`flat ${(R.breakEven * 100).toFixed(1)} % a year`));
  assert.ok(RES.includes(`last 20 days ${(R.basis.kNow * 100).toFixed(2)} %`));
  assert.ok(RES.includes(`| a position (both legs) | ${R.hold.nightsPositionMedian} | ${R.hold.nightsPositionMean.toFixed(1)} |`));
  assert.ok(RES.includes(`| a Gold trend first unit | ${R.hold.bySystem.gtrend.median} | ${R.hold.bySystem.gtrend.mean} |`));
  assert.equal(R.hold.positions, 330);
  assert.match(RES, /not a new verdict\s+on the book/);
  assert.match(RES, /not verified/i);
});

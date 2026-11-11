// Supported-book study (research/edge/supported-book): the unit cost with financing on hand-made units, positions, the
// drawdown and its length, the gate against the committed gold-systems-oos records, the pre-registered bar, and the written
// report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SYS, BOOKS, COST, RATE, RISK, BAR, WINDOWS, unitNet, positions, drawdown, daily, weekdays, roll, tOf, corr, bootstrap, bookStats, gate, verdict, marked } from '../research/edge/supported-book/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/supported-book/PREREGISTRATION.md'), RES = rd('../research/edge/supported-book/RESULT.md'), RUN = rd('../research/edge/supported-book/run.mjs');
const R = JSON.parse(rd('../research/edge/supported-book/result.json')), LEGS = JSON.parse(rd('../research/edge/supported-book/legs.json')).units;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T = (s) => Date.parse(s + 'Z') / 1000;

test('the constants are the pre-registered ones and financing is the live cost model\'s own', () => {
  assert.equal(COST, 0.30); assert.equal(RATE, FIN.xau.long); assert.equal(RISK, 0.0025); assert.equal(BAR.t, 2);
  assert.deepEqual(BOOKS, { S2: ['gtrend', 'geg'], S3: ['gtrend', 'geg', 'gtrend5'] });
  assert.deepEqual([WINDOWS.W1.from, WINDOWS.W1.to], ['2006-07-01', '2017-12-31']);
  assert.match(RUN, /import \{ FIN, nights \} from '\.\.\/\.\.\/\.\.\/council\/fills\.mjs'/);
  assert.match(PRE, /at least 2/); assert.match(PRE, /both\*\* halves/); assert.match(PRE, /x2, F1 is above 0/);
});

test('a unit pays its round trip and its financing as a share of its own risk', () => {
  // bought Monday 10:00, closed the next Monday 10:00: rollovers Mon, Tue, Wed (x3), Thu, Fri = 7
  const u = { sys: 'gtrend', id: 'a', t: T('2021-01-04T10:00:00'), c: T('2021-01-11T10:00:00'), e: 2000, r0: 40, R: 1.5 };
  assert.equal(nights(u.t, u.c), 7);
  const x = unitNet(u);
  near(x.cost, 0.30 / 40); near(x.fin, 7 * RATE * 2000 / 40); near(x.n, 1.5 - x.cost - x.fin);
  near(unitNet(u, { mult: 2, fin: 0 }).n, 1.5 - 0.60 / 40); near(unitNet(u, { fin: 0.5 }).fin, x.fin / 2);
  // a unit opened and closed inside one day pays no financing
  assert.equal(unitNet({ ...u, c: u.t + 3600 }).fin, 0);
  // the same hold on a quarter of the risk pays four times the financing in R (why the add is expensive)
  near(unitNet({ ...u, r0: 10 }).fin, 4 * x.fin);
});

test('a position is its first unit and its add, booked when the last unit closes (weekend → Monday)', () => {
  const a = { sys: 'gtrend', id: 'p', t: T('2021-01-04T00:09:00'), c: T('2021-01-08T12:00:00'), e: 100, r0: 4, R: 2 };
  const b = { sys: 'gtrend', id: 'p-add', of: 'p', t: T('2021-01-06T00:09:00'), c: T('2021-01-09T12:00:00'), e: 104, r0: 2, R: 1 };
  const g = { sys: 'geg', id: 'q', t: T('2021-01-05T00:09:00'), c: T('2021-01-05T12:00:00'), e: 100, r0: 5, R: -1 };
  const ps = positions([a, b, g], { mult: 0, fin: 0 });
  assert.equal(ps.length, 2);
  const p = ps.find((x) => x.id === 'p'); assert.equal(p.units, 2); near(p.g, 3); assert.equal(p.day, '2021-01-11');   // Saturday close → Monday
  assert.equal(roll('2021-01-10'), '2021-01-11'); assert.equal(roll('2021-01-08'), '2021-01-08');
  const days = weekdays('2021-01-04', '2021-01-12'), d = daily(ps, days);
  assert.equal(d.n, 2); near(d.v[days.indexOf('2021-01-05')], -1); near(d.v[days.indexOf('2021-01-11')], 3);
  // an add without its first unit is not a position
  assert.equal(positions([b], {}).length, 0);
});

test('the drawdown, its length and whether the peak was regained', () => {
  const d = drawdown([1, 2, -1, -2, 1, 3, -1]);
  near(d.dd, 3); assert.equal(d.peak, 1); assert.equal(d.trough, 3); assert.equal(d.len, 4); assert.equal(d.regained, true);
  const e = drawdown([2, -1, -1, 0.5]);
  near(e.dd, 2); assert.equal(e.regained, false); assert.equal(e.len, 3); assert.equal(e.longest, 3);
  const f = drawdown([-1, -1, 3]);                // the peak is floored at 0: a loss from the start is a drawdown
  near(f.dd, 2); assert.equal(f.peak, -1); assert.equal(f.regained, true);
  near(drawdown([0, 1, 3, 2, 2.5], { equity: true }).dd, 1);
  assert.equal(drawdown([1, 1, 1]).dd, 0);
});

test('open units are marked at the day\'s close and counted as time in the market', () => {
  const u = { sys: 'gtrend', id: 'p', t: T('2021-01-04T00:09:00'), c: T('2021-01-06T12:00:00'), e: 100, r0: 4, R: 1 };
  const days = weekdays('2021-01-04', '2021-01-07'), closes = new Map([['2021-01-04', 102], ['2021-01-05', 98], ['2021-01-06', 104], ['2021-01-07', 104]]);
  const v = daily(positions([u], { mult: 0, fin: 0 }), days).v, m = marked([u], days, closes, v);
  assert.deepEqual(m.open, [1, 1, 0, 0]);
  near(m.eq[0], 0.5); near(m.eq[1], -0.5); near(m.eq[2], 1); near(m.eq[3], 1);
});

test('statistics helpers', () => {
  near(tOf([1, 2, 3]), 2 / 1 * Math.sqrt(3)); assert.equal(tOf([1, 1, 1]), null);
  near(corr([1, 2, 3], [2, 4, 6]), 1); near(corr([1, 2, 3], [3, 2, 1]), -1);
  const days = weekdays('2021-01-01', '2021-06-30'), v = days.map((_, i) => (i % 2 ? 1 : -0.5));
  const b1 = bootstrap(days, [v], ([x]) => x.reduce((s, y) => s + y, 0)), b2 = bootstrap(days, [v], ([x]) => x.reduce((s, y) => s + y, 0));
  assert.deepEqual(b1, b2); assert.ok(b1.lo <= b1.mid && b1.mid <= b1.hi && b1.pGt0 === 1);
});

test('the committed units reproduce every committed position of gold-systems-oos', () => {
  const ref = JSON.parse(rd('../research/edge/gold-systems-oos/result.json')).positions;
  const g = gate(LEGS, ref);
  assert.deepEqual(g, R.gate); assert.equal(g.ok, true); assert.equal(g.mismatched, 0); assert.equal(g.reference, 813);
  assert.ok(LEGS.every((u) => SYS.includes(u.sys) && u.r0 > 0 && u.c >= u.t && u.e > 0), 'every unit has a positive risk (a stop below its entry)');
  // a tampered unit fails the gate
  const bad = LEGS.map((u, i) => (i === 5 ? { ...u, R: u.R + 0.5 } : u));
  assert.equal(gate(bad, ref).ok, false);
});

test('result.json is what the code computes from the committed records', () => {
  const closes = new Map(JSON.parse(rd('../research/edge/honest-book/gold-1d.json')).bars.map(([t, c]) => [new Date(t * 1000).toISOString().slice(0, 10), c]).filter(([d]) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w !== 0 && w !== 6; }));
  for (const [wk, bk, vk, opt] of [['W1', 'S2', 'x1F1', { mult: 1, fin: 1 }], ['W1', 'S2', 'x2F1', { mult: 2, fin: 1 }], ['W1', 'S3', 'x1F0', { mult: 1, fin: 0 }], ['W3', 'S2', 'x1Fh', { mult: 1, fin: 0.5 }]])
    assert.deepEqual(JSON.parse(JSON.stringify(bookStats(LEGS, BOOKS[bk], WINDOWS[wk], opt, closes).out)), R.windows[wk][bk][vk], `${wk} ${bk} ${vk}`);
  // without financing and by close day, the two legs are honest-book's W1 rows (74 / +32.3R and 256 / +47.6R)
  const hb = JSON.parse(rd('../research/edge/honest-book/result.json')).windows.W1.systems, f0 = R.windows.W1.S2.x1F0.bySystem;
  for (const s of ['gtrend', 'geg']) { assert.equal(f0[s].positions, hb[s].n); near(f0[s].total, hb[s].x1.total, 0.11); }
});

test('the verdict follows the pre-registered bar', () => {
  const w = R.windows.W1.S2, v = verdict(w);
  assert.deepEqual(v, R.verdictDetail);
  assert.equal(v.pass, w.x1F1.tDaily >= 2 && w.x1F1.halves.every((h) => h.total > 0) && w.x2F1.total > 0);
  assert.equal(R.verdict.startsWith(v.pass ? 'PASS' : 'FAIL'), true);
  const mk = (t, h, x2) => ({ x1F1: { tDaily: t, total: 1, halves: h.map((x) => ({ total: x })) }, x2F1: { total: x2 } });
  assert.equal(verdict(mk(2.0, [1, 1], 1)).pass, true); assert.equal(verdict(mk(1.99, [1, 1], 1)).pass, false);
  assert.equal(verdict(mk(3, [1, -0.1], 1)).pass, false); assert.equal(verdict(mk(3, [1, 1], -1)).pass, false);
  assert.equal(R.sizingStudy.run, w.x1F1.total > 0);
});

test('the written report states the figures of result.json, with n and t', () => {
  const a = R.windows.W1.S2.x1F1, s3 = R.windows.W1.S3.x1F1, y = R.windows.W1.S2.aYear;
  assert.match(RES, new RegExp(`^\\*\\*Verdict:\\*\\* ${R.verdictDetail.pass ? 'PASS' : 'FAIL'}`));
  const has = (s) => assert.ok(RES.includes(String(s)), `report lacks ${s}`);
  const sg = (x, d = 1) => (x > 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  has(`**${sg(a.total)}**`); has(`t ${a.tDaily.toFixed(2)}`); has(`**${a.tDaily.toFixed(2)}**`); has(`${a.positions} (${a.units})`); has(`${s3.positions} (${s3.units})`);
  has(`**${a.maxDD}R**`); has(`${a.marked.maxDD}R`); has(`${a.ddDays} weekdays`); has(sg(a.halves[0].total)); has(sg(a.halves[1].total));
  has(`${a.worstYear.year}: −${Math.abs(a.worstYear.R)}R`); has(`−${a.financing}`); has(sg(R.windows.W1.S2.x2F1.total) + 'R'); has(sg(R.windows.W1.S2.x1F0.total) + 'R');
  has(sg(s3.total)); has(`${s3.maxDD}R`); has(String(s3.tDaily));
  has(`**+${y.pct.toFixed(1)} %**`); has(`${y.ddPct.toFixed(1)} % / ${y.ddMarkedPct.toFixed(1)} %`);
  for (const s of ['gtrend', 'geg']) { has(sg(a.bySystem[s].total)); has(sg(a.bySystem[s].perPosition, 3)); has(a.bySystem[s].tPosition.toFixed(2)); }
  has(`daily net R ${a.corr['gtrend~geg'].daily}`); has(`monthly ${a.corr['gtrend~geg'].monthly}`);
  for (const [wk, bk] of [['W2', 'S2'], ['W2', 'S3'], ['W3', 'S2'], ['W3', 'S3']]) { const x = R.windows[wk][bk].x1F1; has(`| ${x.positions} | ${sg(x.total)} | ${sg(x.perYear)} | ${x.tDaily} |`); }
  assert.match(RES, /in sample/); assert.match(RES, /positive but unproven/); assert.ok(!/\bedge\b(?! review)/i.test(RES.replace(/research\/edge|edge review|`[^`]*`/g, '')), 'the report never calls the book an edge');
});

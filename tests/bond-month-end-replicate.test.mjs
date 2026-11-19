// The bond month-end rule, frozen, on four other bond CFDs: the frozen copy, the pooling, the placebo filter, the futures cost,
// Fisher, the local calendars and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { poolMonths, fisher, futRT, futNet, poolVerdict, drawdown, deHolidays, ukHolidays, easter, FROZEN_SHA, NOT_ME }
  from '../research/edge/bond-month-end-replicate/run.mjs';

const DIR = new URL('../research/edge/bond-month-end-replicate/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(3);

test('frozen.mjs is #939 run.mjs byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(new URL('frozen.mjs', DIR))).digest('hex');
  assert.equal(h, '624ac805a9b361949906bf5e0c94e576433d2d019e2e3470f9b57f5d8f630144');
  assert.equal(FROZEN_SHA, h); assert.equal(R.gate.frozenSha256, h);
});

test('the gate passed and reproduced #939', () => {
  assert.equal(R.gate.pass, true);
  for (const g of ['g1', 'g2', 'g3']) for (const v of Object.values(R.gate[g])) assert.equal(v, true);
  assert.deepEqual([R.gate.published.T1.n, R.gate.published.T1.net, R.gate.published.T1.t], [130, 0.036, 0.77]);
  assert.deepEqual([R.gate.published.T2.net, R.gate.published.T2.t], [0.015, 0.32]);
});

test('monthly pool: equal weight within a month, months sorted', () => {
  const t = (d, gross) => ({ entryD: d, gross });
  const ms = poolMonths({ a: [t('2020-02-24', 1), t('2020-01-27', 0.2)], b: [t('2020-01-27', 0.4)] }, (k, x) => x.gross);
  assert.deepEqual(ms.map((m) => m[0]), ['2020-01', '2020-02']);
  assert.ok(Math.abs(ms[0][1] - 0.3) < 1e-12); assert.equal(ms[1][1], 1);
});

test('Fisher, futures cost, drawdown, verdict on hand-made numbers', () => {
  const f = fisher([0.05, 0.05]);                       // -2 ln(0.0025) = 11.98, chi2 4 df
  assert.ok(Math.abs(f.x - 11.982929) < 1e-5); assert.equal(f.df, 4); assert.ok(Math.abs(f.p - 0.017479) < 1e-5);
  assert.ok(Math.abs(fisher([1]).p - 1) < 1e-12);
  assert.ok(Math.abs(futRT('usb02y') - (1 / 256 + 0.00185)) < 1e-12);
  assert.ok(Math.abs(futRT('usb05y') - (1 / 128 + 0.0037)) < 1e-12);
  assert.ok(Math.abs(futRT('de10yb') - 0.0137) < 1e-12); assert.ok(Math.abs(futRT('uk10yb', 2) - 0.0274) < 1e-12);
  assert.ok(Math.abs(futNet('de10yb', { gross: 0.5, dist: 0.137 }) - 0.4) < 1e-12);
  assert.ok(Math.abs(drawdown([1, -2, 0.5, -1, 3]) + 2.5) < 1e-12);
  const P = (t, net, rep, mean, p95) => ({ decisive: { t, net }, replication: { net: rep }, placebo: { ruleMean: mean, p95 } });
  assert.equal(poolVerdict(P(2.1, 0.1, 0.01, 0.1, 0)).verdict, 'REPLICATES');
  assert.equal(poolVerdict(P(1.99, 0.1, 0.01, 0.1, 0)).verdict, 'DOES NOT REPLICATE');
  assert.equal(poolVerdict(P(3, 0.1, -0.01, 0.1, 0)).verdict, 'DOES NOT REPLICATE');
  assert.equal(poolVerdict(P(3, 0.1, 0.01, 0.1, 0.2)).verdict, 'DOES NOT REPLICATE');
  assert.deepEqual(NOT_ME, [2, 3, 4, 5, 6]);
});

test('local calendars', () => {
  assert.equal(new Date(easter(2024)).toISOString().slice(0, 10), '2024-03-31');
  assert.equal(new Date(easter(2019)).toISOString().slice(0, 10), '2019-04-21');
  assert.ok(deHolidays(2024).has('2024-03-29') && deHolidays(2024).has('2024-04-01') && deHolidays(2024).has('2024-05-01'));
  const uk = ukHolidays(2022);
  for (const d of ['2022-01-03', '2022-04-15', '2022-04-18', '2022-05-02', '2022-06-02', '2022-06-03', '2022-08-29', '2022-09-19', '2022-12-26', '2022-12-27']) assert.ok(uk.has(d), d);
  assert.ok(ukHolidays(2020).has('2020-05-08') && !ukHolidays(2020).has('2020-05-04'));
  assert.ok(ukHolidays(2021).has('2021-12-27') && ukHolidays(2021).has('2021-12-28'));
});

test('the report says what result.json says', () => {
  const P = R.primary;
  assert.equal(R.verdict, "DOES NOT REPLICATE (the pool fails #939's bar)"); assert.equal(P.verdict, 'DOES NOT REPLICATE'); assert.equal(P.pass, false);
  assert.ok(MD.startsWith('# Result') && MD.includes(`**Verdict: ${P.verdict}.**`));
  const dl = MD.split('\n').find((l) => l.startsWith('| 2016 - Oct 2026 (decisive)'));
  for (const s of [String(P.decisive.months), String(P.decisive.trades), f3(P.decisive.gross), f3(P.decisive.net), P.decisive.t.toFixed(2), P.holmP.toFixed(3)]) assert.ok(dl.includes(s), s);
  const rl = MD.split('\n').find((l) => l.startsWith('| 2003 - 2015 (replication)'));
  for (const s of [String(P.replication.n), f3(P.replication.net), P.replication.t.toFixed(2)]) assert.ok(rl.includes(s), s);
  assert.ok(MD.includes(`95th pct ${f3(P.placebo.p95)}`) && MD.includes(`in ${P.placebo.beaten} of 40`));
  assert.ok(MD.includes(`${f3(P.futures.x1.decisive.net)}, t ${P.futures.x1.decisive.t.toFixed(2)}`));
  assert.ok(MD.includes(`${f3(P.placeboNotMonthEnd.p95)}R`));
  for (const k of ['usb02y', 'usb05y', 'de10yb', 'uk10yb']) {
    const m = R.markets[k], line = MD.split('\n').find((l) => l.startsWith(`| ${m.label.match(/\((\w+)\)/)[1]} | ${m.decisive.n} |`));
    assert.ok(line, k);
    for (const s of [f3(m.decisive.gross), f3(m.decisive.net), m.decisive.t.toFixed(2), String(m.decisive.stops), m.worstDD.toFixed(2),
      f3(m.replication.net), m.replication.t.toFixed(2), `${f3(m.placebo.p95)} (${m.placebo.beaten})`, m.holmP.toFixed(3)]) assert.ok(line.includes(s), `${k} ${s}`);
  }
  assert.ok(MD.includes(`Fisher p ${R.fisher.p.toFixed(3)}`)); assert.equal(R.fisher.belowBonferroni, false);
  assert.equal(R.markets.de10yb.incompleteMonthTrade.length, 1); assert.equal(R.markets.usb02y.incompleteMonthTrade.length, 0);
});

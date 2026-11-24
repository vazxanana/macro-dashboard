// fade-late-hourcost: the cost function on a hand example, the measured profile, and the result's figures (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { costFrac, costR, marksProfile, stats, late, asTrade, COMM_RT, W1, W2, WJ } from '../research/edge/fade-late-hourcost/run.mjs';

const dir = new URL('../research/edge/fade-late-hourcost/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const P = JSON.parse(fs.readFileSync(new URL('profile.json', dir), 'utf8'));

test('cost: half the entry-hour spread, half the exit-hour spread, commission, and half more on a stop exit', () => {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, frac: hour === 21 ? 0.0004 : 0.00002, frac90: 0.0001 }));
  const x = { fill: 4000, risk: 5, inH: 20, outH: 21, kind: 'target' };
  // 0.5 x 0.00002 + 0.5 x 0.0004 + 0.000024 = 0.000234 of price -> 0.936 dollars -> 0.1872R
  assert.ok(Math.abs(costFrac(hours, x, COMM_RT.xau) - 0.000234) < 1e-12);
  assert.ok(Math.abs(costR(hours, x, COMM_RT.xau) - 0.1872) < 1e-9);
  const s = { ...x, kind: 'stop' }; // + 0.5 x 0.0004 = 0.000434
  assert.ok(Math.abs(costFrac(hours, s, COMM_RT.xau) - 0.000434) < 1e-12);
  assert.ok(Math.abs(costFrac(hours, x, 0, 'frac90') - 0.0001) < 1e-12);
});

test('marks profile: median of (ask - bid) / mid by UTC hour, each moment once', () => {
  const t20 = Date.UTC(2025, 0, 6, 20, 5) / 1000;
  const h = marksProfile([[[t20, 99.99, 100.01], [t20 + 60, 99.98, 100.02], [t20 + 120, 99.995, 100.005]], [[t20, 1, 2]]]);
  assert.equal(h[20].n, 3);
  assert.ok(Math.abs(h[20].frac - 0.0002) < 1e-12);
  assert.equal(h[3].n, 0);
});

test('stats: windows and month-sum t on a hand list', () => {
  const t = (y, m) => Date.UTC(y, m, 3, 20) / 1000;
  const list = [{ t: t(2016, 0), R: 1, net: 0.5 }, { t: t(2021, 5), R: -1, net: -1.2 }, { t: t(2010, 0), R: 2, net: 2 }];
  const a = stats(list, WJ), b = stats(list, W1), c = stats(list, W2);
  assert.equal(a.n, 2); assert.equal(b.n, 1); assert.equal(c.n, 1);
  assert.ok(Math.abs(a.mean - -0.35) < 1e-9);
  assert.ok(late([Date.UTC(2020, 0, 2, 23, 10) / 1000]) && !late([Date.UTC(2020, 0, 2, 21, 10) / 1000]));
  assert.equal(asTrade([Date.UTC(2020, 0, 2, 20, 0) / 1000, 19, 2, 100, 1, Date.UTC(2020, 0, 2, 22, 30) / 1000, 1]).outH, 22);
});

test('the profile in result.json is profile.json, every hour measured', () => {
  for (const m of ['xau', 'usdjpy']) {
    assert.deepEqual(R.profile.markets[m], P.markets[m].hours);
    for (const h of P.markets[m].hours) assert.ok(h.n >= 20, `${m} hour ${h.hour}`);
  }
  assert.ok(P.source.includes('3e30f22b6aa52d26ee3b913ba14a9bb15d7eca98'));
});

test('result: gate, verdict line, key figures', () => {
  assert.ok(R.gate.every((g) => g.ok));
  assert.equal(R.verdict, 'FAIL');
  const T = Object.fromEntries(R.tests.map((x) => [x.key, x]));
  assert.equal(T.xau.all.n, 1389); assert.equal(T.usdjpy.all.n, 1790); assert.equal(T.pool.all.n, 3179);
  assert.equal(T.pool.all.mean, -0.070967); assert.equal(T.usdjpy.all.mean, -0.116274); assert.equal(T.xau.all.mean, -0.01258); assert.equal(T.pool.all.t, -2.65); assert.equal(T.usdjpy.all.t, -3.41); assert.equal(T.xau.all.t, -0.29);
  assert.equal(T.pool.pass, false);
  for (const x of R.tests) assert.ok(x.all.mean < x.all.gross, 'cost lowers every mean');
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.ok(md.split('\n')[2].startsWith(`**Verdict: ${R.verdict}.`));
});

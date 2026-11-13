// research/edge/vix-term: the VIX / VIX3M timing rule's signal lag, stop, costs, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signalAt, ratios, simulate, atrBefore, report, verdictOf, bootstrap, sharpe, maxDD, rateFn, P } from '../research/edge/vix-term/run.mjs';

const DAY = 86400, T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
// n flat bars at 100 (range 99-101), one per weekday
function bars(n, f = () => ({})) {
  const out = []; let t = T0;
  for (let i = 0; i < n; i++) { out.push({ t, o: 100, h: 101, l: 99, c: 100, ...f(i) }); t += ((new Date(t * 1000).getUTCDay() === 5) ? 3 : 1) * DAY; }
  return out;
}

test('signal for day D reads the last Cboe close strictly before D (no look-ahead)', () => {
  const D = T0 + 10 * DAY;
  const rs = [{ t: D - 2 * DAY, r: 1.2 }, { t: D - DAY, r: 0.9 }, { t: D, r: 1.5 }];
  assert.equal(signalAt(rs, D), 1);                       // yesterday contango → long; today's backwardation unseen
  assert.equal(signalAt(rs, D - DAY), 0);                 // day before: the 1.2 of two days back
  assert.equal(signalAt(rs, D - 2 * DAY), 0);             // nothing before → flat
  assert.equal(signalAt(ratios([{ t: 1, v: 18 }], [{ t: 1, v: 20 }]), 2), 1);
  // changing every ratio dated on or after D leaves every day up to D unchanged
  const b = bars(60), base = b.map((x) => ({ t: x.t - DAY, r: 0.9 }));
  const alt = base.map((o) => (o.t >= b[40].t ? { ...o, r: 1.3 } : o));
  const run = (rs2) => simulate(b, { sig: (i) => signalAt(rs2, b[i].t), rate: () => 0, costPts: 0, from: 25, to: 59 }).days;
  const a1 = run(base), a2 = run(alt);
  const k = a1.findIndex((d) => d.t === b[40].t);
  assert.deepEqual(a1.slice(0, k + 1).map((d) => d.long), a2.slice(0, k + 1).map((d) => d.long));
});

test('stop at 2 x ATR(20): hit intraday at the stop, a gap at the open, re-entry the next day with a new cost', () => {
  const b = bars(40, (i) => (i === 30 ? { l: 95 } : i === 33 ? { o: 94, h: 95, l: 93, c: 94 } : {}));
  assert.equal(atrBefore(b, 25), 2);
  const sim = simulate(b, { sig: () => 1, rate: () => 0, costPts: 0, from: 25, to: 39 });
  const d = (i) => sim.days[i - 25];
  assert.ok(Math.abs(d(30).ret - (96 / 100 - 1)) < 1e-12);  // stop 100 - 2*2 = 96
  assert.equal(d(31).long, true);                           // re-entered at the open
  // day 33 gaps to 94: the stop set on day 31 (100 - 2*ATR) is above the open → out at the open
  assert.ok(d(33).ret < 0 && Math.abs(d(33).ret - (94 / 100 - 1)) < 1e-12);
  assert.equal(sim.stops, 2);
  assert.equal(sim.entries, 3);
});

test('costs: a side per entry and exit, financing per calendar night held (a weekend counts three)', () => {
  const b = bars(30);
  const sig = (i) => (i >= 22 && i <= 26 ? 1 : 0);          // long days 22..26
  const sim = simulate(b, { sig, rate: () => 0.0365, costPts: 1, from: 21, to: 29 });
  assert.equal(sim.entries, 1);
  assert.ok(Math.abs(sim.costPct - 0.02) < 1e-12);          // 1 point in, 1 point out, on 100
  const nights = Math.round((b[26].t - b[22].t) / DAY);       // nights between first close and the exit close
  assert.ok(Math.abs(sim.finPct - nights * 0.0365 / 365 * 1) < 1e-12);
  const total = sim.days.reduce((a, x) => a + x.ret, 0);
  assert.ok(Math.abs(total + sim.costPct + sim.finPct) < 1e-12);   // flat prices: only costs
  // financing rate = 2Y yield (last value before the night) + 2.5 %
  const rate = rateFn({ score: { fred: { DGS2: [['2020-01-03', 1.5]] } }, fred: {} });
  assert.ok(Math.abs(rate(T0) - 0.04) < 1e-12);
});

test('statistics and the paired bootstrap are deterministic', () => {
  assert.equal(maxDD([0.1, -0.5, 0.2]), 0.5);
  assert.ok(sharpe([0.01, -0.01, 0.02]) > 0);
  const a = bars(80).map((x, i) => ({ t: x.t, ret: (i % 3) * 0.001 })), b = a.map((x) => ({ t: x.t, ret: x.ret - 0.0005 + (x.t % 7) * 1e-5 }));
  assert.equal(bootstrap(a, b, 200, 7), bootstrap(a, b, 200, 7));
});

test('RESULT.md is the report of result.json, verdict first and consistent', () => {
  const res = JSON.parse(fs.readFileSync(new URL('../research/edge/vix-term/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/vix-term/RESULT.md', import.meta.url), 'utf8');
  assert.equal(md, report(res));
  assert.equal(res.verdict, verdictOf(res).verdict);
  assert.ok(md.startsWith(`**Verdict:** ${res.verdict}`));
  assert.deepEqual(res.params.cost, P.cost);
  if (res.data !== 'ok') assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-vix-term.md', import.meta.url)));
});

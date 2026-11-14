// Gold-haven-shock study (research/edge/gold-haven-shock): the shock signal on hand-made candles (no look-ahead), the entry at
// gold's next open, the stop and gap exits, financing by the live nights() rule, one position at a time, the statistics, and
// the written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shockDays, entryIndex, atrBefore, tradeAt, simulate, exitStamp, monthly, holm, normP, sample, rng, verdictOf, RT } from '../research/edge/gold-haven-shock/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/gold-haven-shock/PREREGISTRATION.md'), RES = rd('../research/edge/gold-haven-shock/RESULT.md'), RUN = rd('../research/edge/gold-haven-shock/run.mjs');
const R = JSON.parse(rd('../research/edge/gold-haven-shock/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T0 = Date.UTC(2021, 0, 4) / 1000;   // a Monday
// weekday candles from T0, one per day (Mon-Fri), from a list of closes; open = previous close, range +-1
const weekdays = (n) => { const out = []; for (let d = T0; out.length < n; d += 86400) { const w = new Date(d * 1000).getUTCDay(); if (w && w < 6) out.push(d); } return out; };
const bars = (closes) => weekdays(closes.length).map((time, i) => ({ time, open: i ? closes[i - 1] : closes[0], high: Math.max(closes[i], i ? closes[i - 1] : closes[0]) + 1, low: Math.min(closes[i], i ? closes[i - 1] : closes[0]) - 1, close: closes[i] }));

test('a shock is a drop beyond 2 sd of the 20 returns BEFORE the day, and a later price never changes it', () => {
  const closes = [100]; for (let i = 1; i < 30; i++) closes.push(closes[i - 1] * (i % 2 ? 1.01 : 0.99));
  closes[25] = closes[24] * 0.95;                               // a 5 % drop: sd of the alternating returns is about 1 %
  const s = shockDays(bars(closes));
  const d25 = s.find((x) => x.t === bars(closes)[25].time);
  assert.ok(d25.shock, 'the 5 % drop is a shock');
  assert.equal(s.filter((x) => x.shock).length, 1);
  assert.equal(s[0].t, bars(closes)[21].time, 'a day needs 21 earlier closes');
  // the drop's own return is not in its sd: changing it does not change that day's sd
  const closes2 = closes.slice(); closes2[25] = closes[24] * 0.5;
  near(shockDays(bars(closes2)).find((x) => x.t === d25.t).sd, d25.sd);
  // changing every later price leaves the day's signal alone
  const closes3 = closes.slice(); for (let i = 26; i < 30; i++) closes3[i] = 1;
  assert.deepEqual(shockDays(bars(closes3)).find((x) => x.t === d25.t), d25);
});

test('entry is gold\'s first candle after the signal day (Friday -> Monday), ATR only from candles before it', () => {
  const g = bars(new Array(40).fill(0).map((_, i) => 1000 + i));
  const fri = g.find((b) => new Date(b.time * 1000).getUTCDay() === 5 && b.time > g[25].time);
  const j = entryIndex(g, fri.time);
  assert.equal(new Date(g[j].time * 1000).getUTCDay(), 1);
  assert.equal(entryIndex(g, g[g.length - 1].time), -1);
  const a = atrBefore(g, 30); const g2 = g.map((b, i) => (i >= 30 ? { ...b, high: b.high + 50 } : b));
  near(atrBefore(g2, 30), a);
  assert.equal(atrBefore(g, 20), null);
});

test('stop on the entry candle at the stop, a later gap at its open, else the close; costs = $0.30 + nights() x FIN', () => {
  const g = bars(new Array(30).fill(1000));                       // true range 2 every day -> ATR 2
  const j = 25, base = { ...g[j], open: 1000, high: 1001, low: 999.5, close: 1000.5 };
  g[j] = base;
  let tr = tradeAt(g, j, 1);
  near(tr.risk, atrBefore(g, j)); near(tr.stop, 1000 - tr.risk);
  assert.equal(tr.kind, 'time'); near(tr.gross, 0.5 / tr.risk);
  near(tr.fin, nights(tr.t, tr.c) * FIN.xau.long * 1000 / tr.risk); near(tr.net, tr.gross - RT / tr.risk - tr.fin);
  g[j] = { ...base, low: 990 }; tr = tradeAt(g, j, 1); assert.equal(tr.kind, 'stop'); near(tr.gross, -1);
  g[j] = base; g[j + 1] = { ...g[j + 1], open: 990, low: 985 }; tr = tradeAt(g, j, 3); assert.equal(tr.kind, 'gap'); near(tr.exit, 990);
  assert.equal(tradeAt(g, 28, 5), null, 'a trade that runs past the data is left out');
});

test('exit stamps: day end Monday-Thursday, 21:59:59 on Friday; a Monday-Monday 5-day hold pays 7 nights', () => {
  const mon = T0, fri = T0 + 4 * 86400;
  assert.equal(exitStamp(mon), mon + 86399); assert.equal(exitStamp(fri), fri + 22 * 3600 - 1);
  assert.equal(nights(mon, exitStamp(fri)), 6, 'Mon, Tue, Wed x3, Thu; Friday exit before its rollover');
  assert.equal(nights(mon, exitStamp(mon)), 1);
});

test('one position at a time; free mode takes every day', () => {
  const g = bars(new Array(40).fill(0).map((_, i) => 1000 + (i % 3)));
  const days = [g[25], g[26], g[27], g[32]].map((b) => ({ t: b.time }));
  assert.equal(simulate(days, g, 5).length, 2);
  assert.equal(simulate(days, g, 5, { free: true }).length, 4);
  assert.equal(simulate(days, g, 1).length, 4);
  near(simulate(days, g, 1, { costX: 2 })[0].net, simulate(days, g, 1)[0].net - simulate(days, g, 1)[0].cost);
});

test('statistics: empty months count 0, Holm, one-sided p, a seeded draw is repeatable', () => {
  const t = (y, m) => Date.UTC(y, m, 15) / 1000;
  const m = monthly([{ c: t(2020, 0), x: 1 }, { c: t(2020, 2), x: 3 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 2, 31) / 1000, 'x');
  assert.equal(m.months, 3); near(m.mean, 4 / 3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  near(normP(0), 0.5, 1e-6); assert.ok(normP(2) < 0.025 && normP(2) > 0.022); assert.equal(normP(null), 1);
  const arr = new Array(50).fill(0).map((_, i) => ({ t: i }));
  assert.deepEqual(sample(arr, 10, rng(7)), sample(arr, 10, rng(7)));
  assert.equal(new Set(sample(arr, 10, rng(7)).map((x) => x.t)).size, 10);
});

test('verdict rule: PASS needs T2 and T3, each positive in both windows, decisive t >= 2 with Holm < 0.05, n >= 30', () => {
  const ok = { rep: { netExact: 0.1 }, dec: { netExact: 0.1, tMonth: 2.5, n: 40, x2: 0.05 }, holm: 0.01 };
  assert.equal(verdictOf([{ id: 'T1', ...ok }, { id: 'T2', ...ok }, { id: 'T3', ...ok }]), 'PASS');
  assert.equal(verdictOf([{ id: 'T1', ...ok }, { id: 'T2', ...ok, holm: 0.06 }, { id: 'T3', ...ok }]), 'PARTIAL');
  assert.equal(verdictOf([{ id: 'T1', ...ok, rep: { netExact: -1e-6 } }, { id: 'T2', ...ok, dec: { ...ok.dec, n: 29 } }, { id: 'T3', ...ok, dec: { ...ok.dec, tMonth: 1.9 } }]), 'FAIL');
});

test('the study imports the live cost rules, is standalone, and the report matches result.json', () => {
  assert.match(RUN, /import \{ FIN, nights, foldWeekend \} from '\.\.\/\.\.\/\.\.\/council\/fills\.mjs'/);
  assert.doesNotMatch(RUN, /fetch\(|https?:\/\//);
  assert.match(PRE, /standalone signal study/); assert.match(PRE, /decision 44/);
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.tests.length, 3);
  assert.match(RES.split('\n')[0], /^\*\*Verdict: FAIL\*\*/);
  const sg = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  for (const t of R.tests) {
    assert.equal(t.pass, false);
    for (const w of ['dec', 'rep']) {
      const x = t[w], row = RES.split('\n').find((l) => l.startsWith(`| ${t.id} `) && l.includes(w === 'dec' ? '2016-26' : '2006-15'));
      assert.ok(row, `${t.id} ${w} row`);
      for (const v of [x.gross, x.excess, x.x2]) assert.ok(row.includes(sg(v)), `${t.id} ${w} ${v} in ${row}`);
      assert.ok(row.includes(`| ${x.n} |`) && row.includes(String(x.tMonth).replace('-', '−')), `${t.id} ${w} n / t`);
    }
    assert.equal(t.placebo.seeds, 40);
    assert.ok(RES.includes(`${t.holm}`.slice(0, 5)));
  }
});

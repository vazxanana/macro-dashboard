// research/edge/pre-fomc-gold-usd: the pre-FOMC drift in gold and the dollar (offline; synthetic candles, no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../council/events.mjs';
import { FIN, nights } from '../council/fills.mjs';
import * as S from '../research/edge/pre-fomc-gold-usd/run.mjs';
import { fomcEvents, ALL_ANNOUNCE } from '../research/edge/pre-fomc-gold-usd/events.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/pre-fomc-gold-usd');
const US = 'America/New_York';
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);

// a deterministic M15 path: weekdays only, from `from` for `days` calendar days
function bars(from, days, px = 2000, step = 0.6, seed = 7, override = null) {
  const r = S.rng(seed), rows = [];
  let c = px;
  for (let t = from; t < from + days * 86400; t += 900) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 6 || (w === 0 && new Date(t * 1000).getUTCHours() < 22) || (w === 5 && new Date(t * 1000).getUTCHours() >= 22)) continue;
    const o = c, d = (r() - 0.5) * 2 * step, cl = o + d, h = Math.max(o, cl) + r() * step * 0.5, l = Math.min(o, cl) - r() * step * 0.5;
    const row = [t, o, h, l, cl]; if (override) override(row); rows.push(row); c = row[4];
  }
  const b = S.toBars(rows); return { b, days: S.nyDays(b), rows };
}

test('times: entry 24 h before, exit 15 min before, New York clock by date', () => {
  const cases = [['2024-01-31', '14:00', '2024-01-30T19:00', '2024-01-31T18:45'], ['2016-03-16', '14:00', '2016-03-15T18:00', '2016-03-16T17:45'],
    ['2008-01-30', '14:15', '2008-01-29T19:15', '2008-01-30T19:00'], ['2011-04-27', '12:30', '2011-04-26T16:30', '2011-04-27T16:15']];
  for (const [d, at, e, x] of cases) {
    const ev = fomcEvents(Infinity).find((q) => q.date === d);
    assert.ok(ev, d); assert.equal(ev.at, at);
    const { tE, tX } = S.timesOf(ev.T);
    assert.equal(iso(tE), e); assert.equal(iso(tX), x);
  }
  assert.ok(fomcEvents(S.UNTIL).every((e) => e.T < S.UNTIL));
  assert.equal(S.P.K, 1.0); assert.equal(S.P.ATR, 20); assert.equal(S.P.PRE, 900);
});

test('a leg: stop on its losing side, shorts mirrored, no look-ahead past the exit or into the ATR', () => {
  const T = zonedToUtc('2024-01-31', '14:00', US), from = T - 40 * 86400;
  const g = bars(from, 45);
  const L = S.leg(g.b, g.days, T, 'xau', 1), Sh = S.leg(g.b, g.days, T, 'usdjpy', -1);
  assert.ok(!L.skip && !Sh.skip);
  assert.ok(L.stop < L.entry && Sh.stop > Sh.entry);
  assert.ok(Math.abs(L.risk - Sh.risk) < 1e-9);
  if (L.why === 'time' && Sh.why === 'time') assert.ok(Math.abs(L.R + Sh.R) < 1e-9);
  assert.ok(L.exitT <= T - 900 && L.entryT <= T - 86400);
  // candles after the exit change nothing; the ATR reads only days ended by the entry
  const g2 = bars(from, 45, 2000, 0.6, 7, (row) => { if (row[0] >= T - 900) { row[2] += 500; row[3] -= 500; } });
  assert.deepEqual(S.leg(g2.b, g2.days, T, 'xau', 1), L);
  const A = S.atrAt(g.days, L.entryT);
  assert.ok(Math.abs(L.risk - A) < 1e-9);
  assert.ok(g.days.filter((d) => d.end <= L.entryT).length >= 21);
});

test('stops: a touch exits at the stop, a gap at the open, never a result past -1R by touch', () => {
  const T = zonedToUtc('2024-01-31', '14:00', US), from = T - 40 * 86400, tE = T - 86400;
  const base = bars(from, 45), L0 = S.leg(base.b, base.days, T, 'xau', 1);
  const crash = bars(from, 45, 2000, 0.6, 7, (row) => { if (row[0] === tE + 3600) { row[3] = row[1] - 1e4; } });
  const x = S.leg(crash.b, crash.days, T, 'xau', 1);
  assert.equal(x.why, 'stop'); assert.ok(Math.abs(x.R + 1) < 1e-9); assert.equal(x.stop, L0.stop);
});

test('costs: gold $0.30 + financing a night; forex commission + one default spread + charged swap', () => {
  assert.equal(S.legCost('xau', 1, 4000, 0), 0.30);
  assert.ok(Math.abs(S.legCost('xau', 1, 4000, 1) - (0.30 + FIN.xau.long * 4000)) < 1e-12);
  assert.ok(Math.abs(S.legCost('xau', 1, 4000, 1, 2) - 2 * (0.30 + FIN.xau.long * 4000)) < 1e-12);
  assert.ok(Math.abs(S.legCost('eurusd', 1, 1.1, 1) - (0.000045 * 1.1 + 0.0001 + 0.621 * 0.0001)) < 1e-12);
  assert.ok(Math.abs(S.legCost('gbpusd', 1, 1.3, 3) - (0.000045 * 1.3 + 0.0001 + 3 * 0.179 * 0.0001)) < 1e-12);
  assert.ok(Math.abs(S.legCost('audusd', 1, 0.65, 1) - (0.000045 * 0.65 + 0.0001)) < 1e-12);   // a credit counts nothing
  assert.ok(Math.abs(S.legCost('usdjpy', -1, 150, 1) - (0.000045 * 150 + 0.01)) < 1e-12);
  // Tuesday 14:00 -> Wednesday 13:45 New York crosses Tuesday's 22:00 UTC rollover once
  const T = zonedToUtc('2024-01-31', '14:00', US);
  assert.equal(nights(T - 86400, T - 900), 1);
});

test('the basket is the mean of its four legs; a missing leg skips the event', () => {
  const T = zonedToUtc('2024-01-31', '14:00', US), from = T - 40 * 86400;
  const data = { eurusd: bars(from, 45, 1.08, 0.0004, 1), gbpusd: bars(from, 45, 1.27, 0.0005, 2), audusd: bars(from, 45, 0.66, 0.0003, 3), usdjpy: bars(from, 45, 147, 0.06, 4), xau: bars(from, 45) };
  const e = S.eventTrade(data, T, S.TESTS.T2);
  assert.equal(e.legs.length, 4);
  for (const k of ['R', 'net', 'net2', 'costR']) assert.ok(Math.abs(e[k] - e.legs.reduce((a, x) => a + x[k], 0) / 4) < 1e-12);
  assert.equal(e.legs.find((l) => l.sym === 'usdjpy').side, -1);
  assert.ok(e.legs.every((l) => (l.side > 0 ? l.stop < l.entry : l.stop > l.entry)));
  const gap = { ...data, audusd: { b: S.toBars([]), days: [] } };
  assert.ok(S.eventTrade(gap, T, S.TESTS.T2).skip);
  assert.deepEqual(S.TESTS.T1.legs, [['xau', 1]]);
});

test('statistics: Holm, the one-sided p, the bar', () => {
  assert.deepEqual(S.holm([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(S.holm([0.04, 0.01]), [0.04, 0.02]);
  assert.deepEqual(S.holm([0.03, 0.02]), [0.04, 0.04]);
  assert.ok(Math.abs(S.pOneSided(1.96, 1e6) - 0.025) < 1e-3);
  assert.ok(Math.abs(S.pOneSided(0, 50) - 0.5) < 1e-9);
  const ok = S.judge({ netR: 0.1 }, { netR: 0.1, n: 60 }, 0.04);
  assert.equal(ok.pass, true);
  assert.equal(S.judge({ netR: -0.1 }, { netR: 0.1, n: 80 }, 0.01).pass, false);
  assert.equal(S.judge({ netR: 0.1 }, { netR: 0.1, n: 59 }, 0.01).pass, false);
  assert.equal(S.judge({ netR: 0.1 }, { netR: 0.1, n: 80 }, 0.05).pass, false);
});

test('placebo stand-ins keep the weekday, the window and stay 3+ days from every announcement', () => {
  const ev = fomcEvents(Infinity).find((q) => q.date === '2019-06-19'), win = S.P.WIN.B, ban = ALL_ANNOUNCE();
  const pool = S.standIns(ev, win);
  assert.ok(pool.length > 20);
  const dn = (s) => Date.parse(s + 'T00:00:00Z') / 86400000;
  for (const c of pool) {
    assert.equal(new Date(c.date + 'T00:00:00Z').getUTCDay(), 3);
    assert.ok(ban.every((b) => Math.abs(dn(b) - dn(c.date)) > 3));
    assert.ok(c.T >= win[0] && c.T < win[1]); assert.equal(c.at, ev.at);
  }
});

test('RESULT.md matches result.json; T3 dropped; stand-alone wording; no rule touched', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(md, S.report(r));
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\.\\*\\*`));
  assert.deepEqual(Object.keys(r.tests), ['T1', 'T2']);
  assert.match(r.t3, /no decision/);
  assert.match(md, /item 44/); assert.match(md, /unverified/);
  for (const k of ['T1', 'T2']) {
    const o = r.tests[k], A = o.windows.A, B = o.windows.B;
    assert.equal(o.pass, A.netR > 0 && B.netR > 0 && o.pHolmB < 0.05 && B.n >= 60);
    assert.equal(B.placebo.seeds, 40);
  }
  assert.equal(r.verdict, r.passed.length ? 'PASS' : 'FAIL');
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  assert.match(pre, /stand-alone rule/); assert.match(pre, /T3 \(gold long only before rate-change meetings\)\s+is dropped/);
});

// ltf-structure: the lower-timeframe structure condition P of research/edge/ltf-structure (pre-registered, one run).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadFns } from '../council/mosha-desk.mjs';
import { group, knownEvents, lastKnown, holdsP, eventsOf, causalCheck, rng, welch, holm, evaluate, report, P, TF, IS, OOS } from '../research/edge/ltf-structure/run.mjs';

const DIR = new URL('../research/edge/ltf-structure/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

function series(n, seed, t0 = 1700000100) {                // a seeded random walk of 5-minute candles
  const r = rng(seed), out = []; let px = 100;
  for (let i = 0; i < n; i++) { const o = px, c = o + (r() - 0.5) * 0.8, h = Math.max(o, c) + r() * 0.3, l = Math.min(o, c) - r() * 0.3; out.push({ time: t0 - (t0 % 300) + i * 300, open: o, high: h, low: l, close: c }); px = c; }
  return out;
}

test('P reads no candle after the entry: events known by a cut equal those of the series cut there', () => {
  const F = loadFns(), M5 = series(6000, 7), r = rng(11);
  for (const sec of Object.values(TF)) { const bars = sec === 300 ? M5 : group(M5, sec);
    assert.ok(F.msAnalyze(bars, P.N).events.length > 3, 'the series has breaks on ' + sec);
    assert.equal(causalCheck(F, bars, sec, 70, r), 0); }
  // and P itself: changing every price after t never changes P at t
  const ev = eventsOf(F, M5), r2 = rng(5);
  for (let c = 0; c < 60; c++) {
    const i = 2000 + Math.floor(r2() * 3500), t = M5[i].time + 300, cutM5 = M5.slice(0, i + 1).concat(series(300, 900 + c, M5[i].time + 300).map((b) => ({ ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 3 })));
    const ev2 = eventsOf(F, cutM5);
    for (const s of [1, -1]) { assert.equal(holdsP(s, ev2, t), holdsP(s, ev, t)); }
  }
});

test('an event is known at the close of its break candle', () => {
  const bars = [{ time: 3600 }, { time: 7200 }, { time: 10800 }];
  assert.deepEqual(knownEvents([{ dir: 1, breakIdx: 1, structure: true }, { dir: -1, breakIdx: 2 }], bars, 3600), [{ k: 10800, dir: 1, structure: true }, { k: 14400, dir: -1, structure: false }]);
  const l = [{ k: 10 }, { k: 20 }, { k: 30 }];
  assert.equal(lastKnown(l, 9), null); assert.equal(lastKnown(l, 20).k, 20); assert.equal(lastKnown(l, 29).k, 20); assert.equal(lastKnown(l, 99).k, 30);
});

test('condition P on hand-made events', () => {
  const t = 100000, E = (k, dir, structure = false) => ({ k, dir, structure });
  const ok = { h1: [E(50000, 1)], m15: [E(t - 3600, 1, true)], m5: [E(t - 300, 1)] };
  assert.equal(holdsP(1, ok, t), true);
  assert.equal(holdsP(-1, ok, t), false);
  assert.equal(holdsP(1, { ...ok, h1: [E(50000, 1), E(60000, -1)] }, t), false, 'H1 last break against');
  assert.equal(holdsP(1, { ...ok, h1: [E(50000, -1), E(t + 1, 1)] }, t), false, 'an H1 break known after t is not read');
  assert.equal(holdsP(1, { ...ok, m15: [E(t - 3600, 1, false)] }, t), false, 'M15 continuation break is not a shift');
  assert.equal(holdsP(1, { ...ok, m15: [E(t - P.fresh, 1, true)] }, t), true, 'exactly 6 hours is fresh');
  assert.equal(holdsP(1, { ...ok, m15: [E(t - P.fresh - 1, 1, true)] }, t), false, 'older than 6 hours');
  assert.equal(holdsP(1, { ...ok, m15: [E(t - 7200, 1, true), E(t - 900, 1, false)] }, t), false, 'the LAST M15 event must be the shift');
  assert.equal(holdsP(1, { ...ok, m5: [E(t - 300, -1)] }, t), false, 'M5 against');
  assert.equal(holdsP(1, { ...ok, m5: [] }, t), false, 'no event = no P');
  assert.equal(holdsP(1, { ...ok, m5: [E(t, 1)] }, t), true, 'known exactly at t counts');
  const mirror = { h1: [E(50000, -1)], m15: [E(t - 3600, -1, true)], m5: [E(t - 300, -1)] };
  assert.equal(holdsP(-1, mirror, t), true); assert.equal(holdsP(1, mirror, t), false);
  assert.equal(P.N, 6); assert.equal(P.fresh, 21600); assert.deepEqual(TF, { h1: 3600, m15: 900, m5: 300 });
});

test('candles are grouped on their UTC time; statistics', () => {
  const g = group([{ time: 3600, open: 1, high: 2, low: 0.5, close: 1.5 }, { time: 3900, open: 1.5, high: 3, low: 1, close: 2 }, { time: 4500, open: 2, high: 2.5, low: 0.2, close: 1 }], 900);
  assert.deepEqual(g, [{ time: 3600, open: 1, high: 3, low: 0.5, close: 2 }, { time: 4500, open: 2, high: 2.5, low: 0.2, close: 1 }]);
  const w = welch([1, 2, 3, 4], [0, 1, 2, 3]); assert.equal(w.diff, 1); assert.ok(Math.abs(w.t - 1.1) < 0.01);
  const tests = [{ p: 0.01 }, { p: 0.04 }, { p: 0.03 }]; holm(tests, 'p'); assert.deepEqual(tests.map((x) => x.pHolm), [0.03, 0.06, 0.06]);
  // a group needs 100 out-of-sample trades; a pass needs every check
  const rows = []; for (let i = 0; i < 400; i++) { const oos = i % 2, t = (oos ? OOS[0] : IS[0]) + (i % 20) * 30 * 86400 + i, p = i % 4 < 2; rows.push({ kind: 'barrier', t, booked: p ? 0.5 + (i % 3) * 0.1 : -0.5, net: p ? 0.5 + (i % 3) * 0.1 : -0.5, p }); }
  for (let i = 0; i < 50; i++) rows.push({ kind: 'sop', t: OOS[0] + i, booked: 1, net: 1, p: true });
  const ev = evaluate(rows, 'p'); assert.deepEqual(ev.map((o) => o.group), ['barrier', 'pool']);
  assert.equal(ev[0].pass, true); assert.equal(ev[0].oos.share, 50);
  assert.equal(evaluate(rows.map((r) => ({ ...r, net: -r.net })), 'p')[0].pass, false);
});

test('RESULT.md is the report of result.json; the verdict and headline figures agree', () => {
  assert.equal(md, report(res));
  assert.match(md, /^# .*22 Nov 2026/);
  assert.ok(md.includes(`**Verdict: ${res.verdict}.** ${res.headline}`));
  const passing = res.groups.filter((o) => o.pass && !res.placeboPass.includes(o.name));
  assert.equal(res.verdict, passing.length ? 'PASS' : 'FAIL');
  assert.equal(res.groups.length, 13); assert.equal(res.causal.mismatches, 0); assert.ok(res.causal.cuts >= 200 * 3);
  const pool = res.groups.find((o) => o.group === 'pool');
  assert.equal(pool.is.n + pool.oos.n, res.n);
  assert.ok(res.headline.includes(`n ${pool.oos.with.n}`) && res.headline.includes(`month t ${pool.oos.with.tMonth}`));
  for (const o of res.groups) { assert.equal(o.oos.with.n + o.oos.without.n, o.oos.n); if (o.group !== 'pool') assert.ok(o.oos.n >= P.minGroup);
    assert.equal(o.pass, o.checks.oosProfit && o.checks.isProfit && o.checks.diffBoth && o.checks.enough); }
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['at most 6 hours', 'One run, no variants', 'Holm', 'Placebo', '2026 is excluded']) assert.ok(pre.includes(w), w);
});

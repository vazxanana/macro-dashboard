// gold-late-ny: the pure pieces on hand-made candles (offline, no look-ahead), and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyT, signalOf, windowOf, simulate, candidates, trades, TESTS, COST, holm, monthSums, monthT, placebo, M, D } from '../research/edge/gold-late-ny/run.mjs';
import { nights } from '../council/fills.mjs';

const day = (s) => Date.parse(s + 'T00:00:00Z') / 1000 / D;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);
function path(from, to, f, wick = 0.05) {
  const out = []; for (let t = from; t < to; t += M) { const o = f(t), c = f(t + M); out.push({ time: t, open: o, close: c, high: Math.max(o, c) + wick, low: Math.min(o, c) - wick }); } return out;
}

test('New York times in UTC through the US daylight rule; Friday trades from the Sunday reopen; no rollover crossed', () => {
  assert.equal(iso(nyT(day('2026-07-15'), 13.5)), '2026-07-15T17:30');
  assert.equal(iso(nyT(day('2026-01-15'), 18)), '2026-01-15T23:00');
  const by = new Map(path(day('2026-07-15') * D, day('2026-07-21') * D, () => 100).map((b) => [b.time, b]));
  const w = windowOf(by, day('2026-07-17'));
  assert.equal(iso(w.t0), '2026-07-19T22:00', 'Friday -> Sunday 18:00 New York'); assert.equal(iso(w.t1), '2026-07-20T06:00');
  assert.equal(windowOf(by, day('2026-07-15')).cs.length, 32);
  for (const d of ['2026-01-05', '2026-07-08', '2026-03-11', '2026-11-04', '2026-10-30']) { const e = day(d), x = { t0: nyT(e, 18), t1: nyT(e + 1, 2) }; assert.equal(nights(x.t0, x.t1), 0, d); }
});

test('the CME calendar skips early closes and holidays', () => {
  const by = new Map(path(day('2026-11-23') * D, day('2026-12-29') * D, (t) => 100 + (t % 7200) / 7200).map((b) => [b.time, b]));
  assert.equal(signalOf(by, day('2026-11-27')).skip, 'shut', 'the day after Thanksgiving closes at 13:00');
  assert.equal(signalOf(by, day('2026-12-24')).skip, 'shut', 'Christmas Eve closes early');
  assert.equal(windowOf(by, day('2026-12-24')).skip, 'shut', 'no evening session before Christmas Day');
  assert.ok(!signalOf(by, day('2026-11-24')).skip && !windowOf(by, day('2026-11-24')).skip, 'an ordinary Tuesday trades');
});

test('stop first, a gap through fills at the open; follow buys after an up move, fade sells; costs charged', () => {
  const r = simulate([{ open: 100, high: 100.5, low: 99, close: 99.5 }, { open: 97, high: 97, low: 96, close: 96 }], 1, 2);
  assert.equal(r.how, 'stop'); assert.equal(r.exit, 97); assert.equal(r.R, -1.5);
  const c = { d: day('2026-07-15'), move: 2, ratio: 1, dist: 4, t0: nyT(day('2026-07-15'), 18), t1: nyT(day('2026-07-16'), 2),
    cs: [{ open: 100, high: 101, low: 99.5, close: 101 }, { open: 101, high: 102.2, low: 100.8, close: 102 }] };
  const [f] = trades([c], TESTS.T1), [fd] = trades([c], TESTS.T3);
  assert.equal(f.side, 1); assert.equal(fd.side, -1); assert.equal(f.R, 0.5); assert.equal(fd.R, -0.5);
  assert.ok(Math.abs(f.net - (0.5 - COST / 4)) < 1e-12); assert.equal(f.fin, 0);
  assert.equal(trades([{ ...c, ratio: 0.4 }], TESTS.T2).length, 0); assert.equal(trades([{ ...c, ratio: 0.6 }], TESTS.T2).length, 1);
  assert.equal(placebo([c, c], 3).means.length, 3);
});

test('no look-ahead: the size and the stop read only earlier signals and finished windows', () => {
  const from = day('2026-05-04'), to = day('2026-07-11');
  const make = (bump) => path(from * D, to * D, (t) => 100 + Math.sin(t / 5000) * 3 + (bump && t >= nyT(day('2026-07-08'), 13.5) ? 50 : 0));
  const a = candidates(make(false), '2026-05-04').cands, b = candidates(make(true), '2026-05-04').cands;
  const ca = a.find((x) => x.d === day('2026-07-08')), cb = b.find((x) => x.d === day('2026-07-08'));
  assert.ok(ca && cb); assert.equal(ca.size, cb.size, 'the day\'s own move is not in its mean'); assert.equal(ca.dist, cb.dist, 'its own window is not in the stop');
  const prev = a.find((x) => x.d === day('2026-07-07')), prevB = b.find((x) => x.d === day('2026-07-07'));
  assert.deepEqual([prev.move, prev.size, prev.dist], [prevB.move, prevB.size, prevB.dist], 'a later price changes nothing before it');
});

test('statistics: month sums with empty months, Holm', () => {
  const ms = monthSums([{ d: day('2026-01-10'), net: 1 }, { d: day('2026-03-02'), net: 2 }], '2026-01-01', '2026-03-31');
  assert.deepEqual(ms, [1, 0, 2]); assert.ok(Math.abs(monthT(ms) - Math.sqrt(3)) < 1e-9);
  holm([0.01, 0.04, 0.03]).forEach((p, i) => assert.ok(Math.abs(p - [0.03, 0.06, 0.06][i]) < 1e-12));
});

test('the report and result.json agree; item 44 and the verdict are stated', () => {
  const dir = new URL('../research/edge/gold-late-ny/', import.meta.url);
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
  for (const s of [pre, md]) assert.match(s, /not a gate, exit, entry or size of the gold book/);
  assert.equal(r.passed.length, 0); assert.match(r.verdict, /^FAIL/); assert.match(md, /^\*\*Verdict: FAIL, 0 of 3:/m);
  const m = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  for (const [id, row] of Object.entries(r.tests)) {
    assert.equal(row.pass, false);
    for (const w of ['is', 'oos']) {
      const x = row[w], line = md.split('\n').find((l) => l.startsWith(`| ${id} `) && l.includes(w === 'is' ? 'in sample 2016-20' : 'out of sample 2021-now') && l.includes(`| ${x.n} |`));
      assert.ok(line, `${id} ${w} row`);
      for (const v of [m(x.gross), m(x.avg), m(x.avgX2), `${x.t.toFixed(2).replace('-', '−')}`, `${x.buys} / ${x.sells}`]) assert.ok(line.includes(v), `${id} ${w} ${v}`);
      assert.ok(md.includes(`| ${id} | ${w === 'is' ? 'in sample' : 'out of sample'} | ${m(x.avg)} | ${m(x.placebo.p5)} / ${m(x.placebo.p50)} / ${m(x.placebo.p95)} | ${x.placebo.beats} of 40 |`), `${id} ${w} placebo`);
    }
  }
  assert.ok(md.includes(`−${(-r.descriptive.oos.corrWindow).toFixed(3)}`));
});

// fade-tick-exec: the tick evaluation on hand-made probe answers, both sides (offline). The result is pinned once RESULT.md exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tickRule, crossing, midTrace, queriesOf, spans, sample } from '../research/edge/fade-tick-exec/run.mjs';
import { exits } from '../research/edge/grid7-wide-fade/run.mjs';

const HERE = new URL('../research/edge/fade-tick-exec/', import.meta.url);
const ms = (s) => s * 1000;

test('every stored order: stop on the losing side, target on the winning side, both sides present', () => {
  for (const sym of ['XAUUSD', 'USDJPY']) {
    const O = JSON.parse(fs.readFileSync(new URL(`orders-${sym}.json`, HERE), 'utf8'));
    assert.equal(O.length, 1200);
    assert.ok(O.some((o) => o.side > 0) && O.some((o) => o.side < 0));
    for (const o of O) for (const r of Object.values(o.rules)) {
      assert.ok(o.side * (o.fillM - r.stopM) > 0, 'stop on the losing side');
      assert.ok(o.side * (r.tgtM - o.fillM) > 0, 'target on the winning side');
      assert.ok(Math.abs(r.tgtM - (o.fillM + o.side * r.k * r.D)) < 1e-9);
    }
  }
});

test('the batch files stay inside the probe limits', () => {
  for (const f of fs.readdirSync(HERE).filter((x) => /^batch-\d+\.json$/.test(x))) {
    const j = JSON.parse(fs.readFileSync(new URL(f, HERE), 'utf8'));
    for (const [sym, list] of Object.entries(j.fills)) {
      assert.ok(list.length <= 3000, f); assert.ok(j[sym].length <= 500, f);
      for (const q of list) { assert.ok(q[2] > q[1] && q[2] - q[1] <= 1800); assert.ok(q[4] === 1 || q[4] === -1); }
    }
  }
});

// a mid tracer for one target equals exits(); a sell's target is below its fill
test('midTrace equals exits() for a buy and a sell', () => {
  const bars = []; let p = 100;
  for (let i = 0; i < 400; i++) { const o = p; p += Math.sin(i * 0.7) * 0.6 + (i % 13 === 0 ? -1.2 : 0.15); bars.push({ t: i * 300, e: i * 300 + 300, o, h: Math.max(o, p) + 0.2, l: Math.min(o, p) - 0.2, c: p }); }
  for (const s of [1, -1]) for (const fi of [5, 50, 120]) {
    const fill = bars[fi].o, stop = fill - s * 1.5, tgt = fill + s * 3;
    const a = exits(bars, s, fi, stop, [tgt], 86400), b = midTrace(bars, s, fi, stop, tgt, 86400);
    assert.ok(Math.abs((s * (b.px - fill)) / 1.5 - a.R[0]) < 1e-9);
  }
});

test('queries: a sell asks for its stop above and its target below the fill', () => {
  const M5 = Array.from({ length: 60 }, (_, i) => ({ t: 1000 + i * 300, e: 1300 + i * 300, o: 100, h: 104, l: 96, c: 100 }));
  const o = { id: 'z', ts: 1000, side: -1, fillM: 100, deadEnd: 1000 + 59 * 300 + 300, rules: { a: { D: 1, k: 2, stopM: 101, tgtM: 98, mid: { exitEnd: 4000 } } } };
  const q = queriesOf(o, 'a', M5, 'XAUUSD');
  const se = q.find((x) => /\|se0$/.test(x[0])), te = q.find((x) => /\|te0$/.test(x[0]));
  assert.equal(se[4], 1); assert.ok(se[3] < 101 && se[3] > 100); // early stop query: ask >= 100.5
  assert.equal(te[4], -1); assert.ok(te[3] > 98 && te[3] < 100);  // early target query: bid <= 98.5
});

// hand-made answers. o.rules.a: D 1, k 2. Entry mark at ts; deadline mark at deadEnd.
const mk = (side) => ({ id: 'o', ts: 1000, side, fillM: 100, deadEnd: 1000 + 86400, rules: { a: { D: 1, k: 2, stopM: 100 - side, tgtM: 100 + 2 * side, coverEnd: 1000 + 86400, nq: { s: 1, t: 1 }, mid: {} } } });
const marks = (bid, ask) => new Map([[1000, [1000, bid, ask, 2, ask - bid]], [1000 + 86400, [1000 + 86400, 100.4, 100.5, 3, 0.1]]]);

test('a buy fills at the ask; an exact stop tick (gap through) books from that bid', () => {
  const F = new Map([['o|a|se0', ['o|a|se0', ms(1500), 99.0, 99.1]], ['o|a|sl0', ['o|a|sl0', ms(1600), 98.4, 98.5]], ['o|a|te0', ['o|a|te0', null]], ['o|a|tl0', ['o|a|tl0', null]]]);
  const r = tickRule(mk(1), 'a', 'XAUUSD', F, marks(100.0, 100.1));
  assert.equal(r.A, 100.1); assert.equal(r.ex, 'stop'); assert.equal(r.how, 'exact'); // X = 99.1, the bid 99.0 is past it
  assert.ok(Math.abs(r.R - (99.0 - 100.1)) < 1e-9);
});

test('a sell at its target scores +2R off its tick fill (target below the entry)', () => {
  const F = new Map([['o|a|se0', ['o|a|se0', null]], ['o|a|sl0', ['o|a|sl0', null]], ['o|a|te0', ['o|a|te0', ms(2000), 97.85, 97.9]], ['o|a|tl0', ['o|a|tl0', ms(2000), 97.85, 97.9]]]);
  const r = tickRule(mk(-1), 'a', 'XAUUSD', F, marks(99.9, 100.0)); // sell at the bid 99.9, T = 97.9: the ask 97.9 reached it
  assert.equal(r.A, 99.9); assert.ok(Math.abs(r.T - 97.9) < 1e-9); assert.equal(r.ex, 'target'); assert.ok(Math.abs(r.R - 2) < 1e-9);
});

test('a bracketed stop is booked at its level; overlapping stop and target intervals are unresolved', () => {
  const F = new Map([['o|a|se0', ['o|a|se0', ms(1500), 99.5, 99.6]], ['o|a|sl0', ['o|a|sl0', ms(1900), 98.9, 99.0]], ['o|a|te0', ['o|a|te0', null]], ['o|a|tl0', ['o|a|tl0', null]]]);
  const r = tickRule(mk(1), 'a', 'XAUUSD', F, marks(100.0, 100.1)); // X 99.1: the early tick's bid 99.5 is not past it
  assert.equal(r.how, 'bracket'); assert.ok(Math.abs(r.R + 1) < 1e-9);
  F.set('o|a|te0', ['o|a|te0', ms(1700), 101.9, 102.0]); F.set('o|a|tl0', ['o|a|tl0', ms(1800), 102.2, 102.3]);
  assert.equal(tickRule(mk(1), 'a', 'XAUUSD', F, marks(100.0, 100.1)).exitUnresolved, 'overlap');
});

test('no crossing: out at the deadline quote; windows cut before the deadline: unresolved; no entry quote: left out', () => {
  const none = new Map(['se0', 'sl0', 'te0', 'tl0'].map((k) => [`o|a|${k}`, [`o|a|${k}`, null]]));
  const r = tickRule(mk(1), 'a', 'XAUUSD', none, marks(100.0, 100.1));
  assert.equal(r.ex, 'time'); assert.ok(Math.abs(r.R - (100.4 - 100.1)) < 1e-9);
  const cut = mk(1); cut.rules.a.coverEnd = 5000;
  assert.equal(tickRule(cut, 'a', 'XAUUSD', none, marks(100.0, 100.1)).exitUnresolved, 'windows cut');
  const old = new Map([[1000, [1000, 100, 100.1, 120, 0.1]]]);
  assert.equal(tickRule(mk(1), 'a', 'XAUUSD', none, old).entryUnresolved, true);
});

test('a crossing before the entry does not count; helpers', () => {
  assert.equal(crossing([['x', ms(500), 1, 1]], [], () => true, ms(1000), 1, (x) => x[2]), null);
  for (const [a, b] of spans([0, 300, 600, 3600])) assert.ok(b - a <= 1800 && b > a);
  const L = Array.from({ length: 50 }, (_, i) => ({ ts: i })); assert.deepEqual(sample(L, 10, 7), sample(L, 10, 7));
});

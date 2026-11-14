// research/edge/index-cycle: the owner's market cycle as an entry on US indices. Offline: hand-made candles and a seeded
// random walk; the committed result.json against RESULT.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, COST, swings, boEvents, h4Of, signals, simulate, trades, nights, finPoints, costed, rateAt, atrAt, monthly, holm, pct, mulberry, verdictText } from '../research/edge/index-cycle/run.mjs';

const DIR = new URL('../research/edge/index-cycle/', import.meta.url);
const bar = (i, o, h, l, c) => ({ time: 1700000000 - (1700000000 % 14400) + i * 3600, open: o, high: h, low: l, close: c });
// up candles reach 0.2 past their close and 0.05 under their open; down candles the mirror image, so neighbours never tie
const fromCloses = (cs) => cs.map((c, i) => { const o = i ? cs[i - 1] : c; return c >= o ? bar(i, o, c + 0.2, o - 0.05, c) : bar(i, o, o + 0.05, c - 0.2, c); });
function walk(n, seed = 7) { const r = mulberry(seed), out = []; let p = 1000; for (let i = 0; i < n; i++) { const o = p, c = o + (r() - 0.48) * 6, h = Math.max(o, c) + r() * 2, l = Math.min(o, c) - r() * 2; out.push({ time: 1500000000 - (1500000000 % 14400) + i * 3600, open: o, high: h, low: l, close: c }); p = c + (r() - 0.5) * 0.5; } return out; }

test('swings: a high not below the w before and above the w after', () => {
  const B = fromCloses([10, 11, 12, 15, 12, 11, 10, 9, 8, 9, 10]);
  const { hi, lo } = swings(B, 1);
  assert.equal(hi[3], 1); assert.equal(lo[8], 1);
  assert.equal(hi.reduce((a, b) => a + b, 0), 1);
});

test('BO: a close beyond the swing, only once it is confirmed, each level once, closed candles only', () => {
  // swing high at 3 (15.2), confirmed at the close of candle 4 (w = 1); candle 8 closes above it
  const B = fromCloses([10, 11, 12, 15, 12, 11, 13, 14, 16, 17, 18]);
  const ev = boEvents(B, 1, 3600).filter((e) => e.dir === 1);
  assert.equal(ev.length >= 1, true);
  assert.equal(ev[0].i, 8);   // candles 6 and 7 close at 13 and 14, under the swing high 15.2; candle 8 closes at 16
  assert.ok(B[ev[0].i].close > B[3].high);
  assert.equal(ev[0].t, B[ev[0].i].time + 3600);
  // a swing that is not yet confirmed when the candle opens is not broken: w = 3 needs three candles after it
  const C = fromCloses([10, 11, 12, 15, 14, 16]);
  assert.equal(boEvents(C, 3, 3600).filter((e) => e.dir === 1).length, 0);
});

test('ChoCh and pullback finished: H4 BO up, H1 BO down, then H1 BO up; no look-ahead', () => {
  const H1 = walk(6000), H4 = h4Of(H1), full = signals(H1, H4).sigs;
  assert.ok(full.length > 20);
  for (const s of full) {
    assert.ok(s.chT > s.h4t && s.finT > s.chT);
    assert.ok(s.chI < s.finI);
  }
  // cut the data at a signal's finish candle: every signal up to it is computed identically
  const s = full[Math.floor(full.length / 2)], cut = H1.slice(0, s.finI + 1), part = signals(cut, h4Of(cut)).sigs;
  const before = full.filter((x) => x.finI <= s.finI);
  assert.deepEqual(part.slice(0, before.length), before);
  // and changing every candle after the finish changes none of those signals
  const alt = H1.map((b, i) => (i > s.finI ? { ...b, open: b.open * 1.1, high: b.high * 1.1, low: b.low * 1.1, close: b.close * 1.1 } : b));
  assert.deepEqual(signals(alt, h4Of(alt)).sigs.slice(0, before.length), before);
});

test('every trade has its stop on the losing side; exit A only with >= 1R to the H4 extreme; one trade at a time', () => {
  const H1 = walk(8000, 11), rates = [['2000-01-01', 2]];
  const { trades: T } = trades('nas100', H1, h4Of(H1), rates);
  assert.ok(T.A.length > 5 && T.B.length > 5);
  for (const x of ['A', 'B']) {
    let last = -Infinity;
    for (const t of T[x]) {
      assert.ok(t.side > 0 ? t.stop < t.entry : t.stop > t.entry, 'stop on the losing side');
      assert.ok(t.r0 > 0);
      assert.ok(t.entryT >= last, 'one at a time'); last = t.exitT;
      if (x === 'A') assert.ok(t.rr >= K.MIN_R); else assert.equal(t.rr, 2);
      assert.ok(Math.abs(t.target - (t.entry + t.side * t.rr * t.r0)) < 1e-6);
    }
  }
});

test('simulate: stop first, a gap past the stop at the open, target, 48-candle time exit', () => {
  const mk = (rows) => rows.map((r, i) => ({ time: i * 3600, open: r[0], high: r[1], low: r[2], close: r[3] }));
  // stop and target in one candle: stop
  assert.deepEqual(simulate(mk([[100, 110, 90, 100]]), 0, 1, 95, 105), { exit: 95, exitT: 3600, how: 'stop' });
  // a later candle opens under the stop: out at that open
  assert.equal(simulate(mk([[100, 101, 99, 100], [93, 94, 92, 93]]), 0, 1, 95, 105).exit, 93);
  // a sell reaching its target
  assert.equal(simulate(mk([[100, 101, 99, 100], [100, 100.5, 94, 95]]), 0, -1, 103, 96).how, 'target');
  // nothing hit: out at the close of the 48th candle
  const flat = mk(Array.from({ length: 60 }, () => [100, 101, 99, 100.5]));
  const r = simulate(flat, 0, 1, 95, 110);
  assert.equal(r.how, 'time'); assert.equal(r.exitT, 48 * 3600); assert.equal(r.exit, 100.5);
  // data ends first: no result
  assert.equal(simulate(flat.slice(0, 10), 0, 1, 95, 110), null);
});

test('costs: spread + slippage points, financing per 22:00 UTC, longs DGS2 + 2.5 %, shorts max(0, 2.5 % - DGS2)', () => {
  assert.deepEqual(COST, { nas100: 4, spx500: 2, us30: 5 });
  const d = Date.UTC(2024, 0, 3) / 1000;   // Wednesday 00:00 UTC
  assert.equal(nights(d, d + 21 * 3600), 0);
  assert.equal(nights(d, d + 22 * 3600), 1);
  assert.equal(nights(d + 22 * 3600, d + 23 * 3600), 0);
  assert.equal(nights(d, d + 3 * 86400), 3);
  assert.ok(Math.abs(finPoints(1, 10000, 1, 4) - 10000 * 0.065 / 365) < 1e-9);
  assert.ok(Math.abs(finPoints(-1, 10000, 1, 1) - 10000 * 0.015 / 365) < 1e-9);
  assert.equal(finPoints(-1, 10000, 2, 4), 0);
  assert.equal(rateAt([['2024-01-05', 4], ['2024-01-12', 4.2]], Date.UTC(2024, 0, 13) / 1000), 4.2);
  const c = costed('nas100', 1, 10000, 20, 10040, d, d + 23 * 3600, [['2020-01-01', 4]]);
  assert.equal(c.gross, 2); assert.equal(c.nights, 1);
  assert.ok(Math.abs(c.net - (2 - (4 + 10000 * 0.065 / 365) / 20)) < 1e-9);
});

test('statistics helpers: monthly sums with empty months, Holm, percentile, ATR', () => {
  const from = Date.UTC(2020, 0, 1) / 1000, to = Date.UTC(2020, 3, 1) / 1000;
  const m = monthly([{ exitT: from + 86400, net: 1 }, { exitT: from + 86400 * 40, net: -1 }], from, to);
  assert.equal(m.months, 3); assert.equal(m.sum, 0);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(pct([1, 2, 3, 4, 5], 0.5), 3);
  const B = [{ high: 2, low: 1, close: 1.5 }, { high: 3, low: 2, close: 2.5 }];
  assert.equal(atrAt(B, 1, 14), 1.5);
});

test('result.json and RESULT.md agree; verdict first', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(R.verdict, verdictText({ exits: R.exits }));
  const pass = R.exits.A.pass || R.exits.B.pass;
  assert.match(md.split('\n').find((l) => /Verdict/.test(l)), pass ? /PASS/ : /FAIL/);
  for (const x of ['A', 'B']) {
    const e = R.exits[x];
    for (const v of [e.dec.net, e.rep.net, e.dec.tMonthly, e.placebo.p95, e.placebo.mean]) assert.ok(md.includes(v.toFixed(Math.abs(v) < 1 && String(v).split('.')[1]?.length === 3 ? 3 : 2)) || md.includes(String(v)), `${x}: ${v} in RESULT.md`);
    assert.ok(md.includes(String(e.dec.n)) || md.includes(e.dec.n.toLocaleString('en-US')));
    assert.ok(md.includes(`${e.placebo.beats} of 40`));
    for (const mk of ['nas100', 'spx500', 'us30']) { const p = R.perMarket[mk][x]; assert.ok(md.includes(`| ${p.dec.n} | ${p.dec.net.toFixed(3)} | ${p.dec.tMonthly.toFixed(2)} |`), `${x} ${mk}`); }
  }
});

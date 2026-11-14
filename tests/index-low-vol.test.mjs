// research/edge/index-low-vol: the volatility ranking with no look-ahead on a hand-made panel, both sizing rules, the stop,
// the costs, Holm, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  P, COST, volAt, rankAt, weightOf, legOf, booksOf, rowsOf, monthEnds, monthOf, nwT, nightRate, holm, phi,
} from '../research/edge/index-low-vol/run.mjs';
import { nights } from '../council/fills.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../research/edge/index-low-vol');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// one weekday candle a day from 2010-01-04; market j alternates up / down by amp_j a day around a slow drift
const T0 = Date.UTC(2010, 0, 4) / 1000;
function series(ret, days = 700) {
  const bars = []; let prev = 100;
  for (let t = T0; bars.length < days; t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const c = prev * Math.exp(ret(bars.length)), o = prev;
    bars.push({ time: t, open: o, high: Math.max(o, c) * 1.002, low: Math.min(o, c) * 0.998, close: c }); prev = c;
  }
  return { bars, ends: monthEnds(bars) };
}
// eight markets, volatility rising with j (m0 the calmest)
function panel(mut = null, days = 700) {
  const D = {};
  for (let j = 0; j < 8; j++) {
    const amp = 0.002 + 0.002 * j;
    D['m' + j] = series((k) => (mut ? mut(j, k) : 0) + (k % 2 ? amp : -amp) + 0.0001, days);
  }
  return D;
}
const rate0 = () => 0;
const sd = (xs) => { const mu = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1)); };

test('ranking: 12-month sd of daily log returns, ascending, needs 13 months of history', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time);
  assert.equal(rankAt(D, m0 + 11).length, 0, 'not before a month m-12 close exists');
  const m = m0 + 15, list = rankAt(D, m);
  assert.deepEqual(list.map((x) => x.key), ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']);
  const { bars, ends } = D.m3, a = ends.get(m - 12), i = ends.get(m), xs = [];
  for (let k = a + 1; k <= i; k++) xs.push(Math.log(bars[k].close / bars[k - 1].close));
  assert.ok(near(volAt(D, 'm3', m).sigma, sd(xs)));
  assert.ok(near(list[3].sigma, sd(xs)));
});

test('no look-ahead: the ranking at month m reads nothing after month m', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), m = m0 + 15;
  const endT = D.m0.bars[D.m0.ends.get(m)].time;
  // make the calmest market the wildest after month m: the ranking at m must not move
  const D2 = panel((j, k) => (D.m0.bars[k] && D.m0.bars[k].time > endT && j === 0 ? (k % 2 ? 0.12 : -0.12) : 0));
  assert.deepEqual(rankAt(D2, m), rankAt(D, m));
  assert.equal(rankAt(D2, m + 1)[7].key, 'm0', 'month m+1 does see it');
  // inside month m it counts
  const D3 = panel((j, k) => (D.m0.bars[k] && D.m0.bars[k].time <= endT && D.m0.bars[k].time > endT - 15 * 86400 && j === 0 ? (k % 2 ? 0.08 : -0.08) : 0));
  assert.notEqual(rankAt(D3, m)[0].key, 'm0');
});

test('a stale month end is not ranked', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), m = m0 + 15;
  const { bars, ends } = D.m5, i = ends.get(m);
  const cut = bars.filter((b) => !(monthOf(b.time) === m && b.time > bars[i].time - 10 * 86400));
  D.m5 = { bars: cut, ends: monthEnds(cut) };
  assert.ok(!rankAt(D, m).some((x) => x.key === 'm5'));
});

test('T1 sizing: long the 3 calmest, short the 3 wildest, 1R = 3 x ATR(20), stop on the losing side, entry at the next open', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), last = D.m0.bars[D.m0.bars.length - 1].time;
  const B = booksOf(D, { mFrom: m0, mTo: m0 + 20, rate: rate0, lastT: last });
  const h = B.find((x) => x.m === m0 + 15);
  assert.deepEqual(h.low, ['m0', 'm1', 'm2']); assert.deepEqual(h.high, ['m5', 'm6', 'm7']); assert.equal(h.book, h.m + 1);
  for (const lg of h.t1) {
    const { bars, ends } = D[lg.key];
    assert.equal(lg.entry, bars[ends.get(h.m) + 1].open);
    assert.equal(lg.dir, h.low.includes(lg.key) ? 1 : -1);
    assert.ok(lg.dir > 0 ? lg.stop < lg.entry : lg.stop > lg.entry);
    assert.ok(near(Math.abs(lg.entry - lg.stop), lg.R));
    assert.ok(near(lg.g, lg.dir * (lg.exitPx - lg.entry) / lg.R), 'gross R = the move over 1R');
  }
  const [row] = rowsOf(B, 1, h.book, h.book);
  assert.ok(near(row.net, h.t1.reduce((a, lg) => a + lg.g - lg.spr - lg.fin, 0) / h.t1.length));
});

test('T2 sizing: both books long, w = 1 % / (sigma x sqrt 21), figure = Low book - High book', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), last = D.m0.bars[D.m0.bars.length - 1].time;
  const B = booksOf(D, { mFrom: m0, mTo: m0 + 20, rate: nightRate(() => 2), lastT: last });
  const h = B.find((x) => x.m === m0 + 15);
  for (const lg of h.t2) {
    assert.equal(lg.dir, 1, 'long-only');
    assert.ok(near(lg.w, P.volTarget / (h.sig[lg.key] * Math.sqrt(21))));
    assert.ok(near(lg.g, lg.w * 100 * (lg.exitPx - lg.entry) / lg.entry), 'return in % of the book');
    assert.ok(lg.stop < lg.entry && near(lg.entry - lg.stop, lg.R), 'same 3 x ATR stop');
  }
  const lowW = h.t2.filter((x) => x.book === 'low').reduce((a, x) => a + x.w, 0), highW = h.t2.filter((x) => x.book === 'high').reduce((a, x) => a + x.w, 0);
  assert.ok(lowW > highW, 'the calm book holds more notional');
  assert.ok(near(weightOf(0.01), 0.01 / (0.01 * Math.sqrt(21))));
  const [row] = rowsOf(B, 2, h.book, h.book);
  const net = (b) => h.t2.filter((x) => x.book === b).reduce((a, x) => a + x.g - x.spr - x.fin, 0);
  assert.ok(near(row.net, net('low') - net('high'))); assert.ok(near(row.lowNet, net('low')));
  const attr = new Map(); rowsOf(B, 2, h.book, h.book, 1, attr);
  assert.ok(near([...attr.values()].reduce((a, b) => a + b, 0), row.net));
});

test('the stop: a gap through it fills at the open; a plain stop loses exactly 1R; otherwise out at the next month end', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), m = m0 + 15, last = D.m0.bars[D.m0.bars.length - 1].time;
  const lgT = legOf(D, 'm0', m, 1, rate0, last, (e, R) => 1 / R);
  assert.equal(lgT.why, 'time');
  const { bars, ends } = D.m0, e = ends.get(m) + 1;
  assert.equal(lgT.exitT, bars[ends.get(m + 1)].time); assert.equal(lgT.exitPx, bars[ends.get(m + 1)].close);
  const gapBars = bars.map((b, k) => (k === e + 3 ? { ...b, open: b.open * 0.8, low: b.low * 0.8 } : b));
  const DG = { ...D, m0: { bars: gapBars, ends: monthEnds(gapBars) } };
  const lgG = legOf(DG, 'm0', m, 1, rate0, last, (x, R) => 1 / R);
  assert.equal(lgG.why, 'stop-gap'); assert.equal(lgG.exitPx, gapBars[e + 3].open); assert.ok(lgG.g < -1);
  const lowBars = bars.map((b, k) => (k === e + 3 ? { ...b, low: b.open - 10 } : b));
  const DL = { ...D, m0: { bars: lowBars, ends: monthEnds(lowBars) } };
  const lgS = legOf(DL, 'm0', m, 1, rate0, last, (x, R) => 1 / R);
  assert.equal(lgS.why, 'stop'); assert.equal(lgS.exitPx, lgS.stop); assert.ok(near(lgS.g, -1));
});

test('costs: half spreads at entry and exit, financing a rollover night on shorts too', () => {
  const D = panel(), m0 = monthOf(D.m0.bars[0].time), m = m0 + 15, last = D.m0.bars[D.m0.bars.length - 1].time;
  const lg = legOf(D, 'm1', m, -1, nightRate(() => 1.5), last, (e, R) => 1 / R);
  assert.equal(lg.why, 'time');
  assert.ok(near(lg.spr, (COST.roundTrip / 2) * (lg.entry + lg.exitPx) / lg.R));
  const { bars, ends } = D.m1, e = ends.get(m) + 1, x = ends.get(m + 1);
  let fin = 0; for (let k = e; k < x; k++) fin += nights(bars[k].time, bars[k + 1].time) * ((1.5 / 100 + COST.markup) / 365) * bars[k].close / lg.R;
  assert.ok(near(lg.fin, fin) && fin > 0);
});

test('Newey-West, the normal CDF and Holm', () => {
  const xs = [0.1, -0.05, 0.2, 0.03, -0.1, 0.07, 0.12, -0.02, 0.05, 0.01];
  const n = xs.length, mu = xs.reduce((a, b) => a + b, 0) / n, s = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / n);
  assert.ok(near(nwT(xs, 0), mu / (s / Math.sqrt(n))));
  assert.ok(Math.abs(phi(1.959964) - 0.975) < 1e-6); assert.ok(near(phi(0), 0.5, 1e-7));
  assert.deepEqual(holm([0.02, 0.04]), [true, true]);
  assert.deepEqual(holm([0.03, 0.04]), [false, false]);
  assert.deepEqual(holm([0.2, 0.01]), [false, true]);
});

test('RESULT.md agrees with result.json', () => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.match(md.split('\n')[2], new RegExp(`^\\*\\*Verdict: ${j.verdict}, `));
  assert.equal(j.verdict, j.tests.some((t) => t.pass) ? 'PASS' : 'FAIL');
  for (const t of j.tests) {
    const T = j[t.test.toLowerCase()], d = T.decisive.x1, r = T.replication.x1, p = j.placebo[t.test.toLowerCase()];
    assert.ok(md.includes(`| ${d.months} | ${d.mean} | ${d.tNW} |`)); assert.ok(md.includes(`| ${r.months} | ${r.mean} | ${r.tNW} |`));
    assert.equal(t.checks.decPositive, d.mean > 0); assert.equal(t.checks.repPositive, r.mean > 0); assert.equal(t.checks.tNW, d.tNW >= 2);
    assert.equal(t.checks.placebo, p.real > p.p95); assert.equal(p.draws, 40);
    assert.equal(t.pass, Object.values(t.checks).every(Boolean));
    assert.ok(md.includes(`| ${p.real} | ${p.median} | ${p.p5} | ${p.p95} |`));
  }
  for (const t of ['t1', 't2']) assert.ok(md.includes(`| ${t.toUpperCase()} | decisive | ${j.variant[t].decisive.months} | ${j.variant[t].decisive.mean} |`));
  assert.equal(j.windows.decisive.from, '2016-01');
  assert.ok(md.includes('index-long-reversal') && md.includes('vol-managed-index'));
  assert.ok(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8').includes('Pass bar'));
});

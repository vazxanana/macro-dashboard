// Engulf ladder study (research/edge/engulf-ladder): engulf zones, the ladder's nesting, no look-ahead, and the report against
// result.json. Offline: hand-made and seeded candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { engulfZones, buildTF, ladder, simulateOrder, nyPlace, rng, holm, monthT, P } from '../research/edge/engulf-ladder/run.mjs';

const H = 3600;
const C = (o, h, l, c, i = 0) => ({ t: i * H, end: (i + 1) * H, open: o, high: h, low: l, close: c });

test('a buy zone completes on a body close above the base high within 1-3 candles, not on a wick', () => {
  const base = C(105, 106, 100, 101, 0);
  const one = engulfZones([base, C(101, 107, 101, 106.5, 1), C(106, 108, 105, 107, 2)], 1);
  assert.equal(one.length, 1); assert.equal(one[0].born, 1); assert.deepEqual([one[0].low, one[0].high], [100, 106]);
  const three = engulfZones([base, C(101, 104, 101, 103, 1), C(103, 105, 102, 104, 2), C(104, 107, 103, 106.2, 3)], 1);
  assert.equal(three.length, 1); assert.equal(three[0].born, 3, 'third candle after the base');
  const four = engulfZones([base, C(101, 104, 101, 103, 1), C(103, 105, 102, 104, 2), C(104, 105.9, 103, 105, 3), C(105, 108, 104, 107, 4)], 1);
  assert.equal(four.filter((z) => z.base === 0).length, 0, 'a fourth candle is too late');
  const wick = engulfZones([base, C(101, 109, 101, 105, 1), C(105, 105.5, 104, 105, 2), C(105, 105.8, 104, 105.5, 3)], 1);
  assert.equal(wick.filter((z) => z.base === 0).length, 0, 'a wick above the high is not a body close');
  const far = engulfZones([base, C(101, 102, 98, 99, 1), C(99, 108, 99, 107, 2)], 1);
  assert.equal(far.filter((z) => z.base === 0).length, 0, 'a close below the low first kills it');
  const green = engulfZones([C(100, 106, 99, 105, 0), C(105, 108, 104, 107, 1)], 1);
  assert.equal(green.length, 0, 'a buy zone needs a red base');
});

test('a zone dies only on a close beyond its far side; sells mirror it', () => {
  const c = [C(105, 106, 100, 101, 0), C(101, 107, 101, 106.5, 1), C(106, 106, 99, 100.5, 2), C(100, 101, 98, 99.5, 3)];
  const z = engulfZones(c, 1)[0];
  assert.equal(z.dead, 3, 'the wick to 99 at candle 2 closes at 100.5: alive; candle 3 closes 99.5: dead'); assert.equal(z.deadEnd, 4 * H);
  const s = engulfZones([C(100, 105, 99, 104, 0), C(104, 104, 97, 98, 1), C(98, 106, 98, 105.5, 2)], -1)[0];
  assert.deepEqual([s.born, s.low, s.high, s.dead], [1, 99, 105, 2]);
});

// seeded hourly random walk over real trading hours (weekend hours of New York are skipped by the builders)
function walk(seed, n) {
  const r = rng(seed), out = []; let t = Date.UTC(2024, 0, 1) / 1000, px = 2000;
  while (out.length < n) {
    t += H; if (!nyPlace(t)) continue;
    const o = px, c = o + (r() - 0.5) * 8, h = Math.max(o, c) + r() * 3, l = Math.min(o, c) - r() * 3; px = c;
    out.push({ time: t, open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2), close: +c.toFixed(2) });
  }
  return out;
}

test('every signal nests: H4 base low inside the Daily zone, H1 base low inside the H4 zone, stop past the H4 zone', () => {
  const h1 = walk(7, 6000), ds = buildTF(h1, 'd'), h4 = buildTF(h1, 'h4');
  let n = 0;
  for (const side of [1, -1]) for (const s of ladder(h1, ds, h4, side).sigs) {
    n++;
    const [dL, dH, dBorn] = s.D, [fL, fH, fBorn] = s.F, [gL, gH, gBorn] = s.G;
    assert.ok(dBorn <= s.touchT && s.touchT < fBorn && fBorn < gBorn && gBorn === s.t, 'Daily -> touch -> H4 -> H1 in time');
    assert.ok(side > 0 ? fL >= dL && fL <= dH : fH >= dL && fH <= dH, 'H4 base extreme inside the Daily zone');
    assert.ok(side > 0 ? gL >= fL && gL <= fH : gH >= fL && gH <= fH, 'H1 base extreme inside the H4 zone');
    assert.equal(+s.stop.toFixed(6), +(side > 0 ? fL - P.buf : fH + P.buf).toFixed(6), 'stop $0.30 past the H4 zone, not the H1');
    assert.equal(s.mid, (gL + gH) / 2); assert.equal(s.edge, side > 0 ? gH : gL);
    assert.ok(side * (s.mid - s.stop) > 0, 'every order has a stop on its losing side');
  }
  assert.ok(n > 5, `the walk gives signals (${n})`);
});

test('no look-ahead: signals up to a day boundary are the same with the later candles removed', () => {
  const h1 = walk(11, 7000), ds = buildTF(h1, 'd'), cut = ds[Math.floor(ds.length * 0.6)].i1, part = h1.slice(0, cut + 1).map((b) => ({ ...b }));
  const end = h1[cut].time + H, key = (s) => JSON.stringify({ ...s, fDead: undefined });
  for (const side of [1, -1]) {
    const a = ladder(h1, ds, buildTF(h1, 'h4'), side).sigs.filter((s) => s.t <= end).map(key);
    const b = ladder(part, buildTF(part, 'd'), buildTF(part, 'h4'), side).sigs.filter((s) => s.t <= end).map(key);
    assert.ok(a.length > 0); assert.deepEqual(b, a);
  }
});

test('the order fills only after the signal candle and takes the stop first', () => {
  const t0 = Date.UTC(2024, 0, 2, 15) / 1000;
  const h1 = [0, 1, 2, 3].map((i) => ({ time: t0 + i * H }));
  Object.assign(h1[0], { open: 110, high: 111, low: 99, close: 110 });   // the signal candle itself reaches the limit: ignored
  Object.assign(h1[1], { open: 110, high: 110, low: 104, close: 106 });  // fills at 105
  Object.assign(h1[2], { open: 106, high: 125, low: 99, close: 120 });   // stop and target in one candle: stop
  Object.assign(h1[3], { open: 120, high: 130, low: 119, close: 125 });
  const ds = buildTF(h1, 'd'), sg = { side: 1, k: 0, t: t0 + H, stop: 100, fDead: Infinity, er: 0.2 };
  const r = simulateOrder(h1, ds, sg, 105);
  assert.equal(r.status, 'filled'); assert.equal(r.fillT, h1[1].time); assert.equal(r.how, 'stop'); assert.equal(r.R, -1);
  assert.ok(r.net < -1, 'costs and financing are charged');
  assert.equal(simulateOrder(h1, ds, { ...sg, stop: 104.5 }, 105).status, 'small', 'risk under $1.00 is not placed');
});

test('helpers: Holm and month sums', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
  const T = [{ fillT: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { fillT: Date.UTC(2020, 2, 5) / 1000, net: 2 }];
  assert.equal(monthT(T, '2020-01', '2020-03').months, 3); assert.equal(monthT(T, '2020-01', '2020-03').perMonth, 1);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/engulf-ladder/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/engulf-ladder/RESULT.md', import.meta.url), 'utf8');
  const f = (v) => (v > 0 ? '+' : '') + v;
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /^# .*\n\n\*\*Verdict: FAIL\.\*\*/);
  assert.ok(md.includes(`**${r.T1.all.avg}R a trade after costs (n ${r.T1.all.n}, t ${r.T1.all.t})**`));
  assert.ok(md.includes(`| 2020-23 | ${r.T1.h1.n} | ${r.T1.h1.avg} | ${r.T1.h1.wr} | ${r.T1.h1.pf} |`));
  assert.ok(md.includes(`| 2024-on | ${r.T1.h2.n} | ${r.T1.h2.avg} | ${r.T1.h2.wr} | ${r.T1.h2.pf} |`));
  assert.ok(md.includes(`t ${r.T1.month.t} over ${r.T1.month.months} months`));
  assert.ok(md.includes(`beats **${r.T1.placebo.below} of ${r.T1.placebo.means.length}** placebo means`));
  assert.ok(md.includes(`difference ${f(r.T2.diff)}R, Welch t ${r.T2.t}`));
  assert.ok(md.includes(`difference ${f(r.T3.diff)}R, Welch t ${r.T3.t}`));
  assert.ok(md.includes(`${r.orders.signals} signals`) && md.includes(`${r.orders.filled} filled`));
  assert.equal(r.T1.pass || r.T2.pass || r.T3.pass, false);
  assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-engulf-ladder.md', import.meta.url)), 'no proposal after a FAIL');
});

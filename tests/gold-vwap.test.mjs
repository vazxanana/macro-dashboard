// gold-vwap study: VWAP / sd on hand-made candles, no look-ahead, the three rules, the trade simulator, and the report
// against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bands, sigFade, sigPullback, sim, mirror, daySpan, dayOk, nyT, holm, P } from '../research/edge/gold-vwap/run.mjs';

const DIR = new URL('../research/edge/gold-vwap/', import.meta.url);
const D = '2024-03-13';   // a Wednesday, New York on daylight time (UTC-4)
const sp = daySpan(D);

// a day of flat candles at 2000 from the anchor, then whatever the test puts after `at`
function mkDay(extra = [], { px = 2000, until = '03:00' } = {}) {
  const c = []; let t = sp.a;
  const stopAt = nyT(D, until);
  let k = 0;
  for (; t + 300 <= stopAt; t += 300, k++) { const w = (k % 2 ? 3 : -3); c.push([t, px + w, px + w + 1, px + w - 1, px + w, 10]); }
  for (const [o, h, l, cl, v = 10] of extra) { c.push([t, o, h, l, cl, v]); t += 300; }
  return { D, ...sp, c };
}

test('VWAP and sd: hand-computed values, zero volume has no weight', () => {
  const c = [[0, 0, 12, 6, 9, 1], [300, 0, 21, 15, 18, 2], [600, 0, 99, 0, 50, 0]];
  const b = bands(c);
  assert.equal(b.vw[0], 9);
  assert.ok(Math.abs(b.vw[1] - 15) < 1e-12);                                // (9·1 + 18·2) / 3
  assert.ok(Math.abs(b.sd[1] - Math.sqrt((36 + 9 * 2) / 3)) < 1e-12);         // Σ v (p − 15)² / Σ v
  assert.equal(b.vw[2], b.vw[1]);
  assert.equal(bands([[0, 0, 1, 1, 1, 0]]).vw[0], null);
});

test('no look-ahead: bands through candle j ignore every later candle', () => {
  const day = mkDay([[2000, 2010, 1999, 2009], [2009, 2009, 1990, 1991]]);
  const b1 = bands(day.c), j = day.c.length - 3;
  const cut = bands(day.c.slice(0, j + 1));
  assert.equal(b1.vw[j], cut.vw[j]); assert.equal(b1.sd[j], cut.sd[j]);
  const alt = day.c.map((r, i) => (i > j ? [r[0], 5000, 6000, 4000, 5500, 999] : r));
  assert.equal(bands(alt).vw[j], b1.vw[j]);
});

test('calendar: weekday spans 18:00 NY → 16:00 NY, Christmas and weekends skipped', () => {
  assert.equal(sp.z - sp.a, 22 * 3600);
  assert.equal(new Date(sp.a * 1000).toISOString(), '2024-03-12T22:00:00.000Z');
  assert.equal(dayOk(D), true);
  assert.equal(dayOk('2024-12-25'), false);
  assert.equal(dayOk('2024-03-16'), false);
});

test('T1 fade: sell a close above +2 sd at the next open, stop 3 sd, target VWAP; T2 follows it', () => {
  const day = mkDay([[2000, 2012, 2000, 2012], [2008, 2008, 1998, 1999], [1999, 1999, 1990, 1992]]);
  const b = bands(day.c), j = day.c.length - 3;
  assert.ok(day.c[j][4] > b.vw[j] + 2 * b.sd[j]);
  const s = sigFade(day, b, false);
  assert.equal(s.j, j); assert.equal(s.k, j + 1); assert.equal(s.side, -1); assert.equal(s.entry, 2008);
  assert.ok(Math.abs(s.stop - (b.vw[j] + 3 * b.sd[j])) < 1e-12); assert.equal(s.target, b.vw[j]);
  const x = sim(day, s, 1);
  assert.equal(x.how, 'target'); assert.equal(x.exit, s.target);
  assert.ok(Math.abs(x.cost - 0.45) < 1e-12);                                // spread + market entry slippage, limit target free
  const f = sigFade(day, b, true);
  assert.equal(f.side, 1); assert.ok(Math.abs(f.stop - (b.vw[j] + b.sd[j])) < 1e-12); assert.equal(f.target, null);
  const y = sim(day, f, 1); assert.equal(y.how, 'stop'); assert.ok(Math.abs(y.gross + 1) < 1e-12);
  assert.ok(Math.abs(y.cost - 0.60) < 1e-12);
  assert.ok(Math.abs(sim(day, f, 2).cost - 1.20) < 1e-12);
});

test('signals only between 03:00 and 15:00 New York', () => {
  const early = mkDay([[2000, 2030, 2000, 2030], [2030, 2030, 2029, 2029]], { until: '02:00' });
  const b = bands(early.c), j = early.c.length - 2;
  assert.ok(early.c[j][4] > b.vw[j] + 2 * b.sd[j]);
  assert.equal(sigFade(early, b, false), null);
});

test('T3: first VWAP touch after a 1.5 sd excursion buys at the last closed VWAP with stop 1 sd, target 1.5 sd', () => {
  const day = mkDay([[2000, 2012, 2000, 2012], [2012, 2013, 2008, 2010], [2010, 2010, 1999, 2001], [2001, 2030, 2001, 2025]]);
  const b = bands(day.c), j0 = day.c.length - 4;
  const s = sigPullback(day, b);
  assert.equal(s.j, j0); assert.equal(s.side, 1); assert.equal(s.kind, 'lim');
  const k = s.k, L = b.vw[k - 1];
  assert.ok(day.c[k][3] <= L);
  assert.equal(s.entry, Math.min(day.c[k][1], L));
  assert.ok(Math.abs(s.stop - (L - b.sd[k - 1])) < 1e-12); assert.ok(Math.abs(s.target - (L + 1.5 * b.sd[k - 1])) < 1e-12);
  const x = sim(day, s, 1);
  assert.ok(['target', 'stop', 'time'].includes(x.how));
  if (x.how === 'target') assert.ok(Math.abs(x.cost - 0.30) < 1e-12);       // limit in, limit out: spread only
});

test('stop first when one candle holds both, gap at the open, mirror keeps distances', () => {
  const day = mkDay([[2000, 2000, 2000, 2000], [2000, 2010, 1990, 2000], [1980, 1981, 1979, 1980]]);
  const k = day.c.length - 2;
  const s = { k, side: 1, entry: 2000, stop: 1995, target: 2005, kind: 'mkt' };
  assert.equal(sim(day, s).how, 'stop');
  const s2 = { k: k + 1, side: -1, entry: 1970, stop: 1975, target: 1960, kind: 'lim' };
  assert.equal(sim(day, { ...s2, k: day.c.length - 1, entry: 1990, stop: 1985, side: 1, target: 2000, kind: 'mkt' }).how, 'gap');
  const m = mirror(s); assert.equal(m.side, -1); assert.equal(m.stop, 2005); assert.equal(m.target, 1995);
});

test('holm', () => {
  const h = holm([0.01, 0.04, 0.03]);
  assert.deepEqual(h.map((x) => Math.round(x * 1000) / 1000), [0.03, 0.06, 0.06]);
});

test('report matches result.json; the headline carries the verdict and stays short', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.study, 'gold-vwap'); assert.ok(['PASS', 'FAIL'].includes(r.verdict));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.includes(r.verdict)); assert.ok(line.length < 260);
  assert.equal(r.verdict === 'PASS', r.tests.T1.pass);
  for (const k of ['T1', 'T2', 'T3']) {
    const t = r.tests[k];
    assert.ok(md.includes(`| ${t.oos.n} |`)); assert.ok(md.includes(`| ${t.is.n} |`));
    assert.equal(t.pass, Object.values(t.checks).every(Boolean));
    assert.equal(t.placebo.seeds, 40);
  }
  assert.equal(r.params.SPREAD, 0.30); assert.equal(r.params.SLIP, 0.15);
  assert.ok(r.params.FROM >= '2016-01-01');
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('item 44'));
});

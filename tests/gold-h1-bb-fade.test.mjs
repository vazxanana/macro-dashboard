// gold-h1-bb-fade: the rule on hand-made candles, no look-ahead, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { P, prepare, signals, spec, sim, stream, m5Index, holm, monthT } from '../research/edge/gold-h1-bb-fade/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-h1-bb-fade');
const H = 3600, T0 = Date.UTC(2020, 0, 6, 8) / 1000; // a Monday 08:00 UTC

// a quiet sawtooth around 2000 (low ADX), then a spike candle that closes far above the band
function quietRows(n = 260, spikeAt = 240) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const c = 2000 + (i % 2 ? 0.5 : -0.5);
    rows.push([T0 + i * H, c, c + 0.6, c - 0.6, c]);
  }
  const s = rows[spikeAt]; rows[spikeAt] = [s[0], 2000, 2004.2, 1999.8, 2004]; // close way above the band
  const x = rows[spikeAt + 1]; rows[spikeAt + 1] = [x[0], 2003.8, 2004, 2001, 2001.5]; // the next candle opens near that close
  return rows;
}

test('indicators: Bollinger is population sd, ADX is low in a sawtooth and high in a trend', () => {
  const C = prepare(quietRows());
  const i = 100, closes = C.slice(i - 19, i + 1).map((x) => x.c), m = closes.reduce((a, x) => a + x, 0) / 20;
  const sd = Math.sqrt(closes.reduce((a, x) => a + (x - m) ** 2, 0) / 20);
  assert.ok(Math.abs(C[i].mid - m) < 1e-9 && Math.abs(C[i].up - (m + 2 * sd)) < 1e-9);
  assert.ok(C[200].adx < 15, `sawtooth ADX ${C[200].adx}`);
  const trend = Array.from({ length: 100 }, (_, i) => [T0 + i * H, 2000 + i, 2000 + i + 1.2, 2000 + i - 0.2, 2000 + i + 1]);
  assert.ok(prepare(trend)[90].adx > 50);
});

test('signal: a quiet close above the upper band is a sell; ADX cut and hours filter apply', () => {
  const C = prepare(quietRows());
  const S = signals(C, 20);
  assert.equal(S.length, 1); assert.equal(S[0].i, 240); assert.equal(S[0].side, -1);
  assert.equal(signals(C, 0).length, 0);
  assert.equal(signals(C, 20, [22, 23, 0, 1]).length, 0); // 240 h after Monday 08:00 is 08:00 UTC
});

test('no look-ahead: indicators and the signal at i do not move when later candles change', () => {
  const rows = quietRows(), A = prepare(rows);
  const rows2 = rows.map((r, k) => (k > 240 ? [r[0], r[1] * 1.3, r[2] * 1.3 + 5, r[3] * 1.3 - 5, r[4] * 1.3] : r)), B = prepare(rows2);
  for (const k of ['mid', 'up', 'dn', 'atr', 'adx']) assert.equal(A[240][k], B[240][k]);
  assert.deepEqual(signals(A, 20).filter((s) => s.i <= 240), signals(B, 20).filter((s) => s.i <= 240));
});

test('levels: stop = extreme + 0.5 ATR, target = the middle band at the signal close, entry at the next open', () => {
  const C = prepare(quietRows()), s = signals(C, 20)[0], sp = spec(C, s), b = C[240];
  assert.equal(sp.E, C[241].o); assert.equal(sp.side, -1);
  assert.ok(Math.abs(sp.stop - (b.h + 0.5 * b.atr)) < 1e-9);
  assert.ok(Math.abs(sp.target - b.mid) < 1e-9);
  // mirrored placebo: same distances, other side
  const pb = spec(C, s, 1); assert.ok(Math.abs(pb.stop - (sp.E - sp.r0)) < 1e-9 && Math.abs(pb.target - (2 * sp.E - sp.target)) < 1e-9);
  // a target under 0.5R is skipped
  const C2 = prepare(quietRows()); C2[240].mid = C2[241].o - 0.1; assert.equal(spec(C2, s).skip, 'target near');
});

// hand-built candles for exits (fields set directly)
function mk(n, base = 2000) { return Array.from({ length: n }, (_, i) => ({ t: T0 + i * H, o: base, h: base + 1, l: base - 1, c: base, mid: base, up: base + 5, dn: base - 5, atr: 2, adx: 10 })); }

test('exits: target on M5, stop first when one M5 candle holds both, gap at an M5 open, time exit at the 12th candle', () => {
  // buy signal at 0: low 1990, atr 2 -> stop 1989; entry 1992 at candle 1, target = mid 2000 (8 away, r0 3)
  const C = mk(30); C[0] = { ...C[0], l: 1990, c: 1991, mid: 2000 }; C[1] = { ...C[1], o: 1992, h: 1993, l: 1991, c: 1992 };
  const s = { i: 0, t: C[0].t, side: 1 };
  for (let j = 1; j < 30; j++) C[j] = { ...C[j], o: 1992, h: 1993, l: 1991, c: 1992 };
  // time exit: nothing hit in 12 candles (1..12) -> close of candle 12
  let r = sim(C, s, [], new Map()); assert.equal(r.why, 'time'); assert.equal(r.xi, 12); assert.equal(r.px, 1992);
  // M5 in hour 3: one M5 holding both stop and target -> stop
  const m5a = [[C[3].t, 1992, 2001, 1988, 1995]]; r = sim(C, s, m5a, m5Index(m5a)); assert.equal(r.why, 'stop'); assert.equal(r.px, 1989);
  // M5 target first, then stop in a later M5 of the same hour -> target
  const m5b = [[C[3].t, 1992, 2000.5, 1991, 2000], [C[3].t + 300, 2000, 2000, 1985, 1986]]; r = sim(C, s, m5b, m5Index(m5b)); assert.equal(r.why, 'target'); assert.equal(r.px, 2000);
  // M5 opening below the stop -> fills at that open
  const m5c = [[C[3].t, 1987, 1988, 1986, 1987]]; r = sim(C, s, m5c, m5Index(m5c)); assert.equal(r.why, 'stop'); assert.equal(r.px, 1987);
  assert.ok(r.gross < -1);
  // costs: $0.60 / r0, plus financing for a buy across 22:00 UTC (entry 09:00, time exit 21:00 -> no night)
  r = sim(C, s, [], new Map()); assert.equal(r.nights, 0); assert.ok(Math.abs(r.cost - 0.6 / 3) < 1e-12);
  const r2 = sim(C, s, [], new Map(), 2); assert.ok(Math.abs(r2.cost - 1.2 / 3) < 1e-12);
});

test('financing: a buy held over 22:00 UTC pays FIN.xau.long x nights x E / r0; a sell pays nothing', () => {
  const C = mk(30); for (let j = 0; j < 30; j++) C[j].t = Date.UTC(2020, 0, 6, 15) / 1000 + j * H; // Monday 15:00
  C[0] = { ...C[0], l: 1990, mid: 2000 }; for (let j = 1; j < 30; j++) C[j] = { ...C[j], o: 1992, h: 1993, l: 1991, c: 1992 };
  const r = sim(C, { i: 0, t: C[0].t, side: 1 }, [], new Map());
  assert.equal(r.nights, 1); assert.ok(Math.abs(r.cost - (0.6 / 3 + P.FIN * 1992 / 3)) < 1e-12);
  const D = mk(30); for (let j = 0; j < 30; j++) D[j].t = C[j].t;
  D[0] = { ...D[0], h: 2010, mid: 2000 }; for (let j = 1; j < 30; j++) D[j] = { ...D[j], o: 2008, h: 2009, l: 2007, c: 2008 };
  const q = sim(D, { i: 0, t: D[0].t, side: -1 }, [], new Map()); assert.equal(q.nights, 0); assert.ok(Math.abs(q.cost - 0.6 / q.r0) < 1e-12);
});

test('one position at a time; a closure exits at the first open after it', () => {
  const C = mk(40); C[0] = { ...C[0], l: 1990, mid: 2000 };
  for (let j = 1; j < 40; j++) C[j] = { ...C[j], o: 1992, h: 1993, l: 1991, c: 1992, l0: 0 };
  const sigs = [{ i: 0, t: C[0].t, side: 1 }, { i: 5, t: C[5].t, side: 1 }, { i: 13, t: C[13].t, side: 1 }];
  for (const k of [5, 13]) C[k] = { ...C[k], l: 1990, mid: 2000 };
  const st = stream(C, sigs, [], new Map()); assert.equal(st.funnel.busy, 1); assert.equal(st.trades.length, 2);
  const G = mk(20); G[0] = { ...G[0], l: 1990, mid: 2000 }; for (let j = 1; j < 20; j++) G[j] = { ...G[j], o: 1992, h: 1993, l: 1991, c: 1992 };
  for (let j = 4; j < 20; j++) G[j].t += 50 * H; G[4].o = 1995;
  const g = sim(G, { i: 0, t: G[0].t, side: 1 }, [], new Map()); assert.equal(g.why, 'gap'); assert.equal(g.px, 1995); assert.equal(g.xi, 4);
});

test('statistics helpers', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((x) => +x.toFixed(3)), [0.03, 0.08, 0.5]);
  const tr = [{ te: T0, net: 1 }, { te: T0 + 40 * 86400, net: 2 }, { te: T0 + 80 * 86400, net: 3 }];
  assert.equal(monthT(tr).months, 3);
});

test('report and result.json agree; verdict line and headline', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.ok(md.includes(res.headline)); assert.ok(res.headline.length < 220);
  assert.match(res.headline, /^\*\*Verdict: (PASS|FAIL), \d of 3 pass/);
  assert.equal(res.verdict, res.passed.length ? 'PASS' : 'FAIL');
  for (const [k, x] of Object.entries(res.tests)) {
    assert.equal(x.pass, Object.values(x.checks).every(Boolean));
    assert.equal(x.checks.n, x.oos.n >= 200); assert.equal(x.checks.isSame, x.is.net > 0); assert.equal(x.checks.costs2, x.oos.net2 > 0);
    assert.equal(x.checks.placebo, x.placebo.beats >= 38); assert.equal(x.placebo.seeds, 40);
    const sign = (v) => (v < 0 ? '−' : '+');
    assert.ok(md.includes(`| ${k} ${x.name} | OOS 2017-26 | ${x.oos.n} | `), k);
    assert.ok(md.includes(`${sign(x.oos.net)}${Math.abs(x.oos.net).toFixed(3)}`));
    assert.equal(x.trades.length, x.is.n + x.oos.n + x.trades.filter((t) => new Date(t[0] * 1000).toISOString() >= '2026-11-01').length);
  }
  assert.ok(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8').includes('Written and pushed alone'));
});

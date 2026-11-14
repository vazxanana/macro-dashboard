// gold-h1-vortex: the rule on hand-made candles, no look-ahead, the drift baseline, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { P, prepare, signals, sim, stream, baseline, excessOf, holm, monthT } from '../research/edge/gold-h1-vortex/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-h1-vortex');
const H = 3600, T0 = Date.UTC(2020, 0, 6, 8) / 1000; // a Monday 08:00 UTC

// 240 falling candles, then 60 rising: one Vortex(14) turn up in between
function vRows(down = 240, up = 60) {
  const rows = []; let c = 2000;
  for (let i = 0; i < down + up; i++) {
    const d = i < down ? -0.5 : 1;
    const o = c; c += d;
    rows.push([T0 + i * H, o, Math.max(o, c) + 0.3, Math.min(o, c) - 0.3, c]);
  }
  return rows;
}

test('Vortex: VI+ and VI- are the 14-candle sums of |high - prior low| and |low - prior high| over the true range', () => {
  const rows = vRows(), C = prepare(rows), i = 100;
  let sp = 0, sm = 0, st = 0;
  for (let k = i - 13; k <= i; k++) {
    const [, , h, l, ] = rows[k], [, , ph, pl, pc] = rows[k - 1];
    sp += Math.abs(h - pl); sm += Math.abs(l - ph); st += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  assert.ok(Math.abs(C[i].vi[14][0] - sp / st) < 1e-12 && Math.abs(C[i].vi[14][1] - sm / st) < 1e-12);
  assert.ok(C[200].vi[14][1] > C[200].vi[14][0], 'falling: VI- above VI+');
});

test('signal: one turn up after the fall is a buy; sells-only filter and side', () => {
  const C = prepare(vRows()), S = signals(C, 14);
  assert.equal(S.length, 1); assert.equal(S[0].side, 1); assert.ok(S[0].i >= 240 && S[0].i < 250);
  assert.equal(signals(C, 14, 1).length, 1); assert.equal(signals(C, 14, -1).length, 0);
});

test('no look-ahead: indicators and signals up to i do not move when later candles change', () => {
  const rows = vRows(), A = prepare(rows), cut = 245;
  const rows2 = rows.map((r, k) => (k > cut ? [r[0], r[1] * 1.3, r[2] * 1.3 + 9, r[3] * 1.3 - 9, r[4] * 1.3] : r)), B = prepare(rows2);
  for (let k = 0; k <= cut; k++) { assert.equal(A[k].atr, B[k].atr); assert.deepEqual(A[k].vi, B[k].vi); }
  assert.deepEqual(signals(A, 14).filter((s) => s.i < cut), signals(B, 14).filter((s) => s.i < cut));
});

// hand-built candles for exits (fields set directly)
function mk(n, base = 2000, t0 = T0) { return Array.from({ length: n }, (_, i) => ({ t: t0 + i * H, o: base, h: base + 1, l: base - 1, c: base, atr: 2, vi: {} })); }

test('exits: stop 1.5 ATR from the next open, gap open past the stop, time exit at the close of the 24th candle', () => {
  const C = mk(40); C[1].o = 2000; // entry 2000, r0 3, stop 1997
  let r = sim(C, 0, 1); assert.equal(r.why, 'time'); assert.equal(r.xi, 24); assert.equal(r.E, 2000); assert.equal(r.r0, 3);
  const D = mk(40); D[5] = { ...D[5], l: 1996 }; r = sim(D, 0, 1); assert.equal(r.why, 'stop'); assert.equal(r.px, 1997); assert.equal(r.gross, -1);
  const G = mk(40); G[5] = { ...G[5], o: 1995, l: 1994 }; r = sim(G, 0, 1); assert.equal(r.px, 1995); assert.ok(r.gross < -1);
  const S = mk(40); S[7] = { ...S[7], h: 2003.5 }; r = sim(S, 0, -1); assert.equal(r.why, 'stop'); assert.equal(r.px, 2003);
  const Z = mk(40); for (let j = 6; j < 40; j++) Z[j].t += 50 * H; Z[6].o = 2001; r = sim(Z, 0, 1); assert.equal(r.why, 'gap'); assert.equal(r.px, 2001);
});

test('costs: $0.60 / r0, buys pay FIN.xau.long per night, sells nothing, 2x doubles', () => {
  const C = mk(40, 2000, Date.UTC(2020, 0, 6, 15) / 1000); // Monday 15:00: a 24 h hold crosses one 22:00 rollover
  const b = sim(C, 0, 1), s = sim(C, 0, -1), b2 = sim(C, 0, 1, 2);
  assert.equal(b.nights, 1); assert.ok(Math.abs(b.cost - (0.6 / 3 + P.FIN * 2000 / 3)) < 1e-12);
  assert.equal(s.nights, 0); assert.ok(Math.abs(s.cost - 0.2) < 1e-12); assert.ok(Math.abs(b2.cost - 2 * b.cost) < 1e-12);
});

test('one position at a time: a cross on or before the exit candle is skipped', () => {
  const C = mk(80), sigs = [{ i: 0, side: 1 }, { i: 10, side: -1 }, { i: 24, side: 1 }, { i: 30, side: -1 }];
  const st = stream(C, sigs); assert.equal(st.funnel.busy, 2); assert.equal(st.trades.length, 2); assert.equal(st.trades[1].i, 30);
});

test('drift baseline: every eligible hour of the month, by side; excess = net - that mean', () => {
  const C = mk(400); for (let j = 0; j < 400; j++) { C[j].o = 2000 + j * 0.1; C[j].c = C[j].o + 0.1; C[j].h = C[j].c + 0.5; C[j].l = C[j].o - 0.5; }
  const base = baseline(C, ['2019-01-01', '2021-01-01']);
  const buy = base.get('1|2020-01'), sell = base.get('-1|2020-01');
  assert.ok(buy > 0 && sell < 0, `rising market: buys ${buy}, sells ${sell}`);
  const r = sim(C, 250, 1); assert.ok(Math.abs(excessOf(r, base) - (r.net - buy)) < 1e-12);
});

test('statistics helpers', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((x) => +x.toFixed(3)), [0.03, 0.08, 0.5]);
  const tr = [{ te: T0, net: 1 }, { te: T0 + 40 * 86400, net: 2 }, { te: T0 + 80 * 86400, net: 3 }];
  assert.equal(monthT(tr).months, 3);
});

test('report and result.json agree; verdict line and headline', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.ok(md.includes(res.headline)); assert.ok(res.headline.length < 220);
  assert.match(res.headline, /^\*\*Verdict: (PASS|PARTLY|FAIL), \d of 3 pass/);
  assert.equal(res.verdict, res.tests.T1.pass ? 'PASS' : res.passed.length ? 'PARTLY' : 'FAIL');
  for (const [k, x] of Object.entries(res.tests)) {
    assert.equal(x.pass, Object.values(x.checks).every(Boolean));
    assert.equal(x.checks.n, x.oos.n >= 200); assert.equal(x.checks.isSame, x.is.net > 0); assert.equal(x.checks.costs2, x.oos.net2 > 0);
    assert.equal(x.checks.excess, x.oos.excess > 0 && x.oos.tExcess >= 2);
    assert.equal(x.checks.placebo, x.placebo.beats >= 38); assert.equal(x.placebo.seeds, 40);
    const sign = (v) => (v < 0 ? '−' : '+');
    assert.ok(md.includes(`| ${k} ${x.name} | OOS 2017-26 | ${x.oos.n} | `), k);
    assert.ok(md.includes(`${sign(x.oos.net)}${Math.abs(x.oos.net).toFixed(3)}`));
    assert.equal(x.trades.length, x.is.n + x.oos.n + x.trades.filter((t) => new Date(t[0] * 1000).toISOString() >= '2026-11-01').length);
  }
  assert.ok(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8').includes('Written and pushed alone'));
});

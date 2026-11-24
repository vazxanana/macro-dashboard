// tests/ef-chain-h4-h1-m15.test.mjs - the chain of failed engulfs study (research/edge/ef-chain-h4-h1-m15): offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { chain, frames, tradesOf, oppTarget, atr14, cellName, resultMd, judge, newAcc, NCELL, P } from '../research/edge/ef-chain-h4-h1-m15/run.mjs';

const DIR = new URL('../research/edge/ef-chain-h4-h1-m15/', import.meta.url);
// a seeded 5-minute random walk with slow swings (no weekends), enough for H4 zones to form and fail
function seeded(seed, n = 70000, t0 = Date.UTC(2020, 0, 6) / 1000) {
  const r = K.rng(seed); const out = []; let px = 100, drift = 0;
  for (let i = 0; i < n; i++) { if (i % 600 === 0) drift = (r() - 0.5) * 0.02;
    const o = px, c = o + drift + (r() - 0.5) * 0.12, h = Math.max(o, c) + r() * 0.04, l = Math.min(o, c) - r() * 0.04; px = c;
    out.push({ t: t0 + i * 300, o, h, l, c, e: t0 + (i + 1) * 300 }); }
  return out;
}
const key = (g) => [g.v, g.d, g.at, g.stop.toFixed(8), g.hf, g.lvFail].join('|');

test('the chain finds signals on seeded candles, each with its stop on the losing side and in the pre-registered order', () => {
  const M5 = seeded(11), F = frames(M5), { signals, counts } = chain(F);
  assert.ok(signals.length >= 20, 'signals ' + signals.length);
  assert.ok(counts.levels >= counts.returns && counts.returns >= counts.h1fail[1] && counts.h1fail[1] >= counts.h1fail[0]);
  for (const g of signals) { const c = F['15m'][g.i];
    assert.equal(c.e, g.at); assert.ok(g.d * (c.c - g.stop) > 0, 'stop on the losing side of the completing close');
    assert.ok(g.d > 0 ? c.c > g.zt && g.stop < g.zb : c.c < g.zb && g.stop > g.zt, 'an engulf with the new side, stop past its zone');
    assert.ok(g.lvFail <= g.hf && g.hf <= c.t && g.at <= g.hf + P.trig * 900 && g.at < g.lvFail + P.serve, 'H4 fail, then H1 fail, then the M15 engulf'); }
  assert.ok(signals.some((g) => g.v === 0) && signals.some((g) => g.v === 1) && signals.some((g) => g.d > 0) && signals.some((g) => g.d < 0));
});

test('no look-ahead: signals known by a cut are the same when the candles end there, and later prices do not move them', () => {
  const M5 = seeded(23), full = chain(frames(M5)).signals; let checked = 0;
  for (const frac of [0.35, 0.5, 0.62, 0.8, 0.93]) { const T = M5[Math.floor(M5.length * frac)].e;
    const want = full.filter((g) => g.at <= T).map(key).sort(), got = chain(frames(M5.filter((b) => b.e <= T))).signals.filter((g) => g.at <= T).map(key).sort();
    assert.deepEqual(got, want); checked += want.length;
    const r = K.rng(5); const W = M5.map((b) => (b.e <= T ? b : { ...b, o: b.o * 3, h: b.h * 3 + r(), l: b.l * 3 - r(), c: b.c * 3 }));
    assert.deepEqual(chain(frames(W)).signals.filter((g) => g.at <= T).map(key).sort(), want); }
  assert.ok(checked > 30);
});

test('trades: fill at the next 5-minute open, stop on the losing side, the mirror, the opposite-zone target', () => {
  const M5 = seeded(11), F = frames(M5), { signals, zh4 } = chain(F); let n = 0, opp = 0;
  for (const g of signals) { const r = tradesOf(g, M5, zh4, 0.001); if (r.why) continue;
    const fi = M5.findIndex((b) => b.t >= g.at); assert.equal(r.fill, M5[fi].o); assert.ok(g.d * (r.fill - g.stop) > 0 && r.risk > 0);
    for (const o of r.out) { if (o.open) continue; n++; assert.ok(o.R >= -5 && o.R <= (o.x === 2 ? r.oppR : o.x + 1) + 1e-9); assert.ok(Number.isFinite(o.Rm));
      if (o.x === 2) { opp++; assert.ok(r.oppR >= 1); } } }
  assert.ok(n > 20);
  const Z = [{ dir: -1, at: 10, end: 100, top: 12, bot: 11 }, { dir: -1, at: 10, end: 100, top: 15, bot: 14 }, { dir: -1, at: 10, end: 20, top: 10.6, bot: 10.5 }, { dir: 1, at: 10, end: 100, top: 9, bot: 8 }];
  assert.equal(oppTarget(Z, 1, 50, 10), 11); assert.equal(oppTarget(Z, 1, 15, 10), 10.5); assert.equal(oppTarget(Z, 1, 50, 12.5), 14); assert.equal(oppTarget(Z, -1, 50, 10), 9); assert.equal(oppTarget(Z, 1, 5, 10), null);
  // a risk under the cost, and a fill past the stop, are no trades
  const g = signals[0]; assert.equal(tradesOf(g, M5, zh4, 1e9).why, 'small'); assert.equal(tradesOf({ ...g, stop: g.d > 0 ? 1e9 : -1e9 }, M5, zh4, 0).why, 'bad');
  assert.equal(atr14(M5, 5), null); assert.ok(atr14(M5, 20) > 0);
});

test('the bar is judged after costs: a cell with a before-cost gain and an after-cost loss does not pass', () => {
  const J = (S) => Object.fromEntries(Object.entries(S).map(([k, v]) => [k, Array.from(v)]));
  const A = newAcc(); for (let m = 0; m < 262; m++) for (let q = 0; q < 4; q++) { const w = m < 120 ? 0 : 1, R = q % 2 ? 0.3 : 0.1, cr = 0.3;
    A.ms[m] += R; A.msNet[m] += R - cr; A.n[w]++; A.sum[w] += R; A.net[w] += R - cr; A.cr[w] += cr; A.win[w]++; }
  const rows = judge([{ market: 'x', chain: J(A), mirror: J(newAcc()) }]);
  assert.equal(rows.length, NCELL); assert.ok(rows[0].disc.mean > 0 && rows[0].conf.t > 2 && rows[0].conf.net < 0); assert.equal(rows[0].pass, false);
});

test('RESULT.md equals result.json: the verdict line and every headline figure', () => {
  const o = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, resultMd(o));
  const line3 = md.split('\n')[2]; assert.equal(line3, `**Verdict: ${o.verdict}. ${o.headline}.**`);
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(o.verdict)); assert.equal(o.cells.length, 6); assert.deepEqual(o.cells.map((r) => r.cell), [0, 1, 2, 3, 4, 5].map(cellName));
  const best = o.cells.find((r) => r.cell === o.best), f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  assert.ok(line3.includes(`${f3(best.conf.net)}R a trade after costs`) && line3.includes(`month t ${best.conf.tNet.toFixed(2)}`) && line3.includes(`n ${Math.round(best.conf.n).toLocaleString('en-US')}`));
  assert.equal(o.passed.length, o.cells.filter((r) => r.pass).length); assert.equal(o.verdict === 'PASS', o.passed.length > 0);
  for (const r of o.cells) assert.equal(r.pass, r.disc.n >= 300 && r.conf.n >= 300 && r.disc.net > 0 && r.conf.net > 0 && r.disc.tNet >= 2 && r.conf.tNet >= 2 && r.holm < 0.05);
  assert.equal(o.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0); assert.ok(o.cut.reduce((a, x) => a + x.n, 0) > 100);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8'); assert.ok(pre.includes('n >= 300') && pre.includes('AFTER costs'));
});

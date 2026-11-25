// tests/nasbrk-desk.test.mjs - the NAS100 breakout desk (council/edge-desks-2.mjs nasbrkTrades): the rule of research/edge/nas100-brk-long-focus
// read on H1 candles built from the 5-minute ones, every record with its stop below the entry, no look-ahead, the page and loop wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D2 from '../council/edge-desks-2.mjs';
import { clean } from '../council/mosha-desk.mjs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { toArrays, prep, atr, sma } from '../research/edge/auto-researcher/engine.mjs';
import { RULE, trades } from '../research/edge/nas100-brk-long-focus/run.mjs';

const T0 = Date.UTC(2025, 2, 3) / 1000;
function market(seed = 11, days = 120, p0 = 15000) {
  let a = seed >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = []; let p = p0, drift = 0.4;
  for (let t = T0; t < T0 + days * 86400; t += 300) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    if (rnd() < 0.004) drift = (rnd() - 0.35) * 3;
    const o = p, c = o + drift + (rnd() - 0.5) * 14, h = Math.max(o, c) + rnd() * 5, l = Math.min(o, c) - rnd() * 5;
    out.push({ time: t, open: +o.toFixed(1), high: +h.toFixed(1), low: +l.toFixed(1), close: +c.toFixed(1) }); p = c; }
  return out;
}
const M = market(), B = { '5m': M }, FROM = T0 + 14 * 86400;
const R = D2.nasbrkTrades(B, { from: FROM, market: 'nas100' });

test('the rule is the study\'s, and the desk is registered', () => {
  assert.deepEqual(D2.NASBRK, { N: 20, ma: 200, hours: [14, 22], stop: 1, rr: 4, hold: 96 });
  assert.equal(RULE.trig[0].N, D2.NASBRK.N); assert.deepEqual(RULE.hours, D2.NASBRK.hours); assert.equal(RULE.stop, D2.NASBRK.stop); assert.equal(RULE.rr, D2.NASBRK.rr); assert.equal(RULE.hold, D2.NASBRK.hold); assert.equal(RULE.side, 'long');
  assert.deepEqual(D2.DESKS2.nasbrk.markets, ['nas100']); assert.equal(D2.nasbrkTrades(B, { from: FROM, market: 'xau' }).length, 0);
});

test('each record is a signal bar of the rule: close above the 20 highs and the 200-bar average, entry hour 14-21 UTC, stop 1 ATR, 4R', () => {
  assert.ok(R.length >= 3, 'the seeded market must give trades: ' + R.length);
  const H = K.resample(D2.toK(M), 3600).filter((b) => b.n >= 10), D = prep(toArrays(H.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c }))), 'nas100'), A = atr(D), MA = sma(D.c, 200);
  for (const r of R) {
    const j = H.findIndex((b) => b.t === Math.floor(r.t / 3600) * 3600), i = j - 1; assert.ok(i > 210);
    let hi = -Infinity; for (let k = i - 20; k < i; k++) hi = Math.max(hi, D.h[k]);
    assert.ok(D.c[i] > hi && D.c[i] > MA[i], 'signal: ' + r.id);
    const hr = new Date(r.t * 1000).getUTCHours(); assert.ok(hr >= 14 && hr < 22, 'entry hour ' + hr);
    assert.equal(r.side, 1); assert.ok(Math.abs(r.entry - H[j].o) < 1e-9); assert.ok(Math.abs((r.entry - r.stop) - A[i]) < 1e-6); assert.ok(Math.abs((r.target - r.entry) - 4 * A[i]) < 1e-6);
    assert.ok(r.stop < r.entry); assert.equal(r.market, 'nas100'); assert.match(r.id, /^nas100:nasbrk-b\d+$/); assert.equal(r.kind, 'nasbrk-h1');
    if (r.status === 'target') assert.ok(Math.abs(r.R - 4) < 1e-6); if (r.status === 'stopped') assert.ok(r.R <= -0.999);
    const c = clean(r); assert.ok(c, 'clean() refused ' + r.id); assert.equal(c.kind, 'nasbrk-h1'); }
});

test('one position at a time, and the first trades equal the study\'s own engine on the same hourly candles', () => {
  const sorted = [...R].sort((a, b) => a.t - b.t);
  for (let k = 1; k < sorted.length; k++) { const prev = sorted[k - 1]; assert.ok(prev.status === 'open' ? false : sorted[k].t >= Math.floor(prev.endT / 3600) * 3600 + 3600, 'overlap at ' + sorted[k].id); }
  const H = K.resample(D2.toK(M), 3600).filter((b) => b.n >= 10), D = prep(toArrays(H.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c }))), 'nas100'); D.costRel = 0; D.cost = 0;
  const E = trades(D, RULE, 211, D.n, 0), first = E.find((x) => D.t[x.i + 1] >= FROM);
  assert.ok(first, 'engine trade'); const mine = R.find((r) => r.t === D.t[first.i + 1]); assert.ok(mine, 'the desk has the engine\'s first trade');
});

test('no look-ahead: candles cut at a date give the same trades up to a day before it', () => {
  for (const cut of [T0 + 60 * 86400, T0 + 90 * 86400]) {
    const Bc = { '5m': M.filter((b) => b.time + 300 <= cut) }, key = (r) => [r.id, r.entry, r.stop, r.target].join('|');
    const a = new Set(R.filter((r) => r.t <= cut - 2 * 86400).map(key)), c = new Set(D2.nasbrkTrades(Bc, { from: FROM, market: 'nas100' }).filter((r) => r.t <= cut - 2 * 86400).map(key));
    assert.deepEqual([...c].sort(), [...a].sort(), 'differs at the cut ' + cut); }
});

test('wiring: the page, the Equinox tab, the loop, the data check and the record kinds', () => {
  const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  assert.match(rd('equinox.html'), /id="v-nasbrk"/); assert.match(rd('equinox.html'), /"k": "nasbrk", "name": "NAS100 breakout"/);
  assert.match(rd('assets/desk-trades.js'), /nasbrk: \{ file: 'nasbrk\/desk\.json'/); assert.match(rd('assets/desk-live.js'), /nasbrk: \{ passing: true, file: 'nasbrk\/desk\.json'/);
  assert.match(rd('.github/workflows/council.yml'), /--only [a-z,]*nasbrk/); assert.match(rd('council/datahealth.mjs'), /nasbrk\/desk\.json/);
  assert.equal(clean({ id: 'x', kind: 'nasbrk-h1', side: 1, entry: 100, stop: 99, t: 1 }) ? 'nasbrk-h1' : null, 'nasbrk-h1');
  assert.equal(clean({ id: 'x', kind: 'nasbrk-h1', side: 1, entry: 100, stop: 101, t: 1 }), null);
});

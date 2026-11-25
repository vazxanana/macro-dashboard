// tests/nq1-desk.test.mjs - the NQ1 desk (council/edge-desks-2.mjs nq1Trades): the auto-researcher's seven NAS100 leads as one desk,
// read with the engine's own signals; every record has its stop on the losing side, one position at a time per reading, no look-ahead, the wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D2 from '../council/edge-desks-2.mjs';
import { clean } from '../council/mosha-desk.mjs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { toArrays, prep, atr, sma } from '../research/edge/auto-researcher/engine.mjs';
import { RULE, trades } from '../research/edge/nas100-brk-long-focus/run.mjs';

const T0 = Date.UTC(2025, 2, 3) / 1000;
function market(seed = 11, days = 150, p0 = 15000) {
  let a = seed >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = []; let p = p0, drift = 0.4;
  for (let t = T0; t < T0 + days * 86400; t += 300) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    if (rnd() < 0.004) drift = (rnd() - 0.35) * 3;
    const o = p, c = o + drift + (rnd() - 0.5) * 14, h = Math.max(o, c) + rnd() * 5, l = Math.min(o, c) - rnd() * 5;
    out.push({ time: t, open: +o.toFixed(1), high: +h.toFixed(1), low: +l.toFixed(1), close: +c.toFixed(1) }); p = c; }
  return out;
}
const M = market(), B = { '5m': M }, FROM = T0 + 14 * 86400, ALL = D2.nq1Trades(B, { from: FROM, market: 'nas100' });
const of = (id) => ALL.filter((r) => r.kind === 'nq1-' + id);
const H = K.resample(D2.toK(M), 3600).filter((b) => b.n >= 10), D = prep(toArrays(H.map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c }))), 'nas100');

test('the desk is registered and holds the frozen leads of the research', () => {
  assert.deepEqual(D2.DESKS2.nq1.markets, ['nas100']); assert.equal(D2.nq1Trades(B, { from: FROM, market: 'xau' }).length, 0);
  assert.deepEqual(D2.NQ1_LEADS.map((l) => l.id), ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7']);
  const l3 = D2.NQ1_LEADS.find((l) => l.id === 'l3').g; assert.deepEqual(l3.trig, RULE.trig); assert.deepEqual(l3.hours, RULE.hours); assert.equal(l3.stop, RULE.stop); assert.equal(l3.rr, RULE.rr); assert.equal(l3.hold, RULE.hold); assert.equal(l3.trend, RULE.trend);
  for (const l of D2.NQ1_LEADS) { assert.ok(l.g.stop > 0 && l.g.hold > 0 && l.g.trig.length >= 1); assert.ok(['long', 'both'].includes(l.g.side)); }
});

test('every record: a stop on the losing side, an id once, stored by clean(), kinds of this desk only', () => {
  assert.ok(ALL.length > 10, 'the seeded market must give trades: ' + ALL.length); const ids = new Set();
  for (const r of ALL) { assert.match(r.kind, /^nq1-l[1-7]$/); assert.equal(r.market, 'nas100'); assert.ok(!ids.has(r.id), 'id twice ' + r.id); ids.add(r.id);
    assert.ok(r.side > 0 ? r.stop < r.entry : r.stop > r.entry, r.id + ': stop on the wrong side'); assert.ok(r.t >= FROM);
    if (r.R != null) assert.ok(Number.isFinite(r.R) && r.endT >= r.t, r.id); const c = clean(r); assert.ok(c, 'clean() refused ' + r.id); assert.equal(c.kind, r.kind); }
});

test('a lead reading is the engine\'s signals: filters, entry hour, stop in ATR, target in R, one position at a time', () => {
  const A = atr(D), MA = sma(D.c, 200); let seen = 0;
  for (const L of D2.NQ1_LEADS) { const g = L.g, rows = of(L.id).sort((a, b) => a.t - b.t); seen += rows.length;
    for (const r of rows) { const hr = new Date(r.t * 1000).getUTCHours(), dow = new Date(r.t * 1000).getUTCDay(), j = D.t.indexOf(Math.floor(r.t / 3600) * 3600), i = j - 1;
      assert.ok(j > 210, 'bar'); if (g.hours) { const [x, y] = g.hours; assert.ok(x <= y ? hr >= x && hr < y : hr >= x || hr < y, L.id + ' hour ' + hr); } if (g.dows) assert.ok(g.dows.includes(dow), L.id + ' dow');
      if (g.side === 'long') assert.equal(r.side, 1); if (g.trend === 'with') assert.ok(r.side > 0 ? D.c[i] > MA[i] : D.c[i] < MA[i], L.id + ' trend');
      assert.ok(Math.abs(Math.abs(r.entry - r.stop) - g.stop * A[i]) < 1e-6, L.id + ' stop'); if (g.rr > 0) assert.ok(Math.abs(Math.abs(r.target - r.entry) - g.rr * g.stop * A[i]) < 1e-6, L.id + ' target');
      assert.ok(Math.abs(r.entry - D.o[j]) < 1e-9, L.id + ' entry is the next open'); }
    for (let k = 1; k < rows.length; k++) assert.ok(rows[k - 1].status === 'open' ? false : rows[k].t >= Math.floor(rows[k - 1].endT / 3600) * 3600 + 3600, L.id + ' overlap'); }
  assert.ok(seen > 5, 'leads gave ' + seen);
});

test('the focused-study rule (l3) gives the study\'s own first trade; counts stay near the engine\'s', () => {
  const g = D2.NQ1_LEADS.find((l) => l.id === 'l3').g; D.costRel = 0; D.cost = 0;
  const E = trades(D, RULE, 211, D.n, 0), first = E.find((x) => D.t[x.i + 1] >= FROM); assert.ok(first); assert.ok(of('l3').some((r) => r.t === D.t[first.i + 1]), 'the first engine trade is on the desk');
});

test('no look-ahead: candles cut at a date give the same trades up to two days before it', () => {
  for (const cut of [T0 + 70 * 86400, T0 + 110 * 86400]) {
    const Bc = { '5m': M.filter((b) => b.time + 300 <= cut) }, key = (r) => [r.id, r.entry, r.stop, r.target].join('|');
    const a = new Set(ALL.filter((r) => r.t <= cut - 2 * 86400).map(key)), c = new Set(D2.nq1Trades(Bc, { from: FROM, market: 'nas100' }).filter((r) => r.t <= cut - 2 * 86400).map(key));
    assert.deepEqual([...c].sort(), [...a].sort(), 'differs at the cut ' + cut); }
});

test('wiring: the page, the Equinox tab, the loop, the data check and the record kinds', () => {
  const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  assert.match(rd('equinox.html'), /id="v-nq1"/); assert.match(rd('equinox.html'), /"k": "nq1", "name": "NQ1"/);
  assert.match(rd('assets/desk-trades.js'), /nq1: \{ file: 'nq1\/desk\.json'/); assert.match(rd('assets/desk-live.js'), /nq1: \{ passing: true, file: 'nq1\/desk\.json'/);
  assert.match(rd('.github/workflows/council.yml'), /--only [a-z,]*nq1/); assert.match(rd('council/datahealth.mjs'), /nq1\/desk\.json/);
  assert.ok(clean({ id: 'x', kind: 'nq1-l3', side: 1, entry: 100, stop: 99, t: 1 })); assert.equal(clean({ id: 'x', kind: 'nq1-l3', side: 1, entry: 100, stop: 101, t: 1 }), null);
});

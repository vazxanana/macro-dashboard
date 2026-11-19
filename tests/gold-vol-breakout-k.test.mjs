// gold-vol-breakout-k: parameter stability around the gold-vol-breakout T1 rule. Offline: hand-made candles, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as K from '../research/edge/gold-vol-breakout-k/run.mjs';
import * as O from '../research/edge/gold-vol-breakout-k/original.mjs';

const DIR = new URL('../research/edge/gold-vol-breakout-k/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
const D0 = Date.UTC(2026, 0, 13) / 1000;                       // Tuesday 13 Jan 2026, 00:00 UTC

// one UTC day of M5 candles: flat at 100 until 02:00, then at 102, except the given overrides { minuteOfDay: [o,h,l,c] }
function day(d0, over = {}) {
  const out = [];
  for (let m = 0; m < 24 * 60; m += 5) { const v = over[m] || (m < 120 ? [100, 100.1, 99.9, 100] : [102, 102.1, 101.9, 102]); out.push({ t: d0 + m * 60, o: v[0], h: v[1], l: v[2], c: v[3] }); }
  return out;
}

test('original.mjs is the verbatim copy of the original study', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('original.mjs', DIR))).digest('hex');
  assert.equal(sha, K.ORIG_SHA);
  assert.equal(R.original.runSha256, K.ORIG_SHA);
});

test('k and the exit only change the parameters handed to the rule', () => {
  const full = new Map([[D0, day(D0, { 120: [100.5, 102.2, 100.5, 102], 600: [102, 102.1, 101.9, 102.05] })]]);
  const d = { day: '2026-01-13', d0: D0, prevRange: 4, bars: full.get(D0).filter((b) => b.t - D0 < O.EXIT_S) };
  assert.equal(K.barsFor(d, full, O.EXIT_S), d.bars);                                  // 21:00 = the rule's own candles
  assert.equal(K.barsFor(d, full, 16 * 3600).at(-1).t, D0 + 16 * 3600 - 300);          // last candle 15:55
  assert.equal(K.barsFor(d, full, 24 * 3600).at(-1).t, D0 + 24 * 3600 - 300);          // last candle 23:55
  const t5 = K.trades([d], full, ['2026-01-01', '2026-12-31'], { k: 0.5 }).tr[0];
  assert.equal(t5.side, 1); assert.equal(t5.entry, 102);                              // buy stop at 100 + 0.5 × 4
  assert.equal(K.trades([d], full, ['2026-01-01', '2026-12-31'], { k: 0.6 }).tr.length, 0);   // 102.4 never reached
  const t3 = K.trades([d], full, ['2026-01-01', '2026-12-31'], { k: 0.3 }).tr[0];
  assert.equal(t3.entry, 101.2); assert.equal(t3.stop, 100);
});

test('no look-ahead: candles after the exit never change a trade', () => {
  const base = day(D0, { 120: [100.5, 102.2, 100.5, 102] }), changed = base.map((b) => (b.t - D0 >= 16 * 3600 ? { ...b, h: 200, l: 1, c: 150 } : b));
  const mk = (rows) => { const full = new Map([[D0, rows]]); return { full, d: { day: '2026-01-13', d0: D0, prevRange: 4, bars: rows.filter((b) => b.t - D0 < O.EXIT_S) } }; };
  const a = mk(base), b = mk(changed), w = ['2026-01-01', '2026-12-31'];
  assert.deepEqual(K.trades([a.d], a.full, w, { exitS: 16 * 3600 }).tr, K.trades([b.d], b.full, w, { exitS: 16 * 3600 }).tr);
  assert.notDeepEqual(K.trades([a.d], a.full, w).tr, K.trades([b.d], b.full, w).tr);   // the 21:00 exit does see them
});

test('an exit past 22:00 UTC pays financing on a buy, the 21:00 exit does not', () => {
  const full = new Map([[D0, day(D0, { 120: [100.5, 102.2, 100.5, 102] })]]);
  const d = { day: '2026-01-13', d0: D0, prevRange: 4, bars: full.get(D0).filter((b) => b.t - D0 < O.EXIT_S) }, w = ['2026-01-01', '2026-12-31'];
  assert.equal(K.trades([d], full, w).tr[0].nights, 0);
  const late = K.trades([d], full, w, { exitS: 24 * 3600 }).tr[0];
  assert.equal(late.nights, 1); assert.ok(late.finR > 0 && late.net < late.R - O.COST / late.r);
});

test('17:00 New York trading days: key, anchor, folding, open check', () => {
  // winter: 22:30 UTC Wednesday 14 Jan = 17:30 New York → the day closing Thursday 15 Jan, anchored 22:00 UTC
  assert.equal(K.ymdOf(K.nyKey(Date.UTC(2026, 0, 14, 22, 30) / 1000)), '2026-01-15');
  assert.equal(K.anchorOf(Date.UTC(2026, 0, 15) / 1000), Date.UTC(2026, 0, 14, 22) / 1000);
  // summer: 21:30 UTC 14 Jul = 17:30 New York → 15 Jul, anchored 21:00 UTC
  assert.equal(K.ymdOf(K.nyKey(Date.UTC(2026, 6, 14, 21, 30) / 1000)), '2026-07-15');
  assert.equal(K.anchorOf(Date.UTC(2026, 6, 15) / 1000), Date.UTC(2026, 6, 14, 21) / 1000);
  // before 17:00 New York stays on the same day; Sunday's reopen starts Monday
  assert.equal(K.ymdOf(K.nyKey(Date.UTC(2026, 0, 14, 21, 55) / 1000)), '2026-01-14');
  assert.equal(K.ymdOf(K.nyKey(Date.UTC(2026, 0, 11, 23, 0) / 1000)), '2026-01-12');
  // a day whose first candle comes 60 minutes after the anchor (the 17:00-18:00 break): inclusive opens it, strict does not
  const A = K.anchorOf(Date.UTC(2026, 0, 15) / 1000), bars = [];
  for (let m = 60; m < 21 * 60; m += 5) bars.push({ t: A + m * 60, o: 1, h: 1, l: 1, c: 1 });
  const d = { d0: A, bars, prevRange: 2 };
  assert.equal(K.nySkip(d, true), null); assert.equal(K.nySkip(d, false), 'noopen');
  assert.equal(K.nySkip({ ...d, bars: bars.map((b) => ({ ...b, t: b.t + 300 })) }, true), 'noopen');
});

test('buildNyDays: previous trading day range and the 21-hour window', () => {
  const rows = [];
  const A1 = K.anchorOf(Date.UTC(2026, 0, 14) / 1000), A2 = K.anchorOf(Date.UTC(2026, 0, 15) / 1000);
  for (let t = A1 + 3600; t < A2 - 0; t += 300) rows.push([t, 10, t === A1 + 7200 ? 13 : 10.5, 9, 10]);
  for (let t = A2 + 3600; t < A2 + 23 * 3600; t += 300) rows.push([t, 10, 10.5, 9.5, 10]);
  const ny = K.buildNyDays(rows);
  assert.deepEqual(ny.map((x) => x.day), ['2026-01-14', '2026-01-15']);
  assert.equal(ny[1].prevRange, 4); assert.equal(ny[1].d0, A2);
  assert.ok(ny[1].bars.every((b) => b.t >= A2 && b.t < A2 + 21 * 3600));
});

test('the pre-registered stability reading', () => {
  const mk = (net, gt) => Object.fromEntries(K.KS.map((k) => [k, { pooled: { netR: net(k), grossT: gt(k) } }]));
  assert.equal(K.reading(mk(() => 0.05, () => 3)).label, 'broad');
  assert.equal(K.reading(mk((k) => (k < 0.5 ? -0.01 : 0.05), () => 3)).label, 'narrow');          // net > 0 at 5 of 8
  assert.equal(K.reading(mk(() => 0.05, (k) => (k === 0.3 ? 1.9 : 3))).label, 'narrow');           // one core k under t 2
  assert.equal(K.reading(mk(() => 0.05, (k) => (k === 1 ? 0.5 : 3))).label, 'broad');             // k 1 is outside the core
});

test('result.json and RESULT.md agree', () => {
  assert.equal(R.gate.ok, true); assert.equal(R.gate.exitSame, R.gate.exitOf);
  for (const k of Object.keys(K.GATE)) assert.equal(R.gate.got[k], K.GATE[k]);
  assert.deepEqual(K.reading(R.k), R.reading);
  assert.equal(R.verdict, K.verdictLine(R.reading, R.k));
  assert.ok(R.verdict.length < 220);
  assert.ok(R.verdict.startsWith(R.reading.label.toUpperCase()));
  assert.equal(R.holm.length, 12);
  assert.equal(R.rule0.k, 0.5); assert.equal(R.rule0.exit, '21:00');
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, K.report(R));
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
  const plan = fs.readFileSync(new URL('PREREGISTRATION.md', DIR));
  assert.equal(crypto.createHash('sha256').update(plan).digest('hex'), R.planSha256);
  assert.match(md, /does not choose a new k/);
});

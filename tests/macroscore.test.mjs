// node --test tests/macroscore.test.mjs — the Gold Macro Score (council/macroscore.mjs), a port of the macro-agent-demo skill's engine
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { weekEnd, weeklyFrame, expandingZ, cardOf, goldMacroScore, dxyDaily, dailyRows, scoreLine } from '../council/macroscore.mjs';

const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000, DAY = 86400;
test('weekEnd: Saturday..Friday weeks labelled by their Friday (pandas W-FRI)', () => {
  assert.equal(weekEnd(T('2026-11-02')), T('2026-11-06'), 'Monday');
  assert.equal(weekEnd(T('2026-11-06')), T('2026-11-06'), 'Friday stays');
  assert.equal(weekEnd(T('2026-11-07')), T('2026-11-13'), 'Saturday opens the next week');
  assert.equal(weekEnd(T('2026-11-08') + 3600), T('2026-11-13'), 'Sunday too');
});
test('weeklyFrame: union calendar, forward fill, last value of each week, from the start date', () => {
  const a = [['2026-10-05', 1], ['2026-10-07', 2], ['2026-10-16', 3]].map(([d, v]) => ({ t: T(d), v }));   // misses the week of 10-09? no: 10-07 is in week to 10-09
  const b = [['2026-10-06', 10], ['2026-10-13', 20], ['2026-10-20', 30]].map(([d, v]) => ({ t: T(d), v }));
  const F = weeklyFrame({ a, b }, '2026-10-01');
  assert.deepEqual(F.weeks.map((t) => new Date(t * 1000).toISOString().slice(0, 10)), ['2026-10-09', '2026-10-16', '2026-10-23']);
  assert.deepEqual(F.cols.a, [2, 3, 3], 'a: last of week 1 = 2, week 2 = 3, week 3 forward-filled 3');
  assert.deepEqual(F.cols.b, [10, 20, 30]);
  assert.equal(weeklyFrame({ a }, '2026-10-12').weeks.length, 1, 'from cuts the earlier week; a alone has no date in the week to 10-23');
});
test('expandingZ: minimum observations, sample standard deviation, clip at ±3', () => {
  const raw = []; for (let i = 0; i < 60; i++) raw.push(i % 2 ? -1 : 1);
  const z = expandingZ(raw, 52);
  assert.equal(z[50], null); assert.ok(z[51] != null);
  assert.ok(Math.abs(Math.abs(z[59]) - 0.99) < 0.03, `|z| ≈ 0.99 for ±1 alternation (got ${z[59]})`); assert.ok(z[59] < 0, 'index 59 is −1');
  assert.equal(expandingZ(raw.concat([10]), 52).at(-1), 3, 'a 10-sigma spike clips to +3');
  assert.deepEqual(expandingZ([null, 1, null], 1).slice(0, 1), [null]);
  assert.equal(expandingZ(Array(60).fill(2), 52).at(-1), null, 'zero spread → no z');
});
test('cardOf: > +0.5 BUY High, +0.25..+0.5 BUY Medium, else AUCTION; a negative score is never a sell', () => {
  assert.deepEqual(cardOf(0.6).label, 'BUY · High'); assert.equal(cardOf(0.3).conviction, 'Medium'); assert.equal(cardOf(0.25).bias, 'AUCTION');
  assert.equal(cardOf(-1.2).bias, 'AUCTION'); assert.equal(cardOf(null).bias, null);
});
test('goldMacroScore: too little history → n/a; a clean dovish/weak-dollar run → a positive score, BUY', () => {
  const mk = (f) => { const out = []; for (let d = T('2006-01-02'); d <= T('2026-11-06'); d += DAY) { const w = new Date(d * 1000).getUTCDay(); if (w >= 1 && w <= 5) out.push({ t: d, v: f(d) }); } return out; };
  const wk = (d) => (d - T('2006-01-02')) / (7 * DAY);
  // noise with a fixed seed so the expanding std is non-zero, then the last 13 weeks: real yield and 2Y fall, DXY falls, curve steepens
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5; };
  const N = 1090, noise = Array.from({ length: N + 20 }, rnd);
  const late = (d) => Math.max(0, wk(d) - (N - 13));
  const ry = mk((d) => 1 + noise[Math.floor(wk(d))] * 0.2 - 0.08 * late(d)), y2 = mk((d) => 3 + noise[Math.floor(wk(d)) + 1] * 0.3 - 0.1 * late(d));
  const y10 = mk((d) => 3.5 + noise[Math.floor(wk(d)) + 2] * 0.3), dxy = mk((d) => 100 * Math.exp(noise[Math.floor(wk(d)) + 3] * 0.02 - 0.01 * late(d)));
  const s = goldMacroScore({ ry, y2, y10, dxy, gold: mk((d) => 2000 + late(d) * 10) }, { asOf: T('2026-11-06') });
  assert.ok(s.ok, JSON.stringify(s)); assert.ok(s.score > 0.5, `score ${s.score}`); assert.equal(s.bias, 'BUY'); assert.equal(s.conviction, 'High');
  assert.equal(s.path.length, 6); assert.equal(s.asOf, '2026-11-06'); assert.equal(s.partial, false); assert.equal(s.trend.above10w, true);
  for (const k of ['ry4w', 'dxy4w', 'y2_13w', 'curve13w']) assert.ok(s.z[k] > 0, `${k} z ${s.z[k]}`);
  assert.match(scoreLine(s), /^Gold Macro Score \+\d\.\d\d → BUY · High \(real yield 4w z \+/);
  const short = goldMacroScore({ ry: ry.slice(-200), y2: y2.slice(-200), y10: y10.slice(-200), dxy: dxy.slice(-200) }, { asOf: T('2026-11-06') });
  assert.equal(short.ok, false); assert.match(short.why, /fewer than 52 weeks/); assert.match(scoreLine(short), /n\/a/);
});
test('dxyDaily: the ICE formula on the five pairs; dailyRows reads the council daily cache', () => {
  const rows = { rows: [[T('2026-11-05'), 1, 1, 1, 1.15, 1], [T('2026-11-06'), 1, 1, 1, 1.16, 1]] };
  const e = dailyRows(rows); assert.deepEqual(e.map((o) => o.v), [1.15, 1.16]);
  const one = (v) => [{ t: T('2026-11-06'), v }];
  const d = dxyDaily({ eurusd: one(1.16), usdjpy: one(153), gbpusd: one(1.31), usdcad: one(1.40), usdchf: one(0.80) });
  assert.equal(d.length, 1); assert.ok(d[0].v > 95 && d[0].v < 105, `DXY ≈ 99 (got ${d[0].v})`);
  assert.equal(dxyDaily({ eurusd: one(1.16) }).length, 0, 'a day needs all five pairs');
});
test('wiring: the Macro member computes it, writes it in forecast.json, the brief and the Analyst block; the desk shows it', () => {
  const m = fs.readFileSync(new URL('../council/macro.mjs', import.meta.url), 'utf8');
  assert.match(m, /const S = await scoreSeries\(fetchImpl, now, \{ dir, data, cache, src \}\), goldScore = goldMacroScore\(S, \{ asOf: now \}\);/);
  assert.match(m, /sources: src, goldScore \};/); assert.match(m, /if \(fc\.goldScore\) L\.push\(scoreLine\(fc\.goldScore\)\);/); assert.match(m, /scoreLine\(fc\.goldScore\)\.replace/);
  assert.match(m, /nc\.score = /);
  const h = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(h, /id="ms-md-score"/); assert.match(h, /function renderScore\(f\)/); assert.match(h, /renderNext, renderScore, renderVet, renderSmile/);
});

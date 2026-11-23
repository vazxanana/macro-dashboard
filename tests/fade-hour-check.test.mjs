// tests/fade-hour-check.test.mjs - is the 20-23 UTC fade a quote effect: pre-registration, RESULT.md agrees with result.json,
// the verdict follows the bar, the gate, and the pure helpers (exit scan, spike ratio, rollover cuts) on hand-made data. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exitOf, spikeRatios, spikeBucket, blockNoRoll, block2023, block0811, overRoll, inRoll, stats, welchDf } from '../research/edge/fade-hour-check/run.mjs';
import { exits } from '../research/edge/grid7-wide-fade/run.mjs';

const DIR = new URL('../research/edge/fade-hour-check/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const u = (d, h, m = 0) => Date.UTC(2020, 0, d, h, m) / 1000;

test('pre-registration names the rule, the four primary tests, the feeds and the bar', () => {
  for (const w of ['m15 none atr 2R all', 'BEFORE any run', 'P1', 'P2', 'P3', 'P4', 'Holm over the four', 'HistData', '21:00-22:59',
    'hour **20 or 23 UTC**', 'Welch t >= 2', 'hourProfile', 'nas100 spx500 de40', 'Never called an edge']) assert.ok(pre.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the gate reproduces grid7-wide-fade and fade-conditions; the verdict follows the bar', () => {
  for (const g of R.gate) assert.ok(g.ok, g.what);
  assert.equal(R.exitCheckMismatches, 0);
  assert.equal(R.primary.length, 4);
  for (const p of R.primary) assert.equal(p.pass, p.cond && p.holm < 0.05, p.key);
  for (const p of R.primary.slice(0, 3)) assert.equal(p.cond, p.mean > 0 && p.t >= 2, p.key);
  assert.equal(R.verdict, R.primary.every((p) => p.pass) ? 'PASS' : 'FAIL');
  assert.equal(R.markets.length, 10); assert.ok(R.histMarkets.length >= 6);
});

test('RESULT.md carries every primary test and the rollover cuts from result.json', () => {
  for (const p of R.primary) { const line = md.split('\n').find((l) => l.startsWith(`| ${p.key} |`)); assert.ok(line, p.key);
    assert.ok(line.includes(f3(p.mean)), p.key + ' mean'); assert.ok(line.includes(p.pass ? '| yes |' : '| no |'), p.key + ' pass'); }
  for (const c of R.cuts) { const line = md.split('\n').find((l) => l.startsWith(`| ${c.name} |`)); assert.ok(line, c.name);
    assert.ok(line.includes(f3(c.c.mean)), c.name); }
  assert.equal(R.hoursOanda.length, 24); assert.equal(R.hoursHist.length, 24);
});

test('the exit scan equals the grid exits on hand-made candles', () => {
  const M5 = [100, 101, 99, 102, 98, 103, 97, 104].map((c, i) => ({ t: i * 300, e: (i + 1) * 300, o: i ? 100 + (i % 2) : 100, h: c + 1, l: c - 1, c }));
  for (const [s, stop, tg] of [[1, 97.5, 105], [-1, 102.5, 95], [1, 90, 103.5]]) {
    const g = exits(M5, s, 0, stop, [tg], 86400), x = exitOf(M5, s, 0, stop, tg, 86400);
    assert.ok(g && x); assert.ok(Math.abs(g.R[0] - x.R) < 1e-12); assert.ok(x.e > 0); assert.ok(s * (M5[0].o - stop) > 0, 'stop on the losing side');
  }
});

test('spike ratio uses only earlier candles of the same time of day', () => {
  const T = Array.from({ length: 96 * 25 }, (_, i) => ({ t: i * 900, h: 101, l: 100 }));
  T[96 * 22].h = 103; const r = spikeRatios(T);
  assert.ok(Number.isNaN(r[96 * 19]), 'fewer than 20 earlier'); assert.equal(r[96 * 20], 1); assert.equal(r[96 * 22], 3); assert.equal(r[96 * 22 + 1], 1);
  assert.equal(spikeBucket(r[96 * 22]), 2); assert.equal(spikeBucket(0.5), 0); assert.equal(spikeBucket(NaN), -1);
});

test('rollover cuts', () => {
  assert.ok(inRoll(u(2, 21, 5)) && inRoll(u(2, 22, 55)) && !inRoll(u(2, 23)) && !inRoll(u(2, 20, 55)));
  assert.ok(blockNoRoll([u(2, 23, 5), 23]) && blockNoRoll([u(2, 20, 20), 20]) && !blockNoRoll([u(2, 21, 0), 20]) && !blockNoRoll([u(2, 21, 5), 21]));
  assert.ok(block2023([0, 21]) && !block2023([0, 19]) && block0811([0, 8]) && !block0811([0, 12]));
  assert.ok(overRoll([u(2, 20), 20, 0, 0, u(2, 21, 30)]), 'exits inside'); assert.ok(overRoll([u(2, 20), 20, 0, 0, u(3, 1)]), 'spans it');
  assert.ok(!overRoll([u(2, 23, 5), 23, 0, 0, u(3, 10)]), 'after it'); assert.ok(overRoll([u(2, 23, 5), 23, 0, 0, u(3, 21, 10)]), 'next day');
  const s = stats([[u(2, 1), 1, 1, 0.1], [u(40, 1), 1, -1, 0.1]], 180, 182); assert.equal(s.n, 2); assert.equal(s.mean, 0);
  assert.ok(welchDf({ n: 10, sum: 10, sq: 20 }, { n: 10, sum: 0, sq: 10 }).t > 0);
});

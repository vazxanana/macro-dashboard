// tests/fade-conditions.test.mjs - where the fade tilt lives: pre-registration, RESULT.md agrees with result.json, the verdict
// follows the bar, the gate against grid7-wide-fade, and the five condition functions on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SPLITS, NL, hourLevel, volLevel, trendLevel, bodyLevel, dowLevel, welchDf } from '../research/edge/fade-conditions/run.mjs';

const DIR = new URL('../research/edge/fade-conditions/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the rules, the splits, the windows, the bar and the assumed costs', () => {
  for (const w of ['m15 none atr 2R all', 'h1 none ext 2R all', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm over the 10',
    'Welch', 'ASSUMED', 'no re-picking', 'BEFORE any run', '100 values', 'Sunday candle counts as Monday']) assert.ok(pre.includes(w), w);
});

test('the splits and their levels are as pre-registered', () => {
  assert.deepEqual(SPLITS.map((s) => s.levels.length), [6, 3, 6, 3, 5]); assert.equal(NL, 23);
  assert.deepEqual(R.splits.map((s) => s.key), ['hour', 'vol', 'trend', 'body', 'dow']);
  assert.equal(R.primary.length, 10);
});

test('condition functions', () => {
  assert.equal(hourLevel(Date.UTC(2020, 0, 2, 3, 59) / 1000), 0); assert.equal(hourLevel(Date.UTC(2020, 0, 2, 4) / 1000), 1);
  assert.equal(hourLevel(Date.UTC(2020, 0, 2, 23) / 1000), 5);
  assert.equal(dowLevel(Date.UTC(2020, 0, 5, 22) / 1000), 0, 'Sunday = Monday'); assert.equal(dowLevel(Date.UTC(2020, 0, 3) / 1000), 4, 'Friday');
  assert.equal(dowLevel(Date.UTC(2020, 0, 4) / 1000), -1, 'Saturday');
  assert.equal(bodyLevel({ o: 1, c: 1.4 }, 1), 0); assert.equal(bodyLevel({ o: 1, c: 1.5 }, 1), 1); assert.equal(bodyLevel({ o: 2, c: 1 }, 1), 1); assert.equal(bodyLevel({ o: 1, c: 2.1 }, 1), 2);
  const atr = new Float64Array(300).fill(1); atr[200] = 0.7; atr[201] = 1.25; atr[202] = 1.3;
  assert.equal(volLevel(atr, 50), -1, 'too few'); assert.equal(volLevel(atr, 200), 0); assert.equal(volLevel(atr, 201), 1); assert.equal(volLevel(atr, 202), 2);
  // Daily candles: 25 closed days rising in a straight line -> ER 1, a trend; the 26th day not closed yet is ignored
  const D = Array.from({ length: 26 }, (_, i) => ({ t: i * 86400, e: (i + 1) * 86400, c: i === 25 ? 0 : 100 + i }));
  assert.equal(trendLevel(D, 25 * 86400, 1), 4, 'trend-with'); assert.equal(trendLevel(D, 25 * 86400, -1), 5, 'trend-against');
  assert.equal(trendLevel(D, 10 * 86400, 1), -1, 'fewer than 21 closed days');
  const Z = Array.from({ length: 25 }, (_, i) => ({ t: i * 86400, e: (i + 1) * 86400, c: 100 + (i % 2) * 2 + (i === 24 ? 0.5 : 0) }));
  assert.equal(trendLevel(Z, 25 * 86400, 1), 0, 'range-with');
  const w = welchDf({ n: 10, sum: 10, sq: 20 }, { n: 10, sum: 0, sq: 10 }); assert.ok(w.t > 0 && w.df > 0);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the gate reproduces grid7-wide-fade and the verdict follows the bar', () => {
  for (const g of R.gate) assert.ok(g.ok, g.rule);
  for (const p of R.primary) assert.equal(p.pass, p.diff != null && p.diff > 0 && p.holm < 0.05, `${p.rule} ${p.split}`);
  assert.equal(R.verdict, R.primary.some((p) => p.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
  assert.ok(R.cut.length >= 5);
});

test('RESULT.md carries every primary test and every level from result.json', () => {
  const lines = md.split('\n');
  for (const p of R.primary) {
    const row = lines.find((l) => l.startsWith(`| ${p.rule} | ${p.split} |`)); assert.ok(row, p.rule + p.split);
    assert.ok(row.includes(f3(p.diff)) && row.includes(p.t.toFixed(2)) && row.includes(p.pass ? '| yes |' : '| no |'), p.rule + p.split);
  }
  for (const b of R.levels) {
    const at = lines.indexOf(`### ${b.rule} · ${b.split}`); assert.ok(at > 0, b.rule + b.split);
    for (const l of b.levels) { const row = lines.slice(at, at + 12).find((x) => x.startsWith(`| ${l.level} |`)); assert.ok(row, l.level);
      assert.ok(row.includes(f3(l.conf.mean)) && row.includes(l.conf.t.toFixed(2)) && row.includes(f3(l.disc.mean)), b.split + ' ' + l.level); }
  }
});

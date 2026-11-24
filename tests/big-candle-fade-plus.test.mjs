// tests/big-candle-fade-plus.test.mjs - the complemented big-candle fades: pre-registration, RESULT.md agrees with result.json,
// the verdict follows the after-cost bar, the markets are fresh, and the rules pick the pre-registered rows. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARKETS, RULES, tradesOf, stats, judge } from '../research/edge/big-candle-fade-plus/run.mjs';
import { MARKETS as READ } from '../research/edge/big-candle-fade/run.mjs';

const DIR = new URL('../research/edge/big-candle-fade-plus/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the fresh markets, both rules and the after-cost bar', () => {
  for (const w of ['AFTER costs', 'overnight shock fade', 'rejection wick', 'Holm', '1.5x', 'best 1 %', '21:00-06:59 UTC', '>= 25 %'])
    assert.ok(pre.includes(w), w);
  for (const m of MARKETS) assert.ok(pre.includes(m), m);
});

test('the markets were never read by the big-candle work', () => {
  for (const m of MARKETS) assert.ok(!READ.includes(m), m);
  assert.equal(MARKETS.length, 10);
});

test('the rules take the pre-registered rows, variants and exits', () => {
  const row = (f, R) => ({ t: Date.UTC(2016, 2, 1) / 1000, f, R });
  const base = { h: 2, rel: 0.6, wick: 0.3, conf: 1 };
  const list = [row(base, { 'mkt|0.1': [0.5, 2, 1.1, 0.2], 'conf|0.5': [0.4, 1, 2, 0.1] }),
    row({ ...base, h: 10 }, { 'mkt|0.1': [0, 9, 0, 0.2], 'conf|0.5': [0, 0, -1, 0.1] }),
    row({ ...base, rel: 0.4 }, { 'mkt|0.1': [0, 9, 0, 0.2], 'conf|0.5': [0, 0, 9, 0.1] }),
    row({ ...base, conf: 0, wick: 0.1 }, { 'mkt|0.1': [0, -1, 0, 0.2] })];
  assert.deepEqual(tradesOf(list, RULES.A).map((x) => x.R), [2, -1]);
  assert.deepEqual(tradesOf(list, RULES.B).map((x) => x.R), [2, -1]);
  const s = stats(tradesOf(list, RULES.B)); assert.equal(s.n, 2); assert.ok(Math.abs(s.net - (0.5 - 0.1)) < 1e-9);
  const j = judge([{ market: 'x', rows: list }]); assert.equal(j.length, 2); assert.ok(j.every((r) => r.pass === false));
});

test('line 3 is the verdict line and matches result.json; the verdict follows the bar', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line); assert.ok(line.includes(R.headline));
  for (const r of R.rules) {
    const ok = r.windows.every((w) => w.n >= 300 && w.net > 0) && r.tNet >= 2 && r.holm < 0.05 && r.netTrim > 0 && r.net15 > 0;
    assert.equal(r.pass, ok, r.name); }
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : R.rules.some((r) => r.pass) ? 'PASS' : 'FAIL');
});

test('RESULT.md shows each rule and market with its figures from result.json', () => {
  const lines = md.split('\n');
  for (const r of R.rules) { const row = lines.find((l) => l.startsWith(`| ${r.name} |`)); assert.ok(row, r.name);
    assert.ok(row.includes(f3(r.net)) && row.includes(r.tNet.toFixed(2)) && row.includes(f3(r.gross)), r.name); }
  for (const m of R.markets) assert.ok(lines.some((l) => l.startsWith(`| ${m}`)), m);
});

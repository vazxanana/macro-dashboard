// tests/fade-zone-complete.test.mjs - the zone fade with cost, hour and level filters: the pre-registration, RESULT.md agrees
// with result.json, the verdict follows the bar, and the pure helpers (hour filter, candidate filter, statistics). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hourOk, takes, CANDS, COST_MAX, stats } from '../research/edge/fade-zone-complete/run.mjs';

const DIR = new URL('../research/edge/fade-zone-complete/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const u = (h, m = 0) => Date.UTC(2020, 0, 6, h, m) / 1000;

test('the pre-registration fixes the candidates, the filters and the after-cost bar', () => {
  for (const w of ['BEFORE any run', 'AFTER costs', '**5 %**', '20, 21, 22 or 23 UTC', '21:00-22:59 UTC', 'K1', 'K8',
    '**2005-14** = selection', 'C1', 'C2', 'ASSUMED, not measured', 'nas100 spx500 de40 gbpjpy audjpy cadjpy eurgbp euraud',
    'Cut test', 'Never called an edge']) assert.ok(pre.includes(w), w);
  assert.equal(CANDS.length, 8); assert.equal(COST_MAX, 0.05);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
});

test('the gate and the cut test hold; the verdict follows the bar', () => {
  for (const g of R.gate) assert.ok(g.ok, g.what);
  assert.equal(R.cutBad, 0); assert.ok(R.cut.length >= 6);
  assert.ok(R.ten.length >= 8 && R.eight.length >= 6);
  for (const c of R.candidates) assert.equal(c.eligible, c.selection.n >= 300 && c.selection.net > 0 && c.selection.tNet >= 2, c.key);
  const el = R.candidates.filter((c) => c.eligible).sort((a, b) => b.selection.tNet - a.selection.tNet);
  assert.equal(R.pick, el.length ? el[0].key : null);
  if (!R.pick) assert.equal(R.verdict, 'FAIL');
  else { const p = R.candidates.find((c) => c.key === R.pick); const ok = (s) => s.n >= 300 && s.net > 0 && s.tNet >= 2;
    assert.equal(R.verdict, ok(p.confirm1) && ok(p.confirm2) ? 'PASS' : 'FAIL'); }
});

test('RESULT.md carries every candidate from result.json', () => {
  const lines = md.split('\n');
  for (const c of R.candidates) { const l = lines.find((x) => x.startsWith(`| ${c.key} | ${c.name} |`)); assert.ok(l, c.key);
    assert.ok(l.includes(f3(c.selection.net)) && l.includes(f3(c.confirm1.net)), c.key); }
});

test('the hour filter: break start 20-23 UTC, fill outside the rollover', () => {
  assert.equal(hourOk(u(20), u(20, 15)), true); assert.equal(hourOk(u(23, 45), u(24)), true);
  assert.equal(hourOk(u(20, 45), u(21)), false); assert.equal(hourOk(u(21), u(21, 15)), false); assert.equal(hourOk(u(19, 45), u(20)), false);
});

test('a candidate takes only its timeframe and filters', () => {
  const r = { tf: 1, hour: true, level: false, cr: 0.04 };
  assert.equal(takes(CANDS[0], r), true); assert.equal(takes(CANDS[2], r), false); assert.equal(takes(CANDS[4], r), true);
  assert.equal(takes(CANDS[4], { ...r, cr: 0.06 }), false); assert.equal(takes(CANDS[6], r), false);
});

test('statistics: net = R - cost R, month sums', () => {
  const rows = [{ m: 0, R: 1, cr: 0.1 }, { m: 1, R: -1, cr: 0.1 }, { m: 1, R: 2, cr: 0.1 }];
  const s = stats(rows, 0, 3); assert.equal(s.n, 3); assert.ok(Math.abs(s.net - 0.6) < 1e-12); assert.ok(Math.abs(s.gross - 2 / 3) < 1e-12);
  assert.ok(Math.abs(s.net2 - 0.5) < 1e-12);
});

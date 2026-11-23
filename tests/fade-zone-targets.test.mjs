// tests/fade-zone-targets.test.mjs - key levels as the fade's targets and stops: the pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, and the pure helpers (standing levels, the nearest stop / target level) on
// hand-made data. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { standing, pick, hourBlock, PRIMARY } from '../research/edge/fade-zone-targets/run.mjs';

const DIR = new URL('../research/edge/fade-zone-targets/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('the pre-registration names the rule, the levels, the six tests and the bar', () => {
  for (const w of ['BEFORE any run', 'm15 none', 'buildZones(\'eg\')', 'buildZones(\'dom\')', 'sdZones', 'buildZones(\'av\')',
    '**(a) 2R**', '**(b) Zone target**', '**(c) Swing**', '**(i) ATR**', '**(ii) Zone**', '**12 cells**', '**20-23 UTC**',
    'P1', 'P6', 'Holm over the six', 'in **both** windows', 'ASSUMED, not measured', 'Cut test', 'Never called an edge']) assert.ok(pre.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.ok(typeof R.headline === 'string' && R.headline.length > 20);
});

test('the gate and the cut test hold; the verdict follows the pre-registered bar', () => {
  for (const g of R.gate) assert.ok(g.ok, g.what);
  assert.equal(R.cutBad, 0); assert.ok(R.cut.length >= 6);
  assert.equal(R.markets.length, 10);
  assert.equal(R.primary.length, 6); assert.equal(R.cells.length, 12);
  for (const p of R.primary) {
    assert.equal(p.cond, p.first.mean > 0 && p.second.mean > 0 && p.first.t >= 2 && p.second.t >= 2, p.key);
    assert.equal(p.pass, p.cond && p.holm < 0.05, p.key);
  }
  assert.equal(R.verdict, R.primary.some((p) => p.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.primary.filter((p) => p.pass).map((p) => p.key));
});

test('RESULT.md carries every primary test and every cell from result.json', () => {
  const lines = md.split('\n');
  for (const p of R.primary) { const l = lines.find((x) => x.startsWith(`| ${p.key} |`)); assert.ok(l, p.key);
    assert.ok(l.includes(f3(p.first.mean)) && l.includes(f3(p.second.mean)), p.key + ' means');
    assert.ok(l.includes(p.pass ? '| yes |' : '| no |'), p.key + ' pass'); }
  for (const c of R.cells) { const l = lines.find((x) => x.startsWith(`| ${c.cell} |`)); assert.ok(l, c.cell);
    assert.ok(l.includes(f3(c.first.mean)) && l.includes(f3(c.second.mean)), c.cell); }
});

test('standing levels: known by the time, not yet ended', () => {
  const L = [{ d: 1, bot: 1, top: 2, at: 10, end: 50 }, { d: -1, bot: 5, top: 6, at: 20, end: 30 }, { d: 1, bot: 0, top: 1, at: 40, end: 1e9 }];
  const at = standing(L);
  assert.equal(at(5).length, 0); assert.equal(at(25).length, 2); assert.equal(at(30).length, 1); assert.equal(at(45).length, 2); assert.equal(at(60).length, 1);
});

test('the nearest stop level is behind the fade and the nearest target in front', () => {
  const act = [{ d: -1, bot: 101, top: 103 }, { d: -1, bot: 104, top: 108 }, { d: 1, bot: 95, top: 97 }, { d: 1, bot: 90, top: 92 }, { d: 1, bot: 99, top: 101 }];
  const sell = pick(act, -1, 100);   // stop: far side (top) of the nearest supply above; target: top of the nearest demand below
  assert.equal(sell.stopFar, 103); assert.equal(sell.tgt, 97);
  const buy = pick(act, 1, 100);     // stop: bot of the nearest demand whose far side is below; target: bot of the nearest supply above
  assert.equal(buy.stopFar, 99); assert.equal(buy.tgt, 101);
  const none = pick([], 1, 100); assert.ok(Number.isNaN(none.stopFar) && Number.isNaN(none.tgt));
});

test('the 20-23 UTC block and the six primary tests', () => {
  assert.equal(hourBlock(Date.UTC(2020, 0, 6, 20, 0) / 1000), true); assert.equal(hourBlock(Date.UTC(2020, 0, 6, 23, 45) / 1000), true);
  assert.equal(hourBlock(Date.UTC(2020, 0, 6, 19, 45) / 1000), false); assert.equal(hourBlock(Date.UTC(2020, 0, 7, 0, 0) / 1000), false);
  assert.deepEqual(PRIMARY.map((p) => p.key), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
});

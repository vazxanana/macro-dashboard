// tests/grid7-wide-fade.test.mjs - the wide fade grid: pre-registration, RESULT.md agrees with result.json, the verdict follows
// the bar, the cells are the pre-registered 54, the break detector equals edgekit's, and the trade engine on hand-made candles.
// Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { exits, breaks, cellName, cellA, cellB, NCELL, sessionOf } from '../research/edge/grid7-wide-fade/run.mjs';

const DIR = new URL('../research/edge/grid7-wide-fade/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the bar and the assumed costs', () => {
  for (const w of ['54', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'mirror', 'First touch'.toLowerCase(), 'BEFORE costs'])
    assert.ok(pre.includes(w), w);
});

test('the 54 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 54);
  assert.equal(cellName(cellA(1, 1, 0, 0)).name, 'm15 h4eg ext 1R all');
  assert.equal(cellName(cellB(2, 0, 1)).name, 'h1 none ext 1R ny');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
  assert.equal(sessionOf(Date.UTC(2020, 0, 2, 7) / 1000), 0); assert.equal(sessionOf(Date.UTC(2020, 0, 2, 16, 59) / 1000), 1); assert.equal(sessionOf(Date.UTC(2020, 0, 2, 17) / 1000), 2);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
});

test('RESULT.md lists every cell with its figures from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.mean)) && row.includes(c.conf.t.toFixed(2)), c.cell);
    assert.ok(row.includes(f3(c.disc.mean)) && row.includes(c.disc.t.toFixed(2)), c.cell);
  }
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
  assert.ok(R.cut.length >= 5);
});

test('breaks() gives the same events as edgekit structure()', () => {
  const rnd = K.rng(11); let p = 100; const B = [];
  for (let i = 0; i < 3000; i++) { const o = p, c = o + (rnd() - 0.5) * 2, h = Math.max(o, c) + rnd(), l = Math.min(o, c) - rnd(); p = c; B.push({ t: i * 300, o, h, l, c, e: i * 300 + 300 }); }
  const a = breaks(B, 3), b = K.structure(B, 3).events;
  assert.equal(a.length, b.length); a.forEach((e, i) => { assert.equal(e.i, b[i].i); assert.equal(e.dir, b[i].dir); assert.equal(e.level, b[i].level); });
  assert.ok(a.some((e) => e.opp != null));
});

test('the trade engine: stop first, gaps, several targets, time limit', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  // short at 100, stop 101: targets 99 and 98; candle 2 reaches 99 and 98.5, candle 3 the stop
  let r = exits([bar(0, 100, 100.2, 99.8, 100), bar(300, 100, 100.1, 98.5, 99), bar(600, 99, 101.5, 99, 101)], -1, 0, 101, [99, 98, NaN], 86400);
  assert.deepEqual(r.R.slice(0, 2), [1, -1]); assert.ok(Number.isNaN(r.R[2]));
  // a candle holding stop and target: the stop first
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 100, 101.2, 98.9, 100)], -1, 0, 101, [99, NaN, NaN], 86400); assert.equal(r.R[0], -1);
  // a gap through the stop fills at the open
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 102, 102.5, 101.8, 102)], -1, 0, 101, [99, NaN, NaN], 86400); assert.equal(r.R[0], -2);
  // time limit: out at the close of the candle that reaches it
  r = exits([bar(0, 100, 100.1, 99.9, 100), bar(300, 100, 100.2, 99.6, 99.6)], -1, 0, 101, [98, NaN, NaN], 600); assert.ok(Math.abs(r.R[0] - 0.4) < 1e-9);
  // a stop on the wrong side is no trade
  assert.equal(exits([bar(0, 100, 100, 100, 100)], -1, 0, 99, [98, NaN, NaN], 600), null);
});

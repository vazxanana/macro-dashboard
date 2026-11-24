// tests/vb-choch-exit.test.mjs - the breakout managed by structure: pre-registration, RESULT.md agrees with result.json, the
// verdict follows the bar, T1 reproduced, and the managed exit on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { managed, EXITS } from '../research/edge/vb-choch-exit/run.mjs';

const DIR = new URL('../research/edge/vb-choch-exit/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');

test('pre-registration fixes the exits, the windows and the bar', () => {
  for (const w of ['M5 (E1), M15 (E2) or H1 (E3)', 'early 2005-2015', 'Holm', 'month-sum t', 'forward record']) assert.ok(pre.includes(w), w);
  assert.deepEqual(R.exits.map((e) => e.exit), EXITS);
});

test('line 3 is the verdict line and matches result.json; the verdict follows the bar', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`) && line.includes(R.headline));
  for (const e of R.exits.slice(1)) assert.equal(e.pass, e.early.tD >= 2 && e.late.tD >= 2 && e.early.net > 0 && e.late.net > 0 && e.holm < 0.05, e.exit);
  assert.equal(R.verdict, R.exits.some((e) => e.pass) ? 'PASS' : 'FAIL');
});

test('T1 reproduced on USD/JPY within 1 % of the published trade count and +-0.005R', () => {
  const g = R.gate.usdjpy;
  for (const w of ['early', 'late']) { assert.ok(Math.abs(g[w].n - g.want[w].n) <= 0.01 * g.want[w].n); assert.ok(Math.abs(g[w].net - g.want[w].netR) <= 0.005); }
});

test('managed exit: out at the first open at or after the ChoCh time; the stop first; else the close', () => {
  const B = [{ t: 0, o: 100, h: 101.2, l: 100, c: 101 }, { t: 300, o: 101, h: 101.5, l: 100.8, c: 101.4 }, { t: 600, o: 101.4, h: 101.6, l: 101.1, c: 101.2 }];
  const x = { side: 1, fillT: 0, entry: 101, stop: 99 };
  assert.deepEqual(managed(B, x, 600), { R: (101.4 - 101) / 2, how: 'choch' });
  assert.deepEqual(managed(B, x, Infinity), { R: (101.2 - 101) / 2, how: 'time' });
  const S = [{ t: 0, o: 100, h: 101.2, l: 100, c: 101 }, { t: 300, o: 100.5, h: 100.6, l: 98.5, c: 99 }];
  assert.deepEqual(managed(S, x, 600), { R: -1, how: 'stop' });
});

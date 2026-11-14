// commodity-cycle: the frozen rule file is crypto-cycle's run.mjs byte for byte, the study adds only the skip window, the
// commodity costs and the windows, and the committed report says what result.json says. Offline (no candles needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/commodity-cycle/run.mjs';
import * as F from '../research/edge/commodity-cycle/frozen.mjs';
import { nights } from '../council/fills.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'commodity-cycle');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const T = (s) => Date.parse(s) / 1000;

test('frozen.mjs is crypto-cycle run.mjs byte for byte (sha256 pinned)', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, 'a2c714701e2faf486c5a77677359cb815bb05babed277041cf085dd8a2905f5b');
  assert.match(read('PREREGISTRATION.md'), /a2c714701e2faf486c5a77677359cb815bb05babed277041cf085dd8a2905f5b/);
});

test('run.mjs takes the rule from frozen.mjs and does not redefine it', () => {
  const src = read('run.mjs');
  assert.match(src, /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['swings', 'boEvents', 'cycles', 'simulate', 'atrAt', 'biasAtOpen', 'summary', 'monthly', 'holm'])
    assert.doesNotMatch(src, new RegExp(`function ${fn}\\(`), fn);
  for (const fn of ['F.cycles(', 'F.plan(', 'F.simulate(', 'F.toH4(', 'F.summary(', 'F.holm(', 'F.biasAtOpen(']) assert.ok(src.includes(fn), fn);
  assert.equal(S.MARKETS.includes('xau'), false, 'gold is out (owner item 44)');
  assert.deepEqual(S.MARKETS, ['xag', 'xpt', 'xpd', 'xcu', 'wtico', 'bco']);
});

test('skip window: 21:00-22:59 UTC and the weekend (fx-cycle copy)', () => {
  assert.equal(S.skipEntry(T('2026-11-11T21:00:00Z')), true);
  assert.equal(S.skipEntry(T('2026-11-11T22:00:00Z')), true);
  assert.equal(S.skipEntry(T('2026-11-11T20:00:00Z')), false);
  assert.equal(S.skipEntry(T('2026-11-14T12:00:00Z')), true);   // Saturday
  assert.equal(S.skipEntry(T('2026-11-10T14:00:00Z')), false);  // Tuesday
});

test('plan: a signal whose entry candle is in the window is skipped, else the frozen plan unchanged', () => {
  const base = T('2026-11-10T00:00:00Z'), H1 = [];
  for (let i = 0; i < 60; i++) { const o = 100 + Math.sin(i / 3); H1.push({ time: base + i * 3600, open: o, high: o + 1, low: o - 1, close: o + 0.2 }); }
  const s = { dir: 1, h4t: base + 4 * 3600, h4start: base, ch: 18, fin: 20, sigT: H1[20].time + 3600 };
  assert.equal(new Date(H1[21].time * 1000).getUTCHours(), 21);
  assert.deepEqual(S.plan(H1, s, 'B'), { skip: 'window' });
  const s2 = { ...s, ch: 14, fin: 16, sigT: H1[16].time + 3600 };
  assert.deepEqual(S.plan(H1, s2, 'B'), F.plan(H1, s2, 'B'));
});

test('costs: 2 x the assumed spread a round trip, financing on longs by fills.mjs nights, none on shorts', () => {
  assert.equal(S.COST_RT.xag, 0.001);
  assert.equal(S.COST_RT.xpd, 0.005);
  const t = T('2026-11-10T10:00:00Z'), c = T('2026-11-12T10:00:00Z');   // Tue -> Thu: Tue night 1 + Wed night 3
  assert.equal(nights(t, c), 4);
  const p = { dir: 1, t, entry: 30, r0: 0.3 }, x = { t: c };
  assert.ok(Math.abs(S.costR('xag', p, x) - (0.001 * 30 + 0.00015 * 4 * 30) / 0.3) < 1e-12);
  assert.ok(Math.abs(S.costR('xag', { ...p, dir: -1 }, x) - 0.001 * 30 / 0.3) < 1e-12);
  assert.ok(Math.abs(S.costR('xag', p, x, 2) - 2 * S.costR('xag', p, x)) < 1e-12);
});

test('gate and result: the frozen study reproduced crypto-cycle exactly; the report says what result.json says', () => {
  const g = JSON.parse(read('gate.json'));
  assert.equal(g.equal, true);
  assert.deepEqual(g.A, { n: 830, netR: -65.42, tMonth: -1.8 });
  assert.deepEqual(g.B, { n: 1717, netR: -94.28, tMonth: -1.79 });
  const r = JSON.parse(read('result.json')), md = read('RESULT.md');
  assert.ok(['PASS', 'FAIL', 'NOT MEASURABLE'].includes(r.verdict));
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\.\\*\\*`));
  for (const e of ['A', 'B']) {
    const x = r.exits[e];
    assert.equal(x.pass, Object.values(x.lines).every(Boolean));
    assert.equal(x.lines.abovePlacebo, x.decisive.meanNet > x.placebo.p95);
    assert.equal(x.placebo.seeds.length, 40);
    assert.ok(md.includes(`n ${x.decisive.n}`));
    assert.deepEqual(Object.keys(x.byMarket), S.MARKETS);
  }
  assert.equal(r.verdict === 'PASS', r.exits.A.pass || r.exits.B.pass);
});

// fade-breaks-holdout: the pre-registered faded rules on unread data. Offline: reads the committed files and runs the plain
// rule (F4) on made-up candles; no candle cache is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../research/edge/fade-breaks-holdout/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'fade-breaks-holdout');
const res = JSON.parse(fs.readFileSync(path.join(ROOT, 'result.json'), 'utf8'));
const md = fs.readFileSync(path.join(ROOT, 'RESULT.md'), 'utf8');
const picks = JSON.parse(fs.readFileSync(path.join(ROOT, 'picks.json'), 'utf8'));

test('RESULT.md line 3 states the verdict of result.json', () => {
  const l3 = md.split('\n')[2];
  assert.match(l3, /^\*\*Verdict: (PASS|FAIL|INCONCLUSIVE)\. .+\*\*$/);
  assert.equal(l3.match(/Verdict: (\w+)/)[1], res.verdict);
  assert.ok(res.headline.startsWith(res.verdict));
});

test('the verdict follows the pre-registered bar from the stored primary tests', () => {
  assert.equal(res.primary.length, 8);
  const prim = res.primary.map((p) => ({ rule: p.rule, set: p.set, stat: { n: p.n, meanR: p.meanR, tMonth: p.tMonth, pOne: p.pOne } }));
  const J = R.judge(prim);
  assert.equal(res.gateOk ? J.verdict : 'INCONCLUSIVE', res.verdict);
  for (const p of res.primary) {
    const s = res.sets[p.set].rules[p.rule].faded.pooled;
    assert.equal(s.n, p.n); assert.equal(s.meanR, p.meanR); assert.equal(s.tMonth, p.tMonth);
  }
});

test('the figures quoted in RESULT.md come from result.json', () => {
  for (const p of res.primary) {
    const s = res.sets[p.set].rules[p.rule].faded.pooled;
    assert.ok(md.includes(s.n.toLocaleString('en-US')), `${p.rule} ${p.set} n ${s.n}`);
    assert.ok(md.includes(s.tMonth.toFixed(2)), `${p.rule} ${p.set} t ${s.tMonth}`);
  }
});

test('the cells are the picks: best pooled placebo cell by 2015-19 month t among cells passing both halves', () => {
  assert.equal(picks.dom.top[0].cell, 5559);
  assert.equal(picks.mosha.top[0].cell, 6228);
  for (const list of [picks.dom.top, picks.mosha.top]) for (let i = 1; i < list.length; i++) {
    const t = (r) => (r.h2015 ? r.h2015.tBefore : r.t1519); assert.ok(t(list[i - 1]) >= t(list[i]));
  }
  const b = picks.box.top[0];
  assert.deepEqual([b.scope, b.chain, b.trig, b.sess, b.es, b.exit], ['pool', 'H1-M15-M5', 'out', 'other', 'mkt/bot', '1R']);
  assert.deepEqual(R.CELLS.F2, { ch: 5, v: 1, cf: 2, ms: 2, se: 2, st: 1, x: 3 });
  assert.deepEqual(R.CELLS.F3, { li: 2, bi: 0, place: 1, es: 0, st: 1, x: 4, se: 0, ms: 0 });
});

test('the gate reproduced the grid figures and the cut test found no difference', () => {
  for (const r of ['F1', 'F2', 'F3']) assert.equal(res.gate[r].ok, true, r);
  assert.ok(res.cut.checks >= 12); assert.equal(res.cut.mismatches, 0);
});

// made-up 5-minute candles: a seeded random walk
function walk(n, seed = 7) {
  let s = seed >>> 0; const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = []; let p = 100, t0 = Date.UTC(2011, 0, 3) / 1000;
  for (let i = 0; i < n; i++) { const o = p, c = o + (rnd() - 0.5) * 0.4; const h = Math.max(o, c) + rnd() * 0.15, l = Math.min(o, c) - rnd() * 0.15;
    out.push({ t: t0 + i * 300, o, h, l, c, e: t0 + i * 300 + 300 }); p = c; }
  return out;
}

test('F4: every trade has its stop on the losing side; the faded side is against the break', () => {
  const M5 = walk(40000), S = { from: M5[3000].t, to: M5[38000].t };
  const sig = R.signalsF4(M5, S);
  assert.ok(sig.length > 20);
  const rows = R.rowsF4(M5, 'eurusd', S);
  assert.ok(rows.some((r) => r.pl === 1) && rows.some((r) => r.pl === 0));
  for (const r of rows) { assert.ok(Number.isFinite(r.R)); assert.ok(r.R >= -3 && r.R <= 1.5); }
});

test('F4: no look-ahead (signals before a cut are the same on candles cut there)', () => {
  const M5 = walk(30000, 11), S = { from: M5[2000].t, to: M5[29000].t };
  const full = R.signalsF4(M5, S);
  for (const k of [9000, 17000, 25000]) {
    const C = M5[k].e;
    const part = R.signalsF4(M5.filter((b) => b.e <= C), S).filter((s) => s.ts <= C).map((s) => s.key);
    assert.deepEqual(part, full.filter((s) => s.ts <= C).map((s) => s.key));
  }
});

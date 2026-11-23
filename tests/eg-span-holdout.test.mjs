// tests/eg-span-holdout.test.mjs - research/edge/eg-span-holdout: no look-ahead on a seeded market, the target table put back,
// the placebo, and RESULT.md pinned to result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { RR } from '../council/eg-methods.mjs';
import { frames, runOnce, placebo, DESK_RR, monthT, welch } from '../research/edge/eg-span-holdout/run.mjs';

const DIR = new URL('../research/edge/eg-span-holdout/', import.meta.url);
const T0 = Date.UTC(2012, 0, 2) / 1000;
function m5(n, seed, t0 = T0, px0 = 1500) {
  const R = K.rng(seed), out = []; let px = px0;
  for (let i = 0; i < n; i++) { const t = t0 + i * 300; const o = px, c = o + (R() - 0.5) * 3, h = Math.max(o, c) + R() * 1.2, l = Math.min(o, c) - R() * 1.2;
    out.push({ t, o, h, l, c, e: t + 300 }); px = c; }
  return out;
}
const daily = (M5) => K.resample(M5, 86400);
const key = (r) => ({ kind: r.kind, side: r.side, t: r.t, entry: r.entry, stop: r.stop, target: r.target, R: r.R, endT: r.endT });

test('the desk targets used are the desk table of council/eg-methods.mjs, and a run puts RR back', () => {
  for (const [k, v] of Object.entries(DESK_RR)) assert.equal(RR[k], v, k);
  const before = JSON.stringify(RR);
  const M5 = m5(12000, 5); runOnce(frames(M5, daily(M5)), { market: 'xau', from: 0, span: 'next', target: 2 });
  assert.equal(JSON.stringify(RR), before);
});

test('cut test: trades filled and ended before a cut do not change when every later candle is replaced', () => {
  const M5 = m5(16000, 7);
  let seen = 0;
  for (const cutI of [9000, 12500]) {
    const cutT = M5[cutI].t;
    const later = m5(M5.length - cutI, 99, cutT, M5[cutI - 1].c);
    const M5b = M5.slice(0, cutI).concat(later);
    for (const span of ['next', 'any']) for (const target of ['desk', 2]) {
      const a = runOnce(frames(M5, daily(M5)), { market: 'xau', from: 0, span, target }).filter((r) => r.endT != null && r.endT + 300 <= cutT).map(key);
      const b = runOnce(frames(M5b, daily(M5b)), { market: 'xau', from: 0, span, target }).filter((r) => r.endT != null && r.endT + 300 <= cutT).map(key);
      assert.deepEqual(b, a, `${span} ${target} cut ${cutI}`); seen += a.length;
    }
  }
  assert.ok(seen > 10, 'the seeded market gives trades: ' + seen);
});

test('placebo: the same fill candle and entry, the other side, the same stop distance and target in R', () => {
  const M5 = m5(16000, 7), B = frames(M5, daily(M5));
  const T = runOnce(B, { market: 'xau', from: 0, span: 'any', target: 'desk' }).filter((r) => r.status !== 'open');
  assert.ok(T.length > 5);
  let mirrored = 0;
  for (const r of T) { const p = placebo(r, B['5m']); if (!p) continue;
    assert.ok(p.R >= -1.5 && p.R <= 4.0001, 'placebo R inside its stop and target');
    if (r.kind === 'eg-plan' && (r.status === 'target' || r.status === 'stopped') && Math.abs(p.R + r.R) < 1e-9) mirrored++; }
  assert.ok(mirrored > 0, 'with a 1R target a flipped trade mostly mirrors the real one');
});

test('month-sum t counts empty months; Welch difference has the right sign', () => {
  const a = Date.UTC(2015, 0, 1) / 1000, b = Date.UTC(2015, 3, 1) / 1000;
  const rows = [{ t: a + 10, R: 1 }, { t: a + 40 * 86400, R: 1 }, { t: a + 70 * 86400, R: 2 }];
  assert.ok(monthT(rows, 'R', a, b) > 0);
  assert.equal(monthT([{ t: a + 10, R: 1 }], 'R', a, b), monthT([{ t: a + 10, R: 1 }], 'R', a, b));
  const w = welch([1, 2, 3, 2], [0, 1, 0, 1]); assert.ok(w.diff > 0 && w.t > 0);
});

test('RESULT.md is pinned to result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').split('\n');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.equal(md[2], `**Verdict: ${R.verdict}. ${R.headline}**`);
  assert.equal(R.tests.length, 3);
  for (const t of R.tests) { assert.ok(md.join('\n').includes(t.id)); if (t.pass) assert.ok(t.holm < 0.05); }
  assert.equal(R.verdict === 'PASS', R.tests.some((t) => t.pass));
  for (const k of ['eg-plan-n@desk', 'eg-simple-n@desk', 'eg-plan@desk', 'eg-simple@desk']) {
    const s = R.streams[k]; assert.ok(md.join('\n').includes(String(s.confirmation.n)), k + ' n in RESULT.md'); }
});

// grid7-msnr-filter: the report pinned to result.json, and the study's pieces on hand-made candles (offline, no cache)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, '..', 'research', 'edge', 'grid7-msnr-filter');

test('grid7-msnr-filter: RESULT.md line 3 states the verdict and headline of result.json', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8').split('\n');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(r.verdict));
  assert.equal(md[2], `**Verdict: ${r.verdict}. ${r.headline}.**`);
  assert.equal(r.cells.length, 18);
  assert.deepEqual(r.passed, r.cells.filter((c) => c.pass).map((c) => c.cell));
  for (const c of r.cells) assert.equal(c.pass, Object.values(c.checks).every(Boolean));
  if (r.verdict === 'PASS') assert.ok(r.passed.length > 0); else assert.equal(r.passed.length, 0);
  assert.equal(r.markets.length, 10);
  for (const m of r.assumedCosts) assert.match(fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8'), new RegExp(m));
  // the cut test found no look-ahead
  assert.ok(r.cut.length >= 10);
  for (const x of r.cut) { assert.equal(x.missing, 0); assert.equal(x.extra, 0); }
});

test('grid7-msnr-filter: the pre-registration came first and names the 18 cells', () => {
  const p = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  assert.match(p, /18 judged cells/);
  assert.match(p, /Holm/);
});

test('grid7-msnr-filter: cells, signals and stops on hand-made candles', async () => {
  const M = await import('../research/edge/grid7-msnr-filter/run.mjs');
  for (let c = 0; c < M.NCELL; c++) { const n = M.cellName(c); assert.equal(M.cellIndex(n.l, n.tr, n.x), c); }
  // a deterministic 5-minute walk, about 30 days
  let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const M5 = []; let px = 100; const t0 = Date.UTC(2020, 0, 6) / 1000;
  for (let i = 0; i < 30 * 288; i++) { const t = t0 + i * 300, o = px; px = Math.max(1, px + (rnd() - 0.5) * 0.4 + Math.sin(i / 400) * 0.05);
    M5.push({ t, o, h: Math.max(o, px) + rnd() * 0.1, l: Math.min(o, px) - rnd() * 0.1, c: px, e: t + 300 }); }
  const { frames } = await import('../research/edge/combo-grid-3/run.mjs');
  const sigs = M.signals(frames(M5));
  assert.ok(sigs.length > 100);
  for (const g of sigs) {
    assert.ok([1, -1].includes(g.d)); assert.ok([-1, 0, 1].includes(g.call));
    // the swing point lies on the losing side of the trigger candle's close, the extreme on the winning side
    assert.ok(g.d > 0 ? g.swing < g.ext : g.swing > g.ext);
  }
  // signals known by a cut date are the same on candles cut there (no look-ahead)
  const T = t0 + 20 * 86400 + 3600 * 7;
  const key = (g) => [g.l, g.tr, g.tt, g.d, g.swing, g.call, g.age].join('|');
  const full = new Set(sigs.filter((g) => g.ts <= T).map(key));
  const cut = new Set(M.signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key));
  assert.deepEqual([...cut].sort(), [...full].sort());
});

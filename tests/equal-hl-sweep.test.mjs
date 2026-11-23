// tests/equal-hl-sweep.test.mjs - research/edge/equal-hl-sweep (offline): the event rules on hand-made candles, the cell map,
// no look-ahead on a cut, and RESULT.md pinned to result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { events, dailyAtrE, cellName, sweepCell, breakCell, NCELL, NS } from '../research/edge/equal-hl-sweep/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/equal-hl-sweep');
const T0 = 1_500_000_000;

function bars(n, patch) {
  const B = []; for (let i = 0; i < n; i++) { const t = T0 + 30 * 86400 + i * 900; B.push({ t, o: 100, h: 100.5, l: 99.5 + i * 0.001, c: 100, e: t + 900 }); }
  for (const [i, p] of Object.entries(patch)) Object.assign(B[+i], p); return B;
}
const days = () => Array.from({ length: 20 }, (_, i) => ({ t: T0 + i * 86400, h: 101, l: 99, e: T0 + (i + 1) * 86400 }));   // daily ATR 2, tol 0.2
const F = (B) => ({ '15m': B, '1h': [], '1d': days() });

test('a wick through two equal lows that closes back is a sweep of a 2-swing pool', () => {
  const ev = events(F(bars(40, { 10: { l: 99.0 }, 20: { l: 99.05 }, 30: { l: 98.9, c: 99.6 } })));
  assert.equal(ev.length, 1); const g = ev[0];
  assert.equal(g.type, 'sweep'); assert.equal(g.grp, 2); assert.equal(g.side, 1); assert.equal(g.L, 99.0); assert.equal(g.ext, 98.9); assert.equal(g.k, 30);
  assert.equal(g.edge, 100.5);
});

test('a close beyond the pool is a break; the close back on the next candle still decides within two', () => {
  const br = events(F(bars(40, { 10: { l: 99.0 }, 20: { l: 99.05 }, 30: { l: 98.9, c: 98.95 } })));
  assert.equal(br.length, 1); assert.equal(br[0].type, 'break');
  const late = events(F(bars(40, { 10: { l: 99.0 }, 20: { l: 99.05 }, 30: { l: 98.9, c: 99.0 }, 31: { l: 99.0, c: 99.4 } })));
  assert.equal(late.length, 1); assert.equal(late[0].type, 'sweep'); assert.equal(late[0].k, 31);
});

test('one swing alone is the control; unequal swings are in neither group', () => {
  const one = events(F(bars(40, { 20: { l: 99.0 }, 30: { l: 98.9, c: 99.6 } })));
  assert.equal(one.length, 1); assert.equal(one[0].grp, 'single');
  const far = events(F(bars(40, { 10: { l: 98.0 }, 11: { l: 99.3 }, 20: { l: 99.0 }, 30: { l: 97.9, c: 99.6 } })));
  assert.equal(far.filter((g) => g.k === 30).length, 0);
});

test('events known by a cut equal the full run (no look-ahead)', () => {
  const B = bars(60, { 10: { l: 99.0 }, 20: { l: 99.05 }, 30: { l: 98.9, c: 99.6 }, 45: { h: 101.2 }, 52: { h: 101.25, c: 100.4 } });
  const full = events(F(B));
  for (const cut of [31, 40, 53, 60]) { const T = B[cut - 1].e;
    assert.deepEqual(events(F(B.slice(0, cut))).filter((g) => g.ts <= T), full.filter((g) => g.ts <= T)); }
});

test('daily ATR reads only days that ended by the close', () => {
  const D = days(); assert.equal(dailyAtrE(D, D[13].e - 1), null); assert.equal(dailyAtrE(D, D[13].e), 2);
});

test('48 cells, each named once', () => {
  assert.equal(NCELL, 48); const names = new Set(Array.from({ length: NCELL }, (_, i) => cellName(i).name)); assert.equal(names.size, 48);
  assert.equal(cellName(sweepCell(1, 1, 2, 2)).name, 'sweep h1 pool 3+ other range'); assert.equal(cellName(breakCell(0, 0, 1)).name, 'break m15 pool 2 all 2R');
  assert.equal(breakCell(0, 0, 0), NS);
});

test('RESULT.md is pinned to result.json', { skip: !fs.existsSync(path.join(DIR, 'result.json')) }, () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8').split('\n');
  assert.equal(md[2], `**Verdict: ${r.verdict}. ${r.headline}.**`);
  assert.match(r.verdict, /^(PASS|FAIL|INCONCLUSIVE)$/);
  assert.equal(r.cells.length, 48);
  assert.deepEqual(r.passed, r.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.equal(r.verdict === 'PASS', r.passed.length > 0);
  for (const c of r.cells) if (c.pass) assert.ok(c.disc.n >= 300 && c.conf.n >= 300 && c.disc.t >= 2 && c.conf.t >= 2 && c.welchDisc >= 2 && c.welchConf >= 2 && c.holm < 0.05);
  for (const name of r.passed) assert.ok(Array.isArray(r.perMarket[name]));
  for (const x of r.cut) assert.equal(x.missing + x.extra, 0);
});

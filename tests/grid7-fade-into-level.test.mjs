// tests/grid7-fade-into-level.test.mjs - offline checks of research/edge/grid7-fade-into-level (the places, no look-ahead in the
// Daily levels, the cell map, and RESULT.md pinned to result.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { placeOf, classify, cellIndex, cellName, NCELL, dailyLevels } from '../research/edge/grid7-fade-into-level/run.mjs';

const DIR = new URL('../research/edge/grid7-fade-into-level/', import.meta.url);

test('places: into, through, clear, both directions', () => {
  // up break at 100, Daily ATR 5: supply 103-104 ahead = into; 98-99 crossed = through; 106-107 too far = clear; inside = into
  assert.equal(placeOf(1, 100, 5, 103, 104), 0);
  assert.equal(placeOf(1, 100, 5, 99, 101), 0);
  assert.equal(placeOf(1, 100, 5, 98, 99), 1);
  assert.equal(placeOf(1, 100, 5, 106, 107), 2);
  assert.equal(placeOf(1, 100, 5, 90, 94), 2);
  // down break mirrors
  assert.equal(placeOf(-1, 100, 5, 96, 97), 0);
  assert.equal(placeOf(-1, 100, 5, 101, 102), 1);
  assert.equal(placeOf(-1, 100, 5, 93, 94), 2);
});

test('cell map is one to one', () => {
  const seen = new Set();
  for (let tf = 0; tf < 2; tf++) for (let k = 0; k < 5; k++) for (let pl = 0; pl < 3; pl++) for (let x = 0; x < 2; x++) {
    const i = cellIndex(tf, k, pl, x); assert.ok(i >= 0 && i < NCELL); seen.add(i);
    const n = cellName(i); assert.equal(cellIndex(['m15', 'h1'].indexOf(n.tf), ['eg', 'dom', 'av', 'pd', 'any'].indexOf(n.set), ['into', 'through', 'clear'].indexOf(n.place), ['2R', 'swing'].indexOf(n.exit)), i);
  }
  assert.equal(seen.size, NCELL);
});

// a seeded Daily series (17:00 New York closes every 86400 s)
function seeded(n, seed = 3) { let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const out = []; let px = 100;
  for (let i = 0; i < n; i++) { const o = px, c = o + (r() - 0.5) * 3, h = Math.max(o, c) + r(), l = Math.min(o, c) - r(); const t = 1e9 + i * 86400;
    out.push({ t, o, h, l, c, e: t + 86400 }); px = c; } return out; }

test('no look-ahead: places at a time ignore Daily candles after it', () => {
  const D = seeded(400); const sigs = [];
  for (let i = 30; i < 390; i += 7) { const ts = D[i].e + 3600; sigs.push({ ts, d: i % 2 ? 1 : -1, close: D[i].c + (i % 3) - 1 }); }
  const full = classify(sigs, D);
  for (const cut of [120, 250, 380]) {
    const T = D[cut].e; const Dc = D.filter((b) => b.e <= T + 3600 * 5); const S = sigs.filter((g) => g.ts <= T + 3600 * 5);
    // a signal's level set must not change when later candles are removed (levels known after it never count)
    const part = classify(S, Dc.slice(0, Dc.length));
    S.forEach((g, j) => assert.deepEqual(part[j], full[sigs.indexOf(g)], `cut ${cut} signal ${j}`));
  }
  for (const z of dailyLevels(D)) assert.ok(z.at <= z.end && z.top >= z.bot);
});

test('RESULT.md headline and figures match result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').split('\n');
  assert.equal(md[2], `**Verdict: ${R.verdict}. ${R.headline}.**`);
  assert.match(R.verdict, /^(PASS|FAIL|INCONCLUSIVE)$/);
  assert.equal(R.tests.length, 20); assert.equal(R.cells.length, 60);
  assert.equal(R.verdict === 'PASS', R.passed.length > 0 && R.gateOk);
  assert.ok(R.gateOk, 'gate: the three places of "any" reproduce grid7-wide-fade');
  for (const t of R.tests) assert.equal(t.pass, t.checks.n && t.checks.disc && t.checks.conf && t.checks.holm);
  assert.ok(R.cut.length >= 5 && R.cut.every((c) => c.missing === 0 && c.extra === 0));
  for (const t of R.tests) assert.ok(md.some((l) => l.startsWith(`| ${t.test} |`)), t.test);
});

// tests/fade-time-exits.test.mjs - the fade over time: pre-registration, RESULT.md agrees with result.json, the verdict
// follows the bar, and the mark engine on hand-made candles (stop first, gap, a mark across a weekend, no look-ahead). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { marksOf, MARKS, TEX, pipOf } from '../research/edge/fade-time-exits/run.mjs';

const DIR = new URL('../research/edge/fade-time-exits/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the rule, the marks, the bar and the assumed costs', () => {
  for (const w of ['m15 none atr', '5, 15, 30, 60, 120, 240 minutes and 1 day', '15, 30, 60 and 240 minutes', 'stop first',
    '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'over the 4', 'ASSUMED', 'BEFORE costs', 'm5 none atr', 'h1 none atr'])
    assert.ok(pre.includes(w), w);
  assert.deepEqual(MARKS, [5, 15, 30, 60, 120, 240, 1440]); assert.deepEqual(TEX, [15, 30, 60, 240]);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.timeExits.length, 4);
  for (const c of R.timeExits) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.exit);
  }
  const n = R.timeExits.filter((c) => c.pass).length;
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : n ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.timeExits.filter((c) => c.pass).map((c) => c.exit));
});

test('RESULT.md carries every time exit row of result.json', () => {
  for (const c of R.timeExits) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.exit} |`));
    assert.ok(row, c.exit);
    assert.ok(row.includes(`${f3(c.disc.mean)} (${c.disc.t.toFixed(2)})`), c.exit + ' disc');
    assert.ok(row.includes(`${f3(c.conf.mean)} (${c.conf.t.toFixed(2)})`), c.exit + ' conf');
    assert.ok(row.endsWith(c.pass ? '| yes |' : '| no |'));
  }
  for (const c of R.curve) assert.ok(md.includes(`### ${c.tf} none atr`), c.tf);
  assert.equal(R.cut.reduce((a, c) => a + c.marks.diff + c.grid.reduce((s, x) => s + x.missing + x.extra, 0), 0), 0, 'cut tests clean');
});

// hand-made 5m candles: t, o, h, l, c, e
const mk = (rows, t0 = 1_700_000_100 - (1_700_000_100 % 300)) => rows.map((r, i) => ({ t: r[4] ?? t0 + i * 300, o: r[0], h: r[1], l: r[2], c: r[3], e: (r[4] ?? t0 + i * 300) + 300 }));

test('marks: price at the open after X minutes; a stop first counts at the stop', () => {
  // buy at 100, stop 99: rises, then the 4th candle touches the stop
  const B = mk([[100, 100.5, 99.8, 100.4], [100.4, 101, 100.3, 100.9], [100.9, 101, 100.5, 100.6], [100.6, 100.7, 98.9, 99.2], ...Array.from({ length: 400 }, () => [99.2, 99.5, 99, 99.3])]);
  const m = marksOf(B, 1, 0, 99, [5, 15, 30]);
  assert.ok(Math.abs(m.R[0] - 0.4) < 1e-9);   // open of candle 1
  assert.ok(Math.abs(m.R[1] - 0.6) < 1e-12);   // open of candle 3 (the stop is touched inside candle 3, after the mark)
  assert.ok(Math.abs(m.R[2] + 1) < 1e-12);             // stopped in candle 3, before the 30-minute mark
  // sell at 100, stop 101, gap through the stop at the open of candle 2
  const G = mk([[100, 100.2, 99.9, 100], [100, 100.4, 99.8, 100.3], [101.5, 101.8, 101.2, 101.6], ...Array.from({ length: 300 }, () => [101.6, 101.7, 101.5, 101.6])]);
  const g = marksOf(G, -1, 0, 101, [5, 15, 1440]);
  assert.ok(Math.abs(g.R[0] - 0) < 1e-12); assert.ok(Math.abs(g.R[1] + 1.5) < 1e-12); assert.ok(Math.abs(g.R[2] + 1.5) < 1e-12);
});

test('marks: across a gap in the data the mark is the next candle that opens; data end = null', () => {
  const t0 = 1_700_100_000 - (1_700_100_000 % 300);
  const B = mk([[100, 100.2, 99.9, 100, t0], [100, 100.3, 99.95, 100.2, t0 + 300], [100.8, 101, 100.7, 100.9, t0 + 48 * 3600]]);
  const m = marksOf(B, 1, 0, 99, [60]); assert.ok(Math.abs(m.R[0] - 0.8) < 1e-12);
  assert.equal(marksOf(B, 1, 0, 99, [60, 4000 * 60]), null);
});

test('marks read nothing after the mark candle, and only its open', () => {
  const B = mk(Array.from({ length: 600 }, (_, i) => { const p = 100 + Math.sin(i / 7) * 0.6; return [p, p + 0.2, p - 0.2, p + 0.05]; }));
  const full = marksOf(B, 1, 0, 99, MARKS);
  MARKS.forEach((x, k) => { const j = B.findIndex((b) => b.t >= B[0].t + x * 60);
    const cut = B.slice(0, j + 1).map((b) => ({ ...b })); const last = cut[cut.length - 1]; last.h = 1e9; last.l = -1e9; last.c = NaN;
    assert.equal(marksOf(cut, 1, 0, 99, [x]).R[0], full.R[k], String(x)); });
});

test('pips', () => { assert.equal(pipOf('xau'), 0.1); assert.equal(pipOf('usdjpy'), 0.01); assert.equal(pipOf('eurusd'), 0.0001); });

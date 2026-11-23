// tests/dom-sd-choch-wide.test.mjs - zones confirmed by a change of character: pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, the ChoCh search and the trade engine on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exits, chochFrom, swingLevels, cellIndex, cellName, NCELL } from '../research/edge/dom-sd-choch-wide/run.mjs';

const DIR = new URL('../research/edge/dom-sd-choch-wide/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the bar, the controls and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['48', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', 'placebo', 'MSNR', 'change of character',
    'ChoCh, no zone', 'touch, no ChoCh', 'trade-through']) assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.cells.length, 48);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05
      && c.vsChoch.d >= 2 && c.vsChoch.c >= 2 && c.vsTouch.d >= 2 && c.vsTouch.c >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  const enough = R.cells.filter((c) => c.disc.n >= 300 && c.conf.n >= 300).length;
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : enough < 12 ? 'INCONCLUSIVE' : 'FAIL');
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
});

test('RESULT.md lists every cell with its figures from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} | ${Math.round(c.disc.n).toLocaleString('en-US')} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(`${f3(c.disc.mean)} (${c.disc.t.toFixed(2)})`), c.cell + ' disc');
    assert.ok(row.includes(`${f3(c.conf.mean)} (${c.conf.t.toFixed(2)})`), c.cell + ' conf');
  }
});

test('the cut test found nothing that a cut series would not know', () => {
  assert.ok(R.cut.length >= 10);
  assert.ok(R.cut.every((x) => x.n > 0));
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

test('cells index correctly', () => {
  const seen = new Set();
  for (let i = 0; i < NCELL; i++) { const n = cellName(i); assert.equal(cellIndex(n.f, n.z, n.e, n.x), i); seen.add(i); }
  assert.equal(seen.size, 48);
});

test('the ChoCh: first close above the last swing high known by the previous close; far-side close cancels', () => {
  const bar = (t, h, l, c) => ({ t, o: c, h, l, c, e: t + 900 });
  // a fall into a demand zone with a lower swing high at index 4 (3 a side), then a close above it at index 12
  const hs = [20, 17, 16, 15, 18.5, 17, 16, 15, 14, 13.5, 14, 15, 19.2, 20];
  const T = hs.map((h, i) => bar(i * 900, h, h - 1, h - 0.5));
  const { H, L } = swingLevels(T);
  assert.equal(H[7], null, 'the swing at 4 is known only at the close of 7');
  assert.equal(H[8], 18.5);
  const zone = { bot: 12, top: 14, end: Infinity };
  const r = chochFrom(T, H, L, 1, 9, zone);
  assert.equal(r.j, 12); assert.equal(r.level, 18.5); assert.equal(r.ext, 12.5);
  // a close below the zone's bottom first: no trade
  const T2 = T.map((b) => ({ ...b })); T2[10] = bar(T2[10].t, 12, 10, 11);
  assert.equal(chochFrom(T2, H, L, 1, 9, zone), null);
});

test('the trade engine: stop first, gaps at the open, struct target, limit fill candle stop only', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  // buy at 100, stop 99: candle 1 reaches both 101 and 99 -> stop
  let M = [bar(0, 100, 100.2, 99.8, 100), bar(300, 100, 101.5, 98.9, 100)];
  assert.deepEqual(exits(M, 1, 0, 100, 99, [101, 102, null], 86400, true).slice(0, 2), [-1, -1]);
  // gap through the target at the open
  M = [bar(0, 100, 100.2, 99.8, 100), bar(300, 102.5, 103, 102.4, 102.8)];
  const r = exits(M, 1, 0, 100, 99, [101, 102, 101.5], 86400, true);
  assert.deepEqual(r, [2.5, 2.5, 2.5]);
  // limit fill candle: its high does not count, only the stop
  M = [bar(0, 100, 101.2, 99.9, 100.5), bar(300, 100.5, 100.6, 98.5, 99)];
  assert.deepEqual(exits(M, 1, 0, 100, 99, [101, 102, null], 86400, false).slice(0, 2), [-1, -1]);
  assert.ok(Number.isNaN(exits(M, 1, 0, 100, 99, [101, 102, null], 86400, false)[2]));
});

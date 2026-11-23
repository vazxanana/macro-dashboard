// tests/grid7-ltf-ef.test.mjs - the failed engulf grid: pre-registration, RESULT.md agrees with result.json, the verdict follows
// the bar, the 54 judged cells, and the signals on hand-made candles (the EF side, the stop on the losing side, no look-ahead).
// Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, cellName, cellA, cellB, controlOf, NA, NB } from '../research/edge/grid7-ltf-ef/run.mjs';

const DIR = new URL('../research/edge/grid7-ltf-ef/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the bar, the control and the assumed costs', () => {
  for (const w of ['54', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'Welch', 'grid7-wide-fade', 'BEFORE costs', 'K = **3, 6, 12**'])
    assert.ok(pre.includes(w), w);
});

test('the 54 judged cells and 18 reported rows are distinct and as pre-registered', () => {
  const names = Array.from({ length: NA + NB }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 72);
  assert.equal(cellName(cellA(1, 2, 1, 2)).name, 'm15 K12 brk proj');
  assert.equal(cellName(cellB(2, 0, 0)).name, 'h1 with-EG none 1R');
  assert.equal(cellName(controlOf(cellA(0, 0, 0, 2))).name, 'm5 fade none ext swing');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
  assert.equal(R.cells.filter((c) => c.part === 'a').length, 54);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  for (const c of R.cells) {
    const ok = c.part === 'a' && c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05
      && c.welchDisc >= 2 && c.welchConf >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  const passed = R.cells.filter((c) => c.pass).map((c) => c.cell);
  assert.deepEqual(R.passed, passed);
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : passed.length ? 'PASS' : 'FAIL');
});

test('every judged cell is in RESULT.md with its figures', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.mean)), c.cell + ' conf'); assert.ok(row.includes(f3(c.disc.mean)), c.cell + ' disc');
  }
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, JSON.stringify(x));
});

// hand-made H1 frame: a buy engulf (red base, green close above its high), then a close below the base's low two candles later
const H = 3600;
const bar = (i, o, h, l, c) => ({ t: i * H, e: (i + 1) * H, o, h, l, c });
function frame(list) { const T = list.map((b, i) => bar(i, ...b)); return { '5m': [], '15m': [], '1h': T }; }
const base = [];
for (let i = 0; i < 30; i++) base.push([100 + (i % 2), 101.5 + (i % 2), 99.5 + (i % 2), 100.5 + (i % 2)]);
const seq = [...base, [101, 101.2, 99.8, 100], [100, 101.8, 99.9, 101.6], [101.6, 101.7, 100.4, 100.6], [100.6, 100.7, 99.2, 99.4]];

test('the failed engulf: other side, stop past the base-to-fail extreme, the projection, no look-ahead', () => {
  const S = signals(frame(seq)).filter((g) => g.tf === 2);
  const ef = S.filter((g) => g.kind === 'ef'), eg = S.filter((g) => g.kind === 'eg');
  const e = ef.find((g) => g.ts === 34 * H); assert.ok(e, 'EF at the close of the failing candle');
  assert.equal(e.s, -1); assert.equal(e.n, 2);
  assert.ok(e.stop > 101.8, 'stop above the highest high between base and fail'); assert.ok(Math.abs(e.tg - (99.8 - 1.4)) < 1e-9, 'proj');
  const w = eg.find((g) => g.ts === 32 * H); assert.ok(w && w.s === 1 && w.stop < 99.8, 'with-EG at completion, stop below the base');
  // cut before the failure: no EF signal, same with-EG signal
  const cut = signals(frame(seq.slice(0, 33))).filter((g) => g.tf === 2);
  assert.ok(!cut.some((g) => g.kind === 'ef' && g.ts === 34 * H));
  assert.ok(cut.some((g) => g.kind === 'eg' && g.ts === 32 * H && g.stop === w.stop));
});

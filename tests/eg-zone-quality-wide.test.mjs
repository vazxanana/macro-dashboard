// tests/eg-zone-quality-wide.test.mjs - which engulf zones hold: the pre-registration, RESULT.md agrees with result.json, the
// verdict follows the bar, the cut test, and the visits / entries / labels on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { entriesOf, levelsOf, bandOf, streamIndex, streamName, NCELL, NL, LEVELS } from '../research/edge/eg-zone-quality-wide/run.mjs';

const DIR = new URL('../research/edge/eg-zone-quality-wide/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));

test('pre-registration names the qualities, the windows, the bar, the control and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', '112 cells', '48 tests', '160',
    'Q1 span', 'Q2 height', 'Q3 move away', 'Q4 at a level', 'Q5 return', 'Q6 Daily MSNR call', 'random band', 'fade'])
    assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.cells.length, 112); assert.equal(R.splits.length, 48);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05
      && c.vsControl != null && c.vsControl >= 2;
    assert.equal(c.pass, ok, c.stream + ' ' + c.level);
  }
  for (const s of R.splits) assert.equal(s.pass, s.welchT != null && s.welchT >= 2 && s.holm < 0.05 && s.ctlZ != null && s.ctlZ >= 1, s.stream + s.quality);
  const any = R.cells.some((c) => c.pass) || R.splits.some((s) => s.pass);
  const thin = R.cells.filter((c) => c.level === 'all').every((c) => c.conf.n < 300);
  assert.equal(R.verdict, thin ? 'INCONCLUSIVE' : any ? 'PASS' : 'FAIL');
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
});

test('RESULT.md lists every cell and split with its figures from result.json', () => {
  const lines = md.split('\n');
  for (const c of R.cells) {
    const row = lines.find((l) => l.startsWith(`| ${c.stream} | ${c.level} |`)); assert.ok(row, c.stream + ' ' + c.level);
    assert.ok(row.includes(`${f3(c.disc.mean)} (${f2(c.disc.t)})`), c.stream + c.level + ' disc');
    assert.ok(row.includes(`${f3(c.conf.mean)} (${f2(c.conf.t)})`), c.stream + c.level + ' conf');
  }
  for (const s of R.splits) { const row = lines.find((l) => l.startsWith(`| ${s.stream} | ${s.quality} |`)); assert.ok(row, s.stream + s.quality);
    assert.ok(row.includes(`| ${f2(s.welchT)} |`), s.stream + s.quality + ' t'); }
});

test('the cut test found nothing that a cut series would not know', () => {
  assert.ok(R.cut.length >= 10);
  assert.ok(R.cut.every((x) => x.n > 0));
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

test('cells index the eight streams and fourteen levels', () => {
  assert.equal(NCELL, 112); assert.equal(NL, LEVELS.length);
  const names = new Set(); for (let st = 0; st < 2; st++) for (let l = 0; l < 2; l++) for (let x = 0; x < 2; x++) names.add(streamName(streamIndex(st, l, x)));
  assert.equal(names.size, 8); assert.ok(names.has('with 1d 1R') && names.has('fade 4h 2R'));
  assert.deepEqual(levelsOf({ v: 1, span: 1, h: 0.3, mv: true, lvl: false, call: true }), [0, 1, 3, 6, 9, 10, 12]);
  assert.deepEqual(levelsOf({ v: 1, span: 3, h: 1.5, mv: false, lvl: true, call: false }), [0, 2, 5, 7, 8, 10, 13]);
  assert.deepEqual(levelsOf({ v: 2, span: 1, h: 0.7, mv: true, lvl: true, call: true }), [11]);
});

// a buy zone 100-102, ATR 1, known at t 0; T = 15-minute candles
const bar = (i, o, h, l, c) => ({ t: i * 900, o, h, l, c, e: (i + 1) * 900 });
const L = [{ h: 103, l: 100 }, { h: 104, l: 101 }];
const Z = { d: 1, bot: 100, top: 102, at: 0, i: 1, j: 0, end: Infinity, atr: 1 };

test('visits, entries, the fade extreme and the move-away label, on closed candles', () => {
  const T = [bar(0, 105, 106, 103, 104), bar(1, 104, 103.5, 101.5, 102.5), bar(2, 102.5, 102.5, 100.5, 101), bar(3, 103, 104, 103, 103.5),
    bar(4, 103.5, 103.6, 101, 101.5), bar(5, 101.5, 101.8, 100.2, 101.2)];
  const E = entriesOf(L, T, Z);
  assert.equal(E.length, 2);
  assert.deepEqual([E[0].v, E[0].q, E[0].ts, E[0].fx, E[0].mv], [1, 2, 2700, 103.5, true]);   // close inside on candle 2; fade stop over the touch-to-entry high
  assert.deepEqual([E[1].v, E[1].q], [2, 4]);
  // a close through the far side first: no entry, and no second visit
  const T2 = [bar(0, 103, 103.5, 102.5, 103), bar(1, 103, 103, 99, 99.5), bar(2, 99.5, 101, 99, 100.5)];
  assert.deepEqual(entriesOf(L, T2, { ...Z, j: 0, i: 0 }), []);
  // no move away: never above top + 2 ATR before the touch
  const T3 = [bar(0, 102.6, 103, 102.4, 102.8), bar(1, 102.8, 102.9, 100.8, 101.2)];
  const E3 = entriesOf([{ h: 102.5, l: 100 }, { h: 103, l: 101 }], T3, Z); assert.equal(E3.length, 1); assert.equal(E3[0].mv, false);
  // a candle that starts before the zone is known is never the touch
  assert.equal(entriesOf(L, T, { ...Z, at: 3 * 900 })[0].q, 4);
});

test('the control band keeps height and side, sits at 0.5-1.5x the distance, and is deterministic', () => {
  const LL = [{ h: 103, l: 100, c: 101, e: 1 }, { h: 106, l: 102, c: 105, e: 2 }];
  const z = { d: 1, bot: 100, top: 103, at: 2, i: 1, j: 0, end: Infinity, atr: 1, span: 1, h: 3, lvl: false };
  const b = bandOf(LL, z), b2 = bandOf(LL, z);
  assert.equal(+(b.top - b.bot).toFixed(9), 3); assert.equal(b.d, 1); assert.ok(b.ctl);
  const u = (105 - b.top) / (105 - 103); assert.ok(u >= 0.5 && u <= 1.5, String(u));
  assert.equal(b.top, b2.top);
});

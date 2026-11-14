// gotobi-minute-histdata: the frozen rule is gotobi-feed's frozen.mjs byte for byte, run.mjs re-implements none of its pieces,
// the HistData loader converts labels with council/histdata.mjs only, the M1 trade equals the frozen M5 trade at 00:55 on an
// aggregated path, the pre-registered gate and reading hold in result.json, and RESULT.md says what result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/gotobi-minute-histdata/frozen.mjs';
import * as R from '../research/edge/gotobi-minute-histdata/run.mjs';
import { histToUtc } from '../council/histdata.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gotobi-minute-histdata');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
// sha256 of research/edge/gotobi-feed/frozen.mjs on branch gotobi-feed (= gotobi-replicate's, = the gotobi study's run.mjs)
const FROZEN_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';
const res = JSON.parse(read('result.json'));

test('gotobi-minute-histdata: frozen.mjs is gotobi-feed\'s frozen.mjs byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA);
  assert.match(read('PREREGISTRATION.md'), new RegExp(FROZEN_SHA));
  assert.equal(res.frozen.sha256, FROZEN_SHA);
});

test('gotobi-minute-histdata: run.mjs takes the rule from frozen.mjs and the grid is the pre-registered one', () => {
  const src = read('run.mjs').replace(/\/\/[^\n]*/g, '');
  assert.match(read('run.mjs'), /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['trade', 'stopDist', 'windowMove', 'legTimes', 'costPx', 'gotobiSet', 'gotobiOfMonth', 'jpHolidays', 'tseHolidays', 'monthT', 'summary'])
    assert.doesNotMatch(src, new RegExp(`(function\\s+${fn}\\b|(const|let)\\s+${fn}\\s*=)`), `run.mjs defines ${fn}`);
  for (const k of ['22.5e-6', 'STOP_K =', 'LOOKBACK =']) assert.doesNotMatch(src, new RegExp(`(^|[^.\\w])${k}`, 'm'));
  assert.deepEqual(R.ENTRIES.map(R.hhmm), ['00:53', '00:54', '00:55', '00:56', '00:57', '00:58', '01:00']);
  assert.deepEqual([R.hhmm(R.BASE.entry), R.hhmm(R.BASE.exit)], ['00:55', '06:00']);
  assert.equal(R.GRACE_M1 * 60, F.EXIT_GRACE);
  assert.equal(R.FROM, '2018-01-01');
  const pre = read('PREREGISTRATION.md');
  for (const s of ['00:53, 00:54, **00:55 (base)**, 00:56, 00:57, 00:58, 01:00', 'n within 6 trades of 623', 'within 0.010R of +0.1265', 'at least 99 %', 'at least 0.020R above every other row', 'at 00:56 < 0.5 x net R a trade at 00:55', '"FEED-CONFIRMED"', '"FEED-DIFFERENT"'])
    assert.ok(pre.includes(s), s);
  assert.deepEqual([R.GATE.n, R.GATE.netR, R.GATE.nTol, R.GATE.rTol, R.GATE.openShare, R.GATE.lastDay], [623, 0.1265, 6, 0.010, 0.99, '2026-10-29']);
  assert.deepEqual([R.READ.margin, R.READ.lateShare], [0.020, 0.5]);
});

test('gotobi-minute-histdata: the loader converts HistData labels with council/histdata.mjs only', () => {
  const src = read('run.mjs');
  assert.match(src, /import \{ histStampUtc \} from '\.\.\/\.\.\/\.\.\/council\/histdata\.mjs'/);
  const code = src.replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /slice\(9, ?11\)|18000|5 ?\* ?3600|4 ?\* ?3600|nyOffset|Date\.UTC/, 'no clock of its own');
  // a European summer label -> +4 h, a winter label -> +5 h, 2018 is New York time; a later-day label is dropped
  const txt = ['20240715 205500;160.000;160.010;159.990;160.005;0', '20240115 195500;145.000;145.010;144.990;145.005;0',
    '20180315 205500;106.000;106.010;105.990;106.005;0', '20240715 120000;160.1;160.2;160.0;160.1;0', ''].join('\n');
  const rows = R.parseHist(txt);
  assert.deepEqual(rows.map((r) => r[0]), [histToUtc(2024, 7, 15, 20, 55), histToUtc(2024, 1, 15, 19, 55), histToUtc(2018, 3, 15, 20, 55)]);
  assert.equal(rows[0][0], Date.parse('2024-07-16T00:55:00Z') / 1000);
  assert.equal(rows[1][0], Date.parse('2024-01-16T00:55:00Z') / 1000);
  assert.equal(rows[2][0], Date.parse('2018-03-16T00:55:00Z') / 1000);
  assert.equal(R.parseHist(txt + '20240715 205500;1;1;1;1;0\n').length, 3, 'a repeated converted time is dropped');
});

// a deterministic M1 path over a few gotobi days and its M5 aggregation (the loader's own toM5)
function paths(seed, drift) {
  const rnd = F.mulberry32(seed), m1 = []; let px = 150;
  for (const d of ['2019-03-05', '2019-03-11', '2019-03-15', '2019-03-20', '2019-03-25']) {
    const day0 = Date.parse(d + 'T00:00:00Z') / 1000;
    for (let m = 0; m < 420; m++) {
      const o = px, c = o + (rnd() - 0.5) * 0.02 + drift; px = c;
      m1.push([day0 + m * 60, o, Math.max(o, c) + rnd() * 0.006, Math.min(o, c) - rnd() * 0.006, c]);
    }
  }
  return { m1, m5: R.toM5(m1) };
}

test('gotobi-minute-histdata: the M1 trade at 00:55 / 06:00 equals the frozen M5 trade on the same path', () => {
  let stops = 0, times = 0;
  for (const [seed, drift] of [[1, 0], [2, 0.004], [3, -0.004], [4, 0.008]]) {
    const { m1, m5 } = paths(seed, drift), i1 = F.index(m1), i5 = F.index(m5);
    for (const d of ['2019-03-05', '2019-03-11', '2019-03-15', '2019-03-20', '2019-03-25']) for (const D of [0.05, 0.15, 0.4, 2]) {
      const a = R.tradeM1(i1, d, D, 55, 360), b = F.trade(i5, 'fade', d, D);
      assert.ok(a && b);
      assert.equal(a.entry, b.entry); assert.equal(a.stop, b.stop);
      if (b.how === 'time') { times++; assert.equal(a.how, 'time'); assert.ok(Math.abs(a.net - b.net) < 1e-12); }
      else { stops++; assert.notEqual(a.how, 'time'); assert.ok(a.exit >= b.exit - 1e-12 || b.how === 'gap'); }
    }
  }
  assert.ok(stops > 0 && times > 0);
  const { m1 } = paths(5, 0), t = R.tradeM1(F.index(m1), '2019-03-05', 0.3, 58, 360);
  assert.equal(t.entry, m1.find((b) => b[0] === Date.parse('2019-03-05T00:58:00Z') / 1000)[1]);
  assert.ok(Math.abs(t.stop - t.entry - 0.3) < 1e-12);
  const hole = m1.filter((b) => b[0] !== Date.parse('2019-03-05T00:56:00Z') / 1000);
  assert.equal(R.tradeM1(F.index(hole), '2019-03-05', 0.3, 56, 360), null, 'no candle at the entry minute = no trade');
});

test('gotobi-minute-histdata: the reading rule', () => {
  const rows = (v) => ['00:53', '00:54', '00:55', '00:56', '00:57', '00:58', '01:00'].map((e, i) => ({ entry: e, netR: v[i] }));
  assert.equal(R.reading(rows([0.06, 0.07, 0.15, 0.05, 0.02, 0.01, 0.01])).word, 'FEED-CONFIRMED');
  const close = R.reading(rows([0.06, 0.14, 0.15, 0.05, 0.02, 0.01, 0.01]));
  assert.equal(close.word, 'FEED-DIFFERENT'); assert.equal(close.clearMax, false);
  const flat = R.reading(rows([0.06, 0.07, 0.15, 0.08, 0.02, 0.01, 0.01]));
  assert.equal(flat.word, 'FEED-DIFFERENT'); assert.equal(flat.lateHalf, false); assert.equal(flat.clearMax, true);
  assert.equal(R.reading(rows([-0.1, -0.1, -0.05, -0.2, -0.2, -0.2, -0.2])).word, 'FEED-DIFFERENT');
});

test('gotobi-minute-histdata: the pre-registered gate and reading hold in result.json', () => {
  const g = res.gate;
  assert.equal(g.lastDay, '2026-10-29');
  assert.equal(g.m5.n, 623); assert.equal(g.m5.netR, 0.1265);
  assert.ok(Math.abs(g.m1.n - 623) <= 6);
  assert.ok(Math.abs(g.m1.netR - 0.1265) <= 0.010);
  assert.ok(g.open.days > 600 && g.open.equal / g.open.days >= 0.99);
  assert.deepEqual(g.checks, { reproducesFeed: true, n: true, netR: true, open: true });
  assert.equal(g.pass, true);
  const b = res.grid.filter((r) => r.base); assert.equal(b.length, 1); assert.deepEqual(b[0], g.m1);
  assert.deepEqual(res.grid.map((r) => r.entry), ['00:53', '00:54', '00:55', '00:56', '00:57', '00:58', '01:00']);
  assert.deepEqual(res.reading, R.reading(res.grid));
  assert.equal(res.verdict, res.reading.word);
  if (res.oanda.available) {
    assert.deepEqual(res.oanda.compare.map((c) => c.entry), res.grid.map((r) => r.entry));
    for (const c of res.oanda.compare) assert.ok(c.days > 500 && c.corrNetR > -1 && c.corrNetR <= 1);
  }
});

test('gotobi-minute-histdata: RESULT.md says what result.json holds, and chooses nothing', () => {
  const md = read('RESULT.md');
  assert.equal(md, R.report(res));
  assert.match(md, new RegExp(`^\\*\\*Verdict: ${res.verdict}`, 'm'));
  const f = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  for (const r of res.grid) {
    const line = md.split('\n').find((l) => l.startsWith(`| ${r.base ? '**00:55 (the rule)**' : r.entry} | ${r.n} |`));
    assert.ok(line, r.entry);
    assert.ok(line.includes(f(r.netR, 4)) && line.includes(f(r.t, 2)) && line.includes(f(r.totalR, 1)), line);
  }
  assert.match(md, /nothing is chosen from the grid/);
  assert.match(md, /Gate: PASSED/);
  assert.doesNotMatch(md, /\b(best|optimal|recommended) (time|minute|entry)/i);
});

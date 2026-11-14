// gotobi-timing: the frozen rule is gotobi-replicate's frozen.mjs byte for byte, run.mjs re-implements none of its pieces but
// the M1 trade (checked against the frozen M5 trade on an aggregated path), the pre-registered gate holds in result.json, the
// grid is the pre-registered one, and RESULT.md says what result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/gotobi-timing/frozen.mjs';
import * as R from '../research/edge/gotobi-timing/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gotobi-timing');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const FROZEN_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';
const res = JSON.parse(read('result.json'));

test('gotobi-timing: frozen.mjs is gotobi-replicate\'s frozen.mjs byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA);
  assert.match(read('PREREGISTRATION.md'), new RegExp(FROZEN_SHA));
  assert.equal(res.frozen.sha256, FROZEN_SHA);
});

test('gotobi-timing: run.mjs takes the rule from frozen.mjs and the grid is the pre-registered one', () => {
  const src = read('run.mjs').replace(/\/\/[^\n]*/g, '');
  assert.match(read('run.mjs'), /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['trade', 'stopDist', 'windowMove', 'legTimes', 'costPx', 'gotobiSet', 'gotobiOfMonth', 'jpHolidays', 'tseHolidays', 'monthT', 'summary'])
    assert.doesNotMatch(src, new RegExp(`(function\\s+${fn}\\b|(const|let)\\s+${fn}\\s*=)`), `run.mjs defines ${fn}`);
  for (const k of ['22.5e-6', 'STOP_K =', 'LOOKBACK =']) assert.doesNotMatch(src, new RegExp(`(^|[^.\\w])${k}`, 'm'));
  assert.deepEqual(R.ENTRIES.map(R.hhmm), ['00:53', '00:54', '00:55', '00:56', '00:57', '00:58', '01:00']);
  assert.deepEqual(R.EXITS.map(R.hhmm), ['05:55', '06:00', '06:02', '06:05']);
  assert.deepEqual([R.hhmm(R.BASE.entry), R.hhmm(R.BASE.exit)], ['00:55', '06:00']);
  assert.equal(R.GRACE_M1 * 60, F.EXIT_GRACE);
  assert.deepEqual([R.FROM, R.LAST], ['2016-01-01', '2026-11-11']);
  const pre = read('PREREGISTRATION.md');
  for (const s of ['00:53, 00:54, **00:55 (base)**, 00:56, 00:57, 00:58, 01:00', '05:55, **06:00 (base)**, 06:02, 06:05', 'within 8 trades of 771', 'within 0.010R of +0.1481', 'at least 99 %'])
    assert.ok(pre.includes(s), s);
  assert.deepEqual([R.GATE.n, R.GATE.netR, R.GATE.nTol, R.GATE.rTol, R.GATE.openShare], [771, 0.1481, 8, 0.010, 0.99]);
});

// a deterministic M1 path over a few gotobi days, and its M5 aggregation (OANDA's: open of the first M1, high / low over, last close)
function paths(seed, drift) {
  const rnd = F.mulberry32(seed), m1 = []; let px = 150;
  for (const d of ['2016-03-10', '2016-03-15', '2016-03-18', '2016-03-25', '2016-03-31']) {
    const day0 = Date.parse(d + 'T00:00:00Z') / 1000;
    for (let m = 40; m < 375; m++) {
      const o = px, c = o + (rnd() - 0.5) * 0.02 + drift; px = c;
      m1.push([day0 + m * 60, o, Math.max(o, c) + rnd() * 0.006, Math.min(o, c) - rnd() * 0.006, c]);
    }
  }
  const g = new Map();
  for (const b of m1) { const k = b[0] - (b[0] % 300); const a = g.get(k); if (!a) g.set(k, [...b.slice(0, 1).map(() => k), b[1], b[2], b[3], b[4]]); else { a[2] = Math.max(a[2], b[2]); a[3] = Math.min(a[3], b[3]); a[4] = b[4]; } }
  return { m1, m5: [...g.values()] };
}

test('gotobi-timing: the M1 trade at 00:55 / 06:00 equals the frozen M5 trade on the same path', () => {
  let stops = 0, times = 0;
  for (const [seed, drift] of [[1, 0], [2, 0.004], [3, -0.004], [4, 0.008]]) {
    const { m1, m5 } = paths(seed, drift), i1 = F.index(m1), i5 = F.index(m5);
    for (const d of ['2016-03-10', '2016-03-15', '2016-03-18', '2016-03-25', '2016-03-31']) for (const D of [0.05, 0.15, 0.4, 2]) {
      const a = R.tradeM1(i1, d, D, 55, 360), b = F.trade(i5, 'fade', d, D);
      assert.ok(a && b);
      assert.equal(a.entry, b.entry); assert.equal(a.stop, b.stop);
      if (b.how === 'time') { times++; assert.equal(a.how, 'time'); assert.ok(Math.abs(a.net - b.net) < 1e-12); }
      else {
        stops++;   // M5 stop: on M1 the same stop is hit, at the stop or (M1 gap) at a worse open within the same M5 candle
        assert.notEqual(a.how, 'time');
        assert.ok(a.exit >= b.exit - 1e-12 || b.how === 'gap', `${d} ${D}`);
      }
      assert.ok(Math.abs(a.costR - b.costR) < 1e-12);
    }
  }
  assert.ok(stops > 0 && times > 0);
  // shifted entry: the stop sits D above the shifted fill
  const { m1 } = paths(5, 0), i1 = F.index(m1), t = R.tradeM1(i1, '2016-03-10', 0.3, 58, 360);
  assert.equal(t.entry, m1.find((b) => b[0] === Date.parse('2016-03-10T00:58:00Z') / 1000)[1]);
  assert.ok(Math.abs(t.stop - t.entry - 0.3) < 1e-12);
  // no candle at the entry minute = no trade
  const hole = m1.filter((b) => b[0] !== Date.parse('2016-03-10T00:56:00Z') / 1000);
  assert.equal(R.tradeM1(F.index(hole), '2016-03-10', 0.3, 56, 360), null);
});

test('gotobi-timing: the pre-registered gate holds in result.json', () => {
  const g = res.gate;
  assert.equal(g.m5.n, 771); assert.equal(g.m5.netR, 0.1481);
  assert.ok(Math.abs(g.m1.n - 771) <= 8);
  assert.ok(Math.abs(g.m1.netR - 0.1481) <= 0.010);
  assert.ok(g.open.days > 700 && g.open.equal / g.open.days >= 0.99);
  assert.deepEqual(g.checks, { reproducesOriginal: true, n: true, netR: true, open: true });
  assert.equal(g.pass, true);
  // the base rows of both grids are the gate's M1 row
  for (const grid of [res.entryGrid, res.exitGrid]) {
    const b = grid.filter((r) => r.base); assert.equal(b.length, 1);
    assert.deepEqual(b[0], g.m1);
  }
  assert.deepEqual(res.entryGrid.map((r) => r.entry), ['00:53', '00:54', '00:55', '00:56', '00:57', '00:58', '01:00']);
  assert.deepEqual(res.exitGrid.map((r) => r.exit), ['05:55', '06:00', '06:02', '06:05']);
});

test('gotobi-timing: RESULT.md says what result.json holds, and chooses nothing', () => {
  const md = read('RESULT.md');
  assert.equal(md, R.report(res));
  const f = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  for (const r of [...res.entryGrid, ...res.exitGrid]) {
    const line = md.split('\n').find((l) => l.startsWith('|') && l.includes(`| ${r.entry} | ${r.exit} | ${r.n} |`));
    assert.ok(line, `${r.entry} ${r.exit}`);
    assert.ok(line.includes(f(r.netR, 4)) && line.includes(f(r.t, 2)) && line.includes(f(r.totalR, 1)), line);
  }
  assert.match(md, /Nothing is chosen from this grid/);
  assert.match(md, /pre-registered rule/);
  assert.match(md, /Gate: PASSED/);
  assert.doesNotMatch(md, /\b(best|optimal|recommended) (time|minute|entry)/i);
});

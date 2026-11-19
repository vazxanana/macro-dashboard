// gotobi-feed: the frozen rule is byte for byte the gotobi study's run.mjs, run.mjs re-implements none of it, the HistData
// loader converts labels with council/histdata.mjs only, the T2 entry / exit land on 00:55 / 06:00 UTC across a clock change,
// and RESULT.md says what result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/gotobi-feed/frozen.mjs';
import * as R from '../research/edge/gotobi-feed/run.mjs';
import { histToUtc } from '../council/histdata.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gotobi-feed');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
// sha256 of research/edge/gotobi/run.mjs at commit 5f341e069 of branch gotobi (= gotobi-replicate/frozen.mjs)
const FROZEN_SHA = '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32';

test('gotobi-feed: frozen.mjs is the original run.mjs byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA);
  assert.match(read('PREREGISTRATION.md'), new RegExp(FROZEN_SHA));
});

test('gotobi-feed: run.mjs re-implements nothing of the rule and runs the original T2', () => {
  const src = read('run.mjs').replace(/\/\/[^\n]*/g, '');
  assert.match(read('run.mjs'), /import \* as F from '\.\/frozen\.mjs'/);
  for (const fn of ['trade', 'stopDist', 'windowMove', 'legTimes', 'entryPx', 'exitPx', 'costPx', 'gotobiOfMonth', 'gotobiSet', 'jpHolidays', 'tseHolidays', 'monthT', 'runPair', 'summary'])
    assert.doesNotMatch(src, new RegExp(`(function\\s+${fn}\\b|(const|let)\\s+${fn}\\s*=)`), `run.mjs defines ${fn}`);
  for (const k of ['0.003', '22.5e-6', '1.5 \\*', 'STOP_K =', 'LOOKBACK =']) assert.doesNotMatch(src, new RegExp(`(^|[^.\\w])${k}`, 'm'));
  const t2 = F.TESTS.find((x) => x.id === 'T2');
  assert.deepEqual({ pair: t2.pair, leg: t2.leg }, { pair: R.ORIGINAL.pair, leg: R.ORIGINAL.leg });
  assert.equal(R.LEG, t2.leg);
  assert.equal(R.T_BAR, F.T_BAR);
  assert.match(src, /F\.runPair\(bars, LEG, lastDay\)/);
});

test('gotobi-feed: the loader converts HistData labels with council/histdata.mjs only', () => {
  const src = read('run.mjs');
  assert.match(src, /import \{ histStampUtc \} from '\.\.\/\.\.\/\.\.\/council\/histdata\.mjs'/);
  const code = src.replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /slice\(9, ?11\)|18000|5 ?\* ?3600|4 ?\* ?3600|nyOffset|Date\.UTC/, 'no clock of its own');
  // summer (Europe) label -> +4 h; winter label -> +5 h; 2018 is New York time
  const txt = ['20240715 205500;160.000;160.010;159.990;160.005;0', '20240115 195500;145.000;145.010;144.990;145.005;0', '20180315 205500;106.000;106.010;105.990;106.005;0', ''].join('\n');
  const rows = R.parseHist(txt);
  assert.deepEqual(rows.map((r) => r[0]), [histToUtc(2024, 7, 15, 20, 55), histToUtc(2024, 1, 15, 19, 55), histToUtc(2018, 3, 15, 20, 55)]);
  assert.equal(rows[0][0], Date.parse('2024-07-16T00:55:00Z') / 1000);
  assert.equal(rows[1][0], Date.parse('2024-01-16T00:55:00Z') / 1000);
  assert.equal(rows[2][0], Date.parse('2018-03-16T00:55:00Z') / 1000);
  // a repeated converted time is dropped
  assert.equal(R.parseHist(txt + '20240715 205500;1;1;1;1;0\n').length, 3);
});

test('gotobi-feed: M5 aggregation and the T2 entry / exit minutes across a European clock change', () => {
  // M1 labels around the 2024 European spring change (last Sunday of March = 31 Mar): Thu 28 Mar (UTC-5) and Mon 1 Apr (UTC-4)
  const lines = [];
  for (const [ymd, off] of [['20240327', 5], ['20240331', 4]]) {
    const y = +ymd.slice(0, 4), mo = +ymd.slice(4, 6), d = +ymd.slice(6, 8);
    // labels that are 00:00-06:59 UTC of the next day
    for (let m = 0; m < 7 * 60; m++) {
      const utc = Date.UTC(y, mo - 1, d + 1, 0, m) / 1000, L = new Date((utc - off * 3600) * 1000);
      const lab = `${L.getUTCFullYear()}${String(L.getUTCMonth() + 1).padStart(2, '0')}${String(L.getUTCDate()).padStart(2, '0')} ${String(L.getUTCHours()).padStart(2, '0')}${String(L.getUTCMinutes()).padStart(2, '0')}00`;
      const px = 150 + m / 1000;
      lines.push(`${lab};${px.toFixed(3)};${(px + 0.002).toFixed(3)};${(px - 0.002).toFixed(3)};${(px + 0.0005).toFixed(4)};0`);
    }
  }
  const m5 = R.toM5(R.parseHist(lines.join('\n')));
  assert.ok(m5.every((b) => b[0] % 300 === 0 && b[0] % 86400 < R.KEEP_UNTIL));
  const ix = F.index(m5);
  for (const day of ['2024-03-28', '2024-04-01']) {
    const { entry, exit } = F.legTimes('fade', day);
    assert.equal(new Date(entry * 1000).toISOString(), `${day}T00:55:00.000Z`);
    assert.equal(new Date(exit * 1000).toISOString(), `${day}T06:00:00.000Z`);
    const e = F.entryPx(ix, entry), x = F.exitPx(ix, exit);
    // the 00:55 M5 candle opens with the 00:55 minute (m = 55) and the 06:00 one with minute 360
    assert.ok(e && Math.abs(e.px - (150 + 55 / 1000)) < 1e-9, `${day} entry`);
    assert.ok(Math.abs(x - (150 + 360 / 1000)) < 1e-9, `${day} exit`);
    const b = m5[e.i];
    assert.ok(Math.abs(b[2] - (150 + 59 / 1000 + 0.002)) < 1e-9 && Math.abs(b[3] - (150 + 55 / 1000 - 0.002)) < 1e-9 && Math.abs(b[4] - (150 + 59 / 1000 + 0.0005)) < 1e-9);
  }
});

test('gotobi-feed: RESULT.md says what result.json holds', () => {
  const j = JSON.parse(read('result.json')), md = read('RESULT.md');
  const f3 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3), f2 = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
  assert.ok(md.includes(`**Verdict: ${j.verdict}.**`));
  for (const s of [j.hist.all, j.oanda.all, j.common.hist, j.common.oanda]) {
    assert.ok(md.includes(`| ${s.n} | ${f3(s.netR)} | ${f3(s.grossR)} | ${s.costR.toFixed(3)} |`), `row n ${s.n}`);
    assert.ok(md.includes(`| ${f2(s.t)} | ${s.months} |`));
    assert.ok(md.includes(`| ${f3(s.netR2x)} | ${f2(s.t2x)} |`));
  }
  assert.ok(md.includes(`${j.common.corrNetR.toFixed(4)} (${j.common.days} days)`));
  for (const k of ['entry', 'exit', 'move', 'stopD']) { const d = j.common.diffPips[k]; assert.ok(md.includes(`| ${d.medianAbs} | ${d.p95Abs} | ${d.maxAbs} | ${d.medianSigned} |`), k); }
  // the verdict follows the pre-registered bar
  const H1 = j.hist.all.netR > 0 && j.hist.all.t >= 2, H2 = j.common.corrNetR >= 0.8;
  assert.equal(j.pass, H1 && H2);
  assert.equal(j.verdict.startsWith('FEED-ROBUST'), H1 && H2);
  assert.equal(j.window[0], '2018-01-01');
});

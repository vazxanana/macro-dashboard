// research/edge/local-preholiday: Easter, known exchange holidays, the pre-holiday day, the trade, and the report against
// result.json. Offline (no candle is read: the trade test uses hand-made candles).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { easter, closures, isTradingDay, equinox, japanNational } from '../research/edge/local-preholiday/holidays.mjs';
import { buildDays, preDays, trade, holm, welch, COST, FIN_YEAR } from '../research/edge/local-preholiday/run.mjs';

const DIR = new URL('../research/edge/local-preholiday/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

test('Easter Sunday on known dates', () => {
  const known = { 2000: '2000-04-23', 2003: '2003-04-20', 2008: '2008-03-23', 2011: '2011-04-24', 2016: '2016-03-27', 2019: '2019-04-21',
    2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2038: '2038-04-25' };
  for (const [y, d] of Object.entries(known)) assert.equal(easter(+y), d, String(y));
});

test('known holidays of each exchange', () => {
  assert.deepEqual(closures('xetra', 2025), ['2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01', '2025-12-24', '2025-12-25', '2025-12-26', '2025-12-31']);
  assert.ok(!closures('euronext', 2025).includes('2025-12-24'), 'Euronext trades 24 Dec');
  assert.deepEqual(closures('lse', 2022), ['2022-01-03', '2022-04-15', '2022-04-18', '2022-05-02', '2022-06-02', '2022-06-03', '2022-08-29', '2022-09-19', '2022-12-26', '2022-12-27']);
  assert.ok(closures('lse', 2020).includes('2020-05-08') && !closures('lse', 2020).includes('2020-05-04'), 'VE Day move');
  assert.deepEqual(closures('lse', 2021).slice(-2), ['2021-12-27', '2021-12-28'], 'Christmas on a Saturday');
  assert.deepEqual(closures('jpx', 2024), ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-08', '2024-02-12', '2024-02-23', '2024-03-20',
    '2024-04-29', '2024-05-03', '2024-05-06', '2024-07-15', '2024-08-12', '2024-09-16', '2024-09-23', '2024-10-14', '2024-11-04', '2024-12-31']);
  assert.ok(closures('jpx', 2019).includes('2019-05-02') && closures('jpx', 2019).includes('2019-10-22'), '2019 accession');
  assert.ok(japanNational(2026).includes('2026-09-22'), "citizens' holiday of 2026");
  assert.ok(japanNational(2021).includes('2021-08-09') && japanNational(2021).includes('2021-07-23'), 'Olympic moves');
  assert.deepEqual([equinox(2024, false), equinox(2024, true), equinox(2012, false), equinox(2012, true)], [20, 22, 20, 22]);
  assert.ok(closures('six', 2025).includes('2025-05-29') && closures('six', 2025).includes('2025-06-09'), 'Ascension, Whit Monday');
  assert.deepEqual(closures('asx', 2021), ['2021-01-01', '2021-01-26', '2021-04-02', '2021-04-05', '2021-06-14', '2021-12-27', '2021-12-28']);
  assert.deepEqual(closures('hkex', 2022), ['2022-04-15', '2022-04-18', '2022-05-02', '2022-07-01', '2022-12-26', '2022-12-27']);
  assert.ok(isTradingDay('xetra', '2025-04-17') && !isTradingDay('xetra', '2025-04-18') && !isTradingDay('xetra', '2025-04-19'));
});

// hand-made candles: a flat market around Easter 2025 on Xetra
const day = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
function candles(from, to, f) { const out = []; for (let t = day(from); t <= day(to); t += 86400) out.push(f(t)); return out; }

test('the pre-holiday day and one trade, with costs and financing', () => {
  const rows = candles('2025-02-01', '2025-04-30', (t) => [t, 100, 101, 99, 100, 1]);
  const { D, byDate } = buildDays(rows, 'xetra');
  const P = preDays(D, 'xetra');
  assert.equal(P.get('2025-04-17'), '2025-04-18', 'Maundy Thursday is the pre-holiday day of Good Friday (one P for two closures)');
  assert.ok(!P.has('2025-04-22'));
  const k = D.findIndex((x) => x.d === '2025-04-17');
  byDate.get('2025-04-17')[4] = 101; D[k].close = 101;
  const tr = trade(D, byDate, k);
  assert.equal(tr.entryD, '2025-04-16');
  assert.equal(tr.how, 'time');
  const risk = 2 * 2; // ATR 2 (flat candles, range 2)
  assert.ok(Math.abs(tr.grossR - 1 / risk) < 1e-9);
  assert.ok(Math.abs(tr.R - (1 / risk - (COST + FIN_YEAR / 365) * 100 / risk)) < 1e-9);
  // a gap through the stop fills at the open
  byDate.get('2025-04-17')[1] = 90;
  assert.equal(trade(D, byDate, k).how, 'stop-gap');
});

test('Holm and Welch helpers', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(welch([1, 2, 3], [1, 2, 3]).t) < 1e-12);
});

test('the report matches result.json', () => {
  assert.equal(res.verdict, 'FAIL');
  const line = md.split('\n').find((l) => /^\*\*Verdict:/.test(l));
  assert.ok(line && line.length < 240 && /FAIL/.test(line), 'the reason sits inside the bold verdict line');
  const P = res.pooled.OOS, f = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
  assert.ok(line.includes(`${f(P.diffNet)}R`) && line.includes(`${P.dates} dates`) && line.includes(`Welch t ${P.welchNet.toFixed(2)}`));
  assert.ok(md.includes(`above ${res.checks.c4.above} of 40 seeds`));
  assert.deepEqual(Object.values(res.checks).map((c) => c.met), [false, true, false, true]);
  for (const [w, holmCol] of [['OOS', true], ['IS', false]]) {
    const sec = md.split(w === 'OOS' ? '## Out of sample' : '## In sample')[1];
    for (const m of Object.values(res.markets)) {
      const o = m[w];
      const row = `| ${m.name} | ${o.n} | ${f(o.gross)} | ${o.tGross.toFixed(2)} | ${f(o.net)} | ${o.tNet.toFixed(2)} | ${f(o.otherNet)} | ${f(o.diffNet)} | ${o.welchNet.toFixed(2)} |` + (holmCol ? ` ${o.holmP.toFixed(2)} |` : '');
      assert.ok(sec.includes(row.replace(/-(?=\d)/g, '-')), `${w} ${m.name}: ${row}`);
    }
  }
});

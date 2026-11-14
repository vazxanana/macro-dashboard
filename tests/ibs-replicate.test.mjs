// research/edge/ibs-replicate: #895's IBS rule frozen byte for byte and replicated on seven other indices (offline: hand-made
// candles and the committed result files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { trade, nights, holm, pOneSided } from '../research/edge/ibs-replicate/frozen.mjs';
import {
  NEW, COST, foldRows, closeTime, buildDaysD, byDay, readingOf, replicate,
} from '../research/edge/ibs-replicate/run.mjs';

const dir = new URL('../research/edge/ibs-replicate/', import.meta.url);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(new URL(f, dir))).digest('hex');
const res = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const D0 = (ymd) => Date.parse(ymd + 'T00:00:00Z') / 1000;

test('frozen.mjs and rates.json are #895\'s files byte for byte', () => {
  assert.equal(sha('frozen.mjs'), '6e56210c13ef5863ee1161d72f6796342142c672727d876d0c2f1acc23bca703');
  assert.equal(sha('rates.json'), '9a4206bc0a7b5b6cbdc643f1472e7b4ccaacc5e7144d2bd18ecbdd52f7483ce1');
  assert.equal(res.frozenSha, sha('frozen.mjs'));
});

test('the gate reproduced #895\'s published pooled result exactly', () => {
  assert.equal(res.gate.pass, true);
  assert.ok(Object.values(res.gate.same).every(Boolean));
  assert.equal(Object.keys(res.gate.same).length, 13);
  // #895 result.json (4053ff27a): pooled decisive and replication
  assert.deepEqual(res.gate.pooled.decisive, { n: 1414, R: 0.02, grossR: 0.069, finR: 0.015, costR: 0.035, tTrade: 1.01, monthT: 0.64, months: 131, win: 51.77, stops: 229, gaps: 5, totalR: 27.73, pct: 0.151 });
  assert.deepEqual(res.gate.pooled.replication, { n: 1548, R: 0.041, grossR: 0.087, finR: 0.013, costR: 0.033, tTrade: 2.25, monthT: 1.63, months: 132, win: 54.26, stops: 242, gaps: 0, totalR: 63.03, pct: 0.176 });
  assert.equal(res.gate.pooled.placeboBeaten, 40);
  assert.equal(res.gate.verdict, 'FAIL');
});

test('weekend candles fold into Monday; Friday closes at 21:00 UTC', () => {
  const rows = [[D0('2026-11-06'), 10, 11, 9, 10.5, 1], [D0('2026-11-08'), 10.4, 12, 10.3, 11, 1], [D0('2026-11-09'), 11, 11.5, 10.8, 11.2, 1]];
  const f = foldRows(rows);
  assert.deepEqual(f, [[D0('2026-11-06'), 10, 11, 9, 10.5], [D0('2026-11-09'), 10.4, 12, 10.3, 11.2]]);
  assert.equal(closeTime(D0('2026-11-06')), D0('2026-11-06') + 21 * 3600);
  assert.equal(closeTime(D0('2026-11-09')), D0('2026-11-10'));
  const D = buildDaysD([[D0('2026-11-05'), 100, 110, 90, 92], [D0('2026-11-06'), 100, 100, 100, 100]]);
  assert.ok(Math.abs(D[0].ibs - 0.1) < 1e-12);
  assert.equal(D[1].ibs, null);                                // high = low: no IBS
  assert.equal(D[0].t + 3600, D0('2026-11-06'));                // the frozen trade() reads E.t + 3600 as the entry close
});

test('financing nights on the daily day: Mon-Wed 1, Thursday 0, Friday 4 (Friday counts three)', () => {
  const n = (e, x) => nights(closeTime(D0(e)), closeTime(D0(x)));
  assert.equal(n('2026-11-09', '2026-11-10'), 1);
  assert.equal(n('2026-11-11', '2026-11-12'), 1);
  assert.equal(n('2026-11-12', '2026-11-13'), 0);
  assert.equal(n('2026-11-13', '2026-11-16'), 4);
});

// 22 flat days, then a low-IBS day and a next day
function series(next) {
  const out = []; let t = D0('2026-01-05');
  while (out.length < 22) { const wd = new Date(t * 1000).getUTCDay(); if (wd > 0 && wd < 6) out.push([t, 100, 101, 99, 100]); t += 86400; }
  out[21] = [out[21][0], 100, 101, 99, 99.1];                  // IBS 0.05
  let tn = out[21][0] + 86400; while ([0, 6].includes(new Date(tn * 1000).getUTCDay())) tn += 86400;
  out.push([tn, ...next]);
  return out;
}
const rate = () => 0;

test('the frozen trade on daily candles: time exit, stop, gap', () => {
  for (const [next, how, exit] of [[[99.1, 99.8, 99, 99.6], 'time', 99.6], [[99.1, 99.2, 96, 97], 'stop', 97.1], [[96, 96.5, 95, 96], 'stop-gap', 96]]) {
    const bars = series(next), D = buildDaysD(bars);
    const t = trade(bars, D, 21, 22, { cost: COST, rate, side: 1 });
    assert.equal(t.how, how);
    assert.ok(Math.abs(t.exit - exit) < 1e-9, how);
    assert.ok(Math.abs(t.stop - (99.1 - 2)) < 1e-9);            // ATR(20) of flat days = 2
  }
});

test('R3 counts one observation per entry day', () => {
  const r = byDay([{ entryD: '2020-01-02', R: 1 }, { entryD: '2020-01-02', R: -1 }, { entryD: '2020-01-03', R: 0.5 }, { entryD: '2020-01-06', R: 0.1 }]);
  assert.equal(r.days, 3);
  assert.equal(r.R, +((0 + 0.5 + 0.1) / 3).toFixed(3));
});

test('the pre-registered reading', () => {
  const T = (r1, t1, p1, r2, r3, p3) => ({ R1: { R: r1, monthT: t1, p: p1 }, R2: { R: r2 }, R3: { R: r3, p: p3 } });
  assert.equal(readingOf(T(0.05, 2.5, 0.01, 0.02, 0.04, 0.02)).reading, 'REPLICATES');
  assert.equal(readingOf(T(0.05, 2.5, 0.01, -0.02, 0.04, 0.02)).reading, 'PARTLY');
  assert.equal(readingOf(T(0.02, 1.0, 0.16, 0.02, 0.01, 0.3)).reading, 'PARTLY');
  assert.equal(readingOf(T(0.02, 0.9, 0.18, 0.02, 0.01, 0.3)).reading, 'DOES NOT REPLICATE');
  assert.equal(readingOf(T(-0.01, 2, 0.9, 0.02, 0.01, 0.3)).reading, 'DOES NOT REPLICATE');
});

test('the committed result: reading, Holm and the report agree', () => {
  const B = res.base.tests, r = readingOf(B);
  assert.equal(res.verdict, r.reading);
  assert.equal(res.verdict, 'DOES NOT REPLICATE');
  const adj = holm([B.R1.p, B.R3.p]);
  assert.equal(res.holm.R1, +adj[0].toFixed(4));
  assert.equal(res.holm.R3, +adj[1].toFixed(4));
  assert.ok(Math.abs(B.R1.p - pOneSided(B.R1.monthT)) < 0.01);
  assert.deepEqual(Object.keys(res.base.markets), Object.keys(NEW));
  assert.equal(B.R1.n, Object.values(res.base.markets).reduce((a, m) => a + m.decisive.n, 0));
  assert.equal(B.R2.n, Object.values(res.base.markets).reduce((a, m) => a + m.replication.n, 0));
  assert.equal(res.half.tests.R1.grossR, B.R1.grossR);          // a cost row changes the cost only
  assert.ok(res.half.tests.R1.R > B.R1.R && B.R1.R > res.double.tests.R1.R);
  assert.equal(res.base.placebo.seeds.length, 40);
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.match(md.split('\n')[0], /^\*\*Verdict: DOES NOT REPLICATE\*\*/);
  assert.ok(md.includes(`beats ${res.base.placebo.beaten} of 40`));
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
  for (const k of Object.keys(NEW)) assert.ok(pre.includes('`' + k + '`'), k);
});

test('replicate() runs end to end on hand-made candles', () => {
  const M = {}; const bars = []; let t = D0('2014-01-01'), k = 0;
  while (t < D0('2017-03-01')) { const wd = new Date(t * 1000).getUTCDay(); if (wd > 0 && wd < 6) { const c = 100 + Math.sin(k++) * 0.9; bars.push([t, 100, 101, 99, c]); } t += 86400; }
  M.de40 = bars;
  const rates = JSON.parse(fs.readFileSync(new URL('rates.json', dir), 'utf8'));
  const out = replicate(M, rates);
  assert.ok(out.tests.R1.n > 0 && out.tests.R2.n > 0);
  assert.equal(out.keys.join(), 'de40');
  assert.equal(out.placebo.seeds.length, 40);
});

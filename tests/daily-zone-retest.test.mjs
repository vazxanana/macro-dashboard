// node --test tests/daily-zone-retest.test.mjs - the daily-zone-retest study (research/edge/daily-zone-retest), offline:
// no look-ahead (cut and change every later candle), every trade has a stop on its losing side, the weekly side reads
// closed weekly candles only, and result.json matches the table of RESULT.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../research/edge/_lib/edgekit.mjs';
import * as S from '../research/edge/daily-zone-retest/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'daily-zone-retest');

// Synthetic 5m candles, weekdays only (Sunday 22:00 UTC to Friday 22:00 UTC), with calm and violent days so strong Daily
// breakouts exist.
function market(days = 700, seed = 7) {
  const r = K.rng(seed); const out = []; let p = 100;
  const t0 = Date.UTC(2023, 0, 1, 22) / 1000; // Sunday 22:00 UTC
  let vol = 0.05, drift = 0;
  for (let d = 0; d < days * 7 / 5 + 7; d++) {
    const dayStart = t0 + d * 86400; const wd = new Date((dayStart + 7200) * 1000).getUTCDay(); // the UTC day it runs into
    if (wd === 6 || wd === 0) continue;
    if (r() < 0.15) vol = 0.03 + r() * 0.25; if (r() < 0.2) drift = (r() - 0.5) * 0.02;
    for (let k = 0; k < 288; k++) {
      const t = dayStart + k * 300; const o = p; const c = o + drift + (r() - 0.5) * vol;
      out.push({ t, o, h: Math.max(o, c) + r() * vol * 0.4, l: Math.min(o, c) - r() * vol * 0.4, c, e: t + 300 }); p = c;
    }
  }
  return out;
}
const M5 = market();

test('the synthetic market gives zones, visits and trades', () => {
  const s = S.signals(M5);
  assert.ok(s.zones.length >= 5, 'zones ' + s.zones.length);
  const tr = S.trades('eurusd', M5).trades;
  assert.ok(tr.length >= 5, 'trades ' + tr.length);
});

test('every trade has its stop on the losing side and a target at least 1R away', () => {
  for (const x of S.trades('eurusd', M5).trades) {
    const s = x.side === 'buy' ? 1 : -1;
    assert.ok(s * (x.entry - x.stop) > 0, 'stop on the losing side');
    assert.ok(s * (x.target - x.entry) >= x.risk * 0.999999, 'target 1R or more');
    assert.ok(x.R >= -1 - 1e-9 || x.reason === 'stop', 'a loss beyond 1R only through a stop gap');
    assert.ok(x.Rnet <= x.R, 'costs only take');
  }
});

test('no look-ahead: trades closed before a cut do not move when every later candle is changed or removed', () => {
  const full = S.trades('eurusd', M5).trades;
  for (const k of [1, Math.floor(full.length / 2), full.length - 1]) {
    const cut = full[k].exitT + 3600; // just after a trade closed: that trade and the earlier ones must stay as they are
    const changed = M5.map((b) => (b.t < cut ? b : { ...b, o: b.o * 1.3, h: b.h * 1.5, l: b.l * 0.7, c: b.c * 0.8 }));
    const cutOnly = M5.filter((b) => b.t < cut);
    const key = (arr) => arr.filter((x) => x.exitT <= cut).map((x) => JSON.stringify(x));
    const want = key(full);
    assert.ok(want.length > 0, 'some trades before the cut');
    assert.deepEqual(key(S.trades('eurusd', changed).trades), want);
    assert.deepEqual(key(S.trades('eurusd', cutOnly).trades), want);
  }
});

test('zones are known at the breakout close and the weekly side reads closed weekly candles only', () => {
  const D = K.dailyNY(M5);
  for (const z of S.dailyZones(D)) {
    assert.equal(z.knownT, D[z.bi].e);
    assert.ok(z.hi >= z.lo);
    if (z.endT != null) assert.ok(z.endT > z.knownT);
  }
  const W = S.weeklyFromDaily(D), WB = K.boxesClose(W);
  let prev = 0;
  for (const b of WB) if (b.dir) {
    assert.equal(S.weeklySide(WB, b.bt - 1), prev, 'one second before the break close: the earlier side');
    assert.equal(S.weeklySide(WB, b.bt), b.dir, 'side known at the break close');
    prev = b.dir;
  }
});

test('result.json matches RESULT.md and the verdict follows the pass bar', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.match(md, new RegExp('\\*\\*Verdict: ' + r.verdict));
  const names = { REP: 'Replication 2010-2019', IS: 'In sample 2020-2023', OOS: 'Out of sample 2024 on' };
  for (const T of ['T1', 'T2']) for (const w of ['REP', 'IS', 'OOS']) {
    const a = r[T].cost1[w], b = r[T].cost2[w], c = r['reported' + T].beforeCosts[w];
    const row = `| ${T} | ${names[w]} | ${a.n} | ${a.meanR.toFixed(3)} | ${a.tMonth.toFixed(2)} | ${b.meanR.toFixed(3)} | ${c.meanR.toFixed(3)} |`;
    assert.ok(md.includes(row), 'row in RESULT.md: ' + row);
  }
  for (const T of ['T1', 'T2']) {
    const j = S.judge(r[T].cost1, r[T].cost2, r[T].holmP);
    assert.equal(j.verdict, r[T].verdict);
  }
  const tr = JSON.parse(fs.readFileSync(path.join(DIR, 'trades.json'), 'utf8')).trades;
  const T1n = ['REP', 'IS', 'OOS'].reduce((a, w) => a + r.T1.cost1[w].n, 0);
  assert.equal(tr.length, T1n);
  for (const x of tr) assert.ok((x.s === 'buy' ? 1 : -1) * (x.en - x.st) > 0, 'stop on the losing side');
  assert.ok(fs.statSync(path.join(DIR, 'trades.json')).size < 3e6);
});

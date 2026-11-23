// tests/regime-switch-book.test.mjs - the market-cycle regime book (research/edge/regime-switch-book). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../research/edge/_lib/edgekit.mjs';
import * as M from '../research/edge/regime-switch-book/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/regime-switch-book');

function synth(n, seed = 5, t0 = Date.UTC(2021, 0, 4) / 1000) { // 5m random-walk candles with trends and ranges, weekdays only
  const r = K.rng(seed); const out = []; let px = 100, drift = 0;
  for (let i = 0, t = t0; out.length < n; i++, t += 300) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 6 || (wd === 0 && new Date(t * 1000).getUTCHours() < 22)) continue;
    if (i % 600 === 0) drift = (r() - 0.5) * 0.06;
    const o = px; const c = o + drift + (r() - 0.5) * 0.4; const h = Math.max(o, c) + r() * 0.15, l = Math.min(o, c) - r() * 0.15;
    out.push({ t, o, h, l, c, e: t + 300 }); px = c;
  }
  return out;
}
const regimesOf = (b5) => M.dayRegimes(K.resample(b5, 14400), K.dailyNY(b5));

test('day regimes use only H4 candles closed at the day start (cut and change later candles)', () => {
  const b5 = synth(60000);
  const full = regimesOf(b5);
  const states = new Set(full.map((d) => d.state));
  assert.ok(states.has('C') && states.has('T') && states.has('X'), 'the synthetic market shows all three states');
  for (const k of [40, 90, 150, 200]) {
    const T = full[k].t;
    const cut = b5.filter((b) => b.t < T + 3600); // the day's first hour only
    const changed = b5.map((b) => (b.t >= T ? { ...b, o: b.o * 1.3, h: b.h * 1.3 + 5, l: b.l * 0.7, c: b.c * 0.71 } : b));
    for (const alt of [regimesOf(cut), regimesOf(changed)]) {
      for (let d = 0; d <= k; d++) {
        assert.equal(alt[d].t, full[d].t);
        assert.equal(alt[d].state, full[d].state, 'state of day ' + d + ' moved with later candles');
        assert.equal(alt[d].side, full[d].side, 'side of day ' + d + ' moved with later candles');
      }
    }
  }
});

test('the choice reads the in-sample window only', () => {
  const regOf = (r) => ({ state: r.g, side: r.hs });
  const mk = (n, from, R, g) => Array.from({ length: n }, (_, i) => ({ fillT: from + i * 86400 * 3, exitT: from + i * 86400 * 3 + 3600, Rnet: R + (i % 5) * 0.1 - 0.2, R, g, side: 1, hs: 1 }));
  const is = [...M.W.is].map((x) => x);
  const rows = [...mk(60, is[0], 0.5, 'T'), ...mk(60, is[0] + 3600, -0.5, 'C')];
  const a = M.choose(rows, regOf, M.W.is);
  assert.ok(a.id === 'T' || a.id === 'Tw', a.id);
  const later = [...rows, ...mk(200, M.W.oos[0], 3, 'C')];
  assert.deepEqual(M.choose(later, regOf, M.W.is), a);
  // under 30 trades a filter is never chosen; "all" stays
  assert.equal(M.choose(mk(20, is[0], 0.3, 'T'), regOf, M.W.is).id, 'all');
});

test('every trade read has a stop on the losing side of its entry', () => {
  const { methods } = M.readLists();
  let n = 0, instant = 0;
  for (const { rows } of Object.values(methods)) for (const r of rows) {
    n++;
    if (r.side * (r.entry - r.stop) > 0) continue;
    // a limit filled at an open already past its stop is closed at the fill (R 0 before costs): the only allowed case
    assert.ok(r.exitT === r.fillT && Math.abs(r.R) < 1e-9, 'stop on the wrong side: ' + JSON.stringify(r));
    instant++;
  }
  assert.ok(n > 1000);
  assert.ok(instant < n / 1000);
});

test('result.json and RESULT.md agree', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(r.verdict));
  assert.ok(md.includes(`**Verdict: ${r.verdict}.**`));
  assert.equal(md, M.report(r));
  const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
  assert.ok(md.includes(`${f(r.T1.book.meanR)}R a trade after costs out of sample (n ${r.T1.book.n}`));
  // the verdict follows the bar's own lines
  const L = r.T1.lines;
  if (r.verdict === 'PASS') assert.ok(Object.values(L).every(Boolean));
  if (!L.oosMean || !L.isMean || !L.twoX) assert.equal(r.verdict, 'FAIL');
  const tj = JSON.parse(fs.readFileSync(path.join(DIR, 'trades.json'), 'utf8'));
  assert.ok(fs.statSync(path.join(DIR, 'trades.json')).size < 3e6);
  assert.ok(tj.rows.length > 1000 && tj.cols.includes('Rnet'));
});

test('the study names none of the owner\'s private material', () => {
  for (const f of ['run.mjs', 'RESULT.md', 'result.json']) {
    const s = fs.readFileSync(path.join(DIR, f), 'utf8');
    assert.doesNotMatch(s, /\.pdf|uploads|skills\/synced/i);
  }
});

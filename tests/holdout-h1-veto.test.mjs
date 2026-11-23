// node --test tests/holdout-h1-veto.test.mjs - the volatility breakout with an H1-break veto, on the holdout (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import * as H from '../research/edge/holdout-h1-veto/run.mjs';
import * as V from '../research/edge/holdout-vb-early/run.mjs';
import { buildDays } from '../research/edge/gold-vol-breakout/run.mjs';

const DIR = new URL('../research/edge/holdout-h1-veto/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8) / 1000; // a Monday
function walk(nDays, seed = 3, p0 = 1.1) {
  const r = K.rng(seed), out = []; let p = p0;
  for (let i = 0; i < nDays * 288; i++) {
    const t = T0 + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 6 || wd === 0) continue;
    const o = p, c = o + (r() - 0.5) * p * 0.0012, h = Math.max(o, c) + r() * p * 0.0005, l = Math.min(o, c) - r() * p * 0.0005;
    out.push([t, o, h, l, c]); p = c;
  }
  return out;
}
const bars = (rows) => rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], e: r[0] + 300 }));

test('the pinned base modules are unchanged', () => {
  for (const x of H.pinCheck()) assert.ok(x.ok, x.file + ' changed');
});

test('no look-ahead: the veto at a fill does not move when every price from the fill candle on changes', () => {
  const rows = walk(60, 5), days = buildDays(rows), HS = H.h1Structure(bars(rows));
  let n = 0, vetoed = 0;
  for (const d of days) {
    const x = V.dayTrade('eurusd', d); if (!x) continue;
    const v = H.vetoAt(HS, x.fillT, x.side);
    const changed = rows.map((r) => (r[0] < x.fillT ? r : [r[0], r[1] * 1.03, r[2] * 1.05, r[3] * 0.95, r[4] * 0.97]));
    const w = H.vetoAt(H.h1Structure(bars(changed)), x.fillT, x.side);
    assert.deepEqual(w, v, 'the veto moved with prices at or after the fill');
    if (v.breakT != null) assert.ok(v.breakT <= x.fillT, 'a break from a candle not closed at the fill');
    n++; if (v.veto) vetoed++;
  }
  assert.ok(n > 30 && vetoed > 0, 'the walk has trades and vetoes');
});

test('the veto: a break against the side within the last 6 closed H1 candles, nothing else', () => {
  const rows = walk(60, 11), HS = H.h1Structure(bars(rows));
  for (const ev of HS.events.slice(5, 40)) {
    for (let k = 1; k <= 8 && ev.i + k - 1 < HS.h1.length; k++) {
      const fillT = HS.h1[ev.i + k - 1].e;             // k = age: the break candle is the k-th closed H1 candle back
      if (HS.events.some((e) => e.i > ev.i && HS.h1[e.i].e <= fillT)) break;
      const against = H.vetoAt(HS, fillT, -ev.dir), withIt = H.vetoAt(HS, fillT, ev.dir);
      assert.equal(against.age, k); assert.equal(against.veto, k <= 6); assert.equal(withIt.veto, false);
    }
  }
});

test('trades.json: every stop on the losing side; sets and windows as pre-registered; vetoes follow the rule', () => {
  const T = JSON.parse(fs.readFileSync(new URL('trades.json', DIR))), c = Object.fromEntries(T.cols.map((k, i) => [k, i]));
  assert.ok(T.rows.length > 10000);
  assert.ok(fs.statSync(new URL('trades.json', DIR)).size < 3e6);
  for (const r of T.rows) {
    assert.ok(r[c.side] * (r[c.entry] - r[c.stop]) > 0, 'stop on the winning side');
    if (r[c.set] === 'A') { assert.ok(K.MARKETS.includes(r[c.market])); assert.ok(r[c.day] >= '2005-01-01' && r[c.day] <= '2009-12-31'); }
    else { assert.ok(K.HOLDOUT_MARKETS.includes(r[c.market])); assert.ok(r[c.day] >= '2010-01-01'); }
    assert.equal(r[c.veto] === 1, r[c.h1Dir] === -r[c.side] && r[c.h1Age] != null && r[c.h1Age] <= 6);
  }
});

test('result.json and trades.json agree; RESULT.md is the report of result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const T = JSON.parse(fs.readFileSync(new URL('trades.json', DIR))), c = Object.fromEntries(T.cols.map((k, i) => [k, i]));
  const kept = T.rows.filter((r) => r[c.veto] === 0), vet = T.rows.filter((r) => r[c.veto] === 1);
  assert.equal(kept.length, R.pooled.kept.n); assert.equal(vet.length, R.pooled.vetoed.n);
  assert.ok(Math.abs(kept.reduce((s, r) => s + r[c.Rnet], 0) / kept.length - R.pooled.kept.netR) < 0.002);
  assert.ok(Math.abs(vet.reduce((s, r) => s + r[c.Rnet], 0) / vet.length - R.pooled.vetoed.netR) < 0.002);
  for (const s of ['A', 'B']) assert.equal(kept.filter((r) => r[c.set] === s).length, R.sets[s].kept.n);
  assert.ok(R.gateOk && R.pinsOk);
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdictWord));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes('**Verdict: ' + R.verdict + '**'));
  assert.ok(md.indexOf('Verdict') < md.indexOf('## The bar'), 'verdict first');
});

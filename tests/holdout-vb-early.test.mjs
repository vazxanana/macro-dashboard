// node --test tests/holdout-vb-early.test.mjs - the volatility breakout, early fills only, on the holdout (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import * as V from '../research/edge/holdout-vb-early/run.mjs';
import { buildDays } from '../research/edge/gold-vol-breakout/run.mjs';

const DIR = new URL('../research/edge/holdout-vb-early/', import.meta.url);
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

test('the pinned base modules are unchanged', () => {
  for (const x of V.pinCheck()) assert.ok(x.ok, x.file + ' changed');
});

test('no look-ahead: whether a day trades early, and its side / entry / stop, do not move when later prices change', () => {
  const rows = walk(40), days = buildDays(rows);
  let early = 0, checked = 0;
  for (const d of days) {
    const x = V.dayTrade('eurusd', d); if (!x) continue;
    // every price from 06:00 UTC on (and of later days) changes: an early decision cannot move
    const cut = d.d0 + V.CUT_S;
    const changed = rows.map((r) => (r[0] < cut ? r : [r[0], r[1] * 1.02, r[2] * 1.03, r[3] * 0.97, r[4] * 0.99]));
    const d2 = buildDays(changed).find((q) => q.day === d.day), y = V.dayTrade('eurusd', d2);
    if (x.early) {
      early++;
      assert.ok(y && y.early, 'an early fill vanished when later prices changed');
      assert.equal(y.side, x.side); assert.equal(y.entry, x.entry); assert.equal(y.stop, x.stop); assert.equal(y.fillT, x.fillT);
    } else assert.ok(!y || !y.early || y.fillT < x.fillT, 'a late day turned early only from prices after 06:00');
    checked++;
  }
  assert.ok(checked > 20 && early > 0, 'the walk has early fills');
});

test('early = the first fill\'s candle starts before 06:00 UTC', () => {
  const days = buildDays(walk(30, 9));
  for (const d of days) { const x = V.dayTrade('eurusd', d); if (x) assert.equal(x.early, x.fillT - d.d0 < 6 * 3600); }
});

test('costs: the larger of the toolkit\'s and the market\'s own study', () => {
  assert.equal(V.costOf('xau', 2000), 0.60);
  assert.equal(V.costOf('xag', 25), 0.03);
  assert.ok(Math.abs(V.costOf('eurusd', 1.1) - (0.000045 * 1.1 + 0.00005)) < 1e-12);
  assert.equal(V.costOf('eurjpy', 50), 0.010);
});

test('trades.json: every stop on the losing side; sets and windows as pre-registered', () => {
  const T = JSON.parse(fs.readFileSync(new URL('trades.json', DIR))), c = Object.fromEntries(T.cols.map((k, i) => [k, i]));
  assert.ok(T.rows.length > 10000);
  for (const r of T.rows) {
    assert.ok(r[c.side] * (r[c.entry] - r[c.stop]) > 0, 'stop on the winning side');
    if (r[c.set] === 'A') { assert.ok(K.MARKETS.includes(r[c.market])); assert.ok(r[c.day] >= '2005-01-01' && r[c.day] <= '2009-12-31'); }
    else { assert.ok(K.HOLDOUT_MARKETS.includes(r[c.market])); assert.ok(r[c.day] >= '2010-01-01'); }
    assert.equal(r[c.early] === 1, r[c.fillT] - Math.floor(r[c.fillT] / 86400) * 86400 < 6 * 3600);
  }
});

test('result.json and trades.json agree; RESULT.md is the report of result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const T = JSON.parse(fs.readFileSync(new URL('trades.json', DIR))), c = Object.fromEntries(T.cols.map((k, i) => [k, i]));
  const early = T.rows.filter((r) => r[c.early] === 1), late = T.rows.filter((r) => r[c.early] === 0);
  assert.equal(early.length, R.pooled.early.n); assert.equal(late.length, R.pooled.late.n);
  const m = early.reduce((s, r) => s + r[c.Rnet], 0) / early.length;
  assert.ok(Math.abs(m - R.pooled.early.netR) < 0.002);
  for (const s of ['A', 'B']) assert.equal(early.filter((r) => r[c.set] === s).length, R.sets[s].early.n);
  assert.ok(R.gateOk && R.pinsOk);
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdictWord));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes('**Verdict: ' + R.verdict + '**'));
  assert.ok(md.indexOf('Verdict') < md.indexOf('## The bar'), 'verdict first');
});

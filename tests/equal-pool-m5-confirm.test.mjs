// tests/equal-pool-m5-confirm.test.mjs - research/edge/equal-pool-m5-confirm (offline): the event rules on seeded candles
// (every invariant of the pre-registration, no look-ahead when later prices change, the stop on the losing side), the cells,
// and RESULT.md pinned to result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { events, tradeOf, evKey, dailyAtrE, cellName, cellOf, NCELL, BACK, KSW, ATRK, MARKETS } from '../research/edge/equal-pool-m5-confirm/run.mjs';

const DIR = new URL('../research/edge/equal-pool-m5-confirm/', import.meta.url);
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

function walk(seed, n = 26000) {   // about 90 days of 5-minute candles, a mean-reverting walk so equal lows / highs form
  const r = K.rng(seed), T0 = Date.UTC(2021, 0, 4) / 1000, B = []; let p = 100;
  for (let i = 0; i < n; i++) { const o = p, c = o + (r() - 0.5) * 0.2 + (100 - o) * 0.002, h = Math.max(o, c) + r() * 0.06, l = Math.min(o, c) - r() * 0.06; p = c;
    B.push({ t: T0 + i * 300, o, h, l, c, e: T0 + i * 300 + 300 }); }
  return B;
}
const frames = (B) => [B, K.resample(B, 3600), K.dailyNY(B)];

test('pre-registration names the cells, the windows, the bar and the control', () => {
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'AFTER costs', 'Single swing', 'pool 3R ny', 'n >= 300', 'stop first'])
    assert.ok(pre.includes(w), w);
  assert.equal(NCELL, 6);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => cellName(i)), ['pool 2R all', 'pool 2R london', 'pool 2R ny', 'pool 3R all', 'pool 3R london', 'pool 3R ny']);
  assert.equal(cellName(cellOf(1, 2)), 'pool 3R ny');
  assert.deepEqual(MARKETS, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
});

test('every event on seeded candles obeys the rules, and every trade has its stop on the losing side', () => {
  let pools = 0, singles = 0, trades = 0;
  for (const seed of [3, 8]) {
    const [B, T, D] = frames(walk(seed)), ev = events(B, T, D), sw = K.swings(B, KSW);
    const seen = new Set();
    for (const g of ev) {
      const key = g.s + ':' + g.side; assert.ok(!seen.has(key), 'one event per hour and side'); seen.add(key);
      const h0 = T[g.s].t, q = g.q, b = B[q], s = g.side;
      assert.ok(g.xi < q && B[g.xi].t >= h0 && B[g.xi].t < h0 + 3600, 'the extreme is in the sweep hour, before the confirming candle');
      assert.ok(b.t < h0 + 7200 && g.ts === b.e, 'confirmed in the sweep hour or the next');
      let X = s > 0 ? Infinity : -Infinity; for (let j = 0; j <= q; j++) if (B[j].t >= h0) X = s > 0 ? Math.min(X, B[j].l) : Math.max(X, B[j].h);
      assert.equal(g.X, X, 'the extreme is the lowest low / highest high from the hour start to the confirming candle');
      assert.equal(s > 0 ? B[g.xi].l : B[g.xi].h, X);
      const cand = sw.filter((x) => x.type === (s > 0 ? 'H' : 'L') && x.i < g.xi && x.i >= g.xi - BACK && x.i + KSW < q).sort((a, c) => c.i - a.i)[0];
      assert.ok(cand, 'a 5-minute swing before the extreme, confirmed before the candle'); assert.equal(g.lvl, cand.price);
      assert.ok(s * (b.c - g.lvl) > 0 && s * (b.c - g.L) > 0, 'closes back through the swing and past the deepest level');
      assert.ok(s * (g.L - g.X) > 0, 'the level was taken');
      assert.ok(g.grp === 'pool' ? g.n >= 2 : g.grp === 'single' && g.n === 1);
      if (g.grp === 'pool') assert.ok(dailyAtrE(D, h0) > 0);
      g.grp === 'pool' ? pools++ : singles++;
      const tr = tradeOf(B, g, 0.001);
      if (tr.why === null) { trades++; assert.equal(tr.fi, q + 1); assert.ok(s * (tr.fill - tr.stop) > 0, 'stop on the losing side'); assert.ok(Math.abs(tr.stop - (g.X - s * ATRK * g.a)) < 1e-12);
        assert.ok(s * (g.X - tr.stop) > 0, 'the stop is past the extreme'); }
      else assert.ok(['bad', 'small', 'end'].includes(tr.why));
    }
  }
  assert.ok(pools >= 5 && singles >= 20 && trades >= 20, `pools ${pools}, singles ${singles}, trades ${trades}`);
});

test('no look-ahead: events known by a cut are the same when every later price is changed or missing', () => {
  const B = walk(5), full = events(...frames(B));
  for (const cutI of [9000, 15011, 21007]) {
    const t = B[cutI].e, want = full.filter((g) => g.ts <= t).map(evKey);
    const cut = events(...frames(B.slice(0, cutI + 1))).filter((g) => g.ts <= t).map(evKey);
    assert.deepEqual(cut, want, 'cut at ' + cutI);
    const r = K.rng(99), C = B.map((b, i) => { if (i <= cutI) return b; const o = 100 + (r() - 0.5) * 6, c = o + (r() - 0.5); return { ...b, o, c, h: Math.max(o, c) + r(), l: Math.min(o, c) - r() }; });
    assert.deepEqual(events(...frames(C)).filter((g) => g.ts <= t).map(evKey), want, 'later prices changed at ' + cutI);
    assert.ok(want.length > 10);
  }
});

test('RESULT.md agrees with result.json and the verdict follows the bar', { skip: !fs.existsSync(new URL('result.json', DIR)) }, () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `) && line.includes(R.headline) && line.endsWith('.**'), line);
  assert.ok(R.headline.length <= 215);
  assert.equal(R.cells.length, 6); assert.deepEqual(R.markets, MARKETS);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.meanNet > 0 && c.disc.tNet >= 2 && c.conf.meanNet > 0 && c.conf.tNet >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
    const rows = md.split('\n').filter((l) => l.startsWith(`| ${c.cell} |`)); assert.equal(rows.length, 2, c.cell);
    assert.ok(rows[0].includes(f3(c.disc.meanNet)) && rows[0].includes(f3(c.disc.mean)) && rows[0].includes(c.disc.tNet.toFixed(2)), c.cell);
    assert.ok(rows[1].includes(f3(c.conf.meanNet)) && rows[1].includes(f3(c.conf.mean)) && rows[1].includes(c.conf.tNet.toFixed(2)), c.cell);
  }
  const anyN = R.cells.some((c) => c.checks.n);
  assert.equal(R.verdict, !anyN ? 'INCONCLUSIVE' : R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  const best = R.cells.find((c) => c.cell === R.best);
  assert.ok(R.headline.includes(f3(best.conf.meanNet)) && R.headline.includes(best.conf.tNet.toFixed(2)) && R.headline.includes(Math.round(best.conf.n).toLocaleString('en-US')));
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
  assert.ok(R.cut.length >= 5);
});

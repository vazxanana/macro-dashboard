// tests/smc-sweep-fvg.test.mjs - research/edge/smc-sweep-fvg: no look-ahead in the setups, stops on the losing side, the
// timing helper agrees with grid 3's multi(), RESULT.md pinned to result.json. Offline (seeded candles only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { signals, fvg, placeboEntry, track } from '../research/edge/smc-sweep-fvg/run.mjs';
import { multi } from '../research/edge/combo-grid-3/run.mjs';

const T0 = Date.UTC(2009, 11, 1) / 1000; // signals start 30 days before 2010
function market(n, seed = 3, t0 = T0) {
  const R = K.rng(seed), out = []; let px = 100;
  for (let i = 0; i < n; i++) { const o = px, c = o + (R() - 0.5) * 0.6 + (Math.sin(i / 400) * 0.05), h = Math.max(o, c) + R() * 0.3, l = Math.min(o, c) - R() * 0.3;
    out.push({ t: t0 + i * 300, o, h, l, c, e: t0 + (i + 1) * 300 }); px = c; }
  return out;
}
const key = (g) => JSON.stringify({ s: g.s, j: g.j, t0: g.t0, bias: g.bias, pool: g.pool, e50: g.e50, stop: g.stop, pdOk: g.pdOk, fvg: g.fvg, opp: g.oppPx.slice(0, 5) });

test('setups found by a moment do not move when every later price changes (cut test)', () => {
  const M = market(40000);
  const all = signals(M, 'xau');
  assert.ok(all.length > 20, 'enough setups on the seeded market: ' + all.length);
  for (const cut of [12000, 25321, 33000]) {
    const cutT = M[cut - 1].e;
    const M2 = M.slice(0, cut).concat(market(40000 - cut, 77).map((b, k) => ({ ...b, t: M[cut + k].t, e: M[cut + k].e, o: b.o + 7, h: b.h + 7, l: b.l + 7, c: b.c + 7 })));
    const a = all.filter((g) => g.t0 <= cutT).map(key), b = signals(M2, 'xau').filter((g) => g.t0 <= cutT).map(key);
    assert.deepEqual(b, a);
  }
});

test('every setup: stop on the losing side, entry between the stop and the close, the gap after the extreme', () => {
  const M = market(40000, 9);
  for (const g of signals(M, 'eurusd')) {
    assert.ok(g.s * (g.e50 - g.stop) > 0);
    assert.ok(g.s * (M[g.j].c - g.e50) > 0);
    assert.ok(g.fvg.k > g.xi && g.fvg.k <= g.j && g.fvg.bot < g.fvg.top);
    assert.ok(g.t0 >= g.sweepT);
    for (const x of g.oppPx) assert.ok(g.s * (x - g.e50) > 0);
  }
});

test('fvg takes the latest gap whose 50 % is not reached', () => {
  const b = (l, h) => ({ o: l, c: h, l, h });
  const M = [b(10, 11), b(9, 10), b(10, 11), b(10.5, 12), b(12.5, 13), b(11.5, 14), b(13.5, 14), b(14, 15)];
  // gaps for a buy after candle 2: k=4 (12.5 > 11), k=6 (13.5 > 13); candle 7's low 14 does not reach 13.25 -> k=6
  assert.deepEqual(fvg(M, 1, 2, 7), { k: 6, bot: 13, top: 13.5 });
  M[7] = b(13.2, 15); // now 13.25 is reached after k=6, and 11.75 after k=4 by candle 5 (11.5) -> none
  assert.equal(fvg(M, 1, 2, 7), null);
});

test('placebo entry: a same-colour body below the close, not reached since', () => {
  const M = market(3000, 5), R = K.rng(1);
  for (let j = 100; j < 3000; j += 37) {
    const e = placeboEntry(M, 1, j, R); if (e == null) continue;
    assert.ok(e < M[j].c);
  }
});

test('track() and multi() agree on fills and on the 2R result', () => {
  const M = market(40000, 3); let n = 0;
  for (const g of signals(M, 'xau')) {
    const risk = g.s * (g.e50 - g.stop), exp = g.t0 + 24 * 300, tgt = g.e50 + g.s * 2 * risk;
    const tr = track(M, g.s, g.e50, g.stop, tgt, g.t0, exp, 86400), r = multi(M, g.s, g.e50, g.stop, 'lim', g.t0, exp, 2, null, 86400, null);
    if (tr.fill == null) assert.equal(r, null);
    else if (r == null) assert.ok(g.s * (tr.fill - g.stop) <= 0 || tr.busy === Infinity); // gapped past the stop / still open
    if (r && tr.px != null) { assert.ok(Math.abs((g.s * (tr.px - tr.fill)) / r.risk - r.R[1]) < 1e-9); n++; }
  }
  assert.ok(n > 5);
});

test('RESULT.md is pinned to result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/smc-sweep-fvg/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/smc-sweep-fvg/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.ok(r.headline.startsWith('FAIL, 0 of 3'));
  const line3 = md.split('\n')[2];
  assert.match(line3, /^\*\*Verdict: FAIL\./);
  const t1 = r.tests.T1.before.all;
  assert.ok(line3.includes(t1.n.toLocaleString('en-US')) && line3.includes('+' + t1.meanR.toFixed(3) + 'R') && line3.includes('month t ' + t1.tMonth));
  assert.ok(line3.includes(r.tests.T1.after.all.meanR.toFixed(3).replace('-', '-')));
  for (const id of ['T1', 'T2', 'T3']) {
    const x = r.tests[id]; assert.equal(x.pass, false);
    assert.ok(md.includes(x.before.all.n.toLocaleString('en-US')), id + ' n');
    assert.ok(md.includes(x.before.disc.tMonth.toFixed(2)) && md.includes(x.before.conf.tMonth.toFixed(2)), id + ' halves');
    assert.ok(md.includes(String(x.vsPlacebo.t)), id + ' placebo t');
  }
  for (const [m, v] of Object.entries(r.perMarket)) assert.ok(md.includes(`| ${m} | ${v.T1.before.n} |`), m);
});

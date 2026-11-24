// tests/eg-chain-msnr-side.test.mjs - the H4 > H1 > M15 engulf chain split by the H4 direction call: the pre-registration,
// RESULT.md against result.json, the verdict against the bar, and the study's pieces on seeded candles (offline, no cache).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../research/edge/eg-chain-msnr-side/run.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';

const DIR = new URL('../research/edge/eg-chain-msnr-side/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const f2 = (x) => (x < 0 ? '-' : '') + Math.abs(x).toFixed(2);

test('the pre-registration names the chain, the call, the cells, the windows and the bar', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['H4 > H1 > M15', 'WITH', 'AGAINST', 'Daily key levels', '12 judged', 'touch', 'through', '2005-01-01 to 2014-12-31',
    '2015-01-01 to 2026-10-31', 'Holm', 'AFTER costs', 'One run, no variants'])
    assert.ok(p.includes(w), w);
});

test('line 3 of RESULT.md is the verdict line of result.json, and the verdict follows the bar', () => {
  assert.equal(md.split('\n')[2], `**Verdict: ${R.verdict}. ${R.headline}.**`);
  assert.equal(R.cells.length, 12);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.meanNet > 0 && c.conf.meanNet > 0 && c.disc.tNet >= 2 && c.conf.tNet >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
  }
  const anyN = R.cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : anyN ? 'FAIL' : 'INCONCLUSIVE');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  // the headline's figures are the best cell's
  const best = [...R.cells].sort((a, b) => b.conf.tNet - a.conf.tNet)[0];
  assert.equal(R.best, best.cell);
  assert.ok(R.headline.includes(best.cell) && R.headline.includes(`${f3(best.conf.meanNet)}R`) && R.headline.includes(`month t ${f2(best.conf.tNet)}`)
    && R.headline.includes(`n ${Math.round(best.conf.n).toLocaleString('en-US')}`));
  assert.deepEqual(R.markets, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
});

test('RESULT.md lists every cell with its figures from result.json, before and after costs', () => {
  for (const c of [...R.cells, ...R.allOrders]) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    for (const w of [c.disc, c.conf]) { assert.ok(row.includes(`${f3(w.mean)} (${f2(w.t)})`), c.cell + ' before'); assert.ok(row.includes(`${f3(w.meanNet)} (${f2(w.tNet)})`), c.cell + ' after'); }
  }
  // WITH + AGAINST never exceed all orders
  for (let i = 0; i < 6; i++) assert.ok(R.cells[i].conf.n + R.cells[i + 6].conf.n <= R.allOrders[i].conf.n);
});

test('the cut test of the real run found no look-ahead', () => {
  assert.equal(R.cut.length, 25);
  assert.ok(R.cut.some((x) => x.n > 0));
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

// a seeded 5-minute walk, about 150 days
function walk(seed = 11, days = 150) {
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const M5 = []; let px = 100; const t0 = Date.UTC(2020, 0, 6) / 1000;
  for (let i = 0; i < days * 288; i++) { const t = t0 + i * 300, o = px; px = Math.max(1, px + (rnd() - 0.5) * 0.4 + Math.sin(i / 900) * 0.03);
    M5.push({ t, o, h: Math.max(o, px) + rnd() * 0.1, l: Math.min(o, px) - rnd() * 0.1, c: px, e: t + 300 }); }
  return M5;
}

test('seeded candles: slots index, every order has its stop on the losing side, and a cut series knows the same orders', () => {
  for (let i = 0; i < M.NS; i++) { const n = M.slotName(i); assert.equal(M.slot(n.sd, n.f, n.x), i); }
  const M5 = walk(), F = frames(M5), { ord } = M.orders(F);
  assert.ok(ord.length > 50, 'orders ' + ord.length);
  assert.ok(ord.some((o) => o.call === o.s) && ord.some((o) => o.call === -o.s), 'both sides of the call');
  for (const o of ord) { assert.ok([1, -1].includes(o.s)); assert.ok([-1, 0, 1].includes(o.call)); assert.ok(o.s * (o.entry - o.stop) > 0, 'stop side'); }
  const T = M5[0].t + 110 * 86400 + 3600 * 7;
  const r = M.cutTest(M5, 'seed', [new Date(T * 1000).toISOString().slice(0, 10)], ord)[0];
  assert.ok(r.n > 20); assert.equal(r.missing, 0); assert.equal(r.extra, 0);
  // later prices do not move earlier orders: change every candle after T
  const M5b = M5.map((b) => (b.t < T ? b : { ...b, o: b.o * 1.3, h: b.h * 1.3, l: b.l * 1.3, c: b.c * 1.3 }));
  const key = (o) => [o.s, o.K, o.entry, o.stop, o.call].join('|');
  assert.deepEqual(M.orders(frames(M5b)).ord.filter((o) => o.K <= T).map(key), ord.filter((o) => o.K <= T).map(key));
});

test('seeded candles: fills, the trade-through rule, the stop on the losing side of the fill, and the accumulators', () => {
  const M5 = walk(5), F = frames(M5), { ord, Z4 } = M.orders(F); let filledT = 0, filledX = 0;
  for (const o of ord) {
    const dead = M.deadOf(F['15m'], o); assert.ok(dead > o.K && dead <= o.K + M.FILL * 900 + 3 * 86400);
    const a = M.fillOf(M5, o, dead, 0), b = M.fillOf(M5, o, dead, 0.05);
    if (a) { filledT++; assert.ok(M5[a.fi].t >= o.K, 'fill after the order is known'); assert.ok(o.s > 0 ? a.fill <= o.entry : a.fill >= o.entry); }
    if (b) { filledX++; assert.ok(a && b.fi >= a.fi, 'a trade-through fill is never earlier than a touch'); }
    const x = M.runOrder(M5, F['15m'], Z4, o, 0, 0.01);
    if (x.R) { assert.ok(x.risk > 0 && x.cr > 0); assert.ok(Number.isFinite(x.R[0]) && Number.isFinite(x.R[1])); assert.ok(o.s * (x.fill - o.stop) > 0 || x.gap, 'stop on the losing side of the fill'); }
  }
  assert.ok(filledT > 10 && filledX <= filledT);
  const r = M.runFrames(F, 'seed', 0.01);
  const n = (sd) => r.acc.n[M.slot(sd, 0, 0) * 2 + 1];
  assert.equal(r.cnt.with + r.cnt.against + r.cnt.noCall, r.cnt.orders);
  assert.ok(n(2) > 0 && n(0) + n(1) <= n(2));
  // after costs is never better than before costs
  for (let c = 0; c < M.NS; c++) assert.ok(r.acc.net[c * 2 + 1] <= r.acc.sum[c * 2 + 1] + 1e-9);
});

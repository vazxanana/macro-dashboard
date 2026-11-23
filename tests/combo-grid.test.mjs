// tests/combo-grid.test.mjs - the combination grid (research/edge/combo-grid): indexing, the one-pass exits, no look-ahead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { comboIndex, comboName, NCOMBO, multi, frames, signalsFor, ZONES, CHAINS } from '../research/edge/combo-grid/run.mjs';

test('every combination has one index and a name', () => {
  assert.equal(NCOMBO, 5 * 8 * 2 * 5 * 47 * 7);
  const seen = new Set();
  for (let ch = 0; ch < 5; ch++) for (let z = 0; z < 8; z++) for (let v = 0; v < 2; v++) for (let d = 0; d < 5; d++) for (let te = 0; te < 47; te++) for (let x = 0; x < 7; x++) {
    const c = comboIndex(ch, z, v, d, te, x); assert.ok(c >= 0 && c < NCOMBO); seen.add(c); }
  assert.equal(seen.size, NCOMBO);
  const n = comboName(comboIndex(1, 2, 1, 3, 45, 6));
  assert.deepEqual(n, { chain: '4h>1h', zone: 'ef', visit: 'first2', dir: 'msnr', trig: 'none', es: 'zedge', exit: 'trail' });
  assert.equal(comboName(comboIndex(0, 0, 0, 0, 9 + 3 + 2, 0)).es, 'half/ext');
});

const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });

test('one pass gives each exit: targets, stop first, a limit fill candle only stops, the trail', () => {
  // a buy limit at 100, stop 99 (1R = 1): fills on the first candle; the fill candle's high (105) must not count
  const B = [bar(0, 101, 105, 99.5, 100.5), bar(300, 100.5, 102.2, 100.2, 102), bar(600, 102, 103.1, 101.5, 103), bar(900, 103, 103.2, 101, 101.1), bar(1200, 101, 101, 98.5, 99)];
  const r = multi(B, 1, 100, 99, 'lim', 0, 3600, 5, 86400);
  assert.equal(r.risk, 1);
  assert.deepEqual([...r.R].map((x) => +x.toFixed(4)), [1, 2, 3, -1, -1, -1, 2.1]);   // 1R 2R 3R hit; 4R, 6R and the 5R opposite zone stopped; the trail (1R behind the best, 103.1) exits at 102.1
});

test('a gap through the stop exits at the open; a market entry fills at the next open', () => {
  const B = [bar(0, 100, 100.5, 99.8, 100.2), bar(300, 97, 97.5, 96, 96.5)];
  const r = multi(B, 1, null, 99, 'mkt', 0, 0, 2, 86400);
  assert.equal(r.risk, 1);
  assert.equal(+r.R[0].toFixed(4), -3); // open 97 against a stop at 99
});

function seeded(n, seed = 3) {
  let a = seed, px = 1.1; const out = []; const t0 = Date.UTC(2019, 9, 1) / 1000;
  for (let i = 0; i < n; i++) { a = (a * 1103515245 + 12345) % 2147483648; const r = a / 2147483648 - 0.5; const o = px; px = Math.max(0.5, px + r * 0.0012);
    const h = Math.max(o, px) + Math.abs(r) * 0.0004, l = Math.min(o, px) - Math.abs(r) * 0.0004; const t = t0 + i * 300;
    if (new Date(t * 1000).getUTCDay() === 6) continue; out.push({ t, o, h, l, c: px, e: t + 300 }); }
  return out;
}

test('no look-ahead: signals before a cut do not change when every later candle is removed', () => {
  const M5 = seeded(90000), cut = M5[60000].t;
  const A = frames(M5), B = frames(M5.filter((b) => b.t < cut));
  const key = (s) => [s.z.d, s.z.at, s.z.bot, s.z.top, s.visit, s.trig, s.j, s.tz && s.tz.join(','), s.ext].join('|');
  let n = 0;
  for (const [tfL, tfT] of CHAINS.slice(1)) for (const z of ZONES) {
    const ts = (s, T) => (s.trig === 5 ? T[s.k0].t : T[s.j].e);
    const a = signalsFor(A, tfL, tfT, z, {}).filter((s) => ts(s, A[tfT]) < cut - 3 * 86400).map(key).sort();
    const b = signalsFor(B, tfL, tfT, z, {}).filter((s) => ts(s, B[tfT]) < cut - 3 * 86400).map(key).sort();
    assert.deepEqual(a, b, tfL + '>' + tfT + ' ' + z); n += a.length; }
  assert.ok(n > 100);
});

test('the USD/JPY follow-up: gate and verdict as reported', async () => {
  const fs = await import('node:fs');
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/usdjpy-dom-ef/result.json', import.meta.url)));
  assert.equal(r.gate.IS.n, 1292); assert.equal(r.gate.OOS.n, 968);
  assert.equal(r.verdict, 'FAIL'); assert.ok(r.markets.usdjpy.all.meanR < 0);
  const md = fs.readFileSync(new URL('../research/edge/usdjpy-dom-ef/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, /4,500 \| -0\.076 \| -3\.58/);
  const g = JSON.parse(fs.readFileSync(new URL('../research/edge/combo-grid/result.json', import.meta.url)));
  assert.equal(g.confirmed, 0); assert.equal(g.tested, 463064);
});

test('the limit fill comes first: a candle reaching the limit and closing past the stop is a fill and a stop', () => {
  const B = [bar(0, 101, 101.2, 98.5, 98.7), bar(300, 98.7, 99, 98, 98.5)];
  const r = multi(B, 1, 100, 99, 'lim', 0, 3600, 2, 86400);
  assert.ok(r); assert.equal(r.R[0], -1);
});

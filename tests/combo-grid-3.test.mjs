// tests/combo-grid-3.test.mjs - combination grid 3 (research/edge/combo-grid-3): size, the far target, the M5 EF trail,
// the limit fill order, and no look-ahead for the M30 chains and the VR -> CF of two QMs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NCOMBO, CHAINS, DIRS, EXITS, multi, frames, signalsFor } from '../research/edge/combo-grid-3/run.mjs';

test('grid 3 has 11 chains, 14 filters, 9 exits', () => {
  assert.equal(CHAINS.length, 11); assert.equal(DIRS.length, 14); assert.equal(EXITS.length, 9);
  assert.equal(NCOMBO, 11 * 9 * 1 * 14 * 96 * 9);
});

const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
test('a limit reached by a candle that closes past the stop is filled and stopped, not cancelled', () => {
  const B = [bar(0, 101, 101.2, 98.5, 98.7), bar(300, 98.7, 99, 98, 98.5)];
  const r = multi(B, 1, 100, 99, 'lim', 0, 3600, 2, null, 86400, null);
  assert.ok(r); assert.equal(r.R[0], -1); assert.ok(Number.isNaN(r.R[7]));   // stopped; no far target given
});

test('the far target and the M5 EF trail', () => {
  // buy at the first open 100, stop 99; far target 4R (104). A failing opposite M5 zone (98.9-99.6) would put the EF trail's
  // stop at its bottom 98.9, below the stop: no move. A second one (99.5-100.5) moves it to 99.5; the fall then exits there.
  const B = [bar(0, 100, 100.4, 99.8, 100.2), bar(300, 100.2, 101, 100, 100.9), bar(600, 100.9, 102, 100.8, 101.8), bar(900, 101.8, 104.2, 101.7, 104), bar(1200, 104, 104, 99, 99.2)];
  const ef = new Map([[1, [{ d: -1, top: 99.6, bot: 98.9 }]], [2, [{ d: -1, top: 100.5, bot: 99.5 }]]]);
  const r = multi(B, 1, null, 99, 'mkt', 0, 0, 2, 4, 86400, ef);
  assert.equal(r.R[7], 4);          // far target reached at 104
  assert.equal(+r.R[8].toFixed(4), -0.5);  // the EF trail exits at 99.5: (99.5 - 100) / 1
});

function seeded(n, seed = 11) {
  let a = seed, px = 1.2; const out = []; const t0 = Date.UTC(2019, 9, 1) / 1000;
  for (let i = 0; i < n; i++) { a = (a * 1103515245 + 12345) % 2147483648; const r = a / 2147483648 - 0.5; const o = px; px = Math.max(0.5, px + r * 0.0015);
    const h = Math.max(o, px) + Math.abs(r) * 0.0005, l = Math.min(o, px) - Math.abs(r) * 0.0005; const t = t0 + i * 300;
    if (new Date(t * 1000).getUTCDay() === 6) continue; out.push({ t, o, h, l, c: px, e: t + 300 }); }
  return out;
}
test('no look-ahead on the M30 chains (every trigger, the two-QM VR -> CF included)', () => {
  const M5 = seeded(80000), cut = M5[55000].t;
  const A = frames(M5), B = frames(M5.filter((b) => b.t < cut));
  const key = (s) => [s.z.d, s.z.at, s.z.bot, s.z.top, s.visit, s.trig, s.j, s.tz && s.tz.join(','), s.ext].join('|');
  let n = 0, nq = 0;
  for (const [tfL, tfT] of [['4h', '30m'], ['1h', '30m'], ['30m', '15m'], ['30m', '5m']]) for (const z of ['eg', 'qm', 'bar']) {
    const ts = (s, T) => (s.trig === 6 ? T[s.k0].t : T[s.j].e);
    const a = signalsFor(A, tfL, tfT, z, {}).filter((s) => ts(s, A[tfT]) < cut - 3 * 86400);
    const b = signalsFor(B, tfL, tfT, z, {}).filter((s) => ts(s, B[tfT]) < cut - 3 * 86400);
    assert.deepEqual(a.map(key).sort(), b.map(key).sort(), tfL + '>' + tfT + ' ' + z); n += a.length; nq += a.filter((s) => s.trig === 5).length; }
  assert.ok(n > 100); assert.ok(nq > 0);
});

test('the grid 3 result: counts as reported', async () => {
  const fs = await import('node:fs');
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/combo-grid-3/result.json', import.meta.url)));
  assert.equal(r.after.confirmed, 0); assert.equal(r.before.confirmed, 9); assert.equal(r.after.tested, 2426380);
  assert.equal(r.before.confirmedList.filter((x) => x.zone === 'dom' && x.trig === 'none').length, 8);
  const md = fs.readFileSync(new URL('../research/edge/combo-grid-3/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, /\| 1,740 \| 44 \|/);
});

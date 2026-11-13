// research/edge/mosha-bo-er: the ER at an order's time (closed days only), the market entry switch on a hand-made sequence,
// the reversal-range split, net R with costs and financing, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = await import('../research/edge/mosha-bo-er/run.mjs');
const { FIN, nights } = await import('../council/fills.mjs');

// days in gold-drd-long's shape: { t: first H1 candle of the 17:00 New York day, close }
const mk = (closes) => closes.map((c, i) => ({ t: 1000 + i * 86400, close: c }));

test('ER20 by hand: a straight line is 1, a zig-zag is near 0', () => {
  const up = mk(Array.from({ length: 25 }, (_, i) => 100 + i));
  const zig = mk(Array.from({ length: 25 }, (_, i) => 100 + (i % 2)));
  // T inside day 23 (forming): day 22 is the last closed one, so 20 steps from 2 to 22
  assert.equal(M.erAt(up, up[23].t + 10), 1);
  assert.ok(M.erAt(zig, zig[23].t + 10) < 0.06);
  // straight 10 up, then 10 back half way: |5| / 15
  const v = mk([...Array.from({ length: 11 }, (_, i) => i), ...Array.from({ length: 10 }, (_, i) => 10 - (i + 1) / 2), 99]);
  assert.ok(Math.abs(M.erAt(v, v[21].t + 1) - 5 / 15) < 1e-12);
});

test('ER never reads the forming day (no look-ahead)', () => {
  const a = mk(Array.from({ length: 25 }, (_, i) => 100 + i));
  const T = a[23].t + 3600, before = M.erAt(a, T);
  const b = a.map((d, i) => (i >= 23 ? { ...d, close: d.close * 50 } : d));   // change every price from the forming day on
  assert.equal(M.erAt(b, T), before);
  assert.equal(M.erAt(a, a[20].t + 1), null);   // fewer than 21 closed days
});

test('the market entry switch: same stop price, risk from the market fill, every R rule in that risk', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'research/edge/mosha-bo-er/run.mjs'), 'utf8');
  assert.match(src, /const me = fx\(M5\[j\]\.close\), mr = Math\.abs\(me - stop\)/);
  assert.match(src, /t1: fx\(me \+ d \* 10 \* mr\)/);
  assert.doesNotMatch(src, /stop: fx\(me/);   // the stop price is never recomputed from the market entry
  const replay = await M.loadReplay();
  assert.equal(typeof replay, 'function');
});

test('the reversal range: case 2 inside the box, beyond it otherwise (buy and sell)', () => {
  const hb = [{ time: 0, high: 110, low: 100 }, { time: 3600, high: 120, low: 105 }, { time: 7200, high: 130, low: 90 }];
  // buy: H4 break at 3600 + 14400 (candle from 3600), H1 break against at 7200 took 108; extreme 120 (the 7200 candle is after it)
  const e1 = { t: 3600 + 14400 }, e2 = { t: 7200, level: 108 };
  assert.equal(M.vrOf(hb, e1, e2, { level: 112 }, 1).case2, true);
  assert.equal(M.vrOf(hb, e1, e2, { level: 104 }, 1).case2, false);
  assert.deepEqual(M.vrOf(hb, e1, e2, { level: 112 }, 1).box, [108, 120]);
  assert.deepEqual(M.vrOf(hb, e1, e2, { level: 103 }, -1).box, [105, 108]);
  assert.equal(M.vrOf(hb, e1, e2, { level: 107 }, -1).case2, true);
});

test('positions: $0.30 a unit and financing on buy units, sells pay none; a unit without a stop is refused', () => {
  const t = Date.UTC(2024, 0, 2) / 1000, c = t + 3 * 86400;
  const legs = [
    { id: 'a', side: 'buy', entry: 2000, stop: 1995, r0: 5, R: 2, size: 1, opened: t, filled: t, closed: c, status: 'closed' },
    { id: 'a-add', addOf: 'a', side: 'buy', entry: 2007.5, stop: 2000, r0: 7.5, R: 1, size: 1.5, opened: t, filled: t, closed: c, status: 'closed' },
    { id: 'b', side: 'sell', entry: 2000, stop: 2004, r0: 4, R: -1, opened: t, filled: t, closed: c, status: 'closed' },
    { id: 'x', side: 'sell', entry: 2000, stop: 2004, r0: 4, R: 0, opened: t, closed: c, status: 'expired' },
    { id: 's', side: 'sell', entry: 2000, stop: 2004, r0: 4, R: 3, opened: t, filled: t, closed: c, status: 'closed', shadow: true },
  ];
  const P = M.positions(legs), n = nights(t, c), f = (e, r) => n * FIN.xau.long * e / r;
  assert.equal(P.length, 2);
  const a = P.find((p) => p.id === 'a'), b = P.find((p) => p.id === 'b');
  assert.ok(Math.abs(a.R - ((2 - 0.3 / 5 - f(2000, 5)) + (1 - 0.3 / 7.5 - f(2007.5, 7.5)) * 1.5)) < 1e-12);
  assert.ok(Math.abs(b.R - (-1 - 0.3 / 4)) < 1e-12);
  assert.throws(() => M.positions([{ id: 'z', side: 'buy', entry: 1, r0: 0, R: 0, filled: t, closed: c, status: 'closed' }]), /without a stop/);
});

test('month sums count every month, 0 when empty', () => {
  const t = (y, m) => Date.UTC(y, m, 5) / 1000;
  const s = M.monthSums([{ t: t(2020, 0), R: 1 }, { t: t(2020, 0), R: 2 }, { t: t(2020, 2), R: -1 }], t(2020, 3));
  assert.deepEqual(s, [3, 0, -1, 0]);
});

test('RESULT.md says what result.json says', () => {
  const dir = path.join(ROOT, 'research/edge/mosha-bo-er');
  const j = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')), md = fs.readFileSync(path.join(dir, 'RESULT.md'), 'utf8');
  const first = md.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(first, 'RESULT.md opens with the verdict');
  assert.equal(/A[^;]*PASS/.test(j.verdict), /Arm A[^.]*PASS/.test(first));
  assert.equal(/B[^;]*PASS/.test(j.verdict), /Arm B[^.]*PASS/.test(first));
  const f = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);
  for (const v of [j.A.kept.h1.avg, j.A.kept.h2.avg, j.A.all.h1.avg, j.A.all.h2.avg, j.B.market.h1.avg, j.B.market.h2.avg, j.B.limit.h1.avg, j.B.limit.h2.avg])
    assert.ok(md.includes(f(v)), `RESULT.md lacks ${f(v)}`);
  for (const v of [j.A.welchTrades.t, j.B.welchTrades.t, j.A.welchMonths.t, j.B.welchMonths.t]) assert.ok(md.includes(String(v)) || md.includes(String(v).replace('-', '−')), `RESULT.md lacks t ${v}`);
  assert.ok(md.includes(String(j.A.pHolm)) && md.includes(String(j.B.pHolm)));
  assert.ok(md.includes(`${j.A.placebo.pass} / ${j.A.placebo.draws}`));
  assert.equal(j.params.FROM, Date.UTC(2020, 0, 1) / 1000);
});

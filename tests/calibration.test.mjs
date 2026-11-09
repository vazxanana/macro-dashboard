// node --test tests/calibration.test.mjs — the veteran's self-calibration (council/calibration.mjs): the pre-registered
// threshold, the shrink / widen math, monotonicity, reliability bins, and the wiring into the veteran's calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../council/calibration.mjs';
import { callsLedger } from '../council/outlook.mjs';

let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const day = (i) => new Date(Date.UTC(2026, 0, 2) + i * 86400e3).toISOString().slice(0, 10);
// n scored calls over `weeks` due weeks; true chance of each = base + truth * (stated − base)
function rec(n, { weeks = 8, truth = 1, base = 0.5, spread = 0.2, src } = {}) {
  seed = 7; const out = [];
  for (let i = 0; i < n; i++) { const p = +(base + (rnd() * 2 - 1) * spread).toFixed(2), q = base + truth * (p - base);
    out.push({ id: `c${i}`, p, baseP: base, hit: rnd() < q, by: day((i % weeks) * 7), ...(src ? { src } : {}) }); }
  return out;
}

test('threshold: k stays exactly 1 below 30 scored calls or below 4 due weeks; the desk line says so', () => {
  const few = C.calibration({ calls: rec(29, { truth: 0 }) });
  assert.equal(few.status, 'waiting'); assert.equal(few.k, 1); assert.equal(few.n, 29);
  assert.match(few.line, /^Not enough scored calls yet: 29 of 30/);
  const oneWeek = C.calibration({ calls: rec(60, { truth: 0, weeks: 1 }) });
  assert.equal(oneWeek.status, 'waiting'); assert.equal(oneWeek.k, 1); assert.match(oneWeek.line, /over 1 of 4 weeks/);
  const none = C.calibration({}); assert.equal(none.n, 0); assert.equal(none.k, 1); assert.equal(none.bins.length, 10);
  // open calls never count
  assert.equal(C.calibration({ calls: rec(40).map((r) => ({ ...r, hit: null })) }).n, 0);
  assert.equal(C.MIN_SCORED, 30); assert.equal(C.MIN_WEEKS, 4);
});

test('shrink math: overconfident record → k < 1, underconfident → k > 1, calibrated → about 1; least squares with the prior', () => {
  const over = C.calibration({ calls: rec(400, { truth: 0 }) });   // outcomes ignore the tilt: pure overconfidence
  assert.equal(over.status, 'active'); assert.equal(over.state, 'shrinking'); assert.ok(over.k < 0.6, String(over.k));
  const under = C.calibration({ calls: rec(3000, { truth: 2, spread: 0.12 }) });
  assert.equal(under.state, 'widening'); assert.ok(under.k > 1.2, String(under.k));
  const ok = C.calibration({ calls: rec(2000, { truth: 1 }) }); assert.ok(Math.abs(ok.k - 1) < 0.2, String(ok.k));
  // the closed form on a hand-made record: k = (Σ d (y − b) + PRIOR) / (Σ d² + PRIOR)
  const R = [{ pRaw: 0.7, base: 0.5, y: 1 }, { pRaw: 0.7, base: 0.5, y: 0 }, { pRaw: 0.3, base: 0.5, y: 0 }];
  const sxy = 0.2 * 0.5 + 0.2 * -0.5 + -0.2 * -0.5, sxx = 3 * 0.04;
  assert.equal(C.fitShrink(R).k, +((sxy + C.PRIOR) / (sxx + C.PRIOR)).toFixed(3));
  // clamped, and calls with no base or no departure carry no weight
  assert.equal(C.fitShrink([{ pRaw: 0.9, base: 0.5, y: 0 }], { prior: 0 }).k, C.K_BOUNDS[0]);
  assert.equal(C.fitShrink([{ pRaw: 0.6, base: null, y: 0 }, { pRaw: 0.5, base: 0.5, y: 1 }]).k, 1);
  // fitted on the raw probabilities, not the already adjusted ones
  const adj = rec(400, { truth: 0 }).map((r) => ({ ...r, pRaw: r.p, p: C.adjust(r.p, r.baseP, 0.5) }));
  assert.equal(C.calibration({ calls: adj }).k, over.k);
});

test('adjust: base stays base, monotonic in p for every k, inside the band, deterministic', () => {
  for (const k of [0.25, 0.5, 1, 1.5]) {
    assert.equal(C.adjust(0.56, 0.56, k), 0.56);
    let last = -1; for (let p = 0; p <= 1.0001; p += 0.01) { const q = C.adjust(p, 0.55, k, [0.1, 0.9]); assert.ok(q >= last, `k ${k} p ${p}`); assert.ok(q >= 0.1 && q <= 0.9); last = q; }
  }
  assert.equal(C.adjust(0.8, 0.5, 0.5), 0.65); assert.equal(C.adjust(0.3, 0.5, 0.5), 0.4); assert.equal(C.adjust(0.6, 0.5, 1.5), 0.65);
  assert.equal(C.adjust(0.7, null, 0.5), 0.7, 'no base: untouched');
  const a = rec(100, { truth: 0 }), b = rec(100, { truth: 0 }); assert.deepEqual(C.calibration({ calls: a }), C.calibration({ calls: b }));
});

test('reliability bins and records: stated vs came true, Wilson interval, all three record kinds', () => {
  const calls = [{ p: 0.62, hit: true, baseP: 0.5, by: '2026-11-13' }, { p: 0.65, hit: false, baseP: 0.5, by: '2026-11-13' }, { p: 1, hit: true, by: '2026-11-20' },
    { p: 0.3, hit: false, base: { all: 0.4 }, src: 'veteran hypothesis', by: '2026-11-13' }, { p: 0.6, baseP: 0.48, hit: true, src: 'COT extreme', by: '2026-11-20' }, { p: 0.4, hit: null, by: '2026-11-27' }];
  const ledger = [{ record_type: 'issued', forecast_id: 'f1', forecast: { distribution: { event_probability: 0.6 }, base_rate: { probability: 0.56 } } },
    { record_type: 'resolved', forecast_id: 'f1', resolution: { outcome: true, resolved_at_utc: '2026-12-04T00:00:00Z' } }];
  const R = C.records({ calls, ledger });
  assert.equal(R.length, 6); assert.deepEqual(R.map((x) => x.src).sort(), ['call', 'call', 'call', 'cot', 'hypothesis', 'ledger']);
  assert.equal(R.find((x) => x.src === 'hypothesis').base, 0.4);
  const B = C.reliability(R); assert.equal(B.length, 10);
  const b6 = B[6]; assert.equal(b6.n, 4); assert.equal(b6.came, 0.75); assert.equal(b6.stated, +((0.62 + 0.65 + 0.6 + 0.6) / 4).toFixed(3));
  assert.equal(B[9].n, 1, 'a 100% call lands in the top bin'); assert.ok(b6.ci[0] < 0.75 && b6.ci[1] > 0.75);
  assert.deepEqual(C.wilson(0, 0), [null, null]);
  const cal = C.calibration({ calls, ledger }); assert.equal(cal.n, 6); assert.equal(cal.weeks, 3); assert.ok(cal.brierBase != null);
});

test('wiring: applied calls keep pRaw; the calls ledger records baseP and pRaw; inactive calibration changes nothing', () => {
  const list = [{ p: 0.7, baseP: 0.5, kind: 'closeAbove', asset: 'gold', level: 1, by: '2026-11-13', claim: 'x' }, { p: 0.6, base: { all: 0.5 }, kind: 'stayInside', asset: 'gold', lo: 1, hi: 2, by: '2026-11-13', claim: 'y', id: 'hyp:w:H2' }];
  C.applyCalls(list, { status: 'waiting', k: 0.5 }); assert.deepEqual(list.map((c) => c.p), [0.7, 0.6]);
  C.applyCalls(list, { status: 'active', k: 0.5 }); assert.deepEqual(list.map((c) => c.p), [0.6, 0.55]); assert.deepEqual(list.map((c) => c.pRaw), [0.7, 0.6]);
  C.applyCalls(list, { status: 'active', k: 0.5 }); assert.deepEqual(list.map((c) => c.p), [0.6, 0.55], 'idempotent: always from pRaw');
  const L = callsLedger([], { outlook: { week: { list } }, closesBy: {}, now: Date.UTC(2026, 10, 9) / 1000 });
  assert.equal(L[0].baseP, 0.5); assert.equal(L[0].pRaw, 0.7); assert.equal(L[0].p, 0.6);
});

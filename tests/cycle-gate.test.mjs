// research/edge/cycle-gate: the gate's state machine on hand-made candles and events, no look-ahead, and RESULT.md against
// result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cycleEvents, stateAt, keeps, splitStats, maxDD, welch, K } from '../research/edge/cycle-gate/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/cycle-gate');
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const MD = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');

const bar = (time, o, h, l, c) => ({ time, open: o, high: h, low: l, close: c });

test('states: move, pullback, resumed, and a new H4 break starts again', () => {
  const ev = { e4: [{ t: 100, dir: 1 }, { t: 1000, dir: -1 }], e1: [{ t: 90, dir: -1 }, { t: 200, dir: 1 }, { t: 300, dir: -1 }, { t: 400, dir: -1 }, { t: 500, dir: 1 }, { t: 600, dir: -1 }, { t: 1100, dir: 1 }] };
  assert.deepEqual(stateAt(ev, 50), { d: 0, t4: null, state: null });
  assert.equal(stateAt(ev, 100).state, 'move');            // the H1 break against at 90 is before the H4 break
  assert.equal(stateAt(ev, 250).state, 'move');            // a break WITH the H4 keeps it a move
  assert.equal(stateAt(ev, 300).state, 'pullback');        // the H1 ChoCh, at its own close time
  assert.equal(stateAt(ev, 450).state, 'pullback');
  assert.equal(stateAt(ev, 500).state, 'resumed');         // a break back with the H4: the pullback is over
  assert.equal(stateAt(ev, 700).state, 'resumed');         // stays resumed until the next H4 break (msCycle)
  const s = stateAt(ev, 1050); assert.equal(s.d, -1); assert.equal(s.state, 'move');
  assert.equal(stateAt(ev, 1100).state, 'pullback');       // an H1 break up against the new H4 down move
});

test('the gates', () => {
  const up = (state) => ({ d: 1, state });
  assert.equal(keeps('G1', 1, up('pullback')), true);
  assert.equal(keeps('G1', -1, up('move')), false);
  assert.equal(keeps('G2', 1, up('move')), true);
  assert.equal(keeps('G2', 1, up('resumed')), true);
  assert.equal(keeps('G2', 1, up('pullback')), false);
  assert.equal(keeps('G2', -1, up('resumed')), false);
  assert.equal(keeps('G3', 1, up('move')), false);
  assert.equal(keeps('G3', 1, up('resumed')), true);
  assert.equal(keeps('G2', -1, { d: 0, state: null }), true);   // no direction yet: kept
});

test('hand-made candles: an H4 break up, then the H1 ChoCh, then the break back', () => {
  const H = 14400, h = 3600;
  // H4: rise to a swing high of 110 (3 lower highs each side), then a close at 112 breaks it
  const hs = [100, 102, 104, 110, 106, 105, 104, 103, 112];
  const H4 = hs.map((x, i) => bar(i * H, x - 1, x, x - 3, i === 8 ? 111.5 : x - 1));
  // H1 after the H4 break: a swing low then a close under it (against), a swing high then a close over it (with)
  const t0 = 9 * H;
  const lows = [108, 107, 106, 107, 108, 105.5], H1 = [];
  lows.forEach((l, i) => H1.push(bar(t0 + i * h, l + 1, l + 2, l, i === 5 ? 105.6 : l + 1.5)));
  const hi = [107, 109, 108, 110];
  hi.forEach((x, i) => H1.push(bar(t0 + (6 + i) * h, x - 1, x, x - 1.5, i === 3 ? 109.8 : x - 0.5)));
  const ev = cycleEvents(H4, H1);
  assert.ok(ev.e4.some((e) => e.dir === 1 && e.t === 9 * H), 'H4 break up at the close of the breaking candle');
  assert.equal(stateAt(ev, 9 * H).state, 'move');
  const choch = ev.e1.find((e) => e.dir === -1 && e.t >= 9 * H);
  assert.ok(choch, 'an H1 break down after the H4 break');
  assert.equal(stateAt(ev, choch.t - 1).state, 'move');
  assert.equal(stateAt(ev, choch.t).state, 'pullback');
  const back = ev.e1.find((e) => e.dir === 1 && e.t > choch.t);
  assert.ok(back, 'an H1 break back up');
  assert.equal(stateAt(ev, back.t).state, 'resumed');
});

test('no look-ahead: the state at T is the same with or without the candles after T', () => {
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const mk = (n, sec, start) => { let p = 100; const out = []; for (let i = 0; i < n; i++) { const o = p, c = p + (rnd() - 0.5) * 2; out.push(bar(start + i * sec, o, Math.max(o, c) + rnd(), Math.min(o, c) - rnd(), c)); p = c; } return out; };
  const H4 = mk(400, 14400, 0), H1 = mk(1600, 3600, 0), full = cycleEvents(H4, H1);
  for (const T of [50 * 14400, 123 * 14400 + 7200, 250 * 3600 * 4 + 3600, 399 * 14400]) {
    const cut = cycleEvents(H4.filter((b) => b.time + 14400 <= T), H1.filter((b) => b.time + 3600 <= T));
    assert.deepEqual(stateAt(cut, T), stateAt(full, T), `T ${T}`);
    // prices after T moved: the state does not change
    const H4b = H4.map((b) => (b.time + 14400 > T ? { ...b, high: b.high + 50, close: b.close + 40 } : b));
    const H1b = H1.map((b) => (b.time + 3600 > T ? { ...b, low: b.low - 50, close: b.close - 40 } : b));
    assert.deepEqual(stateAt(cycleEvents(H4b, H1b), T), stateAt(full, T));
  }
});

test('split statistics and the pass rules', () => {
  const tr = [];
  for (let i = 0; i < 60; i++) tr.push({ t: K.FROM + i * 86400 * 30, c: K.FROM + i * 86400 * 30 + 3600, side: 1, R: i % 2 ? 1 : -0.5 });
  const mask = tr.map((x) => x.R > 0);
  const s = splitStats(tr, mask);
  assert.equal(s.kept.n, 30); assert.equal(s.blocked.n, 30);
  assert.ok(s.rules.halves && s.rules.dd && s.rules.n);
  assert.equal(maxDD([{ t: 1, c: 1, R: 1 }, { t: 2, c: 2, R: -2 }, { t: 3, c: 3, R: 0.5 }]), 2);
  const w = welch([1, 2, 3, 4], [0, 1, 0, 1]); assert.ok(w.t > 2 && w.p < 0.05);
});

test('result.json: the verdict and the counts', () => {
  assert.match(R.verdict, /^FAIL, 0 of 11/);
  assert.equal(R.tests.length, 33);
  assert.equal(R.systems.filter((s) => s.verdict === 'PASS').length, 0);
  assert.ok(R.tests.every((t) => t.pHolm != null || t.welch.t == null));
  for (const id of ['xau-geg-1793664000', 'xau-gtl-1793836800-1794182400', 'xau-geg-1794096000']) assert.ok(R.week.find((x) => x.id === id), id);
  assert.ok(!Object.keys(R.streams).some((k) => /ict/i.test(k)), 'ICT is never in this study');
  assert.ok(!fs.existsSync(path.join(ROOT, 'research/proposals/2026-11-13-cycle-gate.md')), 'no proposal on a FAIL');
});

test('RESULT.md: every G2 row equals result.json', () => {
  const f = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(3));
  assert.match(MD, /^# .*\n\n\*\*Verdict: FAIL, 0 of 11 systems\.\*\*/);
  for (const t of R.tests.filter((x) => x.gate === 'G2')) {
    const row = `| ${R.streams[t.stream].name} | ${t.all.n} | ${t.blocked.n} | ${f(t.all.h1.avg)} → ${f(t.kept.h1.avg)} | ${f(t.all.h2.avg)} → ${f(t.kept.h2.avg)} | ${f(t.welch.diff)} | ${t.welch.t ?? '—'} | ${t.pHolm} | ${t.months.t ?? '—'} | ${t.all.maxDD} → ${t.kept.maxDD} | ${t.placebo.pass} / 40 |`;
    assert.ok(MD.includes(row), `RESULT.md row for ${t.stream}`);
  }
  for (const w of R.week) assert.ok(MD.includes(`\`${w.id}\` | ${w.side} | ${w.entry} |`) && MD.includes(w.G2 === 'take' ? 'take' : 'block'), w.id);
});

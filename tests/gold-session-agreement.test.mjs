// gold-session-agreement: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { daysOf, sessions, signals, atr, tradeAt, rOf, excessOf, P } from '../research/edge/gold-session-agreement/run.mjs';

const DIR = 'research/edge/gold-session-agreement/';
const H = 3600, D = 86400, MON = Date.UTC(2020, 0, 6) / 1000;
// one day of 24 H1 candles following closes cs (length 24), open o
const dayRows = (t0, o, cs) => cs.map((c, i) => { const op = i ? cs[i - 1] : o; return [t0 + i * H, op, Math.max(op, c) + 0.1, Math.min(op, c) - 0.1, c]; });
// closes for a day whose Asia / London / NY moves are a / l / n (each session's move spread over its candles; 21-23 flat)
const shaped = (px, a, l, n) => { const cs = []; let p = px;
  for (let h = 0; h < 24; h++) { p += h <= 6 ? a / 7 : h <= 12 ? l / 6 : h <= 20 ? n / 8 : 0; cs.push(+p.toFixed(6)); } return cs; };

test('sessions: moves by UTC hour, a short session is missing', () => {
  const s = sessions(dayRows(MON, 100, shaped(100, 7, -6, 8)));
  assert.ok(Math.abs(s.asia.move - 7) < 1e-6 && Math.abs(s.london.move + 6) < 1e-6 && Math.abs(s.ny.move - 8) < 1e-6);
  assert.equal(s.asia.n, 7); assert.equal(s.london.n, 6); assert.equal(s.ny.n, 8);
  const short = dayRows(MON, 100, shaped(100, 7, -6, 8)).filter((r) => new Date(r[0] * 1000).getUTCHours() > 3);
  assert.equal(sessions(short).asia, null);
});

function series(n, f) { const rows = []; let px = 100;
  for (let d = 0; d < n; d++) { const t0 = MON + (Math.floor(d / 5) * 7 + d % 5) * D, [a, l, ny] = f(d), cs = shaped(px, a, l, ny);
    rows.push(...dayRows(t0, px, cs)); px = cs[23]; }
  return rows; }

test('agreement: all three the same way; strong uses the ATR of earlier days only; future does not change a signal', () => {
  const rows = series(80, (d) => d % 4 === 0 ? [1, 1, 1] : d % 4 === 1 ? [-0.2, -0.2, -0.2] : d % 4 === 2 ? [1, -1, 1] : [0.5, 0.5, -1]);
  const days = daysOf(rows), S = signals(days);
  assert.equal(S[P.warm - 1], null); assert.ok(S[P.warm]);
  for (let i = P.warm; i < days.length; i++) {
    const k = i % 4;
    assert.equal(S[i].sig, k <= 1, String(i)); if (k === 0) assert.equal(S[i].dir, 1); if (k === 1) assert.equal(S[i].dir, -1);
    const A = atr(days)[i - 1];
    if (k === 0) assert.equal(S[i].strong, 1 / 1 >= P.strong * A ? true : false);
    if (k === 1) assert.equal(S[i].strong, 0.2 >= P.strong * A);
  }
  const cut = 60, S2 = signals(days.slice(0, cut + 1));
  assert.deepEqual(S2[cut], S[cut]);
  const A = atr(days), t = tradeAt(days, A, cut, 1, 1);
  assert.equal(t.entry, days[cut + 1].bars[0][1]); assert.equal(t.entryT, days[cut + 1].bars[0][0]);
  assert.ok(t.stop < t.entry && Math.abs(t.entry - t.stop - A[cut]) < 1e-9);
  assert.ok(tradeAt(days, A, cut, -1, 1).stop > t.entry);
});

test('stop fills at the stop or the gapped open; costs and financing on buys only', () => {
  const mk = (cs) => ({ bars: dayRows(0, 100, cs) });
  const t = tradeAt([mk(Array(24).fill(100)), { bars: [[D, 100, 100.5, 95, 96], ...dayRows(D + H, 96, Array(23).fill(96))] }], [5, 5], 0, 1, 1);
  assert.equal(t.why, 'stop'); assert.equal(t.exit, 95);
  const g = tradeAt([mk(Array(24).fill(100)), { bars: [[D, 90, 91, 89, 90], ...dayRows(D + H, 90, Array(23).fill(90))] }], [5, 5], 0, 1, 1);
  assert.equal(g.exit, 90);
  const r = rOf({ side: 1, entry: 100, exit: 105, dist: 5, entryT: MON, exitT: MON + D });
  assert.ok(Math.abs(r.gross - 1) < 1e-12); assert.ok(Math.abs(r.cost - 0.12) < 1e-12); assert.equal(r.nights, 1); assert.ok(r.fin > 0);
  assert.equal(rOf({ side: -1, entry: 100, exit: 95, dist: 5, entryT: MON, exitT: MON + D }).fin, 0);
});

test('excess is against the same side in the same calendar year', () => {
  const J = Date.UTC(2020, 0, 10) / 1000, N = Date.UTC(2020, 10, 10) / 1000, X = Date.UTC(2021, 0, 10) / 1000;
  const mk = (side, net, sig, entryT) => ({ side, net, net2: net, sig, entryT });
  const ex = excessOf([mk(1, 1, true, J), mk(1, 0, false, N), mk(1, 9, false, X), mk(-1, -5, false, N), mk(-1, 3, true, J)]);
  assert.deepEqual(ex.map((x) => x.ex), [0.5, 4]);
});

test('report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8')), md = fs.readFileSync(DIR + 'RESULT.md', 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.equal(r.pass, false);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 220 && line.includes('FAIL, 0 of 3'), String(line.length));
  const f = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
  const t1 = r.tests.T1;
  assert.ok(line.includes(`OOS excess ${f(t1.OOS.ex)}R, month t ${f(t1.OOS.t, 2)}, n ${t1.OOS.n}`), line);
  const label = { T1: 'T1 follow, 1 day', T2: 'T2 follow, 5 days', T3: 'T3 strong, 1 day' };
  for (const id of ['T1', 'T2', 'T3']) {
    const x = r.tests[id]; assert.equal(x.pass, false);
    for (const w of ['IS', 'OOS']) { const s = x[w];
      assert.ok(md.includes(`| ${label[id]} | ${w} | ${s.n} | ${f(s.sigGross)} | ${f(s.sigNet)} | ${f(s.ex)} | ${f(s.t, 2)} |`), id + w); }
    assert.ok(md.includes(`${x.placebo.beaten} of 40`), id);
    assert.equal(x.placebo.seeds.length, 40);
  }
});

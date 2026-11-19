// gold-overlap-lead: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { daysOf, overlap, signals, atr, tradeAt, rOf, excessOf, mark, sHour, P } from '../research/edge/gold-overlap-lead/run.mjs';

const DIR = 'research/edge/gold-overlap-lead/';
const H = 3600, D = 86400, MON = Date.UTC(2020, 0, 6) / 1000; // a Monday
// one session day of 24 H1 candles starting 22:00 UTC of the previous date: overlap move ov (4 candles), then rest (20 candles)
function session(day, px, ov, rest) {
  const rows = []; let p = px;
  for (let k = 0; k < 24; k++) { const o = p; p += k < 4 ? ov / 4 : rest / 20; rows.push([day - 2 * H + k * H, o, Math.max(o, p) + 0.1, Math.min(o, p) - 0.1, +p.toFixed(6)]); }
  return rows;
}
function series(n, f) { const rows = []; let px = 100;
  for (let d = 0; d < n; d++) { const day = MON + (Math.floor(d / 5) * 7 + d % 5) * D, [ov, rest] = f(d), r = session(day, px, ov, rest); rows.push(...r); px = r.at(-1)[4]; }
  return rows; }

test('session hours and days: 22:00 UTC opens the next day; Sunday reopen belongs to Monday', () => {
  assert.equal(sHour(MON - 2 * H), 0); assert.equal(sHour(MON + H), 3); assert.equal(sHour(MON + 2 * H), 4);
  const days = daysOf(session(MON, 100, 2, 1));
  assert.equal(days.length, 1); assert.equal(days[0].day, MON); assert.equal(days[0].bars.length, 24);
  const o = overlap(days[0].bars);
  assert.ok(Math.abs(o.move - 2) < 1e-9); assert.equal(o.n, 4);
  assert.equal(overlap(days[0].bars.filter((b) => sHour(b[0]) > 1)), null);
});

test('signals use the overlap and the previous day only; the trade enters at 02:00 and exits at 20:00 UTC', () => {
  const rows = series(60, (d) => d % 3 === 0 ? [3, -1] : d % 3 === 1 ? [-0.1, 2] : [-3, 1]);
  const days = daysOf(rows), S = signals(days), A = atr(days);
  for (let i = Math.max(P.warm, P.atrN + 1); i < days.length; i++) {
    const pr = days[i - 1].high - days[i - 1].low, o = overlap(days[i].bars);
    assert.equal(S[i].dir, Math.sign(o.move)); assert.ok(Math.abs(S[i].ratio - Math.abs(o.move) / pr) < 1e-4);
  }
  // changing every price after 01:59 UTC of day i does not change its signal
  const i = 40, cut = days[i].bars[3][0];
  const bent = rows.map((r) => (r[0] > cut ? [r[0], r[1] * 2, r[2] * 2, r[3] * 2, r[4] * 2] : r));
  assert.deepEqual(signals(daysOf(bent))[i], S[i]);
  const t = tradeAt(days, A, i, 1);
  assert.equal(new Date(t.entryT * 1000).getUTCHours(), 2); assert.equal(t.entry, days[i].bars.find((b) => sHour(b[0]) === 4)[1]);
  assert.equal(new Date(t.exitT * 1000).getUTCHours(), 20); assert.equal(t.why, 'time');
  assert.ok(Math.abs(t.entry - t.stop - A[i - 1]) < 1e-9);
  assert.ok(tradeAt(days, A, i, -1).stop > t.entry);
});

test('stop at the stop or a gapped open; costs; financing only on buys over a rollover', () => {
  const bars = [[MON - 2 * H, 100, 100, 100, 100], [MON + 2 * H, 100, 100.5, 94, 95], [MON + 3 * H, 95, 96, 95, 96]];
  const days = [{ bars: [] }, { bars }];
  const t = tradeAt(days, [5, 5], 1, 1); assert.equal(t.why, 'stop'); assert.equal(t.exit, 95);
  const g = tradeAt([{ bars: [] }, { bars: [[MON + 2 * H, 90, 91, 89, 90]] }], [5, 5], 1, 1); assert.equal(g.exit, 90);
  const r = rOf({ side: 1, entry: 100, exit: 105, dist: 5, entryT: MON + 2 * H, exitT: MON + 20 * H });
  assert.ok(Math.abs(r.gross - 1) < 1e-12); assert.ok(Math.abs(r.cost - 0.12) < 1e-12); assert.equal(r.nights, 0); assert.equal(r.fin, 0);
  assert.ok(rOf({ side: 1, entry: 100, exit: 105, dist: 5, entryT: MON, exitT: MON + D }).fin > 0);
});

test('signal marking and the same-side same-year excess', () => {
  const J = Date.UTC(2020, 0, 10) / 1000, N = Date.UTC(2020, 10, 10) / 1000, X = Date.UTC(2021, 0, 10) / 1000;
  const mk = (side, net, dir, ratio, entryT) => ({ side, net, net2: net, dir, ratio, entryT });
  const M = mark([mk(1, 1, 1, 0.2, J), mk(1, 0, -1, 0.2, N), mk(1, 9, 1, 0.05, X), mk(-1, -5, 1, 0.2, N), mk(-1, 3, -1, 0.3, J)], 0.1);
  assert.deepEqual(M.map((d) => d.sig), [true, false, false, false, true]);
  assert.deepEqual(excessOf(M).map((x) => x.ex), [0.5, 4]);
  assert.deepEqual(excessOf(M, 'long').map((x) => x.ex), [0.5]);
});

test('report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8')), md = fs.readFileSync(DIR + 'RESULT.md', 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.equal(r.pass, false); assert.equal(r.passCount, 0);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 220 && line.includes('FAIL, 0 of 3'), String(line.length));
  const f = (x, d = 3) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d), g = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
  const t1 = r.tests.T1;
  assert.ok(line.includes(`T1 OOS excess ${g(t1.OOS.ex)}R, month t ${g(t1.OOS.t, 2)}, n ${t1.OOS.n}; in sample ${g(t1.IS.ex)}R`), line);
  const label = { T1: 'T1 follow, >= 0.10', T2: 'T2 buys, >= 0.10', T3: 'T3 strong, >= 0.25' };
  for (const id of ['T1', 'T2', 'T3']) {
    const x = r.tests[id]; assert.equal(x.pass, false); assert.equal(x.placebo.seeds.length, 40);
    for (const w of ['IS', 'OOS']) { const s = x[w];
      const row = `| ${label[id]} | ${w} | ${s.n} | ${f(s.sigGross)} | ${f(s.sigNet)} | ${f(s.ex)} | ${f(s.t, 2)} | ${f(s.ex2)} | ${f(s.sigNet2)} |`;
      assert.ok(md.includes(row), row); }
    assert.ok(md.includes(`${x.placebo.beaten} of 40`), id);
  }
});

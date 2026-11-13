// research/edge/crypto-reversal: the rule's pieces on hand-made candles (offline), and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as M from '../research/edge/crypto-reversal/run.mjs';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'research/edge/crypto-reversal');
const DAY = 86400, T0 = Date.UTC(2023, 0, 2) / 1000;   // a Monday

// n daily candles of a gentle zig-zag around 100, then optional overrides
function series(n, f = () => null) {
  const rows = [];
  let c = 100;
  for (let i = 0; i < n; i++) {
    const o = c, nc = 100 + (i % 2 ? 1 : -1) * (1 + (i % 7) * 0.2);
    rows.push([T0 + i * DAY, o, Math.max(o, nc) + 0.5, Math.min(o, nc) - 0.5, nc]);
    c = nc;
    const ov = f(i, rows);
    if (ov) { rows[i] = [T0 + i * DAY, ...ov]; c = ov[3]; }
  }
  return rows;
}

test('signal uses past data only: changing any later candle never changes it', () => {
  const rows = series(260, (i) => (i === 230 ? [100, 100.5, 80, 81] : null));
  const s = M.signalAt(rows, 230, false);
  assert.equal(s, true, 'a 19 % three-day drop is a signal');
  for (let j = 231; j < 260; j++) {
    const alt = rows.map((r) => r.slice());
    alt[j] = [alt[j][0], 1, 1000, 0.5, 999];
    assert.equal(M.signalAt(alt, 230, false), s);
    assert.equal(M.signalAt(alt, 230, true), M.signalAt(rows, 230, true));
    assert.equal(M.atr(alt, 230), M.atr(rows, 230));
  }
  // the spread excludes the signal day's own three-day return
  const a = M.sdBefore(rows, 230), alt = rows.map((r) => r.slice());
  alt[230] = [alt[230][0], 100, 100.5, 10, 11];
  assert.equal(M.sdBefore(alt, 230), a);
  assert.equal(M.signalAt(rows, 50, false), null, 'no signal before 93 days');
});

test('entry fills at the next open; stop below; time exit at the close of the third candle', () => {
  const rows = series(260, (i) => (i === 230 ? [100, 100.5, 80, 81] : i === 231 ? [83, 90, 82, 88] : null));
  const tr = M.trade(rows, 230, 3, 0.15);
  assert.equal(tr.t, rows[231][0]);
  assert.equal(tr.entry, 83);
  assert.ok(Math.abs(tr.stop - (83 - 2.5 * M.atr(rows, 230))) < 1e-12);
  assert.ok(tr.stop < tr.entry);
  assert.equal(tr.how, 'time');
  assert.equal(tr.exitT, rows[233][0]);
  assert.equal(tr.exit, rows[233][4]);
  const t7 = M.trade(rows, 230, 7, 0.15);
  assert.equal(t7.exitT, rows[237][0]);
});

test('stop: touched intraday fills at the stop; gapped through fills at the open', () => {
  const base = series(260, (i) => (i === 230 ? [100, 100.5, 80, 81] : i === 231 ? [83, 84, 82, 83] : null));
  const stop = M.trade(base, 230, 3, 0.15).stop;
  const touch = base.map((r) => r.slice());
  touch[232] = [touch[232][0], 82, 83, stop - 1, 82];
  const a = M.trade(touch, 230, 3, 0.15);
  assert.equal(a.how, 'stop'); assert.equal(a.exit, stop); assert.equal(a.exitT, touch[232][0]);
  assert.ok(Math.abs(a.R + 1) < 1e-12);
  const gap = base.map((r) => r.slice());
  gap[232] = [gap[232][0], stop - 5, stop - 4, stop - 6, stop - 5];
  const g = M.trade(gap, 230, 3, 0.15);
  assert.equal(g.how, 'gap'); assert.equal(g.exit, stop - 5); assert.ok(g.R < -1);
  assert.equal(g.nights, M.nightsOf(gap[231][0]), 'a gap at the open pays no night that day');
});

test('swap per night: 17:00 New York each day, Friday three, charged on the entry price', () => {
  const mon = Date.UTC(2026, 10, 9) / 1000, fri = Date.UTC(2026, 10, 13) / 1000, sat = Date.UTC(2026, 10, 14) / 1000;
  assert.equal(M.nightsOf(mon), 1);
  assert.equal(M.nightsOf(fri), 3);
  assert.equal(M.nightsOf(sat), 1);
  assert.equal(M.nightsOf(Date.UTC(2026, 6, 10) / 1000), 3, 'a summer Friday too');
  const rows = series(260, (i) => (i === 230 ? [100, 100.5, 80, 81] : null));
  const tr = M.trade(rows, 230, 3, 0.15);
  const nights = [231, 232, 233].reduce((a, k) => a + M.nightsOf(rows[k][0]), 0);
  assert.equal(tr.nights, nights);
  assert.ok(Math.abs(tr.finR - 0.15 / 365 * nights * tr.entry / tr.r0) < 1e-12);
  const cost = tr.entry * (M.P.cost + M.P.slip) + tr.exit * M.P.slip;
  assert.ok(Math.abs(tr.net - (tr.R - cost / tr.r0 - tr.finR)) < 1e-12);
  assert.equal(M.P.cost, 0.0004); assert.equal(M.P.slip, 0.0001);
});

test('statistics: Holm, quantile, month sums with empty months', () => {
  assert.deepEqual(M.holm([0.01, 0.04, 0.03, 0.5]).map((x) => +x.toFixed(4)), [0.04, 0.09, 0.09, 0.5]);
  assert.equal(M.quantile([0, 1, 2, 3, 4], 0.5), 2);
  const months = ['2024-01', '2024-02', '2024-03'];
  const tr = [{ t: Date.UTC(2024, 0, 5) / 1000, net: 1 }, { t: Date.UTC(2024, 2, 5) / 1000, net: 2 }];
  assert.ok(Math.abs(M.monthT(tr, months) - M.tOf([1, 0, 2])) < 1e-12);
  assert.ok(Math.abs(M.pOneSided(2) - 0.02275) < 1e-4);
});

test('RESULT.md matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  const f = (v, d = 3) => (v < 0 ? '−' : v > 0 && d === 3 ? '+' : '') + Math.abs(v).toFixed(d);
  assert.equal(r.verdict, 'FAIL');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}, ${r.passed.length} of ${r.tests.length} tests pass`));
  for (const t of r.tests) {
    const d = t.decisive, row = md.split('\n').find((l) => l.startsWith(`| ${t.id} | ${d.n} |`));
    assert.ok(row, `decisive row ${t.id}`);
    for (const v of [f(d.net), f(d.gross), f(d.tMonths), t.p.toFixed(3), t.holm.toFixed(3), f(t.placebo.p95)]) assert.ok(row.includes(v), `${t.id} ${v} in ${row}`);
    assert.ok(row.endsWith(t.pass ? '| yes |' : '| no |'));
    const rp = t.replication, rrow = md.split('\n').find((l) => l.startsWith(`| ${t.id} | ${rp.n} | ${f(rp.net)} | ${f(rp.tMonths)} |`));
    assert.ok(rrow, `replication row ${t.id}`);
    for (const [c, v] of Object.entries(t.byCoin)) {
      const cr = `| ${t.id} | ${c.toUpperCase()} | ${v.decisive.n} | ${f(v.decisive.net)} | ${f(v.decisive.tMonths)} | ${v.replication.n} | ${f(v.replication.net)} | ${f(v.replication.tMonths)} |`;
      assert.ok(md.includes(cr), cr);
    }
    assert.equal(t.placebo.values.length, 40);
  }
});

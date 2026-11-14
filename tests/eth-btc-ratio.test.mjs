// research/edge/eth-btc-ratio: the rules' pieces on hand-made candles (offline), and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as M from '../research/edge/eth-btc-ratio/run.mjs';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'research/edge/eth-btc-ratio');
const DAY = 86400, T0 = Date.UTC(2023, 0, 2) / 1000;   // a Monday
const near = (a, b, e = 1e-12) => Math.abs(a - b) < e;

// n daily candles: a gentle zig-zag around `base` with a drift, then optional overrides [o, h, l, c]
function series(n, base, drift, f = () => null) {
  const rows = [];
  let c = base;
  for (let i = 0; i < n; i++) {
    const o = c, nc = base * (1 + drift * i) * (1 + (i % 2 ? 1 : -1) * 0.005 * (1 + (i % 5)));
    rows.push([T0 + i * DAY, o, Math.max(o, nc) * 1.004, Math.min(o, nc) * 0.996, nc]);
    c = nc;
    const ov = f(i);
    if (ov) { rows[i] = [T0 + i * DAY, ...ov]; c = ov[3]; }
  }
  return rows;
}
const sundayAfter = (rows, from) => M.sundays(rows).find((i) => i >= from);

test('the weekly signal uses past data only: changing any later candle never changes it', () => {
  const eth = series(120, 2000, 0.002), btc = series(120, 30000, 0.0005);
  const i = sundayAfter(eth, 60);
  assert.equal(new Date(eth[i][0] * 1000).getUTCDay(), 0, 'signal day is a Sunday');
  const q = M.ratio4(eth, btc, i), rE = M.ret4(eth, i), rB = M.ret4(btc, i), aE = M.atr(eth, i);
  assert.ok(q > 0, 'ETH outran BTC');
  assert.equal(M.t1Trade(eth, btc, i).side, 1, 'positive ratio trend: long ETH, short BTC');
  assert.equal(M.t2Trade(eth, btc, i).coin, 'eth');
  for (let j = i + 1; j < 120; j++) {
    const e2 = eth.map((r) => r.slice()), b2 = btc.map((r) => r.slice());
    e2[j] = [e2[j][0], 1, 1e6, 0.5, 1]; b2[j] = [b2[j][0], 1, 1e7, 0.5, 9e6];
    assert.equal(M.ratio4(e2, b2, i), q);
    assert.equal(M.ret4(e2, i), rE); assert.equal(M.ret4(b2, i), rB);
    assert.equal(M.atr(e2, i), aE);
  }
  assert.equal(M.ratio4(eth, btc, 27), null, 'needs 28 days back');
  // the reverse: BTC outruns ETH → short ETH, long BTC; T2 picks BTC
  assert.equal(M.t1Trade(btc, eth, i).side, -1);
});

test('entry at the Monday open, time exit at the next Sunday close; two-leg R uses the combined risk', () => {
  const eth = series(120, 2000, 0.002), btc = series(120, 30000, 0.0005);
  const i = sundayAfter(eth, 60), tr = M.t1Trade(eth, btc, i);
  const E = tr.legs.eth, B = tr.legs.btc;
  assert.equal(tr.t, eth[i + 1][0]);
  assert.equal(E.entry, eth[i + 1][1]); assert.equal(B.entry, btc[i + 1][1]);
  assert.ok(E.stop < E.entry && B.stop > B.entry, 'long ETH stop below, short BTC stop above');
  assert.ok(near(E.stop, E.entry - 2.5 * M.atr(eth, i)));
  assert.ok(near(B.stop, B.entry + 2.5 * M.atr(btc, i)));
  if (E.how === 'time') assert.equal(E.exitT, eth[i + 7][0]);
  const risk = (E.entry - E.stop) / E.entry + (B.stop - B.entry) / B.entry;
  assert.ok(near(tr.risk, risk));
  const gross = (E.exit / E.entry - 1) + (1 - B.exit / B.entry);
  assert.ok(near(tr.R, gross / risk));
  assert.ok(near(tr.net, (gross - E.cost - B.cost - E.fin - B.fin) / risk));
  // both legs stopped at their stops = exactly -1R before costs
  const e2 = eth.map((x) => x.slice()), b2 = btc.map((x) => x.slice());
  e2[i + 2] = [e2[i + 2][0], e2[i + 1][4], e2[i + 1][4], E.stop - 1e-6, E.stop];
  b2[i + 2] = [b2[i + 2][0], b2[i + 1][4], B.stop + 1e-3, b2[i + 1][4], B.stop];
  const t2 = M.t1Trade(e2, b2, i);
  assert.equal(t2.legs.eth.how, 'stop'); assert.equal(t2.legs.btc.how, 'stop');
  assert.ok(near(t2.R, -1, 1e-9));
});

test('stops: touched intraday fill at the stop, gapped through fill at the open, each leg on its own', () => {
  const rows = series(120, 2000, 0.002), i = sundayAfter(rows, 60), a = M.atr(rows, i);
  const L0 = M.leg(rows, i + 1, i + 7, 1, a, { long: 0.15, short: 0.1 });
  const touch = rows.map((r) => r.slice());
  touch[i + 3] = [touch[i + 3][0], rows[i + 2][4], rows[i + 2][4], L0.stop - 5, L0.stop + 1];
  const T = M.leg(touch, i + 1, i + 7, 1, a, { long: 0.15, short: 0.1 });
  assert.equal(T.how, 'stop'); assert.equal(T.exit, L0.stop); assert.equal(T.exitT, rows[i + 3][0]);
  const gap = rows.map((r) => r.slice());
  gap[i + 3] = [gap[i + 3][0], L0.stop - 20, L0.stop - 10, L0.stop - 30, L0.stop - 15];
  const G = M.leg(gap, i + 1, i + 7, 1, a, { long: 0.15, short: 0.1 });
  assert.equal(G.how, 'gap'); assert.equal(G.exit, L0.stop - 20);
  assert.ok(G.pnl < T.pnl, 'a gap fills worse than the stop');
  // short: gap up through the stop fills at the open
  const S0 = M.leg(rows, i + 1, i + 7, -1, a, { long: 0.15, short: 0.1 });
  const sg = rows.map((r) => r.slice());
  sg[i + 2] = [sg[i + 2][0], S0.stop + 20, S0.stop + 30, S0.stop + 10, S0.stop + 25];
  const SG = M.leg(sg, i + 1, i + 7, -1, a, { long: 0.15, short: 0.1 });
  assert.equal(SG.how, 'gap'); assert.equal(SG.exit, S0.stop + 20);
  assert.ok(near(SG.pnl, -((S0.stop + 20) / S0.entry - 1)));
  // the gap day holds no night; the touch day does
  assert.equal(G.nights + M.nightsOf(rows[i + 3][0]), T.nights);
});

test('swap is charged per side at the broker rates, nine nights a full week (Friday x3)', () => {
  assert.deepEqual(M.P.swap, { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 } });
  const big = series(120, 2000, 0.002), i = sundayAfter(big, 60), rows = big;   // a stop 50 ATR wide is never hit
  const L = M.leg(big, i + 1, i + 7, 1, M.atr(rows, i) * 50, M.P.swap.eth);
  const S = M.leg(big, i + 1, i + 7, -1, M.atr(rows, i) * 50, M.P.swap.eth);
  const Sb = M.leg(big, i + 1, i + 7, -1, M.atr(rows, i) * 50, M.P.swap.btc);
  assert.equal(L.how, 'time'); assert.equal(L.nights, 9); assert.equal(S.nights, 9);
  assert.ok(near(L.fin, 0.15 / 365 * 9)); assert.ok(near(S.fin, 0.10 / 365 * 9)); assert.ok(near(Sb.fin, 0.075 / 365 * 9));
  assert.ok(near(L.cost, M.P.cost + M.P.slip + M.P.slip * L.exit / L.entry));
  assert.ok(near(M.P.cost, 0.0004)); assert.ok(near(M.P.slip, 0.0001));
});

test('statistics: Holm, quantile, one-sided p', () => {
  assert.deepEqual(M.holm([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(M.holm([0.3, 0.2]), [0.4, 0.4]);
  assert.equal(M.quantile([1, 2, 3, 4, 5], 0.5), 3);
  assert.ok(near(M.pOneSided(0), 0.5, 1e-6));
  assert.ok(M.pOneSided(2) < 0.025);
});

test('RESULT.md matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8').replace(/−/g, '-');
  assert.equal(r.verdict, 'FAIL');
  assert.ok(md.includes(`**Verdict: ${r.verdict}, ${r.passed.length} of ${r.tests.length} tests pass.**`));
  const s = (v) => (v > 0 ? '+' : '') + v.toFixed(3);
  for (const t of r.tests) {
    const d = t.decisive;
    const row = md.split('\n').find((l) => l.startsWith(`| ${t.id} `));
    assert.ok(row, t.id);
    for (const v of [s(d.net), s(d.gross), s(d.t), t.p.toFixed(3), t.holm.toFixed(3), (d.win * 100).toFixed(1),
      `${d.legsStopped} (${d.gaps})`, d.costR.toFixed(3), d.finR.toFixed(3), d.maxDD.toFixed(3), `${s(t.placebo.mean)} / ${s(t.placebo.p95)}`])
      assert.ok(row.includes(v), `${t.id} decisive ${v} in ${row}`);
    assert.ok(row.endsWith(t.pass ? '| yes |' : '| no |'));
    const rep = md.split('\n').filter((l) => l.startsWith(`| ${t.id} `))[1];
    assert.ok(rep.includes(s(t.replication.net)) && rep.includes(s(t.replication.t)), `${t.id} replication`);
    assert.equal(d.weeks, r.weeks.decisive); assert.equal(t.replication.weeks, r.weeks.replication);
  }
  for (const [k, lbl] of [['decisive', '2022-26'], ['replication', '2018-21']]) {
    const v = r.vsBtc[k], row = md.split('\n').find((l) => l.startsWith(`| ${lbl} `));
    for (const x of [s(v.t2.meanRetPct), s(v.btcSameStop.meanRetPct), s(v.btcBuyHold.meanRetPct), s(v.diffT2minusBtcPct)])
      assert.ok(row.includes(x), `${lbl} ${x}`);
  }
  assert.ok(md.includes(`Mondays 2022-01-03 to ${r.lastWeek}`));
  assert.ok(md.includes('BTCUSD long 15 %, short 7.5 %') && md.includes('ETHUSD long 15 %, short 10 %'));
});

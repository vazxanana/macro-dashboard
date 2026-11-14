// research/edge/gold-gap-open: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { simulate, setup, evenings, atrOf, tradingDays, costOf, nyT, dayNum, trade, holm, monthSums, covered, ELIG, STOP }
  from '../research/edge/gold-gap-open/run.mjs';

const dir = new URL('../research/edge/gold-gap-open/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir)));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

const c = (time, open, high, low, close) => ({ time, open, high, low, close });

test('simulate: stop first, gap through the stop fills at the open, target is a limit', () => {
  const cs = [c(0, 100, 101, 99.5, 100.5), c(300, 100.5, 103, 98, 101)];
  assert.equal(simulate(cs, 1, 100, 1, 102).how, 'stop');                     // the second candle holds both: stop first
  const g = simulate([c(0, 97, 98, 96, 97)], 1, 100, 1);
  assert.equal(g.exit, 97); assert.equal(g.R, -3);                            // gapped through: the open
  const t = simulate([c(0, 100, 102.5, 99.8, 102)], 1, 100, 1, 102);
  assert.equal(t.how, 'target'); assert.equal(t.exit, 102); assert.equal(t.R, 2);
  const s = simulate([c(0, 100, 100.4, 99.9, 100.2)], -1, 100, 1);
  assert.equal(s.how, 'time'); assert.ok(Math.abs(s.R + 0.2) < 1e-9);
  assert.ok(Math.abs(costOf('target') - 0.45) < 1e-9 && Math.abs(costOf('stop') - 0.60) < 1e-9 && Math.abs(costOf('time', 2) - 1.20) < 1e-9);
});

// a synthetic month of M5 candles: flat 2000 with a daily range, a 16:55 close and an 18:00 reopen gap
function synth({ gap = 3, path = null, days = 30, d0 = dayNum('2021-03-01') } = {}) {
  const bars = [];
  for (let d = d0 - 40; d < d0 + days; d++) {
    for (let t = nyT(d, 0); t < nyT(d + 1, 0); t += 300) {
      const m = Math.round((t - nyT(d, 0)) / 60); if (m >= 17 * 60 && m < 18 * 60) continue;
      const wd = new Date(d * 86400000).getUTCDay(); if (wd === 6 || (wd === 0 && m < 18 * 60) || (wd === 5 && m >= 17 * 60)) continue;
      let px = 2000 + (m === 6 * 60 ? 10 : m === 9 * 60 ? -10 : 0);          // a 20-dollar daily range: ATR 20
      if (m >= 18 * 60) px = 2000 + gap;                                        // the evening sits at the gap level
      if (path && m >= 18 * 60) px = path(m, d, px);
      bars.push(c(t, px, px + 0.05, px - 0.05, px));
    }
  }
  return bars;
}

test('evenings: gap from the 16:55 close to the 18:00 open, ATR from completed days only, Mon-Thu, no weekend', () => {
  const bars = synth(), { evs } = evenings(bars, '2021-03-01');
  assert.ok(evs.length > 10);
  for (const e of evs) { const w = new Date(e.d * 86400000).getUTCDay(); assert.ok(w >= 1 && w <= 4); }
  const e = evs[5]; assert.ok(Math.abs(e.G - 3) < 1e-9);
  assert.ok(e.atr > 15 && e.atr < 30);
  // no look-ahead: changing every candle after 17:00 of evening d leaves its ATR unchanged
  const cut = nyT(e.d, 17), b2 = bars.map((b) => (b.time >= cut ? { ...b, high: b.high + 500 } : b));
  assert.equal(atrOf(tradingDays(b2), e.d), e.atr);
});

test('setup: eligibility, T1 fade toward the close, T2 follow, filled-first skip, stops 0.25 x ATR', () => {
  const bars = synth({ gap: 3 }), { evs } = evenings(bars, '2021-03-01'), e = evs[5];
  assert.ok(e.ratio >= ELIG);
  const s1 = setup(bars, e, 'T1'), s2 = setup(bars, e, 'T2');
  assert.equal(s1.side, -1); assert.equal(s1.target, e.C); assert.ok(Math.abs(s1.dist - STOP * e.atr) < 1e-9);
  assert.equal(s2.side, 1); assert.equal(s2.target, null);
  assert.ok(s1.cs.every((b) => b.time > e.r.time && b.time < e.t02));        // only candles after the entry candle, to 02:00
  const tiny = synth({ gap: 0.2 }), ev2 = evenings(tiny, '2021-03-01').evs[5];
  assert.equal(setup(tiny, ev2, 'T1').skip, 'small');
  const ef = { ...e, r: { ...e.r, low: e.C - 0.1 } };                       // the reopen candle traded through the close
  assert.equal(setup(bars, ef, 'T1').skip, 'filledFirst');
  // T3: midpoint never touched (the evening sits at the gap level, from midnight back at 2000), entry at the 03:00 open toward it
  const s3 = setup(bars, e, 'T3');
  assert.equal(s3.side, 1); assert.ok(Math.abs(s3.target - (e.C + e.O) / 2) < 1e-9); assert.equal(s3.cs[0].time, e.t03);
  // T1 trade: price returns to the close after midnight, so the target (a limit) is reached; financing 0 on a sell
  const t1 = trade(s1, e.d); assert.equal(t1.how, 'target'); assert.equal(t1.fin, 0); assert.ok(Math.abs(t1.net - (t1.R - costOf('target') / s1.dist)) < 1e-12);
});

test('covered, holm, month sums', () => {
  assert.equal(covered([c(0, 1, 1, 1, 1), c(3600, 1, 1, 1, 1)], 0, 3900), false);
  assert.equal(covered([c(0, 1, 1, 1, 1), c(300, 1, 1, 1, 1)], 0, 600), true);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  assert.deepEqual(monthSums([{ d: dayNum('2021-02-03'), net: 1 }], '2021-01-01', '2021-03-31'), [0, 1, 0]);
});

test('result.json: verdict, pass lines, Holm and the report agree', () => {
  assert.equal(R.verdict, 'FAIL');
  for (const [k, t] of Object.entries(R.tests)) {
    assert.equal(t.pass, Object.values(t.lines).every(Boolean), k);
    assert.equal(t.lines.oosNet, t.oos.avg > 0); assert.equal(t.lines.oosT2, t.oos.t >= 2);
    assert.equal(t.lines.placebo, t.oos.avg > t.oos.placebo.p95);
  }
  assert.ok(Object.values(R.tests).every((t) => !t.pass));
  const line = MD.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.length < 260 && /FAIL, 0 of 3/.test(line));
  const f = (x) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(3);
  assert.ok(line.includes(`OOS ${f(R.tests.T1.oos.avg)}R net, t ${f(R.tests.T1.oos.t).replace(/0$/, '')}`));
  assert.ok(line.includes(`${f(R.tests.T2.oos.avg)}R, t ${f(R.tests.T2.oos.t).replace(/0$/, '')}`));
  for (const [k, row] of [['T1', 'T1 fade'], ['T2', 'T2 follow'], ['T3', 'T3 midpoint']]) {
    for (const [w, lab] of [['is', '2016-20'], ['oos', '2021 → now']]) {
      const x = R.tests[k][w], cells = MD.split('\n').find((l) => l.startsWith(`| ${row} | ${lab} |`));
      assert.ok(cells, `${k} ${w}`);
      assert.ok(cells.includes(`| ${x.n} |`) && cells.includes(f(x.avg)) && cells.includes(`${x.buys} / ${x.sells}`), `${k} ${w}`);
    }
  }
  assert.ok(MD.includes(`**${R.descriptive.breakPrints} M5 candles**`));
  assert.ok(Object.values(R.tests).every((t) => t.is.finR === 0 && t.oos.finR === 0));
  // the plan this was run under is the committed pre-registration
  assert.equal(R.preregistration, crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', dir))).digest('hex'));
});

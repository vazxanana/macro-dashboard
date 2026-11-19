// Frozen replication of the forex weekend-gap Rule G (research/edge/fx-weekend-gap-replicate): the frozen file is the first
// study's run.mjs byte for byte, the window filter, the per-pair quoted spread through the frozen cost formula, Holm, the
// pre-registered reading, and the written report against result.json. Offline, on hand-made candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { K, costPx, nyParts, shut, ruleG, weeks } from '../research/edge/fx-weekend-gap-replicate/frozen.mjs';
import { FROZEN_SHA256, SPREAD, CROSSES, MAJORS, TESTS, withSpread, pairTrades, holmAdj, reading } from '../research/edge/fx-weekend-gap-replicate/run.mjs';

const DIR = new URL('../research/edge/fx-weekend-gap-replicate/', import.meta.url);
const rd = (f) => fs.readFileSync(new URL(f, DIR), 'utf8');
const T = (s) => Date.parse(s + 'Z') / 1000;
function flat(a, b, px = 1.1) { const out = []; for (let t = a; t < b; t += 300) if (!shut(nyParts(t))) out.push({ time: t, open: px, high: px + 0.0005, low: px - 0.0005, close: px }); return out; }

test('frozen.mjs is the first study\'s run.mjs, byte for byte (pinned sha256)', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(new URL('frozen.mjs', DIR))).digest('hex');
  assert.equal(h, '3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273');
  assert.equal(FROZEN_SHA256, h);
});

test('pairs, windows and quoted spreads are as pre-registered', () => {
  assert.deepEqual(CROSSES, ['eurgbp', 'gbpjpy', 'audjpy', 'euraud', 'gbpaud', 'eurchf']);
  assert.deepEqual(MAJORS, ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'eurjpy']);
  assert.ok(!CROSSES.some((p) => MAJORS.includes(p)), 'no pair of the first study in R1');
  assert.deepEqual([TESTS.R1.from, TESTS.R1.to], [T('2020-01-01T00:00:00'), Infinity]);
  assert.deepEqual([TESTS.R2.from, TESTS.R2.to], [T('2010-01-01T00:00:00'), T('2016-01-01T00:00:00')]);
  assert.deepEqual(SPREAD, { eurgbp: 0.4, eurchf: 0.5, audjpy: 0.6, gbpjpy: 0.9, euraud: 0.9, gbpaud: 1.3, eurusd: 0.3, gbpusd: 0.3, usdjpy: 0.3, audusd: 0.3, usdchf: 0.3, eurjpy: 0.3 });
  const pre = rd('PREREGISTRATION.md');
  for (const [p, s] of Object.entries({ 'EUR/GBP': 0.4, 'EUR/CHF': 0.5, 'AUD/JPY': 0.6, 'GBP/JPY': 0.9, 'EUR/AUD': 0.9, 'GBP/AUD': 1.3 })) assert.match(pre, new RegExp(`\\| ${p} \\| ${s} \\|`));
});

test('the per-pair spread goes through the frozen cost formula and is put back', () => {
  assert.equal(K.SPREAD_PIPS, 0.3);
  const c = withSpread(1.3, () => costPx('gbpaud', 2.0));
  assert.ok(Math.abs(c - (0.0001 * (1.3 + 2) + 45e-6 * 2.0)) < 1e-15);
  assert.equal(K.SPREAD_PIPS, 0.3);
  assert.throws(() => withSpread(9, () => { throw new Error('x'); })); assert.equal(K.SPREAD_PIPS, 0.3);
});

test('the window filter keeps only weeks whose Friday is in the window; trades are the frozen Rule G with the pair\'s cost', () => {
  const M5 = flat(T('2015-11-01T00:00:00'), T('2016-02-16T00:00:00'));
  for (const fri of ['2015-12-11', '2016-02-12']) {             // a 12-pip gap up, never filled, on two Fridays either side of 2016
    const w = weeks(M5).find((x) => x.fri === fri), iF = w.iF, iR = w.iR;
    M5[iF] = { ...M5[iF], close: 1.1 }; for (let i = iR; i < M5.length && M5[i].time < w.noon + 3600; i++) M5[i] = { ...M5[i], open: 1.1012, high: 1.1013, low: 1.1011, close: 1.1012 };
  }
  const r2 = pairTrades('eurgbp', M5, TESTS.R2.from, TESTS.R2.to);
  assert.deepEqual(r2.trades.map((t) => t.fri), ['2015-12-11']);
  const t = r2.trades[0], w = weeks(M5).find((x) => x.fri === '2015-12-11'), ref = withSpread(0.4, () => ruleG('eurgbp', M5, w));
  assert.equal(t.net, ref.net); assert.equal(t.spread, 0.4);
  assert.ok(Math.abs(t.net - (t.R - (0.0001 * 2.4 + 45e-6 * t.entry) / t.r0)) < 1e-4);
  assert.ok(t.side < 0 && t.stop > t.entry, 'every trade has its stop on the losing side');
  assert.deepEqual(pairTrades('eurgbp', M5, TESTS.R1.from, TESTS.R1.to).trades.map((x) => x.fri), []);
});

test('Holm-adjusted p over R1 and R2, and the reading words', () => {
  assert.deepEqual(holmAdj([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(holmAdj([0.04, 0.01]), [0.04, 0.02]);
  assert.deepEqual(holmAdj([0.3, 0.6]), [0.6, 0.6]);
  assert.equal(reading({ net: 0.1, pAdj: 0.02, tMonth: 2.5 }, { net: 0.05, pAdj: 0.04, tMonth: 2 }), 'REPLICATES');
  assert.equal(reading({ net: 0.1, pAdj: 0.2, tMonth: 1.1 }, { net: -0.05, pAdj: 0.9, tMonth: -1 }), 'PARTLY');
  assert.equal(reading({ net: 0.1, pAdj: 0.4, tMonth: 0.9 }, { net: -0.05, pAdj: 0.9, tMonth: -1 }), 'DOES NOT REPLICATE');
});

test('result.json: the gate passed, the reading follows from the figures, RESULT.md says the same', () => {
  const r = JSON.parse(rd('result.json')), md = rd('RESULT.md');
  assert.equal(r.gate.pass, true);
  assert.deepEqual([r.gate.published.dec.n, r.gate.published.dec.net, r.gate.published.dec.tMonth], [243, 0.194, 2.1411]);
  assert.deepEqual(r.gate.got.dec, r.gate.published.dec); assert.deepEqual(r.gate.got.rep, r.gate.published.rep);
  assert.equal(r.frozenSha256, FROZEN_SHA256);
  assert.equal(r.reading, reading(r.tests.R1, r.tests.R2));
  assert.deepEqual([r.tests.R1.pAdj, r.tests.R2.pAdj], holmAdj([r.tests.R1.p, r.tests.R2.p]).map((x) => +x.toFixed(4)));
  assert.equal(r.tests.R3.n, r.tests.R1.n + r.tests.R2.n);
  assert.equal(r.trades.R1.length, r.tests.R1.n); assert.equal(r.trades.R2.length, r.tests.R2.n);
  for (const x of [...r.trades.R1, ...r.trades.R2]) assert.ok(x[1] >= (CROSSES.includes(x[0]) ? '2020' : '2010') && (CROSSES.includes(x[0]) || x[1] < '2016'));
  assert.match(md.split('\n').find((l) => l.startsWith('**Verdict:')), new RegExp(`^\\*\\*Verdict: ${r.reading}\\.\\*\\*`));
  const f = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
  for (const k of ['R1', 'R2', 'R3']) { const v = r.tests[k];
    assert.ok(md.includes(`| ${k} | ${v.n} | `), k);
    assert.ok(md.includes(f(v.net)), `${k} net`); assert.ok(md.includes(v.tMonth.toFixed(2)), `${k} t`); }
  assert.ok(md.includes(r.tests.R1.pAdj.toFixed(4)) && md.includes(r.tests.R2.pAdj.toFixed(4)));
});

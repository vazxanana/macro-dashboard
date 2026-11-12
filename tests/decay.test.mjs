// node --test tests/decay.test.mjs — the Coach's edge-decay monitor (council/decay.mjs), its digest line and its calibration
// on the records where the answer is known (research/edge/decay-monitor). Pure, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DK, SYSTEMS, cusum, drawdown, allowance, controlLimit, makeBase, assess, fold, recordOf, buildDecay, loadBase, describe } from '../council/decay.mjs';
import { decayLine, waiting, merNet, ictNet } from '../council/digest.mjs';

const rdE = (f) => JSON.parse(fs.readFileSync(new URL(`../research/edge/${f}`, import.meta.url), 'utf8'));
const DAY = 86400, T0 = Date.UTC(2026, 0, 1) / 1000;
const pts = (rs, src = 'live') => rs.map((R, i) => ({ t: T0 + i * DAY, R, src }));
const B = { ref: 0.5, sd: 1.5, k: allowance(0.5, 1.5), h: 5, W: 20, maxDD: 10, ddLimit: 12 };

test('cusum: one-sided, resets at zero, in SD units with the allowance', () => {
  const c = cusum([-1, -1, 3, -1], 0.5, 1, 0.25);   // increments (0.5 − x) − 0.25: +1.25, +1.25, −2.75, +1.25
  assert.deepEqual(c.path.map((v) => +v.toFixed(2)), [1.25, 2.5, 0, 1.25]);
  assert.equal(+c.max.toFixed(2), 2.5);
  assert.equal(allowance(0.5, 1.5), 0.5 / 3);
  assert.equal(allowance(0.01, 2), DK.kMin, 'a backtest edge near zero gets the minimum allowance');
});
test('drawdown: from the running peak, current and worst, as positive R', () => {
  assert.deepEqual(drawdown([1, 2, -1, -2, 1]), { cur: 2, max: 3 });
  assert.deepEqual(drawdown([]), { cur: 0, max: 0 });
});
test('control limit: reproducible, higher for a higher quantile and a longer horizon', () => {
  const R = []; for (let i = 0; i < 200; i++) R.push(i % 3 ? -1 : 2.6);
  const d = describe(R), k = allowance(d.mean, d.sd), a = controlLimit(R, { ref: d.mean, sd: d.sd, k, H: 40, iters: 600 });
  assert.equal(a, controlLimit(R, { ref: d.mean, sd: d.sd, k, H: 40, iters: 600 }));
  assert.ok(controlLimit(R, { ref: d.mean, sd: d.sd, k, H: 40, q: 0.99, iters: 600 }) > a);
  assert.ok(controlLimit(R, { ref: d.mean, sd: d.sd, k, H: 120, iters: 600 }) > a);
  const b = makeBase(R, { perYear: 50, maxDD: 30, ddAllow: 0 });
  assert.equal(b.ddLimit, 30, 'the drawdown limit is at least the historical worst');
  assert.ok(b.h > 0 && b.W === 30 && b.H === 50);
});

test('assess: a record like its backtest is healthy; a long run below it is decaying, with the reasons', () => {
  const ok = []; for (let i = 0; i < 60; i++) ok.push(i % 2 ? 1.5 : -0.5);   // +0.5 a trade
  const a = assess(pts(ok), B);
  assert.equal(a.status, 'healthy'); assert.equal(a.n, 60); assert.equal(a.roll.n, 20); assert.equal(a.roll.exp, 0.5);
  const bad = ok.concat(Array(12).fill(-0.6));
  const d = assess(pts(bad), B);
  assert.equal(d.status, 'decaying'); assert.ok(d.cusRef.s >= B.h);
  assert.match(d.why[0], /below half its backtest edge/);
  assert.ok(d.why.some((w) => /losing money/.test(w)) === d.cusZero.s >= B.h);
});
test('assess: watch from 3/4 of the CUSUM limit or of the drawdown limit; drawdown beyond the limit is decaying', () => {
  const w = assess(pts([0.5, 0.5, 0.5, 0.5, 0.5, -1, -1, -1, -1, -1]), { ...B, h: 5, ddLimit: 100 });   // S = 5 × 5/6 ≈ 4.17 of 5
  assert.equal(w.status, 'watch'); assert.match(w.why.join(' '), /close to its limit/);
  const dd = assess(pts([5, -1, -1, -1, -1, -1, -1, -1, -1, 0.5, -0.5]), { ...B, h: 1e9, ddLimit: 10 });   // drawdown 8 of 10
  assert.equal(dd.status, 'watch'); assert.match(dd.why.join(' '), /80% of its limit/);
  const over = assess(pts([5].concat(Array(13).fill(-1))), { ...B, h: 1e9, ddLimit: 12 });
  assert.equal(over.status, 'decaying'); assert.match(over.why.join(' '), /beyond its limit 12R/);
});
test('assess: too few trades gives no verdict', () => {
  const a = assess(pts([-1, -1, -1]), B);
  assert.equal(a.status, 'healthy'); assert.equal(a.few, true); assert.match(a.why[0], /only 3 trades/);
});

// ─── records ───
const rp = (k, i, R, extra = {}) => ({ id: `rp-${k}-${i}`, k, market: 'xau', status: R > 0 ? 'win' : 'loss', R, opened: T0 + i * DAY, closed: T0 + i * DAY + 3600, replay: true, ...extra });
test('fold: a pyramid add counts with its first trade', () => {
  const F = fold([{ id: 'a', R: 2, opened: 1, closed: 5, status: 'win' }, { id: 'b', addOf: 'a', R: 1, opened: 2, closed: 9, status: 'win' }], (x) => x.R);
  assert.deepEqual(F.map((p) => [p.id, p.R, p.t]), [['a', 3, 9]]);
});
test('recordOf: the replay up to the first forward trade, then the forward record (live, net of costs; shadows left out)', () => {
  const replay = { trades: [rp('replica', 0, 2), rp('replica', 1, -1), rp('replica', 2, -1), rp('replica', 3, 2), rp('gtrend', 1, 5)] };
  const trades = [{ id: 'l1', k: 'replica', status: 'win', R: 2, Rnet: 1.9, opened: T0 + 2 * DAY + 60, closed: T0 + 3 * DAY },
    { id: 'l2', k: 'replica', status: 'loss', R: -1, Rnet: -1.1, shadow: true, opened: T0 + 4 * DAY, closed: T0 + 4 * DAY + 60 },
    { id: 'l3', k: 'replica', status: 'open', R: null, opened: T0 + 5 * DAY }];
  const P = recordOf(SYSTEMS.find((s) => s.id === 'replica'), { trades, replay });
  assert.deepEqual(P.map((p) => [p.R, p.src]), [[2, 'replay'], [-1, 'replay'], [-1, 'replay'], [1.9, 'live']]);
  const nq = recordOf(SYSTEMS.find((s) => s.id === 'nq-open'), { research: [{ id: 'n1', k: 'nq-open', session: 'nyflip', status: 'win', R: 2, opened: T0, exitAt: T0 + 600 },
    { id: 'n2', k: 'nq-open', session: 'nyflip-x', status: 'win', R: 2, opened: T0, exitAt: T0 + 600 }], replay: { trades: [] } });
  assert.deepEqual(nq.map((p) => [p.R, p.src]), [[2, 'live']], 'only the live session; the skipped-filter records are not the system');
  const ict = recordOf(SYSTEMS.find((s) => s.id === 'ict-a'), { ictTrades: [{ id: 'i1', market: 'nq', aset: true, size: 1, entry: 100, r0: 50, status: 'win', R: 2, opened: T0, closed: T0 + 60 },
    { id: 'i2', market: 'nq', aset: false, status: 'win', R: 2, opened: T0, closed: T0 + 60 }], ictReplay: { trades: [] } });
  assert.equal(ict.length, 1); assert.equal(ict[0].R, +ictNet({ market: 'nq', size: 1, r0: 50, R: 2 }).toFixed(3));
  const mo = recordOf(SYSTEMS.find((s) => s.id === 'mosha-bo'), { trades: [], replay: { trades: [] } }, { hist: [[T0, -1], [T0 + DAY, 2]] });
  assert.deepEqual(mo.map((p) => p.src), ['hist', 'hist'], 'no council replay: the rebuild history stands in');
  assert.equal(merNet({ R: 2, Rnet: 1.9 }), 1.9);
});

test('buildDecay: one row per system from the baseline file; decaying / watch list only live systems; inputs untouched', () => {
  // 11 Nov 2026 (owner, supported-book): the replica is a paper shadow like crypto trend; Gold trend is one of the two live systems
  const base = { at: 'x', systems: { replica: { ...B, src: 'test' }, gtrend: { ...B, src: 'test' }, trend: { ...B, src: 'test' } } };
  const bad = []; for (const k of ['replica', 'gtrend', 'trend']) for (let i = 0; i < 40; i++) bad.push(rp(k, i, -1));
  const D = { trades: [], research: [], ictTrades: [], replay: { trades: bad }, ictReplay: null }, before = JSON.stringify(D);
  const out = buildDecay(D, { now: T0 + 100 * DAY, base });
  assert.equal(JSON.stringify(D), before, 'the monitor writes nothing back into the records');
  assert.deepEqual(out.systems.map((s) => [s.id, s.status, s.live, s.shadowSince || null]), [['replica', 'decaying', false, '2026-11-11'], ['gtrend', 'decaying', true, null], ['trend', 'decaying', false, '2026-11-07']]);
  assert.deepEqual(out.decaying, ['gtrend'], 'the replica and crypto trend are shadows: shown, not alerted');
  assert.match(out.rule, /never changes a rule/);
  assert.match(buildDecay(D, { base: null }).error, /no baseline/);
});
test('the monitor has no way to change a rule: it imports no config writer and touches no file but its baseline', () => {
  const src = fs.readFileSync(new URL('../council/decay.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /writeFileSync|config\.|filters|focusSetups/);
});

test('digest: one Edge decay line only when a LIVE system is decaying', () => {
  const sys = (id, status, live = true) => ({ id, name: id, live, status, roll: { n: 30, exp: -0.2 }, cusRef: { s: 13, h: 12.7 }, dd: { cur: 9, limit: 20 } });
  assert.equal(decayLine(null), null);
  assert.equal(decayLine({ systems: [sys('a', 'healthy'), sys('b', 'watch'), sys('trend', 'decaying', false)] }), null);
  const l = decayLine({ systems: [sys('NQ New York open run', 'decaying'), sys('b', 'healthy')] });
  assert.equal(l, 'Edge decay: NQ New York open run (last 30 −0.20R a trade, CUSUM 13/12.7, DD 9.0R of 20R). Status only, no rule changed: your call.');
  const W = waiting({ coach: { proposals: [], decay: { systems: [sys('Gold replica', 'decaying')] } }, health: { status: 'ok', at: new Date().toISOString() } }, Math.floor(Date.now() / 1000), {});
  assert.ok(W.some((s) => /^Edge decay: Gold replica/.test(s)));
  const W0 = waiting({ coach: { proposals: [], decay: { systems: [sys('Gold replica', 'watch')] } }, health: { status: 'ok', at: new Date().toISOString() } }, Math.floor(Date.now() / 1000), {});
  assert.ok(!W0.some((s) => /Edge decay/.test(s)));
});

// ─── the shipped baselines and the calibration (research/edge/decay-monitor/RESULT.md) ───
const BASE = loadBase();
test('decay-base.json: a baseline for every system, with sane limits', () => {
  assert.ok(BASE && BASE.systems);
  for (const s of SYSTEMS) { const b = BASE.systems[s.id]; assert.ok(b, s.id);
    assert.ok(b.sd > 0 && b.h > 0 && b.k >= DK.kMin && b.W >= DK.rollMin && b.W <= DK.rollMax, s.id);
    assert.ok(b.ddLimit >= b.maxDD && b.ddLimit >= b.mcDD, s.id); }
  assert.ok(BASE.systems.replica.ddLimit >= 40, 'gold replica: the owner allows a 30-40R drawdown (#512)');
  assert.ok(BASE.systems['mosha-bo'].hist.length > 10, 'Mosha BO has no council replay: the rebuild history stands in');
});
const sec = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 1000);
function firstDecay(points, b) { for (let i = 0; i < points.length; i++) if (assess(points.slice(0, i + 1), b).status === 'decaying') return points[i]; return null; }
test('calibration: crypto trend (baseline 2017-23) is flagged decaying in mid/late 2025, not in 2024', () => {
  const C = rdE('crypto-trend-decay/result.json').trades.map((x) => ({ t: sec(x.exit), R: x.R, e: x.entry, d: x.exit, src: 'live' })).sort((a, b) => a.t - b.t);
  const pre = C.filter((x) => x.e < '2024'), post = C.filter((x) => x.e >= '2024');
  const yrs = (pre.at(-1).t - pre[0].t) / (365.25 * DAY), b = makeBase(pre.map((x) => x.R), { perYear: (pre.length - 1) / yrs, maxDD: 10 });
  const f = firstDecay(post, b);
  assert.ok(f, 'flagged'); assert.ok(f.d >= '2025-06-01' && f.d <= '2025-12-31', `first decaying ${f.d}`);
});
test('calibration: the NQ open run is never flagged in 2023-26 (shipped baseline), and the dead 2014-22 era is caught within a year', () => {
  const N = rdE('nq-open-oos/result.json').trades.map((x) => ({ t: sec(x.d) + x.m * 60, R: x.R, y: +x.d.slice(0, 4), src: 'live' }));
  const b = BASE.systems['nq-open'], late = N.filter((x) => x.y >= 2023);
  for (let i = 0; i < late.length; i++) assert.equal(assess(late.slice(0, i + 1), b).status, 'healthy', `trade ${i + 1}`);
  const dead = N.filter((x) => x.y >= 2014 && x.y <= 2022), f = firstDecay(dead, b);
  assert.ok(f && dead.indexOf(f) < b.perYear, 'caught within a year of trades');
});

// mosha-oos (8 Nov): a system with no council replay is shown with its rebuild record but judged only on its forward trades
test('a rebuild-only record (no council replay) gives no verdict until the forward record has minN trades', () => {
  const b = makeBase(Array.from({ length: 60 }, (_, i) => (i % 3 ? 0.4 : -0.9)), { perYear: 18, maxDD: 10 });
  const hist = Array.from({ length: 48 }, (_, i) => ({ t: T0 + i * DAY, R: -1.2, src: 'hist' }));   // a losing rebuild tail
  const a = assess(hist, b);
  assert.equal(a.status, 'healthy'); assert.equal(a.few, true); assert.match(a.why[0], /no council replay/);
  const live = Array.from({ length: DK.minN }, (_, i) => ({ t: T0 + (60 + i) * DAY, R: -1.2, src: 'live' }));
  const c = assess(hist.concat(live), b);
  assert.equal(c.few, undefined); assert.equal(c.status, 'decaying', 'with enough forward trades the record is judged as before');
  const r = assess(hist.map((p) => ({ ...p, src: 'replay' })), b);
  assert.equal(r.status, 'decaying', 'a council replay record is judged as before');
});

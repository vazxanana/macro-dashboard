// node --test tests/financing-rest.test.mjs — overnight financing made the same everywhere (11 Nov 2026, the follow-up to the
// owner's approval of the cost): the edge-decay baselines, the council replay rows the monitor and the scoreboard read, the
// engine's 30-day replay, and the page between two 6-hour Coach readings. Pure, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { FIN, nights, financing, rowFinancing, replayFin, tradeCost, replayBar, spotClosed } from '../council/fills.mjs';
import { loadBase, makeBase, describe, recordOf, replayNet, buildDecay, SYSTEMS } from '../council/decay.mjs';
import { merNet } from '../council/digest.mjs';
import { coachProposals } from '../council/proposals.mjs';
import { computeVersion } from '../academy/gen/study.mjs';
import { EDGES } from '../academy/edges.mjs';

const rd = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), J = (f) => JSON.parse(rd(f));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const ts = (iso) => Date.parse(iso) / 1000;
const html = rd('market-structure.html');
const script = (id) => html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))[1];

// ─── 1. the decay baselines ───
const BASE = loadBase(), POS = J('research/edge/decay-monitor/positions.json').systems;
const REC = { gtrend: ['gtrend', 'gtrend20'], gtrend5: ['gtrend', 'gtrend5'], gtl: ['gtl'], geg: ['geg'], gmp: ['gmp'], 'mosha-bo': ['mosha'] };
const recOf = ([f, key]) => { const j = J(`research/edge/robustness/out/${f}.json`); return { T: key ? j.trades[key] : j.trades, P: POS[key || f] }; };

test('positions.json: one row for every position of the rebuild records, in their order, with a price, a risk and an exit after the entry', () => {
  for (const [id, r] of Object.entries(REC)) {
    const { T, P } = recOf(r); assert.equal(P.length, T.length, `${id}: every position`);
    T.forEach((x, i) => { const [t, o, c, e, r0, side] = P[i]; assert.equal(t, x.t, `${id} ${i}: same position`); assert.equal(side, x.side);
      assert.ok(o >= t && c >= o && e > 0 && r0 > 0, `${id} ${i}: entry, exit, price, risk`); if (x.r0 != null) near(r0, x.r0, 1e-3, `${id} ${i}: the record's own risk`);
      if (x.days != null) assert.ok(c - o >= (x.days - 1) * 86400 * 0.95 && c - o <= (x.days - 1) * 86400 * 1.5 + 4 * 86400, `${id} ${i}: Gold trend's exit day is days - 1 daily candles after its entry day`); });
  }
  assert.deepEqual(J('research/edge/decay-monitor/positions.json').cols, ['t', 'o', 'c', 'e', 'r0', 'side']);
});
test('the rebuild\'s rule file is not edited for this: the Academy\'s version of the momentum pullback edge still matches it', () => {
  const g = EDGES.find((e) => e.id === 'gmp'); assert.ok(g.ruleSource.includes('research/edge/robustness/systems.mjs')); assert.equal(g.version, computeVersion(g.ruleSource));
  const src = rd('research/edge/decay-monitor/positions.mjs');
  assert.match(src, /REFUSES to\n\/\/ write unless every position it gets equals the committed record/); assert.match(src, /fs\.unlinkSync\(tmp\)/);
  assert.doesNotMatch(rd('research/edge/robustness/systems.mjs'), /financing/, 'no financing code in the rule file');
});
test('decay-base.json: each gold baseline is its rebuild record less nights x rate x entry / risk on the buys (first unit), by the Trader\'s own night counter', () => {
  assert.equal(BASE.financing.rate, FIN.xau.long); assert.equal(BASE.financing.asOf, FIN.xau.asOf);
  assert.deepEqual(BASE.financing.systems, ['replica', 'mosha-bo', 'gtrend', 'gtrend5', 'gtl', 'geg', 'gmp']);
  for (const [id, r] of Object.entries(REC)) {
    const { T, P } = recOf(r), b = BASE.systems[id];
    const fin = T.map((x, i) => x.side > 0 ? nights(P[i][1], P[i][2]) * FIN.xau.long * P[i][3] / P[i][4] : 0), R = T.map((x, i) => x.R - fin[i]), d = describe(R), d0 = describe(T.map((x) => x.R));
    assert.equal(b.n, T.length); near(b.ref, d.mean, 0.00051, `${id} ref after financing`); near(b.sd, d.sd, 0.00051, `${id} sd`);
    near(b.fin.before.ref, d0.mean, 0.00051, `${id} ref before financing`); near(b.fin.perTrade, d0.mean - d.mean, 0.00051, `${id} financing a position`);
    assert.equal(b.fin.charged, fin.filter((f) => f > 0).length); assert.ok(b.ref < b.fin.before.ref, `${id}: financing only lowers a baseline`);
    assert.ok(T.every((x, i) => x.side > 0 || fin[i] === 0), 'a sell pays nothing and is credited nothing');
    // the limits are makeBase of that same record (same seeds): nothing else moved
    const m = makeBase(T.map((x, i) => ({ t: x.t, R: R[i] })).sort((x, y) => x.t - y.t).map((p) => p.R), { perYear: b.perYear, maxDD: 0 }); assert.equal(b.k, m.k); assert.equal(b.h, m.h); assert.equal(b.mcDD, m.mcDD);
  }
  // the long holds pay the most: about three weeks a Gold trend position against days for the others
  assert.ok(BASE.systems.gtrend.fin.nights > 15 && BASE.systems.gtl.fin.nights < 5 && BASE.systems.gmp.fin.nights < 1);
  near(BASE.systems.gtrend.fin.before.ref, 1.64, 1e-9, 'Gold trend before: the figure of the 10 Nov file'); near(BASE.systems.geg.fin.before.ref, 0.198, 1e-9, 'daily engulf before');
  for (const id of ['nq-open', 'ict-a', 'trend']) assert.equal(BASE.systems[id].fin, undefined, `${id}: no financing, and no block that says there is`);
  assert.match(BASE.financing.notComputed, /NQ open run/);
  // Mosha's stand-in record (hist) is the charged one too
  const mo = recOf(REC['mosha-bo']), last = mo.T.at(-1), lp = mo.P.at(-1), want = last.R - (last.side > 0 ? nights(lp[1], lp[2]) * FIN.xau.long * lp[3] / lp[4] : 0);
  near(BASE.systems['mosha-bo'].hist.at(-1)[1], want, 0.00051, 'hist row');
});

// ─── 2. replay rows: the monitor's record, the baseline of the replica, the scoreboard ───
const row = (o) => ({ id: 'r' + Math.random(), market: 'xau', k: 'gtrend', side: 'buy', entry: 4000, stop: 3960, opened: ts('2026-03-02T10:00:00Z'), filled: ts('2026-03-02T10:00:00Z'), closed: ts('2026-03-06T10:00:00Z'), status: 'win', R: 2, replay: true, ...o });
test('rowFinancing: a replay row with no stamped cost pays the Trader\'s charge; a stamped row, a sell and another market pay nothing here', () => {
  const x = row({}), f = rowFinancing(x);   // Mon 10:00 to Fri 10:00: Mon, Tue, Wed x3, Thu = 6 rollovers
  assert.equal(f.nights, 6); near(f.finR, 6 * FIN.xau.long * 4000 / 40, 1e-12, 'nights x rate x entry / risk');
  assert.deepEqual(rowFinancing(x), financing(x), 'the Trader\'s own function');
  assert.equal(rowFinancing(row({ side: 'sell', stop: 4040 })).finR, 0); assert.equal(rowFinancing(row({ market: 'nq' })).finR, 0);
  assert.equal(rowFinancing(row({ costR: 0.02 })).finR, 0, 'a cost stamped at the close is never added to'); assert.equal(rowFinancing(row({ Rnet: 1.9 })).finR, 0);
  // a replica row whose stop moved to break-even: the risk is the first stop's
  near(rowFinancing(row({ stop: 4000, stop0: 3980 })).finR, 6 * FIN.xau.long * 4000 / 20, 1e-12, 'stop0');
  assert.equal(rowFinancing(null).finR, 0);
});
test('decay record: replay rows are read after financing (sized), forward trades keep the cost they were stamped with', () => {
  const sys = SYSTEMS.find((s) => s.id === 'gtrend');
  const rp = [row({ id: 'a', R: 2 }), row({ id: 'b', R: -1, status: 'loss', rawR: -1, size: 0.5, opened: ts('2026-03-09T10:00:00Z'), filled: ts('2026-03-09T10:00:00Z'), closed: ts('2026-03-10T10:00:00Z') })];
  const lv = [{ id: 'l', market: 'xau', k: 'gtrend', side: 'buy', entry: 4000, stop: 3960, r0: 40, opened: ts('2026-11-02T10:00:00Z'), filled: ts('2026-11-02T10:00:00Z'), closed: ts('2026-11-06T10:00:00Z'), status: 'win', R: 2, costR: 0.02, Rnet: 1.98 }];
  const rec = recordOf(sys, { trades: lv, replay: { trades: rp } });
  near(rec[0].R, 2 - 6 * FIN.xau.long * 100, 0.00051, 'replay row a'); near(rec[1].R, -1 - 1 * FIN.xau.long * 100 * 0.5, 0.00051, 'replay row b at half size');
  assert.equal(rec[2].R, 1.98, 'the forward trade: its own stamped net, not recosted'); assert.equal(rec[2].src, 'live');
  assert.equal(replayNet(lv[0]), merNet(lv[0])); assert.ok(replayNet(rp[0]) < merNet(rp[0]));
  assert.equal(JSON.stringify(rp[0].R), '2', 'the stored row is not changed');
  // the baseline build costs the replica's replay rows with the same function
  const run = rd('research/edge/decay-monitor/run.mjs'); assert.match(run, /fold\(L, replayNet\)/); assert.match(run, /replica: \{ rec: rp\('replica'\)/);
  assert.ok(BASE.systems.replica.fin.perTrade > 0 && BASE.systems.replica.fin.perTrade < 0.03); near(BASE.systems.replica.fin.before.ref, 0.877, 1e-9, 'replica before');
  // a reading says its backtests carry the charge
  const d = buildDecay({ trades: [], research: [], replay: { trades: [] } }, { now: 1.8e9 }); assert.deepEqual(d.financing, { asOf: FIN.xau.asOf, rate: FIN.xau.long, systems: BASE.financing.systems });
});

// ─── 3. the engine's replay ───
const bar = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c });
const variants = (stop) => [['none', null, false], ['be1', 1, false], ['be15', 1.5, false], ['tp2', null, true], ['pt1', null, false, { at: 1, trail: 1 }]]
  .map(([n, be, t2, pt]) => ({ n, be, t2, pt, stop, beMoved: false, done: false, R: null, size: 1, booked: 0, best: 0 }));
const rtrade = (o) => { const tr = { m: 'xau', t2: null, mfe: 0, ...o }; tr.r0 = Math.abs(tr.entry - tr.stop); tr.v = variants(tr.stop); return tr; };
const play = (tr, bars) => { for (const b of bars) replayBar(tr, b, { shut: spotClosed(b.time), wait: 86400 }); return tr; };
test('parity: a replay trade held over rollovers is charged what the Trader stamps on the same trade at its close', () => {
  const GOLD = { group: 'Metals', spot: true }, t0 = ts('2026-11-02T10:00:00Z');   // Monday
  // buy 4000, stop 3980, target 4060: quiet hourly candles until Thursday 12:00, then the target
  const bars = []; for (let t = t0 + 3600; t < ts('2026-11-05T12:00:00Z'); t += 3600) bars.push(bar(t, 4005, 4010, 3995, 4005));
  const hit = ts('2026-11-05T12:00:00Z'); bars.push(bar(hit, 4010, 4065, 4008, 4060));
  const tr = play(rtrade({ side: 'buy', entry: 4000, stop: 3980, t1: 4060, rr: 3, status: 'open', opened: t0, filled: t0 }), bars);
  assert.equal(tr.status, 'closed'); assert.equal(tr.v[0].R, 3); assert.equal(tr.v[0].closed, hit);
  const live = { market: 'xau', side: 'buy', entry: 4000, stop: 3980, r0: 20, rr: 3, opened: t0, filled: t0, closed: hit, status: 'win', R: 3, exitKind: 'target' };
  const c = tradeCost(live, GOLD);
  assert.equal(c.nights, 5, 'Mon, Tue, Wed x3'); near(replayFin(tr), c.finR, 1e-12, 'the same charge'); near(replayFin(tr), 5 * FIN.xau.long * 4000 / 20, 1e-12, 'nights x rate x entry / risk');
  // a variant that left earlier pays for its own hold; one still running pays nothing yet
  const be = tr.v[1]; assert.ok(be.done); near(replayFin(tr, be), financing({ market: 'xau', side: 'buy', entry: 4000, r0: 20, filled: t0, closed: be.closed }).finR, 1e-12, 'be1');
  assert.equal(replayFin(rtrade({ side: 'buy', entry: 4000, stop: 3980, t1: 4060, rr: 3, status: 'open', opened: t0, filled: t0 })), 0);
  // a sell, a forex trade and an intraday buy: nothing
  const s = play(rtrade({ side: 'sell', entry: 4010, stop: 4030, t1: 3950, rr: 3, status: 'open', opened: t0, filled: t0 }), bars.map((b) => bar(b.time, 4005, 4010, 3995, 4005)).concat([bar(hit + 3600, 4000, 4001, 3940, 3950)]));
  assert.equal(s.status, 'closed'); assert.equal(replayFin(s), 0);
  const fx = play(rtrade({ m: 'eurusd', side: 'buy', entry: 4000, stop: 3980, t1: 4060, rr: 3, status: 'open', opened: t0, filled: t0 }), bars); assert.equal(replayFin(fx), 0);
  const day = play(rtrade({ side: 'buy', entry: 4000, stop: 3980, t1: 4060, rr: 3, status: 'open', opened: t0, filled: t0 }), [bar(t0 + 3600, 4010, 4065, 4008, 4060)]); assert.equal(replayFin(day), 0);
});
test('backtest.mjs writes the charge of the live exit in its own column, appended last; the stored cost column and every R column are as they were', () => {
  const src = rd('council/backtest.mjs');
  assert.match(src, /import \{[^}]*replayFin[^}]*\} from '\.\/fills\.mjs'/);
  assert.match(src, /'newsT1', 'newsMin', 'R_pt1', 'fin'\]/, 'fin is the last column: older indexes hold');
  assert.match(src, /op \? null : \+replayFin\(x\)\.toFixed\(3\)\]; \}\)/);
  assert.match(src, /tr\.cost = tr\.r0 > 0 \? costOf\(M, tr\.entry, tr\.filled !== t\) \/ tr\.r0 : 0;/, 'the cost column is still the spread alone');
  assert.match(src, /financing: \(\(\) => \{ const a = all\.map\(\(x\) => replayFin\(x\)\)/);
  // the Coach's own filter statistics (trader.mjs) read cost only: financing never moves a live filter
  const tr = rd('council/trader.mjs'); assert.match(tr, /for \(const k of \['R_none', 'R_be1', 'R_be15', 'R_tp2'\]\) if \(t\[k\] != null\) t\[k\] = \+\(t\[k\] - \(t\.cost \|\| 0\)\)\.toFixed\(3\);/);
});
test('readers of the 30-day replay: proposals and the scoreboard take the charge off; a file without the column reads as before', () => {
  const cols = ['market', 'setup', 'side', 'opened', 'filled', 'rr', 'd1', 'struct', 'session', 'R_none', 'cost', 'fill', 'status'];
  const mkB = (withFin) => ({ from: '2026-10-12T00:00:00Z', to: '2026-11-11T00:00:00Z', days: 30, tradeCols: withFin ? cols.concat('fin') : cols,
    trades: Array.from({ length: 40 }, (_, i) => { const r = ['xau', 'swing', 'buy', 1.79e9 + i * 3600, 1.79e9 + i * 3600, 2, 'with', 'main', 'london', i % 2 ? 2 : -1, 0.05, 1, 'closed']; return withFin ? r.concat(0.02) : r; }) });
  const W = {}; vm.runInNewContext(script('ms-sb-js'), { window: W }); const SB = W.MS_SB;
  const a = SB.build({ backtest: mkB(false), config: { filters: { swing: { off: true } } }, now: 1.8e9 }).find((r) => r.id === 'mer-swing-replay');
  const b = SB.build({ backtest: mkB(true), config: { filters: { swing: { off: true } } }, now: 1.8e9 }).find((r) => r.id === 'mer-swing-replay');
  near(a.s.R, 40 * 0.5 - 40 * 0.05, 1e-9, 'before: R less spread'); near(b.s.R, a.s.R - 40 * 0.02, 1e-9, 'after: less the financing column too');
  near(b.pts[0].c, 0.07, 1e-12, 'the point\'s cost is spread + financing'); assert.equal(b.pts[0].g, a.pts[0].g, 'the gross R is untouched');
  const src = rd('council/proposals.mjs'); assert.match(src, /R: \+\(t\.R_none - \(hasCost \? t\.cost \|\| 0 : 0\) - \(\+t\.fin \|\| 0\)\)\.toFixed\(3\)/);
  assert.equal(JSON.stringify(coachProposals(mkB(false), {})), JSON.stringify(coachProposals({ ...mkB(true), trades: mkB(true).trades.map((r) => r.slice(0, -1).concat(0)) }, {})), 'a zero charge changes no proposal');
});
test('scoreboard: a system replay\'s gold buys pay financing at the rate the Trader publishes, by a night counter equal to the Trader\'s; no rate, no charge', () => {
  const W = {}; vm.runInNewContext(script('ms-sb-js'), { window: W }); const SB = W.MS_SB;
  // the page's night counter and charge against council/fills.mjs on 2,000 pseudo-random holds
  let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 2000; i++) {
    const t = Math.floor(1.6e9 + rnd() * 2e8), c = t + Math.floor(rnd() * 30 * 86400); assert.equal(SB.nightsOf(t, c), nights(t, c));
    const x = row({ entry: 1800 + rnd() * 2500, opened: t, filled: rnd() < 0.5 ? t : undefined, closed: c, side: rnd() < 0.8 ? 'buy' : 'sell', market: rnd() < 0.9 ? 'xau' : 'nq' }); x.stop = x.entry - 5 - rnd() * 60; if (rnd() < 0.3) { x.stop0 = x.stop; x.stop = x.entry; } if (rnd() < 0.2) { x.rawR = x.R; x.size = 0.5; } if (rnd() < 0.1) x.costR = 0.01;
    near(SB.finOf(x, { xau: FIN.xau.long }), rowFinancing(x).finR * (x.rawR != null && x.size ? x.size : 1), 1e-12, 'finOf');
  }
  const replay = { from: '2022-12-27', trades: Array.from({ length: 30 }, (_, i) => row({ id: 'g' + i, k: 'gtrend', name: 'Gold trend', R: i % 3 ? 2 : -1, status: i % 3 ? 'win' : 'loss', opened: 1.7e9 + i * 20 * 86400, filled: 1.7e9 + i * 20 * 86400, closed: 1.7e9 + i * 20 * 86400 + 12 * 86400 }))
    .concat(Array.from({ length: 30 }, (_, i) => row({ id: 'n' + i, k: 'nq-open', session: 'nyflip', market: 'nq', name: 'NQ', R: i % 2 ? 1 : -1, status: i % 2 ? 'win' : 'loss', opened: 1.7e9 + i * 86400, filled: 1.7e9 + i * 86400, closed: 1.7e9 + i * 86400 + 3600 }))) };
  const snapshot = { costs: { financing: { perNight: { xau: FIN.xau.long } } } };
  const old = SB.build({ replay, now: 1.8e9 }), now = SB.build({ replay, snapshot, now: 1.8e9 }), by = (R, id) => R.find((r) => r.id === id);
  const g0 = by(old, 'mer-gtrend-sysreplay'), g1 = by(now, 'mer-gtrend-sysreplay'), want = replay.trades.filter((x) => x.k === 'gtrend').reduce((q, x) => q + rowFinancing(x).finR, 0);
  assert.ok(want > 1); near(g0.s.R - g1.s.R, want, 1e-9, 'the row\'s total falls by the financing of its trades');
  assert.match(g1.src, /^system replay since 2022, after financing$/); assert.equal(g0.src, 'system replay since 2022', 'an older snapshot with no rate: nothing charged, and the row does not claim it');
  assert.equal(by(now, 'mer-nq-open-sysreplay').s.R, by(old, 'mer-nq-open-sysreplay').s.R, 'NQ pays nothing'); assert.equal(by(now, 'mer-nq-open-sysreplay').src, 'system replay since 2022');
  near(g1.pts.reduce((q, p) => q + p.g, 0), replay.trades.filter((x) => x.k === 'gtrend').reduce((q, x) => q + x.R, 0), 1e-9, 'gross R as stored');
  // the page and the digest hand the snapshot to the scoreboard
  assert.match(html, /replay: C\.replay, snapshot: C\.snap, mirror: C\.mirror/); assert.match(rd('council/digest.mjs'), /replay: rd\('research\/replay-2w\.json'\), snapshot: rd\('snapshot\.json'\)/);
});

// ─── 5. between two Coach readings ───
function deck() { const W = {}, doc = { getElementById: () => null, addEventListener() {} }; vm.runInNewContext(script('ms-decay-js'), { window: W, document: doc, setTimeout() {}, CustomEvent: function () {} }); return W; }
test('an older coach.json (made before the owner\'s decision) is shown with the systems that are live now, and says it is older', () => {
  const W = deck(), sysOld = (id, name, x = {}) => ({ id, name, desk: 'Meridian', live: true, status: 'healthy', ...x });
  const coach = { decay: { at: '2026-11-11T18:00:28Z', systems: [sysOld('replica', 'Gold replica'), sysOld('mosha-bo', 'Mosha BO', { few: true }), sysOld('gtrend', 'Gold trend'), sysOld('gtrend5', 'Gold trend fast', { live: false }), sysOld('gtl', 'Gold H4 trendline'),
    sysOld('geg', 'Gold daily engulf'), sysOld('gmp', 'Gold momentum pullback'), sysOld('nq-open', 'NQ New York open run'), sysOld('ict-a', 'ICT A-setups', { desk: 'ICT' }), sysOld('trend', 'Crypto trend', { live: false, status: 'decaying' })] } };
  coach.expect = { systems: coach.decay.systems.map((s) => ({ id: s.id, name: s.name, live: s.live })) };
  const config = { ownerShadow: { replica: 1794434536, 'mosha-bo': 1794434536, gtl: 1794434536, gmp: 1794434536, 'nq-open': 1794434536 } };
  assert.equal(W.MS_DECAY_TALLY(coach.decay.systems).live.length, 8, 'what the card counted before: 8 live systems');
  assert.equal(W.MS_BOOK_NOW(coach, config), 10, 'five rows in each block');
  assert.deepEqual(W.MS_DECAY_TALLY(coach.decay.systems).live.map((s) => s.id), ['gtrend', 'geg', 'ict-a']);
  assert.deepEqual(coach.expect.systems.filter((s) => s.live).map((s) => s.id), ['gtrend', 'geg', 'ict-a']);
  const r = coach.decay.systems.find((s) => s.id === 'replica'); assert.equal(r.shadowSince, '2026-11-11'); assert.equal(r.bookLate, true); assert.equal(coach.decay.bookLate, 5);
  assert.equal(coach.decay.systems.find((s) => s.id === 'gtrend5').bookLate, undefined, 'a system the reading already calls shadow is left alone');
  assert.equal(W.MS_BOOK_NOW(coach, config), 10, 'idempotent'); assert.equal(W.MS_DECAY_TALLY(coach.decay.systems).live.length, 3);
  // a reading made after the decision already says so: nothing is marked, no "older reading" sentence
  const fresh = { decay: { systems: [{ id: 'replica', live: false, shadowSince: '2026-11-11' }, { id: 'gtrend', live: true }] } };
  assert.equal(W.MS_BOOK_NOW(fresh, config), 0); assert.equal(fresh.decay.bookLate, 0); assert.equal(fresh.decay.systems[0].bookLate, undefined);
  assert.equal(W.MS_BOOK_NOW(coach, {}), 0); assert.equal(W.MS_BOOK_NOW(null, config), 0);
  assert.match(W.MS_BOOK_LATE, /made before your decision/);
  // wiring: before the council event, and in both cards; the sentences and footnotes follow the reading in hand
  assert.match(html, /window\.MS_BOOK_NOW\(COUNCIL\.coach, COUNCIL\.config\); \} catch \(e\) \{\}[^\n]*\n\s*try \{ window\.MS_COUNCIL = COUNCIL;/);
  assert.match(script('ms-decay-js'), /\(D\.bookLate \? esc\(LATE\) : ''\)/); assert.match(script('ms-ex-js'), /W\.MS_BOOK_NOW\(C\.coach, C\.config\)/); assert.match(script('ms-ex-js'), /D\.bookLate \? esc\(W\.MS_BOOK_LATE/);
  assert.match(script('ms-decay-js'), /D\.financing \? '[^']*carry the same charge'\s*: '[^']*do not carry it yet/);
  assert.match(script('ms-ex-js'), /S\.some\(function \(s\) \{ return s\.fin; \}\) \? '[^']*after overnight financing on gold buys[^']*' \+ \(S\.some\(function \(s\) \{ return s\.fin && s\.fin\.everyUnit; \}\) \? '[^']*every unit, the add included[^']*' : ''\)\s*: 'this reading was made before overnight financing was counted/);
  assert.match(html, /<span id="ms-decay-fin">/); assert.match(html, /<span id="ms-expect-fin">/);
});

// ─── 4. wording: which systems are live ───
test('no page or owner document calls the Academy\'s seven edges "live systems"; the owner documents agree on the two that are', () => {
  const files = ['academy.html', 'assets/academy-ui.js', 'assets/academy-tabs.js', 'assets/academy-core.js', 'academy/edges.mjs', 'docs/academy/ARCHITECTURE.md', 'docs/academy/MODULES.md', 'MERIDIAN-X.md', 'MERIDIANX_BUILD_PROGRESS.md'];
  for (const f of files) assert.doesNotMatch(rd(f), /seven live|7 live (systems|edges)|eight live|8 live systems/i, f);
  assert.match(rd('docs/academy/ARCHITECTURE.md'), /live until 11 Nov 2026/); assert.match(rd('academy/edges.mjs'), /all live on paper until 11 Nov 2026/);
  const mx = rd('MERIDIAN-X.md'); assert.match(mx, /two\s+trade live on paper: \*\*Gold trend\*\* \(the 20-day breakout\) and \*\*Gold daily engulf\*\*/); assert.match(mx, /the seven that traded live until 11 Nov 2026/);
  assert.match(html, /<b>Live on paper:<\/b> Gold trend \(20-day breakout\), Gold daily engulf and, since 11 Nov by your choice, the Mosha cycle/);   // 12 Nov: the owner's main paper system named
  assert.match(mx, /Also live on paper, by your own choice of 11 Nov \(kept on 12 Nov\): the \*\*Mosha cycle\*\*/);
  assert.deepEqual(SYSTEMS.filter((s) => !s.shadow).map((s) => s.id), ['gtrend', 'geg', 'ict-a']);
  // the Academy still has the same seven edges
  assert.deepEqual(EDGES.map((e) => e.id), ['replica', 'mosha-bo', 'gtrend', 'gtl', 'geg', 'gmp', 'nq-open']);
});

// node --test tests/academy-edges.test.mjs — the Academy's EDGES module (docs/academy/ARCHITECTURE.md): the registry of the
// seven edges, the generated candidates and outcomes (academy/data, contract shapes, pools, no outcome in a candidate), the
// proof that they are the studies' own trades (n and net R a trade against the published study outputs, pinned here too),
// and the candle data-quality checks. Offline: reads only committed files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EDGES, EDGE_IDS, edgeById, fnv1a, poolOf, monthOf, EVAL_FROM } from '../academy/edges.mjs';
import { computeVersion } from '../academy/gen/study.mjs';
import { checkBars, closedOnly, summarize, isOpen, barExpected, isAligned, goodFriday, usEuDstMismatch, euSummer, nyClock, THRESHOLDS, CALENDARS } from '../academy/quality.mjs';
import { SYSTEMS } from '../council/decay.mjs';
import { histOffsetH } from '../council/histdata.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const { SYM } = createRequire(import.meta.url)('../api/_oanda.js');
const T = (s) => Date.parse(s) / 1000;
const SEVEN = ['replica', 'mosha-bo', 'gtrend', 'gtl', 'geg', 'gmp', 'nq-open'];
const DATA = Object.fromEntries(SEVEN.map((id) => [id, { cands: J(`academy/data/cand-${id}.json`), outs: J(`academy/data/out-${id}.json`) }]));
const UNFILLED = new Set(['missed', 'expired', 'cancelled']);
const round3 = (x) => +x.toFixed(3);
// the clock audit's weekly record (research/edge/histdata-clock): a week is verified when it shows the offset the converter uses
const AUDIT = J('research/edge/histdata-clock/result.json'), AUDIT_SYM = { xau: 'XAUUSD', nas100: 'NSXUSD' }, W0 = T('2018-01-01T00:00:00Z');
const weekVerified = (market, t) => { const i = Math.floor((t + 86400 - W0) / (7 * 86400)), c = AUDIT.symbols[AUDIT_SYM[market]].B.read[i], d = new Date((W0 + i * 7 * 86400 + 2 * 86400) * 1000);
  return c != null && +c === histOffsetH(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };

// ── registry ──
test('registry: exactly the seven live Meridian systems, named as council/decay.mjs names them', () => {
  assert.deepEqual(EDGE_IDS, SEVEN);
  for (const e of EDGES) {
    const sys = SYSTEMS.find((s) => s.id === e.id);
    assert.ok(sys && !sys.shadow && sys.desk === 'Meridian', `${e.id} is a live Meridian system`);
    assert.equal(e.name, sys.name);
    assert.equal(edgeById(e.id), e);
  }
  assert.equal(edgeById('nope'), null);
});
test('registry: every edge has a market the candle proxy serves, timeframes, a plain-English rule, sources, a cost and a study', () => {
  const TFS = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);
  for (const e of EDGES) {
    assert.ok(SYM[e.market], `${e.id}: ${e.market} is a /md/bars symbol`);
    assert.ok(TFS.has(e.signalTf)); assert.ok(e.contextTfs.length >= 3 && e.contextTfs.every((t) => TFS.has(t)));
    for (const k of ['trigger', 'filters', 'entry', 'stop', 'exit']) assert.ok(typeof e.definition[k] === 'string' && e.definition[k].length > 20, `${e.id}: definition.${k}`);
    assert.ok(['both', 'long'].includes(e.sides));
    assert.ok(e.costPerRoundTrip > 0 && typeof e.costUnit === 'string');
    assert.ok(['ok', 'partial'].includes(e.status)); if (e.status === 'partial') assert.ok(e.why);
    assert.ok(e.ruleSource.length && e.ruleSource.every((f) => fs.existsSync(path.join(ROOT, f))), `${e.id}: rule source files exist`);
    assert.ok(fs.existsSync(path.join(ROOT, e.study.path)) && e.study.n > 0 && Number.isFinite(e.study.netR));
  }
  assert.equal(edgeById('nq-open').market, 'nas100'); assert.ok(EDGES.filter((e) => e.id !== 'nq-open').every((e) => e.market === 'xau'));
});
test('registry: version is the short sha256 of the rule source files (a changed rule file means: regenerate and re-pin)', () => {
  for (const e of EDGES) { assert.match(e.version, /^[0-9a-f]{12}$/); assert.equal(e.version, computeVersion(e.ruleSource), `${e.id}: run node academy/gen/run.mjs --versions`); }
});
test('pools: fnv1a is 32-bit FNV-1a and a whole UTC month is exam when fnv1a(edge:YYYY-MM) % 10 < 3', () => {
  assert.equal(fnv1a(''), 0x811c9dc5); assert.equal(fnv1a('a'), 0xe40c292c); assert.equal(fnv1a('foobar'), 0xbf9cf968);
  assert.equal(monthOf(T('2024-03-31T23:59:59Z')), '2024-03'); assert.equal(monthOf(T('2024-04-01T00:00:00Z')), '2024-04');
  for (const id of SEVEN) for (let y = 2018; y <= 2026; y++) for (let m = 0; m < 12; m++) {
    const a = Date.UTC(y, m, 1) / 1000, b = Date.UTC(y, m + 1, 1) / 1000 - 1, ym = `${y}-${String(m + 1).padStart(2, '0')}`;
    const want = fnv1a(`${id}:${ym}`) % 10 < 3 ? 'exam' : 'train';
    assert.equal(poolOf(id, a), want); assert.equal(poolOf(id, b), want); assert.equal(poolOf(edgeById(id), a + 86400), want);
  }
  const share = SEVEN.map((id) => { let ex = 0; for (let k = 0; k < 106; k++) if (poolOf(id, Date.UTC(2018, k, 15) / 1000) === 'exam') ex++; return ex / 106; });
  assert.ok(share.every((s) => s > 0.15 && s < 0.45), 'about three months in ten are exam: ' + share.map((s) => s.toFixed(2)).join(' '));
});

// ── candidates ──
const CAND_KEYS = ['id', 'edge', 'market', 't', 'side', 'entry', 'stop', 'target', 'tf', 'rule', 'edgeVersion', 'pool'];
const OUTCOME_KEYS = ['R', 'netR', 'exitT', 'reason', 'mfeR', 'maeR', 'unitR', 'fillT', 'add', 'outcome', 'result', 'pnl', 'win', 'filled'];
test('candidates: the contract shape, sorted by t, unique ids, and never an outcome field', () => {
  for (const id of SEVEN) {
    const e = edgeById(id), { cands } = DATA[id], ids = new Set();
    assert.ok(cands.length > 0, id);
    cands.forEach((c, i) => {
      assert.deepEqual(Object.keys(c), CAND_KEYS, `${c.id}: keys`);
      assert.equal(c.edge, id); assert.equal(c.market, e.market); assert.equal(c.tf, e.signalTf); assert.equal(c.edgeVersion, e.version);
      assert.ok(c.id.startsWith(id + '-') && !ids.has(c.id), `${c.id}: unique id`); ids.add(c.id);
      assert.ok(Number.isInteger(c.t) && c.t >= T('2018-01-01T00:00:00Z') && c.t < T('2026-11-01T00:00:00Z'), `${c.id}: t`);
      if (i) assert.ok(c.t >= cands[i - 1].t, `${c.id}: sorted by t`);
      assert.ok(c.side === 'buy' || c.side === 'sell'); if (e.sides === 'long') assert.equal(c.side, 'buy');
      assert.ok(Number.isFinite(c.entry) && Number.isFinite(c.stop) && c.entry > 0 && c.stop > 0);
      assert.ok(c.side === 'buy' ? c.stop < c.entry : c.stop > c.entry, `${c.id}: the stop is on the losing side of the entry`);
      if (c.target == null) { assert.equal(c.target, null); assert.ok(typeof c.rule.exit === 'string' && c.rule.exit.length > 10, `${c.id}: no target, so the exit rule is in rule.exit`); }
      else assert.ok(c.side === 'buy' ? c.target > c.entry : c.target < c.entry, `${c.id}: the target is on the winning side`);
      assert.ok(c.rule && typeof c.rule === 'object' && ['market', 'limit'].includes(c.rule.order) && c.rule.risk > 0);
      assert.ok(Math.abs(Math.abs(c.entry - c.stop) - c.rule.risk) <= 0.011, `${c.id}: rule.risk is the entry-stop distance`);
      for (const k of OUTCOME_KEYS) { assert.ok(!(k in c), `${c.id}: no ${k}`); assert.ok(!(k in c.rule), `${c.id}: no rule.${k}`); }
      if ('exit' in c.rule) assert.equal(typeof c.rule.exit, 'string', `${c.id}: rule.exit is the exit RULE, not a price`);
      assert.equal(!!c.rule.pre2020, c.t < EVAL_FROM, `${c.id}: pre2020 marks candidates before 2020`);
      if ('clockShift' in c.rule) assert.equal(c.rule.clockShift, true);
      assert.equal(!!c.rule.clockShift, !weekVerified(e.market, c.t), `${c.id}: clockShift exactly when the week of t was not verified against the second feed`);
    });
    assert.equal(e.signalTf === '1d' ? cands.every((c) => !('session' in c.rule)) : cands.every((c) => ['asia', 'london', 'ny', 'closed'].includes(c.rule.session)), true, `${id}: session tag on intraday edges`);
  }
  assert.ok(DATA.gtrend.cands.every((c) => c.target === null && c.rule.breakoutN === 20 && c.rule.atr14 > 0), 'gold trend: trailing exit, breakout and ATR tags');
});
test('candidates: the pool follows poolOf and both pools are populated for every edge', () => {
  for (const id of SEVEN) {
    const { cands } = DATA[id];
    for (const c of cands) assert.equal(c.pool, poolOf(id, c.t), c.id);
    const tr = cands.filter((c) => c.pool === 'train').length, ex = cands.length - tr;
    assert.ok(tr > 0 && ex > 0, `${id}: train ${tr}, exam ${ex}`);
    const since = cands.filter((c) => c.t >= EVAL_FROM && !c.rule.clockShift);
    assert.ok(since.some((c) => c.pool === 'train') && since.some((c) => c.pool === 'exam'), `${id}: both pools also inside the 2020+ evaluation window, off the unverified weeks`);
  }
});

// ── outcomes ──
test('outcomes: one per candidate and nothing else, in the contract shape', () => {
  const REASONS = new Set(['stop', 'breakeven', 'trail', 'target', 'time', 'end', 'missed', 'expired', 'cancelled']);
  for (const id of SEVEN) {
    const e = edgeById(id), { cands, outs } = DATA[id];
    assert.deepEqual(Object.keys(outs), cands.map((c) => c.id), `${id}: outcome ids = candidate ids, same order`);
    for (const c of cands) {
      const o = outs[c.id];
      assert.equal(o.id, c.id);
      for (const k of ['R', 'netR', 'exitT', 'exit', 'reason', 'mfeR', 'maeR']) assert.ok(k in o, `${c.id}: ${k}`);
      assert.ok(REASONS.has(o.reason), `${c.id}: reason ${o.reason}`);
      assert.ok(Number.isFinite(o.R) && Number.isFinite(o.netR) && Number.isInteger(o.exitT) && o.exitT >= c.t, `${c.id}: numbers`);
      if (UNFILLED.has(o.reason)) { assert.equal(c.rule.order, 'limit'); assert.deepEqual([o.R, o.netR, o.exit, o.mfeR, o.maeR], [0, 0, null, null, null], `${c.id}: an unfilled order has no result`); continue; }
      assert.ok(o.netR < o.R, `${c.id}: net is gross minus a cost`);
      assert.ok(o.exit > 0 && o.mfeR >= 0 && o.maeR >= 0);
      const unit = o.unitR ?? o.R, risk = Math.abs(c.entry - c.stop);
      assert.ok(Math.abs((o.exit - c.entry) * (c.side === 'buy' ? 1 : -1) / risk - unit) <= 0.02 + 0.03 / risk, `${c.id}: the exit price gives the first unit's R`);
      assert.ok(o.mfeR >= unit - 0.011 && o.maeR >= -unit - 0.011, `${c.id}: excursions bound the result`);
      if (o.reason === 'stop') assert.ok(unit <= -0.99, `${c.id}: a plain stop loses the full risk`);
      if (o.reason === 'breakeven') assert.equal(unit, 0);
      if (o.reason === 'target') assert.ok(Math.abs(unit - 10) < 0.011, `${c.id}: the cap is 10R`);
      if ('fillT' in o) { assert.equal(c.rule.order, 'limit'); assert.ok(o.fillT >= c.t && o.fillT <= o.exitT); }
      if (c.rule.order === 'limit') assert.ok('fillT' in o, `${c.id}: a filled limit order says when`);
      // a one-unit trade costs costPerRoundTrip / risk in R; adds and sized trades cost more or less, never nothing
      if (!('unitR' in o)) assert.ok(Math.abs((o.R - o.netR) - e.costPerRoundTrip / risk) <= 0.002 + 0.03 * e.costPerRoundTrip / (risk * risk), `${c.id}: cost ${o.R - o.netR} vs ${e.costPerRoundTrip / risk}`);
    }
  }
});

// ── the proof: these are the studies' trades ──
// Pinned from the published study outputs (research/edge/*): filled trades and net R a trade of the live variant.
const PUBLISHED = {
  replica: { n: 394, netR: 0.462, orders: 394 }, 'mosha-bo': { n: 64, netR: 0.531, orders: 72 }, gtrend: { n: 41, netR: 1.609, orders: 41 }, gtl: { n: 315, netR: 0.159, orders: 315 },
  geg: { n: 175, netR: 0.304, orders: 233 }, gmp: { n: 1004, netR: 0.043, orders: 1004 }, 'nq-open': { n: 724, netR: 0.115, orders: 724 },
};
const statOf = (id) => {
  const { cands, outs } = DATA[id], f = cands.map((c) => outs[c.id]).filter((o) => !UNFILLED.has(o.reason));
  return { orders: cands.length, n: f.length, netR: round3(f.reduce((a, o) => a + o.netR, 0) / f.length), grossR: round3(f.reduce((a, o) => a + o.R, 0) / f.length), sum: f.reduce((a, o) => a + o.netR, 0) };
};
test('published numbers: n and net R a trade of every edge equal the study output for its live variant', () => {
  const pub = {
    replica: J('research/edge/gold-systems/replica.json').variants.live, 'mosha-bo': J('research/edge/gold-systems/mosha.json').variants.live,
    gtrend: J('research/edge/gold-systems/daily.json').variants.trend_N20_add, gtl: J('research/edge/gold-systems/daily.json').variants.tl_live, geg: J('research/edge/gold-systems/daily.json').variants.eg_live,
  };
  for (const id of SEVEN) {
    const s = statOf(id), e = edgeById(id), p = PUBLISHED[id];
    assert.deepEqual({ n: s.n, netR: s.netR, orders: s.orders }, p, `${id}: pinned`);
    assert.deepEqual({ n: e.study.n, netR: e.study.netR }, { n: p.n, netR: p.netR }, `${id}: the registry quotes the same numbers`);
    if (pub[id]) {   // gold-systems: report() of core.mjs = { all: net stats, gross: gross stats }
      assert.deepEqual({ n: pub[id].all.n, exp: pub[id].all.exp }, { n: s.n, exp: s.netR }, `${id}: study net`);
      assert.equal(pub[id].gross.exp, s.grossR, `${id}: study gross`); assert.equal(e.study.grossR, s.grossR);
      assert.ok(Math.abs(pub[id].all.R - s.sum) < 0.02, `${id}: total net R ${s.sum} vs ${pub[id].all.R}`);
    }
  }
  const nq = J('research/edge/nq-open-oos/result.json').histdata.all;   // the study's HistData run (its main run is OANDA)
  assert.deepEqual({ n: nq.n, avg: nq.avg }, { n: statOf('nq-open').n, avg: statOf('nq-open').netR }); assert.ok(Math.abs(nq.R - statOf('nq-open').sum) < 0.02);
});
test('published numbers: gold momentum pullback matches the robustness audit trade by trade', () => {
  const g = J('research/edge/robustness/out/gmp.json'), { cands, outs } = DATA.gmp;
  assert.deepEqual({ n: g.live.all.n, exp: g.live.all.exp }, { n: cands.length, exp: statOf('gmp').netR });
  assert.equal(g.live.gross.exp, statOf('gmp').grossR);
  assert.equal(g.trades.length, cands.length);
  g.trades.forEach((x, i) => { const c = cands[i], o = outs[c.id];
    assert.equal(c.t, x.t); assert.equal(c.side, x.side > 0 ? 'buy' : 'sell'); assert.ok(Math.abs(o.netR - x.R) < 1e-4 && Math.abs(o.R - x.gross) < 1e-4, c.id); });
});
test('meta.json agrees with the files', () => {
  const m = J('academy/data/meta.json');
  assert.deepEqual(Object.keys(m.edges), SEVEN); assert.match(m.candles.ref, /^[0-9a-f]{40}$/); assert.equal(m.evalFrom, EVAL_FROM);
  for (const id of SEVEN) {
    const x = m.edges[id], { cands } = DATA[id], s = statOf(id);
    assert.deepEqual([x.version, x.candidates, x.filled, x.from, x.to], [edgeById(id).version, cands.length, s.n, cands[0].t, cands.at(-1).t], id);
    assert.deepEqual([x.train, x.exam, x.pre2020, x.clockShift], [cands.filter((c) => c.pool === 'train').length, cands.filter((c) => c.pool === 'exam').length, cands.filter((c) => c.rule.pre2020).length, cands.filter((c) => c.rule.clockShift).length], id);
    assert.deepEqual(x.reproduced, { n: s.n, netR: s.netR, sumNetR: +s.sum.toFixed(2) }, id); assert.deepEqual([x.study.n, x.study.netR], [s.n, s.netR]);
  }
});
test('academy/data holds only the generated JSON, small enough to serve, and no candles', () => {
  const files = fs.readdirSync(path.join(ROOT, 'academy/data')).sort();
  assert.deepEqual(files, [...SEVEN.flatMap((id) => [`cand-${id}.json`, `out-${id}.json`, `feat-${id}.json`]), 'calendar.json', 'clock-check.json', 'eval.json', 'exam-ledger.json', 'meta.json', 'quality.json', 'research.json'].sort());
  for (const f of files) assert.ok(fs.statSync(path.join(ROOT, 'academy/data', f)).size < 600e3, `${f} stays under 600 kB`);
});

// ── data quality ──
// a clean hourly series on the spot-gold calendar: every expected bar from `from` to `to`, small deterministic candles
function series(from, to, cal = 'xau', tf = 3600) {
  const out = []; let px = 2300, seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let t = from; t < to; t += tf) { if (!barExpected(cal, t, tf)) continue; const o = px, c = o + (rnd() - 0.5) * 2, h = Math.max(o, c) + 0.2 + rnd(), l = Math.min(o, c) - 0.2 - rnd(); out.push({ time: t, open: o, high: h, low: l, close: c }); px = c; }
  return out;
}
const FROM = T('2024-06-02T22:00:00Z'), TO = T('2024-06-14T21:00:00Z');   // Sunday 18:00 New York to Friday 17:00, two weeks
const clean = () => series(FROM, TO), endOf = (b) => b.at(-1).time + 3600;
const types = (r) => Object.keys(r.counts).sort();

test('quality: the session calendars (weekly close, daily break, holidays, daylight saving)', () => {
  assert.equal(isOpen('xau', T('2024-06-05T15:00:00Z')), true);     // Wednesday 11:00 New York
  assert.equal(isOpen('xau', T('2024-06-05T21:30:00Z')), false);    // 17:30 New York: the daily break (summer)
  assert.equal(isOpen('xau', T('2024-01-10T21:30:00Z')), true);     // 16:30 New York in winter: open
  assert.equal(isOpen('xau', T('2024-01-10T22:30:00Z')), false);    // 17:30 New York in winter: the break
  assert.equal(isOpen('xau', T('2024-06-07T21:00:00Z')), false);    // Friday 17:00: the week is over
  assert.equal(isOpen('xau', T('2024-06-08T12:00:00Z')), false);    // Saturday
  assert.equal(isOpen('xau', T('2024-06-09T21:59:00Z')), false); assert.equal(isOpen('xau', T('2024-06-09T22:00:00Z')), true);   // Sunday 18:00 New York
  assert.equal(isOpen('xau', T('2024-12-25T15:00:00Z')), false); assert.equal(isOpen('xau', T('2024-12-25T23:30:00Z')), true);   // Christmas, back at 18:00
  assert.equal(isOpen('xau', T('2025-01-01T10:00:00Z')), false);
  assert.equal(goodFriday(2024), '03-29'); assert.equal(goodFriday(2025), '04-18'); assert.equal(goodFriday(2026), '04-03');
  assert.equal(isOpen('xau', T('2024-03-29T14:00:00Z')), false);    // Good Friday
  assert.equal(isOpen('nas100-histdata', T('2024-06-05T20:10:00Z')), true); assert.equal(isOpen('nas100-histdata', T('2024-06-05T20:20:00Z')), false);   // shuts 16:15
  assert.equal(barExpected('nas100-histdata', T('2024-06-05T20:00:00Z'), 3600), true); assert.equal(barExpected('nas100-histdata', T('2024-06-05T21:00:00Z'), 3600), false);
  assert.equal(isOpen('ny-open-window', T('2024-06-05T13:30:00Z')), true); assert.equal(isOpen('ny-open-window', T('2024-06-05T15:00:00Z')), false); assert.equal(isOpen('ny-open-window', T('2024-06-08T14:00:00Z')), false);
  assert.equal(isOpen('always', T('2024-06-08T12:00:00Z')), true);
  assert.throws(() => isOpen('mars', 0), /unknown calendar/);
  assert.deepEqual([nyClock(T('2024-06-05T15:30:00Z')).min, nyClock(T('2024-01-10T15:30:00Z')).min, nyClock(T('2024-06-05T15:30:00Z')).dow], [690, 630, 3]);
  assert.ok(isAligned(T('2024-06-05T15:00:00Z'), 3600) && !isAligned(T('2024-06-05T15:07:00Z'), 3600) && !isAligned(T('2024-06-05T15:00:00Z') + 0.5, 3600));
  assert.ok(isAligned(T('2024-06-05T21:00:00Z'), 86400) && isAligned(T('2024-01-10T22:00:00Z'), 86400) && !isAligned(T('2024-06-05T13:00:00Z'), 86400), 'daily candles may start at 17:00 New York');
});
test('quality: a complete, clean series is certified', () => {
  const b = clean(), r = checkBars(b, { tfSec: 3600, calendar: 'xau', now: endOf(b) });
  assert.equal(b.length, 2 * 5 * 23);
  assert.deepEqual([r.status, r.coverage, r.issues.length, r.missing, r.bars, r.expected], ['certified', 1, 0, 0, 230, 230]);
  assert.deepEqual(r.span, { from: FROM, to: b.at(-1).time });
  assert.equal(checkBars([], { tfSec: 3600 }).status, 'unreliable');
  assert.throws(() => checkBars(b, {}), /tfSec/);
});
test('quality: a planted gap is found, counted against coverage, and enough of it makes the series unreliable', () => {
  const b = clean(), cut = b.filter((x) => !(x.time >= T('2024-06-04T10:00:00Z') && x.time < T('2024-06-04T13:00:00Z')));
  const r = checkBars(cut, { tfSec: 3600, calendar: 'xau', now: endOf(b) }), g = r.issues.find((x) => x.type === 'gap');
  assert.deepEqual(types(r), ['gap']);
  assert.deepEqual([g.time, g.to, g.missing, r.missing, r.status], [T('2024-06-04T10:00:00Z'), T('2024-06-04T13:00:00Z'), 3, 3, 'usable']);
  assert.equal(r.coverage, +(227 / 230).toFixed(5));
  // the weekend and the daily break are not gaps
  assert.equal(checkBars(b, { tfSec: 3600, calendar: 'xau', now: endOf(b) }).counts.gap, undefined);
  // on a 24 / 7 calendar the same series is full of holes
  assert.ok(checkBars(b, { tfSec: 3600, calendar: 'always', now: endOf(b) }).missing > 50);
  const holed = b.filter((x, i) => i % 10 !== 3), bad = checkBars(holed, { tfSec: 3600, calendar: 'xau', now: endOf(b) });
  assert.ok(bad.coverage < THRESHOLDS.USABLE_COVERAGE); assert.equal(bad.status, 'unreliable');
  const day = b.filter((x) => !(x.time >= T('2024-06-04T22:00:00Z') && x.time < T('2024-06-06T03:00:00Z'))), one = checkBars(day, { tfSec: 3600, calendar: 'xau', now: endOf(b) });
  assert.ok(one.maxGapSec > THRESHOLDS.CERT_MAX_GAP_SEC); assert.notEqual(one.status, 'certified');
});
test('quality: a planted duplicate, a bar out of order and a misaligned bar are errors', () => {
  const b = clean();
  const dup = b.slice(0, 50).concat([{ ...b[49] }], b.slice(50)), r1 = checkBars(dup, { tfSec: 3600, calendar: 'xau', now: endOf(b) });
  assert.deepEqual([types(r1), r1.issues[0].time, r1.status], [['duplicate'], b[49].time, 'unreliable']);
  const swapped = b.slice(); [swapped[20], swapped[21]] = [swapped[21], swapped[20]];
  const r2 = checkBars(swapped, { tfSec: 3600, calendar: 'xau', now: endOf(b) });
  assert.ok(r2.counts['out-of-order'] === 1 && r2.status === 'unreliable');
  const off = b.map((x, i) => (i === 30 ? { ...x, time: x.time + 420 } : x)), r3 = checkBars(off, { tfSec: 3600, calendar: 'xau', now: endOf(b) });
  assert.ok(r3.counts.misaligned === 1 && r3.status === 'unreliable');
});
test('quality: a future-stamped bar is an error; an unfinished last bar is flagged and dropped by closedOnly', () => {
  const b = clean(), now = b[100].time + 3600;
  const r = checkBars(b.slice(0, 101).concat([{ ...b[150] }]), { tfSec: 3600, calendar: 'xau', now });
  assert.ok(r.counts.future === 1 && r.issues.some((x) => x.type === 'future' && x.time === b[150].time)); assert.equal(r.status, 'unreliable');
  // the clock reads 20 minutes into the last hourly bar
  const part = b.slice(0, 101), r2 = checkBars(part, { tfSec: 3600, calendar: 'xau', now: b[100].time + 1200 });
  assert.deepEqual([types(r2), r2.status], [['incomplete'], 'usable']);
  assert.equal(closedOnly(part, 3600, b[100].time + 1200).length, 100);
  assert.equal(closedOnly(part, 3600, b[100].time + 3600).length, 101);
  assert.equal(closedOnly(part, 3600, b[100].time + 3600 - 60).length, 101, 'a bar within 5% of its close counts as closed');
  // a 4-hour series whose last bar has one hour to run
  const h4 = series(T('2024-06-03T00:00:00Z'), T('2024-06-06T00:00:00Z'), 'always', 14400), r4 = checkBars(h4, { tfSec: 14400, calendar: 'always', now: h4.at(-1).time + 3 * 3600 });
  assert.equal(r4.counts.incomplete, 1); assert.equal(closedOnly(h4, 14400, h4.at(-1).time + 3 * 3600).length, h4.length - 1);
});
test('quality: broken candles, flat candles, outlier spikes and jumps, bars outside the session', () => {
  const b = clean(), now = endOf(b), run = (x) => checkBars(x, { tfSec: 3600, calendar: 'xau', now });
  const neg = run(b.map((x, i) => (i === 60 ? { ...x, high: x.low - 1 } : x)));
  assert.ok(neg.counts['bad-ohlc'] === 1 && neg.status === 'unreliable', 'a negative range');
  assert.equal(run(b.map((x, i) => (i === 60 ? { ...x, close: NaN } : x))).counts['bad-ohlc'], 1);
  assert.equal(run(b.map((x, i) => (i === 60 ? { ...x, open: x.high + 5 } : x))).counts['bad-ohlc'], 1, 'an open outside the range');
  const flat = run(b.map((x, i) => (i === 60 ? { ...x, open: x.close, high: x.close, low: x.close } : x)));
  assert.deepEqual([flat.counts.flat, flat.status], [1, 'usable'], 'one zero-range candle in 230 is above the certified allowance');
  const spike = run(b.map((x, i) => (i === 120 ? { ...x, high: x.high + 80 } : x)));
  assert.equal(spike.counts.spike, 1); assert.equal(spike.issues.find((x) => x.type === 'spike').time, b[120].time); assert.equal(spike.status, 'unreliable', '1 in 230 is above 1 in 1,000');
  const jump = run(b.map((x, i) => (i >= 120 ? { time: x.time, open: x.open + 60, high: x.high + 60, low: x.low + 60, close: x.close + 60 } : x)));
  assert.equal(jump.counts.jump, 1); assert.equal(jump.counts.spike, undefined);
  const sat = run(b.concat([{ ...b[0], time: T('2024-06-15T12:00:00Z') }]));
  assert.equal(sat.counts['off-session'], 1); assert.notEqual(sat.status, 'certified');
});
test('quality: session alignment finds a week stamped one hour early, and knows when New York and Europe disagree', () => {
  const b = clean(), wk2 = T('2024-06-09T00:00:00Z');
  const early = b.map((x) => (x.time >= wk2 ? { ...x, time: x.time - 3600 } : x)), r = checkBars(early, { tfSec: 3600, calendar: 'xau', now: endOf(b) });
  const cs = r.issues.filter((x) => x.type === 'clock-shift');
  assert.equal(cs.length, 1); assert.deepEqual([cs[0].shiftSec, cs[0].days, new Date(cs[0].time * 1000).toISOString().slice(0, 10)], [-3600, 4, '2024-06-10']);
  assert.notEqual(r.status, 'certified');
  const late = b.map((x) => (x.time >= wk2 ? { ...x, time: x.time + 3600 } : x)), cl = checkBars(late, { tfSec: 3600, calendar: 'xau', now: endOf(b) + 3600 }).issues.filter((x) => x.type === 'clock-shift');
  assert.deepEqual([cl.length, cl[0].shiftSec], [1, 3600]);
  assert.equal(checkBars(b, { tfSec: 3600, calendar: 'xau', now: endOf(b) }).counts['clock-shift'], undefined);
  // 2024: New York changes 10 March and 3 November, Europe 31 March and 27 October
  assert.deepEqual(['2024-03-08', '2024-03-12', '2024-03-28', '2024-04-02', '2024-10-25', '2024-10-29', '2024-11-05', '2024-07-01', '2024-01-15'].map((d) => usEuDstMismatch(T(d + 'T15:00:00Z'))), [false, true, true, false, false, true, false, false, false]);
  assert.ok(euSummer(T('2024-03-31T01:00:00Z')) && !euSummer(T('2024-03-31T00:59:59Z')) && !euSummer(T('2024-10-27T01:00:00Z')));
});
test('quality.json: both markets reported with source, span, status and issue counts; the clock finding is recorded', () => {
  const q = J('academy/data/quality.json');
  assert.deepEqual(q.thresholds, THRESHOLDS);
  assert.deepEqual(Object.keys(q.markets), ['xau', 'nas100']);
  for (const [k, m] of Object.entries(q.markets)) {
    assert.ok(SYM[k]); assert.match(m.source, /HistData/); assert.equal(m.tf, '1h');
    assert.ok(['certified', 'usable', 'unreliable'].includes(m.status)); assert.ok(m.coverage > 0.9 && m.coverage <= 1);
    assert.ok(m.span.from >= T('2018-01-01T00:00:00Z') && m.span.to > T('2026-10-01T00:00:00Z') && m.span.to < T('2026-11-01T00:00:00Z'));
    assert.ok(m.bars > 50000 && m.expected >= m.bars - (m.counts['off-session'] || 0) && typeof m.counts === 'object');
    assert.deepEqual(Object.keys(m.byYear), ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']);
    assert.equal(m.byYear['2023'].status, 'unreliable', `${k}: HistData 2023 is full of holes and says so`);
    assert.deepEqual(m.clockShift, [], `${k}: on the corrected clock the session check finds no shifted week (it found 20 or more before 10 Nov 2026)`); assert.equal(m.counts['clock-shift'], undefined);
    assert.match(m.source, /council\/histdata\.mjs/);
    assert.ok(m.usedBy.every((id) => edgeById(id).market === k));
    for (const c of DATA[m.usedBy[0]].cands) assert.ok(c.t >= m.span.from && c.t <= m.span.to + 2 * 86400);
  }
  assert.equal(q.markets.xau.status, 'usable'); assert.equal(q.markets.nas100.status, 'usable');
  assert.equal(q.markets.nas100.calendar, CALENDARS['nas100-histdata'].name);
  assert.ok(q.markets.nas100.openWindow.counts.duplicate > 0 && q.markets.nas100.openWindow.status === 'unreliable', 'the raw NSX minutes repeat labels and the report says so');
  assert.match(q.clock.finding, /New York time in 2018/); assert.match(q.clock.finding, /one hour EARLY/); assert.equal(q.clock.converter, 'council/histdata.mjs');
  assert.deepEqual(q.clock.evidence.detected, { xau: [], nas100: [] }); assert.deepEqual(q.clock.evidence.weeksDetected, { xau: 0, nas100: 0 });
  // every decisive week of the audit agrees with the converter; the rest are the unverified weeks, and only those are flagged
  for (const k of ['xau', 'nas100']) { const w = q.clock.evidence.oandaWeeks[k], B = AUDIT.symbols[AUDIT_SYM[k]].B;
    assert.deepEqual([w.weeks, w.readable, w.decisive, w.agreeWithConverter], [B.weeks, B.readable, B.decisive, B.decisive], k);
    assert.equal(q.clock.unverifiedWeeks[k].length, B.weeks - B.decisive, k); assert.ok(q.clock.unverifiedWeeks[k].length < 0.06 * B.weeks); }
  assert.deepEqual(q.clock.evidence.oandaWeeks.xau.decisive, 437); assert.deepEqual(q.clock.evidence.oandaWeeks.nas100.decisive, 436);
  assert.deepEqual(q.clock.evidence.uncertifiedYears, { xau: [2023], nas100: [2018, 2020, 2023, 2024] });
  assert.match(q.clock.flag, /could NOT be verified/);
  assert.deepEqual(q.clock.flagged, Object.fromEntries(SEVEN.map((id) => [id, DATA[id].cands.filter((c) => c.rule.clockShift).length])));
  assert.deepEqual(q.clock.flagged, { replica: 18, 'mosha-bo': 4, gtrend: 3, gtl: 16, geg: 10, gmp: 34, 'nq-open': 16 });
  assert.ok(SEVEN.every((id) => q.clock.flagged[id] > 0 && q.clock.flagged[id] < 0.25 * DATA[id].cands.length));
  // the independent cross-check against OANDA candles (academy/gen/clock-check.mjs): the clocks agree in every week
  const cc = J('academy/data/clock-check.json');
  assert.ok(cc.weeks.length >= 24 && cc.weeks.some((w) => w.week.startsWith('2018') && w.mismatchWeek) && cc.weeks.filter((w) => w.mismatchWeek && +w.week.slice(0, 4) >= 2019).length >= 16);
  for (const w of cc.weeks) {
    assert.equal(w.mismatchWeek, usEuDstMismatch(T(w.week + 'T15:00:00Z') + 86400), w.week);
    assert.equal(w.studyClockEarlySec, 0, `${w.week}: ${JSON.stringify(w.meanAbsDiff)}`);
    const d = w.meanAbsDiff;
    assert.ok(d['0h'] < 0.6 && Math.min(d['-1h'], d['+1h']) > 2.5 * d['0h'], `${w.week}: a clear match, not a coin toss`);
  }
  assert.deepEqual([q.clock.crossCheck.weeks, q.clock.crossCheck.weeksOff, q.clock.crossCheck.everyWeekAgrees], [cc.weeks.length, 0, true]);
  for (const d of q.clock.evidence.repeatedHourDays) { const dt = new Date(d + 'T12:00:00Z'); assert.ok(dt.getUTCMonth() === 9 && dt.getUTCDay() === 0 && dt.getUTCDate() >= 25, `${d} is the last Sunday of October`); }
});
test('summarize: the per-year verdicts and the worst gaps of a long series', () => {
  const b = series(T('2023-12-17T23:00:00Z'), T('2024-01-12T22:00:00Z')).filter((x) => !(x.time >= T('2024-01-09T05:00:00Z') && x.time < T('2024-01-09T09:00:00Z')));
  const s = summarize(b, { tfSec: 3600, calendar: 'xau', now: endOf(b) });
  assert.deepEqual(Object.keys(s.byYear), ['2023', '2024']);
  assert.deepEqual(s.worstGaps, [{ from: T('2024-01-09T05:00:00Z'), to: T('2024-01-09T09:00:00Z'), missing: 4 }]);
  assert.equal(s.byYear['2023'].status, 'certified', 'Christmas is not a gap'); assert.equal(s.byYear['2024'].missing, 4); assert.deepEqual(s.clockShift, []);
});

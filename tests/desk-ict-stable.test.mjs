// ICT desk replay: booked history is stable from run to run (11 Nov 2026).
// The cause this pins: the futures feed does not return the same candles for the same past hours on every run. Its first candle
// moves (so the back-fill boundary moves and the scale measured after it changes), and single candles differ. A replay that
// rebuilds everything each day then "corrects" months-old results (8 -> 11 Nov 2026: 26 corrected, 11 removed, 8 added, about
// +23.6R, no rule change). The fix: a booked record that closed more than SETTLE before the end of the previous run is carried
// from the previous file as booked; a rebuild is deliberate and is written to the correction log.
// Offline: synthetic candles, a fake feed whose window and back-fill ratio differ between runs. Not named tests/ict-*.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const T = await import('../ict/tracker.mjs'), R = await import('../ict/replay.mjs');

// the deterministic path of tests/desk-ict-trace.test.mjs and the stop guard
const noise = (t, s) => { let x = Math.imul((t / 60) ^ (s * 0x9e3779b1), 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return (x / 0xffffffff) * 2 - 1; };
const price = (t) => 10000 + 500 * Math.sin((2 * Math.PI * t) / (86400 * 23)) + 180 * Math.sin((2 * Math.PI * t) / (86400 * 3.1)) + 70 * Math.sin((2 * Math.PI * t) / (3600 * 9.3)) + 30 * noise(t, 1);
function synthetic(sec, from, n) { const out = []; for (let t = from; out.length < n; t += sec) { if (new Date(t * 1000).getUTCDay() === 6) continue;
  const o = price(t), c = price(t + sec); out.push({ time: t, open: +o.toFixed(2), high: +(Math.max(o, c) + Math.abs(noise(t, 2)) * 12 * Math.sqrt(sec / 3600)).toFixed(2), low: +(Math.min(o, c) - Math.abs(noise(t, 3)) * 12 * Math.sqrt(sec / 3600)).toFixed(2), close: +c.toFixed(2) }); } return out; }

const DAY = 86400, t0 = Date.UTC(2024, 0, 1) / 1000, FROM = t0 + 15 * DAY, STABLE = t0 + 90 * DAY, AT = t0 + 125 * DAY;
const SPOT5 = synthetic(300, t0, 34000), SPOTH = T.agg(SPOT5, 3600);   // the back-fill source ("spot"): the same file on every run
const D1 = synthetic(86400, t0 - 200 * DAY, 400).map((b) => ({ ...b, open: b.open * 1.03, high: b.high * 1.03, low: b.low * 1.03, close: b.close * 1.03 }));
// the "futures feed": spot x 1.03 with a noisy basis. Before STABLE the basis noise depends on the run (`seed`), i.e. the feed
// returns slightly different thin candles for old hours on different days; from STABLE on it is the same on every run.
const fut = (b, seed) => { const k = 1.03 * (1 + 0.002 * noise(Math.floor(b.time / 3600) * 3600, b.time < STABLE ? seed : 7)); return { time: b.time, open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k, volume: 1 }; };
// one run's feed: its continuous history starts at `start` (the reachable window), `stray` adds single prints before it
function feed({ start, seed, at, stray = [], cov = null }) {
  return async (M) => {
    let h1 = SPOTH.filter((b) => b.time >= start && b.time + 3600 <= at).map((b) => fut(b, seed));
    let m5 = SPOT5.filter((b) => b.time >= start && b.time + 300 <= at).map((b) => fut(b, seed)).concat(stray);
    const cnbc1 = h1[0].time, sf = R.scaleFill(h1, m5, SPOT5, t0, FROM);
    h1 = sf.h1; m5 = sf.m5;
    const have = new Set(h1.map((b) => b.time)), H = h1.concat(T.agg(m5, 3600).filter((b) => !have.has(b.time))).sort((a, b) => a.time - b.time).filter((b) => b.time + 3600 <= at);
    const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
    const full = [...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d).sort((a, b) => a - b);
    // `cov`: gold has no candles of its own before this time (no back-fill, feed not yet continuous); what the old code built
    // there from stray prints is `strayH`, kept only so the signals no longer recorded can be counted
    if (cov && M.short === 'GC') return { sym: 'TEST', m5: m5.filter((b) => b.time >= cov), H: H.filter((b) => b.time >= cov), D: D1.filter((b) => b.time + 86400 <= at), rolls: null, m5from: null, m5days: new Set(full.filter((d) => d * 86400 >= cov)), cnbcFrom: cnbc1, fill: { src: 'spot', scale: +sf.k.toFixed(5), h1: sf.n, overlap: sf.overlap }, covFrom: cov, strayM5: 123, strayH: H };
    return { sym: 'TEST', m5, H, D: D1.filter((b) => b.time + 86400 <= at), rolls: null, m5from: full.length ? full[0] * 86400 : null, m5days: new Set(full), cnbcFrom: cnbc1, fill: { src: 'spot', scale: +sf.k.toFixed(5), h1: sf.n, overlap: sf.overlap } };
  };
}
const MK = { gc: T.MARKETS.gc, nq: T.MARKETS.nq };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ict-stable-'));
const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };
const go = (data, f, o = {}) => quiet(() => R.run({ data, now: o.at || AT, from: FROM, history: feed({ at: o.at || AT, ...f }), markets: MK, shadowMarkets: {}, ruleCode: o.ruleCode || 'rules-1', rebuild: o.rebuild || false }));
const rd = (dir, f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
const byId = (list) => new Map(list.map((t) => [t.id, t]));
// what "booked" means for a record: the correction log's fields. A record inside the settle window is computed again, so its
// research path (the 72 candles after the entry) may still grow; its booking may not change on unchanged candles.
const bookedOf = (t) => t && Object.fromEntries(['status', 'R', 'Rraw', 'R2', 'closed', 'exit', 'exitPx', 'entry', 'stop', 'size'].map((k) => [k, t[k]]));
const same = (N, t, cut, msg) => (t.closed <= cut ? assert.deepEqual(N.get(t.id), JSON.parse(JSON.stringify(t)), msg + ' (carried whole)') : assert.deepEqual(bookedOf(N.get(t.id)), bookedOf(t), msg));
const lists = (o) => ({ trades: o.trades, shadow: o.shadow, ...o.shadowByVariant });

// the two feeds: on the second day the window starts two days later and the old thin candles differ, so the measured scale differs
const F1 = { start: t0 + 60 * DAY, seed: 11 }, F2 = { start: t0 + 62 * DAY, seed: 12, stray: [{ time: t0 + 40 * DAY + 7200, open: 10650, high: 10650, low: 10650, close: 10650, volume: 1 }] };

test('1. the fake feed really is unstable: a full rebuild on the second feed changes booked history', async () => {
  const a = await go(tmp(), F1), b = await go(tmp(), F2);
  assert.notEqual(a.src.gc.fill.scale, b.src.gc.fill.scale, 'the back-fill scale depends on the candles the feed returned');
  assert.notEqual(a.src.gc.cnbcFrom, b.src.gc.cnbcFrom, 'and so does the boundary');
  assert.ok(a.trades.filter((t) => t.closed).length >= 40, 'enough booked records to mean something');
  const e = R.replayDiff(a, b, 'x');
  assert.ok(e.corrected.length > 5, `booked records would be "corrected" (${e.corrected.length})`);
  assert.equal(a.frozen.on, false); assert.match(a.frozen.why, /no previous file/, 'a first run with no previous file computes everything');
});

test('2. the next run on a different feed: booked history is identical, the log stays empty, the file says what was carried', async () => {
  const dir = tmp(), a = await go(dir, F1), file1 = rd(dir, 'replay.json');
  assert.equal(rd(dir, 'replay-log.json'), null, 'a first file is not a correction');
  const b = await go(dir, F2);
  const cut = AT - R.SETTLE, A = lists(file1), B = lists(rd(dir, 'replay.json'));
  let carried = 0;
  for (const k of Object.keys(A)) { const N = byId(B[k]);
    for (const t of A[k]) if (R.booked(t) && t.closed <= cut) { carried++; assert.deepEqual(N.get(t.id), t, `${k} ${t.id} is carried exactly as booked`); }
    // nothing new was started inside settled history
    const O = byId(A[k]); for (const t of B[k]) if (!O.has(t.id)) assert.ok(t.opened > cut, `${k} ${t.id}: no new record inside settled history`); }
  assert.ok(carried > 60, `carried ${carried}`);
  assert.equal(rd(dir, 'replay-log.json'), null, 'nothing changed, so nothing is logged');
  assert.deepEqual(b.totals, a.totals, 'the headline does not move'); assert.deepEqual(b.totalsA, a.totalsA); assert.deepEqual(b.totalsByVariant, a.totalsByVariant);
  assert.equal(b.frozen.on, true); assert.equal(b.frozen.cut, cut); assert.equal(b.frozen.settleDays, 3); assert.equal(b.frozen.baseAt, a.at);
  assert.match(b.frozen.why, /carried from the file of .* as booked/);
  assert.equal(b.frozen.carried.gc, file1.trades.filter((t) => t.market === 'gc' && R.booked(t) && t.closed <= cut).length);
  assert.ok(b.frozen.ignored.gc + b.frozen.ignored.nq >= 0); assert.ok(b.frozen.blocked.gc + b.frozen.blocked.nq > 0, 'signals inside an earlier record are counted as blocked, not ignored'); assert.ok(b.frozen.shadowCarried > 0, 'the paper streams are carried the same way');
  assert.notEqual(b.src.gc.fill.scale, a.src.gc.fill.scale, 'the file still shows this run\'s own scale and boundary');
  // every record keeps its stop on the losing side (absolute rule 1)
  for (const t of b.trades) assert.ok((t.entry - t.stop) * (t.side === 'buy' ? 1 : -1) > 0, `${t.id} stop`);
});

test('3. later runs: new candles add and resolve records, booked ones never change', async () => {
  const dir = tmp(), a = await go(dir, F1);
  const open1 = a.trades.filter((t) => !t.closed).map((t) => t.id);
  let prev = a;
  for (const [i, days] of [1, 2, 5].entries()) {
    const at = AT + days * DAY, o = await go(dir, { start: t0 + (62 + i) * DAY, seed: 20 + i }, { at });
    const N = byId(o.trades);
    for (const t of prev.trades) if (R.booked(t)) same(N, t, prev.through - R.SETTLE, `${t.id} booked once`);
    prev = o;
  }
  const log = rd(dir, 'replay-log.json');
  for (const e of (log ? log.runs : [])) { assert.equal(e.corrected.length, 0, 'no booked result is corrected'); assert.equal(e.removed.length, 0, 'no record is removed'); assert.equal(e.rebuild, undefined); assert.ok(e.frozen && e.frozen.carried > 0); }
  assert.ok(prev.trades.length > a.trades.length, 'the record still grows');
  if (open1.length) { assert.ok(log && log.runs.some((e) => e.resolved.some((r) => open1.includes(r.id))), 'an unresolved record is resolved once, and logged'); }
});

test('4. a deliberate rebuild recomputes everything and is always logged; so is a change of the ICT code or of the start date', async () => {
  const dir = tmp(), a = await go(dir, F1);
  const b = await go(dir, F2, { rebuild: true });
  assert.equal(b.frozen.on, false); assert.equal(b.frozen.rebuild, 'asked');
  let log = rd(dir, 'replay-log.json'); assert.equal(log.runs.length, 1);
  assert.equal(log.runs[0].rebuild, 'asked'); assert.ok(log.runs[0].corrected.length > 5, 'the rebuild\'s corrections are listed one by one');
  assert.deepEqual(log.runs[0].totalsFrom.n, a.totals.n);
  // a rebuild that changes nothing is logged too: that entry is the proof the history is stable
  await go(dir, F2, { rebuild: true }); log = rd(dir, 'replay-log.json');
  assert.equal(log.runs.length, 2); assert.equal(log.runs[1].rebuild, 'asked'); assert.equal(log.runs[1].corrected.length + log.runs[1].removed.length + log.runs[1].added, 0);
  // the ICT code changed: a rule change must show over the whole history
  const c = await go(dir, F1, { ruleCode: 'rules-2' }); log = rd(dir, 'replay-log.json');
  assert.equal(c.frozen.rebuild, 'code'); assert.equal(log.runs.at(-1).rebuild, 'code'); assert.equal(c.ruleCode, 'rules-2');
  // and the run after that is frozen again
  const d = await go(dir, F2, { ruleCode: 'rules-2' }); assert.equal(d.frozen.on, true); assert.equal(rd(dir, 'replay-log.json').runs.length, log.runs.length);
});

test('5. freezePlan and freezer: when history is carried and when it is not', () => {
  const prev = { at: '2026-11-11T09:12:46.658Z', from: '2025-08-01', through: 1794388366, ruleCode: 'r', trades: [] }, o = { from: '2025-08-01', ruleCode: 'r', rebuild: false };
  assert.equal(R.freezePlan(null, o).on, false); assert.equal(R.freezePlan({ at: 'x' }, o).on, false, 'a broken previous file freezes nothing');
  const p = R.freezePlan(prev, o); assert.equal(p.on, true); assert.equal(p.cut, prev.through - 3 * 86400); assert.equal(p.adopted, false);
  // the file written before this change has no ruleCode and no `through`: it is adopted as the baseline, cut from its `at`
  const old = R.freezePlan({ at: '2026-11-08T13:49:48.826Z', from: '2025-08-01', trades: [] }, o);
  assert.equal(old.on, true); assert.equal(old.adopted, true); assert.equal(old.cut, Math.floor(Date.parse('2026-11-08T13:49:48.826Z') / 1000) - R.SETTLE);
  assert.equal(R.freezePlan(prev, { ...o, rebuild: true }).rebuild, 'asked'); assert.equal(R.freezePlan(prev, { ...o, ruleCode: 'other' }).rebuild, 'code'); assert.equal(R.freezePlan(prev, { ...o, from: '2026-01-01' }).rebuild, 'start');
  const cut = 1000, list = [{ id: 'a', status: 'loss', R: -1, closed: 900 }, { id: 'b', status: 'win', R: 2, closed: 1100 }, { id: 'c', status: 'open', R: null, closed: null, opened: 500 }];
  const f = R.freezer(list, cut);
  assert.deepEqual(f.carried().map((t) => t.id), ['a'], 'only a record booked before the cut is carried');
  assert.equal(f.skip('a', 100), true, 'carried: not computed again'); assert.equal(f.skip('b', 800), false, 'booked inside the settle window: computed'); assert.equal(f.skip('c', 500), false, 'unresolved: computed');
  assert.equal(f.skip('new-old', 400), true, 'a record the previous file does not have, inside settled history: not started'); assert.equal(f.st.ignored, 1);
  assert.equal(f.skip('inside-c', 600), true); assert.equal(f.st.blocked, 1, 'a signal inside an open record of the previous file was never a record: counted apart'); assert.equal(f.st.ignored, 1);
  assert.equal(f.skip('new', 1001), false, 'after the cut: computed');
  const off = R.freezer(null, null); assert.equal(off.on, false); assert.equal(off.skip('a', 1), false); assert.deepEqual(off.carried(), []);
  assert.equal(typeof R.rulesHash(), 'string'); assert.equal(R.rulesHash().length, 16); assert.equal(R.rulesHash(), R.rulesHash());
});

test('6. a feed that fails keeps the records, and the market is frozen only up to the last run that read it', async () => {
  const dir = tmp(), a = await go(dir, F1);
  const fail = feed({ at: AT + DAY, ...F2 }), half = async (M) => { if (M.short === 'GC') throw new Error('no CNBC history for GC'); return fail(M); };
  const b = await quiet(() => R.run({ data: dir, now: AT + DAY, from: FROM, history: half, markets: MK, shadowMarkets: {}, ruleCode: 'rules-1', rebuild: false }));
  assert.equal(b.kept.gc, a.trades.filter((t) => t.market === 'gc').length); assert.equal(b.marketThrough.gc, AT, 'gold was last read by the first run'); assert.equal(b.marketThrough.nq, AT + DAY);
  assert.deepEqual(b.trades.filter((t) => t.market === 'gc'), JSON.parse(JSON.stringify(a.trades.filter((t) => t.market === 'gc'))));
  // five days later the feed is back: gold signals of the days it was down are still taken (its cut is the first run's, not yesterday's)
  const c = await go(dir, { start: t0 + 63 * DAY, seed: 31 }, { at: AT + 6 * DAY });
  const N = byId(c.trades); for (const t of a.trades) if (R.booked(t)) same(N, t, AT - R.SETTLE, t.id);
  assert.ok(c.trades.some((t) => t.market === 'gc' && t.opened > AT - R.SETTLE && t.opened <= AT + 3 * DAY && !byId(a.trades).has(t.id)), 'a gold record from the days the feed was down');
  assert.equal(c.marketThrough.gc, AT + 6 * DAY);
});

test('8. a market is recorded from where its candles start; older records leave once, by name, through the log', async () => {
  const dir = tmp(), a = await go(dir, F1), COV = t0 + 40 * DAY;
  const old = a.trades.filter((t) => t.market === 'gc' && t.opened < COV); assert.ok(old.length >= 5, `gold records before its candles start (${old.length})`);
  assert.deepEqual(a.recordFrom.gc.why, 'the replay start'); assert.deepEqual(a.uncovered, {});
  // the file in place was written before starts were recorded (as the first frozen file was): take the field out
  { const p = rd(dir, 'replay.json'); delete p.recordFrom; delete p.uncovered; fs.writeFileSync(path.join(dir, 'replay.json'), JSON.stringify(p)); }
  const b = await go(dir, { ...F2, cov: COV });
  assert.equal(b.frozen.on, true, 'not a rebuild: everything else is carried');
  assert.equal(b.recordFrom.gc.from, new Date(COV * 1000).toISOString().slice(0, 10)); assert.match(b.recordFrom.gc.why, /first candle of its back-fill \(spot\)/); assert.equal(b.recordFrom.nq.why, 'the replay start');
  assert.equal(b.uncovered.gc.before, b.recordFrom.gc.from); assert.equal(b.uncovered.gc.strayM5, 123); assert.ok(b.uncovered.gc.signals >= old.length, 'the signals no longer recorded are counted');
  assert.ok(!b.trades.some((t) => t.market === 'gc' && t.opened < COV), 'no gold record before its candles start');
  const log = rd(dir, 'replay-log.json'), e = log.runs.at(-1);
  assert.deepEqual([...e.uncovered.ids].sort(), old.map((t) => t.id).sort(), 'the log names every record that left'); assert.match(e.uncovered.why, /stray feed candles/); assert.deepEqual(e.uncovered.recordFrom, { gc: b.recordFrom.gc.from });
  assert.deepEqual(e.removed.map((r) => r.id).sort(), old.map((t) => t.id).sort(), 'and nothing else was removed'); assert.equal(e.corrected.length, 0); assert.equal(e.rebuild, undefined);
  assert.equal(+(a.totals.R - old.filter((t) => t.closed).reduce((q, t) => q + t.R, 0)).toFixed(2), b.totals.R, 'the headline drops by exactly those records');
  const N = byId(b.trades); for (const t of a.trades) if (R.booked(t) && !(t.market === 'gc' && t.opened < COV)) same(N, t, AT - R.SETTLE, t.id);
  assert.equal(b.frozen.carried.gc, a.trades.filter((t) => t.market === 'gc' && t.opened >= COV && R.booked(t) && t.closed <= AT - R.SETTLE).length);
  // once: the next run logs nothing, and a start once recorded does not move later when the feed's history starts later
  const c = await go(dir, { ...F1, cov: COV + 9 * DAY }); assert.equal(rd(dir, 'replay-log.json').runs.length, log.runs.length);
  assert.equal(c.recordFrom.gc.t, COV); assert.match(c.recordFrom.gc.why, /as first recorded/); assert.deepEqual(c.totals, b.totals);
});

test('9. a plumbing-only change of the ICT code does not recompute the history; the desk says where a market starts', () => {
  const prev = { at: '2026-11-11T13:30:00.000Z', from: '2025-08-01', through: 1794403800, ruleCode: R.SAME_RULES[0], trades: [] };
  const p = R.freezePlan(prev, { from: '2025-08-01', ruleCode: 'todays-code', rebuild: false }); assert.equal(p.on, true, 'the fingerprint this change replaces has the same rules');
  assert.equal(R.freezePlan({ ...prev, ruleCode: 'someone-elses' }, { from: '2025-08-01', ruleCode: 'todays-code', rebuild: false }).rebuild, 'code');
  const src = fs.readFileSync(new URL('../ict/replay.mjs', import.meta.url), 'utf8'), page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(src, /if \(strayM5\) m5 = m5\.filter\(\(b\) => b\.time >= cnbc1\);/, 'before the feed\'s continuous start only back-fill candles are used');
  assert.match(src, /const cov = Math\.max\(from, src\.covFrom \|\| 0\)/); assert.match(src, /filter\(\(g\) => g\.close >= rf && g\.grade\.total >= MIN_GRADE\)/);
  assert.match(page, /Object\.values\(S\.replayInfo\.recordFrom \|\| \{\}\)\.filter\(\(v\) => v && v\.from > S\.replayInfo\.from\)/); assert.match(page, /from \$\{esc\(v\.from\)\}, where its candles start/);
});

test('7. wiring: the workflow can ask for a rebuild, the replay only runs when started as a script', () => {
  const src = fs.readFileSync(new URL('../ict/replay.mjs', import.meta.url), 'utf8'), wf = fs.readFileSync(new URL('../.github/workflows/ict-replay.yml', import.meta.url), 'utf8');
  assert.match(src, /if \(process\.argv\[1\] && process\.argv\[1\]\.endsWith\('replay\.mjs'\)\) await run\(\);/);
  assert.match(src, /process\.env\.ICT_REPLAY_REBUILD === 'on'/);
  assert.match(wf, /ICT_REPLAY_REBUILD: \$\{\{ github\.event\.inputs\.rebuild == 'true' && 'on' \|\| 'off' \}\}/);
  assert.match(wf, /git add ict\/replay\.json ict\/replay-log\.json/, 'no new file to save: the previous replay.json is the frozen history');
  assert.equal(R.SETTLE, 3 * 86400);
});

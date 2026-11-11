// node --test tests/desk-ict-trace.test.mjs: every ICT desk result traceable to its execution (Fred's audit, 11 Nov 2026).
//   1. a replay record carries how far its candles were processed (`through`), and while it is unresolved the stop in force there
//      and the R at that candle's close; a rerun over more candles books the FIRST exit, once; a run that changes nothing logs nothing;
//   2. the live and the replay execution of one signal are read by their exact ids, and a note belongs to one of them;
//   3. win / loss / break-even is ONE rule (the sign of the stored per-unit R of a closed record) in the replay, on the desk page
//      and in the connector; unresolved records are never booked; near-flat is a named label with a published tolerance.
// Offline. Not named tests/ict-*: it also checks the page and the connector, which are outside the ICT edge's own files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = await import('../ict/tracker.mjs'), R = await import('../ict/replay.mjs');
const MCP = require('../api/mcp.js').lib;
const PAGE = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const W = {}; vm.runInNewContext(PAGE.match(/<script id="ms-ict-lib">([\s\S]*?)<\/script>/)[1], { window: W, Intl, Date, Object, Math, Array, String, isFinite });
const I = W.MS_ICT;

// a deterministic path (the stop guard's): one-hour candles, weekdays, with daily candles behind them
const noise = (t, s) => { let x = Math.imul((t / 60) ^ (s * 0x9e3779b1), 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return (x / 0xffffffff) * 2 - 1; };
const price = (t) => 10000 + 500 * Math.sin((2 * Math.PI * t) / (86400 * 23)) + 180 * Math.sin((2 * Math.PI * t) / (86400 * 3.1)) + 70 * Math.sin((2 * Math.PI * t) / (3600 * 9.3)) + 30 * noise(t, 1);
function synthetic(sec, from, n) { const out = []; for (let t = from; out.length < n; t += sec) { if (new Date(t * 1000).getUTCDay() === 6) continue;
  const o = price(t), c = price(t + sec); out.push({ time: t, open: +o.toFixed(2), high: +(Math.max(o, c) + Math.abs(noise(t, 2)) * 12 * Math.sqrt(sec / 3600)).toFixed(2), low: +(Math.min(o, c) - Math.abs(noise(t, 3)) * 12 * Math.sqrt(sec / 3600)).toFixed(2), close: +c.toFixed(2) }); } return out; }
const t0 = Date.UTC(2024, 0, 1) / 1000, H = synthetic(3600, t0, 3000), D = synthetic(86400, t0 - 200 * 86400, 330), M = T.MARKETS.nq;
const sig = [1, -1].flatMap((s) => T.signals(H, D, s, M.tick)).sort((a, b) => a.close - b.close);
const run = (g, cut) => R.simulate(g, M, 'nq', { H: cut == null ? H : H.filter((b) => b.time + 3600 <= cut), D, m5: [] }, cut == null ? Infinity : cut);

test('1. checkpoint: an unresolved replay record says how far it was processed, the stop there and the R at that close', () => {
  let open = 0, exits = { stop: 0, other: 0 };
  for (const g of sig) {
    const full = run(g); if (!full || !full.closed) continue;
    assert.equal(full.through, full.closed, 'a booked record was processed up to its exit'); assert.equal(full.markR, undefined, 'no mark on a booked record');
    const held = H.filter((b) => b.time >= g.close && b.time + 3600 <= full.closed).length;   // candles processed up to the exit
    for (const k of [1, 2, Math.max(1, held - 1)].filter((v, i, a) => v < held && a.indexOf(v) === i)) {
      const last = H.filter((b) => b.time >= g.close)[k - 1], cut = last.time + 3600, part = run(g, cut); if (!part) continue; open++;
      assert.equal(part.status, 'open', `${part.id} cut ${k} candles in: unresolved`); assert.equal(part.R, null); assert.equal(part.closed, null);
      assert.equal(part.through, cut, 'the last candle processed'); assert.equal(I.outcome(part), 'open'); assert.equal(R.outcomeOf(part), 'open'); assert.equal(MCP.outcome(part), 'open');
      const sd = g.side, want = +((sd * (last.close - g.entry)) / g.r0).toFixed(2); assert.equal(part.markR, want, 'R at that candle\'s close, a unit');
      assert.ok((part.stopNow - part.stop0) * sd >= -1e-9, 'the stop in force is never looser than the first stop'); assert.ok((g.entry - part.stopNow) * sd > -1e-9 || part.beMoved || part.trailMoved, 'a stop past the entry was moved by a rule');
      // the page shows the mark of the checkpoint, never a newer price
      assert.equal(I.markR({ ...part, replay: true }), want);
    }
    // every candle in between is processed before a later one: a later cut never changes a booked exit, and it is booked once
    for (const later of [full.closed, full.closed + 5 * 3600, full.closed + 400 * 3600]) { const again = run(g, later); const { path: p1, ...a } = again, { path: p2, ...b } = full; assert.deepEqual(a, b, `${full.id}: the same exit whatever the later cut`); }
    exits[full.exit === 'stop' ? 'stop' : 'other']++;
  }
  assert.ok(open >= 20 && exits.stop >= 5 && exits.other >= 5, `enough cases (${open} unresolved, ${JSON.stringify(exits)})`);
});

test('1. a record cut before its window has all its candles stays unresolved: no time exit is made up', () => {
  const g = sig.find((x) => { const f = run(x); return f && f.exit === 'time'; }); assert.ok(g, 'a time exit on the path');
  const full = run(g), short = run(g, full.closed - 3600); assert.equal(short.status, 'open'); assert.equal(short.exit, null); assert.equal(short.through, full.closed - 3600);
  // a hole in the candles longer than any holiday: no record at all (counted in replay.json gaps), never a guessed exit
  const holed = H.filter((b) => b.time < g.close + 2 * 3600 || b.time > g.close + 6 * 86400); assert.equal(R.simulate(g, M, 'nq', { H: holed, D, m5: [] }, Infinity), null);
});

test('1. the correction log: a resolved record is logged once, a corrected one with before and after, an unchanged run not at all', () => {
  const picks = sig.map((g) => ({ g, full: run(g) })).filter((x) => x.full && x.full.closed).slice(0, 12);
  const prev = { at: '2026-11-08T13:49:48.826Z', trades: picks.map(({ g, full }, i) => (i < 3 ? run(g, H.filter((b) => b.time >= g.close)[0].time + 3600) : full)) };
  const next = { at: '2026-11-11T09:00:00.000Z', trades: picks.map((x) => x.full) };
  assert.equal(prev.trades.filter((t) => t.status === 'open').length, 3);
  const e = R.replayDiff(prev, next, next.at);
  assert.deepEqual([e.resolved.length, e.corrected.length, e.removed.length, e.added, e.changed, e.prevAt], [3, 0, 0, 0, true, prev.at]);
  for (const r of e.resolved) { const o = prev.trades.find((t) => t.id === r.id), n = next.trades.find((t) => t.id === r.id); assert.equal(r.through, o.through); assert.equal(r.markR, o.markR); assert.equal(r.to.status, n.status); assert.equal(r.to.exitPx, n.exitPx); assert.equal(r.to.R, n.R); }
  assert.deepEqual([e.totalsFrom.open, e.totalsTo.open, e.totalsTo.n], [3, 0, 12]);
  let log = R.appendLog(null, e); assert.equal(log.runs.length, 1);
  // the same run again: nothing changes, nothing is logged, every result stays booked once
  const e2 = R.replayDiff(next, next, '2026-11-11T09:30:00.000Z'); assert.equal(e2.changed, false); log = R.appendLog(log, e2); assert.equal(log.runs.length, 1);
  assert.deepEqual(R.tally(next.trades), R.tally(JSON.parse(JSON.stringify(next.trades))));
  // a booked result that differs is a correction with both values; a record that left the list is named
  const moved = JSON.parse(JSON.stringify(next)); moved.trades[5].R = +(moved.trades[5].R + 0.5).toFixed(2); moved.trades.pop();
  const e3 = R.replayDiff(next, moved, 'x'); assert.equal(e3.corrected.length, 1); assert.equal(e3.corrected[0].from.R, next.trades[5].R); assert.equal(e3.corrected[0].to.R, moved.trades[5].R); assert.equal(e3.removed.length, 1); assert.equal(e3.removed[0].id, next.trades[11].id);
  assert.equal(R.replayDiff(null, next, 'x').changed, false, 'a first file is not a correction');
  const src = fs.readFileSync(new URL('../ict/replay.mjs', import.meta.url), 'utf8'), wf = fs.readFileSync(new URL('../.github/workflows/ict-replay.yml', import.meta.url), 'utf8');
  assert.ok(src.indexOf("'replay-log.json'), JSON.stringify(lg)") < src.indexOf("fs.writeFileSync(path.join(DATA, 'replay.json'), JSON.stringify(out))"), 'the log is written before the file it explains is replaced');
  assert.match(src, /for \(const key of Object\.keys\(out\.errors\)\) \{ const keep = \(\(PREV && PREV\.trades\) \|\| \[\]\)\.filter\(\(t\) => t\.market === key\)/, 'a market whose feed failed keeps its records: a failed download is not a correction');
  assert.match(wf, /cron: '41 6 \* \* \*'/, 'the replay runs every day, so "update pending" lasts a day at most'); assert.match(wf, /git add ict\/replay\.json ict\/replay-log\.json/);
});

test('3. one booked outcome on every surface: the replay, the desk page and the connector count the same', () => {
  const C = (o) => ({ id: 'x', market: 'nq', short: 'NQ', side: 'buy', signalAt: 1, closed: 10, status: 'win', grade: {}, feat: {}, ...o });
  // the audit's nine: small wins and losses within 0.05R used to be break-even in the connector only
  const rows = [C({ R: 2, status: 'win' }), C({ R: -1, status: 'loss' }), C({ R: 0, status: 'be' }), C({ R: 0.03, status: 'win' }), C({ R: 0.05, status: 'win' }), C({ R: -0.02, status: 'loss' }), C({ R: -0.05, status: 'loss' }),
    C({ R: 0.02, Rraw: 0.04, size: 0.5, status: 'win' }), C({ R: 0.01, Rraw: 0.01, size: 1.5, status: 'win' }), C({ R: 0, Rraw: 0.01, size: 0.5, status: 'win' }),   // sized and rounded to 0.00: still the win it was booked as
    C({ R: null, closed: null, status: 'open' }), C({ R: null, closed: null, status: 'open', replay: true, markR: -5.22, through: 5 })].map((t, i) => ({ ...t, id: 'x' + i }));
  const t = R.tally(rows), p = I.stats(rows.filter((x) => x.closed)), c = MCP.stats(rows);
  assert.deepEqual([t.n, t.wins, t.losses, t.be, t.nearFlat, t.open], [10, 6, 3, 1, 8, 2]);
  assert.deepEqual([p.n, p.w, p.l, p.be, p.nearFlat], [t.n, t.wins, t.losses, t.be, t.nearFlat], 'the desk page');
  assert.deepEqual([c.closed, c.wins, c.losses, c.breakEven, c.nearFlat, c.open], [t.n, t.wins, t.losses, t.be, t.nearFlat, t.open], 'the connector');
  assert.equal(c.netR, t.R); assert.ok(Math.abs(p.tot - t.R) < 1e-9, 'the same net R');
  for (const x of rows) { assert.equal(I.outcome(x), R.outcomeOf(x), x.id); assert.equal(MCP.outcome(x), R.outcomeOf(x), x.id); }
  // the unresolved replay mark is never in booked performance, whatever it reads
  assert.equal(R.tally([rows[11]]).R, 0); assert.equal(MCP.stats([rows[11]]).netR, 0); assert.equal(I.stats([rows[11]]).n, 0);
  // the tolerance is published and equal everywhere
  assert.equal(R.NEAR_FLAT, 0.05); assert.equal(I.NEAR_FLAT, 0.05); assert.match(c.outcomeRule, /nearFlat = \|per-unit R\| <= 0\.05/);
  assert.match(PAGE, /Near-flat = within ±\$\{ICT\.NEAR_FLAT\}R a unit, a research label that does not change the outcome\. Unresolved replay records are not counted\./);
  assert.match(fs.readFileSync(new URL('../ict/replay.mjs', import.meta.url), 'utf8'), /out\.outcome = \{ rule: 'sign of the stored per-unit R/);
  // the pinned desk files: the stored status of every closed record is the outcome the rule gives
  for (const f of ['trades.json', 'replay.json']) { let d; try { d = JSON.parse(fs.readFileSync(new URL('./fixtures/ict/' + f, import.meta.url), 'utf8')); } catch (e) { continue; }
    for (const x of Array.isArray(d) ? d : d.trades || []) if (x.closed && ['win', 'loss', 'be'].includes(x.status)) assert.equal(R.outcomeOf(x), x.status, `${f} ${x.id}`); }
});

test('2. two executions of one signal: exact ids, each with its own note; a note nearer the other fill is flagged', () => {
  assert.equal(I.twinId('es-s-1793995200'), 'es-s-1793995200-r'); assert.equal(I.twinId('es-s-1793995200-r'), 'es-s-1793995200');
  const live = { id: 'es-s-1793995200', entry: 7405 }, rep = { id: 'es-s-1793995200-r', entry: 7401.75 };
  assert.deepEqual({ ...I.reviewExec(live.id, { fill: 7405.25 }, live, rep) }, { exec: 'live', check: false }, 'the key says whose note it is');
  assert.deepEqual({ ...I.reviewExec(rep.id, { text: 'no fill given' }, rep, live) }, { exec: 'replay', check: false });
  assert.deepEqual({ ...I.reviewExec(rep.id, { fill: 7405 }, rep, live) }, { exec: 'replay', check: true }, 'the fill is the live one: look again');
  assert.deepEqual({ ...I.reviewExec(live.id, { fill: 7405, exec: 'live' }, live, null) }, { exec: 'live', check: false });
  // the page: both executions on the signal's row and in the dialog, opened by their own ids; the note is saved under the open one
  for (const k of ['const BYID = new Map(), twin = (x) => BYID.get(ICT.twinId(x.id)) || null;', 'class="ict-ex-b${cur ? \' on\' : \'\'}" data-id="${esc(y.id)}"', "$('ict-tv-ex').innerHTML = execs(x, x.id)", "exec: x.replay ? 'replay' : 'live' };", 'This review is for the ${x.replay ? \'Replay\' : \'Live\'} execution (${x.id}).', '<div id="ict-tv-ex"></div>', '`Open ${fRn(r)}`}${execs(x)}</td>`', "$('ict-tv-ex').addEventListener('click'"])
    assert.ok(PAGE.includes(k), k);
  assert.match(PAGE, /const x = S\.trades\.concat\(S\.replay\)\.find\(\(t\) => t\.id === id\); if \(!x\) return; S\.cur = x;/, 'a signal opens by its exact id');
  assert.match(PAGE, /S\.desk\.reviews\[x\.id\] = \{/, 'and its note is kept under that id, so saving one never touches the other');
  // an unresolved replay record on the page: its own mark and cut-off, never the live price
  assert.match(PAGE, /const liveR = \(x\) => \(x\.replay \? ICT\.markR\(x\) : /); assert.match(PAGE, /Replay through \$\{ICT\.nyTime\(x\.through, true\)\} ET/); assert.match(PAGE, /' · update pending'/);
  assert.match(PAGE, /const pxOf = \(x\) => \{ if \(x\.replay\) return x\.status === 'open' && x\.markPx != null \? x\.markPx : null;/);
});

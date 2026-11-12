// node --test tests/moved-stop-audit.test.mjs — the moved-stop audit (12 Nov 2026; research/proposals/2026-11-12-moved-stop-audit.md).
// The NQ open run's loop recomputes 1R from a stop its trail has already moved (docs/owner-decisions.md item 49). This file checks
// every OTHER place that computes a trade's risk, R, mfe / mae or a trail level after the stop can have moved, on hand-made
// candles, one management call per candle (as the live runner and the quick pass run the Trader: one run per new candle).
// Offline. ICT (Fred's edge) is only read, never edited: its tracker and replay use the stored r0 throughout.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { manageLive, addUnit, tradeCost, financing, rowFinancing, replayBar, exitR, openRisk } from '../council/fills.mjs';
import { swingBreakEven } from '../council/lit.mjs';
import { openPositions } from '../council/digest.mjs';
import { reconcile } from '../council/ctrader-reconcile.mjs';

const require = createRequire(import.meta.url);
const EA = require('../api/_edge-analyst.js');
const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const clone = (x) => JSON.parse(JSON.stringify(x));
const T0 = 1794300000;   // Thursday 12 Nov 2026 ~ 11:20 UTC: no spot shutdown, no rollover in the hour used below
const bar = (i, o, h, l, c) => ({ time: T0 + i * 60, open: o, high: h, low: l, close: c });

// run the candles through manageLive one per call (one Trader run per candle), and all in one call: the result must not depend on
// how often the Trader runs. Returns the record after each way.
function runBoth(tr0, bars, opt = {}) {
  const a = clone(tr0), b = clone(tr0);
  for (const x of bars) { if (a.status === 'open' || a.status === 'pending') manageLive(a, x, opt); }
  // "one run": the same loop body over every candle in one go is identical by construction; the per-run difference in the NQ loop
  // came from re-deriving r0 at the TOP of each run. manageLive stamps r0 once (tr.r0 || (tr.r0 = ...)), so a second copy that
  // starts each "run" from a JSON round trip (as trades.json is saved and read back) must agree.
  let c = b; for (const x of bars) { c = clone(c); if (c.status === 'open' || c.status === 'pending') manageLive(c, x, opt); }
  return [a, c];
}

test('generic Trader loop (fills.manageLive, parity-pinned to trader.mjs): a trail exit is booked in the opening R, whatever the run cadence', () => {
  // gtl / geg-like: buy 100, stop 90 (r0 10 stamped at the push), trail [2, 1], target 10R
  const tr = { id: 'xau-gtl-1', market: 'xau', side: 'buy', entry: 100, stop: 90, t1: 200, tp1: 120, rr: 10, r0: 10, trail: [2, 1], status: 'open', filled: T0 - 60, opened: T0 - 60, noBe: true, dec: 2 };
  const bars = [bar(0, 100, 124, 100, 123), bar(1, 123, 123.5, 121, 122), bar(2, 122, 130, 122, 129), bar(3, 129, 129, 126, 127), bar(4, 127, 127, 118, 119)];
  const [a, c] = runBoth(tr, bars);
  assert.deepEqual(a, c, 'per-candle runs from saved records = one pass');
  assert.equal(a.r0, 10); assert.equal(a.mfe, 3, 'mfe in the opening unit (130 = +3R)');
  assert.equal(a.stop, 120, 'trail 1R behind +3R: 120 (the NQ loop put it at 127.44 in the same case)');
  assert.equal(a.status, 'win'); assert.equal(a.R, 2, 'stopped at 120 = +2.00R (the NQ loop would book +1.00R)'); assert.equal(a.exit, 'trailing stop');
});

test('generic loop: a record pushed WITHOUT r0 (the engine setups) is stamped on its first managed candle, before any stop can move', () => {
  const tr = { id: 'eurusd-intraday-9', market: 'eurusd', side: 'sell', entry: 1.1, stop: 1.102, t1: 1.094, rr: 3, status: 'pending', opened: T0 - 60, dec: 5 };
  const bars = [bar(0, 1.0995, 1.1001, 1.0994, 1.1), bar(1, 1.1, 1.1, 1.0975, 1.0978), bar(2, 1.0978, 1.0996, 1.0977, 1.0995), bar(3, 1.0995, 1.1003, 1.0995, 1.1002)];
  const [a, c] = runBoth(tr, bars, { be: 1 });   // the Coach's break-even at +1R
  assert.deepEqual(a, c);
  assert.ok(Math.abs(a.r0 - 0.002) < 1e-12); assert.equal(a.beMoved, true); assert.equal(a.mfe, 1.25, '+1.25R measured against 0.002 after the stop moved');
  assert.equal(a.status, 'be'); assert.equal(a.R, 0, 'out at the entry = 0R, not 0 / 0');
});

test('stops moved OUTSIDE the loop (gold trend ratchet, crypto trend, LIT swing break-even) are booked against the r0 the push stamped', () => {
  // gold trend: entry 4000, stop 3960 (2 ATR, r0 40), lifted by the daily ratchet (trader.mjs) to 4030 between runs
  const g = { id: 'xau-gtrend-1', market: 'xau', side: 'buy', entry: 4000, stop: 3960, t1: 400000, rr: 99, trail: [1e6, 0], r0: 40, status: 'open', filled: T0 - 86400, opened: T0 - 86400, noBe: true, dec: 2 };
  g.stop = 4030; g.trailMoved = true;   // the ratchet
  manageLive(g, bar(0, 4035, 4036, 4029, 4031));
  assert.equal(g.status, 'win'); assert.equal(g.R, 0.75, '(4030 - 4000) / 40'); assert.equal(g.exit, 'trailing stop');
  // LIT: swingBreakEven moves the stop to the entry outside the loop; the record carries r0 from litRecord
  const L = { id: 'xau-lit-b-1', k: 'lit', market: 'xau', side: 'buy', entry: 4000, stop: 3996, t1: 4020, rr: 5, r0: 4, status: 'open', filled: T0 - 3600, opened: T0 - 3700, noBe: true, dec: 1 };
  const m5 = []; const px = [4001, 4003, 4002, 4001, 4004, 4006, 4005, 4004, 4007, 4009, 4008, 4007, 4010, 4011];
  for (let i = 0; i < px.length; i++) m5.push({ t: Math.floor((T0 - 3600) / 300) * 300 + 300 * (i + 1), o: px[i] - 0.5, h: px[i] + 0.5, l: px[i] - 1, c: px[i], open: px[i] - 0.5, high: px[i] + 0.5, low: px[i] - 1, close: px[i] });
  // whatever swingBreakEven decides on these candles, the record keeps its r0, so a stop at the entry books 0R
  swingBreakEven(L, m5); L.stop = 4000; L.beMoved = true;
  manageLive(L, bar(0, 4001, 4001.5, 3999.5, 4000));
  assert.equal(L.r0, 4); assert.equal(L.status, 'be'); assert.equal(L.R, 0);
  // every trades.push of a system whose stop is moved outside the loop carries r0 at the push (a test of the code's text)
  const trader = rd('council/trader.mjs');
  for (const [k, re] of [['gtrend legs', /k: LEG\.k, name: LEG\.name[\s\S]{0,400}?\br0, noBe/], ['gold trend add', /name: `\$\{LEG\.name\} add`[\s\S]{0,400}?r0: rA/], ['crypto trend', /name: 'Crypto trend'[\s\S]{0,400}?\br0, noBe/], ['crypto add', /name: 'Crypto trend add'[\s\S]{0,400}?r0: rA/]])
    assert.match(trader, re, `${k}: r0 at the push`);
  assert.match(rd('council/lit.mjs'), /status: 'pending', R: null, r0: \+f\(r0, dp\)/, 'LIT records carry r0');
});

test('pyramid add (addUnit) after the parent\'s stop moved: placed at +addAt of the OPENING risk', () => {
  const p = { id: 'xau-replica-1-b', market: 'xau', side: 'buy', entry: 4000, stop: 3990, t1: 4100, tp1: 4020, rr: 10, r0: 10, trail: [4, 1], beAt: 1, addAt: 1.5, status: 'open', filled: T0 - 60, opened: T0 - 60, noBe: true, dec: 2 };
  const out = []; for (const b of [bar(0, 4000, 4011, 3999, 4010), bar(1, 4010, 4016, 4009, 4015)]) { const r = manageLive(p, b, { feed: 'oanda' }); if (r && r.add) out.push(r.add); }
  assert.equal(p.beMoved, true); assert.equal(p.stop, 4000, 'break-even first (beAt 1)');
  assert.equal(out.length, 1); assert.equal(out[0].entry, 4015, '+1.5 x r0 10 (with |entry - stop| = 0 it would sit at the entry)'); assert.equal(out[0].r0, 15);
  // called alone on a parent whose stop moved and whose r0 was never stamped, addUnit cannot know the risk; manageLive always stamps first
  assert.equal(addUnit({ ...p, r0: undefined, addDone: false }, bar(2, 4015, 4015, 4015, 4015)), null, 'no add from a zero distance');
});

test('costs and financing divide by r0; the closed records that could take the |entry - stop| fallback after a move do not exist', () => {
  const t = { market: 'xau', side: 'buy', entry: 4000, stop: 4030, r0: 40, trailMoved: true, filled: T0 - 3 * 86400, closed: T0, status: 'win', R: 0.75, exitKind: 'stop', entryMode: 'market' };
  const f = financing(t); assert.ok(f.nights > 0);
  assert.equal(+f.finR.toFixed(6), +(f.nights * 0.000148 * 4000 / 40).toFixed(6), 'charged on the opening 40, not on |4000 - 4030|');
  const c = tradeCost(t, { group: 'Metals', spread: 0.3, dec: 2 }); assert.ok(c && c.costR > 0 && c.costR < 1);
  // the fallback: only a record with no r0. The live loop stamps r0 on every trade it manages; the NQ open run (research.json)
  // never reaches annotateCosts. Pinned: annotateCosts runs on trades.json only.
  assert.match(rd('council/trader.mjs'), /annotateCosts\(trades, MARKETS, model\)/); assert.doesNotMatch(rd('council/trader.mjs'), /annotateCosts\(research/);
  // replay rows (research/replay-2w.json) carry their OPENING stop (the replay keeps it); rowFinancing reads r0, else stop0, else stop
  const row = { market: 'xau', side: 'buy', entry: 4000, stop: 3960, filled: T0 - 3 * 86400, closed: T0 };
  assert.equal(rowFinancing(row).finR, financing({ ...row, r0: 40 }).finR);
});

test('the daily replay (backtest.mjs replayBar): exit variants move their own stop; tr.stop and tr.r0 never move, mfe stays in the opening R', () => {
  const tr = { m: 'xau', side: 'buy', entry: 100, stop: 90, t1: 130, rr: 3, r0: 10, opened: T0 - 60, filled: T0 - 60, status: 'open', mfe: 0,
    v: [{ n: 'none', stop: 90, beMoved: false, done: false, R: null, size: 1, booked: 0, best: 0 }, { n: 'be1', be: 1, stop: 90, beMoved: false, done: false, R: null, size: 1, booked: 0, best: 0 }] };
  for (const b of [bar(0, 100, 112, 100, 111), bar(1, 111, 125, 110, 124), bar(2, 124, 124, 99, 99.5)]) replayBar(tr, b);
  assert.equal(tr.stop, 90); assert.equal(tr.r0, 10); assert.equal(tr.mfe, 2.5);
  assert.equal(tr.v[1].R, 0, 'break-even variant out at 0R'); assert.equal(tr.v[0].done, false);
});

test('openRisk: r0, else the unmoved stop, else stop0, else (NQ open run) half the 2R mark; three copies agree', () => {
  const cases = [
    [{ entry: 100, stop: 90, r0: 10, trailMoved: true }, 10],
    [{ entry: 100, stop: 90 }, 10],
    [{ entry: 100, stop: 95, stop0: 94 }, 5, 'a replica row: stop0 is the level before the round-number step, stop is the opening stop'],
    [{ entry: 100, stop: 114, stop0: 90, trailMoved: true }, 10],
    [{ k: 'nq-open', side: 'buy', entry: 100, stop: 114, tp1: 120, trailMoved: true }, 10],
    [{ k: 'nq-open', side: 'sell', entry: 100, stop: 86, tp1: 80, trailMoved: true }, 10],
    [{ k: 'gtrend', entry: 100, stop: 114, trailMoved: true }, null, 'moved, nothing on file: unknown'],
    [{ entry: 100, stop: 100, beMoved: true }, null],
    [{ entry: 100, stop: 100 }, null],
    [null, null],
  ];
  const html = rd('market-structure.html'), line = /^ {2}const risk0 = .*$/m.exec(html);
  assert.ok(line, 'the page helper'); const risk0 = new Function(`${line[0]}; return risk0;`)();
  for (const [x, want, why] of cases) {
    assert.equal(openRisk(x), want, why || JSON.stringify(x)); assert.equal(EA.openRisk(x), want, 'edge analyst copy'); assert.equal(risk0(x), want, 'page copy');
  }
});

test('edge analyst: an NQ open-run entry first studied after its trail moved is shown the stop it OPENED with', () => {
  const x = { id: 'nq-nyflip-2026-11-16', k: 'nq-open', session: 'nyflip', market: 'nq', side: 'buy', entry: 25000, stop: 25040, tp1: 25100, t1: 25500, rr: 10, trail: [2, 1], trailMoved: true, mfe: 3, status: 'open', opened: T0 - 3600, filled: T0 - 3600, dec: 2 };
  assert.equal(EA.stopAtEntry(x), 24950, 'it read the trailed 25040 (above the entry) as the stop it opened with');
  assert.equal(EA.entryFacts(x).riskPoints, 50);
  assert.equal(EA.candidates([], [x], [], T0, 0).length, 1);
  // moved, no r0 / stop0 / 2R mark: the opening stop is not known, so the trade is not studied rather than shown a wrong stop
  assert.equal(EA.candidates([{ ...x, id: 'xau-gtrend-x', k: 'gtrend', market: 'xau', session: undefined, tp1: undefined }], [], [], T0, 0).length, 0);
  // unchanged where the stop never moved or r0 is stamped
  assert.equal(EA.stopAtEntry({ ...x, trailMoved: false, stop: 24950 }), 24950);
  assert.equal(EA.stopAtEntry({ k: 'gtrend', side: 'buy', entry: 4000, stop: 4030, r0: 40, trailMoved: true }), 3960);
});

test('digest: floating R of an open NQ open run after its trail moved is in the opening R', () => {
  const nq = { id: 'nq-nyflip-2026-11-16', k: 'nq-open', session: 'nyflip', market: 'nq', label: 'NQ', name: 'NQ New York open run', side: 'buy', entry: 25000, stop: 25040, tp1: 25100, trail: [2, 1], trailMoved: true, status: 'open' };
  const D = { trades: [], research: [nq], snapshot: { markets: { nq: { price: 25150 } } }, ictTrades: [], ictSnap: null };
  assert.equal(openPositions(D)[0].R, 3, '+150 on a 50-point risk (it read +3.75 on |25000 - 25040|)');
  const g = { id: 'xau-gtrend-1', k: 'gtrend', market: 'xau', label: 'XAU/USD', side: 'buy', entry: 4000, stop: 4000, beMoved: true, status: 'open' };
  assert.equal(openPositions({ ...D, research: [], trades: [g], snapshot: { markets: { xau: { price: 4040 } } } })[0].R, null, 'unknown risk: no figure (it divided by zero)');
});

test('reconciliation: an ICT copy whose trail moved past the entry is not called "on the wrong side" (record without stop0)', () => {
  const os = require('node:os'), path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-msa-'));
  const w = (f, v) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), JSON.stringify(v)); };
  const groups = [{ account: '1', books: ['council'], file: 'mirror.json' }, { account: '4', books: ['ict'], file: 'mirror-4.json' }];
  w('ctrader/mirror-accounts.json', { groups }); w('ctrader/mirror.json', { state: {} });
  // the desk's buy from 25000 (r0 50), trailed to 25030; the copy filled at 21000.5 on the cash index and the mirror moved its stop by +80
  w('ict/trades.json', [{ id: 'nq-b-1', market: 'nq', side: 'buy', entry: 25000, stop: 25030, r0: 50, trailMoved: true, t1: null, status: 'open', opened: 100, aset: true }]);
  w('ctrader/mirror-4.json', { state: { map: { 'ict:nq-b-1': { positionId: '7', status: 'open', digits: 2, stop: 25030, fillPrice: 21000.5, amended: 1 } } } });
  w('ctrader/accounts.json', { at: 'now', accounts: [{ label: 'Council', books: ['council'], open: [], orders: [], history: [] }, { label: 'ICT', books: ['ict'], open: [{ id: '7', symbol: 'NAS100', side: 'buy', entry: 21000.5, sl: 21030.5, tp: null }], orders: [], history: [] }] });
  for (const f of ['trades.json', 'research.json']) w(f, []); w('config.json', {});
  const r = reconcile(dir), row = r.rows.find((x) => x.id === 'ict:nq-b-1');
  assert.ok(row); assert.deepEqual(row.issues, [], 'before: "the stop is on the wrong side of the entry" and a stop distance mismatch');
});

test('Trader text: every stop assignment is in a loop that reads a stamped r0, except the NQ open run (item 49); the research loops never move a stop', () => {
  const src = rd('council/trader.mjs');
  const moves = [...src.matchAll(/\b(\w+)\.stop = /g)].map((m) => m[1]);
  // tr (generic loop: trail, Coach break-even, beAt), open + gAdd (gold trend ratchet), open (crypto trend midpoint ratchet), r (NQ open run)
  assert.deepEqual(moves.sort(), ['gAdd', 'open', 'open', 'r', 'tr', 'tr', 'tr'].sort(), 'a new stop move: audit its R / mfe / trail unit, then add it here');
  const gen = src.indexOf('// ─── Manage open trades on this market'), stamp = src.indexOf('const r0 = tr.r0 || (tr.r0 = Math.abs(E - tr.stop));', gen), trail = src.indexOf('if (tr.trail && tr.mfe >= tr.trail[0])', gen);
  assert.ok(gen > 0 && stamp > gen && trail > stamp, 'the generic loop stamps r0 before it can move the stop');
  // the two research loops (replica, other research rows) re-derive |entry - stop| each run but contain no stop move
  for (const head of ["for (const r of research.filter((x) => x.market === key && x.k === 'replica'", "for (const r of research.filter((x) => x.market === key && x.k !== 'replica' && x.status === 'open'))"]) {
    const a = src.indexOf(head), z = src.indexOf('r.checked = bars.at(-1).time;', a); assert.ok(a > 0 && z > a, head);
    assert.doesNotMatch(src.slice(a, z), /r\.stop = |trailMoved|beMoved/, 'no stop move inside');
  }
  // the NQ open run: the defect of item 49, still as found (a fix there is the owner's decision; tests/nq-open-r0 on its branch)
  assert.match(src, /for \(const r of openNq\) \{\n {6}const s = r\.side === 'sell', r0 = Math\.abs\(r\.entry - r\.stop\);/);
});

test('page: the floating / live R figures read the opening risk (risk0), never |entry - stop| of a moved stop', () => {
  const html = rd('market-structure.html');
  assert.match(html, /const s = x\.side === 'sell' \? -1 : 1, r0 = risk0\(x\), size = x\.size \|\| 1, px = nowPrice\(x\)/, 'Active trades floating R');
  assert.match(html, /R = risk0\(x\), rr = tgt != null && R \? Math\.abs\(tgt - x\.entry\) \/ R : null;/, 'guest gold trade card');
  assert.match(html, /const r0 = risk0\(x\), r = r0 \? \(m\.price - x\.entry\)/, 'trade table liveR');
  assert.match(html, /r = risk0\(x\), live = x\.status === 'open' && price && r \?/, '"R now" on the chart list');
});

test('exitR is the one formula: (exit - entry) / r0 with the r0 handed in', () => {
  assert.equal(exitR(false, 100, 120, 10), 2); assert.equal(exitR(true, 100, 86, 10), 1.4);
});

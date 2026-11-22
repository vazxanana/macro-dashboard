// node --test tests/academy-examples.test.mjs — the Academy's "Desk examples" section (22 Nov 2026): the owner's notes and
// drawings on the desks' example trades. The API routes (api/academy.js `example-notes` / `example.note`) on an in-memory
// store with a fake session, the page asset's pure pieces (assets/academy-examples.js) and the wiring. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handle, _t } = require('../api/academy.js');
const ST = require('../api/_academy-store.js');
const MXAX = require('../assets/academy-examples.js');
const BT = require('../assets/backtest-engine.js');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const OWNER = { u: 'owner' }, FRED = { u: 'fred', role: 'reviewer' }, KEY = 'examples/notes.json';
function mk(extra = {}) {
  const store = ST.memoryStore(); let clock = Date.UTC(2026, 10, 22, 12);
  return { store, deps: { env: {}, store, who: async () => OWNER, sameOrigin: () => true, data: { edges: async () => [], candidates: async () => null, outcomes: async () => null }, now: () => (clock += 1000), ...extra } };
}
async function call(ctx, method, payload, extra = {}) {
  const out = { headers: {} }, res = { setHeader: (k, v) => { out.headers[k] = v; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } };
  await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, { ...ctx.deps, ...extra });
  return out;
}
const get = (ctx, extra) => call(ctx, 'GET', { get: 'example-notes' }, extra), post = (ctx, b, extra) => call(ctx, 'POST', { action: 'example.note', ...b }, extra);
const T0 = 1795000000, ID = 'xau:sop-m15-b1795000000';
const DRAW = [{ type: 't', t1: T0, p1: 4010.2, t2: T0 + 3600, p2: 4013 }, { type: 'h', price: 4011.5, col: 'gold' }, { type: 'r', t1: T0, p1: 4015, t2: T0 + 1800, p2: 4012, ls: 'dash' }, { type: 'a', t1: T0, p1: 4009, t2: T0 + 900, p2: 4011, w: 3 }, { type: 'x', t1: T0 + 600, p1: 4014, text: 'wait for the retest', col: 'dn' }];

// ==== the API ================================================================================================================
test('example notes: only the owner reads or writes, a POST from another site is refused, and nothing is written by a refused call', async () => {
  const c = mk();
  for (const [who, code] of [[null, 401], [FRED, 403]]) { assert.equal((await get(c, { who: async () => who })).code, code); assert.equal((await post(c, { id: ID, text: 'x' }, { who: async () => who })).code, code); }
  assert.equal((await post(c, { id: ID, text: 'x' }, { sameOrigin: () => false })).code, 403);
  assert.deepEqual(c.store.keys(), []);
  const g = await get(c); assert.equal(g.code, 200); assert.deepEqual(g.body, { notes: {} }); assert.equal(g.headers['Cache-Control'], 'private, no-store');
});

test('example notes: a note round-trips (words, quick verdict, the five shapes), is replaced as a whole, and an empty one removes it; every write has its audit row', async () => {
  const c = mk();
  const r = await post(c, { id: ID, text: '  Wait for the pullback into the zone.\nThen sell.  ', chips: ['entry-early', 'stop-wrong', 'entry-early'], draw: DRAW });
  assert.equal(r.code, 200); assert.equal(r.body.ok, true); assert.equal(r.body.count, 1);
  const n = (await get(c)).body.notes[ID];
  assert.equal(n.text, 'Wait for the pullback into the zone.\nThen sell.', 'trimmed, a line break kept'); assert.deepEqual(n.chips, ['entry-early', 'stop-wrong'], 'a chip once');
  assert.deepEqual(n.draw, DRAW, 'the shapes as sent: points are [UTC seconds, price]'); assert.match(n.at, /^2026-11-22T/);
  assert.deepEqual(Object.keys(c.store.peek(KEY)).sort(), ['notes', 'v']); assert.deepEqual(c.store.keys().sort(), ['audit/2026-11.json', KEY]);
  // a second note, then the first replaced as a whole (its drawings go when they are not sent again)
  await post(c, { id: 'eurusd:eg3-4h-s1795003600', text: 'Wrong side.', chips: ['wrong-side'] });
  await post(c, { id: ID, text: 'Only the level matters.', draw: [DRAW[1]] });
  let all = (await get(c)).body.notes; assert.equal(Object.keys(all).length, 2); assert.equal(all[ID].text, 'Only the level matters.'); assert.deepEqual(all[ID].chips, []); assert.deepEqual(all[ID].draw, [DRAW[1]]);
  // nothing written, ticked or drawn: the note is removed
  const gone = await post(c, { id: ID, text: '   ', chips: [], draw: [] }); assert.equal(gone.code, 200); assert.equal(gone.body.note, null); assert.equal(gone.body.count, 1);
  all = (await get(c)).body.notes; assert.deepEqual(Object.keys(all), ['eurusd:eg3-4h-s1795003600']);
  const rows = (await call(c, 'GET', { get: 'audit', month: '2026-11' })).body.rows.filter((x) => x.action === 'example.note');
  assert.equal(rows.length, 4); assert.deepEqual(rows[0].ids, [ID]); assert.equal(rows[0].summary, 'note removed'); assert.match(rows[3].summary, /47 characters, 2 chips, 5 shapes/);
  assert.equal(rows[0].who, 'owner');
});

test('example notes: every field is checked, a shape is rebuilt field by field, and a refused note writes nothing', async () => {
  const c = mk(), bad = async (b, what) => { const r = await post(c, b); assert.equal(r.code, 400, `${what}: ${JSON.stringify(r.body)}`); assert.deepEqual(Object.keys(r.body), ['error']); };
  for (const id of [undefined, '', 'XAU:sop', 'a b', '../x', 'x'.repeat(81), '-x', 42, { a: 1 }, 'xau/sop']) await bad({ id, text: 'x' }, `id ${JSON.stringify(id)}`);
  await bad({ id: ID, text: 'x'.repeat(2001) }, 'a text over 2,000 characters'); await bad({ id: ID, text: { a: 1 } }, 'a text that is not text');
  await bad({ id: ID, chips: ['take-more-risk'] }, 'an unknown chip'); await bad({ id: ID, chips: 'entry-early' }, 'chips that are not a list'); await bad({ id: ID, chips: new Array(8).fill('entry-early') }, 'too many chips');
  await bad({ id: ID, draw: new Array(61).fill(DRAW[1]) }, '61 shapes'); await bad({ id: ID, draw: 'line' }, 'a drawing that is not a list'); await bad({ id: ID, draw: [null] }, 'a shape that is not an object');
  for (const [d, what] of [[{ type: 'f', t1: T0, p1: 1, t2: T0, p2: 2 }, 'a shape type the section does not offer'], [{ type: 't', t1: T0, p1: 1, t2: T0 }, 'a missing point'], [{ type: 't', t1: T0, p1: '4010', t2: T0, p2: 1 }, 'a price that is text'],
    [{ type: 'h', price: Infinity }, 'a price that is not finite'], [{ type: 'h', price: 1e12 }, 'a price out of range'], [{ type: 'r', t1: -5, p1: 1, t2: T0, p2: 2 }, 'a time before 1970'], [{ type: 'a', t1: T0, p1: 1, t2: 1e12, p2: 2 }, 'a time in milliseconds'],
    [{ type: 'x', t1: T0, p1: 1 }, 'a text with no words'], [{ type: 'x', t1: T0, p1: 1, text: '   ' }, 'a text of spaces'], [{ type: 'x', t1: T0, p1: 1, text: 'x'.repeat(121) }, 'a text over 120 characters'],
    [{ type: 'h', price: 1, col: 'pink' }, 'an unknown colour'], [{ type: 'h', price: 1, w: 9 }, 'an unknown width'], [{ type: 'h', price: 1, ls: 'dotted' }, 'an unknown line style']]) await bad({ id: ID, draw: [d] }, what);
  assert.deepEqual(c.store.keys(), [], 'nothing was written');
  // what is kept of a shape: its type, its points, its words, colour, width and dash. Anything else is dropped.
  const r = await post(c, { id: ID, draw: [{ type: 'x', t1: T0 + 0.4, p1: 4014, text: ' two\n lines\t here ', col: 'draw', w: 1, ls: '', lock: true, at: 5, html: '<b>x</b>', __proto__: { evil: 1 } }, { type: 'h', price: 4000, t1: T0, extra: { deep: [1, 2] } }] });
  assert.equal(r.code, 200); assert.deepEqual(r.body.note.draw, [{ type: 'x', t1: T0, p1: 4014, text: 'two lines here' }, { type: 'h', price: 4000 }]);
  assert.deepEqual(_t.EX_CHIPS, MXAX.CHIPS.map((x) => x[0]), 'the page offers exactly the chips the server takes');
});

test('example notes: a failed read never looks empty and never overwrites, a file that is not a notes file is left alone, and 400 notes is the limit', async () => {
  const c = mk(); await post(c, { id: ID, text: 'kept' }); const before = JSON.stringify(c.store.peek(KEY));
  const real = c.store.backend.read; c.store.backend.read = async () => { throw new Error('blob read 500'); };
  const g = await get(c); assert.equal(g.code, 503); assert.deepEqual(g.body, { error: 'the Academy store is unavailable: nothing was saved' });
  const p = await post(c, { id: 'xau:other', text: 'would wipe the first' }); assert.equal(p.code, 503);
  c.store.backend.read = real; assert.equal(JSON.stringify(c.store.peek(KEY)), before, 'the stored note is intact');
  // a failed write: 503, the earlier state stays, and the same call works once the store does
  const w = c.store.backend.write; c.store.backend.write = async () => { throw new Error('blob write 500'); };
  assert.equal((await post(c, { id: 'xau:other', text: 'x' })).code, 503); c.store.backend.write = w; assert.equal(JSON.stringify(c.store.peek(KEY)), before);
  assert.equal((await post(c, { id: 'xau:other', text: 'x' })).code, 200);
  // a stored file of another shape (corrupt, or a row file): 503 on read and on write, and it is not replaced
  for (const junk of [[1, 2], { v: 1, rows: [] }, 'text', 7]) {
    const s = ST.memoryStore({ [KEY]: junk }), d = mk({ store: s });
    assert.equal((await get(d)).code, 503, JSON.stringify(junk)); assert.equal((await post(d, { id: ID, text: 'x' })).code, 503); assert.deepEqual(s.peek(KEY), junk);
  }
  // the limit: the 401st example is refused in words, a note already stored can still be changed or removed
  const notes = {}; for (let i = 0; i < _t.EX_MAX; i++) notes['xau:n' + i] = { text: 'n', chips: [], draw: [], at: '2026-11-22T00:00:00.000Z' };
  const full = mk({ store: ST.memoryStore({ [KEY]: { v: 1, notes } }) });
  const over = await post(full, { id: 'xau:one-more', text: 'x' }); assert.equal(over.code, 409); assert.match(over.body.error, /400 notes at most/);
  assert.equal((await post(full, { id: 'xau:n7', text: 'changed' })).code, 200); assert.equal((await post(full, { id: 'xau:n8' })).body.count, 399); assert.equal((await post(full, { id: 'xau:one-more', text: 'x' })).code, 200);
});

// ==== the page's pure pieces =================================================================================================
const EX = { id: ID, market: 'xau', side: -1, label: 'H4 BO \u2192 H1 VR \u2192 M30 CF', kind: 'sop', h: '1h', l: '30m', t: T0, entry: 4012.3, stop: 4015.5, target: 4005.9, status: 'target', R: 2, endT: T0 + 5400, exit: 4005.9, outcome: 'win',
  log: [{ t: T0 - 7200, text: 'H4 BO sell.' }, { t: T0, text: 'Entry on the EG.' }, { t: T0 + 5400, text: 'Target reached.' }],
  marks: [{ kind: 'zone', a: T0 - 9000, at: T0 - 8000, label: 'M30 CF zone', top: 4014, bot: 4012 }, { kind: 'level', a: T0 - 20000, at: T0 - 20000, label: 'H4 BO level', p: 4020 }, { kind: 'level', a: T0 + 60, at: T0 + 900, label: 'known later', p: 4001 }, { kind: 'zone', a: T0, label: 'broken', top: 1 }] };
const FILE = { v: 1, at: '2026-11-22T10:00:00Z', note: 'Picked examples.', groups: [{ k: 'mosha-seq-eg', desk: 'mosha', title: 'BO, VR, CF: entry on the EG', examples: [EX, { ...EX, id: 'gbpusd:sop-m15-b1', market: 'gbpusd', side: 1, entry: 1.3012, stop: 1.2999, target: null, R: -1, outcome: 'loss', status: 'stopped', exit: 1.2999 }, { id: 'no-stop', market: 'xau', t: T0, entry: 1 }, null] },
  { k: 'eg-1h', desk: 'eg', title: 'Engulf rule on H1', examples: [{ ...EX, id: 'xau:eg-1h-s2' }] }, { k: 'empty', desk: 'eg', title: 'nothing usable', examples: [] }, { title: 'no key', examples: [EX] }] };

test('examples file: only usable examples are kept (an id, a market, an entry time and price, a stop), and a missing part never throws', () => {
  const f = MXAX.cleanFile(FILE); assert.deepEqual(f.groups.map((g) => [g.k, g.desk, g.examples.length]), [['mosha-seq-eg', 'mosha', 2], ['eg-1h', 'eg', 1]]);
  for (const junk of [null, undefined, 7, 'x', {}, { groups: 'no' }, { groups: [null, 5, { k: 'a' }] }]) assert.deepEqual(MXAX.cleanFile(junk).groups, []);
  assert.equal(MXAX.findExample(f, 'xau:eg-1h-s2').group.k, 'eg-1h'); assert.equal(MXAX.findExample(f, 'nope'), null);
});

test('chart window: the entry is always inside, a window stays under the candle limit, "Before" holds only candles closed at the entry, and marks appear only once known', () => {
  for (const [tf, sec] of MXAX.TFS.map((t) => [t[0], t[1]])) {
    const w = MXAX.windowFor(EX, tf); assert.equal(w.sec, sec); assert.ok(w.from < EX.t && w.to > EX.endT, tf); assert.equal(w.from % sec, 0); assert.ok((w.to - w.from) / sec <= MXAX.MAX_BARS, tf);
    assert.equal(Math.floor(EX.t / sec) * sec - w.from, MXAX.PRE[tf] * sec, `${tf}: the candles before the entry`); assert.equal(w.cut, false);
  }
  // a trade of twenty days does not fit an M1 or an M5 window: the window is cut at the end, and the chart opens on the first timeframe that holds it
  const long = { ...EX, endT: EX.t + 20 * 86400 }; assert.equal(MXAX.windowFor(long, '1m').cut, true); assert.equal(MXAX.windowFor(long, '5m').cut, true); assert.equal(MXAX.windowFor(long, '15m').cut, false);
  assert.ok(MXAX.windowFor(long, '1m').from < long.t && MXAX.windowFor(long, '1m').to > long.t); assert.equal(MXAX.defaultTf(long), '15m'); assert.equal(MXAX.defaultTf(EX), '5m');
  assert.equal(MXAX.defaultTf({ ...EX, endT: undefined }), '5m', 'no end time on the record: the entry alone');
  const bars = [0, 300, 600, 900].map((d) => ({ time: T0 - 900 + d })); assert.deepEqual(MXAX.cutBefore(bars, 300, T0).map((b) => b.time), [T0 - 900, T0 - 600, T0 - 300], 'the candle that opens at the entry is not closed yet');
  assert.deepEqual(MXAX.cutBefore(bars, 300, T0 + 299).length, 3); assert.deepEqual(MXAX.cutBefore(null, 300, T0), []);
  assert.deepEqual(MXAX.marksAt(EX.marks, null).map((m) => m.label), ['M30 CF zone', 'H4 BO level', 'known later'], 'a mark without its prices is dropped');
  assert.deepEqual(MXAX.marksAt(EX.marks, EX.t).map((m) => m.label), ['M30 CF zone', 'H4 BO level'], 'Before: nothing known after the entry'); assert.deepEqual(MXAX.marksAt(undefined, 5), []);
  assert.deepEqual(['M5 EF (zone failed)', 'M15 EG zone · entry', 'M30 CF zone', 'M5 VR', '50% of the range', 'Daily V level', 'H4 A level · BO buy', 'something'].map(MXAX.hueKey), ['ef', 'entry', 'cf', 'vr', 'half', 'd1', 'h4', null]);
  for (const k of ['ef', 'entry', 'cf', 'vr', 'half', 'd1', 'h4', 'h1', 'm30', 'm15', 'm5', 'm1', 'bo']) assert.equal(MXAX.HUES[k].length, 2, k + ': a colour for light and for dark');
});

test('drawings: the page sends exactly what the server keeps, the shapes are ones the chart engine draws, and a broken shape is dropped, not sent', async () => {
  const dirty = DRAW.concat([{ type: 'f', t1: T0, p1: 1, t2: T0, p2: 2 }, { type: 't', t1: T0, p1: NaN, t2: T0, p2: 2 }, { type: 'x', t1: T0, p1: 1, text: '  ' }, null, { type: 'h', price: 4000, col: 'pink', w: 7, ls: 'dotted', lock: true }, { type: 'x', t1: T0 + 0.6, p1: 2, text: 'a\nb' }]);
  const clean = MXAX.cleanDraw(dirty); assert.deepEqual(clean, DRAW.concat([{ type: 'h', price: 4000 }, { type: 'x', t1: T0 + 1, p1: 2, text: 'a b' }]));
  assert.equal(MXAX.cleanDraw(new Array(80).fill(DRAW[1])).length, MXAX.SHAPE_MAX); assert.deepEqual(MXAX.cleanDraw('x'), []);
  const c = mk(), r = await post(c, { id: ID, draw: clean }); assert.equal(r.code, 200); assert.deepEqual(r.body.note.draw, clean, 'the server stores it unchanged');
  assert.equal(BT.drawNorm(clean).length, clean.length, 'every shape is one the engine knows');
  // the engine places each of them, and a move or a resize keeps a shape the server still takes
  const X = (t) => (t - T0) / 60, Y = (p) => (4020 - p) * 10;
  for (const d of clean) { const g = BT.drawGeom(d, X, Y, 800, 400); assert.ok(g && g.pts.length >= 1, d.type); const m = BT.drawMove(d, (t) => t + 300, (p) => p + 1); assert.deepEqual(MXAX.cleanDraw([m]).length, 1); }
  assert.deepEqual(MXAX.cleanDraw([BT.drawResize(DRAW[2], 'c22', T0 + 7200, 4000)])[0], { type: 'r', t1: T0, p1: 4015, t2: T0 + 7200, p2: 4000, ls: 'dash' });
});

test('notes in words: one example and all of them as plain text for the assistant, with each drawing as its kind, its [UTC time, price] points and its text', () => {
  const f = MXAX.cleanFile(FILE), g = f.groups[0], note = { text: 'Wait for the retest of the level.', chips: ['entry-early', 'target-wrong'], draw: DRAW, at: '2026-11-22T12:00:00.000Z' };
  const t = MXAX.noteText(g, EX, note).split('\n');
  assert.equal(t[0], 'Desk example ' + ID); assert.equal(t[1], 'Reading: BO, VR, CF: entry on the EG (Mosha desk) · H4 BO \u2192 H1 VR \u2192 M30 CF');
  assert.equal(t[2], 'Trade: Sell XAU/USD, entry 4012.30 at 2026-11-18 13:46 UTC, stop 4015.50, target 4005.90'.replace('2026-11-18 13:46 UTC', MXAX.fmtT(T0)));
  assert.equal(t[3], `Result: Win, +2.00R (target reached at 4005.90, ${MXAX.fmtT(T0 + 5400)})`); assert.equal(t[4], 'Quick verdict: Entry too early; Target wrong');
  assert.deepEqual(t.slice(5, 8), ['What should have been done:', 'Wait for the retest of the level.', 'Drawings on the chart (times in UTC, then the price):']);
  assert.equal(t[8], `1. Trend line from [${MXAX.fmtT(T0)}, 4010.20] to [${MXAX.fmtT(T0 + 3600)}, 4013.00]`); assert.equal(t[9], '2. Level (amber) at 4011.50');
  assert.equal(t[10], `3. Box from [${MXAX.fmtT(T0)}, 4015.00] to [${MXAX.fmtT(T0 + 1800)}, 4012.00]`); assert.match(t[11], /^4\. Arrow from \[/); assert.equal(t[12], `5. Text (red) "wait for the retest" at [${MXAX.fmtT(T0 + 600)}, 4014.00]`);
  assert.match(MXAX.fmtT(T0), /^\d{4}-\d\d-\d\d \d\d:\d\d UTC$/);
  // a loss on a five-decimal market, nothing written: said plainly, never a made-up line
  const loss = MXAX.noteText(g, g.examples[1], null); assert.match(loss, /Trade: Buy GBP\/USD, entry 1\.30120 at .*, stop 1\.29990, target none/); assert.match(loss, /Result: Loss, \u22121\.00R \(stopped at 1\.29990/); assert.match(loss, /Quick verdict: none\nWhat should have been done:\n\(nothing written\)\nDrawings on the chart: none$/);
  // all of them: only examples with a note, in the file's order; a note whose example left the file is still handed over
  const notes = { 'xau:eg-1h-s2': { text: 'second', chips: [], draw: [] }, [ID]: note, 'gbpusd:sop-m15-b1': { text: '  ', chips: [], draw: [] }, 'xau:gone': { text: 'orphan', chips: [], draw: [DRAW[1]] } };
  const all = MXAX.allNotesText(f, notes); assert.match(all, /^3 desk examples with my notes\n\n/); assert.ok(all.indexOf(ID) < all.indexOf('xau:eg-1h-s2') && all.indexOf('xau:eg-1h-s2') < all.indexOf('xau:gone')); assert.ok(!all.includes('gbpusd'), 'an empty note is not one');
  assert.match(all, /Desk example xau:gone \(no longer in the examples file\)\nWhat should have been done:\norphan\nDrawings: 1/); assert.equal(MXAX.allNotesText(f, {}), ''); assert.equal(MXAX.countNotes(f, notes), 2);
  assert.equal(MXAX.hasNote({ text: ' ', chips: [], draw: [] }), false); assert.equal(MXAX.hasNote({ draw: [DRAW[0]] }), true); assert.equal(MXAX.hasNote(null), false);
  assert.equal(MXAX.sameNote({ text: 'a ', chips: ['stop-wrong', 'entry-late'], draw: DRAW }, { text: 'a', chips: ['entry-late', 'stop-wrong'], draw: DRAW.map((d) => ({ ...d })), at: 'x' }), true); assert.equal(MXAX.sameNote({ text: 'a' }, { text: 'b' }), false); assert.equal(MXAX.sameNote(null, undefined), true);
  for (const s of [0, 401, 403, 429, 409, 500, 503, undefined]) { const m = MXAX.saveFailure({ status: s, message: '400 notes at most: clear one you no longer need first' }); assert.match(m, /^Not saved: /); assert.match(m, /Nothing was lost: your note and drawings are still on this page\.$/); }
  assert.match(MXAX.saveFailure({ status: 409, message: '400 notes at most' }), /400 notes at most/); assert.ok(!/400 notes/.test(MXAX.saveFailure({ status: 500, message: 'boom at /var/x.js' })), 'a server fault is not quoted');
});

// ==== wiring =================================================================================================================
test('wiring: the section is its own script after the others it builds on, sits after the Blind arena, keeps nothing in the browser and talks only to its own routes', () => {
  const html = src('academy.html'), js = src('assets/academy-examples.js'), ui = src('assets/academy-ui.js'), css = src('assets/academy.css'), MXAC = require('../assets/academy-ui.js');
  assert.ok(html.indexOf('/assets/academy-examples.js') > html.indexOf('/assets/academy-tabs.js') && html.indexOf('/assets/academy-examples.js') > html.indexOf('/assets/backtest-engine.js'));
  assert.match(html, /<section id="ac-examples" role="tabpanel" aria-labelledby="tab-examples" tabindex="-1" hidden><\/section>/);
  assert.match(js, /MXAC\.registerTab\('examples', \{ title: 'Desk examples', render \}\);/); const ids = MXAC.TABS.map((t) => t[0]); assert.equal(ids[ids.indexOf('blind') + 1], 'examples');
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(js), 'no browser storage: a note lives on the server'); assert.match(ui, /const PREFS = \['mxacEdge', 'mxacFold', 'ms-phone'\];/, 'the storage allowlist did not grow');
  assert.ok(!/\b(alert|confirm|prompt)\s*\(/.test(js), 'no native dialog'); assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(js), 'no outside address');
  assert.deepEqual([...new Set([...js.matchAll(/['"`](\/(?:api|md|cdata)\/[a-z/.-]+)/g)].map((m) => m[1]))], ['/cdata/academy/desk-examples.json'], 'one file read by itself; the candles come through the replay loader and the notes through the paced wrapper');
  assert.equal((js.match(/\bfetch\s*\(/g) || []).length, 1); assert.match(js, /fetch\(FILE, \{ credentials: 'same-origin', cache: 'no-store' \}\)/);
  assert.deepEqual([...js.matchAll(/action: '([a-z.]+)'/g)].map((m) => m[1]), ['example.note'], 'one write, the note'); assert.deepEqual([...js.matchAll(/get: '([a-z-]+)'/g)].map((m) => m[1]), ['example-notes']);
  assert.match(js, /K\.leaveGuard\(\{ unsaved: dirty,/); assert.match(js, /K\.watchUnsaved\(dirty\);/);
  // the engine's own drawing helpers place, hit, move and resize: no second geometry
  for (const fn of ['drawGeom', 'drawHit', 'drawResize', 'drawMove', 'tfLogical', 'tfTimeAt']) assert.match(js, new RegExp('BT\\(\\)\\.' + fn + '\\('), fn);
  // the styles: one labelled block before the phone's simple view (which still closes the file), tokens only, nothing under 12 px
  const a = css.indexOf('/* ==== Desk examples (22 Nov 2026'), b = css.indexOf('/* ==== The phone\'s simple view'); assert.ok(a > 0 && a < b); const block = css.slice(a, b);
  assert.ok(!/#[0-9a-f]{3,8}\b(?![^(]*\))/i.test(block.replace(/url\("[^"]*"\)/g, '')), 'no literal colour'); assert.ok(!/font(-size)?:[^;]*(?<![\d.])(1[01]|\d)(\.\d+)?px/.test(block), 'no text under 12 px'); assert.ok(!/animation|infinite|data-phone/.test(block));
  assert.match(block, /@media \(pointer: coarse\) \{[^]*min-height: 44px/); assert.match(css, /html\[data-phone="simple"\] \.ac-tabs #tab-examples \{ order: 1; grid-column: 1 \/ -1;/, 'on the phone it is one tap away, on a row of its own');
  // the assistant connector was not widened, and the API module still loads nothing new
  assert.ok(!/example/i.test(src('api/academy-mcp.js')) && !/example/i.test(src('api/_academy-connector.js')));
  assert.ok(src('api/academy.js').slice(0, 4000).includes('example-notes') && src('api/academy.js').slice(0, 4000).includes('example.note'));
  // the audit's dev server has no examples: it answers that one file empty, so the tab opens there on its empty state
  assert.match(src('scripts/academy-dev.mjs'), /url\.pathname === '\/cdata\/academy\/desk-examples\.json'\) return json\(res, 200, \{ v: 1, at: null, note: '', groups: \[\] \}\);/);
});

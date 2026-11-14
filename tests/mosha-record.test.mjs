// node --test tests/mosha-record.test.mjs: Luxus's record on the Mosha desk (owner, 14 Nov 2026: "Ask Luxus and log his trades";
// assets/mosha-record.js). The counting rules, the stop-first rule on our candles, the verdict thresholds and who sees the card. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../assets/mosha-record.js'), D = require('../assets/mosha-desk.js');
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PAGE = rd('../market-structure.html'), JS = rd('../assets/mosha-record.js'), TJ = rd('../assets/mosha-teach.js'), API = rd('../api/mosha.js');

const T0 = Date.UTC(2026, 10, 13, 8, 0, 0) / 1000;
const iso = (s) => new Date(s * 1000).toISOString();
const SELL = { market: 'xau', side: 'sell', at: T0, entry: 4100, stop: 4110, target: 4070 };
const lesson = (o = {}, trade = SELL) => ({ id: 'l' + Math.random().toString(36).slice(2, 8), by: 'luxus', at: iso(T0 - 600), title: 'sell', trade, ...o });
// 5-minute candles from T0, each { open, high, low, close } given as [h, l]
const bars = (hl) => hl.map(([h, l], i) => ({ time: T0 + i * 300, open: (h + l) / 2, high: h, low: l, close: (h + l) / 2 }));

test('counting: replay trades, no stop, a stop on the wrong side, no target, another author are left out', () => {
  assert.equal(R.eligible(lesson()).ok, true);
  assert.match(R.eligible(lesson({}, { ...SELL, src: 'replay' })).why, /replay/);
  assert.equal(R.eligible(lesson({}, { ...SELL, stop: null })).ok, false);
  assert.match(R.eligible(lesson({}, { ...SELL, stop: 4090 })).why, /losing side/);
  assert.match(R.eligible(lesson({}, { ...SELL, target: null })).why, /target/);
  assert.equal(R.eligible(lesson({}, null)).ok, false);
  assert.equal(R.eligible(lesson({ by: 'owner' })).ok, false, 'the owner does not teach: not his record');
  const s = R.sort([lesson(), lesson({}, { ...SELL, src: 'replay' }), lesson({}, null), lesson({ by: 'fred' })]);
  assert.equal(s.use.length, 1); assert.equal(s.out.length, 1, 'a lesson without levels is not listed as left out');
  assert.equal(R.TEACHER, API.match(/const TEACHER = '([a-z]+)'/)[1], 'the same teacher as the server');
});

test('stop first when one candle holds both; target and stop outcomes; R before and after $0.60 on gold', () => {
  const both = D.replay(R.asTrade(SELL), bars([[4101, 4099], [4111, 4069]]), 300);
  assert.equal(both.outcome, 'stop'); assert.equal(both.R, -1);
  const win = D.replay(R.asTrade(SELL), bars([[4101, 4099], [4102, 4085], [4090, 4069]]), 300);
  assert.equal(win.outcome, 'target'); assert.equal(win.R, 3);
  const row = R.judge(lesson(), win);
  assert.equal(row.status, 'closed'); assert.equal(row.R, 3); assert.equal(row.by, 'candles'); assert.equal(row.pre, true);
  assert.equal(row.net, +(3 - 0.6 / 10).toFixed(3));
  const fx = R.judge(lesson({}, { ...SELL, market: 'eurusd', entry: 1.1, stop: 1.101, target: 1.097 }), { ok: true, filled: true, outcome: 'stop', when: T0 + 300, R: -1 });
  assert.equal(fx.net, -1, 'no cost known outside gold: before costs'); assert.equal(fx.cost, false);
});

test('timing: a lesson made after the outcome is added afterwards, never in the record; his exit counts only when no level was reached', () => {
  const win = { ok: true, filled: true, outcome: 'target', when: T0 + 900, R: 3 };
  assert.equal(R.judge(lesson({ at: iso(T0 + 1200) }), win).pre, false);
  assert.equal(R.judge(lesson({ at: iso(T0 + 900) }), win).pre, false, 'sent in the candle that reached the target: not before');
  const hand = { ...SELL, exit: 4090, exitAt: T0 + 3600 };
  const neither = { ok: true, filled: true, outcome: 'neither', R: null };
  const h = R.judge(lesson({}, hand), neither); assert.equal(h.status, 'closed'); assert.equal(h.by, 'his exit'); assert.equal(h.R, 1); assert.equal(h.pre, true);
  assert.equal(R.judge(lesson({ at: iso(T0 + 4000) }, hand), neither).pre, false);
  const both = R.judge(lesson({}, hand), { ok: true, filled: true, outcome: 'stop', when: T0 + 600, R: -1 });
  assert.equal(both.R, -1, 'our candles win where they reach a level'); assert.equal(both.his, 1, 'his exit is still shown');
  assert.equal(R.judge(lesson(), neither).status, 'open');
  assert.equal(R.judge(lesson(), { ok: true, filled: false, why: 'x' }).status, 'unfilled');
  const rec = R.record([R.judge(lesson(), win), R.judge(lesson({ at: iso(T0 + 1200) }), win), R.judge(lesson(), neither), R.judge(lesson(), null)]);
  assert.equal(rec.gross.n, 1); assert.equal(rec.post.length, 1); assert.equal(rec.open.length, 1); assert.equal(rec.pending.length, 1);
});

test('verdict thresholds: too few under 20, then only with n and t', () => {
  const rows = (rs) => rs.map((r, i) => ({ status: 'closed', pre: true, R: r, net: r - 0.05, out: T0 + i, cost: true }));
  const few = R.record(rows(Array(19).fill(1))); assert.equal(few.verdict.key, 'few'); assert.equal(R.MIN_JUDGE, 20);
  const luck = R.record(rows([...Array(10).fill(1.5), ...Array(10).fill(-1)])); assert.equal(luck.gross.n, 20); assert.equal(luck.verdict.key, 'luck');
  const pos = R.record(rows([...Array(16).fill(2), ...Array(4).fill(-1)])); assert.equal(pos.verdict.key, 'pos'); assert.ok(pos.gross.t >= 2);
  const neg = R.record(rows([...Array(5).fill(1), ...Array(15).fill(-1)])); assert.equal(neg.verdict.key, 'neg');
});

test('who sees it: the owner and readers, never a teacher who is not the owner', () => {
  assert.equal(R.visible({ role: 'owner' }), true);
  assert.equal(R.visible({ role: 'reviewer', mosha: 'read' }), true);
  assert.equal(R.visible({ role: 'viewer', mosha: 'teach' }), false);
  assert.match(PAGE, /html\[data-mosha="teach"\]:not\(\[data-role="owner"\]\) #v-mosha #mo-lux \{ display: none; \}|#v-mosha #mo-cycle, html\[data-mosha="teach"\]:not\(\[data-role="owner"\]\) #v-mosha #mo-lux \{ display: none; \}/);
  assert.match(PAGE, /<div class="card" id="mo-lux">/);
  assert.ok(PAGE.indexOf('/assets/mosha-desk.js') < PAGE.indexOf('/assets/mosha-record.js'), 'the statistics load first');
  assert.match(TJ, /root\.msMoshaRecord\(T\.lessons, T\.err\)/, 'fed by the lessons the teach cards already read');
  assert.match(JS, /box\.hidden = !shown\(\); if \(box\.hidden\) return;/, 'no candle is read for a card nobody may see');
  assert.doesNotMatch(JS, /fetch\('\/api/, 'no second read of the lessons, no write anywhere');
});

// Browser check of 14 Nov: a trade still open on our candles (neither level reached) was asked for again after every draw, and each
// check ends in a draw: hundreds of candle requests a second for as long as the desk was open. Now once per read of the lessons.
test('an open trade is read once per read of the lessons, not on every draw', { timeout: 5000 }, async () => {
  const vm = await import('node:vm');
  const box = { hidden: false, innerHTML: '' }, calls = [];
  const sandbox = { MS_MOSHA: D, console, setTimeout, Date, Math, JSON, encodeURIComponent, isFinite, Array, String, Object, Promise,
    document: { getElementById: (id) => (id === 'mo-lux' ? box : null), documentElement: { dataset: { role: 'owner', mosha: 'read' } } },
    fetch: (u) => { calls.push(u); return new Promise((r) => setTimeout(() => r({ ok: true, json: () => Promise.resolve({ bars: bars([[4101, 4099], [4102, 4098], [4103, 4097]]) }) }), 1)); } };
  sandbox.window = sandbox; vm.createContext(sandbox); vm.runInContext(JS, sandbox);
  const settle = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 20)); };
  const l = lesson({ id: 'open1' }), ds = sandbox.document.documentElement.dataset;
  try {
    sandbox.msMoshaRecord([l]); await settle();
    assert.equal(calls.length, 1, 'one candle request for one open trade');
    assert.match(box.innerHTML, /open on our candles/i);
    sandbox.msMoshaRecord([l]); await settle();
    assert.equal(calls.length, 2, 'read again once on the next read of the lessons');
  } finally { ds.role = 'viewer'; ds.mosha = 'teach'; await settle(); }   // a card nobody may see draws nothing: ends a loop if there is one
});

// Browser check of 14 Nov, 390 px: the record's rows had no cell classes, so the desk's phone card grid (made for the log's rows)
// put the side chip over the entry time and the levels without their names. The rows now carry the log's classes and labels.
test('a record row is the log card on a phone: time, side, labelled levels, result across', () => {
  const row = R.judge(lesson(), { ok: true, filled: true, outcome: 'target', when: T0 + 900, R: 3 });
  assert.equal(row.status, 'closed');
  for (const c of ['mo-c-time', 'mo-c-side', 'mo-c-res']) { assert.match(JS, new RegExp('class="' + c + '"')); assert.match(PAGE, new RegExp('#v-mosha \\.mo-t \\.' + c)); }
  for (const l of ['Entry', 'Stop', 'Target']) assert.match(JS, new RegExp('data-l="' + l + '"'));
});

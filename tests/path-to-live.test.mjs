// The path-to-live proposal (research/proposals/2026-11-12-path-to-live.md) and the arithmetic behind it
// (…-path-to-live.mjs → …-path-to-live.json): the committed numbers are the script's own output, the page quotes them,
// the bootstrap does what it says on hand-made months, the owner's items are on record (answered 12 Nov 2026), the page never
// recommends a live step, and the demo-only locks it lists are still in the mirror. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, simulate, path1, monthsOf, quant, mulberry32, HORIZONS, PROTOCOL_M, DRAWS, SEED, RISKS, WORLDS, GOLD, MIN_OZ, MICRO_OZ } from '../research/proposals/2026-11-12-path-to-live.mjs';
import { nVerdict } from '../council/expect.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const DOC = rd('../research/proposals/2026-11-12-path-to-live.md'), SRC = rd('../research/proposals/2026-11-12-path-to-live.mjs');
const J = JSON.parse(rd('../research/proposals/2026-11-12-path-to-live.json'));
const SB = JSON.parse(rd('../research/edge/supported-book/result.json')).windows.W1.S2.x1F1;
const has = (s) => assert.ok(DOC.includes(s), `the proposal should say: ${s}`);
const sg = (x, d = 1) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(d)}`;
const pct = (x) => `${Math.round(x * 100)} %`;

test('the committed numbers are the script\'s own output (deterministic, seeded)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(build())), J);
  assert.deepEqual([DRAWS, SEED, PROTOCOL_M], [20000, 12, 36]); assert.deepEqual(HORIZONS, [6, 12, 24, 36, 60]);
  assert.deepEqual(RISKS, [0.001, 0.0025, 0.005, 0.01]); assert.deepEqual(WORLDS, { expected: 0, none: 1, negative: 2 });
});

test('the book is the supported-book study\'s untouched book, after costs and financing on every unit', () => {
  const b = J.book;
  assert.equal(b.positions, SB.positions); assert.equal(b.total, SB.total); assert.equal(b.perYear, SB.perYear); assert.equal(b.tDaily, SB.tDaily);
  assert.equal(b.perPosition, SB.perPosition); assert.equal(b.tPosition, SB.tPosition); assert.equal(b.ddClosed, SB.maxDD); assert.equal(b.ddWeekdays, SB.ddDays);
  assert.equal(b.ddRegained, false); assert.equal(b.ddMarked, SB.marked.maxDD); assert.equal(b.maxUnits, SB.inMarket.maxUnits); assert.equal(b.months, 138);
  assert.match(SRC, /from '\.\.\/edge\/supported-book\/run\.mjs'/); assert.match(SRC, /from '\.\.\/\.\.\/council\/expect\.mjs'/);
  assert.equal((SRC.match(/^import /gm) || []).length, 5, 'node built-ins, the study and the expectation maths: nothing live, no network');
  assert.doesNotMatch(SRC, /fetch\(|https?:\/\//);
});

test('time to prove: the expectation module\'s own formula, over a decade', () => {
  const v = nVerdict(J.book.perPosition, J.book.sd, J.book.perYearTrades, { capYears: 1e9 });
  assert.ok(Math.abs(v.n - J.prove.tradesForT2) <= 3, `${v.n} vs ${J.prove.tradesForT2} (rounded inputs)`);
  assert.ok(J.prove.yearsForT2 > 10 && J.prove.yearsForT2Daily > 10);
  has(`about ${J.prove.tradesForT2}\n   positions, **about 13 years**`);
});

test('the bootstrap on hand-made months', () => {
  // every month is one day of +1: a path of H months ends at H with no drawdown
  const flat = [[1]], p = path1(flat, 7, mulberry32(1)); assert.deepEqual(p, { c: 7, dd: 0 });
  // one month: +3 then −2 → each month nets +1 and dips 2 from its own high
  const s = simulate([[3, -2]], [1, 4], 50, 3);
  assert.ok(s.cum[1].every((x) => x === 1) && s.cum[4].every((x) => x === 4)); assert.ok(s.dd[1].every((x) => x === 2) && s.dd[4].every((x) => x === 2));
  // a losing month only: the drawdown is the whole fall, measured from the start (the forward record's own high is 0)
  const l = simulate([[-1, -1]], [3], 10, 1); assert.ok(l.cum[3].every((x) => x === -6) && l.dd[3].every((x) => x === 6));
  // the same seed gives the same paths; months are kept whole
  const m = [[1, -2], [4], [-3, 1, 1]], a = simulate(m, [12], 200, 9), b = simulate(m, [12], 200, 9); assert.deepEqual(Array.from(a.cum[12]), Array.from(b.cum[12]));
  assert.deepEqual(monthsOf(['2020-01-30', '2020-01-31', '2020-02-03'], [1, 2, 3]), [[1, 2], [3]]);
  assert.equal(quant([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.05), 1); assert.equal(quant([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95), 10);
});

test('three worlds: as measured, no edge, losing; the lines come from the first only', () => {
  const W = J.worlds;
  assert.equal(W.expected.perYear, J.book.perYear); assert.ok(Math.abs(W.none.perYear) < 0.005); assert.ok(Math.abs(W.negative.perYear + J.book.perYear) < 0.005);
  for (const h of HORIZONS) { assert.ok(Math.abs(W.expected.horizons[h].belowFloor - 0.05) < 0.002); assert.equal(J.gates.floor[h], W.expected.horizons[h].cum.p5); }
  assert.equal(J.gates.ddStop, W.expected.horizons[PROTOCOL_M].dd.p95); assert.ok(Math.abs(W.expected.horizons[PROTOCOL_M].ddStopHit - 0.05) < 0.002);
  // a worse world is stopped more often, at every horizon; and the false alarm is said, not hidden
  for (const h of HORIZONS) { assert.ok(W.none.horizons[h].belowFloor > W.expected.horizons[h].belowFloor); assert.ok(W.negative.horizons[h].belowFloor > W.none.horizons[h].belowFloor); }
  assert.ok(W.expected.stoppedIn36 < W.none.stoppedIn36 && W.none.stoppedIn36 < W.negative.stoppedIn36);
  assert.ok(W.expected.stoppedIn36 > 0.05, 'four lines together stop a good book more often than one line would');
  assert.ok(W.none.stoppedIn36 < 0.5, 'the protocol cannot tell "as measured" from "no edge" in three years: the page must say so');
});

test('the proposal quotes the computed lines, bands and power', () => {
  const G = J.gates, W = J.worlds;
  has(`**more than ${G.ddStop}R**`); has(`**below ${sg(G.floor[12])}R**`); has(`**below ${sg(G.floor[24])}R**`); has(`**below ${sg(G.floor[36])}R**`);
  for (const h of HORIZONS) {
    const x = W.expected.horizons[h];
    has(`| ${h} months | ${x.trades} | ${sg(x.cum.p50)} (${sg(x.cum.p5)} to ${sg(x.cum.p95)}) | ${pct(x.pLoss)} | ${x.dd.p50.toFixed(1)}R / ${x.dd.p95.toFixed(1)}R |`);
  }
  has(`| as measured (+5.2R a year) | **${pct(W.expected.stoppedIn36)}** (a false alarm) | ${[12, 24, 36, 60].map((h) => pct(W.expected.horizons[h].ddStopHit)).join(' / ')} |`);
  has(`| without an edge (0R a year) | **${pct(W.none.stoppedIn36)}** | ${[12, 24, 36, 60].map((h) => pct(W.none.horizons[h].ddStopHit)).join(' / ')} |`);
  has(`| losing (−5.2R a year) | **${pct(W.negative.stoppedIn36)}** | ${[12, 24, 36, 60].map((h) => pct(W.negative.horizons[h].ddStopHit)).join(' / ')} |`);
  for (const n of [29, 57, 86]) has(`${sg(J.bands[n].lo, 2)} to ${sg(J.bands[n].hi, 2)} after ${n}`);
  has('Three years cannot tell "as measured" from "no edge"'); has('one false alarm in eight');
  has('no trade is closed by it, every open\ntrade keeps its stop and runs to its own exit');
});

test('the risk table and the smallest size are the computed ones', () => {
  const lab = { 0.001: '0.10 %', 0.0025: '0.25 %', 0.005: '0.50 %', 0.01: '1.00 %' };
  for (const r of J.risk) {
    const row = DOC.split('\n').find((l) => l.startsWith(`| ${lab[r.risk]} |`)); assert.ok(row, lab[r.risk]);
    assert.ok(row.includes(`+${r.perYearPct.toFixed(1)} %`), row); assert.ok(row.includes(`${r.ddClosedPct.toFixed(1)} % / ${r.ddMarkedPct.toFixed(1)} %`), row);
    assert.ok(row.includes(`| ${r.ddTenYears95Pct.toFixed(1)} % |`), row); assert.ok(row.includes(`| ${r.maxOpenPct.toFixed(1)} % |`), row);
    assert.equal(r.yearsUnder, 3.8);
  }
  assert.deepEqual([GOLD, MIN_OZ, MICRO_OZ], [4000, 1, 10]);
  const usd = (x) => `$${(Math.round(x / 100) * 100).toLocaleString('en-US')}`;
  const t = J.size.gtrend, g = J.size.geg;
  has(`about $${Math.round(t.first.stopUsd)}`); has(`about $${Math.round(t.recent.stopUsd)}`); has(`about $${Math.round(g.first.stopUsd)}`); has(`about $${Math.round(g.recent.stopUsd)}`);
  has(`${usd(t.recent.account['0.0025'])} / ${usd(t.recent.account['0.005'])} / ${usd(t.recent.account['0.01'])}`);
  has(`${usd(g.recent.account['0.0025'])} / ${usd(g.recent.account['0.005'])} / ${usd(g.recent.account['0.01'])}`);
  assert.equal(g.add, null, 'the engulf has no add'); assert.ok(t.add.units > 0);
  // a unit's financing a night and round trip, as a share of its own risk, at today's price
  assert.equal(t.first.costR, 0.003); assert.equal(g.first.costR, 0.008); assert.equal(t.first.finNightR, 0.006); assert.equal(g.first.finNightR, 0.015);
});

test('the lever table names every study it rests on, and each exists with a result', () => {
  const names = ['supported-book', 'honest-book', 'macroscore-overlay', 'macro-gold', 'regime-switch', 'macro-vol', 'gtrend-exits', 'geg-variants', 'sizing', 'portfolio', 'portfolio-v2', 'book-sizing',
    'trend-breadth-h1', 'gold-weekend', 'seasonality', 'event-risk', 'news-filter', 'timing', 'confluence', 'regime', 'costs', 'gold-systems-oos', 'robustness'];
  for (const n of names) { has('`' + n + '`'); assert.ok(fs.existsSync(new URL(`../research/edge/${n}/result.json`, import.meta.url)), n); }
  const rows = DOC.split('\n').filter((l) => /^\| .* \| (yes|no)[^|]* \| .* \| (yes|no)[^|]* \|$/.test(l));
  assert.ok(rows.length >= 20, `${rows.length} lever rows`); for (const r of rows) assert.match(r, /\| no( \(see note [12]\))? \|$/, 'no lever is left open');
  has('No new study was run for this document, on purpose'); has('**positive, not\n   proven**');
  // figures quoted from the studies
  const MS = rd('../research/edge/macroscore-overlay/RESULT.md'); assert.match(MS, /\+0\.149/); assert.match(MS, /t 3\.24/); assert.match(MS, /65%/); assert.match(MS, /0\.852/);
  const RS = rd('../research/edge/regime-switch/RESULT.md'); assert.match(RS, /\| geg \| TREND \|[^\n]*\+1\.43/);
  const BS = rd('../research/edge/book-sizing/RESULT.md'); assert.match(BS, /0\.535|0\.54/);
});

test('it never recommends a live step, and lists what keeps the desk on demo accounts', () => {
  has('**This is not allowed today and is not recommended today.**'); has('Nothing here recommends putting real money on the book now.');
  has('| **A. Stay on paper and demo** (today; recommended) |'); has('Recommended: **yes, keep the rule**'); has('Only you can change it.');
  assert.doesNotMatch(DOC, /guarantee|will make money|proven edge|safe to trade/i);
  const M = rd('../council/ctrader-mirror.mjs');
  assert.match(M, /export const DEMO_HOST = 'wss:\/\/demo\.ctraderapi\.com:5036'/); assert.match(M, /if \(url !== DEMO_HOST\) throw new Error\('refusing a non-demo host'\)/);
  assert.match(M, /CTRADER_ENV\)\.trim\(\)\.toLowerCase\(\) !== 'demo'\) \{ st\.status = 'refused: CTRADER_ENV must be "demo"'/); assert.match(M, /if \(acc\.isLive !== false\) \{ st\.status = 'refused: the account is not a demo account'/);
  for (const f of ['council/ctrader-mirror.mjs', 'council/ctrader-suite.mjs', 'council/ctrader-account.mjs', 'council/ctrader-symbols.mjs', 'mt5/CouncilBridge.mq5', 'ctrader/CouncilBridge.cs']) { has('`' + f + '`'); assert.ok(fs.existsSync(new URL('../' + f, import.meta.url)), f); }
  for (const f of ['../council/ctrader-suite.mjs', '../council/ctrader-account.mjs', '../council/ctrader-symbols.mjs']) assert.match(rd(f), /demo/);
});

// 12 Nov 2026: the owner answered "Yes to all": the four are ticked with the owner's words and the recommended option (a)
test('the four decisions are on record as items 43 to 46, answered by the owner on 12 Nov 2026 ("Yes to all")', () => {
  const doc = rd('../docs/owner-decisions.md'), heads = [...doc.matchAll(/^### \[(.)\] (\d+)\. (.*)$/gm)];
  const at = (n) => heads.find((m) => +m[2] === n);
  for (const n of [43, 44, 45, 46]) { assert.ok(at(n), `item ${n}`); assert.equal(at(n)[1], 'x', `item ${n} is answered`); }
  assert.match(at(43)[3], /forward-test protocol/); assert.match(at(44)[3], /Stop testing/); assert.match(at(45)[3], /bridge programs refuse/); assert.match(at(46)[3], /keep the paper-and-demo rule/);
  // the section of items 43-48 only (later sections, e.g. item 49 of 12 Nov 2026, have their own status)
  const from = doc.indexOf('## The path to real money, 12 Nov 2026'), next = doc.indexOf('\n## ', from + 5), tail = doc.slice(from, next < 0 ? undefined : next);
  assert.equal((tail.match(/\*\*Status \(12 Nov 2026\): (adopted|agreed|approved and done)\.\*\* Your words: "Yes to all" \(option \(a\)/g) || []).length, 4);
  assert.doesNotMatch(tail, /\*\*Status \(12 Nov 2026\): open\.\*\*/);
  assert.match(tail, new RegExp(`${J.gates.ddStop}R`)); assert.match(tail, /-9\.7R after 12 months, -12\.0R after 24 or -12\.1R after 36/);
  has('They are items 43 to 46 of `docs/owner-decisions.md`.');
});

// node --test tests/forward.test.mjs — the forward tracker of the live paper book (council/forward.mjs): the record against the
// forward-test protocol (research/proposals/2026-11-12-path-to-live.*, owner decision 43, adopted 12 Nov 2026), and the protocol's
// one consequence (stopSwitch: a crossed stop line sends the book back to a paper shadow, once). Offline, fake files only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildForward, bandAt, minPositions, bookTrades, netR, stopLines, record, execChecks, forwardLine, loadProtocol, START, BOOK, EXEC, COPY_GRACE, LABEL, ADOPTED, stopSwitch, SWITCH_K, QUOTE } from '../council/forward.mjs';
import { merNet, waiting } from '../council/digest.mjs';
import { FIN } from '../council/fills.mjs';

const P = loadProtocol(), DOC = fs.readFileSync(new URL('../research/proposals/2026-11-12-path-to-live.md', import.meta.url), 'utf8');
const DAY = 86400, MONTH = 30.4375 * DAY;
let seq = 0;
const T = (o) => ({ id: `xau-${o.k || 'geg'}-${++seq}`, k: 'geg', market: 'xau', side: 'buy', entry: 4000, stop: 3960, r0: 40, status: 'win', filled: START + DAY * seq, closed: START + DAY * seq + 3600, R: 1, Rnet: 0.95, ...o });

test('the protocol file is the proposal\'s own json; the book, the clock start and the E thresholds are the proposal\'s', () => {
  assert.ok(P && P.gates && P.worlds, 'research/proposals/2026-11-12-path-to-live.json loads');
  assert.match(P.source, /S2 = gtrend \+ geg/); assert.deepEqual(Object.keys(BOOK).sort(), ['geg', 'gtrend']);
  assert.match(DOC, /Clock start: 12 Nov 2026/); assert.equal(new Date(START * 1000).toISOString().slice(0, 10), '2026-11-12');
  // section 3's execution table (the json does not carry it): 30 copies, 28 of 30, 0.03R / 0.05R, a fifth
  assert.match(DOC, /first 30 copies/); assert.equal(EXEC.n, 30);
  assert.match(DOC, /at least 28 of 30.*3 or more missed/); assert.equal(EXEC.missFail, 3);
  assert.match(DOC, /within 0\.03R of paper \| worse than paper by more than 0\.05R/); assert.equal(EXEC.slipPass, 0.03); assert.equal(EXEC.slipFail, 0.05);
  assert.match(DOC, /within a fifth \| the demo charges over a fifth more/); assert.equal(EXEC.finTol, 0.2);
  assert.match(LABEL, /adopted by the owner, 12 Nov 2026 \(decision 43\)/); assert.equal(ADOPTED, '2026-11-12');
});

test('bands: read from the json at its checkpoints, interpolated between them, 0R at the start, held past the last', () => {
  const H = P.worlds.expected.horizons;
  for (const m of [6, 12, 24, 36, 60]) { const b = bandAt(P, m); assert.deepEqual([b.p5, b.p50, b.p95], [H[m].cum.p5, H[m].cum.p50, H[m].cum.p95]); }
  assert.deepEqual(bandAt(P, 0), { months: 0, p5: 0, p50: 0, p95: 0, clamp: false });
  const b9 = bandAt(P, 9), mid = (k) => Math.round((H[6].cum[k] + H[12].cum[k]) / 2 * 100) / 100;
  assert.deepEqual([b9.p5, b9.p50, b9.p95], [mid('p5'), mid('p50'), mid('p95')]);
  const b3 = bandAt(P, 3); assert.equal(b3.p95, Math.round(H[6].cum.p95 / 2 * 100) / 100);
  assert.equal(bandAt(P, 80).clamp, true); assert.equal(bandAt(P, 80).p5, H[60].cum.p5);
  assert.equal(minPositions(P), Math.min(...Object.keys(P.bands).map(Number)));
});

test('only the two systems\' own forward trades since the clock start count: no shadow, no replay row, no other system, nothing before', () => {
  const rows = [T({}), T({ k: 'gtrend' }), T({ shadow: true, blockedBy: ['owner-shadow'] }), T({ k: 'gtrend5', shadow: true, blockedBy: ['owner-shadow'] }), T({ replay: true }),
    T({ k: 'replica' }), T({ filled: START - 3600, closed: START + 3600 }), T({ status: 'pending', R: null, closed: null }), T({ status: 'expired', R: 0 }), T({ status: 'duplicate', void: true })];
  const got = bookTrades(rows).map((x) => x.k); assert.deepEqual(got, ['geg', 'gtrend']);
  // R after costs, the digest's own rule (financing is inside Rnet / costR)
  for (const x of [{ R: 1, Rnet: 0.9 }, { R: -1, costR: 0.05, size: 2 }, { R: 0.4 }]) assert.equal(netR(x), merNet(x));
});

test('drawdown: from the record\'s own high (which starts at 0), closed and marked to market; adds count as units, not positions', () => {
  const rows = bookTrades([T({ Rnet: 2 }), T({ Rnet: -1 }), T({ Rnet: -1.5 }), T({ Rnet: 0.5, addOf: 'x' }), T({ Rnet: 1 }), T({ status: 'open', R: null, Rnet: null, closed: null, entry: 4000, r0: 40 })]);
  const rec = record(rows, () => 3980);
  assert.equal(rec.total, 1); assert.equal(rec.n, 4); assert.equal(rec.units, 5); assert.equal(rec.peak, 2); assert.equal(rec.ddMax, 2.5);
  assert.equal(rec.floating, -0.5); assert.equal(rec.marked, 0.5); assert.equal(rec.ddMarked, 2.5); assert.equal(rec.dd, 1);
  const r2 = record(bookTrades([T({ Rnet: -1 }), T({ status: 'open', R: null, Rnet: null, closed: null })]), () => 3880); assert.equal(r2.ddMax, 1); assert.equal(r2.ddMarked, 4);
});

test('stop lines: S1 every round on the closed drawdown; S2-S4 judged on the total closed by their checkpoint, later before it', () => {
  const G = P.gates;
  // S1 crossed: one long losing run past the json's line
  const losers = Array.from({ length: Math.ceil(G.ddStop) + 2 }, (_, i) => T({ Rnet: -1, filled: START + i * DAY, closed: START + i * DAY + 60 }));
  let rec = record(bookTrades(losers), null), S = stopLines(P, rec, START + 40 * DAY);
  assert.equal(S[0].id, 'S1'); assert.equal(S[0].state, 'crossed'); assert.equal(S[0].line, G.ddStop);
  assert.deepEqual(S.slice(1).map((s) => s.state), ['later', 'later', 'later']);
  // just under the line: clear
  rec = record(bookTrades(losers.slice(0, Math.floor(G.ddStop)))); assert.equal(stopLines(P, rec, START + 40 * DAY)[0].state, 'clear');
  // S2 at 12 months: the total of positions closed by the checkpoint, below the json's floor -> crossed; a later win does not undo it
  const due = (() => { const d = new Date(START * 1000); d.setUTCMonth(d.getUTCMonth() + 12); return d.getTime() / 1000; })();
  const bad = [T({ Rnet: G.floor[12] - 0.5, filled: START + DAY, closed: due - DAY }), T({ Rnet: 30, filled: due + DAY, closed: due + 2 * DAY })];
  rec = record(bookTrades(bad)); S = stopLines(P, rec, due + 3 * DAY);
  assert.equal(S[1].id, 'S2'); assert.equal(S[1].state, 'crossed'); assert.equal(S[1].value, G.floor[12] - 0.5); assert.equal(S[1].line, G.floor[12]);
  assert.equal(stopLines(P, rec, due - 1)[1].state, 'later');
  const ok = record(bookTrades([T({ Rnet: G.floor[12] + 0.5, filled: START + DAY, closed: due - DAY })])); assert.equal(stopLines(P, ok, due + 1)[1].state, 'clear');
  assert.deepEqual(S.slice(2).map((s) => s.line), [G.floor[24], G.floor[36]]);
});

const mirrorsOf = (councilState, other = {}) => [{ account: '1', books: ['council'], state: councilState }, { account: '2', books: ['shadow'], state: other }];
const acct = (o = {}) => ({ at: new Date((START + 20 * DAY) * 1000).toISOString(), accounts: [{ label: 'Council', books: ['council'], open: [], orders: [], history: [], ...o }] });

test('E1-E5 on fake mirror and account files: stops, copies and misses with reasons, fills, financing, foreign orders', async () => {
  const now = START + 20 * DAY;
  const rows = bookTrades([T({ id: 'a', filled: START + DAY }), T({ id: 'b', filled: START + 2 * DAY }), T({ id: 'c', filled: START + 3 * DAY }), T({ id: 'd', filled: START + 4 * DAY }), T({ id: 'e', filled: now - COPY_GRACE + 60, closed: null, status: 'open', R: null, Rnet: null })]);
  const map = { a: { positionId: '11', status: 'closed by council', slipR: 0.02, volume: 100, openedAt: new Date(rows[0].filled * 1000).toISOString(), fillPrice: 4000 },
    b: { positionId: '12', status: 'closed by council', slipR: 0.04, stopSetBy: 'guard' } };
  const accounts = acct({ history: [{ positionId: '11', closedAt: new Date((rows[0].filled + 3 * DAY) * 1000).toISOString(), swap: -2.5 }, { positionId: '99', symbol: 'XAUUSD', side: 'buy', lots: 0.1, closedAt: new Date((START + 2 * DAY) * 1000).toISOString() }] });
  const E = execChecks({ rows, mirrors: mirrorsOf({ map, skipped: { c: 'price has run 1.3R from the council entry' } }), accounts, prev: null, now });
  const by = Object.fromEntries(E.checks.map((c) => [c.id, c]));
  assert.equal(by.E1.state, 'fail'); assert.equal(by.E1.bad, 1);
  // c has a reason, d none, e is inside the grace: two misses so far (under the 3 that fail), one without a reason -> watch
  assert.equal(by.E2.n, 2); assert.equal(by.E2.of, 4); assert.equal(by.E2.state, 'watch'); assert.deepEqual(by.E2.misses.map((m) => [m.id, !!m.why]), [['c', true], ['d', false]]);
  assert.equal(by.E3.avg, 0.03); assert.equal(by.E3.state, 'running');
  // E4: 3 rollovers (fill + 3 days, a Wednesday counted three times where it falls) x the model rate x 4000 x 1 oz
  { const { nights } = await import('../council/fills.mjs'), n = nights(rows[0].filled, rows[0].filled + 3 * DAY);
    assert.equal(by.E4.n, 1); assert.equal(by.E4.charged, 2.5); assert.equal(by.E4.model, Math.round(n * FIN.xau.long * 4000 * 1 * 100) / 100); }
  assert.equal(by.E5.state, 'fail'); assert.match(by.E5.text, /deal 99 XAUUSD buy/);
  // three misses fail E2, whatever their reasons
  const many = bookTrades([T({ id: 'p', filled: START + DAY }), T({ id: 'q', filled: START + DAY }), T({ id: 'r', filled: START + DAY })]);
  assert.equal(execChecks({ rows: many, mirrors: mirrorsOf({}), accounts: acct(), now }).checks.find((c) => c.id === 'E2').state, 'fail');
  // nothing yet: not measurable, never a fail
  const none = execChecks({ rows: [], mirrors: mirrorsOf({}), accounts: acct(), now });
  assert.deepEqual(none.checks.map((c) => c.state), ['nodata', 'nodata', 'nodata', 'nodata', 'running']);
  assert.equal(execChecks({ rows: [], mirrors: [], accounts: null, now }).checks.find((c) => c.id === 'E5').state, 'nodata');
});

test('E checks decide at 30 copies; a copy dropped from the mirror file after 30 days is carried from the last reading', () => {
  const now = START + 60 * DAY, rows = bookTrades(Array.from({ length: 30 }, (_, i) => T({ id: 't' + i, filled: START + i * 3600, closed: START + i * 3600 + 60 })));
  const map = Object.fromEntries(rows.map((x, i) => [x.id, { positionId: String(100 + i), status: 'closed by council', slipR: i % 2 ? 0.01 : -0.01 }]));
  const first = execChecks({ rows, mirrors: mirrorsOf({ map }), accounts: acct(), now });
  assert.deepEqual(first.checks.map((c) => c.state), ['pass', 'pass', 'pass', 'nodata', 'pass']);
  // the mirror forgets closed copies after LIMITS.keepDays; the reading keeps them (and keeps a no-stop flag once seen)
  first.copies.t3.noStop = true;
  const again = execChecks({ rows, mirrors: mirrorsOf({}), accounts: acct(), prev: { exec: first }, now: now + DAY });
  assert.equal(again.copied, 30); assert.equal(again.checks[0].state, 'fail');
  // E3 fails past 0.05R worse on average, watch between the two lines
  const slip = (v) => execChecks({ rows, mirrors: mirrorsOf({ map: Object.fromEntries(rows.map((x, i) => [x.id, { positionId: String(i), slipR: v }])) }), accounts: acct(), now }).checks.find((c) => c.id === 'E3').state;
  assert.equal(slip(0.06), 'fail'); assert.equal(slip(0.04), 'watch'); assert.equal(slip(-0.2), 'pass');
});

test('the reading, the one digest / Home line only when a line is crossed or a check fails, and the label', () => {
  const now = START + 2 * DAY, few = buildForward({ trades: [T({ filled: START + 3600, closed: START + 7200 })], snapshot: { markets: { xau: { price: 4000 } } }, mirrors: [], accounts: null, protocol: P }, { now });
  assert.equal(few.status, 'few'); assert.match(few.sentence, /^Too few trades to say: 1 position closed, 2026-11-12/); assert.equal(few.label, LABEL); assert.deepEqual(few.alerts, []);
  assert.equal(forwardLine(few), null);
  assert.equal(buildForward({ protocol: null }, { now }).error.includes('2026-11-12-path-to-live.json'), true);
  const losers = Array.from({ length: 25 }, (_, i) => T({ Rnet: -1, filled: START + i * 3600, closed: START + i * 3600 + 60 }));
  const bad = buildForward({ trades: losers, protocol: P, mirrors: [], accounts: null }, { now: START + 30 * DAY });
  assert.equal(bad.status, 'stop'); assert.equal(bad.head, 'A stop line is crossed'); assert.equal(bad.alerts.length, 2);   // S1, and E2: 25 paper fills, no copy file
  const line = forwardLine(bad); assert.match(line, /stop line S1 crossed; execution check E2 fails/); assert.match(line, /protocol adopted 12 Nov 2026: decision 43/); assert.match(line, /goes back to a paper shadow \(no open trade closed, every stop kept\)/);
  // the digest's "Waiting on you" carries it once, and nothing when nothing is crossed
  const W = (fw) => waiting({ coach: { forward: fw }, health: { status: 'ok', at: new Date().toISOString() } }, Date.now() / 1000, {});
  assert.equal(W(bad).filter((s) => /Forward book/.test(s)).length, 1); assert.equal(W(few).filter((s) => /Forward book/.test(s)).length, 0); assert.equal(W(undefined).filter((s) => /Forward book/.test(s)).length, 0);
  // below the range with enough positions: "Below the expected range"
  const below = buildForward({ trades: Array.from({ length: 12 }, (_, i) => T({ Rnet: i % 2 ? -0.8 : 0.1, filled: START + i * 3600, closed: START + i * 3600 + 60 })), protocol: P }, { now: START + 7 * DAY });
  assert.equal(below.status, 'below'); assert.ok(below.stops.every((x) => x.state !== 'crossed'));
  assert.ok(below.alerts.every((a) => /check E2 fails/.test(a)));   // no copy file: E2 says so, the band itself never alerts
});

test('wiring: the Trader writes coach.json forward on the 6-hour slot and the daily Coach rewrite carries it; financing is the Trader\'s FIN', () => {
  const tr = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(tr, /import \{ buildForward, loadProtocol, stopSwitch \} from '\.\/forward\.mjs'/);
  assert.match(tr, /cj\.forward = \{ \.\.\.buildForward\(\{ trades, snapshot, mirrors, accounts: rd\('ctrader\/accounts\.json', null\), protocol: pr, prev: cj\.forward \}, \{ now \}\), slot: CC_SLOT \}/);
  assert.match(tr, /!cj\.forward \|\| cj\.forward\.slot !== CC_SLOT/);
  assert.match(tr, /expect: prev\.expect, forward: prev\.forward,/);
  assert.ok(FIN.xau.long > 0);
});

test('page: the card reads only fields forward.mjs writes, says the protocol is adopted (12 Nov 2026), and reads an older coach.json', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  const i = html.indexOf('<script id="ms-fw-js">'), js = html.slice(i, html.indexOf('</script>', i));
  const card = html.slice(html.indexOf('id="ms-fwd"'), html.indexOf('id="ms-edge"'));
  assert.ok(i > 0 && card.length > 0);
  assert.match(html, /<div class="card c-fwd adm" id="ms-fwd">/);
  // right under "Which systems trade live", in the Systems pane
  const sys = html.indexOf('id="ms-sys-book"'), fwd = html.indexOf('id="ms-fwd"'), edge = html.indexOf('id="ms-edge"'); assert.ok(sys < fwd && fwd < edge);
  assert.match(card, /Protocol adopted · 12 Nov 2026/); assert.match(card, /your decision 43<\/a>: “Yes to all”/); assert.doesNotMatch(card, /not adopted|proposed protocol/i);
  assert.match(card, /The Mosha cycle, a main paper system since 11 Nov by your choice, is not part of the protocol's book and is not counted here\./);
  assert.match(js, /first one comes with the next Coach rebuild/);
  // every field the card reads exists in a reading
  const fw = buildForward({ trades: [T({})], snapshot: { markets: { xau: { price: 4000 } } }, mirrors: [], accounts: null, protocol: P }, { now: START + 2 * DAY });
  for (const k of ['status', 'head', 'at', 'protocol', 'record', 'band', 'bandPts', 'stops', 'exec']) assert.ok(k in fw, k);
  for (const k of ['n', 'from', 'lastAt', 'total', 'months', 'open', 'floating', 'marked', 'ddMarked', 'path']) assert.ok(k in fw.record, 'record.' + k);
  for (const k of ['p5', 'p95', 'where', 'show']) assert.ok(k in fw.band, 'band.' + k);
  for (const k of ['minPositions', 'floor']) assert.ok(k in fw.protocol, 'protocol.' + k);
  for (const s of fw.stops) for (const k of ['id', 'rule', 'line', 'value', 'state']) assert.ok(k in s, 'stop.' + k);
  for (const c of fw.exec.checks) for (const k of ['id', 'label', 'state', 'text']) assert.ok(k in c, 'check.' + k);
  for (const k of ['window', 'trades', 'checks']) assert.ok(k in fw.exec, 'exec.' + k);
  // the simple phone view folds it to its heading and its one sentence (the neighbours' helper, no new mechanism)
  assert.match(html, /c\.querySelector\('\.sb-sum, \.dc-sum, \.ex-sum, \.bk-sum, \.fw-sum, \.md-verdict'\)/);
  // Home's "things wait on you" takes it from MS_WEEK.decisions, one item, only with alerts
  assert.match(html, /var FW = co\.forward; if \(FW && Array\.isArray\(FW\.alerts\) && FW\.alerts\.length\)/);
});

// 12 Nov 2026: the council loop's sparse checkout left out research/proposals, so loadProtocol() found no file on the
// runner and no forward reading (nor the adopted stop switch) was ever written. The loop must check out the protocol's folder.
test('council loop checks out the forward protocol file', async () => {
  const fs = await import('node:fs');
  const { PROTOCOL_FILE } = await import('../council/forward.mjs');
  const yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  const block = yml.slice(yml.indexOf('sparse-checkout: |'), yml.indexOf('Checkout council data'));
  const dirs = block.split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
  const rel = PROTOCOL_FILE.pathname.split('/macro-dashboard/').pop().replace(/^.*?(research\/)/, '$1');
  assert.ok(dirs.some((d) => rel.startsWith(d + '/')), `council.yml sparse-checkout must include the folder of ${rel}; has ${dirs.join(', ')}`);
});

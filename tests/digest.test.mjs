// node --test tests/digest.test.mjs — the daily owner digest (council/digest.mjs) on fake council-data and a fake fetch:
// no network, no secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { slot, tally, merNet, ictNet, ctraderLine, openPositions, openLine, macroLines, movers, robustChanges, waiting, buildDigest,
  scoreboardRows, readData, main, COUNCIL_URL, ICT_COST_PTS } from '../council/digest.mjs';

const T = (s) => Date.parse(s) / 1000;
const NOW = T('2026-11-06T21:20:00Z');   // Friday, 21:20 UTC: inside the window

test('slot: weekdays from 21:15 UTC, Sunday preview, nothing on Saturday or a CME full-closure holiday', () => {
  assert.equal(slot(T('2026-11-06T21:14:00Z')), null);
  assert.deepEqual(slot(T('2026-11-06T21:15:00Z')), { day: '2026-11-06', kind: 'daily' });
  assert.deepEqual(slot(T('2026-11-06T23:59:00Z')), { day: '2026-11-06', kind: 'daily' });   // a late loop still sends that day
  assert.equal(slot(T('2026-11-07T21:30:00Z')), null);                                         // Saturday
  assert.deepEqual(slot(T('2026-11-08T21:30:00Z')), { day: '2026-11-08', kind: 'preview' });  // Sunday
  assert.equal(slot(T('2026-11-09T09:00:00Z')), null);                                         // Monday morning
  assert.equal(slot(T('2026-12-25T21:30:00Z')), null);                                         // Christmas: CME closed
  assert.deepEqual(slot(T('2026-11-26T21:30:00Z')), { day: '2026-11-26', kind: 'daily' });    // Thanksgiving is an early close: sent
});

// ─── fake council-data ───
const H = 3600;
const merTrades = [
  { id: 'm1', market: 'xau', label: 'XAU/USD', k: 'replica', name: 'Replica', side: 'buy', status: 'win', R: 2, Rnet: 1.8, closed: NOW - 2 * H },
  { id: 'm2', market: 'eurusd', label: 'EUR/USD', k: 'scalp', name: 'Scalp', side: 'sell', status: 'loss', R: -1, costR: 0.1, size: 1, closed: NOW - 5 * H },   // no Rnet: R − costR
  { id: 'm3', market: 'xau', label: 'XAU/USD', k: 'replica', name: 'Replica', side: 'buy', status: 'loss', R: -1, Rnet: -1.05, closed: NOW - 30 * H },        // yesterday
  { id: 'm4', market: 'btc', label: 'BTC/USD', k: 'scalp', name: 'Scalp', side: 'buy', status: 'win', R: 3, Rnet: 2, shadow: true, closed: NOW - H },          // shadow: never counted
  { id: 'm5', market: 'xau', label: 'XAU/USD', k: 'gtrend', name: 'Gold trend', side: 'buy', status: 'open', R: null, entry: 4000, stop: 3980, r0: 20, opened: NOW - 9 * H },
  { id: 'm6', market: 'eurusd', label: 'EUR/USD', k: 'scalp', name: 'Scalp', side: 'sell', status: 'expired', R: null, closed: NOW - H }];
const research = [{ id: 'nq1', market: 'nq', label: 'NQ', k: 'nq-open', session: 'nyflip', name: 'NQ open run', side: 'buy', status: 'win', R: 2, exitAt: NOW - 3 * H },
  { id: 'nq2', market: 'nq', label: 'NQ', k: 'nq-open', session: 'nyflip-x', name: 'skipped', side: 'buy', status: 'win', R: 2, exitAt: NOW - 3 * H }];   // -x: not a live rule
const ictTrades = [
  { id: 'i1', market: 'nq', short: 'NQ', side: 'sell', aset: true, size: 1, entry: 27000, stop: 27050, r0: 50, status: 'win', R: 2, closed: NOW - 4 * H },
  { id: 'i2', market: 'es', short: 'ES', side: 'buy', aset: false, size: 1, entry: 7400, stop: 7390, r0: 10, status: 'loss', R: -1, closed: NOW - 6 * H },
  { id: 'i3', market: 'gc', short: 'GC', side: 'sell', aset: true, size: 0.5, entry: 4080, stop: 4090, r0: 10, status: 'open', R: null, opened: NOW - 2 * H }];
const DATA = {
  'trades.json': merTrades, 'research.json': research, 'ict/trades.json': ictTrades,
  'snapshot.json': { markets: { xau: { price: 4010 } } },
  'ict/snapshot.json': { markets: { gc: { price: 4084 }, nq: { price: 27100 } } },
  'ctrader/account.json': { balance: 1012.5, equity: 1015, floating: 2.5, open: [{ symbol: 'XAUUSD' }], history: [{ closedAt: new Date((NOW - H) * 1000).toISOString(), net: 7 }], at: new Date((NOW - 60) * 1000).toISOString() },
  'ctrader/mirror.json': { state: { day: { date: '2026-11-06', startBalance: 1000 } } },
  'macro/forecast.json': { at: new Date((NOW - 600) * 1000).toISOString(), target: '2026-11-09', regime: { label: 'Dollar Smile right side (US outperformance)' }, targetEvent: null,
    playbook: [{ at: '2026-11-09T13:30:00.000Z', country: 'USD', title: 'CPI m/m', consensus: '0.3%', previous: '0.4%', expMovePct: { gold: 1.12, nq: 1.6 } },
      { at: '2026-11-09T15:00:00.000Z', country: 'USD', title: 'ISM Services PMI', expMovePct: { gold: 0.8 } }] },
  'coach.json': { proposals: [{ setup: 'rscalp', kind: 'promote', label: 'Make rscalp live', n: 60, exp: 0.25 }, { setup: 'x', kind: 'note' }] },   // the note is not actionable
  'health.json': { at: new Date((NOW - 600) * 1000).toISOString(), status: 'bad', summary: 'Kraken: BTC/USD stale' },
  'research/robustness.json': { claims: [{ id: 'gtrend', name: 'Gold trend N20', verdict: 'fragile' }, { id: 'replica', name: 'Gold replica', verdict: 'fragile' }] },
  'state.json': { tgChat: '42' } };
function writeData(dir, files = DATA) { for (const [f, v] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), JSON.stringify(v)); } }
const ROWS = [{ id: 'ict-a', name: 'ICT A-rule', v: 'edge' }, { id: 'mer-scalp-shadow', name: 'Scalp M15 → M1', v: 'losing' }, { id: 'mer-new-live', name: 'New', v: 'few' }];
const PREV = { sent: { day: '2026-11-05' }, sb: { 'ict-a': 'promising', 'mer-scalp-shadow': 'losing' }, robust: { gtrend: 'not proven', replica: 'fragile' } };

test('results: live only, closed in the window, gross and after costs; ICT costs from the micro round trip', () => {
  const D = readDataFrom(DATA);
  const mer = tally(D.trades.filter((x) => !x.shadow).concat(D.research.filter((x) => !/-x$/.test(x.session))), NOW - 86400, NOW, merNet);
  assert.deepEqual({ n: mer.n, w: mer.w, l: mer.l, R: mer.R }, { n: 3, w: 2, l: 1, R: 3 });
  assert.equal(mer.net, 1.8 + (-1 - 0.1) + 2);
  assert.equal(ictNet(ictTrades[0]), 2 - ICT_COST_PTS.nq / 50);
  assert.equal(ictNet({ ...ictTrades[0], Rnet: 1.5 }), 1.5, 'a recorded Rnet wins');
});
const readDataFrom = (files) => ({ trades: files['trades.json'], research: files['research.json'], ictTrades: files['ict/trades.json'], snapshot: files['snapshot.json'], ictSnap: files['ict/snapshot.json'],
  account: files['ctrader/account.json'], mirror: files['ctrader/mirror.json'], forecast: files['macro/forecast.json'], coach: files['coach.json'], health: files['health.json'],
  robust: files['research/robustness.json'], state: files['state.json'] });

test('cTrader line: balance, day P&L from the mirror start balance; history + floating otherwise', () => {
  const D = readDataFrom(DATA);
  assert.equal(ctraderLine(D.account, D.mirror, NOW, NOW - 86400, 'daily'), 'cTrader demo: balance $1012.50, day +$15.00, 1 open (+$2.50 floating)');
  assert.match(ctraderLine(D.account, { state: { day: { date: '2026-11-05', startBalance: 900 } } }, NOW, NOW - 86400, 'daily'), /day \+\$9\.50/);   // 7 closed + 2.5 floating
  assert.match(ctraderLine(D.account, D.mirror, NOW, NOW - 7 * 86400, 'preview'), /week \+\$9\.50/);
  assert.equal(ctraderLine(null, null, NOW, 0, 'daily'), 'cTrader demo: no account data yet.');
  assert.match(ctraderLine({ ...D.account, at: new Date((NOW - 5 * H) * 1000).toISOString() }, D.mirror, NOW, 0, 'daily'), /as of Fri 6 Nov 16:20 UTC/);
});

test('open positions: floating R from the latest prices, sized; ICT A-setups tagged', () => {
  const pos = openPositions(readDataFrom(DATA));
  assert.deepEqual(pos.map((p) => [p.name, p.R, p.tag]), [['XAU/USD buy', 0.5, 'Gold trend'], ['GC sell', -0.2, 'ICT A']]);
  assert.equal(openLine(pos), 'Open: 2, floating +0.30R: XAU/USD buy +0.50R (Gold trend), GC sell −0.20R (ICT A)');
  assert.equal(openLine([]), 'Open: none.');
});

test('macro: regime and the next day\'s first event with consensus and expected moves', () => {
  const fc = DATA['macro/forecast.json'];
  assert.deepEqual(macroLines(fc, NOW), ['Macro: Dollar Smile right side (US outperformance)', 'Mon 9 Nov: USD CPI m/m 13:30 UTC (cons 0.3%, prev 0.4%), gold ±1.1%, NQ ±1.6% · +1 more']);
  assert.match(macroLines({ ...fc, playbook: [] }, NOW)[1], /no high-impact event on the calendar\.$/);
  assert.match(macroLines({ ...fc, playbook: [], targetEvent: 'Non-Farm Payrolls' }, NOW)[1], /event day \(Non-Farm Payrolls\)/);
  assert.match(macroLines({ ...fc, at: '2026-11-04T10:00:00Z' }, NOW)[0], /\(as of Wed 4 Nov\)$/);
  assert.deepEqual(macroLines(null, NOW), ['Macro: no forecast yet.']);
});

test('changes since the last digest: scoreboard movers and robustness verdicts; nothing on the first digest', () => {
  assert.deepEqual(movers(ROWS, PREV.sb), [{ id: 'ict-a', name: 'ICT A-rule', from: 'promising', to: 'edge' }]);
  assert.deepEqual(movers(ROWS, null), []);
  assert.deepEqual(robustChanges(DATA['research/robustness.json'], PREV.robust), [{ id: 'gtrend', name: 'Gold trend N20', from: 'not proven', to: 'fragile' }]);
  const W = waiting(readDataFrom(DATA), NOW, PREV);
  assert.deepEqual(W, ['Coach: 1 proposal to OK: Make rscalp live', 'Data feeds bad: Kraken: BTC/USD stale', 'Robustness: Gold trend N20 not proven → fragile']);
  const clean = waiting({ ...readDataFrom(DATA), coach: {}, health: { at: new Date(NOW * 1000).toISOString(), status: 'ok' } }, NOW, { robust: { gtrend: 'fragile', replica: 'fragile' } });
  assert.deepEqual(clean, []);
  assert.deepEqual(waiting({ ...readDataFrom(DATA), coach: {}, health: { at: '2026-11-06T10:00:00Z', status: 'ok' } }, NOW, {}), ['Data feeds: last check Fri 6 Nov 10:00 UTC.']);
});

test('the digest: every section, under 15 lines, plain numbers', () => {
  const d = buildDigest(readDataFrom(DATA), { now: NOW, kind: 'daily', prev: PREV, sbRows: ROWS });
  assert.ok(d.lines.length <= 15, `${d.lines.length} lines`);
  assert.equal(d.title, 'Daily digest · Fri 6 Nov: Meridian +2.70R · ICT +1.97R net');
  assert.equal(d.msg, [
    'Today, closed paper trades (gross / after costs):',
    'Meridian +3.00R / +2.70R (3: 2W 1L)',
    'ICT desk A-setups +2.00R / +1.97R (1: 1W 0L) · all signals +1.00R (2)',
    'cTrader demo: balance $1012.50, day +$15.00, 1 open (+$2.50 floating)',
    'Open: 2, floating +0.30R: XAU/USD buy +0.50R (Gold trend), GC sell −0.20R (ICT A)',
    'Macro: Dollar Smile right side (US outperformance)',
    'Mon 9 Nov: USD CPI m/m 13:30 UTC (cons 0.3%, prev 0.4%), gold ±1.1%, NQ ±1.6% · +1 more',
    'Waiting on you:',
    '• Coach: 1 proposal to OK: Make rscalp live',
    '• Data feeds bad: Kraken: BTC/USD stale',
    '• Robustness: Gold trend N20 not proven → fragile',
    'Scoreboard movers: ICT A-rule Promising → Edge',
    'Fri 6 Nov 21:20 UTC · London 21:20 · New York 16:20'].join('\n'));
  assert.deepEqual(d.state, { sb: { 'ict-a': 'edge', 'mer-scalp-shadow': 'losing', 'mer-new-live': 'few' }, robust: { gtrend: 'fragile', replica: 'fragile' } });
  // Sunday preview: 7 days back, "week" for the demo account; empty files never throw
  const p = buildDigest({}, { now: T('2026-11-08T21:20:00Z'), kind: 'preview', prev: {}, sbRows: null });
  assert.match(p.title, /^Week ahead · Sun 8 Nov/); assert.match(p.msg, /^Past 7 days/); assert.match(p.msg, /Meridian no closed trades/);
  assert.match(p.msg, /Scoreboard: could not be built this time\./); assert.ok(p.lines.length <= 15);
});

test('scoreboard: the page\'s own functions build rows from council-data files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-sb-'));
  try {
    writeData(dir);
    const rows = scoreboardRows(readData(dir), NOW);
    assert.ok(Array.isArray(rows) && rows.length > 0);
    assert.ok(rows.every((r) => r.id && r.v));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function fakeFetch() {
  const calls = [], f = { calls, fail: false };
  f.fn = async (url, opt) => { calls.push({ url, body: JSON.parse(opt.body) }); return { ok: !f.fail, status: f.fail ? 500 : 200 }; };
  return f;
}
test('main: sends once a day through ntfy + Telegram, survives a restart, retries a failed send, off with COUNCIL_ALERTS=off', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-'));
  const env = { NTFY_TOPIC: 'test-topic', TELEGRAM_BOT_TOKEN: 'tok' }, scoreboard = () => ROWS;
  try {
    writeData(dir);
    let f = fakeFetch(), r = await main(dir, { env, fetchFn: f.fn, now: T('2026-11-06T20:00:00Z'), scoreboard });
    assert.match(r.skipped, /outside/); assert.equal(f.calls.length, 0);

    // off: nothing sent, nothing written
    r = await main(dir, { env: { ...env, COUNCIL_ALERTS: 'off' }, fetchFn: f.fn, now: NOW, scoreboard });
    assert.match(r.skipped, /COUNCIL_ALERTS=off/); assert.equal(f.calls.length, 0); assert.equal(fs.existsSync(path.join(dir, 'digest.json')), false);

    // every channel down: not marked, tried again next round
    f.fail = true; r = await main(dir, { env, fetchFn: f.fn, now: NOW, scoreboard });
    assert.equal(r.sent, false); assert.equal(f.calls.length, 2);
    let st = JSON.parse(fs.readFileSync(path.join(dir, 'digest.json'), 'utf8'));
    assert.equal(st.sent, undefined); assert.ok(st.error.ntfy && st.error.telegram); assert.ok(!JSON.stringify(st).includes('tok/'), 'token never stored');

    f = fakeFetch(); r = await main(dir, { env, fetchFn: f.fn, now: NOW + 300, scoreboard });
    assert.equal(r.sent, true); assert.equal(f.calls.length, 2);
    const tg = f.calls.find((c) => /api\.telegram\.org\/bottok\//.test(c.url)), nt = f.calls.find((c) => c.url === 'https://ntfy.sh/');
    assert.equal(tg.body.chat_id, '42', 'chat id from state.json'); assert.match(tg.body.text, /^Daily digest · Fri 6 Nov/); assert.ok(tg.body.text.endsWith(COUNCIL_URL));
    assert.equal(nt.body.topic, 'test-topic'); assert.equal(nt.body.click, COUNCIL_URL); assert.match(nt.body.message, /Meridian \+3\.00R \/ \+2\.70R/);
    assert.ok(nt.body.message.split('\n').length <= 15);
    st = JSON.parse(fs.readFileSync(path.join(dir, 'digest.json'), 'utf8'));
    assert.equal(st.sent.day, '2026-11-06'); assert.equal(st.sent.kind, 'daily'); assert.equal(st.error, undefined);
    assert.deepEqual(st.sb, { 'ict-a': 'edge', 'mer-scalp-shadow': 'losing', 'mer-new-live': 'few' }); assert.equal(st.robust.gtrend, 'fragile');
    assert.match(st.last.msg, /Scoreboard: verdicts recorded/, 'first digest: baseline only');

    // later rounds the same evening, and a restart (a fresh call reading the same files): nothing more
    for (const t of [NOW + 600, NOW + 7000]) { r = await main(dir, { env, fetchFn: f.fn, now: t, scoreboard }); assert.match(r.skipped, /already sent for 2026-11-06/); }
    assert.equal(f.calls.length, 2);

    // Sunday preview reports changes against Friday's baseline
    const rows2 = [{ id: 'ict-a', name: 'ICT A-rule', v: 'promising' }, { id: 'mer-scalp-shadow', name: 'Scalp M15 → M1', v: 'losing' }];
    r = await main(dir, { env, fetchFn: f.fn, now: T('2026-11-08T21:16:00Z'), scoreboard: () => rows2 });
    assert.equal(r.sent, true); assert.match(r.title, /^Week ahead · Sun 8 Nov/); assert.match(r.msg, /Scoreboard movers: ICT A-rule Edge → Promising/);

    // a scoreboard that throws still sends the rest
    r = await main(dir, { env, fetchFn: f.fn, now: T('2026-11-09T21:16:00Z'), scoreboard: () => { throw new Error('boom'); } });
    assert.equal(r.sent, true); assert.equal(r.sbError, 'boom'); assert.match(r.msg, /could not be built/);
    st = JSON.parse(fs.readFileSync(path.join(dir, 'digest.json'), 'utf8'));
    assert.deepEqual(st.sb, { 'ict-a': 'promising', 'mer-scalp-shadow': 'losing' }, 'the last good baseline is kept');

    // --dry: prints, sends and writes nothing
    const before = fs.readFileSync(path.join(dir, 'digest.json'), 'utf8'), n = f.calls.length;
    r = await main(dir, { env: { COUNCIL_ALERTS: 'off' }, fetchFn: f.fn, now: T('2026-11-10T21:20:00Z'), dry: true, scoreboard });
    assert.equal(r.dry, true); assert.equal(f.calls.length, n); assert.equal(fs.readFileSync(path.join(dir, 'digest.json'), 'utf8'), before);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

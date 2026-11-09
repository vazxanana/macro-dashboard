// node --test tests/datahealth.test.mjs — council data files health (council/datahealth.mjs) and its place in the data check
// (council/datacheck.mjs → health.json feeds.files + brief): in-memory council-data, injected clock, no network, no secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkFiles, freshness, FILES, bizDays, digestDue, historyDue, sourceIssues, cotIssues, asFeed, brief, ts } from '../council/datahealth.mjs';
import { alertDecision, badList, main } from '../council/datacheck.mjs';

const T = (s) => Date.parse(s) / 1000, iso = (t) => new Date(t * 1000).toISOString();
const NOW = T('2026-11-04T15:02:00Z');   // Wednesday 10:02 New York: every market open
const spec = (f) => FILES.find((s) => s.file === f);

// a small healthy council-data at `now`; `over` replaces or (with null) removes files
function world(now = NOW, over = {}) {
  const F = {
    'snapshot.json': { at: iso(now - 180), errors: {}, feed: { xau: 'OANDA', eurusd: 'OANDA', btc: 'Kraken' }, nqLast: { price: 25010, at: now - 300 },
      markets: { xau: { label: 'XAU/USD', price: 4000, open: true }, eurusd: { label: 'EUR/USD', price: 1.1, open: true }, btc: { label: 'BTC/USD', price: 70000, open: true } } },
    'state.json': { lastRun: now - 180 },
    'trades.json': [{ id: 'xau-a', market: 'xau', side: 'buy', status: 'open', entry: 3990, stop: 3950, checked: now - 200 }, { id: 'xau-b', market: 'xau', status: 'win' }],
    'config.json': { buf: 0.15, minRR: 1.2, minRisk: 1.1, history: [], btAt: iso(now - 12 * 3600) },
    'research.json': [],
    'mt5/signals.csv': `# council-bridge v1 generated ${now - 180} x\nid,market,k,side\nxau-a,xau,scalp,buy\n`,
    'analysis/latest.md': '# Week\n<!-- live-rule:start -->\nx\n<!-- live-rule:end -->\n',
    'ict/snapshot.json': { at: iso(now - 600), errors: {}, markets: { gc: { short: 'GC', price: 4020, at: now - 900 }, nq: { short: 'NQ', price: 25000, at: now - 900 } } },
    'ict/trades.json': [],
    'macro/forecast.json': { at: iso(now - 1800), assets: { gold: { label: 'Gold', pUp: 0.53, score: 0.1, last: 3990 }, eurusd: { label: 'EUR/USD', pUp: 0.49, score: -0.4, last: 1.1 } },
      regime: { vix: 18, vixTermRatio: 0.9, realYield: { level: 1.9 }, us2y: 3.9, eu2y: 2.1, curve10y3m: 0.4, dxyProxy: 99 },
      goldScore: { ok: true, score: 0.2, asOf: '2026-11-06', stale: [] }, sources: { 'fred:DGS10': 'ok, last 2026-11-02', 'calendar:nextweek': 'failed (HTTP 404)' } },
    'macro/history.json': [{ target: '2026-11-04', asset: 'gold' }],
    'coach.json': { at: iso(now - 5 * 3600), decay: { at: iso(now - 2 * 3600) } },
    'backtest.json': { at: iso(now - 12 * 3600) },
    'research/replay-2w.json': {},
    'reviews/latest.md': '# Review',
    'reviews/2026-11-03.md': '# Review',
  };
  for (const [k, v] of Object.entries(over)) if (v === null) delete F[k]; else F[k] = v;
  return { text: (f) => (f in F ? (typeof F[f] === 'string' ? F[f] : JSON.stringify(F[f])) : null),
    list: (d) => Object.keys(F).filter((f) => f.startsWith(d + '/')).map((f) => f.slice(d.length + 1)), F };
}
const issues = (r, f) => (r.files[f] ? r.files[f].issues : []);
const sev = (r, f) => r.files[f] && r.files[f].status;

test('a healthy council-data is all ok; optional files that are absent are skipped, required ones page', () => {
  const r = checkFiles(world(), NOW);
  const notOk = Object.entries(r.files).filter(([, x]) => x.status !== 'ok').map(([f, x]) => `${f}: ${x.issues.map((i) => i.detail).join('; ')}`);
  assert.deepEqual(notOk, []); assert.equal(r.status, 'ok');
  assert.equal(r.files['watchdog.json'], undefined, 'absent optional file: not listed');
  assert.equal(r.files['macro/forecast.json'].ageMin, 30);
  const miss = checkFiles(world(NOW, { 'trades.json': null, 'config.json': '{ "buf": 0.1,' }), NOW);
  assert.equal(issues(miss, 'trades.json')[0].kind, 'missing'); assert.equal(sev(miss, 'trades.json'), 'bad');
  assert.match(issues(miss, 'config.json')[0].detail, /^does not parse/);
});

test('freshness: per-file thresholds on the wall clock, inclusive at the limit', () => {
  const s = spec('snapshot.json');   // warn 20, bad 30
  assert.equal(freshness(s, NOW - 20 * 60, NOW).sev, null);
  assert.equal(freshness(s, NOW - 21 * 60, NOW).sev, 'warn');
  assert.equal(freshness(s, NOW - 31 * 60, NOW).sev, 'bad');
  assert.match(freshness(s, NOW - 31 * 60, NOW).detail, /^not updated for 31 min \(expected 1-11 min \(council loop\); alert after 30 min\)/);
  const f = spec('macro/forecast.json');   // every ~70 min: warn 2.5 h, bad 4 h
  assert.equal(freshness(f, NOW - 140 * 60, NOW).sev, null); assert.equal(freshness(f, NOW - 160 * 60, NOW).sev, 'warn'); assert.equal(freshness(f, NOW - 5 * 3600, NOW).sev, 'bad');
  const w = spec('watchdog.json');
  assert.equal(freshness(w, NOW - 4 * 3600, NOW).sev, 'warn'); assert.match(freshness(w, NOW - 13 * 3600, NOW).detail, /nobody is alerted if the council loop stops/);
  assert.equal(freshness({ every: 'x' }, NOW - 99 * 3600, NOW), null, 'no rule, no verdict');
  assert.equal(ts('1794208050'), 1794208050); assert.ok(Math.abs(ts(1794208050123) - 1794208050.123) < 1e-3); assert.equal(ts('nope'), null);
});

test('freshness: the ICT desk counts open CME minutes only (weekend, Sunday reopen, Thanksgiving early close)', () => {
  const s = spec('ict/snapshot.json'), fri = T('2026-11-06T21:50:00Z');   // Fri 16:50 New York, 10 min before the weekend close
  assert.equal(freshness(s, fri, T('2026-11-08T22:30:00Z')).ageMin, 10);   // Sunday before the 18:00 New York reopen
  assert.equal(freshness(s, fri, T('2026-11-08T22:30:00Z')).sev, null);
  assert.equal(freshness(s, fri, T('2026-11-09T00:00:00Z')).sev, 'warn');   // 10 + 60 open minutes
  assert.equal(freshness(s, fri, T('2026-11-09T00:30:00Z')).sev, 'bad');    // 100 > 90
  assert.match(freshness(s, fri, T('2026-11-09T00:30:00Z')).detail, /of open market/);
  const thx = T('2026-11-26T17:50:00Z');   // Thanksgiving 12:50 New York, CME shuts at 13:00
  assert.equal(freshness(s, thx, T('2026-11-26T22:30:00Z')).sev, null);
  // the weekend is quiet for the ICT desk but not for the 24/7 loop
  const r = checkFiles(world(T('2026-11-08T22:30:00Z'), { 'ict/snapshot.json': { at: iso(fri), markets: {} } }), T('2026-11-08T22:30:00Z'));
  assert.equal(sev(r, 'ict/snapshot.json'), 'ok');
});

test('schedules: business days, digest send days, macro log target days', () => {
  assert.equal(bizDays('2026-11-05', '2026-11-09'), 2);      // Fri, Mon
  assert.equal(bizDays('2026-11-10', '2026-11-12'), 1);      // Veterans Day (Wed 11 Nov) is off
  assert.equal(bizDays('2026-11-25', '2026-11-30'), 1);      // Thanksgiving off, the Friday after too (CME early close): Monday only
  assert.deepEqual(digestDue(T('2026-11-07T12:00:00Z')).day, '2026-11-06');   // Saturday: Friday's digest
  assert.deepEqual(digestDue(T('2026-11-08T21:00:00Z')).day, '2026-11-06');   // Sunday before the preview
  assert.deepEqual(digestDue(T('2026-11-08T21:20:00Z')).day, '2026-11-08');   // the Sunday preview
  assert.deepEqual(digestDue(T('2026-12-26T10:00:00Z')).day, '2026-12-24');   // Christmas (CME closed) has none
  const late = T('2026-11-06T23:00:00Z'), w = (sent) => world(late, { 'digest.json': { sent: { day: sent } } });
  assert.match(issues(checkFiles(w('2026-11-05'), late), 'digest.json')[0].detail, /daily digest for Fri 6 Nov was not sent \(due 21:15 UTC; last sent 2026-11-05\)/);
  assert.equal(sev(checkFiles(w('2026-11-05'), T('2026-11-06T22:30:00Z')), 'digest.json'), 'ok', '90 min grace');
  assert.equal(sev(checkFiles(w('2026-11-06'), late), 'digest.json'), 'ok');
  assert.equal(historyDue(T('2026-11-09T07:00:00Z')), '2026-11-09'); assert.equal(historyDue(T('2026-11-08T12:00:00Z')), '2026-11-06');
  const mon = T('2026-11-09T07:00:00Z'), h = checkFiles(world(mon, { 'macro/history.json': [{ target: '2026-11-06', y: 1 }] }), mon);
  assert.match(issues(h, 'macro/history.json')[0].detail, /no forecast logged for Mon 9 Nov \(newest 2026-11-06\)/);
});

test('sources: FRED by its own cadence (core rates page), calendar, COT release weeks', () => {
  const S = (o, now = NOW) => sourceIssues(o, now).map(([k, s, d]) => `${k}/${s}: ${d}`);
  assert.deepEqual(S({ 'fred:DGS10': 'ok, last 2026-10-30' }), []);                          // 3 business days
  assert.match(S({ 'fred:DGS10': 'ok, last 2026-10-28' })[0], /^input\/warn: fred:DGS10 last value 2026-10-28, 5 business days old/);
  assert.match(S({ 'fred:DGS10': 'ok, last 2026-10-20' })[0], /^input\/bad/);                   // 11 business days, a core rate
  assert.match(S({ 'fred:VIXCLS': 'ok, last 2026-10-20' })[0], /^input\/warn/);                 // not a core rate: never pages
  assert.match(S({ 'fred:BSCICP03DEM665S': 'ok, last 2024-01-01' })[0], /^input\/warn: .*drops it as "no data"/);
  assert.deepEqual(S({ 'fred:WALCL': 'ok, last 2026-10-28' }), []);
  assert.match(S({ 'fred:DGS2': 'failed (HTTP 500)' })[0], /^source\/bad/);
  assert.deepEqual(S({ 'calendar:nextweek': 'failed (HTTP 404)' }), [], 'early in the week next week\'s calendar may not exist yet');
  assert.match(S({ 'calendar:nextweek': 'failed (HTTP 404)' }, T('2026-11-06T12:00:00Z'))[0], /misses Monday's releases/);
  assert.match(S({ 'rss:Fed': 'failed (timeout)' })[0], /^source\/note/);
  const C = (ms, now = T('2026-11-09T07:00:00Z')) => cotIssues({ markets: ms }, now).map(([k, s, d]) => `${k}/${s}: ${d}`);
  const g = (asOf, o = {}) => ({ k: 'gold', asOf, long: 10, short: 4, net: 6, ...o });
  assert.deepEqual(C([g('2026-11-03'), { ...g('2026-11-03'), k: 'es' }]), []);
  assert.match(C([g('2026-10-20')])[0], /^stale\/warn: newest CFTC report is for 2026-10-20 \(20 days ago/);
  assert.match(C([g('2026-10-06')])[0], /^stale\/bad/);
  assert.match(C([g('2026-11-03'), { ...g('2026-10-27'), k: 'es' }])[0], /^mismatch\/warn: markets on different report weeks/);
  assert.match(C([g('2026-11-03', { net: 9 })])[0], /net ≠ long − short for gold/);
});

test('sanity bands and cross-file checks: prices, yields, VIX, P(up), score, spot vs future, Trader vs its signal file', () => {
  const W = world().F, sn = (m) => ({ ...W['snapshot.json'], markets: { ...W['snapshot.json'].markets, ...m } });
  let r = checkFiles(world(NOW, { 'snapshot.json': sn({ xau: { label: 'XAU/USD', price: 40000 }, eurusd: { label: 'EUR/USD', price: 0 } }) }), NOW);
  assert.deepEqual(issues(r, 'snapshot.json').filter((x) => x.kind === 'range').map((x) => x.detail), ['XAU/USD price 40000 is outside the plausible 1000–12000', 'EUR/USD price 0 is outside the plausible 0.8–1.6']);
  r = checkFiles(world(NOW, { 'snapshot.json': sn({ xau: { label: 'XAU/USD', price: 3790 } }) }), NOW);   // GC 4020: 6% apart
  assert.match(issues(r, 'snapshot.json').find((x) => x.kind === 'mismatch').detail, /spot gold 3790 vs the GC future 4020: 6\.1% apart/);
  assert.equal(sev(r, 'snapshot.json'), 'bad');
  r = checkFiles(world(NOW, { 'snapshot.json': sn({ xau: { label: 'XAU/USD', price: 3900 } }) }), NOW);   // 3.1%: a warning
  assert.equal(sev(r, 'snapshot.json'), 'warn');
  r = checkFiles(world(NOW, { 'snapshot.json': { ...W['snapshot.json'], feed: { xau: 'Kraken' } } }), NOW);
  assert.match(issues(r, 'snapshot.json')[0].detail, /XAU\/USD read from Kraken, not OANDA/);
  const fc = W['macro/forecast.json'];
  r = checkFiles(world(NOW, { 'macro/forecast.json': { ...fc, assets: { gold: { label: 'Gold', pUp: 0.9, score: 1.4, last: 3990 } }, regime: { ...fc.regime, vix: 0.18, us2y: 39 }, goldScore: { ok: true, score: 12, asOf: '2026-11-06' } } }), NOW);
  assert.deepEqual(issues(r, 'macro/forecast.json').map((x) => x.detail), ['Gold P(up) 0.9 is outside the plausible 0.35–0.65', 'Gold score 1.4 is outside the plausible -1–1',
    'VIX 0.18 is outside the plausible 8–90', 'US 2Y yield 39 is outside the plausible -1–12', 'Gold Macro Score 12 is outside the plausible -5–5']);
  // the MT5 / cTrader signal file 20 min behind the Trader pages even though its own staleness is the watchdog's
  r = checkFiles(world(NOW, { 'mt5/signals.csv': `# council-bridge v1 generated ${NOW - 1500} x\nid,market,k,side\nxau-a,xau,scalp\n` }), NOW);
  assert.deepEqual(issues(r, 'mt5/signals.csv').map((x) => `${x.sev}${x.quiet ? ' (quiet)' : ''}: ${x.detail.split(' (')[0]}`), ['warn (quiet): not updated for 25 min', 'bad: 1 row with the wrong number of columns', 'bad: 22 min behind the Trader: MT5 / cTrader bridges get old signals']);
  // a live open trade with its stop on the wrong side pages; the same on a shadow trade is a warning; a repeated id pages
  r = checkFiles(world(NOW, { 'trades.json': [{ id: 'a', market: 'xau', side: 'buy', status: 'open', entry: 3990, stop: 4010 }, { id: 'b', market: 'xau', side: 'sell', status: 'pending', entry: 3990, stop: 3980, shadow: true }, { id: 'a', status: 'loss' }] }), NOW);
  assert.deepEqual(issues(r, 'trades.json').map((x) => x.sev + ' ' + x.detail.split(' (')[0]), ['bad 1 trade id recorded twice', 'bad 1 live open trade with impossible levels', 'warn 1 shadow trade with impossible levels']);
  r = checkFiles(world(NOW, { 'config.json': { ...W['config.json'], minRR: 0, btAt: iso(NOW - 40 * 3600) } }), NOW);
  assert.deepEqual(issues(r, 'config.json').map((x) => x.sev), ['bad', 'warn']);
  r = checkFiles(world(NOW, { 'analysis/latest.md': '<!-- macro:start -->\nx\n' }), NOW);
  assert.match(issues(r, 'analysis/latest.md')[0].detail, /without an end marker: macro/);
});

test('health.json: files as a feed, the brief, and the data check pages bad files only (not quiet ones), once confirmed', () => {
  const now = NOW, r = checkFiles(world(now, { 'watchdog.json': { at: iso(now - 13 * 3600) }, 'snapshot.json': { ...world().F['snapshot.json'], at: iso(now - 45 * 60) } }), now);
  const feeds = { oanda: { label: 'OANDA', markets: { xau: { label: 'XAU/USD', status: 'ok', issues: [] } } }, files: asFeed(r) };
  assert.equal(feeds.files.markets['watchdog.json'].label, 'Loop watchdog (watchdog.json)');
  assert.equal(feeds.files.markets['snapshot.json'].issues[0].quiet, true, 'a stopped loop is the watchdog\'s page');
  assert.deepEqual(badList(feeds).map((b) => b.id), ['files:watchdog.json']);
  const b = brief(feeds); assert.equal(b.status, 'bad'); assert.equal(b.bad.length, 2); assert.match(b.line, /^2 problems, 1 warning: Trader snapshot \(snapshot\.json\): not updated for 45 min/);
  let st = null; const h = { feeds };
  let d = alertDecision(h, st, now); assert.equal(d.ev, null); st = d.alert;                    // 1st bad check: not yet
  d = alertDecision(h, st, now + 1400); assert.equal(d.ev.title, 'Council data problem: 1 file');
  assert.match(d.ev.msg, /^• Council data files Loop watchdog \(watchdog\.json\): not updated for 13\.0 h \(expected GitHub cron/); assert.match(d.ev.msg, /Data chip/);
  const mixed = { feeds: { ...feeds, oanda: { label: 'OANDA', markets: { xau: { label: 'XAU/USD', status: 'bad', issues: [{ sev: 'bad', detail: 'no new candle' }] } } } } };
  st = null; alertDecision(mixed, st, now); st = alertDecision(mixed, null, now).alert; assert.equal(alertDecision(mixed, st, now + 1400).ev.title, 'Data problem: 2 items');
  const clean = asFeed(checkFiles(world(), NOW)); assert.equal(brief({ files: clean }).line, 'All data fresh and in range');
});

test('datacheck main: in a council-data checkout health.json gets feeds.files and brief; outside one it does not', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datahealth-'));
  try {
    const w = world();
    for (const [f, v] of Object.entries(w.F)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v)); }
    const down = async () => ({ ok: false, status: 503, json: async () => ({ error: 'down' }) });
    const h = await main(dir, { env: { COUNCIL_ALERTS: 'off' }, fetchFn: down, now: NOW, pause: 0 });
    assert.equal(h.feeds.files.status, 'ok'); assert.ok(h.feeds.files.markets['macro/forecast.json']);
    assert.equal(h.feeds.files.markets['health.json'], undefined, 'it does not judge the file it is writing');
    assert.equal(h.brief.status, 'bad'); assert.match(h.brief.line, /OANDA spot \(md\/bars\) XAU\/USD: unreachable/);
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'health.json'), 'utf8')); assert.equal(saved.feeds.files.label, 'Council data files'); assert.ok(saved.brief);
    fs.rmSync(path.join(dir, 'snapshot.json'));
    const h2 = await main(dir, { env: { COUNCIL_ALERTS: 'off' }, fetchFn: down, now: NOW + 660, pause: 0 });
    assert.equal(h2.feeds.files, undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// node --test tests/datacheck.test.mjs — the candle-feed monitor (council/datacheck.mjs) against a fake fetch: no network, no secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sessionOpen, openSecs, usHolidays, checkBars, runChecks, alertDecision, main, CFG, FEEDS } from '../council/datacheck.mjs';

const T = (s) => Date.parse(s) / 1000;
const NOW = T('2026-11-04T15:02:00Z');   // Wednesday 10:02 New York (EST): every market open

// 5-minute candles from `from` to `to` (exclusive), only while the market is open; a gentle deterministic wave around `px`
function series(hours, from, to, px = 100) {
  const out = []; let last = px;
  for (let t = from; t < to; t += 300) {
    if (!sessionOpen(hours, t)) continue;
    const c = px * (1 + 0.002 * Math.sin(t / 3000)), o = last;
    out.push({ time: t, open: o, high: Math.max(o, c) + px * 0.0004, low: Math.min(o, c) - px * 0.0004, close: c }); last = c;
  }
  return out;
}
const upToNow = (hours, px, now = NOW, span = 2 * 86400) => series(hours, Math.floor((now - span) / 300) * 300, now, px);

test('market hours: weekend, daily halt, Sunday reopen, holidays; crypto never closes', () => {
  assert.equal(sessionOpen('fx', T('2026-11-06T21:59:00Z')), true);    // Fri 16:59 New York
  assert.equal(sessionOpen('fx', T('2026-11-06T22:00:00Z')), false);   // Fri 17:00: weekend
  assert.equal(sessionOpen('cme', T('2026-11-07T15:00:00Z')), false);  // Saturday
  assert.equal(sessionOpen('cme', T('2026-11-08T22:59:00Z')), false);  // Sun 17:59
  assert.equal(sessionOpen('cme', T('2026-11-08T23:00:00Z')), true);   // Sun 18:00 reopen
  assert.equal(sessionOpen('metal', T('2026-11-04T22:30:00Z')), false); // Wed 17:30: daily halt
  assert.equal(sessionOpen('crypto', T('2026-11-07T15:00:00Z')), true);
  // CME US holidays: Thanksgiving 26 Nov 2026 trades until 13:00 New York; forex does not stop
  assert.equal(usHolidays(2026).get('2026-11-26'), 'early');
  assert.equal(sessionOpen('cme', T('2026-11-26T17:00:00Z')), true);   // 12:00
  assert.equal(sessionOpen('cme', T('2026-11-26T19:00:00Z')), false);  // 14:00
  assert.equal(sessionOpen('fx', T('2026-11-26T19:00:00Z')), true);
  assert.equal(usHolidays(2027).get('2027-03-26'), 'closed');           // Good Friday 2027
  assert.equal(usHolidays(2027).get('2027-12-24'), 'closed');           // Christmas on a Saturday: observed Friday
  assert.equal(sessionOpen('fx', T('2026-12-25T15:00:00Z')), false);
  // open-market time between Friday's last candle and Sunday 18:10: only the 10 minutes after the reopen count
  assert.equal(openSecs('cme', T('2026-11-06T22:00:00Z'), T('2026-11-08T23:10:00Z')), 600);
  assert.equal(openSecs('crypto', 0, 600), 600);
});

test('clean candles pass; closed markets read "closed", not stale', () => {
  const r = checkBars(upToNow('fx', 1.1), { hours: 'fx', now: NOW });
  assert.equal(r.status, 'ok', JSON.stringify(r.issues)); assert.deepEqual(r.issues, []); assert.ok(r.maxJump > 0 && r.maxJump < 5);
  const sat = T('2026-11-07T15:00:00Z'), w = checkBars(upToNow('metal', 4000, sat), { hours: 'metal', now: sat });
  assert.equal(w.status, 'closed', JSON.stringify(w.issues)); assert.equal(w.staleMin, 0);
});

test('stale during market hours is bad; the CNBC delay allowance is wider', () => {
  const b = upToNow('cme', 25000).filter((x) => x.time <= NOW - 40 * 60);
  const r = checkBars(b, { hours: 'cme', now: NOW, staleMin: 30 });
  assert.equal(r.status, 'bad'); assert.equal(r.issues[0].kind, 'stale'); assert.match(r.issues[0].detail, /no new candle for 3[5-9] open-market minutes/);
  assert.equal(checkBars(upToNow('cme', 25000).filter((x) => x.time <= NOW - 20 * 60), { hours: 'cme', now: NOW, staleMin: 30 }).status, 'ok');
});

test('zero / negative prices, broken candles and out-of-order times are bad', () => {
  const z = upToNow('crypto', 60000); z[100] = { ...z[100], low: 0 };
  assert.deepEqual(checkBars(z, { hours: 'crypto', now: NOW }).issues.map((x) => x.kind), ['price']);
  const n = upToNow('crypto', 60000); n[5] = { ...n[5], close: -1 };
  assert.equal(checkBars(n, { hours: 'crypto', now: NOW }).status, 'bad');
  const k = upToNow('crypto', 60000); k[200] = { ...k[200], high: k[200].low - 1 };
  assert.deepEqual(checkBars(k, { hours: 'crypto', now: NOW }).issues.map((x) => x.kind), ['candle']);
  const o = upToNow('crypto', 60000); o.splice(300, 0, { ...o[299] });
  assert.deepEqual(checkBars(o, { hours: 'crypto', now: NOW }).issues.map((x) => x.kind), ['order']);
  assert.equal(checkBars([], { hours: 'crypto', now: NOW }).issues[0].kind, 'error');
});

test('jumps beyond the ATR limit are bad; a normal big candle is not', () => {
  const b = upToNow('fx', 1.1), i = b.length - 10, base = b[i - 1].close, atr = 1.1 * 0.0013;
  b[i] = { time: b[i].time, open: base, high: base + 40 * atr, low: base, close: base };
  const r = checkBars(b, { hours: 'fx', now: NOW });
  assert.equal(r.status, 'bad'); assert.equal(r.issues[0].kind, 'jump'); assert.ok(r.maxJump > CFG.jumpAtr);
  const ok = upToNow('fx', 1.1); ok[i] = { ...ok[i], high: ok[i].high + 5 * atr };
  assert.equal(checkBars(ok, { hours: 'fx', now: NOW }).status, 'ok');
  // the move across the weekend is a reopen gap, not a jump
  const mon = T('2026-11-09T15:00:00Z'), w = upToNow('fx', 1.1, mon, 3 * 86400), j = w.findIndex((x) => x.time >= T('2026-11-08T23:00:00Z'));
  w[j] = { ...w[j], open: w[j].open * 1.02, high: w[j].high * 1.02 };
  assert.equal(checkBars(w, { hours: 'fx', now: mon }).issues.filter((x) => x.kind === 'jump').length, 0);
});

test('gaps: missing open-market candles warn, long ones are bad; the weekend and the daily halt are not gaps', () => {
  const short = upToNow('crypto', 100).filter((x) => !(x.time > NOW - 3 * 3600 && x.time <= NOW - 3 * 3600 + 25 * 60));
  const s = checkBars(short, { hours: 'crypto', now: NOW });
  assert.equal(s.status, 'warn'); assert.equal(s.issues[0].kind, 'gap');
  const long = upToNow('crypto', 100).filter((x) => !(x.time > NOW - 3 * 3600 && x.time <= NOW - 3 * 3600 + 90 * 60));
  assert.equal(checkBars(long, { hours: 'crypto', now: NOW }).status, 'bad');
  const halt = T('2026-11-04T00:00:00Z');   // Tue 19:00 New York: the 17:00-18:00 halt is in the window
  assert.equal(checkBars(upToNow('cme', 25000, halt, 86400), { hours: 'cme', now: halt }).status, 'ok');
});

// ─── the fake network ───
const bySym = { xau: 4000, eurusd: 1.1, gbpusd: 1.3, audusd: 0.66, usdcad: 1.38, usdchf: 0.8, XBTUSD: 100000, ETHUSD: 3500, SOLUSD: 180, XRPUSD: 2.4 };
const cnbcPx = { '@ND.1': 25000, '@SP.1': 6800, '@ES.1': 6800, '@DJ.1': 47000, '@TFS.1': 2400, '@GC.1': 4010 };
// net.now is the clock the fake feeds serve candles up to (a test moves it with each check)
function fakeNet({ now = NOW, oanda = {}, kraken = {}, cnbc = {}, sends = [] } = {}) {
  const calls = [], net = { calls, sends, now };
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fn = async (u, o = {}) => {
    u = String(u); calls.push(u);
    if (u.startsWith('https://ntfy.sh') || u.includes('api.telegram.org')) { sends.push({ url: u, body: JSON.parse(o.body) }); return res(sends.fail ? 500 : 200, {}); }
    if (u.includes('/md/bars')) { const q = new URL(u).searchParams, s = q.get('sym'), f = oanda[s];
      if (f === 503) return res(503, { error: 'OANDA_TOKEN not set' });
      if (f === 'kraken') return res(200, { src: 'Kraken', bars: [] });
      let b = upToNow(s === 'xau' ? 'metal' : 'fx', bySym[s], net.now); if (typeof f === 'function') b = f(b);
      return res(200, { src: 'OANDA', inst: s, tf: q.get('tf'), bars: b }); }
    if (u.includes('api.kraken.com')) { const p = new URL(u).searchParams.get('pair'), f = kraken[p];
      if (f === 'rate') return res(200, { error: ['EGeneral:Too many requests'] });
      let b = upToNow('crypto', bySym[p], net.now); if (typeof f === 'function') b = f(b);
      return res(200, { error: [], result: { [p]: b.map((x) => [x.time, String(x.open), String(x.high), String(x.low), String(x.close), '0', '1', 3]), last: 0 } }); }
    if (u.includes('ts-api.cnbc.com')) { const sym = decodeURIComponent(u.split('/bars/')[1].split('/')[0]), f = cnbc[sym];
      if (f === 'empty') return res(200, { barData: { priceBars: [] }, statusMessage: 'no data' });
      let b = upToNow('cme', cnbcPx[sym], net.now); if (typeof f === 'function') b = f(b);
      return res(200, { barData: { priceBars: b.map((x) => ({ open: String(x.open), high: String(x.high), low: String(x.low), close: String(x.close), tradeTimeinMills: String(x.time * 1000) })) } }); }
    return res(404, null);
  };
  net.fn = fn; return net;
}

test('runChecks reads every feed the bots use, the way they read it', async () => {
  const net = fakeNet(), h = await runChecks({ fetchFn: net.fn, now: NOW, pause: 0 });
  assert.equal(h.status, 'ok', h.summary); assert.equal(h.summary, 'All feeds clean');
  assert.deepEqual(Object.keys(h.feeds), ['oanda', 'kraken', 'cnbc']);
  assert.deepEqual(Object.keys(h.feeds.oanda.markets), ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']);
  assert.deepEqual(Object.keys(h.feeds.cnbc.markets), Object.keys(FEEDS.cnbc.markets));
  assert.ok(Object.keys(h.feeds.cnbc.markets).includes('gc'));
  assert.ok(net.calls.some((u) => /meridianx\.dev\/md\/bars\?sym=xau&tf=5m&n=300&r=\d+/.test(u)));
  assert.ok(net.calls.some((u) => u === 'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=5'));
  // CNBC 5M request starts on the hour (CNBC anchors bars at the start minute)
  const c = net.calls.find((u) => u.includes('%40ND.1/5M/')); assert.match(c, /\/5M\/\d{8}\d{2}0000\//);
});

test('a broken feed is reported per market, with the fallback symbol the tracker would use', async () => {
  const net = fakeNet({ oanda: { xau: 503, eurusd: 'kraken' }, kraken: { XRPUSD: 'rate', SOLUSD: (b) => b.slice(0, -12) }, cnbc: { '@SP.1': 'empty', '@ND.1': (b) => { b[b.length - 3] = { ...b[b.length - 3], open: 0 }; return b; } } });
  const h = await runChecks({ fetchFn: net.fn, now: NOW, pause: 0 }), o = h.feeds.oanda.markets, k = h.feeds.kraken.markets, cn = h.feeds.cnbc.markets;
  assert.equal(h.status, 'bad');
  assert.equal(o.xau.status, 'bad'); assert.match(o.xau.issues[0].detail, /unreachable: HTTP 503: OANDA_TOKEN not set/);
  assert.match(o.eurusd.issues[0].detail, /not OANDA/);
  assert.match(k.xrp.issues[0].detail, /Too many requests/);
  assert.equal(k.sol.issues[0].kind, 'stale');
  assert.equal(cn.es.status, 'ok'); assert.equal(cn.es.sym, '@ES.1');   // @SP.1 empty → @ES.1, as the tracker does
  assert.equal(cn.nq.issues[0].kind, 'price');
  assert.match(h.summary, /OANDA spot \(md\/bars\): XAU\/USD error, EUR\/USD error/);
});

test('alerts: confirmed on the 2nd bad check, sent once, new problems after 30 min, a 12 h reminder, one all-clear', () => {
  const bad = (ids) => ({ feeds: { oanda: { label: 'OANDA', markets: Object.fromEntries(ids.map((k) => [k, { label: k.toUpperCase(), status: 'bad', issues: [{ kind: 'stale', sev: 'bad', detail: 'no new candle' }] }])) } } });
  const clean = { feeds: { oanda: { label: 'OANDA', markets: { xau: { label: 'XAU', status: 'ok', issues: [] } } } } };
  let t = NOW, st = null;
  const step = (h, dt = 660) => { t += dt; const d = alertDecision(h, st, t); st = d.alert; return d.ev; };
  assert.equal(step(bad(['xau'])), null);                          // 1st bad check: not yet (one failed request is not an outage)
  const e1 = step(bad(['xau'])); assert.match(e1.title, /Data feed problem: 1 market/); assert.match(e1.msg, /OANDA XAU: no new candle/); assert.equal(e1.tags, 'warning');
  for (let i = 0; i < 5; i++) assert.equal(step(bad(['xau'])), null);   // same problem: quiet
  assert.equal(step(bad(['xau', 'eurusd'])), null);                // eurusd not confirmed yet
  const e2 = step(bad(['xau', 'eurusd'])); assert.match(e2.title, /2 markets/);   // new market, > 30 min after the first alert
  assert.equal(step(bad(['xau', 'eurusd']), 11 * 3600), null);
  assert.match(step(bad(['xau', 'eurusd']), 3600).title, /continues/);   // 12 h after the last send
  assert.equal(step(bad(['xau'])), null);                          // partly better: no message
  const ok = step(clean); assert.match(ok.title, /back to normal/);
  assert.equal(step(clean), null); assert.equal(st.sent.key, '');
  // flapping: bad, clean, bad never confirms
  st = null; assert.equal(step(bad(['xau'])), null); assert.equal(step(clean), null); assert.equal(step(bad(['xau'])), null);
  // a second new problem inside 30 min of an alert waits for the next check after the 30 min
  st = null; step(bad(['xau'])); step(bad(['xau']));
  assert.equal(step(bad(['xau', 'gbpusd']), 300), null); assert.equal(step(bad(['xau', 'gbpusd']), 300), null);
  assert.match(step(bad(['xau', 'gbpusd']), 1500).title, /2 markets/);
});

test('main: writes health.json, alerts once through ntfy, retries when the send failed, stays quiet with COUNCIL_ALERTS=off', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'datacheck-'));
  try {
    const sends = [], net = fakeNet({ kraken: { XBTUSD: (b) => b.slice(0, -10) }, sends });
    const env = { NTFY_TOPIC: 'test-topic' };
    let h = await main(dir, { env, fetchFn: net.fn, now: NOW, pause: 0 });
    assert.equal(h.status, 'bad'); assert.equal(sends.length, 0);   // first bad check
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'health.json'), 'utf8'));
    assert.equal(saved.feeds.kraken.markets.btc.status, 'bad'); assert.deepEqual(saved.alert.streak, { 'kraken:btc': 1 }); assert.equal(saved.cfg.jumpAtr, CFG.jumpAtr);
    sends.fail = true;                                              // ntfy down: not marked as sent
    net.now = NOW + 660; h = await main(dir, { env, fetchFn: net.fn, now: NOW + 660, pause: 0 });
    assert.equal(sends.length, 1); assert.ok(h.alertError); assert.equal(h.alert.sent.key, '');
    sends.fail = false;
    net.now = NOW + 1320; h = await main(dir, { env, fetchFn: net.fn, now: NOW + 1320, pause: 0 });
    assert.equal(sends.length, 2); assert.equal(sends[1].body.topic, 'test-topic'); assert.match(sends[1].body.title, /Data feed problem/); assert.match(sends[1].body.message, /Kraken BTC\/USD: no new candle/);
    assert.equal(h.alert.sent.key, 'kraken:btc'); assert.equal(h.lastAlert.title, sends[1].body.title);
    net.now = NOW + 1980; await main(dir, { env, fetchFn: net.fn, now: NOW + 1980, pause: 0 });
    assert.equal(sends.length, 2);                                  // deduplicated
    const quiet = fakeNet({ sends: [], now: NOW + 2640 });
    h = await main(dir, { env: { COUNCIL_ALERTS: 'off' }, fetchFn: quiet.fn, now: NOW + 2640, pause: 0 });
    assert.equal(quiet.sends.length, 0); assert.equal(h.status, 'ok'); assert.equal(h.alert.sent.key, '');   // all-clear marked, nothing sent
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

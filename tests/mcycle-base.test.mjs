// research/edge/mcycle-base: the live Mosha cycle rule's own backtest. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evTrader, evClosed, replay, recordOf, netOf, positionsOf, verdictText, K, TF } from '../research/edge/mcycle-base/run.mjs';
import { cycleTrades } from '../council/mosha-cycle.mjs';

const DIR = new URL('../research/edge/mcycle-base/', import.meta.url);

// a deterministic walk of M5 gold candles on weekdays (Mon 00:00 - Fri 21:00 UTC), trending legs so structure breaks happen
function walk(days, seed = 3, t0 = Date.UTC(2021, 2, 1) / 1000) {
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = []; let px = 1800, drift = 0;
  for (let t = t0; t < t0 + days * 86400; t += 300) {
    const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours();
    if (wd === 6 || wd === 0 || (wd === 5 && h >= 21)) continue;
    if (rnd() < 0.01) drift = (rnd() - 0.5) * 0.3;
    const o = px, c = o + drift + (rnd() - 0.5) * 2.4, hi = Math.max(o, c) + rnd() * 0.8, lo = Math.min(o, c) - rnd() * 0.8;
    out.push({ time: t, open: +o.toFixed(2), high: +hi.toFixed(2), low: +lo.toFixed(2), close: +c.toFixed(2) }); px = c;
  }
  return out;
}
function agg(m5, sec) {
  const out = []; let cur = null;
  for (const b of m5) { const k = Math.floor(b.time / sec) * sec;
    if (!cur || cur.time !== k) { cur = { time: k, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } }
  return out;
}
const dataOf = (m5) => ({ '5m': m5, '15m': agg(m5, 900), '1h': agg(m5, 3600), '4h': agg(m5, 14400) });

test('the forming candle cannot shape a kept event: closed-only events equal the Trader mapping', () => {
  const m5 = walk(40);
  for (const [id, sec] of Object.entries(TF)) {
    const a = id === '5m' ? m5 : agg(m5, sec);
    for (const end of [800, 900, a.length - 3]) {
      if (end > a.length - 1 || end < 300) continue;
      const closed = a.slice(Math.max(0, end - K.WIN), end), forming = { ...a[end], close: a[end].open + 50, high: a[end].open + 60, low: a[end].open - 60 };
      assert.deepEqual(evClosed(closed, sec), evTrader(closed.concat([forming]), sec), `${id} window ending ${end}`);
    }
  }
});

test('the harness is the Trader block: same mapping, same record fields', () => {
  const tr = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(tr, /src\[id\]\.A = msAnalyze\(src\[id\]\.bars, 6\)/);
  assert.ok(tr.includes("const ev = (id, sec) => { const bb = src[id].bars; return src[id].A.events.filter((e) => e.breakIdx < bb.length - 1).map((e) => ({ t: bb[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure })); };"));
  assert.ok(tr.includes("cycleTrades({ E4: ev('4h', 14400), E1: ev('1h', 3600), E15: ev('15m', 900), E5: ev('5m', 300), h1: src['1h'].bars.slice(0, -1) }, now)"));
  assert.ok(tr.includes('for (const o of C.trades.filter((x) => x.fresh))'));
  assert.ok(tr.includes('const id = `xau-mcycle-${o.leg}-${o.h4.t}`; if (trades.some((x) => x.id === id)) continue;'));
  assert.ok(tr.includes("blk = cycleBlockers(o, trades, price, ownerSh('mcycle'))"));
  assert.ok(tr.includes('const t1 = o.t1 != null && o.room ? o.t1 : +(o.entry + d * 2 * o.r0).toFixed(2);'));
  assert.ok(tr.includes("side: o.side, entry: o.entry, stop: o.stop, t1, rr: o.room ? o.rr : 2, buf: 0.3,"));
  assert.ok(tr.includes("opened: now, checked: now, status: 'pending', R: null, r0: o.r0, validFor: 24 * 3600, maxHold: 72 * 3600, noBe: true, entryMode: 'limit',"));
  const r = recordOf({ leg: 'pull', tf: '5m', t: 100, side: 'sell', entry: 2000, stop: 2003, r0: 3, t1: 2002, rr: 0.67, room: false, h4: { t: 9 } }, [], 1999, 200);
  assert.equal(r.t1, 1994); assert.equal(r.rr, 2); assert.deepEqual(r.blockedBy, ['room']); assert.equal(r.id, 'xau-mcycle-pull-9');
  assert.equal(r.validFor, 86400); assert.equal(r.maxHold, 259200);
});

test('replay: every signal is what the Trader would see at that moment (forming candle included), with a stop on the losing side', () => {
  const m5 = walk(70), D = dataOf(m5), from = m5[0].time + 25 * 86400;
  const trades = replay(D, { from });
  assert.ok(trades.length >= 2, `cycle signals on the walk: ${trades.length}`);
  for (const tr of trades) {
    assert.ok(tr.side === 'sell' ? tr.stop > tr.entry : tr.stop < tr.entry, 'stop on the losing side');
    const now = tr.opened, ev = {}, h1 = [];
    for (const [id, sec] of Object.entries(TF)) {
      const a = D[id];   // f = the last candle started by now: the forming one
      let f = a.length - 1; for (let i = 0; i < a.length; i++) if (a[i].time <= now) f = i;
      const feed = a.slice(Math.max(0, f - K.WIN), f).concat([{ ...a[f] }]);   // 719 closed + the forming one (its later price does not matter)
      ev[id] = evTrader(feed, sec); if (id === '1h') h1.push(...feed.slice(0, -1));
    }
    const C = cycleTrades({ E4: ev['4h'], E1: ev['1h'], E15: ev['15m'], E5: ev['5m'], h1 }, now);
    const o = C.trades.find((x) => x.fresh && `xau-mcycle-${x.leg}-${x.h4.t}` === tr.id);
    assert.ok(o, `Trader sees ${tr.id} at ${now}`);
    assert.equal(o.entry, tr.entry); assert.equal(o.stop, tr.stop);
  }
});

test('no look-ahead: changing every candle after a moment changes nothing placed before it', () => {
  const m5 = walk(70), from = m5[0].time + 25 * 86400, A = replay(dataOf(m5), { from });
  const T = A.length ? A[Math.floor(A.length / 2)].opened : m5[m5.length - 2000].time;
  const m5b = m5.map((b) => (b.time >= T ? { ...b, open: b.open + 37, high: b.high + 45, low: b.low + 30, close: b.close + 40 } : b));
  const B = replay(dataOf(m5b), { from });
  const pick = (L) => L.filter((x) => x.opened < T).map((x) => [x.id, x.entry, x.stop, x.t1, x.blockedBy.join()]);
  assert.deepEqual(pick(B), pick(A));
  const done = (L) => L.filter((x) => x.opened < T && x.closed != null && x.closed < T - 300).map((x) => [x.id, x.status, x.R]);
  assert.deepEqual(done(B), done(A));
});

test('costs: $0.30 a round trip in R, financing on buys only', () => {
  const base = { entry: 2000, r0: 3, R: 2, filled: Date.UTC(2024, 0, 2, 10) / 1000, closed: Date.UTC(2024, 0, 2, 12) / 1000 };
  assert.equal(netOf({ ...base, side: 'sell' }), +(2 - 0.1).toFixed(4));
  assert.equal(netOf({ ...base, side: 'buy' }), +(2 - 0.1).toFixed(4));   // no rollover inside
  const over = { ...base, closed: Date.UTC(2024, 0, 3, 23) / 1000 };       // Tue 22:00 + Wed 22:00 (x3) = 4 nights
  assert.equal(netOf({ ...over, side: 'buy' }), +(2 - 0.1 - 4 * 0.000148 * 2000 / 3).toFixed(4));
  assert.equal(netOf({ ...over, side: 'sell' }, 2), +(2 - 0.2).toFixed(4));
});

test('result: RESULT.md, result.json and positions.json agree', () => {
  const out = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8'), pos = JSON.parse(fs.readFileSync(new URL('positions.json', DIR), 'utf8'));
  assert.equal(out.verdict, verdictText(out));
  assert.ok(md.includes(`**Verdict: ${out.verdict}**`));
  assert.match(out.verdict, /^(PASS|FAIL): /);
  const C = out.legs.combined;
  assert.equal(out.pass, C.is.avg > 0 && C.oos.avg > 0 && C.all.tMonth >= 2);
  assert.equal(out.verdict.startsWith('PASS'), out.pass);
  assert.equal(pos.length, C.all.n);
  assert.equal(pos.filter((r) => r[5] === 'pull').length, out.legs.pull.all.n);
  assert.equal(pos.filter((r) => r[5] === 'main').length, out.legs.main.all.n);
  assert.ok(Math.abs(pos.reduce((a, r) => a + r[3], 0) - C.all.total) < 0.05 + pos.length * 0.0005);
  for (const r of pos) { assert.equal(r.length, 6); assert.ok(r[0] <= r[1] && r[1] <= r[2]); assert.ok(r[4] === 1 || r[4] === -1); }
  for (const k of ['combined', 'pull', 'main']) for (const h of ['all', 'is', 'oos']) assert.ok(md.includes(`| ${out.legs[k][h].n} |`), `${k} ${h} n in RESULT.md`);
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('Pass bar'));
});

test('positionsOf: filled live trades only, in exit order', () => {
  const L = [{ shadow: false, status: 'win', opened: 1, filled: 2, closed: 9, R: 1, side: 'buy', entry: 2000, r0: 3, leg: 'pull' },
    { shadow: true, status: 'loss', opened: 1, filled: 2, closed: 5, R: -1, side: 'sell', entry: 2000, r0: 3, leg: 'main' },
    { shadow: false, status: 'expired', opened: 1, closed: 3, R: 0, side: 'sell', entry: 2000, r0: 3, leg: 'main' },
    { shadow: false, status: 'loss', opened: 1, filled: 2, closed: 4, R: -1, side: 'sell', entry: 2000, r0: 3, leg: 'main' }];
  assert.deepEqual(positionsOf(L).map((r) => [r[2], r[4], r[5]]), [[4, -1, 'main'], [9, 1, 'pull']]);
});

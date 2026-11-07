// ICT desk audit tests (7 Nov 2026). Run against a COPY of the real council-data ict/ files (never writes there):
//   node ict/audit-test.mjs <dir with bars.json, trades.json, replay.json>
// No network: CNBC is stubbed with the real candles from bars.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(process.argv[2] || 'data/ict');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const bars = JSON.parse(fs.readFileSync(path.join(SRC, 'bars.json'), 'utf8'));
const replay = JSON.parse(fs.readFileSync(path.join(SRC, 'replay.json'), 'utf8'));
const live = JSON.parse(fs.readFileSync(path.join(SRC, 'trades.json'), 'utf8'));
let fails = 0;
const ok = (c, msg) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fails++; };
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
const etHour = (t) => +NY.format(new Date(t * 1000)) % 24;

// 1. cnbcBars: request starts on the hour; bars in the 17:00 New York halt are dropped
{
  const { cnbcBars } = await import('./tracker.mjs');
  let url = '';
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => { url = String(u); return { status: 200, json: async () => ({ barData: { priceBars: [
    { open: '1', high: '2', low: '1', close: '2', tradeTimeinMills: Date.UTC(2026, 10, 6, 21, 0) },     // 16:00 ET (EST)
    { open: '2', high: '2', low: '2', close: '2', tradeTimeinMills: Date.UTC(2026, 10, 6, 22, 37) },    // 17:37 ET: settlement print in the halt
    { open: '2', high: '3', low: '2', close: '3', tradeTimeinMills: Date.UTC(2026, 10, 8, 23, 0) },     // 18:00 ET Sunday reopen
  ] } }) }; };
  const out = await cnbcBars('@SP.1', '5M', Date.UTC(2026, 10, 6, 10, 37, 33) / 1000, Date.UTC(2026, 10, 7) / 1000);
  globalThis.fetch = real;
  ok(/\/5M\/20261106050000\//.test(url), `5m request starts on the hour (05:00 ET, not 05:37): ${url.split('/').slice(-4, -2).join(' ')}`);
  ok(out.length === 2 && out.every((b) => etHour(b.time) !== 17), 'halt-hour bar dropped, others kept');
}

// 2. tracker main() on the real candles with a stubbed CNBC (child process: the tracker reads the clock at load)
const runTracker = (nowIso, trades, cut) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ict-audit-'));
  fs.writeFileSync(path.join(dir, 'trades.json'), JSON.stringify(trades));
  const cnbc = {}; const map = { nq: '@ND.1', es: '@SP.1', ym: '@DJ.1', rty: '@TFS.1', gc: '@GC.1' };
  for (const [k, sym] of Object.entries(map)) cnbc[sym] = { '5M': bars[k].m5.filter((b) => b[0] <= cut), '1D': bars[k].d1 };
  fs.writeFileSync(path.join(dir, 'feed.json'), JSON.stringify(cnbc));
  fs.writeFileSync(path.join(dir, 'stub.mjs'), `import fs from 'node:fs';
const T = Date.parse(${JSON.stringify(nowIso)}); Date.now = () => T;
const F = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(dir, 'feed.json'))}, 'utf8'));
globalThis.setTimeout = ((st) => (f, ms, ...a) => st(f, 0, ...a))(globalThis.setTimeout);
globalThis.fetch = async (u) => { const p = String(u).split('/'), i = p.indexOf('bars'), sym = decodeURIComponent(p[i + 1]), iv = p[i + 2];
  if (!String(u).includes('cnbc')) return { ok: false, status: 404, json: async () => null };
  const b = (F[sym] && F[sym][iv]) || [];
  return { ok: true, status: 200, json: async () => ({ barData: { priceBars: b.map((x) => ({ open: x[1], high: x[2], low: x[3], close: x[4], tradeTimeinMills: x[0] * 1000 })) } }) }; };
`);
  execFileSync(process.execPath, ['--import', path.join(dir, 'stub.mjs'), path.join(HERE, 'tracker.mjs'), dir], { stdio: 'pipe' });
  const r = { trades: JSON.parse(fs.readFileSync(path.join(dir, 'trades.json'), 'utf8')), bars: JSON.parse(fs.readFileSync(path.join(dir, 'bars.json'), 'utf8')), snap: JSON.parse(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8')) };
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
};
{
  // a. time exit at the close of the 36th H1 candle, not at the price when the tracker runs (Saturday)
  const es = bars.es.m5, h0 = Math.ceil(es[0][0] / 3600) * 3600 + 3600;
  const atH = es.filter((b) => b[0] < h0).at(-1);
  const t = { id: 'es-b-test', market: 'es', label: 'S&P 500', short: 'ES', side: 'buy', signalAt: h0, entry: atH[4], stop: atH[4] - 2000, stop0: atH[4] - 2000, r0: 2000, t1: null, trail: [2, 1.5], be: 1.5, t2: atH[4] + 4000, opened: h0, checked: h0, status: 'open', R: null, size: 1, grade: { total: 7, letter: 'B+' }, feat: {} };
  // b. an older record with a fixed 3R target at half size: R must be sized (was always +3R)
  const n0 = bars.nq.m5.find((b) => b[0] >= h0)[1];
  const tgt = { ...t, id: 'nq-b-test', market: 'nq', short: 'NQ', entry: n0, r0: 1, stop: n0 - 9000, t1: n0 + 3, t2: n0 + 2, size: 0.5 };
  const r = runTracker('2026-11-07T10:37:33Z', [t, tgt], Infinity);
  const x = r.trades.find((q) => q.id === 'es-b-test');
  const H = r.bars.es.h1.filter((b) => b[0] >= h0);
  ok(x.status !== 'open' && x.exit === 'time', `time exit taken (${x.exit}, ${x.R}R)`);
  ok(H.length >= 36 && x.closed === H[35][0] + 3600, `closed at the end of the 36th H1 candle ${new Date(x.closed * 1000).toISOString()} (not the run time)`);
  ok(x.exitPx === H[35][4], `exit price = that candle's close ${H[35][4]} (Friday's close was ${es.at(-1)[4]})`);
  const y = r.trades.find((q) => q.id === 'nq-b-test');
  ok(y.exit === 'target' && y.R === 1.5 && y.Rraw === 3, `fixed-target exit sized: R ${y.R} (Rraw ${y.Rraw})`);
  ok(Object.values(r.bars).every((m) => m.h1.every((b) => etHour(b[0]) !== 17)), 'no H1 candle in the 17:00-18:00 New York halt');
  // the real open ES trade (signal Fri 16:00 ET) must still be open on Saturday: 36 trading hours have not passed
  const r2 = runTracker('2026-11-07T10:37:33Z', live, Infinity);
  ok(r2.trades.filter((q) => q.status === 'open').length === live.filter((q) => q.status === 'open').length, 'live open trades stay open over the weekend');
}
{
  // c. mid-session with the last 5m bar still forming: its hour is not a closed H1 candle yet
  const cut = Date.UTC(2026, 10, 6, 20, 57) / 1000;   // feed ends with the 20:57 bar (ends 21:02), run at 21:05
  const r = runTracker('2026-11-06T21:05:00Z', [], cut);
  const last = r.bars.es.h1.at(-1)[0];
  ok(last === Date.UTC(2026, 10, 6, 19) / 1000, `last closed H1 candle is 19:00Z, not the 20:00Z one missing its last bar (got ${new Date(last * 1000).toISOString()})`);
}

// 3. replay simulate(): a weekend run must not time-exit a trade before its 36th candle; a data hole voids the trade
{
  const { simulate, MAX_GAP } = await import('./replay.mjs');
  const { MARKETS } = await import('./tracker.mjs');
  const H = bars.es.h1.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] })).filter((b) => etHour(b.time) !== 17);
  const rx = replay.trades.find((q) => q.id === 'es-s-1793995200-r') || replay.trades.find((q) => q.status === 'open');
  const g = { side: rx.side === 'buy' ? 1 : -1, t: rx.signalAt - 3600, close: rx.signalAt, entry: rx.entry, r0: rx.r0, stop: rx.stop, sweepT: rx.sweep.t, swept: rx.sweep.level, fvg: rx.fvg, ih: rx.ih, dol: rx.dol, valid: rx.valid, feat: rx.feat, grade: rx.grade };
  const src = { H, m5: [], m5days: new Set() };
  const sun = Date.UTC(2026, 10, 8, 6, 41) / 1000;   // the weekly replay run (Sunday 06:41 UTC)
  const s1 = simulate(g, MARKETS[rx.market], rx.market, src, sun);
  ok(s1 && s1.status === 'open' && s1.closed == null, `${rx.id} still open on the Sunday run (was closed on Friday's last bar)`);
  const g2 = { ...g, close: H[10].time };
  const gap = H.map((b, i) => (i > 14 ? { ...b, time: b.time + MAX_GAP + 86400 } : b));
  ok(simulate(g2, MARKETS.es, 'es', { H: gap, m5: [], m5days: new Set() }, sun) === null, 'a 5-day hole inside the window voids the trade');
  ok(simulate(g2, MARKETS.es, 'es', { H, m5: [], m5days: new Set() }, sun) !== null, 'no hole: the trade is simulated');
}

// 4. data checks on the real replay
{
  const T = replay.trades, ids = new Set(T.map((x) => x.id));
  ok(ids.size === T.length, `no duplicate replay ids (${T.length})`);
  ok(T.every((x) => x.feat.etHour === etHour(x.signalAt)), 'every feat.etHour is the New York hour of the signal (EDT and EST, incl. after 1 Nov 2026)');
  const post = T.filter((x) => x.signalAt >= Date.UTC(2026, 10, 1, 6) / 1000);
  ok(post.every((x) => etHour(x.signalAt) === (new Date(x.signalAt * 1000).getUTCHours() + 19) % 24), `after 1 Nov New York = UTC-5 (${post.length} signals)`);
  // 1h exits recomputed from each trade's own H1 path (where the path covers the 36 candles)
  let n = 0, bad = 0;
  for (const x of T.filter((t) => t.res === '1h' && t.closed)) {
    let stop = -1, mfe = 0, mv = false, bm = false, R = null, ex = null; const hold = x.path.slice(0, 36);
    for (const [hi, lo] of hold) { if (lo <= stop) { R = stop; ex = mv ? 'trail' : bm ? 'breakeven' : 'stop'; break; } mfe = Math.max(mfe, hi);
      if (x.be && !bm && mfe >= x.be && stop < 0) { stop = 0; bm = true; } if (mfe >= 2 && mfe - 1.5 > stop) { stop = mfe - 1.5; mv = true; } }
    if (R == null) { if (hold.length < 36) continue; R = hold[35][2]; ex = 'time'; }
    n++; if (Math.abs(R - (x.Rraw ?? x.R)) > 0.02 || ex !== x.exit) bad++;
  }
  ok(n > 100 && bad === 0, `1h replay exits match their candles (${n} recomputed, ${bad} off)`);
  ok(T.filter((x) => x.closed).every((x) => Math.abs((x.side === 'buy' ? 1 : -1) * (x.exitPx - x.entry) / x.r0 * (x.size || 1) - x.R) < 0.03 * (x.size || 1) + 0.02), 'R = (exit - entry) / risk x size on every closed replay trade');
  // the desk's Both view: a live signal also in the replay is counted once
  const lv = new Set(live.map((x) => x.id)), both = live.concat(T.filter((x) => !lv.has(String(x.id).replace(/-r$/, ''))));
  ok(both.length === live.length + T.length - T.filter((x) => lv.has(x.id.replace(/-r$/, ''))).length, `Both view drops ${T.filter((x) => lv.has(x.id.replace(/-r$/, ''))).length} replay duplicate(s) of live signals`);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);

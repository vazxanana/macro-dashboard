// ICT desk audit tests (7 Nov 2026). No network: CNBC is stubbed with the real candles from bars.json.
//   node ict/audit-test.mjs                 the pinned copy in tests/fixtures/ict/ (council-data ict/ at 530dcacf, 7 Nov 20:2x UTC; used by CI)
//   node ict/audit-test.mjs <dir>           another copy of council-data ict/ (bars.json, trades.json, replay.json, or .json.gz); never writes there
// The checks name real signals and dates of that week (the 6 Nov 21:05 run, replay trade es-s-1793995200-r), so they hold for the
// pinned copy; the live files roll on (bars.json keeps ~5 days) and will stop matching them within days.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(process.argv[2] || path.join(HERE, '..', 'tests', 'fixtures', 'ict'));
const readJSON = (f) => { const p = path.join(SRC, f); return JSON.parse(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : zlib.gunzipSync(fs.readFileSync(p + '.gz')).toString('utf8')); };
const bars = readJSON('bars.json');
const replay = readJSON('replay.json');
const live = readJSON('trades.json');
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
const runTracker = (nowIso, trades, cut, shadow) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ict-audit-'));
  fs.writeFileSync(path.join(dir, 'trades.json'), JSON.stringify(trades));
  if (shadow) fs.writeFileSync(path.join(dir, 'shadow.json'), JSON.stringify(shadow));
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
  const r = { trades: JSON.parse(fs.readFileSync(path.join(dir, 'trades.json'), 'utf8')), bars: JSON.parse(fs.readFileSync(path.join(dir, 'bars.json'), 'utf8')), snap: JSON.parse(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8')), shadow: JSON.parse(fs.readFileSync(path.join(dir, 'shadow.json'), 'utf8')) };
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
  // shadow 'dip' (paper comparison): its own file, every record flagged, NQ/ES buys only, size 1, no break-even; trades.json never carries one
  const sh = r2.shadow.trades;
  ok(r2.trades.every((q) => !q.shadow && !q.variant) && sh.every((q) => q.shadow === true && q.variant === 'dip' && q.side === 'buy' && ['nq', 'es'].includes(q.market) && q.size === 1 && q.be == null),
    `shadow records only in shadow.json and all flagged (${sh.length}); live records untouched`);
  // shadow 'nofri' / 'h1opp' / 'strail': under shadow.json .variants, every record flagged with its own variant, A-setups only, one open per market
  const V = r2.shadow.variants || {}, VN = ['nofri', 'h1opp', 'strail'];
  ok(VN.every((v) => V[v] && Array.isArray(V[v].trades) && V[v].since && V[v].totals && V[v].trades.every((q) => q.shadow === true && q.variant === v && q.aset === true && q.id.endsWith(`-${v}`))
    && Object.keys(V[v].errors).length === 0 && ['nq', 'es', 'ym', 'rty', 'gc'].every((m) => V[v].trades.filter((q) => q.market === m && q.status === 'open').length <= 1)),
    `variants nofri/h1opp/strail in shadow.json .variants, flagged, no errors (${VN.map((v) => (V[v] ? V[v].trades.length : '-')).join('/')} records)`);
  ok(V.strail.trades.every((q) => q.trail === null && Array.isArray(q.strail)) && r2.trades.every((q) => q.strail === undefined), "strail records carry the structure trail (no 1.5R trail); live records never do");
  // paper-only market 'silver' (research/ict-markets.md): its feed is down here (no network), which must only show as an error in its
  // own variant stream; the live records, snapshot and bars never carry the paper market
  ok(V.silver && Array.isArray(V.silver.trades) && V.silver.trades.length === 0 && V.silver.errors.xag && Object.keys(r2.snap.errors).length === 0
    && !('xag' in r2.snap.markets) && !('xag' in r2.bars) && r2.trades.every((q) => q.market !== 'xag' && !q.paperMarket), 'paper market silver: a feed error stays in its own stream; live files untouched');
}
{
  const { isPaperA, variantRule, SHADOW_MARKETS, MARKETS, dailyNY, isASetup } = await import('./tracker.mjs');
  const g = { side: 1, grade: { total: 3 }, feat: { atrR: 0.5, bias: 'with', body: 0.3, session: 'NY PM' } };
  ok(!('xag' in MARKETS) && SHADOW_MARKETS.xag.variant === 'silver', 'silver is a paper-only market, not in MARKETS');
  ok(isPaperA(g, 'xag') && variantRule('silver', g, 'xag', {}) && !variantRule('silver', g, 'gc', {}) && !variantRule('nofri', g, 'xag', {}) && !isPaperA(g, 'gc'),
    'silver: the gold rule on xag only');
  ok(!isPaperA({ ...g, side: -1 }, 'xag') && !isPaperA({ ...g, feat: { atrR: 0.2 } }, 'xag') && !isPaperA({ ...g, feat: { atrR: 0.75 } }, 'xag') && !isPaperA({ ...g, grade: { total: 2 } }, 'xag'),
    'silver: buys only, stop 0.3-0.75x ATR, grade >= 3');
  ok(isASetup(g, 'gc') === isPaperA(g, 'xag'), 'silver uses the same rule as GC');
  // 17:00 New York day: Mon 16:00 ET belongs to Monday, Mon 18:00 ET to Tuesday; time + 86400 = the 17:00 ET close (EST and EDT)
  const h = (iso) => ({ time: Date.parse(iso) / 1000, open: 1, high: 2, low: 0.5, close: 1.5 });
  const D = dailyNY([h('2026-11-09T21:00:00Z'), h('2026-11-09T23:00:00Z'), h('2026-07-06T20:00:00Z')].sort((a, b) => a.time - b.time));
  ok(D.length === 3 && D[0].time + 86400 === Date.parse('2026-07-06T21:00:00Z') / 1000 && D[1].time + 86400 === Date.parse('2026-11-09T22:00:00Z') / 1000 && D[2].time + 86400 === Date.parse('2026-11-10T22:00:00Z') / 1000,
    'dailyNY: days roll at 17:00 New York (EDT and EST)');
}
// shadow 'strail': the tracker's 5m management and the replay's simulate() give the same exit on the same candles
{
  const { simulate } = await import('./replay.mjs');
  const { MARKETS, strailLevel, SHADOW } = await import('./tracker.mjs');
  const hc = [5, 4, 3, 4, 5, 6, 5, 7].map((l) => ({ low: l, high: l + 1 }));
  ok(strailLevel(hc, 5, 1, 2) === 3 && strailLevel(hc, 4, 1, 2) === null && strailLevel(hc, 8, 1, 2) === 3 && strailLevel(hc, 8, 1, 1) === 5 && strailLevel(hc, 8, -1, 2) === null && strailLevel(hc, 7, -1, 1) === 7,
    'strail: the latest swing confirmed by 2 candles each side, among the candles closed so far');
  const m5 = bars.es.m5.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
  const H = bars.es.h1.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
  const src = { H, m5, m5days: new Set(m5.map((b) => Math.floor(b.time / 86400)).flatMap((d) => [d, d + 1])) };
  const opt = { strail: [SHADOW.strail.from, SHADOW.strail.piv] };
  // find a window on the stored candles where the structure trail closes the trade (buy or sell, a few stop sizes)
  let pick = null;
  for (const c of H.filter((q) => q.time >= m5[0].time).slice(0, 12)) for (const side of [1, -1]) for (const k of [0.1, 0.15, 0.2, 0.3]) { if (pick) break;
    const close = c.time + 3600, e = (m5.filter((b) => b.time < close).at(-1) || {}).close; if (e == null) continue;
    const r0 = +(e * k / 100).toFixed(2), g = { side, t: c.time, close, entry: e, r0, stop: e - side * r0, sweepT: c.time, swept: e - side * r0, fvg: [e, e], ih: null, dol: null, valid: true, feat: {}, grade: { total: 7 } };
    const x = simulate(g, MARKETS.es, 'es', src, Infinity, opt);
    if (x && x.exit === 'trail' && x.R > 0) pick = { g, x }; }
  if (!pick) ok(false, 'strail: no window on the stored candles where the structure trail closes a trade');
  else {
    const { g, x } = pick, s = g.side;
    const seed = { variant: 'dip', since: '2026-11-01T00:00:00Z', trades: [], errors: {}, variants: { strail: { since: '2026-11-01T00:00:00Z', errors: {}, trades: [{ id: 'es-test-strail', shadow: true, variant: 'strail', market: 'es', label: 'S&P 500', short: 'ES',
      side: s > 0 ? 'buy' : 'sell', signalAt: g.close, signalPx: g.entry, entry: g.entry, stop: g.stop, stop0: g.stop, r0: g.r0, t1: null, trail: null, strail: opt.strail, be: 1.5, t2: g.entry + s * 2 * g.r0, opened: g.close, checked: g.close,
      status: 'open', R: null, size: 1, grade: { total: 7, letter: 'B+' }, feat: {}, aset: true }] } } };
    const r = runTracker('2026-11-07T10:37:33Z', [], Infinity, seed), y = r.shadow.variants.strail.trades.find((q) => q.id === 'es-test-strail');
    ok(y && y.exit === 'trail' && Math.abs(y.Rraw - x.R) < 0.011 && y.closed === x.closed, `strail: tracker and replay agree (${y && y.exit} ${y && y.Rraw}R vs ${x.exit} ${x.R}R, ${s > 0 ? 'buy' : 'sell'})`);
  }
}
{
  const { isNoFri, nyFriday, isH1Opp, h1Trend, loadMeridian } = await import('./tracker.mjs');
  const a = { side: 1, grade: { total: 8 }, feat: { bias: 'against', atrR: 0.5, body: 0.5, session: 'NY AM' } };
  const fri = Date.UTC(2026, 10, 6, 15) / 1000, thu = fri - 86400, friEve = Date.UTC(2026, 10, 7, 1) / 1000;   // Fri 10:00 ET, Thu 10:00 ET, Fri 20:00 ET
  ok(nyFriday(fri) && !nyFriday(thu) && nyFriday(friEve) && !nyFriday(Date.UTC(2026, 10, 6, 4) / 1000), 'nofri: Friday is the New York day (Fri 20:00 ET yes, Thu 23:00 ET no)');
  ok(isNoFri({ ...a, close: thu }, 'nq') && !isNoFri({ ...a, close: fri }, 'nq') && !isNoFri({ ...a, close: thu, feat: { ...a.feat, bias: 'with' } }, 'nq') && isNoFri({ ...a, close: thu, grade: { total: 3 }, feat: { atrR: 0.5 } }, 'gc'),
    'nofri: A-setups (index or gold rule) except on Fridays');
  const ms = await loadMeridian();
  const up = Array.from({ length: 200 }, (_, i) => { const b = 100 + i + 6 * Math.sin(i / 3); return { time: 3600 * i, open: b, high: b + 2, low: b - 2, close: b + 1 }; });
  const dn = up.map((b, i) => ({ ...up[i], open: 400 - b.open, high: 400 - b.low, low: 400 - b.high, close: 400 - b.close }));
  const g = { ...a, close: 3600 * 200 };
  ok(h1Trend(g, up, ms) === 1 && h1Trend(g, dn, ms) === -1 && h1Trend(g, up.slice(0, 50), ms) === 0, 'h1opp: Meridian H1 trend up / down, none with < 60 candles');
  ok(!isH1Opp(g, 'nq', up, ms) && isH1Opp(g, 'nq', dn, ms) && isH1Opp({ ...g, side: -1, feat: { ...a.feat } }, 'nq', up, ms) && isH1Opp(g, 'nq', up.slice(0, 50), ms) && !isH1Opp({ ...g, grade: { total: 5 } }, 'nq', dn, ms),
    'h1opp: A-setups only when the H1 trend is not with the trade (against or none)');
  ok(h1Trend({ close: 3600 * 120 }, up, ms) === h1Trend({ close: 3600 * 120 }, up.slice(0, 120), ms), 'h1opp: only candles closed before the signal are used');
}
{
  const { isDip, dipGate } = await import('./tracker.mjs');
  const D = Array.from({ length: 30 }, (_, i) => ({ time: 86400 * i, open: 100, high: 101, low: 99, close: 100 - (i === 28 ? 5 : 0) }));
  const g = { side: 1, close: 86400 * 29 + 3600, grade: { total: 3 }, feat: { atrR: 0.5 } };   // last closed daily = day 28 (95) vs day 8 (100)
  ok(dipGate(g, D) === true && isDip(g, 'nq', D) && isDip(g, 'es', D), 'dip: buy after a lower 20-day close qualifies on NQ/ES');
  ok(!isDip(g, 'ym', D) && !isDip(g, 'gc', D) && !isDip({ ...g, side: -1 }, 'nq', D) && !isDip({ ...g, feat: { atrR: 0.2 } }, 'nq', D) && !isDip({ ...g, feat: { atrR: 0.75 } }, 'nq', D) && !isDip({ ...g, grade: { total: 2 } }, 'nq', D),
    'dip: not YM/GC, not sells, stop band 0.3-0.75x ATR, grade >= 3');
  ok(!isDip({ ...g, close: 86400 * 30 + 3600 }, 'nq', D.map((d, i) => (i === 29 ? { ...d, close: 101 } : d))), 'dip: no buy when the last close is above the close 20 days earlier');
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

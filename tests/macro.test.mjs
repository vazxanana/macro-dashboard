// node --test tests/macro.test.mjs — the Macro strategist (council/macro.mjs) against a fake network: parsing, probabilities,
// scoring, the append-only log, and the no-look-ahead rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as M from '../council/macro.mjs';

const DAY = 86400;
const NOW = Date.UTC(2026, 10, 6, 21, 30) / 1000;   // Fri 6 Nov 2026 21:30 UTC → target Mon 9 Nov
// deterministic random numbers
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

// synthetic daily candles (weekdays, UTC-aligned) and FRED series for ~3 years up to `end`
function synth(end = NOW, n = 800) {
  const r = rng(7), bars = {}, start = Math.floor(end / DAY) * DAY - n * DAY;
  const P0 = { xau: 2000, eurusd: 1.1, usdjpy: 150, nas100: 18000, spx500: 5000, gbpusd: 1.27, usdcad: 1.36, usdchf: 0.88 };
  for (const [sym, p0] of Object.entries(P0)) {
    let p = p0; const a = [];
    for (let t = start; t <= Math.floor(end / DAY) * DAY; t += DAY) {
      if (!M.weekday(t)) continue;
      const o = p, c = o * (1 + (r() - 0.48) * 0.02); p = c;
      a.push({ time: t, open: o, high: Math.max(o, c) * 1.002, low: Math.min(o, c) * 0.998, close: c, ...(t === Math.floor(end / DAY) * DAY ? { live: true } : {}) });
    }
    bars[sym] = a;
  }
  const fred = {};
  const LV = { DFII10: 1.8, DGS2: 4, DGS10: 4.2, T10YIE: 2.3, T10Y3M: 0.2, BAMLH0A0HYM2: 3, VIXCLS: 17, VXVCLS: 19, DTWEXBGS: 120, WALCL: 6.6e6, RRPONTSYD: 300, WTREGEN: 8e5, SOFR: 4.3, EFFR: 4.33, SWPT: 100, BSCICP03DEM665S: 99 };
  for (const [id, v0] of Object.entries(LV)) {
    let v = v0; const a = [];
    const step = id === 'BSCICP03DEM665S' ? 30 : ['WALCL', 'WTREGEN', 'SWPT'].includes(id) ? 7 : 1;
    for (let t = start; t < end - DAY; t += step * DAY) { if (step === 1 && !M.weekday(t)) continue; v = v * (1 + (r() - 0.5) * 0.02); a.push({ t, v }); }
    fred[id] = a;
  }
  return { bars, fred };
}
const csvOf = (id, obs) => `observation_date,${id}\n` + obs.map((o) => `${M.iso(o.t)},${o.v.toFixed(4)}`).join('\n') + '\n';
const SYMK = { xau: 'gold', eurusd: 'eurusd', usdjpy: 'usdjpy', nas100: 'nq', spx500: 'es', gbpusd: 'gbpusd', usdcad: 'usdcad', usdchf: 'usdchf' };
const toData = (s, extra = {}) => ({ fred: s.fred, bars: Object.fromEntries(Object.entries(s.bars).map(([k, v]) => [SYMK[k], v])), cot: [], cal: [], rss: [], ...extra });

// a fake fetch that serves the synthetic world; `down` lists URL fragments that fail
function fakeFetch(s, { down = [], cal = null, calls = [] } = {}) {
  const res = (body, ok = true, status = 200) => ({ ok, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });
  return async (url) => {
    calls.push(url);
    if (down.some((d) => url.includes(d))) throw new Error('network down');
    let m;
    if ((m = url.match(/fredgraph\.csv\?id=(\w+)/))) return s.fred[m[1]] ? res(csvOf(m[1], s.fred[m[1]])) : res('', false, 404);
    if ((m = url.match(/md\/bars\?sym=(\w+)/))) return s.bars[m[1]] ? res({ src: 'OANDA', bars: s.bars[m[1]] }) : res({ error: 'unknown' }, false, 400);
    if (url.includes('ff_calendar_thisweek')) return res(cal || []);
    if (url.includes('ff_calendar_nextweek')) return res([]);
    if (url.includes('federalreserve.gov')) return res('<rss><channel><item><title>Federal Reserve issues FOMC statement</title><link>https://www.federalreserve.gov/x</link><pubDate>Wed, 04 Nov 2026 19:00:00 GMT</pubDate></item></channel></rss>');
    if (url.includes('ecb.europa.eu/rss')) return res('<rss><channel><item><title><![CDATA[Monetary policy decisions]]></title><link>https://ecb.europa.eu/y</link><pubDate>Thu, 30 Oct 2026 13:15:00 +0100</pubDate></item></channel></rss>');
    if (url.includes('data-api.ecb.europa.eu')) return res('KEY,FREQ,TIME_PERIOD,OBS_VALUE\nYC.B,B,2026-11-04,1.95\nYC.B,B,2026-11-05,1.97\n');
    return res('', false, 503);
  };
}

test('parsers: FRED CSV (both headers, missing values), numbers, calendar, RSS, Cboe, ECB, Kraken', () => {
  const a = M.parseFredCsv('observation_date,DFII10\n2026-11-02,1.81\n2026-11-03,.\n2026-11-04,\n2026-11-05,1.79\n');
  assert.deepEqual(a.map((o) => o.v), [1.81, 1.79]);
  assert.equal(M.parseFredCsv('DATE,DGS2\n2026-11-05,3.9\n')[0].v, 3.9);
  assert.equal(M.parseFredCsv('<html>Too many requests</html>').length, 0);
  assert.equal(M.parseNum('0.3%'), 0.3); assert.equal(M.parseNum('185K'), 185000); assert.equal(M.parseNum('-0.1%'), -0.1); assert.equal(M.parseNum('1.2M'), 1.2e6); assert.equal(M.parseNum(''), null);
  const cal = M.parseCalendar([{ title: 'CPI m/m', country: 'USD', date: '2026-11-10T08:30:00-05:00', impact: 'High', forecast: '0.3%', previous: '0.4%' }, { title: '', country: 'USD', date: 'x' }]);
  assert.equal(cal.length, 1); assert.equal(cal[0].at, Date.UTC(2026, 10, 10, 13, 30) / 1000);
  const rss = M.parseRss('<rss><item><title>A &amp; B</title><link>u</link><pubDate>Wed, 04 Nov 2026 19:00:00 GMT</pubDate></item><entry><title>Atom</title><link href="v"/><updated>2026-11-05T10:00:00Z</updated></entry></rss>', 'Fed');
  assert.deepEqual(rss.map((x) => [x.title, x.link]), [['A & B', 'u'], ['Atom', 'v']]);
  assert.equal(M.parseCboeCsv('DATE,OPEN,HIGH,LOW,CLOSE\n11/05/2026,17,18,16,17.5\n')[0].v, 17.5);
  assert.equal(M.parseEcbCsv('KEY,TIME_PERIOD,OBS_VALUE\nx,2026-11-05,1.97\n')[0].v, 1.97);
  assert.equal(M.parseKraken({ error: [], result: { PAXGUSD: [[1793577600, '1', '2', '0.5', '1.5', '0', '9', 3]], last: 1 } })[0].close, 1.5);
});

test('target day: the next weekday candle that opens after now', () => {
  assert.equal(M.iso(M.targetDay(NOW)), '2026-11-09');                                    // Friday evening → Monday
  assert.equal(M.iso(M.targetDay(Date.UTC(2026, 10, 9, 0, 0, 1) / 1000)), '2026-11-10');  // Monday just after the open → Tuesday
  assert.equal(M.iso(M.targetDay(Date.UTC(2026, 10, 8, 12) / 1000)), '2026-11-09');       // Sunday → Monday
});

test('no look-ahead: features ignore FRED values inside the publication lag and candles from the target day on', () => {
  const s = synth(), data = toData(s), D = M.targetDay(NOW);
  const f1 = M.features(data, D);
  // poison everything a forecaster could not have known: FRED observations dated after D − LAG, candles at or after D
  const fred2 = Object.fromEntries(Object.entries(s.fred).map(([id, a]) => [id, a.concat([{ t: D - DAY, v: 999 }, { t: D, v: 999 }, { t: D + DAY, v: 999 }])]));
  const bars2 = Object.fromEntries(Object.entries(data.bars).map(([k, a]) => [k, a.concat([{ time: D, open: 1, high: 1e9, low: 1, close: 1e9 }, { time: D + DAY, open: 1, high: 1, low: 1, close: 1 }])]));
  const f2 = M.features({ ...data, fred: fred2, bars: bars2 }, D);
  assert.deepEqual(f2, f1);
  // the lag itself: an observation dated D − 1 is not usable for D, one dated D − LAG is
  const v = M.fredView({ X: [{ t: D - 3 * DAY, v: 1 }, { t: D - 2 * DAY, v: 2 }, { t: D - DAY, v: 3 }] }, 'X', D);
  assert.equal(v.last.v, 2);
  assert.equal(M.fredView({ DTWEXBGS: [{ t: D - 5 * DAY, v: 1 }] }, 'DTWEXBGS', D).last, null);   // the broad dollar index lags 10 days
  // a stale series (discontinued on FRED) counts as no data instead of voting on an old number
  assert.equal(M.fredView({ BSCICP03DEM665S: [{ t: D - 700 * DAY, v: 99 }] }, 'BSCICP03DEM665S', D).last, null);
  assert.equal(M.fredView({ DGS2: [{ t: D - 30 * DAY, v: 4 }] }, 'DGS2', D).at(D), null);
});

test('no look-ahead: walk-forward replay probabilities never depend on later outcomes', () => {
  const s = synth(), data = toData(s);
  const r1 = M.replay(data, { days: 300, minTrain: 60, refit: 10 });
  const last = r1.Ds[r1.Ds.length - 1];
  const bars2 = Object.fromEntries(Object.entries(data.bars).map(([k, a]) => [k, a.map((b) => (b.time === last ? { ...b, close: b.open * (b.close > b.open ? 0.9 : 1.1) } : b))]));
  const r2 = M.replay({ ...data, bars: bars2 }, { days: 300, minTrain: 60, refit: 10 });
  for (const k of M.AK) {
    const a = r1.rows[k].filter((x) => x.D < last), b = r2.rows[k].filter((x) => x.D < last);
    assert.deepEqual(b.map((x) => x.p), a.map((x) => x.p));
    assert.notEqual(r2.rows[k].at(-1).y, r1.rows[k].at(-1).y);   // the flipped outcome is scored, but did not feed its own forecast
  }
});

test('probabilities: anchored on the base rate, shrunk, capped, never sign-flipped', () => {
  const r = rng(3), noise = Array.from({ length: 600 }, () => ({ s: r() * 2 - 1, y: r() < 0.55 ? 1 : 0 }));
  const f0 = M.fitPlatt(noise);
  assert.ok(Math.abs(M.probOf(0, f0) - 0.55) < 0.04, 'no-signal fit sits near the base rate');
  assert.ok(Math.abs(M.probOf(1, f0) - M.probOf(-1, f0)) < 0.15, 'no-signal fit stays flat');
  const sig = Array.from({ length: 600 }, () => { const s = r() * 2 - 1; return { s, y: r() < 0.5 + 0.3 * s ? 1 : 0 }; });
  const f1 = M.fitPlatt(sig);
  assert.ok(f1.b > 0.5, `a real signal is learned (b=${f1.b})`);
  assert.equal(M.probOf(50, f1), M.P_CAP[1]); assert.equal(M.probOf(-50, f1), M.P_CAP[0]);
  const anti = sig.map((x) => ({ s: -x.s, y: x.y }));
  assert.equal(M.fitPlatt(anti).b, 0, 'drivers that point the wrong way get no weight, not a reversed one');
  for (let s = -1; s <= 1; s += 0.25) { const p = M.probOf(s, M.fitPlatt([])); assert.ok(p >= 0.35 && p <= 0.65); }
});

test('scorecard: hit rate vs base rate, Brier vs coin flip and base rate, calibration, Pesaran-Timmermann', () => {
  const coin = Array.from({ length: 200 }, (_, i) => ({ p: 0.5, y: i % 2 }));
  const c = M.scorecard(coin);
  assert.equal(c.brier, 0.25); assert.equal(c.skillRW, 0); assert.equal(c.pt, null);
  const perfect = Array.from({ length: 200 }, (_, i) => ({ p: i % 2 ? 0.65 : 0.35, y: i % 2 }));
  const p = M.scorecard(perfect);
  assert.equal(p.hit, 1); assert.ok(p.skillRW > 0.4); assert.ok(p.pt > 10);
  const anti = M.scorecard(perfect.map((x) => ({ ...x, y: 1 - x.y })));
  assert.ok(anti.skillRW < 0 && anti.pt < -10);
  assert.equal(M.scorecard([]).n, 0);
  assert.equal(p.calib.reduce((s, b) => s + b.n, 0), 200);
  assert.match(M.verdictOf(M.scorecard(coin)), /too few/);
});

test('drivers: the stack votes like gold-trading.html (real yields master, Dollar Smile, carry is a warning only)', () => {
  const D = M.targetDay(NOW);
  const fred = { DFII10: [{ t: D - 10 * DAY, v: 1.6 }, { t: D - 9 * DAY, v: 1.6 }, { t: D - 8 * DAY, v: 1.6 }, { t: D - 7 * DAY, v: 1.6 }, { t: D - 6 * DAY, v: 1.6 }, { t: D - 5 * DAY, v: 1.6 }, { t: D - 2 * DAY, v: 1.5 }],
    VIXCLS: [{ t: D - 2 * DAY, v: 30 }], VXVCLS: [{ t: D - 2 * DAY, v: 25 }] };
  const f = M.features({ fred, bars: {}, cot: [] }, D), { list, smile } = M.drivers(f);
  const by = Object.fromEntries(list.map((d) => [d.k, d]));
  assert.equal(by.ry.v, 1, 'real yields falling at 1.5% → gold bull');
  assert.equal(by.rymom.v, 1);
  assert.equal(by.vix.v, 1);
  assert.equal(smile.phase, 'left', 'VIX 30 → stress side of the smile');
  assert.equal(by.carry.v, null, 'carry unwind never votes a direction');
  assert.equal(by.vixts.v, 1, 'VIX above VIX3M → inverted');
  const g = M.assetScore(list, 'gold'), j = M.assetScore(list, 'usdjpy');
  assert.ok(g.s > 0 && j.s < 0, 'falling real yields: gold up, USD/JPY down');
  assert.equal(M.assetScore(list, 'nq').used.find((d) => d.k === 'smile').dir, 'down', 'stress smile sells stocks');
  assert.ok(!M.assetScore(list, 'gold').used.some((d) => d.k === 'liq' || d.k === 'fomc'), 'liquidity and the FOMC drift are context only');
});

test('event playbook: consensus, previous, hot / cool thresholds, scenarios per asset, outcome when an actual is out', () => {
  const at = NOW + 2 * DAY;
  const ev = M.parseCalendar([
    { title: 'CPI m/m', country: 'USD', date: new Date(at * 1000).toISOString(), impact: 'High', forecast: '0.3%', previous: '0.4%' },
    { title: 'Unemployment Claims', country: 'USD', date: new Date((at + 3600) * 1000).toISOString(), impact: 'High', forecast: '220K', previous: '218K', actual: '205K' },
    { title: 'Main Refinancing Rate', country: 'EUR', date: new Date((at + DAY) * 1000).toISOString(), impact: 'High', forecast: '2.00%', previous: '2.00%' },
    { title: 'Retail Sales', country: 'USD', date: new Date((at + 9 * DAY) * 1000).toISOString(), impact: 'High', forecast: '0.2%', previous: '0.1%' },
    { title: 'Crude Oil Inventories', country: 'USD', date: new Date(at * 1000).toISOString(), impact: 'Medium', forecast: '1.0M', previous: '2.0M' },
  ]);
  const pb = M.eventPlaybook(ev, NOW, { bars: toData(synth()).bars });
  assert.deepEqual(pb.map((e) => e.title), ['CPI m/m', 'Unemployment Claims', 'Main Refinancing Rate'], 'high impact, next 5 days only');
  const cpi = pb[0];
  assert.equal(cpi.consensus, '0.3%'); assert.equal(cpi.previous, '0.4%');
  assert.match(cpi.rule, /hot if ≥ 0\.4%, cool if ≤ 0\.2%/);
  assert.deepEqual(cpi.scenarios[0].moves, { gold: 'down', eurusd: 'down', usdjpy: 'up', nq: 'down', es: 'down' });
  assert.deepEqual(cpi.scenarios[2].moves, { gold: 'up', eurusd: 'up', usdjpy: 'down', nq: 'up', es: 'up' });
  assert.ok(M.AK.every((k) => cpi.expMovePct[k] > 0));
  assert.equal(pb[1].outcome, 'hot', 'claims below consensus = a strong (hot) labour market');
  assert.equal(pb[2].scenarios[0].moves.eurusd, 'up'); assert.equal(pb[2].scenarios[0].name, 'hawkish');
  assert.match(pb[2].rule, /hawkish if the rate is above 2\.00%/, 'a rate decision is hawkish at any rate above consensus');
  // with 8+ logged surprises the cut-offs become ±1 SD
  const log = Array.from({ length: 10 }, (_, i) => ({ key: 'USD|CPI m/m', forecast: '0.3%', actual: `${(0.3 + (i % 2 ? 0.2 : -0.2)).toFixed(1)}%` }));
  assert.match(M.eventPlaybook(ev, NOW, { log })[0].rule, /±1 SD of 10 logged surprises/);
  assert.equal(M.logEvents([], ev).length, 4, 'every high-impact release with a consensus is logged once');
});

test('history: append-only, written from 21:00 UTC before the day, never for a started day; resolved on the close', () => {
  const D = Date.UTC(2026, 10, 9) / 1000, fc = (at) => ({ target: '2026-11-09', at: new Date(at * 1000).toISOString(), regime: { label: 'x' },
    assets: Object.fromEntries(M.AK.map((a) => [a, { pUp: 0.55, score: 0.2, fit: { base: 0.53 }, expMovePct: 1, naiveMovePct: 1.1, drivers: [] }])) });
  assert.equal(M.updateHistory([], fc(D - 30 * 3600), D - 30 * 3600).length, 0, 'too early: before the 21:00 cutoff');
  const h1 = M.updateHistory([], fc(D - 2 * 3600), D - 2 * 3600);
  assert.equal(h1.length, 5);
  const later = fc(D - 3600); later.assets.gold.pUp = 0.35;
  const h2 = M.updateHistory(h1, later, D - 3600);
  assert.equal(h2.find((h) => h.asset === 'gold').p, 0.55, 'the logged forecast is never rewritten');
  assert.equal(M.updateHistory([], fc(D + 60), D + 60).length, 0, 'never for a day that has already opened');
  const bars = { gold: [{ time: D, open: 100, close: 101 }], eurusd: [{ time: D, open: 1, close: 0.99, live: true }] };
  const r = M.resolveHistory(h2.map((h) => ({ ...h })), bars);
  const g = r.find((h) => h.asset === 'gold'), e = r.find((h) => h.asset === 'eurusd');
  assert.equal(g.y, 1); assert.equal(g.hit, true); assert.equal(g.ret, 1);
  assert.equal(e.y, undefined, 'a forming candle is not resolved');
  const bad = M.resolveHistory([{ id: 'x', asset: 'gold', target: '2026-11-09', at: new Date((D + 5) * 1000).toISOString(), p: 0.6 }], bars);
  assert.match(bad[0].void, /not made before/, 'a forecast stamped after the open is voided, never scored');
});

test('FRED unreachable: the US Treasury curves fill the rates, the circuit breaker skips the rest', async () => {
  const s = synth(), calls = [];
  const usd = (t) => { const d = new Date(t * 1000); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`; };
  const csvFor = (type, year) => {
    const inYear = (o) => new Date(o.t * 1000).getUTCFullYear() === year;
    if (type === 'daily_treasury_real_yield_curve') return '"Date","5 YR","7 YR","10 YR","20 YR","30 YR"\n' + s.fred.DFII10.filter(inYear).reverse().map((o) => `${usd(o.t)},1.5,1.6,${o.v.toFixed(2)},2.0,2.1`).join('\n');
    const b10 = new Map(s.fred.DGS10.map((o) => [o.t, o.v]));
    return 'Date,"1 Mo","2 Mo","3 Mo","6 Mo","1 Yr","2 Yr","5 Yr","10 Yr","30 Yr"\n' + s.fred.DGS2.filter(inYear).reverse().map((o) => `${usd(o.t)},4.1,4.1,4.0,3.9,3.8,${o.v.toFixed(2)},3.9,${(b10.get(o.t) || 4).toFixed(2)},4.6`).join('\n');
  };
  const base = fakeFetch(s, { down: ['fred.stlouisfed.org'], calls });
  const f = async (url, opt) => { const m = url.match(/daily-treasury-rates\.csv\/(\d{4})\/all\?type=(\w+)/); if (m) { calls.push(url); const body = csvFor(m[2], +m[1]); return { ok: true, status: 200, text: async () => body }; } return base(url, opt); };
  const { data, src } = await M.gather(f, NOW, {});
  assert.ok(data.fred.DFII10.length > 200 && data.fred.DGS2.length > 200 && data.fred.T10YIE.length > 200 && data.fred.T10Y3M.length > 200);
  assert.match(src['fred:DFII10'], /Treasury real 10Y ok/); assert.match(src["treasury:nominal"], /ok \(3 years\)/, "the synthetic world covers 3 calendar years");
  assert.equal(calls.filter((u) => u.includes('fred.stlouisfed.org')).length <= 2 * 7, true, 'stops hammering FRED once it is down');
  const p = M.parseTreasuryCsv('Date,"3 Mo","2 Yr","10 Yr"\n11/06/2026,3.90,3.55,4.10\n11/05/2026,3.91,,4.12\n');
  assert.deepEqual(p['2 yr'].map((o) => o.v), [3.55]); assert.equal(p['10 yr'][0].t, Date.UTC(2026, 10, 5) / 1000);
});

test('a full run on a fake network: files, sources, fallbacks, the analysis section', async () => {
  const s = synth(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'macro-'));
  fs.mkdirSync(path.join(dir, 'analysis')); fs.writeFileSync(path.join(dir, 'analysis', 'latest.md'), '# Weekly brief\n\nText.\n\n## Top 3 to watch\n\n1. Gold\n');
  const cal = [{ title: 'Non-Farm Employment Change', country: 'USD', date: '2026-11-09T08:30:00-05:00', impact: 'High', forecast: '120K', previous: '95K' }];
  const calls = [], logs = [];
  const fc = await M.run({ dir, now: NOW, fetchImpl: fakeFetch(s, { down: ['publicreporting.cftc.gov', 'boj.or.jp', 'id=SWPT'], cal, calls }), log: (m) => logs.push(m) });
  const out = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'forecast.json'), 'utf8'));
  assert.equal(out.target, '2026-11-09'); assert.equal(out.paperOnly, true);
  for (const a of M.AK) { assert.ok(out.assets[a].pUp >= 0.35 && out.assets[a].pUp <= 0.65); assert.ok(out.assets[a].expMovePct > 0); }
  assert.equal(out.dxy.pUp, +(1 - out.assets.eurusd.pUp).toFixed(3));
  assert.match(out.targetEvent, /Non-Farm/); assert.equal(out.playbook[0].consensus, '120K');
  assert.match(out.sources.cot, /failed/); assert.match(out.sources['fred:SWPT'], /failed/); assert.match(out.sources['rss:Fed'], /ok/);
  assert.ok(out.scorecard.replay.gold.n > 100 && out.scorecard.replay.gold.brier > 0);
  assert.ok(out.brief.length > 100 && /Honesty check/.test(out.brief));
  // move size: the selection protocol's verdict and the model's own record per market, said in the brief
  for (const a of M.AK) { const v = out.scorecard.vol[a];
    assert.ok(['naive', ...M.VOL_TRIED].includes(v.used) && v.used === out.assets[a].volModel && v.tried === (M.VIX_ASSETS.includes(a) ? 4 : 3));
    assert.ok(v.full.n > 100 && v.full.models.ewma.all.mae > 0 && v.full.models.ewma.all.maeNaive > 0 && v.full.models.har.event.qlike != null);
    if (v.used === 'naive') assert.equal(out.assets[a].expMovePct, out.assets[a].naiveMovePct); }
  assert.match(out.scorecard.volMethod, /QLIKE/); assert.match(out.brief, /Move size: /);
  assert.ok(calls.every((u) => !/api_key|apikey|token=/i.test(u)), 'keyless sources only');
  const hist = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'history.json'), 'utf8'));
  assert.equal(hist.length, 0, 'Friday evening is not yet the logging window for Monday (Sunday from 21:00 UTC)');
  const md = fs.readFileSync(path.join(dir, 'analysis', 'latest.md'), 'utf8');
  assert.ok(md.indexOf('<!-- macro:start -->') < md.indexOf('## Top 3'), 'section injected before Top 3');
  // a second run with every source down falls back to the cache (FRED) and still writes a forecast
  const fc2 = await M.run({ dir, now: NOW + 600, fetchImpl: async () => { throw new Error('offline'); }, log: () => {} });
  assert.match(fc2.sources['fred:DFII10'], /using cache/);
  assert.match(fc2.sources['calendar:cache'], /last good copy/);
  assert.equal(fc2.assets.gold.pUp, null, 'no prices: no direction call');
  const md2 = fs.readFileSync(path.join(dir, 'analysis', 'latest.md'), 'utf8');
  assert.equal(md2.split('<!-- macro:start -->').length, 2, 'the block is replaced, not duplicated');
  // Sunday 21:30 UTC: inside the window for Monday, so the five forecasts are logged once
  const sun = Date.UTC(2026, 10, 8, 21, 30) / 1000;
  await M.run({ dir, now: sun, fetchImpl: fakeFetch(s, { cal }), log: () => {} });
  await M.run({ dir, now: sun + 1800, fetchImpl: fakeFetch(s, { cal }), log: () => {} });
  const hist2 = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'history.json'), 'utf8'));
  assert.deepEqual(hist2.map((h) => h.id).sort(), M.AK.map((a) => `2026-11-09-${a}`).sort());
  assert.ok(hist2.every((h) => Date.parse(h.at) / 1000 === sun));
  assert.ok(fc.brief && fc2.brief);
});

// ─── the Macro veteran's challengers and lessons (8 Nov: the argument teaches the strategist) ───
test('veteran challengers: 4-week readings ride the replay with no weight; lessons adopt a proven one and hand it back', () => {
  const C = M.CHALLENGERS; assert.deepEqual(Object.keys(C), ['v_ry4w', 'v_d2_4w', 'v_dxy4w']); assert.equal(C.v_ry4w.vs, 'ry'); assert.deepEqual(C.v_ry4w.weights, M.W.ry);
  for (const k of Object.keys(C)) assert.equal(M.W[k], undefined, `${k} carries no weight of its own`);
  // drivers: the challengers vote from 4-week changes
  const list = M.drivers({ ry4w: -0.2, d2_4w: 0.3, dxy4w: -1.5, ry: null, vix: null, trend: {}, vol: {}, last: {}, D: 0 }).list;
  const by = Object.fromEntries(list.map((d) => [d.k, d])); assert.equal(by.v_ry4w.v, 1); assert.equal(by.v_d2_4w.v, -1); assert.equal(by.v_dxy4w.v, 1); assert.match(by.v_ry4w.detail, /−20 bp in 4 weeks/);
  assert.equal(M.drivers({ ry4w: null, d2_4w: null, dxy4w: null, ry: null, vix: null, trend: {}, vol: {}, last: {}, D: 0 }).list.find((d) => d.k === 'v_ry4w').v, null);
  // assetScore: a challenger counts only through adopted weights
  const L = [{ k: 'v_ry4w', v: 1 }, { k: 'ry', v: -1 }];
  assert.equal(M.assetScore(L, 'gold').s, -1, 'without a lesson only the incumbent votes');
  const adopted = { v_ry4w: { gold: 3 }, ry: { gold: 1.5 } };
  assert.equal(+M.assetScore(L, 'gold', adopted).s.toFixed(3), +((3 - 1.5) / 4.5).toFixed(3)); assert.deepEqual(M.weightsOf('v_ry4w', adopted), { gold: 3 }); assert.deepEqual(M.weightsOf('ry'), M.W.ry);
  // lessons: adopt when proven and ahead, revert when no longer proven; append-only
  const proven = { n: 400, hit: 0.58, t: 3.2, proven: true }, weak = { n: 400, hit: 0.52, t: 0.8, proven: false };
  let r = M.lessons([], { v_ry4w: proven, ry: weak }, 1794000000);
  assert.deepEqual(r.active, ['v_ry4w']); assert.equal(r.records.length, 1); assert.equal(r.records[0].action, 'adopt'); assert.match(r.records[0].why, /not proven/);
  assert.deepEqual(r.adopted.v_ry4w, M.W.ry); assert.equal(r.adopted.ry.gold, 1.5);
  r = M.lessons(r.records, { v_ry4w: proven, ry: weak }, 1794000600); assert.equal(r.records.length, 1, 'nothing new while the standing holds');
  r = M.lessons(r.records, { v_ry4w: { n: 420, hit: 0.53, t: 1.2, proven: false }, ry: weak }, 1794001200);
  assert.equal(r.records.length, 2); assert.equal(r.records[1].action, 'revert'); assert.deepEqual(r.active, []); assert.deepEqual(r.adopted, {});
  // not adopted: proven but not ahead of a proven incumbent; too few observations
  assert.deepEqual(M.lessons([], { v_ry4w: proven, ry: { n: 400, hit: 0.6, t: 4, proven: true } }, 0).active, []);
  assert.deepEqual(M.lessons([], { v_ry4w: { n: 20, hit: 0.9, t: 3.6, proven: true } }, 0).active, []);
  assert.equal(M.LESSON.provenT, 3);
});

// ---- COT release clock and the 3-year window (9 Nov data fix; the same rule as council/cot.mjs) ----
const T = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
// weekly gold rows ending at `last` (Tuesdays), net = f(k) (k = 0 oldest), plus a micro-contract row on each date (smaller book)
const cotWeeks = (last, n, f = (k) => 100000 + k * 100) => Array.from({ length: n }, (_, k) => ({ t: T(last) - (n - 1 - k) * 7 * DAY, net: f(k), gross: 200000 }));
const withMicro = (rows) => rows.flatMap((r) => [r, { t: r.t, net: -900, gross: 3000 }]);
// the reading for target day D (written at 21:00 UTC on D−1, as features() does)
const readFor = (rows, d) => M.cotReading(rows, T(d) - M.LOG_FROM * 3600);

test('COT clock: a report enters from the Tuesday target after the first Monday past its as-of date, never earlier', () => {
  // normal week: as-of Tue 3 Nov 2026, published Fri 6 Nov; known from Mon 9 Nov → the Tuesday 10 Nov forecast
  const normal = cotWeeks('2026-11-03', 20);
  assert.equal(readFor(normal, '2026-11-09').asOf, '2026-10-27', 'the Monday forecast (written Sunday 21:00 UTC) keeps the week before');
  assert.equal(readFor(normal, '2026-11-10').asOf, '2026-11-03');
  assert.equal(readFor(normal, '2026-11-10').knownAt, '2026-11-09');
  // Thanksgiving week: as-of Tue 26 Nov 2024 was published Mon 2 Dec. The old 4-day lag counted it from Sat 30 Nov, so the
  // Mon 2 Dec forecast (written Sun 1 Dec) used a report the CFTC had not published yet
  const thx = cotWeeks('2024-11-26', 20);
  assert.equal(readFor(thx, '2024-12-02').asOf, '2024-11-19', 'not on the holiday Monday');
  assert.equal(readFor(thx, '2024-12-03').asOf, '2024-11-26');
  // a Monday as-of date (holiday week, 3 Jul 2023): known Mon 10 Jul, used from Tue 11 Jul
  const mon = [...cotWeeks('2023-06-27', 10), { t: T('2023-07-03'), net: 5, gross: 200000 }];
  assert.equal(readFor(mon, '2023-07-10').asOf, '2023-06-27');
  assert.equal(readFor(mon, '2023-07-11').asOf, '2023-07-03');
});

test('COT clock: the 2025 shutdown backlog counts only once it was out (cot.mjs LATE), and the veteran shares the rule', async () => {
  const { usableAt, knownAt } = await import('../council/cot.mjs');
  const rows = cotWeeks('2025-12-30', 30);
  assert.equal(M.iso(usableAt(T('2025-10-07'))), '2026-02-02');
  assert.equal(M.iso(usableAt(T('2025-09-23'))), M.iso(knownAt(T('2025-09-23'))), 'the last week before the shutdown keeps its normal clock');
  assert.equal(readFor(rows, '2025-11-25').asOf, '2025-09-23', 'mid-backlog: the last report published on time');
  assert.equal(readFor(rows, '2026-02-03').asOf, '2025-12-30');
  // the veteran reads the same function at its own moment (`now`)
  const src = fs.readFileSync(new URL('../council/veteran.mjs', import.meta.url), 'utf8');
  assert.match(src, /S\.cot = cotReading\(cache && cache\.cot \|\| \[\], now\)/);
  assert.doesNotMatch(src, /r\.t <= now - 4 \* DAY/, 'no fixed 4-day COT lag left in the veteran');
  assert.doesNotMatch(fs.readFileSync(new URL('../council/macro.mjs', import.meta.url), 'utf8'), /COT_LAG/);
});

test('COT 3-year percentile: the prior 156 weeks of the main contract, the micro ignored, null under a year', () => {
  // 260 weekly rows rising by 100 a week; the last week drops back to 100000 + 18000
  const rows = cotWeeks('2026-11-03', 260, (k) => (k === 259 ? 118000 : 100000 + k * 100));
  const r = readFor(withMicro(rows), '2026-11-10');
  assert.equal(r.pctWeeks, 156);
  // the prior 156 weeks are k = 103..258 (nets 110300..125800); 118000 is at or above k = 103..180, 78 weeks → 50%
  assert.equal(r.pct, 50);
  assert.equal(r.net, 118000, 'the micro contract (net −900) never wins a date');
  assert.equal(r.chg4w, 118000 - (100000 + 255 * 100));
  const short = readFor(cotWeeks('2026-11-03', 40), '2026-11-10');
  assert.equal(short.pct, null); assert.equal(short.pctWeeks, 39);
  const d = M.drivers(M.features({ fred: {}, bars: {}, cot: cotWeeks('2026-11-03', 40) }, T('2026-11-10'))).list.find((x) => x.k === 'cot');
  assert.match(d.detail, /percentile n\/a \(39 weeks\)/); assert.equal(d.v, 0, 'no percentile, 4-week flow +400: no vote');
  const big = M.drivers(M.features({ fred: {}, bars: {}, cot: rows }, T('2026-11-10'))).list.find((x) => x.k === 'cot');
  assert.match(big.detail, /50th pct of 3 years/); assert.equal(big.v, -1, '−7.5k in 4 weeks votes down');
});

test('COT fetch: the COMEX 100 oz contract by its CFTC code, 600 weeks (not 200 rows by commodity name)', async () => {
  const s = synth(), calls = [];
  const rows = cotWeeks('2026-11-03', 300).map((r) => ({ report_date_as_yyyy_mm_dd: M.iso(r.t) + 'T00:00:00.000', m_money_positions_long_all: String(r.net + 20000), m_money_positions_short_all: '20000' }));
  const base = fakeFetch(s, { calls });
  const f = async (url, o) => (url.includes('publicreporting.cftc.gov') ? (calls.push(url), { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) }) : base(url, o));
  const { data, src } = await M.gather(f, NOW, {});
  const u = decodeURIComponent(calls.find((x) => x.includes('publicreporting')));
  assert.match(u, /cftc_contract_market_code='088691'/); assert.match(u, /\$limit=600/); assert.doesNotMatch(u, /commodity_name/);
  assert.equal(data.cot.length, 300); assert.match(src.cot, /ok \(300 weeks\)/);
});

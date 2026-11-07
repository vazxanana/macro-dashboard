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

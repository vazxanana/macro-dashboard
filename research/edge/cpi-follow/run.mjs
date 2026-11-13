// US CPI: follow or fade the first 15 minutes (08:30-08:45 New York), held to 11:00 or 16:00 New York. Pre-registered in
// PREREGISTRATION.md (pushed before any trade below was computed). Paper research only: nothing live reads this.
//
//   node --use-env-proxy research/edge/cpi-follow/run.mjs fetch <dir>   M5 candles from the site's OANDA proxy, kept out of git
//   node research/edge/cpi-follow/run.mjs full <dir>                     writes result.json and RESULT.md next to this file
//
// A new stand-alone event rule, not a gate / exit / entry / size of the supported gold book (owner decision 44 does not apply).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpiDates, MEMORY } from './events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'usdjpy', 'nas100'];
export const P = { floor: 0.25, fadeK: 1, filterK: 0.5, look: 20, lookMin: 10, lookDays: 45, exits: { '16:00': 960, '11:00': 660 } };
const MIN_KEEP = [480, 990];                                  // keep candles opening 08:00-16:29 New York

// ── New York clock (IANA zone, DST handled); offset cached per UTC hour ──
const FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
const OFF = new Map();
export function nyParts(t) {
  const h = t - (t % 3600); let o = OFF.get(h);
  if (o == null) { const p = Object.fromEntries(FMT.formatToParts(new Date(h * 1000)).map((x) => [x.type, x.value]));
    o = (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) / 1000) - h; OFF.set(h, o); }
  const d = new Date((t + o) * 1000);
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() };
}
export const dowOf = (date) => new Date(date + 'T12:00:00Z').getUTCDay();
export const isPayrollsLike = (date) => dowOf(date) === 5 && +date.slice(8, 10) <= 7;

// ── the rule ──
// day: Map minute -> [o, h, l, c] (candles of one New York day, by opening minute)
export function windowOf(day) {
  const p = day.get(505), w = [day.get(510), day.get(515), day.get(520)];
  if (!p || w.some((x) => !x)) return null;
  const pre = p[3], c45 = w[2][3], hi = Math.max(...w.map((x) => x[1])), lo = Math.min(...w.map((x) => x[2]));
  return { pre, c45, hi, lo, range: hi - lo, move: c45 - pre };
}
export function stopOf(rule, w) {
  const up = w.move > 0, dir = rule === 'follow' ? (up ? 1 : -1) : (up ? -1 : 1), e = w.c45;
  let stop;
  if (rule === 'follow') { stop = dir > 0 ? w.lo : w.hi; if (Math.abs(e - stop) < P.floor * w.range) stop = e - dir * P.floor * w.range; }
  else stop = up ? w.hi + P.fadeK * w.range : w.lo - P.fadeK * w.range;
  return { dir, entry: e, stop };
}
// manage from the 08:45 candle to the last candle opening before exitMin; stop first (gap at the open, else at the stop)
export function manage(day, s, exitMin) {
  const mins = [...day.keys()].filter((m) => m >= 525 && m < exitMin).sort((a, b) => a - b);
  if (!mins.length) return null;
  for (const m of mins) { const [o, h, l] = day.get(m);
    if (s.dir > 0 ? o <= s.stop : o >= s.stop) return { exit: o, how: 'stop-gap', at: m };
    if (s.dir > 0 ? l <= s.stop : h >= s.stop) return { exit: s.stop, how: 'stop', at: m }; }
  const m = mins[mins.length - 1]; return { exit: day.get(m)[3], how: 'time', at: m };
}
export function costOf(mk, px) {
  if (mk === 'xau') return 0.30;
  if (mk === 'nas100') return 1.5 + 2 * 1;
  const pip = mk === 'usdjpy' ? 0.01 : 0.0001;
  return 0.3 * pip + 4.5e-5 * px + 2 * pip;
}
export function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; }
// range filter: the 20 most recent earlier non-event weekdays (with all four candles) within 45 calendar days
export function filterRef(ranges, date, isEvent) {
  const lim = new Date(Date.parse(date + 'T12:00:00Z') - P.lookDays * 864e5).toISOString().slice(0, 10), got = [];
  for (let i = ranges.length - 1; i >= 0 && got.length < P.look; i--) { const [d, r] = ranges[i];
    if (d >= date) continue; if (d < lim) break; if (isEvent(d)) continue; got.push(r); }
  return got.length >= P.lookMin ? median(got) : null;
}
export function tradeDay(mk, day, rule, exitMin, ref, costK = 1) {
  const w = windowOf(day); if (!w) return { skip: 'candles' };
  if (w.move === 0) return { skip: 'flat' };
  if (ref == null) return { skip: 'no-ref' };
  if (w.range < P.filterK * ref) return { skip: 'filter' };
  const s = stopOf(rule, w), x = manage(day, s, exitMin); if (!x) return { skip: 'candles' };
  const risk = Math.abs(s.entry - s.stop); if (!(risk > 0)) return { skip: 'risk' };
  const gross = s.dir * (x.exit - s.entry) / risk, cost = costOf(mk, s.entry) * costK;
  return { dir: s.dir, entry: s.entry, stop: s.stop, exit: x.exit, how: x.how, risk, range: w.range, ref, gross, net: gross - cost / risk, costR: cost / risk };
}

// ── statistics ──
export function tstat(a) { const n = a.length; if (n < 2) return { n, mean: n ? a[0] : null, t: null };
  const m = a.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
  return { n, mean: m, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null }; }
function betacf(a, b, x) { let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; h *= d * c; aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; } return h; }
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); }
function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
// one-sided p of t with df degrees of freedom: P(T >= t)
export function pOne(t, df) { if (t == null) return 1; const p2 = ibeta(df / (df + t * t), df / 2, 0.5); return t > 0 ? p2 / 2 : 1 - p2 / 2; }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; }); return adj; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pct(a, q) { const s = [...a].sort((x, y) => x - y), k = (s.length - 1) * q, lo = Math.floor(k); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (k - lo); }

// ── fetch: whole history, weekday 08:00-16:29 New York kept ──
// Per market: <dir>/<mk>.json when done (a re-run skips it). A seed <dir>/<mk>-seed.json.gz (rows [t, o, h, l, c] of OANDA mid
// M5 from the same candle proxy, left by another study) is reused and only the stretches it does not cover are fetched.
// Progress is saved to <dir>/<mk>.part.json after every request, so an interruption loses at most one window.
// Requests are paced (one market at a time, 400 ms apart: about 150 a minute, the /md firewall allows 900).
const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
function keep(days, t, o, h, l, c) { const q = nyParts(t); if (q.dow === 0 || q.dow === 6 || q.min < MIN_KEEP[0] || q.min >= MIN_KEEP[1]) return 0;
  (days[q.date] ||= []).push([q.min, o, h, l, c]); return 1; }
async function fetchAll(dir) {
  const zlib = await import('node:zlib');
  fs.mkdirSync(dir, { recursive: true });
  const T0 = Date.UTC(2011, 11, 1) / 1000, NOW = Math.floor(Date.now() / 1000), STEP = 4999 * 300;
  for (const mk of MARKETS) {
    const f = path.join(dir, `${mk}.json`), part = path.join(dir, `${mk}.part.json`), seedF = path.join(dir, `${mk}-seed.json.gz`);
    if (fs.existsSync(f)) { console.log(mk, 'cached'); continue; }
    let st = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : null;
    if (!st) {
      st = { days: {}, todo: [[T0, NOW]], seed: null };
      if (fs.existsSync(seedF)) {
        const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(seedF))), s0 = rows[0][0], s1 = rows[rows.length - 1][0];
        for (const r of rows) if (r[0] >= T0) keep(st.days, r[0], r[1], r[2], r[3], r[4]);
        st.seed = { from: new Date(s0 * 1000).toISOString(), to: new Date(s1 * 1000).toISOString(), rows: rows.length };
        st.todo = [...(s0 > T0 ? [[T0, s0]] : []), [s1 + 300, NOW]];
      }
    }
    while (st.todo.length) {
      const [a, end] = st.todo[0], b = Math.min(end, a + STEP);
      if (a >= end) { st.todo.shift(); continue; }
      let j = null, err = '';
      for (let tr = 0; tr < 6 && !j; tr++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=${mk}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) });
        const x = r.ok ? await r.json() : null; if (x && Array.isArray(x.bars)) j = x; else err = `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
        if (!j) await sleep(2000 * (tr + 1)); }
      if (!j) { fs.writeFileSync(part, JSON.stringify(st)); throw new Error(`${mk} ${a}: ${err}`); }
      // a candle is kept only inside [a, end): the seed's own candles are never doubled
      for (const c of j.bars) if (!c.live && c.time >= a && c.time < end) keep(st.days, c.time, c.open, c.high, c.low, c.close);
      st.todo[0] = [b, end]; fs.writeFileSync(part, JSON.stringify(st));
      await sleep(400);
    }
    for (const d of Object.keys(st.days)) st.days[d].sort((x, y) => x[0] - y[0]);
    fs.writeFileSync(f, JSON.stringify(st.days)); fs.rmSync(part, { force: true });
    console.log(mk, Object.keys(st.days).length, 'days', st.seed ? `seed ${st.seed.from} to ${st.seed.to}` : 'no seed');
  }
}

function load(dir) {
  const out = {};
  for (const mk of MARKETS) { const raw = JSON.parse(fs.readFileSync(path.join(dir, `${mk}.json`), 'utf8')), m = new Map();
    for (const d of Object.keys(raw).sort()) m.set(d, new Map(raw[d].map((x) => [x[0], x.slice(1)])));
    out[mk] = m; }
  return out;
}

// ── the study ──
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const fmtR = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '') + x.toFixed(3));
export const TESTS = [['follow', '16:00'], ['follow', '11:00'], ['fade', '16:00'], ['fade', '11:00']];
const DEC0 = '2020-01-01', REP = ['2012-01-01', '2019-12-31'];

function study(dir) {
  const D = load(dir), NOW = Math.floor(Date.now() / 1000);
  const all = cpiDates(NOW), CPI = new Set(all.map((x) => x.d));
  const isEvent = (d) => CPI.has(d) || isPayrollsLike(d);
  // spike check on the memory dates (EUR/USD or USD/JPY 08:30 candle range >= 2x the median of the 20 weekdays before)
  const spike = (mk, d) => { const days = [...D[mk].keys()], i = days.indexOf(d); if (i < 0 || !D[mk].get(d).get(510)) return null;
    const ref = []; for (let j = i - 1; j >= 0 && ref.length < 20; j--) { const c = D[mk].get(days[j]).get(510); if (c) ref.push(c[1] - c[2]); }
    const med = median(ref), c = D[mk].get(d).get(510); return med > 0 ? (c[1] - c[2]) / med : null; };
  const used = [], dropped = [];
  for (const e of all) {
    if (e.src !== 'memory') { used.push(e); continue; }
    const a = spike('eurusd', e.d), b = spike('usdjpy', e.d), x = Math.max(a ?? 0, b ?? 0);
    (x >= 2 ? used : dropped).push({ ...e, spike: { eurusd: r2(a), usdjpy: r2(b) } });
  }
  // each market's daily window ranges in date order (for the filter)
  const RANGES = Object.fromEntries(MARKETS.map((mk) => [mk, [...D[mk].entries()].map(([d, day]) => { const w = windowOf(day); return w ? [d, w.range] : null; }).filter(Boolean)]));
  const refOf = (mk, d) => filterRef(RANGES[mk], d, isEvent);
  const run = (dates, rule, ex, costK = 1) => {
    const trades = [], skips = {};
    for (const d of dates) for (const mk of MARKETS) { const day = D[mk].get(d);
      if (!day) { skips.nodata = (skips.nodata || 0) + 1; continue; }
      const t = tradeDay(mk, day, rule, P.exits[ex], refOf(mk, d), costK);
      if (t.skip) skips[t.skip] = (skips[t.skip] || 0) + 1; else trades.push({ d, mk, ...t }); }
    return { trades, skips };
  };
  const evR = (trades, key = 'net') => { const by = new Map(); for (const t of trades) (by.get(t.d) || by.set(t.d, []).get(t.d)).push(t[key]);
    return [...by.values()].map((a) => a.reduce((s, x) => s + x, 0) / a.length); };
  const summ = (trades, key = 'net') => { const e = tstat(evR(trades, key)), tr = tstat(trades.map((t) => t[key]));
    return { events: e.n, eventR: r3(e.mean), t: r2(e.t), trades: tr.n, tradeR: r3(tr.mean), tTrades: r2(tr.t) }; };
  const inWin = (d, a, b) => d >= a && d <= b;
  const usedDates = used.map((e) => e.d);
  const decDates = usedDates.filter((d) => d >= DEC0), repDates = usedDates.filter((d) => inWin(d, ...REP));
  // placebo pool: decisive-window non-event weekdays on which at least one market has the four window candles
  const pool = [...new Set(MARKETS.flatMap((mk) => RANGES[mk].map((x) => x[0])))].filter((d) => d >= DEC0 && !isEvent(d) && dowOf(d) % 6 !== 0).sort();

  const tests = [], ps = [];
  for (const [rule, ex] of TESTS) {
    const dec = run(decDates, rule, ex), rep = run(repDates, rule, ex), sd = summ(dec.trades), sr = summ(rep.trades);
    const p = pOne(sd.t, sd.events - 1); ps.push(p);
    const plac = [];
    for (let s = 1; s <= 40; s++) { const rnd = mulberry32(s), a = [...pool];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      const e = evR(run(a.slice(0, sd.events), rule, ex).trades); plac.push(e.reduce((x, y) => x + y, 0) / e.length); }
    const perMk = Object.fromEntries(MARKETS.map((mk) => [mk, { decisive: summ(dec.trades.filter((t) => t.mk === mk)), replication: summ(rep.trades.filter((t) => t.mk === mk)) }]));
    const years = {}; for (const t of [...rep.trades, ...dec.trades]) (years[t.d.slice(0, 4)] ||= []).push(t);
    tests.push({ id: `${rule}-${ex}`, rule, exit: ex, p: +p.toPrecision(4),
      decisive: { ...sd, gross: summ(dec.trades, 'gross'), cost2x: summ(run(decDates, rule, ex, 2).trades), skips: dec.skips,
        stops: dec.trades.filter((t) => t.how !== 'time').length, medCostR: r3(median(dec.trades.map((t) => t.costR))) },
      replication: { ...sr, gross: summ(rep.trades, 'gross'), skips: rep.skips },
      placebo: { seeds: 40, p95: r3(pct(plac, 0.95)), median: r3(median(plac)), values: plac.map(r3) },
      perMarket: perMk, years: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, summ(a)])) });
  }
  const adj = holm(ps);
  tests.forEach((t, i) => { const d = t.decisive;
    t.holmP = +adj[i].toPrecision(4);
    t.checks = { decisive: d.eventR > 0 && d.t >= 2 && d.tradeR > 0, holm: adj[i] < 0.05, replication: t.replication.eventR > 0, placebo: d.eventR > t.placebo.p95 };
    t.pass = Object.values(t.checks).every(Boolean); });
  const pass = tests.filter((t) => t.pass).map((t) => t.id);
  return { used, dropped, decN: decDates.length, repN: repDates.length, pool: pool.length, tests, pass,
    first: usedDates[0], last: usedDates[usedDates.length - 1] };
}

function write(S) {
  const verdict = S.pass.length ? 'PASS' : 'FAIL';
  const best = [...S.tests].sort((a, b) => (b.decisive.t ?? -9) - (a.decisive.t ?? -9))[0];
  const headline = S.pass.length ? `${S.pass.join(', ')} passed every pre-registered check.`
    : `0 of 4 tests pass. Best on 2020-now: ${best.id}, ${fmtR(best.decisive.eventR)}R an event net (n ${best.decisive.events}, t ${best.decisive.t}); 2012-19 ${fmtR(best.replication.eventR)}R (n ${best.replication.events}).`;
  const result = { topic: 'cpi-follow', title: 'US CPI: follow or fade the first 15 minutes, held to the New York close',
    system: 'stand-alone event rule (not the supported gold book); XAU/USD, EUR/USD, USD/JPY, NAS100 OANDA mid M5',
    built: new Date().toISOString().slice(0, 10), preregistration: 'PREREGISTRATION.md', verdict, headline, params: P,
    windows: { decisive: `${DEC0} to the run date`, replication: REP.join(' to ') },
    events: { used: S.used.length, decisive: S.decN, replication: S.repN, first: S.first, last: S.last, droppedMemory: S.dropped.map((x) => ({ d: x.d, spike: x.spike })),
      memoryUsed: S.used.filter((x) => x.src === 'memory').length, memoryListed: MEMORY.length },
    placeboPool: S.pool, tests: S.tests };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  const row = (s) => `${s.events} | ${fmtR(s.eventR)} | ${s.t ?? 'n/a'} | ${s.trades} | ${fmtR(s.tradeR)}`;
  const md = [`# US CPI: follow or fade the first 15 minutes, held to the New York close: result`, '',
    `**Verdict: ${verdict}.** ${headline}`, '',
    'Paper research only; nothing live changed. Pre-registration: `PREREGISTRATION.md` (pushed before any trade was computed). A new stand-alone event rule, not a gate, exit, entry or size of the supported gold book (owner decision 44 does not apply). Not a repeat of `research/edge/event-reaction` (gold vs the dollar index\'s first 5-minute read, FAIL): this trades each market\'s own 08:30-08:45 move both ways, with a stop, net of costs.', '',
    `Events: ${S.used.length} CPI days (${S.first} to ${S.last}); decisive 2020-now ${S.decN}, replication 2012-19 ${S.repN}. The 2012-17 dates are from memory and were spike-checked: ${result.events.memoryUsed} of ${MEMORY.length} kept${S.dropped.length ? `, dropped ${S.dropped.map((x) => `${x.d} (EUR/USD ${x.spike.eurusd ?? 'n/a'}x, USD/JPY ${x.spike.usdjpy ?? 'n/a'}x)`).join(', ')}` : ''}. Still to be spot-checked against bls.gov.`, '',
    '## The four tests (pooled over the four markets; t over events, event R = mean net R of the markets traded that day)', '',
    '| Test | 2020-now events | event R | t | trades | R a trade | Holm p | 2012-19 events | event R | t | trades | R a trade | placebo p95 | pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...S.tests.map((t) => `| ${t.id} | ${row(t.decisive)} | ${t.holmP} | ${row(t.replication)} | ${fmtR(t.placebo.p95)} | ${t.pass ? 'yes' : 'no'} |`), '',
    'Checks per test (decisive t >= 2 and R > 0 / Holm p < 0.05 / 2012-19 same sign / above placebo p95):', '',
    ...S.tests.map((t) => `- ${t.id}: ${Object.entries(t.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')}`), '',
    '## Before costs and at double costs (2020-now, event R, t)', '',
    '| Test | gross event R | t | 2x costs event R | t | median cost in R | stopped out |', '|---|---|---|---|---|---|---|',
    ...S.tests.map((t) => `| ${t.id} | ${fmtR(t.decisive.gross.eventR)} | ${t.decisive.gross.t} | ${fmtR(t.decisive.cost2x.eventR)} | ${t.decisive.cost2x.t} | ${t.decisive.medCostR} | ${t.decisive.stops} of ${t.decisive.trades} |`), '',
    '## By market (net R a trade, t over trades; reported, never judged)', '',
    '| Test | Market | 2020-now n | R a trade | t | 2012-19 n | R a trade | t |', '|---|---|---|---|---|---|---|---|',
    ...S.tests.flatMap((t) => MARKETS.map((mk) => { const a = t.perMarket[mk].decisive, b = t.perMarket[mk].replication;
      return `| ${t.id} | ${mk} | ${a.trades} | ${fmtR(a.tradeR)} | ${a.tTrades ?? 'n/a'} | ${b.trades} | ${fmtR(b.tradeR)} | ${b.tTrades ?? 'n/a'} |`; })), '',
    '## Year by year (net event R, n events)', '',
    `| Year | ${S.tests.map((t) => t.id).join(' | ')} |`, `|---|${S.tests.map(() => '---').join('|')}|`,
    ...Object.keys(S.tests[0].years).sort().map((y) => `| ${y} | ${S.tests.map((t) => t.years[y] ? `${fmtR(t.years[y].eventR)} (${t.years[y].events})` : 'n/a').join(' | ')} |`), '',
    '## Placebo', '',
    `Each test's rule, filter, costs and exit on random non-event weekdays of 2020-now (pool ${S.pool} days; 40 seeds, as many days as the test's decisive events). Placebo median / 95th percentile of the mean event R: ${S.tests.map((t) => `${t.id} ${fmtR(t.placebo.median)} / ${fmtR(t.placebo.p95)}`).join('; ')}.`, '',
    '## Data', '',
    'OANDA mid M5 candles from the site\'s candle proxy, December 2011 to the run date, kept out of git. Gold and NAS100 reuse the continuous 2007-26 files of the fomc-follow study; EUR/USD and USD/JPY reuse the 2015-26 files of the fx-london-orb study, and 2011-12 to 2015-11 was fetched for this study (same proxy, same candles). The spike check is a guard on the memory dates only: it also drops real releases with a quiet first candle (2013-10-30, the delayed September 2013 CPI, is one), as pre-registered; no date was moved.', '',
    '## Costs', '',
    'Gold $0.30 a round trip (as fixed; no event slippage). EUR/USD and USD/JPY 0.3 pip + 22.5 USD a million a side + 1 pip of slippage on each of the two market fills. NAS100 1.5 points + 1 point on each of the two fills (3.5 points). Never call this rule an edge unless a test above says PASS.', ''];
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md.join('\n'));
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(1); }
  if (cmd === 'fetch') await fetchAll(dir);
  else if (cmd === 'full') { const r = write(study(dir)); console.log(r.verdict, r.headline); }
}

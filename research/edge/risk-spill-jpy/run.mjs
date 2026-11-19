// Edge research · risk-spill-jpy: does a strong S&P 500 cash session move USD/JPY and AUD/JPY in the next Asian session?
// Rule, costs, windows and pass bar: PREREGISTRATION.md (committed before this file was run).
//   node --use-env-proxy run.mjs fetch <dir>     OANDA mid spx500 M30, usdjpy / audjpy H1 (files <sym>-<tf>.json.gz, rows [t,o,h,l,c])
//   node run.mjs full <dir>                      writes result.json and RESULT.md beside this file
// Keep <dir> out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H = 3600, D = 86400;
export const FROM = Date.UTC(2007, 9, 1) / 1000, END = Date.UTC(2026, 10, 13) / 1000;
export const LAST_DAY = '2026-11-12';
export const WINDOWS = { rep: ['2008-01-01', '2015-12-31'], dec: ['2016-01-01', LAST_DAY] };
export const PAIRS = { usdjpy: { spread: 0.008 }, audjpy: { spread: 0.012 } };
export const COMMISSION_RT = 0.000045;   // 22.5 USD per million a side, as a fraction of the price (ctrader/symbols.json commissionRT)
export const LOOKBACK = 60, K = 1, ATR_N = 24, STOP_ATR = 1.5, SEEDS = 40, NEED_BEAT = 38, MIN_N = 150;

// ─── New York clock ───
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
// unix time of New York wall-clock hh:mm on the date ymd (DST through council/histdata.mjs)
export function nyTime(ymd, hh, mm = 0) {
  const local = Date.parse(ymd + 'T00:00:00Z') / 1000 + hh * H + mm * 60;
  let t = local + 5 * H;
  t = local + nyOffsetH(t) * H;
  return local + nyOffsetH(t) * H;
}
export const nyDate = (t) => iso((t - nyOffsetH(t) * H) * 1000);

// ─── NYSE calendar: full trading days only (early closes skipped) ───
const wdOf = (ymd) => new Date(ymd + 'T00:00:00Z').getUTCDay();
const addDays = (ymd, n) => iso(Date.parse(ymd + 'T00:00:00Z') + n * D * 1000);
const nth = (y, m, wd, n) => { // n-th weekday wd of month m (0-based); n = -1 last
  if (n > 0) { let d = Date.UTC(y, m, 1); while (new Date(d).getUTCDay() !== wd) d += D * 1000; return iso(d + (n - 1) * 7 * D * 1000); }
  let d = Date.UTC(y, m + 1, 0); while (new Date(d).getUTCDay() !== wd) d -= D * 1000; return iso(d);
};
const observed = (y, m, d) => { const s = iso(Date.UTC(y, m, d)), w = wdOf(s); return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s; };
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return Date.UTC(y, mo - 1, da);
}
const SPECIAL = new Set(['2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const CAL = new Map();
export function nyseYear(y) {
  if (CAL.has(y)) return CAL.get(y);
  const closed = new Set([nth(y, 0, 1, 3), nth(y, 1, 1, 3), iso(easter(y) - 2 * D * 1000), nth(y, 4, 1, -1), observed(y, 6, 4), nth(y, 8, 1, 1),
    nth(y, 10, 4, 4), observed(y, 11, 25)]);
  const ny = iso(Date.UTC(y, 0, 1)); if (wdOf(ny) === 0) closed.add(addDays(ny, 1)); else if (wdOf(ny) !== 6) closed.add(ny);   // NYSE does not observe a Saturday New Year on 31 Dec
  if (y >= 2022) closed.add(observed(y, 5, 19));
  const early = new Set();
  const j3 = iso(Date.UTC(y, 6, 3)); if (wdOf(j3) >= 1 && wdOf(j3) <= 5 && !closed.has(j3)) early.add(j3);
  early.add(addDays(nth(y, 10, 4, 4), 1));
  const c24 = iso(Date.UTC(y, 11, 24)); if (wdOf(c24) >= 1 && wdOf(c24) <= 5 && !closed.has(c24)) early.add(c24);
  const out = { closed, early }; CAL.set(y, out); return out;
}
export function fullDay(ymd) {
  const w = wdOf(ymd); if (w === 0 || w === 6 || SPECIAL.has(ymd)) return false;
  const c = nyseYear(+ymd.slice(0, 4)); return !c.closed.has(ymd) && !c.early.has(ymd);
}

// ─── signal ───
const index = (bars) => { const m = new Map(); bars.forEach((b, i) => m.set(b[0], i)); return m; };
// spx M30 rows → [{ day, r }] for every full NYSE day with both the 09:30 and the 15:30 candle (the close is the 16:00 one's start)
export function sessionReturns(spx, from = FROM, to = END) {
  const ix = index(spx), out = [];
  for (let t = from; t < to; t += D) {
    const day = iso(t * 1000); if (!fullDay(day)) continue;
    const a = ix.get(nyTime(day, 9, 30)), b = ix.get(nyTime(day, 15, 30));
    if (a == null || b == null) continue;
    out.push({ day, r: spx[b][4] / spx[a][1] - 1, closeAt: nyTime(day, 16) });
  }
  return out;
}
const sdOf = (xs) => { const n = xs.length, m = xs.reduce((s, v) => s + v, 0) / n; return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)); };
// days with |r| beyond K x the sd of the 60 previous kept days (day excluded)
export function signals(rets) {
  const out = [];
  for (let i = LOOKBACK; i < rets.length; i++) {
    const sd = sdOf(rets.slice(i - LOOKBACK, i).map((x) => x.r)), r = rets[i].r;
    if (r > K * sd) out.push({ ...rets[i], sd, side: 1 }); else if (r < -K * sd) out.push({ ...rets[i], sd, side: -1 });
  }
  return out;
}
// the next Asian session's 18:00 New York (Friday → Sunday)
export function entryTime(day) { const w = wdOf(day); return nyTime(addDays(day, w === 5 ? 2 : 0), 18); }

// ─── trade ───
export function atr(bars, i, n = ATR_N) {
  if (i < n + 1) return null;
  let s = 0; for (let j = i - n; j < i; j++) { const b = bars[j], p = bars[j - 1][4]; s += Math.max(b[2] - b[3], Math.abs(b[2] - p), Math.abs(b[3] - p)); }
  return s / n;
}
export const costOf = (pair, px) => PAIRS[pair].spread + COMMISSION_RT * px;
// one trade: entry at the open of the candle starting at `at`, out at the 03:00 New York open the next day or at the stop
export function trade(bars, ix, pair, at, side) {
  const i = ix.get(at); if (i == null) return null;
  const a = atr(bars, i); if (!(a > 0)) return null;
  const entry = bars[i][1], risk = STOP_ATR * a, stop = entry - side * risk;
  const exitAt = nyTime(nyDate(at + 7 * H), 3);   // 03:00 New York on the calendar day after the 18:00 entry
  let exit = null, how = 'time', last = null, rollover = false;
  for (let j = i; j < bars.length && bars[j][0] < exitAt; j++) {
    const b = bars[j];
    if (j > i && (side > 0 ? b[1] <= stop : b[1] >= stop)) { exit = b[1]; how = 'gap'; break; }
    if (side > 0 ? b[3] <= stop : b[2] >= stop) { exit = stop; how = 'stop'; break; }
    last = j;
  }
  if (exit == null) {
    const k = ix.get(exitAt);
    if (k != null) exit = bars[k][1]; else if (last != null) { exit = bars[last][4]; how = 'time-last'; } else return null;
  }
  // a 17:00 New York rollover between entry and exit? (never by construction)
  for (let t = at; t < exitAt; t += H) if (new Date((t - nyOffsetH(t) * H) * 1000).getUTCHours() === 17) rollover = true;
  const gross = side * (exit - entry) / risk, cost = costOf(pair, entry) / risk;
  return { at, side, entry, stop, risk, exit, how, gross, cost, net: gross - cost, net2: gross - 2 * cost, rollover };
}

// ─── statistics ───
export function stats(rs) {
  const n = rs.length; if (!n) return { n: 0 };
  const m = rs.reduce((s, v) => s + v, 0) / n, sd = n > 1 ? sdOf(rs) : 0;
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : 0, total: m * n, hit: rs.filter((v) => v > 0).length / n };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOne = (t) => 0.5 * (1 - erf(t / Math.SQRT2));   // one-sided normal p
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; });
  return adj;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const inW = (day, w) => day >= w[0] && day <= w[1];

export function analyse(spx, pairs) {
  const rets = sessionReturns(spx), sig = signals(rets), out = { sessions: rets.length, signals: { all: sig.length, up: sig.filter((s) => s.side > 0).length }, pairs: {} };
  for (const [pair, bars] of Object.entries(pairs)) {
    const ix = index(bars), rows = [];
    for (const s of sig) { const tr = trade(bars, ix, pair, entryTime(s.day), s.side); if (tr) rows.push({ day: s.day, fri: wdOf(s.day) === 5, ...tr }); }
    const part = (w) => rows.filter((x) => inW(x.day, w));
    const sum = (xs) => ({ ...stats(xs.map((x) => x.net)), gross: stats(xs.map((x) => x.gross)).mean, net2: stats(xs.map((x) => x.net2)).mean,
      stops: xs.length ? xs.filter((x) => x.how !== 'time' && x.how !== 'time-last').length / xs.length : 0, costR: xs.length ? xs.reduce((s, x) => s + x.cost, 0) / xs.length : 0 });
    const dec = part(WINDOWS.dec), rep = part(WINDOWS.rep);
    // placebo: random kept days of the decisive window with an entry, same n and the same long / short count
    const pool = rets.filter((x) => inW(x.day, WINDOWS.dec) && ix.has(entryTime(x.day)) && atr(bars, ix.get(entryTime(x.day))) > 0).map((x) => x.day);
    const nLong = dec.filter((x) => x.side > 0).length, plac = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = rng(seed), days = shuffle(pool.slice(), r).slice(0, dec.length), sides = shuffle(days.map((_, k) => (k < nLong ? 1 : -1)), r);
      const rs = days.map((d, k) => trade(bars, ix, pair, entryTime(d), sides[k])).filter(Boolean).map((x) => x.net);
      plac.push(+stats(rs).mean.toFixed(4));
    }
    const years = {}; for (const x of rows) (years[x.day.slice(0, 4)] ||= []).push(x.net);
    out.pairs[pair] = {
      all: sum(rows), dec: sum(dec), rep: sum(rep),
      decUp: sum(dec.filter((x) => x.side > 0)), decDown: sum(dec.filter((x) => x.side < 0)),
      decFri: sum(dec.filter((x) => x.fri)), decNoFri: sum(dec.filter((x) => !x.fri)),
      years: Object.fromEntries(Object.entries(years).map(([y, v]) => [y, stats(v)])),
      placebo: { means: plac, beaten: plac.filter((m) => sum(dec).mean > m).length, pool: pool.length },
      rollovers: rows.filter((x) => x.rollover).length, timeLast: rows.filter((x) => x.how === 'time-last').length,
    };
  }
  // tests
  const names = Object.keys(out.pairs), ps = names.map((p) => pOne(out.pairs[p].dec.t)), adj = holm(ps);
  names.forEach((p, k) => {
    const x = out.pairs[p], c = { positive: x.dec.mean > 0, t2: x.dec.t >= 2, holm: adj[k] < 0.05, n: x.dec.n >= MIN_N, sameSign: x.rep.mean > 0, placebo: x.placebo.beaten >= NEED_BEAT };
    x.test = { p: ps[k], holmP: adj[k], checks: c, pass: Object.values(c).every(Boolean) };
  });
  out.verdict = names.some((p) => out.pairs[p].test.pass) ? 'PASS' : 'FAIL';
  return out;
}

// ─── report ───
const f = (v, d = 3) => (v == null || !Number.isFinite(v) ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const pct = (v) => (100 * v).toFixed(1) + ' %';
export function report(res) {
  const P = res.pairs, L = [];
  const NAME = { positive: 'net R not above 0', t2: 't under 2', holm: 'Holm p over 0.05', n: 'n under 150', sameSign: 'negative on 2008-15', placebo: 'placebo not beaten' };
  const fails = (p) => Object.entries(P[p].test.checks).filter(([, ok]) => !ok).map(([k]) => NAME[k]);
  L.push('# Result: risk spillover into the yen after a strong S&P 500 cash session (13 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}, ${Object.values(P).filter((x) => x.test.pass).length} of 2 pairs.** ` + Object.keys(P).map((p) =>
    `${p === 'usdjpy' ? 'USD/JPY' : 'AUD/JPY'} ${f(P[p].dec.mean)}R a trade net on 2016-26 (n ${P[p].dec.n}, t ${f(P[p].dec.t, 2)}, ${P[p].test.pass ? 'passes' : 'fails: ' + fails(p).join(', ')})`).join('; ') +
    '. Not an edge; no proposal, nothing live changed.', '');
  L.push(`OANDA mid candles: S&P 500 cash session from the 09:30 to the 16:00 New York M30 candle on ${res.sessions} full NYSE days ` +
    `(Oct 2007 to ${LAST_DAY}); ${res.signals.all} signal days beyond ±1 × the previous 60 days' standard deviation (${res.signals.up} up). ` +
    'Each trade: the pair\'s H1 open at 18:00 New York (Friday signals on Sunday), with the S&P day, stop 1.5 × ATR(24 H1), out at the 03:00 New York open. ' +
    'Costs: commission 0.0045 % of price a round trip (measured) plus 0.8 pip USD/JPY / 1.2 pip AUD/JPY (assumed); no rollover crossed.', '');
  L.push('| Pair | window | n | net R a trade | t | gross R | x2 costs | cost R | hit | stopped |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const p of Object.keys(P)) for (const [w, lab] of [['dec', '2016-26 (decisive)'], ['rep', '2008-15']]) {
    const x = P[p][w]; L.push(`| ${p} | ${lab} | ${x.n} | ${f(x.mean)} | ${f(x.t, 2)} | ${f(x.gross)} | ${f(x.net2)} | ${f(x.costR)} | ${pct(x.hit)} | ${pct(x.stops)} |`);
  }
  L.push('', '## The bar, check by check (decisive window)', '', '| Pair | net > 0 | t ≥ 2 | Holm p | n ≥ 150 | 2008-15 > 0 | placebo beaten (of 40, need 38) | pass |', '|---|---|---|---|---|---|---|---|');
  for (const p of Object.keys(P)) { const t = P[p].test, c = t.checks, y = (b) => (b ? 'yes' : 'no');
    L.push(`| ${p} | ${y(c.positive)} | ${y(c.t2)} (${f(P[p].dec.t, 2)}) | ${t.holmP.toFixed(3)} | ${y(c.n)} | ${y(c.sameSign)} | ${P[p].placebo.beaten} | ${y(t.pass)} |`); }
  L.push('', '## Descriptive (not part of the bar)', '');
  for (const p of Object.keys(P)) {
    const x = P[p];
    L.push(`- **${p}**: after up days ${f(x.decUp.mean)}R (n ${x.decUp.n}, t ${f(x.decUp.t, 2)}), after down days ${f(x.decDown.mean)}R (n ${x.decDown.n}, t ${f(x.decDown.t, 2)}); ` +
      `Friday signals ${f(x.decFri.mean)}R (n ${x.decFri.n}), the rest ${f(x.decNoFri.mean)}R (n ${x.decNoFri.n}). Placebo means ${f(Math.min(...x.placebo.means))} to ${f(Math.max(...x.placebo.means))}R. ` +
      `By year (net R a trade, n): ${Object.entries(x.years).map(([y, s]) => `${y} ${f(s.mean, 2)} (${s.n})`).join(', ')}. Trades crossing a rollover: ${x.rollovers}.`);
  }
  const neg = Object.keys(P).filter((p) => P[p].dec.t <= -2);
  if (neg.length) L.push('', `Post hoc, not part of the bar: ${neg.join(', ')} lost in the decisive window with t ≤ −2 (and in 2008-15). ` +
    'Fading the signal was not pre-registered; it is not a finding and would need its own pre-registration on other data. Before costs the loss is small ' +
    '(gross R a trade above), so most of it is the cost of a 9-hour trade with a 1.5 ATR stop.');
  L.push('', 'To repeat: `node --use-env-proxy research/edge/risk-spill-jpy/run.mjs fetch <dir>` (candles outside git), then `node research/edge/risk-spill-jpy/run.mjs full <dir>`. Tests: `tests/risk-spill-jpy.test.mjs`.', '');
  return L.join('\n');
}

// ─── fetch / main ───
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function range(sym, tf, sec) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * sec); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
const FILES = [['spx500', '30m', 1800], ['usdjpy', '1h', 3600], ['audjpy', '1h', 3600]];
const load = (dir, sym, tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-${tf}.json.gz`))));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node run.mjs fetch|full <dir>');
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const [sym, tf, sec] of FILES) {
      const fp = path.join(dir, `${sym}-${tf}.json.gz`); if (fs.existsSync(fp)) { console.log(sym, 'exists'); continue; }
      const bars = await range(sym, tf, sec); fs.writeFileSync(fp, zlib.gzipSync(JSON.stringify(bars))); console.log(sym, tf, bars.length);
    }
  } else if (cmd === 'full') {
    const res = analyse(load(dir, 'spx500', '30m'), { usdjpy: load(dir, 'usdjpy', '1h'), audjpy: load(dir, 'audjpy', '1h') });
    const out = { built: '2026-11-13', study: 'risk-spill-jpy', verdict: res.verdict, data: 'OANDA mid: spx500 M30, usdjpy / audjpy H1, Oct 2007 to ' + LAST_DAY,
      cost: { commissionRT: COMMISSION_RT, spread: Object.fromEntries(Object.entries(PAIRS).map(([k, v]) => [k, v.spread])) }, windows: WINDOWS, ...res };
    const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(6) : v)));
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(round(out), null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(round(out)));
    console.log(report(round(out)));
  }
}

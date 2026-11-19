// Edge research · nfp-follow: follow (or fade) the first 15 minutes after the US Employment Situation release, on gold and
// NAS100, with a stop beyond the 15-minute range and a 1.5R target, out at 11:00 New York. Rule, windows, the four tests and
// the pass bar: PREREGISTRATION.md (committed before this file existed). A NEW stand-alone event rule decided on 2020 to now
// (owner decision item 44: not a test of the gold book). Paper research only: nothing here trades or changes a live rule.
//   node --use-env-proxy run.mjs fetch <dir>   -> <dir>/nfp-m5.json.gz (study days only, kept out of git)
//   CANDLES=<dir> node run.mjs run             -> result.json and RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { HISTORY, EVENTS, zonedToUtc } from '../../../council/events.mjs';

export const P = { M5: 300, TP_R: 1.5, SKIP_K: 0.5, ATR_N: 20, MIN_STOP: 0.25, EXIT: '11:00', ENTRY: '08:45', OPEN: '08:30',
  WARM_FROM: '06:00', SEEDS: 40, BEAT: 38, MIN_N: 60, T_MIN: 2, FROM: '2010-01-01', SPLIT: '2020-01-01' };
export const MARKETS = { xau: { name: 'XAU/USD (OANDA mid)', buf: 0.30, cost: 0.30 }, nas100: { name: 'NAS100 (OANDA mid)', buf: 2.0, cost: 2.0 } };
export const RULES = { F: 'follow the 08:30-08:45 direction', R: 'fade the 08:30-08:45 direction' };
const TZ = 'America/New_York';

// ─── release dates ───
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
// BLS rule: reference week = the Sunday-Saturday week containing the 12th of reference month m (1-12) of year y; the release
// is the third Friday after that Saturday. Returns the computed date before exceptions.
export function blsRuleDate(y, m) { const d12 = Date.UTC(y, m - 1, 12), dow = new Date(d12).getUTCDay(), sat = d12 + (6 - dow) * 86400e3; return ymd(sat + 20 * 86400e3); }
// the exceptions, as data (PREREGISTRATION.md "Release dates")
export const SHUTDOWN = { '2013-10-04': '2013-10-22', '2013-11-01': '2013-11-08' };
export function blsDate(y, m) {
  let d = blsRuleDate(y, m); if (SHUTDOWN[d]) return SHUTDOWN[d];
  const [Y, M, D] = d.split('-').map(Number), t = Date.UTC(Y, M - 1, D);
  if (M === 1 && D <= 3) return ymd(t + 7 * 86400e3);                                          // January: one week later
  const jul4 = new Date(Date.UTC(Y, 6, 4)).getUTCDay(), hol = jul4 === 6 ? 3 : jul4 === 0 ? 5 : 4;   // observed 4 July
  if (M === 7 && D === hol) return ymd(t - 86400e3);                                            // the Thursday before
  return d;
}
export function nfpDates(until) {
  const out = [];
  for (let y = 2009; y <= 2021; y++) for (let m = 1; m <= 12; m++) { if (y === 2009 && m < 12) continue; if (y === 2021 && m === 12) continue; out.push(blsDate(y, m)); }
  for (const e of [...HISTORY, ...EVENTS]) if (e.type === 'NFP') out.push(e.local.slice(0, 10));
  return [...new Set(out)].filter((d) => d >= P.FROM && d <= until).sort();
}
export function fridays(from, until) { const out = []; let t = Date.parse(from + 'T00:00:00Z'); while (new Date(t).getUTCDay() !== 5) t += 86400e3; for (; ymd(t) <= until; t += 7 * 86400e3) out.push(ymd(t)); return out; }
export const at = (date, hhmm) => zonedToUtc(date, hhmm, TZ);

// ─── one trade ───
// bars: that day's M5 candles {time, open, high, low, close}, oldest first. rule 'F' | 'R'. Returns { trade } or { skip }.
export function tradeDay(bars, date, rule, mk) {
  const M = MARKETS[mk], t0 = at(date, P.OPEN), tE = at(date, P.ENTRY), tX = at(date, P.EXIT), w0 = at(date, P.WARM_FROM), by = new Map(bars.map((b) => [b.time, b]));
  const f = [t0, t0 + P.M5, t0 + 2 * P.M5].map((t) => by.get(t)), eb = by.get(tE);
  const before = bars.filter((b) => b.time < t0 && b.time >= w0);
  if (f.some((b) => !b) || !eb || before.length < P.ATR_N) return { skip: 'no data' };
  const warm = before.slice(-P.ATR_N), prev = before.length > P.ATR_N ? before[before.length - P.ATR_N - 1] : null;
  let trs = 0; warm.forEach((b, i) => { const pc = i ? warm[i - 1].close : prev ? prev.close : null; trs += pc == null ? b.high - b.low : Math.max(b.high, pc) - Math.min(b.low, pc); });
  const atr = trs / P.ATR_N, O = f[0].open, C = f[2].close, H = Math.max(...f.map((b) => b.high)), L = Math.min(...f.map((b) => b.low)), range = H - L;
  const d = Math.sign(C - O); if (!d) return { skip: 'flat' };
  if (range < P.SKIP_K * 3 * atr) return { skip: 'small range' };
  const s = rule === 'F' ? d : -d, E = eb.open, stop = s > 0 ? L - M.buf : H + M.buf, r0 = s * (E - stop);
  if (!(r0 > 0) || r0 < P.MIN_STOP * range) return { skip: 'stop too close' };
  const target = E + s * P.TP_R * r0, path = bars.filter((b) => b.time >= tE && b.time < tX);
  let exit = null, px = null, xt = null;
  for (const b of path) {
    if (s > 0 ? b.open <= stop : b.open >= stop) { exit = 'stop (gap)'; px = b.open; xt = b.time; break; }
    if (s > 0 ? b.low <= stop : b.high >= stop) { exit = 'stop'; px = stop; xt = b.time; break; }
    if (s > 0 ? b.high >= target : b.low <= target) { exit = 'target'; px = target; xt = b.time; break; }
  }
  if (!exit) { const last = path.at(-1); exit = 'time'; px = last.close; xt = last.time + P.M5; }
  const gross = (s * (px - E)) / r0, rd = (x) => +x.toFixed(4);
  return { trade: { date, mk, rule, side: s, dir: d, O, C, H, L, atr: rd(atr), E, stop: rd(stop), target: rd(target), r0: rd(r0), exit, exitPx: rd(px), exitAt: xt,
    gross: rd(gross), net: rd(gross - M.cost / r0), net2: rd(gross - (2 * M.cost) / r0) } };
}

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
export function tStat(a) { const n = a.length; if (n < 3) return null; const m = mean(a), v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1); return v > 0 ? m / Math.sqrt(v / n) : null; }
export function normP(t) { if (t == null) return 1; const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2), q = d * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274)))); return t > 0 ? q : 1 - q; }
export function holm(ps) { const o = Object.entries(ps).sort((a, b) => a[1] - b[1]), out = {}; let top = 0; o.forEach(([k, p], i) => { top = Math.max(top, Math.min(1, p * (o.length - i))); out[k] = +top.toFixed(4); }); return out; }
const r2 = (x) => (x == null ? null : +x.toFixed(3));
export function summary(T) { const net = T.map((x) => x.net), t = tStat(net); return { n: T.length, avg: r2(mean(net)), t: r2(t), p: +normP(t).toFixed(4), gross: r2(mean(T.map((x) => x.gross))), x2: r2(mean(T.map((x) => x.net2))), total: r2(net.reduce((s, x) => s + x, 0)), win: T.length ? +(T.filter((x) => x.net > 0).length / T.length * 100).toFixed(1) : null }; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function sample(arr, k, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); }
export function verdictOf(S) {
  const c = { 'decisive n >= 60': S.dec.n >= P.MIN_N, 'decisive mean net R > 0 and t >= 2': S.dec.avg > 0 && S.dec.t >= P.T_MIN, 'Holm p < 0.05': S.pHolm < 0.05,
    'replication 2010-19 mean net R > 0': S.rep.avg > 0, 'beats >= 38 of 40 placebo draws': S.placebo.beats >= P.BEAT };
  return { pass: Object.values(c).every(Boolean), checks: c };
}

// ─── the study on a candle cache { mk: { date: [[t,o,h,l,c], ...] } } ───
export function study(cache, until) {
  const nfp = nfpDates(until), nfpSet = new Set(nfp), other = fridays(P.FROM, until).filter((d) => !nfpSet.has(d));
  const bars = (mk, d) => (cache[mk][d] || []).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  const tests = {}, dateCheck = [];
  for (const mk of Object.keys(MARKETS)) for (const rule of Object.keys(RULES)) {
    const key = `${rule}-${mk}`, funnel = { days: 0 }, T = [];
    for (const d of nfp) { funnel.days++; const r = tradeDay(bars(mk, d), d, rule, mk); if (r.skip) funnel[r.skip] = (funnel[r.skip] || 0) + 1; else T.push(r.trade); }
    funnel.trades = T.length;
    const dec = T.filter((x) => x.date >= P.SPLIT), rep = T.filter((x) => x.date < P.SPLIT), years = {}, exits = {};
    for (const x of T) { const y = x.date.slice(0, 4); (years[y] ||= []).push(x); exits[x.exit] = (exits[x.exit] || 0) + 1; }
    // placebo: the same rule on other Fridays of the decisive window
    const decDays = nfp.filter((d) => d >= P.SPLIT).length, pool = other.filter((d) => d >= P.SPLIT), res = new Map();
    for (const d of pool) { const r = tradeDay(bars(mk, d), d, rule, mk); res.set(d, r.trade || null); }
    const means = []; for (let s = 1; s <= P.SEEDS; s++) { const pick = sample(pool, decDays, mulberry32(s)).map((d) => res.get(d)).filter(Boolean); means.push(r2(mean(pick.map((x) => x.net)))); }
    const allOther = [...res.values()].filter(Boolean), dS = summary(dec);
    tests[key] = { market: mk, rule, ruleText: RULES[rule], funnel, dec: dS, rep: summary(rep), all: summary(T), exits,
      years: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { n: a.length, total: r2(a.reduce((s, x) => s + x.net, 0)) }])),
      placebo: { seeds: P.SEEDS, drawn: decDays, pool: pool.length, beats: means.filter((m) => m != null && dS.avg != null && dS.avg > m).length, median: r2([...means].sort((a, b) => a - b)[P.SEEDS / 2]), means, allOther: summary(allOther) },
      trades: T.map((x) => ({ d: x.date, side: x.side > 0 ? 'buy' : 'sell', exit: x.exit, R: x.net })) };
  }
  const ph = holm(Object.fromEntries(Object.entries(tests).map(([k, v]) => [k, v.dec.p])));
  for (const [k, v] of Object.entries(tests)) { v.pHolm = ph[k]; v.verdict = verdictOf(v); }
  // date check (report only): the 08:30 gold candle's range against the median 08:30 range of the 8 nearest other Fridays
  const r830 = (d) => { const b = bars('xau', d).find((x) => x.time === at(d, P.OPEN)); return b ? b.high - b.low : null; };
  for (const d of nfp) { const t = Date.parse(d), near = other.map((o) => [Math.abs(Date.parse(o) - t), o]).sort((a, b) => a[0] - b[0]).slice(0, 8).map((x) => r830(x[1])).filter((x) => x != null).sort((a, b) => a - b), v = r830(d);
    if (v == null || near.length < 4) { dateCheck.push({ d, ratio: null }); continue; } const med = near[near.length >> 1]; dateCheck.push({ d, ratio: med > 0 ? r2(v / med) : null }); }
  const passed = Object.entries(tests).filter(([, v]) => v.verdict.pass).map(([k]) => k);
  return { nfp: nfp.length, other: other.length, tests, dateCheck: { flagged: dateCheck.filter((x) => x.ratio == null || x.ratio < 1.5), checked: dateCheck.length }, verdict: passed.length ? 'PASS' : 'FAIL', passed };
}

// ─── the report (RESULT.md is exactly this text) ───
const sg = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(3)}`);
export function report(R) {
  const T = R.tests, ks = Object.keys(T), name = (k) => `${T[k].rule === 'F' ? 'Follow' : 'Fade'} · ${T[k].market === 'xau' ? 'gold' : 'NAS100'}`;
  const best = ks.slice().sort((a, b) => (T[b].dec.t ?? -9) - (T[a].dec.t ?? -9))[0], B = T[best];
  const head = R.verdict === 'PASS'
    ? `**Verdict: PASS** for ${R.passed.map(name).join(', ')} on the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). A paper shadow proposal at most; no live change.`
    : `**Verdict: FAIL**, 0 of 4 tests pass the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). Best on the decisive window: ${name(best)}, ${sg(B.dec.avg)}R a trade net (n ${B.dec.n}, t ${B.dec.t ?? 'n/a'}, Holm p ${B.pHolm}). Not an edge; nothing live changes.`;
  const L = [`# Result: NFP follow or fade, gold and NAS100 (${R.built})`, '', head, '',
    `A new stand-alone event rule (owner decision item 44): it is not a test of the gold book and reads none of its positions or its 2006-17 window.`,
    `Release dates: ${R.nfp} Employment Situation releases ${R.data.from} to ${R.data.until} (BLS rule with its exceptions to 2021, \`council/events.mjs\` from 2022). Candles: ${R.data.src}.`, '',
    '| Test | Decisive 2020-now: n | R a trade net | t | Holm p | gross | at 2x cost | Replication 2010-19: n | R a trade net | t | Placebo: beats of 40 (median) | Pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const k of ks) { const v = T[k]; L.push(`| ${name(k)} | ${v.dec.n} | ${sg(v.dec.avg)} | ${v.dec.t ?? 'n/a'} | ${v.pHolm} | ${sg(v.dec.gross)} | ${sg(v.dec.x2)} | ${v.rep.n} | ${sg(v.rep.avg)} | ${v.rep.t ?? 'n/a'} | ${v.placebo.beats} (${sg(v.placebo.median)}) | ${v.verdict.pass ? 'yes' : 'no'} |`); }
  L.push('', '## Checks per test', '');
  for (const k of ks) { const v = T[k]; L.push(`- **${name(k)}**: ${Object.entries(v.verdict.checks).map(([c, ok]) => `${c} ${ok ? 'met' : 'NOT met'}`).join('; ')}.`); }
  L.push('', '## Days, skips and exits', '');
  for (const k of ks) { const v = T[k], f = v.funnel; L.push(`- ${name(k)}: ${f.days} release days, ${f.trades} trades; skipped: ${['no data', 'flat', 'small range', 'stop too close'].map((s) => `${s} ${f[s] || 0}`).join(', ')}. Exits: ${Object.entries(v.exits).map(([e, n]) => `${e} ${n}`).join(', ')}. Every other Friday of 2020-now (${v.placebo.allOther.n} trades): ${sg(v.placebo.allOther.avg)}R a trade net.`); }
  L.push('', '## By year (net R summed)', '', `| Year | ${ks.map(name).join(' | ')} |`, `|---|${ks.map(() => '---').join('|')}|`);
  const ys = [...new Set(ks.flatMap((k) => Object.keys(T[k].years)))].sort();
  for (const y of ys) L.push(`| ${y} | ${ks.map((k) => (T[k].years[y] ? `${sg(T[k].years[y].total)} (${T[k].years[y].n})` : '-')).join(' | ')} |`);
  L.push('', '## Notes', '',
    `- Date check (reported, nothing dropped): ${R.dateCheck.flagged.length} of ${R.dateCheck.checked} release dates have an 08:30 gold candle under 1.5x the median 08:30 range of the 8 nearest other Fridays, or no candle${R.dateCheck.flagged.length ? `: ${R.dateCheck.flagged.map((x) => x.d).join(', ')}` : ''}.`,
    '- Fade and follow are near mirror images (same entry, the stop on the other side of the range), so their t values are not independent; Holm treats them as four tests anyway.',
    '- One trade a release, no overlap: t is on trades. Costs: $0.30 a round trip on gold, 2 points on NAS100; no overnight (out by 11:00 New York).',
    `- To repeat: \`node --use-env-proxy research/edge/nfp-follow/run.mjs fetch <dir>\` (candles kept out of git), then \`CANDLES=<dir> node research/edge/nfp-follow/run.mjs run\`.`, '');
  return L.join('\n');
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
async function day(mk, d) {
  const a = Date.parse(d + 'T10:00:00Z') / 1000, b = Date.parse(d + 'T16:30:00Z') / 1000; let err = null;
  for (let k = 0; k < 6; k++) { try { const r = await fetch(`${BASE}bars?sym=${mk}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) }); const x = r.ok ? await r.json() : null;
    if (x && x.src === 'OANDA' && Array.isArray(x.bars)) return x.bars.filter((y) => !y.live && y.time >= a && y.time < b).map((y) => [+y.time, +y.open, +y.high, +y.low, +y.close]);
    err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } await sleep(1500 * (k + 1)); }
  throw new Error(`${mk} ${d}: ${err}`);
}
if (MODE === 'fetch') {
  const OUT = process.argv[3], f = path.join(OUT, 'nfp-m5.json.gz'); fs.mkdirSync(OUT, { recursive: true });
  const until = today(), days = [...new Set([...nfpDates(until), ...fridays(P.FROM, until)])].sort().filter((d) => d < until);
  const cache = fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f))) : {};
  for (const mk of Object.keys(MARKETS)) { cache[mk] ||= {}; const todo = days.filter((d) => !(d in cache[mk])); let i = 0;
    const worker = async () => { while (i < todo.length) { const d = todo[i++]; cache[mk][d] = await day(mk, d); await sleep(120); } };
    await Promise.all([worker(), worker(), worker()]); console.error(`${mk}: ${Object.keys(cache[mk]).length} days`); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(cache))); }
}
if (MODE === 'run') {
  const cache = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'nfp-m5.json.gz'))));
  const until = process.env.UNTIL || Object.keys(cache.xau).sort().at(-1);
  const R = { topic: 'nfp-follow', built: process.env.BUILT || today(), system: 'NFP morning: follow or fade the 08:30-08:45 New York move, stop beyond the 15-minute range, 1.5R target, out at 11:00; gold and NAS100, OANDA mid M5',
    data: { from: P.FROM, until, src: 'OANDA mid M5 through the keyless candle proxy, 10:00-16:30 UTC of each study day' }, params: { ...P, markets: MARKETS }, ...study(cache, until) };
  R.candidates = Object.entries(R.tests).map(([k, v]) => ({ rule: `${k}: ${v.ruleText} (${v.market})`, verdict: v.verdict.pass ? 'PASS' : 'FAIL', is: v.rep, oos: v.dec }));
  R.headline = report(R).split('\n')[2].replace(/\*\*/g, '');
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  for (const [k, v] of Object.entries(R.tests)) console.error(k, JSON.stringify(v.dec), 'rep', JSON.stringify(v.rep), 'placebo', v.placebo.beats, v.verdict.pass);
  console.error(R.headline);
}

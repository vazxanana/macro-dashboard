// Edge research · oil-wednesday: the weekly US crude inventory report (Wednesday 10:30 New York) on WTI, fade (F) or follow (C)
// the first M30 candle after the release. PREREGISTRATION.md came first; nothing here changes its rules.
//   node --use-env-proxy research/edge/oil-wednesday/run.mjs fetch <dir>   OANDA mid M30 WTICO_USD -> <dir>/wtico-30m.json.gz
//   node research/edge/oil-wednesday/run.mjs full <dir>                     -> result.json, RESULT.md (this folder)
// Keep <dir> out of git. Pure functions are exported for tests/oil-wednesday.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';

const H = 3600, D = 86400, M30 = 1800;
export const COST = 0.03, BUF = 0.01, MIN_RANGE = 0.3, ATR_N = 20, SEEDS = 40, NEED_BEAT = 38, MIN_N = 150;
export const WINDOWS = { replication: ['2016-01-01', '2020-12-31'], decisive: ['2021-01-01', '2099-12-31'] };

// ---- calendar -------------------------------------------------------------------------------------------------------------
const ymd = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const nth = (y, m, wd, n) => { const f = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return 1 + ((wd - f + 7) % 7) + 7 * (n - 1); };
const last = (y, m, wd) => { const l = new Date(Date.UTC(y, m, 0)); return l.getUTCDate() - ((l.getUTCDay() - wd + 7) % 7); };
function observed(y, m, d) {
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const t = Date.UTC(y, m - 1, d) / 1000 + (wd === 6 ? -D : wd === 0 ? D : 0);
  return new Date(t * 1000).toISOString().slice(0, 10);
}
// US federal holidays (observed dates) of calendar year y, plus the Friday 31 Dec observance of next year's New Year's Day
export function holidays(y) {
  const s = new Set([observed(y, 1, 1), ymd(y, 1, nth(y, 1, 1, 3)), ymd(y, 2, nth(y, 2, 1, 3)), ymd(y, 5, last(y, 5, 1)),
    observed(y, 7, 4), ymd(y, 9, nth(y, 9, 1, 1)), ymd(y, 10, nth(y, 10, 1, 2)), observed(y, 11, 11), ymd(y, 11, nth(y, 11, 4, 4)),
    observed(y, 12, 25), observed(y + 1, 1, 1)]);
  if (y >= 2021) s.add(observed(y, 6, 19));
  return s;
}
const HC = new Map();
export const isHoliday = (iso) => { const y = +iso.slice(0, 4); for (const k of [y - 1, y]) { if (!HC.has(k)) HC.set(k, holidays(k)); if (HC.get(k).has(iso)) return true; } return false; };
// UTC seconds of a New York wall-clock time on the date iso
export function nyToUtc(iso, h, mi) {
  const [y, m, d] = iso.split('-').map(Number), base = Date.UTC(y, m - 1, d, h, mi) / 1000;
  return base + nyOffsetH(base + 5 * H) * H;
}
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * D * 1000).toISOString().slice(0, 10);
// One release per week (Monday iso -> { date, t }), or { skip } when the delayed Thursday is itself a holiday
export function releaseOf(monday) {
  const wk = [0, 1, 2].map((k) => addDays(monday, k));
  if (wk.some(isHoliday)) { const th = addDays(monday, 3); return isHoliday(th) ? { skip: true, week: monday } : { week: monday, date: th, t: nyToUtc(th, 11, 0), delayed: true }; }
  const we = addDays(monday, 2); return { week: monday, date: we, t: nyToUtc(we, 10, 30), delayed: false };
}
export function releases(fromIso, toIso) {
  let mo = fromIso; while (new Date(mo + 'T00:00:00Z').getUTCDay() !== 1) mo = addDays(mo, 1);
  const out = []; for (; mo <= toIso; mo = addDays(mo, 7)) out.push(releaseOf(mo));
  return out;
}

// ---- the rule ---------------------------------------------------------------------------------------------------------------
export function indexBars(bars) { const ix = new Map(); bars.forEach((b, i) => ix.set(b.time, i)); return ix; }
// ATR = simple mean true range of the ATR_N candles that closed before bar i opened (bar i itself excluded)
export function atrBefore(bars, i, n = ATR_N) {
  if (i < n + 1) return null;
  let s = 0; for (let k = i - n; k < i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// One event: the reaction candle opening at t0; rule 'F' or 'C'; exit at exitT (16:00 New York). null = no trade.
export function trade(bars, ix, t0, exitT, rule, opt = {}) {
  const cost = opt.cost ?? COST, i = ix.get(t0);
  if (i == null) return null;
  const rc = bars[i], e = bars[i + 1];
  if (!e || e.time !== t0 + M30 || e.time + M30 > exitT) return null;
  if (rc.close === rc.open) return null;
  const atr = atrBefore(bars, i); if (atr == null || !(atr > 0)) return null;
  if (rc.high - rc.low < MIN_RANGE * atr) return null;
  const dir = rc.close > rc.open ? 1 : -1, side = rule === 'F' ? -dir : dir;
  const stop = +(side === 1 ? rc.low - BUF : rc.high + BUF).toFixed(6);
  const entry = e.open, risk = (entry - stop) * side;
  if (!(risk > 1e-9)) return null;   // float noise counts as zero risk (the pre-registered "risk <= 0 is no trade")
  let exit = null, how = 'time', k = i + 1;
  for (; k < bars.length && bars[k].time + M30 <= exitT; k++) {
    const b = bars[k];
    if (side === 1 ? b.open <= stop : b.open >= stop) { exit = b.open; how = 'gap'; break; }
    if (side === 1 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; break; }
    exit = b.close;
  }
  const R = ((exit - entry) * side) / risk;
  return { t: t0, side, entry, stop, exit, how, risk: +risk.toFixed(4), R, net: R - cost / risk, net2: R - (2 * cost) / risk, atr };
}
// placebo: per release week a random weekday (Mon-Fri) that is neither the report day nor a holiday, at 10:30 New York
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placeboDays(rel, seed) {
  const r = rng(seed), out = [];
  for (const x of rel) {
    if (x.skip) continue;
    const c = [0, 1, 2, 3, 4].map((k) => addDays(x.week, k)).filter((d) => d !== x.date && !isHoliday(d));
    if (!c.length) continue;
    const d = c[Math.floor(r() * c.length)]; out.push({ date: d, t: nyToUtc(d, 10, 30) });
  }
  return out;
}
const ex16 = (date) => nyToUtc(date, 16, 0);
export function runRule(bars, ix, events, rule, opt) {
  const T = []; for (const ev of events) { if (ev.skip) continue; const tr = trade(bars, ix, ev.t, ex16(ev.date), rule, opt); if (tr) { tr.date = ev.date; T.push(tr); } }
  return T;
}

// ---- statistics ---------------------------------------------------------------------------------------------------------------
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const p2 = (t) => 2 * (1 - 0.5 * (1 + erf(Math.abs(t) / Math.SQRT2)));
export function stats(T, k = 'net') {
  const v = T.map((x) => x[k]), n = v.length; if (!n) return { n: 0 };
  const m = v.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  const t = sd > 0 ? m / (sd / Math.sqrt(n)) : 0;
  let eq = 0, pk = 0, dd = 0; for (const x of v) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const w = v.filter((x) => x > 0).length;
  const med = [...v].sort((a, b) => a - b)[Math.floor(n / 2)];
  return { n, mean: +m.toFixed(4), median: +med.toFixed(4), t: +t.toFixed(2), p: +p2(t).toFixed(4), total: +eq.toFixed(1), win: +(w / n).toFixed(3), dd: +dd.toFixed(1) };
}
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let mx = 0; o.forEach(([p, i], r) => { mx = Math.max(mx, Math.min(1, p * (ps.length - r))); adj[i] = mx; }); return adj; }
export const inWin = (T, [f, t]) => T.filter((x) => x.date >= f && x.date <= t);
export function judge(dec, rep, holmP, beat) {
  const why = [];
  if (!(dec.mean > 0)) why.push('decisive mean net R not above 0');
  if (!(holmP < 0.05 && dec.t >= 2)) why.push('Holm p not under 0.05 with t >= 2');
  if (!(dec.n >= MIN_N)) why.push(`decisive n under ${MIN_N}`);
  if (!(rep.mean > 0)) why.push('2016-2020 mean not above 0');
  if (!(beat >= NEED_BEAT)) why.push(`beats ${beat} of ${SEEDS} placebo seeds (needs ${NEED_BEAT})`);
  return { pass: !why.length, why };
}

// ---- fetch / full -----------------------------------------------------------------------------------------------------------
async function fetchAll(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const FROM = Date.parse('2015-11-01T00:00:00Z') / 1000, END = Math.floor(Date.now() / 1000 / M30) * M30;
  const m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * M30); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=wtico&tf=30m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`wtico 30m ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  const bars = [...m.values()].sort((p, q) => p[0] - q[0]).filter((x) => x[0] + M30 <= END);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'wtico-30m.json.gz'), zlib.gzipSync(JSON.stringify(bars)));
  console.log(`wtico 30m: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString()} -> ${new Date(bars.at(-1)[0] * 1000).toISOString()}`);
}
export function loadBars(dir) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'wtico-30m.json.gz')))).map(([time, open, high, low, close]) => ({ time, open, high, low, close })); }

export function analyse(bars) {
  const ix = indexBars(bars), first = new Date(bars[0].time * 1000).toISOString().slice(0, 10), lastD = new Date(bars.at(-1).time * 1000).toISOString().slice(0, 10);
  const rel = releases('2016-01-01', lastD), out = { rules: {}, calendar: { weeks: rel.length, delayed: rel.filter((x) => x.delayed).length, skipped: rel.filter((x) => x.skip).length } };
  const S = (T) => ({ net: stats(T), gross: stats(T, 'R'), x2: stats(T, 'net2') });
  for (const rule of ['F', 'C']) {
    const T = runRule(bars, ix, rel, rule), dec = inWin(T, WINDOWS.decisive), rep = inWin(T, WINDOWS.replication);
    const plac = []; for (let s = 1; s <= SEEDS; s++) plac.push(stats(inWin(runRule(bars, ix, placeboDays(rel, s), rule), WINDOWS.decisive)).mean);
    const years = {}; for (let y = 2016; y <= 2026; y++) { const s = stats(inWin(T, [`${y}-01-01`, `${y}-12-31`])); if (s.n) years[y] = s; }
    out.rules[rule] = { decisive: S(dec), replication: S(rep), sides: { buy: stats(dec.filter((x) => x.side === 1)), sell: stats(dec.filter((x) => x.side === -1)) },
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((h) => [h, dec.filter((x) => x.how === h).length])), years,
      tiny: dec.filter((x) => x.risk < 0.05).length,
      medianRisk: +[...dec.map((x) => x.risk)].sort((a, b) => a - b)[Math.floor(dec.length / 2)]?.toFixed(3),
      placebo: { means: plac.map((x) => +(x ?? 0).toFixed(4)), beat: plac.filter((x) => dec.length && stats(dec).mean > x).length } };
  }
  const adj = holm(['F', 'C'].map((r) => out.rules[r].decisive.net.p));
  ['F', 'C'].forEach((r, k) => { const x = out.rules[r]; x.holmP = +adj[k].toFixed(4); x.verdict = judge(x.decisive.net, x.replication.net, adj[k], x.placebo.beat); });
  out.verdict = ['F', 'C'].some((r) => out.rules[r].verdict.pass) ? 'PASS' : 'FAIL';
  out.data = { src: 'OANDA mid M30 WTICO_USD via the site proxy', from: first, to: lastD, candles: bars.length };
  return out;
}

const f2 = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
export function report(res) {
  const L = [], r = res.rules, name = { F: 'F (fade)', C: 'C (continue)' };
  L.push('# Result: the weekly US crude inventory report on WTI, fade or follow the first half hour (oil-wednesday)', '');
  const np = ['F', 'C'].filter((k) => r[k].verdict.pass).length;
  L.push(`**Verdict: ${res.verdict}, ${np} of 2 rules pass: ${np ? 'a reaction to the report worth a paper shadow' : 'neither fading nor following the first half hour after the report is an edge on WTI'}.** ` +['F', 'C'].map((k) => `Rule ${name[k]}: decisive 2021 on ${f2(r[k].decisive.net.mean)}R a trade net (n ${r[k].decisive.net.n}, t ${r[k].decisive.net.t}, Holm p ${r[k].holmP}), 2016-20 ${f2(r[k].replication.net.mean)}R (n ${r[k].replication.net.n}), beats ${r[k].placebo.beat} of 40 placebo seeds: ${r[k].verdict.pass ? 'PASS' : 'fail (' + r[k].verdict.why.join('; ') + ')'}.`).join(' '), '');
  L.push(`Pre-registered in PREREGISTRATION.md (pushed first). Data: ${res.data.src}, ${res.data.from} to ${res.data.to}, ${res.data.candles} candles. Calendar: ${res.calendar.weeks} weeks, ${res.calendar.delayed} delayed to Thursday 11:00, ${res.calendar.skipped} skipped. Costs $${COST} a round trip; no overnight. Research only: nothing live changed.`, '');
  L.push('| Rule | Window | n | net R a trade | t | win | total R | worst DD | gross R a trade | x2 cost R a trade |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ['F', 'C']) for (const w of ['replication', 'decisive']) { const s = r[k][w]; L.push(`| ${name[k]} | ${w === 'decisive' ? '2021 on' : '2016-20'} | ${s.net.n} | ${f2(s.net.mean)} | ${s.net.t} | ${s.net.win} | ${s.net.total} | ${s.net.dd} | ${f2(s.gross.mean)} | ${f2(s.x2.mean)} |`); }
  L.push('', '## Decisive window by side, exits, placebo', '');
  for (const k of ['F', 'C']) { const x = r[k], pm = [...x.placebo.means].sort((a, b) => a - b);
    L.push(`- Rule ${name[k]}: buys ${f2(x.sides.buy.mean)}R (n ${x.sides.buy.n}), sells ${f2(x.sides.sell.mean)}R (n ${x.sides.sell.n}); exits stop ${x.exits.stop}, gap ${x.exits.gap}, time ${x.exits.time}; median risk $${x.medianRisk}; median net R ${f2(x.decisive.net.median)}; trades risking under $0.05: ${x.tiny}; placebo means ${f2(pm[0])} to ${f2(pm.at(-1))}R (median ${f2(pm[20])}).`); }
  L.push('', '## By year (net R a trade, n)', '', '| Year | F | C |', '|---|---|---|');
  for (let y = 2016; y <= 2026; y++) { const a = r.F.years[y], b = r.C.years[y]; if (!a && !b) continue; L.push(`| ${y} | ${a ? f2(a.mean) + ' (' + a.n + ')' : '—'} | ${b ? f2(b.mean) + ' (' + b.n + ')' : '—'} |`); }
  L.push('', '## Reading', '', res.verdict === 'PASS'
    ? 'A passing rule is a proposal to the owner for a paper shadow stream only (every trade with its stop); nothing live changed.'
    : 'Neither reading of the first half hour after the report is an edge on WTI by the pre-registered bar. Never call it one; no proposal is written and nothing live changed. ' +
      `The fade's stop sits just past the reaction candle's extreme, often a few cents from the entry, so its R per trade has very long tails (decisive gross ${f2(r.F.decisive.gross.mean)}R a trade, t ${r.F.decisive.gross.t}, median net ${f2(r.F.decisive.net.median)}R; one year, 2025, carries the sign) and the $${COST} spread is a large share of a small risk. ` +
      'Not tested: consensus surprises (no consensus data), other exits, the report on Brent.', '');
  return L.join('\n');
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: run.mjs fetch|full <dir>');
  if (cmd === 'fetch') await fetchAll(dir);
  else if (cmd === 'full') {
    const res = analyse(loadBars(dir)); res.built = '2026-11-13';
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(report(res).split('\n').slice(0, 3).join('\n'));
  } else throw new Error('unknown command');
}

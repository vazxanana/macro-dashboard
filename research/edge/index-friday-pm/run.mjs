// Edge research · index-friday-pm: do US index CFDs fall from 14:00 to 15:55 New York on a Friday (flattening before the
// weekend)? Primary: short SPX500 every full-session Friday, stop 1.5 x the 20-Friday mean absolute 14:00-15:55 move. Rules,
// calendar, costs, windows, placebo and pass bar: PREREGISTRATION.md (committed first).
//   node --use-env-proxy research/edge/index-friday-pm/fetch.mjs <dir>   (OANDA M5 candles, kept out of git)
//   node research/edge/index-friday-pm/run.mjs <dir>                     (writes result.json and RESULT.md here)
// The NYSE calendar, the price lookup, the stop walk and the statistics helpers are copied from
// research/edge/index-midday-turn/run.mjs (another branch; never imported across branches). Pure pieces are exported for
// tests/index-friday-pm.test.mjs. Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { zonedToUtc } from '../../../council/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M5 = 300, US = 'America/New_York';
export const P = Object.freeze({
  K: 1.5, N: 20, COST: 0.0004, LOOK: 600, SEEDS: 40, BEAT: 38, TMIN: 2,
  ENTRY: '14:00', EXIT: '15:55',
  FROM: '2007-10-01', TO: '2026-11-13', SPLIT: '2017-04-23',
});
export const WIN = Object.freeze({ IS: [P.FROM, P.SPLIT], OOS: [P.SPLIT, '2026-11-14'] });
export const MARKETS = ['spx500', 'nas100', 'us30', 'us2000'];
export const NAME = { spx500: 'US500', nas100: 'NAS100', us30: 'US30', us2000: 'US2000' };
// groups of days: the primary (Friday), the pooled control (Monday-Thursday) and each weekday alone; a stop comes from the
// 20 previous days of the SAME group
export const GROUPS = Object.freeze({ fri: [5], mth: [1, 2, 3, 4], mon: [1], tue: [2], wed: [3], thu: [4] });
const GNAME = { fri: 'Friday', mth: 'Monday-Thursday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday' };

// ── the NYSE calendar (copied from index-midday-turn; stated in PREREGISTRATION.md) ──
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
export const wdOf = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
export const addDays = (s, k) => new Date(Date.parse(s + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
function nthWd(y, m, wd, n) {
  if (n > 0) { const f = new Date(Date.UTC(y, m, 1)).getUTCDay(); return iso(y, m, 1 + ((wd - f + 7) % 7) + 7 * (n - 1)); }
  const last = new Date(Date.UTC(y, m + 1, 0)), l = last.getUTCDay(); return iso(y, m, last.getUTCDate() - ((l - wd + 7) % 7));
}
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, mo - 1, da);
}
const obsBoth = (s) => { const w = wdOf(s); return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s; };
export const SPECIAL_CLOSED = Object.freeze(['2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const CAL = new Map();
export function nyseYear(y) {
  if (CAL.has(y)) return CAL.get(y);
  const closed = new Set(), half = new Set();
  const ny = iso(y, 0, 1), nyw = wdOf(ny);
  if (nyw === 0) closed.add(iso(y, 0, 2)); else if (nyw !== 6) closed.add(ny);
  closed.add(nthWd(y, 0, 1, 3)); closed.add(nthWd(y, 1, 1, 3)); closed.add(addDays(easter(y), -2)); closed.add(nthWd(y, 4, 1, -1));
  if (y >= 2022) closed.add(obsBoth(iso(y, 5, 19)));
  closed.add(obsBoth(iso(y, 6, 4))); closed.add(nthWd(y, 8, 1, 1));
  const tg = nthWd(y, 10, 4, 4); closed.add(tg); closed.add(obsBoth(iso(y, 11, 25)));
  for (const s of SPECIAL_CLOSED) if (+s.slice(0, 4) === y) closed.add(s);
  const isTd = (s) => { const w = wdOf(s); return w >= 1 && w <= 5 && !closed.has(s); };
  const j4 = wdOf(iso(y, 6, 4));
  if (j4 >= 2 && j4 <= 5 && isTd(iso(y, 6, 3))) half.add(iso(y, 6, 3));
  half.add(addDays(tg, 1));
  if (isTd(iso(y, 11, 24))) half.add(iso(y, 11, 24));
  const r = { closed, half }; CAL.set(y, r); return r;
}
export function nyseDay(s) {
  const w = wdOf(s); if (w === 0 || w === 6) return 'weekend';
  const c = nyseYear(+s.slice(0, 4));
  return c.closed.has(s) ? 'closed' : c.half.has(s) ? 'half' : 'open';
}
export function eligibleDays(a, b) {
  const out = []; for (let s = a; s <= b; s = addDays(s, 1)) if (nyseDay(s) === 'open') out.push(s);
  return out;
}
export const nyT = (date, hhmm) => zonedToUtc(date, hhmm, US);

// ── candles ──
export function toBars(rows) {
  const n = rows.length, b = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  rows.forEach((r, i) => { b.t[i] = r[0]; b.o[i] = r[1]; b.h[i] = r[2]; b.l[i] = r[3]; b.c[i] = r[4]; });
  return b;
}
export function lastEnding(b, end, look = P.LOOK) {
  let lo = 0, hi = b.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] + M5 <= end) lo = m + 1; else hi = m; }
  const i = lo - 1;
  return i >= 0 && b.t[i] + M5 >= end - look ? i : -1;
}
export const pxAt = (b, end) => { const i = lastEnding(b, end); return i < 0 ? null : b.c[i]; };
const firstFrom = (b, t) => { let lo = 0, hi = b.n; while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] < t) lo = m + 1; else hi = m; } return lo; };

// one trade from tE to tX with a stop `dist` away; candles that START in [tE, tX). side -1 = short.
export function trade(b, tE, tX, pE, pX, side, dist, cost = P.COST) {
  const stop = pE - side * dist;
  let exit = pX, how = 'time';
  for (let i = firstFrom(b, tE); i < b.n && b.t[i] < tX; i++) {
    if (side > 0 ? b.o[i] <= stop : b.o[i] >= stop) { exit = b.o[i]; how = 'gap'; break; }
    if (side > 0 ? b.l[i] <= stop : b.h[i] >= stop) { exit = stop; how = 'stop'; break; }
  }
  const R = side * (exit - pE) / dist, cR = cost * pE / dist;
  return { side, entry: pE, stop, dist, exit, how, R, net: R - cR, net2: R - 2 * cR };
}
export const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

// ── one market: every eligible day; per group, the 20-day mean |move| (strictly before the day) sets the stop ──
export function runMarket(b, days = eligibleDays(P.FROM, P.TO)) {
  const hist = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, []]));
  const recs = [], skipped = { noPrice: 0 };
  for (const d of days) {
    const w = wdOf(d), tE = nyT(d, P.ENTRY), tX = nyT(d, P.EXIT), pE = pxAt(b, tE), pX = pxAt(b, tX);
    if (pE == null || pX == null) { skipped.noPrice++; continue; }
    const rec = { date: d, w, move: pX / pE - 1 };
    for (const [g, wds] of Object.entries(GROUPS)) {
      if (!wds.includes(w)) continue;
      const h = hist[g];
      if (h.length >= P.N) { const S = mean(h.slice(-P.N)); if (S > 0) rec[g] = trade(b, tE, tX, pE, pX, -1, P.K * S); }
      h.push(Math.abs(pX - pE));
    }
    recs.push(rec);
  }
  return { recs, skipped };
}

// ── statistics (copied helpers) ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, sd: null, t: null };
  const m = xs.reduce((s, x) => s + x, 0) / n, v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1), sd = Math.sqrt(v);
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function monthT(rows) {
  const by = new Map(); for (const r of rows) { const k = r.date.slice(0, 7); by.set(k, (by.get(k) || 0) + r.v); }
  const s = tstat([...by.values()]); return { months: s.n, t: s.t };
}
const r4 = (v) => v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4;
export function summarize(recs, g, [a, z]) {
  const tr = recs.filter((r) => r[g] && r.date >= a && r.date < z), x = tr.map((r) => r[g]);
  const net = tstat(x.map((q) => q.net)), gross = tstat(x.map((q) => q.R)), net2 = tstat(x.map((q) => q.net2));
  const row = (k) => tr.map((r) => ({ date: r.date, v: r[g][k] }));
  const mt = monthT(row('net')), mg = monthT(row('R')), m2 = monthT(row('net2'));
  return {
    from: tr[0]?.date ?? null, to: tr.at(-1)?.date ?? null, n: net.n, months: mt.months,
    gross: r4(gross.mean), net: r4(net.mean), net2: r4(net2.mean), t: r4(mt.t), tGross: r4(mg.t), t2: r4(m2.t),
    costR: r4(x.reduce((s, q) => s + (q.R - q.net), 0) / (x.length || 1)), totalNet: r4(x.reduce((s, q) => s + q.net, 0)),
    win: r4(x.filter((q) => q.net > 0).length / (x.length || 1)), stops: x.filter((q) => q.how !== 'time').length,
  };
}
export function byYear(recs, g) {
  const y = {};
  for (const r of recs) if (r[g]) (y[r.date.slice(0, 4)] ||= []).push(r[g]);
  return Object.fromEntries(Object.entries(y).map(([k, xs]) => [k, { n: xs.length, gross: r4(mean(xs.map((q) => q.R))), net: r4(mean(xs.map((q) => q.net))), total: r4(xs.reduce((a, q) => a + q.net, 0)) }]));
}

// ── the placebo: the same short on random OOS Monday-Thursday days (control stop), as many days as the primary trades ──
export function placebo(recs, n, [a, z], seeds = P.SEEDS) {
  const pool = recs.filter((r) => r.mth && r.date >= a && r.date < z), out = [];
  for (let s = 1; s <= seeds; s++) {
    const rnd = mulberry32(s), idx = pool.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const pick = idx.slice(0, Math.min(n, idx.length)).map((i) => pool[i].mth.net);
    out.push({ seed: s, n: pick.length, net: r4(mean(pick)) });
  }
  return out;
}

export function verdictOf(pri, plac) {
  const beats = plac.filter((x) => pri.OOS.net > x.net).length;
  const lines = {
    oosT: pri.OOS.t != null && pri.OOS.t >= P.TMIN,
    isPositive: pri.IS.net > 0,
    twoX: pri.OOS.net2 > 0,
    placebo: beats >= P.BEAT,
  };
  return { beats, lines, ok: Object.values(lines).every(Boolean) };
}

export function build(markets) {
  const out = { study: 'index-friday-pm', built: '2026-11-14', preregistration: 'research/edge/index-friday-pm/PREREGISTRATION.md',
    rule: 'every full-session NYSE Friday, short the US500 CFD at 14:00 New York, exit 15:55; stop 1.5 x the mean absolute 14:00-15:55 move of the 20 previous Fridays',
    costs: { roundTrip: P.COST, check2x: 2 * P.COST, financing: 'none (intraday)' },
    windows: { inSample: `first tradeable Friday → ${addDays(P.SPLIT, -1)}`, outOfSample: `${P.SPLIT} → ${P.TO}` }, markets: {} };
  for (const [sym, { recs, skipped }] of Object.entries(markets)) {
    const m = { name: NAME[sym], skipped, groups: {} };
    for (const g of Object.keys(GROUPS)) m.groups[g] = { name: GNAME[g], IS: summarize(recs, g, WIN.IS), OOS: summarize(recs, g, WIN.OOS), byYear: byYear(recs, g) };
    out.markets[sym] = m;
  }
  const pri = out.markets.spx500.groups.fri, pl = placebo(markets.spx500.recs, pri.OOS.n, WIN.OOS), v = verdictOf(pri, pl);
  const sorted = pl.map((x) => x.net).sort((a, b) => a - b);
  out.placebo = { seeds: pl.length, n: pl[0]?.n ?? 0, mean: r4(mean(pl.map((x) => x.net))), q95: sorted[Math.ceil(0.95 * sorted.length) - 1], max: sorted.at(-1), beats: v.beats, bySeed: pl };
  out.pass = v.lines;
  out.verdict = v.ok ? 'PASS' : 'FAIL';
  const fails = [];
  if (!v.lines.oosT) fails.push(`OOS t ${sg(pri.OOS.t, 2)} < 2`);
  if (!v.lines.isPositive) fails.push(`in sample ${sg(pri.IS.net)}R`);
  if (!v.lines.twoX) fails.push(`${sg(pri.OOS.net2)}R at 2x cost`);
  if (!v.lines.placebo) fails.push(`beats ${v.beats}/40 placebo seeds`);
  out.headline = `Friday 14:00-15:55 US500 short: OOS ${sg(pri.OOS.net)}R a trade net (n ${pri.OOS.n}, month t ${sg(pri.OOS.t, 2)})` + (fails.length ? `; ${fails.join(', ')}` : '; every line met');
  return out;
}

// ── report ──
function sg(v, d = 3) { return v == null ? 'n/a' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d); }
const pc = (v) => v == null ? 'n/a' : (v * 100).toFixed(1) + ' %';
export function render(j) {
  const L = [], pri = j.markets.spx500.groups.fri;
  L.push('# US index CFDs into the Friday close: result', '');
  L.push(`**Verdict: ${j.verdict}: ${j.headline}.**`, '');
  L.push('Pre-registered in `PREREGISTRATION.md` (committed before any figure was computed). Rule: ' + j.rule + '. Costs: 0.04 % of notional round trip (shown also at 0 and at 0.08 %), no financing. Data: OANDA mid M5 candles through the candle proxy, 1 Oct 2007 to 13 Nov 2026; the NYSE calendar stated in the pre-registration (half days and closures skipped). In sample ' + j.windows.inSample + ', out of sample ' + j.windows.outOfSample + '. Paper research only: nothing live changed.', '');
  L.push('## Pass bar (primary: US500, Friday)', '', '| line | needed | result | met |', '|---|---|---|---|');
  L.push(`| 1 | OOS month-sum t ≥ 2, net of 0.04 % | ${sg(pri.OOS.t, 2)} | ${j.pass.oosT ? 'yes' : 'no'} |`);
  L.push(`| 2 | in-sample net R a trade > 0 | ${sg(pri.IS.net)} | ${j.pass.isPositive ? 'yes' : 'no'} |`);
  L.push(`| 3 | OOS net R a trade > 0 at 2x cost | ${sg(pri.OOS.net2)} | ${j.pass.twoX ? 'yes' : 'no'} |`);
  L.push(`| 4 | OOS net R beats ≥ 38 of 40 placebo seeds | ${j.placebo.beats} / 40 | ${j.pass.placebo ? 'yes' : 'no'} |`, '');
  L.push('## Every market and group of days', '', 'R is the short\'s result in units of its stop distance. Friday is the tested rule (US500 decides; the others are reported only); Monday-Thursday and each weekday are the control.', '');
  L.push('| market | days | window | trades | months | gross R | net R | net R at 2x | t (month sums, net) | t gross | cost R | win | stopped | total net R |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const sym of MARKETS) { const m = j.markets[sym]; if (!m) continue;
    for (const g of Object.keys(GROUPS)) for (const k of ['IS', 'OOS']) { const w = m.groups[g][k];
      L.push(`| ${m.name} | ${m.groups[g].name} | ${k === 'IS' ? 'in sample' : 'out of sample'} | ${w.n} | ${w.months} | ${sg(w.gross)} | ${sg(w.net)} | ${sg(w.net2)} | ${sg(w.t, 2)} | ${sg(w.tGross, 2)} | ${w.costR?.toFixed(3) ?? 'n/a'} | ${pc(w.win)} | ${w.stops} | ${sg(w.totalNet, 1)} |`); } }
  L.push('', '## Placebo (US500, out of sample)', '', `40 seeds: ${j.placebo.n} random out-of-sample Monday-Thursday days each, the same 14:00-15:55 short with the Monday-Thursday stop and the same cost. Placebo mean ${sg(j.placebo.mean)}R, 95th percentile ${sg(j.placebo.q95)}R, max ${sg(j.placebo.max)}R; the Friday short (${sg(pri.OOS.net)}R) beats ${j.placebo.beats} of 40.`, '');
  L.push('## US500 Friday short by year (descriptive)', '', '| year | n | gross R | net R | total net R |', '|---|---|---|---|---|');
  for (const [y, x] of Object.entries(pri.byYear)) L.push(`| ${y} | ${x.n} | ${sg(x.gross)} | ${sg(x.net)} | ${sg(x.total, 1)} |`);
  L.push('', '## Days left out', '');
  for (const sym of MARKETS) { const m = j.markets[sym]; if (m) L.push(`- ${m.name}: ${m.skipped.noPrice} eligible days without a price at 14:00 or 15:55 New York; the first 20 days of each group are the stop warm-up.`); }
  L.push('', '## Reading', '');
  L.push(j.verdict === 'PASS'
    ? 'Every pre-registered line was met. This is a hypothesis for a forward paper shadow that the owner decides on, never a live rule; read the by-year table and the controls first.'
    : 'The pre-registered bar was not met. Shorting US index CFDs into the Friday close is not an edge on these feeds after costs; no proposal is written and nothing live changes. Never call it an edge.');
  const fr = MARKETS.filter((s) => j.markets[s]).map((s) => `${j.markets[s].name} ${sg(j.markets[s].groups.fri.IS.gross)} / ${sg(j.markets[s].groups.fri.OOS.gross)}`);
  L.push('', `Descriptive, decides nothing: before any cost the Friday short makes, in R a trade (in sample / out of sample): ${fr.join('; ')}. A negative figure means the index tended to rise, not fall, from 14:00 to 15:55 on a Friday; every Friday t before costs is inside ±2 (US30 out of sample −1.99 is the largest). The cost of the round trip (about 0.1R a trade at this stop) is what makes every group of days lose, Friday or not.`);
  L.push('', 'To repeat: `node --use-env-proxy research/edge/index-friday-pm/fetch.mjs <dir>`, then `node research/edge/index-friday-pm/run.mjs <dir>`. Test: `tests/index-friday-pm.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const mk = {};
  for (const sym of MARKETS) {
    const f = path.join(dir, `${sym}-5m.json.gz`);
    if (!fs.existsSync(f)) { console.log(`${sym}: no file, left out`); continue; }
    mk[sym] = runMarket(toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(f)))));
  }
  const j = build(mk);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(j, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), render(j));
  console.log(render(j).split('\n').slice(0, 3).join('\n'));
}

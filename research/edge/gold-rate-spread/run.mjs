// Does the US-German 10-year rate gap lead spot gold? (research/edge/gold-rate-spread; rules fixed in PREREGISTRATION.md)
// Paper research only: a stand-alone cross-asset rule, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-rate-spread/run.mjs fetch <dir>   copy the daily caches out of origin/council-data (no network)
//   node research/edge/gold-rate-spread/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 250, Z = 1, ATR_N = 20, STOP_ATR = 2, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40, GAP_DAYS = 7;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const KEYS = ['xau', 'usb10y', 'de10yb'];
export const SOURCE = '60e9d956cd79c2d9e64ebb8363f608abdd0f6733';   // the council-data commit named in PREREGISTRATION.md
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const T1 = { id: 'T1', n: 20, hold: 10, us: 1, de: 1, what: '20-day US-German 10-year gap move beyond 1 sd: gold the dollar-weakening way (long when US yields fell relative), held 10 candles (primary)' };
export const INFO = [
  { id: 'I1', n: 5, hold: 5, us: 1, de: 1, what: 'T1 with a 5-day gap move, held 5 candles' },
  { id: 'I2', n: 20, hold: 10, us: 1, de: 0, what: 'T1 with the US 10-year bond alone' },
  { id: 'I3', n: 20, hold: 10, us: 0, de: 1, what: 'T1 with the Bund alone (Bund up = short gold)' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
const weekOf = (t) => { const d = dayOf(t), wd = (new Date(d * 1000).getUTCDay() + 6) % 7; return d - wd * DAY; };

// gap move S on common days: us * ln(U_t/U_{t-n}) - de * ln(D_t/D_{t-n}); z against the LOOK earlier S values (t excluded)
export function gapZ(usb, deb, spec, look = LOOK) {
  const dc = new Map(deb.map((b) => [dayOf(b.time), b.close]));
  const com = usb.map((b) => ({ t: dayOf(b.time), u: b.close, d: dc.get(dayOf(b.time)) })).filter((p) => p.d != null);
  const out = []; let start = 0; const S = [];
  for (let i = 0; i < com.length; i++) {
    if (i > 0 && com[i].t - com[i - 1].t > GAP_DAYS * DAY) { start = i; S.length = 0; }
    if (i - start < spec.n) { S.push(null); continue; }
    const p = com[i], q = com[i - spec.n];
    const s = spec.us * Math.log(p.u / q.u) - spec.de * Math.log(p.d / q.d);
    const hist = S.slice(-look).filter((x) => x != null);
    if (hist.length >= look) {
      const m = hist.reduce((a, b) => a + b, 0) / look, sd = Math.sqrt(hist.reduce((a, b) => a + (b - m) ** 2, 0) / (look - 1));
      if (sd > 0) out.push({ t: p.t, s, z: (s - m) / sd });
    }
    S.push(s);
  }
  return out;
}
// signal days: gold's last candle of each Monday week, when that day has a z
export function signalDays(gold, zs) {
  const zm = new Map(zs.map((r) => [r.t, r])), last = new Map();
  for (const g of gold) last.set(weekOf(g.time), dayOf(g.time));
  return [...last.values()].filter((t) => zm.has(t)).map((t) => ({ t, z: zm.get(t).z, s: zm.get(t).z > Z ? 1 : zm.get(t).z < -Z ? -1 : 0 }));
}

export function entryIndex(gold, t) {
  let lo = 0, hi = gold.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dayOf(gold[m].time) > t) hi = m; else lo = m + 1; }
  return lo < gold.length ? lo : -1;
}
export function atrBefore(gold, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = gold[i], pc = gold[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

export function tradeAt(gold, j, side, hold, costX = 1) {
  const atr = atrBefore(gold, j);
  if (!(atr > 0) || j + hold - 1 >= gold.length) return null;
  const risk = STOP_ATR * atr, e = gold[j].open, stop = e - side * risk;
  const through = (px) => (side > 0 ? px <= stop : px >= stop);
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = gold[k];
    if (k > j && through(b.open)) { exit = b.open; kind = 'gap'; break; }
    if (through(side > 0 ? b.low : b.high)) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = gold[k].close; }
  const t = dayOf(gold[j].time), c = exitStamp(dayOf(gold[k].time)), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN.xau.long * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
export function simulate(days, gold, hold, { costX = 1 } = {}) {
  const out = []; let lastK = -1;
  for (const d of days) {
    if (!d.s) continue;
    const j = entryIndex(gold, d.t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(gold, j, d.s, hold, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthly(rows, from, to, key) {
  const a = mk(from), b = mk(Math.max(to, ...rows.map((r) => r.c))), m = new Array(b - a + 1).fill(0);
  for (const r of rows) m[mk(r.c) - a] += r[key];
  return { ...stat(m), months: m.length };
}
export function normP(t) {
  if (t == null) return 1;
  const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return t >= 0 ? (1 - erf) / 2 : (1 + erf) / 2;
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function placeboDays(eligible, sides, r) {
  const pick = shuffle(eligible, r).slice(0, sides.length).sort((x, y) => x.t - y.t), sd = shuffle(sides, r);
  return pick.map((d, i) => ({ t: d.t, s: sd[i] }));
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function summarize(trades, from, to, x2) {
  const s = stat(trades.map((x) => x.net)), g = stat(trades.map((x) => x.gross));
  const mo = trades.length ? monthly(trades, from, to, 'net') : { t: null, months: 0 }, mg = trades.length ? monthly(trades, from, to, 'gross') : { t: null };
  const absG = trades.length ? trades.reduce((a, x) => a + Math.abs(x.gross), 0) / trades.length : null, mc = s.n ? stat(trades.map((x) => x.cost)).mean : null;
  return {
    n: s.n, long: trades.filter((x) => x.side > 0).length, short: trades.filter((x) => x.side < 0).length,
    win: s.n ? r3(trades.filter((x) => x.net > 0).length / s.n) : null, stops: trades.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(s.mean), netExact: s.mean == null ? null : +s.mean.toPrecision(4), total: r2(s.sum),
    x2: x2 ? r3(stat(x2.map((x) => x.net)).mean) : undefined,
    tMonth: r2(mo.t), tMonthGross: r2(mg.t), months: mo.months, tTrade: r2(s.t),
    meanCost: r3(mc), costShare: mc != null && absG > 0 ? r3(mc / absG) : null, medianStop: s.n ? r2(median(trades.map((x) => x.risk))) : null,
  };
}
// excess of one leg's trades over a baseline mean, month t of the excess
export function excess(trades, base, from, to) {
  const mu = stat(base.map((x) => x.net)).mean;
  if (mu == null || !trades.length) return { n: trades.length, baseN: base.length, baseNet: r3(mu), net: null, excess: null, tMonth: null, x2: null };
  const rows = trades.map((x) => ({ c: x.c, ex: x.net - mu })), mo = monthly(rows, from, to, 'ex'), s = stat(trades.map((x) => x.net));
  return { n: trades.length, baseN: base.length, baseNet: r3(mu), net: r3(s.mean), excess: r3(s.mean - mu), excessExact: +(s.mean - mu).toPrecision(4), tMonth: r2(mo.t), months: mo.months };
}

export function windows(gold, rows, end = OOS_END) {
  return { is: [Math.max(IS_FROM, rows.length ? rows[0].t : IS_FROM), SPLIT - 1], oos: [SPLIT, Math.min(end, dayOf(gold[gold.length - 1].time) + DAY - 1)] };
}

export function runSpec(spec, gold, usb, deb, { seeds = SEEDS, end = OOS_END, legs = false } = {}) {
  const first = gold[ATR_N + 1] ? dayOf(gold[ATR_N + 1].time) : Infinity;
  const rows = signalDays(gold, gapZ(usb, deb, spec)).filter((r) => r.t >= first);
  const out = { id: spec.id, n: spec.n, hold: spec.hold, what: spec.what };
  for (const [w, [from, to]] of Object.entries(windows(gold, rows, end))) {
    const days = rows.filter((d) => d.t >= from && d.t <= to), sig = days.filter((d) => d.s);
    const tr = simulate(sig, gold, spec.hold), tr2 = simulate(sig, gold, spec.hold, { costX: 2 });
    out[w] = { from: iso(from), to: iso(to), eligible: days.length, signals: sig.length, ...summarize(tr, from, to, tr2) };
    if (legs) {
      const x2 = (s) => tr2.filter((x) => x.side === s);
      const bL = simulate(days.map((d) => ({ t: d.t, s: 1 })), gold, spec.hold), bS = simulate(days.map((d) => ({ t: d.t, s: -1 })), gold, spec.hold);
      const bL2 = simulate(days.map((d) => ({ t: d.t, s: 1 })), gold, spec.hold, { costX: 2 }), bS2 = simulate(days.map((d) => ({ t: d.t, s: -1 })), gold, spec.hold, { costX: 2 });
      out[w].legs = {
        long: { ...excess(tr.filter((x) => x.side > 0), bL, from, to), x2Excess: r3((stat(x2(1).map((x) => x.net)).mean ?? NaN) - stat(bL2.map((x) => x.net)).mean) },
        short: { ...excess(tr.filter((x) => x.side < 0), bS, from, to), x2Excess: r3((stat(x2(-1).map((x) => x.net)).mean ?? NaN) - stat(bS2.map((x) => x.net)).mean) },
        baseLong: summarize(bL, from, to), baseShort: summarize(bS, from, to),
      };
    }
    if (w === 'is' || w === 'oos') {
      const by = {};
      for (const x of tr) { const y = new Date(x.t * 1000).getUTCFullYear(); (by[y] ||= []).push(x.net); }
      out[w].byYear = Object.fromEntries(Object.entries(by).map(([y, a]) => [y, { n: a.length, net: r2(a.reduce((p, q) => p + q, 0)) }]));
    }
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), side: x.side, e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, nights: x.nights, gross: r3(x.gross), net: r3(x.net) }));
      if (seeds) {
        const sides = sig.map((d) => d.s), ts = [];
        for (let s = 1; s <= seeds; s++) ts.push(summarize(simulate(placeboDays(days, sides, rng(s)), gold, spec.hold), from, to).tMonth);
        const real = out.oos.tMonth, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: sides.length, t: ts, atLeastReal: ts.filter((t) => t != null && real != null && t >= real).length, median: r2(srt[Math.floor(srt.length / 2)]), p95: r2(srt[Math.ceil(0.95 * srt.length) - 1]) };
      }
    }
  }
  return out;
}

export function verdictOf(t1, legT) {
  const c1 = t1.oos.tMonth != null && t1.oos.tMonth >= 2 && t1.holm < 0.05, c2 = t1.is.netExact > 0, c3 = t1.oos.x2 > 0, c4 = t1.oos.n >= 30;
  const c5 = !!t1.placebo && t1.placebo.atLeastReal <= 2;
  t1.checks = { oosTAndHolm: c1, isPositive: c2, x2Positive: c3, n30: c4, placebo: c5 }; t1.pass = c1 && c2 && c3 && c4 && c5;
  for (const L of legT) {
    const k1 = L.oos.tMonth != null && L.oos.tMonth >= 2 && L.holm < 0.05, k2 = L.is.excessExact > 0, k3 = L.oos.x2Excess > 0, k4 = L.oos.n >= 30;
    L.checks = { oosTAndHolm: k1, isPositive: k2, x2Positive: k3, n30: k4 }; L.pass = k1 && k2 && k3 && k4;
  }
  if (t1.pass) return 'PASS';
  return legT.some((l) => l.pass) ? 'PARTIAL' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), usb = load(dir, 'usb10y'), deb = load(dir, 'de10yb');
  const t1 = runSpec(T1, gold, usb, deb, { legs: true });
  const leg = (id, side, what) => ({ id, what, is: t1.is.legs[side], oos: t1.oos.legs[side] });
  const legT = [leg('T2', 'long', 'T1 long trades against the unconditional long baseline (excess net R)'), leg('T3', 'short', 'T1 short trades against the unconditional short baseline (excess net R)')];
  const all = [t1, ...legT], ps = all.map((t) => normP(t.oos.tMonth)), hs = holm(ps);
  all.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(t1, legT);
  const info = INFO.map((s) => { const r = runSpec(s, gold, usb, deb, { seeds: 0 }); delete r.trades; return r; });
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), usb10y: span(usb), de10yb: span(deb) }, tests: all, info, verdict };
}

const main = async () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const sha = SOURCE;
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `${sha}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'SOURCE'), sha + '\n');
    console.log('council-data', sha, '->', dir);
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'The US-German 10-year rate gap as a lead for spot gold', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { signal: `S = ln(US10y bond / 20 common days ago) - ln(Bund / 20 days ago); z vs the ${LOOK} earlier S; Friday z > ${Z} long gold, < -${Z} short`, entry: 'next gold open (Sunday reopen)', exit: 'close of the 10th gold candle', stop: `${STOP_ATR} x ${ATR_N}-day ATR`, costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on longs`, oneAtATime: true },
      fin: FIN.xau.long, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of [...r.tests, ...r.info]) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, JSON.stringify({ ...x, legs: undefined, byYear: undefined })); }
      if (t.p != null) console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), t.placebo ? JSON.stringify({ ...t.placebo, t: undefined }) : '');
    }
    console.log('T1 years', JSON.stringify(r.tests[0].is.byYear), JSON.stringify(r.tests[0].oos.byYear));
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

// Spot silver after a 10-year bond shock that silver (or gold) shrugged off (research/edge/silver-rates-shrug; rules fixed in
// PREREGISTRATION.md). A replication on silver of research/edge/gold-rates-shrug's closest test, the same rule otherwise.
// Paper research only: a stand-alone cross-asset rule, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/silver-rates-shrug/run.mjs fetch <dir>   copy the three daily caches out of origin/council-data (no network)
//   node research/edge/silver-rates-shrug/run.mjs count <dir>   event counts per window only (what the pre-registration looked at)
//   node research/edge/silver-rates-shrug/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 250, Z = 1.0, GZ = 0.5, ATR_N = 20, STOP_ATR = 2, SPREAD = 0.03, SLIP = SPREAD / 2, SEEDS = 40;
export const RT = SPREAD + 2 * SLIP;   // $0.06 a round trip on silver
export const FIN_XAG_LONG = 0;         // no silver financing rate exists in council/fills.mjs FIN: none charged (stated in RESULT.md)
export const KEYS = ['xag', 'xau', 'usb10y'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', flat: 'sz', side: 1, hold: 1, what: 'bond price z <= -1 (yields up hard) and silver |z| < 0.5 the same day: buy silver at the next open, 1 candle (primary)' },
  { id: 'T2', flat: 'gz', side: 1, hold: 1, what: 'bond price z <= -1 and GOLD |z| < 0.5 the same day: buy silver at the next open, 1 candle' },
  { id: 'T3', flat: 'sz', side: 1, hold: 5, what: 'T1 event: buy silver at the next open, 5 candles' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

// silver, gold and bond on their common UTC days; each day's return / sd of that market's LOOK previous common-day returns
const sdOf = (w) => { const m = w.reduce((a, b) => a + b, 0) / w.length; return Math.sqrt(w.reduce((a, x) => a + (x - m) ** 2, 0) / (w.length - 1)); };
export function shockRows(silver, gold, bond, look = LOOK) {
  const bd = new Map(bond.map((b) => [dayOf(b.time), b])), gd = new Map(gold.map((b) => [dayOf(b.time), b]));
  const p = silver.filter((s) => bd.has(dayOf(s.time)) && gd.has(dayOf(s.time)))
    .map((s) => ({ t: dayOf(s.time), s: s.close, g: gd.get(dayOf(s.time)).close, b: bd.get(dayOf(s.time)).close }));
  const r = [];
  for (let i = 1; i < p.length; i++) r.push({ t: p[i].t, r: p[i].b / p[i - 1].b - 1, sr: p[i].s / p[i - 1].s - 1, gr: p[i].g / p[i - 1].g - 1 });
  const out = [];
  for (let i = look; i < r.length; i++) {
    const w = r.slice(i - look, i), sd = sdOf(w.map((x) => x.r)), ssd = sdOf(w.map((x) => x.sr)), gsd = sdOf(w.map((x) => x.gr));
    if (sd > 0 && ssd > 0 && gsd > 0) out.push({ t: r[i].t, r: r[i].r, z: r[i].r / sd, sr: r[i].sr, sz: r[i].sr / ssd, gr: r[i].gr, gz: r[i].gr / gsd });
  }
  return out;
}
// the event: yields up hard (bond price z <= -Z) and the named metal (sz = silver, gz = gold) barely moved the same day
export const isShock = (row, flat = 'sz', z = Z, gz = GZ) => row.z <= -z && Math.abs(row[flat]) < gz;
// control: the bond's z shuffled among the days of each calendar year (same yearly drift and spread of moves, no day alignment)
export function shuffleBond(rows, r) {
  const by = {}; rows.forEach((x, i) => (by[yearOf(x.t)] ||= []).push(i));
  const out = rows.map((x) => ({ ...x }));
  for (const idx of Object.values(by)) {
    const zs = idx.map((i) => rows[i].z);
    for (let k = zs.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [zs[k], zs[j]] = [zs[j], zs[k]]; }
    idx.forEach((i, k) => { out[i].z = zs[k]; });
  }
  return out;
}

// first silver candle whose UTC day is later than t
export function entryIndex(bars, t) {
  let lo = 0, hi = bars.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dayOf(bars[m].time) > t) hi = m; else lo = m + 1; }
  return lo < bars.length ? lo : -1;
}
export function atrBefore(bars, j, n = ATR_N) {
  if (j - n - 1 < 0) return null;
  let s = 0;
  for (let i = j - n; i < j; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
export const exitStamp = (dayT) => dayT + (new Date(dayT * 1000).getUTCDay() === 5 ? 22 * 3600 - 1 : DAY - 1);

export function tradeAt(bars, j, side, hold, costX = 1) {
  const atr = atrBefore(bars, j);
  if (!(atr > 0) || j + hold - 1 >= bars.length) return null;
  const risk = STOP_ATR * atr, e = bars[j].open, stop = e - side * risk;
  const through = (px) => (side > 0 ? px <= stop : px >= stop);
  let exit = null, kind = 'time', k = j;
  for (; k < j + hold; k++) {
    const b = bars[k];
    if (k > j && through(b.open)) { exit = b.open; kind = 'gap'; break; }
    if (through(side > 0 ? b.low : b.high)) { exit = stop; kind = 'stop'; break; }
  }
  if (exit == null) { k = j + hold - 1; exit = bars[k].close; }
  const t = dayOf(bars[j].time), c = exitStamp(dayOf(bars[k].time)), nn = nights(t, c);
  const gross = side * (exit - e) / risk, fin = side > 0 ? nn * FIN_XAG_LONG * e / risk : 0, rt = RT / risk;
  return { t, c, j, k, side, e, stop, risk, exit, kind, nights: nn, gross, fin, cost: rt + fin, net: gross - costX * (rt + fin) };
}
export function simulate(days, bars, side, hold, costX = 1) {
  const out = []; let lastK = -1;
  for (const d of days) {
    const j = entryIndex(bars, d.t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(bars, j, side, hold, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}
export function baseline(bars, side, hold, costX = 1) {
  const acc = {};
  for (let j = 0; j < bars.length; j++) {
    const tr = tradeAt(bars, j, side, hold, costX); if (!tr) continue;
    const y = yearOf(tr.t); (acc[y] ||= { n: 0, s: 0, g: 0 }); acc[y].n++; acc[y].s += tr.net; acc[y].g += tr.gross;
  }
  return Object.fromEntries(Object.entries(acc).map(([y, a]) => [y, { n: a.n, net: a.s / a.n, gross: a.g / a.n }]));
}
export const withExcess = (trades, base) => trades.map((x) => { const b = base[yearOf(x.t)]; return { ...x, ex: x.net - b.net, exG: x.gross - b.gross }; });

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
export function pick(arr, k, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, k).sort((x, y) => x.t - y.t);
}

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);

export function summarize(tr, from, to, tr2) {
  if (!tr.length) return { n: 0 };
  const n = stat(tr.map((x) => x.net)), g = stat(tr.map((x) => x.gross)), e = stat(tr.map((x) => x.ex)), eg = stat(tr.map((x) => x.exG));
  return {
    n: n.n, win: r3(tr.filter((x) => x.net > 0).length / n.n), stops: tr.filter((x) => x.kind !== 'time').length,
    gross: r3(g.mean), net: r3(n.mean), netExact: +n.mean.toPrecision(4), excess: r3(e.mean), excessExact: +e.mean.toPrecision(4), excessGross: r3(eg.mean),
    tMonthNet: r2(monthly(tr, from, to, 'net').t), tMonthGross: r2(monthly(tr, from, to, 'gross').t),
    tMonthExcess: r2(monthly(tr, from, to, 'ex').t), tMonthExcessGross: r2(monthly(tr, from, to, 'exG').t), months: monthly(tr, from, to, 'ex').months,
    meanCost: r3(stat(tr.map((x) => x.cost)).mean), meanRisk: r3(stat(tr.map((x) => x.risk)).mean),
    x2Net: tr2 ? r3(stat(tr2.map((x) => x.net)).mean) : undefined, x2Excess: tr2 ? r3(stat(tr2.map((x) => x.ex)).mean) : undefined,
  };
}

export function windows(rows, bars, end = OOS_END) {
  const lastDay = dayOf(bars[bars.length - 1].time) + DAY - 1, from = Math.max(IS_FROM, rows[0].t), to = Math.min(end, lastDay);
  return { is: [from, SPLIT - 1], oos: [SPLIT, to], all: [from, to] };
}

export function runTest(test, silver, rows, { seeds = SEEDS, end = OOS_END } = {}) {
  const base = baseline(silver, test.side, test.hold), base2 = baseline(silver, test.side, test.hold, 2);
  const out = { id: test.id, flat: test.flat, side: test.side, hold: test.hold, what: test.what };
  for (const [w, [from, to]] of Object.entries(windows(rows, silver, end))) {
    const elig = rows.filter((d) => d.t >= from && d.t <= to), ev = elig.filter((d) => isShock(d, test.flat));
    const tr = withExcess(simulate(ev, silver, test.side, test.hold), base), tr2 = withExcess(simulate(ev, silver, test.side, test.hold, 2), base2);
    out[w] = { from: iso(from), to: iso(to), eligible: elig.length, events: ev.length, sameDaySilverPct: r3(stat(ev.map((d) => d.sr)).mean * 100), ...summarize(tr, from, to, tr2) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), e: r3(x.e), risk: r3(x.risk), exit: r3(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net), ex: r3(x.ex) }));
      if (seeds) {
        const real = out.oos.tMonthExcess, ts = [], cs = [], cn = [];
        for (let s = 1; s <= seeds; s++) {
          const p = withExcess(simulate(pick(elig, ev.length, rng(s)), silver, test.side, test.hold), base);
          ts.push(r2(monthly(p, from, to, 'ex').t));
        }
        for (let s = 1; s <= seeds; s++) {
          const sh = shuffleBond(rows, rng(1000 + s)).filter((d) => d.t >= from && d.t <= to && isShock(d, test.flat));
          const p = withExcess(simulate(sh, silver, test.side, test.hold), base);
          cs.push(r2(monthly(p, from, to, 'ex').t)); cn.push(p.length);
        }
        const band = (a) => { const s = [...a].sort((x, y) => x - y); return { median: r2(s[Math.floor(s.length / 2)]), p5: r2(s[1]), p95: r2(s[38]) }; };
        const below = (a) => a.filter((t) => t != null && real != null && t < real).length;
        out.placebo = { seeds, draws: ev.length, t: ts, below: below(ts), ...band(ts) };
        out.control = { seeds, what: `bond z shuffled among the days of each calendar year; the metal's days and its |z| < ${GZ} filter kept`, t: cs, n: cn, below: below(cs), ...band(cs) };
      }
    }
  }
  out.baseline = Object.fromEntries(Object.entries(base).map(([y, b]) => [y, { n: b.n, net: r3(b.net), gross: r3(b.gross) }]));
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonthExcess != null && t.oos.tMonthExcess >= 2 && t.holm < 0.05, c2 = t.is.excessExact > 0;
    const c3 = t.oos.netExact > 0 && t.oos.x2Net > 0 && t.oos.x2Excess > 0, c4 = t.is.events >= 100 && t.oos.events >= 100, c5 = t.placebo.below >= 38, c6 = t.control.below >= 38;
    t.checks = { oosTAndHolm: c1, isExcessPositive: c2, netAndX2Positive: c3, events100: c4, placebo38: c5, control38: c6 }; t.pass = c1 && c2 && c3 && c4 && c5 && c6;
  }
  return tests.find((t) => t.id === 'T1').pass ? 'PASS' : 'FAIL';
}

export function study(dir) {
  const silver = load(dir, 'xag'), gold = load(dir, 'xau'), bond = load(dir, 'usb10y'), rows = shockRows(silver, gold, bond);
  const tests = TESTS.map((t) => runTest(t, silver, rows));
  const ps = tests.map((t) => normP(t.oos.tMonthExcess)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xag: span(silver), xau: span(gold), usb10y: span(bond), firstZ: iso(rows[0].t) }, tests, verdict };
}

const main = () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const sha = execFileSync('git', ['rev-parse', 'origin/council-data'], { encoding: 'utf8' }).trim();
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `${sha}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'SOURCE'), sha + '\n');
    console.log('council-data', sha, '->', dir);
  } else if (cmd === 'count') {
    const silver = load(dir, 'xag'), rows = shockRows(silver, load(dir, 'xau'), load(dir, 'usb10y'));
    console.log('first z', iso(rows[0].t));
    for (const [w, [from, to]] of Object.entries(windows(rows, silver))) {
      const e = rows.filter((d) => d.t >= from && d.t <= to);
      console.log(w, iso(from), iso(to), 'eligible', e.length, 'silver-flat', e.filter((d) => isShock(d, 'sz')).length, 'gold-flat', e.filter((d) => isShock(d, 'gz')).length);
    }
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Spot silver after a 10-year bond shock it shrugged off (replication of gold-rates-shrug)', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      replicates: 'gold-rates-shrug T3 (OOS excess +0.072R, month t 1.90, Holm p 0.086)',
      rule: { shock: `10-year bond CFD daily return / sd of the ${LOOK} previous common-day returns <= -${Z}, and the named metal's same-day |z| < ${GZ}`, entry: 'next silver open', stop: `${STOP_ATR} x ${ATR_N}-day ATR of silver`, baseline: 'same side and hold entered at every silver candle of the same year (mean)', costs: `$${RT.toFixed(2)} a round trip on silver; no financing (no silver rate in council/fills.mjs FIN)`, oneAtATime: true },
      fin: FIN_XAG_LONG, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos', 'all']) console.log(t.id, w, JSON.stringify(t[w]));
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }), 'control', JSON.stringify({ ...t.control, t: undefined, n: undefined }));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | count <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

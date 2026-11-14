// Spot gold after a 10-year bond shock that gold shrugged off (research/edge/gold-rates-shrug; rules fixed in PREREGISTRATION.md)
// Paper research only: a stand-alone cross-asset rule, never a gate / entry / exit / size of the live gold book (decision 44).
//   node research/edge/gold-rates-shrug/run.mjs fetch <dir>   copy the two daily caches out of origin/council-data (no network)
//   node research/edge/gold-rates-shrug/run.mjs full <dir>    run the study, write result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DAY = 86400;
export const LOOK = 250, Z = 1.0, GZ = 0.5, ATR_N = 20, STOP_ATR = 2, SPREAD = 0.30, SLIP = SPREAD / 2, SEEDS = 40;
export const RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const KEYS = ['xau', 'usb10y'];
export const IS_FROM = Date.UTC(2007, 0, 1) / 1000;
export const SPLIT = Date.UTC(2017, 0, 1) / 1000;
export const OOS_END = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000;
export const TESTS = [
  { id: 'T1', shock: -1, side: 1, hold: 5, what: 'bond price z <= -1 (yields up hard) and gold |z| < 0.5 the same day: buy gold at the next open, 5 candles (primary)' },
  { id: 'T2', shock: 1, side: -1, hold: 5, what: 'bond price z >= +1 (yields down hard) and gold |z| < 0.5: sell gold at the next open, 5 candles' },
  { id: 'T3', shock: -1, side: 1, hold: 1, what: 'T1 event: buy gold at the next open, 1 candle' },
];

// ── data ──
export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export const load = (dir, key) => foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, key + '.json'), 'utf8'))));
export const dayOf = (t) => Math.floor(t / DAY) * DAY;
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

// bond z rows on the common UTC days: z of day i uses only the LOOK returns before it
// gold and bond on their common UTC days; each day's return / sd of that market's LOOK previous common-day returns
const sdOf = (w) => { const m = w.reduce((a, b) => a + b, 0) / w.length; return Math.sqrt(w.reduce((a, x) => a + (x - m) ** 2, 0) / (w.length - 1)); };
export function shockRows(gold, bond, look = LOOK) {
  const bd = new Map(bond.map((b) => [dayOf(b.time), b]));
  const pairs = gold.filter((g) => bd.has(dayOf(g.time))).map((g) => ({ t: dayOf(g.time), g: g.close, b: bd.get(dayOf(g.time)).close }));
  const r = [];
  for (let i = 1; i < pairs.length; i++) r.push({ t: pairs[i].t, r: pairs[i].b / pairs[i - 1].b - 1, gr: pairs[i].g / pairs[i - 1].g - 1 });
  const out = [];
  for (let i = look; i < r.length; i++) {
    const w = r.slice(i - look, i), sd = sdOf(w.map((x) => x.r)), gsd = sdOf(w.map((x) => x.gr));
    if (sd > 0 && gsd > 0) out.push({ t: r[i].t, r: r[i].r, z: r[i].r / sd, gr: r[i].gr, gz: r[i].gr / gsd });
  }
  return out;
}
// the event: the bond moved hard one way and gold barely moved the same day
export const isShock = (row, shock, z = Z, gz = GZ) => (shock < 0 ? row.z <= -z : row.z >= z) && Math.abs(row.gz) < gz;
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

// first gold candle whose UTC day is later than t
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
// event trades, one at a time
export function simulate(days, gold, side, hold, costX = 1) {
  const out = []; let lastK = -1;
  for (const d of days) {
    const j = entryIndex(gold, d.t); if (j < 0 || j <= lastK) continue;
    const tr = tradeAt(gold, j, side, hold, costX); if (!tr) continue;
    out.push({ ...tr, sig: d.t }); lastK = tr.k;
  }
  return out;
}
// baseline: the same trade entered at every gold candle; mean net R by entry year
export function baseline(gold, side, hold, costX = 1) {
  const acc = {};
  for (let j = 0; j < gold.length; j++) {
    const tr = tradeAt(gold, j, side, hold, costX); if (!tr) continue;
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
    meanCost: r3(stat(tr.map((x) => x.cost)).mean), meanRisk: r2(stat(tr.map((x) => x.risk)).mean),
    x2Net: tr2 ? r3(stat(tr2.map((x) => x.net)).mean) : undefined, x2Excess: tr2 ? r3(stat(tr2.map((x) => x.ex)).mean) : undefined,
  };
}

export function runTest(test, gold, rows, { seeds = SEEDS, end = OOS_END } = {}) {
  const base = baseline(gold, test.side, test.hold), base2 = baseline(gold, test.side, test.hold, 2);
  const lastDay = dayOf(gold[gold.length - 1].time) + DAY - 1;
  const win = { is: [Math.max(IS_FROM, rows[0].t), SPLIT - 1], oos: [SPLIT, Math.min(end, lastDay)] };
  const out = { id: test.id, shock: test.shock, side: test.side, hold: test.hold, what: test.what };
  for (const [w, [from, to]] of Object.entries(win)) {
    const elig = rows.filter((d) => d.t >= from && d.t <= to), ev = elig.filter((d) => isShock(d, test.shock));
    const tr = withExcess(simulate(ev, gold, test.side, test.hold), base), tr2 = withExcess(simulate(ev, gold, test.side, test.hold, 2), base2);
    // the same-day gold move on event days (descriptive)
    const sameDay = stat(ev.map((d) => { const j = entryIndex(gold, d.t - 1); const b = j >= 0 && dayOf(gold[j].time) === d.t ? gold[j] : null; return b && j > 0 ? b.close / gold[j - 1].close - 1 : null; }).filter((x) => x != null));
    out[w] = { from: iso(from), to: iso(to), eligible: elig.length, events: ev.length, sameDayGoldPct: r3(sameDay.mean * 100), ...summarize(tr, from, to, tr2) };
    if (w === 'oos') {
      out.trades = tr.map((x) => ({ sig: iso(x.sig), entry: iso(x.t), e: r2(x.e), risk: r2(x.risk), exit: r2(x.exit), kind: x.kind, gross: r3(x.gross), net: r3(x.net), ex: r3(x.ex) }));
      if (seeds) {
        const ts = [];
        for (let s = 1; s <= seeds; s++) {
          const p = withExcess(simulate(pick(elig, ev.length, rng(s)), gold, test.side, test.hold), base);
          ts.push(r2(monthly(p, from, to, 'ex').t));
        }
        const real = out.oos.tMonthExcess, srt = [...ts].sort((a, b) => a - b);
        out.placebo = { seeds, draws: ev.length, t: ts, atLeastReal: ts.filter((t) => t != null && real != null && t >= real).length, below: ts.filter((t) => t != null && real != null && t < real).length, median: r2(srt[Math.floor(srt.length / 2)]), p5: r2(srt[1]), p95: r2(srt[38]) };
        // control: shuffle the bond's z within each calendar year, keep gold's own day (and its |z| < GZ filter) real
        const cs = [], cn = [];
        for (let s = 1; s <= seeds; s++) {
          const sh = shuffleBond(rows, rng(1000 + s)).filter((d) => d.t >= from && d.t <= to && isShock(d, test.shock));
          const p = withExcess(simulate(sh, gold, test.side, test.hold), base);
          cs.push(r2(monthly(p, from, to, 'ex').t)); cn.push(p.length);
        }
        const csr = [...cs].sort((a, b) => a - b);
        out.control = { seeds, what: 'bond z shuffled among the days of each calendar year; gold days and the gold |z| < 0.5 filter kept', t: cs, n: cn, atLeastReal: cs.filter((t) => t != null && real != null && t >= real).length, below: cs.filter((t) => t != null && real != null && t < real).length, median: r2(csr[Math.floor(csr.length / 2)]), p5: r2(csr[1]), p95: r2(csr[38]) };
      }
    }
  }
  out.baseline = Object.fromEntries(Object.entries(base).map(([y, b]) => [y, { n: b.n, net: r3(b.net), gross: r3(b.gross) }]));
  return out;
}

export function verdictOf(tests) {
  for (const t of tests) {
    const c1 = t.oos.tMonthExcess != null && t.oos.tMonthExcess >= 2 && t.holm < 0.05, c2 = t.is.excessExact > 0;
    const c3 = t.oos.x2Net > 0 && t.oos.x2Excess > 0, c4 = t.is.events >= 100 && t.oos.events >= 100, c5 = t.placebo.below >= 38, c6 = t.control.below >= 38;
    t.checks = { oosTAndHolm: c1, isExcessPositive: c2, x2Positive: c3, events100: c4, placebo38: c5, control38: c6 }; t.pass = c1 && c2 && c3 && c4 && c5 && c6;
  }
  return tests.find((t) => t.id === 'T1').pass ? 'PASS' : 'FAIL';
}

export function study(dir) {
  const gold = load(dir, 'xau'), bond = load(dir, 'usb10y'), rows = shockRows(gold, bond);
  const tests = TESTS.map((t) => runTest(t, gold, rows));
  const ps = tests.map((t) => normP(t.oos.tMonthExcess)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); });
  const verdict = verdictOf(tests);
  const span = (b) => ({ first: iso(b[0].time), last: iso(b[b.length - 1].time), days: b.length });
  return { data: { xau: span(gold), usb10y: span(bond), firstZ: iso(rows[0].t) }, tests, verdict };
}

const main = () => {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const sha = execFileSync('git', ['rev-parse', 'origin/council-data'], { encoding: 'utf8' }).trim();
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `${sha}:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'SOURCE'), sha + '\n');
    console.log('council-data', sha, '->', dir);
  } else if (cmd === 'full') {
    const r = study(dir), src = fs.existsSync(path.join(dir, 'SOURCE')) ? fs.readFileSync(path.join(dir, 'SOURCE'), 'utf8').trim() : null;
    const out = { title: 'Spot gold after a 10-year bond shock it shrugged off', built: new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: src,
      rule: { shock: `10-year bond CFD daily return / sd of the ${LOOK} previous common-day returns, |z| >= ${Z}, and gold's same-day |z| < ${GZ}`, entry: 'next gold open', stop: `${STOP_ATR} x ${ATR_N}-day ATR`, baseline: 'same side and hold entered at every gold candle of the same year (mean)', costs: `$${RT.toFixed(2)} a round trip + nights() x FIN.xau.long on buys`, oneAtATime: true },
      fin: FIN.xau.long, split: '2017-01-01', oosEnd: '2026-10-31', ...r };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    for (const t of r.tests) {
      for (const w of ['is', 'oos']) { const x = t[w]; console.log(t.id, w, JSON.stringify(x)); }
      console.log(t.id, 'p', t.p, 'holm', t.holm, 'pass', t.pass, JSON.stringify(t.checks), 'placebo', JSON.stringify({ ...t.placebo, t: undefined }), 'control', JSON.stringify({ ...t.control, t: undefined, n: undefined }));
    }
    console.log('VERDICT', r.verdict);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

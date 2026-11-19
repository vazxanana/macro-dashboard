// Edge research · nr7-breakout (PREREGISTRATION.md, committed first): after a trading day whose range is the narrowest of the
// last seven, a buy stop at its high and a sell stop at its low for the next day; stop = the other side; exit at the close of
// the day after the entry (A) or a 2R target before it (B). Gold, NAS100, SPX500, EUR/USD, GBP/USD, USD/JPY, net of spread and
// financing, 2016 to now decisive, 2008-15 replication, 40-seed random-day placebo. A stand-alone rule: not the gold book.
//   node --use-env-proxy run.mjs fetch <dir>   daily + DGS2 from origin/council-data (git show), H1 from the candle proxy
//   node run.mjs full <dir>                    result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, HOUR = 3600, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null), r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

// cost = round-trip spread in price units; fin = financing kind (PREREGISTRATION.md "Costs")
export const MARKETS = {
  xau: { name: 'Gold', cost: 0.30, fin: 'gold' },
  nas100: { name: 'Nasdaq 100', cost: 3, fin: 'index' },
  spx500: { name: 'S&P 500', cost: 1, fin: 'index' },
  eurusd: { name: 'EUR/USD', cost: 0.0001, fin: 'fx' },
  gbpusd: { name: 'GBP/USD', cost: 0.0001, fin: 'fx' },
  usdjpy: { name: 'USD/JPY', cost: 0.01, fin: 'fx' },
};
export const P = {
  LOOK: 7, TARGET: 2, FIN_FX: 0.00004, IDX_SPREAD: 0.025, SEEDS: 40,
  REP: ['2008-01-01', '2016-01-01'], DEC: ['2016-01-01', '2100-01-01'], H1_FROM: '2007-12-01',
};

// ── trading days and NR7 ──
export const toBars = (rows) => rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }));
export const tradingDays = (rows) => foldWeekend(toBars(rows));
// indices i whose range is > 0 and strictly smaller than each of the LOOK-1 ranges before it
export function nr7(days, look = P.LOOK) {
  const out = [];
  for (let i = look - 1; i < days.length; i++) {
    const r = days[i].high - days[i].low;
    if (!(r > 0)) continue;
    let ok = true;
    for (let j = i - look + 1; j < i; j++) if (!(r < days[j].high - days[j].low)) { ok = false; break; }
    if (ok) out.push(i);
  }
  return out;
}

// H1 candles of trading day k: from the end of day k-1 to the end of day k (a Monday holds the Sunday reopen hours)
export function hoursOf(H, days, k) {
  const a = k > 0 ? days[k - 1].time + DAY : days[k].time, b = days[k].time + DAY;
  let lo = 0, hi = H.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (H[m].time < a) lo = m + 1; else hi = m; }
  const out = [];
  for (let j = lo; j < H.length && H[j].time < b; j++) out.push(H[j]);
  return out;
}

// ── one trade: orders from day i's high / low for day i+1, exit at day i+2's close (or stop / target) ──
// Returns null when no order filled, else { side, fill, stop, r0, R (gross), t, c, exitDay, why, both?, daily? }.
export function trade(H, days, i, { target = 0 } = {}) {
  const E = i + 1, F = i + 2;
  if (F >= days.length) return null;
  const hi = days[i].high, lo = days[i].low, rng = hi - lo;
  if (!(rng > 0)) return null;
  let pos = null;
  const lossBoth = (t) => ({ side: 0, fill: hi, stop: lo, r0: rng, R: -1, t, c: t + HOUR, exitDay: E, why: 'both', both: true });
  // manage an open position on one candle (H1, or a whole day as fallback); returns the closed trade or null
  const manage = (b, k, inEntry) => {
    const s = pos.side, stopHit = s > 0 ? b.low <= pos.stop : b.high >= pos.stop;
    const tgt = target ? pos.fill + s * target * pos.r0 : null, tgtHit = tgt != null && (s > 0 ? b.high >= tgt : b.low <= tgt);
    if (stopHit) {
      const px = !inEntry && (s > 0 ? b.open < pos.stop : b.open > pos.stop) ? b.open : pos.stop;
      return done(px, b.time + (b.span || HOUR), k, px === pos.stop ? 'stop' : 'gap');
    }
    if (tgtHit) return done(tgt, b.time + (b.span || HOUR), k, 'target');
    return null;
  };
  const done = (px, c, k, why) => ({ side: pos.side, fill: pos.fill, stop: pos.stop, r0: pos.r0, R: pos.side * (px - pos.fill) / pos.r0, t: pos.t, c, exitDay: k, why, daily: pos.daily || undefined });
  // day E: the entry
  let hE = hoursOf(H, days, E), daily = false;
  if (!hE.length) { daily = true; hE = [{ ...days[E], span: DAY }]; }
  let start = -1;
  for (let j = 0; j < hE.length; j++) {
    const b = hE[j], up = b.high >= hi, dn = b.low <= lo;
    if (up && dn) return lossBoth(b.time);
    if (!up && !dn) continue;
    const s = up ? 1 : -1, lvl = up ? hi : lo, fill = s > 0 ? Math.max(lvl, b.open) : Math.min(lvl, b.open);
    pos = { side: s, fill, stop: s > 0 ? lo : hi, r0: Math.abs(fill - (s > 0 ? lo : hi)), t: b.time, daily };
    const x = manage(b, E, true); if (x) return x;
    start = j + 1; break;
  }
  if (!pos) return null;
  for (let j = start; j < hE.length; j++) { const x = manage(hE[j], E, false); if (x) return x; }
  // day F: stop / target, then the close
  let hF = hoursOf(H, days, F);
  if (!hF.length) { pos.daily = true; hF = [{ ...days[F], span: DAY }]; }
  for (const b of hF) { const x = manage(b, F, false); if (x) return x; }
  return done(days[F].close, days[F].time + DAY, F, 'time');
}

// ── costs in R ──
export function rateAt(dgs, t) {          // DGS2 in % on or before t (dgs ascending [[iso, value]])
  let v = null; const d = new Date(t * 1000).toISOString().slice(0, 10);
  for (const [k, x] of dgs) { if (k <= d) v = x; else break; }
  return v;
}
export function costs(tr, mk, dgs, { mult = 1 } = {}) {
  const m = MARKETS[mk], spread = mult * m.cost / tr.r0;
  if (tr.both) return { spread, fin: 0 };
  const nn = nights(tr.t, tr.c);
  let rate = 0;
  if (m.fin === 'gold') rate = tr.side > 0 ? FIN.xau.long : 0;
  else if (m.fin === 'fx') rate = P.FIN_FX;
  else { const y = (rateAt(dgs, tr.t) ?? 0) / 100; rate = tr.side > 0 ? (y + P.IDX_SPREAD) / 365 : Math.max(0, P.IDX_SPREAD - y) / 365; }
  return { spread, fin: nn * rate * tr.fill / tr.r0, nights: nn };
}
export const netOf = (tr, mk, dgs, o) => { const c = costs(tr, mk, dgs, o); return tr.R - c.spread - c.fin; };

// ── the real stream of one market: one position at a time ──
export function stream(H, days, { target = 0 } = {}) {
  const out = []; let busyTo = -1;
  for (const i of nr7(days)) {
    if (i + 2 >= days.length) continue;
    if (busyTo > i) { out.push({ i, skipped: true }); continue; }
    const tr = trade(H, days, i, { target });
    out.push({ i, tr });
    if (tr) busyTo = tr.exitDay;
  }
  return out;
}

// ── statistics ──
export function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export const pOne = (t) => (Number.isFinite(t) ? 0.5 * erfc(t / Math.SQRT2) : 1);
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// t on calendar-month sums of net R by exit month, every month from..to counted (0 where none)
export function monthT(rows, from, to) {
  const a = ym(from), b = ym(to), s = new Array(b - a + 1).fill(0);
  for (const r of rows) { const k = ym(r.c) - a; if (k >= 0 && k < s.length) s[k] += r.net; }
  const n = s.length, mu = s.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(s.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mu / sd * Math.sqrt(n) : null };
}
export function summary(rows, from, to) {
  const n = rows.length, mean = (k) => (n ? rows.reduce((a, r) => a + r[k], 0) / n : null);
  const m = n ? monthT(rows, from, to) : { months: 0, t: null };
  return { n, gross: r3(mean('R')), net: r3(mean('net')), net2: r3(mean('net2')), totalNet: r2(rows.reduce((a, r) => a + r.net, 0)), win: n ? r3(rows.filter((r) => r.net > 0).length / n) : null, months: m.months, t: r2(m.t), p: n ? +pOne(m.t).toFixed(4) : null, both: rows.filter((r) => r.both).length, daily: rows.filter((r) => r.daily).length };
}
export function holm(ps, alpha = 0.05) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), ok = new Array(ps.length).fill(false);
  for (let k = 0; k < idx.length; k++) { if (idx[k][0] <= alpha / (idx.length - k)) ok[idx[k][1]] = true; else break; }
  return ok;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); const k = (s.length - 1) * p, lo = Math.floor(k); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (k - lo); };

// ── fetch ──
async function fetchH1(sym, from, to) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', m = new Map(), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let a = from; a < to;) {
    const b = Math.min(to, a + 4999 * HOUR); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} 1h ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  return [...m.values()].sort((p, q2) => p[0] - q2[0]);
}
async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const show = (p) => execFileSync('git', ['show', `origin/council-data:${p}`], { cwd: HERE, maxBuffer: 1 << 28 }).toString();
  const cache = JSON.parse(show('macro/cache.json'));
  fs.writeFileSync(path.join(dir, 'dgs2.json'), JSON.stringify(cache.score.fred.DGS2));
  for (const k of Object.keys(MARKETS)) {
    const d = JSON.parse(show(`research/daily/${k}.json`));
    fs.writeFileSync(path.join(dir, `${k}-1d.json`), JSON.stringify(d.rows));
    const f = path.join(dir, `${k}-1h.json.gz`);
    if (fs.existsSync(f)) { console.log(`${k} 1h: exists`); continue; }
    const end = d.rows.at(-1)[0] + 2 * DAY, bars = await fetchH1(k, T(P.H1_FROM), end);
    fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
    console.log(`${k}: ${d.rows.length} days, ${bars.length} H1 ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
  }
}

// ── the study ──
export function load(dir) {
  const dgs = JSON.parse(fs.readFileSync(path.join(dir, 'dgs2.json')));
  const M = {};
  for (const k of Object.keys(MARKETS)) {
    const days = tradingDays(JSON.parse(fs.readFileSync(path.join(dir, `${k}-1d.json`))).filter((r) => r[0] >= T('2007-06-01')));
    const H = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-1h.json.gz`)))));
    M[k] = { days, H };
  }
  return { dgs, M };
}
export const isHoliday = (t) => { const d = new Date(t * 1000).toISOString().slice(5, 10); return d === '12-25' || d === '01-01'; };
const inWin = (days, i, [a, b]) => { const e = days[i + 1].time; return e >= T(a) && e < T(b); };

export function study({ dgs, M }) {
  const lastT = Math.max(...Object.values(M).map((x) => x.days.at(-1).time)) + DAY;
  const win = { replication: P.REP, decisive: P.DEC };
  const winEnd = (w) => Math.min(T(w[1]), lastT) - 1;
  const variants = { A: { target: 0, label: 'exit at the close of the day after entry' }, B: { target: P.TARGET, label: '2R target, else that close' } };
  const out = { variants: {} };
  for (const [vk, v] of Object.entries(variants)) {
    const per = {};
    for (const [k, { days, H }] of Object.entries(M)) {
      const s = stream(H, days, { target: v.target });
      per[k] = s.map((x) => ({ ...x, ...(x.tr ? { row: { ...x.tr, net: netOf(x.tr, k, dgs), net2: netOf(x.tr, k, dgs, { mult: 2 }), mk: k } } : {}) }));
    }
    const res = { label: v.label, windows: {} };
    for (const [wk, w] of Object.entries(win)) {
      const from = T(w[0]), to = winEnd(w), all = [], markets = {};
      for (const [k, s] of Object.entries(per)) {
        const days = M[k].days, sig = s.filter((x) => inWin(days, x.i, w));
        const rows = sig.filter((x) => x.row).map((x) => ({ ...x.row, hol: isHoliday(days[x.i].time) }));
        all.push(...rows);
        markets[k] = { ...summary(rows, from, to), signals: sig.filter((x) => !x.skipped).length, skipped: sig.filter((x) => x.skipped).length };
      }
      const top = all.reduce((a, r) => (!a || r.R > a.R ? r : a), null);
      res.windows[wk] = { from: w[0], to: new Date(to * 1000).toISOString().slice(0, 10), pooled: summary(all, from, to), markets,
        // looked at after the results (labelled post hoc, not evidence): NR7 days dated 25 Dec or 1 Jan are thin holiday candles
        postHocNoHoliday: summary(all.filter((r) => !r.hol), from, to), postHocHolidayTrades: all.filter((r) => r.hol).length,
        largest: top && { market: top.mk, entry: new Date(top.t * 1000).toISOString().slice(0, 10), R: r2(top.R), r0: top.r0 } };
    }
    // placebo on the decisive window
    const seeds = [];
    for (let sd = 1; sd <= P.SEEDS; sd++) {
      const rnd = mulberry32(sd), rows = [];
      for (const [k, { days, H }] of Object.entries(M)) {
        const pool = []; for (let i = 0; i + 2 < days.length; i++) if (inWin(days, i, P.DEC) && days[i].high > days[i].low) pool.push(i);
        const nSig = res.windows.decisive.markets[k].signals;
        for (let c = 0; c < nSig; c++) {
          const i = pool[Math.floor(rnd() * pool.length)], tr = trade(H, days, i, { target: v.target });
          if (tr) rows.push(netOf(tr, k, dgs));
        }
      }
      seeds.push(rows.reduce((a, x) => a + x, 0) / rows.length);
    }
    res.placebo = { seeds: P.SEEDS, p95: r3(q(seeds, 0.95)), median: r3(q(seeds, 0.5)), min: r3(Math.min(...seeds)), max: r3(Math.max(...seeds)), real: res.windows.decisive.pooled.net, means: seeds.map(r3) };
    out.variants[vk] = res;
  }
  const keys = Object.keys(out.variants), hp = holm(keys.map((k) => out.variants[k].windows.decisive.pooled.p));
  keys.forEach((k, j) => {
    const v = out.variants[k], d = v.windows.decisive.pooled, r = v.windows.replication.pooled;
    v.checks = { decisivePositive: d.net > 0, decisiveT2: d.t != null && d.t >= 2, replicationSameSign: r.net > 0, holm: hp[j], placebo: d.net > v.placebo.p95 };
    v.pass = Object.values(v.checks).every(Boolean);
  });
  out.verdict = keys.some((k) => out.variants[k].pass) ? 'PASS' : 'FAIL';
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch' && dir) await fetchAll(dir);
  else if (cmd === 'full' && dir) {
    const r = study(load(dir));
    const res = {
      study: 'nr7-breakout', built: '2026-11-13', verdict: r.verdict,
      rule: 'NR7 (range strictly under each of the six prior folded UTC trading days); buy stop at its high, sell stop at its low for the next day, first traded wins; stop the other side; exit A at the close of the day after entry, B a 2R target else that close; both levels in one H1 candle = a loss',
      markets: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, { name: m.name, spread: m.cost, financing: m.fin }])),
      params: { ...P, finGoldLong: FIN.xau.long },
      src: 'OANDA mid daily candles (council-data research/daily, folded with council/fills.mjs foldWeekend) and H1 candles (candle proxy, kept out of git); DGS2 from council-data macro/cache.json',
      note: 'A stand-alone rule, not a test of the gold book (item 44). Per-market rows are reported; no market passes on its own.',
      variants: r.variants,
    };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    for (const [k, v] of Object.entries(r.variants)) console.log(k, v.pass, JSON.stringify(v.checks), 'dec', JSON.stringify(v.windows.decisive.pooled), 'rep', JSON.stringify(v.windows.replication.pooled), 'placebo p95', v.placebo.p95);
    console.log('verdict', r.verdict);
  } else console.error('usage: node run.mjs fetch|full <dir>');
}

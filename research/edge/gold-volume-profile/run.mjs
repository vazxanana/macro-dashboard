// Does gold trade back to yesterday's volume point of control? (PREREGISTRATION.md, pushed first)
//   node --use-env-proxy research/edge/gold-volume-profile/run.mjs fetch <dir>   OANDA XAU_USD H1 + tick volume via /md/bars
//   node research/edge/gold-volume-profile/run.mjs full <dir>                    runs the two tests, writes result.json
// A new stand-alone intraday rule judged on 2017-26; not a gate, exit, entry or size of the gold book (item 44).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 14, binDiv: 25, binMin: 0.05, va: 0.70, stopAtr: 1.0, stopAlt: 1.5, exitHour: 20, cost: 0.60,
  isFrom: '2007-01-01', isTo: '2016-12-31', oosFrom: '2017-01-01', oosTo: '2026-10-31', half: '2022-01-01', seeds: 40, needBeat: 38 };
export const TESTS = [
  { id: 'T1', name: 'fade to the POC: open above VAH -> sell, below VAL -> buy', fade: true },
  { id: 'T2', name: 'acceptance: open above VAH -> buy, below VAL -> sell', fade: false },
];
const H = 3600;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r3 = (v) => +v.toFixed(3);

// H1 rows [t, o, h, l, c, v] -> trading days { key, bars: [...], open, high, low, close, vol } (Sat / Sun hours go to Monday)
export function toDays(rows) {
  const out = [], idx = new Map();
  for (const r of rows) {
    const d = new Date(r[0] * 1000), wd = d.getUTCDay();
    const add = wd === 6 ? 2 : wd === 0 ? 1 : 0;
    const key = ymd(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add) / 1000);
    let day = idx.get(key);
    if (!day) { day = { key, bars: [] }; idx.set(key, day); out.push(day); }
    day.bars.push(r);
  }
  out.sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const d of out) {
    d.bars.sort((a, b) => a[0] - b[0]);
    d.open = d.bars[0][1]; d.close = d.bars.at(-1)[4];
    d.high = Math.max(...d.bars.map((b) => b[2])); d.low = Math.min(...d.bars.map((b) => b[3]));
    d.vol = d.bars.reduce((s, b) => s + (b[5] || 0), 0);
  }
  return out;
}

// ATR(n) at day i = mean true range of days i-n+1 .. i; null without enough history
export function atrAt(ds, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += Math.max(ds[j].high, ds[j - 1].close) - Math.min(ds[j].low, ds[j - 1].close);
  return s / n;
}

// volume profile of one day: { poc, vah, val } (poc = the middle of the POC bin); null without volume
export function profile(day, atr) {
  if (!(day.vol > 0) || !(atr > 0)) return null;
  const w = Math.max(P.binMin, atr / P.binDiv), lo = day.low, nb = Math.max(1, Math.ceil((day.high - lo) / w + 1e-9));
  const v = new Array(nb).fill(0);
  const bin = (px) => Math.min(nb - 1, Math.max(0, Math.floor((px - lo) / w + 1e-9)));
  for (const b of day.bars) {
    const vol = b[5] || 0; if (!vol) continue;
    const a = bin(b[3]), z = bin(b[2]), k = z - a + 1;
    for (let j = a; j <= z; j++) v[j] += vol / k;
  }
  const tot = v.reduce((s, x) => s + x, 0);
  if (!(tot > 0)) return null;
  const cb = bin(day.close);
  let p = 0;
  for (let j = 1; j < nb; j++) if (v[j] > v[p] + 1e-12 || (Math.abs(v[j] - v[p]) <= 1e-12 && Math.abs(j - cb) < Math.abs(p - cb))) p = j;
  let a = p, z = p, in_ = v[p];
  while (in_ < P.va * tot - 1e-9 && (a > 0 || z < nb - 1)) {
    const up = z < nb - 1 ? v[z + 1] : -1, dn = a > 0 ? v[a - 1] : -1;
    if (up >= dn) { z++; in_ += v[z]; } else { a--; in_ += v[a]; }
  }
  return { poc: lo + (p + 0.5) * w, val: lo + a * w, vah: lo + (z + 1) * w, w, bins: nb };
}

// where day D opens against D-1's value area: +1 above VAH, -1 below VAL, 0 inside
export const openSide = (open, pr) => (open > pr.vah ? 1 : open < pr.val ? -1 : 0);

// one intraday trade on day i: entry at its first H1 open, stop stopAtr x ATR(day i-1), out at the 20:00 UTC candle's close
export function trade(ds, i, side, { costMult = 1, stopAtr = P.stopAtr } = {}) {
  const atr = atrAt(ds, i - 1), day = ds[i];
  if (!atr) return null;
  const bars = day.bars, entry = bars[0][1], risk = stopAtr * atr, stop = entry - side * risk;
  let last = bars.findIndex((b) => ymd(b[0]) === day.key && new Date(b[0] * 1000).getUTCHours() === P.exitHour);
  if (last < 0) last = bars.length - 1;
  let exit = null, why = 'time', xt = null;
  for (let j = 0; j <= last; j++) {
    const b = bars[j];
    if (j > 0 && (side > 0 ? b[1] <= stop : b[1] >= stop)) { exit = b[1]; why = 'gap'; xt = b[0]; break; }
    if (side > 0 ? b[3] <= stop : b[2] >= stop) { exit = stop; why = 'stop'; xt = b[0] + H / 2; break; }
  }
  if (exit == null) { exit = bars[last][4]; xt = bars[last][0] + H; }
  const R = (exit - entry) / risk * side, costR = P.cost * costMult / risk;
  const nn = side > 0 ? nights(bars[0][0], xt) : 0, finR = costMult * nn * FIN.xau.long * entry / risk;
  return { d: day.key, i, side, entry, stop, exit, why, R, costR, nights: nn, finR, net: R - costR - finR };
}

// every day with a profile of the day before: { i, s } with s = where it opened against that value area
export function eligible(ds) {
  const out = [];
  for (let i = P.atrN + 1; i < ds.length; i++) {
    const pr = profile(ds[i - 1], atrAt(ds, i - 1));
    if (!pr) continue;
    out.push({ i, s: openSide(ds[i].open, pr), pr });
  }
  return out;
}

const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), y = 0.3989423 * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x >= 0 ? 1 - y : y; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const sdv = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : 0; };

export function monthSums(T, from, to, key = 'net') {
  const m = {};
  for (let y = +from.slice(0, 4), mo = +from.slice(5, 7); `${y}-${String(mo).padStart(2, '0')}` <= to.slice(0, 7); mo === 12 ? (y++, mo = 1) : mo++) m[`${y}-${String(mo).padStart(2, '0')}`] = 0;
  for (const x of T) { const k = x.d.slice(0, 7); if (k in m) m[k] += x[key]; }
  return Object.values(m);
}
export function monthT(T, from, to, key = 'net') {
  const xs = monthSums(T, from, to, key), s = sdv(xs);
  return s > 0 ? mean(xs) / (s / Math.sqrt(xs.length)) : 0;
}
export function stats(T, from, to, key = 'net') {
  const n = T.length, xs = T.map((x) => x[key]), t = monthT(T, from, to, key);
  return { n, mean: r3(mean(xs)), total: +xs.reduce((a, b) => a + b, 0).toFixed(2), monthT: +t.toFixed(2), p: +(1 - Phi(t)).toFixed(4), win: n ? +(xs.filter((v) => v > 0).length / n).toFixed(3) : 0 };
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let m = 0;
  o.forEach(([p, i], k) => { m = Math.max(m, Math.min(1, p * (ps.length - k))); adj[i] = m; });
  return adj;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const inW = (from, to) => (x) => x.d >= from && x.d <= to;

// the side a test takes on an eligible day (0 = no trade)
export const sideOf = (tst, s) => (s === 0 ? 0 : tst.fade ? -s : s);

export function analyse(rows) {
  const ds = toDays(rows), el = eligible(ds), IS = inW(P.isFrom, P.isTo), OOS = inW(P.oosFrom, P.oosTo);
  const H1 = inW(P.oosFrom, '2021-12-31'), H2 = inW(P.half, P.oosTo);
  const out = { data: { from: ds[0].key, to: ds.at(-1).key, days: ds.length, profiled: el.length }, baseline: {}, tests: {} };
  // baseline: the same trade, each side, on every day with a profile
  const base = { 1: el.map((e) => trade(ds, e.i, 1)).filter(Boolean), '-1': el.map((e) => trade(ds, e.i, -1)).filter(Boolean) };
  const bm = {};
  for (const sd of [1, -1]) {
    const b = base[sd], nm = sd > 0 ? 'buy' : 'sell';
    out.baseline[nm] = { is: stats(b.filter(IS), P.isFrom, P.isTo), oos: stats(b.filter(OOS), P.oosFrom, P.oosTo), oosGross: stats(b.filter(OOS), P.oosFrom, P.oosTo, 'R') };
    bm[sd] = { is: mean(b.filter(IS).map((x) => x.net)), oos: mean(b.filter(OOS).map((x) => x.net)) };
  }
  const elIn = (w) => el.filter((e) => w({ d: ds[e.i].key }));
  out.openShare = Object.fromEntries([['is', IS], ['oos', OOS]].map(([k, w]) => { const xs = elIn(w); return [k, { days: xs.length, above: +(xs.filter((e) => e.s > 0).length / xs.length).toFixed(3), below: +(xs.filter((e) => e.s < 0).length / xs.length).toFixed(3) }]; }));
  const oosEl = elIn(OOS);
  for (const tst of TESTS) {
    const sig = el.filter((e) => e.s !== 0);
    const mk = (opt) => sig.map((e) => trade(ds, e.i, sideOf(tst, e.s), opt)).filter(Boolean);
    const T = mk({}), T2 = mk({ costMult: 2 }), TA = mk({ stopAtr: P.stopAlt });
    for (const x of T) x.ex = x.net - (x.d <= P.isTo ? bm[x.side].is : bm[x.side].oos);
    const o = T.filter(OOS), is = T.filter(IS), years = {};
    for (const x of T) { const y = x.d.slice(0, 4); (years[y] = years[y] || { n: 0, net: 0 }); years[y].n++; years[y].net = +(years[y].net + x.net).toFixed(2); }
    const pl = [], sides = o.map((x) => x.side);
    for (let s = 1; s <= P.seeds; s++) {
      const rnd = mulberry32(s), pick = new Set(), sh = [...sides];
      for (let k = sh.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [sh[k], sh[j]] = [sh[j], sh[k]]; }
      while (pick.size < Math.min(o.length, oosEl.length)) pick.add(Math.floor(rnd() * oosEl.length));
      const pt = [...pick].sort((a, b) => a - b).map((k, n) => trade(ds, oosEl[k].i, sh[n])).filter(Boolean);
      pl.push(r3(mean(pt.map((x) => x.net))));
    }
    const om = mean(o.map((x) => x.net));
    out.tests[tst.id] = {
      name: tst.name, signals: sig.length,
      is: stats(is, P.isFrom, P.isTo), isGross: stats(is, P.isFrom, P.isTo, 'R'), isExcess: stats(is, P.isFrom, P.isTo, 'ex'),
      oos: stats(o, P.oosFrom, P.oosTo), oosGross: stats(o, P.oosFrom, P.oosTo, 'R'), oosExcess: stats(o, P.oosFrom, P.oosTo, 'ex'),
      oos2x: stats(T2.filter(OOS), P.oosFrom, P.oosTo),
      half1: stats(T.filter(H1), P.oosFrom, '2021-12-31'), half2: stats(T.filter(H2), P.half, P.oosTo),
      bySide: Object.fromEntries([['buy', 1], ['sell', -1]].map(([k, sd]) => [k, { is: stats(is.filter((x) => x.side === sd), P.isFrom, P.isTo), oos: stats(o.filter((x) => x.side === sd), P.oosFrom, P.oosTo) }])),
      stop15: { is: stats(TA.filter(IS), P.isFrom, P.isTo), oos: stats(TA.filter(OOS), P.oosFrom, P.oosTo) },
      costs: { costR: r3(o.reduce((s, x) => s + x.costR, 0)), finR: r3(o.reduce((s, x) => s + x.finR, 0)) },
      exits: Object.fromEntries(['stop', 'gap', 'time'].map((w) => [w, o.filter((x) => x.why === w).length])),
      placebo: { draws: pl, beaten: pl.filter((v) => om > v).length, median: [...pl].sort((a, b) => a - b)[P.seeds / 2], max: Math.max(...pl) },
      years,
    };
  }
  const ids = TESTS.map((t) => t.id), adj = holm(ids.map((id) => out.tests[id].oos.p));
  out.checks = {};
  ids.forEach((id, k) => {
    const r = out.tests[id];
    const c = { oosPositive: r.oos.mean > 0, holmP: +adj[k].toFixed(4), tHolm: r.oos.monthT >= 2 && adj[k] <= 0.025, isSameSign: r.is.mean > 0, cost2x: r.oos2x.mean > 0, excess: r.oosExcess.mean > 0 && r.oosExcess.monthT >= 2, placebo: r.placebo.beaten >= P.needBeat };
    c.pass = c.oosPositive && c.tHolm && c.isSameSign && c.cost2x && c.excess && c.placebo;
    out.checks[id] = c;
  });
  out.passed = ids.filter((id) => out.checks[id].pass);
  out.verdict = out.passed.length ? 'PASS' : 'FAIL';
  return out;
}

async function fetchH1(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', FROM = Date.parse('2006-01-01T00:00:00Z') / 1000, END = Date.parse('2026-11-01T00:00:00Z') / 1000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * H);
    let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`xau 1h ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close, +x.volume || 0]);
    a = b; await sleep(150);
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'xau-1h.json.gz'), zlib.gzipSync(JSON.stringify(rows)));
  console.log(`xau 1h: ${rows.length} candles ${ymd(rows[0][0])} -> ${ymd(rows.at(-1)[0])}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchH1(dir);
  else if (cmd === 'full') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-1h.json.gz'))).toString());
    const g = analyse(rows);
    const out = { built: '2026-11-14', params: P, tests: TESTS, costs: '$0.60 a round trip + FIN.xau.long financing on buys (council/fills.mjs); 2x = both doubled', src: 'OANDA XAU_USD mid H1 with tick volume via /md/bars (fetched 14 Nov 2026, kept out of git)', gold: g, verdict: g.verdict };
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
    const brief = {};
    for (const [id, r] of Object.entries(g.tests)) brief[id] = { is: r.is, isG: r.isGross.mean, isEx: r.isExcess, oos: r.oos, oosG: r.oosGross, oosEx: r.oosExcess, x2: r.oos2x.mean, h1: r.half1.mean, h2: r.half2.mean, side: r.bySide, s15: r.stop15, pl: { beaten: r.placebo.beaten, median: r.placebo.median, max: r.placebo.max }, exits: r.exits, costs: r.costs };
    console.log(JSON.stringify({ data: g.data, openShare: g.openShare, baseline: g.baseline, brief, checks: g.checks, verdict: g.verdict }, null, 1));
  } else console.log('usage: run.mjs fetch|full <dir>');
}

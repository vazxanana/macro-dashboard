// research/edge/dom-second-feed/run.mjs - the H1 dominant-zone limit of PREREGISTRATION.md on two feeds (HistData, OANDA).
// node research/edge/dom-second-feed/run.mjs market <market> <outDir>   one market, both feeds -> <outDir>/<market>.json
// node research/edge/dom-second-feed/run.mjs report <outDir>            pool, apply the pre-registered bar, write result.json
// EDGE_DATA = the edgekit OANDA cache. HistData comes from `git show origin/council-data:research/candles/...` (no network).
// Research only: reads candles, writes only to <outDir> and its own result.json.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, exclusions, buildZones, NONE } from '../combo-grid-3/run.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf'];
const FOLDER = { xau: 'xau-histdata/XAUUSD', eurusd: 'EURUSD/EURUSD', gbpusd: 'GBPUSD/GBPUSD', usdjpy: 'USDJPY/USDJPY',
  audusd: 'AUDUSD/AUDUSD', usdcad: 'USDCAD/USDCAD', usdchf: 'USDCHF/USDCHF' };
const y = (n, m = 0, d = 1) => Date.UTC(n, m, d) / 1000;
export const LOAD = y(2018), FROM = y(2018, 1), SPLIT = y(2020);
export const EX = { trail: 6, '1R': 0, '2R': 1, '3R': 2, '4R': 3 };

// ---- HistData M1 text -> 5-minute candles (UTC through histStampUtc only) ------------------------------------------------
// state { out, last, dropped } carries across files; a converted time that does not move forward is dropped.
export function parseHist(text, st = { out: [], last: -Infinity, dropped: 0 }) {
  let s = 0;
  while (s < text.length) {
    let e = text.indexOf('\n', s); if (e < 0) e = text.length;
    const line = text.slice(s, e); s = e + 1;
    if (line.length < 20) continue;
    const p = line.split(';'); if (p.length < 5) continue;
    const t = histStampUtc(p[0]);
    if (!(t > st.last)) { st.dropped++; continue; } st.last = t;
    const o = +p[1], h = +p[2], l = +p[3], c = +p[4], b = Math.floor(t / 300) * 300, k = st.out[st.out.length - 1];
    if (k && k.t === b) { if (h > k.h) k.h = h; if (l < k.l) k.l = l; k.c = c; }
    else st.out.push({ t: b, o, h, l, c, e: b + 300 });
  }
  return st;
}
export function histM5(market, cacheDir) {
  const cf = cacheDir && path.join(cacheDir, `hist-${market}.json.gz`);
  if (cf && fs.existsSync(cf)) return JSON.parse(zlib.gunzipSync(fs.readFileSync(cf)).toString()).map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], e: r[0] + 300 }));
  const [dir, sym] = FOLDER[market].split('/');
  const list = execFileSync('git', ['ls-tree', '--name-only', 'origin/council-data', `research/candles/${dir}/`], { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter((f) => path.basename(f).startsWith(sym + '_M1_')).sort();
  const st = { out: [], last: -Infinity, dropped: 0 };
  for (const f of list) parseHist(zlib.gunzipSync(execFileSync('git', ['show', `origin/council-data:${f}`], { cwd: ROOT, maxBuffer: 1 << 30 })).toString(), st);
  if (cf) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cf, zlib.gzipSync(JSON.stringify(st.out.map((b) => [b.t, b.o, b.h, b.l, b.c])))); }
  return st.out;
}

function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }

// ---- the rule (dom-zone-holdout's trades(), on any 5-minute series) ------------------------------------------------------
export function tradesOn(M5, market, from, to, { cost = COSTS[market], bad = () => false } = {}) {
  if (!M5.length) return { trades: [], zones: [] };
  const F = frames(M5), H = F['1h'], T = F['5m'], A = atr14(H);
  const out = [];
  for (const sg of signalsFor(F, '1h', '5m', 'dom', {}, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost)) continue;
    const r = multi(M5, d, entry, stop, 'lim', ts, ts + 12 * 300, 2, null, 2 * 86400, null);
    if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
    const row = { market, t: r.t, side: d, entry, stop, cr: cost / r.risk };
    for (const [k, i] of Object.entries(EX)) row[k] = r.R[i];
    out.push(row);
  }
  const zones = buildZones('dom', H).filter((z) => z.at >= from && z.at < to).map((z) => z.d + ':' + z.at);
  return { trades: out, zones };
}

// ---- statistics -----------------------------------------------------------------------------------------------------
const mkey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthSums(rows, key, net) { const m = new Map(); for (const r of rows) { const k = mkey(r.t); m.set(k, (m.get(k) || 0) + r[key] - (net ? r.cr : 0)); } return m; }
export function tOf(v) { const n = v.length; if (n < 3) return null; const mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)); return sd > 0 ? mean / (sd / Math.sqrt(n)) : null; }
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4), r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export function summ(rows, key = 'trail') {
  const n = rows.length; if (!n) return { n: 0 };
  const g = rows.reduce((a, r) => a + r[key], 0) / n, c = rows.reduce((a, r) => a + r.cr, 0) / n;
  return { n, before: r4(g), tBefore: r2(tOf([...monthSums(rows, key, false).values()])), after: r4(g - c), tAfter: r2(tOf([...monthSums(rows, key, true).values()])) };
}
export function paired(a, b, key = 'trail', net = false) { // a minus b over the months either has a trade (missing = 0)
  const A = monthSums(a, key, net), B = monthSums(b, key, net), ks = [...new Set([...A.keys(), ...B.keys()])].sort();
  const v = ks.map((k) => (A.get(k) || 0) - (B.get(k) || 0));
  return { months: v.length, meanDiff: r4(v.reduce((s, x) => s + x, 0) / (v.length || 1)), t: r2(tOf(v)) };
}
const p1 = (t, df = 60) => (t == null ? 1 : t > 0 ? K.pFromT(t, df) / 2 : 1 - K.pFromT(t, df) / 2);

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const Hm = histM5(m, dir);
  const Om = K.load(m, '5m', { from: LOAD });
  const to = Math.min(Hm[Hm.length - 1].e, Om[Om.length - 1].e);
  const X = exclusions(m), bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const h = tradesOn(Hm.filter((b) => b.t >= LOAD && b.e <= to), m, FROM, to, { bad });
  const o = tradesOn(Om.filter((b) => b.t >= LOAD && b.e <= to), m, FROM, to, { bad });
  const oz = new Set(o.zones), both = h.zones.filter((k) => oz.has(k)).length;
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify({ market: m, to, hBars: Hm.length, oBars: Om.length, hist: h.trades, oanda: o.trades,
    zones: { hist: h.zones.length, oanda: o.zones.length, both } }));
  console.log(m, 'to', new Date(to * 1000).toISOString(), 'hist', h.trades.length, 'oanda', o.trades.length, 'zones', h.zones.length, o.zones.length, both);
}
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'report') {
  const dir = process.argv[3];
  const H = [], O = [], perMarket = {}, zones = {}; let to = 0;
  for (const m of MARKETS) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')); H.push(...j.hist); O.push(...j.oanda); to = Math.max(to, j.to);
    const late = (a) => a.filter((r) => r.t >= SPLIT), early = (a) => a.filter((r) => r.t < SPLIT);
    perMarket[m] = { hist2020: summ(late(j.hist)), oanda2020: summ(late(j.oanda)), hist2018: summ(early(j.hist)), oanda2018: summ(early(j.oanda)),
      paired2020: paired(late(j.hist), late(j.oanda)), end: new Date(j.to * 1000).toISOString().slice(0, 10) };
    zones[m] = { ...j.zones, shareOfHist: r4(j.zones.both / j.zones.hist), shareOfOanda: r4(j.zones.both / j.zones.oanda) };
  }
  const zb = Object.values(zones).reduce((a, z) => ({ hist: a.hist + z.hist, oanda: a.oanda + z.oanda, both: a.both + z.both }), { hist: 0, oanda: 0, both: 0 });
  zones.pooled = { ...zb, shareOfHist: r4(zb.both / zb.hist), shareOfOanda: r4(zb.both / zb.oanda) };
  const H2 = H.filter((r) => r.t >= SPLIT), O2 = O.filter((r) => r.t >= SPLIT), H1 = H.filter((r) => r.t < SPLIT), O1 = O.filter((r) => r.t < SPLIT);
  const T1 = summ(H2), T3 = summ(H1), T2 = { oanda: summ(O2), pairedBefore: paired(H2, O2), pairedAfter: paired(H2, O2, 'trail', true) };
  const holm = K.holm([p1(T1.tBefore), p1(T3.tBefore)]);
  const pass1 = T1.before > 0 && T1.tBefore >= 2 && holm[0] < 0.05, pass3 = T3.before > 0 && T3.tBefore >= 2 && holm[1] < 0.05;
  const oPass = T2.oanda.before > 0 && T2.oanda.tBefore >= 2;
  const feedDep = (T2.pairedBefore.t != null && T2.pairedBefore.t <= -2) || (oPass && !pass1);
  const verdict = pass1 && pass3 ? 'PASS' : pass1 ? 'INCONCLUSIVE' : 'FAIL';
  const exits = {}; for (const k of Object.keys(EX)) exits[k] = { hist2020: summ(H2, k), oanda2020: summ(O2, k), hist2018: summ(H1, k), oanda2018: summ(O1, k) };
  const headline = `HistData 2020 on: ${T1.n} trades, ${T1.before >= 0 ? '+' : ''}${T1.before}R a trade before costs, month t ${T1.tBefore}`
    + ` (OANDA ${T2.oanda.n}, ${T2.oanda.before}R, t ${T2.oanda.tBefore}; paired month t ${T2.pairedBefore.t}); 2018-19 HistData ${T3.n}, ${T3.before}R, t ${T3.tBefore}.`;
  const res = { study: 'dom-second-feed', built: '2026-11-23', basis: 'judged before costs (owner); after costs beside', verdict, headline,
    window: { from: '2018-02-01', split: '2020-01-01', to: new Date(to * 1000).toISOString().slice(0, 10) }, markets: MARKETS,
    passes: { T1: pass1, T3: pass3, T2oanda: oPass }, holm: holm.map((x) => +x.toPrecision(3)), feedDependent: feedDep,
    T1, T2, T3, exits, perMarket, zones };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict, headline, passes: res.passes, holm: res.holm, feedDep, T2, zones: zones.pooled }, null, 1));
}

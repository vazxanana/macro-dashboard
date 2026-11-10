// MeridianX Academy: the feature export. One row of MXA.features per candidate, computed at the candidate's signal time.
//
//   ACADEMY_CANDLES=<folder outside the repo> node academy/gen/features.mjs            # all seven edges, about a minute
//   ACADEMY_CANDLES=<folder> node academy/gen/features.mjs --edge gtl                  # one edge (the matrix is not rewritten)
//
// The folder is the one academy/gen/run.mjs reads: it holds research/candles/xau-histdata and nsxusd-histdata (HistData M1,
// from the council-data branch; never copied into the repo).
//
// Writes
//   academy/data/feat-<edge>.json   { version, generated, policy, n, missing, meta, features: { <candidateId>: MXA.lite(f) } }
//                                   for EVERY candidate. The API route GET /api/academy?get=history filters pools and
//                                   flagged setups itself and hands these rows to MXA.decide as "similar past cases".
//   ml/data/matrix.json.gz          every candidate with all MXA.features keys and its label columns (the training table).
//
// NO LOOK-AHEAD. A row is built from one MXR.snapshot at t = the candidate's signal time. The snapshot keeps only bars that
// had CLOSED at t (bar.time + tfSec <= t) and MXR.guard throws on anything later. Outcomes are never read to make a feature:
// they are joined to the matrix afterwards as label columns.
//
// THE SNAPSHOT RECIPE (the page has to build the same one, or its features will not match the stored past cases):
//   series   the edge's contextTfs from academy/edges.mjs (no '1m': nq-open candidates carry tf '1m' and the core then
//            measures them on 5m bars). Every timeframe is built from M1 bars in plain UTC buckets, exactly as
//            MXR.aggregate does (a bucket exists when at least one M1 bar is in it; the Sunday evening is its own daily bar).
//   clock    HistData labels read as New York time and turned into UTC by the same loader the generators use
//            (research/edge/robustness/lib.mjs loadM1), so t lines up with cand-<edge>.json.
//   keep     300 bars a timeframe.
//   inter    none. The research folder has no dollar-index candles and the live candle proxy has no dollar index either,
//            so dxyTrend / dxyStrength / dxyConflict are null in every row.
//   events   CPI, payrolls and FOMC only, from the calendar file council/events.mjs (read, never changed), and only for
//            t >= 1 Jan 2022, where that file's dates begin. Before that no calendar is passed and eventNear is null
//            ("unknown"), never false. See calendar() below.
//
// Deterministic: the same candidate files, candles and code give byte-identical outputs. `generated` is the date stamp of
// academy/data/meta.json (the candidate run these features belong to), not the wall clock.
// Paper research only. Nothing here places an order.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { EDGES, edgeById } from '../edges.mjs';

const require = createRequire(import.meta.url);
const MXR = require('../../assets/academy-replay.js');
const MXA = require('../../assets/academy-core.js');

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = path.join(ROOT, 'academy/data');
export const ML_DATA_DIR = path.join(ROOT, 'ml/data');
export const RECIPE = 'feat-1';                 // bump when the snapshot recipe above changes
export const KEEP = 300;
export const TF_SEC = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
export const FEATURE_KEYS = Object.keys(MXA.FEATURE_DOC);
export const LITE_KEYS = Object.keys(MXA.lite({}));
export const UNFILLED = ['missed', 'expired', 'cancelled'];   // an order that never filled is not a trade
export const LABEL_KEYS = ['id', 'edge', 't', 'pool', 'clockShift', 'pre2020', 'filled', 'reason', 'R', 'netR', 'win', 'exitT'];
const M1_DIR = { xau: 'xau-histdata', nas100: 'nsxusd-histdata' };

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---- candles ------------------------------------------------------------------------------------------------------------
// M1 typed arrays { t, o, h, l, c, n } -> Bar[] of `sec` seconds in plain UTC buckets. Same result as
// MXR.aggregate(bars, '1m', tf) on the same bars (the test checks it), without building three million bar objects first.
export function aggM1(A, sec) {
  const out = []; let cur = null;
  for (let i = 0; i < A.n; i++) {
    const k = Math.floor(A.t[i] / sec) * sec;
    if (!cur || cur.time !== k) { cur = { time: k, open: A.o[i], high: A.h[i], low: A.l[i], close: A.c[i] }; out.push(cur); }
    else { if (A.h[i] > cur.high) cur.high = A.h[i]; if (A.l[i] < cur.low) cur.low = A.l[i]; cur.close = A.c[i]; }
  }
  return out;
}
// Bar[] of M1 -> the same typed-array shape (for tests and small series)
export function typedM1(bars) {
  const n = bars.length, A = { t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n), l: new Float64Array(n), c: new Float64Array(n), n };
  bars.forEach((b, i) => { A.t[i] = b.time; A.o[i] = b.open; A.h[i] = b.high; A.l[i] = b.low; A.c[i] = b.close; });
  return A;
}
export function seriesFromM1(A, tfs = Object.keys(TF_SEC)) { const s = {}; for (const tf of tfs) s[tf] = aggM1(A, TF_SEC[tf]); return s; }

// The research candles of both markets as { xau: { '5m': Bar[], ... }, nas100: { ... } }.
export async function loadSeries(candlesDir, markets = Object.keys(M1_DIR)) {
  if (!candlesDir || !fs.existsSync(path.join(candlesDir, 'research/candles/xau-histdata'))) throw new Error('Set ACADEMY_CANDLES to the folder that holds research/candles/xau-histdata and nsxusd-histdata (see academy/gen/run.mjs).');
  if (!path.relative(ROOT, path.resolve(candlesDir)).startsWith('..')) throw new Error('ACADEMY_CANDLES must be outside the repository: candles are never committed.');
  process.env.ROB_DATA = candlesDir;            // read once by the loader when it is first imported
  const lib = await import('../../research/edge/robustness/lib.mjs');
  if (path.resolve(lib.DATA) !== path.resolve(candlesDir)) throw new Error('the candle loader was already bound to another folder: ' + lib.DATA);
  const out = {};
  for (const m of markets) out[m] = seriesFromM1(lib.loadM1(M1_DIR[m]));
  return out;
}

// ---- the calendar -------------------------------------------------------------------------------------------------------
// council/events.mjs is a plain data file (hard-coded official release dates, no imports, no network, no clock). It is only
// READ here. It holds CPI / payrolls / FOMC from January 2022 (its HISTORY list) and a wider set from August 2025 (EVENTS).
// To keep one definition over the whole period only the three types that exist from 2022 are used, all as impact 'high'.
// Before CAL_FROM nothing is passed, so eventNear stays null there instead of a false "no event".
// A release date is public long before the 72 hours the snapshot looks ahead, so knowing it is not look-ahead; its result
// is never in this list (only t, title, impact).
export const CAL_TYPES = ['CPI', 'NFP', 'FOMC'];
export const CAL_FROM = Date.UTC(2022, 0, 1) / 1000;
export async function calendar() {
  const m = await import('../../council/events.mjs');
  const items = [...m.HISTORY, ...m.EVENTS].filter((e) => CAL_TYPES.includes(e.type)).map((e) => ({ t: e.t, title: e.title, impact: 'high' })).sort((a, b) => a.t - b.t);
  for (let i = 1; i < items.length; i++) if (items[i].t === items[i - 1].t && items[i].title === items[i - 1].title) throw new Error('calendar: a release is listed twice at ' + items[i].t);
  return { from: CAL_FROM, to: items[items.length - 1].t, types: CAL_TYPES, n: items.length, items, hash: sha(JSON.stringify(items)).slice(0, 12) };
}
// what a snapshot at t may be given: releases of the last week, and releases due in the next 72 hours
export function calendarAt(cal, t) {
  if (!cal || t < cal.from || t > cal.to) return { events: null, schedule: null };
  return { events: cal.items.filter((e) => e.t <= t && e.t > t - 7 * 86400), schedule: cal.items.filter((e) => e.t > t && e.t <= t + 72 * 3600) };
}

// ---- one candidate -> one snapshot -> one feature row -----------------------------------------------------------------------
// `series` = the market's full arrays { tf: Bar[] }; MXR.snapshot does the slicing to closed bars and runs the guard.
export function buildSnapshot({ edge, cand, series, cal = null, dataVersion = null }) {
  const e = typeof edge === 'string' ? edgeById(edge) : edge, pick = {};
  for (const tf of e.contextTfs) { if (!TF_SEC[tf]) throw new Error(`${e.id}: unsupported context timeframe ${tf}`); if (!Array.isArray(series[tf])) throw new Error(`${e.id}: no ${tf} series`); pick[tf] = series[tf]; }
  const c = calendarAt(cal, cand.t);
  return MXR.snapshot({ edge: e.id, market: e.market, t: cand.t, cand, series: pick, events: c.events, schedule: c.schedule, dataVersion, keep: KEEP });
}
export const featuresOf = (snapshot) => MXA.features(snapshot);
export const isFlagged = (cand) => !!(cand.rule && (cand.rule.clockShift || cand.rule.pre2020));
export const isFilled = (out) => !!out && !UNFILLED.includes(out.reason);

// version = first 12 hex of sha256 over: the recipe, the feature code versions, the feature key list, the calendar, the
// edge's rule version, the candle commit and the candidate file's bytes
export function featVersion({ edge, candText, cal, candlesRef }) {
  return sha(JSON.stringify({ recipe: RECIPE, keep: KEEP, mxa: MXA.VERSION, mxr: MXR.VERSION, keys: FEATURE_KEYS, lite: LITE_KEYS, tfs: edge.contextTfs, cal: cal ? [cal.hash, cal.from, cal.types] : null,
    edgeVersion: edge.version, candles: candlesRef || null, cand: sha(candText) })).slice(0, 12);
}
export const dataVersionOf = (meta) => 'histdata@' + String((meta && meta.candles && meta.candles.ref) || 'unknown').slice(0, 12);

// All rows of one edge, in candidate order: [{ cand, snapshot, f }]. onRow lets a caller use the snapshot without keeping it.
export function eachCandidate({ edge, cands, series, cal, dataVersion, onRow }) {
  for (const cand of cands) { const snapshot = buildSnapshot({ edge, cand, series, cal, dataVersion }); onRow({ cand, snapshot, f: featuresOf(snapshot) }); }
}

export const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const line = (v) => JSON.stringify(v);

// ---- main ---------------------------------------------------------------------------------------------------------------
async function main() {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const only = arg('--edge'), edges = only ? EDGES.filter((e) => e.id === only) : EDGES;
  if (!edges.length) throw new Error('unknown edge ' + only);
  const meta = readJson(path.join(DATA_DIR, 'meta.json')), cal = await calendar(), dataVersion = dataVersionOf(meta);
  const series = await loadSeries(process.env.ACADEMY_CANDLES, [...new Set(edges.map((e) => e.market))]);
  const matrix = [], versions = {};
  for (const edge of edges) {
    const candText = fs.readFileSync(path.join(DATA_DIR, `cand-${edge.id}.json`), 'utf8'), cands = JSON.parse(candText), outs = readJson(path.join(DATA_DIR, `out-${edge.id}.json`));
    const version = featVersion({ edge, candText, cal, candlesRef: meta.candles.ref }), feats = {}, missTf = {}; let missing = 0, withCal = 0;
    eachCandidate({ edge, cands, series: series[edge.market], cal, dataVersion, onRow: ({ cand, f }) => {
      if (feats[cand.id]) throw new Error('duplicate candidate id ' + cand.id);
      feats[cand.id] = MXA.lite(f);
      if (!f.barsOk) { missing++; for (const tf of String(f.missingTf || f.sigTf).split(',')) missTf[tf] = (missTf[tf] || 0) + 1; }
      if (f.eventNear !== null) withCal++;
      const o = outs[cand.id]; if (!o) throw new Error('no outcome for ' + cand.id);
      const filled = isFilled(o);   // the label columns: joined here, after the features exist; never an input to them
      matrix.push([cand.id, edge.id, cand.t, cand.pool, !!cand.rule.clockShift, !!cand.rule.pre2020, filled, o.reason, filled ? o.R : null, filled ? o.netR : null, filled ? (o.netR > 0 ? 1 : 0) : null, o.exitT, FEATURE_KEYS.map((k) => f[k])]);
    } });
    versions[edge.id] = version;
    const head = { version, generated: meta.generated, policy: MXA.POLICY_VERSION, n: cands.length, missing,
      meta: { edge: edge.id, edgeVersion: edge.version, recipe: RECIPE, code: { core: MXA.VERSION, replay: MXR.VERSION }, dataVersion, series: edge.contextTfs, keep: KEEP, missingByTf: missTf,
        inter: 'none: no dollar-index candles in the research folder or on the live candle proxy, so the dxy keys are null',
        events: { source: 'council/events.mjs (read only)', types: cal.types, from: cal.from, to: cal.to, hash: cal.hash, rowsWithCalendar: withCal, note: 'rows before 1 Jan 2022 have no calendar: eventNear is null there' },
        keys: LITE_KEYS } };
    const body = '{\n' + Object.entries(head).map(([k, v]) => `${line(k)}: ${line(v)}`).join(',\n') + ',\n"features": {\n' + cands.map((c) => `${line(c.id)}: ${line(feats[c.id])}`).join(',\n') + '\n}\n}\n';
    fs.writeFileSync(path.join(DATA_DIR, `feat-${edge.id}.json`), body);
    console.error(edge.id.padEnd(9), 'rows', String(cands.length).padStart(5), 'missing timeframe', String(missing).padStart(4), JSON.stringify(missTf), 'with calendar', withCal, 'version', version);
  }
  if (only) { console.error('one edge only: ml/data/matrix.json.gz was not rewritten'); return; }
  // the training table: one array per candidate, the label columns first, then the feature values in featureKeys order
  fs.mkdirSync(ML_DATA_DIR, { recursive: true });
  const mv = sha(JSON.stringify(versions)).slice(0, 12);
  const txt = '{\n' + [`"version": ${line(mv)}`, `"generated": ${line(meta.generated)}`, `"featVersions": ${line(versions)}`, `"policy": ${line(MXA.POLICY_VERSION)}`, `"dataVersion": ${line(dataVersion)}`,
    `"labelKeys": ${line(LABEL_KEYS)}`, `"featureKeys": ${line(FEATURE_KEYS)}`, `"priceKeys": ${line(MXA.PRICE_KEYS)}`,
    `"note": ${line('Each row: the label columns in labelKeys order, then one array of feature values in featureKeys order. R, netR and win are null for an order that never filled. Labels are outcomes: never use them as inputs.')}`].join(',\n')
    + ',\n"rows": [\n' + matrix.map(line).join(',\n') + '\n]\n}\n';
  fs.writeFileSync(path.join(ML_DATA_DIR, 'matrix.json.gz'), zlib.gzipSync(Buffer.from(txt), { level: 9 }));
  console.error('matrix', matrix.length, 'rows,', FEATURE_KEYS.length, 'features, version', mv, '->', (fs.statSync(path.join(ML_DATA_DIR, 'matrix.json.gz')).size / 1024).toFixed(0), 'KB');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e.message || e); process.exit(1); });

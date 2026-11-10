// Shared helpers for the Academy edge generators (node only; nothing here is served).
//
// The gold studies in research/edge/gold-systems (daily.mjs, replica.mjs, mosha.mjs) are scripts: importing them runs the
// whole study and only the summary rows come out. The generators need the trades themselves, so `runStudy` runs the study's
// OWN source text unchanged (the same trick research/edge/gold-systems/live.mjs uses on council/trader.mjs): the import
// lines are replaced by injected bindings, of which two are wrapped to observe, never to change, what the study does:
//   step(tr, m, k)   the study's trade-management loop: the wrapper notes every trade object that passes through it
//   report(rows)     called once per variant: the wrapper cuts the trade list there, so each variant keeps its own trades
// No rule is copied or re-written; if the study file changes, the generator runs the changed rule and the edge `version`
// (a hash of the rule files) changes with it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EVAL_FROM } from '../edges.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = path.join(ROOT, 'academy/data');

const IMPORT = /^import\s+(?:([A-Za-z_$][\w$]*)|\{([^}]*)\})\s+from\s+'([^']+)';?[ \t]*$/gm;

// Run a study script with its imports injected. override: { name: (real) => replacement }. expose: top-level names to return.
export async function runStudy(rel, { override = {}, expose = [] } = {}) {
  const file = path.join(ROOT, rel), src = fs.readFileSync(file, 'utf8');
  if (/\bimport\.meta\b|\bawait\b/.test(src)) throw new Error(`${rel}: import.meta / top-level await is not supported by runStudy`);
  const names = [], values = [];
  for (const mt of src.matchAll(IMPORT)) {
    const [, def, named, spec] = mt;
    const mod = await import(spec.startsWith('.') ? pathToFileURL(path.resolve(path.dirname(file), spec)).href : spec);
    const pairs = def ? [[def, 'default']] : named.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [a, b] = s.split(/\s+as\s+/); return [b || a, a]; });
    for (const [local, exported] of pairs) {
      if (!(exported in mod)) throw new Error(`${rel}: ${spec} has no export ${exported}`);
      names.push(local); values.push(override[local] ? override[local](mod[exported]) : mod[exported]);
    }
  }
  const body = src.replace(IMPORT, '// (import injected by academy/gen/study.mjs)');
  if (/^\s*import\s/m.test(body)) throw new Error(`${rel}: an import line was not understood`);
  return new Function(...names, `'use strict';\n${body}\n;return { ${expose.join(', ')} };`)(...values);
}

// The observers: every trade object the study steps, cut into one list per report() call (= per variant, in file order).
export function recorder() {
  let cur = new Set(); const runs = [];
  return {
    runs,
    override: {
      step: (real) => (tr, m, k) => { cur.add(tr); return real(tr, m, k); },
      report: (real) => (rows) => { runs.push({ rows, trades: [...cur] }); cur = new Set(); return real(rows); },
    },
  };
}

// Source text of one top-level `function name(...) {...}` of a script file, verbatim (brace matching, as live.mjs `grab`).
export function grabFunction(src, name) {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`function ${name} not found`);
  let j = src.indexOf('{', i), depth = 0;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; } }
  return src.slice(i, j + 1);
}

// version = first 12 hex of sha256 over the rule source files, in the order listed (path + NUL + content each)
export function computeVersion(files, root = ROOT) {
  const h = crypto.createHash('sha256');
  for (const f of files) { h.update(f); h.update('\0'); h.update(fs.readFileSync(path.join(root, f))); h.update('\0'); }
  return h.digest('hex').slice(0, 12);
}

export const round = (x, dp) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(dp));
export const lowerBound = (T, t) => { let lo = 0, hi = T.length; while (lo < hi) { const md = (lo + hi) >> 1; if (T[md] < t) lo = md + 1; else hi = md; } return lo; };

// Best and worst excursion of one unit, in R, both >= 0. Measured on the M1 bars from the fill bar up to (not including) the
// exit bar, plus the exit price itself: inside the exit bar the order of high and low is unknown, so only the exit counts.
// bar(k) -> { high, low } for M1 index k.
export function excursions({ side, entry, r0, kFill, kExit, exitR, bar }) {
  let mfe = 0, mae = 0;
  for (let k = kFill; k < kExit; k++) { const b = bar(k);
    mfe = Math.max(mfe, (side > 0 ? b.high - entry : entry - b.low) / r0);
    mae = Math.max(mae, (side > 0 ? entry - b.low : b.high - entry) / r0); }
  if (Number.isFinite(exitR)) { mfe = Math.max(mfe, exitR); mae = Math.max(mae, -exitR); }
  return { mfeR: round(mfe, 3), maeR: round(mae, 3) };
}

// New York clock of a UTC second: minute of day, weekday, and the trading session a discretionary reviewer would name.
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short' });
export function sessionOf(t) {
  const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value;
  const m = +o.hour * 60 + +o.minute;
  return m >= 1080 || m < 180 ? 'asia' : m < 480 ? 'london' : m < 1020 ? 'ny' : 'closed';   // 18:00-03:00, 03:00-08:00, 08:00-17:00 New York
}
// The tag every candidate before the 2020 evaluation start carries (rule.clockShift is added by run.mjs, after the data check)
export const stamps = (t) => (t < EVAL_FROM ? { pre2020: true } : {});

// Raw HistData files of one folder: rows, repeated time labels, and the days that repeat a whole hour of labels
export function scanRaw(dir) {
  const seen = new Map(), perDay = new Map(); let rows = 0, dup = 0, same = 0;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv.gz')).sort();
  for (const f of files) for (const line of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString().split('\n')) {
    if (line.length < 20) continue; rows++; const k = line.slice(0, 15), p = seen.get(k);
    if (p == null) seen.set(k, line); else { dup++; if (p === line) same++; const d = `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`; perDay.set(d, (perDay.get(d) || 0) + 1); }
  }
  return { files: files.length, rows, duplicateLabels: dup, identicalRows: same, repeatedHourDays: [...perDay].filter(([, n]) => n === 60).map(([d]) => d), firstLabel: [...seen.keys()][0], lastLabel: [...seen.keys()].at(-1) };
}

export const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');

export function writeJson(name, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const body = Array.isArray(value)
    ? '[\n' + value.map((x) => JSON.stringify(x)).join(',\n') + '\n]\n'
    : '{\n' + Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n';
  fs.writeFileSync(path.join(DATA_DIR, name), body);
}

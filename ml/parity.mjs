// MeridianX Academy: the parity check between the training library and the page's scorer.
//
//   node ml/parity.mjs                 # every model in ml/models/index.json
//   node ml/parity.mjs --dir <folder>  # models written somewhere else (python ml/train.py --out <folder>)
//
// For each exported model it reads <id>.pred.json (the training library's own predictions on a few hundred rows), scores
// the SAME rows with MXA.score on the exported JSON trees, and compares. The largest absolute difference in the raw score
// and in the probability must be under 1e-6 (MXA.score rounds both to six decimals). Exit code 1 otherwise.
// The rows' raw feature values come from ml/data/matrix.json.gz, so strings, booleans and missing values go through the
// model's own encoders exactly as they will on the page.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MXA = createRequire(import.meta.url)('../assets/academy-core.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOLERANCE = 1e-6;

// id -> { edge, f: { featureKey: raw value } }
export function loadMatrix(file = path.join(HERE, 'data/matrix.json.gz')) {
  const m = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')), nl = m.labelKeys.length, iId = m.labelKeys.indexOf('id'), iEdge = m.labelKeys.indexOf('edge'), rows = new Map();
  for (const r of m.rows) { const f = {}; m.featureKeys.forEach((k, i) => { f[k] = r[nl][i]; }); rows.set(r[iId], { edge: r[iEdge], f }); }
  return { version: m.version, rows };
}
// The features object a model is scored on. A pooled model also reads the edge id, which MXA.features does not carry.
export const featuresFor = (row) => Object.assign({}, row.f, { edge: row.edge });

// The same walk as MXA.score, without its rounding to six decimals: left when x <= t, a missing value left unless
// defaultLeft is false. It shows that the 5e-7 left by MXA.score is rounding only.
export function rawExact(model, f) {
  const x = model.featureNames.map((name) => { const v = f[name], enc = model.encoders && model.encoders[name];
    return v === null || v === undefined ? null : typeof v === 'number' ? (Number.isFinite(v) ? v : null) : typeof v === 'boolean' ? (v ? 1 : 0) : enc && Object.prototype.hasOwnProperty.call(enc, v) ? enc[v] : null; });
  let raw = model.baseScore || 0;
  for (const tree of model.trees) { let n = tree; while (n.v === undefined) n = (x[n.f] === null ? n.defaultLeft !== false : x[n.f] <= n.t) ? n.left : n.right; raw += n.v; }
  return raw;
}
// { n, maxRaw, maxP, maxExact, worst } for one model against its stored predictions
export function compare(model, pred, matrix) {
  let maxRaw = 0, maxP = 0, maxExact = 0, worst = null;
  for (const r of pred.rows) {
    const row = matrix.rows.get(r.id); if (!row) throw new Error(`${pred.model}: row ${r.id} is not in the matrix (stale files? run academy/gen/features.mjs and ml/train.py again)`);
    const f = featuresFor(row), s = MXA.score(model, f), dRaw = Math.abs(s.raw - r.raw), dP = Math.abs(s.p - r.p);
    if (dP > maxP) { maxP = dP; worst = r.id; }
    if (dRaw > maxRaw) maxRaw = dRaw;
    maxExact = Math.max(maxExact, Math.abs(rawExact(model, f) - r.raw));
  }
  return { n: pred.rows.length, maxRaw, maxP, maxExact, worst };
}

function main() {
  const i = process.argv.indexOf('--dir'), dir = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(HERE, 'models');
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')), matrix = loadMatrix();
  if (index.data.matrixVersion !== matrix.version) { console.error(`the models were trained on matrix ${index.data.matrixVersion} but ml/data holds ${matrix.version}`); process.exit(1); }
  let bad = 0, none = 0;
  for (const e of index.models) {
    // a linear scorer has no file (it cannot be written in MXA.MODEL_SCHEMA): there is nothing the page could load
    if (!e.file) { none++; if (fs.existsSync(path.join(dir, e.id + '.json'))) { console.error(`${e.id}: the index says it has no file, but one exists`); bad++; } continue; }
    const model = JSON.parse(fs.readFileSync(path.join(dir, e.file), 'utf8')), pred = JSON.parse(fs.readFileSync(path.join(dir, e.pred), 'utf8'));
    const c = compare(model, pred, matrix), ok = c.maxRaw < TOLERANCE && c.maxP < TOLERANCE && c.maxExact < 1e-9; if (!ok) bad++;
    console.log(`${e.id.padEnd(24)} rows ${String(c.n).padStart(3)}  max |raw diff| ${c.maxRaw.toExponential(2)}  max |p diff| ${c.maxP.toExponential(2)}  unrounded raw ${c.maxExact.toExponential(2)}  ${ok ? 'ok' : 'FAIL (worst row ' + c.worst + ')'}`);
  }
  if (none) console.log(`${none} linear scorer(s) have no exported file: nothing to load, nothing to check`);
  if (!index.models.length) console.log('no model was exported (not enough data for any edge)');
  if (bad) { console.error(`${bad} model(s) do not reproduce the training library's predictions`); process.exit(1); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

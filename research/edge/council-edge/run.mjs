// Council edge · runs the council's own gold replay harnesses (live rules copied out of council/trader.mjs) with and without the
// pre-registered exit change, from 2020 on (preregistration.md).
//   CANDLES=<dir from research/edge/replica-oos/fetch.mjs> OUT_DIR=<dir> node research/edge/council-edge/run.mjs
// -> OUT_DIR/{replica,gold}-{live,holdOpen}/trades.json, then node analyze.mjs reads them.
// Each harness file is copied to OUT_DIR with its relative imports made absolute and the patches below applied; every patch must
// match its text exactly once, else the run stops (a harness that changed under us is never silently mis-patched). The live
// variant gets the import fix only, so "live" here IS the published harness.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), EDGE = path.resolve(HERE, '..');
const OUT = path.resolve(process.env.OUT_DIR || '.'), CANDLES = process.env.CANDLES;
export const FROM = '2020-01-01';

// H1 (holdOpen): on the first candle at or after filled + maxHold, close at that candle's OPEN before any stop / target / trail check
export const PATCHES = {
  replica: { file: 'replica-oos/replay.mjs', holdOpen: [[
    '  const s = tr.sell, r0 = tr.r0;\n',
    '  const s = tr.sell, r0 = tr.r0;\n  if (tr.maxHold && b.time >= tr.filled + tr.maxHold) { tr.R = +((s ? tr.entry - b.open : b.open - tr.entry) / r0).toFixed(2); tr.exitKind = \'time\'; tr.closed = b.time; return null; }\n']] },
  gold: { file: 'gold-systems-oos/replay.mjs', holdOpen: [[
    '  const r0 = tr.r0;\n  if (b.low <= tr.stop) {\n',
    '  const r0 = tr.r0;\n  if (tr.maxHold && b.time >= tr.filled + tr.maxHold) { tr.R = +((b.open - tr.entry) / r0).toFixed(2); tr.status = \'closed\'; tr.closed = b.time; tr.exit = `${tr.maxHold / 3600} h`; tr.exitPx = b.open; return; }\n  if (b.low <= tr.stop) {\n']] },
};

export function patchSource(src, file, patches) {
  const dir = path.dirname(path.join(EDGE, file));
  let out = src.replace(/from '(\.\.?\/[^']+)'/g, (m, p) => `from '${pathToFileURL(path.resolve(dir, p)).href}'`);
  for (const [a, b] of patches) {
    const n = out.split(a).length - 1;
    if (n !== 1) throw new Error(`${file}: patch text found ${n} times, expected 1:\n${a}`);
    out = out.replace(a, b);
  }
  return out;
}

function runOne(name, variant) {
  const P = PATCHES[name], src = fs.readFileSync(path.join(EDGE, P.file), 'utf8');
  const code = patchSource(src, P.file, variant === 'live' ? [] : P[variant]);
  const dir = path.join(OUT, `${name}-${variant}`); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'harness.mjs'); fs.writeFileSync(f, code);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [f], { env: { ...process.env, CANDLES, OUT_DIR: dir, OOS_FROM: FROM, FIRST_ENTRY: FROM }, stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`${name}-${variant} failed (${r.status})`);
  console.error(`${name}-${variant}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!CANDLES) throw new Error('CANDLES=<dir> required');
  const only = process.argv.slice(2);
  for (const name of Object.keys(PATCHES)) for (const v of ['live', 'holdOpen']) if (!only.length || only.includes(`${name}-${v}`)) runOne(name, v);
}

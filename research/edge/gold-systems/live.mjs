// Pulls the live signal functions out of council/trader.mjs VERBATIM (trader.mjs runs at import, so it cannot be imported):
// replicaSignals, platformEngulfs, goldLevels, msnrDirection. msAnalyze comes from council/engine.mjs as a normal import.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { msAnalyze } from '../../../council/engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '../../../council/trader.mjs'), 'utf8');

function grab(name) {
  const i = SRC.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`trader.mjs: function ${name} not found`);
  let j = SRC.indexOf('{', i), depth = 0;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; } }
  return SRC.slice(i, j + 1);
}
const names = ['platformEngulfs', 'goldLevels', 'replicaSignals', 'msnrDirection'];
const code = names.map(grab).join('\n') + `\nreturn { ${names.join(', ')} };`;
export const LIVE = new Function('msAnalyze', code)(msAnalyze);
export { msAnalyze };

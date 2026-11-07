// Speed copy of the live engine's msAnalyze for the multi-year replay. It is read from council/engine.mjs at load time,
// and only the two O(L^2) searches in makeEvent (maxIn/minIn(j+1, i) re-scanned for every j) are replaced by a running
// max/min over the same candles: identical results (check.mjs compares both on thousands of real windows).
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../../council/engine.mjs', import.meta.url), 'utf8');
const a = src.indexOf('function msAnalyze('), b = src.indexOf('\nfunction msNextSetup(');
let fn = src.slice(a, b);
const R = [
  ['for (let j = i-1; j > pti; j--) if (L[j] <= level + 0.15*h && maxIn(j+1, i)[0] >= level + 0.5*h) { start = j; break; }',
   '{ let rm = -Infinity; for (let j = i-1; j > pti; j--) { if (H[j+1] > rm) rm = H[j+1]; if (L[j] <= level + 0.15*h && rm >= level + 0.5*h) { start = j; break; } } }'],
  ['for (let j = i-1; j > pbi; j--) if (H[j] >= level - 0.15*h && minIn(j+1, i)[0] <= level - 0.5*h) { start = j; break; }',
   '{ let rm = Infinity; for (let j = i-1; j > pbi; j--) { if (L[j+1] < rm) rm = L[j+1]; if (H[j] >= level - 0.15*h && rm <= level - 0.5*h) { start = j; break; } } }'],
];
for (const [x, y] of R) { if (!fn.includes(x)) throw new Error('engine.mjs msAnalyze changed: speed copy out of date'); fn = fn.replace(x, y); }
export const fastAnalyze = new Function(`${fn}\nreturn msAnalyze;`)();

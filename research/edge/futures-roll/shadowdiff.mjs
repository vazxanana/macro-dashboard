// Shadow (paper) streams old vs new: closed trades and R per stream, from two shadow.json files or two replay.json files.
// node shadowdiff.mjs <old> <new>
import fs from 'node:fs';
const [A, B] = process.argv.slice(2);
const a = JSON.parse(fs.readFileSync(A)), b = JSON.parse(fs.readFileSync(B));
const streams = (x) => x.shadowByVariant ? { dip: x.shadow, ...x.shadowByVariant } : { dip: x.trades, ...Object.fromEntries(Object.entries(x.variants || {}).map(([k, v]) => [k, v.trades])) };
const tot = (t) => { const C = (t || []).filter((y) => y.closed); return { n: C.length, R: +C.reduce((s, y) => s + y.R, 0).toFixed(2) }; };
const sa = streams(a), sb = streams(b);
for (const k of Object.keys(sb)) { const ids = new Set((sa[k] || []).map((y) => y.id)), idb = new Set(sb[k].map((y) => y.id));
  console.log(k.padEnd(7), 'old', JSON.stringify(tot(sa[k])), 'new', JSON.stringify(tot(sb[k])), 'only old', [...ids].filter((i) => !idb.has(i)).length, 'only new', [...idb].filter((i) => !ids.has(i)).length); }

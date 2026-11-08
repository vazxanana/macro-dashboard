// A-setup diff between two replay.json files: node cmp.mjs <old replay.json> <new replay.json> [--all]
// Lists every A-setup that appears, disappears, or changes R / exit / size / entry, per market.
import fs from 'node:fs';
const [A, B, flag] = process.argv.slice(2);
const a = JSON.parse(fs.readFileSync(A)), b = JSON.parse(fs.readFileSync(B));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const key = (x) => `${x.market}-${x.side}-${x.signalAt}`;
const pick = (r) => r.trades.filter((x) => flag === '--all' || x.aset);
const ma = new Map(pick(a).map((x) => [key(x), x])), mb = new Map(pick(b).map((x) => [key(x), x]));
const rows = [];
for (const [k, x] of ma) { const y = mb.get(k);
  if (!y) rows.push({ k, what: 'gone', x });
  else { const d = []; for (const f of ['R', 'exit', 'size', 'entry', 'stop', 'aset']) if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) d.push(`${f} ${x[f]} -> ${y[f]}`);
    for (const f of ['bias', 'atrR', 'pd', 'pdSweep', 'htfFvg', 'cc']) if (JSON.stringify(x.feat[f]) !== JSON.stringify(y.feat[f])) d.push(`feat.${f} ${x.feat[f]} -> ${y.feat[f]}`);
    if (d.length) rows.push({ k, what: 'changed', x, y, d }); } }
for (const [k, y] of mb) if (!ma.has(k)) rows.push({ k, what: 'new', y });
rows.sort((p, q) => (p.x || p.y).signalAt - (q.x || q.y).signalAt);
const tot = (r) => { const C = r.trades.filter((x) => x.aset && x.closed); return { n: C.length, R: +C.reduce((s, x) => s + x.R, 0).toFixed(2) }; };
console.log('A old', JSON.stringify(tot(a)), 'new', JSON.stringify(tot(b)), 'diff rows', rows.length);
const out = rows.map((r) => { const x = r.x || r.y; return { what: r.what, market: x.market, side: x.side, signal: iso(x.signalAt), cash: !!x.cash, Rold: r.x ? r.x.R : null, Rnew: r.y ? r.y.R : null, d: r.d || [] }; });
for (const o of out) console.log(`${o.what.padEnd(7)} ${o.market.padEnd(3)} ${o.side.padEnd(4)} ${o.signal}${o.cash ? ' cash' : ''}  R ${o.Rold} -> ${o.Rnew}  ${o.d.filter((s) => !s.startsWith('feat.pd ')).join('; ')}`);
if (process.env.CMP_OUT) fs.writeFileSync(process.env.CMP_OUT, JSON.stringify(out, null, 1));

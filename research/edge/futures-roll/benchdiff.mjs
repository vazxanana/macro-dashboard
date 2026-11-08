// Old vs new chained tracker runs (bench.mjs): which runs differ in what the live desk sees, and every trade record that differs at the
// end. node benchdiff.mjs <old state dir> <new state dir> [out.json]
import fs from 'node:fs';
const [A, B, OUT] = process.argv.slice(2);
const rd = (d, f) => JSON.parse(fs.readFileSync(`${d}/${f}`, 'utf8'));
const da = rd(A, 'digest.json'), db = rd(B, 'digest.json');
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const runs = da.length, cmpRun = (f) => da.filter((x, i) => x[f] !== db[i][f]).length;
const firstDiff = (f) => { const i = da.findIndex((x, j) => x[f] !== db[j][f]); return i < 0 ? null : da[i].iso; };
const res = { runs, errors: { old: da.filter((x) => x.err).length, new: db.filter((x) => x.err).length }, from: da[0].iso, to: da.at(-1).iso,
  runsDiffering: { trades: cmpRun('trades'), snapshotWithoutRollFieldsAndPdhPdl: cmpRun('snapCore'), barsH1M5: cmpRun('h1m5'), barsD1: cmpRun('d1'), shadow: cmpRun('shadow') },
  firstDiff: { trades: firstDiff('trades'), snapCore: firstDiff('snapCore'), barsH1M5: firstDiff('h1m5') },
  switches: db.filter((x) => x.switched.length).map((x) => ({ run: x.iso, switched: x.switched, open: x.open })) };
const ta = new Map(rd(A, 'trades.json').map((x) => [x.id, x])), tb = new Map(rd(B, 'trades.json').map((x) => [x.id, x]));
const F = ['aset', 'size', 'status', 'R', 'exit', 'closed', 'entry', 'stop0'];
const rows = [];
for (const [id, x] of ta) { const y = tb.get(id); if (!y) { rows.push({ id, what: 'old only', aset: x.aset, R: x.R, signal: iso(x.signalAt), bias: x.feat.bias }); continue; }
  const d = F.filter((f) => JSON.stringify(x[f]) !== JSON.stringify(y[f])).map((f) => `${f} ${x[f]} -> ${y[f]}`);
  const fb = ['bias', 'pd', 'pdSweep', 'htfFvg', 'cc', 'atrR'].filter((f) => JSON.stringify(x.feat[f]) !== JSON.stringify(y.feat[f])).map((f) => `feat.${f}`);
  if (d.length || y.rolled) rows.push({ id, what: 'changed', aset: y.aset, signal: iso(x.signalAt), d, feat: fb, rolled: y.rolled || null }); else if (fb.length) rows.push({ id, what: 'features only', aset: y.aset, signal: iso(x.signalAt), feat: fb, biasOld: x.feat.bias, biasNew: y.feat.bias }); }
for (const [id, y] of tb) if (!ta.has(id)) rows.push({ id, what: 'new only', aset: y.aset, R: y.R, signal: iso(y.signalAt), bias: y.feat.bias, rolled: y.rolled || null });
rows.sort((p, q) => (p.signal < q.signal ? -1 : 1));
res.trades = { old: ta.size, new: tb.size, differing: rows.filter((r) => r.what !== 'features only').length, featuresOnly: rows.filter((r) => r.what === 'features only').length, rows: rows.filter((r) => r.what !== 'features only') };
const tot = (m) => { const C = [...m.values()].filter((x) => x.closed); const CA = C.filter((x) => x.aset); return { all: { n: C.length, R: +C.reduce((s, x) => s + x.R, 0).toFixed(2) }, A: { n: CA.length, R: +CA.reduce((s, x) => s + x.R, 0).toFixed(2) } }; };
res.totals = { old: tot(ta), new: tot(tb) };
console.log(JSON.stringify({ ...res, trades: { ...res.trades, rows: undefined } }, null, 1));
for (const r of res.trades.rows) console.log(JSON.stringify(r));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));

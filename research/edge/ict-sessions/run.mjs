// ICT sessions study (preregistration.md, committed before this ran): WHEN does the A-setup edge live? Four fixed partitions of the
// unchanged A-setup stream by the New York time of the signal candle's close: session (H1), first two cash hours (H2), weekday
// (H3), post-halt (H4). Selection on OANDA 2008-17 only (drop the cells with mean net R < 0 and n >= 100); the bar is judged on
// OANDA 2018-21 / 2022-26, HistData 2018-21 / 2022-26 and the live replay, each separately. Paper research only; no live code here.
//   node research/edge/ict-sessions/run.mjs <oanda trades.json (ict-oos-2008/run.mjs)> <histdata trades.json (ict-universe/universe.mjs)> <council-data ict/replay.json> [result.json]
import fs from 'node:fs';

const [OANDA, HIST, REPLAY, OUT = 'research/edge/ict-sessions/result.json'] = process.argv.slice(2);
if (!OANDA || !HIST || !REPLAY) { console.error('usage: run.mjs <oanda trades.json> <histdata trades.json> <replay.json> [result.json]'); process.exit(1); }

// the tracker's own New York clock (ict/tracker.mjs etHour / nyFriday use the same Intl formatter)
const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
const ny = (t) => { const o = {}; for (const p of ET.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { h: +o.hour % 24, wd: o.weekday }; };

// the four pre-registered partitions (cell of one trade from the New York hour h and weekday wd of its signal close)
const SESSION = (h) => (h >= 19 || h <= 2 ? 'Asia' : h <= 9 ? 'London' : h <= 12 ? 'NY AM' : 'NY PM');
export const HYP = {
  H1: { name: 'session of entry', cells: ['Asia', 'London', 'NY AM', 'NY PM'], cell: ({ h }) => SESSION(h) },
  H2: { name: 'first two cash hours (closes 10:00, 11:00 ET) vs rest', cells: ['first2', 'rest'], cell: ({ h }) => (h === 10 || h === 11 ? 'first2' : 'rest') },
  H3: { name: 'New York weekday', cells: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'], cell: ({ wd }) => wd },
  H4: { name: 'post-halt (closes 19:00, 20:00 ET) vs rest', cells: ['posthalt', 'rest'], cell: ({ h }) => (h === 19 || h === 20 ? 'posthalt' : 'rest') },
};

// ---- load the three trade sets (A-setups only), every row: { set, market, close, year, h, wd, net, net2, gross } (replay: net = the desk's R)
function rows(file, cols, pick) {
  const J = JSON.parse(fs.readFileSync(file, 'utf8')), C = J.cols || cols, out = [];
  for (const r of J.trades) { const t = Object.fromEntries(C.map((c, i) => [c, r[i]])); const o = pick(t); if (o) out.push(o); }
  return out;
}
const stamp = (o) => { const d = new Date(o.close * 1000); o.year = d.getUTCFullYear(); Object.assign(o, ny(o.close)); return o; };
const oanda = rows(OANDA, null, (t) => t.cfg === 'rule' && t.aset ? stamp({ set: 'oanda', market: t.market, close: t.close, closed: t.closed, size: t.size, net: t.size * (t.Rraw - t.costR), net2: t.size * (t.Rraw - 2 * t.costR), gross: t.size * t.Rraw }) : null);
const HM = { gc: 'gold', nas100: 'index', spx: 'index' };   // the desk's rule set for each HistData stand-in (ict-universe primary cells)
const hist = rows(HIST, null, (t) => HM[t.market] && t.cfg === HM[t.market] && t.aset ? stamp({ set: 'hist', market: t.market, close: t.close, closed: t.closed, size: t.size, net: t.size * (t.Rraw - t.costR), net2: t.size * (t.Rraw - 2 * t.costR), gross: t.size * t.Rraw }) : null);
const RJ = JSON.parse(fs.readFileSync(REPLAY, 'utf8'));
const replay = RJ.trades.filter((x) => x.aset && x.closed).map((x) => stamp({ set: 'replay', market: x.market, close: x.signalAt, closed: x.closed, size: x.size || 1, net: x.R, net2: x.R, gross: x.R }));

// ---- windows (by the year of the signal close for the halves; the selection window by UTC time of the close)
const W = {
  sel: { label: 'OANDA 2008-2017 (selection)', rows: oanda.filter((t) => t.close >= Date.UTC(2008, 0, 1) / 1000 && t.close < Date.UTC(2018, 0, 1) / 1000) },
  oa1: { label: 'OANDA 2018-2021', rows: oanda.filter((t) => t.year >= 2018 && t.year <= 2021) },
  oa2: { label: 'OANDA 2022-2026', rows: oanda.filter((t) => t.year >= 2022) },
  hd1: { label: 'HistData 2018-2021', rows: hist.filter((t) => t.year >= 2018 && t.year <= 2021) },
  hd2: { label: 'HistData 2022-2026', rows: hist.filter((t) => t.year >= 2022) },
  rep: { label: `live replay ${RJ.from} .. ${RJ.at.slice(0, 10)}`, rows: replay },
};
W.oa = { label: 'OANDA 2018-2026', rows: W.oa1.rows.concat(W.oa2.rows) };
W.hd = { label: 'HistData 2018-2026', rows: W.hd1.rows.concat(W.hd2.rows) };

export function stats(a, f = 'net') {
  a = [...a].sort((x, y) => (x.closed || x.close) - (y.closed || y.close));
  const r = a.map((x) => x[f]), n = r.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null, sd: null };
  const R = r.reduce((s, x) => s + x, 0), m = R / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +R.toFixed(1), maxDD: +dd.toFixed(1), streak: ws, t: sd > 0 && n > 1 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, sd: +sd.toFixed(3) };
}
const welch = (a, b) => { const A = stats(a), B = stats(b); if (A.n < 2 || B.n < 2) return null; return +((A.exp - B.exp) / Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n)).toFixed(2); };
const cellStats = (rowsIn, H) => Object.fromEntries(H.cells.map((c) => { const a = rowsIn.filter((t) => H.cell(t) === c); return [c, { net: stats(a), net2: stats(a, 'net2'), gross: stats(a, 'gross') }]; }));

const out = { topic: 'ict-sessions', built: new Date().toISOString().slice(0, 10), preregistered: 'preregistration.md (committed before this ran)', sets: {
  oanda: { file: 'ict-oos-2008/run.mjs output', aSetups: oanda.length, from: new Date(Math.min(...oanda.map((t) => t.close)) * 1000).toISOString().slice(0, 10), to: new Date(Math.max(...oanda.map((t) => t.close)) * 1000).toISOString().slice(0, 10) },
  hist: { file: 'ict-universe/universe.mjs output (gc gold-rule, nas100 + spx index-rule A-setups)', aSetups: hist.length },
  replay: { file: 'council-data ict/replay.json', at: RJ.at, from: RJ.from, closedASetups: replay.length, totalsA: RJ.totalsA } },
  windows: Object.fromEntries(Object.entries(W).map(([k, w]) => [k, { label: w.label, full: stats(w.rows), full2: stats(w.rows, 'net2') }])), hypotheses: {} };

const MK = ['gc', 'nq', 'es', 'ym', 'rty', 'nas100', 'spx'];
for (const [id, H] of Object.entries(HYP)) {
  const o = out.hypotheses[id] = { name: H.name, cells: Object.fromEntries(Object.entries(W).map(([k, w]) => [k, cellStats(w.rows, H)])) };
  // selection on 2008-17 only: drop the cells with mean net R < 0 and n >= 100
  const sel = o.cells.sel, D = H.cells.filter((c) => sel[c].net.n >= 100 && sel[c].net.exp < 0), K = H.cells.filter((c) => !D.includes(c));
  const full = out.windows.sel.full, dSel = stats(W.sel.rows.filter((t) => D.includes(H.cell(t))));
  o.selection = { dropped: D, kept: K, selFull: full, selDropped: dSel, selKept: stats(W.sel.rows.filter((t) => K.includes(H.cell(t)))), candidate: D.length > 0 && K.length > 0 && dSel.exp < full.exp };
  if (!o.selection.candidate) { o.verdict = { verdict: 'NO CANDIDATE', why: D.length === 0 ? 'no cell with mean net R < 0 and n >= 100 on 2008-17' : K.length === 0 ? 'every cell negative on 2008-17' : 'dropped cells not below the full stream on 2008-17' }; continue; }
  // the bar, judged once per window
  o.bar = {};
  for (const k of ['oa1', 'oa2', 'hd1', 'hd2', 'rep', 'oa', 'hd']) {
    const w = W[k], kr = w.rows.filter((t) => K.includes(H.cell(t))), dr = w.rows.filter((t) => D.includes(H.cell(t))), F = stats(w.rows), Ks = stats(kr), Ds = stats(dr);
    const b = o.bar[k] = { full: F, kept: Ks, dropped: Ds, kept2: stats(kr, 'net2'), dropped2: stats(dr, 'net2'), keptShare: F.n ? +(Ks.n / F.n).toFixed(3) : null, welch: welch(kr, dr),
      keptBeatsFull: Ks.n > 0 && F.n > 0 && Ks.exp > F.exp, droppedNonPositive: Ds.n >= 30 && Ds.exp <= 0, droppedN30: Ds.n >= 30 };
    b.pass = b.keptBeatsFull && b.droppedNonPositive;
    if (k === 'oa' || k === 'hd') b.markets = Object.fromEntries(MK.filter((m) => w.rows.some((t) => t.market === m)).map((m) => [m, { full: stats(w.rows.filter((t) => t.market === m)), kept: stats(kr.filter((t) => t.market === m)), dropped: stats(dr.filter((t) => t.market === m)) }]));
  }
  const parts = { oanda: o.bar.oa1.pass && o.bar.oa2.pass, hist: o.bar.hd1.pass && o.bar.hd2.pass, replay: o.bar.rep.pass, replayTooSmall: !o.bar.rep.droppedN30 };
  o.verdict = { verdict: parts.oanda && parts.hist && parts.replay ? 'PASS' : 'FAIL', ...parts };
}
out.passes = Object.entries(out.hypotheses).filter(([, h]) => h.verdict.verdict === 'PASS').map(([id]) => id);
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

// ---- tables for RESULT.md
const f = (s) => (s.n ? `${s.n} | ${(100 * s.wr).toFixed(0)}% | ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)} | ${s.R >= 0 ? '+' : ''}${s.R.toFixed(1)} | ${s.t ?? '-'}` : '0 | - | - | - | -');
console.log('sets', JSON.stringify(out.sets));
console.log('\nwindow | n | wr | exp | R | t || x2 exp');
for (const [k, w] of Object.entries(out.windows)) console.log(`${k} ${w.label} | ${f(w.full)} || ${w.full2.exp}`);
for (const [id, h] of Object.entries(out.hypotheses)) {
  console.log(`\n==== ${id} ${h.name}`);
  console.log('cell | ' + Object.keys(W).map((k) => `${k} n/exp/t`).join(' | '));
  for (const c of HYP[id].cells) console.log(`${c} | ` + Object.keys(W).map((k) => { const s = h.cells[k][c].net; return s.n ? `${s.n}/${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)}/${s.t}` : '0/-/-'; }).join(' | '));
  console.log('selection', JSON.stringify({ dropped: h.selection.dropped, kept: h.selection.kept, candidate: h.selection.candidate, selFull: h.selection.selFull.exp, selKept: h.selection.selKept.exp, selDropped: h.selection.selDropped.exp }));
  if (!h.bar) { console.log('verdict', JSON.stringify(h.verdict)); continue; }
  console.log('window | full n/exp | kept n/exp/t | dropped n/exp/t | kept share | welch | kept>full | dropped<=0 (n>=30) | pass');
  for (const [k, b] of Object.entries(h.bar)) console.log(`${k} | ${b.full.n}/${b.full.exp} | ${b.kept.n}/${b.kept.exp}/${b.kept.t} | ${b.dropped.n}/${b.dropped.exp}/${b.dropped.t} | ${b.keptShare} | ${b.welch} | ${b.keptBeatsFull} | ${b.droppedNonPositive}${b.droppedN30 ? '' : ' (n<30)'} | ${b.pass}`);
  for (const k of ['oa', 'hd']) console.log(`${k} markets: ` + Object.entries(h.bar[k].markets).map(([m, v]) => `${m} full ${v.full.n}/${v.full.exp} kept ${v.kept.n}/${v.kept.exp} dropped ${v.dropped.n}/${v.dropped.exp}`).join(' ; '));
  console.log('verdict', JSON.stringify(h.verdict));
}
console.log('\nPASSES', JSON.stringify(out.passes));

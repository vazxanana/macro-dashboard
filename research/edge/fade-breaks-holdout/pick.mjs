// research/edge/fade-breaks-holdout/pick.mjs - the selection step of PREREGISTRATION.md, run BEFORE the pre-registration was
// written: the grids' own code (imported, unchanged) on 2010-2019, the data the grids already read, to list every placebo
// cell that passed both halves. grid6-box-in-box's result.json already lists it (placebo rawList, sorted by 2015-19 t);
// grid6-dom-confirm and grid6-mosha-market publish only their Holm passes, so their accumulators are rebuilt here.
//   node --max-old-space-size=8000 pick.mjs dom <m> <dir>      grid6-dom-confirm runMarket -> <dir>/dom-<m>.json
//   node pick.mjs mosha <m> <dir>                              grid6-mosha-market runMarket -> <dir>/mosha-<m>.json
//   node pick.mjs list <dir>                                   pooled placebo cells that passed both halves -> picks.json
// Research only: reads the edgekit candle cache, writes <dir> and picks.json; places nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as DOM from '../grid6-dom-confirm/run.mjs';
import * as MOS from '../grid6-mosha-market/run.mjs';
import { frames as frames3 } from '../combo-grid-3/run.mjs';
import { mstat } from '../grid5-mosha-cycle/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const b64 = (a) => Buffer.from(a.buffer).toString('base64');
const unb = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
const MK = DOM.MARKETS;
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));

export function domList(all) {
  const sum = (k, T, len) => { const o = new T(len); for (const m of MK) { const a = all[m][k]; for (let i = 0; i < len; i++) o[i] += a[i]; } return o; };
  const pn = sum('pn', Uint32Array, DOM.NCELL * 2), pB = sum('pB', Float64Array, DOM.NCELL * DOM.NM), pC = sum('pC', Float64Array, DOM.NCELL * DOM.NM);
  const ok = (s) => s.n >= 100 && s.before > 0 && s.tBefore >= 2;
  const out = [];
  for (let c = 0; c < DOM.NCELL; c++) { const a = DOM.half(pn, pB, pC, c, 0), b = DOM.half(pn, pB, pC, c, 1);
    if (ok(a) && ok(b)) out.push({ cell: c, ...DOM.cellName(c), h2010: a, h2015: b }); }
  return out.sort((x, y) => y.h2015.tBefore - x.h2015.tBefore);
}
export function mosList(all) {
  const A = { n: new Uint32Array(MOS.NCELL * 2), g: new Float64Array(MOS.NCELL * MOS.NM), net: new Float64Array(MOS.NCELL * MOS.NM) };
  for (const m of MK) for (const k of ['n', 'g', 'net']) { const s = all[m][k]; for (let i = 0; i < s.length; i++) A[k][i] += s[i]; }
  const out = [], all10 = [];
  for (let c = 0; c < MOS.NCELL; c++) { const n1 = A.n[c * 2], n2 = A.n[c * 2 + 1];
    const a = mstat(A.g, c * MOS.NM, 0, MOS.SPLIT_M), b = mstat(A.g, c * MOS.NM, MOS.SPLIT_M, MOS.NM), w = mstat(A.g, c * MOS.NM, 0, MOS.NM);
    const bn = mstat(A.net, c * MOS.NM, MOS.SPLIT_M, MOS.NM);
    const row = { cell: c, ...MOS.cellName(c), n1014: n1, mean1014: n1 ? r4(a.sum / n1) : null, t1014: r2(a.t), n1519: n2, mean1519: n2 ? r4(b.sum / n2) : null, t1519: r2(b.t),
      net1519: n2 ? r4(bn.sum / n2) : null, n1019: n1 + n2, t1019: r2(w.t), _t2: b.t };
    if (n1 >= 100 && n2 >= 100 && a.sum > 0 && a.t >= 2 && b.sum > 0 && b.t >= 2) out.push(row);
    if (n1 + n2 >= 300) all10.push(row); }
  return { both: out.sort((x, y) => y._t2 - x._t2), byDecade: all10.sort((x, y) => y.t1019 - x.t1019).slice(0, 10) };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'dom') { fs.mkdirSync(b, { recursive: true });
    const M5 = K.load(a, '5m', { from: DOM.FROM - 400 * 86400, to: DOM.TO + 15 * 86400 }), F = frames3(M5);
    const o = DOM.runMarket(a, M5, F);
    fs.writeFileSync(path.join(b, `dom-${a}.json`), JSON.stringify({ trades: o.trades, pn: b64(o.acc.pn), pB: b64(o.acc.pB), pC: b64(o.acc.pC) }));
    console.log('dom', a, o.trades, 'trades'); }
  else if (cmd === 'mosha') { fs.mkdirSync(b, { recursive: true });
    const o = MOS.runMarket(a); const p = o.acc.plac;
    fs.writeFileSync(path.join(b, `mosha-${a}.json`), JSON.stringify({ trades: o.trades, n: b64(p.n), g: b64(p.g), net: b64(p.net) }));
    console.log('mosha', a, o.trades, 'trades'); }
  else if (cmd === 'list') {
    const dom = {}, mos = {};
    for (const m of MK) { const j = JSON.parse(fs.readFileSync(path.join(a, `dom-${m}.json`), 'utf8'));
      dom[m] = { pn: unb(j.pn, Uint32Array), pB: unb(j.pB, Float64Array), pC: unb(j.pC, Float64Array) };
      const q = JSON.parse(fs.readFileSync(path.join(a, `mosha-${m}.json`), 'utf8'));
      mos[m] = { n: unb(q.n, Uint32Array), g: unb(q.g, Float64Array), net: unb(q.net, Float64Array) }; }
    const box = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'grid6-box-in-box', 'result.json'), 'utf8')).placebo.rawList.filter((r) => r.scope === 'pool');
    const d = domList(dom), ms = mosList(mos);
    const out = { built: '2026-11-23', rule: 'pooled placebo cells with n >= 100, mean R > 0 and month t >= 2 before costs in 2010-14 AND in 2015-19; best by 2015-19 month t',
      box: { source: 'grid6-box-in-box/result.json placebo.rawList (pool)', count: box.length, top: box.slice(0, 5) },
      dom: { count: d.length, top: d.slice(0, 10) },
      mosha: { count: ms.both.length, top: ms.both.slice(0, 10).map(({ _t2, ...r }) => r), byDecade: ms.byDecade.map(({ _t2, ...r }) => r) } };
    fs.writeFileSync(path.join(HERE, 'picks.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ box: out.box.top[0], dom: out.dom.count, domTop: out.dom.top.slice(0, 3), mosha: out.mosha.count, moshaTop: out.mosha.top.slice(0, 3) }, null, 1)); }
}

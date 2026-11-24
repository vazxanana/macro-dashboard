// research/edge/fade-box-edge/discover.mjs - DISCOVERY step (before the pre-registration): every faded M5/M15 box close-out
// of grid6-box-in-box (chains H4-H1-M15 and H1-M15-M5, trigger 'out', any session) with its context at the decision and its
// result under several stops and exits, on data the fade has ALREADY been read on (2010-19 five markets, fade-breaks-holdout
// sets A, B, C). Nothing here is evidence: it only proposes the conditions that PREREGISTRATION.md then tests on unread data.
//   node --max-old-space-size=5000 discover.mjs <set> <m> <dir>      set: gate | A | B | C | D | E (D, E only after pre-registration)
// Research only: imports grid6-box-in-box (signals, trade, CAPS, LIFE), combo-grid-3 frames, combo-grid-2 COSTS / exclusions,
// edgekit; none edited. Places nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as BOX from '../grid6-box-in-box/run.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14 } from '../grid5-mosha-cycle/run.mjs';

const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const C_END = Date.UTC(2026, 10, 1) / 1000;
export const SETS = {
  gate: { markets: K.MARKETS, from: y(2010), to: y(2020) },
  A: { markets: K.MARKETS, from: y(2005), to: y(2010) },
  B: { markets: K.HOLDOUT_MARKETS, from: y(2010), to: y(2020) },
  C: { markets: K.MARKETS, from: y(2020), to: C_END },
  D: { markets: K.HOLDOUT_MARKETS, from: y(2005), to: y(2010) },   // unread: confirmation only
  E: { markets: K.HOLDOUT_MARKETS, from: y(2020), to: C_END },     // unread: confirmation only
};
export const CHS = [1, 2];          // BOX.CHAINS indices: H4-H1-M15, H1-M15-M5
export const KS = [1, 1.5, 2];      // stop distance x the box stop distance
const SEC = { '15m': 900, '5m': 300 };
const yearBefore = (t) => Date.UTC(new Date(t * 1000).getUTCFullYear() - 1, 0, 1) / 1000;
const er = (B, i, n) => { if (i < n) return null; let p = 0; for (let k = i - n + 1; k <= i; k++) p += Math.abs(B[k].c - B[k - 1].c); return p > 0 ? Math.abs(B[i].c - B[i - n].c) / p : 0; };

// features of one signal at its decision moment ts (closed candles only), for the FADE side s
export function features(F, sg, s, ctx) {
  const ts = sg.ts, out = {};
  for (const tf of ['1h', '4h', '1d']) { const n = K.closedCount(F[tf], ts); const side = n ? ctx.side[tf][n - 1] : 0; out['st' + tf] = side === s ? 1 : side === -s ? -1 : 0; }
  const nD = K.closedCount(F['1d'], ts), pd = nD ? F['1d'][nD - 1] : null;   // the last closed trading day
  out.pd = pd ? (sg.c0 > pd.h ? 1 : sg.c0 < pd.l ? -1 : 0) * -s : 0;         // +1: the close-out pushed past yesterday's extreme on the side the fade sells / buys from
  const nH = K.closedCount(F['1h'], ts); out.er = nH > 21 ? +er(F['1h'], nH - 1, 20).toFixed(3) : null;
  const B = F[BOX.CHAINS[sg.ch][2]], bi = sg.j; out.boxAtr = ctx.atr[sg.ch][bi] > 0 ? +((sg.box.hi - sg.box.lo) / ctx.atr[sg.ch][bi]).toFixed(2) : null;
  out.hour = new Date(ts * 1000).getUTCHours(); out.topPos = sg.topPos; out.midYes = sg.midYes; out.size = sg.size;
  void B; return out;
}

export function runMarket(set, market, dir) {
  const S = SETS[set], M5 = K.load(market, '5m', { from: yearBefore(S.from), to: S.to }); if (!M5.length) throw new Error('no candles ' + market);
  const F = frames(M5), cost = COSTS[market], X = exclusions(market), inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const ctx = { side: {}, atr: {} };
  for (const tf of ['1h', '4h', '1d']) ctx.side[tf] = K.structure(F[tf], 3).side;
  for (const ch of CHS) ctx.atr[ch] = atr14(F[BOX.CHAINS[ch][2]]);
  const rows = [];
  for (const sg of BOX.signals(F, { from: S.from, to: S.to })) {
    if (!CHS.includes(sg.ch) || sg.trig !== 0) continue;
    const d = sg.d, s = -d, buf = cost / 2, ts = sg.ts, cap = BOX.CAPS[sg.ch], exp = ts + BOX.LIFE * SEC[BOX.CHAINS[sg.ch][2]];
    const stop0 = d > 0 ? sg.box.lo - buf : sg.box.hi + buf;          // the grid's bottom-box stop for the real side
    const dist = d * (sg.c0 - stop0); if (!(dist >= 2 * cost)) continue; // the grid's 2-round-trip rule
    const mid = (sg.box.hi + sg.box.lo) / 2, f = features(F, sg, s, ctx), R = {};
    let t = null, risk0 = null;
    for (const k of KS) {
      const sp = sg.c0 + d * k * dist;                                   // the fade's stop, k x the grid's distance, beyond the close-out
      const midR = (s * (mid - sg.c0)) / (k * dist);                      // the box middle as a target, in R from the decision close
      const r = BOX.trade(M5, s, 'mkt', null, sp, ts, exp, midR > 0 ? midR : 2, cost, cap);
      if (!r || r.t < S.from || r.t >= S.to || inBad(r.t)) continue;
      if (k === 1) { t = r.t; risk0 = r.risk; }
      R['k' + k] = { cr: +(cost / r.risk).toFixed(5), r1: +r.R[0].toFixed(4), r2: +r.R[1].toFixed(4), tr: +r.R[3].toFixed(4), mid: midR > 0 ? +r.R[4].toFixed(4) : null };
    }
    if (t == null) continue;
    rows.push({ t, ch: sg.ch, s, rc: +(risk0 / cost).toFixed(2), ...f, R });
  }
  if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${set}.${market}.json`), JSON.stringify(rows)); }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [set, m, dir] = process.argv.slice(2);
  if ((set === 'D' || set === 'E') && !fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'PREREGISTRATION.md'))) throw new Error('sets D and E are read only after the pre-registration is committed');
  const t0 = Date.now(); const rows = runMarket(set, m, dir); console.log(set, m, rows.length, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

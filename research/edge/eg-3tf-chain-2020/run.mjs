// research/edge/eg-3tf-chain-2020/run.mjs - the three-timeframe engulf chain of PREREGISTRATION.md (23 Nov 2026).
// node research/edge/eg-3tf-chain-2020/run.mjs market <market> <outDir>   one market: the desk code's trades + the close-based cut
// node research/edge/eg-3tf-chain-2020/run.mjs report <outDir>            pool, apply the pre-registered bar, write result.json
// node research/edge/eg-3tf-chain-2020/run.mjs cut <market> <cutISO>      no-look-ahead check: trades before the cut must not change
// Research only: imports council/eg-methods.mjs (sopTrades3, zones; not edited), edgekit and combo-grid-2 (COSTS, exclusions,
// MONTHS, mstat). Writes only to <outDir> and this folder's result.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions, MONTHS, NM, IS_M, mstat } from '../combo-grid-2/run.mjs';
import { sopTrades3, zones, PIP } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS18 = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag', 'gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
// the desk code's own market list (assets/mosha-sop.js ALL); for the others it would size the buffer like gold ($0.30 in price units)
export const DESK_KNOWN = ['xau', 'xag', 'eurusd', 'gbpusd', 'nas100', 'usdjpy', 'audusd', 'usdcad', 'spx500', 'us30', 'de40'];
export const keyFor = (m) => (DESK_KNOWN.includes(m) ? m : 'eurusd');
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const CHAIN = { '1d': 'C1', '4h': 'C2', '1h': 'C3' };
export const TESTS = [['T1', 'C1', 'rr'], ['T2', 'C1', 'zone'], ['T3', 'C2', 'rr'], ['T4', 'C2', 'zone'], ['T5', 'C3', 'rr'], ['T6', 'C3', 'zone']];
const SEC = { '1d': 86400, '4h': 14400, '1h': 3600, '15m': 900, '5m': 300 };
const ENGULF_TF = { C1: '4h', C2: '1h', C3: '15m' };
export const pipOf = (m) => PIP[m] || (/jpy$/.test(m) ? 0.01 : 0.0001);
const toDesk = (a) => a.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
const lower = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].t < t) lo = m + 1; else hi = m; } return lo; };

export function framesOf(market, { from = '2019-01-01', to } = {}) {
  const M5 = K.load(market, '5m', { from, to }), D1 = K.load(market, '1d', { from, to });
  return { M5, B: { '5m': toDesk(M5), '15m': toDesk(K.resample(M5, 900)), '1h': toDesk(K.resample(M5, 3600)), '4h': toDesk(K.resample(M5, 14400)), '1d': toDesk(D1) } };
}

// One trade of the desk code, run again on 5m candles with the close-based cut on the confirmation timeframe.
// Inside each 5m candle: a gap past the stop exits at the open (not on the fill candle), then the stop, then the target (not on the
// fill candle), then, if this 5m candle is the last of its confirmation candle, the cut on that close.
export function withCut(M5, tr) {
  const d = tr.side, entry = tr.entry, stop = tr.stop, target = tr.target, r0 = Math.abs(entry - stop), cz = tr.marks[2], sec = SEC[tr.l];
  const far = d > 0 ? cz.bot : cz.top, fi = lower(M5, tr.t); if (fi >= M5.length || M5[fi].t !== tr.t) return null;
  for (let k = fi; k < M5.length; k++) { const b = M5[k];
    if (k > fi && (d > 0 ? b.o <= stop : b.o >= stop)) return { R: d * (b.o - entry) / r0, how: 'stop', endT: b.t };
    if (d > 0 ? b.l <= stop : b.h >= stop) return { R: d * (stop - entry) / r0, how: 'stop', endT: b.t };
    if (k > fi && (d > 0 ? b.h >= target : b.l <= target)) return { R: d * (target - entry) / r0, how: 'target', endT: b.t };
    const last = k + 1 >= M5.length || Math.floor(M5[k + 1].t / sec) !== Math.floor(b.t / sec);
    if (last && k + 1 < M5.length && (d > 0 ? b.c < far : b.c > far)) return { R: d * (b.c - entry) / r0, how: 'cut', endT: b.e };
  }
  return null; // still open at the last candle
}

export function runMarket(market, opts = {}) {
  const { M5, B } = framesOf(market, opts), cost = COSTS[market], X = exclusions(market), pip = pipOf(market);
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const Zet = {}; for (const [c, tf] of Object.entries(ENGULF_TF)) Zet[c] = zones(B[tf], tf);
  const rows = []; let dropped = 0, open = 0;
  for (const target of ['rr', 'zone']) {
    const T = sopTrades3(B, { market: keyFor(market), target });
    for (const tr of T) { const ch = CHAIN[tr.h]; if (tr.t < START) continue;
      if (X.length && inBad(tr.t)) { dropped++; continue; }
      const r0 = Math.abs(tr.entry - tr.stop); if (!(r0 > 0) || (tr.side > 0 ? tr.stop >= tr.entry : tr.stop <= tr.entry)) throw new Error('stop not on the losing side ' + tr.id);
      const cut = withCut(M5, tr); if (!cut) { open++; continue; }
      const row = { m: market, ch, tg: target, side: tr.side, t: tr.t, r0: +r0.toPrecision(6), tgtR: +(Math.abs(tr.target - tr.entry) / r0).toFixed(3),
        R: +cut.R.toFixed(4), cr: +(cost / r0).toFixed(5), how: cut.how, endT: cut.endT,
        deskR: tr.status === 'target' || tr.status === 'stopped' ? +tr.R.toFixed(4) : null, pip30: r0 <= 30 * pip + 1e-12 };
      if (target === 'zone') { // the nearest opposite engulf-timeframe zone at the order, any distance (the owner's notes skip one under 2R)
        const Kt = +String(tr.id).match(/[bs](\d+)$/)[1], d = tr.side; let near = null;
        for (const o of Zet[ch]) if (o.dir === -d && o.at <= Kt && o.end > Kt) { const p = d > 0 ? o.bot : o.top; if ((p - tr.entry) * d > 0 && (near == null || (p - tr.entry) * d < (near - tr.entry) * d)) near = p; }
        row.rb = near == null ? null : +(Math.abs(near - tr.entry) / r0).toFixed(3); }
      rows.push(row); } }
  return { market, rows, dropped, open, excluded: X.length, last: new Date(M5[M5.length - 1].t * 1000).toISOString() };
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------
const mIdx = (t) => { let lo = 0, hi = NM; while (lo < hi) { const m = (lo + hi) >> 1; if (MONTHS[m] <= t) lo = m + 1; else hi = m; } return lo - 1; };
export function summarize(rows, key = (r) => r.R - r.cr) {
  const ms = new Float64Array(NM); let nI = 0, nO = 0, sI = 0, sO = 0, s2O = 0, s2I = 0, gO = 0, gI = 0, wO = 0;
  for (const r of rows) { const m = mIdx(r.t); if (m < 0) continue; const v = key(r); ms[m] += v;
    if (r.t < SPLIT) { nI++; sI += v; s2I += r.R - 2 * r.cr; gI += r.R; } else { nO++; sO += v; s2O += r.R - 2 * r.cr; gO += r.R; if (v > 0) wO++; } }
  const a = mstat(ms, 0, IS_M), b = mstat(ms, IS_M, NM), f = (x, d = 4) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));
  return { disc: { n: nI, mean: nI ? f(sI / nI) : null, t: f(a.t, 2), x2: nI ? f(s2I / nI) : null, gross: nI ? f(gI / nI) : null },
    conf: { n: nO, mean: nO ? f(sO / nO) : null, t: f(b.t, 2), x2: nO ? f(s2O / nO) : null, gross: nO ? f(gO / nO) : null, win: nO ? f(wO / nO, 3) : null } };
}
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function judge(s, holmP) {
  const D = s.disc, C = s.conf;
  if (D.n >= 100 && C.n >= 50 && D.mean > 0 && D.t >= 2 && C.mean > 0 && C.t >= 2 && holmP < 0.05 && C.x2 > 0) return 'PASS';
  if (!(D.mean > 0) || !(C.mean > 0) || !(C.x2 > 0)) return 'FAIL';
  return 'INCONCLUSIVE';
}

export function report(dir) {
  const per = MARKETS18.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const all = per.flatMap((p) => p.rows);
  const tests = TESTS.map(([id, ch, tg]) => { const rs = all.filter((r) => r.ch === ch && r.tg === tg); const s = summarize(rs);
    const desk = summarize(rs.filter((r) => r.deskR != null), (r) => r.deskR - r.cr);
    const cutShare = rs.length ? +(rs.filter((r) => r.how === 'cut').length / rs.length).toFixed(3) : null;
    const side = { buy: summarize(rs.filter((r) => r.side > 0)).conf, sell: summarize(rs.filter((r) => r.side < 0)).conf };
    const markets = Object.fromEntries(MARKETS18.map((m) => { const q = summarize(rs.filter((r) => r.m === m)); return [m, { dn: q.disc.n, dmean: q.disc.mean, dt: q.disc.t, cn: q.conf.n, cmean: q.conf.mean, ct: q.conf.t }]; }));
    const byYear = {}; for (const r of rs) { const y = new Date(r.t * 1000).getUTCFullYear(); const o = (byYear[y] ||= { n: 0, R: 0 }); o.n++; o.R += r.R - r.cr; }
    for (const y of Object.keys(byYear)) byYear[y] = { n: byYear[y].n, mean: +(byYear[y].R / byYear[y].n).toFixed(4) };
    const pip30 = summarize(rs.filter((r) => r.pip30)); const pip30Share = rs.length ? +(rs.filter((r) => r.pip30).length / rs.length).toFixed(3) : null;
    const extra = { cutShare, desk: desk.conf, deskDisc: desk.disc, side, byYear, pip30Share, pip30: pip30.conf, medianRisk: null };
    if (tg === 'zone') { const fb = rs.filter((r) => Math.abs(r.tgtR - 2) < 1e-9).length; extra.fallback2R = rs.length ? +(fb / rs.length).toFixed(3) : null;
      const rb2 = summarize(rs.filter((r) => r.rb != null && r.rb >= 2)); extra.roadblock2R = { disc: rb2.disc, conf: rb2.conf }; }
    return { id, chain: ch, target: tg === 'rr' ? '2R' : 'roadblock', ...s, pOne: +p1(s.conf.t, NM - IS_M - 1).toPrecision(4), markets, extra }; });
  const adj = K.holm(tests.map((t) => t.pOne)); tests.forEach((t, i) => { t.holm = +adj[i].toPrecision(4); t.verdict = judge(t, adj[i]); });
  const verdict = tests.some((t) => t.verdict === 'PASS') ? 'PASS' : tests.every((t) => t.verdict === 'FAIL') ? 'FAIL' : 'INCONCLUSIVE';
  const best = [...tests].sort((a, b) => b.conf.t - a.conf.t)[0];
  const headline = `${tests.filter((t) => t.verdict === 'PASS').length} of 6 pass; best confirmation ${best.id} (${best.chain} ${best.target}) ${best.conf.mean >= 0 ? '+' : ''}${best.conf.mean.toFixed(3)}R a trade after costs (n ${best.conf.n}, month t ${best.conf.t}).`;
  const out = { topic: 'eg-3tf-chain-2020', title: 'The three-timeframe engulf chain, 2020 to now', built: new Date().toISOString().slice(0, 10), verdict, headline,
    window: { from: '2020-01-01', split: '2024-01-01', last: per.map((p) => p.last).sort()[0] + ' .. ' + per.map((p) => p.last).sort().at(-1) },
    markets: MARKETS18, stopBufferKey: Object.fromEntries(MARKETS18.filter((m) => keyFor(m) !== m).map((m) => [m, keyFor(m)])),
    counts: Object.fromEntries(per.map((p) => [p.market, { rows: p.rows.length, dropped: p.dropped, open: p.open, excluded: p.excluded }])), tests };
  return out;
}

// ---- no look-ahead: the trades that ended before a cut are the same with the later candles removed ------------------------
export function cutCheck(market, cutISO) {
  const cut = Math.floor(Date.parse(cutISO) / 1000), from = '2019-01-01';
  const full = framesOf(market, { from }), part = framesOf(market, { from, to: cutISO });
  const res = {};
  for (const target of ['rr', 'zone']) {
    const key = (tr) => [tr.id, tr.t, tr.entry, tr.stop, tr.target].join('|');
    const A = sopTrades3(full.B, { market: keyFor(market), target }).filter((tr) => tr.endT != null && tr.endT + 300 <= cut);
    const P = sopTrades3(part.B, { market: keyFor(market), target }).filter((tr) => tr.endT != null && tr.endT + 300 <= cut);
    const ka = new Set(A.map(key)), kp = new Set(P.map(key)); let cutSame = 0, cutDiff = 0;
    for (const tr of A) { const a = withCut(full.M5, tr), b = withCut(part.M5, tr); if (a && a.endT + 300 <= cut) { if (b && b.R === a.R && b.endT === a.endT) cutSame++; else cutDiff++; } }
    res[target] = { before: A.length, missingInCut: A.filter((x) => !kp.has(key(x))).length, extraInCut: P.filter((x) => !ka.has(key(x))).length, cutSame, cutDiff };
  }
  return { market, cut: cutISO, ...res };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(out));
    console.log(a, out.rows.length, 'trades', out.open, 'open', out.dropped, 'dropped', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const R = report(a); const prev = fs.existsSync(path.join(HERE, 'result.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'result.json'), 'utf8')) : {};
    if (prev.cutCheck) R.cutCheck = prev.cutCheck; fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1)); console.log(R.verdict, R.headline);
    for (const t of R.tests) console.log(t.id, t.chain, t.target, JSON.stringify(t.disc), JSON.stringify(t.conf), 'holm', t.holm, t.verdict); }
  else if (cmd === 'cut') { console.log(JSON.stringify(cutCheck(a, b))); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | cut <m> <ISO>');
}

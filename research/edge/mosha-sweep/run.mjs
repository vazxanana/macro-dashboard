// Edge research · mosha-sweep: the reading the owner's own example trades point to (10 Nov 2026, "Test both"): a prior H1 swing is
// swept, the M5 VR forms (from the extreme to the last M5 swing before it), the M5 CF is a close out of it, and the trade is taken
// either AT the CF (stop past the extreme) or on the return to the zone of the next M5 break (tight stop). Target: the next
// H4 zone or H4 swing. Rule, both entries and the verdict: PREREGISTRATION.md (committed before this file read the
// test candles). Data: OANDA spot gold M5 from mid-2006 through the council's keyless proxy; 2006-19 is untouched by the day's
// other Mosha tests. Paper research only: nothing here trades or changes a live rule.
//   node run.mjs fetch <dir>                    -> <dir>/xau-5m.json.gz (kept out of git)
//   CANDLES=<dir> node run.mjs run              -> result.json (+ trades when OUT_DIR is set)
//   node run.mjs example                        -> the detector on the last weeks (does it find the owner's own trades?)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { K as K0, swings, h4Context, simulate, stat } from '../mosha-level/run.mjs';

export const K = { WH: 2, W5: 1, BASE: 3, PAD: 0.30, LEVEL_AGE: 10 * 86400, ZONE_AGE: 30 * 86400, EPISODE: 12 * 3600, STAGE2: 24 * 3600, MIN_R0: 1.0, MIN_RR: 2, COST: K0.COST,
  H4: 14400, H1: 3600, M5: 300, DATA_FROM: Date.UTC(2006, 5, 1) / 1000, FROM: Date.UTC(2006, 6, 1) / 1000, SPLIT: Date.UTC(2020, 0, 1) / 1000 };
export const ENTRIES = { CF: 'at the CF, stop past the extreme', ZONE: 'return to the zone of the next break, stop past the zone' };

export const agg = (B, sec) => { const out = []; for (const b of B) { const k = Math.floor(b.time / sec) * sec, c = out.at(-1); if (!c || c.time !== k) out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { if (b.high > c.high) c.high = b.high; if (b.low < c.low) c.low = b.low; c.close = b.close; } } return out; };
const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };

// H1 swing levels (WH a side) with the time they come to exist and the time an H1 close goes through them
export function h1Levels(H1) {
  const { hi, lo } = swings(H1, K.WH), L = [];
  for (let j = 0; j + K.WH < H1.length; j++) { const born = H1[j + K.WH].time + K.H1; if (hi[j]) L.push({ side: -1, p: H1[j].high, at: H1[j].time, born }); if (lo[j]) L.push({ side: 1, p: H1[j].low, at: H1[j].time, born }); }
  for (const l of L) { l.dead = Infinity; for (let i = lowerT(H1, l.born); i < H1.length && H1[i].time + K.H1 - l.born <= K.LEVEL_AGE; i++) if (l.side < 0 ? H1[i].close > l.p : H1[i].close < l.p) { l.dead = H1[i].time + K.H1; break; } }
  return L.sort((a, b) => a.born - b.born);
}
// a market order from its placement (entry already filled), on the candles F: stop first, a gap through the stop exits at the open
export function simMarket(F, o) {
  const s = o.side, n = F.length; let k = lowerT(F, o.placed);
  const done = (t, px, exit) => { const R = (s * (px - o.entry)) / o.r0; return { status: 'closed', filled: o.placed, closed: t, exitPx: +px.toFixed(3), exit, R: +R.toFixed(4), net: +(R - K.COST / o.r0).toFixed(4), net2: +(R - 2 * K.COST / o.r0).toFixed(4) }; };
  for (; k < n; k++) { const b = F[k];
    if (s < 0 ? b.open >= o.stop : b.open <= o.stop) return done(b.time, b.open, 'stop (gap)');
    if (s < 0 ? b.high >= o.stop : b.low <= o.stop) return done(b.time, o.stop, 'stop');
    if (s < 0 ? b.low <= o.target : b.high >= o.target) return done(b.time, o.target, 'target');
    if (b.time >= o.placed + K0.HOLD) return done(b.time, b.close, 'time'); }
  return done(F[n - 1].time, F[n - 1].close, 'end (marked)');
}

// the detector. M5: candles oldest first. Returns the candidate orders of both entries (before the one-at-a-time rule) and the funnel.
export function detect(M5) {
  const n = M5.length, H1 = agg(M5, K.H1), H4 = agg(M5, K.H4), levels = h1Levels(H1), { zones, levels: h4L } = h4Context(H4), { hi, lo } = swings(M5, K.W5);
  for (const l of h4L) { l.dead = Infinity; for (let i = lowerT(H4, l.born); i < H4.length && H4[i].time + K.H4 - l.born <= K.ZONE_AGE; i++) if (l.side < 0 ? H4[i].close > l.p : H4[i].close < l.p) { l.dead = H4[i].time + K.H4; break; } }
  for (const z of zones) { z.dead = Infinity; for (let i = lowerT(H4, z.born); i < H4.length && H4[i].time + K.H4 - z.born <= K.ZONE_AGE; i++) if (z.side > 0 ? H4[i].close < z.bot : H4[i].close > z.top) { z.dead = H4[i].time + K.H4; break; } }
  // the most recent M5 swing that existed when candle i opened
  const lastLo = new Int32Array(n).fill(-1), lastHi = new Int32Array(n).fill(-1);
  for (let i = 1; i < n; i++) { const j = i - K.W5 - 1; lastLo[i] = j >= 0 && lo[j] ? j : lastLo[i - 1]; lastHi[i] = j >= 0 && hi[j] ? j : lastHi[i - 1]; }
  // target: the nearest live H4 engulf zone edge or live H4 swing (3 a side) on the far side, at least MIN_RR x r0 away
  const lv = { '1': h4L.filter((l) => l.side === 1), '-1': h4L.filter((l) => l.side === -1) };
  const targetOf = (s, entry, r0, now) => {
    let best = null; const need = K.MIN_RR * r0, take = (px) => { if (s * (px - entry) >= need && (best == null || (s < 0 ? px > best : px < best))) best = px; };
    for (let z = zones.length - 1; z >= 0; z--) { const Z = zones[z]; if (Z.born > now) continue; if (now - Z.born > K.ZONE_AGE) break; if (Z.dead <= now || Z.side !== -s) continue; take(s < 0 ? Z.top : Z.bot); }
    const A = lv[String(-s)]; for (let q = A.length - 1; q >= 0; q--) { const l = A[q]; if (l.born > now) continue; if (now - l.born > K.ZONE_AGE) break; if (l.dead <= now) continue; take(l.p); }
    return best;
  };
  const funnel = { levels: 0, sweeps: 0, cf: 0, CF: { small: 0, noTarget: 0, cand: 0 }, ZONE: { breaks: 0, small: 0, noTarget: 0, cand: 0 } }, cand = { CF: [], ZONE: [] }, live = [];
  const order = (kind, L, E, i, entry, stop) => {
    const s = L.side, now = M5[i].time + K.M5, r0 = Math.abs(stop - entry), F = funnel[kind];
    if (!(r0 >= K.MIN_R0) || (s < 0 ? stop <= entry : stop >= entry)) { F.small++; return; }
    const target = targetOf(s, entry, r0, now); if (target == null) { F.noTarget++; return; }
    F.cand++; cand[kind].push({ id: `xau-ms-${kind.toLowerCase()}-${s < 0 ? 's' : 'b'}-${now}`, kind, side: s, level: +L.p.toFixed(3), levelAt: L.at, sweep: M5[E.startI].time, ext: +E.ext.toFixed(3), v: +E.v.toFixed(3), cfAt: M5[E.cI].time + K.M5,
      placed: now, entry: +entry.toFixed(3), stop: +stop.toFixed(3), target: +target.toFixed(3), r0: +r0.toFixed(3), rr: +(Math.abs(target - entry) / r0).toFixed(2) });
  };
  let li = 0;
  for (let i = 0; i < n; i++) {
    const b = M5[i], t = b.time;
    for (; li < levels.length && levels[li].born <= t; li++) { live.push({ ...levels[li], ep: null }); funnel.levels++; }
    for (let q = live.length - 1; q >= 0; q--) {
      const L = live[q], s = L.side, E = L.ep;
      if (!E) {
        if (L.retired || L.dead <= t || t - L.born > K.LEVEL_AGE) { live.splice(q, 1); continue; }
        if (s < 0 ? b.high > L.p : b.low < L.p) { const j = s < 0 ? lastLo[i] : lastHi[i]; if (j < 0) continue;
          L.ep = { stage: 1, startI: i, startT: t, ext: s < 0 ? b.high : b.low, extI: i, v: s < 0 ? M5[j].low : M5[j].high }; funnel.sweeps++; }
        continue;
      }
      if (E.stage === 1) {
        if (t - E.startT > K.EPISODE) { L.ep = null; continue; }
        if (s < 0 ? b.high > E.ext : b.low < E.ext) { const j = s < 0 ? lastLo[i] : lastHi[i]; E.ext = s < 0 ? b.high : b.low; E.extI = i; if (j >= 0) E.v = s < 0 ? M5[j].low : M5[j].high; continue; }
        if (s < 0 ? b.close < E.v : b.close > E.v) {   // the CF: a close out of the VR
          E.stage = 2; E.cI = i; E.cT = t; funnel.cf++; L.retired = true;
          order('CF', L, E, i, b.close, +(E.ext - s * K.PAD).toFixed(3));
        }
        continue;
      }
      // stage 2: the next M5 swing after the CF, broken by a close; limit at it, stop past the break candle's base
      if ((s < 0 ? b.high > E.ext : b.low < E.ext) || t - E.cT > K.STAGE2) { live.splice(q, 1); continue; }
      if (E.v2 == null) { const j = i - K.W5; if (j >= E.cI && (s < 0 ? lo[j] : hi[j])) { E.v2 = s < 0 ? M5[j].low : M5[j].high; } continue; }
      if (s < 0 ? b.close < E.v2 : b.close > E.v2) {
        let edge = s < 0 ? -Infinity : Infinity; for (let k = Math.max(0, i - K.BASE); k <= i; k++) edge = s < 0 ? Math.max(edge, M5[k].high) : Math.min(edge, M5[k].low);
        funnel.ZONE.breaks++; order('ZONE', L, E, i, E.v2, +(edge - s * K.PAD).toFixed(3)); live.splice(q, 1);
      }
    }
  }
  return { cand, funnel };
}
// one order or position at a time, per entry style
export function book(M5, cand) {
  const out = {};
  for (const kind of Object.keys(cand)) { let busyUntil = -Infinity, busy = 0; const orders = [];
    for (const c of [...cand[kind]].sort((a, b) => a.placed - b.placed)) { if (c.placed < busyUntil) { busy++; continue; } const o = { ...c, ...(kind === 'CF' ? simMarket(M5, c) : simulate(M5, c)) }; orders.push(o); busyUntil = o.closed; }
    out[kind] = { orders, busy }; }
  return out;
}

// ─── statistics: window A = 2006-07 to 2019 (untouched by the day's other tests), window B = 2020 to the end of the file ───
const pOf = (t) => { const x = t / Math.SQRT2, a = 1 / (1 + 0.3275911 * Math.abs(x)), e = 1 - (((((1.061405429 * a - 1.453152027) * a) + 1.421413741) * a - 0.284496736) * a + 0.254829592) * a * Math.exp(-x * x); return +(0.5 * (1 - Math.sign(x) * e)).toFixed(4); };
export function summarize(orders, end) {
  const inWin = orders.filter((o) => o.placed >= K.FROM && o.placed < end), tr = inWin.filter((o) => o.status === 'closed' && o.exit !== 'end (marked)').sort((a, b) => a.closed - b.closed || a.placed - b.placed);
  const net = (l) => l.map((o) => o.net), A = tr.filter((o) => o.placed < K.SPLIT), B = tr.filter((o) => o.placed >= K.SPLIT), years = {};
  for (const o of tr) (years[new Date(o.placed * 1000).getUTCFullYear()] ||= []).push(o.net);
  const exits = {}; for (const o of tr) { const k = o.exit.replace(' (gap)', ''); exits[k] = (exits[k] || 0) + 1; }
  const med = (a) => (a.length ? +[...a].sort((x, y) => x - y)[a.length >> 1].toFixed(2) : null), all = stat(net(tr));
  return { orders: inWin.length, filled: tr.length, missed: inWin.filter((o) => o.status === 'missed').length, expired: inWin.filter((o) => o.status === 'expired').length,
    all, p: pOf(all.t), x2: stat(tr.map((o) => o.net2)), gross: stat(tr.map((o) => o.R)), a: stat(net(A)), b: stat(net(B)),
    years: Object.fromEntries(Object.entries(years).map(([y, l]) => [y, stat(l)])), sells: stat(net(tr.filter((o) => o.side < 0))), buys: stat(net(tr.filter((o) => o.side > 0))),
    exits, medianR0: med(tr.map((o) => o.r0)), medianRR: med(tr.map((o) => o.rr)) };
}
export function verdictOf(S) {
  const by = Object.entries(S.years).filter(([y]) => +y >= 2020), pos = by.filter(([, s]) => s.total > 0).length;
  const tests = { '30 or more trades in each window': S.a.n >= 30 && S.b.n >= 30, 'mean net R > 0 on 2006-19 (untouched)': S.a.n > 0 && S.a.avg > 0, 'mean net R > 0 on 2020 to now': S.b.n > 0 && S.b.avg > 0,
    'two thirds of the years from 2020 positive': by.length > 0 && pos / by.length >= 2 / 3, 'Holm-adjusted p under 0.05': S.pHolm != null && S.pHolm < 0.05, 'mean net R > 0 at twice the cost': S.x2.n > 0 && S.x2.avg > 0 };
  const fail = !(S.all.n > 0 && S.all.avg > 0) || !(S.a.n > 0 && S.a.avg > 0);
  return { verdict: Object.values(tests).every(Boolean) ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE', tests };
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => (t == null ? '-' : new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' '));
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function range(a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) { const b = Math.min(b0, a + 4999 * K.M5); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=xau&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`xau 5m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(80); }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
if (MODE === 'fetch') {
  const OUT = process.argv[3], f = path.join(OUT, 'xau-5m.json.gz'); fs.mkdirSync(OUT, { recursive: true });
  const end = Math.floor(Date.now() / 1000 / 86400) * 86400, rows = await range(K.DATA_FROM, end);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(`5m: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`);
}
if (MODE === 'example') {
  const now = Math.floor(Date.now() / 1000), M5 = toBars(await range(now - 21 * 86400, now));
  console.log(`OANDA M5 ${iso(M5[0].time)} → ${iso(M5.at(-1).time)}, H1 swing ${K.WH} a side`);
  const { cand, funnel } = detect(M5), bk = book(M5, cand); console.log(JSON.stringify(funnel));
  for (const kind of Object.keys(bk)) { console.log(`\n${kind} (${ENTRIES[kind]}): ${bk[kind].orders.length} orders, ${bk[kind].busy} dropped as busy`);
    for (const o of cand[kind]) { const d = bk[kind].orders.find((x) => x.id === o.id); console.log(`  ${iso(o.placed)} ${o.side < 0 ? 'SELL' : 'BUY '} level ${o.level} swept ${iso(o.sweep)} ext ${o.ext} VR to ${o.v} | entry ${o.entry} stop ${o.stop} target ${o.target} (${o.rr}R)${d ? ` → ${d.status}${d.exit ? ' ' + d.exit : ''} ${d.net != null ? d.net + 'R' : ''}` : ' (busy)'}`); } }
}
if (MODE === 'run') {
  const M5 = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-5m.json.gz'))))), end = M5.at(-1).time + K.M5;
  console.error(`M5 ${M5.length} (${iso(M5[0].time)} → ${iso(M5.at(-1).time)})`);
  const { cand, funnel } = detect(M5), bk = book(M5, cand);
  const out = { topic: 'mosha-sweep', built: '2026-11-10', at: new Date().toISOString(), system: 'Mosha sweep, VR and CF (a swept H1 swing, the M5 VR, the M5 CF; entry at the CF or at the zone of the next break; target the next H4 zone or H4 swing), spot gold OANDA M5',
    window: { a: '2006-07-01 to 2019-12-31 (untouched by the day\'s other tests)', b: `2020-01-01 to ${iso(end).slice(0, 10)}` }, params: { ...K, VALID: K0.VALID, HOLD: K0.HOLD }, candles: { m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) }, funnel, entries: {} };
  for (const kind of Object.keys(bk)) out.entries[kind] = { rule: ENTRIES[kind], busy: bk[kind].busy, ...summarize(bk[kind].orders, end) };
  const ps = Object.keys(out.entries).map((k) => [k, out.entries[k].p]).sort((x, y) => x[1] - y[1]); let top = 0;
  ps.forEach(([k, p], i) => { top = Math.max(top, Math.min(1, p * (ps.length - i))); out.entries[k].pHolm = +top.toFixed(4); });
  const sg = (x) => `${x >= 0 ? '+' : ''}${x}`; out.primary = {}; out.variantsTried = 2;
  for (const k of Object.keys(out.entries)) { out.primary[k] = verdictOf(out.entries[k]); const S = out.entries[k]; console.error(k, JSON.stringify(S.all), 'A', JSON.stringify(S.a), 'B', JSON.stringify(S.b), out.primary[k].verdict); }
  const worst = Object.values(out.primary).some((v) => v.verdict === 'PASS') ? 'PASS' : Object.values(out.primary).every((v) => v.verdict === 'FAIL') ? 'FAIL' : 'INCONCLUSIVE';
  out.verdict = `${worst}: ` + Object.keys(out.entries).map((k) => { const S = out.entries[k]; return `${k === 'CF' ? 'entry at the CF' : 'entry at the zone'} ${out.primary[k].verdict} (${sg(S.all.avg)}R a trade over ${S.all.n} trades, t ${S.all.t}; 2006-19 ${sg(S.a.avg)}R, 2020 on ${sg(S.b.avg)}R)`; }).join('; ');
  out.candidates = Object.keys(out.entries).map((k) => ({ rule: `${k}: ${ENTRIES[k]}`, verdict: out.primary[k].verdict, is: out.entries[k].a, oos: out.entries[k].b, years: out.entries[k].years }));
  const best = Object.keys(out.entries).sort((x, y) => out.entries[y].all.t - out.entries[x].all.t)[0];
  out.trades = bk[best].orders.filter((o) => o.status === 'closed' && o.exit !== 'end (marked)' && o.placed >= K.FROM).sort((x, y) => x.closed - y.closed).map((o) => ({ d: new Date(o.closed * 1000).toISOString().slice(0, 10), side: o.side < 0 ? 'sell' : 'buy', R: o.net })); out.tradesOf = best;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  if (process.env.OUT_DIR) { fs.mkdirSync(process.env.OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.OUT_DIR, 'trades-sweep.json'), JSON.stringify(Object.fromEntries(Object.keys(bk).map((k) => [k, bk[k].orders])))); }
  console.error(out.verdict);
}

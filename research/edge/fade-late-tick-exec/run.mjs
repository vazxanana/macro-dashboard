// Edge research · fade-late-tick-exec: the Break fade (grid7-wide-fade m15 none atr 2R all) on breaks whose candle starts at
// 20, 21 or 22 UTC, filled at the demo broker's own bid / ask ticks with EXACT levels in two passes (PREREGISTRATION.md).
// Paper research only; imports, never edits, the rule's code.
//   node run.mjs marks                      -> orders-<SYM>.json, marks-entry.json, marks-dead.json (pass 1)
//   node run.mjs queries <probe dir>        -> fills-<k>.json from the entry quotes (pass 2)
//   node run.mjs report <probe dir> [commit] -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { signals, exits, CAP } from '../grid7-wide-fade/run.mjs';
import { midTrace, spans } from '../fade-tick-exec/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = Date.UTC(2023, 11, 1) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
export const MARKETS = { XAUUSD: 'xau', USDJPY: 'usdjpy' };
export const W = { XAUUSD: 0.5, USDJPY: 0.05 };
export const COMM = { XAUUSD: 0.000024, USDJPY: 0.0000225 };
export const HOURS = [20, 21, 22], PRIMARY = [20, 21], CAPS = CAP['15m'];
export const ENTRY_AGE = 60, DEAD_AGE = 3600, N_MIN = 300, UNRES_MAX = 0.10, MAX_FILLS = 3500;
const r6 = (x) => +(+x).toPrecision(8), r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const pct = (a, p) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null; };
export const hourOf = (t) => new Date(t * 1000).getUTCHours();
// a candle start inside the rollover band 20:55-23:04 UTC
export const inBand = (t) => { const m = (t % 86400) / 60; return m >= 20 * 60 + 55 && m < 23 * 60 + 5; };
export const inRoll = (t) => { const h = hourOf(t); return h === 21 || h === 22; };
const deadIdx = (M5, fi, cap) => { const dl = M5[fi].t + cap; for (let j = fi; j < M5.length; j++) if (M5[j].e >= dl) return j; return -1; };

// every "m15 none atr 2R all" order of the window whose break candle starts at one of HOURS
export function lateOrders(market, from = FROM, to = TO, M5 = K.load(market, '5m', { from: '2023-01-01' })) {
  if (!M5.length) return { M5, list: [] };
  const cost = COSTS[market], X = exclusions(market), bad = (t) => X.some(([a, b]) => t >= a && t <= b), list = [];
  for (const g of signals(frames(M5))) {
    if (g.tf !== 1 || g.cx !== 0) continue;
    const hour = hourOf(g.ts - 900); if (!HOURS.includes(hour)) continue;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < from || t >= to || bad(t)) continue;
    const di = deadIdx(M5, fi, CAPS); if (di < 0) continue;
    const fill = M5[fi].o, s = -g.d, stop = fill + g.d * g.a, D = s * (fill - stop);
    if (!(D > 0) || D < cost) continue;
    const tgt = fill + s * 2 * D, ex = exits(M5, s, fi, stop, [tgt], CAPS), tr = midTrace(M5, s, fi, stop, tgt, CAPS);
    if (!ex || !tr) continue;
    const Rm = (s * (tr.px - fill)) / D; if (Math.abs(Rm - ex.R[0]) > 1e-9) throw new Error(`mid trace differs at ${market} ${t}`);
    list.push({ ts: t, bt: g.ts - 900, hour, side: s, fillM: fill, D, deadEnd: M5[di].e, fi, di, mid: { R: Rm, net: Rm - cost / D, how: tr.how, exitEnd: M5[tr.xi].e } });
  }
  return { M5, list };
}

// pass 2: the exact-level queries of one order once its tick fill A is known. [id, t0, t1, level, dir]
export function queriesOf(o, A, M5, sym) {
  const s = o.side, X = A - s * o.D, T = A + s * 2 * o.D, w = W[sym], nS = [], nT = [];
  if (!(s * (A - X) > 0)) throw new Error('stop on the wrong side');
  const fi = o.fi ?? startIdx(M5, o.ts);
  for (let j = fi; j < M5.length && M5[j].t < o.deadEnd; j++) { const b = M5[j], n = (inBand(b.t) ? 10 : 2) * w;
    if (s > 0 ? b.l <= X + n : b.h >= X - n) nS.push(b.t);
    if (s > 0 ? b.h >= T - n : b.l <= T + n) nT.push(b.t); }
  const q = [];
  spans(nS).forEach(([a, b], k) => q.push([`${o.id}|s${k}`, a, b, r6(X), -s]));
  spans(nT).forEach(([a, b], k) => q.push([`${o.id}|t${k}`, a, b, r6(T), 2 * s]));
  return { q, X, T, ns: spans(nS).length, nt: spans(nT).length };
}
const quote = (M, t, age) => { const m = M.get(t); return m && m[1] > 0 && m[2] > 0 && m[3] != null && m[3] <= age ? m : null; };
// the entry fill of an order from the marks: ask for a buy, bid for a sell; null = unresolved
export function entryOf(o, M) { const m = quote(M, o.ts, ENTRY_AGE); return m ? { A: o.side > 0 ? m[2] : m[1], spread: m[2] - m[1] } : null; }

// one order on ticks. F: Map id -> [id, ms, bid, ask] | [id, null]; M / MD: Map time -> [t, bid, ask, age, spread]
export function tickOrder(o, sym, F, M, MD) {
  const e = entryOf(o, M); if (!e) return { entryUnresolved: true };
  const s = o.side, A = e.A, X = A - s * o.D, T = A + s * 2 * o.D, start = o.ts * 1000, dead = o.deadEnd * 1000;
  const first = (pre, n) => { let best = null; for (let k = 0; k < n; k++) { const x = F.get(pre + k); if (!x) return { missing: true }; if (x[1] != null && x[1] >= start && x[1] < dead && (!best || x[1] < best[1])) best = x; } return { hit: best }; };
  const S = first(`${o.id}|s`, o.ns), G = first(`${o.id}|t`, o.nt);
  if (S.missing || G.missing) return { A, exitUnresolved: 'window not read' };
  const done = (ex, px, at) => { const R = (s * (px - A)) / o.D; return { A, X, T, ex, px, at, R, net: R - (2 * COMM[sym] * A) / o.D, slip: (s * (A - o.fillM)) / o.D, spreadR: e.spread / o.D }; };
  const cl = (x) => (s > 0 ? x[2] : x[3]);                 // closing side: a buy closes at the bid, a sell at the ask
  if (S.hit && (!G.hit || S.hit[1] <= G.hit[1])) return done('stop', cl(S.hit), S.hit[1] / 1000);
  if (G.hit) return done('target', T, G.hit[1] / 1000);
  const d = quote(MD, o.deadEnd, DEAD_AGE); if (!d) return { A, exitUnresolved: 'no deadline quote' };
  return done('time', s > 0 ? d[1] : d[2], o.deadEnd);
}

export function monthT(rows) { const m = new Map(); for (const x of rows) { const k = new Date(x.ts * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + x.v); }
  const v = [...m.values()]; if (v.length < 3) return { t: null, months: v.length }; const a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
  return { t: sd > 0 ? a / (sd / Math.sqrt(v.length)) : null, months: v.length }; }
// did the trade stand open at any moment inside 21:00-22:59 UTC?
export function overRoll(ts, at) { for (let t = Math.floor(ts / 3600) * 3600; t < at; t += 3600) if (inRoll(t) && t + 3600 > ts) return true; return inRoll(ts); }
export function stats(rows) {
  const ent = rows.filter((x) => !x.b.entryUnresolved), res = ent.filter((x) => x.b.R != null);
  const T = (list, f) => { const d = list.map((x) => ({ ts: x.ts, v: f(x) })), mt = monthT(d); return { n: d.length, mean: r4(mean(d.map((x) => x.v))), monthT: r4(mt.t), months: mt.months }; };
  const by = (f) => { const o = {}; for (const x of res) (o[f(x)] ||= []).push(x); return Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, { n: v.length, tick: r4(mean(v.map((x) => x.b.R))), net: r4(mean(v.map((x) => x.b.net))), mid: r4(mean(v.map((x) => x.midR))) }])); };
  const why = {}; for (const x of ent) if (x.b.exitUnresolved) why[x.b.exitUnresolved] = (why[x.b.exitUnresolved] || 0) + 1;
  const sp = res.map((x) => x.b.spreadR);
  return { orders: rows.length, entryUnresolved: rows.length - ent.length, exitUnresolved: ent.length - res.length, unresolvedShare: ent.length ? r4((ent.length - res.length) / ent.length) : null, unresolvedWhy: why,
    net: T(res, (x) => x.b.net), tick: T(res, (x) => x.b.R), mid: T(res, (x) => x.midR), midNet: T(res, (x) => x.midNet), tickMinusMid: T(res, (x) => x.b.R - x.midR),
    win: res.length ? r4(res.filter((x) => x.b.R > 0).length / res.length) : null,
    exits: by((x) => x.b.ex), byYear: by((x) => new Date(x.ts * 1000).getUTCFullYear()), bySide: by((x) => (x.side > 0 ? 'buy' : 'sell')),
    byRoll: by((x) => (overRoll(x.ts, x.b.at) ? 'open inside 21:00-22:59' : 'never open inside 21:00-22:59')),
    entrySpreadR: { median: r4(pct(sp, 0.5)), p90: r4(pct(sp, 0.9)) }, entrySlipR: r4(mean(res.map((x) => x.b.slip))) };
}
export function verdictOf(st) {
  if (st.unresolvedShare != null && st.unresolvedShare > UNRES_MAX) return 'INCONCLUSIVE';
  if (st.net.n < N_MIN) return 'TOO FEW';
  return st.net.mean > 0 && st.net.monthT >= 2 ? 'PASS' : 'FAIL';
}

const readProbe = (dir, sym, pre) => { const F = new Map(), M = new Map(), files = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(`ticks-${sym}-${pre}`) && x.endsWith('.json')).sort()) {
    const P = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), Q = P[sym] || P; files.push({ file: f, at: P.at, errors: (Q.errors || []).length });
    for (const x of Q.fills || []) if (!F.has(x[0]) || (F.get(x[0])[1] == null && x[1] != null)) F.set(x[0], x);
    for (const m of Q.marks || []) if (m[1] > 0 && !(M.get(m[0]) && M.get(m[0])[1] > 0)) M.set(m[0], m); }
  return { F, M, files }; };
const sig = (v) => (v == null ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3));

function resultMd(o) {
  const p = o.primary, L = ['# The 20-22 UTC Break fade at the broker\'s bid / ask ticks (result)', '', `**Verdict: ${o.verdict}**`, '',
    `Run ${o.built} as pre-registered (\`PREREGISTRATION.md\`, committed and pushed alone first). Paper research only: nothing live`,
    'changed, no rule is proposed. These hours were chosen after looking at these same years: a measurement of execution.', '',
    '## What was run', '',
    'Every `m15 none atr 2R all` fade (the first M15 structure break, entered against it at market, stop 1 x ATR(14) of M15, target 2R,',
    `out after a day) whose break candle starts at 20, 21 or 22 UTC, XAUUSD and USDJPY, ${o.window[0]} to ${o.window[1]}. Entry at the`,
    'broker\'s ask (buy) or bid (sell) at the fill moment; stop when the closing side reaches it (booked at that tick), target when the',
    'closing side reaches it, else the quote at the deadline. R after commission is the verdict\'s line.', '',
    '## Primary block: breaks at 20:00-21:59 UTC', '',
    '| | Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After commission (month t) | Mid R | Mid after flat cost | Tick − mid (month t) |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  const row = (n, s) => `| ${n} | ${s.orders} | ${s.entryUnresolved} | ${s.exitUnresolved} | ${s.net.n} | ${s.win == null ? 'n/a' : (s.win * 100).toFixed(1) + ' %'} | ${sig(s.tick.mean)} (${s.tick.monthT ?? 'n/a'}) | ${sig(s.net.mean)} (${s.net.monthT ?? 'n/a'}) | ${sig(s.mid.mean)} | ${sig(s.midNet.mean)} | ${sig(s.tickMinusMid.mean)} (${s.tickMinusMid.monthT ?? 'n/a'}) |`;
  L.push(row('Both markets', p), ...Object.entries(o.primaryByMarket).map(([k, s]) => row(k, s)), '', '## By hour (both markets)', '',
    '| Break hour (UTC) | Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After commission (month t) | Mid R | Mid after flat cost | Tick − mid (month t) |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...Object.entries(o.byHour).map(([h, s]) => row(h, s)), '', '## By hour and market', '',
    '| Hour | Market | Resolved | Won | After commission (month t) | Mid R | Entry spread in R: median / 90th |', '|---|---|---:|---:|---:|---:|---:|');
  for (const [h, m] of Object.entries(o.byHourMarket)) for (const [k, s] of Object.entries(m)) L.push(`| ${h} | ${k} | ${s.net.n} | ${s.win == null ? 'n/a' : (s.win * 100).toFixed(1) + ' %'} | ${sig(s.net.mean)} (${s.net.monthT ?? 'n/a'}) | ${sig(s.mid.mean)} | ${s.entrySpreadR.median ?? 'n/a'} / ${s.entrySpreadR.p90 ?? 'n/a'} |`);
  const tbl = (t, obj) => { L.push('', `## ${t} (primary block)`, '', '| | n | Tick R | After commission | Mid R |', '|---|---:|---:|---:|---:|'); for (const [k, v] of Object.entries(obj)) L.push(`| ${k} | ${v.n} | ${sig(v.tick)} | ${sig(v.net)} | ${sig(v.mid)} |`); };
  tbl('Exits', p.exits); tbl('Inside the rollover or not', p.byRoll); tbl('By year', p.byYear); tbl('By side', p.bySide);
  L.push('', `Entry spread paid, in R (primary block): median ${p.entrySpreadR.median}, 90th percentile ${p.entrySpreadR.p90}. Exit-unresolved reasons: ${JSON.stringify(p.unresolvedWhy)}.`,
    '', '## What it means', '', ...o.meaning, '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir, commit] = process.argv.slice(2);
  const ID = { XAUUSD: 'x', USDJPY: 'j' };
  if (mode === 'marks') {
    const E = {}, D = {}, sum = {};
    for (const [sym, mk] of Object.entries(MARKETS)) { const { list } = lateOrders(mk);
      list.forEach((o, i) => { o.id = `${ID[sym]}${String(i).padStart(4, '0')}`; });
      fs.writeFileSync(path.join(HERE, `orders-${sym}.json`), JSON.stringify(list.map(({ fi, di, ...o }) => o)));
      E[sym] = [...new Set(list.map((o) => o.ts))].sort((a, b) => a - b); D[sym] = [...new Set(list.map((o) => o.deadEnd))].sort((a, b) => a - b);
      sum[sym] = { orders: list.length, byHour: Object.fromEntries(HOURS.map((h) => [h, list.filter((o) => o.hour === h).length])), entryMarks: E[sym].length, deadMarks: D[sym].length }; }
    fs.writeFileSync(path.join(HERE, 'marks-entry.json'), JSON.stringify(E)); fs.writeFileSync(path.join(HERE, 'marks-dead.json'), JSON.stringify(D));
    fs.writeFileSync(path.join(HERE, 'queries-summary.json'), JSON.stringify({ pass1: sum }, null, 1)); console.log(JSON.stringify(sum));
  } else if (mode === 'queries') {
    const sumP = JSON.parse(fs.readFileSync(path.join(HERE, 'queries-summary.json'), 'utf8')), chunks = {}, s2 = {};
    for (const [sym, mk] of Object.entries(MARKETS)) {
      const O = JSON.parse(fs.readFileSync(path.join(HERE, `orders-${sym}.json`), 'utf8')), { M } = readProbe(dir, sym, 'late-entry'), M5 = K.load(mk, '5m', { from: '2023-01-01' });
      const files = [[]]; let none = 0, nq = 0;
      for (const o of O) { const e = entryOf(o, M); if (!e) { none++; o.ns = 0; o.nt = 0; continue; }
        const r = queriesOf(o, e.A, M5, sym); o.ns = r.ns; o.nt = r.nt; nq += r.q.length;
        if (files[files.length - 1].length + r.q.length > MAX_FILLS) files.push([]); files[files.length - 1].push(...r.q); }
      fs.writeFileSync(path.join(HERE, `orders-${sym}.json`), JSON.stringify(O)); chunks[sym] = files; s2[sym] = { noEntryQuote: none, queries: nq, files: files.length };
    }
    const n = Math.max(...Object.values(chunks).map((x) => x.length)), batches = [];
    for (let k = 0; k < n; k++) { const j = { fills: {} }; for (const sym of Object.keys(MARKETS)) if (chunks[sym][k] && chunks[sym][k].length) j.fills[sym] = chunks[sym][k];
      fs.writeFileSync(path.join(HERE, `fills-${k + 1}.json`), JSON.stringify(j)); batches.push({ file: `fills-${k + 1}.json`, tag: `late-fills-${k + 1}`, symbols: Object.keys(j.fills).map((s) => `${s}:fills`).join(' ') }); }
    fs.writeFileSync(path.join(HERE, 'queries-summary.json'), JSON.stringify({ ...sumP, pass2: s2, batches }, null, 1)); console.log(JSON.stringify({ s2, batches }));
  } else if (mode === 'report') {
    const rows = [], probes = [];
    for (const sym of Object.keys(MARKETS)) {
      const O = JSON.parse(fs.readFileSync(path.join(HERE, `orders-${sym}.json`), 'utf8')), e = readProbe(dir, sym, 'late-entry'), d = readProbe(dir, sym, 'late-dead'), f = readProbe(dir, sym, 'late-fills');
      probes.push(...e.files, ...d.files, ...f.files);
      for (const o of O) rows.push({ sym, ts: o.ts, hour: o.hour, side: o.side, b: tickOrder(o, sym, f.F, e.M, d.M), midR: o.mid.R, midNet: o.mid.net });
    }
    const prim = rows.filter((x) => PRIMARY.includes(x.hour)), primary = stats(prim), verdict = verdictOf(primary);
    const out = { study: 'fade-late-tick-exec', built: new Date().toISOString().slice(0, 10), commit: commit || null, window: [new Date(FROM * 1000).toISOString().slice(0, 10), new Date(TO * 1000).toISOString().slice(0, 10)],
      rule: 'grid7-wide-fade m15 none atr 2R all', hours: HOURS, primaryHours: PRIMARY, probes, primary,
      primaryByMarket: Object.fromEntries(Object.keys(MARKETS).map((s) => [s, stats(prim.filter((x) => x.sym === s))])),
      byHour: Object.fromEntries(HOURS.map((h) => [h, stats(rows.filter((x) => x.hour === h))])),
      byHourMarket: Object.fromEntries(HOURS.map((h) => [h, Object.fromEntries(Object.keys(MARKETS).map((s) => [s, stats(rows.filter((x) => x.hour === h && x.sym === s))]))])) };
    const word = verdict === 'PASS' ? 'made' : 'made';
    out.verdict = `${verdict}. At the broker's own bid and ask the 20-21 UTC Break fade ${word} ${sig(primary.net.mean)}R a trade after commission (n ${primary.net.n}, month t ${primary.net.monthT}). On mid candles the same orders made ${sig(primary.mid.mean)}R; ${primary.entryUnresolved} of ${primary.orders} had no quote to enter on.`;
    out.meaning = fs.existsSync(path.join(HERE, 'MEANING.md')) ? fs.readFileSync(path.join(HERE, 'MEANING.md'), 'utf8').trim().split('\n') : ['(to be written)'];
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1)); fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out)); console.log(out.verdict);
  } else console.log('usage: run.mjs marks | queries <probe dir> | report <probe dir> [commit]');
}

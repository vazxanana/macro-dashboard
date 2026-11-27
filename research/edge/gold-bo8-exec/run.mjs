// Edge research · gold-bo8-exec: the researcher's gold 8-swing break (long) at the demo broker's own bid / ask ticks (PREREGISTRATION.md).
// Paper research only. Same two-pass method as fade-late-tick-exec.
//   node run.mjs orders <cacheDir>   -> orders-XAUUSD.json, marks-entry.json, marks-dead.json (pass 1 inputs)
//   node run.mjs queries <probe dir> -> fills-<k>.json (pass 2 inputs, only after the entry quotes are in)
//   node run.mjs report <probe dir> [commit] -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { loadMarket } from '../auto-researcher/engine.mjs';
import { orders, finR, FROM, TO } from './orders.mjs';
import { spans } from '../fade-tick-exec/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SYM = 'XAUUSD', W = 0.5, COMM = 0.000024, RR = 6;
export const ENTRY_AGE = 60, DEAD_AGE = 3600, N_MIN = 100, UNRES_MAX = 0.10, MAX_FILLS = 3500;
const r6 = (x) => +(+x).toPrecision(8), r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const pct = (a, p) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null; };
export const inBand = (t) => { const m = (t % 86400) / 60; return m >= 20 * 60 + 55 && m < 23 * 60 + 5; };
const quote = (M, t, age) => { const m = M.get(t); return m && m[1] > 0 && m[2] > 0 && m[3] != null && m[3] <= age ? m : null; };
export function entryOf(o, M) { const m = quote(M, o.ts, ENTRY_AGE); return m ? { A: o.side > 0 ? m[2] : m[1], spread: m[2] - m[1] } : null; }

// pass 2: exact-level queries once the tick fill A is known. [id, t0, t1, level, dir]
export function queriesOf(o, A, M5) {
  const s = o.side, X = A - s * o.D, T = A + s * RR * o.D, nS = [], nT = [];
  if (!(s * (A - X) > 0)) throw new Error('stop on the wrong side');
  for (let j = 0; j < M5.length && M5[j].t < o.deadEnd; j++) { const b = M5[j]; if (b.t < o.ts) continue; const n = (inBand(b.t) ? 10 : 2) * W;
    if (s > 0 ? b.l <= X + n : b.h >= X - n) nS.push(b.t);
    if (s > 0 ? b.h >= T - n : b.l <= T + n) nT.push(b.t); }
  const q = [];
  spans(nS).forEach(([a, b], k) => q.push([`${o.id}|s${k}`, a, b, r6(X), -s]));
  spans(nT).forEach(([a, b], k) => q.push([`${o.id}|t${k}`, a, b, r6(T), 2 * s]));
  return { q, ns: spans(nS).length, nt: spans(nT).length };
}
export function tickOrder(o, F, M, MD) {
  const e = entryOf(o, M); if (!e) return { entryUnresolved: true };
  const s = o.side, A = e.A, T = A + s * RR * o.D, start = o.ts * 1000, dead = o.deadEnd * 1000;
  const first = (pre, n) => { let best = null; for (let k = 0; k < n; k++) { const x = F.get(pre + k); if (!x) return { missing: true }; if (x[1] != null && x[1] >= start && x[1] < dead && (!best || x[1] < best[1])) best = x; } return { hit: best }; };
  const S = first(`${o.id}|s`, o.ns), G = first(`${o.id}|t`, o.nt);
  if (S.missing || G.missing) return { A, exitUnresolved: 'window not read' };
  const done = (ex, px, at) => { const R = (s * (px - A)) / o.D; return { A, ex, px, at, R, fin: finR(o, at), net: R - (2 * COMM * A) / o.D - finR(o, at), slip: (s * (A - o.fillM)) / o.D, spreadR: e.spread / o.D }; };
  const cl = (x) => (s > 0 ? x[2] : x[3]);
  if (S.hit && (!G.hit || S.hit[1] <= G.hit[1])) return done('stop', cl(S.hit), S.hit[1] / 1000);
  if (G.hit) return done('target', T, G.hit[1] / 1000);
  const d = quote(MD, o.deadEnd, DEAD_AGE); if (!d) return { A, exitUnresolved: 'no deadline quote' };
  return done('time', s > 0 ? d[1] : d[2], o.deadEnd);
}
export function monthT(rows) { const m = new Map(); for (const x of rows) { const k = new Date(x.ts * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + x.v); }
  const v = [...m.values()]; if (v.length < 3) return { t: null, months: v.length }; const a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
  return { t: sd > 0 ? a / (sd / Math.sqrt(v.length)) : null, months: v.length }; }
export function overRoll(ts, at) { for (let t = Math.floor(ts / 3600) * 3600; t < at; t += 3600) { const h = new Date(t * 1000).getUTCHours(); if ((h === 21 || h === 22) && t + 3600 > ts) return true; } return false; }
export function stats(rows) {
  const ent = rows.filter((x) => !x.b.entryUnresolved), res = ent.filter((x) => x.b.R != null);
  const T = (list, f) => { const d = list.map((x) => ({ ts: x.ts, v: f(x) })), mt = monthT(d); return { n: d.length, mean: r4(mean(d.map((x) => x.v))), monthT: r4(mt.t), months: mt.months }; };
  const by = (f) => { const o = {}; for (const x of res) (o[f(x)] ||= []).push(x); return Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, { n: v.length, tick: r4(mean(v.map((x) => x.b.R))), net: r4(mean(v.map((x) => x.b.net))), mid: r4(mean(v.map((x) => x.midR))) }])); };
  const why = {}; for (const x of ent) if (x.b.exitUnresolved) why[x.b.exitUnresolved] = (why[x.b.exitUnresolved] || 0) + 1;
  const sp = res.map((x) => x.b.spreadR);
  return { orders: rows.length, entryUnresolved: rows.length - ent.length, exitUnresolved: ent.length - res.length, unresolvedShare: ent.length ? r4((ent.length - res.length) / ent.length) : null, unresolvedWhy: why,
    net: T(res, (x) => x.b.net), tick: T(res, (x) => x.b.R), mid: T(res, (x) => x.midR), tickMinusMid: T(res, (x) => x.b.R - x.midR),
    win: res.length ? r4(res.filter((x) => x.b.R > 0).length / res.length) : null,
    exits: by((x) => x.b.ex), byYear: by((x) => new Date(x.ts * 1000).getUTCFullYear()), bySide: by((x) => (x.side > 0 ? 'buy' : 'sell')),
    byRoll: by((x) => (overRoll(x.ts, x.b.at) ? 'open inside 21:00-22:59' : 'never open inside 21:00-22:59')),
    entrySpreadR: { median: r4(pct(sp, 0.5)), p90: r4(pct(sp, 0.9)) }, entrySlipR: r4(mean(res.map((x) => x.b.slip))), finR: r4(mean(res.map((x) => x.b.fin))) };
}
export function verdictOf(st) {
  if (st.unresolvedShare != null && st.unresolvedShare > UNRES_MAX) return 'INCONCLUSIVE';
  if (st.net.n < N_MIN) return 'TOO FEW';
  return st.net.mean > 0 && st.net.monthT >= 2 ? 'PASS' : 'FAIL';
}
const readProbe = (dir, pre) => { const F = new Map(), M = new Map(), files = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(`ticks-${SYM}-${pre}`) && x.endsWith('.json')).sort()) {
    const P = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), Q = P[SYM] || P; files.push({ file: f, at: P.at, errors: (Q.errors || []).length });
    for (const x of Q.fills || []) if (!F.has(x[0]) || (F.get(x[0])[1] == null && x[1] != null)) F.set(x[0], x);
    for (const m of Q.marks || []) if (m[1] > 0 && !(M.get(m[0]) && M.get(m[0])[1] > 0)) M.set(m[0], m); }
  return { F, M, files }; };
const sig = (v) => (v == null ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3));

function resultMd(o) {
  const p = o.primary, L = ['# The gold 8-swing break (long) at the broker\'s bid / ask ticks (result)', '', `**Verdict: ${o.verdict}**`, '',
    `Run ${o.built} as pre-registered (\`PREREGISTRATION.md\`, committed and pushed alone first). Paper research only: nothing live`,
    'changed, no rule is proposed. The rule is one of the auto-researcher\'s results (version auto-2), found on these same years.', '',
    '## What was run', '',
    `Every order of the rule (an H1 close above the last unbroken 8-a-side H1 swing high, bought at the next open; stop 0.75 x ATR(14), target ${RR}R, out after 24 H1 candles), ${o.window[0]} to ${o.window[1]}.`,
    'Entry at the broker\'s ask; stop and target when the bid reaches them; else the bid at the deadline. After costs = minus commission and the demo\'s overnight financing on a gold buy.', '',
    '| Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After costs (month t) | Mid R (engine cost) | Tick − mid (month t) |', '|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    `| ${p.orders} | ${p.entryUnresolved} | ${p.exitUnresolved} | ${p.net.n} | ${p.win == null ? 'n/a' : (p.win * 100).toFixed(1) + ' %'} | ${sig(p.tick.mean)} (${p.tick.monthT ?? 'n/a'}) | ${sig(p.net.mean)} (${p.net.monthT ?? 'n/a'}) | ${sig(p.mid.mean)} | ${sig(p.tickMinusMid.mean)} (${p.tickMinusMid.monthT ?? 'n/a'}) |`];
  const tbl = (t, obj) => { L.push('', `## ${t}`, '', '| | n | Tick R | After costs | Mid R |', '|---|---:|---:|---:|---:|'); for (const [k, v] of Object.entries(obj)) L.push(`| ${k} | ${v.n} | ${sig(v.tick)} | ${sig(v.net)} | ${sig(v.mid)} |`); };
  tbl('Exits', p.exits); tbl('Inside the rollover or not', p.byRoll); tbl('By year', p.byYear); tbl('By side', p.bySide);
  L.push('', `Entry spread paid, in R: median ${p.entrySpreadR.median}, 90th percentile ${p.entrySpreadR.p90}. Exit-unresolved reasons: ${JSON.stringify(p.unresolvedWhy)}.`, '', '## What it means', '', ...o.meaning, '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir, commit] = process.argv.slice(2);
  if (mode === 'orders') {
    const D = await loadMarket('xau', dir), list = orders(D); list.forEach((o, i) => { o.id = `j${String(i).padStart(4, '0')}`; });
    fs.writeFileSync(path.join(HERE, `orders-${SYM}.json`), JSON.stringify(list));
    fs.writeFileSync(path.join(HERE, 'marks-entry.json'), JSON.stringify({ [SYM]: [...new Set(list.map((o) => o.ts))].sort((a, b) => a - b) }));
    fs.writeFileSync(path.join(HERE, 'marks-dead.json'), JSON.stringify({ [SYM]: [...new Set(list.map((o) => o.deadEnd))].sort((a, b) => a - b) }));
    console.log(JSON.stringify({ orders: list.length }));
  } else if (mode === 'queries') {
    const O = JSON.parse(fs.readFileSync(path.join(HERE, `orders-${SYM}.json`), 'utf8')), { M } = readProbe(dir, 'gbo8-entry'), M5 = K.load('xau', '5m', { from: '2023-01-01' });
    const files = [[]]; let none = 0, nq = 0;
    for (const o of O) { const e = entryOf(o, M); if (!e) { none++; o.ns = 0; o.nt = 0; continue; }
      const r = queriesOf(o, e.A, M5); o.ns = r.ns; o.nt = r.nt; nq += r.q.length;
      if (files[files.length - 1].length + r.q.length > MAX_FILLS) files.push([]); files[files.length - 1].push(...r.q); }
    fs.writeFileSync(path.join(HERE, `orders-${SYM}.json`), JSON.stringify(O));
    const batches = files.map((q, k) => { fs.writeFileSync(path.join(HERE, `fills-${k + 1}.json`), JSON.stringify({ fills: { [SYM]: q } })); return { file: `fills-${k + 1}.json`, tag: `gbo8-fills-${k + 1}`, symbols: `${SYM}:fills` }; });
    console.log(JSON.stringify({ noEntryQuote: none, queries: nq, batches }));
  } else if (mode === 'report') {
    const O = JSON.parse(fs.readFileSync(path.join(HERE, `orders-${SYM}.json`), 'utf8')), e = readProbe(dir, 'gbo8-entry'), d = readProbe(dir, 'gbo8-dead'), f = readProbe(dir, 'gbo8-fills');
    const rows = O.map((o) => ({ ts: o.ts, side: o.side, b: tickOrder(o, f.F, e.M, d.M), midR: o.midR })), primary = stats(rows), verdict = verdictOf(primary);
    const out = { study: 'gold-bo8-exec', built: new Date().toISOString().slice(0, 10), commit: commit || null, window: [new Date(FROM * 1000).toISOString().slice(0, 10), new Date(TO * 1000).toISOString().slice(0, 10)], probes: [...e.files, ...d.files, ...f.files], primary };
    out.verdict = `${verdict}. At the broker's own bid and ask the gold 8-swing break (long) made ${sig(primary.net.mean)}R a trade after commission and financing (n ${primary.net.n}, month t ${primary.net.monthT}). On mid candles the same orders made ${sig(primary.mid.mean)}R; ${primary.entryUnresolved} of ${primary.orders} had no quote to enter on.`;
    out.meaning = fs.existsSync(path.join(HERE, 'MEANING.md')) ? fs.readFileSync(path.join(HERE, 'MEANING.md'), 'utf8').trim().split('\n') : ['(to be written)'];
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1)); fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out)); console.log(out.verdict);
  } else console.log('usage: run.mjs orders <cache> | queries <probe dir> | report <probe dir> [commit]');
}

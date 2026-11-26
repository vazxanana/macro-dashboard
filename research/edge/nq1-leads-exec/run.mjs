// Edge research · nq1-leads-exec: the auto-researcher's NAS100 leads at the demo broker's own bid / ask ticks (PREREGISTRATION.md).
// Paper research only. The two-pass method of usdchf-fade-exec, with a third pass for the time exits.
//   node run.mjs orders              -> orders.json, marks-entry-<k>.json (pass 1 inputs)
//   node run.mjs queries <probe dir> -> fills-<k>.json (pass 2 inputs, only after the entry quotes are in)
//   node run.mjs dead <probe dir>    -> marks-dead-<k>.json (pass 3: orders with neither stop nor target on the ticks)
//   node run.mjs report <probe dir> [commit] -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { build, LEADS, FROM, TO } from './orders.mjs';
import { spans } from '../fade-tick-exec/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SYM = 'NAS100', W = 3, W_BREAK = 15, SWAP_LONG = 0.62, ROLL_H = 22, TRIPLE_DOW = 5;
export const ENTRY_AGE = 60, DEAD_AGE = 3600, N_MIN = 100, UNRES_MAX = 0.10, MAX_FILLS = 3500, MAX_MARKS = 600;
const r6 = (x) => +(+x).toPrecision(8), r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const pct = (a, p) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null; };
export const inBand = (t) => { const m = (t % 86400) / 60; return m >= 20 * 60 + 55 && m < 23 * 60 + 5; };
const quote = (M, t, age) => { const m = M.get(t); return m && m[1] > 0 && m[2] > 0 && m[3] != null && m[3] <= age ? m : null; };
export function entryOf(o, M) { const m = quote(M, o.ts, ENTRY_AGE); return m ? { A: o.side > 0 ? m[2] : m[1], spread: m[2] - m[1] } : null; }
// nights a position pays financing for: every 22:00 UTC of a weekday with entry < t <= exit, Friday three
export function nights(t0, t1) { let n = 0; for (let t = Math.floor(t0 / 86400) * 86400 + ROLL_H * 3600; t <= t1; t += 86400) { if (t <= t0) continue; const d = new Date(t * 1000).getUTCDay(); if (d === 0 || d === 6) continue; n += d === TRIPLE_DOW ? 3 : 1; } return n; }

// pass 2: exact-level queries once the tick fill A is known. [id, t0, t1, level, dir]. The scan ends at the first 5-minute
// candle that is clearly through a level (the trade is over by then whatever the ticks say).
export function queriesOf(o, A, M5, from = 0) {
  const s = o.side, X = A - s * o.D, T = A + s * o.rr * o.D, nS = [], nT = [];
  if (!(s * (A - X) > 0)) throw new Error('stop on the wrong side');
  for (let j = from; j < M5.length && M5[j].t < o.deadEnd; j++) { const b = M5[j]; if (b.t + 300 <= o.ts) continue; const n = inBand(b.t) ? W_BREAK : W;
    const ns = s > 0 ? b.l <= X + n : b.h >= X - n, nt = s > 0 ? b.h >= T - n : b.l <= T + n;
    if (ns) nS.push(b.t); if (nt) nT.push(b.t);
    if (b.t >= o.ts && (s > 0 ? b.l < X - n || b.h > T + n : b.h > X + n || b.l < T - n)) break; }
  const q = [];
  spans(nS).forEach(([a, b], k) => q.push([`${o.id}|s${k}`, a, b, r6(X), -s]));
  spans(nT).forEach(([a, b], k) => q.push([`${o.id}|t${k}`, a, b, r6(T), 2 * s]));
  return { q, ns: spans(nS).length, nt: spans(nT).length };
}
export function tickOrder(o, F, M, MD) {
  const e = entryOf(o, M); if (!e) return { entryUnresolved: true };
  const s = o.side, A = e.A, T = A + s * o.rr * o.D, start = o.ts * 1000, dead = o.deadEnd * 1000;
  const first = (pre, n) => { let best = null; for (let k = 0; k < n; k++) { const x = F.get(pre + k); if (!x) return { missing: true }; if (x[1] != null && x[1] >= start && x[1] < dead && (!best || x[1] < best[1])) best = x; } return { hit: best }; };
  const S = first(`${o.id}|s`, o.ns), G = first(`${o.id}|t`, o.nt);
  if (S.missing || G.missing) return { A, exitUnresolved: 'window not read' };
  const done = (ex, px, at) => { const R = (s * (px - A)) / o.D, n = nights(o.ts, at), fin = s > 0 ? (n * SWAP_LONG) / o.D : 0;
    return { A, ex, px, at, R, fin, nights: n, net: R - fin, slip: (s * (A - o.fillM)) / o.D, spreadR: e.spread / o.D }; };
  const cl = (x) => (s > 0 ? x[2] : x[3]);
  if (S.hit && (!G.hit || S.hit[1] <= G.hit[1])) return done('stop', cl(S.hit), S.hit[1] / 1000);
  if (G.hit) return done('target', T, G.hit[1] / 1000);
  const d = quote(MD, o.deadEnd, DEAD_AGE); if (!d) return { A, needDead: true, exitUnresolved: 'no quote at the time limit' };
  return done('time', s > 0 ? d[1] : d[2], o.deadEnd);
}
export function monthT(rows) { const m = new Map(); for (const x of rows) { const k = new Date(x.ts * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + x.v); }
  const v = [...m.values()]; if (v.length < 3) return { t: null, months: v.length }; const a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
  return { t: sd > 0 ? a / (sd / Math.sqrt(v.length)) : null, months: v.length }; }
export function overBreak(ts, at) { for (let t = Math.floor(ts / 3600) * 3600; t < at; t += 3600) { const h = new Date(t * 1000).getUTCHours(); if ((h === 21 || h === 22) && t + 3600 > ts) return true; } return false; }
// one-sided p of a t (normal approximation), and Holm over a list of p values
export const pOf = (t) => { if (t == null) return 1; const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x), erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x); const two = 1 - erf; return t > 0 ? two / 2 : 1 - two / 2; };
export function holm(ps) { const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0; idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; }); return out; }
export function stats(rows) {
  const ent = rows.filter((x) => !x.b.entryUnresolved), res = ent.filter((x) => x.b.R != null);
  const T = (list, f) => { const d = list.map((x) => ({ ts: x.ts, v: f(x) })), mt = monthT(d); return { n: d.length, mean: r4(mean(d.map((x) => x.v))), monthT: r4(mt.t), months: mt.months }; };
  const by = (f) => { const o = {}; for (const x of res) (o[f(x)] ||= []).push(x); return Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, { n: v.length, tick: r4(mean(v.map((x) => x.b.R))), net: r4(mean(v.map((x) => x.b.net))), mid: r4(mean(v.map((x) => x.midR))) }])); };
  const why = {}; for (const x of ent) if (x.b.exitUnresolved) why[x.b.exitUnresolved] = (why[x.b.exitUnresolved] || 0) + 1;
  const sp = res.map((x) => x.b.spreadR);
  return { orders: rows.length, entryUnresolved: rows.length - ent.length, exitUnresolved: ent.length - res.length, unresolvedShare: ent.length ? r4((ent.length - res.length) / ent.length) : null, unresolvedWhy: why,
    net: T(res, (x) => x.b.net), tick: T(res, (x) => x.b.R), mid: T(res, (x) => x.midR), tickMinusMid: T(res, (x) => x.b.R - x.midR),
    win: res.length ? r4(res.filter((x) => x.b.R > 0).length / res.length) : null, financingR: r4(mean(res.map((x) => x.b.fin))), nights: r4(mean(res.map((x) => x.b.nights))),
    exits: by((x) => x.b.ex), byYear: by((x) => new Date(x.ts * 1000).getUTCFullYear()), bySide: by((x) => (x.side > 0 ? 'buy' : 'sell')),
    byBreak: by((x) => (overBreak(x.ts, x.b.at) ? 'open over the 21:00-22:59 break' : 'never open over the break')),
    entrySpreadR: { median: r4(pct(sp, 0.5)), p90: r4(pct(sp, 0.9)) }, entrySlipR: r4(mean(res.map((x) => x.b.slip))) };
}
export function verdictOf(st, holmP) {
  if (st.unresolvedShare != null && st.unresolvedShare > UNRES_MAX) return 'INCONCLUSIVE';
  if (st.net.n < N_MIN) return 'TOO FEW';
  return st.net.mean > 0 && st.net.monthT >= 2 && holmP < 0.05 ? 'PASS' : 'FAIL';
}
export const readProbe = (dir, pre) => { const F = new Map(), M = new Map(), files = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(`ticks-${SYM}-${pre}`) && x.endsWith('.json')).sort()) {
    const P = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), Q = P[SYM] || P; files.push({ file: f, at: P.at, errors: (Q.errors || []).length });
    for (const x of Q.fills || []) if (!F.has(x[0]) || (F.get(x[0])[1] == null && x[1] != null)) F.set(x[0], x);
    for (const m of Q.marks || []) if (m[1] > 0 && !(M.get(m[0]) && M.get(m[0])[1] > 0)) M.set(m[0], m); }
  return { F, M, files }; };
const sig = (v) => (v == null ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3));
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const ORD = path.join(HERE, 'orders.json');

function resultMd(o) {
  const L = ['# The Nasdaq leads at the broker\'s own bid / ask ticks (result)', '', `**Verdict: ${o.verdict}**`, '',
    `Run ${o.built} as pre-registered (\`PREREGISTRATION.md\`, committed and pushed alone first). Paper research only: nothing live`,
    'changed, no rule is proposed. The rules are the auto-researcher\'s NAS100 leads, found on these same years; they overlap heavily.', '',
    '## What was run', '',
    `Every order of each rule, ${o.window[0]} to ${o.window[1]}, entered at the demo broker's NAS100 ask (buy) or bid (sell); stop and target when the`,
    'closing side reaches them; else the quote at the time limit. Net = tick R less financing (0.62 points a night on a buy).', '',
    '| Rule | Orders | No entry quote | Exit unresolved | Resolved | Won | Mid R | Tick R | Financing R | Net R (month t) | Holm p | Verdict |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const r of o.rules) { const p = r.stats; L.push(`| ${r.id} ${r.name} | ${p.orders} | ${p.entryUnresolved} | ${p.exitUnresolved} | ${p.net.n} | ${p.win == null ? 'n/a' : (p.win * 100).toFixed(1) + ' %'} | ${sig(p.mid.mean)} | ${sig(p.tick.mean)} | ${p.financingR} | ${sig(p.net.mean)} (${p.net.monthT ?? 'n/a'}) | ${r.holm == null ? 'n/a' : r.holm.toFixed(4)} | ${r.verdict} |`); }
  L.push('', '## Detail by rule', '');
  for (const r of o.rules) { const p = r.stats; L.push(`### ${r.id} ${r.name}`, '', `Tick minus mid ${sig(p.tickMinusMid.mean)}R a trade (month t ${p.tickMinusMid.monthT ?? 'n/a'}); entry spread in R: median ${p.entrySpreadR.median}, 90th percentile ${p.entrySpreadR.p90}; ${p.nights} nights held on average. Unresolved: ${JSON.stringify(p.unresolvedWhy)}.`, '', '| | n | Tick R | Net R | Mid R |', '|---|---:|---:|---:|---:|');
    for (const grp of [p.exits, p.byBreak, p.byYear, p.bySide]) for (const [k, v] of Object.entries(grp)) L.push(`| ${k} | ${v.n} | ${sig(v.tick)} | ${sig(v.net)} | ${sig(v.mid)} |`); L.push(''); }
  L.push('## What it means', '', ...o.meaning, '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir, commit] = process.argv.slice(2);
  if (mode === 'orders') {
    const { all, gate } = await build(); fs.writeFileSync(ORD, JSON.stringify(all));
    const ts = [...new Set(all.map((o) => o.ts))].sort((a, b) => a - b), files = chunks(ts, MAX_MARKS);
    files.forEach((c, k) => fs.writeFileSync(path.join(HERE, `marks-entry-${k + 1}.json`), JSON.stringify({ [SYM]: c })));
    console.log(JSON.stringify({ orders: all.length, gate, entryFiles: files.length }));
  } else if (mode === 'queries') {
    const O = JSON.parse(fs.readFileSync(ORD, 'utf8')), { M } = readProbe(dir, 'nq1-entry'), M5 = K.load('nas100', '5m', { from: '2023-11-01' });
    const files = [[]]; let none = 0, nq = 0, p = 0;
    for (const o of [...O].sort((a, b) => a.ts - b.ts)) { const e = entryOf(o, M); if (!e) { none++; o.ns = 0; o.nt = 0; continue; }
      while (p < M5.length && M5[p].t + 300 <= o.ts) p++;
      const r = queriesOf(o, e.A, M5, p); o.ns = r.ns; o.nt = r.nt; nq += r.q.length;
      if (files[files.length - 1].length + r.q.length > MAX_FILLS) files.push([]); files[files.length - 1].push(...r.q); }
    fs.writeFileSync(ORD, JSON.stringify(O));
    const batches = files.map((q, k) => { fs.writeFileSync(path.join(HERE, `fills-${k + 1}.json`), JSON.stringify({ fills: { [SYM]: q } })); return { file: `fills-${k + 1}.json`, tag: `nq1-fills-${k + 1}`, n: q.length }; });
    console.log(JSON.stringify({ noEntryQuote: none, queries: nq, batches }));
  } else if (mode === 'dead') {
    const O = JSON.parse(fs.readFileSync(ORD, 'utf8')), e = readProbe(dir, 'nq1-entry'), f = readProbe(dir, 'nq1-fills');
    const ts = [...new Set(O.filter((o) => tickOrder(o, f.F, e.M, new Map()).needDead).map((o) => o.deadEnd))].sort((a, b) => a - b), files = chunks(ts, MAX_MARKS);
    files.forEach((c, k) => fs.writeFileSync(path.join(HERE, `marks-dead-${k + 1}.json`), JSON.stringify({ [SYM]: c })));
    console.log(JSON.stringify({ deadMarks: ts.length, files: files.length }));
  } else if (mode === 'report') {
    const O = JSON.parse(fs.readFileSync(ORD, 'utf8')), e = readProbe(dir, 'nq1-entry'), d = readProbe(dir, 'nq1-dead'), f = readProbe(dir, 'nq1-fills');
    const rules = LEADS.map((L) => { const rows = O.filter((o) => o.lead === L.id).map((o) => ({ ts: o.ts, side: o.side, b: tickOrder(o, f.F, e.M, d.M), midR: o.midR })); return { id: L.id, name: L.name, stats: stats(rows) }; });
    const hp = holm(rules.map((r) => pOf(r.stats.net.monthT))); rules.forEach((r, i) => { r.holm = r4(hp[i]); r.verdict = verdictOf(r.stats, hp[i]); });
    const pass = rules.filter((r) => r.verdict === 'PASS');
    const out = { study: 'nq1-leads-exec', built: new Date().toISOString().slice(0, 10), commit: commit || null, window: [new Date(FROM * 1000).toISOString().slice(0, 10), new Date(TO * 1000).toISOString().slice(0, 10)], probes: [...e.files, ...d.files, ...f.files], rules };
    out.verdict = `${pass.length} of ${rules.length} pass${pass.length ? ' (' + pass.map((r) => r.id).join(', ') + ')' : ''}. At the broker's own NAS100 bid and ask, after financing: ${rules.map((r) => `${r.id} ${sig(r.stats.net.mean)}R (n ${r.stats.net.n}, month t ${r.stats.net.monthT}; mid ${sig(r.stats.mid.mean)}R)`).join('; ')}.`;
    out.meaning = fs.existsSync(path.join(HERE, 'MEANING.md')) ? fs.readFileSync(path.join(HERE, 'MEANING.md'), 'utf8').trim().split('\n') : ['(to be written)'];
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1)); fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out)); console.log(out.verdict);
  } else console.log('usage: run.mjs orders | queries <probe dir> | dead <probe dir> | report <probe dir> [commit]');
}

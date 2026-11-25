// Mosha 6R barrier: can the better trades be told apart at the entry? (PREREGISTRATION.md, 24 Nov 2026)
// The desk's own 6R reading through research/edge/mosha-barrier-6r's exports; nothing here changes a rule.
//   node research/edge/mosha-6r-quality/run.mjs year <Y> <outDir>    that year's 6R entries with their entry-time features
//   node research/edge/mosha-6r-quality/run.mjs cut <Y> <outDir>     the cut test (look-ahead check)
//   node research/edge/mosha-6r-quality/run.mjs report <outDir>      result.json and RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as B6 from '../mosha-barrier-6r/run.mjs';

const require = createRequire(import.meta.url), SOP = require('../../../assets/mosha-sop.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const COST = 0.30, RR = 6;
export const DISC = [Date.UTC(2018, 0, 1) / 1000, Date.UTC(2022, 0, 1) / 1000];
export const CONF = [Date.UTC(2022, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000];
export const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
export const MIN_LEVEL = 300, SHRINK = 500, MIN_KEEP = 300, SHUFFLES = 40;
export const FEATS = ['tf', 'kind', 'entry', 'dir', 'visit', 'cost', 'stopAtr', 'session', 'trend', 'er'];
const T = (y) => Date.UTC(y, 0, 1) / 1000;

// ─── features, from the record and from candles closed at or before the entry ───
const lastClosed = (bars, sec, t) => { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time + sec <= t) lo = m + 1; else hi = m; } return lo - 1; };
export function atr14(bars, i) {
  if (i < 14) return null; let s = 0;
  for (let k = i - 13; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / 14;
}
export function er20(D, i) {
  if (i < 20) return null; let path = 0;
  for (let k = i - 19; k <= i; k++) path += Math.abs(D[k].close - D[k - 1].close);
  return path > 0 ? Math.abs(D[i].close - D[i - 20].close) / path : null;
}
export const kindOf = (id) => /bar-(j-|sop-)?sw-/.test(id) ? 'sweep' : /bar-(j-|sop-)?eg-/.test(id) ? 'eg' : /bar-(j-|sop-)?cf-/.test(id) ? 'cf' : /bar-(j-|sop-)?vr-/.test(id) ? 'vr' : 'bo';
export function entryOf(r) {
  const id = String(r.id).replace('bar-r6-', 'bar-').replace('bar-old-', 'bar-'), q = SOP.readings(r);
  return q.tap ? 'tap' : /bar-j-/.test(id) ? 'janda' : q.rsop ? 'repeat' : q.atZone ? 'zone' : 'level';
}
export const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h >= 22 || h < 7 ? 'asia' : h < 12 ? 'london' : h < 21 ? 'ny' : 'late'; };
export const costBand = (c) => c <= 0.05 ? '<=0.05' : c <= 0.10 ? '0.05-0.10' : c <= 0.20 ? '0.10-0.20' : '>0.20';
export function raw(r, B) {
  const hi = lastClosed(B['1h'], 3600, r.t), di = lastClosed(B['1d'], 86400, r.t), D = B['1d'];
  const a = atr14(B['1h'], hi), e = er20(D, di);
  let sma = null; if (di >= 49) { sma = 0; for (let k = di - 49; k <= di; k++) sma += D[k].close; sma /= 50; }
  return { tf: r.h, kind: kindOf(String(r.id)), entry: entryOf(r), dir: r.withDir === true ? 'with' : r.withDir === false ? 'against' : 'none',
    visit: SOP.readings(r).visit > 1 ? 'later' : 'first', costR: COST / r.r0, stopAtrV: a ? r.r0 / a : null, session: sessionOf(r.t),
    trend: sma == null ? 'na' : (D[di].close >= sma ? 1 : -1) === r.side ? 'with' : 'against', erV: e };
}
// the levels a trade falls in; the stop terciles' cut points come from discovery
export function levels(x, cuts) {
  return { tf: x.tf, kind: x.kind, entry: x.entry, dir: x.dir, visit: x.visit, cost: costBand(x.costR),
    stopAtr: x.stopAtrV == null ? 'na' : x.stopAtrV <= cuts[0] ? 'small' : x.stopAtrV <= cuts[1] ? 'mid' : 'wide', session: x.session, trend: x.trend,
    er: x.erV == null ? 'na' : x.erV < 0.2 ? '<0.2' : x.erV <= 0.4 ? '0.2-0.4' : '>0.4' };
}

async function year(Y, dir) {
  const { loadFns } = await import('../../../council/mosha-desk.mjs');
  const F = loadFns(), B = B6.candles(Y), t0 = Date.now(), rows = [];
  for (const r of B6.entries(B, F, Y, RR)) { const p = B6.placebo(r, B);
    rows.push({ key: B6.keyOf(r), id: r.id, t: r.t, side: r.side, r0: r.r0, status: r.status, R: r.R, Rp: p.R, ...raw(r, B) }); }
  console.log(Y, rows.length, 'entries', ((Date.now() - t0) / 1000).toFixed(0) + 's', 'm1', B['1m'].length > 0);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `y${Y}.json`), JSON.stringify({ year: Y, m1: B['1m'].length > 0 && B['1m'][0].time <= T(Y), rows }));
}
async function cutTest(Y, dir) {
  const { loadFns } = await import('../../../council/mosha-desk.mjs');
  const F = loadFns(), DAY = 86400, at = T(Y) + 120 * DAY, Bf = B6.candles(Y, at + 40 * DAY);
  const Bc = Object.fromEntries(Object.entries(Bf).map(([k, v]) => [k, v.filter((b) => b.time + SOP.SEC[k] <= at)]));
  const sig = (B) => B6.entries(B, F, Y, RR, at).filter((r) => r.t + 3600 <= at).map((r) => B6.keyOf(r) + '|' + JSON.stringify(raw(r, B))).sort();
  const a = sig(Bf), b = sig(Bc), out = { year: Y, at: new Date(at * 1000).toISOString(), full: a.length, cut: b.length, same: a.length === b.length && a.every((x, i) => x === b[i]) };
  console.log('cut', out); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `cut${Y}.json`), JSON.stringify(out));
}

// ─── the selection rule ───
const mean = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
const quant = (v, q) => { const s = [...v].sort((a, b) => a - b); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
export function fit(disc, netOf = (r) => r.net) {
  const cuts = [quant(disc.filter((r) => r.stopAtrV != null).map((r) => r.stopAtrV), 1 / 3), quant(disc.filter((r) => r.stopAtrV != null).map((r) => r.stopAtrV), 2 / 3)];
  const all = mean(disc.map(netOf)), val = {};
  for (const f of FEATS) { const g = {}; for (const r of disc) { const k = levels(r, cuts)[f]; (g[k] ||= []).push(netOf(r)); }
    val[f] = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length >= MIN_LEVEL ? all + (mean(v) - all) * v.length / (v.length + SHRINK) : all])); }
  const model = { cuts, all, val };
  const sc = disc.map((r) => score(r, model));
  return { ...model, q80: quant(sc, 0.8), q20: quant(sc, 0.2) };
}
export function score(r, m) { const L = levels(r, m.cuts); let s = 0; for (const f of FEATS) s += m.val[f][L[f]] ?? m.all; return s / FEATS.length; }
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null; const ma = mean(a), mb = mean(b);
  const va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (a.length - 1), vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (b.length - 1), se = Math.sqrt(va / a.length + vb / b.length);
  return se > 0 ? (ma - mb) / se : null;
}
const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
// month by month: mean of group A minus mean of group B, t of those monthly differences
export function monthDiffT(A, B) {
  const m = new Map(); for (const [rows, i] of [[A, 0], [B, 1]]) for (const r of rows) { const k = monthOf(r.t), q = m.get(k) || [[], []]; q[i].push(r.net); m.set(k, q); }
  const d = [...m.values()].filter((q) => q[0].length && q[1].length).map((q) => mean(q[0]) - mean(q[1])); if (d.length < 2) return null;
  const mm = mean(d), sd = Math.sqrt(d.reduce((s, x) => s + (x - mm) ** 2, 0) / (d.length - 1)); return sd > 0 ? +(mm / (sd / Math.sqrt(d.length))).toFixed(2) : null;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pTwoLow = (t) => 1 - B6.pOne(t);          // one-sided p for "lower"

export function judge(rows) {
  const done = rows.filter((r) => r.R != null).map((r) => ({ ...r, net: r.R - COST / r.r0 }));
  const disc = done.filter((r) => r.t >= DISC[0] && r.t < DISC[1]), conf = done.filter((r) => r.t >= CONF[0] && r.t < CONF[1]);
  const model = fit(disc), tag = (r) => { const s = score(r, model); return s >= model.q80 ? 'keep' : s <= model.q20 ? 'avoid' : 'mid'; };
  const grp = (set) => { const g = { keep: [], avoid: [], mid: [] }; for (const r of set) g[tag(r)].push(r); return g; };
  const G = grp(conf), GD = grp(disc), rest = (g, k) => Object.entries(g).filter(([x]) => x !== k).flatMap(([, v]) => v);
  const st = (v) => ({ net: B6.stats(v, 'net'), gross: B6.stats(v, 'R') });
  const t2 = welch(G.keep.map((r) => r.net), rest(G, 'keep').map((r) => r.net)), t3 = welch(G.avoid.map((r) => r.net), rest(G, 'avoid').map((r) => r.net));
  const keepNet = B6.stats(G.keep, 'net'), flip = B6.stats(G.keep.filter((r) => r.Rp != null).map((r) => ({ ...r, pn: r.Rp - COST / r.r0 })), 'pn');
  // shuffles: discovery net R permuted across discovery trades, the rule refitted
  const shuf = [];
  for (let s = 1; s <= SHUFFLES; s++) { const rnd = rng(1000 + s), v = disc.map((r) => r.net);
    for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; }
    const net = new Map(disc.map((r, i) => [r, v[i]])), m = fit(disc, (r) => net.get(r)), a = [], b = [];
    for (const r of conf) (score(r, m) >= m.q80 ? a : b).push(r.net); shuf.push(welch(a, b) ?? 0); }
  const beat = shuf.filter((x) => (t2 ?? -Infinity) > x).length;
  const T1 = { n: keepNet.n, mean: keepNet.mean, t: keepNet.t, p: +B6.pOne(keepNet.t).toFixed(4), ok: keepNet.n >= MIN_KEEP && keepNet.mean > 0 && (keepNet.t ?? 0) >= 2 };
  const md = monthDiffT(G.keep, rest(G, 'keep'));
  const T2 = { welch: t2 == null ? null : +t2.toFixed(2), monthDiffT: md, p: +B6.pOne(t2).toFixed(4), ok: (t2 ?? 0) >= 2 && (md ?? 0) > 0 };
  const T3 = { welch: t3 == null ? null : +t3.toFixed(2), p: +pTwoLow(t3).toFixed(4), ok: (t3 ?? 0) <= -2 };
  const H = B6.holm([T1.p, T2.p, T3.p]); [T1, T2, T3].forEach((x, i) => { x.holm = H[i]; x.pass = x.ok && H[i] < 0.05; });
  const placebo = { flipped: flip, flippedPasses: flip.n >= MIN_KEEP && flip.mean > 0 && (flip.t ?? 0) >= 2, shufflesBeaten: beat, shuffles: SHUFFLES, shuffleRange: [+Math.min(...shuf).toFixed(2), +Math.max(...shuf).toFixed(2)] };
  let verdict;
  if (keepNet.n < MIN_KEEP) verdict = 'INCONCLUSIVE';
  else if (T1.pass && T2.pass && !placebo.flippedPasses && beat >= 38) verdict = 'PASS';
  else verdict = 'FAIL';
  const avoidOnly = verdict === 'FAIL' && !T1.pass && T3.pass;
  // every level in both windows
  const lv = [];
  for (const f of FEATS) { const g = {}; for (const [w, set] of [['d', disc], ['c', conf]]) for (const r of set) { const k = levels(r, model.cuts)[f]; ((g[k] ||= { d: [], c: [] })[w]).push(r); }
    for (const [k, q] of Object.entries(g)) lv.push({ f, k, d: st(q.d), c: st(q.c) }); }
  const byYear = {}; for (const r of done) { const y = new Date(r.t * 1000).getUTCFullYear(), k = tag(r); ((byYear[y] ||= { keep: [], avoid: [], mid: [] })[k]).push(r); }
  return { verdict, avoidOnly, model, n: { all: rows.length, open: rows.length - done.length, disc: disc.length, conf: conf.length }, tests: { T1, T2, T3 }, placebo,
    all: { disc: st(disc), conf: st(conf) }, groups: { disc: Object.fromEntries(Object.entries(GD).map(([k, v]) => [k, st(v)])), conf: Object.fromEntries(Object.entries(G).map(([k, v]) => [k, st(v)])) },
    levels: lv, byYear: Object.fromEntries(Object.entries(byYear).map(([y, g]) => [y, Object.fromEntries(Object.entries(g).map(([k, v]) => [k, B6.stats(v, 'net')]))])) };
}

const f = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
function report(dir) {
  const rows = [], m1 = [];
  for (const Y of YEARS) { const j = JSON.parse(fs.readFileSync(path.join(dir, `y${Y}.json`), 'utf8')); rows.push(...j.rows); if (j.m1) m1.push(Y); }
  const cuts = fs.readdirSync(dir).filter((x) => /^cut\d+\.json$/.test(x)).map((x) => JSON.parse(fs.readFileSync(path.join(dir, x), 'utf8')));
  const J = judge(rows), { T1, T2, T3 } = J.tests, C = J.groups.conf, D = J.groups.disc;
  const res = { built: new Date().toISOString().slice(0, 10), verdict: J.verdict, avoidOnly: J.avoidOnly, n: J.n, m1Years: m1, model: J.model, tests: J.tests, placebo: J.placebo, all: J.all, groups: J.groups, levels: J.levels, byYear: J.byYear, cut: cuts };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const g = (s) => `${s.net.n} / ${f(s.net.mean)} (t ${s.net.t ?? 'n/a'}) / ${f(s.gross.mean)} / ${s.gross.win}%`;
  const short = J.verdict === 'PASS' ? `The kept fifth made ${f(T1.mean)}R a trade after costs on 2022-26 (n ${T1.n}, month t ${T1.t}).`
    : `The kept fifth made ${f(T1.mean)}R a trade after costs on 2022-26 (n ${T1.n}, month t ${T1.t}); kept against the rest Welch t ${T2.welch}; ${J.avoidOnly ? 'the avoided fifth is reliably worse, so the rule names trades to skip' : 'the avoided fifth against the rest Welch t ' + T3.welch}.`;
  const L = [`# Mosha 6R barrier: can the better trades be told apart at the entry? (result)`, '', `**Verdict: ${J.verdict}. ${short}**`, '',
    `Built ${res.built}. Pre-registered (PREREGISTRATION.md, committed alone before any run). Paper research only; nothing live changed.`, '',
    `Gold, the desk's own 6R barrier reading. Rule chosen on entries 2018-2021 (${J.n.disc} trades), judged on 2022 to October 2026 (${J.n.conf} trades). ${J.n.open} trades still open at the end of their candles are left out. R after costs = R − 0.30 / r0.`, '',
    '## All trades', '', '| Window | n / R after costs (month t) / R before costs / winners |', '|---|---|', `| 2018-21 | ${g(J.all.disc)} |`, `| 2022-26 | ${g(J.all.conf)} |`, '',
    '## The three groups', '', '| Group | 2018-21 (where it was chosen) | 2022-26 (the test) |', '|---|---|---|',
    ...['keep', 'mid', 'avoid'].map((k) => `| ${k} | ${g(D[k])} | ${g(C[k])} |`), '',
    '## Tests on 2022-26', '', '| Test | Result | Holm p | Pass |', '|---|---|---|---|',
    `| T1 kept trades profitable after costs | n ${T1.n}, ${f(T1.mean)}R, month t ${T1.t} | ${T1.holm} | ${T1.pass ? 'yes' : 'no'} |`,
    `| T2 kept beat the rest | Welch t ${T2.welch}, month-difference t ${T2.monthDiffT} | ${T2.holm} | ${T2.pass ? 'yes' : 'no'} |`,
    `| T3 avoided are worse than the rest | Welch t ${T3.welch} | ${T3.holm} | ${T3.pass ? 'yes' : 'no'} |`, '',
    `Placebo: the kept trades with the side flipped made ${f(J.placebo.flipped.mean)}R after costs (n ${J.placebo.flipped.n}, month t ${J.placebo.flipped.t}); the real kept-against-rest t beats ${J.placebo.shufflesBeaten} of ${J.placebo.shuffles} rules fitted on shuffled results (their t from ${J.placebo.shuffleRange[0]} to ${J.placebo.shuffleRange[1]}).`, '',
    '## Every feature level, both windows (R after costs; descriptive)', '', '| Feature | Level | 2018-21 n / R (t) | 2022-26 n / R (t) | before costs 18-21 / 22-26 | Same sign |', '|---|---|---|---|---|---|',
    ...J.levels.map((x) => `| ${x.f} | ${x.k} | ${x.d.net.n} / ${f(x.d.net.mean)} (${x.d.net.t ?? 'n/a'}) | ${x.c.net.n} / ${f(x.c.net.mean)} (${x.c.net.t ?? 'n/a'}) | ${f(x.d.gross.mean)} / ${f(x.c.gross.mean)} | ${x.d.net.mean != null && x.c.net.mean != null && Math.sign(x.d.net.mean) === Math.sign(x.c.net.mean) ? 'yes' : 'no'} |`), '',
    '## By year (R after costs, n)', '', '| Year | keep | mid | avoid |', '|---|---|---|---|',
    ...Object.entries(J.byYear).map(([y, q]) => `| ${y} | ${['keep', 'mid', 'avoid'].map((k) => `${f(q[k].mean)} (${q[k].n})`).join(' | ')} |`), '',
    '## Notes', '',
    `- Score cut points from 2018-21: keep at or above ${J.model.q80.toFixed(4)}, avoid at or below ${J.model.q20.toFixed(4)}; stop / ATR terciles at ${J.model.cuts.map((x) => x.toFixed(3)).join(' and ')}.`,
    `- M1 candles reach the start of ${m1.length} of ${YEARS.length} years (${m1.join(', ')}).`,
    ...cuts.map((c) => `- Cut test ${c.year} at ${c.at.slice(0, 10)}: ${c.full} entries with their features, ${c.same ? 'identical' : 'DIFFERENT'} when later candles are removed.`),
    '- Several barrier entries can be open at once; month sums carry that clustering.', '- One run. No other score, band, percentile or feature is tried on these years.'];
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n') + '\n');
  console.log(J.verdict, short);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'year') await year(+a, b); else if (cmd === 'cut') await cutTest(+a, b); else if (cmd === 'report') report(a); else { console.log('year <Y> <dir> | cut <Y> <dir> | report <dir>'); process.exit(1); }
}

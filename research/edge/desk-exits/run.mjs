// desk-exits: the desks' own entries with a 1R / 2R / 3R target or a trailing stop, against each desk's own exit.
// Pre-registered in PREREGISTRATION.md (committed first). Paper research: nothing live reads it.
//   node --use-env-proxy research/edge/desk-exits/run.mjs fetch <dir>   candles (OANDA 5m via the site) + the desk files
//   node research/edge/desk-exits/run.mjs run <dir>                     result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readDesk } from '../../../council/desk-store.mjs';

// the desk-rigor study's cost model and statistics, copied (importing that file would run its command line)
const PIP = { eurusd: 0.0001, gbpusd: 0.0001 };
export const cost = (mk, px) => (PIP[mk] ? 0.000045 * px + 0.5 * PIP[mk] : px * 0.00005);
const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function stats(rows, key = 'net') {
  const n = rows.length; if (!n) return { n: 0 };
  const v = rows.map((r) => r[key]), sum = v.reduce((a, b) => a + b, 0), months = new Map(); for (const r of rows) months.set(monthOf(r.t), (months.get(monthOf(r.t)) || 0) + r[key]);
  const ms = [...months.values()], mm = ms.reduce((a, b) => a + b, 0) / ms.length, mv = ms.length > 1 ? ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (ms.length - 1) : 0, t = mv > 0 ? mm / Math.sqrt(mv / ms.length) : null;
  let eq = 0, peak = 0, dd = 0; for (const x of v) { eq += x; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
  return { n, win: +(100 * rows.filter((r) => r[key] > 0).length / n).toFixed(1), mean: +(sum / n).toFixed(4), total: +sum.toFixed(2), dd: +dd.toFixed(2), months: ms.length, tMonth: t == null ? null : +t.toFixed(2) };
}
export function monthDiff(A, B) {
  const m = new Map(); for (const [rows, k] of [[A, 'a'], [B, 'b']]) for (const r of rows) { const x = m.get(monthOf(r.t)) || { a: [], b: [] }; x[k].push(r.net); m.set(monthOf(r.t), x); }
  const d = [...m.values()].filter((x) => x.a.length && x.b.length).map((x) => x.a.reduce((s, v) => s + v, 0) / x.a.length - x.b.reduce((s, v) => s + v, 0) / x.b.length);
  if (d.length < 2) return { months: d.length, diff: null, t: null };
  const mm = d.reduce((a, b) => a + b, 0) / d.length, v = d.reduce((a, b) => a + (b - mm) ** 2, 0) / (d.length - 1);
  return { months: d.length, diff: +mm.toFixed(4), t: v > 0 ? +(mm / Math.sqrt(v / d.length)).toFixed(2) : null };
}
export const pOne = (t) => { if (t == null) return 1; const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * z), erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-z * z); const p = 0.5 * (1 - erf); return t > 0 ? p : 1 - p; };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MD = (process.env.MD_BASE || 'https://aureumdesk.co.uk/md/').replace(/\/?$/, '/');
export const DESKS = ['mosha', 'eg', 'msnr', 'lit'];
export const GROUPS = {
  mosha: ['sop', 'barrier'], eg: ['eg-1d', 'eg-4h', 'eg-1h', 'eg-plan', 'eg-simple', 'eg-direct'],
  msnr: ['msnr-main', 'msnr-other', 'msnr-sop', 'msnr-qm'], lit: ['lit-rule', 'lit-loose', 'lit-break'] };
export const NAME = { sop: 'Mosha sequence', barrier: 'Mosha barrier entry', 'eg-1d': 'Engulf D1', 'eg-4h': 'Engulf H4', 'eg-1h': 'Engulf H1',
  'eg-plan': 'Engulf plan (with the Daily)', 'eg-simple': 'Engulf short method', 'eg-direct': 'Engulf direct entry',
  'msnr-main': 'MSNR with the direction, 12-16 UTC', 'msnr-other': 'MSNR with the direction, other hours', 'msnr-sop': 'MSNR gold plan',
  'msnr-qm': 'MSNR gold plan, QM entry', 'lit-rule': 'LIT, the rule\'s execution', 'lit-loose': 'LIT, loose limit', 'lit-break': 'LIT, market on the break' };
export const EXITS = ['X1', 'X2', 'X3', 'XT'];
export const EXIT_NAME = { X1: 'Target 1R', X2: 'Target 2R', X3: 'Target 3R', XT: 'Trailing stop (1R behind from +1R)', booked: 'The desk\'s own exit' };
export const CAP_S = 120 * 3600;   // a trade still running 5 days after its fill exits at that candle's close
const SEC = 300;

// ─── one exit on one trade ───
// bars: 5m candles sorted by time; returns { R, how, end } or null when the candles end before an exit
export function exitR(tr, bars, x, i0) {
  const d = tr.side > 0 ? 1 : -1, e = +tr.entry, r0 = Math.abs(e - +tr.stop);
  if (!(r0 > 0)) return null;
  const tgt = x === 'XT' ? null : e + d * r0 * { X1: 1, X2: 2, X3: 3 }[x];
  let stop = +tr.stop, best = e;
  let i = i0 == null ? firstAt(bars, tr.t) : i0;
  if (i < 0) return null;
  const R = (px) => d * (px - e) / r0;
  for (; i < bars.length; i++) {
    const b = bars[i], first = b.time <= tr.t, hi = b.high, lo = b.low;
    if (b.time - tr.t > CAP_S) return { R: R(bars[i - 1].close), how: 'time', end: bars[i - 1].time };
    if (!first && (d > 0 ? b.open <= stop : b.open >= stop)) return { R: R(b.open), how: 'gap', end: b.time };
    if (d > 0 ? lo <= stop : hi >= stop) return { R: R(stop), how: stop === +tr.stop ? 'stop' : 'trail', end: b.time };
    if (first) continue;                                            // the fill candle can only stop the trade
    if (tgt != null && (d > 0 ? hi >= tgt : lo <= tgt)) return { R: R(tgt), how: 'target', end: b.time };
    if (x === 'XT') { best = d > 0 ? Math.max(best, hi) : Math.min(best, lo); if (d * (best - e) >= r0) { const s = best - d * r0; if (d * (s - stop) > 0) stop = s; } }
  }
  return null;
}
// the candle holding the fill: the last candle whose open is at or before t
export function firstAt(bars, t) {
  let lo = 0, hi = bars.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m].time <= t) { k = m; lo = m + 1; } else hi = m - 1; }
  return k >= 0 && t - bars[k].time < SEC ? k : -1;
}

// ─── candles ───
const cfile = (dir, mk) => path.join(dir, `${mk}-5m.json.gz`);
export const loadBars = (dir, mk) => JSON.parse(zlib.gunzipSync(fs.readFileSync(cfile(dir, mk)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
async function fetchMarket(dir, mk, from, to) {
  const out = new Map();
  for (let t = to; t > from;) { const f = Math.max(from, t - 4000 * SEC);
    let j = null; for (let a = 0; a < 4 && !j; a++) { try { const r = await fetch(`${MD}bars?sym=${mk}&tf=5m&from=${f}&to=${t}`, { signal: AbortSignal.timeout(30000) }); if (r.ok) j = await r.json(); else if (r.status !== 429 && r.status < 500) throw new Error('HTTP ' + r.status); } catch (e) { if (a === 3) throw e; } if (!j) await new Promise((ok) => setTimeout(ok, 2000 * (a + 1))); }
    for (const b of (j.bars || j || [])) out.set(b.time, [b.time, b.open, b.high, b.low, b.close]); t = f; }
  const rows = [...out.values()].sort((a, b) => a[0] - b[0]).filter((r) => r[0] + SEC <= to);
  fs.writeFileSync(cfile(dir, mk), zlib.gzipSync(JSON.stringify(rows)));
  return rows.length;
}
async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const repo = path.resolve(HERE, '../../..');
  // the desk files as they stand on council-data (light desk.json + day files), read back whole
  const tree = path.join(dir, 'desks'); fs.mkdirSync(tree, { recursive: true });
  execFileSync('git', ['-C', repo, 'fetch', '-q', 'origin', 'council-data']);
  const tar = execFileSync('git', ['-C', repo, 'archive', 'origin/council-data', ...DESKS], { maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', tree], { input: tar });
  const trades = loadTrades(dir), mks = [...new Set(trades.map((r) => r.market))];
  const from = Math.min(...trades.map((r) => r.t)) - 2 * 86400, to = Math.floor(Date.now() / 1000);
  for (const mk of mks) console.log(mk, await fetchMarket(dir, mk, from, to), 'candles');
}

// ─── the trades ───
export function loadTrades(dir) {
  const out = [];
  for (const d of DESKS) { const j = readDesk(path.join(dir, 'desks'), d); if (!j) continue;
    for (const r of j.records) if (r.R != null && GROUPS[d].includes(r.kind) && Number.isFinite(+r.entry) && Number.isFinite(+r.stop))
      out.push({ desk: d, kind: r.kind, id: r.id, market: r.market || 'xau', side: r.side, t: r.t, entry: +r.entry, stop: +r.stop, booked: +r.R }); }
  return out.sort((a, b) => a.t - b.t);
}

// ─── the study ───
export function evaluate(trades, barsOf) {
  const rows = [], left = {};
  for (const tr of trades) { const bars = barsOf(tr.market); const i0 = bars ? firstAt(bars, tr.t) : -1;
    const c = cost(tr.market, tr.entry) / Math.abs(tr.entry - tr.stop), row = { ...tr, costR: c, ex: {} };
    let ok = i0 >= 0;
    for (const x of EXITS) { const o = ok ? exitR(tr, bars, x, i0) : null; if (!o) { ok = false; break; } row.ex[x] = o; }
    if (!ok) { left[tr.kind] = (left[tr.kind] || 0) + 1; continue; }
    rows.push(row); }
  return { rows, left };
}
const view = (rows, x, net) => rows.map((r) => { const g = x === 'booked' ? r.booked : r.ex[x].R; return { t: r.t, gross: g, net: g - r.costR }; });
export function compare(rows) {
  const groups = {}, tests = [];
  for (const d of DESKS) for (const k of GROUPS[d]) { const g = rows.filter((r) => r.kind === k); if (!g.length) continue;
    const ts = g.map((r) => r.t).sort((a, b) => a - b), mid = ts[Math.floor(ts.length / 2)];
    const out = { desk: d, kind: k, name: NAME[k], n: g.length, from: ts[0], to: ts[ts.length - 1], exits: {} };
    for (const x of ['booked', ...EXITS]) { const v = view(g, x); out.exits[x] = { gross: stats(v, 'gross'), net: stats(v, 'net'),
      hows: x === 'booked' ? null : Object.fromEntries(['target', 'stop', 'trail', 'gap', 'time'].map((h) => [h, g.filter((r) => r.ex[x].how === h).length])) };
      if (x === 'booked') continue;
      const diff = monthDiff(view(g, x), view(g, 'booked')), half = [g.filter((r) => r.t < mid), g.filter((r) => r.t >= mid)].map((h) => { const a = view(h, x), b = view(h, 'booked'); return h.length ? +((a.reduce((s, r) => s + r.net, 0) - b.reduce((s, r) => s + r.net, 0)) / h.length).toFixed(4) : null; });
      const t = { group: k, exit: x, diff: diff.diff, months: diff.months, tMonth: diff.t, p: pOne(diff.t == null ? null : Math.abs(diff.t)) * 2, halves: half };
      out.exits[x].vsBooked = t; tests.push(t); }
    groups[k] = out; }
  // Holm over every comparison
  const order = tests.map((t, i) => [Math.min(1, t.p), i]).sort((a, b) => a[0] - b[0]); let run = 0;
  order.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (order.length - k))); tests[i].holm = +run.toFixed(4); });
  for (const t of tests) { const pos = t.diff > 0 && t.tMonth >= 2 && t.holm < 0.05 && t.halves.every((h) => h > 0), neg = t.diff < 0 && t.tMonth <= -2 && t.holm < 0.05 && t.halves.every((h) => h < 0);
    t.verdict = pos ? 'better' : neg ? 'worse' : 'no better'; t.p = +t.p.toFixed(4); }
  return { groups, tests };
}

// ─── the report ───
const f2 = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const d10 = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export function report(res, meta) {
  const L = ['# Desk exits: 1R, 2R, 3R targets or a trailing stop on every desk\'s trades', '',
    'Pre-registered (PREREGISTRATION.md, committed first). The desks\' own entries of 2026, each run alone on OANDA mid 5-minute candles ' +
    'with a target of 1R, 2R or 3R, or a trailing stop 1R behind the best price from +1R, against the exit each desk books. ' +
    'Mean R a trade, before costs and after the desk-rigor cost model. In sample: a "better" here is a hypothesis for the 2020-2025 harness, never a rule.', '',
    `**Verdict: ${res.verdict}.** ${res.headline}`, '',
    `Trades: ${meta.n} closed records (${meta.left} left out: their candles ended before an exit, or no candle at the fill).`, ''];
  for (const g of Object.values(res.groups)) {
    L.push(`## ${g.name} (${g.desk}, n ${g.n}, ${d10(g.from)} to ${d10(g.to)})`, '', '| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const x of ['booked', ...EXITS]) { const e = g.exits[x], v = e.vsBooked;
      L.push(`| ${EXIT_NAME[x]} | ${f2(e.gross.mean)} | ${f2(e.net.mean)} | ${e.net.win} | ${f2(e.net.total)} | ${e.net.tMonth ?? 'n/a'} | ${v ? f2(v.diff) + ' (t ' + (v.tMonth ?? 'n/a') + ')' : '—'} | ${v ? v.holm : '—'} | ${v ? v.halves.map(f2).join(' / ') : '—'} | ${v ? v.verdict : '—'} |`); }
    L.push(''); }
  L.push('## Read with', '', '- "Against own exit" compares two harnesses, not only two exits: this study fills on 5-minute candles (the fill candle can only stop) and closes a trade after 5 days, while a desk reads its own fills on its finest candles and has its own time rules. ' +
    'So a fixed target equal to the desk\'s own (the Mosha barrier\'s 3R, the MSNR QM\'s 3R) can still differ from the booked figure: read the four exits against each other first, and "against own exit" second.', '',
    '## What this is not', '', '- In sample: these entries were built on these candles; the best exit chosen after seeing it is a fit.',
    '- Each trade was run alone: a desk holding one position at a time would have taken other later trades with other exits.',
    '- 2026 only; the Mosha desk from late July (about four months), so its month t rests on few months.',
    '- Nothing live changed: no desk, rule, stop or record reads this.', '');
  return L.join('\n');
}

async function main() {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') return fetchAll(dir);
  if (cmd !== 'run') throw new Error('usage: run.mjs fetch|run <dir>');
  const trades = loadTrades(dir), cache = {};
  const barsOf = (mk) => (mk in cache ? cache[mk] : (cache[mk] = fs.existsSync(cfile(dir, mk)) ? loadBars(dir, mk) : null));
  const { rows, left } = evaluate(trades, barsOf), cmp = compare(rows);
  const better = cmp.tests.filter((t) => t.verdict === 'better'), worse = cmp.tests.filter((t) => t.verdict === 'worse');
  const res = { study: 'desk-exits', built: '2026-11-21', system: 'The Mosha, Engulfing, MSNR and LIT desks\' own entries of 2026 with 1R / 2R / 3R targets or a trailing stop, against each desk\'s own exit; OANDA mid 5m; before and after the desk-rigor cost model; in sample.',
    verdict: better.length ? 'PASS' : 'FAIL', headline: `${better.length} of ${cmp.tests.length} exit-group comparisons better than the desk's own exit after costs on the pre-registered bar${better.length ? ' (' + better.map((t) => { const e = cmp.groups[t.group].exits[t.exit].net.mean; return NAME[t.group] + ', ' + EXIT_NAME[t.exit] + ': ' + (e >= 0 ? '+' : '−') + Math.abs(e).toFixed(3) + 'R a trade after costs' + (e < 0 ? ', still a loss' : ''); }).join('; ') + ')' : ''}; ${worse.length} worse. A better exit is not a profitable one: read the after-costs column.`,
    n: rows.length, left, ...cmp };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res, { n: rows.length, left: Object.values(left).reduce((a, b) => a + b, 0) }));
  console.log(res.verdict, res.headline);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });

// Position sizing study for the live systems (pre-registered in preregistration.md, committed before this ran). Paper only:
// nothing here touches a live rule, size or config. Four overlays on each system's existing per-trade record:
//   fixed 1R | inverse 20-day realised vol (0.5x-2x) | drawdown throttle (0.5x beyond X R under peak, back at a new peak) |
//   decay-monitor throttle (council/decay.mjs assess(), healthy 1x / watch 0.5x / decaying 0x), all causal.
//
//   node research/edge/sizing/run.mjs fetch <cacheDir>                                   OANDA daily candles (site proxy)
//   node research/edge/sizing/run.mjs build <cacheDir> <ict trades.json> <replica trades.json>   -> inputs.json
//   node research/edge/sizing/run.mjs                                                    -> result.json + tables
// <ict trades.json> is research/edge/ict-oos-2008/run.mjs output; <replica trades.json> is research/edge/replica-oos/replay.mjs
// output (positions with leg close times). The NQ and gold-system records are read from their committed result.json files.
import fs from 'node:fs';
import path from 'node:path';
import { assess } from '../../../council/decay.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.join(HERE, '../../..');
const IN_FILE = path.join(HERE, 'inputs.json'), OUT_FILE = path.join(HERE, 'result.json');
const [MODE, ...ARGS] = process.argv.slice(2);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v), r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
const SYMS = ['xau', 'nas100', 'spx500', 'us30'];

// ───────────── fetch: OANDA daily candles through the site's free proxy ─────────────
async function fetchDaily(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const FROM = Date.UTC(2003, 0, 1) / 1000, END = Date.UTC(2026, 10, 8) / 1000, STEP = 4000 * 86400;
  for (const sym of SYMS) {
    const f = path.join(dir, `${sym}-1d.json`); if (fs.existsSync(f)) { console.log(sym, 'cached'); continue; }
    const m = new Map();
    for (let a = FROM; a < END; a += STEP) {
      const b = Math.min(END, a + STEP); let j = null;
      for (let k = 0; k < 5 && !j; k++) { try { const r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=1d&from=${a}&to=${b}`); const x = r.ok ? await r.json() : null; if (x && Array.isArray(x.bars)) j = x; } catch (e) { /* retry */ } if (!j) await new Promise((r) => setTimeout(r, 1500 * (k + 1))); }
      if (!j) throw new Error(`${sym} ${a}: no data`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(x.time, [x.time, x.close]);
    }
    const bars = [...m.values()].sort((p, q) => p[0] - q[0]); fs.writeFileSync(f, JSON.stringify(bars));
    console.log(sym, bars.length, new Date(bars[0][0] * 1000).toISOString().slice(0, 10), '->', new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10));
  }
}

// ───────────── build: the systems' records + the inverse-vol inputs at each entry ─────────────
// 20-day realised vol after each completed daily candle, and its trailing 756-day median (needs >= 120 values)
function volSeries(bars) {
  const B = bars.filter(([t]) => { const d = new Date(t * 1000).getUTCDay(); return d !== 0 && d !== 6; }), out = [];
  const ret = B.map((b, i) => (i ? Math.log(b[1] / B[i - 1][1]) : null)), vols = [];
  for (let i = 0; i < B.length; i++) {
    let vol = null;
    if (i >= 20) { const w = ret.slice(i - 19, i + 1), m = w.reduce((s, x) => s + x, 0) / 20; vol = Math.sqrt(w.reduce((s, x) => s + (x - m) ** 2, 0) / 19); }
    vols.push(vol);
    const hist = vols.slice(Math.max(0, i - 755), i + 1).filter((v) => v != null).sort((a, b) => a - b);
    const target = vol != null && hist.length >= 120 ? hist[hist.length >> 1] : null;
    out.push({ done: B[i][0] + 86400, vol, target });
  }
  return out;
}
function volAt(series, t) { let lo = 0, hi = series.length; while (lo < hi) { const m = (lo + hi) >> 1; if (series[m].done <= t) lo = m + 1; else hi = m; } return lo ? series[lo - 1] : null; }
// New York local date + minutes -> unix seconds (DST from the platform's tz data)
function nyTime(d, minutes) {
  const [y, mo, da] = d.split('-').map(Number), f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' });
  for (const off of [4, 5]) { const t = Date.UTC(y, mo - 1, da, 0, minutes) + off * 3600e3, [h, mi] = f.format(new Date(t)).split(':').map(Number); if ((h % 24) * 60 + mi === minutes) return t / 1000; }
  throw new Error('nyTime ' + d);
}
function build(dir, ictFile, repFile) {
  const V = Object.fromEntries(SYMS.map((s) => [s, volSeries(JSON.parse(fs.readFileSync(path.join(dir, `${s}-1d.json`), 'utf8')))]));
  const row = (entry, close, mkt, n1, n2) => { const v = volAt(V[mkt], entry); return [entry, close, mkt, r3(n1), r3(n2), v && v.vol != null ? +v.vol.toFixed(6) : null, v && v.target != null ? +v.target.toFixed(6) : null]; };
  const S = {};
  // ICT A-setups, 4 markets pooled
  const J = JSON.parse(fs.readFileSync(ictFile, 'utf8')), C = Object.fromEntries(J.cols.map((c, i) => [c, i])), MK = { gc: 'xau', nq: 'nas100', es: 'spx500', ym: 'us30' };
  const t0 = Date.UTC(2008, 0, 1) / 1000, t1 = Date.UTC(2026, 10, 1) / 1000;
  S['ict-a'] = J.trades.filter((r) => r[C.cfg] === 'rule' && r[C.aset] && r[C.close] >= t0 && r[C.close] < t1)
    .map((r) => row(r[C.close], r[C.closed], MK[r[C.market]], r[C.size] * (r[C.Rraw] - r[C.costR]), r[C.size] * (r[C.Rraw] - 2 * r[C.costR])));
  // NQ New York open run (out at 11:00 ET at the latest; close time taken as 11:00 ET, an upper bound)
  const NQ = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge/nq-open-oos/result.json'), 'utf8'));
  S['nq-open'] = NQ.trades.map((x) => row(nyTime(x.d, x.m), nyTime(x.d, 660), 'nas100', x.R, x.R - 1 / x.r0));
  // gold replica: first unit + add, sized as live; 0.30 / 0.60 a unit
  const RP = JSON.parse(fs.readFileSync(repFile, 'utf8'));
  S.replica = RP.positions.map((p) => row(p.T, Math.max(...p.legs.map((l) => l.closed)), 'xau',
    p.legs.reduce((a, l) => a + (l.R - 0.30 / l.r0) * l.size, 0), p.legs.reduce((a, l) => a + (l.R - 0.60 / l.r0) * l.size, 0)));
  // gold trend N20 and gold daily engulf
  const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge/gold-systems-oos/result.json'), 'utf8')), iso = (s) => Date.parse(s + ':00Z') / 1000;
  for (const k of ['gtrend', 'geg']) S[k] = G.positions.filter((p) => p.sys === k).map((p) => row(iso(p.t), iso(p.c), 'xau', p.n, p.n2));
  for (const k of Object.keys(S)) S[k].sort((a, b) => a[0] - b[0]);
  const out = { built: new Date().toISOString(), cols: ['entry', 'close', 'market', 'net1', 'net2', 'vol20', 'volTarget'],
    note: 'net R per position after costs x1 / x2, sized as live; vol20 = sd of daily log returns over the 20 completed OANDA daily candles before entry; volTarget = trailing 756-day median of vol20 (null in warm-up)', systems: S };
  fs.writeFileSync(IN_FILE, JSON.stringify(out));
  for (const [k, a] of Object.entries(S)) console.log(k, a.length, new Date(a[0][0] * 1000).toISOString().slice(0, 10), '->', new Date(a.at(-1)[0] * 1000).toISOString().slice(0, 10), 'no vol', a.filter((r) => r[6] == null).length);
}

// ───────────── run ─────────────
const SYSTEMS = [
  { id: 'ict-a', name: 'ICT A-setups', split: 2017 },
  { id: 'nq-open', name: 'NQ New York open run', split: 2015 },
  { id: 'replica', name: 'Gold replica', split: 2022 },
  { id: 'gtrend', name: 'Gold trend N20', split: 2017 },
  { id: 'geg', name: 'Gold daily engulf', split: 2017 },
];
const PORT_SPLIT = 2015, RULES = ['fixed', 'invvol', 'ddthrottle', 'decay'];

// multipliers for one system's positions (rows sorted by entry), every rule causal: only positions closed by the entry count
function multipliers(rows, base, { ddX }) {
  const byClose = rows.map((r, i) => ({ i, c: r[1], R: r[3] })).sort((a, b) => a.c - b.c);
  const inv = rows.map((r) => (r[5] && r[6] ? Math.min(2, Math.max(0.5, r[6] / r[5])) : 1));
  // drawdown throttle on the fixed-1R record
  const dd = {}, decay = [], status = [];
  for (const [k, X] of Object.entries(ddX)) {
    let p = 0, eq = 0, pk = 0, half = false; const m = [];
    for (const r of rows) {
      while (p < byClose.length && byClose[p].c <= r[0]) { eq += byClose[p].R; if (eq >= pk) { pk = eq; half = false; } if (pk - eq > X) half = true; p++; }
      m.push(half ? 0.5 : 1);
    }
    dd[k] = m;
  }
  // decay monitor: assess() on the record closed before the entry
  let p = 0; const rec = []; let lastN = -1, lastSt = 'healthy';
  for (const r of rows) {
    while (p < byClose.length && byClose[p].c <= r[0]) { rec.push({ t: byClose[p].c, R: byClose[p].R, src: 'hist' }); p++; }
    if (rec.length !== lastN) { lastSt = assess(rec, base).status; lastN = rec.length; }
    status.push(lastSt); decay.push(lastSt === 'healthy' ? 1 : lastSt === 'watch' ? 0.5 : 0);
  }
  return { fixed: rows.map(() => 1), invvol: inv, ddthrottle: dd.x050, ddX025: dd.x025, ddX100: dd.x100, decay, status };
}

// stats over sized positions [{ e, c, v, m }]
function measure(P) {
  const a = [...P].sort((x, y) => x.c - y.c); let eq = 0, pk = 0, mdd = 0; const Y = new Map();
  for (const x of a) { eq += x.v; if (eq > pk) pk = eq; if (pk - eq > mdd) mdd = pk - eq; const y = yearOf(x.c); Y.set(y, (Y.get(y) || 0) + x.v); }
  const ys = [...Y.values()], n = a.length;
  return { n, total: r2(eq), maxDD: r2(mdd), retDD: mdd > 0 ? r2(eq / mdd) : null, worstYear: ys.length ? r2(Math.min(...ys)) : null,
    years: ys.length, posYears: ys.filter((v) => v > 0).length, posShare: ys.length ? r2(ys.filter((v) => v > 0).length / ys.length) : null,
    meanM: n ? r3(a.reduce((s, x) => s + x.m, 0) / n) : null, byYear: Object.fromEntries([...Y].sort((p, q) => p[0] - q[0]).map(([y, v]) => [y, r2(v)])) };
}
const periods = (P, split) => ({ all: measure(P), h1: measure(P.filter((x) => yearOf(x.e) < split)), h2: measure(P.filter((x) => yearOf(x.e) >= split)) });

function run() {
  const IN = JSON.parse(fs.readFileSync(IN_FILE, 'utf8')), BASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'council/decay-base.json'), 'utf8')).systems;
  const out = { at: new Date().toISOString(), prereg: 'research/edge/sizing/preregistration.md', inputsBuilt: IN.built, systems: {}, portfolio: {}, sensitivity: {}, decision: {} };
  const sized = { x1: Object.fromEntries([...RULES, 'ddX025', 'ddX100'].map((r) => [r, []])), x2: Object.fromEntries([...RULES, 'ddX025', 'ddX100'].map((r) => [r, []])) };
  for (const s of SYSTEMS) {
    const rows = IN.systems[s.id], b = BASE[s.id], X = 0.5 * b.maxDD;
    const M = multipliers(rows, b, { ddX: { x025: 0.25 * b.maxDD, x050: X, x100: b.maxDD } });
    const o = (out.systems[s.id] = { name: s.name, n: rows.length, from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10), split: s.split,
      ddX: r3(X), decayBase: { ref: b.ref, sd: b.sd, k: b.k, h: b.h, ddLimit: b.ddLimit }, invvolWarmup: rows.filter((r) => r[6] == null).length, x1: {}, x2: {} });
    for (const rule of [...RULES, 'ddX025', 'ddX100']) for (const [ck, col] of [['x1', 3], ['x2', 4]]) {
      const P = rows.map((r, i) => ({ e: r[0], c: r[1], v: M[rule][i] * r[col], m: M[rule][i], sys: s.id }));
      sized[ck][rule].push(...P);
      if (RULES.includes(rule)) o[ck][rule] = periods(P, s.split); else (out.sensitivity[s.id] = out.sensitivity[s.id] || {})[`${rule}_${ck}`] = periods(P, s.split);
    }
    // time the decay monitor spent in each status (share of positions), by half
    const st = (f) => { const a = M.status.filter((_, i) => f(rows[i][0])); return Object.fromEntries(['healthy', 'watch', 'decaying'].map((k) => [k, a.length ? r2(a.filter((x) => x === k).length / a.length) : null])); };
    o.decayStatusShare = { h1: st((t) => yearOf(t) < s.split), h2: st((t) => yearOf(t) >= s.split) };
    o.ddHalfShare = { h1: r2(M.ddthrottle.filter((m, i) => yearOf(rows[i][0]) < s.split && m < 1).length / Math.max(1, rows.filter((r) => yearOf(r[0]) < s.split).length)),
      h2: r2(M.ddthrottle.filter((m, i) => yearOf(rows[i][0]) >= s.split && m < 1).length / Math.max(1, rows.filter((r) => yearOf(r[0]) >= s.split).length)) };
  }
  for (const ck of ['x1', 'x2']) { out.portfolio[ck] = {}; for (const rule of RULES) out.portfolio[ck][rule] = periods(sized[ck][rule], PORT_SPLIT); }
  out.sensitivity.portfolio = Object.fromEntries(['ddX025', 'ddX100'].flatMap((r) => ['x1', 'x2'].map((ck) => [`${r}_${ck}`, periods(sized[ck][r], PORT_SPLIT)])));
  // ── the pre-registered decision ──
  const P = out.portfolio, better = (a, b) => a != null && b != null && (b > 0 ? a >= 1.1 * b : a > b + 0.1 * Math.abs(b));
  for (const rule of RULES.slice(1)) {
    const c1 = ['h1', 'h2'].every((h) => better(P.x1[rule][h].retDD, P.x1.fixed[h].retDD));
    const c2 = ['h1', 'h2'].every((h) => better(P.x2[rule][h].retDD, P.x2.fixed[h].retDD));
    const c3 = ['h1', 'h2'].every((h) => P.x1[rule][h].posShare >= P.x1.fixed[h].posShare);
    const wins = Object.fromEntries(['h1', 'h2'].map((h) => [h, SYSTEMS.filter((s) => { const o = out.systems[s.id].x1; return (o[rule][h].retDD ?? -Infinity) > (o.fixed[h].retDD ?? -Infinity); }).map((s) => s.id)]));
    const c4 = wins.h1.length >= 3 && wins.h2.length >= 3;
    out.decision[rule] = { pass: c1 && c2 && c3 && c4, c1_portfolioRetDDx1: c1, c2_portfolioRetDDx2: c2, c3_posYears: c3, c4_systemsBetter: c4, systemsBetter: wins,
      worseHalfRetDD: Math.min(P.x1[rule].h1.retDD, P.x1[rule].h2.retDD) };
  }
  // ── post-hoc diagnostics (added after the results; cannot change the decision) ──
  // (a) timing vs weighting: each system held at a CONSTANT weight equal to the overlay's mean multiplier over its whole
  //     history (hindsight weights), summed into a portfolio. If the overlay beats this, its timing added something.
  out.posthoc = { note: 'added after the results were seen; descriptive only, cannot change the decision', constantWeight: {}, decayFreshPerHalf: {} };
  for (const rule of RULES.slice(1)) {
    const w = Object.fromEntries(SYSTEMS.map((s) => [s.id, out.systems[s.id].x1[rule].all.meanM]));
    const P = SYSTEMS.flatMap((s) => IN.systems[s.id].map((r) => ({ e: r[0], c: r[1], v: w[s.id] * r[3], m: w[s.id] })));
    const p = periods(P, PORT_SPLIT); out.posthoc.constantWeight[rule] = { weights: w, h1: { total: p.h1.total, maxDD: p.h1.maxDD, retDD: p.h1.retDD }, h2: { total: p.h2.total, maxDD: p.h2.maxDD, retDD: p.h2.retDD }, all: { retDD: p.all.retDD } };
  }
  // (b) the decay throttle with its record restarted at each half's start (as the live monitor starts from a recent record)
  for (const s of SYSTEMS) {
    const rows = IN.systems[s.id], b = BASE[s.id], res = {};
    for (const [h, f] of [['h1', (r) => yearOf(r[0]) < s.split], ['h2', (r) => yearOf(r[0]) >= s.split]]) {
      const sub = rows.filter(f); if (!sub.length) continue; const M = multipliers(sub, b, { ddX: {} });
      res[h] = { fixed: measure(sub.map((r) => ({ e: r[0], c: r[1], v: r[3], m: 1 }))).retDD, decay: measure(sub.map((r, i) => ({ e: r[0], c: r[1], v: M.decay[i] * r[3], m: M.decay[i] }))), healthyShare: r2(M.status.filter((x) => x === 'healthy').length / sub.length) };
      delete res[h].decay.byYear;
    }
    out.posthoc.decayFreshPerHalf[s.id] = res;
  }
  const passed = RULES.slice(1).filter((r) => out.decision[r].pass).sort((a, b) => out.decision[b].worseHalfRetDD - out.decision[a].worseHalfRetDD);
  out.recommendation = passed.length ? passed[0] : 'fixed';
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 1));
  report(out);
}

function report(out) {
  const L = (s) => console.log(s), f = (v) => (v == null ? '–' : (v > 0 ? '+' : '') + v);
  const tab = (title, get) => {
    L(`\n## ${title}\n\n| rule | half | total R | max DD | ret/DD | worst year | yrs + | mean m |\n|---|---|---|---|---|---|---|---|`);
    for (const rule of RULES) for (const h of ['all', 'h1', 'h2']) { const m = get(rule)[h]; L(`| ${rule} | ${h} | ${f(m.total)} | ${m.maxDD} | ${m.retDD ?? '–'} | ${f(m.worstYear)} | ${m.posYears}/${m.years} | ${m.meanM} |`); }
  };
  tab(`Portfolio x1 (split ${PORT_SPLIT})`, (r) => out.portfolio.x1[r]);
  tab(`Portfolio x2`, (r) => out.portfolio.x2[r]);
  for (const s of SYSTEMS) tab(`${s.name} x1 (split ${s.split}; X ${out.systems[s.id].ddX}R)`, (r) => out.systems[s.id].x1[r]);
  L('\n## decay status share'); for (const s of SYSTEMS) L(`${s.id} ${JSON.stringify(out.systems[s.id].decayStatusShare)} dd-half ${JSON.stringify(out.systems[s.id].ddHalfShare)}`);
  L('\n## post hoc'); L(JSON.stringify(out.posthoc, null, 1));
  L('\n## sensitivity portfolio x1'); for (const k of ['ddX025_x1', 'ddX100_x1']) { const p = out.sensitivity.portfolio[k]; L(`${k} h1 ${p.h1.total}/${p.h1.maxDD}/${p.h1.retDD} h2 ${p.h2.total}/${p.h2.maxDD}/${p.h2.retDD} all ${p.all.retDD}`); }
  L('\n## decision'); L(JSON.stringify(out.decision, null, 1)); L('recommendation: ' + out.recommendation);
}

if (MODE === 'fetch') await fetchDaily(ARGS[0]);
else if (MODE === 'build') build(...ARGS);
else run();

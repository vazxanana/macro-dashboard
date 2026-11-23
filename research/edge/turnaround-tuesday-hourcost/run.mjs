// Edge research · turnaround-tuesday-hourcost: turnaround-tuesday's four cells (R1 / R2 on SPX500 / NAS100), unchanged,
// charged the demo broker's quoted spread of the UTC hour of each trade's entry and exit (PREREGISTRATION.md, pushed alone
// first). Cost accounting only: no rule is tested. Every trading function is imported from ../turnaround-tuesday/run.mjs;
// cellsFor() is re-written with one change (each trade's cost comes from a function) and must reproduce that study first.
//   node research/edge/turnaround-tuesday-hourcost/run.mjs <candleDir> <ticks-NAS100.json> <ticks-US500.json> <symbols.json> [probeCommit]
//   (<candleDir>/{spx500,nas100}-1h.json.gz from ../turnaround-tuesday/fetch.mjs; optional <candleDir>/nas100-fwd-1h.json.gz,
//    NAS100 H1 from 2026-09-01, for the forward record's trades)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyParts } from '../../../ict/calendar.mjs';
import { MARKETS, RULES, SEEDS, SEEDS_NEED, SPLIT, FIRST, tradingDays, weekPairs, buildDays, dayChg, ruleOn, trade, rateOf,
  stats, welch, pOneSided, rng, verdictOf } from '../turnaround-tuesday/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BROKER = { spx500: 'US500', nas100: 'NAS100' };
export const MIN_WIN = 10, MED_K = 12, FWD_AFTER = '2026-11-12';
export const CONDS = { C1: { key: 'frac', s: 0 }, C2: { key: 'frac90', s: 0.10 } };
const yr = (d) => +d.slice(0, 4), H = 3600;
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
export const hourOf = (t) => Math.floor(t / H) % 24;
const median = (xs) => { const a = [...xs].sort((x, y) => x - y), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0; };

// the candle the exit price came from: the stop candle (scanned as trade() does) or the exit day's close candle
export function exitIdx(bars, D, e, x, t) {
  if (t.how !== 'time') for (let j = D[e].i + 1; j <= D[x].i; j++) { const b = bars[j]; if (b[1] <= t.stop || b[3] <= t.stop) return j; }
  return D[x].i;
}
// round trip as a share of the entry price, under a condition (hour profile prof, commission comm)
export function shareOf(prof, comm, cond, bars, iIn, iOut, how, entry) {
  const f = (h) => prof[h][cond.key];
  let c = 0.5 * f(hourOf(bars[iIn][0])) + 0.5 * f(hourOf(bars[iOut][0])) + comm;
  if (cond.s && how !== 'time') c += cond.s * median(bars.slice(Math.max(0, iOut - MED_K + 1), iOut + 1).map((b) => b[2] - b[3])) / entry;
  return c;
}
export function measurable(prof, hours) {
  for (const h of hours) { const p = prof && prof[h]; if (!p || !(p.n >= MIN_WIN) || !(p.frac >= 0) || !(p.frac90 >= 0)) return `hour ${h}: ${p ? p.n : 0} windows`; }
  return null;
}

// one trade: the original trade() at the study's cost when share is null, else at cost 0 less the measured share
export function tradeC(bars, D, e, x, opt, share, used) {
  if (!share) return trade(bars, D, e, x, opt);
  const t = trade(bars, D, e, x, { ...opt, cost: 0 }); if (!t) return null;
  const iIn = D[e].i, iOut = exitIdx(bars, D, e, x, t);
  if (used) { used.add(hourOf(bars[iIn][0])); used.add(hourOf(bars[iOut][0])); }
  const c = share(bars, iIn, iOut, t.how, t.entry), risk = t.entry - t.stop;
  return { ...t, cost: c, R: t.R - c * t.entry / risk, net: t.net - c * 100, hIn: hourOf(bars[iIn][0]), hOut: hourOf(bars[iOut][0]) };
}

const monthT = (ts) => { const m = new Map(); for (const t of ts) { const k = t.entryD.slice(0, 7); m.set(k, (m.get(k) || 0) + t.R); } const s = stats([...m.values()]); return { months: s.n, t: r2(s.t) }; };

// turnaround-tuesday's cellsFor(), with the per-trade cost from `share` (null = the study's constant cost)
export function cellsFor(k, bars, days, rate, share = null, used = null) {
  const D = buildDays(bars, days), pairs = weekPairs(days), opt = { cost: MARKETS[k].cost, rate };
  const isW = (d) => yr(d) >= FIRST && yr(d) < SPLIT, oosW = (d) => yr(d) >= SPLIT;
  const summ = (ts) => { const s = stats(ts.map((t) => t.R)), g = stats(ts.map((t) => t.grossR)), pc = stats(ts.map((t) => t.net));
    return { n: s.n, R: r3(s.mean), t: r2(s.t), grossR: r3(g.mean), tGross: r2(g.t), netPct: r3(pc.mean), win: s.n ? r2(100 * ts.filter((t) => t.R > 0).length / s.n) : null, stops: ts.filter((t) => t.how !== 'time').length, totalR: r2(ts.reduce((a, t) => a + t.R, 0)) }; };
  const allT = (inW) => pairs.filter((p) => inW(days[p.m])).map((p) => { const a = D[p.m].close, b = D[p.x].close; return a != null && b != null ? 100 * (b / a - 1) : null; }).filter((v) => v != null);
  const out = {};
  for (const [rk, rule] of Object.entries(RULES)) {
    const trades = [], skipped = [], entryIdx = new Set(), ruleT = { is: [], oos: [] };
    for (const p of pairs) {
      const d = days[p.m];
      if (yr(d) < FIRST) continue;
      if (!ruleOn(dayChg(D, p.m), rule.drop)) continue;
      entryIdx.add(p.m);
      const t = tradeC(bars, D, p.m, p.x, opt, share, used);
      if (!t) { skipped.push(d); continue; }
      trades.push(t);
      (oosW(d) ? ruleT.oos : ruleT.is).push(100 * (D[p.x].close / D[p.m].close - 1));
    }
    const IS = trades.filter((t) => isW(t.entryD)), OOS = trades.filter((t) => oosW(t.entryD));
    const cmp = (rt, inW) => { const A = allT(inW), w = welch(rt, A); return { ruleN: rt.length, ruleMean: r3(stats(rt).mean), allN: A.length, allMean: r3(stats(A).mean), diff: r3(w.diff), t: r2(w.t) }; };
    const counts = new Map(); for (const t of OOS) counts.set(yr(t.entryD), (counts.get(yr(t.entryD)) || 0) + 1);
    const pool = new Map();
    days.forEach((d, x) => { if (x >= 1 && x + 1 < days.length && !entryIdx.has(x) && ruleOn(dayChg(D, x), rule.drop)) { if (!pool.has(yr(d))) pool.set(yr(d), []); pool.get(yr(d)).push(x); } });
    const ruleMean = stats(OOS.map((t) => t.R)).mean, seeds = [];
    for (let s = 1; s <= SEEDS; s++) {
      const Rn = rng(s), obs = [];
      for (const [y, n] of counts) {
        const K = pool.get(y) || []; let got = 0, tries = 0;
        while (K.length && got < n && tries < n * 50) { tries++; const x = K[Math.floor(Rn() * K.length)]; const t = tradeC(bars, D, x, x + 1, opt, share, used); if (t) { obs.push(t.R); got++; } }
      }
      seeds.push(obs.length ? meanOf(obs) : null);
    }
    const beaten = seeds.filter((m) => m != null && ruleMean != null && ruleMean > m).length;
    const hrs = {}; for (const t of trades) if (t.hIn != null) { const key = `${t.hIn}->${t.hOut}`; hrs[key] = (hrs[key] || 0) + 1; }
    out[rk] = { market: k, rule: rk, name: `${MARKETS[k].name}, ${rule.name}`, minN: rule.minN,
      is: summ(IS), oos: summ(OOS), pOne: pOneSided(stats(OOS.map((t) => t.R)).t), skipped,
      vsAllIS: cmp(ruleT.is, isW), vsAllOOS: cmp(ruleT.oos, oosW),
      placebo: { seeds: seeds.map(r3), beaten, need: SEEDS_NEED, median: r3([...seeds].sort((a, b) => a - b)[SEEDS / 2]) },
      oosMonthT: monthT(OOS), hours: hrs,
      oosCostPct: share ? r3(100 * meanOf(OOS.map((t) => t.cost))) : r3(100 * MARKETS[k].cost),
      // the round trip (% of price) at which the OOS net mean would be 0, financing kept
      breakEvenPct: r3(100 * meanOf(OOS.map((t) => (t.R + (share ? t.cost : MARKETS[k].cost) * t.entry / (t.entry - t.stop)))) / meanOf(OOS.map((t) => t.entry / (t.entry - t.stop)))),
      trades: trades.map((t) => [t.entryD, t.exitD, t.how, t.nights, r3(t.gross), r3(t.net), r3(t.R)]) };
  }
  return out;
}

export function studyC(M, dgs2, shares = {}, used = {}) {
  const keys = Object.keys(M);
  const first = keys.map((k) => nyParts(M[k][0][0]).ymd).sort().at(-1), last = keys.map((k) => nyParts(M[k].at(-1)[0]).ymd).sort()[0];
  const days = tradingDays(first, last), rate = rateOf(dgs2), cells = {};
  for (const k of keys) { const c = cellsFor(k, M[k], days, rate, shares[k] || null, used[k] || null); for (const [rk, v] of Object.entries(c)) cells[`${k}-${rk}`] = v; }
  return { from: first, to: last, cells };
}

// forward-record trades (R2 NAS100, weeks after FWD_AFTER) at the forward study's frozen rate, at both costs
export function forwardC(bars, frozen, share) {
  const first = nyParts(bars[0][0]).ymd, last = nyParts(bars.at(-1)[0]).ymd;
  const days = tradingDays(first, last), D = buildDays(bars, days), opt = { cost: MARKETS.nas100.cost, rate: () => frozen }, out = [];
  for (const p of weekPairs(days)) {
    const d = days[p.m]; if (d <= FWD_AFTER || D[p.x].close == null) continue;
    if (!ruleOn(dayChg(D, p.m), RULES.r2.drop)) continue;
    const a = trade(bars, D, p.m, p.x, opt), b = tradeC(bars, D, p.m, p.x, opt, share);
    if (a && b) out.push({ day: d, exitD: a.exitD, how: a.how, grossR: r3(a.grossR), Rassumed: r3(a.R), Rmeasured: r3(b.R), hours: `${b.hIn}->${b.hOut}` });
  }
  return { dataEnd: last, trades: out };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cdir, nasF, usF, symF, commit] = process.argv.slice(2);
  const orig = JSON.parse(fs.readFileSync(path.join(HERE, '../turnaround-tuesday/result.json'), 'utf8'));
  const rates = JSON.parse(fs.readFileSync(path.join(HERE, '../turnaround-tuesday/rates.json'), 'utf8'));
  const M = {}; for (const k of Object.keys(MARKETS)) M[k] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cdir, `${k}-1h.json.gz`))));
  // harness gate: the re-written cellsFor at the study's constant costs reproduces its result.json
  const G = studyC(M, rates.DGS2), diff = [];
  for (const [id, c] of Object.entries(orig.cells)) for (const f of ['is', 'oos', 'vsAllIS', 'vsAllOOS', 'placebo', 'skipped', 'trades', 'pOne'])
    if (JSON.stringify(G.cells[id][f]) !== JSON.stringify(c[f])) diff.push(`${id}.${f}`);
  const gv = verdictOf(G); if (JSON.stringify(gv.cells) !== JSON.stringify(orig.checks)) diff.push('checks');
  const gate = { same: diff.length === 0, diff, from: G.from, to: G.to, origFrom: orig.from, origTo: orig.to };
  const probes = { nas100: JSON.parse(fs.readFileSync(nasF, 'utf8')), spx500: JSON.parse(fs.readFileSync(usF, 'utf8')) };
  const sym = JSON.parse(fs.readFileSync(symF, 'utf8')).symbols, comm = Object.fromEntries(Object.entries(BROKER).map(([k, b]) => [k, (sym[b] || {}).commissionRT ?? 0]));
  const base = { study: 'turnaround-tuesday-hourcost', built: new Date().toISOString().slice(0, 10), gate,
    probe: Object.fromEntries(Object.entries(probes).map(([k, p]) => [k, { symbol: BROKER[k], at: p.at, commit: commit || null, reachDays: p.reachDays }])), commission: comm };
  if (!gate.same) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); console.log('GATE FAILED', diff); process.exit(2); }
  const used = { spx500: new Set(), nas100: new Set() };
  studyC(M, rates.DGS2, { spx500: () => 0, nas100: () => 0 }, used);
  const why = Object.entries(used).map(([k, s]) => { const w = measurable(probes[k].hourProfile, [...s]); return w && `${k} ${w}`; }).filter(Boolean);
  if (why.length) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: `NOT MEASURABLE: ${why.join('; ')}` }, null, 1) + '\n'); console.log('NOT MEASURABLE', why); process.exit(0); }
  const out = {};
  for (const [c, cond] of Object.entries(CONDS)) {
    const shares = Object.fromEntries(Object.keys(MARKETS).map((k) => [k, (bars, iIn, iOut, how, entry) => shareOf(probes[k].hourProfile, comm[k], cond, bars, iIn, iOut, how, entry)]));
    const S = studyC(M, rates.DGS2, shares); out[c] = { cells: S.cells, checks: verdictOf(S).cells };
  }
  let forward = null;
  const ff = path.join(cdir, 'nas100-fwd-1h.json.gz');
  if (fs.existsSync(ff)) {
    const fb = JSON.parse(zlib.gunzipSync(fs.readFileSync(ff))), frozen = rates.DGS2.at(-1)[1];
    forward = forwardC(fb, frozen, (bars, iIn, iOut, how, entry) => shareOf(probes.nas100.hourProfile, comm.nas100, CONDS.C1, bars, iIn, iOut, how, entry));
  }
  const c = out.C1.cells['nas100-r2'], k = out.C1.checks['nas100-r2'], fails = Object.entries(k.checks).filter(([, v]) => !v).map(([q]) => q);
  const verdict = `${k.pass ? 'PASS' : 'FAIL'} (accounting, no rule tested): at the demo's measured hourly NAS100 spread (C1) R2 on NAS100 makes ${c.oos.R >= 0 ? '+' : ''}${c.oos.R}R a trade on 2016 → Nov 2026 (n ${c.oos.n}, t ${c.oos.t}, Holm p ${k.holmP.toFixed(4)}; ${c.placebo.beaten} of 40 placebos; round trip ${c.oosCostPct} % of price against the study's ${100 * MARKETS.nas100.cost} %)${k.pass ? '' : '; fails ' + fails.join(', ')}`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict, used: Object.fromEntries(Object.entries(used).map(([q, s]) => [q, [...s].sort((a, b) => a - b)])),
    profile: Object.fromEntries(Object.entries(probes).map(([q, p]) => [q, p.hourProfile.map((h) => ({ hour: h.hour, n: h.n, frac: h.frac, frac90: h.frac90 }))])), conditions: CONDS,
    original: Object.fromEntries(Object.entries(orig.cells).map(([id, x]) => [id, { oos: x.oos, is: x.is, placebo: x.placebo.beaten, holmP: orig.checks[id].holmP, pass: orig.checks[id].pass }])),
    ...Object.fromEntries(Object.entries(out).map(([q, v]) => [q, { checks: v.checks, cells: Object.fromEntries(Object.entries(v.cells).map(([id, x]) => [id, { ...x, trades: undefined, skipped: x.skipped.length }])) }])),
    tradesC1NasR2: out.C1.cells['nas100-r2'].trades, forward }, null, 1) + '\n');
  console.log(verdict);
  for (const q of Object.keys(CONDS)) for (const [id, x] of Object.entries(out[q].cells)) console.log(q, id, 'OOS', JSON.stringify(x.oos), 'IS', JSON.stringify(x.is), 'pl', x.placebo.beaten, 'mt', JSON.stringify(x.oosMonthT), 'cost%', x.oosCostPct, 'be%', x.breakEvenPct, JSON.stringify(out[q].checks[id]), JSON.stringify(x.hours));
  console.log('forward', JSON.stringify(forward));
}

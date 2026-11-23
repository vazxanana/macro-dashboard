// Edge research · gold-pre-holiday-hourcost: gold-pre-holiday's T1 / T2 / T3, unchanged, charged the demo broker's quoted gold
// spread of the UTC hour of each trade's entry and exit plus its commission (PREREGISTRATION.md, pushed alone first). Cost
// accounting only: no rule is tested. Every trading function is imported from ../gold-pre-holiday/run.mjs; study() is
// re-written with one change (each trade's cost comes from a function) and must reproduce that study's result.json first.
//   node --use-env-proxy research/edge/gold-pre-holiday-hourcost/run.mjs fetch <dir>      OANDA mid H1 gold 2006 → 2026-11-13
//   node research/edge/gold-pre-holiday-hourcost/run.mjs run <dir> <ticks-XAUUSD.json> <symbols.json> [probeCommit]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { holidays, buildDays, trade, eventDays, st, welch, pOne, holm, rng, summary, COST, ATR_N, WIN, OOS_END, SEEDS } from '../gold-pre-holiday/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H = 3600, D = 86400;
export const MIN_WIN = 10, MED_K = 12, END = '2026-11-13';
export const CONDS = { C1: { key: 'frac', s: 0 }, C2: { key: 'frac90', s: 0.10 } };
const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
const dayOf = (s) => Date.parse(s) / 1000 / D;
const r2 = (v) => v == null ? null : Math.round(v * 100) / 100, r3 = (v) => v == null ? null : Math.round(v * 1000) / 1000, r4 = (v) => v == null ? null : Math.round(v * 1e4) / 1e4;
export const hourOf = (t) => Math.floor(t / H) % 24;
const median = (xs) => { const a = [...xs].sort((x, y) => x - y), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0; };

// where a trade's two prices came from: { iIn, iOut } candle indices (at = Map time -> index)
export function legs(at, ds, a, tr) {
  const i0 = ds[a].i0;
  if (!tr.stopped) return { iIn: i0, iOut: at.get(tr.exitT - H) };
  // stop: a gap fills at the open of the candle starting exitT, a low through the stop at the stop of the candle starting exitT - H
  const g = at.get(tr.exitT);
  return { iIn: i0, iOut: g != null && tr.exit === tr.gapOpen ? g : at.get(tr.exitT - H) };
}
// the round trip of one trade in $ an ounce under a condition
export function costOf(prof, comm, cond, h1, tr, lg) {
  const f = (h) => prof[h][cond.key];
  let c = (0.5 * f(hourOf(h1[lg.iIn].time)) + 0.5 * f(hourOf(h1[lg.iOut].time)) + comm) * tr.entry;
  if (cond.s && tr.stopped) c += cond.s * median(h1.slice(Math.max(0, lg.iOut - MED_K + 1), lg.iOut + 1).map((x) => x.high - x.low));
  return c;
}
// the hours that must be measurable (every hour any trade uses)
export function measurable(prof, hours) {
  for (const h of hours) { const p = prof && prof[h]; if (!p || !(p.n >= MIN_WIN) || !(p.frac >= 0) || !(p.frac90 >= 0)) return `hour ${h}: ${p ? p.n : 0} windows`; }
  return null;
}

const monthT = (rows) => { const m = new Map(); for (const r of rows) { const k = ymd(Math.floor(r.t0 / D)).slice(0, 7); m.set(k, (m.get(k) || 0) + r.net); } const s = st([...m.values()]); return { months: s.n, t: s.t }; };

// gold-pre-holiday's study(), with `price(tr, a)` giving each trade's round trip in $ (constant COST reproduces the original)
export function study(h1raw, price = () => COST, used = null) {
  const h1 = h1raw.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = buildDays(h1), y0 = 2006, y1 = 2026;
  const at = new Map(h1.map((c, i) => [c.time, i]));
  const T = (a, b) => { const t0 = trade(h1, ds, a, b, { cost: 0 }); if (!t0) return null;
    const gc = h1[at.get(t0.exitT)]; t0.gapOpen = t0.stopped && gc && gc.open <= t0.stop ? gc.open : null; const lg = legs(at, ds, a, t0);
    if (used) { used.add(hourOf(h1[lg.iIn].time)); used.add(hourOf(h1[lg.iOut].time)); }
    const c = price(t0, lg, h1), costR = c / t0.atr; return { ...t0, costR, net: t0.gross - costR - t0.finR, hIn: hourOf(h1[lg.iIn].time), hOut: hourOf(h1[lg.iOut].time) }; };
  const hols = []; for (let y = y0; y <= y1; y++) hols.push(...holidays(y));
  const holSet = new Set(hols.map((h) => h.d)), lastD = dayOf(OOS_END);
  const near = new Set(), events = { T1: [], T2: [], T3: [] }, skipped = { T1: 0, T2: 0, T3: 0 };
  for (const h of hols) {
    const yr = +h.date.slice(0, 4); if (yr < WIN.is[0] || h.d > lastD) continue;
    const e = eventDays(ds, h, holSet);
    const add = (k, a, b) => { if (a == null || b == null) { skipped[k]++; return; } const tr = T(a, b); if (!tr) { skipped[k]++; return; }
      events[k].push({ ...tr, holiday: h.name, date: h.date, year: yr, win: yr <= WIN.is[1] ? 'is' : 'oos', day: ymd(ds[a].d) }); };
    add('T1', e && e.pre1, e && e.pre1); add('T2', e && e.pre2, e && e.pre1); add('T3', e && e.post, e && e.post);
  }
  for (const h of hols) { const e = eventDays(ds, h, holSet); if (e) for (const i of [e.pre1, e.pre2, e.post]) if (i != null) near.add(ds[i].d); }
  const ordinary = []; ds.forEach((x, i) => { if (!holSet.has(x.d) && !near.has(x.d) && i > ATR_N) ordinary.push(i); });
  const ordSet = new Set(ordinary);
  const yearOf = (i) => +ymd(ds[i].d).slice(0, 4);
  const ordRows = { is: [], oos: [] };
  for (const i of ordinary) { const y = yearOf(i); if (y < WIN.is[0] || ds[i].d > lastD) continue; const tr = T(i, i); if (tr) ordRows[y <= WIN.is[1] ? 'is' : 'oos'].push(tr); }
  const res = {}, pOos = [];
  for (const k of ['T1', 'T2', 'T3']) {
    const E = events[k], is = E.filter((r) => r.win === 'is'), oos = E.filter((r) => r.win === 'oos');
    const S = { is: summary(is), oos: summary(oos), whole: summary(E) };
    const perYear = new Map(); for (const r of oos) perYear.set(r.year, (perYear.get(r.year) || 0) + 1);
    const pool = new Map(); for (const i of ordinary) { const y = yearOf(i); if (!perYear.has(y) || ds[i].d > lastD) continue;
      if (k === 'T2' && !(ordSet.has(i + 1) && ds[i + 1].d - ds[i].d <= 4)) continue; (pool.get(y) || pool.set(y, []).get(y)).push(i); }
    const means = [];
    for (let s = 1; s <= SEEDS; s++) { const R = rng(s), net = [];
      for (const [y, c] of perYear) { const P = (pool.get(y) || []).slice();
        for (let j = 0; j < c && P.length; j++) { const i = P.splice(Math.floor(R() * P.length), 1)[0]; const tr = T(i, k === 'T2' ? i + 1 : i); if (tr) net.push(tr.net); } }
      means.push(st(net).mean); }
    const beat = means.filter((m) => S.oos.netR > m).length;
    const welchOrd = { is: welch(is.map((r) => r.net), ordRows.is.map((r) => r.net)), oos: welch(oos.map((r) => r.net), ordRows.oos.map((r) => r.net)) };
    const hrs = {}; for (const r of E) { const key = `${r.hIn}->${r.hOut}`; hrs[key] = (hrs[key] || 0) + 1; }
    res[k] = { ...S, skipped: skipped[k], placebo: { beat, of: SEEDS, min: r3(Math.min(...means)), median: r3([...means].sort((a, b) => a - b)[20]), max: r3(Math.max(...means)) },
      vsOrdinary: { is: { diff: r3(welchOrd.is.diff), t: r2(welchOrd.is.t) }, oos: { diff: r3(welchOrd.oos.diff), t: r2(welchOrd.oos.t) } },
      oosMonthT: r2(monthT(oos).t), hours: hrs,
      // the round trip ($ an ounce) at which the OOS net mean would be 0: mean gross minus financing over the mean of 1/ATR
      breakEven: r3((st(oos.map((r) => r.gross - r.finR)).mean) / st(oos.map((r) => 1 / r.atr)).mean),
      oosCostUsd: r3(st(oos.map((r) => r.costR * r.atr)).mean) };
    pOos.push(pOne(S.oos.netT, S.oos.n - 1));
  }
  const adj = holm(pOos);
  ['T1', 'T2', 'T3'].forEach((k, j) => { const r = res[k]; r.pOne = r4(pOos[j]); r.pHolm = r4(adj[j]);
    r.checks = { oosT: r.oos.netT >= 2 && adj[j] < 0.05, isSign: r.is.netR > 0, cost2x: r.oos.net2x > 0, placebo: r.placebo.beat >= 38 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return { tests: res, ordinary: { is: summary(ordRows.is), oos: summary(ordRows.oos) }, data: { from: ymd(ds[0].d), to: ymd(ds.at(-1).d), days: ds.length, h1: h1.length } };
}

// the gate: the fields the original stores, compared one by one
export function gateDiff(mine, orig) {
  const out = [];
  for (const k of ['T1', 'T2', 'T3']) { const a = mine.tests[k], b = orig.tests[k];
    for (const w of ['is', 'oos', 'whole']) for (const f of Object.keys(b[w])) if (a[w][f] !== b[w][f]) out.push(`${k}.${w}.${f} ${a[w][f]} vs ${b[w][f]}`);
    for (const f of ['pHolm', 'pass']) if (a[f] !== b[f]) out.push(`${k}.${f}`);
    if (JSON.stringify(a.placebo) !== JSON.stringify(b.placebo)) out.push(`${k}.placebo`);
    if (JSON.stringify(a.checks) !== JSON.stringify(b.checks)) out.push(`${k}.checks`); }
  return out;
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const BASE = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/';
  let from = Math.floor(Date.parse('2006-01-01') / 1000); const end = Math.floor(Date.parse(END + 'T23:59:59Z') / 1000), all = [];
  while (from < end) { const to = Math.min(end, from + 4990 * H); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${from}&to=${to}`); const x = await r.json(); if (r.ok && x && Array.isArray(x.bars)) j = x; else err = `proxy ${r.status} ${x && x.error}`; } catch (e) { err = String(e); }
      if (!j) await new Promise((s) => setTimeout(s, 3000 * (k + 1))); }
    if (!j) throw new Error(err);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close]);
    from = to; await new Promise((s) => setTimeout(s, 1500)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
  console.log(rows.length, 'candles', new Date(rows[0][0] * 1000).toISOString(), new Date(rows.at(-1)[0] * 1000).toISOString());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir, probeF, symF, commit] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(dir);
  else if (cmd === 'run') {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8'));
    const orig = JSON.parse(fs.readFileSync(path.join(HERE, '../gold-pre-holiday/result.json'), 'utf8'));
    const g = study(rows), diff = gateDiff(g, orig), gate = { same: diff.length === 0, diff: diff.slice(0, 20), data: g.data, origData: orig.data };
    const probe = JSON.parse(fs.readFileSync(probeF, 'utf8')), prof = probe.hourProfile;
    const comm = JSON.parse(fs.readFileSync(symF, 'utf8')).symbols.XAUUSD.commissionRT;
    const base = { study: 'gold-pre-holiday-hourcost', built: new Date().toISOString().slice(0, 10), gate,
      probe: { at: probe.at, commit: commit || null, reachDays: probe.reachDays }, commission: comm };
    if (!gate.same) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: 'STOPPED: the harness gate failed' }, null, 1) + '\n'); console.log('GATE FAILED', diff.slice(0, 20)); process.exit(2); }
    const used = new Set(); study(rows, () => 0, used);
    const why = measurable(prof, [...used].sort((a, b) => a - b));
    if (why || !(comm >= 0)) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: `NOT MEASURABLE: ${why || 'no commission'}` }, null, 1) + '\n'); console.log('NOT MEASURABLE', why); process.exit(0); }
    const out = {};
    for (const [c, cond] of Object.entries(CONDS)) out[c] = study(rows, (tr, lg, h1) => costOf(prof, comm, cond, h1, tr, lg)).tests;
    const t1 = out.C1.T1, fails = Object.entries(t1.checks).filter(([, v]) => !v).map(([k]) => k);
    const verdict = `${t1.pass ? 'PASS' : 'FAIL'} (accounting, no rule tested): at the demo's measured hourly gold spread and commission (C1) T1 makes ${t1.oos.netR >= 0 ? '+' : ''}${t1.oos.netR}R a trade out of sample 2017-26 (n ${t1.oos.n}, t ${t1.oos.netT}, Holm p ${t1.pHolm}; cost ${t1.oosCostUsd} $/oz a round trip against the study's $0.60)${t1.pass ? '' : '; fails ' + fails.join(', ')}; T2 ${out.C1.T2.pass ? 'passes' : 'fails'} (${out.C1.T2.oos.netR}R, t ${out.C1.T2.oos.netT})`;
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict, used: [...used].sort((a, b) => a - b),
      profile: prof.map((p) => ({ hour: p.hour, n: p.n, frac: p.frac, frac90: p.frac90 })), conditions: CONDS, original: Object.fromEntries(['T1', 'T2', 'T3'].map((k) => [k, { oos: orig.tests[k].oos, is: orig.tests[k].is, pHolm: orig.tests[k].pHolm, placebo: orig.tests[k].placebo, pass: orig.tests[k].pass }])), ...out }, null, 1) + '\n');
    console.log(verdict);
    for (const c of Object.keys(CONDS)) for (const k of ['T1', 'T2', 'T3']) { const x = out[c][k]; console.log(c, k, 'IS', JSON.stringify(x.is), 'OOS', JSON.stringify(x.oos), 'p', x.pHolm, 'pl', x.placebo.beat, 'mt', x.oosMonthT, 'be', x.breakEven, 'cost$', x.oosCostUsd, JSON.stringify(x.checks), JSON.stringify(x.hours)); }
  } else console.log('usage: run.mjs fetch|run …');
}

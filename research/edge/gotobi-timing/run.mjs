// Edge research · gotobi-timing: how sensitive the frozen gotobi fade (T2 of research/edge/gotobi) is to execution timing.
// A sensitivity report on the pre-registered rule (PREREGISTRATION.md), never used to pick a time: the base 00:55 / 06:00 UTC
// is the rule. The rule's functions come from frozen.mjs (byte copy of gotobi-replicate's, sha256 pinned in the test).
//   node --use-env-proxy research/edge/gotobi-timing/run.mjs fetch <m1Dir>        (OANDA M1, one request per gotobi day)
//   node research/edge/gotobi-timing/run.mjs <m1Dir> <usdjpy-5m.json.gz>          (writes result.json and RESULT.md here)
// Keep the candle files out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = '2016-01-01', LAST = '2026-11-11';   // #878's decisive window
export const WIN = [40, 375];                            // fetched minutes after 00:00 UTC: 00:40 -> 06:15
export const BASE = { entry: 55, exit: 360 };            // 00:55 and 06:00 UTC, in minutes
export const ENTRIES = [53, 54, 55, 56, 57, 58, 60];
export const EXITS = [355, 360, 362, 365];
export const GRACE_M1 = F.EXIT_GRACE / 60;               // the frozen 15-minute exit grace, in M1 candles
export const GATE = { n: 771, netR: 0.1481, nTol: 8, rTol: 0.010, openShare: 0.99 };
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function gotobiDays(from = FROM, to = LAST) {
  const G = F.gotobiSet(+from.slice(0, 4) - 1, +to.slice(0, 4));
  return [...G].filter((d) => d >= from && d <= to).sort();
}

// one fade trade on M1 candles: entry at the open of the M1 candle at entryT, stop D above it, scan M1 to exitT, exit at the
// open at exitT else the close of the last M1 candle starting up to 15 min before it. Same order of checks as frozen trade().
export function tradeM1(ix, ymd, D, entryMin, exitMin) {
  if (!(D > 0)) return null;
  const day0 = Date.parse(ymd + 'T00:00:00Z') / 1000, entry = day0 + entryMin * 60, exit = day0 + exitMin * 60;
  const ei = ix.at.get(entry); if (ei == null) return null;
  let xp = null; const xi = ix.at.get(exit);
  if (xi != null) xp = ix.bars[xi][1];
  else for (let k = 1; k <= GRACE_M1; k++) { const j = ix.at.get(exit - 60 * k); if (j != null) { xp = ix.bars[j][4]; break; } }
  if (xp == null) return null;
  const side = -1, epx = ix.bars[ei][1], stop = epx - side * D;
  let out = xp, how = 'time';
  for (let i = ei; i < ix.bars.length && ix.bars[i][0] < exit; i++) {
    const [, o, h] = ix.bars[i];
    if (o >= stop) { out = o; how = 'gap'; break; }
    if (h >= stop) { out = stop; how = 'stop'; break; }
  }
  const R = side * (out - epx) / D, cR = F.costPx(epx) / D;
  return { day: ymd, entryT: entry, exitT: exit, entry: epx, stop, D, exit: out, how, R, costR: cR, net: R - cR };
}

// the frozen stop distance of every gotobi day, from the M5 file (the base window, exactly as #878)
export function frozenD(m5) {
  const ix = F.index(m5), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, 'fade', d)); return moves.get(d); };
  const out = new Map(), base = new Map();
  for (const d of gotobiDays()) {
    if (!F.isTokyoBusinessDay(d)) continue;
    const D = F.stopDist(moveOf, d); out.set(d, D);
    const t = F.trade(ix, 'fade', d, D); if (t) base.set(d, t);
  }
  return { D: out, base, ix };
}

export function grid(m1, m5) {
  const { D, base, ix: ix5 } = frozenD(m5), ix1 = F.index(m1);
  const run = (e, x) => {
    const tr = []; let missing = 0;
    for (const [d, dd] of D) { const t = tradeM1(ix1, d, dd, e, x); if (t) tr.push(t); else if (dd > 0) missing++; }
    return { entry: hhmm(e), exit: hhmm(x), base: e === BASE.entry && x === BASE.exit, noTrade: missing, ...F.summary(tr), trades: tr };
  };
  const strip = ({ trades, ...r }) => r;
  const baseM1 = run(BASE.entry, BASE.exit);
  // gate 3: M1 open at 00:55 against M5 open at 00:55
  let both = 0, same = 0; const mism = [];
  for (const d of D.keys()) {
    const t = Date.parse(d + 'T00:00:00Z') / 1000 + BASE.entry * 60, a = ix1.at.get(t), b = ix5.at.get(t);
    if (a == null || b == null) continue;
    both++; if (Math.abs(ix1.bars[a][1] - ix5.bars[b][1]) < 1e-9) same++; else mism.push({ day: d, m1: ix1.bars[a][1], m5: ix5.bars[b][1] });
  }
  const m5Base = F.summary([...base.values()]);
  const m5Days = new Set(base.keys()), m1Days = new Set(baseM1.trades.map((t) => t.day));
  const gate = {
    m5: m5Base, m1: strip(baseM1), tolerance: { n: GATE.nTol, netR: GATE.rTol, openShare: GATE.openShare },
    onlyM5: [...m5Days].filter((d) => !m1Days.has(d)), onlyM1: [...m1Days].filter((d) => !m5Days.has(d)),
    open: { days: both, equal: same, share: both ? Math.round(same / both * 1e4) / 1e4 : 0, mismatches: mism },
  };
  gate.checks = {
    reproducesOriginal: m5Base.n === GATE.n && Math.abs(m5Base.netR - GATE.netR) < 5e-5,
    n: Math.abs(baseM1.n - GATE.n) <= GATE.nTol,
    netR: Math.abs(baseM1.netR - GATE.netR) <= GATE.rTol,
    open: both > 0 && same / both >= GATE.openShare,
  };
  gate.pass = Object.values(gate.checks).every(Boolean);
  const entryGrid = ENTRIES.map((e) => strip(e === BASE.entry ? baseM1 : run(e, BASE.exit)));
  const exitGrid = EXITS.map((x) => strip(x === BASE.exit ? baseM1 : run(BASE.entry, x)));
  // tolerance of lateness, read off the entry grid (minutes after 00:55)
  const late = entryGrid.filter((r) => r.entry >= '00:55').map((r) => ({ min: +r.entry.slice(0, 2) * 60 + +r.entry.slice(3) - BASE.entry, netR: r.netR }));
  const firstBelow = (f) => { const x = late.find((r) => r.netR < f); return x ? x.min : null; };
  const tolerance = { halfBase: firstBelow(baseM1.netR / 2), zero: firstBelow(0), testedUpTo: Math.max(...late.map((r) => r.min)) };
  return { gate, entryGrid, exitGrid, tolerance };
}

// ---- report ------------------------------------------------------------------------------------------------------------
const fmt = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
const row = (r, what) => `| ${what} | ${r.entry} | ${r.exit} | ${r.n} | ${fmt(r.netR, 4)} | ${fmt(r.grossR, 4)} | ${r.costR.toFixed(4)} | ${fmt(r.totalR, 1)} | ${fmt(r.t, 2)} | ${(r.win * 100).toFixed(1)} | ${(r.stopShare * 100).toFixed(1)} |`;
const HEAD = ['| Row | Entry (UTC) | Exit (UTC) | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Win % | Stopped % |', '|---|---|---|---|---|---|---|---|---|---|---|'];
export function report(o) {
  const L = [], g = o.gate, base = o.entryGrid.find((r) => r.base), tol = o.tolerance;
  const tolTxt = (m) => m == null ? `not within the ${tol.testedUpTo} minutes tested` : `at ${m} minute${m === 1 ? '' : 's'} late`;
  L.push('# Gotobi fade: how sensitive the result is to execution timing', '');
  const late1 = o.entryGrid.find((r) => r.entry === '00:56');
  L.push(`**Verdict: sensitivity report, no class (gate ${g.pass ? 'held' : 'broken'}): the result sits on the 00:55 entry minute; one minute late net R a trade is ${fmt(late1.netR, 3)} against ${fmt(base.netR, 3)} at the base, month t ${fmt(late1.t, 2)}; the exit minute hardly matters.**`, '');
  L.push(`**A sensitivity report, not a test and not a choice.** The base row (entry 00:55, exit 06:00 UTC) is the pre-registered rule of #878 (T2); every other row moves one time and keeps the day list, the stop distance D, the side and the costs frozen. Nothing is chosen from this grid: a row with better figures is noise around the same trade unless a new pre-registration on other data says otherwise. Paper research only; nothing live changed.`, '');
  L.push(`**Gate: ${g.pass ? 'PASSED' : 'FAILED'}.** The frozen code on #878's M5 file gives n ${g.m5.n}, ${fmt(g.m5.netR, 4)}R a trade (#878: 771, +0.1481). The M1 base gives n ${g.m1.n} (tolerance ±${g.tolerance.n}) and ${fmt(g.m1.netR, 4)}R a trade (tolerance ±${g.tolerance.netR.toFixed(3)}R), month t ${fmt(g.m1.t, 2)}. The M1 open at 00:55 equals the M5 open at 00:55 on ${g.open.equal} of ${g.open.days} days (${(g.open.share * 100).toFixed(2)} %; required ${(g.tolerance.openShare * 100).toFixed(0)} %).${g.pass ? '' : ' The grid below is therefore not interpretable.'}`, '');
  L.push(`**What it means for a live copy.** Net R a trade falls below half of the base (${fmt(base.netR / 2, 4)}R) ${tolTxt(tol.halfBase)} and below zero ${tolTxt(tol.zero)}, entry measured from 00:55 with the exit at 06:00.`, '');
  L.push('## Entry moved (exit 06:00 UTC)', '', ...HEAD);
  for (const r of o.entryGrid) L.push(row(r, r.base ? '**base (the rule)**' : `entry ${r.entry}`));
  L.push('', '## Exit moved (entry 00:55 UTC)', '', ...HEAD);
  for (const r of o.exitGrid) L.push(row(r, r.base ? '**base (the rule)**' : `exit ${r.exit}`));
  L.push('', '## Gate detail', '');
  L.push(`| Source | n | Net R a trade | Gross R | Cost R | Total net R | Month t |`, '|---|---|---|---|---|---|---|');
  L.push(`| #878 (as published) | 771 | +0.1481 | +0.2607 | 0.1126 | +114.2 | +2.74 |`);
  L.push(`| frozen.mjs on the M5 file | ${g.m5.n} | ${fmt(g.m5.netR, 4)} | ${fmt(g.m5.grossR, 4)} | ${g.m5.costR.toFixed(4)} | ${fmt(g.m5.totalR, 1)} | ${fmt(g.m5.t, 2)} |`);
  L.push(`| M1 base (00:55 / 06:00) | ${g.m1.n} | ${fmt(g.m1.netR, 4)} | ${fmt(g.m1.grossR, 4)} | ${g.m1.costR.toFixed(4)} | ${fmt(g.m1.totalR, 1)} | ${fmt(g.m1.t, 2)} |`);
  L.push('', `Days traded on M5 only: ${g.onlyM5.length ? g.onlyM5.join(', ') : 'none'}. On M1 only: ${g.onlyM1.length ? g.onlyM1.join(', ') : 'none'}. Open mismatches at 00:55: ${g.open.mismatches.length ? g.open.mismatches.map((m) => `${m.day} (M1 ${m.m1}, M5 ${m.m5})`).join('; ') : 'none'}.`);
  L.push('', '## Notes', '');
  for (const n of o.notes) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

// ---- fetch ---------------------------------------------------------------------------------------------------------------
async function fetchM1(dir) {
  const BASEURL = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'usdjpy-1m-gotobi.json.gz'), part = path.join(dir, 'usdjpy-1m-gotobi.part.json');
  if (fs.existsSync(file)) { console.log(`${file} exists`); return; }
  const st = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : { done: {}, rows: [] };
  const days = gotobiDays().filter((d) => !st.done[d]);
  let k = 0;
  for (const d of days) {
    const a = Date.parse(d + 'T00:00:00Z') / 1000 + WIN[0] * 60, b = Date.parse(d + 'T00:00:00Z') / 1000 + WIN[1] * 60;
    let rows = null, err = null;
    for (let t = 0; t < 6 && !rows; t++) {
      try {
        const r = await fetch(`${BASEURL}bars?sym=usdjpy&tf=1m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) });
        const x = r.ok ? await r.json() : null;
        if (x && Array.isArray(x.bars)) rows = x.bars.filter((q) => !q.live && q.time >= a && q.time < b).map((q) => [+q.time, +q.open, +q.high, +q.low, +q.close]);
        else err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
      } catch (e) { err = String(e.message || e); }
      if (!rows) await sleep(2000 * (t + 1));
    }
    if (!rows) throw new Error(`${d}: ${err}`);
    st.rows.push(...rows); st.done[d] = rows.length;
    if (++k % 20 === 0) { fs.writeFileSync(part, JSON.stringify(st)); console.log(`${d}: ${k}/${days.length}`); }
    await sleep(250);
  }
  const all = new Map(); for (const r of st.rows) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(bars)));
  fs.rmSync(part, { force: true });
  console.log(`${bars.length} M1 candles on ${Object.keys(st.done).length} gotobi days`);
}

export function load(f) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(f))); }

async function main() {
  const [a, b] = process.argv.slice(2);
  if (a === 'fetch') return fetchM1(b);
  if (!a || !b) throw new Error('usage: node run.mjs fetch <m1Dir> | node run.mjs <m1Dir> <usdjpy-5m.json.gz>');
  const m1 = load(path.join(a, 'usdjpy-1m-gotobi.json.gz')), m5 = load(b);
  const res = grid(m1, m5);
  const out = {
    study: 'gotobi-timing', built: '2026-11-14', kind: 'sensitivity report (no verdict, nothing chosen)',
    rule: 'Frozen T2 of research/edge/gotobi (#878): on gotobi days sell USD/JPY at 00:55 UTC, buy back at 06:00 UTC; stop 1.5 x the 20-business-day median absolute move of that window (M5); net of 0.3 pip spread, USD 22.5 per million a side and 0.5 pip slippage a side.',
    frozen: { file: 'frozen.mjs', from: 'origin/gotobi-replicate:research/edge/gotobi-replicate/frozen.mjs', sha256: '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32' },
    data: { m1: 'OANDA mid M1 through the /md/bars proxy, 00:40-06:15 UTC on each gotobi day', m5: "OANDA mid M5 (#878's file) for the stop distance D", from: FROM, lastDay: LAST, m1Candles: m1.length },
    gate: res.gate, entryGrid: res.entryGrid, exitGrid: res.exitGrid, tolerance: res.tolerance,
  };
  out.notes = [
    'D, the day list, the side and the costs are frozen; the stop sits D above the actual (shifted) fill, as a live copy would place it. Costs are the frozen model at every minute: the measured cost of a late fill at the fix (wider spread, faster price) is not in them.',
    'Entry at 00:53 / 00:54 and exit at 05:55 are shown only to see whether the effect sits on the fix minute itself; they are not an option.',
    'Month t is on calendar-month sums of net R (frozen monthT); it is a measure of each row\'s noise, not a test. No Holm, no placebo: nothing here is judged as an edge.',
    `Tolerance is read off the entry rows after 00:55 only (tested up to ${res.tolerance.testedUpTo} minutes late, with the exit at 06:00).`,
  ];
  const E = Object.fromEntries(res.entryGrid.map((r) => [r.entry, r])), X = res.exitGrid, f = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  out.notes.push(
    `Plain reading, after the gate and not a choice: the result sits on the 00:55 minute itself. One minute late the trade makes ${f(E['00:56'].netR)}R (month t ${f(E['00:56'].t, 2)}), two minutes ${f(E['00:57'].netR)}R (t ${f(E['00:57'].t, 2)}), three minutes ${f(E['00:58'].netR)}R (t ${f(E['00:58'].t, 2)}); one or two minutes EARLY it also loses about half (${f(E['00:54'].netR)}R, ${f(E['00:53'].netR)}R). The exit is not sensitive: ${X.map((r) => `${r.exit} ${f(r.netR)}R`).join(', ')}.`,
    'For a live copy: a loop that runs about once a minute plus broker latency would usually fill one to two minutes after 00:55, where this grid shows about two thirds to four fifths of the base net R lost and no row with a month t above 1.1 (before any extra cost of trading at the fix). Only an order that fills at the 00:55:00 price keeps the measured figure; how to place one is not tested here and would need its own proposal.',
  );
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log('gate', res.gate.pass, JSON.stringify(res.gate.checks), res.gate.m1.n, res.gate.m1.netR, res.gate.open.share);
  for (const r of [...res.entryGrid, ...res.exitGrid]) console.log(r.entry, r.exit, r.n, r.netR, r.t);
  console.log(JSON.stringify(res.tolerance));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });

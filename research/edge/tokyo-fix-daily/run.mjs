// Edge research · tokyo-fix-daily: is the 09:55 Tokyo fix-minute effect of the gotobi fade special to gotobi days, or is it
// there on every Tokyo business day? Three tests on OANDA USD/JPY M1 (PREREGISTRATION.md, pushed first). The rule's functions
// come from frozen.mjs (byte copy of gotobi-timing's, sha256 pinned in the test); tradeM1 is gotobi-timing's, copied unchanged.
//   node --use-env-proxy research/edge/tokyo-fix-daily/run.mjs fetch <m1Dir>     (OANDA M1 00:00-06:15 UTC, every Tokyo business day)
//   node research/edge/tokyo-fix-daily/run.mjs <m1Dir> <usdjpy-5m.json.gz>       (writes result.json and RESULT.md here)
// Keep the candle files out of git. Paper research only; no live proposal.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = '2010-01-01', LAST = '2026-11-11';
export const DECISIVE = ['2016-01-01', LAST], REPLICATION = ['2010-01-01', '2015-12-31'];
export const WIN = [0, 375];                       // fetched minutes after 00:00 UTC: 00:00 -> 06:15
export const ENTRY = 55, EXIT = 360;               // 00:55 and 06:00 UTC
export const GRACE_M1 = F.EXIT_GRACE / 60;
export const GATE = { n: 771, netR: 0.1481, nTol: 8, rTol: 0.010 };
export const SEEDS = 40, P_RANK = 38, ALPHA = 0.05, T_BAR = 2, T1_WEAK = 1;
export const MARKS = (() => { const a = []; for (let e = 5; e <= 300; e += 5) if (![50, 55, 60].includes(e)) a.push(e); return a; })();
const inWin = (d, [a, b]) => d >= a && d <= b;
const r4 = (v) => v == null ? null : Math.round(v * 1e4) / 1e4;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const vari = (a) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1); };

export function businessDays(from = FROM, to = LAST) {
  const out = []; for (let d = from; d <= to; d = F.addD(d, 1)) if (F.isTokyoBusinessDay(d)) out.push(d); return out;
}
export const gotobi = () => F.gotobiSet(+FROM.slice(0, 4) - 1, +LAST.slice(0, 4));

// gotobi-timing's tradeM1, unchanged: the fade on M1 candles with the frozen D and costs
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

// the move over the minute that ends at mark `endMin` (open(endMin) - open(endMin - 1)), in pips; null if a candle is missing
export function minuteMove(ix, ymd, endMin) {
  const day0 = Date.parse(ymd + 'T00:00:00Z') / 1000, a = ix.at.get(day0 + (endMin - 1) * 60), b = ix.at.get(day0 + endMin * 60);
  return a == null || b == null ? null : (ix.bars[b][1] - ix.bars[a][1]) / F.PIP;
}

export function welch(a, b) {   // t of mean(a) - mean(b)
  if (a.length < 2 || b.length < 2) return { diff: null, t: null };
  const d = mean(a) - mean(b), se = Math.sqrt(vari(a) / a.length + vari(b) / b.length);
  return { diff: d, t: se > 0 ? d / se : null };
}
const pOne = (t) => (t == null ? 1 : 1 - F.normCdf(t));

// net R a trade per calendar month
export function monthMeans(trades) {
  const m = new Map(); for (const t of trades) { const k = t.day.slice(0, 7); const x = m.get(k) || { s: 0, n: 0 }; x.s += t.net; x.n++; m.set(k, x); }
  return [...m.values()].map((x) => x.s / x.n);
}

export function reading(t1, t2) {
  const specific = (t1.netR <= 0 || t1.t == null || t1.t < T1_WEAK) && t2.t != null && t2.t >= T_BAR && t2.holmP <= ALPHA;
  const every = t1.netR > 0 && t1.t != null && t1.t >= T_BAR && t1.holmP <= ALPHA;
  return specific ? 'GOTOBI-SPECIFIC' : every ? 'EVERY-DAY' : 'UNCLEAR';
}

// the frozen D of every Tokyo business day, from the M5 file
export function frozenD(m5, days) {
  const ix = F.index(m5), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, 'fade', d)); return moves.get(d); };
  return new Map(days.map((d) => [d, F.stopDist(moveOf, d)]));
}

const spikeSummary = (a) => a.length ? { n: a.length, mean: r4(mean(a)), sd: r4(Math.sqrt(vari(a))), up: r4(a.filter((v) => v > 0).length / a.length) } : { n: 0 };

export function study(m1, m5) {
  const days = businessDays(), G = gotobi(), D = frozenD(m5, days), ix = F.index(m1);
  const trades = new Map(); let noTrade = { gotobi: 0, other: 0 };
  for (const d of days) { const t = tradeM1(ix, d, D.get(d), ENTRY, EXIT); if (t) trades.set(d, t); else noTrade[G.has(d) ? 'gotobi' : 'other']++; }
  const pick = (w, g) => [...trades.values()].filter((t) => inWin(t.day, w) && G.has(t.day) === g);
  const win = (w) => {
    const non = pick(w, false), got = pick(w, true);
    const spike = (g, f) => days.filter((d) => inWin(d, w) && G.has(d) === g).map(f).filter((v) => v != null);
    const fix = (d) => minuteMove(ix, d, ENTRY), after = (d) => minuteMove(ix, d, ENTRY + 1);
    const fixR = (d) => { const v = fix(d), dd = D.get(d); return v == null || !(dd > 0) ? null : v * F.PIP / dd; };
    const sG = spike(true, fix), sN = spike(false, fix), w2 = welch(sG, sN);
    const mG = monthMeans(got), mN = monthMeans(non), w3 = welch(mG, mN);
    return {
      t1: F.summary(non), gotobi: F.summary(got),
      t2: { gotobi: spikeSummary(sG), other: spikeSummary(sN), diff: r4(w2.diff), t: w2.t == null ? null : Math.round(w2.t * 100) / 100,
        inR: { gotobi: spikeSummary(spike(true, fixR)), other: spikeSummary(spike(false, fixR)) },
        after: { gotobi: spikeSummary(spike(true, after)), other: spikeSummary(spike(false, after)) } },
      t3: { monthsGotobi: mG.length, monthsOther: mN.length, gotobiMonthMean: r4(mean(mG)), otherMonthMean: r4(mean(mN)), diff: r4(w3.diff), t: w3.t == null ? null : Math.round(w3.t * 100) / 100 },
    };
  };
  const dec = win(DECISIVE), rep = win(REPLICATION);
  // gate: the gotobi M1 base of 2016-now against #908
  const gate = { n: dec.gotobi.n, netR: dec.gotobi.netR, want: GATE };
  gate.pass = Math.abs(gate.n - GATE.n) <= GATE.nTol && Math.abs(gate.netR - GATE.netR) <= GATE.rTol;
  // tests, Holm over T1 and T2
  const p1 = pOne(dec.t1.t), p2 = pOne(dec.t2.t), H = F.holm([p1, p2], ALPHA);
  const T1 = { ...dec.t1, pOneSided: r4(p1), holmP: r4(H.adj[0]) }, T2 = { ...dec.t2, pOneSided: r4(p2), holmP: r4(H.adj[1]) };
  // placebo
  const nonDays = days.filter((d) => inWin(d, DECISIVE) && !G.has(d));
  const pa = [], pb = [];
  for (let s = 1; s <= SEEDS; s++) {
    const rnd = F.mulberry32(s), mv = [], tr = [];
    for (const d of nonDays) {
      const e = MARKS[Math.floor(rnd() * MARKS.length)];
      const v = minuteMove(ix, d, e); if (v != null) mv.push(v);
      const t = tradeM1(ix, d, D.get(d), e, EXIT); if (t) tr.push(t.net);
    }
    pa.push(mean(mv)); pb.push(mean(tr));
  }
  const q = (a) => [...a].sort((x, y) => x - y)[P_RANK - 1], med = (a) => { const s = [...a].sort((x, y) => x - y); return (s[19] + s[20]) / 2; };
  const placebo = {
    seeds: SEEDS, rank: P_RANK, days: nonDays.length, marks: MARKS.length,
    minute: { p95: r4(q(pa)), median: r4(med(pa)), max: r4(Math.max(...pa)), otherFix: T2.other.mean, gotobiFix: T2.gotobi.mean,
      otherAbove: T2.other.mean > q(pa), gotobiAbove: T2.gotobi.mean > q(pa), values: pa.map(r4) },
    trade: { p95: r4(q(pb)), median: r4(med(pb)), max: r4(Math.max(...pb)), t1: T1.netR, t1Above: T1.netR > q(pb), values: pb.map(r4) },
  };
  const verdict = gate.pass ? reading(T1, T2) : 'UNCLEAR';
  const byYear = {};
  for (const t of trades.values()) { const y = t.day.slice(0, 4); (byYear[y] ||= { g: [], o: [] })[G.has(t.day) ? 'g' : 'o'].push(t); }
  const yr = Object.fromEntries(Object.entries(byYear).sort().map(([y, v]) => [y, {
    gotobi: { n: v.g.length, netR: r4(v.g.length ? mean(v.g.map((t) => t.net)) : null) },
    other: { n: v.o.length, netR: r4(v.o.length ? mean(v.o.map((t) => t.net)) : null) },
    fixGotobi: r4(mean(days.filter((d) => d.startsWith(y) && G.has(d)).map((d) => minuteMove(ix, d, ENTRY)).filter((v) => v != null))),
    fixOther: r4(mean(days.filter((d) => d.startsWith(y) && !G.has(d)).map((d) => minuteMove(ix, d, ENTRY)).filter((v) => v != null))),
  }]));
  return { verdict, gate, T1, T2, T3: dec.t3, decisive: dec, replication: rep, placebo, noTrade, byYear: yr };
}

// ---- report ------------------------------------------------------------------------------------------------------------
const fmt = (v, d = 3) => v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
export function report(o) {
  const L = [], T1 = o.T1, T2 = o.T2, T3 = o.T3, d = o.decisive, rp = o.replication, P = o.placebo;
  L.push('# Tokyo fix every day: is the fix-minute effect special to gotobi days?', '');
  L.push(`**Verdict: ${o.verdict}.** T1 (the frozen 00:55 sell / 06:00 buy-back on every non-gotobi Tokyo business day, 2016-now): ${fmt(T1.netR, 4)}R a trade net, n ${T1.n}, month t ${fmt(T1.t, 2)}. T2 (the 00:54 -> 00:55 fix-minute move): gotobi ${fmt(T2.gotobi.mean, 3)} pips against non-gotobi ${fmt(T2.other.mean, 3)} pips, difference ${fmt(T2.diff, 3)}, Welch t ${fmt(T2.t, 2)} (Holm p ${T2.holmP}). Pre-registered in PREREGISTRATION.md (first commit of the branch), OANDA mid M1, frozen gotobi-timing code. Paper research only: **no live proposal**, whatever the reading.`, '');
  L.push(`**Gate: ${o.gate.pass ? 'PASSED' : 'FAILED'}.** The M1 fade on gotobi days of 2016-now gives n ${o.gate.n} (#908: 771, ±${GATE.nTol}) and ${fmt(o.gate.netR, 4)}R a trade (#908: +0.1481, ±${GATE.rTol.toFixed(3)}R).`, '');
  L.push('## T1 and the gotobi days, the frozen fade (00:55 -> 06:00 UTC)', '');
  L.push('| Days | Window | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Win % | Stopped % |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [lab, k] of [['non-gotobi (T1)', 't1'], ['gotobi', 'gotobi']]) for (const [w, s] of [['2016-now', d[k]], ['2010-15', rp[k]]])
    L.push(`| ${lab} | ${w} | ${s.n} | ${fmt(s.netR, 4)} | ${fmt(s.grossR, 4)} | ${s.costR.toFixed(4)} | ${fmt(s.totalR, 1)} | ${fmt(s.t, 2)} | ${(s.win * 100).toFixed(1)} | ${(s.stopShare * 100).toFixed(1)} |`);
  L.push('', `T1 one-sided p ${T1.pOneSided}, Holm-adjusted ${T1.holmP}.`, '');
  L.push('## T2, the fix minute (open 00:55 − open 00:54, pips)', '');
  L.push('| Window | Gotobi: n | mean | sd | share up | Non-gotobi: n | mean | sd | share up | Difference | Welch t |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [w, x] of [['2016-now', d.t2], ['2010-15', rp.t2]])
    L.push(`| ${w} | ${x.gotobi.n} | ${fmt(x.gotobi.mean)} | ${x.gotobi.sd.toFixed(3)} | ${(x.gotobi.up * 100).toFixed(1)} % | ${x.other.n} | ${fmt(x.other.mean)} | ${x.other.sd.toFixed(3)} | ${(x.other.up * 100).toFixed(1)} % | ${fmt(x.diff)} | ${fmt(x.t, 2)} |`);
  L.push('', `T2 one-sided p ${T2.pOneSided}, Holm-adjusted ${T2.holmP}.`, '');
  L.push('Descriptive, not tested:', '');
  L.push('| Window | Fix minute in R of D: gotobi | non-gotobi | Minute after the fix (00:55 -> 00:56), pips: gotobi | non-gotobi |', '|---|---|---|---|---|');
  for (const [w, x] of [['2016-now', d.t2], ['2010-15', rp.t2]])
    L.push(`| ${w} | ${fmt(x.inR.gotobi.mean, 4)} | ${fmt(x.inR.other.mean, 4)} | ${fmt(x.after.gotobi.mean)} | ${fmt(x.after.other.mean)} |`);
  L.push('', '## T3, gotobi against non-gotobi month by month (net R a trade per month)', '');
  L.push('| Window | Months gotobi | mean | Months non-gotobi | mean | Difference | Welch t |', '|---|---|---|---|---|---|---|');
  for (const [w, x] of [['2016-now', d.t3], ['2010-15', rp.t3]]) L.push(`| ${w} | ${x.monthsGotobi} | ${fmt(x.gotobiMonthMean, 4)} | ${x.monthsOther} | ${fmt(x.otherMonthMean, 4)} | ${fmt(x.diff, 4)} | ${fmt(x.t, 2)} |`);
  L.push('', '## Placebo (40 seeds, random 5-minute windows 00:00-05:00 UTC on non-gotobi days of 2016-now)', '');
  L.push(`Each seed draws one window a day from ${P.marks} end marks (00:05 to 05:00, the marks 00:50, 00:55 and 01:00 left out), over ${P.days} non-gotobi days.`, '');
  L.push('| Measure | Seed median | 95th pct (38th of 40) | Max | Compared |', '|---|---|---|---|---|');
  L.push(`| one-minute move into the mark, pips | ${fmt(P.minute.median)} | ${fmt(P.minute.p95)} | ${fmt(P.minute.max)} | non-gotobi fix minute ${fmt(P.minute.otherFix)} (${P.minute.otherAbove ? 'above' : 'not above'}); gotobi fix minute ${fmt(P.minute.gotobiFix)} (${P.minute.gotobiAbove ? 'above' : 'not above'}) |`);
  L.push(`| fade from the mark to 06:00, net R a trade | ${fmt(P.trade.median, 4)} | ${fmt(P.trade.p95, 4)} | ${fmt(P.trade.max, 4)} | T1 ${fmt(P.trade.t1, 4)} (${P.trade.t1Above ? 'above' : 'not above'}) |`);
  L.push('', '## By year', '');
  L.push('| Year | Gotobi: n | net R a trade | fix minute (pips) | Non-gotobi: n | net R a trade | fix minute (pips) |', '|---|---|---|---|---|---|---|');
  for (const [y, v] of Object.entries(o.byYear)) L.push(`| ${y} | ${v.gotobi.n} | ${fmt(v.gotobi.netR, 4)} | ${fmt(v.fixGotobi)} | ${v.other.n} | ${fmt(v.other.netR, 4)} | ${fmt(v.fixOther)} |`);
  L.push('', '## Notes', '');
  for (const n of o.notes || []) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

function NOTES(o) {
  const n = [], d = o.decisive, rp = o.replication;
  const same = (a, b) => (a > 0) === (b > 0) ? 'same sign' : 'opposite sign';
  n.push(`Data: OANDA mid USD/JPY M1, 00:00-06:15 UTC of every Tokyo business day, first day with candles ${o.data.firstDay}, through ${o.data.lastDay} (${o.data.m1Candles} candles); D from #878's M5 file through the frozen stopDist. Days without a trade (missing candles or no D): gotobi ${o.noTrade.gotobi}, other ${o.noTrade.other} over both windows.`);
  n.push(`Replication 2010-15: T1 ${fmt(rp.t1.netR, 4)}R a trade (${same(rp.t1.netR, d.t1.netR)} as 2016-now), T2 difference ${fmt(rp.t2.diff, 3)} pips, Welch t ${fmt(rp.t2.t, 2)} (${same(rp.t2.diff, d.t2.diff)}), T3 ${fmt(rp.t3.diff, 4)}R (${same(rp.t3.diff, d.t3.diff)}).`);
  n.push(`Known before the study and said in the pre-registration: #878's M5 run already showed the fade on every non-gotobi day of 2016-now at −0.0628R a trade (n 1,870, month t −2.37). The M1 figure here is ${fmt(d.t1.netR, 4)}R (n ${d.t1.n}).`);
  n.push('T2 is a minute move in pips, not a trade: no cost applies. Its Welch t treats every day as independent; days are about a day apart and a one-minute move has little autocorrelation, so this is the plain reading the pre-registration fixed.');
  n.push(`Read after the verdict, descriptive and not tested (the pre-registration named the minute after the fix as descriptive only): in 2016-now the minute INTO the fix rises about the same on both kinds of day (gotobi ${fmt(d.t2.gotobi.mean)} pips, other days ${fmt(d.t2.other.mean)}), while the minute AFTER it falls ${fmt(d.t2.after.gotobi.mean)} pips on gotobi days against ${fmt(d.t2.after.other.mean)} on other days. So the gotobi difference, if it is real, is in the fall after 09:55, not in the rise before it; a test of that needs its own pre-registration on other data.`);
  n.push('The placebo is reported, not part of the reading: it shows whether the fix minute on ordinary days stands out from ordinary minutes of the same morning (a one-minute move into a 5-minute mark), and whether the 00:55 sell on ordinary days beats a sell at an ordinary mark of the morning.');
  n.push('No live proposal: this study only describes where the gotobi fade\'s effect comes from. Whether the gotobi fade itself is ever traded is an owner decision outside it, and the timing study (#908) already showed it needs a fill at the 00:55:00 price.');
  return n;
}

// ---- fetch ---------------------------------------------------------------------------------------------------------------
async function fetchM1(dir) {
  const BASEURL = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'usdjpy-1m-tokyo.json.gz'), part = path.join(dir, 'usdjpy-1m-tokyo.part.json');
  if (fs.existsSync(file)) { console.log(`${file} exists`); return; }
  const st = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : { done: {}, rows: [] };
  const days = businessDays().filter((d) => st.done[d] == null);
  let k = 0, next = 0;
  const one = async (d) => {
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
    if (++k % 100 === 0) { fs.writeFileSync(part, JSON.stringify(st)); console.log(`${d}: ${k}/${days.length}`); }
  };
  const worker = async () => { while (next < days.length) { const d = days[next++]; await one(d); await sleep(150); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const all = new Map(); for (const r of st.rows) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(bars)));
  fs.rmSync(part, { force: true });
  console.log(`${bars.length} M1 candles on ${Object.keys(st.done).length} Tokyo business days`);
}

export function load(f) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(f))); }

async function main() {
  const [a, b] = process.argv.slice(2);
  if (a === 'fetch') return fetchM1(b);
  if (!a || !b) throw new Error('usage: node run.mjs fetch <m1Dir> | node run.mjs <m1Dir> <usdjpy-5m.json.gz>');
  const m1 = load(path.join(a, 'usdjpy-1m-tokyo.json.gz')), m5 = load(b);
  const res = study(m1, m5);
  const out = {
    study: 'tokyo-fix-daily', built: '2026-11-14', verdict: res.verdict,
    question: 'Is the 09:55 Tokyo fix-minute effect of the gotobi fade special to gotobi days, or there on every Tokyo business day?',
    rule: 'Frozen T2 of research/edge/gotobi (#878) on M1 as research/edge/gotobi-timing (#908): sell USD/JPY at 00:55 UTC, buy back at 06:00 UTC; stop 1.5 x the 20-business-day median absolute move of that window (M5); net of 0.3 pip spread, USD 22.5 per million a side and 0.5 pip slippage a side.',
    frozen: { file: 'frozen.mjs', from: 'origin/gotobi-timing:research/edge/gotobi-timing/frozen.mjs', sha256: '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32' },
    data: { m1: 'OANDA mid M1 through the /md/bars proxy, 00:00-06:15 UTC of every Tokyo business day', m5: "OANDA mid M5 (#878's file) for the stop distance D", from: FROM, firstDay: new Date(m1[0][0] * 1000).toISOString().slice(0, 10), lastDay: LAST, m1Candles: m1.length },
    windows: { decisive: DECISIVE, replication: REPLICATION },
    reading: { gotobiSpecific: 'T1 <= 0 net or month t < 1, AND T2 Welch t >= 2 (gotobi > non-gotobi) with Holm p <= 0.05', everyDay: 'T1 > 0 with month t >= 2 and Holm p <= 0.05', unclear: 'otherwise' },
    liveProposal: 'none',
    ...res,
  };
  out.notes = NOTES(out);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log(out.verdict, 'gate', JSON.stringify(res.gate));
  console.log('T1', JSON.stringify(res.T1)); console.log('T2', JSON.stringify(res.T2)); console.log('T3', JSON.stringify(res.T3));
  console.log('rep', JSON.stringify({ t1: res.replication.t1, t2: res.replication.t2, t3: res.replication.t3 }));
  console.log('placebo', JSON.stringify({ m: { ...res.placebo.minute, values: undefined }, t: { ...res.placebo.trade, values: undefined } }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });

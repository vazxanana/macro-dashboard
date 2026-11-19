// Edge research · gotobi-jp225: the gotobi fade (#878 T2: sell at the 09:55 Tokyo fix on gotobi days, buy back at 15:00 Tokyo)
// moved to the Nikkei (OANDA JP225 CFD), a new-asset test of the fix-flow mechanism. The rule is the frozen gotobi run.mjs
// (frozen.mjs, byte for byte); only the market, the cost (a fraction of the index price) and the windows differ.
// PREREGISTRATION.md was pushed before any result.
//   node research/edge/gotobi-jp225/run.mjs coverage <candleDir>   (counts candles only; no returns)
//   node research/edge/gotobi-jp225/run.mjs full <candleDir>       (writes result.json and RESULT.md here)
// <candleDir> holds jp225-5m.json.gz (fetch.mjs) and usdjpy-5m.json.gz (the gotobi branch's fetch.mjs file).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const SYM = 'jp225', FX = 'usdjpy';
export const ORIGINAL = { id: 'T2', pair: 'usdjpy', leg: 'fade' };
export const LEG = 'fade';
// USD/JPY up (yen weaker) goes with the Nikkei up, so T2's side on USD/JPY (a sell) is the same side on JP225
export const MAP_SIGN = +1;
// cost a round trip as a fraction of the entry price: 0.04 % (about 18 index points at 45,000, the open-run-breadth-2 figure)
export const COST_FRAC = 0.0004, COST_X2 = 2;
// coverage rule for a year (counts only)
export const MIN_DAY_SHARE = 0.9, MIN_SLOT_SHARE = 0.8;
export const SEEDS = F.SEEDS, P_RANK = F.P_RANK, T_BAR = F.T_BAR;
export const DECISIVE_FROM = '2016-01-01', MIN_DECISIVE = 300;

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const median = (a) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const r4 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1e4) / 1e4);

export function businessDays(from, to) { const out = []; for (let d = from; d <= to; d = F.addD(d, 1)) if (F.isTokyoBusinessDay(d)) out.push(d); return out; }

// coverage of the fade window per year: share of Tokyo business days with the entry candle (00:55) and an exit price (06:00,
// the frozen exitPx), and the share of the 61 five-minute slots 00:55-05:55 present
export function coverage(bars, fromY, toY, lastDay = null) {
  const ix = F.index(bars), out = {};
  for (let y = fromY; y <= toY; y++) {
    const end = lastDay && lastDay < `${y}-12-31` ? lastDay : `${y}-12-31`, days = businessDays(`${y}-01-01`, end);
    let both = 0, slots = 0, slotsAll = 0, entry = 0;
    for (const d of days) {
      const { entry: e, exit: x } = F.legTimes(LEG, d);
      const ep = F.entryPx(ix, e), xp = F.exitPx(ix, x);
      if (ep) entry++;
      if (ep && xp != null) both++;
      for (let t = e; t < x; t += 300) { slotsAll++; if (ix.at.has(t)) slots++; }
    }
    const dayShare = days.length ? both / days.length : 0, slotShare = slotsAll ? slots / slotsAll : 0;
    out[y] = { days: days.length, entry, both, dayShare: r4(dayShare), slotShare: r4(slotShare), covered: dayShare >= MIN_DAY_SHARE && slotShare >= MIN_SLOT_SHARE };
  }
  return out;
}

// one JP225 trade: the frozen trade (side, stop, management, R), cost replaced by the index cost
export function jpTrade(ix, ymd, D, costFrac = COST_FRAC) {
  const t = F.trade(ix, LEG, ymd, D);
  if (!t) return null;
  const costR = costFrac * t.entry / t.D;
  return { ...t, side: F.LEGS[LEG].side * MAP_SIGN, costR, net: t.R - costR, stopPct: t.D / t.entry };
}

export function summary(trades) {
  if (!trades.length) return { n: 0 };
  const s = F.summary(trades); delete s.stopPips;
  s.stopPct = r4(median(trades.map((t) => t.stopPct)) * 100);
  s.netX2 = r4(mean(trades.map((t) => t.R - COST_X2 * t.costR)));
  return s;
}
export function welch(a, b) {
  const ma = mean(a), mb = mean(b), va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length;
  return { nA: a.length, nB: b.length, meanA: ma, meanB: mb, diff: ma - mb, t: (ma - mb) / Math.sqrt(va + vb) };
}
export function pearson(x, y) {
  const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  const r = sxy / Math.sqrt(sxx * syy), n = x.length;
  return { n, r, t: r * Math.sqrt((n - 2) / (1 - r * r)) };
}
// the fade window's move as a fraction of the entry price (frozen entry and exit price rules)
export function pctMove(ix, ymd) {
  const { entry, exit } = F.legTimes(LEG, ymd), e = F.entryPx(ix, entry), x = F.exitPx(ix, exit);
  return e && x != null ? (x - e.px) / e.px : null;
}

export function study(jp, fx, lastDay, cov) {
  const covered = (d) => cov[+d.slice(0, 4)] && cov[+d.slice(0, 4)].covered;
  const years = Object.keys(cov).map(Number).filter((y) => cov[y].covered);
  const repYears = years.filter((y) => y < 2016), decYears = years.filter((y) => y >= 2016);
  const ix = F.index(jp), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, LEG, d)); return moves.get(d); };
  const G = F.gotobiSet(2009, +lastDay.slice(0, 4));
  const from = `${Math.min(...years)}-01-01`;
  const days = businessDays(from, lastDay).filter(covered);
  const all = new Map(), noData = { gotobi: 0, other: 0 };
  for (const d of days) { const t = jpTrade(ix, d, F.stopDist(moveOf, d)); if (t) all.set(d, t); else noData[G.has(d) ? 'gotobi' : 'other']++; }
  const inDec = (d) => d >= DECISIVE_FROM, got = [...all.values()].filter((t) => G.has(t.day));
  const dec = got.filter((t) => inDec(t.day)), rep = got.filter((t) => !inDec(t.day));
  const pool = [...all.values()].filter((t) => !G.has(t.day) && inDec(t.day));
  const plac = []; for (let s = 1; s <= SEEDS; s++) plac.push(mean(F.draw(pool, dec.length, s).map((t) => t.net)));
  const sorted = [...plac].sort((a, b) => a - b), p95 = sorted[P_RANK - 1];
  const sD = summary(dec), sR = summary(rep);
  const checks = {
    netPositive: sD.netR > 0, monthT: sD.t != null && sD.t >= T_BAR, replicationPositive: sR.n > 0 && sR.netR > 0,
    x2Positive: sD.netX2 > 0, placebo: sD.netR > p95,
  };
  const byYear = {}; for (const t of got) (byYear[t.day.slice(0, 4)] ||= []).push(t);
  // secondaries: the plain move, gotobi vs other days; JP225 vs USD/JPY fix-window moves day by day
  const fix = F.index(fx), sec = {};
  for (const [w, f] of [['decisive', inDec], ['replication', (d) => !inDec(d)]]) {
    const g = [], o = [], cx = [], cy = [], gx = [], gy = [];
    for (const d of days) {
      if (!f(d)) continue;
      const m = pctMove(ix, d); if (m == null) continue;
      (G.has(d) ? g : o).push(m * 1e4);
      const u = pctMove(fix, d); if (u == null) continue;
      cx.push(m); cy.push(u); if (G.has(d)) { gx.push(m); gy.push(u); }
    }
    if (g.length < 3 || o.length < 3) { sec[w] = null; continue; }
    const W = welch(g, o), C = pearson(cx, cy), CG = gx.length > 3 ? pearson(gx, gy) : null;
    sec[w] = {
      moveBp: { gotobi: { n: W.nA, mean: r4(W.meanA) }, other: { n: W.nB, mean: r4(W.meanB) }, diff: r4(W.diff), welchT: r4(W.t) },
      corrAll: { n: C.n, r: r4(C.r), t: r4(C.t) }, corrGotobi: CG && { n: CG.n, r: r4(CG.r), t: r4(CG.t) },
    };
  }
  return {
    coveredYears: years, decisiveYears: decYears, replicationYears: repYears, noData,
    gotobiDays: { decisive: days.filter((d) => G.has(d) && inDec(d)).length, replication: days.filter((d) => G.has(d) && !inDec(d)).length },
    decisive: sD, replication: sR,
    placebo: { seeds: SEEDS, poolDays: pool.length, n: dec.length, p95: r4(p95), rank: P_RANK, median: r4(median(plac)), beats: plac.filter((v) => sD.netR > v).length, values: plac.map(r4) },
    allDays: summary(pool),
    byYear: Object.fromEntries(Object.entries(byYear).sort().map(([y, a]) => { const s = summary(a); return [y, { n: s.n, netR: s.netR, totalR: s.totalR }]; })),
    checks, pass: Object.values(checks).every(Boolean), secondary: sec,
  };
}

const fmt = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(o) {
  const L = [], r = o.res, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gotobi on the Nikkei: the fade after the 09:55 Tokyo fix, moved to JP225', '');
  L.push(`**Verdict: ${o.verdict}.** ${o.verdictLine} Pre-registered in PREREGISTRATION.md (pushed alone first). OANDA mid M5 JP225 (JP225_USD CFD), net of ${(COST_FRAC * 100).toFixed(2)} % of price a round trip. Paper research only; nothing live changed.`, '');
  L.push('## Coverage of the fade window (00:55-06:00 UTC), by year', '');
  L.push('| Year | Tokyo business days | Entry candle | Entry and exit | Day share | 5-min slot share | Covered |', '|---|---|---|---|---|---|---|');
  for (const [y, c] of Object.entries(o.coverage)) L.push(`| ${y} | ${c.days} | ${c.entry} | ${c.both} | ${(c.dayShare * 100).toFixed(1)} % | ${(c.slotShare * 100).toFixed(1)} % | ${yn(c.covered)} |`);
  L.push('', '## Primary test: sell JP225 at 00:55 UTC on gotobi days, buy back at 06:00 UTC', '');
  L.push('| Window | n | Net R a trade | Gross R a trade | Cost R | Net R at 2x cost | Total net R | Month t | Months | Win % | Stopped % | Median stop (% of price) |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [w, s] of [[`decisive ${o.windows.decisive.join(' to ')}`, r.decisive], [`replication ${o.windows.replication.join(' to ') || 'none'}`, r.replication]])
    L.push(s.n ? `| ${w} | ${s.n} | ${fmt(s.netR)} | ${fmt(s.grossR)} | ${s.costR.toFixed(3)} | ${fmt(s.netX2)} | ${fmt(s.totalR, 1)} | ${fmt(s.t, 2)} | ${s.months} | ${(s.win * 100).toFixed(1)} | ${(s.stopShare * 100).toFixed(1)} | ${s.stopPct.toFixed(3)} |` : `| ${w} | 0 | | | | | | | | | | |`);
  const c = r.checks;
  L.push('', '## The conditions', '');
  L.push('| Net R > 0 | Month t >= 2 | Replication net R > 0 | Net R at 2x cost > 0 | Above placebo 95th pct | Pass |', '|---|---|---|---|---|---|');
  L.push(`| ${yn(c.netPositive)} | ${yn(c.monthT)} (${fmt(r.decisive.t, 2)}) | ${yn(c.replicationPositive)} (${fmt(r.replication.netR)}) | ${yn(c.x2Positive)} (${fmt(r.decisive.netX2)}) | ${yn(c.placebo)} (95th pct ${fmt(r.placebo.p95)}, above ${r.placebo.beats} of 40) | ${r.pass ? 'PASS' : 'fail'} |`);
  L.push('', '## Placebo and every other day (decisive window)', '');
  L.push('| Placebo median net R | Placebo 95th pct (38th of 40) | Every non-gotobi day: n | net R | month t |', '|---|---|---|---|---|');
  L.push(`| ${fmt(r.placebo.median)} | ${fmt(r.placebo.p95)} | ${r.allDays.n} | ${fmt(r.allDays.netR)} | ${fmt(r.allDays.t, 2)} |`);
  L.push('', '## By year (gotobi trades)', '');
  const ys = Object.keys(r.byYear);
  L.push(`| | ${ys.join(' | ')} |`, `|---|${ys.map(() => '---').join('|')}|`);
  L.push(`| n | ${ys.map((y) => r.byYear[y].n).join(' | ')} |`, `| Total net R | ${ys.map((y) => fmt(r.byYear[y].totalR, 1)).join(' | ')} |`);
  L.push('', '## Secondary (reported, not conditions)', '');
  L.push('Plain move of JP225 from the 00:55 UTC open to the 06:00 UTC price, in basis points of the entry price, gotobi days against the other Tokyo business days (Welch t); and the correlation, day by day, of the JP225 and USD/JPY moves over the same window (same price rules, both from OANDA mid M5).', '');
  L.push('| Window | Gotobi n | Gotobi mean (bp) | Other n | Other mean (bp) | Difference (bp) | Welch t | Corr. all days (n, r, t) | Corr. gotobi days (n, r, t) |', '|---|---|---|---|---|---|---|---|---|');
  for (const [w, s] of Object.entries(r.secondary)) {
    if (!s) { L.push(`| ${w} | | | | | | | | |`); continue; }
    const m = s.moveBp, cg = s.corrGotobi;
    L.push(`| ${w} | ${m.gotobi.n} | ${fmt(m.gotobi.mean, 2)} | ${m.other.n} | ${fmt(m.other.mean, 2)} | ${fmt(m.diff, 2)} | ${fmt(m.welchT, 2)} | ${s.corrAll.n}, ${fmt(s.corrAll.r, 3)}, ${fmt(s.corrAll.t, 1)} | ${cg ? `${cg.n}, ${fmt(cg.r, 3)}, ${fmt(cg.t, 1)}` : 'n/a'} |`);
  }
  L.push('', '## Notes', '');
  for (const n of o.notes) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

function load(dir, sym) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`)))); }

async function main() {
  const [mode, dir] = process.argv.slice(2);
  if (!dir || !['coverage', 'full'].includes(mode)) throw new Error('usage: node run.mjs coverage|full <candleDir>');
  const jp = load(dir, SYM);
  const lastDay = F.addD(new Date(jp.at(-1)[0] * 1000).toISOString().slice(0, 10), -1);
  const cov = coverage(jp, 2010, +lastDay.slice(0, 4), lastDay);
  if (mode === 'coverage') { console.log(JSON.stringify({ first: new Date(jp[0][0] * 1000).toISOString(), lastDay, cov }, null, 1)); return; }
  const fx = load(dir, FX);
  const res = study(jp, fx, lastDay, cov);
  const rep = res.replicationYears;
  const verdict = res.decisive.n < MIN_DECISIVE ? `NOT MEASURABLE (inconclusive: ${res.decisive.n} decisive trades, fewer than ${MIN_DECISIVE})` : res.pass ? 'PASS' : 'FAIL';
  const s = res.decisive;
  const out = {
    study: 'gotobi-jp225', built: '2026-11-14', verdict,
    verdictLine: `Decisive window: n ${s.n}, ${fmt(s.netR)}R a trade net (${fmt(s.grossR)} gross), month t ${fmt(s.t, 2)}; replication ${res.replication.n ? `n ${res.replication.n}, ${fmt(res.replication.netR)}R` : 'none'}; at 2x cost ${fmt(s.netX2)}R; placebo 95th pct ${fmt(res.placebo.p95)}R.`,
    rule: 'Gotobi days (frozen gotobi run.mjs). Sell JP225 at the open of the 00:55 UTC M5 candle (09:55 Tokyo), buy back at 06:00 UTC (15:00 Tokyo); stop 1.5 x the 20-business-day median of the same window\'s absolute move; no target; R net of 0.04 % of the entry price a round trip.',
    mapping: 'USD/JPY up = yen weaker = Nikkei up (positive link), so T2\'s USD/JPY sell maps to a JP225 sell (MAP_SIGN +1).',
    data: { source: 'OANDA mid M5 through the /md/bars proxy (JP225_USD; USD/JPY for the secondary correlation)', first: new Date(jp[0][0] * 1000).toISOString().slice(0, 10), lastDay },
    windows: { decisive: [DECISIVE_FROM, lastDay], replication: rep.length ? [`${Math.min(...rep)}-01-01`, `${Math.max(...rep)}-12-31`] : [] },
    costs: { roundTripFracOfPrice: COST_FRAC, x2: COST_X2 },
    coverage: cov, res,
  };
  out.notes = notes(out);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log(verdict, JSON.stringify(res.decisive), JSON.stringify(res.replication), JSON.stringify(res.checks), JSON.stringify(res.secondary));
}

function notes(o) {
  const r = o.res, n = [];
  n.push(`Data: OANDA mid M5 JP225 from ${o.data.first} through ${o.data.lastDay}, candles 00:00-06:55 UTC only. Gotobi trades lost to missing candles or a short lookback in covered years: ${r.noData.gotobi} (other days ${r.noData.other}).`);
  n.push('JP225_USD is quoted in Nikkei index points (P&L in USD); the price is not converted at the FX rate, so its move is the index move.');
  n.push(`Cost: ${(COST_FRAC * 100).toFixed(2)} % of the entry price a round trip (about 18 points at 45,000: OANDA's typical daytime spread of about 8 points plus one Osaka mini tick of 5 points each way, the figure fixed in open-run-breadth-2), assumed, not measured. Intraday, no financing.`);
  n.push('The month t is on calendar-month sums of net R; `tradeT` in result.json treats the trades of a month as independent and is for information only.');
  n.push('One test, so no Holm correction inside the study; it is one more line in the multiple-testing ledger.');
  const d = r.decisive, a = r.allDays, m = r.secondary.decisive && r.secondary.decisive.moveBp;
  if (m) n.push(`Read after the verdict, not part of it: the gotobi trades beat ordinary days (${fmt(d.netR)}R against ${fmt(a.netR)}R a trade; the placebo condition holds) and the gotobi move after the fix leans the predicted way (${fmt(m.diff, 2)} bp against other days, Welch t ${fmt(m.welchT, 2)}), but before costs the trade makes only ${fmt(d.grossR)}R, under its cost of ${d.costR.toFixed(3)}R, and the plain-move difference is not apart from noise; ordinary days make ${fmt(a.grossR)}R before costs, so the gotobi gap is about ${fmt(d.grossR - a.grossR)}R a trade, beyond the 40 placebo draws but smaller than the cost. The Nikkei does move with USD/JPY in this window (r ${fmt(r.secondary.decisive.corrAll.r)}), so a fix flow of the size seen on USD/JPY would be expected to show; it does not, measurably.`);
  return n;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();

// research/edge/asia-sweep-ifvg/run.mjs - PREREGISTRATION.md (24 Nov 2026): the Asia range (00:00-06:00 UTC) swept in
// 07:00-10:00 UTC, entered at market when a later 5-minute candle closes back through a fair value gap of the sweep leg
// (the gap inverts) and back inside the range; stop past the sweep extreme; targets the range's middle and its far side.
// Controls: the first close back inside the range, same stop and targets. Five markets, discovery 2005-14, confirmation
// 2015 to Oct 2026, judged after costs on calendar-month sums. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/asia-sweep-ifvg/run.mjs run      (reads the cache, writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
const y = (yr, m = 0) => Date.UTC(yr, m, 1) / 1000;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);       // fills 2005-01-01 .. 2026-10-31
export const NM = 262, DM = 120;                                       // months 2005-01 .. 2026-10; discovery 0..119
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const H = 3600, ASIA_END = 6, SWEEP_FROM = 7, SWEEP_TO = 10, TRIG_TO = 12, EXIT_AT = 16, MIN_ASIA = 54, BACK = 12;
export const CELLS = [
  { name: 'ifvg mid', kind: 'ifvg', target: 'mid', floor: 0.5, judged: true },
  { name: 'ifvg far', kind: 'ifvg', target: 'far', floor: 1.0, judged: true },
  { name: 'reclaim mid', kind: 'reclaim', target: 'mid', floor: 0.5, judged: false },
  { name: 'reclaim far', kind: 'reclaim', target: 'far', floor: 1.0, judged: false },
];

// One side of one day. side -1 = the Asia high swept (a sell), +1 = the Asia low swept (a buy). Everything is read in
// mirrored terms (for a buy every price is negated), so the text below is the sell's. s = the sweep candle's index.
// Returns { ifvg, reclaim, why }: each trigger = { j, stop } (stop in real prices) or null.
export function sideRun(M5, s, endT, side, AH, AL, cost) {
  const g = side < 0 ? 1 : -1;
  const up = (b) => (g > 0 ? b.h : -b.l), dn = (b) => (g > 0 ? b.l : -b.h), cl = (b) => g * b.c;
  const level = g > 0 ? AH : -AL, mid = (g * (AH + AL)) / 2;
  let amin = s; while (amin > 0 && M5[amin - 1].t >= M5[s].t - H) amin--;
  let E = -Infinity, x = -1, ifvg = null, reclaim = null, why = null, anyGap = false;
  for (let j = s; j < M5.length && M5[j].t < endT; j++) {
    const b = M5[j];
    if (up(b) > E) { E = up(b); x = j; }
    if (dn(b) <= mid) { why = 'cancelled'; break; }
    if (!reclaim && cl(b) < level) reclaim = { j, stop: g * (E + cost) };
    if (!ifvg) {
      let gaps = 0;
      for (let a = amin; a + 2 <= x && a + 2 < j; a++) {
        const edge = up(M5[a]);
        if (!(dn(M5[a + 2]) > edge)) continue;                       // not an up gap
        gaps++;
        if (!(cl(b) < edge)) continue;
        let spent = false; for (let m = a + 3; m < j; m++) if (cl(M5[m]) < edge) { spent = true; break; }
        if (spent) continue;
        if (cl(b) < level) { ifvg = { j, stop: g * (E + cost) }; break; }
      }
      if (gaps) anyGap = true;
    }
    if (ifvg) { why = 'trigger'; break; }
  }
  return { ifvg, reclaim, why: why || (anyGap ? 'no trigger' : 'no gap') };
}

// Every day's signals: [{ kind, side, j, t (the trigger candle's close), stop, ah, al, mid, day }], at most one a kind a day.
// counts (optional) receives the funnel.
export function signals(M5, cost, counts = {}) {
  const out = []; const add = (k) => { counts[k] = (counts[k] || 0) + 1; };
  let i = 0; const n = M5.length;
  while (i < n) {
    const day = Math.floor(M5[i].t / 86400) * 86400; let e = i; while (e < n && M5[e].t < day + 86400) e++;
    const wd = new Date(day * 1000).getUTCDay(); const i0 = i; i = e;
    if (wd < 1 || wd > 5) continue;
    add('days');
    let i6 = i0; while (i6 < e && M5[i6].t < day + ASIA_END * H) i6++;
    if (i6 - i0 < MIN_ASIA) { add('noRange'); continue; }
    let AH = -Infinity, AL = Infinity; for (let k = i0; k < i6; k++) { if (M5[k].h > AH) AH = M5[k].h; if (M5[k].l < AL) AL = M5[k].l; }
    if (!(AH > AL)) { add('noRange'); continue; }
    let i7 = i6, gh = -Infinity, gl = Infinity; while (i7 < e && M5[i7].t < day + SWEEP_FROM * H) { if (M5[i7].h > gh) gh = M5[i7].h; if (M5[i7].l < gl) gl = M5[i7].l; i7++; }
    const best = { ifvg: null, reclaim: null };
    for (const side of [-1, 1]) {
      if (side < 0 ? gh > AH : gl < AL) { add('notFresh'); continue; }
      let s = -1; for (let k = i7; k < e && M5[k].t < day + SWEEP_TO * H; k++) if (side < 0 ? M5[k].h > AH : M5[k].l < AL) { s = k; break; }
      if (s < 0) continue;
      add('sweeps');
      const r = sideRun(M5, s, day + TRIG_TO * H, side, AH, AL, cost);
      add('ifvg ' + r.why);
      for (const kind of ['ifvg', 'reclaim']) if (r[kind] && (!best[kind] || r[kind].j < best[kind].j))
        best[kind] = { kind, side, j: r[kind].j, t: M5[r[kind].j].e, stop: r[kind].stop, ah: AH, al: AL, mid: (AH + AL) / 2, day };
    }
    for (const kind of ['ifvg', 'reclaim']) if (best[kind]) out.push(best[kind]);
  }
  return out;
}

// One signal in one cell: the trade, or { skip: reason }.
export function tradeOf(M5, sg, cell, cost) {
  const fi = sg.j + 1;
  if (fi >= M5.length || M5[fi].t - M5[sg.j].e > 300) return { skip: 'no next candle' };
  const fill = M5[fi].o, risk = sg.side * (fill - sg.stop);
  if (!(risk > cost)) return { skip: 'risk not above the cost' };
  const target = cell.target === 'mid' ? sg.mid : sg.side < 0 ? sg.al : sg.ah;
  if (!((sg.side * (target - fill)) / risk >= cell.floor)) return { skip: 'target too near' };
  const r = K.simulate({ side: sg.side, entry: fill, stop: sg.stop, target, t: M5[fi].t, type: 'market', maxHold: sg.day + EXIT_AT * H - M5[fi].t }, M5, { cost });
  if (r.status === 'open' || r.status === 'bad' || r.status === 'nofill') return { skip: 'not closed' };
  return { side: sg.side, fillT: r.fillT, fill, stop: sg.stop, target, R: r.R, Rnet: r.Rnet, reason: r.reason, exitT: r.exitT };
}

const newAcc = () => CELLS.map(() => ({ n: [0, 0], win: [0, 0], sum: [0, 0], net: [0, 0], sq: [0, 0], ms: new Array(NM).fill(0), msn: new Array(NM).fill(0),
  side: { buy: [0, 0, 0, 0], sell: [0, 0, 0, 0] }, exits: { stop: 0, target: 0, time: 0 }, skips: {} }));
const inBad = (X, t) => X.some((r) => t >= r[0] && t <= r[1]);

export function runMarket(market, bars) {
  const M5 = bars || K.load(market, '5m', { from: '2004-12-25', to: '2026-11-01' });
  const cost = COSTS[market], X = exclusions(market), counts = {}, acc = newAcc();
  const sigs = signals(M5, cost, counts);
  for (const sg of sigs) CELLS.forEach((cell, ci) => {
    if (cell.kind !== sg.kind) return;
    const A = acc[ci], tr = tradeOf(M5, sg, cell, cost);
    if (tr.skip) { A.skips[tr.skip] = (A.skips[tr.skip] || 0) + 1; return; }
    if (tr.fillT < FROM || tr.fillT >= TO) return;
    if (inBad(X, tr.fillT)) { A.skips.excluded = (A.skips.excluded || 0) + 1; return; }
    const w = tr.fillT < SPLIT ? 0 : 1, m = monthOf(tr.fillT);
    A.n[w]++; if (tr.R > 0) A.win[w]++; A.sum[w] += tr.R; A.net[w] += tr.Rnet; A.sq[w] += tr.Rnet * tr.Rnet; A.ms[m] += tr.R; A.msn[m] += tr.Rnet;
    const S = A.side[tr.side > 0 ? 'buy' : 'sell']; S[w * 2]++; S[w * 2 + 1] += tr.Rnet; A.exits[tr.reason]++;
  });
  return { market, first: M5.length ? new Date(M5[0].t * 1000).toISOString().slice(0, 10) : null, last: M5.length ? new Date(M5[M5.length - 1].t * 1000).toISOString().slice(0, 10) : null,
    counts, acc };
}

export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return sd > 0 ? mean / (sd / Math.sqrt(n)) : 0; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
function win(A, w) { const n = A.n[w], a = w ? DM : 0, b = w ? NM : DM;
  return { n, win: n ? r4(A.win[w] / n) : null, before: n ? r4(A.sum[w] / n) : null, after: n ? r4(A.net[w] / n) : null, tBefore: r4(mstat(A.ms, a, b)), tAfter: r4(mstat(A.msn, a, b)), months: b - a }; }

export function judge(list) {
  const cells = CELLS.map((cell, ci) => {
    const P = newAcc()[0];
    for (const d of list) { const A = d.acc[ci]; for (const w of [0, 1]) for (const k of ['n', 'win', 'sum', 'net', 'sq']) P[k][w] += A[k][w];
      for (let m = 0; m < NM; m++) { P.ms[m] += A.ms[m]; P.msn[m] += A.msn[m]; }
      for (const s of ['buy', 'sell']) for (let k = 0; k < 4; k++) P.side[s][k] += A.side[s][k];
      for (const k of Object.keys(P.exits)) P.exits[k] += A.exits[k];
      for (const [k, v] of Object.entries(A.skips)) P.skips[k] = (P.skips[k] || 0) + v; }
    const sideOf = (S) => ({ disc: { n: S[0], after: S[0] ? r4(S[1] / S[0]) : null }, conf: { n: S[2], after: S[2] ? r4(S[3] / S[2]) : null } });
    return { cell: cell.name, judged: cell.judged, disc: win(P, 0), conf: win(P, 1), sides: { buy: sideOf(P.side.buy), sell: sideOf(P.side.sell) }, exits: P.exits, skips: P.skips,
      markets: Object.fromEntries(list.map((d) => [d.market, { disc: win(d.acc[ci], 0), conf: win(d.acc[ci], 1) }])) };
  });
  const J = cells.filter((c) => c.judged); const hp = K.holm(J.map((c) => p1(c.conf.tAfter, c.conf.months - 1)));
  J.forEach((c, i) => { c.holm = r4(hp[i]);
    c.pass = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.after > 0 && c.conf.after > 0 && c.disc.tAfter >= 2 && c.conf.tAfter >= 2 && hp[i] < 0.05; });
  const enough = J.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  const verdict = J.some((c) => c.pass) ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE';
  const best = [...J].sort((a, b) => (b.conf.after ?? -9) - (a.conf.after ?? -9))[0];
  const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
  const headline = `${J.filter((c) => c.pass).length} of ${J.length} judged cells pass; the best, ${best.cell}, made ${f3(best.conf.after)}R a trade after costs in 2015-26 (n ${best.conf.n.toLocaleString('en-US')}, month t ${best.conf.tAfter.toFixed(2)}; discovery ${f3(best.disc.after)}R, n ${best.disc.n.toLocaleString('en-US')}, t ${best.disc.tAfter.toFixed(2)})`;
  return { verdict, headline, best: best.cell, cells };
}

export function resultMd(R) {
  const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
  const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), pc = (x) => (x == null ? 'n/a' : Math.round(x * 100) + ' %'), N = (x) => x.toLocaleString('en-US');
  const row = (c, w, lab) => `| ${lab} | ${w === 'disc' ? '2005-14' : '2015-26'} | ${N(c[w].n)} | ${pc(c[w].win)} | ${f3(c[w].before)} | ${f2(c[w].tBefore)} | ${f3(c[w].after)} | ${f2(c[w].tAfter)} |`;
  const L = [];
  L.push('# Asia range swept in the London morning, entered on a 5-minute inversion fair value gap (result)', '');
  L.push(`**Verdict: ${R.verdict}. ${R.headline}.**`, '');
  L.push('Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing is',
    'proposed. One run of `run.mjs`, no variants. OANDA mid 5-minute candles from the shared cache, five markets pooled',
    `(${R.markets.map((m) => `${m.market} ${m.first} to ${m.last}`).join('; ')}), fills 2005-01-01 to 2026-10-31. Costs: \`combo-grid-2\` round trips.`, '');
  L.push('## Cells (R a trade; t = the t of calendar-month sums, 120 months in discovery, 142 in confirmation)', '');
  L.push('| Cell | Window | Trades | Won | Before costs | Month t | After costs | Month t |', '|---|---|---|---|---|---|---|---|');
  for (const c of R.cells) { L.push(row(c, 'disc', c.cell + (c.judged ? ' (judged)' : ' (control)'))); L.push(row(c, 'conf', '')); }
  L.push('');
  const J = R.cells.filter((c) => c.judged);
  L.push(`Holm-adjusted one-sided p of the confirmation month t after costs: ${J.map((c) => `${c.cell} ${c.holm.toFixed(2)}`).join(', ')}. Pass bar: 300 trades in each window, after-cost mean above 0 and`,
    `month t at least 2 in both windows, Holm p under 0.05. ${J.filter((c) => c.pass).length} of ${J.length} judged cells meet it.`, '');
  L.push('## Does the gap inversion beat the plain close back inside? (reported, not judged)', '');
  for (const t of ['mid', 'far']) { const a = R.cells.find((c) => c.cell === 'ifvg ' + t), b = R.cells.find((c) => c.cell === 'reclaim ' + t);
    L.push(`- Target ${t}: inversion ${f3(a.conf.after)}R (n ${N(a.conf.n)}) against the plain close back ${f3(b.conf.after)}R (n ${N(b.conf.n)}) after costs in 2015-26, difference ${f3(a.conf.after - b.conf.after)}R; in 2005-14 ${f3(a.disc.after)}R against ${f3(b.disc.after)}R. Before costs in 2015-26: ${f3(a.conf.before)}R against ${f3(b.conf.before)}R.`); }
  L.push('');
  L.push('## The judged cells by market and side (after costs)', '');
  L.push('| Cell | Market | 2005-14 n | R | Month t | 2015-26 n | R | Month t |', '|---|---|---|---|---|---|---|---|');
  for (const c of J) for (const [m, v] of Object.entries(c.markets)) L.push(`| ${c.cell} | ${m} | ${N(v.disc.n)} | ${f3(v.disc.after)} | ${f2(v.disc.tAfter)} | ${N(v.conf.n)} | ${f3(v.conf.after)} | ${f2(v.conf.tAfter)} |`);
  L.push('');
  for (const c of J) L.push(`- ${c.cell}: buys ${f3(c.sides.buy.disc.after)}R (n ${N(c.sides.buy.disc.n)}) then ${f3(c.sides.buy.conf.after)}R (n ${N(c.sides.buy.conf.n)}); sells ${f3(c.sides.sell.disc.after)}R (n ${N(c.sides.sell.disc.n)}) then ${f3(c.sides.sell.conf.after)}R (n ${N(c.sides.sell.conf.n)}). Exits: ${N(c.exits.target)} targets, ${N(c.exits.stop)} stops, ${N(c.exits.time)} at the 16:00 UTC time exit. Skipped at entry: ${Object.entries(c.skips).map(([k, v]) => `${k} ${N(v)}`).join(', ') || 'none'}.`);
  L.push('');
  L.push('## The funnel (all five markets, the whole file)', '');
  const T = {}; for (const m of R.markets) for (const [k, v] of Object.entries(m.counts)) T[k] = (T[k] || 0) + v;
  L.push(`${N(T.days || 0)} market weekdays; ${N(T.noRange || 0)} without a usable Asia range; ${N(T.notFresh || 0)} sides already traded through between 06:00 and 07:00; ${N(T.sweeps || 0)} fresh sides swept in 07:00-10:00.`,
    `Of those sweeps: ${N(T['ifvg trigger'] || 0)} gave an inversion trigger, ${N(T['ifvg cancelled'] || 0)} were cancelled at the middle of the range first, ${N(T['ifvg no gap'] || 0)} had no gap in the sweep leg by 12:00, ${N(T['ifvg no trigger'] || 0)} had a gap that never inverted back inside the range by 12:00.`, '');
  L.push('## What it says', '');
  L.push(R.verdict === 'PASS'
    ? 'A judged cell meets the pre-registered bar. By the pre-registration this is a hypothesis for a holdout test on other markets, not a rule to trade.'
    : R.verdict === 'INCONCLUSIVE' ? 'No judged cell has 300 trades in both windows: too few trades to judge.'
      : 'No judged cell meets the bar after costs in both decades. Entering a swept Asia range on the inversion of a sweep-leg gap is not shown to make money on these five markets; the controls show how much of any figure comes from the sweep and the close back inside alone.');
  L.push('', 'Limits: OANDA mid candles (no bid / ask), the same round-trip cost charged in every year, fills at the next 5-minute open, a stop',
    'and a target inside one candle counted as a stop. The gap and leg definitions are this study\'s own plain reading, fixed before the run.', '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'run') {
    const list = [];
    for (const m of MARKETS) { const d = runMarket(m); list.push(d); console.error(m, d.first, d.last, JSON.stringify(d.counts), d.acc.map((a) => a.n.join('/')).join(' ')); }
    const Jd = judge(list);
    const R = { study: 'asia-sweep-ifvg', built: '2026-11-24', verdict: Jd.verdict, headline: Jd.headline, best: Jd.best,
      windows: { discovery: '2005-01-01 to 2014-12-31', confirmation: '2015-01-01 to 2026-10-31' }, costs: Object.fromEntries(MARKETS.map((m) => [m, COSTS[m]])),
      markets: list.map((d) => ({ market: d.market, first: d.first, last: d.last, counts: d.counts })), cells: Jd.cells };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(R));
    console.log(R.verdict, R.headline);
  } else console.error('usage: run.mjs run');
}

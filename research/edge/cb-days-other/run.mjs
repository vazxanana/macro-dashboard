// Edge research · cb-days-other: the frozen ecb-boj-days rule (follow the first 60 minutes after a central-bank decision)
// on the BoE (GBP/USD), BoC (USD/CAD), SNB (USD/CHF), RBA (AUD/USD) and RBNZ (NZD/USD), OANDA mid M5, net of the raw-spread
// forex costs. Rule, minutes, costs, windows, placebo and pass bar: PREREGISTRATION.md (committed first, with dates.json and
// frozen.mjs). The rule itself lives in frozen.mjs and is not edited here.
//   node --use-env-proxy research/edge/cb-days-other/fetch.mjs <dir>    (candles, kept out of git)
//   node research/edge/cb-days-other/run.mjs <dir>                     (writes result.json and RESULT.md here)
// Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { DATES, BANKS, P, eventDates, bannedOf, toBars, trade, stat, monthT, quantile, rng, pOne, holm } from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, M5 = 300;
const T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const dnum = (s) => Date.parse(s + 'T00:00:00Z') / (DAY * 1000);
const dstr = (n) => new Date(n * DAY * 1000).toISOString().slice(0, 10);
const weekday = (s) => { const w = new Date(s + 'T00:00:00Z').getUTCDay(); return w !== 0 && w !== 6; };
// the study's own settings (pre-registered; not part of the frozen trade)
export const S = Object.freeze({
  W: Object.freeze({ rep: [T0('2010-01-01'), T0('2018-01-01')], dec: [T0('2018-01-01'), T0('2026-11-14')] }),
  SEEDS: 40, HALF: 182, EXCL_DAYS: 3, TRIES: 50, Q: 0.95, N_MIN: 40, T_MIN: 2, ALPHA: 0.05,
});
export const NAME = { BOE: 'BoE, GBP/USD', BOC: 'BoC, USD/CAD', SNB: 'SNB, USD/CHF', RBA: 'RBA, AUD/USD', RBNZ: 'RBNZ, NZD/USD' };

// placebo pool of one event: weekdays within ±HALF days, inside the window, not within EXCL_DAYS of any decision of that bank
export function standIns(date, win, bank) {
  const d0 = dnum(date), ban = [...bannedOf(bank)].map(dnum), out = [];
  for (let d = d0 - S.HALF; d <= d0 + S.HALF; d++) {
    const ds = dstr(d); if (!weekday(ds)) continue;
    if (ban.some((x) => Math.abs(x - d) <= S.EXCL_DAYS)) continue;
    const T = T0(ds); if (T < win[0] || T >= win[1]) continue;
    out.push(ds);
  }
  return out;
}
// per seed: one stand-in day per event (redrawn when it gives no trade); the frozen trade() at the bank's own clock minutes
export function placebo(b, bank, dates, win, banned, seeds = S.SEEDS) {
  const pools = dates.map((d) => standIns(d, win, bank)), cache = new Map(), out = [], k0 = BANKS.indexOf(bank) + 1;
  const tr = (ds) => { if (!cache.has(ds)) cache.set(ds, trade(b, bank, P.SYM[bank], ds, banned)); return cache.get(ds); };
  for (let s = 1; s <= seeds; s++) {
    const r = rng(s * 7919 + k0), xs = [];
    for (const pool of pools) for (let k = 0; k < S.TRIES && pool.length; k++) { const x = tr(pool[Math.floor(r() * pool.length)]); if (!x.skip) { xs.push(x.net); break; } }
    out.push(xs);
  }
  return out;
}
export function judge(dec, rep, p95, holmP = null) {
  const c = { nOk: dec.n >= S.N_MIN, positive: dec.mean > 0, t2: dec.mt != null && dec.mt >= S.T_MIN, ...(holmP == null ? {} : { holm: holmP < S.ALPHA }),
    sameSign: rep.mean != null && rep.mean > 0, beatsPlacebo: p95 != null && dec.mean > p95, cost2: dec.mean2 != null && dec.mean2 > 0 };
  return { ...c, pass: Object.values(c).every(Boolean) };
}

const r2 = (x, d = 3) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
function summarize(trs, win) {
  const net = stat(trs.map((x) => x.net)), gross = stat(trs.map((x) => x.R)), n2 = stat(trs.map((x) => x.net2)), why = {};
  for (const x of trs) why[x.why] = (why[x.why] || 0) + 1;
  const mt = monthT(trs, win[0], win[1]), mt2 = monthT(trs, win[0], win[1], 'net2');
  return { n: net.n, netR: r2(net.mean), monthT: r2(mt.t, 2), months: mt.months, tradeT: r2(net.t, 2), grossR: r2(gross.mean), costR: r2(stat(trs.map((x) => x.costR)).mean),
    net2R: r2(n2.mean), monthT2: r2(mt2.t, 2), win: r2(trs.filter((x) => x.net > 0).length / (trs.length || 1)), exits: why, raw: { n: net.n, mean: net.mean, mt: mt.t, mean2: n2.mean } };
}
export function load(dir, sym) { return toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`))))); }

export function run(dir) {
  const out = { study: 'cb-days-other', built: '2026-11-14', preregistration: 'research/edge/cb-days-other/PREREGISTRATION.md', dates: DATES.provenance,
    scope: 'The frozen ecb-boj-days rule on five other central banks\' scheduled decisions; a stand-alone event rule on forex, not a test of the gold book (owner decision item 44 untouched).',
    rule: 'direction of the first 60 minutes after the decision (close of the M5 candle ending at D + 60 min against the one ending at D); entry at D + 60 min in that direction, stop 1 x the 14-hour ATR known at D, no target, out at 21:00 UTC (BoE, BoC, SNB) / 15:00 UTC (RBA, RBNZ). D: 12:00 London, 09:45 or 10:00 Toronto (larger-range candle), 09:30 Zurich, 14:30 Sydney, 14:00 Wellington (before 2019 the larger-range candle of 09:00 and 14:00; 09:00 = no trade)',
    costs: 'per round trip 0.3 pip spread + 0.3 pip slippage + 45 USD per million notional commission (0.0045 % of the price)', windows: { rep: '2010-2017', dec: '2018 → now' }, banks: [], detail: {} };
  const pooled = { dec: [], rep: [], pl: [] };
  let lastAll = Infinity;
  for (const bank of BANKS) {
    const sym = P.SYM[bank], b = load(dir, sym), lastT = b.t[b.n - 1] + M5, banned = bannedOf(bank), all = eventDates(bank);
    lastAll = Math.min(lastAll, lastT);
    const det = { bank, sym, candles: b.n, from: dstr(Math.floor(b.t[0] / DAY)), to: dstr(Math.floor((lastT - 1) / DAY)), windows: {} };
    for (const [w, win0] of Object.entries(S.W)) {
      const win = [win0[0], Math.min(win0[1], lastT)], dates = all.filter((d) => T0(d) >= win[0] && T0(d) < win[1]);
      const trs = [], skipped = {}, clock = {};
      for (const d of dates) {
        const x = trade(b, bank, sym, d, banned);
        if (x.ecb && x.ecb.two) { const y = d.slice(0, 4); clock[y] ||= {}; clock[y][x.ecb.local] = (clock[y][x.ecb.local] || 0) + 1; }
        if (x.skip) skipped[x.skip] = (skipped[x.skip] || 0) + 1; else trs.push(x);
      }
      const W = { events: dates.length, skipped, ...summarize(trs, win) };
      const byYear = {};
      for (const x of trs) (byYear[x.date.slice(0, 4)] ||= []).push(x.net);
      W.byYear = Object.fromEntries(Object.entries(byYear).map(([y, xs]) => [y, { n: xs.length, netR: r2(stat(xs).mean) }]));
      W.clock = { picks: clock, confirmed: trs.filter((x) => x.ecb.confirmed).length, unconfirmed: trs.filter((x) => !x.ecb.confirmed).map((x) => x.date) };
      W.trades = trs.map((x) => ({ date: x.date, D: new Date(x.D * 1000).toISOString().slice(11, 16), side: x.d > 0 ? 'buy' : 'sell', entry: r2(x.entry, 5), stop: r2(x.stop, 5), exit: r2(x.exit, 5), why: x.why, R: r2(x.R), net: r2(x.net) }));
      pooled[w].push(...trs);
      if (w === 'dec') {
        const pl = placebo(b, bank, dates, win, banned), pm = pl.map((xs) => stat(xs).mean);
        pooled.pl.push(pl);
        W.placebo = { seeds: pm.length, p5: r2(quantile(pm, 0.05)), p50: r2(quantile(pm, 0.5)), p95: r2(quantile(pm, S.Q)), max: r2(Math.max(...pm)), beaten: pm.filter((x) => W.raw.mean > x).length, p95raw: quantile(pm, S.Q) };
        W.window = [dstr(win[0] / DAY), dstr(Math.floor((win[1] - 1) / DAY))];
      }
      det.windows[w] = W;
    }
    out.detail[bank] = det;
  }
  const ps = BANKS.map((bk) => pOne(out.detail[bk].windows.dec.raw.mt)), adj = holm(ps);
  BANKS.forEach((bk, k) => {
    const W = out.detail[bk].windows, j = judge(W.dec.raw, W.rep.raw, W.dec.placebo.p95raw, adj[k]);
    out.banks.push({ bank: bk, sym: P.SYM[bk], n: W.dec.n, netR: W.dec.netR, monthT: W.dec.monthT, p: r2(ps[k], 4), holmP: r2(adj[k], 4),
      repN: W.rep.n, repNetR: W.rep.netR, placeboP5: W.dec.placebo.p5, placeboP50: W.dec.placebo.p50, placeboP95: W.dec.placebo.p95, net2R: W.dec.net2R, monthT2: W.dec.monthT2, ...j });
  });
  // pooled: the five banks' trades, month sums over the decisive window (ending with the earliest last candle of the five)
  const decW = [S.W.dec[0], Math.min(S.W.dec[1], lastAll)];
  const pd = summarize(pooled.dec.filter((x) => x.D < decW[1]), decW), pr = summarize(pooled.rep, S.W.rep);
  const pm = pooled.pl[0].map((_, s) => stat(pooled.pl.flatMap((pl) => pl[s])).mean), p95 = quantile(pm, S.Q);
  out.pooled = { n: pd.n, netR: pd.netR, monthT: pd.monthT, months: pd.months, tradeT: pd.tradeT, grossR: pd.grossR, costR: pd.costR, win: pd.win, exits: pd.exits,
    p: r2(pOne(pd.raw.mt), 4), repN: pr.n, repNetR: pr.netR, repMonthT: pr.monthT, net2R: pd.net2R, monthT2: pd.monthT2,
    placeboP5: r2(quantile(pm, 0.05)), placeboP50: r2(quantile(pm, 0.5)), placeboP95: r2(p95), placeboBeaten: pm.filter((x) => pd.raw.mean > x).length, ...judge(pd.raw, pr.raw, p95) };
  for (const bk of BANKS) for (const w of Object.keys(S.W)) { delete out.detail[bk].windows[w].raw; if (w === 'dec') delete out.detail[bk].windows[w].placebo.p95raw; }
  out.verdict = out.pooled.pass ? 'PASS' : 'FAIL';
  return out;
}

const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
export function headline(r) {
  const q = r.pooled;
  return `**Verdict: ${r.verdict}.** Pooled over the five banks, 2018 → now: n ${q.n}, ${f(q.netR)}R a trade net, month t ${f(q.monthT, 2)}; 2010-17 ${f(q.repNetR)}R (n ${q.repN}); placebo p95 ${f(q.placeboP95)}R; at 2x cost ${f(q.net2R)}R.`;
}
export function report(r) {
  const L = [], q = r.pooled;
  L.push('# Five other central banks: follow the first hour after the decision: result', '');
  L.push(headline(r), '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed with \`dates.json\` and \`frozen.mjs\` before any trade was computed). ${r.scope} Rule (frozen, byte for byte the ecb-boj-days trade function): ${r.rule}. Costs: ${r.costs}. Data: OANDA mid M5 through the candle proxy.`, '');
  L.push('## The tests (the pooled row decides; 2018 → now)', '', '| bank | window | n | net R a trade | month t | Holm p (5 banks) | 2010-17 net R (n) | placebo p5 / p50 / p95 | at 2x cost: net R (month t) | all bars met |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const x of r.banks) {
    const w = r.detail[x.bank].windows.dec.window;
    L.push(`| ${NAME[x.bank]} | ${w[0]} → ${w[1]} | ${x.n} | ${f(x.netR)} | ${f(x.monthT, 2)} | ${x.holmP} | ${f(x.repNetR)} (${x.repN}) | ${f(x.placeboP5)} / ${f(x.placeboP50)} / ${f(x.placeboP95)} | ${f(x.net2R)} (${f(x.monthT2, 2)}) | ${x.pass ? 'yes' : 'no'} |`);
  }
  L.push(`| **Pooled (decides)** | 2018 → now | ${q.n} | ${f(q.netR)} | ${f(q.monthT, 2)} | n/a (one-sided p ${q.p}) | ${f(q.repNetR)} (${q.repN}) | ${f(q.placeboP5)} / ${f(q.placeboP50)} / ${f(q.placeboP95)} | ${f(q.net2R)} (${f(q.monthT2, 2)}) | ${q.pass ? 'yes' : 'no'} |`);
  const bars = ['nOk', 'positive', 't2', 'sameSign', 'beatsPlacebo', 'cost2'].map((k) => `${k} ${q[k] ? 'yes' : 'no'}`).join(', ');
  L.push('', `Pooled bars: ${bars} (n ≥ 40; mean net R > 0; month-sum t ≥ 2 with every month of the window counted, 0 without a trade; positive in 2010-17; above the 95th percentile of 40 placebo seeds, ${q.placeboBeaten} of 40 beaten; positive at 2x cost). The per-bank rows are reported only (their "all bars met" adds Holm p < 0.05 over the five); they cannot decide the verdict.`, '');
  L.push('## Detail per window', '', '| bank | window | events | trades | net R | month t | trade t | gross R | cost R | win | exits | skipped |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const bk of BANKS) for (const w of ['rep', 'dec']) {
    const x = r.detail[bk].windows[w];
    L.push(`| ${NAME[bk]} | ${r.windows[w]} | ${x.events} | ${x.n} | ${f(x.netR)} | ${f(x.monthT, 2)} | ${f(x.tradeT, 2)} | ${f(x.grossR)} | ${f(x.costR)} | ${(x.win * 100).toFixed(0)} % | ${Object.entries(x.exits).map(([k, v]) => `${k} ${v}`).join(', ')} | ${Object.entries(x.skipped).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'} |`);
  }
  L.push(`| Pooled | 2018 → now | | ${q.n} | ${f(q.netR)} | ${f(q.monthT, 2)} | ${f(q.tradeT, 2)} | ${f(q.grossR)} | ${f(q.costR)} | ${(q.win * 100).toFixed(0)} % | ${Object.entries(q.exits).map(([k, v]) => `${k} ${v}`).join(', ')} | |`);
  L.push('', '## By year (net R a trade, n)', '');
  for (const bk of BANKS) for (const w of ['rep', 'dec']) L.push(`- ${NAME[bk]}, ${r.windows[w]}: ` + Object.entries(r.detail[bk].windows[w].byYear).map(([y, x]) => `${y} ${f(x.netR, 2)} (${x.n})`).join(' · '));
  L.push('', '## The clock check (direction-free) and unconfirmed decision candles', '');
  for (const bk of BANKS) for (const w of ['rep', 'dec']) {
    const c = r.detail[bk].windows[w].clock, picks = Object.entries(c.picks).map(([y, x]) => `${y} ${Object.entries(x).map(([m, n]) => `${m} ${n}`).join(' / ')}`).join(' · ');
    L.push(`- ${NAME[bk]}, ${r.windows[w]}: ${picks ? `minute picked: ${picks}. ` : ''}Confirmed (chosen candle over 2x its minute's 20-day median): ${c.confirmed} of ${r.detail[bk].windows[w].n}; not confirmed: ${c.unconfirmed.join(', ') || 'none'}.`);
  }
  L.push('', '## What this means', '');
  if (r.verdict === 'PASS') L.push('The pooled test meets every pre-registered bar. A hypothesis for a forward paper shadow only; never call it an edge before a forward record. Nothing live changed.');
  else L.push('The pooled test does not meet the pre-registered bar, so following the first hour after these five central banks\' decisions is not an edge on the council\'s feed after costs. With ecb-boj-days (ECB near miss, BoJ flat) this closes the rule: the ECB figure did not repeat on independent decisions. No proposal is written and nothing live changed. This was a stand-alone event rule, not a test of the gold book (item 44). Any other version (another first window, exit time, stop, pair or filter) would need its own pre-registration on data not used here.');
  if (r.verdict !== 'PASS') {
    const miss = ['nOk', 'positive', 't2', 'sameSign', 'beatsPlacebo', 'cost2'].filter((k) => !q[k]).join(', ');
    const pos = r.banks.filter((x) => x.netR > 0 && x.monthT >= 1).map((x) => `${NAME[x.bank]} ${f(x.netR)}R (t ${f(x.monthT, 2)}, 2010-17 ${x.repN ? `${f(x.repNetR)}R` : "no trade"})`).join('; ');
    L.push('', `Post hoc reading (not part of the verdict): the pooled bars missed are ${miss}. ${pos ? `Most of the 2018 → now mean comes from ${pos}; ` : ''}the same rule earned ${f(q.repNetR)}R a trade over the five banks in 2010-17, so the recent figure did not hold on the earlier years. A per-bank result picked after seeing these rows is not evidence; a follow-up on one bank would need its own pre-registration on data not used here.`);
  }
  const rz = r.detail.RBNZ.windows;
  L.push('', `RBNZ before 2019: the pre-registered clock check picked 09:00 Wellington on ${Object.values(rz.rep.clock.picks).reduce((a, x) => a + (x['09:00'] || 0), 0)} of ${rz.rep.events} dates in 2010-17 and ${(rz.dec.clock.picks['2018'] || {})['09:00'] || 0} in 2018, so those dates give no trade by the rule (the announcement fell on the UTC evening before) and the RBNZ has no 2010-17 trade. That is consistent with the bank publishing at 09:00 until 2018 and at 14:00 from 2019.`);
  L.push('', 'Caveat: every date is written from memory of the banks\' calendars (the sandbox cannot reach their sites); `dates.json` lists the uncertain ones and where to check them. A wrong date gives a trade on an ordinary day and pulls the result toward the placebo. The "not confirmed" dates above are where the date, the minute or the feed may be off.');
  L.push('', 'To repeat: `node --use-env-proxy research/edge/cb-days-other/fetch.mjs <dir>`, then `node research/edge/cb-days-other/run.mjs <dir>`. Tests: `tests/cb-days-other.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candle dir>');
  const r = run(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(r));
  for (const x of r.banks) console.log(x.bank, x.n, x.netR, x.monthT, x.holmP, x.repNetR, x.placeboP95, x.net2R, x.pass);
  const q = r.pooled; console.log('pooled', q.n, q.netR, q.monthT, q.repNetR, q.placeboP95, q.net2R, q.pass);
  console.log('verdict', r.verdict);
}

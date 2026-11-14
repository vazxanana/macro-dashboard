// Edge research · overnight-unused-markets: index-overnight's frozen close-to-open long (frozen.mjs, byte for byte, never
// edited) on the fourteen OANDA index CFDs no overnight study used, each at its own exchange's cash close and open
// (PREREGISTRATION.md, committed first). A replication of the gross overnight effect and a cost check, nothing more.
//   node --use-env-proxy run.mjs fetch <dir>   OANDA M30 candles through /md/bars (<sym>-30m.json.gz, rows [t,o,h,l,c])
//   node run.mjs gate <dir>                    the wrapper against the frozen runMarket on US500 / NAS100 (<dir> holds them)
//   node run.mjs full <dir>                    runs the study, writes result.json and RESULT.md next to this file
// Paper research only. Every trade has a stop on its losing side (the frozen simulate refuses one that does not).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, M30 = 1800;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const END = '2026-10-31';
export const WIN = { decisive: ['2016-01-01', END], replication: ['2005-01-01', '2015-12-31'] };
export const MIN_REP = 100;

// ---------- the fourteen markets and their sessions (PREREGISTRATION.md table) ----------
export const MARKETS = {
  us2000: { name: 'US2000', zone: 'America/New_York', nyse: true },
  de40: { name: 'DE40', zone: 'Europe/Berlin', open: [9, 0], close: [17, 30] },
  uk100: { name: 'UK100', zone: 'Europe/London', open: [8, 0], close: [16, 30] },
  eu50: { name: 'EU50', zone: 'Europe/Berlin', open: [9, 0], close: [17, 30] },
  fr40: { name: 'FR40', zone: 'Europe/Paris', open: [9, 0], close: [17, 30] },
  ch20: { name: 'CH20', zone: 'Europe/Zurich', open: [9, 0], close: [17, 30] },
  nl25: { name: 'NL25', zone: 'Europe/Amsterdam', open: [9, 0], close: [17, 30] },
  es35: { name: 'ES35', zone: 'Europe/Madrid', open: [9, 0], close: [17, 30] },
  jp225: { name: 'JP225', zone: 'Asia/Tokyo', open: [9, 0], close: (d) => (d >= '2024-11-05' ? [15, 30] : [15, 0]) },
  au200: { name: 'AU200', zone: 'Australia/Sydney', open: [10, 0], close: [16, 0] },
  hk33: { name: 'HK33', zone: 'Asia/Hong_Kong', open: (d) => (d < '2011-03-07' ? [10, 0] : [9, 30]), close: [16, 0] },
  cn50: { name: 'CN50', zone: 'Asia/Shanghai', open: [9, 30], close: [15, 0] },
  sg30: { name: 'SG30', zone: 'Asia/Singapore', open: [9, 0], close: [17, 0] },
  in50: { name: 'IN50', zone: 'Asia/Kolkata', open: [9, 30], close: [15, 30] }, // cash open 09:15; exit at the 09:30 boundary
};
const hm = (x, d) => (typeof x === 'function' ? x(d) : x);

// ---------- exchange local time through the platform's IANA zones ----------
const FMT = new Map();
function fmt(zone) {
  if (!FMT.has(zone)) FMT.set(zone, new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  return FMT.get(zone);
}
export function tzOffset(zone, t) { // seconds local - UTC at UTC second t
  const p = Object.fromEntries(fmt(zone).formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) / 1000 - t;
}
export function localAt(zone, date, hh, mm = 0) { // UTC seconds of local hh:mm on the local date
  const g = Date.parse(date + 'T00:00:00Z') / 1000 + hh * 3600 + mm * 60;
  let t = g - tzOffset(zone, g); t = g - tzOffset(zone, t); return t;
}
export const localDate = (zone, t) => ymd(t + tzOffset(zone, t));

// ---------- the wrapper: index-overnight's overnight() with the market's own close and open ----------
export function overnightAt(S, days, date, close, open) {
  const iE = S.at.get(close - M30), iX = S.at.get(open);
  if (iE == null || iX == null) return { drop: true };
  const entry = S.bars[iE][4], a = F.atrAt(days, close); if (a == null) return { drop: 'atr' };
  const stop = entry - F.P.STOP_ATR * a;
  const tr = F.simulate(S.bars, { entry, stop, t0: close, from: iE + 1, to: iX - 1, exitPx: S.bars[iX][1], exitT: open });
  if (tr.how === 'time') tr.how = S.bars[iX][1] <= stop ? 'gap-open' : 'open';
  return { ...tr, date, hold: open - close, weekend: F.nightsHeld(close, open) >= 3 };
}

// cash days with their close and open in UTC seconds, in order
export function sessions(key, S, from = '2005-01-01', to = END) {
  const m = MARKETS[key], out = [];
  if (m.nyse) {
    for (const d of F.cashDays(from, to)) { const [ch, cm] = F.closeHour(d); out.push({ date: d, close: F.nyAt(d, ch, cm), open: F.nyAt(d, 9, 30) }); }
    return out;
  }
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; ymd(t) <= to; t += DAY) {
    const d = ymd(t), w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const [ch, cm] = hm(m.close, d), [oh, om] = hm(m.open, d), close = localAt(m.zone, d, ch, cm), open = localAt(m.zone, d, oh, om);
    if (S.at.has(close - M30) && S.at.has(open)) out.push({ date: d, close, open });
  }
  return out;
}

export function trades(key, S, dgs2) {
  const days = F.dailyBars(S.bars), ses = sessions(key, S), out = [], drop = { data: 0, atr: 0, gap: 0 };
  for (let i = 0; i + 1 < ses.length; i++) {
    const a = ses[i], b = ses[i + 1];
    if (!MARKETS[key].nyse && (Date.parse(b.date) - Date.parse(a.date)) / 1000 > 5 * DAY) { drop.gap++; continue; }
    const r = overnightAt({ bars: S.bars, at: S.at }, days, a.date, a.close, b.open);
    if (r.drop) { drop[r.drop === 'atr' ? 'atr' : 'data']++; continue; }
    const c = F.costTrade(r, dgs2), c2 = F.costTrade(r, dgs2, 2); c.net2 = c2.net; out.push(c);
  }
  return { trades: out, drop, days };
}

// ---------- statistics ----------
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const inWin = (w, first) => (t) => t.date >= WIN[w][0] && t.date <= WIN[w][1];
const pct = (xs, q) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
export function pooled(lists) { // lists: arrays of trades; monthly sums added month by month
  const all = lists.flat(), g = new Map(), n = new Map(), n2 = new Map();
  for (const t of all) { const mo = F.monthOf(t); g.set(mo, (g.get(mo) || 0) + t.R); n.set(mo, (n.get(mo) || 0) + t.net); n2.set(mo, (n2.get(mo) || 0) + t.net2); }
  const N = all.length, sum = (k) => all.reduce((a, t) => a + t[k], 0);
  return {
    n: N, months: g.size, grossR: r3(sum('R') / N), netR: r3(sum('net') / N), net2R: r3(sum('net2') / N), spreadR: r3(sum('spreadR') / N), finR: r3(sum('finR') / N),
    tGross: r2(F.tStat([...g.values()])), t: r2(F.tStat([...n.values()])), t2: r2(F.tStat([...n2.values()])), totalGross: r2(sum('R')), total: r2(sum('net')),
  };
}
function placeboRun(S, days, dgs2, n, w, seed, hold) {
  const rnd = F.mulberry32(seed + 1), out = [];
  const wd = []; for (let t = Date.parse(WIN[w][0] + 'T00:00:00Z') / 1000; ymd(t) <= WIN[w][1]; t += DAY) { const k = new Date(t * 1000).getUTCDay(); if (k && k < 6 && t >= S.bars[0][0]) wd.push(t); }
  let guard = 0;
  while (out.length < n && guard++ < n * 50) {
    const s = wd[Math.floor(rnd() * wd.length)] + Math.floor(rnd() * 48) * M30;
    const r = F.windowTrade(S, days, s, hold); if (!r) continue;
    const c = F.costTrade(r, dgs2); c.net2 = c.net; out.push(c);
  }
  return out;
}
export function medianHold(trs) {
  const h = trs.filter((t) => t.nights === 1).map((t) => t.hold).sort((a, b) => a - b);
  return h.length ? Math.round(h[h.length >> 1] / M30) * M30 : null;
}

// ---------- gate: the wrapper against the frozen runMarket on US500 / NAS100 ----------
export function gate(dir, dgs2) {
  const out = {};
  for (const sym of ['spx500', 'nas100']) {
    const S = load(dir, sym), fr = F.runMarket(S, dgs2, 'overnight'), days = F.dailyBars(S.bars), mine = [];
    const all = F.cashDays('2005-01-01', END);
    for (let i = 0; i + 1 < all.length; i++) {
      const d = all[i], [ch, cm] = F.closeHour(d), r = overnightAt(S, days, d, F.nyAt(d, ch, cm), F.nyAt(all[i + 1], 9, 30));
      if (!r.drop) mine.push(r);
    }
    let same = fr.trades.length === mine.length;
    for (let i = 0; same && i < mine.length; i++) { const a = fr.trades[i], b = mine[i]; same = a.date === b.date && a.entry === b.entry && a.stop === b.stop && a.exit === b.exit && a.R === b.R && a.how === b.how && a.t1 === b.t1; }
    out[sym] = { frozen: fr.trades.length, wrapper: mine.length, identical: same };
  }
  return out;
}

function load(dir, sym) { return F.makeSeries(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-30m.json.gz`))))); }

// ---------- the study ----------
function full(dir) {
  const dgs2 = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'))).DGS2;
  const res = { study: 'overnight-unused-markets', title: 'Overnight drift on index CFDs no earlier study used', built: '2026-11-14', windows: WIN, frozenParams: F.P, markets: {}, missing: {} };
  const R = {}, S = {};
  for (const key of Object.keys(MARKETS)) {
    const file = path.join(dir, `${key}-30m.json.gz`);
    if (!fs.existsSync(file)) { res.missing[key] = fs.existsSync(path.join(dir, `${key}-error.txt`)) ? fs.readFileSync(path.join(dir, `${key}-error.txt`), 'utf8').trim() : 'no file'; continue; }
    const s = load(dir, key); if (!s.bars.length) { res.missing[key] = 'no candles'; continue; }
    S[key] = s; R[key] = trades(key, s, dgs2);
  }
  const qual = Object.keys(R).filter((k) => R[k].trades.filter(inWin('decisive')).length >= F.P.MIN_N);
  for (const k of Object.keys(R)) {
    const m = { name: MARKETS[k].name, zone: MARKETS[k].zone, candles: S[k].bars.length, first: ymd(S[k].bars[0][0]), last: ymd(S[k].bars.at(-1)[0]), dropped: R[k].drop, qualifies: qual.includes(k) };
    for (const w of Object.keys(WIN)) {
      const tr = R[k].trades.filter(inWin(w));
      if (w === 'replication' && tr.length < MIN_REP) { m[w] = { n: tr.length, note: `under ${MIN_REP} trades: no figures` }; continue; }
      m[w] = F.summary(tr);
      m[w].from = tr.length ? tr[0].date : null;
      m[w].hold = medianHold(tr);
      const by = {}; for (const t of tr) (by[t.date.slice(0, 4)] ||= []).push(t);
      m[w].byYear = Object.fromEntries(Object.entries(by).map(([y, x]) => [y, { n: x.length, grossR: r3(x.reduce((a, t) => a + t.R, 0) / x.length), netR: r3(x.reduce((a, t) => a + t.net, 0) / x.length) }]));
    }
    res.markets[k] = m;
  }
  res.qualifying = qual;
  if (qual.length < 3) {
    res.verdictClass = 'NOT MEASURABLE';
    res.verdict = `NOT MEASURABLE (inconclusive: ${qual.length} of 14 markets have 300 decisive trades)`;
    return res;
  }
  // per-market Holm (decisive), gross and net separately
  const pg = qual.map((k) => F.pOne(res.markets[k].decisive.tGross)), pn = qual.map((k) => F.pOne(res.markets[k].decisive.t));
  const hg = F.holm(pg), hn = F.holm(pn);
  qual.forEach((k, i) => Object.assign(res.markets[k].decisive, { pGross: r3(pg[i]), pGrossHolm: r3(hg[i]), pNet: r3(pn[i]), pNetHolm: r3(hn[i]) }));
  // pooled
  const repQ = qual.filter((k) => res.markets[k].replication.n >= MIN_REP && !res.markets[k].replication.note);
  res.pooled = {
    decisive: pooled(qual.map((k) => R[k].trades.filter(inWin('decisive')))),
    replication: { ...pooled(repQ.map((k) => R[k].trades.filter(inWin('replication')))), markets: repQ },
    nonUS: { decisive: pooled(qual.filter((k) => k !== 'us2000').map((k) => R[k].trades.filter(inWin('decisive')))), replication: pooled(repQ.filter((k) => k !== 'us2000').map((k) => R[k].trades.filter(inWin('replication')))) },
  };
  const d = res.pooled.decisive, r = res.pooled.replication;
  const p = [F.pOne(d.tGross), F.pOne(d.t)], ph = F.holm(p);
  res.primary = {
    H1: { what: 'pooled gross R a trade > 0, month t >= 2 (2016-26), > 0 in replication, Holm p < 0.05', mean: d.grossR, t: d.tGross, rep: r.grossR, p: r3(p[0]), pHolm: r3(ph[0]) },
    H2: { what: 'pooled net R a trade (frozen base cost) > 0, month t >= 2 (2016-26), Holm p < 0.05', mean: d.netR, t: d.t, rep: r.netR, p: r3(p[1]), pHolm: r3(ph[1]) },
  };
  res.primary.H1.holds = d.grossR > 0 && d.tGross >= 2 && r.grossR > 0 && ph[0] < 0.05;
  res.primary.H2.holds = d.netR > 0 && d.t >= 2 && ph[1] < 0.05;
  // placebo
  const pl = { decisive: [], replication: [] }, per = {};
  for (const w of Object.keys(WIN)) {
    const ks = w === 'decisive' ? qual : repQ;
    for (let s = 0; s < F.P.SEEDS; s++) {
      const lists = [];
      for (const k of ks) {
        const n = res.markets[k][w].n, hold = res.markets[k][w].hold, x = placeboRun(S[k], R[k].days, dgs2, n, w, s, hold);
        lists.push(x); ((per[k] ||= {})[w] ||= []).push(x.reduce((a, t) => a + t.R, 0) / x.length);
      }
      const q = pooled(lists); pl[w].push(q);
    }
  }
  res.placebo = { seeds: F.P.SEEDS, hold: 'each market: median weekday overnight hold of its real trades in the window' };
  for (const w of Object.keys(WIN)) {
    const g = pl[w].map((x) => x.grossR), n = pl[w].map((x) => x.netR), tg = pl[w].map((x) => x.tGross);
    const real = res.pooled[w];
    res.placebo[w] = { grossR: { p5: r3(pct(g, 0.05)), p50: r3(pct(g, 0.5)), p95: r3(pct(g, 0.95)) }, netR: { p5: r3(pct(n, 0.05)), p50: r3(pct(n, 0.5)), p95: r3(pct(n, 0.95)) }, tGross: { p5: r2(pct(tg, 0.05)), p50: r2(pct(tg, 0.5)), p95: r2(pct(tg, 0.95)) }, rankGross: g.filter((x) => x < real.grossR).length, rankNet: n.filter((x) => x < real.netR).length };
  }
  for (const k of Object.keys(per)) for (const w of Object.keys(per[k])) { const xs = per[k][w]; res.markets[k][w].placebo = { grossR: { p5: r3(pct(xs, 0.05)), p50: r3(pct(xs, 0.5)), p95: r3(pct(xs, 0.95)) }, rankGross: xs.filter((x) => x < res.markets[k][w].grossR).length }; }
  const gw = res.primary.H1.holds ? 'REPLICATES' : 'DOES NOT REPLICATE', nw = res.primary.H2.holds ? 'PASS' : 'FAIL';
  res.verdictClass = `${gw} / ${nw}`;
  res.verdict = `${gw} (gross) / ${nw} (net): ${qual.length} unused index CFDs pooled, 2016-26: ${f(d.grossR)}R a trade before costs (n ${d.n}, month-sum t ${f(d.tGross, 2)}; 2005-15 ${f(r.grossR)}R, t ${f(r.tGross, 2)}), ${f(d.netR)}R after the frozen cost model (t ${f(d.t, 2)})`;
  return res;
}

// ---------- RESULT.md from result.json ----------
const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
export function report(res) {
  const L = [];
  L.push(`# ${res.title}: result`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed and pushed alone before any return was read). Built ${res.built}. Paper research only: nothing live changed. The rule is index-overnight's, copied byte for byte (\`frozen.mjs\`); only the session times are each exchange's own.`, '');
  L.push(`## Verdict: ${res.verdict}.`, '');
  if (res.gate) {
    L.push('## Gate', '', `- index-overnight's \`run.mjs\` (as \`frozen.mjs\`) re-run on a fresh fetch: T1 / T2 rows equal the committed result.json: **${res.gate.rows ? 'yes' : 'NO'}** (${res.gate.rowsNote}).`);
    L.push(`- The wrapper given New York sessions against the frozen \`runMarket\`: US500 ${res.gate.wrapper.spx500.wrapper} of ${res.gate.wrapper.spx500.frozen} trades, identical ${res.gate.wrapper.spx500.identical ? 'yes' : 'NO'}; NAS100 ${res.gate.wrapper.nas100.wrapper} of ${res.gate.wrapper.nas100.frozen}, identical ${res.gate.wrapper.nas100.identical ? 'yes' : 'NO'}.`, '');
  }
  if (!res.pooled) { L.push('## Markets', '', '```', JSON.stringify({ missing: res.missing, qualifying: res.qualifying }, null, 1), '```', ''); return L.join('\n'); }
  const d = res.pooled.decisive, r = res.pooled.replication, yn = (b) => (b ? 'yes' : 'no');
  L.push('## Primary tests (Holm over the two)', '', '| Test | 2016-26 mean R a trade | n | months | month t | replication mean (markets) | p | Holm p | Holds |', '|---|---:|---:|---:|---:|---|---:|---:|---|');
  L.push(`| H1 gross | ${f(d.grossR)} | ${d.n} | ${d.months} | ${f(d.tGross, 2)} | ${f(r.grossR)} (t ${f(r.tGross, 2)}, n ${r.n}, ${r.markets.length} markets) | ${res.primary.H1.p} | ${res.primary.H1.pHolm} | ${yn(res.primary.H1.holds)} |`);
  L.push(`| H2 net (frozen base cost) | ${f(d.netR)} | ${d.n} | ${d.months} | ${f(d.t, 2)} | ${f(r.netR)} (t ${f(r.t, 2)}) | ${res.primary.H2.p} | ${res.primary.H2.pHolm} | ${yn(res.primary.H2.holds)} |`, '');
  L.push(`Pooled costs, 2016-26: spread ${f(-d.spreadR)}R, financing ${f(-d.finR)}R a trade; at twice the spread ${f(d.net2R)}R (t ${f(d.t2, 2)}). Total ${f(d.totalGross, 1)}R gross, ${f(d.total, 1)}R net. ` +
    `Without US2000 (non-US only): 2016-26 ${f(res.pooled.nonUS.decisive.grossR)}R gross (t ${f(res.pooled.nonUS.decisive.tGross, 2)}), ${f(res.pooled.nonUS.decisive.netR)}R net (t ${f(res.pooled.nonUS.decisive.t, 2)}); replication ${f(res.pooled.nonUS.replication.grossR)}R gross (t ${f(res.pooled.nonUS.replication.tGross, 2)}).`, '');
  L.push('## Per market, 2016-26 (Holm over the qualifying markets, gross and net apart)', '', '| Market | n | win % | Gross R | t gross | Holm p gross | Spread R | Financing R | Net R | t net | Holm p net | Net at 2x spread | Total net R | Max DD R | Stops | Median stop % | Placebo gross p5 / p50 / p95 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const k of res.qualifying) { const s = res.markets[k].decisive, pl = s.placebo; L.push(`| ${res.markets[k].name} | ${s.n} | ${(s.win * 100).toFixed(1)} | ${f(s.grossR)} | ${f(s.tGross, 2)} | ${s.pGrossHolm} | ${f(-s.spreadR)} | ${f(-s.finR)} | ${f(s.netR)} | ${f(s.t, 2)} | ${s.pNetHolm} | ${f(s.net2R)} | ${f(s.total, 1)} | ${s.maxDD.toFixed(1)} | ${s.stops} | ${s.medStopPct} | ${pl ? `${f(pl.grossR.p5)} / ${f(pl.grossR.p50)} / ${f(pl.grossR.p95)}` : '—'} |`); }
  L.push('', '## Per market, replication (data start to 2015)', '', '| Market | from | n | Gross R | t gross | Net R | t net | Net at 2x spread | Max DD R |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of res.qualifying) { const s = res.markets[k].replication; L.push(s.note ? `| ${res.markets[k].name} | — | ${s.n} | ${s.note} | | | | | |` : `| ${res.markets[k].name} | ${s.from} | ${s.n} | ${f(s.grossR)} | ${f(s.tGross, 2)} | ${f(s.netR)} | ${f(s.t, 2)} | ${f(s.net2R)} | ${s.maxDD.toFixed(1)} |`); }
  L.push('', '## Placebo (40 seeds, random start, each market held for its median weekday overnight hold)', '');
  for (const w of ['decisive', 'replication']) { const p = res.placebo[w], q = res.pooled[w]; L.push(`- ${w === 'decisive' ? '2016-26' : 'Replication'}: real pooled gross ${f(q.grossR)}R against placebo ${f(p.grossR.p5)} / ${f(p.grossR.p50)} / ${f(p.grossR.p95)} (rank ${p.rankGross} of 40); net ${f(q.netR)}R against ${f(p.netR.p5)} / ${f(p.netR.p50)} / ${f(p.netR.p95)} (rank ${p.rankNet} of 40); placebo month t gross ${f(p.tGross.p5, 2)} / ${f(p.tGross.p50, 2)} / ${f(p.tGross.p95, 2)}.`); }
  L.push('', '## By year (gross R a trade, 2016-26 and replication)', '');
  const years = [...new Set(res.qualifying.flatMap((k) => ['replication', 'decisive'].flatMap((w) => Object.keys(res.markets[k][w].byYear || {}))))].sort();
  L.push(`| Year | ${res.qualifying.map((k) => res.markets[k].name).join(' | ')} |`, `|---|${res.qualifying.map(() => '---:').join('|')}|`);
  for (const y of years) L.push(`| ${y} | ${res.qualifying.map((k) => { const w = y >= '2016' ? 'decisive' : 'replication', b = (res.markets[k][w].byYear || {})[y]; return b ? f(b.grossR) : '—'; }).join(' | ')} |`);
  L.push('', '## Data and departures', '');
  L.push(`- Candles: OANDA mid M30 through /md/bars. ${Object.keys(res.markets).map((k) => `${res.markets[k].name} ${res.markets[k].first} to ${res.markets[k].last} (${res.markets[k].candles}; dropped ${JSON.stringify(res.markets[k].dropped)})`).join('; ')}.`);
  if (Object.keys(res.missing).length) L.push(`- Not available: ${Object.entries(res.missing).map(([k, v]) => `${k} (${v})`).join('; ')}.`);
  L.push(`- Not qualifying (under ${F.P.MIN_N} decisive trades): ${Object.keys(res.markets).filter((k) => !res.markets[k].qualifies).map((k) => `${res.markets[k].name} (n ${res.markets[k].decisive.n})`).join(', ') || 'none'}.`);
  for (const x of res.departures || []) L.push(`- ${x}`);
  L.push('', '## Reading', '', res.reading || '', '');
  L.push('To repeat: `node --use-env-proxy research/edge/overnight-unused-markets/run.mjs fetch <dir>`, then `node research/edge/overnight-unused-markets/run.mjs full <dir>` (candles kept out of git; the gate also needs index-overnight\'s `spx500-30m.json.gz` and `nas100-30m.json.gz` in `<dir>`).', '');
  return L.join('\n');
}

// ---------- fetch (index-overnight's loop, for the fourteen keys) ----------
async function fetchAll(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const FROM = Date.parse('2005-01-01T00:00:00Z') / 1000, STOP = Date.parse('2026-11-01T00:00:00Z') / 1000;
  fs.mkdirSync(dir, { recursive: true });
  for (const sym of Object.keys(MARKETS)) {
    const file = path.join(dir, `${sym}-30m.json.gz`); if (fs.existsSync(file)) { console.log(`${sym}: exists`); continue; }
    const m = new Map();
    try {
      for (let a = FROM; a < STOP;) {
        const b = Math.min(STOP, a + 4999 * M30); let j = null, err = null;
        for (let k = 0; k < 6 && !j; k++) {
          try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=30m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
            if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
          catch (e) { err = String(e.message || e); }
          if (!j) await sleep(2000 * (k + 1));
        }
        if (!j) throw new Error(`${sym} ${ymd(a)}: ${err}`);
        for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
        a = b; await sleep(150);
      }
    } catch (e) { fs.writeFileSync(path.join(dir, `${sym}-error.txt`), String(e.message || e)); console.log(`${sym}: ${e.message}`); continue; }
    const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
    if (!rows.length) { fs.writeFileSync(path.join(dir, `${sym}-error.txt`), 'the proxy returned no candle 2005-2026'); console.log(`${sym}: no candles`); continue; }
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(rows)));
    console.log(`${sym}: ${rows.length} candles ${ymd(rows[0][0])} → ${ymd(rows.at(-1)[0])}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch' && dir) await fetchAll(dir);
  else if (cmd === 'gate' && dir) console.log(JSON.stringify(gate(dir, JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'))).DGS2)));
  else if (cmd === 'full' && dir) {
    const res = full(dir);
    const extra = path.join(HERE, 'notes.json'); // gate, departures and reading, written by hand after the run
    if (fs.existsSync(extra)) Object.assign(res, JSON.parse(fs.readFileSync(extra, 'utf8')));
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(res.verdict);
  } else throw new Error('usage: node run.mjs fetch|gate|full <dir>');
}

// Robustness audit, part 2: systems that could not be re-implemented line for line (gold replica: 600 lines of trader.mjs) are
// audited from their own replay records; the ICT model is re-run with the tracker's own signals()/simulate() on 8 years of
// HistData (NQ cash, spot gold); the engine Scalp rule from the council's own backtest files; coach-stats small-sample claims;
// the multiple-testing count. Usage: ROB_DATA=<dir> node claims.mjs [part ...] → out/<part>.json
import fs from 'node:fs';
import path from 'node:path';
import { loadM1, aggregate, simTrade, stats, rng, yearOf, nyParts, DATA, deflatedSharpe, Phi } from './lib.mjs';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'out'); fs.mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2)); const run = (k) => !want.size || want.has(k);
const save = (k, o) => { fs.writeFileSync(path.join(OUT, k + '.json'), JSON.stringify(o, null, 1)); console.log('wrote', k); };
const idxAt = (A, t) => { let lo = 0, hi = A.n; while (lo < hi) { const m = (lo + hi) >> 1; if (A.t[m] < t) lo = m + 1; else hi = m; } return lo; };
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f)));
function summarize(trades) {
  const sp = (f) => stats(trades.filter(f).map((x) => x.R)); const yrs = {}; for (const x of trades) (yrs[yearOf(x.t)] = yrs[yearOf(x.t)] || []).push(x.R);
  return { all: sp(() => true), is: sp((x) => yearOf(x.t) <= 2023), oos: sp((x) => yearOf(x.t) >= 2024), w1922: sp((x) => yearOf(x.t) >= 2019 && yearOf(x.t) <= 2022),
    w2324: sp((x) => yearOf(x.t) >= 2023 && yearOf(x.t) <= 2024), w2526: sp((x) => yearOf(x.t) >= 2025), years: Object.fromEntries(Object.entries(yrs).map(([y, a]) => [y, stats(a)])) };
}
function bench(make, S) { const E = []; for (let s = 1; s <= S; s++) { const st = stats(make(s).map((x) => x.R)); E.push(st.exp ?? 0); } E.sort((a, b) => a - b); const q = (f) => E[Math.min(E.length - 1, Math.floor(f * E.length))];
  return { seeds: S, expMean: +(E.reduce((a, b) => a + b, 0) / S).toFixed(3), exp5: +q(0.05).toFixed(3), exp95: +q(0.95).toFixed(3) }; }
const brief = (s) => `n${s.all.n} exp${s.all.exp} R${s.all.R} t${s.all.t} | IS ${s.is.exp} n${s.is.n} | OOS ${s.oos.exp} n${s.oos.n} t${s.oos.t} | 19-22 ${s.w1922.exp} n${s.w1922.n} 23-24 ${s.w2324.exp} n${s.w2324.n} 25-26 ${s.w2526.exp} n${s.w2526.n}`;

// ════════ Gold replica (live since 3 Nov; replay records research/replay-2w.json, 2023 – Oct 2026, the council's own replay)
if (run('replica')) {
  const T = rd('research/replay-2w.json').trades.filter((x) => x.k === 'replica' && x.R != null);
  const r = { source: 'research/replay-2w.json (council replay, live rules incl. gate, size tilt, add, run)', recorded: summarize(T.map((x) => ({ t: x.filled || x.opened, R: x.R }))) };
  console.log('replica recorded', brief(r.recorded));
  // concentration: share of R from the best 10% of trades
  const Rs = T.map((x) => x.R).sort((a, b) => b - a), top = Rs.slice(0, Math.ceil(Rs.length / 10)).reduce((a, b) => a + b, 0); r.top10pctShare = +(top / Rs.reduce((a, b) => a + b, 0)).toFixed(2);
  r.withoutTop10 = stats(Rs.slice(Math.ceil(Rs.length / 10)));
  // same entries under one plain exit (4R target, breakeven at +2R, 48 h, unit size, 0.30 cost) on HistData: actual side vs flipped vs
  // random time (±10 days of the real entry, same clock time, same side, same stop distance) — the regime is held fixed by the window
  const A = loadM1('xau-histdata', [2023, 2026]);
  const sim = (x, side, t) => { const i = idxAt(A, t); if (i >= A.n - 10 || Math.abs(A.t[i] - t) > 600) return null; const r0 = Math.abs(x.entry - (x.stop0 ?? x.stop)); if (!(r0 > 0)) return null;
    return { t, R: simTrade(A, { side, i, r0, cost: 0.30, tgt: 4, be: 2, exitAt: t + 48 * 3600 }).R }; };
  const sd = (x) => x.side === 'sell' ? -1 : 1, tt = (x) => x.filled || x.opened;
  const plain = T.map((x) => sim(x, sd(x), tt(x))).filter(Boolean), flip = T.map((x) => sim(x, -sd(x), tt(x))).filter(Boolean);
  r.plainExit = summarize(plain); r.plainFlip = summarize(flip); console.log('replica plain', brief(r.plainExit)); console.log('replica plain flipped', brief(r.plainFlip));
  r.randomSameRegime = bench((s) => { const g = rng(s * 41 + 7); return T.map((x) => sim(x, sd(x), tt(x) + Math.round((g() * 20 - 10)) * 86400)).filter(Boolean); }, 100);
  r.randomSideSameRegime = bench((s) => { const g = rng(s * 43 + 7); return T.map((x) => sim(x, g() < 0.5 ? 1 : -1, tt(x) + Math.round((g() * 20 - 10)) * 86400)).filter(Boolean); }, 100);
  console.log('replica random same side ±10d', JSON.stringify(r.randomSameRegime), 'random side', JSON.stringify(r.randomSideSameRegime));
  r.dsr = deflatedSharpe(T.map((x) => x.R), 1);
  r.claims = { ungated2019_2025: '−312.5R over 4,484 trades, every year negative (history #32)', gated2019_2025: '+18.9R (history #33)', chosenOn: '2023+ only (owner: "judge gold on 2023 onwards")' };
  save('replica', r);
}

// ════════ ICT iFVG model: tracker signals() + replay simulate() on HistData H1, 2018 – Oct 2026 (the desk's replay only covers Aug 2025+)
if (run('ict')) {
  const { MARKETS, MIN_GRADE, signals, isASetup, sizeOf, P } = await import('../../../ict/tracker.mjs');
  const { simulate } = await import('../../../ict/replay.mjs');
  const res = {};
  for (const [key, dir, cost] of [['nq', 'nsxusd-histdata', 1.0], ['gc', 'xau-histdata', 0.30]]) {
    const M = MARKETS[key], A = loadM1(dir), H = aggregate(A, 3600).filter((b) => (nyParts(b.time).h) !== 17).map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
    const D = aggregate(A, 86400, 'ny17').map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
    const src = { H, D, m5: [], m5days: null, cnbcFrom: null };
    const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
    const go = (pick, mod) => { const out = []; let busyAll = 0, busyA = 0;
      for (const g0 of sig) { const a = isASetup(g0, key); if (!pick(g0, a)) continue; if (g0.close < (a ? busyA : busyAll)) continue;
        const g = mod ? mod(g0) : g0; const t = simulate(g, M, key, src, Infinity); if (!t || t.R == null) continue;
        const size = sizeOf(g0, key), net = (t.R - cost / g.r0) * size; out.push({ t: g0.close, R: net, gross: t.R * size, side: g.side, a, hour: g0.feat.etHour, sess: g0.feat.session });
        const end = t.closed || Infinity; busyAll = Math.max(busyAll, end); if (a) busyA = end; }
      return out; };
    const flipG = (g) => ({ ...g, side: -g.side, stop: g.entry + g.side * g.r0 });
    const all = go(() => true), aset = go((g, a) => a), aFlip = go((g, a) => a, flipG), allFlip = go(() => true, flipG);
    const r = { signals: sig.length, all: summarize(all), aset: summarize(aset), asetFlip: summarize(aFlip), allFlip: summarize(allFlip) };
    r.asetGross = stats(aset.map((x) => x.gross));
    // random benchmark: A-setup geometry (r0, side, size) at random H1 closes ±10 days away at the same clock hour
    const byT = new Map(H.map((b, i) => [b.time, i]));
    r.random = bench((s) => { const g = rng(s * 53 + 3), out = []; for (const g0 of sig.filter((x) => isASetup(x, key))) {
      const tt = g0.t + Math.round(g() * 20 - 10) * 86400; const i = byT.get(tt); if (i == null) continue; const b = H[i];
      const e = b.close, side = g0.side; const gg = { ...g0, t: b.time, close: b.time + 3600, entry: e, stop: e - side * g0.r0 };
      const t = simulate(gg, M, key, src, Infinity); if (!t || t.R == null) continue; out.push({ t: gg.close, R: (t.R - cost / g0.r0) * sizeOf(g0, key) }); } return out; }, 40);
    // ±20% on the model's parameters (pivot width, max FVG wait, trail) — re-run signals with P patched
    r.sens = {};
    for (const [k, v] of [['piv', 2], ['piv', 4], ['vmax', 5], ['vmax', 7], ['look', 77], ['look', 115]]) {
      const old = P[k]; P[k] = v; const s2 = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close); P[k] = old;
      const out = []; let busyA = 0; for (const g0 of s2) { if (!isASetup(g0, key) || g0.close < busyA) continue; const t = simulate(g0, M, key, src, Infinity); if (!t || t.R == null) continue; out.push({ t: g0.close, R: (t.R - cost / g0.r0) * sizeOf(g0, key) }); busyA = t.closed || Infinity; }
      r.sens[`${k}=${v}`] = summarize(out); console.log('ict', key, k, v, brief(r.sens[`${k}=${v}`])); }
    r.dsr = deflatedSharpe(aset.map((x) => x.R), 1);
    // the desk's own claims (ict/replay.json): A-setups +0.35R/t over Aug 2025 – Nov 2026
    res[key] = r;
    console.log('ict', key, 'signals', sig.length); console.log('ict', key, 'all', brief(r.all)); console.log('ict', key, 'A', brief(r.aset)); console.log('ict', key, 'A flipped', brief(r.asetFlip)); console.log('ict', key, 'all flipped', brief(r.allFlip));
    console.log('ict', key, 'A gross', JSON.stringify(r.asetGross), 'random', JSON.stringify(r.random));
    res[key].trades = aset;
  }
  // the desk's own replay records
  const J = rd('ict/replay.json'), C = J.trades.filter((x) => x.closed && x.R != null);
  const grp = (f) => stats(C.filter(f).map((x) => x.R));
  res.deskReplay = { from: J.from, all: grp(() => true), aset: grp((x) => x.aset), asetNoGc: grp((x) => x.aset && x.market !== 'gc'), byMarket: Object.fromEntries([...new Set(C.map((x) => x.market))].map((m) => [m, grp((x) => x.market === m && x.aset)])),
    firstHalf: grp((x) => x.aset && x.opened < (Date.parse('2026-03-20') / 1000)), secondHalf: grp((x) => x.aset && x.opened >= (Date.parse('2026-03-20') / 1000)) };
  console.log('desk replay', JSON.stringify(res.deskReplay));
  save('ict', res);
}

// ════════ Engine Scalp, the live rule (scalp against D1, not asia/overlap, not AUD/USD): the council's own replays
if (run('scalp')) {
  const res = {};
  for (const f of ['backtest.json', 'research/backtest-150d.json', 'research/backtest-150d-clean.json']) {
    const J = rd(f), C = J.tradeCols, ix = Object.fromEntries(C.map((c, i) => [c, i]));
    const rows = J.trades.filter((r) => r[ix.setup] === 'scalp' && r[ix.R_none] != null && (ix.status == null || r[ix.status] == null || r[ix.status] === 'closed') && (ix.fill == null || r[ix.fill] !== 0));
    const net = (r) => r[ix.R_none] - (r[ix.cost] || 0);
    const mid = (Date.parse(J.from) + Date.parse(J.to)) / 2000;
    const S = (f2) => { const a = rows.filter(f2); return { all: stats(a.map(net)), h1: stats(a.filter((r) => r[ix.opened] < mid).map(net)), h2: stats(a.filter((r) => r[ix.opened] >= mid).map(net)), gross: stats(a.map((r) => r[ix.R_none])) }; };
    const live = (r) => r[ix.d1] === 'against' && !['asia', 'overlap'].includes(r[ix.session]) && r[ix.market] !== 'audusd';
    res[f] = { from: J.from, to: J.to, liveRule: S(live), against: S((r) => r[ix.d1] === 'against'), with: S((r) => r[ix.d1] === 'with'), liveRuleNoGold: S((r) => live(r) && r[ix.market] !== 'xau'), liveRuleGold: S((r) => live(r) && r[ix.market] === 'xau'),
      liveRuleSells: S((r) => live(r) && r[ix.side] === 'sell'), liveRuleBuys: S((r) => live(r) && r[ix.side] === 'buy') };
    const months = {}; for (const r of rows.filter(live)) { const m = new Date(r[ix.opened] * 1000).toISOString().slice(0, 7); (months[m] = months[m] || []).push(net(r)); }
    res[f].liveRuleMonths = Object.fromEntries(Object.entries(months).map(([m, a]) => [m, stats(a)]));
    console.log(f, 'live rule', JSON.stringify(res[f].liveRule.all), 'h1', res[f].liveRule.h1.exp, 'h2', res[f].liveRule.h2.exp, '| gold', JSON.stringify(res[f].liveRuleGold.all), '| nonGold', JSON.stringify(res[f].liveRuleNoGold.all), '| sells', res[f].liveRuleSells.all.exp, 'buys', res[f].liveRuleBuys.all.exp);
  }
  save('scalp', res);
}

// ════════ coach-stats claims: how likely is each small-sample "rule" under no edge? (binomial / t on the stated numbers)
if (run('coach')) {
  const cfg = JSON.parse(fs.readFileSync(process.env.ROB_CONFIG || path.join(DATA, '..', 'config.json')));
  const H = cfg.history; const out = [];
  for (const [i, h] of H.entries()) {
    const m = [...(h.why || '').matchAll(/([+-−]?\d+\.\d+)R (?:over|each over) (\d+)/g)].map((x) => [+x[1].replace('−', '-'), +x[2]]);
    // a mean of x R over n trades with a per-trade sd of ~1.3R (a 1:1.2-3R scalp book) has t = x·√n/1.3
    out.push({ i, at: h.at, by: h.by, change: h.change, samples: m.map(([x, n]) => ({ x, n, t: +(x * Math.sqrt(n) / 1.3).toFixed(2) })) });
  }
  const byBy = {}; for (const h of H) byBy[h.by] = (byBy[h.by] || 0) + 1;
  // flip-flops: the same filter key turned on and off again
  const keyOf = (c) => c.replace(/ \(.*\)$/, '').replace(/trading the (\w+) session again/, 'skip the $1 session').replace(/dropped the D1 rule|only with D1|only against D1.*/, 'D1 rule');
  const flips = {}; for (const h of H.filter((x) => x.by === 'coach-stats' || x.by === 'coach-backtest')) { const k = keyOf(h.change); flips[k] = (flips[k] || 0) + 1; }
  save('coach', { counts: byBy, claims: out, repeatedKeys: Object.fromEntries(Object.entries(flips).filter(([, v]) => v > 1)) });
  console.log(JSON.stringify(byBy)); console.log(JSON.stringify(Object.fromEntries(Object.entries(flips).filter(([, v]) => v > 1))));
  for (const c of out.filter((c) => c.by !== 'user' && c.samples.length)) console.log(c.i, c.by, c.change, JSON.stringify(c.samples));
}

// ════════ multiple-testing count: research/backtest-150d-* files, config.history, research/log.md
if (run('count')) {
  const files = fs.readdirSync(path.join(DATA, 'research')).filter((f) => f.startsWith('backtest-150d'));
  const log = fs.readFileSync(path.join(DATA, 'research/log.md'), 'utf8');
  const sections = (log.match(/^##+ /gm) || []).length;
  const verdictLines = (log.match(/(rejected|not adopted|no change|negative|no edge|fails|failed)/gi) || []).length;
  const rLines = log.split('\n').filter((l) => /[+−-]\d+(\.\d+)?R\b/.test(l)).length;
  const grids = [...log.matchAll(/~?([\d,]+) settings/g)].map((m) => +m[1].replace(/,/g, ''));
  const out = { backtest150dFiles: files.length, logSections: sections, logResultLines: rLines, logNegativeVerdictWords: verdictLines, explicitGrids: grids, historyEntries: JSON.parse(fs.readFileSync(path.join(DATA, '..', 'config.json'))).history.length };
  console.log(JSON.stringify(out)); save('count', out);
}

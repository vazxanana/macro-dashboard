// Walk-forward simulation of the Coach's self-learning (council/trader.mjs, 7 Nov 2026) over an engine signal stream.
// Paper research only: nothing here touches live config or trader code.
//
// Signal stream: a council 150-day replay (council-data research/backtest-150d-m30.json: council/backtest.mjs run over
// 6 Jun - 3 Nov 2026, 10 markets, the engine's own signals, with d1/struct/session/cf/choch/m15c features, R_none/R_be1/
// R_be15 and the per-trade spread `cost`). Every filled signal of the setups the Coach decides on (DEF_KEYS: scalp,
// rscalp, intraday, rintra, swing, position, rswing, m30m1) is one trade. A trade is "taken" when the rule state at its
// open lets it through, otherwise it is a shadow with blockedBy reasons, exactly as the trader records them.
// The Coach only sees a trade once it has closed (`closed` <= now). Results are net of the spread (R - cost), as the
// trader's backtest reader does.
//
// The Coach logic is copied from council/trader.mjs (line numbers of 7 Nov):
//   learnFilters 1168-1196 (d1/struct: bad n>=5 e<-0.2 + good n>=3 e>0.1, or bad n>=6 e<=-0.6; session n>=5 e<-0.2,
//     rest n>=3 e>0; sample >= 8; 30-day window; every 6 hours)
//   rule drop 1272-1287 (blocked shadows n>=5 e>+0.2, or 21 days old; daily run)
//   learnFromBacktest 1062-1156 steps 1-4 (conditions t>=3 both halves n>=30; break-even paired t>=2; backtest pause;
//     resume) on a rolling 30-day backtest rebuilt from the same stream (trades opened in the last 30 days and closed)
//   learnPauses 1213-1248 (n>=6 e<-0.25 or 4 losses in a row -> 3-day pause; resumes) every hour
//   minRR 1269 (14-day live trades under 1.5R: n>=6 e<0 -> minRR 1.5, never lowered)
// Not simulated (need data the stream lacks): minRisk/buf (stop width in ATR), review-based lessons (hunt/noise/late/
// news), dollar cap and exposure limits (portfolio), market pauses, second target / market entry (steps 5-6).
//
// Usage: node sim.mjs <backtest-150d-m30.json> <out.json>
import fs from 'node:fs';
const [, , file, outFile] = process.argv;
const b = JSON.parse(fs.readFileSync(file, 'utf8'));
const DEF = ['scalp', 'rscalp', 'intraday', 'rintra', 'swing', 'position', 'rswing', 'm30m1'];
const DEFS = new Set(DEF);
const ALL = b.trades.map((r) => Object.fromEntries(b.tradeCols.map((c, i) => [c, r[i]])))
  .filter((t) => DEFS.has(t.setup) && t.fill === 1 && t.R_none != null)
  .map((t, i) => ({ i, k: t.setup, market: t.market, opened: t.opened, closed: t.closed, rr: t.rr, d1: t.d1, struct: t.struct, session: t.session,
    cf: t.cf, choch: t.choch, m15c: t.m15c, mfe: t.mfe, cost: t.cost || 0,
    Rg: { none: t.R_none, 1: t.R_be1, 1.5: t.R_be15 }, Rn: { none: t.R_none - (t.cost || 0), 1: t.R_be1 - (t.cost || 0), 1.5: t.R_be15 - (t.cost || 0) } }))
  .sort((a, c) => a.opened - c.opened || a.i - c.i);
const T0 = Math.floor(ALL[0].opened / 86400) * 86400, TEND = Math.max(...ALL.map((t) => t.opened));
const DAY = 86400, HOUR = 3600;
const CONDS = [['d1', 'with', 'against'], ['cf', 'choch', 'bo'], ['choch', 'yes', 'no'], ['m15c', 'yes', 'no']];

// mean with market-day clustered SE (CR1) and t, as btE in trader.mjs
function btE(arr, f = (t) => t.R) {
  const n = arr.length; if (!n) return { n: 0, e: 0, se: Infinity, t: 0 };
  let s = 0; for (const t of arr) s += f(t); const e = s / n, cl = new Map();
  for (const t of arr) { const c = `${t.market}|${Math.floor(t.opened / DAY)}`; cl.set(c, (cl.get(c) || 0) + (f(t) - e)); }
  const g = cl.size; let ss = 0; for (const u of cl.values()) ss += u * u;
  const se = g > 1 ? Math.sqrt(ss * g / (g - 1)) / n : Infinity;
  const tt = !isFinite(se) ? 0 : se > 0 ? e / se : e === 0 ? 0 : Math.sign(e) * 99;
  return { n, e, se, t: tt };
}
const gapT = (a, c) => { const se = Math.hypot(a.se, c.se); return isFinite(se) && se > 0 ? (a.e - c.e) / se : 0; };
const mean = (a) => a.length ? a.reduce((s, x) => s + x.R, 0) / a.length : 0;

// ─── one walk-forward run of a policy ───
// P: { stats: 'coded'|'strict'|'off', win (days), retest (days|null), cool (days), pauses: bool, bt: bool, minRR: bool,
//      be: bool, frozen: filters object (static), freezeAt: time after which nothing is learned }
function run(P) {
  const cfg = { filters: {}, paused: {}, resumedAt: {}, be: null, minRR: 1.2 };
  const last = {};                 // key -> time of its last change (cool-down)
  const changes = [];              // {at, key, from, to, by}
  if (P.frozen) cfg.filters = JSON.parse(JSON.stringify(P.frozen));
  const rec = [];                  // trades as recorded: {..., taken, blockedBy, R}
  let ti = 0;
  const canChange = (key, now) => !P.cool || !(last[key] != null && now - last[key] < P.cool * DAY);
  const note = (now, key, from, to, by) => { if ((from ?? null) === (to ?? null)) return; changes.push({ at: now, key, from: from ?? null, to: to ?? null, by }); last[key] = now; };
  const learning = (now) => !P.frozen && !(P.freezeAt && now >= P.freezeAt);
  const win = (P.win || 30) * DAY;
  const closedIn = (now, w) => rec.filter((x) => x.closed <= now && x.closed > now - w);

  // ── coach-stats: learnFilters ──
  function learnFilters(now) {
    const closedAll = closedIn(now, win), learnBy = {};
    // as coded: shadows blocked by d1/struct/session are left out, so once a rule is on, the add test only sees the trades
    // taken before it (a stale sample) while the drop test sees the blocked shadows: two samples, opposite verdicts.
    // P.full: judge on every closed signal of the setup (taken and shadow alike).
    for (const t of closedAll) if (P.full || !t.shadow || !t.blockedBy.some((x) => x === 'd1' || x === 'struct' || x === 'session')) (learnBy[t.k] = learnBy[t.k] || []).push(t);
    for (const [k, arr] of Object.entries(learnBy)) {
      if (arr.length < 8) continue;
      const fl = cfg.filters[k] = cfg.filters[k] || {};
      const mid = arr.map((x) => x.opened).sort((a, c) => a - c)[arr.length >> 1];
      for (const fe of ['d1', 'struct']) {
        if (fl[fe]) continue;
        const key = `${k}.${fe}`; if (!canChange(key, now)) continue;
        const g = {}; arr.forEach((x) => { const v = x[fe]; if (v && v !== 'n/a') (g[v] = g[v] || []).push(x); });
        if (P.stats === 'coded') {
          const vals = Object.entries(g).map(([v, a]) => ({ v, n: a.length, e: mean(a) }));
          const bad = vals.find((x) => x.n >= 5 && x.e < -0.2), good = vals.find((x) => x.n >= 3 && x.e > 0.1);
          if (bad && good) { fl[fe] = good.v; (fl.since = fl.since || {})[fe] = now; note(now, key, null, good.v, 'stats'); }
          else if (bad && bad.n >= 6 && bad.e <= -0.6) {
            const other = { against: 'with', internal: 'main' }[bad.v];
            if (other) { fl[fe] = other; (fl.since = fl.since || {})[fe] = now; note(now, key, null, other, 'stats'); }
          }
        } else if (P.stats === 'strict') {
          const vs = Object.keys(g); if (vs.length < 2) continue;
          const E = Object.fromEntries(vs.map((v) => [v, btE(g[v])]));
          const sorted = vs.sort((a, c) => E[c].e - E[a].e), good = sorted[0], bad = sorted[sorted.length - 1];
          const ok = E[good].n >= P.minN && E[bad].n >= P.minN && E[bad].e < -0.2 && E[good].e > 0.1 && gapT(E[good], E[bad]) >= P.minT
            && mean(g[good].filter((x) => x.opened < mid)) > mean(g[bad].filter((x) => x.opened < mid))
            && mean(g[good].filter((x) => x.opened >= mid)) > mean(g[bad].filter((x) => x.opened >= mid));
          if (ok) { fl[fe] = good; (fl.since = fl.since || {})[fe] = now; note(now, key, null, good, 'stats'); }
        }
      }
      const gs = {}; arr.forEach((x) => { if (x.session) (gs[x.session] = gs[x.session] || []).push(x); });
      for (const [v, a] of Object.entries(gs)) {
        const key = `${k}.session:${v}`;
        if ((fl.noSession || []).includes(v) || !canChange(key, now)) continue;
        const rest = arr.filter((x) => x.session !== v);
        let ok;
        if (P.stats === 'coded') ok = a.length >= 5 && mean(a) < -0.2 && rest.length >= 3 && mean(rest) > 0;
        else { const A = btE(a), Rr = btE(rest);
          ok = A.n >= P.minN && Rr.n >= P.minN && A.e < -0.2 && Rr.e > 0 && gapT(Rr, A) >= P.minT
            && mean(rest.filter((x) => x.opened < mid)) > mean(a.filter((x) => x.opened < mid)) && mean(rest.filter((x) => x.opened >= mid)) > mean(a.filter((x) => x.opened >= mid)); }
        if (ok) { fl.noSession = (fl.noSession || []).concat(v); (fl.since = fl.since || {})['session:' + v] = now; note(now, key, null, 'skip', 'stats'); }
      }
    }
  }
  // ── coach-stats: drop a rule when its blocked shadows pay, or after `retest` days ──
  function dropRules(now) {
    const shadows = closedIn(now, win).filter((x) => x.shadow);
    for (const [k, fl] of Object.entries(cfg.filters)) {
      const src = fl.src || {};
      for (const fe of ['d1', 'struct']) {
        if (!fl[fe] || src[fe] === 'backtest' || src[fe] === 'frozen') continue;
        const key = `${k}.${fe}`; if (!canChange(key, now)) continue;
        const sh = shadows.filter((x) => x.k === k && x.blockedBy.includes(fe));
        const old = P.retest && fl.since && fl.since[fe] != null && now - fl.since[fe] > P.retest * DAY;
        const pays = P.stats === 'coded' ? sh.length >= 5 && mean(sh) > 0.2 : (() => { const E = btE(sh); return E.n >= P.minN && E.e > 0 && E.t >= P.minT; })();
        if (pays || old) { note(now, key, fl[fe], null, old && !pays ? 'retest' : 'stats'); delete fl[fe]; if (fl.since) delete fl.since[fe]; }
      }
      for (const v of (fl.noSession || []).slice()) {
        const key = `${k}.session:${v}`; if (!canChange(key, now)) continue;
        if (src['session:' + v] === 'frozen') continue;
        const sh = shadows.filter((x) => x.k === k && x.blockedBy.includes('session') && x.session === v);
        const old = P.retest && fl.since && fl.since['session:' + v] != null && now - fl.since['session:' + v] > P.retest * DAY;
        const pays = P.stats === 'coded' ? sh.length >= 5 && mean(sh) > 0.2 : (() => { const E = btE(sh); return E.n >= P.minN && E.e > 0 && E.t >= P.minT; })();
        if (pays || old) { fl.noSession = fl.noSession.filter((x) => x !== v); if (fl.since) delete fl.since['session:' + v]; note(now, key, 'skip', null, old && !pays ? 'retest' : 'stats'); }
      }
    }
  }
  // ── learnFromBacktest on a rolling 30-day replay rebuilt from the stream ──
  const passes = (t, f) => CONDS.every(([c]) => !f[c] || t[c] === f[c]);
  function learnFromBacktest(now) {
    const BT = []; for (const t of ALL) { if (t.opened >= now) break; if (t.opened >= now - 30 * DAY && t.closed <= now) BT.push({ ...t, R: t.Rn.none }); }
    if (BT.length < 50) return;
    const mid = BT.map((t) => t.opened).sort((a, c) => a - c)[BT.length >> 1];
    const halves = (a, f) => [btE(a.filter((t) => t.opened < mid), f), btE(a.filter((t) => t.opened >= mid), f)];
    for (const k of DEF) {
      const a = BT.filter((t) => t.k === k);
      for (const [c, v1, v2] of CONDS) {
        const key = `${k}.${c}`, fl = cfg.filters[k] = cfg.filters[k] || {}, other = (v) => v === v1 ? v2 : v1;
        const S = Object.fromEntries([v1, v2].map((v) => { const arr = a.filter((t) => t[c] === v); return [v, { ...btE(arr), h: halves(arr) }]; }));
        if (fl[c] && (fl.src || {})[c] === 'backtest' && canChange(key, now)) {
          const kept = S[fl[c]], out = S[other(fl[c])];
          if (kept.n >= 15 && out.n >= 15 && out.e >= kept.e) { note(now, key, fl[c], null, 'backtest'); delete fl[c]; delete fl.src[c]; if (fl.since) delete fl.since[c]; }
        }
        if (S[v1].n < 30 || S[v2].n < 30) continue;
        const w = S[v1].e > S[v2].e ? v1 : v2, l = other(w), gap = gapT(S[w], S[l]);
        if (!(S[w].e >= 0.1 && S[l].e <= -0.1 && gap >= 3 && S[w].h[0].e > S[l].h[0].e && S[w].h[1].e > S[l].h[1].e)) continue;
        if ((fl.src || {})[c] === 'frozen') continue;
        if (fl[c] === w && (fl.src || {})[c] === 'backtest') continue;
        if (!canChange(key, now)) continue;
        note(now, key, fl[c], w, 'backtest'); fl[c] = w; (fl.src = fl.src || {})[c] = 'backtest'; (fl.since = fl.since || {})[c] = now;
      }
    }
    if (P.be) {
      const none = (t) => t.Rn.none, d1 = (t) => t.Rn[1] - t.Rn.none, d15 = (t) => t.Rn[1.5] - t.Rn.none;
      if (BT.length >= 300) {
        const cand = [[1, d1], [1.5, d15]].map(([be, f]) => { const d = btE(BT, f), [h1, h2] = halves(BT, f); return { be, d, ok: d.e >= 0.02 && d.t >= 2 && h1.e > 0 && h2.e > 0 }; });
        const best = cand.filter((x) => x.ok).sort((x, y) => y.d.e - x.d.e)[0], want = best ? best.be : null;
        if (cfg.be !== want && canChange('global.be', now)) { note(now, 'global.be', cfg.be, want, 'backtest'); cfg.be = want; }
      }
    }
    if (P.pauses) for (const k of DEF) {
      if (cfg.paused[k] > now) continue;
      const f = cfg.filters[k] || {}, a = BT.filter((t) => t.k === k && passes(t, f)), all = btE(a), [h1, h2] = halves(a);
      if (((all.n >= 10 && all.e <= -0.3) || (all.n >= 8 && all.e <= -0.5)) && all.t <= -2 && h1.e < 0 && h2.e < 0) { cfg.paused[k] = now + 3 * DAY; note(now, `${k}.pause`, null, 'bt', 'backtest'); }
    }
    cfg._BT = { BT, mid };
  }
  const btPos = (k) => { if (!cfg._BT) return false; const { BT, mid } = cfg._BT; const f = cfg.filters[k] || {}, a = BT.filter((t) => t.k === k && passes(t, f)), all = btE(a);
    return all.n >= 100 && all.e >= 0.1 && all.t >= 2.5 && btE(a.filter((t) => t.opened < mid)).e > 0 && btE(a.filter((t) => t.opened >= mid)).e > 0; };
  const btNonNeg = (k) => { if (!cfg._BT) return false; const f = cfg.filters[k] || {}, all = btE(cfg._BT.BT.filter((t) => t.k === k && passes(t, f))); return all.n >= 50 && all.e >= 0; };
  // ── learnPauses (hourly) ──
  function learnPauses(now) {
    const W = closedIn(now, 30 * DAY), sample = W.filter((x) => !x.shadow).sort((a, c) => a.closed - c.closed);
    for (const k of DEF) {
      if (!(cfg.paused[k] > now)) continue;
      const sh = W.filter((x) => x.k === k && x.shadow && x.blockedBy.includes('paused') && x.blockedBy.every((y) => y === 'paused'));
      if (sh.length >= 4 && mean(sh) > 0.3) { delete cfg.paused[k]; cfg.resumedAt[k] = now; note(now, `${k}.pause`, 'on', null, 'stats'); continue; }
      const arr = sample.filter((x) => x.k === k);
      if (arr.length >= 6 && mean(arr) >= 0 && btNonNeg(k)) { delete cfg.paused[k]; cfg.resumedAt[k] = now; note(now, `${k}.pause`, 'on', null, 'stats'); }
    }
    for (const k of DEF) {
      if (cfg.paused[k] > now) continue;
      const arr = sample.filter((x) => x.k === k && x.opened >= (cfg.resumedAt[k] || 0));
      if (btPos(k) && arr.length < 15) continue;
      const n = arr.length, e = mean(arr), l4 = arr.slice(-4);
      const streak = l4.length === 4 && l4.every((x) => x.Rraw < 0) && e < 0 && !btNonNeg(k);
      if ((n >= 6 && e < -0.25) || streak) { cfg.paused[k] = now + 3 * DAY; note(now, `${k}.pause`, null, 'on', 'stats'); }
    }
  }
  function learnMinRR(now) {
    if (cfg.minRR >= 1.5) return;
    const low = rec.filter((x) => !x.shadow && x.closed <= now && x.closed > now - 14 * DAY && x.rr < 1.5);
    if (low.length >= 6 && mean(low) < 0) { note(now, 'global.minRR', cfg.minRR, 1.5, 'stats'); cfg.minRR = 1.5; }
  }
  // ── open trades through the current rule state ──
  function openUntil(tEnd) {
    for (; ti < ALL.length && ALL[ti].opened < tEnd; ti++) {
      const t = ALL[ti], f = cfg.filters[t.k] || {}, bl = [];
      if (cfg.paused[t.k] > t.opened) bl.push('paused');
      if (!(t.rr >= cfg.minRR)) bl.push('minRR');
      if (f.d1 && t.d1 !== f.d1) bl.push('d1');
      for (const [c] of CONDS.slice(1)) if (f[c] && t[c] !== f[c]) bl.push(c);
      if (f.struct && t.struct !== f.struct) bl.push('struct');
      if ((f.noSession || []).includes(t.session)) bl.push('session');
      const be = cfg.be == null ? 'none' : cfg.be;
      rec.push({ ...t, shadow: bl.length > 0, blockedBy: bl, R: t.Rn[be], Rgross: t.Rg[be], Rraw: t.Rg[be] });
    }
  }
  for (let now = T0 + HOUR; now <= TEND + HOUR; now += HOUR) {
    openUntil(now);
    if (!learning(now)) continue;
    const h = new Date(now * 1000).getUTCHours();
    if (h === 0) {   // daily Coach run, then the (daily) new backtest
      if (P.pauses) learnPauses(now);
      if (P.minRR) learnMinRR(now);
      if (P.stats !== 'off') { learnFilters(now); dropRules(now); }
      if (P.bt) learnFromBacktest(now);
    } else {
      if (P.pauses) learnPauses(now);
      if (h % 6 === 0 && P.stats !== 'off') learnFilters(now);
    }
  }
  return { rec, changes };
}

// ─── evaluation ───
function stats(arr, key = 'R') {
  const n = arr.length; if (!n) return { n: 0, wr: 0, exp: 0, R: 0, maxDD: 0, streak: 0, t: 0 };
  const s = [...arr].sort((a, c) => a.closed - c.closed); let eq = 0, pk = 0, dd = 0, run = 0, worst = 0, w = 0;
  for (const x of s) { eq += x[key]; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); if (x[key] > 0) { w++; run = 0; } else { run++; worst = Math.max(worst, run); } }
  const E = btE(arr, (x) => x[key]);
  return { n, wr: +(w / n).toFixed(3), exp: +E.e.toFixed(3), R: +eq.toFixed(1), maxDD: +dd.toFixed(1), streak: worst, t: +E.t.toFixed(2) };
}
const EVAL0 = T0 + 30 * DAY, SPLIT = EVAL0 + Math.round((TEND - EVAL0) * 2 / 3 / DAY) * DAY;
const iso = (s) => new Date(s * 1000).toISOString().slice(0, 10);
function churn(changes, from, to) {
  const c = changes.filter((x) => x.at >= from && x.at < to && !x.key.endsWith('.pause'));
  const per = {}; for (const x of c) (per[x.key] = per[x.key] || []).push(x);
  let rev = 0, rev3 = 0; for (const a of Object.values(per)) for (let i = 1; i < a.length; i++) if (a[i].to === a[i - 1].from) { rev++; if (a[i].at - a[i - 1].at < 3 * DAY) rev3++; }
  const pauses = changes.filter((x) => x.at >= from && x.at < to && x.key.endsWith('.pause') && x.to).length;
  return { ruleChanges: c.length, reversals: rev, reversalsWithin3d: rev3, keysChanged: Object.keys(per).length, flipKeys: Object.entries(per).filter(([, a]) => a.length >= 3).map(([k, a]) => `${k}×${a.length}`), pauses };
}
function evaluate(name, P, desc) {
  const { rec, changes } = run(P);
  const taken = rec.filter((x) => !x.shadow && x.opened >= EVAL0);
  const IS = taken.filter((x) => x.opened < SPLIT), OOS = taken.filter((x) => x.opened >= SPLIT);
  const months = {}; for (const x of OOS.concat(IS)) { const m = iso(x.opened).slice(0, 7); (months[m] = months[m] || []).push(x); }
  // random thinning: the same number of trades drawn at random from the frozen baseline's trades of the same period
  const base = BASE || [], rnd = (pool, n) => { if (!n || !pool.length) return null; const m = []; let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let it = 0; it < 300; it++) { let s = 0; for (let j = 0; j < n; j++) s += pool[Math.floor(rand() * pool.length)].R; m.push(s / n); }
    m.sort((a, c) => a - c); return { mean: +(m.reduce((a, c) => a + c, 0) / m.length).toFixed(3), p5: +m[15].toFixed(3), p95: +m[284].toFixed(3), pct: +(m.filter((v) => v < stats(n === IS.length ? IS : OOS).exp).length / m.length).toFixed(2) }; };
  const random = { is: rnd(base.filter((x) => x.opened < SPLIT), IS.length), oos: rnd(base.filter((x) => x.opened >= SPLIT), OOS.length) };
  const perSetup = {}; for (const k of DEF) perSetup[k] = { is: stats(IS.filter((x) => x.k === k)), oos: stats(OOS.filter((x) => x.k === k)) };
  return { name, desc, P: { ...P, frozen: P.frozen ? '(static set)' : undefined }, random, is: stats(IS), oos: stats(OOS), isGross: stats(IS, 'Rgross'), oosGross: stats(OOS, 'Rgross'),
    months: Object.fromEntries(Object.entries(months).sort().map(([m, a]) => [m, stats(a)])), perSetup,
    churnIS: churn(changes, EVAL0, SPLIT), churnOOS: churn(changes, SPLIT, TEND + DAY), churnAll: churn(changes, T0, TEND + DAY),
    changes: changes.map((x) => ({ at: new Date(x.at * 1000).toISOString().slice(0, 13), key: x.key, from: x.from, to: x.to, by: x.by })) };
}

// Frozen IS rule set: chosen once on all IS data (start .. SPLIT) by the strict test, then never changed.
function frozenFromIS(minN = 30, minT = 2) {
  const arr = ALL.filter((t) => t.closed <= SPLIT).map((t) => ({ ...t, R: t.Rn.none })), F = {};
  const mid = arr.map((x) => x.opened).sort((a, c) => a - c)[arr.length >> 1];
  for (const k of DEF) {
    const a = arr.filter((t) => t.k === k), fl = {};
    for (const fe of ['d1', 'struct']) {
      const g = {}; a.forEach((x) => { if (x[fe] && x[fe] !== 'n/a') (g[x[fe]] = g[x[fe]] || []).push(x); });
      const vs = Object.keys(g); if (vs.length < 2) continue;
      const E = Object.fromEntries(vs.map((v) => [v, btE(g[v])])); vs.sort((p, q) => E[q].e - E[p].e);
      const [gd, bd] = [vs[0], vs[vs.length - 1]];
      if (E[gd].n >= minN && E[bd].n >= minN && gapT(E[gd], E[bd]) >= minT && E[bd].e < -0.2 && E[gd].e > 0.1
        && mean(g[gd].filter((x) => x.opened < mid)) > mean(g[bd].filter((x) => x.opened < mid)) && mean(g[gd].filter((x) => x.opened >= mid)) > mean(g[bd].filter((x) => x.opened >= mid))) { fl[fe] = gd; (fl.src = fl.src || {})[fe] = 'frozen'; }
    }
    const kept = a.filter((x) => (!fl.d1 || x.d1 === fl.d1) && (!fl.struct || x.struct === fl.struct));
    for (const v of ['asia', 'london', 'overlap', 'newyork', 'late']) {
      const s = kept.filter((x) => x.session === v), rest = kept.filter((x) => x.session !== v), A = btE(s), Rr = btE(rest);
      if (A.n >= minN && Rr.n >= minN && A.e < -0.2 && Rr.e > 0 && gapT(Rr, A) >= minT
        && mean(rest.filter((x) => x.opened < mid)) > mean(s.filter((x) => x.opened < mid)) && mean(rest.filter((x) => x.opened >= mid)) > mean(s.filter((x) => x.opened >= mid))) { (fl.noSession = fl.noSession || []).push(v); (fl.src = fl.src || {})['session:' + v] = 'frozen'; }
    }
    if (Object.keys(fl).length) F[k] = fl;
  }
  return F;
}

const coded = { stats: 'coded', win: 30, retest: 21, cool: 0, pauses: true, bt: true, minRR: true, be: true };
const V = [
  ['F0 frozen: no learned rules', { stats: 'off', bt: false, pauses: false, minRR: false, be: false }, 'Every signal at minRR 1.2, no filters, no break-even, no pauses.'],
  ['F1 frozen: IS-chosen strict set', { stats: 'off', bt: false, pauses: false, minRR: false, be: false, frozen: frozenFromIS() }, 'Filters picked once on the IS window (n>=30 each side, t>=2, both halves), never changed.'],
  ['C0 Coach as coded', coded, 'learnFilters + drop/21-day re-test + learnFromBacktest + pauses + minRR, exact thresholds.'],
  ['C1 Coach as coded, noPause', { ...coded, pauses: false }, 'As C0 with config.noPause (live since 3 Nov).'],
  ['C2 backtest learner only', { ...coded, stats: 'off', pauses: false, minRR: false }, 'Only learnFromBacktest (t>=3, both halves, n>=30): no coach-stats filters, pauses or minRR.'],
  ['C3 coded + 14-day cool-down', { ...coded, pauses: false, cool: 14 }, 'No rule key may change again within 14 days of its last change.'],
  ['C4 coded, 60-day window', { ...coded, pauses: false, win: 60 }, 'learnFilters and the drop rule read 60 days instead of 30.'],
  ['C5 coded, no 21-day re-test', { ...coded, pauses: false, retest: null }, 'Rules dropped only on shadow evidence.'],
  ['C6 coded, full sample (fix)', { ...coded, pauses: false, full: true }, 'As C1, but learnFilters judges on every closed signal (taken and shadow) instead of leaving out the shadows its own rules blocked.'],
  ['C7 coded, full sample + 14-day cool-down', { ...coded, pauses: false, full: true, cool: 14 }, 'C6 plus the cool-down.'],
  ['S1 strict stats (n>=30, t>=2, both halves)', { ...coded, pauses: false, stats: 'strict', minN: 30, minT: 2 }, 'learnFilters and the drop rule need n>=30 on each side, clustered t>=2 and both halves.'],
  ['S2 strict + 14-day cool-down', { ...coded, pauses: false, stats: 'strict', minN: 30, minT: 2, cool: 14 }, 'S1 plus the cool-down.'],
  ['S3 strict + cool-down + 60-day window, no re-test', { ...coded, pauses: false, stats: 'strict', minN: 30, minT: 2, cool: 14, win: 60, retest: null }, 'S2 with 60-day evidence and no blind re-test.'],
  ['S5 strict + cool-down + full sample', { ...coded, pauses: false, stats: 'strict', minN: 30, minT: 2, cool: 14, full: true }, 'S2 judged on every closed signal.'],
  ['S6 strict + cool-down + full sample + 60-day, no re-test', { ...coded, pauses: false, stats: 'strict', minN: 30, minT: 2, cool: 14, full: true, win: 60, retest: null }, 'S3 judged on every closed signal.'],
  ['S4 strict + cool-down + 60-day window + re-test 21', { ...coded, pauses: false, stats: 'strict', minN: 30, minT: 2, cool: 14, win: 60 }, 'S3 keeping the 21-day re-test.'],
];
let BASE = null; { const { rec } = run(V[0][1]); BASE = rec.filter((x) => !x.shadow && x.opened >= EVAL0); }
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const results = [];
for (const [name, P, desc] of V) {
  if (only && !only.has(name.split(' ')[0])) continue;
  const t0 = Date.now(), r = evaluate(name, P, desc); results.push(r);
  const f = (s) => `n${s.n} wr${s.wr} exp${s.exp >= 0 ? '+' : ''}${s.exp} R${s.R} DD${s.maxDD} t${s.t}`;
  console.log(name.padEnd(50), '| IS', f(r.is), '| OOS', f(r.oos), '| rnd OOS', r.random.oos && r.random.oos.mean, 'pctile', r.random.oos && r.random.oos.pct, '| churn all', r.churnAll.ruleChanges, 'rev', r.churnAll.reversals, `(${r.churnAll.reversalsWithin3d} <3d)`, 'pauses', r.churnAll.pauses, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
fs.writeFileSync(outFile, JSON.stringify({ source: file, at: b.at, window: [iso(T0), iso(TEND)], eval: [iso(EVAL0), iso(SPLIT), iso(TEND)], setups: DEF, frozenIS: frozenFromIS(), results }, null, 1));

// Coach proposals (7 Nov): owner-facing suggestions from the 30-day replay (backtest.json) for the setups that trade live
// (config.focusSetups). They are NEVER applied: live rules change only with the owner's OK. For each live setup the replay
// trades that pass its current live filters are split by market and by session; a market or session that loses clearly
// (20+ trades at -0.30R or worse each) while the rest are positive becomes a "skip" proposal. A stability line reports the
// expectancy in each half of the replay window and flags a negative half.
const MKT = { xau: 'gold', eurusd: 'EUR/USD', gbpusd: 'GBP/USD', audusd: 'AUD/USD', usdcad: 'USD/CAD', usdchf: 'USD/CHF', usdjpy: 'USD/JPY', btc: 'BTC', eth: 'ETH', nq: 'NQ', es: 'ES' };
const SES = { asia: 'Asia', london: 'London', newyork: 'New York', overlap: 'London/New York overlap', late: 'late New York' };
const mName = (m) => MKT[m] || String(m).toUpperCase();
const sName = (s) => SES[s] || s;
const r2 = (v) => +v.toFixed(2);
const fR = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`;
const mean = (a) => a.length ? a.reduce((s, t) => s + t.R, 0) / a.length : 0;

// the live filters as the Trader applies them (trader.mjs: d1/cf/choch/m15c, struct, noSession, off, reward:risk band, noMarket)
export function passesLive(t, f) {
  if (!f) return true;
  for (const c of ['d1', 'cf', 'choch', 'm15c']) if (f[c] && t[c] !== undefined && t[c] !== f[c]) return false;
  if (f.struct && t.struct && t.struct !== 'n/a' && t.struct !== f.struct) return false;
  if ((f.noSession || []).includes(t.session)) return false;
  if (f.off) return false;
  if (f.minRR && !(t.rr >= f.minRR)) return false;
  if (f.maxRR && t.rr > f.maxRR) return false;
  if ((f.noMarket || []).includes(t.market)) return false;
  return true;
}

export function coachProposals(b, config, at = new Date().toISOString(), opt = {}) {
  const minN = opt.minN || 20, bad = opt.bad != null ? opt.bad : -0.3;
  if (!b || b.fake || !Array.isArray(b.trades) || !Array.isArray(b.tradeCols) || !b.trades.length) return [];
  const cols = b.tradeCols, hasCost = cols.includes('cost');
  // filled trades as the Trader takes them (no market-entry twins, no unfilled orders), judged after costs
  const rows = b.trades.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])))
    .filter((t) => t.fill !== 0 && t.status !== 'open' && !String(t.setup).includes('@') && t.R_none != null && isFinite(t.R_none))
    .map((t) => ({ ...t, R: +(t.R_none - (hasCost ? t.cost || 0 : 0)).toFixed(3) }));
  const t0 = Date.parse(b.from) / 1000, t1 = Date.parse(b.to) / 1000;
  const midOf = (A) => isFinite(t0) && isFinite(t1) && t1 > t0 ? (t0 + t1) / 2 : A.map((t) => t.opened).sort((x, y) => x - y)[A.length >> 1];
  const halves = (A) => { const mid = midOf(A), a = A.filter((t) => t.opened < mid), z = A.filter((t) => t.opened >= mid); return { h1: { n: a.length, exp: r2(mean(a)) }, h2: { n: z.length, exp: r2(mean(z)) } }; };
  const out = [];
  for (const k of (config && config.focusSetups) || []) {
    const f = ((config.filters || {})[k]) || {};
    const A = rows.filter((t) => t.setup === k && passesLive(t, f));
    if (!A.length) continue;
    for (const [field, kind, label] of [['market', 'skipMarket', (v) => `skip ${mName(v)}`], ['session', 'skipSession', (v) => `skip the ${sName(v)} session`]]) {
      for (const v of [...new Set(A.map((t) => t[field]))].sort()) {
        const a = A.filter((t) => t[field] === v), rest = A.filter((t) => t[field] !== v), e = mean(a), re = mean(rest);
        if (a.length < minN || e > bad || !rest.length || re <= 0) continue;
        const what = field === 'market' ? `on ${mName(v)}` : `in the ${sName(v)} session`, others = field === 'market' ? 'the other markets' : 'the other sessions';
        out.push({ setup: k, kind, value: v, label: label(v), n: a.length, exp: r2(e), restN: rest.length, restExp: r2(re),
          why: `${k} under the live rule made ${fR(e)} a trade over ${a.length} replay trades ${what}; ${others} ${fR(re)} over ${rest.length}.`, at });
      }
    }
    // stability: the two halves of the replay window (by calendar time; by the median trade if the window is missing)
    const mid = midOf(A);
    const h1 = A.filter((t) => t.opened < mid), h2 = A.filter((t) => t.opened >= mid), e1 = mean(h1), e2 = mean(h2), e = mean(A);
    const neg = (h1.length && e1 < 0) || (h2.length && e2 < 0);
    out.push({ setup: k, kind: 'stability', value: neg ? 'unstable' : 'stable', n: A.length, exp: r2(e), h1: { n: h1.length, exp: r2(e1) }, h2: { n: h2.length, exp: r2(e2) }, flag: !!neg,
      why: `${k} under the live rule: ${fR(e)} a trade over ${A.length} replay trades; first half ${fR(e1)} (${h1.length}), second half ${fR(e2)} (${h2.length})${neg ? ': one half lost money, so the edge is not steady.' : ': positive in both halves.'}`, at });
  }
  return out.concat(promoteDemote(rows, config, halves, at, opt));
}

// Promotion / demotion (7 Nov): which shadow setups have earned a live slot, and which live setup has lost its edge.
// Proposals only: the owner moves a setup in or out of config.focusSetups; nothing here changes the live rules.
//   promote   : a shadow setup (not off) whose replay under its current filters has n>=100, +0.10R or better a trade and
//               a profit in both halves of the window -> "make <setup> live".
//   promoteIf : the same setup restricted to one condition the Coach already splits on (daily trend with/against, one
//               session): n>=80, +0.15R or better, both halves positive and at least +0.10R better than the whole.
//   demote    : a live setup whose replay under the live rule has n>=80 and loses on average, or loses in both halves.
const COND = [['d1', (v) => `only ${v} the daily trend`], ['session', (v) => `only in the ${sName(v)} session`]];
export function promoteDemote(rows, config, halves, at, opt = {}) {
  const P = { n: 100, exp: 0.1, nIf: 80, expIf: 0.15, better: 0.1, nDem: 80, ...(opt.promote || {}) };
  const focus = (config && config.focusSetups) || [], F = (config && config.filters) || {};
  const out = [], pos = (h) => h.h1.n > 0 && h.h2.n > 0 && h.h1.exp > 0 && h.h2.exp > 0;
  const stat = (A) => ({ n: A.length, exp: r2(mean(A)), ...halves(A) });
  const line = (s) => `${fR(s.exp)} a trade over ${s.n} replay trades; first half ${fR(s.h1.exp)} (${s.h1.n}), second half ${fR(s.h2.exp)} (${s.h2.n})`;
  for (const k of [...new Set(rows.map((t) => t.setup))].sort()) {
    const f = F[k] || {}, A = rows.filter((t) => t.setup === k && passesLive(t, f));
    if (focus.includes(k)) {
      if (A.length < P.nDem) continue;
      const s = stat(A), bothNeg = s.h1.n > 0 && s.h2.n > 0 && s.h1.exp < 0 && s.h2.exp < 0;
      if (s.exp < 0 || bothNeg) out.push({ setup: k, kind: 'demote', value: 'shadow', label: `move ${k} back to shadow`, ...s,
        why: `${k} under the live rule: ${line(s)}${s.exp < 0 ? ': it loses on average' : ''}${bothNeg ? (s.exp < 0 ? ' and' : ':') + ' both halves lost money' : ''}. Keep it in shadow until it earns its slot back.`, at });
      continue;
    }
    if (f.off || A.length < Math.min(P.n, P.nIf)) continue;
    const whole = stat(A);
    if (whole.n >= P.n && whole.exp >= P.exp && pos(whole)) out.push({ setup: k, kind: 'promote', value: 'live', label: `make ${k} live`, ...whole,
      why: `${k} (shadow) under its current filters: ${line(whole)}: profitable in both halves.`, at });
    for (const [field, lab] of COND) {
      if (field === 'd1' && f.d1) continue;   // already restricted to one side of the daily trend
      for (const v of [...new Set(A.map((t) => t[field]))].filter((v) => v != null && v !== 'n/a').sort()) {
        const s = stat(A.filter((t) => t[field] === v));
        if (s.n < P.nIf || s.exp < P.expIf || !pos(s) || s.exp < whole.exp + P.better) continue;
        out.push({ setup: k, kind: 'promoteIf', value: `${field}:${v}`, label: `make ${k} live, ${lab(v)}`, ...s, all: { n: whole.n, exp: whole.exp },
          why: `${k} (shadow) ${lab(v).replace('only ', '')}: ${line(s)}; all of ${k} ${fR(whole.exp)} over ${whole.n}.`, at });
      }
    }
  }
  return out;
}

// Data-source proposal (7 Nov): from research/spotcheck.json (council/spotcheck.mjs). The live Trader manages gold/forex
// trades on Kraken candles; when the same trades re-judged on OANDA spot candles come out clearly worse, Kraken's thin forex
// books are flattering the paper results. One proposal names the markets; never applied (the candle source is the owner's call).
export function spotProposals(spot, at = new Date().toISOString(), opt = {}) {
  const minN = opt.minN || 20, gap = opt.gap != null ? opt.gap : 8;
  if (!spot || !spot.markets) return [];
  const feed = opt.feed || {};   // markets already managed on OANDA candles (snapshot.feed) need no proposal
  const bad = Object.entries(spot.markets).filter(([m, c]) => c && feed[m] !== 'OANDA' && c.n >= minN && c.liveR - c.spotR >= gap).sort((a, b) => (b[1].liveR - b[1].spotR) - (a[1].liveR - a[1].spotR));
  if (!bad.length) return [];
  const n = bad.reduce((s, [, c]) => s + c.n, 0), liveR = r2(bad.reduce((s, [, c]) => s + c.liveR, 0)), spotR = r2(bad.reduce((s, [, c]) => s + c.spotR, 0));
  const per = bad.map(([m, c]) => `${mName(m)} ${fR(c.liveR / c.n)} live vs ${fR(c.spotR / c.n)} spot (${c.n})`).join('; ');
  return [{ setup: 'all', kind: 'dataSource', value: 'oanda:' + bad.map(([m]) => m).join(','), markets: bad.map(([m]) => m),
    label: `manage ${bad.map(([m]) => mName(m)).join(', ')} trades on OANDA spot candles`, n, liveR, spotR, exp: r2((liveR - spotR) / n),
    why: `The same closed live trades re-judged on OANDA spot candles: ${liveR >= 0 ? '+' : '−'}${Math.abs(liveR).toFixed(1)}R on Kraken candles vs ${spotR >= 0 ? '+' : '−'}${Math.abs(spotR).toFixed(1)}R on spot over ${n} trades (${per}). Kraken's thin forex books reach levels spot never touched, so the paper results look better than a broker would give.`, spotAt: spot.at, at }];
}

// ICT filter verdicts (7 Nov): the ICT desk's paper variants (ict/replay.json shadowByVariant: 'nofri' skips Fridays, 'h1opp'
// keeps only trades against or without H1 structure) each drop some A-setups. A filter is only worth proposing to the owner
// when the trades it DROPS are clearly losing: 30+ dropped trades, mean R at t <= -2, and negative in both halves by close
// time (the Coach's usual bar). Otherwise the verdict is 'watch' with the numbers. Never applied: the owner decides.
const VARIANT = { nofri: 'skip Fridays', h1opp: 'only trades against or without H1 structure' };
export function ictVariantVerdicts(replay, at = new Date().toISOString(), opt = {}) {
  const minN = opt.minN || 30, T = opt.t || 2;
  if (!replay || !Array.isArray(replay.trades) || !replay.shadowByVariant) return [];
  const A = replay.trades.filter((t) => t.aset && t.closed && Number.isFinite(+t.R));
  if (!A.length) return [];
  const stats = (a) => { const n = a.length, m = n ? a.reduce((s, x) => s + +x.R, 0) / n : 0, sd = n > 1 ? Math.sqrt(a.reduce((s, x) => s + (x.R - m) ** 2, 0) / (n - 1)) : 0; return { n, exp: r2(m), t: sd > 0 ? r2(m / (sd / Math.sqrt(n))) : 0 }; };
  const out = [];
  for (const [v, L] of Object.entries(replay.shadowByVariant)) {
    if (!Array.isArray(L)) continue;
    const keep = new Set(L.map((t) => String(t.id).replace(`-${v}`, '')));
    const dropped = A.filter((t) => !keep.has(t.id)).sort((x, y) => x.closed - y.closed), kept = A.filter((t) => keep.has(t.id));
    if (!dropped.length) continue;
    const d = stats(dropped), k = stats(kept), h = dropped.length >> 1, h1 = stats(dropped.slice(0, h)), h2 = stats(dropped.slice(h));
    const propose = d.n >= minN && d.t <= -T && h1.exp < 0 && h2.exp < 0;
    const label = `ICT A-setups: ${VARIANT[v] || v}`;
    out.push({ setup: 'ICT A', kind: propose ? 'ictFilter' : 'ictWatch', value: v, label, n: d.n, exp: d.exp, t: d.t, h1, h2, keptN: k.n, keptExp: k.exp, flag: propose,
      why: `${label}: the ${d.n} A-setups it drops made ${fR(d.exp)} a trade (t ${d.t}; halves ${fR(h1.exp)} / ${fR(h2.exp)}); the ${k.n} it keeps ${fR(k.exp)}. `
        + (propose ? 'The dropped trades lose clearly: proposed to the owner.' : `Not proposed: needs ${minN}+ dropped trades losing at t ≤ −${T} in both halves.`), at });
  }
  return out;
}

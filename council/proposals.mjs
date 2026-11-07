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
    .filter((t) => t.fill !== 0 && !String(t.setup).includes('@') && t.R_none != null && isFinite(t.R_none))
    .map((t) => ({ ...t, R: +(t.R_none - (hasCost ? t.cost || 0 : 0)).toFixed(3) }));
  const t0 = Date.parse(b.from) / 1000, t1 = Date.parse(b.to) / 1000;
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
    const mid = isFinite(t0) && isFinite(t1) && t1 > t0 ? (t0 + t1) / 2 : A.map((t) => t.opened).sort((x, y) => x - y)[A.length >> 1];
    const h1 = A.filter((t) => t.opened < mid), h2 = A.filter((t) => t.opened >= mid), e1 = mean(h1), e2 = mean(h2), e = mean(A);
    const neg = (h1.length && e1 < 0) || (h2.length && e2 < 0);
    out.push({ setup: k, kind: 'stability', value: neg ? 'unstable' : 'stable', n: A.length, exp: r2(e), h1: { n: h1.length, exp: r2(e1) }, h2: { n: h2.length, exp: r2(e2) }, flag: !!neg,
      why: `${k} under the live rule: ${fR(e)} a trade over ${A.length} replay trades; first half ${fR(e1)} (${h1.length}), second half ${fR(e2)} (${h2.length})${neg ? ': one half lost money, so the edge is not steady.' : ': positive in both halves.'}`, at });
  }
  return out;
}

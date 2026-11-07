// Futures tickets (7 Nov 2026, owner: "send orders from the council to TradingView", option 1 = one-tap alerts).
// TradingView does not take orders from other programs and its terms ban automating its site, so the council does not trade
// there itself: each phone alert for a gold or NQ trade carries a ready-made micro-futures ticket (contract month, contracts
// for the risk, stop / target as prices and as distances) and opens that contract's chart in TradingView, where the owner
// places the order by hand through the broker connected to TradingView.
// Sizing: repository variables FUT_ACCOUNT (account $, default 10,000) and FUT_RISK (% risked per trade, default 0.25).

const CODES = 'FGHJKMNQUVXZ';
export const FUT = {
  // COMEX micro gold: $10 per $1, tick 0.1; trades the even months, rolled a week before the delivery month starts
  xau: { root: 'MGC', ex: 'COMEX_MINI', name: 'micro gold', pv: 10, tick: 0.1, dec: 1 },
  // CME micro Nasdaq: $2 per point, tick 0.25; quarterly, rolled 8 days before the third-Friday expiry
  nq: { root: 'MNQ', ex: 'CME_MINI', name: 'micro Nasdaq', pv: 2, tick: 0.25, dec: 2 },
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// the contract to trade at unix time t: { y, m (1-12), code: 'MGCZ2026', tv: 'COMEX_MINI:MGCZ2026', label: 'Dec 26' }
export function contract(mk, t) {
  const F = FUT[mk]; if (!F) return null;
  const d = new Date(t * 1000);
  for (let k = 0; k < 15; k++) {
    const y = d.getUTCFullYear() + Math.floor((d.getUTCMonth() + k) / 12), m = ((d.getUTCMonth() + k) % 12) + 1;
    let roll;
    if (mk === 'xau') { if (m % 2) continue; roll = Date.UTC(y, m - 1, 1) / 1000 - 8 * 86400; }   // a week before the month before delivery ends
    else { if (m % 3) continue; const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), fri3 = 1 + ((5 - first + 7) % 7) + 14; roll = Date.UTC(y, m - 1, fri3) / 1000 - 8 * 86400; }
    if (t < roll) { const code = `${F.root}${CODES[m - 1]}${y}`; return { y, m, code, tv: `${F.ex}:${code}`, label: `${MON[m - 1]} ${String(y).slice(2)}` }; }
  }
  return null;
}

// the futures ticket for a council trade x (spot or futures levels) — null when the market has no futures mapping.
// basis = futures price − council price (gold: GC from the ICT desk minus spot); 0 when unknown (distances still hold).
export function ticket(x, t, { account = 10000, risk = 0.25, basis = null } = {}) {
  const F = FUT[x.market], c = F && contract(x.market, t); if (!c) return null;
  const s = x.side === 'sell' ? -1 : 1, dist = Math.abs(x.entry - x.stop); if (!(dist > 0)) return null;
  const riskUsd = (account * risk) / 100, per = dist * F.pv, n = Math.max(1, Math.floor(riskUsd / per)), realPct = (n * per / account) * 100;
  const fx = (v) => (+v).toLocaleString('en-US', { minimumFractionDigits: F.dec, maximumFractionDigits: F.dec });
  const ticks = (v) => Math.round(v / F.tick);
  // systems with a 2R mark then a trail (tp1) or trend legs have no fixed take-profit: the council sends the close
  const trailing = x.tp1 != null || x.k === 'trend' || /^gtrend/.test(x.k || '');
  const tgt = !trailing && x.t1 != null ? x.t1 : null, tdist = tgt != null ? Math.abs(tgt - x.entry) : null;
  const b = basis != null && isFinite(basis) ? basis : null, onF = (v) => (b != null ? fx(v + b) : null);
  const lim = x.status === 'pending';
  const head = `${lim ? `${x.side.toUpperCase()} LIMIT` : x.side.toUpperCase()} ${n} ${c.code} (${F.name}, ${c.label})`;
  const lines = [
    `${head}${lim && b != null ? ` at ${onF(x.entry)}` : ''}`,
    `Stop ${fx(dist)} pts ${s > 0 ? 'below' : 'above'} entry (${ticks(dist)} ticks)${b != null ? ` ≈ ${onF(x.stop)}` : ''}`,
    tgt != null ? `Target ${fx(tdist)} pts ${s > 0 ? 'above' : 'below'} (${ticks(tdist)} ticks)${b != null ? ` ≈ ${onF(tgt)}` : ''}`
      : x.tp1 != null ? `No take-profit: 2R mark ${fx(Math.abs(x.tp1 - x.entry))} pts ${s > 0 ? 'above' : 'below'}${b != null ? ` (≈ ${onF(x.tp1)})` : ''}, then the council trails and sends the close` : 'No fixed target: the council sends a close alert',
    `Risk ≈ $${Math.round(n * per).toLocaleString('en-US')} = ${realPct.toFixed(2)}% of $${account.toLocaleString('en-US')}${realPct > risk * 1.5 ? ' (1 contract is above the planned risk: consider skipping)' : ''}`,
  ];
  if (b != null && x.market === 'xau') lines.push(`Council levels are spot; futures ≈ spot ${b >= 0 ? '+' : '−'}${fx(Math.abs(b))}`);
  return { n, c, text: lines.join('\n'), url: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(c.tv)}` };
}

// the close ticket
export function closeTicket(x, t, sent) {
  const F = FUT[x.market], c = sent && sent.code ? sent : contract(x.market, t); if (!F || !c) return null;
  return { text: `CLOSE ${sent && sent.n ? sent.n + ' ' : ''}${c.code} now (${x.side === 'buy' ? 'sell' : 'buy'} to flat)`, url: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`${F.ex}:${c.code}`)}` };
}

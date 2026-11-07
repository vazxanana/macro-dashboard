// Council · Analyst helper: a short, data-built "Live Scalp rule check" section for analysis/latest.md.
// Reporting only: it reads snapshot.json, config.json and backtest.json and changes no rule or trade.
// The Trader refreshes the block on every run, between the markers below, so the Analyst's weekly text stays as written.

const START = '<!-- live-rule:start -->', END = '<!-- live-rule:end -->';
const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
const dir = (v) => v === 1 ? 'up' : v === -1 ? 'down' : 'flat';
const sgn = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);

export function liveRuleSection({ snapshot, config, backtest, now = Math.floor(Date.now() / 1000), k = 'scalp' }) {
  if (!snapshot || !snapshot.markets || !Object.keys(snapshot.markets).length || !config) return '';   // a run with no market data keeps the last block
  const f = (config.filters || {})[k] || {}, live = (config.focusSetups || []).includes(k);
  const sess = sessionOf(now), noSess = f.noSession || [];
  // the replay under the live rule: same conditions the Trader checks (D1, session), after costs, filled trades only
  const cols = backtest && !backtest.fake && backtest.tradeCols, rows = cols ? backtest.trades.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]]))) : [];
  const bt = rows.filter((t) => t.setup === k && t.fill !== 0 && t.R_none != null && (!f.d1 || t.d1 === f.d1) && !noSess.includes(t.session));
  const rule = [f.d1 ? `${f.d1} D1 only` : null, noSess.length ? `not in ${noSess.join('/')}` : null, (f.noMarket || []).length ? `skips ${f.noMarket.join(', ')}` : null].filter(Boolean).join(', ');
  const out = [START, '## Live Scalp rule check', '',
    `Built by the Trader at ${new Date(now * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC from snapshot, config and the ${backtest && backtest.days || '?'}-day replay. Rule now: Scalp (M15 → M1) ${rule || 'no filters'}${live ? '' : '. **Scalp is not live right now** (not in focusSetups), so nothing below trades live'}.`, '',
    `Session now: **${sess}**${noSess.includes(sess) ? ' — the rule skips it, so no live Scalp until it ends' : ''}.`, '',
    '| Market | D1 (source) | Live Scalp would | Scalp now | Replay, live rule |', '|---|---|---|---|---|'];
  let tot = [];
  for (const [key, m] of Object.entries(snapshot.markets)) {
    const d1 = m.trend && m.trend['1d'], ds = (snapshot.d1src || {})[key];
    const src = ds ? (ds.src === 'OANDA' ? `OANDA${ds.kraken != null && ds.kraken !== ds.trend ? `; Kraken says ${dir(ds.kraken)}` : ''}` : `Kraken${ds.why ? ', OANDA failed' : ''}`) : 'Kraken';
    const side = f.d1 === 'against' ? (d1 === 1 ? 'sell' : d1 === -1 ? 'buy' : null) : f.d1 === 'with' ? (d1 === 1 ? 'buy' : d1 === -1 ? 'sell' : null) : 'either';
    const block = [!live && 'not live', (f.noMarket || []).includes(key) && `rule skips ${m.label}`, (config.replicaLive || []).includes(key) && 'trades the replica instead',
      config.pausedMarkets && config.pausedMarkets[key] && 'market paused', config.paused && config.paused[k] && 'Scalp paused', f.off && 'Scalp off', noSess.includes(sess) && `${sess} session`, !side && 'no D1 trend'].filter(Boolean);
    const would = block.length ? `no (${block.join(', ')})` : side === 'either' ? 'buy or sell' : `**${side}** only`;
    const c = (m.setups || []).find((s) => s.k === k);
    const now_ = c ? `${c.state} ${c.side}${c.state === 'READY' && side !== 'either' && c.side !== side ? ' (blocked: wrong side)' : ''}` : '—';
    const a = bt.filter((t) => t.market === key);
    if (!(f.noMarket || []).includes(key) && !(config.replicaLive || []).includes(key)) tot = tot.concat(a);   // total: only markets the Scalp trades live
    const R = a.reduce((s, t) => s + t.R_none - (t.cost || 0), 0);
    const rep = a.length ? `${a.length} trades, ${Math.round(100 * a.filter((t) => t.R_none - (t.cost || 0) > 0).length / a.length)}% won, ${sgn(R / a.length)}R a trade` : 'no trades';
    out.push(`| ${m.label} | ${dir(d1)} (${src}) | ${would} | ${now_} | ${rep} |`);
  }
  const RT = tot.reduce((s, t) => s + t.R_none - (t.cost || 0), 0);
  out.push('', `Replay total on the markets it trades live: ${tot.length} trades, ${sgn(tot.length ? RT / tot.length : 0)}R a trade (${sgn(RT)}R), after spread. Each signal still has to clear reward:risk ≥ ${config.minRR}, the 2-trades-per-market cap and the 3-hour re-entry rule.`, END);
  return out.join('\n');
}

// put the section in the report: replace the old block, else insert it before "## Top 3 to watch", else append
export function injectSection(md, section) {
  if (!section) return md;
  const i = md.indexOf(START), j = md.indexOf(END);
  if (i >= 0 && j > i) return md.slice(0, i) + section + md.slice(j + END.length);
  const t = md.indexOf('\n## Top 3');
  return t >= 0 ? md.slice(0, t + 1) + section + '\n\n' + md.slice(t + 1) : md.replace(/\s*$/, '\n\n') + section + '\n';
}

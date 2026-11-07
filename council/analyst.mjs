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
  const bt = rows.filter((t) => t.setup === k && t.fill !== 0 && t.status !== 'open' && t.R_none != null && (!f.d1 || t.d1 === f.d1) && !noSess.includes(t.session));
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
export function injectSection(md, section, start = START, end = END) {
  if (!section) return md;
  const i = md.indexOf(start), j = md.indexOf(end);
  if (i >= 0 && j > i) return md.slice(0, i) + section + md.slice(j + end.length);
  const t = md.indexOf('\n## Top 3');
  return t >= 0 ? md.slice(0, t + 1) + section + '\n\n' + md.slice(t + 1) : md.replace(/\s*$/, '\n\n') + section + '\n';
}

// ---- Coach rule changes (reporting only): how often each Coach-owned rule moved in the last 7 days -------------------
// Research (research/edge/coach-learning) found the Coach's learning changes rules often and reverses itself without
// improving results. This block makes that visible to the owner; it changes nothing.
export const CHURN_START = '<!-- coach-churn:start -->', CHURN_END = '<!-- coach-churn:end -->';
const SESS = /\b(asia|london|overlap|newyork|late)\b/i;
export function churnSubject(change) {
  const c = String(change || '');
  if (/^minimum stop/i.test(c)) return 'Minimum stop';
  if (/^break-even/i.test(c)) return 'Break-even';
  const p = c.match(/^(?:Paused|Resumed) ([\w-]+)/); if (p) return `${p[1]} · pause`;
  const m = c.match(/^([\w-]+(?:, [\w-]+)*):\s*(.*)$/);
  if (!m) return c.replace(/\s*\(.*$/, '').slice(0, 60);
  if (/\bD1\b/.test(m[2])) return `${m[1]} · D1 rule`;
  const s = m[2].match(SESS); if (s && /session/i.test(m[2])) return `${m[1]} · ${s[1].toLowerCase()} session`;
  if (/break-even/i.test(m[2])) return `${m[1]} · break-even`;
  return `${m[1]} · ${m[2].replace(/\s*\(.*$/, '').slice(0, 40)}`;
}
export function coachChurnSection({ config, now = Math.floor(Date.now() / 1000), days = 7 }) {
  const h = ((config && config.history) || []).filter((x) => /^coach/.test(x.by || '') && Date.parse(x.at) / 1000 >= now - days * 86400);
  const by = new Map();
  for (const x of h.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) { const k = churnSubject(x.change); if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
  const out = [CHURN_START, '## Coach rule changes', '',
    `Built by the Trader at ${new Date(now * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC from the rule history. Rules the Coach changed by itself in the last ${days} days (owner rules are not counted).`, ''];
  if (!h.length) { out.push('No Coach rule changes in this period.', CHURN_END); return out.join('\n'); }
  out.push('| Rule | Changes | Steps (oldest first) |', '|---|---|---|');
  const rows = [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  let flips = 0;
  let ratchets = 0;
  for (const [k, xs] of rows) {
    // a numeric setting (e.g. "Minimum stop 0.6 → 0.7 ATR"): show the path, and say whether it only moved one way
    const nums = xs.map((x) => (String(x.change).match(/([\d.]+)\s*→\s*([\d.]+)/) || []).slice(1).map(Number));
    let steps, tag = '';
    if (nums.every((n) => n.length === 2)) {
      const path = [nums[0][0], ...nums.map((n) => n[1])], up = nums.every((n) => n[1] > n[0]), down = nums.every((n) => n[1] < n[0]);
      steps = `${path.join(' → ')} (${xs[0].at.slice(5, 10)} to ${xs[xs.length - 1].at.slice(5, 10)})`;
      if (xs.length >= 3 && (up || down)) { tag = ` **(${up ? 'up' : 'down'} every time)**`; ratchets++; } else if (xs.length >= 3) { tag = ' **(back and forth)**'; flips++; }
    } else {
      steps = xs.map((x) => `${x.at.slice(5, 10)} ${x.change.replace(/^[\w-]+(?:, [\w-]+)*:\s*/, '').replace(/\s*\(.*$/, '').slice(0, 48)}`).join(' → ');
      if (xs.length >= 3) { tag = ' **(back and forth)**'; flips++; }
    }
    out.push(`| ${k}${tag} | ${xs.length} | ${steps.replace(/\|/g, '/')} |`);
  }
  out.push('', `${h.length} changes on ${by.size} rules${flips ? `; ${flips} rule${flips > 1 ? 's' : ''} went back and forth 3+ times` : ''}${ratchets ? `; ${ratchets} setting${ratchets > 1 ? 's' : ''} only ever moved one way` : ''}. A rule that keeps moving is reacting to noise: the 150-day study found the Coach's choices do no better than dropping the same number of trades at random (research/edge/coach-learning).`, CHURN_END);
  return out.join('\n');
}

// ---- Desk & mirror status (reporting only): the ICT desk's last 7 days and the cTrader DEMO mirror --------------------
// The ICT desk is the edge that holds up after costs (research/edge/costs); its A-setups are what the demo mirror copies.
// Built from data/ict/trades.json, data/ict/shadow.json and data/ctrader/mirror.json as the previous round left them.
export const DESK_START = '<!-- desk-status:start -->', DESK_END = '<!-- desk-status:end -->';
const MKT = { nq: 'NQ', es: 'ES', ym: 'YM', rty: 'RTY', gc: 'Gold (GC)' };
export function deskSection({ ict = [], shadow = null, mirror = null, now = Math.floor(Date.now() / 1000), days = 7 }) {
  const since = now - days * 86400, T = (Array.isArray(ict) ? ict : []).filter((t) => (t.opened || 0) >= since);
  const A = T.filter((t) => t.aset), open = A.filter((t) => t.status === 'open'), closed = A.filter((t) => t.status !== 'open' && t.R != null);
  const R = closed.reduce((s, t) => s + t.R, 0), when = new Date(now * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const out = [DESK_START, '## Desk & mirror status', '', `Built by the Trader at ${when} UTC. ICT desk: the last ${days} days; mirror: the cTrader DEMO account (0.01 lot, demo only).`, '',
    `**ICT A-setups:** ${A.length} signal${A.length === 1 ? '' : 's'} (${open.length} open, ${closed.length} closed${closed.length ? `, ${sgn(R)}R, ${Math.round(100 * closed.filter((t) => t.R > 0).length / closed.length)}% won` : ''}); ${T.length - A.length} other signal${T.length - A.length === 1 ? '' : 's'} tracked, not A-setups.`];
  for (const t of open) out.push(`- open: ${MKT[t.market] || t.market} ${t.side} from ${t.entry}, stop ${t.stop} (${t.model || 'iFVG'}${t.aplus ? ', A+' : ''})`);
  const sh = shadow && Array.isArray(shadow.trades) ? shadow.trades.filter((t) => (t.opened || 0) >= since) : [];
  const shC = sh.filter((t) => t.status !== 'open' && t.R != null);
  out.push('', `**Dip-buy candidate (NQ/ES, paper only):** ${sh.length} signal${sh.length === 1 ? '' : 's'} in ${days} days${shC.length ? `, ${shC.length} closed ${sgn(shC.reduce((s, t) => s + t.R, 0))}R` : ''}${shadow && shadow.since ? ` · recording since ${String(shadow.since).slice(0, 10)}` : ''}.`);
  const st = mirror && mirror.state;
  if (!st) out.push('', '**cTrader mirror:** no status yet.');
  else {
    const op = Object.entries(st.map || {}).filter(([, m]) => m.status === 'open');
    out.push('', `**cTrader mirror:** ${st.status || '—'}${st.lastRun ? ` (checked ${String(st.lastRun).slice(0, 16).replace('T', ' ')} UTC)` : ''}.`);
    for (const [id, m] of op) out.push(`- open: ${m.symbol} ${m.side} ${m.setup || ''} (${id})${Number.isFinite(+m.slipR) ? ` · fill ${m.fillPrice} vs council ${m.councilEntry} (${sgn(m.slipR)}R slippage)` : ''}`);
    const x = mirror.execution;
    if (x && x.n) out.push('', `**Execution vs paper:** ${x.n} demo fill${x.n === 1 ? '' : 's'}; slippage against the council entry ${sgn(x.meanSlipR)}R on average (median ${sgn(x.medianSlipR)}R, worst ${sgn(x.worstSlipR)}R; positive = worse than paper)${x.medianLagSec != null ? `, median ${x.medianLagSec}s from council fill to demo order` : ''}.`);
    const L = ((mirror.log || []).slice(-5)).reverse();
    if (L.length) { out.push('', 'Last mirror events:'); for (const l of L) out.push(`- ${String(l.at).slice(5, 16).replace('T', ' ')} ${String(l.msg).replace(/\|/g, '/')}`); }
  }
  out.push(DESK_END);
  return out.join('\n');
}

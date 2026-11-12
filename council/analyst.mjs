// Council · Analyst helper: a short, data-built "Live Scalp rule check" section for analysis/latest.md.
// Reporting only: it reads snapshot.json, config.json and backtest.json and changes no rule or trade.
// The Trader refreshes the block on every run, between the markers below, so the Analyst's weekly text stays as written.
import { eventsBetween } from './events.mjs';
import { moshaChainText } from './mosha.mjs';
import { ownStream } from './fills.mjs';

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
    const R = a.reduce((s, t) => s + t.R_none - (t.cost || 0) - (t.fin || 0), 0);
    const rep = a.length ? `${a.length} trades, ${Math.round(100 * a.filter((t) => t.R_none - (t.cost || 0) - (t.fin || 0) > 0).length / a.length)}% won, ${sgn(R / a.length)}R a trade` : 'no trades';
    out.push(`| ${m.label} | ${dir(d1)} (${src}) | ${would} | ${now_} | ${rep} |`);
  }
  const RT = tot.reduce((s, t) => s + t.R_none - (t.cost || 0) - (t.fin || 0), 0);
  out.push('', `Replay total on the markets it trades live: ${tot.length} trades, ${sgn(tot.length ? RT / tot.length : 0)}R a trade (${sgn(RT)}R), after spread and overnight financing on gold buys. Each signal still has to clear reward:risk ≥ ${config.minRR}, the 2-trades-per-market cap and the 3-hour re-entry rule.`, END);
  return out.join('\n');
}

// put the section in the report: replace the old block, else insert it before "## Top 3 to watch", else append
export function injectSection(md, section, start = START, end = END) {
  if (!section) return md;
  const i = md.indexOf(start), j = i >= 0 ? md.indexOf(end, i) : -1;
  if (i >= 0 && j > i) return md.slice(0, i) + section + md.slice(j + end.length);
  // a lone marker (its partner lost to a cut-short write or a hand edit) is dropped, so the next round's replace cannot swallow
  // everything between it and the new block (9 Nov: an orphan start before the Analyst's weekly text would have taken it)
  if (md.includes(start) || md.includes(end)) md = md.split(start).join('').split(end).join('');
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

// ---- Replay fidelity (Analyst, 7 Nov) ------------------------------------------------------------------------------------
// research/fidelity.json (council/fidelity.mjs, written after each replay) was read by nobody. The Analyst reports it: how often
// the replay finds the live signals, on the same price feed and overall (with the main reasons for misses), whether the results
// agree, which feed each market's replay used, and gaps in the live loop. Reporting only.
export const FID_START = '<!-- fidelity:start -->', FID_END = '<!-- fidelity:end -->';
const pct = (x) => (Number.isFinite(+x) ? `${Math.round(100 * x)}%` : 'n/a');
export function fidelitySection({ fid = null, now = Math.floor(Date.now() / 1000) }) {
  const out = [FID_START, '## Replay fidelity'];
  if (!fid || !fid.counts) { out.push('', 'No fidelity check yet (research/fidelity.json is written after each nightly replay).', FID_END); return out.join('\n'); }
  const w = fid.window || {}, c = fid.counts, m = fid.matchRate || {}, sf = fid.sameFeed || {}, o = (fid.agreement || {}).outcome || {};
  const age = fid.at ? Math.round((now - Date.parse(fid.at) / 1000) / 3600) : null;
  out.push('', `Checked ${String(fid.at || '').slice(0, 16).replace('T', ' ')} UTC${age != null && age >= 30 ? ` (**${age} h old**: the replay has not refreshed it)` : ''}; live signals ${String(w.from || '').slice(0, 10)} to ${String(w.to || '').slice(0, 10)}.`, '');
  if (sf.live) out.push(`- **Same price feed** (the fair test): the replay found ${pct(sf.liveInReplay)} of ${sf.live} live signals; on ${sf.bothClosed || 0} closed pairs the result had the same sign ${pct(sf.signRate)} of the time (live ${sgn(sf.meanLiveR)}R vs replay ${sgn(sf.meanReplayR)}R a trade before costs).`);
  out.push(`- **All markets:** ${pct((m.comparable || {}).liveInReplay ?? m.liveInReplay)} of comparable live signals found (${c.matched} matched of ${c.comparableLive ?? c.live}); outcome sign agrees ${pct(o.signRate)} on ${o.bothClosed || 0} closed pairs.`);
  const rs = ((fid.unmatchedLive || {}).reasons || []).slice(0, 3);
  if (rs.length) out.push(`- **Why live signals were missed:** ${rs.map((r) => `${r.cls} ${r.n}`).join(', ')} (of ${(fid.unmatchedLive || {}).n}).`);
  const feeds = Object.entries(fid.perMarket || {}).map(([k, v]) => `${k} ${v.replayFeed || '?'}${v.liveFeeds ? ` / live ${Object.keys(v.liveFeeds).join('+')}` : ''}`);
  if (feeds.length) out.push(`- **Feeds (replay / live):** ${feeds.join(' · ')}.`);
  const gaps = (fid.liveRunGaps || []).filter((g) => Date.parse(g.to) / 1000 >= now - 2 * 86400);
  out.push(gaps.length ? `- **Live loop gaps (48 h):** ${gaps.map((g) => `${String(g.from).slice(5, 16).replace('T', ' ')} for ${g.hours} h`).join(', ')}: no live signals were possible then.` : '- **Live loop gaps (48 h):** none.');
  out.push(FID_END);
  return out.join('\n');
}

// ---- Loss post-mortems (Analyst, 7 Nov) -------------------------------------------------------------------------------
// Every closed losing LIVE paper trade gets a short post-mortem built only from recorded facts: what price did after the
// entry (MFE / MAE in R, time to the stop), what it did after the stop (did it come back to the target: stop too tight?),
// whether the entry or the stop sat near a session open or high-impact news, and the higher-timeframe trends at entry.
// Tags (hunt / noise / late / news, the owner's review tags) are set only where the evidence clearly supports them.
// Stored in reviews/analyst.json, written only by the Trader round, so it never races the page's whole-file writes to
// reviews/losses.json. The Trader's lesson rules read the owner's tags first and fall back to these (owner reviews win).
// Reporting and tags only: nothing here opens, closes or changes a trade or a rule.
export const PM_VERSION = 1;
export const PM_START = '<!-- postmortems:start -->', PM_END = '<!-- postmortems:end -->';
const TF = { '1d': 'D1', '4h': 'H4', '1h': 'H1' };
const r2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const dur = (sec) => { const m = Math.max(0, Math.round(sec / 60)); return m < 90 ? `${m} min` : m < 48 * 60 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} days`; };
const hm = (t) => new Date(t * 1000).toISOString().slice(11, 16);
const trendWord = (v) => v === 1 ? 'up' : v === -1 ? 'down' : 'flat';

// UTC offset (ms) of an IANA zone at instant ms
function zoneOffset(tz, ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
// Session opens in local time (daylight saving moves them in UTC), weekdays only
export const OPENS = [['Tokyo open', 'Asia/Tokyo', 9, 0], ['London open', 'Europe/London', 8, 0], ['New York open', 'America/New_York', 8, 0], ['US cash open', 'America/New_York', 9, 30]];
export function opensNear(t, within = 1800) {
  const out = [], seen = new Set();
  for (const [name, tz, h, m] of OPENS) for (const dd of [-1, 0, 1]) {
    const ms = t * 1000 + dd * 86400e3, loc = new Date(ms + zoneOffset(tz, ms));
    if (loc.getUTCDay() === 0 || loc.getUTCDay() === 6) continue;
    const wall = Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate(), h, m), ot = (wall - zoneOffset(tz, wall - zoneOffset(tz, wall))) / 1000;
    if (Math.abs(t - ot) <= within && !seen.has(name + ot)) { seen.add(name + ot); out.push({ name, t: ot, mins: Math.round((t - ot) / 60) }); }
  }
  return out.sort((a, b) => Math.abs(a.mins) - Math.abs(b.mins));
}
const relOpen = (o, what) => `${what} ${Math.abs(o.mins)} min ${o.mins >= 0 ? 'after' : 'before'} the ${o.name} (${hm(o.t)} UTC)`;

// News around a trade (30 min before the fill to 5 min after the stop): the official calendar in council/events.mjs (tier 1 =
// CPI / NFP / FOMC / PCE, cb = ECB / BoJ, tier 2 = ISM / claims) for the market's currencies, plus the ForexFactory high-impact
// news the Trader's review recorded (pm.news); a recorded item within 15 min of a calendar one is the same release.
export function newsAround(tr, from, to) {
  const cur = String(tr.label || '').includes('/') ? String(tr.label).split('/') : ['USD'];
  const cal = eventsBetween(from, to, { country: cur }).map((e) => ({ t: e.t, title: e.title, country: e.country, tier: e.tier }));
  const rec = (Array.isArray(tr.pm && tr.pm.news) ? tr.pm.news : []).filter((e) => !cal.some((c) => Math.abs(c.t - e.t) <= 900));
  return [...cal, ...rec].sort((a, b) => a.t - b.t);
}

// One post-mortem. `events` (optional): [{ t, title, impact, country, tier? }] to use instead of the calendar + recorded news.
export function postMortem(tr, { events = null } = {}) {
  const s = tr.side === 'sell' ? -1 : 1, pm = tr.pm || {}, a = pm.phase === 'done' ? pm.after : null, c = tr.ctx || {};
  const fill = tr.filled || tr.opened, closed = tr.closed, mfe = Math.max(0, +tr.mfe || 0), lossR = Math.abs(tr.R != null ? +tr.R : -1);
  const tags = new Set(), lines = [], ev = { mfeR: +r2(mfe), maeR: +r2(Math.max(lossR, +tr.mae || 0)), toStopMin: Math.round((closed - fill) / 60) };
  const finds = [];   // [rank, title]: the lowest rank is the headline
  // 1. after the entry
  lines.push(`After the entry: best +${r2(mfe)}R (MFE), worst −${r2(ev.maeR)}R (MAE); stopped ${dur(closed - fill)} after the fill.`);
  const gap = +tr.gapR || +pm.gap || 0;
  if (gap > 0) { ev.gapR = gap; lines.push(`The stop candle gapped: filled ${r2(gap)}R past the stop.`); }
  if (Number.isFinite(tr.Rnet) && tr.Rnet !== tr.R) ev.Rnet = tr.Rnet;
  if (mfe >= 1) finds.push([4.2, `Was +${r2(mfe)}R, then stopped`]);
  // 2. after the stop: did price come back to the target?
  if (a) {
    const watch = (pm.until || closed) - closed;
    ev.after = { bestR: a.best, worstR: a.worst, watchH: +(watch / 3600).toFixed(1), hitT1: a.hitT1 || null };
    if (a.hitT1 != null) {
      const past = Math.max(0, (a.worstPre != null ? a.worstPre : a.worst) - 1);
      ev.after.pastStopR = +r2(past); ev.after.toTargetH = +((a.hitT1 - closed) / 3600).toFixed(1);
      if (past <= 0.6) {
        tags.add('hunt'); finds.push([1, 'Stop swept, then the target']);
        lines.push(`After the stop price went only ${r2(past)}R past it, then reached the target ${dur(a.hitT1 - closed)} later: the direction was right and the stop sat where the market swept (stop too tight or too obvious).`);
      } else lines.push(`Price reached the target ${dur(a.hitT1 - closed)} after the stop, but only after going ${r2(past)}R past the stop: a stop wide enough to survive that would have shrunk the trade a lot, so this is not tagged a stop hunt.`);
    } else {
      lines.push(`In the ${dur(watch)} after the stop price did not reach the target (best +${r2(a.best)}R, worst −${r2(a.worst)}R from the entry).`);
      if (mfe < 0.3 && a.worst >= 2) { finds.push([6, 'Wrong direction; the stop did its job']); lines.push('It never went for the trade and carried on 2R+ against it: the read of direction was wrong, not the stop.'); }
    }
  } else lines.push('What price did after the stop was not recorded, so stop placement is not judged.');
  // 3. timing: session opens and news
  const oE = opensNear(fill)[0], oS = opensNear(closed)[0];
  ev.opens = [oE && { at: 'entry', name: oE.name, mins: oE.mins }, oS && { at: 'stop', name: oS.name, mins: oS.mins }].filter(Boolean);
  if (oE || oS) lines.push([oE && relOpen(oE, 'Entry'), oS && relOpen(oS, oE ? 'stopped' : 'Stopped')].filter(Boolean).join('; ') + '.');
  else lines.push('No session open within 30 min of the entry or the stop.');
  const news = Array.isArray(events) ? events.filter((e) => (!e.impact || e.impact === 'High') && e.t >= fill - 1800 && e.t <= closed + 300) : newsAround(tr, fill - 1800, closed + 300);
  if (news && news.length) {
    ev.news = news.map((e) => ({ t: e.t, title: `${e.country ? e.country + ' ' : ''}${e.title}` }));
    // tagged only when the stop came within 2 h of a major release (tier 2 calendar items, ISM / jobless claims, are listed only)
    const hit = news.filter((e) => e.tier !== 2 && e.t >= fill - 1800 && e.t <= closed && closed - e.t <= 7200);
    if (hit.length) { tags.add('news'); finds.push([2, 'News during the trade']); }
    lines.push(`High-impact news: ${news.map((e) => `${e.country ? e.country + ' ' : ''}${e.title} at ${hm(e.t)} UTC (${e.t <= closed ? `${dur(closed - e.t)} before the stop` : 'after the stop'})`).join('; ')}${hit.length ? '' : '; no major release within 2 h before the stop, so it is not tagged news'}.`);
  } else lines.push('No high-impact news for its currencies from 30 min before the fill to the stop.');
  // 4. stop size and entry timing
  if ((c.stopAtr != null && c.stopAtr < 0.5) || (c.stopSpreads != null && c.stopSpreads < 5)) { tags.add('noise'); finds.push([3, 'Stop inside normal noise']); lines.push(`The stop was ${c.stopAtr}× ATR (${c.stopSpreads} spreads) from the entry: inside one normal candle.`); }
  else if (c.stopAtr != null) lines.push(`The stop was ${c.stopAtr}× ATR from the entry, outside normal candle noise.`);
  if (pm.slip != null && pm.slip < -0.25) { tags.add('late'); finds.push([4, 'Late entry']); lines.push(`Filled ${r2(-pm.slip)}R worse than the planned entry: the move had started without it.`); }
  else if (c.sigAge != null && c.sigAge > 8) { tags.add('late'); finds.push([4, 'Late entry']); lines.push(`The signal was ${c.sigAge} candles old at the entry.`); }
  // 5. higher-timeframe structure at entry
  const t0 = c.trend || null, retrace = /^r/.test(tr.k || '');
  if (t0) {
    const ks = ['1d', '4h', '1h'].filter((k) => t0[k] != null), against = ks.filter((k) => t0[k] === -s);
    ev.htf = Object.fromEntries(ks.map((k) => [TF[k], t0[k]])); ev.htfAgainst = against.map((k) => TF[k]);
    lines.push(`Higher timeframes at entry: ${ks.map((k) => `${TF[k]} ${trendWord(t0[k])}`).join(', ')}. ${against.length ? `The ${tr.side} was against ${against.map((k) => TF[k]).join(' and ')}${retrace ? ' (a retracement setup trades against the higher trend by design)' : ''}.` : 'None was against the trade, so structure was not the problem.'}`);
    if (!retrace && t0['1d'] === -s) finds.push([4.5, 'Against the D1 trend']);
  } else if (tr.feat && tr.feat.d1) {
    ev.htfAgainst = tr.feat.d1 === 'against' ? ['D1'] : [];
    lines.push(`D1 at entry: ${tr.feat.d1} the trade${retrace && tr.feat.d1 === 'against' ? ' (by design for a retracement setup)' : ''}.`);
    if (!retrace && tr.feat.d1 === 'against') finds.push([4.5, 'Against the D1 trend']);
  }
  const title = (finds.sort((x, y) => x[0] - y[0])[0] || [9, 'Ordinary loss'])[1];
  return { id: tr.id, k: tr.k, name: tr.name, pair: tr.pair, h: tr.h, market: tr.market, label: tr.label, side: tr.side, R: tr.R, entry: tr.entry, stop: tr.stop, t1: tr.t1,
    opened: tr.opened, closed, shadow: false, feat: tr.feat || {}, by: 'analyst', av: PM_VERSION, tags: [...tags].sort(), title, text: lines.join(' ').slice(0, 4000), evidence: ev };
}

// All live losses → { reviews, changed }. A post-mortem is written once the Trader's after-exit watch is done (or, for a trade
// with no review, 5 days after the stop) and keeps its `at` unless its findings change. A post-mortem whose trade is gone from
// trades.json is kept; a loss that was reopened (bad-print repair) loses it.
export function analystReviews({ trades = [], prev = {}, now = Math.floor(Date.now() / 1000), events = null }) {
  const out = {}, P = prev || {}, ids = new Set(trades.map((x) => x && x.id));
  let changed = false;
  for (const [id, r] of Object.entries(P)) if (!ids.has(id)) out[id] = r;
  for (const x of trades) {
    if (!x || x.shadow || x.replay || x.status !== 'loss' || !x.closed) continue;
    const p = P[x.id];
    if (!((x.pm && x.pm.phase === 'done') || (!x.pm && now - x.closed > 5 * 86400))) { if (p) out[x.id] = p; continue; }
    const r = postMortem(x, { events });
    if (p && p.av === r.av && p.text === r.text && (p.tags || []).join() === r.tags.join()) out[x.id] = p;
    else { out[x.id] = { ...r, at: now }; changed = true; }
  }
  if (Object.keys(P).some((id) => !out[id])) changed = true;
  return { reviews: out, changed };
}

// The report block: post-mortems of the last `days` days, tag counts, and how the tags compare with the owner's reviews
export function postMortemSection({ reviews = {}, owner = {}, now = Math.floor(Date.now() / 1000), days = 7 }) {
  const all = Object.values(reviews || {}).filter(Boolean), R = all.filter((r) => r.closed && now - r.closed < days * 86400).sort((a, b) => b.closed - a.closed);
  const last = all.reduce((m, r) => Math.max(m, r.at || 0), 0), O = owner || {};
  const out = [PM_START, '## Loss post-mortems', '',
    `Built by the Analyst${last ? ` (last post-mortem ${new Date(last * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC)` : ''} from the live paper losses of the last ${days} days, once the Trader has watched what price did after the stop. Tags (hunt / noise / late / news) are set only when the evidence is clear; where the owner reviewed a loss, the owner's tags count instead.`, ''];
  if (!R.length) { out.push(`No live loss with a finished post-mortem in the last ${days} days.`, PM_END); return out.join('\n'); }
  const tc = {}; R.forEach((r) => ((r.tags || []).length ? r.tags : ['none']).forEach((t) => { tc[t] = (tc[t] || 0) + 1; }));
  out.push(`**${R.length} loss${R.length === 1 ? '' : 'es'}:** ${Object.entries(tc).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t === 'none' ? 'no clear tag' : t} ${n}`).join(', ')}.${R.length < 10 ? ' Small sample: read these as single cases, not a pattern.' : ''}`, '',
    '| Closed (UTC) | Trade | Finding | Tags | MFE; after the stop | Timing | HTF against |', '|---|---|---|---|---|---|---|');
  for (const r of R.slice(0, 15)) {
    const e = r.evidence || {}, a = e.after, o = (e.opens || [])[0], ow = O[r.id] && !O[r.id].draft ? O[r.id] : null;
    const after = a ? (a.hitT1 ? `target ${a.toTargetH} h later, ${a.pastStopR}R past the stop first` : `no target in ${a.watchH} h`) : 'not watched';
    const timing = [o && `${o.at} ${Math.abs(o.mins)} min ${o.mins >= 0 ? 'after' : 'before'} ${o.name}`, e.news && e.news.length && `news: ${e.news.map((n) => n.title).join(', ')}`].filter(Boolean).join('; ') || '—';
    out.push(`| ${new Date(r.closed * 1000).toISOString().slice(5, 16).replace('T', ' ')} | ${r.label} ${r.name} ${r.side} | ${r.title} | ${(r.tags || []).join(', ') || '—'}${ow ? ` (owner: ${(ow.tags || []).join(', ') || 'no tags'})` : ''} | +${r2(e.mfeR || 0)}R; ${after} | ${timing.replace(/\|/g, '/')} | ${(e.htfAgainst || []).join(', ') || 'none'} |`);
  }
  if (R.length > 15) out.push('', `${R.length - 15} older post-mortems of this period are in reviews/analyst.json.`);
  const both = R.filter((r) => O[r.id] && !O[r.id].draft), K = ['hunt', 'noise', 'late', 'news'];
  if (both.length) {
    const agree = both.filter((r) => K.every((t) => (r.tags || []).includes(t) === (O[r.id].tags || []).includes(t))).length;
    out.push('', `**Owner check:** the owner reviewed ${both.length} of these; on the four shared tags the Analyst matched the owner on ${agree} of ${both.length}.`);
  }
  out.push(PM_END);
  return out.join('\n');
}

// ---- What changed (daily): which setups are improving or decaying --------------------------------------------------
// Rolling last-N expectancy per setup against its whole record, on every closed paper trade of the setup (live and shadow:
// shadow trades are signals the rules blocked, followed on paper). The change is tested last N vs the trades before them
// (Welch t). Nothing is called an edge without its n and t; small samples are marked as such.
export const WC_START = '<!-- what-changed:start -->', WC_END = '<!-- what-changed:end -->';
export function stats(a) {
  const n = a.length; if (!n) return { n: 0, mean: 0, sd: 0, t: 0, wr: 0 };
  const m = a.reduce((s, x) => s + x, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sd, t: sd > 0 ? m / (sd / Math.sqrt(n)) : 0, wr: a.filter((x) => x > 0).length / n };
}
export function welchT(a, b) {
  const A = stats(a), B = stats(b), se = Math.sqrt((A.n > 1 ? A.sd ** 2 / A.n : 0) + (B.n > 1 ? B.sd ** 2 / B.n : 0));
  return se > 0 ? (A.mean - B.mean) / se : 0;
}
export function edgeWords(st) {
  const nt = `n ${st.n}, t ${st.t.toFixed(1)}`;
  if (st.n < 30) return `too few trades to judge an edge (${nt})`;
  if (st.t >= 2) return `positive and unlikely to be luck (${nt}), on paper`;
  if (st.t <= -2) return `reliably losing (${nt})`;
  return `no proven edge (${nt})`;
}
const pc = (x) => `${Math.round(100 * x)}%`;
// Plain-language reasons: the win rate, then the bucket (session / D1 side / market) whose share × result moved the mean most
export function changeReasons(rec, pri) {
  const S = (a) => a.reduce((s, x) => s + x.R, 0), d = S(rec) / rec.length - S(pri) / pri.length;
  const out = [`won ${pc(stats(rec.map((x) => x.R)).wr)} of the last ${rec.length} (was ${pc(stats(pri.map((x) => x.R)).wr)})`];
  let best = null;
  for (const f of [(x) => x.feat && x.feat.session && `${x.feat.session} session`, (x) => x.feat && x.feat.d1 && `${x.feat.d1}-D1 trades`, (x) => x.label || x.market]) {
    const B = new Set([...rec, ...pri].map(f).filter(Boolean));
    if (B.size < 2) continue;   // one value for every trade explains nothing
    for (const b of B) {
      const r = rec.filter((x) => f(x) === b), p = pri.filter((x) => f(x) === b), diff = S(r) / rec.length - S(p) / pri.length;
      if (Math.sign(diff) !== Math.sign(d) || r.length + p.length < 3) continue;
      if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { b, diff, r, p };
    }
  }
  const avg = (a) => `${sgn(S(a) / a.length)}R a trade`;
  if (best) out.push(!best.r.length ? `biggest mover: no ${best.b} in the last ${rec.length} (was ${pc(best.p.length / pri.length)} of trades, at ${avg(best.p)})`
    : `biggest mover: ${best.b}, ${best.r.length} of the last ${rec.length} (was ${pc(best.p.length / pri.length)} of trades) at ${avg(best.r)} (was ${best.p.length ? avg(best.p) : 'none'})`);
  return out;
}
export function whatChangedSection({ trades = [], now = Math.floor(Date.now() / 1000), win = 20 }) {
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  // after costs (Rnet, council/fills.mjs) where the Trader recorded them, else the raw R
  const C = trades.filter((x) => x && !x.replay && ['win', 'loss', 'be'].includes(x.status) && Number.isFinite(x.R) && x.closed && x.closed <= now)
    .map((x) => (Number.isFinite(x.Rnet) ? { ...x, R: x.Rnet, net: true } : x)).sort((a, b) => a.closed - b.closed);
  const nNet = C.filter((x) => x.net).length;
  const by = new Map(); for (const x of C) { if (!by.has(x.k)) by.set(x.k, []); by.get(x.k).push(x); }
  const d24 = C.filter((x) => x.closed > now - 86400), l24 = d24.filter((x) => !x.shadow), sum = (a) => a.reduce((s, x) => s + x.R, 0);
  const out = [WC_START, '## What changed', '',
    `Daily, for ${day} (UTC). Each setup's last ${win} closed paper trades (live and shadow) against its whole record, in R ${nNet === C.length && C.length ? 'after costs' : nNet ? `after costs for ${nNet} of ${C.length} trades (raw R for the rest)` : 'before costs (raw R)'}. The change is tested last ${win} vs the trades before them (Welch t): |t| under 1 is noise, 1 to 2 a weak sign, 2 or more (with 20+ earlier trades) a fair one. Nothing here is an edge unless its n and t say so.`, '',
    `**Last 24 h:** ${d24.length} trade${d24.length === 1 ? '' : 's'} closed (${l24.length} live), ${sgn(sum(d24))}R (live ${sgn(sum(l24))}R).`, '',
    `| Setup | Trades (live) | All-time R a trade | Last ${win} | ${win} as of 24 h ago | Change | Confidence |`, '|---|---|---|---|---|---|---|'];
  const notes = [], rows = [];
  for (const [k, a] of by) {
    const all = stats(a.map((x) => x.R)), name = a[a.length - 1].name || k, live = a.filter((x) => !x.shadow).length;
    const rec = a.slice(-win), pri = a.slice(0, -win), rs = stats(rec.map((x) => x.R));
    const old = a.filter((x) => x.closed <= now - 86400).slice(-win), os = old.length >= win ? stats(old.map((x) => x.R)) : null;
    let change = 'too few to compare', conf = `small sample (n ${a.length})`;
    if (pri.length >= 10) {
      const tW = welchT(rec.map((x) => x.R), pri.map((x) => x.R));
      const lvl = Math.abs(tW) >= 2 && pri.length >= 20 ? 'fair' : Math.abs(tW) >= 1 ? 'low' : 'none';
      change = lvl === 'none' ? 'steady (within noise)' : tW > 0 ? '**improving**' : '**decaying**';
      conf = lvl === 'none' ? `none (t ${tW.toFixed(1)})` : `${lvl} (t ${tW.toFixed(1)}, ${win} vs ${pri.length})`;
      if (lvl !== 'none') notes.push({ w: Math.abs(tW), s: `- **${name}** (${k}) is ${tW > 0 ? 'improving' : 'decaying'}: ${sgn(rs.mean)}R a trade over the last ${win} vs ${sgn(stats(pri.map((x) => x.R)).mean)}R before; ${changeReasons(rec, pri).join('; ')}. Confidence ${lvl} (t ${tW.toFixed(1)}). Whole record: ${edgeWords(all)}.` });
    }
    rows.push({ n: a.length, s: `| ${name} (${k}) | ${a.length} (${live}) | ${sgn(all.mean)} (t ${all.t.toFixed(1)}) | ${rec.length >= win ? sgn(rs.mean) : `${sgn(rs.mean)} (only ${rec.length})`} | ${os ? sgn(os.mean) : '—'} | ${change} | ${conf} |` });
  }
  if (!rows.length) out.push('| — | 0 | — | — | — | no closed trades | — |');
  rows.sort((x, y) => y.n - x.n).forEach((r) => out.push(r.s));
  out.push('', notes.length ? '**Why:**' : `No setup moved beyond noise over its last ${win} trades.`);
  notes.sort((x, y) => y.w - x.w).forEach((x) => out.push(x.s));
  const edges = [...by].map(([k, a]) => [k, stats(a.map((x) => x.R))]).filter(([, st]) => st.n >= 30 && st.t >= 2);
  out.push('', edges.length ? `**Edge check:** ${edges.map(([k, st]) => `${k} ${sgn(st.mean)}R a trade (n ${st.n}, t ${st.t.toFixed(1)})`).join('; ')}: positive with t ≥ 2 on paper (${nNet === C.length ? 'after modelled costs' : 'partly before costs'}); live fills can still differ.` : '**Edge check:** no setup has a positive record with n ≥ 30 and t ≥ 2, so none is claimed as an edge.', WC_END);
  return out.join('\n');
}

// Both Analyst blocks into the report: "What changed" is rebuilt once a UTC day, the post-mortem block whenever it changes.
export function analystSections(md, { trades = [], reviews = {}, owner = {}, now = Math.floor(Date.now() / 1000) }) {
  if (typeof md !== 'string') return md;
  const day = new Date(now * 1000).toISOString().slice(0, 10), i = md.indexOf(WC_START), j = md.indexOf(WC_END);
  let nx = injectSection(md, postMortemSection({ reviews, owner, now }), PM_START, PM_END);
  if (!(i >= 0 && j > i && md.slice(i, j).includes(`for ${day} (UTC)`))) nx = injectSection(nx, whatChangedSection({ trades, now }), WC_START, WC_END);
  return nx;
}

// ---- Live gold systems now (Analyst, 8 Nov) ------------------------------------------------------------------------------
// The "Live Scalp rule check" block describes a system the owner moved to shadow on 7 Nov, and nothing in the report said
// where the systems that ARE live stand. One data-built row per Meridian system from the Trader's own snapshot blocks
// (goldVol / goldW1, moshaBo, goldTrend, goldTrendFast, goldTL, goldEG, goldMP) and the live record: whether it is live, what it
// is waiting for right now, and what it has on. Reporting only: nothing here changes a rule or a trade.
export const GOLD_START = '<!-- gold-systems:start -->', GOLD_END = '<!-- gold-systems:end -->';
const px2 = (v) => (Number.isFinite(+v) ? (+v).toFixed(2) : '—');
export function goldSystemsSection({ snapshot, config, trades = [], research = [], now = Math.floor(Date.now() / 1000) }) {
  if (!snapshot || !config) return '';
  const sn = snapshot, T = Array.isArray(trades) ? trades : [], when = new Date(now * 1000).toISOString().slice(0, 16).replace('T', ' ');
  // supported-book (owner, 11 Nov 2026): config.ownerShadow[k] = the system's new trades are paper shadows; book() says so, on()
  // counts its own stream (live trades from before, owner-shadow / test trades after: fills.mjs ownStream)
  const OS = config.ownerShadow || {}, book = (k, isOn) => (!isOn ? 'off' : OS[k] ? 'shadow (paper, owner 11 Nov)' : 'live');
  const on = (k) => { const L = T.filter((x) => x.k === k && x.market === 'xau' && ownStream(x)); const o = L.filter((x) => x.status === 'open').length, p = L.filter((x) => x.status === 'pending').length;
    return !o && !p ? 'nothing on' : [o ? `${o} open` : '', p ? `${p} pending` : ''].filter(Boolean).join(', '); };
  const st = (k) => (sn[k] && sn[k].state) || null, blocked = (x) => (x && x.blocked ? ` (blocked: ${x.blocked})` : '');
  const rows = [];
  // Gold replica: the volatility gate (the fixed leg goldVolMin when set, else the top-fifth percentile goldVolP; the lower opens it)
  { const live = (config.replicaLive || []).includes('xau'), legs = [sn.goldVolMin, sn.goldVolP].filter((v) => v != null), gate = legs.length ? Math.min(...legs) : null;
    const v = sn.goldVol, what = v == null ? 'volatility not read yet' : gate == null ? `20-day average daily range ${v.toFixed(2)}%` : v >= gate ? `gate open: ${v.toFixed(2)}% average daily range, gate ${gate.toFixed(2)}%` : `gate closed: ${v.toFixed(2)}% average daily range under the ${gate.toFixed(2)}% gate, so no new replica trade`;
    rows.push(['Gold replica', book('replica', live), what, on('replica')]); }
  // Mosha BO: the H4 -> H1 -> M15 chain (snapshot.moshaBo.state, council/mosha.mjs) and the weekly direction
  { const m = st('moshaBo'), w = sn.goldW1;
    const what = !config.moshaBo ? '—' : m ? moshaChainText(m, w).replace(/^Mosha BO chain(?: complete)?: /, '') : w == null ? 'waiting for the Trader' : `weekly structure ${w > 0 ? 'bullish: buys only' : 'bearish: sells only'}`;
    rows.push(['Mosha BO', book('mosha-bo', config.moshaBo), what, on('mosha-bo')]); }
  // Mosha cycle: H4 move, H1 ChoCh = the pullback, M15 / M5 trade the pullback then the ChoCh back (snapshot.moshaCycle, council/mosha-cycle.mjs)
  { const c = sn.moshaCycle, what = !config.moshaCycle ? '—' : c && c.text ? c.text.replace(/^Mosha cycle: /, '') : 'waiting for the Trader';
    rows.push(['Mosha cycle', book('mcycle', config.moshaCycle), what, on('mcycle')]); }
  // Gold trend (N-day breakout, long only): a daily close above the N-day high enters; the state has the high and the last close
  for (const [name, key, cfgKey, k, sh] of [['Gold trend', 'goldTrend', 'goldTrend', 'gtrend', false], ['Gold trend fast', 'goldTrendFast', 'goldTrendFast', 'gtrend5', !!config.goldTrendFastShadow]]) {
    const c = config[cfgKey], x = st(key); if (!c) { rows.push([name, 'off', '—', '—']); continue; }
    const what = !x ? 'waiting for the Trader' : x.open ? `in a trade, stop ${px2(x.stop)}` : x.hi20 == null ? 'not enough daily candles yet' : `waiting for a daily close above the ${c.n}-day high ${px2(x.hi20)} (last close ${px2(x.lastClose)})`;
    rows.push([name, sh ? 'shadow' : 'live', what, sh ? 'paper only' : on(k)]); }
  // Gold H4 trendline: a falling line through two H4 pivot highs; an H4 close above it (H4 direction up) buys
  { const x = st('goldTL'), what = !config.goldTL ? '—' : !x ? 'waiting for the Trader' : x.open ? `in a trade, stop ${px2(x.stop)}` : x.line ? `falling H4 line at ${px2(x.line)}; waiting for an H4 close above it${blocked(x)}` : `no falling H4 trendline through two pivot highs right now${blocked(x)}`;
    rows.push(['Gold H4 trendline', book('gtl', config.goldTL), what, on('gtl')]); }
  // Gold daily engulf: a daily close above the last red candle's high, above the moving average; a resting buy at the zone's top
  { const x = st('goldEG'), c = config.goldEG || {}, n = c.sma || 20;
    const what = !config.goldEG ? '—' : !x ? 'waiting for the Trader' : `daily close ${px2(x.lastClose)} ${x.up ? 'above' : 'below'} the ${n}-day average ${px2(x.sma)}${x.zone ? `; zone ${px2(x.zone[0])}-${px2(x.zone[1])}` : ''}${x.pending && x.pending.length ? `; resting buy at ${x.pending.map(px2).join(', ')}` : x.up ? '; waiting for the next engulfing close' : ''}${blocked(x)}`;
    rows.push(['Gold daily engulf', config.goldEG ? 'live' : 'off', what, on('geg')]); }
  // Gold momentum pullback: D1 direction, pullback zones watched
  { const x = st('goldMP'), w = x && Array.isArray(x.watching) ? x.watching : [];
    const what = !config.goldMP ? '—' : !x ? 'waiting for the Trader' : `D1 ${x.d1 > 0 ? 'up' : x.d1 < 0 ? 'down' : 'flat'}; ${w.length ? `${w.length} pullback zone${w.length === 1 ? '' : 's'} watched (${w.map((z) => `${z.side} ${px2(z.zone[0])}-${px2(z.zone[1])}`).join('; ')})` : 'no pullback zone watched'}${x.test ? ' · paper test' : ''}`;
    rows.push(['Gold momentum pullback', book('gmp', config.goldMP), what, on('gmp')]); }
  // NQ New York open run: one paper row a session (research.json, k nq-open, session nyflip)
  { const R = (Array.isArray(research) ? research : []).filter((x) => x.k === 'nq-open' && x.session === 'nyflip').sort((a, b) => (b.opened || 0) - (a.opened || 0)), last = R[0];
    const today = new Date(now * 1000).toISOString().slice(0, 10), what = !last ? 'no session recorded yet' : last.day === today ? `today: ${last.side} ${px2(last.entry)}, ${last.status === 'open' ? 'open' : `${last.status}${Number.isFinite(last.R) ? ` ${sgn(last.R)}R` : ''}`}` : `last session ${last.day}: ${last.side} ${last.status}${Number.isFinite(last.R) ? ` ${sgn(last.R)}R` : ''}; next at the 09:30 New York open`;
    rows.push(['NQ New York open run', OS['nq-open'] ? 'shadow (paper, owner 11 Nov; research.json)' : 'live (paper, research.json)', what, '—']); }
  const out = [GOLD_START, '## Live gold systems now', '', `Built by the Trader at ${when} UTC from its own snapshot and the live record. Status only: what each Meridian system is waiting for right now; the Book column says which trade live on paper and which are paper shadows; the Scalp block below describes a shadow system.`, '',
    '| System | Book | Now | On |', '|---|---|---|---|'];
  for (const r of rows) out.push(`| ${r.join(' | ').replace(/\n/g, ' ')} |`);
  out.push(GOLD_END);
  return out.join('\n');
}

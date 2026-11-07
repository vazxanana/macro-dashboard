// One-time data repairs for the council Trader (data hygiene only: no trading rule, threshold, entry or exit changes).
// Each repair runs once: its key goes into config.repairs and a line into config.history (by 'repair'). Running the same
// repair again changes nothing. Split out of trader.mjs (7 Nov) so it can be tested on copies of the council-data files.

// 4 Nov 15:21-23:47 UTC: replica research signals on the markets quoted with 4-5 decimals (the five forex pairs, plus one
// XRP signal) were stored with prices rounded to 2 decimals (the pxr rounding bug, fixed since), so entry == stop or one
// 0.01 tick apart: R came out -1, null or 0 for "wins". They are kept for the record but marked void, and every research
// stat skips void records.
const ROUNDED_FROM = Date.parse('2026-11-04T15:21:00Z') / 1000, ROUNDED_TO = Date.parse('2026-11-04T23:48:00Z') / 1000;
const at2dp = (v) => isFinite(v) && Math.round(v * 100) / 100 === v;
export const isRoundedReplica = (x) => x && x.k === 'replica' && x.market !== 'xau' && (x.dec ?? 2) >= 4
  && x.opened >= ROUNDED_FROM && x.opened < ROUNDED_TO && at2dp(x.entry) && at2dp(x.stop) && Math.abs(x.entry - x.stop) < 0.0101;

export function voidRoundedReplicas(research, config, nowISO) {
  const key = 'void-rounded-replica-2026-11-04';
  config.repairs = config.repairs || []; config.history = config.history || [];
  if (config.repairs.includes(key)) return 0;
  const why = 'Prices were rounded to 2 decimals on markets quoted with 4-5 decimals (pxr bug, fixed), so entry equalled the stop (or sat one 0.01 tick from it) and R was -1, null or 0 for a "win".';
  let n = 0; const mk = {};
  for (const x of research) if (!x.void && isRoundedReplica(x)) { x.void = true; x.voidWhy = 'rounded prices: entry == stop (pxr bug, 4 Nov 15:21-23:47 UTC)'; n++; mk[x.market] = (mk[x.market] || 0) + 1; }
  config.repairs.push(key);
  config.history.push({ at: nowISO, by: 'repair', change: `Research: ${n} replica signals of 4 Nov 15:21-23:47 UTC marked void (${Object.entries(mk).map(([m, c]) => `${m} ${c}`).join(', ') || 'none found'}); research stats skip void records`, why });
  return n;
}

// config.history only described crypto trend v1 (pairs-best, 5 Nov 00:41); the code has run v2 / v3 since 5 Nov without a
// history entry. One catch-up line that says what the code does (no change to the system).
export function historyCatchUp(config, nowISO) {
  config.repairs = config.repairs || []; config.history = config.history || [];
  let n = 0;
  if (!config.repairs.includes('history-crypto-trend-v3')) {
    config.history.push({ at: nowISO, by: 'repair',
      change: 'Crypto trend as the code runs it (v2/v3 since 5 Nov): two slots per coin (BTC, ETH, SOL, XRP), long only. A daily close above the prior 55 daily highs, or above the prior 100 daily highs, buys at market on the next run (one open trade per slot). Catastrophe stop 5 x ATR(20) below the entry, fixed. Exit: a daily close under the ratcheting midpoint of that slot\'s own 55- or 100-day channel (high+low)/2, at market. One add per trade at +1R (cryptoAdd), with its own 5 ATR stop, leaving with the first trade. A coin stops opening trend trades once its forward trend total reaches -8R (cryptoTrendStopR). Trades opened before v3 keep their own rule (kATR trail, out under the 27/50-day low).',
      why: 'history catch-up: code changed without a history entry (the 5 Nov pairs-best entry still describes v1: 55-day breakout, 4 ATR trail, out under the 27-day low).' });
    config.repairs.push('history-crypto-trend-v3'); n++;
  }
  if (!config.repairs.includes('history-pairs-dormant') && !(config.history || []).some((h) => /dormant/i.test(h.change || '') && /pair/i.test(h.change || ''))) {
    const live = (config.replicaLive || []).filter((m) => m !== 'xau');
    if (!live.length && (config.pairsLiveAt != null || config.pairVolPct != null || config.pairStopR != null)) {
      config.history.push({ at: nowISO, by: 'repair',
        change: `Pairs replica settings are dormant: pairsLiveAt, pairVolPct (${config.pairVolPct}) and pairStopR (${config.pairStopR}) are kept, but no pair is in replicaLive (${JSON.stringify(config.replicaLive || [])}), so no pair trades the replica live. They only label the pairs' research signals (calm, pairStop) and the Pairs card's gate.`,
        why: 'history catch-up: since pairs-best (5 Nov) put forex back to research only, nothing said these settings no longer trade.' });
      n++;
    }
    config.repairs.push('history-pairs-dormant');
  }
  return n;
}

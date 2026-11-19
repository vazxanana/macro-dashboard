// Backtest lab engine (owner, 8 Nov 2026: "build a manual backtesting like TradeZella … and he can simulate prop-firm
// challenges: FTMO, FundingPips, Topstep, Lucid"). Pure functions over bars, orders and positions; no DOM, no network.
// Used by backtest.html in the browser and by tests/backtest.test.mjs in Node (module.exports). Paper only.
(function (root) {
  'use strict';
  const r2 = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

  // ---- prop-firm presets: editable in the page; rules change, the page says so. Amounts are fractions of the start balance.
  //   dd: 'static' (max loss from the start balance) | 'eod' (trailing on end-of-day balance highs, locks at the start balance)
  //   | 'intraday' (trailing on equity highs). dayStartUtc: hour (UTC) the firm's trading day starts (FX firms midnight CE(S)T ≈ 23
  //   UTC in winter; futures firms 17:00 CT = 22/23 UTC). consistency: best day's profit may be at most this share of the total.
  const FIRMS = [
    { id: 'ftmo2', name: 'FTMO · 2-step', size: 100000, phases: [{ name: 'Challenge', target: 0.10 }, { name: 'Verification', target: 0.05 }], dailyLoss: 0.05, maxLoss: 0.10, dd: 'static', minDays: 4, maxDays: 0, consistency: 0, dayStartUtc: 23, note: 'Daily loss 5% and max loss 10% of the start balance; at least 4 trading days per phase; no time limit. Check ftmo.com for the current rules.' },
    { id: 'fp2', name: 'FundingPips · 2-step', size: 100000, phases: [{ name: 'Student', target: 0.08 }, { name: 'Practitioner', target: 0.05 }], dailyLoss: 0.05, maxLoss: 0.10, dd: 'static', minDays: 3, maxDays: 0, consistency: 0, dayStartUtc: 0, note: 'Targets 8% then 5%; daily loss 5%, max loss 10% static; 3 minimum trading days. Check fundingpips.com.' },
    { id: 'ts50', name: 'Topstep · 50K Combine', size: 50000, phases: [{ name: 'Combine', target: 0.06 }], dailyLoss: 0, maxLoss: 0.04, dd: 'eod', minDays: 2, maxDays: 0, consistency: 0.5, dayStartUtc: 22, note: 'Profit target $3,000; maximum loss limit $2,000 trailing on end-of-day balance, stops trailing at the start balance; 2 minimum days; no day may be more than 50% of the profit. Check topstep.com.' },
    { id: 'ts100', name: 'Topstep · 100K Combine', size: 100000, phases: [{ name: 'Combine', target: 0.06 }], dailyLoss: 0, maxLoss: 0.03, dd: 'eod', minDays: 2, maxDays: 0, consistency: 0.5, dayStartUtc: 22, note: 'Target $6,000; MLL $3,000 trailing EOD; 50% consistency. Check topstep.com.' },
    { id: 'lucid50', name: 'Lucid · 50K', size: 50000, phases: [{ name: 'Evaluation', target: 0.06 }], dailyLoss: 0, maxLoss: 0.04, dd: 'eod', minDays: 1, maxDays: 0, consistency: 0.4, dayStartUtc: 22, note: 'Target $3,000; $2,000 trailing drawdown on end-of-day balance; consistency rule on the best day. Check lucidtrading.com.' },
    { id: 'custom', name: 'Custom rules', size: 100000, phases: [{ name: 'Phase 1', target: 0.10 }], dailyLoss: 0.05, maxLoss: 0.10, dd: 'static', minDays: 0, maxDays: 0, consistency: 0, dayStartUtc: 0, note: 'Your own rules.' },
  ];

  // ---- account and positions --------------------------------------------------------------------------------------
  // acct: { balance, start, commission (per trade, $), spread (price units, paid on entry), slFirst (worst case when SL and TP both inside one bar) }
  function newAccount(start, o = {}) { return { start, balance: start, commission: o.commission || 0, spread: o.spread || 0, slFirst: o.slFirst !== false, nextId: 1, positions: [], orders: [], closed: [] }; }
  // units from a risk amount and the stop distance (quote currency = account currency assumed; the page says so for JPY / non-USD quotes)
  const units = (risk, entry, stop) => { const d = Math.abs(entry - stop); return d > 0 ? risk / d : 0; };
  const pnl = (p, px) => (px - p.entry) * p.units * (p.side === 'buy' ? 1 : -1);
  function place(a, o, t) {
    // o: { side, type: 'market'|'limit'|'stop', price?, stop, target, units, note }, t = current bar time; market fills at o.price (the close)
    if (!o.stop || !(o.units > 0)) throw new Error('a stop and a size are required: never a trade without a stop');
    const dir = o.side === 'buy' ? 1 : -1;
    if ((o.stop - (o.price)) * dir >= 0) throw new Error('the stop must be on the losing side of the entry');
    if (o.target != null && (o.target - o.price) * dir <= 0) throw new Error('the target must be on the winning side of the entry');
    const rec = { id: a.nextId++, side: o.side, type: o.type || 'market', price: o.price, stop: o.stop, target: o.target ?? null, units: o.units, placedAt: t, note: o.note || '', tags: o.tags || [] };
    if (rec.type === 'market') return fill(a, rec, o.price + dir * a.spread, t);
    a.orders.push(rec); return rec;
  }
  function fill(a, rec, px, t) {
    const p = { ...rec, entry: px, openedAt: t, mfe: 0, mae: 0, r0: Math.abs(px - rec.stop), units0: rec.units };
    a.positions.push(p); a.orders = a.orders.filter((o) => o.id !== rec.id); return p;
  }
  function cancel(a, id) { a.orders = a.orders.filter((o) => o.id !== id); }
  // share of the original size a record carries: commission and R are split by it, so partial closes add up to one trade
  const share = (p, u) => (p.units0 > 0 ? u / p.units0 : 1);
  const moveR = (p, px) => (p.r0 ? (px - p.entry) * (p.side === 'buy' ? 1 : -1) / p.r0 : null);
  function close(a, p, px, t, reason) {
    const w = share(p, p.units), gross = pnl(p, px), net = gross - a.commission * w, mr = moveR(p, px);
    a.balance = r2(a.balance + net);
    const c = { ...p, exit: px, closedAt: t, reason, gross: r2(gross), net: r2(net), R: mr == null ? null : r2(mr * w, 2), Rmove: mr == null ? null : r2(mr, 2), holdBars: p.holdBars || 0 };
    a.closed.push(c); a.positions = a.positions.filter((x) => x.id !== p.id); return c;
  }
  // close part of a position: the closed part becomes its own journal record (same entry and id). Its R is the price move
  // in R (Rmove) times its share of the original size, so the records of one trade sum to the trade's R; same for commission.
  function closePartial(a, p, px, t, fraction, reason = 'partial') {
    const f = Math.min(0.999, Math.max(0.001, fraction || 0.5)), part = { ...p, units: p.units * f, id: p.id, partial: true }, w = share(p, part.units), mr = moveR(p, px);
    const gross = pnl(part, px), net = gross - a.commission * w; a.balance = r2(a.balance + net);
    const c = { ...part, exit: px, closedAt: t, reason, gross: r2(gross), net: r2(net), R: mr == null ? null : r2(mr * w, 2), Rmove: mr == null ? null : r2(mr, 2), holdBars: p.holdBars || 0, note: `${p.note || ''} (${Math.round(f * 100)}% closed)`.trim() };
    a.closed.push(c); p.units = p.units * (1 - f); p.scaled = (p.scaled || 0) + f; return c;
  }
  // trailing stop: p.trail = price distance; after each bar the stop follows the best price at that distance, never backwards
  function trail(p, b) { if (!(p.trail > 0)) return; const dir = p.side === 'buy' ? 1 : -1, cand = dir === 1 ? b.high - p.trail : b.low + p.trail; if ((cand - p.stop) * dir > 0) p.stop = cand; }
  // one new bar: fill resting orders that the bar's range touches, then stops / targets on open positions (worst case when both)
  function onBar(a, b) {
    const out = [];
    for (const o of a.orders.slice()) {
      const dir = o.side === 'buy' ? 1 : -1, touched = b.low <= o.price && o.price <= b.high;
      const gap = o.type === 'limit' ? (dir === 1 ? b.open <= o.price : b.open >= o.price) : (dir === 1 ? b.open >= o.price : b.open <= o.price);   // opened through it
      if (touched || gap) { const px = gap ? b.open : o.price; out.push({ kind: 'fill', pos: fill(a, o, px + dir * a.spread, b.time) }); }
    }
    for (const p of a.positions.slice()) {
      p.holdBars = (p.holdBars || 0) + 1; const dir = p.side === 'buy' ? 1 : -1;
      p.mfe = Math.max(p.mfe, ((dir === 1 ? b.high : b.low) - p.entry) * dir / p.r0); p.mae = Math.max(p.mae, (p.entry - (dir === 1 ? b.low : b.high)) * dir / p.r0);
      const hitS = dir === 1 ? b.low <= p.stop : b.high >= p.stop, hitT = p.target != null && (dir === 1 ? b.high >= p.target : b.low <= p.target);
      // both inside one bar: if the bar OPENED beyond one of them the order is known; otherwise the worst case (stop) unless slFirst is off
      const gapS = (p.stop - b.open) * dir >= 0, gapT = hitT && (b.open - p.target) * dir >= 0;
      if (hitS && hitT && gapT && !gapS) out.push({ kind: 'close', trade: close(a, p, p.target, b.time, 'target') });
      else if (hitS && hitT && !gapS) { const sl = a.slFirst; out.push({ kind: 'close', trade: close(a, p, sl ? p.stop : p.target, b.time, sl ? 'stop (both in one bar)' : 'target (both in one bar)') }); }
      else if (hitS) { const px = dir === 1 ? Math.min(p.stop, b.open) : Math.max(p.stop, b.open); out.push({ kind: 'close', trade: close(a, p, px, b.time, px === p.stop ? 'stop' : 'stop (gap)') }); }
      else if (hitT) out.push({ kind: 'close', trade: close(a, p, p.target, b.time, 'target') });
      else trail(p, b);
    }
    return out;
  }
  // how long a trade was held, in seconds, from its stamps (works for every record ever saved: no new stored field). A stamp
  // is the start of the candle a thing happened in, so the figure is exact to one candle of the timeframe on screen then.
  const holdSec = (t) => (t && t.closedAt > 0 && t.openedAt > 0 ? Math.max(0, t.closedAt - t.openedAt) : 0);
  // a duration in words: "under 1 m", "45 m", "2 h 15 m", "3 d 4 h" (two units at most)
  function durText(sec) { if (sec == null || !Number.isFinite(sec)) return '—'; const m = Math.round(Math.max(0, sec) / 60); if (m < 1) return 'under 1 m'; if (m < 60) return m + ' m';
    if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + r + ' m' : ''); } const hh = Math.round(m / 60), d = Math.floor(hh / 24), r = hh % 24; return d + ' d' + (r ? ' ' + r + ' h' : ''); }
  const equity = (a, px) => r2(a.balance + a.positions.reduce((s, p) => s + pnl(p, px), 0));

  // ---- statistics (the journal) -------------------------------------------------------------------------------------
  // one row per trade: partial-close records are merged into their trade (net, gross and R summed, last exit kept)
  function trades(closed) {
    const g = new Map(); let k = 0;
    for (const t of closed || []) { const key = t.id != null ? 'id' + t.id : 'x' + k++; const m = g.get(key);
      if (!m) { g.set(key, { ...t }); continue; }
      g.delete(key); g.set(key, { ...t, net: r2(m.net + t.net), gross: r2((m.gross || 0) + (t.gross || 0)), R: m.R == null || t.R == null ? (t.R ?? m.R) : r2(m.R + t.R), units: t.units0 || (m.units + t.units), partial: !!(m.partial && t.partial), mfe: Math.max(m.mfe || 0, t.mfe || 0), mae: Math.max(m.mae || 0, t.mae || 0), mistakes: t.mistakes && t.mistakes.length ? t.mistakes : m.mistakes, tags: t.tags && t.tags.length ? t.tags : m.tags }); }
    return [...g.values()];
  }
  function stats(closed, start) {
    closed = trades(closed);
    const n = closed.length, wins = closed.filter((t) => t.net > 0), losses = closed.filter((t) => t.net < 0);
    const gw = wins.reduce((s, t) => s + t.net, 0), gl = -losses.reduce((s, t) => s + t.net, 0), net = r2(gw - gl);
    let peak = start, dd = 0, eq = start; const curve = [{ t: closed[0] ? closed[0].openedAt : null, eq: start }];
    for (const t of closed) { eq = r2(eq + t.net); peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); curve.push({ t: t.closedAt, eq }); }
    let bestStreak = 0, worstStreak = 0, cur = 0; for (const t of closed) { if (t.net > 0) { cur = cur > 0 ? cur + 1 : 1; bestStreak = Math.max(bestStreak, cur); } else if (t.net < 0) { cur = cur < 0 ? cur - 1 : -1; worstStreak = Math.min(worstStreak, cur); } }
    const Rs = closed.map((t) => t.R).filter((x) => x != null), netR = r2(Rs.reduce((s, x) => s + x, 0));
    const by = (f) => { const o = {}; for (const t of closed) { const k = f(t); if (k == null) continue; o[k] = o[k] || { n: 0, net: 0, wins: 0, R: 0 }; o[k].n++; o[k].net = r2(o[k].net + t.net); o[k].R = r2(o[k].R + (t.R || 0)); if (t.net > 0) o[k].wins++; } return o; };
    const hourOf = (t) => new Date(t.openedAt * 1000).getUTCHours(), dayOf = (t) => new Date(t.openedAt * 1000).getUTCDay();
    const sessOf = (t) => { const h = hourOf(t); return h >= 7 && h < 12 ? 'London' : h >= 12 && h < 21 ? 'New York' : 'Asia'; };
    // holdAvg counts bars (kept for sessions and exports that read it); holdAvgSec is the same as time, from each trade's own
    // open and close stamps, so it means the same thing whatever timeframe each bar was replayed on
    const holdAvg = n ? r2(closed.reduce((s, t) => s + (t.holdBars || 0), 0) / n, 1) : null, holdAvgSec = n ? Math.round(closed.reduce((s, t) => s + holdSec(t), 0) / n) : null, rDist = {}; for (const x of Rs) { const k = x <= -1 ? '≤-1R' : x < 0 ? '-1..0' : x < 1 ? '0..1R' : x < 2 ? '1..2R' : x < 3 ? '2..3R' : '≥3R'; rDist[k] = (rDist[k] || 0) + 1; }
    return { n, holdAvg, holdAvgSec, rDist, wins: wins.length, losses: losses.length, winRate: n ? r2(wins.length / n, 3) : null, net, netR, avgR: Rs.length ? r2(netR / Rs.length, 2) : null,
      profitFactor: gl > 0 ? r2(gw / gl) : gw > 0 ? Infinity : null, expectancy: n ? r2(net / n) : null, avgWin: wins.length ? r2(gw / wins.length) : null, avgLoss: losses.length ? r2(gl / losses.length) : null,
      best: n ? Math.max(...closed.map((t) => t.net)) : null, worst: n ? Math.min(...closed.map((t) => t.net)) : null, maxDD: r2(dd), maxDDPct: start ? r2(dd / start * 100, 2) : null, bestStreak, worstStreak: -worstStreak,
      avgMfe: n ? r2(closed.reduce((s, t) => s + (t.mfe || 0), 0) / n, 2) : null, avgMae: n ? r2(closed.reduce((s, t) => s + (t.mae || 0), 0) / n, 2) : null, curve,
      byWeekday: by(dayOf), byHour: by(hourOf), bySide: by((t) => t.side), byTag: by((t) => (t.tags && t.tags[0]) || null), byExit: by((t) => t.reason), bySession: by(sessOf), byMistake: (() => { const o = {}; for (const t of closed) for (const m of (t.mistakes && t.mistakes.length ? t.mistakes : ['none'])) { o[m] = o[m] || { n: 0, net: 0, wins: 0, R: 0 }; o[m].n++; o[m].net = r2(o[m].net + t.net); o[m].R = r2(o[m].R + (t.R || 0)); if (t.net > 0) o[m].wins++; } return o; })(), returnPct: start ? r2(net / start * 100, 2) : null };
  }
  // calendar: net per UTC day of close
  function byDay(closed, dayStartUtc = 0) { const o = {}; for (const t of closed) { const k = dayKey(t.closedAt, dayStartUtc); o[k] = r2((o[k] || 0) + t.net); } return o; }
  const dayKey = (t, dayStartUtc = 0) => new Date((t - dayStartUtc * 3600) * 1000).toISOString().slice(0, 10);

  // ---- prop-firm challenge -------------------------------------------------------------------------------------------
  // ch: { firm (rules copy), phase (index), start (balance), status 'live'|'passed'|'failed'|'funded', reason, days: {key: {start, high, low, net}}, eodHigh, lock }
  function newChallenge(firm) { return { firm: JSON.parse(JSON.stringify(firm)), phase: 0, start: firm.size, status: 'live', reason: null, days: {}, eodHigh: firm.size, history: [] }; }
  // evaluate after every bar with the account's balance / equity at that bar. Fills ch.days, trips the rules, passes the phase.
  function evaluate(ch, a, px, t, bar) {
    if (ch.status !== 'live') return ch;
    const F = ch.firm, eq = equity(a, px), key = dayKey(t, F.dayStartUtc);
    // worst equity inside the bar (positions open before it, at the bar's adverse extreme): the rules are breached intrabar
    const eqW = bar ? r2(a.balance + a.positions.reduce((s, p) => s + pnl(p, p.openedAt < bar.time ? (p.side === 'buy' ? bar.low : bar.high) : px), 0)) : eq;
    // a new day's reference is the previous day's closing equity (a drop on the day's first bar counts against the new day)
    let d = ch.days[key]; if (!d) { const pk = Object.keys(ch.days), prev = pk.length ? ch.days[pk[pk.length - 1]] : null, s0 = prev ? prev.endEq : eq; d = ch.days[key] = { start: prev ? prev.endBalance : a.balance, startEq: s0, high: eq, low: eq, trades: 0, net: 0 }; }
    const mine = a.closed.slice(ch.phaseStartIdx || 0).filter((x) => dayKey(x.closedAt, F.dayStartUtc) === key);
    // a new day: the end-of-day balance of the previous one moves the trailing threshold (eod), capped at the start balance
    const keys = Object.keys(ch.days); if (keys.length > 1 && keys[keys.length - 1] === key) { const prev = ch.days[keys[keys.length - 2]]; if (prev && !prev.closedOut) { prev.closedOut = true; ch.eodHigh = Math.max(ch.eodHigh, prev.endBalance ?? prev.start); } }
    d.high = Math.max(d.high, eq); d.low = Math.min(d.low, eqW); d.endBalance = a.balance; d.endEq = eq; d.trades = trades(mine).length; d.net = r2(mine.reduce((s, x) => s + x.net, 0));
    if (F.dd === 'intraday') ch.eodHigh = Math.max(ch.eodHigh, eq);
    const fail = (why) => { ch.status = 'failed'; ch.reason = why; ch.failedAt = t; ch.history.push({ t, event: 'failed', why }); return ch; };
    // daily loss: today's loss (closed + floating) against the day's starting equity, as a share of the start balance
    if (F.dailyLoss > 0 && d.startEq - eqW >= F.dailyLoss * ch.start - 1e-9) return fail(`daily loss limit: down ${r2(d.startEq - eqW)} today (limit ${r2(F.dailyLoss * ch.start)})`);
    const floor = F.dd === 'static' ? ch.start * (1 - F.maxLoss) : Math.min(ch.start, ch.eodHigh - F.maxLoss * ch.start) ;
    if (eqW <= floor + 1e-9) return fail(`${F.dd === 'static' ? 'maximum loss' : 'trailing drawdown'}: equity ${eqW} at or under ${r2(floor)}`);
    if (F.maxDays > 0 && Object.keys(ch.days).length > F.maxDays) return fail(`time limit: more than ${F.maxDays} days`);
    // target: closed balance (floating does not count), on a day's close of a trade; then the minimum days and consistency
    const target = ch.start * (1 + F.phases[ch.phase].target), tradingDays = Object.values(ch.days).filter((x) => x.trades > 0).length;
    ch.progress = { target: r2(target), balance: a.balance, equity: eq, pct: r2((a.balance - ch.start) / (target - ch.start) * 100, 1), floor: r2(floor), dayLoss: r2(d.startEq - eq), dayLimit: F.dailyLoss > 0 ? r2(F.dailyLoss * ch.start) : null, tradingDays, minDays: F.minDays, consistency: consistencyOf(ch, a) };
    if (a.balance >= target - 1e-9) {
      if (tradingDays < F.minDays) { ch.progress.waiting = `target reached: ${F.minDays - tradingDays} more trading day${F.minDays - tradingDays === 1 ? '' : 's'} needed`; return ch; }
      if (F.consistency > 0 && ch.progress.consistency > F.consistency + 1e-9) { ch.progress.waiting = `target reached, but the best day is ${Math.round(ch.progress.consistency * 100)}% of the profit (max ${Math.round(F.consistency * 100)}%): keep trading smaller`; return ch; }
      ch.history.push({ t, event: 'passed', phase: F.phases[ch.phase].name, balance: a.balance });
      if (ch.phase + 1 < F.phases.length) { ch.phase++; ch.days = {}; ch.eodHigh = ch.start; a.balance = ch.start; a.positions = []; a.orders = []; ch.status = 'live'; ch.phaseStartIdx = a.closed.length; }
      else { ch.status = 'funded'; ch.fundedAt = t; }
    }
    return ch;
  }
  function consistencyOf(ch, a) { const days = Object.values(ch.days).map((d) => d.net).filter((x) => x > 0), tot = Object.values(ch.days).reduce((s, d) => s + d.net, 0); return tot > 0 && days.length ? r2(Math.max(...days) / tot, 3) : 0; }

  // ---- Monte Carlo: how often would these results pass a firm's rules? ----------------------------------------------------
  // Resamples the trader's own R multiples (with replacement) into many sequences and plays each against the rules:
  // risk = fraction of the START balance risked per trade (fixed, as most firms are sized), target / maxLoss / dailyLoss as
  // fractions of the start, dd 'static' or trailing on closed-balance highs (capped at the start, like an EOD trail),
  // perDay = trades per trading day (for the daily loss rule and the minimum days), minDays, maxTrades = give-up length.
  // Returns pass / fail / unfinished shares, why it failed, median trades and days to pass, drawdown percentiles.
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function monteCarlo(Rs, o = {}) {
    const R = (Rs || []).filter((x) => Number.isFinite(x)); if (R.length < 5) return null;
    const n = o.n || 2000, risk = o.risk ?? 0.01, target = o.target ?? 0.10, maxLoss = o.maxLoss ?? 0.10, dailyLoss = o.dailyLoss || 0, perDay = Math.max(1, Math.round(o.perDay || 2)),
      minDays = o.minDays || 0, maxTrades = o.maxTrades || 400, trailDD = o.dd === 'eod' || o.dd === 'intraday', rand = rng(o.seed || 7);
    let pass = 0, fail = 0, open = 0, why = { daily: 0, max: 0 }; const tradesToPass = [], daysToPass = [], dds = [];
    // o.fan = K: also keep each run's balance after trades 1..K (held flat once it passed or failed) for a fan chart. Recording
    // only: the draws, the rules and every other number are the same with or without it.
    const K = Math.max(0, Math.min(maxTrades, Math.round(o.fan || 0))), FP = K ? new Float64Array(K * n) : null, FD = K ? new Uint32Array(K) : null;
    for (let k = 0; k < n; k++) {
      let bal = 1, peak = 1, worst = 0, day = 0, dayStart = 1, done = false, at = 0;
      for (let i = 0; i < maxTrades; i++) {
        if (i % perDay === 0) { day++; dayStart = bal; }
        bal += risk * R[Math.floor(rand() * R.length)];
        worst = Math.max(worst, peak - bal);
        if (FP && i < K) FP[i * n + k] = bal; at = i + 1;
        if (dailyLoss > 0 && dayStart - bal >= dailyLoss - 1e-12) { fail++; why.daily++; done = true; break; }
        const floor = trailDD ? Math.min(1, peak - maxLoss) : 1 - maxLoss;
        if (bal <= floor + 1e-12) { fail++; why.max++; done = true; break; }
        peak = Math.max(peak, bal);
        if (bal >= 1 + target - 1e-12 && day >= minDays) { pass++; tradesToPass.push(i + 1); daysToPass.push(day); done = true; break; }
      }
      if (!done) open++;
      dds.push(worst);
      if (FP) { for (let i = at; i < K; i++) FP[i * n + k] = bal; if (done) for (let i = at - 1; i < K; i++) FD[i]++; } // at = trades played
    }
    const q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
    const avgR = R.reduce((x, y) => x + y, 0) / R.length;
    return { n, trades: R.length, avgR: r2(avgR, 3), pass: r2(pass / n, 3), fail: r2(fail / n, 3), unfinished: r2(open / n, 3), failDaily: r2(why.daily / n, 3), failMax: r2(why.max / n, 3),
      medianTrades: q(tradesToPass, 0.5), medianDays: q(daysToPass, 0.5), dd50: r2((q(dds, 0.5) || 0) * 100, 2), dd95: r2((q(dds, 0.95) || 0) * 100, 2), ...(FP ? { fan: fanOf(FP, FD, K, n) } : {}) };
  }
  // fan percentiles per step, in % of the start balance; done[i] = share of runs already passed or failed after trade i + 1
  function fanOf(FP, FD, K, n) { const P = [5, 25, 50, 75, 95], f = { steps: K, p: {}, done: [] }; P.forEach((p) => { f.p[p] = []; });
    for (let i = 0; i < K; i++) { const col = FP.subarray(i * n, i * n + n).slice().sort(); P.forEach((p) => { f.p[p].push(r2((col[Math.min(n - 1, Math.floor(p / 100 * n))] - 1) * 100, 2)); }); f.done.push(r2(FD[i] / n, 3)); }
    return f; }
  // the best risk per trade for a firm: the highest pass rate over a grid of risks (0.25% .. 3%)
  // (curve: the pass / fail share at every risk tried, for a chart; it does not change which risk is best)
  function bestRisk(Rs, o = {}) { let best = null; const curve = []; for (const r of [0.0025, 0.005, 0.0075, 0.01, 0.0125, 0.015, 0.02, 0.025, 0.03]) { const m = monteCarlo(Rs, { ...o, fan: 0, risk: r, n: o.n || 1000 }); if (m) curve.push({ risk: r, pass: m.pass, fail: m.fail, unfinished: m.unfinished }); if (m && (!best || m.pass > best.pass)) best = { risk: r, ...m }; } if (best) best.curve = curve; return best; }

  // ---- changing the replay's timeframe in the middle of a session (11 Nov 2026) -----------------------------------------
  // The replay has ONE moment T (unix seconds): every price before T has been replayed and has gone through the engine,
  // nothing at or after T has. A timeframe is only a way of drawing that: its candles that ended by T are closed; the one
  // that contains T (started before it, ends after it) is still FORMING and is built from finer candles that ended by T;
  // the finer candles from T to its end (`rest`) are what the engine still has to process, once, when the user steps.
  // So a switch never touches the account, and no price is processed twice or skipped. Candles are UTC-aligned (the candle
  // proxy asks OANDA for UTC alignment), so a candle of `sec` seconds covers [time, time + sec).
  const TF_SECS = [15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 86400];
  const countLE = (bars, t) => { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time <= t) lo = m + 1; else hi = m; } return lo; };   // bars that start at or before t
  // the replay moment: the end of the last fully replayed bar, or the moment a forming candle was built up to
  // `at` = a moment held across a switch (tfHold): it wins over the bar-derived one until the next step
  function tfMoment(bars, idx, sec, part, at) { if (part) return part.T; if (at > 0) return at; const b = bars[idx - 1]; return b ? b.time + sec : (bars[0] ? bars[0].time : 0); }
  // A switch seats T with no forming candle when nothing traded between T and the edge of a candle: the finer candles of the
  // candle that contains T all ended by T (a Friday 21:00 UTC close inside the 20:00 4h candle, or the day candle), or none
  // ended by it. The bars then put the moment at that candle's edge (Sat 00:00), which is not where the replay is: no price
  // lies between the two, but the rule is that a switch never moves the moment. tfHold keeps T (null when the bars already
  // give T). Only a switch or a resume sets it; the next step clears it, and the moment follows the bars again from there.
  function tfHold(bars, idx, sec, part, T) { if (part || !(T > 0)) return null; const d = tfMoment(bars, idx, sec, null); if (d === T) return null;
    if (d < T && bars[idx] && bars[idx].time < T) throw new Error('a candle lies between the bars and the held moment');   // never hold past a price
    return T; }
  // where the moment T sits on a series: how many bars ended by T, and the index of the bar that contains T (-1 when none)
  function tfPlan(bars, sec, T) { const closed = countLE(bars, T - sec), nb = bars[closed]; return { closed, straddle: nb && nb.time < T ? closed : -1 }; }
  // the coarsest timeframe that tiles both halves of the candle [start, start + sec) cut at T (0 = none: T is on its edge)
  function tfFineSec(sec, start, T, secs = TF_SECS) { let g = 0; for (const s of secs) if (s < sec && sec % s === 0 && (T - start) % s === 0 && start % s === 0 && s > g) g = s; return g; }
  // the fetch window of a timeframe for a session that started at startAt and ends at `to` (300 candles of context, as the
  // session form loads them); `ok` is false when it would be more than `max` candles ("load fewer days")
  function tfWindow(startAt, to, sec, max) { const from = startAt - 300 * sec, n = Math.ceil((to - from) / sec); return { from, to, n, ok: n <= max }; }
  // the forming candle: `fine` = candles of g seconds covering the candle bars[i]; formed from those that ended by T only
  function tfPart(full, i, sec, T, fine, g) { const s = full.time, e = s + sec, formed = [], rest = [];
    for (const b of fine || []) { if (b.time < s || b.time >= e) continue; if (b.time + g <= T) formed.push(b); else if (b.time >= T) rest.push(b); else throw new Error('a finer candle crosses the replay moment'); }
    if (!formed.length) return { idx: i, part: null };        // nothing traded in it before T: the whole candle is still ahead
    if (!rest.length) return { idx: i + 1, part: null };      // nothing traded in it from T on: it is complete
    let h = -Infinity, l = Infinity, v = 0; for (const b of formed) { if (b.high > h) h = b.high; if (b.low < l) l = b.low; v += b.volume || 0; }
    const bar = { time: s, open: formed[0].open, high: h, low: l, close: formed[formed.length - 1].close, volume: v, forming: true };
    return { idx: i + 1, part: { i, T, sec, g, formed: bar, full: { ...full }, rest: rest.map((b) => ({ ...b })) } }; }
  // seat the moment T on a series: { idx, part }. `fine` (candles of g seconds) is needed only when a bar contains T.
  function tfEnter(bars, sec, T, fine, g) { const p = tfPlan(bars, sec, T); if (p.straddle < 0) return { idx: p.closed, part: null };
    if (!fine || !(g > 0)) throw new Error('the forming candle needs finer candles'); return tfPart(bars[p.straddle], p.straddle, sec, T, fine, g); }
  // the forming candle sits in the series in place of the full one while it forms; the full one comes back when it completes
  function tfSeat(bars, part) { if (part) bars[part.i] = part.formed; return bars; }
  function tfUnseat(bars, part) { if (part && bars[part.i] && bars[part.i].time === part.full.time) bars[part.i] = part.full; return bars; }
  // what the engine processes on one step: the rest of the forming candle (its finer candles, in order), else the next bar
  function tfNext(bars, idx, part) { return part ? part.rest : (idx < bars.length ? [bars[idx]] : []); }
  // one step of the replay over those bars: orders and positions, then the challenge, then a breach closes everything at that
  // bar's close (the same order the page has always used per bar). Events of a breach close carry `breach: true`.
  function advance(a, ch, bars) { const out = [];
    for (const b of bars) { const ev = onBar(a, b); if (ch) evaluate(ch, a, b.close, b.time, b);
      if (ch && ch.status === 'failed' && (a.positions.length || a.orders.length)) { for (const q of a.positions.slice()) ev.push({ kind: 'close', trade: close(a, q, b.close, b.time, 'challenge breach'), breach: true }); a.orders = []; }
      for (const e of ev) { e.bar = b; out.push(e); } }
    return out; }
  // the stamp of something done now (an order placed, a manual close): the start of the last candle replayed. While a candle
  // forms that is the last FINER candle that went into it, not the forming candle's own start (a day candle starts at 00:00:
  // a trade taken at 14:35 inside it must not be journalled at midnight).
  function tfStamp(bars, idx, part) { if (part) return part.T - part.g; const b = bars[idx - 1]; return b ? b.time : 0; }
  // part of the rest of a forming candle has been replayed (its first k finer candles went through the engine): the candle
  // as it stands now, the moment moved to the end of the k-th. null when the whole rest is done (the candle is complete).
  function tfProgress(part, k) { if (!part) return null; k = Math.max(0, Math.min(part.rest.length, Math.floor(k) || 0)); if (k >= part.rest.length) return null; if (!k) return part;
    const f = { ...part.formed }; for (let i = 0; i < k; i++) { const b = part.rest[i]; if (b.high > f.high) f.high = b.high; if (b.low < f.low) f.low = b.low; f.close = b.close; f.volume = (f.volume || 0) + (b.volume || 0); }
    return { ...part, T: part.rest[k - 1].time + part.g, formed: f, rest: part.rest.slice(k) }; }
  // the name a session is shown under: a name the page made by itself ("XAU 15m from 2026-10-27") follows the timeframe the
  // session is on now; a name the user typed is never touched. The stored name is not changed.
  function sessionName(name, sym, tf) { const m = /^(\S+) (\d+[mhdw]) from (\d{4}-\d{2}-\d{2})$/.exec(name || ''); return m && tf && sym && m[1] === String(sym).toUpperCase() && m[2] !== tf ? `${m[1]} ${tf} from ${m[3]}` : (name || ''); }
  // a saved session: sessions saved before the timeframe switch carry `idx` only; newer ones carry the moment `mom`
  function tfResume(saved, bars, sec) { if (saved && saved.mom > 0) { const p = tfPlan(bars, sec, saved.mom); return { idx: p.closed, straddle: p.straddle, T: saved.mom }; } const idx = Math.min((saved && saved.idx) || 0, bars.length); return { idx, straddle: -1, T: tfMoment(bars, idx, sec, null) }; }

  // ---- trade coach (17 Nov 2026, owner: "while I backtest he understands what I'm doing") --------------------------------
  // Reads a trade the way a mentor would and says it back in plain words. Display and record only: nothing here places,
  // changes or refuses an order, and nothing moves a stop. Every reading uses candles that CLOSED at or before the moment
  // asked about (time + sec <= T), so a price after the entry can never change the context recorded for it.
  const COACH = { revengeMin: 30, minN: 20, oversize: 1.1, swingK: 3, breakLook: 5 };
  const GRADES = ['A', 'B', 'C'];
  const sessOfHour = (h) => (h >= 7 && h < 12 ? 'London' : h >= 12 && h < 21 ? 'New York' : 'Asia');   // = stats().bySession
  // how many bars ended by T (bars sorted by time; a candle still forming at T is left out)
  function closedBy(bars, sec, T) { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time + sec <= T) lo = m + 1; else hi = m; } return lo; }
  // complete higher-timeframe candles built from closed lower ones (UTC-aligned buckets that ended by T)
  function bucketBars(bars, bsec, T) { const out = []; let c = null;
    for (const b of bars) { const k = Math.floor(b.time / bsec) * bsec; if (k + bsec > T) break; if (!c || c.time !== k) { c = { time: k, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(c); } else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } }
    return out; }
  // trend: EMA 20 against EMA 50 and the slope of EMA 20 over 5 bars; 'up' / 'down' only when both agree, else 'flat'; null under 55 bars
  function trendOf(bars) { if (!bars || bars.length < 55) return null; const k20 = 2 / 21, k50 = 2 / 51; let e20 = null, e50 = null; const h = [];
    for (const b of bars) { e20 = e20 == null ? b.close : b.close * k20 + e20 * (1 - k20); e50 = e50 == null ? b.close : b.close * k50 + e50 * (1 - k50); h.push(e20); }
    const sl = e20 - h[h.length - 6]; return e20 > e50 && sl > 0 ? 'up' : e20 < e50 && sl < 0 ? 'down' : 'flat'; }
  // ATR as the page draws it: the mean true range of the last n bars
  function atrOf(bars, n = 14) { const b = bars.slice(-n - 1); if (b.length < 2) return null; let s = 0; for (let i = 1; i < b.length; i++) s += Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)); return s / (b.length - 1); }
  // a close through the latest swing confirmed before it (K bars each side) inside the last `look` closed bars: 'up' or 'down'
  function swingBreak(bars, K = COACH.swingK, look = COACH.breakLook) { const n = bars.length; let out = null;
    for (let i = Math.max(K * 2 + 1, n - look); i < n; i++) { let sh = null, sl = null;
      for (let j = i - K - 1; j >= K && (sh == null || sl == null); j--) { let isH = true, isL = true; for (let d = 1; d <= K; d++) { if (!(bars[j].high > bars[j - d].high && bars[j].high >= bars[j + d].high)) isH = false; if (!(bars[j].low < bars[j - d].low && bars[j].low <= bars[j + d].low)) isL = false; } if (isH && sh == null) sh = bars[j].high; if (isL && sl == null) sl = bars[j].low; }
      if (sh != null && bars[i].close > sh && bars[i - 1].close <= sh) out = { dir: 'up', ago: n - 1 - i, level: sh };
      if (sl != null && bars[i].close < sl && bars[i - 1].close >= sl) out = { dir: 'down', ago: n - 1 - i, level: sl }; }
    return out; }
  const r2s = (v) => (v == null || !Number.isFinite(v) ? null : r2(v, 2));
  // the context of an entry. bars / sec: the replay's candles and their timeframe; T: the moment (only bars ended by T are read);
  // o: { side, entry, stop, target, at (the entry's stamp: session and day), riskSet, riskPct }; prior: the closed trades before it
  function coachCtx(bars, sec, T, o, prior) { const all = bars || [], n = closedBy(all, sec, T), seen = all.slice(Math.max(0, n - 6000), n), at = o.at || T, dir = o.side === 'buy' ? 1 : -1;
    const ctx = { v: 1, tf: sec, at: T, side: o.side, session: sessOfHour(new Date(at * 1000).getUTCHours()), bars: seen.length };
    const a = atrOf(seen); ctx.atr = a == null ? null : +a.toPrecision(6); const dist = Math.abs(o.entry - o.stop);
    ctx.stopAtr = a ? r2s(dist / a) : null; ctx.rr = o.target != null && dist > 0 ? r2s(Math.abs(o.target - o.entry) / dist) : null;
    const main = trendOf(seen.slice(-400)); let htf = null, htfName = null;
    for (const [bs, nm] of [[14400, 'H4'], [3600, 'H1']]) { if (bs <= sec || bs % sec) continue; const t = trendOf(bucketBars(seen, bs, T).slice(-400)); if (t) { htf = t; htfName = nm; break; } }
    if (!htf && main) { htf = main; htfName = sec >= 86400 ? 'D1' : sec >= 3600 ? 'H' + sec / 3600 : sec / 60 + 'm'; ctx.htfIsMain = true; }
    ctx.trend = { main, htf, htfName }; ctx.htfRel = htf == null ? null : htf === 'flat' ? 'flat' : (htf === 'up') === (dir === 1) ? 'with' : 'against';
    // the previous UTC day that has candles (weekends skipped), from closed candles before the entry's day
    const day = Math.floor(at / 86400); let hi = null, lo = null, pk = null;
    for (let i = seen.length - 1; i >= 0; i--) { const dk = Math.floor(seen[i].time / 86400); if (dk >= day) continue; if (pk == null) pk = dk; if (dk !== pk) break; hi = hi == null ? seen[i].high : Math.max(hi, seen[i].high); lo = lo == null ? seen[i].low : Math.min(lo, seen[i].low); }
    if (hi != null && hi > lo) ctx.pd = { hi, lo, pos: r2s((o.entry - lo) / (hi - lo)), toHiAtr: a ? r2s((hi - o.entry) / a) : null, toLoAtr: a ? r2s((o.entry - lo) / a) : null };
    const br = swingBreak(seen); if (br) ctx.brk = { dir: br.dir, ago: br.ago, rel: (br.dir === 'up') === (dir === 1) ? 'with' : 'against' };
    const done = trades(prior || []).filter((t) => t.closedAt > 0 && t.closedAt <= at).sort((x, y) => x.closedAt - y.closedAt), last = done[done.length - 1];
    if (last) { const res = (t) => (t.net > 0 ? 'win' : t.net < 0 ? 'loss' : 'flat'); let run = 0; for (let i = done.length - 1; i >= 0 && res(done[i]) === res(last); i--) run++; ctx.prev = { res: res(last), run, min: Math.round((at - last.closedAt) / 60) }; }
    ctx.revenge = !!(ctx.prev && ctx.prev.res === 'loss' && ctx.prev.min <= COACH.revengeMin);
    if (o.riskSet != null) ctx.riskSet = o.riskSet; if (o.riskPct != null) ctx.riskPct = r2s(o.riskPct);
    if (o.target != null && Number.isFinite(+o.target)) ctx.tgt0 = +o.target; if (o.grade && GRADES.includes(o.grade)) ctx.grade = o.grade;   // the target it opened with; the trader's own grade (17 Nov 2026)
    const dw = coachDraw(o.draw, T, { ...o, at }, a); if (dw) { ctx.draw = dw; if (o.dec != null) ctx.dec = o.dec; }
    return ctx; }
  // the owner's drawings (Draw menu: 'h' price line { price }, 't' trend line and 'r' box { t1, p1, t2, p2 }) read against an entry.
  // Only drawings that existed at the moment T count: a drawing stamped `at` after T is left out; one without a stamp was drawn
  // earlier (sessions before 17 Nov 2026). A trend line is read in time terms: its value at the entry's time on the straight line
  // through its two [time, price] points (extended both ways), no pixels. Levels = price lines, box edges, trend-line values.
  const AT_LEVEL = 0.5;   // within half an ATR of a drawn level = "at your level"
  function lineAt(d, t) { return d.t2 === d.t1 ? d.p2 : d.p1 + (d.p2 - d.p1) * (t - d.t1) / (d.t2 - d.t1); }
  function coachDraw(draw, T, o, atr) { const list = (draw || []).filter((d) => d && ['h', 'hr', 't', 'r'].includes(d.type) && !(d.at > T)); if (!list.length || !(atr > 0)) return list.length ? { n: list.length } : null;
    const dir = o.side === 'buy' ? 1 : -1, e = o.entry, at = o.at || T, lv = [], items = [];
    for (const d of list) {
      if (d.type === 'h' || d.type === 'hr') { const pr = d.type === 'h' ? d.price : d.p1; lv.push({ kind: 'line', price: pr }); items.push({ kind: 'line', price: pr, dAtr: r2s(Math.abs(e - pr) / atr) }); }
      else if (d.type === 'r') { const hi = Math.max(d.p1, d.p2), lo = Math.min(d.p1, d.p2), inside = e >= lo && e <= hi; lv.push({ kind: 'box edge', price: hi }, { kind: 'box edge', price: lo }); items.push({ kind: 'box', hi, lo, inside, dAtr: inside ? 0 : r2s(Math.min(Math.abs(e - hi), Math.abs(e - lo)) / atr) }); }
      else { const v = lineAt(d, at), side = e > v ? 'above' : e < v ? 'below' : 'on'; lv.push({ kind: 'trend line', price: v }); items.push({ kind: 'trend line', value: r2s(v), side, respects: side === 'on' || (side === 'above') === (dir === 1), dAtr: r2s(Math.abs(e - v) / atr) }); } }
    const near = lv.slice().sort((x, y) => Math.abs(e - x.price) - Math.abs(e - y.price))[0], nearAtr = r2s(Math.abs(e - near.price) / atr), atLevel = nearAtr <= AT_LEVEL;
    const out = { n: list.length, items, near: { kind: near.kind, price: near.price, dAtr: nearAtr, pos: e > near.price ? 'above' : e < near.price ? 'below' : 'at' }, atLevel, inBox: items.some((x) => x.kind === 'box' && x.inside) };
    // the level that protects the trade: the nearest one at the entry or on its losing side; is the stop beyond it?
    const prot = lv.filter((x) => (e - x.price) * dir >= -AT_LEVEL * atr).sort((x, y) => (e - x.price) * dir - (e - y.price) * dir)[0];
    if (prot && o.stop != null) { const b = (prot.price - o.stop) * dir; out.prot = { kind: prot.kind, price: prot.price }; out.stopBehind = b > 0; out.stopBeyondAtr = r2s(b / atr); }
    // the next level ahead in the trade's direction (past the one it entered at); is the target before or at it?
    const next = lv.filter((x) => (x.price - e) * dir > AT_LEVEL * atr).sort((x, y) => (x.price - e) * dir - (y.price - e) * dir)[0];
    if (next) { out.next = { kind: next.kind, price: next.price }; if (o.target != null) out.targetBefore = (o.target - next.price) * dir <= 0; }
    return out; }
  const n1 = (v) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toString();
  // one plain sentence: "Selling in London, against the H1 uptrend, 1.3 ATR stop, 2R target, 0.4 ATR under yesterday's high."
  function coachSentence(c) { if (!c || !c.side) return 'No context recorded for this trade.';
    const p = [`${c.side === 'buy' ? 'Buying' : 'Selling'} in ${c.session}`], tw = { up: 'uptrend', down: 'downtrend' };
    if (c.trend && c.trend.htf) p.push(c.trend.htf === 'flat' ? `with no clear ${c.trend.htfName} trend` : `${c.htfRel} the ${c.trend.htfName} ${tw[c.trend.htf]}`);
    if (c.stopAtr != null) p.push(`${n1(c.stopAtr)} ATR stop`); p.push(c.rr != null ? `${n1(c.rr)}R target` : 'no target');
    if (c.pd && c.pd.toHiAtr != null) { const d = c.pd; p.push(d.toHiAtr < 0 ? `${n1(-d.toHiAtr)} ATR above yesterday's high` : d.toLoAtr < 0 ? `${n1(-d.toLoAtr)} ATR below yesterday's low` : d.toHiAtr <= d.toLoAtr ? `${n1(d.toHiAtr)} ATR under yesterday's high` : `${n1(d.toLoAtr)} ATR over yesterday's low`); }
    if (c.brk) p.push(`${c.brk.ago ? c.brk.ago + ' bar' + (c.brk.ago === 1 ? '' : 's') + ' after' : 'right on'} a break ${c.brk.dir} through the last swing ${c.brk.dir === 'up' ? 'high' : 'low'}`);
    if (c.revenge) p.push(`${c.prev.min} min after a loss`);
    let s = p.join(', '); const dr = drawSay(c); if (dr) s += '; ' + dr;
    if (c.lens && c.lens.edge) s += '; ' + lensSay(c.lens);   // the edge the trader reads the chart with (17 Nov 2026, assets/coach-lens.js)
    return s + '.'; }
  // the lens part (17 Nov 2026, "Coach reads the chart as an edge"): ctx.lens = { edge, name, state, agree, signal } from assets/coach-lens.js
  function lensSay(l) { const nm = l.name || l.edge;
    return `by ${nm} rules: ${l.agree === 'with' ? (l.signal ? 'with the rule\'s signal' : 'on the rule\'s side') : l.agree === 'against' ? (l.signal ? 'against the rule\'s signal' : 'against the rule\'s side') : 'the rule has no signal'} (${l.state})`; }
  // the drawings part: "selling at your drawn level 4,120.00 (0.1 ATR away), stop 0.4 ATR above it, target before your next line at 4,072.00"
  const fmtP = (v, dec) => (+v).toLocaleString('en-US', { minimumFractionDigits: dec == null ? 2 : dec, maximumFractionDigits: dec == null ? 2 : dec });
  const KW = { line: 'line', 'box edge': 'box edge', 'trend line': 'trend line' };
  function drawSay(c) { const d = c && c.draw; if (!d || !d.near) return ''; const P = (v) => fmtP(v, c.dec), sell = c.side === 'sell', q = [];
    const tl = (d.items || []).find((x) => x.kind === 'trend line');
    if (d.inBox) q.push(`${sell ? 'selling' : 'buying'} inside your drawn box`);
    else if (d.atLevel) q.push(`${sell ? 'selling' : 'buying'} at your drawn ${d.near.kind === 'line' ? 'level' : d.near.kind} ${P(d.near.price)} (${n1(d.near.dAtr)} ATR away)`);
    else q.push(`${n1(d.near.dAtr)} ATR ${d.near.pos === 'below' ? 'below' : d.near.pos === 'above' ? 'above' : 'from'} your nearest drawn ${d.near.kind === 'line' ? 'level' : d.near.kind} ${P(d.near.price)}`);
    if (d.prot && d.stopBehind != null) q.push(d.stopBehind ? `stop ${n1(d.stopBeyondAtr)} ATR ${sell ? 'above' : 'below'} ${d.prot.price === d.near.price ? 'it' : 'your ' + KW[d.prot.kind] + ' ' + P(d.prot.price)}` : `stop in front of your ${KW[d.prot.kind]} ${P(d.prot.price)}`);
    if (d.next && d.targetBefore != null) q.push(d.next.price === d.near.price ? `target ${d.targetBefore ? 'before' : 'past'} it` : `target ${d.targetBefore ? 'before' : 'past'} your next ${KW[d.next.kind]} at ${P(d.next.price)}`);
    if (tl && !(d.atLevel && d.near.kind === 'trend line')) q.push(`${tl.side} your trend line (${P(tl.value)} at entry${tl.respects ? '' : ', against it'})`);
    return q.join(', '); }
  // after a stop is changed by hand: remember whether it ever sat further from the entry than it opened (risk grew), at
  // break-even, or past the entry. Only records; the stop itself is never touched here.
  function coachStop(p) { if (!p || !(p.r0 > 0)) return p; const dir = p.side === 'buy' ? 1 : -1, d = (p.entry - p.stop) * dir;
    if (d > p.r0 * 1.001) p.stopAway = Math.max(p.stopAway || 0, r2((d - p.r0) / p.r0, 2)); if (Math.abs(d) <= p.r0 * 0.05) p.beMoved = true; else if (d < 0) p.stopLocked = true; return p; }
  // what the coach can see on a closed trade: suggestions for the review dialog, never a verdict. all = the session's closed records
  function coachFlags(t, all) { const out = []; if (!t) return out;
    if (t.stopAway > 0) out.push({ k: 'away', text: `Stop moved away from the entry (risk grew by ${Math.round(t.stopAway * 100)}%)`, mistake: 'Moved my stop' });
    if (t.beMoved) out.push({ k: 'be', text: 'Stop moved to break-even' });
    const rm = t.Rmove != null ? t.Rmove : t.R; if (/^manual/.test(t.reason || '') && t.target != null && rm > 0 && rm < 1) out.push({ k: 'early', text: `Closed by hand at ${n1(rm)}R in profit, before 1R and the target`, mistake: 'Exited early' });
    const prev = trades(all || []).filter((x) => x.id !== t.id && x.closedAt > 0 && x.closedAt <= t.openedAt).sort((x, y) => x.closedAt - y.closedAt).pop();
    if (prev && prev.net < 0 && t.openedAt - prev.closedAt <= COACH.revengeMin * 60) out.push({ k: 'revenge', text: `Opened ${Math.round((t.openedAt - prev.closedAt) / 60)} min after a loss: possible revenge trade`, mistake: 'Revenge trade' });
    const set = t.riskSet != null ? t.riskSet : t.ctx && t.ctx.riskSet, act = t.riskPct != null ? t.riskPct : t.ctx && t.ctx.riskPct;
    if (set > 0 && act > set * COACH.oversize) out.push({ k: 'size', text: `Risked ${n1(act)}% with ${n1(set)}% set`, mistake: 'Oversized' });
    const dw = t.ctx && t.ctx.draw; if (dw && dw.near && !dw.inBox && dw.near.dAtr > 1) out.push({ k: 'levels', text: `Entered away from your drawn levels (${n1(dw.near.dAtr)} ATR from the nearest)`, mistake: 'Against my plan' });
    return out; }
  // the owner's own record split by each context feature. Under minN trades a group is "too few to judge"; at minN or more it is
  // "your record, not a tested edge". t = mean R against zero (sd / sqrt n). Trades without context are counted apart (noCtx).
  const COACH_F = [
    ['htf', 'Higher-timeframe trend', (c) => (c.htfRel === 'with' ? 'With the trend' : c.htfRel === 'against' ? 'Against the trend' : c.htfRel === 'flat' ? 'No clear trend' : null)],
    ['session', 'Session', (c) => c.session || null],
    ['range', "Entry in yesterday's range", (c) => { const p = c.pd && c.pd.pos; return p == null ? null : p > 1 ? "Above yesterday's high" : p < 0 ? "Below yesterday's low" : p >= 2 / 3 ? 'Upper third' : p >= 1 / 3 ? 'Middle third' : 'Lower third'; }],
    ['stop', 'Stop size', (c) => (c.stopAtr == null ? null : c.stopAtr < 0.75 ? 'Under 0.75 ATR' : c.stopAtr <= 1.5 ? '0.75 to 1.5 ATR' : 'Over 1.5 ATR')],
    ['prev', 'After the last result', (c) => (c.prev && c.prev.res === 'loss' ? 'Right after a loss' : 'Not after a loss')],
    ['lvl', 'Your levels', (c) => (!c.draw || !c.draw.near ? null : c.draw.atLevel || c.draw.inBox ? 'At a drawn level' : 'Away from your levels')],
    ['lvlstop', 'Stop and your levels', (c) => (!c.draw || c.draw.stopBehind == null ? null : c.draw.stopBehind ? 'Stop behind a drawn level' : 'Stop not behind one')],
    ['grade', 'Your grade', (c) => (c.grade ? 'Grade ' + c.grade : null)],
    ['brk', 'Swing break', (c) => (c.brk ? (c.brk.rel === 'with' ? 'With a fresh break' : 'Against a fresh break') : 'No fresh break')],
    ['lens', 'The edge you read with', (c) => (c.lens && c.lens.edge ? `${c.lens.name || c.lens.edge}: ${c.lens.agree === 'with' ? 'with its side' : c.lens.agree === 'against' ? 'against it' : 'no signal'}` : null)],
  ];
  function grpStats(Rs, wins) { const n = Rs.length, m = n ? Rs.reduce((s, x) => s + x, 0) / n : null, sd = n > 1 ? Math.sqrt(Rs.reduce((s, x) => s + (x - m) * (x - m), 0) / (n - 1)) : null;
    return { n, wins, winRate: n ? r2(wins / n, 3) : null, meanR: m == null ? null : r2(m, 2), m, sd, t: sd > 0 ? r2(m / (sd / Math.sqrt(n)), 2) : null }; }
  function coachSplits(list, o = {}) { const minN = o.minN || COACH.minN, T = trades(list || []).filter((t) => t.R != null), withC = T.filter((t) => t.ctx && t.ctx.side), out = { n: T.length, noCtx: T.length - withC.length, minN, features: [], lead: null, diffs: [] };
    const sR = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R';
    for (const [k, name, f] of COACH_F) { const g = new Map(); for (const t of withC) { const lab = f(t.ctx); if (lab == null) continue; if (!g.has(lab)) g.set(lab, []); g.get(lab).push(t); }
      const groups = [...g.entries()].map(([label, a]) => { const s = grpStats(a.map((t) => t.R), a.filter((t) => t.net > 0).length); return { label, ...s, judge: s.n < minN ? 'too few to judge' : 'your record, not a tested edge', list: a }; });
      out.features.push({ k, name, groups: groups.map((x) => ({ label: x.label, n: x.n, wins: x.wins, winRate: x.winRate, meanR: x.meanR, t: x.t, judge: x.judge })) });
      for (const gr of groups) { const rest = groups.filter((x) => x !== gr).flatMap((x) => x.list); if (gr.n < minN || rest.length < minN) continue; const rs = grpStats(rest.map((t) => t.R), rest.filter((t) => t.net > 0).length), diff = gr.m - rs.m;
        const se = Math.sqrt((gr.sd || 0) ** 2 / gr.n + (rs.sd || 0) ** 2 / rs.n), wt = se > 0 ? r2(diff / se, 2) : null;
        out.diffs.push({ k, name, label: gr.label, n: gr.n, meanR: gr.meanR, restN: rs.n, restMeanR: rs.meanR, diff: r2(diff, 2), t: wt });
        if (!out.lead || Math.abs(diff) > Math.abs(out.lead.diff)) out.lead = { k, name, label: gr.label, n: gr.n, meanR: gr.meanR, restN: rs.n, restMeanR: rs.meanR, diff: r2(diff, 2), t: wt }; } }
    if (out.lead) { const L = out.lead; L.text = `Your largest difference: ${L.label.toLowerCase()} (${L.name.charAt(0).toLowerCase() + L.name.slice(1)}) made ${sR(L.meanR)} a trade (n ${L.n}) against ${sR(L.restMeanR)} for the rest (n ${L.restN})${L.t != null ? `, Welch t ${L.t.toFixed(2)}` : ''}. Your record, not a tested edge.`; }
    return out; }


  // ---- coach for results (17 Nov 2026, owner: "do more critical and useful for productivity and results improvements for the
  // coach"). Pure helpers, display and record only: none of them places, changes or refuses an order or moves a stop.
  // gatherSessions  one record across sessions: every saved session's closed trades (partial closes merged inside their own
  //                 session, never across), each labelled with its market and timeframe; ids become "<session>#<id>" so two
  //                 sessions' trade #1 stay two trades. Read only: the sessions passed in are not changed. o.current = the live
  //                 session (its account replaces the saved copy of the same id).
  function gatherSessions(sessions, o = {}) { const out = [], seen = new Set(), cur = o.current;
    const add = (s) => { const id = s && (s.id || 'now'); if (!s || !s.acct || !Array.isArray(s.acct.closed) || seen.has(id)) return; seen.add(id);
      const label = `${String(s.sym || '').toUpperCase()} ${s.tf || ''}`.trim();
      for (const t of trades(s.acct.closed)) out.push({ ...t, id: `${id}#${t.id}`, tid: t.id, sid: id, sess: { id, sym: s.sym || '', tf: s.tf || '', label } }); };
    if (cur) add(cur);
    for (const s of Object.values(sessions || {})) add(s);
    return { trades: out.sort((a, b) => (a.closedAt || 0) - (b.closedAt || 0)), sessions: seen.size }; }
  // what holding a trade closed by hand would have done: from the candles AFTER its exit only (time > closedAt, each ended by
  // `until`, the replay moment), to the stop and target it OPENED with (stop first when one candle holds both, a gap fills at
  // the open). An exit already at or past the opening stop counts as that stop. Never a candle at or before the exit: the trade's
  // own history is not rewritten. null = nothing to measure (no opening risk, or no candle after the exit yet).
  function exitCf(t, bars, sec, until) { if (!t || !(t.r0 > 0) || !(t.closedAt > 0) || t.exit == null) return null; const dir = t.side === 'buy' ? 1 : -1, s0 = t.entry - dir * t.r0;
    const tg = t.ctx && t.ctx.tgt0 != null ? t.ctx.tgt0 : t.target, R = (px) => r2((px - t.entry) * dir / t.r0, 2);
    if ((t.exit - s0) * dir <= 0) return { R: -1, how: 'stop', n: 0 };
    if (tg != null && (t.exit - tg) * dir >= 0) return { R: R(tg), how: 'target', n: 0 };
    let n = 0, last = null;
    for (const b of bars || []) { if (!(b.time > t.closedAt) || b.time + sec > until) continue; n++; last = b;
      const hitS = dir === 1 ? b.low <= s0 : b.high >= s0, hitT = tg != null && (dir === 1 ? b.high >= tg : b.low <= tg);
      if (hitS) return { R: R(dir === 1 ? Math.min(s0, b.open) : Math.max(s0, b.open)), how: 'stop', n, at: b.time };
      if (hitT) return { R: R(dir === 1 ? Math.max(tg, b.open) : Math.min(tg, b.open)), how: 'target', n, at: b.time }; }
    return last ? { R: R(last.close), how: 'open', n } : null; }
  const isManual = (t) => /^manual/.test((t && t.reason) || '');
  const isEarly = (t) => { const rm = t.Rmove != null ? t.Rmove : t.R; return isManual(t) && t.target != null && rm > 0 && rm < 1; };
  // revenge within one session: opened within COACH.revengeMin of a losing close of the same session
  function revengeOf(T) { const by = new Map(), out = new Set(); for (const t of T) { const k = t.sid || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
    for (const a of by.values()) for (const t of a) { let prev = null; for (const x of a) { if (x === t || !(x.closedAt <= t.openedAt)) continue; if (!prev || x.closedAt > prev.closedAt) prev = x; }
      if ((t.ctx && t.ctx.revenge) || (prev && prev.net < 0 && t.openedAt - prev.closedAt <= COACH.revengeMin * 60)) out.add(t); }
    return out; }
  const sRt = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R';
  // where the R goes: one row per habit, sorted by the R it cost. lost = R given up: the R lost on the habit's trades (their sum
  // when negative); for exits by hand the R that holding to the opening target or stop would have added (candles after the exit
  // only); for "stopped out after +1R" the R a break-even stop at +1R would have kept (from the recorded best price, approximate).
  // barsFor(t) -> { bars, sec, until } for a trade whose candles the page holds, else null. Under minN trades "too few to judge".
  const LEAK_K = [
    ['away', 'Moved the stop away', (t) => t.stopAway > 0],
    ['early', 'Exited early (by hand, under 1R)', isEarly],
    ['manual', 'Closed by hand', isManual],
    ['giveback', 'Stopped out after reaching +1R', (t) => (t.mfe || 0) >= 1 && t.R < 0],
    ['revenge', 'Revenge trades (within 30 min of a loss)', null],
    ['size', 'Oversized (over 1.1x your set risk)', (t) => { const set = t.riskSet != null ? t.riskSet : t.ctx && t.ctx.riskSet, act = t.riskPct != null ? t.riskPct : t.ctx && t.ctx.riskPct; return set > 0 && act > set * COACH.oversize; }],
    ['against', 'Against the higher-timeframe trend', (t) => !!(t.ctx && t.ctx.htfRel === 'against')],
    ['levels', 'Away from your drawn levels', (t) => { const d = t.ctx && t.ctx.draw; return !!(d && d.near && !d.atLevel && !d.inBox); }],
    ['session', 'Outside your best session', null],
  ];
  function coachLeaks(list, barsFor, o = {}) { const minN = o.minN || COACH.minN, T = trades(list || []).filter((t) => t.R != null), rv = revengeOf(T);
    const bs = {}; for (const t of T) if (t.ctx && t.ctx.session) (bs[t.ctx.session] = bs[t.ctx.session] || []).push(t.R);
    const ses = Object.entries(bs).map(([k, a]) => ({ k, n: a.length, m: a.reduce((s, x) => s + x, 0) / a.length })).sort((a, b) => b.m - a.m), sq = ses.filter((x) => x.n >= 4), best = ses.length > 1 && sq.length ? sq[0].k : null;   // the best session needs 4 trades or more
    const cfOf = new Map(); const cf = (t) => { if (!cfOf.has(t)) { const b = barsFor ? barsFor(t) : null; cfOf.set(t, b && b.bars ? exitCf(t, b.bars, b.sec, b.until) : null); } return cfOf.get(t); };
    const rows = [];
    for (const [k, name, f0] of LEAK_K) { const f = k === 'revenge' ? (t) => rv.has(t) : k === 'session' ? (t) => !!(best && t.ctx && t.ctx.session && t.ctx.session !== best) : f0; const a = T.filter(f); if (!a.length) continue;
      const sumR = r2(a.reduce((s, t) => s + t.R, 0), 2), row = { k, name: k === 'session' ? `Outside your best session (${best})` : name, n: a.length, wins: a.filter((t) => t.net > 0).length, sumR, meanR: r2(sumR / a.length, 2), judge: a.length < minN ? 'too few to judge' : 'your record, not a tested edge', lost: Math.max(0, -sumR) };
      if (k === 'early' || k === 'manual') { const m = a.map((t) => [t, cf(t)]).filter((x) => x[1]); const held = r2(m.reduce((s, x) => s + x[1].R, 0), 2), act = r2(m.reduce((s, x) => s + x[0].R, 0), 2);
        row.held = { n: m.length, R: held, actual: act, gain: r2(held - act, 2), open: m.filter((x) => x[1].how === 'open').length, unmeasured: a.length - m.length }; row.lost = m.length ? Math.max(0, row.held.gain) : 0; }
      if (k === 'giveback') { row.be = { gain: r2(-sumR, 2), approx: true }; row.lost = Math.max(0, -sumR); }
      row.lost = r2(row.lost, 2); rows.push(row); }
    rows.sort((a, b) => b.lost - a.lost || a.meanR - b.meanR);
    // break-even at +1R across every trade (recorded best price only) and how much of the best move the winners kept
    const reach = T.filter((t) => (t.mfe || 0) >= 1), gave = reach.filter((t) => t.R < 0), win = T.filter((t) => t.R > 0 && t.mfe > 0);
    const be = { reached: reach.length, lostAfter: gave.length, gain: r2(-gave.reduce((s, t) => s + t.R, 0), 2) };
    const capture = win.length ? { n: win.length, R: r2(win.reduce((s, t) => s + t.R, 0), 2), mfe: r2(win.reduce((s, t) => s + t.mfe, 0), 2), ratio: r2(win.reduce((s, t) => s + t.R, 0) / win.reduce((s, t) => s + t.mfe, 0), 2) } : null;
    const top = rows.find((r) => r.lost > 0); let headline = T.length ? 'No leak measured yet: no habit has cost R so far.' : '';
    if (top) { headline = `Your biggest leak: ${top.name.charAt(0).toLowerCase() + top.name.slice(1)}, ${sRt(-top.lost)} over ${top.n} trade${top.n === 1 ? '' : 's'}`;
      if (top.held && top.held.n) headline += `; holding to the opening target or stop would have made ${sRt(top.held.R)} instead of ${sRt(top.held.actual)}${top.held.open ? ` (${top.held.open} still open at the replay moment, marked to the last close)` : ''}`;
      else if (top.be) headline += '; a break-even stop at +1R would have kept that (from the recorded best price)';
      else headline += ` (${sRt(top.meanR)} a trade)`;
      headline += `. ${top.n < minN ? 'Too few trades to judge.' : 'Your record, not a tested edge.'}`; }
    return { n: T.length, minN, best, rows, be, capture, headline, top: top ? top.k : null }; }
  // patterns: a split (coachSplits) with minN or more trades on BOTH sides and a Welch |t| of 2 or more. bad = did worse than
  // the rest. The text carries the numbers; it is the trader's own record, never a tested edge.
  function coachPatterns(list, o = {}) { const sp = coachSplits(list, o), tMin = o.tMin || 2;
    return (sp.diffs || []).filter((d) => d.t != null && Math.abs(d.t) >= tMin && d.n >= sp.minN && d.restN >= sp.minN).map((d) => ({ ...d, bad: d.diff < 0,
      text: `${d.label} (${d.name.charAt(0).toLowerCase() + d.name.slice(1)}): ${sRt(d.meanR)} a trade, n ${d.n}, against ${sRt(d.restMeanR)} for the rest (n ${d.restN}), t ${(d.t < 0 ? '−' : '') + Math.abs(d.t).toFixed(2)}. Your record, not a tested edge.` })).sort((a, b) => Math.abs(b.t) - Math.abs(a.t)); }
  // the negative patterns a new entry's context matches (a warning only: it never refuses or changes an order)
  function patternMatch(pats, ctx) { if (!ctx || !ctx.side) return []; return (pats || []).filter((p) => { if (!p.bad) return false; const f = COACH_F.find((x) => x[0] === p.k); return !!(f && f[2](ctx) === p.label); }); }
  // the session plan (owner-set, per device): max trades a day, max daily loss in R, stop after n losses in a row today, a focus
  // rule, and whether to ask before trading past it / ask a grade on each entry. planNorm keeps only known fields with sane values.
  function planNorm(p) { p = p && typeof p === 'object' ? p : {}; const int = (v, max) => { const x = Math.round(+v); return Number.isFinite(x) && x > 0 ? Math.min(max, x) : 0; };
    const lr = +p.maxLossR; return { maxTrades: int(p.maxTrades, 100), maxLossR: Number.isFinite(lr) && lr > 0 ? Math.min(100, Math.round(lr * 100) / 100) : 0, maxLosses: int(p.maxLosses, 50),
      focus: String(p.focus == null ? '' : p.focus).replace(/\s+/g, ' ').trim().slice(0, 200), nextFocus: String(p.nextFocus == null ? '' : p.nextFocus).replace(/\s+/g, ' ').trim().slice(0, 200), ask: p.ask === true, askGrade: p.askGrade === true }; }
  // where today (the replay's UTC day of `now`) stands against the plan; broken = limits reached: the next trade goes past the plan
  function planCheck(plan, closed, open, now) { const P = planNorm(plan), day = dayKey(now), T = trades(closed || []).filter((t) => t.closedAt > 0).sort((a, b) => a.closedAt - b.closedAt);
    const tod = T.filter((t) => dayKey(t.closedAt) === day), opened = T.filter((t) => dayKey(t.openedAt) === day).length + (open || []).filter((p) => p.openedAt > 0 && dayKey(p.openedAt) === day).length;
    const R = r2(tod.reduce((s, t) => s + (t.R || 0), 0), 2); let streak = 0; for (let i = tod.length - 1; i >= 0 && tod[i].net < 0; i--) streak++;
    const broken = [];
    if (P.maxTrades && opened >= P.maxTrades) broken.push({ k: 'trades', text: `${opened} of ${P.maxTrades} trades taken today: the next one is past your plan` });
    if (P.maxLossR && R <= -P.maxLossR) broken.push({ k: 'loss', text: `Down ${sRt(R)} today: your daily limit is −${P.maxLossR}R` });
    if (P.maxLosses && streak >= P.maxLosses) broken.push({ k: 'streak', text: `${streak} losses in a row today: you planned to stop after ${P.maxLosses}` });
    return { day, trades: opened, R, streak, broken, set: !!(P.maxTrades || P.maxLossR || P.maxLosses) }; }
  // plan adherence over a record: per UTC day (of one session), the trades opened when a limit had already been reached that day
  function planAdherence(plan, list) { const P = planNorm(plan); if (!(P.maxTrades || P.maxLossR || P.maxLosses)) return null; const T = trades(list || []).filter((t) => t.closedAt > 0), days = new Map();
    for (const t of T) { const k = (t.sid || '') + '|' + dayKey(t.openedAt); if (!days.has(k)) days.set(k, []); days.get(k).push(t); }
    let past = 0, kept = 0; const items = [];
    for (const [k, a] of days) { let bad = 0;
      for (const t of a) { const before = a.filter((x) => x !== t && x.closedAt <= t.openedAt).sort((x, y) => x.closedAt - y.closedAt), opened = a.filter((x) => x !== t && x.openedAt < t.openedAt).length;
        const R = before.reduce((s, x) => s + (x.R || 0), 0); let st = 0; for (let i = before.length - 1; i >= 0 && before[i].net < 0; i--) st++;
        if ((P.maxTrades && opened >= P.maxTrades) || (P.maxLossR && R <= -P.maxLossR) || (P.maxLosses && st >= P.maxLosses)) bad++; }
      past += bad; if (!bad) kept++; else items.push({ day: k.split('|')[1], past: bad }); }
    return { days: days.size, kept, past, items }; }
  // a focus rule for the next session from the top leak (deterministic; the AI debrief may give its own)
  const FOCUS = { away: 'Keep the stop where you set it at entry: move it only toward the trade, never away.', early: 'Hold each trade to its target or its stop unless your written exit rule says otherwise.',
    manual: 'Close by hand only when your written exit rule says so.', giveback: 'Decide before the entry what you do once a trade reaches +1R, and write it in the plan.', revenge: 'Wait 30 minutes after a loss before the next entry.',
    size: 'Risk exactly your set % on every trade.', against: 'Take entries only with the higher-timeframe trend.', levels: 'Enter only at a level you drew before the entry.', session: (b) => `Trade only in your best session (${b}).` };
  // the free part of the end-of-session debrief: totals, plan adherence, the top leaks, best and worst trade, results by grade
  function coachDebrief(list, o = {}) { const T = trades(list || []).filter((t) => t.R != null).sort((a, b) => a.closedAt - b.closedAt), L = coachLeaks(T, o.barsFor, o);
    const byR = T.slice().sort((a, b) => b.R - a.R), g = {};
    for (const t of T) { const gr = (t.ctx && t.ctx.grade) || t.grade; if (!GRADES.includes(gr)) continue; g[gr] = g[gr] || { grade: gr, n: 0, R: 0, wins: 0 }; g[gr].n++; g[gr].R = r2(g[gr].R + t.R, 2); if (t.net > 0) g[gr].wins++; }
    const grades = GRADES.filter((k) => g[k]).map((k) => ({ ...g[k], meanR: r2(g[k].R / g[k].n, 2), judge: g[k].n < (o.minN || COACH.minN) ? 'too few to judge' : 'your record, not a tested edge' }));
    const pick = (t) => (t ? { id: t.tid || t.id, side: t.side, R: t.R, net: t.net, openedAt: t.openedAt, label: t.sess ? t.sess.label : '', ctx: t.ctx || null } : null);
    const top = L.rows.find((r) => r.lost > 0), f = top ? FOCUS[top.k] : null;
    return { n: T.length, R: r2(T.reduce((s, t) => s + t.R, 0), 2), wins: T.filter((t) => t.net > 0).length, adherence: planAdherence(o.plan, T), leaks: L.rows.filter((r) => r.lost > 0).slice(0, 3), headline: L.headline, be: L.be, capture: L.capture,
      best: byR[0] && byR[0].R > 0 ? pick(byR[0]) : null, worst: byR.length && byR[byR.length - 1].R < 0 ? pick(byR[byR.length - 1]) : null, grades, focus: typeof f === 'function' ? f(L.best) : f || '', minN: L.minN }; }

  // ---- drawing tools (17 Nov 2026, owner: "the backtest drawings need to be like TradingView: the boxes, lines, trend line,
  // magnet, resize box and lines"). Display only: a drawing never places, changes or refuses an order and never moves a stop.
  // A shape is { type, …points, at, editedAt?, col?, w?, ls?, ext?, lock?, lbl? }; points are [time, price] like before:
  //   h  horizontal line { price }          hr horizontal ray { t1, p1 } (from t1 to the right)
  //   v  vertical line { t1 }               t  trend line { t1, p1, t2, p2 } (ext: extended to the right)
  //   r  box { t1, p1, t2, p2 }             at = the replay moment it was drawn (the trade coach reads only at <= the entry);
  // an edit keeps at and stamps editedAt. Older sessions and the Mosha hand-over store h / t / r without the style fields.
  //   f  Fibonacci retracement { t1, p1, t2, p2 } (levels FIB_LEVELS: 1 at the first point, 0 at the second; ext: levels to the right)
  //   a  arrow { t1, p1, t2, p2 } (head at the second point)      x  text { t1, p1, text } (19 Nov 2026, the Desk's charts)
  const DRAW_TYPES = ['h', 'hr', 'v', 't', 'r', 'f', 'a', 'x'], FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], DRAW_COLS = ['draw', 'up', 'dn', 'gold', 'ink'];
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  function drawNorm(list) { const out = []; for (const d of Array.isArray(list) ? list : []) { if (!d || !DRAW_TYPES.includes(d.type)) continue;
      const need = d.type === 'h' ? ['price'] : d.type === 'v' ? ['t1'] : d.type === 'hr' || d.type === 'x' ? ['t1', 'p1'] : ['t1', 'p1', 't2', 'p2']; if (!need.every((k) => fin(d[k]))) continue;
      const txt = d.type === 'x' ? textOf(d.text) : ''; if (d.type === 'x' && !txt) continue;
      const o = { type: d.type }; for (const k of need) o[k] = d[k]; if (txt) o.text = txt; if (fin(d.at)) o.at = d.at; if (fin(d.editedAt)) o.editedAt = d.editedAt;
      if (DRAW_COLS.includes(d.col) && d.col !== 'draw') o.col = d.col; if ([2, 3].includes(d.w)) o.w = d.w; if (d.ls === 'dash') o.ls = 'dash';
      if (d.ext === true && (d.type === 't' || d.type === 'f')) o.ext = true; if (d.lock === true) o.lock = true; if (d.lbl === true && (d.type === 't' || d.type === 'r')) o.lbl = true;
      if (d.alert === true && ['h', 'hr', 't'].includes(d.type)) o.alert = true; if (fin(d.fired)) o.fired = d.fired; out.push(o); }
    return out; }
  // a text shape's words: plain, one line, at most 120 characters
  function textOf(v) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : ''; }
  const TEXT_PX = [13, 16, 20];   // a text shape's font size by its width setting (1-3)
  // magnet: the price snaps to the hovered candle's open / high / low / close nearest in pixels; weak (1) only within tol px,
  // strong (2) always; off (0) leaves it. Y maps a price to its pixel row. A point with no candle under it is left alone.
  function drawSnap(bar, price, Y, mode, tol = 12) { if (!mode || !bar || !fin(price)) return price; const yp = Y(price); if (yp == null) return price; let best = null, bd = Infinity;
    for (const v of [bar.open, bar.high, bar.low, bar.close]) { const yy = Y(v); if (yy == null) continue; const dd = Math.abs(yy - yp); if (dd < bd) { bd = dd; best = v; } }
    return best != null && (mode >= 2 || bd <= tol) ? best : price; }
  // pixel geometry of a shape: X maps a time to x, Y a price to y, W / H the price pane. null when a point is off the scales.
  function drawGeom(d, X, Y, W, H) { const g = { type: d.type, pts: [] };
    if (d.type === 'h') { const y = Y(d.price); if (y == null) return null; Object.assign(g, { x1: 0, y1: y, x2: W, y2: y }); g.pts = [['a', W / 2, y]]; return g; }
    if (d.type === 'v') { const x = X(d.t1); if (x == null) return null; Object.assign(g, { x1: x, y1: 0, x2: x, y2: H }); g.pts = [['a', x, H / 2]]; return g; }
    const x1 = X(d.t1), y1 = Y(d.p1); if (x1 == null || y1 == null) return null;
    if (d.type === 'hr') { Object.assign(g, { x1, y1, x2: Math.max(x1, W), y2: y1 }); g.pts = [['a', x1, y1]]; return g; }
    if (d.type === 'x') { const fs = TEXT_PX[(d.w || 1) - 1] || 13; Object.assign(g, { x1, y1, x2: x1 + Math.max(12, String(d.text || '').length * fs * 0.58) + 8, y2: y1 - fs - 6, fs }); g.pts = [['a', x1, y1]]; return g; }
    const x2 = X(d.t2), y2 = Y(d.p2); if (x2 == null || y2 == null) return null; Object.assign(g, { x1, y1, x2, y2 });
    if (d.type === 'a') { g.pts = [['a', x1, y1], ['b', x2, y2]]; return g; }
    if (d.type === 'f') { g.pts = [['a', x1, y1], ['b', x2, y2]]; g.fx1 = Math.min(x1, x2); g.fx2 = d.ext ? Math.max(W, x1, x2) : Math.max(x1, x2); g.lv = FIB_LEVELS.map((r) => [r, y2 + (y1 - y2) * r]); return g; }
    if (d.type === 't') { g.pts = [['a', x1, y1], ['b', x2, y2]]; if (d.ext && x2 !== x1) { const k = (y2 - y1) / (x2 - x1), xe = x2 > x1 ? W : 0; g.xe = xe; g.ye = y2 + k * (xe - x2); } return g; }
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; g.pts = [['c11', x1, y1], ['c22', x2, y2], ['c12', x1, y2], ['c21', x2, y1], ['ep1', mx, y1], ['ep2', mx, y2], ['et1', x1, my], ['et2', x2, my]]; return g; }
  const segD = (xp, yp, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, u = L2 ? Math.max(0, Math.min(1, ((xp - ax) * dx + (yp - ay) * dy) / L2)) : 0; return Math.hypot(xp - (ax + u * dx), yp - (ay + u * dy)); };
  // what the pointer is on: a handle ('a', 'b', a box corner 'c11' / 'c22' / 'c12' / 'c21' or edge 'ep1' / 'ep2' / 'et1' /
  // 'et2') within hTol px, else the body (the line, the box's inside or outline) within tol px, else null
  function drawHit(g, xp, yp, tol = 6, hTol = 7) { if (!g) return null; let best = null, bd = Infinity;
    for (const [k, x, y] of g.pts) { const dd = Math.hypot(xp - x, yp - y); if (dd <= hTol && dd < bd) { bd = dd; best = k; } } if (best) return best;
    if (g.type === 'h') return Math.abs(yp - g.y1) <= tol ? 'body' : null;
    if (g.type === 'v') return Math.abs(xp - g.x1) <= tol && yp >= 0 && yp <= g.y2 ? 'body' : null;
    if (g.type === 'x') return xp >= g.x1 - tol && xp <= g.x2 + tol && yp >= g.y2 - tol && yp <= g.y1 + tol ? 'body' : null;
    if (g.type === 'f') { if (xp >= g.fx1 - tol && xp <= g.fx2 + tol && g.lv.some(([, y]) => Math.abs(yp - y) <= tol)) return 'body'; return segD(xp, yp, g.x1, g.y1, g.x2, g.y2) <= tol ? 'body' : null; }
    if (g.type === 'r') return xp >= Math.min(g.x1, g.x2) - tol && xp <= Math.max(g.x1, g.x2) + tol && yp >= Math.min(g.y1, g.y2) - tol && yp <= Math.max(g.y1, g.y2) + tol ? 'body' : null;
    const ex = g.xe != null ? g.xe : g.x2, ey = g.ye != null ? g.ye : g.y2; return segD(xp, yp, g.x1, g.y1, ex, ey) <= tol ? 'body' : null; }
  // drag a handle to (t, p): a trend line's or ray's end, a box corner (both coordinates) or edge (one), a vertical line's time
  function drawResize(d, part, t, p) { const o = { ...d };
    if (d.type === 'h') { if (fin(p)) o.price = p; return o; } if (d.type === 'v') { if (fin(t)) o.t1 = t; return o; }
    const set = (tk, pk) => { if (tk && fin(t)) o[tk] = t; if (pk && fin(p)) o[pk] = p; };
    if (['hr', 't', 'f', 'a', 'x'].includes(d.type)) { if (part === 'a') set('t1', 'p1'); else if (part === 'b' && ['t', 'f', 'a'].includes(d.type)) set('t2', 'p2'); return o; }
    ({ c11: () => set('t1', 'p1'), c22: () => set('t2', 'p2'), c12: () => set('t1', 'p2'), c21: () => set('t2', 'p1'), ep1: () => set(null, 'p1'), ep2: () => set(null, 'p2'), et1: () => set('t1', null), et2: () => set('t2', null) }[part] || (() => {}))(); return o; }
  // move the whole shape: every time through fT, every price through fP (the page maps them through pixels, so a move keeps
  // its shape on screen across weekend gaps)
  function drawMove(d, fT, fP) { const o = { ...d }; for (const k of ['t1', 't2']) if (fin(d[k])) o[k] = fT(d[k]); for (const k of ['p1', 'p2', 'price']) if (fin(d[k])) o[k] = fP(d[k]); return o; }
  // bars from ta to tb: whole candles of the list (n replayed), extended at one per step past the last
  function barsBetween(bars, n, sec, ta, tb) { if (!n) return 0; const a = Math.min(ta, tb), b = Math.max(ta, tb), lb = (t) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time < t) lo = m + 1; else hi = m; } return lo; };
    const last = bars[n - 1].time, ix = (t) => t > last ? (n - 1) + Math.round((t - last) / sec) : lb(t); return ix(b) - ix(a); }
  // the optional label: the move from the first point to the second in price, %, bars (and the angle on screen for a line)
  function drawInfo(d, nBars, ang, dec = 2) { if (d.type !== 't' && d.type !== 'r') return ''; const dp = d.p2 - d.p1, pc = d.p1 ? dp / d.p1 * 100 : 0, sg = dp > 0 ? '+' : dp < 0 ? '−' : '';
    const s = `${sg}${Math.abs(dp).toFixed(dec)} (${sg}${Math.abs(pc).toFixed(2)}%) · ${nBars} bar${nBars === 1 ? '' : 's'}`; return d.type === 't' && fin(ang) ? `${s} · ${Math.round(ang)}°` : s; }

  // ---- split charts move together and share drawings (17 Nov 2026, owner: "on charts all should be synced moving same time
  // and when I draw in one should show on the others"). Each chart's view is a logical range (fractional bar index); charts
  // on other timeframes are matched by TIME, never by index. One convention for every chart (the page's timeToX): a candle's
  // start time sits at its index, a time inside a candle in proportion, a time in a gap (a weekend) at the next candle, and
  // before the first / past the last candle one index per timeframe step. bars = what the chart shows (n of them).
  function tfLogical(bars, n, sec, t) { if (!n || !fin(t) || !(sec > 0)) return null; const f = bars[0].time, last = bars[n - 1].time;
    if (t <= f) return (t - f) / sec; if (t >= last) return (n - 1) + (t - last) / sec;
    let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time < t) lo = m + 1; else hi = m; }
    if (bars[lo].time === t) return lo; const pv = bars[lo - 1]; return t < pv.time + sec ? lo - 1 + (t - pv.time) / sec : lo; }
  function tfTimeAt(bars, n, sec, lg) { if (!n || !fin(lg) || !(sec > 0)) return null; if (lg <= 0) return bars[0].time + lg * sec;
    if (lg >= n - 1) return bars[n - 1].time + (lg - (n - 1)) * sec; const i = Math.floor(lg); return bars[i].time + (lg - i) * sec; }
  // a view range { from, to } of one chart → the same time window as a range of another; src / dst = { bars, n, sec }
  function syncRange(src, dst, r) { if (!r) return null; const a = tfTimeAt(src.bars, src.n, src.sec, r.from), b = tfTimeAt(src.bars, src.n, src.sec, r.to);
    if (a == null || b == null) return null; const from = tfLogical(dst.bars, dst.n, dst.sec, a), to = tfLogical(dst.bars, dst.n, dst.sec, b);
    return from == null || to == null || !(to > from) ? null : { from, to }; }
  // the guard against charts echoing each other: a range change that equals the one just set on that chart (within tol bars,
  // within ms) is the echo of the sync, not the person moving it
  function syncEcho(exp, r, now, ms = 400, tol = 0.02) { return !!(exp && r && now - exp.at <= ms && Math.abs(r.from - exp.from) <= tol && Math.abs(r.to - exp.to) <= tol); }
  // the magnet on a chart of its own timeframe: the candle that holds t, only when it CLOSED by the replay moment T
  function closedBarAt(bars, n, sec, t, T) { if (!n || !fin(t)) return null; let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time <= t) lo = m + 1; else hi = m; }
    const b = bars[lo - 1]; return b && t < b.time + sec && b.time + sec <= T ? b : null; }

  // ---- the live coach's market events (17 Nov 2026, owner: "the live AI while backtesting needs to be more live") ----------------
  // Pure: what happened on the candles that CLOSED since the last look (never one that ends after the moment T), for the panel's
  // free notes and, the most important one, for the AI. st = the caller's memory between calls ({} the first time; it holds the
  // last moment looked at and what was already said). o = { positions, draw, draft: { key, since } | null }. Events:
  //   level   a close through, or a touch of, a drawn line / ray / box edge / trend line (lineAt at the candle's time)    imp 3 / 2
  //   stop / target   a close within 0.25R of an open position's stop (imp 3) or target (imp 2); said again after 0.5R away
  //   swing   a close through the last swing high / low (the coach's swing rule, 3 candles a side)                       imp 2
  //   session Asia, London or New York opens (the stats' UTC hours)                                                      imp 1
  //   big     a candle whose range is over 2x the ATR(14) of the candles before it                                       imp 2
  //   r       an open position's floating R crosses +1R (imp 3) or -0.5R (imp 2), once each per position
  //   draft   an order set up and not placed for 5 candles                                                               imp 1
  // At most the last LIVE_EV.look candles are read (a jump does not flood the panel); each event has t = its candle's close.
  const LIVE_EV = { near: 0.25, away: 0.5, big: 2, draftBars: 5, look: 3, swingK: 3 };
  function liveEvents(bars, sec, T, st, o = {}) {
    const out = [], n = closedBy(bars, sec, T); if (!st || n < 2) { if (st) st.T = T; return out; }
    const first = st.T == null ? n - 1 : Math.max(1, n - LIVE_EV.look), done = (b) => st.T != null && b.time + sec <= st.T;
    st.said = st.said || {}; st.posR = st.posR || {}; st.near = st.near || {};
    const say = (key, ev) => { if (st.said[key]) return; st.said[key] = 1; out.push(ev); };
    const draw = (o.draw || []).filter((d) => d && ['h', 'hr', 't', 'r'].includes(d.type));
    const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(2) : String(+v.toFixed(5)));
    for (let i = first; i < n; i++) { const b = bars[i], pv = bars[i - 1], t = b.time + sec; if (done(b)) continue;
      // drawn levels: the value of each at this candle's time
      draw.forEach((d, k) => { const lv = []; if (d.type === 'h') lv.push(['line', d.price]); else if (d.type === 'hr') { if (b.time >= d.t1) lv.push(['ray', d.p1]); }
        else if (d.type === 'r') { lv.push(['box top', Math.max(d.p1, d.p2)], ['box bottom', Math.min(d.p1, d.p2)]); } else if (d.t2 !== d.t1 || d.p2 === d.p1) lv.push(['trend line', lineAt(d, b.time)]);
        for (const [kind, v] of lv) { if (!(v > 0)) continue; const up = pv.close < v && b.close > v, dn = pv.close > v && b.close < v;
          if (up || dn) say(`lv${k}|${kind}|${b.time}`, { k: 'level', imp: 3, t, text: `Closed ${up ? 'above' : 'below'} your drawn ${kind} at ${fmt(v)}.` });
          else if (b.low <= v && b.high >= v) say(`lt${k}|${kind}|${b.time}`, { k: 'level', imp: 2, t, text: `Touched your drawn ${kind} at ${fmt(v)} and closed ${b.close >= v ? 'above' : 'below'} it.` }); } });
      // a fresh close through the last swing
      const sw = swingBreak(bars.slice(Math.max(0, i - 60), i + 1), LIVE_EV.swingK, 1);
      if (sw && sw.ago === 0) say(`sw|${b.time}`, { k: 'swing', imp: 2, t, text: `Closed ${sw.dir === 'up' ? 'above the last swing high' : 'below the last swing low'} at ${fmt(sw.level)}.` });
      // a session opens
      const h0 = new Date(pv.time * 1000).getUTCHours(), h1 = new Date(b.time * 1000).getUTCHours();
      if (sessOfHour(h0) !== sessOfHour(h1) && b.time - pv.time < 6 * 3600) say(`ss|${b.time}`, { k: 'session', imp: 1, t: b.time, text: `${sessOfHour(h1)} opens.` });
      // a big candle
      const a = atrOf(bars.slice(Math.max(0, i - 15), i)); if (a > 0 && b.high - b.low > LIVE_EV.big * a) say(`bg|${b.time}`, { k: 'big', imp: 2, t, text: `A big candle: its range is ${((b.high - b.low) / a).toFixed(1)}x the ATR, closing ${b.close >= b.open ? 'up' : 'down'}.` });
      // open positions: near the stop / target, floating R crossing +1R / -0.5R
      for (const p of o.positions || []) { if (!(p.r0 > 0) || !(p.openedAt <= b.time)) continue; const dir = p.side === 'buy' ? 1 : -1, R = (b.close - p.entry) * dir / p.r0, id = p.id;
        const ds = Math.abs(b.close - p.stop) / p.r0, dt = p.target != null ? Math.abs(p.target - b.close) / p.r0 : Infinity, nr = st.near[id] = st.near[id] || {};
        if (ds <= LIVE_EV.near && !nr.s) { nr.s = 1; out.push({ k: 'stop', imp: 3, t, text: `Price is within ${LIVE_EV.near}R of your ${p.side} stop at ${fmt(p.stop)}.` }); } else if (ds > LIVE_EV.away) nr.s = 0;
        if (dt <= LIVE_EV.near && !nr.t) { nr.t = 1; out.push({ k: 'target', imp: 2, t, text: `Price is within ${LIVE_EV.near}R of your ${p.side} target at ${fmt(p.target)}.` }); } else if (dt > LIVE_EV.away) nr.t = 0;
        const pr = st.posR[id] = st.posR[id] || {};
        if (R >= 1 && !pr.up) { pr.up = 1; out.push({ k: 'r', imp: 3, t, text: `Your ${p.side} is ${R.toFixed(2)}R in profit.` }); }
        if (R <= -0.5 && !pr.dn) { pr.dn = 1; out.push({ k: 'r', imp: 2, t, text: `Your ${p.side} is ${R.toFixed(2)}R against you.` }); } } }
    // an order set up and not placed for a while
    const dr = o.draft; if (dr && dr.key && dr.since > 0) { const waited = Math.floor((T - dr.since) / sec); if (waited >= LIVE_EV.draftBars) say(`dr|${dr.key}`, { k: 'draft', imp: 1, t: T, text: `An order has been set up for ${waited} candles and not placed.` }); }
    st.T = T; return out;
  }
  const BT = { FIRMS, trades, newAccount, units, place, cancel, close, closePartial, trail, onBar, equity, pnl, stats, holdSec, durText, byDay, dayKey, newChallenge, evaluate, monteCarlo, bestRisk, r2,
    TF_SECS, tfMoment, tfHold, tfPlan, tfFineSec, tfWindow, tfPart, tfEnter, tfSeat, tfUnseat, tfNext, advance, tfResume, tfStamp, tfProgress, sessionName,
    COACH, lensSay, closedBy, bucketBars, trendOf, atrOf, swingBreak, coachCtx, coachDraw, lineAt, coachSentence, coachStop, coachFlags, coachSplits,
    GRADES, gatherSessions, exitCf, coachLeaks, coachPatterns, patternMatch, planNorm, planCheck, planAdherence, coachDebrief,
    DRAW_TYPES, DRAW_COLS, FIB_LEVELS, TEXT_PX, drawNorm, drawSnap, drawGeom, drawHit, drawResize, drawMove, barsBetween, drawInfo, tfLogical, tfTimeAt, syncRange, syncEcho, closedBarAt, LIVE_EV, liveEvents };
  if (typeof module !== 'undefined' && module.exports) module.exports = BT; else root.BT = BT;
})(typeof globalThis !== 'undefined' ? globalThis : this);

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
    const p = { ...rec, entry: px, openedAt: t, mfe: 0, mae: 0, r0: Math.abs(px - rec.stop) };
    a.positions.push(p); a.orders = a.orders.filter((o) => o.id !== rec.id); return p;
  }
  function cancel(a, id) { a.orders = a.orders.filter((o) => o.id !== id); }
  function close(a, p, px, t, reason) {
    const gross = pnl(p, px), net = gross - a.commission;
    a.balance = r2(a.balance + net);
    const c = { ...p, exit: px, closedAt: t, reason, gross: r2(gross), net: r2(net), R: p.r0 ? r2((px - p.entry) * (p.side === 'buy' ? 1 : -1) / p.r0, 2) : null, holdBars: p.holdBars || 0 };
    a.closed.push(c); a.positions = a.positions.filter((x) => x.id !== p.id); return c;
  }
  // close part of a position: the closed part becomes its own journal record (same entry, R on the full stop distance)
  function closePartial(a, p, px, t, fraction, reason = 'partial') {
    const f = Math.min(0.999, Math.max(0.001, fraction || 0.5)), part = { ...p, units: p.units * f, id: p.id, partial: true };
    const gross = pnl(part, px), net = gross - a.commission; a.balance = r2(a.balance + net);
    const c = { ...part, exit: px, closedAt: t, reason, gross: r2(gross), net: r2(net), R: p.r0 ? r2((px - p.entry) * (p.side === 'buy' ? 1 : -1) / p.r0, 2) : null, holdBars: p.holdBars || 0, note: `${p.note || ''} (${Math.round(f * 100)}% closed)`.trim() };
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
      if (hitS && hitT) { const sl = a.slFirst; out.push({ kind: 'close', trade: close(a, p, sl ? p.stop : p.target, b.time, sl ? 'stop (both in one bar)' : 'target (both in one bar)') }); }
      else if (hitS) { const px = dir === 1 ? Math.min(p.stop, b.open) : Math.max(p.stop, b.open); out.push({ kind: 'close', trade: close(a, p, px, b.time, px === p.stop ? 'stop' : 'stop (gap)') }); }
      else if (hitT) out.push({ kind: 'close', trade: close(a, p, p.target, b.time, 'target') });
      else trail(p, b);
    }
    return out;
  }
  const equity = (a, px) => r2(a.balance + a.positions.reduce((s, p) => s + pnl(p, px), 0));

  // ---- statistics (the journal) -------------------------------------------------------------------------------------
  function stats(closed, start) {
    const n = closed.length, wins = closed.filter((t) => t.net > 0), losses = closed.filter((t) => t.net < 0);
    const gw = wins.reduce((s, t) => s + t.net, 0), gl = -losses.reduce((s, t) => s + t.net, 0), net = r2(gw - gl);
    let peak = start, dd = 0, eq = start; const curve = [{ t: closed[0] ? closed[0].openedAt : null, eq: start }];
    for (const t of closed) { eq = r2(eq + t.net); peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); curve.push({ t: t.closedAt, eq }); }
    let bestStreak = 0, worstStreak = 0, cur = 0; for (const t of closed) { if (t.net > 0) { cur = cur > 0 ? cur + 1 : 1; bestStreak = Math.max(bestStreak, cur); } else if (t.net < 0) { cur = cur < 0 ? cur - 1 : -1; worstStreak = Math.min(worstStreak, cur); } }
    const Rs = closed.map((t) => t.R).filter((x) => x != null), netR = r2(Rs.reduce((s, x) => s + x, 0));
    const by = (f) => { const o = {}; for (const t of closed) { const k = f(t); if (k == null) continue; o[k] = o[k] || { n: 0, net: 0, wins: 0, R: 0 }; o[k].n++; o[k].net = r2(o[k].net + t.net); o[k].R = r2(o[k].R + (t.R || 0)); if (t.net > 0) o[k].wins++; } return o; };
    const hourOf = (t) => new Date(t.openedAt * 1000).getUTCHours(), dayOf = (t) => new Date(t.openedAt * 1000).getUTCDay();
    const holdAvg = n ? r2(closed.reduce((s, t) => s + (t.holdBars || 0), 0) / n, 1) : null, rDist = {}; for (const x of Rs) { const k = x <= -1 ? '≤-1R' : x < 0 ? '-1..0' : x < 1 ? '0..1R' : x < 2 ? '1..2R' : x < 3 ? '2..3R' : '≥3R'; rDist[k] = (rDist[k] || 0) + 1; }
    return { n, holdAvg, rDist, wins: wins.length, losses: losses.length, winRate: n ? r2(wins.length / n, 3) : null, net, netR, avgR: Rs.length ? r2(netR / Rs.length, 2) : null,
      profitFactor: gl > 0 ? r2(gw / gl) : gw > 0 ? Infinity : null, expectancy: n ? r2(net / n) : null, avgWin: wins.length ? r2(gw / wins.length) : null, avgLoss: losses.length ? r2(gl / losses.length) : null,
      best: n ? Math.max(...closed.map((t) => t.net)) : null, worst: n ? Math.min(...closed.map((t) => t.net)) : null, maxDD: r2(dd), maxDDPct: start ? r2(dd / start * 100, 2) : null, bestStreak, worstStreak: -worstStreak,
      avgMfe: n ? r2(closed.reduce((s, t) => s + (t.mfe || 0), 0) / n, 2) : null, avgMae: n ? r2(closed.reduce((s, t) => s + (t.mae || 0), 0) / n, 2) : null, curve,
      byWeekday: by(dayOf), byHour: by(hourOf), bySide: by((t) => t.side), byTag: by((t) => (t.tags && t.tags[0]) || null), byExit: by((t) => t.reason), returnPct: start ? r2(net / start * 100, 2) : null };
  }
  // calendar: net per UTC day of close
  function byDay(closed, dayStartUtc = 0) { const o = {}; for (const t of closed) { const k = dayKey(t.closedAt, dayStartUtc); o[k] = r2((o[k] || 0) + t.net); } return o; }
  const dayKey = (t, dayStartUtc = 0) => new Date((t - dayStartUtc * 3600) * 1000).toISOString().slice(0, 10);

  // ---- prop-firm challenge -------------------------------------------------------------------------------------------
  // ch: { firm (rules copy), phase (index), start (balance), status 'live'|'passed'|'failed'|'funded', reason, days: {key: {start, high, low, net}}, eodHigh, lock }
  function newChallenge(firm) { return { firm: JSON.parse(JSON.stringify(firm)), phase: 0, start: firm.size, status: 'live', reason: null, days: {}, eodHigh: firm.size, history: [] }; }
  // evaluate after every bar with the account's balance / equity at that bar. Fills ch.days, trips the rules, passes the phase.
  function evaluate(ch, a, px, t) {
    if (ch.status !== 'live') return ch;
    const F = ch.firm, eq = equity(a, px), key = dayKey(t, F.dayStartUtc), d = ch.days[key] || (ch.days[key] = { start: a.balance, startEq: eq, high: eq, low: eq, trades: 0, net: 0 });
    // a new day: the end-of-day balance of the previous one moves the trailing threshold (eod), capped at the start balance
    const keys = Object.keys(ch.days); if (keys.length > 1 && keys[keys.length - 1] === key) { const prev = ch.days[keys[keys.length - 2]]; if (prev && !prev.closedOut) { prev.closedOut = true; ch.eodHigh = Math.max(ch.eodHigh, prev.endBalance ?? prev.start); } }
    d.high = Math.max(d.high, eq); d.low = Math.min(d.low, eq); d.endBalance = a.balance; d.endEq = eq; d.trades = a.closed.filter((x) => dayKey(x.closedAt, F.dayStartUtc) === key).length; d.net = r2(a.closed.filter((x) => dayKey(x.closedAt, F.dayStartUtc) === key).reduce((s, x) => s + x.net, 0));
    if (F.dd === 'intraday') ch.eodHigh = Math.max(ch.eodHigh, eq);
    const fail = (why) => { ch.status = 'failed'; ch.reason = why; ch.failedAt = t; ch.history.push({ t, event: 'failed', why }); return ch; };
    // daily loss: today's loss (closed + floating) against the day's starting equity, as a share of the start balance
    if (F.dailyLoss > 0 && d.startEq - eq >= F.dailyLoss * ch.start - 1e-9) return fail(`daily loss limit: down ${r2(d.startEq - eq)} today (limit ${r2(F.dailyLoss * ch.start)})`);
    const floor = F.dd === 'static' ? ch.start * (1 - F.maxLoss) : Math.min(ch.start, ch.eodHigh - F.maxLoss * ch.start) ;
    if (eq <= floor + 1e-9) return fail(`${F.dd === 'static' ? 'maximum loss' : 'trailing drawdown'}: equity ${eq} at or under ${r2(floor)}`);
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

  const BT = { FIRMS, newAccount, units, place, cancel, close, closePartial, trail, onBar, equity, pnl, stats, byDay, dayKey, newChallenge, evaluate, r2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = BT; else root.BT = BT;
})(typeof globalThis !== 'undefined' ? globalThis : this);

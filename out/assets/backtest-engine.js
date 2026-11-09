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
    const holdAvg = n ? r2(closed.reduce((s, t) => s + (t.holdBars || 0), 0) / n, 1) : null, rDist = {}; for (const x of Rs) { const k = x <= -1 ? '≤-1R' : x < 0 ? '-1..0' : x < 1 ? '0..1R' : x < 2 ? '1..2R' : x < 3 ? '2..3R' : '≥3R'; rDist[k] = (rDist[k] || 0) + 1; }
    return { n, holdAvg, rDist, wins: wins.length, losses: losses.length, winRate: n ? r2(wins.length / n, 3) : null, net, netR, avgR: Rs.length ? r2(netR / Rs.length, 2) : null,
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

  const BT = { FIRMS, trades, newAccount, units, place, cancel, close, closePartial, trail, onBar, equity, pnl, stats, byDay, dayKey, newChallenge, evaluate, monteCarlo, bestRisk, r2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = BT; else root.BT = BT;
})(typeof globalThis !== 'undefined' ? globalThis : this);

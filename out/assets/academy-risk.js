// MeridianX Academy risk engine (MXK). Deterministic, dependency-free, no network, no clock: every answer is a pure function of
// the order, the account and the limits it is given. Browser global `MXK` and require-able in Node (same wrapper as
// assets/backtest-engine.js). Contract: docs/academy/ARCHITECTURE.md, section 6.
//
// Three separate modules, never merged: edges produce candidates, discretion decides, RISK ALLOWS. This file is the third one.
// It only answers "may this paper trade be taken, and at what size"; it holds no connection to any trading venue and sends nothing
// anywhere. The Academy is replay and paper only.
//
// The absolute rule of the repo is enforced here first: EVERY TRADE HAS A STOP, on the losing side of the entry. An order without
// one is blocked whatever the limits say, and no limit can switch that check off.
//
//   MXK.DEFAULTS                       conservative limits (below); pass your own object to override single fields
//   MXK.size(order, account, limits)   -> { units, riskCash, riskPct, stopDistance, notional, capped, cappedBy }
//   MXK.check(order, account, limits)  -> { allowed, blocks: [plain reasons], codes: [...], size, riskCash, riskPct, session, proposed }
//   MXK.account(start)                 -> a paper account: balance, UTC-day P&L, peak and drawdown, open positions
//   MXK.open(account, position)        -> the account with one more open position      (pure: returns a new account)
//   MXK.apply(account, closedTrade)    -> the account after a closed trade              (pure: returns a new account)
//   MXK.roll(account, t)               -> the account at time t (a new UTC day resets the day P&L)
//   MXK.FIRMS                          the prop-firm rule sets of assets/backtest-engine.js (the same objects: nothing is copied here)
//   MXK.propSim(trades, firmRules)     -> phase progress, breaches and pass / fail in words, played with the lab's own rule code
//
// order:    { market, side: 'buy'|'sell', entry, stop, target?, t (UTC seconds, the decision time), units? (explicit size), riskPct? }
// account:  from MXK.account(); positions: [{ id, market, side, units, entry, stop }]
// Money: the quote currency is taken to be the account currency (as in the backtest lab): 1 unit moves 1 account unit per 1.0 of price.
(function (root) {
  'use strict';

  // ---- limits -------------------------------------------------------------------------------------------------------
  const DEFAULTS = {
    riskPct: 0.25,            // % of the balance risked per trade; also the ceiling: an order asking for more is blocked
    maxDailyLossPct: 1,       // % of the balance at the start of the UTC day; at or beyond it no new trade that day (four full losses)
    maxDrawdownPct: 5,        // % under the highest balance reached; at or beyond it no new trade until the owner resets the account
    maxPositions: 3,          // open positions at once (the new one would be one more)
    maxCorrelated: 2,         // positions that are the same bet (CORRELATION below), counting the new one
    maxPositionSize: 3,       // notional (units x entry) as a multiple of the balance; a tiny stop cannot buy a huge position
    maxUnits: {},             // optional hard unit caps per instrument, e.g. { XAUUSD: 100 }
    unitStep: 0.01,           // sizes are rounded DOWN to this step, so the risk is never above the limit
    allowedSessions: ['asia', 'london', 'newyork'],   // UTC hours: asia 22-07, london 07-12, newyork 12-22; 'closed' (weekend) is never allowed
    allowedInstruments: ['XAUUSD', 'NAS100'],         // the two markets of the seven edges
    emergencyStop: false,     // true blocks everything
  };

  // Correlation groups: positions in one group with the same effective direction are one bet. The number is the direction a BUY
  // takes inside the group (+1 with the group, -1 against it). Group "usd": +1 = long the dollar, so a gold long (-1) and a
  // dollar-index short (sell of +1) are the same short-dollar bet. Group "us-equity": the US index CFDs move together.
  const CORRELATION = {
    usd: { XAUUSD: -1, XAGUSD: -1, EURUSD: -1, GBPUSD: -1, AUDUSD: -1, NZDUSD: -1, DXY: 1, USDJPY: 1, USDCHF: 1, USDCAD: 1 },
    'us-equity': { NAS100: 1, SPX500: 1, US30: 1, US2000: 1 },
  };
  const ALIAS = { XAU: 'XAUUSD', GOLD: 'XAUUSD', GC: 'XAUUSD', XAG: 'XAGUSD', NAS: 'NAS100', NAS100USD: 'NAS100', NSXUSD: 'NAS100', US100: 'NAS100', USTEC: 'NAS100', NQ: 'NAS100',
    SPX500USD: 'SPX500', US500: 'SPX500', US30USD: 'US30', UDX: 'DXY', UDXUSD: 'DXY', USDX: 'DXY', DX: 'DXY' };
  // one name per instrument: "xau", "XAU/USD", "XAU_USD" and "gold" are all XAUUSD
  function instrument(m) { const k = String(m == null ? '' : m).toUpperCase().replace(/[^A-Z0-9]/g, ''); return ALIAS[k] || k; }

  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  const r2 = (v, d = 2) => { const p = Math.pow(10, d); return Math.round((v + Number.EPSILON) * p) / p; };
  const dayKey = (t) => new Date(t * 1000).toISOString().slice(0, 10);   // UTC day of a time in seconds
  const dirOf = (side) => (side === 'buy' ? 1 : side === 'sell' ? -1 : 0);
  const limitsOf = (limits) => ({ ...DEFAULTS, ...(limits || {}) });

  // trading session of a UTC time (seconds): the market week runs Sunday 22:00 to Friday 22:00 UTC
  function session(t) {
    if (!fin(t)) return null;
    const d = new Date(t * 1000), h = d.getUTCHours(), wd = d.getUTCDay();
    if (wd === 6 || (wd === 5 && h >= 22) || (wd === 0 && h < 22)) return 'closed';
    return h >= 7 && h < 12 ? 'london' : h >= 12 && h < 22 ? 'newyork' : 'asia';
  }

  // why the stop of an order is not acceptable, or null when it is
  function stopProblem(o) {
    const dir = dirOf(o && o.side);
    if (!dir) return 'the order has no side (buy or sell)';
    if (!fin(o.entry) || !(o.entry > 0)) return 'the order has no entry price';
    if (!fin(o.stop) || !(o.stop > 0)) return 'no stop: every trade has a stop';
    if ((o.stop - o.entry) * dir >= 0) return `the stop is on the wrong side of the entry (a ${o.side} needs its stop ${dir === 1 ? 'below' : 'above'} the entry)`;
    return null;
  }

  // ---- sizing: units from the risk % and the stop distance, capped ------------------------------------------------------
  function size(order, account, limits) {
    const L = limitsOf(limits), o = order || {}, bal = account && fin(account.balance) ? account.balance : 0;
    const none = { units: 0, riskCash: 0, riskPct: 0, stopDistance: 0, notional: 0, capped: false, cappedBy: null };
    if (stopProblem(o) || !(bal > 0)) return none;
    const dist = Math.abs(o.entry - o.stop), pct = Math.min(fin(o.riskPct) && o.riskPct > 0 ? o.riskPct : L.riskPct, L.riskPct);
    let units = bal * pct / 100 / dist, cappedBy = null;
    const capN = fin(L.maxPositionSize) && L.maxPositionSize > 0 ? L.maxPositionSize * bal / o.entry : Infinity;   // the notional cap, in units
    const capU = L.maxUnits && fin(L.maxUnits[instrument(o.market)]) ? L.maxUnits[instrument(o.market)] : Infinity;
    if (units > capN) { units = capN; cappedBy = 'maxPositionSize'; }
    if (units > capU) { units = capU; cappedBy = 'maxUnits'; }
    const step = fin(L.unitStep) && L.unitStep > 0 ? L.unitStep : 0;
    if (step) units = Math.floor(units / step + 1e-9) * step;
    units = r2(units, 6);
    const riskCash = r2(units * dist, 2);
    return { units, riskCash, riskPct: r2(riskCash / bal * 100, 4), stopDistance: r2(dist, 6), notional: r2(units * o.entry, 2), capped: !!cappedBy, cappedBy };
  }

  // ---- the check: every reason an order may not be taken ----------------------------------------------------------------
  function check(order, account, limits) {
    const L = limitsOf(limits), o = order || {}, a = account || {}, blocks = [], codes = [];
    const block = (code, text) => { codes.push(code); blocks.push(text); };
    const bal = fin(a.balance) ? a.balance : 0, mkt = instrument(o.market), dir = dirOf(o.side);
    const t = fin(o.t) ? o.t : fin(a.now) ? a.now : null, sess = session(t);

    if (L.emergencyStop) block('emergency-stop', 'the emergency stop is on: no new trades');
    const sp = stopProblem(o);
    if (sp) block(/wrong side/.test(sp) ? 'stop-wrong-side' : /no stop/.test(sp) ? 'no-stop' : 'bad-order', sp);
    if (!sp && o.target != null && (!fin(o.target) || (o.target - o.entry) * dir <= 0)) block('target-wrong-side', 'the target is on the wrong side of the entry');
    if (!(bal > 0)) block('no-balance', 'the account has no balance');

    if (Array.isArray(L.allowedInstruments) && !L.allowedInstruments.map(instrument).includes(mkt)) block('instrument', `${mkt || 'this market'} is not an allowed instrument`);
    if (Array.isArray(L.allowedSessions)) {
      if (sess == null) block('session', 'no decision time on the order: the session cannot be checked');
      else if (sess === 'closed') block('session', 'the market is closed (weekend)');
      else if (!L.allowedSessions.includes(sess)) block('session', `the ${sess} session is not allowed`);
    }

    // day P&L counts only when the account's day is the order's UTC day (a new day starts flat)
    const today = t != null ? dayKey(t) : a.day, dayPnl = a.day && a.day === today && fin(a.dayPnl) ? a.dayPnl : 0;
    const dayBase = a.day === today && fin(a.dayStart) && a.dayStart > 0 ? a.dayStart : bal;
    if (fin(L.maxDailyLossPct) && dayBase > 0 && -dayPnl >= L.maxDailyLossPct / 100 * dayBase - 1e-9) block('daily-loss', `daily loss limit reached: down ${r2(-dayPnl)} today (limit ${r2(L.maxDailyLossPct / 100 * dayBase)}, ${L.maxDailyLossPct}% of the day's start)`);
    const peak = fin(a.peak) && a.peak > 0 ? Math.max(a.peak, bal) : bal, ddPct = peak > 0 ? (peak - bal) / peak * 100 : 0;
    if (fin(L.maxDrawdownPct) && ddPct >= L.maxDrawdownPct - 1e-9) block('drawdown', `drawdown limit reached: ${r2(ddPct)}% under the peak balance (limit ${L.maxDrawdownPct}%)`);

    const open = Array.isArray(a.positions) ? a.positions : [];
    if (fin(L.maxPositions) && open.length >= L.maxPositions) block('max-positions', `too many open positions: ${open.length} open (limit ${L.maxPositions})`);
    if (dir && fin(L.maxCorrelated)) {
      for (const g of Object.keys(CORRELATION)) {
        const G = CORRELATION[g]; if (!(mkt in G)) continue;
        const want = G[mkt] * dir, same = open.filter((p) => (instrument(p.market) in G) && G[instrument(p.market)] * dirOf(p.side) === want);
        if (same.length + 1 > L.maxCorrelated) block('correlated', `correlated exposure: ${same.length} open position${same.length === 1 ? '' : 's'} already on the same ${g === 'usd' ? (want > 0 ? 'long-dollar' : 'short-dollar') : (want > 0 ? 'long ' : 'short ') + g} bet (${same.map((p) => `${p.side} ${instrument(p.market)}`).join(', ')}; limit ${L.maxCorrelated} with the new one)`);
      }
    }

    // size and risk: the engine's own size is always inside the limits; an explicit size or risk % on the order is checked against them
    const sized = size(o, a, L); let units = sized.units, riskCash = sized.riskCash, riskPct = sized.riskPct;
    if (!sp && bal > 0) {
      const dist = Math.abs(o.entry - o.stop);
      if (fin(o.riskPct) && o.riskPct > L.riskPct + 1e-9) block('risk', `risk above the limit: ${o.riskPct}% asked, ${L.riskPct}% allowed per trade`);
      if (o.units != null) {
        if (!fin(o.units) || !(o.units > 0)) block('bad-order', 'the order size is not a positive number');
        else {
          units = o.units; riskCash = r2(units * dist, 2); riskPct = r2(riskCash / bal * 100, 4);
          if (riskPct > L.riskPct + 1e-6 && !codes.includes('risk')) block('risk', `risk above the limit: this size risks ${riskPct}% of the balance, ${L.riskPct}% allowed per trade`);
          const capN = fin(L.maxPositionSize) && L.maxPositionSize > 0 ? L.maxPositionSize * bal / o.entry : Infinity, capU = L.maxUnits && fin(L.maxUnits[mkt]) ? L.maxUnits[mkt] : Infinity;
          if (units > Math.min(capN, capU) + 1e-9) block('size', `size above the maximum: ${units} units asked, ${r2(Math.min(capN, capU), 2)} allowed`);
        }
      } else if (!(units > 0)) block('size', 'the size rounds to zero at this risk and stop distance');
    }
    const allowed = blocks.length === 0;
    return { allowed, blocks, codes, size: allowed ? units : 0, riskCash: allowed ? riskCash : 0, riskPct: allowed ? riskPct : 0, session: sess,
      proposed: { units: sized.units, riskCash: sized.riskCash, riskPct: sized.riskPct, capped: sized.capped, cappedBy: sized.cappedBy } };
  }

  // ---- the paper account: balance, UTC-day P&L, peak and drawdown -------------------------------------------------------
  function account(start, o = {}) {
    const s = fin(start) && start > 0 ? start : 100000;
    return { start: s, balance: s, peak: s, drawdown: 0, drawdownPct: 0, maxDrawdown: 0, maxDrawdownPct: 0, day: fin(o.t) ? dayKey(o.t) : null, dayStart: s, dayPnl: 0, trades: 0, positions: [], now: fin(o.t) ? o.t : null };
  }
  // the account at time t: a new UTC day starts with the day P&L at zero and today's balance as the day's reference
  function roll(a, t) {
    if (!fin(t)) return a; const k = dayKey(t);
    return a.day === k ? { ...a, now: t } : { ...a, day: k, dayStart: a.balance, dayPnl: 0, now: t };
  }
  // one more open position. A position without a stop on the right side is refused here too.
  function open(a, p) {
    const sp = stopProblem(p || {}); if (sp) throw new Error(sp);
    if (!fin(p.units) || !(p.units > 0)) throw new Error('a position needs a size');
    const pos = { id: p.id != null ? p.id : `p${a.positions.length + 1}-${a.trades}`, market: instrument(p.market), side: p.side, units: p.units, entry: p.entry, stop: p.stop, target: fin(p.target) ? p.target : null, openedAt: fin(p.t) ? p.t : null };
    return { ...(fin(p.t) ? roll(a, p.t) : a), positions: a.positions.concat(pos) };
  }
  // a closed trade: { net (cash) or R with riskCash, closedAt | exitT | t (UTC seconds), id? (removes that open position) }
  function apply(a, tr) {
    const t = fin(tr.closedAt) ? tr.closedAt : fin(tr.exitT) ? tr.exitT : fin(tr.t) ? tr.t : null;
    const net = fin(tr.net) ? tr.net : fin(tr.netR != null ? tr.netR : tr.R) && fin(tr.riskCash) ? (tr.netR != null ? tr.netR : tr.R) * tr.riskCash : null;
    if (net == null) throw new Error('a closed trade needs net (cash) or R with riskCash');
    const b = t != null ? roll(a, t) : { ...a };
    const balance = r2(b.balance + net), peak = Math.max(b.peak, balance), dd = r2(peak - balance), ddPct = peak > 0 ? r2(dd / peak * 100, 4) : 0;
    return { ...b, balance, peak, drawdown: dd, drawdownPct: ddPct, maxDrawdown: Math.max(b.maxDrawdown, dd), maxDrawdownPct: Math.max(b.maxDrawdownPct, ddPct), dayPnl: r2(b.dayPnl + net), trades: b.trades + 1,
      positions: tr.id != null ? b.positions.filter((p) => p.id !== tr.id) : b.positions };
  }

  // ---- prop-firm simulation: the lab's rule sets and the lab's own rule code ------------------------------------------------
  // The rule sets and the evaluation live in assets/backtest-engine.js (ChronosTrade). They are used as they are: no firm number
  // is written in this file. In the browser load backtest-engine.js as well; in Node it is required from the same folder.
  let ENGINE = null;
  function engine() {
    if (ENGINE) return ENGINE;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') ENGINE = require('./backtest-engine.js');
    else ENGINE = root.BT;
    if (!ENGINE || !Array.isArray(ENGINE.FIRMS)) { ENGINE = null; throw new Error('assets/backtest-engine.js is not loaded: the prop-firm rule sets live there'); }
    return ENGINE;
  }
  // trades: closed trades in any order: { net (cash) | netR | R, closedAt | exitT (UTC seconds), id? }. A trade given in R is turned
  // into cash with opts.riskPct (default MXK.DEFAULTS.riskPct) of the firm's start balance (fixed risk, as the firms are sized).
  // firmRules: one of MXK.FIRMS, its id, or an object of the same shape (the page's "Custom rules").
  // Judged on closed trades only: a floating loss inside a trade is not seen here (the replay lab checks that bar by bar).
  function propSim(trades, firmRules, opts = {}) {
    const BT = engine(), F = typeof firmRules === 'string' ? BT.FIRMS.find((f) => f.id === firmRules) : firmRules;
    if (!F || !fin(F.size) || !Array.isArray(F.phases) || !F.phases.length || !fin(F.maxLoss)) throw new Error('unknown prop-firm rule set');
    const riskPct = fin(opts.riskPct) && opts.riskPct > 0 ? opts.riskPct : DEFAULTS.riskPct, riskCash = F.size * riskPct / 100;
    const list = (trades || []).map((x, i) => {
      const t = fin(x.closedAt) ? x.closedAt : fin(x.exitT) ? x.exitT : null, R = fin(x.netR) ? x.netR : fin(x.R) ? x.R : null, net = fin(x.net) ? x.net : R != null ? r2(R * riskCash) : null;
      return t == null || net == null ? null : { id: `s${i}`, net, R, closedAt: t, openedAt: fin(x.openedAt) ? x.openedAt : t };
    }).filter(Boolean).sort((p, q) => p.closedAt - q.closedAt);
    const a = BT.newAccount(F.size), ch = BT.newChallenge(F), passed = [], breaches = []; let used = 0;
    for (const tr of list) {
      if (ch.status !== 'live') break;
      const phase = ch.phase;
      BT.evaluate(ch, a, 0, tr.closedAt);   // opens the trade's day with the balance before it, so the day's loss is measured from there
      if (ch.status === 'live' && ch.phase === phase) { a.closed.push(tr); a.balance = r2(a.balance + tr.net); used++; BT.evaluate(ch, a, 0, tr.closedAt); }
      if (ch.phase !== phase || ch.status === 'funded') passed.push(F.phases[phase].name);
    }
    if (ch.status === 'failed') {
      const why = String(ch.reason || ''), rule = /^daily loss/.test(why) ? 'daily-loss' : /^time limit/.test(why) ? 'time-limit' : 'max-loss';
      breaches.push({ rule, fatal: true, t: ch.failedAt, day: dayKey(ch.failedAt), text: why });
    }
    const P = ch.progress || null, cur = F.phases[Math.min(ch.phase, F.phases.length - 1)];
    if (ch.status === 'live' && P && F.consistency > 0 && P.balance >= P.target - 1e-9 && P.consistency > F.consistency + 1e-9)
      breaches.push({ rule: 'consistency', fatal: false, t: list.length ? list[used - 1].closedAt : null, day: list.length ? dayKey(list[used - 1].closedAt) : null, text: `consistency rule: the best day is ${Math.round(P.consistency * 100)}% of the profit (limit ${Math.round(F.consistency * 100)}%); the phase is not passed until it is under the limit` });
    const status = ch.status === 'funded' ? 'passed' : ch.status === 'failed' ? 'failed' : 'in-progress';
    const text = status === 'passed' ? `Passed: ${passed.join(' and ')} completed in ${used} trade${used === 1 ? '' : 's'}.`
      : status === 'failed' ? `Failed in ${cur.name} after ${used} trade${used === 1 ? '' : 's'}: ${ch.reason}.`
      : !used ? `Not started: no closed trades to play against ${F.name}.`
      : `Still in ${cur.name}${passed.length ? ` (passed ${passed.join(', ')})` : ''}: ${!P ? 'no progress yet' : P.pct >= 0 ? `${P.pct}% of the way to the target` : `${r2(ch.start - P.balance)} under the start balance`}${P && P.waiting ? `; ${P.waiting}` : ''}.`;
    return { firm: { id: F.id || 'custom', name: F.name || 'Custom rules', size: F.size }, status, passed: status === 'passed', failed: status === 'failed',
      phase: ch.phase, phaseName: cur.name, phasesPassed: passed, progress: P, breaches, tradesUsed: used, tradesTotal: list.length,
      tradingDays: P ? P.tradingDays : 0, balance: a.balance, riskPct, basis: 'closed trades only: a floating loss inside a trade is not seen', text };
  }

  const MXK = { VERSION: 'mxk-1', DEFAULTS, CORRELATION, instrument, session, dayKey, size, check, account, roll, open, apply, propSim };
  Object.defineProperty(MXK, 'FIRMS', { enumerable: true, get: () => engine().FIRMS });
  if (typeof module !== 'undefined' && module.exports) module.exports = MXK; else root.MXK = MXK;
})(typeof globalThis !== 'undefined' ? globalThis : this);

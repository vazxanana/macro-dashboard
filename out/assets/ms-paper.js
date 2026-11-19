/* Paper trading account on the Desk's charts (18 Nov 2026, owner: "they should be able to have a paper trade account there to
   practise that shows its stats"). Practice only: nothing here reaches the council, the demo mirror, a broker or the server; the
   account lives in this browser (localStorage ms-paper-<account>). Every order carries a stop on its losing side (the engine
   refuses one without). Positions are checked on each CLOSED one-minute candle of their market with ChronosTrade's own engine
   (assets/backtest-engine.js: fills, stop first when one candle holds both, gaps at the open); a market the page is not showing
   is caught up from its one-minute candles when the page loads and every minute while it has open positions or orders. */
(function (root) {
  'use strict';
  const BT = () => root.BT;
  const r2 = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
  const RISKS = [0.25, 0.5, 1, 2];
  const START = 10000;

  // a fresh account: $10,000, 1 % risk a trade, target 2R, stop 1 ATR of the 15-minute chart
  function fresh(start = START) { return { v: 1, start, risk: 1, tgtR: 2, stopAtr: 1, made: Math.floor(Date.now() / 1000), acct: BT().newAccount(start), last: {} }; }
  function norm(s) {
    if (!s || s.v !== 1 || !s.acct || !Array.isArray(s.acct.positions)) return null;
    const a = s.acct; a.orders = Array.isArray(a.orders) ? a.orders : []; a.closed = Array.isArray(a.closed) ? a.closed : [];
    // a record without a stop on its losing side is dropped (never a trade without a stop)
    const ok = (p) => p && p.mk && Number.isFinite(p.stop) && (p.side === 'buy' ? p.stop < (p.entry ?? p.price) || p.beMoved : p.stop > (p.entry ?? p.price) || p.beMoved);
    a.positions = a.positions.filter((p) => ok(p) && p.r0 > 0); a.orders = a.orders.filter(ok);
    s.risk = RISKS.includes(+s.risk) ? +s.risk : 1; s.tgtR = [0, 1, 1.5, 2, 3].includes(+s.tgtR) ? +s.tgtR : 2; s.stopAtr = [0.5, 1, 1.5, 2].includes(+s.stopAtr) ? +s.stopAtr : 1; s.last = s.last || {};
    return s;
  }

  // size in the market's own words from engine units (the engine's units make P&L in dollars: risk / stop distance)
  function sizeText(I, units, entry) {
    if (!I) return '';
    if (I.size === 'fx') return r2(units / 1e5, 2) + ' lot';
    if (I.size === 'fxquote') return r2(units * entry / 1e5, 2) + ' lot';
    if (I.size === 'gold') return r2(units, 2) + ' oz';
    return r2(units, units < 10 ? 4 : 2) + ' ' + (I.unit || 'units');
  }

  // one market's closed one-minute candles (UTC, ascending) through the engine: every position and order of that market is
  // checked only on candles that started after it was placed (`chk`), each candle once. Returns the engine's events.
  function process(acct, mk, bars, now) {
    const out = []; if (!bars || !bars.length) return out;
    for (const b of bars) {
      if (!(b.time + 60 <= now)) break;   // only closed candles
      const pos = acct.positions.filter((p) => p.mk === mk && b.time > p.chk), ord = acct.orders.filter((o) => o.mk === mk && b.time > o.chk);
      if (!pos.length && !ord.length) continue;
      const sub = { ...acct, positions: pos.slice(), orders: ord.slice(), closed: [] };
      const ev = BT().onBar(sub, b);
      for (const e of ev) { if (e.pos) { e.pos.mk = mk; e.pos.chk = b.time; } if (e.trade) e.trade.mk = mk; out.push(e); }
      const keepP = new Set(sub.positions), keepO = new Set(sub.orders);
      acct.balance = sub.balance; acct.nextId = sub.nextId;
      acct.positions = acct.positions.filter((p) => !(p.mk === mk && b.time > p.chk) || keepP.has(p)).concat(sub.positions.filter((p) => !pos.includes(p)));
      acct.orders = acct.orders.filter((o) => !(o.mk === mk && b.time > o.chk) || keepO.has(o));
      acct.closed.push(...sub.closed);
      for (const p of acct.positions) if (p.mk === mk && pos.includes(p)) p.chk = b.time;
      for (const o of acct.orders) if (o.mk === mk && ord.includes(o)) o.chk = b.time;
    }
    return out;
  }

  // order from the panel: side, price now, stop, target, risk %, optional resting price. Throws in words when something is off.
  function order(s, mk, o, now) {
    const px = +o.price, stop = o.stop === '' || o.stop == null ? NaN : +o.stop, tgt = o.target === '' || o.target == null ? null : +o.target, at = o.at === '' || o.at == null ? null : +o.at;
    if (!(px > 0)) throw new Error('No live price yet for this market.');
    if (!Number.isFinite(stop)) throw new Error('Every trade needs a stop.');
    const entry = at != null ? at : px, dir = o.side === 'buy' ? 1 : -1;
    if ((stop - entry) * dir >= 0) throw new Error(`The stop must be ${dir === 1 ? 'below' : 'above'} the entry.`);
    if (tgt != null && (tgt - entry) * dir <= 0) throw new Error(`The target must be ${dir === 1 ? 'above' : 'below'} the entry.`);
    const risk = s.acct.balance * s.risk / 100, units = BT().units(risk, entry, stop);
    if (!(units > 0)) throw new Error('The stop is too close to the entry.');
    const type = at == null ? 'market' : (at - px) * dir < 0 ? 'limit' : 'stop';
    const rec = BT().place(s.acct, { side: o.side, type, price: entry, stop, target: tgt, units, note: o.note || '' }, now);
    rec.mk = mk; rec.chk = Math.floor(now / 60) * 60; return rec;
  }

  const stats = (s) => BT().stats(s.acct.closed, s.start);
  const floating = (s, pxOf) => r2(s.acct.positions.reduce((t, p) => { const px = pxOf(p.mk); return t + (px > 0 ? BT().pnl(p, px) : 0); }, 0));

  const PP = { RISKS, START, fresh, norm, sizeText, process, order, stats, floating };
  if (typeof module !== 'undefined' && module.exports) { module.exports = PP; return; }
  root.MS_PAPER = PP;

  // ---- the page ------------------------------------------------------------------------------------------------------
  const H = () => root.msPaperHost;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v, sign) => (v == null || !Number.isFinite(v) ? '—' : (sign && v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const rTxt = (v) => (v == null || !Number.isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R');
  let S = null, KEY = null, D = null, LINES = [], LAST = {}, busy = false, tmr = null;

  const who = () => { try { const a = JSON.parse(localStorage.getItem('ms-acct') || 'null'); return a && a.u ? String(a.u) : null; } catch (e) { return null; } };
  function load() { KEY = 'ms-paper-' + (who() || 'me'); try { S = norm(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { S = null; } if (!S) S = fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  const dec = (mk) => { const I = H().insts[mk]; return I ? I.dec ?? 2 : 2; };
  const fp = (v, mk) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toLocaleString('en-US', { minimumFractionDigits: dec(mk), maximumFractionDigits: dec(mk) }));
  const label = (mk) => (H().insts[mk] || {}).label || mk;
  const now = () => Math.floor(Date.now() / 1000);
  // the page's own one-minute candles in UTC (the charts add the time zone; the prices are what the charts show)
  const m1 = () => H().m1().map((b) => ({ time: b.time - H().TZ, open: b.open, high: b.high, low: b.low, close: b.close }));
  const livePx = () => { const b = H().m1(); return b.length ? b[b.length - 1].close : null; };
  const pxOf = (mk) => (mk === H().key ? livePx() : LAST[mk] ?? S.last[mk] ?? null);

  function tick() {
    if (!S || !H()) return;
    const ev = process(S.acct, H().key, m1(), now()); const px = livePx(); if (px > 0) S.last[H().key] = px;
    if (ev.length) { save(); say(ev); }
    try { marks(); } catch (e) {}
    if (D) { D.price = px; if (D.follow) { setDraftDefaults(false); } }
    draw();
  }
  async function catchUp() {
    if (!S || !H() || busy) return; const others = [...new Set(S.acct.positions.concat(S.acct.orders).map((p) => p.mk))].filter((mk) => mk !== H().key && H().insts[mk]);
    if (!others.length) return; busy = true;
    try { for (const mk of others) { const from = Math.min(...S.acct.positions.concat(S.acct.orders).filter((p) => p.mk === mk).map((p) => p.chk)) + 60;
      let bars = null; try { bars = await H().since(mk, from); } catch (e) { bars = null; }
      if (Array.isArray(bars) && bars.length) { bars = bars.filter((b) => b.time >= from).sort((a, b) => a.time - b.time); LAST[mk] = bars[bars.length - 1].close; S.last[mk] = LAST[mk]; const ev = process(S.acct, mk, bars, now()); if (ev.length) say(ev); save(); } }
    } finally { busy = false; draw(); }
  }
  function say(ev) {
    const t = ev.filter((e) => e.kind === 'close').map((e) => `${label(e.trade.mk)} ${e.trade.side} closed at ${fp(e.trade.exit, e.trade.mk)} (${e.trade.reason}): ${rTxt(e.trade.R)}, ${money(e.trade.net, true)}`)
      .concat(ev.filter((e) => e.kind === 'fill').map((e) => `${label(e.pos.mk)} ${e.pos.side} order filled at ${fp(e.pos.entry, e.pos.mk)}`));
    if (t.length && $('ms-pp-live')) $('ms-pp-live').textContent = t.join(' · ');
  }

  // ---- the draft: Buy / Sell set up an order with its stop and target drawn on every chart of this market ----------------
  function atr() { const b = H().atr(); const a = b && b.length > 15 ? BT().atrOf(b, 14) : null; return a > 0 ? a : null; }
  function setDraftDefaults(all) {
    const px = livePx(); if (!(px > 0)) return; const a = atr() || px * 0.002, dir = D.side === 'buy' ? 1 : -1, e = D.at != null ? D.at : px;
    D.price = px;
    if (all || D.follow) { D.stop = +(e - dir * a * S.stopAtr).toFixed(dec(H().key)); D.target = S.tgtR ? +(e + dir * Math.abs(e - D.stop) * S.tgtR).toFixed(dec(H().key)) : null; }
  }
  function draft(side) { if (!(livePx() > 0)) { msg('No live price yet: wait for the chart to load.'); return; } D = { side, at: null, follow: true }; setDraftDefaults(true); open(true); draw(); }
  function place() {
    if (!D) return;
    try { const r = order(S, H().key, { side: D.side, price: livePx(), stop: D.stop, target: D.target, at: D.at }, now()); save(); D = null;
      msg(r.entry != null ? `${label(H().key)} ${r.side} opened at ${fp(r.entry, H().key)}, stop ${fp(r.stop, H().key)}${r.target != null ? `, target ${fp(r.target, H().key)}` : ''}.` : `${r.type === 'limit' ? 'Limit' : 'Stop'} ${r.side} order resting at ${fp(r.price, H().key)}.`);
    } catch (e) { msg(e.message, true); }
    draw();
  }
  function msg(t, bad) { const el = $('ms-pp-live'); if (el) { el.textContent = t; el.classList.toggle('bad', !!bad); } }

  // ---- lines on the charts of this market ------------------------------------------------------------------------------
  function lines() {
    for (const l of LINES) { try { l.s.removePriceLine(l.l); } catch (e) {} } LINES = [];
    const L = root.msCharts ? root.msCharts.list.filter((c) => c.market() === H().key) : [], cs = getComputedStyle(document.documentElement);
    const col = (n, d) => cs.getPropertyValue(n).trim() || d, up = col('--buy', '#2fbf8f'), dn = col('--sell', '#f2576f'), ink = col('--au-ink-2', '#9aa0a6');
    const add = (price, color, title, style) => { if (!Number.isFinite(price)) return; for (const c of L) { try { LINES.push({ s: c.series, l: c.series.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title }) }); } catch (e) {} } };
    for (const p of S.acct.positions.filter((x) => x.mk === H().key)) { add(p.entry, ink, `${p.side === 'buy' ? 'Buy' : 'Sell'} #${p.id}`, 0); add(p.stop, dn, `SL #${p.id}`, 2); if (p.target != null) add(p.target, up, `TP #${p.id}`, 2); }
    for (const o of S.acct.orders.filter((x) => x.mk === H().key)) { add(o.price, ink, `${o.type} ${o.side} #${o.id}`, 1); add(o.stop, dn, `SL #${o.id}`, 3); if (o.target != null) add(o.target, up, `TP #${o.id}`, 3); }
    if (D) { if (D.at != null) add(D.at, ink, `${D.side === 'buy' ? 'Buy' : 'Sell'} at`, 1); add(D.stop, dn, 'Stop (draft)', 1); if (D.target != null) add(D.target, up, 'Target (draft)', 1); }
  }

  // ---- the panel -------------------------------------------------------------------------------------------------------
  let sig = '';
  function draw() {
    const el = $('ms-pp'); if (!el || !S) return;
    const st = stats(S), fl = floating(S, pxOf), eq = r2(S.acct.balance + fl), mk = H().key, px = livePx();
    const k = JSON.stringify([S.acct.balance, S.acct.positions.map((p) => [p.id, p.stop, p.target, p.units]), S.acct.orders.map((o) => o.id), S.acct.closed.length, D && [D.side, D.stop, D.target, D.at], S.risk, S.tgtR, S.stopAtr, el.dataset.open]);
    const eqEl = $('ms-pp-eq'); if (eqEl) eqEl.textContent = money(eq);
    const typing = el.contains(document.activeElement) && /^(INPUT|SELECT)$/.test(document.activeElement.tagName);
    if (k === sig || typing) { live(fl, eq); return; } sig = k;
    const pct = (eq - S.start) / S.start * 100, risk$ = S.acct.balance * S.risk / 100;
    const dRow = D ? (() => { const e = D.at != null ? D.at : px, dist = Math.abs(e - D.stop), rr = D.target != null && dist > 0 ? Math.abs(D.target - e) / dist : null, u = dist > 0 ? risk$ / dist : 0;
      return `<div class="pp-draft ${D.side}" role="group" aria-label="Order being set up">
        <b class="pp-dside">${D.side === 'buy' ? 'Buy' : 'Sell'} ${esc(label(mk))}</b>
        <label>Entry <input id="pp-at" inputmode="decimal" placeholder="Market ${esc(fp(px, mk))}" value="${D.at != null ? D.at : ''}" aria-label="Entry price, empty for market"></label>
        <label>Stop <input id="pp-sl" inputmode="decimal" value="${D.stop}" aria-label="Stop price"></label>
        <label>Target <input id="pp-tp" inputmode="decimal" value="${D.target ?? ''}" placeholder="none" aria-label="Target price, empty for none"></label>
        <span class="pp-dsum">Risk ${money(risk$)} (${S.risk}%) · ${esc(sizeText(H().insts[mk], u, e))}${rr != null ? ` · R:R ${rr.toFixed(2)}` : ''}</span>
        <button type="button" class="pp-go ${D.side}" id="pp-place">Place ${D.side}</button><button type="button" class="pp-q" id="pp-cancel">Cancel</button></div>`; })() : '';
    const rows = S.acct.positions.map((p) => { const cur = pxOf(p.mk), pl = cur > 0 ? BT().pnl(p, cur) : null, R = cur > 0 ? (cur - p.entry) * (p.side === 'buy' ? 1 : -1) / p.r0 : null;
      return `<tr><td><b>${esc(label(p.mk))}</b> <span class="pp-s ${p.side}">${p.side}</span></td><td class="n">${fp(p.entry, p.mk)}</td>
        <td class="n"><input class="pp-ed" data-ed="stop" data-id="${p.id}" value="${p.stop}" aria-label="Stop of trade ${p.id}"></td><td class="n"><input class="pp-ed" data-ed="target" data-id="${p.id}" value="${p.target ?? ''}" placeholder="none" aria-label="Target of trade ${p.id}"></td>
        <td class="n">${esc(sizeText(H().insts[p.mk], p.units, p.entry))}</td><td class="n pp-fl ${pl > 0 ? 'up' : pl < 0 ? 'dn' : ''}" data-fl="${p.id}">${money(pl, true)} <small>${rTxt(R)}</small></td>
        <td class="pp-act"><button type="button" data-a="be" data-id="${p.id}" title="Move the stop to the entry (only when the trade is in profit)">BE</button><button type="button" data-a="half" data-id="${p.id}" title="Close half at the price now">½</button><button type="button" data-a="close" data-id="${p.id}">Close</button></td></tr>`; }).join('')
      + S.acct.orders.map((o) => `<tr class="pp-ord"><td><b>${esc(label(o.mk))}</b> <span class="pp-s ${o.side}">${o.type} ${o.side}</span></td><td class="n">${fp(o.price, o.mk)}</td><td class="n">${fp(o.stop, o.mk)}</td><td class="n">${fp(o.target, o.mk)}</td><td class="n">${esc(sizeText(H().insts[o.mk], o.units, o.price))}</td><td class="n">waiting</td><td class="pp-act"><button type="button" data-a="cancel" data-id="${o.id}">Cancel</button></td></tr>`).join('');
    const T = BT().trades(S.acct.closed).slice().reverse();
    const hist = T.slice(0, 50).map((t) => `<tr><td>${esc(new Date(t.closedAt * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td><td><b>${esc(label(t.mk))}</b> <span class="pp-s ${t.side}">${t.side}</span></td><td class="n">${fp(t.entry, t.mk)} → ${fp(t.exit, t.mk)}</td><td>${esc(t.reason)}</td><td class="n ${t.R > 0 ? 'up' : t.R < 0 ? 'dn' : ''}">${rTxt(t.R)}</td><td class="n ${t.net > 0 ? 'up' : t.net < 0 ? 'dn' : ''}">${money(t.net, true)}</td></tr>`).join('');
    const tile = (l, v, cl = '', tip = '') => `<div class="pp-t"${tip ? ` title="${esc(tip)}"` : ''}><small>${l}</small><b class="${cl}">${v}</b></div>`;
    const few = st.n < 20 ? `<p class="pp-few">${st.n} closed trade${st.n === 1 ? '' : 's'}: under 20 is too few to judge a method.</p>` : '';
    el.innerHTML = `<div class="pp-h"><div class="pp-ttl"><b>Paper account</b><small>Practice only · in this browser · fills at the chart's price, no costs</small></div>
      <div class="pp-big"><span><small>Equity</small><b id="pp-eqv">${money(eq)}</b></span><span><small>Floating</small><b id="pp-flv" class="${fl > 0 ? 'up' : fl < 0 ? 'dn' : ''}">${money(fl, true)}</b></span><span><small>Return</small><b class="${pct > 0 ? 'up' : pct < 0 ? 'dn' : ''}">${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%</b></span></div>
      <div class="pp-trade"><button type="button" class="pp-go sell" id="pp-sell" title="Sell ${esc(label(mk))} (stop and target set for you)">Sell</button><span class="pp-px" id="pp-px">${esc(fp(px, mk))}</span><button type="button" class="pp-go buy" id="pp-buy" title="Buy ${esc(label(mk))} (stop and target set for you)">Buy</button></div>
      <div class="pp-set"><label>Risk <select id="pp-risk">${RISKS.map((r) => `<option value="${r}"${r === S.risk ? ' selected' : ''}>${r}%</option>`).join('')}</select></label>
      <label>Stop <select id="pp-satr">${[0.5, 1, 1.5, 2].map((r) => `<option value="${r}"${r === S.stopAtr ? ' selected' : ''}>${r} ATR</option>`).join('')}</select></label>
      <label>Target <select id="pp-tgt">${[0, 1, 1.5, 2, 3].map((r) => `<option value="${r}"${r === S.tgtR ? ' selected' : ''}>${r ? r + 'R' : 'none'}</option>`).join('')}</select></label></div>
      <button type="button" class="pp-tog" id="pp-tog" aria-expanded="${el.dataset.open === '1'}" aria-controls="pp-body">${el.dataset.open === '1' ? 'Hide' : 'Stats and history'}</button></div>
      ${dRow}<p class="pp-live" id="ms-pp-live" role="status" aria-live="polite"></p>
      ${rows ? `<div class="pp-tw"><table class="pp-tbl"><thead><tr><th>Open</th><th class="n">Entry</th><th class="n">Stop</th><th class="n">Target</th><th class="n">Size</th><th class="n">P&amp;L</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
      <div class="pp-body" id="pp-body"${el.dataset.open === '1' ? '' : ' hidden'}>
        <div class="pp-tiles">${tile('Balance', money(S.acct.balance))}${tile('Net P&amp;L', money(st.net, true), st.net > 0 ? 'up' : st.net < 0 ? 'dn' : '')}${tile('Trades', st.n)}${tile('Win rate', st.winRate == null ? '—' : Math.round(st.winRate * 100) + '%')}
        ${tile('Profit factor', st.profitFactor == null ? '—' : st.profitFactor === Infinity ? '∞' : st.profitFactor.toFixed(2), '', 'Money won ÷ money lost')}${tile('Avg R', rTxt(st.avgR), st.avgR > 0 ? 'up' : st.avgR < 0 ? 'dn' : '', 'Average result in units of the risk taken')}
        ${tile('Expectancy', money(st.expectancy, true), '', 'Average net a trade')}${tile('Max drawdown', st.n ? money(-st.maxDD) + ` <small>${st.maxDDPct}%</small>` : '—')}${tile('Best / worst', st.n ? `${money(st.best, true)} / ${money(st.worst, true)}` : '—')}${tile('Streaks', st.n ? `${st.bestStreak} won · ${st.worstStreak} lost` : '—')}${tile('Avg hold', st.n ? BT().durText(st.holdAvgSec) : '—')}</div>
        ${few}${curve(st)}
        ${hist ? `<div class="pp-tw"><table class="pp-tbl"><thead><tr><th>Closed</th><th>Market</th><th class="n">Entry → exit</th><th>Exit</th><th class="n">R</th><th class="n">Net</th></tr></thead><tbody>${hist}</tbody></table></div>${T.length > 50 ? `<p class="pp-few">The latest 50 of ${T.length} trades.</p>` : ''}` : '<p class="pp-few">No closed trades yet. Press Buy or Sell: the stop and target are set for you, and you can change them before you place the order.</p>'}
        <div class="pp-foot"><button type="button" class="pp-q" id="pp-csv"${T.length ? '' : ' disabled'}>Download CSV</button><button type="button" class="pp-q" id="pp-reset">Reset account</button><small>Started ${esc(new Date(S.made * 1000).toLocaleDateString())} with ${money(S.start)}. Positions are checked on each closed 1-minute candle.</small></div>
      </div>`;
    lines(); live(fl, eq); home();
  }
  function live(fl, eq) {
    try { home(); } catch (e) {}
    const px = livePx(), mk = H().key; if ($('pp-px')) $('pp-px').textContent = fp(px, mk);
    if ($('pp-eqv')) $('pp-eqv').textContent = money(eq); const f = $('pp-flv'); if (f) { f.textContent = money(fl, true); f.className = fl > 0 ? 'up' : fl < 0 ? 'dn' : ''; }
    for (const p of S.acct.positions) { const c = document.querySelector(`[data-fl="${p.id}"]`), cur = pxOf(p.mk); if (!c || !(cur > 0)) continue; const pl = BT().pnl(p, cur), R = (cur - p.entry) * (p.side === 'buy' ? 1 : -1) / p.r0; c.innerHTML = `${money(pl, true)} <small>${rTxt(R)}</small>`; c.className = 'n pp-fl ' + (pl > 0 ? 'up' : pl < 0 ? 'dn' : ''); }
  }
  function curve(st) {
    if (st.n < 2) return ''; const pts = st.curve.map((c) => c.eq), lo = Math.min(...pts), hi = Math.max(...pts), W = 600, Hh = 90, sp = hi - lo || 1;
    const xy = pts.map((v, i) => `${(i / (pts.length - 1) * W).toFixed(1)},${(Hh - 6 - (v - lo) / sp * (Hh - 12)).toFixed(1)}`).join(' '), y0 = (Hh - 6 - (S.start - lo) / sp * (Hh - 12)).toFixed(1);
    return `<figure class="pp-curve"><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Closed balance after each trade, from ${money(S.start)} to ${money(pts[pts.length - 1])}"><line x1="0" x2="${W}" y1="${y0}" y2="${y0}" class="pp-c0"/><polyline points="${xy}" class="pp-cl"/></svg><figcaption>Balance after each closed trade · dashed = start</figcaption></figure>`;
  }
  // closed paper trades of this market on the charts: a dashed line from the entry to the exit, green or red, with its R
  function marks() {
    const L = root.msCharts ? root.msCharts.list.filter((c) => c.market() === H().key) : [], T = BT().trades(S.acct.closed).filter((t) => t.mk === H().key).slice(-60);
    for (const cx of L) {
      let c = cx.ppc; if (!T.length || !cx.visible() || !root.msChartX) { if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height); continue; }
      if (!c || !c.isConnected) { c = cx.ppc = document.createElement('canvas'); c.className = 'ms-pp-cv'; c.setAttribute('aria-hidden', 'true'); cx.el.appendChild(c); }
      const dpr = devicePixelRatio || 1, w = cx.el.clientWidth, h = cx.el.clientHeight; if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px'; }
      const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h); let W = w; try { W = cx.chart.timeScale().width(); } catch (e) {}
      x.save(); x.beginPath(); x.rect(0, 0, W, h); x.clip(); x.font = '600 12px system-ui, sans-serif'; x.textBaseline = 'middle';
      for (const t of T) {
        const x1 = root.msChartX(cx, t.openedAt + cx.TZ), x2 = root.msChartX(cx, t.closedAt + cx.TZ), y1 = cx.series.priceToCoordinate(t.entry), y2 = cx.series.priceToCoordinate(t.exit);
        if (x1 == null || x2 == null || y1 == null || y2 == null) continue; const win = (t.net || 0) > 0, col = win ? '#0f7a5c' : (t.net || 0) < 0 ? '#c8243f' : '#6b7280';
        x.strokeStyle = col; x.lineWidth = 1.5; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(x1, y1); x.lineTo(Math.max(x2, x1 + 2), y2); x.stroke(); x.setLineDash([]);
        x.fillStyle = col; x.beginPath(); x.arc(x1, y1, 3, 0, 7); x.fill(); x.beginPath(); x.arc(Math.max(x2, x1 + 2), y2, 3, 0, 7); x.fill();
        const lbl = rTxt(t.R), tw = x.measureText(lbl).width + 8, lx = Math.max(x2, x1 + 2) + 6; x.fillRect(lx, y2 - 9, tw, 18); x.fillStyle = '#fff'; x.fillText(lbl, lx + 4, y2);
      }
      x.restore();
    }
  }
  // Home's line (19 Nov 2026): the paper account in one sentence once it has a trade; nothing fetched, the same account as the bar
  function home() {
    const el = $('hs-pp'); if (!el || !S) return; const T = BT().trades(S.acct.closed), n = S.acct.positions.length + S.acct.orders.length; if (!T.length && !n) { el.hidden = true; return; }
    const fl = floating(S, pxOf), eq = r2(S.acct.balance + fl), pct = (eq - S.start) / S.start * 100, wins = T.filter((t) => t.net > 0).length;
    const html = `Your paper account: <b>${money(eq)}</b> <b class="${pct > 0 ? 'fw-st-ok' : pct < 0 ? 'fw-st-bad' : ''}">${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%</b> · ${S.acct.positions.length} open${S.acct.orders.length ? `, ${S.acct.orders.length} waiting` : ''} · ${T.length} closed${T.length ? `, ${Math.round(wins / T.length * 100)}% won` : ''} · <a href="#charts">Open the charts</a>`;
    if (el.innerHTML !== html) el.innerHTML = html; el.hidden = false;
  }
  function open(on) { const el = $('ms-pp'); if (!el) return; el.hidden = false; const b = $('ms-pp-btn'); if (b) b.setAttribute('aria-expanded', 'true'); if (on) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

  function onClick(e) {
    const t = e.target.closest('button'); if (!t || !S) return;
    if (t.id === 'pp-buy') return draft('buy'); if (t.id === 'pp-sell') return draft('sell');
    if (t.id === 'pp-place') return place(); if (t.id === 'pp-cancel') { D = null; draw(); return; }
    if (t.id === 'pp-tog') { const el = $('ms-pp'); el.dataset.open = el.dataset.open === '1' ? '' : '1'; try { localStorage.setItem('ms-pp-open', el.dataset.open); } catch (x) {} draw(); return; }
    if (t.id === 'pp-csv') return csv();
    if (t.id === 'pp-reset') { (root.msConfirm ? root.msConfirm('Start the paper account again at $10,000? Every trade and statistic of it is deleted.', { title: 'Reset the paper account', ok: 'Reset', danger: true }) : Promise.resolve(confirm('Reset?'))).then((ok) => { if (!ok) return; S = fresh(); D = null; save(); sig = ''; draw(); msg('The paper account starts again at $10,000.'); }); return; }
    const id = +t.dataset.id, a = t.dataset.a; if (!a) return;
    if (a === 'cancel') { BT().cancel(S.acct, id); save(); draw(); return; }
    const p = S.acct.positions.find((x) => x.id === id); if (!p) return; const cur = pxOf(p.mk); if (!(cur > 0)) { msg('No price for that market yet.', true); return; }
    if (a === 'close') { const c = BT().close(S.acct, p, cur, now(), 'closed by hand'); c.mk = p.mk; save(); say([{ kind: 'close', trade: c }]); draw(); marks(); return; }
    if (a === 'half') { const c = BT().closePartial(S.acct, p, cur, now(), 0.5, 'half closed by hand'); c.mk = p.mk; save(); say([{ kind: 'close', trade: c }]); draw(); marks(); return; }
    if (a === 'be') { const dir = p.side === 'buy' ? 1 : -1; if ((cur - p.entry) * dir <= 0) { msg('Break-even only on a trade in profit: the price is not past the entry.', true); return; } if ((p.stop - p.entry) * dir >= 0) { msg('The stop is already at or past the entry.'); return; } p.stop = p.entry; p.beMoved = true; save(); draw(); msg(`Stop of #${p.id} moved to the entry.`); }
  }
  function onChange(e) {
    const t = e.target; if (!S) return;
    if (t.id === 'pp-risk') { S.risk = +t.value; save(); draw(); return; } if (t.id === 'pp-tgt') { S.tgtR = +t.value; if (D) { D.follow = true; setDraftDefaults(true); } save(); draw(); return; }
    if (t.id === 'pp-satr') { S.stopAtr = +t.value; if (D) { D.follow = true; setDraftDefaults(true); } save(); draw(); return; }
    if (D && ['pp-at', 'pp-sl', 'pp-tp'].includes(t.id)) { const v = t.value.trim() === '' ? null : +t.value; if (v != null && !Number.isFinite(v)) { msg('Write a price as a number.', true); return; }
      if (t.id === 'pp-sl') { if (v == null) { msg('Every trade needs a stop.', true); t.value = D.stop; return; } D.stop = v; D.follow = false; } else if (t.id === 'pp-tp') { D.target = v; D.follow = false; } else { D.at = v; if (D.follow) setDraftDefaults(true); }
      draw(); return; }
    if (t.classList.contains('pp-ed')) { const p = S.acct.positions.find((x) => x.id === +t.dataset.id); if (!p) return; const v = t.value.trim() === '' ? null : +t.value, dir = p.side === 'buy' ? 1 : -1, cur = pxOf(p.mk);
      if (t.dataset.ed === 'stop') { if (v == null || !Number.isFinite(v)) { msg('Every trade needs a stop.', true); t.value = p.stop; return; } if (cur > 0 && (v - cur) * dir >= 0) { msg(`The stop must be ${dir === 1 ? 'below' : 'above'} the price now.`, true); t.value = p.stop; return; } p.stop = v; if ((v - p.entry) * dir >= 0) p.beMoved = true; }
      else { if (v != null && (!Number.isFinite(v) || (cur > 0 && (v - cur) * dir <= 0))) { msg(`The target must be ${dir === 1 ? 'above' : 'below'} the price now.`, true); t.value = p.target ?? ''; return; } p.target = v; }
      save(); draw(); }
  }
  function onKey(e) { if (e.key === 'Enter' && D && e.target.closest && e.target.closest('.pp-draft')) { e.target.blur(); setTimeout(place, 0); } else if (e.key === 'Escape' && D) { D = null; draw(); } }
  function csv() {
    const T = BT().trades(S.acct.closed), q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['opened', 'closed', 'market', 'side', 'entry', 'stop', 'target', 'exit', 'reason', 'R', 'net']].concat(T.map((t) => [new Date(t.openedAt * 1000).toISOString(), new Date(t.closedAt * 1000).toISOString(), label(t.mk), t.side, t.entry, t.r0 != null ? (t.side === 'buy' ? t.entry - t.r0 : t.entry + t.r0) : '', t.target ?? '', t.exit, t.reason, t.R, t.net]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'paper-trades.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function start() {
    if (!H() || !$('ms-pp') || document.documentElement.dataset.role === 'public') return; load();
    const el = $('ms-pp'); try { el.dataset.open = localStorage.getItem('ms-pp-open') || ''; } catch (e) {} el.hidden = false;
    el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('keydown', onKey);
    const b = $('ms-pp-btn'); if (b) { b.hidden = false; b.addEventListener('click', () => { open(true); }); }
    let raf = 0; const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { try { marks(); } catch (e) {} }); };
    const hook = (c) => { try { c.chart.timeScale().subscribeVisibleLogicalRangeChange(again); } catch (e) {} }; (root.msCharts ? root.msCharts.list : []).forEach(hook); document.addEventListener('ms:chart', (e) => hook(e.detail)); root.addEventListener('resize', again);
    draw(); catchUp(); tmr = setInterval(tick, 2000); setInterval(catchUp, 60e3);
    root.addEventListener('storage', (e) => { if (e.key === KEY) { load(); sig = ''; draw(); } });
    root.msPaper = () => ({ balance: S.acct.balance, positions: S.acct.positions.map((p) => ({ id: p.id, mk: p.mk, side: p.side, entry: p.entry, stop: p.stop, target: p.target })), orders: S.acct.orders.length, closed: S.acct.closed.length, lines: LINES.length, draft: D && { ...D }, marks: (root.msCharts ? root.msCharts.list : []).filter((c) => c.ppc && c.visible()).length });
  }
  if (H()) start(); else document.addEventListener('ms:paperhost', start, { once: true });
})(typeof window !== 'undefined' ? window : globalThis);

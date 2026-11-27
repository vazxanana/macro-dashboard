/* How to use the charts (19 Nov 2026, owner: "And tutorial on how use the charts").
   A "How to use" button on the Desk's Charts toolbar opens a guide in a dialog: one chapter a step, Back / Next, and
   "Show me", which closes the guide and outlines that part of the page for two seconds. Display only: it reads nothing,
   sends nothing and changes no chart, drawing or order. The one thing kept in this browser is that the guide was opened
   (localStorage ms-ch-guide), so the button stops showing its "new" dot. */
(function () {
  'use strict';
  const K = (s) => s.split(' ').map((k) => `<kbd>${k}</kbd>`).join(' + ');
  const CH = [
    { t: 'Pick a market and a timeframe', show: '#v-charts .seg[aria-label="Chart view"]',
      lead: 'Every chart on this page shows the same market. Change the market once and every chart follows.',
      li: ['The market is at the top left of the header (for example XAU/USD ▼). Tap it to choose another one.',
        `D1, H4, H1, M15, M5 and M1 show one timeframe large. The keys ${K('1')} to ${K('6')} do the same.`,
        'The pill under the price scale counts down to the close of the candle that is forming.',
        'Double-click a chart to fit all its candles back on screen. Scroll or pinch to zoom, drag to move back in time: older candles load as you reach them.'] },
    { t: 'One chart or several', show: '#ms-lay-btn',
      lead: 'Choose how many charts you see at once.',
      li: [`<b>All</b> (key ${K('0')}) shows every timeframe in a grid.`,
        '<b>Split</b> shows two charts side by side. The right chart can take any timeframe, including 15 and 30 seconds.',
        '<b>Layout</b> lets you choose 1 to 4 charts and their timeframes. With <b>Sync charts</b> on, scrolling or zooming one moves the others to the same time.',
        'Full screen keeps the layout you are on, split included.'] },
    { t: 'Choose the markup', show: '#v-charts .mk-mode',
      lead: 'The markup is what the desk draws on top of the candles. One at a time, never mixed.',
      li: ['<b>Meridian</b>: the structure: breaks (BO), ChoCh, the range (VR), its confirmation (CF), zones and the expected move.',
        '<b>ICT</b>: fair value gaps, session liquidity, premium and discount, and the ICT desk\'s signals.',
        '<b>Clean</b>: candles only. Your own drawings, indicators and paper trades stay.',
        'Under <b>Style</b>, <b>Clean look</b> keeps only the main marks (BO, VR, CF) and hides the busy ones. Tap it again to bring them back.',
        'The markup is a reading of structure, not a tested trading rule.'] },
    { t: 'Draw on the chart', show: '#ms-dr-bar',
      lead: 'The drawing tools sit in a column on the left of the charts (on a phone, behind Draw): cursor, trend line, horizontal line, ray, vertical line, box, Fibonacci retracement, arrow, text, parallel channel, price and date range, anchored VWAP, measured move, ATR band and magnet.',
      li: ['Pick a tool, then click twice on the chart (or press and drag). A horizontal line, ray or vertical line needs one click; Text asks for its words after one click (double-click a text to change it).',
        '<b>Fibonacci</b>: click the start of the swing, then its end: the 0.236 to 0.786 levels are drawn between them, with their prices.',
        '<b>Parallel channel</b>: two clicks for the first line; drag the middle handle to set the width. <b>Price and date range</b>: two clicks show the move, %, bars and time. <b>Anchored VWAP</b>: one click on the candle to start from.',
        '<b>Measured move</b> (not in TradingView): click A, then B: the same move again from B gives the 1:1 and 1.618 targets. <b>ATR band</b> (not in TradingView): one click draws the typical move (the chart\'s ATR) above and below that price.',
        '<b>Magnet</b> snaps a point to the open, high, low or close of the candle under it: off, weak or strong.',
        'Click a drawing to select it: drag its handles to resize, its body to move it. The bar above it changes colour, width, dashes, adds a label, locks or copies it.',
        `${K('Delete')} removes the selected drawing, ${K('Esc')} lets it go.`,
        'A drawing shows on every chart of that market, whatever the timeframe or layout. It is kept in this browser.',
        '<b>Favourites</b>: hover a tool on the left and tap its star (or right-click it) to put it on a small bar that floats over the charts, like TradingView. Drag the bar by its dotted grip; the star in the top toolbar, after the chart tools, shows or hides it.',
        `Keys: ${K('Alt T')} trend line, ${K('Alt H')} horizontal line, ${K('Alt J')} ray, ${K('Alt V')} vertical line, ${K('Alt R')} box, ${K('Alt F')} Fibonacci, ${K('Alt A')} arrow, ${K('Alt X')} text, ${K('Alt C')} channel, ${K('Alt G')} range, ${K('Alt W')} anchored VWAP, ${K('Alt P')} measured move, ${K('Alt B')} ATR band, ${K('Alt M')} magnet.`] },
    { t: 'The chart tools', show: '#ms-ch-one',
      lead: 'The chart tools sit in the top toolbar, after Clean (on a phone, behind Draw). They work on the chart you touched last; with several charts on screen that one has a thin outline, and its timeframe is written before them.',
      li: ['<b>Position</b>: click the entry, then the stop. The target is drawn at 2R with the size for your risk.',
        '<b>Measure</b>: drag on the chart to see the price and time between two points (or hold Shift and drag).',
        `<b>Replay</b>: hides the future so you can step through candles with ${K('←')} and ${K('→')}.`,
        '<b>Save image</b>, <b>Fit</b> and <b>Full screen</b>.'] },
    { t: 'Right-click menu', show: '#v-charts .ms-grid4',
      lead: 'Right-click any chart.',
      li: ['<b>Reset chart view</b> puts the price scale and the time back.',
        '<b>Delete this drawing</b>, <b>Remove the last drawing</b>, <b>Delete all drawings</b> (it asks first; locked drawings stay).',
        'On the paper account\'s market: <b>Paper buy</b> or <b>Paper sell at</b> the price under the pointer.',
        'With a drawing tool on, a right-click cancels the tool.'] },
    { t: 'Indicators and style', show: '#ms-ind-open',
      lead: 'Add up to 10 indicators and choose how the chart looks.',
      li: ['<b>Indicators</b>: 36 studies in groups with a search: trend (moving averages, Hull, KAMA, Supertrend, Ichimoku), momentum (RSI, MACD, Stochastic, Stochastic RSI, ADX, Aroon, Fisher), volatility (bands, Chandelier exit, range expansion), volume and order flow (VWAP, CVD, OBV, MFI, CMF, volume profile), pivot points, and rarer ones (squeeze, choppiness, Z-score).',
        'The order-flow figures are estimated from the candles: no free feed gives the trades at the bid and ask.',
        '<b>Style</b>: candles, line, or both; your own colours for the background and the candles; bid and ask lines; smooth live price.',
        'These choices are kept on this device.'] },
    { t: 'Alerts on a line', show: '#ms-dr-bar',
      lead: 'Let the desk tell you when price reaches a level you drew.',
      li: ['Draw a horizontal line, a ray or a trend line, select it, then press <b>Alert</b> on the bar above it.',
        'When the price crosses it you get a message on the page and, if you allow it, a browser notification. Then the alert switches off.',
        'It only works while this page is open.'] },
    { t: 'Practise with the paper account', show: '#ms-pp',
      lead: 'Practise trades on the live charts with play money. Nothing reaches a broker. It is off until you switch it on: Profile, then <b>Paper account on the charts</b>.',
      li: ['<b>Buy</b> or <b>Sell</b> opens an order: leave the entry empty to buy at the price now, or type a price for a limit or stop order.',
        'Every order has a stop. Choose the risk, the stop (in ATR) and the target (in R); the stop and target are drawn on the charts.',
        'Move the stop to break-even, close half, or close from the table. <b>Stats and history</b> shows your balance curve, win rate, R and drawdown.',
        'Fills are at the chart\'s price, with no costs, and the account is kept in this browser.'] },
    { t: 'Keyboard', show: null,
      lead: 'Shortcuts on the Charts page (not while you type in a box).',
      li: [`Type a timeframe (${K('15')} ${K('60')} ${K('4h')} ${K('30s')} ${K('1d')}) or a market (${K('eur')} ${K('gold')} ${K('nas')}), then ${K('Enter')}`,
        `${K('1')}…${K('6')} one timeframe · ${K('0')} all timeframes · ${K('F')} fit every chart`,
        `${K('←')} ${K('→')} move the chart under the mouse (${K('Shift')} ten candles) · ${K('↑')} ${K('↓')} zoom · ${K('End')} back to the latest candle`,
        `${K('Ctrl Z')} undo a drawing · ${K('Ctrl Y')} redo · ${K('Alt L')} drawings list · ${K('Alt Shift H')} hide all drawings`,
        `${K('Alt T')} ${K('Alt H')} ${K('Alt J')} ${K('Alt V')} ${K('Alt R')} drawing tools · ${K('Alt M')} magnet`,
        `${K('Delete')} remove the selected drawing · ${K('Esc')} let go or cancel the tool`,
        `${K('B')} Fibonacci · ${K('P')} position · ${K('M')} measure · ${K('R')} replay, on the chart under the mouse`,
        `In replay: ${K('←')} ${K('→')} step back and forward`,
        `Right-click a chart: a horizontal line or an alert at that price, undo, the drawings list`] },
  ];

  const css = `
.ch-help { position: relative; order: 9; height: 38px; padding: 0 12px; border: 1px solid var(--au-line, var(--line)); border-radius: 10px; background: var(--au-surface, var(--panel)); color: var(--au-ink-2, var(--ink-dim)); font: 600 13px var(--sans, system-ui); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.ch-help:hover { color: var(--au-ink, var(--ink)); }
.ch-help:focus-visible { outline: 2px solid var(--au-accent, var(--accent)); outline-offset: 2px; }
.ch-help .q { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid currentColor; display: grid; place-items: center; font: 700 12px/1 var(--sans, system-ui); }
.ch-help.new::after { content: ""; position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border-radius: 50%; background: var(--au-accent, var(--accent)); }
html[data-role="public"] .ch-help { display: none; }
dialog.ms-chgd { width: min(760px, calc(100vw - 32px)); max-height: min(640px, calc(100dvh - 32px)); padding: 0; border: 1px solid var(--au-line, var(--line)); border-radius: 14px; background: var(--au-surface, var(--panel)); color: var(--au-ink, var(--ink)); box-shadow: 0 20px 60px rgba(0,0,0,.35); overflow: hidden; }
dialog.ms-chgd::backdrop { background: rgba(0,0,0,.45); }
.chg-in { display: grid; grid-template-columns: 210px 1fr; height: min(640px, calc(100dvh - 32px)); }
.chg-nav { border-right: 1px solid var(--au-line, var(--line)); padding: 14px 8px; overflow-y: auto; background: var(--au-surface-2, transparent); }
.chg-nav h2 { font: 650 14px var(--sans, system-ui); margin: 2px 8px 10px; }
.chg-nav button { display: flex; gap: 8px; width: 100%; text-align: left; padding: 8px; border: 0; border-radius: 8px; background: transparent; color: var(--au-ink-2, var(--ink-dim)); font: 500 13px var(--sans, system-ui); cursor: pointer; }
.chg-nav button .n { flex: none; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; background: var(--au-well, rgba(127,127,127,.15)); }
.chg-nav button[aria-current="step"] { background: var(--au-surface, var(--panel)); color: var(--au-ink, var(--ink)); box-shadow: inset 2px 0 0 var(--au-accent, var(--accent)); }
.chg-nav button.seen .n { background: var(--au-accent, var(--accent)); color: var(--au-on-primary, #fff); }
.chg-main { display: flex; flex-direction: column; min-height: 0; }
.chg-top { display: flex; align-items: center; gap: 10px; padding: 14px 16px 0; }
.chg-top .st { font: 600 12px var(--sans, system-ui); color: var(--au-ink-3, var(--ink-faint)); flex: 1; }
.chg-x { width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent; color: var(--au-ink-2, var(--ink-dim)); font-size: 22px; line-height: 1; cursor: pointer; }
.chg-body { padding: 6px 20px 12px; overflow-y: auto; flex: 1; font: 14px/1.55 var(--sans, system-ui); }
.chg-body h3 { font: 650 19px/1.3 var(--sans, system-ui); margin: 4px 0 6px; }
.chg-body .lead { color: var(--au-ink-2, var(--ink-dim)); margin: 0 0 12px; }
.chg-body ul { margin: 0; padding-left: 18px; display: grid; gap: 8px; }
.chg-body kbd { font: 600 12px var(--mono, ui-monospace, monospace); padding: 1px 6px; border: 1px solid var(--au-line, var(--line)); border-bottom-width: 2px; border-radius: 5px; background: var(--au-well, transparent); white-space: nowrap; }
.chg-foot { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--au-line, var(--line)); }
.chg-foot .sp { flex: 1; }
.chg-foot button { height: 38px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--au-line, var(--line)); background: transparent; color: var(--au-ink, var(--ink)); font: 600 13px var(--sans, system-ui); cursor: pointer; }
.chg-foot button.pri { background: var(--au-primary, var(--accent)); border-color: transparent; color: var(--au-on-primary, #fff); }
.chg-foot button:disabled { opacity: .45; cursor: default; }
.chg-dots { display: flex; gap: 5px; } .chg-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--au-line, var(--line)); } .chg-dots i.on { background: var(--au-accent, var(--accent)); }
.chg-hl { outline: 2px solid var(--au-accent, var(--accent)) !important; outline-offset: 3px; border-radius: 10px; transition: outline-color .2s; }
@media (max-width: 640px) {
  dialog.ms-chgd { width: 100%; max-width: none; height: 100dvh; max-height: none; margin: 0; inset: 0; border: 0; border-radius: 0; }
  .chg-in { grid-template-columns: 1fr; height: 100dvh; }
  .chg-nav { display: none; }
  .chg-foot .chg-dots { display: none; }
}
@media (pointer: coarse) { .ch-help, .chg-foot button, .chg-x, .chg-nav button { min-height: 44px; } .chg-x { min-width: 44px; } }
@media (prefers-reduced-motion: reduce) { .chg-hl { transition: none; } }`;

  let dlg = null, cur = 0;
  const seen = new Set();
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  function draw() {
    const c = CH[cur];
    dlg.querySelector('.st').textContent = `Step ${cur + 1} of ${CH.length}`;
    dlg.querySelector('.chg-body').innerHTML = `<h3 id="chg-h">${c.t}</h3><p class="lead">${c.lead}</p><ul>${c.li.map((x) => `<li>${x}</li>`).join('')}</ul>`;
    dlg.querySelector('.chg-body').scrollTop = 0;
    dlg.querySelectorAll('.chg-nav button').forEach((b, i) => { b.toggleAttribute('aria-current', false); if (i === cur) b.setAttribute('aria-current', 'step'); b.classList.toggle('seen', seen.has(i) && i !== cur); });
    dlg.querySelectorAll('.chg-dots i').forEach((d, i) => d.classList.toggle('on', i === cur));
    const prev = dlg.querySelector('[data-a="prev"]'), next = dlg.querySelector('[data-a="next"]'), show = dlg.querySelector('[data-a="show"]');
    prev.disabled = cur === 0; next.textContent = cur === CH.length - 1 ? 'Done' : 'Next';
    const tgt = c.show && document.querySelector(c.show), more = moreBtn(); show.hidden = !(tgt && (tgt.offsetParent || more));
    seen.add(cur);
  }
  function go(i) { cur = Math.max(0, Math.min(CH.length - 1, i)); draw(); }
  function build() {
    dlg = document.createElement('dialog'); dlg.className = 'ms-chgd'; dlg.id = 'ms-chg'; dlg.setAttribute('aria-labelledby', 'chg-h');
    dlg.innerHTML = `<div class="chg-in"><nav class="chg-nav" aria-label="Chapters"><h2>How to use the charts</h2>${CH.map((c, i) => `<button type="button" data-i="${i}"><span class="n">${i + 1}</span><span>${c.t}</span></button>`).join('')}</nav>
      <div class="chg-main"><div class="chg-top"><span class="st"></span><button type="button" class="chg-x" data-a="close" aria-label="Close the guide">×</button></div>
      <div class="chg-body"></div>
      <div class="chg-foot"><button type="button" data-a="prev">Back</button><span class="chg-dots">${CH.map(() => '<i></i>').join('')}</span><span class="sp"></span><button type="button" data-a="show">Show me</button><button type="button" class="pri" data-a="next">Next</button></div></div></div>`;
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) { dlg.close(); return; }
      const n = e.target.closest('[data-i]'); if (n) { go(+n.dataset.i); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'close') dlg.close();
      else if (a.dataset.a === 'prev') go(cur - 1);
      else if (a.dataset.a === 'next') { if (cur === CH.length - 1) dlg.close(); else go(cur + 1); }
      else if (a.dataset.a === 'show') showMe(CH[cur].show);
    });
    dlg.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    });
    document.body.appendChild(dlg);
  }
  // the simple phone view keeps the tools behind its "More" button: open it first (it is a plain toggle on the page)
  function moreBtn() { const m = document.getElementById('ps-ch-more'); return m && m.offsetParent && m.getAttribute('aria-expanded') !== 'true' ? m : null; }
  function showMe(sel) {
    const el = sel && document.querySelector(sel); dlg.close(); if (!el) return;
    if (!el.offsetParent) { const m = moreBtn(); if (m) m.click(); }
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.classList.add('chg-hl'); setTimeout(() => el.classList.remove('chg-hl'), 2200);
  }
  function open(i) {
    if (!dlg) build(); go(typeof i === 'number' ? i : cur);
    if (!dlg.open) dlg.showModal();
    store('ms-ch-guide', '1'); const b = document.getElementById('ms-ch-help'); if (b) b.classList.remove('new');
  }

  function init() {
    const st = document.createElement('style'); st.id = 'ms-chg-css'; st.textContent = css; document.head.appendChild(st);
    // in the toolbar row itself: the drawing and chart tools move to a rail at the charts' left edge on a wide screen (19 Nov 2026)
    const bar = document.querySelector('#v-charts .sec-h');
    if (!bar || document.getElementById('ms-ch-help')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'ms-ch-help'; b.className = 'ch-help';
    b.title = 'How to use the charts: a short guide'; b.setAttribute('aria-haspopup', 'dialog');
    b.innerHTML = '<span class="q" aria-hidden="true">?</span><span class="t">How to use</span>'; b.setAttribute('aria-label', 'How to use the charts');
    if (!store('ms-ch-guide')) b.classList.add('new');
    b.addEventListener('click', () => open());
    const sty = bar.querySelector(':scope > #ms-sty'); if (sty) sty.before(b); else bar.appendChild(b);
  }
  window.msChartsGuide = { open, chapters: () => CH.map((c) => ({ t: c.t, show: c.show })) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());

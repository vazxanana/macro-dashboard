// A live chart on each edge desk (22 Nov 2026, owner: "live chart with markups on each edge ... in the website like we done in
// Charts but on the edge page for each edge"). One card at the top of the Mosha, LIT, Engulfing and MSNR desks: a market
// picker (the markets that desk's tracker recorded), timeframes M1 to D1, OANDA candles from /md/bars refreshed while the desk
// is on screen, and the desk's own trades drawn on it: every open record of that market and the latest closed ones the candles
// reach, each with its stored marks (zones, VR boxes, levels), entry / stop / target from the fill to its end, and an entry and
// exit marker. A trade's row opens it in the replay dialog (Before / After). DISPLAY ONLY: no order, nothing stored, nothing
// written; these are paper records of one reading, not a tested rule.
(function (root) {
  'use strict';
  var TFS = [['1m', 'M1', 60], ['5m', 'M5', 300], ['15m', 'M15', 900], ['30m', 'M30', 1800], ['1h', 'H1', 3600], ['4h', 'H4', 14400], ['1d', 'D1', 86400]];
  var POLL = { '1m': 3, '5m': 5, '15m': 10, '30m': 15, '1h': 20, '4h': 60, '1d': 120 };   // seconds between candle reads, by timeframe
  var SHUT_POLL = 60, REC_EVERY = 90, N_BARS = 500, N_CLOSED = 10, VIEW_BARS = 160, LIST_N = 4;
  var DESKS = { mosha: { file: 'mosha/desk.json', name: 'Mosha', h4: true }, lit: { file: 'lit/desk.json', name: 'LIT' }, eg: { file: 'eg/desk.json', name: 'Engulfing', h4: true }, msnr: { file: 'msnr/desk.json', name: 'MSNR' },
    // the passing edges' desks (23 Nov 2026)
    fade: { passing: true, file: 'fade/desk.json', name: 'Break fade' }, bigfade: { passing: true, file: 'bigfade/desk.json', name: 'Big-candle fade' }, roundfade: { passing: true, file: 'roundfade/desk.json', name: 'Round-number fade' }, boxfade: { passing: true, file: 'boxfade/desk.json', name: 'Box fade' }, fvg: { passing: true, file: 'fvg/desk.json', name: 'FVG return' }, goldvb: { passing: true, file: 'goldvb/desk.json', name: 'Gold breakout' }, jpyvb: { passing: true, file: 'jpyvb/desk.json', name: 'USD/JPY breakout' }, dom: { passing: true, file: 'dom/desk.json', name: 'DOM zone' } };   // h4: the card offers the H4 engulf map
  // one colour a kind of mark, as the trade chart (assets/mosha-replay.js HUES / hueKey): [light theme, dark theme]
  var HUES = { ef: ['#c62828', '#ff6b6b'], entry: ['#1565c0', '#5aa7ff'], cf: ['#2e7d32', '#5ed08a'], vr: ['#d84315', '#ff9f5a'], bo: ['#6d4c41', '#d7b899'], half: ['#546074', '#a0aabe'],
    d1: ['#6a1b9a', '#c792ea'], h4: ['#b26a00', '#ffc857'], h1: ['#00796b', '#4dd0c4'], m30: ['#ad1457', '#ff7eb6'], m15: ['#ad1457', '#ff7eb6'], m5: ['#00838f', '#5fd3e6'], m1: ['#00838f', '#5fd3e6'], other: ['#5f6b7a', '#9aa3b2'] };
  function hueKey(label, kind) { var t = String(label || '');
    if (/\bEF\b|failed/i.test(t)) return 'ef'; if (/entry/i.test(t)) return 'entry'; if (/\bCF\b/.test(t)) return 'cf'; if (/\bVR\b/.test(t) || kind === 'vr') return 'vr'; if (/50\s?%/.test(t)) return 'half';
    if (/Daily|\bD1\b/.test(t)) return 'd1'; if (/\bH4\b/.test(t)) return 'h4'; if (/\bH1\b/.test(t)) return 'h1'; if (/\bM30\b/.test(t)) return 'm30'; if (/\bM15\b/.test(t)) return 'm15'; if (/\bM5\b/.test(t)) return 'm5'; if (/\bM1\b/.test(t)) return 'm1';
    if (/\bBO\b|level/i.test(t)) return 'bo'; return 'other'; }
  // the bar index (fractional) a time sits at: inside a candle in proportion, past the last one by whole timeframe steps
  function logicalOf(times, sec, t) {
    var n = times.length; if (!n) return null; if (t <= times[0]) return (t - times[0]) / sec;
    var lo = 0, hi = n - 1; if (t >= times[hi]) return hi + (t - times[hi]) / sec;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
    return lo + Math.min(1, (t - times[lo]) / sec);
  }
  // the candle a time falls in (for a marker): the last candle that started at or before it
  function barAt(times, t) { var n = times.length; if (!n || t < times[0]) return null; var lo = 0, hi = n - 1; if (t >= times[hi]) return times[hi];
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; } return times[lo]; }
  // the trades a chart shows: every open record of the market, then the latest closed ones whose life the candles reach
  function pick(records, market, from, to, nClosed) {
    var mine = (records || []).filter(function (r) { return (r.market || 'xau') === market && isFinite(r.t) && isFinite(r.entry) && isFinite(r.stop); });
    var open = mine.filter(function (r) { return r.R == null && r.t <= to; }).sort(function (a, b) { return b.t - a.t; });
    var closed = mine.filter(function (r) { return r.R != null && r.t <= to && (r.endT || r.t) >= from; }).sort(function (a, b) { return b.t - a.t; }).slice(0, nClosed == null ? N_CLOSED : nClosed);
    return open.concat(closed);
  }
  function marketsOf(records, allowed) { var seen = {}; (records || []).forEach(function (r) { seen[r.market || 'xau'] = 1; });
    return (allowed || Object.keys(seen)).filter(function (k) { return seen[k]; }); }
  // a refreshed read of the newest candles joins the ones held (same time = replaced, newer = added)
  function mergeBars(held, fresh) { if (!held || !held.length) return (fresh || []).slice(); var out = held.slice();
    (fresh || []).forEach(function (b) { var last = out[out.length - 1]; if (b.time === last.time) out[out.length - 1] = b; else if (b.time > last.time) out.push(b); }); return out; }
  // THE H4 ENGULF MAP (23 Nov 2026, from a gold example of 20-23 Nov: an H4 sell engulf zone failed and turned into a buy
  // barrier, and the next H4 sell engulf zone above was the target). `egZones` is a copy of council/eg-methods.mjs `zones` and
  // `turnBack` (the page cannot load that file; a test compares them): the base is the last candle of the other colour, a candle at
  // most EG_SPAN candles after it closes beyond its high (a buy) or low (a sell); the zone is the base candle wick to wick, known
  // at the completing close; `fail` = the close of the first later candle that closes through it, `end` = the fail or the end of
  // its life (EG_LIFE candles), `back` = once failed, the close of the first candle that closes back through it (within 20 days).
  var EG_SPAN = 3, EG_LIFE = 120, EF_DAYS = 20 * 86400, H4S = 14400, H4_N = 300, H4_EVERY = 60, H4_SIDE = 3;
  function egZones(C, sec, life) {
    var out = [], i, j, q, L = life || EG_LIFE;
    for (i = 1; i < C.length; i++) { var c = C[i], dir = c.close > c.open ? 1 : c.close < c.open ? -1 : 0, p = null; if (!dir) continue;
      for (j = i - 1; j >= 0 && j >= i - EG_SPAN; j--) { var b0 = C[j]; if (dir > 0 ? b0.open > b0.close : b0.open < b0.close) { p = b0; break; } }
      if (!p || !(dir > 0 ? c.close > p.high : c.close < p.low)) continue;
      var gone = false; for (q = j + 1; q < i && !gone; q++) { var m = C[q]; gone = dir > 0 ? (m.close > m.open && m.close > p.high) || m.close < p.low : (m.close < m.open && m.close < p.low) || m.close > p.high; }
      if (gone) continue;
      var z = { tf: null, dir: dir, top: p.high, bot: p.low, base: p.time, at: c.time + sec, touch: null, fail: null, i: i, n: i - j };
      for (q = i + 1; q < C.length && q <= i + L; q++) { var b = C[q];
        if (z.touch == null && (dir > 0 ? b.low <= z.top : b.high >= z.bot)) z.touch = b.time;
        if (dir > 0 ? b.close < z.bot : b.close > z.top) { z.fail = b.time + sec; z.fi = q; break; } }
      z.end = z.fail != null ? z.fail : i + L < C.length ? C[i + L].time + sec : Infinity;
      if (z.fail != null) for (q = z.fi + 1; q < C.length && C[q].time < z.fail + EF_DAYS; q++) if (z.dir > 0 ? C[q].close > z.top : C[q].close < z.bot) { z.back = C[q].time + sec; break; }
      out.push(z); }
    return out;
  }
  // what the map draws at `now`, from the H4 candles CLOSED by then only: the engulf zones still standing (not closed through, in
  // their life) and the failed ones (EF) still standing as a barrier the other way (20 days after the fail, until a close back
  // through), the H4_SIDE nearest above and below the last close and every one it sits in. Right-extended boxes, display only.
  function h4Map(H, now) {
    var C = (H || []).filter(function (b) { return b.time + H4S <= now; }); if (C.length < 3) return [];
    var px = C[C.length - 1].close, w = function (d) { return d > 0 ? 'buy' : 'sell'; }, all = [];
    egZones(C, H4S, EG_LIFE).forEach(function (z) {
      if (z.fail == null) { if (z.end > now) all.push({ kind: 'eg', side: z.dir, top: z.top, bot: z.bot, a: z.base, at: z.at, label: 'H4 ' + w(z.dir) + ' EG zone' }); return; }
      if (now - z.fail < EF_DAYS && z.back == null) all.push({ kind: 'ef', side: -z.dir, top: z.top, bot: z.bot, a: z.base, at: z.fail, label: 'H4 EF (failed ' + w(z.dir) + ' \u2192 ' + w(-z.dir) + ' barrier)' }); });
    var dist = function (z) { return Math.abs((z.top + z.bot) / 2 - px); };
    var up = all.filter(function (z) { return z.bot > px; }).sort(function (a, b) { return dist(a) - dist(b); }).slice(0, H4_SIDE);
    var dn = all.filter(function (z) { return z.top < px; }).sort(function (a, b) { return dist(a) - dist(b); }).slice(0, H4_SIDE);
    return up.concat(all.filter(function (z) { return z.bot <= px && z.top >= px; }), dn);
  }
  var API = { TFS: TFS, POLL: POLL, DESKS: DESKS, HUES: HUES, hueKey: hueKey, logicalOf: logicalOf, barAt: barAt, pick: pick, marketsOf: marketsOf, mergeBars: mergeBars, egZones: egZones, h4Map: h4Map, EG_SPAN: EG_SPAN, EG_LIFE: EG_LIFE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_DESK_LIVE = API;
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SOP = function () { return root.MS_MOSHA_SOP; };
  var nameOf = function (k) { var S = SOP(); return S && S.ALL[k] ? S.ALL[k].name : k; };
  var fmtOf = function (k) { var S = SOP(); return S && S.ALL[k] ? S.fmt(k) : function (v) { return (+v).toFixed(2); }; };
  var fR = function (v) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R'; };
  var utc = function (s) { return s ? new Date(s * 1000).toISOString().slice(5, 16).replace('T', ' ') + ' UTC' : '—'; };
  var word = function (d) { return d > 0 ? 'buy' : 'sell'; };
  var H = document.documentElement;
  var ST = {};
  function st(k) { return ST[k] || (ST[k] = { k: k, mk: null, tf: '15m', bars: [], times: [], recs: null, detail: null, recAt: 0, shown: [], focus: null, timer: 0, gen: 0, msg: 'Reading the candles…', at: 0, chart: null, series: null, cv: null, raf: 0, key: '', h4on: true, h4: [], h4At: 0, h4map: [] }); }
  function allowed() { if (H.dataset.role === 'public') return false; return true; }
  function teachOnly() { return H.dataset.mosha === 'teach' && H.dataset.role !== 'owner'; }
  // a see-through token (the soft look's rgba surfaces and lines) is flattened onto the page colour: a canvas needs a solid colour
  var auSolid = (function () { var R = /^rgba\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)[,\s\/]+([\d.]+)\s*\)$/; return function (v) { var m = R.exec(v || ''); if (!m || +m[4] >= 1 || +m[4] < 0.4) return v;   /* tints, grids and bands stay see-through */ var b = getComputedStyle(document.documentElement).getPropertyValue('--au-bg').trim(), h = /^#([0-9a-f]{6})$/i.exec(b), q = h ? [0, 2, 4].map(function (i) { return parseInt(h[1].substr(i, 2), 16); }) : (document.documentElement.getAttribute('data-theme') === 'light' ? [238, 240, 244] : [18, 19, 21]), a = +m[4]; return '#' + [1, 2, 3].map(function (i) { return ('0' + Math.round(+m[i] * a + q[i - 1] * (1 - a)).toString(16)).slice(-2); }).join(''); }; })();
  function tok(n, f) { var v = auSolid(getComputedStyle(H).getPropertyValue(n).trim()); return v || f; }
  function isLight() { var c = tok('--au-bg', tok('--bg', '#121315')), m = /^#([0-9a-f]{6})$/i.exec(c); if (m) { var n = parseInt(m[1], 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 140; }
    var r = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return r ? (+r[1] * 0.299 + +r[2] * 0.587 + +r[3] * 0.114) > 140 : false; }
  function colours() { var L = isLight();
    return { light: L, ink: tok('--au-ink', tok('--ink', L ? '#16181b' : '#ecedef')), ink3: tok('--au-ink-3', tok('--ink-dim', '#8e939b')), line: tok('--au-line', 'rgba(128,128,128,.15)'), gain: tok('--au-gain', tok('--buy', '#4cc38a')), loss: tok('--au-loss', tok('--sell', '#f2726a')),
      surface: tok('--au-surface', tok('--panel', L ? '#ffffff' : '#1a1c1f')) }; }
  function hue(m, C) { var h = HUES[hueKey(m.label, m.kind)] || HUES.other; return h[C.light ? 0 : 1]; }
  function rgba(hex, a) { var n = parseInt(String(hex).slice(1), 16); if (!isFinite(n)) return hex; return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

  function styles() {
    if ($('ms-dl-css')) return; var el = document.createElement('style'); el.id = 'ms-dl-css';
    el.textContent = [
      '.dl-card { grid-column: 1 / -1; min-width: 0; background: var(--au-surface, var(--panel)); border: 1px solid var(--au-line, var(--line)); border-radius: 12px; padding: 16px 18px; display: grid; gap: 10px; color: var(--au-ink, var(--ink)); font-family: var(--au-font, var(--sans)); }',
      '.dl-card .dl-h { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; } .dl-card .dl-h b { font: 650 15px/1.3 var(--au-font, var(--sans)); } .dl-card .dl-h small { font-size: 12.5px; color: var(--au-ink-3, var(--ink-dim)); }',
      '.dl-card .dl-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; } .dl-seg { display: inline-flex; flex-wrap: wrap; gap: 4px; }',
      '.dl-card .dl-b { font: 600 12.5px/1 var(--au-font, var(--sans)); min-height: 32px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--au-line, var(--line)); background: transparent; color: var(--au-ink-2, var(--ink)); cursor: pointer; }',
      '.dl-card .dl-b[aria-pressed="true"] { background: var(--au-surface-2, var(--panel-2)); color: var(--au-ink, var(--ink)); box-shadow: inset 0 -2px 0 var(--au-accent, var(--accent)); }',
      '.dl-card .dl-b:focus-visible { outline: 2px solid var(--au-accent, var(--accent)); outline-offset: 2px; }',
      '.dl-card select.dl-b { padding-right: 6px; }',
      '.dl-wrap { position: relative; height: 440px; min-width: 0; border-radius: 8px; overflow: hidden; background: var(--au-well, transparent); }',
      '.dl-wrap .dl-chart { position: absolute; inset: 0; } .dl-wrap canvas.dl-ov { position: absolute; left: 0; top: 0; z-index: 3; pointer-events: none; }',
      '.dl-st { margin: 0; font-size: 12.5px; color: var(--au-ink-3, var(--ink-dim)); } .dl-st .dl-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--au-gain, var(--buy)); margin-right: 6px; vertical-align: 1px; } .dl-st .dl-dot.off { background: var(--au-ink-3, var(--ink-dim)); }',
      '.dl-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; } .dl-list li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 6px 10px; border: 1px solid var(--au-line, var(--line)); border-radius: 8px; font-size: 13px; cursor: pointer; min-width: 0; }',
      '.dl-list .dl-r { display: inline-flex; align-items: center; gap: 10px; margin-left: auto; }',
      '.dl-list li.on { border-color: var(--au-accent, var(--accent)); background: var(--au-surface-2, transparent); } .dl-list .dl-l { flex: 1 1 200px; min-width: 0; overflow-wrap: anywhere; } .dl-list small { color: var(--au-ink-3, var(--ink-dim)); font-size: 12px; }',
      '.dl-list .chip { font: 600 12px/1.5 var(--au-font, var(--sans)); padding: 0 8px; border-radius: 999px; border: 1px solid currentColor; } .dl-list .chip.buy { color: var(--buy-ink, var(--au-gain)); } .dl-list .chip.sell { color: var(--sell-ink, var(--au-loss)); }',
      '.dl-list .pos { color: var(--buy-ink, var(--au-gain)); } .dl-list .neg { color: var(--sell-ink, var(--au-loss)); } .dl-note { margin: 0; font-size: 12px; color: var(--au-ink-3, var(--ink-dim)); }',
      'html[data-mosha="teach"]:not([data-role="owner"]) #v-mosha .dl-card { display: none; }',
      'html:not([data-mosha="teach"]) #v-mosha .dl-card, html[data-role="owner"] #v-mosha .dl-card { order: -12; }',
      '@media (max-width: 640px) { .dl-wrap { height: 320px; } .dl-card { padding: 14px 12px; } }',
      '@media (pointer: coarse) { .dl-card .dl-b { min-height: 44px; } .dl-list li { min-height: 44px; } }'].join('\n');
    document.head.appendChild(el);
  }
  function host(k) {
    var v = $('v-' + k); if (!v) return null; var c = v.querySelector('.dl-card'); if (c) return c;
    var grid = v.querySelector('.mo-grid'); if (!grid) return null;
    c = document.createElement('div'); c.className = 'dl-card mo-wide'; c.setAttribute('data-dl', k); c.setAttribute('role', 'region'); c.setAttribute('aria-label', 'Live chart');
    c.innerHTML = '<div class="dl-h"><b>Live chart</b><small>' + esc(DESKS[k].name) + ' trades on live candles · the latest open and closed trades of this market with their marks · ' + (DESKS[k].passing ? 'paper record of a rule that passed its study before costs, not a trade signal' : 'paper record, not a tested rule') + '</small></div>' +
      '<div class="dl-bar"><select class="dl-b" data-dl-mk aria-label="Market"></select><div class="dl-seg" role="group" aria-label="Timeframe">' +
      TFS.map(function (t) { return '<button type="button" class="dl-b" data-dl-tf="' + t[0] + '" aria-pressed="false">' + t[1] + '</button>'; }).join('') + '</div>' +
      (DESKS[k].h4 ? '<button type="button" class="dl-b" data-dl-h4 aria-pressed="true" title="The H4 engulf zones still standing and the failed ones (EF) still standing as a barrier the other way">H4 zones</button>' : '') + '</div>' +
      '<div class="dl-wrap"><div class="dl-chart"></div><canvas class="dl-ov" aria-hidden="true"></canvas></div><p class="dl-st" aria-live="polite"></p><ul class="dl-list"></ul>' +
      '<p class="dl-note">The chosen trade shows its marks, entry, stop and target as the tracker recorded them, from its fill to its end; the others show their entry line only. Tap a trade, or its marker on the chart, to choose it; "Chart" opens it Before / After.' +
      (DESKS[k].h4 ? ' "H4 zones" draws the H4 engulf zones still standing and the failed ones (EF) still standing as a barrier the other way, from closed H4 candles, the nearest three above and below the price: a map, not a signal.' : '') + '</p>';
    grid.insertBefore(c, grid.firstChild); return c;
  }
  function build(k) {
    var S = st(k), c = host(k), LW = root.LightweightCharts; if (!c || S.chart || !LW) return !!S.chart;
    var box = c.querySelector('.dl-chart'), C = colours();
    S.chart = LW.createChart(box, { autoSize: true, layout: { background: { color: 'transparent' }, textColor: C.ink3, fontSize: 12 }, grid: { vertLines: { color: 'transparent' }, horzLines: { color: C.line } },
      rightPriceScale: { borderColor: C.line }, timeScale: { borderColor: C.line, timeVisible: true, secondsVisible: false, rightOffset: 6 }, crosshair: { mode: 0 } });
    // the price scale also holds the chosen trade's entry, stop and target, so its levels are never off the chart
    S.series = S.chart.addCandlestickSeries({ upColor: C.gain, downColor: C.loss, wickUpColor: C.gain, wickDownColor: C.loss, borderVisible: false, priceLineVisible: true, lastValueVisible: true, priceLineSource: 0,
      autoscaleInfoProvider: function (orig) { var r = orig(), f = focused(S); if (!r || !r.priceRange || !f) return r; var ps = [f.entry, f.stopNow != null ? f.stopNow : f.stop, f.target].filter(function (v) { return isFinite(v) && v !== null; });
        ps.forEach(function (v) { r.priceRange.minValue = Math.min(r.priceRange.minValue, v); r.priceRange.maxValue = Math.max(r.priceRange.maxValue, v); }); return r; } });
    S.cv = c.querySelector('canvas.dl-ov');
    S.chart.timeScale().subscribeVisibleLogicalRangeChange(function () { paint(k); });
    if (S.chart.subscribeClick) S.chart.subscribeClick(function (p) { var id = p && p.hoveredObjectId; if (id && typeof id === 'string') { S.focus = id.replace(/:[ex]$/, ''); markers(k); list(k); S.series.applyOptions({}); S.key = ''; paint(k); } });
    return true;
  }
  function restyle() { Object.keys(ST).forEach(function (k) { var S = ST[k]; if (!S.chart) return; var C = colours();
    S.chart.applyOptions({ layout: { textColor: C.ink3 }, grid: { horzLines: { color: C.line } }, rightPriceScale: { borderColor: C.line }, timeScale: { borderColor: C.line } });
    S.series.applyOptions({ upColor: C.gain, downColor: C.loss, wickUpColor: C.gain, wickDownColor: C.loss }); markers(k); S.key = ''; paint(k); }); }

  function focused(S) { for (var i = 0; i < S.shown.length; i++) if (S.shown[i].id === S.focus) return S.shown[i]; return null; }
  // bring the chosen trade into view: from a while before its fill to a little after its end (or the last candle)
  function frame(k) { var S = st(k), f = focused(S), n = S.bars.length; if (!S.chart || !n) return; var ts = S.chart.timeScale();
    if (!f) { ts.setVisibleLogicalRange({ from: Math.max(0, n - VIEW_BARS), to: n + 5 }); return; }
    var sec = tfSec(S.tf), a = logicalOf(S.times, sec, f.t), b = logicalOf(S.times, sec, f.R != null && f.endT ? f.endT : S.times[n - 1]); if (a == null || b == null) return;
    var from = a - 40, to = Math.max(b + 15, from + 90); if (to > n + 10) { from -= to - (n + 10); to = n + 10; }
    ts.setVisibleLogicalRange({ from: Math.max(-5, from), to: to }); }
  function onScreen(k) { var v = $('v-' + k); return !!(v && !v.hidden && !document.hidden && allowed() && !(k === 'mosha' && teachOnly())); }
  function tfSec(tf) { for (var i = 0; i < TFS.length; i++) if (TFS[i][0] === tf) return TFS[i][2]; return 900; }
  function records(k, force) {
    var S = st(k), D = root.msData; if (!D || typeof D.json !== 'function') return Promise.resolve();
    if (!force && S.recs && Date.now() - S.recAt < REC_EVERY * 1000) return Promise.resolve();
    S.recAt = Date.now();
    return Promise.resolve(D.json(DESKS[k].file)).then(function (j) {
      if (!j || !Array.isArray(j.records)) { if (!S.recs) S.recs = []; return; }
      var keep = k === 'mosha' && SOP() ? SOP().MOSHA : null, old = {};
      (S.recs || []).forEach(function (r) { if (r.marks) old[r.id] = r; });
      S.recs = j.records.filter(function (r) { return !keep || keep.indexOf(r.market || 'xau') >= 0; }).map(function (r) { var o = old[r.id]; if (o && o.t === r.t) { r.marks = o.marks; r.log = o.log; } return r; });
      S.detail = j.detail || null;
    }, function () { if (!S.recs) S.recs = []; });
  }
  function pickers(k) {
    var S = st(k), c = host(k); if (!c) return; var SO = SOP(), order = SO ? Object.keys(SO.ALL) : null;
    var mks = marketsOf(S.recs, k === 'mosha' && SO ? SO.MOSHA : order); if (!mks.length) mks = ['xau'];
    if (!S.mk || mks.indexOf(S.mk) < 0) S.mk = mks.indexOf('xau') >= 0 ? 'xau' : mks[0];
    var sel = c.querySelector('[data-dl-mk]'), html = mks.map(function (m) { return '<option value="' + esc(m) + '"' + (m === S.mk ? ' selected' : '') + '>' + esc(nameOf(m)) + '</option>'; }).join('');
    if (sel.innerHTML !== html) sel.innerHTML = html;
    c.querySelectorAll('[data-dl-tf]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-dl-tf') === S.tf)); });
    var hb = c.querySelector('[data-dl-h4]'); if (hb) hb.setAttribute('aria-pressed', String(!!S.h4on));
  }
  function status(k) { var S = st(k), c = host(k); if (!c) return; var p = c.querySelector('.dl-st'), live = S.at && Date.now() - S.at < 3 * 60e3;
    p.innerHTML = '<span class="dl-dot' + (live && !S.err ? '' : ' off') + '"></span>' + esc(S.msg); }
  function candles(k, full) {
    var S = st(k), mk = S.mk, tf = S.tf, gen = S.gen;
    var n = full || !S.bars.length ? N_BARS : 5;
    return fetch('/md/bars?sym=' + encodeURIComponent(mk) + '&tf=' + tf + '&n=' + n, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (gen !== S.gen) return;
      var bars = j && Array.isArray(j.bars) ? j.bars.filter(function (b) { return isFinite(b.time) && isFinite(b.open) && isFinite(b.high) && isFinite(b.low) && isFinite(b.close); }).map(function (b) { return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }; }) : null;
      if (!bars || !bars.length) { S.err = true; S.msg = S.bars.length ? 'Live candles paused: the market data service did not answer; showing the last ones read.' : 'The candles could not be read from the market data service.'; return; }
      S.err = false; var was = S.bars.length;
      S.bars = n === N_BARS ? bars : mergeBars(S.bars, bars); S.times = S.bars.map(function (b) { return b.time; });
      if (n === N_BARS || bars.length > 1 || !was) S.series.setData(S.bars); else S.series.update(S.bars[S.bars.length - 1]);
      S.fresh = !was;
      S.at = Date.now(); var last = S.bars[S.bars.length - 1];
      S.msg = 'Live · ' + nameOf(mk) + ' ' + labelOf(tf) + ' · last price ' + fmtOf(mk)(last.close) + ' · read ' + new Date().toISOString().slice(11, 19) + ' UTC';
    }, function () { if (gen !== S.gen) return; S.err = true; S.msg = 'The candles could not be read: no connection to the market data service.'; });
  }
  // the H4 candles of the engulf map: the chart's own on H4, else a read of their own at most every H4_EVERY seconds; zones from closed candles only
  function h4bars(k) {
    var S = st(k), mk = S.mk, gen = S.gen; if (!DESKS[k].h4 || !S.h4on) return Promise.resolve();
    var done = function () { S.h4map = h4Map(S.h4, Date.now() / 1000); };
    if (S.tf === '4h') { S.h4 = S.bars; done(); return Promise.resolve(); }
    if (S.h4.length && Date.now() - S.h4At < H4_EVERY * 1000) { done(); return Promise.resolve(); }
    S.h4At = Date.now();
    return fetch('/md/bars?sym=' + encodeURIComponent(mk) + '&tf=4h&n=' + H4_N, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (gen !== S.gen) return; var b = j && Array.isArray(j.bars) ? j.bars.filter(function (x) { return isFinite(x.time) && isFinite(x.open) && isFinite(x.high) && isFinite(x.low) && isFinite(x.close); }).map(function (x) { return { time: x.time, open: x.open, high: x.high, low: x.low, close: x.close }; }) : null;
      if (b && b.length) S.h4 = b; done(); }, function () { if (gen === S.gen) done(); });
  }
  function labelOf(tf) { for (var i = 0; i < TFS.length; i++) if (TFS[i][0] === tf) return TFS[i][1]; return tf; }
  function trades(k) {
    var S = st(k); if (!S.bars.length || !S.recs) { S.shown = []; return Promise.resolve(); }
    var from = S.times[0], to = S.times[S.times.length - 1] + tfSec(S.tf);
    S.shown = pick(S.recs, S.mk, from, to, N_CLOSED);
    if (!S.focus || !S.shown.some(function (r) { return r.id === S.focus; })) S.focus = S.shown.length ? S.shown[0].id : null;
    var SO = SOP(), need = S.shown.filter(function (r) { return !r.log; });
    if (!SO || !need.length) return Promise.resolve();
    return Promise.all(need.map(function (r) { return SO.withDetail(S.detail, r); })).then(function () {}, function () {});
  }
  function markers(k) {
    var S = st(k); if (!S.series) return; var C = colours(), out = [];
    S.shown.forEach(function (r) { var on = r.id === S.focus, tb = barAt(S.times, r.t); if (tb != null) out.push({ id: r.id + ':e', time: tb, position: r.side > 0 ? 'belowBar' : 'aboveBar', shape: r.side > 0 ? 'arrowUp' : 'arrowDown', color: on ? (r.side > 0 ? C.gain : C.loss) : C.ink3, text: on ? word(r.side) : '', size: on ? 1 : 0.6 });
      if (r.R != null && r.endT) { var xb = barAt(S.times, r.endT); if (xb != null) out.push({ id: r.id + ':x', time: xb, position: r.side > 0 ? 'aboveBar' : 'belowBar', shape: 'circle', color: on ? (r.R > 0 ? C.gain : r.R < 0 ? C.loss : C.ink3) : C.ink3, text: on ? fR(r.R) : '', size: on ? 1 : 0.5 }); } });
    out.sort(function (a, b) { return a.time - b.time; }); S.series.setMarkers(out);
  }
  function list(k) {
    var S = st(k), c = host(k); if (!c) return; var ul = c.querySelector('.dl-list'), f = fmtOf(S.mk);
    if (!S.shown.length) { ul.innerHTML = '<li class="dl-empty" style="cursor:default"><small>' + (S.recs ? 'No trade of this desk on ' + esc(nameOf(S.mk)) + ' in the candles shown. A higher timeframe reaches further back.' : 'Reading the desk\'s trades…') + '</small></li>'; return; }
    var rows = S.all ? S.shown : S.shown.slice(0, LIST_N); if (!S.all && S.focus && !rows.some(function (r) { return r.id === S.focus; })) rows = rows.concat(S.shown.filter(function (r) { return r.id === S.focus; }));
    ul.innerHTML = rows.map(function (r) { var res = r.R == null ? '<b>Open</b>' + (r['float'] != null ? ' · ' + fR(r['float']) + ' at the last reading' : '') : '<b class="' + (r.R > 0 ? 'pos' : r.R < 0 ? 'neg' : '') + '">' + fR(r.R) + '</b>';
      return '<li data-dl-focus="' + esc(r.id) + '" tabindex="0" role="button" aria-pressed="' + (S.focus === r.id) + '"' + (S.focus === r.id ? ' class="on"' : '') + '><span class="chip ' + word(r.side) + '">' + word(r.side) + '</span>' +
        '<span class="dl-l">' + esc(r.label || r.kind) + ' <small>' + utc(r.t) + ' · entry ' + f(r.entry) + '</small></span><span class="dl-r"><span>' + res + '</span><button type="button" class="dl-b" data-dl-open="' + esc(r.id) + '">Chart</button></span></li>'; }).join('') +
      (S.shown.length > rows.length ? '<li class="dl-more" style="cursor:default"><button type="button" class="dl-b" data-dl-all>Show all ' + S.shown.length + ' trades on the chart</button></li>' : '');
  }
  // the chart library places whole indexes only (a fractional one comes back as 0), so a time inside a candle is placed between
  // its neighbours (as assets/ms-draw.js l2x)
  function l2x(ts, l) { var i = Math.floor(l), a = ts.logicalToCoordinate(i), b = ts.logicalToCoordinate(i + 1); if (a == null) return null; if (b == null || l === i) return a; return a + (b - a) * (l - i); }
  // the overlay: marks, then entry / stop / target from the fill to the trade's end, then labels; redrawn when the view moves
  function paint(k) {
    var S = st(k); if (!S.chart || !S.cv || !S.times.length) return; var ts = S.chart.timeScale(), wrap = S.cv.parentNode;
    var W = wrap.clientWidth, Hh = wrap.clientHeight, pw = ts.width(), ph = Hh - ts.height(), dpr = root.devicePixelRatio || 1;
    if (S.cv.width !== Math.round(W * dpr) || S.cv.height !== Math.round(Hh * dpr)) { S.cv.width = Math.round(W * dpr); S.cv.height = Math.round(Hh * dpr); S.cv.style.width = W + 'px'; S.cv.style.height = Hh + 'px'; }
    var x = S.cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, Hh);
    var map = DESKS[k].h4 && S.h4on ? S.h4map : []; if (!S.shown.length && !map.length) return; x.save(); x.beginPath(); x.rect(0, 0, pw, ph); x.clip();
    var C = colours(), sec = tfSec(S.tf), right = S.times[S.times.length - 1] + sec * 4, f = fmtOf(S.mk), labels = [];
    var X = function (t) { var l = logicalOf(S.times, sec, t), v = l == null ? null : l2x(ts, l); return v == null ? null : Math.max(-2, Math.min(pw + 2, v)); };
    var Y = function (p) { var v = S.series.priceToCoordinate(p); return v == null ? null : v; };
    // the H4 engulf map under the trades: boxes from the zone's base candle to the right edge, named at the right
    map.forEach(function (z) { var x0 = X(Math.max(z.a, S.times[0] - sec)), yt = Y(z.top), yb = Y(z.bot); if (x0 == null || yt == null || yb == null || x0 > pw) return;
      var top = Math.min(yt, yb), h = Math.max(1, Math.abs(yb - yt)); if (top > ph || top + h < 0) return; var col = hue(z, C);
      x.fillStyle = rgba(col, z.kind === 'ef' ? 0.12 : 0.08); x.fillRect(x0, top, pw - x0, h); x.strokeStyle = rgba(col, 0.7); x.lineWidth = 1; x.setLineDash([4, 3]); x.strokeRect(x0 + 0.5, top + 0.5, Math.max(0, pw - x0 - 1), Math.max(0, h - 1)); x.setLineDash([]);
      labels.push({ x: pw, y: Math.max(12, top + 12), t: z.label + ' ' + f(z.bot) + '\u2013' + f(z.top), col: col, map: true }); });
    var order = S.shown.slice().sort(function (a, b) { return (a.id === S.focus) - (b.id === S.focus); });
    order.forEach(function (r) {
      var main = S.focus === r.id, end = r.R != null && r.endT ? r.endT : right;
      x.globalAlpha = main ? 1 : 0.35;
      (main ? r.marks || [] : []).forEach(function (m) {
        var x0 = X(Math.max(m.a || r.t, S.times[0] - sec)), x1 = X(end); if (x0 == null || x1 == null || x1 < 0 || x0 > pw) return; var col = hue(m, C);
        if (m.kind === 'level') { var y = Y(m.p); if (y == null || y < -2 || y > ph + 2) return; x.strokeStyle = col; x.lineWidth = 1.25; x.setLineDash([5, 3]); x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke(); x.setLineDash([]);
          if (main) labels.push({ x: Math.max(4, x0), y: y - 4, t: m.label, col: col }); return; }
        var yt = Y(m.top), yb = Y(m.bot); if (yt == null || yb == null) return; var top = Math.min(yt, yb), h = Math.max(1, Math.abs(yb - yt)); if (top > ph || top + h < 0) return;
        x.fillStyle = rgba(col, m.kind === 'vr' || m.kind === 'bvr' ? 0.08 : 0.16); x.fillRect(x0, top, x1 - x0, h); x.strokeStyle = rgba(col, 0.8); x.lineWidth = 1; x.strokeRect(x0 + 0.5, top + 0.5, Math.max(0, x1 - x0 - 1), Math.max(0, h - 1));
        if (main) labels.push({ x: Math.max(4, x0 + 3), y: Math.max(12, top + 12), t: m.label, col: col });
      });
      var xs = X(r.t), xe = X(end); if (xs == null || xe == null || xe < 0 || xs > pw) return;
      var ye = Y(r.entry), yst = Y(r.stopNow != null ? r.stopNow : r.stop), ytg = r.target == null ? null : Y(r.target);
      if (main && ye != null) { if (yst != null) { x.fillStyle = rgba(C.loss.charAt(0) === '#' ? C.loss : '#f2726a', 0.10); x.fillRect(xs, Math.min(ye, yst), xe - xs, Math.abs(yst - ye)); }
        if (ytg != null) { x.fillStyle = rgba(C.gain.charAt(0) === '#' ? C.gain : '#4cc38a', 0.10); x.fillRect(xs, Math.min(ye, ytg), xe - xs, Math.abs(ytg - ye)); } }
      [[ye, C.ink, [], 'Entry ' + f(r.entry)], [yst, C.loss, [4, 3], 'Stop ' + f(r.stopNow != null ? r.stopNow : r.stop)], [ytg, C.gain, [4, 3], r.target == null ? '' : 'Target ' + f(r.target)]].forEach(function (L, i) {
        if (L[0] == null || (!main && i > 0)) return; x.strokeStyle = L[1]; x.lineWidth = main ? 1.5 : 1; x.setLineDash(L[2]); x.beginPath(); x.moveTo(xs, L[0]); x.lineTo(xe, L[0]); x.stroke(); x.setLineDash([]);
        if (main && L[3]) labels.push({ x: xe + 6, y: L[0] + 4, t: L[3], col: L[1], after: true, first: true }); });
    });
    x.globalAlpha = 1; x.font = '600 12px ' + (tok('--au-font', '') || 'system-ui, sans-serif'); x.textBaseline = 'alphabetic';
    // entry / stop / target first (beside their line's end, else just before it), then the marks' names; a label that would
    // cover another moves up or down a line at a time
    var used = [], OFF = [0, -15, 15, -30, 30, -45, 45];
    var rank = function (L) { return L.first ? 2 : L.map ? 0 : 1; }; labels.sort(function (a, b) { return rank(b) - rank(a); }).forEach(function (L) { var w = x.measureText(L.t).width + 8, lx = L.after ? (L.x + w <= pw - 2 ? L.x : L.x - 12 - w) : Math.min(L.x, pw - w - 2), y0 = Math.max(14, Math.min(ph - 4, L.y)), ly = y0;
      var hit = function (y) { return used.some(function (u) { return Math.abs(u.y - y) < 15 && lx < u.x + u.w && lx + w > u.x; }); };
      for (var i = 0; i < OFF.length; i++) { ly = Math.max(14, Math.min(ph - 4, y0 + OFF[i])); if (!hit(ly)) break; }
      used.push({ x: lx, y: ly, w: w }); x.fillStyle = rgba(C.surface.charAt(0) === '#' ? C.surface : (C.light ? '#ffffff' : '#1a1c1f'), 0.85); x.fillRect(lx, ly - 12, w, 16); x.fillStyle = L.col; x.fillText(L.t, lx + 4, ly); });
    x.restore();
  }
  // a cheap look each frame while the desk is on screen: the price scale can move with no event (autoscale, an axis drag)
  function watch(k) { var S = st(k); if (S.raf) return;
    var step = function () { S.raf = 0; if (!onScreen(k) || !S.chart) return; var ts = S.chart.timeScale(), r = ts.getVisibleLogicalRange(), p = S.bars.length ? S.series.priceToCoordinate(S.bars[S.bars.length - 1].close) : 0, w = S.cv && S.cv.parentNode;
      var key = (r ? r.from.toFixed(2) + ',' + r.to.toFixed(2) : '') + '|' + (p == null ? '' : p.toFixed(1)) + '|' + (w ? w.clientWidth + 'x' + w.clientHeight : '') + '|' + S.shown.length + '|' + S.focus;
      if (key !== S.key) { S.key = key; paint(k); } S.raf = requestAnimationFrame(step); };
    S.raf = requestAnimationFrame(step); }
  function cycle(k, full) {
    var S = st(k); clearTimeout(S.timer); S.timer = 0; if (!onScreen(k) || !build(k)) return;
    records(k, false).then(function () { pickers(k); return candles(k, full); }).then(function () { return h4bars(k); }).then(function () { return trades(k); }).then(function () { markers(k); list(k); status(k); if (S.fresh) { S.fresh = false; frame(k); } S.key = ''; paint(k); watch(k); }).then(function () {
      if (!onScreen(k)) return; var last = S.bars.length ? S.bars[S.bars.length - 1].time : 0, shut = last && Date.now() / 1000 - last > tfSec(S.tf) + 900;
      S.timer = setTimeout(function () { cycle(k, false); }, (shut ? Math.max(SHUT_POLL, POLL[S.tf]) : POLL[S.tf]) * 1000); });
  }
  function reset(k) { var S = st(k); S.gen++; S.bars = []; S.times = []; S.h4 = []; S.h4At = 0; S.h4map = []; S.shown = []; S.focus = null; S.all = false; S.msg = 'Reading the candles…'; if (S.series) { S.series.setData([]); S.series.setMarkers([]); } status(k); list(k); cycle(k, true); }
  function start(k) { if (!DESKS[k] || !allowed()) return; styles(); if (!host(k)) return; var S = st(k); status(k); if (!build(k)) { setTimeout(function () { start(k); }, 800); return; } if (S.timer) return; cycle(k, !S.bars.length); }
  document.addEventListener('change', function (e) { var s = e.target && e.target.closest && e.target.closest('[data-dl-mk]'); if (!s) return; var c = s.closest('.dl-card'), k = c && c.getAttribute('data-dl'); if (!k) return; st(k).mk = s.value; reset(k); });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-dl-tf], [data-dl-h4], [data-dl-open], [data-dl-all], [data-dl-focus]') : null; if (!b) return; var c = b.closest('.dl-card'), k = c && c.getAttribute('data-dl'); if (!k) return; var S = st(k);
    if (b.hasAttribute('data-dl-tf')) { if (S.tf !== b.getAttribute('data-dl-tf')) { S.tf = b.getAttribute('data-dl-tf'); pickers(k); reset(k); } return; }
    if (b.hasAttribute('data-dl-h4')) { S.h4on = !S.h4on; pickers(k); S.key = ''; paint(k); if (S.h4on) h4bars(k).then(function () { S.key = ''; paint(k); }); return; }   // display only: the choice is not kept
    if (b.hasAttribute('data-dl-all')) { S.all = true; list(k); return; }
    if (b.hasAttribute('data-dl-open')) { e.stopPropagation(); var id = b.getAttribute('data-dl-open'), r = S.shown.filter(function (x) { return x.id === id; })[0]; if (r) openTrade(k, r); return; }
    S.focus = b.getAttribute('data-dl-focus'); markers(k); list(k); frame(k); S.series.applyOptions({}); S.key = ''; paint(k);
  });
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('li[data-dl-focus]')) { e.preventDefault(); e.target.click(); } });
  function openTrade(k, r) { var SO = SOP(); if (!SO) return; var mk = r.market || 'xau', fP = fmtOf(mk);
    SO.withDetail(S0(k).detail, r).then(function (r) {
      var T = { replayed: true, name: (r.label || r.kind) + ' · ' + nameOf(mk), marks: r.marks || [], steps: (r.log || []).filter(function (x) { return x.t; }), id: r.id, market: mk, side: word(r.side), at: r.t, entry: +fP(r.entry), stop: +fP(r.stop), target: r.target == null ? null : +fP(r.target), status: r.R != null ? 'closed' : 'open', exit: r.exit != null ? +fP(r.exit) : null, exitAt: r.endT, R: r.R, how: r.status };
      if (typeof root.msMoshaReplayDialog === 'function') root.msMoshaReplayDialog(T, $('v-' + k)); }); }
  function S0(k) { return st(k); }
  // a read-only view for the browser audit: what each desk's chart holds and where the chosen trade's fill lands on screen
  API.state = function (k) { var S = ST[k]; if (!S) return null; var f = S.shown.filter(function (r) { return r.id === S.focus; })[0], ts = S.chart && S.chart.timeScale();
    var lx = f && S.times.length ? logicalOf(S.times, tfSec(S.tf), f.t) : null;
    return { market: S.mk, tf: S.tf, bars: S.bars.length, first: S.times[0] || null, last: S.times[S.times.length - 1] || null, shown: S.shown.map(function (r) { return r.id; }), focus: S.focus, marks: f && f.marks ? f.marks.length : 0, fillLogical: lx, fillX: ts && lx != null ? l2x(ts, lx) : null, msg: S.msg, h4on: !!(DESKS[k].h4 && S.h4on), h4: (S.h4map || []).map(function (z) { return { kind: z.kind, side: z.side, top: z.top, bot: z.bot, label: z.label }; }) }; };
  // run while a desk is on screen: each view's hidden attribute and the tab's visibility
  function look() { Object.keys(DESKS).forEach(function (k) { if (onScreen(k)) start(k); }); }
  if (root.MutationObserver) { var mo = new MutationObserver(function (rs) { var theme = rs.some(function (r) { return r.target === H; }); look(); if (theme) restyle(); });
    Object.keys(DESKS).forEach(function (k) { var v = $('v-' + k); if (v) mo.observe(v, { attributes: true, attributeFilter: ['hidden'] }); });
    mo.observe(H, { attributes: true, attributeFilter: ['data-theme', 'class'] }); }
  document.addEventListener('visibilitychange', look);
  if (root.matchMedia) { var mq = root.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', restyle); }
  look();
})(typeof window !== 'undefined' ? window : globalThis);

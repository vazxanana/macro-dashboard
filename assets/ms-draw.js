/* Drawing tools like ChronosTrade on the Desk's charts (18 Nov 2026, owner: "chart should have the same chronotrades charts
   features all of them"). Display only: a drawing never places, changes or refuses an order and moves no stop.
   - Tools: trend line, horizontal line, horizontal ray, vertical line, box, Fibonacci retracement, arrow, text, parallel channel,
     price and date range, anchored VWAP, measured move, ATR band (19 Nov 2026); magnet (off / weak / strong) on the candle's
     open / high / low / close; select, move, resize by handles; a style bar (5 colours, width, dashed, extend, label, lock,
     clone, delete; a text's words and size); Alt+T / H / J / V / R / F / A / X / M; a double-click edits a text; Delete removes the selected drawing, Esc lets go.
   - Every chart the page registers (window.msCharts) of the same market shows the same drawings: draw on one, see it on all.
   - A right-click on a chart: Reset chart view, Delete this drawing, Remove the last drawing, Delete all drawings.
   - Shapes are ChronosTrade's ({ type, t1, p1, t2, p2 | price, col, w, ls, ext, lock, lbl }), the geometry, hit test, magnet,
     resize and move are its pure helpers (window.BT from assets/backtest-engine.js). Stored per market in this browser
     (localStorage ms-dr-<market>) with times in UTC; a chart shows its own time zone (cx.TZ is added on the way in).
   Pure parts on window.MSDraw for the tests: COLS, toChart, toUTC. */
(function () {
  'use strict';
  const COLS = { draw: '--accent', up: '--buy', dn: '--sell', gold: '#d4a72c', ink: '--ink' };
  const KEY = (mk) => 'ms-dr-' + mk, MAGK = 'ms-dr-mag';
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  const toChart = (d, TZ) => { const o = { ...d }; for (const k of ['t1', 't2']) if (fin(o[k])) o[k] += TZ; return o; };
  const toUTC = (d, TZ) => { const o = { ...d }; for (const k of ['t1', 't2']) if (fin(o[k])) o[k] -= TZ; return o; };
  const api = { COLS, toChart, toUTC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window === 'undefined') return;
  window.MSDraw = api;

  const BT = () => window.BT;
  const CX = [];   // the registered charts
  const ST = {};   // market -> shapes (UTC times)
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const load = (mk) => { if (!ST[mk]) { let a = []; try { a = JSON.parse(ls.get(KEY(mk)) || '[]'); } catch (e) {} ST[mk] = BT() ? BT().drawNorm(a) : []; } return ST[mk]; };
  // undo / redo (27 Nov 2026): every save keeps the market's previous saved drawings; memory only, 100 steps, cleared on a reload
  const SAVED = {}, UNDO = [], REDO = [];
  const savedOf = (mk) => (mk in SAVED ? SAVED[mk] : (SAVED[mk] = ls.get(KEY(mk)) || '[]'));
  const save = (mk) => { const now = JSON.stringify(ST[mk] || []), prev = savedOf(mk); if (prev !== now) { UNDO.push([mk, prev]); if (UNDO.length > 100) UNDO.shift(); REDO.length = 0; } SAVED[mk] = now; ls.set(KEY(mk), now); if (typeof listDraw === 'function') try { listDraw(); } catch (e) {} };
  function back(from, to) { const it = from.pop(); if (!it) { note(from === UNDO ? 'Nothing to undo.' : 'Nothing to redo.'); return false; } const [mk, s] = it; to.push([mk, savedOf(mk)]);
    let a = []; try { a = JSON.parse(s); } catch (e) {} ST[mk] = BT() ? BT().drawNorm(a) : a; SAVED[mk] = s; ls.set(KEY(mk), s); SEL = null; HOV = null; GES = null; bar(); paintAll(); return true; }
  let HIDE = false;   // "Hide drawings" (27 Nov 2026): memory only, a new tool or a new drawing shows them again
  function setHide(on) { HIDE = !!on; if (HIDE) { SEL = null; HOV = null; } document.documentElement.toggleAttribute('data-dr-hidden', HIDE); const hb = document.querySelector('#ms-dr-bar [data-dh]'); if (hb) { hb.setAttribute('aria-pressed', String(HIDE)); hb.title = HIDE ? 'Show drawings (Alt+Shift+H)' : 'Hide all drawings (Alt+Shift+H)'; } bar(); paintAll(); note(HIDE ? 'Drawings hidden (Alt+Shift+H shows them).' : 'Drawings shown.'); }
  let SELC = null, TOOL = null, MAG = +(ls.get(MAGK) || 0) || 0, SEL = null, HOV = null, GES = null, DRAFT = null;   // SEL / HOV = { mk, i }
  // a see-through token (the soft look's rgba surfaces and lines) is flattened onto the page colour: a canvas needs a solid colour
  const auSolid = (function () { var R = /^rgba\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)[,\s\/]+([\d.]+)\s*\)$/; return function (v) { var m = R.exec(v || ''); if (!m || +m[4] >= 1 || +m[4] < 0.4) return v;   /* tints, grids and bands stay see-through */ var b = getComputedStyle(document.documentElement).getPropertyValue('--au-bg').trim(), h = /^#([0-9a-f]{6})$/i.exec(b), q = h ? [0, 2, 4].map(function (i) { return parseInt(h[1].substr(i, 2), 16); }) : (document.documentElement.getAttribute('data-theme') === 'light' ? [238, 240, 244] : [18, 19, 21]), a = +m[4]; return '#' + [1, 2, 3].map(function (i) { return ('0' + Math.round(+m[i] * a + q[i - 1] * (1 - a)).toString(16)).slice(-2); }).join(''); }; })();
  const css = (n) => auSolid(getComputedStyle(document.documentElement).getPropertyValue(n).trim());
  const colOf = (d) => { const c = COLS[d.col || 'draw']; return c.startsWith('--') ? css(c) || '#2962ff' : c; };
  const mkOf = (cx) => cx.market();
  const view = (cx) => { const B = cx.bars() || []; return { bars: B, n: B.length, sec: cx.sec() }; };
  // the chart library places whole indexes only (a fractional one comes back as 0): a time inside a candle, or on a chart of another
  // timeframe, is placed between its two neighbours
  const l2x = (cx, lg) => { const ts = cx.chart.timeScale(), k = Math.floor(lg), a = ts.logicalToCoordinate(k), b = ts.logicalToCoordinate(k + 1); return a == null || b == null ? null : a + (lg - k) * (b - a); };
  const x2l = (cx, x) => { const ts = cx.chart.timeScale(), k = ts.coordinateToLogical(x); if (k == null) return null; const a = ts.logicalToCoordinate(k), b = ts.logicalToCoordinate(k + 1); return a == null || b == null || b === a ? k : k + (x - a) / (b - a); };
  const X = (cx, t) => { const v = view(cx), lg = BT().tfLogical(v.bars, v.n, v.sec, t); return lg == null ? null : l2x(cx, lg); };
  const Y = (cx, p) => { try { return cx.series.priceToCoordinate(p); } catch (e) { return null; } };
  const T = (cx, x) => { const v = view(cx), lg = x2l(cx, x); return lg == null ? null : BT().tfTimeAt(v.bars, v.n, v.sec, lg); };
  const P = (cx, y) => { try { return cx.series.coordinateToPrice(y); } catch (e) { return null; } };
  const size = (cx) => { const ts = cx.chart.timeScale(); let th = 26; try { th = ts.height(); } catch (e) {} return { W: ts.width(), H: Math.max(0, cx.el.clientHeight - th) }; };
  const geo = (cx, d) => { const { W, H } = size(cx); return BT().drawGeom(toChart(d, cx.TZ), (t) => X(cx, t), (p) => Y(cx, p), W, H); };
  const barAt = (cx, t) => { const v = view(cx); return BT().closedBarAt(v.bars, v.n, v.sec, t, Infinity); };
  const snap = (cx, t, p) => BT().drawSnap(barAt(cx, t), p, (q) => Y(cx, q), MAG);
  const pt = (cx, ev) => { const r = cx.el.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, t = T(cx, x), p0 = P(cx, y); return { x, y, t, p: t != null && p0 != null ? snap(cx, t, p0) : p0 }; };

  // ---- drawing ----
  function canvasOf(cx) { if (cx.cv && cx.cv.isConnected) return cx.cv; const c = document.createElement('canvas'); c.className = 'ms-dr-cv'; c.setAttribute('aria-hidden', 'true'); cx.el.appendChild(c); cx.cv = c; return c; }
  function paint(cx) { if (!BT() || !cx.el.isConnected) return; const c = canvasOf(cx), dpr = devicePixelRatio || 1, w = cx.el.clientWidth, h = cx.el.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px'; }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h); if (!cx.visible()) return;
    const mk = mkOf(cx), L = load(mk), { W, H } = size(cx); x.save(); x.beginPath(); x.rect(0, 0, W, H); x.clip();
    const list = HIDE ? [] : L.map((d, i) => [d, i]); if (DRAFT && DRAFT.mk === mk) list.push([DRAFT.d, -1]);
    for (const [d, i] of list) { const g = geo(cx, d); if (!g) continue; const sel = SEL && SEL.mk === mk && SEL.i === i, hov = HOV && HOV.mk === mk && HOV.i === i, col = colOf(d);
      x.strokeStyle = col; x.lineWidth = (d.w || 1) + (hov && !sel ? 0.5 : 0); x.setLineDash(d.ls === 'dash' ? [6, 4] : []);
      if (g.type === 'c') { const ex = g.xe != null ? g.xe : g.x2, ey = g.ye != null ? g.ye : g.y2, eyo = g.yeo != null ? g.yeo : g.y2o;
        x.fillStyle = col + '18'; x.beginPath(); x.moveTo(g.x1, g.y1); x.lineTo(ex, ey); x.lineTo(ex, eyo); x.lineTo(g.x1, g.y1o); x.closePath(); x.fill();
        x.beginPath(); x.moveTo(g.x1, g.y1); x.lineTo(ex, ey); x.moveTo(g.x1, g.y1o); x.lineTo(ex, eyo); x.stroke();
        x.setLineDash([4, 4]); x.lineWidth = 1; x.beginPath(); x.moveTo(g.x1, (g.y1 + g.y1o) / 2); x.lineTo(ex, (ey + eyo) / 2); x.stroke(); }
      else if (g.type === 'm') { const rx = Math.min(g.x1, g.x2), ry = Math.min(g.y1, g.y2), rw = Math.abs(g.x2 - g.x1), rh = Math.abs(g.y2 - g.y1), up = d.p2 >= d.p1, mc = css(up ? '--buy' : '--sell') || col;
        x.fillStyle = mc + '22'; x.fillRect(rx, ry, rw, rh); x.strokeStyle = mc; x.lineWidth = 1; x.beginPath(); x.moveTo(g.x2, g.y1); x.lineTo(g.x2, g.y2); x.moveTo(g.x1, g.y2); x.lineTo(g.x2, g.y2); x.stroke();
        const v = view(cx), dd = toChart(d, cx.TZ), nb = BT().barsBetween(v.bars, v.n, v.sec, dd.t1, dd.t2), span = Math.abs(d.t2 - d.t1), dur = span >= 86400 ? `${(span / 86400).toFixed(1)} d` : span >= 3600 ? `${Math.floor(span / 3600)} h ${Math.round(span % 3600 / 60)} m` : `${Math.round(span / 60)} m`;
        const s = `${BT().drawInfo(d, nb, null, cx.dec())} · ${dur}`; x.font = '600 12px Figtree, system-ui, sans-serif'; const tw = x.measureText(s).width + 10, lx = rx + rw / 2 - tw / 2, ly = up ? ry - 6 : ry + rh + 20;
        x.fillStyle = mc; x.fillRect(lx, ly - 14, tw, 18); x.fillStyle = '#fff'; x.fillText(s, lx + 5, ly); }
      else if (g.type === 'w') { const B = cx.bars() || [], t0 = d.t1 + cx.TZ; let i0 = B.findIndex((b) => b.time >= t0); if (i0 >= 0) { let pv = 0, vv = 0, last = null; x.beginPath();
          for (let i = i0; i < B.length; i++) { const b = B[i], w2 = b.volume > 0 ? b.volume : 1; pv += (b.high + b.low + b.close) / 3 * w2; vv += w2; const xx = l2x(cx, i), yy = Y(cx, pv / vv); if (xx == null || yy == null) continue; if (last) x.lineTo(xx, yy); else x.moveTo(xx, yy); last = [xx, yy, pv / vv]; }
          x.lineWidth = (d.w || 1) + 0.5; x.stroke(); if (last) { x.font = '600 12px Figtree, system-ui, sans-serif'; x.fillStyle = col; x.fillText(`AVWAP ${cx.fmt(last[2])}`, Math.min(last[0] + 6, W - 110), last[1] - 6); } }
        x.beginPath(); x.arc(g.x1, g.y1, 3, 0, Math.PI * 2); x.fillStyle = col; x.fill(); }
      else if (g.type === 'p') { const mm = BT().measuredMove(d), xc = X(cx, mm.t + cx.TZ), y1c = Y(cx, mm.one), y2c = Y(cx, mm.ext); x.beginPath(); x.moveTo(g.x1, g.y1); x.lineTo(g.x2, g.y2); x.stroke();
        if (xc != null && y1c != null) { x.setLineDash([5, 4]); x.beginPath(); x.moveTo(g.x2, g.y2); x.lineTo(xc, y1c); x.stroke(); x.setLineDash([]); x.font = '600 12px Figtree, system-ui, sans-serif';
          for (const [yy, pr, nm] of [[y1c, mm.one, '1:1'], [y2c, mm.ext, '1.618']]) { if (yy == null) continue; x.lineWidth = 1; x.beginPath(); x.moveTo(xc - 30, yy); x.lineTo(xc + 30, yy); x.stroke(); x.fillStyle = col; x.fillText(`${nm} ${cx.fmt(pr)}`, xc + 34, yy + 4); } } }
      else if (g.type === 'b') { x.fillStyle = col + '18'; x.fillRect(0, Math.min(g.yt, g.yb), W, Math.abs(g.yb - g.yt)); x.beginPath(); x.moveTo(0, g.y1); x.lineTo(W, g.y1); x.stroke();
        x.setLineDash([4, 4]); x.lineWidth = 1; x.beginPath(); x.moveTo(0, g.yt); x.lineTo(W, g.yt); x.moveTo(0, g.yb); x.lineTo(W, g.yb); x.stroke(); x.setLineDash([]);
        x.font = '600 12px Figtree, system-ui, sans-serif'; x.fillStyle = col; x.fillText(`+1 ATR ${cx.fmt(d.price + d.hw)}`, 8, g.yt - 4); x.fillText(`−1 ATR ${cx.fmt(d.price - d.hw)}`, 8, g.yb + 14); x.fillText(`ATR ${cx.fmt(d.hw)}`, 8, g.y1 - 4); }
      else if (g.type === 'x') { x.setLineDash([]); x.font = `600 ${g.fs}px Figtree, system-ui, sans-serif`; x.fillStyle = col; x.textBaseline = 'alphabetic'; x.fillText(d.text, g.x1 + 4, g.y1 - 5);
        if (sel || hov) { x.lineWidth = 1; x.strokeRect(g.x1 + 0.5, g.y2 + 0.5, g.x2 - g.x1, g.y1 - g.y2); } }
      else if (g.type === 'f') { const lw = x.lineWidth; x.font = '600 12px Figtree, system-ui, sans-serif';
        for (let k = 0; k + 1 < g.lv.length; k++) { x.globalAlpha = k % 2 ? 0.07 : 0.12; x.fillStyle = col; x.fillRect(g.fx1, Math.min(g.lv[k][1], g.lv[k + 1][1]), g.fx2 - g.fx1, Math.abs(g.lv[k + 1][1] - g.lv[k][1])); }
        x.globalAlpha = 1; for (const [r, yy] of g.lv) { x.lineWidth = lw; x.beginPath(); x.moveTo(g.fx1, yy); x.lineTo(g.fx2, yy); x.stroke();
          const pr = d.p2 + (d.p1 - d.p2) * r, lab = `${r === 0 || r === 1 ? r : r.toFixed(3).replace(/0+$/, '')} (${cx.fmt(pr)})`; x.fillStyle = col; x.fillText(lab, g.fx1 + 4, yy - 4); }
        x.setLineDash([4, 4]); x.lineWidth = 1; x.beginPath(); x.moveTo(g.x1, g.y1); x.lineTo(g.x2, g.y2); x.stroke(); }
      else if (g.type === 'a') { x.beginPath(); x.moveTo(g.x1, g.y1); x.lineTo(g.x2, g.y2); x.stroke(); const an = Math.atan2(g.y2 - g.y1, g.x2 - g.x1), hl = 10 + (d.w || 1) * 2;
        x.setLineDash([]); x.beginPath(); x.moveTo(g.x2, g.y2); x.lineTo(g.x2 - hl * Math.cos(an - 0.45), g.y2 - hl * Math.sin(an - 0.45)); x.lineTo(g.x2 - hl * Math.cos(an + 0.45), g.y2 - hl * Math.sin(an + 0.45)); x.closePath(); x.fillStyle = col; x.fill(); }
      else if (g.type === 'r') { x.fillStyle = col + '22'; const rx = Math.min(g.x1, g.x2), ry = Math.min(g.y1, g.y2), rw = Math.abs(g.x2 - g.x1), rh = Math.abs(g.y2 - g.y1); x.fillRect(rx, ry, rw, rh); x.strokeRect(rx, ry, rw, rh); }
      else { x.beginPath(); x.moveTo(g.x1, g.y1); x.lineTo(g.xe != null ? g.xe : g.x2, g.ye != null ? g.ye : g.y2); x.stroke(); }
      x.setLineDash([]);
      if (d.type === 'h' || d.type === 'hr') { const lab = cx.fmt(d.type === 'h' ? d.price : d.p1); x.font = '600 12px Figtree, system-ui, sans-serif'; const tw = x.measureText(lab).width + 10; x.fillStyle = col; x.fillRect(W - tw - 2, g.y1 - 9, tw, 18); x.fillStyle = '#fff'; x.fillText(lab, W - tw + 3, g.y1 + 4); }
      if (d.alert && (d.type === 'h' || d.type === 'hr' || d.type === 't')) { x.font = '600 12px Figtree, system-ui, sans-serif'; const s = 'Alert', aw = x.measureText(s).width + 10, pw = d.type === 't' ? 0 : x.measureText(cx.fmt(d.type === 'h' ? d.price : d.p1)).width + 10;
        const ax = d.type === 't' ? Math.min(W - aw - 2, Math.max(g.x1, g.x2) + 6) : W - pw - aw - 6, ay = d.type === 't' ? (g.x2 >= g.x1 ? g.y2 : g.y1) : g.y1;
        x.fillStyle = css('--panel') || '#fff'; x.fillRect(ax, ay - 9, aw, 18); x.strokeStyle = col; x.lineWidth = 1; x.strokeRect(ax + 0.5, ay - 8.5, aw - 1, 17); x.fillStyle = col; x.textBaseline = 'middle'; x.fillText(s, ax + 5, ay); x.textBaseline = 'alphabetic'; }
      if (d.lbl && (d.type === 't' || d.type === 'r')) { const v = view(cx), dd = toChart(d, cx.TZ), nb = BT().barsBetween(v.bars, v.n, v.sec, dd.t1, dd.t2), ang = d.type === 't' ? Math.atan2(-(g.y2 - g.y1), g.x2 - g.x1) * 180 / Math.PI : null, s = BT().drawInfo(d, nb, ang, cx.dec());
        x.font = '600 12px Figtree, system-ui, sans-serif'; const tw = x.measureText(s).width + 10, lx = Math.max(g.x1, g.x2) + 6, ly = Math.min(g.y1, g.y2) - 6; x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(lx, ly - 14, tw, 18); x.fillStyle = '#fff'; x.fillText(s, lx + 5, ly); }
      if (sel || hov) for (const [, px, py] of g.pts) { x.beginPath(); x.arc(px, py, sel ? 5 : 4, 0, Math.PI * 2); x.fillStyle = sel ? col : css('--panel') || '#fff'; x.fill(); x.strokeStyle = col; x.lineWidth = 1.5; x.stroke(); }
      if (d.lock && sel) { x.font = '12px system-ui'; x.fillStyle = col; x.fillText('🔒', g.x1 + 6, g.y1 - 6); } }
    if (TOOL && cx.ring) { x.beginPath(); x.arc(cx.ring.x, cx.ring.y, 4, 0, Math.PI * 2); x.strokeStyle = css('--accent') || '#2962ff'; x.lineWidth = 1.5; x.stroke(); }
    x.restore(); }
  const paintAll = () => CX.forEach(paint);
  // repaint when a chart's scales move (scroll, zoom, a new candle that rescales, a resize): a cheap key per chart each frame
  (function watch() { for (const cx of CX) { if (!cx.visible()) { cx.k = ''; continue; } let k = ''; try { const r = cx.chart.timeScale().getVisibleLogicalRange(), B = cx.bars() || [], ref = B.length ? B[B.length - 1].close : 0;
        k = [r && r.from.toFixed(3), r && r.to.toFixed(3), Y(cx, ref), Y(cx, ref * 1.01), cx.el.clientWidth, cx.el.clientHeight, B.length].join('|'); } catch (e) {}
      if (k !== cx.k) { cx.k = k; paint(cx); } } requestAnimationFrame(watch); })();

  // ---- what is under the pointer ----
  function hitAt(cx, xp, yp) { const mk = mkOf(cx), L = load(mk), touch = matchMedia('(pointer: coarse)').matches, hT = touch ? 22 : 7, tol = touch ? 12 : 6;
    if (HIDE) return null; const order = L.map((d, i) => i).reverse(); if (SEL && SEL.mk === mk) order.unshift(SEL.i);
    for (const i of order) { const d = L[i]; if (!d) continue; const part = BT().drawHit(geo(cx, d), xp, yp, tol, hT); if (part) return { mk, i, part }; } return null; }

  // ---- gestures ----
  function place(cx, a) { const mk = mkOf(cx); if (TOOL === 'h') return commit(mk, { type: 'h', price: a.p });
    if (TOOL === 'hr') return commit(mk, { type: 'hr', t1: a.t - cx.TZ, p1: a.p }); if (TOOL === 'v') return commit(mk, { type: 'v', t1: a.t - cx.TZ });
    if (TOOL === 'w') return commit(mk, { type: 'w', t1: a.t - cx.TZ, p1: a.p });
    if (TOOL === 'b') { const hw = atrOf(cx); if (!(hw > 0)) { note('Not enough candles for an ATR yet.'); return; } return commit(mk, { type: 'b', price: a.p, hw }); }
    if (TOOL === 'x') { const t1 = a.t - cx.TZ, p1 = a.p; setTool(null); askText('').then((s) => { if (s) commit(mk, { type: 'x', t1, p1, text: s }); }); return; }
    DRAFT = { mk, d: { type: TOOL, t1: a.t - cx.TZ, p1: a.p, t2: a.t - cx.TZ, p2: a.p }, cx }; }
  // ATR(14) of the chart's closed candles (Wilder): the ATR band's half width, and the parallel channel's first width
  function atrOf(cx) { const B = cx.bars() || [], n = 14; if (B.length < n + 2) return null; let a = null;
    for (let i = 1; i < B.length - 1; i++) { const b = B[i], tr = Math.max(b.high - b.low, Math.abs(b.high - B[i - 1].close), Math.abs(b.low - B[i - 1].close)); a = a == null ? tr : i <= n ? a + (tr - a) / i : (a * (n - 1) + tr) / n; } return a; }
  async function askText(v) { const s = window.msAsk ? await window.msAsk('Text on the chart', v, { title: v ? 'Edit text' : 'Add text', ok: v ? 'Save' : 'Add', max: 120 }) : prompt('Text on the chart', v);
    return s == null ? null : BT().drawNorm([{ type: 'x', t1: 0, p1: 0, text: s }]).map((o) => o.text)[0] || null; }
  function commit(mk, d) { if (d.type === 'c' && !d.off) { const cx = LASTCX, w2 = cx && atrOf(cx); d.off = w2 > 0 ? -2 * w2 : -(Math.abs(d.p2 - d.p1) || 1) / 2; }
    const L = load(mk), at = Math.floor(Date.now() / 1000); L.push(Object.assign(d, { at })); save(mk); SEL = { mk, i: L.length - 1 }; SELC = LASTCX; DRAFT = null; setTool(null); paintAll(); bar(); }
  function lock(cx, on) { try { cx.chart.applyOptions({ handleScroll: !on, handleScale: !on }); } catch (e) {} }
  let LASTCX = null;
  function down(cx, ev) { LASTCX = cx; if (!BT() || ev.button === 2 || ev.shiftKey || !cx.visible()) return; const a = pt(cx, ev); if (a.t == null || a.p == null) return;
    if (TOOL) { ev.preventDefault(); ev.stopPropagation(); if (DRAFT && DRAFT.cx === cx) { DRAFT.d.t2 = a.t - cx.TZ; DRAFT.d.p2 = a.p; return commit(DRAFT.mk, DRAFT.d); }
      place(cx, a); if (DRAFT) { GES = { cx, kind: 'draft', x0: a.x, y0: a.y }; lock(cx, true); } return; }
    const h = hitAt(cx, a.x, a.y); if (!h) { if (SEL) { SEL = null; bar(); paintAll(); } return; }
    ev.preventDefault(); ev.stopPropagation(); SEL = { mk: h.mk, i: h.i }; SELC = cx; bar(); const d = load(h.mk)[h.i];
    if (!d.lock) { GES = { cx, kind: h.part === 'body' ? 'move' : 'size', part: h.part, d0: { ...d }, a }; lock(cx, true); } paintAll(); }
  function move(cx, ev) { if (!BT()) return;
    // a mouse that comes back with no button down let go somewhere else (outside the window: no pointerup reaches the page)
    if (GES && ev.pointerType === 'mouse' && ev.buttons === 0) up(GES.cx);
    const a = pt(cx, ev);
    if (TOOL) { cx.ring = a.t != null && a.p != null ? { x: X(cx, a.t), y: Y(cx, a.p) } : null; if (DRAFT && DRAFT.cx === cx && a.t != null) { DRAFT.d.t2 = a.t - cx.TZ; DRAFT.d.p2 = a.p; } paint(cx); return; }
    if (GES && GES.cx === cx) { ev.preventDefault(); const L = load(mkOf(cx)), i = SEL && SEL.i; if (i == null || !L[i] || a.t == null) return;
      if (GES.kind === 'size') L[i] = BT().drawResize(GES.d0, GES.part, a.t - cx.TZ, a.p);
      else { const dx = a.x - GES.a.x, dy = a.y - GES.a.y, d0 = toChart(GES.d0, cx.TZ);
        const fT = (t) => { const xx = X(cx, t); const r = xx == null ? null : T(cx, xx + dx); return r == null ? t : r; }, fP = (p) => { const yy = Y(cx, p), r = yy == null ? null : P(cx, yy + dy); return r == null ? p : r; };
        let m = BT().drawMove(d0, fT, fP); if (MAG && fin(m.t1)) { const k = fin(m.p1) ? 'p1' : 'price', sp = fin(m[k]) ? snap(cx, m.t1, m[k]) : null; if (sp != null && fin(m[k])) { const dp = sp - m[k]; for (const kk of ['p1', 'p2', 'price']) if (fin(m[kk])) m[kk] += dp; } }
        L[i] = toUTC(m, cx.TZ); }
      L[i].editedAt = Math.floor(Date.now() / 1000); paintAll(); return; }
    const h = hitAt(cx, a.x, a.y), was = HOV ? HOV.mk + ':' + HOV.i : ''; HOV = h ? { mk: h.mk, i: h.i } : null; cx.el.dataset.dcur = h ? (load(h.mk)[h.i].lock ? 'lock' : h.part === 'body' ? 'move' : 'size') : '';
    if ((HOV ? HOV.mk + ':' + HOV.i : '') !== was) paintAll(); }
  function up(cx) { if (!GES || GES.cx !== cx) return; const g = GES; GES = null; lock(cx, false);
    if (g.kind === 'draft') { const d = DRAFT && DRAFT.d; if (d && (Math.abs(X(cx, d.t2 + cx.TZ) - g.x0) > 6 || Math.abs(Y(cx, d.p2) - g.y0) > 6)) commit(DRAFT.mk, d); return; }   // press and drag = done; a click waits for the second click
    save(mkOf(cx)); bar(); }

  // ---- the strip of tools (in the charts toolbar) and the style bar ----
  const ICON = { '': '<path d="M6 3l12 9-5.5 1.2L10 19z"/>', t: '<path d="M4.5 18.5L19.5 5.5"/><circle cx="4.5" cy="18.5" r="1.6"/><circle cx="19.5" cy="5.5" r="1.6"/>', h: '<path d="M3 12h18"/>', hr: '<path d="M6 12h15"/><circle cx="5" cy="12" r="1.8"/>', v: '<path d="M12 3v18"/>', r: '<rect x="4" y="6" width="16" height="12" rx="1"/>', mag: '<path d="M6 4v7a6 6 0 0 0 12 0V4"/><path d="M6 8h3M15 8h3"/>',
    f: '<path d="M3 5h18M3 10h18M3 14h18M3 19h18"/><path d="M5 19L19 5" stroke-dasharray="2 2"/>', a: '<path d="M5 19L18 6"/><path d="M11 6h7v7"/>', x: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    c: '<path d="M3 15L15 5M9 19L21 9"/>', m: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M12 8v8M9 13l3 3 3-3"/>', w: '<path d="M4 18c4-1 5-8 9-9s5 3 7 1"/><circle cx="4" cy="18" r="1.8"/>',
    p: '<path d="M4 18L11 9M11 9l7 4" /><path d="M14 5h6M14 9h6" stroke-dasharray="2 2"/>', b: '<path d="M3 12h18"/><path d="M3 7h18M3 17h18" stroke-dasharray="3 3"/>' };
  const NAME = { '': 'Cursor (Esc)', t: 'Trend line (Alt+T)', h: 'Horizontal line (Alt+H)', hr: 'Horizontal ray (Alt+J)', v: 'Vertical line (Alt+V)', r: 'Box (Alt+R)', f: 'Fibonacci retracement (Alt+F)', a: 'Arrow (Alt+A)', x: 'Text (Alt+X)', c: 'Parallel channel (Alt+C)', m: 'Price and date range (Alt+G)', w: 'Anchored VWAP (Alt+W)', p: 'Measured move: 1:1 and 1.618 targets (Alt+P)', b: 'ATR band: the typical move around a price (Alt+B)' };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  function strip() { const host = document.getElementById('ms-dr-bar'); if (!host || host.dataset.done) return; host.dataset.done = '1';
    host.innerHTML = Object.keys(NAME).map((k) => `<button type="button" data-dt="${k}" aria-pressed="${k === ''}" title="${NAME[k]}" aria-label="${NAME[k].replace(/ \(.*/, '')}">${svg(k)}</button>`).join('') + `<button type="button" class="dr-mag" data-mag aria-pressed="false" title="Magnet: off (Alt+M)" aria-label="Magnet">${svg('mag')}<small></small></button>`
      + `<button type="button" data-dl title="Drawings list (Alt+L)" aria-label="Drawings list"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg></button>`
      + `<button type="button" data-dh aria-pressed="false" title="Hide all drawings (Alt+Shift+H)" aria-label="Hide all drawings"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="dh-x" d="M4 4l16 16"/></svg></button>`;
    host.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-mag')) { setMag((MAG + 1) % 3); return; } if (b.hasAttribute('data-dl')) { if (LIST && !LIST.hidden) LIST.hidden = true; else openList(); return; } if (b.hasAttribute('data-dh')) { setHide(!HIDE); return; } const t = b.dataset.dt; setTool(t && TOOL !== t ? t : null); });
    setMag(MAG); setTool(null); }
  function setTool(t) { if (t && HIDE) setHide(false); TOOL = t || null; DRAFT = null; if (TOOL) SEL = null; document.documentElement.toggleAttribute('data-drawing', !!TOOL);
    document.querySelectorAll('#ms-dr-bar [data-dt]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.dt || null) === TOOL)));
    CX.forEach((cx) => { cx.ring = null; }); bar(); paintAll(); }
  function setMag(m) { MAG = m; ls.set(MAGK, String(m)); const b = document.querySelector('#ms-dr-bar [data-mag]'); if (!b) return; const w = ['off', 'weak', 'strong'][m];
    b.setAttribute('aria-pressed', String(m > 0)); b.title = `Magnet: ${w} (Alt+M)`; b.querySelector('small').textContent = m ? (m === 1 ? 'W' : 'S') : ''; }
  // where a floating part goes: inside the full-screen element while there is one (it hides everything outside it). The style bar
  // and the menu are MADE on first use, so made in full screen they went to <body> and were never seen (20 Nov 2026).
  // The page's own full screen (a phone without element full screen: #v-charts.ch-fake-fs, fixed over the page) counts too.
  const fsHost = () => document.fullscreenElement || document.querySelector('#v-charts.ch-fake-fs') || document.body;
  window.msFsHost = fsHost;
  const CHIP = ['draw', 'up', 'dn', 'gold', 'ink'];
  function bar() { let el = document.getElementById('ms-dsel'); if (!SEL) { if (el) el.hidden = true; return; } const L = load(SEL.mk), d = L[SEL.i]; if (!d) { SEL = null; if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'ms-dsel'; el.className = 'ms-dsel'; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Selected drawing'); fsHost().appendChild(el); el.addEventListener('click', selAct); el.addEventListener('pointerdown', (e) => e.stopPropagation()); }
    const on = (b) => (b ? ' aria-pressed="true"' : ' aria-pressed="false"');
    el.innerHTML = CHIP.map((c) => `<button type="button" class="dc" data-col="${c}" title="Colour"${on((d.col || 'draw') === c)} style="--c:${COLS[c].startsWith('--') ? `var(${COLS[c]})` : COLS[c]}"><i></i></button>`).join('')
      + `<span class="sep"></span>` + [1, 2, 3].map((w) => d.type === 'x' ? `<button type="button" data-w="${w}" title="Text size"${on((d.w || 1) === w)}>${['S', 'M', 'L'][w - 1]}</button>` : `<button type="button" data-w="${w}" title="Width ${w}"${on((d.w || 1) === w)}>${w}px</button>`).join('')
      + `<button type="button" data-ls title="Dashed"${on(d.ls === 'dash')}>- -</button>` + (['t', 'f', 'c'].includes(d.type) ? `<button type="button" data-ext title="Extend to the right"${on(d.ext)}>→</button>` : '')
      + (d.type === 'x' ? `<button type="button" data-txt title="Change the words">Edit text</button>` : '')
      + (d.type === 't' || d.type === 'r' ? `<button type="button" data-lbl title="Label: price change, %, bars"${on(d.lbl)}>Label</button>` : '')
      + (['h', 'hr', 't'].includes(d.type) ? `<span class="sep"></span><button type="button" data-alert title="Tell me when price crosses this line (while this page is open)"${on(d.alert)}>${d.alert ? 'Alert on' : 'Alert'}</button>` : '')
      + `<span class="sep"></span><button type="button" data-lock title="${d.lock ? 'Unlock' : 'Lock'}"${on(d.lock)}>${d.lock ? 'Locked' : 'Lock'}</button><button type="button" data-clone title="Clone">Clone</button><button type="button" data-del title="Delete (Del)" class="del">Delete</button>`;
    el.hidden = false; const cx = SELC && SELC.visible() && mkOf(SELC) === SEL.mk ? SELC : CX.find((c) => c.visible() && mkOf(c) === SEL.mk), g = cx && geo(cx, d), r = cx && cx.el.getBoundingClientRect();
    const bw = el.offsetWidth || 360; let lx = r ? r.left + (g ? Math.min(g.x1, g.x2 != null ? g.x2 : g.x1) : 8) : 16, ty = r ? r.top + (g ? Math.min(g.y1, g.y2 != null ? g.y2 : g.y1) : 8) - Math.max(48, (el.offsetHeight || 40) + 8) : 80;
    lx = Math.max(8, Math.min(innerWidth - bw - 8, lx)); ty = Math.max(8, ty); el.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ty)}px)`; }
  function selAct(e) { const b = e.target.closest('button'); if (!b || !SEL) return; const mk = SEL.mk, L = load(mk), d = L[SEL.i]; if (!d) return;
    if (b.dataset.col) { if (b.dataset.col === 'draw') delete d.col; else d.col = b.dataset.col; }
    else if (b.dataset.w) { if (+b.dataset.w === 1) delete d.w; else d.w = +b.dataset.w; }
    else if (b.hasAttribute('data-ls')) { if (d.ls) delete d.ls; else d.ls = 'dash'; }
    else if (b.hasAttribute('data-ext')) { if (d.ext) delete d.ext; else d.ext = true; }
    else if (b.hasAttribute('data-lbl')) { if (d.lbl) delete d.lbl; else d.lbl = true; }
    else if (b.hasAttribute('data-lock')) { if (d.lock) delete d.lock; else d.lock = true; }
    else if (b.hasAttribute('data-alert')) { if (d.alert) { delete d.alert; note('Alert off.'); } else { d.alert = true; delete d.fired; note('Alert on: you are told when price crosses this line while this page is open.'); try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch (x) {} } }
    else if (b.hasAttribute('data-clone')) { const c = { ...d }; delete c.lock; for (const k of ['p1', 'p2', 'price']) if (fin(c[k])) c[k] *= 1.002; c.at = Math.floor(Date.now() / 1000); L.push(c); SEL = { mk, i: L.length - 1 }; }
    else if (b.hasAttribute('data-del')) { remove(mk, SEL.i); return; }
    else if (b.hasAttribute('data-txt')) { const i = SEL.i; askText(d.text).then((s) => { if (s && L[i] === d) { d.text = s; d.editedAt = Math.floor(Date.now() / 1000); save(mk); bar(); paintAll(); } }); return; }
    save(mk); bar(); paintAll(); }
  function remove(mk, i) { const L = load(mk), d = L[i]; if (!d) return false; if (d.lock) { note('Locked: unlock it first.'); return false; } L.splice(i, 1); save(mk); SEL = null; HOV = null; bar(); paintAll(); return true; }
  const note = (s) => { if (window.msToast) try { window.msToast(s); return; } catch (e) {} const n = document.getElementById('ms-dr-note'); if (n) { n.textContent = s; clearTimeout(n._t); n._t = setTimeout(() => { n.textContent = ''; }, 2500); } };

  // ---- right-click menu ----
  function menu(cx, ev) { if (!BT()) return; ev.preventDefault(); if (TOOL) { setTool(null); return; } const r = cx.el.getBoundingClientRect(), xp = ev.clientX - r.left, yp = ev.clientY - r.top, h = hitAt(cx, xp, yp), mk = mkOf(cx), L = load(mk);
    if (h) { SEL = { mk: h.mk, i: h.i }; SELC = cx; bar(); paintAll(); }
    let m = document.getElementById('ms-cmenu'); if (!m) { m = document.createElement('div'); m.id = 'ms-cmenu'; m.className = 'ms-cmenu'; m.setAttribute('role', 'menu'); fsHost().appendChild(m); document.addEventListener('pointerdown', (e) => { if (!m.contains(e.target)) m.hidden = true; }, true); document.addEventListener('keydown', (e) => { if (e.key === 'Escape') m.hidden = true; }); }
    const last = [...L.keys()].reverse().find((i) => !L[i].lock);
    m.innerHTML = `<button type="button" role="menuitem" data-m="reset">Reset chart view</button>` + (h ? `<button type="button" role="menuitem" data-m="del">Delete this drawing</button>` : '')
      + `<button type="button" role="menuitem" data-m="last"${last == null ? ' disabled' : ''}>Remove the last drawing</button><button type="button" role="menuitem" data-m="all"${L.length ? '' : ' disabled'}>Delete all drawings</button>`
      + `<button type="button" role="menuitem" data-m="hide">${HIDE ? 'Show drawings' : 'Hide drawings'} <kbd>Alt+Shift+H</kbd></button><button type="button" role="menuitem" data-m="list">Drawings list <kbd>Alt+L</kbd></button><button type="button" role="menuitem" data-m="undo"${UNDO.length ? '' : ' disabled'}>Undo <kbd>Ctrl+Z</kbd></button><button type="button" role="menuitem" data-m="redo"${REDO.length ? '' : ' disabled'}>Redo <kbd>Ctrl+Y</kbd></button>`
      + (() => { let p = null; try { p = cx.series.coordinateToPrice(yp); } catch (x) {} if (!(p > 0)) return ''; menu.lv = p; const t = cx.fmt ? cx.fmt(p) : p.toFixed(2);   // a level from the menu (27 Nov 2026)
        return `<hr class="cm-sep"><button type="button" role="menuitem" data-m="hl">Horizontal line at ${t}</button><button type="button" role="menuitem" data-m="al">Alert at ${t}</button>`; })()
      + (() => { let p = null; try { p = cx.series.coordinateToPrice(yp); } catch (x) {} if (!(p > 0) || !window.msPaperDraftAt || !window.msPaperMarket || window.msPaperMarket() !== mk) return '';   // paper orders from the chart (19 Nov 2026)
        menu.px = p; const t = cx.fmt ? cx.fmt(p) : p.toFixed(2); return `<hr class="cm-sep"><button type="button" role="menuitem" data-m="pbuy">Paper buy at ${t}</button><button type="button" role="menuitem" data-m="psell">Paper sell at ${t}</button>`; })();
    m.hidden = false; const bw = m.offsetWidth || 220, bh = m.offsetHeight || 160; m.style.transform = `translate(${Math.min(ev.clientX, innerWidth - bw - 8)}px, ${Math.min(ev.clientY, innerHeight - bh - 8)}px)`;
    m.onclick = async (e) => { const b = e.target.closest('button[data-m]'); if (!b) return; m.hidden = true; const k = b.dataset.m;
      if (k === 'reset') { try { cx.chart.priceScale('right').applyOptions({ autoScale: true }); cx.chart.timeScale().resetTimeScale(); cx.chart.timeScale().scrollToRealTime(); } catch (x) {} }
      if (k === 'del' && h) remove(h.mk, h.i);
      if ((k === 'pbuy' || k === 'psell') && window.msPaperDraftAt) window.msPaperDraftAt(k === 'pbuy' ? 'buy' : 'sell', menu.px);
      if (k === 'last' && last != null) remove(mk, last);
      if ((k === 'hl' || k === 'al') && menu.lv > 0) { LASTCX = cx; const d = { type: 'h', price: menu.lv }; if (k === 'al') d.alert = true; commit(mk, d);
        if (k === 'al') { note('Alert on: you are told when price crosses this line while this page is open.'); try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} } }
      if (k === 'list') openList(cx); if (k === 'hide') setHide(!HIDE);
      if (k === 'undo') back(UNDO, REDO); if (k === 'redo') back(REDO, UNDO);
      if (k === 'all') { const ok = window.msConfirm ? await window.msConfirm(`Delete all ${L.filter((d) => !d.lock).length} drawings on this market? Locked ones stay.`, { title: 'Delete all drawings', ok: 'Delete all', danger: true }) : confirm('Delete all drawings?');
        if (ok) { ST[mk] = L.filter((d) => d.lock); save(mk); SEL = null; bar(); paintAll(); } } };
    m.querySelector('button:not([disabled])').focus({ preventScroll: true }); }

  // ---- keys ----
  document.addEventListener('keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') || document.querySelector('dialog[open]') || !CX.some((c) => c.visible())) return;
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyH') { e.preventDefault(); setHide(!HIDE); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey) { const t = { KeyT: 't', KeyH: 'h', KeyJ: 'hr', KeyV: 'v', KeyR: 'r', KeyF: 'f', KeyA: 'a', KeyX: 'x', KeyC: 'c', KeyG: 'm', KeyW: 'w', KeyP: 'p', KeyB: 'b' }[e.code]; if (t) { e.preventDefault(); setTool(TOOL === t ? null : t); return; } if (e.code === 'KeyM') { e.preventDefault(); setMag((MAG + 1) % 3); return; } if (e.code === 'KeyL') { e.preventDefault(); if (LIST && !LIST.hidden) LIST.hidden = true; else openList(); return; } }
    if (e.key === 'Escape' && (TOOL || SEL || GES)) { if (GES) { if (SEL && GES.d0) load(SEL.mk)[SEL.i] = GES.d0; GES.cx && lock(GES.cx, false); GES = null; } setTool(null); SEL = null; bar(); paintAll(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && SEL && !e.ctrlKey && !e.metaKey) { e.preventDefault(); remove(SEL.mk, SEL.i); }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'KeyZ' || e.code === 'KeyY')) { e.preventDefault(); back(e.code === 'KeyY' || e.shiftKey ? REDO : UNDO, e.code === 'KeyY' || e.shiftKey ? UNDO : REDO); } });
  // ---- the drawings list (27 Nov 2026): every drawing of the market on the chart, newest first; a row selects it and brings it into
  // view, with lock and delete. Opened from the right-click menu or Alt+L. Nothing new is stored.
  const NAMES = { h: 'Horizontal line', hr: 'Horizontal ray', v: 'Vertical line', t: 'Trend line', r: 'Box', f: 'Fibonacci', a: 'Arrow', x: 'Text', c: 'Channel', m: 'Price range', w: 'Anchored VWAP', p: 'Measured move', b: 'ATR band' };
  let LIST = null, LISTCX = null;
  const fmtP = (cx, p) => (p > 0 ? (cx && cx.fmt ? cx.fmt(p) : (+p).toFixed(2)) : '');
  const fmtT = (t) => { if (!(t > 0)) return ''; const d = new Date(t * 1000); return d.toISOString().slice(5, 16).replace('T', ' ') + ' UTC'; };
  function rowsOf(cx) { const mk = mkOf(cx), L = load(mk);
    return L.map((d, i) => ({ i, d })).reverse().map(({ i, d }) => { const pr = d.type === 'h' || d.type === 'b' ? d.price : d.p1, what = d.type === 'x' ? '“' + String(d.text || '').slice(0, 24) + '”' : fmtP(cx, pr);
      return `<li${SEL && SEL.mk === mk && SEL.i === i ? ' class="on"' : ''}><button type="button" class="dl-go" data-i="${i}"><b>${NAMES[d.type] || d.type}</b><span>${what}${d.t1 ? ' · ' + fmtT(d.t1) : ''}${d.alert ? ' · alert' : ''}</span></button>`
        + `<button type="button" class="dl-ic" data-lk="${i}" aria-pressed="${!!d.lock}" aria-label="${d.lock ? 'Unlock' : 'Lock'} ${NAMES[d.type] || ''}">${d.lock ? 'Locked' : 'Lock'}</button>`
        + `<button type="button" class="dl-ic" data-rm="${i}" title="Delete" aria-label="Delete ${NAMES[d.type] || ''}"${d.lock ? ' disabled' : ''}>✕</button></li>`; }).join(''); }
  function listDraw() { if (!LIST || LIST.hidden || !LISTCX) return; const n = load(mkOf(LISTCX)).length;
    LIST.innerHTML = `<div class="dl-h"><b>Drawings</b><span>${n} on ${String(mkOf(LISTCX)).toUpperCase()}</span><button type="button" class="dl-ic" data-x aria-label="Close">✕</button></div>` + (n ? `<ul>${rowsOf(LISTCX)}</ul>` : '<p class="dl-e">No drawings on this market yet. Pick a tool on the left (or Alt+T, Alt+H, …) and draw.</p>'); }
  function focusOn(cx, d) { const c = toChart(d, cx.TZ), t = c.t1 || null; if (!t) return; const v = view(cx), lg = BT().tfLogical(v.bars, v.n, v.sec, t); if (lg == null) return;
    const ts = cx.chart.timeScale(), r = ts.getVisibleLogicalRange(); if (!r || (lg > r.from + 2 && lg < r.to - 2)) return; const w = r.to - r.from; ts.setVisibleLogicalRange({ from: lg - w / 2, to: lg + w / 2 }); }
  function openList(cx) { if (!cx) cx = LASTCX || CX.find((c) => c.visible()); if (!cx) return; LISTCX = cx;
    if (!LIST) { LIST = document.createElement('div'); LIST.id = 'ms-dlist'; LIST.className = 'ms-dlist'; LIST.setAttribute('role', 'dialog'); LIST.setAttribute('aria-label', 'Drawings on this market');
      LIST.addEventListener('pointerdown', (e) => e.stopPropagation());
      LIST.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const mk = mkOf(LISTCX), L = load(mk);
        if (b.hasAttribute('data-x')) { LIST.hidden = true; return; }
        if (b.dataset.rm != null) { remove(mk, +b.dataset.rm); listDraw(); return; }
        if (b.dataset.lk != null) { const d = L[+b.dataset.lk]; if (d) { if (d.lock) delete d.lock; else d.lock = true; save(mk); bar(); paintAll(); } listDraw(); return; }
        if (b.dataset.i != null) { const i = +b.dataset.i; if (!L[i]) return; SEL = { mk, i }; SELC = LISTCX; focusOn(LISTCX, L[i]); paintAll(); bar(); listDraw(); } });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && LIST && !LIST.hidden) LIST.hidden = true; }); }
    if (LIST.parentNode !== fsHost()) fsHost().appendChild(LIST); LIST.hidden = false; listDraw(); }
  window.msDrawList = openList; window.msDrawHide = (on) => setHide(on == null ? !HIDE : on);
  window.msDrawUndo = () => back(UNDO, REDO); window.msDrawRedo = () => back(REDO, UNDO);
  addEventListener('scroll', () => { if (SEL) bar(); }, { passive: true });

  // ---- charts: the page registers each one ----
  function attach(cx) { if (CX.includes(cx)) return; CX.push(cx); strip();
    const el = cx.el; el.addEventListener('pointerdown', (e) => down(cx, e), true); el.addEventListener('pointermove', (e) => move(cx, e), true);
    el.addEventListener('pointerleave', () => { cx.ring = null; if (HOV) { HOV = null; paintAll(); } });
    el.addEventListener('contextmenu', (e) => menu(cx, e));
    el.addEventListener('dblclick', (e) => { if (!BT() || TOOL) return; const r = el.getBoundingClientRect(), h = hitAt(cx, e.clientX - r.left, e.clientY - r.top); if (!h) return; const L = load(h.mk), d = L[h.i];
      if (!d || d.type !== 'x' || d.lock) return; e.preventDefault(); e.stopPropagation(); askText(d.text).then((s) => { if (s && L[h.i] === d) { d.text = s; d.editedAt = Math.floor(Date.now() / 1000); save(h.mk); bar(); paintAll(); } }); }, true);
    paint(cx); }
  // a gesture ends wherever the pointer is let go (20 Nov 2026): the listeners were on each chart, so a drawing dragged off its
  // chart and released there stayed "held" and followed the mouse with no button down, and the chart stayed locked
  const endGes = () => { if (GES) up(GES.cx); };
  addEventListener('pointerup', endGes, true); addEventListener('pointercancel', endGes, true); addEventListener('blur', endGes);
  const reg = window.msCharts = window.msCharts || { list: [], add(cx) { this.list.push(cx); document.dispatchEvent(new CustomEvent('ms:chart', { detail: cx })); } };
  reg.list.forEach(attach); document.addEventListener('ms:chart', (e) => attach(e.detail));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', strip); else strip();
  // a full-screen element hides everything outside it: the style bar and the menu move into it, and back (18 Nov 2026)
  // 20 Nov 2026: each chart's timeframe menu and the page's toasts (a line alert) move with them
  const fsMove = () => { const host = fsHost(); for (const id of ['ms-dsel', 'ms-cmenu', 'ms-ph-menu', 'ms-toasts', 'ms-dlist']) { const el = document.getElementById(id); if (el && el.parentNode !== host) host.appendChild(el); } setTimeout(paintAll, 120); };
  document.addEventListener('fullscreenchange', fsMove); document.addEventListener('ms:fs', fsMove);
  // ---- line alerts (19 Nov 2026): a horizontal line, ray or trend line marked "Alert" tells you once when the live price crosses
  // it while the page is open (a note on the page, and a browser notification when allowed); then the alert switches itself off.
  // Display only: nothing is sent anywhere and no order is placed.
  const LASTPX = {};
  function levelNow(d, t) { if (d.type === 'h') return d.price; if (d.type === 'hr') return t >= d.t1 ? d.p1 : null;
    if (d.type === 't') { const a = Math.min(d.t1, d.t2), b = Math.max(d.t1, d.t2); if (t < a || (t > b && !d.ext) || d.t1 === d.t2) return null; return BT().lineAt(d, t); } return null; }
  function alertCheck() { if (!BT()) return; const t = Math.floor(Date.now() / 1000), done = new Set();
    for (const cx of CX) { const mk = mkOf(cx); if (done.has(mk)) continue; const B = cx.bars() || []; if (!B.length) continue; done.add(mk);
      const px = B[B.length - 1].close, prev = LASTPX[mk]; LASTPX[mk] = px; if (!fin(prev) || !fin(px) || prev === px) continue; let ch = false;
      for (const d of load(mk)) { if (!d.alert) continue; const lv = levelNow(d, t); if (!fin(lv) || (prev - lv) * (px - lv) > 0) continue;
        delete d.alert; d.fired = t; ch = true; const I = window.msPaperHost && window.msPaperHost.insts && window.msPaperHost.insts[mk], name = (I && I.label) || mk.toUpperCase();
        const what = d.type === 'h' ? 'line' : d.type === 'hr' ? 'ray' : 'trend line', msg = `${name} ${px > prev ? 'rose through' : 'fell through'} your ${what} at ${cx.fmt(lv)}.`; alertToast(msg);
        try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Line alert', { body: msg, tag: 'ms-line-' + mk + '-' + t, icon: '/icons/icon-192.png' }); } catch (e) {} }
      if (ch) { save(mk); bar(); paintAll(); } } }
  function alertToast(msg) { const box = document.getElementById('ms-toasts'); if (!box) { note(msg); return; } const el = document.createElement('div'); el.className = 'ms-toast'; el.setAttribute('role', 'status');
    el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = 'Line alert'; el.querySelector('span').textContent = msg; box.appendChild(el); setTimeout(() => el.remove(), 12000); }
  setInterval(alertCheck, 1500);
  window.msLineAlerts = () => Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, { on: v.filter((d) => d.alert).length, fired: v.filter((d) => d.fired).length }]));
  // read-only view for the audit
  window.msDrawState = () => ({ tool: TOOL, mag: MAG, sel: SEL, charts: CX.length, shapes: Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, v.length])), geo: CX.filter((c) => c.visible()).map((c) => ({ id: c.id, mk: mkOf(c), g: load(mkOf(c)).map((d) => geo(c, d)) })) });
  window.msDrawRepaint = paintAll;
  window.msChartX = (cx, t) => X(cx, t);   // a time (chart time) to x on that chart, between candles too: used by the paper account (19 Nov 2026)
})();

/* Drawing tools like ChronosTrade on the Desk's charts (18 Nov 2026, owner: "chart should have the same chronotrades charts
   features all of them"). Display only: a drawing never places, changes or refuses an order and moves no stop.
   - Tools: trend line, horizontal line, horizontal ray, vertical line, box; magnet (off / weak / strong) on the candle's
     open / high / low / close; select, move, resize by handles; a style bar (5 colours, width, dashed, extend, label, lock,
     clone, delete); Alt+T / H / J / V / R / M; Delete removes the selected drawing, Esc lets go.
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
  const save = (mk) => ls.set(KEY(mk), JSON.stringify(ST[mk] || []));
  let SELC = null, TOOL = null, MAG = +(ls.get(MAGK) || 0) || 0, SEL = null, HOV = null, GES = null, DRAFT = null;   // SEL / HOV = { mk, i }
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
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
    const list = L.map((d, i) => [d, i]); if (DRAFT && DRAFT.mk === mk) list.push([DRAFT.d, -1]);
    for (const [d, i] of list) { const g = geo(cx, d); if (!g) continue; const sel = SEL && SEL.mk === mk && SEL.i === i, hov = HOV && HOV.mk === mk && HOV.i === i, col = colOf(d);
      x.strokeStyle = col; x.lineWidth = (d.w || 1) + (hov && !sel ? 0.5 : 0); x.setLineDash(d.ls === 'dash' ? [6, 4] : []);
      if (g.type === 'r') { x.fillStyle = col + '22'; const rx = Math.min(g.x1, g.x2), ry = Math.min(g.y1, g.y2), rw = Math.abs(g.x2 - g.x1), rh = Math.abs(g.y2 - g.y1); x.fillRect(rx, ry, rw, rh); x.strokeRect(rx, ry, rw, rh); }
      else { x.beginPath(); x.moveTo(g.x1, g.y1); x.lineTo(g.xe != null ? g.xe : g.x2, g.ye != null ? g.ye : g.y2); x.stroke(); }
      x.setLineDash([]);
      if (d.type === 'h' || d.type === 'hr') { const lab = cx.fmt(d.type === 'h' ? d.price : d.p1); x.font = '600 12px Figtree, system-ui, sans-serif'; const tw = x.measureText(lab).width + 10; x.fillStyle = col; x.fillRect(W - tw - 2, g.y1 - 9, tw, 18); x.fillStyle = '#fff'; x.fillText(lab, W - tw + 3, g.y1 + 4); }
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
    const order = L.map((d, i) => i).reverse(); if (SEL && SEL.mk === mk) order.unshift(SEL.i);
    for (const i of order) { const d = L[i]; if (!d) continue; const part = BT().drawHit(geo(cx, d), xp, yp, tol, hT); if (part) return { mk, i, part }; } return null; }

  // ---- gestures ----
  function place(cx, a) { const mk = mkOf(cx); if (TOOL === 'h') return commit(mk, { type: 'h', price: a.p });
    if (TOOL === 'hr') return commit(mk, { type: 'hr', t1: a.t - cx.TZ, p1: a.p }); if (TOOL === 'v') return commit(mk, { type: 'v', t1: a.t - cx.TZ });
    DRAFT = { mk, d: { type: TOOL, t1: a.t - cx.TZ, p1: a.p, t2: a.t - cx.TZ, p2: a.p }, cx }; }
  function commit(mk, d) { const L = load(mk), at = Math.floor(Date.now() / 1000); L.push(Object.assign(d, { at })); save(mk); SEL = { mk, i: L.length - 1 }; SELC = LASTCX; DRAFT = null; setTool(null); paintAll(); bar(); }
  function lock(cx, on) { try { cx.chart.applyOptions({ handleScroll: !on, handleScale: !on }); } catch (e) {} }
  let LASTCX = null;
  function down(cx, ev) { LASTCX = cx; if (!BT() || ev.button === 2 || ev.shiftKey || !cx.visible()) return; const a = pt(cx, ev); if (a.t == null || a.p == null) return;
    if (TOOL) { ev.preventDefault(); ev.stopPropagation(); if (DRAFT && DRAFT.cx === cx) { DRAFT.d.t2 = a.t - cx.TZ; DRAFT.d.p2 = a.p; return commit(DRAFT.mk, DRAFT.d); }
      place(cx, a); if (DRAFT) { GES = { cx, kind: 'draft', x0: a.x, y0: a.y }; lock(cx, true); } return; }
    const h = hitAt(cx, a.x, a.y); if (!h) { if (SEL) { SEL = null; bar(); paintAll(); } return; }
    ev.preventDefault(); ev.stopPropagation(); SEL = { mk: h.mk, i: h.i }; SELC = cx; bar(); const d = load(h.mk)[h.i];
    if (!d.lock) { GES = { cx, kind: h.part === 'body' ? 'move' : 'size', part: h.part, d0: { ...d }, a }; lock(cx, true); } paintAll(); }
  function move(cx, ev) { if (!BT()) return; const a = pt(cx, ev);
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
  const ICON = { '': '<path d="M6 3l12 9-5.5 1.2L10 19z"/>', t: '<path d="M4.5 18.5L19.5 5.5"/><circle cx="4.5" cy="18.5" r="1.6"/><circle cx="19.5" cy="5.5" r="1.6"/>', h: '<path d="M3 12h18"/>', hr: '<path d="M6 12h15"/><circle cx="5" cy="12" r="1.8"/>', v: '<path d="M12 3v18"/>', r: '<rect x="4" y="6" width="16" height="12" rx="1"/>', mag: '<path d="M6 4v7a6 6 0 0 0 12 0V4"/><path d="M6 8h3M15 8h3"/>' };
  const NAME = { '': 'Cursor (Esc)', t: 'Trend line (Alt+T)', h: 'Horizontal line (Alt+H)', hr: 'Horizontal ray (Alt+J)', v: 'Vertical line (Alt+V)', r: 'Box (Alt+R)' };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  function strip() { const host = document.getElementById('ms-dr-bar'); if (!host || host.dataset.done) return; host.dataset.done = '1';
    host.innerHTML = Object.keys(NAME).map((k) => `<button type="button" data-dt="${k}" aria-pressed="${k === ''}" title="${NAME[k]}" aria-label="${NAME[k].replace(/ \(.*/, '')}">${svg(k)}</button>`).join('') + `<button type="button" class="dr-mag" data-mag aria-pressed="false" title="Magnet: off (Alt+M)" aria-label="Magnet">${svg('mag')}<small></small></button>`;
    host.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-mag')) { setMag((MAG + 1) % 3); return; } const t = b.dataset.dt; setTool(t && TOOL !== t ? t : null); });
    setMag(MAG); setTool(null); }
  function setTool(t) { TOOL = t || null; DRAFT = null; if (TOOL) SEL = null; document.documentElement.toggleAttribute('data-drawing', !!TOOL);
    document.querySelectorAll('#ms-dr-bar [data-dt]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.dt || null) === TOOL)));
    CX.forEach((cx) => { cx.ring = null; }); bar(); paintAll(); }
  function setMag(m) { MAG = m; ls.set(MAGK, String(m)); const b = document.querySelector('#ms-dr-bar [data-mag]'); if (!b) return; const w = ['off', 'weak', 'strong'][m];
    b.setAttribute('aria-pressed', String(m > 0)); b.title = `Magnet: ${w} (Alt+M)`; b.querySelector('small').textContent = m ? (m === 1 ? 'W' : 'S') : ''; }
  const CHIP = ['draw', 'up', 'dn', 'gold', 'ink'];
  function bar() { let el = document.getElementById('ms-dsel'); if (!SEL) { if (el) el.hidden = true; return; } const L = load(SEL.mk), d = L[SEL.i]; if (!d) { SEL = null; if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'ms-dsel'; el.className = 'ms-dsel'; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Selected drawing'); document.body.appendChild(el); el.addEventListener('click', selAct); el.addEventListener('pointerdown', (e) => e.stopPropagation()); }
    const on = (b) => (b ? ' aria-pressed="true"' : ' aria-pressed="false"');
    el.innerHTML = CHIP.map((c) => `<button type="button" class="dc" data-col="${c}" title="Colour"${on((d.col || 'draw') === c)} style="--c:${COLS[c].startsWith('--') ? `var(${COLS[c]})` : COLS[c]}"><i></i></button>`).join('')
      + `<span class="sep"></span>` + [1, 2, 3].map((w) => `<button type="button" data-w="${w}" title="Width ${w}"${on((d.w || 1) === w)}>${w}px</button>`).join('')
      + `<button type="button" data-ls title="Dashed"${on(d.ls === 'dash')}>- -</button>` + (d.type === 't' ? `<button type="button" data-ext title="Extend to the right"${on(d.ext)}>→</button>` : '')
      + (d.type === 't' || d.type === 'r' ? `<button type="button" data-lbl title="Label: price change, %, bars"${on(d.lbl)}>Label</button>` : '')
      + `<span class="sep"></span><button type="button" data-lock title="${d.lock ? 'Unlock' : 'Lock'}"${on(d.lock)}>${d.lock ? 'Locked' : 'Lock'}</button><button type="button" data-clone title="Clone">Clone</button><button type="button" data-del title="Delete (Del)" class="del">Delete</button>`;
    el.hidden = false; const cx = SELC && SELC.visible() && mkOf(SELC) === SEL.mk ? SELC : CX.find((c) => c.visible() && mkOf(c) === SEL.mk), g = cx && geo(cx, d), r = cx && cx.el.getBoundingClientRect();
    const bw = el.offsetWidth || 360; let lx = r ? r.left + (g ? Math.min(g.x1, g.x2 != null ? g.x2 : g.x1) : 8) : 16, ty = r ? r.top + (g ? Math.min(g.y1, g.y2 != null ? g.y2 : g.y1) : 8) - 48 : 80;
    lx = Math.max(8, Math.min(innerWidth - bw - 8, lx)); ty = Math.max(8, ty); el.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ty)}px)`; }
  function selAct(e) { const b = e.target.closest('button'); if (!b || !SEL) return; const mk = SEL.mk, L = load(mk), d = L[SEL.i]; if (!d) return;
    if (b.dataset.col) { if (b.dataset.col === 'draw') delete d.col; else d.col = b.dataset.col; }
    else if (b.dataset.w) { if (+b.dataset.w === 1) delete d.w; else d.w = +b.dataset.w; }
    else if (b.hasAttribute('data-ls')) { if (d.ls) delete d.ls; else d.ls = 'dash'; }
    else if (b.hasAttribute('data-ext')) { if (d.ext) delete d.ext; else d.ext = true; }
    else if (b.hasAttribute('data-lbl')) { if (d.lbl) delete d.lbl; else d.lbl = true; }
    else if (b.hasAttribute('data-lock')) { if (d.lock) delete d.lock; else d.lock = true; }
    else if (b.hasAttribute('data-clone')) { const c = { ...d }; delete c.lock; for (const k of ['p1', 'p2', 'price']) if (fin(c[k])) c[k] *= 1.002; c.at = Math.floor(Date.now() / 1000); L.push(c); SEL = { mk, i: L.length - 1 }; }
    else if (b.hasAttribute('data-del')) { remove(mk, SEL.i); return; }
    save(mk); bar(); paintAll(); }
  function remove(mk, i) { const L = load(mk), d = L[i]; if (!d) return false; if (d.lock) { note('Locked: unlock it first.'); return false; } L.splice(i, 1); save(mk); SEL = null; HOV = null; bar(); paintAll(); return true; }
  const note = (s) => { if (window.msToast) try { window.msToast(s); return; } catch (e) {} const n = document.getElementById('ms-dr-note'); if (n) { n.textContent = s; clearTimeout(n._t); n._t = setTimeout(() => { n.textContent = ''; }, 2500); } };

  // ---- right-click menu ----
  function menu(cx, ev) { if (!BT()) return; ev.preventDefault(); if (TOOL) { setTool(null); return; } const r = cx.el.getBoundingClientRect(), xp = ev.clientX - r.left, yp = ev.clientY - r.top, h = hitAt(cx, xp, yp), mk = mkOf(cx), L = load(mk);
    if (h) { SEL = { mk: h.mk, i: h.i }; SELC = cx; bar(); paintAll(); }
    let m = document.getElementById('ms-cmenu'); if (!m) { m = document.createElement('div'); m.id = 'ms-cmenu'; m.className = 'ms-cmenu'; m.setAttribute('role', 'menu'); document.body.appendChild(m); document.addEventListener('pointerdown', (e) => { if (!m.contains(e.target)) m.hidden = true; }, true); document.addEventListener('keydown', (e) => { if (e.key === 'Escape') m.hidden = true; }); }
    const last = [...L.keys()].reverse().find((i) => !L[i].lock);
    m.innerHTML = `<button type="button" role="menuitem" data-m="reset">Reset chart view</button>` + (h ? `<button type="button" role="menuitem" data-m="del">Delete this drawing</button>` : '')
      + `<button type="button" role="menuitem" data-m="last"${last == null ? ' disabled' : ''}>Remove the last drawing</button><button type="button" role="menuitem" data-m="all"${L.length ? '' : ' disabled'}>Delete all drawings</button>`;
    m.hidden = false; const bw = m.offsetWidth || 220, bh = m.offsetHeight || 160; m.style.transform = `translate(${Math.min(ev.clientX, innerWidth - bw - 8)}px, ${Math.min(ev.clientY, innerHeight - bh - 8)}px)`;
    m.onclick = async (e) => { const b = e.target.closest('button[data-m]'); if (!b) return; m.hidden = true; const k = b.dataset.m;
      if (k === 'reset') { try { cx.chart.priceScale('right').applyOptions({ autoScale: true }); cx.chart.timeScale().resetTimeScale(); cx.chart.timeScale().scrollToRealTime(); } catch (x) {} }
      if (k === 'del' && h) remove(h.mk, h.i);
      if (k === 'last' && last != null) remove(mk, last);
      if (k === 'all') { const ok = window.msConfirm ? await window.msConfirm(`Delete all ${L.filter((d) => !d.lock).length} drawings on this market? Locked ones stay.`, { title: 'Delete all drawings', ok: 'Delete all', danger: true }) : confirm('Delete all drawings?');
        if (ok) { ST[mk] = L.filter((d) => d.lock); save(mk); SEL = null; bar(); paintAll(); } } };
    m.querySelector('button:not([disabled])').focus({ preventScroll: true }); }

  // ---- keys ----
  document.addEventListener('keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') || document.querySelector('dialog[open]') || !CX.some((c) => c.visible())) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey) { const t = { KeyT: 't', KeyH: 'h', KeyJ: 'hr', KeyV: 'v', KeyR: 'r' }[e.code]; if (t) { e.preventDefault(); setTool(TOOL === t ? null : t); return; } if (e.code === 'KeyM') { e.preventDefault(); setMag((MAG + 1) % 3); return; } }
    if (e.key === 'Escape' && (TOOL || SEL || GES)) { if (GES && SEL) { const L = load(SEL.mk); if (GES.d0) L[SEL.i] = GES.d0; GES.cx && lock(GES.cx, false); GES = null; } setTool(null); SEL = null; bar(); paintAll(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && SEL && !e.ctrlKey && !e.metaKey) { e.preventDefault(); remove(SEL.mk, SEL.i); } });
  addEventListener('scroll', () => { if (SEL) bar(); }, { passive: true });

  // ---- charts: the page registers each one ----
  function attach(cx) { if (CX.includes(cx)) return; CX.push(cx); strip();
    const el = cx.el; el.addEventListener('pointerdown', (e) => down(cx, e), true); el.addEventListener('pointermove', (e) => move(cx, e), true);
    el.addEventListener('pointerup', () => up(cx), true); el.addEventListener('pointercancel', () => up(cx), true); el.addEventListener('pointerleave', () => { cx.ring = null; if (HOV) { HOV = null; paintAll(); } });
    el.addEventListener('contextmenu', (e) => menu(cx, e)); paint(cx); }
  const reg = window.msCharts = window.msCharts || { list: [], add(cx) { this.list.push(cx); document.dispatchEvent(new CustomEvent('ms:chart', { detail: cx })); } };
  reg.list.forEach(attach); document.addEventListener('ms:chart', (e) => attach(e.detail));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', strip); else strip();
  // read-only view for the audit
  window.msDrawState = () => ({ tool: TOOL, mag: MAG, sel: SEL, charts: CX.length, shapes: Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, v.length])), geo: CX.filter((c) => c.visible()).map((c) => ({ id: c.id, mk: mkOf(c), g: load(mkOf(c)).map((d) => geo(c, d)) })) });
  window.msDrawRepaint = paintAll;
})();

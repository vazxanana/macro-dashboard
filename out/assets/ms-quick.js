/* Quick type on the Charts (27 Nov 2026): as in a trading terminal, type a timeframe ("15", "60", "4h", "1d", "30s") or a market
   ("eur", "xau", "nas") while a chart is on screen; a small box shows what it will do; Enter applies, Escape closes. A single digit
   0-6 with nothing after it keeps its old meaning (the D1 / H4 / H1 / M15 / M5 / M1 / All panes) after a short pause.
   ("/" stays the page's command palette.) Display only: it changes the view or loads another market, never an order. Nothing is stored.
   window.MS_QUICK = { parseTf, matchMarkets } (pure) for tests. */
(function (root) {
  'use strict';
  // text -> a timeframe id of the page ('15m', '1h', '1d', '1w', '1M', '1Y', '30s') or null
  function parseTf(s, ids) {
    const has = (x) => ids.includes(x) ? x : null, t = String(s || '').trim();
    let m = /^(\d{1,4})$/.exec(t);
    if (m) { const n = +m[1]; if (!n) return null; if (has(n + 'm')) return n + 'm'; if (n % 1440 === 0 && n / 1440 === 1) return has('1d'); if (n % 60 === 0) return has(n / 60 + 'h'); return null; }
    m = /^(\d{1,4})?\s*([smhdwMyY])$/.exec(t); if (!m) return null;
    const n = m[1] ? +m[1] : 1, u = m[2]; if (!n) return null;
    if (u === 's' || u === 'h') return has(n + u);
    if (u === 'm') return has(n + 'm');
    if (u === 'M') return has(n + 'M');
    if (u === 'd' || u === 'w') return has(n + u);
    return has(n + 'Y');
  }
  // markets [{ k, label, name }] matching the text, best first: the key, the label without "/", then the name
  function matchMarkets(q, list) {
    const s = String(q || '').toLowerCase().replace(/[^a-z0-9]/g, ''); if (!s) return list.slice(0, 8);
    const sc = (x) => { const k = x.k.toLowerCase(), l = String(x.label || '').toLowerCase().replace(/[^a-z0-9]/g, ''), n = String(x.name || '').toLowerCase();
      if (k === s || l === s) return 0; if (k.startsWith(s) || l.startsWith(s)) return 1; if (n.startsWith(s)) return 2; if (k.includes(s) || l.includes(s)) return 3; if (n.includes(s)) return 4; return 9; };
    return list.map((x) => [sc(x), x]).filter((p) => p[0] < 9).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, 8);
  }
  const API = { parseTf, matchMarkets };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_QUICK = API;
  if (typeof document === 'undefined') return;

  const PANE = { 1: '1d', 2: '4h', 3: '1h', 4: '15m', 5: '5m', 6: '1m', 0: 'all' };
  const TOOLS = 'fhtbpmr';   // the Charts' single-letter tool keys stay theirs
  let box = null, buf = '', mode = null, pick = 0, timer = null;
  const ids = () => { try { return (root.msTfGroups ? root.msTfGroups() : []).flatMap((g) => g[1].map((x) => x.id)); } catch (e) { return []; } };
  const labelOf = (id) => { try { for (const g of root.msTfGroups()) for (const x of g[1]) if (x.id === id) return x.label; } catch (e) {} return id; };
  const onCharts = () => location.hash === '#charts' || document.documentElement.dataset.app === 'charts';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function host() { return (root.msFsHost && root.msFsHost()) || document.body; }
  function close() { if (box) box.hidden = true; buf = ''; mode = null; pick = 0; clearTimeout(timer); }
  function list() { return mode === 'mk' && root.msMarkets ? matchMarkets(buf, root.msMarkets()) : []; }
  function draw() {
    if (!box) { box = document.createElement('div'); box.id = 'ms-qk'; box.className = 'ms-qk'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Quick type');
      box.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-qk]'); if (b) { e.preventDefault(); go(+b.dataset.qk); } }); }
    if (box.parentNode !== host()) host().appendChild(box);
    let h;
    if (mode === 'tf') { const id = parseTf(buf, ids()), pane = /^[0-6]$/.test(buf);
      h = `<div class="qk-h">Timeframe</div><div class="qk-in">${esc(buf)}<i></i></div><div class="qk-r">${id ? 'Enter: ' + esc(labelOf(id)) : pane ? 'Enter: ' + (buf === '0' ? 'all charts' : esc(labelOf(PANE[buf])) + ' chart') : 'Not a timeframe'}</div>`; }
    else { const L = list(); pick = Math.min(pick, Math.max(0, L.length - 1));
      h = `<div class="qk-h">Market</div><div class="qk-in">${esc(buf)}<i></i></div>` + (L.length ? '<div class="qk-l">' + L.map((x, i) => `<button type="button" data-qk="${i}"${i === pick ? ' class="on"' : ''}><b>${esc(x.label)}</b><span>${esc(x.name || '')}</span></button>`).join('') + '</div>' : '<div class="qk-r">No market matches</div>'); }
    box.innerHTML = h + '<div class="qk-f">Enter to apply · Esc to close</div>'; box.hidden = false; }
  function go(i) {
    if (mode === 'tf') { const id = parseTf(buf, ids());
      if (/^[0-6]$/.test(buf)) { const b = document.querySelector(`[data-view="${PANE[buf]}"]`); if (b) b.click(); }
      else if (id && root.msOneTf) root.msOneTf(id);
      close(); return; }
    const x = list()[i == null ? pick : i]; close(); if (x && !x.on && root.msGoMarket) root.msGoMarket(x.k, '#charts'); }
  document.addEventListener('keydown', (e) => {
    const r = document.documentElement;
    if (r.dataset.role === 'public' || !onCharts()) { if (mode) close(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') || (e.target && e.target.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key;
    if (mode) {
      if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      if (k === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); go(); return; }
      if (k === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); buf = buf.slice(0, -1); if (!buf) { close(); return; } draw(); arm(); return; }
      if (mode === 'mk' && (k === 'ArrowDown' || k === 'ArrowUp')) { e.preventDefault(); e.stopImmediatePropagation(); const n = list().length; if (n) pick = (pick + (k === 'ArrowDown' ? 1 : n - 1)) % n; draw(); return; }
      if (k.length === 1 && /[A-Za-z0-9]/.test(k) && buf.length < 12) { e.preventDefault(); e.stopImmediatePropagation(); buf += k; if (mode === 'tf' && /[a-zA-Z]/.test(k) && !parseTf(buf, ids()) && !/^\d+$/.test(buf)) mode = /^\d/.test(buf) ? 'tf' : 'mk'; draw(); arm(); }
      return; }
    if (k.length !== 1 || e.repeat) return;
    if (/[0-9]/.test(k)) { e.preventDefault(); e.stopImmediatePropagation(); mode = 'tf'; buf = k; draw(); arm(); return; }
    if (/[a-zA-Z]/.test(k) && !TOOLS.includes(k.toLowerCase())) { e.preventDefault(); e.stopImmediatePropagation(); mode = 'mk'; buf = k; pick = 0; draw(); arm(); }
  }, true);
  // a lone pane digit (0-6) applies by itself after a short pause, as the old key did; anything else waits for Enter (10 s at most)
  function arm() { clearTimeout(timer); timer = setTimeout(() => { if (mode === 'tf' && /^[0-6]$/.test(buf)) go(); else close(); }, mode === 'tf' && /^[0-6]$/.test(buf) ? 900 : 10000); }
  addEventListener('hashchange', close);

  // arrow keys on the chart under the mouse (27 Nov 2026): left / right move it a candle (Shift: ten), up / down zoom in / out,
  // End back to the latest candle. A chart in replay keeps its own arrow keys.
  let OVER = null;
  document.addEventListener('pointermove', (e) => { const L = (root.msCharts && root.msCharts.list) || []; OVER = L.find((c) => c.el && c.el.contains(e.target)) || OVER; }, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (mode || e.ctrlKey || e.metaKey || e.altKey || !onCharts() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'End'].includes(e.key)) return;
    if (/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target || {}).tagName || '') || (e.target && e.target.closest && e.target.closest('[role="tablist"],[role="menu"],dialog'))) return;
    const L = ((root.msCharts && root.msCharts.list) || []).filter((c) => c.el && c.el.getBoundingClientRect().height > 0), cx = (OVER && L.includes(OVER)) ? OVER : L.length === 1 ? L[0] : null;
    if (!cx || !cx.chart || document.querySelector('.ch-rp.on')) return;
    const ts = cx.chart.timeScale(), r = ts.getVisibleLogicalRange(); if (!r) return;
    e.preventDefault();
    if (e.key === 'End') { ts.scrollToRealTime(); return; }
    const w = r.to - r.from;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const d = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1); ts.setVisibleLogicalRange({ from: r.from + d, to: r.to + d }); return; }
    const k = e.key === 'ArrowUp' ? 0.8 : 1.25, nw = Math.max(10, Math.min(5000, w * k)); ts.setVisibleLogicalRange({ from: r.to - nw, to: r.to });
  });
})(typeof window !== 'undefined' ? window : globalThis);

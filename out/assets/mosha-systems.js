// The council's two Mosha systems on the Mosha desk (owner, 20 Nov 2026: "why mosha desk doesnt have the trades like ict and
// executions" -> "do it"). One row per trade the Trader recorded for Mosha BO (`k: 'mosha-bo'`) and the Mosha cycle (`k: 'mcycle'`),
// each with its two executions side by side: the paper record (trades.json) and its copy on the cTrader demo account (the mirror's
// own record of that trade id). Display only: it reads the copy of trades.json the page already loaded (window.MS_COUNCIL) and the
// mirror files through msData; nothing here places, copies or changes a trade, and no council member reads it.
// Honest labels: both systems are paper shadows by the owner's rules, and the studies of both failed after costs. The card says so
// and never calls the record an edge; under 20 closed trades it says "too few to judge".
// Who sees it: the owner and the desk's readers. Never the teacher himself (the same rule as "What the fixed rules said").
(function (root) {
  'use strict';
  var D = root.MS_MOSHA || (typeof require === 'function' ? require('./mosha-desk.js') : null);
  var KEYS = { 'mosha-bo': 'Mosha BO', mcycle: 'Mosha cycle' };
  var DONE = { win: 1, loss: 1, be: 1 };
  var MIN_JUDGE = D ? D.MIN_JUDGE : 20;
  var num = function (v) { return typeof v === 'number' && isFinite(v) ? v : null; };

  function visible(ds) { ds = ds || {}; return !(ds.mosha === 'teach' && ds.role !== 'owner') && ds.role !== 'public'; }
  function isMosha(t) { return !!(t && KEYS[t.k] && typeof t.id === 'string' && !t.replay); }
  // mirror files -> { <trade id>: { account label, ...the mirror's record } }. ICT's account is never read (a separate edge).
  function copies(files) {
    var out = {};
    (files || []).forEach(function (f) {
      if (!f || !f.data || (f.books || []).indexOf('ict') >= 0) return;
      var map = (f.data.state || {}).map || {}, label = f.drain ? 'old shadows account' : (f.books || []).join(' + ') + ' account';
      Object.keys(map).forEach(function (id) { var m = map[id]; if (m && typeof m === 'object' && !out[id]) out[id] = { label: label, m: m }; });
      var skip = (f.data.state || {}).skipped || {}, wait = (f.data.state || {}).wait || {};
      [skip, wait].forEach(function (o, i) { if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(function (id) { if (!out[id]) out[id] = { label: label, why: String((o[id] && (o[id].why || o[id].reason || o[id].note)) || o[id] || '').slice(0, 160), kind: i ? 'wait' : 'skipped' }; }); });
    });
    return out;
  }
  // one trade -> the row the card draws
  function rowOf(t, cp) {
    var st = t.status, closed = !!DONE[st];
    var r = { id: t.id, k: t.k, system: KEYS[t.k], add: !!t.addOf, side: t.side, market: t.label || String(t.market || '').toUpperCase(), dec: num(t.dec) != null ? t.dec : 2,
      opened: num(t.opened), filled: num(t.filled), closedAt: num(t.closed), entry: num(t.entry), stop: num(t.stop), target: num(t.t1), r0: num(t.r0),
      status: st, closed: closed, R: closed ? num(t.R) : null, Rnet: closed ? (num(t.Rnet) != null ? t.Rnet : null) : null, mfe: num(t.mfe),
      shadow: !!t.shadow, why: Array.isArray(t.blockedBy) ? t.blockedBy.slice(0, 6) : [], demo: null };
    var c = cp && cp[t.id];
    if (c && c.m) r.demo = { label: c.label, fill: num(c.m.fillPrice), slipR: num(c.m.slipR), lots: num(c.m.lots), status: String(c.m.status || 'open'), openedAt: c.m.openedAt || null, closedAt: c.m.closedAt || null, viaLimit: !!c.m.viaLimit, stop: num(c.m.stop) };
    else if (c) r.demo = { label: c.label, none: true, why: c.why, kind: c.kind };
    return r;
  }
  function build(trades, files) {
    var cp = copies(files), list = (trades || []).filter(isMosha).map(function (t) { return rowOf(t, cp); });
    list.sort(function (a, b) { return (b.opened || 0) - (a.opened || 0); });
    var per = {};
    Object.keys(KEYS).forEach(function (k) {
      var mine = list.filter(function (r) { return r.k === k; }), cl = mine.filter(function (r) { return r.closed && r.R != null; });
      var net = cl.filter(function (r) { return r.Rnet != null; });
      per[k] = { name: KEYS[k], n: mine.length, open: mine.filter(function (r) { return r.status === 'open'; }).length, waiting: mine.filter(function (r) { return r.status === 'pending'; }).length,
        gross: D.stats(cl.map(function (r) { return r.R; })), net: D.stats(net.map(function (r) { return r.Rnet; })), copied: mine.filter(function (r) { return r.demo && !r.demo.none; }).length };
    });
    return { rows: list, per: per, mirrors: !!(files && files.length) };
  }
  var API = { KEYS: KEYS, MIN_JUDGE: MIN_JUDGE, visible: visible, isMosha: isMosha, copies: copies, rowOf: rowOf, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_MOSHA_SYS = API;
  if (typeof document === 'undefined') return;

  // ─── the card (#mo-sys) ───
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fR = function (v) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R'; };
  var cls = function (v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : ''; };
  var utc = function (s) { return s ? new Date(s * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'; };
  var iso = function (s) { var t = Date.parse(s); return isFinite(t) ? utc(Math.floor(t / 1000)) : '—'; };
  var px = function (v, d) { return v == null ? '—' : (+v).toFixed(d); };
  var WORD = { open: 'Open', pending: 'Waiting to fill', win: 'Closed', loss: 'Closed', be: 'Closed', expired: 'Order expired, never filled', missed: 'Not filled', skipped: 'Skipped', duplicate: 'Duplicate, not counted', void: 'Void' };
  var S = { files: null, at: 0, busy: false, err: false };

  function loadMirrors() {
    if (S.busy || !root.msData || Date.now() - S.at < 60000) return; S.busy = true;
    root.msData.json('ctrader/mirror-accounts.json').then(function (j) {
      var groups = j && Array.isArray(j.groups) ? j.groups.filter(function (g) { return g && /^mirror(-\d+)?\.json$/.test(g.file) && (g.books || []).indexOf('ict') < 0; }) : [{ file: 'mirror.json', books: ['council'] }];
      return Promise.all(groups.map(function (g) { return root.msData.json('ctrader/' + g.file).then(function (d) { return { books: g.books || [], drain: !!g.drain, data: d }; }, function () { return null; }); }));
    }).then(function (fs) { S.files = (fs || []).filter(function (f) { return f && f.data; }); S.err = !S.files.length; }, function () { S.err = true; })
      .then(function () { S.busy = false; S.at = Date.now(); draw(); });
  }
  function paperCell(r) {
    var head = '<b>Paper</b> · ' + esc(WORD[r.status] || r.status), body = '';
    if (r.filled) body += 'filled ' + px(r.entry, r.dec) + ' · ' + utc(r.filled);
    else body += 'entry ' + px(r.entry, r.dec) + ' · placed ' + utc(r.opened);
    if (r.closed) head = '<b>Paper</b> · <b class="' + cls(r.R) + '">' + fR(r.R) + '</b>' + (r.Rnet != null ? ' <small>(' + fR(r.Rnet) + ' after costs)</small>' : '');
    if (r.closed && r.closedAt) body += ' · closed ' + utc(r.closedAt);
    if (r.status === 'open' && r.mfe != null) body += ' · best so far ' + fR(r.mfe);
    return '<div class="mo-ex">' + head + '<small>' + body + '</small></div>';
  }
  function demoCell(r) {
    var d = r.demo;
    if (!d) return '<div class="mo-ex mo-ex-no"><b>Demo</b> · ' + (S.files ? 'no copy on file' : S.err ? 'the demo records could not be read' : 'reading the demo records…') + '</div>';
    if (d.none) return '<div class="mo-ex mo-ex-no"><b>Demo</b> · not copied' + (d.why ? '<small>' + esc(d.why) + '</small>' : '') + '</div>';
    var slip = d.slipR == null ? '' : ' · fill ' + (d.slipR > 0 ? fR(d.slipR).replace('+', '') + ' worse than paper' : d.slipR < 0 ? fR(-d.slipR).replace('+', '') + ' better than paper' : 'equal to paper');
    return '<div class="mo-ex"><b>Demo</b> · ' + esc(d.status) + '<small>' + (d.fill != null ? 'filled ' + px(d.fill, r.dec) : 'not filled yet') + (d.lots != null ? ' · ' + d.lots + ' lot' : '') + slip +
      (d.openedAt ? ' · ' + iso(d.openedAt) : '') + (d.closedAt ? ' · closed ' + iso(d.closedAt) : '') + ' · ' + esc(d.label) + '</small></div>';
  }
  function rowHTML(r) {
    return '<tr><td class="mo-c-time"><span class="mo-when">' + utc(r.filled || r.opened) + '</span><small>' + esc(r.system) + (r.add ? ' · add unit' : '') + ' · ' + esc(r.market) + (r.shadow ? ' · shadow' : ' · live paper') + '</small></td>' +
      '<td class="mo-c-side"><span class="chip ' + esc(r.side) + '">' + esc(r.side) + '</span></td>' +
      '<td class="n" data-l="Entry">' + px(r.entry, r.dec) + '</td><td class="n" data-l="Stop">' + px(r.stop, r.dec) + '</td><td class="n" data-l="Target">' + px(r.target, r.dec) + '</td>' +
      '<td class="mo-c-res">' + paperCell(r) + demoCell(r) + '</td></tr>';
  }
  function line(p) {
    var g = p.gross, parts = [p.n + ' recorded'];
    if (p.open) parts.push(p.open + ' open'); if (p.waiting) parts.push(p.waiting + ' waiting to fill');
    parts.push(g.n ? g.n + ' closed, ' + fR(g.total) + ' before costs' + (p.net.n ? ', ' + fR(p.net.total) + ' after' : '') : 'none closed yet');
    if (S.files) parts.push(p.copied + ' copied to the demo');
    return '<p class="mo-sys-l"><b>' + esc(p.name) + '</b>: ' + esc(parts.join(' · ')) + '. ' + (g.n < MIN_JUDGE ? 'Too few to judge (' + g.n + ' of ' + MIN_JUDGE + ' closed).' : 'A forward record, not a tested edge (t ' + (g.t == null ? 'n/a' : g.t.toFixed(2)) + ').') + '</p>';
  }
  function draw() {
    var box = $('mo-sys'); if (!box) return; var ok = visible(document.documentElement.dataset); box.hidden = !ok; if (!ok) return;
    var head = '<div class="ms-k"><span>The council\'s Mosha systems</span><small>every trade the bots recorded · paper record and demo copy side by side</small></div>';
    var C = root.MS_COUNCIL, trades = C && Array.isArray(C.trades) ? C.trades : null;
    if (!trades) { box.innerHTML = head + '<div class="ct-empty">Loading the council\'s trades…</div>'; return; }
    var B = build(trades, S.files), shown = B.rows.slice(0, 40);
    box.innerHTML = head + line(B.per['mosha-bo']) + line(B.per.mcycle) +
      (shown.length ? '<div class="ct-tw"><table class="ct-t mo-t" aria-label="Trades of the council\'s Mosha systems"><thead><tr><th>Time</th><th>Side</th><th class="n">Entry</th><th class="n">Stop</th><th class="n">Target</th><th>Executions</th></tr></thead><tbody>' + shown.map(rowHTML).join('') + '</tbody></table></div>' + (B.rows.length > shown.length ? '<p class="ms-note">The latest 40 of ' + B.rows.length + '. All of them are in Council → Trades.</p>' : '')
        : '<div class="ct-empty">Neither system has a trade on file.</div>') +
      '<p class="ms-note">These are the two fixed-rule versions of Mosha the council runs by itself, not your own trades and not Luxus\'s. Both are paper shadows: Mosha BO since 11 Nov 2026, the Mosha cycle since 14 Nov 2026, and the studies of both failed after costs (<a href="/edge-lab.html#mcycle-oos">the cycle\'s</a>, <a href="/edge-lab.html#mosha-oos">Mosha BO\'s</a>). Stop and target are the levels now (a trailed stop has moved). The demo copy is on a cTrader demo account; nothing is ever sent to a live account.</p>';
  }
  function go() { var v = $('v-mosha'); if (!v || v.hidden) return; if (visible(document.documentElement.dataset)) loadMirrors(); draw(); }
  var prev = root.renderMosha;
  root.renderMosha = function () { if (prev) prev(); go(); };
  root.msMoshaSystems = go;
  document.addEventListener('ms:council', go);
  go();
})(typeof window !== 'undefined' ? window : globalThis);

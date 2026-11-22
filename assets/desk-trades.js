// The LIT desk and the Engulfing desk (21 Nov 2026, owner: "The same for LIT and the same for engulfing. Plenty of trades and
// same panel like ict"). One card code for both: it reads the desk's stored record (council/edge-desks.mjs -> council-data
// lit/desk.json, eg/desk.json) and draws the Open now panel, the tiles, the trades with their logs and the closed R by day,
// like the Mosha desk's trades card. "Chart" opens a trade in the Mosha desk's replay chart, moved into this desk while it is
// open. DISPLAY ONLY: no order, no storage, no council file is written; these are paper records of one reading, not a tested rule.
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  var SOP = root.MS_MOSHA_SOP; if (!SOP) return;
  var DESKS = { lit: { file: 'lit/desk.json', title: 'LIT trades', sub: 'the council\'s LIT detector on eleven markets · recorded by the desk\'s tracker like the ICT desk · paper only · each trade with its log',
      what: 'The detector reads an M15 sweep of a level out of an accumulation, then an M5 break. Each sweep is recorded under every execution that fills, each its own stream: the rule\'s own order, and two looser executions for study (a limit at the order block with no quality filters; market on the break). One position at a time per execution and market, closed at the end of the New York day. The LIT study of the rule was inconclusive.' },
    msnr: { file: 'msnr/desk.json', title: 'MSNR trades', sub: 'the owner\'s earlier scalp method on eleven markets, and the gold plan · recorded by the desk\'s tracker like the ICT desk · paper only · each trade with its log',
      what: 'Two readings. (1) The owner\'s earlier scalp method (direction call + M15 / M5 engulf), which is not an entry of the plan documents. On H4 candles with Daily key levels, a close beyond the last swing that stood before price first touched a Daily level turns the call; an entry is a 15-minute engulf, then a 5-minute engulf the same way within 45 minutes, at the next 5-minute open, stop past the trigger pair, a 6R target in the 12-16 UTC window and 3R at other hours, out after 5 days; only entries with the call are kept (12-16 UTC and other hours are listed apart). The desk\'s own study of this rule failed after costs. (2) On gold: a Daily candle rejects a Daily level and an H4 candle then breaks its last swing the same way; inside an H4 engulf zone of that side (or an opposite zone that failed) a 15- or 30-minute engulf gives a limit at its zone, stop 30 pips, target 60 pips (the owner\'s pick on the 2026 records; the plan\'s own figure is 90), at most two entries a day; a trade ends at its stop or its target. A second entry type is listed apart: the same plan with a QM on 15- or 30-minute candles (a low, a high, a lower low, a close back above that high) and a limit at the first low\'s candle, sharing the two-a-day limit; the QM\'s exact shape is read from a sketch, so it is the desk\'s reading. A "strong" H4 break is not defined, so any close beyond the last H4 level counts; Daily open-close levels (two same-colour candles) count as key levels.' },
    eg: { file: 'eg/desk.json', title: 'Engulfing trades', sub: 'the engulf rule on D1, H4 and H1 candles, three zone methods and the three-timeframe SOP, on five markets · recorded by the desk\'s tracker like the ICT desk · paper only · each trade with its log',
      what: 'The rule is the live Gold daily engulf: a candle closes beyond the last opposite candle of the three before it, on the right side of its 20-candle average; a limit rests at that candle\'s edge with the stop past its far edge, 10R target, a 1R trail from +2R, out after 10 candles (on D1 and H4 this desk takes a plain 4R target instead, the owner\'s pick on the 2026 records). The council trades it on gold\'s daily candles, buys only; the H4 and H1 readings, the sells and the other markets are this desk\'s own choice. The rule\'s book study did not pass its bar. Three zone methods are listed beside it, each with a 30-pip stop on gold\'s scale: the plan (the Daily\'s last engulf gives the side; in an H4 engulf zone of that side, or an opposite H4 zone that failed, a 15- or 30-minute engulf, then on 5-minute candles an opposite zone fails and a limit rests at the 5-minute engulf zone behind it), the short method (the same entry where the Daily is not on that side) and the direct entry (a fresh H4 zone left alone for two H4 candles, a fresh H1 zone inside it, a fresh 15-minute zone inside that, a limit at the 15-minute zone, no target: the stop trails behind each 5-minute engulf zone of the other side that fails). The plan and the short method take the target the owner picked for each on the 2026 records (1R; the short method with the next-candle engulf 4R). A method trade ends at its stop or its target (the direct entry at its trailed stop): there is no time limit. The three-timeframe SOP is listed apart, on three chains tagged swing (Daily zone, H4 engulf, H1 confirmation), intraday (H4, H1, M15) and scalp (H1, M15, M5): an engulf zone on the first timeframe still standing, price back in it and an engulf of the same side at it on the second, then an engulf of the same side at that one on the third, each completed by the first, second or third candle after its first candle; a limit rests at the middle (50 %) of the last zone, the stop sits past the far side of the second timeframe\'s zone, the target is 2R, and a trade ends at its stop or its target. The desk\'s own choices there: the confirmation must come within 24 candles, the order lives 24 candles, the target is exactly 2R, one position at a time a chain.' } };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fR = function (v) { return v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'R'; };
  var utc = function (s) { return s ? new Date(s * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'; };
  var word = function (d) { return d > 0 ? 'buy' : 'sell'; };
  var mk = function (r) { return SOP.ALL[r.market] ? r.market : 'xau'; }, fP = function (r, v) { return SOP.fmt(mk(r))(v); }, nm = function (r) { return SOP.ALL[mk(r)].name; };
  var EXIT = { target: 'target', stopped: 'stopped', trail: 'trailing stop', time: 'time limit', breakeven: 'break-even', dayend: 'day end' };
  var ST = {};
  function st(k) { return ST[k] || (ST[k] = { state: 'idle', rows: null, file: null, open: {}, kind: 'all', mk: 'all', src: 'both', all: false }); }
  function visible() { var ds = document.documentElement.dataset; return ds.role !== 'public'; }
  function load(k) {
    var S = st(k), D = root.msData; if (S.state === 'busy') return; S.state = 'busy'; draw(k);
    Promise.resolve(D && D.json ? D.json(DESKS[k].file) : null).then(function (j) {
      if (j && Array.isArray(j.records)) { S.rows = j.records.slice().sort(function (a, b) { return b.t - a.t; }); S.file = { at: j.at, since: j.since, detail: j.detail || null }; S.state = 'done'; } else S.state = 'failed';
    }, function () { S.state = 'failed'; }).then(function () { draw(k); });
  }
  function openCard(r) {
    var nt = r.target == null, tR = nt ? 3 : Math.abs(r.target - r.entry) / r.r0, fl = r['float'], hi = Math.max(3, Math.min(10, Math.ceil(tR))), lo = -1;
    var pc = function (v) { return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1); }, z = pc(0);
    var fill = fl == null ? '' : '<i class="' + (fl >= 0 ? 'up' : 'dn') + '" style="left:' + (fl >= 0 ? z : pc(fl)) + '%;width:' + Math.abs(pc(fl) - z).toFixed(1) + '%"></i>';
    return '<li data-dk-chart="' + esc(r.id) + '" tabindex="0" role="button" aria-label="' + esc(word(r.side) + ' ' + nm(r) + ', ' + (fl == null ? 'no reading yet' : fR(fl) + ' at the last reading') + ', open, view the chart') + '">' +
      '<div class="r1"><span class="chip ' + word(r.side) + '">' + word(r.side) + '</span><b class="mk">' + esc(nm(r)) + '</b><span class="pl">' + esc(r.label || r.kind) + '</span>' + (r.src ? '<span class="pl">' + (r.src === 'live' ? 'live' : 'replay') + '</span>' : '') +
      '<span class="live ' + (fl == null ? '' : fl >= 0 ? 'pos' : 'neg') + '">' + (fl == null ? '<small>no reading yet</small>' : fR(fl) + '<small>at the last reading</small>') + '</span></div>' +
      '<div class="trk" aria-hidden="true">' + fill + '<span style="left:' + z + '%"></span>' + (nt ? '' : '<span style="left:' + pc(Math.min(hi, tR)) + '%"></span>') + '</div>' +
      '<div class="trk-l" aria-hidden="true"><span style="left:0">' + (hi > 5 ? '−1R' : '−1R stop') + '</span><span style="left:' + z + '%">' + (hi > 5 ? '' : '0') + '</span><span style="left:100%">' + (!nt && tR <= hi ? 'target ' : '') + '+' + hi + 'R</span></div>' +
      '<dl><div><dt>Entry</dt><dd>' + fP(r, r.entry) + '</dd></div><div><dt>Stop</dt><dd>' + fP(r, r.stop) + (r.stopNow != null && r.stopNow !== r.stop ? ' · now ' + fP(r, r.stopNow) : '') + '</dd></div><div><dt>Target</dt><dd>' + (nt ? 'none · the stop trails' : fP(r, r.target) + ' · ' + tR.toFixed(1) + 'R') + '</dd></div><div><dt>Best so far</dt><dd>' + (r.mfe != null ? '+' + (+r.mfe).toFixed(2) + 'R' : '—') + '</dd></div></dl>' +
      '<p class="nt">Open since ' + utc(r.t) + ' · risk ' + SOP.unit(mk(r)) + fP(r, r.r0) + '</p></li>';
  }
  function rowHTML(S, r) {
    var res = r.R == null ? '<b>Open</b>' + (r['float'] != null ? ' · ' + fR(r['float']) + ' now' : '') : '<b class="' + (r.R > 0 ? 'pos' : r.R < 0 ? 'neg' : '') + '">' + fR(r.R) + '</b> · ' + (EXIT[r.status] || esc(r.status));
    var op = !!S.open[r.id];
    return '<tr><td class="mo-c-time"><span class="mo-when">' + utc(r.t) + '</span><small>' + esc(r.label || r.kind) + (r.style ? ' · ' + esc(r.style) : '') + ' · ' + esc(nm(r)) + '</small></td>' +
      '<td class="mo-c-side"><span class="chip ' + word(r.side) + '">' + word(r.side) + '</span>' + (r.src ? ' <small class="mo-sop-src">' + (r.src === 'live' ? 'live' : 'replay') + '</small>' : '') + '</td>' +
      '<td class="n" data-l="Entry">' + fP(r, r.entry) + '</td><td class="n" data-l="Stop">' + fP(r, r.stop) + '</td><td class="n" data-l="Target">' + (r.target == null ? '—' : fP(r, r.target)) + '</td>' +
      '<td class="mo-c-res"><div class="mo-ex">' + res + '<small>' + (r.endT ? 'ended ' + utc(r.endT) + ' · ' : '') + 'risk ' + SOP.unit(mk(r)) + fP(r, r.r0) + '</small></div>' +
      '<div class="mo-sop-a"><button type="button" class="mo-sop-b" data-dk-log="' + esc(r.id) + '" aria-expanded="' + op + '">' + (op ? 'Hide the log' : 'Log') + '</button><button type="button" class="mo-sop-b" data-dk-chart="' + esc(r.id) + '">Chart</button></div>' +
      (op ? '<ol class="mo-sop-log">' + (r.log ? (r.noDetail ? '<li>The log of this trade could not be read.</li>' : '') + r.log.map(function (x) { return '<li>' + (x.t ? '<span>' + utc(x.t) + '</span> ' : '') + esc(x.text) + '</li>'; }).join('') : '<li>Reading the log…</li>') + '</ol>' : '') + '</td></tr>';
  }
  function draw(k) {
    var S = st(k), D = DESKS[k], view = $('v-' + k); if (!view) return;
    var ob = view.querySelector('[data-dk="open"]'), tb = view.querySelector('[data-dk="trades"]'); if (!ob || !tb) return;
    var ok = visible(); ob.hidden = tb.hidden = !ok; if (!ok) return;
    var head = '<div class="ms-k"><span>' + esc(D.title) + '</span><small>' + esc(D.sub) + '</small></div>', ol = ob.querySelector('ul'), on = ob.querySelector('.ms-k small');
    if (S.state !== 'done') { var msg = S.state === 'failed' ? 'The tracker has not stored trades for this desk yet, or they could not be read. <button type="button" class="mo-sop-b" data-dk-run>Try again</button>' : 'Reading the trades…';
      tb.innerHTML = head + '<div class="ct-empty">' + msg + '</div>'; ol.innerHTML = '<li class="empty">' + (S.state === 'failed' ? 'The open trades could not be read.' : 'Reading the open trades…') + '</li>'; on.textContent = ''; return; }
    var every = S.rows, bySrc = S.src === 'both' ? every : every.filter(function (r) { return (r.src === 'live') === (S.src === 'live'); }), nLive = every.filter(function (r) { return r.src === 'live'; }).length;
    var mks = Object.keys(SOP.ALL).filter(function (m) { return bySrc.some(function (r) { return mk(r) === m; }); }), byMk = S.mk === 'all' || mks.indexOf(S.mk) < 0 ? bySrc : bySrc.filter(function (r) { return mk(r) === S.mk; });
    var kinds = []; byMk.forEach(function (r) { if (kinds.indexOf(r.kind) < 0) kinds.push(r.kind); }); kinds.sort();
    var KN = { 'eg-sop3': 'Three-timeframe SOP' };   // a kind whose rows carry different labels (one a chain) gets one name on its filter chip
    var kl = function (kd) { if (KN[kd]) return KN[kd]; var r = byMk.filter(function (x) { return x.kind === kd; })[0]; return r ? (r.label || kd) : kd; };
    var list = S.kind === 'all' || kinds.indexOf(S.kind) < 0 ? byMk : byMk.filter(function (r) { return r.kind === S.kind; }), shown = S.all ? list : list.slice(0, 30);
    var open = every.filter(function (r) { return r.R == null; }), last = every[0], at = S.file && S.file.at ? utc(Math.floor(Date.parse(S.file.at) / 1000)) : '';
    on.textContent = open.length ? open.length + ' open · paper only' + (at ? ' · last reading ' + at : '') : '';
    ol.innerHTML = open.length ? open.map(openCard).join('') : '<li class="empty">No trade is open now. The tracker reads these markets about every 35 minutes' + (at ? ' (last reading ' + at + ')' : '') + '; a new entry shows here until it closes.</li>';
    if (SOP.openMore) SOP.openMore(ob, open.length);
    var btn = function (attr, v, t, n, cur) { return '<button type="button" class="mo-sop-b" ' + attr + '="' + esc(v) + '" aria-pressed="' + (cur === v) + '">' + esc(t) + ' (' + n + ')</button>'; };
    var sm = SOP.summary(list), tile = function (a, v, sub, cls) { return '<div class="mo-sop-tile"><small>' + a + '</small><b' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</b><span>' + sub + '</span></div>'; };
    var cal = SOP.calHTML(list, S, 'data-dk-chart', function (r) { return nm(r) + ' · ' + (r.label || r.kind); });
    tb.innerHTML = head + '<p class="mo-sop-ans">' + esc((open.length ? open.length + (open.length === 1 ? ' trade is' : ' trades are') + ' open now. ' : 'No trade is open now. ') + (last ? 'Latest entry: ' + nm(last) + ' ' + word(last.side) + ' at ' + fP(last, last.entry) + ', ' + utc(last.t) + '.' : '')) + '</p>' +
      '<div class="mo-sop-a mo-sop-f">' + btn('data-dk-kind', 'all', 'All', byMk.length, S.kind === 'all' || kinds.indexOf(S.kind) < 0 ? 'all' : S.kind) + kinds.map(function (kd) { return btn('data-dk-kind', kd, kl(kd), byMk.filter(function (r) { return r.kind === kd; }).length, S.kind); }).join('') +
      '<span class="mo-sop-sep" aria-hidden="true"></span>' + btn('data-dk-src', 'both', 'Both', every.length, S.src) + btn('data-dk-src', 'live', 'Live', nLive, S.src) + btn('data-dk-src', 'replay', 'Replay', every.length - nLive, S.src) + '<button type="button" class="mo-sop-b" data-dk-run>Refresh</button></div>' +
      (mks.length > 1 ? '<div class="mo-sop-a mo-sop-f">' + btn('data-dk-mk', 'all', 'All markets', bySrc.length, S.mk === 'all' || mks.indexOf(S.mk) < 0 ? 'all' : S.mk) + mks.map(function (m) { return btn('data-dk-mk', m, SOP.ALL[m].name, bySrc.filter(function (r) { return mk(r) === m; }).length, S.mk); }).join('') + '</div>' : '') +
      '<p class="ms-note mo-sop-st">Recorded by the tracker in the council loop, about every 35 minutes' + (at ? ' · last run ' + at : '') + (S.file.since ? ' · trades since ' + utc(S.file.since).slice(0, 10) : '') + '. Live = the tracker recorded it within an hour of its entry; Replay = worked out afterwards from the same closed candles.</p>' +
      '<div class="mo-sop-tiles">' + tile('Entries', sm.n, sm.open + ' open') + tile('Closed in profit', sm.closed ? sm.wins + ' of ' + sm.closed : '—', sm.closed ? Math.round(100 * sm.wins / sm.closed) + '% of closed' : 'none closed') +
      tile('Total, before costs', sm.closed ? fR(sm.total) : '—', sm.closed ? fR(sm.mean) + ' a trade' : 'none closed', sm.total > 0 ? 'pos' : sm.total < 0 ? 'neg' : '') + tile('Can it be judged?', sm.closed < SOP.MIN_JUDGE ? 'Too few' : 'Not a test', sm.closed < SOP.MIN_JUDGE ? sm.closed + ' of ' + SOP.MIN_JUDGE + ' closed' : 't ' + (sm.t == null ? 'n/a' : sm.t.toFixed(2)) + ' · a paper record') + '</div>' +
      '<h3 class="mo-sop-h">Trades</h3>' + (shown.length ? '<div class="ct-tw"><table class="ct-t mo-t" aria-label="' + esc(D.title) + '"><thead><tr><th>Entry time</th><th>Side</th><th class="n">Entry</th><th class="n">Stop</th><th class="n">Target</th><th>Result and log</th></tr></thead><tbody>' + shown.map(function (r) { return rowHTML(S, r); }).join('') + '</tbody></table></div>' +
        (list.length > shown.length ? '<p class="ms-note"><button type="button" class="mo-sop-b" data-dk-all>Show all ' + list.length + '</button></p>' : '') : '<div class="ct-empty">No trade to show.</div>') + cal +
      '<details class="mo-sop-more"><summary>What this is</summary><p class="ms-note">' + esc(D.what) + '</p><p class="ms-note">A paper record: every step uses closed candles only, results are before costs, a stop is counted first when one candle holds both. Nothing was traded, and a record of one reading cannot show whether a rule makes money. On a market other than gold the stop buffer and size limits are the same share of price as on gold: the desk\'s own choice.</p></details>';
  }
  // the one replay chart of the page lives on the Mosha desk: it is lent to the desk that opens a trade and put back when Mosha opens
  function borrowChart(k) { var rp = $('mo-replay'), slot = $('v-' + k) && $('v-' + k).querySelector('[data-dk="chart"]'); if (!rp || !slot) return false;
    if (!$('mo-replay-home')) { var h = document.createElement('span'); h.id = 'mo-replay-home'; h.hidden = true; rp.parentNode.insertBefore(h, rp); }
    if (rp.parentNode !== slot) slot.appendChild(rp); return true; }
  function returnChart() { var rp = $('mo-replay'), h = $('mo-replay-home'); if (rp && h && rp.previousSibling !== h) h.parentNode.insertBefore(rp, h.nextSibling); }
  function deskOf(el) { var v = el.closest ? el.closest('#v-lit, #v-eg, #v-msnr') : null; return v ? v.id.slice(2) : null; }
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('li[data-dk-chart]')) { e.preventDefault(); e.target.click(); } });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-cal-m], [data-cal-day], [data-dk-log], [data-dk-chart], [data-dk-kind], [data-dk-mk], [data-dk-src], [data-dk-run], [data-dk-all]') : null; if (!b) return; var k = deskOf(b); if (!k) return; var S = st(k);
    if (b.hasAttribute('data-cal-m')) { if (b.getAttribute('data-cal-m')) { S.calM = b.getAttribute('data-cal-m'); S.calDay = null; draw(k); } return; }
    if (b.hasAttribute('data-cal-day')) { var cd = b.getAttribute('data-cal-day'); S.calDay = S.calDay === cd ? null : cd; draw(k); var nd = $('v-' + k).querySelector('[data-cal-day="' + cd + '"]'); if (nd) nd.focus(); return; }
    if (b.hasAttribute('data-dk-run')) { S.all = false; S.state = 'idle'; load(k); return; }
    if (b.hasAttribute('data-dk-all')) { S.all = true; draw(k); return; }
    if (b.hasAttribute('data-dk-kind')) { S.kind = b.getAttribute('data-dk-kind'); S.all = false; draw(k); return; }
    if (b.hasAttribute('data-dk-mk')) { S.mk = b.getAttribute('data-dk-mk'); S.all = false; draw(k); return; }
    if (b.hasAttribute('data-dk-src')) { S.src = b.getAttribute('data-dk-src'); S.all = false; draw(k); return; }
    var id = b.getAttribute('data-dk-log') || b.getAttribute('data-dk-chart'), r = (S.rows || []).filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var fileD = S.file && S.file.detail;
    if (b.hasAttribute('data-dk-log')) { S.open[id] = !S.open[id]; var refocus = function () { draw(k); var nb = $('v-' + k).querySelector('[data-dk-log="' + (root.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); if (nb) nb.focus(); };
      refocus(); if (S.open[id] && !r.log) SOP.withDetail(fileD, r).then(refocus); return; }
    SOP.withDetail(fileD, r).then(function (r) {
    var T = { replayed: true, name: (r.label || r.kind) + ' · ' + nm(r), marks: r.marks || [], steps: (r.log || []).filter(function (x) { return x.t; }), id: r.id, market: mk(r), side: word(r.side), at: r.t, entry: +fP(r, r.entry), stop: +fP(r, r.stop), target: r.target == null ? null : +fP(r, r.target), status: r.R != null ? 'closed' : 'open', exit: r.exit != null ? +fP(r, r.exit) : null, exitAt: r.endT, R: r.R, how: r.status };
    // the chart opens over the page (the replay card in a dialog inside this desk's view), never by scrolling down to it
    if (typeof root.msMoshaReplayDialog === 'function') root.msMoshaReplayDialog(T, $('v-' + k)); else if (typeof root.msMoshaReplayTrade === 'function' && borrowChart(k)) root.msMoshaReplayTrade(T);
    });
  });
  // the Mosha desk's styles serve these desks too: its sheet is copied once with the view's id in place of #v-mosha
  function styles() { if ($('ms-dk2-css')) return; var src = $('ms-mosha-css'); if (!src) return; var el = document.createElement('style'); el.id = 'ms-dk2-css';
    el.textContent = ['#v-lit', '#v-eg', '#v-msnr'].map(function (v) { return src.textContent.replace(/#v-mosha/g, v); }).join('\n');
    el.textContent += '\n:is(#v-lit, #v-eg, #v-msnr) #mo-replay :is(#mo-rp-pick, .mo-rp-leg, .mo-rp-leg ~ .ms-note) { display: none; }';   /* the Mosha examples' picker and legend do not belong to another desk's trade */ document.head.appendChild(el); }
  root.renderEdgeDesk = function (k) { if (!DESKS[k]) return; styles(); var S = st(k); if (S.state === 'idle' || S.state === 'failed') load(k); else draw(k); };
  var prev = root.renderMosha; root.renderMosha = function () { returnChart(); if (prev) prev.apply(this, arguments); };
  root.MS_EDGE_DESKS = { desks: Object.keys(DESKS), state: function (k) { var S = st(k); return { state: S.state, n: S.rows ? S.rows.length : 0 }; } };
  var cur = document.documentElement.dataset.view; if (DESKS[cur]) root.renderEdgeDesk(cur);
})(typeof window !== 'undefined' ? window : globalThis);

// Mosha desk, teaching (owner, 10 Nov 2026: the Mosha desk "will be main page of" Luxus, "he will train u, allow him to send
// you trades images so u can learn"; then "He needs to be 100% teachable"). Everything a teacher does here, and everything the
// desk gives back so the teacher can check it:
//   - a lesson: a trade as screenshots with a caption each, or in words only, with the trade's own levels when the teacher has them;
//   - the conversation under it: the desk writes what it understood, the teacher says "right" or "not right" and why, the desk
//     answers again; "See it on the chart" opens the desk's reading (or the levels) in the replay above;
//   - the book, "What the desk knows": terms, steps, rules and things to avoid. The desk proposes lines; the teacher confirms,
//     corrects or erases them, or writes one directly. A confirmed or corrected line is the teacher's word.
// The server (api/mosha-lessons.js) decides who may do what and checks every picture and level; this file only draws.
// Pure pieces are on MS_MOSHA_TEACH and tested in tests/mosha-lessons.test.mjs. Lessons only: nothing here places a trade.
(function (root) {
  'use strict';
  var MAX_SIDE = 1800, MAX_PICK = 8, MAX_BYTES = 1.4 * 1024 * 1024;
  // the size a picture is sent at: the longer side at most `max`, never enlarged
  function fit(w, h, max) { var k = Math.min(1, max / Math.max(w, h, 1)); return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }; }
  // a first caption from the file name, when the name says something ("m5 vr.png" does, "IMG_2041.jpg" does not)
  function captionOf(name) {
    var s = String(name || '').replace(/\.[A-Za-z0-9]{2,5}$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || /^(img|image|photo|screenshot|screen shot|capture|pxl|dsc|wa\d*|whatsapp image|telegram|signal|file)\b/i.test(s) || /^[\d\s.:()at]+$/i.test(s) || !/[A-Za-z]{2}/.test(s)) return '';
    return s.slice(0, 200);
  }
  // Where a lesson stands (the same rule as the server's stateOf): new = the desk has not answered; more = the teacher added
  // something or said "not right", so the desk owes an answer; read = the desk answered and waits for the teacher's word;
  // agreed = the teacher said it is right.
  function stateOf(l) {
    var th = l.thread || [], la = null, i; for (i = th.length - 1; i >= 0; i--) if (th[i].by === 'assistant') { la = th[i]; break; }
    if (!la) return 'new'; if ((la.shots || 0) < (l.shots || []).length || la.verdict === 'wrong') return 'more';
    if (th.slice(i + 1).some(function (m) { return !(la.verdict === 'right' && la.vat && m.at <= la.vat); })) return 'more';
    return la.verdict === 'right' ? 'agreed' : 'read';
  }
  var STATE = { 'new': 'Not read yet', more: 'Waiting for the desk', read: 'The desk answered: is it right?', agreed: 'Understood' };
  var KIND = { term: 'Terms', step: 'Steps', rule: 'Rules', avoid: 'What to avoid' }, KINDS = ['term', 'step', 'rule', 'avoid'];
  function summary(list) { var shots = 0, c = { 'new': 0, more: 0, read: 0, agreed: 0 }; (list || []).forEach(function (l) { shots += (l.shots || []).length; c[stateOf(l)]++; }); return { lessons: (list || []).length, shots: shots, unread: c['new'] + c.more, toJudge: c.read, agreed: c.agreed }; }
  // the one line over the lessons: how many, where they stand, and how often the desk was right first time
  function scoreLine(s) {
    if (!s || !s.lessons) return '';
    var out = [s.lessons + (s.lessons === 1 ? ' lesson' : ' lessons'), s.agreed + ' understood']; if (s.waiting) out.push(s.waiting + ' waiting for the desk');
    out.push(s.judged ? 'right first time ' + s.right + ' of ' + s.judged : 'none judged yet'); return out.join(' · ');
  }
  function bookLine(book) { var n = (book || []).length, t = (book || []).filter(function (b) { return b.status !== 'proposed'; }).length; return n ? n + (n === 1 ? ' line' : ' lines') + ' · ' + t + ' in the teacher\'s words · ' + (n - t) + ' still the desk\'s own reading' : ''; }
  var bookGroups = function (book) { return KINDS.map(function (k) { return { kind: k, name: KIND[k], items: (book || []).filter(function (b) { return b.kind === k; }) }; }).filter(function (g) { return g.items.length; }); };
  // the trade a teacher typed with a lesson: null when the fold was left empty; times are the teacher's local clock
  function tradeFrom(v) {
    if (!v || (!v.side && !v.entry && !v.stop && !v.target)) return null;
    var at = v.at ? Math.floor(new Date(v.at).getTime() / 1000) : null; return { market: v.market || 'xau', side: v.side || '', entry: v.entry, stop: v.stop, target: v.target || '', at: at };
  }
  // base64 length of a data URL -> bytes
  function bytesOf(dataUrl) { var i = String(dataUrl).indexOf(','), b = String(dataUrl).length - i - 1; return i < 0 ? 0 : Math.floor(b * 3 / 4); }
  var API = { MAX_SIDE: MAX_SIDE, MAX_PICK: MAX_PICK, fit: fit, captionOf: captionOf, stateOf: stateOf, STATE: STATE, KIND: KIND, summary: summary, scoreLine: scoreLine, bookLine: bookLine, bookGroups: bookGroups, tradeFrom: tradeFrom, bytesOf: bytesOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_MOSHA_TEACH = API;
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var URL_ = '/api/mosha-lessons', T = { lessons: null, book: [], score: null, canTeach: false, who: null, picks: [], busy: false, open: null, loading: false, err: null };
  var day = function (iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
  var api = function (body) { return fetch(URL_, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || (r.status === 429 ? 'too many requests: wait a minute' : r.status === 413 ? 'that picture is too large' : 'the desk did not take it (' + r.status + ')')); return j; }); }); };
  var mine = function (l) { return T.who === 'owner' || (T.canTeach && l.by === T.who); };
  var byId = function (id) { return (T.lessons || []).filter(function (x) { return x.id === id; })[0] || null; };

  function load() {
    if (T.loading) return; T.loading = true;
    fetch(URL_, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'the lessons could not be read'); }); })
      .then(function (j) { T.lessons = Array.isArray(j.lessons) ? j.lessons : []; T.book = Array.isArray(j.book) ? j.book : []; T.score = j.score || null; T.canTeach = !!j.canTeach; T.who = j.who || null; T.err = null; })
      .catch(function (e) { T.err = e.message || 'the lessons could not be read'; })
      .then(function () { T.loading = false; draw(); });
  }
  var utc = function (t) { return new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; };
  function talkHTML(l, own) {
    var th = l.thread || [], st = stateOf(l), la = null; th.forEach(function (m) { if (m.by === 'assistant') la = m; });
    var rows = th.map(function (m) { var desk = m.by === 'assistant';
      return '<li class="' + (desk ? 'mo-l-desk' : 'mo-l-you') + '"><b>' + (desk ? 'The desk understood' : esc(m.name || m.by)) + '</b><small>' + esc(day(m.at)) + '</small><p>' + esc(m.text) + '</p>' + (desk && m.verdict ? '<span class="mo-l-v mo-l-v-' + m.verdict + '">' + (m.verdict === 'right' ? 'Marked right' : 'Marked not right') + '</span>' : '') + '</li>'; }).join('');
    return '<div class="mo-l-reply"><ol class="mo-l-talk">' + (rows || '<li class="mo-l-desk"><p class="mo-l-wait">The desk has not read this lesson yet.</p></li>') + '</ol>'
      + (own && la && st === 'read' ? '<div class="mo-l-judge"><span>Did the desk get it right?</span><button type="button" class="ms-tbtn mo-l-yes" data-right="' + esc(l.id) + '">That is right</button><button type="button" class="ms-tbtn" data-wrong="' + esc(l.id) + '">Not right…</button></div>' : '')
      + (own ? '<form class="mo-l-say" data-say="' + esc(l.id) + '"><label class="mo-f"><span>' + (la ? 'Tell the desk more, or correct it' : 'Add words for the desk') + '</span><textarea name="text" rows="2" maxlength="2000" placeholder="' + (la ? 'The VR starts at the high, not at…' : 'What else should it see here?') + '"></textarea></label><button type="submit" class="ms-tbtn">Send</button></form>' : '')
      + '</div>';
  }
  function lessonHTML(l, open) {
    var st = stateOf(l), own = mine(l), t = l.trade, n = l.shots.length, canChart = !!(l.chart || t);
    return '<details class="mo-l" data-id="' + esc(l.id) + '"' + (open ? ' open' : '') + '><summary><span class="mo-l-t">' + esc(l.title) + '</span><span class="mo-l-m">' + esc(l.name || l.by) + ' · ' + esc(day(l.at)) + ' · ' + (n ? n + (n === 1 ? ' picture' : ' pictures') : 'in words') + '</span><span class="mo-l-st mo-l-' + st + '">' + STATE[st] + '</span></summary>'
      + '<div class="mo-l-b">' + (l.note ? '<p class="mo-l-note">' + esc(l.note) + '</p>' : '')
      + (t ? '<p class="mo-l-trade"><b>' + (t.side === 'sell' ? 'Sell' : 'Buy') + ' ' + esc(t.entry) + '</b> · stop ' + esc(t.stop) + (t.target != null ? ' · target ' + esc(t.target) : '') + ' · ' + esc(String(t.market || '').toUpperCase()) + ' · ' + esc(utc(t.at)) + (t.exit != null ? ' · closed ' + esc(t.exit) + ' (' + (t.R > 0 ? '+' : '') + esc(t.R) + 'R)' : '') + (t.src === 'replay' ? ' · <span class="mo-l-src">from a ChronosTrade replay' + (t.tf ? ', ' + esc(t.tf) : '') + '</span>' : '') + '</p>' : '')
      + (n ? '<div class="mo-l-shots">' + l.shots.map(function (s, i) { return '<figure><button type="button" class="mo-l-img" data-img="' + esc(s.img) + '" aria-label="Open picture ' + (i + 1) + (s.caption ? ': ' + esc(s.caption) : '') + '"><img alt="' + esc(s.caption || 'Trade screenshot ' + (i + 1)) + '" data-src="' + URL_ + '?img=' + encodeURIComponent(s.img) + '" width="320" height="200" decoding="async"></button><figcaption>' + (s.caption ? esc(s.caption) : '<i>no caption</i>') + (own ? ' <button type="button" class="mo-l-x" data-cap="' + esc(s.img) + '">Caption</button><button type="button" class="mo-l-x" data-rm-img="' + esc(s.img) + '">Remove</button>' : '') + '</figcaption></figure>'; }).join('') + '</div>' : '')
      + (canChart ? '<div class="mo-l-acts"><button type="button" class="ms-tbtn mo-l-chart" data-chart="' + esc(l.id) + '">' + (l.chart ? 'See the desk\'s reading on the chart' : 'See the levels on the chart') + '</button></div>' : '')
      + talkHTML(l, own)
      + (own ? '<div class="mo-l-acts"><button type="button" class="ms-tbtn" data-more="' + esc(l.id) + '">Add pictures</button><button type="button" class="ms-tbtn" data-note="' + esc(l.id) + '">Edit the note</button><button type="button" class="ms-tbtn" data-levels="' + esc(l.id) + '">' + (t ? 'Change the levels' : 'Give the levels') + '</button><button type="button" class="ms-tbtn" data-rm="' + esc(l.id) + '">Remove the lesson</button></div>' : '')
      + '</div></details>';
  }
  function showImgs(det) { Array.prototype.forEach.call(det.querySelectorAll('img[data-src]'), function (im) { if (im.getAttribute('src')) return; im.onerror = function () { if (im.dataset.retry) { im.alt = 'This picture could not be loaded'; return; } im.dataset.retry = '1'; setTimeout(function () { im.src = im.dataset.src + '&r=1'; }, 20000); }; im.src = im.dataset.src; }); }
  function bookHTML() {
    var can = T.canTeach, g = bookGroups(T.book);
    return (g.length ? g.map(function (grp) { return '<section class="mo-b-g"><h3>' + grp.name + '</h3><ul>' + grp.items.map(function (b) {
      var chip = b.status === 'proposed' ? '<span class="mo-b-s mo-b-prop">The desk\'s reading, not confirmed</span>' : b.status === 'corrected' ? '<span class="mo-b-s mo-b-ok">Corrected by the teacher</span>' : '<span class="mo-b-s mo-b-ok">' + (b.by === 'assistant' ? 'Confirmed' : 'Taught by ' + esc(b.name || b.by)) + '</span>';
      return '<li data-b="' + esc(b.id) + '"><p>' + esc(b.text) + '</p>' + chip + (b.was ? '<small>The desk had: ' + esc(b.was) + '</small>' : '')
        + (can ? '<span class="mo-b-acts">' + (b.status === 'proposed' ? '<button type="button" class="mo-l-x" data-b-ok="' + esc(b.id) + '">Right</button>' : '') + '<button type="button" class="mo-l-x" data-b-fix="' + esc(b.id) + '">' + (b.status === 'proposed' ? 'Correct' : 'Change') + '</button><button type="button" class="mo-l-x" data-b-rm="' + esc(b.id) + '">Erase</button></span>' : '') + '</li>'; }).join('') + '</ul></section>'; }).join('')
      : '<div class="ct-empty">The book is empty. ' + (can ? 'Teach the first line below.' : 'It fills as the teacher teaches.') + '</div>')
      + (can ? '<form class="mo-b-add" id="mo-b-form"><label class="mo-f"><span>Teach a line</span><select name="kind" aria-label="What kind of line"><option value="rule">Rule</option><option value="term">Term</option><option value="step">Step</option><option value="avoid">What to avoid</option></select></label><label class="mo-f mo-b-text"><span>In your words</span><input type="text" name="text" maxlength="600" placeholder="Never sell before the M5 CF closes."></label><button type="submit" class="ms-tbtn">Teach it</button></form>' : '');
  }
  function draw() {
    var card = $('mo-lessons'), body = $('mo-l-body'), teach = $('mo-teach'), bk = $('mo-b-body'); if (!card || !body) return;
    if (teach) teach.hidden = !T.canTeach;
    var sub = $('mo-l-sub'), keyBox = $('mo-l-key'); if (keyBox) keyBox.hidden = T.who !== 'owner';
    if (T.err && !T.lessons) { body.innerHTML = '<div class="ct-empty">' + esc(T.err.charAt(0).toUpperCase() + T.err.slice(1)) + '.</div>'; if (sub) sub.textContent = ''; if (bk) bk.innerHTML = ''; return; }
    if (!T.lessons) return;
    if (sub) sub.textContent = scoreLine(T.score);
    var openId = T.open || (T.lessons[0] && T.lessons[0].id), keep = {};   // what the teacher is typing survives a redraw
    Array.prototype.forEach.call(body.querySelectorAll('form.mo-l-say'), function (f) { if (f.elements.text.value) keep[f.dataset.say] = f.elements.text.value; });
    body.innerHTML = T.lessons.length ? T.lessons.map(function (l) { return lessonHTML(l, l.id === openId); }).join('')
      : '<div class="ct-empty">' + (T.canTeach ? 'No lessons yet. Send your first trade above: the screenshots, or just words, and what the desk should see in them.' : 'No lessons yet. They appear here when the desk\'s teacher sends a trade.') + '</div>';
    Array.prototype.forEach.call(body.querySelectorAll('details.mo-l'), function (d) { if (d.open) showImgs(d); d.addEventListener('toggle', function () { if (d.open) { T.open = d.dataset.id; showImgs(d); } }); });
    Array.prototype.forEach.call(body.querySelectorAll('form.mo-l-say'), function (f) { if (keep[f.dataset.say]) f.elements.text.value = keep[f.dataset.say]; });
    if (bk) { var typed = $('mo-b-form') && $('mo-b-form').elements.text.value; bk.innerHTML = bookHTML(); if (typed && $('mo-b-form')) $('mo-b-form').elements.text.value = typed; var bs = $('mo-b-sub'); if (bs) bs.textContent = bookLine(T.book); }
    var sel = document.querySelector('#mo-t-form select[name="lesson"]'); if (sel) { var cur = sel.value; sel.innerHTML = '<option value="">A new lesson</option>' + T.lessons.filter(mine).map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.title) + '</option>'; }).join(''); if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur; }
  }

  // ─── sending ───
  function say(txt, bad) { var m = $('mo-t-msg'); if (m) { m.textContent = txt || ''; m.classList.toggle('mo-err-t', !!bad); } }
  function canSend() { var f = $('mo-t-form'); return !!f && !T.busy && (T.picks.length > 0 || (!f.elements.lesson.value && f.elements.title.value.trim() && f.elements.note.value.trim())); }
  function drawPicks() {
    var ol = $('mo-t-picks'), send = $('mo-t-send'); if (!ol) return;
    ol.innerHTML = T.picks.map(function (p, i) { return '<li><img src="' + esc(p.url) + '" alt="" width="96" height="60"><label class="mo-f"><span>Caption for picture ' + (i + 1) + '</span><input type="text" maxlength="200" data-pick="' + i + '" value="' + esc(p.caption) + '" placeholder="M5 vr · M30 sweep high · entry after BO sell"></label><button type="button" class="ms-tbtn" data-drop="' + i + '" aria-label="Take picture ' + (i + 1) + ' out">Take out</button></li>'; }).join('');
    if (send) send.disabled = !canSend();
  }
  function addFiles(files) {
    var took = 0, skipped = 0; Array.prototype.forEach.call(files || [], function (f) {
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { skipped++; return; } if (T.picks.length >= MAX_PICK) { skipped++; return; }
      T.picks.push({ file: f, url: URL.createObjectURL(f), caption: captionOf(f.name) }); took++; });
    drawPicks(); say(skipped ? (took ? 'Some files were left out: ' : 'Not added: ') + 'send PNG, JPEG or WebP pictures, ' + MAX_PICK + ' at a time.' : '', skipped && !took);
  }
  // one picture, as a JPEG data URL small enough to send (screenshots stay sharp: only the longest side is limited)
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var im = new Image(), u = URL.createObjectURL(file);
      im.onload = function () { try { var side = MAX_SIDE, q = .88, out, n = 0;
          do { var d = fit(im.naturalWidth, im.naturalHeight, side), c = document.createElement('canvas'); c.width = d.w; c.height = d.h; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, d.w, d.h); x.drawImage(im, 0, 0, d.w, d.h); out = c.toDataURL('image/jpeg', q); q -= .12; if (q < .6) { q = .8; side = Math.round(side * .8); } }
          while (bytesOf(out) > MAX_BYTES && ++n < 8);
          URL.revokeObjectURL(u); if (bytesOf(out) > MAX_BYTES) bad(new Error('that picture is too large to send')); else ok(out); } catch (e) { URL.revokeObjectURL(u); bad(new Error('that picture could not be read')); } };
      im.onerror = function () { URL.revokeObjectURL(u); bad(new Error('that file is not a picture this browser can read')); }; im.src = u; });
  }
  function levelsOf(f) { var e = f.elements; return tradeFrom({ side: e.side.value, market: e.market.value, at: e.at.value, entry: e.entry.value, stop: e.stop.value, target: e.target.value }); }
  function send(ev) {
    ev.preventDefault(); var f = $('mo-t-form'); if (!f || T.busy) return;
    var lesson = f.elements.lesson.value || null, title = f.elements.title.value.trim(), note = f.elements.note.value.trim(), total = T.picks.length, done = 0, trade = lesson ? null : levelsOf(f);
    if (!lesson && !title) { say('Name the trade first: which one is it?', true); f.elements.title.focus(); return; }
    if (!total && !(title && note)) { say(lesson ? 'Choose the pictures to add.' : 'Add a screenshot, or write what the desk should learn.', true); return; }
    if (trade && (!trade.side || !trade.entry || !trade.stop || !trade.at)) { say('The levels need a side, the entry, the stop and the entry time. Every trade has a stop.', true); return; }
    T.busy = true; drawPicks(); f.setAttribute('aria-busy', 'true');
    var first = function (extra) { var a = { lesson: lesson, title: title, note: done === 0 ? note : undefined, trade: done === 0 && trade ? trade : undefined }; for (var k in extra) a[k] = extra[k]; return api({ add: a }); };
    var next = function () {
      if (!T.picks.length) return Promise.resolve();
      var p = T.picks[0]; say('Sending picture ' + (done + 1) + ' of ' + total + '…');
      return shrink(p.file).then(function (data) { return first({ caption: p.caption, image: data }); })
        .then(function (j) { lesson = j.lesson.id; T.open = lesson; done++; URL.revokeObjectURL(p.url); T.picks.shift(); drawPicks(); return next(); });
    };
    (total ? next() : first({}).then(function (j) { T.open = j.lesson.id; }))
      .then(function () { say((total > 1 ? total + ' pictures sent.' : 'Sent.') + ' The desk will read it and write back what it understood.'); f.reset(); })
      .catch(function (e) { say((done ? done + ' of ' + total + ' sent, then: ' : 'Not sent: ') + (e.message || 'something went wrong') + '. The rest is still here; send again.', true); })
      .then(function () { T.busy = false; f.removeAttribute('aria-busy'); drawPicks(); load(); });
  }
  function ask(label, value, opt) { return root.msAsk ? root.msAsk(label, value, opt) : Promise.resolve(null); }
  function sure(msg, opt) { return root.msConfirm ? root.msConfirm(msg, opt) : Promise.resolve(false); }
  function act(p) { return p.then(function () { load(); }).catch(function (e) { if (root.msAlert) root.msAlert((e && e.message) || 'That did not work.'); load(); }); }
  function view(img) {
    var d = $('mo-l-dlg'); if (!d) { d = document.createElement('dialog'); d.id = 'mo-l-dlg'; d.className = 'mo-l-dlg'; d.innerHTML = '<form method="dialog"><button class="ms-tbtn" aria-label="Close the picture">Close</button></form><img alt=""><p></p>'; document.body.appendChild(d); d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); }
    var src = img.getAttribute('src'); if (!src) return; d.querySelector('img').src = src; d.querySelector('img').alt = img.alt; d.querySelector('p').textContent = img.alt; if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  // the levels of a lesson, given or changed afterwards (the server refuses a trade without its stop)
  function levelsDialog(l) {
    var d = $('mo-lv-dlg'); if (!d) { d = document.createElement('dialog'); d.id = 'mo-lv-dlg'; d.className = 'own-dlg mo-lv-dlg'; document.body.appendChild(d); }
    var t = l.trade || {}, loc = t.at ? new Date(t.at * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
    d.innerHTML = '<form method="dialog" class="mo-lv"><h3>The levels of this trade</h3><p class="ms-note">With them the desk can put the trade on the chart. Every trade has a stop.</p>'
      + '<label class="mo-f"><span>Side</span><select name="side"><option value="sell"' + (t.side !== 'buy' ? ' selected' : '') + '>Sell</option><option value="buy"' + (t.side === 'buy' ? ' selected' : '') + '>Buy</option></select></label>'
      + '<label class="mo-f"><span>Market</span><select name="market">' + [['xau', 'XAU/USD'], ['xag', 'XAG/USD'], ['eurusd', 'EUR/USD'], ['gbpusd', 'GBP/USD'], ['nas100', 'NAS100']].concat([['spx500', 'S&P 500'], ['us30', 'Dow 30'], ['de40', 'DAX 40'], ['usdjpy', 'USD/JPY'], ['audusd', 'AUD/USD'], ['usdcad', 'USD/CAD'], ['usdchf', 'USD/CHF'], ['nzdusd', 'NZD/USD'], ['gbpjpy', 'GBP/JPY'], ['bco', 'Brent oil'], ['wtico', 'WTI oil']].filter(function (m) { return m[0] === t.market; })).map(function (m) { return '<option value="' + m[0] + '"' + ((t.market || 'xau') === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></label>'
      + '<label class="mo-f"><span>Entry time <small>your local time</small></span><input type="datetime-local" name="at" value="' + esc(loc) + '" required></label>'
      + '<label class="mo-f"><span>Entry</span><input type="number" name="entry" inputmode="decimal" step="any" min="0" value="' + esc(t.entry != null ? t.entry : '') + '" required></label>'
      + '<label class="mo-f"><span>Stop <small>required</small></span><input type="number" name="stop" inputmode="decimal" step="any" min="0" value="' + esc(t.stop != null ? t.stop : '') + '" required></label>'
      + '<label class="mo-f"><span>Target <small>optional</small></span><input type="number" name="target" inputmode="decimal" step="any" min="0" value="' + esc(t.target != null ? t.target : '') + '"></label>'
      + '<p class="mo-err-t" id="mo-lv-msg" role="alert"></p><div class="own-acts">' + (l.trade ? '<button type="button" id="mo-lv-clear">Take the levels off</button>' : '') + '<button type="button" id="mo-lv-cancel">Cancel</button><button type="submit" class="pri">Save</button></div></form>';
    var f = d.querySelector('form'), msg = d.querySelector('#mo-lv-msg');
    f.onsubmit = function (ev) { ev.preventDefault(); api({ edit: { id: l.id, trade: Object.assign({}, l.trade ? { exit: l.trade.exit, exitAt: l.trade.exitAt, tf: l.trade.tf, src: l.trade.src } : {}, levelsOf(f) || {}) } }).then(function () { d.close(); load(); }).catch(function (e) { msg.textContent = (e.message || 'Not saved').replace(/^./, function (c) { return c.toUpperCase(); }) + '.'; }); };
    d.querySelector('#mo-lv-cancel').onclick = function () { d.close(); }; var cl = d.querySelector('#mo-lv-clear'); if (cl) cl.onclick = function () { d.close(); act(api({ edit: { id: l.id, trade: null } })); };
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function wire() {
    var card = $('mo-lessons'); if (!card || card.dataset.wired) return; card.dataset.wired = '1';
    card.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return; var l = b.closest('details.mo-l'), id = l && l.dataset.id;
      if (b.dataset.img) { var im = b.querySelector('img'); if (im) view(im); }
      else if (b.dataset.chart) { var L = byId(b.dataset.chart); if (L && root.msMoshaReplayLesson) root.msMoshaReplayLesson(L); }
      else if (b.dataset.right) act(api({ say: { id: b.dataset.right, verdict: 'right' } }));
      else if (b.dataset.wrong) ask('What is not right? The desk learns from your words.', '', { title: 'Not right', ok: 'Send', max: 2000 }).then(function (v) { if (v != null && String(v).trim()) act(api({ say: { id: b.dataset.wrong, verdict: 'wrong', text: v } })); });
      else if (b.dataset.rmImg) sure('Remove this picture from the lesson?', { title: 'Remove the picture', ok: 'Remove', danger: true }).then(function (y) { if (y) act(api({ remove: { id: id, img: b.dataset.rmImg } })); });
      else if (b.dataset.cap) { var s = ((byId(id) || { shots: [] }).shots.filter(function (x) { return x.img === b.dataset.cap; })[0]); ask('Caption', s ? s.caption : '', { title: 'Caption of this picture', ok: 'Save', max: 200 }).then(function (v) { if (v != null) act(api({ edit: { id: id, img: b.dataset.cap, caption: v } })); }); }
      else if (b.dataset.rm) sure('Remove this lesson and its pictures? This cannot be undone.', { title: 'Remove the lesson', ok: 'Remove', danger: true }).then(function (y) { if (y) act(api({ remove: { id: b.dataset.rm } })); });
      else if (b.dataset.note) { var cur = byId(b.dataset.note); ask('What should the desk learn from it', cur ? cur.note : '', { title: 'Note of this lesson', ok: 'Save', max: 2000 }).then(function (v) { if (v != null) act(api({ edit: { id: b.dataset.note, note: v } })); }); }
      else if (b.dataset.levels) { var lv = byId(b.dataset.levels); if (lv) levelsDialog(lv); }
      else if (b.dataset.more) { var f = $('mo-t-form'); if (f) { f.elements.lesson.value = b.dataset.more; $('mo-teach').scrollIntoView({ block: 'start', behavior: 'smooth' }); var fi = $('mo-t-file'); if (fi) fi.focus(); } }
      else if (b.id === 'mo-l-keybtn') { b.disabled = true; fetch(URL_ + '?get=reader', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) { var o = $('mo-l-keyout'); if (!o) return; o.hidden = false; var inp = o.querySelector('input'); if (j.key) { inp.value = j.key; inp.focus(); inp.select(); o.querySelector('small').textContent = 'Host: ' + (j.host || 'meridianx.dev') + '. Paste the key only into the secure form the assistant opens for that host, never into a chat. With it one can read the lessons, answer them and propose lines for the book, nothing else.'; } else { inp.value = ''; o.querySelector('small').textContent = j.off ? 'The key is switched off on the server (MOSHA_READER=off).' : (j.error || 'The server has no session secret yet, so there is no key.'); } }).catch(function () {}).then(function () { b.disabled = false; }); }
      else if (b.id === 'mo-l-keycopy') { var k = $('mo-l-keyout').querySelector('input'); if (k.value && root.msCopy) root.msCopy(k.value); else if (k.value && navigator.clipboard) navigator.clipboard.writeText(k.value); }
    });
    card.addEventListener('submit', function (ev) { var f = ev.target.closest('form.mo-l-say'); if (!f) return; ev.preventDefault(); var v = f.elements.text.value.trim(); if (!v) return; f.elements.text.value = ''; act(api({ say: { id: f.dataset.say, text: v } })); });
    var book = $('mo-book'); if (book) {
      book.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.bOk) act(api({ book: { id: b.dataset.bOk, confirm: true } }));
        else if (b.dataset.bFix) { var it = T.book.filter(function (x) { return x.id === b.dataset.bFix; })[0]; ask('Say it the way you mean it', it ? it.text : '', { title: 'Correct this line', ok: 'Save', max: 600 }).then(function (v) { if (v != null && String(v).trim()) act(api({ book: { id: b.dataset.bFix, text: v } })); }); }
        else if (b.dataset.bRm) sure('Erase this line from what the desk knows?', { title: 'Erase the line', ok: 'Erase', danger: true }).then(function (y) { if (y) act(api({ book: { id: b.dataset.bRm, remove: true } })); }); });
      book.addEventListener('submit', function (ev) { var f = ev.target.closest('#mo-b-form'); if (!f) return; ev.preventDefault(); var v = f.elements.text.value.trim(); if (v.length < 4) return; var kind = f.elements.kind.value; f.elements.text.value = ''; act(api({ learn: { kind: kind, text: v } })); });
    }
    var f = $('mo-t-form'); if (!f) return;
    f.addEventListener('submit', send); f.addEventListener('input', function () { var s = $('mo-t-send'); if (s) s.disabled = !canSend(); }); f.addEventListener('reset', function () { setTimeout(drawPicks, 0); });
    $('mo-t-file').addEventListener('change', function (ev) { addFiles(ev.target.files); ev.target.value = ''; });
    $('mo-t-picks').addEventListener('input', function (ev) { var i = ev.target.dataset.pick; if (i != null && T.picks[+i]) T.picks[+i].caption = ev.target.value; });
    $('mo-t-picks').addEventListener('click', function (ev) { var b = ev.target.closest('button[data-drop]'); if (!b || T.busy) return; var p = T.picks.splice(+b.dataset.drop, 1)[0]; if (p) URL.revokeObjectURL(p.url); drawPicks(); });
    var drop = $('mo-t-drop'); ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); }); ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (ev) { ev.preventDefault(); drop.classList.remove('over'); if (n === 'drop' && ev.dataTransfer) addFiles(ev.dataTransfer.files); }); });
    $('mo-teach').addEventListener('paste', function (ev) { var fs = ev.clipboardData && ev.clipboardData.files; if (fs && fs.length) { ev.preventDefault(); addFiles(fs); } });   // a screenshot straight from the clipboard
  }
  root.msMoshaTeach = function () { wire(); if (!T.lessons) draw(); load(); };
  { var v0 = $('v-mosha'); if (v0 && !v0.hidden) root.msMoshaTeach(); }   // the desk was already open when this file ran
})(typeof window !== 'undefined' ? window : globalThis);

// Mosha desk, the lessons (owner, 10 Nov 2026: the Mosha desk "will be main page of" Luxus, "he will train u, allow him to send
// you trades images so u can learn"). A teacher sends a trade as screenshots, each with a caption in their own words, and a note
// on what the desk should learn; everyone who may open the desk sees the lessons, and under each one what the desk's assistant
// understood (or that it has not read it yet), so the teacher can correct it. The server (api/mosha-lessons.js) decides who may
// send and checks every picture; this file only draws. Pure pieces are on MS_MOSHA_TEACH and tested in tests/mosha-lessons.test.mjs.
// Lessons only: nothing here places or changes a trade.
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
  // where a lesson stands with the desk's assistant: not read, read, or read before the last pictures were added
  function stateOf(l) { var n = (l.shots || []).length; return !l.reply ? 'new' : (l.reply.shots || 0) < n ? 'more' : 'read'; }
  var STATE = { 'new': 'Not read yet', more: 'New pictures since it was read', read: 'Read by the desk' };
  function summary(list) { var shots = 0, unread = 0; (list || []).forEach(function (l) { shots += (l.shots || []).length; if (stateOf(l) !== 'read') unread++; }); return { lessons: (list || []).length, shots: shots, unread: unread }; }
  // base64 length of a data URL -> bytes
  function bytesOf(dataUrl) { var i = String(dataUrl).indexOf(','), b = String(dataUrl).length - i - 1; return i < 0 ? 0 : Math.floor(b * 3 / 4); }
  var API = { MAX_SIDE: MAX_SIDE, MAX_PICK: MAX_PICK, fit: fit, captionOf: captionOf, stateOf: stateOf, STATE: STATE, summary: summary, bytesOf: bytesOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_MOSHA_TEACH = API;
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var URL_ = '/api/mosha-lessons', T = { lessons: null, canTeach: false, who: null, picks: [], busy: false, open: null, loading: false, err: null };
  var day = function (iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
  var api = function (body) { return fetch(URL_, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || (r.status === 429 ? 'too many requests: wait a minute' : r.status === 413 ? 'that picture is too large' : 'the desk did not take it (' + r.status + ')')); return j; }); }); };
  var mine = function (l) { return T.who === 'owner' || (T.canTeach && l.by === T.who); };

  function load() {
    if (T.loading) return; T.loading = true;
    fetch(URL_, { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'the lessons could not be read'); }); })
      .then(function (j) { T.lessons = Array.isArray(j.lessons) ? j.lessons : []; T.canTeach = !!j.canTeach; T.who = j.who || null; T.err = null; })
      .catch(function (e) { T.err = e.message || 'the lessons could not be read'; })
      .then(function () { T.loading = false; draw(); });
  }
  function lessonHTML(l, open) {
    var st = stateOf(l), own = mine(l);
    return '<details class="mo-l" data-id="' + esc(l.id) + '"' + (open ? ' open' : '') + '><summary><span class="mo-l-t">' + esc(l.title) + '</span><span class="mo-l-m">' + esc(l.name || l.by) + ' · ' + esc(day(l.at)) + ' · ' + l.shots.length + (l.shots.length === 1 ? ' picture' : ' pictures') + '</span><span class="mo-l-st mo-l-' + st + '">' + STATE[st] + '</span></summary>'
      + '<div class="mo-l-b">' + (l.note ? '<p class="mo-l-note">' + esc(l.note) + '</p>' : '')
      + '<div class="mo-l-shots">' + l.shots.map(function (s, i) { return '<figure><button type="button" class="mo-l-img" data-img="' + esc(s.img) + '" aria-label="Open picture ' + (i + 1) + (s.caption ? ': ' + esc(s.caption) : '') + '"><img alt="' + esc(s.caption || 'Trade screenshot ' + (i + 1)) + '" data-src="' + URL_ + '?img=' + encodeURIComponent(s.img) + '" width="320" height="200" decoding="async"></button><figcaption>' + (s.caption ? esc(s.caption) : '<i>no caption</i>') + (own ? ' <button type="button" class="mo-l-x" data-cap="' + esc(s.img) + '">Caption</button><button type="button" class="mo-l-x" data-rm-img="' + esc(s.img) + '">Remove</button>' : '') + '</figcaption></figure>'; }).join('') + '</div>'
      + '<div class="mo-l-reply"><b>What the desk understood</b>' + (l.reply ? '<p>' + esc(l.reply.text) + '</p><small>' + esc(day(l.reply.at)) + (st === 'more' ? ' · written before the last pictures were added' : '') + '. Wrong? Say so in the note, or send the right picture.</small>' : '<p class="mo-l-wait">The desk has not read this lesson yet.</p>') + '</div>'
      + (own ? '<div class="mo-l-acts"><button type="button" class="ms-tbtn" data-more="' + esc(l.id) + '">Add pictures</button><button type="button" class="ms-tbtn" data-note="' + esc(l.id) + '">Edit the note</button><button type="button" class="ms-tbtn" data-rm="' + esc(l.id) + '">Remove the lesson</button></div>' : '')
      + '</div></details>';
  }
  function showImgs(det) { Array.prototype.forEach.call(det.querySelectorAll('img[data-src]'), function (im) { if (im.getAttribute('src')) return; im.onerror = function () { if (im.dataset.retry) { im.alt = 'This picture could not be loaded'; return; } im.dataset.retry = '1'; setTimeout(function () { im.src = im.dataset.src + '&r=1'; }, 20000); }; im.src = im.dataset.src; }); }
  function draw() {
    var card = $('mo-lessons'), body = $('mo-l-body'), teach = $('mo-teach'); if (!card || !body) return;
    if (teach) teach.hidden = !T.canTeach;
    var sub = $('mo-l-sub'), keyBox = $('mo-l-key'); if (keyBox) keyBox.hidden = T.who !== 'owner';
    if (T.err && !T.lessons) { body.innerHTML = '<div class="ct-empty">' + esc(T.err.charAt(0).toUpperCase() + T.err.slice(1)) + '.</div>'; if (sub) sub.textContent = ''; return; }
    if (!T.lessons) return;
    var s = summary(T.lessons); if (sub) sub.textContent = s.lessons ? s.lessons + (s.lessons === 1 ? ' lesson' : ' lessons') + ' · ' + s.shots + (s.shots === 1 ? ' picture' : ' pictures') + (s.unread ? ' · ' + s.unread + ' not read yet' : ' · all read') : '';
    var openId = T.open || (T.lessons[0] && T.lessons[0].id);
    body.innerHTML = T.lessons.length ? T.lessons.map(function (l) { return lessonHTML(l, l.id === openId); }).join('')
      : '<div class="ct-empty">' + (T.canTeach ? 'No lessons yet. Send your first trade above: the screenshots, and in your own words what the desk should see in them.' : 'No lessons yet. They appear here when the desk\'s teacher sends a trade.') + '</div>';
    Array.prototype.forEach.call(body.querySelectorAll('details.mo-l'), function (d) { if (d.open) showImgs(d); d.addEventListener('toggle', function () { if (d.open) { T.open = d.dataset.id; showImgs(d); } }); });
    var sel = document.querySelector('#mo-t-form select[name="lesson"]'); if (sel) { var cur = sel.value; sel.innerHTML = '<option value="">A new lesson</option>' + T.lessons.filter(mine).map(function (l) { return '<option value="' + esc(l.id) + '">' + esc(l.title) + '</option>'; }).join(''); if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur; }
  }

  // ─── sending ───
  function say(txt, bad) { var m = $('mo-t-msg'); if (m) { m.textContent = txt || ''; m.classList.toggle('mo-err-t', !!bad); } }
  function drawPicks() {
    var ol = $('mo-t-picks'), send = $('mo-t-send'); if (!ol) return;
    ol.innerHTML = T.picks.map(function (p, i) { return '<li><img src="' + esc(p.url) + '" alt="" width="96" height="60"><label class="mo-f"><span>Caption for picture ' + (i + 1) + '</span><input type="text" maxlength="200" data-pick="' + i + '" value="' + esc(p.caption) + '" placeholder="M5 vr · M30 sweep high · entry after BO sell"></label><button type="button" class="ms-tbtn" data-drop="' + i + '" aria-label="Take picture ' + (i + 1) + ' out">Take out</button></li>'; }).join('');
    if (send) send.disabled = !T.picks.length || T.busy;
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
  function send(ev) {
    ev.preventDefault(); var f = $('mo-t-form'); if (!f || T.busy || !T.picks.length) return;
    var lesson = f.elements.lesson.value || null, title = f.elements.title.value.trim(), note = f.elements.note.value.trim(), total = T.picks.length, done = 0;
    if (!lesson && !title) { say('Name the trade first: which one is it?', true); f.elements.title.focus(); return; }
    T.busy = true; drawPicks(); f.setAttribute('aria-busy', 'true');
    var next = function () {
      if (!T.picks.length) return Promise.resolve();
      var p = T.picks[0]; say('Sending picture ' + (done + 1) + ' of ' + total + '…');
      return shrink(p.file).then(function (data) { return api({ add: { lesson: lesson, title: title, note: done === 0 ? note : undefined, caption: p.caption, image: data } }); })
        .then(function (j) { lesson = j.lesson.id; T.open = lesson; done++; URL.revokeObjectURL(p.url); T.picks.shift(); drawPicks(); return next(); });
    };
    next().then(function () { say(done === 1 ? 'Sent. The desk will read it and write back what it understood.' : done + ' pictures sent. The desk will read them and write back what it understood.'); f.elements.title.value = ''; f.elements.note.value = ''; f.elements.lesson.value = ''; })
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
  function wire() {
    var card = $('mo-lessons'); if (!card || card.dataset.wired) return; card.dataset.wired = '1';
    card.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return; var l = b.closest('details.mo-l'), id = l && l.dataset.id;
      if (b.dataset.img) { var im = b.querySelector('img'); if (im) view(im); }
      else if (b.dataset.rmImg) sure('Remove this picture from the lesson?', { title: 'Remove the picture', ok: 'Remove', danger: true }).then(function (y) { if (y) act(api({ remove: { id: id, img: b.dataset.rmImg } })); });
      else if (b.dataset.cap) { var s = (T.lessons.filter(function (x) { return x.id === id; })[0] || { shots: [] }).shots.filter(function (x) { return x.img === b.dataset.cap; })[0]; ask('Caption', s ? s.caption : '', { title: 'Caption of this picture', ok: 'Save', max: 200 }).then(function (v) { if (v != null) act(api({ edit: { id: id, img: b.dataset.cap, caption: v } })); }); }
      else if (b.dataset.rm) sure('Remove this lesson and its pictures? This cannot be undone.', { title: 'Remove the lesson', ok: 'Remove', danger: true }).then(function (y) { if (y) act(api({ remove: { id: b.dataset.rm } })); });
      else if (b.dataset.note) { var cur = T.lessons.filter(function (x) { return x.id === b.dataset.note; })[0]; ask('What should the desk learn from it', cur ? cur.note : '', { title: 'Note of this lesson', ok: 'Save', max: 2000 }).then(function (v) { if (v != null) act(api({ edit: { id: b.dataset.note, note: v } })); }); }
      else if (b.dataset.more) { var f = $('mo-t-form'); if (f) { f.elements.lesson.value = b.dataset.more; $('mo-teach').scrollIntoView({ block: 'start', behavior: 'smooth' }); var fi = $('mo-t-file'); if (fi) fi.focus(); } }
      else if (b.id === 'mo-l-keybtn') { b.disabled = true; fetch(URL_ + '?get=reader', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) { var o = $('mo-l-keyout'); if (!o) return; o.hidden = false; var inp = o.querySelector('input'); if (j.key) { inp.value = j.key; inp.focus(); inp.select(); o.querySelector('small').textContent = 'Host: ' + (j.host || 'meridianx.dev') + '. Paste the key only into the secure form the assistant opens for that host, never into a chat. With it one can read the lessons and write a reply, nothing else.'; } else { inp.value = ''; o.querySelector('small').textContent = j.off ? 'The key is switched off on the server (MOSHA_READER=off).' : (j.error || 'The server has no session secret yet, so there is no key.'); } }).catch(function () {}).then(function () { b.disabled = false; }); }
      else if (b.id === 'mo-l-keycopy') { var k = $('mo-l-keyout').querySelector('input'); if (k.value && root.msCopy) root.msCopy(k.value); else if (k.value && navigator.clipboard) navigator.clipboard.writeText(k.value); }
    });
    var f = $('mo-t-form'); if (!f) return;
    f.addEventListener('submit', send);
    $('mo-t-file').addEventListener('change', function (ev) { addFiles(ev.target.files); ev.target.value = ''; });
    $('mo-t-picks').addEventListener('input', function (ev) { var i = ev.target.dataset.pick; if (i != null && T.picks[+i]) T.picks[+i].caption = ev.target.value; });
    $('mo-t-picks').addEventListener('click', function (ev) { var b = ev.target.closest('button[data-drop]'); if (!b || T.busy) return; var p = T.picks.splice(+b.dataset.drop, 1)[0]; if (p) URL.revokeObjectURL(p.url); drawPicks(); });
    var drop = $('mo-t-drop'); ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); }); ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (ev) { ev.preventDefault(); drop.classList.remove('over'); if (n === 'drop' && ev.dataTransfer) addFiles(ev.dataTransfer.files); }); });
    $('mo-teach').addEventListener('paste', function (ev) { var fs = ev.clipboardData && ev.clipboardData.files; if (fs && fs.length) { ev.preventDefault(); addFiles(fs); } });   // a screenshot straight from the clipboard
  }
  root.msMoshaTeach = function () { wire(); if (!T.lessons) draw(); load(); };
  { var v0 = $('v-mosha'); if (v0 && !v0.hidden) root.msMoshaTeach(); }   // the desk was already open when this file ran
})(typeof window !== 'undefined' ? window : globalThis);

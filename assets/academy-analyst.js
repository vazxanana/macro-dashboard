// MeridianX Academy: the "Analyst (language model)" block on the Train decision card.
//
// The analyst is the OPTIONAL language model (docs/academy/LLM.md). It is off until the owner sets a key on the server; the
// page then offers "Ask the analyst" on a decision the deterministic engine has already made and stored. Nothing is asked
// automatically unless the owner switches on "ask on every setup of this run", and that switch shows the estimated cost first
// and stops by itself at a budget or at the daily call cap.
//
// What this file sends (payloadOf): the closed bars of the decision's own snapshot (the last 30 of the signal timeframe, 15 of
// each other), its features, the engine's decision, the running thesis, the costs of the run and, when one is open, the paper
// position with the levels of its own setup. It never sends how a trade ended: the server refuses any such field anyway.
// The answer comes back already checked by the server; this file only shows it beside the engine's, labelled as language-model
// output with its provider and cost. A provider called "fake-test" is the local test double: the block then carries a banner
// that says so. Every call goes through the page's paced wrapper (MXAC.api: at most 24 Academy calls a minute).
// No key, no provider address and no model name ever reach the browser.
//
// The connector (10 Nov 2026): with no provider key on the server, the question is QUEUED instead of sent, and the owner's own
// assistant answers it through the connector (api/academy-mcp.js): no key, no cost. The block then says how many questions wait,
// offers "Check for the answer", and shows the answer exactly as a provider's (the server checks it the same way). The connector's
// address carries its key: it is read only when the owner opens "Set up the connector", shown once, and kept in no storage.
(function (root) {
  'use strict';
  const NODE = typeof module !== 'undefined' && module.exports;
  const FAKE = 'fake-test', DOC = 'docs/academy/LLM.md', FAKE_BANNER = 'FAKE PROVIDER: test answers, not a language model';
  const CONNECTOR = 'connector';   // the provider label of an answer that came from the owner's assistant
  const REASONS = [['missing-confirmation', 'Missing confirmation'], ['wrong-structure', 'Wrong structure'], ['liquidity', 'Liquidity'], ['htf-bias', 'Higher-timeframe bias'], ['session', 'Session'], ['volatility', 'Volatility'], ['rr', 'Reward to risk'], ['news', 'News'], ['late', 'Late'], ['early', 'Early'], ['other', 'Other']];
  const fin = (x) => typeof x === 'number' && isFinite(x);
  const usd = (v) => '$' + (fin(v) && v > 0 ? (v < 0.01 ? v.toFixed(4) : v.toFixed(2)) : '0.00');
  const count = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const cap = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };

  // the closed bars sent with a question: the last 30 of the signal timeframe, the last 15 of each other one
  function digestOf(snap, sigTf) { const bars = {}; for (const tf of Object.keys((snap && snap.bars) || {})) bars[tf] = (snap.bars[tf] || []).slice(-(tf === sigTf ? 30 : 15)).map((b) => [b.time, b.open, b.high, b.low, b.close]); return bars; }
  // The paper position open at this decision, with the levels of its own setup. ONLY these fields: the page also holds how that
  // trade ended (it settles the paper account from the stored result), and that never leaves the browser.
  function positionOf(point) {
    const cur = point && point.cur; if (!cur) return null;
    const o = (point.open || []).filter((x) => x && x.id !== cur.cand.id && fin(x.t) && x.t < cur.cand.t).pop(); if (!o) return null;
    const c = (point.cands || []).find((x) => x.id === o.id); if (!c || !fin(c.entry) || !fin(c.stop)) return null;
    return { candidateId: c.id, side: c.side, entry: c.entry, stop: c.stop, target: fin(c.target) ? c.target : null, openedT: o.t };
  }
  // why the analyst cannot be asked on this point, or null
  function blocked(point) {
    const cur = point && point.cur; if (!cur) return 'no decision is open';
    const a = cur.latest; if (!a || !a.row || !a.row.id) return 'the engine\'s own answer for this setup is not stored yet';
    if (!a.decision || !Array.isArray(a.decision.gates)) return 'this decision was read back from the store without its checks. Use "Replay same trade" first, then ask';
    return null;
  }
  // the body of POST { action: 'analyse' } for the decision point that is open
  function payloadOf(point, extra) {
    const cur = point.cur, a = cur.latest, c = cur.cand, st = point.setup;
    return Object.assign({ action: 'analyse', edge: st.edge.id, candidateId: c.id, attemptId: a.row.id,
      snapshot: { t: cur.snap.t, hash: cur.hash, bars: digestOf(cur.snap, st.edge.signalTf), dataVersion: cur.snap.dataVersion == null ? null : String(cur.snap.dataVersion) },
      features: cur.features, deterministic: a.decision, thesis: point.thesis || null, position: positionOf(point), cost: fin(st.cost) ? st.cost : null, sessionId: point.sessionId || null }, extra || {});
  }
  // the line shown while the analyst is off
  function offText(cost) {
    const why = cost && cost.reason, spent = cost && cost.total && fin(cost.total.usd) ? cost.total.usd : 0;
    return `Off. ${!why || /no language-model key/.test(why) ? 'No key is set' : cap(why)}. Nothing was sent. Cost so far: ${usd(spent)}`;
  }
  // provider, today's spend and what is left, in one line
  function budgetText(cost) {
    if (!cost || !cost.enabled) return '';
    const b = cost.budgets || {}, t = cost.today || {}, k = cost.calls || {};
    return `Provider: ${cost.provider || 'not named'}. Today ${usd(t.usd)} of ${usd(b.dailyUsd)}` + (fin(k.leftToday) ? `, ${count(k.leftToday, 'call')} left today` : '') + `. Since the start ${usd((cost.total || {}).usd)} of ${usd(b.hardUsd)}.`;
  }
  // "ask on every setup of this run": how many setups are left, what one ask costs at most, and how many the budgets allow
  function runEstimate(perAskUsd, left, cost) {
    const r = (cost && cost.remaining) || {}, rem = [r.dayUsd, r.monthUsd, r.hardUsd].filter(fin), room = rem.length ? Math.min.apply(null, rem) : null, calls = cost && cost.calls && fin(cost.calls.leftToday) ? cost.calls.leftToday : null;
    const byMoney = room == null || !(perAskUsd > 0) ? left : Math.floor(room / perAskUsd + 1e-9), can = Math.max(0, Math.min(left, byMoney, calls == null ? left : calls));
    const text = `${count(left, 'setup')} left in this run. One ask costs at most about ${usd(perAskUsd)} (the whole output cap is counted), so the run costs at most about ${usd(perAskUsd * left)}.`
      + (room == null ? '' : ` The budgets leave ${usd(room)}`) + (calls == null ? (room == null ? '' : '.') : `${room == null ? ' The daily cap leaves' : ' and'} ${count(calls, 'call')} today.`)
      + (can < left ? ` That covers ${can} of them: asking stops by itself when a budget or the call cap is reached, and nothing more is sent.` : ' Asking stops by itself if a budget or the call cap is reached.');
    return { left, perAskUsd, totalUsd: perAskUsd * left, roomUsd: room, callsLeft: calls, canAsk: can, text };
  }
  // setups of the run that are still to come (the open one counts while it has no analyst answer)
  function setupsLeft(point, answered) {
    const cur = point && point.cur; if (!cur) return 0; const done = point.done, has = (id) => (done && typeof done.has === 'function' ? done.has(id) : false);
    return (point.cands || []).filter((c) => c.t > cur.cand.t && !has(c.id)).length + (answered ? 0 : 1);
  }
  // what the answer cost, in words
  function costText(res) {
    const u = res.usage || {}; if (res.provider === CONNECTOR) return 'answered by your own assistant through the connector: no provider call, no cost';
    if (res.cached) return 'answered from the cache: no call, no cost';
    return `cost ${usd(res.costUsd)}${u.estimated ? ' (estimated: the provider reported no usage)' : ''}, ${fin(u.tokensIn) ? u.tokensIn.toLocaleString('en-US') : 'n/a'} tokens in, ${fin(u.tokensOut) ? u.tokensOut.toLocaleString('en-US') : 'n/a'} out`;
  }
  // what to say when no answer came back
  function failText(res) {
    if (res.skipped === 'budget') return ({ day: 'Not sent: today\'s budget is used up.', month: 'Not sent: this month\'s budget is used up.', 'hard-stop': 'Not sent: the hard stop is reached, or the kill switch is on.', calls: 'Not sent: the daily call cap is reached.' })[res.scope] || 'Not sent: a budget is used up.';
    if (res.skipped === 'too-long') return 'Not sent: the request is too long.';
    if (res.error) return `${cap(res.error)}${res.status ? ` (status ${res.status})` : ''}${res.detail ? `: ${res.detail}` : ''}.` + (res.costEstimated ? ` Its cost is not known, so the estimate of ${usd(res.costUsd)} stays in the ledger.` : res.costUsd ? ` It was charged ${usd(res.costUsd)}.` : ' Nothing was charged.');
    return 'No answer came back.';
  }

  // the connector: is it the analyst's way here, what waits, what a queued question says, how to set it up
  const viaConnector = (cost) => !!(cost && !cost.enabled && cost.connector && cost.connector.on);
  function connectorText(cost) {
    const n = cost && cost.connector && fin(cost.connector.pending) ? cost.connector.pending : 0;
    return `Answered by your own assistant through the connector: no provider key, no cost. ${n ? `${count(n, 'question')} ${n === 1 ? 'waits' : 'wait'} for it.` : 'No question waits.'}`;
  }
  function queuedText(res) {
    const q = (res && res.queue) || {}, n = fin(q.pending) ? q.pending : 1;
    return `Waiting for your assistant: this question is number ${fin(q.position) ? q.position : 1} of ${n} in the queue. Nothing was sent to a provider and nothing was charged.`
      + (q.lastRefusal ? ` Its last answer was refused by the checks (${q.lastRefusal}); it can send another.` : '');
  }
  const SAY = 'Answer my Academy questions';
  const connectorSteps = () => ['Copy the address below. It carries the key: treat it like a password and do not share it.', 'In your assistant app, add a custom connector and paste the address.', 'Ask the analyst on a decision here: the question is queued.',
    `In the assistant, say: "${SAY}". It reads each question and sends its answer back; the site checks every answer before it counts.`, 'Come back here and press "Check for the answer".'];

  const MXAN = { FAKE, CONNECTOR, DOC, FAKE_BANNER, REASONS, SAY, usd, digestOf, positionOf, blocked, payloadOf, offText, budgetText, runEstimate, setupsLeft, costText, failText, viaConnector, connectorText, queuedText, connectorSteps };
  if (NODE) { module.exports = MXAN; return; }
  root.MXAN = MXAN;
  if (typeof document === 'undefined' || !root.MXAC || !root.MXAC.kit || !root.MXAC.api) return;

  // ---- the page -----------------------------------------------------------------------------------------------------
  const A = root.MXAC, K = A.kit, api = A.api, MXA = root.MXA, el = K.el, clear = K.clear, $ = (id) => document.getElementById(id);
  const ST = { cost: undefined, costErr: '', loading: null, by: {}, auto: false, autoNote: '', plan: null, planFor: null, setup: null };   // setup: the connector box (never stored)
  const point = () => (typeof A.point === 'function' ? A.point() : null);
  const state = (id) => (ST.by[id] = ST.by[id] || { asking: false, res: null, err: '', first: null, correction: null, form: { choice: null, reasons: [], text: '' }, lesson: null, savedLesson: null, cmp: null, note: '' });
  const price = (v) => (fin(v) ? A.fmtPrice(v) : 'none');

  // the on / off state and the ledger: read ONCE when a replay opens (never while a decision is being made), then kept up to date
  // from the `budget` each answer carries
  function loadCost(force) {
    if (ST.loading && !force) return ST.loading;
    ST.loading = api.get({ get: 'cost' }).then((j) => { ST.cost = j; ST.costErr = ''; }, (e) => { ST.cost = null; ST.costErr = e.message; }).then(draw);
    return ST.loading;
  }
  function takeBudget(b) { if (!b || !ST.cost) return; for (const k of ['today', 'total', 'remaining', 'calls']) if (b[k]) ST.cost[k] = b[k]; }

  async function ask(extra) {
    const pt = point(); if (!pt || blocked(pt)) return; const id = pt.cur.cand.id, s = state(id); if (s.asking) return;
    s.asking = true; s.err = ''; s.note = ''; draw();
    try {
      const res = await api.post(payloadOf(pt, extra)); takeBudget(res.budget);
      if (res.available === false) { ST.cost = Object.assign({}, ST.cost || {}, { enabled: false, reason: res.reason }); ST.auto = false; }
      else {
        if (res.decision && !s.first) s.first = res; else if (res.decision && s.correction) s.cmp = MXA.compare(s.first.decision, res.decision, s.correction);
        if (res.decision && s.first && s.first !== res && res.attempt && res.attempt.stored === false) s.note = 'Nothing has changed since the last answer (the same lessons, the same thesis), so it came from the cache at no cost. Save a lesson first, then ask again.';
        { const was = s.res, cn = ST.cost && ST.cost.connector; s.res = res;   // the connector's count: what the server says while it waits, one less once it has been answered
          if (cn && cn.on) { if (res.queued && res.queue && fin(res.queue.pending)) cn.pending = res.queue.pending; else if (was && was.queued) cn.pending = Math.max(0, (cn.pending || 0) - 1); } }
        if (!res.decision && ST.auto && (res.skipped === 'budget' || res.error)) { ST.auto = false; ST.autoNote = res.skipped === 'budget' ? 'Asking on every setup stopped: ' + failText(res).replace(/^Not sent: /, '') + ' Nothing more was sent.' : 'Asking on every setup stopped: the last call failed. Nothing more is sent until you switch it on again.'; }
      }
    } catch (e) { s.err = e.message; if (ST.auto) { ST.auto = false; ST.autoNote = 'Asking on every setup stopped: the last request was refused.'; } }
    finally { s.asking = false; draw(); }
  }

  // "ask on every setup of this run": the estimate first, the switch only after the owner confirms it
  async function planAuto() {
    const pt = point(); if (!pt || blocked(pt)) return; const id = pt.cur.cand.id, s = state(id);
    ST.autoNote = ''; ST.plan = { loading: true }; ST.planFor = id; draw();
    try {
      const dry = await api.post(payloadOf(pt, { dryRun: true })); takeBudget(dry.budget);
      if (dry.available === false) { ST.cost = Object.assign({}, ST.cost || {}, { enabled: false, reason: dry.reason }); ST.plan = null; }
      else ST.plan = runEstimate(dry.fresh ? dry.fresh.usd : dry.estimate.usd, setupsLeft(pt, !!(s.res && s.res.decision)), ST.cost);   // `fresh`: what one new ask costs at most, even when this setup's own answer is already cached
    } catch (e) { ST.plan = { error: e.message }; }
    draw();
  }

  // the connector's address, read only when the owner asks for it
  async function openSetup() {
    if (ST.setup && !ST.setup.error) { ST.setup = null; draw(); return; }
    ST.setup = { loading: true }; draw();
    try { const j = await api.get({ get: 'connector' }); ST.setup = j.available ? { url: j.url } : { error: cap(j.reason || 'the connector is not available') + '.' }; }
    catch (e) { ST.setup = { error: `The address could not be read: ${e.message}.` }; }
    draw();
  }

  async function saveCorrection() {
    const pt = point(); if (!pt) return; const s = state(pt.cur.cand.id), f = s.form, base = s.first; if (!base || !base.attempt || !f.choice) return;
    const lv = A.mentorLevelsOf(pt.cur.cand, f.choice), c = A.buildCorrection({ choice: f.choice, entry: lv.entry, stop: lv.stop, target: lv.target, reasons: f.reasons, text: f.text, annotations: [] }, base.attempt.id);
    const probs = A.correctionProblems(c, base.decision); if (probs.length) { s.err = probs.join(' ').replace(/\bThe engine\b/g, 'The analyst').replace(/\bthe engine\b/g, 'the analyst'); draw(); return; }
    s.err = ''; s.saving = true; draw();
    try {
      const res = await api.post({ action: 'correct', engine: 'language-model', edge: pt.setup.edge.id, correction: Object.assign({}, c, { errorClass: MXA.classifyError(base.decision, c, null) }) });
      s.correction = res.correction; s.cmp = null; s.savedLesson = null;
      s.lesson = MXA.lessons.fromCorrection(base.decision, Object.assign({}, res.correction, { sessionId: pt.sessionId }), pt.cur.features);
    } catch (e) { s.err = 'The correction was not saved: ' + e.message + '.'; }
    finally { s.saving = false; draw(); }
  }
  async function saveLesson() {
    const pt = point(); if (!pt) return; const s = state(pt.cur.cand.id), L = s.lesson; if (!L || s.savedLesson || K.lessonProblemsOf(L).length) return;
    s.saving = true; s.err = ''; draw();
    try {
      const res = await api.post({ action: 'lesson.save', lesson: { edge: L.edge, title: String(L.title).trim(), text: L.text || '', when: L.when, then: { action: L.then.action || null, adjust: L.then.adjust || {}, note: L.then.note || '' }, source: Object.assign({}, L.source, { sessionId: pt.sessionId }), active: true } });
      s.savedLesson = res.lesson; K.lessonsChanged();   // the engine's next decisions read the lessons again
    } catch (e) { s.err = 'The lesson was not saved: ' + e.message + '.'; }
    finally { s.saving = false; draw(); }
  }

  // ---- drawing --------------------------------------------------------------------------------------------------------------
  const list = (items, none, id) => K.listOr(el('ul', { class: 'txt-list', id: id || null }), items || [], none, (x) => el('li', { text: A.humanize(typeof x === 'string' ? x : x.text || '') }));
  const evidence = (items, cls, none, id) => K.listOr(el('ul', { class: 'ev-list ' + cls, id }), items || [], none, (x) => el('li', {}, el('span', { text: x.text }), el('span', { class: 'w', title: 'the factor this item names', text: A.featLabel ? A.featLabel(x.factor) : x.factor })));
  function answerView(box, pt, s) {
    const res = s.res, eng = pt.cur.latest.decision, exam = !!pt.cur.exam;
    if (res.queued) {
      box.appendChild(el('p', { class: 'note', id: 'an-queued', role: 'status', text: queuedText(res) }));
      box.appendChild(el('p', { id: 'an-say' }, 'In your assistant, say: ', el('b', { text: `"${SAY}"` }), '. Then:'));
      box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'an-check', disabled: !!s.asking, text: s.asking ? 'Checking…' : 'Check for the answer', onclick: () => ask() })));
      return;
    }
    if (!res.decision) {
      if (res.refusals && res.refusals.length) {
        box.appendChild(el('div', { class: 'ac-err', id: 'an-refused', role: 'alert' }, 'The analyst\'s answer was refused by the checks and nothing was stored as an answer. ', el('span', { text: res.provider === CONNECTOR ? 'It came from your assistant through the connector: nothing was charged.' : `It was a call to ${res.provider || 'the provider'}: ${costText(res)}.` }), list(res.refusals, '', 'an-refusals')));
        if (!exam) box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn', id: 'an-retry', text: res.provider === CONNECTOR ? 'Queue the question again' : 'Ask again (a new, billed call)', onclick: () => ask({ retry: true }) })));
      } else box.appendChild(el('p', { class: 'ac-warn', id: 'an-none', role: 'status', text: failText(res) }));
      return;
    }
    const d = res.decision, at = res.attempt || {}, row = (label, a, b) => el('tr', {}, el('td', { text: label }), el('td', {}, a), el('td', {}, b));
    box.appendChild(el('p', { class: 'an-label', id: 'an-label' }, el('b', { text: 'Language-model output. ' }), res.provider === CONNECTOR ? 'From your own assistant, through the connector. ' : `Provider: ${res.provider || 'not named'}. `, res.model && res.model !== res.provider ? (res.provider === CONNECTOR ? `It signed as: ${res.model}. ` : `Model as the provider reported it: ${res.model}. `) : '', `${cap(costText(res))}. `,
      el('span', { class: 'ac-ok', id: 'an-stored', text: at.id ? `Analyst attempt ${at.n} stored apart ✓` : '' })));
    box.appendChild(el('div', { class: 'tbl' }, el('table', { class: 'cmp', id: 'an-cmp' }, el('thead', {}, el('tr', {}, el('th', { text: '' }), el('th', { text: 'Engine' }), el('th', { text: 'Analyst' }))),
      el('tbody', {}, row('Action', K.actBadge(eng.action, true, 'an-eng-action'), K.actBadge(d.action, true, 'an-action')), row('Confidence', eng.confidence || 'n/a', el('span', { id: 'an-conf', text: d.confidence || 'n/a' })),
        row('Entry', price(eng.entry), price(d.entry)), row('Stop', price(eng.stop), price(d.stop)), row('Target', eng.target == null ? 'none' : price(eng.target), d.target == null ? 'none' : price(d.target)),
        row('Lessons used', count((eng.lessonsApplied || []).filter((l) => l.applied !== false).length, 'lesson'), count((d.lessonsApplied || []).length, 'lesson'))))));
    if (d.forced && d.wanted) box.appendChild(el('p', { class: 'ac-warn', id: 'an-forced', text: `The analyst wanted ${d.wanted.action}. A hard gate of the engine cannot be overridden, so the stored answer is WAIT: ${(d.gates || []).map((g) => g.text).join('; ')}.` }));
    if (d.action === 'MANAGE' && d.manage) box.appendChild(el('p', { id: 'an-manage', text: `Open position: ${d.manage.advice === 'tighten' ? `tighten the stop from ${price(d.manage.stopFrom)} to ${price(d.manage.stop)}` : d.manage.advice === 'exit' ? 'close it' : `hold, stop unchanged at ${price(d.manage.stop)}`}.` }));
    box.appendChild(el('p', { class: 'dec-thesis', id: 'an-thesis', text: `Thesis (bias ${d.thesisBias || 'n/a'}): ${d.thesis || ''}` }));
    box.appendChild(el('div', { class: 'ev' }, el('div', {}, el('h4', { text: 'Evidence for' }), evidence(d.supporting, 'for', 'Nothing named.', 'an-support')), el('div', {}, el('h4', { text: 'Evidence against' }), evidence(d.contradicting, 'against', 'Nothing named.', 'an-against'))));
    if ((d.waitReasons || []).length) { box.appendChild(el('h4', { text: 'Reasons to wait' })); box.appendChild(list(d.waitReasons, '', 'an-wait')); }
    box.appendChild(el('h4', { text: 'Uncertainty' })); box.appendChild(list(d.uncertainty, 'Nothing flagged.', 'an-uncertainty'));
    box.appendChild(el('h4', { text: 'What would prove it wrong' })); box.appendChild(list(d.invalidation, 'Nothing named.', 'an-invalid'));
    box.appendChild(el('h4', { text: 'Lessons it used' }));
    box.appendChild(K.listOr(el('ul', { class: 'txt-list', id: 'an-lessons' }), d.lessonsApplied || [], 'It named no lesson.', (l) => el('li', {}, el('b', { text: (l.title || l.id) + ': ' }), l.effect || '')));
    box.appendChild(el('p', { class: 'note', id: 'an-checked', text: 'Checked before it was stored: nothing refused. The checks are the same for every provider: JSON only, the exact keys, the setup\'s own side, a stop on the right side, allowed levels only, real lessons and factors, a word for the confidence.' }));
    if (s.note) box.appendChild(el('p', { class: 'note', id: 'an-note', text: s.note }));
  }
  function mentorView(box, pt, s) {
    const base = s.first, f = s.form;
    box.appendChild(el('h4', {}, 'Your verdict on the analyst\'s answer', el('small', { text: ` attempt ${base.attempt.n}, stored apart from the engine's corrections` })));
    if (!s.correction) {
      const choices = el('div', { class: 'choices', role: 'group', 'aria-label': 'Your verdict on the analyst\'s answer' });
      for (const [v, label] of [['approve', 'Approve'], ['reject', 'Reject'], ['BUY', 'Change to BUY'], ['SELL', 'Change to SELL'], ['WAIT', 'Change to WAIT']]) choices.appendChild(el('button', { type: 'button', class: 'btn', 'data-an-choice': v, 'aria-pressed': f.choice === v ? 'true' : 'false', text: label, onclick: () => { f.choice = v; draw(); } }));
      box.appendChild(choices);
      if (A.isTake(f.choice)) { const lv = A.mentorLevelsOf(pt.cur.cand, f.choice); box.appendChild(el('p', { class: 'note', text: `A changed trade takes the setup's own levels${A.actOf(pt.cur.cand.side) === f.choice ? '' : ', mirrored'}: entry ${price(lv.entry)}, stop ${price(lv.stop)}, target ${lv.target == null ? 'none' : price(lv.target)}.` })); }
      box.appendChild(el('div', { class: 'chips', role: 'group', 'aria-label': 'Reasons' }, REASONS.map(([id, label]) => el('button', { type: 'button', class: 'chip', 'data-an-reason': id, 'aria-pressed': f.reasons.indexOf(id) >= 0 ? 'true' : 'false', text: label, onclick: (e) => { const i = f.reasons.indexOf(id); if (i >= 0) f.reasons.splice(i, 1); else f.reasons.push(id); e.currentTarget.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true'); } }))));
      box.appendChild(el('label', { class: 'f', style: 'margin-top:10px' }, el('span', { text: 'Your explanation' }), el('textarea', { id: 'an-text', maxlength: '4000', placeholder: 'What should it have seen?', value: f.text, oninput: (e) => { f.text = e.target.value; } })));
      box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'an-save', disabled: !f.choice || !!s.saving, text: s.saving ? 'Saving…' : 'Save correction', onclick: saveCorrection })));
      return;
    }
    const k = s.correction;
    box.appendChild(el('p', { class: 'ac-ok', id: 'an-corrected', text: `Correction saved ✓ (${k.verdict}${k.action ? ' → ' + k.action : ''}).` }));
    if (s.lesson && !s.savedLesson) {
      box.appendChild(el('h4', {}, 'Lesson draft', el('small', { text: ' proposed from your correction: edit it before saving. A saved lesson is in force for the engine and the analyst alike.' })));
      const form = K.lessonForm(box, s.lesson, { idp: 'an-lesson', features: pt.cur.features, onChange: (errs) => { const b = $('an-lesson-save'); if (b) b.disabled = !!errs.length; } });
      box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'an-lesson-save', text: 'Save lesson', onclick: saveLesson })));
      form.refresh();
    } else if (s.savedLesson) box.appendChild(el('p', { class: 'ac-ok', id: 'an-lesson-saved', text: `Lesson saved ✓ (version ${s.savedLesson.version}): ${A.lessonText(s.savedLesson)}` }));
    box.appendChild(el('h4', {}, 'Replay and prove', el('small', { text: ' the same decision point, the lessons now in force' })));
    box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'an-again', disabled: !!s.asking, text: s.asking ? 'Asking…' : s.cmp ? 'Ask again on the same setup' : 'Ask the analyst again on the same setup', onclick: () => ask() })));
    if (s.cmp && s.res && s.res.decision) {
      const c = s.cmp;
      box.appendChild(el('p', { id: 'an-changed', text: c.changed.length ? 'Changed between the two answers: ' + c.changed.map((x) => (x.field === 'waitReasons' ? 'reasons to wait' : x.field === 'lessonsApplied' ? 'lessons used' : x.field) + (typeof x.from === 'string' || typeof x.from === 'number' || x.from === null ? ` (${x.from === null ? 'none' : x.from} → ${x.to === null ? 'none' : x.to})` : '')).join(', ') + '.' : 'Nothing changed between the two answers.' }));
      box.appendChild(el('p', { class: 'verdict ' + c.verdict, id: 'an-verdict', 'data-verdict': c.verdict }, el('b', { text: (A.VERDICT_WORD[c.verdict] || c.verdict) + '. ' }), c.note ? cap(c.note) + '.' : ''));
    }
    box.appendChild(el('p', { class: 'honest', text: 'Passing the same trade shows recall, not generalisation. A language model can also answer differently when asked twice.' }));
  }

  function fill(host) {
    const pt = point(); clear(host); if (!pt) return;
    const id = pt.cur.cand.id, s = state(id), cost = ST.cost, exam = !!pt.cur.exam, why = blocked(pt);
    host.appendChild(el('h3', { id: 'an-title' }, 'Analyst (language model)', el('small', { text: 'optional · asked only when you ask · its answers are stored apart from the engine\'s' })));
    if (cost === undefined) { host.appendChild(el('p', { class: 'note', id: 'an-wait', role: 'status', text: 'Checking whether the analyst is switched on…' })); loadCost(); return; }
    if (cost === null) { host.appendChild(el('p', { class: 'ac-err', id: 'an-cost-err', text: `Whether the analyst is switched on could not be read: ${ST.costErr}. Nothing was sent.` })); host.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn', id: 'an-reload', text: 'Try again', onclick: () => loadCost(true) }))); return; }
    if (viaConnector(cost)) {
      host.dataset.state = 'connector';
      const answered = !!(s.res && s.res.decision), waiting = !!(s.res && s.res.queued), once = exam && answered;
      host.appendChild(el('p', { id: 'an-via', text: connectorText(cost) }));
      host.appendChild(el('div', { class: 'f-actions' },
        el('button', { type: 'button', class: 'btn' + (answered || waiting ? '' : ' primary'), id: 'an-ask', disabled: !!why || s.asking || once || waiting || !!s.correction, text: s.asking ? 'One moment…' : answered ? 'Ask again' : waiting ? 'Queued' : 'Ask the analyst', onclick: () => ask() }),
        el('button', { type: 'button', class: 'btn', id: 'an-connector', 'aria-expanded': ST.setup ? 'true' : 'false', text: ST.setup && !ST.setup.error ? 'Hide the connector' : 'Set up the connector', onclick: openSetup }),
        el('span', { class: 'ac-status', id: 'an-msg', role: 'status', text: s.asking ? 'Asking the Academy…' : '' })));
      if (ST.setup) {
        const P = ST.setup, box = el('div', { class: 'an-plan', id: 'an-connector-box', role: 'group', 'aria-label': 'Set up the connector' });
        if (P.loading) box.appendChild(el('p', { class: 'note', text: 'Reading the address…' }));
        else if (P.error) box.appendChild(el('p', { class: 'ac-err', id: 'an-connector-err', text: P.error }));
        else {
          box.appendChild(el('ol', { class: 'txt-list', id: 'an-connector-steps' }, connectorSteps().map((t) => el('li', { text: t }))));
          const inp = el('input', { type: 'text', id: 'an-connector-url', readonly: 'readonly', value: P.url, 'aria-label': 'The connector address', onfocus: (e) => e.target.select() });
          box.appendChild(el('label', { class: 'f' }, el('span', { text: 'Connector address' }), inp));
          box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn', id: 'an-connector-copy', text: P.copied ? 'Copied ✓' : 'Copy the address', onclick: () => { const done = () => { P.copied = true; draw(); }; if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) root.navigator.clipboard.writeText(P.url).then(done, () => { inp.focus(); inp.select(); }); else { inp.focus(); inp.select(); } } })));
          box.appendChild(el('p', { class: 'note', text: 'The assistant can only read the queued questions and send answers. It is never shown how a trade ended, it cannot change a lesson, and nothing here places an order.' }));
        }
        host.appendChild(box);
      }
      if (why) host.appendChild(el('p', { class: 'note', id: 'an-blocked', text: cap(why) + '.' }));
      if (once) host.appendChild(el('p', { class: 'note', id: 'an-once', text: 'A test setup is decided once by each engine: the analyst is not asked again on it.' }));
      if (s.err) host.appendChild(el('p', { class: 'ac-err', id: 'an-err', role: 'alert', text: s.err + (/[.!?]$/.test(s.err) ? '' : '.') + ' Nothing was stored.' }));
      if (s.res) { const ans = el('div', { class: 'an-ans', id: 'an-answer', 'data-provider': s.res.provider || '', 'data-action': s.res.decision ? s.res.decision.action : '', 'data-queued': s.res.queued ? 'yes' : 'no' }); answerView(ans, pt, s); host.appendChild(ans); }
      if (s.first && s.first.decision && s.first.attempt && !exam) { const m = el('div', { class: 'an-mentor', id: 'an-mentor' }); mentorView(m, pt, s); host.appendChild(m); }
      return;
    }
    if (!cost.enabled) {
      host.dataset.state = 'off';
      host.appendChild(el('p', { id: 'an-off', text: offText(cost) }));
      host.appendChild(el('p', { class: 'note', id: 'an-howto', text: `To switch it on, set the key and the other variables on the server as ${DOC} describes (names, meanings, budgets, the first-run checklist)${cost.connector && cost.connector.reason ? `, or use your own assistant through the connector (not available here: ${cost.connector.reason})` : ''}. Until then every decision here is the deterministic engine's.` }));
      return;
    }
    host.dataset.state = 'on';
    if (cost.fake || cost.provider === FAKE || (s.res && s.res.provider === FAKE)) host.appendChild(el('p', { class: 'ac-warn an-fake', id: 'an-fake', role: 'note', text: FAKE_BANNER + '. They come from a fixed rule on the local dev server and cost nothing real.' }));
    const answered = !!(s.res && s.res.decision), once = exam && answered;
    const askBtn = el('button', { type: 'button', class: 'btn' + (answered ? '' : ' primary'), id: 'an-ask', disabled: !!why || s.asking || once || !!s.correction, text: s.asking ? 'Asking…' : answered ? 'Ask again' : 'Ask the analyst', onclick: () => ask() });
    const auto = el('label', { class: 'an-auto' }, el('input', { type: 'checkbox', id: 'an-auto', checked: ST.auto, disabled: !!why, onchange: (e) => { if (e.target.checked) { e.target.checked = false; planAuto(); } else { ST.auto = false; ST.plan = null; ST.autoNote = ''; draw(); } } }), el('span', { text: 'Ask on every setup of this run' }));
    host.appendChild(el('div', { class: 'f-actions' }, askBtn, auto, el('span', { class: 'ac-status', id: 'an-msg', role: 'status', text: s.asking ? 'One call to the provider…' : '' })));
    host.appendChild(el('p', { class: 'note', id: 'an-budget', text: budgetText(cost) }));
    if (why) host.appendChild(el('p', { class: 'note', id: 'an-blocked', text: cap(why) + '.' }));
    if (once) host.appendChild(el('p', { class: 'note', id: 'an-once', text: 'A test setup is decided once by each engine: the analyst is not asked again on it.' }));
    if (ST.plan && ST.planFor === id) {
      const P = ST.plan, box = el('div', { class: 'an-plan', id: 'an-plan', role: 'group', 'aria-label': 'Ask on every setup of this run' });
      if (P.loading) box.appendChild(el('p', { class: 'note', text: 'Estimating the cost of one ask…' }));
      else if (P.error) box.appendChild(el('p', { class: 'ac-err', text: `The estimate could not be made: ${P.error}. The switch stays off.` }));
      else { box.appendChild(el('p', { id: 'an-plan-text', text: P.text })); box.appendChild(el('div', { class: 'f-actions' }, el('button', { type: 'button', class: 'btn primary', id: 'an-plan-go', disabled: P.canAsk < 1, text: P.canAsk < 1 ? 'No budget left for it' : 'Start asking on every setup', onclick: () => { ST.auto = true; ST.plan = null; ST.autoNote = ''; draw(); if (!(s.res && s.res.decision)) ask(); } }), el('button', { type: 'button', class: 'btn', id: 'an-plan-no', text: 'Cancel', onclick: () => { ST.plan = null; draw(); } }))); }
      host.appendChild(box);
    }
    if (ST.auto) host.appendChild(el('p', { class: 'note', id: 'an-auto-on', text: 'On: the analyst is asked on every setup of this run until a budget or the call cap stops it. Untick the box to stop.' }));
    if (ST.autoNote) host.appendChild(el('p', { class: 'ac-warn', id: 'an-auto-note', role: 'status', text: ST.autoNote }));
    if (s.err) host.appendChild(el('p', { class: 'ac-err', id: 'an-err', role: 'alert', text: s.err + (/[.!?]$/.test(s.err) ? '' : '.') + ' Nothing was stored.' }));
    if (s.res) { const ans = el('div', { class: 'an-ans', id: 'an-answer', 'data-provider': s.res.provider || '', 'data-action': s.res.decision ? s.res.decision.action : '' }); answerView(ans, pt, s); host.appendChild(ans); }
    if (s.first && s.first.decision && s.first.attempt && !exam) { const m = el('div', { class: 'an-mentor', id: 'an-mentor' }); mentorView(m, pt, s); host.appendChild(m); }
  }

  // the block lives inside the decision card; the card is redrawn by the Train loop, so the block is put back whenever it is gone
  function draw() {
    const card = $('decision'); if (!card || card.hidden || !$('dec-action')) return;
    const pt = point(); if (!pt) return;
    let host = $('an-block');
    if (!host) { host = el('section', { class: 'an', id: 'an-block', 'aria-labelledby': 'an-title' }); const acts = card.querySelectorAll(':scope > .f-actions'), end = acts[acts.length - 1]; if (end) card.insertBefore(host, end); else card.appendChild(host); }   // above the Continue button
    fill(host);
    // "ask on every setup": a new setup with no answer yet is asked once
    const s = state(pt.cur.cand.id); if (ST.auto && ST.cost && ST.cost.enabled && !s.res && !s.asking && !s.err && !blocked(pt)) ask();
  }
  const card = $('decision'), replay = $('replay');
  if (card) new MutationObserver(() => { if (!$('an-block')) draw(); }).observe(card, { childList: true });
  if (replay) { const seen = () => { if (!replay.hidden && ST.cost === undefined && !ST.loading) loadCost(); }; new MutationObserver(seen).observe(replay, { attributes: true, attributeFilter: ['hidden'] }); seen(); }
  MXAN.state = ST; MXAN.redraw = draw;
})(typeof globalThis !== 'undefined' ? globalThis : this);

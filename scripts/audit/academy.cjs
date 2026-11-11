// Run: sh scripts/build.sh && node scripts/audit/academy.cjs
// Needs Playwright. No network: it starts scripts/academy-dev.mjs itself (recorded real candles from tests/fixtures/academy,
// the real /api/academy handler on a fresh file store) on ACADEMY_PORT, else PORT, else 8770, and stops it at the end.
// Not part of node --test. Exit code 1 on any failed check.
//
// MeridianX Academy end-to-end audit: the owner's whole learning loop on real persisted data.
//   a signed-out visitor sees only the sign-in card → the owner picks an edge → the replay loads real candles → the clock
//   pauses on a real candidate → a decision with evidence is shown and stored → an approval → the next setup is corrected
//   (WAIT, a reason, a text, chart marks) → the lesson is edited and saved → the same trade is replayed: the answer changes,
//   the lesson is applied, the verdict is "learned", attempts 1 and 2 are stored → unseen exam setups are tested with and
//   without lessons → after a reload the lesson, the attempts and the saved session are still there → the paper account
//   opens and closes a trade from its stored outcome → no future bar ever reached a decision → phone layout, text size,
//   contrast in the three themes, keyboard, no page errors.
// Then the other sections, on the rows that loop stored: Lessons (record, revise with the diff, switch off and on, a research
// draft saved inactive) → Progress (counts, agreement, recall beside new setups, mistakes, the spaced-repetition queue and
// "Replay this setup") → Research (studies, a study in full, the policy table, a notebook note) → Models → Costs → Audit →
// Blind arena (the engine's answer stays hidden until the mentor's is stored; the outcome is read last) → Session (notes on a
// missed opportunity and a right wait, verdicts, save, resume, end) → the rate limit (calls counted, a 429 waited out).
// Verification pass (11i, its own server and store): every replay control (play, pause, resume, step, jump, each speed, restart,
// save and resume), an approval, a rejection, a change to SELL with levels and a mark, the no-lesson control of a same-trade
// replay, and "Check earlier corrections" in the Lessons tab finding a later lesson that undid an earlier answer, naming it,
// and finding it mended after a revision. Access (11j): every route of the API answers 401 signed out (over HTTP, on a
// signed-out server) and 403 to a member who is not the owner.
// "What if" (alternatives on the candles after a decision): absent until the attempt is stored, then a table of the setup, the
// engine's answer and fixed variants; no later candle ever reaches a snapshot; the later candles leave the chart on Continue.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
// Six servers in all, by default on PORT, +1, +2 (this part) and +11, +12, +13 (the analyst part). Where only a few ports are free,
// ACADEMY_PORTS="main,verify,guest,off,fake,connector" names them; a port may be named again once its server has stopped
// (at most three run at one time: verify and guest never overlap, and the analyst part starts after this part has ended).
const PORTS = String(process.env.ACADEMY_PORTS || '').split(',').map((x) => +x.trim()).filter((x) => x > 0);
const PORT = PORTS[0] || process.env.ACADEMY_PORT || process.env.PORT || 8770, H = 'http://127.0.0.1:' + PORT;
const portOf = (i, d) => PORTS[i] || d;
const OUT = process.env.AUDIT_OUT || os.tmpdir() + '/';
const ROOT = path.join(__dirname, '..', '..');
const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/academy/manifest.json'), 'utf8'));
const EDGE = M.edge, iso = (t) => new Date(t * 1000).toISOString().slice(0, 10), stamp = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const R = []; const check = (name, ok, info = '') => { R.push({ name, ok: !!ok, info: String(info).slice(0, 200) }); if (!ok) console.log('  FAIL ' + name + (info ? ' :: ' + String(info).slice(0, 200) : '')); };
const txt = (p, sel) => p.$eval(sel, (e) => e.textContent.trim()).catch(() => '');
const vis = (p, sel) => p.$eval(sel, (e) => !!e.getClientRects().length && !e.hidden).catch(() => false);
const calls = (reqs, from, tag) => reqs.slice(from).filter((r) => r.path === '/api/academy' && !r.q._audit && (!tag || r.tag === tag));   // the page's own Academy calls
const what = (r) => (r.body ? r.body.action : 'get=' + r.q.get);
const api = (p, q) => p.evaluate(async (qs) => (await fetch('/api/academy?' + qs + '&_audit=1', { cache: 'no-store' })).json(), q);   // _audit marks the audit's own reads

// WCAG contrast of every visible text node's element against the background painted behind it (alpha blended up the tree)
const CONTRAST = String.raw`(() => {
  const parse = (c) => { const m = (c.match(/[\d.]+/g) || []).map(Number); if (/^color\(srgb/.test(c)) return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] == null ? 1 : m[3]]; return [m[0], m[1], m[2], m[3] == null ? 1 : m[3]]; };
  const over = (f, b) => { const a = f[3]; return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1]; };
  const bgOf = (e) => { const stack = []; for (let x = e; x; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; if (b && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(b)) { const c = parse(b); stack.push(c); if (c[3] >= 1) break; } } let out = [255, 255, 255, 1]; for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out); return out; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const bad = [], seen = new Set();
  const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const e = n.parentElement; if (!n.textContent.trim() || !e || seen.has(e) || e.closest('canvas, .chart, option, [hidden]')) continue; seen.add(e);
    const fold = e.closest('details:not([open])'); if (fold && !e.closest('summary')) continue;   // folded away: not painted (and its styles are not kept current)
    if (!e.getClientRects().length || e.closest('[disabled]')) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const bg = bgOf(e), fg = over(parse(cs.color), bg), l1 = lum(fg), l2 = lum(bg), r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize), big = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    if (r < (big ? 3 : 4.5)) bad.push(r.toFixed(2) + ' ' + e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '') + ' "' + n.textContent.trim().slice(0, 24) + '"');
  }
  return bad;
})()`;
// The contrast of the theme as it settles. A reading taken in the instant after a theme change can still hold the previous
// theme's text colour on a busy runner (seen on CI only, 10 Nov 2026: light-theme text measured on the midnight background for
// two elements, with nothing animating; the page has no theme switch, so no visitor sees that instant). So a failing reading
// is taken again 700 ms later: what is still below AA then is a real contrast fault and fails; what cleared is printed as a note.
const aa = async (pg) => {
  let bad = await pg.evaluate(CONTRAST); if (!bad.length) return bad;
  const first = bad.slice(0, 3).join(' ; '), n = bad.length; await pg.waitForTimeout(700); bad = await pg.evaluate(CONTRAST);
  if (!bad.length) console.log(`note AA: ${n} text(s) read below AA right after a theme change and were fine 700 ms later (${first})`);
  return bad;
};
// every visible text element is 12 px or more
const SMALL = String.raw`(() => { const out = [], seen = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const e = n.parentElement; if (!n.textContent.trim() || !e || seen.has(e) || !e.getClientRects().length || e.closest('canvas, .chart, script, style, option')) continue; seen.add(e); const px = parseFloat(getComputedStyle(e).fontSize); if (px < 12) out.push(px + ' ' + e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' "' + n.textContent.trim().slice(0, 20) + '"'); } return out; })()`;
// touch targets: visible buttons, inputs, selects and links that act as buttons are at least 44 px tall
const TAPS = String.raw`(() => [...document.querySelectorAll('main button, main select, main input:not([type=radio]):not([type=checkbox]), main textarea, main a.btn, main .seg label span, main summary')].filter((e) => e.getClientRects().length).map((e) => [Math.round(e.getBoundingClientRect().height), e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' ' + (e.textContent || '').trim().slice(0, 16)]).filter((x) => x[0] < 44).map((x) => x.join(' ')))()`;
const ENDLESS = String.raw`(() => document.getAnimations().filter((a) => { try { return a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running' && a.effect.target && a.effect.target.getClientRects().length; } catch (e) { return false; } }).map((a) => a.animationName || 'animation'))()`;

// "Cannot be saved without ..." (11 Nov 2026, round 2). Until then the Save button was disabled and a red "Problem" showed
// the moment a choice was made. Now Save is offered once a choice is made, what is still missing is a calm line (#<idp>-hint)
// and the red problem (#<idp>-err) appears only when Save is pressed with something missing. What is proved here is the same
// promise, by its effect: the missing thing is named before the press, the press shows the problem, and it sends NOTHING.
const refused = async (pg, idp, re, reqs) => {
  const calm = re.test(await txt(pg, `#${idp}-hint`)) && await vis(pg, `#${idp}-hint`) && !(await vis(pg, `#${idp}-err`)), n = reqs.length;
  await pg.click(`#${idp}-save`); await pg.waitForTimeout(200);
  return calm && re.test(await txt(pg, `#${idp}-err`)) && await vis(pg, `#${idp}-err`) && !(await vis(pg, `#${idp}-hint`)) && !reqs.slice(n).some((r) => r.method === 'POST');
};
// The page keeps itself under 24 Academy calls a minute (the site's firewall allows 30). The dev server has no firewall, so
// the audit lifts that pace to finish in minutes; it counts the calls instead, and one check runs with the pace on.
const NO_PACE = 'window.MXAC_PACE = 0;';
async function startServer(port = PORT, flags = []) {
  const H = 'http://127.0.0.1:' + port, PORT = port;   // this server's own address
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-audit-'));
  const proc = spawn(process.execPath, [path.join(ROOT, 'scripts/academy-dev.mjs'), ...flags], { env: { ...process.env, PORT: String(PORT), ACADEMY_STORE_DIR: store }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; proc.stdout.on('data', (d) => { log += d; }); proc.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 60; i++) {
    if (proc.exitCode != null) throw new Error('the dev server stopped: ' + log.trim() + ` (is port ${PORT} taken? set ACADEMY_PORT)`);
    try { const r = await fetch(H + '/api/academy?get=edges'); if (r.ok || r.status === 401) return { proc, store, H }; } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill(); throw new Error('the dev server did not answer on ' + H + ': ' + log.trim());
}

(async () => {
  const srv = await startServer(), b = await chromium.launch();
  const errs = [], reqs = [];
  const watch = (p, tag) => {
    p.on('pageerror', (e) => errs.push(tag + ': ' + e.message.split('\n')[0])); p.on('console', (m) => { if (m.type() === 'error') errs.push(tag + ' console: ' + m.text().slice(0, 160)); });
    p.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/academy' || u.pathname === '/md/bars') { let body = null; try { body = r.postDataJSON(); } catch (e) { /* GET */ } reqs.push({ tag, method: r.method(), path: u.pathname, q: Object.fromEntries(u.searchParams), body }); } });
  };
  const nextPoint = async (p) => { await p.waitForSelector('#dec-stored', { timeout: 60000 }); await p.waitForFunction(() => /stored/.test(document.getElementById('dec-stored').textContent) && /paused on a setup/.test(document.getElementById('clock-state').textContent), null, { timeout: 60000 }); };
  const goOn = async (p) => { await p.click('#continue'); await p.waitForSelector('#dec-action', { state: 'detached', timeout: 20000 }); };
  const setup = async (p, from, speed) => {
    await p.waitForSelector('#f-edge option', { state: 'attached', timeout: 15000 }); await p.selectOption('#f-edge', EDGE);
    await p.waitForFunction(() => /setups? in this range/.test(document.getElementById('f-count').textContent), null, { timeout: 15000 });
    if (from) { await p.fill('#f-from', from); await p.dispatchEvent('#f-from', 'change'); await p.waitForTimeout(300); }
    if (speed) { await p.evaluate(() => { const d = document.getElementById('setup-opts'); if (d) d.open = true; });   // the speed sits behind "More options" since the look pass
      await p.check(`input[name=speed][value="${speed}"]`, { force: true }); }
  };
  try {
    // ---- 1. a visitor who is not the owner: the card, and nothing is loaded ----
    {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }), p = await ctx.newPage(); watch(p, 'guest');
      await p.route(/\/api\/me(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: null }) }));
      await p.goto(H + '/academy', { waitUntil: 'load' }); await p.waitForTimeout(700);
      check('signed out: the owner-only card is shown', await vis(p, '#ac-gate') && /for the desk owner\. Sign in on the desk\./.test(await txt(p, '#ac-gate')), await txt(p, '#ac-gate'));
      check('signed out: the Academy itself stays hidden', !(await vis(p, '#ac-app')) && !(await vis(p, '#setup')));
      check('signed out: no Academy data and no candles are requested', reqs.filter((r) => r.tag === 'guest').length === 0, reqs.filter((r) => r.tag === 'guest').length);
      await p.unroute(/\/api\/me(\?|$)/); await p.route(/\/api\/me(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: { u: 'fred', name: 'Fred', role: 'reviewer' } }) }));
      await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(700);
      check('a signed-in member who is not the owner sees the same card and loads nothing', await vis(p, '#ac-gate') && !(await vis(p, '#ac-app')) && reqs.filter((r) => r.tag === 'guest').length === 0);
      await ctx.close();
    }

    // ---- 2. the owner: shell, tabs, setup ----
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' }); await ctx.addInitScript(NO_PACE); let p = await ctx.newPage(); watch(p, 'owner');
    await p.goto(H + '/academy', { waitUntil: 'load' }); await setup(p, null, null);
    check('title and heading are "MeridianX Academy"', (await p.title()) === 'MeridianX Academy' && (await txt(p, 'h1')) === 'MeridianX Academy', await p.title());
    const tabs = await p.$$eval('#ac-tabs [role=tab]', (l) => l.map((x) => x.textContent.trim()));
    check('nine sections as tabs, Train first', tabs.length === 9 && /^Train$/.test(tabs[0]) && ['Session', 'Blind arena', 'Progress', 'Lessons', 'Research', 'Models', 'Costs', 'Audit'].every((t, i) => tabs[i + 1].startsWith(t)), tabs.join(' | '));
    check('no tab is a placeholder any more', !tabs.some((t) => /next step/.test(t)) && !/Coming in the next build step/.test(await txt(p, '#ac-app')), tabs.join(' | '));
    await p.click('#tab-progress'); await p.waitForSelector('#pg-counts', { timeout: 15000 }).catch(() => {});
    check('a fresh store: Progress shows an honest empty state that says what to do, and hides the Train tab', /Nothing is stored for this edge yet\. Run a replay in the Train tab/.test(await txt(p, '#pg-counts')) && (await txt(p, '#pg-n-attempts')).startsWith('0') && /Nothing is queued/.test(await txt(p, '#pg-queue')) && !(await vis(p, '#setup')), await txt(p, '#pg-counts'));
    await p.evaluate(() => window.MXAC.registerTab('extra', { title: 'Extra', render: (sec, ctx) => { sec.textContent = 'registered:' + typeof ctx.api.get + ':' + ctx.edge() + ':' + typeof ctx.kit.newChart; } }));
    await p.click('#tab-extra'); check('MXAC.registerTab adds a section and hands it the API, the edge and the shared kit', (await txt(p, '#ac-extra')) === 'registered:function:' + EDGE + ':function', await txt(p, '#ac-extra'));
    await p.click('#tab-train');
    const edges = await p.$$eval('#f-edge option', (l) => l.map((o) => o.value));
    check('the seven real edges are offered', edges.length === 7 && ['replica', 'mosha-bo', 'gtrend', 'gtl', 'geg', 'gmp', 'nq-open'].every((e) => edges.includes(e)), edges.join(','));
    const info = await txt(p, '#edge-info');
    check('the edge shows market, plain-English definition, version and its limits', /XAU\/USD/.test(info) && /What it trades/.test(info) && /Rule version\s*[0-9a-f]{12}/.test(info) && /Limits/.test(info) && /n = \d+ trades/.test(info), info.slice(0, 120));
    check('defaults: the edge\'s signal timeframe, 100,000, 0.25 %, the edge\'s cost, expert, train', (await p.inputValue('#f-tf')) === '5m' && (await p.inputValue('#f-balance')) === '100000' && (await p.inputValue('#f-risk')) === '0.25' && +(await p.inputValue('#f-spread')) === 0.15 && (await p.inputValue('#f-diff')) === 'expert' && await p.isChecked('input[name=mode][value=train]'));
    const cands = (await api(p, `get=candidates&edge=${EDGE}&pool=train&limit=5000`)).candidates, exams0 = (await api(p, `get=candidates&edge=${EDGE}&pool=exam&limit=5000`)).candidates;
    check('the fixture window holds several real train and exam candidates', cands.length >= 3 && exams0.length >= 3 && cands.every((c) => c.R === undefined && c.netR === undefined && c.exitT === undefined), `${cands.length} train, ${exams0.length} exam`);
    check('the default range ends on the last train candidate and the count is shown', (await p.inputValue('#f-to')) === iso(cands[cands.length - 1].t) && new RegExp(`^${cands.length} train setups in this range`).test(await txt(p, '#f-count')), await txt(p, '#f-count'));
    await setup(p, iso(cands[0].t), null);
    await p.click('#start'); await p.waitForSelector('#replay:not([hidden])', { timeout: 60000 }).catch(() => {});
    check('the replay loads real candles for 5m, 15m, 1h, 4h and 1d', await vis(p, '#chart canvas') && await vis(p, '#htf canvas') && ['5m', '15m', '1h', '4h', '1d'].every((tf) => reqs.some((r) => r.path === '/md/bars' && r.q.tf === tf)), (await txt(p, '#setup-err')) || (await txt(p, '#chart-meta')));
    check('the chart names its data source', /OANDA/.test(await txt(p, '#chart-meta')), await txt(p, '#chart-meta'));
    const t0 = await txt(p, '#clock-time');
    check('what if: before any attempt is stored there is no card and no button (absent, not disabled)', !(await vis(p, '#whatif')) && (await p.$$('#whatif-run, #whatif-table, #whatif button')).length === 0 && (await p.evaluate(() => window.MXAC.whatIfLoads.length)) === 0);

    // ---- 3. keyboard: Space plays and pauses, the right arrow steps one candle ----
    await p.click('h1'); await p.keyboard.press('Space'); await p.waitForTimeout(450);
    const playing = await txt(p, '#clock-state'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
    const t1 = await txt(p, '#clock-time'), paused = await txt(p, '#clock-state');
    check('Space plays, Space pauses', /playing/.test(playing) && paused === 'paused' && t1 !== t0, `${playing} / ${paused} / ${t0} → ${t1}`);
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150); const t2 = await txt(p, '#clock-time');
    check('the right arrow steps exactly one 5-minute candle', Date.parse(t2.replace(' UTC', 'Z')) - Date.parse(t1.replace(' UTC', 'Z')) === 300000, `${t1} → ${t2}`);
    await p.click('#htf-sw [data-htf="4h"]'); check('the higher-timeframe chart switches 1h / 4h / 1d', (await p.getAttribute('#htf-sw [data-htf="4h"]', 'aria-pressed')) === 'true');
    await p.fill('#c-jump-at', iso(cands[0].t) + 'T06:00'); await p.click('#c-jump'); check('jump to a date moves the clock', (await txt(p, '#clock-time')) === iso(cands[0].t) + ' 06:00 UTC', await txt(p, '#clock-time'));
    await p.click('#c-restart'); check('restart goes back to the start of the range', (await txt(p, '#clock-time')) === t0, await txt(p, '#clock-time'));
    await p.click('#c-speed [data-speed="100"]');

    // ---- 4. the clock pauses on a real candidate; a decision with evidence is shown and stored ----
    const m4 = reqs.length; await p.click('#c-play'); await nextPoint(p);
    const first4 = calls(reqs, m4, 'owner').map(what);
    check('the first train decision costs two Academy calls: the session saved once, and the attempt', first4.join() === 'session.save,attempt', first4.join());
    const c1 = cands[0], snap1 = await p.evaluate(() => { const s = window.MXAC.lastSnapshot, sec = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }; return { t: s.t, cand: s.cand && s.cand.id, candKeys: s.cand ? Object.keys(s.cand) : [], n: Object.fromEntries(Object.keys(s.bars).map((k) => [k, s.bars[k].length])), late: Object.keys(s.bars).reduce((a, k) => a + s.bars[k].filter((b) => b.time + sec[k] > s.t).length, 0) }; });
    check('the clock pauses exactly on the first real train candidate', (await txt(p, '#clock-time')) === stamp(c1.t) && snap1.cand === c1.id && snap1.t === c1.t, `${await txt(p, '#clock-time')} ${snap1.cand}`);
    check('the snapshot holds only bars closed at the decision time, 300 a timeframe, and no outcome field', snap1.late === 0 && ['5m', '15m', '1h', '4h', '1d'].every((k) => snap1.n[k] >= 100 && snap1.n[k] <= 300) && !snap1.candKeys.some((k) => ['R', 'netR', 'exitT', 'exit', 'mfeR', 'maeR'].includes(k)), JSON.stringify(snap1.n));
    const a1 = await txt(p, '#dec-action');
    check('the decision panel: BUY / SELL / WAIT, the confidence word, the thesis', /^(BUY|SELL|WAIT)$/.test(a1) && /confidence\s*(low|medium|high)/.test(await txt(p, '#dec-conf')) && (await txt(p, '#dec-thesis')).length > 30, `${a1} / ${await txt(p, '#dec-conf')}`);
    check('evidence for and against as two lists with weights', (await p.$$('#dec-support li:not(.none)')).length + (await p.$$('#dec-against li:not(.none)')).length >= 2 && (await p.$$eval('#decision .ev-list li:not(.none) .w', (l) => l.every((x) => /^[+−][\d.]+$/.test(x.textContent)))), `${(await p.$$('#dec-support li')).length} for, ${(await p.$$('#dec-against li')).length} against`);
    const dtext = await txt(p, '#decision');
    check('the panel also shows reasons, uncertainty, invalidation, risk, similar cases, lessons and versions', ['Uncertainty', 'What would prove it wrong', 'Reward to risk', 'Stop distance', 'Risk engine', 'Similar past cases', 'Lessons applied', 'policy policy-', 'edge ', 'data OANDA', 'snapshot '].every((s) => dtext.includes(s)), dtext.slice(0, 80));
    check('similar past cases come with n, win rate and average R (from setups that had finished before this one)', /^n = \d+, win rate \d+ %, average [+-]?\d+\.\d\dR after costs\./.test(await txt(p, '#dec-similar')) && /earlier train setups/.test(await txt(p, '#dec-similar')), await txt(p, '#dec-similar'));
    check('the snapshot is built from the edge\'s context timeframes and the release calendar (scheduled times only)', /Calendar: scheduled CPI, NFP, FOMC times only/.test(await txt(p, '#chart-legend')) && await p.evaluate(() => { const s = window.MXAC.lastSnapshot; return Array.isArray(s.events) && Array.isArray(s.schedule) && s.events.every((e) => e.t <= s.t) && s.schedule.every((e) => e.t > s.t && Object.keys(e).sort().join() === 'impact,t,title'); }), await txt(p, '#chart-legend'));
    let att = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c1.id)}`)).attempts;
    check('the attempt is stored at once: n = 1, mode train, with the snapshot hash', att.length === 1 && att[0].n === 1 && att[0].mode === 'train' && /^[0-9a-f]{16}$/.test(att[0].snapshotHash) && att[0].decision.action === a1 && /^se_/.test(att[0].sessionId || ''), JSON.stringify(att.map((a) => [a.n, a.mode])));
    check('the candidate\'s levels can be placed on the chart (entry inside the price scale)', await p.evaluate((e) => !!window.MXAC.chartPoint(e), c1.entry));
    check('what if: once the attempt is stored the card is there, and it warns that no verdict has been given yet', await vis(p, '#whatif-run') && /The attempt for this setup is stored/.test(await txt(p, '#whatif')) && /hindsight is for study, not evidence/.test(await txt(p, '#whatif')) && /nothing here is stored/.test(await txt(p, '#whatif')) && /You have not judged this decision yet/.test(await txt(p, '#whatif-hindsight')) && (await p.evaluate(() => window.MXAC.whatIfLoads.length)) === 0, (await txt(p, '#whatif')).slice(0, 120));
    await p.screenshot({ path: OUT + 'academy-1-decision.png', fullPage: true });
    // usability pass (11 Nov 2026): the decision point is announced under the chart, and a half-written verdict is not dropped silently
    check('the decision point is announced under the chart, with the way to the decision and to the verdict', await vis(p, '#point-bar') && /^Setup reached: the engine says (BUY|SELL|WAIT) \((low|medium|high) confidence\)\. Read why, then give your verdict\.$/.test(await txt(p, '#point-text')) && (await txt(p, '#point-action')) === a1 && await vis(p, '#point-decision') && await vis(p, '#point-verdict'), await txt(p, '#point-bar'));
    const folds = await p.$$eval('#decision details.dfold', (l) => l.map((d) => d.dataset.fold));
    // round 2 (11 Nov 2026): the card folds its detail (nothing removed), and the engine's own answer is not offered as a "change"
    check('the decision card keeps the answer and its main reasons in sight and folds the detail away, all of it still there', await vis(p, '#dec-main') && (await p.$$('#dec-main li:not(.none)')).length >= 1 && (await p.$$eval('#decision details.dfold', (l) => l.every((d) => !d.open))) && (await txt(p, '#dec-support')).length > 10 && (await txt(p, '#dec-similar')).length > 10 && ['evidence', 'doubt', 'risk', 'similar', 'lessons'].every((k) => folds.includes(k)), folds.join());
    await p.click('#dec-fold-evidence > summary'); check('a folded part opens on a click', await p.$eval('#dec-fold-evidence', (d) => d.open) && await p.$eval('#dec-support', (e) => e.checkVisibility({ contentVisibilityAuto: true, checkVisibilityCSS: true })));
    check('the engine\'s own answer is not offered as a change: no "Change to WAIT" on a WAIT, its own BUY / SELL only on other levels', a1 === 'WAIT' ? (await p.$$('#mentor [data-choice="WAIT"]')).length === 0 && (await p.$$('#mentor [data-choice]')).length === 4 : /^Keep (BUY|SELL), other levels$/.test(await txt(p, `#mentor [data-choice="${a1}"]`)) && (await p.$$('#mentor [data-choice]')).length === 5, await p.$$eval('#mentor [data-choice]', (l) => l.map((x) => x.textContent).join(' | ')));
    { const n0 = reqs.length; await p.click('#mentor [data-choice="reject"]'); await p.fill('#m-text', 'half written'); await p.click('#continue'); await p.waitForTimeout(300);
      check('Continue on a half-written verdict asks first: the point stays, the words stay, nothing is sent', /paused on a setup/.test(await txt(p, '#clock-state')) && (await p.inputValue('#m-text')) === 'half written' && /not saved yet/.test(await txt(p, '#continue-msg')) && /not saved yet/.test(await txt(p, '#point-text')) && await vis(p, '#dec-action') && calls(reqs, n0, 'owner').length === 0, await txt(p, '#continue-msg'));
      await p.fill('#m-text', ''); }
    // approve it and go on
    await p.click('#mentor [data-choice="approve"]'); await p.click('#m-save'); await p.waitForFunction(() => /Correction saved/.test(document.getElementById('m-msg').textContent), null, { timeout: 15000 });
    check('once the verdict is stored the line under the chart says so and the question is gone', /Your verdict is saved: continue when you are ready\.$/.test(await txt(p, '#point-text')) && (await txt(p, '#continue-msg')) === '' && /Verdict saved/.test(await txt(p, '#replay-msg')), await txt(p, '#point-text'));
    check('an approval is stored and a lesson draft is offered as optional', /optional/.test(await txt(p, '#lesson h2')) && await vis(p, '#prove-run'));
    // what if, on the first setup: the table, nothing near a snapshot, the later candles on the chart only on request
    {
      const before = await p.evaluate(() => { window.__snap = window.MXAC.lastSnapshot; return { n: window.MXAC.checks.snapshots, f: window.MXAC.checks.future }; }), mw = reqs.length, storedFirst = reqs.slice(0, mw).some((r) => r.body && r.body.action === 'attempt' && r.body.attempt.candidateId === c1.id);
      check('what if: after a verdict the hindsight warning is gone', (await p.$$('#whatif-hindsight')).length === 0 && await vis(p, '#whatif-run'));
      await p.click('#whatif-run'); await p.waitForSelector('#whatif-table', { timeout: 30000 });
      const wrows = await p.$$eval('#whatif-table tbody tr', (l) => l.map((r) => [r.dataset.alt, r.dataset.filled, ...[...r.cells].map((c) => c.textContent.trim())]));
      const keys = wrows.map((r) => r[0]), must = ['setup', 'stop-half', 'stop-wide', 'target-1r', 'target-2r', 'target-3r', 'late'];
      check('what if: one row an alternative: the setup, the engine\'s answer when it differs, then the fixed variants', keys[0] === 'setup' && must.every((k) => keys.includes(k)) && keys.length === must.length + (a1 === 'WAIT' ? 1 : 0) && (a1 !== 'WAIT' || (keys[1] === 'engine' && /WAIT/.test(wrows[1][2]) && /^\+?0\.00R$/.test(wrows[1][3]))), keys.join(','));
      check('what if: each row says filled or not, net R after costs, the exit, best and worst in R and the exit time', wrows.every((r) => (r[1] === 'yes' ? /^filled at [\d,.]+$/.test(r[5]) && /^[+-]?\d+\.\d\dR$/.test(r[3]) && /^(stop|target|still open at the last candle read)$/.test(r[4]) && /^\+?\d+\.\d\dR$/.test(r[7]) && /^-?\d+\.\d\dR$/.test(r[8]) && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(r[9]) : /^(not filled|no trade)$/.test(r[5]) && /never filled|no trade|not valid/.test(r[4]))) && wrows.filter((r) => r[1] === 'yes').length >= 4, JSON.stringify(wrows[0]));
      const wl = await p.evaluate(() => window.MXAC.whatIfLoads);
      check('what if: the candles asked for start at the decision time, on the signal timeframe, and only after the attempt was stored', wl.length === 1 && wl[0].candidateId === c1.id && /^at_/.test(wl[0].attemptId) && wl[0].from === c1.t && wl[0].tf === '5m' && wl[0].to === c1.t + 97 * 300 && storedFirst && calls(reqs, mw, 'owner').map(what).join() === 'get=outcome', JSON.stringify(wl));
      check('what if: the conservative rules, the costs and the candles read are stated under the table', /when one candle touches both the stop and the target, the stop is taken/.test(await txt(p, '#whatif-rules')) && /a stop that gaps is filled at the open \(worse\)/.test(await txt(p, '#whatif-rules')) && /Costs: 0\.15 a round trip/.test(await txt(p, '#whatif-rules')) && /^Candles: \d+ of 5m from .+ UTC to .+ UTC \(OANDA/.test(await txt(p, '#whatif-window')) && /maximum hold \(8 hours\)/.test(await txt(p, '#whatif-window')), await txt(p, '#whatif-window'));
      const cmpNote = await txt(p, '#whatif-compare'), match = await p.getAttribute('#whatif-compare', 'data-match');
      check('what if: the first row is compared with the stored result, and a difference is said plainly', (match === 'yes' && /^The first row agrees with the stored result/.test(cmpNote)) || (match === 'no' && /does NOT match the stored result/.test(cmpNote) && /the candles differ/.test(cmpNote)), `${match}: ${cmpNote.slice(0, 160)}`);
      const after = await p.evaluate(() => ({ same: window.__snap === window.MXAC.lastSnapshot, n: window.MXAC.checks.snapshots, f: window.MXAC.checks.future, sec: { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 }, late: Object.keys(window.MXAC.lastSnapshot.bars).reduce((a, k) => a + window.MXAC.lastSnapshot.bars[k].filter((b) => b.time + ({ '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 })[k] > window.MXAC.lastSnapshot.t).length, 0) }));
      check('what if: no snapshot was made or touched: the last one is the same object, the count is unchanged, no future bar', after.same && after.n === before.n && after.f === 0 && before.f === 0 && after.late === 0, JSON.stringify({ same: after.same, n: [before.n, after.n], f: after.f }));
      check('what if: the later candles are not on the chart until asked for', (await p.evaluate(() => window.MXAC.laterShown())) === 0 && (await p.getAttribute('#whatif-show', 'aria-pressed')) === 'false');
      await p.click('#whatif-show'); await p.waitForFunction(() => window.MXAC.laterShown() > 0, null, { timeout: 15000 }).catch(() => {});
      check('what if: "Show these candles on the chart" is a separate step and marks them as after the decision', (await p.evaluate(() => window.MXAC.laterShown())) > 10 && (await p.getAttribute('#whatif-show', 'aria-pressed')) === 'true' && /came AFTER the decision\. They go away when you continue\./.test(await txt(p, '#whatif-shown')) && (await p.evaluate(() => window.MXAC.checks.future)) === 0, await txt(p, '#whatif-shown'));
      await p.screenshot({ path: OUT + 'academy-1b-whatif.png', fullPage: true });
    }
    await goOn(p);
    check('one press of Continue was enough after the verdict was stored, and the line under the chart is gone', !(await vis(p, '#point-bar')));
    check('what if: on Continue the later candles leave the chart and the card goes away', (await p.evaluate(() => window.MXAC.laterShown())) === 0 && !(await vis(p, '#whatif')) && (await p.$$('#whatif-run')).length === 0);

    // ---- 5. the next setup the engine takes: correct it to WAIT ----
    let cur = null, first = null, eventWait = '';
    const perSetup = [];
    for (let i = 1; i < cands.length; i++) { const m5 = reqs.length; await nextPoint(p); perSetup.push(calls(reqs, m5, 'owner').map(what).filter((x) => x !== 'get=outcome')); first = await txt(p, '#dec-action'); const now = await txt(p, '#clock-time'); cur = cands.find((c) => stamp(c.t) === now); if (first !== 'WAIT') break; const d = await txt(p, '#decision'); if (/event risk: /.test(d)) eventWait = d.match(/event risk: [^.]{0,80}/)[0]; await goOn(p); }
    check('a setup hours before a scheduled release waits on event risk and names the release', /Non-Farm Payrolls/.test(eventWait), eventWait);
    // TWO calls since 11 Nov 2026 (round 2, the cost was approved): the attempt, then the session's position, so a reload returns to
    // the latest setup instead of the first one. Before that it was ONE (the attempt) and the position was saved at the first decision only.
    check('every later train decision costs TWO Academy calls (the attempt, then the session position): lessons, past cases and calendar were read once for the run', perSetup.length >= 1 && perSetup.every((x) => x.join() === 'attempt,session.save'), `calls per setup: ${perSetup.map((x) => x.length).join(',')} (${perSetup[0] && perSetup[0].join('+')})`);
    check('the run read its lists once: one history read with before = the end of the range, none per setup', reqs.filter((r) => r.tag === 'owner' && r.q.get === 'history').length === 1 && reqs.filter((r) => r.tag === 'owner' && r.q.get === 'history')[0].q.before != null && !reqs.some((r) => r.q.get === 'history' && r.q.cand), JSON.stringify(reqs.filter((r) => r.q.get === 'history').map((r) => r.q)));
    // a reload keeps the place: no "Save session" was pressed in this run, yet another tab of the same browser is offered the
    // latest setup (not the first one) and Resume lands on it, with its stored attempt; that tab only reads
    if (cur) {
      const p2 = await ctx.newPage(); watch(p2, 'reload'); const n2 = reqs.length; await p2.goto(H + '/academy', { waitUntil: 'load' });
      await p2.waitForSelector('#resume-now:not([hidden])', { timeout: 15000 }).catch(() => {});
      const offer = await txt(p2, '#resume-now-text'), edge2 = await p2.inputValue('#f-edge');
      await p2.click('#resume-now-go').catch(() => {}); await p2.waitForSelector('#dec-action', { timeout: 60000 }).catch(() => {});
      check('a reload keeps your place: the latest setup is offered and Resume lands on it, on the edge used last, reading only', cur.t !== c1.t && offer.includes('at ' + stamp(cur.t)) && edge2 === EDGE && (await txt(p2, '#clock-time')) === stamp(cur.t) && (await txt(p2, '#dec-action')) === first && /Attempt 1 stored/.test(await txt(p2, '#dec-stored')) && !reqs.slice(n2).some((r) => r.tag === 'reload' && r.method === 'POST'), `${offer} | ${await txt(p2, '#clock-time')} ${await txt(p2, '#dec-action')}`);
      await p2.close();
    }
    check('the part of the card opened on the first setup is still open on this one (remembered)', await p.$eval('#dec-fold-evidence', (d) => d.open).catch(() => false) && await vis(p, '#dec-support'));
    check('the engine takes a later real setup (BUY or SELL), so there is something to correct', (first === 'BUY' || first === 'SELL') && !!cur, `${first} at ${await txt(p, '#clock-time')}`);
    // mentor lines: change to the same action, drag the stop line, see the field follow
    await p.click(`#mentor [data-choice="${first}"]`);
    const stop0 = +(await p.inputValue('#m-stop')), pt = await p.evaluate((v) => window.MXAC.chartPoint(v, 0.4), stop0);
    check('a changed BUY / SELL starts from the setup\'s own levels', stop0 === cur.stop && +(await p.inputValue('#m-entry')) === cur.entry, `${stop0} vs ${cur.stop}`);
    if (pt) { const dy = first === 'SELL' ? -24 : 24; await p.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); const q = await p.evaluate((v) => window.MXAC.chartPoint(v, 0.4), stop0); await p.mouse.move(q.x, q.y); await p.mouse.down(); await p.mouse.move(q.x, q.y + dy / 2); await p.mouse.move(q.x, q.y + dy); await p.mouse.up(); }
    const stop1 = +(await p.inputValue('#m-stop'));
    check('dragging the Mentor stop line on the chart moves the stop field (away from the entry)', !!pt && stop1 !== stop0 && Math.abs(stop1 - cur.entry) > Math.abs(stop0 - cur.entry), `${stop0} → ${stop1}`);
    check('"the engine\'s own answer" is refused only while nothing differs', !(await p.isDisabled('#m-save')) || /reason/.test(await txt(p, '#m-err')), await txt(p, '#m-err'));
    // chart marks: a level by a click, a zone by a drag, and delete
    await p.selectOption('#a-kind', 'liquidity'); await p.click('#a-arm');
    { const q = await p.evaluate((v) => window.MXAC.chartPoint(v, 0.5), cur.entry); await p.mouse.click(q.x, q.y - 30); }
    await p.selectOption('#a-kind', 'supply-demand'); await p.click('#a-arm');
    { const q = await p.evaluate((v) => window.MXAC.chartPoint(v, 0.3), cur.entry); await p.mouse.move(q.x, q.y + 20); await p.mouse.down(); await p.mouse.move(q.x + 40, q.y + 40); await p.mouse.move(q.x + 90, q.y + 60); await p.mouse.up(); }
    const marks = await p.$$eval('#a-list li:not(.none)', (l) => l.map((x) => x.textContent));
    check('chart marks: a click gives a level, a drag gives a zone, both listed', marks.length === 2 && /liquidity level/.test(marks[0]) && /supply \/ demand zone/.test(marks[1]) && (await p.$$('#zones i')).length === 1, marks.join(' | '));
    await p.selectOption('#a-kind', 'structure'); await p.click('#a-arm'); { const q = await p.evaluate((v) => window.MXAC.chartPoint(v, 0.6), cur.entry); await p.mouse.click(q.x, q.y + 12); }
    await p.click('#a-list li:nth-child(3) button'); check('a mark can be deleted', (await p.$$('#a-list li:not(.none)')).length === 2);
    // the correction itself
    await p.click('#mentor [data-choice="WAIT"]');
    check('a correction without a reason or a text cannot be saved: named calmly first, the problem on Save, nothing sent', await refused(p, 'm', /Say why/, reqs), await txt(p, '#m-err'));
    await p.click('#mentor [data-reason="session"]'); await p.click('#mentor [data-reason="wrong-structure"]'); await p.selectOption('#m-bias', 'neutral');
    await p.fill('#m-text', 'Audit: not in this session; wait for a second confirmation.');
    await p.click('#m-save'); await p.waitForFunction(() => /Correction saved/.test(document.getElementById('m-msg').textContent), null, { timeout: 15000 });
    const corr = reqs.filter((r) => r.body && r.body.action === 'correct').pop().body.correction;
    check('POST correct carries verdict, action, reason, text, bias, marks and the error class', corr.verdict === 'change' && corr.action === 'WAIT' && corr.reasons.join() === 'session,wrong-structure' && /second confirmation/.test(corr.text) && corr.bias === 'neutral' && corr.annotations.length === 2 && corr.annotations[1].price2 != null && typeof corr.errorClass === 'string' && corr.errorClass.length > 0, JSON.stringify({ e: corr.errorClass, a: corr.annotations.length }));

    // ---- 6. the lesson draft: plain English, editable, validated, saved ----
    const plain0 = await txt(p, '#lesson-plain');
    check('the lesson draft reads in plain English (When … → Then: WAIT)', /^When: .+ → Then: WAIT$/.test(plain0), plain0);
    const conds0 = await p.$$eval('#lesson-conds .cond', (l) => l.map((x) => x.dataset.cond));
    for (const k of conds0.slice(1).reverse()) await p.click(`#lesson-conds .cond[data-cond="${k}"] [data-del]`);     // keep the first condition only (the session)
    const plain1 = await txt(p, '#lesson-plain'), conds1 = await p.$$eval('#lesson-conds .cond', (l) => l.map((x) => x.dataset.cond));
    check('conditions can be taken out and the sentence follows', conds0.length > 1 && conds0[0] === 'session' && conds1.join() === 'session' && /^When: session = \w+ → Then: WAIT$/.test(plain1), `${plain0} => ${plain1}`);
    const sess = await p.inputValue('#lesson-conds .cond input');
    await p.fill('#lesson-conds .cond input', ''); check('an empty condition value is refused', await p.isDisabled('#lesson-save') && await vis(p, '#lesson-err'), await txt(p, '#lesson-err'));
    await p.fill('#lesson-conds .cond input', sess); await p.click('#lesson-add'); const added = (await p.$$('#lesson-conds .cond')).length; await p.click('#lesson-conds .cond:last-child [data-del]');
    check('a condition can be added and edited', added === 2 && (await p.$$('#lesson-conds .cond')).length === 1 && (await txt(p, '#lesson-plain')) === plain1);
    await p.selectOption('#lesson-action', 'SKIP'); const plainSkip = await txt(p, '#lesson-plain'); await p.selectOption('#lesson-action', 'WAIT');
    check('the effect is editable', /REFUSE/.test(plainSkip) && /Then: WAIT$/.test(await txt(p, '#lesson-plain')), plainSkip);
    await p.fill('#lesson-title', 'Audit lesson: wait in this session');
    await p.click('#lesson-save'); await p.waitForFunction(() => /Lesson saved/.test(document.getElementById('lesson-msg').textContent), null, { timeout: 15000 });
    const lessons = (await api(p, `get=lessons&edge=${EDGE}&active=1`)).lessons;
    check('the lesson is stored (version 1, active, linked to the attempt and the correction)', lessons.length === 1 && lessons[0].version === 1 && lessons[0].active && lessons[0].then.action === 'WAIT' && /^at_/.test(lessons[0].source.attemptId) && /^co_/.test(lessons[0].source.correctionId) && lessons[0].source.candidateId === cur.id, JSON.stringify(lessons.map((l) => l.when)));

    // ---- 7. replay and prove ----
    await p.click('#prove-run'); await p.waitForSelector('#prove-verdict', { timeout: 20000 });
    const second = await txt(p, '#dec-action');
    check('same decision point is proven by the snapshot hash', /same decision point ✓/.test(await txt(p, '#prove-hash')), await txt(p, '#prove-hash'));
    check('the second attempt differs from the first', second === 'WAIT' && second !== first, `${first} → ${second}`);
    check('the lesson is listed as applied', (await p.$$('#dec-lessons li[data-applied="yes"]')).length === 1 && /Audit lesson/.test(await txt(p, '#dec-lessons')) && /Lesson applied: yes/.test(await txt(p, '#prove-lesson')), await txt(p, '#dec-lessons'));
    check('the verdict is "learned"', (await p.getAttribute('#prove-verdict', 'data-verdict')) === 'learned' && /^Learned\./.test(await txt(p, '#prove-verdict')), await txt(p, '#prove-verdict'));
    check('the control is shown: the same replay with every lesson switched off gives the FIRST answer, so the lesson alone made the change', (await p.getAttribute('#prove-control', 'data-same')) === 'yes' && new RegExp(`^Control: the same replay with every lesson switched off gives ${first}, the first answer\\. Whatever changed came from the lessons in force and from nothing else\\.$`).test(await txt(p, '#prove-control')), await txt(p, '#prove-control'));
    const cmp = await p.$$eval('#prove-table tr', (l) => l.map((r) => [...r.cells].map((c) => c.textContent.trim()).join('|')));
    check('side by side: attempt 1, attempt 2 and the mentor\'s correction, and the changed fields', cmp[0] === '|Attempt 1|Attempt 2|Mentor' && cmp[1] === `Action|${first}|WAIT|WAIT` && /Changed between the two attempts: action/.test(await txt(p, '#prove-changed')), cmp.slice(0, 2).join(' / '));
    check('the limit is stated: recall, not generalisation', (await txt(p, '#prove')).includes('Passing the same trade shows recall, not generalisation.'));
    await p.waitForFunction(() => document.querySelectorAll('#attempts-table tbody tr').length === 2, null, { timeout: 10000 }).catch(() => {});
    att = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(cur.id)}`)).attempts;
    check('the stored attempts are n = 1 (train) and n = 2 (replay-same) on one snapshot hash', att.length === 2 && att[0].n === 1 && att[1].n === 2 && att[0].mode === 'train' && att[1].mode === 'replay-same' && att[0].snapshotHash === att[1].snapshotHash && att[0].decision.action === first && att[1].decision.action === 'WAIT' && (await p.$$eval('#attempts-table tbody tr', (l) => l.map((r) => r.dataset.n).join(','))) === '1,2', JSON.stringify(att.map((a) => [a.n, a.mode, a.decision.action])));
    const stats = (await api(p, `get=lessons&edge=${EDGE}&active=1`)).lessons[0].stats;
    check('the lesson\'s counters are updated (applied 1, same-trade replay passed 1)', stats.applied === 1 && stats.replayPass === 1 && stats.replayFail === 0, JSON.stringify(stats));
    await p.click('#whatif-run'); await p.waitForSelector('#whatif-table', { timeout: 30000 });
    { const k7 = await p.$$eval('#whatif-table tbody tr', (l) => l.map((r) => r.dataset.alt + ':' + r.cells[0].textContent.trim()));
      check('what if: after the lesson the engine\'s WAIT is its own row (0R) beside the setup it no longer takes', k7.length === 8 && /^setup:/.test(k7[0]) && k7[1] === 'engine:The engine\'s answer: WAIT' && !k7.some((x) => /^mentor:/.test(x)), k7.slice(0, 3).join(' | ')); }
    await p.click('#prove-run'); await p.waitForFunction(() => document.querySelectorAll('#attempts-table tbody tr').length === 3, null, { timeout: 20000 }).catch(() => {});
    check('the replay can be repeated (attempt 3)', (await p.$$('#attempts-table tbody tr')).length === 3 && (await p.getAttribute('#prove-verdict', 'data-verdict')) === 'learned');
    await p.screenshot({ path: OUT + 'academy-2-prove.png', fullPage: true });

    // ---- 8. save the session ----
    await p.click('#sess-save'); await p.waitForFunction(() => /Session saved/.test(document.getElementById('replay-msg').textContent), null, { timeout: 15000 });
    const sessions = (await api(p, 'get=sessions')).sessions;
    check('the session is saved (one replay session, paused on this setup)', sessions.length === 1 && sessions[0].kind === 'replay' && sessions[0].candidateId === cur.id && sessions[0].t === cur.t, JSON.stringify(sessions.map((s) => [s.id, s.status, s.t])));

    // ---- 9. test on new setups: unseen exam candidates, with and without lessons, stored and shown apart ----
    const mark = reqs.length;
    await p.click('#exam-run'); await p.waitForFunction(() => /tested and stored|could not run|No unseen/.test(document.getElementById('exam-msg').textContent), null, { timeout: 120000 });
    const ex = (await api(p, `get=exams&edge=${EDGE}`)).exams, want = Math.min(10, exams0.length);
    check('exam results are stored: one per unseen setup, each with its stored attempt', ex.length === want && ex.every((e) => /^at_/.test(e.attemptId) && e.withLessons && e.withoutLessons && exams0.some((c) => c.id === e.candidateId)), `${ex.length} of ${want}: ${await txt(p, '#exam-msg')}`);
    const exAtt = (await api(p, `get=attempts&edge=${EDGE}&limit=2000`)).attempts.filter((a) => a.mode === 'exam');
    check('each exam setup has exactly one attempt, mode exam', exAtt.length === want && new Set(exAtt.map((a) => a.candidateId)).size === want && exAtt.every((a) => a.n === 1));
    const after = reqs.slice(mark), lastResult = after.map((r) => !!(r.body && r.body.action === 'exam.result')).lastIndexOf(true), firstRead = after.findIndex((r) => r.q.get === 'exams');
    const examCalls = calls(after, 0, 'owner').map(what), perExam = examCalls.filter((x) => x === 'attempt' || x === 'exam.result').length / want;
    check(`a test on new setups costs two calls a setup and a handful around them (${want} setups: ${examCalls.length} calls)`, perExam === 2 && examCalls.filter((x) => x === 'get=history').length <= 1 && examCalls.length <= 2 * want + 6, examCalls.join(' '));
    check('the test names its progress, setup by setup', /^\d+ new setups? tested and stored/.test(await txt(p, '#exam-msg')), await txt(p, '#exam-msg'));
    check('no outcome is read before its attempt is stored', lastResult >= 0 && firstRead > lastResult && !after.some((r) => r.q.get === 'outcome') && after.filter((r) => r.body && r.body.action === 'attempt').every((r) => r.body.attempt.mode === 'exam'), `last result #${lastResult}, first read #${firstRead}`);
    const sum = await txt(p, '#exam-summary'), changed = ex.filter((e) => e.withLessons.action !== e.withoutLessons.action).length, matched = ex.filter((e) => e.lessonIds.length).length;
    check('the new-setup panel shows matched, changed and net R with / without, with n', await vis(p, '#exam-out') && (await txt(p, '#exam-n')).startsWith(String(want)) && (await txt(p, '#exam-matched')).startsWith(`${matched} of ${want}`) && (await txt(p, '#exam-changed')).startsWith(`${changed} of ${want}`) && /R/.test(await txt(p, '#exam-with')) && /n = \d+ graded/.test(sum), sum);
    check('under 20 graded setups it says "too few to judge"', /Too few to judge/.test(await txt(p, '#exam-note')) && /separate from same-trade replays/.test(await txt(p, '#exam-note')), await txt(p, '#exam-note'));
    check('a table lists the tested setups', (await p.$$('#exam-table tbody tr')).length === want);
    {
      const wl0 = await p.evaluate(() => window.MXAC.whatIfLoads.length), xr = ex[0], mx = reqs.length;
      check('what if on a tested setup: offered in the results only (both answers stored), and no later candles were asked for during the test', (await p.$$('#exam-table [data-whatif]')).length === want && !(await vis(p, '#exam-whatif')) && wl0 >= 1 && !(await p.evaluate((ids) => window.MXAC.whatIfLoads.some((x) => ids.includes(x.candidateId)), ex.map((e) => e.candidateId))));
      await p.click(`#exam-table [data-whatif="${xr.candidateId}"]`); await p.click('#xwhatif-run'); await p.waitForSelector('#xwhatif-table, #xwhatif-none', { timeout: 30000 });
      const xl = (await p.evaluate(() => window.MXAC.whatIfLoads)).pop(), xkeys = await p.$$eval('#xwhatif-table tbody tr', (l) => l.map((r) => r.dataset.alt));
      check('what if on a tested setup: its later candles are read only now, after its attempt and its result were stored; the stored result is beside it', xl.candidateId === xr.candidateId && xl.attemptId === xr.attemptId && xl.from >= xr.t && xkeys[0] === 'setup' && xkeys.includes('target-2r') && /stored/.test(await txt(p, '#xwhatif-compare')) && reqs.slice(0, mx).some((r) => r.body && r.body.action === 'exam.result' && r.body.result.candidateId === xr.candidateId) && !calls(reqs, mx, 'owner').some((r) => r.body) && (await p.$$('#xwhatif-show')).length === 0, `${JSON.stringify(xl)} ${xkeys.join(',')}`);
    }
    check('in this recorded window the lesson matches and changes at least one unseen setup', matched >= 1 && changed >= 1, `matched ${matched}, changed ${changed}`);
    check('the exam pool is used up: an exam setup is never shown twice', (await api(p, `get=candidates&edge=${EDGE}&pool=exam&limit=5000`)).candidates.length === exams0.length - want);
    await p.screenshot({ path: OUT + 'academy-3-exam.png', fullPage: true });

    // ---- 10. reload: the lesson, the attempts and the saved session are still there ----
    await p.reload({ waitUntil: 'load' }); await setup(p, null, null);
    await p.waitForFunction(() => document.querySelectorAll('#lessons-list li[data-lesson]').length > 0 && document.querySelectorAll('#sess-list li[data-session]').length > 0, null, { timeout: 15000 }).catch(() => {});
    check('after a reload the lesson is listed in plain English with its counters', (await p.$$('#lessons-list li[data-lesson]')).length === 1 && /Audit lesson/.test(await txt(p, '#lessons-list')) && /When: .+ → Then: WAIT/.test(await txt(p, '#lessons-list')) && /passed 2/.test(await txt(p, '#lessons-list')), await txt(p, '#lessons-list'));
    check('after a reload the saved session is listed', (await p.$$('#sess-list li[data-session]')).length === 1, await txt(p, '#sess-list'));
    await p.click('#sess-list li[data-session] button'); await p.waitForSelector('#replay:not([hidden])', { timeout: 60000 }); await p.waitForSelector('#dec-action', { timeout: 20000 });
    check('resuming puts the clock back on the setup, with its stored attempts', (await txt(p, '#clock-time')) === stamp(cur.t) && (await p.$$eval('#attempts-table tbody tr', (l) => l.map((r) => r.dataset.n).join(','))) === '1,2,3' && (await txt(p, '#dec-action')) === 'WAIT', `${await txt(p, '#clock-time')} ${await p.$$eval('#attempts-table tbody tr', (l) => l.length)}`);
    check('the resumed decision still shows which lesson was applied', (await p.$$('#dec-lessons li[data-applied="yes"]')).length === 1, await txt(p, '#dec-lessons'));

    // ---- 11. the paper account: a taken trade is opened, then closed from its stored outcome when the clock passes its exit ----
    await p.click('#c-speed [data-speed="100"]');
    let taken = null;
    for (let i = 0; i < cands.length; i++) { await goOn(p); const opened = (await p.$$eval('#log li', (l) => l.map((x) => x.textContent))).find((x) => /Paper trade opened/.test(x)); if (opened) { taken = opened; break; } const ok = await nextPoint(p).then(() => true, () => false); if (!ok) break; }
    check('a setup the engine still takes opens a paper trade sized by the risk engine', !!taken && /risking 2\d\d\.\d\d/.test(taken), taken || 'none taken');
    await p.waitForFunction(() => [...document.querySelectorAll('#trades tbody tr td:last-child')].some((td) => /R \(/.test(td.textContent)), null, { timeout: 60000 }).catch(() => {});
    const bal = await txt(p, '#acct .bal'), tradeRow = await txt(p, '#trades tbody tr');
    check('the trade is closed from its outcome once the clock passes the exit: balance, day P&L and drawdown follow', /[+-]\d+\.\d\dR/.test(tradeRow) && !/^100,000\.00/.test(bal) && /Day P&L/.test(await txt(p, '#acct')) && /Drawdown/.test(await txt(p, '#acct')), `${bal} | ${tradeRow}`);
    const outReqs = reqs.map((r, i) => [r, i]).filter(([r]) => r.q.get === 'outcome');
    check('an outcome is only ever asked for after the attempt of that setup was stored', outReqs.length >= 1 && outReqs.every(([r, i]) => reqs.slice(0, i).some((x) => x.body && x.body.action === 'attempt' && x.body.attempt.candidateId === r.q.id)), outReqs.length);
    const ck = await p.evaluate(() => window.MXAC.checks);
    check('no future bar ever reached a decision (every snapshot of this run was checked)', ck.future === 0 && ck.snapshots > 5, JSON.stringify(ck));
    const audit = (await api(p, 'get=audit')).rows.map((r) => r.action);
    check('every write is in the audit trail', ['attempt', 'correct', 'lesson.save', 'lesson.stats', 'session.save', 'exam.result'].every((a) => audit.includes(a)), [...new Set(audit)].join(','));
    check('no endless animation', (await p.evaluate(ENDLESS)).length === 0);
    await p.screenshot({ path: OUT + 'academy-4-account.png', fullPage: true });

    // ---- 11b. Lessons: the stored lesson with its record; revise (diff), switch off and on; a research draft saved inactive ----
    const tab = async (id, sel) => { await p.click('#tab-' + id); await p.waitForSelector(sel, { timeout: 20000 }); };
    const sayAll = async (sel) => (await p.$$eval(sel, (l) => l.map((x) => x.textContent.trim()))).join(' || ');
    await tab('lessons', '#ls-list li[data-lesson]');
    let ltxt = await txt(p, '#ls-list li[data-lesson]');
    check('Lessons: the saved lesson with its sentence, version, state and where it came from', (await p.$$('#ls-list > li')).length === 1 && /Audit lesson/.test(ltxt) && /version 1/.test(ltxt) && /in force/.test(ltxt) && /When: session = \w+ → Then: WAIT/.test(ltxt) && /mentor correction/.test(ltxt), ltxt.slice(0, 200));
    check('Lessons: recall and new-setup records are shown apart, each with its n', /Recall on the same trade: passed 2, failed 0 \(n = 2\)\./.test(ltxt) && /New setups it matched: n = \d+; the answer changed on \d+ and stayed the same on \d+; net [+-]?\d+\.\d\dR with lessons against [+-]?\d+\.\d\dR without\. Too few to judge\./.test(ltxt), ltxt.slice(150, 420));
    check('Lessons: an edge without a research draft says so and why', /No draft for Gold momentum pullback\. A draft is offered only when a pre-registered condition/.test(await txt(p, '#ls-drafts-card')), await txt(p, '#ls-drafts-card'));
    await p.click('#ls-list [data-act="revise"]'); await p.waitForSelector('#lr-title');
    check('Lessons: revising starts with nothing changed and cannot be saved yet', await p.isDisabled('#lr-save') && /Nothing is changed yet/.test(await txt(p, '#lr-diff')));
    await p.fill('#lr-title', 'Audit lesson, revised'); await p.selectOption('#lr-action', 'SKIP');
    const diff = await sayAll('#lr-diff li');
    check('Lessons: the diff names what changes, old → new', /Title: Audit lesson: wait in this session → Audit lesson, revised/.test(diff) && /Then: WAIT → REFUSE the setup \(wait\)/.test(diff) && !(await p.isDisabled('#lr-save')), diff);
    await p.selectOption('#lr-action', 'WAIT'); await p.click('#lr-save'); await p.waitForSelector('#ls-list li[data-version="2"]', { timeout: 15000 });
    let allL = (await api(p, `get=lessons&edge=${EDGE}`)).lessons;
    check('Lessons: the revision is a new version; the old one is kept, switched off', allL.length === 2 && allL[0].version === 2 && allL[0].active && allL[0].title === 'Audit lesson, revised' && allL[0].supersedes === allL[1].id && !allL[1].active && allL[1].supersededBy === allL[0].id && allL[0].then.action === 'WAIT', JSON.stringify(allL.map((l) => [l.version, l.active])));
    ltxt = await txt(p, '#ls-list li[data-lesson]');
    check('Lessons: the chain shows the earlier version and what changed; the new version starts its own record', (await p.$$('#ls-list > li')).length === 1 && /Earlier versions \(1\) and what changed/.test(ltxt) && /Version 1 → version 2/.test(ltxt) && /not replayed yet/.test(ltxt), ltxt.slice(0, 160));
    await p.click('#ls-list [data-act="off"]'); await p.waitForSelector('#ls-list li[data-active="no"]', { timeout: 15000 });
    check('Lessons: switching off takes it out of force (and says so in words)', (await api(p, `get=lessons&edge=${EDGE}&active=1`)).lessons.length === 0 && /switched off/.test(await txt(p, '#ls-list li[data-lesson] .lsn-head')) && /Switched off by the mentor/.test(await txt(p, '#ls-list li[data-lesson]')));
    await p.click('#ls-list [data-act="on"]'); await p.waitForSelector('#ls-list li[data-active="yes"]', { timeout: 15000 });
    check('Lessons: and back on', (await api(p, `get=lessons&edge=${EDGE}&active=1`)).lessons.length === 1);
    // The research run on the corrected candle clock offers no draft (docs/academy/DATA-CLOCK.md). First the real state:
    await p.selectOption('#ls-edge', 'gtl'); await p.waitForFunction(() => /No draft for Gold H4 trendline\./.test((document.getElementById('ls-drafts-card') || {}).textContent || ''), null, { timeout: 15000 });
    check('Lessons: on the corrected clock research offers no draft for gtl, and the page says so', (await api(p, 'get=research&edge=gtl&kind=baseline')).proposedLessons.length === 0 && /A draft is offered only when a pre-registered condition/.test(await txt(p, '#ls-drafts-card')));
    // Then the draft flow, on the last real draft the engine produced: the one of the archived run before the correction
    // (academy/archive/pre-clock/data/research.json), handed to the page in place of the empty list. Saving it goes through the real API.
    const OLD_DRAFTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'academy/archive/pre-clock/data/research.json'), 'utf8')).proposedLessons.filter((l) => l.edge === 'gtl');
    const withDraft = async (route) => { const res = await route.fetch(), j = await res.json(); if (Array.isArray(j.proposedLessons) && !j.proposedLessons.length) j.proposedLessons = OLD_DRAFTS; await route.fulfill({ response: res, json: j }); };
    await p.route(/\/api\/academy\?(?!.*_audit).*get=research.*edge=gtl/, withDraft);
    await p.selectOption('#ls-edge', EDGE); await p.waitForSelector('#ls-list li[data-version="2"]', { timeout: 15000 });
    await p.selectOption('#ls-edge', 'gtl'); await p.waitForSelector('#ls-drafts li[data-draft]', { timeout: 15000 });
    const dtxt = await txt(p, '#ls-drafts li[data-draft]');
    check('Lessons: a research draft shows its evidence with n and t in both parts, and its status', /Discovery \(.+\): n \d+ at .+R a trade against n \d+ at .+R, t \d\.\d\d\. Confirmation \(.+\): n \d+ .+ t \d\.\d\d\. Status: out-of-sample only, did not survive the correction for 121 tests/.test(dtxt) && /draft, not in force/.test(dtxt) && /Not saved\. It is a proposal only\./.test(dtxt), dtxt.slice(0, 260));
    await p.click('#ls-drafts [data-act="draft-save"]'); await p.waitForSelector('#ls-drafts li[data-state="saved"]', { timeout: 15000 });
    const gtl = (await api(p, 'get=lessons&edge=gtl')).lessons;
    check('Lessons: a saved research draft stays inactive and remembers its study', gtl.length === 1 && gtl[0].active === false && gtl[0].source.kind === 'research' && /^cond:gtl:/.test(gtl[0].source.studyId) && (await api(p, 'get=lessons&edge=gtl&active=1')).lessons.length === 0 && /Saved as an inactive lesson/.test(await txt(p, '#ls-drafts li[data-draft]')) && (await p.$$('#ls-drafts [data-act="draft-save"]')).length === 0, JSON.stringify(gtl.map((l) => [l.active, l.source])));
    check('Lessons: the saved draft is in the list above, switched off, from its research study', /switched off/.test(await txt(p, '#ls-list li[data-lesson]')) && /research study cond:gtl:/.test(await txt(p, '#ls-list li[data-lesson]')));
    await p.screenshot({ path: OUT + 'academy-6-lessons.png', fullPage: true });
    await p.unroute(/\/api\/academy\?(?!.*_audit).*get=research.*edge=gtl/, withDraft);
    await p.selectOption('#ls-edge', EDGE); await p.waitForSelector('#ls-list li[data-version="2"]', { timeout: 15000 });

    // ---- 11c. Progress and mistakes ----
    await tab('progress', '#pg-queue');
    const prog = await api(p, `get=progress&edge=${EDGE}`);
    check('Progress: attempts, corrections and lessons are the stored counts', (await txt(p, '#pg-n-attempts')).startsWith(String(prog.counts.attempts)) && (await txt(p, '#pg-n-corrections')).startsWith(String(prog.counts.corrections)) && (await txt(p, '#pg-n-lessons')).startsWith(String(prog.counts.lessons)) && prog.counts.attempts >= 8 && /same-trade replays/.test(await txt(p, '#pg-counts')), `${await txt(p, '#pg-n-attempts')} / ${prog.counts.attempts}`);
    check('Progress: agreement with the mentor by week, with n and "too few to judge"', /Overall you approved \d+ of \d+ \(too few to judge\) of the first decisions you judged \(n = \d+\)\./.test(await txt(p, '#pg-agree-all')) && /\d{4}-W\d\d/.test(await txt(p, '#pg-agree-table')) && /too few to judge \(n = \d+\)/.test(await txt(p, '#pg-agree-table')), await txt(p, '#pg-agree-all'));
    const boxes = await p.evaluate(() => ['pg-recall', 'pg-fresh'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
    check('Progress: recall and new setups sit side by side and are never added', boxes[0][1] === boxes[1][1] && boxes[0][0] < boxes[1][0] && /recall, never generalisation/.test(await txt(p, '#pg-recall')) && new RegExp(`n = ${ex.length} graded`).test(await txt(p, '#pg-fresh')) && /Too few to judge/.test(await txt(p, '#pg-fresh')) && /never added together/.test(await txt(p, '#pg-rvn')), `${JSON.stringify(boxes)} ${(await txt(p, '#pg-fresh')).slice(0, 120)}`);
    check('Progress: recall counts the same-trade replays that gave the answer asked for', new RegExp(`Passed${prog.replaySame.pass} of ${prog.replaySame.graded}`).test((await txt(p, '#pg-recall')).replace(/\s+/g, ' ').replace('Passed ', 'Passed')) && prog.replaySame.pass >= 2, await txt(p, '#pg-recall'));
    const mis = await txt(p, '#pg-mistakes');
    check('Progress: mistakes by class with a count and the latest example, which can be opened', (await p.$$('#pg-mistakes ul[data-class] li [data-open]')).length >= 1 && /n = 1/.test(mis) && /the engine said (BUY|SELL), you asked for WAIT \(session, wrong-structure\)/.test(mis) && /Reasons you gave: .*session 1/.test(await txt(p, '#pg-reasons')), mis.slice(0, 240));
    let qrow = await txt(p, `#pg-upcoming li[data-cand="${cur.id}"]`);
    check('Progress: the corrected setup is queued for spaced repetition (two passes so far: due in 7 days)', /you asked for WAIT \(the engine said (BUY|SELL)\)/.test(qrow) && /2 passes in a row/.test(qrow) && /due in 7 days \(\d{4}-\d\d-\d\d\)/.test(qrow) && /Nothing is due today/.test(await txt(p, '#pg-due')) && /1, 3, 7 and 21 days/.test(await txt(p, '#pg-queue')), qrow);
    check('Progress: the latest attempts name their kind in words', /same-trade replay \(recall\)/.test(await txt(p, '#pg-attempts-table')) && /test on a new setup/.test(await txt(p, '#pg-attempts-table')));
    await p.screenshot({ path: OUT + 'academy-7-progress.png', fullPage: true });
    const mq = reqs.length; await p.click(`#pg-upcoming li[data-cand="${cur.id}"] [data-open]`); await nextPoint(p);
    att = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(cur.id)}`)).attempts;
    check('"Replay this setup" opens the Train tab and runs the clock onto that setup', await vis(p, '#ac-train') && (await txt(p, '#clock-time')) === stamp(cur.t) && (await p.getAttribute('#tab-train', 'aria-selected')) === 'true', await txt(p, '#clock-time'));
    check('that sitting is stored as a same-trade replay (recall), and says so', att.length === 4 && att[3].mode === 'replay-same' && att[3].decision.action === 'WAIT' && (await p.$$eval('#log li', (l) => l.some((x) => /stored as a same-trade replay \(recall, not a new setup\)/.test(x.textContent)))), JSON.stringify(att.map((a) => [a.n, a.mode])));
    check('no outcome was asked for on the way to that setup before its attempt', calls(reqs, mq, 'owner').filter((r) => r.q.get === 'outcome').every((r) => r.q.id !== cur.id));
    await tab('progress', `#pg-upcoming li[data-cand="${cur.id}"]`); qrow = await txt(p, `#pg-upcoming li[data-cand="${cur.id}"]`);
    check('after that review the setup moves one step on (three passes: due in 21 days)', /3 passes in a row/.test(qrow) && /due in 21 days/.test(qrow), qrow);

    // ---- 11d. Research lab and notebook ----
    await tab('research', '#rs-table');
    check('Research: the counts come with what chance alone would give, and nothing is called validated', /130 of 420 registered conditions had enough trades to test\. 5 passed discovery; about 6\.2 would pass by chance alone\. 0 survived the correction/.test(await txt(p, '#rs-chance')) && /Nothing is validated\. No condition here may be called an edge\./.test(await txt(p, '#rs-summary')), await txt(p, '#rs-chance'));
    check('Research: the pre-registration is on the page', /fixed in the code before any condition result was computed/.test(await p.$eval('#rs-prereg', (e) => e.textContent)) && /Market regime/.test(await p.$eval('#rs-prereg', (e) => e.textContent)));
    const nStudies = (await api(p, 'get=research')).studies.length;
    check('Research: every generated study is listed', (await txt(p, '#rs-count')).startsWith(`${nStudies} of ${nStudies} studies`) && (await p.$$('#rs-table tbody tr')).length === Math.min(150, nStudies), await txt(p, '#rs-count'));
    await p.selectOption('#rs-edge', 'gtl'); await p.selectOption('#rs-kind', 'condition'); await p.selectOption('#rs-validation', 'out-of-sample');
    check('Research: no condition is out-of-sample on the corrected clock, and the table says so', (await p.$$('#rs-table tbody tr button')).length === 0 && (await txt(p, '#rs-count')).startsWith(`0 of ${nStudies} studies`), await txt(p, '#rs-count'));
    await p.selectOption('#rs-edge', 'nq-open'); await p.selectOption('#rs-validation', 'in-sample');
    check('Research: filters by edge, kind and where it stands', (await p.$$('#rs-table tbody tr')).length === 2 && (await txt(p, '#rs-count')).startsWith(`2 of ${nStudies} studies`) && /in-sample/.test(await txt(p, '#rs-table tbody tr')), await txt(p, '#rs-count'));
    await p.click('#rs-table tbody tr button'); await p.waitForSelector('#rs-detail-table', { timeout: 15000 });
    const sd = await txt(p, '#rs-detail');
    check('Research: a study opens in full with hypothesis, dataset, n, method, results, limits and its table', ['Hypothesis', 'Dataset', 'Method', 'Results', 'Limits', 'To reproduce', 'discovery', 'confirmation', 'n = '].every((x) => sd.includes(x)) && /adjusted p|Adjusted p/.test(sd) && (await p.$$('#rs-detail-table .kv dt')).length >= 8, sd.slice(0, 140));
    const pol = await sayAll('#rs-policy-table tbody tr');
    check('Research: the policy against taking every setup, an edge a row, with n, t and the plain verdict', (await p.$$('#rs-policy-table tbody tr')).length === 8 && /Gold replica325\+0\.406R2\.34169\+0\.148R156\+0\.685R-1\.53no measurable difference/.test(pol) && /All seven1476/.test(pol) && /Overall: no measurable difference/.test(await txt(p, '#rs-policy-verdict')), pol.slice(0, 200));
    check('Research: an empty notebook says what a note is for', /No note yet\. Write down a hypothesis below before you test it/.test(await txt(p, '#nb-list')));
    await p.fill('#nb-title', 'Audit note: Asia waits'); await p.fill('#nb-hypothesis', 'Waiting in Asia costs nothing on gmp.'); await p.fill('#nb-dataset', 'gmp train pool, 2020 to now'); await p.fill('#nb-method', 'Net R a trade, Welch t, first 70 % against last 30 %.');
    await p.selectOption('#nb-validation', 'out-of-sample'); await p.click('#nb-save');
    check('Research: an out-of-sample note without a sample size is refused before it is sent', await vis(p, '#nb-err') && /never an edge without n/.test(await txt(p, '#nb-err')) && (await api(p, 'get=notebook')).notes.length === 0, await txt(p, '#nb-err'));
    await p.fill('#nb-sampleSize', '42'); await p.fill('#nb-tags', 'audit, asia'); await p.click('#nb-save'); await p.waitForSelector('#nb-list li[data-note]', { timeout: 15000 });
    const notes = (await api(p, 'get=notebook')).notes;
    check('Research: the note is stored with its required fields and shown', notes.length === 1 && notes[0].sampleSize === 42 && notes[0].validation === 'out-of-sample' && notes[0].tags.join() === 'audit,asia' && /Audit note: Asia waits/.test(await txt(p, '#nb-list')) && /n = 42/.test(await txt(p, '#nb-list')), JSON.stringify(notes.map((n) => [n.title, n.sampleSize])));

    // ---- 11e. Models, Costs, Audit ----
    await tab('models', '#md-training-table');
    check('Models: nothing is promoted, the registry is honestly empty, and promotion is a documented manual step', /^No champion\. Nothing is promoted/.test(await txt(p, '#md-champion')) && /The registry is empty: no scorer has been registered/.test(await txt(p, '#md-registry')) && /model\.register/.test(await txt(p, '#md-manual')) && /model\.promote/.test(await txt(p, '#md-manual')) && (await p.$$eval('#ac-models button', (l) => l.length)) === 0, await txt(p, '#md-champion'));
    const mrows = await p.$$eval('#md-training-table tbody tr', (l) => l.map((r) => r.textContent));
    // 20 scorers since the training review of 10 Nov 2026 (the reference on 5 scopes, four challenger configurations on 15); the trainer reads no exam data, so there is no exam table
    check('Models: each scorer with its walk-forward numbers and verdict; no exam block (the trainer reads none); the skipped edges', mrows.length === 20 && mrows.every((r) => /rejected challenger/.test(r) && /not promoted/.test(r)) && /^replica325/.test(mrows[0]) && mrows.filter((r) => /mono-gbt|logit-short|pooled-logit|ridge-netR/.test(r)).length === 15 && /None of the 20 scorers beat taking every setup/.test(await txt(p, '#md-verdict')) && (await p.$$('#md-exam-table tbody tr')).length === 0 && (await p.$$('#md-skipped li')).length === 3 && /150 are needed to fit/.test(await txt(p, '#md-skipped')), mrows[0]);
    check('Models: scores are never offered as probabilities', /they are not probabilities/.test(await txt(p, '#md-training')));
    await tab('costs', '#co-head');
    check('Costs: off, no key, nothing spent, and an honest empty ledger', (await txt(p, '#co-head')) === 'Off. No key is set. Spent: $0.00' && /^\$0\.00/.test(await txt(p, '#co-today')) && /of \$0\.50/.test(await txt(p, '#co-today')) && /The ledger is empty: the adapter is off/.test(await txt(p, '#co-card')), await txt(p, '#co-head'));
    await tab('audit', '#au-table');
    const arows = (await api(p, 'get=audit')).rows;
    check('Audit: every write of the month, newest first, with who, action, ids and summary', (await p.$$('#au-table tbody tr')).length === Math.min(500, arows.length) && (await txt(p, '#au-count')).startsWith(`${arows.length} of ${arows.length} writes in ${new Date().toISOString().slice(0, 7)}`) && /owner/.test(await txt(p, '#au-table tbody tr')) && (await p.$$eval('#au-month option', (l) => l.length)) === 12, await txt(p, '#au-count'));
    await p.selectOption('#au-action', 'lesson.revise');
    check('Audit: filtered by action', (await p.$$eval('#au-table tbody tr', (l) => l.length === 1 && l.every((r) => r.dataset.action === 'lesson.revise'))) && /v2 replaces v1: Audit lesson, revised/.test(await txt(p, '#au-table tbody tr')), await txt(p, '#au-count'));

    // ---- 11f. Blind arena: the mentor answers before the engine's answer is shown; the outcome is read last ----
    await tab('blind', '#bl-start'); await p.waitForFunction(() => /train setups? in this range/.test(document.getElementById('bl-count').textContent), null, { timeout: 15000 });
    check('Blind arena: an honest empty table before the first answer', /No blind answer yet/.test(await txt(p, '#bl-table')));
    await p.fill('#bl-from', iso(cands[0].t)); await p.dispatchEvent('#bl-from', 'change');
    check('Blind arena: train-pool setups only, none answered yet', (await txt(p, '#bl-count')).startsWith(`${cands.length} train setups in this range without a blind answer yet`), await txt(p, '#bl-count'));
    const mb = reqs.length; await p.click('#bl-start'); await p.waitForSelector('#bl-save', { timeout: 60000 });
    const bAtt = calls(reqs, mb, 'owner').filter((r) => r.body && r.body.action === 'attempt');
    const hid = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c1.id)}`)).attempts.pop();
    check('Blind arena: the replay stops on the first train setup and the engine\'s answer is stored hidden', (await txt(p, '#bl-time')) === stamp(c1.t) && bAtt.length === 1 && bAtt[0].body.attempt.mode === 'blind' && bAtt[0].body.attempt.candidateId === c1.id && hid.mode === 'blind' && hid.hidden === true && hid.decision === null, `${await txt(p, '#bl-time')} ${JSON.stringify([hid.mode, hid.hidden])}`);
    check('Blind arena: no "What if" before the mentor has answered (absent, not disabled)', (await p.$$('#bl-whatif-run, #bl-whatif-box, #bl-whatif-table')).length === 0);
    check('Blind arena: nothing of the engine\'s answer is on the page, and no outcome has been asked for', await vis(p, '#bl-hidden') && !(await vis(p, '#bl-reveal')) && (await p.$$('#bl-engine, #bl-compare')).length === 0 && !calls(reqs, mb, 'owner').some((r) => r.q.get === 'outcome') && (await api(p, `get=blind&edge=${EDGE}`)).blind.length === 0);
    check('Blind arena: a setup trained on before is labelled recall', /recall, not a fresh decision/.test(await txt(p, '#bl-recall')));
    await p.click('#bl-answer [data-choice="WAIT"]');
    check('Blind arena: an answer without a reason cannot be stored: named calmly first, the problem on Save, nothing sent', await refused(p, 'bl', /Say why in a line/, reqs), await txt(p, '#bl-err'));
    await p.fill('#bl-text', 'Audit: I would wait here.'); await p.click('#bl-save'); await p.waitForSelector('#bl-compare', { timeout: 20000 });
    const bc = calls(reqs, mb, 'owner').map(what), eng1 = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c1.id)}`)).attempts.pop();
    check('Blind arena: order of calls: the hidden attempt, the mentor\'s answer, and only then the outcome (three calls a setup)', bc.slice(-3).join() === 'attempt,blind.submit,get=outcome' && bc.filter((x) => x === 'attempt' || x === 'blind.submit' || x === 'get=outcome').length === 3, bc.join(' '));
    check('Blind arena: both answers side by side, the engine\'s now revealed', (await txt(p, '#bl-you')) === 'WAIT' && (await txt(p, '#bl-engine')) === eng1.decision.action && eng1.hidden !== true && /^\|You\|The engine$/.test(await p.$eval('#bl-compare thead tr', (r) => [...r.cells].map((c) => c.textContent).join('|'))), `${await txt(p, '#bl-you')} / ${await txt(p, '#bl-engine')}`);
    check('Blind arena: the result is read after both answers and says who was closer', /Result, read after both answers were stored: /.test(await txt(p, '#bl-outcome')) && ['mentor', 'engine', 'tie', 'none'].includes(await p.getAttribute('#bl-closer', 'data-closer')) && /(closer to the outcome|A tie|cannot be judged)/.test(await txt(p, '#bl-closer')), `${await txt(p, '#bl-outcome')} | ${await txt(p, '#bl-closer')}`);
    check('Blind arena: the running table carries its n and says "too few to judge"', (await txt(p, '#bl-n')).startsWith('1') && /n = \d graded/.test(await txt(p, '#bl-mentor-r')) && /Too few to judge/.test(await txt(p, '#bl-table-note')) && (await p.$$('#bl-rows tbody tr')).length === 1, await txt(p, '#bl-table'));
    {
      const nb = await p.evaluate(() => window.MXAC.whatIfLoads.length); await p.click('#bl-whatif-run'); await p.waitForSelector('#bl-whatif-table', { timeout: 30000 });
      const bk = await p.$$eval('#bl-whatif-table tbody tr', (l) => l.map((r) => r.dataset.alt + ':' + r.cells[0].textContent.trim())), bl = (await p.evaluate(() => window.MXAC.whatIfLoads)).pop();
      check('Blind arena: after both answers are stored the same "What if" card is offered, with your answer as a row', (await p.evaluate(() => window.MXAC.whatIfLoads.length)) === nb + 1 && bl.candidateId === c1.id && bk[0].startsWith('setup:') && bk.some((x) => /^(mentor:Your answer: WAIT|engine:The engine's answer: WAIT)$/.test(x)) && bk.length >= 8 && /stored/.test(await txt(p, '#bl-whatif-compare')), bk.slice(0, 3).join(' | '));
      await p.click('#bl-whatif-show'); check('Blind arena: the later candles can be shown on its chart, as a separate step', (await p.getAttribute('#bl-whatif-show', 'aria-pressed')) === 'true' && /came AFTER the decision/.test(await txt(p, '#bl-whatif-shown')) && (await p.evaluate(() => window.MXAC.checks.future)) === 0);
    }
    await p.click('#bl-next'); await p.waitForSelector('#bl-save', { timeout: 60000 }); await p.waitForFunction(() => /your answer first/.test(document.getElementById('bl-state').textContent), null, { timeout: 20000 });
    const c2 = cands[1], own = c2.side === 'buy' ? 'BUY' : 'SELL'; await p.click(`#bl-answer [data-choice="${own}"]`);
    check('Blind arena: a BUY / SELL answer starts from the setup\'s own levels, stop included', +(await p.inputValue('#bl-entry')) === c2.entry && +(await p.inputValue('#bl-stop')) === c2.stop, `${await p.inputValue('#bl-entry')} / ${await p.inputValue('#bl-stop')}`);
    await p.fill('#bl-stop', String(c2.side === 'buy' ? c2.entry + 1 : c2.entry - 1)); check('Blind arena: a stop on the wrong side is refused (Save sends nothing)', await refused(p, 'bl', /The stop must be/, reqs), await txt(p, '#bl-err'));
    await p.fill('#bl-stop', String(c2.stop)); await p.fill('#bl-text', 'Audit: I take the setup.'); await p.click('#bl-save'); await p.waitForSelector('#bl-compare', { timeout: 20000 });
    const brows = (await api(p, `get=blind&edge=${EDGE}`)).blind;
    { const rec = brows.filter((r) => r.recall).length, sub = (await txt(p, '#bl-n')).replace(/\s+/g, ' ');
      check('Blind arena: a setup the engine had decided before in training is listed as recall and left out of every score', rec >= 1 && brows.find((r) => r.candidateId === c1.id).recall === true && (await p.$$('#bl-rows tr[data-recall="yes"]')).length === rec && sub.includes(`${brows.length - rec} scored · ${rec} recall, not scored`) && /a remembered answer is not evidence/.test(await txt(p, '#bl-table-note')) && /recall, not scored/.test(await txt(p, '#bl-rows tr[data-recall="yes"]')), `${rec} of ${brows.length} recall; "${sub}"`); }
    check('Blind arena: stored rows match the page; a trade on the setup\'s own side is graded with the setup\'s net R', brows.length === 2 && brows[0].candidateId === c2.id && brows[0].mentor.action === own && brows[0].mentor.stop === c2.stop && brows[0].engine && typeof brows[0].rMentor === 'number' && (await txt(p, '#bl-n')).startsWith('2') && (await p.$$('#bl-rows tbody tr')).length === 2, JSON.stringify(brows.map((b) => [b.mentor.action, b.rMentor, b.rEngine])));
    check('Blind arena: the engine\'s reasoning can be opened after the reveal', (await p.$$('#bl-why #bl-dec-action')).length === 1);
    await p.screenshot({ path: OUT + 'academy-8-blind.png', fullPage: true });

    // ---- 11g. Session training: notes on a missed opportunity and a right wait, verdicts, save, resume, end ----
    const ms0 = reqs.length; await tab('session', '#ss-start'); await p.waitForFunction(() => /train setups? in this range/.test(document.getElementById('ss-count').textContent), null, { timeout: 15000 });
    const lastDay = iso(cands[cands.length - 1].t), dayCands = cands.filter((c) => iso(c.t) === lastDay);
    check('Session: the default range is the day of the latest setup; an empty list of saved sessions says when one appears', (await p.inputValue('#ss-from')) === lastDay && (await p.inputValue('#ss-to')) === lastDay && (await txt(p, '#ss-count')).startsWith(`${dayCands.length} train setup`) && /No saved session yet/.test(await txt(p, '#ss-saved')), `${await p.inputValue('#ss-from')} ${await txt(p, '#ss-count')}`);
    await p.selectOption('#ss-speed', '100'); await p.click('#ss-start'); await p.waitForSelector('#ss-live:not([hidden])', { timeout: 60000 });
    check('Session: the replay is ready, paused at the start, with the running thesis', await vis(p, '#ss-chart canvas') && (await txt(p, '#ss-state')) === 'paused' && /^Bias \w+\. Expecting /.test(await txt(p, '#ss-thesis-line')) && /0 decisions/.test(await txt(p, '#ss-summary-text')), await txt(p, '#ss-thesis-line'));
    await p.click('#ss-step'); await p.click('#ss-step'); await p.click('#ss-right'); await p.waitForFunction(() => /Stored ✓/.test((document.getElementById('ss-right-msg') || {}).textContent || ''), null, { timeout: 15000 });
    check('Session: "the engine was right to wait" is stored at the replay time', /the engine said WAIT and you agree that waiting was right/.test(await txt(p, '#ss-right-msg')) && (await txt(p, '#ss-n-right')).startsWith('1'), await txt(p, '#ss-right-msg'));
    await p.click('#ss-step'); await p.click('#ss-missed'); await p.waitForSelector('#ss-m-save');
    check('Session: a missed opportunity shows the engine\'s own read of that moment first', /No setup of Gold momentum pullback was on the table at this moment, and the engine said WAIT/.test(await txt(p, '#ss-engine-read')), await txt(p, '#ss-engine-read'));
    await p.click('#ss-note [data-choice="BUY"]'); const mEntry = +(await p.inputValue('#ss-m-entry'));
    check('Session: the note starts at the last closed price and needs a stop and a reason', mEntry > 1000 && await refused(p, 'ss-m', /every trade has a stop/, reqs), `${mEntry} ${await txt(p, '#ss-m-err')}`);
    await p.fill('#ss-m-stop', (mEntry - 6).toFixed(2)); await p.fill('#ss-m-target', (mEntry + 12).toFixed(2)); await p.fill('#ss-m-text', 'Audit: swept the low and closed back above it.'); await p.click('#ss-m-save'); await p.waitForSelector('#ss-draft-save', { timeout: 15000 });
    const misses = (await api(p, `get=misses&edge=${EDGE}`)).misses, ssId = misses[0] && misses[0].sessionId;
    check('Session: both notes are stored with the session, the engine\'s answer and its class beside the mentor\'s', misses.length === 2 && misses[0].kind === 'missed' && misses[0].action === 'BUY' && misses[0].entry === mEntry && misses[0].stop === +(mEntry - 6).toFixed(2) && misses[0].engine.action === 'WAIT' && typeof misses[0].cls === 'string' && /^se_/.test(ssId) && misses[1].kind === 'right-wait' && misses[1].sessionId === ssId && /^[0-9a-f]{16}$/.test(misses[0].snapshotHash), JSON.stringify(misses.map((m) => [m.kind, m.action, m.cls])));
    check('Session: a note never carries an outcome, and none was asked for', !JSON.stringify(misses).includes('netR') && !calls(reqs, ms0, 'owner').some((r) => r.q.get === 'outcome'), calls(reqs, ms0, 'owner').map(what).join(' '));
    check('Session: the note offers a lesson draft in plain English, to be saved switched off', /^When: .+ → Then: TAKE the edge's trade/.test(await txt(p, '#ss-draft-plain')) && /cannot make a trade where the edge was silent/.test(await txt(p, '#ss-note')), await txt(p, '#ss-draft-plain'));
    await p.click('#ss-draft-save'); await p.waitForFunction(() => /Draft saved ✓/.test(document.getElementById('ss-note').textContent), null, { timeout: 15000 });
    const drafts = (await api(p, `get=lessons&edge=${EDGE}`)).lessons.filter((l) => l.source && l.source.sessionId === ssId);
    check('Session: the draft is saved inactive, linked to the session', drafts.length === 1 && drafts[0].active === false && drafts[0].then.action === 'TAKE' && (await api(p, `get=lessons&edge=${EDGE}&active=1`)).lessons.length === 1, JSON.stringify(drafts.map((l) => [l.active, l.then.action])));
    const ms1 = reqs.length; await p.click('#ss-play'); await p.waitForSelector('#ss-dec-stored', { timeout: 60000 }); await p.waitForFunction(() => document.getElementById('ss-state').textContent === 'paused on a setup', null, { timeout: 20000 });
    const sAtt = calls(reqs, ms1, 'owner').map(what), d1 = dayCands[0], sRows = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(d1.id)}`)).attempts, sLast = sRows[sRows.length - 1];
    check('Session: the clock stops on the first setup of the day and its decision is stored at once, with the session id, then the place is saved (two calls; this sitting has its id since the first note)', (await txt(p, '#ss-time')) === stamp(d1.t) && sAtt.join() === 'attempt,session.save' && sLast.sessionId === ssId && ['train', 'replay-same'].includes(sLast.mode) && (await txt(p, '#ss-dec-action')) === sLast.decision.action && /Attempt \d+ stored ✓/.test(await txt(p, '#ss-dec-stored')), `${await txt(p, '#ss-time')} ${sAtt.join()} ${sLast.mode}`);
    check('Session: the note buttons are off while the clock is on a setup', await p.isDisabled('#ss-missed') && await p.isDisabled('#ss-right'));
    await p.click('#ss-point [data-choice="approve"]'); await p.click('#ss-v-save'); await p.waitForFunction(() => /Verdict stored ✓/.test(document.getElementById('ss-v-msg').textContent), null, { timeout: 15000 });
    check('Session: an approval is stored and counted, with its n', (await txt(p, '#ss-n-agree')).startsWith('1 of 1 (too few to judge)') && (await txt(p, '#ss-n-dec')).startsWith('1'), await txt(p, '#ss-n-agree'));
    if (dayCands.length > 1) {
      await p.click('#ss-continue'); await p.waitForFunction((t) => document.getElementById('ss-time').textContent === t && document.getElementById('ss-state').textContent === 'paused on a setup', stamp(dayCands[1].t), { timeout: 60000 });
      const other = await p.$eval('#ss-point [data-choice]:not([data-choice="approve"])', (b) => b.dataset.choice); await p.click(`#ss-point [data-choice="${other}"]`);
      check('Session: a disagreeing verdict needs a reason (Save sends nothing without one)', await refused(p, 'ss-v', /Say why in a line/, reqs), await txt(p, '#ss-v-err'));
      await p.fill('#ss-v-text', 'Audit: I read this one differently.'); await p.click('#ss-v-save'); await p.waitForSelector('#ss-lesson-plain', { timeout: 15000 });
      check('Session: the disagreement is stored as a correction and a lesson draft is offered', (await txt(p, '#ss-n-agree')).startsWith('1 of 2 (too few to judge)') && /^When: .+ → Then: /.test(await txt(p, '#ss-lesson-plain')) && (await api(p, `get=corrections&edge=${EDGE}&cand=${encodeURIComponent(dayCands[1].id)}`)).corrections.some((c) => c.verdict === 'change' && c.action === other), await txt(p, '#ss-lesson-plain'));
    }
    await p.click('#ss-save'); await p.waitForFunction(() => /Session saved at/.test(document.getElementById('ss-run-msg').textContent), null, { timeout: 15000 });
    let sessS = (await api(p, 'get=sessions')).sessions.filter((s) => s.kind === 'session');
    check('Session: saved through the session route, with its summary', sessS.length === 1 && sessS[0].id === ssId && sessS[0].status === 'paused' && /missed opportunity/.test(sessS[0].summary) && (await p.$$('#ss-saved li[data-session]')).length === 1, JSON.stringify(sessS.map((s) => [s.status, s.summary])));
    const nDec = (await txt(p, '#ss-summary-text')).match(/^(\d+) decision/)[1];
    check('Session: the setup card is folded to one line while the sitting is on screen', (await p.getAttribute('#ss-setup-toggle', 'aria-expanded')) === 'false' && !(await vis(p, '#ss-start')) && /setup/.test(await txt(p, '#ss-setup-sum')), await txt(p, '#ss-setup-sum'));
    await p.click('#ss-setup-toggle'); await p.click('#ss-saved li[data-session] button'); await p.waitForFunction(() => /Session resumed (at|on)/.test(document.getElementById('ss-run-msg').textContent), null, { timeout: 60000 });
    check('Session: resuming brings back the clock, the notes and the counts', +nDec === Math.min(2, dayCands.length) && (await txt(p, '#ss-summary-text')).startsWith(nDec + ' decision') && (await txt(p, '#ss-n-missed')).startsWith('1') && (await p.$$('#ss-notes-list li[data-kind]')).length === 2 && /swept the low/.test(await txt(p, '#ss-notes-list')), await txt(p, '#ss-summary-text'));
    await p.click('#ss-end'); await p.waitForFunction(() => /Session ended and saved/.test(document.getElementById('ss-run-msg').textContent), null, { timeout: 15000 });
    sessS = (await api(p, 'get=sessions')).sessions.filter((s) => s.kind === 'session');
    const sumTxt = await txt(p, '#ss-summary-text');
    check('Session: the end-of-session summary gives decisions, agreement, misses and lessons, each with its n', new RegExp(`^${nDec} decisions? \\(\\d taken, \\d waited\\) · you agreed with 1 of \\d \\(too few to judge\\) · 1 missed opportunity · 1 right wait · 0 lessons saved, 1 draft`).test(sumTxt) , sumTxt);
    check('Session: ended means stored as done, the clock stopped for good, and the summary named as final', sessS[0].status === 'done' && (await txt(p, '#ss-state')) === 'session ended' && await p.isDisabled('#ss-play') && /Session summary/.test(await txt(p, '#ss-summary')), `${sessS[0].status} / ${await txt(p, '#ss-state')} / ${await p.isDisabled('#ss-play')} / ${(await txt(p, '#ss-summary')).slice(0, 30)}`);
    await p.screenshot({ path: OUT + 'academy-9-session.png', fullPage: true });
    const ck2 = await p.evaluate(() => window.MXAC.checks);
    check('no future bar reached a decision in the blind arena or the session either', ck2.future === 0 && ck2.snapshots > ck.snapshots, JSON.stringify(ck2));
    const audit2 = [...new Set((await api(p, 'get=audit')).rows.map((r) => r.action))];
    check('the new writes are in the audit trail too', ['lesson.revise', 'lesson.deactivate', 'notebook.add', 'blind.submit', 'miss'].every((a) => audit2.includes(a)), audit2.join(','));

    // ---- 11h. the rate limit: a 429 is waited out calmly and the call carries on ----
    {
      let hits = 0; await p.route(/\/api\/academy\?get=cost/, (r) => (hits++ === 0 ? r.fulfill({ status: 429, headers: { 'Retry-After': '1' }, contentType: 'application/json', body: '{"error":"rate limited"}' }) : r.continue()));
      await p.click('#tab-costs'); await p.waitForFunction(() => !document.getElementById('ac-net').hidden, null, { timeout: 5000 }).catch(() => {});
      const waiting = await txt(p, '#ac-net'); await p.waitForSelector('#co-head', { timeout: 15000 });
      check('a 429 shows a calm waiting line, not an error, and the section then loads', /^Waiting for the server's rate limit… about 1 s\. Nothing is lost/.test(waiting) && hits === 2 && (await txt(p, '#co-head')) === 'Off. No key is set. Spent: $0.00' && !(await vis(p, '#ac-net')) && (await p.$$('#ac-costs .ac-err')).length === 0, `${waiting} (${hits} requests)`);
      await p.unroute(/\/api\/academy\?get=cost/); errs.splice(0, errs.length, ...errs.filter((e) => !/429/.test(e)));   // the browser logs the 429 itself
    }
    for (const [id, sel] of [['lessons', '#ls-list li[data-lesson]'], ['progress', '#pg-queue'], ['blind', '#bl-compare'], ['session', '#ss-summary']]) {
      await tab(id, sel);
      for (const theme of ['dark', 'light', 'midnight']) { await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(350); const bad = await aa(p); check(`AA contrast, ${theme} theme (${id})`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
      await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    }
    check('no endless animation in the other sections', (await p.evaluate(ENDLESS)).length === 0);
    await p.click('#tab-train');

    // ---- 11i. verification pass on a fresh store: every replay control; approve, reject, change with levels; the regression check ----
    {
      const sv = await startServer(portOf(1, +PORT + 1)), HV = sv.H, cv = await b.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' }); await cv.addInitScript(NO_PACE);
      let v = await cv.newPage(); watch(v, 'verify');
      const state = () => txt(v, '#clock-state'), clockMs = async () => Date.parse((await txt(v, '#clock-time')).replace(' UTC', 'Z')), until = (re) => v.waitForFunction((src) => new RegExp(src).test(document.getElementById('clock-state').textContent), re.source, { timeout: 10000 }).catch(() => {});
      const saveCorrection = async () => { await v.click('#m-save'); await v.waitForFunction(() => /Correction saved/.test(document.getElementById('m-msg').textContent), null, { timeout: 15000 }); return reqs.filter((r) => r.tag === 'verify' && r.body && r.body.action === 'correct').pop().body.correction; };
      const keepConds = async (keep) => { for (const k of (await v.$$eval('#lesson-conds .cond', (l) => l.map((x) => x.dataset.cond))).filter((x) => !keep.includes(x)).reverse()) await v.click(`#lesson-conds .cond[data-cond="${k}"] [data-del]`); return v.$$eval('#lesson-conds .cond', (l) => l.map((x) => x.dataset.cond)); };
      const saveLesson = async (title) => { await v.fill('#lesson-title', title); await v.click('#lesson-save'); await v.waitForFunction(() => /Lesson saved/.test(document.getElementById('lesson-msg').textContent), null, { timeout: 15000 }); };
      const prove = async () => { await v.click('#prove-run'); await v.waitForSelector('#prove-verdict', { timeout: 20000 }); return { verdict: await v.getAttribute('#prove-verdict', 'data-verdict'), action: await txt(v, '#dec-action'), control: await txt(v, '#prove-control'), same: await v.getAttribute('#prove-control', 'data-same') }; };
      const onSetup = async (c) => { await nextPoint(v); return (await txt(v, '#clock-time')) === stamp(c.t); };
      // "Check earlier corrections": every line the status shows is kept, so the progress is read exactly, not sampled
      const runCheck = async (n) => {
        await v.click('#tab-lessons'); await v.waitForSelector('#ls-check-run', { timeout: 20000 });
        await v.evaluate(() => { window.__chk = []; const m = document.getElementById('ls-check-msg'); new MutationObserver(() => window.__chk.push(m.textContent)).observe(m, { childList: true, characterData: true, subtree: true }); });
        const from = reqs.length; await v.click('#ls-check-run'); await v.waitForFunction((k) => window.__chk.some((t) => t === `Checked ${k} setups.`), n, { timeout: 60000 }).catch(() => {});
        const sum = await v.$eval('#ls-check-sum', (e) => ({ text: e.textContent, holds: +e.dataset.holds, broken: +e.dataset.broken })).catch(() => ({ text: '', holds: -1, broken: -1 }));
        return { sum, lines: await v.evaluate(() => window.__chk), rows: await v.$$eval('#ls-check-list li[data-cand]', (l) => l.map((x) => ({ id: x.dataset.cand, status: x.dataset.status, text: x.textContent }))), sent: calls(reqs, from, 'verify').map((r) => (r.body ? r.body.action + (r.body.attempt ? ':' + r.body.attempt.mode : '') : 'get=' + r.q.get)) };
      };
      try {
        await v.goto(HV + '/academy', { waitUntil: 'load' }); await setup(v, iso(cands[0].t), null);
        await v.click('#start'); await v.waitForSelector('#replay:not([hidden])', { timeout: 60000 });
        const start = await txt(v, '#clock-time'), start0 = await clockMs();
        check('controls: a new replay is paused at the start of the range and the button says Play', (await state()) === 'paused' && (await txt(v, '#c-play')) === 'Play' && (await v.getAttribute('#c-play', 'aria-pressed')) === 'false' && start === iso(cands[0].t) + ' 00:00 UTC', `${await state()} / ${await txt(v, '#c-play')} / ${start}`);
        // each speed, while the clock is paused and while it plays (a long stretch with no setup: after the fifth, before the sixth)
        await v.fill('#c-jump-at', iso(cands[4].t + 86400) + 'T00:00'); await v.click('#c-jump'); const jumped = await txt(v, '#clock-time');
        check('controls: jump moves the clock to the time asked for, says what it skipped, and fires no setup on the way', jumped === iso(cands[4].t + 86400) + ' 00:00 UTC' && /^Jumped from .+ to .+\. Setups in between were not shown\./.test(await txt(v, '#log li')) && !(await vis(v, '#decision')) && calls(reqs, 0, 'verify').every((r) => !r.body || r.body.action !== 'attempt'), `${jumped} / ${await txt(v, '#log li')}`);
        await v.click('#c-speed [data-speed="1"]'); await v.click('#c-play'); await until(/^playing 1×$/);
        const seen = []; for (const sp of [1, 5, 10, 50, 100]) { await v.click(`#c-speed [data-speed="${sp}"]`); seen.push([sp, await state(), await v.$$eval('#c-speed [aria-pressed="true"]', (l) => l.map((x) => x.dataset.speed).join())]); }
        check('controls: each speed (1, 5, 10, 50, 100) takes effect while playing and is the only one marked', seen.every(([sp, st, on]) => st === `playing ${sp}×` && on === String(sp)) && (await txt(v, '#c-play')) === 'Pause' && (await v.getAttribute('#c-play', 'aria-pressed')) === 'true', JSON.stringify(seen));
        // let the clock tick at least once before pausing: the clicks above can all land inside one tick of the replay timer
        { const from = Date.parse(jumped.replace(' UTC', 'Z')); for (let i = 0; i < 80 && !((await clockMs()) > from); i++) await v.waitForTimeout(100); }
        await v.click('#c-speed [data-speed="1"]'); await v.click('#c-play'); const tA = await clockMs();
        check('controls: Pause stops the clock; the button then says Resume', (await state()) === 'paused' && (await txt(v, '#c-play')) === 'Resume' && (await v.getAttribute('#c-play', 'aria-pressed')) === 'false' && tA > Date.parse(jumped.replace(' UTC', 'Z')), `${await state()} / ${await txt(v, '#c-play')}`);
        await v.waitForTimeout(400); check('controls: while paused the clock does not move', (await clockMs()) === tA);
        await v.click('#c-step'); const tB = await clockMs(); check('controls: Step moves exactly one candle and stays paused', tB - tA === 300000 && (await state()) === 'paused', `${(tB - tA) / 1000} s`);
        await v.click('#c-play'); await until(/^playing 1×$/); await v.waitForFunction((t) => Date.parse(document.getElementById('clock-time').textContent.replace(' UTC', 'Z')) > t, tB, { timeout: 10000 }).catch(() => {}); await v.click('#c-play'); const tC = await clockMs();
        check('controls: Resume carries on from where it stopped', tC > tB && (await state()) === 'paused', `${(tC - tB) / 1000} s on`);
        // save, reload, resume: the clock is back on the saved candle
        await v.click('#sess-save'); await v.waitForFunction(() => /Session saved/.test(document.getElementById('replay-msg').textContent), null, { timeout: 15000 });
        await v.reload({ waitUntil: 'load' }); await v.waitForSelector('#sess-list li[data-session] button', { timeout: 20000 }); await v.click('#sess-list li[data-session] button'); await v.waitForSelector('#replay:not([hidden])', { timeout: 60000 });
        check('controls: a saved session is resumed on the candle it was saved on, paused', (await clockMs()) === tC && (await state()) === 'paused' && /^Session resumed/.test(await v.$eval('#log li:last-child', (e) => e.textContent)), `${await txt(v, '#clock-time')} / ${await state()}`);
        await v.click('#c-restart'); check('controls: Restart goes back to the start of the range, paused, with Play again', (await clockMs()) === start0 && (await state()) === 'paused' && (await txt(v, '#c-play')) === 'Play' && /^Restarted from the beginning/.test(await txt(v, '#log li')), `${await txt(v, '#clock-time')} / ${await txt(v, '#c-play')}`);

        // the first setup (the engine waits): approved
        await v.click('#c-speed [data-speed="100"]'); await v.click('#c-play'); const on1 = await onSetup(cands[0]), a1 = await txt(v, '#dec-action');
        await v.click('#mentor [data-choice="approve"]'); const k1 = await saveCorrection();
        check('mentor: an approval needs no reason and is stored as an approval of the engine\'s own answer', on1 && k1.verdict === 'approve' && k1.action === null && k1.entry === null && k1.reasons.length === 0 && a1 === 'WAIT', JSON.stringify(k1).slice(0, 120));
        await goOn(v); await nextPoint(v); await goOn(v); await nextPoint(v); await goOn(v);
        // the fourth setup (the engine sells): rejected, and the lesson refuses the setup
        const on4 = await onSetup(cands[3]), a4 = await txt(v, '#dec-action'); await v.click('#mentor [data-choice="reject"]');
        const needsWhy = await refused(v, 'm', /Say why/, reqs); await v.click('#mentor [data-reason="session"]'); await v.fill('#m-text', 'Verify: never in this session.'); const k4 = await saveCorrection();
        check('mentor: a rejection needs a reason, carries no action and no levels, and is stored as a rejection', on4 && a4 === 'SELL' && needsWhy && k4.verdict === 'reject' && k4.action === null && k4.entry === null && k4.stop === null && k4.reasons.join() === 'session', JSON.stringify(k4).slice(0, 160));
        check('mentor: the draft from a rejected trade refuses the setup', /→ Then: REFUSE the setup \(wait\)$/.test(await txt(v, '#lesson-plain')), await txt(v, '#lesson-plain'));
        await keepConds(['session']); await saveLesson('Verify lesson 1: refuse this session'); const p4 = await prove();
        check('replay and prove: the rejected SELL is a WAIT on the same trade, learned, and the control with no lesson still gives SELL', p4.verdict === 'learned' && p4.action === 'WAIT' && p4.same === 'yes' && /gives SELL, the first answer/.test(p4.control), JSON.stringify(p4));
        await goOn(v);
        // the fifth setup (the engine waits): changed to SELL with the mentor's own stop, and a mark on the chart
        const c5 = cands[4], on5 = await onSetup(c5), a5 = await txt(v, '#dec-action'); await v.click('#mentor [data-choice="SELL"]');
        const pre = [+(await v.inputValue('#m-entry')), +(await v.inputValue('#m-stop')), +(await v.inputValue('#m-target'))], myStop = +(c5.stop + 1).toFixed(2);
        await v.fill('#m-stop', String(myStop)); await v.click('#mentor [data-reason="session"]'); await v.click('#mentor [data-reason="wrong-structure"]'); await v.fill('#m-text', 'Verify: this range is the trade, with a wider stop.');
        await v.selectOption('#a-kind', 'entry'); await v.click('#a-arm'); await v.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); { const q = await v.evaluate((x) => window.MXAC.chartPoint(x, 0.5), c5.entry); await v.mouse.click(q.x, q.y); }
        const k5 = await saveCorrection();
        check('mentor: a change to SELL starts from the setup\'s levels and is stored with the mentor\'s entry, stop, target and mark', on5 && a5 === 'WAIT' && pre.join() === [c5.entry, c5.stop, c5.target].join() && k5.verdict === 'change' && k5.action === 'SELL' && k5.entry === c5.entry && k5.stop === myStop && k5.target === c5.target && k5.annotations.length === 1 && k5.annotations[0].kind === 'entry' && k5.reasons.join() === 'session,wrong-structure', JSON.stringify(k5).slice(0, 200));
        const plain5 = await txt(v, '#lesson-plain'); const kept5 = await keepConds(['session', 'regime']);
        check('mentor: the draft takes the edge\'s trade and carries the stop as a rule relative to the chart, never a raw price', /→ Then: TAKE the edge's trade; stop = /.test(plain5) && !plain5.includes(String(myStop)) && kept5.join() === 'session,regime' && (await v.$$('#lesson-adjust li:not(.none)')).length === 1, plain5);
        await saveLesson('Verify lesson 2: take this range'); const p5 = await prove(), row5 = await v.$$eval('#prove-table tr', (l) => l.map((r) => [...r.cells].map((c) => c.textContent.trim()).join('|')));
        check('replay and prove: the same trade is now a SELL on the mentor\'s stop, learned, and the control with no lesson still waits', p5.verdict === 'learned' && p5.action === 'SELL' && p5.same === 'yes' && /gives WAIT, the first answer/.test(p5.control) && row5[1] === 'Action|WAIT|SELL|SELL' && row5[3].split('|')[2] === row5[3].split('|')[3] && row5[3].split('|')[2] !== row5[3].split('|')[1], JSON.stringify(p5) + ' ' + row5[3]);

        // the regression check, before any later lesson: every earlier answer holds
        let r = await runCheck(3);
        check('Lessons: "Check earlier corrections" re-decides every judged train setup, with a progress line setup by setup', r.lines.some((t) => /^Setup 1 of 3 \(.+ UTC\): loading its candles…$/.test(t)) && r.lines.some((t) => /^Setup 3 of 3 \(.+ UTC\): deciding from its candles and storing…$/.test(t)) && r.lines[r.lines.length - 1] === 'Checked 3 setups.', r.lines.slice(0, 3).concat(r.lines.slice(-1)).join(' | '));
        check('Lessons: the check finds all three earlier answers intact (an approval, a rejection, a change)', r.sum.holds === 3 && r.sum.broken === 0 && /^3 earlier verdicts checked against the 2 lessons in force: 3 still hold, 0 no longer hold, 0 never held\.$/.test(r.sum.text) && r.rows.length === 3 && r.rows.every((x) => x.status === 'holds') && !(await vis(v, '#ls-check-warn')), r.sum.text);
        check('Lessons: each check is stored as one same-trade replay through the paced API, and no result is read', r.sent.filter((x) => x === 'attempt:replay-same').length === 3 && !r.sent.some((x) => /^attempt:(train|exam|blind)$/.test(x) || x === 'get=outcome') && /Stored as attempt 3 \(same-trade replay\)/.test(r.rows[2].text), r.sent.join());
        const a5n = (await api(v, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c5.id)}`)).attempts;
        check('Lessons: the stored check sits on the same decision point as the first attempt and leaves it untouched', a5n.length === 3 && a5n.map((x) => x.mode).join() === 'train,replay-same,replay-same' && new Set(a5n.map((x) => x.snapshotHash)).size === 1 && a5n[0].decision.action === 'WAIT' && a5n[2].decision.action === 'SELL', JSON.stringify(a5n.map((x) => [x.n, x.mode, x.decision.action])));
        check('Lessons: the check says what it shows (recall of earlier answers, not that a lesson generalises)', /Each check is stored as a same-trade replay\. It shows recall of your earlier answers, not that a lesson generalises\./.test(await txt(v, '#ls-check-out')));

        // a later lesson, made on the eighth setup, that also speaks about the fifth
        await v.click('#tab-train'); await goOn(v); await nextPoint(v); await goOn(v); await nextPoint(v); await goOn(v);
        const on8 = await onSetup(cands[7]), a8 = await txt(v, '#dec-action'); await v.click('#mentor [data-choice="WAIT"]'); await v.click('#mentor [data-reason="htf-bias"]'); await v.fill('#m-text', 'Verify: do not chase with the bias.'); await saveCorrection();
        const kept8 = await keepConds(['biasAlign']); await saveLesson('Verify lesson 3: do not chase'); const p8 = await prove();
        check('a later lesson: the BUY on the eighth setup is corrected to WAIT and learned', on8 && a8 === 'BUY' && kept8.join() === 'biasAlign' && p8.verdict === 'learned' && p8.action === 'WAIT' && p8.same === 'yes', `${a8} ${kept8.join()} ${JSON.stringify(p8)}`);
        r = await runCheck(4); const broke = r.rows.find((x) => x.id === c5.id) || { text: '' };
        check('regression: the check reports the earlier correction the later lesson undid, and only that one', r.sum.broken === 1 && r.sum.holds === 3 && broke.status === 'broken' && r.rows.filter((x) => x.status === 'broken').length === 1 && /4 earlier verdicts checked against the 3 lessons in force: 3 still hold, 1 no longer holds, 0 never held\./.test(r.sum.text), r.sum.text);
        check('regression: it says what was asked for, what comes out now, and names the lesson that changed it', /No longer holds: you asked for SELL, and a fresh replay now gives WAIT\. Changed by: "Verify lesson 3: do not chase", it was not in force when this answer last held \(now: not applied: conflicts with lesson "Verify lesson 2: take this range"\)\./.test(broke.text) && !/Verify lesson 1/.test(broke.text) && /^An earlier answer was changed by a later lesson\./.test(await txt(v, '#ls-check-warn')), broke.text.slice(0, 260));
        await v.screenshot({ path: OUT + 'academy-11-regression.png', fullPage: true });
        for (const theme of ['dark', 'light', 'midnight']) { await v.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await v.waitForTimeout(350); const bad = await aa(v); check(`AA contrast, ${theme} theme (the regression check with a broken answer)`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
        await v.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
        // mend it: revise lesson 3 so that it only speaks where it was learned; the diff says what changes; the check is clean again
        const li3 = '#ls-list li.lsn:has(.lsn-head b:text-is("Verify lesson 3: do not chase"))';
        await v.click(`${li3} [data-act="revise"]`); await v.waitForSelector('#lr-save');
        const idle = (await v.isDisabled('#lr-save')) && /Nothing is changed yet/.test(await txt(v, '#lr-diff'));
        await v.click('#lr-add'); await v.fill('#lr-conds .cond:last-child input', 'newyork'); const diff = await txt(v, '#lr-diff');
        check('Lessons: a revision starts unchanged, then the diff names the old and the new condition', idle && /When: higher-timeframe bias with the trade → higher-timeframe bias with the trade AND session = newyork/.test(diff) && !(await v.isDisabled('#lr-save')), diff);
        await v.click('#lr-save'); await v.waitForSelector(`${li3}[data-version="2"]`, { timeout: 15000 });
        r = await runCheck(4);
        check('regression: after the revision the check finds every earlier answer intact again', r.sum.broken === 0 && r.sum.holds === 4 && r.rows.every((x) => x.status === 'holds') && !(await vis(v, '#ls-check-warn')), r.sum.text);
        // switching the fifth setup's own lesson off breaks it again, and the check says that lesson is gone; on again mends it
        const li2 = '#ls-list li.lsn:has(.lsn-head b:text-is("Verify lesson 2: take this range"))';
        await v.click(`${li2} [data-act="off"]`); await v.waitForSelector(`${li2}[data-active="no"]`, { timeout: 15000 }); r = await runCheck(4); const gone = r.rows.find((x) => x.id === c5.id) || { text: '' };
        check('regression: a lesson switched off is named as the cause when its own correction stops holding', r.sum.broken === 1 && gone.status === 'broken' && /Changed by: "Verify lesson 2: take this range", it gave this answer before and is no longer in force \(switched off or replaced\)\./.test(gone.text), gone.text.slice(0, 240));
        await v.click(`${li2} [data-act="on"]`); await v.waitForSelector(`${li2}[data-active="yes"]`, { timeout: 15000 }); r = await runCheck(4);
        check('regression: switched on again, the correction holds again', r.sum.broken === 0 && r.sum.holds === 4, r.sum.text);
        // "Replay this setup" from a result opens the Train tab on that setup
        await v.click(`#ls-check-list li[data-cand="${c5.id}"] [data-open]`); await v.waitForFunction((t) => document.getElementById('clock-time').textContent === t && /paused on a setup/.test(document.getElementById('clock-state').textContent), stamp(c5.t), { timeout: 60000 }).catch(() => {});
        check('Lessons: a checked setup can be opened in the Train tab from its row', (await txt(v, '#clock-time')) === stamp(c5.t) && (await vis(v, '#decision')) && (await txt(v, '#dec-action')) === 'SELL', `${await txt(v, '#clock-time')} ${await txt(v, '#dec-action')}`);
        // the records stay apart after all those replays: recall grew, new setups did not
        const pg = await api(v, `get=progress&edge=${EDGE}`);
        check('recall and new setups stay two records: the checks added same-trade replays and no test', pg.exam.n === 0 && pg.byMode.exam === 0 && pg.replaySame.n >= 18 && pg.byMode.train === 8 && pg.counts.corrections === 4, JSON.stringify({ byMode: pg.byMode, replay: pg.replaySame.n, exam: pg.exam.n }));
        await v.click('#tab-progress'); await v.waitForSelector('#pg-agree-all', { timeout: 20000 });
        check('Progress: agreement counts first decisions only (4 judged, 1 approved), under 20 says too few to judge', /Overall you approved 1 of 4 \(too few to judge\) of the first decisions you judged \(n = 4\)\./.test(await txt(v, '#pg-agree-all')) && /No test yet/.test(await txt(v, '#pg-fresh')), await txt(v, '#pg-agree-all'));
        check('no future bar reached a decision in the verification pass, and no outcome was asked for before its attempt', (await v.evaluate(() => window.MXAC.checks.future)) === 0 && (await v.evaluate(() => window.MXAC.checks.snapshots)) > 20 && (() => { const mine = reqs.filter((x) => x.tag === 'verify' && x.path === '/api/academy'); return mine.every((x, i) => x.q.get !== 'outcome' || mine.slice(0, i).some((y) => y.body && y.body.action === 'attempt' && y.body.attempt.candidateId === x.q.id)); })());
        await cv.close();
        // the same card on a phone: no sideways scroll, text 12 px or more, 44 px controls
        const pv = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' }); await pv.addInitScript(NO_PACE); v = await pv.newPage(); watch(v, 'verify-phone');
        await v.goto(HV + '/academy', { waitUntil: 'load' }); await setup(v, null, null); r = await runCheck(4);
        const wv = await v.evaluate(() => document.documentElement.scrollWidth), smallV = await v.evaluate(SMALL), tapsV = await v.evaluate(TAPS);
        check('390 px: the regression check runs and reads without sideways scroll, in text of 12 px or more, with 44 px controls', r.sum.holds === 4 && wv <= 390 && smallV.length === 0 && tapsV.length === 0 && (await v.evaluate(ENDLESS)).length === 0, `${wv} px; ${smallV.slice(0, 3).join(' ; ')} ${tapsV.slice(0, 3).join(' ; ')}`);
        await v.screenshot({ path: OUT + 'academy-12-regression-phone.png', fullPage: true });
        await pv.close();
      } finally { await cv.close().catch(() => {}); sv.proc.kill(); fs.rmSync(sv.store, { recursive: true, force: true }); }
    }

    // ---- 11j. access: every route answers 401 signed out and 403 to a member who is not the owner ----
    {
      const T = require(path.join(ROOT, 'api/academy.js')), GETS = Object.keys(T._t.GET), POSTS = Object.keys(T._t.POST);
      const q = (name) => `get=${name}&edge=${EDGE}&id=${encodeURIComponent(cands[0].id)}&cand=${encodeURIComponent(cands[0].id)}&month=2026-11&t=${cands[0].t}`;
      const gs = await startServer(portOf(2, +PORT + 2), ['--guest']), out = { get: [], post: [], other: [] };
      try {
        for (const name of GETS) { const x = await fetch(`${gs.H}/api/academy?${q(name)}`); out.get.push([name, x.status, (await x.json()).error, x.headers.get('cache-control')]); }
        for (const name of POSTS) { const x = await fetch(`${gs.H}/api/academy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, edge: EDGE, id: 'x' }) }); out.post.push([name, x.status, (await x.json()).error]); }
        for (const method of ['PUT', 'DELETE', 'PATCH']) { const x = await fetch(`${gs.H}/api/academy`, { method }); out.other.push([method, x.status]); }
        check(`access, signed out: all ${GETS.length} GET names and all ${POSTS.length} POST actions answer 401 "sign in first", never cached`, GETS.length >= 20 && POSTS.length >= 16 && out.get.every((x) => x[1] === 401 && x[2] === 'sign in first' && x[3] === 'private, no-store') && out.post.every((x) => x[1] === 401 && x[2] === 'sign in first'), JSON.stringify(out.get.concat(out.post).filter((x) => x[1] !== 401).slice(0, 4)));
        check('access: any method but GET and POST is refused (405)', out.other.every((x) => x[1] === 405), JSON.stringify(out.other));
        check('access, signed out: nothing was written to the store', fs.readdirSync(gs.store).length === 0, fs.readdirSync(gs.store).join());
        const gp = await (await b.newContext({ serviceWorkers: 'block' })).newPage(); watch(gp, 'guest2'); await gp.goto(gs.H + '/academy', { waitUntil: 'load' }); await gp.waitForTimeout(600);
        check('access, signed out on a signed-out server: the page says who it is for and asks for nothing', /The Academy is for the desk owner\. Sign in on the desk\./.test(await txt(gp, '#ac-gate')) && !(await vis(gp, '#ac-app')) && reqs.filter((x) => x.tag === 'guest2').length === 0, await txt(gp, '#ac-gate'));
        await gp.context().close();
      } finally { gs.proc.kill(); fs.rmSync(gs.store, { recursive: true, force: true }); }
      // a member who is not the owner: the real handler with that member's session, on a store that must stay empty
      const mem = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-audit-member-')), codes = [];
      const as = async (who, method, payload) => { const o = {}, res = { setHeader() {}, status(c) { o.code = c; return res; }, json(x) { o.body = x; return o; } }; await T.handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, { env: { ACADEMY_STORE_DIR: mem }, who: async () => who, sameOrigin: () => true }); return o; };
      for (const who of [{ u: 'fred', role: 'reviewer' }, { u: 'luxus', role: 'viewer' }]) { for (const name of GETS) codes.push([who.u, name, (await as(who, 'GET', { get: name, edge: EDGE, id: cands[0].id })).code]); for (const name of POSTS) codes.push([who.u, name, (await as(who, 'POST', { action: name, edge: EDGE })).code]); }
      check('access, a reviewer and a viewer: every route answers 403 and nothing is written', codes.length === 2 * (GETS.length + POSTS.length) && codes.every((x) => x[2] === 403) && fs.readdirSync(mem).length === 0 && (await as({ u: 'owner' }, 'GET', { get: 'lessons' })).code === 200, JSON.stringify(codes.filter((x) => x[2] !== 403).slice(0, 4)));
      fs.rmSync(mem, { recursive: true, force: true });
    }

    // ---- 11k. round 3, on a fresh store: the Session tab keeps its place and a half-written verdict; the Blind arena after a reload;
    //           the conflicting-lessons link ----
    {
      const s3 = await startServer(portOf(1, +PORT + 1)), H3 = s3.H, c3 = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); await c3.addInitScript(NO_PACE);
      const q = await c3.newPage(); watch(q, 'r3'); const asked = []; q.on('dialog', async (d) => { asked.push(d.type()); await d.accept(); });
      const mine = (from) => calls(reqs, from, 'r3').map(what), ssState = (t) => q.waitForFunction((x) => document.getElementById('ss-state').textContent === x, t, { timeout: 60000 });
      try {
        await q.goto(H3 + '/academy', { waitUntil: 'load' }); await setup(q, iso(cands[0].t), null);
        // -- Session: two setups, the place saved with each, a half-written verdict kept
        await q.click('#tab-session'); await q.waitForSelector('#ss-start', { timeout: 20000 }); await q.waitForFunction(() => /train setups? in this range/.test(document.getElementById('ss-count').textContent), null, { timeout: 15000 });
        check('Session: nothing to pick up on a fresh store', !(await vis(q, '#ss-resume-now')) && !(await vis(q, '#resume-now')));
        await q.fill('#ss-from', iso(cands[0].t)); await q.dispatchEvent('#ss-from', 'change'); await q.selectOption('#ss-speed', '100'); await q.click('#ss-start'); await q.waitForSelector('#ss-live:not([hidden])', { timeout: 60000 });
        let m = reqs.length; await q.click('#ss-play'); await q.waitForSelector('#ss-dec-stored', { timeout: 60000 }); await ssState('paused on a setup');
        const first = mine(m).filter((x) => x === 'attempt' || x === 'session.save');
        const other = await q.$eval('#ss-point [data-choice]:not([data-choice="approve"])', (x) => x.dataset.choice); await q.click(`#ss-point [data-choice="${other}"]`); await q.fill('#ss-v-text', 'Audit: half written.');
        m = reqs.length; await q.click('#ss-continue'); await q.waitForTimeout(300);
        check('Session: Continue with a half-written verdict leaves nothing behind the first time: it says so, stays on the setup and sends nothing', (await txt(q, '#ss-state')) === 'paused on a setup' && /Your verdict is not saved yet/.test(await txt(q, '#ss-run-msg')) && /Your verdict is not saved yet/.test(await txt(q, '#ss-continue-msg')) && (await q.inputValue('#ss-v-text')) === 'Audit: half written.' && mine(m).length === 0, `${await txt(q, '#ss-state')} | ${await txt(q, '#ss-run-msg')}`);
        await q.click('#ss-step'); await q.waitForTimeout(300);
        check('Session: a second press within ten seconds leaves (Step counts as the same question)', !(await vis(q, '#ss-point')) && (await txt(q, '#ss-state')) === 'paused');
        m = reqs.length; await q.click('#ss-play'); await q.waitForSelector('#ss-dec-stored', { timeout: 60000 }); await ssState('paused on a setup');
        const second = mine(m).filter((x) => x === 'attempt' || x === 'session.save'), t2 = await txt(q, '#ss-time'), a2 = await txt(q, '#ss-dec-action');
        check('Session: the place is saved with every decision: the first saves the session, then the attempt; every later one the attempt, then the session (two calls a decision)', first.join() === 'session.save,attempt' && second.join() === 'attempt,session.save' && t2 === stamp(cands[1].t), `${first.join()} | ${second.join()} | ${t2}`);
        const other2 = await q.$eval('#ss-point [data-choice]:not([data-choice="approve"])', (x) => x.dataset.choice); await q.click(`#ss-point [data-choice="${other2}"]`); await q.fill('#ss-v-text', 'Audit: I read this one differently.');
        await q.click('#ss-v-save'); await q.waitForFunction(() => /Verdict stored ✓/.test(document.getElementById('ss-v-msg').textContent), null, { timeout: 15000 });
        await q.click('#ss-continue'); await q.waitForTimeout(200); const leftClean = !(await vis(q, '#ss-point')); await q.click('#ss-play').catch(() => {});   // pause again at once: the place saved is the second setup
        check('Session: a stored verdict never asks', leftClean);
        // -- reload: offered on the Train tab and in the Session tab, back on the second setup with its verdict
        m = reqs.length; const nAsk = asked.length; await q.reload({ waitUntil: 'load' }); await q.waitForSelector('#resume-now:not([hidden])', { timeout: 20000 });
        check('Session: a reload with nothing half written asks nothing, and the sitting is offered at the top of the page', asked.length === nAsk && /^Session tab · .+ · paused at /.test(await txt(q, '#resume-now-text')) && (await txt(q, '#resume-now-go')) === 'Resume in the Session tab', await txt(q, '#resume-now-text'));
        await q.click('#resume-now-go'); await q.waitForSelector('#ss-dec-stored', { timeout: 60000 }); await ssState('paused on a setup');
        const back = mine(m);
        check('Session: Resume returns to the latest setup with its stored decision and verdict; nothing is decided or written again', (await txt(q, '#ss-time')) === t2 && (await txt(q, '#ss-dec-action')) === a2 && /Your verdict is stored ✓: it should have been /.test(await txt(q, '#ss-v-stored')) && (await q.$$('#ss-v-save')).length === 0 && !back.some((x) => !x.startsWith('get=')) && /^2 decisions/.test(await txt(q, '#ss-summary-text')) && /agreed with 0 of 1/.test(await txt(q, '#ss-summary-text')), `${await txt(q, '#ss-time')} ${await txt(q, '#ss-v-stored')} | ${await txt(q, '#ss-summary-text')} | ${back.join(' ')}`);
        check('Session: the resume costs reads only: the stored attempts and the verdict of that setup (and whether its lesson was saved)', back.filter((x) => x === 'get=attempts').length === 1 && back.filter((x) => x === 'get=corrections').length === 1 && !back.includes('get=outcome'), back.join(' '));
        check('Session: the lesson draft of the stored verdict is offered again (made again from the stored correction, nothing kept in the browser)', /^When: .+ → Then: /.test(await txt(q, '#ss-lesson-plain')) && await q.evaluate(() => Object.keys(localStorage).every((k) => k === 'mxacEdge' || k === 'mxacFold' || k === 'msPrefs')), await q.evaluate(() => Object.keys(localStorage).join(',')));
        await q.screenshot({ path: OUT + 'academy-r3-session-resumed.png', fullPage: true });
        await q.click('#ss-end'); await q.waitForFunction(() => /Session ended and saved/.test(document.getElementById('ss-run-msg').textContent), null, { timeout: 15000 });
        // -- Blind arena: a half-written answer, a reload, the hidden answer, one answer a setup
        await q.click('#tab-blind'); await q.waitForSelector('#bl-start', { timeout: 20000 }); await q.waitForFunction(() => /in this range/.test(document.getElementById('bl-count').textContent), null, { timeout: 15000 });
        await q.fill('#bl-from', iso(cands[2].t)); await q.dispatchEvent('#bl-from', 'change'); m = reqs.length; await q.click('#bl-start'); await q.waitForSelector('#bl-save', { timeout: 60000 });
        const bCand = await q.evaluate(() => window.MXAC.lastSnapshot.cand.id), bTime = await txt(q, '#bl-time');
        check('Blind arena: the setup card is folded while a round is on screen, and "Next setup" does not exist before an answer is stored', (await q.getAttribute('#bl-setup-toggle', 'aria-expanded')) === 'false' && (await q.$$('#bl-next')).length === 0);
        await q.click('#bl-answer [data-choice="WAIT"]'); await q.fill('#bl-text', 'Audit: half an answer.'); await q.click('#bl-setup-toggle');
        const m2 = reqs.length; await q.click('#bl-start'); await q.waitForTimeout(300);
        check('Blind arena: starting another round over a half-written answer says so first and changes nothing', /Your answer is not stored yet/.test(await txt(q, '#bl-leave')) && await vis(q, '#bl-leave') && (await q.inputValue('#bl-text')) === 'Audit: half an answer.' && (await txt(q, '#bl-time')) === bTime && mine(m2).length === 0, await txt(q, '#bl-leave'));
        const nAsk2 = asked.length; m = reqs.length; await q.reload({ waitUntil: 'load' });
        check('a reload over a half-written answer: the browser asks first', asked.slice(nAsk2).join() === 'beforeunload', asked.slice(nAsk2).join());
        await q.waitForSelector('#f-edge option', { state: 'attached', timeout: 15000 }); await q.click('#tab-blind'); await q.waitForSelector('#bl-start', { timeout: 20000 }); await q.waitForFunction(() => /in this range/.test(document.getElementById('bl-count').textContent), null, { timeout: 15000 });
        const hid3 = (await api(q, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(bCand)}`)).attempts.filter((a) => a.mode === 'blind');
        check('Blind arena, after a reload: the setup left open is named, the server still hides its engine answer and gives no outcome', /1 of them was left open: the engine's answer is stored and stays hidden until yours is/.test(await txt(q, '#bl-count')) && hid3.length === 1 && hid3[0].hidden === true && hid3[0].decision === null && (await q.evaluate(async (id) => (await fetch(`/api/academy?get=outcome&edge=gmp&_audit=1&id=${encodeURIComponent(id)}`)).status, bCand)) === 403, `${await txt(q, '#bl-count')} ${JSON.stringify(hid3.map((a) => [a.hidden, a.decision]))}`);
        await q.fill('#bl-from', iso(cands[2].t)); await q.dispatchEvent('#bl-from', 'change'); await q.click('#bl-start'); await q.waitForSelector('#bl-save', { timeout: 60000 });
        const after = mine(m);
        check('Blind arena, after a reload: the same setup comes back with no second hidden attempt, and nothing of the engine\'s answer on the page', (await txt(q, '#bl-time')) === bTime && !after.includes('attempt') && !after.includes('get=outcome') && !after.includes('get=attempts') && (await q.$$('#bl-engine, #bl-compare, #bl-dec-action')).length === 0 && await vis(q, '#bl-hidden') && !/recall/.test(await txt(q, '#bl-info')), `${await txt(q, '#bl-time')} | ${after.join(' ')}`);
        // the same setup answered meanwhile somewhere else (another window): the page's own answer is refused by the server and said in words
        const elsewhere = await q.evaluate(async (id) => (await fetch('/api/academy?_audit=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'blind.submit', blind: { edge: 'gmp', candidateId: id, action: 'WAIT', entry: null, stop: null, target: null, text: 'Audit: the other window.' } }) })).status, bCand);
        await q.click('#bl-answer [data-choice="BUY"]'); await q.fill('#bl-text', 'Audit: a second answer.'); await q.click('#bl-save'); await q.waitForSelector('#bl-already', { timeout: 20000 });
        const stored3 = (await api(q, `get=blind&edge=${EDGE}`)).blind.filter((r) => r.candidateId === bCand);
        check('Blind arena: a setup is answered once: the server refuses a second answer (409), the page says the first one stands and goes on', elsewhere === 200 && stored3.length === 1 && stored3[0].mentor.action === 'WAIT' && /first answer stands and nothing was stored twice/.test(await txt(q, '#bl-already')) && /Not stored again/.test(await txt(q, '#bl-msg')) && await vis(q, '#bl-next') && (await q.$$(`#bl-rows tr[data-cand="${bCand}"]`)).length === 1 && !errs.some((e) => /^r3: /.test(e)), `${elsewhere} ${stored3.length} ${await txt(q, '#bl-already')}`);
        for (let i = errs.length - 1; i >= 0; i--) if (/^r3 console: .*\b(409|403)\b/.test(errs[i])) errs.splice(i, 1);   // the refused outcome read (403) and the refused second answer (409) are the point of the checks above
        // -- two lessons that disagree on one setup: the decision names them and the link opens them in the Lessons tab
        const side = cands[3].side, mk = (title, action) => q.evaluate(async (l) => (await (await fetch('/api/academy?_audit=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lesson.save', lesson: l }) })).json()).lesson, { edge: EDGE, title, text: '', when: [{ f: 'side', op: 'eq', v: side }], then: { action, adjust: {}, note: '' }, source: {}, active: true });
        const lw = await mk('Audit: wait on this side', 'WAIT'), lt = await mk('Audit: take this side', 'TAKE');
        await q.click('#tab-train'); await q.fill('#f-from', iso(cands[3].t)); await q.dispatchEvent('#f-from', 'change'); await q.waitForTimeout(300); await q.evaluate(() => { const d = document.getElementById('setup-opts'); if (d) d.open = true; }); await q.check('input[name=speed][value="100"]', { force: true });
        await q.click('#start'); await q.waitForSelector('#replay:not([hidden])', { timeout: 60000 }); await q.click('#c-play'); await nextPoint(q);
        const cText = await txt(q, '#dec-conflict');
        check('conflicting lessons: the decision waits, names both lessons by their titles and offers the way to them', (await txt(q, '#dec-action')) === 'WAIT' && /Two lessons disagree on this setup/.test(cText) && cText.includes('"Audit: wait on this side"') && cText.includes('"Audit: take this side"') && !/ls_[0-9a-z]{6,}/.test(cText) && await vis(q, '#dec-conflict-open'), cText);
        m = reqs.length; await q.click('#dec-conflict-open'); await q.waitForSelector('#ls-list li[data-focus="yes"]', { timeout: 20000 });
        const hit = await q.$$eval('#ls-list li[data-focus="yes"]', (l) => l.map((x) => x.textContent));
        check('conflicting lessons: the link opens the Lessons tab on that edge with exactly the two lessons outlined and says what to do', (await q.getAttribute('#tab-lessons', 'aria-selected')) === 'true' && (await q.inputValue('#ls-edge')) === EDGE && hit.length === 2 && hit.some((t) => t.includes(lw.title)) && hit.some((t) => t.includes(lt.title)) && /Revise one so they no longer meet on the same setup, or switch one off/.test(await txt(q, '#ls-focus')) && !mine(m).some((x) => !x.startsWith('get=')), `${hit.length} | ${await txt(q, '#ls-focus')} | ${mine(m).join(' ')}`);
        await q.click('#tab-train'); await q.click('#tab-lessons'); await q.waitForSelector('#ls-list li', { timeout: 20000 }); await q.waitForTimeout(400);
        check('conflicting lessons: the outline is shown once (a later visit to the tab is plain)', (await q.$$('#ls-list li[data-focus="yes"], #ls-focus')).length === 0);
        const ck3 = await q.evaluate(() => window.MXAC.checks);
        check('round 3: no future bar reached a decision on this page either', ck3.future === 0 && ck3.snapshots > 0, JSON.stringify(ck3));
      } finally { await c3.close().catch(() => {}); s3.proc.kill(); fs.rmSync(s3.store, { recursive: true, force: true }); }
    }

    // ---- 12. themes: AA contrast in dark, light and midnight, on the setup and on a decision ----
    for (const theme of ['dark', 'light', 'midnight']) {
      await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(450);   // colour transitions are 150 ms
      const bad = await aa(p); check(`AA contrast, ${theme} theme (replay view)`, bad.length === 0, bad.slice(0, 4).join(' ; '));
    }
    await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await ctx.close();

    // ---- 13. phone, 390 px: panels stack with the chart first, no sideways scroll, text 12 px or more, 44 px targets ----
    {
      const ph = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' }); await ph.addInitScript(NO_PACE); p = await ph.newPage(); watch(p, 'phone');
      await p.goto(H + '/academy', { waitUntil: 'load' }); await setup(p, iso(cands[0].t), '100');
      const n0 = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c1.id)}`)).attempts.length;
      let w = await p.evaluate(() => document.documentElement.scrollWidth); check('390 px: no sideways scroll on the setup', w <= 390, w);
      let small = await p.evaluate(SMALL); check('390 px: every text is 12 px or more (setup)', small.length === 0, small.slice(0, 4).join(' ; '));
      let taps = await p.evaluate(TAPS); check('390 px, touch: every control is at least 44 px tall (setup)', taps.length === 0, taps.slice(0, 5).join(' ; '));
      for (const theme of ['light', 'midnight']) { await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(120); const bad = await aa(p); check(`AA contrast, ${theme} theme (setup)`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
      await p.evaluate(() => { delete document.documentElement.dataset.theme; });
      await p.tap('#start'); await p.waitForSelector('#replay:not([hidden])', { timeout: 60000 }); await p.tap('#c-play'); await nextPoint(p);
      { const r = await p.$eval('#point-bar', (e) => { const q = e.getBoundingClientRect(); return [Math.round(q.top), Math.round(q.bottom), e.hidden]; });
        check('390 px: when the clock stops on a setup the line that says so is on screen, under the chart', !r[2] && r[0] >= 0 && r[1] <= 844, r.join(','));
        await p.tap('#point-verdict'); await p.waitForTimeout(250); const mt = await p.$eval('#mentor', (e) => Math.round(e.getBoundingClientRect().top));
        check('390 px: "Give your verdict" brings the mentor controls to the top of the screen, clear of the top bar', mt >= 50 && mt <= 120, mt); }
      await p.tap('#mentor [data-choice="WAIT"]').catch(() => {}); await p.waitForTimeout(200);
      w = await p.evaluate(() => document.documentElement.scrollWidth); check('390 px: no sideways scroll on a decision with the mentor controls open', w <= 390, w);
      small = await p.evaluate(SMALL); check('390 px: every text is 12 px or more (decision)', small.length === 0, small.slice(0, 4).join(' ; '));
      taps = await p.evaluate(TAPS); check('390 px, touch: every control is at least 44 px tall (decision)', taps.length === 0, taps.slice(0, 5).join(' ; '));
      await p.tap('#whatif-run'); await p.waitForSelector('#whatif-table', { timeout: 30000 }); await p.evaluate(() => document.getElementById('whatif').scrollIntoView());
      w = await p.evaluate(() => document.documentElement.scrollWidth); check('390 px: no sideways scroll with the "What if" table open', w <= 390, w);
      small = await p.evaluate(SMALL); check('390 px: every text is 12 px or more (what if)', small.length === 0, small.slice(0, 4).join(' ; '));
      taps = await p.evaluate(TAPS); check('390 px, touch: every control is at least 44 px tall (what if)', taps.length === 0, taps.slice(0, 5).join(' ; '));
      for (const theme of ['light', 'midnight']) { await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(120); const bad = await aa(p); check(`AA contrast on the phone, ${theme} theme (what if)`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
      await p.evaluate(() => { delete document.documentElement.dataset.theme; });
      const order = await p.evaluate(() => ['chart', 'acct-card', 'decision', 'mentor'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().top + scrollY)));
      check('390 px: the panels stack and the chart stays first', order[0] < order[1] && order[1] < order[2] && order[2] < order[3], order.join(' < '));
      check('reduced motion is respected (no transition left running)', await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.btn')).transitionDuration) <= 0.001));
      { const a2 = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c1.id)}`)).attempts; check('another sitting on the same setup stores the next attempt number, as a same-trade replay', a2.length === n0 + 1 && a2[n0].n === n0 + 1 && a2[n0].mode === 'replay-same', JSON.stringify(a2.map((a) => [a.n, a.mode]))); }
      await p.screenshot({ path: OUT + 'academy-5-phone.png' });   // not a full-page shot: that would reset the touch emulation for the checks below
      for (const [id, sel] of [['lessons', '#ls-list li[data-lesson]'], ['progress', '#pg-queue'], ['research', '#rs-table'], ['blind', '#bl-rows'], ['session', '#ss-saved li']]) {
        await p.tap('#tab-' + id); await p.waitForSelector(sel, { timeout: 20000 }); if (id === 'lessons') { await p.tap('#ls-list [data-act="revise"]'); await p.waitForSelector('#lr-title'); }
        w = await p.evaluate(() => document.documentElement.scrollWidth); check(`390 px: no sideways scroll (${id})`, w <= 390, w);
        small = await p.evaluate(SMALL); check(`390 px: every text is 12 px or more (${id})`, small.length === 0, small.slice(0, 4).join(' ; '));
        taps = await p.evaluate(TAPS); check(`390 px, touch: every control is at least 44 px tall (${id})`, taps.length === 0, taps.slice(0, 5).join(' ; '));
        if (id === 'lessons' || id === 'progress') for (const theme of ['light', 'midnight']) { await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(120); const bad = await aa(p); check(`AA contrast on the phone, ${theme} theme (${id})`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
        await p.evaluate(() => { delete document.documentElement.dataset.theme; });
      }
      const two = await p.evaluate(() => { document.getElementById('tab-progress').click(); return null; }); await p.waitForSelector('#pg-recall');
      const stack = await p.evaluate(() => ['pg-recall', 'pg-fresh'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().top)));
      check('390 px: recall and new setups stack, still as two separate blocks', stack[0] < stack[1] && two === null, stack.join(' < '));
      await p.screenshot({ path: OUT + 'academy-10-phone-progress.png', fullPage: true });
      await ph.close();
    }
    // ---- 14. the pace switched on, as on the live site: the page holds itself under the firewall's limit ----
    {
      const pc = await b.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: 'block' }); await pc.addInitScript('window.MXAC_PACE = 3;'); p = await pc.newPage(); watch(p, 'paced');
      const t0 = Date.now(); await p.goto(H + '/academy', { waitUntil: 'load' }); await p.waitForFunction(() => { const n = document.getElementById('ac-net'); return n && !n.hidden; }, null, { timeout: 15000 }).catch(() => {});
      const line = await txt(p, '#ac-net'), sent = calls(reqs, 0, 'paced').length;
      check('with a pace of 3 a minute the fourth call waits its turn and the page says so calmly', /^Waiting for the server's rate limit… about \d+ s\. Nothing is lost: the page carries on by itself\.$/.test(line) && sent === 3 && Date.now() - t0 < 15000, `${sent} calls sent; "${line}"`);
      check('the default pace is 24 Academy calls a minute, under the firewall\'s 30', await p.evaluate(() => window.MXAC.PACE === 24 && window.MXAC.TRIES === 4));
      await pc.close();
    }
    check('no page errors and no console errors anywhere', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) { check('the audit ran to the end', false, e.message.split('\n')[0]); }
  finally { await b.close().catch(() => {}); srv.proc.kill(); fs.rmSync(srv.store, { recursive: true, force: true }); }
  const bad = R.filter((r) => !r.ok);
  for (const r of R) console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok || !r.info ? '' : ' :: ' + r.info));
  console.log(`\nAcademy audit: ${R.length - bad.length} of ${R.length} checks passed` + (bad.length ? `, ${bad.length} FAILED` : ''));
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error('audit crashed:', e); process.exit(1); });

// ====================================================================================================================
// ANALYST (language model) — APPENDED BLOCK. Everything from here to the end of the file belongs to the analyst.
// ====================================================================================================================
// It runs after the audit above has printed its result (the hook below takes the audit's final process.exit, runs
// analystAudit(), then exits with the audit's code, or 1 when an analyst check failed). It starts its own two dev servers
// on PORT + 11 and PORT + 12, so it shares no page, store or port with the checks above. No network and no key:
//   - the normal dev server: the analyst is OFF. The decision card says so, nothing is sent, a decision costs no extra call.
//   - a `--fake-llm` dev server: the whole flow against the labelled FAKE provider (scripts/academy-fake-llm.cjs, a fixed
//     rule, not a language model): the banner, ask, the answer beside the engine's, stored apart, the cache, a correction,
//     a lesson, the same setup asked again, "ask on every setup" with its estimate first, the phone layout.
// Not covered here (covered in tests/academy-analyst.test.mjs): the budgets and the call cap stopping a run, a refused
// answer, hard gates, MANAGE, exam setups. The fake server's budgets cannot be changed from outside, on purpose.
{
  const exit0 = process.exit.bind(process); let ran = false;
  process.exit = (code) => { if (ran) return exit0(code); ran = true; analystAudit().then((bad) => exit0(code || (bad ? 1 : 0)), (e) => { console.error('analyst audit crashed:', e); exit0(1); }); };
}
async function analystAudit() {
  const A = [], ok = (name, pass, info = '') => { A.push({ name, ok: !!pass, info: String(info).slice(0, 220) }); };
  const start = async (port, args) => {
    const store = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-analyst-')), base = 'http://127.0.0.1:' + port, env = { ...process.env, PORT: String(port), ACADEMY_STORE_DIR: store };
    for (const k of Object.keys(env)) if (/^ACADEMY_LLM_/.test(k)) delete env[k];
    const proc = spawn(process.execPath, [path.join(ROOT, 'scripts/academy-dev.mjs'), ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; proc.stdout.on('data', (d) => { log += d; }); proc.stderr.on('data', (d) => { log += d; });
    for (let i = 0; i < 60; i++) { if (proc.exitCode != null) throw new Error('the dev server stopped: ' + log.trim()); try { const r = await fetch(base + '/api/academy?get=edges'); if (r.ok) return { proc, store, base, log: () => log }; } catch (e) { /* not up yet */ } await new Promise((r) => setTimeout(r, 250)); }
    proc.kill(); throw new Error('the dev server did not answer on ' + base);
  };
  const stop = (s) => { if (s) { s.proc.kill(); fs.rmSync(s.store, { recursive: true, force: true }); } };
  const open = async (b, base, opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', ...opts }); await ctx.addInitScript(NO_PACE);
    const p = await ctx.newPage(), reqs = [], errs = [];
    p.on('pageerror', (e) => errs.push(e.message.split('\n')[0])); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
    p.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/academy' && !u.searchParams.get('_audit')) { let body = null; try { body = r.postDataJSON(); } catch (e) { /* GET */ } reqs.push(body ? body.action + (body.dryRun ? ':dry' : '') : 'get=' + u.searchParams.get('get')); } });
    return { ctx, p, reqs, errs };
  };
  const run = async (p, from) => {
    await p.waitForSelector('#f-edge option', { state: 'attached', timeout: 15000 }); await p.selectOption('#f-edge', EDGE);
    await p.waitForFunction(() => /setups? in this range/.test(document.getElementById('f-count').textContent), null, { timeout: 15000 });
    if (from) { await p.fill('#f-from', from); await p.dispatchEvent('#f-from', 'change'); await p.waitForTimeout(300); }
    await p.click('#start'); await p.waitForSelector('#replay:not([hidden])', { timeout: 60000 }); await p.click('#c-speed [data-speed="100"]');
  };
  const nextPoint = async (p) => { await p.waitForSelector('#dec-stored', { timeout: 60000 }); await p.waitForFunction(() => /stored/.test(document.getElementById('dec-stored').textContent) && /paused on a setup/.test(document.getElementById('clock-state').textContent), null, { timeout: 60000 }); await p.waitForSelector('#an-block', { timeout: 10000 }); };
  const goOn = async (p) => { await p.click('#continue'); await p.waitForSelector('#dec-action', { state: 'detached', timeout: 20000 }); };
  const candNow = (p) => p.evaluate(() => { const x = window.MXAC.point(); return x ? { id: x.cur.cand.id, t: x.cur.cand.t, engine: x.cur.latest.decision.action } : null; });
  let off = null, fake = null, con = null, b = null;
  try {
    b = await chromium.launch();
    const P = Number(PORT);
    // ---- A. the normal dev server: the analyst is off ----
    off = await start(portOf(3, P + 11), []);
    {
      const { ctx, p, reqs, errs } = await open(b, off.base); await p.goto(off.base + '/academy', { waitUntil: 'load' }); await run(p, null);
      const m = reqs.length; await p.click('#c-play'); await nextPoint(p);
      ok('analyst off: the decision card says "Off. No key is set. Nothing was sent. Cost so far: $0.00"', (await txt(p, '#an-off')) === 'Off. No key is set. Nothing was sent. Cost so far: $0.00', await txt(p, '#an-block'));
      ok('analyst off: the block is titled "Analyst (language model)" and points to the setup doc', /^Analyst \(language model\)/.test(await txt(p, '#an-title')) && /docs\/academy\/LLM\.md/.test(await txt(p, '#an-howto')), await txt(p, '#an-howto'));
      ok('analyst off: no ask button, no "every setup" switch, no fake banner', (await p.$$('#an-ask, #an-auto, #an-fake, #an-answer')).length === 0);
      ok('analyst off: the block sits inside the decision card, above "Continue replay"', await p.evaluate(() => { const a = document.getElementById('an-block'), c = document.getElementById('continue'); return a.parentElement.id === 'decision' && !!(a.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); }));
      ok('analyst off: a train decision still costs the same Academy calls (the ledger was read once, when the replay opened)', reqs.slice(m).join() === 'session.save,attempt' && reqs.filter((x) => x === 'get=cost').length === 1 && !reqs.some((x) => /^analyse/.test(x)), reqs.join(' '));
      const cur = await candNow(p), att = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(cur.id)}`)).attempts;
      const direct = await p.evaluate(async (bd) => { const r = await fetch('/api/academy?_audit=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bd) }); return { status: r.status, body: await r.json() }; }, { action: 'analyse', edge: EDGE, candidateId: cur.id, attemptId: att[0].id, provider: 'fake-test', fake: true });
      ok('analyst off: the route itself answers "not available" with the reason, and makes nothing up', direct.status === 200 && direct.body.available === false && direct.body.reason === 'no language-model key configured' && direct.body.decision === undefined, JSON.stringify(direct.body));
      const cost = await api(p, 'get=cost'), prog = await api(p, `get=progress&edge=${EDGE}`);
      ok('analyst off: nothing was spent, nothing of the analyst is stored', cost.enabled === false && cost.total.usd === 0 && cost.total.requests === 0 && cost.fake === false && prog.analyst.attempts === 0 && !fs.existsSync(path.join(off.store, 'analyst')), JSON.stringify(cost.total));
      await p.goto(off.base + '/academy?fake-llm=1&provider=fake-test', { waitUntil: 'load' }); await p.waitForTimeout(500);
      ok('the fake provider cannot be switched on from the address bar', (await api(p, 'get=cost')).enabled === false && /analyst: off/.test(off.log()));
      ok('analyst off: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
    // ---- B. the labelled fake provider (only this dev server's injected dependency) ----
    fake = await start(portOf(4, P + 12), ['--fake-llm']);
    {
      const { ctx, p, reqs, errs } = await open(b, fake.base); await p.goto(fake.base + '/academy', { waitUntil: 'load' }); await run(p, null);
      const m = reqs.length; await p.click('#c-play'); await nextPoint(p);
      ok('fake provider: a visible banner says "FAKE PROVIDER: test answers, not a language model"', await vis(p, '#an-fake') && /FAKE PROVIDER: test answers, not a language model/.test(await txt(p, '#an-fake')) && /FAKE PROVIDER \(--fake-llm\)/.test(fake.log()), await txt(p, '#an-fake'));
      ok('never automatic: the decision came and went without an ask; the switch is off', reqs.slice(m).join() === 'session.save,attempt' && !(await p.isChecked('#an-auto')) && (await p.$$('#an-answer')).length === 0, reqs.slice(m).join(' '));
      ok('the block shows the provider, today\'s spend and the calls left', /^Provider: fake-test\. Today \$0\.00 of \$0\.50, 40 calls left today\./.test(await txt(p, '#an-budget')), await txt(p, '#an-budget'));
      const c1 = await candNow(p), prog0 = await api(p, `get=progress&edge=${EDGE}`);
      const m1 = reqs.length; await p.click('#an-ask'); await p.waitForSelector('#an-answer', { timeout: 20000 });
      const label = await txt(p, '#an-label');
      ok('Ask the analyst: one call; the answer is labelled as language-model output with its provider and its cost', reqs.slice(m1).join() === 'analyse' && /^Language-model output\. Provider: fake-test\. Cost \$0\.\d+, [\d,]+ tokens in, [\d,]+ out\. Analyst attempt 1 stored apart ✓$/.test(label), label);
      ok('the analyst\'s answer is shown beside the engine\'s: action, confidence and levels of both', (await txt(p, '#an-eng-action')) === c1.engine && ['BUY', 'SELL', 'WAIT'].includes(await txt(p, '#an-action')) && (await p.$$eval('#an-cmp tbody tr', (l) => l.map((r) => r.cells[0].textContent))).join() === 'Action,Confidence,Entry,Stop,Target,Lessons used', await txt(p, '#an-cmp'));
      ok('it shows evidence both ways, the uncertainty, the lessons it used and what the checks refused', (await p.$$('#an-support li, #an-against li')).length >= 2 && /FAKE PROVIDER: this is a test answer/.test(await txt(p, '#an-uncertainty')) && /It named no lesson\./.test(await txt(p, '#an-lessons')) && /Checked before it was stored: nothing refused\./.test(await txt(p, '#an-checked')) && /^Thesis \(bias \w+\): FAKE PROVIDER/.test(await txt(p, '#an-thesis')));
      const mine = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c1.id)}&engine=language-model`)).attempts, theirs = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c1.id)}`)).attempts, prog1 = await api(p, `get=progress&edge=${EDGE}`);
      ok('stored apart: one analyst attempt marked language-model with its provider; the engine\'s attempts and counts did not move', mine.length === 1 && mine[0].engine === 'language-model' && mine[0].llm.provider === 'fake-test' && mine[0].decision.engine === 'language-model' && theirs.length === 1 && theirs[0].engine === undefined && prog1.counts.attempts === prog0.counts.attempts && prog1.analyst.attempts === 1 && fs.existsSync(path.join(fake.store, 'analyst', 'attempts', EDGE + '.json')), JSON.stringify([mine.length, theirs.length, prog1.counts.attempts, prog1.analyst.attempts]));
      const au = (await api(p, 'get=audit')).rows.filter((r) => r.action === 'analyse'), cost1 = await api(p, 'get=cost');
      ok('one audit row for the ask; the ledger holds one request and its cost; no key in either', au.length === 1 && /analyst (BUY|SELL|WAIT)/.test(au[0].summary) && /fake-test/.test(au[0].summary) && cost1.total.requests === 1 && cost1.total.usd > 0 && cost1.fake === true && !/fake-test-key/.test(JSON.stringify([au, cost1])), JSON.stringify(au.map((r) => r.summary)));
      const m2 = reqs.length; await p.click('#an-ask'); await p.waitForFunction(() => /Answered from the cache/.test(document.getElementById('an-label').textContent), null, { timeout: 20000 });
      const cost2 = await api(p, 'get=cost');
      ok('the same question again is answered from the cache: no cost, no second attempt', reqs.slice(m2).join() === 'analyse' && /Answered from the cache: no call, no cost\./.test(await txt(p, '#an-label')) && cost2.total.requests === 1 && cost2.total.usd === cost1.total.usd && (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c1.id)}&engine=language-model`)).attempts.length === 1, await txt(p, '#an-label'));
      // on to a setup the engine takes, so there is a trade to correct
      let cur = c1; for (let i = 0; i < 12 && cur.engine === 'WAIT'; i++) { await goOn(p); await nextPoint(p); cur = await candNow(p); }
      ok('a later setup the engine takes: the card shows a fresh analyst block with no answer yet', cur.engine !== 'WAIT' && (await p.$$('#an-answer')).length === 0 && (await txt(p, '#an-ask')) === 'Ask the analyst', `${cur.id} ${cur.engine}`);
      await p.click('#an-ask'); await p.waitForSelector('#an-answer', { timeout: 20000 });
      ok('the fake follows the engine there (its fixed rule), on the setup\'s own levels', (await txt(p, '#an-action')) === cur.engine && (await p.getAttribute('#an-answer', 'data-provider')) === 'fake-test', await txt(p, '#an-action'));
      // the mentor corrects the analyst: WAIT, a reason, a text
      await p.click('[data-an-choice="WAIT"]'); await p.click('[data-an-reason="session"]'); await p.fill('#an-text', 'Audit: not in this session.'); await p.click('#an-save'); await p.waitForSelector('#an-corrected', { timeout: 15000 });
      const corA = (await api(p, `get=corrections&edge=${EDGE}&engine=language-model`)).corrections, corE = (await api(p, `get=corrections&edge=${EDGE}`)).corrections;
      ok('a correction of the analyst is stored in the analyst\'s own file, not with the engine\'s corrections', corA.length === 1 && corA[0].engine === 'language-model' && corA[0].action === 'WAIT' && corA[0].reasons.join() === 'session' && corE.length === 0 && /Correction saved ✓ \(change → WAIT\)/.test(await txt(p, '#an-corrected')), JSON.stringify([corA.length, corE.length]));
      await p.waitForSelector('#an-lesson-save'); await p.click('#an-lesson-save'); await p.waitForSelector('#an-lesson-saved', { timeout: 15000 });
      const lessons = (await api(p, `get=lessons&edge=${EDGE}&active=1`)).lessons;
      ok('the lesson from that correction is saved and in force', lessons.length === 1 && lessons[0].then.action === 'WAIT' && lessons[0].source.correctionId === corA[0].id && /Lesson saved ✓ \(version 1\)/.test(await txt(p, '#an-lesson-saved')), JSON.stringify(lessons.map((l) => l.title)));
      await p.click('#an-again'); await p.waitForSelector('#an-verdict', { timeout: 20000 });
      const two = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(cur.id)}&engine=language-model`)).attempts;
      ok('asked again on the same setup: attempt 2 is a same-trade replay, the lesson is named, the answer is now WAIT, the verdict is "learned"', two.length === 2 && two[1].mode === 'replay-same' && two[1].decision.action === 'WAIT' && two[1].decision.lessonsApplied[0].id === lessons[0].id && (await p.getAttribute('#an-verdict', 'data-verdict')) === 'learned' && (await txt(p, '#an-action')) === 'WAIT' && /action \((BUY|SELL) → WAIT\)/.test(await txt(p, '#an-changed')), `${two.map((a) => a.mode + ':' + a.decision.action).join(' ')} ${await txt(p, '#an-verdict')}`);
      const ls2 = (await api(p, `get=lessons&edge=${EDGE}&active=1`)).lessons[0], prog2 = await api(p, `get=progress&edge=${EDGE}`);
      ok('the engine\'s recall record and the lesson\'s own counters are untouched by the analyst\'s replay', ls2.stats.replayPass === 0 && ls2.stats.replayFail === 0 && prog2.replaySame.n === 0 && prog2.analyst.replaySame.pass === 1 && prog2.counts.corrections === 0, JSON.stringify([ls2.stats, prog2.analyst.replaySame]));
      // "ask on every setup of this run": the estimate first, nothing starts on the tick
      await goOn(p); await nextPoint(p); const c3 = await candNow(p), m3 = reqs.length;
      await p.click('#an-auto'); await p.waitForSelector('#an-plan-text', { timeout: 15000 });
      const plan = await txt(p, '#an-plan-text');
      ok('"Ask on every setup of this run" shows the estimated cost of the run first and starts nothing', reqs.slice(m3).join() === 'analyse:dry' && !(await p.isChecked('#an-auto')) && /^\d+ setups? left in this run\. One ask costs at most about \$0\.\d+ \(the whole output cap is counted\), so the run costs at most about \$\d+\.\d+\./.test(plan) && /stops by itself/.test(plan) && (await p.$$('#an-answer')).length === 0, plan);
      await p.click('#an-plan-go'); await p.waitForSelector('#an-answer', { timeout: 20000 });
      ok('after the owner confirms it, the open setup is asked and the switch is on', await p.isChecked('#an-auto') && /On: the analyst is asked on every setup of this run/.test(await txt(p, '#an-auto-on')), await txt(p, '#an-auto-on'));
      await goOn(p); await nextPoint(p); await p.waitForSelector('#an-answer', { timeout: 20000 }); const c4 = await candNow(p);
      const auto = (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c4.id)}&engine=language-model`)).attempts;
      ok('the next setup of the run is asked by itself, once, after the engine\'s own attempt', c4.id !== c3.id && auto.length === 1 && reqs.slice(-3).join() === 'attempt,session.save,analyse', reqs.slice(-4).join(' '));   // the position save sits between them since round 2
      await p.click('#an-auto'); ok('unticking the switch stops it', !(await p.isChecked('#an-auto')) && (await p.$$('#an-auto-on')).length === 0);
      for (const theme of ['', 'light', 'midnight']) { await p.evaluate((t) => { if (t) document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(350); const bad = await aa(p); ok(`AA contrast with the analyst's answer open, ${theme || 'the default'} theme`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }   // 350 ms: colour transitions have ended
      await p.evaluate(() => { delete document.documentElement.dataset.theme; });
      ok('fake flow: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
    // ---- C. the phone ----
    {
      const { ctx, p, errs } = await open(b, fake.base, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); await p.goto(fake.base + '/academy', { waitUntil: 'load' }); await run(p, null);
      await p.tap('#c-play'); await nextPoint(p); await p.tap('#an-ask'); await p.waitForSelector('#an-answer', { timeout: 20000 }); await p.evaluate(() => document.getElementById('an-block').scrollIntoView());
      const w = await p.evaluate(() => document.documentElement.scrollWidth), small = await p.evaluate(SMALL), taps = await p.evaluate(TAPS);
      ok('390 px: no sideways scroll with the analyst\'s answer open', w <= 390, w); ok('390 px: every text is 12 px or more (analyst)', small.length === 0, small.slice(0, 4).join(' ; ')); ok('390 px, touch: every control is at least 44 px tall (analyst)', taps.length === 0, taps.slice(0, 5).join(' ; '));
      ok('390 px: the fake banner is still on screen with the answer', await vis(p, '#an-fake') && errs.length === 0, errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
    // ---- D. the connector: no provider key, the owner's own assistant answers through /api/academy-mcp ----
    con = await start(portOf(5, P + 13), ['--connector']);
    {
      const { ctx, p, reqs, errs } = await open(b, con.base); await p.goto(con.base + '/academy', { waitUntil: 'load' }); await run(p, null);
      await p.click('#c-play'); await nextPoint(p);
      ok('connector: with no key the block says your own assistant answers, at no cost, and nothing waits', (await txt(p, '#an-via')) === 'Answered by your own assistant through the connector: no provider key, no cost. No question waits.' && (await p.getAttribute('#an-block', 'data-state')) === 'connector' && (await p.$$('#an-off, #an-auto')).length === 0, await txt(p, '#an-block'));
      const m = reqs.length; await p.click('#an-ask'); await p.waitForSelector('#an-queued', { timeout: 20000 });
      ok('connector: asking queues the question; the page says nothing was sent and nothing was charged', /^Waiting for your assistant: this question is number 1 of 1 in the queue\. Nothing was sent to a provider and nothing was charged\.$/.test(await txt(p, '#an-queued')) && /1 question waits for it\.$/.test(await txt(p, '#an-via')) && await p.isDisabled('#an-ask') && reqs.slice(m).join() === 'analyse', (await txt(p, '#an-queued')) + ' | ' + reqs.slice(m).join(' '));
      await p.click('#an-connector'); await p.waitForSelector('#an-connector-url', { timeout: 10000 });
      const url = await p.inputValue('#an-connector-url'), route = new URL(url).pathname;
      ok('connector: "Set up the connector" shows the address and the five steps, and says what the assistant cannot do', /^https:\/\/[^/]+\/api\/academy-mcp\/[0-9a-f]{40}$/.test(url) && (await p.$$('#an-connector-steps li')).length === 5 && /never shown how a trade ended/.test(await txt(p, '#an-connector-box')), url.replace(/[0-9a-f]{40}$/, '<key>'));
      // the assistant's side, the way its app calls the connector
      const rpc = async (pathname, msg) => { const r = await fetch(con.base + pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(msg) }); return { code: r.status, body: r.status === 202 ? null : await r.json() }; };
      const tool = async (name, args = {}) => (await rpc(route, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })).body.result;
      const wrong = await rpc('/api/academy-mcp/' + '0'.repeat(40), { jsonrpc: '2.0', id: 1, method: 'tools/list' });
      const tools = (await rpc(route, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).body.result.tools.map((t) => t.name);
      ok('connector: a wrong key is refused; the right one lists four tools and nothing else', wrong.code === 401 && tools.join() === 'academy_guide,academy_pending,academy_question,academy_answer', wrong.code + ' ' + tools.join());
      const pend = (await tool('academy_pending')).structuredContent, one = (await tool('academy_question', { id: pend.questions[0].id })).structuredContent;
      const facts = JSON.parse(/<facts>\n([\s\S]*?)\n<\/facts>/.exec(one.question)[1]), ans = require(path.join(ROOT, 'scripts/academy-fake-llm.cjs')).answerFor(facts);
      const refused = await tool('academy_answer', { id: pend.questions[0].id, answer: { ...ans, probability: 0.8 } });
      const sent = (await tool('academy_answer', { id: pend.questions[0].id, answer: ans, by: 'audit assistant' })).structuredContent;
      ok('connector: the assistant reads the waiting question (no result in it); an answer with a probability is refused, a clean one is stored', pend.pending === 1 && !/"(netR|exitT|mfeR|maeR)"/.test(one.question) && refused.isError === true && /probab|key/i.test(refused.content[0].text) && sent && sent.stored === true, JSON.stringify(sent || refused).slice(0, 200));
      await p.click('#an-check'); await p.waitForSelector('#an-label', { timeout: 20000 });
      ok('connector: "Check for the answer" shows it beside the engine\'s, said to come from your own assistant, stored apart, at no cost', /From your own assistant, through the connector\. It signed as: audit assistant\./.test(await txt(p, '#an-label')) && /no provider call, no cost/i.test(await txt(p, '#an-label')) && /^Analyst attempt 1 stored apart/.test(await txt(p, '#an-stored')) && (await p.getAttribute('#an-answer', 'data-action')) === ans.action && (await p.$$('#an-queued')).length === 0, await txt(p, '#an-label'));
      const cost = await api(p, 'get=cost'), an = (await api(p, `get=attempts&edge=${EDGE}&engine=language-model`)).attempts;
      ok('connector: nothing waits afterwards, the ledger is at zero and the answer is in the analyst\'s own file', /No question waits\.$/.test(await txt(p, '#an-via')) && cost.connector.pending === 0 && cost.total.usd === 0 && an.length === 1 && an[0].llm.provider === 'connector' && an[0].llm.costUsd === 0, JSON.stringify(cost.connector));
      for (const theme of ['', 'light', 'midnight']) { await p.evaluate((t) => { if (t) document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(350); const bad = await aa(p); ok(`connector: AA contrast with the box and the answer open, ${theme || 'the default'} theme`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
      await p.evaluate(() => { delete document.documentElement.dataset.theme; });
      ok('connector flow: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
    {
      const { ctx, p, errs } = await open(b, con.base, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); await p.goto(con.base + '/academy', { waitUntil: 'load' }); await run(p, null);
      await p.tap('#c-play'); await nextPoint(p); await p.tap('#an-connector'); await p.waitForSelector('#an-connector-url', { timeout: 10000 }); await p.evaluate(() => document.getElementById('an-block').scrollIntoView());
      const w = await p.evaluate(() => document.documentElement.scrollWidth), small = await p.evaluate(SMALL), taps = await p.evaluate(TAPS);
      ok('connector, 390 px: no sideways scroll, every text 12 px or more, every control 44 px tall', w <= 390 && small.length === 0 && taps.length === 0 && errs.length === 0, [w, small.slice(0, 3).join(' ; '), taps.slice(0, 3).join(' ; '), errs.slice(0, 1).join()].join(' | '));
      await ctx.close();
    }
  } catch (e) { ok('the analyst audit ran to the end', false, e.message.split('\n')[0]); }
  finally { if (b) await b.close().catch(() => {}); stop(off); stop(fake); stop(con); }
  const bad = A.filter((r) => !r.ok);
  for (const r of A) console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok || !r.info ? '' : ' :: ' + r.info));
  console.log(`\nAcademy analyst audit: ${A.length - bad.length} of ${A.length} checks passed` + (bad.length ? `, ${bad.length} FAILED` : '') + ' (a fake provider and a scripted assistant only: no real language-model call is ever made here)');
  return bad.length;
}

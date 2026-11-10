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
// "What if" (alternatives on the candles after a decision): absent until the attempt is stored, then a table of the setup, the
// engine's answer and fixed variants; no later candle ever reaches a snapshot; the later candles leave the chart on Continue.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.ACADEMY_PORT || process.env.PORT || 8770, H = 'http://127.0.0.1:' + PORT;
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
// every visible text element is 12 px or more
const SMALL = String.raw`(() => { const out = [], seen = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const e = n.parentElement; if (!n.textContent.trim() || !e || seen.has(e) || !e.getClientRects().length || e.closest('canvas, .chart, script, style, option')) continue; seen.add(e); const px = parseFloat(getComputedStyle(e).fontSize); if (px < 12) out.push(px + ' ' + e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' "' + n.textContent.trim().slice(0, 20) + '"'); } return out; })()`;
// touch targets: visible buttons, inputs, selects and links that act as buttons are at least 44 px tall
const TAPS = String.raw`(() => [...document.querySelectorAll('main button, main select, main input:not([type=radio]):not([type=checkbox]), main textarea, main a.btn, main .seg label span, main summary')].filter((e) => e.getClientRects().length).map((e) => [Math.round(e.getBoundingClientRect().height), e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' ' + (e.textContent || '').trim().slice(0, 16)]).filter((x) => x[0] < 44).map((x) => x.join(' ')))()`;
const ENDLESS = String.raw`(() => document.getAnimations().filter((a) => { try { return a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running' && a.effect.target && a.effect.target.getClientRects().length; } catch (e) { return false; } }).map((a) => a.animationName || 'animation'))()`;

// The page keeps itself under 24 Academy calls a minute (the site's firewall allows 30). The dev server has no firewall, so
// the audit lifts that pace to finish in minutes; it counts the calls instead, and one check runs with the pace on.
const NO_PACE = 'window.MXAC_PACE = 0;';
async function startServer() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-audit-'));
  const proc = spawn(process.execPath, [path.join(ROOT, 'scripts/academy-dev.mjs')], { env: { ...process.env, PORT: String(PORT), ACADEMY_STORE_DIR: store }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; proc.stdout.on('data', (d) => { log += d; }); proc.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 60; i++) {
    if (proc.exitCode != null) throw new Error('the dev server stopped: ' + log.trim() + ` (is port ${PORT} taken? set ACADEMY_PORT)`);
    try { const r = await fetch(H + '/api/academy?get=edges'); if (r.ok) return { proc, store }; } catch (e) { /* not up yet */ }
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
    if (speed) await p.check(`input[name=speed][value="${speed}"]`, { force: true });
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
    // approve it and go on
    await p.click('#mentor [data-choice="approve"]'); await p.click('#m-save'); await p.waitForFunction(() => /Correction saved/.test(document.getElementById('m-msg').textContent), null, { timeout: 15000 });
    check('an approval is stored and a lesson draft is offered as optional', /optional/.test(await txt(p, '#lesson h2')) && await vis(p, '#prove-run'));
    // what if, on the first setup: the table, nothing near a snapshot, the later candles on the chart only on request
    {
      const before = await p.evaluate(() => { window.__snap = window.MXAC.lastSnapshot; return { n: window.MXAC.checks.snapshots, f: window.MXAC.checks.future }; }), mw = reqs.length, storedFirst = reqs.slice(0, mw).some((r) => r.body && r.body.action === 'attempt' && r.body.attempt.candidateId === c1.id);
      check('what if: after a verdict the hindsight warning is gone', (await p.$$('#whatif-hindsight')).length === 0 && await vis(p, '#whatif-run'));
      await p.click('#whatif-run'); await p.waitForSelector('#whatif-table', { timeout: 30000 });
      const wrows = await p.$$eval('#whatif-table tbody tr', (l) => l.map((r) => [r.dataset.alt, r.dataset.filled, ...[...r.cells].map((c) => c.textContent.trim())]));
      const keys = wrows.map((r) => r[0]), must = ['setup', 'stop-half', 'stop-wide', 'target-1r', 'target-2r', 'target-3r', 'late'];
      check('what if: one row an alternative: the setup, the engine\'s answer when it differs, then the fixed variants', keys[0] === 'setup' && must.every((k) => keys.includes(k)) && keys.length === must.length + (a1 === 'WAIT' ? 1 : 0) && (a1 !== 'WAIT' || (keys[1] === 'engine' && /WAIT/.test(wrows[1][2]) && /^\+?0\.00R$/.test(wrows[1][5]))), keys.join(','));
      check('what if: each row says filled or not, net R after costs, the exit, best and worst in R and the exit time', wrows.every((r) => (r[1] === 'yes' ? /^filled at [\d,.]+$/.test(r[4]) && /^[+-]?\d+\.\d\dR$/.test(r[5]) && /^(stop|target|still open at the last candle read)$/.test(r[6]) && /^\+?\d+\.\d\dR$/.test(r[7]) && /^-?\d+\.\d\dR$/.test(r[8]) && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(r[9]) : /^(not filled|no trade)$/.test(r[4]) && /never filled|no trade|not valid/.test(r[6]))) && wrows.filter((r) => r[1] === 'yes').length >= 4, JSON.stringify(wrows[0]));
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
    check('what if: on Continue the later candles leave the chart and the card goes away', (await p.evaluate(() => window.MXAC.laterShown())) === 0 && !(await vis(p, '#whatif')) && (await p.$$('#whatif-run')).length === 0);

    // ---- 5. the next setup the engine takes: correct it to WAIT ----
    let cur = null, first = null, eventWait = '';
    const perSetup = [];
    for (let i = 1; i < cands.length; i++) { const m5 = reqs.length; await nextPoint(p); perSetup.push(calls(reqs, m5, 'owner').map(what).filter((x) => x !== 'get=outcome')); first = await txt(p, '#dec-action'); const now = await txt(p, '#clock-time'); cur = cands.find((c) => stamp(c.t) === now); if (first !== 'WAIT') break; const d = await txt(p, '#decision'); if (/event risk: /.test(d)) eventWait = d.match(/event risk: [^.]{0,80}/)[0]; await goOn(p); }
    check('a setup hours before a scheduled release waits on event risk and names the release', /Non-Farm Payrolls/.test(eventWait), eventWait);
    check('every later train decision costs ONE Academy call (the attempt): lessons, past cases and calendar were read once for the run', perSetup.length >= 1 && perSetup.every((x) => x.join() === 'attempt'), `calls per setup: ${perSetup.map((x) => x.length).join(',')} (${perSetup[0] && perSetup[0].join('+')})`);
    check('the run read its lists once: one history read with before = the end of the range, none per setup', reqs.filter((r) => r.tag === 'owner' && r.q.get === 'history').length === 1 && reqs.filter((r) => r.tag === 'owner' && r.q.get === 'history')[0].q.before != null && !reqs.some((r) => r.q.get === 'history' && r.q.cand), JSON.stringify(reqs.filter((r) => r.q.get === 'history').map((r) => r.q)));
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
    check('a correction without a reason or a text cannot be saved', await p.isDisabled('#m-save') && /Say why/.test(await txt(p, '#m-err')), await txt(p, '#m-err'));
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
    check('Lessons: recall and new-setup records are shown apart, each with its n', /Recall on the same trade: passed 2, failed 0 \(n = 2\)\./.test(ltxt) && /New setups it matched: n = \d+, same answer as without it on \d+; net [+-]?\d+\.\d\dR with lessons against [+-]?\d+\.\d\dR without\. Too few to judge\./.test(ltxt), ltxt.slice(150, 420));
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
    check('Progress: agreement with the mentor by week, with n and "too few to judge"', /Overall you approved \d+ of \d+ \(too few to judge\) of the decisions you judged \(n = \d+\)\./.test(await txt(p, '#pg-agree-all')) && /\d{4}-W\d\d/.test(await txt(p, '#pg-agree-table')) && /too few to judge \(n = \d+\)/.test(await txt(p, '#pg-agree-table')), await txt(p, '#pg-agree-all'));
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
    check('Models: each scorer with its walk-forward numbers and verdict; the exam block apart; the skipped edges', mrows.length === 5 && mrows.every((r) => /rejected challenger/.test(r) && /not promoted/.test(r)) && /^replica325/.test(mrows[0]) && /None of the 5 scorers beat taking every setup/.test(await txt(p, '#md-verdict')) && (await p.$$('#md-exam-table tbody tr')).length === 5 && (await p.$$('#md-skipped li')).length === 3 && /150 are needed to fit/.test(await txt(p, '#md-skipped')), mrows[0]);
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
    check('Blind arena: an answer without a reason cannot be stored', await p.isDisabled('#bl-save') && /Say why in a line/.test(await txt(p, '#bl-err')));
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
    await p.fill('#bl-stop', String(c2.side === 'buy' ? c2.entry + 1 : c2.entry - 1)); check('Blind arena: a stop on the wrong side is refused', await p.isDisabled('#bl-save') && /The stop must be/.test(await txt(p, '#bl-err')), await txt(p, '#bl-err'));
    await p.fill('#bl-stop', String(c2.stop)); await p.fill('#bl-text', 'Audit: I take the setup.'); await p.click('#bl-save'); await p.waitForSelector('#bl-compare', { timeout: 20000 });
    const brows = (await api(p, `get=blind&edge=${EDGE}`)).blind;
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
    check('Session: the note starts at the last closed price and needs a stop and a reason', mEntry > 1000 && await p.isDisabled('#ss-m-save') && /every trade has a stop/.test(await txt(p, '#ss-m-err')), `${mEntry} ${await txt(p, '#ss-m-err')}`);
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
    check('Session: the clock stops on the first setup of the day and its decision is stored at once, with the session id (one call)', (await txt(p, '#ss-time')) === stamp(d1.t) && sAtt.join() === 'attempt' && sLast.sessionId === ssId && ['train', 'replay-same'].includes(sLast.mode) && (await txt(p, '#ss-dec-action')) === sLast.decision.action && /Attempt \d+ stored ✓/.test(await txt(p, '#ss-dec-stored')), `${await txt(p, '#ss-time')} ${sAtt.join()} ${sLast.mode}`);
    check('Session: the note buttons are off while the clock is on a setup', await p.isDisabled('#ss-missed') && await p.isDisabled('#ss-right'));
    await p.click('#ss-point [data-choice="approve"]'); await p.click('#ss-v-save'); await p.waitForFunction(() => /Verdict stored ✓/.test(document.getElementById('ss-v-msg').textContent), null, { timeout: 15000 });
    check('Session: an approval is stored and counted, with its n', (await txt(p, '#ss-n-agree')).startsWith('1 of 1 (too few to judge)') && (await txt(p, '#ss-n-dec')).startsWith('1'), await txt(p, '#ss-n-agree'));
    if (dayCands.length > 1) {
      await p.click('#ss-continue'); await p.waitForFunction((t) => document.getElementById('ss-time').textContent === t && document.getElementById('ss-state').textContent === 'paused on a setup', stamp(dayCands[1].t), { timeout: 60000 });
      const other = await p.$eval('#ss-point [data-choice]:not([data-choice="approve"])', (b) => b.dataset.choice); await p.click(`#ss-point [data-choice="${other}"]`);
      check('Session: a disagreeing verdict needs a reason', await p.isDisabled('#ss-v-save') && /Say why in a line/.test(await txt(p, '#ss-v-err')), await txt(p, '#ss-v-err'));
      await p.fill('#ss-v-text', 'Audit: I read this one differently.'); await p.click('#ss-v-save'); await p.waitForSelector('#ss-lesson-plain', { timeout: 15000 });
      check('Session: the disagreement is stored as a correction and a lesson draft is offered', (await txt(p, '#ss-n-agree')).startsWith('1 of 2 (too few to judge)') && /^When: .+ → Then: /.test(await txt(p, '#ss-lesson-plain')) && (await api(p, `get=corrections&edge=${EDGE}&cand=${encodeURIComponent(dayCands[1].id)}`)).corrections.some((c) => c.verdict === 'change' && c.action === other), await txt(p, '#ss-lesson-plain'));
    }
    await p.click('#ss-save'); await p.waitForFunction(() => /Session saved at/.test(document.getElementById('ss-run-msg').textContent), null, { timeout: 15000 });
    let sessS = (await api(p, 'get=sessions')).sessions.filter((s) => s.kind === 'session');
    check('Session: saved through the session route, with its summary', sessS.length === 1 && sessS[0].id === ssId && sessS[0].status === 'paused' && /missed opportunity/.test(sessS[0].summary) && (await p.$$('#ss-saved li[data-session]')).length === 1, JSON.stringify(sessS.map((s) => [s.status, s.summary])));
    const nDec = (await txt(p, '#ss-summary-text')).match(/^(\d+) decision/)[1];
    await p.click('#ss-saved li[data-session] button'); await p.waitForFunction(() => /Session resumed at/.test(document.getElementById('ss-run-msg').textContent), null, { timeout: 60000 });
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
      for (const theme of ['dark', 'light', 'midnight']) { await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(350); const bad = await p.evaluate(CONTRAST); check(`AA contrast, ${theme} theme (${id})`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
      await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    }
    check('no endless animation in the other sections', (await p.evaluate(ENDLESS)).length === 0);
    await p.click('#tab-train');

    // ---- 12. themes: AA contrast in dark, light and midnight, on the setup and on a decision ----
    for (const theme of ['dark', 'light', 'midnight']) {
      await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(450);   // colour transitions are 150 ms
      const bad = await p.evaluate(CONTRAST); check(`AA contrast, ${theme} theme (replay view)`, bad.length === 0, bad.slice(0, 4).join(' ; '));
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
      for (const theme of ['light', 'midnight']) { await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(120); const bad = await p.evaluate(CONTRAST); check(`AA contrast, ${theme} theme (setup)`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
      await p.evaluate(() => { delete document.documentElement.dataset.theme; });
      await p.tap('#start'); await p.waitForSelector('#replay:not([hidden])', { timeout: 60000 }); await p.tap('#c-play'); await nextPoint(p);
      await p.tap('#mentor [data-choice="WAIT"]').catch(() => {}); await p.waitForTimeout(200);
      w = await p.evaluate(() => document.documentElement.scrollWidth); check('390 px: no sideways scroll on a decision with the mentor controls open', w <= 390, w);
      small = await p.evaluate(SMALL); check('390 px: every text is 12 px or more (decision)', small.length === 0, small.slice(0, 4).join(' ; '));
      taps = await p.evaluate(TAPS); check('390 px, touch: every control is at least 44 px tall (decision)', taps.length === 0, taps.slice(0, 5).join(' ; '));
      await p.tap('#whatif-run'); await p.waitForSelector('#whatif-table', { timeout: 30000 }); await p.evaluate(() => document.getElementById('whatif').scrollIntoView());
      w = await p.evaluate(() => document.documentElement.scrollWidth); check('390 px: no sideways scroll with the "What if" table open', w <= 390, w);
      small = await p.evaluate(SMALL); check('390 px: every text is 12 px or more (what if)', small.length === 0, small.slice(0, 4).join(' ; '));
      taps = await p.evaluate(TAPS); check('390 px, touch: every control is at least 44 px tall (what if)', taps.length === 0, taps.slice(0, 5).join(' ; '));
      for (const theme of ['light', 'midnight']) { await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(120); const bad = await p.evaluate(CONTRAST); check(`AA contrast on the phone, ${theme} theme (what if)`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
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
        if (id === 'lessons' || id === 'progress') for (const theme of ['light', 'midnight']) { await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(120); const bad = await p.evaluate(CONTRAST); check(`AA contrast on the phone, ${theme} theme (${id})`, bad.length === 0, bad.slice(0, 4).join(' ; ')); }
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

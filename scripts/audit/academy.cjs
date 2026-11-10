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
const api = (p, q) => p.evaluate(async (qs) => (await fetch('/api/academy?' + qs, { cache: 'no-store' })).json(), q);

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
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' }); let p = await ctx.newPage(); watch(p, 'owner');
    await p.goto(H + '/academy', { waitUntil: 'load' }); await setup(p, null, null);
    check('title and heading are "MeridianX Academy"', (await p.title()) === 'MeridianX Academy' && (await txt(p, 'h1')) === 'MeridianX Academy', await p.title());
    const tabs = await p.$$eval('#ac-tabs [role=tab]', (l) => l.map((x) => x.textContent.trim()));
    check('nine sections as tabs, Train first', tabs.length === 9 && /^Train$/.test(tabs[0]) && ['Session', 'Blind arena', 'Progress', 'Lessons', 'Research', 'Models', 'Costs', 'Audit'].every((t, i) => tabs[i + 1].startsWith(t)), tabs.join(' | '));
    await p.click('#tab-progress'); check('a section that is not built says so and shows nothing else', /Coming in the next build step/.test(await txt(p, '#ac-progress')) && !(await vis(p, '#setup')), await txt(p, '#ac-progress'));
    await p.evaluate(() => window.MXAC.registerTab('progress', { title: 'Progress', render: (sec, ctx) => { sec.textContent = 'registered:' + typeof ctx.api.get + ':' + ctx.edge(); } }));
    check('MXAC.registerTab fills a section without touching the page code', (await txt(p, '#ac-progress')) === 'registered:function:' + EDGE && !/next step/.test(await txt(p, '#tab-progress')), await txt(p, '#ac-progress'));
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
    await p.click('#c-play'); await nextPoint(p);
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
    await p.screenshot({ path: OUT + 'academy-1-decision.png', fullPage: true });
    // approve it and go on
    await p.click('#mentor [data-choice="approve"]'); await p.click('#m-save'); await p.waitForFunction(() => /Correction saved/.test(document.getElementById('m-msg').textContent), null, { timeout: 15000 });
    check('an approval is stored and a lesson draft is offered as optional', /optional/.test(await txt(p, '#lesson h2')) && await vis(p, '#prove-run'));
    await goOn(p);

    // ---- 5. the next setup the engine takes: correct it to WAIT ----
    let cur = null, first = null, eventWait = '';
    for (let i = 1; i < cands.length; i++) { await nextPoint(p); first = await txt(p, '#dec-action'); const now = await txt(p, '#clock-time'); cur = cands.find((c) => stamp(c.t) === now); if (first !== 'WAIT') break; const d = await txt(p, '#decision'); if (/event risk: /.test(d)) eventWait = d.match(/event risk: [^.]{0,80}/)[0]; await goOn(p); }
    check('a setup hours before a scheduled release waits on event risk and names the release', /Non-Farm Payrolls/.test(eventWait), eventWait);
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
    check('no outcome is read before its attempt is stored', lastResult >= 0 && firstRead > lastResult && !after.some((r) => r.q.get === 'outcome') && after.filter((r) => r.body && r.body.action === 'attempt').every((r) => r.body.attempt.mode === 'exam'), `last result #${lastResult}, first read #${firstRead}`);
    const sum = await txt(p, '#exam-summary'), changed = ex.filter((e) => e.withLessons.action !== e.withoutLessons.action).length, matched = ex.filter((e) => e.lessonIds.length).length;
    check('the new-setup panel shows matched, changed and net R with / without, with n', await vis(p, '#exam-out') && (await txt(p, '#exam-n')).startsWith(String(want)) && (await txt(p, '#exam-matched')).startsWith(`${matched} of ${want}`) && (await txt(p, '#exam-changed')).startsWith(`${changed} of ${want}`) && /R/.test(await txt(p, '#exam-with')) && /n = \d+ graded/.test(sum), sum);
    check('under 20 graded setups it says "too few to judge"', /Too few to judge/.test(await txt(p, '#exam-note')) && /separate from same-trade replays/.test(await txt(p, '#exam-note')), await txt(p, '#exam-note'));
    check('a table lists the tested setups', (await p.$$('#exam-table tbody tr')).length === want);
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

    // ---- 12. themes: AA contrast in dark, light and midnight, on the setup and on a decision ----
    for (const theme of ['dark', 'light', 'midnight']) {
      await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await p.waitForTimeout(450);   // colour transitions are 150 ms
      const bad = await p.evaluate(CONTRAST); check(`AA contrast, ${theme} theme (replay view)`, bad.length === 0, bad.slice(0, 4).join(' ; '));
    }
    await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await ctx.close();

    // ---- 13. phone, 390 px: panels stack with the chart first, no sideways scroll, text 12 px or more, 44 px targets ----
    {
      const ph = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' }); p = await ph.newPage(); watch(p, 'phone');
      await p.goto(H + '/academy', { waitUntil: 'load' }); await setup(p, iso(cands[0].t), '100');
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
      const order = await p.evaluate(() => ['chart', 'acct-card', 'decision', 'mentor'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().top + scrollY)));
      check('390 px: the panels stack and the chart stays first', order[0] < order[1] && order[1] < order[2] && order[2] < order[3], order.join(' < '));
      check('reduced motion is respected (no transition left running)', await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.btn')).transitionDuration) <= 0.001));
      check('a second sitting on the same setup stores the next attempt number', (await api(p, `get=attempts&edge=${EDGE}&cand=${encodeURIComponent(c1.id)}`)).attempts.map((a) => a.n).join(',') === '1,2');
      await p.screenshot({ path: OUT + 'academy-5-phone.png', fullPage: true });
      await ph.close();
    }
    check('no page errors and no console errors anywhere', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) { check('the audit ran to the end', false, e.message.split('\n')[0]); }
  finally { await b.close().catch(() => {}); srv.proc.kill(); fs.rmSync(srv.store, { recursive: true, force: true }); }
  const bad = R.filter((r) => !r.ok);
  for (const r of R) console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok || !r.info ? '' : ' :: ' + r.info));
  console.log(`\nAcademy audit: ${R.length - bad.length} of ${R.length} checks passed` + (bad.length ? `, ${bad.length} FAILED` : ''));
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error('audit crashed:', e); process.exit(1); });

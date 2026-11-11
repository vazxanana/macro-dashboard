// Run: sh scripts/build.sh && (cd out && python3 -m http.server 8766 &) ; node --use-env-proxy scripts/audit/chronostrade.cjs
// Needs Playwright and network to meridianx.dev (candles come through the live /md/bars proxy). Not part of node --test.
// ChronosTrade end-to-end audit: every feature against real OANDA candles (through the live /md/bars proxy).
const { chromium } = require('playwright');
const { measured, settle, fetchRetry } = require('./shared.cjs');
const fs = require('fs');
const PORT = process.env.PORT || 8766, H = 'http://127.0.0.1:' + PORT;
const OUT = process.env.AUDIT_OUT || require('os').tmpdir() + '/';
const CONTRAST = String.raw`(() => { const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const a = m[3] == null ? 1 : m[3]; return [m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }), a]; }; const bgOf = (e) => { for (let x = e; x; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; if (b && /^rgb/.test(b) && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/,\s*0\.\d+\)$/.test(b)) return b; } return getComputedStyle(document.body).backgroundColor; }; const ratio = (f, b) => { const [F] = lum(f), [Bk] = lum(b), L = (x) => 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2], a = L(F), z = L(Bk); return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05); }; const out = []; let n = 0; for (const e of document.querySelectorAll('#tab-stats svg text, #tab-stats .bv-leg span, #kpis small, #kpis span, #kpis b, .kh2, #jf button, #tab-journal td small, #pf .pf-row, #pf .pfg span, #pf .pfg em, #pf .pf-state span')) { if (!e.getClientRects().length || !e.textContent.trim()) continue; const cs = getComputedStyle(e), fg = e instanceof SVGElement ? cs.fill : cs.color; if (!/rgb/.test(fg)) continue; n++; const r = ratio(fg, bgOf(e.closest('div,td,section,p,span') || e)); if (r < 4.5) out.push(e.textContent.trim().slice(0, 16) + ' ' + r.toFixed(2)); } return { bad: out, n }; })()`;
// onboarding pass: the first-run card, empty states and the welcome line; background from the element itself upward (so filled buttons count)
const CONTRAST_ONB = String.raw`(() => { const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); return m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); }; const bgOf = (e) => { for (let x = e; x; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; if (b && /^rgb/.test(b) && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/,\s*0\.\d+\)$/.test(b)) return b; } return getComputedStyle(document.body).backgroundColor; }; const L = (x) => 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]; const out = []; let n = 0; for (const e of document.querySelectorAll('#guide h3, #guide p, #guide .gd-k, #guide label, #guide .btn, #guide .gd-skip, #guide .gd-res b, .empty.ea b, .empty.ea span, .empty.ea .btn, .pf-empty p, .pf-empty .hint, .welcome p')) { if (!e.getClientRects().length || !e.textContent.trim() || e.disabled) continue; n++; const a = L(lum(getComputedStyle(e).color)), z = L(lum(bgOf(e))), r = (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05); if (r < 4.5) out.push(e.textContent.trim().slice(0, 18) + ' ' + r.toFixed(2)); } return { bad: out, n }; })()`;
// Colours are read through `measured` (shared.cjs): it waits for the page's own transitions to end instead of a fixed time after a
// colour-scheme change, reads once, and a reading that measured no element at all is a fault (it used to pass)
const aaBoth = async (pg) => { const out = []; for (const cs of ['dark', 'light']) { await pg.emulateMedia({ colorScheme: cs }); out.push(...(await measured(pg, CONTRAST_ONB, 'first-run or empty-state text')).map((x) => cs + ': ' + x)); } await pg.emulateMedia({ colorScheme: null }); return out; };
const aaStats = (pg) => measured(pg, CONTRAST, 'analytics or journal text');
const R = []; const check = (name, ok, info = '') => { R.push({ name, ok: !!ok, info: String(info).slice(0, 140) }); };
const route = async (p) => (await p.route(/\/api\/sounds/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"sl":null,"tp":null}' })), await p.route(/\/api\/mosha-lessons/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"lessons":[],"book":[],"canTeach":true,"who":"owner"}' })), p.route(new RegExp('127\\.0\\.0\\.1:' + PORT + '/md/bars'), async (r) => { const x = await fetchRetry(r.request().url().replace(H, 'https://meridianx.dev')); if (x.status !== 200) NET.push(x.status + (x.error ? ' ' + x.error : '')); r.fulfill({ status: x.status === 503 && x.error ? 502 : x.status, contentType: 'application/json', body: x.body }); }));
const NET = [];   // candle requests that failed after three tries: named at the end, so a network failure is not read as a page fault
// sign-in (9 Nov): the page asks /api/me (the session cookie lives on the server); the audit stubs the answer
const me = (p, account) => p.route(/\/api\/me(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account }) }));
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' };
const barN = async (p) => +((await p.$eval('#now', (e) => e.textContent)).match(/bar (\d+)/) || [0, 0])[1];
const txt = (p, sel) => p.$eval(sel, (e) => e.textContent).catch(() => '');
const vis = (p, sel) => p.$eval(sel, (e) => !!(e.offsetParent || getComputedStyle(e).position === 'fixed') && !e.hidden).catch(() => false);
async function load(p, q = 'xau,15m') { await p.click(`#quick [data-q^="${q}"]`); await p.waitForFunction(() => /candles loaded|Could not/.test(document.querySelector('#toasts').textContent + document.getElementById('loadmsg').textContent), null, { timeout: 120000 }); await p.waitForTimeout(400); }
(async () => {
  const b = await chromium.launch();
  // 1. gate
  { const p = await b.newPage(); await me(p, null); await p.goto(H + '/backtest.html'); check('gate shown when signed out', await vis(p, '#gate') && !(await vis(p, '#app'))); await p.close(); }
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await route(p); await me(p, OWNER); await p.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.clear(); sessionStorage.setItem('init', '1'); } });
  await p.goto(H + '/backtest.html', { waitUntil: 'load' }); await p.waitForTimeout(300);
  check('welcome on first visit', await vis(p, '#welcome'));
  // 1b. first-run flow (onboarding pass): a card that does not block the page, four steps (market and day, play, buy / sell, result),
  // focus inside, Back, Esc closes and is remembered for this member, it does not come back after a reload, Help reopens it, Skip closes it
  await p.waitForSelector('#guide[open]', { timeout: 3000 }).catch(() => {}); check('guide opens on the first visit', await p.$eval('#guide', (e) => e.open));
  check('the first-run card does not block the page (not modal)', await p.$eval('#guide', (e) => !e.matches(':modal')));
  check('guide has focus inside', await p.evaluate(() => document.getElementById('guide').contains(document.activeElement)));
  const gsteps = []; for (let i = 0; i < 4; i++) { gsteps.push(await txt(p, '#gd-title')); if (i < 3) await p.click('#gd-next'); }
  check('guide walks four steps (market and day, play, buy / sell, result)', gsteps.length === 4 && /market/i.test(gsteps[0]) && /play/i.test(gsteps[1]) && /buy|sell/i.test(gsteps[2]) && /result/i.test(gsteps[3]) && (await txt(p, '#gd-next')) === 'Done', gsteps.join(' / '));
  await p.click('#gd-back'); check('guide Back goes one step back', /buy|sell/i.test(await txt(p, '#gd-title')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100); check('Esc closes the guide and it is remembered for this member', !(await p.$eval('#guide', (e) => e.open)) && (await p.evaluate(() => localStorage.getItem('btLab:onb:owner'))) === 'done');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200); check('the first-run card does not come back after a reload', !(await p.$eval('#guide', (e) => e.open)) && !(await p.$('dialog[open]')));
  await p.click('#hk-btn'); await p.click('#gd-open'); check('guide reopens from Help', await p.$eval('#guide', (e) => e.open) && /market/i.test(await txt(p, '#gd-title')) && !(await p.$eval('#hk', (e) => e.open)));
  await p.click('#gd-skip'); check('Skip closes the guide', !(await p.$eval('#guide', (e) => e.open)));
  await p.click('#hk-btn'); await p.click('#how-open'); await p.waitForTimeout(150); { const hw = await txt(p, '#how');
    check('Help → How it works opens a plain-English summary of the current UI (instant orders, Shift+B/S, re-anchoring, J, toolbar groups)', await p.$eval('#how', (e) => e.open) && /opens the trade at the price now/.test(hw) && /Shift/.test(hw) && /never refused/.test(hw) && /J/.test(hw) && /Chart tools/.test(hw) && /View/.test(hw), hw.slice(0, 120)); await p.$eval('#how', (e) => { e.open = false; }); }
  // 2. load
  await load(p); check('quick start loads candles', /candles loaded/.test(await txt(p, '#toasts')), await txt(p, '#sess-sum'));
  check('session card folds to a summary', await p.$eval('#sess-body', (e) => e.hidden));
  const b0 = await barN(p); check('starts at the chosen moment', b0 > 10, b0);
  // 3. keyboard step / undo
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); const b2 = await barN(p); await p.keyboard.press('ArrowLeft'); check('→ steps and ← undoes', b2 === b0 + 2 && (await barN(p)) === b0 + 1, `${b0} ${b2} ${await barN(p)}`);
  // 4. market draft, presets, confirm
  await p.keyboard.press('Shift+B'); check('Shift+B opens a buy draft (set up first)', await vis(p, '#draft') && /buy/i.test(await txt(p, '#dr-title')));
  await p.click('[data-sl="atr1.5"]'); await p.click('[data-tp="2"]');
  const dr = await p.evaluate(() => ({ e: +document.getElementById('o-price').value, s: +document.getElementById('o-stop').value, t: +document.getElementById('o-target').value }));
  check('presets place stop below and 2R target above', dr.s < dr.e && Math.abs((dr.t - dr.e) - 2 * (dr.e - dr.s)) < 0.05, JSON.stringify(dr));
  check('risk shown as 1%', /\(1\.00%\)/.test(await txt(p, '#calc')), await txt(p, '#calc'));
  await p.keyboard.press('Enter'); await p.waitForTimeout(150); check('Enter confirms; position card appears', (await p.$$('.pos-card')).length === 1 && !(await vis(p, '#draft')));
  // 5. position actions
  await p.click('#open [data-act=be]'); await p.waitForTimeout(100); const st = await p.$eval('.pos-l input[data-f=stop]', (e) => +e.value); check('break-even moves the stop to entry', Math.abs(st - dr.e) < 0.02, `${st} vs ${dr.e}`);
  await p.click('#open [data-act=half]'); await p.waitForTimeout(100); check('close half books a journal row', (await p.$$('#jbody tr[data-id]')).length === 1 && /50% out/.test(await txt(p, '.pos-card')));
  await p.click('#open [data-act=trail]'); await p.waitForTimeout(100); check('trail toggles on', await p.$eval('#open [data-act=trail]', (e) => e.classList.contains('on')));
  await p.click('#open [data-act=close]'); await p.waitForTimeout(150); check('close removes the position; the journal merges both parts into one trade row', (await p.$$('.pos-card')).length === 0 && (await p.$$('#jbody tr[data-id]')).length === 1 && /2 parts/.test(await txt(p, '#jbody tr[data-id]')), await txt(p, '#jbody tr[data-id]'));
  check('snapshot stored for closed trades', (await p.$$('#jbody img.shot')).length === 1 && (await p.evaluate(() => { const id = Object.keys(JSON.parse(localStorage.getItem('btLab:sessions')))[0]; return Object.keys(JSON.parse(localStorage.getItem('btLab:shots:' + id) || '{}')).length; })) === 2);
  // 6. limit and stop orders, cancel
  await p.keyboard.press('Shift+S'); const lp = await p.$eval('#o-price', (e) => +e.value); await p.fill('#o-price', String((lp + 3).toFixed(2))); await p.waitForTimeout(80);
  check('sell above price becomes a limit', /limit/.test(await txt(p, '#dr-type')), await txt(p, '#dr-type'));
  await p.fill('#o-stop', String((lp + 12).toFixed(2))); await p.fill('#o-target', String((lp - 15).toFixed(2))); await p.waitForTimeout(80); await p.click('#place'); await p.waitForTimeout(120);
  check('limit order rests as pending', /waiting/.test(await txt(p, '#open')), (await txt(p, '#o-err')) || 'ok');
  await p.click('#open [data-act=cancel]'); check('cancel removes the pending order', !(/waiting/.test(await txt(p, '#open'))));
  await p.keyboard.press('Shift+B'); const sp = await p.$eval('#o-price', (e) => +e.value); await p.fill('#o-price', String((sp + 2).toFixed(2))); await p.fill('#o-stop', String((sp - 6).toFixed(2))); await p.waitForTimeout(80);
  check('buy above price becomes a stop order', /stop order/.test(await txt(p, '#dr-type')), await txt(p, '#dr-type')); await p.keyboard.press('Escape'); check('Esc cancels the draft', !(await vis(p, '#draft')));
  // 7. never refused because the price moved (owner, 9 Nov): a wrong-side stop is mirrored and the trade fills at the price now
  await p.keyboard.press('Shift+B'); const wp = await p.$eval('#o-price', (e) => +e.value); await p.fill('#o-stop', String((wp + 5).toFixed(2))); await p.waitForTimeout(80); check('wrong-side stop flagged in the calc', /wrong side/.test(await txt(p, '#calc'))); await p.click('#place'); await p.waitForTimeout(120);
  { const pc = await p.$$eval('#open .pos-card', (c) => c.length); const st = await p.$eval('#open .pos-l input[data-f=stop]', (e) => +e.value).catch(() => NaN);
    check('wrong-side stop re-anchored on confirm and the buy filled (not refused)', pc === 1 && st < wp && Math.abs((wp - st) - 5) < 0.05 && !(await txt(p, '#o-err')) && /Filled at|kept/.test(await txt(p, '#toasts')), `${pc} stop ${st} entry ${wp} ${await txt(p, "#o-err")} | ${(await txt(p, "#open")).slice(0, 120)} | ${await txt(p, "#toasts")}`);
    await p.click('#open [data-act=close]'); await p.waitForTimeout(120); }
  // 7b. instant market orders: one click / one key, stop on the right side, default target, a toast with the levels
  { await p.click('#qt-buy'); await p.waitForTimeout(120); const ib = await p.evaluate(() => { const c = document.querySelector('#open .pos-card'); return c ? { side: c.querySelector('.badge').textContent, stop: +c.querySelector('input[data-f=stop]').value, tgt: +c.querySelector('input[data-f=target]').value, entry: +c.querySelector('.pos-l b').textContent.replace(/,/g, '') } : null; });
    check('one click on Buy opens a position at once with the stop below and the target above', ib && /buy/.test(ib.side) && ib.stop < ib.entry && ib.tgt > ib.entry && !(await vis(p, '#draft')) && /Bought at/.test(await txt(p, '#toasts')) && (await p.$$('#ptags .ptag')).length === 1, JSON.stringify(ib));
    await p.click('#open [data-act=close]'); await p.waitForTimeout(120);
    await p.keyboard.press('s'); await p.waitForTimeout(120); const is = await p.evaluate(() => { const c = document.querySelector('#open .pos-card'); return c ? { side: c.querySelector('.badge').textContent, stop: +c.querySelector('input[data-f=stop]').value, entry: +c.querySelector('.pos-l b').textContent.replace(/,/g, '') } : null; });
    check('S key sells at once with the stop above the entry', is && /sell/.test(is.side) && is.stop > is.entry && /Sold at .*risk \$/.test(await txt(p, '#toasts')), JSON.stringify(is));
    await p.click('#open [data-act=close]'); await p.waitForTimeout(120); }
  // 7c. flipping the side mirrors the stop and target around the entry
  { await p.keyboard.press('Shift+B'); const a = await p.evaluate(() => ({ e: +document.getElementById('o-price').value, s: +document.getElementById('o-stop').value, t: +document.getElementById('o-target').value }));
    await p.click('#dr-flip'); await p.waitForTimeout(80); const b = await p.evaluate(() => ({ side: document.getElementById('dr-title').textContent, e: +document.getElementById('o-price').value, s: +document.getElementById('o-stop').value, t: +document.getElementById('o-target').value }));
    check('flip to sell mirrors the stop and target around the entry', /sell/i.test(b.side) && Math.abs((b.s - b.e) - (a.e - a.s)) < 0.02 && Math.abs((b.e - b.t) - (a.t - a.e)) < 0.02, JSON.stringify([a, b]));
    await p.keyboard.press('Shift+B'); check('asking for the other side flips the open draft back', /buy/i.test(await txt(p, '#dr-title')) && Math.abs(await p.$eval('#o-stop', (e) => +e.value) - a.s) < 0.02); await p.keyboard.press('Escape'); }
  // 7d. a limit the price has already passed fills at market, same stop distance and R:R
  { await p.keyboard.press('Shift+B'); const q0 = await p.$eval('#o-price', (e) => +e.value), le = +(q0 - 0.3).toFixed(2); await p.fill('#o-price', String(le)); await p.fill('#o-stop', String((le - 4).toFixed(2))); await p.fill('#o-target', String((le + 8).toFixed(2))); await p.waitForTimeout(60);
    const t0 = await txt(p, '#dr-type'); const last = async () => +((await txt(p, '#px-now')).match(/[\d.]+/) || [0])[0]; let q1 = await last();
    await p.evaluate(() => document.activeElement && document.activeElement.blur()); for (let k = 0; k < 120 && q1 >= le - 0.01; k++) { await p.keyboard.press('ArrowRight'); q1 = await last(); }
    await p.click('#place'); await p.waitForTimeout(120);
    const f = await p.evaluate(() => { const c = document.querySelector('#open .pos-card'); return c && !/waiting/.test(c.textContent) ? { stop: +c.querySelector('input[data-f=stop]').value, tgt: +c.querySelector('input[data-f=target]').value, entry: +c.querySelector('.pos-l b').textContent.replace(/,/g, '') } : null; });
    check('a buy limit the price already passed fills at market, same stop distance and R:R', /limit/.test(t0) && q1 < le && f && Math.abs(f.entry - q1) < 0.02 && Math.abs((f.entry - f.stop) - 4) < 0.03 && Math.abs((f.tgt - f.entry) - 8) < 0.03 && /passed your limit/.test(await txt(p, '#toasts')) && !(await txt(p, '#o-err')), `${t0} ${le} -> ${q1} ${JSON.stringify(f)} ${await txt(p, '#o-err')}`);
    if (await p.$('#open [data-act=close]')) await p.click('#open [data-act=close]'); if (await p.$('#open [data-act=cancel]')) await p.click('#open [data-act=cancel]'); await p.waitForTimeout(100); }
  // 8. play / pause / speed / skip day / jump
  await p.click('.speed [data-sp="80"]'); const bp = await barN(p); await p.click('#play'); await p.waitForTimeout(1500); await p.click('#play'); const ba = await barN(p); check('play advances bars and pauses', ba > bp + 5 && !(await p.$eval('#play', (e) => e.classList.contains('playing'))), `${bp}→${ba}`);
  const day0 = (await txt(p, '#now')).slice(0, 10); await p.click('#skipday'); check('skip day lands on the next trading day', (await txt(p, '#now')).slice(0, 10) !== day0, day0 + ' -> ' + await txt(p, '#now'));
  // 8b. on-chart trade UI (pass 9): draft readout with R presets and keys, Shift+drag placement, live position tags
  { await p.keyboard.press('Shift+B'); await p.waitForTimeout(120); check('draft readout shows on the chart with risk in $ and %', await vis(p, '#dchip') && /Risk/.test(await txt(p, '#dchip')) && /\d\.\d\d%/.test(await txt(p, '#dchip')), await txt(p, '#dchip'));
    await p.keyboard.press('3'); await p.waitForTimeout(80); const d3 = await p.evaluate(() => ({ e: +document.getElementById('o-price').value, s: +document.getElementById('o-stop').value, t: +document.getElementById('o-target').value }));
    check('key 3 sets the target at 3R', Math.abs((d3.t - d3.e) - 3 * (d3.e - d3.s)) < 0.05 && /1:3\.00/.test(await txt(p, '#dchip')), JSON.stringify(d3));
    await p.click('#dchip [data-dr="1"]'); await p.waitForTimeout(80); check('1R button on the chart readout', /1:1\.00/.test(await txt(p, '#dchip')), await txt(p, '#dchip'));
    await p.click('#dchip [data-dx]'); await p.waitForTimeout(80); check('✕ on the readout cancels the draft', !(await vis(p, '#dchip')) && !(await vis(p, '#draft')));
    const cb = await p.$eval('#chart', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await p.keyboard.down('Shift'); await p.mouse.move(cb.x + cb.w * 0.45, cb.y + cb.h * 0.35); await p.mouse.down(); await p.mouse.move(cb.x + cb.w * 0.45, cb.y + cb.h * 0.55, { steps: 6 }); await p.waitForTimeout(80);
    check('Shift+drag shows the live risk while dragging', await vis(p, '#dchip') && /Risk/.test(await txt(p, '#dchip')), await txt(p, '#dchip'));
    await p.mouse.up(); await p.keyboard.up('Shift'); await p.waitForTimeout(120);
    const sd = await p.evaluate(() => ({ side: document.getElementById('dr-title').textContent, e: +document.getElementById('o-price').value, s: +document.getElementById('o-stop').value, t: +document.getElementById('o-target').value }));
    check('Shift+drag down places a buy with the stop below and a 2R target', /buy/i.test(sd.side) && sd.s < sd.e && Math.abs((sd.t - sd.e) - 2 * (sd.e - sd.s)) < 0.05, JSON.stringify(sd));
    await p.screenshot({ path: OUT + 'ct-drag-draft.png' }); await p.click('#dchip [data-dx]');
    await p.click('#qt-drag'); check('drag button arms placement', (await p.getAttribute('#qt-drag', 'aria-pressed')) === 'true');
    await p.mouse.move(cb.x + cb.w * 0.45, cb.y + cb.h * 0.6); await p.mouse.down(); await p.mouse.move(cb.x + cb.w * 0.45, cb.y + cb.h * 0.45, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(120);
    check('drag up places a sell draft and disarms', /sell/i.test(await txt(p, '#dr-title')) && (await p.getAttribute('#qt-drag', 'aria-pressed')) === 'false', await txt(p, '#dr-title')); await p.keyboard.press('Escape');
    await p.keyboard.press('Shift+B'); await p.click('#dchip [data-dgo]'); await p.waitForTimeout(150);
    check('Confirm on the chart opens the trade; its tag shows P&L, R and the stop', (await p.$$('#ptags .ptag')).length === 1 && /R/.test(await txt(p, '#ptags .pv')) && /SL \d/.test(await txt(p, '#ptags .sl')), await txt(p, '#ptags'));
    // chart design pass (9 Nov): live P&L pill at the price, grip handles, two-row legend, symbol watermark, tabular scales
    await p.waitForTimeout(250); const pill = await p.$eval('#pnlpill', (e) => ({ vis: !e.hidden && e.offsetParent != null, t: e.textContent, fs: parseFloat(getComputedStyle(e).fontSize) }));
    check('live P&L pill rides at the price with an icon, a sign and R (12 px+)', pill.vis && /[▲▼]/.test(pill.t) && /[+−]\$/.test(pill.t) && /\dR/.test(pill.t) && pill.fs >= 12, JSON.stringify(pill));
    const look = await p.evaluate(() => window.ctChart()); check('draggable stop / target lines carry grip handles', look.handles >= 2, JSON.stringify(look));
    check('watermark names the symbol and timeframe; scales use tabular mono figures', /XAU\/USD · 15m/.test(look.wm) && /JetBrains Mono/.test(look.font), look.wm + ' | ' + look.font);
    const lg = await p.$eval('#legend', (e) => ({ rows: e.children.length, t: e.textContent, fs: Math.min(...[...e.querySelectorAll('*')].map((x) => parseFloat(getComputedStyle(x).fontSize))) }));
    check('legend: symbol, timeframe and time in UTC, then O H L C and change % (12 px+)', lg.rows === 2 && /XAU\/USD/.test(lg.t) && /UTC/.test(lg.t) && /O \d.*H \d.*L \d.*C \d/.test(lg.t) && /%\)/.test(lg.t) && lg.fs >= 12, JSON.stringify(lg));
    await p.click('.speed [data-sp="1000"]'); await p.click('#play'); const s1 = []; for (let k = 0; k < 6; k++) { await p.waitForTimeout(140); s1.push(await txt(p, '#ptags .pv')); } await p.click('#play');
    check('position tag P&L moves with the forming candle', new Set(s1.filter(Boolean)).size > 1, s1.join(' / '));
    await p.screenshot({ path: OUT + 'ct-pos-tag.png' });
    if ((await p.$$('#ptags .ptag')).length) { await p.click('#ptags [data-pa="close"]'); await p.waitForTimeout(150); }
    check('✕ on the tag closes the trade', (await p.$$('#ptags .ptag')).length === 0 && (await p.$$('.pos-card')).length === 0);
    await p.waitForTimeout(200); const lk2 = await p.evaluate(() => window.ctChart());
    check('flat: the P&L pill goes; closed trades show entry → exit connectors with a signed R label', await p.$eval('#pnlpill', (e) => e.hidden) && lk2.conn >= 1 && lk2.lbl >= 1, JSON.stringify(lk2)); }
  // 9. layers and context
  await p.click('#laydd summary'); for (const l of ['ema20', 'ema50', 'vol', 'sess', 'pdhl', 'anim']) await p.click(`.ddp [data-l=${l}]`).catch(() => {}); await p.keyboard.press('Escape');
  check('layer toggles flip state', await p.evaluate(() => JSON.parse(localStorage.getItem('btLab:layers') || '{}').ema20 === true));
  // split view (10 Nov): Layout puts up to four charts side by side, each on its own timeframe, all at the replay's moment
  const paneWait = () => p.waitForFunction(() => [...document.querySelectorAll('.xp-t')].every((e) => !/Loading/.test(e.textContent)), null, { timeout: 60000 }).catch(() => {});
  check('session form: ten timeframes, 1 minute to 1 day', (await p.$$eval('#tfchips button', (e) => e.map((x) => x.textContent))).join(' ') === '1m 2m 5m 10m 15m 30m 1h 2h 4h D' && await p.$eval('#tfchips [aria-pressed="true"]', (e) => e.dataset.tf) === '15m');
  await p.click('#splitdd summary'); await p.click('#splitdd [data-split="2"]'); await p.waitForSelector('.xp'); await p.selectOption('.xp .xp-tf', '4h'); await paneWait();
  check('H4 chart loads beside the replay, its last candle forming', await p.$eval('#panes', (e) => e.dataset.n) === '2' && /forming/.test(await txt(p, '.xp .xp-t')), await txt(p, '.xp .xp-t'));
  await p.click('#splitdd summary'); await p.click('#splitdd [data-split="4"]'); await p.waitForFunction(() => document.querySelectorAll('.xp').length === 3); await p.selectOption('.xp:last-child .xp-tf', '5m'); await paneWait(); await p.waitForTimeout(300);
  { const sp = await p.evaluate(() => { const s = ctSplit(); return { n: s.n, panes: s.panes.map((P) => ({ tf: P.tf, rel: P.rel, n: P.n, ok: !!P.last && P.last.close === s.close && (P.rel === 'lower' ? P.last.time + P.sec <= s.now + 900 : P.last.time <= s.now) && (P.rel !== 'higher' || (Math.abs(P.last.high - P.hi) < 1e-9 && Math.abs(P.last.low - P.lo) < 1e-9)) })) }; });
    check('four charts: every pane ends at the replay moment (no candle from the future)', sp.n === 4 && sp.panes.length === 3 && sp.panes.every((x) => x.ok && x.n > 20) && sp.panes.some((x) => x.rel === 'lower') && sp.panes.some((x) => x.rel === 'higher'), JSON.stringify(sp));
    const g = await p.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), c = r('chart'), q = r('qtr'); return q.left >= c.left - 1 && q.right <= c.right + 1 && document.documentElement.scrollWidth <= innerWidth; }); check('four charts: quick Buy / Sell stays on the first chart, no sideways scroll', g); await p.screenshot({ path: OUT + 'ct-split4.png' }); }
  await p.click('#splitdd summary'); await p.click('#splitdd [data-split="1"]'); await p.waitForTimeout(250);
  check('back to one chart: the panes are gone', (await p.$$('.xp')).length === 0 && await p.$eval('#panes', (e) => getComputedStyle(e).display) === 'contents');
  // 10. drawings
  const box = await p.$eval('#chart', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.click('#drawdd summary'); await p.click('[data-dt=h]'); await p.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.25);
  await p.click('#drawdd summary'); await p.click('[data-dt=r]'); await p.mouse.click(box.x + box.w * 0.3, box.y + box.h * 0.4); await p.mouse.click(box.x + box.w * 0.4, box.y + box.h * 0.5);
  const nd = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('btLab:sessions')))[0].draw.length); check('drawings placed and saved', nd === 2, nd);
  await p.click('#drawdd summary'); await p.click('[data-dx=last]'); check('remove last drawing', (await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('btLab:sessions')))[0].draw.length)) === 1);
  // selection (chart design pass): click a box to select it, Delete removes it
  await p.click('#drawdd summary'); await p.click('[data-dt=r]'); await p.mouse.click(box.x + box.w * 0.3, box.y + box.h * 0.4); await p.mouse.click(box.x + box.w * 0.4, box.y + box.h * 0.5); await p.waitForTimeout(350);
  await p.mouse.move(box.x + box.w * 0.35, box.y + box.h * 0.45); await p.mouse.click(box.x + box.w * 0.35, box.y + box.h * 0.45); await p.waitForTimeout(100);
  const selA = await p.evaluate(() => window.ctChart()); await p.keyboard.press('Delete'); await p.waitForTimeout(100); const selB = await p.evaluate(() => window.ctChart());
  check('click selects a drawing and Delete removes it', selA.sel === 1 && selA.drawings === 2 && selB.drawings === 1 && selB.sel === -1, JSON.stringify([selA.sel, selA.drawings, selB.drawings]));
  // 11. prop firm challenge: fail fast with 6% risk on FTMO
  await p.selectOption('#firm', 'ftmo2'); await p.click('#pf-start'); await p.click('dialog.msd button.pri').catch(() => {});
  await p.waitForFunction(() => /live/.test(document.getElementById('pf-status').textContent), null, { timeout: 10000 }).catch(() => {});   // the challenge starts when the confirm dialog has closed, not 200 ms after the click
  check('challenge starts at the firm size', /100,000/.test(await txt(p, '#bal')) && /live/.test(await txt(p, '#pf-status')), await txt(p, '#pf-status'));
  let failed = false; for (let k = 0; k < 6 && !failed; k++) { await p.keyboard.press('Shift+B'); await p.fill('#o-risk', '6'); await p.dispatchEvent('#o-risk', 'input'); await p.click('[data-sl="bar"]'); await p.click('[data-tp="3"]'); await p.click('#place'); for (let i = 0; i < 80; i++) { await p.keyboard.press('ArrowRight'); if (!(await p.$('.pos-card'))) break; } failed = /failed/.test(await txt(p, '#pf-status')); }
  check('daily loss / max loss trips the challenge', failed, await txt(p, '#pf'));
  check('a breach flattens the account', (await p.$$('.pos-card')).length === 0, await txt(p, '#open'));
  { const v = await p.evaluate(() => { const q = (s) => document.querySelector(s); return { state: (q('#pf .pf-state') || {}).textContent || '', bad: !!q('#pf .pf-state.bad'), tb: !!q('#pf .pf-tb'), gauges: document.querySelectorAll('#pf .pfg svg').length, breached: /Breached/.test((q('#pf .pf-gs') || {}).textContent || ''), pips: document.querySelectorAll('#pf .pf-days i').length, phases: document.querySelectorAll('#pf .pf-ph li').length }; });
    check('challenge progress: failed in words, target bar, daily / max loss gauges (breached named), days as pips, phases', /Failed/.test(v.state) && v.bad && v.tb && v.gauges === 2 && v.breached && v.pips >= 4 && v.phases === 2, JSON.stringify(v)); }
  await p.click('.tabs [data-t=log]'); check('challenge log lists the days', (await p.$$('#pflog tr')).length > 1); await p.click('.tabs [data-t=journal]');
  await p.fill('#o-risk', '1'); await p.click('#pf-stop').catch(() => {}); await p.click('dialog.msd button.pri').catch(() => {});
  // 12. tabs: stats, calendar, export
  await p.click('.tabs [data-t=stats]'); check('statistics render', (await p.$$('#stats div')).length >= 16 && !/NaN|undefined/.test(await txt(p, '#stats')), (await txt(p, '#stats')).slice(0, 80));
  check('session table renders', (await p.$$('#bysess tr')).length >= 2);
  await p.click('.tabs [data-t=journal]'); await p.click('#jbody td.mist >> nth=0'); await p.check('#mist-grid input[value="FOMO"]'); await p.click('#mist-save'); await p.waitForTimeout(100);
  check('a trade can be reviewed with a mistake tag', /FOMO/.test(await txt(p, '#jbody td.mist')));
  await p.click('.tabs [data-t=stats]'); check('mistake breakdown renders', /FOMO/.test(await txt(p, '#bymist')));
  if (!(await p.$eval('#mc-run', (e) => e.disabled))) { await p.click('#mc-run'); await p.waitForTimeout(200); check('pass probability runs', /pass|fail/.test(await txt(p, '#mc-out')));
    const f = await p.evaluate(() => ({ bands: document.querySelectorAll('#mc-fan .bv-fan1, #mc-fan .bv-fan2').length, med: document.querySelectorAll('#mc-fan .bv-fanm').length, labs: [...document.querySelectorAll('#mc-fan svg text')].map((e) => e.textContent).join(' '), tg: !!document.querySelector('#mc-fan .bv-tgt'), fl: !!document.querySelector('#mc-fan .bv-flr') }));
    check('Monte Carlo fan: 5th-95th and 25th-75th bands, median, percentiles labelled, target and max loss drawn', f.bands === 2 && f.med === 1 && /5th/.test(f.labs) && /25th/.test(f.labs) && /median/.test(f.labs) && /75th/.test(f.labs) && /95th/.test(f.labs) && f.tg && f.fl && /Target/.test(f.labs), JSON.stringify(f).slice(0, 140));
    const rc = await p.evaluate(() => ({ pts: document.querySelectorAll('#mc-rc .bv-rcp').length, you: document.querySelectorAll('#mc-rc .bv-rcy').length, t: document.querySelector('#mc-rc svg') ? document.querySelector('#mc-rc svg').textContent : '' }));
    check('best risk per trade as a curve with your risk and the best marked', rc.pts === 9 && rc.you >= 1 && /Yours/.test(rc.t) && (/Best/.test(rc.t) || /also the best/.test(rc.t)), JSON.stringify(rc).slice(0, 140));
    await p.hover('#mc-fan .bv-hit >> nth=5'); await p.waitForTimeout(80); check('fan tooltip names the percentiles after N trades', await p.$eval('.bv-tip', (e) => !e.hidden && /After 6 trades/.test(e.textContent) && /median/.test(e.textContent)).catch(() => false)); } else check('pass probability waits for 5 trades', /needs at least 5/.test(await txt(p, '#mc-note')));
  await p.click('.tabs [data-t=cal]'); const t1 = await txt(p, '#cal-title'); await p.click('#cal-prev'); check('calendar navigates', (await txt(p, '#cal-title')) !== t1); await p.click('#cal-next');
  await p.click('.tabs [data-t=data]'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exp-csv')]); const csv = fs.readFileSync(await dl.path(), 'utf8'); check('CSV export has the trades', csv.trim().split('\n').length >= 2 && /entry/.test(csv.split('\n')[0]), csv.split('\n')[0]);
  const [dj] = await Promise.all([p.waitForEvent('download'), p.click('#exp-json')]); const js = JSON.parse(fs.readFileSync(await dj.path(), 'utf8')); check('JSON export is a session', js.acct && js.sym === 'xau');
  // 12b. review pass: journal filters / sort / click-through / inline screenshot, analytics charts, session report
  { await p.click('.tabs [data-t=journal]'); const nAll = (await p.$$('#jbody tr[data-id]')).length;
    await p.click('#jf-side [data-v=buy]'); const sides = await p.$$eval('#jbody tr[data-id] .badge', (b) => b.map((x) => x.textContent));
    check('journal filter by side shows only buys and counts them', sides.length > 0 && sides.every((x) => x === 'buy') && /of \d+ trades/.test(await txt(p, '#jf-n')), sides.join(',') + ' ' + await txt(p, '#jf-n'));
    await p.click('#jf-res [data-v=loss]'); const nets = await p.$$eval('#jbody tr[data-id] td.net', (b) => b.map((x) => x.textContent)); check('win / loss filter keeps losses only', nets.every((x) => /−/.test(x)), nets.join(' '));
    await p.click('#jf-clear'); check('clear filters brings every trade back', (await p.$$('#jbody tr[data-id]')).length === nAll, nAll);
    await p.click('.jt th[data-k=R] button'); let rs = await p.$$eval('#jbody tr[data-id] .rchip', (b) => b.map((x) => parseFloat(x.textContent.replace('−', '-')) || 0));
    const desc = rs.every((v, i) => !i || rs[i - 1] >= v); await p.click('.jt th[data-k=R] button'); rs = await p.$$eval('#jbody tr[data-id] .rchip', (b) => b.map((x) => parseFloat(x.textContent.replace('−', '-')) || 0));
    check('R column sorts both ways', desc && rs.every((v, i) => !i || rs[i - 1] <= v) && (await p.getAttribute('.jt th[data-k=R]', 'aria-sort')) === 'ascending', rs.join(' '));
    await p.fill('#jbody tr[data-id] input[data-f=tags] >> nth=0', 'breakout'); await p.press('#jbody tr[data-id] input[data-f=tags] >> nth=0', 'Tab'); await p.waitForTimeout(100);
    check('inline tag edit feeds the setup filter', await p.$$eval('#jf-tag [data-v]', (o) => o.some((x) => x.dataset.v === 'breakout')));
    await p.click('#jf-tag [data-v=breakout]'); check('setup filter narrows the journal', (await p.$$('#jbody tr[data-id]')).length === 1); await p.click('#jf-clear');
    await p.click('#jbody tr[data-id] [data-go] >> nth=0'); await p.waitForTimeout(400);
    check('click-through frames the trade and draws its levels', /trade \d+/.test(await txt(p, '#legend')) && await p.evaluate(() => document.querySelector('#jbody tr.hl') != null), await txt(p, '#legend'));
    await p.screenshot({ path: OUT + 'ct-review-trade.png' });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#jbody tr[data-id] [data-up] >> nth=-1')]); await fc.setFiles({ name: 'shot.png', mimeType: 'image/png', buffer: png }); await p.waitForTimeout(400);
    check('a screenshot can be added inline', /Screenshot saved/.test(await txt(p, '#toasts')), await txt(p, '#toasts'));
    { await p.click('#jf-side [data-v=buy]'); const ch = await p.evaluate(() => ({ on: document.querySelector('#jf-side [data-v=buy]').getAttribute('aria-pressed'), all: document.querySelector('#jf-side [data-v=""]').getAttribute('aria-pressed') }));
      await p.click('#jf-side [data-v=buy]'); const off = await p.getAttribute('#jf-side [data-v=""]', 'aria-pressed');
      check('journal filters are chips: pressed state, a second tap turns a filter off', ch.on === 'true' && ch.all === 'false' && off === 'true', JSON.stringify(ch) + ' ' + off); }
    await p.waitForTimeout(200); check('journal rows carry a mini chart of the trade (price, entry, stop, exit)', await p.evaluate(() => { const m = document.querySelector('#jbody tr[data-id] .mini.ok svg'); return !!(m && m.querySelector('.m-px') && m.querySelector('.m-sl') && m.querySelector('.m-out')); }));
    await p.click('.tabs [data-t=stats]'); await p.waitForTimeout(200);
    check('KPI tiles: win rate, expectancy, profit factor', /Win rate/.test(await txt(p, '#kpis')) && /Expectancy/.test(await txt(p, '#kpis')) && /Profit factor/.test(await txt(p, '#kpis')) && !/NaN|undefined/.test(await txt(p, '#kpis')), await txt(p, '#kpis'));
    check('equity curve with drawdown shading and legend', (await p.$$('#v-eq svg .bv-line')).length === 1 && (await p.$$('#v-eq .bv-dd')).length === 1 && /Drawdown/.test(await txt(p, '#v-eq .bv-leg')));
    check('R histogram renders bars and the average', (await p.$$('#v-hist .bv-bar')).length >= 2 && /avg/.test(await txt(p, '#v-hist')));
    check('weekday × hour heatmap renders cells', (await p.$$('#v-heat .bv-cell')).length >= 1 && (await p.$$('#v-heat .bv-cell0')).length > 50);
    await p.hover('#v-heat .bv-cell >> nth=0'); await p.waitForTimeout(80); check('chart tooltip shows on hover', await p.$eval('.bv-tip', (e) => !e.hidden && /UTC/.test(e.textContent)).catch(() => false));
    { const k = await p.evaluate(() => [...document.querySelectorAll('#kpis .kh .kpi small')].map((e) => e.textContent)); check('analytics header: win rate, avg R, profit factor and expectancy in one row', k.join('|') === 'Win rate|Avg R|Profit factor|Expectancy' && /Max drawdown/.test(await txt(p, '#kpis .kh2')), k.join('|')); }
    check('by-session and by-weekday bars with signed R labels', (await p.$$('#v-sess .bv-bar')).length >= 1 && (await p.$$('#v-day .bv-bar')).length >= 1 && /R/.test(await txt(p, '#v-day .bv-val')) && (await p.$$('#bysess tr')).length >= 2);
    { const small = await p.evaluate(() => [...document.querySelectorAll('#tab-stats svg text, #tab-stats .bv-leg, #kpis small, #kpis span, #tab-journal th, #tab-journal td small, #jf button, #pf *')].filter((e) => e.getClientRects().length && e.textContent.trim() && !e.children.length).map((e) => [e.textContent.trim().slice(0, 20), parseFloat(getComputedStyle(e).fontSize)]).filter(([, f]) => f < 11.95));
      check('analytics, journal and challenge text is 12 px or more', small.length === 0, JSON.stringify(small.slice(0, 6))); }
    { await p.emulateMedia({ colorScheme: 'dark' }); const c0 = await aaStats(p), bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); await p.emulateMedia({ colorScheme: 'light' }); check('AA contrast (4.5:1) for analytics text in the dark theme', !c0.length && bg === 'rgb(8, 9, 12)', bg + ' ' + c0.slice(0, 6).join(' | ')); }
    check('setup and rule-compliance charts render', (await p.$$('#v-tag .bv-bar')).length >= 1 && ((await p.$$('#v-rules .bv-bar')).length >= 1 || /Tick/.test(await txt(p, '#v-rules'))), await txt(p, '#v-rules'));
    await p.click('.tabs [data-t=journal]'); await p.click('#jf-side [data-v=sell]'); await p.click('.tabs [data-t=stats]'); check('analytics follow the journal filters', /journal filters/.test(await txt(p, '#afilt'))); await p.screenshot({ path: OUT + 'ct-analytics.png', fullPage: true });
    await p.click('.tabs [data-t=journal]'); await p.click('#jf-clear'); await p.click('.tabs [data-t=stats]');
    await p.click('#rep-btn'); await p.waitForTimeout(200); check('session report opens with key numbers, best / worst and mistakes', await p.$eval('#repd', (e) => e.open) && /Win rate/.test(await txt(p, '#rep')) && /Best trade/.test(await txt(p, '#rep')) && /Mistakes/.test(await txt(p, '#rep')) && (await p.$$('#rep-eq svg')).length === 1);
    await p.screenshot({ path: OUT + 'ct-report.png' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {}); await p.click('#rep-copy'); await p.waitForTimeout(150); const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    check('report copies as text', /session report/.test(clip) && /Net P&L/.test(clip), clip.slice(0, 80));
    const [dp] = await Promise.all([p.waitForEvent('download'), p.click('#rep-png')]); const pb = fs.readFileSync(await dp.path()); check('report downloads as a PNG image', pb.slice(1, 4).toString() === 'PNG' && pb.length > 5000, pb.length); fs.writeFileSync(OUT + 'ct-report-image.png', pb);
    const [pw] = await Promise.all([ctx.waitForEvent('page'), p.click('#rep-print')]); await pw.waitForLoadState(); check('printable page opens with the report', /Best trade/.test(await pw.textContent('body')) && (await pw.$$('svg')).length === 1); await pw.screenshot({ path: OUT + 'ct-report-print.png', fullPage: true }); await pw.close();
    await p.keyboard.press('Escape'); }
  // 13. reload resumes the session
  await p.click('.tabs [data-t=journal]'); const jn = (await p.$$('#jbody tr[data-id]')).length; await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => /Resumed/.test(document.getElementById('loadmsg').textContent), null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(500);
  check('reload resumes the last session', (await p.$$('#jbody tr[data-id]')).length === jn && jn > 0, `${jn} vs ${(await p.$$('#jbody tr[data-id]')).length}`);
  // 14. full screen with the trade dock
  await p.keyboard.press('f'); await p.waitForTimeout(300);
  const fsI = await p.evaluate(() => { const tc = document.getElementById('tradecard').getBoundingClientRect(), ch = document.getElementById('chart').getBoundingClientRect(); return { fs: document.body.classList.contains('fs'), dock: getComputedStyle(document.getElementById('tradecard')).position, chartH: Math.round(ch.height), tbFloat: document.getElementById('tb').classList.contains('float'), tcX: Math.round(tc.left) }; });
  check('F enters full screen: chart fills, Trade dock and replay bar float', fsI.fs && fsI.dock === 'fixed' && fsI.chartH > 850 && fsI.tbFloat, JSON.stringify(fsI));
  await p.keyboard.press('Shift+S'); check('Sell draft works in full screen', await vis(p, '#draft')); await p.keyboard.press('Escape');
  const g = await p.$eval('#tc-grip', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + 5, y: r.top + 5 }; }); await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(g.x - 600, g.y + 100, { steps: 8 }); await p.mouse.up();
  check('Trade dock drags', (await p.$eval('#tradecard', (e) => e.getBoundingClientRect().left)) < fsI.tcX - 300);
  await p.screenshot({ path: OUT + 'ct-fs.png' });
  await p.click('#fs-btn'); await p.waitForTimeout(200); check('full screen exits and the Trade card returns to the side', !(await p.evaluate(() => document.body.classList.contains('fs'))) && (await p.$eval('#tradecard', (e) => !!e.closest('.side'))));
  // 15. settings: commission
  await p.$eval('#comm', (e) => { e.closest('details').open = true; }); await p.fill('#comm', '7'); await p.dispatchEvent('#comm', 'change'); await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('Shift+B'); await p.click('#place'); await p.click('#open [data-act=close]'); await p.waitForTimeout(100); const lastNet = await p.$eval('#jbody tr[data-id] td.net', (e) => e.textContent); check('commission is charged on close', /−\$7|-\$7|−\$/.test(lastNet), lastNet);
  // 16. new session + delete
  await p.click('#sess-toggle'); await p.click('#newsess'); check('New session clears the chart', (await txt(p, '#sess-sum')).includes('New session'));
  // 17. phone layout and light theme
  const m = await ctx.newPage(); await route(m); await me(m, OWNER); await m.setViewportSize({ width: 390, height: 844 }); await m.goto(H + '/backtest.html', { waitUntil: 'load' }); await m.waitForTimeout(2500);
  await m.evaluate(() => window.openGuide()); const gw = await m.$eval('#guide', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right }; }); check('phone: guide fits at 390 px', gw.l >= 8 && gw.r <= 382, JSON.stringify(gw)); await m.screenshot({ path: OUT + 'ct-guide-phone.png' }); await m.keyboard.press('Escape');
  check('phone: no sideways scroll', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), await m.evaluate(() => document.documentElement.scrollWidth));
  await m.evaluate(() => localStorage.setItem('msPrefs', JSON.stringify({ theme: 'light' }))); await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(1500);
  check('light theme applies', await m.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgb(8, 9, 12)'), await m.evaluate(() => getComputedStyle(document.body).backgroundColor));
  await m.screenshot({ path: OUT + 'ct-phone-light.png' });
  await m.evaluate(() => localStorage.setItem('msPrefs', JSON.stringify({ theme: 'midnight' }))); await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(1200);
  check('midnight theme applies to ChronosTrade', await m.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(7, 13, 31)'), await m.evaluate(() => getComputedStyle(document.body).backgroundColor));
  await m.emulateMedia({ reducedMotion: 'reduce' }); check('reduced motion: chart pills do not animate', await m.evaluate(() => parseFloat(getComputedStyle(document.getElementById('pnlpill')).transitionDuration) === 0 && getComputedStyle(document.getElementById('dchip')).animationName === 'none')); await m.emulateMedia({ reducedMotion: null });
  await m.evaluate(() => localStorage.setItem('msPrefs', JSON.stringify({ theme: 'light' }))); await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(1200);
  await m.waitForFunction(() => /Resumed/.test(document.getElementById('loadmsg').textContent), null, { timeout: 120000 }).catch(() => {});
  { await m.$eval('.chartc', (e) => e.scrollIntoView()); await m.waitForTimeout(150); await m.keyboard.press('b'); await m.waitForTimeout(300);
    const tz = await m.evaluate(() => { const t = [...document.querySelectorAll('#toasts .toast')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect()), c = document.getElementById('chart').getBoundingClientRect(); return { n: t.length, b: t.length ? Math.round(t[t.length - 1].bottom) : -1, h: t.length ? Math.round(t[t.length - 1].height) : 0, ct: Math.round(c.top), cb: Math.round(c.bottom) }; });
    check('phone: a toast after a trade sits above the chart, one at a time, compact', tz.n === 1 && tz.h <= 44 && (tz.b <= tz.ct || tz.b <= 52), JSON.stringify(tz)); await m.evaluate(() => { const c = document.querySelector('#open [data-act=close]'); if (c) c.click(); }); await m.waitForTimeout(150); }
  { await m.click('.tabs [data-t=stats]').catch(() => {}); await m.waitForTimeout(300); check('phone: analytics fit at 390 px', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))); await m.$eval('#tab-stats', (e) => e.scrollIntoView()); await m.screenshot({ path: OUT + 'ct-analytics-phone-light.png' });
    { const c1 = await aaStats(m); await m.click('.tabs [data-t=journal]'); await m.waitForTimeout(200); const c2 = await aaStats(m); await m.click('.tabs [data-t=stats]'); await m.waitForTimeout(200);
      check('AA contrast (4.5:1) for analytics and journal text in the light theme', !c1.length && !c2.length, [...c1, ...c2].slice(0, 6).join(' | ')); }
    await m.click('#rep-btn').catch(() => {}); await m.waitForTimeout(200); const rw = await m.$eval('#repd', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right }; }); check('phone: session report fits', rw.l >= 0 && rw.r <= 390, JSON.stringify(rw)); await m.screenshot({ path: OUT + 'ct-report-phone-light.png' }); await m.keyboard.press('Escape'); }
  { await m.evaluate(() => localStorage.setItem('msPrefs', JSON.stringify({ theme: 'midnight' }))); await m.reload({ waitUntil: 'load' }); await m.waitForFunction(() => /Resumed/.test(document.getElementById('loadmsg').textContent), null, { timeout: 120000 }).catch(() => {}); await m.waitForTimeout(400);
    await m.click('.tabs [data-t=stats]'); await m.waitForTimeout(300); const c3 = await aaStats(m); await m.click('.tabs [data-t=journal]'); await m.waitForTimeout(200); const c4 = await aaStats(m);
    check('AA contrast (4.5:1) for analytics and journal text in the midnight theme', !c3.length && !c4.length, [...c3, ...c4].slice(0, 6).join(' | ')); }
  // 18. toolbar (pass 11): Replay | time | Chart tools | View, one row at 1366 × 768 with nothing important below the fold;
  // phones keep replay, speed, jump and Buy / Sell in sight and put Chart tools and View behind More; J jumps; 100+ trades stay quick
  for (const [w, h] of [[1366, 768], [390, 844]]) { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(w + ': ' + e.message)); await route(q); await me(q, OWNER); await q.setViewportSize({ width: w, height: h });
    await q.goto(H + '/backtest.html', { waitUntil: 'load' }); await q.waitForFunction(() => /Resumed/.test(document.getElementById('loadmsg').textContent), null, { timeout: 120000 }).catch(() => {}); await q.waitForTimeout(500);
    const L = await q.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height), v: b.width > 0 }; };
      return { tb: r('#tb'), play: r('#play'), sp: r('.speed [data-sp="80"]'), jump: r('#jumpdd > summary'), lay: r('#laydd > summary'), draw: r('#drawdd > summary'), fs: r('#fs-btn'), more: r('#tb-more'), buy: r('#qt-buy'), sell: r('#qt-sell'), vh: innerHeight, vw: innerWidth, sw: document.documentElement.scrollWidth }; });
    const inView = (k) => !!(L[k] && L[k].v && L[k].b <= L.vh && L[k].t >= 0 && L[k].r <= L.vw && L[k].l >= 0);
    if (w > 700) {
      check('1366×768: the toolbar is one row; replay, speed, jump, chart tools, view and Buy / Sell all in sight', L.tb.h <= 64 && Math.abs(L.fs.t - L.play.t) < 8 && ['play', 'sp', 'jump', 'lay', 'draw', 'fs', 'buy', 'sell'].every(inView) && !inView('more'), JSON.stringify(L));
      await q.screenshot({ path: OUT + 'ct-1366.png' });
      const n0 = await barN(q); await q.keyboard.press('j'); await q.waitForTimeout(120); const jo = await q.$eval('#jumpdd', (e) => e.open); await q.keyboard.press('Enter'); await q.waitForTimeout(400); const n1 = await barN(q);
      check('J opens the jump popover (a day ahead filled in) and Enter jumps forward', jo && n1 > n0 && !(await q.$eval('#jumpdd', (e) => e.open)), `${jo} ${n0} -> ${n1}`);
      // a long journal: 110 one-click trades; the table shows 100 with "Show more", and closing a trade stays quick
      await q.evaluate(async () => { const k = (key) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); for (let i = 0; i < 110; i++) { k(i % 2 ? 's' : 'b'); const c = document.querySelector('#open [data-act=close]'); if (c) c.click(); if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0)); } });
      await q.waitForTimeout(300); const rows = (await q.$$('#jbody tr[data-id]')).length, moreBtn = await q.$('#jbody [data-jmore]');
      // the middle of five closes: one reading also times whatever else the machine did in that instant (157 and 406 ms were read on a busy one)
      const ms = await q.evaluate(async () => { const all = []; for (let i = 0; i < 5; i++) { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: i % 2 ? 's' : 'b', bubbles: true })); const t0 = performance.now(); document.querySelector('#open [data-act=close]').click(); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); all.push(Math.round(performance.now() - t0)); } return all.sort((a, b) => a - b)[2]; });
      check('100+ trades: the journal shows the latest 50 with "Show more"', rows === 50 && !!moreBtn, `${rows} rows, more ${!!moreBtn}`);
      if (moreBtn) { await q.waitForTimeout(200); await q.click('#jbody [data-jmore]'); await q.waitForTimeout(150); } check('"Show more" adds the older trades', (await q.$$('#jbody tr[data-id]')).length > 50);
      await q.reload({ waitUntil: 'load' }); await q.waitForFunction(() => /Resumed/.test(document.getElementById('loadmsg').textContent), null, { timeout: 120000 }).catch(() => {}); await q.waitForTimeout(500);
      await q.$eval('.tw', (e) => e.scrollIntoView()); await q.waitForTimeout(250); const mk = await q.evaluate(() => ({ ok: document.querySelectorAll('#jbody .mini.ok').length, all: document.querySelectorAll('#jbody .mini').length }));
      check('journal mini charts are lazy: after a reload only the rows in view are drawn', mk.ok > 0 && mk.ok < mk.all, JSON.stringify(mk));
      check('closing a trade with 100+ in the journal takes under 150 ms', ms < 150, ms + ' ms');
    } else {
      check('390×844: one toolbar row; replay, speed, jump, More and Buy / Sell in sight without scrolling', L.tb.h <= 64 && Math.abs(L.more.t - L.play.t) < 8 && ['play', 'sp', 'jump', 'more', 'buy', 'sell'].every(inView) && !inView('draw') && L.sw <= L.vw + 1, JSON.stringify(L));
await q.click('#tb-more'); await q.waitForTimeout(120);
      const o = await q.evaluate(() => ['#laydd > summary', '#splitdd > summary', '#drawdd > summary', '#snd-btn', '#fs-btn', '#tb-dock'].map((s) => { const b = document.querySelector(s).getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; }));
      check('phone: More shows Layers, Layout, Draw, sound, full screen and toolbar position on screen', o.every(Boolean), JSON.stringify(o)); await q.screenshot({ path: OUT + 'ct-phone-more.png' });
      await q.click('#drawdd > summary'); check('phone: the Draw menu opens from More', await q.$eval('#drawdd', (e) => e.open));
      await q.mouse.click(8, 140); await q.waitForTimeout(80); check('phone: More closes on an outside tap', !(await q.$eval('#tb', (e) => e.classList.contains('more-open'))));
    }
    await q.close(); }
  // 19. first-run flow for a new member, done by doing it (onboarding pass): defaults, empty states, Load this day, Play, one-click Buy with an
  // automatic stop, the result, Done remembered per member, no card on a repeat visit, Surprise me; calm motion; AA; 44 px touch targets at 390
  { const c2 = await b.newContext({ viewport: { width: 1366, height: 768 } }); const n = await c2.newPage(); n.on('pageerror', (e) => errs.push('onb: ' + e.message)); await route(n); await me(n, { u: 'newbie', name: 'New member', role: 'member' });
    await n.goto(H + '/backtest.html', { waitUntil: 'load' }); await n.waitForSelector('#guide[open]', { timeout: 5000 }).catch(() => {});
    const df = await n.evaluate(() => ({ sym: document.getElementById('sym').value, start: document.getElementById('start').value, sp: (document.querySelector('.speed [aria-pressed="true"]') || {}).dataset, risk: document.getElementById('o-risk').value, day: (document.getElementById('gd-date') || {}).value }));
    { const dd = new Date(df.start + 'Z'), age = (Date.now() - dd) / 864e5; check('first load defaults: gold, a recent Tuesday to Thursday at 12:00 UTC, speed 1×, risk 1%', df.sym === 'xau' && [2, 3, 4].includes(dd.getUTCDay()) && dd.getUTCHours() === 12 && age >= 7 && age <= 22 && df.sp && df.sp.sp === '1000' && df.risk === '1' && df.day === df.start.slice(0, 10), JSON.stringify(df)); }
    const ej = await n.evaluate(() => { const e = document.querySelector('#jbody .empty.ea'); return e ? { t: e.textContent, a: e.querySelector('[data-ea]').dataset.ea, jf: getComputedStyle(document.getElementById('jf')).display } : null; });
    check('journal empty state: what will appear and one action (pick a market); no filters on an empty journal', ej && /trades will be listed here/.test(ej.t) && ej.a === 'load' && ej.jf === 'none', JSON.stringify(ej));
    await n.click('.tabs [data-t=stats]'); const es = await n.evaluate(() => ({ vis: !!document.querySelector('#st-empty .empty.ea [data-ea]') && document.getElementById('st-empty').getClientRects().length > 0, t: document.getElementById('st-empty').textContent, viz: getComputedStyle(document.querySelector('#tab-stats .viz')).display, mc: getComputedStyle(document.getElementById('mc')).display }));
    check('statistics empty state: what appears after the first trade, one action, no empty charts', es.vis && /first closed trade/.test(es.t) && /five trades/.test(es.t) && es.viz === 'none' && es.mc === 'none', JSON.stringify(es).slice(0, 140));
    check('prop-firm empty state explains the challenge and names Start challenge', /Start challenge/.test(await txt(n, '#pf .pf-empty')) && /profit target/.test(await txt(n, '#pf .pf-empty')), await txt(n, '#pf'));
    await n.click('.tabs [data-t=log]'); check('challenge log empty state points to the challenge card', !!(await n.$('#pflog [data-ea=pf]')));
    await n.click('#pflog [data-ea=pf]'); await n.waitForTimeout(200); check('its action takes you to the firm picker', await n.evaluate(() => document.activeElement && document.activeElement.id === 'firm'));
    { const aa = await aaBoth(n); check('AA contrast (4.5:1): first-run card, empty states and buttons, dark and light (before loading)', !aa.length, aa.slice(0, 6).join(' | ')); }
    await n.click('.tabs [data-t=journal]'); await n.click('#jbody [data-ea=load]'); await n.waitForTimeout(200);
    check('the journal empty-state action opens the session picker at the quick starts', await n.evaluate(() => !document.getElementById('sess-body').hidden && !!document.activeElement && document.activeElement.matches('#quick [data-q]')));
    await n.click('#gd-load'); await n.waitForFunction(() => /Press Play/.test(document.getElementById('gd-title').textContent), null, { timeout: 120000 }).catch(() => {});
    check('step 1: Load this day loads the candles and the card moves on to Play (Play outlined)', /Press Play/.test(await txt(n, '#gd-title')) && (await barN(n)) > 10 && await n.$eval('#play', (e) => e.classList.contains('coach-hi')), await txt(n, '#gd-title'));
    check('loaded: the journal empty state now points at Buy / Sell', (await n.$eval('#jbody [data-ea]', (e) => e.dataset.ea).catch(() => '')) === 'trade');
    const pb0 = await barN(n); await n.click('#gd-play'); await n.waitForTimeout(2300); const pb1 = await barN(n);
    check('step 2: Play replays at 1× (about a bar a second) and the card moves on to Buy or Sell (quick bar outlined)', /Buy or Sell/.test(await txt(n, '#gd-title')) && await n.$eval('#play', (e) => e.classList.contains('playing')) && pb1 - pb0 >= 1 && pb1 - pb0 <= 3 && await n.$eval('#qtr', (e) => e.classList.contains('coach-hi')), `${await txt(n, '#gd-title')} ${pb0}→${pb1}`);
    await n.click('#play'); await n.waitForTimeout(100);
    { const aa = await aaBoth(n); check('AA contrast (4.5:1): Buy / Sell in the card, dark and light', !aa.length, aa.slice(0, 6).join(' | ')); }
    await n.click('#gd-buy'); await n.waitForTimeout(200);
    const ps = await n.evaluate(() => { const c = document.querySelector('#open .pos-card'); return c ? { side: c.querySelector('.badge').textContent, stop: +c.querySelector('input[data-f=stop]').value, entry: +c.querySelector('.pos-l b').textContent.replace(/,/g, '') } : null; });
    check('step 3: Buy in the card opens the trade at once with an automatic stop below the entry; the card moves on to the result', ps && /buy/.test(ps.side) && ps.stop > 0 && ps.stop < ps.entry && /See the result/.test(await txt(n, '#gd-title')), JSON.stringify(ps));
    await n.click('#gd-closeit'); await n.waitForSelector('#gd-res', { timeout: 5000 }).catch(() => {});
    check('step 4: the result in R and $, logged in the journal; Next becomes Done', /R/.test(await txt(n, '#gd-res')) && /\$/.test(await txt(n, '#gd-res')) && (await txt(n, '#gd-next')) === 'Done' && (await n.$$('#jbody tr[data-id]')).length === 1, await txt(n, '#gd-res'));
    { const aa = await aaBoth(n); check('AA contrast (4.5:1): the result step, dark and light', !aa.length, aa.slice(0, 6).join(' | ')); }
    await n.click('#gd-next'); await n.waitForFunction(() => !document.getElementById('guide').open && localStorage.getItem('btLab:onb:newbie') === 'done', null, { timeout: 3000 }).catch(() => {}); check('Done closes the card and remembers it for this member', !(await n.$eval('#guide', (e) => e.open)) && (await n.evaluate(() => localStorage.getItem('btLab:onb:newbie'))) === 'done');
    await n.reload({ waitUntil: 'load' }); await n.waitForFunction(() => /Resumed/.test(document.getElementById('loadmsg').textContent), null, { timeout: 120000 }).catch(() => {}); await n.waitForTimeout(800);
    check('repeat visit: no first-run card and nothing modal', !(await n.$eval('#guide', (e) => e.open)) && !(await n.$('dialog[open]')));
    const n2 = await c2.newPage(); n2.on('pageerror', (e) => errs.push('onb2: ' + e.message)); await route(n2); await me(n2, { u: 'second', name: 'Second', role: 'member' }); await n2.goto(H + '/backtest.html', { waitUntil: 'load' });
    await n2.waitForSelector('#guide[open]', { timeout: 120000 }).catch(() => {}); check('remembered per member: another member on the same browser still gets the first-run card', await n2.$eval('#guide', (e) => e.open));
    await n2.click('#gd-surprise'); await n2.waitForTimeout(300); await n2.click('dialog.msd button.pri', { timeout: 3000 }).catch(() => {});
    await n2.waitForFunction(() => /Press Play/.test(document.getElementById('gd-title').textContent), null, { timeout: 120000 }).catch(() => {});
    { const sv = await n2.evaluate(() => ({ sym: document.getElementById('sym').value, start: document.getElementById('start').value, tf: document.getElementById('tf').value })), sd = new Date(sv.start + 'Z');
      check('Surprise me loads a liquid market on a recent weekday and moves on to Play', ['xau', 'nas100', 'spx500', 'eurusd', 'gbpusd', 'us30'].includes(sv.sym) && sd.getUTCDay() >= 1 && sd.getUTCDay() <= 5 && sv.tf === '15m' && /Press Play/.test(await txt(n2, '#gd-title')), JSON.stringify(sv)); }
    check('calm: nothing on the page animates forever', await n2.evaluate(() => document.getAnimations().every((a) => a.effect.getTiming().iterations !== Infinity)));
    await n2.emulateMedia({ reducedMotion: 'reduce' }); check('reduced motion: the first-run card does not animate', await n2.$eval('#guide', (e) => getComputedStyle(e).animationName === 'none')); await n2.emulateMedia({ reducedMotion: null });
    await c2.close();
    const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const t = await c3.newPage(); t.on('pageerror', (e) => errs.push('touch: ' + e.message)); await route(t); await me(t, { u: 'phone', name: 'Phone', role: 'member' });
    await t.goto(H + '/backtest.html', { waitUntil: 'load' }); await t.waitForSelector('#guide[open]', { timeout: 5000 }).catch(() => {});
    await settle(t);   // the card scales in over 180 ms: measured during that, every 44 px control reads 43 px
    const tg = await t.evaluate(() => { const sm = [...document.querySelectorAll('#guide button, #guide select, #guide input, #jbody .ea .btn, #pf .pf-empty .btn, #welcome .btn, #hk-btn')].filter((e) => e.getClientRects().length).map((e) => [e.id || e.textContent.trim().slice(0, 14), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44); const r = document.getElementById('guide').getBoundingClientRect(); return { sm, l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom), vh: innerHeight, sw: document.documentElement.scrollWidth }; });
    check('phone (touch, 390 px): the first-run card fits, no sideways scroll, every new control is 44 px or taller', tg.l >= 8 && tg.r <= 382 && tg.b <= tg.vh && !tg.sm.length && tg.sw <= 391, JSON.stringify(tg));
    await c3.close(); }
  // 30. the replay's own timeframe, changed in the middle of a session (11 Nov 2026). The moment stays, the account is not touched,
  // a candle that has not ended shows as forming from replayed prices only (checked against candles fetched apart from the page),
  // one step completes it with each price through the engine once, a lower timeframe shows closed candles only, Undo starts again,
  // a reload brings the forming candle back, too many candles is refused in words, and a session saved before this still loads.
  { const cx = await b.newContext({ viewport: { width: 1500, height: 950 } }); const q = await cx.newPage(); q.on('pageerror', (e) => errs.push('tf: ' + e.message)); q.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('tf console: ' + m.text()); });
    await route(q); await me(q, OWNER); await q.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('btLab:onb:owner', 'done'); sessionStorage.setItem('init', '1'); } });
    await q.goto(H + '/backtest.html', { waitUntil: 'load' }); await q.waitForTimeout(400); await load(q, 'nas100,5m');
    const st = () => q.evaluate(() => ctTf()), idle = () => q.waitForFunction(() => !ctTf().busy, null, { timeout: 120000 });
    const sw = async (tf) => { await q.evaluate(() => window.scrollTo(0, 0)); if (!(await q.$eval('#tfdd', (e) => e.open))) await q.click('#tfdd summary'); await q.click(`#tfsw [data-stf="${tf}"]`); await q.waitForTimeout(60); await idle(); await q.waitForTimeout(250); return st(); };
    // candles fetched apart from the page's own state: the proof of what could be known at a moment
    const raw = (tf, from, to) => q.evaluate(async ([tf, from, to]) => { const r = await fetch(`/md/bars?sym=nas100&tf=${tf}&from=${from}&to=${to}`); return ((await r.json()).bars || []).filter((x) => !x.live && x.time >= from && x.time < to); }, [tf, from, to]);
    const ohlc = (bs) => (bs.length ? { open: bs[0].open, high: Math.max(...bs.map((x) => x.high)), low: Math.min(...bs.map((x) => x.low)), close: bs[bs.length - 1].close } : null);
    const same = (a, o) => !!a && !!o && ['open', 'high', 'low', 'close'].every((k) => Math.abs(a[k] - o[k]) < 1e-9);
    const acctKey = (t) => JSON.stringify([t.acct.balance, t.acct.positions, t.acct.orders, t.acct.closed, t.ch, t.draw]);
    check('timeframe control in the toolbar: shows the session\'s timeframe, ten timeframes inside', await vis(q, '#tfdd') && (await txt(q, '#tf-now')) === '5m' && (await q.$$eval('#tfsw button', (e) => e.map((x) => x.textContent))).join(' ') === '1m 2m 5m 10m 15m 30m 1h 2h 4h D' && await q.$eval('#tfsw [aria-pressed="true"]', (e) => e.dataset.stf) === '5m');
    // a moment 5 minutes into a 15-minute candle, a position with its stop and target, a resting order, a drawing
    for (let i = 0; i < 60; i++) { await q.keyboard.press('ArrowRight'); const t = await st(); if (i > 5 && t.mom % 900 === 300) break; }
    await q.keyboard.press('b'); await q.waitForTimeout(200);
    await q.keyboard.press('Shift+S'); await q.waitForTimeout(120); { const lp = await q.$eval('#o-price', (e) => +e.value); await q.fill('#o-price', (lp + 60).toFixed(1)); await q.waitForTimeout(80); await q.fill('#o-stop', (lp + 140).toFixed(1)); await q.fill('#o-target', (lp - 100).toFixed(1)); await q.waitForTimeout(80); await q.click('#place'); await q.waitForTimeout(200); }
    { await q.evaluate(() => window.scrollTo(0, 0)); await q.click('#drawdd summary'); await q.click('[data-dt=h]'); const bx = await q.$eval('#chart', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); await q.mouse.click(bx.x + bx.w * 0.5, bx.y + bx.h * 0.3); await q.waitForTimeout(200); await q.mouse.move(4, 4); await q.waitForTimeout(100); }
    const t0 = await st(); check('before the switch: one open position with a stop, one resting order, a drawing, some Undo history', t0.acct.positions.length === 1 && t0.acct.positions[0].stop > 0 && t0.acct.orders.length === 1 && t0.acct.orders[0].stop > 0 && t0.draw === 1 && t0.undo > 0 && t0.mom % 900 === 300, JSON.stringify({ p: t0.acct.positions.length, o: t0.acct.orders.length, d: t0.draw, u: t0.undo, m: t0.mom % 900 }));
    // ---- up, mid-candle
    const t1 = await sw('15m'), f1 = t1.forming;
    check('5m → 15m mid-candle: same moment, same last price, the toolbar and the session form say 15m', t1.tf === '15m' && t1.mom === t0.mom && t1.close === t0.close && (await txt(q, '#tf-now')) === '15m' && await q.$eval('#tf', (e) => e.value) === '15m' && await q.$eval('#tfsw [aria-pressed="true"]', (e) => e.dataset.stf) === '15m', JSON.stringify([t1.tf, t1.mom, t0.mom, t1.close, t0.close]));
    check('the switch leaves the account alone: position, entry, stop, target, MFE / MAE, order, drawing identical', acctKey(t1) === acctKey(t0), acctKey(t1).slice(0, 120));
    check('Undo starts again after a switch, and the page says so', t1.undo === 0 && /Undo starts again/.test(await txt(q, '#loadmsg')), await txt(q, '#loadmsg'));
    { const seen = ohlc(await raw('5m', f1 ? f1.start : 0, t1.mom)), rest = f1 ? await raw('5m', t1.mom, f1.start + 900) : [];
      check('no look-ahead going up: the 15m candle that holds the moment is forming, built only from the 5m candles that ended by it', !!f1 && f1.start < t1.mom && t1.mom < f1.start + 900 && f1.restFrom >= t1.mom && same(f1.formed, seen) && same(t1.shownLast, seen) && t1.shownLast.time === f1.start, JSON.stringify({ f: f1 && f1.formed, seen }));
      check('every other candle on the chart ended by the moment, and the chart holds nothing after it', t1.closedEnd <= t1.mom && t1.shown === t1.idx, JSON.stringify([t1.closedEnd, t1.mom, t1.shown, t1.idx]));
      await q.mouse.move(4, 4); await q.waitForTimeout(150); check('the candle is marked "still forming" in the legend and in the toolbar\'s readout', /still forming/.test(await txt(q, '#legend')) && /forming/.test(await txt(q, '#now')), await txt(q, '#legend'));
      // one step: the engine must have processed exactly the two 5m candles after the moment, once
      const ref = await q.evaluate(([a, bars]) => { const c = JSON.parse(JSON.stringify(a)); const acc = Object.assign(BT.newAccount(100000, { commission: c.commission, spread: c.spread, slFirst: c.slFirst }), { balance: c.balance, positions: c.positions, orders: c.orders, nextId: 99 }); BT.advance(acc, null, bars); return JSON.stringify([acc.balance, acc.positions, acc.orders]); }, [t1.acct, rest]);
      await q.keyboard.press('ArrowRight'); await q.waitForTimeout(250); const t2 = await st(), full = ohlc(await raw('15m', f1.start, f1.start + 900));
      check('one step completes the forming candle: the full 15m candle, the moment at its end, nothing forming', !t2.forming && t2.idx === t1.idx && t2.mom === f1.start + 900 && same(t2.shownLast, full) && rest.length === 2, JSON.stringify({ last: t2.shownLast, full, mom: t2.mom }));
      check('the rest of the candle went through the engine exactly once (same positions, MFE / MAE, hold and orders as the two 5m candles)', JSON.stringify([t2.acct.balance, t2.acct.positions, t2.acct.orders]) === ref, ref.slice(0, 160));
      await q.keyboard.press('ArrowLeft'); await q.waitForTimeout(250); const t3 = await st();
      check('Undo brings the forming candle and the account back', !!t3.forming && same(t3.shownLast, seen) && t3.mom === t1.mom && acctKey(t3) === acctKey(t1));
      await q.keyboard.press('ArrowRight'); await q.waitForTimeout(150); await q.keyboard.press('ArrowRight'); await q.waitForTimeout(250); }
    // ---- down
    const t4 = await st(), t5 = await sw('1m');
    { const near = await raw('1m', t4.mom - 600, t4.mom + 600), lastClosed = near.filter((x) => x.time + 60 <= t4.mom).pop();
      check('15m → 1m: same moment and price, the account untouched, nothing forming', t5.tf === '1m' && t5.mom === t4.mom && t5.close === t4.close && !t5.forming && acctKey(t5) === acctKey(t4), JSON.stringify([t5.mom, t4.mom, t5.close, t4.close]));
      check('no look-ahead going down: only 1m candles that closed by the moment are on the chart', t5.closedEnd === t5.mom && t5.shown === t5.idx && !!lastClosed && t5.shownLast.time === lastClosed.time && same(t5.shownLast, lastClosed) && near.some((x) => x.time >= t4.mom), JSON.stringify([t5.shownLast, lastClosed])); }
    for (let i = 0; i < 3; i++) { await q.keyboard.press('ArrowRight'); } await q.waitForTimeout(200);
    // ---- up again, cut on one-minute candles; the extra charts follow
    const t6 = await st(), t7 = await sw('1h'), f7 = t7.forming;
    { const seen = ohlc(await raw('1m', f7 ? f7.start : 0, t7.mom));
      check('1m → 1h three minutes into the hour: forming from one-minute candles, same moment, account untouched', !!f7 && f7.g === 60 && t7.mom === t6.mom && t7.close === t6.close && same(t7.shownLast, seen) && acctKey(t7) === acctKey(t6) && t7.closedEnd <= t7.mom, JSON.stringify({ f: f7 && f7.formed, seen }));
      await q.click('#splitdd summary'); await q.click('#splitdd [data-split="3"]'); await q.waitForTimeout(600);
      await q.$$eval('.xp-tf', (els) => { els[0].value = '5m'; els[0].dispatchEvent(new Event('change')); els[1].value = '4h'; els[1].dispatchEvent(new Event('change')); });
      await q.waitForFunction(() => ctSplit().panes.length === 2 && ctSplit().panes.every((P) => P.n > 5 && !/Loading/.test(P.title)), null, { timeout: 60000 }).catch(() => {}); await q.waitForTimeout(300);
      const sp = await q.evaluate(() => ctSplit()), lo = sp.panes[0], hi = sp.panes[1];
      check('split view while the first chart\'s candle forms: the 5m pane ends at or before the moment, the 4h pane forms from replayed prices', sp.forming && lo && hi && lo.rel === 'lower' && lo.last.time + 300 <= sp.mom && lo.last.time + 600 > sp.mom && hi.rel === 'higher' && hi.last.close === sp.close && Math.abs(hi.last.high - hi.hi) < 1e-9 && Math.abs(hi.last.low - hi.lo) < 1e-9, JSON.stringify({ mom: sp.mom, lo: lo && lo.last, hi: hi && hi.last }));
      await q.screenshot({ path: OUT + 'ct-tf-forming-split.png' });
      await q.click('#splitdd summary'); await q.click('#splitdd [data-split="1"]'); await q.waitForTimeout(300); await q.screenshot({ path: OUT + 'ct-tf-forming.png' }); }
    // ---- a reload brings the same forming candle back
    await q.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await q.reload({ waitUntil: 'load' }); await q.waitForFunction(() => /Resumed|Could not/.test(document.getElementById('loadmsg').textContent), null, { timeout: 120000 }).catch(() => {}); await q.waitForTimeout(600);
    { const t8 = await st(); check('reload: the session comes back on 1h at the same moment with the same forming candle and account', t8.tf === '1h' && t8.mom === t7.mom && !!t8.forming && same(t8.shownLast, t7.shownLast) && acctKey(t8) === acctKey(t7), JSON.stringify([t8.tf, t8.mom, t7.mom, !!t8.forming])); }
    // ---- keyboard
    await q.keyboard.press('.'); await q.waitForFunction(() => !ctTf().busy && ctTf().tf === '2h', null, { timeout: 60000 }).catch(() => {}); const t9 = await st();
    await q.keyboard.press(','); await q.waitForFunction(() => !ctTf().busy && ctTf().tf === '1h', null, { timeout: 60000 }).catch(() => {}); const t10 = await st();
    check('keys . and , step the timeframe up and down (same moment, same account); Help lists them', t9.tf === '2h' && t10.tf === '1h' && t9.mom === t7.mom && t10.mom === t7.mom && acctKey(t9) === acctKey(t7) && acctKey(t10) === acctKey(t7) && /timeframe lower \/ higher/.test(await q.$eval('#hk', (e) => e.textContent)), JSON.stringify([t9.tf, t10.tf]));
    // ---- playing through a forming candle, then a day candle cut on finer candles: stops and targets inside it are taken once
    await q.click('.speed [data-sp="80"]'); await q.keyboard.press(' '); await q.waitForFunction((i) => ctTf().idx >= i + 2, t10.idx, { timeout: 20000 }).catch(() => {}); await q.keyboard.press(' '); await q.waitForTimeout(300);
    { const t11 = await st(); check('Play runs through the forming candle and on', !t11.forming && t11.idx >= t10.idx + 2 && t11.closedEnd === t11.mom, JSON.stringify([t11.idx, t10.idx, !!t11.forming]));
      const t12 = await sw('1d'), f12 = t12.forming, n0 = t12.acct.closed + t12.acct.positions.length + t12.acct.orders.length;
      check('→ 1 day: the day shows only what has been replayed of it; every trade keeps its stop', !!f12 && same(t12.shownLast, f12.formed) && t12.mom === t11.mom && acctKey(t12) === acctKey(t11) && t12.acct.positions.every((x) => x.stop > 0) && t12.acct.orders.every((x) => x.stop > 0) && (f12.full.high > f12.formed.high || f12.full.low < f12.formed.low || f12.rest > 0), JSON.stringify(f12 && { formed: f12.formed, full: f12.full, rest: f12.rest }));
      await q.keyboard.press('ArrowRight'); await q.waitForTimeout(400); const t13 = await st();
      check('one step completes the day: its finer candles ran through the engine, no trade lost or doubled', !t13.forming && t13.mom === f12.start + 86400 && same(t13.shownLast, f12.full) && t13.acct.closed + t13.acct.positions.length + t13.acct.orders.length === n0 && new Set(t13.acct.positions.map((x) => x.id)).size === t13.acct.positions.length, JSON.stringify([t13.mom, t13.acct.closed, t13.acct.positions.length, t13.acct.orders.length, n0])); }
    // ---- back to where it started, and a session saved before this change (no moment in it) still loads
    { const t14 = await sw('5m'); check('back on 5m: aligned, nothing forming, the candles are the ones the session started with', t14.tf === '5m' && !t14.forming && t14.closedEnd === t14.mom && t14.bars >= t0.bars && t14.from === t0.from, JSON.stringify([t14.bars, t0.bars]));
      await q.evaluate(() => { window.dispatchEvent(new Event('pagehide')); const A = JSON.parse(localStorage.getItem('btLab:sessions')); for (const k of Object.keys(A)) { delete A[k].mom; } localStorage.setItem('btLab:sessions', JSON.stringify(A)); });
      const had = await q.evaluate(() => Object.values(JSON.parse(localStorage.getItem('btLab:sessions'))).every((s) => !('mom' in s) && s.idx > 0));
      await q.evaluate(() => { addEventListener('pagehide', (e) => e.stopImmediatePropagation(), true); }); await q.reload({ waitUntil: 'load' }); await q.waitForFunction(() => /Resumed|Could not/.test(document.getElementById('loadmsg').textContent), null, { timeout: 120000 }).catch(() => {}); await q.waitForTimeout(500); const t15 = await st();
      check('a session saved before this change (index only) loads at the same bar with the same account', had && t15.tf === '5m' && t15.idx === t14.idx && t15.mom === t14.mom && !t15.forming && acctKey(t15) === acctKey(t14), JSON.stringify([had, t15.idx, t14.idx])); }
    // ---- too many candles: refused in words, nothing changes
    await q.click('#tb-sess'); await q.waitForTimeout(300); await q.click('#quick [data-q^="xau,15m"]'); await q.click('dialog.msd button.pri', { timeout: 4000 }).catch(() => {});
    await q.waitForFunction(() => ctTf().tf === '15m' && ctTf().bars > 1000, null, { timeout: 120000 }).catch(() => {}); await q.waitForTimeout(400);
    { const a = await st(); await q.click('#tfdd summary'); await q.click('#tfsw [data-stf="1m"]'); await q.waitForTimeout(400); await idle(); const z = await st(), msg = await txt(q, '#loadmsg');
      check('30 days on 1m is refused plainly ("load fewer days") and the session stays as it was', a.tf === '15m' && z.tf === '15m' && z.mom === a.mom && z.idx === a.idx && /Too many 1 minute candles/.test(msg) && /load fewer days/.test(msg), msg);
      const y = await sw('4h'); check('the same session goes up to 4h', y.tf === '4h' && y.mom === a.mom && y.close === a.close, JSON.stringify([y.tf, y.mom, a.mom])); }
    // ---- themes: the new control and its panel pass AA; nothing under 12 px
    { const AA = String.raw`(() => { const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); return m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); }; const bgOf = (e) => { for (let x = e; x; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; if (b && /^rgb/.test(b) && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/,\s*0\.\d+\)$/.test(b)) return b; } return getComputedStyle(document.body).backgroundColor; }; const L = (x) => 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]; const out = []; let n = 0; for (const e of document.querySelectorAll('#tf-now, #tfsw button, .tfp small, .tfp kbd, #legend .lg-f, .tf-mid, #tb-sess b')) { if (!e.getClientRects().length || !e.textContent.trim()) continue; n++; const cs = getComputedStyle(e), a = L(lum(cs.color)), z = L(lum(bgOf(e))), r = (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05), fs = parseFloat(cs.fontSize); if (r < 4.5 || fs < 12) out.push((e.id || e.className || e.tagName) + ' ' + e.textContent.trim().slice(0, 12) + ' ' + r.toFixed(2) + ' ' + fs + 'px'); } return { bad: out, n }; })()`;
      const bad = []; for (const th of ['dark', 'light', 'midnight']) { await q.evaluate((t) => { document.documentElement.dataset.theme = t; }, th); await q.evaluate(() => { document.getElementById('tfdd').open = true; });   /* the chips' 120 ms colour transition runs when the panel opens: measured() waits for it */ bad.push(...(await measured(q, AA, 'timeframe control text')).map((x) => th + ': ' + x)); if (th === 'light') await q.screenshot({ path: OUT + 'ct-tf-panel-light.png' }); }
      check('timeframe control, its panel and the forming tag: AA contrast and 12 px or more in dark, light and midnight', !bad.length, bad.slice(0, 6).join(' | ')); await q.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.getElementById('tfdd').open = false; }); }
    await cx.close();
    // ---- phone (touch, 390 px)
    const cp = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const m2 = await cp.newPage(); m2.on('pageerror', (e) => errs.push('tf phone: ' + e.message));
    await route(m2); await me(m2, OWNER); await m2.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('btLab:onb:owner', 'done'); sessionStorage.setItem('init', '1'); } });
    await m2.goto(H + '/backtest.html', { waitUntil: 'load' }); await m2.waitForTimeout(400); await load(m2, 'nas100,5m');
    for (let i = 0; i < 4; i++) await m2.tap('#step'); await m2.tap('#qt-buy'); await m2.waitForTimeout(200); const pa = await m2.evaluate(() => ctTf());
    await m2.tap('#tfdd summary'); await m2.waitForTimeout(150);
    const pg = await m2.evaluate(() => { const r = (e) => { const x = e.getBoundingClientRect(); return { l: Math.round(x.left), r: Math.round(x.right), t: Math.round(x.top), b: Math.round(x.bottom), w: Math.round(x.width), h: Math.round(x.height) }; }; return { btn: r(document.querySelector('#tfdd summary')), play: r(document.getElementById('play')), panel: r(document.querySelector('#tfdd .ddp')), small: [...document.querySelectorAll('#tfsw button')].map((e) => r(e)).filter((x) => x.h < 44 || x.w < 44).length, n: document.querySelectorAll('#tfsw button').length, sw: document.documentElement.scrollWidth, vw: innerWidth, fs: Math.min(...[...document.querySelectorAll('#tfdd *')].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))) }; });
    check('phone: the timeframe button sits in the toolbar row, 44 px; its panel fits the screen with ten 44 px chips; no sideways scroll', pg.btn.h >= 44 && pg.btn.w >= 44 && Math.abs((pg.btn.t + pg.btn.b) / 2 - (pg.play.t + pg.play.b) / 2) < 10 && pg.panel.l >= 0 && pg.panel.r <= pg.vw && pg.n === 10 && pg.small === 0 && pg.sw <= pg.vw + 1 && pg.fs >= 12, JSON.stringify(pg));
    await m2.screenshot({ path: OUT + 'ct-tf-phone-panel.png' });
    await m2.tap('#tfsw [data-stf="1h"]'); await m2.waitForTimeout(100); await m2.waitForFunction(() => !ctTf().busy, null, { timeout: 60000 }); await m2.waitForTimeout(400); const pb = await m2.evaluate(() => ctTf());
    check('phone: a tap switches 5m → 1h at the same moment with the position and its stop intact; Skip day is under More', pb.tf === '1h' && pb.mom === pa.mom && pb.close === pa.close && JSON.stringify(pb.acct) === JSON.stringify(pa.acct) && pb.acct.positions.length === 1 && pb.acct.positions[0].stop > 0 && !(await vis(m2, '#skipday')) && await m2.evaluate(() => { document.getElementById('tb-more').click(); const e = document.getElementById('skipday2'), r = e.getBoundingClientRect(); const ok = r.width > 0 && r.height >= 32; document.getElementById('tb-more').click(); return ok; }) && !(await m2.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), JSON.stringify([pb.tf, pb.mom, pa.mom]));
    await m2.screenshot({ path: OUT + 'ct-tf-phone.png' }); await cp.close(); }
  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  for (const r of R) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  ← ' + r.info}`);
  console.log(`\n${R.filter((r) => r.ok).length} / ${R.length} passed`);
  if (NET.length) console.log(`${process.env.GITHUB_ACTIONS ? '::warning::' : 'NOTE: '}ChronosTrade audit: ${NET.length} candle request(s) to meridianx.dev failed after three tries (${[...new Set(NET)].slice(0, 3).join(', ')}): failures above may be the network, not the page`);
  if (R.some((r) => !r.ok)) process.exitCode = 1; // CI (.github/workflows/ci.yml) fails on any FAIL
})().catch((e) => { for (const r of R) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  ← ' + r.info}`); console.error('ABORTED:', e.message.split('\n')[0]); if (NET.length) console.error(`${NET.length} candle request(s) failed after three tries: ${[...new Set(NET)].slice(0, 3).join(', ')}`); process.exit(1); });

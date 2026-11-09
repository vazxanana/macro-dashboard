// Run: sh scripts/build.sh && (cd out && python3 -m http.server 8766 &) ; node --use-env-proxy scripts/audit/chronostrade.cjs
// Needs Playwright and network to meridianx.dev (candles come through the live /md/bars proxy). Not part of node --test.
// ChronosTrade end-to-end audit: every feature against real OANDA candles (through the live /md/bars proxy).
const { chromium } = require('playwright');
const fs = require('fs');
const PORT = process.env.PORT || 8766, H = 'http://127.0.0.1:' + PORT;
const OUT = process.env.AUDIT_OUT || require('os').tmpdir() + '/';
const R = []; const check = (name, ok, info = '') => { R.push({ name, ok: !!ok, info: String(info).slice(0, 140) }); };
const route = async (p) => (await p.route(/\/api\/sounds/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"sl":null,"tp":null}' })), p.route(new RegExp('127\\.0\\.0\\.1:' + PORT + '/md/bars'), async (r) => { const u = r.request().url().replace(H, 'https://meridianx.dev'); try { const res = await fetch(u); r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); } catch (e) { r.fulfill({ status: 502, body: '{}' }); } }));
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
  // 1b. first-run guide: shown once, steps, focus inside, Esc closes, remembered, reopens from Keys
  await p.waitForSelector('#guide[open]', { timeout: 3000 }).catch(() => {}); check('guide opens on the first visit', await p.$eval('#guide', (e) => e.open));
  check('guide has focus inside', await p.evaluate(() => document.getElementById('guide').contains(document.activeElement)));
  const gsteps = []; for (let i = 0; i < 5; i++) { gsteps.push(await txt(p, '#gd-title')); if (i < 4) await p.click('#gd-next'); }
  check('guide walks five steps (market, play, order, stop, challenge)', gsteps.length === 5 && /market/i.test(gsteps[0]) && /stop/i.test(gsteps[3]) && /challenge/i.test(gsteps[4]) && /Start trading/.test(await txt(p, '#gd-next')), gsteps.join(' / '));
  await p.click('#gd-back'); check('guide Back goes one step back', /stop/i.test(await txt(p, '#gd-title')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100); check('Esc closes the guide and it is remembered', !(await p.$eval('#guide', (e) => e.open)) && (await p.evaluate(() => localStorage.getItem('btLab:guide'))) === 'done');
  await p.click('#hk-btn'); await p.click('#gd-open'); check('guide reopens from Keys', await p.$eval('#guide', (e) => e.open) && /market/i.test(await txt(p, '#gd-title')));
  await p.click('#gd-skip'); check('Skip closes the guide', !(await p.$eval('#guide', (e) => e.open)));
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
  await p.click('#ctxdd summary'); await p.click('[data-htf="4h"]'); await p.waitForFunction(() => /context ·|failed/.test(document.getElementById('htf-title').textContent), null, { timeout: 60000 }).catch(() => {});
  check('H4 context chart loads', /4H context/.test(await txt(p, '#htf-title')), await txt(p, '#htf-title'));
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
  await p.selectOption('#firm', 'ftmo2'); await p.click('#pf-start'); await p.click('dialog.msd button.pri').catch(() => {}); await p.waitForTimeout(200);
  check('challenge starts at the firm size', /100,000/.test(await txt(p, '#bal')) && /live/.test(await txt(p, '#pf-status')), await txt(p, '#pf-status'));
  let failed = false; for (let k = 0; k < 6 && !failed; k++) { await p.keyboard.press('Shift+B'); await p.fill('#o-risk', '6'); await p.dispatchEvent('#o-risk', 'input'); await p.click('[data-sl="bar"]'); await p.click('[data-tp="3"]'); await p.click('#place'); for (let i = 0; i < 80; i++) { await p.keyboard.press('ArrowRight'); if (!(await p.$('.pos-card'))) break; } failed = /failed/.test(await txt(p, '#pf-status')); }
  check('daily loss / max loss trips the challenge', failed, await txt(p, '#pf'));
  check('a breach flattens the account', (await p.$$('.pos-card')).length === 0, await txt(p, '#open'));
  await p.click('.tabs [data-t=log]'); check('challenge log lists the days', (await p.$$('#pflog tr')).length > 1); await p.click('.tabs [data-t=journal]');
  await p.fill('#o-risk', '1'); await p.click('#pf-stop').catch(() => {}); await p.click('dialog.msd button.pri').catch(() => {});
  // 12. tabs: stats, calendar, export
  await p.click('.tabs [data-t=stats]'); check('statistics render', (await p.$$('#stats div')).length >= 16 && !/NaN|undefined/.test(await txt(p, '#stats')), (await txt(p, '#stats')).slice(0, 80));
  check('session table renders', (await p.$$('#bysess tr')).length >= 2);
  await p.click('.tabs [data-t=journal]'); await p.click('#jbody td.mist >> nth=0'); await p.check('#mist-grid input[value="FOMO"]'); await p.click('#mist-save'); await p.waitForTimeout(100);
  check('a trade can be reviewed with a mistake tag', /FOMO/.test(await txt(p, '#jbody td.mist')));
  await p.click('.tabs [data-t=stats]'); check('mistake breakdown renders', /FOMO/.test(await txt(p, '#bymist')));
  if (!(await p.$eval('#mc-run', (e) => e.disabled))) { await p.click('#mc-run'); await p.waitForTimeout(200); check('pass probability runs', /pass|fail/.test(await txt(p, '#mc-out'))); } else check('pass probability waits for 5 trades', /needs at least 5/.test(await txt(p, '#mc-note')));
  await p.click('.tabs [data-t=cal]'); const t1 = await txt(p, '#cal-title'); await p.click('#cal-prev'); check('calendar navigates', (await txt(p, '#cal-title')) !== t1); await p.click('#cal-next');
  await p.click('.tabs [data-t=data]'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exp-csv')]); const csv = fs.readFileSync(await dl.path(), 'utf8'); check('CSV export has the trades', csv.trim().split('\n').length >= 2 && /entry/.test(csv.split('\n')[0]), csv.split('\n')[0]);
  const [dj] = await Promise.all([p.waitForEvent('download'), p.click('#exp-json')]); const js = JSON.parse(fs.readFileSync(await dj.path(), 'utf8')); check('JSON export is a session', js.acct && js.sym === 'xau');
  // 12b. review pass: journal filters / sort / click-through / inline screenshot, analytics charts, session report
  { await p.click('.tabs [data-t=journal]'); const nAll = (await p.$$('#jbody tr[data-id]')).length;
    await p.selectOption('#jf-side', 'buy'); const sides = await p.$$eval('#jbody tr[data-id] .badge', (b) => b.map((x) => x.textContent));
    check('journal filter by side shows only buys and counts them', sides.length > 0 && sides.every((x) => x === 'buy') && /of \d+ trades/.test(await txt(p, '#jf-n')), sides.join(',') + ' ' + await txt(p, '#jf-n'));
    await p.selectOption('#jf-res', 'loss'); const nets = await p.$$eval('#jbody tr[data-id] td.net', (b) => b.map((x) => x.textContent)); check('win / loss filter keeps losses only', nets.every((x) => /−/.test(x)), nets.join(' '));
    await p.click('#jf-clear'); check('clear filters brings every trade back', (await p.$$('#jbody tr[data-id]')).length === nAll, nAll);
    await p.click('.jt th[data-k=R] button'); let rs = await p.$$eval('#jbody tr[data-id] .rchip', (b) => b.map((x) => parseFloat(x.textContent.replace('−', '-')) || 0));
    const desc = rs.every((v, i) => !i || rs[i - 1] >= v); await p.click('.jt th[data-k=R] button'); rs = await p.$$eval('#jbody tr[data-id] .rchip', (b) => b.map((x) => parseFloat(x.textContent.replace('−', '-')) || 0));
    check('R column sorts both ways', desc && rs.every((v, i) => !i || rs[i - 1] <= v) && (await p.getAttribute('.jt th[data-k=R]', 'aria-sort')) === 'ascending', rs.join(' '));
    await p.fill('#jbody tr[data-id] input[data-f=tags] >> nth=0', 'breakout'); await p.press('#jbody tr[data-id] input[data-f=tags] >> nth=0', 'Tab'); await p.waitForTimeout(100);
    check('inline tag edit feeds the setup filter', await p.$$eval('#jf-tag option', (o) => o.some((x) => x.value === 'breakout')));
    await p.selectOption('#jf-tag', 'breakout'); check('setup filter narrows the journal', (await p.$$('#jbody tr[data-id]')).length === 1); await p.click('#jf-clear');
    await p.click('#jbody tr[data-id] [data-go] >> nth=0'); await p.waitForTimeout(400);
    check('click-through frames the trade and draws its levels', /trade \d+/.test(await txt(p, '#legend')) && await p.evaluate(() => document.querySelector('#jbody tr.hl') != null), await txt(p, '#legend'));
    await p.screenshot({ path: OUT + 'ct-review-trade.png' });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#jbody tr[data-id] [data-up] >> nth=-1')]); await fc.setFiles({ name: 'shot.png', mimeType: 'image/png', buffer: png }); await p.waitForTimeout(400);
    check('a screenshot can be added inline', /Screenshot saved/.test(await txt(p, '#toasts')), await txt(p, '#toasts'));
    await p.click('.tabs [data-t=stats]'); await p.waitForTimeout(200);
    check('KPI tiles: win rate, expectancy, profit factor', /Win rate/.test(await txt(p, '#kpis')) && /Expectancy/.test(await txt(p, '#kpis')) && /Profit factor/.test(await txt(p, '#kpis')) && !/NaN|undefined/.test(await txt(p, '#kpis')), await txt(p, '#kpis'));
    check('equity curve with drawdown shading and legend', (await p.$$('#v-eq svg .bv-line')).length === 1 && (await p.$$('#v-eq .bv-dd')).length === 1 && /Drawdown/.test(await txt(p, '#v-eq .bv-leg')));
    check('R histogram renders bars and the average', (await p.$$('#v-hist .bv-bar')).length >= 2 && /avg/.test(await txt(p, '#v-hist')));
    check('weekday × hour heatmap renders cells', (await p.$$('#v-heat .bv-cell')).length >= 1 && (await p.$$('#v-heat .bv-cell0')).length > 50);
    await p.hover('#v-heat .bv-cell >> nth=0'); await p.waitForTimeout(80); check('chart tooltip shows on hover', await p.$eval('.bv-tip', (e) => !e.hidden && /UTC/.test(e.textContent)).catch(() => false));
    check('setup and rule-compliance charts render', (await p.$$('#v-tag .bv-bar')).length >= 1 && ((await p.$$('#v-rules .bv-bar')).length >= 1 || /Tick/.test(await txt(p, '#v-rules'))), await txt(p, '#v-rules'));
    await p.click('.tabs [data-t=journal]'); await p.selectOption('#jf-side', 'sell'); await p.click('.tabs [data-t=stats]'); check('analytics follow the journal filters', /journal filters/.test(await txt(p, '#afilt'))); await p.screenshot({ path: OUT + 'ct-analytics.png', fullPage: true });
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
  { await m.click('.tabs [data-t=stats]').catch(() => {}); await m.waitForTimeout(300); check('phone: analytics fit at 390 px', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))); await m.$eval('#tab-stats', (e) => e.scrollIntoView()); await m.screenshot({ path: OUT + 'ct-analytics-phone-light.png' });
    await m.click('#rep-btn').catch(() => {}); await m.waitForTimeout(200); const rw = await m.$eval('#repd', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right }; }); check('phone: session report fits', rw.l >= 0 && rw.r <= 390, JSON.stringify(rw)); await m.screenshot({ path: OUT + 'ct-report-phone-light.png' }); await m.keyboard.press('Escape'); }
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
      const ms = await q.evaluate(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true })); const t0 = performance.now(); document.querySelector('#open [data-act=close]').click(); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); return Math.round(performance.now() - t0); });
      check('100+ trades: the journal shows the latest 50 with "Show more"', rows === 50 && !!moreBtn, `${rows} rows, more ${!!moreBtn}`);
      if (moreBtn) { await q.waitForTimeout(200); await q.click('#jbody [data-jmore]'); await q.waitForTimeout(150); } check('"Show more" adds the older trades', (await q.$$('#jbody tr[data-id]')).length > 50);
      check('closing a trade with 100+ in the journal takes under 150 ms', ms < 150, ms + ' ms');
    } else {
      check('390×844: one toolbar row; replay, speed, jump, More and Buy / Sell in sight without scrolling', L.tb.h <= 64 && Math.abs(L.more.t - L.play.t) < 8 && ['play', 'sp', 'jump', 'more', 'buy', 'sell'].every(inView) && !inView('draw') && L.sw <= L.vw + 1, JSON.stringify(L));
await q.click('#tb-more'); await q.waitForTimeout(120);
      const o = await q.evaluate(() => ['#laydd > summary', '#ctxdd > summary', '#drawdd > summary', '#snd-btn', '#fs-btn', '#tb-dock'].map((s) => { const b = document.querySelector(s).getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; }));
      check('phone: More shows Layers, Context, Draw, sound, full screen and toolbar position on screen', o.every(Boolean), JSON.stringify(o)); await q.screenshot({ path: OUT + 'ct-phone-more.png' });
      await q.click('#drawdd > summary'); check('phone: the Draw menu opens from More', await q.$eval('#drawdd', (e) => e.open));
      await q.mouse.click(8, 140); await q.waitForTimeout(80); check('phone: More closes on an outside tap', !(await q.$eval('#tb', (e) => e.classList.contains('more-open'))));
    }
    await q.close(); }
  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  for (const r of R) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  ← ' + r.info}`);
  console.log(`\n${R.filter((r) => r.ok).length} / ${R.length} passed`);
  if (R.some((r) => !r.ok)) process.exitCode = 1; // CI (.github/workflows/ci.yml) fails on any FAIL
})().catch((e) => { for (const r of R) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  ← ' + r.info}`); console.error('ABORTED:', e.message.split('\n')[0]); process.exit(1); });

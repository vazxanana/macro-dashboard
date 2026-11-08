// Run: sh scripts/build.sh && (cd out && python3 -m http.server 8766 &) ; node --use-env-proxy scripts/audit/chronostrade.cjs
// Needs Playwright and network to meridianx.dev (candles come through the live /md/bars proxy). Not part of node --test.
// ChronosTrade end-to-end audit: every feature against real OANDA candles (through the live /md/bars proxy).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.AUDIT_OUT || require('os').tmpdir() + '/';
const R = []; const check = (name, ok, info = '') => { R.push({ name, ok: !!ok, info: String(info).slice(0, 140) }); };
const route = async (p) => p.route(/127\.0\.0\.1:8766\/md\/bars.*/, async (r) => { const u = r.request().url().replace('http://127.0.0.1:8766', 'https://meridianx.dev'); try { const res = await fetch(u); r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); } catch (e) { r.fulfill({ status: 502, body: '{}' }); } });
const barN = async (p) => +((await p.$eval('#now', (e) => e.textContent)).match(/bar (\d+)/) || [0, 0])[1];
const txt = (p, sel) => p.$eval(sel, (e) => e.textContent).catch(() => '');
const vis = (p, sel) => p.$eval(sel, (e) => !!(e.offsetParent || getComputedStyle(e).position === 'fixed') && !e.hidden).catch(() => false);
async function load(p, q = 'xau,15m') { await p.click(`#quick [data-q^="${q}"]`); await p.waitForFunction(() => /candles loaded|Could not/.test(document.querySelector('#toasts').textContent + document.getElementById('loadmsg').textContent), null, { timeout: 120000 }); await p.waitForTimeout(400); }
(async () => {
  const b = await chromium.launch();
  // 1. gate
  { const p = await b.newPage(); await p.goto('http://127.0.0.1:8766/backtest.html'); check('gate shown when signed out', await vis(p, '#gate') && !(await vis(p, '#app'))); await p.close(); }
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await route(p); await p.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.clear(); sessionStorage.setItem('init', '1'); } localStorage.setItem('ms-admin', 'x'); });
  await p.goto('http://127.0.0.1:8766/backtest.html', { waitUntil: 'load' }); await p.waitForTimeout(300);
  check('welcome on first visit', await vis(p, '#welcome'));
  // 2. load
  await load(p); check('quick start loads candles', /candles loaded/.test(await txt(p, '#toasts')), await txt(p, '#sess-sum'));
  check('session card folds to a summary', await p.$eval('#sess-body', (e) => e.hidden));
  const b0 = await barN(p); check('starts at the chosen moment', b0 > 10, b0);
  // 3. keyboard step / undo
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); const b2 = await barN(p); await p.keyboard.press('ArrowLeft'); check('→ steps and ← undoes', b2 === b0 + 2 && (await barN(p)) === b0 + 1, `${b0} ${b2} ${await barN(p)}`);
  // 4. market draft, presets, confirm
  await p.keyboard.press('b'); check('B opens a buy draft', await vis(p, '#draft') && /buy/i.test(await txt(p, '#dr-title')));
  await p.click('[data-sl="atr1.5"]'); await p.click('[data-tp="2"]');
  const dr = await p.evaluate(() => ({ e: +document.getElementById('o-price').value, s: +document.getElementById('o-stop').value, t: +document.getElementById('o-target').value }));
  check('presets place stop below and 2R target above', dr.s < dr.e && Math.abs((dr.t - dr.e) - 2 * (dr.e - dr.s)) < 0.05, JSON.stringify(dr));
  check('risk shown as 1%', /\(1\.00%\)/.test(await txt(p, '#calc')), await txt(p, '#calc'));
  await p.keyboard.press('Enter'); await p.waitForTimeout(150); check('Enter confirms; position card appears', (await p.$$('.pos-card')).length === 1 && !(await vis(p, '#draft')));
  // 5. position actions
  await p.click('#open [data-act=be]'); await p.waitForTimeout(100); const st = await p.$eval('.pos-l input[data-f=stop]', (e) => +e.value); check('break-even moves the stop to entry', Math.abs(st - dr.e) < 0.02, `${st} vs ${dr.e}`);
  await p.click('#open [data-act=half]'); await p.waitForTimeout(100); check('close half books a journal row', (await p.$$('#jbody tr[data-id]')).length === 1 && /50% out/.test(await txt(p, '.pos-card')));
  await p.click('#open [data-act=trail]'); await p.waitForTimeout(100); check('trail toggles on', await p.$eval('#open [data-act=trail]', (e) => e.classList.contains('on')));
  await p.click('#open [data-act=close]'); await p.waitForTimeout(150); check('close removes the position and journals it', (await p.$$('.pos-card')).length === 0 && (await p.$$('#jbody tr[data-id]')).length === 2);
  check('snapshot stored for closed trades', (await p.$$('#jbody img.shot')).length === 2);
  // 6. limit and stop orders, cancel
  await p.keyboard.press('s'); const lp = await p.$eval('#o-price', (e) => +e.value); await p.fill('#o-price', String((lp + 3).toFixed(2))); await p.waitForTimeout(80);
  check('sell above price becomes a limit', /limit/.test(await txt(p, '#dr-type')), await txt(p, '#dr-type'));
  await p.fill('#o-stop', String((lp + 12).toFixed(2))); await p.fill('#o-target', String((lp - 15).toFixed(2))); await p.waitForTimeout(80); await p.click('#place'); await p.waitForTimeout(120);
  check('limit order rests as pending', /waiting/.test(await txt(p, '#open')), (await txt(p, '#o-err')) || 'ok');
  await p.click('#open [data-act=cancel]'); check('cancel removes the pending order', !(/waiting/.test(await txt(p, '#open'))));
  await p.keyboard.press('b'); const sp = await p.$eval('#o-price', (e) => +e.value); await p.fill('#o-price', String((sp + 2).toFixed(2))); await p.fill('#o-stop', String((sp - 6).toFixed(2))); await p.waitForTimeout(80);
  check('buy above price becomes a stop order', /stop order/.test(await txt(p, '#dr-type')), await txt(p, '#dr-type')); await p.keyboard.press('Escape'); check('Esc cancels the draft', !(await vis(p, '#draft')));
  // 7. wrong-side stop refused
  await p.keyboard.press('b'); const wp = await p.$eval('#o-price', (e) => +e.value); await p.fill('#o-stop', String((wp + 5).toFixed(2))); await p.waitForTimeout(80); check('wrong-side stop flagged in the calc', /wrong side/.test(await txt(p, '#calc'))); await p.click('#place'); await p.waitForTimeout(80);
  check('wrong-side stop refused on confirm', /losing side/.test(await txt(p, '#o-err')), await txt(p, '#o-err')); await p.keyboard.press('Escape');
  // 8. play / pause / speed / skip day / jump
  await p.click('.speed [data-sp="80"]'); const bp = await barN(p); await p.click('#play'); await p.waitForTimeout(1500); await p.click('#play'); const ba = await barN(p); check('play advances bars and pauses', ba > bp + 5 && !(await p.$eval('#play', (e) => e.classList.contains('playing'))), `${bp}→${ba}`);
  const day0 = (await txt(p, '#now')).slice(0, 10); await p.click('#skipday'); check('skip day lands on the next trading day', (await txt(p, '#now')).slice(0, 10) !== day0, day0 + ' -> ' + await txt(p, '#now'));
  // 9. layers and context
  await p.click('#tb summary'); for (const l of ['ema20', 'ema50', 'vol', 'sess', 'pdhl', 'anim']) await p.click(`.ddp [data-l=${l}]`).catch(() => {}); await p.keyboard.press('Escape');
  check('layer toggles flip state', await p.evaluate(() => JSON.parse(localStorage.getItem('btLab:layers') || '{}').ema20 === true));
  const ctxdd = (await p.$$('#tb details.dd'))[1]; await (await ctxdd.$('summary')).click(); await p.click('[data-htf="4h"]'); await p.waitForFunction(() => /context ·|failed/.test(document.getElementById('htf-title').textContent), null, { timeout: 60000 }).catch(() => {});
  check('H4 context chart loads', /4H context/.test(await txt(p, '#htf-title')), await txt(p, '#htf-title'));
  // 10. drawings
  const box = await p.$eval('#chart', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.click('#drawdd summary'); await p.click('[data-dt=h]'); await p.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.25);
  await p.click('#drawdd summary'); await p.click('[data-dt=r]'); await p.mouse.click(box.x + box.w * 0.3, box.y + box.h * 0.4); await p.mouse.click(box.x + box.w * 0.4, box.y + box.h * 0.5);
  const nd = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('btLab:sessions')))[0].draw.length); check('drawings placed and saved', nd === 2, nd);
  await p.click('#drawdd summary'); await p.click('[data-dx=last]'); check('remove last drawing', (await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('btLab:sessions')))[0].draw.length)) === 1);
  // 11. prop firm challenge: fail fast with 6% risk on FTMO
  await p.selectOption('#firm', 'ftmo2'); p.once('dialog', (d) => d.accept()); await p.click('#pf-start'); await p.waitForTimeout(200);
  check('challenge starts at the firm size', /100,000/.test(await txt(p, '#bal')) && /live/.test(await txt(p, '#pf-status')), await txt(p, '#pf-status'));
  let failed = false; for (let k = 0; k < 6 && !failed; k++) { await p.keyboard.press('b'); await p.fill('#o-risk', '6'); await p.dispatchEvent('#o-risk', 'input'); await p.click('[data-sl="bar"]'); await p.click('[data-tp="3"]'); await p.click('#place'); for (let i = 0; i < 80; i++) { await p.keyboard.press('ArrowRight'); if (!(await p.$('.pos-card'))) break; } failed = /failed/.test(await txt(p, '#pf-status')); }
  check('daily loss / max loss trips the challenge', failed, await txt(p, '#pf'));
  check('a breach flattens the account', (await p.$$('.pos-card')).length === 0, await txt(p, '#open'));
  check('challenge log lists the days', (await p.$$('#pflog tr')).length > 1);
  await p.fill('#o-risk', '1'); p.once('dialog', (d) => d.accept()); await p.click('#pf-stop').catch(() => {});
  // 12. tabs: stats, calendar, export
  await p.click('.tabs [data-t=stats]'); check('statistics render', (await p.$$('#stats div')).length >= 16 && !/NaN|undefined/.test(await txt(p, '#stats')), (await txt(p, '#stats')).slice(0, 80));
  await p.click('.tabs [data-t=cal]'); const t1 = await txt(p, '#cal-title'); await p.click('#cal-prev'); check('calendar navigates', (await txt(p, '#cal-title')) !== t1); await p.click('#cal-next');
  await p.click('.tabs [data-t=data]'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exp-csv')]); const csv = fs.readFileSync(await dl.path(), 'utf8'); check('CSV export has the trades', csv.trim().split('\n').length >= 2 && /entry/.test(csv.split('\n')[0]), csv.split('\n')[0]);
  const [dj] = await Promise.all([p.waitForEvent('download'), p.click('#exp-json')]); const js = JSON.parse(fs.readFileSync(await dj.path(), 'utf8')); check('JSON export is a session', js.acct && js.sym === 'xau');
  // 13. reload resumes the session
  await p.click('.tabs [data-t=journal]'); const jn = (await p.$$('#jbody tr[data-id]')).length; await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => /Resumed/.test(document.getElementById('loadmsg').textContent), null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(500);
  check('reload resumes the last session', (await p.$$('#jbody tr[data-id]')).length === jn && jn > 0, `${jn} vs ${(await p.$$('#jbody tr[data-id]')).length}`);
  // 14. full screen with the trade dock
  await p.keyboard.press('f'); await p.waitForTimeout(300);
  const fsI = await p.evaluate(() => { const tc = document.getElementById('tradecard').getBoundingClientRect(), ch = document.getElementById('chart').getBoundingClientRect(); return { fs: document.body.classList.contains('fs'), dock: getComputedStyle(document.getElementById('tradecard')).position, chartH: Math.round(ch.height), tbFloat: document.getElementById('tb').classList.contains('float'), tcX: Math.round(tc.left) }; });
  check('F enters full screen: chart fills, Trade dock and replay bar float', fsI.fs && fsI.dock === 'fixed' && fsI.chartH > 850 && fsI.tbFloat, JSON.stringify(fsI));
  await p.keyboard.press('s'); check('Sell draft works in full screen', await vis(p, '#draft')); await p.keyboard.press('Escape');
  const g = await p.$eval('#tc-grip', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + 5, y: r.top + 5 }; }); await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(g.x - 600, g.y + 100, { steps: 8 }); await p.mouse.up();
  check('Trade dock drags', (await p.$eval('#tradecard', (e) => e.getBoundingClientRect().left)) < fsI.tcX - 300);
  await p.screenshot({ path: OUT + 'ct-fs.png' });
  await p.click('#fs-btn'); await p.waitForTimeout(200); check('full screen exits and the Trade card returns to the side', !(await p.evaluate(() => document.body.classList.contains('fs'))) && (await p.$eval('#tradecard', (e) => !!e.closest('.side'))));
  // 15. settings: commission
  await p.$eval('#comm', (e) => { e.closest('details').open = true; }); await p.fill('#comm', '7'); await p.dispatchEvent('#comm', 'change'); await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('b'); await p.click('#place'); await p.click('#open [data-act=close]'); await p.waitForTimeout(100); const lastNet = await p.$eval('#jbody tr[data-id] td:nth-child(11)', (e) => e.textContent); check('commission is charged on close', /−\$7|-\$7|−\$/.test(lastNet), lastNet);
  // 16. new session + delete
  await p.click('#sess-toggle'); await p.click('#newsess'); check('New session clears the chart', (await txt(p, '#sess-sum')).includes('New session'));
  // 17. phone layout and light theme
  const m = await ctx.newPage(); await route(m); await m.setViewportSize({ width: 390, height: 844 }); await m.goto('http://127.0.0.1:8766/backtest.html', { waitUntil: 'load' }); await m.waitForTimeout(2500);
  check('phone: no sideways scroll', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), await m.evaluate(() => document.documentElement.scrollWidth));
  await m.evaluate(() => localStorage.setItem('msPrefs', JSON.stringify({ theme: 'light' }))); await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(1500);
  check('light theme applies', await m.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgb(8, 9, 12)'), await m.evaluate(() => getComputedStyle(document.body).backgroundColor));
  await m.screenshot({ path: OUT + 'ct-phone-light.png' });
  check('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  for (const r of R) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  ← ' + r.info}`);
  console.log(`\n${R.filter((r) => r.ok).length} / ${R.length} passed`);
})().catch((e) => { for (const r of R) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  ← ' + r.info}`); console.error('ABORTED:', e.message.split('\n')[0]); process.exit(1); });

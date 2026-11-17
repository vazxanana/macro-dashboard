// node --test tests/macro-desk.test.mjs — the strategist's output (council/macro.mjs: macro/forecast.json, events.json,
// history.json). These checks fail when a field a reader shows is renamed or dropped (a page would otherwise go quietly blank).
// The Desk's Council → Macro pane was removed on 17 Nov 2026: the Macro desk is its own page (macro-desk.html), and the
// Council's tab bar keeps a plain link to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../council/macro.mjs';

const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');

test('the Council keeps a plain link to the Macro desk where its tab was; the pane and its script are gone', () => {
  assert.match(html, /<a class="adm c-nav-link" id="ms-cn-macro" href="\/macro-desk"[^>]*>Macro desk<\/a>/);
  assert.doesNotMatch(html, /id="ms-cp-macro"|<script id="ms-md-js">|<style id="ms-md-css">|href="#council\/macro"/);
  assert.match(html, /const CPANES = \['overview', 'trades', 'systems', 'review', 'research', 'week'\]/);
});

// a small synthetic world: weekday candles for every market and the FRED series the drivers read
const DAY = 86400, NOW = Date.UTC(2026, 10, 6, 21, 30) / 1000;   // Fri 6 Nov 2026 21:30 UTC → target Mon 9 Nov
function world() {
  let seed = 11; const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const start = Math.floor(NOW / DAY) * DAY - 700 * DAY, bars = {}, fred = {};
  for (const [k, p0] of Object.entries({ gold: 2000, eurusd: 1.1, usdjpy: 150, nq: 18000, es: 5000, gbpusd: 1.27, usdcad: 1.36, usdchf: 0.88 })) {
    let p = p0; bars[k] = [];
    for (let t = start; t < Math.floor(NOW / DAY) * DAY; t += DAY) { if (!M.weekday(t)) continue; const o = p, c = o * (1 + (r() - 0.48) * 0.02); p = c;
      bars[k].push({ time: t, open: o, high: Math.max(o, c) * 1.002, low: Math.min(o, c) * 0.998, close: c }); }
  }
  for (const [id, v0] of Object.entries({ DFII10: 1.8, DGS2: 4, DGS10: 4.2, T10YIE: 2.3, T10Y3M: 0.2, BAMLH0A0HYM2: 3, VIXCLS: 17, VXVCLS: 19, DTWEXBGS: 120, WALCL: 6.6e6, RRPONTSYD: 300, WTREGEN: 8e5, SOFR: 4.3, EFFR: 4.33 })) {
    let v = v0; fred[id] = []; const step = ['WALCL', 'WTREGEN'].includes(id) ? 7 : 1;
    for (let t = start; t < NOW - DAY; t += step * DAY) { if (step === 1 && !M.weekday(t)) continue; v *= 1 + (r() - 0.5) * 0.02; fred[id].push({ t, v }); }
  }
  const cal = [{ country: 'USD', title: 'CPI m/m', impact: 'High', at: Date.UTC(2026, 10, 10, 13, 30) / 1000, forecast: '0.3%', previous: '0.2%', actual: '' }];
  return { fred, bars, cot: [], cal, rss: [{ src: 'Fed', title: 'Speech', link: 'https://www.federalreserve.gov/x', at: NOW - 3600 }] };
}
const has = (o, path) => path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o) !== undefined;

test('macro desk: every field it reads exists in the strategist output', () => {
  const fc = M.buildForecast(world(), NOW, { src: { 'calendar:nextweek': 'ok (1 events)' } });
  for (const p of ['at', 'target', 'targetEvent', 'brief', 'sources', 'news', 'playbook', 'dxy.pUp', 'dxy.note',
    'regime.label', 'regime.smile', 'regime.carryUnwind', 'regime.vix', 'regime.vixTermRatio', 'regime.liquidity', 'regime.realYield', 'regime.dxyProxy', 'regime.dxy5d',
    'regime.broadUsd20dPct', 'regime.sofrEffrBps', 'regime.curve10y3m', 'regime.us2y', 'regime.eu2y', 'regime.usEu2ySpread',
    'scorecard.method', 'scorecard.volMethod', 'scorecard.replay', 'scorecard.live', 'scorecard.vol', 'scorecard.driverHit']) assert.ok(has(fc, p), p);
  assert.ok(['left', 'trough', 'right', 'mid', null].includes(fc.regime.smile));
  for (const a of ['gold', 'eurusd', 'usdjpy', 'nq', 'es']) {
    const x = fc.assets[a];
    for (const p of ['pUp', 'last', 'expMovePct', 'naiveMovePct', 'volModel', 'volRatio', 'expBasis', 'fit.base', 'fit.b', 'drivers']) assert.ok(has(x, p), `${a}.${p}`);
    for (const d of x.drivers) for (const p of ['k', 'name', 'dir', 'detail']) assert.ok(has(d, p), `${a} driver ${p}`);
    const v = fc.scorecard.vol[a];
    for (const p of ['used', 'picked', 'tried', 'reason', 'full.eventAvgAbs', 'full.otherAvgAbs', 'full.eventDays', 'full.from', 'full.models', 'confirmation.models', 'confirmation.n']) assert.ok(has(v, p), `vol.${a}.${p}`);
    for (const m of Object.values(v.confirmation.models)) for (const p of ['all.mae', 'all.maeNaive', 'event.mae', 'event.maeNaive']) assert.ok(has(m, p), `vol.${a} model ${p}`);
    const re = fc.scorecard.replay[a];
    for (const p of ['n', 'hit', 'base', 'edge', 'pt', 'brier', 'skillClim']) assert.ok(has(re, p), `replay.${a}.${p}`);
  }
  assert.ok(fc.drivers.some((d) => d.k === 'smile'), 'smile driver (its perAsset lean is shown for the current phase)');
  const e = fc.playbook[0];
  assert.ok(e, 'the CPI release lands in the playbook');
  for (const p of ['at', 'country', 'title', 'type', 'consensus', 'previous', 'rule', 'expMovePct.gold', 'oddsBasis', 'scenarios']) assert.ok(has(e, p), `playbook.${p}`);
  for (const s of e.scenarios) for (const p of ['name', 'odds', 'when', 'moves']) assert.ok(has(s, p), `scenario.${p}`);
  for (const p of ['src', 'title', 'link', 'at']) assert.ok(has(fc.news[0], p), `news.${p}`);
});

test('macro desk: history and event-log entries carry what the live log and calendar show', () => {
  const fc = M.buildForecast(world(), NOW, {});
  const H = M.updateHistory([], fc, Date.UTC(2026, 10, 8, 22, 0) / 1000);   // logged from 21:00 UTC the evening before
  assert.ok(H.length > 0);
  for (const p of ['asset', 'target', 'p', 'expAbs']) assert.ok(has(H[0], p), `history.${p}`);
  const L = M.logEvents([], world().cal);
  for (const p of ['key', 'at', 'forecast', 'previous', 'actual']) assert.ok(has(L[0], p), `events.${p}`);
  assert.match(L[0].key, /^USD\|/, 'the desk splits key into country | title');
});

// node --test tests/week-report.test.mjs — the weekly report (market-structure.html, Council → This week, script#ms-wk-js) reads
// trades.json, research.json, ict/*.json, coach.json (proposals, ledger, decay), config.json history, research/robustness.json,
// macro/forecast.json and digest.json. These checks keep the pane wired up and fail when a field the report reads is renamed or
// dropped by the code that writes it (the report would otherwise go quietly blank).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { buildDecay } from '../council/decay.mjs';
import { annotateCosts } from '../council/fills.mjs';
import { syncLedger } from '../council/coach.mjs';
import { main as digestMain, ICT_COST_PTS } from '../council/digest.mjs';
import { buildClaims } from '../research/robustness.mjs';
import * as M from '../council/macro.mjs';

const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const fx = (f) => { const b = fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url)); return JSON.parse(f.endsWith('.gz') ? zlib.gunzipSync(b) : b); };
const has = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o) !== undefined;
function loadWeek() {
  const m = html.match(/<script id="ms-wk-js">([\s\S]*?)<\/script>/); assert.ok(m, 'script#ms-wk-js');
  const W = {}; vm.runInNewContext(m[1], { window: W }); return W.MS_WEEK;
}
const DATA = () => ({ trades: fx('council/trades.json'), research: fx('council/research.json'), coach: fx('council/coach.json'), ictReplay: fx('ict/replay.json.gz'), ictTrades: fx('ict/trades.json.gz') });

test('week report: council tab, pane, section list, quick link and script are wired', () => {
  assert.match(html, /<button type="button" role="tab" class="adm" id="ms-cn-week" data-pane="week" aria-controls="ms-cp-week"/);
  assert.match(html, /<div class="c-grid c-pane c-pane-week adm" id="ms-cp-week" role="tabpanel" aria-labelledby="ms-cn-week" data-pane="week" hidden>/);
  assert.match(html, /const CPANES = \[[^\]]*'week'[^\]]*\]/, 'setPane must know the week pane');
  assert.match(html, /href="#council\/week"/, 'home quick link');
  assert.match(html, /<style id="ms-wk-css">/);
  const js = html.match(/<script id="ms-wk-js">([\s\S]*?)<\/script>/)[1];
  for (const f of ['ict/replay.json', 'ict/trades.json', 'ict/shadow.json', 'ict/snapshot.json', 'research/robustness.json', 'macro/forecast.json', 'digest.json']) assert.ok(js.includes(`get('${f}')`), f);
  for (const k of ['trades', 'research', 'config', 'coach', 'snap', 'health']) assert.ok(js.includes(`${k}: C.${k}`), `reads MS_COUNCIL.${k}`);
  for (const id of ['ms-wk-prev', 'ms-wk-next', 'ms-wk-tiles', 'ms-wk-bars', 'ms-wk-bw', 'ms-wk-rl', 'ms-wk-dec', 'ms-wk-open', 'ms-wk-decay', 'ms-wk-rob']) assert.ok(html.includes(`id="${id}"`), id);
});

test('week report: costs and the live list match the daily digest', () => {
  const MW = loadWeek();
  assert.deepEqual({ ...MW.ICT_COST_PTS }, ICT_COST_PTS, 'ICT micro round trip in step with council/digest.mjs');
  assert.match(src('council/alerts.mjs'), /export const alertable = \(trades, research\) => trades\.filter\(\(x\) => !x\.shadow\)\s*\.concat\(research\.filter\(\(x\) => x\.k === 'nq-open' && !\/-x\$\/\.test\(x\.session \|\| ''\)\)\);/,
    'the report mirrors alertable (live trades.json + NQ open run research trades): keep them in step');
  assert.equal(MW.merNet({ R: 2, Rnet: 1.9 }), 1.9); assert.equal(MW.merNet({ R: 2, costR: 0.1, size: 2 }), 1.8); assert.equal(MW.merNet({ R: -1 }), -1);
  assert.equal(+MW.ictNet({ R: 2, market: 'nq', r0: 13.7 }).toFixed(4), 1.9);
  assert.equal(MW.weekOf(Date.UTC(2026, 10, 8, 23, 59) / 1000), Date.UTC(2026, 10, 2) / 1000, 'Sunday belongs to the week that started Monday');
  assert.equal(MW.weekOf(Date.UTC(2026, 10, 9) / 1000), Date.UTC(2026, 10, 9) / 1000);
});

test('week report: every trade field it reads exists in the Trader and ICT desk records', () => {
  const D = DATA();
  const closed = (x) => ['win', 'loss', 'be'].includes(x.status);
  const mt = D.trades.find((x) => closed(x) && x.pm && x.pm.title);
  assert.ok(mt, 'a closed Meridian trade with its post-mortem');
  for (const p of ['id', 'k', 'name', 'pair', 'market', 'label', 'dec', 'side', 'entry', 'stop', 't1', 'rr', 'opened', 'closed', 'status', 'R', 'note', 'pm.title', 'pm.detail', 'pm.lesson']) assert.ok(has(mt, p), `trades.json ${p}`);
  // costs: council/fills.mjs stamps costR and Rnet on every closed trade
  const [ct] = annotateCosts([{ ...mt }], { [mt.market]: { group: 'Forex' } }, {});
  for (const p of ['costR', 'Rnet']) assert.ok(Number.isFinite(ct[p]), `fills ${p}`);
  assert.ok(D.trades.some((x) => x.status === 'open' || x.status === 'pending'), 'open positions carry status open / pending');
  const rs = D.research.find((x) => closed(x));
  for (const p of ['id', 'k', 'name', 'market', 'label', 'side', 'entry', 'stop', 'opened', 'closed', 'status', 'R', 'note']) assert.ok(has(rs, p), `research.json ${p}`);
  const it = D.ictReplay.trades.find((x) => closed(x) && x.aset);
  for (const p of ['id', 'market', 'short', 'side', 'model', 'entry', 'stop', 'stop0', 'r0', 'opened', 'closed', 'status', 'R', 'aset', 'replay', 'size', 'exit', 'grade.letter', 'feat.session', 'feat.bias', 'feat.zone']) assert.ok(has(it, p), `ict/replay.json trades ${p}`);
  assert.ok(/-r$/.test(it.id), 'replay ids end in -r (the report drops a replay copy of a forward signal by that id)');
  const f = D.ictTrades[0];
  for (const p of ['id', 'market', 'short', 'side', 'entry', 'stop', 'r0', 'opened', 'status', 'grade.letter']) assert.ok(has(f, p), `ict/trades.json ${p}`);
});

test('week report: rule changes, the Coach ledger, decay, robustness, digest and macro carry what it shows', async () => {
  // config.json history: every writer pushes { at, by, change, why }
  for (const f of ['council/trader.mjs']) {
    const pushes = src(f).split('\n').map((l) => (l.match(/history\.push\(\{(.*?)\}\);/) || [])[1]).filter(Boolean);
    assert.ok(pushes.length, `${f} writes config history`);
    for (const p of pushes) for (const k of ['at:', 'by:', 'change', 'why']) assert.ok(p.includes(k), `${f}: history.push({${p.slice(0, 60)} … has ${k}`);
  }
  const at = '2026-11-03T06:00:12.000Z', H = [{ at, by: 'coach-stats', change: 'rintra: only with D1', why: 'against: -0.39R over 5 trades' }, { at: '2026-11-03T07:06:38.000Z', by: 'user', change: 'Research rule set (user)', why: 'owner' }];
  const L = syncLedger([], H, DATA().trades, Date.UTC(2026, 10, 7) / 1000);
  for (const p of ['at', 'change', 'before.n', 'before.exp', 'd30.due']) assert.ok(has(L[0], p), `coach ledger ${p}`);
  const MW = loadWeek(), wk = MW.weekOf(Date.parse(at) / 1000);
  const R = MW.rules({ history: H }, { ledger: L }, wk, wk + MW.WEEK);
  assert.equal(R.length, 2); assert.deepEqual(R.map((r) => r.who).sort(), ['coach', 'you']);
  const c = R.find((r) => r.who === 'coach'); assert.ok(c.before && c.due, 'a Coach change is matched to its ledger entry (at + change)');

  // coach.json decay (council/decay.mjs)
  const D = DATA(), dec = buildDecay({ trades: D.trades, research: D.research, ictTrades: D.ictTrades, ictReplay: D.ictReplay }, { now: Date.UTC(2026, 10, 7) / 1000 });
  assert.ok(dec.systems.length);
  for (const s of dec.systems) for (const p of ['id', 'name', 'desk', 'live', 'status', 'why', 'roll.n', 'roll.exp', 'ref', 'fwd.n']) assert.ok(has(s, p), `decay ${s.id} ${p}`);
  const dd = MW.decisions({ coach: { decay: { systems: [{ ...dec.systems[0], live: true, status: 'decaying' }] }, proposals: [] } }, Date.UTC(2026, 10, 7) / 1000, []);
  assert.equal(dd.length, 1); assert.equal(dd[0].k, 'decay');

  // research/robustness.json claims (research/robustness.mjs buildClaims)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-rob-')); fs.mkdirSync(path.join(dir, 'ict'));
  fs.writeFileSync(path.join(dir, 'ict/replay.json'), JSON.stringify(D.ictReplay));
  const { claims } = buildClaims(dir, { iters: 50, repoOut: path.join(dir, 'none') });
  const a = claims.find((x) => x.id === 'ict-a'); assert.ok(a, 'the ICT A-rule claim');
  for (const p of ['id', 'name', 'status', 'verdict', 'why', 'claim']) assert.ok(has(a, p), `robustness claim ${p}`);
  assert.ok(Array.isArray(a.why));
  const J = { claims }, map = MW.robustMap(J), prev = { ...map, 'ict-a': a.verdict === 'robust' ? 'fragile' : 'robust' };
  const rc = MW.robustChanges(J, prev); assert.equal(rc.length, 1); assert.equal(rc[0].was, prev['ict-a']); assert.equal(rc[0].to, a.verdict);

  // digest.json (council/digest.mjs main): sent.at and the robustness baseline map
  const dd2 = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-dg-'));
  fs.mkdirSync(path.join(dd2, 'research'));
  fs.writeFileSync(path.join(dd2, 'research/robustness.json'), JSON.stringify(J));
  const ok = { ok: true, status: 200, text: async () => '', json: async () => ({ ok: true }) };
  await digestMain(dd2, { env: {}, fetchFn: async () => ok, force: true, now: Date.UTC(2026, 10, 6, 22) / 1000, scoreboard: () => [] });
  const dg = JSON.parse(fs.readFileSync(path.join(dd2, 'digest.json'), 'utf8'));
  for (const p of ['sent.at', 'robust']) assert.ok(has(dg, p), `digest.json ${p}`);
  assert.deepEqual(dg.robust, { ...map }, 'digest.json robust is the same { claim id: verdict } map the report diffs against');
  fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(dd2, { recursive: true, force: true });

  // macro/forecast.json: the regime label and when it was built
  const fc = M.buildForecast({ fred: {}, bars: {}, cot: [], cal: [], rss: [] }, Date.UTC(2026, 10, 6, 21, 30) / 1000, {});
  for (const p of ['at', 'regime.label']) assert.ok(has(fc, p), `forecast ${p}`);
});

test('week report: builds a week from the fixtures (books, systems, best and worst, open positions)', () => {
  const MW = loadWeek(), D = DATA(), all = MW.records(D);
  assert.ok(all.length > 50);
  for (const r of all) { assert.ok(['live', 'shadow', 'research'].includes(r.grp)); assert.ok(Number.isFinite(r.t) && Number.isFinite(r.net) && Number.isFinite(r.R)); }
  const ids = new Set(D.ictTrades.map((x) => x.id)); assert.ok(!all.some((r) => /-r$/.test(r.id) && ids.has(r.id.replace(/-r$/, ''))), 'a forward ICT signal is not counted twice');
  const last = Math.max(...all.filter((r) => r.desk === 'Meridian').map((r) => r.t)), B = MW.build(D, MW.weekOf(last), all);
  assert.ok(B.rows.length && B.rows.every((r) => r.n === r.list.length && r.list.every((t) => t.t >= B.from && t.t < B.to)));
  const tot = B.rows.filter((r) => r.grp === 'live').reduce((s, r) => s + r.net, 0); assert.ok(Math.abs(tot - B.books.live.net) < 0.05, 'book total = sum of its systems');
  for (const g of ['live', 'shadow', 'research']) { assert.ok(B.best[g].every((r) => r.net > 0)); assert.ok(B.worst[g].every((r) => r.net < 0)); }
  const rg = MW.weeks(all, last + 86400); assert.ok(rg.first <= B.from && rg.last >= B.from);
  const O = MW.openNow({ ...D, snap: { markets: { xau: { price: 4000 } } } }); assert.ok(Array.isArray(O.list) && Number.isFinite(O.shadow));
});

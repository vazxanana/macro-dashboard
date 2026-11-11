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
import { main as digestMain, recordVerdicts, ICT_COST_PTS } from '../council/digest.mjs';
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
  // the shared verdict record: both cards read digest.json changes through the pure functions; localStorage only as the fallback
  assert.match(js, /if \(dg && Array\.isArray\(dg\.changes\)\) rc = robustWeek\(D\.robust, dg, B\.from, B\.to, cur\);/, 'robustness changes come from digest.json when it exists');
  assert.match(js, /else if \(D\.robust\) \{ local = localRobust\(robustMap\(D\.robust\)\);/, 'localStorage baseline only without the file');
  assert.match(js, /dc = decayWeek\(Dc, D\.digest, B\.from, B\.to/, 'edge-decay changes come from digest.json');
  assert.ok(js.includes("changesBlock(dc, D.digest, 'decay')") && js.includes("changesBlock(rc, D.digest, 'robust', local)"), 'both cards show a changes block');
});

test('week report: costs and the live list match the daily digest', () => {
  const MW = loadWeek();
  assert.deepEqual({ ...MW.ICT_COST_PTS }, ICT_COST_PTS, 'ICT micro round trip in step with council/digest.mjs');
  assert.match(src('council/alerts.mjs'), /export const alertable = \(trades, research\) => trades\.filter\(\(x\) => !x\.shadow\)\s*\.concat\(research\.filter\(\(x\) => x\.k === 'nq-open' && !x\.shadow && !\/-x\$\/\.test\(x\.session \|\| ''\)\)\);/,
    'the report mirrors alertable (live trades.json + NQ open run research trades, never a research shadow stream): keep them in step');
  assert.match(html, /var nqLive = function \(x\) \{ return x\.k === 'nq-open' && !x\.shadow && !\/-x\$\/\.test\(x\.session \|\| ''\); \};/, 'the report\'s copy of alertable');
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

  // digest.json (council/digest.mjs main): sent.at, the shared verdict record (robust, decay, since) and its change log
  const dd2 = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-dg-'));
  fs.mkdirSync(path.join(dd2, 'research'));
  fs.writeFileSync(path.join(dd2, 'research/robustness.json'), JSON.stringify(J));
  fs.writeFileSync(path.join(dd2, 'coach.json'), JSON.stringify({ decay: dec }));
  const ok = { ok: true, status: 200, text: async () => '', json: async () => ({ ok: true }) };
  await digestMain(dd2, { env: {}, fetchFn: async () => ok, force: true, now: Date.UTC(2026, 10, 6, 22) / 1000, scoreboard: () => [] });
  let dg = JSON.parse(fs.readFileSync(path.join(dd2, 'digest.json'), 'utf8'));
  for (const p of ['sent.at', 'at', 'since', 'robust', 'decay', 'changes']) assert.ok(has(dg, p), `digest.json ${p}`);
  assert.deepEqual(dg.robust, { ...map }, 'digest.json robust is the same { claim id: verdict } map the report diffs against');
  assert.deepEqual(dg.decay, Object.fromEntries(dec.systems.map((x) => [x.id, x.status])), 'digest.json decay is { system id: status }');
  // the Trader's 6-hour hook (recordVerdicts) logs a decay change and the digest logs a robustness change: the report finds both in that week
  const sys0 = dec.systems[0], flipped = { ...dec, systems: [{ ...sys0, status: sys0.status === 'decaying' ? 'healthy' : 'decaying' }, ...dec.systems.slice(1)] };
  fs.writeFileSync(path.join(dd2, 'coach.json'), JSON.stringify({ decay: flipped }));   // as the Trader: coach.json first, then the record
  recordVerdicts(dd2, { robust: J, decay: flipped, now: Date.UTC(2026, 10, 7, 6) / 1000 });
  fs.writeFileSync(path.join(dd2, 'research/robustness.json'), JSON.stringify({ claims: claims.map((c) => c.id === 'ict-a' ? { ...c, verdict: prev['ict-a'] } : c) }));
  await digestMain(dd2, { env: {}, fetchFn: async () => ok, now: Date.UTC(2026, 10, 7, 12) / 1000, scoreboard: () => [] });   // Saturday noon: no digest, the record is kept
  dg = JSON.parse(fs.readFileSync(path.join(dd2, 'digest.json'), 'utf8'));
  assert.equal(dg.sent.day, '2026-11-06'); assert.equal(dg.changes.length, 2);
  for (const c of dg.changes) for (const p of ['at', 'kind', 'id', 'name', 'from', 'to']) assert.ok(has(c, p), `digest.json changes[] ${p}`);
  const wk2 = MW.weekOf(Date.UTC(2026, 10, 7) / 1000), J2 = JSON.parse(fs.readFileSync(path.join(dd2, 'research/robustness.json'), 'utf8'));
  const rw = MW.robustWeek(J2, dg, wk2, wk2 + MW.WEEK, false);
  assert.equal(rw.length, 1); assert.deepEqual([rw[0].id, rw[0].was, rw[0].to, rw[0].name, rw[0].status], ['ict-a', a.verdict, prev['ict-a'], a.name, a.status]); assert.ok(Array.isArray(rw[0].why));
  assert.equal(rw[0].t, Date.UTC(2026, 10, 7, 12) / 1000);
  const dw = MW.decayWeek(flipped, dg, wk2, wk2 + MW.WEEK, false);
  assert.equal(dw.length, 1); assert.deepEqual([dw[0].id, dw[0].was, dw[0].to, dw[0].name, dw[0].live, dw[0].desk], [sys0.id, sys0.status, flipped.systems[0].status, sys0.name, !!sys0.live, sys0.desk]);
  assert.deepEqual(MW.changeLog(dg, 'decay', wk2, wk2 + MW.WEEK).map((c) => c.id), [sys0.id]);
  assert.equal(MW.robustWeek(J2, dg, wk2 - MW.WEEK, wk2, false).length, 0, 'the week before: nothing logged');
  // current week: what the live file shows against the record's last snapshot counts too, once, until the next round logs it
  const J3 = { claims: J2.claims.map((c) => c.id === 'gtrend' || c.id === claims[1].id ? { ...c, verdict: c.verdict === 'robust' ? 'fragile' : 'robust' } : c) };
  const lag = MW.robustWeek(J3, dg, wk2, wk2 + MW.WEEK, true), lagged = lag.filter((c) => c.t === null);
  assert.ok(lagged.length >= 1 && lagged.every((c) => dg.robust[c.id] === c.was && c.to !== c.was)); assert.equal(lag.length, lagged.length + 1);
  assert.equal(MW.robustWeek(J3, dg, wk2, wk2 + MW.WEEK, false).length, 1, 'a past week never diffs the live file');
  const dLag = MW.decayWeek({ ...flipped, systems: flipped.systems.map((x) => x.id === sys0.id ? { ...x, status: 'watch' } : x) }, dg, wk2, wk2 + MW.WEEK, true);
  assert.equal(dLag.length, 2); assert.equal(dLag[0].t, null); assert.equal(dLag[0].to, 'watch');
  // decisions: one entry per live claim even when the week logged several changes for it
  const twice = rw.concat([{ ...rw[0], was: rw[0].to, to: rw[0].was }]).map((c) => ({ ...c, status: 'live (paper)' }));
  assert.equal(MW.decisions({ coach: {} }, Date.UTC(2026, 10, 7, 12) / 1000, twice).filter((d) => d.k === 'robust').length, 1);
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

test('edge-decay chips count what the rows show: live only, "too few" apart from healthy, flagged shadow systems in their own chip (11 Nov)', () => {
  const WK = loadWeek();
  const S = [{ live: true, status: 'healthy' }, { live: true, status: 'healthy', few: true }, { live: true, status: 'healthy' }, { live: true, status: 'watch' },
    { live: true, status: 'decaying' }, { live: false, status: 'decaying' }, { live: false, status: 'healthy' }, { live: false, status: 'watch', few: true }, null];
  assert.deepEqual({ ...WK.decayCount(S) }, { healthy: 2, watch: 1, decaying: 1, few: 1, shadow: 1 });
  assert.deepEqual({ ...WK.decayCount(undefined) }, { healthy: 0, watch: 0, decaying: 0, few: 0, shadow: 0 });
  // on what the Trader really writes: the counts add up to the live systems, and a system marked `few` is never "healthy"
  const D = buildDecay({ trades: [], research: [], ictTrades: [], ictReplay: null, replay: null, now: Date.parse('2026-11-11T12:00:00Z') / 1000 });
  if (D && Array.isArray(D.systems)) { const c = WK.decayCount(D.systems), live = D.systems.filter((s) => s.live);
    assert.equal(c.healthy + c.watch + c.decaying + c.few, live.length); assert.equal(c.few, live.filter((s) => s.few).length); }
  const js = html.match(/<script id="ms-wk-js">([\s\S]*?)<\/script>/)[1];
  assert.match(js, /var c = decayCount\(S\);/); assert.match(js, /too few to judge/); assert.match(js, /shadow flagged/);
});

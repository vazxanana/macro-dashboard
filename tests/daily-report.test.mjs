// The two daily reports: council/daily-report.mjs, the 06:30 notice (api/notify.js) and the Macro desk section (19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { london, londonAt, buildReports, due, merge, calLine, KEEP } from '../council/daily-report.mjs';
const require = createRequire(import.meta.url);
const N = require('../api/notify.js');

const T = (iso) => Date.parse(iso) / 1000;
const fc = { at: '2026-11-20T05:40:00Z', regime: { label: 'Dollar Smile left side (stress) · liquidity flat', smileDetail: 'crisis / dollar-funding stress', vix: 24.6, vixTermRatio: 1.01, realYield: { level: 2.88, chg: 0.1 }, us2y: 4.8, dxyProxy: 104, dxy5d: 0.7, curve10y3m: 0.7, broadUsd20dPct: 0.5 },
  assets: { gold: { last: 3627.5, pUp: 0.51, fit: { base: 0.53 }, expMovePct: 1.39, volRatio: 0.96 }, nq: { last: 26439.7, pUp: 0.48, fit: { base: 0.56 }, expMovePct: 1.67, volRatio: 1.7 } },
  news: [{ src: 'Fed', title: 'Minutes of the FOMC', at: '2026-11-19T19:00:00Z', policy: true }, { src: 'BoJ', title: 'Old item', at: '2026-11-17T07:00:00Z', policy: false }],
  goldScore: { ok: true, score: -0.98 } };
const cache = { cal: [
  { title: 'Retail Sales m/m', country: 'GBP', at: T('2026-11-20T07:00:00Z'), impact: 'High', forecast: '0.3%', previous: '0.1%', actual: '' },
  { title: 'Flash PMI', country: 'EUR', at: T('2026-11-20T09:00:00Z'), impact: 'Medium', forecast: '50.1', previous: '49.8', actual: '' },
  { title: 'Bank Holiday', country: 'JPY', at: T('2026-11-20T00:00:00Z'), impact: 'Holiday', forecast: '', previous: '', actual: '' },
  { title: 'Core PCE m/m', country: 'USD', at: T('2026-11-24T13:30:00Z'), impact: 'High', forecast: '0.2%', previous: '0.3%', actual: '' },
  { title: 'CPI y/y', country: 'CNY', at: T('2026-11-19T01:30:00Z'), impact: 'Medium', forecast: '0.8%', previous: '0.9%', actual: '0.7%' }] };
const vet = { at: '2026-11-20T05:41:00Z', summary: { sentence: 'This week: the macro leans against gold.', levels: { mark: { px: 3627 }, above: { price: 3700, label: 'Round number', crossed: true }, broken: { price: 3720, label: '13-week low' } } },
  outlook: { week: { from: '$3,885', list: [{ claim: 'Gold closes 2026-11-20 above $3,885 (today\'s close)', p: 0.53, baseP: 0.55 }, { claim: 'x (stretch)', p: 0.1, baseP: 0.1 }] } },
  research: { items: [{ text: 'Hikes priced (2-year above the policy rate).' }, { text: 'No stress rule is on.' }] } };
const cot = { at: '2026-11-19T00:00:00Z', study: { verdict: 'FAIL' }, markets: [{ k: 'eur', name: 'Euro', pct: 1, asOf: '2026-11-10' }, { k: 'gold', name: 'Gold', pct: 52, asOf: '2026-11-10' }] };

test('London clock, the 06:30 publish time in both seasons, when to build', () => {
  assert.deepEqual(london(T('2026-11-20T06:30:00Z')).h, 6);
  assert.equal(new Date(londonAt('2026-11-20', 6, 30) * 1000).toISOString(), '2026-11-20T06:30:00.000Z');   // GMT
  assert.equal(new Date(londonAt('2026-07-01', 6, 30) * 1000).toISOString(), '2026-07-01T05:30:00.000Z');   // BST
  assert.equal(due(null, T('2026-11-20T01:00:00Z')), true);                                          // the first file: built at once
  const at6 = { reports: [{ day: '2026-11-19', builtAt: '2026-11-19T07:00:00Z' }] };
  assert.equal(due(at6, T('2026-11-20T05:59:00Z')), false); assert.equal(due(at6, T('2026-11-20T06:00:00Z')), true);
  const early = { reports: [{ day: '2026-11-20', builtAt: '2026-11-20T00:40:00Z' }] };
  assert.equal(due(early, T('2026-11-20T05:00:00Z')), false); assert.equal(due(early, T('2026-11-20T06:01:00Z')), true);   // rebuilt with the morning's data
  assert.equal(due({ reports: [{ day: '2026-11-20', builtAt: '2026-11-20T06:05:00Z' }] }, T('2026-11-20T08:00:00Z')), false);
  assert.equal(due({ reports: [{ day: '2026-11-20', builtAt: '2026-11-20T06:05:00Z' }] }, T('2026-11-20T08:00:00Z'), true), true);
  let f = null; for (let i = 0; i < KEEP + 3; i++) f = merge(f, { day: '2026-11-' + String(i + 1).padStart(2, '0'), builtAt: 'x' });
  assert.equal(f.reports.length, KEEP); assert.equal(f.reports[0].day, '2026-11-17');
});

test('the two reports from the council files', () => {
  const r = buildReports({ fc, vet, cache, cot, snap: { markets: { gbpusd: { label: 'GBP/USD', price: 1.3088, dec: 4 } } }, now: T('2026-11-20T06:05:00Z') });
  assert.equal(r.day, '2026-11-20'); assert.equal(r.publishAt, '2026-11-20T06:30:00.000Z');
  const W = Object.fromEntries(r.world.sections.map((s) => [s.h, s.lines])), M = Object.fromEntries(r.markets.sections.map((s) => [s.h, s.lines]));
  assert.ok(W['The picture'][1].startsWith('Crisis'));
  assert.deepEqual(W['What happened (last 30 hours)'], ['Fed (policy): Minutes of the FOMC', calLine(cache.cal[4])]);
  const today = Object.keys(W).find((k) => k.startsWith('Today')); assert.equal(W[today].length, 2); assert.match(W[today][0], /^High · 07:00 · United Kingdom · Retail Sales m\/m · expected 0\.3%, previous 0\.1%$/);
  assert.match(W['Later this week'][0], /Core PCE/); assert.ok(W['What we expect'].some((l) => /Hikes priced/.test(l)) && !W['What we expect'].some((l) => /No stress/.test(l)));
  assert.match(r.world.lead, /Today: United Kingdom Retail Sales m\/m at 07:00 London/);
  assert.match(M['Where markets stand'][0], /^Gold 3,627\.5: 51% chance of closing the day higher \(usual 53%\)/); assert.match(M['Where markets stand'][1], /1\.7x its usual/);
  assert.match(M["This week's odds (gold)"][0], /the \$3,885 close it was issued from/); assert.equal(M["This week's odds (gold)"].length, 2); assert.match(M["This week's odds (gold)"][1], /gold has moved −6\.6% since/);
  assert.match(M['Positioning (CFTC)'][0], /the euro .* bottom .*\(1st percentile/); assert.match(M['Positioning (CFTC)'][1], /context, not a signal/);
  assert.match(r.markets.lead, /Strongest macro lean: Nasdaq 100 down/);
  const all = JSON.stringify(r); for (const w of ['gtrend', 'geg', 'replica', 'mcycle', 'shadow', 'londonstrategicedge']) assert.ok(!all.includes(w), w);
  assert.match(r.note, /none is a tested edge/);
  const weekend = buildReports({ fc, vet, cache: { cal: [] }, cot, snap: null, now: T('2026-11-21T06:10:00Z') });
  assert.match(weekend.world.sections.find((s) => s.h.startsWith('Today')).lines[0], /^Weekend/);
  assert.ok(buildReports({ fc: null, vet: null, cache: null, cot: null, snap: null, now: T('2026-11-20T06:10:00Z') }).markets.lead.includes('not available'));
});

test('the notice: once a day, from 06:30, macro accounts only', async () => {
  const file = { reports: [{ day: '2026-11-20', publishAt: '2026-11-20T06:30:00.000Z', world: { lead: 'W lead' }, markets: { lead: 'M lead' } }] };
  assert.equal(N.dailyNotice(file, [], Date.parse('2026-11-20T06:29:00Z')), null);
  const it = N.dailyNotice(file, [], Date.parse('2026-11-20T06:30:05Z'));
  assert.equal(it.id, 'daily-2026-11-20'); assert.equal(it.perm, 'macro'); assert.equal(it.link, '/macro-desk#s-daily'); assert.match(it.body, /^World economy: W lead\nMarkets: M lead$/);
  assert.equal(N.dailyNotice(file, [it], Date.parse('2026-11-20T06:40:00Z')), null);
  assert.equal(N.dailyNotice(file, [], Date.parse('2026-11-20T09:31:00Z')), null);   // over 3 h late: not announced
  assert.equal(N.allowed({ u: 'owner' }, 'macro'), true); assert.equal(N.allowed({ u: 'luxus', perms: {} }, 'macro'), true);
  assert.equal(N.allowed({ u: 'carlos', perms: { macro: false } }, 'macro'), false); assert.equal(N.allowed(null, 'macro'), false);
  const mk = () => ({ code: 0, body: null, headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
  const list = [{ id: 'a', at: '2026-11-19T10:00:00Z', title: 'Hello' }, { ...it }];
  const store = { get: async () => list, put: async () => {} }, env = { BLOB_READ_WRITE_TOKEN: 'x' };
  for (const [who, n] of [[{ u: 'owner' }, 2], [{ u: 'fred', perms: {} }, 2], [{ u: 'carlos', perms: { macro: false } }, 1]]) {
    const res = mk(); await N.handle({ method: 'GET', query: {}, headers: {} }, res, { env, store, who: async () => who }); assert.equal(res.body.items.length, n, who.u); }
});

test('wiring: the loop, the Worker chain, the bell link, the Macro desk section, data health', () => {
  const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.match(rd('.github/workflows/council.yml'), /timeout 30 node council\/daily-report\.mjs data \|\| echo/);
  assert.match(rd('cloudflare/src/worker.mjs'), /'\/api\/daily\?job=daily'/); assert.match(rd('cloudflare/src/worker.mjs'), /import daily from '\.\.\/\.\.\/api\/daily\.js'/);
  const ms = rd('market-structure.html'); assert.ok(ms.includes('nt-go') && ms.includes("/^\\/[\\w\\-./#?=&]*$/.test(x.link)"));
  const md = rd('macro-desk.html'); assert.ok(md.includes('id="s-daily"') && md.includes("get('macro/daily-report.json')") && md.includes('renderDaily(dr)') && md.includes('href="#s-daily"'));
  assert.ok(rd('council/datahealth.mjs').includes("file: 'macro/daily-report.json'"));
});

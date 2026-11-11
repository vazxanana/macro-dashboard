// node --test tests/macro-visual.test.mjs — the Macro desk's charts (9 Nov 2026, owner: "more visual… more simpler"): the
// fields the charts read (Gold Macro Score weekly history, the analogs' forward gold paths, the calls' hit rate by week) and the
// page wiring (chart hosts, the shared tooltip, n/a for missing data, themes and reduced motion).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { goldMacroScore, HIST_WEEKS } from '../council/macroscore.mjs';
import * as B from '../council/briefing.mjs';
import { callsByWeek, callsScore } from '../council/outlook.mjs';

const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const html = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');

test('goldMacroScore: hist carries up to 26 weekly [Friday, score] pairs ending at the score week', () => {
  let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5; };
  const mk = (base, sc) => { const out = []; let v = base; for (let d = T('2006-01-02'); d <= T('2026-11-06'); d += DAY) { const w = new Date(d * 1000).getUTCDay(); if (w >= 1 && w <= 5) { v += rnd() * sc; out.push({ t: d, v }); } } return out; };
  const s = goldMacroScore({ ry: mk(1, 0.05), y2: mk(3, 0.05), y10: mk(3.5, 0.05), dxy: mk(100, 0.3) }, { asOf: T('2026-11-06') });
  assert.ok(s.ok, JSON.stringify(s));
  assert.equal(HIST_WEEKS, 26); assert.equal(s.hist.length, 26);
  assert.deepEqual(s.hist.at(-1), [s.asOf, s.score], 'the last point is this week');
  assert.deepEqual(s.hist.slice(-6).map((x) => x[1]), s.path, 'the 6-week path is the tail of the history');
  for (let i = 1; i < s.hist.length; i++) assert.equal(T(s.hist[i][0]) - T(s.hist[i - 1][0]), 7 * DAY, 'consecutive Fridays');
});

test('analogs: each pick carries its 20-session gold path, consistent with the +5 / +20 / min / max outcomes', () => {
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const START = T('2008-01-01'), END = T('2026-11-06');
  const walk = (v0, step, add) => { const out = []; let v = v0; for (let t = START; t <= END; t += DAY) { const d = new Date(t * 1000).getUTCDay(); if (d === 0 || d === 6) continue; v = add ? v + (rnd() - 0.5) * step : v * (1 + (rnd() - 0.5) * step); out.push({ t, v }); } return out; };
  const A = B.findAnalogs({ gold: walk(900, 0.024), dxy: walk(80, 0.008), spx: walk(1400, 0.025), ry: walk(1.5, 0.06, true), y2: walk(2, 0.06, true) }, END + 22 * 3600);
  assert.ok(A && A.top.length >= 10);
  for (const t of A.top) {
    assert.equal(t.path.length, 20);
    assert.ok(Math.abs(t.path[4] - t.gold5) < 0.011, `${t.date} +5`); assert.ok(Math.abs(t.path[19] - t.gold20) < 0.011, `${t.date} +20`);
    assert.ok(Math.abs(Math.max(...t.path) - t.max20) < 0.011 && Math.abs(Math.min(...t.path) - t.min20) < 0.011, `${t.date} range`);
  }
});

test('callsByWeek: scored calls grouped by the Monday of their due week, with running hit rate and expected', () => {
  const L = [
    { by: '2026-11-13', p: 0.6, hit: true }, { by: '2026-11-12', p: 0.4, hit: false }, { by: '2026-11-20', p: 0.5, hit: true },
    { by: '2026-11-20', p: 0.7, hit: null }, { by: 'bad', p: 0.5, hit: true },
  ];
  const W = callsByWeek(L);
  assert.deepEqual(W.map((w) => w.week), ['2026-11-09', '2026-11-16']);
  assert.deepEqual(W[0], { week: '2026-11-09', n: 2, hit: 0.5, expected: 0.5, cumN: 2, cumHit: 0.5, cumExpected: 0.5 });
  assert.deepEqual(W[1], { week: '2026-11-16', n: 1, hit: 1, expected: 0.5, cumN: 3, cumHit: 0.67, cumExpected: 0.5 });
  assert.deepEqual(callsByWeek([]), []);
  assert.equal(callsScore(L.slice(0, 4).map((r) => (r.hit == null ? r : { ...r, brier: (r.p - (r.hit ? 1 : 0)) ** 2 }))).weekly.length, 2, 'callsScore carries it');
  assert.equal(callsScore([{ by: '2026-11-13', p: 0.5, hit: null }]).weekly, undefined, 'nothing scored: no series (the desk shows its empty state)');
});

test('desk: chart hosts, one shared tooltip on hover, tap and focus, n/a for missing data', () => {
  for (const id of ['c-score', 'score-spark', 'score-drv', 'c-ladder', 'ladder', 'an-mult', 'cot-gauges', 'calls-hist', 'vz-tip']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /function sparkSvg\(/); assert.match(html, /function driversHtml\(/); assert.match(html, /function ladderSvg\(/);
  assert.match(html, /function hypBars\(/); assert.match(html, /function analogMultiples\(/); assert.match(html, /function cotGauges\(/); assert.match(html, /function hitRateSvg\(/);
  // thresholds marked and labelled on the score sparkline
  assert.match(html, /\+0\.25/); assert.match(html, /\+0\.5\b/);
  // the tooltip answers pointer hover, tap (click) and keyboard focus, and Escape closes it
  for (const ev of ['pointerover', 'click', 'focusin', 'keydown']) assert.ok(html.includes(`'${ev}'`), ev);
  assert.match(html, /not a tested edge/i, 'analogs are labelled descriptive');
  assert.match(html, /var NA = 'n\/a'/, 'missing values read n/a');
  assert.ok(html.includes("get('macro/veteran-calls.json')") || html.includes('weekly'), 'hit rate over time reads the scored calls');
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /:root\[data-theme="midnight"\]/);
  assert.doesNotMatch(html, /font[^;]*\b(9|10|10\.5|11|11\.5)px/, 'no text under 12px');
});

test('desk calm pass: one story top to bottom, a staleness stamp, COT says when there is no tested edge', () => {
  const order = ['s-week', 's-next', 's-why', 's-price', 's-expect', 's-track', 's-deep'].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), 'This week → Next release → Why → Where price sits → What he expects → Track record → the detail');
  for (const [card, sec] of [['c-glance', 's-week'], ['c-next', 's-next'], ['c-score', 's-why'], ['c-ins', 's-why'], ['c-ladder', 's-price'], ['c-brief', 's-expect'], ['c-calls', 's-track'], ['c-calib', 's-track']]) {
    const s = html.indexOf(`id="${sec}"`), c = html.indexOf(`id="${card}"`), e = html.indexOf('</section>', s); assert.ok(c > s && c < e, `${card} sits in ${sec}`);
  }
  assert.ok(html.indexOf('id="c-changes"') > html.indexOf('id="c-glance"') && html.indexOf('id="c-changes"') < html.indexOf('id="s-next"'), 'what changed folds under the glance');
  assert.match(html, /<nav class="toc"/); assert.match(html, /function syncStory\(/); assert.match(html, /id="stamp"/);
  assert.match(html, /STALE_MIN = 90/); assert.match(html, /Stale: last update/);
  assert.match(html, /m\.edgeStatus/); assert.match(html, /m\.edgeText/); assert.match(html, /'no tested edge'/);
  assert.match(html, /details\.fold > summary \{[^}]*min-height: 44px/, 'folds are 44 px targets');
  assert.doesNotMatch(html, /infinite/, 'no infinite animation on the page');
});

// Simple phone view (11 Nov 2026, owner: "On the mobile there's too much, we need a simpler version for the phone")
test('desk simple phone view: set before the first paint with the Desk\'s key, phone-only rules, Full view untouched', () => {
  const head = html.slice(0, html.indexOf('<style>'));
  assert.match(head, /matchMedia\('\(max-width: 640px\)'\)/, 'decided in the head, before the styles');
  assert.match(head, /localStorage\.getItem\('ms-phone'\) === 'full'/, 'the same key as the Desk: one choice covers the site');
  assert.match(head, /R\.dataset\.phone = 'simple'; else delete R\.dataset\.phone/);
  assert.match(head, /window\.msPhoneView = function/);
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const at = css.indexOf('Simple phone view'), blockAt = css.indexOf('@media (max-width: 640px) {', at);
  assert.ok(at > 0 && blockAt > at);
  assert.equal(css.indexOf('data-phone'), css.indexOf('data-phone', at), 'no rule about the phone view before its own block');
  assert.equal(css.slice(at, blockAt).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[\s\S]*?\*\//, '').trim(), '.ps-sw, .st-go, .g-more { display: none; }', 'outside the phone query the new controls do not exist');
  // every rule of the block is the switch itself or sits under the attribute, and the block runs to the end of the sheet
  const block = css.slice(blockAt + '@media (max-width: 640px) {'.length).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(block, /\}\s*\}\s*$/, 'the phone block is the last thing in the sheet');
  const sels = block.replace(/\}\s*$/, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
  assert.ok(sels.length > 30);
  for (const s of sels) for (const one of s.split(/,(?![^(]*\))/)) assert.ok(/^html\[data-phone="simple"\] /.test(one.trim()) || /\.ps-sw|^\.g-more:focus-visible$/.test(one.trim()), 'phone rule outside the simple view: ' + one);
  assert.doesNotMatch(block, /\.toc\b/, 'the section chips stay desktop-only');
  assert.doesNotMatch(block, /animation|transition/, 'no new motion');
  assert.match(block, /html\[data-phone="simple"\] \.sfold:not\(\.open\) > :not\(\.st-h\) \{ display: none !important; \}/);
});

test('desk simple phone view: sections 2 to 6 fold to a title and one line, the glance and the detail do not; charts draw on opening', () => {
  for (const [id, ctl] of [['s-next', 'c-next'], ['s-why', 'c-score c-ins'], ['s-price', 'c-ladder'], ['s-expect', 'c-brief'], ['s-track', 'c-calls c-calib']]) {
    const m = new RegExp('<section class="story sfold" id="' + id + '"[^>]*>\\s*<header class="st-h">.*?<button type="button" class="st-go" id="go-' + id + '" aria-expanded="false" aria-controls="' + ctl + '" aria-labelledby="[\\w-]+ one-' + id + '"><span class="st-one" id="one-' + id + '"></span></button></header>').exec(html);
    assert.ok(m, id + ' has its fold button inside the section header');
    for (const c of ctl.split(' ')) assert.ok(html.includes('id="' + c + '"'));
  }
  assert.match(html, /<section class="story" id="s-week"/); assert.match(html, /<section class="story" id="s-deep"/);
  assert.equal(html.match(/class="story sfold"/g).length, 5);
  // opening draws the section's charts at the width they have then; switching the view redraws all
  assert.match(html, /function foldSet\(sx, open\) \{[^\n]*if \(open\) redraw\(sx\); \}/);
  assert.match(html, /document\.addEventListener\('ms:phone', function \(\) \{ syncSw\(\); redraw\(\); \}\)/);
  assert.match(html, /function draw\(id, fn\) \{[^\n]*if \(w > 0\) el\.innerHTML = fn\(Math\.max\(260, w\)\); else el\.dataset\.pending = '1'; \}/, 'a folded chart is not drawn at a guessed width');
  assert.match(html, /syncStory\(\); syncOne\(\);[\s\S]{0,400}delete m\.dataset\.loading;\s*redraw\(\);/, 'the story is shown, then drawn (the blank-chart fix of 11 Nov stays)');
  // the one line is the open card's own line: copied, never computed
  const so = /function syncOne\(\) \{[\s\S]*?\n  \}/.exec(html)[0];
  for (const id of ['nx-take', 'ld-take', 'hyp-take', 'calls-take', 'calib-take', 'sc-top', 'ld-stale']) assert.ok(so.includes("'" + id + "'"), 'takeaway from #' + id);
  assert.doesNotMatch(so.replace(/'[^']*'/g, ''), /\d/, 'no number of its own');
  assert.match(so, /stb \? '<b>' \+ esc\(stb\.textContent\) \+ '<\/b> '/, 'a stale level file is said on the folded row too');
  // the detail stays folded in the simple view whatever was stored; a link into a folded section opens it
  assert.match(html, /localStorage\.getItem\('mdDeep'\) === '1' && !simple\(\)\) deep\.open = true/);
  assert.match(html, /window\.addEventListener\('hashchange', openHash\); openHash\(\);/);
  assert.match(html, /<div class="ps-sw" id="ps-sw" role="group" aria-label="Phone view"><span>Phone view<\/span><span class="ps-sw-b"><button type="button" data-v="simple" aria-pressed="true">Simple<\/button><button type="button" data-v="full" aria-pressed="false">Full<\/button>/);
});

test('desk simple phone view: the first screen keeps the stale and broken states, and no claim lost its wording', () => {
  // what the glance hides until "more" is marked gx; the stale notice and the broken-level lines are not
  assert.match(html, /function lvStale\(L\) \{[^\n]*'<p class="lv-stale" role="status">/);
  assert.match(html, /<em class="brk">broken since the close<\/em>/);
  assert.match(html, /'<p class="sub"><em class="brk">Broken since the close:<\/em> '/);
  assert.match(html, /'<p class="sub">Confidence ' \+ esc\(b\.confidence\)/, 'how sure stays on the first screen');
  assert.equal(html.match(/class="sub gx"/g).length, 4);
  assert.match(html, /<p class="g-pub"><b>Public data only\.<\/b><span class="gx"> CFTC positioning, Treasury and FRED series, the release calendar and central-bank feeds, read early and carefully\. No inside information\. <span id="g-cal"><\/span><\/span><\/p>/);
  assert.match(html, /<p class="stamp" id="stamp" role="status">/);
  for (const t of ['Descriptive, not a tested edge', 'no tested edge', 'not a tested edge', 'A negative score is not a sell.', 'Paper only.']) assert.ok(html.includes(t), t);
});

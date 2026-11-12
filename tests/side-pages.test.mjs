// node --test tests/side-pages.test.mjs — the pages around the desk (9 Nov 2026 quality pass): /macro, /veteran/, the Edge lab's
// one-file summary, the shared side-page assets and the gold terminal's placeholder fixes
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { slimStudy, slimCandidate, equityOf, EQ_POINTS } from '../research/edge/lab-summary.mjs';

const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const scripts = (html) => [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)].filter((m) => !/\bsrc=/.test(m[1] || '') && m[2].trim()).map((m) => m[2]);

test('Edge lab summary keeps exactly what the page reads', () => {
  const d = { system: 'NQ', variantsTried: 12, verdict: { verdict: 'FAILS', P1: false, big: [1, 2, 3] }, prereg: 'x'.repeat(5000), trades: [{ a: 1 }],
    baseline: { A: { is: { exp: 0.1, n: 10, extra: 1 }, oos: { exp: -0.1, n: 5, wr: 0.4, maxDD: 3, t: -1, junk: [1] } }, note: 'skip' },
    candidates: [{ rule: 'r1', verdict: 'PASS', is: { exp: 0.2, n: 9 }, oos: { exp: 0.1, n: 4, wr: 55, maxDD: 2, t: 2.1, sharpe: 9 }, years: { 2020: { exp: 0.1, n: 3, list: [1] }, 2021: 0.2 }, grid: [1, 2] }],
    best: 0, years: [{ year: 2020, R: 1.5, n: 2, x: 1 }], notes: ['a', 'b'] };
  const s = slimStudy(d);
  assert.deepEqual(s.verdict, { verdict: 'FAILS' });
  assert.equal(s.prereg, undefined); assert.equal(s.trades, undefined);
  assert.deepEqual(s.baseline, { A: { is: { exp: 0.1, n: 10 }, oos: { exp: -0.1, n: 5, wr: 0.4, maxDD: 3, t: -1 } } });
  assert.deepEqual(s.candidates[0], { rule: 'r1', verdict: 'PASS', is: { exp: 0.2, n: 9 }, oos: { exp: 0.1, n: 4, wr: 55, maxDD: 2, t: 2.1 }, years: { 2020: { exp: 0.1, n: 3 }, 2021: 0.2 } });
  assert.equal(s.best, 0); assert.deepEqual(s.years, [{ year: 2020, R: 1.5, n: 2 }]); assert.deepEqual(s.notes, ['a', 'b']);
  assert.deepEqual(slimStudy({ verdict: { ranking: [1] } }).verdict, {}, 'an object verdict without a known key stays empty (the page reads it as no verdict)');
  assert.deepEqual(slimCandidate({ rule: 'x', verdict: { primary: 'FAIL', more: 1 } }).verdict, { primary: 'FAIL' });
});

test('the build writes lab.json for every published study, far smaller than the result files', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-'));
  execFileSync(process.execPath, ['research/edge/build.mjs', out], { stdio: 'pipe' });
  const dir = path.join(out, 'research', 'edge'), ix = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')), lab = JSON.parse(fs.readFileSync(path.join(dir, 'lab.json'), 'utf8'));
  assert.deepEqual(lab.topics.map((t) => t.topic), ix.topics.map((t) => t.topic)); assert.equal(lab.generated, ix.generated);
  let full = 0; for (const t of ix.topics) if (t.result) full += fs.statSync(path.join(dir, t.topic, 'result.json')).size;
  const size = fs.statSync(path.join(dir, 'lab.json')).size;
  assert.ok(size < full / 10 && size < 600000, `lab.json ${size} B vs ${full} B of result.json`);
  assert.ok(lab.topics.filter((t) => t.valid).every((t) => t.data && typeof t.data === 'object'));
  const eq = lab.topics.filter((t) => t.data && t.data.equity);
  assert.ok(eq.length >= 1 && eq.every((t) => t.data.equity.pts.length <= EQ_POINTS && !t.data.trades), 'equity curves only where a study lists its trades, sampled, never the raw list');
  fs.rmSync(out, { recursive: true, force: true });
});

test('Edge lab: reads lab.json first, revalidates instead of re-downloading, report-only studies are not "Running"', () => {
  const h = src('edge-lab.html');
  assert.match(h, /getJSON\(BASE \+ 'lab\.json'\)\.then\(fromLab\)\.catch\(loadEach\)/);
  assert.ok(!/cache: 'no-store'/.test(h)); assert.match(h, /cache: 'no-cache'/);
  assert.match(h, /status: e\.report \? 'report' : 'missing'/); assert.match(h, /Written report only/);
  assert.match(h, /href="assets\/mx-page\.css"/); assert.match(h, /src="assets\/mx-nav\.js" defer/);
  assert.match(h, /class="hdr-sw" data-mx-members hidden/);
});

test('/macro: the 2024 demo bundle is gone; the page reads the council files and never blanks', () => {
  const h = src('index.html');
  assert.ok(!/index-C0AwpGdj|id="root"/.test(h)); assert.ok(!fs.existsSync(new URL('../assets/index-C0AwpGdj.js', import.meta.url)));
  assert.match(h, /\/cdata\/macro\/forecast\.json/); assert.match(h, /\/veteran\/index\.json/); assert.match(h, /\/research\/edge\/index\.json/);
  assert.match(h, /href="\/macro-dashboard\/assets\/mx-page\.css"/);
  assert.match(h, /Sign in on the desk/); assert.match(h, /UTC/);
  for (const c of scripts(h)) assert.doesNotThrow(() => new vm.Script(c));
});

test('/veteran/: the build publishes the library page next to index.json', () => {
  const t = src('scripts/veteran-library.html');
  for (const c of scripts(t)) assert.doesNotThrow(() => new vm.Script(c));
  assert.match(t, /fetch\('index\.json'/); assert.match(t, /hashchange/); assert.match(t, /\/assets\/mx-page\.css/);
  assert.match(src('scripts/veteran-index.mjs'), /veteran-library\.html', import\.meta\.url\), path\.join\(OUT, 'index\.html'\)/);
});

test('shared side-page assets: tokens for every theme, 44 px controls on touch screens, /api/me asked once', () => {
  const css = src('assets/mx-page.css'), js = src('assets/mx-nav.js');
  assert.match(css, /:root\[data-theme="light"\]/); assert.match(css, /:root\[data-theme="midnight"\]/); assert.match(css, /prefers-color-scheme: light/);
  assert.match(css, /@media \(pointer: coarse\) \{ :root \{ --tap: 44px; \} \}/);
  assert.match(js, /fetch\('\/api\/me'/); assert.match(js, /window\.MX_ME/); assert.doesNotThrow(() => new vm.Script(js));
  assert.match(src('scripts/stamp-assets.mjs'), /macro-dashboard\\\/\)\?assets/);
});

test('gold terminal: no placeholder shown as a live price, chart library off the critical path, theme before paint', () => {
  const h = src('gold-trading.html');
  assert.match(h, /prevGoldPrice = goldIsLive \? lastGoldPrice : spot\.val;/);
  assert.match(h, /if \(!goldIsLive\) \{[\s\S]{0,200}Waiting for a live price/);
  assert.match(h, /lightweight-charts-4\.1\.3\.js" defer/);
  assert.match(h, /% est\./);
  assert.ok(h.indexOf("localStorage.getItem('goldDarkMode')") < h.indexOf('<body'));
});

// 9 Nov 2026 design pass: equity curves in lab.json, the Edge lab's visuals, the gold terminal's hero / chart / tokens
test('equity curve: sampled cumulative R from the study\'s own trades; drawdown from the full series; none without R', () => {
  const trades = []; for (let i = 0; i < 200; i++) trades.push({ d: `2020-01-${String(1 + (i % 28)).padStart(2, '0')}`, R: i === 101 ? -40 : 0.5 });
  const e = equityOf(trades);
  assert.equal(e.n, 200); assert.equal(e.pts.length, EQ_POINTS); assert.equal(e.pts.at(-1), e.total);
  assert.equal(e.total, 199 * 0.5 - 40); assert.equal(e.maxDD, 40, 'a one-trade trough the sampling may skip still sets the drawdown');
  assert.equal(e.from, '2020-01-01');
  assert.equal(equityOf(trades.slice(0, 5)), undefined, 'too few trades');
  assert.equal(equityOf([...trades, { d: 'x' }]), undefined, 'any trade without a numeric R: no curve');
  assert.equal(equityOf([[1, 2]]), undefined);
  const s = slimStudy({ system: 'X', trades }); assert.ok(s.equity); assert.equal(s.trades, undefined);
  assert.equal(slimStudy({ system: 'X' }).equity, undefined);
  assert.ok(JSON.stringify(s).length < 800, 'a curve stays a few hundred bytes');
});

test('Edge lab visuals: verdict donut with words, IS vs OOS bars with t, equity line, tooltips on hover and tap', () => {
  const h = src('edge-lab.html');
  for (const c of scripts(h)) assert.doesNotThrow(() => new vm.Script(c));
  assert.match(h, /function summary\(counts, total, done\)/); assert.match(h, /class="donut"/); assert.match(h, /<title>/);
  assert.match(h, /\['pass', counts\.pass, 'Pass', '--buy'\], \['fail', counts\.fail, 'Fail'/, 'each arc has a word in the legend');
  assert.match(h, /function ioBars\(b, base\)/); assert.match(h, /class="iob" role="img" aria-label="/); assert.match(h, /could be noise/);
  assert.match(h, /function equityLine\(eq\)/); assert.match(h, /equityLine\(d\.equity\)/);
  assert.match(h, /addEventListener\('pointerdown'[\s\S]{0,200}closest\('\[data-tip\]'\)/, 'tap shows the tooltip too');
  assert.match(h, /#groups:has\(> \.loading\) \{ min-height: 100vh; \}/, 'the rows land without moving the footer');
  for (const m of h.matchAll(/font(?:-size)?:[^;{}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, `text at ${m[1]}px`);
});

test('gold terminal design pass: 12 px floor and AA tokens, hero, premium chart, never a placeholder as live', () => {
  const h = src('gold-trading.html');
  for (const c of scripts(h)) assert.doesNotThrow(() => new vm.Script(c));
  for (const m of h.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, `font-size ${m[1]}px`);
  assert.ok(!/#D97706/i.test(h) && !/color:#D4AF37/i.test(h), 'the 3:1 amber / gold inline colours are tokens now');
  assert.match(h, /--fs-xs: 12px;/); assert.match(h, /html\.dark\.midnight \{/); assert.match(h, /p\.theme === 'midnight'\) d\.classList\.add\('midnight'\)/);
  // hero first, then the chart, then folded panels
  const hero = h.indexOf('id="gxHero"'), chart = h.indexOf('id="scalpChart"'), fold = h.indexOf('class="gx-fold"');
  assert.ok(hero > 0 && hero < chart && chart < fold);
  assert.match(h, /<body data-section="dashboard">/, 'the header is already in its dashboard shape at first paint (no shift)');
  // no plan or price off the 3900 cold-start placeholder
  assert.match(h, /function scalpLevels\(\) \{\n\s+if \(!goldIsLive/);
  assert.match(h, /aligned = !!\(goldIsLive && lastClose\); offset = aligned \? \(lastGoldPrice - lastClose\) : 0;/);
  assert.match(h, /function gxRenderHero\(\) \{[\s\S]{0,300}if \(!goldIsLive\) \{[\s\S]{0,120}Waiting for a live price/);
  // chart: theme tokens, restyled on toggle, OHLC legend in UTC, quiet key levels, smooth updates
  assert.match(h, /function gxPalette\(\)/); assert.match(h, /gxRestyleCharts\(\);/); assert.match(h, /subscribeCrosshairMove/);
  assert.match(h, /UTC`; \};/); assert.match(h, /Prior day high \$\{gxFmt/); assert.match(h, /function makeKeyLevelsPrimitive\(\)/);
  assert.match(h, /else for \(const c of candles\) if \(c\.time >= prevLast\) series\.update\(c\);/);
  assert.match(h, /if \(!fitted && chart/, 'the view is fitted once, not reset every minute');
});

// 11 Nov 2026, wording pass: the gold terminal's Research → Edge Lab tab states no win rate, profit factor or "conviction"
// without a measured source, says near the top that these are rule ideas, and quotes the three studies as their RESULT.md has them.
test('gold terminal Edge Lab tab: rule ideas, no unsourced figures, study figures as the studies state them', () => {
  const g = fs.readFileSync(new URL('../gold-trading.html', import.meta.url), 'utf8');
  const tab = g.slice(g.indexOf('<div id="tab-edges"'), g.indexOf('<!-- end tab-edges -->'));
  assert.ok(tab.length > 5000);
  const text = tab.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  // the label near the top, before the first card, with the way to the tested results
  const note = tab.indexOf('id="edge-lab-note"');
  assert.ok(note > 0 && note < tab.indexOf('edge-card'), 'the note comes before the cards');
  assert.match(text, /Rule ideas, not tested edges\./); assert.match(tab, /<a href="\.\/edge-lab\.html">Edge lab page<\/a>/);
  // what must not come back
  for (const re of [/\d+\s*%\s*win rate/i, /win rate[^.]{0,20}\d/i, /high conviction|highest conviction|full conviction/i, /historically/i, /profit factor\s*\d/i, /\bPF\s*\d/, /\d:1/, /−0\.85|−0\.73|−0\.25/,
    /50-year/i, /backtest-validated|most reliable|powerful|holy grail|high-probability|overwhelmingly/i, /why it works/i, /6\/6/, /guarantee/i, /full size/i])
    assert.ok(!re.test(text), 'the tab still says ' + re);
  // the same goes for what the tab's script writes into it
  const js = g.slice(g.indexOf('function edgeConfluence()'), g.indexOf('// ─── PRICE DATA'));
  for (const re of [/confluence —/i, /full size/, /strongest 4-month/, /Gold outperforms/, /structural tailwind/, /seasonal edge active/i]) assert.ok(!re.test(js), 'the script still writes ' + re);
  assert.ok(!/dots\[0\] = 'on'/.test(js), 'the COT dot is not lit by the seasonal month');
  assert.ok(!/pct: SEAS\.includes\(month\)\?'80%'/.test(g), 'the dashboard feed no longer shows 80% for the season');
  // every figure quoted from a study is in that study's own report
  const rd = (t) => fs.readFileSync(new URL('../research/edge/' + t + '/RESULT.md', import.meta.url), 'utf8');
  const cot = rd('cot-positioning'), seas = rd('seasonality'), mg = rd('macro-gold');
  assert.match(cot, /\| Gold \|.*\| 34 \/ 50% \/ \+0\.15% \(0\.14\) \| 47 \/ 26% \/ −2\.14% \(−3\.1\) \| none \|/);
  assert.match(text, /right in 50% of 34 cases in sample \(\+0\.15% a case, t 0\.14\) and in 26% of 47 cases out of sample \(−2\.14% a case, t −3\.1\)/);
  assert.match(seas, /\| H4 \| Gold PM fix 15:00→15:30 London \| short \| 2,471 \| −0\.036 \(−5\.73\) \| 2,741 \| −0\.017 \(−3\.48\) \|/); assert.match(seas, /Gross it is −0\.007% \(A\) and −0\.000% \(B\)/); assert.match(seas, /loses in 20 of 21 years/);
  assert.match(text, /Before costs −0\.007% a trade in 2006–15 \(2,471 trades\) and −0\.000% in 2016–26 \(2,741 trades\)/); assert.match(text, /After the \$0\.30 spread −0\.036% \(t −5\.73\) and −0\.017% \(t −3\.48\); it lost in 20 of 21 years/);
  assert.match(mg, /correlates −0\.20 \(2006–17\) and −0\.31 \(2018–26\)/); assert.match(mg, /the correlation is −0\.015 and \+0\.019/);
  assert.match(mg, /\*\*0\.33 \/ 0\.31\*\* \| \*\*0\.44\*\* \|.*54%, 154 \|/); assert.match(mg, /Confirm 2018 to Nov 2026 \| 0\.68 \/ 0\.67 \| 0\.82 \|.*48%, 103 \|/);
  assert.match(text, /correlate −0\.20 \(2006–17\) and −0\.31 \(2018 to Nov 2026\)/); assert.match(text, /Sharpe 0\.33 against 0\.44 for simply holding gold in 2006–17 \(154 entries\), 0\.68 against 0\.82 in 2018–26 \(103 entries\)/);
  for (const t of ['cot-positioning', 'seasonality', 'macro-gold']) assert.ok(tab.includes('./edge-lab.html#' + t), 'links the ' + t + ' study');
  // the three untested ideas say so, and a "tested" box sits on every card
  assert.equal((tab.match(/class="edge-rule note edge-tested"/g) || []).length, 6);
  assert.equal((text.match(/Tested in this repository: no\./g) || []).length, 3);
  // the rules themselves stay (six cards), and the file stays self-contained
  assert.equal((tab.match(/class="edge-card"/g) || []).length, 6);
  assert.ok(!/<script[^>]+src="(?!https:\/\/(cdn\.jsdelivr\.net|unpkg\.com))[^"]*"/.test(tab));
});

// 12 Nov 2026, wording pass 2: the Dashboard's seasonal feed row, the Live Analysis tab's seasonal tile and the rest of the
// Dashboard's signal panel claim no edge, win rate or percentage chance. No study in this repository tests gold's month of the
// year (the seasonality study tested clock and calendar windows; its ten tests are in its RESULT.md), so the seasonal idea is
// said to be untested. Display only: the scores (seasS, computeEdgeScore, computeMacroScore) are computed as before.
test('gold terminal Dashboard: the seasonal tile and feed row and the signal panel are untested ideas, no edge or % chance', () => {
  const g = fs.readFileSync(new URL('../gold-trading.html', import.meta.url), 'utf8');
  const dash = g.slice(g.indexOf('<div id="tab-dashboard"'), g.indexOf('<!-- end tab-dashboard -->'));
  const dtext = dash.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(!/\bedge\b/i.test(dtext.replace(/Edge lab page|not tested edges|tested edge/gi, '')), 'the Dashboard markup says "edge" for an untested idea');
  assert.match(dash, /<div class="kpi-label">Rule ideas on<\/div>/);
  assert.match(dash, /<div class="dash-widget-title">Rule ideas, not tested edges<\/div>/);
  assert.match(dash, /id="dash-signals-note">Conditions of untested ideas, on or off right now\. None is a tested edge; the tested results are on the <a href="\.\/edge-lab\.html">Edge lab page<\/a>\.<\/p>/);
  // the script that writes the Dashboard: no "% Confidence", no "Edge" titles, no "Strong confluence" advice
  const js = g.slice(g.indexOf('function renderDashboard()'), g.indexOf('// ─── SCALP DESK'));
  assert.ok(js.length > 2000);
  for (const re of [/% Confidence/, /\['Confidence'/, /title: '[^']*Edge'/, /Strong confluence|Low — wait/, /Strong season/, /'80%'/, /md\.conf\s*\+\s*'%'/, /\$\{md\.conf\}%/, /decoupling regime active/, /pct: 'Active'/])
    assert.ok(!re.test(js), 'the Dashboard script still writes ' + re);
  assert.match(js, /title: 'Seasonal tendency', desc: \(SEAS\.includes\(month\)\?'Inside the Nov–Feb window':'Outside the Nov–Feb window'\) \+ ' · not tested here'/);
  assert.match(js, /title: 'DXY idea',\s+desc: 'Always counted as on · not read from live data'/);
  assert.match(js, /\['Tested here\?', 'No'\]/);
  assert.match(js, /cSubEl\.textContent = 'A count of untested ideas, not a signal';/);
  // the Live Analysis tile
  assert.match(g, /<div class="metric-label">Seasonal tendency \(not tested here\)<\/div>/);
  assert.match(g, /' · a seasonal tendency, not tested here';/);
  assert.ok(!/Seasonal Edge|Strong seasonal window|Weak seasonal window/.test(g), 'old seasonal wording is gone');
  // the source checked: the seasonality study has no month-of-year test, and none of its ten tests passed
  const seas = fs.readFileSync(new URL('../research/edge/seasonality/RESULT.md', import.meta.url), 'utf8');
  assert.match(seas, /## Verdict: nothing passes\./);
  assert.ok(!/month of the year|monthly seasonal|Nov(ember)?[–-]Feb/i.test(seas), 'the study does not test the month of the year');
  // the numbers behind the display are untouched
  assert.match(g, /const seasS = \[10,11,0,1\]\.includes\(month\) \? 9 : \[2,5\]\.includes\(month\) \? 5 : 7;/);
  assert.match(g, /const SEASONAL = \[0, 10, 11, 1\];\n\s+if \(SEASONAL\.includes\(month\)\) s\+\+;/);
});

// 12 Nov 2026, the last two: the Live Analysis setup card's "72% Confidence" was the macro score (out of 40) rescaled to a percent,
// not a measured chance; the Daily Bias tab called a zone + M15 engulfing "the highest-probability setup on the platform", and
// the supply / demand alert "the highest-probability reaction", with no study behind either. Display text only.
test('gold terminal: the setup card shows its score, the bias tab and zone alert claim no probability', () => {
  const g = fs.readFileSync(new URL('../gold-trading.html', import.meta.url), 'utf8');
  assert.match(g, /<div class="dir-conf" id="setupConf">Score —\/40<\/div>/);
  assert.match(g, /confEl\.textContent = 'Score ' \+ macroScore \+ '\/40 · not tested here';/);
  assert.ok(!/% Confidence/.test(g), 'no "n% Confidence" anywhere on the page');
  assert.ok(!/highest-probability|high-probability/i.test(g), 'no probability claim without a study');
  assert.match(g, /this setup is not tested in this repository, and no win rate or edge is claimed for it\./);
  assert.match(g, /first touch \(an untested idea, not a tested edge\)\. Watch for the trigger\./);
  // the score behind the card is computed as before
  assert.match(g, /const macroConf  = Math\.round\(\(macroScore \/ 40\) \* 100\);\n\s+const isLong  = macroConf >= 60;\n\s+const isShort = macroConf <= 40;/);
});

// 11 Nov 2026, simpler phone version (owner: "on the mobile there's too much"): the gold terminal's simple view is the default at
// 640 px and under, hangs on one attribute a wider screen never gets, keeps every tab and block reachable, and Full view undoes it.
test('gold terminal, phone simple view: default on phones only, every tab reachable, blocks fold and unfold, locked charts kept', () => {
  const h = src('gold-trading.html');
  // set before the first paint from the Desk's key; only at 640 px and under
  assert.match(h, /matchMedia\('\(max-width: 640px\)'\)/); assert.match(h, /localStorage\.getItem\('ms-phone'\) === 'full'/);
  assert.match(h, /if \(mq && mq\.matches && !full\) R\.setAttribute\('data-phone', 'simple'\); else R\.removeAttribute\('data-phone'\);/);
  assert.ok(h.indexOf("R.setAttribute('data-phone', 'simple')") < h.indexOf('<body'), 'decided in the head');
  // the new phone-only elements are hidden unless the simple view shows them; every simple-view rule hangs on the attribute
  assert.match(h, /\.gx-po, \.gx-bar, \.gx-pv \{ display: none; \}/);
  const css = h.slice(h.indexOf('/* ── PHONE, SIMPLE VIEW (11 Nov 2026, owner'), h.indexOf('</head>'));
  const sels = css.replace(/\/\*[\s\S]*?\*\//g, '').split('</style>')[0].matchAll(/([^{}]+)\{/g); let seen = 0;
  for (const m of sels) { const sel = m[1].trim(); if (/^@|^(from|to)$/.test(sel)) continue;
    for (const part of sel.split(',')) { seen++; assert.ok(/\[data-phone="simple"\]/.test(part) || /\.gx-(po|bar|pv|seg|more)/.test(part), 'a rule reaches past the simple view: ' + part.trim()); } }
  assert.ok(seen > 60);
  // four tabs in the bar, the rest under More: every tab of the page has a button
  const bar = /<nav class="gx-bar"[\s\S]*?<\/nav>/.exec(h)[0], more = /<dialog class="gx-more"[\s\S]*?<\/dialog>/.exec(h)[0];
  assert.deepEqual([...bar.matchAll(/data-tab="(\w+)"/g)].map((m) => m[1]), ['dashboard', 'bias', 'mtf', 'redfolder']); assert.match(bar, /data-more/);
  const nav = /const NAV_SECTIONS = \{[\s\S]*?\n  \};/.exec(h)[0], ids = [...nav.matchAll(/id: '(\w+)'/g)].map((m) => m[1]);
  assert.equal(ids.length, 12); for (const id of ids) assert.ok((bar + more).includes(`data-tab="${id}"`), id + ' has a button on the phone');
  assert.match(h, /if \(window\.gxPhoneTab\) window\.gxPhoneTab\(name\);/);
  // the switch: the Desk's words, in the page and in the sheet; Full takes every fold out again
  assert.equal((h.match(/data-v="simple" aria-pressed="true">Simple<\/button><button type="button" data-v="full" aria-pressed="false">Full<\/button>/g) || []).length, 2);
  assert.match(h, /function undo\(\) \{\n\s+document\.querySelectorAll\('details\.gx-pf'\)\.forEach\(\(d\) => \{ const el = d\.querySelector\(':scope > \.gx-fold-b > \[data-pf\]'\); if \(el\) d\.parentNode\.insertBefore\(el, d\); d\.remove\(\); \}\);/);
  assert.match(h, /function sync\(\) \{ if \(simple\(\)\) apply\(\); else undo\(\); marks\(\); \}/);
  // folds use the page's one pattern and its one store
  assert.match(h, /d\.className = 'gx-fold gx-pf';/); assert.match(h, /window\.gxFoldBind = \(d\) =>/); assert.match(h, /if \(window\.gxFoldBind\) window\.gxFoldBind\(d\);/);
  assert.equal((h.match(/localStorage\.setItem\('gxFolds'/g) || []).length, 1, 'one writer of the fold store');
  // what folds: every block of the long tabs except each tab's answer; the Edge Lab note is never folded
  const tab = (id) => { const a = h.indexOf(`<div id="tab-${id}"`); return h.slice(a, h.indexOf('<div id="tab-', a + 10) > 0 ? h.indexOf('<div id="tab-', a + 10) : h.indexOf('<div class="gx-pv"')); };
  const n = (id) => (tab(id).match(/ data-pf="/g) || []).length;
  assert.deepEqual(['bias', 'analysis', 'calendar', 'redfolder', 'mtf', 'sessions', 'edges', 'intel', 'scorecard'].map(n), [7, 5, 1, 2, 1, 4, 8, 4, 2]);
  assert.match(h, /<div class="section">\s*<div class="edge-rule note" id="edge-lab-note"/, 'the Edge Lab note stays open, in a block that is not folded');
  assert.ok(!/id="bias-banner"[^>]*data-pf|data-pf[^>]*id="bias-banner"/.test(h), 'the Daily Bias verdict stays open');
  assert.equal((tab('edges').match(/data-pf-q="\.edge-stat-pill"/g) || []).length, 6, "an idea's folded line is its own status pills, word for word");
  // dashboard: the daily bias in one line, the macro score line next; the bias strip is moved, not copied
  assert.match(h, /<details class="gx-fold gx-po" data-fold="pbias">\s*<summary><span class="gx-fold-t">Daily bias<\/span><span class="gx-fold-s" id="gxFoldBias">/);
  assert.match(h, /data-pv-slot="#dash-bias-strip"/); assert.equal((h.match(/id="dash-bias-strip"/g) || []).length, 1);
  assert.match(h, /data-pt="Macro score and trade setup">Trade setup, macro score and rule ideas</);
  // Multi-TF: one timeframe at a time, each chart with its structure readout; the locked display preference is untouched
  const mtf = tab('mtf'); assert.match(mtf, /class="tab-panel" data-ptf="d"/);
  for (const [k, id] of [['d', 'mtfDaily'], ['h4', 'mtfH4'], ['m15', 'mtfM15']]) { const a = mtf.indexOf(`data-ptf-w="${k}"`), w = mtf.slice(a, a + 1400); assert.ok(a > 0 && w.includes(`id="${id}"`) && w.includes(`id="${id}Struct"`), k + ' chart and its readout');
    assert.ok(mtf.includes(`data-tf="${k}"`)); assert.match(h, new RegExp(`#tab-mtf\\[data-ptf="${k}"\\] \\[data-ptf-w\\]:not\\(\\[data-ptf-w="${k}"\\]\\)`)); }
  assert.match(h, /html\[data-phone="simple"\] \.mtf-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/, 'a chart made while hidden cannot stretch its column');
  assert.match(h, /hideTags/); assert.match(h, /hideBosLabel/); assert.match(h, /function structureMap\(/); assert.match(h, /function makeStructPrimitive\(/); assert.match(h, /function renderStructReadout\(/);
});

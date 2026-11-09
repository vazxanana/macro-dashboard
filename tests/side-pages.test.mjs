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

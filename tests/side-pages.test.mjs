// node --test tests/side-pages.test.mjs — the pages around the desk (9 Nov 2026 quality pass): /macro, /veteran/, the Edge lab's
// one-file summary, the shared side-page assets and the gold terminal's placeholder fixes
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { slimStudy, slimCandidate } from '../research/edge/lab-summary.mjs';

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
  assert.ok(h.indexOf("localStorage.getItem('goldDarkMode')") < h.indexOf('<body>'));
});

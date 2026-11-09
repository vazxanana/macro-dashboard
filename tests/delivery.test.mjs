// node --test tests/delivery.test.mjs — how the built site is delivered (9 Nov 2026, site-wide load performance): stamped assets
// cached for a year, unstamped ones always revalidated, Google Fonts self-hosted at build time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { families, fontFaces, selfHostFonts } from '../scripts/self-host-fonts.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const cc = (rule) => (rule.headers.find((h) => h.key.toLowerCase() === 'cache-control') || {}).value;

test('vercel.json: only ?v= stamped asset URLs are immutable; everything else under /assets revalidates', () => {
  const H = JSON.parse(src('vercel.json')).headers;
  for (const base of ['/assets/(.*)', '/macro-dashboard/assets/(.*)']) {
    const rules = H.filter((r) => r.source === base);
    const imm = rules.filter((r) => /immutable/.test(cc(r) || ''));
    const reval = rules.filter((r) => /max-age=0, must-revalidate/.test(cc(r) || ''));
    assert.equal(imm.length, 1, base); assert.equal(reval.length, 1, base);
    assert.deepEqual(imm[0].has, [{ type: 'query', key: 'v' }]); assert.equal(imm[0].missing, undefined);
    assert.deepEqual(reval[0].missing, [{ type: 'query', key: 'v' }]); assert.equal(reval[0].has, undefined);
    assert.match(cc(imm[0]), /max-age=31536000/);
  }
  // no other rule may cache anything under /assets: an unstamped URL (a sound built in JS) must always revalidate
  for (const r of H) if (/immutable|max-age=[1-9]/.test(cc(r) || '') && !r.has) assert.ok(!/assets/.test(r.source) && r.source !== '/(.*)', r.source);
});

test('build: fonts self-hosted before the asset stamp', () => {
  const b = src('scripts/build.sh');
  assert.ok(b.indexOf('self-host-fonts.mjs out') > 0 && b.indexOf('self-host-fonts.mjs out') < b.indexOf('stamp-assets.mjs out'));
});

test('self-host-fonts: Google link -> inline @font-face on /assets/fonts, preconnects dropped', () => {
  assert.deepEqual(families('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap'), [['Figtree', 400, 700], ['JetBrains Mono', 500, 600]]);
  const fonts = { 'Figtree:400..700': [{ subset: 'latin', file: 'f.woff2', range: 'U+0000-00FF' }] };
  const page = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&amp;display=swap">';
  const r = selfHostFonts(page, fonts);
  assert.equal(r.done, 1); assert.equal(r.kept, 0);
  assert.equal(r.html, "<style>@font-face{font-family:'Figtree';font-style:normal;font-weight:400 700;font-display:swap;src:url(/assets/fonts/f.woff2) format('woff2');unicode-range:U+0000-00FF}</style>");
  // a family or weight range that is not vendored stays on Google, and so do its preconnects
  const other = page + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400&display=swap">';
  const k = selfHostFonts(other, fonts);
  assert.equal(k.done, 1); assert.equal(k.kept, 1); assert.match(k.html, /preconnect" href="https:\/\/fonts\.gstatic\.com/); assert.match(k.html, /family=Lato/);
  assert.equal(fontFaces('https://fonts.googleapis.com/css2?family=Figtree:wght@400;700', fonts), null, 'no display=swap: left alone');
  assert.equal(fontFaces('https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;1,700&display=swap', fonts), null, 'italics: left alone');
});

test('every Google Fonts link in the served pages is vendored (else re-run scripts/fonts-vendor.mjs with it in COMBOS)', () => {
  const fonts = JSON.parse(src('assets/fonts/fonts.json'));
  for (const faces of Object.values(fonts)) for (const f of faces) assert.ok(fs.statSync(path.join(ROOT, 'assets/fonts', f.file)).size > 1000, f.file);
  assert.match(src('assets/fonts/OFL.txt'), /SIL OPEN FONT LICENSE Version 1\.1/);
  let n = 0;
  for (const p of ['market-structure.html', 'gold-trading.html', 'index.html', 'edge-lab.html', 'macro-desk.html', 'backtest.html', 'scripts/veteran-library.html']) {
    for (const m of src(p).matchAll(/<link\b[^>]*href=["'](https:\/\/fonts\.googleapis\.com\/css2\?[^"']+)["'][^>]*>/g)) {
      n++; assert.ok(fontFaces(m[1].replace(/&amp;/g, '&')), `${p}: ${m[1]}`);
    }
  }
  assert.ok(n >= 8);
});

test('stamp-assets: src/href and url() in inline styles get ?v=<sha256 prefix>; unknown files and JS-built URLs are left alone', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-'));
  fs.mkdirSync(path.join(d, 'assets/fonts'), { recursive: true });
  fs.writeFileSync(path.join(d, 'assets/a.js'), 'x'); fs.writeFileSync(path.join(d, 'assets/fonts/f.woff2'), 'y');
  fs.writeFileSync(path.join(d, 'p.html'), '<script src="/assets/a.js"></script><style>@font-face{src:url(/assets/fonts/f.woff2) format(\'woff2\')}</style><script>new Audio(\'/assets/sounds/sl.mp3\')</script><img src="/assets/missing.png">');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/stamp-assets.mjs'), d]);
  const h = fs.readFileSync(path.join(d, 'p.html'), 'utf8');
  assert.match(h, /src="\/assets\/a\.js\?v=2d711642b7"/);
  assert.match(h, /url\(\/assets\/fonts\/f\.woff2\?v=a1fce43638\)/);
  assert.match(h, /'\/assets\/sounds\/sl\.mp3'/); assert.match(h, /src="\/assets\/missing\.png"/);
  fs.rmSync(d, { recursive: true, force: true });
});

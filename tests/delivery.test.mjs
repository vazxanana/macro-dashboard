// node --test tests/delivery.test.mjs — how the built site is delivered (9 Nov 2026, site-wide load performance): stamped assets
// cached for a year, unstamped ones always revalidated, Google Fonts self-hosted at build time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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

// ---- 11 Nov 2026: the built site, checked file by file (the browser side is scripts/audit/pwa.cjs) ----
const OUT = path.join(ROOT, 'out');
const builtPages = () => (function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'assets' ? [] : walk(path.join(d, e.name))) : /\.html$/.test(e.name) ? [path.join(d, e.name)] : []); })(OUT);
const sha10 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 10);

test('built pages: every link to an existing asset carries the hash of that file; only URLs built in script go without', () => {
  let stamped = 0; const bare = new Set();
  for (const f of builtPages()) {
    const rel = path.relative(OUT, f), s = fs.readFileSync(f, 'utf8');
    // anything that looks like an asset URL, wherever it stands (attributes, srcset, url(), preload, @import, script strings)
    // (a relative "assets/x.js" counts only as a src / href value: the pages also name files that way in comments)
    for (const m of s.matchAll(/(["'(=\s,]|(?:src|href)=["']?(?:\.\.?\/)?(?=assets\/))((?:\/(?:macro-dashboard\/)?)?assets\/[\w./-]+\.[a-z0-9]{2,5})(\?v=([0-9a-f]+))?/g)) {
      if (!m[2].startsWith('/') && !/^(?:src|href)=/.test(m[1])) continue;
      const file = path.join(OUT, 'assets', m[2].replace(/^.*?assets\//, ''));
      if (!fs.existsSync(file)) continue;
      if (m[3]) { assert.equal(m[4], sha10(file), `${rel}: ${m[2]} is stamped with another file's hash (stale out/?)`); stamped++; }
      else bare.add(m[2]);
    }
    assert.doesNotMatch(s, /\b(?:image)?srcset=["'][^"']*assets\//, rel + ': srcset to /assets is not stamped by scripts/stamp-assets.mjs');
    assert.doesNotMatch(s, /@import\s+(?:url\()?["']?[^"');]*assets\//, rel + ': @import of an asset is not stamped');
  }
  assert.ok(stamped >= 100, 'stamped links: ' + stamped);
  // Unstamped = revalidated on every use (vercel.json) and never stored by sw.js, so they cannot go stale; they only cost a
  // request. The one such URL is built in script. A new one here should be a plain src / href so the stamp reaches it.
  assert.deepEqual([...bare].sort(), ['/assets/sounds/sl.mp3']);
});

test('assets: no stylesheet or script pulls another asset by a URL the stamp cannot see', () => {
  const dir = path.join(OUT, 'assets');
  for (const f of fs.readdirSync(dir)) {
    if (/\.css$/.test(f)) { const s = fs.readFileSync(path.join(dir, f), 'utf8'); assert.doesNotMatch(s, /@import/, f); assert.doesNotMatch(s.replace(/url\(\s*["']?data:[^)]*\)/g, ''), /url\(/, f + ': url() in a stylesheet is unversioned'); }
    if (/\.js$/.test(f)) { const s = fs.readFileSync(path.join(dir, f), 'utf8'); assert.doesNotMatch(s, /\bimportScripts\s*\(|\bimport\s*\(\s*["']/, f); }
  }
  // the worker itself imports nothing either (updateViaCache would matter otherwise)
  assert.doesNotMatch(src('sw.js'), /importScripts|^\s*import\s/m);
});

test('fonts: no built page, stylesheet or script names a Google host, and every @font-face file is in out/assets/fonts', () => {
  const files = builtPages().concat(fs.readdirSync(path.join(OUT, 'assets')).filter((f) => /\.(css|js)$/.test(f)).map((f) => path.join(OUT, 'assets', f)), [path.join(OUT, 'sw.js')]);
  let faces = 0;
  for (const f of files) {
    const rel = path.relative(OUT, f), s = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /fonts\.(?:googleapis|gstatic)\.com/, rel);
    for (const block of s.match(/@font-face\s*\{[^}]*\}/g) || []) {
      const urls = [...block.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)].map((m) => m[1]);
      assert.ok(urls.length, rel + ': @font-face without a file');
      for (const u of urls) {
        const m = /^\/assets\/fonts\/([\w.-]+\.woff2)\?v=([0-9a-f]{10})$/.exec(u);
        assert.ok(m, `${rel}: font URL ${u}`);
        const file = path.join(OUT, 'assets/fonts', m[1]);
        assert.ok(fs.existsSync(file) && fs.statSync(file).size > 1000, `${rel}: ${m[1]} is missing`);
        assert.equal(m[2], sha10(file), `${rel}: ${m[1]} hash`);
        faces++;
      }
    }
  }
  assert.ok(faces >= 20, '@font-face rules checked: ' + faces);
  // every family a page's CSS asks for by name has a face on that page (a typo or a dropped link would fall back silently)
  for (const f of builtPages()) {
    const s = fs.readFileSync(f, 'utf8'), have = new Set([...s.matchAll(/@font-face\{font-family:'([^']+)'/g)].map((m) => m[1]));
    for (const fam of ['Figtree', 'JetBrains Mono', 'Inter', 'Space Grotesk', 'IBM Plex Mono', 'IBM Plex Sans', 'Fraunces', 'Manrope']) {
      if (new RegExp(`font(?:-family)?\\s*:[^;}]*['"]${fam}['"]`).test(s)) assert.ok(have.has(fam), `${path.relative(OUT, f)} uses ${fam} but has no @font-face for it`);
    }
  }
});

test('vercel.json: the two /assets prefixes each have exactly the pair of rules, and nothing else caches a page or the worker', () => {
  const v = JSON.parse(src('vercel.json'));
  for (const pre of ['/assets/(.*)', '/macro-dashboard/assets/(.*)']) {
    const rules = v.headers.filter((h) => h.source === pre);
    assert.equal(rules.length, 2, pre);
    const withV = rules.find((r) => r.has), without = rules.find((r) => r.missing);
    assert.deepEqual(withV.has, [{ type: 'query', key: 'v' }]); assert.equal(withV.missing, undefined);
    assert.deepEqual(without.missing, [{ type: 'query', key: 'v' }]); assert.equal(without.has, undefined);
    assert.equal(cc(withV), 'public, max-age=31536000, immutable');
    assert.equal(cc(without), 'public, max-age=0, must-revalidate');
  }
  for (const h of v.headers) {
    const c = cc(h); if (!c) continue;
    if (/\.html|^\/$|sw\.js|webmanifest/.test(h.source)) assert.equal(c, 'no-cache', h.source);
    if (!/assets/.test(h.source)) assert.doesNotMatch(c, /immutable/, h.source);
  }
});

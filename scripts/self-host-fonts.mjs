// Self-hosted fonts for the built pages (9 Nov 2026, site-wide load performance). Runs in scripts/build.sh before stamp-assets.mjs;
// the source pages keep their Google Fonts links (GitHub Pages and local previews still work). Usage: node scripts/self-host-fonts.mjs out
// Every <link rel="stylesheet" href="https://fonts.googleapis.com/css2?..."> in out/ becomes an inline <style> with the same @font-face
// rules (same subsets, unicode-ranges, font-display: swap) pointing at /assets/fonts/ (vendored by scripts/fonts-vendor.mjs, SIL OFL;
// stamp-assets then adds ?v= so they are cached for a year). No render-blocking CSS from another origin, no connections to
// fonts.googleapis.com / fonts.gstatic.com; the Google preconnects go once nothing on the page needs them. No font preload: on a phone
// link it took bandwidth from the render-blocking chart library and made first paint later (measured). A family or weight range that
// is not vendored keeps its Google link, with a warning: add it to COMBOS in scripts/fonts-vendor.mjs and re-run that.
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const FONTS = JSON.parse(fs.readFileSync(path.join(root, 'assets/fonts/fonts.json'), 'utf8'));

// family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@500;600 -> [['Figtree', 400, 600], ['JetBrains Mono', 500, 600]]
export function families(href) {
  const q = href.split('?')[1] || '';
  return q.split('&').filter((p) => p.startsWith('family=')).map((p) => {
    const [name, axes] = decodeURIComponent(p.slice(7).replace(/\+/g, ' ')).split(':');
    const w = /^wght@[\d;.]+$/.test(axes || '') ? axes.slice(5).split(/[;.]+/).map(Number) : axes ? [NaN] : [400];
    return [name, Math.min(...w), Math.max(...w)];
  });
}
export function fontFaces(href, fonts = FONTS) {
  const fam = families(href);
  if (!fam.length || !/[?&]display=swap(&|$)/.test(href)) return null;
  const css = [];
  for (const [name, lo, hi] of fam) {
    const faces = fonts[`${name}:${lo}..${hi}`];
    if (!faces) return null;
    for (const f of faces) css.push(`@font-face{font-family:'${name}';font-style:normal;font-weight:${lo === hi ? lo : lo + ' ' + hi};font-display:swap;src:url(/assets/fonts/${f.file}) format('woff2');unicode-range:${f.range}}`);
  }
  return css.join('\n');
}
const LINK = /<link\b[^>]*href=["'](https:\/\/fonts\.googleapis\.com\/css2\?[^"']+)["'][^>]*>/gi;
const PRECONNECT = [/<link\b[^>]*rel=["']?(?:preconnect|dns-prefetch)["']?[^>]*href=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com\/?["'][^>]*>\s*/gi,
  /<link\b[^>]*href=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com\/?["'][^>]*rel=["']?(?:preconnect|dns-prefetch)["']?[^>]*>\s*/gi];
export function selfHostFonts(html, fonts = FONTS) {
  let kept = 0, done = 0;
  let t = html.replace(LINK, (tag, href) => {
    if (!/\brel=["']?stylesheet/i.test(tag)) return tag;
    const css = fontFaces(href.replace(/&amp;/g, '&'), fonts);
    if (!css) { kept++; return tag; }
    done++;
    return `<style>${css}</style>`;
  });
  if (done && !/fonts\.(?:googleapis|gstatic)\.com\/./.test(t)) for (const re of PRECONNECT) t = t.replace(re, '');
  return { html: t, done, kept };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || 'out';
  const pages = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'assets') walk(p); } else if (/\.html$/.test(e.name)) pages.push(p); } })(out);
  let done = 0, kept = 0;
  for (const p of pages.sort()) {
    const s = fs.readFileSync(p, 'utf8'), r = selfHostFonts(s);
    done += r.done; kept += r.kept;
    if (r.kept) console.warn(`self-host-fonts: ${path.relative(out, p)} keeps ${r.kept} Google Fonts link(s): family or weights not in assets/fonts/fonts.json (scripts/fonts-vendor.mjs)`);
    if (r.html !== s) fs.writeFileSync(p, r.html);
  }
  console.log(`self-host-fonts: ${done} font links self-hosted, ${kept} left on Google Fonts, in ${pages.length} pages`);
}

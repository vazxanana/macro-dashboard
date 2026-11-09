// Installable app, build step (scripts/build.sh, before stamp-assets.mjs). Usage: node scripts/pwa.mjs out
// 1. Every built page gets the app tags in its <head> (only the missing ones; the manifest and Apple icon links are normalised),
//    so the page sources need no hand edits: manifest, theme colour, iOS standalone tags, and /assets/pwa.js (registers sw.js;
//    stamp-assets then versions it like any asset).
// 2. out/sw.js gets VERSION = hash of everything the site serves (pages, assets, icons, manifest, offline page, the worker
//    itself), so any deploy that changes the site is a new worker and old caches go. Build env MX_SW_KILL=1 ships the kill switch.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICON = '/icons/apple-touch-icon.png';
// [find in <head>, tag, replace an existing one?]
const TAGS = [
  [/<link\b[^>]*\brel=["']manifest["'][^>]*>/i, '<link rel="manifest" href="/app.webmanifest">', true],
  [/<meta\b[^>]*\bname=["']theme-color["'][^>]*>/i, '<meta name="theme-color" content="#08090c">', false],
  [/<link\b[^>]*\brel=["']apple-touch-icon["'][^>]*>/i, `<link rel="apple-touch-icon" href="${ICON}">`, true],
  [/<meta\b[^>]*\bname=["']apple-mobile-web-app-capable["'][^>]*>/i, '<meta name="apple-mobile-web-app-capable" content="yes">', false],
  [/<meta\b[^>]*\bname=["']mobile-web-app-capable["'][^>]*>/i, '<meta name="mobile-web-app-capable" content="yes">', false],
  [/<meta\b[^>]*\bname=["']apple-mobile-web-app-title["'][^>]*>/i, '<meta name="apple-mobile-web-app-title" content="Meridian X">', false],
  [/<meta\b[^>]*\bname=["']apple-mobile-web-app-status-bar-style["'][^>]*>/i, '<meta name="apple-mobile-web-app-status-bar-style" content="black">', false],
  [/<script\b[^>]*\bsrc=["'][^"']*\/assets\/pwa\.js[^"']*["'][^>]*>/i, '<script src="/assets/pwa.js" defer></script>', false],
];

// Returns the page with the app tags in its head; unchanged when there is no </head> or nothing is missing. Idempotent.
export function injectHead(html) {
  const end = html.search(/<\/head>/i);
  if (end < 0) return html;
  let head = html.slice(0, end);
  const add = [];
  for (const [re, tag, replace] of TAGS) {
    if (re.test(head)) { if (replace) head = head.replace(re, tag); } else add.push(tag);
  }
  return head + (add.length ? `<!-- app tags: scripts/pwa.mjs -->\n${add.join('\n')}\n` : '') + html.slice(end);
}

const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];

// Hash of what the site serves. Data files (research/edge/*.json, veteran/*) are left out: their timestamps change every build.
export function siteVersion(out, swSource) {
  const rel = (f) => path.relative(out, f).split(path.sep).join('/');
  const files = walk(out).filter((f) => { const r = rel(f); return r !== 'sw.js' && (/\.html$/.test(r) || /^(assets|icons)\//.test(r) || /^(app\.webmanifest|manifest\.json|apple-touch-icon\.png)$/.test(r)); }).sort();
  const h = crypto.createHash('sha256').update(swSource);
  for (const f of files) h.update(rel(f) + '\0').update(fs.readFileSync(f)).update('\0');
  return h.digest('hex').slice(0, 12);
}

export function buildWorker(swSource, version, kill) {
  const a = /^const VERSION = '[^']*';$/m, b = /^const KILL = (?:true|false);$/m;
  if (!a.test(swSource) || !b.test(swSource)) throw new Error('pwa: sw.js has no VERSION / KILL line to stamp');
  return swSource.replace(a, `const VERSION = '${version}';`).replace(b, `const KILL = ${kill ? 'true' : 'false'};`);
}

export function run(out, env = process.env) {
  out = path.resolve(out);
  let pages = 0;
  for (const f of walk(out)) {
    if (!/\.html$/.test(f) || /^offline\.html$/.test(path.relative(out, f))) continue;
    const s = fs.readFileSync(f, 'utf8'), t = injectHead(s);
    if (t !== s) { fs.writeFileSync(f, t); pages++; }
  }
  // iOS asks for /apple-touch-icon.png on its own when a page has no link
  if (fs.existsSync(path.join(out, 'icons', 'apple-touch-icon.png'))) fs.copyFileSync(path.join(out, 'icons', 'apple-touch-icon.png'), path.join(out, 'apple-touch-icon.png'));
  const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const kill = env.MX_SW_KILL === '1';
  const version = siteVersion(out, src);
  fs.writeFileSync(path.join(out, 'sw.js'), buildWorker(src, version, kill));
  return { pages, version, kill };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = run(process.argv[2] || 'out');
  console.log(`pwa: app tags added to ${r.pages} pages, sw.js version ${r.version}${r.kill ? ' (KILL SWITCH ON: no caching, caches deleted)' : ''}`);
}

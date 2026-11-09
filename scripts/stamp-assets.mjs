// Cache-busting for /assets (9 Nov 2026: the owner's new stop-out sound did not play because browsers kept a year-old
// assets/bt-fx.js: /assets is served "immutable" for a year). Every src/href to /assets/<file> in the built pages gets ?v=<first 10
// hex of the file's sha256>, so a changed file is a new URL and every browser fetches it. Usage: node scripts/stamp-assets.mjs out
// vercel.json caches a ?v= URL for a year (immutable) and revalidates every /assets URL without ?v= (e.g. '/assets/sounds/sl.mp3'
// built in JS), so only URLs whose content is pinned by the hash are ever cached.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const out = process.argv[2] || 'out';
const hash = new Map();
const v = (rel) => { if (!hash.has(rel)) { const f = path.join(out, 'assets', rel); hash.set(rel, fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 10) : null); } return hash.get(rel); };
const pages = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'assets') walk(p); } else if (/\.html$/.test(e.name)) pages.push(p); } })(out);
let n = 0;
for (const p of pages) {
  const s = fs.readFileSync(p, 'utf8');
  // /macro-dashboard/assets/ too (the /macro page: the same path works on GitHub Pages and, rewritten, on Vercel)
  const t = s.replace(/((?:src|href)=["'])(\/(?:macro-dashboard\/)?assets\/|(?:\.\.?\/)?assets\/)([^"'?#]+)(["'])/g, (m, a, pre, rel, q) => { const h = v(rel); if (!h) return m; n++; return `${a}${pre}${rel}?v=${h}${q}`; })
    // url(/assets/...) in inline styles too (the self-hosted @font-face rules from self-host-fonts.mjs)
    .replace(/(url\(\s*["']?)(\/(?:macro-dashboard\/)?assets\/)([^"')?#\s]+)(["']?\s*\))/g, (m, a, pre, rel, q) => { const h = v(rel); if (!h) return m; n++; return `${a}${pre}${rel}?v=${h}${q}`; });
  if (t !== s) fs.writeFileSync(p, t);
}
console.log(`stamp-assets: ${n} asset links versioned in ${pages.length} pages`);

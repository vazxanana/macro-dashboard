// Re-vendors the Google Fonts the pages ask for into assets/fonts/ (run by hand, never in the build; the build only reads the
// committed files). One variable woff2 per family and subset, the same subsets and unicode-ranges Google serves, plus fonts.json for
// scripts/self-host-fonts.mjs. All four families are SIL Open Font License 1.1 (assets/fonts/OFL.txt).
// Usage: node --use-env-proxy scripts/fonts-vendor.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
// Every family + weight range a page asks for (a variable file limited to that range is smaller than the full axis). A page link
// with any other family or weights is left on Google Fonts by the build (with a warning) until it is added here and re-run.
const COMBOS = [['Figtree', 400, 700], ['Figtree', 400, 800], ['JetBrains Mono', 500, 600], ['JetBrains Mono', 400, 700], ['Inter', 300, 800], ['Space Grotesk', 500, 700]];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const dir = new URL('../assets/fonts/', import.meta.url).pathname;
fs.mkdirSync(dir, { recursive: true });
const out = {}, byHash = new Map();
const get = async (u, opt) => { for (let i = 0; ; i++) { const r = await fetch(u, opt); if (r.ok) return r; if (i === 3) throw new Error(`${r.status} ${u}`); await new Promise((ok) => setTimeout(ok, 2000)); } };
for (const [family, lo, hi] of COMBOS) {
  const css = await (await get(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${lo}..${hi}&display=swap`, { headers: { 'user-agent': UA } })).text();
  const faces = [];
  for (const m of css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face \{([^}]*)\}/g)) {
    const subset = m[1], body = m[2];
    const url = (body.match(/src: url\((https:[^)]+)\) format\('woff2'\)/) || [])[1], range = (body.match(/unicode-range: ([^;]+);/) || [])[1], w = body.match(/font-weight: (\d+) (\d+);/);
    if (!url || !range || !w) throw new Error(`${family} ${subset}: unexpected face ${body}`);
    const buf = Buffer.from(await (await get(url)).arrayBuffer()), h = crypto.createHash('sha256').update(buf).digest('hex');
    // the same bytes for two ranges (Figtree 400..700 and 400..800 come back as one file): one file on disk, named by its hash
    let file = byHash.get(h);
    if (!file) { file = `${family.toLowerCase().replace(/ /g, '-')}-${subset}-${h.slice(0, 8)}.woff2`; fs.writeFileSync(path.join(dir, file), buf); byHash.set(h, file); }
    faces.push({ subset, file, range, weight: [+w[1], +w[2]] });
  }
  if (!faces.length) throw new Error(`${family}: no faces`);
  out[`${family}:${lo}..${hi}`] = faces;
  console.log(family, lo, hi, faces.map((f) => f.subset).join(' '));
}
fs.writeFileSync(path.join(dir, 'fonts.json'), JSON.stringify(out, null, 1) + '\n');

// Equinox (23 Nov 2026): builds out/equinox.html from equinox.html with three blocks copied from market-structure.html, so the
// page and the Desk share one source: the council-data reader (ms-data), the Mosha desk's style sheet (#ms-mosha-css, which
// assets/desk-trades.js copies once for each desk view) and the replay chart card (#mo-replay, lent to a desk's dialog).
//   node scripts/equinox-page.mjs out
import fs from 'node:fs';
import path from 'node:path';

export function blocks(ms) {
  const cut = (a, b) => { const i = ms.indexOf(a), j = ms.indexOf(b, i); if (i < 0 || j < 0) throw new Error('equinox: block missing in market-structure.html: ' + a); return ms.slice(i, j + b.length); };
  const data = cut('/* ms-data:start */', '/* ms-data:end */');
  const css = cut('<style id="ms-mosha-css">', '</style>');
  const i = ms.indexOf('<div class="card mo-wide" id="mo-replay">'); if (i < 0) throw new Error('equinox: #mo-replay missing');
  let d = 0, k = i, end = -1; const re = /<div\b|<\/div>/g; re.lastIndex = i;
  for (let m; (m = re.exec(ms));) { d += m[0] === '</div>' ? -1 : 1; if (!d) { end = m.index + 6; break; } }
  if (end < 0) throw new Error('equinox: #mo-replay not closed'); void k;
  return { data, css, replay: ms.slice(i, end) };
}
export function page(src, ms) {
  const b = blocks(ms);
  for (const p of ['/* @equinox:ms-data */', '<!-- @equinox:mosha-css -->', '<!-- @equinox:replay -->']) if (!src.includes(p)) throw new Error('equinox: placeholder missing ' + p);
  return src.replace('/* @equinox:ms-data */', () => b.data).replace('<!-- @equinox:mosha-css -->', () => b.css).replace('<!-- @equinox:replay -->', () => b.replay);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const out = process.argv[2] || 'out';
  fs.writeFileSync(path.join(out, 'equinox.html'), page(fs.readFileSync('equinox.html', 'utf8'), fs.readFileSync('market-structure.html', 'utf8')));
  console.log('equinox: page built');
}

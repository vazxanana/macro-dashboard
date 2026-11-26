// Charts app, build step (scripts/build.sh, after pwa.mjs and before stamp-assets.mjs). Usage: node scripts/charts-app.mjs out
// out/charts.html = the built Desk page with html[data-app="charts"], its own title and its own manifest (/charts.webmanifest),
// so /charts installs on a phone or desktop as an app of its own that opens straight on the charts. One source: the Desk page.
import fs from 'node:fs';
import path from 'node:path';

export function chartsPage(html) {
  let n = 0;
  const sub = (re, to) => { html = html.replace(re, (...m) => { n++; return typeof to === 'function' ? to(...m) : to; }); };
  sub(/<html\b([^>]*)>/i, (_, a) => `<html${a} data-app="charts">`);
  sub(/<link\b[^>]*\brel=["']manifest["'][^>]*>/i, '<link rel="manifest" href="/charts.webmanifest">');
  sub(/<title>[^<]*<\/title>/i, '<title>Aureum Charts</title>');
  sub(/<meta\b[^>]*\bname=["']apple-mobile-web-app-title["'][^>]*>/i, '<meta name="apple-mobile-web-app-title" content="Charts">');
  if (n !== 4) throw new Error(`charts-app: expected 4 head changes, made ${n}`);
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const out = path.resolve(process.argv[2] || 'out');
  fs.writeFileSync(path.join(out, 'charts.html'), chartsPage(fs.readFileSync(path.join(out, 'market-structure.html'), 'utf8')));
  console.log('charts-app: out/charts.html');
}

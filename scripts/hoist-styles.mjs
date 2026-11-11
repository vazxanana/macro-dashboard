// Desk load, build step (scripts/build.sh, right after the pages are copied). Usage: node scripts/hoist-styles.mjs out/a.html ...
// The Desk keeps each feature's <style> block next to its markup and script, far down a 1.5 MB page. A browser paints the top of
// the body as soon as it has it, so on a slow connection the first screen (the sign-in card, the home header) was drawn with the
// head's rules only and restyled seconds later, when each later block arrived: the sign-in card changed height by 230 px.
// This step moves every <style> element of the body to the end of the <head>, in the order they appear. Every head rule still
// comes before every moved rule and the moved ones keep their order, so the cascade is the same; only the moment the rules
// arrive changes. Text inside <script> elements and comments is never touched (a script may hold '<style>' in a string).
// The page sources stay as they are: never move these blocks by hand.
import fs from 'node:fs';

// Returns the page with the body's style elements at the end of the head. Unchanged without a </head> or with nothing to move.
// Running it twice gives the same page.
export function hoist(html) {
  const TOK = /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<\/head\s*>/gi;
  let head = -1, out = '', last = 0, m; const moved = [];
  while ((m = TOK.exec(html))) {
    const t = m[0];
    if (head < 0) { if (/^<\/head/i.test(t)) head = m.index; continue; }   // nothing in the head moves
    if (!/^<style/i.test(t)) continue;                                      // scripts and comments stay, whatever they contain
    let end = m.index + t.length; if (html[end] === '\n') end++;            // the block's own line goes with it
    out += html.slice(last, m.index); last = end; moved.push(t);
  }
  if (head < 0 || !moved.length) return html;
  out += html.slice(last);
  return out.slice(0, head) + moved.join('\n') + '\n' + out.slice(head);
}

if (process.argv[1] && process.argv[1].endsWith('hoist-styles.mjs')) {
  let n = 0;
  for (const f of process.argv.slice(2)) { const a = fs.readFileSync(f, 'utf8'), b = hoist(a); if (b !== a) { fs.writeFileSync(f, b); n++; } }
  console.log(`hoist-styles: body styles moved to the head in ${n} of ${process.argv.length - 2} pages`);
}

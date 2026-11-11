// Shared by the browser audits (academy.cjs, chronostrade.cjs, smoke.cjs). Not an audit itself.
//
// settle(page)      waits until the page has no CSS transition or finite animation running or waiting to start, and has
//                   stayed that way for two frames. Returns [] when it settled, else the names of what still ran at the
//                   time limit (a check must then FAIL: a colour read during a transition is neither theme's colour).
// measured(page, expr, what)
//                   the one way an audit reads colours: settle first, then evaluate `expr` once. `expr` must return
//                   { bad: [...], n } where n is the number of elements it really measured. Returns the list of faults;
//                   "nothing was measured" and "did not settle" are faults, so a selector that matches nothing fails.
// fetchRetry(url)   a GET for the audits' proxies (live candles, council-data): up to three tries on a network error,
//                   a 429 or a 5xx, and the answer of a URL is kept for the run, so a reload gets the same bytes.
//
// Why settle exists (11 Nov 2026). A computed colour read right after a theme change can be the OLD theme's. Shown on the
// Academy page: under `prefers-reduced-motion: reduce` the shared rule `* { transition-duration: .01ms !important }`
// gave EVERY element a transition on every property (transition-property defaults to `all`). A theme change then
// started a transition on <html>'s colour; each child inherits the parent's still-old value, sees it change one frame
// later and starts its own transition, and so on down the tree: one frame per level, 6-7 frames for the deepest text
// (about 260 ms on an idle machine, 700 ms at a sixth of the speed), while backgrounds set straight from a token changed in
// the first frame. A fixed wait is a bet on the frame rate; a busy runner loses it. The pages now use 0s there (no
// transition is started), and the audits wait on the transitions themselves instead of on a clock.
const SETTLE = String.raw`(async (max) => {
  const t0 = performance.now(), left = () => max - (performance.now() - t0);
  const live = () => document.getAnimations().filter((a) => { try { const t = a.effect && a.effect.getComputedTiming(); return t && t.iterations !== Infinity && t.endTime !== Infinity && (a.pending || a.playState === 'running'); } catch (e) { return false; } });
  const name = (a) => { const t = a.effect && a.effect.target; return (a.transitionProperty || a.animationName || 'animation') + ' on ' + (t ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') : '?'); };
  const frame = () => new Promise((r) => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 250); });   // a page that paints no frame still moves on
  let quiet = 0;
  while (quiet < 2) {
    const a = live();
    if (!a.length) quiet++;
    else { quiet = 0; if (left() <= 0) return [...new Set(a.map(name))].slice(0, 6); await Promise.race([Promise.allSettled(a.map((x) => x.finished)), new Promise((r) => setTimeout(r, Math.max(0, left())))]); }
    await frame();
  }
  return [];
})`;
const settle = (page, max = 8000) => page.evaluate(SETTLE + '(' + Number(max) + ')');

async function measured(page, expr, what = 'text') {
  const moving = await settle(page);
  if (moving.length) return ['colours were still changing after 8 s, nothing was measured: ' + moving.join(', ')];
  const r = await page.evaluate(expr);
  if (!r || !Array.isArray(r.bad) || typeof r.n !== 'number') throw new Error('measured(): the expression must return { bad, n }');
  if (r.n < 1) return ['nothing was measured: no visible ' + what + ' matched'];
  return r.bad;
}

const kept = new Map(), last = new Map();
function fetchRetry(url, { tries = 3, timeout = 15000 } = {}) {
  if (kept.has(url)) return kept.get(url);
  const one = async () => {
    let last = { status: 503, body: Buffer.from('{}'), type: 'application/json', tries: 0 };
    for (let i = 1; i <= tries; i++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
        last = { status: r.status, body: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'application/octet-stream', tries: i };
        if (r.status !== 429 && r.status < 500) return last;
      } catch (e) { last = { status: 503, body: Buffer.from('{}'), type: 'application/json', tries: i, error: String(e && e.message || e).split('\n')[0] }; }
      if (i < tries) await new Promise((r) => setTimeout(r, 600 * i));
    }
    return last;
  };
  const p = one(); kept.set(url, p);
  p.then((x) => { last.set(url, x); if (x.status === 429 || x.status >= 500) kept.delete(url); });   // a failed answer is not kept: the next request tries again
  return p;
}
// every URL asked for in this run with its latest answer (failed ones included), for the audit's closing line
const fetched = async () => { await Promise.all([...kept.values()]); return [...last]; };

module.exports = { settle, measured, fetchRetry, fetched, SETTLE };

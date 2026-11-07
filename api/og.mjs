// Link-preview image with the live gold price (Vercel OG / Satori), used by og:image and twitter:image.
// /api/og -> 1200x630 PNG: brand, XAU/USD spot from OANDA (H1 closes for the last 2 days as a line), and the day's change.
import { ImageResponse } from '@vercel/og';
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c != null && c !== false) } });

async function gold(host) {
  try {
    const r = await fetch(`https://${host}/md/bars?sym=xau&tf=1h&n=48`, { signal: AbortSignal.timeout(5000) });
    const j = await r.json(); return Array.isArray(j.bars) && j.bars.length ? j.bars : null;
  } catch (e) { return null; }
}
export default async function handler(req, res) {
  const bars = await gold(req.headers.host);
  const W = 1200, H = 630, last = bars ? bars[bars.length - 1].close : null, ref = bars && bars.length > 24 ? bars[bars.length - 25].close : bars ? bars[0].close : null;
  const ch = last && ref ? last - ref : 0, pct = ref ? ch / ref * 100 : 0, up = ch >= 0, col = up ? '#2bd4a4' : '#ff5c7a';
  let path = '';
  if (bars) {
    const c = bars.map((b) => b.close), lo = Math.min(...c), hi = Math.max(...c), cw = 1040, ch2 = 190;
    path = c.map((v, i) => `${i ? 'L' : 'M'}${(i / (c.length - 1) * cw).toFixed(1)},${(ch2 - (v - lo) / (hi - lo || 1) * ch2).toFixed(1)}`).join(' ');
  }
  const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const el = h('div', { width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 80px', background: 'linear-gradient(160deg, #0f1420 0%, #08090c 70%)', color: '#eceef2', fontFamily: 'sans-serif' },
    h('div', { display: 'flex', alignItems: 'center', gap: 18 },
      h('div', { width: 44, height: 44, borderRadius: 22, background: 'radial-gradient(circle at 35% 30%, #ffe08a, #c99400 60%, #7a5a00)', display: 'flex' }),
      h('div', { fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }, 'Meridian X'),
      h('div', { fontSize: 24, color: '#8a94a8', marginLeft: 8 }, 'trading desk')),
    h('div', { display: 'flex', flexDirection: 'column', gap: 10 },
      h('div', { fontSize: 28, color: '#a4abb8' }, 'Gold · XAU/USD spot'),
      h('div', { display: 'flex', alignItems: 'baseline', gap: 28 },
        h('div', { fontSize: 112, fontWeight: 700, letterSpacing: -3 }, last ? fmt(last) : 'Live desk'),
        last ? h('div', { fontSize: 40, fontWeight: 600, color: col }, `${up ? '+' : '−'}${fmt(Math.abs(ch))} (${up ? '+' : '−'}${Math.abs(pct).toFixed(2)}%) 24h`) : null)),
    path ? h('svg', { width: 1040, height: 190 }, { type: 'path', props: { d: path, fill: 'none', stroke: col, strokeWidth: 5, strokeLinejoin: 'round', strokeLinecap: 'round' } }) : h('div', { height: 190, display: 'flex' }),
  );
  // satori wants the svg children as a single element
  if (path) el.props.children[2] = { type: 'svg', props: { width: 1040, height: 190, viewBox: '0 0 1040 190', children: { type: 'path', props: { d: path, fill: 'none', stroke: col, strokeWidth: 5, strokeLinejoin: 'round', strokeLinecap: 'round' } } } };
  const img = new ImageResponse(el, { width: W, height: H });
  const buf = Buffer.from(await img.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600');
  res.status(200).send(buf);
}

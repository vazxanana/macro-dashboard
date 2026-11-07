// Runtime switches kept in Vercel Edge Config (store "meridian-flags"), so they change in seconds without a redeploy.
//   runMode      "" | "live" | "council" | "ict" | "council,ict" — overrides the RUN_MODE env var when set
//   paused       ["council"] / ["ict"] / ["all"] — those crons do nothing until removed
//   notice       text shown as a bar across the top of the dashboard ("" hides it); noticeLevel "info" | "warn"
// EDGE_CONFIG is the store's connection string (https://edge-config.vercel.com/<id>?token=<token>), set on the project.
let cache = null, at = 0;
module.exports = async function flags() {
  if (cache && Date.now() - at < 10e3) return cache;
  const cs = process.env.EDGE_CONFIG; if (!cs) return {};
  try {
    const u = new URL(cs), id = u.pathname.replace(/^\/+/, ''), tok = u.searchParams.get('token');
    const r = await fetch(`https://edge-config.vercel.com/${id}/items`, { headers: { Authorization: `Bearer ${tok}` }, signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`Edge Config ${r.status}`);
    cache = await r.json(); at = Date.now(); return cache;
  } catch (e) { console.warn(`[flags] ${e.message}`); return cache || {}; }
};

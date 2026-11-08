// Council · live runner (8 Nov 2026, owner: "2 minutes difference in a trade is a lot" / "i can leave my laptop always on").
//
// One always-on process on the owner's laptop that runs the Trader and the cTrader demo mirror every LIVE_EVERY seconds
// (default 30), so a council trade reaches the demo within seconds of the candle that made it, instead of the council
// workflow's 2-5 minute cadence. The heavy members (Analyst, Coach, Macro, veteran, data check, digest, research ledger) stay
// in the GitHub Actions loop; it sees this runner's heartbeat (council-data live.json) and skips its own Trader + mirror
// steps while the heartbeat is fresh, so there is one writer of trades.json at a time. If the laptop sleeps or loses the
// network the heartbeat goes stale and the workflow takes the Trader back by itself.
//
// Secrets live in a .env file OUTSIDE the repository (LIVE_ENV, default %USERPROFILE%\meridianx\.env), never in the repo, never
// logged, never written into .git/config (the GitHub token goes in a per-command header). Names only:
//   GH_TOKEN           push access to this repository's council-data branch (fine-grained: Contents read/write)
//   OANDA_TOKEN        optional: with it the Trader reads candles from a LOCAL proxy (api/bars.js wrapped in node:http), so the
//                      30-second cadence costs no Vercel function calls; without it the Trader uses the site's /md proxy
//   OANDA_ENV          practice (default) or live: only the candle feed, nothing is traded at OANDA
//   CTRADER_MIRROR, CTRADER_CLIENT_ID, CTRADER_CLIENT_SECRET, CTRADER_ACCESS_TOKEN, CTRADER_REFRESH_TOKEN, CTRADER_ACCOUNT_ID,
//   CTRADER_ENV        the demo mirror (same names as the workflow; demo accounts only, as always)
//   NTFY_TOPIC, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, FUT_ACCOUNT, FUT_RISK   optional, as in the workflow
//   LIVE_EVERY=30 LIVE_PUSH_EVERY=300 LIVE_DATA=<dir> LIVE_PORT=8787 LIVE_REPO=vazxanana/macro-dashboard   optional
// Usage: node council/live.mjs            (scripts/live/run-live.cmd keeps it running and restarts it on new council code)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO_DIR = path.resolve(HERE, '..');
export const FRESH_SEC = 180;   // a heartbeat older than this means the runner is down: the workflow takes the Trader back
export const PUSH_FILES = ['trades.json', 'ctrader/mirror.json', 'ctrader/tokens.json', 'live.json'];   // a change here is pushed at once

// ---- pure helpers (tested in tests/live.test.mjs) -------------------------------------------------------------------------
// KEY=VALUE lines, # comments, optional quotes; never echoes values
export function parseEnv(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('='); if (i <= 0) continue;
    const k = line.slice(0, i).trim(), v0 = line.slice(i + 1).trim(), v = /^(["']).*\1$/.test(v0) ? v0.slice(1, -1) : v0;
    if (/^[A-Z_][A-Z0-9_]*$/.test(k)) out[k] = v;
  }
  return out;
}
// the heartbeat the workflow reads: fresh = this runner is alive and owns the Trader
export const isFresh = (hb, now = Math.floor(Date.now() / 1000), fresh = FRESH_SEC) => !!(hb && hb.at && Number.isFinite(Date.parse(hb.at)) && now - Date.parse(hb.at) / 1000 <= fresh);
// push when a trading file changed, or the periodic snapshot push is due
export function shouldPush(changed, lastPush, now, every) {
  if (changed.some((f) => PUSH_FILES.includes(f.replace(/\\/g, '/')))) return 'trade files changed';
  if (changed.length && now - lastPush >= every) return 'periodic';
  return null;
}
// the secrets never reach a log line: every value in env that is longer than 6 characters is masked
export const scrubber = (env) => { const vals = Object.values(env).filter((v) => v && v.length > 6).sort((a, b) => b.length - a.length); return (s) => vals.reduce((t, v) => t.split(v).join('[secret]'), String(s)); };
// a tiny req/res shim so the site's Vercel handler (api/bars.js, CommonJS) serves candles on localhost
export function serveHandler(handler, req, res) {
  const u = new URL(req.url, 'http://127.0.0.1'); const q = Object.fromEntries(u.searchParams.entries());
  let status = 200; const headers = {};
  const shim = { setHeader: (k, v) => { headers[k] = v; }, status: (c) => { status = c; return shim; }, json: (o) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(o)); return shim; }, end: (s) => { res.writeHead(status, headers); res.end(s); } };
  return Promise.resolve(handler({ query: q, url: req.url, method: req.method, headers: req.headers }, shim)).catch((e) => { try { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(e.message || e) })); } catch (x) {} });
}

// ---- process ---------------------------------------------------------------------------------------------------------------
function loadEnv() {
  const file = process.env.LIVE_ENV || path.join(os.homedir(), 'meridianx', '.env');
  let text = ''; try { text = fs.readFileSync(file, 'utf8'); } catch (e) { console.error(`live: no .env at ${file} (set LIVE_ENV to its path)`); }
  const env = { ...parseEnv(text), ...process.env };   // the shell wins over the file
  return { env, file };
}
function git(dir, args, env, { header = true, quiet = false } = {}) {
  const auth = header && env.GH_TOKEN ? ['-c', `http.https://github.com/.extraheader=Authorization: Basic ${Buffer.from(`x-access-token:${env.GH_TOKEN}`).toString('base64')}`] : [];
  const r = spawnSync('git', [...auth, '-C', dir, ...args], { encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (r.status !== 0 && !quiet) console.error(`live: git ${args[0]} failed: ${(r.stderr || '').trim().slice(0, 300)}`);
  return r;
}
function node(script, args, env, scrub) {
  const t0 = Date.now(), r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, cwd: REPO_DIR, timeout: 240000 });
  const out = scrub(((r.stdout || '') + (r.stderr || '')).trim()); if (out) console.log(out.split('\n').slice(-6).join('\n'));
  return { ok: r.status === 0, ms: Date.now() - t0 };
}
function startProxy(env, port) {
  if (!env.OANDA_TOKEN) return null;
  const require = createRequire(import.meta.url), handler = require(path.join(REPO_DIR, 'api', 'bars.js'));
  process.env.OANDA_TOKEN = env.OANDA_TOKEN; if (env.OANDA_ENV) process.env.OANDA_ENV = env.OANDA_ENV;
  const srv = http.createServer((req, res) => { if (req.url.startsWith('/md/bars')) serveHandler(handler, req, res); else { res.writeHead(404); res.end(); } });
  srv.listen(port, '127.0.0.1'); return srv;
}

export async function main() {
  const { env, file } = loadEnv(), scrub = scrubber(env);
  const repo = env.LIVE_REPO || 'vazxanana/macro-dashboard', every = Math.max(10, +env.LIVE_EVERY || 30), pushEvery = Math.max(60, +env.LIVE_PUSH_EVERY || 300);
  const data = path.resolve(env.LIVE_DATA || path.join(REPO_DIR, '..', 'council-data')), port = +env.LIVE_PORT || 8787;
  if (!env.GH_TOKEN) { console.error('live: GH_TOKEN missing in the .env: the runner cannot publish the council data. Stopping.'); process.exit(2); }
  if (!fs.existsSync(path.join(data, '.git'))) {
    console.log(`live: cloning council-data into ${data}`);
    const r = git(REPO_DIR, ['clone', '-q', '--branch', 'council-data', '--single-branch', `https://github.com/${repo}.git`, data], env);
    if (r.status !== 0) process.exit(2);
    git(data, ['config', 'user.name', 'mosha-live'], env, { header: false }); git(data, ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], env, { header: false });
  }
  const proxy = startProxy(env, port);
  const childEnv = { ...process.env, ...env, ...(proxy ? { MD_BASE: `http://127.0.0.1:${port}/md/` } : {}) };
  console.log(`live: every ${every}s, data ${data}, env ${file}, candles ${proxy ? `local proxy :${port} (OANDA ${env.OANDA_ENV || 'practice'})` : 'site /md proxy (set OANDA_TOKEN to avoid Vercel calls)'}, mirror ${env.CTRADER_MIRROR === 'on' ? 'on' : 'off'}`);
  let lastPush = 0, loops = 0, lastMainCheck = 0, mainSha = null;
  const hbFile = path.join(data, 'live.json');
  for (;;) {
    const t0 = Date.now(), now = Math.floor(t0 / 1000);
    git(data, ['pull', '-q', '--rebase', 'origin', 'council-data'], env, { quiet: true }) .status !== 0 && git(data, ['rebase', '--abort'], env, { header: false, quiet: true });
    const tr = node(path.join(REPO_DIR, 'council', 'trader.mjs'), [data], childEnv, scrub);
    const mi = node(path.join(REPO_DIR, 'council', 'ctrader-mirror.mjs'), [data], childEnv, scrub);
    loops++;
    const hb = { at: new Date().toISOString(), host: os.hostname().slice(0, 24), every, loops, traderMs: tr.ms, traderOk: tr.ok, mirrorMs: mi.ms, mirrorOk: mi.ok, proxy: !!proxy, v: 1 };
    fs.writeFileSync(hbFile, JSON.stringify(hb, null, 1));
    const changed = (git(data, ['status', '--porcelain'], env, { header: false }).stdout || '').split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
    const why = shouldPush(changed, lastPush, now, pushEvery);
    if (why) {
      git(data, ['add', '-A'], env, { header: false }); git(data, ['commit', '-q', '-m', `Council live ${hb.at.slice(0, 16)}Z (${why})`], env, { header: false, quiet: true });
      let pushed = false;
      for (let j = 0; j < 3 && !pushed; j++) { if (git(data, ['pull', '-q', '--rebase', 'origin', 'council-data'], env, { quiet: true }).status !== 0) git(data, ['rebase', '--abort'], env, { header: false, quiet: true });
        pushed = git(data, ['push', '-q', 'origin', 'HEAD:council-data'], env, { quiet: j < 2 }).status === 0; }
      if (pushed) lastPush = now;
    }
    // new council code on main: hand over to the wrapper (exit 3 -> run-live.cmd pulls and restarts)
    if (now - lastMainCheck >= 600) { lastMainCheck = now; const r = git(REPO_DIR, ['ls-remote', '-q', `https://github.com/${repo}.git`, 'refs/heads/main'], env, { quiet: true });
      const sha = (r.stdout || '').split(/\s/)[0] || null; if (mainSha && sha && sha !== mainSha) { console.log('live: new council code on main, restarting'); if (proxy) proxy.close(); process.exit(3); } if (sha) mainSha = sha; }
    const spent = (Date.now() - t0) / 1000; console.log(`live: loop ${loops} ${spent.toFixed(0)}s (trader ${(tr.ms / 1000).toFixed(0)}s${tr.ok ? '' : ' FAILED'}, mirror ${(mi.ms / 1000).toFixed(0)}s${mi.ok ? '' : ' FAILED'})${why ? ` · pushed: ${why}` : ''}`);
    await new Promise((r) => setTimeout(r, Math.max(2, every - spent) * 1000));
  }
}

if (process.argv[1] && process.argv[1].endsWith('live.mjs')) main().catch((e) => { console.error('live: fatal', e && e.message); process.exit(1); });

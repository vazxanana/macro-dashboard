# Meridian X on Cloudflare: the move, stage by stage

Owner's decision, 16 Nov 2026: move the whole site from Vercel to Cloudflare Workers, on the Workers Paid plan
($5 a month, approved the same day: the free plan's 10 ms of processing a request is too little for `/cdata`, the
ICT lab and the edge analyst). Vercel stays live and unchanged until the last stage; the domain moves only after
every page and endpoint has been checked side by side.

## How it works (`cloudflare/`)

- `cloudflare/wrangler.jsonc`: one Worker, `meridianx`. `out/` (the committed build, checked by CI) is its static
  assets; the Worker runs first on every request (`run_worker_first`), so vercel.json stays the one list of
  rewrites and headers.
- `cloudflare/src/routes.mjs`: vercel.json's `rewrites` (first match wins) and `headers` (every match, later wins,
  on the address asked for), read from vercel.json at build time.
- `cloudflare/src/adapter.mjs`: runs the api/ handlers UNCHANGED. It gives them Vercel's Node request / response
  (`req.method / url / headers / query / body`, `res.status / setHeader / json / send / end / write / writeHead /
  redirect`), parses bodies by content type as Vercel does, streams server-sent events (`/md/stream`), and sets
  `x-real-ip` / `x-forwarded-for` from Cloudflare's `cf-connecting-ip` (what a client sends is dropped: the
  sign-in rate limit counts by that address).
- `cloudflare/src/worker.mjs`: `/api/<name>` → `api/<name>.js`; everything else → `out/` (a path ending in `/`
  gets `index.html`, `/macro` finds `/macro/index.html`). Crons: `* * * * *` → `/api/alert-cron`, `*/10 * * * *`
  → `/api/edge-analyst?job=scan`, both with `Authorization: Bearer <CRON_SECRET>` as Vercel's crons sent.
- Tests: `tests/cloudflare-worker.test.mjs` (offline). Local run: `cd cloudflare && npm install && npx wrangler dev`
  (put test values in `cloudflare/.dev.vars`, git-ignored).

## Stage 1 (done 16 Nov 2026, in the repository, nothing deployed)

Checked locally with `wrangler dev`: `/`, every page, `/gold`, `/macro`, `/veteran/`, versioned and unversioned
assets with their cache headers, the manifest's type, the security headers, `/cdata/trades.json` cut for a guest
(1.4 KB), `/api/me`, `/api/status`, sign-in failing closed while the user list cannot be read, a missing page 404,
`/api/run` 410, `/api/og` → the icon.

## Stage 2 (needs the Cloudflare account; deployed from GitHub Actions or the owner's computer, see step 3)

1. Upgrade the account to **Workers Paid** (Dashboard → Workers & Pages → Plans). The owner approved it.
2. **Secrets.** Copy each value from Vercel (Project → Settings → Environment Variables) into the Worker with
   `npx wrangler secret put <NAME>` (run in `cloudflare/`). The owner copies the values: they are never read out of
   Vercel by an assistant, and never pasted into a chat. Keep the SAME values for `SESSION_SECRET`,
   `CTRADER_LINK_KEY` and `CRON_SECRET`: the session key and every connector key (Fred's ICT connector, the Academy
   assistant, the Mosha assistant) are derived from them, so new values sign everyone out and change those keys.
   Names the functions read: `OANDA_TOKEN` (`OANDA_ENV`), `CRON_SECRET`, `SESSION_SECRET`, `CTRADER_LINK_KEY`,
   `CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, `CTRADER_REDIRECT_URI`, `GH_TOKEN`, `GH_READ_TOKEN`, `GH_MCP_TOKEN`,
   `GH_DISPATCH_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `EDGE_CONFIG`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NTFY_TOPIC`, `TV_WEBHOOK_KEY`, `MCP_KEYS`, `MCP_ORIGINS`,
   `MOSHA_ASSISTANT_KEY`, `MOSHA_READER`, `MOSHA_READER_SALT`, `ACADEMY_CONNECTOR*`, `ACADEMY_LLM_*`, `EDGE_LLM_*`,
   `EDGE_ANALYST`, `RUN_MODE`, `COUNCIL_ALERTS`. Only those set on Vercel need copying.
3. Deploy → the site on `meridianx.meridianx-cloudflare.workers.dev`. Storage still Vercel's Blob store and
   Edge Config, reached over HTTPS with the same tokens, so both sites read and write the same data.
   **Deploy with GitHub Actions** (`.github/workflows/cloudflare-deploy.yml`, free: the repo is public): add the
   repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit) and `CLOUDFLARE_ACCOUNT_ID`, then Actions →
   "Cloudflare deploy" → Run workflow (or re-run its last run). It also runs on a push to the Cloudflare branches.
   It sets no Worker secrets (step 2 stays the owner's) and never touches Vercel or DNS. A cloud assistant session
   cannot deploy itself (16 Nov 2026): its network proxy puts the saved Cloudflare token on every request to
   `api.cloudflare.com`, including the asset upload, which must carry the upload session's own key (401). Locally,
   `npx wrangler login && npx wrangler deploy` in `cloudflare/` does the same.
4. Side-by-side check on the workers.dev address: the smoke and ChronosTrade audits (`PORT` / base URL), sign-in
   as each member, `/cdata` for a guest and a member, `/md/bars`, `/md/stream`, price alerts, the connectors.

## Stage 3 (code still to port; each a small change of its own)

- **Academy** (`api/academy.js`) reads `academy/` files from disk; Workers have no project files. Bundle what it
  reads as modules, or move them to R2.
- **Bridge downloads** (`api/bridge.js`) read `mt5/CouncilBridge.mq5` and `ctrader/CouncilBridge.cs` from disk:
  bundle them as text modules.
- **Fred's connector**: `validateProposal` checks syntax with `node --check` in a child process; Workers have none.
  Replace with a JavaScript parser (no new network access).
- **Link preview image** (`api/og.mjs`, @vercel/og): answers with the site icon until ported.
- **Storage to Cloudflare**: the Blob store (users, profiles, notices, sounds, Mosha log and lessons, Academy, price
  alerts, cTrader links, TradingView log) → R2 through a binding (no access keys); Edge Config (`runMode`, `paused`,
  `notice`) → KV. One copy, then Vercel's Blob store is read-only.
- **Retired**: the backup council runner (`api/run.js`, crons council / ict) starts the Trader as a child process
  and writes files, which Workers do not allow. GitHub Actions and the VPS runner run the council.

## Stage 4: the domain

Move meridianx.dev's DNS to Cloudflare, add the Worker as its custom domain, recreate the firewall rules (scanner
paths, writes outside /api, rate limits: /cdata 600 / min, /api 30 / min, /md 900 / min per IP; no timed blocks;
no bot challenge on `/cdata/mt5/signals.csv`, the broker bridges read it without a browser). Keep Vercel running a
week, then pause the project.

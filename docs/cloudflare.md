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
- `cloudflare/src/bundled.mjs`: the project files two handlers read from disk on Node (vercel.json `includeFiles`),
  bundled into the Worker as text modules (wrangler.jsonc `rules`: strings inside the Worker's script, never static
  assets): the Academy's generated data and the two bridge EA sources. It hands them over with `academy.useData` and
  `bridge.useFiles`; on Node and Vercel nothing calls those and the disk is read as before. `src/academy-data.mjs`
  reads the Academy's files the way `api/academy.js` `fileData()` does, parsing a file on its first request only.
- Tests: `tests/cloudflare-worker.test.mjs`, `tests/cloudflare-bundle.test.mjs` (offline). Local run: `cd cloudflare &&
  npm install && npx wrangler dev` (put test values in `cloudflare/.dev.vars`, git-ignored). Size of what a deploy
  uploads: `npx wrangler deploy --dry-run --outdir <dir>` prints it.

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
   Names the functions read: `OANDA_TOKEN` (`OANDA_ENV`: `practice` or unset for a practice-account token, `live` only for a
   live one; `OANDA_ACCOUNT_ID` optional, lets the live price stream skip OANDA's account lookup), `CRON_SECRET`, `SESSION_SECRET`, `CTRADER_LINK_KEY`,
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

**State on 16 Nov 2026 (stage 2 done):** the Worker is live at https://meridianx.meridianx-cloudflare.workers.dev, deployed by
the Actions workflow after the owner added the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The
Vercel project is gone from team `xau`, so old secret values could not be copied: `SESSION_SECRET`, `CRON_SECRET` and
`CTRADER_LINK_KEY` are NEW values (everyone signs in again; Fred's connector, the Academy and Mosha assistant keys changed:
new links from the Profile page). The Vercel Blob store `meridian-users` still answers, through `BLOB_READ_WRITE_TOKEN`.
`OANDA_TOKEN` is a practice-account token (`OANDA_ENV` practice). Checked: every page and short address 200, no page error
or sideways scroll (phone signed out, phone guest, desktop), guest `/cdata` cut, protected files 401, sign-in refuses a wrong
password, `/md/bars` candles for gold, silver, NAS100 and forex. The live stream answered `OANDA accounts 504` until
`OANDA_ACCOUNT_ID` is set. Not yet set: VAPID keys (price-alert pushes), `GH_MCP_TOKEN`, the cTrader client trio,
`GH_READ_TOKEN`, `EDGE_CONFIG`, `TV_WEBHOOK_KEY`. The council reads candles from the Worker (`MD_BASE` in `council.yml`).
The zone `meridianx.dev` is on Cloudflare's Free plan: one rate-limiting rule (10 s window) only, and a Skip rule cannot turn
off Bot Fight Mode, so Bot Fight Mode must stay OFF (the broker bridges read `/cdata/mt5/signals.csv` without a browser).

**Domain (16 Nov 2026):** the site is at https://aureumdesk.co.uk and www.aureumdesk.co.uk (zone in this account, active, the
Worker as custom domain, certificate active). meridianx.dev is no longer used. Both are recorded in `wrangler.jsonc` `routes`
(`custom_domain: true`), so a deploy keeps them; the workers.dev address stays on (`workers_dev: true`). From then on a deploy
also sends the two domains: wrangler asks the account which change they need (none while both are this Worker's) and puts them
on this Worker, overriding another Worker's claim or a clashing DNS record when it runs without a terminal (CI). If the deploy
token may not manage the Worker's custom domains, the new code is still uploaded and the deploy reports an error at that step. **Backup:** every Vercel Blob file is copied into
the KV namespace `meridianx-blob-backup` (48 files, 1.6 MB on 16 Nov), then again daily; nothing is deleted on either side.

## Stage 3 (code still to port; each a small change of its own)

- **Academy** (done 16 Nov 2026): `api/academy.js` reads its generated files from disk on Node; on the Worker they are
  bundled as text modules (`src/bundled.mjs`): per edge `academy/data/cand-`, `out-` and `feat-<edge>.json`, plus
  `calendar.json`, `research.json`, `eval.json` and `ml/models/index.json` (the registry `academy/edges.mjs` is plain
  code and is bundled as such). Each file is parsed on its first request in an instance, so no other route pays for the
  Academy's 2.5 MB. The API's own checks decide what leaves it, as on Vercel: no outcome before an attempt is stored, the
  exam pool apart, the files never served as assets; nothing of `academy/archive/` is bundled. A file the Academy starts
  to read must be added to `src/bundled.mjs` (`tests/cloudflare-bundle.test.mjs` compares the list with the disk reads of
  `fileData()`); regenerated data reaches the Worker with its next deploy (the deploy workflow's push paths do not list
  `academy/` or `ml/`). Its store stays the Blob store (`BLOB_READ_WRITE_TOKEN`): never set `ACADEMY_STORE_DIR` on the
  Worker, whose `/tmp` lasts one request (seen locally: an attempt stored, the next request did not see it).
- **Bridge downloads** (done 16 Nov 2026): `mt5/CouncilBridge.mq5` and `ctrader/CouncilBridge.cs` are bundled as text
  modules; the owner's session or password is checked by `api/bridge.js` as before.
- **Bundle size** (`npx wrangler deploy --dry-run`): 1,471 KiB (gzip 340 KiB) before these two, 4,022 KiB (gzip 671 KiB)
  after; Workers Paid allows 10 MB compressed.
- **Fred's connector** (done 16 Nov 2026): `validateProposal` checks a proposed module with `node --check` where a child
  process can start, else (Workers) by parsing it with acorn (bundled: `cloudflare/package.json`, `wrangler.jsonc` alias).
  The Worker's own address is in the connector's origin list (`api/mcp.js` `ORIGINS`), so the Profile card can fetch a link.
  Reads need `GH_READ_TOKEN`, writes `GH_MCP_TOKEN` (Worker secrets); without them GitHub's unsigned limit applies.
- **Link preview image** (`api/og.mjs`, @vercel/og): answers with the site icon, on purpose (checked 16 Nov 2026). The
  bundler takes the pinned @vercel/og 0.11.1's Worker build (`dist/index.edge.js`, 2.1 MB with its resvg and yoga wasm),
  and that build starts fetching its font at module scope from `new URL('./Geist-Regular.ttf', import.meta.url)`: in
  workerd that throws "Invalid URL string" while the Worker starts (tried locally: the runtime failed to start), so every
  route of the site would fail, not only the image. The other routes (workers-og; satori with @resvg/resvg-wasm) add two
  or more packages and about 2 MB of wasm, plus a TTF font (the site's own fonts are woff2, which satori cannot read).
  Revisit if @vercel/og ships a Worker build that starts, or the preview is worth that weight.
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

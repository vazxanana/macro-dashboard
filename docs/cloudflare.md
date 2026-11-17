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
Worker as custom domain, certificate active). meridianx.dev is no longer used. **Backup:** every Vercel Blob file is copied into
the KV namespace `meridianx-blob-backup` (48 files, 1.6 MB on 16 Nov), then again daily; nothing is deleted on either side.

## Stage 3 (code still to port; each a small change of its own)

- **Academy** (`api/academy.js`) reads `academy/` files from disk; Workers have no project files. Bundle what it
  reads as modules, or move them to R2.
- **Bridge downloads** (`api/bridge.js`) read `mt5/CouncilBridge.mq5` and `ctrader/CouncilBridge.cs` from disk:
  bundle them as text modules.
- **Fred's connector** (done 16 Nov 2026): `validateProposal` checks a proposed module with `node --check` where a child
  process can start, else (Workers) by parsing it with acorn (bundled: `cloudflare/package.json`, `wrangler.jsonc` alias).
  The Worker's own address is in the connector's origin list (`api/mcp.js` `ORIGINS`), so the Profile card can fetch a link.
  Reads need `GH_READ_TOKEN`, writes `GH_MCP_TOKEN` (Worker secrets); without them GitHub's unsigned limit applies.
- **Link preview image** (`api/og.mjs`, @vercel/og): answers with the site icon until ported.
- **Storage to Cloudflare**: the Blob store → the D1 file store below (built 17 Nov 2026, switch OFF until the lead
  throws it); Edge Config (`runMode`, `paused`, `notice`) → KV, still to do.

## File store on D1 (17 Nov 2026; behind the Worker secret `STORE`, OFF by default)

The Vercel account is blocked; its Blob store still answers and holds users, profiles, notices, sounds, the Mosha log,
lessons and pictures, Academy files, price alerts, cTrader links, the TradingView log, run reports and the bridge ping.
The site can keep them in the D1 database `aureum-data` (binding `STORE_DB` in `wrangler.jsonc`) instead.

**How it works.** The 15 api/ modules that use `@vercel/blob` are unchanged. `wrangler.jsonc` aliases `@vercel/blob` to
`src/store-blob.mjs` and the real package to `vercel-blob-real`. Every call (`put`, `list`, `del`, `head`, …) goes to the
real package unless the secret `STORE` is `d1` (case and spaces ignored); then to `src/store-d1.mjs`:
- Tables `store_blobs` (pathname, size, upload time in ms, content type, etag, chunk count, `src` = `vercel` for a copy the
  mirror made, `d1` for a file the site wrote here), `store_chunks` (base64, 768 KB of file a row; D1 keeps a row under
  2 MB; at most 16 MB a file, a bigger one is refused with "File is too large"), `store_gone` (when the site deleted a
  path), `store_state` (the mirror's state). Created on first use; no migration step.
- Same behaviour as Vercel where the handlers rely on it: `allowOverwrite` false refuses an existing path ("This blob
  already exists"), `addRandomSuffix` gives `name-<30 letters/digits>.ext`, list pages by `limit` (max 1000) and an opaque
  `cursor`, `uploadedAt` is a Date, `etag` changes on every write, deleting what is not there is no error, no token = the
  same "No blob credentials" error. A write here is newer than every file in the store (upload time = max(now, newest + 1 ms)).
  Not available in D1 mode (refused with a clear error; no handler uses them): `get`, `copy`, `rename`, multipart, image
  puts, `ifMatch`, folded lists. `tests/cloudflare-store.test.mjs` fails if a handler starts using another call or option.
- **Reading a file by its URL**: `list` / `put` give URLs on `https://d1.store.invalid/<path>`; `store-blob.mjs` wraps the
  Worker's `fetch` (worker.mjs imports it before any handler) so that host is answered from D1 inside the Worker, GET /
  HEAD only, only with `Authorization: Bearer <BLOB_READ_WRITE_TOKEN>`; `?cache=0` and `?download=1` are ignored. `.invalid`
  never resolves, so a store URL cannot leave the Worker. Every other request goes out as before.
- D1 reads go to its primary (no read replicas are used), so a write is read back at once: the stale reads of the Blob CDN
  ("Blob freshness audit" in CLAUDE.md) do not exist here. Writes are D1 transactions (a file and its chunks appear together).
- No module stores a blob URL in its data (lesson pictures are found by id, profile photos and sounds are data URLs inside
  their JSON), so nothing needs rewriting at the switch.
- **Fail closed**: in D1 mode the store answers only once `store_state` records `ready` (a complete copy was made by the
  mirror). Before that every call throws "the Cloudflare store is not ready", so sign-in answers 503 instead of falling back
  to the built-in accounts.
- **Keep `BLOB_READ_WRITE_TOKEN` set** in D1 mode (any value works once Vercel is gone): the handlers answer "storage not set
  up" without it, and it is the token store URLs are read with. The KV backup (`src/backup.mjs`) always reads the real Vercel
  store, whatever `STORE` says.

**The mirror** (`src/store-mirror.mjs`, from `scheduled` in `worker.mjs`, logged as `store mirror`):
- Switch OFF, every 10 minutes: copies every Vercel file that is new or changed (upload time / size), keeping Vercel's upload
  time, and deletes the copies of files Vercel no longer has (an unlink, a removed device, an old users file). At most 100
  files / 48 MB a run; the rest next run. A run with nothing left and nothing failed sets `ready` (the log says
  `"complete":true,"ready":"<time>"`). Unlike the KV backup, which keeps deleted files, this copy follows Vercel.
- Switch ON: ONE final pass copies the Vercel files written since the last mirror run: only a file newer than its D1 row and
  newer than any delete made here; the commit itself re-checks it, so a write made after the switch is never overwritten,
  even one made while the file is being copied. It also deletes copies of files Vercel deleted before the switch. It runs on
  the minute cron during the first hour after the switch is seen (then the 10-minute one) and stops for good once complete
  (`final pass done`).
- A file the site wrote in D1 mode is never overwritten or deleted by the mirror, also after a switch back (`kept` count).
- `STORE_MIRROR=off` (secret) stops the mirror in either mode (for example when Vercel's store is gone for good).

**To switch to D1 (lead):**
1. Deploy this code with `STORE` unset (nothing changes for the site). Watch the Worker logs (`npx wrangler tail` or the
   dashboard): `store mirror` lines every 10 minutes until one reads `"complete":true` with a `ready` time.
2. Right after a complete run (a quiet moment: no owner edits), set the secret: `npx wrangler secret put STORE` in
   `cloudflare/`, value `d1`. Secrets take effect at once (a new version).
3. Within a minute the log shows `store mirror … "mode":"d1" … "complete":true`, then `final pass done`. Check: sign in as
   a member, the notices, a profile photo, a Mosha lesson picture, the Users page.
4. Later, when Vercel is closed: set `STORE_MIRROR=off`; keep `BLOB_READ_WRITE_TOKEN` (any value).

**To switch back to Vercel:** `npx wrangler secret delete STORE` (or set it to anything but `d1`). The site reads and writes
Vercel again at once. **What that loses**: every write made while `STORE` was `d1` (accounts and passwords changed, profiles,
notices, lessons and pictures, the Mosha log, Academy saves, price alerts, cTrader links) is not on Vercel, so the site no
longer sees it. Nothing is deleted: those files stay in D1 (`src = 'd1'`, counted as `kept` in the mirror's log) and come
back with a later switch to D1 only where Vercel has no newer file; copying them back to Vercel is a manual step (not built).
A password changed in D1 mode reverts to the Vercel one, so check the Users page after a switch back.

Not verified against the real services: the mirror's reads of the real Vercel store (the backup has run the same calls), and
the store on the remote D1 database (checked on `wrangler dev --local`'s D1 with the real handlers: sign-in, a password
change read back at once, notices, profile photo). Not covered: two writes to one file at the same instant still keep the
last (as on Vercel).
- **Retired**: the backup council runner (`api/run.js`, crons council / ict) starts the Trader as a child process
  and writes files, which Workers do not allow. GitHub Actions and the VPS runner run the council.

## Stage 4: the domain

Move meridianx.dev's DNS to Cloudflare, add the Worker as its custom domain, recreate the firewall rules (scanner
paths, writes outside /api, rate limits: /cdata 600 / min, /api 30 / min, /md 900 / min per IP; no timed blocks;
no bot challenge on `/cdata/mt5/signals.csv`, the broker bridges read it without a browser). Keep Vercel running a
week, then pause the project.

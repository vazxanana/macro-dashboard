# Backing up Meridian X, and moving it to another platform

Written 12 Nov 2026 (owner: "do a backup of the whole website in case I need to change platform"). This lists every place
the site lives, how to keep a copy of each one, and what a move to another host involves. **No secret value is written here or
anywhere in this repository**: only names.

## 1. Where everything lives

| Part | Where it lives | Backed up by |
|---|---|---|
| The site's code (pages, assets, `api/` functions, council and ICT code, studies, tests) | GitHub `vazxanana/macro-dashboard`, branch `main` | GitHub itself; a full copy: section 2 |
| Everything the bots write (trades, snapshots, ICT, macro, cTrader records, research, reviews) | GitHub, branch `council-data` | the same copy (section 2) |
| The built site | `out/` on `main` (committed, CI checks it matches the build) | the same copy |
| Accounts you added or changed on the Users page, their password hashes and permissions | Vercel Blob store `meridian-users` (private) | **Profile → "Back up the site"** (section 3) |
| Profile photos and names, desk notifications, ChronosTrade sounds | the same Blob store | the same backup |
| The Mosha log, Luxus's lessons and their pictures, the book | the same Blob store | the same backup |
| The Academy (attempts, verdicts, lessons, sessions, audit trail, analyst answers) | the same Blob store | the same backup |
| The AI second opinion's answers and its spend record | the same Blob store | the same backup |
| Price-alert devices, cTrader link tokens, TradingView alerts, run reports | the same Blob store | the same backup |
| The runtime switches (`runMode`, `paused`, `notice`, `noticeLevel`) | Vercel Edge Config `meridian-flags` | inside the same backup (`flags`) |
| Secrets and settings (keys, tokens, passwords for services) | Vercel project environment variables; GitHub repository secrets / variables | **not copied anywhere** on purpose: keep them in your password manager (section 4) |
| Cron schedules, rewrites, function limits, cache rules | `vercel.json` in the repository | the repository |
| Firewall rules, domain `meridianx.dev`, DNS | Vercel project settings | written down in section 5 (set again by hand on a new host) |

On 12 Nov 2026 the Blob store held 48 files, 1.6 MB.

## 2. A full copy of the repository (code and the bots' data)

GitHub is independent of Vercel, so the code survives a change of host as it is. To keep your own copy as well, on any
computer with git:

```sh
git clone --mirror https://github.com/vazxanana/macro-dashboard.git meridianx-mirror.git
# later, to bring it up to date:
cd meridianx-mirror.git && git remote update
```

`--mirror` keeps every branch, `council-data` included (its history is large: about 7,000 commits, several hundred MB). For
the code alone, GitHub's "Code → Download ZIP" on `main` is enough.

## 3. The private data: Profile → "Back up the site"

Signed in as the owner, open **Profile** and press **Download a backup**. The page reads every stored file through
`/api/backup` (owner session only; in parts, since one answer is capped at about 4.5 MB) and saves one file,
`meridianx-backup-<date>.json`, holding:

- every file of the Blob store, at its own path, as it is stored now (text as text, pictures and sounds as base64);
- the Edge Config switches;
- for every environment variable the code reads, whether it is set (`true` / `false`), never its value.

**Keep this file private**: it holds the password hashes of every account and the cTrader link tokens. Never put it on
GitHub, in a shared folder or in a chat. Make a new one before any move and after big changes (new members, many lessons).

To check or use a backup, on any computer with Node 18 or later and a copy of the repository:

```sh
node scripts/backup-restore.mjs check meridianx-backup-2026-11-12.json         # what it holds, complete or not
node scripts/backup-restore.mjs files meridianx-backup-2026-11-12.json ./restored   # every file under ./restored, same paths
BLOB_READ_WRITE_TOKEN=<the new store's token> node scripts/backup-restore.mjs blob meridianx-backup-2026-11-12.json
                                                                                 # back into a (new) Vercel Blob store
```

`check` says "INCOMPLETE" when the backup has fewer files than the store had when it was made, and refuses a file whose size
does not match. `files` refuses any path that would leave the folder.

## 4. Secrets and settings to have at hand (names only)

Copy each value from Vercel → Project → Settings → Environment Variables (and GitHub → Settings → Secrets and variables) into
your password manager. The backup file's `env` block tells you which ones were set when it was made.

Vercel project:

| Name | What it is for |
|---|---|
| `SESSION_SECRET` (or `CTRADER_LINK_KEY` / `CRON_SECRET`) | signs sign-in sessions; a new value signs everyone out once |
| `CRON_SECRET` | guards the cron endpoints |
| `BLOB_READ_WRITE_TOKEN` | the private Blob store |
| `EDGE_CONFIG` | the runtime switches store |
| `OANDA_TOKEN`, `OANDA_ENV` | market candles and live prices (`/md/bars`, `/md/stream`) |
| `GH_TOKEN`, `GH_READ_TOKEN`, `GH_MCP_TOKEN`, `GH_DISPATCH_TOKEN` | reading / writing council-data, Fred's connector |
| `RUN_MODE` | whether the backup runner commits (Edge Config `runMode` wins) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | price-alert push; **keep the same pair** or every device must turn alerts on again |
| `NTFY_TOPIC`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `FUT_ACCOUNT`, `FUT_RISK` | phone alerts and futures tickets |
| `TV_WEBHOOK_KEY` | TradingView webhook |
| `MCP_KEYS`, `MCP_ORIGINS` | Fred's connector (optional) |
| `MOSHA_ASSISTANT_KEY`, `MOSHA_READER`, `MOSHA_READER_SALT` | the Mosha desk assistant's key |
| `ACADEMY_LLM_KEY`, `ACADEMY_LLM_URL`, `ACADEMY_LLM_MODEL`, `ACADEMY_LLM_FORMAT`, `ACADEMY_CONNECTOR*` | the Academy analyst and its connector |
| `EDGE_ANALYST`, `EDGE_LLM_*` | the AI second opinion and its budgets |
| `CTRADER_*` | the demo mirror and the cTrader link (demo only) |
| `MX_SW_KILL`, `MX_PREVIEW_BRANCH` | the installable app's kill switch; the one preview branch |

GitHub repository (Settings → Secrets and variables → Actions): `CTRADER_ACCESS_TOKEN`, `CTRADER_ACCOUNT_ID`,
`CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, `CTRADER_ENV`, `CTRADER_MIRROR`, `CTRADER_REFRESH_TOKEN`, `NTFY_TOPIC`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (secrets or variables), `FUT_ACCOUNT`, `FUT_RISK` (variables). These stay with the
repository and do not move with a change of web host.

The owner's password hash is in `api/_accounts.js` (`OWNER_HASH`); built-in members are in `BUILT_IN` there. Members added on
the Users page are in the Blob backup.

## 5. Settings written down (set them again by hand on a new host)

- **Domain**: `meridianx.dev` (production). Move its DNS to the new host.
- **Firewall** (Vercel WAF): deny scanner probes (PHP / WordPress / dot-file paths); deny POST / PUT / PATCH / DELETE outside
  `/api`; rate limits `/cdata` 600 a minute, `/api` 30 a minute, `/md` 900 a minute per IP; OWASP php / lfi / rfi / java /
  scanner-detection on deny, sqli / xss / rce / generic on log; no timed blocks. Bot protection stays off (the MT5 / cTrader
  bridges read `/cdata/mt5/signals.csv` without a browser).
- **Crons** (`vercel.json`): `/api/run?job=council` every 4 min, `/api/run?job=ict` at :04 / :19 / :34 / :49,
  `/api/alert-cron` every minute, `/api/edge-analyst?job=scan` every 10 min; each sends `Authorization: Bearer <CRON_SECRET>`.
  GitHub Actions (`council.yml`) is the main council runner and moves with the repository, not with the host.
- **Edge Config** values (12 Nov 2026): `runMode` "council", `paused` [], `notice` "", `noticeLevel` "info".

## 6. Moving the site to another host

What the site needs from a host:

1. **Static files**: serve `out/` (built by `sh scripts/build.sh`). Cache rules: HTML no-cache; `/assets/*?v=` immutable for a
   year; `/assets/*` without `?v=` revalidated (see `vercel.json` `headers`).
2. **Rewrites** (the 10 in `vercel.json` `rewrites`): `/gold`, `/macro-desk`, `/backtest`, `/academy` to their pages,
   `/macro-dashboard/*` → `/*`, `/cdata/<path>` → `/api/data?p=<path>`, `/md/bars` → `/api/bars`, `/md/stream` → `/api/stream`,
   `/api/mcp/<key>` → `/api/mcp?key=<key>`, `/api/academy-mcp/<key>` → `/api/academy-mcp?key=<key>`; plus the cache and security
   headers in `vercel.json` `headers`. Copy them into the new host's own format.
3. **Node functions**: every `api/*.js` (not `_*.js`, those are shared modules) is a Node handler `(req, res)` that uses
   `req.query`, `req.body`, `req.headers`, `res.status()`, `res.json()`, `res.setHeader()`, `res.end()`. Hosts that run such
   handlers (Netlify functions with an adapter, a small Node server) work; `council/live.mjs` `serveHandler` already wraps one
   behind plain `node:http` and is a model for a self-hosted server. `api/stream.js` needs a long-lived answer (up to 300 s);
   `api/run.js` up to 300 s and the files under `council/` and `ict/`; `api/mcp.js` the files under `ict/`.
4. **Storage**: the code calls Vercel Blob (`@vercel/blob`) for the private files and Edge Config for the switches. On another
   host either keep a Vercel Blob store and its token (it works from anywhere), or replace the store module's `get` / `put` /
   `list` (each store is a few lines, e.g. `blobStore` in `api/notify.js`) with the new host's storage and put the files back
   with `backup-restore.mjs files`. Without `EDGE_CONFIG` the switches read as empty (no notice, nothing paused, `RUN_MODE`
   from the environment).
5. **Crons**: the four schedules above, sending the `CRON_SECRET` bearer.
6. **Environment variables**: section 4.
7. **Not tied to Vercel**: GitHub Actions (the council loop, watchdog, CI, studies), the VPS live runner (`council/live.mjs`),
   the GitHub Pages copy (`deploy.yml`, no sign-in there).

Order for a move: make a fresh backup (section 3) → set up the new host with the environment variables → put the Blob files
back → deploy `main` → check sign-in, `/cdata`, `/md/bars`, a price alert and the Academy → move the domain's DNS → keep the
Vercel project for a week before deleting it.

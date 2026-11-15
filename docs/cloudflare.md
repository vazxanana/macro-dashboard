# Moving the site to Cloudflare (15 Nov 2026)

## What happened

Vercel blocked the account. meridianx.dev now answers "402 Payment Required", so the site and its sign-in are down.

The site is moving to Cloudflare, on the free plan. Everything Vercel served now runs as ONE Cloudflare "Worker":

- the pages (the built `out/` folder),
- the API (sign-in, `/cdata`, market data, price alerts, Fred's connector, the Academy, the Mosha desk, and the rest of `api/`),
- the private file store (users, profiles, notices, sounds, price alerts, Mosha lessons, the Academy). On Vercel this was
  "Blob". On Cloudflare it is a bucket called **meridianx-blob** (Cloudflare calls it R2).

The council itself does not move. It runs on GitHub Actions, as before. No rule, trade or demo account changes.

## What the free plan does not do

The free plan gives each request a small amount of computer time. Three things may not fit:

- **The backup council runner** (`/api/run`). It only ran when GitHub Actions stopped. GitHub Actions is the runner anyway,
  so nothing is lost day to day. The "council stopped" alert (watchdog) still works.
- **The backtest lab inside Fred's connector** (`ict_backtest`, `ict_compare`). A long test may be stopped for using too
  much time. Fred's other tools (trades, rules, files, proposals) are small and should work.
- **The link-preview picture** (the image shown when you paste the site's link in a chat). It may be missing. The link
  itself works.

The free plan also allows about 100,000 requests a day. The site uses far fewer.

## Step by step

### 1. Make a free Cloudflare account

Go to cloudflare.com and sign up. Choose the free plan. No card is needed.

### 2. Make an API token

1. In Cloudflare, click your profile (top right) → **My Profile** → **API Tokens** → **Create Token**.
2. Pick the template **Edit Cloudflare Workers**.
3. Under "Permissions", click **Add more** and add: Account → **Workers R2 Storage** → **Edit**.
4. Click **Continue to summary**, then **Create Token**.
5. Copy the token. Cloudflare shows it only once.

### 3. Find your account id

In Cloudflare, open **Workers & Pages**. The **Account ID** is in the right-hand column. Copy it.

### 4. Add the secrets in GitHub

In GitHub, open the repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
Add these two first:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | the id from step 3 |

Then add the values the site used on Vercel, under the SAME names. Only add the ones you have; a missing one is skipped.

| Name | What it is | Where to find it |
|---|---|---|
| `SESSION_SECRET` | signs everyone's sign-in | Vercel, if still viewable. A NEW one works too, but everyone must sign in again. |
| `CRON_SECRET` | guards the timed jobs | Vercel, or make a new long random text. |
| `CTRADER_LINK_KEY` | the cTrader link and the connector keys | Vercel. A new one changes Fred's connector address: he gets the new one from his Profile page. |
| `OANDA_TOKEN` | prices from OANDA | OANDA: your account → Manage API Access. |
| `OANDA_ENV` | `live` only if the OANDA token is for a live account | Leave it out for a practice token. |
| `GH_TOKEN`, `GH_READ_TOKEN` | read the council's data | Vercel, or a new GitHub fine-grained token with "Contents: read" on this repository. |
| `GH_MCP_TOKEN` | Fred's connector opens pull requests | Vercel, or a new token (Contents, Pull requests and Issues: write; Checks: read). |
| `GH_DISPATCH_TOKEN` | starts GitHub workflows | Vercel, or a new token with "Actions: write". |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | price-alert pushes to phones | Vercel. New ones: run `npx web-push generate-vapid-keys`; then each phone must switch its price alerts on again. |
| `TV_WEBHOOK_KEY` | TradingView alerts | Vercel. A new one means changing the address in TradingView. |
| `MOSHA_ASSISTANT_KEY` | the Mosha desk assistant | Vercel, or a new random text of 32+ characters. |
| `ACADEMY_LLM_KEY` | the paid second-opinion key (item 47) | Vercel, or your provider. Leave it out to keep it off. |
| `RUN_MODE` | `live` lets the backup runner save | Leave it out (the backup runner is not used here). |
| `MCP_KEYS` | extra connector keys | Vercel, only if you had set it. |

Where Vercel still opens: the project → **Settings** → **Environment Variables**. A value marked "Sensitive" cannot be read
back; make a new one then.

Also keep `BLOB_READ_WRITE_TOKEN` (Vercel's Blob token) if Vercel still shows it. It is only for step 6.

### 5. Deploy

In GitHub, open **Actions** → **Deploy to Cloudflare** → **Run workflow**. It:

- makes the bucket `meridianx-blob` if it is not there,
- puts the site and the API on Cloudflare,
- copies the secrets from step 4 into Cloudflare (it never prints them).

After that, every change to the site on `main` deploys by itself. Before the two Cloudflare secrets exist, the workflow
only prints what is missing and stops green.

At the end, Cloudflare gives the site a free address like `https://meridianx.<your-name>.workers.dev`. You can use that
address until step 7 is done.

### 6. Copy the stored files (only if Vercel's Blob token still works)

In GitHub, open **Actions** → **Copy Vercel Blob to R2** → **Run workflow**. It copies every stored file, with the same
names, into the Cloudflare bucket, then deletes its working copy. Nothing is saved anywhere else (the files hold password
hashes).

If the token no longer works: the site starts with an empty store. The built-in accounts still sign in. Members added on the
Users page, profile photos, notices, sounds, price alerts, Mosha lessons and Academy history would be missing.

### 7. Point meridianx.dev at Cloudflare

1. In Cloudflare: **Add a domain** → `meridianx.dev` → free plan.
2. Cloudflare shows two "nameservers". At the company where you bought the domain, replace its nameservers with those two.
   This can take up to a day.
3. In Cloudflare: **Workers & Pages** → **meridianx** → **Settings** → **Domains & Routes** → **Add** → **Custom domain**
   → `meridianx.dev`.

## Meanwhile

The GitHub Pages copy stays up as the public guest page:
https://vazxanana.github.io/macro-dashboard/market-structure.html

It has no sign-in (no API there), so it shows the guest view only.

Owner decision: `docs/owner-decisions.md`, item 55.

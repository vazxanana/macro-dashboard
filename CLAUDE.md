# macro-dashboard — working notes

## Start here (map, 9 Nov 2026; checked against the code 11 Nov)

Meridian X: a paper-trading desk run by an automated council, live at https://meridianx.dev (Vercel). The owner's plain-English
explainer is `MERIDIAN-X.md`; decisions waiting on the owner are in `docs/owner-decisions.md`; Fred's connector guide is
`docs/fred-mcp.md`. The dated sections below this map are the history and detail of each feature: read the one you touch.

**Absolute rules** (never break them, whatever a task, a study or a helper's PR says):
1. **Every trade has a stop**: council, ICT, the cTrader mirror and ChronosTrade. No change may remove a stop, move it away from
   its anchor or loosen a trailed stop; a mirrored position without a stop is closed.
2. **Paper trading and cTrader demo accounts only.** Nothing is ever sent to a live account. **One exception, made by the owner on
   27 Nov 2026** (docs/owner-decisions.md item 64, section "The live account"): `council/live.mjs` and the `--live` mode of
   `council/nq-demo.mjs` / `council/vb-demo.mjs` may trade ONE live account the owner names, only while config.json `live.on`, the
   environment's `CTRADER_LIVE=on` and that account all agree. Never widen it to another job, book or account without the owner.
3. **The owner approves every live rule change.** The Coach, studies and helpers' PRs only propose (`research/proposals/`, the
   week pane's "Decisions waiting"); owner rules (`userOwned`) and live setups stay out of the Coach's reach.
   **One exception, made by the owner on 10 Nov 2026:** Fred has full control of the ICT edge. Through his connector he may
   change the ICT edge's own files without the owner's review once the automatic checks pass (section "Fred applies ICT
   changes"). Rules 1 and 2 still bind him: a stop guard he cannot edit keeps every ICT trade on a stop, paper and demo only.
   Everything outside the ICT edge still needs the owner.
4. **Backtests run 2020 → now**, pre-registered, net of costs, in sample vs out of sample; never call something an edge without
   n and t. ICT stays a separate edge: never mix it into council systems, filters or reports.
5. **No paid services.** Keyless public data, the existing Vercel plan and free GitHub Actions minutes (the repo is public).
6. **No model names in repo files** (code, comments, docs, page text). Commit attribution lines are not repo files.
   `tests/no-model-names.test.mjs` scans every tracked text file (out/ excluded); its short allowlist names each exception and why.

**Where things live**
| Path | What |
|---|---|
| `market-structure.html` | The Desk (built to `/` and `/market-structure.html`): home, charts, council panes, desks (ICT, Mosha), profile, users. Public / admin split: see below. The Mosha desk's scripts are `assets/mosha-*.js` |
| `macro-desk.html` (`/macro-desk`) | Macro desk: veteran glance, event playbook, score / levels charts, briefing, calls, COT |
| `backtest.html` (`/backtest`) | ChronosTrade replay lab; engine `assets/backtest-engine.js`, review charts `assets/bt-review.js`, effects `assets/bt-fx.js` |
| `gold-trading.html` (`/gold`) | Gold terminal; holds the locked features and the 15-driver macro stack below |
| `academy.html` (`/academy`, owner only) | MeridianX Academy: replay a setup of one of the seven edges, the apprentice decides, the mentor corrects, a lesson is saved and proven. Page `assets/academy-ui.js` + `academy.css`; modules `assets/academy-replay.js` (`MXR`), `academy-core.js` (`MXA`), `academy-risk.js` (`MXK`); API `api/academy.js`; generated data `academy/` (edges, candidates, outcomes, features, research); offline training `ml/`. Docs: `docs/academy/`, state: `MERIDIANX_BUILD_PROGRESS.md` |
| `edge-lab.html`, `scripts/veteran-library.html` (`/veteran/`) | Side pages; shared look `assets/mx-page.css` + `assets/mx-nav.js` |
| `app.webmanifest`, `sw.js`, `offline.html`, `icons/`, `assets/pwa.js` | Installable app (head tags added at build by `scripts/pwa.mjs`, never by hand) |
| `api/` | The site's functions, run by the Cloudflare Worker (`_*.js` are shared modules): sign-in (`login`, `logout`, `me`, `_session`, `_accounts`, `_guard`), `/cdata` (`data.js`), `/md/bars` + `/md/stream` (OANDA), `mcp.js` + `_ictlab.js` (Fred's connector), `academy.js` + `academy-mcp.js` (the Academy and its assistant connector), `ctrader-link`, `users`, `profile`, `notify`, `sounds`, `mosha` (the Mosha desk's trade log), `mosha-lessons` (the lessons its teacher sends), `edge-analyst` (AI second opinion on each live entry), `trade-review` (+ `_trade-review`: the language-model part of the trade review), `status`, `bridge` (17 Nov 2026: `push`, `alert-cron`, `run.js`, `tv-webhook`, `pine`, `og.mjs`, `_flags` removed, section "Simplified") |
| `council/` | Council members: `trader`, `analyst`, `coach`, `macro`, `macroscore`, `veteran` (+ `briefing`, `glance`, `calibration`, `playbook`, `outlook`), `cot`, `trade-review` (after-the-fact check of the trades taken, proposals only), `ctrader-*` (demo mirror), `datacheck` / `datahealth` / `health`, `digest`, `research-ledger`, `datasync` / `jsonio`, `live` (VPS runner) |
| `ict/` | ICT desk tracker, replay, CME calendar; its rule book is `.claude/skills/ICT/SKILL.md` |
| `research/edge/<topic>/` | Pre-registered studies (preregistration, `RESULT.md`, `result.json`), published to the Edge lab; `research/proposals/` = owner proposals; `research/macro-veteran/` = the veteran batch |
| `tests/` | `node:test`, offline; pinned council-data copies in `tests/fixtures/` |
| `scripts/` | `build.sh`, `audit/` (`smoke.cjs`, `chronostrade.cjs`, `pwa.cjs`), `daily-cache.mjs`, `make-icons.mjs` |
| `out/` | The built site, **committed** (CI fails when it is stale) |
| `council-data` branch | Everything the bots write (trades.json, snapshot.json, `ict/`, `macro/`, `ctrader/`, health.json, digest.json, `research/…`); the site reads it through `/cdata`. Never commit bot output to `main` |
| `.github/workflows/` | `council.yml` (the loop), `watchdog.yml`, `tests.yml` + `ci.yml` (CI), `cloudflare-deploy.yml` (the site), `ict-apply.yml` + `ict-apply-merge.yml` (applied ICT changes: on for Fred since 10 Nov), research / cache workflows (mostly manual) |

**Build, test, CI**
```sh
sh scripts/build.sh                    # builds out/; commit out/ with every page, asset or study change
for f in council/*.mjs ict/*.mjs api/*.js research/edge/*.mjs; do node --check "$f" || break; done
node --test tests/*.test.mjs tests/*.test.js
node ict/audit-test.mjs && node council/alerts-test.mjs && node council/proposals-test.mjs
# page checks (Playwright): serve out/ on $PORT (default 8766), e.g. python3 -m http.server 8766 --directory out, then
node --use-env-proxy scripts/audit/smoke.cjs && node --use-env-proxy scripts/audit/chronostrade.cjs
```
CI on every PR and push to `main`: `tests.yml` (syntax, unit tests, pinned audits) and `ci.yml` (build matches `out/`, page smoke
test, ChronosTrade audit). Keep new tests offline. The site deploys to Cloudflare with `cloudflare-deploy.yml` (section "Cloudflare
move"); the GitHub Pages copy (`deploy.yml`) and the Vercel deploy gate were removed on 17 Nov 2026.

**How it runs**: `council.yml` is the loop (GitHub Actions, restarts itself every ~5 h). One round takes **about 11-12 minutes**
(the members' work, then a 4-minute wait in which the Trader and the mirror run again every minute), so "every 2nd round" is
~23 min, "every 3rd" ~35 min (ICT desk, research ledger) and "every 6th" ~70 min (Macro strategist, veteran, COT). Older notes
below that say "5-minute round" or "~25 min" predate the quick pass. The loop is the ONLY council runner: the Vercel backup runner
(`api/run.js`, its crons and the Edge Config switches) and the never-installed VPS runner (`council/live.mjs`) were removed on 17 Nov
2026 (section "Simplified"). The Worker's one cron (`*/10`) runs the Blob backup / store mirror, the edge analyst and the trade
review. `watchdog.yml` pages when the loop stops.

**Sections below, by topic** (each is dated; later sections win where two disagree):
- Accounts and security: Public / admin split, Accounts and sign-in, Users page, Accounts, desks…, Per-member permissions (the `mosha` key is in "Mosha desk"),
  Server-side sign-in, API hardening, API review (20 Nov), Profile photo and name on the server.
- The Desk page: Simplified pages (17 Nov: what was removed and folded), Simple phone view (the default on phones), Council layout, Home and navigation, Guests (three sections), Sign-in and guest polish, Profile page, Charts:
  markup switch, Desk smoothness, Exchange price ticks, Styled dialogs, Desk notifications, Installable app, This week report,
  Edge scoreboard, Loss review, Charts bug hunt (20 Nov: what was broken in the 18-20 Nov chart features and how it was fixed).
- Council systems and trading: Supported book / financing / replica mirror (11 Nov: which systems are live), Financing, the rest (baselines, replay rows), Path to live + Forward record of the live book (12 Nov), Coach evolution, Main systems first, NQ open run regime tags, LIT paper shadow / LIT replay / LIT
  and NQ SDV desks, Mosha desk, Gold trend fast, Gold playbook check / view, Trader paper fills, Near-stop market fills, Book weights, What to expect, Futures tickets,
  Trade review (17 Nov: the after-the-fact edge check and its optional language-model reviewer).
- cTrader demo: cTrader demo mirror, Mirror stop safety, cTrader demo accounts on the profile, cTrader symbol specs.
- ICT: ICT desk, ICT desk: every result traceable to its execution (+ frozen history), ICT MCP server (with `docs/fred-mcp.md`),
  Fred applies ICT changes (on for Fred since 10 Nov).
- Macro: Macro driver stack (gold terminal), Macro strategist, Macro veteran (+ revision 1.3), Veteran's calls (+ track record),
  The veteran's briefing, The veteran at a glance, Macro desk charts, The veteran's event playbook, COT positioning desk,
  Macro brain audit (20 Nov: trading days, the batch in the council's checkout, odds that name their level).
- ChronosTrade: Backtest lab (passes 1-11, review, instant orders, chart design, analytics, onboarding), trade effects, sounds chosen by the owner.
- Loading: Load performance: delivery layer (9 Nov), Desk load: one request per file, late loading (11 Nov).
- Running and reliability: Simplified (17 Nov 2026: what was removed), Vercel (stage 1 + Pro features; history), Council live runner (removed), Council quick pass, One feed per market (12 Nov), Reliability: tests and data
  health, Loop watchdog, Council data files health, council-data sync and safe writes, Daily owner digest, Research ledger,
  Browser audits (false failures traced to their causes).
- Side pages: Side pages: /macro, /veteran/, Edge lab, gold terminal.
- Academy: MeridianX Academy (owner only). Research notes: Research candle clock, Mosha level reversal study. QA: Post-merge QA sweeps (9, 11 and 12 Nov).
- Academy: MeridianX Academy (owner only). Research notes: Research candle clock, Mosha level reversal study, Gold carry (cost of holding a gold buy, 12 Nov). QA: Post-merge QA sweeps (9 and 11 Nov).

**Owner-facing docs** (11 Nov 2026: both re-checked against the code): `MERIDIAN-X.md` is the plain-English explainer;
`docs/owner-decisions.md` opens with "What needs you now" and every item carries a dated status line. Item numbers are stable
(1-63 today; add new ones at the end, never renumber), because this file, the studies and the tests cite them.

## Cloudflare move (16 Nov 2026, owner: "Move the whole site"; Workers Paid $5 a month approved)
`cloudflare/` runs the site on Cloudflare Workers: `out/` as static assets, vercel.json's rewrites and headers read at
build time (`src/routes.mjs`), the api/ handlers UNCHANGED through a Node-style adapter (`src/adapter.mjs`: Vercel's
req / res, body parsing by content type, streaming, `x-real-ip` from `cf-connecting-ip` only), one cron (`*/10`: edge analyst,
trade review, backup, store mirror; the minute price-alert cron went on 17 Nov 2026). Stages, secrets list and what is still to port: `docs/cloudflare.md`. **Live since 16 Nov 2026** at
https://aureumdesk.co.uk (+ www; the site's domain since 16 Nov 2026, a Cloudflare zone with the Worker as its custom domain) and
https://meridianx.meridianx-cloudflare.workers.dev (the Vercel project is gone; meridianx.dev is no longer used),
deployed by `.github/workflows/cloudflare-deploy.yml` (by hand from main; on push only for the two Cloudflare branches).
The council, `daily-cache.yml` and `macro-gold.yml` read candles from the Worker (`MD_BASE`, repository variable
`MD_ORIGIN` overrides). Links, the bridges' default URL, the digest and the connectors' origin lists name aureumdesk.co.uk.
A copy of the Vercel Blob store is kept in KV `meridianx-blob-backup` (`cloudflare/src/backup.mjs`, 10-min cron, then daily).
**File store on D1** (17 Nov 2026, `docs/cloudflare.md` "File store on D1"): `@vercel/blob` is aliased to
`cloudflare/src/store-blob.mjs` (real package: `vercel-blob-real`); with the Worker secret `STORE=d1` every Blob call of the
unchanged api/ handlers goes to D1 `aureum-data` (`STORE_DB`, `src/store-d1.mjs`; store URLs on `d1.store.invalid` answered
from D1 by a wrapped `fetch`), otherwise to Vercel (the default). `src/store-mirror.mjs` keeps D1 a copy of Vercel (10-min
cron) and, once switched, makes one final pass that never overwrites a write made here. D1 mode fails closed until a complete
copy is recorded; a file the site wrote in D1 mode is never touched by the mirror. Never import `@vercel/blob` in
`cloudflare/src` for the real store: use `vercel-blob-real`. Tests: `tests/cloudflare-store.test.mjs`. Keep api/ handlers in Vercel's (req, res) shape so
both hosts run them; a new function needs its import in `cloudflare/src/worker.mjs` (`tests/cloudflare-worker.test.mjs`
fails otherwise). `/api/og` redirects to the static card `/icons/og-card.png` (17 Nov 2026; `api/run.js` and `api/og.mjs` are gone);
the connector's syntax check falls back to acorn where no child process can start (16 Nov 2026). Never put a secret in `wrangler.jsonc`.
**Bundled files (16 Nov 2026)**: what `api/academy.js` (per edge `academy/data/` cand / out / feat, calendar, research, eval,
`ml/models/index.json`; the registry `academy/edges.mjs` as code) and `api/bridge.js` (the two EA sources) read from disk on Node
ship inside the Worker as text modules (`cloudflare/src/bundled.mjs`, wrangler.jsonc `rules`), handed over through `useData` /
`useFiles` (Node and Vercel never call them), each file parsed on its first request (`src/academy-data.mjs`). The API's rules
are unchanged (outcomes only after an attempt, the exam pool apart); nothing of `academy/archive/` is bundled. A file the Academy
starts to read must be added to bundled.mjs (`tests/cloudflare-bundle.test.mjs` fails otherwise); regenerated data reaches the
Worker with its next deploy. Upload 1,471 KiB (340 gzip) before, 4,022 KiB (671 gzip) after. Never set `ACADEMY_STORE_DIR` on the
Worker (its /tmp lasts one request). The two custom domains are wrangler.jsonc `routes` (`custom_domain`), workers.dev stays
on. `/api/og` stays the icon: the pinned @vercel/og's Worker build fetches its font at module scope, which stops the Worker
from starting (tried locally); the alternatives add two packages and about 2 MB of wasm (`docs/cloudflare.md`, stage 3).

## Daily reports at 06:30 London (19 Nov 2026, owner: "daily reports every 6:30 am … (those who got macro activated), 2 reports: the world economy … and the markets")
`council/daily-report.mjs` (council.yml, every round, `timeout 30`; builds once a London day from 06:00, `--force` rebuilds) reads
the files the council already wrote (macro/forecast.json: regime, assets, central-bank `news`, Gold Macro Score; macro/cache.json
`cal` = the week's economic calendar; macro/veteran.json: summary, levels, week calls, research items; macro/cot.json; snapshot.json
prices) and writes council-data `macro/daily-report.json` (`reports[]`, last 14 London days: `day`, `publishAt` = 06:30 London in
UTC, `world` and `markets` = `{ title, lead, sections: [{ h, lines }] }`, `note`). Deterministic text, fetches nothing, no language
model, no system, trade or rule names, no third-party licensed data (London Strategic Edge's licence forbids showing it to members).
**Delivery** (`api/daily.js`, `?job=daily` in the Worker's `CHAINED` 10-minute chain, Bearer CRON_SECRET), only inside the publish
window (06:30 London to 3 h later, so a late build never wakes everyone), once each per day: (1) the **AI summary** (owner: "use AI
to do the daily brief"): the shared language-model adapter (`api/_academy-llm.js`; model `DAILY_LLM_MODEL` else `ACADEMY_LLM_MODEL` else `CHRONOS_LLM_MODEL`; key `DAILY_LLM_KEY`, `ACADEMY_LLM_KEY`, else (owner, 20 Nov 2026: "re use from other variable") `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY`, which bring the provider's messages address and format when none is set;
own budgets `DAILY_LLM_DAILY_USD` 0.5 / `_MONTHLY_USD` 5 / `_HARD_USD` 25 / `_MAX_CALLS_DAY` 2; `DAILY_AI=off` stops it; off without
`ACADEMY_LLM_KEY`) writes two short paragraphs from the report's facts only; `api/_daily.js` `parseBrief` refuses any figure not in
the report (small whole numbers apart), advice, stops and claims of certainty; stored `daily/brief-<day>.json` (a refused billed
answer too, never paid twice); (2) the **bell notice** (`notify.js` `dailyNotice`: `id daily-<day>`, `perm: 'macro'`, `link`);
notify GET shows a `perm` notice only to the owner and accounts whose `perms.macro` is not false (`allowed`); the bell and the
slide-in card draw the body's lines and an "Open the reports" link (same-site paths only); (3) the **email** (owner: "add the 6:30
email too") to the owner (`OWNER_EMAIL`, else `GMAIL_USER`) and every stored member with an email and macro on (`recipients`, at
most 60), through the sign-up senders (`signup.js` `mailer`); `daily/state.json` marks the day BEFORE sending (never twice);
`DAILY_EMAIL=off` stops it; addresses are never logged or returned. `?brief=1` (a member with macro) = the day's summary for the
page; `?test=email[&to=]` (the owner's session, 5 in 10 min) sends the latest report now, marked "Test". **Page**: Macro desk
section `#s-daily` first (TOC "Daily reports"), the AI summary box `#dr-ai` above each report, tabs World economy / Markets
(localStorage `mdDaily`, a display preference), a day picker; a report shows only from its publish time. Build rule: the first
file is built at once; a report built before 06:00 London is built again from 06:00. `datahealth.mjs` warns after 27 h. **The email as a morning note** (20 Nov 2026, owner: "more professional … highlights and bullet points … just Summary, not AI
summary … like a person writes it"): subject "Morning note · <day>"; "Summary" (never "AI") = the model's `headline` and 3-5
`points` (optional fields, each checked by `parseBrief` like the paragraphs; an older stored summary shows its two paragraphs);
`SYSTEM` asks for the desk analyst's own voice ("we", short sentences, never naming a model or a report) and `parseBrief` refuses
text that talks of itself; "At a glance" tiles (`glance`: price, normal day, today's odds against the usual rate, from "Where
markets stand", + the VIX); "On the calendar today" (`agenda`, from the world report's "Today" section); then both reports with
at most `LINES` 4 bullets a section ("n more on the Macro desk"); signed "The Aureum Desk". The Macro desk's box reads "Summary" and shows the same headline and bullet points as the email (`#dr-ai-h`, `#dr-ai-l`, as text), then the open tab's paragraph.
**Plain words** (20 Nov 2026, owner: "normal people should be able to understand"): `SYSTEM` asks for everyday words a non-trader understands (a term named is explained in a few words); the tiles say "Moves about x% a day", "n% chance up today", "normally n%", the VIX is "Fear gauge (VIX)"; sections "Prices this morning", "Coming out today"; a "What the words mean" box (`glossary`, `WORDS`) explains each market term the email uses. `?test=email&fresh=1` (owner) writes the day's summary again first (one call; a refused rewrite keeps the good one). `?send=all&day=<day>[&fresh=1]` (owner, 20 Nov 2026: "send to the registered email users") sends the latest report to the 06:30 list now, unmarked, once a day (`state.resent`, marked first), refused when `Sec-Fetch-Site` says another site; counts only. **Email with the hard-data lines** (20 Nov 2026): `agenda` keeps the report's "High · 13:30 · …" rows (they were left out, so the day's main release was missing) and marks them "key release" (over 8 rows the high-impact ones stay); the Today lines that are not calendar rows (the nowcast before the print, Fed events, Treasury auctions, "no release today") show under the calendar as "Also today" (`todayNotes`, 6 at most); `WORDS` explains nowcast, PCE, GDPNow, prediction markets, Beige Book, Treasury auction, and "25bps" brings the basis-point entry. Tests:
`tests/daily-report.test.mjs`, `tests/daily-delivery.test.mjs`, `tests/daily-email-hard.test.mjs` (fixture `tests/fixtures/daily-email-hard.mjs`).

## London Strategic Edge data, owner only (19 Nov 2026, owner: "build option 1")
`api/lse.js` (routed in `cloudflare/src/worker.mjs`), key = the Worker secret `LSE_API_KEY` (set by the owner in Cloudflare; host
`download.londonstrategicedge.com`, header `X-API-Key`, free plan: 60 calls a minute, 12.5 GiB a week, 12.5 M rows a day).
**Their licence**: the owner's own research, backtesting and trading are allowed; showing their data to anyone else (members,
guests, a page, a public repository, the council-data branch, a bot post) is distribution and needs their Enterprise licence. So
the endpoint answers the owner's session only, GET only, `private, no-store`, previews and lists only (ops `usage`, `refs`, `ref`,
`macro`, `series`; parameters allowlisted and checked, never an export), stores nothing, never returns the key. Studies may use
the data from a folder outside git and publish results only (n, t, verdict), never the rows. Never show it on the Desk, the Macro
desk or any member page without the owner buying a licence. Test: `tests/lse.test.mjs`.

## The 18 Nov 2026 outage and what the deploy now does (owner: "make it all you can")
At 23:54 UTC on 17 Nov a Workers Builds deploy on the `aureum` Worker (the site; `meridianx` is deleted) published the pages
alone and the Worker lost its code AND every secret: /api and /md answered 404, then "OANDA_TOKEN not set"; the council ran on
Kraken for 14 hours and sign-in was off. Fixed by `cloudflare-deploy.yml`, which now (names only in its log, never a value):
copies a Worker secret from a GitHub repository secret of the SAME name (OANDA_TOKEN / OANDA_ENV came this way); makes
SESSION_SECRET, CRON_SECRET and CTRADER_LINK_KEY once, at random, only when the Worker has none (never replaced: that would sign
everyone out; the connector keys derived from them changed once, members copy theirs again from the Profile); and, with no real
Blob token, reads the file store from its D1 copy (`STORE=d1`, ready since 17 Nov 07:30, every folder present), with a
placeholder `BLOB_READ_WRITE_TOKEN` the D1 store never sends anywhere and `STORE_MIRROR=off`. Stored cTrader links are unreadable
under the new link key (members link again). Still missing: the six ACADEMY_LLM_* (AI features off), GH_TOKEN / GH_READ_TOKEN
(/cdata falls back to the public raw files). Workers Builds on aureum must use root `cloudflare`, `npm ci`, `npx wrangler deploy`,
or stay disconnected; the deploy's first look fails loudly when /api/status is not 200 and prints the candle route's answer.

## Sign-up, email verification and password reset (17 Nov 2026, owner: 'do 2')
People create their own account, confirm their email by a link, and the owner approves them; a member with an email can reset a
forgotten password by email. `api/signup.js` (one endpoint, Vercel's (req, res) shape, routed in `cloudflare/src/worker.mjs`):
- `POST { name, username, email, password }`: same-origin; per IP 5 an hour (`api/_guard.js` `hit`) on top of the shared password-guess
  limit; name 1-24, email shape and <= 254, password >= 10. **A password picks the account**, so one already used by the owner, a
  member or another request is refused with the neutral "Choose another password." and that refusal counts as a failed password
  check (`G.failed`: it would otherwise test passwords). The answer is the SAME for a new, a pending, a confirmed and a member's
  email (one link per email per 10 minutes). Pending record in the private store `signups/pending.json` (`{ id, name, email
  lowercased, hash: sha256(password), tokenHash, at, exp 24 h, verified }`, at most 200; written in place, so read with
  `?cache=0`). Token = 32 random bytes; only its sha256 is stored. Link `<origin>/api/signup?verify=<token>` (origin = the request's
  host when it is aureumdesk.co.uk / www / the workers.dev host / localhost, else aureumdesk.co.uk).
- `GET ?verify=`: once, within 24 h -> 302 `/market-structure.html?signup=verified` (else `?signup=expired`); the owner gets an
  email naming the person (to `OWNER_EMAIL`, else `GMAIL_USER`). The desk's bell has no owner-only items, so nothing goes there.
- Owner session only: `GET ?list=1` (confirmed requests: name, email, times; no hashes), `POST { approve: id, role }` (adds the
  account to the stored user list exactly as the Users page saves it: `users.js` `clean` + `saveList`, key from the name, made
  unique, record `{ name, role, hash, email }`; the person gets "Your seat … is ready"), `POST { refuse: id }`.
- `POST { forgot: email }`: ALWAYS the same answer; a member whose stored record has that email gets `/market-structure.html#reset=<token>`
  (1 h, once; `signups/resets.json`, hash only). `POST { reset, password }`: the new hash goes on the stored record (the session
  fingerprint changes, so every old session ends); a bad token counts as a failed password check. Members made by the owner have
  no email (reset by the owner as before).
- **The email stays on the server**: kept on the stored record (`users.js` `clean` keeps it, `withHashes` keeps the stored one
  when the Users page saves without it), never in `publicRecord`, `/api/me`, `/api/users` (not even the owner's), `/cdata`, the
  guest cut or a log line; only the owner's approval list shows it.
- **Mail senders** (`mailer`), in order: (1) the Worker's Cloudflare Email Service binding `env.EMAIL` (`send_email`, handed in per
  request by `signup.useMail`), from `MAIL_FROM` (default help@aureumdesk.co.uk); (2) Gmail SMTP, `api/_smtp.js` (pure: takes the
  socket function; the Worker hands in `cloudflare:sockets` `connect` through `signup.useSmtp`; smtp.gmail.com:465 implicit TLS,
  EHLO, AUTH PLAIN, dot-stuffing, CR/LF stripped from every header value, one plain address only), secrets `GMAIL_USER` /
  `GMAIL_APP_PASSWORD`; with both, a binding that throws is followed by one Gmail try. Neither: 503 "Sign-ups are not open yet."
  (and "Password reset by email is not open yet."); `GET /api/signup` answers `{ open }` for the page. **The binding line is not in
  `wrangler.jsonc` yet** (docs/cloudflare.md says which line, after the domain is onboarded). Never import `cloudflare:` from `api/`.
- Page: the sign-in card has "Create an account" / "Forgot password?" (`.gate-links`, quiet centred, 44 px, AA on the dark card)
  and three panels that take the card's place (`.gate-card[data-panel]`, `#ms-gp-su` / `-fg` / `-rs`, script `#ms-su-js` under the
  card); `?signup=` shows a line on the card (`#ms-gate-ban`), `#reset=` opens the new-password panel and is cleaned from the
  address at once (also on a hash change). Nothing typed there is stored in the browser. Users page: "Waiting for your approval"
  (`#ms-u-wait-card`, `renderSignups`) with a role and Approve / Refuse, failures in words.
- **The inbox screen and its automatic check** (18 Nov 2026, owner: "improve the confirmation design with a cool animation, and the
  confirmation link should be automatic"): every sign-up answer carries `watch` (a random code; only `watchHash` is stored on a
  new pending record, so a repeat, a member's or a confirmed email gets a code that never confirms: the answers still look
  alike). `GET /api/signup?watch=<code>` answers only `{ state: 'confirmed' | 'waiting' }` (unknown or expired = waiting; 1,200
  an hour per IP). Page: after "Create account" the panel shows `#ms-su-sent` (style `#ms-su-sent-css`): an envelope that takes
  its letter and closes after a paper plane flies in, a "1" new-mail badge and a light orbiting it, three steps in a card (sent /
  confirm / the owner approves), "Open Gmail" (Outlook, Yahoo, iCloud, Proton) for
  known domains; it asks every 4 s while visible, at once when the page comes back (from the email app), for 45 minutes, and
  turns by itself to "Email confirmed" (the envelope squeezes into a check that draws itself, the glow turns green, confetti made
  by the script, a short buzz on Android). 2D only (a 3D flip clipped the glow). `?signup=verified` (the email's
  link) opens the same confirmed screen. No endless animation; reduced motion shows the end states. Nothing is stored in the
  browser (the code lives in memory). Test: `tests/signup.test.mjs` ("watch").
- Not checked live: neither sender has sent a real email from the build sandbox (no network to Gmail or Cloudflare); the
  binding's call shape (`send({ from: { email, name }, to, subject, text, html })`) is from Cloudflare's docs as summarised by a
  web search, the docs site itself was not reachable. Tests: `tests/signup.test.mjs` (fake store, clock, binding, SMTP socket).

## Simplified (17 Nov 2026, owner: "All")
The owner approved removing what the site no longer uses or never used. Backend and plumbing (the pages' own calls and markup were
a separate change). No trading rule, stop, stop guard, demo-only lock or ICT file changed. Older sections below still describe these
parts as they were; this section wins.
- **Hosting leftovers**: `netlify.toml`, `_redirects` (an early Netlify version), `.github/workflows/deploy.yml` (the GitHub Pages
  copy), `scripts/vercel-ignore.sh`, and `vercel.json`'s `crons`, `ignoreCommand` and `buildCommand` (the Vercel project is gone since
  16 Nov). `vercel.json` keeps its rewrites and headers (`cloudflare/src/routes.mjs` reads them) and the `functions` entries the tests
  read (limits and bundled files of the live handlers).
- **Backup council runner** `api/run.js` (the Worker answered it 410; GitHub Actions is the only runner) and the **Edge Config flags**
  `api/_flags.js` (notice bar, run mode, pause). `api/status.js` now answers `{ at, bots: { council, ict } }` (age and `stale` only;
  no `notice`, `noticeLevel`, `runMode`, `paused` or `lastRun`).
- **Preview image** `api/og.mjs` and the `@vercel/og` dependency: the Worker redirects `/api/og` to `/icons/og-card.png`.
- **TradingView**: `api/tv-webhook.js` and `api/pine.js`.
- **Price alerts (Web Push)**: `api/push.js`, `api/alert-cron.js`, `api/_alerts.js`, the Worker's every-minute cron (`wrangler.jsonc`
  triggers and `CRONS`: only `*/10` is left), the `web-push` dependency (root and `cloudflare/`), and the service worker's `push` /
  `notificationclick` handlers. `sw.js` keeps install, the offline page, the asset cache and the kill switch (`tests/pwa.test.mjs`,
  `scripts/audit/pwa.cjs`). Side effect: the store mirror's first-hour fast final pass after a `STORE=d1` switch ran on the minute
  cron; it now runs on the 10-minute one (same result, later).
- **Workflows**: `bars.yml` and `futures-roll-data.yml` removed; `macro-gold.yml` and `macroscore-overlay.yml` dispatch only (both
  studies are complete); `kraken-backfill.yml` once a day at 01:43 UTC (was every 30 min; the 25-minute box is unchanged, so a coin's
  Kraken cache catches up over more days).
- **VPS live runner** `council/live.mjs`, `scripts/live/`, `tests/live.test.mjs` and `livefresh()` in `council.yml`: never installed;
  the loop now runs the Trader and the mirror on every round and quick pass, exactly as it did with no heartbeat.
- **LIT paper stream**: owner rule `lit-off` (`config.litShadow = false`, applied after `lit-shadow`) and `council/lit-replay.mjs`
  (+ its test, its `council.yml` line and the `lit/replay.json` entry in `datahealth.mjs`) removed. No new LIT order is recorded; the
  LIT block in `trader.mjs` still runs while a LIT record is open or pending (`litLeft`: the day-end hold and the swing break-even),
  and the loop manages those records to their exits with their stops. `council/lit.mjs` stays (tests and the block import it).
  `snapshot.lit.on` says whether the stream places orders. Undo: a user rule setting `c.litShadow = true`.
- **Cleanup (17 Nov 2026, owner: "keep doing some cleanup")**: no code was left that imports a removed file (every export of
  `api/`, `council/` and `cloudflare/src` still has a caller; `out/` holds nothing the build does not make; both lockfiles are
  without `web-push` / `@vercel/og`). What went was stale text: `council/README.md` (the ICT desk row named `api/run.js?job=ict`),
  `council.yml` / `ci.yml` / `cloudflare-deploy.yml` comments (Pages, the Vercel fallback, the pwa audit's push checks, "does not
  touch the domain"), `api/_oanda.js` (price alerts), `app.webmanifest` description (price alerts), `docs/cloudflare.md` (secrets
  list without `EDGE_CONFIG` / `VAPID_*` / `TV_WEBHOOK_KEY` / `RUN_MODE`, the superseded R2 / KV storage plan, `/macro`),
  `MERIDIAN-X.md` and `README.md` (domain, price alerts, removed desks, the backup runner and VPS), the Academy docs
  (`ACCEPTANCE.md` domain, `PREVIEW.md` marked history, `LLM.md` / `ARCHITECTURE.md` Worker secrets), `MERIDIANX_BUILD_PROGRESS.md`,
  `api/mcp.js` `serverInfo.websiteUrl` and `academy/gen/clock-check.mjs`'s default candle host (aureumdesk.co.uk), and dated
  "Status, 17 Nov" lines on `docs/owner-decisions.md` items 5, 6, 12 (ticked: LIT stopped by "All"), 15, 28, 31 and 32.
  Kept on purpose: the `/macro-dashboard/*` rewrite and its asset headers (old links; three tests pin them), `meridianx.dev` in
  the connectors' `ORIGINS`, `ict/tracker.mjs` `MD_BARS` (Fred's; the workflows pass `ICT_MD_BARS`), research study code and
  generated Academy data, and the `GH_DISPATCH_TOKEN` read-token fallback in `api/data.js` / `api/mcp.js`.
## Simplified pages (17 Nov 2026, owner: "All")
The page side of the 17 Nov simplification (the backend side, push / alert-cron / tv-webhook / pine / run.js / flags / og, went in
its own change). Removed from the Desk (`market-structure.html`, 1,843,985 → about 1,582,000 bytes) with their tests:
- **Vercel Analytics / Speed Insights loader**: gone; `window.msTrack` is a no-op kept for its callers. **The Edge Config notice
  bar** `#ms-notice`: gone; the "Council bot behind" pill (`#ms-botwarn`, `/api/status`) stays. **Link previews**:
  `og:image` / `twitter:image` = `https://aureumdesk.co.uk/icons/og-card.png`.
- **Desks**: the Gold playbook view `#gold` (`renderGold`, `gpDays`) and the Setup card `#ms-pb` (`renderPlaybook`), the LIT
  desk `#lit` (`renderLit`, `litReplay`, `#ms-lit-css`), the NQ SDV placeholder `#sdv`, and the Crypto desk `#crypto` (the coins
  stay markets on Charts). The desk switch is **ICT | Mosha**; `VIEWS`, `VIEW_PERM`, the Desks entry's `DESKS`, the simple phone
  view's `DESKS` list and the palette names follow. The `desks` permission now opens the Mosha desk only.
- **Council → Macro pane** (`#ms-cp-macro`, `#ms-md-css`, `#ms-md-js`, the Home quick link): the Council's tab bar keeps a plain
  link `<a class="adm c-nav-link" id="ms-cn-macro" href="/macro-desk">` where the tab was (hidden for `data-deny~="macro"`).
  The Macro desk page (`macro-desk.html`) is unchanged; `tests/macro-desk.test.mjs` checks the strategist's output only.
- **Book weights card** `#ms-book` (`#ms-book-css`, `#ms-book-js`): gone; `council/book.mjs` and the digest's line are unchanged.
  `MS_BOOK_NOW` (the decay script's "between two Coach readings") is not part of it and stays.
- **Price alerts**: the dialog `#ms-pa`, Settings → Price alerts, the chart bell (and its key, right-click / Alt+click, the
  position chip's "Alert at entry"), the alert chips `#ms-pa-chips`, the palette entries. **TradingView**: the webhook owner
  dialog ("TradingView alerts in") and the Pine add-on. The `pa-*` dialog classes stay: the Broker bridge dialog uses them.
  The Setup page's level bells (`#ms-levels`, in-page notifications) and the header's setup-alert toggle `#ms-alerts` stay.
- **Journal**: the `#journal` view and its nav entries, the Home tile, the Setup button "Log selected trade" and the browser
  Trader (`autoTrade`, `jAdd`, `journalTick`, the hidden `#ms-auto` toggle). The council's closed system trades are the Council →
  Trades tab "Closed" (`data-ct="journal"`, the same `systemClosed()` list). A member's old localStorage `msJournal` is left
  alone, unused. The `journal` permission key stays in `MS_PERM_KEYS` (stored records keep validating) but gates nothing and is
  not offered in the permission dialog.
- **The /macro landing** (`index.html`): deleted; `scripts/build.sh` no longer makes `out/macro/`. `/macro` should rewrite to the
  Macro desk (`vercel.json`, owned by the backend change).
Folded: the Council research pane leads with the Edge scoreboard; the edge-decay monitor `#ms-decay` and "What to expect"
`#ms-expect` sit unchanged in one closed disclosure `<details class="c-dex adm" id="ms-dex">` "Decay and expectations" under it
(`.c-dex:not([open]) > .c-dex-b { display: none }`; the simple phone view does not fold the cards inside it again; the smoke test
counts the disclosure as one Research row). The forward card `#ms-fwd` stays the headline of Council → Systems. Home and the
Council overview were already apart (Home: Today strip, open positions, sections; overview: active trades and the calendar), so
nothing more was cut there. The sections below about these features are history: their headings say "(removed 17 Nov 2026)".

## Locked features — do NOT remove or replace in redesigns

These live in `gold-trading.html` (the gold terminal). It stays self-contained: no build step, no external JS beyond the
Lightweight Charts CDN and public data APIs.

- **Market structure engine** (`structureMap` + `makeStructPrimitive` +
  `renderStructReadout`): major-structure mapping on the Multi-Timeframe
  charts — `bos` only at the ratcheting trend extreme, `ChoCh` only at the
  protected origin swing, dashed gray `idm` inducement marks, dashed amber
  liquidity `sweep` marks, and the plain-language structure readout under
  each chart. The owner explicitly asked to keep this. Display preference
  (also owner-requested): all MTF charts hide the HH/HL/LH/LL swing tags
  and the "bos" label text (`structOpts: { hideTags, hideBosLabel }`);
  break lines still draw and ChoCh stays labelled.
- **Supply/demand order-block zones** (`sdZones` via `structureMap(...).zones`):
  green demand / red supply boxes at break-leg origins on the MTF charts
  (ChoCh origins drawn brighter), live until a body close through the far
  side. These replaced the engulfing zones on the MTF tab — do not bring
  the engulfing zones back there. The EG desk charts keep their own
  engulfing zones (that is the strategy being traded there).

## Macro driver stack

15 weighted drivers feed `computeDailyBias()` in `gold-trading.html` (real yields, macro composite,
daily structure, S/D block location, VIX, real-yield momentum, breakeven,
2Y, DXY momentum, COT, yield curve, HY spreads, Dollar Smile regime,
Eurozone growth pulse, Yen carry-unwind risk). The last three are mined
from an institutional macro handbook the owner supplied (Dollar Smile
theory, global dollar liquidity, Germany/Eurozone, Japan) — see
`dollarSmileRegime()`, and the `fundX.euGrowth` / `fundX.jpyMom` / `fundX.sofr`
fetches in `refreshFundamentalsX()`. The Yen carry-unwind row is
deliberately always `dir: null` (a volatility warning, not a directional
call) — don't "fix" it to always vote a direction.
The Eurozone growth pulse reads FRED `BSCICP03DEM665S`, which stopped at 2024-01-01: the strategist (`council/macro.mjs`
`MAX_AGE`) drops it as "no data", and since 9 Nov (#703) `gold-trading.html` ignores a value over about 4 months old too, so the row is
empty on both (a replacement series is still open: docs/owner-decisions.md, item 16).

## Conventions

- Any change to `gold-trading.html` should keep the file self-contained
  (no build step, no external JS beyond the Lightweight Charts CDN and
  keyless public data APIs).
- Test headlessly with Playwright before merging (the page smoke test and the ChronosTrade audit, see "Start here");
  rebuild and commit `out/`; check that CI and the Vercel deploy go green after merging.

## Public / admin split (6 Nov 2026, owner request)

`market-structure.html` has two modes: **public** (default) shows only trades (market, side, entry, stop, target, result)
and the chart markups; **admin** (signed in through `/api/login`, see "Server-side sign-in" below) shows everything (Setup, Scanner, system cards, shadow trades, scorecards,
reviews, notes). Anything that describes a rule, a system name, a note or a reason must sit inside an element with class
`adm`, or be guarded by `PUB` in the JS templates; `pubonly` is the public-only counterpart. Keep it that way in redesigns.
To change the owner password: compute `sha256` of the new one (e.g. `printf %s 'new' | sha256sum`) and replace `OWNER_HASH` in
`api/_accounts.js` (the only copy; the page holds no hash).

### Accounts and sign-in (6 Nov 2026)

The page opens on a centred sign-in card (`#ms-gate`, shown while `html[data-gate]`) unless the visitor is signed in or
chose **Continue as guest** (localStorage `ms-guest`, public view). Sign-in is password only (6 Nov): the password picks the account
(checked on the server by `/api/login` since 9 Nov), so every password must be unique.
Built-in members live in `api/_accounts.js` `BUILT_IN` (server only: `{ <key>: { name, hash: sha256(password), role, ict?, ct?, mcp? } }`);
a reviewer session gets the admin view
read-only (`html[data-role="reviewer"] .own` hides the owner's journal, log-trade button, CSV loader and Telegram
settings) and can write loss reviews, which carry `by: <name>`. The footer is hidden; log in / log out live in the account menu (`#ms-me`), which clicks the hidden `#ms-admin-link` (log out = `msSignOut()`). Add members on the Users page (or a `BUILT_IN` entry with the SHA-256 of their password).
Viewers (`role: 'viewer'`, currently **Luxus** (who also teaches on the Mosha desk, his main page since 10 Nov: see "Mosha desk") and **Carlos**; Orlando became a reviewer on 8 Nov, see "Accounts, desks";
`VIEWER` in the main script) are read-only with a reduced site (the role defaults; per-member permissions since 8 Nov): Home
(Today strip, open positions, setup now), Setup, and the Council overview (active trades + P&L calendar); no charts,
scanner, journal, other council panes, loss-review panel, alerts, settings, or photo/name changes.
Guests (owner, 6 Nov) see only `#v-guest`: an H4 gold chart (`renderGuest()`) with one system trade (the open/pending
gold system trade, else the latest closed) drawn as an entry line, a stop zone and a target zone, no labels; all other
views, the nav, the header badge, alerts and settings are hidden for `html[data-role="public"]`. Guests also see the results of
our main system only (`sysClosed()`: live system trades, the system's replay and NQ forward paper; never shadow): the
Today / week / month strip (`#g-today`, `renderToday()` with system-only numbers and live floating) and a P&L calendar
(`#g-cal`, `renderGuestCal()`).

Header (6 Nov): Settings and Alerts are icon buttons; the account area `#ms-me` (oval photo, time-of-day greeting,
name) opens a menu to change photo (resized, stored per user in localStorage `ms-photo-<user>`), display name
(`ms-name-<user>`) and log in/out. Default portrait: a gold monogram for named users, a silhouette for guests. The sign-in page is
branded "Aureum Desk" (renamed from Meridian X on 16 Nov 2026) with a gold chart background (no system names on it).

## Supported book, financing in the costs, replica mirror gold only (11 Nov 2026, owner on the edge review)
The owner was shown `research/proposals/2026-11-11-edge-review.md` and answered "yes anything that is better for the system and
that applies it": approval (absolute rule 3) of exactly its three recommended changes, nothing wider (docs/owner-decisions.md
items 37-39; 40 and 41 are open). Each is a Trader `USER_RULES` entry, so it reaches council-data `config.json` the way every
owner rule has: applied once on the first round after deploy, logged in `config.history` (`by: 'user'`). No entry rule, filter,
size, stop or exit of any system changed; nothing of ICT was touched.
- **1. `supported-book` → `config.ownerShadow = { replica, 'mosha-bo', gtl, gmp, 'nq-open': <unix start> }`.** Live on paper:
  **Gold trend (`gtrend`) and Gold daily engulf (`geg`) only** (their Trader blocks are pinned by sha256 in
  `tests/supported-book.test.mjs`). The five listed are **paper shadows**, the 7 Nov `gold-trend-fast-shadow` precedent: the same
  block pushes the same record with `shadow: true, blockedBy ['owner-shadow']` (`ownerSh(k)` in trader.mjs; Mosha BO adds
  `'owner-shadow'` to its blocker list; the momentum pullback keeps its 6 Nov `['test']`; the NQ open run's record is marked
  AFTER the sha256-pinned push, like the regime tag), managed by the same loop, never alerted, no futures ticket, not in
  `mt5/signals.csv`, no "Mosha armed" heads-up. **A trade already open as live stays live to its own exit with its stop**: the
  management loop never reads the switch. `fills.mjs` `ownStream(x)` (live, or shadow with blockedBy exactly `['owner-shadow']` /
  `['test']`) is "the system's own trades": the replica's cap / daily stop / equity filter, the trendline's one-position rule,
  Mosha's cap, the decay monitor's forward record (`recordOf`) and the regime tag's META read it, so each shadowed system keeps
  one continuous record (live trades before, owner-shadow trades after) and a trade another rule blocked is never in it.
  `council/decay.mjs` `SYSTEMS`: `shadow: true, since` on the five (`SHADOW_11NOV`; `shadowSince` in coach.json decay / expect, shown
  as "shadow since 11 Nov"); live = gtrend, geg, ict-a. To put one back: a new user rule deleting its key from `ownerShadow`.
  **The page needed no list change**: `SYS_K`, `NQ_SYS`, `SYSG`, `GUEST_DATA` and `api/_guestcut.js` take a row only when it is
  not `shadow`, so the five systems' new trades drop out of "main" by their own flag and the trades they took live before stay
  main (history is not relabelled). The scoreboard reads `config.ownerShadow` (`OWNER_SH`: status "shadow", "paper shadow by the
  owner since <date>"); the Systems pane opens with `#ms-sys-book` ("Which systems trade live · since 11 Nov 2026", class `adm`).
  Still true and said to the owner: the system replay (`research/replay-2w.json`, ends 3 Nov) keeps its replica / NQ rows, so the
  guest's replay curve is the systems that were main then; `council/book.mjs` `IDEAS` (a paper comparison) is unchanged; the
  Academy still teaches the seven rules. On the cTrader mirror a shadow trade of the five goes to the shadow book's account
  (`bookOf`; the gold replica stays on the replica book), as Gold trend fast does.
- **2. `count-financing` → `config.financingFrom`.** `council/fills.mjs` `FIN` (named constant with source and date: gold longs
  0.000148 of price a rollover, the demo broker's XAUUSD `swap.long` of 11 Nov 2026), `nights(t, c)` (Mon-Fri 22:00 UTC, Wednesday
  three: the study's function, compared on 3,000 holds), `financing(t)` = nights x rate x entry / r0 per unit. `tradeCost` adds it
  to `costR` (records get `finR`, `nights`), so `Rnet`, `snapshot.costs` (`fin` per book, `financing` block), the digest, week
  pane, scoreboard and decay record carry it with no change of their own. **costR is stamped once at the close**
  (`annotateCosts`), so it applies to trades closed from the first round after deploy; no closed trade was recosted (a dry run on
  the live files changed none). Gold longs only: shorts credited nothing, no other market charged (no rate measured). "What to
  expect": `research/edge/expectations/build.mjs` charges the four long-only gold systems' study positions (expect-base `fin`,
  `financing`; gtrend +0.489 → +0.398, geg +0.186 → +0.141, gtl +0.048 → +0.013, gtrend5 +0.372 → +0.289, equal to
  `research/edge/trend-breadth/result.json` `partA`, tested). The replica, Mosha BO, the momentum pullback, the decay baselines,
  the council replay rows and the engine's 30-day replay were done the same evening: next section. Today's rate is used for
  every past year. Never change `FIN` without a source.
- **3. `replica-mirror-gold-only` → `config.mirrorReplica = { markets: ['xau'], since, until: { n: 200, grossR: 0, text } }`.**
  `ctrader-mirror.mjs` `replicaMarkets(cfg)` / `replicaCandidates(research, own, markets)`: a replica research trade of a market
  outside the list gets `noCopy: true` and the one place that opens anything (`fresh`) skips it. **It stays in the trade list on
  purpose**: a position copied before the rule keeps following its record (stop guard, stop moves, the close), never orphaned.
  Gold replica copies and every other book are unchanged. Condition (in the config and counted every round in
  `snapshot.mirrorReplica { closed, grossR, need, met }`): 200 or more forex / crypto replica paper trades closed since the rule,
  total R before costs above zero. **Nothing resumes by itself**; off-switch: a user rule setting `c.mirrorReplica = null`.
- Tests: `tests/supported-book.test.mjs` (17), `tests/ctrader-mirror.test.mjs` (3 new), `tests/expect.test.mjs`,
  `tests/decay.test.mjs`. Changed on purpose: `tests/academy-edges.test.mjs` (the seven edges are the systems live until 11 Nov),
  `tests/trend-breadth.test.mjs` (the Trader and fills.mjs may now NAME the study as the rate's source; none imports it).
- Item 41 (a 10-lot gold buy on the Replica demo account, 11 Nov 13:37 UTC, not placed by the mirror): answered 12 Nov 2026, the
  owner placed it; the owner resets that account in the broker's own app before its record is read (nothing in the repo resets a
  demo balance; `council/ctrader-reset.json` resets the mirror's records on EVERY account, so it is not the tool for this).
- **Since 12 Nov 2026 the live paper book also includes the Mosha cycle (`mcycle`)** by the owner's choice of 11 Nov, kept on
  12 Nov ("Yes to all"; docs/owner-decisions.md item 48; section "Mosha cycle: a main paper system"). It is not in
  `council/decay.mjs` / expectations (no base study): the decay and "What to expect" cards say so in their first line
  (`MS_NO_BASE`, shown while `config.moshaCycle` is on and `mcycle` is not in `ownerShadow`), and `#ms-sys-book` names it. The
  forward-test book (`council/forward.mjs` `BOOK`) stays Gold trend + Gold daily engulf only. Its Trader block does not read
  `ownerShadow` yet. Never invent a baseline for it.

## Financing, the rest: baselines, replay rows, the engine replay, the page between two readings (11 Nov 2026)
The loose ends of the section above, inside the same approval (the approved cost model made the same everywhere). No entry
rule, filter, size, stop or exit changed; no stored trade or cost was rewritten; nothing of ICT was touched.
- **One rule for a backtest row**: a gold BUY pays `nights(entry, exit) x FIN.xau.long x entry price / initial risk`, first unit
  only; a sell pays nothing and is credited nothing; no other market is charged. Three helpers in `council/fills.mjs`, all on
  `financing()`: `rowFinancing(x)` (a replay / study row with no stamped cost; risk = `r0`, else the first stop `stop0`, else
  `stop`; a row with `costR` / `Rnet` gets 0, so a closed forward trade is never recosted) and `replayFin(tr, v)` (one engine
  replay trade, for one exit variant).
- **Decay baselines** (`council/decay-base.json`, `research/edge/decay-monitor/run.mjs`; `financing` block, per system `fin`
  `{ perTrade, nights, charged, before }`). Before → after, R a trade: Gold trend +1.640 → +1.504 (0.136R a position, 22.8
  nights), Gold trend fast +1.064 → +0.940, daily engulf +0.198 → +0.139, H4 trendline +0.106 → +0.068, momentum pullback
  +0.043 → +0.032, Mosha BO −0.064 → −0.093, replica +0.877 → +0.865; NQ, ICT, crypto unchanged. Drawdown limits a little
  wider (Gold trend 6.88R → 7.47R, daily engulf 22.28R → 25.49R). **No decay status changed** on council-data of 11 Nov.
  - The rebuild records (`research/edge/robustness/out/*.json`) hold t / R / gross / side only. **Never edit
    `research/edge/robustness/systems.mjs` or `lib.mjs` for a reason like this: their bytes are the Academy's version of the
    momentum pullback edge** (`academy/edges.mjs` `ruleSource`; a changed byte means regenerating Academy data).
    `research/edge/decay-monitor/positions.mjs` instead loads that file's own functions (the text above its main part, the shared
    `simTrade` wrapped), runs them, refuses to write unless every position equals the committed record, and writes
    `positions.json` (`[t, o, c, e, r0, side]` per position, row for row with the record). Candles: `research/candles/xau-histdata`
    from `origin/council-data` (`git show`, no network) + the Mosha event cache (`systems.mjs mosha` once, about 2 minutes).
  - The council replay rows (`research/replay-2w.json`) are read through `decay.mjs` `replayNet` (= `merNet` less
    `rowFinancing` x size) in `recordOf` AND in the baseline build, so a record and its baseline are costed alike. Forward
    trades keep `merNet`. coach.json `decay.financing` says a reading's baselines carry the charge.
- **"What to expect"**: the replica (−0.052 → −0.057R on 2017-22, t −0.19), Mosha BO (+0.137 → +0.121R on 2006-17, t 0.48) and
  the momentum pullback (−0.043 → −0.052R on 2018-22, t −1.05) are charged too (their records do allow it: `mosha-oos`
  positions carry side / times / r0, `replica-oos/positions.json` lines up with `sizing/inputs.json`, gmp from positions.json).
  The four long-only gold systems are unchanged; every system's "backtest" block follows the new baselines.
- **Engine replay** (`council/backtest.mjs`): a new LAST column `fin` (financing of the live exit `R_none`, in R; `null` for an
  open row) and `backtest.json` `financing { rate, asOf, of, trades, R }`. **The `cost` column is still the spread alone**:
  `trader.mjs`'s Coach statistics (which move live filters) subtract `cost` only, on purpose, so financing can never move a
  live filter (a test pins that line). Readers that judge `R_none` take `fin` off: the scoreboard's 30-day rows, the
  Analyst's Scalp table, `proposals.mjs` (proposals only). A fresh 90-day gold replay (13 Aug - 11 Nov 2026, OANDA, 776
  live-style trades): R_none −69.99R, spread 31.18R, financing 3.73R on 77 buys held over a rollover; net −101.17R → −104.90R
  (−0.130 → −0.135R a trade). The forex rows carry 0. The 8 Nov "pinned" 90-day file is not in the repository (the window
  rolls with the clock), so this is a new run, not a re-cost of that one.
- **Scoreboard system-replay rows** (`#ms-sb-js` `nightsOf` / `finOf`, a mirror of `fills.mjs` compared on 2,000 holds in the
  test): a gold buy of `research/replay-2w.json` pays at the rate the Trader publishes in `snapshot.costs.financing.perNight`
  (no rate in the page; no rate on file = nothing charged, and the row does not say "after financing"). On 11 Nov: Gold trend
  +37.0R → +34.0R (t 2.49 → 2.36), Gold trend fast +66.8R → +62.6R, replica +186.0R → +183.4R, others under 0.5R; **no
  verdict moved** (`r.v` unchanged for all 43 rows). `digest.mjs` hands the snapshot to the same function.
- **Between two Coach readings** (`#ms-decay-js` `MS_BOOK_NOW(coach, config)`): coach.json `decay` / `expect` are rebuilt
  every 6 hours, so after an owner's supported-book rule they said "8 live systems" for up to 6 hours. The page marks a
  system listed in `config.ownerShadow` as shadow in its own copy (`bookLate`, display only, before the `ms:council` event)
  and both cards add "This reading was made before your decision…". The financing clauses of the two footnotes
  (`#ms-decay-fin`, `#ms-expect-fin`) follow the reading in hand (an older one says its figures are before financing).
- **Wording**: the Academy's seven edges are "the seven Meridian systems that were live until 11 Nov 2026"
  (`academy/edges.mjs` comment, `docs/academy/ARCHITECTURE.md`, `MERIDIAN-X.md`); no Academy logic, data or page file changed.
- Not done, on purpose: `council/fidelity.mjs` and `research/portfolio.mjs` (research tools) still read `cost` only; the add
  unit of a trend position is not charged in any backtest (the records do not carry its entry); the quoted worst drawdowns
  of the gold systems (`gold-systems` RESULT.md) are before financing; `research/replay-2w.json` itself is not rewritten.
- Tests: `tests/financing-rest.test.mjs` (11), `tests/expect.test.mjs` (`finCheck`). Changed on purpose:
  `tests/backtest-oanda.test.mjs` (the last column), `tests/research-ledger.test.mjs` (the decay-monitor's build date),
  `tests/supported-book.test.mjs` (the replica's `fin`, the footnote).

## Loss review (6 Nov 2026, owner request)

Admin-only card `#ms-loss` on `market-structure.html`: every losing trade (live and shadow, 7 or 30 days) stacked by the
strategy that took it; a row opens the trade chart, where `#ms-tv-rv` adds drawing (pen, line, text; points stored as
[UTC time, price]), reason tags, a "why it failed" note and a rule idea. Reviews are kept in localStorage `msLossRev` and,
when the owner pastes a GitHub fine-grained token (localStorage `msGhTok`, Contents read/write on this repo), written to
`council-data/reviews/losses.json`. The trader reads that file: tags hunt / noise / late / news count in its lesson
rules; other tags repeating 3+ times on a setup become `snapshot.ownerReviews.candidates`, which the twice-daily council
check tests before any rule change and answers in each review's `council: {at, verdict, note}`.
Analyst post-mortems (7 Nov): each Trader round writes a post-mortem of every closed losing live trade (`analystReviews` in
`council/analyst.mjs`) to `council-data/reviews/analyst.json` (`by: 'analyst'`, tags hunt / noise / late / news only on clear
evidence; news = the `council/events.mjs` calendar + the review's recorded ForexFactory news, tagged only for a tier-1 / central-bank
or recorded high-impact release within 2 h before the stop); `ownTags` in the trader uses the owner's review first and these only where none exists. They live in their own file,
not in `losses.json`, because the page PUTs the whole `losses.json` and a bot commit of it could overwrite a fresh owner review.
The loss review rows and trade dialog show them ("analyst: …"); `analysis/latest.md` gets "Loss post-mortems" and a daily
"What changed" block (rolling 20 vs whole record per setup, Welch t; never an edge without n and t).
The trade dialog has a timeframe row (`#ms-tv-tf`: Auto, M1–D1) and "More history" (+300 candles back each tap, up to
~3,800); candles come from the trade's own dates (`rangeBars`: Binance pages, Bitstamp for forex, latest candles as a
fallback). A timeframe switch keeps the review being written (`openTrade(id, keep)` skips `rvOpen`).

## Council layout (6 Nov 2026 renovation)

The Council view is a workspace with a sticky section bar (`#ms-c-nav`, tab pattern, arrow keys) and five panes
(`#ms-cp-<name>`): **overview** (active trades + calendar), **trades** (Trader table), **systems** (`adm`: NQ, gold
replica, pairs; their static rule texts fold into `<details class="c-how">`), **review** (`adm`: loss review + trade
reviews; the tab badge counts losses of the last 24 h not reviewed yet) and **research** (`adm`: analyst, coach, scorecard,
backtest). Deep links `#council/<name>`; the last pane is remembered (localStorage `msCpane`); public mode only sees
overview and trades. The trade chart dialog `#ms-tv` lives at the end of the app container, not inside a card, so it opens
from any pane. Card titles (`.ms-k`) are sentence-case headings, not uppercase eyebrows. New council cards go into the
pane they belong to, not into one long grid.

## Home and navigation (6 Nov 2026, renovation 2)

Home is a dashboard: quick-jump row (`.h-quick`), a "Today" strip (`#h-today`, `renderToday()`: floating now from
`window.FLOAT` set in `renderActive()`, closed R today / this week / this month from `COUNCIL.trades`, live + shadow with
the live part shown), then two columns: Setup now (admin) + Open positions (`#h-act-list`, biggest market+side groups,
rows open the trade chart) on the left, compact tiles (`.tile-s`) on the right. The bottom tab bar (`.btab`, now with
Scanner for admin) becomes a fixed left sidebar at ≥1180 px, where the header's top tabs are hidden.

**The graphite look (17 Nov 2026, docs/design/aureum-theme.md; owner rejected the 16 Nov black-and-gold).** The Desk's tokens live in ONE
place: the first `<style>` block of `market-structure.html` defines `--au-*` (bg, surface, surface-2, well, line, ink-1/2/3, accent,
primary / on-primary, gain / loss / warn / info, shadow, mark, font, sizes, spacing, radii) for dark (`:root`), light and midnight
(pro uses dark), and points every older name at them (`--bg`, `--panel`, `--ink*`, `--line*`, `--accent*`, `--buy*`, `--sell*`,
`--gold*` = the accent, `--au-gold*` = primary / accent, `--sans` / `--mono` = Figtree). The later redefinitions (4 Nov, Design pass
100, the midnight navy block, pro's oklch tokens, scoped light overrides on Home and the guest page) were removed: never redefine a
token further down. The frame (mark `.ms-coin` = silver rounded square with "A", wordmark `.wm` AUREUM / DESK in the header below
1180 px and for guests, in the sidebar and on the sign-in card; flat header with quiet icon buttons; the Desk | Macro | ChronosTrade
switch without its ring; nav active = surface-2 + a 2 px accent bar; 12 px cards; one neutral primary button; Home without the wash,
quiet jump links, open positions before the setup and the market cards after the grid at 641 px and up) is `<style id="ms-shell-css">`,
the LAST style block, so it wins over the older passes; it never mentions the simple phone view. The UI font stays Figtree (Inter is
not loaded on the Desk). `tests/qa-sweep.test.mjs` `tok()` follows `var()` into the first `:root` block, so the contrast checks
measure the real colours. Not done: a desktop "what waits on you" line (the phone has `#ps-need`).
**Design pass (17 Nov 2026, owner: "More improvements on the design"; found on screenshots of every page, dark / light, 1440 / 390 px).**
Display only. In `#ms-shell-css`: Home's three section tiles showed empty squares (an older rule painted the masked icon in
`--au-surface-2` on its own `--au-surface-2` square; the glyph is `--au-ink-2` again); the Market pulse cards are flat (the colour
stays in the trend bars); on phones up to 430 px the header's account button was cut off (17 px at 390, 7 px at 360): tighter
gaps, nothing hidden. The default portrait is a neutral silver bust with a sans "A" (it was sepia with a serif italic), and the
Profile card's copy gets its own gradient ids (it drew an empty circle). Setup's trade-card labels are sentence case. Every page's
favicon is the silver mark (`/assets/aureum-mark.svg`; offline.html inline), not the gold coin. ChronosTrade's Hide sits beside
the session title on a phone.
**Simpler Home (17 Nov 2026, owner: "Simpler home page, and improve the design").** From 641 px Home answers first (spec section 4):
`#hs-home` = the date line (mirrored from `#h-date` / `#h-clock`), ONE sentence as the page's title (`#hs-a`: today's forward paper
result of the main systems, "before costs", from `window.MS_TODAY` through `MS_PS.answer`; never a replay figure), two columns
**Open now** (ours first, the shadow trades in their own list "Shadow, followed on paper" with their own count and floating figure,
never one figure; `MS_PS.openRows` / `rowHTML`) and **Waiting on you** (`.hs-need adm`, hidden for viewers; `MS_PS.needs`, the
phone's `#ps-need` source), the places (Charts, Council, Desks, Macro desk, ChronosTrade; the Charts / Macro / desks gates kept),
then ONE closed disclosure "More on the desk" (`#hs-more-t`, toggles `#v-home.hs-open`; not remembered). Everything Home held before
(setup headline, jump links, Today strip, markets, open positions, setup now, sessions, possible trades, sections, market pulse,
the phone blocks) is unchanged inside `#hs-more-b`; up to 640 px that wrapper is `display: contents` and `.hs-only` is not drawn,
so both phone views are the page as they were (390 px: same blocks, numbers and height). CSS `<style id="ms-hs-css">` right before
`#ms-shell-css` (tokens only, never `data-phone` / `.ps-`); script `#ms-hs-js` after `#ms-ps-js` (fetches nothing, `window.MS_HS`).
The shell's desktop order rules now read `#v-home .hs-more-b > …`. First screen as the owner at 1440 px: 13 blocks / 64 numbers
before, 4 / 15 after (1024 px: 11 / 52 → 4 / 15); load CLS about 0.01-0.03. Test: `tests/home-simple.test.mjs`.

## Last seen on the Users page (20 Nov 2026, owner: "when last time users been online")
`api/_seen.js`: `touch(env, key, now)` writes `{ <account key>: ISO time }` to the private store file `presence/seen.json`
(overwritten in place, read with `cache=0`; at most one write an account per 5 minutes per instance; every failure swallowed, so
sign-in and pages never wait on it). Called by `/api/me` (each page load of a signed-in member) and `/api/login` after the account
is checked. Only the owner's `GET /api/users` returns `seen` (null = unreadable). Stores the account key and a time only: no IP,
device or page. Page: `window.msSeenText` under each name (`.u-nm` / `.u-seen`): "Online now" (under 5 min), "Last seen 3 h ago
(20 Nov, 07:22)", or "Not seen since 20 Nov 2026" (nothing recorded before this feature). Test: `tests/last-seen.test.mjs`.

## Users page (6 Nov 2026)

Owner-only view `#users` (sidebar "Users"): lists the built-in accounts (server side, `api/_accounts.js`; their public records
come from `/api/users`) and the ones added or changed on the page, which live in the private Blob list (see Vercel below; since
9 Nov saved with the owner's session, hashes never in the browser). The stored list overrides built-ins (`msMergeUsers`);
`disabled: true` removes one. A signed-in account is re-checked by `/api/me` after load and signed out if removed or if the
password changed. Passwords must stay unique per account (the server refuses a duplicate).

## Gold playbook check (6 Nov 2026, owner's skills) (removed 17 Nov 2026)
The view is gone (section "Simplified pages"); the text below is history.

Admin card `#ms-pb` on the Setup view (`renderPlaybook()`, called from `renderHome()`), from the owner's skill collection
(gold-msnr-playbook §2-5, Mosha S.CODE, Zlankator, MMXM): context tiles (council Weekly structure `goldW1` vs the setup,
Daily regime = 20-day efficiency ratio on closed D1 candles, countdown to the 17:00 New York Daily close, NY midnight
open and price above/below it, session / kill zone), the playbook's pre-trade checklist (auto items + manual ticks kept
per day in localStorage `msPb-<inst>-<NY date>`), a verdict, and the management rules. Guidance only: the Daily-ER filter
failed the council's own 2023-26 test (council-data research/log.md, 6 Nov), so it is not a council rule.

## ICT desk (6 Nov 2026, owner: a separate edge)

ICT is its own edge and approach: never mix it into the council systems, their rules, filters or reports.
Rules and research live in `.claude/skills/ICT/SKILL.md` (results also in council-data `research/ict/`).
- Tracker: `ict/tracker.mjs`, run inside the council loop every 3rd round (~35 min; `ict.yml` is manual only since GitHub
  dropped its 15-min schedule, and the Vercel cron `/api/run?job=ict` runs it at :04/:19/:34/:49 when the run mode is live), data in council-data `ict/`
  (`trades.json`, `snapshot.json`, `bars.json`). Markets: NQ, ES, YM, RTY futures and gold futures (GC) from CNBC (Yahoo fallback); EUR/USD and GBP/USD removed 7 Nov (owner). Grade F signals (total < 3, `MIN_GRADE`) are not recorded and are filtered on the desk (`KEEP`). Model: H1 iFVG
  reversal (swing swept → body closes through the leg's FVG within 6 H1 candles; stop 2 ticks beyond the sweep;
  no fixed target: from +2R the stop trails 1.5R behind the best price (skill §15; before 6 Nov: 3R target); fixed-2R
  result recorded as `R2`; out after 36 closed H1 candles, skill §21; 48 h before 7 Nov; index futures also move the stop to the entry at +1.5R, `P.be`, skill §32, not gold). Every signal records ICT features (`feat`) and a /10 grade.
- Page: view `#ict` ("ICT desk", class `ictx`), shown only when `html[data-ict]` is set: the owner, and users
  with `ict: true` (Fred, the main reviewer and trader, lands there after sign-in). The desk user marks signals
  Taken / Skipped / Missed with fill and own R, grades them and writes notes: localStorage `ictDesk`, synced to
  council-data `ict/desk.json` with the `msGhTok` token.
- Read-only desk: `ict: 'read'` on a user (Orlando) sets `html[data-ict-ro]`, which hides `.ict-rw` (the review form,
  "My trading", GitHub saving); viewers with ICT access may open `#ict`.
- Replay: `ict/replay.mjs` (workflow `ict-replay.yml`: on change, on demand with a start date, weekly) runs the same
  `signals()` over CNBC history since 1 Aug 2025 (default; 1 Jan 2026 before 7 Nov; FX back-filled from HistData) and writes council-data `ict/replay.json` (records carry `replay: true`).
  The desk has a Both / Live / Replay switch (localStorage `ictSrc`) and a P&L calendar of closed signals.
- CME calendar (`ict/calendar.mjs`, no network, derived from the CME rule set, checked date by date 2018-27 in
  `tests/ict-calendar.test.mjs`): `cmeShut(t)` = weekend (Fri 17:00 - Sun 18:00 ET), full holidays (New Year, Good Friday,
  Christmas; from the eve's 17:00 to the 18:00 reopen) and early closes (MLK, Presidents', Memorial, Juneteenth, 3-4 July, Labor Day,
  Thanksgiving + the day after, Christmas Eve: shut from 13:00 ET until 18:00). CNBC prints flat candles into every shut period, so
  `closedBar()` filters the feed and the replay's cash/spot fills with it; `council/datacheck.mjs` CME hours use the same calendar.
  Signals on a normal week are byte-identical to the weekend-only filter (test on the pinned candles).
- Audit (7 Nov): CNBC intraday requests start on the hour (bars are anchored at the request's start minute); bars in the
  17:00-18:00 ET halt are dropped; an H1 candle / 5m bar counts only once the feed has a later bar (or it is 20+ min old);
  the time exit is at the close of the 36th H1 candle; replay trades whose window has a > 4-day data hole are dropped
  (`replay.json` `gaps`); Both does not count a live signal twice. Tests: `node ict/audit-test.mjs` (pinned copy in tests/fixtures/ict/; or pass a copy of council-data ict/).
- Futures rolls (7 Nov, research/edge/futures-roll): CNBC intraday `.1` candles are the CURRENT contract's own (no roll step), its
  daily candles are an unadjusted front-month splice (steps of 0.6-1.7 % at each switch). `rollAdjust` back-adjusts the index daily
  candles with spreads read from CNBC's `.NDX .SPX .DJI .RUT` closes (`MARKETS[k].cash`; gold unadjusted); `contractShift`/`shiftTrade`
  move open trades' levels when a run's H1 sits a constant offset from the last run's `bars.json` (records get `rolled`, snapshot
  `switched`/`d1Roll`); the replay's `liquidFrom` (OFF by default since 8 Nov, owner: keep the 812 / +123.7R record; `ICT_REPLAY_LIQUID=on` for research) would drop the current contract's thin pre-front-month hours and back-fill them
  (Dukascopy / spot gold, OANDA 5m where those files end; RTY has no fill). Tests: `tests/ict-roll.test.mjs`.
- A-setup filter (skills §14 + §20 + §22 + §23): against the daily bias + grade >= 7 + stop between 0.3x and 0.75x the daily ATR
  + not a jobs-report morning (first Friday of the month before 10:00 ET, `nfpMorning`)
  + (skill §25) a tight stop 0.15-0.3x ATR also counts when it has A+ quality (body >= 0.6, not NY PM), at half size
  (`RISK_TIGHT`, `sizeOf`; records carry `size`, R stored x size, `Rraw` per unit; desk pill "½ size")
  (`feat.atrR`, `RISK_FLOOR`, `RISK_CAP`, `isASetup`; records carry `aset`).
- Gold futures (skill §26, 7 Nov): MARKETS also has `gc` (@GC.1) with its own `aRule`: buys with a 0.3-0.75x ATR stop. The index
  rule applies to nq/es/ym/rty only (`isASetup(g, mk)`); no A+ tier for gold; desk clusters stay index-only.
- Forward-test features (skill §29): `feat.htfFvg` (sweep into an unfilled D1 / H4 FVG) and `feat.cc` (prior daily
  candle-closure bias vs the signal) are recorded on every signal and split in "What works"; not filters.
- M5 entry for Fred (skill §30): index A-setups → wait ≤ 6 h for an M5 iFVG, enter on its close with the H1 stop; beats
  the H1 entry every year but needs execution on the close (not automatable at 15 min); shown in the signal checklist.
- Size by room (skill §27): index A-setups 1.5x when the DOL is >= 2R away, else 0.5x (`DOL_ROOM`, `ROOM_SIZE`, `sizeOf`),
  times the §25 tight-stop half; R is stored x size; desk pill "<n>× size".
  The desk defaults to A-setups (switch `ictFlt`: A-setups / All signals / One per cluster — the highest-grade index of
  same-side A-setups within 3 h, skill §16, computed on the page); every signal is still tracked.
- A+ tier (skill §17): A-setup + inversion body >= 60% of range + not NY PM (`isAPlus`, records carry `aplus`); desk
  filter "A+".
- Desk extras (6 Nov): New York clock with kill zones (`#ict-clock`), a live forward-test card on futures signals only
  (`#ict-fwd`, replay excluded; verdict needs ~30 closed A+), an auto checklist per signal (`#ict-tv-ck`), and NY 00:00 /
  PDH / PDL lines on the signal chart. Skill §19: the edge is not proven on 2023-26 cash data — paper only.
- Paper-only markets (7 Nov, `research/ict-markets.md`): `SHADOW_MARKETS` in tracker.mjs, NOT in `MARKETS` (never in trades.json,
  snapshot, bars, alerts or the cTrader mirror). Only `xag` (spot silver, OANDA via `/md/bars`, gold rule, variant `silver`):
  tracker step 6 → `shadow.json .variants.silver`, replay → `.shadowByVariant.silver` (records `shadow`, `variant`, `paperMarket`;
  `.paperVariants` lists them so the Coach does not judge them as filters). Spot gold, EUR/GBP/JPY, DAX, BTC/ETH failed the gate.
  Never add a market to the live A-stream without the owner.
- Shadow A-rule variants (paper only, `shadow: true` + `variant`, never alerted, own one-open stream; shadow.json `.variants`,
  replay.json `.shadowByVariant`, desk comparison table): `nofri`, `h1opp` (entry filters) and `strail` (skill §33: same A-setups, exit
  by H1 structure trail from +2R instead of the 1.5R trail; `manageTrade` / `simulate` act on it only for records carrying `strail`).
  The live A-rule records and stats never change for a shadow; the owner approves live rule changes.

## ICT desk: every result traceable to its execution (11 Nov 2026, Fred's proposal after his audit; owner: "And then deploy")
The audit's case: the 6 Nov ES short. Live `es-s-1793995200` entered 7,405.00 and booked -1R; its replay copy
`es-s-1793995200-r` entered 7,401.75 and was still unresolved when the replay's candles ended, yet the desk kept comparing it
with newer prices (-5.22R on screen), and the connector counted outcomes differently from the desk. Three changes:
- **Checkpoint** (`ict/replay.mjs` `simulate`): every record carries `through` (the end of the last candle processed for exits; the
  exit time once booked); an unresolved one also `stopNow`, `markPx`, `markR` (per unit, at that candle's close), `beMoved` /
  `trailMoved`. The desk never marks a replay record against a newer price: `liveR` / `liveRs` / `pxOf` read the checkpoint and the
  card, row and dialog say "Replay through <time> ET · update pending" (`rpThrough`; an older file without `through` says "as of
  its run"). A run replays every candle in order from the signal, so the first exit is booked and booked once; with fewer than 36
  H1 candles on file every candle on file is processed (before: only the first 36 clock hours, so a weekend hid a stop until the
  window was complete). A hole of over 4 days still means no record (`gaps`), never a guessed exit; a market whose feed fails keeps
  its records of the file being replaced (`out.kept`). The replay workflow runs **daily** (weekly before).
- **Correction log** council-data `ict/replay-log.json` (`replayDiff`, `appendLog`, written before replay.json is replaced): per
  run that changed something, `resolved` (was unresolved, now booked: its `through` / `markR` before, the booked values after),
  `corrected` (a booked result that differs, from / to), `removed`, `added`, totals before and after. A run that changes nothing
  writes no entry. The replaced file stays in council-data's git history at `prevAt`.
- **Two executions of one signal**: live `<id>` and replay `<id>-r`. The combined list keeps one row; its result cell shows both
  (`execs`, `.ict-ex-b`: source, fill, status, review grade), each opens by its exact id, the dialog has the same switch
  (`#ict-tv-ex`) and says whose review is being written (`#ict-rv-for`). A note is stored under the execution's id with
  `exec: 'live' | 'replay'`; `MS_ICT.reviewExec` reads an older note's execution from its key and flags "check" when its
  recorded fill is nearer the OTHER execution's entry. Connector: `ict_trade` and `ict_desk_update` take the exact id
  (`findExec`; no more `-r` guessing), records carry `source`, `otherExecution`, and an unresolved replay one `updatePending`,
  `replayThrough`, `stopAtThrough`, `unitRAtThrough`.
- **One booked outcome**: win / loss / break-even = the sign of a closed record's stored per-unit R (`Rraw`, else `R`); sizing
  and display rounding never change it; an unresolved record is never booked. The same rule in `ict/replay.mjs` (`outcomeOf`,
  `tally`, replay.json `totals` with losses / be / nearFlat / open and `outcome`), the page (`MS_ICT.outcome`, `stats`) and the
  connector (`outcome`, `stats`; it used |R| <= 0.05 as break-even: 294 / 462 / 61 against the desk's 301 / 464 / 52).
  **Near-flat** = |per-unit R| <= `NEAR_FLAT` 0.05, a named research label shown beside the counts, never an outcome.
- Not done here: no historical result was edited by hand. The three unresolved records (ES, NQ, gold) are resolved by the replay
  on its own futures feed and land in the log as `resolved`; Fred's independent reconstruction (ES stop -1R at 7,437.75, NQ time
  exit 27,316, gold time exit 4,129.7) is to be compared with those entries. Tests: `tests/desk-ict-trace.test.mjs` (not named
  `tests/ict-*`: it also checks the page and the connector), `tests/mcp.test.mjs`, `tests/mcp-apply.test.mjs`.
- **Frozen history** (11 Nov 2026, the first logged run): 8 Nov 13:49 -> 11 Nov 09:12 UTC changed 26 booked records, removed 11
  and added 8 (+23.6R of the +26.65R move, 97.92R -> 124.57R) with no rule change. Cause: the futures feed does not return the
  same candles for the same past hours on every run, and the replay rebuilt everything from them each time. Shown from the two
  files and the spot-gold fill file: (1) gold's back-fill boundary is the feed's first candle of that run (1 Mar 23:00 on 8 Nov,
  27 Feb 00:00 on 11 Nov) and the scale is the median futures / spot ratio of the 20 days after it, over thin candles
  (1.02967 -> 1.02950): every level of 23 Dec - 26 Feb moved by about $0.80 (25 records); (2) rebuilt from the fill file alone,
  6 of the old file's gold records and 4 of the new one's differ, each where another candle was mixed into the 5-minute exit
  data: the five changed results; (3) the fill file starts 20 Dec 2025, so gold before that is built only from the feed's stray
  candles and differs on every run (8 removed, 7 added here; that stretch summed +8.4R, -1.3R, -5.8R and +7.5R
  in the four files of 7-11 Nov made on the same rule); (4) the removed NQ record has no signal on the Dukascopy fill alone, and the ES entry moved one tick on the
  last hourly candle before a weekend. Inferred, not shown (the candles of a run are not saved): that the odd candles are the
  feed's stray prints of the then-deferred contract. Fix (`ict/replay.mjs` `freezePlan`, `freezer`, `run`): a booked record that
  closed more than `SETTLE` (3 days) before the END of the previous run is carried from the previous replay.json exactly as
  booked (paper streams too), and no record the previous file does not have is started inside that stretch; open records,
  those booked in the last 3 days and new ones are computed. replay.json says so: `frozen` (`cut`, `baseAt`, `why`, `carried` /
  `ignored` per market, `adopted` when the base file predates this), `ruleCode`, `marketThrough`, and per market
  `src.<m>.cnbcFrom` + `src.<m>.fill` (`scale`) = that run's own boundary and scale. Everything is recomputed, and the run is
  written to the log as `rebuild` (also when it changed nothing), when the workflow's "rebuild" box / `ICT_REPLAY_REBUILD=on` asks,
  when the start date differs, or when `ict/tracker.mjs`, `calendar.mjs` or `replay.mjs` changed (`ruleCode`: a rule change must
  show over the whole history). A market whose feed failed is frozen only up to the last run that read it. `gaps` now counts only
  the signals a run computed. No result was edited: the base is whatever file is in place at the first frozen run, stray-built
  gold records of Aug - Dec 2025 included (11 records, +7.49R in the 11 Nov file; keeping or dropping them is the owner's call).
  Still open: a rebuild draws the feed's noise again (about +/-25R), so a rule change's effect on old history cannot be told from
  it until the replay keeps its own candle archive; not checked on the live feed (not reachable from the build sandbox). A normal
  daily log entry should show `resolved` and `added` only, `corrected` and `removed` only for records closed in the 3 days before
  the previous run. Tests: `tests/desk-ict-stable.test.mjs` (a fake feed whose window and scale differ between runs).
- **First frozen run, and gold starts where its candles start** (11 Nov 2026, round 2). The run of 13:15 UTC did what was
  expected: `adopted`, 810 records carried (803 paper), 813 of 817 records byte-identical, the 4 others inside the 3-day window with
  the same booking, totals unchanged (815 / +124.57R), no log entry. That run's own gold boundary was a third one (9 Mar 00:00, scale
  1.02986; whole 10-day blocks of old gold hours come and go in the feed's answers), and booked history did not follow it. Changes:
  (1) before the feed's continuous start only back-fill candles are used: the feed's stray 5m prints there are dropped
  (`strayM5`); (2) a market's record starts at `recordFrom.<m>` (`from`, `t`, `why`) = the replay start, or later the first candle
  of its back-fill or, with no back-fill, of the feed's continuous history; derived from the run's candles, never a date in the
  code, and it never moves later once recorded (also bounded by the previous file's first record that is not `cash`); signals the
  old stray-built series would have given are counted in `uncovered.<m>` (`before`, `signals`, `strayM5`); (3) carried records
  from before a market's start leave once, and the log entry names them: `uncovered` (`why`, `recordFrom`, `ids`, `shadow`), the
  same ids in `removed`. On the 13:15 file that is 11 gold records before 21 Dec 2025 (+7.49R) and 2 RTY records of 27 and 29 May
  2026 (-2R; RTY has no back-fill and its feed starts 7 Jun): the headline goes from +124.57R to about +119.08R. (4) `SAME_RULES`:
  a plumbing-only change lists the `ruleCode` it replaces, so its merge is not a rebuild; a rule change never adds one. (5)
  `frozen.blocked` = signals inside a record of the previous file (never records); `frozen.ignored` = only the rest (the first run
  counted both: about 100 a market). The desk's status line says "(Gold from <date>, where its candles start)" after "Replay
  since". Still open: a rebuild cannot recompute what the feed no longer returns (RTY before its feed start is lost on a rebuild),
  and the candle archive is designed, not built: about 266,000 5m and 28,000 H1 candles, 3.6 MB as gzip JSON (1.9 MB
  delta-coded), about 0.4 MB of new blobs a day; it needs an additive level shift at each contract switch, which cannot be
  checked without the live feed.

## The watchdog's own timer (18 Nov 2026, owner: "lets go"; docs/owner-decisions.md items 15 and 31)
`watchdog.yml` sends the "council stopped" alert but ran only on GitHub's :11 / :41 cron (a few times a day) and after a
completed council run (none comes when the loop hangs inside a run). The Worker's 10-minute cron now runs
`/api/status?job=watchdog` FIRST in its chain (`CHAINED`; no new trigger): `api/_watchdog-kick.js` (no imports) reads the `at` of
council-data `snapshot.json` and `ict/snapshot.json` through `api/data.js` `readFile` and, when the council is over
`COUNCIL_MIN` 20 min old or the ICT desk over `ICT_MIN` 45 min outside the futures weekend (the limits and weekend of
`council/health.mjs`, a test compares them), starts `watchdog.yml` on main with `GH_DISPATCH_TOKEN` (Actions: write). At most once
per `GAP_MIN` 30 min: no start while a watchdog run is queued or running or one was created in the last 30 min, by anyone
(GitHub's run list is the marker, as `council/replay-due.mjs`). Not sure is no: an unreadable snapshot or run list, or no token,
starts nothing; a fresh desk asks GitHub nothing. The watchdog still decides what to send and keeps its `watchdog.json` mark, so
no alert is doubled; this path sends no message and writes no file. Guarded by `CRON_SECRET` (401 otherwise, `private, no-store`);
the public `/api/status` answer is unchanged. Tests: `tests/watchdog-kick.test.mjs` (8). Not checked live: the dispatch itself
(Actions cannot be started from the build sandbox) and whether the Worker's token has Actions: write.

## ICT replay: a trigger that does not depend on GitHub's cron (11 Nov 2026, reliability)
`ict-replay.yml`'s cron is not enough: of its 35 runs up to 11 Nov, one came from the schedule (the then weekly cron, 8 Nov,
started 13:49 UTC for 06:41) and 34 from pushes; a run takes 2-32 min (median about 10). So the council loop starts it:
after each round's save, one line of `council.yml` runs `council/replay-due.mjs data` (read only: `decide`, `listRuns`, `main`) and,
only on exit 0, `gh workflow run ict-replay.yml --ref main` (main's definition, no inputs = never a rebuild; the loop already
had `actions: write`). Due = council-data `ict/replay.json` `at` over `STALE_H` 20 h old AND no run of the workflow active
(any status but completed) AND none started in the last `GAP_H` 6 h, by anyone (cron, push, a person, the loop): GitHub's own
run list is the marker, so a hand-over of the loop or a failed replay cannot lead to a second start inside 6 h. A fresh file is
answered without the network; an unreadable run list, a timeout or a crash is "no". The line is `if …; then … || echo …; fi`
with `timeout` on both commands, so it cannot fail or hold a round (at most 75 s), and it sits after the save, never between
the Trader and the mirror or in the quick pass. The cron stays as the second path; the replay's concurrency group keeps one
run at a time. While the loop itself is down nothing starts the replay but the cron (the Vercel backup runner does not).
Monitoring: `datahealth.mjs` `FILES` `ict/replay.json` warns after 36 h (named on the Data chip: "ICT replay … not updated
for …") and is bad (pages through the data check) after 4 days; before, 8 and 15 days. Not verified by a live run (Actions
cannot be run from the build sandbox): the dispatch itself; the decision was run against the live run list. Tests:
`tests/replay-trigger.test.mjs`.

## ICT study: what the sweep took, equal lows / highs vs one swing (11 Nov 2026, owner: "what about the strategies? use the skills")
`research/edge/ict-equal-lows/` (PREREGISTRATION.md pushed first, with a table of every concept of the ICT skill against the earlier
ICT studies; then `run.mjs`, RESULT.md, result.json). The one concept the skill puts first that no study had computed for a signal:
did the sweep take a pool of relative equal lows / highs (engineered liquidity, skill §1, §9.1), or one swing? Detector `eq.mjs`
(pure, candles at or before the sweep candle only): two or more confirmed, untouched H1 swing lows (3 a side, last 96 candles, 4+
candles apart) within 0.1 x the daily ATR(14), all traded through by the sweep candle; sells mirror. Tested as a split of the desk's
own A-setups (the lab's `runMarket`: the tracker's `signals` / `isASetup` / `sizeOf` and the replay's `simulate`, imported, never
edited; live exit, sizing and stops) on OANDA mid H1 2020 to October 2026, NQ / ES / YM / RTY / GC, IS 2020-23 | OOS 2024 on, net of
the lab's costs, three tests with Holm. **Verdict: FAIL.** Equal-pool A-setups (one in six) made −0.007R a trade in sample (n 172)
and +0.092R out of sample (n 107, t 0.72); the other A-setups +0.092R (873) and +0.138R (579, t 2.07); OOS difference −0.046R,
t −0.32. Index book the same; gold has 29 OOS trades and no difference (t 0.09). Not a filter, not a grade point, not a size-up, and
not evidence that equal pools are bad (t under 1). It measures a mechanical H1 definition, not a pool chosen by eye: Fred's "REH/REL"
review tag measures that. Nothing under `ict/` changed and no proposal was written. Still untested: NWOG / NDOG as the key level a
sweep runs into (needs futures candles with real gaps), quarter of the month / year. To repeat: `node --use-env-proxy
research/edge/ict-equal-lows/run.mjs fetch <dir>` (candles outside git), then `… full <dir>`. Tests: `tests/desk-ict-equal-lows.test.mjs`.

## Coach evolution (7 Nov 2026, owner: members evolve without overfitting)
`council/coach.mjs`, wired into the statistical Coach in `council/trader.mjs`. Filter changes (D1 / structure / session) need
`solid()` plus a shrunk expectancy ≥ 0.10R (empirical-Bayes prior around 0R), and each runs as a champion/challenger trial
(`config.coachTrials`): the old rule is followed as a shadow on the same signals and comes back by itself unless the new one wins
by ≥ +0.05R shrunk per disagreeing signal over 20 of them (60-day limit). Every Coach change lands in `coach.json` `ledger` with
its evidence and a 30-day result, shown in analysis/latest.md (`<!-- coach-ledger -->` block). Owner rules (`userOwned`) and
live setups (`focusSetups`) stay out of the Coach's reach. Knobs (buffer, min stop, R:R, break-even, news guard, dollar cap)
need 30+ trades and move once per 14 days (`knobGate`); promotion proposals need t >= 2 and a shrunk expectancy over the bar.
Regression against the robustness audit: `tests/coach-audit.test.mjs` (fixture `tests/fixtures/coach-audit.json`). Tests: `tests/coach-*.test.mjs`.

## Main systems first (7 Nov 2026, owner: "our main edge looks horrible")
The council calendar (`renderCalendar`) defaults to the main systems (`SYS_K` live trades + their replays + NQ paper); the
admin switch `.cal-src` ("Main systems" / "+ Shadow", localStorage `msCalSrc`) adds the shadow book and its back-filled
replay (research/shadow-replay.json, about −1,200R Jun–Oct, setups the live rules block). The Home Today strip
(`renderToday`) headlines `sysClosed()` and floating live R; shadow and retired-engine trades sit on the second line.

## NQ open run regime tags (8 Nov 2026, from the regime-switch study's proposal)
`council/regime.mjs` (pure, tests/nq-regime.test.mjs checks it against research/edge/regime-switch run.mjs on all 1,869 study trades):
every live NQ New York open run record (research.json `nq-nyflip-<day>`) gets `regime: { trend, ts, trendAsOf, meta, metaN, on, cut }`
at entry: TREND = NAS100 6-month trend strength |ln(C/C-126) / (sd x sqrt 126)| from OANDA daily closes (`/md/bars?sym=nas100&tf=1d`,
candles closed before the entry, weekend stubs dropped), META = the stream's own net R over the 365 days before. User rule
`nq-regime-shadow` (`config.nqRegimeShadow = { trendMin: 0.295 }`, the study's frozen cut): when |TS| >= 0.295 a paper copy of the
trade is pushed as `nq-nyflipt-<day>` (session `nyflip-trend`, `shadow: true`, `blockedBy ['regime-shadow']`, `of: <live id>`),
managed by the same nq-open loop. The live rule is untouched (the test pins its block by sha256). The shadow never alerts or gets a
futures ticket (`alertable` skips research shadows), is not "our system" on the page (`nqSys` / `nqLive`), and lands in the week
report's shadow book as "NQ open run, trend-on only (shadow)"; `snapshot.nqRegime` carries the latest tag, shown on the NQ card.
**12 Nov 2026, defect found, fix proposed (item 50)**: the open-trade loop (`for (const r of openNq)`, OUTSIDE the pinned push)
reads `r0 = |entry - stop|` on every run, and the `nq-runner` trail moves `stop`, so after a trail move (from the next run on) a
trailing-stop exit books about +1.00R whatever the profit, a time exit is divided by the larger distance, mfe stops growing,
and the trail's new stop `entry ± (mfe − 1) x r0` jumps past the rule's level (it can be put next to the price). The records
carry no `r0` / `stop0`. Effect so far: none (no `nq-open` record in research.json's whole history ever had `trailMoved`; the
only two runner records, 9 Nov, stopped at −1.05R); `research/replay-2w.json` rows come from another program that keeps the
opening stop and are unaffected. The fix (stamp the opening risk as a new field `r0`, from `tp1` / 2 for a record already
trailed) changes where the trail puts the stop, so it was a proposal (`research/proposals/2026-11-12-nq-open-r0.md`); **applied 18 Nov
2026** (owner: "do all"): the loop stamps `r0` before its trail can move the stop. Never compute an NQ open-run R from the current stop. Test: `tests/nq-open-r0.test.mjs` (lifts the loop from the trader's text).

## LIT paper shadow stream (8 Nov 2026, owner: "leave it as paper shadow or just LIT")
`council/lit.mjs` (pure; tests/lit-shadow.test.mjs) is a verbatim port of the LIT study's detector (research/edge/lit run.mjs: #596
pre-registration, #597 result INCONCLUSIVE / not an edge at the skill's defaults; the verdict stands). User rule `lit-shadow`
(`config.litShadow = true`): on gold, on the OANDA feed, the Trader reads ~4,000 closed 5m candles from the proxy once a round (the
whole previous trading week: previous-week level, weekly range), runs the pre-registered primary (M15 FBOS of a session / previous-day /
previous-week / accumulation / equal-highs level in London or the New York morning, M5 RBOS by wick, limit at the order block's open,
stop MX + spread + buffer capped at 0.08% of price, target the accumulation's far extreme, R:R > 3) and pushes each order as a pending
limit record `xau-lit-<s|b>-<orderBarTime>` (`k 'lit'`, name "LIT (paper shadow)", `shadow: true`, `blockedBy ['owner-shadow']`,
`entryMode 'limit'`, `validFor` 24 M5 bars, `maxHold` to 17:00 New York re-stamped from the fill, `noBe`; the swing break-even moves the
stop in the LIT block after two post-entry M5 swing breaks). Gates as the harness: one order at a time, <= 1 London + 1 NY_AM fill a
day, stop after a win or -1.5R. Never live, never alerted, not in SYSK / SYS_K / decay / expect; it shows on the shadow trades tab and
in the shadow book by name. Paper deviations (in each note): fills on any touch of the limit (the study needed a 1-tick trade-through
and filled at the open through a gap), the 09:30 candle can fill, prices at the Trader's 2 decimals, break-even applied a round late.
NQ is not covered (the Trader has no NAS100 5m feed in the Trader's shape). `snapshot.lit` carries the round's counts.

## Gold trend fast (7 Nov 2026, owner goal: more profit from the skills)
Second gold-trend leg `gtrend5` (user rule `gold-trend-fast`, `config.goldTrendFast = { n: 5, k: 2 }`): the gold trend rule on
the prior 5 daily highs, its own position and add next to the 20-day leg (`gtrend`); the trader runs both from one loop
(`LEG`). Sizing guide 0.25% (bridges: the shared gold risk). Replay 2023-Oct 2026 in research/replay-2w.json (39 trades).
Adopted on return per drawdown of the gold book (+39.3% → +45.5% | +68.6% → +79.9%, worst drawdown −2.34 → −2.61% |
−6.21 → −6.47%), positive every year 2019-26 alone.
Same day, later (owner, #530; user rule `gold-trend-fast-shadow`, `config.goldTrendFastShadow`): the fast leg's new trades are
paper shadows (`blockedBy owner-shadow`), still managed by the same loop, never alerted; `council/decay.mjs` lists it `shadow: true`.


## Gold playbook view (7 Nov 2026, owner: "make dashboard only for this skill") (removed 17 Nov 2026)
The view is gone (section "Simplified pages"); the text below is history.
Admin-only view `#gold` (`#v-gold`, nav "Gold playbook"; hidden for viewers and guests) for the owner's gold-master-playbook skill
(kept locally only, never in this public repo). It shows the skill's tested edge in my own words: Weekly structure bullish (last
completed W1 body close above the last 2-bar-fractal swing high) + a New York-close Daily candle closing above the prior day's low
and in the top 30% of its range → buy the next Daily open, stop $0.30 under its low, 3R (2R option), out after 10 days, longs only.
Self-contained script at the end of the page (`window.renderGold`): Binance PAXG H1 since Nov 2020 grouped into NY 17:00 days
(`gpDays`, weekend hours dropped; closed days cached in localStorage `msGpDays1`), shifted onto spot via gold-api.com; context
(Weekly state and the level that flips it, 20-day ER, Daily close, session), backtest (each signal its own trade, $0.35 cost, stop
first; halves 2021-22 untested | Nov 22-Oct 24 | Nov 24-now), signal list with "Took it" ticks (`msGpTook`), checklist ticks per day
(`msGpCk-<NY date>`), variant switch (`msGpVar`), size calculator (`msGpSize`). Not a council system; not mixed with ICT.
Calendar and tweaks (7 Nov): a P&L calendar on the view (`renderCal`: closed trades by NY exit day, open ones on today with
floating R listed but never added in: a day's figure is closed trades only, owner 15 Nov 2026, `tests/calendar-closed.test.mjs`; month/year totals, "Every signal" / "Ones I took" switch `msGpCalSrc`). Tweaks tested on spot gold 2018-26 (exits,
targets, caps, regime/trend filters, overlay, candle colour): none gave more profit AND less drawdown in both 2023-24 and 2025-26,
so the rule stays as the skill wrote it; the table sits on the page (`TW`). 2018-20 also positive (+31.7R, PF 1.43).

## Futures tickets for TradingView (7 Nov 2026, owner: council trades on TradingView, option 1)
TradingView takes no orders from other programs and its terms ban automating its site, so the council does not trade there:
each phone alert (ntfy / Telegram) for a live gold or NQ trade carries a micro-futures ticket from `council/futures.mjs`
(gold → MGC even months rolled a week before the delivery month, NQ → MNQ quarterly rolled 8 days before expiry; contracts from
repository variables `FUT_ACCOUNT` / `FUT_RISK`, default $10,000 / 0.25%; stop / target as distances and, for gold, futures
prices = spot + the GC−spot basis from the ICT snapshot) and opens that contract's TradingView chart. Limit systems get a
LIMIT ticket when placed and a cancel when they expire; closes get a CLOSE ticket. Manual workflow "Futures ticket test"
(`council/futures-test.mjs`) sends one sample ticket. Later option 2: broker API (TradeStation / Tradovate) with TradingView as the screen.

## Working areas in the graphite look (17 Nov 2026, docs/design/aureum-theme.md)
Charts (`#v-charts`), the Council workspace (`#v-council`) and the trade dialog (`#ms-tv`). Display only. `<style id="ms-wa-css">`
(between `#ms-hc-css` and `#ms-sz-css`) maps the `--au-` tokens to local `--wa-` names, each falling back to the old variable, and
re-points the Charts chrome tokens (`--cx-*`): neutral selected state (surface-2 + hairline), active Council tab = surface-2 + 2 px
accent bar, flat 12 px cards, sans titles weight 650 / 600, sticky Trades table header, 2 px accent focus ring; Style sits beside
Indicators on the right. No hex in it (only the spec's two shadows). The chart canvas reads `--au-surface` / `--au-ink-3` /
`--au-line` when defined (`auChart` beside `THEMES`, called from `applyTheme`); candle colours untouched. Bug fixed: the markup
switch (`setMode` and its click handler) matched every `[data-mk]` button, including the Council calendar's market filter
(`data-mk="all|xau|nq|pairs"`): the calendar never showed its selected market and a tap on "Gold" there reset the chart markup to
Meridian; both are now scoped to `.mk-mode`. The veteran discussion's "STRATEGIST" label no longer runs into its text.

## Council → Research, folded (20 Nov 2026)
Display only. The Analyst's weekly brief (`analysis/latest.md`) and the Coach's latest AI review (`reviews/latest.md`) were drawn open
and made the Research pane about 17,000 px tall at 1440 px. `mdFold(html, box)` (next to `md()`) wraps each `## ` section of the
rendered markdown in `details.c-mdf` (summary = the heading, 44 px; the title and the lines before the first section stay open);
open state is kept in memory for the visit (`MDF`). "Ready right now" (`#ms-c-ready`) shows six rows and "Show all n" (`.c-rbtn`,
`RDY_ALL`, memory only). Research pane 17,094 → about 5,000 px; the Analyst card 13,791 → 1,245 px. Test: `tests/qa-sweep.test.mjs`.

## Home and Council reading pass (11 Nov 2026, quality round)
Display only, `market-structure.html` Home and Council panes; no council member computes anything differently. Found by using
the panes as owner, reviewer and viewer at 390 px touch and 1440 px in the three themes, each figure checked against council-data.
- **Forward and replay are never one figure.** The Trades pane's "Live · our system" tiles said Closed 715, Win rate 42%, Total
  +497.9R; 710 of those were backtest replay rows (research/replay-2w.json, +499.97R) and the forward paper record was 5 trades,
  1 won, -2.05R. `fwdSplit(closed)` (main script, `window.MS_HC`) splits by `x.replay`: the tiles show the forward record
  ("Closed, forward", win rate with "1 of 5", "Total, before costs") and one labelled line carries the replay ("Backtest replay,
  not traded: n trades since <month>, % won, R"). The Home council tile says both apart too. Keep any new total on that split.
- **Edge decay counts match the rows**: a live system with `few: true` is "too few to judge", not healthy, and a shadow system the
  monitor calls decaying / on watch is named (`MS_DECAY_TALLY` in `#ms-decay-js`, `MS_WEEK.decayCount` for the week pane's chips).
  The card said "8 healthy, 0 decaying" over a "Too few" row and a "Decaying" one.
- **One way to write R** in the Home / Council templates: `rTxt(v, d = 2)` (sign, the minus glyph, two decimals; "—" when not a
  number). The loss review, trade table, equity labels and the Home strip use it; `mnTxt` shows a hyphen-minus in council-written
  text (the Analyst's report, rule history, the macro brief) as the minus glyph, leaving dates, ranges and arrows. A planned
  reward:risk reads "target 2.00R", not "2R" like a result.
- **Stamps**: `stampTxt(iso, everyH)` = day, time, zone name, and "Stale: …, N h old (written every 6 h)" past twice the cadence
  (decay, what to expect, book weights); the trade table and loss review say whose clock their times use.
- **`<style id="ms-hc-css">`** (after `#ms-desk-css`, scoped to `#v-home` / `#v-council`): no text under 12 px in these panes
  (the Home session ring's hour ticks excepted), 44 px touch targets (Data chip, folded status line, checkbox labels, scoreboard
  sort buttons and links), the Systems mirror row no longer stretched to 966 px by the broker table on a phone, report tables
  with readable columns that scroll inside their box, long tags wrapping beside the R figure in Active trades, the Active list
  holding its place while loading (layout shift 0.62 → 0 on a phone), and no dead Macro / This week tabs for a member without the
  council permission. Add new Home / Council size fixes there, never a second block.
- Tests: `tests/qa-sweep.test.mjs` ("Home and Council reading pass"), `tests/week-report.test.mjs` (`decayCount`).
- Seen, left alone: the scoreboard's verdict chip "Edge" on replay-only streams (n and t are in the row); the
  replica track chart's axis uses a hyphen; "Journal · No trades yet" on Home while the council has trades (the owner's own journal).
- Done 12 Nov 2026 (two of the items above): **the trade chart dialog** (`#ms-tv`: title, key, chart labels, Before / After
  pills, ticket text, the review's strategy line) writes every R through `rTxt` ("Loss −1.00R", "Best +0.61R", "Now −0.51R") and
  a planned reward:risk through `rrTxt` ("Planned target 8.04R", "target 2.00R at …"; `MS_HC.rrTxt`); council-written text in it
  (post-mortem, lesson, note) goes through `mnTxt`. **Costs basis named**: Home's Today / This week / This month sublines say
  "before costs" (tooltips too), the week pane's tiles are "…, after costs" (was "net") and Meridian live's gross is "before
  costs". No sum changed. Tests: `tests/qa-sweep.test.mjs` ("trade chart dialog", "Home strip says before costs").

## Simple phone view (11 Nov 2026, owner: "On the mobile there's too much, we need a simpler version for the phone")
`market-structure.html` only; the other pages are untouched. On a screen up to 640 px the Desk opens in its **simple view**
(`html[data-phone="simple"]`, set by a small head script before the first paint); "Phone view: Simple | Full" at the end of every
view (`#ps-sw`, `window.msPhoneView`) switches to the dense phone layout as it was and remembers it on that device (localStorage
`ms-phone` = `full`; nothing stored for simple). Measured before → after at 390 x 844 as the owner: Home 2.6 → 1.7 screens and
39 → 21 numbers on the first screen, the ICT desk 9.5 → 3.4 screens, the Mosha desk 5.5 → 1.8 (Luxus's landing 5.9 → 2.0),
Profile 4.3 → 1.0. Rules to keep:
- **Nothing is removed, nothing moves on a wider screen.** `<style id="ms-ps-css">` has ONE rule outside its
  `@media (max-width: 640px)` block (`.ps-only { display: none; }`: every part the view adds carries `.ps-only`); every rule inside
  styles a `.ps-…` part or is scoped to `html[data-phone="simple"]`. A test parses the block. Checked with a box-by-box comparison
  of every visible element at 1440, 1024 and 700 px and in the Full view at 390 px against the build before (0 differences).
- **Home**: one answer (`#ps-a`: "Nothing closed today" / "Today: +0.40R on 1 closed trade", then the week; the forward paper
  record of the main systems before costs, the same sums as the Today strip, handed over as `window.MS_TODAY` + `ms:today`), what
  is open (`#ps-o-list`, at most three rows; **our own trades and shadow trades are never one row or one figure**, ours first;
  a row opens the trade by its `#trade/<id>` link), what waits (`#ps-need`: `MS_WEEK.decisions` on the loaded coach / health /
  config for the owner, the data feeds alone for a reviewer, plus the Review tab's unreviewed-loss count; robustness changes are
  only in the week pane, which the row opens), and four places (`#ps-go`). Everything else on Home is a `[data-ps]` section
  folded to a one-line row (`button.ps-fold[data-ps-for]`, static markup so nothing folds after the first paint; layout shift 0).
  The quick-jump chips are not drawn in this view (their places are Council tabs).
- **Council overview**: the same answer block (`#ps-c-ans`: our open trades and their float, the shadow book in its own
  sentence) and the first three positions; "Show all n with their details" (`#ps-act-more`) gives the full list.
- **ICT, Mosha, Profile**: `desks()` in `<script id="ms-ps-js">` folds every card but the ones a person comes for (ICT: Open
  now and Signals; Mosha: the teach form, the lessons, the "Your turn" card, and the record for a non-teacher; Profile: the
  identity card) to a row with the card's own heading. The rows are put in only while the simple view is on and taken out with
  it; a row follows its card when the desk moves it (the teacher's order) or renames it (French), and a card the account's own
  gate hides gets no row.
- **Gates**: a fold row carries the same `adm` / `own` class as its section (a test compares them); `#ps-need` is `adm` and
  hidden for viewers; the council shortcuts follow `.h-quick`'s rule; guests see no part of it (their page is unchanged, the
  switch is not shown). The script fetches nothing. Verified per role: no text is visible in the simple view (all folds opened)
  that the role could not see before, apart from the view's own labels and summaries of figures the role already saw.
- The bottom bar already kept four places plus More (shell 2, 7 Nov); unchanged.
- Tests: `tests/qa-sweep.test.mjs` ("simple phone view": the head script on fake media, the CSS scope, the gates, `MS_PS`
  pure pieces); the smoke test's phone owner run fails when the Desk does not open simple or Home's first screen holds more
  than 9 blocks / 3 open rows.
- Not done in this first pass: Charts, the Council's other panes, Setup, Scanner (second pass, below); the guest page and
  Journal (still as they were). The other pages got their own simple views the same day (their sections).

**Second pass (11 Nov 2026, owner: "Need more")**: the rest of the Desk, same key, switch, style block and fold helpers
(never a second mechanism). Order worked in, by how likely a phone opens it: Charts, Council → Trades, This week, Review,
Systems, Research, Macro, then Setup, Scanner, the Gold playbook, LIT and Crypto desks. Measured at 390 x 844 as the owner,
screens before → after: Trades 2.1 → 1.3, This week 6.9 → 1.9, Review 3.1 → 2.6, Systems 5.5 → 1.5, Research 37.9 → 1.4,
Macro 7.6 → 2.7, Setup 5.7 → 2.9, Scanner 3.2 → 1.4, Gold playbook 2.7 → 1.6, LIT 16.4 → 1.2, Crypto 5.0 → 2.9; on Charts
the chart started at 314 px and ended 110 px under the tab bar, now 255 px and above it.
- **Charts**: row 1 the markets and **More** (`#ps-ch-more`, `.ps-cmore`), row 2 the timeframes, then the chart, sized to end
  above the tab bar. Behind More (`#v-charts[data-ps-more]`): the markup switch, indicators, Context and its strip. Hidden is
  not switched off: the markup in use is named on the button ("ICT · More"), and the script never touches `setMode`,
  drawings or the watchlist. Every Charts rule is `html[data-phone="simple"]:not([data-role="public"]) #v-charts …`: a guest's
  chart page (the lock, Clean only) is untouched, and `html[data-role="public"] .ps-cmore` is never drawn (a test reads both).
- **An answer block per pane** (`.ps-ans`, static markup, filled from sums the pane already worked out; pure functions on
  `MS_PS`): Trades `#ps-t-ans` = `tradesAnswer(window.MS_TRADES)`: "Forward record: −2.05R on 5 closed trades · 1 won", and the
  backtest replay in its own sentence ("not traded and kept apart"); **forward and replay are never one figure**. The pane
  hands `MS_TRADES` over (`ms:trades`; tab, open, `fwdSplit`'s fwd / rp; never for a guest). This week `#ps-w-ans` =
  `weekAnswer(MS_WEEK_NOW, MS_WEEK_DEC)` (`ms:week`, from `renderHead` / `renderDec`): Meridian live after costs, the ICT desk
  in its own sentence ("a separate edge"), then how many decisions wait; the decisions card comes right under it
  (`order`, `.wk-col { display: contents }`), the tiles fold to "The week in numbers". Review `#ps-r-ans` =
  `reviewAnswer(n)` from the Review tab's own badge (losses of the last 24 h not reviewed, live and shadow together, said so)
  with "Show only the ones to review" (presses the pane's own To review filter).
- **Cards fold to a row with two lines** (`.ps-fold.ps-two`, `rowText`): the heading up to its first " · ", and one line: the
  rest of the heading, or the first sentence of the card's own summary once drawn (`.sb-sum`, `.dc-sum`, `.ex-sum`, `.bk-sum`,
  `.md-verdict`; never a line the account's gate hides). `DESKS` now also lists `ms-cp-systems` (keeps `#ms-sys-book`,
  **"Which systems trade live": open and first**, `order: -1`), `ms-cp-review` (keeps the loss review), `ms-cp-research`
  (every card a row), `ms-cp-macro` (keeps Next day; the veteran's discussion inside it is the static row `vet`),
  `ms-cp-week` (keeps the decisions), `v-setup` (folds the playbook check; price and levels are the static row `kv`),
  `v-gold` and `v-lit` (keep the first card), `v-crypto` (keeps the chart and the setups). A made row copies its card's
  `adm` / `own` class.
- **Lists**: Trades shows the latest five rows, Setup the first three possible trades, Scanner the first four markets (the
  page sorts ready ones first); "Show all n …" (`.ps-more`, `lists()`, `[data-ps-all]` on the card). One fold row may fold
  several parts (`[data-ps="tnum"]`: the Trades note, tiles and curve).
- **No fold after the paint** (the first pass's flaw): (1) the observer that folds a card drawn late runs `desks()` at once
  (before the next paint) instead of 120 ms later, falling back to the timer if it is ever called more than 12 times in half a
  second; (2) a desk a member lands on (ICT, Mosha) was painted with every card open until the script at the end of this
  long page ran: `html[data-phone="simple"]:not([data-ps-ready])` holds the same cards back from the first paint and the
  script sets `data-ps-ready` as its first statement (so a failure below shows the cards, never hides them). Open cards while
  the ICT desk loads: 10 then 3 before, 2 then 3 now; Luxus's landing 5 then 1 → 1. A desk that draws its cards again (LIT)
  keeps the rows a person opened (`OPENED`).
- Verified: every drawn element's box and all visible text, build before against build after, 0 differences at 1440, 1024 and
  700 px (owner), in the Full view at 390 px (owner, Fred, Orlando, Luxus, Carlos) and for a guest at 390 and 1440 px; per
  role, the text visible in the simple view with every fold opened is the text of before plus the view's own labels and
  sentences (figures the role already saw); AA, 12 px, 44 px and no cut-off at 360 / 390 / 430 in the three themes.
- Tests: `tests/qa-sweep.test.mjs` ("simple phone view 2": six tests); the smoke test's phone owner run opens `#charts` and
  `#setup` too and fails when a view does not lead as described (chart under the tab bar, Trades tiles unfolded or more than
  five rows, a Systems card other than "Which systems trade live" open, an open Research card, This week without its
  sentence, more than four Scanner markets).
- Left: Journal (1.6 screens, its two cards are what it is for), Users and NQ SDV (one screen), the guest page; the Council's
  status line and tab bar above every pane (about 230 px); the loss review's intro paragraph and three filter rows; a
  landing on a hash still paints Home for a frame before the router shows the view (seen while measuring, not the fold).

## Vercel (7 Nov 2026, owner: move to Vercel Pro) — stage 1
`vercel.json` (since 12 Nov 2026 Vercel does NOT build: it serves the committed `out/`, which CI's build job checks against `sh scripts/build.sh`; the build cost about $60 of $99 over 7-12 Nov. Never put the build back into `buildCommand`; `/macro-dashboard/*` rewritten to the root so index.html's asset paths
work, `/gold`, `/macro-desk`, `/backtest`, `/cdata`, `/md/*`, `/api/mcp/<key>` rewrites, no-cache on HTML). The first stage's
`api/kick.js` (Vercel crons dispatching the GitHub workflows) is gone: the crons now call `api/run.js` directly (below) and
`/api/alert-cron`; `CRON_SECRET` guards them (compared in constant time); never commit it. GitHub Pages keeps deploying in
parallel (`deploy.yml`).
Status 7 Nov: Vercel project `macro-dashboard` (prj_4krxNideb9D2LfdcXkAWtAwzPLST) in team `xau` (team_40SuZQP47lNHxjlzDc8PeRH5),
production https://meridianx.dev. Protection: previews only (production public). The build copies only the pages,
assets and icons to out/; council/ and ict/ ship inside the api/run.js bundle and are never served. Owner wants the repo PRIVATE:
- api/data.js serves council-data files at /cdata/* with GH_TOKEN/GH_READ_TOKEN (falls back to the public raw file while none is set);
  the site uses /cdata on Vercel (window.MS_CDATA) and raw.githubusercontent elsewhere; MT5/cTrader bridges default to /cdata/mt5/signals.csv.
  Since 9 Nov only the guest allowlist is public; everything else needs a session (see "Server-side sign-in").
- api/run.js runs one council round (cron every 4 min, ~75 s) or ICT round (:04/:19/:34/:49, ~35 s): downloads only the files the job
  reads, runs the unchanged script in /tmp, commits the changed files to council-data via the Git Data API. RUN_MODE=live commits and
  sends alerts; otherwise dry run (no commit, alerts off). Owner, 7 Nov 16:3x: GitHub Actions is the council runner (council.yml);
  the Vercel council job stands down while Actions saved in the last 10 min and takes over by itself if the loop stops. A full
  cut-over (GH_TOKEN + the trader's NTFY/Telegram/FUT env on Vercel, RUN_MODE=live, the GitHub loop removed, repo private) has not
  happened; a private repo would end the free Actions minutes the loop relies on (see docs/owner-decisions.md, item 32).
Since 8 Nov the project deploys from GitHub `main` (production only, and only when a served file changed: `scripts/vercel-ignore.sh`).
Server-side login landed on 9 Nov (below); broker-order functions are a later stage.

### Vercel Pro features in use (7 Nov 2026)
- **Firewall** (project WAF): custom rules "Block scanner probes" (PHP/WordPress/dot-file paths, deny), "Only reads outside the API" (POST/PUT/PATCH/DELETE outside /api → deny), "Rate limit data" (/cdata 600/min per IP), "Rate limit API" (/api 30/min per IP); OWASP php/lfi/rfi/java/scanner-detection on deny, sqli/xss/rce/generic on log; managed AI-bot blocking. No persistent (timed) blocks: a shared mobile IP must never lose the site for an hour. Bot protection is NOT on: MT5/cTrader read /cdata/mt5/signals.csv without a browser.
- **Edge Config** store `meridian-flags` (ecfg_cma62alpxbxii4mkvlvxnixfi257), env `EDGE_CONFIG`, read by `api/_flags.js`: `runMode` (overrides RUN_MODE, no redeploy), `paused` (["council"], ["ict"], ["all"]), `notice` + `noticeLevel` (bar across the dashboard top). Edit it in Vercel → Storage → Edge Config.
- **Market data: OANDA** (`api/bars.js`, served at `/md/bars?sym=&tf=&n=` or `&from=&to=`): spot XAU/USD and forex mid candles, UTC daily alignment, edge-cached 2–60 s (past windows a day). Env `OANDA_TOKEN` (+ `OANDA_ENV=live` for a live account; default practice). Without the token it answers 503 and the page falls back to Binance/Kraken/Bitstamp with the PAXG→spot offset; with OANDA the offset is 0. Firewall "Rate limit market data": /md 900/min per IP. Crypto stays on Binance/Kraken. The bots (council/ict) still use their own feeds.
- **Live ticks**: `api/stream.js` at `/md/stream?sym=` streams OANDA prices as Server-Sent Events (≤5/s, closes after 270 s, EventSource reconnects); the page opens it only while the market is open and moves the forming candle on every timeframe. Instrument map in `api/_oanda.js`.
- **Link previews**: `api/og.mjs` (@vercel/og 0.11.1; 1.0.x fails to load in plain Node) draws a 1200×630 PNG with gold spot, 24 h change and a 2-day line from /md/bars; og:image / twitter:image point at it (edge-cached 10 min).
- **OANDA-only markets**: XAG/USD, NAS100, US500, USD/JPY (pip 0.01) have no exchange fallback.
- **OANDA symbol map** (`api/_oanda.js` `LIST` → `SYM` page key → instrument, `DEC` display decimals, `GROUP`; 8 Nov 2026, so the breadth
  studies can test every market): `tf` also takes OANDA's `D` and `W` (weekly, Monday-aligned). All keys lowercase, same rate limit / caching / candle
  shape; `tests/oanda-symbols.test.mjs` checks the map. Metals `xau xag xpt xpd xcu xaueur xaugbp xauxag`; indices `nas100 spx500 us30 us2000
  de40 (DE30_EUR) uk100 eu50 fr40 ch20 nl25 es35 (ESPIX_EUR) jp225 au200 hk33 cn50 sg30 in50`; energies `bco wtico natgas`; bonds (CFD price)
  `usb02y usb05y usb10y usb30y de10yb uk10yb`; ags `corn wheat soybn sugar`; forex majors `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf`,
  crosses `eurgbp eurjpy eurchf euraud eurcad eurnzd gbpjpy gbpchf gbpaud gbpcad gbpnzd audjpy audnzd audcad audchf nzdjpy nzdcad nzdchf cadjpy
  cadchf chfjpy`, exotics `usdmxn usdzar usdsek usdnok usdsgd usdhkd usdcnh usdtry usdpln`. A key OANDA's practice API does not serve answers
  502 "OANDA 400 …" (never add a market to a trading rule without the owner).
- **Daily candle cache for research** (`.github/workflows/daily-cache.yml`, Saturdays 03:17 UTC + dispatch, free; `scripts/daily-cache.mjs`
  through the keyless proxy): council-data `research/daily/<key>.json` = `{ sym, inst, tf: "D", src, updated, cols: [t,o,h,l,c,v], rows: [[unixSec,
  o, h, l, c, volume], …] }` (complete UTC daily candles, full OANDA history, ~50 bytes a day) for every mapped key, and `research/daily/_index.json`
  (rows / first / last / status per key; a market the proxy or OANDA rejects is `status: "error"`, the rest is saved). Studies read
  `/cdata/research/daily/<key>.json` instead of calling OANDA; a re-run refetches only the last week and merges by time.
- **Price alerts (Web Push)**: dialog `#ms-pa` (chart bell, Settings → Price alerts, Ctrl K). Device list in localStorage `ms-pa` + Blob `push/<device>/…` via `api/push.js` (with the push subscription). `api/alert-cron.js` runs every minute: OANDA S5 candles since each alert was set, web-push (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env), removes fired alerts and dead subscriptions. `sw.js` shows the notification (it no longer caches data/API calls). `app.webmanifest` makes the dashboard installable (needed for iPhone push).
- **Users: Vercel Blob** (private store `meridian-users`, store_9ViGtEotT2PeSlXc, env `BLOB_READ_WRITE_TOKEN`): `api/users.js` GET (owner session: every member + the built-ins' public records; a member: their own record; guests 401; never a hash; falls back to council-data users.json read on the server if the store is empty); POST saves the whole list for the owner's session (or `ownerPw`): records go up without hashes and keep the stored / built-in one, `pw` sets a new password (hashed on the server, refused if another account or the owner uses it). Each save is a new `users/<time>-<rand>.json`, older ones deleted. Account changes need the Vercel site (no GitHub-token path any more). `package.json` holds only the functions' dependencies: `@vercel/blob`, `@vercel/og`, `web-push` (pinned versions).
- **`/api/status`**: notice + age of each bot's last round; the dashboard shows "Council bot behind" / "ICT tracker behind" to signed-in users (council > 20 min; ICT > 45 min outside the weekend).
- **Web Analytics** (custom events: View {view}, Sign in {result}, Guest, Trade review) and **Speed Insights**, loaded from /_vercel/* only on the Vercel site. Fluid compute, skew protection (12 h) and preview-only deployment protection are on.

## Macro strategist (7 Nov 2026, owner: a council member for macro, paper only)
(17 Nov 2026: the Desk's Council → Macro pane described below was removed; the Macro desk page is `macro-desk.html`.)
`council/macro.mjs`, run by council.yml every 6th round (~70 min; "~25 min" when rounds were shorter; `timeout 180`, a failure never stops the loop). Mixes the
15-driver stack of `gold-trading.html` (`computeDailyBias`, `dollarSmileRegime`, `refreshFundamentalsX`, ported, not imported)
with the handbook knowledge encoded there, a VIX/VIX3M term-structure input, and net liquidity / the FOMC calendar as context.
Free keyless sources only, each with a timeout and a fallback: FRED fredgraph.csv (4 at a time, a circuit breaker after 4 failures;
Cboe CSV for VIX/VIX3M and the US Treasury daily par / real curve CSVs for DGS2, DGS10, T10Y3M, DFII10, T10YIE), ECB data API (EA 2Y),
Forex Factory calendar JSON (faireconomy; ~2 pulls per 5 min, so the last good copy is cached), Fed / ECB / BoJ RSS, CFTC COT,
prices from `/md/bars` (OANDA; Kraken fallback). Writes council-data `macro/forecast.json` (next-day P(up) for gold, EUR/USD
(DXY = its mirror), USD/JPY, NQ, ES with drivers and a regime label; a 1-5 day event playbook with consensus, previous, hot /
in-line / cool scenarios per asset and expected moves; a plain-language `brief`; the scorecard), `macro/history.json` (append-only
log, one entry per asset and day, written at the first run from 21:00 UTC before the day opens, resolved on the UTC-day close),
`macro/events.json` (consensus / actual log for ±1 SD surprise cut-offs) and `macro/cache.json`, plus the `<!-- macro:start -->`
block in `analysis/latest.md`. Honesty rules from the deep-research report: P(up) = σ(logit(base up-rate) + b·score), b fitted
walk-forward on earlier days only, shrunk, never negative, capped 0.35-0.65; FRED values only after their publication lag (`LAG`);
scorecard = hit rate vs base rate, Brier vs coin flip and base rate, calibration, Pesaran-Timmermann, typical-move error vs the
naive 20-day average; a driver is "proven" only with a replay t ≥ 3, and weights are never auto-tuned. It changes no rule or
trade. Page: the **Macro desk**, Council pane `#council/macro` (`#ms-cp-macro`, admin; tab `#ms-cn-macro`, home quick link; replaced the old
research-pane card `#ms-c-macro`, 7 Nov). Self-contained `<style id="ms-md-css">` + `<script id="ms-md-js">` reading `/cdata/macro/forecast.json`,
`events.json` and `history.json`: header (freshness, Paper only, No direction edge, regime tags), Next day (expected move ± and price range per
market, recent vol vs 1-year norm, model used and why with MAE-vs-naive bars on the hold-out half, drivers with replay hit / t, P(up) shown
dimmed as context), Calendar (coming up from the playbook with hot / in-line / cool scenarios, recent releases, central-bank wire), Regime
(Dollar Smile diagram with the current phase, phase tabs, VIX scale, liquidity, real yield, DXY, rate gap, curve, funding), Track record
(direction hit vs base rate with the 95% luck band, event-day vs ordinary move size, live log). UI state in localStorage `msMacroDesk`.
Display only: the smile lean per phase mirrors `SMILE_MAP` (keep in step). Tests: `tests/macro.test.mjs`, `tests/macro-desk.test.mjs`
(page wiring + every field the desk reads exists in `buildForecast` output).

## This week report (8 Nov 2026)
Council pane `#council/week` (`#ms-cp-week`, admin; tab `#ms-cn-week`, home quick link; `#council/week/YYYY-MM-DD` opens that week). Self-contained
`<style id="ms-wk-css">` + `<script id="ms-wk-js">`; pure functions on `window.MS_WEEK`. UI only, reads council-data and changes nothing:
weeks are Monday-Sunday UTC with previous / next buttons (back to the first closed trade; Meridian's record starts 1 Nov, older weeks show the
ICT desk replay). Tiles: Meridian live net, ICT A-setups net, shadow book net, rule changes. P&L by system after costs (diverging bars, Live /
Shadow / Research tabs; live = council/alerts.mjs `alertable`, costs = `merNet` / `ictNet` of council/digest.mjs, research.json has no cost and
shows gross; ICT replay copies of forward signals are dropped), best / worst three trades with the post-mortem note, config.json history this
week by you / Coach / fixes (Coach entries joined to the coach.json ledger for before-stats and the 30-day check), and "now" cards: decisions
waiting (Coach proposals, live systems the decay monitor calls decaying, flagged ICT filters, robustness changes on a live system, data
feeds, what the Coach would pause), open live positions with floating R, edge decay and robustness verdicts, each with "Changes this week" read
from the shared verdict record digest.json `changes` (`changeLog` / `robustWeek` / `decayWeek`; the current week also diffs the live file against
the record's last snapshot; a week before `since` says it was not tracked). Only while digest.json does not exist yet does the robustness card fall
back to the verdicts this browser last saw (localStorage `msWeekRobust`). UI state in localStorage `msWeekRpt`. Bar colours `--wk-up` /
`--wk-dn` were checked with the dataviz validator per theme. Tests: `tests/week-report.test.mjs` (wiring, and every field the report reads
exists in what trader / fills / coach ledger / decay / robustness / digest / macro write).

## Trader paper fills (8 Nov 2026)
`council/fills.mjs` (pure, tested in `tests/trader-*.test.mjs`): every closed trade in trades.json keeps its raw `R` and gets
`costR` (round-trip cost in R per unit) and `Rnet` (= R − costR × size). Cost = the Backtest's `costOf` (moved here; spread + Kraken
fees on crypto) + half a spread of slippage per market order (market entry, stop / time / at-market exit; none for a limit entry or a
target exit). Spread from the broker when `ctrader/symbols.json` has `{ symbols: { XAUUSD: { spread } } }`; entry slippage from the
demo mirror's fills (ctrader/mirror.json, fill − council entry) once a market has 5. `snapshot.costs` sums gross vs net by book and
group. Stale-signal guard (shadow stat only): `drift` = fill vs the signal's price in R; `snapshot.staleGuard` splits fills beyond
0.25R (chased / better) from the rest. Trade state: a stop gapped through fills at the candle's open (`gapR`, `exitPx`), a limit
fill + target in one candle (opened outside the entry, stop not hit) is `missed`, candles while spot is shut (Fri 17:00 – Sun 17:00 NY)
are ignored for gold / forex, holes before the oldest candle are logged as `dataGap`. Entry rules and filters are untouched.
The daily replay (`council/backtest.mjs`) manages its trades with the same rules, shared from fills.mjs (`replayBar` /
`manageVariant`, tests/backtest-fills.test.mjs incl. a parity check against the Trader's order of checks): every exit variant's stop
(first, break-even, the pt1 trail) fills at a gapped open, fill + target in one candle is an unfilled 0R row, shut-spot candles are
skipped; `markets[m].gapStops / gapR / fillTarget` count them. Effect on a pinned 90-day OANDA replay (8 Aug – 7 Nov 2026, gold + 5
forex): 249 of 9,230 rows changed, R_none −131 → −182R; most gap R is the forex 17:00 NY rollover candle, then weekend reopens.
Shadow audit (8 Nov, `research/edge/shadow-audit`): the shadow book's −300R week was costs, not trading (+92.6R gross; 300R of Kraken fees on
139 crypto scalps). One repair: `council/repairs.mjs` `voidM30Twins` gives the 29 pre-dedupe m30m1 copies of Scalp entries status
`duplicate` (`dupOf`, `void`; no tally counts that status). Near-stop market fills (the engine's stop floor is checked on the planned entry,
not the fill): done 12 Nov 2026, section "Near-stop market fills". Crypto venue, owner's decision 7 Nov: the council trades through cTrader (CFD), so crypto
paper trades pay the costs study's CFD round trip (0.04% of price, `CFD_CRYPTO` in `council/fills.mjs`) instead of Kraken spot fees.
Gold fidelity (8 Nov, research/edge/gold-fidelity): (11 Nov 2026: the cost also carries overnight financing on gold longs, `FIN` / `financing`, section "Supported book, financing".) `manageLive` / `addUnit` / `expireOrder` / `sizeR` in fills.mjs are the Trader's
"Manage open trades" step for one candle as pure functions (trail, beAt, maxHold, pyramid add included), used by that replay;
`tests/fills-live.test.mjs` lifts the Trader's loop text out of trader.mjs and checks parity, so a change to the live loop must be
mirrored there. A pyramid add inherits its parent's `shadow` flag (a blocked Mosha chain's add is not a live trade).
**Moved-stop audit (12 Nov 2026, after item 50; `research/proposals/2026-11-12-moved-stop-audit.md`, item 51).** 1R is the risk a
trade OPENED with, never `|entry - stop|` once a trail, break-even or ratchet has moved the stop. Every Trader loop (the NQ
open run's too since item 50 was applied) reads a stamped `r0`: pushed with the record for every system whose stop moves (also outside the loop: the
gold trend and crypto ratchets, the LIT swing break-even), stamped on the first managed candle otherwise (`tr.r0 || (tr.r0 =
...)` before any move); a test lists every `.stop = ` in trader.mjs, so a new stop move must be audited. Readers use
`fills.mjs` `openRisk(x)` (`r0`; else `|entry - stop|` while unmoved; else `stop0`; else the NQ open run's 2R mark / 2; else
null = leave the figure out): the mirror's `fillQuality` (imported as `riskAtOpen`: the round has a local `openRisk` = cash),
the reconciliation report, the digest's floating R; copies in `api/_edge-analyst.js` (`stopAtEntry`; an unknown opening stop is
not studied) and the page (`risk0`: Active trades, the trade table's live R, the guest trade card, "R now"), compared by
`tests/moved-stop-audit.test.mjs`. On the replica `stop0` is the level BEFORE the round-number step, not the opening stop.
Item 51, **applied 18 Nov 2026** (owner: "do all"): a trade whose stop already sits past its entry is never copied as a market
order (its relative stop would land on the losing side of the fill; ICT A-setups copied late were the case), and the late-copy
check reads 1R from the opening risk (`riskAtOpen(t) || |entry - stop|`). Tests: the two "item 51" tests in `tests/ctrader-mirror.test.mjs`.

## Forex spreads: a raw-spread account, measured (12 Nov 2026, owner approved the cost-measurement fix)
council-data `ctrader/symbols.json` showed `spread: 0` on EUR/USD, GBP/USD, AUD/USD (and at times USD/CAD, USD/CHF), so
`council/fills.mjs` charged its assumed 1-pip default. **Cause: not a decoding bug.** The demo (Fusion Markets) is a raw-spread
account: its majors are quoted bid = ask on 93-99 % of the reads of 8-12 Nov outside the rollover (GBP/USD 83-89 %), and wide
only at the 17:00 New York rollover (USD/CAD and USD/CHF exactly 2.0 pips there, which the file then showed). The cost is a
commission: `commissionType` 1 = USD per million USD of notional, a side, 22.5 on forex and 12 on gold (`preciseTradingCommissionRate`
/ 1e8), matching the demo's own deals (0.07 lot EUR/USD paid 0.34 a round trip). The mirror's demo fills of every account
confirm it: forex fills sit 0.0-0.1 pip from the council's (OANDA mid) entry, median 0 (n 61-81 a pair).
- `council/ctrader-symbols.mjs` `spreadFields`: `spread` is only ever POSITIVE: measured this run (`spreadSrc 'measured'`), else
  the last positive one kept up to `SPREAD_KEEP_DAYS` 7 with its own `spreadAt` (`'kept'`), else null (`'default'`); an old file's
  0 is never carried. `quoteSpread` / `quoteSpreadAt` = this run's ask - bid as quoted (0 allowed). `spreadLog` = the last 300
  fresh reads (14 days, zeros included) and `spreadTypical { n, median, mean, zeroShare, from, to }` over reads outside 21:00-22:59
  UTC (`rolloverHour`). `commissionRT` = round trip as a fraction of the price (type 1 only; 0 where none; null for another type).
- `council/fills.mjs` `costModel`: quoted spread = `spreadTypical.median` once `MIN_QUOTES` 20 reads exist (a median of 0 only
  when the commission is known), else a positive broker spread, else the default; **a 0 from anywhere else is missing**
  (`tradeCost` too). The commission (`commissionRT x entry`) is charged on top. Slippage stays half a spread, of the DEFAULT
  spread when the quoted one is 0 (assumed, not measured: no exit-slippage evidence is read yet). Entry slippage reads every
  demo account's fills (`mirrorMaps`: mirror.json + the files in `mirror-accounts.json`; before, the council account only, which
  holds no forex). `src` / a trade's `costSrc` name the basis: `quotes | broker | default`, then `+commission`, `+mirror`.
- **Effect** (report only; `costR` is stamped once at the close and no stored trade was recosted): the shadow book's forex trades
  closed 9-12 Nov (265, +41.26R gross) carry 65.10R of stamped cost; the measured model gives 33.85R (0.246R → 0.128R a trade, a
  5-pip scalp pays about 0.6 pip instead of 2), so net −23.8R would read about +7.4R. Gold moves little (live: 3 trades 0.09R →
  0.02R; shadow 1.59R → 1.42R: median spread $0.06 + $0.09 commission instead of the last single read).
- Left as it was, on purpose: the mirror's stop-inside-the-spread guard reads `spread` (now the last positive, often the nightly
  rollover read: more conservative, never a looser stop); the page's broker table shows "—" for a null spread. After deploy the
  quote median needs about 20 rounds (~4 h) before it is used; until then a kept rollover spread or the default applies.
- Tests: `tests/forex-spread.test.mjs` (5, on `tests/fixtures/ctrader/symbols-raw-12nov.json`: the real 12 Nov file and every
  distinct quote of 8-12 Nov), `tests/ctrader-symbols.test.mjs` (bid = ask, kept, 7-day limit, commission). The pinned
  `tests/fixtures/ctrader/symbols.json` is unchanged.
- **Yen watch list (14 Nov 2026; merged 19 Nov 2026 by the owner's "Merge all", docs/owner-decisions.md item 60):** `WATCH` (USDJPY, GBPJPY, AUDJPY, CADJPY, CHFJPY)
  read only into `symbols.json` `watch` (never `symbols` / `markets`: the mirror, cost model and data health never see them),
  with tick-history spreads around 00:55 / 06:00 UTC (`windows`); `council/yen-spread.mjs` splits them gotobi / other. Not wired
  into any rule, page or alert. Tests: `tests/ctrader-symbols.test.mjs` ("watch list"), `tests/yen-spread.test.mjs`.

## Near-stop market fills (12 Nov 2026, owner approved: docs/owner-decisions.md item 53, fix 2 of the week review)
The engine (`buildSetup` / `buildRetrace`) widens every planned stop to the minimum stop `max(CFG.minRisk x ATR(14) of the
lower timeframe, 5 spreads)` from the PLANNED entry; a READY setup the Trader takes at market (price through the entry, or
`config.entry[k] === 'market'`) used to fill at the price of the moment whatever its distance to the stop (9-12 Nov: 7 fills
within half the planned risk, an AUD/USD buy 0.4 pip above its stop booked about -6R after costs).
- `council/fills.mjs`: `atrN` (= engine `atr` = review `atrOf`), `minStopDist(bars, spread, minRisk)` (the engine's floor),
  `fillCheck(side, px, stop, t1, floor)` -> `'past-stop'` / `'past-target'` / `NEAR_STOP` (`'fill-near-stop'`, distance under
  the floor; a fill exactly at the floor opens) / null, `fillCheckText`.
- Trader, "Take new Ready setups", the `if (mkt)` step: the floor from `src[def.l].bars`, `spreadOf(M, price)`, `CFG.minRisk`
  (the same inputs the engine used a moment before). A refused fill is pushed as `status: 'skipped'`, `reason`, `fillPx` (the
  price it would have filled at), `minStop`, `closed: now`, `R: 0`, the planned entry and the stop untouched, NO `filled`,
  `r0` or `drift` (a past-stop / past-target skip is now the same; before, it carried the fill time and price). An opened fill
  now stamps `r0` (the opening risk) at once. `state.seen` already holds the signal, so it is not taken again.
- Replay (`council/backtest.mjs`): the market fill at the signal and the `@mkt` twin use the same `fillCheck` (refused = no row).
- Never a trade: tallies count win / loss / be only (`DONE` in fills / digest / decay / book, the page's `done`), `forward.mjs`
  leaves `skipped` out of the book, the mirror copies only open / pending, the edge analyst and the Desk's chart markers skip
  it; the page shows it as "Skipped". `fidelity.mjs` names the reason.
- Before the change (council-data of 12 Nov, `minRisk` as it stood at each trade from config history, ATR from `ctx.atr`):
  65 of 332 recorded engine market fills inside the floor (2 live, 2-3 Nov; the rest shadow), +10.2R before costs, -28.9R
  after; since 9 Nov 33, +1.7R / -18.6R. Stored trades were not rewritten.
- Tests: `tests/near-stop-fill.test.mjs` (lifts the Trader's market-fill block as text and runs it; the engine's floor
  formula is pinned there, so a change to it must change `minStopDist` too).
## One order, recorded once (12 Nov 2026, owner approved: "count duplicates once")
Plumbing only: no entry rule, filter, size, stop, exit or pinned block changed. Two setup keys built on shared structure can
give the SAME order in one round; it was recorded and counted twice. `council/dedupe.mjs` (pure) defines an **exact duplicate**:
equal market, side, `opened` second, entry, stop AND target `t1` (prices within `DUP_TOL` 1e-9 of the entry, float noise only;
neither a pyramid add). Every price the Trader manages by is equal, so the R is equal by construction. Only difference left: a
resting limit's life (`WAIT` by timeframe, Scalp 3 h vs Intraday 12 h); the kept record's applies (no pending twin of 1-12 Nov
filled after 3 h).
- **Trader**: `recordOnce(trades, tr, now)` right before the setup loop's `trades.push(tr)`: the twin becomes status
  `'duplicate'`, `dupOf`, `void`, `voidWhy`, `shadow: true` + blocker `duplicate`, `R: null`, closed at once (never managed,
  alerted, copied or counted). **The live record is kept over a shadow** (an earlier shadow of this round becomes the
  duplicate), else the first. Every tally reads `win/loss/be` only (digest, `alertable`-based books, fills costs, book, decay,
  forward, page `sysClosed`), so the status drops it; `forward.mjs` `DONE` and `api/_edge-analyst.js` already skip it.
- **Repair** `council/repairs.mjs` `voidExactTwins` (key `void-exact-twins-2026-11-12`, once, marks, never deletes; R kept;
  an open / pending duplicate closed at the repair's time): on council-data of 12 Nov **5 records**, all Scalp copies of an
  Intraday order (audusd 1 Nov live +2.11R, audusd 3 Nov -1R, usdcad 9 Nov -1R, gbpusd 12 Nov +1.65R, audusd 12 Nov open):
  +1.76R gross / +1.19R after costs counted twice; 1 of them live (legacy engine, 1 Nov).
- **Mirror** (`ctrader-mirror.mjs` `fresh`): `dropTwins` drops a duplicate record, a trade whose twin is already copied on
  any account (`st.map`, `st.orders`, `exclude`), and the second twin of a round. Test fixtures in
  `tests/ctrader-mirror.test.mjs` give trades of another id another second (`secOf`).
- **Not duplicates, left as two trades** (rule questions for the owner, reported 12 Nov): the same entry, stop and second
  with ANOTHER target (6 pairs on 1-12 Nov: Position vs Swing / Retrace swing, Intraday vs Retrace scalp, Retrace intraday vs
  Retrace scalp; BTC 4 Nov Position -1R vs Retrace +0.43R), and same market + side within 15 minutes (109 pairs of records
  opened 9-12 Nov: 53 the same setup re-firing, 50 another setup with other levels, 3 exact, 3 other target; 1 involves a live
  record). Never fold those into `sameOrder`.
- Tests: `tests/dedupe.test.mjs` (7), `tests/ctrader-mirror.test.mjs` (one round test).

## Edge scoreboard (7 Nov 2026, owner: "where is the edge across both systems, at a glance")
Admin card `#ms-sb` at the top of the Council research pane (deep link `#council/scoreboard`, Home quick link). Script `#ms-sb-js` at the
end of `market-structure.html`; pure functions on `window.MS_SB`, tested in `tests/scoreboard.test.mjs`. One row per stream: Meridian
setups (forward live / shadow from trades.json, 30-day replay from backtest.json under each setup's current rule, net of spread, and the
system replays in research/replay-2w.json), ICT A-rule (ict/replay.json A-setups + forward ict/trades.json), ICT variants and dip-buy
(shadowByVariant / shadow / totalsByVariant + ict/shadow.json), the cTrader demo mirror (mirror.json: council R less fill slippage,
execution summary in the curve panel). Optional files read when present: research/robustness.json (any object with a robust / fragile /
not-proven `verdict`, matched to rows by name) and macro/forecast.json (the gold direction scorecard, live log at 20+ days else replay,
hit +1R / miss −1R, t = z against the base rate → a "Macro forecast" row). Columns: n, win %,
R/trade, total R, max DD, t, halves, last 30 days, status (live / paper / shadow / watch / failed), verdict (Edge / Promising / Unclear /
Losing / Too few, text + colour) and the owner approval (Coach proposals, linking to `#ms-sleeve`). Sorted by t; thin shadow streams
hidden behind a checkbox. The main script hands its data over with `window.MS_COUNCIL` + the `ms:council` event (no second download).
**A verdict that rests on a backtest says so** (11 Nov 2026, owner's rule: never an edge without n, t and what it was measured on).
Every row carries `fwd` = how many of its trades are forward (live or paper) trades: all of a forward row, none of a 30-day or system
replay row, the forward part of an ICT row, the demo fills of the mirror, the live-log days of the macro row (unknown = not set, left
alone). `MS_SB.shown(r)` gives what the chip SAYS: an Edge or Promising with `fwd` under `FWD_MIN` 20 reads "Edge (backtest only)" /
"Promising (backtest only)" (dashed chip, no fill, no row tint; `r.vShow`, `r.vBt`, `r.vTip` = the counts and "A backtest is not a
forward record", shown as the chip's tooltip and as a line in the opened row, since a tooltip does not open on touch; a Meridian replay
row also names the same setup's forward count, `fwdSame`). The summary line counts them ("11 edge (all backtest only)", the state on
11 Nov) and the legend explains it. **`r.v` is the machine verdict and never changes**: the digest's movers (`verdictMap`), the sort,
the row class and the week pane read it; a test compares a baseline saved before the change with today's rows (no movers). Never put
display wording into `r.v`. Tests: `tests/scoreboard.test.mjs` ("backtest only").

## Reliability: tests and data health (7 Nov 2026)
- **CI** `.github/workflows/tests.yml` (every PR and push to main, Node 22, no npm install, no secrets, no network): `node --check` on
  council/ict/api, `node --test tests/*.test.mjs tests/*.test.js` (incl. `tests/page-scripts.test.mjs`: every inline script of the
  pages must parse), `node ict/audit-test.mjs` and `node council/alerts-test.mjs` on pinned council-data copies in `tests/fixtures/`
  (refresh them only on purpose: the checks name real trades of that week), `node council/proposals-test.mjs`. Keep new tests offline.
- **Site CI** `.github/workflows/ci.yml` (9 Nov, same triggers, ~2-3 min): job `build` fails if `sh scripts/build.sh` changes `out/`, so
  commit the rebuilt `out/` with every page / study change (the build is deterministic: edge `generated` and veteran `builtAt` keep the
  old stamp when nothing else changed). Job `pages` (Playwright headless shell, cached): `scripts/audit/smoke.cjs` opens every page
  (phone owner / phone signed out / 1366 desktop) and fails on a page error or sideways scroll at 390 px (`/api/me` stubbed, other
  `/api/*` 404, `/cdata` from the public council-data branch, other third-party hosts cut), then the ChronosTrade audit (exits 1 on any
  FAIL; retried once since it reads live `/md/bars`). Locally: serve out/ on `PORT` and run either script with `node --use-env-proxy`.
- **Data health** `council/datacheck.mjs` (council loop, every 2nd round, ~23 min): 5m candles from the OANDA proxy, Kraken (crypto) and the ICT
  desk's CNBC futures → council-data `health.json` (per market: stale in open-market minutes, gaps, zero/negative prices, broken candles,
  jumps > `CFG.jumpAtr` 25x the 50-candle ATR). Weekend, the 17:00-18:00 New York halt and CME US holidays are closed, never errors. One
  phone alert per bad episode through `alerts.mjs` `sendAlerts` (bad on 2 checks in a row; new markets at most every 30 min; 12 h
  reminder; one all-clear); state in `health.json` `alert`. Shown as the admin **Data chip** in the Council status line (`dataChip`,
  `.c-dh`, tap for the per-market list). Tests: `tests/datacheck.test.mjs` (fake fetch).
- **Crypto replay feed** (8 Nov): the replay (`backtest.mjs`) reads a coin from Kraken (the live feed) only once its per-day trade
  cache covers the whole window, else the whole market from Binance (`markets.source`, `markets.feeds`, `markets.krakenCoverage`,
  `markets.fallback`; never a mix). `kraken-backfill.yml` (`council/krakenfill.mjs`, every 30 min, 25-min box) fills that cache:
  BTC is ~175 Kraken calls a day (~5,600 for 30 days at ~1 call/s). Both workflows save the `duka-*` cache even when cancelled
  and merge the newest saved copy first. Tests: `tests/kraken-backfill.test.mjs` (fake Kraken + Binance).

## Loop watchdog (8 Nov 2026, reliability: the council's own health alert)
`council/health.mjs` (pure `problems()` + `decide()`, file `main()`) reads council-data snapshot.json / health.json / trades.json /
ict/snapshot.json and reports: loop stopped (snapshot `at` > 20 min, "expected ≤ 10"), a failed council.yml run, ICT desk stopped (> 45 min,
not in the futures weekend), open trades on an open market not re-checked for 60 min, the data check missing 90 min, the same
`snapshot.errors` key on 3 consecutive observed rounds, a feed health.json calls stale 30+ min (datacheck alerts first; this escalates).
ONE phone alert per state change (new problem / "Council back" / "still n problems"), a reminder every 12 h, marked in council-data
`watchdog.json` `healthSent` like coach.json decaySent; every channel failing keeps the old mark. Run only by
`.github/workflows/watchdog.yml` (cron :11/:41, every completed Council trader run except pending-push cancels, manual), never from the
loop it watches; it trades nothing and restarts nothing (council.yml's cron job does). GitHub fires the :11/:41 cron only a few times a day;
a Vercel-cron trigger is an open owner decision (docs/owner-decisions.md, item 15). Watchdog review of 6-8 Nov: 489 saves in 48 h
(one per 5.9 min), two outages (80 min: 330-min timeout; 262 min: a push cancelled the loop and GitHub fired the cron only twice that
day), zero data-branch push rejections in the logs read; the loop now aborts a stuck rebase and retries the hand-over dispatch.
Tests: `tests/health.test.mjs`.

## Council data files health (9 Nov 2026, reliability: no silently broken feed)
`council/datahealth.mjs` (pure, injected reader + clock; `node council/datahealth.mjs <dir>` prints the report) holds the inventory
`FILES` of every council-data file the site and council read, with its writer, cadence and per-file thresholds: wall clock for the
24/7 loop files, open CME minutes for the ICT desk (`openSecs('cme')`), US business days (bond holidays too) for FRED inputs and
reviews, the CFTC Tuesday/Friday week for COT, the digest's send days (`digestDue`) and the macro log's target days (`historyDue`).
Content checks: parse / missing, sanity bands (`PX` prices, `LV` VIX / yields / curve / DXY / P(up) cap / scores), cross-file checks
(spot gold vs the GC future, the Trader vs mt5/signals.csv, config `btAt` vs backtest.json, veteran vs strategist, trade levels).
`datacheck.mjs` runs it in a council-data checkout (skips health.json itself) and stores it in health.json as the pseudo-feed
`feeds.files` (label "Council data files", per file `{ label, status, ageMin, issues }`) plus `brief` (`{ status, line, bad, warn,
notes }` across candles and files); `status` / `summary` include it, so the admin Data chip, week pane and digest show it with no
page change (a dedicated desk tile would read `health.brief`). Severities: bad pages through datacheck's alert ("Council data
problem: n files", 2 checks in a row, 12 h reminder) unless the issue is `quiet` (staleness the watchdog already pages: snapshot,
state, mt5 csv, ICT, health.json); warn shows; note is a standing gap listed only. The loop's data check flags a watchdog.json older
than 3 h (pages at 12 h), so loop and watchdog watch each other. Thresholds are monitoring only, never trading rules. Tests:
`tests/datahealth.test.mjs`.
**20 Nov 2026**: an open trade whose stop has moved past its entry (break-even, trail) is judged against the risk it opened with
(`r0`): a stop further from the entry than `r0` is flagged ("further from the entry than the opening risk", rule 1); the plain
"stop not over / under the entry" check stays for pending orders and trades without `r0` (it flagged a Mosha BO shadow sell whose
trail had locked profit).

## council-data sync and safe writes (9 Nov 2026, reliability audit)
Every pull / save of council-data in council.yml (round, quick pass, account minute) and watchdog.yml goes through
`node council/datasync.mjs data pull` / `save "<msg>" [paths]`: uncommitted files ride along (autostash), a half-done rebase or
merge is cleared first, a conflicting file keeps the council-data copy (the loop rebuilds its own next round), a JSON file that
does not parse is never committed (last good copy restored), push with three tries. The run logs of 8-9 Nov showed the plain
pull refused every minute ("unstaged changes": accounts.json was never committed by the minute step). Members run under
`timeout` write with `council/jsonio.mjs` `writeAtomic` (temp + rename); macro.mjs never overwrites an append-only log that
does not parse (sources `file:<name>`), keeps a failed calendar week from its cache (`mergeCalendar`), extends the weekly
daily-candle cache with the run's closed OANDA days for the DXY / gold; the Gold Macro Score flags an input older than 10 days
(`stale`) and is withheld past 28. `injectSection` drops a lone block marker. Tests: `tests/datasync.test.mjs` (local git
repos), `tests/jsonio.test.mjs`, `tests/macro-reliability.test.mjs`, `tests/macroscore-stale.test.mjs`, `tests/analyst-report.test.mjs`.

## Book weights, paper comparison (8 Nov 2026; portfolio-v2 proposal, owner undecided) (removed 17 Nov 2026)
The card is gone (section "Simplified pages"); council/book.mjs and the digest line stay.
`council/book.mjs` (pure; tests `tests/book.test.mjs`): from the forward paper records (trades.json live + NQ open-run paper via
`alertable`, after costs; ICT A-setups from ict/trades.json with ict/replay.json filling the days the forward tracker has no record
of, replay copies dropped by id) it computes, day by day since `BK.from` (4 Nov, the legacy engine's retirement), the R of (a) the
live book as traded and (b) the SAME trades with the proposal's multipliers: equal risk per distinct idea (`IDEAS`: replica,
mosha-bo, gtrend = N20 + N5, gtl, geg, gmp, nq-open, ict-a), the gold family (`gold: true`; the replica is outside it, corr 0.07
in the study) capped at 40% and the rest renormalised, scaled to the live book's budget (one unit per live stream, M = 9R) so
only the spread differs. Trades of a setup outside `IDEAS` stay at live size (`other`). Running totals, drawdown, daily
correlation, Sharpe from 20 trading days, and the clean-half expectation (Sharpe 0.3, drawdown 9-21R per 1R of budget) in
`sizing`. The Trader writes it to coach.json `book` every 6 hours (next to `decay`; the daily Coach write carries it over); the
Council research pane card `#ms-book` (`<style id="ms-book-css">` + `<script id="ms-book-js">`, two-line running-R chart +
table per idea, colours validated per theme) shows it labelled "Paper comparison · no live change"; the Sunday digest adds one
line (`bookLine`). PAPER ONLY: it changes no rule, size, filter, trade or mirror setting; the owner decides.

## What to expect (8 Nov 2026, owner: what each live system should do, and when a forward record can be judged)
`council/expect.mjs` (pure) + `council/expect-base.json` (built by `research/edge/expectations/build.mjs` from the untouched-data studies'
own per-position records: gold-systems-oos 2006-17, nq-open-oos 2004-22, replica-oos 2017-22, ict-oos-2008, mosha-oos 2006-17, the
robustness rebuild for the momentum pullback, crypto-trend-decay). The Trader writes coach.json `expect` with the decay block every 6 h (`buildExpect(cj.decay)`;
kept through the daily Coach rewrite): per system R a trade with the 5–95% band of the estimate, what one year of trades can show, the
drawdown band (decay-base `mcDD` MC95 to the worst drawdown on untouched data), trades until t ≥ 2 at the honest edge and at the backtest
edge (cap 2 years; > 50 years = "cannot be proven"), the regime note, and the forward record (decay `fwd`) placed against its band from
10 trades (`out`: above / below). Card `#ms-expect` (research pane, next to `#ms-decay`; `<style id="ms-ex-css">` + `<script id="ms-ex-js">`,
phone blocks under 760 px); the daily digest (`expectLine` in `waiting()`) names a live system only when it leaves its band. Expectations
only: never a rule, size or filter. Tests: `tests/expect.test.mjs` (maths against each study's result.json, digest, trader and page wiring).
Since 11 Nov 2026 every gold buy in these figures is after overnight financing (the four long-only gold systems, and the buys of the replica, Mosha BO and the momentum pullback) and five systems are marked shadow (sections "Supported book, financing" and "Financing, the rest").
**Every unit of the trend legs (12 Nov 2026, item 42 approved):** Gold trend and Gold trend fast come from the book study's unit
records (`research/edge/supported-book/legs.json`) through that study's own `positions()` (imported): net of $0.30 a unit and
financing on EVERY unit at its own entry and risk, and a window holds the positions CLOSED in it (`cut` by `day`, the study's
rule): gtrend +0.313R a position (n 74, t 1.20; was +0.398 / 75 / 1.49), gtrend5 +0.211R (n 128, t 1.17; was +0.289), equal to
`supported-book/result.json` `W1` `bySystem` (tested). Of gtrend's 0.085R drop about 0.040R is the add's financing and 0.045R the
close-day window (one Dec 2017 winner closed in 2018). expect-base `fin.everyUnit`, `units`; the line reads "a position after
financing on every unit"; the page's footnote and Per trade cell say so. geg (no add), gtl and the rest unchanged. **The decay
baselines were not changed**: their 2018-26 records (`decay-monitor/positions.json`, from the robustness rebuild whose bytes are
the Academy's) carry no add entry, so Gold trend / fast baselines still charge the first unit only (an understatement of the add's
share, roughly 0.03-0.04R a position judging by the 2006-17 figures).
Re-run the build after a study changes.

## Daily owner digest (8 Nov 2026, owner: one message instead of many alerts)
`council/digest.mjs`, run by council.yml every round (120 s cap, never fails the round); it sends ONE phone message per UTC day through
`alerts.mjs` `sendAlerts` (ntfy + Telegram, same env as the other alerts): from 21:15 UTC Mon-Fri (not on a CME full-closure holiday,
`datacheck.mjs` `usHolidays`) and a Sunday 21:15 UTC "Week ahead" preview covering the past 7 days. About 13 lines: closed paper R gross /
after costs for Meridian live (`alertable`: trades.json non-shadow + NQ open-run paper; `Rnet`) and the ICT desk's A-setups (cost = the
CME micro round trip, `ICT_COST_PTS` as in research/portfolio.mjs), the cTrader demo balance and day P&L (equity − ctrader/mirror.json
`state.day.startBalance`), open positions with floating R (snapshot.json / ict/snapshot.json prices), the macro regime and next-day
playbook headline (macro/forecast.json), what waits on the owner (actionable Coach proposals, health.json problems or a stale check,
research/robustness.json verdict changes) and edge scoreboard movers (the page's `MS_SB.build` run headless from market-structure.html,
compared with the last digest). Taps open `meridianx.dev/market-structure.html#council`. State in council-data `digest.json`
(`sent.day`, verdict baselines `sb` / `robust`, `last`): a restart never resends; if every channel fails nothing is marked and the next
round retries. `COUNCIL_ALERTS=off` sends and marks nothing; `--dry` prints, `--force` sends now. Tests: `tests/digest.test.mjs`.
**Shared verdict record** (8 Nov): digest.json is also written every round, in or out of the window (`recordVerdicts`): `robust`
(research/robustness.json claim id → verdict), `decay` (coach.json decay system id → status), `changes` (`[{ at, kind: 'robust' | 'decay',
id, name, from, to }]`, the last 200), `since`, `at`; the Trader calls the same function after each 6-hour decay rebuild. Written only when
something changed. The digest's "Robustness:" line is the log since the last send (`changesSince`, per id first → last, round trips drop out);
the week pane's robustness and edge-decay "Changes this week" read the log, so changes of past weeks are kept.

## Research ledger (8 Nov 2026, owner: ~20 pre-registered studies in two days, seen only through PR history)
`council/research-ledger.mjs`: one row per study in `research/edge/<topic>/` with a `result.json` or `RESULT.md` (the folders
`research/edge/build.mjs` publishes) → `{ topic, name, title, built, first, verdict, headline, systems, pr, cites, prereg, report, link }`.
`verdict` (pass / fail / inc) and `headline` are the Edge lab's own reading of the study (`research/edge/verdict.mjs` `studyVerdict`:
result.json `verdict`, else the RESULT.md "Verdict" line, else the candidates table; the ledger adds the opening sentence or a
"Numbers only" note where that leaves nothing), so ledger, digest, week pane and /edge-lab.html say the same thing; `systems` from
the topic / title (the result.json `system` line names data too), `cites` = the PRs the RESULT.md names, `pr` + `first` = the squash-merge
that landed it (git log where the checkout has history — a shallow clone's boundary commit is refused — else the GitHub commits API
once per new study, read only),
`built` = result.json `built` / `at` / `generated` or the report title's date. Written to council-data `research/ledger.json`
(`{ at, count, byVerdict, rows }`, newest first, only on a change) by council.yml every 3rd round and by `research-ledger.yml` on every
push to `research/edge/**`, so the site has it at `/cdata/research/ledger.json` the day a study lands. Readers: the daily digest
(`researchLines`: "New study: <name> — <headline>" on the day a study lands, a "Research this week" block in the Sunday preview, which
may run to 18 lines), the week pane's **Studies** card (`#ms-wk-studies`, `MS_WEEK.studies(ledger, from, to)`, each row a link to
`edge-lab.html#<topic>`), and `edge-lab.html`, where `#<topic>` opens that study's row (candidates unfold, scrolls under the sticky
bar, `.row.hit`; `hashchange` re-targets). Paper only; it reads the studies' words and changes nothing. Tests:
`tests/research-ledger.test.mjs` (a row for every committed study, the statement parser, digest lines, the ledger file, wiring).
`node council/research-ledger.mjs <dir> --dry` prints the rows.

## Macro veteran (8 Nov 2026; revision 1.2 the same evening, 1.3 on 9 Nov: see below)
Revision 1.2 (owner: "this is our updated veteran macro, insert on the system and deploy it on the website"): the whole batch
lives in `research/macro-veteran/` (SKILL.md, BATCH_INDEX.md, DATA_LICENSES.md, validation.json; `references/` = the batch's
`outputs/` without the two provenance ZIPs; `notes/` = its authored `work/*.md`; raw publisher captures, one-time scripts and
synthetic fixtures stay out, see README.md). `scripts/veteran-index.mjs` (in build.sh) publishes it at `/veteran/` with
`index.json` (version, groups, titles, `cpiPilot` from the real October 2026 core-CPI ledger, validation summary); the Macro
desk's fourth tab "Veteran library" (`loadLib`, `md()` renderer, `libOpen`) shows the CPI pilot card and every document.
`veteran.mjs` exports `SKILL_VERSION` and `cpiPilot()` (null in the Vercel bundle) into veteran.json. The batch's own 50
evaluator tests pass from the repository copy (`node --test references/scripts/*.test.mjs` in research/macro-veteran).
Tests: `tests/veteran-library.test.mjs`. vercel-ignore deploys on `research/macro-veteran` changes.
`council/veteran.mjs`: the owner's gptmacro_v.1 research skill as a council member (its SKILL.md and the four frameworks the port
uses are in `research/macro-veteran/`). Runs right after the Macro strategist (every 6th round, council.yml), reads only what the
strategist fetched (macro/forecast.json, macro/cache.json) plus the council's daily candles (research/daily/*.json), fetches nothing.
Writes macro/veteran.json, macro/veteran-ledger.json and its own `<!-- veteran:start/end -->` block in analysis/latest.md. Parts:
`fingerprint` (cross-asset regime framework §2: candidate shock from matched 1-week changes, competing explanation, gold test),
`channels` (gold driver map: one row per causal channel with observation, as-of, stale flag, lean and what it cannot establish),
`debate` (topic by topic: strategist vs veteran, stance agree / qualify / disagree, why; `verdict` keeps the tested Gold Macro
Score's direction, can only lower conviction, never a macro SELL; named invalidation levels; `hypothesisCard` §7), and the forecast
ledger (`ledgerIssue` one binary forecast a week, "gold's close 20 trading days on is above today's", probability in [0.4, 0.7]
from the base rate plus a bias tilt, the score rule as the named comparator; `ledgerResolve` scores Brier / log loss against base
and comparator; append-only). Page: Macro desk `#ms-md-vet` (`renderVet`, `macro/veteran.json`). Tests: `tests/veteran.test.mjs`.
The argument teaches (owner: "the veteran will argue with him to fortify his understanding and prediction"): `macro.mjs`
`CHALLENGERS` are the strategist's drivers read over the veteran's 4-week window (`v_ry4w` vs `ry`, `v_d2_4w` vs `dgs2`,
`v_dxy4w` vs `dxymom`); the replay tracks their hit rates with no weight; `lessons(prev, drvRe.gold, now)` adopts a challenger
proven on the replay (`LESSON`: t ≥ 3, n ≥ 30, ahead of the incumbent by 0.02 or the incumbent unproven) into `assetScore` (it
takes the incumbent's weights, the incumbent keeps half) and reverts it when it stops being proven; append-only records in
macro/lessons.json, exposed as `fc.learned`. The veteran keeps the argument's record: `debatesIssue` / `debatesResolve` /
`scoreboard` (per topic, who was right on gold's direction 20 trading days on; macro/veteran-debates.json) and `teaching(fc)`
(what the strategist has adopted, what is pending). Both show on the desk under the discussion.

## Council live runner (8 Nov 2026)
`council/live.mjs`: one always-on process (owner's VPS; `scripts/live/install-vps.sh`, `meridianx-live.service`; Windows files too)
that runs the Trader and the cTrader mirror every `LIVE_EVERY` s (30) against its own clone of council-data, pushes when a trading
file changes (`PUSH_FILES`) or every `LIVE_PUSH_EVERY` s, and writes the heartbeat `live.json`. council.yml `livefresh()` skips its
Trader, mirror and quick pass while the heartbeat is under `FRESH_SEC` (180 s) old, so there is one writer of trades.json; a stale
heartbeat hands the Trader back to the workflow. Secrets only in `~/meridianx/.env` (`scripts/live/env.example`, names only); the
GitHub token travels in a per-command header, never `.git/config`; child output is scrubbed (`scrubber`). With `OANDA_TOKEN` the
Trader reads candles from a local proxy (api/bars.js behind node:http, `serveHandler`) so the cadence costs no Vercel calls. Exit
code 3 = new council code on main: the wrapper pulls and restarts. Tests: `tests/live.test.mjs`.

## Council quick pass (8 Nov 2026)
council.yml: every minute of the 4-minute wait between rounds the Trader runs again and the mirror copies what it recorded
("Council quick pass" commit on council-data), so a setup reaches cTrader within about a minute (owner, 8 Nov: 2 minutes, then
every minute; a VPS live runner is the next step); the heavy members (Analyst,
Coach, Macro, veteran, data check, digest, ledger) keep the full round (~11-12 min since the pass was added; 5 min before). Owner: "ok build it, start at 2 minutes". If the
data-health monitor shows the OANDA proxy or Kraken throttling, drop the pass (delete the quick-pass block) before shortening anything else.

## cTrader demo mirror: same-time copies (8 Nov 2026)
`council/ctrader-mirror.mjs` runs straight after the Trader and the ICT desk in each council round (council.yml). A council trade
that is still `pending` gets a resting LIMIT order at the broker: price = the council entry, absolute `stopLoss` / `takeProfit` = the
council levels, GOOD_TILL_DATE at the council's own expiry (`validUntil`: `validFor`, else `WAIT[h]`, else a day; keep `WAIT` in step
with trader.mjs). State: `state.orders` by trade id (orderId, limitPrice, lots, riskCash); counts toward `maxOpen` and the open risk.
The broker filling first → the position is adopted by label + comment (`viaLimit`, one open alert); the council filling first → the
limit is cancelled (`CANCEL_ORDER_REQ`, the only cancel the mirror may send, own orders only) and the usual market order follows the
same round; the council expiring / missing / dropping the trade → cancelled; a rejected cancel (filled meanwhile) → adopted next round.
A buy whose entry is above the current price (or a sell below) is left to the council's next candle and copied as a market order. Open
council trades are copied as market orders with relative distances measured from the council's latest price (snapshot.json `marks`),
so the demo stop/target equal the council's; a price already past the stop/target or more than `LIMITS.maxDriftR` (1R) into the trade
is skipped (council trades only: ICT trades carry futures levels, so they skip this late-copy check; docs/owner-decisions.md item 10). Minimum-lot orders risking over `LIMITS.maxMinLotRisk` (2%) wait for a bigger balance. Closed market, holidays and the
capacity caps are waits (symbol paused `LIMITS.pause`), broker rejections skips; notes live while the council trade is open or pending.
One demo account per book (8 Nov, owner): `bookOf` (ict / lit / replica / shadow / council), `accountsFor(env, cfg)` from council-data
config.json `mirrorAccounts` or env `CTRADER_ACCOUNTS` ("council:1,ict:2,shadow:3,lit:4"; wins), books without a number trade on
CTRADER_ACCOUNT_ID; the CLI runs one round per account (the token pair is shared and handed on), writes mirror.json for the base
account and mirror-<account>.json for the others, plus mirror-accounts.json (the map); alerts carry [book]. Shadows are mirrored unless config.json `mirrorShadow: false`; ICT signals that are not A-setups count as shadows
(`ictCandidates`) and go to the ICT book's account (docs/owner-decisions.md item 9). When the council moves an open trade's stop or target (break-even, trailing, a re-planned target) the demo position's protection follows
(`AMEND_POSITION_SLTP_REQ`, own positions only; council trades take the absolute levels, ICT trades move the broker stop by the
council's distance; `AMEND_TRIES` rejections then left alone; 8 Nov, owner approved). `council/ctrader-reset.json { at }` drops the copied-trade records once per `at` (owner closed everything by hand). **RULE (owner, 8 Nov):
a mirrored position never sits without a stop.** A market order's relative stop is measured from the fill, so a stop distance inside
the spread is dropped by the broker and the position stays unprotected; `ensureStop` sets the council's absolute stop (ICT: the
council's distance from the fill) by amend right at the fill and on every round for any held position without one, and CLOSES the
position at once when the broker refuses the stop (only no answer at all waits a round, with a `nostop` alert); step 3 skips a trade
whose stop distance is within 1.25× the broker spread (ctrader/symbols.json). Tests:
`tests/ctrader-mirror.test.mjs` (fake broker with resting orders, `fillOrder`, cancel / cancel-rejected paths).

## Exchange price ticks on the charts (8 Nov 2026)
Crypto charts (Binance / Kraken / Bitstamp candles, no OANDA stream) used to re-poll only every 10 s to 5 min and looked static when
the Binance websocket did not connect. `startRestTicks()` reads the last price every 2.5 s (Binance ticker, else Kraken Ticker) and
moves the forming candle on every pane like the OANDA ticks (`G.tickSrc 'rest'`, status "Live · <source> price ticks"); it starts when
the stream's 8 s connect timer fires or when the source is not Binance, stops itself once a stream is live, and the fallback poll is
fast for every source while nothing ticks.

## LIT replay, last two months (8 Nov 2026)
`council/lit-replay.mjs` (owner: "fill trades from the last 2 months so I can study them"): the pre-registered rule (council/lit.mjs
detector + the study's simulateOrder / selectTrades from research/edge/lit/run.mjs) over ~63 days of OANDA 5m gold read through
`MD_BASE` bars?from&to in 15-day windows (+9 days warm-up) → council-data `lit/replay.json`: funnel, build counts, every setup with
its drop reason or order and outcome, the taken trades with Rnet / Rnet2, the other variants. Runs in the council loop (the ICT round),
skipped while the file is < 20 h old and `version` matches (`--force` overrides; `--days N`, default 90). Paper research, not the
stream's records; the LIT desk shows it under "Last two months, replayed". The pre-registered rule rarely fills (8 Nov, 90 days: 101
setups, 2 orders, 0 fills), so `STUDY_SETS` (owner: "I need trades, find a way") keep the M15 manipulation and loosen execution, each
labelled "for study only": `loose-limit` (MX re-anchors, no quality filters, R:R > 1.5, no cap, touch fills, 48-bar life) and
`market-break` (market on the close after the M5 break); `buildStudy` / `simulateStudy`; each reports every fill and the gated trades.
First run: loose-limit 19 fills +3.7R (gated 14, +5.2R), market-break 9 fills −1.0R. Tests: `tests/lit-replay.test.mjs`.

## Desks in graphite (17 Nov 2026, owner: "do another one with other colors like grey"; spec docs/design/aureum-theme.md)
Display only, `market-structure.html`: the ICT, Gold playbook, LIT, Crypto and NQ SDV desks, the desk switch, Setup and Scanner.
One block `<style id="ms-dk-css">` (right before `#ms-ps-css`; every text 12 px or more, so the ICT typography test still holds):
inside these views `--gold` / `--gold-soft` / `--gold-line` / `--gold-ink` and the ICT desk's `--ict-*` tokens point at the
steel-blue accent (`--au-accent`, fallback #9db4d3 dark, #2f5e9e light), so every former gold mark turns blue without touching
the rule that draws it; cards flat with 12 px corners; selected segments are a raised neutral with a 2 px accent underline (the
ICT source switch was a gold fill); the desk switch is one look on every desk (each desk had its own colour). Header pattern:
title, ONE plain sentence (`.dk-ans`), the long description folded in `details.dk-more` (wording kept word for word). ICT:
`#ict-ans` ("n live trades open now. Latest signal: …", written by `render()` from `OL` and `T`), and the Signals card
(`#ict-sig`) now comes right after "Open now", before the markets strip. Also fixed: LIT / NQ SDV title tags styled, Crypto
READY green and IN ORIGIN amber (as Setup / Scanner), the LIT replay card escaped its strings twice ("&#39;"; the parse already
escapes them), its setups table scrolls under a sticky header, the Gold playbook's cards say "could not be loaded" when no
candles came (`.gp-fail`), and the Council calendar's today cell lost its gold outline (`#v-council .cal-d.today`).

## LIT and NQ SDV desks (8 Nov 2026) (removed 17 Nov 2026)
The view is gone (section "Simplified pages"); the text below is history.
The desk switch is ICT | Gold | Crypto | LIT | NQ SDV (soon). `#lit` (v-lit, `renderLit`, re-run when council-data lands) shows the paper
shadow stream: record from trades with `k 'lit'` / ids `xau-lit-*`, the detector funnel and dropped-candidate counts from `snapshot.lit`,
open / resting and closed tables. `#sdv` (v-sdv) is a placeholder that states the steps before a desk opens (pre-registration, 2020→now
backtest, verdict, paper first); nothing there is a signal.

## Guests: one page (8 Nov 2026)
Guests always land on `#charts`; at load the `#v-guest` children move into `#v-charts > #g-merged` (the gold trade card, results, the
P&L calendar, the invitation), so guest styles are scoped `:is(#v-guest, .g-merged)`. The desk's gold trade (`G.gplan`, set by
renderGuest) is drawn as Entry / Stop / Target price lines on every pane while the market is gold (`planLinesDraw`, PUB branch); the
separate guest H4 chart is gone, `guestCard()` writes the card (neutral wording, no system name). Each pane keeps a guest overlay (`P.gOv`) with the stop zone red and target zone green from the placing bar rightwards, like the main system. The "↓ Gold trade and
results" link in the charts toolbar jumps to that section.

## Sign-in and guest polish (9 Nov 2026)
Gate card (`#ms-gate`, CSS `#ms-gate3-css`, stays dark in every theme): "Sign in to the desk", a hidden fixed `username` field for
password managers, `#ms-gate-eye` show/hide (44 px, aria-pressed), one reserved message row `.gate-msg` (helper line, Caps Lock hint
or the error, so the button never moves). Submit (Enter) sets `aria-busy` + "Signing in…" with a bounded spinner and a 15 s timeout;
errors name the reason (empty, not accepted, 429 too many tries, 5xx server, offline / unreachable / timeout) with `aria-invalid`.
Phones: the card first, the live strip and proof under it, no tape. Proof cards use neutral wording (no system or rule names). No
infinite animation on the gate (live dot rings three times, the tape is static). Guest page order: charts, gold trade, results strip,
`#g-curve` (cumulative R of `sysClosed()` over 90 days, `renderGuestCurve()` from `renderGuestCal()`, fixed plot height), the P&L
calendar, then the invitation "Want a seat at the desk?" last. Shorter guest banner; the locked markup switch gets its own row on phones.

## Sign-in card and guest page: honest and main system only (11 Nov 2026, quality round)
Walked signed out and as a guest (390 px touch, 1440 px, dark / light / midnight; `/api/login` stubbed for every error state).
- **What a stranger is shown is the main system only.** The sign-in card's proof counted every open shadow trade ("Open now 25"
  with no main-system trade open) and named the newest shadow signal; `window.msGateProof(trades, ictReplay, now)` (pure, `MAIN` =
  `SYS_K`) now counts and names main-system paper trades only, a box whose file did not load keeps its dash, and the ICT card reads
  "ICT replay · a backtest", n, "since <replay.from>", "before costs" (it said "since 2020"; the replay starts 1 Aug 2025).
- **Guest memory** (`GUEST_DATA`, `guestRow`, next to `sysClosed`): for the public role, whatever the loader stores in
  `COUNCIL.trades / research / replay / snap` passes through setters first: main-system rows only, cut to `GUEST_F` (no name, pair,
  note, feat, blockedBy, pm), the snapshot cut to prices. Before, the hidden Home / Setup / Council views of a guest held 26 shadow
  trades with "Blocked by: …" and the scanner's setup texts. Guest toasts (`councilAlerts`) are main-system only and say "Paper
  trade", not the system's name. Never read a guest file into the page past these filters. Still true and NOT fixed here: the
  guest files themselves (`/cdata/trades.json`, `snapshot.json`, `research.json`, `research/replay-2w.json`) carry every book with
  names and notes to anyone who fetches them, the page source carries the admin views' static text, and the hidden views still
  hold what the page computes in the browser from public candles (the top-down steps, the scanner). Closing that needs the
  server to cut the guest files (`api/data.js`), an owner decision reported on 11 Nov.
- **The server cuts the guest files** (11 Nov 2026, owner: "do what you think is best"). `api/_guestcut.js` (pure) + `api/data.js`:
  a `/cdata` request without a valid session gets the five guest JSON files cut to what the guest page and sign-in card draw; a
  signed-in member gets the whole file, byte for byte. Sizes on 11 Nov, whole → guest: trades.json 1,588 KB → 1.4 KB (5 rows),
  snapshot.json 62 KB → 0.9 KB, research.json 599 KB → 0.3 KB (1 row), research/replay-2w.json 806 KB → 190 KB (710 rows),
  ict/replay.json 2,100 KB → 62 bytes. `mt5/signals.csv` is never cut (the broker bridges read it without a session).
  - Rows and fields are the PAGE's definitions (`SYS_K`, `NQ_SYS`, `SYSG`, `GUEST_F`, `GUEST_DATA`); the lists are written once
    more in `api/_guestcut.js` and `tests/guest-files.test.mjs` fails when one drifts, and when the cut keeps a row or value the
    page's own guest filter would not. Snapshot: `at`, `nqLast` (price, at), per market label / name / price / dec / open /
    chg, and gold's D1 / H4 / H1 trend arrows (the sign-in card). ICT replay: `from` and `totals` n / wins / R.
  - Three values are rewritten so no row names its system: `id` / `addOf` become an opaque id (HMAC with the session secret,
    the same in every file; with no secret set they are stable but guessable), `k` becomes `'main'` (`'other'` for a replay row
    outside `SYS_K`; `'nq-open'` + session `'nyflip'` stay: every NQ row a guest gets is that one system), and a gold trade the
    trade card may show carries `card: true`. The page takes them: `if (PUB) SYS_K.push('main')`, `SYSG.includes(x.k) || x.card`,
    `msGateProof` counts `'main'`. The page's own filters stay (the GitHub Pages copy reads whole files).
  - Cache: only a request with no session cookie and no member mark is answered `public` (as before, 20 s at the edge); the
    page adds `&m=1` to a signed-in member's requests (`msData` `member()`), and any request with a cookie or the mark is
    answered `private, no-store` whatever it gets; `Vary: Cookie` on the five files. A wrong or expired cookie, the mark without
    a session, or the sign-in check failing all get the cut file. A file that does not parse, or a cut that throws, is a 503 for
    a visitor (the page says "could not be loaded"), never the whole file. **Never add a file to `GUEST_OK` without a cut.**
  - **What is still public, said plainly**: the `council-data` branch itself is readable on GitHub while the repository is
    public (the Pages copy and the smoke test read it there); this closes the site's own door, not that one
    (docs/owner-decisions.md item 32). Also public: `mt5/signals.csv` (live main-system orders with their system key), the page
    source (system keys, the admin views' static text), and what the page computes in the browser from public candles.
  - Other readers of council-data without a session, unaffected: `api/status.js` and `api/pine.js` use `readFile` (not
    `/cdata`); the MT5 / cTrader bridges read only the csv; index.html and macro-desk.html read members' files.
- **A backtest is called a backtest.** The guest "Last 90 days" curve is mostly the replay of the rules on past candles (11 Nov:
  40 of 45 trades, +10.2R, against 5 forward paper trades, −2.05R) and was all labelled "paper trades". `guestSplit` counts the two
  apart; the replay is drawn dashed, the forward record solid from a dotted marker, and the label, the count, the note and the
  plot's aria-label name both; the calendar note gives the date before which days are a backtest. No number changed.
- Empty states: the trade card says loading / could not be loaded / no gold trade (it vanished); the strip, curve and calendar say
  when council-data could not be read (the calendar said "No closed trades"); "Floating now" no longer calls a waiting order open.
  The curve redraws when its plot gets a width (`ResizeObserver`): results that arrived first left "Loading results…" on screen
  until the next data load (2 of 3 desktop loads).
- Sign-in card: the page behind is `inert` while the card is up (`msGateInert`; Tab used to reach "Skip to content" behind the
  `aria-modal` card), closing hands focus back to the button that opened it, and Caps Lock + an error no longer stack and push the
  button (the wrong-password line names Caps Lock). The gate's layout shift and `loadCouncil` were left to the load-performance pass.
- "↓ Gold trade and results" did nothing: as a `#g-setup` link it changed the address, and the view router scrolled back to the
  top. A click handler scrolls to `#g-merged` and leaves the address alone. A guest's account menu no longer offers the profile.
- Tests: `tests/qa-sweep.test.mjs` (the five "sign-in card" / "guest" checks run `msGateProof`, `GUEST_DATA` and `guestSplit`).

## Guests on the charts, wide-screen density (8 Nov 2026)
Guests (`PUB`) may open `#charts` on any market (watchlist chips `?s=<market>#charts`, header picker live only on the charts view;
`html[data-view]` set by showView). Their markup is Clean only: `setMode` forces clean, Meridian / ICT buttons show a lock and open
the gate; `planLinesDraw` and `klList` return nothing for guests; `#ms-mtf`, readouts, chips and `.ms-role` are hidden. The guest
overview carries an "Open the charts" button; the charts a "← Gold overview" link and a members note. `#ms-dense-css`: from 1400 px
the app is 1760 px wide (2000 px from 1800 px), tighter gaps and paddings, the home markets grid auto-fills 168 px cards.
**19 Nov 2026 fix**: a guest always lands on Charts (`showView`: `v = PUB ? 'charts' : …`). The 19 Nov "denied Home lands on Charts" fallback read the guest's viewer-default `charts: false` and sent guests to a Home they cannot see (a blank page). The chart header's cycle tag `.ms-cy` is hidden for guests (Meridian markup). The smoke test's guest run fails unless the view is Charts with a chart drawn.

## Profile page and guest view (8 Nov 2026)
`#profile` (v-profile, in VIEWS and the viewer allow-list) holds the identity card (copied from the account menu) and the council's
demo accounts rendered by the cTrader module in page mode (`MODE = 'page'` → `#ms-pf-b`; the dialog stays for the cTrader link
return). The account menu's first item is "Profile and demo accounts"; the old "My cTrader account" item is hidden. The cached account
info (`ms-acct`, from `/api/login` / `/api/me`) carries `ct`. Light theme defines `--panel-hover`,
`--line-strong`, `--accent-soft`, `--buy-soft`, `--sell-soft` (hovers used to fall back to the dark values). Guest view: the trade in
words (`#g-setup`), named price lines, a chart that follows the page theme with coloured candles, the header pinned to XAU/USD, and an
invitation (`.g-join`) whose Sign in opens the gate.

## Accounts, desks, header switch, gate (8 Nov 2026)
Users (built-ins in `api/_accounts.js`): Fred reviewer + ICT write (reviews) + mcp, Orlando reviewer (sees everything) + ICT read-only,
Luxus viewer, Carlos viewer; `ct: true` (Fred, Orlando, Carlos) shows the council's demo accounts on "My cTrader account" with edge labels only, never account numbers
(`html[data-ct]`, "owner" for the owner who also sees the logins). ICT, Gold and Crypto share one sidebar / header entry "Desks"
(`[data-desks]`, opens the desk used last, localStorage `ms-desk`) and each desk carries the `.desk-sw` switch. The header's
Desk | Macro control (`.hdr-sw`, conic ring) also sits on /macro-desk the other way round (Desk goes back). Home refresh: scoped
`#ms-home2-css` (gold wash, raised today band, lifting cards). The gate shows live proof for guests (`#gs-proof`: open paper trades,
the ICT replay record, the last signal; `#gs-tape` market tape) and an invitation line.

## Charts: markup switch and settings groups (8 Nov 2026)
The chart-header switch is Meridian | ICT | Clean (`setMode`, `html[data-mk]`, localStorage `ms-mode`): one markup at a time, never
stacked; Clean detaches both overlays, their price lines and markers (indicators, drawings and position plans stay). Settings → Chart
layers are four named groups (Meridian markup, Council, Levels and time, Chart); Telegram sits behind a disclosure. The header carries a
centred "Macro desk" button (`.hdr-macro`, animated conic border, hidden for the public role) linking to /macro-desk.
**Clean look by default** (13 Nov 2026, owner: "make the charts more cleaner"): the Style popover's "Clean look" (`#ms-sty-clean`,
`BUSY`) now hides every layer but BO lines, VR and CF (owner, same day: "too much labels just keep bo vr and cf"; the 50% line
follows Origin and the Invalidation price line follows Next setup, so both go with them) and is switched ON
once per device the first time the charts open (`ms-clean-v2`, run after the layer checkboxes are wired); "Clean look" again brings
back exactly what was on (`ms-clean`). The Style button reads "Candles · clean" while it is on. Display only. While it is on (`html[data-clean="1"]`,
`merItems` `CL`) a chart writes one "BO" on its last break and one "CF" on its last CF, and `#ms-clean-css` hides the market-cycle
line, the range / alignment strip, the Context button, each chart's role word and its readout under the chart (owner: "too much labels").
Same day, owner: "its missing ibos": iBO lines stay in the clean look (only the last one keeps the word "iBO"); a device already
clean switches them on once (`ms-clean-v3`).
**Expected move and cycle tag** (13 Nov 2026, owner: "an arrow of the move he is expecting and which market cycle we are in right
now in each timeframe"): every Meridian chart with a cycle reading draws a purple arrow from the last close to `msExpect(row,
close)` (pure, next to `msCycle`; the row whose parent is that chart: moving / continuation -> its extreme, pulling back -> its
50% then its origin, only a target still ahead of price) labelled "Move to ▼ 3,852.6" etc.; each pane header carries `.ms-cy`
(`cycleTags`, refreshed with the cycle strip every 10 s): "Moving ▼", "Pulling back ▲", "Continuation ▼", or "Trend ▼" where no
lower timeframe reads it (M5, M1). On in the clean look too. Display only, a reading of structure, not a tested rule.
Same day, owner: "better arrows showing where it might retrace, and be more specific on market cycle": the arrow is now a two-leg
path (`msPath`, pure, next to `msCycle`; `msExpect` is gone): a dashed amber retrace leg first (pulling back: to the 50%, or the
origin once past it; moving: "Possible retrace to 50%"; continuation: "Possible retest" of the level it broke back through), then
a solid purple leg back with the move to its extreme ("then ▼ 3,852.6"); a leg only to a level still ahead of price. The pane tag
names the step and its level (`msStage`): "1 Move ▼ · no pullback yet", "2 Pullback ▲ · 50% at …" (or "past 50%, origin …"),
"3 Continuation ▼ · from …"; M5 / M1 read the stage of the timeframe above them ("In M15 continuation"); the tooltip says which
ChoCh / break and the levels. From 1200 px the tag keeps its full width.
Same day, the owner's shared lesson (M21 on internal structure; the owner's reading: "price doesn't need to reach the 50%";
"we don't need to wait for the external 50% retracement, we can use the internal structure"): `msInternalLeg(bars, closedN,
d, breaks)` (pure, next to `msInternal`) = the range of the LAST internal (else major) break in the move's direction, from the
high the drop came from to the lowest low since, whatever the depth of the pullback before it (no 50% pullback is needed first;
`reached` = price has since traded back to its 50%). While the move runs, `msPath(row, px, iv)` retraces to the INTERNAL 50%
first ("Retrace to internal 50%"), none once it is reached; a chart with no cycle row (M5, M1) draws the internal path alone
("Break of the internal low / high"). A thin dashed "Internal 50%" line shows (in the clean look too since 13 Nov). Display only, not a tested rule.
Same day, the owner's marked H1 chart ("Show me the entry zones on the internal 50%", "check the marking"): the internal high
was anchored on a major break's origin many swings back (4,148.7 on H1 instead of the lower high 4,000.7); `msInternalLeg` now
takes the last swing high (the chart's own `PIVOT`) after the PREVIOUS break that way and before this one (`startIdx`), else the
highest point there. `msEntryZones(bars, closedN, iv, zones)` (pure, next to it) = the order block the leg came from (last
candle against the move at or before the internal high, out to that high) plus fresh same-way `msZones` inside the leg, cut at
the 50%, gone once a candle trades into it or the 50% is reached; at most two, nearest the 50% first. Drawn as solid boxes
"Sell / Buy zone · above / below internal 50% lo–hi", in the clean look too; "Internal high / low" lines outside it. On 13 Nov:
H1 3,968.8–4,000.7 over a 50% at 3,926.7, H4 4,040.6–4,067.1 (the owner's 4,068 mark). Display only, not a tested rule.
14 Nov 2026, owner: "Less labels and simpler but easy to understand", then a marked M15 chart ("many wrong markups"). Labels:
an arrow reads "Pullback <price>" (dashed amber) or "Target <price>" (purple), a zone "Sell zone" / "Buy zone", a fresh OB
"Supply OB" / "Demand OB"; the internal 50% line says "50%" only when no arrow names it, nothing once reached (fainter line);
the pane tag is one word ("Move ▼", "Pullback ▲", "Continuation ▼") with the step and levels in its tooltip. `msInternal`
fixes: (1) with the move, the level to break is the move's EXTREME (in a fall the lowest swing low since the last break; a
newer higher low no longer replaces it: it drew 3,889.5 instead of the owner's 3,888.5); (2) a break sets the level on the
other side at once = the lowest low (highest high) from the candle after the broken swing to the break (the owner's 3,904.7,
which the swing rule missed because the impulse candle before it had a lower wick); a later swing the other way still
replaces it. Pinned on the real candles (`tests/fixtures/xau-m15-oanda-2026-11-13.json`).
14 Nov 2026, M21's lesson read by the owner ("if we had cf to buy we could but only had vr, while m1 sell had vr and cf, that's
why he should [sell], market will tell us what he wants us to do"): the M1 chart reads BOTH sides from the open of the last
closed H1 candle (`msSides(bars, closedN, from, N = 3)`, pure, next to `msMosha`): a sell VR = the box from the highest high to
the last swing low before it, its CF = the first close below that box, the CF zone = the last green candle at or before the
highest point between the high and the CF; a buy mirrors it on the lowest low. The side with a VR and a CF is the trade, a VR
alone is not; both with a CF: the later one (`pick`). Drawn on M1 under the VR layer (clean look too): a grey box for the closed
H1 candle, a "VR ▲/▼" box per side, the CF zone ("CF ▼ · wait for the pullback" / "pulled back") and one line top right
("Buy: VR + CF · Sell: VR only", the traded side first). Display only, not a tested rule; M21's own hour was not found in our
candles (13 Nov 2024 has no big bullish H1 candle), so it is checked on hand-made candles and the live chart.

## Meridian markup: closed candles, failed breaks, line chart, more history (12 Nov 2026, owner)
Display only (`market-structure.html`); the council's own engine copy in `council/trader.mjs` is unchanged.
- **A BO needs a close** ("if it doesn't close it is not a BO"): panes, split chart and scanner analyse closed candles only
  (`msClosedN`); the forming candle never draws a BO, ChoCh, VR or moved extreme.
- **A low that failed to break the low becomes the new low**: in `msAnalyze` a wick through the protected swing with no close
  beyond it moves the protected level and the Origin edge to that wick (`sweepProt`); only a close beyond the new level is a BO.
- **Chart type** (Settings → Chart, `#ms-cs`, localStorage `ms-cs`): Candles, Line (closes) or Candles + line; the markup stays
  on the candle series (invisible candles in Line mode, `P.setStyle`, re-applied on a theme change).
- **Style button** (12 Nov 2026, owner: "make the chart cleaner, let me choose colour background and candle, I can't find the line
  chart option"): `#ms-sty-btn` on the charts toolbar (also on phones, outside "More") opens `#ms-sty-pop`: chart type (one setter
  `setCs` keeps it and Settings' `#ms-cs` in step), colour pickers for the background, up / down candles and the line (localStorage
  `ms-colors` `{ bg, up, dn, ln }`, per device; `candleCols` / `applyTheme` use them over the theme, the scale text turns dark on a
  light background by luminance; "Theme colours" clears them) and **Clean look**: switches the busiest layers off through their
  own Settings checkboxes (earlier breaks, iBO, volume, session shading, key levels, news; `BUSY`), remembers what was on
  (localStorage `ms-clean`) and puts it back on a second tap. Display only.
- **More history**: `BARS` 1,500 a timeframe at load (was 500); scrolling to the first candles loads older OANDA windows up to
  `CAP` 6,000 (`P.loadOlder`); refreshes ask for 300 and join them (`mergeBars`) so older candles stay. Every earlier break is
  drawn as a thin dashed BOS / ChoCh line (layer "Earlier breaks", `G.show.hist`). The cycle line joins the BO line of the same
  break; a higher-timeframe target already traded through reads "reached, no close beyond". Tests: `tests/market-cycle.test.mjs`.
- **Internal breaks (iBO)** (owner: "I'd like the iBOS as well", "I mean iBO", then a marked chart): `msInternal` = every
  close beyond the last unbroken swing high / low of the chart's OWN labelled swings (HH / HL / LH / LL, `PIVOT` a side, used once
  confirmed, each broken once), closed candles only, over the whole loaded history; every one labelled iBO ▲ / ▼ (Mosha: a break of an internal swing
  is an i.BO, never a ChoCh; the external structure keeps the bias). Thin dotted lines (layer "Internal breaks",
  `G.show.ibos`); a level the major structure already draws is skipped. **After a pullback the first ChoCh back with the timeframe
  above starts the continuation** (owner): the cycle line reads "<TF> continuation starts", the chip "continuation".

## Meridian markup: fresh entry zones after BO / iBO (12 Nov 2026, owner: "after iBOs and BO mark zone for entry, barrier / EG unmitigated, fresh supply or demand OB")
Display only, Meridian markup only (layer "Fresh entry zones (OB after BO / iBO)", `G.show.zones`). `msZones(bars, breaks, closedN)`
(pure, next to `msInternal`): for every major BO (`A.events`) and iBO (`msInternal`), the order block = the last candle against the
break at or before the leg's origin (break up: the last red candle at or before the lowest low of the leg; break down: the last
green one at or before the highest high; else the origin candle), wick to wick and out to the origin's extreme; one zone per
candle. **Fresh** while no CLOSED candle after the break has traded into it; the first touch mitigates it (`touchIdx`), a close
through its far side breaks it (`brokenIdx`); only fresh zones are drawn, the three nearest to price a side, dashed boxes out to the right
edge labelled "Demand / Supply OB · fresh · BO|iBO <range>". Not a tested rule (the skill's 14-year engulf tests found no edge in
zone mechanics alone). Tests: `tests/market-cycle.test.mjs` ("fresh zones").

## Meridian markup: the Mosha layer (12 Nov 2026, owner: "build the mosha layer"; redrawn 13 Nov 2026 from the owner's pictures)
**20 Nov 2026: this section's reading is replaced** (owner uploaded the method's own course documents, private, never copied
into the repository; asked to fix the layer: "both"). The 13 Nov pictures were the documents' "bad CF" exception cases, not the
rule. `msMosha` now follows the SOP: BO of the timeframe above → **VR** = this chart's first break AGAINST the BO (formed once;
`p50` / `deep` when the BO's far edge is known) → **CF** = the next break back WITH the BO (a failed CF is replaced by a later
one, `cf.again`); `case` 2 = the CF zone overlaps the VR box ("inside the VR, likely to fail"). Entry: pullback into the CF zone,
then an EG with the BO (a close, never a wick), stop $0.30 past the pullback's extreme, target the VR's extreme. A close through
the CF zone's far side before an entry = `cf-failed` (expected move back to the BO level); a close past the VR's extreme with no
CF = `bo-on`. States: wait-vr, wait-cf, bo-on, vr-broken, wait-pullback, wait-eg, eg, cf-failed. Layer label "Mosha storyline
(BO, VR, CF, expected move)". Not drawn: the documents' sideways case and the barrier entry's confirmation timeframes. `msSides`
(the M1 both-sides reading) is unchanged. Still display only, not a tested rule. Tests: `tests/market-cycle.test.mjs` ("Mosha").
The text below is history.
Display only, Meridian markup only (layer "Mosha storyline (VR, CF, barrier, expected move)", `G.show.mosha`, orange); no rule,
trade or alert reads it and it is not a tested rule (the mechanical Mosha studies failed). `msMosha(htf, ltf, buf)` (pure, next to
`msCycle`; `moshaNow(id, bars)` feeds it, closed candles only): the last BO of the timeframe above (D1 for H4, H4 for H1, H1 for
M15, M15 for M5) read on this chart. **13 Nov 2026**, the owner sent three M21 pictures ("CF not touch Barrier", "CF Inside VR",
"CF Failed", both sides) and said of their dashed lines "that the expected move to follow". The layer follows them now:
- **Barrier** = the level the BO of the timeframe above broke. **VR** = the range at the extreme the BO made, put in by this
  chart's first break AGAINST the BO (box from the extreme to the level that break took). **CF** = the NEXT break against the BO
  (the lower high under a buy BO's VR, the higher low over a sell BO's VR); its origin is the CF zone.
- **Expected move** (dashed line) = from the CF back to the barrier, against the BO: case 1 the CF zone is clear of the barrier,
  case 2 it sits inside the VR box; a CF zone that already reaches the barrier leaves no move (`at-barrier`).
- **CF failed** = a closed candle back through the CF zone's far side: the expected move turns with the BO, past the VR's
  extreme (`cf-failed`). A close beyond the VR's extreme before any CF = the BO goes on (`bo-on`).
- Entry kept from 12 Nov ("i want eg as entry"): price pulls back into the CF zone, then an EG in the CF's direction (a closed
  candle beyond the last opposite candle, never a wick); stop $0.30 past the pullback's extreme on gold; target the barrier.
- Before 13 Nov the layer read it the other way (CF = the break back WITH the BO, trade with the BO to the VR's extreme, a case 3):
  the owner's pictures replaced that reading. The open questions put to the owner (what exactly a failed CF is, a target past
  the barrier in case 2) were not answered beyond "that the expected move to follow": change the layer when they are.
Tests: `tests/market-cycle.test.mjs` ("Mosha": one per picture and the sell mirror).

## Meridian markup: the market cycle (11 Nov 2026, owner: "H4 move, H1 ChoCh tells pullback or retracement started, M15 / M5 to entry and target H4 or H1 … H4 tells retracement of daily, M15 retracement of H1, M5 of M15")
`msCycle(legs)` (pure, top level of `market-structure.html` next to `msAnalyze`; `cycleNow()` builds the legs of D1 / H4 / H1 /
M15 / M5 from each pane's own analysis): for each timeframe and the one under it, `move` (the lower one still agrees), `pullback`
(the lower one broke against it after its break: that break is the ChoCh, the pullback / retracement started) or `resumed` (the
lower one then broke back with it: the pullback is over). Targets: a pullback goes to 50% of the move, then the move's origin
(the broken level); the move's own target is its extreme. On the charts (layer "Market cycle", `G.show.cycle`, purple `CYC`):
the ChoCh line on the lower chart ("ChoCh ▲ · H4 pullback starts", "back with H4"), and on H4 / H1 / M15 / M5 the targets of
the legs above it (H4 shows D1's; H1 shows H4's; M15 and M5 show H4's and H1's). `#ms-cycle` under the alignment strip: a chip
per pair and one sentence for H4 / H1. Display only, Meridian markup only, hidden for guests: no rule, trade or alert reads it,
and it says "a reading of structure, not a tested rule" (the mosha-retrace / mosha-cycle studies of this reading failed).
Tests: `tests/market-cycle.test.mjs`.

## cTrader demo accounts on the profile (8 Nov 2026)
`council/ctrader-account.mjs` (`accountSnapshots`) reads every account the mirror trades on (accountsFor: council/ctrader-accounts.json,
config.json mirrorAccounts, env) and writes council-data `ctrader/accounts.json { at, accounts: [{ label, books, base, account, balance,
equity, floating, open, orders, history | error }] }` plus `ctrader/account.json` (the base account, unchanged shape). Labels: Council,
ICT, Shadows, LIT, Replica. The owner's "My cTrader account" dialog (market-structure.html) shows an overview table of all accounts
(balance, equity, floating, closed 30 d, open; a totals row) and the clicked row's details below; falls back to account.json. Read
only, demo only; login numbers masked. Tests: `tests/ctrader-account.test.mjs`.

## cTrader symbol specs (7 Nov 2026)
`council/ctrader-symbols.mjs` (each council round, before the mirror; read only through `api/ctrader-link.js`'s `READ_ONLY` session,
demo only) → council-data `ctrader/symbols.json`: for the broker symbol the mirror picks per market (`markets`, `missing`): lotSize /
units a lot, min / step / max volume (raw and lots), digits, pipPosition, base / quote asset names, tradingMode, schedule + holidays,
leverageId + tiers, commission / swap / distance fields, last bid / ask and `spread` (price; kept from the last open market when shut,
the Trader's cost model reads it), `quoteToDeposit` (broker conversion chain + its ticks), `valuePerPoint`, margin for 1 lot and the
leverage it implies, P/L per point seen on the demo's own deals (`observed`), and a sample ICT trade (0.20% of $50k, typical stop)
sized by `riskVolume`. The mirror sizes with it (`specFor` → `quoteRate`: quote = account currency 1, base = account currency
1/price, else the broker rate at most 3 days old; no file → the old USD-account rule). Admin view: "Broker specs" under the Council
mirror row. Tests: `tests/ctrader-symbols.test.mjs`, `tests/ctrader-mirror.test.mjs`. Real Fusion specs (first file, pinned in
`tests/fixtures/ctrader/symbols.json`): USD account 1:500; XAUUSD 100 oz a lot ($100 a $1 move), NAS100 / US500 / US30 / US2000 1
unit a lot ($1 a point, 1:100), forex 100,000; all min / step 0.01 lot, max 100. `impliedPrice` (margin × leverage ÷ units) checks
the lot size with the market shut.

## ICT MCP server for outside helpers (8 Nov 2026, owner: "make an MCP for ChatGPT, my friend will use it"; 9 Nov: "make a proper good MCP for Fred for him to be able to work on the ICT with ChatGPT")
`api/mcp.js` (+ `api/_ictlab.js`), served at `https://meridianx.dev/api/mcp/<key>` (vercel.json rewrite → `/api/mcp?key=`; must stay under /api: the firewall denies POST elsewhere; `functions` entry: 60 s, includeFiles `ict/*.mjs` + `council/events.mjs`). Helper's guide: `docs/fred-mcp.md`.
Protocol: MCP Streamable HTTP, stateless JSON over POST; versions 2025-11-25 / 2025-06-18 / 2025-03-26 / 2024-11-05 negotiated in `initialize` (unknown → newest);
unsupported `MCP-Protocol-Version` header → 400; notifications / client responses → 202 no body; GET and DELETE → 405 (no SSE, no sessions);
OPTIONS 204 + CORS; a browser `Origin` outside `ORIGINS` (chatgpt.com, claude.ai, meridianx.dev, localhost; env `MCP_ORIGINS` adds) → 403;
batches up to 20; JSON-RPC -32700 / -32600 / -32601 / -32602 (unknown tool, or a write tool for a read-only member); bad arguments are
checked against the input schema (`check`) and come back as `isError` tool results; `server/discover` is -32601 so newer clients fall back to
initialize. Tools carry `title`, `annotations` (readOnlyHint / destructiveHint false / idempotentHint / openWorldHint), described schemas with
enums / defaults, `outputSchema` + `structuredContent` for guide, bars, backtest, compare, my_proposals. `search` / `fetch` keep OpenAI's
company-knowledge shapes (`{results:[{id,title,url}]}`; `{id,title,text,url,metadata}`; ids trade:…, rule:…, guide:desk).
Keys: one per person; MCP_KEYS optional (`"fred:<24+ random chars>,…"`); derived `derivedKey` = `<name>.<HMAC(CTRADER_LINK_KEY or CRON_SECRET, "mcp:<name>")>`
(32 chars) for any member; `granted(name)` on every call (record mcp / perms.mcp; perms.mcp false revokes; an MCP_KEYS entry is a grant; Fred
built in); `ictLevel(name)` (perms.ict, else the record's ict, else `BUILT_IN`; MCP_KEYS-only names read): 'none' → 403, 'read' → the write
tools are hidden and refused, 'write' → all. Reads use `GH_READ_TOKEN` (fallback `GH_TOKEN`), writes `GH_MCP_TOKEN` (fallback `GH_TOKEN`;
Contents write, Pull requests write, Issues write for comments, Checks read for CI state; without PR rights the tool returns the compare link).
Tools (read): `ict_guide` (`GUIDE`: desk, A-setup, rules, workflow, params, data, limits; also the `instructions`), `ict_rules`, `ict_trades`
(Both never counts a live signal twice), `ict_trade`, `ict_status`, `ctrader_results` (labels only: `scrub`), `ict_bars` (OANDA mid, ≤ 1500
rows `[time, o, h, l, c, v]`, ≤ 20 000 candles a window), `ict_backtest` / `ict_compare` (below), `ict_file_list` / `ict_file_read` (allowlist
`okPath`: ict/*.mjs, .claude/skills/ICT/*.md, tests/ict-*.test.mjs, tests/fixtures/ict/*, research/ict/*, research/edge/ict-*/*),
`ict_my_proposals` (PRs from `mcp/<name>/…`: state, draft, CI from check runs, the last comments / reviews with `owner: true`), `search`, `fetch`.
Write (ICT 'write' only): `ict_note` (council-data `ict/mcp-notes.json`), `ict_propose_change`, `ict_proposal_comment` (own PRs only: head
`mcp/<name>/`; `@mentions` are put in backticks, `noPing`). Proposals (`validateProposal`): allowlisted paths, ≤ 12 files / 200 KB each /
400 KB; no file identical to main; `node --check` on .mjs (a temp file), JSON.parse on .json; no NEW child_process / process.env / eval /
network / api-or-council import (counted against main: `RISKY`); a change to ict/*.mjs or the skill needs a `tests/ict-*.test.mjs` using
node:test; `risk` and `evidence` (text) or `evidence_run` (the server runs `ict_compare` 2020-now and puts the table in) are required. Branch
`mcp/<name>/…` + DRAFT PR with What / Why / Evidence (2020-now, IS vs OOS) / Risk / Server checks / Owner checklist.
Lab (`api/_ictlab.js`): the desk's own engine (tracker `signals` / `isASetup` / `isPaperA` / `sizeOf` / `P`, replay `simulate`, by dynamic
import) on OANDA mid H1 (NQ → NAS100, ES → SPX500, YM → US30, RTY → US2000, GC → XAU, XAG; any OANDA key with the index rule), 4800-candle
chunks cached per instance (done 6 h, open 5 min), complete candles, 17:00 ET hour dropped, D1 = `dailyNY`; without OANDA, NQ / ES / YM use
council-data `research/candles/idx` (2023 on) and say so. Window 2020-01-01 → now (≥ 30 days), 1-5 markets, ~40 s candle budget; params
(piv, look, vmax, maxAtr, holdH, be, trail_from / trail_dist, mark) are applied to `P` inside ONE synchronous run and put back in `finally`;
filters (min_grade, sides, sessions, atr_min / atr_max, bias, zone, min_body, max_speed, htf_fvg, skip_friday, min_room_r); one open trade per
market in the tested stream; net of a round-trip cost (NQ 1.5, ES 0.5, YM 3, RTY 0.4, gold 0.5, silver 0.03; `cost: false` = gross).
`summarize`: all / IS / OOS (default split 2024-01-01), by year, by side, PF, max DD, t, and the screen (OOS n ≥ 30, avg R > 0 IS and OOS,
≥ 2/3 OOS years positive; t ≥ 2 strong). Results cached 15 min. Rate limits per key in memory (`LIMITS`: 90 / min; heavy 12 / 10 min; bars
40 / 10 min; writes 20 / h; proposals 6 / h, counted once opened). Answers capped at 150 000 characters (cut answers drop structuredContent).
Logs: member, tool, ok / error, ms; never arguments or keys. Profile card (`PROFILE_USERS`): POST `/api/mcp` `{action:"mykey", user, pw}`
checks the password with ctrader-link's `identify` and returns the URL; the page shows `#ms-pf-mcp` only for a signed-in member with the mcp
permission. Never: council files, api/, workflows, users, tokens, cTrader orders. Tests `tests/mcp.test.mjs` (fakes in
`tests/fixtures/mcp-fake.mjs`: deterministic OANDA candles, GitHub routes, req/res driver). Rule: a helper's PR is reviewed like any rule
change (tests, 2020-now evidence) before merging.

## Fred applies ICT changes: ON for Fred (10 Nov 2026)
Owner, 10 Nov: "mcp of fred he should be able to change and edit anything regarding the ict desk such a edge"; first kept
disabled ("until I explicitly approve it"), then approved the same day: **"let fred have 100% control of ict he can change the
edge and what he want, update his mcp to allow him doing that."** So Fred may change the ICT edge without the owner's review
(the one exception to absolute rule 3). It is on for Fred and off for every other member. What "100 % control of ICT" means
here: every file of the ICT edge (tracker, replay, calendar, the rule book, ICT tests and research). What still binds him:
absolute rules 1 and 2 (the stop guard `tests/desk-ict-guard.test.mjs` runs from main's copy and is outside his reach; paper
and demo only), the ICT file allowlist (nothing of the council, the page, `api/`, workflows, users, tokens or cTrader orders),
and the automatic checks. Never widen the allowlist or weaken the guard without the owner. Off-switches:
`docs/owner-decisions.md` item 26.
- **Two things decide it for a member; each alone does nothing** (`tests/mcp-apply.test.mjs`): the apply permission (Fred's
  built-in record carries `ictApply: true`, the owner's default; a stored box, ticked or unticked, wins over it): the Users page box
  "ICT: may apply changes to the ICT edge without my review" (permission dialog, shown under ICT write; stored
  `perms.ictApply: true`; `cleanPerms` knows the key, it is not in `MS_PERM_KEYS` and gates nothing on the page) AND the
  account key in `council/ict-apply.json` on `main` (outside the ICT allowlist on purpose, so a change cannot add its author).
- **Connector** (`api/mcp.js`): `canApply(name)` = ICT 'write' and `applyFlag` (a stored boolean `perms.ictApply` decides;
  without one the built-in default, on for Fred only; never a stored record flag or an `MCP_KEYS` grant; fails closed; the stored list is read again before every apply call, so unticking stops the next
  call). Off → `ict_apply_change` and `ict_revert_change` are not listed and answer `unknown tool …` like a tool that does
  not exist. On → `ict_apply_change` takes the same arguments and the same `validateProposal` as a proposal, checks the members
  file on main and the daily cap (`applyGate`), pushes `mcp/<name>/apply-<time>-<slug>` and opens a normal pull request
  "ICT (<name>, applied): <title>". It never merges and never writes to `main`. `ict_revert_change { number, why }` restores the
  files of one of the caller's own merged applied changes from the merge commit's parent (deletes what it added; refuses and
  names the file when one changed again since) as a new applied change. Limits: applied changes and reverts count as
  proposals (6 an hour) and have 10 a day (in memory, and counted from the pull requests on GitHub).
- **One allowlist** `api/_ictrules.js` (paths, sizes, the risky-access screen, the apply branch pattern, the members-file
  parser; no imports): used by the connector and by `scripts/ict-apply-check.mjs`. Never add a second list.
- **`.github/workflows/ict-apply.yml`** (`pull_request` onto main touching ICT paths; job `verify`, named "ICT apply checks",
  only for a branch of this repository named `mcp/…/apply-…`; `contents: read`, no secrets): checks out main's files in
  `base/` and the pull request in `pr/`; runs `node base/scripts/ict-apply-check.mjs` first (member in the list, every changed
  path in the allowlist, plain files, sizes, syntax, no new network / environment / process access, read from the diff,
  nothing run); joins the change with main; runs the stop guard from `base/`, the `tests.yml` suite, and
  `sh scripts/build.sh` with `out/` unchanged. Branch names and commit ids reach scripts through `env:` only.
- **`.github/workflows/ict-apply-merge.yml`** (`workflow_run` after "ICT apply", so its definition is always main's; the only
  write token: contents, pull-requests, actions; no checkout; `concurrency: ict-apply`): downloads main's
  `scripts/ict-apply-merge.mjs`, the verifier, the rules and the members file through the API and sweeps the open
  `mcp/<member>/apply-…` pull requests: merges (squash, PR title, bound to the head commit) only when the checks of
  `ict-apply.yml` passed for exactly that commit, the pull request is open, not a draft, from this repository, the member is
  listed, every file is in the allowlist and main's ICT files did not move since its base; then dispatches `ict-replay.yml`
  (a merge made with the workflow token starts no push workflows). Any refusal is one comment (`<!-- ict-apply <sha> -->`),
  the pull request stays open for the owner. The council loop picks up new `ict/` code by itself (`newcode()` between rounds).
  This differs from a single `pull_request` workflow on purpose: such a run takes its file from the pull request, so it must
  never hold a write token.
- **Stop guard** `tests/desk-ict-guard.test.mjs` (NOT named `tests/ict-*`, so the allowlist cannot reach it; runs in the
  normal suite and, from main's copy with `ICT_GUARD_ROOT`, in the apply checks): on the pinned ICT candles and a longer
  deterministic path, every signal of `signals()` and every trade `simulate()` records has a stop on the right side of its
  entry with a positive distance, and a moved stop is never looser; `ict/*.mjs` import only node built-ins, each other and
  `../council/events.mjs` / `../council/engine.mjs` (tracker only, as on main today), nothing from `api/` or the mirror;
  no order call, broker API or non-GET request; `MARKETS` / `SHADOW_MARKETS` carry no broker, account or credential.
- **`ict_desk_update`** (ICT write; data, not code; on by default for Fred): the member's own record for a signal in
  council-data `ict/desk.json`, in the shape the desk page writes (`{ updated, reviews: { <id>: { act, grade, tags, fill, r,
  text, by, at, market, side } } }`; optional `score` 1-10), merged by signal id, never replacing another member's record.
  `ict_note` and it write through `dataWrite` (one retry; a file that does not parse is never overwritten).
- `scripts/vercel-ignore.sh` now deploys on `ict/` changes: `api/mcp.js` (the backtest lab) and `api/run.js` bundle `ict/*.mjs`.
- Tests (offline; none named `tests/ict-*`): `tests/mcp-apply.test.mjs` (off by default, each lock alone, both locks end to
  end, every refusal, revert, desk record, limits, guide text, the dialog), `tests/apply-workflow.test.mjs` (both workflow
  files as text, the verifier on temporary git repositories, the merge script on a fake GitHub, one allowlist, the guard
  failing on broken trackers), `tests/desk-ict-guard.test.mjs`, `tests/users-perms.test.mjs`.

## Per-member permissions (8 Nov 2026, owner: "select on members what they can and can't do or see")
Keys `MS_PERM_KEYS`: charts, scanner, journal, desks (Gold / Crypto / LIT / NQ SDV), council (every tab; off = overview only),
macro (Macro desk switch), ct (demo accounts' results, labels only), mcp (ChatGPT connector on the profile), ict (false | 'read' |
'write'). `MS_PERM_DEFAULTS` per role (viewer: macro only; reviewer: all but ct / mcp / ict), then the record's flags (ict, ct, mcp)
and its `perms` override key by key (`msPerms(R, owner)`; the owner has everything). Bootstrap sets `html[data-deny="…"]` /
`data-allow`, and the ict / ictRo / ct / mcp flags follow; CSS gates use `html[data-deny~="key"]` (the old viewer-role rules for
charts / scanner / journal / desks / council were converted); the router sends a denied view home (`VIEW_PERM`, `msDenied`).
Users page: a "Permissions…" button per member opens `permDialog` (checkboxes + ICT radio, "Back to role defaults"); saved on the
record as `perms` plus ict / ct / mcp for the older checks. `api/users.js` `cleanPerms` whitelists keys and values (a bad perms
object rejects the save). `/api/login` and `/api/me` return the account's perms (cached in localStorage `ms-acct`); the post-load `/api/me` check reloads when they changed. MCP keys
and `granted(name)`: see the ICT MCP section above. The perms gate the page only: `/cdata` serves any file to any signed-in member
(docs/owner-decisions.md, item 3). Tests: `tests/users-perms.test.mjs`, `tests/mcp.test.mjs`.

## Backtest lab (8 Nov 2026, owner: "build a manual backtesting like TradeZella … and he can simulate prop-firm challenges")
`backtest.html` ("ChronosTrade", owner's name, 8 Nov: third segment of the header switch Desk | Macro | ChronosTrade on all three pages, `.hdr-ct`, green when lit) at `/backtest` (vercel rewrite; build copies it; sidebar entry `.bt-nav` for signed-in members; the page itself
asks `/api/me` for a signed-in session since 9 Nov). Engine `assets/backtest-engine.js` (`window.BT`, also `module.exports` for tests): accounts,
`place` (market / limit / stop; a stop is required; sides checked), `onBar` (fills when touched or gapped through, stop / target
with the worst case when both sit in one bar, gap exits at the open, MFE / MAE in R), `stats` (win rate, PF, expectancy, max DD,
streaks, by weekday / hour / tag / side / exit, equity curve), `byDay`, and the prop-firm model: `FIRMS` presets (FTMO 2-step,
FundingPips 2-step, Topstep 50K / 100K, Lucid 50K, custom; all editable in the page, each with a "check the firm" note),
`newChallenge`, `evaluate(ch, acct, px, t)` per bar: daily loss against the day's starting equity, static or trailing floor
(eod trails end-of-day balance highs and locks at the start balance; intraday trails equity), time limit, target on closed
balance, minimum trading days, consistency (best day share), phases (next phase resets the account), funded. Page: OANDA candles
through `/md/bars` in 4999-bar windows (300 bars of context before the start, N days after), bar-by-bar replay (→ / Space /
speed / skip day); trading (owner 8 Nov: "order, SL and TP placement user friendly, charts as well"): Buy / Sell (B / S) puts a DRAFT
on the chart (`D`: entry = last close, stop = 1 ATR, target = 2R) with draggable entry / stop / target price lines (`DL`, mouse and
touch; the chart's pan pauses while dragging), red / green risk-reward zones on a canvas overlay (`drawOverlay`), the order type
decided from the entry's side of the price (`typeOf`: market / limit / stop), quick stop presets (1 / 1.5 ATR, last swing, this bar)
and target presets (1 / 1.5 / 2 / 3 R), risk-% or unit sizing, Enter / Esc; open positions' and pending orders' lines drag too
(`fixPos` / `fixOrd` keep them on the right side). Chart layers (`LAY`, localStorage `btLab:layers`): EMA 20 / 50, session bands
(London 07-12, NY 12-21 UTC), PDH / PDL; OHLC legend. Risk-% sizing, open positions (BE, close, edit SL / TP), journal with
editable tags / notes, statistics, calendar, challenge log, sessions in localStorage `btLab:sessions` (+ JSON / CSV export,
import). Pass 2 (owner: "more improvements"): Undo (←, `UNDO` snapshots of account + challenge before each bar, 60 deep), Jump to a
moment (`step(quiet)` without drawing; Skip day uses it too), a higher-timeframe context chart (`HTF`, H1 / H4 / D1 fetched for
the same window, the current candle built from the replay bars so it is still forming; localStorage `btLab:htf`), per-position
½ close (`closePartial`, its own journal record) and Trail (`p.trail` = 1 ATR, engine `trail()` after each bar), click a journal
row to frame that trade on the chart, stats Avg hold and R spread (`holdAvg`, `rDist`). Pass 3 (owner: "better aesthetic, more user friendly"): session card collapses to a summary with a progress strip
(`renderStrip`, replayed %, now, equity, trades, challenge), quick starts (`#quick`, a market / TF / days back), a first-visit
welcome (`#welcome`), toasts for loads, fills, stops, targets and challenge events (`toast()`), a keyboard guide (`#hk`), chart
watermark, loading progress, equity sparkline (`drawSpark`), journal side badges and R chips, phone layout (sticky controls,
compact header). Pass 4 (owner: "layout, chart, buttons, UI"): icon toolbar (`.tbg` groups: undo / next / play-pause /
skip, speed pills, jump, Layers and Context dropdowns as `details.dd` + `.ddp`), chart height from the viewport, volume
histogram layer (`vol`), candle colours from the theme tokens, positions and pending orders as cards (`.pos-card`), journal
summary bar (`#jsum`), zebra rows, empty states, focus rings. Smooth replay (owner: "the replay smoother"): `drawChart` adds one
candle with `series.update` (EMAs advance from `DR.e20` / `DR.e50`; full `setData` only after load, undo, jump, layer change or a
half-drawn candle); playback on `requestAnimationFrame` (`frame`), each bar forming over its time slot (`drawForming`: open, first
extreme, second, close) and committed to the engine at its close; Layers toggle "Live candle" (`LAY.anim`); side panels redraw at
most every 160 ms while playing (`render(light)`); the context chart updates its forming candle in place. Measured 60 fps at 1x and 12x.
Pass 6 (owner: "more improvements"): drawing tools (Draw menu `#drawdd`: horizontal line = draggable price line, trend line and
box drawn on the overlay; two-point shapes via a DOM click listener because the chart library turns a quick second click into a
double-click; `timeToX` / `xToTime` map time across weekend gaps and past the last bar; saved per session as `S.draw`), a trading
rules checklist in the draft (`RL`, localStorage `btLab:rules`, editable, optional strict mode that refuses a trade until every
rule is ticked; the trade keeps `rules {ok, of, miss}`; journal chip; stats "All rules followed" vs "Rules broken"), and a chart
snapshot per closed trade (`snapTrade`: chart + overlay, 520 px JPEG, `S.shots` keyed by `shotKey`, last 40 kept, kept outside the
account so Undo stays light; journal thumbnail opens `#shotd`).
Toolbar position (owner: "the play buttons should be at the top or movable"): `#tb` docks at the top of the chart (default), floats
over the chart (drag the dotted grip `#tb-grip`, compact single row, time and jump hidden) or sits under the chart; the dock button
`#tb-dock` cycles top / float / bottom (`tbPlace`, `tbMove` clamps inside the card); localStorage `btLab:tbDock` and `btLab:tbPos`;
the overlay canvas and legend follow the chart's offset. Phones keep it sticky at the bottom unless floating.
Full screen (owner: "full screen option with the buy sell buttons and floating docks"): the expand button `#fs-btn` or F (`setFs`)
fixes the chart card over the page (browser Fullscreen API when allowed), floats the replay bar, and moves the Trade card
(`#tradecard`: Buy / Sell, draft, open positions, equity in its header `#fs-eq`) into a draggable dock (`#tc-grip`, `dockMove`,
localStorage `btLab:fsDock`); leaving puts both back. Audit fixes (8 Nov): drafts no longer move focus into the stop field and
never leave it in a hidden field (keyboard shortcuts kept working), Skip day lands on the first bar of the next trading day, a
challenge breach closes every position at that bar's close and cancels pending orders (reason "challenge breach"). Phones hide
the jump field and time readout in the toolbar. End-to-end audit: `scripts/audit/chronostrade.cjs` (Playwright against a local
build and the live /md/bars, 46 checks; not in node --test).
Pass 8 (owner: "improve more"): Monte Carlo pass probability in Statistics (`BT.monteCarlo(Rs, {risk, target, maxLoss, dailyLoss, dd,
perDay, minDays, n, seed})`: the closed trades' R resampled 2,000 times against a firm's rules, all phase targets added; pass /
fail / unfinished, why it failed, typical trades and days to pass, drawdown 50th / 95th percentile; `BT.bestRisk` scans 0.25-3 %
and suggests a risk; seeded RNG for repeatable answers), stats by trading session (Asia 22-07, London 07-12, New York 12-21 UTC,
`bySession`) and by mistake (`byMistake`), and a journal Review column (`td.mist`, dialog `#mistd`: FOMO, revenge, moved stop,
early exit, late entry, oversized, against plan, hesitated, chased, ignored news, or "followed plan"; `t.mistakes`, `t.reviewed`). Tests: `tests/backtest.test.mjs`. Pass 9 (owner: "order / SL / TP placement user friendly, buttons without scrolling"): a draft readout on the chart (`#dchip`, `dchip()`: side, order type, risk in $ and %, stop, reward and R:R, 1R / 2R / 3R, Confirm / Place, cancel; bottom of the chart on phones), keys 1 / 2 / 3 / 0 set the target (1R / 2R / 3R / none) while a draft is up, drag to place (Shift+drag on the chart, or the arrows button `#qt-drag` in the quick bar for touch: press at the entry, drag to the stop; side from the direction, target 2R; snaps to market within 8 px of the last price; `PL` / `PM`), and a live tag per open position at its entry (`#ptags`, `ptags()`: P&L in $ and R, the stop and what it costs, BE and close buttons that reuse the position card actions); P&L on the chart follows the forming candle while playing (`LIVE`, `lpx()`; the engine still settles at the bar close). Audit: 61 checks, port from `PORT`. Paper only; nothing reaches the
council or the mirror.

Pass 10 (owner: "the replay smoother", user friendly): replay timing carries the leftover time into the next bar (`NEXT0`; 12× now
plays ~12 bars/s instead of ~10), the view glides one bar per bar while a candle forms (`glide()`: the chart's one-bar shift is put back and
eased over the bar; stops as soon as the user pans), the overlay canvas is only resized when the chart geometry changes (`OG`), price lines /
markers rebuild only when what they show changed (`LK`), the open-trades list and quick bar only write on change, the side panels run in an idle
slot during play (`render(light)` → `panels()` via `ric`), and saving during play waits for idle at most every 2 s (`saveSoon`, flushed on
pause / pagehide). First-run guide: `<dialog id="guide">` (5 steps: load, play/speed, order with Buy/Sell / Shift+drag / 1R-2R-3R, stop rule,
prop challenge), shown once (`btLab:guide`), Skip / Esc close it, reopened from Keys ("Show the guide", `openGuide()`). Audit: 69 checks.

Review pass (9 Nov, owner: "TradeZella-like" review after the trades): Journal = one row per trade (`BT.trades` merges partial closes; "N parts"
chip), filters (`JF`: side, session, setup tag, win/loss, date range; `#jf-*`, Clear), sortable headers (`th[data-k]`, aria-sort), inline tags / notes
(written to every record of the trade) and screenshots (`#shot-up`: add / replace / remove, 640 px JPEG in `S.shots`); clicking a row or its ▶ frames
the trade and draws its entry / stop / target / exit on the overlay (`RV`, click again or Esc clears). Statistics follow the journal filters (`jRecs`):
KPI tiles (`#kpis`), and SVG charts from `assets/bt-review.js` (`BTR.equity` with drawdown shading, `hist` 0.5R bins, `heat` weekday × hour net R,
`hbars` for setups and rule compliance "Followed every rule / Missed a rule / No checklist"), shared tooltip `.bv-tip`, theme tokens. Session report
(`#rep-btn` → `#repd`): key numbers, equity, best / worst trade, mistakes, challenge; Copy (text), Download image (`BTR.reportPNG`, canvas PNG),
Printable page / PDF (new window with print CSS). No engine maths changed. Audit: 90 checks.

Instant orders (9 Nov, owner: "Buy and Sell instant; if the price moved, take the trade where the price is, don't reject it"): Buy / Sell
(quick bar `#qt-buy` / `#qt-sell`, Trade card `#q-buy` / `#q-sell`, keys B / S) open a market position at once (`instant(side)`): stop from
the default method `OD.sl` (1 ATR unless another preset was picked; `stopFor` falls back to 1 ATR, the last swing, then 0.2 % of the
price, so never no stop), target `OD.tp` R (2R default, 0 = none), size from the risk %; localStorage `btLab:orderDef` remembers the last
stop / target preset; a toast gives entry, stop, target and risk $; strict rules still open the draft. Setting up first: Shift+B / Shift+S,
Shift+click, Shift+drag, or "Set up an order…" (`#q-setup`, hint `#q-def`). Confirm never refuses because the price moved (`#place`):
a market draft fills at the price now with the same stop distance and R:R (`reanchor`, from `D.ref` = the entry when the levels were
last set, `setRef`); a stop / target on the wrong side is mirrored to the right one; a limit / stop entry the price already passed
(`D.type0` ≠ the type now) fills at market the same way; the toast says what happened. A market draft follows the price keeping its
distances. Flip (`#dr-flip`, or asking for the other side) mirrors stop and target around the entry (`flipDraft`). `typeOf` compares
prices at the shown precision (candles carry more decimals than the form, which used to turn a market draft into a limit).
Lower panes form like a live market (19 Nov 2026, owner: "candles that still forming like real live market"): while the replay
plays, a pane on a LOWER timeframe than the first chart shows that slot's own finer candles as the slot's time passes, the one holding
the moment growing open, first extreme, second, close (`xpLower`, called from `xpLive` with the first chart's progress `p`; not while a
switched-timeframe candle forms, `S.part`). Display only: never in the pane's data (`P.liveT` marks what is shown), the engine still
settles each candle at its close, and a pause, Undo or jump draws the pane from its data again (closed candles by the moment). Title:
"live while the replay plays". `ctSplit()` panes carry `liveT` and `shown`. Test: `tests/backtest-split-sync.test.mjs`.
Real ticks (19 Nov 2026, owner: "make the main chart candle form from real ticks too, all of them"): pressing Play fetches, in the
background, the session's finer candles from the moment to the end (`tkLoad`: the finest of `TFS` that divides the timeframe, is at
most a quarter of it and keeps the count under `XMAX`; M1 for 15m, 15 s for 1m), and the forming candle of the first chart
(`drawForming`), the panes on the same or a higher timeframe (through `xpLive`) and a lower pane's forming candle (`xpLower`) follow them
(`tkAgg`; inside one finer candle the price goes open, first extreme, second, close). A candle the finer data does not cover, and a
switched-timeframe candle (`S.part`, already real), keep their own path. Display only: the engine still settles each candle at its close.
`window.ctTicks()` is the read-only view. Test: `tests/backtest-split-sync.test.mjs`.
Pass 11 (owner: "smoothness of the backtesting, the buttons organised"): measured with a frame-time bench (220 trades, 1x / 5x / 12x,
pan / zoom, line drag, tab switches, 4× CPU throttle). Fixes: only the open tab is drawn (`JD` dirty flags, `flushTabs`; journal /
stats / calendar while playing in an idle slot), the journal table shows the latest 50 trades (`JLIM`, "Show more"), a new snapshot
patches its row (`jPatch`) instead of redrawing the table, thumbnails are blob URLs made once (`shotURL`, lazy), the JPEG encode runs
just after the close, sessions are parsed once and kept in memory (`all()` cache, per-session JSON cache `SJ`; it was parsed on every
save and every panel redraw) and snapshots live under `btLab:shots:<id>` (old inline `shots` still read; export / import carry them),
Undo snapshots copy the closed list instead of every record, side panels write the DOM only on change (`setH`), the sparkline width
comes from a ResizeObserver, session bands draw one rectangle per run, `.tabp` / side cards use `content-visibility: auto`. 4× throttled,
journal open: replay p50 66 → 33 ms, long tasks 68-88 → 8-16 per run; closing a trade 787 → 335 ms (unthrottled 193 → 75 ms).
Toolbar: Replay group (undo, next, play, skip day, jump popover `#jumpdd` with J, speed pills) | time | Chart tools (`#laydd`,
`#ctxdd`, `#drawdd`) | View (sound, full screen, toolbar position); every button 32 px; container query on `.chartc` (`cc`): under 920 px
the tool labels go, under 640 px Chart tools and View move behind More (`#tb-more`, `.tb-ovf`, opens upward when the bar sits low).
Audit: 104 checks (instant buy / sell, re-anchored wrong-side stop, flip, passed limit, toolbar at 1366×768 and 390×844, J, 100+ trades).
Chart design pass (9 Nov, owner: "go harder… keep improving the design and in the chart as well", "more simpler"): every chart colour
comes from `--c-*` theme tokens (dark, light and now midnight: the head script maps `msPrefs.theme` midnight, light rules skip it);
`readTheme` / `chartLook` / `applyTheme` (re-runs on a system theme flip; colours derived once per theme in `volCols`, never per frame).
Scales in JetBrains Mono 12 px (tabular), quiet grid, watermark = symbol + timeframe (`watermark()`, sized to the width). Legend
`lgHTML`: two rows (symbol, timeframe, time UTC / O H L C, change vs the previous close with sign). Overlay (`drawOverlay`): session
bands only over the price pane and named at their foot; closed trades as dashed entry → exit connectors coloured by result with a
`✓ +2.00R` / `✕ −1.00R` pill (labels when ≤ 30 in view, at most 120 drawn); entry markers are plain arrows; zones with a 2 px start
edge and `SL … R · $` / `TP … R · $` pills inside the bands (`pill()`, 12 px); grip handles on every draggable line (filled when
hovered / dragged, `HL`), line titles without "· drag"; PDH / PDL dotted and titled "Prev day high / low". Live P&L pill `#pnlpill`
(DOM, moved by transform, total of open trades, ▲/▼ + sign + R; hidden on phones where the entry tag shows it). Drawings: one
stroke width, hover (`HS`) and selected (`SEL`) states with round handles; click selects, Delete / Backspace removes, Esc lets go.
Motion 150-200 ms on opacity / scale / translate only (`ct-in`, `ct-up`); `.ptag` now moves by transform. `window.ctChart()` is a
read-only summary of the last overlay frame for the audit. Header ring spins once on hover / focus (was infinite, as on the desk).
Audit: 112 checks (pill, handles, legend, watermark / mono scales, connectors, drawing select + Delete, midnight, reduced motion).
Analytics / journal / prop-firm pass (10 Nov, owner: "keep improving all the bits", "more visual… more simpler"): Statistics opens with a
compact header (`#kpis` `.kh`: win rate with a 50% tick, avg R, profit factor, expectancy, ▲/▼ + words; `.kh2` net, max DD, trades,
streaks), then equity + drawdown, R histogram, by-session (`#v-sess`, `BTR.hbars`) and by-weekday bars (`#v-day`, `BTR.cols`, signed R on
every bar), heatmap, setups, rules, mistakes; tables folded (`.vfold`), "All numbers" closed. Monte Carlo: verdict in words + bar, fan
chart (`BTR.fan`: 5th-95th / 25th-75th bands, median, percentiles labelled at the end, target and max-loss lines, hover per trade) from
`BT.monteCarlo(…, {fan: K})`, and the risk curve (`BTR.riskCurve`, your risk ◆ and the best ○ named above the plot) from `bestRisk().curve`
(now n 2000, same seed, so the curve at your risk equals the headline). Both are recording only: same draws and numbers (test).
Journal: filters are chips (`.chips[data-jf]`, aria-pressed, a second tap clears; dates stay inputs), 12 columns (levels as "entry →
exit" with SL / TP / exit reason under it, session under the time), a mini chart per trade (`BTR.mini`, closes around the trade + entry /
stop / target; drawn when its row scrolls into the table via IntersectionObserver, cached per trade in `MINI`). Rows are nodes that keep
their HTML (`jSet` / `jNodes`, `tr._h`): a redraw reuses unchanged rows, so a close adds one row; "Show more" at 50 kept. Challenge card:
`pfView` = state in words (On track / Below the start / Target reached, not passed / Failed: why / Passed every phase), phase pills,
profit-target bar, daily-loss and max-loss buffers as gauges (`BTR.gauge`, % left + $ + "Plenty of room / Getting close / Nearly out /
Breached"), days as pips with the minimum ringed, consistency bar with the limit. Phones: one compact toast at a time over the header band
(pointer-events none), never over the chart. Light `--buy` / `--sell` darkened to #067a64 / #c8243f for AA text. All text in these panels
≥ 12 px. Audit: 123 checks (header, session / weekday bars, fan + percentiles, risk curve, chips, mini charts and their laziness, challenge
gauges, 12 px, AA contrast dark / light / midnight, phone toast). 220-trade bench, 4× CPU: same as before within noise (close ~150-350 ms,
replay p50 17-33 ms).
Onboarding pass (9 Nov, owner: "more simpler", "keep improving all the bits"): the 5-step modal guide is replaced by a first-run card
that never blocks the page (`#guide`, a non-modal `<dialog>` opened with `show()`, bottom left; full width at the bottom on phones), four
steps that move on when you do them, in the card or anywhere on the page (`CO.ev` / `CO.tick` from load, resume, play / pause and
`panels()`): pick a market and a day (`#gd-sym`, `#gd-date`, `#gd-load`) or Surprise me (`surprise()`: a liquid market in `LIQ`, a random
weekday 1-17 weeks back; also `#q-surprise` in the quick starts) → Play (`#gd-play`, `#play` outlined) → Buy / Sell (`#gd-buy` / `#gd-sell`
call `instant`, so the stop is automatic; `#qtr` outlined) → the result in R and $ (`#gd-res`, `#gd-closeit`, `#gd-journal`), Done.
Remembered per member in localStorage `btLab:onb:<account>` (any close counts; the old shared `btLab:guide` counts as seen); reopened from
Help (`#hk-btn`, now "? Help": "Show the first steps" `#gd-open`, "How it works" `#how-open`) or "Show me how" in the welcome line. Keys pass
through the card except Space / Enter on its own buttons; Esc inside it closes it; `dialog[open]` checks skip `#guide`. Defaults on first
load: gold, 15m, the latest Tuesday-Thursday at least a week back at 12:00 UTC (`recentDay`), speed 1×, risk 1 %. Empty states
(`emptyHTML`, `goEa`, `[data-ea]`): Journal and Statistics say what will appear and offer one action (pick a market, or go to Buy / Sell
once candles are loaded; filters and empty charts hidden), Prop-firm card and Challenge log explain the challenge and point to the firm
picker. "How it works" (`#how`) rewritten as six plain lines matching the current UI. New buttons use AA fills; 44 px on touch
(`pointer: coarse`); one 180 ms fade, none with reduced motion. No engine or stop logic changed. Audit: 148 checks (four steps, non-modal,
Esc / Skip remembered, no return after a reload, per member, Surprise me, the flow done by doing it, defaults, empty states, AA dark /
light, no infinite animation, reduced motion, 44 px at 390 touch).
Split view and more timeframes (10 Nov, owner: "more timeframes, option to split chart max 4, timeframes", "improve the design buttons
layout"): the replay timeframes are 1m, 2m, 5m, 10m, 15m, 30m, 1h, 2h, 4h and 1d (`TFS`; `api/bars.js` `TF` gained OANDA's M2, M10, M30
and H2; `1w` is in `TFS` for the extra charts only). In the session form they are chips (`#tfchips`, built from the options of `#tf`,
which stays in the page as the value the code reads and sets: its `value` setter moves the chip). **Layout** (`#splitdd`, in Chart
tools, replaces the single "Context" chart; a saved `btLab:htf` becomes a two-chart layout) shows 1 to 4 charts in `#panes`: 2 = side
by side, 3 = the main chart and two stacked beside it, 4 = two by two, stacked under 700 px of card width; one chart is
`display: contents`, so the single layout is the page as it was. The extra charts are view panes (`XP`, `xpMake` / `xpLoad` /
`xpDraw`; localStorage `btLab:split` `{ n, tfs }`): the same market at the replay's moment, each with its own timeframe select and a
close button. **No look-ahead, in either direction**: a higher timeframe shows the fetched candles that ended before the cursor and
builds its last candle from the replayed bars (`xpForm`, "last candle still forming"; the fetched candle that contains the cursor is
never drawn); a lower timeframe shows only candles that closed by the end of the last replayed bar (refused above `XMAX` 40,000
candles: "load fewer days"); the same timeframe mirrors the main chart. Panes redraw from `renderHtf()` (the name the page already
called, in `panels()`), so they follow play, step, undo and jump; open trades and resting orders show on every pane as read-only
price lines (`xpLines`); one crosshair moves across all charts (`xpCross`). Orders, drafts, drag lines and drawings stay on the first
chart: `xpGeom` keeps the quick Buy / Sell bar and the legend on it (`--mr`, `.chartc.mnarrow` under 640 px). The toolbar starts with
the market and timeframe as a button (`#tb-sess`, opens the session form). `window.ctSplit()` is the audit's read-only summary.
Changing the replay's own timeframe in the middle of a session came on 11 Nov (next paragraph). Audit: 152 checks
(the chips, a 4h pane, four charts with every pane ending at the replay moment, back to one chart); the audit reads the live candle
proxy, so it only uses timeframes the live site already serves. Test: `tests/oanda-symbols.test.mjs` (page list = proxy list, each
timeframe's OANDA granularity and the 4999-candle window).
Timeframe switch in the middle of a session (11 Nov 2026, owner: "more timeframes"; the trader drops from 15m to 5m for an entry and
goes back up): the toolbar's timeframe button (`#tfdd`, chips `#tfsw [data-stf]`, label `#tf-now`; keys `,` lower and `.` higher, also
`[` `]`; in Help) calls `setTf(tf)`. `#tb-sess` now shows the market only. **One rule: the replay has one moment** (`mom()`,
`BT.tfMoment`): every price before it has been through the engine, nothing at or after it has. A switch **never touches the account**
(positions, orders, stops, targets, MFE / MAE, journal, drawings, challenge stay as they are; `S.acct` is not read or written). It only
seats the moment on the new timeframe's candles (`BT.tfPlan`): candles that ended by it are shown closed; a candle that CONTAINS it
(going up mid-candle, or an unaligned pair such as 15m → 10m or 5m → 2m) is shown **still forming**, built by `BT.tfPart` from finer
candles that ended by the moment (`BT.tfFineSec` picks the coarsest timeframe that tiles both halves; the candles of a timeframe
already loaded when they fit, else one small fetch), and sits in `S.bars` in place of the full candle (`S.part = { i, T, sec, g,
formed, full, rest }`, `BT.tfSeat` / `tfUnseat`; legend tag "still forming", `#now` says "forming"). The next step (`step()`,
`BT.tfNext` + `BT.advance`) runs `rest`, the finer candles from the moment to the candle's end, through the engine in order, each
once, and puts the full candle back: so no price is skipped or processed twice, and a stop or target inside the candle is taken where
the finer candles reach it (a test checks the account equals stepping the lower timeframe). Going down shows only candles that closed
by the moment. `BT.advance(acct, ch, bars)` is the page's per-bar order (orders and positions, the challenge, then a breach closes
everything, events marked `breach`) moved into the engine so the tests run the real code. Kept per session in memory: the candles of
each timeframe used (`TFC`), so going back is instant. **Cleared at a switch: Undo history** (the toast and the panel say so); Undo
works again from there and can bring a forming candle back. Playback first completed a forming candle in one piece at the end of its slot; it now grows over the slot (polish
pass below). Jump and Skip day complete a forming candle first. The extra panes take the moment, not the
bar (`xpDraw` lower branch uses `mom()`), so a lower pane never shows a candle past it. Saved sessions carry `mom` (and `sw` once
switched; the session strip's "replayed %" is then by time); `resume` builds a forming candle again from finer candles
(`BT.tfResume`); a session saved before this change (index only) loads as before. Limits: the new timeframe is fetched for the whole
session (300 candles of context before the start, `BT.tfWindow`); more than `XMAX` 40,000 candles is refused in words ("Too many
1 minute candles for this session …: load fewer days"), nothing changes; a failed fetch leaves the session on its timeframe.
After a switch, entry markers and connectors snap to the candle that holds their time (`timeToX` places a time inside a candle).
`holdBars` counts bars of whatever timeframe was on screen (finer candles while one formed), so hold is shown as time (polish
pass below). Phones: the timeframe button is in the toolbar row (44 px); the phone toolbar was redone in the polish pass. `window.ctTf()` is the audit's read-only
summary. Not done: a weekly replay timeframe; a lower timeframe for only part of a long session (it is all or refused).
**A moment held over a stretch with no prices** (16 Nov 2026, the audit failed on a Friday close): a switch at Fri 21:00 UTC to 4h
or 1d found every finer candle of the containing candle ended by the moment (none after it before the weekend), so nothing formed
and the bars put the moment at Sat 00:00; going down from Sat 00:00 put it back at 21:00. No price lay between, but the moment
moved. `BT.tfHold` now keeps T (`S.at`, passed to `tfMoment`) after a switch or resume whose bars would give another moment, only
when no candle lies between (it throws otherwise); the next step clears it. `ctTf()` reports `held` / `next`, `ctSplit()` a lower
pane's `next`; the audit's "aligned" and lower-pane checks accept the gap only through them. Test: "a switch at the Friday close".
Tests: `tests/backtest.test.mjs` (no future data in either direction, proven by changing every price after the moment; account
identical across a switch; path equal to the lower timeframe; a stop in the rest taken once; a low before the moment never fills
an order placed at it; chains of switches; data holes; refusal; old sessions). Audit: 179 checks (the switch against candles
fetched apart from the page, forming candle, one step, Undo, split panes, reload, keys, play, the day candle, an old session,
the refusal, AA in three themes, phone).

Polish pass after the switch (11 Nov 2026, quality round: "not quantity but quality"). What the switch had left open, verified in a
browser and then put in the audit:
- **Forming candle during playback** (was: it completed in one piece at the end of its slot): with "Live candle" on it now grows
  over its slot by its real finer candles. `frame()` calls `step(false, k, keep)`: `k` finer candles go through `BT.advance`
  FIRST, then `BT.tfProgress(part, k)` folds them into the candle on screen and moves the moment to the end of the k-th, so the
  chart never holds a price the engine has not processed (the drawn-ahead `drawForming` path is only for an ordinary next candle,
  as before). Pausing in the middle leaves a valid forming candle at that later moment; one Undo takes the whole slot back;
  sessions save `pg` (the finer timeframe the rest runs on), so a reload in the middle changes nothing. "Live candle" off: one piece.
- **Stamps**: an order or manual close made while a candle forms is stamped `nowT()` = `BT.tfStamp` = the start of the last finer
  candle replayed (it was the forming candle's own start: a trade at 14:35 inside a day candle was journalled at 00:00, wrong hour,
  wrong session, possibly the wrong firm day). Without a forming candle the stamp is the last bar's start, as it always was.
- **Hold is time**: Statistics show "Avg hold" as `BT.durText(stats.holdAvgSec)` ("2 h 15 m"; `BT.holdSec` = close stamp minus
  open stamp, exact to one candle). No stored field changed: `holdBars` / `holdAvg` stay for old sessions and exports.
- **Name**: `sName()` = `BT.sessionName(name, sym, tf)` shows a name the page made itself ("XAU 15m from …") under the timeframe
  the session is on now (summary, saved-sessions list, report, export file, guide); a typed name is never touched and the
  stored name is never rewritten.
- **Jump / Skip day**: a jump to a time already replayed inside a forming candle is refused; both stop at the candle where a
  challenge ends (they ran one candle past it after a forming candle) and are no longer held to one candle at a time by a
  challenge that ended earlier (`chGo`).
- **Dropdowns open where there is room** (`placeDd`, a MutationObserver on `open` for every toolbar `details.dd`: class `up` /
  `down`, sideways clamp): with the toolbar under the chart the timeframe panel opened below the window. More measures its own
  sheet (`setMore`) instead of a fixed 260 px.
- **Phone toolbar** (touch and a chart card of 640 px or less; checked at 360 / 390 / 430): one row of 44 px controls: timeframe,
  undo, next, play, Skip day (back in the row), More. Speed (`.tb-spd2`, a second set of pills kept in step by value) and Jump
  (`#jump2` opens the same `#jumpdd` panel under the bar; no focus on touch, it threw the date picker up) are in More with Layers /
  Layout / Draw and View; a floating bar (grip 44 px) also sends Skip day into More (`#skipday2`). It was 30 × 32 px buttons,
  22 × 28 px speed pills, a More button cut to 16 px at 360 and a wrapped "Skip to the next day". A mouse on a narrow window keeps
  the 32 px layout of pass 11. Touch tablets (done 12 Nov 2026, section "Touch tablets and the challenge log" below): a coarse
  pointer gets 44 px toolbar controls at any width, and a touch chart card up to 860 px takes this phone row and More sheet.
- **A challenge across switches, proven** (tests "challenge across switches (1) (2) (3)", audit 32): (1) switching away and back
  between steps is field-for-field the session that never switched, through the breach; (2) steps on any timeframe, forming
  candles included, equal the engine fed each step's own interval once; (3) against a session that never left its timeframe, one
  that also stepped on finer candles agrees on balance, every exit and result, each firm day's start / low / end, the trailing
  floor, pass / fail, the rule and the candle of the breach. What may differ, by nature and not by error: bar counts, and the
  price a breach closes at (the close of the finer candle it happened in); a stop and a target inside one coarse candle is
  settled worst-case on the coarse candle and in true order on finer ones (kept out of comparison 3).
- Frame times (220 closed trades, journal open, 8 s of playback each, headless on a shared 4-core box under load, so noisy;
  before and after measured back to back, 2-3 runs): p50 16.7 ms at 1x and at 12x before and after; p95 33-50 → 17-33 ms at 1x,
  17 → 17 ms at 12x; with 4× CPU throttle p50 16.7 ms, p95 33-50 ms on both. No change beyond noise. The new path (a day candle
  growing from 5m candles with three extra panes): p50 16.7, p95 33 ms; 4× throttle p50 33 ms for that one slot.
  `window.ctAcct()` is the audit's read-only copy of the account and challenge.
- Audit: sections 31-33 (Jump / Skip day from a forming and from an animated candle, the growing candle frame by frame, docks, full
  screen, split panes across five switches, the two challenges against a reference in Node, phones at three widths). Since the merge with main the reference candles come through `fetchRetry` and sizes are read after `settle()` (`scripts/audit/shared.cjs`).

Simple phone view (11 Nov 2026, owner: "On the mobile there's too much, we need a simpler version for the phone"). Up to 640 px
ChronosTrade opens in its simple view: `html[data-phone="simple"]`, set by a head script before the first paint. **The key and
the switch are the Desk's**: localStorage `ms-phone` = `full` turns it off on that device (no key = simple), `window.msPhoneView(v)`,
event `ms:phone`, and "Phone view: Simple | Full" (`#ps-sw`) at the foot of the page, so one choice covers the site. Rules that hold:
- **Scoped.** Everything the view adds carries `.ps-only` (or is `.ps-sw`), hidden by default; every rule is inside ONE
  `@media (max-width: 640px)` block at the end of the sheet and starts with `html[data-phone="simple"]` (or is the switch). A
  wider screen and the Full view are the page as it was: checked box by box (every element's position and size at 390 Full,
  768 and 1440 px equal the build before; the only differences are two new ids and the switch under the page at 390).
- **What the phone shows**: the session as one line (`#sess.folded`: name, a thin progress bar, "Change session" opens the form;
  in the form Days, Session name and one hint sit behind "More options", `.ps-x`), then the chart with the replay row and quick
  Buy / Sell on it. The chart takes the height left (`calc(100dvh - 252px)`, 592 px on a 390 x 844 screen, was 439), one chart
  only: a split keeps its own heights. Under it one line, `#ps-last`: "Last trade ▲ +1.42R $1,405.66" and "Journal ›" (one tap:
  the Journal tab). Account, Trade and Challenge are one line each (`.ps-fold` buttons, `aria-controls` the card, which gets
  `data-ps-open`): equity and today; open / pending and the risk; the challenge's state in the card's own words. "How it works"
  shows only when Help opens it. The tabs are one row that scrolls inside itself; Journal and Statistics open on one headline
  ("12 trades, 67% won, +4.42R", `psHl`, from the numbers those tabs already computed, filters included and said), the journal
  with five rows of four columns (opened, side, R, net), Statistics with the equity curve; one button each (`.ps-all`) brings the
  rest (filters, every row and column; the tiles, seven charts, all numbers, Monte Carlo) and redraws charts at their real width.
  Calendar leads with the month's line; the Challenge log with the state in words and the day table behind its button.
- **Orders are untouched.** The view's code (`ps()`, `psHl()`, `psOpen()`, at the end of the script) only reads the account and
  writes text; it returns at once outside the view. Instant Buy / Sell, the on-chart draft readout, drag-to-place, the position
  tags and the stop rule are as they were. Because the draft's form (levels to type, the rules checklist that strict mode needs,
  tags, note) lives in the Trade card, the card opens by itself while a draft is up and folds again with it; "Go to the challenge
  card" opens that card first.
- **Split view on a phone**: left as it is (Layout under More, panes stacked). The quick switch between timeframes on one chart
  is the timeframe button already in the replay row; a second way to do the same would be more, not simpler.
- Measured at 390 x 844 (owner, 12 closed trades): page 2.7 → 1.9 screens (Statistics 4.7 → 2.0), controls on the page
  148 → 49, cards 6 → 3 (Statistics 18 → 4), chart 439 → 592 px. Frame times on the phone profile (220 trades, 8 s each,
  2 runs before and after): p50 16.7 ms and p95 16.7-16.8 ms at 1x and at 12x on both; with 4x CPU throttle p50 16.7 ms,
  p95 33-50 ms on both. No change beyond noise.
- Not done: the session form itself is still long on a first visit (the first-run card leads through it); touch tablets keep the
  full page (with 44 px toolbar controls since 12 Nov 2026). The challenge log's day table fits a phone since 12 Nov 2026 (next
  section), in Simple and Full alike. The audit's older phone checks now run
  in the simple view (the default) and all pass unchanged; Full is checked by section 34.
- Tests: `tests/backtest-phone.test.mjs` (key and attribute, every rule scoped, folds point at real cards, the code only reads,
  link colour AA on light). Audit: section 34 (first screen, one-line cards, a quick Buy keeps its stop, the result line against
  the account's numbers, Journal in one tap, headlines, draft opens the Trade card, AA in three themes, Full and back, reload,
  wider than 640 px): 241 checks.

Touch tablets and the challenge log (12 Nov 2026, quality round: the two items the phone passes left open; display only, no engine,
order, stop or account code touched).
- **44 px on touch at any width**: one `@media (pointer: coarse)` block with no container condition makes every replay toolbar
  control 44 px (`.tb .ib`, the dropdown summaries, the speed pills, the floating grip, dropdown items and the jump field); inside it,
  a touch chart card up to 1040 px drops the Layers / Layout / Draw labels to 44 px icons. The phone toolbar block now reads
  `@media (pointer: coarse) { @container cc (max-width: 860px)` (it was 640) and starts with a copy of the narrow card's More layout
  for touch cards of 641-860 px: one row (timeframe, undo, next, play, skip day, the time, More) and Speed, Jump, Chart tools and
  View in the More sheet. A mouse keeps pass 11 (32 px; More from 640 px of card). New touch rules go there, never into the simple
  view's block. Measured with touch emulation, before -> after: 768 x 1024 15 of 16 controls under 44 px -> 0 of 6 in the row and
  0 in the sheet (all 44 px, sheet on screen); 1024 x 1366 (and 1024 x 768, 1366 x 1024) 16 of 17 under 44 px -> 0 of 17 in one
  row, toolbar 958 px of 958, nothing past the card; a 44 px row without the change needed 752 px of 702 (768) and 969 of 958
  (1024). Mouse at 600 and 1440 px and the 390 px phone: unchanged.
- **The challenge log's day table** (`renderPF`): the table sits in `<div class="pflog-t" role="region" tabindex="0">`, which
  scrolls sideways inside the card (`overflow-x: auto`); the Day column stays at the left edge (`position: sticky`, card
  background) and money cells do not wrap; 12.5 px cells, 12 px heads (the page's generic `th` is 11 px). Written outside the
  simple view's block, so Full gets it too. Before: a 541 px table cut off by the card at 360 / 390 / 430 px in both views (up to
  267 px unreachable), 11 px heads; after: the box ends inside the card, scrolls 185-267 px, the day column at 0 px after a
  scroll, 12 px minimum, AA 5.76:1 or better in dark / light / midnight, no sideways page.
- Tests: `tests/backtest-phone.test.mjs` (two tests: the touch blocks, the mouse layout untouched, nothing in the simple view's
  block; the table's box), `tests/backtest.test.mjs` (the phone block's new heading). Audit: section 35 (768 x 1024 and
  1024 x 1366 touch, a 600 px mouse, the day table at 360 / 390 Full / 430): 247 checks.

Graphite look (16-17 Nov 2026, owner: a different, simpler look; spec `docs/design/aureum-theme.md`; display only, no engine,
order, stop, account or replay code touched). The `--au-*` tokens for dark (default), light and midnight are the first rules of
the sheet and the page's older names (`--bg`, `--panel`, `--ink*`, `--accent`, `--buy` / `--sell`, the `--c-*` chart tokens,
`--c-text` new, read by `readTheme` as the chart's text colour) point at them; candle colours are unchanged. Component rules
sit in one "Graphite look" block right before the simple view's block (never `data-phone` or `.ps-` in it: a test). Buy / Sell
fills are fixed `--fill-buy` / `--fill-sell` (white at 5.9 / 6.5:1 in every theme; the dark tokens are for text). The header
is the wordmark (silver mark `.brand i.ms-coin`, AUREUM DESK, then ChronosTrade); the session card is the page header; the
strip keeps "n% replayed" only (equity is the Account card's headline, its change since start is in `#acc-sub`, the time is
the toolbar's); the Trade card reads Sell | Buy like the quick bar; before a load the chart shows `#ch-empty` and the quick bar
is hidden (`.chartc.nodata`). The audit pins the body colours of the themes: dark rgb(18, 19, 21), midnight rgb(11, 12, 14).
Two audit checks failed from 16 Nov on dates near a weekend, the page was right: the gold quick start (now - 30 days) began on
Saturday, so the moment was Friday's 21:00 close and a 4h switch moves it to the end of that complete candle (no price in
between); and on a Friday's day candle (ends 24:00) a lower pane's last candle ends at the 22:00 close. Both checks now accept
that only when candles fetched apart from the page prove no price lies between (`shut`, `lowerOk`).

Trade coach (17 Nov 2026, owner: "Work on the ChronosTrade so while I backtest he understands what I'm doing"; then "the coach
must also read the drawings I make"). Deterministic, in the browser, no API call; display and record only: it never places,
changes or refuses an order and never moves a stop (a test reads its page helpers for any order call or `.stop =`).
- **Context at entry** `BT.coachCtx(bars, sec, T, o, prior)` (pure, `assets/backtest-engine.js`): only candles that ENDED by the
  moment T (`closedBy`: time + sec <= T; a forming candle is never read). Instant Buy / Sell and a confirmed market draft use
  `mom()`; a resting order that fills uses the start of the candle it filled in (`openedAt`). Stored on the position as `ctx`
  (closes and partial closes copy it; export / import carry it as part of the account): side, session (= `bySession`), ATR 14
  (the page's `atr`), stop in ATR (from the OPENING stop, `r0`), planned R:R, trend = EMA 20 vs 50 + EMA 20's 5-bar slope on the
  main timeframe and on H4, else H1, built from closed candles (`bucketBars`, 55 buckets needed, else the main timeframe is
  named), with / against / flat; yesterday's UTC range (position, distance to the high / low in ATR); a close through the last
  swing (3 bars a side) within 5 bars (`swingBreak`), with / against; the previous closed trade (result, run, minutes;
  `revenge` = a loss within `COACH.revengeMin` 30 min); risk set (%) and risked (%).
- **Drawings** `BT.coachDraw(draw, T, o, atr)`: new drawings carry `at: mom()` (the moment drawn); one with `at > T` is ignored,
  one without a stamp (older sessions, the Mosha hand-over) counts as drawn earlier. Price lines, box edges and a trend line's
  value at the entry time (`lineAt`: the straight line through its two [time, price] points, extended, no pixels) are levels:
  the nearest (ATR, above / below), "at your level" within `AT_LEVEL` 0.5 ATR, inside a box, the protecting level (at the entry
  or on its losing side) and whether the stop is beyond it, the next level ahead and whether the target is before it, the trend
  line's side and whether the trade respects it. Moving or adding a drawing later never rewrites a stored `ctx`.
- **The sentence** `BT.coachSentence(ctx)`: "Selling in Asia, against the 15m uptrend, 1 ATR stop, 2R target, 1.3 ATR over
  yesterday's low, 2 bars after a break up through the last swing high; selling at your drawn level 4,174.78 (0 ATR away), stop
  1 ATR above it." Shown on the draft readout (`#dchip .dsay`, cached by `draftSay`), under each journal row's levels
  (`small.say`; "No context recorded for this trade." otherwise), in the review dialog, and in the session report ("What the coach
  saw", last 40 trades, + the copy text). An older session's trades get their context once on resume when the loaded candles
  reach 60 bars before the entry (`coachBackfill`, marked `late`, "worked out after the trade from the same candles").
- **Behaviour** `BT.coachStop(p)` (called after a stop is dragged, typed or set to break-even; records only) keeps `stopAway`
  (the widest the risk ever grew, as a share of `r0`), `beMoved`, `stopLocked`. `BT.coachFlags(t, closed)`: stop moved away
  ("Moved my stop"), stop to break-even (no mistake), closed by hand in profit under 1R before the target ("Exited early"),
  opened within 30 min of a loss ("Revenge trade"), risked over 1.1x the risk % set ("Oversized"), entered over 1 ATR from every
  drawn level ("Against my plan"). They are SUGGESTIONS: the review dialog (`#mist-seen`) lists them and marks the matching
  boxes "suggested" with a "Tick the suggested mistakes" button; nothing is ticked or saved for the owner. The journal shows
  "n seen" beside "+ review" until the trade is reviewed.
- **"How you trade"** card (`#vc-coach`, Statistics, follows the journal filters through `jRecs()`): `BT.coachSplits(records)`
  splits the closed trades with `ctx` by trend, session, place in yesterday's range, stop size, after a loss, swing break, "Your
  levels" (at a drawn level / away) and "Stop and your levels" (behind a drawn level / not): n, win rate, mean R, t (mean against
  zero). A group under `COACH.minN` 20 reads "too few to judge", from 20 "your record, not a tested edge". The lead sentence names
  the largest difference in mean R (Welch t) only when both sides have 20 or more trades; trades without context are counted
  apart. Chips pick the split (localStorage `btLab:coachF`); bars from `BTR.hbars` with short labels (`CO_SHORT`). It is a plain
  half-width `.vc`, so the simple phone view keeps it behind "Show all statistics" like the other cards.
- Tests: `tests/backtest-coach.test.mjs` (10: no look-ahead by changing every price after the moment, the forming candle, the
  sentence, the flags, the splits' 20-trade rule, old sessions and JSON, drawings made after the entry, trend lines in time
  terms, page wiring, 12 px). Audit section 36 (a drawn level, the draft sentence naming it, ctx on every trade, the journal
  sentence, the dialog ticking nothing, the card's "too few to judge", AA in dark / light / midnight, nothing under 12 px;
  screenshots `coach-draft.png`, `coach-journal.png`, `coach-card.png`). `window.ctChart()` gained `pxY` (the last price's y,
  for the audit's drawing) and `coach` (the draft's sentence). Found on the way: two inline scripts of backtest.html share one
  global scope, so a top-level `const` named like one in another script fails at run time, not at parse (`stop0` exists already).

AI coach (17 Nov 2026, owner: the provider's API "in the edges and in ChronosTrade"). "Ask the coach" in the review dialog
(`#mistd`, box `#ai-tr`) and in the "How you trade" card (`#ai-ss`) sends one replayed trade, or the session's splits, to
`api/chronos-coach.js` (pure part `api/_chronos-coach.js`), which asks the shared language-model adapter. Display only: the
page block between `// ---- AI coach (17 Nov 2026)` and `// ---- end AI coach` reads the account and candles and writes text;
no order, stop or account code (a test reads it for order calls, `.stop =` and browser storage); answers live in memory for
the visit. Card label "AI coach · a language model's reading, not a tested edge"; off (no key, `CHRONOS_COACH=off`, no
storage, or GET failing) = the quiet line "The AI coach is off". Server rules (never trusts the page): POST only from the same
origin, a signed-in member, every field checked and capped (`buildRequest`: side, a finite OPENING stop on the losing side or
400, a known timeframe, strings trimmed, `ctx` cut to a fixed depth, flags / tags / mistakes capped); question `trade` = the
trade, the last 60 candles that ENDED by its entry (120 before 17 Nov 2026, "faster") and, for a closed trade (closedAt by the replay `moment`), the candles from
entry to exit; an OPEN trade carries no exit or result and no candle that ends after the moment (`cleanBars` drops them);
question `session` = `BT.coachSplits` output and the last 40 trades' sentence and R, no candles. System prompt: plain English
(French with `lang: 'fr'`, trading terms in English), every point tied to the given numbers, never a tested edge or a promise,
under 20 trades too small to judge, never removing or widening a stop. Answer `{ summary, points 1-6 (good|risk|habit|idea),
question }` checked in code (`parseAnswer` also refuses stop-widening / removing advice and "proven / tested edge",
"guaranteed" claims). Store `chronos-coach/answers.json` (+ the adapter's `cost.json`, `llm-cache.json`): an answered or
billed-and-refused question (hash of account + prompt) is answered from it, never paid twice; a budget skip or an unbilled
error is not stored. Limits: `CHRONOS_COACH_PER_DAY` 20 calls an account a UTC day (memory, per instance), budgets
`CHRONOS_LLM_DAILY_USD` 0.50 / `_MONTHLY_USD` 5 / `_HARD_USD` 25 / `_MAX_CALLS_DAY` 100 (30 before the live coach), output cap `CHRONOS_LLM_MAX_TOKENS`
4000; `CHRONOS_COACH=off` / `CHRONOS_LLM_STOP=1` stop it. Routed on the Worker (`HANDLERS['chronos-coach']`) and in
vercel.json `functions`. Tests: `tests/chronos-coach.test.mjs`; audit section 37 (the off state with the stubbed API).
**Faster (17 Nov 2026, owner: "he needs to be faster")**: answers are STREAMED. The adapter's `stream(req, d, onText)`
(`api/_academy-llm.js`, 'messages' format: `stream: true`, server-sent events; `text_delta` handed over, thinking / signature
deltas never; input usage from `message_start`, stop reason and output usage from `message_delta`, an `error` event = broke off)
keeps `complete()`'s rules: the same reservation and correction to reported usage, refusal and output cap (a cut answer is never
cached), an HTTP error before the stream is not billed; a stream that breaks off or times out after it started keeps its estimate
as billed (`unconfirmed`) and is never an answer (`partial` holds what came). The 'chat' format makes one ordinary call. The page
POSTs with `stream: true` and the endpoint answers `text/event-stream` (`data: {"t":"start"}`, `{"t":"text","d":…}` pieces, then
`{"t":"done", …}` = the CHECKED result; every early answer stays JSON); the Worker adapter (`cloudflare/src/adapter.mjs`, the
response starts with the first `res.write`) passes it through (test). The trade card shows the summary while the JSON is written.
`req.cacheSystem` sends the system text as one block with `cache_control` (a text under the provider's minimum cacheable length is
simply not cached). Prompts are smaller (60 candles before the entry, at most 120 after). The coach's own settings, read by
`llmEnv` only for this feature: `CHRONOS_LLM_MODEL` (the provider's model id for the coach, else `ACADEMY_LLM_MODEL`),
`CHRONOS_LLM_BODY` (JSON body fields, else `ACADEMY_LLM_BODY`; on the 'messages' format `output_config.effort: 'low'` is added
unless one of the two names an effort), `CHRONOS_LLM_USD_PER_MTOK_IN` / `_OUT` / `_CACHE_READ` / `_CACHE_WRITE`. A provider that
refuses the request (a 4xx, e.g. an effort or model id it does not take) is said in words with the variables to check. Each call
that reaches the model stores `ms { first, total }` (time to the first text, in all) on its row and `lastMs` in answers.json /
live.json; GET returns `lastMs`.
**Live coach (17 Nov 2026, owner: "I want him to be live while I backtest, him watching the screen and trades live")**: a "Live
coach" toggle under the AI coach line in the Trade card (`#lc-on`, made by the page script; off by default; localStorage
`btLab:liveCoach`, a display preference, the one storage key of its block; the Trade card is the dock in full screen) shows a docked
panel `#lc` (`aside.lc`, appended to `.chartc`, over the price pane's lower left, placed from `#chart`'s box since `#panes` is
`display: contents` with one chart; clear of the quick bar; collapsible; newest first; at most 60 notes in memory for the session
view). Page block `// ---- Live coach (17 Nov 2026` … `// ---- end Live coach` (after the AI coach's), CSS `/* Live coach (17 Nov
2026)` … `/* end Live coach */`, phone strip rules in the simple view's block (a one-line strip above the chart and its quick bar,
`order: -1`, the chart 52 px shorter, a tap opens the list; it starts folded there). DISPLAY ONLY (a test reads the block for order
calls, `.stop =`, `BT.coachStop`, `save()` and every storage key). A 300 ms watcher compares the account with its last look: (a)
FREE notes, no API call: an entry (`coachSay`: the trade coach's sentence), a draft that stood still 1.2 s (`draftSay`), a stop
moved (break-even, away from the entry with the risk growth, profit locked, trailing on; a trailing stop's own moves are not
noted), a part close, an exit with its R and `BT.coachFlags`, the challenge's state and its daily / max loss buffers under 30 %; a
new session or an undo re-baselines without notes. (b) AI comments (kind `live`, `trigger` open / close / ask) at an entry, at an
exit and on "What do you see?": the chart at `mom()` (the last 60 candles that ENDED by it; `livePayload` drops any candle,
position or trade after the moment again), positions with the OPENING stop (a losing-side stop or 400) and floating R, the draft,
`BT.coachDraw` against the price, the last 10 closed trades' R / sentence / flags and the splits' lead; 2-4 plain sentences
streamed into the note (`liveSystem`: calm coach, the trader's own context, at most one question, no forecast as fact, no promise,
under 20 trades too small); `parseLive` refuses stop removing / widening advice, "proven / tested edge" / "guaranteed" and a
forecast stated as fact ("price will fall"), and the note becomes "Withdrawn: the answer broke the coach's rules." (stored
refused in live.json, never asked again). Limits: one live call in flight and one per `CHRONOS_LIVE_GAP_S` 8 s (page and server,
the page reads it from GET; events in between get their free note only), `CHRONOS_LIVE_PER_DAY` 150 an account a UTC day (its own
counter, memory, per instance; the adapter's USD budgets stay the hard stop: the panel then says "Coach resting: daily budget
reached" and keeps the free notes), output cap `CHRONOS_LIVE_MAX_TOKENS` 1500.
**More live (17 Nov 2026, owner: "the live AI while backtesting needs to be more live")**: market events while the replay plays,
`BT.liveEvents(bars, sec, T, st, o)` (pure, `assets/backtest-engine.js`; only candles CLOSED by `T`, at most the last 3 since the
last look, each event once, `t` = its candle's close): a drawn line / ray / box edge / trend line (`lineAt`) closed through (imp 3)
or touched (2), a close within 0.25R of a position's stop (3) or target (2) (again after 0.5R away), a close through the last swing
(the coach's swing rule, 3 a side) (2), Asia / London / New York opening (1), a candle over 2x ATR(14) (2), floating R crossing
+1R (3) / -0.5R (2), an order set up and not placed for 5 candles (1). Each is a free one-line note at once (`mk`, `mk hi`). With
"Comment on market events" (`#lc-talk`, on by default, memory only) the most important one waits as the one pending event
(replaced by a more important or newer one): it reaches the AI (trigger `event`, `{ kind, text, at }`) when no call is in flight
and the gap has passed; only importance 2+ at 1x / 2x, 3 from 5x; dropped when it is more than 10 candles before the replay moment
(the server refuses such an event, or one after the moment, with 400; known kinds only). The panel: newest note on top with a
150 ms fade (`lc-in`, none under reduced motion), each note's candle time, a still dot and "Watching the replay" while it plays
(three pulses, never infinite), "n AI comments left today" (`liveLeftToday` from GET, `liveLeft` on each live answer), "typing…"
until the first words. Docked at the chart's lower right (clear of the drawing tool strip on the left, the quick bar and the price
scale), its height capped to the chart; on the phone strip the quick bar follows the chart down (`overlay()`). Playback never waits; "Pause the replay while the coach answers" (memory
only, off) presses the play control and presses it again after. Tests: `tests/llm-stream.test.mjs` (4), `tests/chronos-live.test.mjs`
(11); audit section 39 (toggle, panel off the quick bar, notes on entry / exit / draft / market events with the AI off, the AI on with
a stubbed stream and a withdrawn answer, the gap, commentary on a market event, the watching dot, AA in three themes, phone strip).

Coach reads the chart as an edge (17 Nov 2026, owner: "the coach — I can choose the edge and he will view the market as the
edge"). Display and record only: nothing places, changes or refuses an order or moves a stop. "Read the chart as" (`#ln-edge` in
the Trade card under the live coach toggle, `#lc-lens` in the live panel, kept in step; localStorage `btLab:lens`, a display
preference) picks None | Gold trend | Gold daily engulf | Mosha cycle | ICT (iFVG A-setup) | MSNR direction | LIT.
- **`assets/coach-lens.js`** (`window.CL`, `module.exports`): its GENERATED block is a verbatim copy, written by
  `node scripts/coach-lens-gen.mjs`, of the rules the council and the desk run (council/fills.mjs `foldWeekend` / `gegFresh` /
  `spotClosed`, council/engine.mjs `msAnalyze`, council/mosha-cycle.mjs, ict/tracker.mjs `signals` / `isASetup` / `dailyNY` with
  council/events.mjs's NFP times written out, council/lit.mjs `detect`, research/edge/msnr-direction `calls`); the browser cannot load
  council/ or ict/. **After a change to any of those files run the generator** (`tests/coach-lens.test.mjs` fails until the copy is
  byte for byte the source). `CL.read(edge, data, T, { price, sym, dec })` reads ONLY candles closed by the replay moment T and
  returns `{ state, text, marks, signal, dir, notes, record }`; a signal's stop is always on the losing side or it is dropped. Gold
  trend and Gold daily engulf use the Trader's own blocks' values (gtrend n 20 / k 2 on the 719 closed raw UTC days; geg on trading
  days); Mosha cycle the Trader's 719 closed bars a timeframe, N 6; ICT OANDA mid H1 with the 17:00 New York hour dropped and D1 =
  `dailyNY` (as the desk's lab; gold rule on xau, index rule on nas100 / spx500 / us30 / us2000); MSNR ladder L1 on the last 720 H4;
  LIT the 4,000 closed M5 of the stream. What a lens adds is said in its text: Gold trend's own position (bought at the next day's
  open, no intraday re-entry), the engulf zones' fill / fail / expiry (its 3-order cap not counted), LIT's resting order (the stream's
  daily gates not applied). **Left out on purpose: H4 trendline and NQ open run** (their rules read the Trader's own state inside
  council/trader.mjs and could not be copied faithfully; no approximation is offered as the edge).
- **Record line** under each reading, from the studies (test against result.json): Gold trend +0.313R a position (n 74, t 1.20) and
  the engulf +0.141R (n 256, t 1.46), supported-book untouched 2006-17, not proven; Mosha cycle −0.175R (n 244, t −1.50, FAIL);
  ICT A-setups −0.013R (n 2,235, t −0.45, ict-oos-2008 FAILS); MSNR 0 of 6 (best t 1.35); LIT INCONCLUSIVE. Then "A reading by this
  edge's rules, not advice."
- **Page block** `// ---- coach lens (17 Nov 2026` … `// ---- end coach lens` (before the simple view's block, never in it), CSS
  `/* coach lens (17 Nov 2026)` … `/* end coach lens */`: candles fetched per edge timeframe for the session's market from `CL.warm`
  before its first candle (`fetchBars`), a reading every 400 ms when the moment or price moved, the marks on the overlay (`lnDraw`,
  Layers "Edge lens", `LAY.lens`), `ctx.lens = { edge, name, state, agree: with | against | none, signal }` on every entry and draft
  (`coachAt`, `draftSay`); the coach's sentence adds "by <edge> rules: …" (engine `lensSay`) and "How you trade" splits "The edge you
  read with" (`COACH_F` lens, 20-trade rule). A new fact of the reading (a signal, an order, a zone filled or failed, a stage, the
  rule's stop moving) is a free note in the live panel (kind `lens`). The AI coach's trade, session and live questions carry
  `lens: { edge, state, signal }`; `api/_chronos-coach.js` `cleanLens` whitelists the edge, caps the state at 200 characters, drops a
  signal without a stop on the losing side and takes the rules and the record from its OWN table `LENS` (equal to the asset's, a test),
  and the system text then asks the model to answer as a trader of that edge, never calling it proven beyond its record (every other
  rule unchanged). `window.ctLens()` is the audit's read-only view (`same`: the reading equals one made from candles cut at the moment).
- Tests: `tests/coach-lens.test.mjs` (14: the copy, parity with the Trader's lifted gtrend / geg blocks, cycleTrades on the Trader's
  events, ict signals and the A-setup verdict, LIT `detect` and `litStep`'s order, MSNR `calls`, no look-ahead, stops, records, the
  server); audit section 41 (each edge on live candles, marks and Layers, draft sentence, ctx.lens, live notes, the AI's lens, AA in
  three themes, 12 px, 44 px on touch; screenshots `lens-chart.png`, `lens-draft.png`, `lens-live.png`, `lens-card.png`).

Chart right-click menu (17 Nov 2026, owner: "when I press right click … reset chart view, delete all drawings"): `.cmenu`
(`#cmenu`, between `// ---- chart right-click menu` and `// ---- end chart right-click menu` in backtest.html): Reset chart view
(price autoscale on, time scale reset, back to the latest candle), Delete this drawing (the one under the pointer is selected first;
locked ones refused), Remove the last drawing (skips locked), Delete all drawings (styled confirm). With a drawing tool on, a
right-click cancels the tool. Display only: no order, position or stop is touched. `window.ctMenu()` is the read-only view.

Drawing tools like TradingView (17 Nov 2026, owner: "the backtest drawings need to be like TradingView: the boxes, lines, trend
line, magnet, resize box and lines"). Display only: a drawing never places, changes or refuses an order and never moves a stop
(a test reads the page block `// ---- drawing tools like TradingView` for order calls, `.stop =` and `S.acct`).
- **Tools** (main chart only; split panes never draw): cursor, trend line `t`, horizontal line `h`, horizontal ray `hr`,
  vertical line `v`, box `r`. In the Draw menu (`#drawdd`, also in More on a phone) and a vertical strip `#dstrip` on the chart's
  left edge (shown on a chart card over 640 px, over 860 px on touch; the position tags `#ptags` and the draft readout `#dchip`
  move right by its width, `OG.sw`). Keys: **Alt+T** trend line, **Alt+H** horizontal line, **Alt+J** horizontal ray,
  **Alt+V** vertical line, **Alt+R** box, **Alt+M** magnet (read from `e.code`, so a Mac's Option letters work); H / T / R alone
  still pick a tool (T also teaches the Mosha desk for a teacher, as before); Delete / Backspace removes the selected drawing,
  Esc lets go (or puts back a drag in progress). All listed in Help (`#hk`).
- **Placing**: click, click, or press and drag (touch: press-drag or tap, tap); one click for h / hr / v. A new shape is selected.
  The drawing layer takes the press (`dStart`, a capture listener on `#chart`), so the chart does not pan; Shift+drag and the
  quick bar's drag button still place orders (they are checked first), and a trade's line under the pointer wins over a
  drawing's body (a selected drawing's handle wins over it).
- **Magnet** (`btLab:magnet`, per device: off / weak / strong): `BT.drawSnap` puts a point on the open / high / low / close of the
  REPLAYED candle under it (`barAt`: never past the replay moment), nearest in pixels; weak within 12 px, strong always. It acts
  when placing, resizing, moving (the first point snaps, the rest moves by the same change) and dragging a horizontal line. With
  a tool on, a ring shows where the click will land.
- **Editing**: a click selects (`pickDraw`: the selected one first, then the newest; handles 7 px, 22 px on touch). Handles:
  a line's ends, a ray's start, a box's four corners (both coordinates) and four edge midpoints (one coordinate); the body moves
  the whole shape through pixels (`BT.drawMove` with `timeToX` / `xToTime`, so a move keeps its shape across weekend gaps).
  A horizontal line stays a price line (axis label) and drags as before; its release selects it (`hDone`). Cursors name the
  action (`#chart[data-dcur]`). Floating bar `#dsel` above the selected drawing: five colours from tokens (`col`: draw / up /
  dn / gold / ink, read from `CT` per theme), width 1-3 px (`w`), dashed (`ls`), extend right (`ext`, trend line), label (`lbl`,
  trend line and box: price change, %, bars by `BT.barsBetween`, and the angle on screen; off by default), lock (`lock`: no
  move, resize or delete until unlocked), clone, delete. 44 px on touch; 12 px text.
- **Stored shape**: `S.draw` as before, points [time, price]; `BT.drawNorm` checks every shape on resume (old h / t / r and the
  Mosha hand-over load unchanged; unknown fields and bad values dropped). `at` = the moment drawn, set only for a new shape or a
  clone; a geometry edit stamps `editedAt` and keeps `at`; the trade coach still reads `at` only (`coachDraw` now also counts a
  horizontal ray as a level; a vertical line is no level).
- Pure helpers on `BT`: `drawNorm`, `drawSnap`, `drawGeom`, `drawHit`, `drawResize`, `drawMove`, `barsBetween`, `drawInfo`.
  `window.ctDraw()` / `window.ctBarAt(t)` are the audit's read-only views. Tests: `tests/backtest-draw.test.mjs`; audit section
  38 (strip, Alt+M, a box drawn with the magnet strong has both corners on candle O / H / L / C, corner resize, trend-line move,
  colour and width, Delete, Alt+V / Alt+J, the account untouched, a reload keeps them and loads an old-format drawing;
  screenshots `draw-strip.png`, `draw-selected.png`, `draw-magnet.png`).
Split charts move together and share drawings (17 Nov 2026, owner: "on charts all should be synced moving same time and when I
draw in one should show on the others"). Display only: nothing here places, changes or refuses an order or moves a stop (a test
reads the block `// ---- split charts move together and share drawings` for order calls, `.stop =` and `S.acct`).
- **Time sync** (Layout menu `#splitdd` → "Sync charts" `[data-xsync]`, on by default, localStorage `btLab:splitSync` = '0' when
  off, a display preference). Panning or zooming ANY chart (main or pane) sets every other chart's visible LOGICAL range to the
  same TIME window: `BT.syncRange` maps a range through each chart's own shown candles (`BT.tfLogical` / `BT.tfTimeAt`: a
  candle's start at its index, inside a candle in proportion, a weekend at the next candle, before the first / past the last one
  index a timeframe step, so the right margin stays a margin). No echo loop: only the LEADER's range changes move the others
  (`xsLead`: the chart a person presses, touches or wheels, while the press lasts and 1.5 s after for the chart's own glide
  (0.6 s after a wheel), else the first chart); a range just set (`BT.syncEcho`, 400 ms, 0.02 bar) or within 60 ms (`lock`) is
  not a change either; `XSING` guards re-entry. (A guard on the echo alone let the 5m pane lag the first chart by up to a
  candle in the browser: the leader rule fixed it.) The replay's own scroll of the first chart carries the panes; a pane's
  redraw (`xpDraw`) locks itself out for 80 ms and then takes the first chart's window again (`xsFrom(MCX, P.dc)`), so its
  auto-scroll never drags the others. While the replay plays, a pane follows the first chart (panning a pane then is undone
  by the next candle). A pane still
  shows no candle past the moment (sync only moves the view). Lower-timeframe panes now hold 6,000 shown candles (`XSHOW * 12`,
  was 1,000) and panes allow `minBarSpacing: 0.05`, so a 1m pane can show a 15m chart's whole window. The crosshair sync stays.
- **Drawings on every pane**: each pane has its own overlay canvas (`.xpov` inside `.xp`) drawn by `xpOvAll()` at the end of
  `drawOverlay` through the SAME `drawShapes(x, c, W, PH, main)` as the first chart (the old loop moved into it), with that
  pane's mapping; on a pane a horizontal line is drawn on the canvas with its price pill. `scaleWatch` also keys on each pane's
  price scale and range (`xpScaleKey`), so a pane's axis drag, zoom or auto-fit redraws it; a pane resize too.
- **Draw on any pane**: one drawing context per chart (`MCX` for the first chart, `P.dc = xpCx(P)` per pane: `chart`, `series`,
  `host`, `tX` / `xT` through the pane's candles, `bar` = the magnet candle `BT.closedBarAt`, closed by the moment on that
  pane's own timeframe, `view`). `DCX` = the chart a gesture is on (`useCx` on a press, `onCx` on a move; a two-click tool
  started on another chart starts again; nothing switches mid-drag); `paneH`, `Ypx`, `snapP`, `ptAt`, `geo`, `pickDraw`,
  `locOf`, `hitShape`, `dStart` / `dMove` / `dEnd` take the context. Every tool, Alt+T / H / J / V / R, the magnet, select, move,
  resize (a pane's horizontal line drags as a shape), Delete, the `#dsel` bar (placed over the chart where the selection was
  made: `SELC`) and the right-click menu (`CMC`: Reset also fits that pane's price) work on a pane; the result goes into the one
  `S.draw` (with `at` = the moment), so it shows on every chart at once. Selection and hover are shared across charts; the
  preview and the magnet ring show on the chart the gesture is on. Orders, drafts, order lines and the edge lens stay on the
  first chart; `ctDraw().geo` is still the first chart's geometry. Closing a pane ends a gesture or selection made on it (`xpGone`).
- Pure helpers on `BT`: `tfLogical`, `tfTimeAt`, `syncRange`, `syncEcho`, `closedBarAt`. `ctSplit()` adds `sync`, `range` (the
  first chart's window in times) and per pane `range`, `draw` (the geometry drawn there) and `host`; `window.ctPaneXY(i, t, p)` =
  where the chart library puts a time and price on chart i (-1 = the first). Tests: `tests/backtest-split-sync.test.mjs`; audit
  section 40 (15m + 5m + 1m: windows match, pan main and a pane, wheel zoom, a box and a trend line drawn on the main chart sit on
  both panes within 1 px of `timeToCoordinate` / `priceToCoordinate`, a pane's price-axis drag, a box drawn on a pane lands in
  `S.draw` and on the first chart, moved and deleted there, the account untouched, the replay steps on, Sync off and on;
  screenshots `split-sync-drawings.png`, `split-three-charts.png`). The audit's session is 8 days (a 1m pane refuses over 40,000
  candles; the 30-day quick start is too long for it). Its Layout note is hidden on a phone's More sheet (`@container cc (max-width:
  640px)`), so the menu with Sync still opens on the screen at 360-430 px. Run with `MD_ORIGIN=https://aureumdesk.co.uk` while the
  workers.dev origin answers "OANDA_TOKEN not set" (17 Nov 2026).

## ChronosTrade design pass (20 Nov 2026, the newer panels against the older ones)
Display only, `backtest.html`: no engine, order, stop, account or replay code changed. Found on screenshots at 1440, 768 (touch) and
390 px (touch, Simple and Full) in dark / light / midnight with a script that lists text under 12 px, touch targets under 44 px,
text under AA and boxes past the screen. One CSS block `/* Design pass (20 Nov 2026)` … `/* end Design pass (20 Nov 2026) */`
(after the right-click menu's rules, before the simple view's block; it never names `data-phone` or `.ps-`), three rules in the
simple view's block, and two display lines of script. What was wrong, and the rule that keeps it right:
- **The open-trades strip covered the quick Buy / Sell bar's prices** (and the toolbar once the live coach strip was on, and the
  legend on a phone): it had a fixed `top` while the bar is placed by `drawOverlay`. That statement now also sets `--qt` on
  `.chartc`; `.qpos { top: calc(var(--qt) + var(--qh)) }` (`--qh` = the bar's height + 5 px per pointer, `--qp` = the strip's).
  **Never give `.qpos` a fixed top.** The legend ends before the bar from 701 px (it ran under it on a tablet; O / H / L go
  under 830 px of card) and drops under the strip on a phone while a trade is open.
- **Session plan**: three columns ran into each other in the Trade card; one row a limit (label, 96 px field).
- **"Debrief" was a bare browser button** (`.lnk` had a style only inside `.qdef` and `.rules`): `.cr-score .lnk`. A new text
  button needs its parent's `.lnk` rule (the test lists them).
- **Dialogs**: `.hkd { max-width: 460px }` capped the report (760), debrief (640), battle (640) and teach (620) dialogs, so the
  report cut "Max drawdown" short: each now sets its own `max-width`. Help ran 70 px past a phone's right edge with Close out of
  reach: up to 520 px a `dialog.hkd` fits the screen and scrolls, and Help's keys stack in two columns. Actions keep an 8 px gap.
  The battle dialog's Join is primary only once a code is typed (one primary a view).
- **Full screen**: the live coach sat under the trade dock; from 701 px it stands at the lower left. A floating toolbar starts
  clear of the legend and the drawing strip (default x 72 with the strip, y chart + 64; a saved position is untouched).
- **Toasts** covered Sell / Buy of the Trade card at the bottom right: bottom centre from 761 px, `pointer-events: none`
  (phones keep their one line over the header).
- **Phone session line** (simple view): the title ran under the Battle button; it ends in an ellipsis and Battle is its icon (the
  word stays in the button for assistive technology).
- **Tokens and sizes**: the lens box is a well (`--au-well`; it was a dark slab in light); `<small>` in the position card, the
  report head, the draft's fold and the heat-map legend was 10-11.7 px (12 now); key hints on Sell / Buy and Cancel at AA; the
  risk field is level with Sell / Buy; the report head's rule is a hairline.
- **Touch**: one `(pointer: coarse)` block gives 44 px to what the earlier passes missed: the draft form, risk chips, position
  card, challenge card, journal filters / cells / sort heads, statistics chips and Monte Carlo fields, calendar arrows, export
  buttons, every dialog button, tabs, the on-chart draft and position tags, the quick bar on a tablet, fold headings, the
  header's Desk link. Left: the header switch (28 px high; the dots' width budget on a phone).
- Audit note: an element or `fullPage` screenshot drops Playwright's touch emulation (`pointer: coarse` turns fine), so a touch
  run takes viewport screenshots only. Tests: `tests/backtest-design-pass.test.mjs` (10).

## ChronosTrade battles, seconds charts, compact order bar (18 Nov 2026, owner: "make it more professional and easier … add 30s chart and 15s chart … allow battle with someone … max 4 people … live same chart … see the % profit"; then "the user can invite and the other player can accept")
Paper only: no order, broker, council or ICT file is touched; no stop is ever moved further away.
- **15 s and 30 s charts**: `api/bars.js` `TF` `15s` / `30s` (OANDA `S15` / `S30`), page `TFS` / `XLBL` / `XNAME` and the session form (a "Seconds" group), `BT.TF_SECS` starts at 15 (a 1m candle cut at :30 forms from 30 s candles; nothing finer than 15 s). A seconds session loads at most `DAYMAX` 2 days (15 s) / 4 days (30 s). Tests: `tests/oanda-symbols.test.mjs`, `tests/backtest.test.mjs` ("seconds charts").
- **Order bar**: the quick bar's risk is a button stepping 0.25 / 0.5 / 1 / 2 % (`qRisk`, right-click back; writes `#o-risk`); a strip `#qpos` under it while trades are open: count, floating R, **BE all** (`beAll`: stop to entry only on a trade in profit whose stop is still behind the entry, so it only tightens) and **Close all** (`closeAll`, confirms for 2+). Keys **E** / **X**; in Help. Compact 36 px buttons with a mouse, 44 px on touch.
- **Battles**: a room per 6-character code (`api/_battle.js` `ALPHA`, no 0 / O / 1 / I / L) in a Durable Object (`cloudflare/src/worker.mjs` `BattleRoom`, binding `BATTLE`, migration `battle-v1` `new_sqlite_classes`; logic pure in `cloudflare/src/battle-room.mjs` `Room`). `/api/battle` (Vercel shape, signed in, same origin, 30 calls / 10 min per account) hands out a two-minute ticket signed with a key derived from the session key and its own label (`aureum/battle/v1`): never a session, and a session never a ticket. `/api/battle-ws?t=` (Worker, same origin, ticket checked BEFORE the room) opens the socket. Up to `MAX` 4 players, one socket per account (a second tab replaces the first), rooms take no one new after 6 h or once ended. The **host** (first account in) sends `setup` (market, timeframe, exact `from` / `to`, start, balance, costs), `go` (the moment), `clock` (replay moment T, never backwards, held inside the window) and `end`; players send `stat` (% of the start with floating, trades, wins, open; clamped, 4 a second at most) and `chat` (140 plain characters, paced). Page block `// ---- Battle (18 Nov 2026` … `// ---- end Battle` (before the simple view's block; CSS `/* Battle (18 Nov 2026)` … `/* end Battle */`): every player loads the host's window with `loadSession` (the Load button's body, now a function) and follows the host's moment with `step(true)` (each candle through their own engine once), so nobody sees ahead; a player who comes back gets their own saved battle session (name `Battle <code> · …`) by `resume`. In a battle Undo, the timeframe switch, Load / Resume / New and quick starts are off for everyone, and a guest's replay controls follow the host (capture-phase locks, `btWhy` says why). Standings card `#btb` (side column: rank, % bar, trades, win %, open, last trade, reactions, chat), rank pill `#bt-pill` in the price pane, 3-2-1 countdown, final podium. `window.ctBattle()` is the read-only view.
- **Invites**: `/api/battle { box: true }` gives a box ticket (`kind: 'box'`, never opens a room) and the other members (key and name only); `/api/battle-inbox` (Worker, same origin, box ticket) talks to one `Inbox` (`idFromName('__inbox__')`, memory only): `invite` (room code, up to 3 keys, 20 a sender per 10 min), `list` (my open invites + replies to my invites, each reply once), `answer` (accept / decline once; the inviter is told). Invites last 15 min. The ChronosTrade page reads its inbox every 6 s while visible and shows a card with Accept and join / Decline (`btCard`); the room dialog lists members to invite (`btInviteList`). Invites show on ChronosTrade only, not on the Desk.
- Tests: `tests/battle-room.test.mjs` (tickets, door, room rules, inbox, wiring). Checked end to end with `wrangler dev` (Durable Object local) and five browsers: invite accepted / declined, four seats and a fifth refused, every page on the host's exact window and moment through steps and 12x play, Undo locked, standings and chat, a reload that keeps its trades, final standings. Not checked live: the Durable Object on Cloudflare (it ships with the next `cloudflare-deploy.yml` run).

## ChronosTrade's chart tools on the Desk's Charts (18 Nov 2026, owner: "chart should have the same chronotrades charts features all of them")
Display only: no drawing, layout or chart change places, changes or cancels a trade or moves a stop (a test reads the asset).
- **Drawing tools** `assets/ms-draw.js` (loaded with `defer` after `assets/backtest-engine.js`, whose pure helpers it uses: `drawNorm`,
  `drawGeom`, `drawHit`, `drawSnap`, `drawResize`, `drawMove`, `drawInfo`, `tfLogical` / `tfTimeAt`, `closedBarAt`). Strip `#ms-dr-bar` in
  the charts toolbar: cursor, trend line, horizontal line, horizontal ray, vertical line, box, magnet (off / weak / strong,
  localStorage `ms-dr-mag`); Alt+T / H / J / V / R / M (by `e.code`), Delete removes the selected drawing, Esc lets go. Select, move,
  resize by handles; style bar `#ms-dsel` (five colours, 1-3 px, dashed, extend, label, lock, clone, delete) over the chart it was
  selected on. Shapes are ChronosTrade's, per market in this browser (localStorage `ms-dr-<market>`, times in UTC; a chart adds its
  `TZ`). Every chart the page registers (`window.msCharts.add(cx)`: the six panes and Split's free chart) of the same market shows them.
  The chart library places whole indexes only (a fractional one comes back as 0), so a time inside a candle is placed between its
  neighbours (`l2x` / `x2l`). The Desk's older tools (`.ch-hl`, `.ch-tl`, Fibonacci, position, ruler; keys without Alt) are unchanged.
- **Line alerts** (19 Nov 2026, the price alerts went on 17 Nov): the style bar's "Alert" on a horizontal line, ray or trend line
  (`d.alert`, kept by `BT.drawNorm` with `fired`) draws an "Alert" tag on it; `alertCheck` (every 1.5 s, the last close of the first
  chart of each market) fires once when the price crosses it (a ray from its start, a trend line within its span or extended):
  a 12 s toast in `#ms-toasts`, a browser notification when allowed (asked on the first switch-on), then `alert` is removed and
  `fired` stamped. Only while the page is open; nothing is sent anywhere. `window.msLineAlerts()` is the read-only view.
- **Right-click on any chart** (`#ms-cmenu`): Reset chart view, Delete this drawing, Remove the last drawing, Delete all drawings
  (styled confirm; locked ones stay). With a tool on, a right-click cancels it.
- **Layout** (`data-view="lay"`, button `#ms-lay-btn`, popover `#ms-lay-pop`, localStorage `ms-lay4` `{ n, tfs, sync }`, `msLayNorm`):
  1-4 of the six analysed panes side by side (3 = a big chart and two stacked), each timeframe once; with Sync on, the chart a person
  presses or wheels leads and every other one takes the same TIME window (`BT.syncRange`, echo guard `BT.syncEcho`, re-synced after
  the candles arrive). `window.msLay()` is the read-only view. Guests do not get it (their view stays `all`).
- **15 s / 30 s**: `SEC_TFS` on Split's right chart only (`SPTFS` for every lookup of the free chart), from the OANDA proxy; an exchange
  market has none. The six panes keep D1-M1 (each runs the Meridian analysis).
- Simple phone view: the strip waits behind More with the other tools. Tests: `tests/desk-draw.test.mjs`, `tests/qa-sweep.test.mjs`.
  Checked in a browser (local build, live candles): the strip on six panes, a three-chart layout moving together, a box drawn on H1
  at the same time on H4 and M15, style bar, Alt keys, Delete, the menu, a reload keeping drawings and layout, a 15 s Split chart.

## Any timeframe on the Desk's Charts, and a quieter toolbar (19 Nov 2026, owner: "remove whats in red and give the option to change to any timeframe starting from seconds … grouped in seconds, minutes, hours, days, week, monthly, year")
Display only, `market-structure.html` + `api/bars.js`. Each chart's header button (`.ph-tf`, `#ms-ph-menu`) lists `TF_GROUPS`:
Seconds S5 S10 S15 S30, Minutes M1 M2 M5 M10 M15 M30, Hours H1 H2 H3 H4 H6 H8 H12, Days D1, Week W1, Month MN, Year Y1 (`window.msTfGroups()`;
underlined = an analysed pane with the Meridian / ICT markup). An analysed timeframe opens its pane as before (in Layout: that slot
only); any other opens the view `one` = Split's free chart alone, full width, no sync (`SP.solo`, `SP.one`, localStorage `ms-one-tf`,
`window.msOneTf(t)` / `msOneState()`); on Split's right chart it sets that chart. `api/bars.js` `TF` gained `5s` `10s` `3h` `6h` `8h`
`12h` `1M` (OANDA S5 S10 H3 H6 H8 H12 M); a year (`1Y`) is built in the page from monthly candles (`yearOf`, UTC years, `spFetch`).
The free chart polls each timeframe at its own pace (`XTF` `poll`, 3-15 s) and shows seconds on the time axis under a minute. The
toolbar no longer shows D1-M1 / All (the hidden buttons stay: keys 1-6 / 0 and the menu's "All timeframes" use them) nor Meridian /
ICT: the markup switch is in Style (`.mk-mode.mk-in-sty`), the toolbar's Clean is a toggle back to the last markup (`G.lastMk`).
Test: `tests/desk-draw.test.mjs`. Crypto markets have no OANDA candles, so their seconds / H3 / month charts may say "no data".

## Charts: market on the toolbar, no price chips, more forex pairs (19 Nov 2026, owner's marked screenshot: "remove purple, move red, add more fx pairs the most used")
Display only, `market-structure.html`. On Charts (members) the price chips `#ms-wl` and the header's market picker summary are hidden
(desktop too; the sidebar carries the mark from 1180 px); a market button `#ms-ch-mk` before Split opens the header's own market list
under itself (`openMarket`, the list positioned fixed; phones keep each chart's own market button). `INSTRUMENTS` gained NZD/USD and
the crosses EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, EUR/CHF, EUR/AUD (OANDA only). A cross has `size: 'cross'` and `quote: [pair, +1 | -1]`:
its lot size goes through the quote currency's USD rate from the shared quotes (`window.msQuoteUsd`), on the setup card and in the
paper account (whose engine units are dollars a price unit). The early Home market skeleton draws 17 cards. ChronosTrade, same day:
at 5x and 12x a committed candle reaches the split panes one pane a frame (`XQ`, `xpQueue`), and `xpLive` skips a pane still queued.
**Markets side by side** (same day, owner: "they should be able to see different pairs at the same time, different charts"): the
view `multi` (toolbar "Markets" `#ms-mm-btn`, and "Markets side by side" in every chart header's menu; `#ms-mm`) = 2, 3 or 4 charts,
each its own market and timeframe (any of `SPTFS`, a year from months through `spFetch`), candles and volume, live (each at its
timeframe's `poll`), the drawing tools on each (`msCharts` ids `mm0`-`mm3`); localStorage `ms-multi` `{ n, cells: [{ k, tf }] }`,
read through the market / timeframe lists. No Meridian / ICT markup there (said on the bar). "One market" goes back to the view
before (`MM_PREV`; the phone has no toolbar row). `window.msMulti()` is the read-only view.
**Low timeframes keep up** (same day, owner: "the charts in low tf are too slow"): the free charts (one chart, Split's right side,
Markets) read their newest candles every `freePoll(T)` = 1.5 s up to M1, 3 s up to M15, 6 s up to H1 (they polled every 15 s), and a
free chart of the page's own market folds every live tick into its last candle (`window.msTickSubs`, called from `liveFrame`,
`tickInto`; up to a day, never a week / month / year); while ticks arrive (`LT.at` under 5 s old) its read runs every 15 s only.
Then (owner: "more faster please and add 1 second timeframe"): every OTHER market a free chart shows gets its own OANDA stream
(`/md/stream`, `ftSync` every 2 s, at most four, closed when no free chart shows it, none while the tab is hidden); `freeTicks(k, Q)` folds
a market's ticks into every free chart of it (`FTL` = last tick per market, `tickLive(k)`). Reads every 1 s up to M1, 2 s up to M15, 5 s up
to H1. **1 second** (`1s`, "S1", Seconds group): OANDA stores nothing under 5 s, so a 1 s chart starts from 5 s candles (`spFetch`, said
in its source line) and builds true 1 s candles from live ticks; with ticks live it is never re-read (a read would put 5 s candles back).
`window.msFreeTicks()` is the read-only view.
**Split without its own bar** (same day, owner's marked screenshot: "remove the x and make everything in the same bar row … people
should be able to change timeframes from each chart"): the Split bar `#ms-sp-bar` is never drawn (its selects stay in the page as the
values the code reads); its Sync menu `.sp-sync` sits in the toolbar after Split / Layout / Markets (shown in Split only). Each chart's
header picks its timeframe: the LEFT chart (an analysed pane) takes only the underlined, analysed timeframes (others greyed in its
menu), the RIGHT chart (`.sp-right`, `spMarkRight`: the free chart, or the analysed pane of the same market) any timeframe and, from
its market button, any market (`openMk`; turns "Symbol" sync off).
Tests: `tests/desk-draw.test.mjs`.

## Structure assistant on Charts (22 Nov 2026, owner: "build an ai assistant for the dashboard that he will focus is direction/market structure and cycle")
A language model's READING of direction, market structure and the market cycle, from the structure the Desk's charts already
compute. Display only: it places, changes or refuses no order, moves no stop, keeps nothing in the browser, and no council member
reads it. Not advice, not a tested edge (the page and the system text say so).
- **Facts** (`window.msStructFacts`, inside the main script right after `cycleStrip`): for D1, H4, H1, M15, M5 the panes' own
  `P.A` (msAnalyze on CLOSED candles: the slice `A.n`), its trend, last break (BO / ChoCh), the last 6 breaks, the protected swing,
  the move's extreme, the last 4 iBOs (`msInternal`) and the internal leg (`msInternalLeg`); the cycle rows of `cycleNow()` with
  `msStage` / `msPath` (move / pullback / continuation, 50 %, origin, extreme, the ChoCh, the path); the alignment count. Times in
  UTC (the panes' times carry `TZ`). Fetches nothing.
- **`api/_structure-assistant.js`** (pure): `buildRequest(body, nowS)` whitelists and caps everything (timeframes D1-M5 only, levels
  finite and positive, rounded to `dec`, times not after the reading's `at`, `at` within the last hour, strings 200, question 300,
  6 breaks / 4 iBOs a timeframe, 4 cycle rows, 2 path legs) and writes the facts as plain lines. `parseAnswer(text, q)`: JSON
  `{ summary, timeframes: [{ tf, direction: up|down|sideways|unclear, why }], cycle, watch: [{ level, what }], question? }`; a
  timeframe must be in the facts, a watch level must be one of the facts' levels (to half the last decimal), and every figure in the
  text must be in the FACTS text (the person's question is not a fact; timeframe names, 50 / 100 and whole numbers up to 10 apart),
  the rule of `api/_daily.js` `parseBrief`; refused: trade instructions, any talk of stops, "proven / tested edge / guaranteed",
  a forecast stated as fact (a "will" sentence without if / could / would …), talk of itself.
- **`api/structure-assistant.js`**: GET (signed-in member) `{ enabled, reason, perDay, leftToday, cost }`; POST same origin, a
  signed-in member, `{ market, label?, tf?, question?, facts, stream? }`, streamed like the ChronosTrade coach (`start`, `text`,
  then `done` = the CHECKED result). Store `structure-assistant/answers.json` (+ the adapter's `cost.json` / `llm-cache.json`;
  `-preview/` off production): an answered or billed-and-refused question is answered from it, never paid twice. Key
  `STRUCT_LLM_KEY` else `ACADEMY_LLM_KEY` else `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` (which bring the provider's messages address
  and format, the daily brief's rule); model `STRUCT_LLM_MODEL` else `ACADEMY_LLM_MODEL`; budgets `STRUCT_LLM_DAILY_USD` 0.5 /
  `_MONTHLY_USD` 5 / `_HARD_USD` 25 / `_MAX_CALLS_DAY` 60; `STRUCT_LLM_MAX_TOKENS` 3000; `STRUCT_ASSISTANT_PER_DAY` 20 an account a
  UTC day (memory, per instance); `STRUCT_ASSISTANT=off` or `STRUCT_LLM_STOP=1` stops it. Routed in `cloudflare/src/worker.mjs`
  (`'structure-assistant'`) and `vercel.json` functions.
- **Page** (`<style id="ms-sa-css">` + `<script id="ms-sa-js">` at the end of the Desk): a "Structure" button in the Charts
  toolbar (`#ms-sa-btn`, placed after Style with Style's own CSS order; icon only on a phone), a side panel `#ms-sa` (a bottom sheet
  up to 640 px): "AI reading, not advice, not a tested edge", the state from GET ("The assistant is off." with the buttons off),
  "Looking at" (all / D1-M5), "Read this market", a free question, the streamed summary then the checked answer drawn as text,
  and "The facts sent" in a fold. Hidden and not run for guests. `window.msStructAssistant()` is a read-only view.
- Tests: `tests/structure-assistant.test.mjs` (7). Not checked against a real provider (no key in the build sandbox).

## Charts fit the window, a phone on its side, the watchlist (26 Nov 2026, owner: "improve our charts flawlessly that I can use it in phone and desktop 80% like trading view that will be my main chart app")
Display only, `market-structure.html` (`<style id="ms-fit-css">` + `<script id="ms-fit-js">` right before `#ms-ps-js`; pure pieces on `window.MS_FIT`).
- **Fit**: the script measures where the chart grid starts and what is fixed at the bottom of the screen (the phone's tab bar and wheel bar; the
  desktop side rail is the same `nav.btab` fixed at the left and is not counted) and sets `--ch-h` (every `.ms-chart`), `--mm-h` (Markets side by
  side) and `--ch-av` on `<html>` with `data-chfit`: one chart, Split and Layout 1-2 fill the window, All and Layout 3-4 show two rows a screen
  (`rowsOf`, `heightFor`; never under 260 / 200 px, 170 / 150 in a short window: the page scrolls instead). It replaces the fixed numbers of
  `#ms-ch-space-css` and the phone rules (they stay as the fallback before the first measure). Re-measured on resize, a view change, the phase
  strip or paper bar opening, and every 2.5 s. Never for guests, never in full screen (those rules are untouched). The Charts view's grid row gap
  is 0 there (it also counted for undrawn parts) and the toolbar's "Charts" title is hidden from 641 px.
- **A phone on its side** (`max-height: 560px` and landscape, any width): the site header, the bottom tab bar, the wheel bar and the phase strip
  step aside, the toolbar is one row of icons with the Menu button and the market button. Before, the chart was below
  the first screen at 844 x 390 and about 50 px tall at 568 x 320.
- **The chart is the whole screen on desktop** (owner, 26 Nov 2026: "The chart should be the whole screen, so probably the sidebar hide it"):
  from 1180 px the side rail and the site header are hidden on Charts (`body` padding 0). The Menu button `#ms-fit-menu` at the start of the
  toolbar sets `html[data-chnav="1"]`, which brings them back (also on a phone on its side), and hides them again; memory only, so every
  visit to Charts starts with the chart alone. Other views are unchanged.
- **More room** (owner, 26 Nov 2026: "Try to use more the space"; same block): on every screen each chart's own header (`.ms-ph`: timeframe, trend,
  cycle) lies ON the chart's top-left corner (absolute, `pointer-events` only on its children) with the O H L C line under it (`.ch-lg` top 38 px),
  so the row above the chart is gone; from 1180 px the Market phase strip is a chip in the toolbar (the script moves `#ms-phase` into `.sec-h` once
  its own script has made it, a comment marks its place for narrower windows; opened it takes a row of its own), the page's side margins are 6 px
  and the toolbar is thinner; at 1180-1439 px the toolbar is one row (Style is its "Aa" button, Help shows in the Menu state, the older forced
  break `.sec-h::after` is off there). With a mouse the on-chart Date / Auto / Log / % buttons show only while the pointer is over that chart.
  One H1 chart: 1440 x 900 825 px tall (478 before the day's work), 1280 x 720 645 px (401), 1920 x 1080 1005 px, phone 390 x 844 587 px (526).
- **Watchlist** (`#ms-wlp`, 1280 px and up, in `.ch-row` beside the chart): every market by group with its price and change on the day from the
  page's shared quotes (`window.msQuotes` = `mdQuotes`, no request of its own; crypto has no quote), a filter box (Enter opens the first match), a
  row opens `?s=<market>#charts`. Hide (x) folds it to a tab at the right edge (`#ms-wlp-btn`); `window.msWatchlist()` is the read-only view.
- **One chart first**: once a device (`ms-tv-v1`), a desktop still on All opens on the H1 chart (All, Split, Layout, Markets one tap away).
- Browser storage: two display preferences, `ms-wlp` and `ms-tv-v1`. The drawing rail scrolls inside itself when it is taller than the chart.
- **On-chart controls** (`<style id="ms-cn-css">` + `<script id="ms-cn-js">`, `window.MS_CN`; a `.ms-cn` group beside every chart of `window.msCharts`,
  at the lower right above the time axis, placed from the chart's own price-scale width and time-axis height): "»" back to the latest candle (shown
  only when the chart is scrolled over 3 candles away), **Date** (go to a date through `msAsk`; within the loaded candles, else the oldest ones and a
  line saying to scroll left for more), **Auto** (fit the price scale), **Log** and **%** (the chart library's price-scale modes 1 and 2 on EVERY
  chart; one display preference `ms-scale-mode`; Log keeps Settings' `#ms-show-log` box in step). Up to 640 px the group is one "…" button that
  opens the rest. Appended to the chart's PARENT (the drawing layer captures presses inside the chart element). Not for guests.
- **Layout with three charts** (26 Nov 2026, owner's screenshot): the fit measured the first pane, which spans two rows there and is taller than
  its chart, so every chart came out about a quarter of the window. It now reads the pane with the least around its chart, and the big chart is
  `--ch-h2` (two charts and the gap) tall. "Log a call" and "Structure" are icons at 1180-1439 px and "Log a call" up to 1799 px (they wrapped
  the toolbar to a second row).
- **No grid lines** (26 Nov 2026, owner: "the white grids I want them out"): `tvLook` and `cusLook` draw the charts without grid lines (panes, the free chart, Markets side by side).
- **Market switch without the wait** (26 Nov 2026, the next step toward a main chart app): a market link (`a[href^="?s="]`, the watchlist, the
  market list, Home, the wheel bar through `window.msGoMarket(k, hash)`) still loads the page again (so every stream, level and record belongs to
  the new market), but `<script id="ms-swap-js">` reads that market's candles for the six analysed timeframes while the pointer rests on the link
  (120 ms) or at the press, and the click hands them over in sessionStorage `ms-swap` + `ms-swap-at` (public candles, at most 12 s old at the
  click, refused after 20 s, read once and removed). `<script id="ms-swap-head">` then holds the first paint until the app script has run
  (`<link rel="expect" href="#ms-swap-ready" blocking="render">`, added only on such an arrival) and the pages cross-fade
  (`@view-transition { navigation: auto }`, `html[data-vt="swap"]`); every OTHER navigation skips the transition (`pagereveal`), so nothing else
  changed. `boot()` uses a handed timeframe instead of `fetchBars` and fetches the rest as always; polling and ticks follow. The click waits at
  most 200 ms for candles still on their way. Never for guests. Measured locally at 1440 px: 0.8-1.2 s before, about 0.5 s with the pointer on
  the row first, charts drawn at the first paint. `window.msSwap()` is the read-only view. A true no-reload switch was looked at and left: the
  page's streams, timers and per-market keys are set up once per load. Test: `tests/charts-swap.test.mjs`.
- Checked in a browser at 1920, 1440, 1280, 1180 x 820, 820 x 1180, 932 x 430, 844 x 390, 700 x 500, 568 x 320, 390 x 844 and 360 x 640: the grid
  ends 10 px above the window (6 px above the phone's bars) in every view, no sideways scroll; drawing, full screen, the phase strip, a resize
  and a market change through the watchlist work. Not checked on a real phone. Test: `tests/charts-fit.test.mjs`.

## Candles with no delay, the charts-only app, touch (26 Nov 2026, owner: "I want the candles faster, no delays and make an app just for the charts, try to have easy to move touch smooth on phones as well")
Display only: nothing here places, changes or refuses an order.
- **Live candles** (`api/stream.js`, `market-structure.html` `startTicks(pre)`): the stream forwards every OANDA quote at once (`GAP_MS` 25 ms
  apart at most; it was 100) and sends OANDA's heartbeat as an `hb` event the page hears, so a silent connection is replaced after
  `STREAM_QUIET` 12 s (45 before; a quiet market's heartbeats keep its stream). `boot()` opens the stream BESIDE the candle reads (`early`,
  its last quote applied once the charts exist). `STREAM_LIFE` 240 s into a stream a second one is opened and takes over at its first
  price (`renew`, `G.esRenew`), so the server's 4.5-minute limit leaves no gap; back from another tab or app after `STREAM_AWAY` 8 s the
  same hand-over starts at once; `online` reconnects. The forming candle moves to each price in the same frame: "Smooth price motion"
  (the eased body) is OFF unless the member ticked it (`ms-smooth` === '1'; it was on by default and trailed the price a few frames).
  The other markets' streams (free charts, Markets) hear `hb` too. Not measured on a live market (written during the daily break).
- **Charts app** `/charts` (vercel.json rewrite to `charts.html`): `scripts/charts-app.mjs` (build.sh, after pwa.mjs, before
  stamp-assets) copies the built Desk page with `html[data-app="charts"]`, title "Aureum Charts" and its own manifest
  `charts.webmanifest` (id and start `/charts`), so a phone or desktop installs it as an app of its own (Add to Home Screen / Install
  from `/charts`). In it `showView` always shows Charts, the site header, tab bar, side rail and view switch are hidden on every
  screen (`<style id="ms-app-css">`; the toolbar's Menu button brings them back), the wheel bar sits at the bottom edge, the page never
  bounces or pulls to refresh, and two page-wide housekeeping observers stand down. Same sign-in, same candles, same tools: one source,
  the Desk page. Ways in: account menu "Charts app", the main app's shortcut. Phone chart 713 px tall at 390 x 844 (587 in the Desk).
- **Touch** (same style block, `pointer: coarse`): a chart that fills the view (`.ms-grid4:not([data-view="all"]) .ms-chart`, `.mm-chart`)
  has `touch-action: none`, so the browser never waits to choose between scrolling the page and moving the chart and never zooms the
  page on a pinch; no text selection, callout or tap flash on a chart; no vertical overscroll on Charts. The six-chart view keeps the
  page's scrolling. A phone on its side: Log a call and Structure leave the toolbar so it stays one row. Panning measured about 1 ms
  of script a frame on a phone profile; not checked on a real phone.
- Tests: `tests/charts-app.test.mjs`, `tests/desk-live.test.mjs` (the stream hand-over on a fake EventSource and clock).

## Phone charts in an app look (28 Nov 2026, owner's TradingView phone screenshots: "The chart needs to look more actual app")
Display only, `market-structure.html` (and so the Charts app). Up to 640 px, in the simple phone view, on Charts, for members:
- **The toolbar row folds to nothing** (`#v-charts > .sec-h` height 0 and `visibility: hidden`, NOT `display: none`, so the Style and
  Layout popovers still open from it; they are `visibility: visible`). The market-phase strip is hidden. The wheel bar `#ms-wb` becomes
  a dock: its own two buttons are hidden and pressed by **two floating glass capsules** of `<script id="ms-tva-js">`: `#ms-tvl` (a
  round market badge, the market, the timeframe: each opens the wheel sheet) and `#ms-tvr` (pencil = the **Drawings** sheet; the last
  drawing tool used, trend line at first; "…" = the **Analysis hub**). The dock stays `#ms-wb`, so the fit script still reserves it.
- **Drawings** sheet (`#ms-tvs`): search, groups (Favourites, All, Lines, Shapes, Fibonacci and measure, Text), a card per tool of
  `assets/ms-draw.js` (a tap presses the tool's own `#ms-dr-bar` button) plus position and measure; a star adds a favourite through the
  rail's own `window.msRailFav('dt:<k>')` (`ms-dr-fav`); "Show favourites on chart" (localStorage `ms-tv-favshow`, the only key it
  writes) shows `#ms-tvfav`, a floating strip of the favourite tools at the chart's left edge. Opens on All until a favourite exists.
- **Analysis hub**: chart settings, indicators, chart type (cycles candles / line / both), bar replay, long / short position, measure,
  drawings list, hide drawings, magnet, undo, layout, all timeframes, markets side by side, chart image, full screen, Structure, Log a
  call, clean look, site menu (Charts app), Full phone view. Each presses the page's own control; a control the account lacks is left out.
- **Navy preset** `NAVY` (bg #161b3f, up #5ac8fa, down #2f6fe0): Style → "Navy / blue (app)", and switched on once per phone
  (`ms-navy-v1`, up to 640 px) only when the device has no colours of its own or the paper default.
- **Rules**: its CSS lives in `#ms-ps-css`'s phone block (the simple view's one place; every selector names `html[data-phone="simple"]`,
  Charts rules `html[data-phone="simple"]:not([data-role="public"]) #v-charts`), its parts carry `.ps-only`. **Its data attributes are
  `data-tv*`**: the page puts flags such as `data-ct`, `data-mode`, `data-role` on `<html>`, so `closest('[data-ct]')` matched the root
  and swallowed every hub tap (found on the way). The Full phone view and wider screens are unchanged. Test: `tests/charts-tv-app.test.mjs`.

## Quick type and drawing undo on the Charts (27 Nov 2026, owner: "Keep improving the charts")
Display only. `assets/ms-quick.js` (`window.MS_QUICK` pure `parseTf`, `matchMarkets`; loaded after ms-draw.js): on Charts (and the
Charts app), not for guests, typing a digit opens a "Timeframe" box ("15" = M15, "60" = H1, "240" = H4, "4h", "30s", "1d", "w",
"1M"; Enter applies through `msOneTf`) and a letter a "Market" box (the key, the label or the name; arrows, Enter goes through
`msGoMarket`). A lone digit 0-6 keeps its old pane meaning after 0.9 s; the tool letters f h t b p m r and "/" (the command palette)
are left alone. Styles `.ms-qk` (glass in `assets/soft.css`). `assets/ms-draw.js`: every save keeps the market's previous saved
drawings in memory (100 steps, gone on a reload): Ctrl / Cmd + Z undo, Ctrl + Shift + Z or Ctrl + Y redo, and both in the right-click
menu; `window.msDrawUndo` / `msDrawRedo`. The right-click menu also offers "Horizontal line at <price>" and "Alert at <price>" (a line
alert, `d.alert`) at the price under the pointer. Arrow keys move the chart under the mouse a candle (Shift: ten), up / down zoom, End
goes to the latest candle (not while a pane is in replay). **Drawings list** (`#ms-dlist`, Alt+L or the right-click menu,
`window.msDrawList`): every drawing of the market, newest first; a row selects it and brings it into view, Lock / Delete per row.
**Hide drawings** (Alt+Shift+H, the menu, or the eye button in the drawing strip, which also has a list button for phones; memory only, a new tool shows them again; `window.msDrawHide`). The drawing tools' short
messages (`#ms-dr-note`) float at the bottom of the screen instead of pushing the charts down a line. Never Alt+D (the browser's address bar).
Test: `tests/charts-quick.test.mjs`.

**On-chart ink follows the chart's background** (27 Nov 2026): with the paper look (a light chart) on a dark page, each pane's header,
the O H L C line and the on-chart buttons were dark-theme ink on the light chart (contrast about 1.1-2.3:1) and the BO / CF / iBO / VR
tags had dark backings. `.ms-live[data-chart]` (set by `applyTheme` from the chart's own background) now gives `.ms-pane` and `.mm-c` the
light tokens when the chart is light on a dark page and the dark tokens when it is dark on a light page; the cycle tag `.ms-cy` follows;
the markup's label backings take `CUS.bg`. Never style text on a chart from the page theme alone.
**Charts polish, 27 Nov 2026**: "Structure" is its icon at 1440-1799 px too (it wrapped the toolbar to a second row: the chart is 34 px
taller); the watchlist's crypto rows read Kraken's public ticker through `window.msCryptoQuotes` (main script, next to `msQuotes`; at most
every 25 s, change against today's 00:00 UTC open, said in the watchlist's note; the fit script still makes no request of its own); Markets
side by side keeps its candles above the volume band (`scaleMargins` top 0.1, bottom 0.18). Test: `tests/charts-quick.test.mjs`.

## Charts speed (27 Nov 2026, owner: "Keep improving the charts, speed")
Display only, `market-structure.html`. Measured on the Desk's Charts (1440 px, live OANDA candles, no tick stream): (1) **a refresh no
longer rebuilds a chart**: each pane's poll (every 3-10 s on the low timeframes) used to `setData` every candle, the volume, the averages,
the indicators and run the analysis; `window.msPollPlan(old, nx)` (pure) says what the refresh changed: `'same'` = nothing redrawn, the
candles from the old last one on (at most 3 new) = the tick path `P.push` (series.update, analysis at most every 2 s or on a closed
candle, off-screen panes only marked stale), `null` (an older candle changed, another feed, a shifted history) = the full rebuild as
before. (2) **The background scanner waits while the Charts are on screen** (`onCharts`, `SCAN.later`): it read 6 timeframes of every
market the council's snapshot does not cover (about 66 requests at load and every 5 minutes) and competed with the chart's own candles;
the snapshot part still runs, the rest starts when another view opens. (3) Two page-wide watchers (the scroll-box fades, the "Loading"
labels) stand down on the Charts and run once when another view opens; a pane tells the drawing layer it is visible from its
IntersectionObserver (`P.vis`), not a layout read each frame. Load: 113 -> 47 candle requests in the first 12 s; idle with the charts
open: 1.15 -> 0.76 s of main-thread work per 20 s, script 0.33 -> 0.17 s. Test: `tests/charts-speed.test.mjs`.

## Demo account settings on the owner's Profile (27 Nov 2026, owner: "In my profile make me available to manage the demo account settings risk, assign strategies etc")
The owner's session only. Profile card `#ms-pf-dset` (row "Demo account settings" under More; `<style id="ms-ds-css">` + `<script
id="ms-ds-js">`, loads when the card comes on screen, keeps nothing in the browser): every book the demo mirror copies and every demo
job, each with its demo account (a picker of the mirror's accounts with login ending, label and balance; the base / the job's default;
or another account by number or `*<login digits>`), its risk a trade in % and an on / off switch. Save sends ONLY the fields changed
on screen, on top of what was saved before (`changes`), so a value never touched is not frozen into the file.
- **Rules, one copy** `api/_demo-settings.js` (pure; `BOOKS` = the mirror's books with their `LIMITS.risk` key and today's value,
  `JOBS` = vb, gotobi, nq (+ `ujRisk`), dom, dom4 with their defaults and limits; a test compares all of them with the code).
  `clean` checks every field (a book 0.01-5 %, a job its own limit; books sized together, council / replica / shadow / LIT, must agree),
  `apply(cfg, settings, accFile)` lays them over config.json: `mirrorAccounts`, `drain` (an account a book moved away from keeps a
  round to manage its open copies), `mirrorRisk`, `mirrorOff`, and the jobs' keys. `live` and every other key are untouched.
- **Endpoint** `api/demo-settings.js` (routed in `cloudflare/src/worker.mjs`, `vercel.json`): GET = the stored settings, today's
  mapping (`ctrader/mirror-accounts.json`), the jobs' config.json values and the accounts (a live account is never listed); POST
  (same origin) writes council-data `owner/demo-settings.json` through the GitHub contents API with `GH_MCP_TOKEN`, else `GH_TOKEN`
  (needs Contents: write); without such a token the card says saving is not set up and nothing is saved.
- **Council** `council/owner-config.mjs` `readConfig(dir)`: config.json with the settings on top (a missing or broken file changes
  nothing), read by `ctrader-mirror.mjs` (accounts, risk over `LIMITS.risk`, `openBooks` without the books switched off: their open
  copies are still managed to their exits), `ctrader-account.mjs`, `vb-demo.mjs`, `gotobi.mjs`, `nq-demo.mjs`, `dom-demo.mjs`.
  **The owner's saved values win over the code's defaults and config.json**: a later code change to a book's risk or account does
  not reach a field the owner saved. Demo only: `council/live.mjs` and the jobs' `--live` mode never read it; the mirror and the jobs
  still refuse a live account; nothing here moves or removes a stop. Test: `tests/demo-settings.test.mjs`.

## Indicator values in the chart legend (27 Nov 2026, owner: "Keep improving the charts")
Display only, `market-structure.html`. Each Desk chart pane's legend (`.ch-lg`) has one row per indicator under O H L C, as
TradingView shows it: the study's name and its values at the candle under the crosshair (the newest one when the pointer is away).
`indDraw` records the rows in `out.leg` from what it already computed, so the legend computes nothing while the crosshair moves.
`window.msIndLegend(rows, i, n, fmt)` (pure) builds them: names escaped, a colour shown only when it is a plain colour, "—" before
a study has a value, at most 8 rows. A guide line with one value everywhere (RSI's 70 / 30) is drawn but left out of the legend
(`flatLine`). No rows during bar replay. The free chart and Markets side by side are not done. Test: `tests/charts-ind-legend.test.mjs`.

## Charts in a trading-terminal look (24 Nov 2026, owner: "on 1 minute and small timeframes he doesn't show the candles", "make the interface look more TradingView")
Display only, `market-structure.html`. Cause of the "no candles": the free chart (one chart on any timeframe, seconds too, Split's
right chart) called `fitContent()` on its 500 candles, about 2.5 px a candle: hairlines without bodies. `tvView(chart, n)` (next to
`THEMES`, `window.msTvView`) opens every chart at about 8 px a candle (width / 8, at least 50 and at most 220 candles in view, a
tenth of that as room on the right): the six panes (`P.fit`), the free chart and Markets side by side. `tvLook(t, theme)` = one solid
background, a faint grid (`TV_GRID` per theme), dashed crosshair with dark labels, the scales' borders, kinetic scrolling, scale by
dragging either axis; applied by `applyTheme`, `spTheme`, `mmTheme` (a member's own background still wins). Style → "Green / red
candles" (`#ms-sty-tv`) sets the member's up / down colours to the dark themes' green / red; the owner's grey / black light-theme
default (#686) is unchanged. Toolbar from 1024 px: one row, the key hints left to Help (the keys work), Indicators beside the
markets switch (last rules of `#ms-ch-flat-css`). Panning measured 60 fps (p95 16.8 ms) on the panes. Test: `tests/charts-tv-look.test.mjs`.

## Charts bug hunt (20 Nov 2026: the chart features of 18-20 Nov, used in a browser)
Every drawing tool, the paper account, the volume profile, Layout, Markets side by side, Split, any timeframe, full screen and the
live ticks were driven with Playwright (1440 px mouse, 390 px touch; owner and guest; live candles). Twelve defects, each
reproduced by a script first, then fixed. Display and practice only: no council, ICT, API or order code touched. Pinned in
`tests/desk-bughunt.test.mjs`.
- **A drawing dragged off its chart stayed "held"** (`assets/ms-draw.js`): the release was listened for on each chart, so letting
  go outside it never ended the gesture; back over the chart the shape followed the mouse with no button down and the chart
  stayed locked. The release is now heard on the window (`endGes`: pointerup, pointercancel, blur), a mouse that comes back with
  no button ends it too, and Escape lets go of any gesture.
- **Full screen hid the floating parts** (`ms-draw.js`, `#ms-cfs-css`): the style bar of a drawing, the right-click menu and each
  chart's timeframe menu were made in `<body>` (outside the full-screen element), and the rule that hides everything else in full
  screen (`> :not(.sec-h)…`) hid them again once moved in. In full screen no drawing could be styled or deleted by its bar and no
  timeframe chosen. `fsHost()` (`window.msFsHost`: the browser's full-screen element, else `#v-charts.ch-fake-fs`, else body) is
  where they are made and moved (`fsMove`, on `fullscreenchange` and the page's own `ms:fs`), with the toasts; the rule leaves them
  alone. The market list lives in the page header: full screen is left for it (`leaveFs`; a new market reloads the page anyway).
- **Layout with Sync: an empty chart** (`laySync`): the default four-chart layout (H4, H1, M15, M5) drew the M5 chart blank. The
  leader's five weeks are about 10,000 M5 candles; the chart can draw its width / 0.5 px (about 1,240), the chart library then
  keeps the window's right edge, which is in the lower chart's future. `window.msLayFit(r, n, cap)` cuts such a window to what
  the chart can draw, ending at its last candles.
- **Paper account, rule 1**: a stop of 0 or below was accepted on an open trade (hand edit) and a negative one on a new order
  (the engine only refuses a falsy stop): a trade with no stop in effect. `order()`, the draft field, `stopEdit(p, v, cur)` (pure;
  also refuses an edit while the market has no price) and `norm()` (a stored record) all want a stop above zero.
- **Paper account, the order was not what the screen showed**: with a field or a select of the panel in hand the panel is not
  redrawn, and a change of the Stop / Target / Risk select kept the focus: the draft took the new stop while the screen kept the
  old one, and Place used the draft (3,545.4 placed under a field reading 3,551.7). `draw(true)` now redraws a change at once and
  puts the focus back; a draft field in hand stops following the price (`D.follow`, `focusin`), and the draft does not follow
  while the panel holds the focus. A typed entry still sets stop and target around it unless they were typed (`D.touched`).
- **Paper account, the first click after typing did nothing**: typing a stop and clicking Place (or ½, Close) rebuilt the panel
  between the press and its release, so the click was lost. No redraw while a press is in progress (`pressing`, `pend`).
- **Paper account, a stop hit while the page was closed was booked at another price**: positions of the page's own market were
  checked on the one-minute pane alone (about a day). A buy at 3,850 with its stop at 3,800, left for three days, closed at
  3,719.8 "stop (gap)", -2.6R, when the pane's first candle came. Another market's catch-up asked for one window up to now, and
  the candle service keeps the END of a window over 5,000 candles: the same skip after 3.5 days. Now `paneGap()` holds such a
  position off the pane, and `catchUp()` reads the candles in between in windows of 4,000 minutes (`windows`, 12 a pass) through
  `msPaperHost.since(k, from, to)`, whose answer is marked `whole` (an empty window = a closed market; a failed read = null,
  tried again after 15 s, never a guess). Same position after the fix: stop at 3,800.00 on 18 Nov 02:06 UTC, -1R.
- **Paper account, small**: the line of news ("opened at …", "closed at …: +1.20R") was wiped by the redraw that follows every
  order and close (kept in `LIVE` and drawn with the panel); a position's lines were missing on a chart opened later (one chart,
  Split, Markets) and stayed on a Markets chart after its market changed (`chartsKey`, looked at every 2 s); the CSV wrote
  3549.7200000000003.
- **Volume profile ignored the volume on the free charts** (one chart on any timeframe, Split's right chart, Markets): their
  candles carried no `volume`, so every candle counted as 1 (H3 gold: VAH 4,342 instead of 4,361). `SP.bars`, `mmSet` and
  `tickInto` keep the feed's volume. **And it did not follow the price scale**: its redraw key held the candles in view only, so
  a drag of the price axis with no new price (a closed market) left the profile 32 px off its prices; the key now holds where
  the scale puts two prices, and the market.
- **A price stream that went silent stayed silent** (`startTicks`, `ftSync`): a stream whose connection stays open with nothing
  arriving raises no error, so the candles froze ("2 min ago") until a reload. With the market open and the tab in view,
  `STREAM_QUIET` 45 s without a price closes the stream and asks again (the page's own and the free charts' streams).
- **A closed market was read every second**: on a weekend four one-minute charts in Markets made about 250 candle requests a
  minute for candles that cannot change. `shutNow(I)` (weekend, never crypto) makes a free chart's read once a minute
  (`SHUT_POLL`); measured 286 -> 49 requests a minute for the whole page.
- **Phone: drawing tools 22 px wide**: the strip went from 7 to 15 tools on 19 Nov and its buttons shared one row; they keep
  44 px and take a second row.
Found working, nothing changed: every drawing tool (place, select, move, resize, style, lock, clone, delete, text edit, magnet on
candle O / H / L / C), reload keeps drawings, favourites and their place, the right-click menu, line alerts (a price that
crosses and comes back inside the 1.5 s between two looks is not seen: by design), Markets with a stream per market, any
timeframe from 1 s to a year, Split, touch drawing, the guest's view (no paper, no layout). Not tested: Safari / a real iPhone,
crypto markets (the exchanges are not reachable from the build sandbox), a real weekend.

## Charts full screen, roomier (25 Nov 2026, owner: "improve the full screen mode more spacious, organised and easy to work")
Display only, `market-structure.html` (`#ms-cfs-css`, the full-screen block next to `msChartsFs`). Full screen (the browser's or the page's own) now
has a visible **Exit** button and a **Hide toolbar / Show toolbar** button (`.ch-fs-x`, `.ch-fs-tb`, made by `bar()` on `fullscreenchange` and by the
page's own full screen; Esc still works; the toolbar comes back on exit), a wide screen no longer keeps the 52 px a phone needs (padding 10 / 14 / 12),
the toolbar is one non-wrapping row that scrolls sideways (room kept for the two buttons), gaps between charts are 8-10 px, and with the toolbar hidden
the charts take its row and the buttons shrink to small chips. Checked at 1440 x 900 and 390 x 844. Test: `tests/charts-phone-fs.test.mjs`.

## Charts on a phone: full screen and the Style panel (20 Nov 2026, owner on an iPhone: "the phone can't read the rest", "I can't find the full screen button")
Display only, `market-structure.html`. (1) The full-screen button was hidden under 700 px (`.ch-fs`); only the pane-header copy hides
there now, so the chart toolbar (`#ms-ch-one`, behind the pencil "Draw" toggle on a phone) shows it as its last icon. (2) iPhone Safari
cannot put a page element full screen: `window.msChartsFs()` uses the browser's (`requestFullscreen` / `webkitRequestFullscreen`) where
it exists, else the page's own: `#v-charts.ch-fake-fs` (fixed over the page, `100dvh`, top 52 px for an "Exit full screen" button
`.ch-fs-x`; Escape and a view change leave it; `window.msChartsFsState()`). Every `#ms-cfs-css` rule reads
`:is(#v-charts:fullscreen, #v-charts.ch-fake-fs)`; without the rail the chart column now takes the full height (it was 0 px on a
phone in the browser's full screen too). (3) The Style panel (`#ms-sty-pop`) opened from its button's left edge and ran off the right
of a phone: up to 640 px it is a sheet across the screen above the tab bar (scrolls), wider it is moved left when it would leave the
screen (`place`). Checked at 390 x 664 (iPhone 13) in both paths. Test: `tests/charts-phone-fs.test.mjs`.
**Phone audit 2 (20 Nov 2026)**: every menu, popover, dialog and sheet of the Desk, ChronosTrade and the Macro desk opened at
390 x 664 (iPhone 13 emulation, no element Fullscreen API), simple and Full view. Fixed, display only: (1) the Desk's drawing style bar
`.ms-dsel` was one row 612 px wide, so Lock, Clone and Delete sat 230 px past the screen: it wraps inside `100vw - 16px` and is
placed above the shape by its own height (`assets/ms-draw.js`); (2) ChronosTrade full screen on a phone: the trade dock (320 px,
from 70 px down, z 45) covered the floating replay bar (Play, More, and in More the only way out of full screen on an iPhone) and
ran 37 px below the screen; up to 640 px it is a bottom sheet (`max-height: 46dvh`, Sell / Buy first by flex `order`) and hides while
More or a toolbar menu is open (`body.fs:has(#tb.more-open, #tb details[open])`: the replay bar is inside `.chartc`'s z 40 stacking
context, under the dock); (3) the trade dialog's Before / After / Save (37 px) and ticket buttons (32 px) are 44 px on touch, its two
11 px labels 12 px; (4) the charts guide's close button is 44 px wide on touch. Left: the header switch dots (21 x 28, the known
width budget), ChronosTrade dropdowns that touch the screen edge or open over a toast. Test: `tests/phone-audit-2.test.mjs`.

, owner: "the currency letters look too big, make same size as the rest")
Display only, the end of `<style id="ms-ch-flat-css">`. Every control on Charts is 12.5 px: the toolbar's market button `.ch-mk`
(was 14 px / 650), the chart headers' market and timeframe buttons `.ph-mk` / `.ph-tf` (13 px / 700), the Markets view's selects and
price; the trend chips and the cycle tag are 11.5 px Figtree (10.5 px mono and the system font before); the Style / Indicators
small print 12 px. The chart watermark ("XAU/USD · H1") is 26 px (38 before), still faint.
Same day, an accessibility pass on Charts (1440 / 390 px, dark and light): every control has a name and a 2 px focus ring, no text
under AA. Fixed: the candle countdown `.ch-cd`, the phone's price legend `.ch-lg` and the keyboard hints were 10.5 px (now 11.5);
**Tab followed the DOM, not the screen** (the toolbar is laid out with CSS `order`: Help, Style, Indicators came before the market
button). A small script before the rail block puts `#v-charts .sec-h`'s element children in the order they are drawn (on load, on
resize, when a child is added; stable for equal orders; comments stay), so nothing moves on screen; `window.msBarOrder()` reads it.
No style may depend on the toolbar's sibling order (`+`, `~`, `:nth-child` on `.sec-h > …`).

## Drawing rail on the left, floating favourites (19 Nov 2026, owner: "the drawing bar in the left and we also should be able to choose favorite and have it floated like tradingview")
Display only, `market-structure.html` (block "Drawing rail on the left" after the one-chart bar, `<style id="ms-rail-css">`) and
`assets/ms-charts-guide.js`. Wider than 640 px (`matchMedia('(min-width: 641px)')`) the drawing tools `#ms-dr-bar` and the chart
tools `#ms-ch-one` leave the toolbar for a column `#ms-rail` at the charts' left edge (`.ch-row` = rail + `.ch-col`, which holds
`.ms-grid4` and the Markets view; sticky while the page scrolls; `#v-charts.has-rail`); a phone puts them back behind "Draw" (comment
placeholders mark where). Each tool shows a star on hover; the star, or a right-click / long press, adds it to the favourites bar
`#ms-dr-fav` (`.ms-fav`, position fixed, dragged by its dotted grip, kept on screen), whose buttons press the rail's own buttons
(pressed state mirrored), so no tool works differently. The star at the foot of the rail (`#ms-rail-fav`) shows or hides the bar.
localStorage `ms-dr-fav` `{ tools: ['dt:t', 'mag', 'ct:.ch-fib', …], on, x, y }` (this device). Full screen keeps the rail and the
bar (`#ms-cfs-css` now reads `.ch-row` / `#v-charts:fullscreen .ms-grid4`). The guide's "?" stays in the toolbar (before Style, icon
only beside the rail) and its chapters say where the tools are and how favourites work. Never set an attribute the rail's observer
watches to the value it already has (it looped once and froze the page). `window.msRail()` is the read-only view. Test:
`tests/desk-draw.test.mjs`.
**20 Nov 2026 (owner's marked screenshot)**: only the drawing tools stay in the rail; the chart tools `#ms-ch-one` (timeframe,
position, measure, replay, image, fit, full screen) and the favourites star `#ms-rail-fav` sit in the top toolbar after Clean
(`order: 3`), with their stars there too. The "Open on TradingView" button (`.ch-tv`) is gone from every chart.

## Fibonacci, arrow and text drawings (19 Nov 2026, owner: "add more drawing tools like fibonacci and text")
Display only. Three shapes join ChronosTrade's drawing types in `assets/backtest-engine.js` (`DRAW_TYPES`, so `drawNorm`,
`drawGeom`, `drawHit`, `drawResize`, `drawMove` handle them; ChronosTrade itself does not offer them yet): `f` Fibonacci retracement
`{ t1, p1, t2, p2, ext? }` (`FIB_LEVELS` 0 / 0.236 / 0.382 / 0.5 / 0.618 / 0.786 / 1; 1 at the first point, 0 at the second; `ext`
draws the levels to the right edge), `a` arrow `{ t1, p1, t2, p2 }` (head at the second point), `x` text `{ t1, p1, text }` (one
plain line, 120 characters at most, `textOf`; a text with no words is dropped; size S / M / L = `w` 1-3, `TEXT_PX`). On the Desk
(`assets/ms-draw.js`): in the rail after Box, keys Alt+F / Alt+A / Alt+X; Text asks for its words after one click (`askText`
through the styled `msAsk`), "Edit text" in the style bar and a double-click on a text change them; the Fibonacci levels carry
their prices and light bands. The one-chart bar's old Fibonacci button (`.ch-fib`) left the rail (the key B still works on the
chart under the mouse). The guide's drawing chapter names them. Test: `tests/desk-draw.test.mjs`.

## More drawing tools and 18 more indicators (19 Nov 2026, owner: "add the all famous tools and rare indicators used on trading view … and tools that are not in trading view but it would be super helpful")
Display only. **Drawing shapes** (engine `DRAW_TYPES`, Desk keys): `c` parallel channel `{ t1, p1, t2, p2, off }` (Alt+C; the
second line is the first moved by `off` in price, first width = 2 ATR(14) of the chart, the middle handle `o` sets it, `ext`
extends), `m` price and date range (Alt+G; a box that always shows the move, %, bars and time, green up / red down), `w` anchored
VWAP `{ t1, p1 }` (Alt+W; the page draws the curve from the candle at t1 with the candles' volume, 1 where the feed has none; only
its handle is hit), and two not in TradingView: `p` measured move (Alt+P; A to B, then the same move from B: 1:1 and 1.618 targets,
`BT.measuredMove`) and `b` ATR band `{ price, hw }` (Alt+B; the chart's ATR(14) above and below a price; dropped without a width).
**Indicators** (`IND_DEF`, 36 in all; `IND_GROUP` / `IND_GROUPS` list them by group in the dialog, searched by `#ms-ind-q`): Hull MA,
KAMA, Ichimoku (spans plotted at the current candle from values 25 candles back, lagging line 25 back), Chandelier exit, classic
daily pivot points (UTC days of the chart's time zone), ADX / DMI, Williams %R, Stochastic RSI, Awesome Oscillator, Aroon, Fisher
Transform, Choppiness Index, Squeeze momentum (TTM style: BB inside Keltner = red dot), Z-score of price, range expansion (range ÷
ATR), OBV, MFI, CMF (volume = 1 where the feed has none). Decimal parameters `mult`, `bb`, `kc`. A test lifts the library out of the
page and checks every new study is finite and grouped (`tests/desk-draw.test.mjs`). The guide's chapters list them.

## Paper account, order flow and full screen on the Desk's Charts; ChronosTrade in one font (18 Nov 2026, owner: "a paper trade account there to practise that shows its stats", "add orderflow indicators", "when I go fullscreen on charts should be the full layout and split if I had", "change the font of chronos to more professional")
- **Paper account** `assets/ms-paper.js` (`window.MS_PAPER` pure: `fresh`, `norm`, `order`, `process`, `stats`, `floating`, `sizeText`;
  page part after `module.exports`), a bar `#ms-pp` above the six panes (`<style id="ms-pp-css">`; hidden for guests; behind More
  in the simple phone view). Practice only: localStorage `ms-paper-<account>` (`ms-pp-open` = stats shown), no request of its
  own, nothing reaches the council, the mirror, a broker or the server (a test reads the asset). $10,000, risk 0.25 / 0.5 / 1 / 2 %,
  stop 0.5-2 ATR(14) of the M15 chart, target none / 1-3R. Buy / Sell open a draft (entry empty = market, else a limit or stop
  order) whose stop and target are drawn on every chart of the market; every order has a stop on its losing side (`order` throws,
  `norm` drops a stored one without). ChronosTrade's engine (`BT.place`, `onBar`, `close`, `closePartial`, `stats`) runs each
  position on CLOSED one-minute candles that started after it was placed (`chk`): the page's M1 pane for its market, one-minute
  candles from `rangeBars` for another market with open positions (on load and every minute). Fills at the chart's price, no
  costs (said on the bar). BE only on a trade in profit; ½ and Close by hand; stop / target editable in the table. Stats: balance,
  equity, floating, return, net, trades, win rate, profit factor, avg R, expectancy, max drawdown, best / worst, streaks, hold, a
  balance curve, the latest 50 trades, CSV, reset (styled confirm). The main script hands over `window.msPaperHost` (key, insts, TZ,
  m1, atr, since); `window.msPaper()` is a read-only view. Closed paper trades of the market are drawn on its charts (19 Nov 2026:
  `marks()`, a canvas `.ms-pp-cv` per chart, a dashed entry-to-exit line coloured by result with its R; times placed through
  `ms-draw.js`'s `window.msChartX`, the last 60 trades). Home's line `#hs-pp` (19 Nov 2026, under the headline from 641 px; hidden
  for guests and without the charts permission, and until the account has a trade): equity, return, open / waiting, closed and
  win rate, "Open the charts" (`home()`). Tests: `tests/desk-paper.test.mjs`.
- **Order flow** in the indicator library (`IND_DEF` `delta`, `cvd`, `vwap`, `vprof`, `rvol`, flag `flow`): Volume Delta and CVD
  (reset each UTC day) from `iDelta` = the candle's volume times where it closed in its range (-1 at the low, +1 at the high), VWAP
  with ±n SD bands (UTC day), Relative Volume, and the Volume Profile (owner: "i want volume profile"): `assets/ms-vprof.js`
  (`MS_VPROF.profile`) draws on every chart, while the indicator `vprof` is in the list, a histogram of the candles IN VIEW on the
  right edge (`rows` 60, value area `va` 70 %), each row split into buying (green) and selling (red) by `iDelta`'s rule, the value
  area stronger, POC / VAH / VAL as labelled lines; it follows pan, zoom, new candles and full screen (`window.msVprofState()`). ESTIMATED:
  OANDA's volume is a tick count and no feed gives the trades at the bid and ask; the menu says so. The pane bars now keep `volume`.
- **Full screen** (each pane's ⛶) takes `#v-charts` full screen, so the view on (All as three by two, Split, Layout, one chart),
  the switches, the drawing strip and the paper bar stay; the charts share the height (`<style id="ms-cfs-css">`); `ms-draw.js`
  moves the style bar and the right-click menu into the full-screen element and back.
- **Phone (19 Nov 2026)**: behind More the timeframe / view switch wraps ("Layout" was cut off), the markup switch keeps each
  word whole, and the paper account is one compact block (Risk / Stop / Target in one row of three).
- **ChronosTrade font**: Inter everywhere (the page, the chart scales and legend `MONO` / `SANS`, the report image in
  `assets/bt-review.js`, the trade effects in `assets/bt-fx.js`), tabular figures through `font-feature-settings: "tnum"` on the
  body (the `font` shorthand resets `font-variant-numeric`, not that); JetBrains Mono and Figtree are no longer requested there.
  The audit checks the scales read Inter.

## Live candles with no delay, bid / ask lines, paper orders from the chart (19 Nov 2026, owner: "More improvement on the charts, try to make it better than tradingview", "The candles needs to be more live moving with no delay")
Display only, `market-structure.html` (Desk Charts), `api/stream.js`, `assets/ms-draw.js`, `assets/ms-paper.js`.
- **One tick engine** (`liveTick(px, t, quote)`, `LT`, `liveFrame`, before `startTicks`): the OANDA stream, Binance trades and the
  exchange price reads all feed it; the ticks of one frame are applied together on the next animation frame (a hidden tab:
  a 200 ms timer), keeping every tick's high and low; the header price and bid / ask follow every frame (was once a second).
  `window.msLiveTick` / `window.msLive()` (read-only view).
- **Faster feeds**: `api/stream.js` forwards up to 10 quotes a second (was 5) and sends `retry: 300` (was 1500 ms); Binance adds
  its `@aggTrade` stream (klines come every 2 s), and a forming kline older than the last trade keeps the trade's price; the
  exchange price read runs every 1 s (was 2.5 s).
- **No jump back** (`liveKeep`): a candle refresh (edge cached, up to a minute old) that returns the forming candle keeps the last
  tick's close, high and low.
- **Smooth price motion** (Style → Live price, localStorage `ms-smooth`, on by default): the forming candle's body eases to the new
  price over a few frames (`liveEase`, `series.update` only; never in Heikin-Ashi or Line). The candle data, the markup and every
  reading use the real quotes. **Bid and ask lines** (`ms-bidask`, off by default; OANDA quotes): two dotted price lines.
  `#ms-live-lag` beside the live dot: "now" / "n s ago" / "n min ago".
- **Paper orders from the chart**: the right-click menu (`#ms-cmenu`) offers "Paper buy / sell at <price>" at the price under the
  pointer on a chart of the paper account's market (`window.msPaperDraftAt`, `msPaperMarket`; never for guests): the draft
  opens with that entry (the engine makes it a limit or stop) and the usual stop and target. Practice only, a stop always.
- Tests: `tests/desk-live.test.mjs`.

## Profile page like the owner's Figma example (17 Nov 2026, owner: "make profile like this example")
Display only, `market-structure.html` `#v-profile`. A filled name card (`.pf-hero`: portrait, name, role, edit button `#ms-pf-edit` =
rename), then the account as a list (`.pf-box.pf-list`, rows `.pf-row`: round icon, title, one line, chevron or switch): Demo
accounts (`data-pf-go` scrolls to the card, opening its fold on the phone's simple view), Change photo / Display name (ids
`ms-pf-photo` / `ms-pf-rename`, hidden when the menu has none), Light theme (`#ms-pf-theme`, `role="switch"`), Log out; "More"
(`#ms-pf-more`): notification / sounds / connector rows follow their card's `hidden` (`pfSync`, MutationObserver), Academy only where
the account menu shows `#ms-me-academy`. From 901 px the list column is sticky on the left and every section card in the right
column. The hero and lists are not `.card`, so the simple view still keeps the first card (Demo accounts) and folds the rest.

Coach for results (17 Nov 2026, owner: "do more critical and useful for productivity and results improvements for the coach").
Display and record only: nothing here places, changes or refuses an order and nothing moves a stop. Page block `// ---- Coach for
results (17 Nov 2026` … `// ---- end Coach for results` (after the live coach's; its state is `CFR`: `CR` is the drawing tools'
name), CSS `/* Coach for results (17 Nov 2026)` … `/* end Coach for results */` (outside the simple view's block). Pure helpers on
`BT`, tested in `tests/backtest-coach-leaks.test.mjs`.
- **One record across sessions**: `BT.gatherSessions(sessions, { current })` reads every saved session of `btLab:sessions` (read
  only; the live account replaces its saved copy), merges partial closes inside their own session, labels each trade with its
  market and timeframe (`sess.label`) and gives it the id `<session>#<id>`, so two sessions' trade #1 stay two trades. A scope
  switch "This session | All my sessions" (`.cr-sc`, localStorage `btLab:coachScope`) on "How you trade" and on the leak card; the
  journal filters still apply (`crPass` = jList's tests); the session question to the AI carries `scope`, `sessions` and each
  trade's `market` (`api/_chronos-coach.js` caps them). Never merges accounts.
- **Where your R goes** (card `#lk`, top of Statistics, `BT.coachLeaks(trades, barsFor)`): one row per habit (stop moved away,
  exited early, closed by hand, stopped out after +1R, revenge within a session, oversized, against the trend, away from your
  levels, outside your best session) with n, sum R, mean R and the R given up (`lost`), sorted by it, and one headline sentence.
  Exits by hand get a COUNTERFACTUAL (`BT.exitCf`): candles AFTER the exit only (`time > closedAt`, each ended by the replay
  moment), to the stop and target the trade OPENED with (`ctx.tgt0`, else the target; stop first when one candle holds both, a
  gap at the open); never a candle at or before the exit (a test rewrites them). Only the live session's candles are held: other
  sessions' exits are "not measured", never guessed. "Break-even at +1R" (trades that reached +1R and closed at a loss) and the
  winners' capture of their best move read the recorded MFE (approximate, said so). Under 20 trades a row is "too few to judge",
  else "your record, not a tested edge".
- **Patterns**: `coachSplits` now also returns every comparison (`diffs`); `BT.coachPatterns` keeps those with 20+ trades on BOTH
  sides and Welch |t| >= 2 (always over all sessions), `BT.patternMatch(pats, ctx)` the costly ones a context matches. A matching
  draft gets an amber line in the draft readout (`.dwarn`, from `draftSay`'s context `CSC`), a new position or a draft a note on
  the live panel ("Your pattern"). A warning only: it never refuses or changes an order. The leak card lists the patterns.
- **Session plan and tilt guard** (Trade card `details#pl`, localStorage `btLab:plan`, `BT.planNorm` / `BT.planCheck`): max trades a
  day, max daily loss in R, stop after n losses in a row today (the replay's UTC day), a focus rule, "Ask me before trading past my
  plan", "Ask a grade (A / B / C) on each entry". Past a limit a banner (`#pl-ban`) and, only when the owner ticked "Ask me", a
  styled confirm (`msConfirm`, "Trade anyway") before an order: `crGate(go)` is called by `instant()` and the draft's Confirm,
  each handing in its own step, which runs unchanged when the owner says go on (the stop is never touched). The grade: chips in the
  draft readout (`D.grade`) and in the Trade card for the next one-click entry (`#pl-grade`), stored as `rec.grade` and `ctx.grade`;
  "Your grade" is a split of "How you trade" and of the debrief.
- **Debrief** (`#debd`, "End session debrief" on the leak card and "Debrief" on the score line; offered there when the replay
  reaches the session's end or on a pause after 5 or more trades): the free part `BT.coachDebrief` (totals, plan adherence
  `BT.planAdherence`, the top 3 leaks, best and worst trade, results by grade, a focus rule from the top leak). AI on: kind
  `debrief` (`api/_chronos-coach.js` `debriefPayload`, no candles, every field capped; answer `{ summary, leaks 1-3, focus, drill }`
  checked by `parseDebrief` with the same stop and claim rules; its own daily count `CHRONOS_DEBRIEF_PER_DAY` 5, `debrief|<account>`,
  stored in answers.json), streamed. The debrief lives in memory, goes into the session report ("Session debrief") and the JSON
  export (`debrief`); its focus rule (the AI's, or "Use this focus") is kept as `plan.nextFocus` and becomes the focus of the next
  new session that has no trade yet.
- **Productivity**: **A** = the last closed trade's review dialog (`openMist`, now a function) and, AI on, "Ask the coach" on it;
  **Shift+A** = the live coach on and "What do you see?" (outside fields and open dialogs; no other A key on the page). The score
  line `#co-score` in the Trade card: today's trades, R, plan kept / broken, the top leak. `window.ctCoach()` is the audit's
  read-only view. Audit section 40 (seeded saved sessions; screenshots `coach2-leak.png`, `coach2-pattern-draft.png`,
  `coach2-plan-banner.png`, `coach2-plan-confirm.png`, `coach2-debrief.png`, `coach2-debrief-ai.png`).

## Phone sign-in like the owner's Figma example (17 Nov 2026, owner: "and the login as well, only for the phone")
Display only, up to 640 px, one block at the end of `#ms-shell-css`: the gate card is the screen (no frame), the mark centred,
title and one line, the password with its eye, "Continue as guest" and the invitation as quiet centred text, a full-width pill
Sign in at the bottom of the first screen (`.gate-card` flex column, its `form` `display: contents` so the button can sit last;
submitting unchanged), the live strip and proof under it. A device where someone was signed in keeps `localStorage ms-was-in`
(no name, no account) and its phone title reads "Welcome back". Wider screens unchanged; the laptop version is a mockup only.

## Sign in with email or username; unique usernames (18 Nov 2026, owner: "login with email or either username and password … unique username, so no repeated ones")
- **Sign-in** (`api/login.js` `{ id, password }`, `api/_session.js` `login(deps, pw, id)`): `id` = the account's username (its KEY,
  lowercased) or the email on its stored record; the owner is `owner` or `admin`. Only that account is checked; every miss is the same
  401. **Without an `id` only the owner and the built-in members are checked** (owner, 18 Nov 2026: "password-only login, only for
  built in users"; `deps.builtIns || A.BUILT_IN` keys, their current stored hash); sign-up and reset refuse only the owner's or a
  built-in's password (`pwClash`), members' passwords may repeat. The field is optional on the card, which
  asks "Email or username" (`#ms-gate-u`, `autocomplete="username"`, phone order 3 above the password) and sends `id`.
- **Usernames** (`api/signup.js` `userOf`, `USER_RE` 3-24 of a-z 0-9 "-", not starting with "-", case-insensitive; `RESERVED`
  owner / admin / aureum / desk / guest / help / support / root / system / council / member / api): required at sign-up (`#ms-su-u`,
  suggested from the name until typed), 409 `{ field: 'username' }` when a member, a built-in or another waiting request holds it;
  stored on the request, shown on the owner's approval list, and approval makes it the account's key (409 if it was taken meanwhile;
  a request from before usernames gets the old name-derived key). The "seat is ready" email names it. Built-in members' usernames
  are their keys (fred, orlando, luxus, carlos). The Profile hero shows "Username: <key>" (`#ms-pf-user`).
- **The welcome shows the photo**: `msGateWelcome` reads this device's `ms-photo-<name>` / `ms-name-<name>`, else GET `/api/profile`
  (1.5 s cap; a `data:image` only); if the photo is in when the lock turns (780 ms) it pops in inside the drawn green ring with a
  small check badge, else the check stays; the title is "Welcome back, <display name>".
Tests: `tests/signup.test.mjs` ("usernames"), `tests/gate-welcome.test.mjs`.

## Home's forward line, data revalidation, the logo on the sign-in screen (18 Nov 2026, owner: "yes" to the next three builds)
- **Home** (`#hs-fwd`, class `adm`, under the headline, from 641 px): "Live book against its plan: <state> · n positions closed since
  <date>, R after costs · n open · See the forward record" from coach.json `forward` (`MS_FWD.brief` / `home` in `#ms-fw-js`; no new
  figure, nothing fetched; hidden without a reading). Test in `tests/qa-sweep.test.mjs`.
- **msData revalidates**: the last ETag and text per file and variant (`V`, key `m|` / `g|` + file) stay in memory; a later read
  sends `If-None-Match` and a 304 hands back the same text (no body). Only for the site's own `/cdata` (never the raw GitHub copy:
  a preflight). Checked live: `/cdata/snapshot.json` answers 304 with 0 bytes. Test in `tests/desk-load.test.mjs`.
- **Sign-in screen**: the desktop left side leads with the mark at 44 px and a larger wordmark (`.gs-brand`, last style block); on
  phones the card's wordmark is `inline-flex` again (a flex column made it a block and the words ran together: "AUREUMDESK").

## The "macro" account lands on the Macro desk (18 Nov 2026, owner: "the first page for user macro will be the macro area not the desk")
`api/_session.js` `account()` gives the account whose key is `macro` `home: 'macro'` (`api/_accounts.js` `publicRecord` passes
`home` only as `mosha` or `macro`); the Desk's head script sends such a member (role viewer / reviewer, `macro` permission on) to
`/macro-desk` once per browser tab (`sessionStorage ms-landed`), never when the address names a view (`#…`), so the Desk switch
still opens the Desk afterwards. Test: `tests/macro-home.test.mjs`.

## The signed-in screen (18 Nov 2026, owner: "a similar animation for the login")
Display only, `market-structure.html`. On a successful sign-in (password or passkey) the card's contents fade and `#ms-gate-ok`
plays inside the card (`<style id="ms-gate-ok-css">` + `<script id="ms-gate-ok-js">`, before `#ms-su-sent-css`, reusing its
`su-*` keyframes): a padlock pops in and unlocks, squeezes into a green check that draws itself, the glow turns green, confetti
(made by the script), "Welcome back" (a device with `ms-was-in`, else "Welcome"), "Signed in as <name>" as text, and a bar that fills.
`window.msGateWelcome(account)` resolves after about 1.25 s (350 ms under reduced motion, end state only), then both callers reload
as before; any failure resolves at once, so sign-in never waits on it. Nothing is stored. Test: `tests/gate-welcome.test.mjs`.

## Face ID / fingerprint sign-in with passkeys (17 Nov 2026, owner)
Owner: "Face ID or fingerprint login", like the Face ID button of the Figma login. WebAuthn passkeys; the password stays the
primary way in. No npm dependency: `api/_passkey.js` (pure) reads CBOR, COSE keys (ES256 P-256 and RS256 only), authenticator data
and DER signatures (to raw r || s) and verifies with WebCrypto `crypto.subtle`; `api/passkey.js` is the endpoint (Worker route in
`cloudflare/src/worker.mjs`, `vercel.json` `functions`).
- **Ops** (every POST refuses a foreign Origin): `reg-options` / `register` / `rename` / `remove` and GET (list) need the session
  cookie; `login-options` / `login` do not. Options ask for a discoverable credential (`residentKey: 'required'`) and
  `userVerification: 'required'`, attestation `'none'` (not verified; the key comes from the authenticator data). Checked: client
  data type, challenge, origin (the request's own `https://<host>`, or `http://localhost:<port>`), `crossOrigin` not true, RP ID
  hash, UP and UV flags, the signature over authData || SHA-256(clientDataJSON), the sign counter (a counter that does not grow is
  refused once either side is non-zero; synced passkeys that stay 0 pass), the user handle when sent.
- **RP ID** (`rpFor`): `aureumdesk.co.uk` for both aureumdesk.co.uk and www (one passkey serves both); the workers.dev host and
  `localhost` as themselves; env `PASSKEY_HOSTS` adds hosts; any other host gets 400 (no passkey on an unknown address).
- **Challenges** are stateless: HMAC-signed with a key derived from the session key (`S.secret`), bound to the operation, the RP ID
  and (registration) the account, 5 minutes; a used nonce is kept in the store until it expires, so a challenge works once.
- **Sign-in issues the same session as `/api/login`** (`S.issue`, `S.setCookie`, answer `{ account }`; a test compares the two).
  The account is re-read from the user list (removed / disabled: refused; list unreadable: 503, fails closed). Each passkey keeps
  `fp` = the session's keyed fingerprint of the password hash it was made under (`S.fingerprint`): **a password change ends every
  passkey of that account**, as it ends sessions (code `password-changed`, the page says to turn it on again). Failed sign-ins count
  in `api/_guard.js` with failed passwords (429 after 10 from one address). The owner may use a passkey too.
- **Store**: one private file `passkeys/all.json` (`{ creds: { <credential id>: { u, alg, pub (JWK), counter, fp, name, at,
  used } }, seen }`; public keys only, no hash), overwritten in place and read with `cache=0` (the freshness rule; listed in
  `tests/blob-fresh.test.mjs`), one write at a time per instance. At most 10 passkeys a member, 2,000 in all. Device name from the
  User-Agent (iPhone, Mac, Android phone…), renamable.
- **Page** (`market-structure.html`, one self-contained block right after the sign-in card: `<style id="ms-pk-css">` +
  `<script id="ms-pk-js">`; `window.MS_PK`): the button `#ms-gate-pk` / `#ms-gate-pkb` "Use Face ID or fingerprint" (face-scan glyph)
  sits in the form after Sign in, shown whenever WebAuthn exists on a secure page with the API; on the phone (<= 640 px) it is
  icon-over-label, centred under the password (`order: 5`, above the bottom Sign in pill); wider, a secondary button under Sign in.
  The password field has `autocomplete="current-password webauthn"` and the script starts conditional mediation, so a passkey is
  also offered in the field's own suggestion list. Success = the password form's path (store `ms-acct`, reload). Errors in words in
  `#ms-gate-err` (cancelled or no passkey here -> "Sign in with your password, then turn on Face ID in your Profile"; removed;
  password changed; 429; offline). Profile: switch row `#ms-pf-pkrow` ("On for this device" / "Off") in the account list, a More row
  `data-pf-go="ms-pf-pk"` and the card `#ms-pf-pk` (devices with Rename / Remove, "Turn on for this device"); hidden for guests
  and where WebAuthn is missing. After a password sign-in (a `sessionStorage ms-pk-pw` flag set on submit) on a device with a
  platform authenticator and no passkey here, `#ms-pk-offer` asks once per account and device ("Turn on Face ID for next time?",
  `ms-pk-asked-<u>`). Browser storage holds only public ids and flags: `ms-pk-<u>` = this device's credential id.
- Tests: `tests/passkey.test.mjs` (12: a software authenticator built with WebCrypto, real CBOR attestation objects and DER
  signatures, P-256 and RSA; refusals for origin, RP ID, challenge (foreign, other account, expired, reused), UV, signature,
  counter, user handle, removed / disabled / password-changed accounts, unreadable list, own-only rename / remove, the 10 limit,
  the rate limit; a CBOR unit test). Checked end to end in Chromium with a CDP virtual authenticator (register from the offer,
  Profile switch, sign-in through the suggestion list and through the button, `/api/me` after, remove, refusal after removal).
  Not checked: real Face ID / Touch ID / Android hardware, Safari and iCloud-synced passkeys, the live Worker and Blob store.

## Profile photo and name on the server (8 Nov 2026, owner: "the profile photo gets back to default")
They lived only in localStorage (`ms-photo-<name>`, `ms-name-<name>`), which Safari and the home-screen app keep separately, other
devices never see, and Safari wipes after about a week without a visit. `api/profile.js` stores them per account in the private
Blob store (`profiles/<key>.json`): GET `/api/profile`, POST `{photo?, name?}`; the account comes from the session cookie (9 Nov;
it used to trust a hash sent by the page), re-checked against the user list (removed users refused; fails closed); each account
reads and writes only its own record; photo must be a JPEG / PNG data URL under 160 KB. The account area (`pullProfile` on load, `pushProfile` on change / remove /
rename) keeps localStorage as the cache and uploads a browser-only photo once. Tests: `tests/profile.test.mjs`.

## Server-side sign-in (9 Nov 2026, security fix, owner: "Fix it properly")
The audit found password hashes readable by anyone (GET /api/users, `window.MS_USERS`, `MS_ADMIN_HASH`) while the page used a hash
as the session (localStorage `ms-admin`), so a pasted hash acted as that account and `/api/profile` took `{u, h}`; owner-only views
were CSS-hidden and /cdata served every file. Now:
- `api/_accounts.js`: `OWNER_HASH`, built-in members `BUILT_IN` (moved from the page), `userList` (built-ins overridden by the Blob
  list, disabled removed, "owner" reserved; throws 503 when the list cannot be read = fail closed), `blobUsers` (first-run fallback
  reads council-data users.json on the server, never through /cdata), `publicRecord` / `stripHashes`.
- `api/_session.js`: token = base64url JSON `{v:1, u, n, r, f, pv, iat, exp}` + HMAC-SHA256; `f` = keyed fingerprint of the
  password hash (a password change or a re-used key ends old sessions), 30-day expiry. Key: env `SESSION_SECRET` if set (16+ chars),
  else HMAC(`CTRADER_LINK_KEY` or `CRON_SECRET`, "meridian-x/session/v1"); none set -> sign-in 503. Cookie `ms_session`: HttpOnly,
  Secure, SameSite=Lax, Path=/. State-changing calls also refuse a foreign `Origin`.
- `POST /api/login {password}`: constant-time compare against the owner and every member (no early exit); every failure is the same
  401 "Password not accepted"; 503 when the list is unreadable. Returns `{account: {u, name, role, ict?, ct?, mcp?, perms?}}` + cookie.
  `POST /api/logout` clears it. `GET /api/me` re-checks the list on every call (current role / perms; removed or new password ->
  `{account: null}` and the cookie cleared; renews a session older than a day; 503 when unreadable).
- Session checks: `/api/profile`, `/api/users` (above), `/cdata` (`api/data.js`, user list cached a minute per instance), and the
  owner's session also opens `/api/bridge` downloads and the `/api/tv-webhook` URL/log (the owner password still works there).
  ctrader-link, mcp `mykey`, users `ownerPw` keep taking the real password.
- `/cdata` guest allowlist `GUEST_OK` (api/data.js, public edge cache + CORS; since 11 Nov a guest gets these files CUT, see "Sign-in card and guest page"): trades.json, snapshot.json, ict/replay.json,
  research/replay-2w.json, research.json (guest view, sign-in card proof, guest results/calendar) and mt5/signals.csv (the EAs).
  Everything else: 401 without a session, `Cache-Control: private, no-store`, no CORS. Never served: ctrader/tokens.json, users.json.
  `loadCouncil` fetches only the guest files for `PUB` (same list). `api/status.js` / `api/pine.js` read council-data with
  `readFile` instead of fetching /cdata.
- Page: head script reads localStorage `ms-acct` (non-secret account info) to draw owner / member / guest at once (`data-mode`,
  `data-role`, `data-deny`, `msPerms` unchanged); after load `/api/me` confirms it and the page reloads only when the answer differs.
  Old `ms-admin` / `ms-user` / `ms-user-rec` are ignored and cleared: everyone signs in once again. The gate posts the password to
  `/api/login`; `msSignOut()` calls `/api/logout`. `MS_ACCT.u` replaces `ms-user` (cTrader link, MCP card). The Users page gets the
  built-ins' public records from `/api/users` (`window.MS_USERS`, empty otherwise).
- `backtest.html` (ChronosTrade) and `macro-desk.html` ask `/api/me`; signed out they show "Sign in on the desk first".
- GitHub Pages / local copies (`github.io` or file:): no API, so no sign-in (the gate says so); the guest view reads the public raw
  council-data as before (`MS_CDATA` unchanged), and the macro desk there skips the check. Once the repo is private those copies
  show nothing; meridianx.dev is the site.
- Tests: `tests/auth.test.mjs` (login, same error, disabled, fail closed, tamper / expiry, /api/me refresh, users without hashes,
  cdata allowlist), `tests/profile.test.mjs`, `tests/security-review.test.js`. The ChronosTrade audit stubs `/api/me`.
- The old hashes were public for days: the members' and the owner's passwords should be changed (Users page "New password";
  the owner's in `api/_accounts.js`). Still open on 9 Nov, with stronger hashing: docs/owner-decisions.md items 1-2.

## Styled dialogs (8 Nov 2026, owner: native prompt boxes "very ugly")
`assets/ms-dialog.js` replaces the browser's prompt / confirm / alert on market-structure and ChronosTrade with a `<dialog class="msd">`
themed from page tokens: `await msAsk(label, value, {title, ok, type, max})` (null on cancel), `await msConfirm(msg, {title, ok, danger})`,
`msAlert`, `msCopy` (clipboard fallback). `window.alert` routes to it. Don't add native `prompt(`/`confirm(` calls; the audit clicks
`dialog.msd button.pri`.

## Macro veteran revision 1.3 (9 Nov 2026, owner: "update veteran macro with this new info")
Batch rev 1.3 installed the 1.2 way: `START_HERE.md` added at the root, new `outputs/` in `references/` (CPI first-print ledger
2022-24, BLS release-integrity case, Treasury CPI-day study with its Python scripts, FOMC-exclusion variant), new `work/*.md` in
`notes/`; `work/` scripts, JSON review dumps, `work/raw/` (about 78 MB) and `batch-inventory.json` stay out (README.md lists
them). README.md's "## What's new in 1.3" bullets feed `index.json.whatsNew` (desk: "What's new" in the library tab; group
"Release integrity and rates study"; `validation.tests` falls back to the packaged Python tests since 1.3's validation.json has
no `forecast_tests`). `veteran.mjs` (`SKILL_VERSION '1.3'`) ports the release discipline: `captureExpectations` keeps an
append-only `macro/veteran-expectations.json` (one record per playbook release: calendar consensus captured before the release,
never edited; the first print attached once, never replaced by a revision; flagged if first seen before the scheduled time or
more than `PRINT_LAG_HOURS` 48 h after); `releaseCheck` scores a surprise only as print minus the captured expectation when all
checks pass (never print minus previous) and, for CPI, reads the release-day 10Y TIPS change against `CPI_RATE_STUDY` (6.11 vs
4.06 bp, descriptive); `releaseView` → `veteran.json.releases` (desk: "Releases" in the veteran card). An untrusted print adds
a note to the verdict; no probability, rule or trade changes. `CLAIM` labels (descriptive association / prospective prediction
/ causal / execution) on the hypothesis card (`claimType`) and release records; `cpiPilot().label` never calls the unresolved
pilot scored. Not ported (reading only): the NBU gold route, the Cleveland-vs-baseline plan, the GLD study.

## Macro veteran: the 1.4 research outputs (18 Nov 2026, owner uploaded three zips)
`research/macro-veteran/`: the new and changed `outputs/` files are in `references/` and the authored `work/*.md` in `notes/`
(the 1.2 / 1.3 rule; scripts, raw captures, the synthetic CPI-resolution rehearsal and the forecast-schema test cases stay out).
README.md "What's new in 1.4 research outputs" feeds the library (`index.json.newIn` = the heading's own words, since SKILL.md is
still 1.3: `SKILL_VERSION` unchanged). Rule 6: product names in the markdown were made neutral (as in 1.3);
`cpi-model-benchmark-protocol-2022-2024.json` is left out (it names a product and its bytes are bound by a published SHA-256, so
it is never edited; the `.sha256` stays). **The CPI pilot**: the batch appended a `record_type: "resolved"` line with
`outcome: null` (a pending attempt: today's archive shows 0.3%, the original release-day evidence is unauthenticated). Both readers
(`council/veteran.mjs` `cpiPilot`, `scripts/veteran-index.mjs` `cpiPilot`) count a resolution only with a numeric outcome; a null
one is `pending` (the desk and /veteran/ say "unresolved · 1 resolution attempt on file, no qualifying first print yet"). Before
this fix the desk would have called it "resolved against the BLS first print". Tests: `tests/veteran.test.mjs`,
`tests/veteran-library.test.mjs`.

## Macro veteran revision 1.8 (19 Nov 2026, owner: "more stuff to implement on macro")
The 1.5 top-level files (SKILL.md 1.5, START_HERE.md, DATA_LICENSES.md, validation.json, and `package-tests.txt` kept because
1.5's validation.json has no test counts) and the 1.8 combined news batch (the 1.6-1.8 increments) installed the 1.3 way:
`outputs/` into `references/` (handoff readmes renamed `v1-6-…`, `v1-7-…`, `v1-8-…`), assistant and tool names in the text made
neutral (rule 6); left out: the `work/` Python scripts and five overlap JSONs carrying raw-file paths from the author's computer
(their `.md` notes were already in `notes/`). `scripts/veteran-index.mjs` reads the revision from README.md's title (else
SKILL.md), the test count from `package-tests.txt` when validation.json has none, and has a "News and release research" group.
`SKILL_VERSION` '1.8'. What it adds (README "What's new in 1.8"): PPI before CPI in 5 of 36 months; CPI + PPI → PCE no robust
added skill; a 36-release jobs ledger (payrolls, unemployment, earnings, hours, revisions); pre-release consensus deliberately
EMPTY (never a "surprise" from it); 7 verified same-day ISM overlaps on jobs days; a ten-hypothesis news register, none
validated. Library only: no council member, probability, rule or trade reads it.

## The veteran reads the release ledgers before the next release (19 Nov 2026, owner: "this cannot be only just notes, he needs to get insights for the next results")
`council/news-context.mjs` (pure + `loadBatch`, which reads three 1.6-1.8 batch files from `research/macro-veteran/references/`; null in a
bundle without them): `facts` (from the 36-month CPI / PPI / PCE panel, the 36-release jobs ledger and the ISM overlap list),
`kindOf` (US CPI, PPI, PCE, NFP, ISM, FOMC statement; speakers and minutes are not a statement), `contextFor(card)` = points for one
upcoming release: PCE = the core PCE that went with this month's core CPI print in 2022-24 (an in-sample fit on 36 months, a ± typical
miss; when no print is on file a 0.2 / 0.3 / 0.4 lookup: the Forex Factory feed carries no actuals), CPI / PPI = the release order
(PPI first in 5 of 36), NFP = the two-month revisions (negative in 22 of 35), hours, an ISM the same day, FOMC = a CPI within two days
before (4 of 24 meetings) and statement vs press conference; `ahead` = one point for each US release of the next 7 days. Calendar =
macro/cache.json `cal` (`calendarOf`) and the veteran's captured expectations. `veteran.mjs` `build` puts `e.batch` on each event card
and `v.newsAhead`; the Macro desk shows them on the Next release card (`#nx-batch`, "What the 2022-24 record says", "Later this week")
and in Your read → This week (+ the copied text). Facts and descriptive fits with their n: never a surprise (no consensus from the
batch is used), never a call on the record, a rule or a trade. Test: `tests/news-context.test.mjs`.

## The veteran reads the owner's briefs and research maps (19 Nov 2026, owner: "all this stuff I've sent you about macro and fundamentals, you are not using it")
`council/research-watch.mjs` (pure + `loadDocs`; run inside `veteran.mjs` `build` → `veteran.json.research`, cards' `research`)
checks five batch documents' OWN conditions on the data the council already has (fetches nothing): the 7 Nov gold brief's three
scenarios (4-week real yield, dollar, gold against its late-October low, managed money; "correction" needs real yields and the
dollar rising together), the funding research map's evidence ladder on the strategist's gauges (SOFR-EFFR, broad dollar, HY
spread, VIX curve; its own words per level, and a caution when the strategist's "stress" label lacks a funding-market
confirmation), the Japan brief's "global yields dominate" scenario (US 10Y vs USD/JPY over 4 weeks), the positioning map's
weekly COT note, and the news-trading register V2 (N1-N10, `hypIds`) on each release card ("What your news register says to
test", never validated). Desk: card `#c-res` "Your research, applied" in Why. Display only: no probability, call, rule or trade
reads it. Same day (owner: "do the next ones too, nyfed surveys and cpi plan"): the NY Fed Survey of Market Expectations'
two verified cells (source contract: the panel's expected year-end-2027 SEP median, n 61, and its 2026 core PCE, n 58) beside
today's 2-year yield (`nyfedSurvey`, with the clock caveat: results published after the meeting, never a pre-release
consensus), and the October CPI pre-release plan generalized to every US CPI card (`cpiPlan`: its interpretation matrix,
response windows, and the confounders the calendar shows: a same-day auction, a Fed statement within two days, a same-half-hour
US release; desk "Your CPI plan"). Then (owner: "do china briefs too") the September China briefs (NBS property, MOF local
fiscal; `chinaBriefs`): their figures read from their own tables, a staleness line once the next NBS / MOF release should be
out (about mid-month after the month), and the next CNY release on the strategist's calendar. Then (owner: "do all the content
you think might be useful"): on CPI cards the 2022-24 CPI model benchmark (`cpiBenchmark`: core nowcast vs "same as last
month" vs a 50/50 blend, headline too, and this release's persistence baseline from the calendar's previous), on every card the
expectation timing gates (`consensusGate`: missing / late / context; a Forex Factory value is never above the gate for a scored
surprise; the Cleveland nowcast must be the pre-08:30 ET value), and on US GDP cards the 2023 Q3 revision case (`gdpCase`: SAAR to
quarterly, parts over headline, revision is not surprise). Left out on purpose: the issuer, producer, oil-major, bank and credit
cases (equities, not this desk), the NBU gold notes, and the playbooks already ported in code (regime framework, gold driver map,
calibration, yield decomposition). Tests: `tests/research-watch.test.mjs`.

## Red folder study (19 Nov 2026, owner: "a section of the most important red folders … study, compare previous months, the news, what we expect, what came out, how the market reacted, so we can prepare")
`council/redfolder.mjs` (pure + `loadInputs`; run by `veteran.mjs` `run()` → council-data `macro/redfolder.json`; a failure writes
nothing). Types CPI (core + headline), jobs report (payrolls, unemployment, hourly earnings), Fed decision, core PCE, PPI, retail sales,
ISM manufacturing, GDP. Per release since 2022: **expected** = the calendar consensus the council captured before it
(veteran-expectations, events.json, the calendar cache; a calendar value, not a survey) or, CPI 2022-24, the Cleveland model from the
batch (labelled model); **printed** = the batch's first prints 2022-24, else the current FRED value of the reference month (m/m to one
decimal as printed; can include revisions); prior; surprise only against a captured consensus; **gold / dollar** = UTC release-day
close vs the close before (council daily closes) and first 5 / 60 minutes from `council/event-base.json` (to Oct 2026). Dates from
`council/events.mjs` (history and the 2025-26 schedule), event-base, the batch and the captures. Per type: the next release (calendar
consensus when listed, else the schedule date), and descriptive summary lines (median day move, up share, higher vs lower than the
prior, above vs below consensus once 6+ captured). The strategist (`macro.mjs` `releaseSeries`) fetches the ten FRED release series
(`RELEASE_FRED`) once a UTC day into `cache.release`, never while FRED is unreachable that run. Desk: section 3 `#s-red` "Red folder
study" (tabs per type, `localStorage mdRed`; phones show 6 rows then "Show all"). Descriptive only: no rule, call or trade reads it.
**Consensus history** (19 Nov 2026, owner: "add the consensus history so expected isn't empty", chose "use it, label it"):
`council/consensus-history.json` = the US releases of these types from the community copy of the Forex Factory calendar
(Hugging Face `Ehsanrs2/Forex_Factory_Calendar`, MIT as tagged by its uploader; 2018 to 4 Apr 2025, 929 rows of title, time,
consensus, actual, previous), built by hand with `node scripts/consensus-history.mjs <csv>`. The copy's clock is wrong on about
half its rows (00:00, or a display-zone offset), so each row is put on its New York release time on its local DATE (08:30; ISM
10:00; Fed 14:00): every CPI / NFP / FOMC date the council knows matches exactly (test); ADP is not payrolls; the two
unscheduled March 2020 Fed moves (no consensus) are left out. Shown as `expSrc` "Forex Factory via a community dataset" (the
table's caption counts each source); its actual is used only where the batch has no first print (`actSrc` 'calendar'). The study
now starts in 2018 and keeps 120 rows a type (the desk shows 18, then "Show all"). Nothing is on file between April 2025 and the
council's own captures of November 2026. A calendar consensus, not a verified survey.
Tests: `tests/redfolder.test.mjs`.

## Week ahead (20 Nov 2026, owner: "focus on improving the macro and fundamental so next week we can smash the markets")
`council/week-ahead.mjs` (pure + run from `veteran.mjs` `run()` after the Red folder study → council-data `macro/week-ahead.json`; a
failure writes nothing). The coming trading week day by day: from Friday (New York date) on, next Monday to Friday, else the rest
of this week (`weekOf`). Per day: US market holidays and early closes (`ict/calendar.mjs` `cmeYear`; `nyseHoliday` = CME's full
holidays plus the named ones CME only shortens), the releases (`releasesOf`: the strategist's calendar `cache.cal`, high impact any
currency + US medium of the Red folder types; the council's own schedule `council/events.mjs` fills what the calendar lacks, so the
big US releases show before Forex Factory publishes next week), each US release with its Red folder record (`recordOf`: median gold
move, up share, above / below consensus from `macro/redfolder.json`), and the calendar rules the desk has TESTED (`RULES`:
gold-pre-holiday, post-holiday-metals, gotobi, turnaround-tuesday-forward, gold-turn-of-month) with their own study's verdict and
headline (`research-ledger.mjs` `studyRow`) and the forward record's latest reading (`research/forward/<x>.json`). A failed study
is listed as "Tested: failed" so it is not chased; a pass is never called an edge. The frame: Gold Macro Score (a negative score is
not a sell), regime, the veteran's levels and month call, the rule book's readings that are on, and the week's dated calls once
issued. The Sunday 21:15 UTC phone digest carries its first three top lines (`digest.mjs` `weekAheadLines`, only when the file covers the coming week; the preview may run to 21 lines; `tests/digest-week-ahead.test.mjs`). Macro desk section `#s-ahead` "Week ahead" (after Daily reports, TOC chip, folds on the phone), `renderAhead`, every string
as text. Display only: no rule, size, call or trade reads it. Add a calendar rule only with a committed study. Test:
`tests/week-ahead.test.mjs`. **Nowcast beside the consensus** (20 Nov 2026, `prepFor`, `parseExp`): a CPI / PCE release with a
calendar consensus and a Cleveland nowcast gets `prep` (core nowcast for a "Core" title, else headline; `side` above / below / in line
under `IN_LINE` 0.05 points) with the Red folder study's average gold day move on past prints above / below consensus (only with
`MIN_PREP` 6+ a side) and the caveats "a model's estimate, not a forecast; a calendar consensus, not a survey; descriptive, not a
tested edge"; one top line "Before <day>'s …" each. Test: `tests/week-ahead-prep.test.mjs`.
**Browser pass (20 Nov 2026)**, display only: the frame's parts ran together on one line (`.wa .wa-r` is a block now), the
study links were 16 px tall on touch (`a.wa-st`, 44 px on a coarse pointer), and a study link / verdict from the file reached an
`href` / class unchecked (`WA_HREF`: only `/<page>.html#<anchor>` of this site; a class only for pass / fail / inc). Checked at
390 px touch and 1440 px in three themes: no text under 12 px or under AA, no sideways scroll. Test: `tests/macro-ahead-ui.test.mjs`.
**Final browser check with real next-week data (20 Nov 2026)**, display only: each day's range line read "Gold, typical move: A typical day's move is …" and ended in the same caveat five times (`WA_RG` drops the echo, the caveat is said once under the days, `.wa-rgn`); two or more positioning lines of the frame are one "Positioning (CFTC)" block with their shared caveat once (`WA_POS_TAIL`); a viewer whose clock is UTC is not told the release time twice (`WA_LOC`); on a phone the Daily reports tabs take the row ("World economy" wrapped). Second pass the same day with real next-week data (ranges, auctions, COT lines): the day's gold range read like the faint "no release" note beside it, so it is labelled "Gold range:" in `--ink-dim` (`.wa-rg`); nothing else to fix (0 texts under 12 px or AA, no cut-off, 44 px links, at 390 touch and 1440 in three themes).
`tests/week-ahead.test.mjs`. **Positioning** (20 Nov 2026): `positioningOf(cot)` (veteran.mjs hands it `macro/cot.json`) adds
`frame.positioning` and one frame line per market of gold, silver, EUR, JPY, NQ, ES only when crowded (3-year percentile >= 90 /
<= 10) or a big week (|z| >= 1.5, the COT desk's flow cut), with net, percentile and report date; the yen futures' inversion said
plainly; "positioning, not a tested signal" unless the COT study passed a cell there. Test: `tests/week-ahead-cot.test.mjs`.
`tests/week-ahead.test.mjs`. **How big a day** (20 Nov 2026, `dayRange` → `d.range`, a quiet line `.wa-rg` under each day
heading): a normal gold day = the strategist's `fc.assets.gold.expMovePct` of its `last` price, in $ and %; on a day with a US Red
folder release, that type's median absolute day move (`stats.absMed`, else from its rows) only with n >= `RANGE_MIN_N` 8; thin-
trading words on holidays and early closes; "a range for planning, not a forecast of direction"; no forecast = no range. Test:
`tests/week-ahead-range.test.mjs`.
**A normal day now** (20 Nov 2026): `normalDays(fc)` → `frame.normalDays` = one line per market of forecast.json `assets` (gold $, EUR/USD and USD/JPY pips, NQ / ES points, from `expMovePct` x `last`; `volRatio` >= 1.3 "1.4x its usual", <= 0.75 "quieter than usual"), drawn as ONE frame item with "A range for planning, not a forecast of direction." Test: `tests/week-ahead-normal.test.mjs`.

## Week in review (20 Nov 2026, owner: "Lets make an area for week review of the market")
`council/week-review.mjs` (pure, no imports; run from `veteran.mjs` `run()` after the Week ahead → council-data `macro/week-review.json`;
a failure writes nothing; `datahealth.mjs` warns at 150 min). The counterpart of the Week ahead: what the markets the desk follows DID.
The week = Monday to Friday (UTC days) of the last gold close on file: "so far" until Friday's close is in (`complete`), so on a Monday
before any close it still shows the week just ended. Per market (`MARKETS`: gold with traded high / low, the dollar index, EUR/USD,
USD/JPY, S&P 500, Nasdaq 100; rows `{ t, c }` or `{ t, v }`, weekend stubs and the forming day left out): the move from the last close
before the week, each day's move, the week's high / low, `times` = the move against a normal week (median absolute weekly move of up
to 52 complete weeks before, n/a under 12), the run of weeks the same way, the last 8 weeks. Also: day by day gold and the dollar with
that day's red-folder releases (expected / printed, from `macro/redfolder.json`), the veteran's dated calls that came due and are
scored (hits against the sum of his odds), the Gold Macro Score against a week before, and plain `lines`. Macro desk section
`#s-review` "Week in review" after Week ahead (TOC chip, folds on the phone; `renderReview`, every value as text; styles "Week in
review" beside the Week ahead's, tokens only). Descriptive: no rule, size, call or trade reads it. Test: `tests/week-review.test.mjs`.

## Hard-to-find data (20 Nov 2026, owner: "Hard to find information will play a big role here, try to get it")
`council/hard-data.mjs` (council.yml every 6th round, right BEFORE the veteran, `timeout 120`; → council-data `macro/hard-data.json`):
keyless public sources, each checked from a GitHub runner first (`scripts/macro-probe.mjs` + `.github/workflows/macro-probe.yml`, runs
on a PR that changes them; the build sandbox reaches none of these hosts): the **Cleveland Fed inflation nowcast** (`nowcast_month.json`,
FusionCharts charts, one per target month: CPI / core CPI / PCE / core PCE m/m and the "Actual" prints; `parseNowcast`), the **Atlanta Fed
GDPNow** (FRED `GDPNOW`, `parseGdpNow`), **prediction-market odds of the next Fed decision** (Kalshi `KXFEDDECISION-<YY><MON>` markets,
mid of bid / ask else last; Polymarket public-search for "fed decision in <month> <year>", the event ending within 3 days of the meeting;
`nextFomc` from `council/events.mjs`), and **the Fed's own calendar** (`federalreserve.gov/json/calendar.json`: speeches, testimony,
FOMC, Beige Book, 2 days back to 14 ahead; `parseFedCal`). A failed source keeps its last good copy and says so in `sources`
(`datahealth.mjs` warns). The Week ahead reads it: the nowcast on a CPI / PCE release whose reference month has no actual print yet
(`nowcastFor`; "a model's estimate, not the consensus"), the Fed calendar on its days, the odds and GDPNow in the frame, a "Before
the print" and an odds line on top. Context only: the odds are "what traders pay, not a forecast of ours"; nothing reads it for a
rule, call or trade. The 06:30 world report (`council/daily-report.mjs`, `hd`) carries it too: "Before the print: …" and the
Fed's own events of the New York day under Today, the odds and GDPNow under What we expect, then up to four `moves` lines (how they moved over the day and week), and the day's Treasury note and bond auctions under Today (`tests/daily-report-hard.test.mjs`). The Week ahead draws each release's `prep` ("Nowcast beside the consensus") as text. First readings (20 Nov 2026): 9 Dec FOMC hike 25 bp 92% (Kalshi) / 92.5% (Polymarket); October core PCE nowcast
+0.27%, headline +0.31%; GDPNow Q4 3.2%. Not usable from a runner on 20 Nov: GLD holdings (the CSV URL now serves a PDF), CME gold
stocks (binary .xls), the Treasury's upcoming-auctions API (stale), Forex Factory's next-week file before the weekend (404). Test:
`tests/hard-data.test.mjs`.
**Memory** (20 Nov 2026): the file keeps `hist` (`histEntry` / `addHist`): one compact reading per UTC hour (a second run that hour
merges), 14 days (`HIST_DAYS`): Kalshi's top 3 `{ label, p }` with the meeting, each nowcast month still waiting for a print (printed
series null), GDPNow `{ quarter, value }`; only parts read fresh that run (a kept copy is never recorded again). `moves(hd, now)` =
plain lines "92% now, 90% a day ago, 85% a week ago" (newest reading at most 6 h old; day = 20-30 h back, week = 6-8 days; same
meeting / month / quarter only; nothing without an earlier reading); the Week ahead puts them in `frame.lines` (`frame.moves`) and
`bigOddsMove` (5 points or more over a week) on top. A change in what a model or traders say, never a signal. Test:
`tests/hard-data-history.test.mjs`.
**Treasury auctions** (20 Nov 2026): `auctions` = the notes, bonds, TIPS, FRNs and 52-week bill announced for yesterday to +14 days
(`parseAuctions`, `auctionText`; other bills left out), from TreasuryDirect `TA_WS/securities/announced?format=json`, then
`…/upcoming`, then the stale Fiscal Data file (the first with auctions in the window wins; all failing keeps the last copy); the
Week ahead puts them on their day (`d.auctions`, text) and in the day line. Checked from a runner on 20 Nov 2026: TreasuryDirect's rows carry no `auctionDate` key, so the
parser takes any "auction ... date" key; first read: 2-year $69bn (23 Nov), 5-year $70bn + 2-year FRN + 52-week bill (24 Nov), 7-year $44bn (25 Nov). Test: `tests/hard-data-auctions.test.mjs`.

## Hard-to-find data, second batch (20 Nov 2026, owner: "More focus and effort on Hard-to-find data info and sources")
`council/hard-sources.mjs` (no imports; pure parsers + `collectMore`, called at the end of `hard-data.mjs` `collect`, each part failing
alone and keeping its last copy). About 80 candidate keyless sources were read once from a GitHub runner first (probe 3, taken out
after use); what answered and is read every macro round into `macro/hard-data.json`:
- `priced` (Kalshi `events?series_ticker=X&with_nested_markets=true`, `LADDERS`: KXCPICORE, KXCPI, KXPCECORE, KXPAYROLLS, KXU3, KXGDP,
  KXFED (3 meetings), KXRECSSNBER, KXGOLDMON, KXJOBLESSCLAIMS ("At least x" rungs), KXISMPMI, KXADP, and KXCBDECISIONJAPAN read as named
  outcomes (`choice`: the most likely one, the next from 10 %); 700 ms between calls, a runner got 429 after about 13 in a row): an "Above x" ladder
  (`ladderOf`: price = middle of a bid / ask at most `WIDE` 0.15 apart, else the last trade; never rising with x) becomes the most
  likely print and its chance where the print has a grid (`buckets`, step 0.1; the Fed's upper bound 0.25), else the ladder's middle
  (`quantile`); fewer than `MIN_RUNGS` 3 priced rungs = not read. Always "what traders pay: not a consensus survey and not a forecast of ours".
- `auctionResults` (TreasuryDirect `auctioned?days=150`; the day is `competitiveAuctionCloseDate`, shares from the
  `indirectBiddersCompetitiveParAwarded`, `directBidders...` and `primaryDealers...` fields): notes, bonds, TIPS, FRNs of the last 10
  days, each against the earlier auctions of its original tenor (`tenorOf`: a "9-Year 10-Month" reopening is a 10-year), "softer /
  stronger" at `SOFT_BTC` 0.1 either way.
- `plumbing` (NY Fed `rates/all/latest.json` and reverse-repo operations, Fiscal Data `operating_cash_balance` (the closing balance
  sits in `open_today_bal`), FRED WALCL / WRESBAL / IORB): SOFR against the rate on reserves (5 bp or more over = "reserves getting
  tighter"), net liquidity = balance sheet - Treasury cash - reverse repo, with its 4-week change. "A rough gauge, not a signal."
- `vol` (Cboe `daily_prices/<ID>_History.csv`: GVZ, VIX1D, VIX9D, SKEW, VVIX, OVX; the OFR Financial Stress Index csv): GVZ as a
  one-day move (divided by the square root of 252) with its place in the last 252 readings. "The size traders pay for, not a direction."
- `under` (FRED: trimmed-mean PCE, sticky CPI, median CPI, wage tracker, one-year expected inflation, claims, WEI, term premium).
`board(hd, { goldPx })` = titled groups `[{ k, title, src, at, lines }]` -> `week-ahead.json` `hard`, drawn by the Macro desk in the Week
ahead as the fold `#wa-hard` (text, each group with its source and read time). `pricedFor(hd, type, t)` puts a ladder on its own
release (same type, closing within 36 h) -> the release's `priced` and one top line; the morning report adds two priced lines and
gold's implied day under "What we expect" and yesterday's / today's auction results under what happened. `hist` records the leading
print and its chance (`priced`) and GVZ; `moves` says how that chance changed over a day and a week (kind `priced`). Answered 403 or
unusable from a runner: Cboe delayed quotes and put/call, LBMA prices, GLD holdings (PDF / xlsx), iShares (HTML), the Atlanta Fed
tracker (404). Answered but not used yet: Polymarket economy
tags, NY Fed primary-dealer and SOMA files, the 5-7 MB Cleveland year / quarter nowcast files. Context only: no rule, call or trade
reads any of it. Tests: `tests/hard-sources.test.mjs`, `tests/hard-board.test.mjs`.
**Later the same day**: `official` = the agencies' own release calendars (`collectOfficial`: BLS `bls.ics`, times in New York through
`nyToUnix`, and BEA `release_dates.json`; `OFFICIAL` maps a title to the Week ahead's type; 2 days back to 21 ahead; one agency
failing leaves the other): a board group "The agencies' own release dates", and `onOfficial(hd, type, t)` lets the Week ahead say
"Check the date: … the agency's own release calendar has no such release that day" (only when that agency's calendar was read and
covers the day; null = say nothing). `besideNowcast` puts the Cleveland Fed nowcast beside a priced CPI / PCE print ("rounds to the
same print" / "the model and the traders differ"). Probe 4 (taken out after use) found no open Kalshi series for PPI, retail sales,
headline PCE, JOLTS or the ECB.

## Your plan for the week, and the source scorecard (20 Nov 2026, owner: "make it in a way I'm able to use all of our work for the next weeks to increase accuracy")
`council/game-plan.mjs` (pure; imports `jsonio.mjs` only). (1) `planOf(days, hd)` -> `week-ahead.json` `plan { routine, cards, note }`:
one card per US release of a known type (the day's rows of one type share a card, core first; a row from the council's own schedule
stands for the core figure): **Before** = what each source says (calendar consensus, Cleveland Fed nowcast, a prediction market's
most likely print, `sourcesOf`), whether they agree or differ, the Red folder record's above / below line, "Check the date" when
the agency's calendar lacks it; **At the print** = the tested facts for that type (`FACTS`: `red-folder-surprise` 60 of 83 first
five minutes with the miss and the failed chase, CPI / NFP; `gold-release-quotes` spread about 18x at T+5 s, CPI / NFP / FOMC;
constants a test compares with each result.json), else "no test of the first minutes exists"; **After** = the type's median gold day
move, the day's typical range, and where the print gets compared. `ROUTINE` = six fixed steps (Sunday, each morning, the evening
before, at the print, after the close, Friday) with where each is on the site. (2) **Source scorecard**, council-data
`macro/source-record.json` (append-only; `capture` / `resolve` / `score` / `updateFile`, run by `veteran.mjs` `run()` after the prep
record -> `week-ahead.json` `sources`): per m/m CPI / PCE row still to come (id `<type>:<month>:<core|headline>`), each source's
figure written the FIRST time it is seen before the release with its own time (`at.<source>`), never edited; after the release the
first print on the nowcast file is attached once with each source's miss (`err`), whether it had the exact one-decimal print
(`exact`) and which was `closest`. `score`: under `MIN_SCORE` 10 scored "too few to judge", else each source's mean miss and
exact count; "a forward record, not a tested edge". Only CPI / PCE resolve (the nowcast file carries their prints; it keeps three
months). Macro desk: fold `#wa-plan` "Your plan for the week" (open, first in the Week ahead card; cards, the scorecard's line,
the routine in its own fold; every string as text). No rule, size, call or trade reads either; never call a source "accurate"
before the scorecard has its 10. `datahealth.mjs` lists the file. Test: `tests/game-plan.test.mjs`.

## Nowcast against consensus: a forward record (20 Nov 2026)
`council/prep-record.mjs` (pure + `updateFile`; run by `veteran.mjs` `run()` right after the Week ahead is built → council-data
`macro/prep-record.json` `{ v, label, records }`, append-only, written only on a change; a file that does not parse is never
overwritten and nothing is recorded that run). The question: did the Cleveland Fed nowcast point the right way against the calendar
consensus? `capture(prev, wa, now)`: one record per CPI / PCE release of the plan that has `prep` and is still to come (`r.t > now`;
a year-on-year title is skipped, the nowcast is month on month), id `<type>:<nowcast month>:<core|headline>`, with `capturedAt`,
`nowcast`, `consensus`, `gap`, `side`; the first capture is never edited, a later pre-release reading goes to `last` only.
`resolve(records, hd, now)`: after the release time, once `hard-data.json` `nowcast.months[].actual` has that series, attach once
`actual`, `print` (one decimal, as published), `actualSide` (the Week ahead's 0.05 threshold against the captured consensus), `hit`
(`side === actualSide`; null when the capture was in line), `resolvedAt`; never rewritten. `score(records)` → `week-ahead.json`
`prepRecord` (`captured`, `resolved`, `judged`, `hits`, `text`): under `MIN_JUDGE` 20 judged "too few to judge (n X)", else the hit
rate with a two-sided exact binomial p against 50% and "a forward record, not a tested edge". About two releases a month are
captured (core and headline of one release are not independent), so 20 judged takes most of a year. Limits, said plainly: the nowcast
file keeps three months, so a print not read within about two months is never resolved; the "actual" is whatever that file shows
on the first read after the release. No page shows it yet; no rule, call or trade reads it. `datahealth.mjs` lists the file
(no staleness). Test: `tests/prep-record.test.mjs`.

`prepFor` gives no prep to a year-on-year title (the nowcast is month on month); the Macro desk shows the record's one line in the Week ahead's note (`#wa-note`).

## Nowcast against consensus on 2022-24 (20 Nov 2026, `research/edge/nowcast-vs-consensus`, pre-registered)
The question the forward record needs a year for, asked offline on the 36 US CPI releases of 2022-24: the veteran batch's
first-print ledger with the Cleveland nowcast dated the day before each release (`cpi-model-benchmark-inputs-2022-2024.json`,
`forecasts.C`; NOT an authenticated real-time vintage: `model_original_delivery_authenticated` false on all 36) joined by release
date to `council/consensus-history.json`. Lean = nowcast against consensus with `IN_LINE` 0.05; print to one decimal; a print on
the consensus is not judged; exact two-sided binomial against 50%; bar: 20+ judged, p < 0.05, above 50% in both 18-release
halves. A direction-of-surprise test, not a trade (no costs). **INCONCLUSIVE**: core CPI 8 of 13 judged (62%, p 0.58; halves
5 of 8 and 3 of 5); the nowcast leaned on 19 of 36 releases and 6 of those printed on the consensus. Headline (secondary, no
verdict) 5 of 12 (p 0.77). The lean was one-sided: 17 of 19 core leans were ABOVE the consensus, so "above" was the usual
state in those years, not that month's signal. `council/week-ahead.mjs` `PREP_STUDY` (a constant; the test compares it with
result.json) adds the study's sentence to the prep text of a core CPI row and `prep.study`; never on headline CPI or PCE rows.
Nothing live changed. Never quote 8 of 13 as the nowcast "working". Test: `tests/nowcast-vs-consensus.test.mjs`.

## Review of the 20 Nov macro work (20 Nov 2026)
A read-only review of the day's diff found six defects of wording or scoring, none a crash; all fixed. (1) `prep-record.mjs`: a
print ON the consensus is not judged (`hit: null`; core PCE printed on it in about half of past releases, so counting it a miss
would bias the rate). (2) `hard-data.mjs` `outcomeWords`: "Hike >25bps" / "50+ bps increase" read "a hike of more than 25 bp" /
"of 50 bp or more", never "a 25 bp hike". (3) `prepFor` and the record's `monthlyPrice`: the nowcast sits only beside an m/m CPI /
PCE price row (never income, spending, q/q, y/y). (4) the above / below gold record is shown on the core row only (the Red folder
study sorts by the core surprise). (5) the morning report files Fed events and auctions under the London day it is headed with.
(6) `dayRange` says "A typical day's move … close to close" (the desk label is "Gold, typical move") and, where a release-day
median is smaller, "measured over other years and as a median, so it is not comparable one for one". Also: only readings that
moved make a line (four at most; the report's nowcast moves only for a month with a release in the next week; a broken history
never stops the report), and the Sunday digest skips a Week ahead file that ended before today (preview up to 22 lines).
Test: `tests/macro-review-fixes.test.mjs`. Later the same day: the morning report shows the Fed's events and the note / bond auction results in London time (`daily-report.mjs` `nyUnix`: "19:00 London (2:00 p.m. New York)"), and a holiday's or early close's range line says "the typical figure comes from full trading days" instead of repeating the market note's "thin trading".
**Wording found in the browser check, same day**: the frame's levels line reads from the latest price ("Gold near $3,575 now ($3,607 at the
19 Nov close); above, $3,590 (13-week low, broken since the close)…"; it said "watch $3,590 above" under a $3,607 close); no nested
brackets in the top lines; the morning report's "Later this week" adds the high-impact US releases of the council's schedule the
calendar does not hold yet, instead of "No high-impact release…" before the weekend's calendar file.

## Macro brain audit: what the veteran's output got wrong, and the week-ahead additions (20 Nov 2026, "make the macro brain's output more correct and more useful for next week")
Today's council-data files (veteran.json, week-ahead.json, daily-report.json, redfolder.json) were read as a trader preparing for
the Thanksgiving week would, then each member was re-run on a copy of the data. No rule, size, trade, probability on the record or
strategist maths changed; veteran-calls / -ledger / -debates / -expectations are byte-identical on today's data. New output fields
are optional (macro-desk.html was not touched). Defects, each: what a reader saw, the cause, the fix.
- **The veteran batch never reached the live loop.** `council.yml`'s sparse checkout held `research/edge` and `research/proposals`
  but not `research/macro-veteran`, so on the live desk `cpiPilot` was null, `newsAhead` and the release cards' `batch` were absent
  ("The veteran reads the release ledgers"), "Your research, applied" showed only the four rule-book checks (no gold brief, funding
  map, Japan, positioning, China, NY Fed survey, CPI plan, news register), and the Red folder study had no batch first prints or
  model column. Every loader fails soft, so nothing warned. Fix: the folder is in the sparse checkout; a test reads every
  `new URL('../…')` and `from '../…'` of council/*.mjs against that list. **A council member that reads a repository folder needs
  it in council.yml's sparse checkout.** It reaches the loop with its next restart.
- **A Sunday stub was counted as a trading day.** OANDA's UTC daily candles carry a two-hour Sunday row (one row in six), and every
  count of rows was short of its label: "200-day average" $4,314 was the last 167 trading days (true $4,418), "13-week high" $4,443
  the last 10.8 weeks (true $4,697), "50-day (= the 10-week average)" $4,065 (true $4,106); the week / month calls' base rates and
  touch levels came from 5 / 20 ROWS (4.2 / 16.7 trading days) against due dates 5 / 20 weekdays on (levels too near, the 60% range
  too narrow); "over 4 weeks" was 3.3 weeks; the analogs' "first close after Friday" was the Sunday stub; the Red folder's day move
  of a Monday release was measured from the stub (49 of 748 rows change). Fix (`veteran.mjs` `tradingDays`, `foldBars`: weekend rows
  dropped from close series, a stub's high / low / open folded into the next weekday's bar; weekday holiday stubs stay): the display
  build, the resolution closes, the ledger and the Red folder read trading days at once. **The record build moves with the week of
  `TRADING_DAYS_FROM` 2026-11-21**: this week's calls were issued from raw rows and a second build would add a second set (ids carry
  the level) to the calibration sample. From then the base rates and levels of new calls are on true horizons (said here so a shift
  in calibration is not a surprise). The two issued ledger forecasts (0 resolved) resolve at the 20th trading-day close, as their
  own text says ("about 28-30 calendar days on"). Not changed: the strategist's and the score's own reading of the same rows.
- **"53% chance it is higher by 11 Dec"** read as odds against today's price; it was the month call set at the 13 Nov close on a
  close above $3,885, with gold at $3,575. Now, from `FAR` 2 % between the price and the call's level: "(at the 13 Nov close he put
  53% on gold closing above $3,885 on 11 Dec, base 57%; gold is now 8.0% below that level, so read the lean, not the odds)"
  (`summary.bias` + `level`, `from`, `gapPct`; the Week ahead's month-call line the same). Calls name their starting close by date
  ("(the 2026-11-13 close)", `outlook.week.asOf`), never "today's close" / "the latest close". The recorded p is never changed.
- **"No major release is scheduled this week"** was a 72-hour check. With no event in 72 h the sentence names the next top-tier US
  release on the council's schedule within 8 days (`nextScheduled`, `summary.next`: "next on the schedule: US PCE (Wed 25 Nov,
  13:30 UTC)"). The morning note's "No high-impact release is on the calendar for the next six days" (a Friday, PCE five days away:
  the calendar feed holds one week) now lists the schedule's releases through the Week ahead's `releasesOf` (never twice) and the US
  holiday; its heading is "The next six days".
- **Week ahead: "Gold near $3,607 (as of the 2026-11-19 close); watch $3,590 above"**: the levels are picked either side of the
  latest price ($3,575), the line quoted the close. Now "Gold near $3,575 now (last close $3,607 on 2026-11-19); watch $3,590 above
  (13-week low, traded through since that close) and $3,550 below".
- **Decided calls shown as open odds.** "Gold closes at or below $3,860 on some day by 20 Nov: 47%" three days after it closed
  there. `outlook.mjs` `callStatus` (display only, never recorded: a test) stamps each shown call `status` (`happened` with the date
  and close; else where the last close stands: on / off track, % away); the morning note prints "already happened: the 2026-11-17
  close was 3,849 (he gave it 47%)".
- **"Fails if … a weekly close below the 10-week average 4065"** with gold 11 % under it, and "real yield above 3.03% ends the
  real-rate support" while that channel already leaned against gold. The lines say what is already true ("gold is already below
  …: the tiebreaker is off until a weekly close back above it", "adds to the real-rate headwind", "the dollar is still rising").
- **One report, two ranks.** The gold COT rank read "53th percentile" in the channel and the digest (over the strategist's last 60
  reports, unlabelled) and "33rd percentile of 3 years" in the briefing. The channel names the 3-year rank when cot.json holds the
  same report (`S.cot.pct3y`), else its window; `S.cot.pct` stays the 60-week rank the research check reads and labels.
- **Releases without a country, "pending" for good.** `veteran.json.releases` showed "Employment Change · 25.2K" (Australia's) with
  no country, and every past release as "pending" (the calendar feed carries no actuals). `releaseCheck` returns `country` and,
  past the 48-hour first-print window, "no first print was captured …: no surprise is scored".
- **"29% before calibration" on an 18% hypothesis**, with calibration behind its gate (k = 1). `freezeHypotheses` showed the
  recorded claim and p beside the LIVE reading's `pRaw`, and the desk prints "before calibration" whenever the two differ. The
  record's own `pRaw` travels with it now (`freezeEventCalls` the same); the live reading keeps its own in `live`.
- **"Over 4 weeks" measured from the clock.** `research-watch.mjs` `chg` / `lchg` took the last observation against the value N
  days before NOW; FRED runs about two days behind (more over a US holiday), so "over 2 weeks" was 12 days and "over 4 weeks" 26.
  On 20 Nov the rule book's regime check read "10-year +7 bp over 4 weeks, 2-year +11 bp" while the veteran's channel said the
  2-year was +1 bp: a 16 bp day fell inside one window and outside the other. Both are measured back from the last observation
  now (10-year −6 bp, 2-year −1 bp). The real-yield insight says which number its z belongs to when the analogs' week-end frame
  differs from the 28-day change.
- **A failed rule given as an instruction.** The playbook's hot-print action ended "if gold closes up anyway, cancel any sell
  bias": the rule book's C5, which FAILED its own study (`rulebook-stress`: after such days gold fell more, n 12, t −1.04; the
  research card on the same page says "do not use it"). The action now says the rule failed and an up-close is not an all-clear.
Additions (display only):
- **The release ledgers reach next week** (`news-context.mjs` `scheduleOf`, `cpiPrintFrom`). `newsAhead` read the calendar feed,
  which holds one week and no actuals: on a Friday it said nothing of the PCE five days away, and its PCE point could never name
  the month's core CPI. The council's schedule fills the days the feed does not hold (once per kind and day), and the month's core
  CPI print comes from the Cleveland Fed file hard-data.mjs already fetches (`build({ hd })`, display build only): "Core CPI for
  October printed 0.30% m/m … went with core PCE near 0.24% (fit on 36 months, typical miss ±0.07 pp): a descriptive fit …". The
  Week ahead carries it on the release (`releases[].context`) and in its lines, beside the nowcast (+0.27%).
- **Holidays on the calls** (`glance.mjs` `holidaysBetween`, the ICT desk's CME calendar): `summary.holidays` and a closing
  sentence ("Holiday trading ahead: Thanksgiving Thu 26 Nov (US stocks closed, gold thin), early close Fri 27 Nov"),
  `outlook.holidays` for the calls' window with `due`. `session` says what a day is for a dated call: a shortened CME day prints a
  daily close and counts (Thanksgiving); on a full closure (Good Friday, Christmas, New Year) a call due that day is scored on the
  last close on file by then (what `resolveCall` does: the feed's thin stub candle on 25 Dec and 1 Jan, the close before on Good Friday). `addSessions` still counts weekdays: the week calls of 19 Dec fall due on 25 Dec.
- **A consistency guard** (`glance.mjs` `consistency`, `summary.check { ok, issues }`): a level "above" not above the price (or
  below not below), a lean that contradicts its own odds, odds quoted without their level once the price is 2 % away, a month call
  whose date has passed, a release named beside "no release", a macro SELL. A failed check withholds the sentence ("Summary
  withheld this run: its parts disagree (…)", the original in `withheld`); the parts stay for the desk.
- **Week ahead `days[].focus`** (`focusOf`, from fields the veteran already wrote): the two levels (once, on the first day), on a
  top-tier US release day his own real-yield and dollar lines, the dated calls and hypotheses due at that close, and what a holiday
  or early-close session means for them.
Sound, left alone: calibration stays k = 1 behind its gate (14 of 30 scored, 2 of 4 weeks); no macro sell anywhere; "tested" /
"failed" wording on the Week ahead's calendar rules matches each study; the Thanksgiving rules fall on the right days (pre-holiday
Wednesday, post-holiday Friday, gotobi the 25th); release times are New York local converted to UTC;
levels' freshness and broken-level wording (11 and 19 Nov). Known, not changed: two releases at the same minute with the same
title share an expectations key (a US and a Canadian "CPI m/m"); a call due on Good Friday names a day with no candle; the
strategist's own 20-row trend mean and base rates still read the raw rows (macro.mjs is outside this change).
Tests: `tests/brain-veteran.test.mjs` (14); changed on purpose: `tests/glance.test.mjs` (the no-event sentence),
`tests/daily-report.test.mjs` (the heading), `tests/veteran-fresh.test.mjs` (a call's `status` follows the fresh closes),
`tests/news-context.test.mjs` (the calendar-only path passes `schedule: []`; the `contextFor` call carries `hd`).

## Red folder surprise study (19 Nov 2026, from the owner's red-folder research note, test B)
`research/edge/red-folder-surprise/` (PREREGISTRATION.md committed first; `run.mjs`, RESULT.md, result.json). With the consensus
history, gold's first hour after US core CPI (2018 to Apr 2025, n 48) and payrolls (2022 to Apr 2025, n 35) split by the miss
against the calendar consensus (hot = gold down), HistData M1 from `council/event-base.json`. **FAIL** on the pre-registered
trade (T+5 to T+60 with the miss, after 0.03 %): −0.144 % in 2018-21 (n 24, t −2.03), −0.007 % in 2022-25 (n 59, t −0.11).
The reaction itself is real: the first 5 minutes went the way of the miss on 60 of 83 releases (p 0.0001); the release minute
to T+60 (not tradable) +0.33 % out of sample (t 4.01). The red folder study shows this as a prep line on CPI and payrolls
("know the side before the print; do not chase after it", `loadInputs().surprise`). Nothing live changed. Tests:
`tests/red-folder-surprise.test.mjs`.

## Two gauges of the macro rule book: VIX panic and the 2-year against the policy rate (19 Nov 2026, owner: "use the other documents too, keep going")
`research/edge/rulebook-gauges/` (PREREGISTRATION.md committed first; `run.mjs` fetches FRED VIXCLS / DGS2 / DFEDTARU / DFEDTAR
keyless, RESULT.md, result.json). Values known at the next weekday's close; gold OANDA daily, 2007-26. **A FAIL** (VIX at 40 or
above, 9 episodes: gold dipped every time, median about −4 %, but higher 60 sessions later in only 4 of 9; +0.98 % against
+1.80 % on all days). **B1 FAIL** (2-year more than 25 bp above the upper policy target, "hikes priced": +0.44 %, t −0.83).
**B2 PASS** (2-year more than 25 bp below it, "cuts priced": gold's next 20 sessions +1.76 %, up 67 %, n 241 weeks, t 3.05, Holm p
0.005, both halves positive) on about five easing cycles (12 runs, 9 positive): a tested lean of the same family as the Gold Macro
Score's falling-2-year driver, never a trading rule. The rule book's "double tightening" claim is untestable here (FRED's
high-yield spread starts in 2023). Live reading `research-watch.mjs` `policyGapCheck` (veteran passes `cache.release` DFEDTARU as
`policy`) in "Your research, applied" with the record beside it; it changes no score, call or trade. Tests:
`tests/rulebook-gauges.test.mjs`.
Same gauge on the yen (`research/edge/rulebook-gap-yen`, pre-registered 20 Nov 2026; `gapRows` / `testB` imported, run on 1 / USD/JPY):
**FAIL, 0 of 2** (B1 hikes priced → USD/JPY up t −0.67 the wrong way; B2 cuts priced → USD/JPY down t 0.04), 1,001 weeks 2007-26;
USD/JPY's next 20 sessions about +0.1 % in every class. The gauge is a gold lean, not a dollar one.

## Stress and reaction rules of the macro rule book (19 Nov 2026, owner: "keep going with the other documents")
`research/edge/rulebook-stress/` (PREREGISTRATION.md committed first; `run.mjs` reuses `rulebook-gauges`' FRED parser, known-at
rule and Newey-West t; RESULT.md, result.json). Five gold-overlay and event rules of the owner's rule book on FRED DGS2 / DFII10 /
VIXCLS / DTWEXBGS and OANDA daily gold 2007-26, outcome gold's next 20 sessions. **1 of 5**: C2 "stress exception" (real yield +25
bp in 5 sessions, VIX > 30, dollar lower) PASS on its count bar (6 episodes, 4 above, +3.05 % vs +0.60 %) but four are 2008-09:
consistent, not proven. FAIL: C1 "rescue setup" (2-year down > 30 bp in 2 sessions; 10 episodes, only 5 above), C3 "resilience"
(t 0.33), C4 "deleveraging, hold" (t 1.23, 13 weeks), C5 "gold up on a hawkish day cancels the sell bias" (the wrong way, t -1.04:
do not use it). Live check `research-watch.mjs` `stressCheck` (`STRESS` = the study's thresholds, a test compares) in "Your
research, applied" with the record; it changes no score, call or trade. Tests: `tests/rulebook-stress.test.mjs`.

## The US 10-year regime table and gold (19 Nov 2026, owner: "use the other documents too, keep going")
`research/edge/yield-regime/` (PREREGISTRATION.md committed first; `run.mjs`, RESULT.md, result.json). The owner's macro rule
book's "primary gauge": the 10-year's speed and direction (fast = 25 bp in 2 weeks or 50 bp in 4; slow = 25 bp over 6 weeks) and
"why it moves" (2-year-led vs term premium), against gold's next 20 sessions from the weekday after (yields known by then),
1,033 weekly readings 2007-26. **FAIL, 0 of 3** (Holm; same sign in 2007-16 and 2017 on required): rising fast +0.40 % (n 82,
t −0.23, not bearish), falling slowly +0.96 % (n 131, t 1.07), term premium vs 2-year-led t 0.18 (flips between halves); all
weeks +0.52 %. Falling yields lean gold-up in both halves, at t near 1. Live reading `research-watch.mjs` `regimeCheck` (classes
as the study's `classOf` / `whyOf`, a test compares) in "Your research, applied" with each class's record beside it; it changes
no score, call or trade. Tests: `tests/yield-regime.test.mjs`.
## Blow-off veto on the Gold Macro Score (19 Nov 2026, owner: "there are still other documents I've sent you … how to predict or increase the chances to be correct")
`research/edge/blowoff-veto/` (PREREGISTRATION.md committed first; `run.mjs`, RESULT.md, result.json). The owner's macro rule
book's blow-off veto (no new gold BUY when gold is > 15 % over its 50-day average, > 20 % up in 20 sessions or > 10 % up in 7;
the implied-volatility clause left out, no history on file), tested on the score's own weekly reading (the council's
`macroscore.mjs` drivers, parity with `goldMacroScore`), 2007-24 = data the veto was not fitted to. **FAIL**: 1 of 177 BUY weeks
flagged (it did better), the long-or-flat Sharpe no better (0.343 / 0.338); the 2025-26 blow-offs peaked mid-week, no Friday was
flagged. Reported after the result, descriptive: on the 16 DAYS it fired in 2007-24 (7 episodes) gold averaged −1.3 % over the
next 20 sessions (+0.5 % on all days). Live check `research-watch.mjs` `blowoffCheck` (`BLOWOFF` = the study's `VETO`, a test
compares them) in the Macro desk's "Your research, applied", with that record beside it; it changes no score, call or trade.
Not testable from the repository: the rule book's exhaustion veto (sells only; the score never sells), headline-spike veto (no
headline history) and priced-event veto (no FedWatch history). Tests: `tests/blowoff-veto.test.mjs`.

## Veteran's calls (8 Nov 2026, owner: week and month predictions with a % chance, plus a summary of the registry data)
`council/outlook.mjs` (called from `council/veteran.mjs` build → `veteran.json.outlook`): dated gold calls for 5 and 20 trading days
(close above today, near / stretch touch levels, middle-60% range, big move, DXY direction). Each p is gold's 10-year empirical
frequency for that horizon plus the council tilt (veteran ledger probability − base rate, carrying the strategist's Gold Macro
Score; half for the week), clamped 5–95%. `digest` turns the observed channels into a plain read with limits and lists what is
not observed. Macro desk: "The veteran's calls" card and "What the pros' data says right now" in Close to the source.
Tests: `tests/outlook.test.mjs`.

## COT positioning desk (8 Nov 2026, owner: COT per pair, week-to-week change, a small fundamental edge)
`council/cot.mjs` (council.yml, every macro round; CFTC fetch cached 12 h in `macro/cot-raw.json`) → `macro/cot.json`: per market
(gold, silver, EUR, GBP, JPY, AUD, NZD, CAD, CHF, NQ, ES) speculators' net (TFF leveraged funds; Disaggregated managed money for
metals), week and 4-week change, trader counts long/short and their change, open interest, 3-year percentile. Two pre-specified
signals are tested on council daily prices since 2020 from the first close after the Friday release: `extreme` (contrarian at
90th/10th pct) and `flow` (follow a 1.5-sd weekly change), 5 and 20 days. Edge = n≥15, hit ≥ base+8 pts, t≥2; otherwise the page
says "no tested edge yet". Fields are matched by pattern (sandbox cannot reach CFTC; `src` logs the keys if parsing fails).
Macro desk tab "COT positioning". Tests: `tests/cot.test.mjs`. Paper only. Returns start after report date + `RELEASE_LAG` (6) days: holiday weeks publish on Monday (9 Nov audit).

## ChronosTrade trade effects (8 Nov 2026, owner: an effect on TP, an effect and a "faaaaah" sound on a loss)
`assets/bt-fx.js` (`BTFX.win/loss(R, sub, title)`), called from the close events in backtest.html: confetti + green glow + chime on a
profitable close; red vignette + shake + a WebAudio-synthesized falling "faaaah" voice on a losing one. No audio files. Speaker
button `#snd-btn` toggles sound (`btLab:sound`). Reduced motion: no confetti or shake. Chart: dotted crosshair, kinetic scroll.

## The shadow book on the former LIT demo account (20 Nov 2026, owner: "one demo account … no trades with 10k USD … LIT replace it with the shadow")
`council/ctrader-accounts.json`: `shadow` → 10152146 (the LIT account, idle since the LIT stream stopped on 17 Nov; it keeps the `lit`
book, so `council/gotobi.mjs` still finds it as the gotobi account) and `drain: ['10152145']` (the old Shadows account). `accountsFor`
adds a drain account as a group with no books (`drain: true`): its round opens nothing (`openBooks` empty) and keeps managing the
copies it holds (stop guard, stop moves, closes, cancels); the CLI runs it only while `stillHolds(state)` (an open copy or a resting
order), and `copiedIds` keeps any other account from copying those trades again. `mirror-accounts.json` lists it with `drain: true`
while it runs; `ctrader/accounts.json` labels it "Old shadows (draining)". Owner's choice of three: move the shadows and let the old
account run its 6 open copies out. Remove the `drain` entry once that account holds nothing. Test: `tests/mirror-drain.test.mjs`.

## Mosha 6R barrier on a demo account (23 Nov 2026, owner: "Mosha barrier 6 put it in one of the demo accounts on ctrader can be any one just swap with the one there previous")
The old Shadows demo account 10152145 (drained since 20 Nov) is the `mosha6` book: `council/ctrader-accounts.json`
`mirrorAccounts.mosha6`, `drain` empty. `council/ctrader-mirror.mjs` (the replica pattern): `BOOKS` + `'mosha6'`, `bookOf` = mosha6
for ids starting `mosha6:`; `moshaCandidates(desk, nowS)` (pure) reads council-data `mosha/desk.json` `records`: the 6R barrier reading
only (`isMosha6`: id `(^|:)bar-r6-`, the test of `assets/mosha-sop.js` `readings()`), gold only, a stop on the losing side (else
dropped), open, or closed within `MOSHA6.keep` 2 days of its `endT` (so the copy is closed with its record); ONE record per side and
fill time `t` (first in file order: several 6R records fill at the same second with near-identical levels, the account never doubles a
position). Records are written once filled, so copies are market orders through the usual path (late-copy check against the snapshot
mark with 1R = `r0`, stop-within-spread skip, `ensureStop`, every cap). Only a record the tracker first wrote (`first`) AND filled within
`MOSHA6.fresh` 2 h may be OPENED; an older, replayed or Kraken-priced record (`feed: 'Kraken'`, PAXG levels a few dollars from spot) is
`noCopy` with `noCopyWhy`, kept in the list so a copy made earlier follows its record. Candidates are added only while `moshaHasOwnAccount`
(mosha6 on another account than council); a missing or unreadable desk file = none. Risk `LIMITS.risk.mosha6` 0.25 % of the balance a
trade. The account's round still manages the old shadow copies it holds (every trade is passed to every account's round; `openBooks`
limits only what it opens). `ctrader-account.mjs` label "Mosha 6R barrier"; `ctrader-reconcile.mjs` reads the desk file too (copies
are not strangers; a noCopy record shows its reason). `forward.mjs` E5 reads the Council account only (unchanged). Demo only; a paper
reading of the desk copied to a demo, not a tested edge. Tests: `tests/ctrader-mirror.test.mjs` ("Mosha 6R": 4),
`tests/ctrader-reconcile.test.mjs`, `tests/mirror-drain.test.mjs`.

## The Equinox desks on the demo account ending 144, ICT copies stopped (24 Nov 2026, owner: "Break fade / Big-candle fade / FVG return / gold breakout ... running on demo account finishing 144 risking 0.25% per trade max 30 trades open at same time", "Stop ICT copies")
`council/ctrader-mirror.mjs` book `eqx` (`council/ctrader-accounts.json` `mirrorAccounts.eqx` = 10152144, the former ICT account):
`eqxCandidates(files)` reads council-data `fade/`, `bigfade/`, `fvg/`, `goldvb/` `desk.json` (the Equinox trackers; `EQX.desks`; DOM,
round-number, box fade and USD/JPY breakout are NOT copied), the Mosha 6R pattern: open records are copied as market orders through
the usual path (stop required, spread skip, `ensureStop`, caps); only a record first written and filled within `EQX.fresh` 1 h and not
more than `EQX.maxFloat` 0.75R from its entry at the desk's last reading is OPENED (else `noCopy`, kept so an earlier copy follows its
record); closed ones stay `EQX.keep` 2 days so the copy closes with them; no market = gold; one per desk, market, side and fill time;
ids `eqx:<desk>:<record id>`. Risk `LIMITS.risk.eqx` 1 % of the balance (owner, 24 Nov 2026; 0.25 % before); at most `EQX.maxOpen` 30 eqx positions at once (the
account's 40 cap and the 2 % daily loss stop also apply). `SYMBOLS` gained nzdusd, usdjpy, eurjpy, xag (so `ctrader-symbols.mjs`
reads their specs; USD/JPY and EUR/JPY leave the yen watch-only list's "never in symbols" rule). Copied only while `eqx` has its own
account (`eqxHasOwnAccount`). Trader rule `ict-mirror-off` sets `config.mirrorIct = false`: `ictCandidates(ict, false)` marks every
ICT signal `noCopy` (kept, so an old copy would still be managed); undo with a rule setting it true. `ctrader-reconcile.mjs` reads the
same files; `ctrader-account.mjs` label "Equinox". The four rules lose after costs on their studies: a demo record, not an edge.
Tests: `tests/ctrader-mirror.test.mjs` ("Equinox", "ICT copies stopped").

**Moved to the $200 account ending 155** (24 Nov 2026, owner: "And on the 200 account mosha barrier 6r", "200$ finish with 155", risk
0.25 % kept): `ctrader-accounts.json` `mosha6` = `"*155"` = the ONE demo account on the token whose login ends 155
(`ctrader-mirror.mjs` `pickAccount`, also used by `ctrader-account.mjs`; two matches or only a live one = not found, nothing sent);
its state file is `mirror-155.json` (`mirrorFile`: digits only, so the Trader's `mirror(-\d+)?.json` reader holds). 10152145 is in
`drain`: it opens nothing and manages its open Mosha copies to their exits. On $200, 0.25 % is $0.50 a trade: most gold trades need
more than the smallest lot allows and are skipped (`riskVolume`'s minimum-lot rule, at most 2 %).
**Checked 24 Nov 2026**: the token holds no demo account whose login ends 155 (`ctrader/accounts.json`: "account not found for this
token"; `mirror-155.json` "refused"), so nothing trades there until the owner authorises that account for the cTrader app. The
…144 account was reset from about $10,000 to $500 after the UTC day began and the 2 % day stop then held every copy ("95 % down
today"): a balance under `RESET_SHARE` 0.5 of the day's start is now read as an account reset and the day starts again
(`state.day.reset`). **Withdrawals and deposits** (owner, 24 Nov 2026: "I took money from the accounts … it is not a loss"): a
balance move of more than `CASH_SHARE` 1 % between two rounds while every position and resting order of the last round is still
there and the mirror sent no order last round is cash, not trading: the day's start moves with it (`state.day.cash`, a log line);
`state.day.lastBalance` / `ids` / `oids` / `sent` carry what the next round compares. `dom/trades.json` `conn` records a refused connection once (`{ error, acct, since }`, then `{ ok }` when back).

## Mirror stop safety (9 Nov 2026, owner: "fix that, the most important part of this project")
Monday open: every market order logged "set the missing stop". Two changes in `council/ctrader-mirror.mjs`:
1. After a market fill whose fill event shows no stop, the mirror waits `slWaitMs` (1.5 s) and reads the position back
   (RECONCILE); only a stop that is really missing goes to `ensureStop` (amend to the council stop, or close at once if refused).
   A stop found records `brokerStop` / `stopCheckedAt` on the map entry.
2. `LIMITS.settle` (20 min): market orders on a symbol wait that long after its last "market closed" answer (`state.closedSeen`),
   so copies never go out in the widest-spread minutes after a reopen (where a stop inside the spread is dropped). Limit orders
   (absolute stops) are not held. Tests: `tests/ctrader-mirror.test.mjs` (stop read-back, settle).
Audit (9 Nov, owner: "keep finding bugs, this can't have errors"): the stop guard no longer skips a position whose council trade
left the list (uses the stop saved at the open, `m.stop`); `ensureStop` never sets a stop from a missing level (it read as 0) and
rejects one on the wrong side of the current mark (closes instead); step 2d closes any position with our label the mirror does
not manage that has no stop (one with a stop is reported once, `state.orphans`).
Bug hunt (9 Nov, 3): another account never opens a trade any account has copied, whatever the copy's status (`copiedIds`; before,
only open copies were excluded and 4 trades stopped at the broker on the base account were opened and lost again on the shadow
account, 8 Nov); a finished copy is kept past `keepDays` while the council trade is open; an ICT futures roll (`rolled`) is
absorbed into the copy's saved levels (`absorbRolls`) instead of moving the cash-CFD stop by the roll offset; a pending order the
council re-quotes cancels the resting limit (`requoted`) and a limit filled at old levels is amended to the council's; mirror files
are written atomically. The Trader writes with `writeAtomic` and stops (writes nothing) when config / state / trades / research /
coach.json exists but does not parse (it used to write trades.json out empty). Tests: `tests/ctrader-mirror.test.mjs` ("bug hunt"),
`tests/trader-state-guard.test.mjs`.

Limit read-back (10 Nov 2026): an AUD/USD buy limit was placed a minute after the price had fallen through its entry and its
stop; it filled at once, the broker dropped the stop (above the fill) and the position sat without one for three minutes until
the next round's guard closed it. Now every round that places a limit reads the account back before it ends (`limitsPlaced`,
after `slWaitMs`): a limit that already became a position is adopted in the same round; without a stop it gets the council's
stop by amend, or is closed at once when the stop is on the wrong side of the fill or the broker refuses it. A failed read-back
leaves the next round's guard in charge. Tests: `tests/ctrader-mirror.test.mjs` ("a limit that fills at once").

## Veteran's calls: track record and COT calls (9 Nov 2026, owner: "keep improving our veteran macro")
Every dated call now carries structured fields (`asset`, `kind`: closeAbove / touchUp / touchDown / range / bigMove / pairUp /
pairDown, levels, `by`). `callsLedger` (council/outlook.mjs, run from veteran.mjs) records each call once in
`macro/veteran-calls.json`, resolves it on the daily closes after its date and scores it (hit, Brier); `callsScore` gives hit rate vs
expected, Brier and high/low-probability bands. `cotCalls` turns COT signals that passed the desk's test (macro/cot.json, edge true)
into dated pair calls at the tested hit rate (clamped 50–75%). Macro desk: COT calls and the track record under the veteran's calls.

## ChronosTrade sounds chosen by the owner (9 Nov 2026, owner: "I'm the only one who can choose the sounds for SL and TP, on my profile")
`api/sounds.js`: GET (public) `{ sl, tp }` (data URLs + names) from the private Blob `sounds/config.json`; POST `{ ownerPw, kind, data|null,
name }` needs the owner password (users.js `isOwner`, constant time), audio data URLs only, ≤ 700 KB. Defaults: stop-out =
`assets/sounds/sl.mp3` (the owner's "faaah" clip, uploaded 9 Nov), target = the built-in chime. `assets/bt-fx.js` loads them for
everyone; members only switch sounds on/off (speaker menu). Owner UI: Profile → "ChronosTrade sounds" (`#ms-pf-snd`, shown when
`MS_WHO === 'owner'`). The old per-browser custom clip (localStorage `btLab:lossSound`) is gone. Tests: `tests/sounds.test.mjs`.

## Desk notifications (9 Nov 2026, owner: bell in the corner, pops onto the screen at sign-in, owner sends to all from the profile)
`api/notify.js`: GET (signed-in session) → last 50 `{ id, at, title, body }`; POST (owner session, same-origin) `{ title ≤ 80, body ≤ 1000 }`
or `{ remove: id }`; private Blob `notices/list.json` (100 kept). Page: bell `#nt-bell` in the header (badge = unread; panel lists all),
unread ones slide in one at a time from the top (oldest first, Next / Mark all read), polled every 2 min and on tab focus; read state
per account in this browser (`ms-nt-seen-<u>`). Owner: Profile → "Send a notification" (`#ms-pf-nt`, list + delete). The price-alert
toggle `#ms-alerts` now uses a pulse icon so the bell means notifications only. Tests: `tests/notify.test.mjs`.
Audit 9 Nov (`tests/audit-nov9.test.mjs`): `/api/logout` and `/api/sounds` POST refuse a foreign Origin; the notify / sounds / profile Blob reads
throw on a failed read (they used to return empty, so the next save overwrote the list, the other sound or the photo); veteran
expectations fill a consensus the calendar posts after the first capture but before the release (never after).
**Email too (25 Nov 2026, owner: "Email them")**: `POST /api/notify { title, body, email: true }` (the owner's session; Profile → Send a notification has the box "Also email it to everyone who has an email address on file") mails the notice to the owner (`OWNER_EMAIL`, else `GMAIL_USER`) and every enabled member with an address on file, once each, at most 60, through the sign-up senders (`signup.js` `mailer`). Addresses are never logged or returned (counts only: `email { ok, failed, recipients }`); an unreadable member list or a failing sender never loses the notice. No permission filter: a notice by email goes to every address. Test: `tests/notify.test.mjs`.

## API hardening (9 Nov 2026)
`api/_guard.js`: one per-IP table of failed password checks shared by `/api/login`, ctrader-link `session`, mcp `mykey` and the
owner-password fallbacks of users / sounds / bridge / tv-webhook (the owner session is tried first there): 10 failures in 10 min →
429 + Retry-After (sliding window, a right password does not reset it, in memory per instance, on top of the firewall's /api limit);
the sign-in card shows the 429 text. `bearerOk` compares `CRON_SECRET` in constant time (run.js, alert-cron.js). `/api/status` (public,
edge-cached) no longer carries the runner's `stack` / `cause` (the error line and step stay; the Blob report keeps the rest). Public
errors are generic (bridge GET, push 500). push.js caps what a device may store (endpoint ≤ 1024, p256dh ≤ 200, auth ≤ 100 chars;
non-object alerts 400). alert-cron skips a malformed device record instead of failing every device. MCP `granted`: an explicit
`perms.mcp` wins over the record's `mcp` flag (as `msPerms`). `/cdata` answers GET / HEAD only; bridge GET / POST only; profile
refuses a non-object JSON body (400, was 500); a failed sounds read is answered `no-store`. Tests: `tests/api-hardening.test.mjs`.
Review of 11 Nov 2026 (every function read; `tests/api-review.test.mjs`): three fixes. (1) `/api/push` (no sign-in) took a price
such as "1e999": it passed "> 0", was stored as null, and `alert-cron` then threw for that device and ended the round for every
device after it, each minute. Push now wants a finite price and time; the cron leaves out an alert that is not whole and one
device's failure never stops the others. (2) `/api/mosha-lessons`: the owner's `remove` let a `book` or `add` sent in the same
body through (the owner reads and removes, only Luxus teaches); only the `remove` is carried out now. (3) `api/mcp.js` `granted`:
with an `MCP_KEYS` entry the stored user list was not read before `ictLevel`, so the first call on a cold instance got the
built-in ICT level whatever the Users page said; the list is read first for every key (an explicit key is still a grant while
the list cannot be read). The same file re-checks: a foreign Origin on every state-changing endpoint, `/cdata` path handling,
the Mosha assistant's key against every other endpoint, who teaches, who writes whose record, where `ictApply` can come from.
Blob freshness audit (11 Nov 2026, after the Academy lost a verdict to a stale read; `tests/blob-fresh.test.mjs`, lagging fake
Blob service `tests/fixtures/blob-lag.mjs`). The Blob CDN serves a file that was OVERWRITTEN IN PLACE with its old bytes for
up to a minute; a read with `?cache=0` asks the origin. Every reader / writer under `api/` was read:
- **Overwritten in place, read through the CDN until now** (old data on another instance, and its next save dropped what was
  stored in between): `notify.js` (notices/list.json), `profile.js` (profiles/<key>.json), `sounds.js` (sounds/config.json),
  `mosha.js` (mosha/trades.json), `mosha-lessons.js` (mosha/lessons.json, mosha/book.json). Each store now reads through
  `fresh(url)` (`?cache=0`), as `_academy-store.js` does. A lesson's picture is written once under its own name and may come
  from the CDN. **Rule: a module that writes with `allowOverwrite: true` reads with `cache=0`** (a test lists the six files).
- **Not affected, a new file name per save** (`addRandomSuffix: true`: a new URL, no CDN copy can exist; the reader takes the
  newest from the listing): the user list (`users.js` writes, `_accounts.js` `blobUsers` reads: sign-in, `/api/me`, profile,
  users, ctrader-link, the connectors), price alerts (`_alerts.js`), cTrader link tokens, TradingView alerts, run reports, the
  bridge ping. So a changed password, a removed member or a removed permission is never honoured from a stale Blob read.
- **What does lag by design**: `S.fromRequest(…, { cacheMs: 60e3 })` keeps the user list a minute per instance (and up to 10
  minutes while the list cannot be read) for READS on `/cdata`, notifications, the Mosha log and lessons. The one WRITE path
  that used it, a teacher's POST to `/api/mosha-lessons`, now checks the list as it is (a removed account, a new password or
  teaching switched off is refused on the next call); `handle` takes `d.deps` for tests.
- **Two small guards where real time passes between a read and its write** (not locks): `mosha-lessons.js` reads the list again
  after a picture upload (a lesson stored meanwhile is kept; a lesson removed meanwhile answers 404 and the picture is taken
  away); `alert-cron.js` reads a device's record again before saving it after the candles and pushes (an alert the device
  added meanwhile is kept, a device that removed itself is not written back).
- **Academy store**: its "own copy for a minute" shortcut is now used only while the listed ETag is the one its write returned
  (the upload-time rule, the fallback, let a write by another instance within 1.5 s go unseen for a minute and be dropped).
- **Still open, everywhere a file is overwritten in place**: two instances that both read and both write inside the same few
  milliseconds can lose one write (single-writer in practice: the owner, one teacher, one page at a time). The Blob client
  (2.8.2) has a conditional write (`put(…, { ifMatch: <listed etag> })`); it is not used because it could not be tried against
  the real service from the build sandbox and a wrong ETag form would refuse every save. Try it on a preview deployment first.
- Not verified against the real Blob service: that `cache=0` reads are read-your-writes, and that the listing is.

## API review (20 Nov 2026)
A correctness and security review of the server functions written or changed 17-20 Nov: `api/signup.js`, `_smtp.js`, `passkey.js`,
`_passkey.js`, `daily.js`, `_daily.js`, `_seen.js` (+ its calls in `me.js`, `login.js`, `users.js`), `battle.js`, `_battle.js`,
`cloudflare/src/battle-room.mjs`, `lse.js`, `_watchdog-kick.js`, `_gotobi-kick.js`, `chronos-coach.js`, `_chronos-coach.js`,
`trade-review.js` and the Worker's routing. Each defect has a test in `tests/api-review-20nov.test.mjs` that failed before its fix.
No trading rule, stop, demo lock, council or ICT file, page or secret was touched.
- **1. Daily email, members skipped for the day (medium).** The 06:30 job (and the owner's `send=all`) marked the day as sent and
  THEN read the member list with `.catch(() => ({}))`: one unreadable read sent the email to the owner alone and no member got it
  that day (`send=all` also used up its one send). Now `membersOf` is read first; unreadable = nothing sent, nothing marked, the
  job tries again at its next run (`email.why`), `send=all` answers 503. Test hook `d.userList`. Known cost: a list unreadable for
  the whole 3-hour window means no 06:30 email at all, the owner's included (sign-in is down then too).
- **2. Daily email, `?test=email&to=` from another site (low-medium).** An owner-only GET that sends mail had no cross-site check
  (`send=all` had one): a link on another page, opened by the signed-in owner, emailed the report to an address the link named
  (5 in 10 minutes) and with `fresh=1` paid for a model call. Both now share `fromElsewhere` (`Sec-Fetch-Site` cross-site /
  same-site refused; typed, same-origin or no header pass).
- **3. Daily email, `state.json` written from an old copy (low).** The job and `send=all` each wrote their end state from the copy
  they read at the start; an owner's `send=all` that ended after the job's run put `mailed` back to yesterday and the next run
  sent the 06:30 email again. Every write now joins its fields onto the file as it stands (`mark`).
- **4. Password reset, known addresses told apart (low-medium).** `forgot` answered the same words, but only after storing and
  mailing the link for a known address (hundreds of ms to seconds), and a failing reset store was a 500 for a known address
  only. The answer now leaves first; the link is stored and mailed after it (the Worker's adapter keeps the handler running under
  `waitUntil`), and a failure of that work is logged, never answered. Keep it so: nothing slow before `res.json` in that branch.
  A host that freezes a function at its answer would lose the email: the Worker is the only host.
- **5. Emailed links built from a header the client types (low).** `originOf` reads `X-Forwarded-Host` first (Vercel set it
  itself); on the Worker it was the caller's own header, so a forgot / sign-up request could have the member's link point at
  `localhost` or the old workers.dev host (a dead link, repeatable every 10 minutes per address; never another site, the host
  list holds). `cloudflare/src/adapter.mjs` `headersOf` now drops the header like the forwarded-for ones.
- **6. Sign-up, the mail provider's error shown to a visitor (low).** A failed confirmation email answered 502 with `why` = the
  provider's own error text and the shapes tried. The answer is the sentence alone; the reason is logged (addresses redacted)
  and the owner sees the tries through `/api/daily?test=email`.
- **7. The coach, provider detail to every member (low).** `errText` gave any signed-in account the provider's refusal text
  (it can name the model or the account) and the variable names to check. Only the owner gets that now; members get "could not
  be reached".
- **8. Names inherited from Object (low).** `/api/constructor` ran `Object(req, res)` as a handler (500 "ended without an
  answer") and `/api/lse?op=constructor` threw inside `target` (500): both lists are read with `Object.hasOwn` (404, 400).
- **Checked and found sound**: same-origin on every state-changing POST (signup, passkey, battle, coach, users, login) and the
  two battle Worker routes; the verify link and `watch` answer nothing but a state; no answer carries an email, hash, token or
  key except the owner's approval list (`?list=1`); sign-up gives one answer for a new, pending, confirmed and member's email;
  sign-in gives one 401; every in-place store (`signups/*`, `passkeys/all.json`, `presence/seen.json`, the daily / coach / review
  stores, notices) reads with `cache=0` and throws on a failed read, so no write follows one; tokens, watch codes and reset
  tokens are stored as hashes, single use, bounded lists; passkeys check challenge (signed, bound, once), origin, RP ID, UP + UV,
  signature, counter, the account as it stands and the password fingerprint, and count failures in `_guard`; CBOR / DER / base64
  inputs are length- and depth-bounded; SMTP header values and addresses cannot carry a line break; battle tickets cannot be
  read as sessions (own key, 2 minutes), the room only sees a verified ticket, messages are size- and rate-bounded and every
  setup field is clamped; the inbox is bounded and expires; `lse` is owner-only, GET, allowlisted, `redirect: 'error'`, never
  returns the key; the two kicks start one named workflow on `main` with no inputs, only when sure, and nothing live is in reach
  (the gotobi job holds the only order code, demo-locked); a cron failure never stops the chain (the adapter catches); every
  `api/*.js` endpoint is in `HANDLERS`; daily recipients come from the live user list (a removed or disabled account is not in
  it; `perms.macro === false` is skipped; test); `presence/seen.json` holds an account key and an ISO time only (`clean`).
- **Seen, left, said to the owner**: (a) sign-up is still timing-distinguishable (a new address waits for its email, a known one
  does not) and its "username is taken" check passes for the request's own email, so someone who guesses a waiting request's
  username can confirm its email; both need the 502 / 409 answers people rely on, and are limited to 5 tries an hour per
  address. (b) Every signed-in member can read the other members' usernames and names (battle invites, by design) and the
  coach's spend and budgets (`GET /api/chronos-coach`). (c) All per-IP and per-account limits are in memory per Worker
  instance. (d) A request body is read whole before any size check (the platform's limit applies). (e) Battle standings are
  each player's own report (a changed page can report any %), and a `stat` is still accepted after the host ends the battle.
  (f) The emails' HTML part is written as one line of several thousand characters, over SMTP's 998-character line limit;
  whether Gmail's relay minds was not checked (the Email Service binding is the first route). (g) `HOSTS` in `api/signup.js` and `api/_passkey.js` still names the deleted `meridianx`
  workers.dev host. **No secret needs rotating from this review** (none was found in an answer, a log line or a file).

## The veteran's briefing (9 Nov 2026, owner: "he needs to give us key insights and near-inside information, and he needs to make hypotheses with some base from what happened in the past, levels of the price, and what he knows")
`council/briefing.mjs`, built by `council/veteran.mjs` → `veteran.json.briefing`. "Near-inside information" = early, careful
reading of PUBLIC data only (COT, funding/stress gauges, central-bank wire and calendar, expectations captured before releases,
real yields, the dollar); `PUBLIC_ONLY` says so on the desk. Deterministic, no fetches. Parts: `insights` (3-6 ranked by how
unusual each reading is vs its history (analog-frame z), release proximity, COT stretch; each with evidence text / as-of /
source, why for gold, dollar and majors, what would change the view); `findAnalogs` (weekly Friday fingerprints since 2007:
DFII10 and DGS2 4-week change from `cache.score.fred` weekly + recent daily, DXY 4w, gold 4w, gold vs 10-week average, vs 52-week
closing high, place in 13-week range, S&P 20-day realized vol as the VIX stand-in; every series is cut at `now` first; outcomes
from the first close after the analog Friday; picks ≥ 6 weeks apart, ≥ 13 weeks before now; similarity 1/(1+RMS z distance);
descriptive, not a tested edge; COT is not in the fingerprint (history only since 2019)); `levelsFor` (last complete week and
month high/low, 20/50/200-day, nearest swing high/low (3 bars each side, 90 sessions), 13-week high/low, round numbers, the
outlook's 60% ranges, analog medians; DXY on closes); `hypotheses` (H1 week race: nearest structural level ≥ 0.4% away reached
before the guard on the other side, side chosen by how far the analogs move the all-weeks frequency; H2 every close inside last
week's range; H3 DXY 20-session direction). p = analog frequency shrunk toward all weeks (`SHRINK` 10 pseudo-cases) + half the
council tilt for gold, clamped `P_CLAMP` 10-90%. Recorded via `callsLedger(..., { extra })` with id `hyp:<weekKey>:H1..3` (the
week's first version is kept; `freezeHypotheses` shows the recorded one with the live reading beside it); new kinds
`firstTouchUp` / `firstTouchDown` (with `guard`) and `stayInside` in `resolveCall`. Desk: "The veteran's briefing" card on top of
macro-desk.html (`#c-brief`, `renderBrief`). Tests: `tests/briefing.test.mjs`. Paper only.

## Side pages: /macro, /veteran/, Edge lab, gold terminal (9 Nov 2026, owner: "keep improving", "more visual, and simpler")
(17 Nov 2026: the /macro landing page, `index.html`, was removed; its bullet below is history.)
- Shared look: `assets/mx-page.css` (the desk's tokens per theme, top bar, Desk | Macro | ChronosTrade switch `.hdr-sw`, 44 px
  controls on touch screens via `--tap`) and `assets/mx-nav.js` (asks `/api/me` once, `window.MX_ME`; `[data-mx-members]` shows to
  signed-in members, `[data-mx-macro]` hides when `perms.macro === false`). Used by edge-lab.html, index.html and the veteran page.
- `/macro` (index.html → out/macro/index.html): replaced the 2024 React demo (616 KB, hard-coded 2024 rates/calendar, blank page once
  its last calendar date passed). Members see today's read from `/cdata/macro/forecast.json` (Gold Macro Score, gold up-odds vs base
  rate, regime, next playbook release in UTC + local); guests get "Sign in on the desk". Links to the tools. Its asset links use
  `/macro-dashboard/assets/` (works on Vercel and Pages; stamp-assets versions that form too).
- `/veteran/`: `scripts/veteran-library.html` is copied to out/veteran/index.html by veteran-index.mjs: search, groups, reader with
  `#<path>` deep links, CPI pilot card. Public like the files it reads.
- Edge lab: `research/edge/build.mjs` also writes `lab.json` (`lab-summary.mjs` `slimStudy`: only the fields the page reads, ~200 KB
  instead of ~7 MB of result.json); the page reads it first and falls back to the per-study files; fetches revalidate (`no-cache`).
  A study with only a RESULT.md shows its verdict ("Written report only"), never "Running".
- gold-trading.html: no 3900 placeholder shown as a live price or used for a signal before the first live tick; the 1.95% real-yield
  seed is labelled "est."; theme set in the head (goldDarkMode, else the desk's msPrefs, else dark); Lightweight Charts deferred.
- Tests: `tests/side-pages.test.mjs`.
- Design pass (9 Nov 2026, "go harder… more visual, simpler"). Gold terminal dashboard: hero `#gxHero` (price, change vs the prior
  UTC daily close, Live / Delayed / Offline in words, prior close, today's range, last update; dashes and "Waiting for a live price"
  until the first live tick) → the 5 min chart → folded `.gx-fold` panels (one-line summary each; open state in localStorage
  `gxFolds`). `<body data-section="dashboard">` hides the header's duplicate price from the first paint (it was a 0.07 shift).
  Charts: `gxPalette()` reads the theme tokens (`--gx-up/--gx-dn`, accents), `gxRestyleCharts()` on the theme toggle; the hero chart
  has an OHLC + change + UTC legend under the crosshair, the feed state as the last-price label's title, quiet prior-day high / low
  and round-number lines (`makeKeyLevelsPrimitive`), no zone boxes; candles are aligned to spot only with a LIVE price (the 3900
  placeholder used to shift them), the offset is held between refreshes and new bars go in with `series.update` (no refit each
  minute). `scalpLevels()` returns null until live. Tokens: `--fs-xs` 12 px replaced every 8-11.5 px size; `--amber` / `--gold-ink`
  replaced the inline #D97706 / #D4AF37; light accents darker for AA; `html.dark.midnight` when msPrefs.theme is midnight.
  Edge lab: verdict donut + legend with counts and shares, best candidate IS vs OOS bars (baseline OOS tick, t in words), equity
  line where a study lists its own trades (`lab-summary.mjs` `equityOf`: cumulative R sampled to 48 points, drawdown from the full
  series; today crypto-trend-decay and nq-open-oos), `[data-tip]` tooltips on hover and tap.
- Quality pass (11 Nov 2026; every page at 390 px touch and 1440 px, dark / light / midnight, owner / reviewer / viewer / signed
  out). **Macro desk**: since the 9 Nov `main[data-loading]` fix the charts were drawn while the story was still `display: none`,
  so `draw()` found no width and the score path, the level ladder, the expectation scale and the hit-rate chart stayed blank until a
  resize or the 5-minute reload; `load()` now removes the flag, then calls `redraw()`. "No hypothesis this run" is said once, the
  score chart's threshold names are drawn after the line, each dot of the header switch is a 44 px target on touch (25 px before)
  and the switch hides when signed out. **Edge lab**: a study whose result stores an object under `system` read "[object Object]"
  (only text is a description); `tidy()` mends a joined headline ("FAIL.; Intraday: …"); the report dialog renders the study's
  RESULT.md (`md` / `mdInline`, the veteran library's renderer: escaped first, tables scroll inside `.tbl`, relative links stay text)
  instead of raw Markdown in a monospace block. **Veteran library**: "Open raw" is 44 px on touch. **Gold terminal** (locked
  features and the driver stack untouched): the page clips sideways overflow, so on phones the Daily Bias banner's Target / Daily ATR
  column, the levels panels and Research → Edge Summary table were cut off with no way to reach them (the banner stacks under
  700 px, `.levels-grid` uses `minmax(0, 1fr)`, the table's card is `.gx-scroll-x`); `.edge-rule` notes were pale text on a pale slab
  in dark (2.3:1); the hero chart's key-level labels are drawn above the candles on a plate of the card colour (`P.plate`; the lines
  stay underneath); the MTF opportunity line no longer reads "Buy the pullback into the wait for a pullback block" when M15 has no
  block (`planTxt`). `scripts/audit/smoke.cjs` now opens every gold tab on the phone (body wider than the screen = "tab cut off on
  the right") and fails on a visible, empty chart host (`.vz[id]`, "chart not drawn"); both fail on the build before this pass.
  **Gold terminal, Research → Edge Lab tab: rule ideas, not tested edges** (11 Nov 2026, owner approved; text only, the locked
  features and the driver stack untouched). The tab stated win rates, profit factors, reward ratios, correlations and "high
  conviction" with no n, period, cost basis or test. Each claim was traced: three have a study here and the card now states its
  sample, period, costs and verdict with a link (`.edge-tested`; COT extremes: `research/edge/cot-positioning` FAIL; the PM fix
  fade: `seasonality` H4 FAIL; real yields: `macro-gold`, same-day correlation and the failed timing rule); everything else had no
  source and its number is gone (the seasonal monthly averages and "80%", the −0.85 / −0.73 / −0.25 correlations, every Bollinger
  figure, the AM-range win rate, the summary table's Win Rate and R:R columns, now "Tested here?" and "Study"). `#edge-lab-note` at
  the top says what the tab is and links the Edge lab page. The checklist score is described as a count (it can reach 4 of 6: COT
  and the squeeze are never read, DXY is always counted), its verdict line no longer gives sizing advice, and the seasonal month no
  longer lights the COT dot. The Dashboard signal feed's "80%" for the season reads "On". Never put a win rate or "edge" back on
  this tab without n, t, the period and costs from a study in the repository. Test: `tests/side-pages.test.mjs` (the quoted figures
  are compared with each study's RESULT.md). **Done 12 Nov 2026 for the rest**: the Live Analysis tab's "Seasonal Edge" tile is "Seasonal tendency (not tested here)" (no study here tests gold's month of the year; `seasonality` tested clock and calendar windows, 0 of 10 passed), and the Dashboard's signal panel claims no edge or percentage chance: "Rule ideas on" (was "Edge Confluence", sub "A count of untested ideas, not a signal"), "Rule ideas, not tested edges" with a note linking the Edge lab page (was "Active Edge Signals"), feed rows "Seasonal tendency … not tested here", "DXY idea · Always counted as on" (was "DXY Decoupled … Active"), "Session" (was "Session Edge"), the macro direction as Long / Short / Wait and "Score n/40" instead of "n% Confidence", the gauge's "Confidence n%" row now "Tested here? No". Scores (`seasS`, `computeEdgeScore`, `computeMacroScore`) unchanged; test "gold terminal Dashboard" in `tests/side-pages.test.mjs`. The same day the last two: the Live Analysis setup card's "72% Confidence" (`#setupConf`, the macro score out of 40 rescaled to a percent) reads "Score n/40 · not tested here", and the Daily Bias tab's "highest-probability setup on the platform" (zone + M15 engulfing, no study here) and the supply / demand alert's "highest-probability reaction" now say the idea is untested. No "% Confidence" or "high(est)-probability" is left on the page (test "the setup card shows its score").
  Tests: `tests/qa-sweep.test.mjs` ("Side pages quality pass"). Left for the owner: the header switch is dots only on phones (a
  site-wide choice shared with the Desk); the gold terminal's Research → Edge Lab tab stated win rates and "high conviction" with no
  n or t (done the same day, paragraph above); `research/macro-veteran/START_HERE.md` (shown in the veteran
  library) named an assistant product in its title and headings and had words run together in its source (done 12 Nov 2026: the
  names are neutral, the spacing mended, `tests/no-model-names.test.mjs` guards rule 6); the macro desk's levels
  and "last close" come from the weekly daily-candle cache, so mid-week they trail the live price (council side).
- **Graphite look on the side pages and the Macro desk** (16-17 Nov 2026, owner: "do another one with other colors like grey";
  spec `docs/design/aureum-theme.md`). `assets/mx-page.css` defines the `--au-*` tokens for dark / light / midnight and points every
  older name at them (`--bg`, `--panel`, `--ink`, `--accent` = the steel-blue `--au-accent`, `--buy` / `--sell`, `--gold` = the
  neutral `--au-primary`, `--gold-ink` = the accent), so the Academy, which loads the same file, follows it. Shared parts: the
  wordmark (`.coin` = the silver "A" mark, `.wm-a` / `.wm-d`; under 420 px DESK stays only in the link's name), the switch
  `.hdr-sw` (no conic ring: the active place raised with a 2 px accent underline), `.btn` (secondary), `.btn.gold` (the one
  primary action, a solid neutral fill despite its old name), `.btn.quiet`, `.mx-head` / `.mx-lede` / `.mx-head-a` (title, one
  sentence, the action on the right), `.mx-sh`, `.mx-card`, `.mx-chip` (filter toggles), `.foot .mx-fb`. Fonts: the pages' Google
  link asks for `Inter:300..800` (vendored) instead of Figtree. `macro-desk.html` does not load mx-page.css: it keeps literal token
  values per theme (a test reads its light blocks), so **keep the two in step**; its section titles and tile labels are sentence
  case in the ink, the stale stamp uses `--au-warn`, the signed-out gate `#md-gate` is a card with the mark and one primary button
  (same sentence). Edge lab: a filter bar `#flt` (search `#flt-q`, verdict chips `#flt-v`, order `#flt-s`: reading order /
  newest first / A to Z; `decorate` / `applySort` / `applyFilter` run at the end of `render()` before `deepLink()`, which clears
  the filter when the linked row is hidden; display only), rows stagger at most 12 x 30 ms, the "Running" dot pulses three times.
  Veteran library: a 16 px body at about 72 characters, the facts as one quiet line, the document list folded on phones (opens
  while searching, folds after a choice). /macro: the head action "Open the Macro desk" (members) and a "Tools" heading; tool dots
  are neutral. offline.html: the same tokens inline, the mark drawn in CSS, the Desk's theme setting read. Measured: every text
  token 4.5:1 or more on bg / surface / surface-2 in all three themes (lowest light gain on surface-2, 4.82); 72 page states
  (5 pages x 360 / 390 / 430 / 1440 x three themes, signed in and out, folds open) with no text under 12 px, no touch target
  under 44 px, no text under AA and no sideways scroll.
- **Gold terminal, simple phone view** (11 Nov 2026, owner: "on the mobile there's too much, we need a simpler version for the
  phone"; display only, no number, score or rule changed, the locked features untouched). At 640 px and under the head script sets
  `html[data-phone="simple"]` unless this device chose Full (localStorage `ms-phone` = "full": the Desk's key and its "Phone view:
  Simple | Full" wording, so one choice covers both; the switch `#gxPv` sits above the footer and in the More sheet). Every rule of
  the simple view hangs on that attribute, which a wider screen never gets; the new elements (`.gx-po`, `.gx-bar`, `.gx-pv`) are
  `display: none` otherwise. What the simple view does: (1) Dashboard = hero, a shorter 5 min chart, then one line each for the
  daily bias (`details[data-fold="pbias"]`, summary `#gxFoldBias`; the bias strip `#dash-bias-strip` is MOVED into it through
  `data-pv-slot` and put back for Full, never copied) and the macro score (the setup fold first, phone title from `data-pt`), the
  other folds, no shortcut tiles; (2) the two tab rows give way to a bottom bar `#gxBar` (Dashboard, Daily Bias, Charts = Multi-TF,
  Red Folder, More) and the sheet `<dialog id="gxMore">` (the other eight tabs, light / dark, price alerts, the view switch);
  `switchTab` tells it the tab (`window.gxPhoneTab`); (3) the header is one swipeable line of prices (none on the dashboard, where
  the hero has the price); (4) every block marked `data-pf="Title"` is wrapped at run time in the page's own `.gx-fold`
  (`details.gx-fold.gx-pf`, state in `gxFolds` through the one writer `window.gxFoldBind`) with a one-line summary: `data-pf-s`
  text, or the live text of the elements `data-pf-q` names inside the block (an Edge Lab idea's line is its own status pills, word
  for word; the Edge Lab note and each tab's answer block carry no `data-pf` and stay open); `undo()` takes every block out again,
  so Full view and a rotated phone are the page as it was; (5) Multi-TF shows one timeframe (`#gxTf` Daily | H4 | M15,
  `#tab-mtf[data-ptf]`, `data-ptf-w` on the three widgets, localStorage `gxPhoneTf`), each chart with its structure readout.
  A chart made while its block is hidden starts 600 px wide and stretched a `1fr` grid column past the screen: the simple view's
  `.mtf-grid` is `minmax(0, 1fr)`. To fold a new block on phones give it `data-pf` (and `data-pf-s` or `data-pf-q`); the block
  itself must not be re-created by a render (its inside may be). Measured at 390 x 844: Daily Bias 8.2 → 1.8 screens, Live Analysis
  9.2 → 1.1, Sessions 7.4 → 1.7, Edge Lab 14.1 → 1.7; at 1440 px and in the phone's Full view every element's box is unchanged
  (0 of about 2,300 and 2,070 compared differ). Not folded: Edge Tracker (its cards are re-rendered by the page), Backtest Lab (short; its
  "Honest assumptions" stay open). Tests: `tests/side-pages.test.mjs` ("phone simple view"); the smoke test opens each tab's folds
  on the phone and fails on a block or chart past the screen or a tab with no phone button.

- **Gold terminal, graphite look** (16-17 Nov 2026, owner: "do another one with other colors like grey"; display only, the locked
  features, the driver stack, every score and the candle colours untouched). One block `GRAPHITE (17 Nov 2026 …)` right before the
  phone simple view's block defines the `docs/design/aureum-theme.md` tokens (`--au-*`) for light, dark and midnight and points every
  older name at them (`--panel`, `--line`, `--text-*`, `--mint` = the steel-blue accent, `--accent-green/red/blue`, `--amber`,
  `--gold-ink`; the starfield, teal arc and mint glows are off). Its rules start with `:root:root` only to rise above the older
  theme layers; they set colour, font, border and shadow, never the simple view's layout (keep it so). `--gx-up` / `--gx-dn` (and
  `-rgb`) are not touched, so `makeStructPrimitive`'s marks and the S/D zones look as before. The top bar's first link is the
  wordmark (`.pnav-desk`: the text "Desk", `::before` "Aureum", `.ms-coin` silver mark, back to the Desk; the qa test reads its
  text), then `.rail-brand` "/ Gold terminal". Charts read `--au-line` (grid) and `--au-ink-3` (text) in `gxPalette`. The two
  infinite animations (hero live dot, session dot) run three times; the MTF legend no longer says "highest probability". Left:
  the daily bias still shows its "60%" agreement figure (computeDailyBias's `conf`), and the theme / alert buttons are emoji.

## The veteran at a glance, self-calibration, what changed (9 Nov 2026, owner: "be the best of all time veteran, more visual, simpler")
`council/glance.mjs` (built by `council/veteran.mjs`): `summary(v)` → `veteran.json.summary`: one plain sentence ("This week: …"), the
bias meter (his month "closes above today" call vs its 10-year base rate: supportive / against at ±`LEAN_PTS` 3 points, else neutral;
confidence from the tested score's conviction, one step lower into an event; channel tally), the event that matters most (the
briefing's `event` insight, which now carries `event: { title, country, at, consensus, previous, goldMovePct }`) and the two levels
to watch (`nearestLevel` above / below, ≥ 0.4% away). `snapshot` / `archiveWeek` keep one compact briefing per week (latest run of the
week, `KEEP_WEEKS` 26) in `macro/veteran-briefings.json`; `briefDiff(previousOf(...), snap, calls)` → `veteran.json.changes` (bias,
gold price, insights new / dropped / lean flips / rank jumps, structural levels moved ≥ 0.1% matched without dates, last week's
hypotheses with their outcome from veteran-calls.json). `council/calibration.mjs` → `veteran.json.calibration`: every scored call
(dated, COT, hypotheses, the weekly ledger) binned by stated % vs came true (10 bins, Wilson 95%), Brier vs each call's base rate,
and one pre-registered adjustment p' = base + k·(p − base): k = Brier-optimal slope on the RAW probabilities with a prior `PRIOR`
0.3 toward 1, clamped `K_BOUNDS` 0.25-1.5, and exactly 1 until `MIN_SCORED` 30 calls are scored over `MIN_WEEKS` 4 due weeks. It is
computed in `run()` from the record before today's calls (no look-ahead) and applied to the outlook calls, COT calls and hypotheses
(each keeps `pRaw`; calls carry `baseP`, recorded in veteran-calls.json); the weekly ledger forecast keeps its own method. It cannot
fix base rates that are themselves off (`inTheLarge` shows that). No rule, size or trade changes. Desk (macro-desk.html), progressive
disclosure: `#c-glance` (sentence, meter, event, levels, "Public data only") → `#c-changes` + `#c-calib` (SVG reliability chart) →
`#c-brief` (insights as tap-to-open rows, hypotheses with big %, levels and analogs folded) → the calls (`#c-calls-d`, folded) →
`#deep` "The discussion and the data" (strip, member cards, tabs; open state in localStorage `mdDeep`). Tokens `--gold`,
`--gold-ink`, `--neutral-strong` per theme; every colour has a word beside it. Tests: `tests/calibration.test.mjs`, `tests/glance.test.mjs`.

## Desk smoothness and toolbar order (9 Nov 2026, owner: "smoother", "buttons organised", "simpler")
Measured with Playwright (stubbed /api/me, council-data served at /cdata, a fake 5-tick/s OANDA stream, phone = 390 px, DPR 3, CPU 4x).
Rules that keep it smooth: no `infinite` CSS animation on box-shadow / background / custom properties anywhere visible (the header
`.hdr-sw` ring spun forever and cost ~5 s of main thread per 8 s on a phone; it now sweeps once on hover); live dots pulse with
transform + opacity on a pseudo-element (`#ms-desk-css`). Page-wide MutationObservers must skip tick-only batches (`window.msLiveOnly`).
Chart panes track visibility (`P.vis`, IntersectionObserver): off-screen panes keep their data and analysis but skip canvas updates, and
`P.resync()` redraws them once when shown. The crosshair legend redraws once per frame with shared date formatters. Charts toolbar order
(CSS `order` on `#v-charts .sec-h` children, the DOM stays): markets, then timeframe | markup | indicators, then the context strip (daily
range, timeframe alignment), which folds behind `#ms-cx-tog` on phones (localStorage `ms-cx`). The watchlist row is reserved while quotes
load (`.wl-wait`). Nothing in the app may widen a 390 px page (`.ms-live.app { overflow-x: clip }`; the header hides the price-alert
toggle under 430 px: it stays in Settings, the chart bell and Ctrl K). Council status meta folds to one line on phones (tap / Enter).

## Load performance: delivery layer (9 Nov 2026, owner: "site-wide load performance")
Build-only, the source pages are untouched. (1) `vercel.json`: `/assets/*` and `/macro-dashboard/assets/*` WITH `?v=` →
`public, max-age=31536000, immutable`; WITHOUT `?v=` → `max-age=0, must-revalidate` (`has` / `missing` query `v`). Safe because
stamp-assets stamps every src/href and inline-style `url()` to an existing asset with its own sha256 (a changed file is a new URL);
URLs built in JS (`/assets/sounds/sl.mp3`) carry no `?v=` and always revalidate. Never add an /assets rule without the `has`.
(2) `scripts/self-host-fonts.mjs` (build.sh, before stamp-assets) turns each Google Fonts `<link>` in out/ into inline `@font-face`
on `/assets/fonts/` (variable woff2 per subset, same unicode-ranges and `font-display: swap`; SIL OFL, `assets/fonts/OFL.txt`) and
drops the Google preconnects: no render-blocking third-party CSS, no extra connections. Fonts come from `scripts/fonts-vendor.mjs`
(run by hand, `COMBOS`); a page asking for a family or weight range not in `assets/fonts/fonts.json` keeps its Google link and
`tests/delivery.test.mjs` fails until it is vendored. No font preload (it delayed first paint behind the chart library).
Measured (Playwright, phone 390 px / CPU 4x / 150 ms RTT / 1.6 Mbps, H2 + brotli q3 like the edge, live data replayed): cold
FCP −0.1 to −0.65 s on every page (macro desk 1.44 → 0.81 s, gold 1.57 → 0.92 s, Edge lab 1.50 → 0.94 s), warm loads make one
request (the HTML revalidation) instead of 3-6 asset 304s. Tried and dropped: inline JS/CSS minification (esbuild, −17% brotli on
the dashboard, no measurable time gain, adds a build dependency) and font preloads. Left for the page owners: the dashboard's
first load is 1.5 MB, two thirds live data (`cdata/ict/replay.json` ~400 KB, `trades.json` and `snapshot.json` fetched 2-3 times
under different cache-busters), and CLS 0.18 from the guest gate card (`.gate-wrap` / `.gate-card` resize after load).

## Macro desk charts (9 Nov 2026, owner: "go harder… more visual… more simpler")
macro-desk.html turns the numbers into small inline-SVG / CSS charts drawn at the host's pixel width (`draw(id, fn)`; redrawn on
resize and when a folded section opens, so SVG text stays ≥ 12 px; every CSS font is ≥ 12 px). Order: glance → `#c-score` (Gold
Macro Score path `sparkSvg` with the +0.25 / +0.5 thresholds labelled, the four drivers as a diverging z bar `driversHtml` with the
real change behind each, weekly table folded) beside `#c-ladder` (`ladderSvg`: nearest swing, 20/50/200-day, week and month high/low
on one vertical price scale, close marked, % and $; the full gold + DXY level table folded under it) → briefing (hypotheses as
`hypBars`: stated % against the all-weeks base rate; analogs folded as `analogMultiples` small multiples of the 20-session gold
path, "not a tested edge"; a range-strip fallback for an older veteran.json) → changes + calibration → calls (`hitRateSvg`
running hit rate vs expected by due week, empty state until scored) → deep (COT tab: `cotGauges` 3-year percentile per market with
the week's change arrow; the full table folded). One shared tooltip `#vz-tip` for every `[data-tip]` (mouse hover, tap, keyboard
focus; Escape closes; textContent only). Missing fields read `n/a`. New fields, tests in `tests/macro-visual.test.mjs`:
`goldScore.hist` (macroscore.mjs, `HIST_WEEKS` 26 weekly [Friday, score]; the page falls back to the 6-week `path`),
`briefing.analogs.top[].path` (briefing.mjs, gold % from the entry close, sessions 1-20), `callsScore().weekly` (`callsByWeek`,
outlook.mjs). No probability, rule or trade changes.

## Account surfaces, quality pass (11 Nov 2026, owner: "every bit of the website improved, not quantity but quality")
Profile, Users, the account menu, Settings, the price-alert dialog, the bell and the palette, walked as the owner, Fred, Orlando,
Luxus and Carlos at 390 px (touch) and 1440 px in dark / light / midnight, with the real `api/` handlers driven in memory (fake
stores) and saves failed on purpose (5xx, offline, an ended session). The permission dialog matched `msPerms` for every built-in
member and for every single-key combination; members never get a demo account number in the DOM or localStorage. Fixed:
- **Settings was cut off on phones**: the menu hung from its button and lost 68 px off the left edge. `#ms-acct-css` (a new style
  block after `#ms-profile-css`; put account-surface CSS there) pins it under the header at <= 560 px, above the tab bar.
- **Photo and display name** (`pushProfile(fields, what)` in the account-area script): a save the server did not take used to
  fail without a word, and the next visit put the server's old photo or name back. Now it says why (offline / ended session /
  server error) with **Try again**, the change waits in localStorage `ms-pfpend-<account>` and goes up first on the next load
  (`pullProfile` never overwrites a waiting field). `paint()` also refreshes the Profile card (it copied the menu 400 ms after
  the button press, before the member had chosen). A file that is not a picture clears the picker, so it can be chosen again.
- **Users page** (`saveUsers`): every failure names its reason (an ended session and a 500 both read "check your connection"),
  the table is redrawn from what is saved (a role select kept showing the refused role), keyboard focus survives the redraw
  (`US.fk`, `uRefocus`). "Back to role defaults" asks first and names the built-in settings that come back (for Fred that
  includes applying ICT changes without review). The owner note no longer names a model and says where the password lives.
- **Notifications**: send and delete share `post()` / `why()`; a failed delete used to say nothing (offline it threw). The
  slide-in card no longer takes the keyboard from someone typing or from an open dialog, hands focus back when dismissed, and
  "Mark all read" clears the card on screen.
- **Sounds**: the page called `msToast`, which does not exist: a save is now said in `#ms-snd-msg`, failures name the reason.
- **Price alerts**: failures in words (was "Failed to fetch" / "Server 500"), the message follows the last action, focus stays
  in the list after a delete. **Connector card**: the same for its errors. The cTrader link form no longer takes focus on every
  Profile visit (it opened a phone's keyboard). The palette lists "Profile and demo accounts"; the demo-account rows work by
  keyboard.
- No text under 12 px and every control at least 44 px on touch on these surfaces (`@media (pointer: coarse)` in `#ms-acct-css`;
  `assets/ms-dialog.js` buttons too); the permission dialog keeps Save / Cancel in reach (sticky row).
- Seen, left alone: the account button itself is 38 px wide on phones (the header's width budget at 390 px); deleting a price
  alert has no confirm (one tap, recreated in seconds); a member without `ct` sees "link your own cTrader account" on the
  profile (the older linking feature); a viewer's account menu counts shadow trades ("+ n shadow").
- Tests: `tests/qa-sweep.test.mjs`, `tests/users-perms.test.mjs`, `tests/notify.test.mjs` (page wiring). Playwright note: a
  `fullPage` or element screenshot resets touch emulation, so measure sizes before taking one.

## Installable app (9 Nov 2026, owner: "installable on phones and desktops")
`app.webmanifest` (id `/`, "Meridian X", standalone, `#08090c` = the desk's dark `--bg`, shortcuts /gold, /macro-desk, /backtest)
with icons in `icons/` drawn from the coin favicon by `scripts/make-icons.mjs` (any 192/512, maskable 192/512, apple-touch-icon 180,
badge-96 for push; run it by hand with Playwright, commit the PNGs). The old GOLD `manifest.json` and root icon-192/512 stay for old installs.
**Mark and icons, graphite (16-17 Nov 2026, docs/design/aureum-theme.md section 2):** the one drawing is `assets/aureum-mark.svg`
(brushed-silver rounded square, 8 px radius on 28 px, a bold "A" as a path in #16181B, no font); `assets/aureum-mark.css`
`.ms-coin` is the same letter as a mask (a test compares the paths). `NODE_PATH=$(npm root -g) node scripts/make-icons.mjs`
reads the SVG and draws every icon (any on transparent; maskable, apple-touch and the root icon-192/512 on #121315 with the
tile inside the 40 % safe circle; badge-96 = white tile, A cut out; favicon-32) and `icons/og-card.png` (1200 x 630 link
preview, vendored Inter embedded, not wired to pages yet). Manifest and pwa.mjs theme colour #121315 (`--au-bg`).
Tests: `tests/aureum-mark.test.mjs`, `tests/pwa.test.mjs`.
**Email logo** (18 Nov 2026, owner: "aureum should have a image or logo for email"): `icons/email-logo.png` (the mark + AUREUM
/ DESK on one line, graphite ink, transparent, 585 x 96 drawn at 3x by make-icons.mjs) heads every email of `api/signup.js`
**Email design** (19 Nov 2026, owner's screenshot: "improve the email design, make green shorter, remove red"): `api/signup.js` `html` =
the logo centred, a white card with a 3 px graphite top edge, a bold greeting, a larger button with an arrow, the fallback as one short
line "Button not working? Open this link (aureumdesk.co.uk)" (`shortLink`: the host only; the whole address is behind the link, the
token never printed), the note in a grey band, and a centred footer "Aureum Desk · aureumdesk.co.uk" WITHOUT the "paper-trading desk /
not financial advice" line. The sender picture in Gmail is not set by the email itself (a Google account for the sending address with
the logo as its photo, or BIMI, which needs a paid certificate): the owner's step.
(`LOGO`, always from https://aureumdesk.co.uk/, shown 195 x 32, alt "Aureum Desk"). PNG on purpose: most mail apps show no SVG.
- Build step `scripts/pwa.mjs out` (build.sh, before stamp-assets): adds the missing head tags to every built page (manifest,
  theme-color, apple-touch-icon, apple-mobile-web-app-capable / -title / -status-bar-style black, mobile-web-app-capable, and
  `/assets/pwa.js` which stamp-assets versions). Never hand-add these to page sources. It also writes out/sw.js `VERSION` = hash
  of pages + assets + icons + manifest + worker (data JSON excluded), so every site change is a new worker.
- `sw.js` rules (tests/pwa.test.mjs): navigations network-first, never cached, offline -> `/offline.html` ("You're offline —
  prices and trades need a connection"); `/api`, `/cdata`, `/md`, `/_vercel`, other origins, non-GET, Range: not touched (no
  respondWith, nothing stored: private data and API answers never enter Cache Storage); only `/assets/*?v=<hash>` is
  stale-while-revalidate (one entry per file). Unversioned assets (sounds) go to the network: the stale-sound bug cannot come back
  through the worker. Caches `mx-shell-<VERSION>` / `mx-assets-<VERSION>`; activate deletes older `mx-` / `meridian-` /
  `gold-terminal-` caches. skipWaiting + clients.claim: a deploy takes over within seconds of the next page load or of
  `assets/pwa.js`'s update check (tab visible again, every 15-30 min); open pages are not reloaded mid-use, only when they come back
  after 10+ minutes hidden with nothing in hand (`busy()`, 11 Nov note below). Push / notificationclick handlers unchanged (icons now /icons/).
- Kill switch: Vercel env `MX_SW_KILL=1` + redeploy -> the worker stops handling fetches and deletes its caches but stays
  registered (price-alert pushes keep working). One device: open any page with `?sw-reset` (unregisters + clears caches; that
  device's price alerts need turning on again).
- Install: iPhone Safari -> Share -> Add to Home Screen (needed for iPhone push); Android Chrome -> menu -> Install app; desktop
  Chrome / Edge -> install icon in the address bar.
- **Checked in a real browser with the worker ON** (11 Nov 2026): `node scripts/audit/pwa.cjs` (47 checks, about 25 s, in `ci.yml`
  `pages`; `PORT` = a FREE port, it serves `out/` itself with vercel.json's rewrites and cache rules; no network; every other audit
  blocks service workers). First visit, heavy use as the owner (Cache Storage holds only `/offline.html` and `/assets/*?v=`; 100+
  `/api`, `/cdata`, `/md` answers marked private and sent as cacheable never get in), offline on every page and back, a deploy under
  open pages (a copy of `out/` with one asset changed), the kill switch, `?sw-reset`, real push events, manifest, fonts. Found and fixed:
  - `assets/pwa.js` held the quiet-moment reload back for ANY open `<dialog>`. ChronosTrade's first-steps card is one (non-modal,
    up until dismissed), so that page never picked up a deploy by itself. `busy()` now means: a modal dialog, the cursor in a
    field, or text typed into a visible text box and not sent (that last case used to be reloaded away). A skipped reload is
    tried again at the next return.
  - `?sw-reset` with another window of the site open: the browser keeps the same worker and runs no install, so the page came
    back with no worker and no caches until the next deploy. The reset page leaves `sessionStorage mx-sw-reset`; the next load
    posts `mx-prime` and the worker in charge sets its caches up again (`prime()`, also the install step) and claims the page.
  - Push: a JSON payload of `null` threw in the handler (no notification of ours) and a bare string lost its text; `notice()`
    reads any payload, caps title / body / tag, and `inSite()` keeps the link inside this site (also on the tap).
  - A tap on a price alert navigated whichever window was open, so a ChronosTrade replay or an Academy session was replaced by
    the chart. Now a window already on the Desk is focused and taken there; other pages are left alone and the chart opens in
    a new window (an open one is navigated only when the browser will not open a window).
  - How the hand-over really goes (Chromium): the open pages get the new worker first, its `activate` step (old caches out) runs
    about a second later; a page that keeps talking to the old worker (or holds a response from it unread) can delay the
    hand-over until the worker is idle, 5 minutes at most. Old `?v=` URLs of an open page keep answering from the network.
  - The stamp misses only URLs built in script (today `/assets/sounds/sl.mp3`): those revalidate and are never stored, so they
    cost a request but cannot go stale. No `srcset`, preload, `@import` or stylesheet `url()` points at an asset
    (`tests/delivery.test.mjs` fails if one appears, or if a stamp is not the file's hash, or a font file is missing).
  - Not checked: Safari / iOS (install, push, `dialog:modal` falls back to any open dialog there if unsupported), a real push
    service, and the tap on a real notification (the handlers are pinned in `tests/pwa.test.mjs` on a fake worker).

## The veteran's event playbook (9 Nov 2026, owner: "be the best of all times veteran", "keep improving all the bits")
`council/playbook.mjs` (pure, no fetch; built by `veteran.mjs` → `veteran.json.events`, `eventsRecord`): one card per red-folder
release on the strategist's calendar within `WINDOW_H` 72 h (kept `KEEP_H` 12 h after the print), same time + country grouped
(Core first). Expectations: the consensus `captureExpectations` froze before the release, the forecast cluster only where the
repo has one (the batch's CPI pilot 0.255% and its captured Cleveland core nowcast 0.21%, `cpiPilot().comparator`), range n/a.
Hot / in-line / cool rows (the strategist's `rule`, Fed path, dollar, gold, the action: act after the release, not before; a ¼
starter after the first hour on a retest, the skill's rule G; funded accounts flat). History: `council/event-base.json`, built by
`node research/edge/event-reaction/build.mjs <council-data>` from HistData M1 gold + dollar index (86 CPI 2018-26, 51 NFP and 34
FOMC 2022-26; CPI 2018-21 dates spike-checked, 15 dropped), split by the dollar's first 5-minute read (±`READ_PCT` 0.05%, not a
consensus surprise) and, CPI 2022-24, by the core print vs the Cleveland nowcast; the release-day move from the daily closes at
run time; rows and days cut at `now`. The one pre-registered test (CPI T+5→T+60 follows the dollar's read) FAILED (34/73, p 0.76),
so every figure is labelled "Descriptive, not a tested edge". HistData clock: the files are UTC−5, and UTC−4 while Europe is on
summer time, and New York time in 2018 (`council/histdata.mjs`; see "Research candle clock" below), not "EST without DST" all year. The call: P(gold's release-day UTC close
> the prior close) = past same-type release days shrunk (`SHRINK` 20) to every weekday's 10-year up-rate (`baseP`), band 30-70%,
calibrated, issued only before the release, one per day (`evt:<date>:gold:dayUp`), recorded once via `callsLedger`, scored by the
new `dayUp` / `dayDown` kinds in `resolveCall`; calibration source `event`. Desk: `#c-next` under the glance (countdown UTC + local,
expectation scale, scenario table, strip of past first hours, folded detail). Tests: `tests/playbook.test.mjs`. Paper only.

## Macro desk calm pass (9 Nov 2026, owner: "more simpler", "more visual", "keep improving all the bits")
macro-desk.html reads as one story, each a `<section class="story">` numbered by a CSS counter (a hidden section leaves no gap) and
hidden by `syncStory()` when none of its cards has data: 1 This week (`#c-glance`, "What changed" folded inside as `#c-changes`) →
2 Next release (`#c-next`; the three cases in one row, the full hot / in-line / cool table in its detail fold) → 3 Why (`#c-score`
path beside its drivers, then `#c-ins` key insights) → 4 Where price sits (`#c-ladder`) beside 5 What he expects (`#c-brief`
hypotheses; his dated calls `#c-calls-d` and the analogs folded) → 6 Track record (`#c-calls` hit rate over time, `#c-calib`) →
7 The detail (`#deep`, unchanged). Card anatomy: `.c-t` title, `.c-take` one line, the chart, `details.fold` (44 px summary).
Tokens `--s1..--s6`, `--fs-xs..--fs-2xl`, `--well` (inner tiles have no border); chart colours: gold = his number or the series,
ink tick = base rate, green / red = up / down with a word or glyph. `#toc` sticky section chips (≥ 900 px, aria-current via
IntersectionObserver). `#stamp`: "Updated N min ago", or "Stale: last update …" when the older of forecast.json / veteran.json is
over `STALE_MIN` 90 min (red over `OLD_MIN` 6 h). COT tab: the pre-registered study's verdict in words (`#cot-edge`: failed
overall, the markets with a passing cell, "no tested edge" for the rest) and a tag per gauge from `edgeStatus` / `edgeText`.
No council logic changed. Tests: tests/macro-visual.test.mjs (calm pass).

## Macro desk: design pass on the newer sections (20 Nov 2026)
macro-desk.html only; display only, no number, probability, claim wording or council logic changed. Found by measuring every drawn
text and control (size, contrast against its composited background, touch size, overflow, layout shift) at 1440 and 390 px in
dark / light / midnight with every section and fold open. Fixed, in the page's own tokens:
- **Week ahead**: in "The frame for the week" the detail lines ran into each other ("…Fed decisionKalshi: … 4%Polymarket: …":
  `.wa-r` was a block only inside a day); it is `.wa .wa-r` now. Day tiles are wells with no border (they were bordered boxes in
  a card), their title weight 600; verdict chips are the colour on its 14 % tint over the panel (they were outlined; the plain
  soft tint over a well gave 4.26:1 in dark); "The study" is 44 px on touch (was 16 px).
- **Red folder study**: the up / down moves read `--buy` / `--sell` (they read undefined `--up` / `--dn` with hex fallbacks,
  3.1-3.7:1 on dark and midnight); small print and the caption are `--ink-faint` instead of `opacity` (4.37:1); "Show all n
  releases" sits on its own line (it floated right over the note); on a phone the eight tabs are one row that scrolls inside itself (they wrapped to two rows of two-line labels),
  and the chosen tab is brought into view with the row's own `scrollLeft`, never `scrollIntoView` (it would move the page).
- **Daily reports**: tab labels never wrap ("World economy" broke in two on a phone); the Summary box is a plain well with a
  sentence-case label (it had a 3 px accent stripe and an uppercase label reading an undefined token); the report text keeps a
  measure of 88 characters (lines ran 1,330 px wide at 1440).
- **Your read**: the "Market by market" table scrolls inside its box on a phone and now keeps the market column in place.
- **The detail**: source links (16 px tall) and veteran library documents (42 px) are 44 px on touch.
- Four dead literal fallbacks on defined tokens (one the old gold `#e3b341`) and three undefined tokens (`--accent-ink`,
  `--ink-2`, `--up` / `--dn`) are gone.
Rules to keep (block "Design pass (20 Nov 2026)" right before the simple phone view's block; that block got nothing new):
every colour is a token this page defines, never `var(--x, #hex)` and never `opacity` to dim text; a tile inside a card is a
well without a border; a chip is its colour on `color-mix(in srgb, <colour> 14%, var(--panel))`; a tab label never wraps; a
table that scrolls sideways keeps its first column sticky. Measured after: 0 texts under 12 px, 0 under AA, no sideways scroll,
layout shift 0.002-0.003 (1440) and 0 (390) in all three themes. Left: the level ladder's focusable chart rows are 33 px tall
on touch (a chart row, tooltip only); older parts still use 12.5 / 13.5 px sizes off the spec's scale; with every file
unreadable the stamp says "No macro data yet: the council has not written its files." (wording, not changed here).
Test: `tests/macro-design-pass.test.mjs`.

## Macro desk: simple phone view (11 Nov 2026, owner: "On the mobile there's too much, we need a simpler version for the phone")
macro-desk.html only; display only, no number, probability or claim wording changed. On a screen up to 640 px the page opens in
its simple view: the head script sets `html[data-phone="simple"]` before the first paint unless this device chose the full view
(localStorage `ms-phone` = `full`; `window.msPhoneView(v)`, event `ms:phone`). Key, attribute and the switch's wording
("Phone view: Simple | Full", `#ps-sw`, foot of the page, phones only) are the Desk's, so one choice covers the site.
Measured at 390 x 844 on the 11 Nov files: 8.9 screens → 1.9, 1,357 words → 282, 6 charts drawn on load → 1.
- **First screen = the glance alone** (`#c-glance`): bias with the meter, the chance against its base and "Confidence …"; the
  event; the two levels with the price now. Three plain rows in one card (no boxes in a box). The stale stamp (`#stamp`), the
  stale-levels notice (`lvStale`) and "broken since the close" stay on it in words. Behind `#g-more` "The week in one sentence,
  and more": the sentence (`.g-sent`) and the lines marked `gx` (channel tally, the playbook link, where the levels are from,
  the daily-close line, the long form of "Public data only"). The page lede is hidden; "paper only" stays in the section header.
- **Sections 2 to 6 fold** (`section.story.sfold`: Next release, Why, Where price sits, What he expects, Track record) to the
  title and ONE line (`.st-go` button in the header, the whole row is the target; `.st-one`), and open on tap. The line is
  COPIED by `syncOne()` from what the open card already prints (`#nx-take`, `#sc-top`, `#ld-take` with the `#ld-stale` notice in
  front, `#hyp-take`, `#calls-take` / `#calib-take`), less the parts wrapped in `.tk-x` (chart legend words, the level list the
  glance already shows): never a number or a sentence of its own. A section with no takeaway shows its sub-label instead.
- **Charts**: a folded section has no width, so `draw()` leaves its charts undrawn (cheap); `foldSet(sx, true)` calls
  `redraw(sx)` on EVERY opening, `ms:phone` (switching the view) redraws all, resize as before. The 11 Nov "blank on first
  load" order (show the story, then `redraw()`) is unchanged and pinned. An address like `/macro-desk#s-price` opens that
  section and goes to it.
- **The detail** stays last and folded: in the simple view a stored `mdDeep = 1` is not restored on load (desktop and Full
  still restore it). The section chips (`#toc`) stay desktop-only.
- **Full view** is the phone page as it was plus the switch: every rule of the simple view sits in one
  `@media (max-width: 640px)` block at the end of the sheet and, the switch apart, under the attribute. Checked by comparing
  every visible element's box, font size, colour and text before / after at 1440 (three themes), 768, 641, 390 Full, 360 Full
  and signed out: identical but for four wrapping spans (`gx` / `tk-x`, same text in the same place) and the switch.
- Not simplified: the content of an opened section (it is today's card), and the detail once opened (many screens: the
  discussion, sources, COT, ledger, library are reference reading).
- Tests: `tests/macro-visual.test.mjs` (simple phone view: three tests). `scripts/audit/smoke.cjs`: on the phone, as a member,
  every folded section is opened and each chart in it must be drawn at its host's width (fails with "folded section opened: …").

## Macro desk: Your read, today / this week / this month (18 Nov 2026, owner: "we don't need 'check a trade', find ways to be able to use it daily weekly and monthly")
Display only, `macro-desk.html` section 2 `#s-plan` / `#c-plan` (`sfold`, folds on the phone; TOC chip "Your read"). It replaced the
same day's "Before you trade" (its Check-a-trade form, `MD_CHECK` and `tests/macro-trade-check.test.mjs` are gone). One switch
(`.pl-tabs`, Today | This week | This month, arrow keys; localStorage `mdPlan`, a display preference) over what load() already has
(forecast.json, veteran.json, cot.json); nothing else is fetched and nothing is computed as a new forecast.
- **Today** (`MD_PLAN.day`): per market the strategist's lean (pUp ± 0.03), a normal day as ± % AND as a price range around the price
  now (gold: the strategist's latest mark), "1.7x usual" from `volRatio` >= 1.3, the next release in 24 h that reaches it (Wait within
  an hour), positioning (COT 3-year percentile, crowded at 90 / 10, the yen inverted); gold's nearest levels above and below the PRICE
  NOW from `briefing.levels.gold.list`; the mood (VIX, curve, markets moving more than usual).
- **This week** (`MD_PLAN.week`): the veteran's week calls (`outlook.week`, stretch calls left out) and hypotheses (`horizon: 'week'`,
  with "Wrong if"), each as his % beside the base rate; the header names the close they were issued from (`outlook.anchor.asOf`:
  "today's close" inside a call means that close); the week's levels (kind `week`, week `range60`), releases over 7 days (veteran
  cards + the strategist's playbook, once each), `changes.items`, the Gold Macro Score now against last week (`hist`), positioning
  with the week's change in net contracts.
- **This month** (`MD_PLAN.month`): month calls, month hypotheses, the dollar's calls apart, the slower levels (month extremes,
  averages, the quarter's range, month `range60`), the last 8 weekly Gold Macro Scores, and the record so far (calibration n of
  `need.scored`, "too few to judge" until then; the weekly ledger's issued / resolved).
- Every view's first line (`#pl-take`) is the folded header's line (`syncOne`). Wording: "Leans, not calls", never an edge or advice.
- **More useful (18 Nov 2026, owner: "keep improving it make it more useful")**: every week / month call and hypothesis shows where it
  stands NOW (`MD_PLAN.status`: the price now, gold = the strategist's mark, the DXY = `regime.dxyProxy`, against the call's level;
  On track / Off track / Open with the distance; a race read by its geometry, not its kind's name) and the daily closes left
  (`daysLeft`: weekdays' 22:00 UTC closes still to come, today's included until it is in); a note says the record is scored on daily closes, not this reading. Today adds the next release's
  hot / in-line / cool cases (`nextRelease`, from `veteran.json.events` scenarios, its own "not a tested edge" label). "Copy as
  text" (`#pl-copy`, `MD_PLAN.text`) puts the open view on the clipboard as plain text with the same honesty line.
- **Found and fixed on the way**: `council/veteran.mjs` `freezeHypotheses` showed the recorded claim with the LIVE reading's kind,
  base and "Wrong if" when the two differed (18 Nov: H1 read "closes at or above $4,000" with kind `firstTouchDown`, H2 "between
  $3,853 and $4,149" with "Wrong if: outside $3,800-$3,900"). Display only: scoring reads the ledger, which was right. Now the kind
  and base come from the record, "Wrong if" is rebuilt from it (`invalidOf`), and the live why / Wrong if go to `live`.
  Tests: `tests/macro-plan.test.mjs` (runs the page's pure block), `tests/macro-visual.test.mjs` (six folding sections).

## The veteran's closes are as fresh as the strategist's run (11 Nov 2026)
Found mid-week: the Macro desk said "Last close 2026-11-06" and "Watch $4,100 above and $4,045 below" with gold near 4,030.
Cause: `veteran.mjs` `run()` read its closes only from the weekly candle cache (`research/daily/<key>.json`, Saturdays); the
strategist's "this run's closed days" extension (9 Nov) lived only inside `scoreSeries` for the Gold Macro Score and was never
written anywhere the veteran reads. Display / freshness only: no probability, calibration, rule or trade maths changed.
- **Hand-over** `macro.mjs` `handDaily` → `macro/cache.json` `daily: { src, days: { <cache key>: [[dayStart, o, h, l, c]] } }`
  (`HAND_KEYS`: xau, the five DXY pairs, spx500, nas100; last `HAND_DAYS` 30): COMPLETE UTC days only (never the forming
  candle: a level must not move intraday), only when the run's candles are OANDA's (a Kraken fallback has another price
  basis), a failed fetch keeps the last good days, no timestamp. `veteran.mjs` `extendDaily` appends them after the cache's
  last day only when they reach back to that day AND agree with its close (same feed, no gap: the ledger counts rows), cut
  at the veteran's `now`; otherwise the cache is used alone. The veteran still fetches nothing. `veteran.json.closes` says per
  market how far the cache went, how many days were added, or why none. xag / audusd / nzdusd are not fetched by the
  strategist: their COT calls are resolved from the weekly cache as before. The handed candles are the candle cache's own
  (1,396 overlapping gold days compared, identical).
- **The record keeps its weekly cadence** (`veteran.mjs` `run`). Rule: everything RECORDED (the dated week / month calls,
  the COT calls, the hypotheses, the weekly ledger forecast, the debates, the event calls) is built, by the unchanged
  pipeline, from the closes BEFORE the start of the current Saturday-based week (`weekKey`): exactly what the candle cache
  held after Saturday's refresh, which is what every record so far was built from. So the anchor is the last Friday's
  close, the due dates and ids (`asset:kind:level:by`) are the ones main wrote, and one set is added a week whatever day
  the week's first run falls on (a "range" call can still be re-issued when the council tilt moves its bounds: the id rule
  as it was). The DISPLAY is a second `build` on the fresh closes with `keep` = the recorded outlook and ledger view:
  last close, levels, ladder, glance, analogs move daily; "his dated calls" are the recorded ones (`outlook.anchor` says
  from which close; the desk prints it) and a recorded hypothesis shows today's reading beside it through the existing
  `freezeHypotheses` `live`. Results are read from every complete close, so they arrive on the day they are due instead of
  after Saturday. Never issue the dated calls from the fresh closes: daily overlapping calls would fill the calibration
  sample (its pre-registered 30 calls / 4 weeks gate, the Wilson bands) with correlated records and cut the 600-record
  ledger from about nine months to seven weeks.
  Proof: on the real council-data files of 11 Nov, main's code and this code (with the hand-over) write byte-identical
  `veteran-calls.json`, `veteran-ledger.json`, `veteran-debates.json` and `veteran-expectations.json`; on the two-week
  fixture (`tests/fixtures/vet-fresh-fixture.mjs` `simulate`) both write the same 54 records, pinned in
  `tests/veteran-fresh.test.mjs` by count and by a hash of every id, issue date, level, due date, p, pRaw and baseP taken
  from main's own code, with the same 8 scored calls and the same calibration block.
- **`resolveCall` waits for the data**: a call is scored only once the closes on file reach its date. This changes the
  outcome only for a candle file that ENDS before the call's date (it used to be scored on the file's last day); on a
  file that reaches the date the result is what it was.
- **Honesty** (`glance.mjs`): `closeAge(asOf, now)` = weekday sessions fully ended since the close, skipping full-closure
  days of `datacheck.mjs` `usHolidays` (no second calendar) → `fresh { asOf, sessions, stale, text }` on each level block:
  "as of <date> close", or "Stale: last close <date>, <n> trading days ago" from one missed session. `markOf(fc)` = the
  strategist's latest gold price (`assets.gold.last` at `fc.at`, OANDA only); `markLevels` stamps `mark` and `crossed: true`
  on every level between the close and that price; `watchLevels` then picks the two levels either side of the PRICE, tags a
  crossed one, and `broken` names the level that was the one to watch at the close. When the price is past every level on file on a
  side (19 Nov 2026: gold 3.7% under the close), that side is the next $50 round number beyond the price, `made: true`, labelled
  "price is under every level he tracks" (the rule of "Your read"); never added to the list. The sentence says "Gold has traded below
  $X (label) since the <date> close and is near $Y". None of it is read by a hypothesis or a call (`nearestLevel`'s `ref`
  argument is display only; a test pins that hypotheses, calls and level prices are the same whatever the latest price is).
- **Desk** (macro-desk.html): `lvFresh` / `lvStale` / `hmUtc`; the glance tile, the ladder (`#ld-stale`, a hollow dot for
  the latest price, "broken since the close" on crossed rows, next above / below from the price) and the level table.
  An older veteran.json without the fields reads as before.

## Post-merge QA sweep (9 Nov 2026, PRs #682-#705)
Every page at 390 / 1440 px in dark / light / midnight as owner, reviewer, viewer and signed out (stubbed /api/me, real council-data
at /cdata). Fixed: the side pages' header ring spun forever (`assets/mx-page.css`, now one sweep on hover / focus like the desk);
offline.html was 9 px too wide on phones; the Edge lab donut label fell to 10.8 px on phones; the macro desk jumped (layout shift
~0.45) while its story loaded (`main[data-loading]` until the first load); macro desk light green / red / link text and ChronosTrade's
quick Buy / Sell labels under AA; the gold terminal had no way back to the desk (the installed app's "Gold" shortcut). Checks:
`tests/qa-sweep.test.mjs` (also pins the owner's grey / black light-mode candles) and `scripts/audit/smoke.cjs` (offline.html, and no
visible endless animation of a custom property or box-shadow on any page).

## Post-merge QA sweep (11 Nov 2026, PRs #706-#722)
The Mosha desk (log, replay chart, teach cards, tutorial, French / English, the one-tap questions), the ICT desk's execution chips
and "Replay through" text, and ChronosTrade's split view, timeframe chips, session button and teach chip / dialog, at 390 px (touch)
and 1440 px in dark / light / midnight as owner, reviewer, viewer (Luxus, Carlos) and signed out (stubbed /api/me, real council-data
at /cdata, the lessons and log endpoints driven in memory by their own handlers with seeded lessons, answers, questions, a chart and
book lines). No page or console error, no permission leak and no dead deep link (`#mosha`, `#ict`, `#trade/<id>` both executions)
was found. Fixed:
- **Every desk view was 10 px too wide on a phone** for the owner and reviewers since Mosha became the sixth desk: `.desk-sw` had
  `width: max-content`, so the view's column grew to the switch and the right edge of every card was cut (the app clips, so nothing
  scrolled and the old smoke test saw nothing). The switch now takes the room there is and scrolls inside itself; tighter padding
  under 430 px; "soon" is 12 px and AA on the light panel.
- Mosha desk: the teacher's own buttons (right / not right, send, the lesson's actions, the book form, picture viewer, levels dialog,
  tutorial close) were 36-40 px on touch, now 44; 10-11 px text raised to 12; in the teach form's fold the date-and-time field pushed
  "Entry time" under the next label on phones (a field now stays in its cell, that one takes the row); the replay's Steps / Candles /
  Speed names sit beside their own buttons on phones; a record with no drawdown said "−0.00R"; light-theme green / red text and the
  buy / sell chips were 3.8-4.5:1 (`--buy` / `--sell` scoped to the desk, its tutorial and levels dialog).
- ICT desk: signal filters (34 px) and the review's fill / R fields (29 px) are 44 px on touch, 16 px text in the review fields on
  touch (no zoom-in on an iPhone), the result tiles' small print (won · lost · flat · near-flat) is 12 px.
- ChronosTrade: the chosen timeframe chip was white on the dark themes' accent (3.2:1; a fixed blue now, like quick Buy / Sell) and
  the toolbar's timeframe on the light panel sat at 4.50; chips are 44 px on touch; a position card cut its stop and target to
  "4180." (the old table's `#open input { width: 60px }`); the teach dialog's hints and the session form's labels are 12 px.
- Checks: `tests/qa-sweep.test.mjs` (one per fix) and `scripts/audit/smoke.cjs`: on the phone no inner view of the Desk may end
  past the screen ("view cut off on the right"; `#crypto` and `#sdv` joined the inner views).
- Seen, left alone in the first pass: see the second pass below for what was then done.

**Second pass, same day (branch `desk-polish`, owner: "keep working improving everything").**
- **Who teaches whom, on the page**: for a teacher who is not the owner (`html[data-mosha="teach"]:not([data-role="owner"])`) the
  cards `#mo-rules` ("What the fixed rules said", the five studies' figures) and `#mo-cycle` ("The cycle, as you described it": the
  desk's own summary, addressed to the owner) are hidden. The owner and readers keep both. Never show either to the teacher.
- **ICT typography pass**: every text on `#ict` and in the signal dialog is at least 12 px (chips, grades, pills, level labels,
  calendar, tags were 9.5-11.5 px); one block "ICT typography pass" after the desk's touch rules, so put later ICT rules at 12 px or
  more (a test reads every size after it; the smoke test measures the drawn desk). On a phone a signal with two executions keeps
  its result and both chips in a row of their own (they were cut off at the right edge, over the result); "Replay through … update
  pending" in the dialog is no longer clamped to three lines (it says which candles the result does not cover).
- **Light theme tokens** (`market-structure.html`): `--buy` #067a64, `--sell` #c8243f, `--ink-faint` #666d7a, `--accent` #2a62f0
  (were 4.46-4.50:1 as text on the white panel). Measured on all 20 views at 390 and 1440 px before and after: 272 texts reach AA,
  none got worse (the candle countdown `.ch-cd.up` takes white text in light for that). Styled dialogs (`assets/ms-dialog.js`
  `.msd button.pri`, `.own-acts button.pri`): fixed fills #2a62f0 / #c8243f, white at 5.1 / 5.6 in every theme (dark was 3.2).
- **The address matches the view**: a refused view (`#mosha` or `#ict` for a viewer, anything but charts for a guest) is rewritten
  with `history.replaceState` in `showView`. **Trade links**: the main `hashchange` handler leaves `#trade/<id>` to the trade router
  and a view transition draws from the address of its own navigation (`showView(hx)`); before, a pasted trade link or Forward after
  closing a signal sent the page home a frame later and an ICT signal's dialog sat "open" inside the hidden desk. `showBase` replaces
  a pasted link's entry even when its desk is already shown, so closing the sheet lands on the desk. A skipped transition's rejected
  promises are caught (they surfaced as "Transition was skipped" page errors).
- Mosha: a corrected book line's "The desk had: …" shows the translated seed line in French (`wasOf`); a date-and-time field takes
  the whole row on phones in the log form and its exit row too.
- Checked by hand in a browser, nothing to fix: choosing, pasting and dropping screenshots into the teach form (a 2600 px PNG is
  stored as an 1800 px JPEG of about 50 KB, captions kept, a text file refused with a message, the lesson shows its pictures); the
  owner's log form (no stop and a stop on the wrong side refused, open → Check candles → close → record → replay → locked levels →
  delete through the styled dialog); home, charts and the council panes at 390 and 1440 px.
- Checks: `tests/qa-sweep.test.mjs` ("Second pass": 8 tests), `scripts/audit/smoke.cjs` ("ICT desk text under 12 px").
- Still open: light-theme status badges with their own colours (`.ms-st.near` amber on amber 1.8:1, `.ms-st.ready` white on green
  3.6, the scanner's tags, the sidebar's gold "Aureum"), about 190 texts under AA in light; the macro pane's "agree" / "disagree"
  words (3.5-3.6); ChronosTrade's 32-36 px toolbar buttons on phones. **Done 12 Nov 2026** (branch `desk-open-qa`, display only):
  a viewer's (or a member without the council permission) `#council/<pane>` is rewritten to `#council` with `replaceState` in
  `showView`, like a refused view; calendar day and week cells write a figure through `MS_HC.calR` (two decimals under 10R, one
  from 10R, none from 100R: six characters; the cell's aria-label and the day detail keep two), and both calendars are 12 px on
  a phone in a 39 px box (the Council's six-character figures needed 38.8 px in 38.3, the guest's were 9.5 px); the Council
  status line's amber warning reads `--warn-ink` (light, at the gradient's darkest point: 4.2-4.5:1 → 5.0-5.4:1). Tests in
  `tests/qa-sweep.test.mjs` ("Open items of the 11 Nov sweep").

## Post-merge QA sweep (12 Nov 2026, the ~20 PRs merged since 11 Nov 21:00 UTC, two sessions in parallel)
Every page at 360 / 390 px (touch; simple view and Full view) and 1440 px, in dark / light / midnight, as owner, Fred, Orlando,
Luxus, Carlos, a guest and signed out (stubbed /api/me, council-data from `origin/council-data`, the guest files cut by
`api/_guestcut.js` as the server does). No page error, sideways scroll, cut-off view or dead in-page link; guests saw only
main-system rows; the guest-cut lists match the page's `SYS_K` / `SYSG` (Mosha cycle included). Fixed (display / wiring only):
- **Charts, simple view**: the market-cycle strip (`#ms-cycle`, #761) arrived 3.6 s after load between the timeframes and the
  chart: the chart started at 390 px instead of 255 and the page shifted (CLS 0.11 a load). It now waits behind "More" with the
  markup it reads (`.cycle` in the "More" rule; the button's label names it); the smoke test fails when it shows on a phone.
  Desktop keeps the strip (a 0.03 shift when it arrives, left).
- **The Mosha cycle's status line** (`#ms-rep-mcycle`, #763) sat inside the "Gold replica · paper shadow" card, folded on
  phones: the only live system without a line in sight. It is now in "Which systems trade live".
- **Live / shadow wording across the two sessions**: the Pairs card said "crypto trend (live paper)" (a shadow since 7 Nov);
  the AI second opinion card (#760) said it studies "the seven edges" (it studies live trades; five of the seven are shadows).
- **Viewers**: the browser Trader saved auto paper trades to a viewer's local journal and toasted "Trader saved … It's in your
  journal" (Luxus on landing; viewers cannot open the Journal): `autoTrade` stands down when the Journal is denied. The analyst
  card no longer calls `/api/edge-analyst` for a viewer (refused every 5 minutes). Toast titles use `--gold-ink` on light (1.8:1).
- Seen, left: the week pane's "Meridian live" (council/alerts.mjs `alertable`: every non-shadow NQ paper session, after
  costs, −0.41R on 5 this week) and Home's "this week" (main systems, before costs, −3.05R on 3) count different things under
  similar words (a definition, not display); text under 12 px and 32-40 px controls on Setup, Scanner, Crypto, LIT and in the
  header (older than these PRs); the first-visit gate-to-reload shift for members (one load); ChronosTrade's session form at
  35 px on a phone's first visit.
  **Done 15 Nov 2026** for Setup, Scanner, Crypto and LIT: `<style id="ms-sz-css">` (after `#ms-hc-css`, every rule scoped to
  the four views) raises every text under 12 px to 12 (chips, status badges, tags, scanner rows, trade-card labels, the LIT and Crypto
  tables; the coin icon letters `.cx-ic` excepted) and gives their buttons and checkbox rows 44 px on touch; measured at 390 and
  1440 px: none left, no view wider. The desk switch tabs are 44 px on touch on every desk (were 32), and ChronosTrade's session form
  too (backtest.html, a `(pointer: coarse)` rule on `#sess`; was 28-38 px); the header is unchanged. Test: `tests/qa-sweep.test.mjs` ("15 Nov"). Tests: `tests/qa-sweep.test.mjs` ("QA 12 Nov", six tests), `scripts/audit/smoke.cjs`.

## Browser audits: false failures traced to their causes (11 Nov 2026)
The three browser audits (`scripts/audit/smoke.cjs`, `chronostrade.cjs`, `academy.cjs`) share `scripts/audit/shared.cjs`. Rules for
any audit change:
- **Colours are read through `measured(page, expr, what)` only.** It waits until the page has no transition or finite animation
  running for two frames (`settle`), then reads once; `expr` returns `{ bad, n }`. A reading that measured no element, or a page
  whose colours never settle, is a FAILURE. No fixed wait after a theme change, no second reading. The smoke test reads no colours.
- **The cause of the "stale colour after a theme change"** (it was retried 700 ms later in `academy.cjs` until now): under
  `prefers-reduced-motion: reduce` the pages had `* { transition-duration: .01ms !important }`. `transition-property` defaults to
  `all`, so every element got a transition on every property; a theme change then went down the tree one level a frame (each child
  inherits the parent's still-old colour, sees it change a frame later and starts its own transition), while backgrounds set from a
  token changed at once: old-theme text on the new background for 6-7 frames on the Academy (260 ms idle, 700 ms at a sixth of the
  speed), 0.7-1.2 s on the Desk (which has a theme switch) and 2-2.5 s on the Edge lab. The rule is now `transition-duration: 0s`
  (no transition is started) in `assets/mx-page.css`, `market-structure.html` (both rules), `edge-lab.html`, `gold-trading.html`.
  **Never write a non-zero duration on `*`.** The Academy audit reads the contrast in the same task as the theme change, under
  reduced motion, to pin it.
- **The Desk, two view changes in quick succession**: the second skips the first one's View Transition, whose `ready` promise then
  rejects; `t.finished.finally(…)` handed that on to a promise nobody handled ("Transition was skipped", a page error whenever a
  runner needed over 600 ms for a view). Now `t.ready.catch(…)` and a caught `finished.finally(…)` (one handler, shared with the trade-link fix of the same day). The smoke test changes views back to
  back on purpose, and an inner view only counts when the Desk really shows it (`data-view`, the view and the Council pane visible).
- **Smoke settle time counts from the page's LAST load** (`calmer`): the Desk reloads once when `/api/me` first answers with an
  account; a check landing in or just after that reload was swallowed as a pass or read the page half drawn (413 px wide for half
  a second). A check that cannot be read is an error, never a pass.
- **Network**: `fetchRetry` tries a proxied request three times (network error, 429, 5xx) and keeps one answer per URL for the run;
  the ChronosTrade audit names candle requests that still failed. Its checks need candles relative to today (quick starts, the
  default day), so they stay on the live proxy: recorded candles would have to be re-stamped, which is not real data.
- **CI** (`ci.yml`): the retry of the ChronosTrade and Academy audits stays, but the checks that failed the first time are printed
  as warnings and both logs are in the `audit-screenshots` artifact. A check that only passes on a retry is a bug to trace.
- `academy.cjs`: every dev server it starts is stopped however the audit ends (`ACADEMY_PORTS` names its ports: one implementation,
  the one in the file's header). ChronosTrade's "closing a trade takes under 150 ms" is the middle of five closes.
- Tests: `tests/audit-shared.test.mjs` (the helper on a fake page and a fake fetch, the 0s rule on every page, the Desk's handler).
- **14 Nov 2026, ChronosTrade 7d** ("a limit the price already passed fills at market"): from 00:00 UTC on 14 Nov it failed on every run. Cause: the quick start's day (now − 30 days, 07:00 UTC) became 15 Oct, when gold only rose for 120 candles, so a buy limit 0.3 under the price was never reached. The check now looks ahead with →, goes back with ← (Undo), and drafts a buy limit under the price if it fell or a sell limit over it if it rose. A move under 0.3 either way in 60 candles fails with a message.
## Badge inks (11 Nov 2026, quality round: status badges, chips and pills on Charts and Scanner)
Measured with a script (real contrast of every visible text against its composited background; every role, guest charts, 390 and
1440 px): light had ~490-530 texts under AA on Charts / Scanner / the macro pane (the count moves with the live scanner states),
dark ~370, midnight ~400; after: 0 on Charts and Scanner in all three. Causes: text in the same colour as its own tint (amber
"IN ORIGIN" 1.8:1, chips 4.2-4.4), white on a solid green / red (READY 3.6, the candle countdown 2.5-3.0 on the dark themes),
chart candle colours used inline as text (the scanner's day change), the brand gold on a light page (1.8), and opacity used to
dim text (header shadow count, guest calendar days). Rule: **a badge takes its text colour from a token, never a hex**:
`--buy-ink` / `--sell-ink` / `--warn-ink` / `--accent-ink` (text on a tint of its own colour), `--on-buy` / `--on-sell` (text on
a solid fill), `--gold-ink` (the brand gold as text); defined once after the light tokens in the first `<style>` (dark and
midnight = the theme's own colours, light = deeper inks). Never dim badge text with `opacity`. The scanner's day change is
`.pr-c.up` / `.pr-c.dn`. Candle colours are untouched. Pinned in `tests/qa-sweep.test.mjs` ("badge inks"); no colour sampling
in the smoke test (it would depend on live data). The Council status line's amber warnings (about 4.3:1 on its gradient in
light, left by this pass) take `--warn-ink` since 12 Nov 2026 ("Post-merge QA sweep (11 Nov 2026…)", Still open).

## MeridianX Academy (10 Nov 2026, owner's build directive; on `main` since the owner's "Deploy everything" of 10 Nov)
Owner-only page `/academy` (`academy.html`): a discretionary-trading school on top of the seven Meridian systems that were live until 11 Nov 2026 (the seven edges
of `council/decay.mjs`; five of them are paper shadows since that day, see "Supported book"; ICT stays separate). Edges produce candidates, the deterministic decision engine decides, the risk engine allows.
Read `docs/academy/ARCHITECTURE.md` (contract), `docs/academy/MODULES.md` (as built), `TRAINING.md`, `RESEARCH.md`; the running state is
`MERIDIANX_BUILD_PROGRESS.md`. Rules that must hold in any change:
- **No look-ahead.** A decision only ever sees `MXR.snapshot` (bars closed at or before t; the guard throws otherwise). Outcomes live in
  `academy/data/out-<edge>.json` and leave the API only after an attempt for that setup is stored. History rows carry no ids.
- **Exam pool** (whole months, `poolOf` in `academy/edges.mjs`) is for tests on new setups only: never trained on, never read by the
  research or training code, an exam setup is decided once. Same-trade replays prove recall only; the page says so.
- **Flagged setups** (`rule.clockShift`: since 10 Nov 2026 it means the week could not be verified against a second feed, 101 setups;
  `rule.pre2020`) stay out of lists and tests. The candle clock itself was corrected: `docs/academy/DATA-CLOCK.md`; the Academy data
  from before the correction is in `academy/archive/pre-clock/` (never shipped with the API).
- **Lessons are explicit and versioned** (conditions on features → an effect; relative level rules, never raw prices). Research only
  proposes inactive drafts; the mentor saves them. No scorer is used unless the owner registers and promotes it; none is promoted.
- **Paper only, isolated**: nothing under `academy/`, `ml/`, `assets/academy-*` or `api/academy*.js` imports the council, the mirror or
  any order code (tests pin this). The language-model adapter is off without `ACADEMY_LLM_KEY` and has daily / monthly / hard budgets.
- **The other tabs** (`assets/academy-tabs.js`, `window.MXAT`, registered with `MXAC.registerTab`; shared pieces on `MXAC.kit`):
  Lessons (versions, diff, switch off / on, research drafts), Progress (agreement, recall beside new setups, mistakes, the
  1 / 3 / 7 / 21-day review queue `MXAT.reviewQueue`), Research + notebook, Models (nothing promoted; promotion is a manual API
  step), Costs, Audit, Blind arena (the engine's answer is a hidden `blind` attempt until `blind.submit`; `?get=blind`), Session
  (notes through `POST miss`, `?get=misses`; sessions `kind: 'session'`). Every statistic shows its n; under 20 graded it says
  "too few to judge"; no number is shown as a probability. The Desk links to `/academy` from the account menu (`#ms-me-academy`,
  classes `adm own`: owner only).
- **The analyst** (`docs/academy/LLM.md`): the optional language model's second opinion on a decision the engine has already
  stored (`POST analyse`, `api/_academy-analyst.js`, page block `assets/academy-analyst.js`). Off without `ACADEMY_LLM_KEY`; never a
  made-up answer; no outcome field or later bar may reach its request; its answer is checked in code and held by the engine's
  hard gates; stored apart (`engine: 'language-model'`, files under `analyst/`) and never counted with the engine's numbers.
  Only ever run against the labelled fake (`node scripts/academy-dev.mjs --fake-llm`): no real provider call was made.
- **The assistant connector** (10 Nov 2026, owner: the analyst should be the owner's own assistant, "no need API";
  `docs/academy/LLM.md` section 9): with no provider key, `POST analyse` QUEUES the question (`analyst/queue.json`, 25 at most)
  instead of calling anyone, and the owner's assistant answers it through `api/academy-mcp.js` (`/api/academy-mcp/<key>`, MCP
  JSON-RPC like `api/mcp.js`; four tools: `academy_guide`, `academy_pending`, `academy_question`, `academy_answer`). The key
  (`api/_academy-connector.js`) is derived from the session secret and shown to the owner's session only (`?get=connector`,
  the page's "Set up the connector"); `ACADEMY_CONNECTOR=off` / `_SALT` / `_SECRET` switch, rotate or replace it. An answer
  goes through the same `parseAnswer` and the same write step as a provider's (`analystStore`), is stored apart with provider
  `connector` at cost 0, and three refused tries drop the question. The connector reads queued questions and sends answers,
  nothing else: never widen it to results, lessons, the store or any other route. With a provider key set it is not used.
  Tests: `tests/academy-connector.test.mjs`; audit section D (`--connector` on the dev server).
- **Rate limit**: every Academy call goes through `MXAC.makeApi` (at most 24 calls a minute, 429 waited out, writes one at a time);
  a run reads candidates, lessons, calendar and past cases once, so a train decision is two calls (the attempt, then the session position: round 2, 11 Nov 2026; one before), and since round 3 a Session-tab decision too. Keep new code on `ctx.api`.
- **Policy investigation** (10 Nov 2026, `research/edge/academy-policy/`, pre-registered; `docs/academy/RESEARCH.md` section 7):
  discovery = the earliest 60 % of each edge's usable train setups, validation = the latest 40 %, the exam pool untouched. The
  evidence margin does not rank trades and the replica gap did not repeat on validation. Five candidates, **0 of 16 tests accepted**
  (largest validation t 1.00): `policy-1.0` is unchanged, no `policy-1.1` exists. **`academy/data/exam-ledger.json`** logs every exam
  read made to judge a policy (one per frozen version, only after it passes validation, written first): zero reads. `eval.json`
  carries `drawdown`; `eval-trades.json` = the policy's action per train setup, no outcome field. Tests: `tests/academy-policy.test.mjs`.
- **Offline scorers** (`ml/`, `docs/academy/TRAINING.md`; review of 10 Nov 2026 in `research/edge/academy-ml-review/`): 20 scorers
  (the reference trees and four pre-registered low-capacity configurations), all **rejected challengers**, none promoted; mosha-bo,
  gtrend and geg are too small to fit at all. `python ml/train.py` (trainer `wf-2`) cannot read the exam pool (its loader drops
  those rows; a test pins it); walk-forward only, with an embargo as long as the edge's longest label window and thresholds chosen
  on closed trades. A scorer passes only on all five lines of the acceptance rule (t >= 2 and a Holm-corrected p over every
  scorer x edge test, kept above mechanical, drawdown not deeper, Brier no worse than the prior rate, last block agrees), and is
  then only marked "passed validation, not promoted: owner decision". Never tune on these few trades, never add a configuration
  without a pre-registration, never show a score as a probability. After a change: `python ml/train.py && node ml/parity.mjs &&
  python ml/review.py` (the tests compare the committed files with the code's hash).
- **Look pass** (10 Nov 2026, owner: "more visually good and approachable, it looks made with stones", "make sure all the
  charts are working"): shape and colour only, no decision, lesson or API logic changed. `academy.html`: a hero (`.ac-hero`:
  what the page is, the four steps; it folds to its title once a replay is on screen) and the setup as three numbered steps
  (`.stp`: which edge, which days, train or exam) with the rest (chart timeframe, speed, difficulty, balance, risk, costs)
  behind `#setup-opts` "More options". `assets/academy-ui.js`: the edges as cards (`#edge-cards`, `renderEdgeCards`; the
  select `#f-edge` stays as the value the page reads and sets, so resume and "Replay this setup" move the card), a preview
  chart (`#preview`, `preview()`: one-hour candles of the two weeks BEFORE the From date, nothing at or after the first
  replay day is asked for; no decision reads it), charts on a see-through background. `assets/academy.css` ("Look pass"
  section at the end): cards with depth (`--ac-card`, flat white in the light theme so the quiet text keeps AA), tabs as one
  bar with an icon per section and the three groups apart, segmented controls, stat tiles, empty states with an icon, the
  replay controls as a player, a long table scrolling inside its box under a sticky header (the research list). Checked on
  live candles: every edge x chart timeframe x higher timeframe draws (56 of 56), and the Session, Blind arena and preview
  charts. The audit opens "More options" before it sets the speed.
- **Usability pass** (11 Nov 2026, owner: "keep improving our system academy"; found by using the page end to end at 1366 and
  390 px in the three themes): page code and CSS only, no decision, lesson, policy or API logic changed. (1) When the clock stops
  on a setup, a line under the chart says so (`#point-bar`, `renderPointBar`, `MXAC.pointLine`: the answer and its confidence
  word, "See the decision", "Give your verdict"; `goTo` lands a card under the top bar, `scroll-margin-top`); on a phone the
  decision used to sit about 1,700 px below the chart with only "Continue replay" in sight. Continue brings the chart back on
  screen (`showNode`, also the Blind arena's "Next setup"). (2) Continue, Step, Jump, Restart and Space no longer drop a
  half-written verdict without a word: the first press says it is not saved (`leaveOk`, `MXAC.mentorUnsaved`, `M.dirty`,
  `#continue-msg`), a second press within 10 s leaves; a saved or untouched form never asks. The guard sends and stores nothing.
  (3) `MXAC.humanize(text, lessons)` shows a lesson's title where the engine's text carries its id ("conflicting lessons:
  ls_… vs ls_…") and mends a doubled full stop: display only, the stored text is unchanged. (4) The "What if" table leads
  with Net R and Exit (the card is narrow, the result used to be scrolled out of sight); a lesson condition's feature has its
  own line in a narrow column (names were cut); the setup preview shows the whole two weeks it names; the chart legend sits
  under the controls. Tests: `tests/academy-ui.test.mjs` ("usability pass"); audit checks for the line, the question and the
  phone jump. Known and not done: a reload returns to the last SAVED session point (the session is saved at the first
  decision and on "Save session", not after each one, because a train decision is kept to one API call); the Train decision
  card is long (the Session tab already folds the detail); two conflicting lessons are named but settled in the Lessons tab.
- **Usability pass, round 2** (11 Nov 2026, owner: "keep working improving everything"): page code and CSS only, no decision,
  lesson, policy, scorer or API logic changed. (1) **A reload keeps your place**: the session position is saved with every
  train and exam decision (`keepPlace`; the first decision of a run already saves the session before its attempt and that
  save now carries the setup, so it adds no call; every later decision is the attempt, then `session.save`: **two calls a
  decision**, approved by the owner's coordinator, one audit-trail row each). After a reload the top of the setup offers
  "Pick up where you left off" (`#resume-now`, from the sessions list the page already reads; nothing loads until Resume) and
  the resumed point comes back with its stored verdict (one `corrections` read, on resume only). (2) **The Train decision card
  is folded** (`decisionView` with `fold: true`): the answer, its sentence, the levels and the main reasons
  (`MXAC.mainReasons`) stay in sight; evidence, reasons to wait, uncertainty, risk, similar cases and lessons are each a
  `details.dfold` whose open state is remembered. Nothing is removed (a test lists every part); Session and Blind keep their
  own single disclosure. (3) Calmer forms: what is missing is a neutral "Before you save: …" line and the red "Problem" shows
  only when Save is pressed with something missing (mentor form and the Session / Blind answer forms; Save is offered once a
  choice is made and such a press sends nothing); the engine's own answer is not offered as a change (`MXAC.mentorChoices`: no
  "Change to WAIT" on a WAIT, its own BUY / SELL reads "Keep BUY, other levels"); setup ids in the engine's text and the log
  read "the sell setup of <time>" (`humanize`); the page and its sections open on the edge used last. (4) A decision that
  names two conflicting lessons has "Open them in the Lessons tab" (`MXAC.conflictIds`, `MXAC.lessonFocus`): the tab opens on
  that edge with the two outlined, once. (5) Session tab on a phone: the pause is announced above the controls with "See the
  decision" and the decision card comes first in its column; the hero folds to its title on every section but Train; the
  audit trail's ids no longer break a letter a line; a study's times show as dates. **Browser storage**: the page now keeps
  two display preferences of the device and nothing else (`prefGet` / `prefSet`, keys `mxacEdge`, `mxacFold`; a test pins the
  list and both writes); never a decision, a result or an API answer. The audit takes `ACADEMY_PORTS="a,b,c,d,e,f"` when the
  default ports are not free. Not done: the Session tab saves its position at its first stop only, and its Continue can
  still drop a half-written verdict; the conflict link opens the lessons but does not edit them for you.
- **Round 3** (11 Nov 2026: the Session tab and the Blind arena get the Train tab's protections; page code, CSS, audit and
  tests only, no decision, lesson, policy or API logic changed). (1) **One guard** `MXAC.leaveGuard({ unsaved, tell })` (pure,
  `LEAVE_MS` 10 s; on `kit`): Train's `leaveOk` is built from it and the sections use it, never a copy. The answer forms of
  Session and Blind report `unsaved()` by Train's own rule (`mentorUnsaved`). A reload or close over a half-written answer on
  any section gets the browser's own question (`beforeunload`, `kit.watchUnsaved`); the page stores nothing. (2) **Session
  tab**: the place is saved with every decision (first decision of a sitting: `session.save` then the attempt; every later
  one: the attempt then `session.save`: **two calls a decision**, one before); the save carries the setup the clock is on
  (`state.cur`). The sitting saved last and not ended is offered in the tab (`#ss-resume-now`) and, when it is the latest
  thing saved, at the top of Train ("Resume in the Session tab", `MXAC.sessionResume`, `MXAC.unfinished(rows, kinds)`).
  Resume comes back ON the setup with the stored decision and verdict (`restorePoint`: reads only, `attempts` +
  `corrections`, + `lessons` when a disagreeing verdict is stored; nothing is decided or written again). Continue, Step, End,
  another start or resume, an edge change and opening a note all ask before dropping a half-written verdict or note.
  (3) **Blind arena**: "Next setup" exists only once an answer is stored, so the guard sits where an answer can be lost
  (another "Start a round", an edge change). After a reload the page asks the server for no stored decision, a setup left
  open keeps its one hidden attempt and is named in the count line, and the API's refusal of a second answer (409, unchanged)
  is said in words ("the first answer stands", `#bl-already`). `kit.decided(id, pool, mode)` records the mode in the shared
  pool list: a setup whose engine answer was shown in Train or Session after its hidden attempt is answered as recall (a
  fresh hidden attempt, left out of every score), in the same sitting too. (4) **Lesson draft on resume**: made again from
  the stored attempt, the stored correction and the rebuilt snapshot's features (Train: one extra `lessons` read on resume to
  see whether it was already saved). Edits typed into a draft that was never saved are NOT kept: a draft carries the
  corrected answer and its level rules, so keeping it would put a decision in browser storage; the allowlist stays
  `mxacEdge`, `mxacFold` (test). (5) The Session and Blind setup card folds to one line while a sitting is on screen
  (`setupFold`, `.card.folded`); saved sittings list the latest first; an exam replay drops its cached exam list again (the
  line sat inside a comment since round 2). The audit has section 11k (its own server, port index 1 reused): Session guard,
  place and resume, Blind reload and the 409, the conflicting-lessons link in a browser. Not done: an edited, unsaved lesson
  draft is lost on reload (above); the Session tab's last lesson-saved count can be one short after a reload until the next
  decision saves the sitting.
- **The phone's simple view** (11 Nov 2026, owner: "on the mobile there's too much, we need a simpler version for the phone";
  page markup, CSS, page code, audit and tests only: no decision, lesson, policy or API logic changed, and it adds **no API
  call**). The site's one convention, as on the Desk, the Macro desk and ChronosTrade, so one choice covers every page: at
  640 px and under the page head sets `html[data-phone="simple"]` before the first paint unless localStorage `ms-phone` is
  `full` (no key = simple; the attribute is never set on a wider screen); the switch "Phone view: Simple | Full" (`#pv` at
  the foot of the page, `setPhoneView`, then the head's `msPhoneSet()`) writes it, and Full is the phone page as it was.
  **Storage allowlist**: `PREFS` is now `mxacEdge`, `mxacFold`, `ms-phone`, with a third helper `prefDel` (same allowlist)
  because that key means "simple" by being absent; the pin tests list the three writes and the one removal, and the page
  head only reads (still never a decision, a draft or an API answer). Every rule is in ONE block at the end of
  `assets/academy.css`, inside `@media (max-width: 640px)` and under the simple attribute (a test reads every selector), so
  a wider screen and the full view read none of it. Three inert-elsewhere pieces, all in `assets/academy-ui.js` ("the phone's simple view"):
  `.pm-host > .pm` + `button.pmore` (parts that wait behind a "more" button: `moreToggle`, `moreBtn`), `.pcard` + `pfold`
  (a card folds to its heading with a chevron; on `kit.pfold` for the sections; open state kept for the visit in `PF`) and
  `TAB_MORE` (`#tab-more`). What the simple view shows: before a replay the hero is its title and the setup is the edge
  cards (name and market), the days with the preview, train / exam, "More options" and a full-width Start ("About this
  edge" and "Lessons in force and saved sessions" are buttons); during a replay the hero and the long setup card step
  aside and the screen is the chart, Play / Step / speeds / "More" (Restart, Jump, Save and Resume session, the feed note,
  the keyboard line and the legend) and the line that says the clock stopped with two full-width buttons; then the
  decision, the verdict, the lesson, the proof and "What if" come straight after the chart (CSS `order`; the DOM is
  unchanged) and Paper account, Higher timeframe, Running thesis, Replay log and "Test on new setups" are folded cards.
  Decision card: levels in one row, "Setup facts and versions" behind a button, the analyst block hidden only while it is
  switched off (`:has(#an-off)`). Verdict form: answers two by two, entry / stop / target only when the answer is changed
  to a trade (`:has(input:enabled)`), "Bias, another edge, marks on the chart" behind a button, full-width Save: one
  screen. Tab bar: Train, Session, Blind arena, Progress, Lessons and "More" (Research, Models, Costs, Audit; it stays
  open while one of them is on screen). Sections open on their headline card and fold the rest (`PHONE_FOLD` in
  `assets/academy-tabs.js`: Lessons keeps the list; Progress keeps "Where things stand"; Research keeps the policy table;
  Models keeps the registry). Measured at 390 x 844: setup 3.2 -> 1.9 screens, a replay 2.9 -> 1.5, stopped on a setup
  6.7 -> 4.0 (decision card 1,323 -> 992 px, verdict form 985 -> 577 px), Progress 2.9 -> 1.5, Research 4.3 -> 1.9,
  Models 5.3 -> 1.3. Proof that nothing else moved: the box, font size, colour and display of every drawn element of
  `<main>` at 1440 px, and at 390 px in the full view, equal the build before (ten page states; the only differences are two
  new ids, the 76 px switch at the foot of the phone page and replay-clock text). Session and Blind keep their own
  round-3 layout (only the tab bar and the hero change there). The audit's phone part runs in the simple view (helpers
  `tabTo`, `unfold`) and adds 12 checks, the full view and the remembered choice among them; its Models check counts buttons
  other than the fold chevron. Done 12 Nov 2026: the What-if card folds too (`renderWhatIf` puts the chevron back with
  `pfold(box, 'What if')` after each build, since `whatIfCard` empties the box; `PF` keyed by its id keeps it open or folded
  through a redraw for the visit; no new CSS rule, storage key or call): 365 -> 62 px at 390 x 844 on a stopped setup, 1440 px
  and the full view unchanged. Not done: an open fold is forgotten on reload on purpose (nothing more goes into storage).
- **"The correction was not saved: no such attempt for this edge"** (11 Nov 2026, the owner hit it on the live site on a
  verdict on "attempt 2"). Cause, in `api/_academy-store.js`: the Blob backend read a file through the Blob CDN, which serves
  an overwritten file with its OLD bytes for up to a minute. One function instance remembers its own writes, but ANOTHER
  instance (every deploy starts new ones) read the attempts file without the row stored seconds earlier, so `correct`
  answered 404; a WRITE made from such a read would also have dropped the rows stored in between (attempts, dataset, audit).
  Fix: every Blob read of the store asks the origin (`?cache=0`, what the Blob client's own `get(…, { useCache: false })`
  sends for a private file). Never read a store file through the CDN copy again. The page (`saveCorrection`,
  `MXAC.correctionFailure`): a correction that cannot be saved leaves the form exactly as it is (verdict, levels, bias,
  reasons, words, marks), says in plain words that nothing was lost and what to do, and the button becomes "Try again"; the
  verdict still counts as unsaved for the leave guard. After a second "no stored attempt" answer in a row, the next press
  stores the decision the page holds once more through the usual `attempt` call (same mode, same snapshot hash; every server
  check applies; never an exam or a blind attempt) and saves the verdict on it. No new API route or field; a decision is
  still two calls; a retry is one more, a re-stored decision two. Not proven from production logs (they could not be read):
  the sequence is reproduced with the real handler and the real Blob backend over a fake Blob service that lags as documented.
  The same CDN read is in the other private-Blob modules (`api/notify.js`, `profile.js`, `sounds.js`, `mosha.js`,
  `mosha-lessons.js`, which overwrite one file in place): not changed here. Tests: `tests/academy-correction.test.mjs`; audit section 11l.
- **Graphite look** (16-17 Nov 2026, `docs/design/aureum-theme.md`, the site-wide spec; the 16 Nov black-and-gold draft was
  rejected by the owner). Display only. `assets/academy.css` section "Graphite", right before the phone block: the `--au-*`
  tokens for dark / light / midnight, and the Academy's older names (`--panel`, `--ink`, `--accent`, `--buy`, `--gold`, …)
  pointed at them by one rule whose selector list outweighs every theme rule of `assets/mx-page.css`, so the page looks right
  whether or not that file has the tokens. Candles keep their colours (`--ac-up` / `--ac-down`, read by `candleLook`); chart text
  `--au-ink-3`, grid `--au-line`. One primary (solid neutral) in view: `#c-play` gives way while a train verdict waits, the
  decision card's Continue becomes primary once the verdict is saved, Resume and "Test on 10 new setups" are secondary. From
  1081 px the decision, verdict, lesson, proof and What if lead the column beside the chart (CSS `order`; the phone's full view
  keeps chart, account, decision, verdict). Levels are one strip (`.kv.lvl`), the decision's folds one grouped list, entry / stop
  / target appear only for a changed trade (`.choices + .lv`), a chosen verdict reads in its colour. The verdict card is "Your
  verdict" (small: "on attempt N"; the audit's correction check reads that). No decision, lesson, API or storage change.
- **Desk examples** (22 Nov 2026, owner: "put 4 trades examples for each one of the edges … into the academy, 2 loss 2 wins …
  i will guide you and write and do drawing on the same chart what u should had done"). A section of the Academy (tab `examples`,
  after Blind arena; on the phone's simple view a row of its own under the five sections and "More", one tap): for every reading
  of the Mosha and Engulfing desks, four stored paper trades (two that won, two that lost) on a chart with the record's own
  marks, entry / stop / target and log; timeframes M1 to D1 (a window around the trade for each, `windowFor`; opens on M5, or
  the first timeframe that holds the whole trade), Before (only candles closed at the entry; marks and log known by then) /
  After. The owner writes "What should have been done" (2,000 characters), ticks quick verdicts (`CHIPS`) and DRAWS on the same
  chart: select, trend line, level, box, arrow, text; move, resize by handles, colours, Delete; press-drag or click-click, touch
  too. The geometry is the replay lab's own (`BT.drawGeom` / `drawHit` / `drawResize` / `drawMove`, `tfLogical` / `tfTimeAt`):
  a shape is [UTC seconds, price] points, so it stays in place on every timeframe. "Copy for the assistant" / "Copy all my
  notes" give plain text (id, reading, trade, result, verdict, the note, each drawing as its kind, points and text);
  "Download chart image" a PNG of chart and overlay.
  - Files: `assets/academy-examples.js` (`window.MXAX`, pure pieces first, tested in Node), styles in ONE block of
    `assets/academy.css` right before the phone's simple view (which must close the file), `TABS` in `assets/academy-ui.js`.
  - Data: council-data `academy/desk-examples.json`, read at `/cdata/academy/desk-examples.json` (owner session), written by
    `council/desk-examples.mjs` **run by hand after a desk rebuild, never in the loop**, so the set stays the same while he
    writes on it. No file yet = "No examples yet: they are written after the next desk rebuild."
  - Notes: `api/academy.js` `GET ?get=example-notes` → `{ notes: { <example id>: { text, chips, draw, at } } }` and `POST
    { action: 'example.note', id, text?, chips?, draw? }` (owner only, same origin, an audit row; a note is replaced as a whole,
    an empty one removes it). Store file `examples/notes.json` (`{ v, notes }`, 400 notes at most: the next is a 409; a failed
    read or a file of another shape is a 503 and is never overwritten). Checked on the server: id `[a-z0-9:._-]` up to 80, text
    up to 2,000, chips from `EX_CHIPS`, at most 60 shapes of type t / h / r / a / x, each rebuilt field by field (finite
    numbers, a text of 120 characters). The assistant connector (`api/academy-mcp.js`) does NOT read them: do not widen it.
  - Nothing is kept in the browser (the storage allowlist did not grow): an unsaved note lives in the page's memory, the shared
    leave guard asks once, a failed save keeps everything and offers "Try again".
  - Display and notes only: no rule, desk record or trade is changed by it. The examples are PICKED (two winners, two losers
    a reading): they show what a reading did, never how often it wins; never quote them as evidence.
  - Tests: `tests/academy-examples.test.mjs`; changed on purpose: `tests/academy-ui.test.mjs` (the tab list, the page's
    sections and scripts), `tests/academy-security.test.mjs` (a body for the new POST action). The audit opens the tab on its
    empty state (the dev server has no examples file).
- Regenerate data (candles outside the repo; delete any `*-m1.bin` / `xau_m1.bin` cache made before 10 Nov 2026 first):
  `ACADEMY_CANDLES=<dir> node academy/gen/run.mjs`, then `features.mjs`, `evaluate.mjs`,
  `research.mjs`, `calendar.mjs`. Local run: `sh scripts/build.sh && node scripts/academy-dev.mjs` (recorded candles; `--live` for the
  candle proxy). Audit: `node scripts/audit/academy.cjs` (in `ci.yml`). Tests: `tests/academy-*.test.mjs`.

## Mirror: the replica book takes the replica's research trades (10 Nov 2026, owner: "the mirror is not taking the replica trades")
The Replica demo account stayed empty because the mirror read only trades.json and the ICT desk, while the replica's forward
paper trades (gold, forex and crypto; `k: 'replica'`) are recorded by the Trader in research.json; trades.json holds only the
live gold replica, which fires rarely. `council/ctrader-mirror.mjs` `replicaCandidates(research, own)` now adds them as
candidates for the `replica` book: same path as every other trade (a stop is required, `ensureStop`, the late-copy guard, the
limits, stop moves and closes follow the record). A record also in trades.json is taken from there (by id and by market +
side + time, never twice); one whose own filter failed (`pass: false`) counts as a shadow (config.json `mirrorShadow: false`
leaves it out). They are copied only while the replica book has a demo account different from the council's
(`replicaHasOwnAccount`), so they can never land on the council account. Demo only. Tests: `tests/ctrader-mirror.test.mjs`.
**Since 11 Nov 2026 (owner) no NEW copy is opened for the replica's forex and crypto research trades** (`config.mirrorReplica`,
`noCopy`; gold unchanged, positions already copied managed to their close): section "Supported book, financing in the costs,
replica mirror gold only".
Reconciliation (same day, owner: "check all the trades from the edges opened match everything on cTrader"):
`node council/ctrader-reconcile.mjs <council-data dir>` reads files only (no broker contact) and lists, for every open or
pending trade of every book, whether its demo account holds the copy and whether side, stop and target match; then every demo
position or order with no open council trade behind it, and any position without a stop. Levels are compared the way the
mirror copies them: a market copy keeps the council's distances from the fill (the broker's price sits a small basis from the
council's feed), an amended, limit or guard-set copy has the council's own levels, an ICT copy the desk's stop distance. Exit 1
on a mismatch. Tests: `tests/ctrader-reconcile.test.mjs`.

## Research candle clock (10 Nov 2026, owner: "the highest-priority task of this phase")
The HistData M1 research files (council-data `research/candles/*`) were read on three different clocks. The pre-registered audit
`research/edge/histdata-clock/` (PREREGISTRATION.md first, then `run.mjs`: release minutes, hourly returns against OANDA H1 for every
week, the weekly reopen, raw-file artefacts; 11 symbols, 2018 to Oct 2026) settled it: **New York time in 2018; from 2019 UTC−5, and
UTC−4 while Europe is on summer time** (4,755 of 4,755 decisive OANDA weeks, 327 of 327 in the US / Europe mismatch weeks; 2,191 of
2,195 release minutes; 73 of 99 symbol-years pass every strict criterion, 26 stay UNCERTIFIED and none points to another rule).
- **One converter**: `council/histdata.mjs` (`histStampUtc`, `histToUtc`, `histOffsetH`, `nyOffsetH`; pure, no imports, nothing live
  reads it). `tests/histdata-clock.test.mjs` proves it equals the audited rule for every label hour, checks 10 real release windows
  (`tests/fixtures/histdata/`) and FAILS on any file in research/, academy/, ict/, council/, scripts/, api/, ml/ that converts a
  HistData label by itself. A new loader imports the converter. The one listed exception is live code: `ict/replay.mjs` line 95 (line 79 on 10 Nov)
  (a dead EUR/USD / GBP/USD back-fill branch; docs/owner-decisions.md item 21).
- **What was wrong**: "EST without daylight saving" (label + 5 h; most ICT studies) is an hour late all of Europe's summer; New York
  time for every year (gold-systems, robustness, timing, costs, NQ open-run) is an hour early from 2019 in the weeks the US is on
  daylight time and Europe is not (2nd to last Sunday of March; last Sunday of October to 1st Sunday of November).
- **Re-runs** (no rule, parameter, filter or cost changed; a control run of the old loader on today's code was made for each, so the
  clock's effect is separated from code drift): the before → after table of every study is in `research/edge/histdata-clock/RESULT.md`;
  each re-run study's RESULT.md has a pointer under its title and a dated last section "Clock correction (10 Nov 2026)". One
  pre-registered verdict changed (ict-variants: one of nine now passes, not strong; owner item 20). Studies not re-run say so in the
  same place (owner item 23).
- **Academy**: `docs/academy/DATA-CLOCK.md`. **Baselines** `council/decay-base.json`, `council/expect-base.json`,
  `council/event-base.json` were rebuilt with their own scripts in one commit (owner item 19). Stale caches (`*-m1.bin`,
  `xau_m1.bin`) made before 10 Nov hold old times: delete them before any re-run.

## MSNR entry study: the direction call as a gate in front of the engulfing entry (11 Nov 2026, owner: "what about the strategies? use the skills")
`research/edge/msnr-entry/` (PREREGISTRATION.md committed first, then `run.mjs`, RESULT.md, result.json). Both skills used (the
direction procedure and the research pipeline) are the owner's private material: never copy their text into the repository; the
study words every rule itself (a test checks identifying words are absent). The follow-up the direction-call study
(`research/edge/msnr-direction`, 0 of 6) named as untested: the call (H4 working, Daily key levels; its detector copied into this
`run.mjs`, nothing imported) as a GATE in front of the pipeline's entry, as trades net of $0.30 a round trip. Entry: an M15 body
engulf, then within 45 minutes an M5 body engulf the same way, market at the next M5 open, stop $0.30 past the trigger pair (every
trade has one; none under $1.00 away), target 1.5R, out after 12 hours, one at a time. The same candidates three ways: ALL (no
gate), WITH the call, AGAINST it. Three tests: T1 trigger 12:00-15:55 UTC, T2 the same at 2R, T3 any hour. OANDA gold M5 from
2006 (the mosha-sweep file, kept out of git), 2020-26 confirmation, 2007-19 replication. **Verdict: FAIL, 0 of 3**: with the call
T1 -0.110R a trade net in 2020-26 (n 795, t -2.51) and -0.159R in 2007-19 (n 1,269, t -4.63); without the gate -0.147R and
-0.172R; before costs every stream is within 0.09R of zero (a 1.5R target hit 40 % of the time), so the loss is the cost. The gate
adds nothing measurable (WITH minus AGAINST +0.01R to +0.11R, largest Welch t 1.55, absent at all hours); 47 of 48 hour-by-window
cells are negative; the pipeline's own H4 closing-price structure filter does not help either. Not tested, because the skill gives
no rule for them: its stacks built on the engulfing-failure signal, the abbreviated signals, an M1 entry and an exit by signal.
Never call this method an edge; do not automate it; a further test needs those signals written down as rules by the owner and its
own pre-registration. Nothing live changed. Tests: `tests/msnr-entry.test.mjs`.

## Edge review, and the trend-breadth / financing study (11 Nov 2026, owner: "now our edges, we need more improvement so we start make money")
An evidence review, a ranked plan and one study; no live rule, size, filter, stop or council member changed. The owner's
document is `research/proposals/2026-11-11-edge-review.md` (one row per system, where the R goes, five actions, five
decisions). What it found, from council-data of 11 Nov and the committed studies:
- **No system has an out-of-sample t of 2 after costs.** Nearest: Gold trend (+0.49R a position on 2006-17, n 75, t 1.77),
  Gold trend fast (+0.37R, n 129, t 1.92), Gold daily engulf (+0.19R, n 256, t 1.89). Flat or negative out of sample: H4
  trendline, Mosha BO, replica, momentum pullback, NQ open run, ICT A-setups. Forward: 5 main-system trades, −2.05R gross.
- Costs took 157R from the shadow book in eleven days (804 trades, +133.0R gross, −24.2R net). The replica's forward paper
  trades on ten markets: 568 closed, −0.08R a trade before costs; their demo copies fill 0.08R worse (n 121, t 3.9).
- `research/edge/honest-book` (7-8 Nov) was never put to the owner as a decision: it is decision 1 of the proposal (live
  paper book = Gold trend + Gold daily engulf, the rest as shadows). Not added to `docs/owner-decisions.md` here (other
  work was renumbering nothing but adding items the same day): add the proposal's five decisions there as new items.
- Seen and reported, not acted on: a 10-lot gold buy on the Replica demo account (closed 11 Nov 13:37 UTC, −$4,427) that
  is not in the mirror's records (the mirror's cap is 5 lots); the day's loss stop then refused the replica copies.
**`research/edge/trend-breadth/`** (PREREGISTRATION.md committed first; `run.mjs`, RESULT.md, result.json):
- **Part A, financing** (accounting, no rule tested). No cost model in the repository counts overnight financing
  (`council/fills.mjs` and the studies count spread and slippage). The demo broker charges a long gold position 5.903 pips
  of 0.1 a night (`ctrader/symbols.json`; the demo deals show −$0.59 an ounce a night), about 0.0148 % of price, 5.3 % a
  year. On the recorded positions of `gold-systems-oos`, untouched 2006-17, first unit only: Gold trend +0.489R → +0.398R
  (t 1.77 → 1.49), Gold trend fast +0.372R → +0.289R (t 1.92 → 1.53), daily engulf +0.186R → +0.141R (t 1.89 → 1.46),
  H4 trendline +0.048R → +0.013R (t 0.83 → 0.23: "does not survive at today's rate" by the pre-registered reading). About
  2.8R a year across gtrend, geg and gtl; with the add unit the trend legs pay about a third more. The broker's past rates
  are not known (a half-rate column is shown). Adding financing to `fills.mjs` / `expect-base.json` is a proposal, not done.
- **Part B, breadth: harness not validated, nothing interpreted.** The live Gold trend rule on the council's daily candle
  cache (four pre-registered sets: other metals, 17 equity indices, energies and agriculturals, currency majors both
  sides; monthly-sum t, Holm). The parity gate on gold passed on 2006-17 (72 positions against 75, gross +0.517R against
  +0.506R) and missed on 2018-26 (+1.644R against +1.347R; the gate allows 0.15R). Cause (post-hoc): the live rule buys
  again INSIDE a day after a stop-out while the last closed day is still an unused breakout (nine such positions in
  2018-26, eight losers); daily candles cannot place them, so a daily harness flatters the rule. The four sets' figures
  are in result.json under `uninterpreted`; never quote them as a finding. A real breadth test needs hourly candles and
  its own pre-registration (done the same day: `trend-breadth-h1`, section "Book study" below). **Any daily-candle replay of gtrend / gtrend5 has this bias.**
- To repeat: `node research/edge/trend-breadth/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
  `… full <dir>`. Tests: `tests/trend-breadth.test.mjs`.

## Book study: the supported book as a book, the add, and trend breadth on hourly candles (11 Nov 2026, owner: "we need more improvement so we start make money")
Three pre-registered studies on the book the owner approved that day (Gold trend + Gold daily engulf). Research only: no
live rule, size, filter, stop, config or council member changed. The owner's document is
`research/proposals/2026-11-11-book-study.md` (one decision: `docs/owner-decisions.md` item 42). All three verdicts are
FAIL or "nothing to change": **never quote the book as proven, never call it an edge.**
- **`research/edge/supported-book/`** (PREREGISTRATION.md first; `run.mjs`, `legs.json`, RESULT.md, result.json). The
  committed `gold-systems-oos` engine (not edited) run once more on the same candles; its unit-level output for `gtrend`,
  `gtrend5`, `geg` is `legs.json` (963 units: fill, close, entry, r0, gross R, `of` for an add), gated against all 813
  committed positions (0 mismatches). Book = daily series booked on the close day, fixed 1R a unit, $0.30 a unit and
  **financing on every unit** by `council/fills.mjs` `nights` x `FIN.xau.long` (imported). One question: on untouched
  2006-07 to 2017-12, is the two-system book's t on daily book R at least 2 (both halves positive, positive at x2 costs)?
  **FAIL on the t: +59.3R, +5.16R a year (330 positions, t 1.86; 90 % bootstrap +0.3 to +10.3R a year)**; halves +55.3R
  (2006-11) and +4.0R (2012-17); x2 costs +48.7R. Worst drawdown 19.8R closed / 22.1R marked to market, from March 2014,
  not regained by the end of 2017 (988 weekdays); worst year 2013 −8.1R; 6 of 12 years positive; a unit open on 37 % of
  weekdays; the legs' daily correlation 0.01 (monthly 0.21). Financing took 20.5R (1.8R a year): the t is 2.43 without
  it and 2.15 at half the rate. With every unit charged Gold trend is +0.313R a position (n 74, t 1.20), not the +0.398R
  (t 1.49) of the first-unit table; the engulf +0.141R (n 256, t 1.46). At 0.25 % a unit: about +1.3 % a year with a 5 %
  drawdown. With Gold trend fast added (S3): +86.4R, t 1.77, drawdown 29.5R (same return ÷ drawdown, 2.9 against 3.0).
  2018-26 and 2020-26 are built-on years for these rules (all in sample; +13.4R and +15.1R a year): shown, never evidence.
  Tests: `tests/supported-book-study.test.mjs` (`tests/supported-book.test.mjs` is the Trader's own-rule test).
- **`research/edge/book-sizing/`** (the comparison was fixed in the supported-book pre-registration before any result):
  the Gold trend pyramid add on (as live) against off, same records and functions. Exact, because the add never changes
  the first unit's stop or exit. Untouched 2006-17, return ÷ closed drawdown: ON 2.99 (+59.3R on 19.8R, t 1.86), OFF 2.87
  (+54.3R on 18.9R, t 1.94); paired month bootstrap P(OFF better) 0.535, 90 % interval −0.99 to +0.99: **within noise, no
  proposal, the add stays.** The add units alone: 34, +5.0R, +0.148R, t 0.60 on untouched data against +1.08R (n 29,
  t 2.45) on the built-on years. No other sizing question is left worth a test (weights between systems: `sizing`,
  `portfolio-v2`). Tests: `tests/book-sizing.test.mjs`.
- **`research/edge/trend-breadth-h1/`** (PREREGISTRATION.md first; `markets.mjs`, `fetch.mjs`, `run.mjs`): the live Gold
  trend rule on OANDA H1 + D1 candles (`node --use-env-proxy fetch.mjs <dir>`: H1 is served from January 2004, gold and
  silver from March 2006; 23 MB kept out of git). Harness: one run at every H1 close, entries and adds at the next H1
  open, stops by `stopFill`, `spotSkip` hours for metals and currencies, so the re-entry inside a day is placed.
  **Parity gate on gold passed**: 75 of 75 positions (+0.526R against +0.506R gross) on 2006-17 and 59 of 59 (+1.286R
  against +1.347R) on 2018-26. Thirteen markets fixed before any run (`xag`; `nas100 spx500 us30 de40 jp225`; `eurusd
  gbpusd usdjpy audusd usdcad`, both sides; `wtico bco`), costs and financing as `trend-breadth`, t on calendar-month
  sums, Holm over 14 tests (13 markets + the pool), confirmation closed 2020-26, replication 2005-19. **FAIL, 0 of 14**:
  pool −0.059R a position net on 2020-26 (n 827, t −0.89; +0.040R before any cost) and −0.028R on 2005-19 (n 1,690,
  t −0.52); currencies −0.201R (n 422, t −2.91); best market Brent +0.586R (n 39, t 1.64, Holm p 0.71) which lost on
  2005-19. So the rule is not a general trend rule: read and size the gold record as one bet on gold rising with a
  trailing exit; do not propose it on another market without new, pre-registered evidence. The hourly harness is the one
  to reuse for any future replay of `gtrend` on a market without M5 history. Tests: `tests/trend-breadth-h1.test.mjs`.
- Not done, said to the owner: the broker's past financing rates are unknown (today's rate, the highest of the sample,
  is charged for every year); the other markets' financing is assumed, not measured; `council/expect-base.json` still
  charges the first unit only (item 42).

## Path to live: no lever left on the gold book, the forward-test protocol, what real money would mean (12 Nov 2026)
Owner: "keep improving dont stop reach our goal". A proposal and its arithmetic; **no study was run, on purpose**, and no
live rule, size, filter, stop, config, council member or demo-only code changed. The owner's document is
`research/proposals/2026-11-12-path-to-live.md` (decisions: `docs/owner-decisions.md` items 43-46, all answered by the owner on
12 Nov 2026, "Yes to all": the protocol adopted, no more tests on this book, the bridges refuse a non-demo account, paper and demo
only until at least November 2027).
- **Rule (owner, 12 Nov 2026, item 44): no further gate, exit, entry or size is tested on this book's 2006-17 window.**
- **The research on the two-system book is exhausted.** The proposal's section 1 is one table of every lever tested on the
  gold book (book, systems, Gold Macro Score as size step and as gate, real yields, volatility / trend / own-record
  switches, move-size forecast, 12 exits, 10 entries, limit against market entry, sizing rules, weights, the add, Gold trend
  fast, 13 other markets, weekend, calendar, news, costs, the random-entry control) with its study, n and t: none is
  open. The Gold Macro Score's record (weekly IC +0.149, t 3.24) is in sample for the score, and `macroscore-overlay`
  already put it on the gold longs and the gold books: do not run it again on the same positions. The two near misses
  (the engulf only when gold's six-month trend is up, `regime-switch` second-half t 1.43; another zone candle for the
  engulf, `geg-variants`, 1 of 5 fixed tests missed) have no third stretch of gold history to be confirmed on. **Do not
  pre-register another gate, exit, entry or size on 2006-17 for these systems** (a dozen studies and over sixty
  comparisons have read it) unless the owner asks for it knowing this (item 44).
- **`research/proposals/2026-11-12-path-to-live.mjs` → `…-path-to-live.json`** (deterministic, no network; imports the
  supported-book study's functions and `council/expect.mjs`; not a study, no verdict, not published to the Edge lab). From
  the untouched S2 book (330 positions, 28.7 a year, +0.180R a position, sd 1.73): t 2 on a forward record needs 369
  positions, about 13 years. A month-block bootstrap (138 months, 20,000 draws, seeded) in three worlds (as measured
  +5.2R a year; no edge; −5.2R a year, by taking 1x / 2x the mean off every position) gives the forward bands and the
  **pre-committed stop lines**: forward closed drawdown over 21.9R (the 95th percentile of three years as measured), or
  the total under −9.7R / −12.0R / −12.1R at 12 / 24 / 36 months (the 5 % lines). Their power, said in the proposal:
  stopped within three years 12 % as measured (false alarm), 43 % with no edge, 77 % when losing. Execution checks E1-E5
  on the first 30 demo copies (a stop on every copy, 28 of 30 copied, fills within 0.03R of paper and never over 0.05R
  worse, financing within a fifth of `FIN`, no order the mirror did not place). A stop line sends the book back to a paper
  shadow by the owner's rule; it never closes a trade. Nothing computes these lines in the council yet: adopting the
  protocol (item 43) is a document decision, a page card or a digest line would be a later build.
- **Risk table** (untouched book, simple %): 0.1 / 0.25 / 0.5 / 1 % a unit → +0.5 / +1.3 / +2.6 / +5.2 % a year, worst
  drawdown 2.0 / 5.0 / 9.9 / 19.8 % closed (22.1R marked), 3.8 years under water, 1-in-20 ten-year drawdown 34.1R. The
  broker's minimum gold lot is 1 ounce: a unit risks $39-48 (engulf) to $93-136 (trend) at $4,000 gold, so 0.25 % a trade
  needs about $55,000.
- **What enforces demo-only, listed for the owner, none of it touched**: `council/ctrader-mirror.mjs` (`DEMO_HOST`,
  `CTRADER_ENV` must be `demo`, the account's own `isLive` must be false before account auth), the same in
  `ctrader-suite.mjs`, `ctrader-account.mjs`, `ctrader-symbols.mjs`. **Found: the two bridge programs
  (`mt5/CouncilBridge.mq5`, `ctrader/CouncilBridge.cs`) print whether the account is a demo but do not refuse a real one**
  (item 45). **Done 12 Nov 2026 (approved):** every order-sending program in `mt5/` and `ctrader/` (the two bridges, `NQOpenRun.mq5`,
  `CryptoTrend.cs`, `CryptoScalper.cs`) has `DemoOnly()`: MetaTrader `AccountInfoInteger(ACCOUNT_TRADE_MODE) ==
  ACCOUNT_TRADE_MODE_DEMO` (else Print + `ExpertRemove()`, `OnInit` returns `INIT_FAILED`), cTrader `!Account.IsLive` (else Print
  + `Stop()`), checked on start, on every poll / tick and on the line right before every order call. Not compiled (no platform in
  the sandbox; the platforms' docs were not reachable either: the flags are the ones the files already printed). A new order call
  in these folders must sit right under `if (!DemoOnly()) return;` (`tests/bridge-demo.test.mjs` reads every call).
- Tests: `tests/path-to-live.test.mjs` (the json equals the script's output; every figure of the proposal against it and
  against the supported-book result; the bootstrap on a hand-made series; items 43-46 answered; the proposal never recommends
  a live step; the mirror's three locks are still in the file).

## Forward record of the live book against the forward-test protocol (12 Nov 2026; protocol adopted the same day)
A measurement of the live paper book (Gold trend + Gold daily engulf; NOT the Mosha cycle) against the forward-test protocol of
`research/proposals/2026-11-12-path-to-live.md` section 3, **adopted by the owner on 12 Nov 2026** ("Yes to all",
docs/owner-decisions.md item 43): every surface says "adopted by the owner, 12 Nov 2026". The reading changes nothing itself.
**The protocol's one consequence** (`council/forward.mjs` `stopSwitch`, applied by the Trader right after the `USER_RULES` loop,
from the LAST reading in coach.json): a crossed stop line S1-S4 adds `gtrend` and `geg` to `config.ownerShadow` (the 11 Nov
supported-book switch: their NEW trades are `shadow: true, blockedBy ['owner-shadow']`; the gtrend leg reads `ownerSh(LEG.k)`,
the engulf block `egSh`, its zone cancel and cap read `ownStream`), writes `config.forwardStop { at, lines, reading, systems,
what, alert }` and ONE `by: 'user'` history line quoting the protocol, and the alerts step sends one message (marked in
`state.forwardStopSent`). Once (a config with `forwardStop` is left alone); it never removes a system from `ownerShadow`
(putting the book back is the owner's, by a new rule); trades already open or pending run to their own exits with their stops
(the management loop never reads the switch). A failed execution check E1-E5 is only reported. The 11 Nov sha256 pins of the two
blocks (`tests/supported-book.test.mjs`) now pin the block with those lines put back. Tests: `tests/forward-stop.test.mjs` (7).
Before 12 Nov this section described a measurement against a PROPOSED protocol; what follows is that build, wording updated.
- **`council/forward.mjs`** (pure; inputs handed in, clock `now`). Counted: `alertable` (not a shadow) and `ownStream` trades of
  `BOOK` = gtrend, geg (the json's "S2 = gtrend + geg"), filled at or after `START` (12 Nov 2026 00:00 UTC, the proposal's
  "Clock start"), never a replay row, never a pending / expired / void record; R = the digest's `merNet` (after costs including
  financing). Record: positions closed (adds are units, not positions), total, drawdown from the record's own high (which starts
  at 0), closed and marked to the snapshot price (open trades before costs). Band: the json's `worlds.expected.horizons`
  p5 / p50 / p95, linear between its checkpoints (0R at the start), held past 60 months; "too few to say" under the json's
  smallest `bands` key (10). Stop lines from `gates`: S1 `ddStop` on the closed drawdown every reading; S2-S4 `floor[12/24/36]`
  judged on the total of the positions closed by that calendar checkpoint, "checked later" before it. **Never type a band or
  line number into the code: read the json.** E1-E5 thresholds are section 3's table (the json does not carry them): `EXEC`,
  pinned against the proposal's text by the test. E-checks read every `ctrader/mirror*.json` state (`mirror-accounts.json`)
  and `ctrader/accounts.json` (the account whose books include `council`), for the book's first 30 paper fills only: E1 a copy
  is flagged when the guard had to set its stop (`stopSetBy: 'guard'`, `noStopTries`, a "no stop" close) or the open position
  shows none; E2 copied n of m with each miss's reason (`skipped` / `wait`), a fill under `COPY_GRACE` (6 h) old is not a miss
  yet; E3 mean `slipR` (positive = worse); E4 the account's `swap` on gold-buy copies against `nights` x `FIN.xau.long` x fill x
  ounces (`volume` / 100); E5 a position, order or deal on the Council account since `START` that no mirror record holds.
  Decisions at 30 copies (E1, E5 and three E2 misses fail at once); before that "Counting", or "Not measurable yet".
  **Per-copy records are carried in the reading** (`exec.copies`, `exec.foreign`; a no-stop flag stays once seen) because the
  mirror drops finished copies after `LIMITS.keepDays` (30) and the account history keeps about 30 deals.
- **Trader**: coach.json `forward` (+ `slot`) on the decay monitor's 6-hour slot (`CC_SLOT`) in its OWN block with its own slot
  check, so **the first round after deploy writes the first reading** (it does not wait for the decay rebuild); the daily Coach
  rewrite carries it (`forward: prev.forward`). The protocol file is read from `research/` (`loadProtocol`): a runner without it
  (the Vercel bundle ships council/ and ict/ only) keeps the last reading instead of writing an error.
- **Page**: card `#ms-fwd` (class `card c-fwd adm`) on Council → Systems right under `#ms-sys-book`; `<style id="ms-fw-css">` +
  `<script id="ms-fw-js">` after `#ms-ex-js` (reads `MS_COUNCIL.coach.forward`, fetches nothing): the one sentence first (`.fw-sum`:
  "On track / Too few trades to say / Below the expected range / A stop line is crossed", n and dates), the band chart (accent
  band, dashed middle, the record in ink, stop lines S2-S4 as sell-ink dots; a legend word for each), S1-S4 and E1-E5 as rows
  with their state in words, the "Protocol adopted · 12 Nov 2026" tag and a link to item 43. An older coach.json without `forward` reads "No
  reading yet: the first one comes with the next Coach rebuild". Simple phone view: the Systems pane's existing fold helper
  makes it a two-line row (`.fw-sum` added to its summary selector; no new mechanism). Home's "things wait on you" and the
  daily digest's "Waiting on you" get ONE line only when `alerts` is non-empty (`MS_WEEK.decisions` item `k: 'forward'`,
  `forwardLine`), never otherwise.
- **Today's reading** (council-data of 12 Nov 07:46 UTC): too few to say, no book position closed since 12 Nov; one Gold daily
  engulf buy open (filled 12 Nov 00:09, copied at 3971.24, slipR −0.002); E1, E2, E3, E5 counting; E4 not measurable yet (no
  copy held over a rollover with its swap on file).
- **`council/ctrader-reconcile.mjs`**: a replica research trade left uncopied by the owner rule `replica-mirror-gold-only` is
  listed under "Not copied, with the mirror's reason" (`replicaRuleWhy`: "owner rule: replica gold only since 2026-11-11", from
  config.json `mirrorReplica`), not as a mismatch (17 rows read that way on 12 Nov). A recorded skip / wait reason still wins;
  an uncopied gold replica trade is still a mismatch; exit code logic unchanged.
- Tests: `tests/forward.test.mjs` (10: json bands and interpolation, every stop line, drawdown maths, shadows / replay / other
  systems / pre-start excluded, E1-E5 on fake mirror and account files, carry, digest line, Trader and page wiring),
  `tests/ctrader-reconcile.test.mjs` (the owner-rule reason), `tests/qa-sweep.test.mjs` ("forward card": 3).
- **Review (12 Nov 2026)**, two fixes in `council/forward.mjs`, each proven by a test that failed first (`tests/forward.test.mjs`
  "review: …"): (1) S1-S4 are judged on the unrounded figure (`ddRaw`, the raw checkpoint sum, float noise dropped at 1e-6): a
  drawdown of 21.904R is "more than 21.9R" and was read as 21.90R, clear; displayed values stay at cents. (2) E5: a carried flag
  is dropped once a mirror record holds it (the account file and the mirror state are written at different moments, so a limit
  that filled in between was flagged for good), an account order matching a mirror position adopted from a limit (`viaLimit`:
  symbol, side, limit price) is the mirror's, and a stranger position and its closing deal count once. Checked and left as
  is, said to the owner: S1 steps trade by trade within a day while the 21.9R line was drawn on daily book R (UTC close day), so
  the tracker can only read a drawdown as deeper, never shallower; E4 passes a demo that charges far LESS than the model (the
  protocol only names "over a fifth more" as a fail); an order the mirror cancelled after an older account read has no record
  left and would still be flagged.

## Gold carry: what a gold buy costs to hold, route by route (12 Nov 2026, item 46's "ask what your broker charges")
`research/edge/gold-carry/` (PREREGISTRATION.md committed first; `run.mjs`, `rates.json`, `basis.json`, RESULT.md, result.json).
Cost accounting only: **no rule tested** (item 44 holds), no rule, size, filter, stop, config, `FIN` or mirror setting changed.
The owner's document is `research/proposals/2026-11-12-gold-carry.md` (decision: `docs/owner-decisions.md` item 49, open).
- Each route is an annual rate charged per `nights` rollover (rate / 365, Wednesday three) on every unit of the supported
  book's `legs.json`, taken off gross R; the supported-book study's own `positions` / `bookStats` are imported (not edited).
  Gate: the `demo` route (`FIN.xau.long` x 365 = 5.40 %) reproduces supported-book x1F1 and `none` x1F0 exactly.
- Untouched 2006-17, S2 (330 positions): demo CFD 5.40 % → +5.16R a year, t 1.86; IC Markets Raw 4.69 % → +5.39, t 1.94;
  Afterprime 5.72 % → +5.05, t 1.83; Pepperstone UK 7.79 % → +4.37, t 1.60; micro gold futures 2.20 % + $2.12 a round trip
  and a roll → +5.51, t 1.96 (8.1R of fees, about half the carry saved); GLDM counting the interest its cash would earn
  3.98 % → +5.62, t 2.02. Break-even: t 2 at a flat 4.1 % a year. Holds: median 4 nights a position (Gold trend 12.5,
  engulf 2). **Not a new verdict on the book** (the supported-book FAIL stands; a cost picked after seeing it proves nothing).
- Futures carry measured from council-data `research/probe/cnbc-gc` (the files are `GCZ26`'s own prints, asked as `@GC.1`)
  against OANDA spot, 198 weekdays of 2026: 3.6 % over the year (lease about 0 to June), 2.2 % over the last 20 days, 3.8 %
  if the expiry is taken as 1 Dec: the late figure is fragile near expiry.
- History rows use FRED `DGS2` from the council's `macro/cache.json` (the overnight rate before Aug 2025 and gold's lease
  rate are not reachable from the build sandbox: FRED, Treasury, NY Fed, CME, broker and issuer hosts are refused); broker,
  CME and ETF figures are web search summaries, each with source and date, pages not opened. One figure (DLSM, 0.34 %) is
  below the cash rate and is listed, not relied on.
- Why the paper cost stays `FIN`: it is what the demo account really pays, and protocol check E4 (item 43) compares the two.
- To repeat: `node --use-env-proxy research/edge/gold-carry/run.mjs fetch`, then `node research/edge/gold-carry/run.mjs`.
  Tests: `tests/gold-carry.test.mjs`.

## Mosha level reversal study (10 Nov 2026, owner: "This is how I was expecting Mosha to work")
The owner showed a gold sell of that morning (sell 4120.42, stop 4128.92, target 4072.84, about 5.6R, target reached). The live
Mosha BO (H4 BO, H1 BO against, M15 BO back, weekly direction) is a different trade: it could not have taken it (wrong side, M15
not M5, weekly filter against) and has placed no live trade since 4 Nov. `research/edge/mosha-level/` (PREREGISTRATION.md
committed first, then `run.mjs`, RESULT.md, result.json) writes the owner's trade down as one rule in the direction rule book's
words: tap of a live H4 swing high or low, M5 close through the last three-candle swing made before the tap (external BO), the
next M5 swing broken by a close, limit at that broken level, stop $0.30 past the break candle's base, target the nearest live H4
engulf zone (the barrier, at least 2R away), one at a time, $0.30 cost, fills on M1. The detector finds the owner's own trade on the
council's candles (`node run.mjs example`). **Verdict: FAIL**: 365 trades 2020 to October 2026, -0.35R a trade after costs, t -3.10,
win rate 14.5 % (in sample -0.50R, out of sample -0.12R; 312 of 365 stopped, median stop $2.77); the three labelled variants lose
too. Nothing live changed; the live Mosha BO is untouched. Tests: `tests/mosha-level.test.mjs`.
**The owner's correction, same day** ("after a H4 we can look for H1 to know when the retracement or pullback starts, then we use
M15 or M5 to trade that retracement"): `research/edge/mosha-retrace/` (its own PREREGISTRATION.md first; imports the shared pieces
of mosha-level). The chain: H4 BO (close beyond the last 3-a-side H4 swing), the FIRST H1 BO the other way after it (close beyond
the last three-candle H1 swing), sell or buy limit at the broken H1 level, zone = the M5 candle that broke it and the 3 before, stop
$0.30 past, target the H4 engulf barrier (2R or more), one signal per H4 BO, one at a time. The live Mosha BO shares the first two
steps and then trades the END of the retracement (an M15 BO back with the H4); this trades the retracement itself. It reads the
owner's own trade (`node run.mjs example`). **Verdict: FAIL on the pre-registered bar, in substance break-even**: 445 trades,
+0.02R a trade after costs, t 0.17 (in sample +0.07R, out of sample -0.03R; before costs +0.13R, median stop $3.21). Variants,
reported only: zone on M15 +0.10R (t 0.81, positive in both halves: a hypothesis, Holm p 1.00 over the day's nine tests), weekly
direction only -0.11R, H4 key level only -0.04R, fixed 3R 0.00R. Not an edge, never call it one; any follow-up (M15 zone, buy
side) needs its own pre-registration on other data (OANDA 2006-17 as mosha-oos used). Tests: `tests/mosha-retrace.test.mjs`.
**The owner's three answers, same day** (asked what "high time frame aligned" means, what happens at the barrier, how the entry zone
is picked): top-down order only (H4, then H1, then M15 or M5; no Daily / Weekly condition, no level requirement); the zone of the
break; and at the barrier "close, then buy with H4": the buy is the MAIN trade, the retracement sell is the first half. So
mosha-retrace is the owner's first half read correctly. `research/edge/mosha-cycle/` (own PREREGISTRATION.md first) tests the second
half: after the H4 BO and the H1 retracement, price reaches the H4 engulf barrier; the first H1 BO back with the H4 within 72 h of
the tap; limit at the broken H1 level, zone = the M5 break candle and the 3 before, stop $0.30 past, target the high the retracement
came from (2R or more). **Verdict: FAIL**: 132 trades, -0.22R a trade after costs, t -0.99 (in sample -0.12R, out of sample -0.35R);
variants (stop under the barrier, M15 zone, fixed 3R) all negative. The whole cycle, both halves on one timeline (descriptive):
577 trades, -0.03R, t -0.29. Thirteen tests in the three Mosha studies of the day, none positive after Holm: no mechanical version
of the owner's Mosha cycle is an edge on gold 2020-26. What the rules cannot hold is the owner's own selection, so the open step is
the owner's own logged trades (docs/owner-decisions.md item 27). Tests: `tests/mosha-cycle.test.mjs`.
**The owner's own examples, checked** (same day, "check the trades I sent you": the 2 Nov screenshots, labelled "M5 vr", "M5 cf
for sell", "M30 sweep high", "i just took entry after bo sell", and the 10 Nov sell): five trades, five winners on OANDA M5 (+2.8R,
+4.6R, +2.1R as closed, +16.4R, +5.6R; table in owner decision 27). They show what the three tests did not hold: the trigger is the
VR and its CF on M5 / M15 (the red "5 mn" box = from the extreme to the last swing inside it; a close out of it = CF), earlier than
the H1 BO; every sell starts from a SWEPT prior high at a higher-timeframe point; the main trade (28 Oct, with the H4 BO sell) is
entered where the pullback ends, at the retest of the H4 BO level, by that same M5 CF; exits are managed by hand and stops are a
few dollars (a $0.30 feed difference decided the 2 Nov buy).
**That reading tested** (owner: "Test both", the two ways of entering): `research/edge/mosha-sweep/` (own PREREGISTRATION.md first;
OANDA gold M5 from June 2006 through the candle proxy, `node run.mjs fetch <dir>`, 18 MB kept out of git; window A 2006-19 untouched
by the day's other tests, window B 2020 to now; fills on M5). A swept H1 swing (2 a side, live 10 days), the M5 VR (the extreme to
the last three-candle swing before it), the CF (a close out of it within 12 h), then entry CF (at the CF close, stop $0.30 past the
extreme) or entry ZONE (limit at the next M5 swing broken after the CF, stop $0.30 past that break's base); target the nearest H4
engulf zone or H4 swing 2R or more away; one at a time per entry. It finds the owner's 28 Oct and 10 Nov sells (the 2 Nov trades
were read on M1 / M30). **Verdict: FAIL, both entries**: at the CF 6,260 trades -0.11R a trade after costs (t -4.62; 2006-19 -0.10R,
2020 on -0.12R; before costs -0.03R); at the zone 6,478 trades -0.21R (t -7.36; -0.23R and -0.18R); 2 and 1 of 21 years positive.
The pattern prints about five times a trading day, so the owner's five winning examples are picked from thousands of look-alikes:
the selection is not in any rule. Fifteen tests in four Mosha studies on 10 Nov, none an edge (the retracement chain breaks even,
the rest lose). Tests: `tests/mosha-sweep.test.mjs`.
**Which sweeps are worth taking?** (owner: "Keep going"; `research/edge/mosha-select/`, own PREREGISTRATION.md first): the same
mosha-sweep candidates split by four conditions known when the order is placed (with / against the last H4 BO; the sweep also took a
live H4 swing or an H1 swing only; session Asia / London / New York; target 4R or more away or nearer), nine cells per entry, each
its own one-at-a-time stream; a cell had to be positive on 2006-12 (100+ trades), hold on 2013-19 after Holm, and stay positive on
2020 on. **Verdict: FAIL**: 0 of 18 cells positive on discovery; all 54 cell-period results negative (best -0.05R; with the H4 at
the CF -0.07R / -0.07R / -0.16R; a far target is worse than a near one in every period). So neither the pattern nor one of these
simple conditions holds the owner's selection. Five Mosha studies, thirty-three tests on 10 Nov, none an edge. Do not write another
mechanical reading or filter; the open step is the owner's own logged trades (owner decision 27). Tests: `tests/mosha-select.test.mjs`.

## MSNR direction call study (11 Nov 2026, owner: use the "MSNR direction SOP" skill)
`research/edge/msnr-direction/` (PREREGISTRATION.md committed first, then `run.mjs`, RESULT.md, result.json). The skill is the
owner's private material: never copy its text into the repository; the study describes the rule in its own words. A direction
FILTER test, no trades: the call (buy / sell) = a close beyond the last swing level that existed before price first tapped a
live key level one timeframe above (swing, engulfing, failed engulfing or dominant zone), while the structure was the other
way; it stays until the opposite sequence completes. Ladders H4 / Daily and Daily / Weekly, on OANDA gold H4 from June 2006
(Daily and Weekly built from the same candles; `node run.mjs fetch <dir>`, cache kept out of git). Measured at each daily
close against the next 1, 5 and 20 daily closes as an excess over the window's own base rate (call x (return - mean
return), Newey-West t), six tests, Holm, 2020-26 confirmation and 2007-19 replication. **Verdict: FAIL**: 0 of 6; largest t
in 2020-26 +1.35 (Daily / Weekly, 5 days, 1,768 days), every test has opposite signs in the two windows; on H4 / Daily gold
rose more after a sell call than after a buy call in 2020-26 (hit 48.4-50.7 % against a base of 51-52.5 %). The breakout-only
call is noise too. Not an edge, never a council filter or bias gate; it does not judge the owner's own chart reading, the
skill's entry sessions or forex. Tests: `tests/msnr-direction.test.mjs` (each element on hand-made candles, no look-ahead,
the report against result.json).

## Mosha desk (10 Nov 2026, owner: "And a place to mosha")
After five studies found no fixed rule of the owner's Mosha trading that makes money, the measurement left is the owner's own
selection (owner decision 27, option a). The desk switch is ICT | Gold | Mosha | Crypto | LIT | NQ SDV; `#mosha` (`#v-mosha`, class
`adm`, permission key `desks`) is the place for it: the record, the cycle in the owner's words, the log form, the trades and the five
studies' figures (linked to the Edge lab; a test compares them with the result files).
- **Log** `api/mosha.js` (private Blob `mosha/trades.json`, 500 kept; a failed read throws, so a save never overwrites the log):
  GET for the owner and for a member who may open the desks (an explicit `perms.desks` wins, else reviewers; viewers and guests
  get nothing), `{ trades, canWrite }`; POST `{ save }` / `{ remove }` for the owner's session only, same origin. Server rules the
  page cannot bend: **every trade has a stop on the losing side of its entry** (absolute rule 1; no stop, no record), the target on
  the winning side, `R` computed on the server from entry / stop / exit, and `pre: true` only for a trade written down while still
  open. A trade logged already closed is `pre: false` ("added afterwards"); a closed trade keeps its side, entry, stop and target
  (notes and tags stay editable). Fields: market (xau, xag, eurusd, gbpusd, nas100), side, at, entry, stop, target, how (cf / zone
  / retest / other), tf, h4 (with / against), swept, note, status, exit, exitAt.
- **Page** `assets/mosha-desk.js` (`window.MS_MOSHA` pure pieces + `window.renderMosha`, loaded with `defer`; styles
  `<style id="ms-mosha-css">`): the record counts ONLY `pre` trades (tiles n / winners / R a trade / total / t / drawdown, a
  running-total line from zero, splits by entry, H4, session and side with "under 10 trades" marked); trades added afterwards are
  listed and totalled apart. `verdict()`: "Too few to judge" under `MIN_JUDGE` 20 closed trades, then negative / "positive, but
  not yet apart from luck" / positive only with t >= 2. Never call it an edge on the desk; the log is a measurement, not a rule.
  "Check candles" replays one logged trade on `/md/bars` 5-minute candles (`replay`: was the entry traded within 30 minutes of
  the logged time; stop first when one candle holds both; up to the logged exit). CSV download. Phones: the table becomes cards
  under 760 px. The form shows only when the server says `canWrite`.
- **The chart and replay** (same day, owner: "Check the screenshots of trades I've sent you so you can understand and replicate
  them now in the charts and replay"): `assets/mosha-replay.js` (`window.MS_MOSHA_RP`, card `#mo-replay`). `EXAMPLES` = the owner's
  five trades (10 Nov sell, 28 Oct sell, 29 Oct sell "Janda", 2 Nov sell, 2 Nov buy) with the owner's own marks read off the
  screenshots and placed on our OANDA M5 candles (`/md/bars`): purple `level` lines, the red `vr` box (the owner's "5 mn" box:
  from the extreme to the last swing before it), the green `bvr` box (a buy's range), the lavender `zone` of the break, an `htf`
  zone, and the position (red stop band, grey target band). The screenshots' clock is New York (UTC-4 until 1 Nov 2026, UTC-5
  after); the data is in UTC. Replay: Start / Back / Play / Next / End, a slider, numbered steps with a one-line caption
  (`aria-live`), M5 / M15 / H1 (built from M5), 1x / 3x / 10x; a mark appears only from the moment it was known and grows with
  the cursor (`marksAt`), so the replay never shows the future. `outcome()` finds the fill and the exit on our candles (stop
  first; the owner's hand close for the 2 Nov sell) and the card states both "You" and "On our candles". A logged trade's
  "Replay" opens it in the same chart (`specOfTrade`, levels only). "Trade it yourself in ChronosTrade" leaves
  `localStorage btLab:handoff` (`handoff()`: market, 5m, start = when the VR is in, the marks known by then as drawings) and
  opens `/backtest`, which reads it once, checks it (known market, under 10 minutes old, at most 24 line / box shapes) and
  starts that session (`HAND` / `handDraw` at the end of backtest.html's script). The examples are the owner's picks: the card
  says they show the pattern, not how often it wins. Tests: `tests/mosha-replay.test.mjs`.
  **The bigger pictures** (same day, owner: "And do the same of the previous": the higher-timeframe screenshots of 2 Nov):
  `STUDIES` in the same file, offered apart from the trades ("The bigger picture" in the picker). `cycle` = "POV 26 October",
  "M15 vr", "2000 pips": the H4 low 4066.5 and the high 4217.4, the H4 BO sell of 22 Oct, the M15 VR (green box, 23 to 27 Oct),
  its CF up, the pullback to the H4 level, the 28 Oct "5 mn" VR and sell, and the fall to 3870 (M15 candles fetched; M15 / H1 /
  H4, H4 candles from 17:00 New York, `h4off`). `oct29e` = "H1" and "no vr just after gave M5 vr m5 cf for sell": two H1 BO
  sells, no VR under the level, then the M5 VR and its CF; the screenshot has no position, so none is drawn and `follow()` only
  measures what price did after the CF candle. A mark has `at` (it appears once its high or low is in) and a line is renamed
  "BO sell" only when the break is in (`relabel`). Never give a picture a position its screenshot does not show.
- A log only: nothing under it places, copies or changes a trade, and no council member reads it. A study of the logged trades
  needs its own pre-registration (n and t, the `pre` trades only).
- **Luxus's main page, and the lessons** (same day, owner: "This will be main page of LEXUS (one of the users, he will train
  u, allow him to send you trades images so u can learn"; the account is Luxus, whose screenshots the examples came from).
  - Permission `mosha`: false | 'read' | 'teach' (`MS_PERM_KEYS`, `cleanPerms`; `api/mosha.js` `moshaLevel` and the page's
    `msPerms` give the same answer, a test compares them). A stored `perms.mosha` (Users page → Permissions → "Mosha desk")
    wins; then the account's own flag; then the member reads the desk when the other desks are open to them. Luxus's built-in
    record carries `mosha: 'teach', home: 'mosha'`, applied by key in `api/_session.js` `account()` so a stored copy of his
    record (a new password) keeps them. `home: 'mosha'` = he lands on `#mosha` when the address has no view; `html[data-mosha]`
    opens the Desks entry and the Mosha link of the desk switch on their own. He stays a viewer everywhere else, and the
    trade log stays the owner's (he reads it, cannot write it).
  - `api/mosha-lessons.js` (private Blob `mosha/lessons.json`, 300 kept, + `mosha/shots/<id>.<ext>`): a lesson = title, note
    and up to 12 screenshots, each with its caption. GET list / `?img=<id>` for readers; POST `{ add }` (one picture a
    request: a new lesson, or one more picture on the teacher's own), `{ edit }`, `{ remove }` for the lesson's teacher or the
    owner; `{ reply }` = what the desk understood. A picture must really be a JPEG, PNG or WebP (first bytes checked) of at
    most 1.5 MB, is stored under the checked type and served with it and `nosniff`; 80 pictures a day per teacher.
  - **The assistant's key**: the desk's assistant has no account. It sends `Authorization: Bearer <key>`; the key is derived
    from the session secret (`readerKey`; `MOSHA_READER=off`, `MOSHA_READER_SALT` rotates it), shown to the owner's session
    only (Lessons card, "Show the assistant's key"), and can read the lessons and write a reply, nothing else; a wrong key
    counts in `api/_guard.js` like a wrong password. Never widen it, never write it in a file or a chat.
  - **Only Luxus teaches** (owner, 10 Nov: "The functionality is only to work for" Luxus, "the key is his password").
    `TEACHER = 'luxus'` in `api/mosha.js`: `moshaLevel` gives 'teach' to that account alone (a stored `perms.mosha:
    'teach'` on any other account counts as 'read', the owner reads too), and the page's `msPerms`, ChronosTrade's
    `TEACH` and the Users page (the "Teaches the desk" option is offered for Luxus only) follow the same rule. His
    sign-in is all he needs: no key, no setup. Sending lessons, "right / not right", every change to the book and
    teaching from ChronosTrade are his; the owner reads the lessons and the book, may remove a lesson or a picture, and
    may still switch Luxus's access (none / read / teaches). Never give teaching to another account without the owner.
  - **The key the assistant sets for itself** (owner, 10 Nov, asked to copy the key by hand: "No need for key u can read
    and do whaeva"). The server also accepts `MOSHA_ASSISTANT_KEY` (`ownKey`: 32-128 plain characters, else ignored): the
    assistant makes a random one, saves it as that Vercel environment variable (Production) and uses it as
    `MOSHA_READER_KEY` for the script. It opens exactly what the derived key opens, nothing more, and `MOSHA_READER=off`
    shuts both. A later session CANNOT read the value back (found 11 Nov: the variable is stored as sensitive, and Vercel
    never returns a sensitive value): it sets a NEW key the same way (replace the variable, redeploy), or uses the network
    secret the owner saved for meridianx.dev. The key never goes into the repo, a commit, a PR or a page. To change it: replace the variable and redeploy; to end it: delete it.
  - **Reading the lessons in a session** (the "learn" part): `node --use-env-proxy scripts/mosha-lessons.mjs pull <dir>` saves
    `lessons.json` and the pictures of the lessons not read yet (2.5 s apart: the firewall allows 30 API calls a minute); look
    at each picture with its caption and note, then `… reply <lesson id> <file>` writes back what was understood (levels read
    off the picture, the steps in the teacher's words, what is unclear). The key comes from the session's environment (a
    network secret for meridianx.dev, saved by the owner in the secure form) or `MOSHA_READER_KEY` locally. A lesson is the
    teacher's pick, like the examples: it shows the pattern, not how often it wins. A rule drawn from lessons is tested with
    its own pre-registration before anyone calls it an edge, and no live rule changes without the owner.
  - Page: `assets/mosha-teach.js` (`window.MS_MOSHA_TEACH` pure pieces, `msMoshaTeach`), cards `#mo-teach` (shown on the
    server's `canTeach`; choose, drop or paste up to 8 screenshots, a caption each, resized in the browser to 1800 px JPEG) and
    `#mo-lessons` (a lesson unfolds to its note, pictures and "What the desk understood"; pictures load only when unfolded).
    For a teacher who is not the owner the two cards come first and the heading speaks to him (`.mo-own` / `.mo-tch` /
    `.mo-rdr`). Tests: `tests/mosha-lessons.test.mjs`.
- **100 % teachable** (same day, owner: "He needs to be 100% teachable"): the desk takes every way of teaching, keeps what it
  is taught, and shows back what it understood so the teacher can check it. This replaces the single reply of the first version.
  - **A lesson** may be words only (title + note, no picture) and may carry the trade's own levels (`trade`: market, side, at,
    entry, stop, target; `tradeOf`: no stop on the losing side, no record). "Give / Change the levels" edits them later.
  - **The conversation** (`thread`): the desk's answer (`{ reply }`, assistant or owner), then the teacher's `{ say: { id, text?,
    verdict? } }`: "right", or "wrong" with the why (required). `stateOf` (the same function on the server and the page, a
    test compares them): new → read ("The desk answered: is it right?") → agreed ("Understood"), or more ("Waiting for the
    desk": new pictures, "not right", or words after the answer). `score`: of the lessons whose FIRST answer was judged, how
    many were right first time.
  - **The desk's reading on the chart**: a reply may carry `chart` (market, base 5m / 15m, window, marks, steps, and a
    position only with its stop on the losing side; `chartOf` checks every field and keeps only known ones). "See the desk's
    reading on the chart" opens it in the replay (`MS_MOSHA_RP.specOfLesson`, `msMoshaReplayLesson`); a lesson with levels but
    no chart opens with the levels alone. Never draw a position the teacher did not give.
  - **The book**, card `#mo-book` "What the desk knows" (private Blob `mosha/book.json`, 400 lines; kinds term / step / rule /
    avoid). The assistant only PROPOSES (`{ learn }` with the key → `proposed`, shown as "The desk's reading, not confirmed");
    a teacher confirms, corrects (the desk's first wording is kept in `was`) or erases (`{ book }`), or teaches a line directly
    (`{ learn }` → `confirmed`). The key cannot confirm, change or erase any line. `SEED` = the desk's own first twelve lines,
    all `proposed`, shown until the first change stores the book.
    **20 Nov 2026**: `SOP` = twelve more proposed lines (ids `sop-NN`) from the owner's course documents, in the desk's own
    words (never the documents' text): joined to the book on every read, stored or not, until the teacher confirms, corrects
    or erases them; an erased seed / SOP line leaves a `{ id, gone: true }` marker in the stored file so it never comes back
    (the page never gets the markers). They may contradict the older seed lines: Luxus settles it.
  - **Who teaches whom** (owner, 10 Nov: "Remember he is the one teaching you mosha strategy"). Luxus teaches the Mosha
    method and the desk's assistant is his student. Mosha is HIS method, not the desk's and not the studies'. In every
    answer, book line and page text: restate what he showed in his own terms, read the levels off his pictures, ask
    where something is unclear. Never teach the method back to him, never tell him what a term "should" mean, never judge
    whether a trade was good, never quote the five studies or their mechanical readings at him as if they were his
    method (they were the desk's attempts to write it down, and they failed), and never treat the desk's own twelve
    first lines or the examples in `assets/mosha-replay.js` as settled: they are guesses from a few screenshots until he
    confirms them. Where the desk's reading differs from his, his is right. The tutorial says this to him in its first
    chapter, and `BOOK.md` opens with it (`WHO` in `scripts/mosha-lessons.mjs`). The tutorial may show him HOW to
    teach (the form of a lesson); it must never tell him WHAT Mosha is.
  - **How the assistant learns, every time** (`scripts/mosha-lessons.mjs`): `pull <dir>` writes `BOOK.md` (the teacher's word
    first, the unconfirmed readings last and marked) and a folder per lesson that waits for the desk (`lesson.txt` with the
    note, levels, captions and the whole conversation; the pictures). Read `BOOK.md` FIRST: a confirmed or corrected line is
    the teacher's word and overrides the studies' wording, the examples in `assets/mosha-replay.js` and anything the desk
    wrote before. Then answer each lesson in the teacher's own terms (`reply <id> <file> [chart.json]`: what is seen, the
    levels read off the picture, what is unclear, and the chart when times and levels can be placed on our candles), and
    propose only what is new (`learn <kind> <file> [lesson ids]`). When told "not right", restate the correction, do not
    argue it, and propose the corrected line. Never present a taught line as tested: it is how the teacher trades.
  - **The desk's questions** (11 Nov 2026, owner: "Keep improving the learning"; the teacher had sent three new lessons
    instead of answering seven questions written inside one answer). A reply may carry `ask`: up to 6 (`MAX_ASK`) short
    questions, each a string or `{ q, yn: true }` (`askOf`), stored on the desk's message as `{ q, yn, a, aat }`;
    `{ reply: { id, ask } }` with no text puts them under the desk's last answer while none is answered. The lesson's
    teacher answers under that answer with one tap (Yes / No where `yn`) or a few words (`{ say: { id, answers: [{ i, a }] } }`,
    his lesson only, the last answer's questions only; an answer can be changed until the desk answers again; the
    assistant's key cannot answer). An answered question moves the lesson to "Waiting for the desk" (`stateOf`, the same
    rule on the server and the page; answers given with or before "right" do not reopen it) and he can still press
    "That is right" / "Not right…" (`judge` in `talkHTML`). Page: `askHTML`, `answer`, `.mo-q`; a half-written answer
    survives a redraw (`T.qd`). Script: `reply <id> <file> [chart.json] [questions.json]` (a list is the questions, an
    object the chart), `ask <id> <questions.json>`; `lesson.txt` prints each question with "THE TEACHER ANSWERED: …",
    which is his word on that point. Ask few, one thing each, yes / no where it fits: he teaches between trades.
  - **Backtesting with the teacher** (same day, owner: "And do backtest with him, he will teach you"): a member who may
    teach (`TEACH` in backtest.html: the owner, or effective `mosha === 'teach'` from `/api/me`) teaches from ChronosTrade.
    Each closed trade's journal row has "Teach" (`[data-teach]`, "Taught" once sent; the records keep `taught` = the lesson
    id): `teachTrade` frames the trade on the chart, takes a picture of chart + overlay (`teachShot`, up to 1600 px JPEG)
    and opens `#teachd` with a title and a note prefilled from the trade's own note, tags, mistakes and ticked rules; the
    toolbar's `#tch-btn` ("Send this moment to the Mosha desk", `teachMoment`) sends the chart as it stands, with no trade.
    Both post `{ add }` to `/api/mosha-lessons` like the desk's own form. The trade travels as the lesson's levels with
    what a replay knows: `market` (the lesson `MARKETS` list is wider than the log's), `exit` + `exitAt` (both or neither;
    `R` computed on the server), `tf`, `src: 'replay'`. The stop sent is the stop the trade was OPENED with (`stop0` from
    `r0`), never a trailed or break-even one, and `tradeOf` still refuses a stop on the wrong side. The desk shows "from a
    ChronosTrade replay" on the lesson and opens it on the replay chart with its exit. A replay trade is practice on past
    candles: never count it in the Mosha record, never as evidence of an edge. The teach card links to `/backtest`.
  - **Easier for the teacher** (same day, owner: "Do better and easier for" Luxus "to work with"). Keep it this simple:
    the teach form is pictures, then words, then Send; the name, the levels and "goes with" sit in the fold `#mo-t-more`.
    A lesson needs no name (`nameOf` on the server: the first caption, else the first words of the note) and a lesson in
    words needs only the note. `#mo-todo` "Your turn" (`MS_MOSHA_TEACH.todo`: the desk's answers to his own lessons, the
    book's unconfirmed lines; first for a teacher) jumps to the first answer to check or shows only the book lines left
    (`T.bookOnly`). Captions are tapped (`captionIdeas`: his own most used, then the usual ones; `addCaption` joins them).
    A screenshot dropped or pasted anywhere on the desk lands in the form; "Add pictures" opens the picker and
    `#mo-t-to` says which lesson they go to. The note and name are kept in localStorage `msMoDraft:<account>` until sent.
    "Not right…" is typed under the desk's answer (no dialog; `T.wrong`); Ctrl / Cmd + Enter sends. From four lessons
    on, `#mo-l-flt` filters them (All / Your turn / Waiting for the desk / Understood) and the lesson that waits on him
    opens first. In ChronosTrade: `#tchip` offers "Teach this trade" on the chart right after a close (only trades closed
    in this visit, `TCH.old`; × dismisses), T or `#tch-btn` teaches the trade just closed, else the moment (`teachNow`),
    Ctrl + Enter sends, a cleared name falls back to the suggested one, and `#tch-n` counts the desk's answers that wait
    for him (one read of `/api/mosha-lessons` on load). None of this runs for a member who may not teach.
  - **The tutorial** (same day, owner: "a tutorial to help him understand how to use the teaching and what he needs to
    do"): card `#mo-guide` "How to teach the desk", first on a teacher's page. Five steps (`MS_MOSHA_TEACH.STEPS`: send
    a trade, the desk answers, say right or not right, check what the desk knows, backtest and teach from the replay),
    each with one plain paragraph and "Show me" (`showPart`: scrolls to that part and outlines it for two seconds; the
    last step links to `/backtest`). `guide(lessons, book, who)` ticks a step from what he has really done (his lessons,
    the desk's answers, his verdicts, the book, a replay lesson), so it is right on every device, and names the `next`
    step that is his to do. Shown by itself until he hides it (localStorage `msMoGuide:<account>`) or has done all five
    (then done steps fold to one line); "How to teach" (`#mo-guide-open`, teach card) brings it back in full, for the
    owner too. Never shown to a reader. ChronosTrade shows one hint toast the first time the chip appears
    (`btLab:teachTip:<account>`); the chip itself is for a teacher who is not the owner (the owner keeps T and the
    button). Keep the steps' words free of any promise: it is a tutorial for teaching, not a claim that the trades win.
  - **The full tutorial, and French** (same day, owner: "a proper tutorial because the better he knows how to work with
    you he would do better", "the more the quality of the tutorial the better for him", "give him choice to choose french
    instead but the trading terms leave it as english").
    - `assets/mosha-tutor.js` (`MS_MOSHA_TUTOR`): "How to work with the desk", nine chapters in a `<dialog id="mo-tut">`
      opened from the guide card ("Start / Continue / Read the tutorial again"): what the desk is, a good lesson, sending
      it, what the desk can and cannot read on a screenshot, checking and correcting its answer, the book, teaching from
      a ChronosTrade replay, the habits that help, a first session. A chapter = a lead, blocks (`p`, `h`, `ul`, `ol`,
      `tip`, `warn`, `fig`, `cmp` weak against good, `dd` do / avoid), one question with every answer explained, and
      sometimes a button to that part of the page. The pictures are drawn in code (`FIGS`: the loop, the order of
      pictures, the annotated chart, mock-ups of the form, an answer, a book line, the replay chip): no image files.
      Chapter list at the side (hidden on phones), arrows and Escape, progress kept in localStorage `msMoTut:<account>`.
      It teaches TEACHING: it must keep saying that the desk never places a trade, does not answer at once, and that
      whether a rule makes money is tested separately; it never promises a result (a test bans those words).
    - `assets/mosha-i18n.js` (`MS_MOSHA_I18N`): English is the source, `FR` is looked up by the English phrase, a phrase
      with no entry stays English. `tr`, `fill`, `apply(el)` for fixed page text (`data-tr`, `data-tr-ph`,
      `data-tr-aria`, `data-tr-title`), `seed(b)` (a book line still in the desk's own words is shown translated; a
      corrected line is the teacher's). In `mosha-teach.js` every word goes through `L('…')`, in `backtest.html`
      through `ML('…')`, in the tutorial through `T('…')`; the tutorial's chapters are written out in both languages
      (`TUT.en` / `TUT.fr`). **The words of the method are never translated** (`TERMS`: trade, sell, buy, entry, stop,
      target, level, sweep, VR, CF, BO, zone of the break, barrier, pullback, swing, high, low, timeframe, top-down,
      H4 … M5, backtest, replay); "the levels" of a trade (its prices) is "niveaux de prix", the method's "level" stays.
    - The choice (`.mo-lang`: top of a teacher's page, the guide card, the tutorial) is kept per account on the device
      (localStorage `msMoLang:<account>`; a new device takes the language of his last lesson) and travels with each
      lesson and reply (`lang` on `add` / `say`, stored on the lesson, `langOf`). `scripts/mosha-lessons.mjs` prints
      "Answer in FRENCH … keep the words of the method in English" in `lesson.txt`: answer a lesson, and propose its
      book lines, in the lesson's language. Only the teaching surfaces are translated (the desk's teacher cards, the
      tutorial, ChronosTrade's teach chip, dialog and messages); the rest of the site stays English.
    - Adding a phrase: write it in English through `L` / `ML` / `T` or `data-tr`, add its French line to `FR`.
      `tests/mosha-i18n.test.mjs` fails on a phrase with no French line, a French line nothing uses, a method word
      translated away, a `{blank}` or `<b>` that differs, a chapter whose two languages differ in shape or right
      answer, and a French button name the page does not show.
  - **His turn first, one tap away** (11 Nov 2026, quality round; he had sent lessons but judged no answer and confirmed no
    book line). On his page `#mo-todo` now comes BEFORE the guide (`order: -6`) and is no longer a row of jump buttons: it
    counts what waits ("3 answers to check · 4 questions from the desk", then the book's lines) and holds the FIRST item,
    answerable in place with the lesson's own buttons (`drawTodo`): the desk's answer (clamped past 280 characters, "Read it
    all"), its first open question (Yes / No or a few words; the next one follows by itself), "That is right" / "Not right…"
    (typed in place), "Open the whole lesson", "Later" (to the back of the queue, this visit only). When no answer waits,
    the first unconfirmed book line with Right / Correct / Erase. After each tap the item rests (`mo-busy`), then
    `#mo-td-flash` (the only live region) says what happened and "Here is the next one."; a phone hides the intro line
    while something waits (`#v-mosha.mo-turn`) so the judge buttons stay on the first screen. `turnOf(l)` (pure): a lesson
    is still HIS while the desk's last answer has an unanswered question and he wrote nothing after it, although the server
    already calls it "more" after his first answer; `todo()` returns `turn` (oldest first) and `ask` beside `judge`; the
    "Your turn" filter and the lesson's chip ("The desk has 2 questions for you") follow it. `stateOf` is unchanged (the
    server's rule). A correction or answer stays in its box until the desk has it (`T.sd`, `T.qd`); errors say what to do
    (no connection, too many requests, a picture too large), the lessons that cannot be read offer "Try again". No new
    permission, endpoint or concept; `api/mosha*.js` untouched.
  - **The chart card and the log in his language, addressed to no one** (11 Nov 2026). `assets/mosha-replay.js` and the
    reader's side of `assets/mosha-desk.js` go through `L(...)` like the teach cards (controls, captions, every step of
    the examples, the result line, the log's record, table and candle check; `msMoshaReplayLang` / `msMoshaDeskLang` redraw
    on a switch). The examples are HIS screenshots and every reader sees the card, so the desk's text about them says
    "the red "5 mn" box", "Closed by hand", "On the screenshot: +5.6R" / "In the log:" / "The lesson:", never "you" /
    "your" (a test bans it); the owner's own sentence on the 10 Nov example shows to the owner only (`ownLabel`). The
    owner's log form and prompts stay English. `scripts/mosha-lessons.mjs`: `lesson.txt` says under its heading whose move
    it is and why (`why`), `BOOK.md` counts the teacher's lines against the desk's, and `pull` prints first how many
    lessons wait for the desk, for the teacher, and are understood (`counts`, `countsText`).
- **Luxus's record** (14 Nov 2026, owner: "Ask Luxus and log his trades"; display only): card `#mo-lux` under the record,
  `assets/mosha-record.js` (`window.MS_MOSHA_REC`, fed by `msMoshaRecord(T.lessons)` from the teach cards' own read, no second
  request). Counts a lesson of the teacher (`TEACHER`, as `api/mosha.js`) whose `trade` has market, side, `at`, entry, a stop on
  the losing side and a target, never `src: 'replay'`. Outcome on our 5-minute candles through `MS_MOSHA.replay` (stop first when
  one candle holds both); only where neither level is reached before his own exit does his exit stand; both are shown. In the
  record only when the lesson's `at` is before the outcome (the start of the candle that reached the level, else his exit time);
  otherwise "added afterwards", kept apart. **Timing caveat**: the server stamps no time on the levels themselves, so levels given or
  changed later by `edit` carry the lesson's time (said on the card); proving it needs a server stamp, not added. R before costs in
  the tiles, after $0.60 a round trip on gold (other markets before costs); `MS_MOSHA.verdict` / `MIN_JUDGE` 20. Hidden for a
  teacher who is not the owner (CSS beside `#mo-rules` / `#mo-cycle`; no candle read then); owner-English, so not in the French
  dictionary. Folds on the simple phone view through `desks()`. Tests: `tests/mosha-record.test.mjs`.
  **Levels time-stamped by the server** (14 Nov 2026): `api/mosha-lessons.js` `stampTrade` stamps `trade.setAt` (unix s, server
  clock) whenever an `add` or `edit` sets or changes market, side, `at`, entry, stop or target, keeps `firstAt` (first time levels
  were set, kept on the lesson as `tradeFirstAt` if they are removed) and `exitSetAt` (an exit-only edit, which never moves
  `setAt`); the page cannot send them (`tradeOf` builds a fresh object), older lessons keep none until their levels change; the
  record judges `setAt` against the outcome candle and marks rows without it "levels not time-stamped (older lesson)". Tests:
  `tests/mosha-trade-stamp.test.mjs`.
  **Browser check (14 Nov 2026)**: a trade still open on our candles was read again after every draw (hundreds of `/md/bars`
  requests a second while the desk was open); now once per read of the lessons (`S.tried`, cleared by `msMoshaRecord`). The rows
  carry the log's cell classes (`mo-c-time`, `mo-c-side`, `mo-c-res`, `data-l`), so on a phone they are the log's cards (the side
  chip sat over the entry time). Tests in `tests/mosha-record.test.mjs`.
- **Why the systems missed the owner's trades** (17 Nov 2026, owner: "I've been taking good trades on mosha so I don't
  understand why u not catching them"; `research/proposals/2026-11-17-mosha-misses.md`, items 55-56; nothing live changed).
  The owner's log `mosha/trades.json` was never written (0 logged, 0 `pre`) and no lesson carries levels, so the six shared
  examples were replayed through the Trader's Mosha BO block and `mosha-cycle.mjs` on OANDA candles: 4 never signalled (the
  engine's H1 break, 6 candles a side at the protected swing, came days later or never; the owner's turn is an M5 sweep, VR,
  CF), 2 seen in the same move (an earlier entry stopped by the owner's sweep, then the one-per-leg cap; a Mosha BO signal
  blocked by weekly + slow pullback, stop 5.5x wider). Mosha BO recorded nothing 1-17 Nov; the one cycle record came from
  weekend candles of the fallback feed (item 56). The M5 trigger that would catch all six is the one `mosha-sweep` /
  `mosha-select` already failed: never present a rule that catches these picked trades as evidence. Never commit the
  owner's or Luxus's individual trades or lesson text (public repository): aggregate counts only.
- **The council's Mosha systems on the desk** (20 Nov 2026, owner: "why mosha desk doesnt have the trades like ict and executions",
  "do it"): card `#mo-sys` before `#mo-rules`, `assets/mosha-systems.js` (`window.MS_MOSHA_SYS`: `isMosha`, `copies`, `rowOf`, `build`).
  One row per forward trade the Trader recorded for Mosha BO (`k: 'mosha-bo'`) and the Mosha cycle (`mcycle`), newest first (40 at
  most), with two executions in its last cell: **Paper** (the trades.json record: fill, result before and after costs) and **Demo**
  (the mirror's own record of that trade id: fill, lots, slippage in R, status, times, which demo account; "not copied" with the
  mirror's reason, or "no copy on file"). Reads `MS_COUNCIL.trades` (event `ms:council`) and, only while the desk is open, the
  mirror files of `ctrader/mirror-accounts.json` through `msData` (never the ICT account's; at most once a minute). A line per system:
  recorded / open / closed with R, and "Too few to judge" under 20 closed, else "a forward record, not a tested edge". The note says
  both are paper shadows whose studies failed. Hidden for the teacher (CSS beside `#mo-rules`) and never drawn for a guest; folds on
  the simple phone view like the other cards. Display only. Test: `tests/mosha-systems.test.mjs`.
- **The method, replayed on the last two weeks** (20 Nov 2026, owner: "try to replicate the last 2 weeks", "show the trades like the
  council and logs"): card `#mo-sopr` after `#mo-sys`, `assets/mosha-sop.js` (`window.MS_MOSHA_SOP`: `sopTrades`, `barrierTrades`,
  `outcome`, `summary`). When the desk opens it reads gold candles from `/md/bars` (D1 to M1, 13 requests) and walks the last 14
  days one closed candle at a time with the page's own `msAnalyze` / `msMosha` / `msZones` / `msInternal`: (1) **BO, VR, CF** on
  the documents' ladder (`LADDER`: D1→H4, H4→H1, H1→M30, M30→M15, M15→M5), entry on the EG after the pullback, target the VR's
  extreme; (2) **barrier entry**: a fresh H1 or M15 zone, first return of price, a QM (BO Structure) on M1 with the barrier, entry at
  that close, stop $0.30 past the extreme made at the barrier, target `BARRIER_R` 3R (the replay's own choice, said in the log).
  One row per entry like the council's table, "Log" opens its steps with their times, "Chart" opens it in the replay chart
  (`msMoshaReplayTrade`). Summary a kind: entries, reached target / stopped, R before costs, "Too few to judge" under 20 closed, else
  "two weeks of one reading, not a tested rule". First run (7-20 Nov): the sequence 5 entries, +7.1R; the barrier entry 56 entries,
  −4R (it takes EVERY fresh barrier; the method says to mark the best one). It found two of Luxus's three trades of 18-20 Nov within a
  dollar (not shown or stored anywhere: his trades are never committed). Display only: no storage, no council file, no API call,
  nothing traded; hidden for the teacher and guests. Never call it a record or an edge. **The card leads the desk** (20 Nov 2026, owner: "mosha desk must be like normal desk showing the replay trades"): for the owner and readers `#mo-sopr` is first and the chart `#mo-replay` second (CSS `order`, the DOM stays), laid out like the ICT desk: one answer line (`.mo-sop-ans`), tiles (entries, reached target, total before costs, "Too few" under 20 closed else "Not a test"), Open now, the trades, closed R by UTC exit day (`byDay`, open trades never added in), and the per-type lines and the caveat in a fold; kept open in the simple phone view; a trade opened on the chart is labelled "From the replay" (`replayed: true`). Test: `tests/mosha-sop.test.mjs` (a seeded
  market: stops on the losing side, logs in time order, no look-ahead by cutting and by changing every later price).
- **The Mosha tracker: trades stored like the ICT desk's** (21 Nov 2026, owner: "do the mosha edge the same as ict with the trades").
  `council/mosha-desk.mjs` (council.yml every 3rd round beside the ICT tracker, `timeout 120`, never fails the round; `assets` is in
  the loop's sparse checkout for it) runs the SAME reading as the card (`assets/mosha-sop.js` on the page's own functions, lifted
  from market-structure.html by `loadFns`) on gold candles from `MD_BASE` and writes council-data `mosha/desk.json`
  (`{ at, through, since, counts, records }`, 600 kept). `merge`: a closed record is frozen as booked, an open one is followed, a new
  one is stamped `first` and `src` (`live` = recorded within `LIVE_S` 1 h of its entry, else `replay`), the same trade re-read
  under another id within 20 min is not added twice, a record out of the run's 14-day window is kept; `clean` stores nothing
  without a stop on the losing side. The card (`#mo-sopr`, now "Mosha trades") reads that file through `msData` first (Both / Live /
  Replay switch, "last run", "trades since"), so it shows trades when the candle service is down and keeps them past two weeks;
  only without the file does it replay in the browser. PAPER RECORD ONLY: no order, alert, mirror copy or Trader read; not a
  tested rule, never "an edge" (the barrier entry still takes every fresh barrier). `datahealth.mjs` lists the file (warn 6 h).
  Tests: `tests/mosha-tracker.test.mjs`.
  **Second source** (21 Nov 2026, owner: "if mosha cannot use oanda use something different"; OANDA answered 520 from the 20 Nov
  close on): `candles()` reads every timeframe from OANDA or, when any fails, every timeframe from Kraken's gold token (PAXG/USD,
  the Trader's own gold fallback; weekend candles dropped, `spotShut`), never a mix; the file says `feed`. On the fallback
  `merge(…, 'Kraken')` adds only entries of the last `FALLBACK_NEW_S` 2 h (stamped `feed: 'Kraken'`, a log line says the prices
  sit a few dollars from spot) and never updates a record read on OANDA; back on OANDA a Kraken record is left as it stands
  (an open one stays open: known, not solved). Not checked against the live exchange (not reachable from the build sandbox).
  **More history, and the trade on the chart** (21 Nov 2026, owner: "we need more trades, and fix the see trades on chart"):
  `node council/mosha-desk.mjs <dir> --days N` (or `MOSHA_DAYS`; the loop's own runs stay at 14) reads N days back once to fill
  the record (`KEEP` 1500); the first 90-day file: 473 records from 24 Aug 2026, 422 barrier entries −18.0R and 51 sequence
  entries −4.7R before costs (a paper record of one reading; never call it an edge). Each record carries `marks` (the BO level,
  the VR box, the CF zone; the barrier and the QM level; `clean` keeps six, checked) and "Chart" hands them and the log to
  `assets/mosha-replay.js` `specOfTrade`: the window starts 3 h before the first mark (at most 6 days back, 15-minute candles
  over 2.5 days), the log's lines are the replay's steps, the card's heading reads "This trade, on the chart", and the
  result is found on the candles (no hand exit). A logged trade without marks opens as before. The table shows 30 rows first.
  **More markets** (21 Nov 2026, owner: "more trades", twice): the SAME reading on silver, EUR/USD, GBP/USD and the Nasdaq 100
  (`MS_MOSHA_SOP.MARKETS`, tracker `OTHER`; main price source only, one market failing leaves the rest). No new entry rule: on
  another market the stop buffer, the risk limits and the smallest barrier are the same share of price as gold's dollar figures
  near $4,000 (`sizes`, the desk's own choice, said on the card); gold's figures are unchanged. A record of another market
  carries `market`, an id prefixed `<market>:` and six decimals; the card has a market filter and the chart's price scale takes
  the market's decimals. `KEEP` 4000 (14,000 since the January 2026 backfill, 21 Nov). The 90-day file: 2,186 records, all closed, before costs: gold −22.7R (473), silver −62.8R
  (416), EUR/USD +39.8R (421), GBP/USD +19.5R (459), Nasdaq −40.1R (417); −66.3R in all. A paper record of one reading before
  costs: never call a market's plus an edge. **Do not put a file of over 600 records into council-data before main's tracker
  has `KEEP` 4000** (the older tracker cuts the file to its newest 600 on its next run).
  **Open now** (21 Nov 2026, owner: "the same panel with active trades like ict desk"): card `#mo-open` first on the desk (before
  `#mo-sopr`; hidden for the teacher, kept open in the simple phone view): one card per OPEN record of the tracker's file, every
  market, whatever filter the table is on (`openPanel` / `openCard` in `assets/mosha-sop.js`): side, market, entry type, R at the
  tracker's last reading (never a live quote: said on the card), a −1R to target bar, entry / stop / target / best so far, open
  since; a card opens the trade on the chart. No open trade = one dashed line saying so. Display only.
- **LIT desk and Engulfing desk** (21 Nov 2026, owner: "The same for LIT and the same for engulfing. Plenty of trades and same panel
  like ict"). The desk switch is **ICT | Mosha | LIT | Engulfing** (`#lit` / `#v-lit`, `#eg` / `#v-eg`, class `adm`, permission
  `desks`; `tests/qa-sweep.test.mjs` no longer lists `v-lit` as removed: this LIT desk is new, the 8 Nov one stays gone).
  - **Trackers** `council/edge-desks.mjs` (council.yml every 3rd round after the Mosha tracker, `timeout 150`, never fails the
    round; `--days N`, `--only lit|eg`) → council-data `lit/desk.json`, `eg/desk.json`, in the Mosha file's shape (it shares
    `bars`, `clean` and `merge` of `council/mosha-desk.mjs`; a record carries `label`, kinds `eg-<tf>` / `lit-<set>`).
    **Engulfing** (`egTrades`): the live Gold daily engulf rule (close beyond the last opposite candle of the 3 before, right
    side of the 20-candle average; limit at that candle's edge, stop past its far edge, 10R, 1R trail from +2R, out after 10
    candles; a close through the zone or 20 candles cancels) on D1 (trading days, `foldWeekend`), H4 and H1 of the Mosha five
    markets, buys AND mirrored sells, one order a zone, the Trader's cap of 3 not applied. The H4 / H1 readings, the sells and the
    other markets are the desk's own choice. **LIT** (`litTrades`): `council/lit.mjs` `fbosCandidates` on eleven markets
    (`MS_MOSHA_SOP.ALL`), the first of `LIT_SETS` that fills: `rule` (the pre-registered execution), `loose` and `break` (the
    8 Nov replay's study executions, restored from the removed `council/lit-replay.mjs`), managed by the LIT study's own
    `managePosition` (break-even after two swing breaks, out at the New York day's end), one position at a time a market.
    Sizes on a market other than gold are the same share of price as gold's (`sizes`). No costs are charged.
  - **Page** `assets/desk-trades.js` (`renderEdgeDesk(k)`, `MS_EDGE_DESKS`): per desk the Open now panel (`[data-dk="open"]`),
    then the trades card (filters by entry type, market and Live / Replay, tiles, 30 rows then "Show all", closed R by day, "What
    this is"). Reads only the stored file through `msData` (no browser replay). The Mosha desk's style sheet is copied once at
    run time with `#v-lit` / `#v-eg` in place of `#v-mosha` (`#ms-dk2-css`), so both desks look like it with no second sheet.
    "Chart" LENDS the page's one replay chart: `#mo-replay` is moved into the desk (`borrowChart`; the Mosha examples' picker and
    legend hidden there) and put back when the Mosha desk opens (`returnChart`, a marker `#mo-replay-home`).
  - First files: Engulfing 1,503 records over 90 days (+57.7R before costs: H1 1,171 trades +36.0R, H4 284 +5.0R, D1 48 +16.7R);
    LIT 348 over 180 days (+6.9R: loose 311 −14.5R, break 20 +25.2R, rule 17 −3.5R). PAPER RECORDS of one reading with NO costs
    (an H1 engulf's stop is a few pips, so costs would take a large share): never call either total an edge; the LIT study was
    inconclusive and the engulf's book study failed its bar. Tests: `tests/edge-desks.test.mjs`.
  - **P&L calendar on the three desks** (21 Nov 2026, owner: "Calendar as well"): `MS_MOSHA_SOP.calMonth` (pure) / `calHTML` in
    `assets/mosha-sop.js`, used by the Mosha trades card and by `assets/desk-trades.js` in place of the "Closed R by day" tiles: a
    month grid (Monday first) of closed R by the UTC day a trade ended, arrows to the months that have a close, a tint by size,
    a day opens its trades with "Chart"; it follows the card's filters; open trades are never added in; before costs. Styles
    `.mo-cal*` in `#ms-mosha-css`.
  - **A desk's trade opens over the page** (21 Nov 2026, owner: "the chart should open before and after like council, I don't like
    this thing going down to the chart"): `msMoshaReplayDialog(trade, host)` in `assets/mosha-replay.js` moves the page's one replay
    card `#mo-replay` into `<dialog id="mo-rp-dlg">` made INSIDE the desk's own view (so the desk's styles still reach it; a
    placeholder `#mo-replay-dlg-home` holds its height, the page behind does not move) and puts it back on close. Header: the
    trade's name, **Before** (the chart as it stood at the entry) / **After** (the whole trade, the default), Close; Escape and a
    click outside close. Every "Chart" button, Open now card and calendar day row of the three desks uses it (a day's row is
    clickable as a whole); the Mosha examples' picker stays on the desk. The trade history was rebuilt from 1 Jan 2026 the same
    day (`KEEP` 14,000): Mosha 7,618 records, Engulfing 5,326, LIT 604; paper records before costs, never evidence.
  - **MSNR desk, and three zone methods on the Engulfing desk** (21 Nov 2026, owner: "do the edge desk for msnr", "improve the
    engulfing, learn from these documents"; four private documents and the direction skill, read in the desk's own words and
    NEVER copied or named in the repository: a test bans the identifying words). The desk switch is **ICT | Mosha | LIT |
    Engulfing | MSNR** (`#msnr` / `#v-msnr`, permission `desks`; `assets/desk-trades.js` `DESKS.msnr`, file `msnr/desk.json`).
    `council/eg-methods.mjs` (pure): `zones(C, tf)` (an engulf = a candle closing beyond the high / low of the opposite candle
    before it; the zone is that candle's range; `touch`, `fail`, `end`: a zone still alive at the newest candle has no end),
    `methodTrades` = kinds `eg-plan` (the Daily's last engulf gives the side; price in an H4 zone of that side, a 15-minute
    engulf, then on M5 an opposite zone fails and a limit rests at the M5 zone behind it), `eg-simple` (the same entry where
    the Daily is not on that side) and `eg-direct` (a fresh H4 zone left alone for two H4 candles, a fresh H1 zone inside it,
    a fresh M15 zone inside that, a limit at the M15 zone): stop 30 pips ($3.00 on gold; the same share of price elsewhere),
    target 2R (the direct entry's target is the desk's choice), out after 24 h, one position at a time a market.
    `snrTrades` (gold only, kind `msnr-sop`): a Daily candle rejects a Daily level and an H4 candle breaks its last swing the
    same way within 3 days = the side; in an H4 zone of that side (or an opposite zone that failed) a 15-minute engulf, a limit
    at its zone, stop 30 pips, target 90 pips, at most 2 a UTC day; the plan's second entry type is not written.
    `council/edge-desks.mjs` `msnrTrades` (kinds `msnr-main` 12-16 UTC / `msnr-other`): the `msnr-entry` study's own
    `candidates` / `calls` / `simulate` (imported; `P.PAD` / `P.MIN_R0` scaled for another market inside a try / finally), the
    call from hourly candles grouped into the study's UTC 4-hour buckets (`extra: { '1h': 170 }` days of history), entries
    WITH the call only, 1.5R, 12 h. `DESKS` = eg, msnr, lit; the loop's step is `timeout 280`. First files from 1 Jan 2026,
    before costs: Engulfing 6,172 records (H1 4,051 +119.8R, H4 1,093 +21.3R, D1 182 +22.9R, plan 408 +32.8R, simple 396
    +22.0R, direct 42 −6.0R); MSNR 6,912 (other hours 5,208 −191.6R, 12-16 UTC 1,416 −64.1R, gold plan 288 −48.0R).
    PAPER RECORDS of readings with no costs: never an edge (`desk-slices` showed the engulf reading is zero before costs on
    2020-26 and loses after them; `msnr-entry` FAILED). Tests: `tests/edge-desks.test.mjs`.
  - **Marking audit: the desks follow the methods' own definitions** (21 Nov 2026, owner: "make sure you are marking the key levels
    such as V level, engulfing, EG fail, BO, VR, CF … some of them you are not following the strategy rigorously"). Checked
    against the owner's private documents (never copied) and fixed: (1) **Mosha sequence**: the VR and the CF must each be a BO
    Structure (a QM, `e.structure !== false` in `msMosha`; `sopTrades` now hands the flag over), never a continuation break; a
    record carries `deep` (did the pullback reach 50% of the range before the CF: recorded, not required, by the owner's 13 Nov
    reading) and a "50% of the range" mark. (2) **Barrier entry** (`assets/mosha-sop.js` `BARRIER`): the method's own table, D1
    barrier confirmed on H1, H4 on M15, H1 on M5, M15 on M1 (it was H1 and M15 barriers both on M1); the CF is a QM on that
    timeframe within `BARRIER_WATCH` 60 candles of the first touch, and the entry is the PULLBACK to the level it broke (a limit
    for `BARRIER_FILL` 12 candles, read on the finest candles; it was a market entry at the QM close); label "H4 barrier · BO
    origin" / "iBO origin". (3) **Engulf zones** are BODY engulfs, zone from the pair's wick to the engulfed candle's open
    (`zones`); **A / V levels are turns of the CLOSES** (line chart), never wicks. (4) **MSNR direction** is the desk's own
    `council/eg-methods.mjs` `direction(work, keyOf, htfSec)` (the failed study's detector is no longer used for the call):
    Daily key levels = V / A levels, EG zones, EF (an EG zone that failed, turned) and the dominant pair; a switch needs a
    tapped Daily level and an H4 close beyond the last A / V level that existed BEFORE the tap (external); `events[]` carries
    the zone, the tap and the level. (5) **Every record's chart marks name its key levels** ("Daily V level", "Daily EG zone",
    "H4 A level · BO buy", "H4 EF (zone failed)", "M15 EG zone", "M5 EF (zone failed)", "M5 EG zone · entry", "M5 VR",
    "M5 CF zone", "M15 CF (QM)"; `clean` keeps 8 marks). Not written, said on the desks: open-close levels, the gold plan's
    second entry type, "mark the BEST barrier" (every fresh BO / iBO origin is taken). These are readings, not tested rules.
  - **The readings after the audit, tested** (21 Nov 2026, owner: "do a study in how to improve each edge";
    `research/edge/desk-rigor/`, PREREGISTRATION.md committed alone first; `run.mjs fetch|market <key>|report <dir>`). The desks'
    own code on gold, EUR/USD and GBP/USD, OANDA M5, in sample 2020-23, out of sample 2024-25 (nothing of 2026), net of costs,
    month-sum t, Holm over 13 tests. **FAIL, 0 of 13.** Readings, out of sample, R a trade after costs: Mosha sequence −0.172
    (n 978, t −2.22), Mosha barrier −0.113 (n 2,112, t −2.12), engulf plan −0.069 (n 893), simple −0.068 (n 1,008), direct
    −0.075 (n 97, too few), MSNR with the direction −0.300 (n 3,957, t −11.87), MSNR gold plan +0.079 (n 775, t 1.31, and
    −0.042 in sample). Conditions the methods name (50% pullback before the CF, CF clear of the VR, a major-BO barrier, with the
    Daily structure, plan against simple, with against the direction): none picks better trades (largest t 1.51). Before costs
    the engulf methods are about zero. The M15 barrier on M1 was not tested (no one-minute history). The desks stay paper
    records of one way to read each method; none of these conditions is made a requirement; do not look at them again on
    these years. Test: `tests/desk-rigor.test.mjs`.
  - **Direction: the tap candle can be the breakout candle** (21 Nov 2026, point-by-point check of `direction()` against the
    direction procedure): a working candle that tapped the key level AND closed beyond the external level was read one candle
    late, or at a later re-break; the tap is now read before the break in the same candle (about 6-10 of 163 switches a
    market move, 2019-26). Checked and left: A / V levels on closes, the dominant pair, EF from a failed EG zone, the level
    fixed at the first tap, no switch without a tapped level. The desk's own choices stay `DIR` (2-candle turns, a level's
    life 60 candles, 10 candles from tap to break) and the opposite structure at the tap.
  - **Gold plan: the H4 break reads an A / V level of the closes** (21 Nov 2026, same check): `snrSides` confirmed a Daily
    rejection by a close beyond the last H4 swing of the WICKS; it is the last H4 A level (V for a sell), a turn of the
    closes, like every level on these desks; mark "H4 A level · BO buy". On gold 2020-25 after costs: in sample -0.047R
    -> -0.050R a trade (n 1,452), out of sample +0.073R -> +0.058R (n 780, trade t 0.91): nothing changes in `desk-rigor`.
  - **Mosha sequence: no entry once the target was reached** (21 Nov 2026, same check): `msMosha` took an EG after price had
    already traded to the VR's extreme (the target) and come back; that move is done (`vr-broken`, repeat the SOP). Gold
    2025: 266 -> 249 sequence entries, the 17 dropped summed +0.14R, so the record barely moves.
  - **LIT desk: each execution is its own stream** (21 Nov 2026, same check): `litTrades` recorded a sweep under the FIRST
    execution that filled, so "market on the break" held only sweeps whose limit orders later did not fill (the look-ahead
    by selection `desk-slices` T3 named). Now every sweep is tried with every execution (`rule`, `loose`, `break`), one
    position at a time per execution and market; `first: true` is the old reading, used only by the desk-slices study.
  - **Barrier entry: the confirmation starts when price is AT the barrier** (21 Nov 2026, found on a chart): the zone's
    `touch` is the OPEN time of the barrier-timeframe candle that came back (an H4 candle for an H4 barrier), and the QM was
    looked for from that time, so a QM that closed hours before price reached the barrier inside that candle was taken
    (knowing the candle would touch: look-ahead). The return is now the first of the finest candles that trades into the
    zone, and the confirmation is read from the candle holding that moment. Gold 2025, D1 / H4 / H1 barriers: 460 -> 462
    entries, 23 changed, +4.0R -> +18.0R before costs.
  - **Independent audit of the Mosha replay** (21 Nov 2026, a separate read-only review; three confirmed defects fixed):
    (1) a sequence entry is recorded only AT the candle whose close is its EG (`M.trade.fillT !== L[i].time`): the
    1,500-candle window slides, so a later look could re-read an old stretch and record an entry days after the fact (one
    such row was +20.95R on the test market); (2) `msMosha`: a wick back to the VR's extreme between the VR and the CF also
    ends the move (`xHit`), not only a candle after the CF; (3) `zonesOf` lists breaks by time, so a zone belongs to the
    EARLIEST break of its origin candle and a later BO never makes a visited barrier fresh again. Test: "no hindsight"
    (unaligned cuts, three markets, every full-replay entry must exist when cut just after it). Gold 2025 before costs:
    sequence 249 -> 231 entries, -15.7R -> -5.4R; barriers 462 -> 466, +18.0R -> +30.0R.
  - **Independent audit of the Engulfing / MSNR / LIT trackers** (21 Nov 2026, a second read-only review; each confirmed
    defect fixed and pinned by an "audit:" test in `tests/edge-desks.test.mjs` that fails on the code before):
    (1) LIT: a trade still running on the last candle read was booked "day end" and frozen (the study's management calls
    the last candle the day's end): it is open now; (2) MSNR on 5-decimal markets: the failed study's code rounds stops and
    exits to 3 decimals (written for gold), so every forex stop sat on a 0.001 grid and "target" trades booked odd R; the
    desk now works the stop and the result out itself at full precision (`msnrSim`); **every MSNR figure on a forex pair
    before this is wrong, `desk-rigor` R6 on EUR/USD and GBP/USD included**; (3) LIT "market on the break" entered up to
    20 minutes before the M15 sweep was confirmed: the entry is the later of the candle after the break and the candle
    that closes with the confirmation (`mk`); (4) a LIT limit's fill candle that also reaches the stop is stopped; (5)
    `egTrades` reads signals from `EG.life + EG.hold` candles before the window, so a daily order placed earlier still
    fills and closes (its record stayed open for good) and a zone keeps its one order at the window's edge; (6) the gold
    plan books in the order of the FILLS (a signal was dropped because an earlier signal's limit would fill later); (7) a
    candle that opens beyond the stop exits at its open, worse than -1R (`egOutcome`, `outcome`, the Mosha `outcome`);
    (8) `snrSides`: the H4 candle must TAKE the level (the one before had not closed beyond it); (9) a method trade's 30
    pips scale from its own entry price, not the newest price (a stop changed between two reads). Direction: a zone tapped
    just before the working chart's BO the other way now counts (`q.opp`: a BO the other way at the tap or after it), and a
    switch's zone is marked from when it was known (`known`). Left: `merge`'s 20-minute near-duplicate rule; the LIT and
    MSNR size scale still reads the newest price; engulf life and hold are calendar time (as the live rule).
  - **Third independent audit: the store and the chart** (21 Nov 2026). The store held up (closed records frozen, no
    record lost or stuck on the Engulfing and LIT desks over 1,235 rolling runs; tiles, calendar and filters equal the
    records). Fixed: (1) **a desk trade's chart shows the trade as BOOKED** (`spec.stored`, `how` = the stored status):
    the chart used to work a second result out from the first stop and target, so a trailing-stop win read "neither stop nor
    target", a time exit "stop touched", a stored loss on a limit's fill candle "target reached"; now "filled …, trailing
    stop … (+1.07R)". The owner's own log and the examples are still worked out on the candles. (2) **Before** ends at the
    last candle CLOSED at the entry (it drew the fill candle and sometimes the exit), shows the planned entry / stop /
    target and the marks known by then (`nowOf`), and its line says nothing of the result. (3) **Play** stopped at once on
    the LIT, Engulfing and MSNR dialogs (it tested the Mosha view): it follows the card. (4) `merge` `near()` dropped a real
    re-entry within 20 minutes of a closed trade (3 of about 270 MSNR records): only a record at the same price while the
    stored one has not ended is the same trade. (5) the one unescaped record field on the desk rows. Known, left: a
    `--days` backfill of barriers is not exactly what the loop would have recorded (zones read the whole history given); an
    open record the run no longer reads stays open (not seen in practice: the longest ran 5.8 days of a 14-day window).
  - **A stop does not change between two reads** (21 Nov 2026): on a market other than gold the LIT buffer and the MSNR
    buffer / smallest stop scaled from the NEWEST candle's price, so a later read gave the same trade another stop (an open
    record's stop moved; a rebuild differed from the loop). They scale from the trade's own price now (LIT: the sweep's
    extreme, `stopExtra(atr5, px)`; MSNR: the entry, the study's candidates listed with `PAD` / `MIN_R0` 0 and both applied
    in `msnrTrades`). Gold is unchanged; stored closed records are frozen as booked. Test in `tests/edge-desks.test.mjs`.
  - **An open record the run no longer reads is settled** (21 Nov 2026): `council/mosha-desk.mjs` `settle(records, freshIds,
    M5, market, feed)`, run after `merge` by both trackers: an OPEN stored record of the market just read that the run did not
    give again (a slid window, a moved id) is closed on the 5-minute candles after its entry at its STORED stop and target
    (stop first in one candle, a gap at the open), marked `settled: true` with a log line; neither reached = still open.
    Never a record the run read, of another feed or market, or from before the candles on file. It stayed open for good
    before. A plain settlement: it does not apply a reading's trail or time exit. Test in `tests/mosha-tracker.test.mjs`.
  - **The documents checked page by page by an independent reader** (21 Nov 2026, owner: "make sure everything you understand
    from the documents, and how to apply"; every page image read against the code). Fixed, each with a test: (1) **Mosha
    sequence: a CF inside the VR is the method's "likely to fail" case**: `sopTrades` records no entry (`case === 2`; `o.case2`
    brings them back for research only); (2) **plan / short method: a FAILED opposite H4 zone is a zone too** (`h4Zone`, as the
    gold plan already read it), mark "H4 EF (zone failed)"; (3) **the trigger is a 15- OR a 30-minute engulf** (`triggers`,
    `m30of`: 30-minute candles from the 15-minute ones; plan, short method and gold plan; a gold-plan record on M30 has id
    suffix `-30` and `l: '30m'`); (4) **direct entry: "inside" is wholly inside** the zone above (an overlap was enough);
    (5) **exits are the stop or the target** on the three engulf methods and the gold plan (the 24-hour exit was the desk's),
    and the gold plan has no one-at-a-time rule (its own limit is 2 a day). Left and said to the owner (need the teacher's
    or the owner's wording, or are the owner's own earlier choices): the sequence's EG entry, $0.30 stop and VR-extreme target
    (owner, 12 Nov: "i want eg as entry"); the 50% pullback not required (owner, 13 Nov); a QM required for the VR and CF (the
    page can also be read "preferred"); the barrier entry at the broken LEVEL (the pictures suggest the origin zone of the
    confirming leg); the second-BO barrier entry (not coded); VR and CF boxes as barriers and barriers against the direction
    "only give a rejection" (every barrier gets 3R); internal breakouts traded with the same sequence; the sequence's ladder
    below H1 (the pages keep direction on Daily / H4 / H1); "strong" H4 BO in the gold plan undefined; trailing the direct
    entry's stop with the M5 EF. The direction procedure is on no page (it is the direction skill's text, checked earlier).
    `research/edge/desk-rigor` was run on the code BEFORE these five changes: its result stands as the record of that code.
  - **Barriers with and against the direction** (21 Nov 2026, the pages: a barrier with the direction runs, one against it
    "only gives a rejection"): `barrierTrades` reads the structure of the timeframe above the barrier's (`UP`: D1 over H4, H4
    over H1, H1 over M15; none for a D1 barrier; `dirAt`, candles closed when price came back) and records `withDir`
    (true / false; kept by `clean`), names it in the label ("· with H4" / "· against H4") and the log; the desk's rows say so
    and "By entry type" lists the two apart. Entry, stop and the 3R target are unchanged (the method gives no other target).
  - **The CF as a barrier** (21 Nov 2026, the pages give the sequence's entry as the BARRIER entry "before or after the CF"; the
    EG entry stays as the owner's own choice of 12 Nov): `sopTrades(…, { cfOut })` hands over each clean CF zone (never a CF
    inside the VR) once, at the candle that first shows it; `barrierTrades(…, { extra })` reads it like any barrier (return on
    the finest candles, a QM on the table's confirmation timeframe, the pullback limit at the broken level, stop past the
    extreme made there). Only CF zones on H4, H1 and M15 have a confirmation timeframe in the table. Target: the VR's extreme
    when it is 1R or more away on the winning side (the sequence's own target), else the replay's 3R. Record: `kind: 'barrier'`,
    id `bar-cf-<tf>-<fill>`, label "H1 CF barrier · H4 BO". Without `extra` nothing changes (`desk-rigor` passes none).
  - **A desk trade's chart stays readable** (21 Nov 2026, `assets/mosha-replay.js`, display only): the window opens before the
    first mark made in the 36 hours before the entry (an older Daily / H4 mark is drawn from the left edge, it no longer zooms
    the chart out six days); a mark more than half the candles' range away from them is kept out of the price scale (`setTf`)
    and named at the top or bottom edge with its prices ("▲ Daily EF zone 4103.52 – 4141.60"); a small zone's label sits to
    its left; no tag is drawn over another (`placed`, 20 px steps). Test: `tests/mosha-replay.test.mjs`.
  - **A limit's fill candle: only the stop counts** (21 Nov 2026, found on the charts). `egOutcome` (`council/edge-desks.mjs`),
    `outcome` (`council/eg-methods.mjs`) and the Mosha barrier (`assets/mosha-sop.js` `outcome(tr, bars, after, limit)`) counted
    the fill candle's favourable extreme toward the target, the best-so-far and the trail, though it may have come BEFORE the
    fill. Now that candle can only stop the trade (the worst case). On the 2026 paper record: engulf plan +112.7R → −106.3R
    (804 trades), simple +61.1R → −104.9R, direct +4.0R → −20.0R, H1 engulf +118.0R → +82.1R, H4 +21.3R → +5.5R, MSNR gold
    plan −28.0R → −52.0R; LIT already refused such a candle. `desk-rigor` was run again (RESULT.md "After the result": every
    limit reading worse, no verdict changed); `desk-slices` T1 / T2 (the engulf reading) were measured with the flaw and failed
    anyway. Every desk total before this fix was flattered: never quote one.
  - **Every page rule applied, second pass** (21 Nov 2026, owner: "apply the edge to the detail", "recheck all the documents"; a
    read-only page-by-page recheck found nothing that contradicts a page). Mosha (`assets/mosha-sop.js`): the **Janda** entry (after
    the QM at a barrier, the next normal BO the same way, limit at its level; `bar-j-…`, "· Janda"; H4 / H1 barriers also on M1,
    "· Janda (M1)"), the **VR box as a barrier** (handed over with its clean CF, target the CF zone's near side when 1R or more, else
    3R), **internal BOs run the whole sequence** (`sop-i-…`, `o.ibo: false` turns it off), a CF is handed over only on the candle that
    made it and never after it failed or the VR extreme was reached, and a CF barrier takes no entry once price reached the VR extreme.
    Gold plan (`council/eg-methods.mjs`): the **second entry type, a QM** on M15 / M30 (`qmSetups`, kind `msnr-qm`; the shape is read
    from a sketch, `QM.wait` 20 candles is the desk's), Daily **open-close levels** (two same-colour candles) in `snrSides` and as
    kind `oc` in `direction()`. Direct entry: **no target, the stop trails** to the far edge of each failed opposite M5 zone
    (`efTrail`, status `trail`, `stopNow`; `clean` keeps `stopNow` and a null target, which it used to store as 0; `settle` settles at
    `stopNow`). Not coded, owner / Luxus questions: entry at the broken level vs the confirming leg's origin zone; a target for a
    barrier against the direction ("only a rejection", no size); the M30 steps of the ladder; the repeat of the SOP inside the CF and
    trading a failed CF; QM required vs preferred; "strong" H4 BO; "the best barrier".
  - **The owner's four readings** (21 Nov 2026, after comparing the desk with his five example trades; owner chose each): (1) every
    simple-QM barrier is recorded twice, at the broken level and at the zone's near side ("· at the zone", id `-z-`); (2) H4 and
    M15 barriers are also confirmed on M5 ("· M5 confirm", `-m5-`, `M5_ALT`); (3) a swept swing (3 a side; the first candle beyond
    it closes back inside) is a barrier from the level to the wick ("sweep barrier", `sw-`, `sweepsOf`), and a zone is used again on
    each later visit (left by a closed candle wholly outside, not broken; "· second visit", `-v<n>-`); (4) the desk's VR runs from the
    extreme to the nearest internal swing confirmed by then (`msMosha(…, o)` `o.near`, the desk's default; the charts' layer keeps the
    old box). The older BARRIER readings are unchanged (pinned by hash on the code before them, `near: false`, no CF / VR hand-over); the sequence, CF and VR barriers do change with the nearest-swing VR, which is the desk's default (review, 21 Nov 2026); a new reading is deduplicated only against its own kind, and `merge`'s
    near-duplicate rule applies only within one reading. Of the five examples, 2 Nov buy and 2 Nov sell are now caught; 10 Nov is
    found at his level but entered earlier; 28 Oct (an M5 box at the pullback's spike) and 29 Oct (an M5 break zone) are not. The
    record is about four times larger (30 days: 3,136 records, 4.7 MB); `KEEP` 14000 now holds about four months.
  - **Review of the second pass** (21 Nov 2026, independent read-only review; each fix has a test that failed first): (1) `settle`
    applied a trailed stop from the fill on: a record now carries `stopAt` (when the trail moved; `clean` keeps it) and `settle` uses
    `stopNow` only from that candle (without it, the opening stop); (2) `qmSetups` gave the same QM twice when two heads sat under one
    shoulder and break (the copy took one of the gold plan's two slots a day): one per tf / side / shoulder / break; (3) a limit placed
    before the 5-minute candles on file filled at their first candle: skipped; (4) the plan's hour and the gold plan's two hours are
    clock time (they counted candles, so a window ran over the daily break or a weekend); (5) a stop that gapped books worse than −1R
    and the log now says so.
  - **Review of the Mosha readings** (21 Nov 2026, independent read-only review): an M1 Janda of an H1 / H4 barrier gave exactly
    the order of the M15 barrier's own Janda (same side, entry, stop, fill minute) and both were stored, each −1R counted twice: an
    M1 Janda is a reading of its own now (`isNew`), dropped when it repeats an order; a barrier id carries its side before the fill
    time (`…-b<time>` / `…-s<time>`), since a buy and a sell can fill in one minute and the store kept only one.
  - **Settling reads the fill's candle** (21 Nov 2026): `settle` starts at the 5-minute candle that holds the fill, which can only stop
    the trade; `endT` is that candle's open. After-costs figures were added and taken out the same day (owner: "forget the costs").
  - **The desk files are light** (21 Nov 2026; mosha/desk.json had reached 20 MB, three quarters of it logs and chart marks):
    `council/desk-store.mjs` `writeDesk` writes `<desk>/desk.json` WITHOUT `log` / `marks` (+ `detail: { dir, by: 'day' }`) and
    `<desk>/detail/<YYYY-MM-DD>.json` = `{ <id>: { log, marks } }` by the UTC day of the entry (written only when it changes; a
    day no record points at is removed AFTER desk.json is written); `readDesk` joins them back for the trackers (a desk.json or
    day file that does not parse stops the run; an older desk.json with logs inside is read as it is). The page reads the light
    file and one day file only when a trade's Log or Chart is opened (`MS_MOSHA_SOP.withDetail`; "Reading the log…", and "could
    not be read" when the day file fails). Never publish a light file to council-data while main's trackers predate the store
    (they would read it as records without logs and write them back so).
  - **Exits tested on the desks' own trades** (21 Nov 2026, owner: "check how will look if u target 1/2/3 rr or tralling stop on
    all edges"; `research/edge/desk-exits/`, PREREGISTRATION.md committed first; `run.mjs fetch|run <dir>`). 30,904 closed 2026
    records of the four desks, each run alone on OANDA 5m from its own fill and opening stop with a 1R / 2R / 3R target or a
    trailing stop 1R behind the best price from +1R (5-day cap), against the booked R; before and after the desk-rigor costs;
    paired month t, Holm over 60. **1 of 60 better on the bar**: Engulf short method with the trailing stop, −0.156 -> −0.060R a
    trade after costs (t 3.42), STILL A LOSS. The trailing stop is the least bad exit on most losing groups (Engulf plan, MSNR,
    LIT loose); 1R targets are the worst almost everywhere; no exit makes a losing group profitable after costs. The comparison
    with the booked R also carries harness differences (5m fills, the 5-day cap). In sample: no exit is changed on any desk.
  - **Half at +1R, the rest left to run** (21 Nov 2026, owner: "plenty of them could be winner", "yes"; `research/edge/desk-partial/`,
    PREREGISTRATION.md first, amended before any result when the EG rule changed). PT = half closed at +1R, the rest trailed 1R behind
    the best price from the entry; P3 = half at +1R, the rest to 3R with its stop at the entry. Stage A (the desks' 2026 records,
    descriptive) and stage B (the desks' code on gold, EUR/USD, GBP/USD 2020-2025, 116,330 trades, out of sample 2024-2025, after
    the desk-rigor costs). **FAIL, 0 of 30**: no group is profitable out of sample with either exit, and neither beats the desk's
    own exit on the bar. Out of sample every group loses after costs whatever the exit; the plain trailing stop is the least bad
    on most. Stage B's Mosha sequence ran before the owner's 21 Nov "M15 turned sell / sell the VR retest" change.
  - **EG = a close beyond the opposite candle's HIGH (buy) / LOW (sell)** (21 Nov 2026, owner: "u marking the eg wrong", chose
    "close above the HIGH"): `council/eg-methods.mjs` `zones` (it was a body engulf, a close beyond the other's open). Affects the
    Engulf plan / short method / direct entry, the MSNR gold plan and the direction's Daily EG levels. The stored desk records
    from before it are as booked under the old rule until the histories are rebuilt.
  - **A turned chart sells the VR retest** (21 Nov 2026, owner on two EUR/USD buys: "this should be a sell"; chose "Both", "the
    last low", "the top of vr or entry on new cf made once touch and cf box high is the sl"): in `sopTrades`, once the chart
    under the BO has its newest internal break (3 candles a side) the other way after the BO (`turnAt`, kept for that BO; read
    whatever `ibo` says) and price has gone 1R (VR top to level) past the VR level (armed: a normal pullback also breaks small
    swings, so the turn alone stops nothing), the BO gives no more entries; instead the VR level is traded the other way when
    price comes back: entry A at the level, stop past the VR's top (`sop-vr-`), or entry B on a new CF (BO Structure) after the
    touch, stop past that CF box (`sop-vc-`); target the last low before the touch (high for a buy). A close past the VR's top
    ends it. No minimum R (not answered). `retest: false` turns it off. EUR/USD 20 Nov: the 13:20 buy is gone, a sell at
    1.09914 (stop 1.1011, target 1.09569) instead. Not tested: a reading, not an edge.
  - **The Mosha desk keeps gold, EUR/USD and GBP/USD** (21 Nov 2026, owner: "mosha keep gold and eurusd and gbpusd"):
    `MS_MOSHA_SOP.MOSHA` (`MARKETS` stays the Engulfing desk's five); the tracker reads `OTHER` = EUR/USD and GBP/USD and drops
    every other market's records before it writes (`keepMarkets`); the card shows only those three markets. Silver and the Nasdaq 100
    records (about 5,300 in the 21 Nov rebuild) leave the file on the first run of the merged code.
  - **Plan / short method: the failed M5 zone must be at the zone** (21 Nov 2026, owner on a EUR/USD plan buy of 17 Nov: "stupid
    loss, there is no eg sell fail on m5 to enter buy"; its "M5 EF" was a 1.4-pip sell engulf above the H4 and M15 zones, the
    engulfing skill: "the EF that counts = the close through the last opposite engulf formed into or at the zone"): in
    `methodTrades` the opposite M5 zone that fails must touch the H4 zone or the M15 / M30 engulf zone (`atZone`). On the 2026
    record (five markets, before costs): plan 998 -> 714 trades, -40.9R -> -13.9R; short method 966 -> 692, -86.6R -> -22.9R.
    Still losing; a reading, not an edge.
  - **An EF counts like an EG, on the MSNR gold plan** (21 Nov 2026, owner: "the fail is the same logic as entry for other
    timeframes", chose "EF counts like an EG"; then "keep the msnr"): `triggers(M15, true)` (the gold plan only) adds the opposite
    15- / 30-minute zones that FAILED as triggers the other way (`efsOf`, `ef: true`, from the close that broke them, their own box
    as the zone; `zones` keeps the fail candle `fi`; id suffix `-ef`, mark "M15 EF zone · entry"). Tried on the Engulfing plan and
    short method too (EF triggers and M5 EF entries): plan 714 -> 1,373 trades, -13.9R -> -159.9R; short method 692 -> 1,278,
    -22.9R -> -92.6R, so they keep EG triggers. Gold plan 2026 before costs: 233 -> 299 trades, -11.0R -> +13.0R (EF triggers
    133 trades, +19.0R). A paper reading, not an edge.
- Tests: `tests/mosha-desk.test.mjs` (permissions, the stop rule, R on the server, `pre`, the locks, statistics, the candle check,
  CSV, page wiring, the studies' figures). The page smoke test opens `#mosha`.
- **Graphite look** (16-17 Nov 2026, `docs/design/aureum-theme.md`; the owner rejected black-and-gold for graphite grey): display
  only, in `<style id="ms-mosha-css">`. `html` defines `--mo-*` aliases (each reads an `--au-*` token, falling back to the
  page's older variable), and `#v-mosha, .mo-tut, .mo-lv-dlg, .mo-l-dlg` point the older names the rules use (`--panel`,
  `--ink*`, `--line*`, `--accent`, `--gold*`, `--buy` / `--sell`, `--sans`) at them, so the desk and its three dialogs follow the
  tokens with no rule rewritten; the desk's old gold marks (`--mo-gold`) are the steel-blue accent. Generic card, title and
  button rules sit EARLY in the block (later, more specific rules such as the green "That is right" must still win); the
  "last word" rules sit just before the light-theme `--buy` / `--sell` line (kept: it is AA and pinned). One primary button a
  view ("Send to the desk"; the guide's tutorial button is secondary). Markup, ids, gates (`#mo-rules`, `#mo-cycle`, `#mo-lux`
  hidden for the teacher) and the French dictionary unchanged.

## Desk load: one request per file, late loading (11 Nov 2026)
Owner request: the Desk (`market-structure.html`) should load faster and steadier. Measured with Playwright on a phone profile
(390 px, DPR 3, CPU 4x) against a local server that streams like a slow connection (one shared 1.6 Mbps link, 150 ms before
each answer, brotli sizes; council-data and candles replayed from disk), median of 3 loads, before → after:

| | Guest (sign-in card) | Owner (home) |
|---|---|---|
| Requests in the first 20 s | 116 → 16 | 126 → 126 |
| Council-data files asked twice | trades.json x2, snapshot.json x3 → none | none → none |
| Bytes on the wire | 1,800 → 1,045 KB | 1,561 → 1,562 KB |
| Council-data | 8 requests, 739 KB → 3, 472 KB | 19, 552 KB → the same |
| First paint | 1.21 → 1.13 s | 1.18 → 1.12 s |
| First useful content | proof line 7.9 → 3.3 s | Today strip with real numbers 6.5 → 4.3 s |
| Layout shift (CLS) | 0.086 → 0.001 | 0.088 (one run 0.197) → 0.063 |
| Long tasks | 19, 2.9 s → 9, 1.2 s | 12, 1.6 s → 11, 1.6 s |

What was done, and the rules to keep:
- **`window.msData`** (head script, between the `ms-data` markers; `msData.json(file)`, `.text(file)`, `{ fresh }`): every reader
  of council-data on the Desk asks through it, so a file is one request per load (the sign-in card, the council, the ICT strip
  and desk, the macro pane, the scoreboard and the week report each had their own fetch and cache-buster). A request in flight
  is shared; a finished one is reused for 45 s (so every refresh timer on the page, 1 to 10 minutes, still reads new data);
  `ict/replay.json` (written once a day, 2 MB) for 10 minutes; `{ fresh: 0 }` always reads again (the ICT desk's own files);
  a failed read is never reused; each caller gets its own parsed copy. A visitor who is not signed in gets `null` without a
  request for anything outside the guest list (the same list as `GUEST_OK` in `api/data.js`; a test compares them).
  **Never add a direct `fetch` of a council-data file to the page**: the test lists the four left (files nobody else reads).
- **Early requests** (`msData.warm`, a small script at the top of the body): trades and snapshot for the sign-in card; those
  two plus the system replay and research.json otherwise. `loadCouncil` picks them up and, on the first load only, draws the
  home strip and open positions (`renderActive`) from those four before the other ten files are in (`COUNCIL.early`); the full
  council render follows when every file is, and later refreshes swap the whole set at once as before.
- **The app sleeps under the first-load sign-in card** (`window.msBootGate`: a promise while `html[data-gate]` was set at load).
  Leaving that card always reloads the page (sign-in, "Continue as guest", `/api/me` finding a session; the close button and
  Escape only exist once the guest view was chosen), so `boot()` (candles, streams, the scanner), `loadCouncil` and `mdQuotes`
  wait for it: 100 requests and half the main-thread work of that load were for a page nobody saw. If a way to close that card
  without a reload is ever added, the promise resolves and everything starts.
- **The sign-in card**: its script sits right under its markup (it was 1.3 MB further down); the three proof boxes are in the
  page from the first paint (hidden only when nothing could be read); the open trades and last signal come from the shared
  trades / snapshot requests; the ICT replay line is read last, after `load` and in idle time (`later(ictProof)`).
- **`scripts/hoist-styles.mjs`** (build step, right after the pages are copied): the 25 `<style>` blocks in the Desk's body
  (233 KB) go to the end of the head in the built page, order kept, so the cascade is the same and the first screen is drawn
  once with all its rules (the sign-in card used to change height by 230 px when `#ms-gate3-css` arrived). The page source is
  untouched: keep writing a feature's style block next to its markup, and never rely on a body style arriving late.
- **The charting library's script tag** is in the body, right before the app script (with its CDN fallback line), not in the
  head: it no longer blocks the first paint. No preload for it and no data request from the head: both took bandwidth from the
  styles of the first paint (measured: first paint 1.2 → 1.6-1.9 s).
- **Home holds its place**: a small script after `#h-mk` draws the empty market cards and the date line at once (the app
  script drew them seconds later and pushed the page down; the count, 10, is checked against `INSTRUMENTS`), and on phones the
  headline keeps two lines (`min-height: 2lh`).
- Not changed, measured: the page itself is 1.55 MB (400 KB compressed), a quarter of it CSS and about 150 KB compressed the
  app script, which the browser still parses under the sign-in card; the five Mosha scripts (65 KB compressed) load for every
  visitor; fonts swap at about 1.5 s on this profile (a 0.04 shift on the owner's home); candles are 90 requests, 470 KB.
  Open for the writers' owners: a slim companion to `ict/replay.json` without the 72-candle `path` arrays (the sign-in card
  needs `totals` only, the scoreboard and week report no paths), which also needs a `GUEST_OK` entry. ETag / 304 answers
  from `/cdata`: done 12 Nov 2026 (section "/cdata conditional answers").
- Tests: `tests/desk-load.test.mjs` (the helper with a fake fetch and clock, the build step, the wiring). The page smoke test
  fails when the Desk asks for a council-data file twice during a load or a signed-out visitor asks for a file outside the
  guest list, and has a fourth run, "phone, guest" (`ms-guest` set), since the sign-in card alone no longer runs the app.

## /cdata conditional answers (12 Nov 2026)
`api/data.js` answers conditional requests. Every 200 carries a strong `ETag` = `"<variant>-<sha256 of the exact bytes sent,
base64url, 32 chars>"` (`etagOf`), variant `c` for the guest cut and `f` for a whole file (a member's copy of a guest file, a
protected file, `mt5/signals.csv`), so a visitor's and a member's ETag for the same file can never be equal, even if the bytes
were. `If-None-Match` (a list, `W/` prefixes and `*` accepted, the weak comparison of RFC 9110) that matches the ETag of what
would be sent NOW gets `304` with no body and exactly the 200's headers (Cache-Control, Vary, CORS, Content-Type, ETag). The
decision is made after the session check and the cut, so a member holding a visitor's ETag (or a visitor holding a member's,
or the member mark without a valid session) never matches and gets the full answer of its own variant; errors (401, 404, 502,
503) carry no ETag. No byte a visitor or a member receives changed, and no Cache-Control / Vary / CORS rule changed. HEAD gets
the same headers. The broker bridges send no `If-None-Match` and get the csv as before. Note: the Desk's `msData` fetches with
`cache: 'no-store'` and a per-minute `?v=`, and member answers are `private, no-store`, so the page itself does not revalidate
yet; the gain is for clients that do (a browser's normal cache on a visitor's public answer, scripts). Making `msData`
revalidate is a separate page change. Tests: `tests/cdata-etag.test.mjs`.

## Gold playbook study: the weekly-bull daily rejection long, out of its own sample (11 Nov 2026, owner: "keep improving and follow our strategy and learn more about it")
`research/edge/gold-drd-long/` (PREREGISTRATION.md pushed first, then `run.mjs`, RESULT.md, result.json). The gold playbook
skill's best edge (weekly structure bullish + a 17:00 New York day closing above the previous low in the top 30% of its range
→ buy the next open, stop $0.30 under its low, 3R, 10 days) was found on November 2022 to October 2026 only. Tested on OANDA mid
H1 gold March 2006 to October 2022, net of $0.35, against the same trade on every bullish-week day. The code reproduces the
skill's window (294 trades, PF 2.17 vs its 271 / 2.20). **Verdict: FAIL**: out of sample +0.141R a trade, PF 1.22 (n 910),
profitable in 2006-19 and 2020-22, but lift over the baseline +0.10R, t 1.58 (bar t >= 2); worst drawdown -77R; it follows
gold's trend year by year (losing 2012-15, 2017-19, 2021). The mirror short has no edge. Not an edge of its own; the `#gold`
view's wording stays the skill's; nothing live changed. Tests: `tests/gold-drd-long.test.mjs`.

## Gold playbook study 2: the Daily-regime filter on that long (12 Nov 2026, owner: "Keep improve")
`research/edge/gold-drd-er/` (PREREGISTRATION.md pushed first; `run.mjs` imports gold-drd-long's rule, trade and statistics
unchanged). The one follow-up gold-drd-long named: skip the signal when the 20-day efficiency ratio of the 17:00 New York daily
closes (up to and including the signal day) is under 0.2. **Verdict: FAIL**: on 2006 to October 2022 the trending-Daily signals
made +0.139R a trade more than the choppy ones, Welch t 1.29 (bar t >= 2), and the difference reversed in 2020-22 (-0.10R) and
is flat in the skill's window. The other two checks passed: filtered PF 1.33 / 1.35 in both halves, worst drawdown -30.9R against
-77.4R (496 of 910 trades kept). A risk tool on this rule at most, not a better selection; not a council rule, nothing live
changed. ER >= 0.3 and the signed ER looked better but were chosen after the fact: their own pre-registration on other data or
nothing. Tests: `tests/gold-drd-er.test.mjs`.

## Gold playbook study 3: that long and its two cuts on silver (12 Nov 2026, owner: "Keep improving")
`research/edge/gold-drd-silver/` (PREREGISTRATION.md pushed first; imports gold-drd-long's days / weeks / statistics and
gold-drd-er's ER; buffer $0.004 and cost $0.03 scaled for silver). The two cuts gold-drd-er found after the fact (ER20 >= 0.3, and
ER20 >= 0.2 with the close up over 20 days) tested on a market they were not chosen on, OANDA mid H1 XAG 2006 to Nov 2026.
**Verdict: PASS on the pre-registered bar, and not robust**: T1 every signal +0.097R (n 1,146, PF 1.14), T2 ER >= 0.3 +0.176R
(n 450, PF 1.28, -49R worst drawdown against -107R), T3 signed +0.186R (n 531, PF 1.29), all PF > 1 in both halves, Holm p
0.018-0.029. But t counts overlapping trades as independent: on monthly sums t is 1.15-1.43, and without 2025 each stream is
about +0.04 to +0.10R with t near 1. Evidence the cuts are not pure curve-fit, not a proven edge; not a council rule, nothing live
changed. A next test would hold one position at a time on gold and silver together, judged on monthly sums, with its own
pre-registration. Tests: `tests/gold-drd-silver.test.mjs`.

## Gold playbook study 4: the two cuts on platinum and palladium (15 Nov 2026, the stop hook's "keep working")
`research/edge/gold-drd-pgm/` (PREREGISTRATION.md pushed first; imports gold-drd-long / -er / -silver unchanged; costs 0.30 %
of price on platinum and 0.20 % on palladium, the repository's figures; buffer 0.01 % of the signal day's low). Silver's lesson
built in: the bar is the t of calendar-month sums (plus PF > 1 in both halves, > 0 at 2x costs and without the best year).
**Verdict: FAIL, 0 of 4**: platinum T2 -0.164R (n 408, month t -1.50), T3 -0.183R (n 481, -1.88); palladium T2 +0.024R
(n 402, +0.19), T3 +0.092R (n 525, +0.81, Holm p 0.84). Reported only: palladium every signal +0.162R (n 1,120, month t +2.06),
mostly its 2016-20 rally. The cuts do not travel; do not test them on another market. Nothing live changed. Tests:
`tests/gold-drd-pgm.test.mjs`.

## Mosha cycle: a main paper system (11 Nov 2026, owner: "H4 move, H1 ChoCh tells pullback or retracement started, M15 / M5 to entry and target H4 or H1 … the ai should trade with the bot"; chose "main system")
`council/mosha-cycle.mjs` (pure: `cycleState`, `cycleTrades`, `cycleText`) + the Trader block after Mosha BO (user rule
`mosha-cycle`, `config.moshaCycle`; records `k: 'mcycle'`, ids `xau-mcycle-<leg>-<H4 break time>`). Gold only. From the BO
events the Trader already builds (closed candles): the last H4 BO = the move (origin edge `far`, broken level), the first H1 BO
the other way after it = the H1 ChoCh, the pullback started; `ext` = the move's extreme on H1 candles up to that ChoCh.
Leg `pull`: the first M15 or M5 BO with the pullback after the ChoCh → limit at the broken level, stop $0.30 past its origin,
target the H4 50% (`p50`). Leg `main`: after it, the first M15 / M5 structure flip back with the H4 → same entry and stop
rules, target the H4 extreme `ext`. Valid 24 h, out after 72 h, no break-even; one open trade per leg. Shadow (`blockedBy`)
when the target is under 1R (`room`), the leg already has a trade (`cap`) or price is past the stop (`price`). Every trade has
a stop on the losing side (the function returns nothing without one). A main system: in `SYS_K` / `MAIN` / `SYSG` / `SYS_ON`
(page) and `api/_guestcut.js`, the Trader's `SYSK` and retire list; alerts, futures tickets and the council demo account take
it like any non-shadow trade. Not yet in the decay monitor, expectations or book weights (no base study). **Not a tested
edge**: the mechanical studies of this cycle (mosha-retrace, mosha-cycle) did not pass; the owner chose to trade it on paper
and judge its forward record. `snapshot.moshaCycle` → `#ms-rep-mcycle` under the Mosha BO chain line. Tests:
`tests/mosha-cycle.test.mjs`. Owner, 12 Nov 2026: keep it as a main paper system ("Yes to all"; docs/owner-decisions.md item 48).
12 Nov 2026: owner-shadowable like the others: `cycleBlockers(o, trades, price, ownerSh('mcycle'))` (pure, in mosha-cycle.mjs)
adds `'owner-shadow'` when `config.ownerShadow.mcycle` is set (none today: live records unchanged, pinned against the old
blockers); the one-per-leg cap and `snapshot.moshaCycle.open` count `ownStream`, not `!x.shadow`; a trade already open stays
live. The Analyst's "Live gold systems now" table has a "Mosha cycle" row (`tests/analyst-gold.test.mjs` now expects 9 systems).
**14 Nov 2026, owner decision 54 ("Make it a paper shadow"):** owner rule `mcycle-shadow` adds `mcycle` to `config.ownerShadow`, so its
new trades are paper shadows (`blockedBy ['owner-shadow']`, never alerted, no council demo copy); an open trade runs to its exit.
Why: both studies of the live code fail after costs (`research/edge/mcycle-base` 2020-26 −0.574R, n 115, t −3.99;
`research/edge/mcycle-oos` untouched 2007-19 −0.175R, n 244, t −1.50, break-even before costs). Undo: a rule deleting the key.
Test: `tests/mcycle-shadow.test.mjs`.

## Gold replica live again (20 Nov 2026, owner: "And mine replica shadow to live")
User rule `replica-live-again` (council/trader.mjs (the id `replica-live` was taken by an older rule), after `replica-mirror-gold-only`) removes `replica` from `config.ownerShadow`: the gold
replica's NEW trades are live paper trades again (alerted, main book, council demo account); its rule, stops, gates and
`config.replicaLive` are unchanged; trades opened as owner-shadow run to their exits. `replica-mirror-gold-only` stays (its forex and
crypto RESEARCH trades are still not copied). `council/decay.mjs` lists it live (`ownStream: true`, `liveAgain`), so its record stays
one stream (live, owner-shadow 11-20 Nov, live); `council/expect-base.json` `live: true`. Said to the owner: no out-of-sample edge
on record (replica-oos 2017-22 −0.05R, n 115; replica-sides FAIL). Undo: a user rule setting `ownerShadow.replica` again. Tests:
`tests/supported-book.test.mjs`, `tests/decay.test.mjs`, `tests/expect.test.mjs`, `tests/financing-rest.test.mjs`, `tests/replica-live.test.mjs`.

## Edge analyst: an AI second opinion on each live entry (11 Nov 2026, owner: "have an ai to study the trade decisions in the edge u can use the same of the academy"; chose "each entry, blind" and "an API key, automatic")
`api/_edge-analyst.js` (pure) + `api/edge-analyst.js` (endpoint), reusing the Academy's language-model adapter
(`api/_academy-llm.js`) and store (`api/_academy-store.js`, `blobBackend(env, { root })`; own folder `edge-analyst/`, preview
`edge-analyst-preview/`: `reviews.json` 400 rows, `state.json`, and the adapter's own `cost.json` / `llm-cache.json`).
- **Cron** `/api/edge-analyst?job=scan` every 10 min (`CRON_SECRET`): first puts closed results (`Rnet`, else `R`) beside
  earlier answers, then studies up to `PER_RUN` 3 new entries: live, non-shadow, not an add, of the seven edges (`EDGES`, keep
  in step with `council/decay.mjs`; trades.json + research.json `nq-open` with session `nyflip`), entered after the first run's
  `state.since` and within 3 days, never twice. A budget skip ends the run; a candle fetch failure is retried next run.
- **Blind, no look-ahead**: the request holds only `entryFacts` (system and rule in words, side, entry, the OPENING stop from
  `r0`, target, planned R:R, `feat` keys that are not outcome-like), OANDA mid candles D1 / H4 / H1 / M15 that ENDED at or
  before the entry (`cutCandles`), and releases 12 h before to 48 h after with consensus / previous only (`releasesAround`;
  never an actual). The answer is checked in code (`parseAnswer`: TAKE / REDUCE / SKIP, low / medium / high, 1-4 reasons);
  one that does not fit is stored as `refused`.
- **Read** `GET /api/edge-analyst`: owner or reviewer session; `{ enabled, reason, cost, since, rows (60), stats }`. `stats`:
  per verdict n / wins / R, taking every trade vs following the answer (SKIP 0, REDUCE ½); "Too few to judge" under
  `MIN_JUDGE` 20 closed; at 20+ "a forward comparison, not a tested edge". Card `#ms-ea` (`adm`) in the Council review pane,
  `<style id="ms-ea-css">` + `<script id="ms-ea-js">`.
- **Money**: a paid key, the owner's exception to absolute rule 5 (docs/owner-decisions.md item 47; owner, 12 Nov 2026: keep, "Yes to all"). Shares the provider
  settings (`ACADEMY_LLM_KEY`, `_URL`, `_MODEL`, `_FORMAT`); own budgets `EDGE_LLM_DAILY_USD` 0.50, `EDGE_LLM_MONTHLY_USD` 5,
  `EDGE_LLM_HARD_USD` 25, `EDGE_LLM_MAX_CALLS_DAY` 12; `EDGE_ANALYST=off` / `EDGE_LLM_STOP=1` stops it. No key = no call.
- **Output cap (17 Nov 2026)**: 900 -> `EDGE_LLM_MAX_TOKENS` (default 4000) through the adapter's `cap: 'feature'`: a model that
  always reasons spends output tokens on that first; an answer cut at the cap (stop `length`) is never cached and is stored as
  refused once (`LLM.cutAtCap`). Provider secrets and the reasoning effort (`ACADEMY_LLM_BODY`): docs/academy/LLM.md section 11.
- Paper only: it changes no rule, size, filter or trade, imports nothing of the council or the mirror (test), and no council
  member reads its file. Tests: `tests/edge-analyst.test.mjs`.
- **Money and safety review (12 Nov 2026)**, `tests/edge-analyst-money.test.mjs` (real adapter, fake provider / Blob / clock).
  Fixed: (1) `storeOf` made a new lock map per request, so two requests in one instance could interleave on `cost.json` and
  lose a reservation; one map per instance now (`TAILS`), as the store's rules say. (2) A call that may have been paid for but
  gave no usable answer (no text, a timeout, unreadable) was not stored and was paid for again every run; it is stored as
  `refused` now (an unbilled refusal is still tried next run). (3) With no `r0` / `stop0` the request fell back to the
  record's current `stop`: the NQ open-run records have neither and the Trader trails their stop, so a trailed stop could
  reach the model; `stopAtEntry` is null then (and when the stop is not on the losing side) and the entry is not studied.
  Known, not changed: the budget check is on the estimate (characters / 4), so a provider that counts more input tokens can
  take a day past its budget by that one call's difference; two INSTANCES writing `cost.json` at the same moment can still
  lose a reservation (the store's documented limit; the cron runs every 10 min with a 120 s limit); `ACADEMY_LLM_STOP=1` does
  not stop this feature (`llmEnv` replaces it; only `EDGE_ANALYST=off` / `EDGE_LLM_STOP=1` do).

## One feed per market (12 Nov 2026, plumbing fix, owner approved)
council-data 9-12 Nov: the Trader's gold / forex candle feed flipped OANDA -> Kraken -> OANDA for a few minutes at a time (189
switch events in the trade notes: gold 43, AUD/USD 35, USD/CAD 35, EUR/USD 31, GBP/USD 25, USD/CHF 20; 112 on 12 Nov alone; gold's 21
Kraken episodes lasted 3 minutes in the median, 24 at most). The 8 Nov hysteresis (`feedDecision`) fell to Kraken on the 2nd
missed read and went back on the 1st good one, and every switch re-based every open position's stop / target / 2R mark by a
one-minute basis between two feeds (`requoteMarket`): 914 re-base notes on 107 trades, 435 of them loosening the stop, 38 shadow
orders cancelled and 19 re-quotes; the 12 Nov Gold daily engulf took 18 re-bases (stop ended 3893.955 against the rule's 3895.27,
$1.32 looser) and its demo copy 18 amends; the H4 trendline's stop ended 4053.235 against 4054.72 while its broker stop sat at
4055.22. 100 demo copies of re-based trades took 727 amends. No stored trade was rewritten for this (20 open shadow records still
carry their old `feedBasis`). Now (`council/feed.mjs`, `council/trader.mjs`, `council/ctrader-mirror.mjs`):
- **Hysteresis both ways**: `FEED_MISSES` 3 missed reads in a row before a market leaves OANDA (the rounds in between skip the
  market, as before), `FEED_BACK` 3 good reads in a row before it returns (`state.feedOk`); a timeframe that does not answer is
  asked once more (1.5 s) before the round counts a miss. First round and crypto unchanged.
- **A record is managed only by its own feed's candles**: the manage loop skips `tr.feed !== FEED` (one line at its top; the
  lifted-loop tests in `fills-live`, `supported-book` and `one-feed` run it); retire-legacy too.
- **Held, not re-based**: while a market is on its fallback, records priced on the primary are HELD (`feedHeld`, one note per
  episode, `snapshot.feedHeld`): never filled, stopped, re-quoted, cancelled or re-based by the fallback; `checked` stays, so on the
  return the gap is read from OANDA itself.
- **Adoption = ONE offset that never loosens a stop**: a record priced on the fallback is adopted when the primary returns, and a
  primary record held over `ADOPT_AFTER_S` (6 h) is adopted by the fallback. The basis is measured on the record's OWN feed's last
  minute (`state.feedLastBy[key][feed]`), targets / 2R mark move by it, the stop (and `midStop`) only when that tightens it
  (`shiftStop`); logged in `feedMoves` and the note; `feedAdj { stop, t1 }` sums what offsets did. Pending orders: re-derived (geg)
  or cancelled on adoption only, as before.
- **Mirror**: `feedOnlyMove(t, m, tick)` = the council's levels differ from the copy's only by `feedAdj` since the copy: the copy
  takes the new numbers, `m.brokerShift` records the gap, nothing is sent to the broker. A real move (break-even, trail) is sent as
  before and clears the shift; `ctrader-reconcile.mjs` reads `brokerShift`.
- **Visible**: `state.feedSwitch` → `snapshot.feedSwitches[market] = { n, since, last24h, last7d, lastAt }` (`countSwitch`,
  `switchSummary`); `snapshot.feedChanges` keeps the per-switch log, now with `held`.
- Not changed, said: a gold trend daily ratchet or a geg zone cancel can still read the fallback's daily candle during an episode
  (both sha256-pinned blocks; a ratchet only tightens); the open shadow records' past re-bases stay; why the proxy misses reads
  (rate limit, a slow timeframe) was not traced, only absorbed. Tests: `tests/one-feed.test.mjs` (6), `tests/feed-hysteresis.test.mjs`,
  `tests/feed-requote.test.mjs`, `tests/ctrader-mirror.test.mjs` ("one feed").

## Gold daily engulf reads trading days (12 Nov 2026, owner approved fidelity fix, docs/owner-decisions.md item 52)
On 10 Nov 2026 the engulf (`geg`) took its zone from OANDA's Sunday 8 Nov daily candle, the ~2-hour stub between the 22:00 UTC
reopen and midnight (volume 18k against 400k+ on a weekday, range $19): stop about $21 away, stopped the same day
(`xau-geg-1794096000`). How the tested rules built their days: `research/edge/gold-systems` (2018-26 HistData) UTC weekdays with
Sunday folded into Monday; the robustness rebuild behind `council/decay-base.json` 17:00 New York days (no stub);
`research/edge/gold-systems-oos` (2006-26 OANDA, behind `expect-base.json`, supported-book, path-to-live) raw UTC days WITH the
stub, as live. The pre-registered `research/edge/gold-weekend` compared the two on 2006-26: engulf ADOPT the trading-day rule (not
worse, gain within noise), trend legs KEEP the raw days (the fold widens their ATR stop and is worse). So:
- `council/fills.mjs` `foldWeekend(bars)` (Saturday / Sunday candles into the next weekday: its time and close, the first weekend
  open, high / low over all; a trailing weekend candle belongs to the forming Monday and is left out; equal to the study's
  `replay-intended.mjs` fold, tested) and `gegFresh(dayTime, now)` (24 h from the reopen after the day: Mon-Thu the day end,
  Friday the Sunday 17:00 New York reopen; never while `spotClosed`). The engulf block reads
  `foldWeekend(src['1d'].bars.filter((b) => b.time + 86400 <= now))` and `gegFresh(last.time, now)`; `council/feed.mjs`
  `rederiveGeg` folds too (a Sunday-dated base is cancelled on a feed switch). Entry, stop, target, trail, hold, cap and zone
  cancel unchanged. On the real candles the 10 Nov signal becomes a Friday 6 Nov zone (4029.83-4107.09, stop 4029.53).
- **Gold trend / Gold trend fast are NOT changed** (still `slice(0, -1)` raw days; a test pins it). Other daily readers in the
  Trader (Mosha BO weekly, the trendline's MSNR direction, the momentum pullback's SMA) were not touched.
- `tests/supported-book.test.mjs` pins the engulf block with these two lines put back as well (the sha256 of the 11 Nov block).
  Holidays: `spotClosed` covers the weekend only, so after a weekday closure the window counts from the day end (the study's
  replay from the first quote): a handful of days a year. The forward bands (item 43) and "What to expect" stay on the raw-day
  engulf (within noise of each other). Test: `tests/geg-trading-days.test.mjs` (runs the Trader's own block on the real OANDA
  daily candles of that week, `tests/fixtures/xau-d1-oanda-2026-11.json`, the old block against the new).

## Shadow cut: the engine setups' shadow signals are no longer recorded (12 Nov 2026, owner: "filter the best shadows", "yes apply the cut when it's done")
`research/edge/shadow-best/` (PREREGISTRATION.md pushed first; `run.mjs` imports shadow-scalp-filters' replay unchanged) tested
every (setup, market) stream of scalp, intraday, rscalp and rintra (32 cells: six M1 markets x four setups, four coins x
intraday / rintra) on 2020-26 net of `tradeCost`: keep a stream only when net R a trade > 0 in 2020-23 AND 2024-26, OOS t >= 2
on calendar-month sums after Holm, OOS n >= 100; placebo of 40 random partitions. **FAIL, 0 of 32 kept** (31 of 32 negative
out of sample; the best, gold rintra +0.014R, t 0.14, lost in sample; placebo 0 keeps). The 11-day forward "best" streams
(XRP / USD/CHF / BTC scalps) are luck among 55.
- User rule `shadow-best` → `config.shadowCut = { setups, keep: [], since, study }`; `council/shadow-cut.mjs` `dropShadow`:
  a NEW signal of those four setups that would be a shadow is not recorded (one line right before `recordOnce`; the
  management loop never reads it). Live trades are never dropped; open and pending shadows run to their exits with their
  stops. swing, position, rswing, m30m1 and the systems are untouched. `snapshot.shadowCut.dropped` counts the dropped ones.
- Effects: the shadow book, the Shadows demo account and the week pane's shadow totals shrink; the 30-day replay
  (`council/backtest.mjs`) and the Coach's backtest evidence still cover the setups. Off-switch: a user rule setting
  `c.shadowCut = null`; a stream comes back only through a new pre-registered study. Tests: `tests/shadow-cut.test.mjs`,
  `tests/shadow-best.test.mjs`.

## Trade review: the after-the-fact edge check and its optional language-model reviewer (17 Nov 2026, owner: "Check as well the edges and add an AI to check the actual trades and help the edge bots to trade better")
Proposals only (absolute rule 3): nothing here changes `config.json`, a rule, a size, a stop or a filter, and no council member
reads its output. ICT is Fred's separate edge: no `ict/` file is read and an `ict…` record or the ICT demo account is never counted.
- **`council/trade-review.mjs`** (pure + `main(dir)`; council.yml every 6th round, `timeout 60`, never fails the loop) reads
  trades.json, research.json, coach.json (decay / expect), config.json, the demo mirrors through `ctrader/mirror-accounts.json`
  (books with `ict` skipped) and `reviews/analyst.json` + `reviews/losses.json`; writes council-data `research/trade-review.json`
  (`hash` = content without its time; written when it changes, re-stamped at least every `REFRESH_S` 6 h; `datahealth.mjs` warns
  at 12 h, bad at 48 h). One **stream** per system and book: `live` (not a shadow; the NQ open run's `nyflip` research rows as
  `alertable` counts them), `shadow`, `research` (research.json's other forward paper streams: the replica's research trades,
  NQ variants by session). Closed = win / loss / be with a finite R, never `void`, `replay` or a duplicate. Engine setups are
  named apart (`SETUP_NAME`: three of them are "Retrace" on the records). Per stream, last 7 / 30 days and the whole record on
  file: n, win rate, R before costs (`R`) and after (`merNet`, the digest's), t, cost per trade and share of gross wins (research
  rows carry no cost: "no cost on record", never a made-up cost); where the R goes: exits by type (`exitType`: target / stop /
  trail / breakeven / time), stops within `FAST_S` 30 min of the fill, trades that reached +1R and closed at a loss, MFE given
  back, the paired counterfactual "close at +1R once reached" (`lock1R`, from the recorded MFE: approximate, said so), losses
  whose target came after the stop (post-mortem `pm.after.hitT1`); demo slippage (`slipR`, positive = worse); session (the
  council's UTC clock), 4-hour block, side and market splits, each against the rest by Welch t with a Student-t p.
- **Flags** (`flagsOf`), every one with n and t: `losing` / `positive` (n >= 10, |t| >= 2 on R after costs), `costs` (gross > 0,
  net < 0, cost >= 0.1R a trade), `weak-*` / `strong-*` splits (both sides >= 10 trades, |t| >= 2), `exit-lock1R` / `exit-runs`.
  Splits carry `p` and `holm` (Holm over every split test of the file, `thresholds.splitTests`). **Proposals** (`proposalOf`):
  skip session / hours / market, one side only, change exit, cut costs, move to shadow / keep off live; each with evidence (n,
  mean, t, p, Holm, `inSample: true` and the warning) and `test` = the pre-registered study that would confirm it (`TEST_BASE`:
  2020 → now, in sample 2020-2023 vs out of sample 2024 → now, net of the council cost model, OOS t >= 2 on month sums after
  Holm, PREREGISTRATION.md first). `strong` = n >= 30, |t| >= 2 and (a split) Holm passed. One subset under two names (Asia =
  00-04 UTC) is proposed once. Nothing is proposed for a live engine setup no longer in `config.focusSetups` (`retired`) or a
  shadow the owner's shadow cut stopped recording (`stopped`): reported, not proposed.
- **Language-model reviewer** (`api/_trade-review.js` pure, `api/trade-review.js` endpoint; the Academy's adapter
  `api/_academy-llm.js`, own budgets `TRADE_REVIEW_LLM_DAILY_USD` 0.50 / `_MONTHLY_USD` 5 / `_HARD_USD` 25 / `_MAX_CALLS_DAY` 2,
  `TRADE_REVIEW=off` or `TRADE_REVIEW_LLM_STOP=1` stops it, no key = off and the page shows the rule-based review alone). Cron
  `GET /api/trade-review?job=review` (Bearer `CRON_SECRET`): reads the file through `api/data.js` `readFile`, asks once per new
  `hash` and at most every `MIN_GAP_S` 12 h; store `trade-review/` (`latest.json`, `state.json`, the adapter's `cost.json` /
  `llm-cache.json`). The answer is checked in code (`parseAnswer`): unknown streams dropped, a proposal must name one of ITS
  stream's own flag ids or it is dropped (`dropped` counted); its evidence and test are copied from the file, never the model's
  numbers. A billed answer that fails the checks is stored as refused (never paid twice); a budget skip is retried. `GET` for
  the owner or a reviewer: `{ enabled, reason, cost, ai }`. Cloudflare: handler `'trade-review'` in `HANDLERS`, run after the
  10-minute cron through `CHAINED` (no new trigger; `wrangler.jsonc` unchanged; vercel.json has no crons since 17 Nov 2026).
  Output cap (17 Nov 2026): 3000 -> `TRADE_REVIEW_LLM_MAX_TOKENS` (default 8000, `cap: 'feature'`); a cut answer is stored as
  refused, naming the variable.
  No connector queue (optional, not built).
- **Page**: card `#ms-tr` (class `adm`) in Council → Review after `#ms-ea`; `<style id="ms-tr-css">` on the graphite tokens of
  `docs/design/aureum-theme.md` with the page's tokens as fallbacks (`--au-ink, var(--ink)`); `<script id="ms-tr-js">` reads the
  file through `msData` and `/api/trade-review` (owner / reviewer; viewers and guests read nothing), `window.MS_TR` pure pieces.
  Live / Shadow / Research / All filter (localStorage `msTrBook`), a stream row opens its review, numbers, exits, splits, flags;
  then the proposals with evidence and test; then the language-model review. The week pane's "Decisions waiting" lists the
  file's **strong** proposals only (at most three, `k: 'review'`, `loadExtra` reads the file); the simple phone view folds the
  card like the other review cards (`.tr-sum` is its summary line).
- **First reading (council-data of 17 Nov 2026 07:14 UTC)**: 30 streams, 18 flags, 2 proposals. The live book's main systems
  have too few closed trades to judge (Gold daily engulf 2, −2.06R after costs; H4 trendline 1; live replica 2, +0.95R; NQ open
  run 1); the four legacy engine setups' live record of 1-4 Nov is −24.2R after costs on 31 trades (retired, nothing proposed).
  Shadow book (stopped by the 12 Nov cut except Position / Swing / M30): +182.2R before costs, −6.3R after on 970 trades; the
  scalps +114.2R gross, +7.9R after (costs 106.3R, 24 % of gross wins; 121 of 326 losses stopped within 30 min); Retrace scalp
  −92.4R after costs (t −3.41); Intraday +48.3R (n 96, t 2.86, whose 2020-26 study `shadow-best` failed: a forward 15 days, not
  an edge). Replica research trades: −85.7R before costs on 977 (t −1.91), buys −0.40R vs sells +0.25R a trade (t −7.21, Holm
  passed: in sample over two weeks of one market regime), demo copies 0.065R a trade worse than paper (n 152, t 3.10).
- Tests: `tests/trade-review.test.mjs` (9), `tests/trade-review-ai.test.mjs` (7); fixture `tests/fixtures/trade-review/`
  (a made-up desk, `make.mjs` builds it).
- **Proposal ledger (17 Nov 2026, owner: "improve the brain")**: council-data `research/trade-review-ledger.json`, APPEND-ONLY
  (`ledgerOf`): each proposal is recorded once (`ledgerId` = stream key + `#` + flag id) with its evidence of that day
  (`recordedAt`); an entry is never edited or removed, and the file is written only when a new one is added. Every run
  re-measures each entry (`forwardCheck`) ONLY on its stream's trades closed strictly after `recordedAt` (never the trades
  that suggested it): the subset against the rest by Welch t (a session / hours / side / market flag), t against zero
  (losing, costs), the paired +1R counterfactual (exit flags). Status (`FWD`): `too few` (under 20 new trades, or under 10 in
  the rest), `held` (the recorded sign and |t| >= 2), `faded` (the sign turned, or |t| < 1), `unclear`. The review file
  carries `ledger { n, counts, items }` and each proposal `forward`; a **faded proposal is not strong** (`fadedForward`), so
  the week pane's "Decisions waiting" drops it with no page change. A ledger file that does not parse is never overwritten
  (`ledger.error`, nothing new recorded). "Held" is a second small sample, never an edge. `datahealth.mjs` lists the file
  (no staleness: written only on a new proposal).
- **Pre-registration drafts**: each strong proposal carries `prereg`, the text of a PREREGISTRATION.md (`preregOf`: why, H1 /
  H0 and the variant, data 2020 → now, IS 2020-23 / OOS 2024 →, the council cost model, month-sum t of the paired difference
  (or of the rule against zero for losing / keep-off-live), Holm, the pass bar), dated the day the proposal was recorded so
  the hash does not move daily. No study folder is made; the owner approves and commits it alone.
- **Already tested** (`STUDIED`, `studiedOf`): a proposal whose question a committed study already answered (key: system id |
  action; `replica|one side only` -> `replica-sides` FAIL, `replica|keep off live` -> `replica-oos` FAIL) carries `studied`
  (verdict, one line, Edge lab link), is never strong and gets no draft; the card shows "already tested". Add a row only for a
  study with a result in `research/edge/` (a test checks the folder exists).
- **The language-model reviewer** gets each stream's `forwardChecks` and `parseAnswer` drops a proposal on a faded flag.
  **The edge analyst** (`api/_edge-analyst.js` `forwardRecord`, passed by `api/edge-analyst.js` as `buildRequest`'s 4th
  argument) adds `systemForwardRecord`: the same system's trades (not shadow, add, replay, void, nor the trade itself; the NQ
  open run's `nyflip` session only) closed STRICTLY before the entry: n, win rate, mean R after costs (`Rnet`, else before,
  said in `basis`), the last 10 results; under 10 closed it says "Too few" and gives no win rate or mean. No id, time or price
  of another trade is sent. Card `#ms-tr`: the ledger counts in the summary, a forward chip and line per proposal, the draft
  in a fold (inside `#ms-tr-js`). Tests: `tests/trade-review-ledger.test.mjs` (7), `tests/brain-forward.test.mjs` (3).
- **First reading with the ledger** (council-data of 17 Nov 2026 12:00 UTC): 30 streams, 19 flags, 3 proposals, all on the
  replica's research trades, all recorded and "too few" forward (0 trades since): take only sells (buys n 525, −0.41R, t −7.58,
  Holm, strong; already answered by `replica-sides` FAIL), keep off live (n 1,009, −0.09R, t −2.00, strong), skip 04-08 UTC
  (n 214, t −2.57, not Holm).

## Trade review audit: Holm over every test, by-day t, the regime note (20 Nov 2026, owner: "make the brain more useful and more correct")
`council/trade-review.mjs`, the Analyst's `postMortem` / `analystReviews`, and the validation side of `api/_trade-review.js`,
audited against council-data of 20 Nov 15:07 UTC. Proposals only, as before (absolute rule 3): no rule, size, stop, filter,
config or page changed; every new field of `research/trade-review.json` is optional and the old ones keep their meaning.
Tests (each failed on the code before): `tests/trade-review-audit.test.mjs` (11), three in `tests/analyst-postmortem.test.mjs`,
one in `tests/trade-review-ai.test.mjs`; `tests/trade-review-ledger.test.mjs` rows now span days.
**Defects fixed** (before → after on that day's data):
- **Holm ran over the flagged comparisons only** (15 of the 107 made), so it corrected for the tests that had already passed
  |t| >= 2: 9 flags "survived", 3 do (shadow scalp on SOL, the replica's buys / sells). Now over every comparison (`splitTestKey`;
  buys against sells is ONE test, so 100 tests), on the unrounded p (`pRaw`, non-enumerable). The one strong proposal of the day
  ("Skip entries 04-08 UTC" on the replica's research trades, p 0.002) is no longer strong: strong 1 → 0.
- **The "+1R close" counterfactual was flattered.** The Trader updates `mfe` only on candles where the trade did not exit, so a
  win that ran to its target inside one candle keeps an MFE under its own R and was left unchanged by the counterfactual (25 of
  1,032 trades with an MFE). `reached1R` = max(MFE, R) >= 1, `lockDiff`: shadow scalp −0.092R (t −1.13) → −0.119R (t −1.45),
  shadow intraday −0.354R (t −3.11) → −0.397R (t −3.47); "reached +1R" 260 → 272 scalps. (A LOSS with MFE >= 1 was honest: it
  reached +1R on an earlier candle.)
- **Counted twice**: the two live gold replica trades of 4 Nov are in trades.json and research.json; a research record whose id
  is in trades.json is read from trades.json (as the mirror does). Replica research 1,367 → 1,365 trades, −111.20R → −112.20R.
- **Wrong name**: a ten-market stream was named after its last record ("USD/CHF replica"); a multi-market stream drops the
  market label ("Replica"). `systems[].markets`.
- **Proposed away a profitable half**: "Take only sells in Position (shadow)" while its buys made +0.17R a trade (n 13). A
  `weak-*` subset is proposed only when its own mean is negative (the flag stays). Proposals 5 → 4.
- **A t on two trades** ("Gold daily engulf (live): t −34.33", n 2): under `STREAM_N` 10 the head says "too few to judge".
- **Stale after the owner's decisions**: `STUDIED['replica|keep off live']` said the replica "has been a paper shadow"; it is
  live again since 20 Nov. `OWNER_DECISIONS` (keyed by the Trader's user rule id; a test checks the id exists) + `decisionFor`:
  a proposal on a stream the owner has just decided, with fewer than 10 trades closed since, carries `decided` and is not
  strong. A LIVE record of a system now in `config.ownerShadow` is history (`shadowed`, in the head): nothing is proposed.
  `totals.liveNow` leaves retired and shadowed live records out (`live`: 39 trades, −26.97R; `liveNow`: 4, −1.11R).
- **"After costs" said of rows with no cost** (the forward check's `basis` on research rows): now "before costs (no cost on record)".
- **Language model**: it could propose for a stream the desk itself proposes nothing for (retired, stopped, shadowed);
  `parseAnswer` discards those (`closedWhy`), the request carries `closed`, `tByDay` and `regimeNote`.
- **Analyst post-mortems** (latent: 0 of the 28 on file change, all are unmoved stops at −1R): a loss closed by its TIME limit
  was written up as "stopped" and could be tagged hunt / noise / news (no stop was hit: no stop is judged, `evidence.exit
  'time'`); "how far past the stop" assumed the stop sat 1R away, wrong for a trailed or break-even stop (`stopAtR` from `r0`);
  a `void` loss gets no post-mortem. `PM_VERSION` unchanged, so no stored review is re-stamped.
**Improvement 1, the by-day t.** Trades of one UTC day share that day's move (twins on correlated pairs, overlapping holds), so
a per-trade t counts dependent trades as independent. `clusterT` / `clusterDiff` (cluster-robust, CR1) by fill day and by close
day, the weaker of the two reported (`rowsT` / `rowsDiff`); null under `DAY_N` 5 days ("too few days to judge"). On `stats().net.byDay`,
every `vsRest.byDay`, `lock1R.byDay`, each flag (`byDay`, `robust`, and in its text), proposal evidence. **Strong needs both**,
and the ledger's "held" too (`FWD.DAYS`). Shadow Position +0.98R a trade: t 2.87 per trade, 1.63 over 8 days; shadow Intraday
2.86 → 2.09 (14 days); Retrace scalp −3.41 → −2.14 (13); the legacy live Scalp's t −8.25 rests on 3 days (no by-day t). Ledger:
1 held, 2 faded, 1 unclear, 2 too few → 0 held, 2 faded, 2 unclear, 2 too few. Not a full answer to multi-day overlap: a floor.
**Improvement 2, the regime note** (`regimeOf`, `regimeForSide`). Per market the move = last fill price against the first; a
buy in a market that rose traded WITH the move. On that day's data the better side was the side of the market's own move in 10
of 10 markets for the replica's research trades and for the shadow scalps, 6 of 7 for the retrace scalps; replica with the
move +0.34R (n 638) against −0.45R (n 727), t 10.60, against the side split's t −8.27: what `replica-sides` found. A side flag
that this explains carries `regime` (in the proposal's `why`, so the page shows it unchanged), is not strong, and a forward
check that "holds" in the same move says "the regime again, not evidence for the rule". The direction is known only
afterwards: a reading, never a rule.
**Sound, left as it was**: the closed set (42 duplicates, 98 missed, 25 void research rows, replay rows and open trades never
counted; no ICT file or ICT demo account read; the drain account's copies still read for slippage); R after costs on every
closed trades.json record (1,054 of 1,054 carry a cost); the ledger's forward check reads only rows closed strictly after
`recordedAt`; retired / stopped follow `focusSetups` (now empty) and `shadowCut`. Not done: the demo slippage t is still per
trade; hour and session splits get no regime reading; the page does not show `byDay` or `regime` as fields yet (they are in the
flag and proposal texts it already prints).

## Edge check and the replica's sides (17 Nov 2026, owner: "Try to check the edges which ones can we improve and focus like the replica")
An evidence review and one pre-registered study; no live rule, size, filter, stop, config, Trader or mirror code changed. The
owner's document is `research/proposals/2026-11-17-edge-check.md` (decisions: `docs/owner-decisions.md` items 57-59, open).
- **Ranking** (what can still improve): (1) the live book (Gold trend + Gold daily engulf) only through its holding cost
  (item 49; book t 1.86 at the demo rate, about 1.96-2.02 on cheaper carry), no rule test (item 44); (2) the NQ open run as a
  regime bet (2023-26 +0.318R, n 309, t 3.45; flat 2004-22) with item 50 open; (3) one rule question item 44 does not block,
  the Gold daily engulf on silver (item 59, low prior). Every other system is null or negative on untouched data and a shadow
  already. The forward records are 0-2 closed trades a system: nothing to judge.
- **`research/edge/replica-sides/`** (PREREGISTRATION.md committed alone first; `run.mjs`, `months.json`, RESULT.md,
  result.json): the replica's RAW research signal (`replicaSignals` copied verbatim from the Trader via
  `research/edge/gold-systems/live.mjs`; every signal, market entry at the next M5 open, 2R, 48 h, gold round-number stops) on
  council-data HistData M1 (gold + five forex, `council/histdata.mjs`) and Binance 5m (four coins, from March 2022), net of
  `tradeCost` with the 17 Nov 2026 cost model pinned in `MODEL` (coin spreads as a share of the 17 Nov price). IS 2020-23,
  OOS 2024 - Oct 2026, three tests, Holm. **FAIL, 0 of 3**: sells −0.196R a trade OOS (n 44,458, month t −12.63); sells minus
  buys +0.007R (34 months, t 0.38); with the 20-day move −0.194R. Before costs every market is within 0.05R of zero (174,316
  trades). The forward split of 3-17 Nov (buys −0.41R, sells +0.26R) is a regime artefact: the side that wins a month is the
  side of that month's move in 61-84 % of months. ETH / SOL pay 0.49 / 0.45R a trade (66-72 % of stops under 5 CFD spreads).
  **Never propose a side rule for the replica from its forward records.** To repeat: `run.mjs fetch <dir>` (git, no network),
  `market <key> <dir> <out>` for the ten keys, `report <out>` (about a minute). Test: `tests/replica-sides.test.mjs`.
- **Replica demo slippage** (council-data `ctrader/mirror-10152148.json`, 157 copies 10-17 Nov): +0.062R a trade (t 3.06);
  ETH +0.19R, SOL +0.14R (half a CFD spread on tight stops), copies 5 min or more late +0.16R, forex about 0; the buy / sell
  gap (−0.003 / +0.127R) is mostly a price basis between the council's feed and the broker, which cancels across sides.

## Diversified time-series momentum, a CFD portfolio (17 Nov 2026, owner: "keep finding the ultimate edge")
`research/edge/tsmom-portfolio/` (PREREGISTRATION.md committed alone first; `run.mjs`, RESULT.md, result.json). The literature's
managed-futures rule, never tested here as a portfolio: 38 OANDA daily CFDs from the council's candle cache (5 metals, 13
indices, 3 energies, 6 bond CFDs, 4 ags, 7 forex majors; crosses, exotics and gold-in-other-currencies left out), each month
long / short on the sign of its 12-month return skipping the last (closes strictly before the first close of the month), 10 %
volatility per market from 60 days (notional cap 4x its share), equal risk, the book scaled to 10 % from its last 252 days;
pre-registered round trips per market and CFD financing (long pays DGS2 + 2.5 %, short pays 2.5 % − DGS2; forex 1 % either
side, no interest differential). **Verdict: FAIL, 0 of 5 checks**: net −0.34 % a month out of sample 2024-01 to 2026-10
(n 34, t −0.70), −0.23 % in 2020-23 (t −0.51), −0.13 % in 2005-19 (n 180, t −0.61). Before any cost +0.41 % a month on 2005-19
(t 1.85, Sharpe 0.48) and +0.40 % out of sample (t 0.85): financing at 2.3-3.0x gross notional (123-235 % of gross) is what
turns it negative; spreads are 9-21 %. Post hoc, financing at the rate alone (a futures-like excess return): t 1.49 / 0.40 /
0.37. The 3- and 6-month look-backs are worse (OOS t −2.13, −1.42). Not an edge on CFDs, no paper shadow proposed, no owner
decision. Nothing live changed. To repeat: `run.mjs fetch <dir>` (git, no network), `run.mjs run <dir>`. Test:
`tests/tsmom-portfolio.test.mjs`.

## Gold daily engulf on silver (17 Nov 2026, item 59's recommendation)
`research/edge/geg-silver/` (PREREGISTRATION.md committed alone first; `fetch.mjs`, `run.mjs`, RESULT.md, result.json). The live
`geg` rule (trading days via `foldWeekend`, the reopen freshness window, maxOpen 3, 10R, 2R / 1R trail, 240 h) on OANDA XAG/USD
M5 + D1, buffer $0.30 -> $0.004, cost 0.10 % of price a round trip and 0.015 % a night on longs (assumed: no XAGUSD on the demo
broker's file). Parity gate first: the harness reproduces `gold-weekend`'s gold engulf exactly (n 247 +0.207R, n 176 +0.326R).
**Verdict: FAIL**: OOS 2024 on +0.098R a position (n 63, month-sum t 0.52), IS 2020-23 −0.158R (n 85), replication 2006-19
+0.060R (n 252, month t 0.55); one at a time is worse. No paper shadow, nothing live changed; do not test it on another
market. Test: `tests/geg-silver.test.mjs`.

## The gotobi fade on a cTrader demo account (19 Nov 2026, owner: "start on any of the demo accounts ctrader"; item 61)
The one candidate the studies support after the replica and the council's own streams failed: the gotobi study's T2 (PASS,
REPLICATES, FEED-ROBUST). `council/gotobi.mjs` (pure rule + runner): on a gotobi day (calendar = `council/yen-spread.mjs`, a copy of
`research/edge/gotobi/run.mjs`, compared day by day 2016-2027 in the test) sell USD/JPY at 00:55:00 UTC with `relativeStopLoss` D
(= the study's `stopDist`, compared in the test), buy back at 06:00:00 UTC; risk 0.25 % of the balance. Run by
`.github/workflows/gotobi.yml` (GitHub cron 00:22 / 00:37 Mon-Fri, and the Worker's 10-minute cron through `api/_gotobi-kick.js`
in `/api/status?job=watchdog`, 00:25-00:49 on weekdays, one start an hour): the job waits, connects 40 s before, sends on the
second, re-reads the position (no stop: amend, else close at once), sleeps, closes; a run after 00:56 records "missed" and does not
enter; a position of an earlier day still open is closed late and said so. Account: `config.gotobi.account`, else
`CTRADER_GOTOBI_ACCOUNT`, else the LIT book's (idle since 17 Nov). Label "gotobi": the mirror ignores it (it only manages its own
label). Demo host, `isLive === false`, the mirror's message allowlist; council-data `gotobi/trades.json` (one record a day, R before
costs = (fill - exit) / D). `config.gotobi = { on: false }` stops it. Never call it an edge before its forward record says so.
Not checked live: the dispatch token's Actions: write, and the first real gotobi morning (20 Nov 2026). Tests:
`tests/gotobi-demo.test.mjs`.
**A third start, from the council loop (20 Nov 2026)**: the 20 Nov deploy log says `skip GH_DISPATCH_TOKEN (no repository secret)`,
so the Worker's timer cannot start the job. After each round `council/gotobi-due.mjs` (read only; the Worker's `decide` and window,
plus the study's calendar) answers yes on a gotobi weekday 00:10-00:49 UTC (23 Nov 2026: was 00:25, only one loop round landed in it) with no gotobi run active or started within the hour,
and `council.yml` dispatches main's `gotobi.yml` with the loop's own `actions: write` (never fails the round). Test:
`tests/gotobi-due.test.mjs`.
**23 Nov 2026, plumbing**: `gotobi.yml` 360 min; `connect()` closes its session on a refused connection and is retried (entry until 00:55:55, the 06:00 exit up to 6 times; never an order or a close retried); an exit that still cannot connect leaves the record open with `exitError` and the broker stop, closed by the next run. `vb-demo.mjs` writes a weekday with no order in its first 20 minutes as `missed` without connecting. `vb-forward.yml`: every record step after the first and Save run `if: !cancelled()`, so one failing record no longer throws the others away.
**20 Nov 2026, the first gotobi morning was missed**: no run by 00:31 UTC (GitHub's cron late; the Worker's start had no
`GH_DISPATCH_TOKEN`, which the deploy never copied), and a run started by hand at 00:31 stopped on `candles: HTTP 403` (the
website's /md refused the runner). Now: `gotobi.yml` reads candles from its own localhost service (`scripts/own-candles.sh`, the
OANDA_TOKEN repository secret; the website only without it), a candle failure is an `error` record for the day (it crashed
before), the deploy copies `GH_DISPATCH_TOKEN`, and `/api/status?job=watchdog` falls back to `GH_TOKEN`.
**The cost at the fix, measured (20 Nov 2026, `research/edge/gotobi-exec`)**: the demo broker's own USD/JPY quotes at 00:55 and 06:00
UTC on 211 gotobi days (Nov 2023 → Nov 2026) put a round trip at 0.81 pip median with commission (p90 0.96, worst 1.49; the study
assumed 2.0, break-even 3.73): the cost no longer threatens T2. On those executable quotes the fade made +0.163R a trade (month t
1.80, short of the pre-registered 2; per-trade t 2.01). Slippage beyond the quote is still unmeasured (the demo job's fills will show it).

## Desk slices tested, and the two breakouts on a demo account (21 Nov 2026, owner: "3 and 4 but show before merge")
- **`research/edge/desk-slices/`** (PREREGISTRATION.md committed alone first; `run.mjs fetch|run <dir>`, RESULT.md, result.json):
  the three slices that looked good on the desks' 90-day records, on OANDA candles 2020 → 22 Aug 2026 with the desks' own code
  (`council/edge-desks.mjs`), net of pre-registered costs, month-sum t, Holm. **FAIL, 0 of 3 (two fail, one invalid)**: the
  engulf reading on EUR/USD −0.136R a trade out of sample (n 3,205, t −4.80) and on GBP/USD −0.094R (n 3,255, t −2.92), both
  zero before costs on 16,000 trades. T3 (LIT "market on the break" as the desk records it: +0.738R, n 109, t 4.27) passes
  its checks and is **INVALID**: the desk records that execution only when neither limit order filled, which is known after
  the market entry (look-ahead by selection). The same entry on every candidate: n 468, month t 0.76, one +299R trade carries
  it (median −1R). **Never quote the LIT desk's "market on the break" rows as an entry rule; the desks' totals are not
  evidence.** `litTrades` takes `sets` (default `LIT_SETS`) for that check. Test: `tests/desk-slices.test.mjs`.
- **`council/vb-demo.mjs`** (council.yml: each round after the mirror and each quick pass, `timeout 45`, never fails the
  round): the studies' T1 on a cTrader DEMO account for gold and USD/JPY (labels `vb-xau`, `vb-usdjpy`; the mirror ignores
  them). In the first 20 minutes of a weekday (UTC) it places a buy STOP at O + 0.5 x the previous trading day's range and a
  sell STOP at O − 0.5 x it (`levels`, the study's `buildDays`), each WITH `stopLoss` = O and a 21:00 UTC expiry, only when
  neither level has traded yet (else `missed`); later passes cancel the other order once one filled, read the fill back
  (no stop at the broker: amend, else close at once), book a broker stop-out as −1R, and at 21:00 UTC cancel and close. Risk
  0.25 % of the balance (`config.vb.risk`); under the broker's smallest volume the smallest is used only while a stop-out
  costs at most 1 %. Account: `config.vb.account`, else the gotobi job's (`accountFor`: the former LIT / shadow demo account).
  Demo host, `CTRADER_ENV=demo`, `isLive === false` (gotobi's `connect`, now exported). Record: council-data
  `vb/trades.json` (statuses placed / open / closed / nofill / missed / skip / error; R before costs from the broker's
  fills). `config.vb = { on: false }` stops it. With nothing due it does not connect. A forward demo record, never an edge by
  itself. Not checked against the real broker (a STOP order carrying an absolute stopLoss, the cancel answers). Also fixed:
  `council/gotobi.mjs` treated a REFUSED stop amend as done (now `amendStep`, so a refusal closes the position). Tests:
  `tests/vb-demo.test.mjs` (fake broker).

## The council's own OANDA candles (15 Nov 2026, found during the Vercel outage)
`MD_BASE` (Trader, data check, macro strategist, replay) and `ICT_MD_BARS` (the ICT desk's silver shadow) defaulted to the
website's proxy (meridianx.dev/md/; aureumdesk.co.uk since 16 Nov). When Vercel blocked the account at 10:21 UTC on 15 Nov, every gold and forex market fell to
the Kraken fallback (`snapshot.feed` all "Kraken"; one-feed rule: OANDA-priced records held, adopted after 6 h; the weekend
close limited the effect). `council/md-proxy.mjs` serves `/md/bars` on localhost through the site's own `api/bars.js` (the
VPS live runner's `startProxy` since 8 Nov); `council.yml` starts it when the `OANDA_TOKEN` secret is set and moves `MD_BASE` /
`ICT_MD_BARS` to it only once it answers, else the website's proxy as before. Needs the owner to add `OANDA_TOKEN` (and
`OANDA_ENV` only for a live OANDA account) as GitHub repository secrets. `backtest.yml` and `macro-gold.yml` start the same service through
`scripts/own-candles.sh` (writes MD_BASE / ICT_MD_BARS to $GITHUB_ENV only once it answers). `daily-cache.yml` stays keyless
(a test pins it): it reads the website's proxy, weekly. The ICT replay does not use the proxy (CNBC and its fill files). Tests: `tests/md-proxy.test.mjs`.
**20 Nov 2026**: `backtest.yml` (the council's 30-day replay) and `macro-gold.yml` checked out only part of the repository without
`scripts/` and `api/`, so `sh scripts/own-candles.sh` failed and the daily replay had not run since 19 Nov (data health: "Daily
replay … not updated for 44 h"); both now check out `scripts`, `council` and `api` (`tests/own-candles-checkout.test.mjs`).

## Tick probe: the demo broker's own bid / ask history (20 Nov 2026, for the cost questions)
`council/tick-probe.mjs` + `.github/workflows/tick-probe.yml` (dispatch only, input `symbols`, default XAUUSD): reads the DEMO
broker's past ticks of both sides once through api/ctrader-link.js's read session (READ_ONLY allowlist, demo host, an account
with isLive false; nothing traded, sized or alerted) and writes council-data `research/probe/ticks-<SYMBOL>.json`: `depth` (how
far back the history goes: ticks in a 2-minute window 1-1095 days back), `hours` + `hourProfile` (the quoted spread in the first
2 minutes of every UTC hour of the last 60 weekdays: what the gold breakout really pays at 00:00-07:00 UTC,
research/proposals/2026-11-14-gold-vol-breakout.md) and `events` (the last bid and ask at T-10 to T+65 minutes, each minute plus
T+5 / 15 / 30 s, and the widest spread of each minute, for every US CPI, payrolls and FOMC statement of council/events.mjs inside
the depth: the executable prices the owner's news register asks for first). Research data only, no council member reads it.
A symbol may name its parts (`USDJPY:gotobi`; depth is always read): `gotobi` = the bid, ask and spread at 00:55:00 and 06:00:00 UTC of every gotobi day inside the history (`council/gotobi-calendar.mjs`), for `research/edge/gotobi-exec`. Test: `tests/tick-probe.test.mjs` (fake broker).
## Gold breakout at measured hourly spreads (20 Nov 2026, `research/edge/gold-vol-breakout-hourcost`)
Accounting, no rule tested, nothing live changed. The tick probe's first XAUUSD run (council-data `research/probe/ticks-XAUUSD.json`,
history reaching at least 1,095 days) puts the demo's quoted gold spread at $0.07-0.10 in EVERY UTC hour, Asian hours included
(1.7-2.6 × 10⁻⁵ of price; commission 0.000024): about 0.02R a trade for `gold-vol-breakout` T1 (the studies charged $0.60). At
that cost + 0.05 × M stop slippage T1 nets +0.105R a trade on 2021-26 (n 1,121, month t 2.79) and +0.139R pooled 2007-26 (t 6.47;
past years charged today's relative spread). The owner's decision is still the 14 Nov proposal (a forward paper / demo record,
whose first job is the stop-order slippage). Test: `tests/gold-vol-breakout-hourcost.test.mjs`.
`fills` (gold-vol-breakout-exec) = the first broker tick in a window where ask >= level (dir > 0) or bid <= level (dir < 0), queries from the same file's `fills` object. `marks` (fx-weekend-gap-exec) = the quote at given moments from a JSON file named by the workflow input `marks` (`PROBE_MARKS`, { SYMBOL: [unix sec] }, at most 600 a symbol). A symbol may name its parts (`USDJPY:gotobi`; depth is always read): `gotobi` = the bid, ask and spread at 00:55:00 and 06:00:00 UTC of every gotobi day inside the history (`council/gotobi-calendar.mjs`), for `research/edge/gotobi-exec`. Test: `tests/tick-probe.test.mjs` (fake broker).
`marks` (fx-weekend-gap-exec) = the quote at given moments from a JSON file named by the workflow input `marks` (`PROBE_MARKS`, { SYMBOL: [unix sec] }, at most 600 a symbol). A symbol may name its parts (`USDJPY:gotobi`; depth is always read): `gotobi` = the bid, ask and spread at 00:55:00 and 06:00:00 UTC of every gotobi day inside the history (`council/gotobi-calendar.mjs`), for `research/edge/gotobi-exec`. Test: `tests/tick-probe.test.mjs` (fake broker).

## The macro rule book's Donchian swing rule (20 Nov 2026, `research/edge/macro-donchian`, pre-registered)
The rule book's execution layer (close beyond the 20-day channel with EMA20 / EMA50, stop 2 ATR, out after 5 days; "longs only,
full size when the Gold Macro Score > +0.25"), on OANDA spot gold 2007-26 net of 0.0001 a round trip and long financing.
**FAIL**: longs +0.082R a trade (n 170, month t 1.35; the book quoted +0.24R before costs on futures), no better than random
longs in the same up-trend (placebo median +0.078R, 95th percentile +0.152R): it is gold's drift. Score > +0.25 wins more often
(60 % vs 46 %) but the R a trade is the same (+0.083 vs +0.080, t 0.02). Shorts −0.005R. Nothing live changed. Test:
`tests/macro-donchian.test.mjs`.

## The gold brief's "interim bottom" framework (20 Nov 2026, `research/edge/gold-interim-bottom`, pre-registered)
The veteran batch's gold brief (`gold-market-brief-2026-11-07.md`) quotes a bear-regime bottom signal (gold far below its 200-day,
a sharp 52-week dollar rise, low speculative positioning; 9 of 10 up after three months) and asks for a point-in-time test.
Public proxy with two of the three conditions (no COT before 2019), thresholds from earlier bear month-ends, OANDA spot 2007-26,
long 63 days with a 3 x ATR20 stop, net of costs and financing. **FAIL, too few to judge**: both conditions held at 2 month-ends
(Sep / Oct 2022), one trade, +1.56R, n 1, no t. Reported: the stretch condition alone 6 of 7 up (+0.67R, t 1.64) against every bear
month-end 40 of 62 (+0.21R): the brief's direction, intervals overlapping. Nothing live changed. Test: `tests/gold-interim-bottom.test.mjs`.

## Measured-cost studies of 20 Nov 2026 (tick probe)
Read the demo broker's own bid / ask (council/tick-probe.mjs). Nothing live changed. Results, each pre-registered before its data:
- `gold-release-quotes`: gold's spread at T+5 s after US CPI / payrolls / FOMC is about 18× normal ($1.48 median), the widest
  in minute T $6.71 (p90 $19); the news register's N4 continuation / reversal from T+5 to T+60 both FAIL (n 93).
- `silver-vol-breakout-hourcost`: the demo quotes silver at about $0.02 (20× gold's relative cost); the failed silver breakout
  holds in 0 of 4 checks.
- `gotobi-exec`: USD/JPY at the fix costs 0.81 pip a round trip with commission (assumed 2.0); on executable quotes T2 made
  +0.163R a trade over 211 gotobi days, month t 1.80 (FAIL on its bar; the cost no longer threatens the study's result).
- `fx-weekend-gap-exec`: the Sunday reopen costs about 11 pips of spread at Rule G's entry minute, and on 237 of 488 weekends
  this broker was not quoting yet; on the rest Rule G nets +0.165R (month t 1.52, FAIL). Not tradable as written on this account.
- `gold-vol-breakout-exec`: T1 filled at the broker's own ticks (first tick across the trigger / stop, the last quote before
  21:00 UTC), 24 Nov 2023 - 12 Nov 2026: **PASS**, +0.184R a trade after commission, n 572, month t 3.54 (OANDA mid +0.192R before
  costs); entry slippage $0.07 median, 0.011R. In-sample years (not new evidence); the ten best trades carry 55 %, 2024 +0.07R.
  21:00 UTC is gold's daily break on US summer-time days: the probe's marks take `PROBE_MARKS_BACK` (workflow input `marks_back`).
- `gold-vol-breakout-forward` (pre-registered 20 Nov 2026): T1's forward record on days from 13 Nov 2026 (after every candle
  any study read), cost = hourcost's C1 frozen, against a month-block band from the 2021-26 C1 trades (`baseline.json`, gated
  n 1121 / +0.105R / t 2.79). Readings: too few under 20, below the measured range (A p5), ahead of a no-edge rule (B p95);
  checkpoints at 120 (fails / holds so far) and 240 trades (confirmed / fails / not shown); the first crossing stands.
  `vb-forward.yml` (Tue-Sat 04:41 UTC) writes council-data `research/forward/gold-vol-breakout.json`; its candles run up to the
  run (`GGO_TO`; until 20 Nov 2026 they stopped at midnight UTC and the last complete day was left out). Nothing trades.
- `turnaround-tuesday-forward` (pre-registered 20 Nov 2026): R2 on NAS100 (a Monday down more than 1 %, buy the close, out at
  Tuesday's close or the study's stop) for weeks after 12 Nov 2026, the study's own functions (sha256-pinned), cost
  `MARKETS.nas100.cost`, DGS2 frozen at the study's last value; against a single-trade bootstrap of its 81 out-of-sample trades
  (2016-26, +0.098R). Too few under 10, checkpoints 20 and 40; the first crossing stands. Rebuilds the study's 2 Nov 2026 trade
  exactly (+0.129R). First reading: 1 trade (16 Nov, −0.135R). `vb-forward.yml` writes council-data
  `research/forward/turnaround-tuesday.json`. Paper research only.
- **Edge lab shows the latest forward readings** (20 Nov 2026): a row whose topic ends in `-forward` adds "Latest reading: …"
  from `/cdata/research/forward/<study>.json` once `/api/me` names a member (`forwardLive` in edge-lab.html, escaped, display
  only); the committed result.json stays the first reading. A new forward record needs its step in `vb-forward.yml` writing that
  file name (`tests/edge-lab-forward.test.mjs`). A card "Forward records" (`#fwc`, above the filter bar) shows the four records
  side by side (start, trades, total R, the file's `reading` word for word, a link to the row) through the same cached request
  (`fwdGet`), text only; signed out or an unreadable file is said in words (`forwardCard`, `tests/edge-lab-forward-card.test.mjs`).
- `gold-pre-holiday-forward` (pre-registered 20 Nov 2026): `gold-pre-holiday` T1's forward record on NYSE holidays after
  31 Oct 2026 (the study's own functions, sha256-pinned; reproduces its 2026 trades to the cent), against an event bootstrap of
  its 92 out-of-sample trades (+0.133R). Too few under 10; checkpoints at 20 (~2 years) and 40 events. The same `vb-forward.yml`
  writes council-data `research/forward/gold-pre-holiday.json`. First event: Thanksgiving (25 Nov 2026). Nothing trades.
- `vb-macro-size` (pre-registered 20 Nov 2026): the rule book's "size by the Gold Macro Score, never short above +0.25" on T1
  (2007-26, 3,713 trades, C1 cost, gate reproduced). **FAIL**: longs above +0.25 +0.268R vs +0.119R a trade (t 1.93, Holm p 0.054;
  month-sum t −0.07), shorts above +0.25 not worse (t −0.88); sized the book's way +0.155R per unit of risk vs +0.140R flat, same
  month t and drawdown. T1 stays flat 1R. Local reruns of research fetch scripts need `MD_BASE=https://aureumdesk.co.uk/md/`
  (their default meridianx.dev answers 402 since the Vercel project went).
- `nas-vol-breakout-early` (pre-registered 20 Nov 2026): T1 on NAS100 at the measured C1 cost on untouched 2010-2015 (OANDA M5).
  **FAIL**: −0.011R a trade net (n 1,110, month t −0.28; gross +0.001R), 2013-15 −0.026R, 30 of 40 placebos beaten. The 2016-26
  +0.043R does not replicate: the breakout is gold's, not an index rule. Do not test it on another index.
- `fx-vol-breakout` (pre-registered 20 Nov 2026): T1 on six forex majors (OANDA M5 2016-26) at the demo's cost (commission
  0.000045 of price + 0.5 pip). **FAIL**: pooled −0.022R a trade net (n 12,664, month t −1.59; gross +0.012R). USD/JPY alone
  passes its checks (+0.063R, t 2.50, Holm p 0.043, 40 of 40 placebos): by the pre-registration a hypothesis for its own test on
  other data, not an edge. The breakout is gold's. Nothing live changed.
- `usdjpy-vol-breakout-early` (pre-registered 20 Nov 2026, the follow-up `fx-vol-breakout` named): T1 on USD/JPY 2005-2015
  (years that study never read), same cost. **PASS**: +0.079R a trade net (n 2,089, month t 2.95; halves +0.078R / +0.081R;
  2x cost +0.050R; 40 of 40 placebos). With 2016-26 (+0.063R, t 2.50) it holds in both stretches of OANDA history. Limits:
  today's demo cost charged on old years, OANDA mid candles (not broker ticks), drawdowns of 20-42R. A candidate for a forward
  paper record only (its own pre-registration); never a live rule without the owner. Nothing live changed.
- `yen-crosses-vol-breakout` (pre-registered 20 Nov 2026): is USD/JPY's T1 result a yen effect? T1 on EUR/JPY, GBP/JPY, AUD/JPY,
  CAD/JPY, CHF/JPY 2005 → now, same cost. **FAIL** on the pool: +0.021R a trade net (n 21,088, month t 1.64; 2x cost −0.004R),
  positive in both windows and 40 of 40 placebos beaten, so a faint tilt, not an edge. GBP/JPY alone clears its checks (+0.050R,
  t 2.63, Holm p 0.020), CHF/JPY loses. By the pre-registered reading USD/JPY's result stands alone (one market of eleven); its
  forward record is the judge. Nothing live changed.
- `usdjpy-vb-feed` (pre-registered 20 Nov 2026): USD/JPY T1 on a second feed, HistData M1 (council-data, `histStampUtc`) grouped
  to 5m, 2018 → Oct 2026. **PASS**: +0.086R a trade net (n 1,582, month t 2.91); OANDA mid on the same window +0.073R (t 2.48);
  same side on 100 % of the 1,575 days both traded, daily R correlation 0.98. Not an artefact of OANDA's candles; same years as
  `fx-vol-breakout` (a feed check, not new evidence). Nothing live changed.
- Two breakouts as one book (20 Nov 2026, accounting, `research/proposals/2026-11-20-two-breakouts.md`): gold T1 (C1) + USD/JPY
  T1 at 1R each from the forward baselines, Jan 2021 - Oct 2026 (in sample): monthly correlation 0.03, book month t 3.47 (gold
  2.70, USD/JPY 2.28), +35.8R a year, worst drawdown 42.9R. No verdict; the forward records judge.
- `usdjpy-red-folder` (pre-registered 20 Nov 2026): `red-folder-surprise`'s design on USD/JPY (HistData M1, cost 0.015 %).
  **FAIL**: T+5 → T+60 with the miss −0.019 % (2018-21, n 24) and +0.041 % (2022 → Apr 2025, n 58, t 0.90). The first 5 minutes
  went the way of the miss on 65 of 82 releases and release → T+60 +0.41 % out of sample (t 5.37), not tradable: the dollar,
  like gold, moves at once. Know the side before the print; do not chase after it. Nothing live changed.
- `usdjpy-vb-k` (pre-registered 20 Nov 2026): USD/JPY T1 at k 0.3-0.7 (gate: k 0.5 reproduces both published studies).
  **BROAD**: net positive at every k in 2005-15 AND 2016 → now; pooled +0.097R (k 0.3, t 4.28) to +0.049R (k 0.7, t 2.69); k 0.5
  +0.071R (n 4,168, t 3.86). Not a lucky setting; k stays 0.5 (no setting is adopted from this). Nothing live changed.
- `yen-us-yields` (pre-registered 20 Nov 2026): the Japan brief's "global yields dominate" as a forecast: a 4-week US 10-year
  move over 25 bp, then USD/JPY over the next 20 sessions (FRED DGS10, OANDA daily, 1,001 weeks 2007-26). **FAIL, 0 of 2**: up
  t 0.63, down t −1.08 (both the claimed way, neither close). Same-4-week correlation 0.51: they move together, the move does not
  lead. Nothing live changed.
- USD/JPY T1's risk profile (20 Nov 2026, accounting, `research/proposals/2026-11-20-usdjpy-risk.md`, from the forward baseline,
  2016-26, in sample): +131.7R, worst drawdown 33.8R (Dec 2022 - Oct 2023), 574 days below a high, 3 losing years (2023 −15.4R).
  At 0.25 % a trade about +3 % a year with an 8.4 % drawdown. No verdict.
- `yen-gold` (pre-registered 20 Nov 2026): the macro skill's "falling USD/JPY helps gold": a 4-week USD/JPY move over 2 %, then
  gold's next 20 sessions (OANDA daily, 1,013 weeks 2007-26). **FAIL, 0 of 2**: yen strong t 0.96 (gold +0.9 % vs +0.5 % on all
  weeks), yen weak t −0.91; both the claimed way, halves agree in sign, neither close. A faint lean at most; the Gold Macro Score
  and the driver stack's carry row are unchanged. Nothing live changed.
- `audjpy-leads` (pre-registered 20 Nov 2026): the macro skill's "AUD/JPY turns before equities" on S&P 500 and Nasdaq 100
  (OANDA daily, 1,012 weeks 2007-26). **FAIL, 0 of 4**: AUD/JPY up first finds nothing (t −0.05 / 0.32); AUD/JPY down while the
  index rose was followed by weaker indices (t −2.12 / −2.26, same sign in both halves) but Holm p 0.10: a near miss on data now
  read. Nothing live changed.
- `vix-curve` (pre-registered 20 Nov 2026): an inverted VIX curve (VIX above VIX3M, FRED, 91 weeks in 43 episodes 2008-26) and
  the next 20 sessions. **FAIL, 0 of 2**: USD/JPY −0.20 % vs +0.18 % on other weeks (t −0.79), gold +0.47 % vs +0.57 % (t −0.10).
  Acute stress says nothing tradable about the desk's two markets a month on. Nothing live changed.
- `oil-hawkish` (pre-registered 20 Nov 2026): the macro skill's "slow, persistent oil rise = hawkish" (WTI +15 % in 63 sessions,
  up in each 21-session block; 128 weeks, 52 episodes 2007-26). **FAIL, 0 of 2**: USD/JPY nothing (t 0.22); gold weaker after
  (−0.11 % vs +0.89 %, t −2.10) but Holm p 0.07 and almost all in 2017 on: a near miss on data now read. Nothing live changed.
- `pgm-vol-breakout` (pre-registered 20 Nov 2026): T1 on platinum and palladium, OANDA M5 2016 → now, cost 0.30 % / 0.20 % of
  price (`gold-drd-pgm`'s, not measured). **FAIL**: pooled −0.181R a trade net (n 4,082, month t −8.67); before costs +0.060R
  (palladium +0.072R), so the verdict rests on the assumed cost. Nothing live changed.
- `pgm-vol-breakout-hourcost` (pre-registered 20 Nov 2026): the platinum / palladium T1 trades at the demo's measured hourly
  spreads (tick probe: XPTUSD 32-57 bp, XPDUSD 64-91 bp of price, wider than the assumed costs). **FAIL**: −0.474R a trade net
  (t −17.85). T1 on the metals other than gold is closed. Nothing live changed.
- `usdjpy-vol-breakout-forward` (pre-registered 20 Nov 2026): T1 on USD/JPY on days from 2026-11-20 (after every candle the two
  USD/JPY studies read), same pre-set cost, against month-block bands of the 2016-26 trades (`baseline.json`, gated n 2,079 /
  +0.063R) with the gold forward record's readings, checkpoints 120 / 240 (first crossing stands). `vb-forward.yml` writes council-data
  `research/forward/usdjpy-vol-breakout.json`. Nothing trades. First reading: too few (n 0).
- `usdjpy-vol-breakout-exec` (pre-registered 20 Nov 2026): USD/JPY T1 filled at the demo broker's own ticks (tick probe `fills` /
  `marks`, files `ticks-USDJPY-exec-a/-b.json`), 24 Nov 2023 - 19 Nov 2026. **PASS**: +0.148R a trade after commission (n 564
  filled, month t 3.11; OANDA mid +0.153R before costs; entry slippage 0.012R). Cautions: the ten best trades carry 75 %, buys
  +0.277R vs sells +0.028R (2005-26 mid: buys +0.148R, sells +0.001R): part may be USD/JPY's drift. In-sample years; the forward
  record judges. Nothing live changed.
- `fx-majors-vb-early` (pre-registered 20 Nov 2026): T1 on the five majors other than USD/JPY (EUR/USD, GBP/USD, AUD/USD,
  USD/CAD, USD/CHF) on 2005-2015, years no study had read for them; same rule, cost and placebo. **FAIL**: pooled +0.013R a trade
  net (n 10,699, month t 0.93; gross +0.038R; 2x cost −0.013R; 2005-10 +0.025R, 2011-15 −0.002R; 40 of 40 placebos beaten); no
  market clears its checks (best USD/CHF +0.051R, t 1.86, Holm p 0.157; USD/CAD −0.045R). A faint tilt before costs, not an edge:
  USD/JPY stands alone among the six majors in both decades. Nothing live changed.
- `energy-vol-breakout` (pre-registered 20 Nov 2026): T1 on WTI, Brent and natural gas, OANDA M5 2016 → now, 0.1 % of price a
  round trip. **FAIL**: pooled −0.014R a trade net (n 5,221, month t −0.85); before costs +0.059R, so the verdict rests on the
  assumed cost (the demo's energy spreads are not measured). Nothing live changed.
- `usdjpy-vb-side-control` (pre-registered 20 Nov 2026): **INVALID**: its control took each real trade's side (decided by the
  day's breakout) and entered at random times mostly before that breakout fired, i.e. look-ahead (+0.36R a trade). Nothing is
  concluded from it; kept as a record. Corrected in `usdjpy-vb-side-control-v2` (pre-registered after v1 was found invalid):
  long and short random entries on EVERY tradable day, no day or side chosen by the breakout. **PASS**: T1's buys +0.148R a trade
  (n 1,998) vs long at a random time +0.026R, 40 of 40 seeds, both halves; sells +0.001R vs short −0.056R (reported). The breakout
  entry adds about 0.06-0.12R a trade beyond USD/JPY's drift. Nothing live changed.
- `usdjpy-vb-exit` (pre-registered 20 Nov 2026): USD/JPY T1 (k 0.5) with exits 12:00 / 15:00 / 18:00 UTC and a 17:00 New York day
  (gate: 21:00 / 00:00 UTC reproduces both published studies). **BROAD**: net positive in 2005-15 AND 2016 → now at all four, month
  t ≥ 2 at 4 of 4 (pooled 15:00 +0.086R t 4.52, 18:00 +0.078R, rule +0.071R, NY day +0.049R t 2.70, 12:00 +0.039R t 2.23; 12:00
  thin after 2016, +0.014R). The rule stays 21:00 / 00:00 UTC (nothing adopted). Nothing live changed.
- `energy-vol-breakout-hourcost` (pre-registered 20 Nov 2026): the energy T1 trades at the demo's measured hourly spreads (tick
  probe; broker names XTIUSD / XBRUSD / XNGUSD; WTI and Brent about 0.03 % of price, gas about 0.24 %). **FAIL**: pooled −0.003R a
  trade net (month t −0.17); gas −0.088R (t −3.24) sinks it. WTI +0.031R (t 1.33) and Brent +0.047R (t 1.71) are positive in both
  windows but not significant; picking them after this is not a test. Nothing live changed.
- `index-vol-breakout-hourcost`: the failed index breakout at the demo's measured hourly spreads (NAS100 2.7 × 10⁻⁵ of price in
  every hour, US500 3.9-4.7 × 10⁻⁵, no commission; the original charged 3 / 1 points): **FAIL, 0 of 2**. NAS100 +0.043R a trade
  (n 2,040, month t 2.01, Holm 0.044) fails only the placebo (35 of 40 random entries beaten, 38 needed); SPX500 +0.015R (t 0.69).

## Discretion: taken against skipped signals (20 Nov 2026, owner: "the difference is discretion on all edges, because they work")
`research/edge/discretion` (pre-registered; read-only on council-data; aggregates only, never a person's trade, note or name).
Do the signals a person took before the outcome beat the ones they skipped, per stream (ICT its own section)? **TOO FEW TO
JUDGE: 0 take / skip decisions stamped before the outcome exist** (`ict/desk.json` was never written to council-data; the 8
human loss reviews are all after the close and losses only; no council system records a choice). Bar fixed for later: 20 a
side, Welch t >= 2, Holm. Power arithmetic: ICT A-setup per-unit R sd 1.69R (n 259), so +0.3R a trade needs about 254 a side
for an even chance of t 2, +0.5R about 92. Proposal for the owner (nothing built): `research/proposals/2026-11-20-discretion.md`
(a take / skip + reason + confidence stamped by the server before the outcome on every signal, "taken by a person" beside "all
signals"). Never quote picked examples as evidence of discretion. Test: `tests/discretion.test.mjs`.

## Desks re-read against the documents and skills (21 Nov 2026, owner: "re check now the documents and trades … with the skills together", then "build", "keep going")
Fourteen read-only reviews (every page of the owner's private documents, every installed skill; never copied or named in the repository)
were set against the desk code, then built in three rounds and checked by an independent reviewer. PAPER RECORDS of one reading of
each method: none of this is a tested edge, and every stricter rule so far gives fewer trades and smaller losses, not profits.
Owner's answers: an engulf may take "as many candles as it needs"; keep the msnr-main / msnr-other records; "the VR is specified in the pdf".
- **One engulf definition** `council/eg-methods.mjs` `engulfAt` (used by `zones`, `direction`, `egTrades`): the base is the last candle of
  the other colour; ANY later candle closing beyond its high (buy) / low (sell) completes it; a newer candle of the base's colour
  replaces the base, a close through the base's other side cancels it; a doji is never a base. The zone is the base candle wick to
  wick, known only from the completing close. `egTrades` output is unchanged except that an H4 and an H1 reading that are the same
  order are recorded once (the H4 one).
- **Engulfing plan / short method** (`methodTrades`): the M15 / M30 trigger zone is WHOLLY inside the H4 zone; the entry price is
  inside the H4 zone; the M5 entry zone must be at the zone (`atZone`) and is the M5 engulf completed by the candle that fails the
  opposite M5 zone when there is one (a failure inside the trigger's completing candle counts); a turned (EF) H4 zone dies once H4
  closes back through it (`turnBack`, also the gold plan's zones); setups are sorted by when they become known before the
  one-position rule (the old order was hindsight: an order could vanish with later candles). Direct entry: "left alone" = two CLOSED
  H4 candles. The short-method document's own example order is placed to the cent (fixture `tests/fixtures/xau-oanda-2024-05-01.json`)
  but not filled: the one-hour order life is an open owner question.
- **MSNR gold plan**: `snrSides` breaks the last H4 A / V turn that stood before the tap (a turn completed by the tap candle counts,
  walking back to the most recent unbroken one), searched from the tap, the window `SNR.boDays` 3 in TRADING days; the rejected Daily
  level must be fresh (a wick spends it, a body through refreshes it); Daily engulf zones in `direction()` use `engulfAt`; a QM break
  right after the head is kept; `snrTrades` takes ONE entry per visit of price to an H4 zone and side (a visit ends when a closed M15
  candle is wholly outside), then the 2-a-day cap; one order found by a 15- and a 30-minute trigger is one trade and one slot.
  msnr-main / msnr-other are labelled "Earlier scalp method" (the owner's own earlier pipeline, not a document's entry).
- **Mosha desk** (`assets/mosha-sop.js`; old behaviour by option for the pinned tests: `vr: 'major'`, `qm: 'internal'`, `box: 'candle'`,
  `janda: 'level'`, `table2: false`, `rsop: false`, `case2: false`): the VR, CF and barrier QM break the last 3-a-side swing BEFORE the
  extreme (`swingEv` / `smallEv`; the level moves only on a new extreme); a barrier's box runs from the broken level to the leg's
  origin extreme (`boxesOf`; the Charts layer's `msZones` is untouched); the Janda limit rests at the near side of the engulf pair
  inside the second BO's leg (stop unchanged); the second barrier table (H4→M30 `-c30-`, H1→M15 `-c15-`, M30→M5; M30 built from M15);
  "repeat SOP": after a barrier's QM a VR and CF one timeframe lower (`bar-sop-`), and inside the sequence's own CF zone a nested VR
  and CF with no QM first (`bar-sop-cf-`); one order under two ids is recorded once (`uniq` / `orderKey`: sequence over barrier, major
  BO over internal, higher timeframe first); a market entry whose next candle gaps past the stop books the gap; a CF inside the VR is
  its OWN reading (`sop-c2-`, `case2: true`, never mixed into the other kinds); every `sop-*` record carries `withWeekly` (last
  completed week's close against the week before) and `er20` (20-day efficiency ratio of Daily closes), tags only.
- **LIT desk** (`litTrades`, desk only; `council/lit.mjs` untouched): the method's daily limits on all three executions (one London and
  one New York-morning fill a day per market, a win ends the day, stop at −1.5R); a plain Asia high / low alone is not faded
  (`litAsiaAlone`); a re-sweep in `loose` / `break` is judged by the detector's own sweep tests, at most 2 inside one waiting period,
  smallest stop 0.014 % of price (skip, never widen); a repeated id is recorded once. `first: true` keeps the old reading for the
  desk-slices study, whose "every candidate" figure no longer reproduces on the new `break` set.
- **`research/edge/desk-exits`** is classed FAIL as a study (its "PASS" came from 1 of 60 comparisons that still loses after costs).
- **Found sound by the independent review** (cut tests on seeded and real candles): no look-ahead in zones, sides, barrier boxes, the
  small-swing VR or the VR retest; no record without a stop or with a stop on the winning side (about 12,700 records).
- **Open with the owner (not built; each changes the trades)**: the 30-pip stop at today's gold price (literal, share of price, or past
  the zone); the H4 candle clock (the documents' charts open H4 at 18:00 New York, the desk at midnight UTC: on the charts' clock the
  direct entry reproduces its document's zones to the cent); the turned-chart rule replacing the BO's CF entries (one document's main
  setup) or being added beside them; order lives (plan / short method, QM); which day the gold plan's 2-a-day cap counts on; one
  trade per H4 zone after a stop; a bad CF = overlap with the VR or any CF before price is back at the origin; the 50 % pullback;
  what ends a Janda; M30 or M15 under H1; a single holdout on 2007-2019 (draft pre-registration kept outside the repository; 2020-26
  has been read under too many definitions on 21 Nov to judge anything). Never present a desk total as evidence.
- Tests: `tests/edge-desks.test.mjs`, `tests/mosha-sop.test.mjs`, `tests/mosha-tracker.test.mjs`, `tests/desk-exits.test.mjs`.

## Equinox (23 Nov 2026, owner: "the edges that pass make their own individual desk in the website with calendar and the trades from january till now", "dont forget DOM", "make this as new desk switch called Equinox, will be in the switch bar like Chronos, Macro and Academy, don't display on normal desk")
A page of its own, `equinox.html` at `/equinox` (vercel.json rewrite, read by `cloudflare/src/routes.mjs`; built by
`scripts/equinox-page.mjs` in build.sh, which copies three blocks from market-structure.html into out/equinox.html: the council-data
reader `ms-data`, the Mosha desk's sheet `#ms-mosha-css` and the replay card `#mo-replay`, so there is one source). Eight desks
behind a tab row (localStorage `eq-desk`, a display preference): Break fade, Big-candle fade, Round-number fade, Box fade, FVG
return, Gold breakout, USD/JPY breakout, DOM zone (views `#v-fade` … `#v-dom`). Each: Open now, the trades with filters and tiles,
the P&L calendar, the log, "Chart" (the replay dialog, Before / After) and the live chart, drawn by the Desk's own
`assets/desk-trades.js` / `mosha-sop.js` / `mosha-replay.js` / `desk-live.js` (no second mechanism; desk-trades finds its views by
its `DESKS` keys). Signed out (or without the desks permission): "Sign in on the desk first". **The Desk is unchanged**: its desk
switch stays ICT | Mosha | LIT | Engulfing | MSNR; the header switch gains "Equinox" (`.hdr-eq`, class `adm`, hidden by
`html[data-deny~="desks"]`), and the side pages (Macro desk, ChronosTrade, Academy, Edge lab, /veteran/) carry the same link with
`data-mx-desks`, shown by `assets/mx-nav.js` to the owner and a member with the desks permission (an explicit `perms.desks`, else the
reviewer default); macro-desk.html and backtest.html now load mx-nav.js for it.
- **Tracker** `council/edge-desks-2.mjs` (`DESKS2`, spread into `council/edge-desks.mjs` `DESKS`): one adapter a desk that runs the
  study's OWN exported signal code (imported, never edited) on the tracker's OANDA 5-minute candles (every higher timeframe is built
  from them the studies' way) and writes the usual records. Rules: `fade` = grid7-wide-fade cell m15 none atr 2R all; `bigfade` =
  big-candle-fade m15 k1.5 nobreak half; `roundfade` = round-number-breaks fade other 2R; `boxfade` = fade-breaks-holdout F1; `fvg`
  = grid7-fvg-wide 1h mkt large 1R ("large" = each market's 2005-14 median from the study's result.json); `goldvb` / `jpyvb` = the T1
  breakout (`vbTrade` of the hourcost / index-vol-breakout copies); `dom` = the H1 dominant-zone limit as `council/dom-demo.mjs` arms
  it (buildZones('dom') on closed H1, the job's plan / arming / 24 h life / one order a zone / 3 a market; its constants are copied
  because dom-demo.mjs carries order code, and a test compares them and checks each record against the job's own `read`, `plan` and
  `armable`; not modelled: its 20-an-account cap and stale pause). `walk()` manages a position with ONE target in the order of the
  studies' `exits()` / `manage()` (a test compares R trade by trade); the studies' "risk under the round-trip cost" skip is kept.
  Every signal is a trade, as the studies counted them (several open at once); a breakout day whose 21:00 UTC has not come is open.
  Kinds `fade-m15`, `bigfade-m15`, `roundfade-m15`, `boxfade-m5`, `fvg-h1`, `goldvb-t1`, `jpyvb-t1`, `dom-h1` (`mosha-desk.mjs`
  `clean` takes them; `merge`'s 20-minute "same trade re-read" rule never applies to them).
- **Markets**: the five fade / gap desks the studies' ten; DOM the job's eighteen. `assets/mosha-sop.js` `ALL` gained nzdusd,
  usdchf, eurjpy, gbpjpy, audjpy, cadjpy, eurgbp, euraud; the LIT and MSNR desks are pinned to their former eleven (`ELEVEN`).
- **Loop**: council.yml runs the eight on a line of their own every 3rd round, `timeout 150` (`--only fade,…,jpyvb,dom`; one read of
  a market's candles serves every desk of the run); the older line is `--only eg,msnr,lit`, 280 s unchanged. `--only` takes a comma
  list; `--from YYYY-MM-DD` starts the records there (the backfill: `--days 330 --from 2026-01-01`). `datahealth.mjs` lists the
  eight files (warn 6 h). `dom/desk.json` sits beside the demo job's `dom/trades.json` (its own file, its own `detail/`).
- **History** (council-data, pushed 23 Nov 2026, light files + `detail/<day>.json`), 1 Jan to 23 Nov 2026, before costs, mean R a
  closed trade: Break fade 15,582 records (+0.073R), Big-candle fade 4,328 (+0.180R), Round-number fade 12,567 (−0.007R), Box fade
  11,048 (+0.033R), FVG return 4,323 (+0.071R), Gold breakout 175 (+0.300R; its 16 and 18 Nov trades equal the forward record's,
  +0.756R and +3.575R), USD/JPY breakout 158 (+0.137R), DOM zone 18,696.
- **Page text** per desk: the rule, its study and verdict in words (the five fade / gap rules passed before costs and LOSE after
  costs; the breakouts passed at the broker's own quotes on in-sample years, their forward records too short; DOM passed before costs
  on mid candles, a random recent body does as well, and at the broker's bid / ask it lost, −0.111R a filled trade, n 1,706, month t
  −3.73), and that each desk is a paper record of the rule, not a trade signal. Never call a desk total an edge. Not in the decision
  journal's Take / Skip list (`MS_JOURNAL.DESKS`).
- PAPER RECORDS ONLY: no order, alert, broker or mirror code; a record without its stop on the losing side is never stored.
  Tests: `tests/edge-desks-2.test.mjs` (each adapter against its study's / the job's functions on a seeded market, stops, a cut
  test, the page and the Desk's link).

## H1 dominant zone on the Council demo account (23 Nov 2026, owner: "Do h1 dom (all markets) to one of the demo acc use the one with no trades active")
`council/dom-demo.mjs` (council.yml: each round after the breakout job and each quick pass, `timeout 45`, never fails the round):
the one family the three combination grids found before costs (`research/edge/combo-grid-3`), as a forward DEMO record. Zone = the
grids' own `buildZones('dom')` (imported from combo-grid-3): two consecutive CLOSED H1 candles of one colour, the second closing
beyond the first's extreme; zone = the first candle's body; it stands until a closed H1 candle closes through its far side or 120
H1 candles pass (a forming candle never makes or ends one). Order: a LIMIT at the near edge, stop = far side -/+ (half the
round trip of combo-grid-2 `COSTS` + 0.25 x ATR(14) of H1), target 2R, `stopLoss` and `takeProfit` absolute on the order,
GOOD_TILL_DATE 24 h. Armed only for a standing zone on the right side of the price whose near edge is within 1 x ATR(14), one
order per zone ever (id `<market>-<side>-<first candle time>`, comment `dom <id>`, label `dom`); a resting order is cancelled as
soon as its zone no longer stands; expired orders are not re-armed; a stale market (newest candle over 2 h old) arms nothing.
Markets: xau xag, the 13 forex pairs of the grids, nas100 spx500 de40 (broker names by `normName`; a market the account does not
offer is logged and held off a day, `notOffered`). Account: the Council demo account (`CTRADER_ACCOUNT_ID`, the mirror's
'council' book); `config.json` `dom.account` overrides. Caps: 3 orders + positions a market, 20 of its own on the account; risk
0.5 % of the balance (owner, 23 Nov 2026) (`dom.risk` 0.0005-0.005; the vb minimum-volume rule, at most 1 %); `dom.markets` may narrow the list;
`config.dom = { on: false }` stops it. Rule 1: a fill is read back (no stop: amend, refused: closed at once) and any 'dom' position
with no stop and no record is closed. The closing deal is not read (the mirror's allowlist has no deal list): an exit is inferred
from the H1 candles after the fill (stop first in one candle) and marked `inferred`. Record: council-data `dom/trades.json`.
`council/forward.mjs` E5 leaves 'dom' out (the label on positions and orders, `api/ctrader-link.js` now carries it on orders;
closing deals by the position / order ids of `dom/trades.json`, which the Trader passes as `dom`). The mirror manages its own
label only. Note: the mirror's daily loss stop (`LIMITS.dayStop` 2 %) reads the account balance, so a bad day of this job on the
Council account can hold the live book's new copies for the rest of that UTC day. A forward demo record of a before-cost tilt,
NOT an edge (every grid failed after costs); the holdout test `research/edge/dom-zone-holdout` is pending. Test:
`tests/dom-demo.test.mjs`.
**Moved to the new $100 demo account, 1 % a trade** (24 Nov 2026, owner: "theres an account that got 100 usd put the mosha dom trading
there risking 1% per trade", "Its a new account", "Ending 6154", "DOM zone"): owner rule `dom-demo-6154` sets `config.dom = { account:
'*6154', risk: 0.01 }`. `council/gotobi.mjs` `connect` takes `*<digits>` = the ONE demo account on the token whose login ends so
(two, or only a live one: refused, nothing sent). `RISK_MAX` 0.01. A record carries `acct` (a tag `…6154`, never the number); a pass
reads, counts and caps only its own account's records, so the orders and positions left on the Council account run out at the broker
with their own stop, target and 24 h expiry (their records stay "placed" / "open" in the file). On $100 the smallest lot often risks
more than 1 % (then that order is a `skip`). Before 24 Nov the job traded the Council account at 0.5 %.

## Why the desk totals fell, 30 pips in each market's own pip, EG barriers, the trade chart (22 Nov 2026, owner: "find why the before that were positive became negative and find a solutin, plus a barrier can be an eg aswell"; "the stop is not 3$ but 30 pips so convert it to points"; "i would like to resize ... and i want timeframes from 1minute m5 m15 m30 h1 h4 daily")
Old and new code were run on the same candles (three markets, 2026) with one change at a time. PAPER READINGS before costs: none is a tested edge.
- **Engulfing plan / short method**: the fall is gold (and silver / Nasdaq), not forex (EUR/USD and GBP/USD stayed about zero). Two causes:
  (1) the any-number-of-candles engulf (the owner's answer of 21 Nov) made about five times as many gold trades, winning 24 % at a 2R
  target (33 % breaks even): gold plan 100 trades / −10R with the next-candle engulf against 523 / −148R; (2) on gold the stop sits
  INSIDE the zone the order rests at: 30 pips = $3.00, the M5 entry zone's median width is $3.92, the mean M5 candle $4.65 (the gold
  plan's M15 zone is wider than the stop on 98 of 100 trades). Entry edge (wick / body / middle), stop past the zone and the trigger's
  span were tried: no setting makes gold positive. The earlier "positive" totals were within noise of zero (gold plan +5R on 157).
- **Mosha barriers**: no single change is the cause. Win rate 26 % before and 25 % after at a 3R target (25 % breaks even); each change
  alone on gold since August stays about where the old code was (old 996 / +78R, box 1,271 / +167R, QM 447 / +35R, Janda 880 / +50R).
  The published −35R is GBP/USD (−126R) and month-to-month noise.
- **The stop is 30 pips in the market's own pip** (`council/eg-methods.mjs` `PIP`, `pipOfMarket`, `stopSize`; plan, short method, direct
  entry, gold plan): a pip is ten points: gold 0.10 (300 points = $3.00), silver 0.01, a five-decimal pair 0.0001 (0.0030), a yen pair
  0.01, an index one point. Until then other markets took gold's $3.00 as a share of price (EUR/USD about 8 pips). Gold is unchanged.
  On 2026: EUR/USD plan 56 / +13R, short method 71 / +10R; GBP/USD 104 / +25R and 67 / +8R (fewer, longer trades; not evidence).
- **An engulf (EG) zone is a barrier** (`assets/mosha-sop.js` `egBoxes`, a page copy of `engulfAt` / `zones` compared by a test;
  `zonesOf` adds them after the BO origins; `eg: false` or `box: 'candle'` leaves them out): id part `eg-`, label "H4 EG barrier",
  flag `eg`, read back by `readings()`; the same confirmations, stop and 3R as any barrier; a reading of its own in the 20-minute
  rule, and an order a BO origin already gave is not recorded twice. Gold since August: about 420 more entries, 25 % winners.
- **Fixed**: a barrier trade from before the one-minute candles on file was settled on their first candle (weeks later, tens of R):
  it is read on the 5-minute candles (`barrierTrades`, the outcome line). The live tracker's window was not affected.
- **Trade chart** (`assets/mosha-replay.js`, dialog `#mo-rp-dlg`): a desk trade offers M1, M5, M15, M30, H1, H4, D1 (`DESK_TFS`;
  M15 / M30 / H1 from the window's candles; M1, H4 and D1 are their own candles read when first chosen: a day and a half around the
  entry, 40 days, 200 days; `pickTf`, `ownBars`); "Bigger chart" (`[data-rpd="big"]`, `.mo-rp-dlg.big`) fills the screen and the
  chart's lower edge drags (`resize: vertical`). Before still ends at the last candle closed at the entry on every timeframe.
- **Both engulfs, side by side** (owner, 22 Nov 2026: "Keep both"): `methodTrades(B, { span: 'next' })` reads the plan and the short
  method with the next-candle engulf on every timeframe (`zones(C, tf, 1)`): kinds `eg-plan-n` / `eg-simple-n`, label "… · next-candle
  EG", their own one-position rule, no direct entry; the Engulfing desk records both readings (`DESKS.eg.read`). The any-candle
  kinds are unchanged. The MSNR gold plan keeps the any-candle engulf only.
- Open with the owner: a 2007-2019 holdout before anything is called better. Tests: `tests/edge-desks.test.mjs`, `tests/mosha-sop.test.mjs`
  ("an engulf (EG) zone is a barrier too"), `tests/mosha-replay.test.mjs`.

## The best part of each desk as one rule, tested on 2007-2019 (22 Nov 2026, owner: "check the trades from all edges, and get the best of each one", "test it", "run")
`research/edge/h4-zone-trail/` (PREREGISTRATION.md committed alone first; `fetch.mjs`, `run.mjs`, RESULT.md, result.json). The
desks' 31,500 closed 2026 paper records were split part by part (direction, key level, confirmation, entry, stop, target,
hours; before costs, about 200 comparisons). What looked best: a Daily / H4 level, no lower-timeframe confirmation and no
direction filter, a stop past the zone, no target with a trailed stop (the ICT desk's exit), no entries 17:00-24:00 UTC. The one
rule those give (an H4 next-candle engulf zone, limit at its near edge, stop past the far edge, trail 1R behind from +2R, out
after 40 hourly candles; gold, EUR/USD, GBP/USD) on OANDA H1 2007-2019, net of the desk-rigor costs: **FAIL**, pooled -0.027R a
trade (n 6,253, month t -1.33; +0.014R before costs); gold +0.035R (t 0.98), EUR/USD -0.067R, GBP/USD -0.048R. The trail loses
less than a fixed 2R target (-0.067R) and skipping the late hours a little less, neither enough. The question is closed: no
variant of this rule on 2007-2019, and never build a rule from the desks' best-looking splits without a holdout. Nothing live
changed. Test: `tests/h4-zone-trail.test.mjs`.

## The earlier scalp method: an EG is two candles, the zone is the first one (22 Nov 2026, owner on a GBP/USD sell of 20 Nov: "u marking eg wrong, next candle needs to close, remember eg is a 2 candle pattern that the second (right) engulfs the first candle (left)")
`council/edge-desks.mjs` `msnrTrades` (kinds `msnr-main` / `msnr-other`): the chart's "M15 EG" and "M5 EG" boxes were the range of
BOTH candles of the pair, so the box looked like the second candle; each is now the FIRST (left) candle, wick to wick. And the
study's candidates (body engulfs) are taken only when the second candle of the 15-minute pair and of the 5-minute pair closes
beyond the first one's high (buy) / low (sell) (`eg2`), the owner's rule of 21 Nov. Stop, target and the 45-minute arming are
unchanged. Stored closed records keep their old marks until the MSNR history is rebuilt. Open with the owner: whether a later
engulf that forms INSIDE an earlier EG zone still alive counts (his example: 13:45 / 14:00 yes, 14:15 / 14:30 no, though the
14:30 candle did close below the 14:15 low), and whether the Engulfing desk's any-number-of-candles reading should go now
that an EG is two candles. A paper reading, not an edge. Test: `tests/edge-desks.test.mjs`.

## An engulf completes within four candles (22 Nov 2026, owner: "the next 3 max 4 candles we must have a eg, more than that not"; on 35 marked examples of four charts: "yes all right")
`council/eg-methods.mjs` `EG_SPAN` 4, the default of `engulfAt`, `zones`, `triggers` and `methodTrades` (it was any number of
candles, the owner's 21 Nov answer): the first candle is the last candle of the other colour, a candle at most four candles after
it that closes beyond its high (buy) / low (sell) completes the EG, the zone is the first candle wick to wick. Every reader
follows: the Engulfing plan / short method / direct entry, the MSNR gold plan and the direction's Daily EG levels, and the Mosha
desk's EG barriers (`assets/mosha-sop.js` `egBoxes`, the page copy, same span; a test compares). The Engulfing desk's
`-n` kinds (next candle only) stay beside them. The earlier scalp method still takes two neighbouring candles only (`eg2`), a
subset. The owner's 14:15 / 14:30 "no" of that day was the box drawn over both candles, not the pair: with the box on the first
candle he passed it. Stored records keep the older rule until the histories are rebuilt. Readings, not tested edges.
Same day, owner: "the less candles the better": a zone carries `n` (candles the engulf took) and the entry zone's chart label says it ("M5 EG zone · entry · 1 candle", `egN`). Shown, not a filter.

## M1 EF entry inside an entry zone (22 Nov 2026, owner: "inside the entry zone i want m1 buy eg to become ef to entry for sells, for buy i want in the entry area a sell m1 eg to fail thats my moment to entry"; on six marked examples: "example 3 use the recent one and the rest is perfect")
`council/eg-methods.mjs` `m1Trades(B, { from, market })` (`M1E`), a fifth reading on the Engulfing desk (kind `eg-m1`, label "M15 EG
zone · M1 EF entry", `l: '1m'`; `DESKS.eg.tfs` now reads `'1m'`, 16 days): the entry zone is an alive 15-minute engulf zone of the
trade's side; wholly inside it, formed after it, a one-minute engulf of the OTHER side; a one-minute close through that engulf's far
side (it failed: an EF on the trade's side) is the entry, at that close. Of several such engulfs only the MOST RECENT counts (an
older one failing while a newer one still stands is no entry). A zone can give several entries (the owner's first example is a
second visit); one position at a time a market. The desk's own choices, shown on the examples and not the owner's words: stop past
the extreme made between the engulf's first candle and the failing candle by 0.01 % of price, target 2R; read on the one-minute
candles from the candle after the entry. The M15 zone only (M5 / H4 entry zones were not asked for). A paper reading, not a tested
rule. Test: `tests/edge-desks.test.mjs` ("M1 EF entry").

## Each reading keeps its best target (22 Nov 2026, owner: "check how will be if i target 1r 2r 3r 4r", "i meant all edges", "base on that keep the best rr for each individual one")
Every closed 2026 record of the Mosha, Engulfing, MSNR and LIT desks was replayed alone from its own fill and opening stop on
5-minute candles with a plain 1R / 2R / 3R / 4R target (stop first in one candle, a 5-day limit, before costs) and set beside the
desk's own booked exit. No desk total is positive at any target, and the share of trades reaching the target sits at break-even
(about 49 / 32 / 24 / 19 %) on every desk. The owner chose to keep, per reading, the best of the five. PICKED IN SAMPLE on one
year before costs: a choice, not a tested result; never quote the rebuilt totals as evidence.
- **Changed**: Mosha barrier 3R -> 1R (`assets/mosha-sop.js` `BARRIER_R`; `barrierTrades(…, { rr: 3 })` reads it the older way for the
  pinned tests; CF / VR barriers keep their structural target when it is 1R or more away). Engulf rule on D1 and H4: a 4R target,
  no trail, 5-day limit (`council/edge-desks.mjs` `EG.fixed`; an H4 and an H1 reading of one zone are two trades now, two exits).
  Engulfing plan, plan next-candle, short method: 1R; short method next-candle: 4R (`council/eg-methods.mjs` `RR`). Earlier scalp
  method: 4R in the 12-16 UTC window, 3R at other hours, 5-day limit instead of 12 hours (`MSNR.rrMain` / `rrOther` / `hold`).
  MSNR gold plan: 2R (60 pips; 90 before).
- **Kept, their own exit was best or equal**: Mosha sequence, Engulf H1 (10R with the trail), the M1 EF entry (2R), the gold plan's
  QM entry (3R), LIT rule and LIT loose. **Kept on purpose**: the direct entry (its document's exit; 4R was 4.6R better on 44 trades)
  and LIT market on the break (its structural target; 1R and 3R tied 4.6R better on 138 trades): both differences are noise.
- The one group that rose steadily with the target is the scalp method at 12-16 UTC (+22.6R at 1R to +68.1R at 4R, n 551, before
  costs): one of eighteen groups, picked after looking, and the same method failed its after-costs study on earlier years. A
  hypothesis for a pre-registered test on other years, never an edge.
Tests: `tests/edge-desks.test.mjs`, `tests/mosha-sop.test.mjs`.

## The desks keep 60,000 records (22 Nov 2026, owner: "raise the limit so it goes back to january")
`council/mosha-desk.mjs` `KEEP` 14,000 -> 60,000 (shared by the Mosha tracker and `council/edge-desks.mjs`). With the M1 EF entry
and the 1R barriers 14,000 records held only about six months, so the Mosha and Engulfing histories started in May. The light
`desk.json` the page reads grows with it (about 0.35 KB a record). Never publish a file of over 14,000 records to council-data
before main's tracker has this limit (the older tracker cuts the file on its next run).

## Chart marks, one colour a kind (22 Nov 2026, owner: "use different color on the markins when u mark")
Display only, `assets/mosha-replay.js` (`HUES`, `hueKey`, `hueOf`): on a desk trade's chart each mark takes a colour from its
label: EF red, the entry zone blue, CF green, VR orange (its own box as before), the 50 % line grey, a Daily level purple, H4
amber, H1 teal, M30 / M15 pink, M5 / M1 cyan, a BO or plain level brown; two shades, for dark and light. The position's stop
and target bands are unchanged.

## The four desks part by part: keep / drop (22 Nov 2026, owner: "recheck every part of the edges … find what to drop and what to keep", "follow market structure")
`research/proposals/2026-11-22-desks-keep-drop.md` (a proposal; no desk rule changed). The desks' 50,049 closed 2026 paper
records split after the fact, before costs: every desk is at zero (Mosha -0.010R, Engulfing -0.011R, MSNR +0.007R, LIT
-0.053R a trade). Trading WITH the M15 / H1 / H4 / D1 structure was not better than against it, alone or stacked (with H4
-0.030R, against +0.012R, n 49,880): the owner's hypothesis does not hold on these records. The one consistent difference:
the next-candle engulf beats the four-candle engulf on the plan and the short method. A half-size stop with a 1R / 2R target
(M1 EF entry, 30 days on one-minute candles, n 1,271) is inside noise of zero and doubles the cost in R. The document
differences five independent readers found are listed there as 21 owner questions (their notes stay outside the repository).
Same day: the desk notes that still named the older targets and "any number of candles" were corrected (text only).
In-sample splits: never quote one as an edge.

## Lower-timeframe structure as an entry permission, tested (22 Nov 2026, owner: "you are not marking market structure on the lower timeframe")
`research/edge/ltf-structure/` (PREREGISTRATION.md committed alone first; `run.mjs run <trades dir> <candles dir>`, RESULT.md,
result.json). The one condition that looked best on the desks' 2026 records (+0.070R a trade, n 1,835, in sample, before costs):
at the entry the last H1 break is with the trade, the last M15 break is a structure shift with the trade known at most 6 hours
before, and the last M5 break is with the trade (the page's `msAnalyze(bars, 6)`, candles closed by the entry only; whole-series
reading checked against cut series on 1,800 random cuts, 0 mismatches). On the desks' own 112,330 trades of 2020-2025 (gold,
EUR/USD, GBP/USD, the desk-partial files), after the desk-rigor costs, IS 2020-23 / OOS 2024-25, 12 groups and the pool, Holm
over 26 tests, placebo = the structure against the trade. **FAIL, 0 of 13**: the condition keeps 3.6 % of trades; pool out of
sample −0.167R a trade with it (n 1,261, month t −2.77) against −0.102R without (difference −0.065R, Welch t −1.49); Mosha
barrier entry −0.090R with (n 584) and −0.090R without; no group reaches a positive month t of 2, the largest out-of-sample
Welch t for "with beats without" is 0.23; the placebo passes nowhere. The 2026 split did not repeat: agreeing with the lower
timeframes' structure does not pick the better trades of these readings. One run, no variants: the question is closed on
2020-2025 (no other timeframes, look-backs or freshness windows). Nothing live changed. Test: `tests/ltf-structure.test.mjs`.

## The barrier with its older 3R target, kept beside the current one (22 Nov 2026, owner: "add the old barrier as different separate", "the old barrier I mean is the one with higher R")
`assets/mosha-sop.js` `oldBarrierTrades(B, F, { from, market, extra })` (`OLD_BARRIER` = `{ rr: 3 }`): the SAME barrier entries as
the current reading (zones, confirmations, entry, stop; the tap entry included) with the 3R target the desk used until 22 Nov 2026
instead of 1R. Entries whose target is not the fixed one (a CF / VR barrier's structural target, the repeat of the SOP, a failed
QM) are the same trade under both and are not recorded twice. A reading of its own: ids `bar-old-…`, flag `old`, label "· 3R
target", `readings(r).old` (read back from a stored id); joined AFTER the current list in the tracker (`council/mosha-desk.mjs`
`build`) and the browser replay, so it never replaces a current record, and the 20-minute rule compares it only with its own
reading. Desk: chip "Barrier, 3R target", its own line under "By entry type"; "Barrier entry" and every barrier split count the
current reading only. It about doubles the barrier records on file. The tracker adds it for its 14-day window; older history
needs a `--days` rebuild. A paper reading before costs, never an edge. (A first version the same day read the barrier the way the
code did before the 21 Nov re-read; the owner meant the target.) Test: `tests/mosha-sop.test.mjs`.

## The barrier with a 6R target, a third reading (22 Nov 2026, owner: "check if the mosha 3r barrier on 4r 5r 6r", then "Yes add the 6r target")
On the 60 days to 21 Nov 2026 (gold, EUR/USD, GBP/USD, before costs) the barrier entries with a 3R / 4R / 5R / 6R target made
+0.044 / +0.075 / +0.088 / +0.112R a trade (about 9,900 trades; 26 / 22 / 18 / 16 % reached the target; GBP/USD near flat at every
target). `assets/mosha-sop.js` `r6BarrierTrades` (`R6_BARRIER` = `{ rr: 6 }`) records the same entries and stops with a 6R target
beside the 1R and 3R readings: ids `bar-r6-…`, flag `r6`, label "· 6R target", `readings(r).r6` from the id, one-candle structure
(`sixCandle` false), its own reading in the 20-minute rule; desk chip "Barrier, 6R target" and its own line. Picked after looking at
one 60-day stretch before costs: never quote it as an edge. Test: `tests/mosha-sop.test.mjs`.

## 5R and 6R on the other desks (22 Nov 2026, owner: "Any of these changes can improve the other edges?", then "the changes you think are best")
The desks' closed 2026 records (the 22 Nov 03:04 files) were replayed alone from their fill and opening stop on 5-minute candles
at 1R to 6R (stop first in one candle, 5-day limit, before costs). Only one reading rose steadily with the target: the earlier
scalp method in its 12-16 UTC window (`msnr-main`, n 551): +23 / +45 / +57 / +68 / +70 / +102R at 1R-6R. Its target is now 6R
(`council/edge-desks.mjs` `MSNR.rrMain` 4 -> 6); other hours stay 3R. Not changed: the engulf rule on D1 / H4 (4R; 6R was
+28R against +26R / +0R, not steady), H1 (its trail), the plan / short method / M1 EF / LIT / gold plan readings (lose at every
target or no steady rise). The same replay on the OLDER Mosha barrier records was best at 1R and worst at 5-6R, against the
60-day run on the current code where 6R did best: the barrier's best target is not stable; the 6R barrier stays a separate
reading so its record can show it. Picked in sample, before costs: never quote as an edge.

## A failed QM at a barrier against the direction is traded with the direction (22 Nov 2026, owner on a GBP/USD buy of 20 Nov: "this should be a sell not buy", "there is no new BO, the recent high closed below, remember BO, VR, CF / repeat SOP", "stop above VR, target last low")
`assets/mosha-sop.js` `barrierTrades`, the repeat of the SOP at a barrier, only where the barrier is AGAINST the direction of the
timeframe above (`wd === false`): once a candle of the confirmation timeframe, after the lower-timeframe VR, closes back through the
QM level, the QM made no new BO: the repeat gives no entry (it used to take a later CF), and that close is the CF with the
direction: a market entry at that close the other way, stop past the VR's extreme (the top the rejection made) by the desk's
buffer, target the last low (high for a buy) since price came back to the barrier; no minimum R (not answered: some targets are a
few pips). Record: id `bar-sop-f-…`, flags `rsop`, `qmFail`, `withDir: true`, label "… · QM failed · with H4"; `readings(r).qmFail`
is read back from the id; its own reading in the 20-minute rule. `fail: false` reads it as before. Barriers with the direction are
unchanged (there a pullback through the QM level is the sequence's own). On GBP/USD 18-20 Nov: 2 buys gone (−2R), 10 entries
added (+1.4R before costs). A reading, not a tested rule. Test: `tests/mosha-sop.test.mjs`.

## M1 BO at the tap of a barrier (22 Nov 2026, owner on the same GBP/USD chart: "when tap he could wait M1 BO buy to take the trade, SL at M1 BO low")
`assets/mosha-sop.js` `barrierTrades`, `run('1m', B['1m'], 'tap')` for every barrier visit (not in the older reading; `tap: false`
leaves it out): the first M1 BO Structure with the barrier after price came back (the same QM test as the table's confirmation,
read on M1) is a MARKET entry at that candle's close; stop past the extreme made at the barrier up to that close (the M1 BO's low
for a buy) by the desk's buffer; target the desk's barrier target (`BARRIER_R`, 1R: the owner named none). Record: id `bar-tap-…`,
flags `tap`, `mkt`, `l: '1m'`, label "… · M1 BO at the tap"; `readings(r).tap` from the id; its own reading in the 20-minute rule.
No other record changes (test). On GBP/USD 18-20 Nov: 45 entries, 27 reached target, +10R before costs (three days of one
market: not evidence; an M1 stop is a few pips, so costs take a large share). Test: `tests/mosha-sop.test.mjs`.

## Three-timeframe SOP on the Engulfing desk; an engulf completes within three candles (22 Nov 2026, owner's table: marking zone / engulf at the zone / confirmation = Daily / H4 / H1, H4 / H1 / M15, H1 / M15 / M5, with three pictures of an engulf completed by the 1st, 2nd or 3rd candle; then "Change to 3 candles")
`council/eg-methods.mjs` `sopTrades3(B, { from, market })` (`SOP3`), a sixth reading on the Engulfing desk (`DESKS.eg.read`; kind
`eg-sop3`, id `<market:>eg3-<zone timeframe>-<b|s><order time>`, label "D1 zone → H4 EG → H1 CF", `h` = the zone timeframe, `l` =
the confirmation timeframe, tag `style` swing / intraday / scalp, which `council/mosha-desk.mjs` `clean` now keeps). Per chain:
(1) a marking engulf zone on the first timeframe, still alive, gives the side; (2) price comes back into it (a closed candle of the
second timeframe trades into it) and an engulf of the same side then completes on the second timeframe, its zone touching the
marking zone; (3) an engulf of the same side then completes on the third timeframe, its zone touching the second one's, both higher
zones alive. Entry: a limit at the MIDDLE (50 %) of the third zone; stop past the far side of the SECOND timeframe's zone by the
desk's buffer ($0.30 on gold, the same share of price elsewhere); target 2R; a trade ends at its stop or its target; on a
limit's fill candle only the stop counts. One order a confirmation zone (the most recent engulf zone behind it), one position at a
time per chain and market (by fill time; of two fills in one candle the order known first). The desk's own choices, said in the
code and on the desk: the confirmation within 24 candles of its timeframe, the order alive 24 such candles and cancelled by a
close through the second zone's far side, exactly 2R, the one-position rule. Read on the candles the desk already had (no new
timeframe; an order placed before the 5-minute candles on file is not read). Page (`assets/desk-trades.js`): the filter chip
"Three-timeframe SOP" (`KN`), the style beside each row's label, the "What this is" text.
**An engulf completes within three candles on every desk** (owner, 22 Nov 2026: "Change to 3 candles"; it was four, the owner's
earlier "3 max 4"): `EG_SPAN` 3 in `council/eg-methods.mjs` and in the page copy `assets/mosha-sop.js` `egBoxes`. The next-candle
kinds (`-n`) and the earlier scalp method's two-candle rule are unchanged; stored records keep the older rule until the
histories are rebuilt. On the test's seeded market: plan 26 -> 22 trades, short method 30 -> 27, direct entry 2 -> 2.
A paper reading of the owner's table before costs, not a tested rule: never call its total an edge. Tests:
`tests/edge-desks.test.mjs` ("three-timeframe SOP": three tests; "an engulf completes within three candles").
**Three fixes measured, none adopted** (22 Nov 2026, after the owner's 2-loss / 1-win charts): `sopTrades3` takes comparison options
(`conf: 'inside'` the confirmation zone wholly inside the engulf's; `stop: 'conf'` past the confirmation zone / `'pips'` 30 pips;
`target: 'zone'` the nearest opposite engulf-timeframe zone 1R or more ahead; `rr`); the defaults are the desk's reading (test). On the
last 60 days of the five markets, before costs, no option or mix makes the H4 or H1 chain positive (best H4 −11.4R on 254 trades with
the stop past the confirmation zone; every H1 variant −30.8R or worse); the D1 chain is 18-76 trades in any variant. In sample and
picked after looking: nothing changes on the desk without the owner, and never quote these as evidence.

## ChronosTrade audit: the Topstep check and a first-day failure (22 Nov 2026)
The audit's "Topstep challenge, 121 steps over 9 timeframes … firm days" check failed on every run from 22 Nov 00:00 UTC (main
passed through 21 Nov 23:50). The page and the engine were right. Cause: the Nasdaq quick start opens 10 days back, on 22 Nov
that is 12 Nov 07:00 UTC, and the check's blind trades (buy, sell, buy … at 0.6 % each) were stopped seven times in a row, so
the Combine failed on its 4 % maximum loss at 18:00 UTC of its FIRST firm day; an ended challenge records no further day, and
the check needs a day change (2+ firm days). Fix (`scripts/audit/chronostrade.cjs` only): the risk a trade is worked out from
the firm's own rules (0.11 %: 21 trades at most, all stopped = 60 % of the maximum loss, all at their 2R target = 90 % of the
profit target), so the challenge stays live through the steps on any date; if it still ends on day one the check fails and says
why. Run with the page's clock set to 16, 21 and 22 Nov: 6, 7 and 6 firm days.
Also date-dependent (found by a second session on a Sunday start, its pull request #1365 joined in here): a switch up that
lands on the higher timeframe's own boundary forms no candle; the audit then goes back, takes one more compared step on the finer
timeframe and switches again (at most 3 times; the risk sizing counts those extra steps).

## A SOP inside the SOP: the VR and the CF each start a lower-timeframe sequence (22 Nov 2026, owner: "on mosha you need to repeat sop inside sop. Bo1 vr ( start new low time frame sop bo vr cf for sells if bo1 is bullish, and buys if bo1 is bearish), CF (start new low time frame sop bo vr cf for buys and main structure as well)")
`assets/mosha-sop.js` `sopTrades` (`nestAdd`, `nestRun`). The main sequence (BO on h, VR and CF on l, the EG entry) is unchanged
and recorded as before. Beside it, each of its two breaks is read as a BO one timeframe lower (`LOWER[l] || DOWN[l]`: H4 → H1,
H1 → M30, M30 → M15, M15 → M5, M5 → M1; M30 built from M15 where none is handed in; no candles = nothing) and a whole BO, VR, CF
is waited for there with `msMosha`: the **VR leg** (id `sop-nv-<tf>-<b|s><t>`, `nest: 'vr'`) against the first BO (sells under a
bullish BO, buys under a bearish one), read until the main CF forms or a lower candle closes back beyond the main VR's extreme;
the **CF leg** (`sop-nc-`, `nest: 'cf'`) with the first BO, read until a lower candle closes through the CF zone's far side; a
main CF inside its VR (the "likely to fail" case) starts one too, said in its log (`cfIn: true`; `case2: false` leaves it out). A
leg first seen late (its break known only once the BO's candle closed) takes no entry from before it was seen. Both at most `BARRIER_WATCH` candles of
l. Entry, stop and target are `msMosha`'s own (EG close, stop past the pullback's extreme, target the nested VR's extreme; the
repeat SOP's size and losing-side checks; a nested CF inside its VR is skipped); one record a main sequence and leg. Record:
`kind: 'sop'`, `h` = l, `l` = the lower timeframe, `up` = h, `of` = the first BO's side, label "H4 BO → H1 VR → M30 SOP inside
the VR". No hindsight: a leg is registered at the candle whose close shows its break, walked one closed lower candle at a time
with the main sequence as the last closed l candle left it, and the entry is taken only at the candle whose close is its EG.
`o.nest === false` leaves them out. `uniq` ranks them last (an order another reading already gave keeps the other id);
`council/mosha-desk.mjs` `merge` reads each leg as its own reading from the id; the desk names them (`isNest`, `kindText`) and
lists "SOP inside the VR (against the BO)" / "SOP inside the CF (with the BO)" apart from "BO, VR, CF". A reading, not a tested
rule: never quote its record as an edge. Test: `tests/mosha-sop.test.mjs` ("a SOP inside the SOP"; the older tests read the list
with `nest: false`, `ST` is the whole one).
**The CF one timeframe under the VR** (same day, owner sent the method's own timeframe table for BO / VR / CF): D1 → H4 → H1,
H4 → H1 → M15 (owner, same day: "one of them is h4 h1 m15 (not m30)"), H1 → M30 → M15, M30 → M15 → M5, M15 → M5 → M1 (`CFTF`: the VR's timeframe → the CF's; M1 stays M1). The BO on h and
the VR on l are read as before (the same VR event, box and extreme); the CF, the pullback into its zone, the EG, the stop and the
fill are read on the CF timeframe by a walker per sequence (`walkAdd` / `walkRun`: `msMosha`, untouched, gets the l timeframe's
VR as its first event and the CF timeframe's small breaks after it, one closed candle at a time; the "CF inside the VR" case
and the target are judged against the l timeframe's VR). Records keep their id shape (`sop-<l>-<EG candle>`), carry `ll` = the
CF timeframe and the label "H4 BO → H1 VR → M30 CF". `cf: 'same'` reads the CF on l as before (the older tests pin it); with no
candles of the CF timeframe the CF is read on l and the log says so. The CF zones handed to the barrier entry (`cfOut`) are on
the CF timeframe now (an M5 or M1 CF zone has no barrier table, so it gives no barrier entry). The nested legs follow the table:
the SOP inside the VR one step under the VR's timeframe, the SOP inside the CF one step under the CF's (M1 on M1). The table's
last row (M5 → M1 → M1) is NOT a ladder step: `LADDER` still ends at M15 → M5. The tracker already reads every timeframe the
table needs (`BACK`: M1 16 days for a 14-day window), nothing changed there. A reading, not a tested rule. Test: "the CF one
timeframe under the VR".
**"Both": where the CF may form, and a limit at the CF line** (same day, owner on the method's own drawing of the sequence: BO,
the VR at the extreme, price back near where the BO broke, the CF there, then "pullback & entry" at the CF line; asked which
of the two readings, he answered "Both"). (B) A CF counts only once price, after the VR, has traded back to the level the BO
broke (a buy BO: a low at or below it), on closed candles up to the CF's own candle (`backEv`; an earlier break with the BO is
handed to `msMosha` as a continuation break, a later one can still be the CF). Every sequence record carries `back: true` and its
log says so; the nested legs read the same rule on their own BO (the VR / CF break they start from). `cfBack: false` = as before.
(A) Beside the EG entry, a plain limit at the CF line (the level the CF's break took): id `sop-l-[i-]<l>-<b|s><fill>`,
`cfLimit: true`, label "… CF · limit at the CF line", `known` = the close of the CF-timeframe candle of the fill. It rests from
the CF candle's close until price reaches the VR's extreme, a CF-timeframe candle closes through the CF zone's far side, or
`CF_LIMIT` 24 CF-timeframe candles pass (the desk's choice). Stop past the CF zone's far side by the desk's buffer, target the
VR's extreme; the fill is the first 5-minute (M1 for an M1 CF) candle that reaches the line and can only stop the trade; the
sequence's size checks; never for a CF inside the VR. Its own reading in `uniq` (`orderKey`) and in the tracker's `merge`.
Only where the CF is read on its own timeframe (none with `cf: 'same'`). `cfLimit: false` leaves it out. The desk lists "BO, VR,
CF: entry on the EG" and "BO, VR, CF: limit at the CF line" apart. Readings, not tested rules: never quote either record as an
edge. The research scripts that call `sopTrades` (`desk-rigor`, `desk-partial`) were run on the reading before; a re-run reads
the new defaults. Test: '"Both"' (the older tests pin `nest: false, cf: 'same', cfBack: false, cfLimit: false`).
**Scalp / intraday / swing on the Mosha desk** (22 Nov 2026, the owner's "Yrs" to the Engulfing table's tag): `MS_MOSHA_SOP.styleOf(r)`
reads the trade's TOP timeframe (`r.up || r.h`: the BO's for a sequence, the main BO's for a SOP inside the SOP, the barrier's for
a barrier): D1 swing, H4 intraday, H1 and lower scalp (the Engulfing chains' split). Shown on each row and Open now card, and three
lines under "By entry type". A label from stored fields, nothing stored, no rule reads it. Test: `tests/mosha-sop.test.mjs`.

## The Mosha desk: each reading on the structure it did best with (22 Nov 2026, owner: "test the results of the market structure i told u", then "keep the good ones and replace the bad ones")
The owner's marked H1 chart (29-30 Oct): in a running move a new low (high) counts once ONE candle has closed after it, and a
close beyond it is a BO; the page waited six (`msAnalyze`'s extreme fixed after N candles). `msAnalyze(bars, N, NB)` takes the
number of confirming candles as a third argument (default N: the Charts page and every other caller are unchanged).
`assets/mosha-sop.js` `deskTrades(B, F, { from, market })` (used by the tracker's `build` and the browser replay) runs the
readings twice and keeps, per reading, the structure that did better on the last 60 days of gold, EUR/USD and GBP/USD:
one-candle (`oneCandle(F)`, `ONE_N` 1) for the CF limit, the CF inside the VR, the VR retest, the SOP inside the CF, the
barrier with its 3R target, the M1 BO at the tap and the repeat of the SOP; six-candle (`sixCandle(r)` true) for the EG entry,
the SOP inside the VR and the barrier with its 1R target. Records carry `structN`. 60 days before costs: today -36.7R on
13,617 trades, one-candle everywhere +539.7R on 21,226, mixed +667.9R on 18,846. PICKED ON THOSE 60 DAYS, BEFORE COSTS: a
choice, not a tested result; never quote it as an edge. A run takes about twice as long: `council.yml` gives the tracker
`timeout 240` (was 120). Tests: `tests/mosha-sop.test.mjs` (the test file wraps `M.sopTrades` with older options: compare with
`ST`, the unwrapped one).

## H1 barrier: M15 BO, pullback, then the M1 BO (22 Nov 2026, owner: "m1 is only entry to confirm the trade, h1 barrier we need m15 bo pullback then m1 bo entry")
`assets/mosha-sop.js` `TAP_FIRST` = `{ '1h': '15m' }`: at an H1 barrier the tap entry (`bar-tap-`, and its 3R / 6R copies) first
needs an M15 BO Structure with the barrier (the table's QM test), then the first M1 BO Structure with the barrier whose leg starts
after the M15 BO candle closed (the pullback); entry at that M1 close, stop past the pullback's extreme by the desk's buffer, the
reading's target. A close past the extreme made at the barrier, or no M1 BO within 12 M15 candles, gives no trade. Label "· M15+M1 BO"
(short, so "with / against H4" still fits the stored 56 characters); `tapFirst: false` (also through `deskTrades`) reads it as before. Other barriers keep the M1 BO at the tap; an M15 / M30 barrier's tap entry that was the same order as the old H1 one
comes back under its own name (`uniq` kept the H1 record before). 60 days before costs: H1 tap entries 971 -> 204 across gold,
EUR/USD and GBP/USD; gold worse, EUR/USD better, GBP/USD mixed. A reading, not a tested rule.

## The Mosha desk is gold only (22 Nov 2026, owner: "mosha drop GU keep only gold")
`assets/mosha-sop.js` `MOSHA` = `['xau']`: the card shows gold only and `council/mosha-desk.mjs` `OTHER` is empty, so the tracker
reads no other market and `keepMarkets` drops the stored EUR/USD and GBP/USD records on its next run. `MARKETS` (the Engulfing
desk's five) is unchanged.
## A live chart on each edge desk (22 Nov 2026, owner: "live chart with markups on each edge ... like we done in Charts but on the edge page for each edge")
Display only, `assets/desk-live.js` (`window.MS_DESK_LIVE`, pure pieces also `module.exports`; loaded with `defer` after
`assets/desk-trades.js`). It puts a card `.dl-card` "Live chart" FIRST in the `.mo-grid` of `#v-mosha`, `#v-lit`, `#v-eg`, `#v-msnr`
(its own host; the `data-dk="chart"` slot stays desk-trades.js's borrowed replay card). Market picker = the markets the desk's file
holds (Mosha: `MS_MOSHA_SOP.MOSHA`), timeframes M1 M5 M15 M30 H1 H4 D1, OANDA candles from `/md/bars?sym=&tf=&n=500`, then the
newest 5 every `POLL[tf]` s (3 s on M1 to 120 s on D1; a minute while the newest candle is old: a shut market), only while the
desk's view is shown and the tab visible. Trades from the desk's file through `msData` (re-read at most every 90 s), log and
marks through `MS_MOSHA_SOP.withDetail`: every OPEN record of the market and the 10 latest closed ones the candles reach
(`pick`). The chosen trade (the newest at first; a tap on its row or marker chooses another, and the time scale frames it) shows
its stored marks (zones, VR / order-block boxes, levels, coloured by kind as `assets/mosha-replay.js` `HUES`; a test compares),
entry / stop (its trailed `stopNow` when open) / target from the fill to its end with risk and reward bands, and labels; the
others show their entry line faintly; entry and exit markers on every trade (`setMarkers`, ids `<id>:e` / `<id>:x`). Overlay =
one canvas above the chart's, `pointer-events: none`, clipped to the price pane; times map to a fractional bar index
(`logicalOf`) and through `l2x` (the chart library places whole indexes only). The price scale holds the chosen trade's levels
(`autoscaleInfoProvider`). "Chart" on a row opens `msMoshaReplayDialog` (Before / After). Hidden for the Mosha desk's teacher
(as Open now) and never built for a guest; not a `.card`, so the simple phone view keeps it open. Nothing stored (no browser
storage), nothing written. No live ticks yet (the page's tick stream is the Charts market only). `MS_DESK_LIVE.state(k)` is the
audit's read-only view. Test: `tests/desk-live-chart.test.mjs`.

## H4 EF barrier to the next H4 EG, and the H4 engulf map on the live chart (23 Nov 2026, a gold example of 20-23 Nov)
The example: the H4 sell engulf zone 3566.86-3595.29 (base 20 Nov 08:00 UTC) failed at the 04:00 H4 close of 23 Nov, so it is a
buy barrier (an EF); price comes back into it, an M15 BO with it, long at the retest (a limit at the zone's top), stop below the zone,
target the nearest H4 sell EG zone still standing above (3719.84-3744.55), 2R or more. A paper reading before costs, not a tested rule.
- **Reading** `council/eg-methods.mjs` `efTrades(B, { from, market })` (`EFB`; kind `eg-ef`, label "H4 EF barrier → next H4 EG", id
  `<market:>eg-ef-<b|s>-<zone base>`, `h` 4h, `l` 15m), the seventh reading of `DESKS.eg.read`. From `zones` (EG_SPAN 3) and
  `turnBack` (now exported): a failed H4 zone serves the other side for 20 days and until an H4 close back through it; the return =
  the first closed M15 candle from the fail that trades into it; the M15 BO = a 15-minute close beyond the last M15 A level (V for a
  sell; a turn of the closes, 2 a side, known by the candle's open, not closed beyond since) AND out of the zone, within `EFB.wait` 48
  candles and before a 15-minute close back through the far side; the order: a limit at the near side, stop past the far side by
  `SOP.sizes().buf`, target the near side of the NEAREST H4 engulf zone of the other side standing at the order (no zone, or under
  `EFB.minRR` 2R: no trade; a farther zone is never taken instead). Desk's choices, said in the code: the 20 days, the 48-candle BO
  window, the order's life (`EFB.fill` 24 M15 candles, cancelled by a 15-minute close back through the zone or the target reached
  first), one setup a barrier, one position at a time a market. On the fill candle only the stop counts. Marks (24 characters
  stored): "H4 EF · buy barrier", "M15 A level · BO buy", "H4 sell EG · target". Page: chip "H4 EF barrier → next H4 EG" (`KN`) and the
  "What this is" text in `assets/desk-trades.js`; the desk note. Stored records begin with the tracker's next run.
- **The example**: `tests/fixtures/xau-ef-barrier-2026-11-23.json` = OANDA H4 from 15 Oct and 5-minute candles 20 Nov to 23 Nov 09:00
  UTC. On them alone there is no trade: price had not come back to 3595.29 by 09:00 (the trade was still a resting idea). The test
  adds a hand-made path (into the barrier, an M15 break, back to 3595.29, up to the target): entry 3595.29, stop 3566.56, target
  3719.835 (4.34R), and the mirrored sell; cut tests (absent before the BO's close, unfilled before the fill candle, the same just
  after it), a nearest opposite zone under 2R gives none, and the seeded-market checks of the other readings.
- **H4 engulf map** (`assets/desk-live.js`, display only): on the Mosha and Engulfing desks' live chart (`DESKS[k].h4`) a toggle
  "H4 zones" (`data-dl-h4`, on by default, not kept) draws right-extended boxes from H4 candles CLOSED by now (`h4Map(H, now)`): the
  engulf zones still standing ("H4 sell EG zone", amber) and the failed ones still standing as a barrier ("H4 EF (failed sell → buy
  barrier)", red), the three nearest above and below the last close and any it sits in, named at the right edge with their range. H4
  candles: the chart's own on H4, else `/md/bars?…&tf=4h&n=300` at most once a minute. `egZones` is a page copy of `zones` +
  `turnBack`, compared on seeded candles by `tests/desk-live-chart.test.mjs` (also the owner's zones on the fixture, closed candles
  only); `MS_DESK_LIVE.state(k).h4` lists what is drawn. A map, not a signal.
Tests: `tests/edge-desks.test.mjs` ("H4 EF barrier": 3), `tests/desk-live-chart.test.mjs` (3 new).

## Box zone, the owner's box rule, tested (22 Nov 2026, owner: "the box is the high and low", "same process in lower timeframe", "no trend filter")
`research/edge/box-zone/` (PREREGISTRATION.md committed alone first; `run.mjs fetch|run <dir>`, RESULT.md, result.json). A box = the
high and low of the candles since the last close out of a box, following price until a close outside it (every timeframe). A
Daily box that turns (breaks the other way from the break before) is a zone; price leaves and comes back; on H4 a box breaks
against it (the test), then a box breaks with it: enter at that close, stop the other side of that H4 box, target the other
side of the test box; no trend filter. OANDA 2010-2019, five markets, after the demo's costs: **FAIL, 1 of 4**: 1,029 trades,
72 % won, -0.007R a trade (month t -0.29); before costs +0.006R; median target 0.35R. The 2020-26 look before it was in sample.
Not a judgement of the owner's own choice of zones and boxes. Nothing live changed. Test: `tests/box-zone.test.mjs`.

## Overnight studies (23 Nov 2026, owner: "improve every aspect of the edges ... at least 5 edges profitable long term")
Twelve pre-registered studies of direction, entries and the market cycle, built from the owner's lessons of 22 Nov (box from swing
low to swing high and its close outside, ChoCh as the start of a reversal, the Daily zone before a breakout, BO -> VR -> CF with QM
breaks, the box-edge touch with the H1 / H4 side, the timeframe chain). PREREGISTRATION.md of each was committed alone first
(27f35e08a); each runs on the shared toolkit `research/edge/_lib/edgekit.mjs` (OANDA mid 5m cache outside git, shared costs, swing
structure, boxes, QM, month-sum t, Holm; `tests/edgekit.test.mjs`), windows 2010-19 replication / 2020-23 in sample / 2024 on out of
sample, after costs. Every study was then audited by a separate reader trying to refute it (look-ahead on cut series, costs, fills,
the pre-registration, every figure): no defect changed a verdict. **Bottom line: 0 of 12 pass. None is an edge; nothing live changed;
no rule is proposed.** The two passing rules of the repository stay the gold and USD/JPY volatility breakouts (forward records running).
OOS = out of sample, R a trade after costs, t of calendar-month sums:
- `box-touch-trend`: limit at the edge of an M15 / M5 swing box on the H1 side, stop 0.2 x box, target the far edge. FAIL (n 4,950,
  −0.199R, t −7.00; −0.068R before costs; 2010-19 −0.214R, n 16,858).
- `daily-zone-retest`: the Daily box before a strong breakout candle, entered on an H1 box break on the return. FAIL (n 302, −0.030R,
  t −0.36; before costs about zero; with the Weekly box side no better).
- `storyline-qm-sop`: BO -> VR -> CF, VR and CF QM breaks, limit in the CF zone. INCONCLUSIVE (gold H1: 12 trades in 17 years, 1 OOS).
- `h4-pullback-end`: the end of an H1 pullback (first H1 ChoCh back) inside an H4 trend, from the right half of the range. FAIL
  (n 120, +0.125R, t 0.77; in sample −0.036R).
- `vb-structure-filter`: gold / USD/JPY breakout only on the side of the H4 structure. FAIL (kept n 557, +0.124R, t 1.93, against the
  unfiltered +0.143R; kept minus dropped Welch t −0.44): the structure side adds nothing to the two breakouts.
- `direction-chain-gate`: the Daily / H4 / H1 chain (structure sides, or key-level taps) as a gate on a plain H1 box break, five
  markets. FAIL, 0 of 4 (n 782, −0.049R, t −1.27): "agree with the chain" did not beat "disagree".
- `barrier-qm-janda`: gold barrier, QM, the second break, limit at its engulf. FAIL (n 311, −0.101R, t −1.08; 2010-19 −0.166R).
- `eg-chain-50`: H1 engulf zone -> M15 engulf -> M5 confirmation, limit at the middle. FAIL (n 1,031, −0.219R, t −2.06).
- `session-sweep`: sweep of the Asia range, then an M5 QM back inside, target the other side. INCONCLUSIVE (n 27, −0.007R).
- `storyline-daily-gold`: Daily rejection of a fresh level + H4 external break, limit at the H1 pullback QM. FAIL (n 16, −0.333R;
  in sample −0.312R).
- `trendline-qm`: H1 trendline break, retest, M15 QM. INCONCLUSIVE (n 6 OOS; 2010-19 −0.190R).
- `regime-switch-book`: 22 of the night's method streams each kept only in the H4 regime (trend / range / pullback) it did best in,
  chosen on 2020-23. FAIL (n 2,997, −0.066R, t −1.59; unfiltered −0.103R): no market-cycle label rescues the methods.
What it teaches: before costs these entries sit at zero, so costs decide them; agreeing with the timeframe chain or the H4 side
did not pick better trades on any of them (as `ltf-structure` and `desk-rigor` found); the strict storyline readings are too rare to
judge. Never call any of these an edge, do not re-test variants on these years. Owner document:
`research/proposals/2026-11-23-overnight-edges.md`. Tests: `tests/<topic>.test.mjs` for each.
**Phase 2: holdout studies and the phase reader** (23 Nov 2026). Five hypotheses picked from an in-sample scan of the night's
trades (private notes, not in the repository) were pre-registered (de6a84363) and run once on the UNTOUCHED holdout: Set A = the
five read markets 2005-2009, Set B = NZD/USD, USD/CAD, USD/CHF, EUR/JPY, silver 2010 on (`edgekit` `HOLDOUT`, `HOLDOUT_MARKETS`;
Set B costs ASSUMED, not measured). Five-study Holm over the primary p values. Each audited by a separate reader: no defect changed
a verdict. **0 of 5 pass.** Pooled holdout, R a trade after costs, month-sum t:
- `holdout-vb-early`: the gold / USD/JPY breakout rule, fills before 06:00 UTC only. FAIL (n 4,521, +0.063R, t 2.22, one-sided p
  0.014; Set A +0.239R, Set B +0.012R; 2x costs −0.002R; Holm p 0.068). The nearest miss: early fills beat late ones on both
  sets (early minus late +0.097R, Welch t 3.83), but NZD/USD, the cleanest slice, was −0.043R (n 1,070) and outside gold and
  USD/JPY it is about zero after costs. A hypothesis, not an edge.
- `holdout-pullback-deep`: the H4 pullback end only after the pullback passed the 50 % line. FAIL (n 607, −0.110R, t −1.65).
- `holdout-phase-pick`: the phase reader chooses among box break / zone retest / pullback end. FAIL (n 6,233, −0.042R, t −2.82;
  control without the choice −0.024R, n 13,391): the phase choice made it worse.
- `holdout-h1-veto`: the breakout rule skipping days with a fresh H1 break against the fill. FAIL (n 19,454, −0.011R, t −1.14).
- `holdout-weekly-fade`: with the Weekly, against the Daily, at a Daily level. FAIL (n 3,342, −0.007R, t −0.36).
The phase reader `research/edge/_lib/phase.mjs` (`readPhase`, closed candles only: per D1 / H4 / H1 / M15 side, stage, BO / ChoCh,
ranges and their 50 %, box, the storyline step below; `tests/phase.test.mjs`) is shown on Charts as the "Market phase" panel
(`assets/ms-phase.js`, a copy compared by `tests/ms-phase.test.mjs`; display only, hidden for guests). A reading, not a tested rule.

## Decision journal (23 Nov 2026, overnight)
The design of `research/proposals/2026-11-20-discretion.md`: the studies say a person's edge, if any, is in the choosing, and only
a choice stamped BEFORE the outcome can measure it. Practice and record only: nothing goes to a broker, the council or the mirror,
no council member reads it, and nothing is kept in the browser.
- **`api/journal.js`** (Vercel (req, res) shape, routed in `cloudflare/src/worker.mjs` `HANDLERS.journal` and `vercel.json`
  functions; one private store file per account, `journal/<account>.json` (review 23 Nov 2026: one shared file let two accounts'
  writes overwrite each other), overwritten in place, read with `?cache=0`, a failed read throws and is never saved over; one
  account's writes run one at a time per instance (`TAILS`); `tests/blob-fresh.test.mjs` lists it). Who: the owner, and a member whose `perms.desks` is on (an explicit one
  wins, else reviewers). GET = the account's OWN calls (the account key never leaves the server). POST same-origin:
  `{ call: { market (xau eurusd gbpusd usdjpy audusd nas100 xag), side, action: take | skip, entry, stop, target?, tf, method
  (<= 40), reason (<= 300), confidence 1-5, source? { desk, id } } }` → the SERVER stamps `at` (a sent `at` is ignored); a stop
  not on the losing side (or a target not on the winning side) is refused; a call cannot be edited after its stamp (a body with
  an `id` is refused), only `{ note: { id, text } }` (500 chars, `noteAt`); `{ remove: id }` only within `DELETE_S` 120 s of `at`,
  and it WITHDRAWS (the record stays, `withdrawn` = the time; counted apart, never in taken / skipped: the proposal's "nothing is
  deleted"). A stored file that is not a list throws (never saved over).
  2,000 calls an account (no total cap, so members can never close it to the owner); 60 posts an account an hour (429).
- **Rules, one copy** `assets/ms-journal.js` (pure; `window.MS_JOURNAL` on the page, re-exported by `api/_journal.js`): `check`,
  `outcome(call, bars)` = candles that START at or after `at` only (never a forming one); the entry must be REACHED by one of them
  (else `pending`, not scored: a call written with the price already past its entry cannot book a result); on the fill candle only
  the stop counts; then stop first when one candle holds both, a gap through the stop fills at the open, then the target, else open
  marked at the last close; `joinBars` = 5-minute candles for the first 14 days, hourly only from where they end (the result of a
  call never changes as it ages); R before costs; a skip is scored
  the same way (the counterfactual). `stats(rows)` = resolved calls only: taken vs skipped n, mean R, Welch t, by method and by
  confidence; "too few to judge" under `MIN_SIDE` 20 a side; never the word edge for a result.
- **Page** (`market-structure.html`, `<style id="ms-jr-css">` + `<script id="ms-jr-js">` before the structure assistant's block):
  "Log a call" in the Charts toolbar (`#ms-jr-btn`, Style's CSS order; shown only when GET answers, so never for guests or
  accounts without the desks permission), dialog `#ms-jr` (market from the page, side, take / skip, entry / stop / target
  prefilled from the last one-minute close and the 15-minute ATR(14): 1 ATR stop, 2 ATR target; method, reason, confidence),
  and the card "My calls" `#ms-jr-card` at the END of Home (after "More on the desk", so no first screen changes): the latest 40
  calls with their outcome from `/md/bars` (5-minute candles for two weeks, then hourly joined after them; re-read every 2 minutes
  while open or pending), the taken-vs-skipped line, "Add a note" (styled `msAsk`) and "Withdraw" in the first 2 minutes. Graphite tokens, 12 px min, 44 px on
  touch. `window.msJournal()` is a read-only view.
- **Take / Skip on the desks' own signals** (23 Nov 2026): every OPEN record row and Open now card of the Mosha, Engulfing, MSNR and
  LIT desks carries an empty slot (`span.dc[data-dc][data-dc-r]`, `MS_MOSHA_SOP.dcSlot`, used by `assets/mosha-sop.js` and
  `assets/desk-trades.js`); `#ms-jr-js` fills it, only once GET answered `canWrite`, with Take / Skip (or "Your call: …" when this
  account already called that signal). Both open the SAME dialog in a small form (`openDlg(pre)`, class `jr-pre`: market, side,
  levels, timeframe and method are the record's own and not shown as fields; a one-line reason (required there) and a confidence).
  `MS_JOURNAL.fromRecord(desk, r)` builds the preset (market the journal takes, stop on the losing side, a wrong-side target
  dropped, timeframe from `r.l`, method = the kind label, `source { desk, id }`; null for a closed record); `findCall` = the latest
  call, withdrawn ones included. The server refuses a second call on the same desk signal by the same account (409), a withdrawn
  one too (review 23 Nov 2026: Take, withdraw after a bad first move, then Skip would have hidden the first choice); the slot then
  reads "Your call (withdrawn, kept on the record)", and `stats().withdrawnOut` gives what withdrawn calls went on to do, beside the split. The click is caught in the capture phase so a button inside an Open now card does not also open the chart. The journal's
  own rule still applies: an open record's entry is usually already past, so its call counts only once price comes back to the
  entry. Never for guests (`span.dc` hidden for the public role; the script returns there). Practice only.
- Not built (the proposal's later steps): the study's report from this file. Tests: `tests/journal.test.mjs`, `tests/desk-calls.test.mjs`.

## Soft look (24 Nov 2026, owner: "make the design and theme of the website more soft and transparent, right now looks heavy like rock")
Display only. `assets/soft.css`, linked right before `</head>` on every page (Desk, Macro desk, ChronosTrade, Academy, Edge lab,
Equinox, gold terminal, /veteran/; offline.html stays self-contained), loaded last and written with `:root:root:root` / `html:root body`
so it wins over each page's own token block whatever the order. Surfaces are see-through (`--au-surface` rgba .58 dark / .68 light,
`--au-surface-2` .42 / .70) over a fixed soft background wash (`--soft-wash`, three faint radial gradients), cards and panels get a
16 px backdrop blur, header, phone tab bar and side rail are frosted glass (`color-mix` of the background at 72 %, 30 px blur; the header switch and round buttons see-through too), menus, popovers, dialogs and toasts a
more opaque glass (`--soft-glass`) with a 22 px blur, hairlines lighter, radii 10 / 16 / 22 px, diffuse shadows, h1 / h2 weight 600.
Text colours are unchanged. `prefers-reduced-transparency: reduce` gets solid surfaces. To undo: remove the link from the pages.
Second pass (same day, "keep improving the theme"): chips and BUY / SELL tags are tinted pills without an outline; calendar day
and week cells 12 px, their coloured frames gone (the result tint stays); segmented switches, timeframe chips and card buttons soft
filled without a frame, the chosen one a soft accent tint; inputs and selects a soft well; table rules lighter; list rows a soft
hover; primary buttons pills; clickable cards lift 1 px on hover (not with reduced motion).
Rules found by the ChronosTrade audit (24 Nov 2026): light is `data-theme="light"` OR the system set to light with no
`dark` / `midnight` chosen (every page's own rule); dark keeps the pinned background #121315, midnight #0b0c0e; a selected
item takes the page's ink on its accent tint; **no backdrop blur on a card that holds a chart** (`.chartc`, any card with a
canvas): a backdrop filter makes the card the frame of its fixed-position children and broke the synced panes and drawings.
Third pass (24 Nov 2026, "keep going"): the Macro desk's sticky section bar (`nav.toc`) is the header's glass as a rounded strip
(it was a 90 % slab of the page colour); the Edge lab's Forward records card has a sixth record, the gotobi fade (`gotobi-forward`,
written by `vb-forward.yml` since 21 Nov), in a grid of three; the early-against-late card says "no trades yet" before its first
trade. Found by the smoke test on today's data: a long line in the Macro desk's "Your read" list (`.pl-list .d`, no wrap) widened
the phone page to 607 px; its column now shrinks (`minmax(0, 1fr)`) and that line wraps.

## FRED studies of 24 Nov 2026 (owner allowed fred.stlouisfed.org; "keep doing studies … new combinations")
Four pre-registered studies (each PREREGISTRATION.md pushed alone first), all **FAIL**; nothing live changed, no rule proposed.
- `fred-gauges` (0 of 7): weekly, next 20 sessions, 2007-26, Newey-West t, Holm. Net liquidity rising (WALCL − WDTGAL − RRP) → gold
  t −0.97, S&P t 1.62; NFCI tightening → gold t −0.49, S&P t −1.76; jobless claims rising → gold t 0.20, USD/JPY t −1.50; double
  tightening (real yield +25 bp in 4 weeks with the Baa spread wider; 40 weeks) → gold t −0.40, opposite signs in the two halves.
- `fred-gauges-2` (0 of 5): policy-uncertainty spike → gold t 1.65 (+1.16 % against +0.34 %, both halves positive, not significant);
  breakevens rising → gold t 0.24; St. Louis stress rising → USD/JPY t −1.64, S&P t 0.49; steepening after an inversion → gold t 1.28
  (14 episodes).
- `vb-fred-regime` (0 of 5): the gold and USD/JPY breakouts (T1, `vb-vol-regime`'s harness, gate reproduced) split by a gauge known
  the day before (GVZ above its 20-day mean, policy uncertainty, real-yield moves; VIX, 2-year moves): largest Welch t 0.72.
- `vb-rate-side` (0 of 2): a breakout WITH the rate trend against one AGAINST it: gold with falling real yields +0.065R (Welch t
  1.14), USD/JPY with a rising 2-year −0.027R (t −0.49).
The breakouts stay flat 1R with no macro gate; do not test another FRED gauge on these trades or these weeks without a new reason.
Local reruns: `run.mjs fetch <dir>` (FRED + `git show` of the candle cache), then `run <dir>`. Tests: `tests/fred-gauges.test.mjs`,
`tests/fred-gauges-2.test.mjs`.

## Colour faults after the soft look, and charts that use the page (24 Nov 2026, owner: "fix the website too many color errors specially with the chart", "for the charts I would like to use more of the space of the page")
Display only. Causes found on screenshots and fixed:
- **Canvas code got see-through tokens.** The soft look made `--au-surface`, `--panel` and friends rgba; every chart reader hands
  them to a canvas or to a hex-only helper (`rgba(hex, a)`), so plates and labels came out black or washed. Each reader now passes
  its tokens through `auSolid` (market-structure `auChart`, backtest `tok`, gold terminal `gxPalette`, `assets/academy-ui.js`,
  `bt-review.js`, `desk-live.js`, `mosha-replay.js`, `ms-draw.js`): an rgba with alpha 0.4 to under 1 is flattened onto `--au-bg`
  and returned as #rrggbb; fainter tints, grids and bands stay see-through. **A new chart reader of a token must use it.**
- **Buy / Sell lost their fills** (ChronosTrade's quick bar and Trade card were grey): soft.css's "buttons in a card" and
  "pressed" rules now skip `.btn`, `.qb`, `.danger`, any class containing `buy` / `sell`, and `[data-side]`.
- **The candle countdown** takes the candle's own colour (it was the theme's softer red beside the candle-red price label).
- **Space** (`<style id="ms-ch-space-css">` after `#ms-ch-flat-css`; phone rules in the simple view's block): from 901 px a tighter
  toolbar and phase strip, 8 px gaps, All = two rows a screen (`clamp(320px, (100vh - 300px) / 2, 620px)`), one chart / Split /
  Layout fill the window (`100vh - 262px`), no max width on Charts; on a phone the chart card runs edge to edge and is 36 px taller.

## Members write their own indicators in Pine Script and MetaTrader code (24 Nov 2026, owner: "users … do their own indicators in pine language and metatrader language")
Display only: a script draws lines on the Desk's charts; it never places, changes or refuses an order and no council member reads it.
- **`assets/ms-script.js`** (`window.MS_SCRIPT`, `module.exports`; pure, no DOM): two small interpreters written here, never `eval`
  / `Function`: the code is lexed, parsed to a tree and walked with a step budget (`BUDGET` 6e6: a loop that never ends says "takes
  too long"), so a script cannot reach the page, the network or storage. `run(lang, code, bars)` → `{ name, overlay, plots: [{ title,
  color, w, hist, dots, v, cols? }], hlines, notes }`; an error carries `.line`. 20,000 characters, 24 plots at most.
  - **Pine** (v4 / v5 style), run candle by candle with a state per call site: `indicator` / `study`, `input.*` (the default is
    used), `=`, `var`, `:=`, `+=`, history `x[n]`, `if / else if / else`, `for … to … by`, `while`, functions `f(a) => …` (one line
    or a block), tuples, `plot`, `plotshape` (dots at the high / low), `hline`, `color.*`, `math.*`, `nz`, `na`, `fixnan`, and
    `ta.` sma ema rma wma vwma swma hma rsi atr tr stdev dev highest lowest change mom roc rising falling macd bb stoch cci cum
    crossover crossunder cross barssince valuewhen vwap supertrend pivothigh pivotlow linreg (bare v4 names too). Skipped with a
    note: `fill`, `bgcolor`, `barcolor`, `alertcondition`, `label` / `line` / `box` / `table`, `strategy.*`. Refused in words:
    `request.*`, arrays, `switch`, `x = if …`.
  - **MetaTrader** (MQL4 and MQL5 indicators): `#property` lines (window, colours, widths, labels, types, levels), `input` /
    `extern`, globals, functions, `OnInit` / `init`, `OnCalculate` (both forms) / `start`, `if`, `for`, `while`, `++`, compound
    assignment, casts, `SetIndexBuffer` / `SetIndexStyle` / `SetIndexLabel` / `PlotIndexSet*`, `ArraySetAsSeries`, `Open[] … Time[]`,
    `Bars`, `Point`, `Math*`, `iMA iRSI iATR iCCI iMomentum iStdDev iBands iMACD iStochastic` (a value with a shift in MQL4, a handle
    read with `CopyBuffer` in MQL5), `iHighest`, `iLowest`, `iClose…`, `iMAOnArray`. MQL4 conventions (arrays newest first) unless
    the code has `CopyBuffer`, `indicator_plots`, `PlotIndexSet` or `ArraySetAsSeries`. An array is STORED oldest first; `series`
    only turns the index round. Not here: other symbols / timeframes, `switch`, classes, objects on the chart.
- **Page** (`market-structure.html`): the Indicators dialog has "My indicators" (`#ms-ind-my`: Add / Edit / Delete, "Write an
  indicator") and the editor `#ms-sc` (name, Pine Script | MetaTrader, "Load an example", "Check it" = run on the chart's candles
  and say how many lines and where, an error selects its line; "Save and add to the charts" saves only code that runs). Scripts
  are kept per account on this device (localStorage `ms-scripts-<account>`, 20 at most; nothing goes to the server). An indicator-
  list entry is `{ type: 'custom' | 'customosc', sid, color }` (`IND_DEF.custom` on the price, `customosc` in a separate band, by
  the script's own `overlay` / `#property`), drawn by the existing `indDraw` on every chart; results are cached per script and
  candle set (`SC.cache`). `window.msScripts.list()` is a read-only view.
- Tests: `tests/ms-script.test.mjs` (reference maths for both languages, no look-ahead, errors and their line, the budget, no
  eval / fetch / storage in the asset, page wiring). Checked in a browser: both examples written, checked, saved and drawn.

## Big-candle fade with the target 25 % further (24 Nov 2026, owner: "what if we let the trade run 25% extra of the distance between the entry and tp")
`research/edge/bigfade-target-125/` (PREREGISTRATION.md pushed alone first; `run.mjs` imports `big-candle-fade` `signals()` and the
shared `exits()`, gate reproduced: 47,354 / +0.307R and 54,443 / +0.193R). The Equinox Big-candle fade's own trades (m15 k1.5 nobreak,
same fill, stop and 1-day limit) with the target at 1.25 x the distance from the fill to the candle's middle. **FAIL**: the longer
target is better trade by trade (+0.012R in 2015-26, month t 2.02; +0.026R in 2005-14, t 4.16) but the rule still loses after
costs with it: −0.235R a trade (n 54,443, 26 % winners) against −0.246R (30 %) with the candle's middle. Context only, not tested:
1.5 x −0.222R, 2 x −0.209R; in 2005-14 the 2 x target is about zero after costs (−0.002R). Gold and silver are worse with the
longer target, the forex pairs slightly better. The desk's target stays the candle's middle; the loss is the cost, not the exit.
Test: `tests/bigfade-target-125.test.mjs`.

## Big-candle fade with the target at 65 % of the candle (24 Nov 2026, owner: "Instead of 50 % tp try 65 %")
`research/edge/bigfade-target-65/` (PREREGISTRATION.md pushed alone first; the sister study's harness with the target as a share of
the CANDLE from its extreme, gate reproduced). **FAIL**: 65 % is better trade by trade (+0.020R in 2015-26, month t 2.92; +0.031R
in 2005-14, t 4.44) and still a loss after costs: −0.226R a trade (n 54,443, 24 % winners) against −0.246R (30 %) at 50 %.
Context only: 80 % −0.220R, 100 % −0.211R; in 2005-14 they are about zero after costs (−0.012R, −0.008R). No market is positive.
The desk's target stays 50 %. Two exit variants on these trades are enough: do not test another target on these years.
Test: `tests/bigfade-target-65.test.mjs`.

## Big-candle fade: the target sweep, no sweet spot (24 Nov 2026, owner: "Find the sweet spot")
`research/edge/bigfade-target-sweep/` (PREREGISTRATION.md pushed alone first): fifteen targets (50 % to 300 % of the candle, and
none = the stop or the 1-day limit ends the trade) on the desk's own trades, the target CHOSEN by R after costs on 2005-14 and
JUDGED on 2015-26. **FAIL**: the curve only rises with the distance, so the choice is "no target" (+0.066R after costs in
2005-14); judged on 2015-26 it makes +0.332R before costs and −0.107R after (n 54,443, 5 % winners, month t −2.65), better than
the desk's 50 % (−0.246R; +0.140R a trade, t 3.68) and still a loss. Every one of the fifteen loses after costs in 2015-26.
By market with the discovery-chosen target: only EUR/USD is above zero (+0.138R, month t 1.34, not significant). The fade's
winners run far (the before-cost R grows from +0.19R to +0.33R as the target goes), but a 5 % win rate at −0.107R is not a rule
to trade. The desk keeps 50 %. **This closes the target question on these trades** (three studies).
Test: `tests/bigfade-target-sweep.test.mjs`.

## Big-candle fade with a target nearer than 50 % (24 Nov 2026, owner: "Check if less 50 %")
`research/edge/bigfade-target-short/` (PREREGISTRATION.md pushed alone first; targets 45, 40, 35, 30, 25, 20, 10 % of the candle
beside the desk's 50 %, chosen on 2005-14, judged on 2015-26; a target the fill has already passed closes at the fill). **FAIL**:
50 % is the best of the eight in both windows and every nearer target loses more after costs in 2015-26: 45 % −0.260R, 40 %
−0.283R, 30 % −0.378R, 20 % −0.549R, 10 % −0.640R (50 %: −0.246R). Winners rise to 46 % at the 25 % target but the wins shrink
against the same cost; under 25 % the rule loses before costs too. With `bigfade-target-sweep` the whole curve is known: it
rises with the distance from 10 % to no target and never crosses zero after costs on 2015-26. Test: `tests/bigfade-target-short.test.mjs`.

## Big-candle fade entered on a 1-minute or 30-second ChoCh (24 Nov 2026, owner: "find a way to improve the win rate or add maybe m1 choch or 30s choch")
`research/edge/bigfade-choch/` (PREREGISTRATION.md pushed alone first; OANDA 1-minute candles 2018 → Oct 2026 on xau, eurusd, gbpusd,
usdjpy, audusd and 30-second candles 2024-26 on xau and eurusd, fetched into the shared cache; `run.mjs` `base` / `choch` / `walk`).
The desk's signals; instead of entering at once, wait up to 60 minutes for the first 1-minute close beyond the last confirmed
1-minute swing against the candle (five-candle swing), enter at the next open, stop past the highest high since the candle + 0.1 ATR,
the same 50 % target. **FAIL**: the win rate does rise, 70.4 % against 29.3 % at once (2022-26, z 38), but the entry is so much
later that the planned reward is 0.38R (median) against 3.08R: before costs it makes −0.007R a trade, after costs −0.138R (n 2,361,
month t −9.33) against −0.212R at once. Better than entering at once (+0.074R, Welch t 2.95, month t 3.16), still a loss; 2018-21
the same (68 % winners, −0.182R). Only 19 % of signals give a ChoCh trade: on 65 % the stop level (the candle's extreme + 0.1 ATR)
trades first, on 16 % the 50 % comes first. 30-second ChoCh, context only (gold + EUR/USD, 2024-26): 64.6 % winners, planned 0.61R,
−0.115R after costs (n 1,027). The run that counts is the second: the first left out the desk's "risk under the cost is no trade"
rule (said in RESULT.md). **A high win rate here is bought with the reward: never quote the 70 % without the −0.138R.**
Test: `tests/bigfade-choch.test.mjs`.

## Paper look on the Charts, and the faint ink in the soft look (24 Nov 2026, owner's screenshot: "want my charts with these colors")
Display only. `market-structure.html`: `PAPER` = a light chart (#f7f8fa) with grey rising and black falling candles, black borders and
wicks (`MONO`), on EVERY page theme. It is the chart's own colours (`ms-colors` with `mono: true`), switched on once per device
(`ms-paper-v1`, only when the device has no colours of its own); Style → "Grey / black on white" (`#ms-sty-paper`) sets it,
"Theme colours" goes back to the page theme's chart, "Green / red candles" clears `mono`. `chartLight()` (`window.msChartLight`) = is
the chart itself light: the canvas inks (day lines, labels, volume, the hand-drawn level lines, the shared image) read it instead of
the page theme; `cusLook(chart)` gives a chart with its own background its ink, grid and scale borders (panes, the free chart,
Markets side by side). `assets/soft.css`: the dark themes' faint ink `--au-ink-3` is #A4A9B1 (the see-through surfaces are lighter
than the solid ones #8E939B was chosen for: the Academy audit's AA checks failed), light keeps #5B616A, nothing under
`prefers-contrast: more`; table header cells read `--au-ink-2`.

## Big-candle fade, only the trades whose cost is small against their risk (24 Nov 2026, owner: "there must be a way to improve the fade of m15")
`research/edge/bigfade-cost-ratio/` (PREREGISTRATION.md pushed alone first; `bigfade-target-65` `trade()`, gate reproduced). The
desk's own trades, kept only when the round-trip cost is at most 10 % of the risk (both known at the entry). **FAIL**: 1,794 of
54,443 trades are kept in 2015-26 and they make +0.033R before costs, −0.041R after (month t −1.37); 2005-14 −0.040R (n 3,214).
**The finding that closes the fade: its before-cost R lives in the tight-stop trades.** The dropped trades make +0.198R before
costs and pay 0.45R; the trades with room for the cost make about +0.03R before it. So the "+0.19R before costs" is not an edge
waiting for a cheaper broker: it is the arithmetic of a stop a few pips from the entry. Context only: no threshold (5-30 %) is
positive after costs in both windows; gold alone +0.143R on 298 kept trades (t 1.47, not significant, picked after looking).
Six studies of these trades (target x4, entry timing, cost ratio): do not test another variant on these years. The desk stays a
paper record. Test: `tests/bigfade-cost-ratio.test.mjs`.

## The other Equinox fade and gap rules, only the trades with room for the cost (24 Nov 2026, owner: "and the other edges")
`research/edge/equinox-cost-ratio/` (PREREGISTRATION.md pushed alone first; `run.mjs market <key> <dir>` per market, then `report
<dir>`; the trades come from the tracker's own adapters in `council/edge-desks-2.mjs`). Break fade, Round-number fade, Box fade and
FVG return, each kept only where the round-trip cost is at most 10 % of the risk. **FAIL, 0 of 4.** After costs in 2015-26: Break
fade −0.050R (n 72,658, month t −8.06), Round-number fade −0.059R (n 10,261), Box fade −0.012R (n 87,168, t −2.27), FVG return
−0.009R (n 26,637, t −1.31). Unlike the Big-candle fade, their before-cost R does not vanish in the kept trades (+0.02R to +0.05R);
it is simply about the size of the cost (0.06-0.07R). Box fade and FVG return are at zero after costs in 2005-14 (+0.003R each).
Context only, picked after looking, no threshold adopted: FVG return at 5 % is +0.016R in 2015-26 (n 10,728, t 1.32). These five
rules are a few hundredths of an R before costs: nothing to trade. The desks stay paper records; the two breakouts remain the only
rules that pass at measured costs. Test: `tests/equinox-cost-ratio.test.mjs`.

## FVG return with cost at most 5 % of risk, on eight unread markets (24 Nov 2026, owner: "I was expecting more studies")
`research/edge/fvg-cost5-holdout/` (PREREGISTRATION.md pushed alone first). The one cell `equinox-cost-ratio`'s context showed above
zero in both windows, tested where no FVG study had looked: GBP/JPY, AUD/JPY, CAD/JPY, EUR/GBP, EUR/AUD, Nasdaq 100, S&P 500, DAX,
2020-26, "large" = over the market's own 2019 median gap, costs ASSUMED. **FAIL**: +0.043R before costs, +0.014R after (n 7,074,
month t 0.89); 2020-22 +0.055R (t 2.46), 2023-26 −0.017R; at twice the cost −0.015R. The hint did not hold; the FVG return is
closed with the other fade / gap rules. Test: `tests/fvg-cost5-holdout.test.mjs`.

## GBP/JPY breakout, a forward record (24 Nov 2026)
`research/edge/gbpjpy-vol-breakout-forward/` (PREREGISTRATION.md pushed alone first; a copy of the USD/JPY forward record's code).
T1 on GBP/JPY for complete UTC weekdays from 2026-11-25, the yen-crosses study's cost, bands from its 2016 → 19 Nov 2026 trades
(`baseline.json`, gated n 2,069 / +0.070R). GBP/JPY was the best of five yen crosses on its history, so the measured range is
optimistic; "confirmed" at 240 trades also needs the total at TWICE the cost above zero. `vb-forward.yml` writes council-data
`research/forward/gbpjpy-vol-breakout.json`. Nothing trades. First reading: too few (n 0). Test:
`tests/gbpjpy-vol-breakout-forward.test.mjs`.

## Demo test order, and the Equinox account's name (24 Nov 2026, owner: "give equinox and place a order as a test i will cancel it manually")
- `council/test-order.mjs` + `.github/workflows/demo-test-order.yml` (started by hand only, input `account` as `*<last digits>`,
  default the Equinox book's account): ONE resting EUR/USD buy limit 3 % under the price, the broker's smallest volume, with a
  stop and a target on the order and a 24-hour expiry, label `aureum-test` (the mirror and the demo jobs manage only their own
  labels). Through the gotobi job's `connect()` (demo host, `isLive === false`); refuses unless `CTRADER_ENV` is demo. It writes
  nothing to council-data and never cancels, amends or closes anything. Test: `tests/test-order.test.mjs`.
- `council/ctrader-account.mjs` `labelOf` names Equinox before ICT, and `shown(books, cfg)` leaves a book whose copies are
  switched off (`config.mirrorIct === false`) out of the NAME of an account it shares: the …144 row reads "Equinox". The
  account's `books` list and the mirror's mapping are unchanged (ICT copies it still holds are managed as before).

## BreakFade.cs: the Equinox Break fade as a cTrader cBot (24 Nov 2026, owner: "make ctrader bot of the fade m15")
`ctrader/BreakFade.cs` (standalone, the broker's own M15 candles, label `BF`, `TimeZone = TimeZones.UTC`): the study cell
`m15 none atr 2R all` of `grid7-wide-fade` as the Equinox desk records it: a close beyond the last confirmed 3-a-side swing is
faded at market when the candle closes, stop 1 x ATR(14) from the fill, 2R, closed after 24 hours. `DemoOnly()` on start, every
poll and before the order (the fifth order-sending program; `tests/bridge-demo.test.mjs` lists it and pins its constants); dry
run by default; a position without a stop is closed. Parameters: symbols, risk %, caps a symbol and in all, UTC hours, the
spread limit. `BreakAt` walks the last 600 closed candles; compared with the study's `breaks()` on 5,300 seeded candles (0
mismatches) before it was written in C#. Not compiled (no cTrader in the sandbox). **The rule loses after costs (-0.118R a
trade 2015-26): a demo tool, never an edge.**
**MetaTrader 5 too** (same day, owner: "send orders to mt5 accounts as well"): `mt5/BreakFade.mq5`, the same rule and guards
(magic 261124, a timer every 2 s, every symbol of its list, absolute stop and target on the order). Not compiled here.

## MetaTrader 5 bridge with a personal key (24 Nov 2026, owner chose "A. Personal key")
A member's own MetaTrader 5 follows the Equinox desks; no broker login or password reaches the site, nothing is stored.
- `api/_eqx-bridge.js` (pure) + `api/eqx-bridge.js` (routed in `cloudflare/src/worker.mjs` `'eqx-bridge'`, `vercel.json` functions).
  Key = `<account>.<HMAC(session key, "eqx-bridge/v1:<account>")>` (`keyOf` / `whoOf`, constant time; never a session). `POST
  { action: 'mykey' }` (signed in, same origin, the owner or a member with the desks permission: `canUse`) answers the member's
  address `…/api/eqx-bridge?key=…` (host from the allowlist, else aureumdesk.co.uk). `GET ?key=[&desks=]` answers a CSV
  (`# eqx-bridge v1,<unix>`, then `id,desk,market,side,entry,stop,target,filled,state`) from council-data `fade/`, `bigfade/`,
  `fvg/`, `goldvb/` `desk.json` through `data.js` `readFile`: `open` (may be opened), `hold` (open at the desk, too late or over
  0.75R from its entry), `closed` (ended within 2 days). The SAME choices as the demo mirror's `eqxCandidates` (a test compares
  record by record and the constants); a record without its stop on the losing side is never written. Each read checks the account
  as it stands (user list cached a minute; removed, a viewer or desks off = 403; unreadable = 503); a wrong key counts as a failed
  password check; 60 reads a minute a key; `EQX_BRIDGE=off` stops it. No order, broker or storage code (test).
- `mt5/EquinoxBridge.mq5`: polls the address (WebRequest must be allowed for the site), opens each `open` line once at market with
  the desk's absolute stop and target unless the price is past either or over `InpMaxDriftR` 0.75R from the entry (a tag `eq:<hash>`
  in the comment and a terminal global variable keep it to once), closes the copy on `closed`, closes a copy without a stop.
  `DemoOnly()` on start, every poll and before the order; dry run by default; magic 261125. Not compiled here.
- Page: Profile card `#ms-pf-eqb` + `<script id="ms-eqb-js">` ("Show my bridge address", the four setup steps, a link to the
  program on GitHub); hidden for guests and accounts without the desks; keeps nothing in the browser.
- The desks are paper records of rules that lose after costs: a demo feed, never advice. Sending to real accounts would need the
  owner to change absolute rule 2. Tests: `tests/eqx-bridge.test.mjs` (5), `tests/bridge-demo.test.mjs`.

## Lyriac: the passing rules as one Equinox desk, on the Shadows + LIT demo account (24 Nov 2026, owner: "build as new edge called Lyriac and put it in equinox connect the 200$ acc to it")
The owner asked for "the ultimate edge" from everything tested. The evidence gives no new chart rule (19 of 20 combinations of
24 Nov failed, one still running); what passes is the book of `research/edge/passing-rules-book`. Lyriac is that book's three
intraday rules as ONE desk (the first tab of `/equinox`):
- **Tracker** `council/edge-desks-2.mjs` `lyriacTrades` (`DESKS2.lyriac`, markets xau + usdjpy, `extra: { '5m': 40 }` days of
  candles for the gotobi stop): the gold and USD/JPY breakout T1 through the breakout desks' own `vbDays` (kind `lyriac-t1`, the
  same entries, stops and R as `goldvb` / `jpyvb`: a test compares), and `gotobiTrades` (kind `lyriac-gotobi`): the gotobi study's
  own calendar, `legTimes('fade')`, `stopDist` and the order of its `trade()` (a gap at the open, then the stop, else 06:00 UTC);
  a gotobi day cut before 06:00 UTC is an open record. `mosha-desk.mjs` `clean` takes the `lyriac-` kinds. The loop line is
  `--only fade,…,jpyvb,lyriac,dom`; `datahealth.mjs` lists `lyriac/desk.json`. Not in it: gold before a US holiday and the Nasdaq
  Tuesday (other markets and calendars).
- **Page**: `equinox.html` `#v-lyriac` (first in `EQ_DESKS`), `assets/desk-trades.js` `DESKS.lyriac` (its "What this is" gives the
  book's figures and says they describe in-sample years, not proof), `assets/desk-live.js`.
- **The account** (owner, same day: "swap to the account shadows LIT"): Lyriac's rules are traded by the two demo jobs that
  already trade exactly these rules with real stop orders (`council/vb-demo.mjs`, `council/gotobi.mjs`), on their default
  account, the Shadows + LIT demo account (`gotobi.mjs` `accountFor`: the LIT book's account, 10152146), at 0.25 % a trade. No
  Trader rule: a first rule `lyriac-155` (the $200 account ending 155, where 1 oz of gold would risk about 12 % a trade and
  which the token did not hold) was removed before it ever ran. The shadow book's copies trade on that same account.
- **Lyriac alone** (owner, same day): Trader rule `shadow-mirror-off` sets `config.mirrorShadow = false`: the mirror opens no new
  shadow copy on any demo account (the shadow book has no other account); open copies are managed to their exits. The account
  then holds the breakout and gotobi jobs only. Undo: a rule setting it true.
- The standalone `VolBreakout` bots written the same day were removed on the owner's word ("dont do it").
- First 60-day read (before costs, not evidence): gold breakout 31 trades +18.9R, USD/JPY breakout 29 +0.2R, gotobi 11 +2.7R.
- **1 % a trade** (owner, 24 Nov 2026: "increase the risk of equinox to 1% and Lyriac to 1%"): Trader rule `lyriac-risk-1` sets
  `config.vb.risk` and `config.gotobi.risk` to 0.01 (the most either job allows); the Equinox copies' `LIMITS.risk.eqx` is 0.01 too.
  The mirror's daily loss stop is 2 % of the balance, so two Equinox stop-outs in a UTC day hold its new copies until the next day.
A paper desk and a demo record of rules whose studies passed; the forward records judge. Tests: `tests/lyriac.test.mjs` (4).

## Twenty combinations of the owner's methods (24 Nov 2026, owner: "use 20 agents to keep studying, do combinations of the strategies I've given")
Twenty pre-registered studies, one combination each (PREREGISTRATION.md committed alone before each run; `research/edge/<topic>/`,
`tests/<topic>.test.mjs`), five markets (xau, eurusd, gbpusd, usdjpy, audusd), discovery 2005-14 and confirmation 2015 to Oct
2026, judged AFTER the shared costs on month-sum t with Holm. **19 FAIL, 1 INCONCLUSIVE, 0 PASS; nothing live changed, no rule
proposed.** Best cell after costs in 2015-26 (R a trade, n, month t):
`h4eg-m15-range-cf` (H4 engulf zone + M15 break / range / confirmation) −0.049 (8,855, −3.36) · `vb-msnr-side` (direction call on
the breakouts) with the call +0.068 against it +0.121, difference t −0.96: no filter · `ifvg-daily-eg-zone` −0.012 (9,289, −0.80) ·
`sweep-m5-engulf-limit` −0.121 (3,152, −2.56) · `d1-dom-h1-ef` −0.043 (1,535, −1.10) · `asia-sweep-ifvg` −0.080 (3,425, −2.92; the
plain close back inside is +0.07 to +0.09 before costs) · `h1-origin-h4-range` (premium / discount) −0.063 (6,470, −3.49) ·
`eg-chain-msnr-side` −0.107 (8,920, −2.52) · `vb-next-day-eg` −0.082 (980, −2.42) · `gap-level-engulf` −0.018 (5,250, −0.66) ·
`pdhl-sweep-m5-shift` −0.017 (3,298, −0.70) · `h1-box-retest-engulf` −0.100 (6,443, −3.66) · `h1-qm-h4-turn-m15-eg` INCONCLUSIVE
(n 172 / 220) · `london-reversal-ny-eg` −0.054 (1,114, −1.32) · `ef-chain-h4-h1-m15` −0.106 (3,152, −5.88) · `dom-h4-vr-overlap`
−0.034 (17,428, −2.04) · `pair-divergence-ifvg` −0.044 (1,597, −1.22) · `h4-eg-cisd-m15` −0.061 (30,191, −6.49; inside a zone
loses about 0.05R less than away from one) · `equal-pool-m5-confirm` +0.063 (1,056, 1.41) but −0.076 in 2005-14 · `tl3-m15-engulf`
−0.121 (2,097, −3.99). The pattern is the one of every earlier grid: about zero before costs, the cost decides, and no key level,
direction call, session or confluence picks the better trades. Do not re-test variants of these on these years. The agents shared
one checkout and a three-slot run queue (4 cores); each committed only its own paths.

## Fades inside an H1 DOM zone, and liquidity sweeps as a filter (25 Nov 2026, owner: "test fade m15 inside h1 DOM and check the other edges if we can use liquidity to improve our trades", then "i mean big candle")
`research/edge/fade-liquidity/` (PREREGISTRATION.md committed alone first; `run.mjs`, RESULT.md, result.json). The Big-candle fade (M15,
the desk's 50 % target; gate reproduced exactly) and the Break fade (M15, 1 ATR stop, 2R) on ten markets, each trade tagged from closed
candles at the signal: fill inside a standing H1 DOM zone (`combo-grid-3` `buildZones('dom')`, by the zone's side against the trade),
the signal candle's extreme beyond the previous New York day's high / low (`pdl`), beyond the previous 96 M15 candles' extreme (`hi24`),
beyond the Asia range (`asia`, 07-17 UTC signals). Eight tests (desk x tag), Holm. **FAIL, 0 of 8**: inside a DOM zone the Big-candle
fade makes -0.263R a trade after costs in 2015-26 (n 26,017) against -0.231R outside: no better (Welch t -1.72), and worse when the
zone is against the trade (-0.384R, n 3,511). Liquidity sweeps do separate better from worse trades (tagged beats untagged by Welch
t 3.0-4.8 on `hi24`, `pdl`, `asia`) but every tagged group still loses after costs (Big-candle fade -0.196R to -0.205R; Break fade -0.090R
to -0.121R). Before costs the Big-candle fade is about +0.18R tagged or not: the cost decides, as in every earlier fade study. A first
version of the harness dropped zones whose end was not yet known; the cut test caught it (4 tag mismatches) and it was fixed before
the run counted. Nothing live changed; do not test variants of these tags on these years. Test: `tests/fade-liquidity.test.mjs`.

## The auto-researcher: nine workers that never stop (five at the start; four more on 25 Nov 2026, owner: "add more 4 helpers to the researcher to speed it more": workers 6-9, same version `auto-1`, only the seeds differ; `researcher.yml` runs `[1..9]`) (25 Nov 2026, owner: "a 24h researcher that does studies and try million of simulations of different combinations … never stops till i say", "5 researcher agents so its 5x the results")
`research/edge/auto-researcher/` (PREREGISTRATION.md committed alone first, `engine.mjs`, `tests/auto-researcher.test.mjs`) and
`.github/workflows/researcher.yml` (free runner minutes; five matrix jobs; each works about 5.5 hours, saves to council-data
`research/auto/worker-<n>.json` every 25 minutes and dispatches its own next run; cancel the runs, or set the repository variable
`RESEARCHER_OFF` to 1, to stop). A seeded generator of rules over H1 OANDA mid candles of ten markets: a trigger (breakout,
fade, pullback, big candle, block break, deviation, the owner's engulf, sweep; worker 5 combines two) + filters (hour, weekday,
trend, volatility) + an exit (stop 0.5-3 ATR, target 0-6R, time limit). **Three stages**: A search 2005-14 (n >= 250, +0.04R
net, month t >= 3), B validation 2015-19 (n >= 100, mean > 0, t >= 1.5, the side-flipped twin negative), C holdout 2020 on,
ONE look per market / trigger / side group, a **lead** only with t >= 2 AND Holm p < 0.05 over every C look made. Every try is
counted and the file says how many chance candidates the tries should give; a lead is never an edge (it goes to a pre-registered
forward record). About 100 tries a second a worker. Read the state: `node research/edge/auto-researcher/engine.mjs report
<dir with the worker files>`. A first smoke run: 8,600 tries in 90 seconds, 12 survived A, 1 candidate, which failed on C
(−0.088R, t −1.24). No threshold, grid or window changes while a version runs; a change is `auto-2` and is counted apart.
Not yet in it: the owner's EF zones, Mosha VR / CF, the iFVG and the Telegram-downloads folder on his laptop (needs the folder
shared with this session). Tests: `tests/auto-researcher.test.mjs` (7).

## The late-evening Break fade at the broker's own ticks (25 Nov 2026)
`research/edge/fade-late-tick-exec/` (PREREGISTRATION.md pushed alone first; `run.mjs fetch|report`, MEANING.md, RESULT.md, result.json). The `m15 none atr 2R all` Break fade whose break candle starts at 20-22 UTC, XAUUSD and USDJPY, 2023-12 to 2026-11-20, entered at the demo broker's ask / bid (tick probe `fills` / `marks`). **INCONCLUSIVE on coverage, negative in substance**: −0.452R a trade after commission (n 354 resolved of 523, month t −3.98) against +0.075R on mid candles; 119 orders had no entry quote, 50 an unresolved exit (49 "window not read", USD/JPY). 21:00 UTC (rollover) is the worst hour: USD/JPY −1.12R, entry spread median 0.53R. Gold about −0.23R everywhere. Hours were picked after looking at these years: an execution measurement, never a rule. Nothing live changed.

## The Big-candle fade on demo account 10152145, 5 % a trade (25 Nov 2026, owner: "Put big fade candle edge in one of the demo accounts replace it and risk 5% per trade"; account chosen: the old Shadows account)
`council/ctrader-mirror.mjs` book `bfade` (`council/ctrader-accounts.json` `mirrorAccounts.bfade` = 10152145; its `drain` entry is gone): `bfadeCandidates(file, nowS)` = the Equinox rules (`eqxCandidates`: stop required on the losing side, only a record first written and filled within 1 h and not over 0.75R from its entry is OPENED, closed records kept 2 days so the copy closes with them) on council-data `bigfade/desk.json` ALONE, ids `bfade:<desk record id>`, `bookOf` = `bfade`, copied only while the book has an account of its own (`bfadeHasOwnAccount`). Risk `LIMITS.risk.bfade` 5 % of the balance a trade. The mirror's 2 % daily loss stop would end the day at the first loser, so this book has its own, `LIMITS.dayStopBfade` 15 % (three stop-outs); every other book keeps 2 %. The copies are market orders through the usual path (late-copy check, stop-within-spread skip, `ensureStop`, margin share and open-risk caps; a trade whose 5 % needs more margin than `maxMarginShare` allows is cut or skipped by those caps, not widened). The account's round still manages the old shadow copies it holds. The Equinox account (…144) keeps copying the same desk at 1 %: the two accounts copy independently. Reconciliation and the account label ("Big-candle fade") follow. Demo only, a paper reading of a rule that loses after costs (`bigfade-*` studies: −0.2R a trade): 5 % a trade is the owner's choice and will lose quickly if the studies hold. Tests: `tests/ctrader-mirror.test.mjs` ("Big-candle fade book"), `tests/mirror-drain.test.mjs`, `tests/ctrader-account.test.mjs`.

## Mosha 6R barrier: can the better trades be told apart at the entry? (25 Nov 2026, owner: "mosha 6r barrier, find how choose better quality trades and avoid bad ones")
`research/edge/mosha-6r-quality/` (PREREGISTRATION.md pushed alone first; `run.mjs year <Y> <dir> | cut <Y> <dir> | report <dir>`, RESULT.md, result.json). The desk's own 6R barrier reading on gold (`mosha-barrier-6r`'s `entries`, imported), ten features known at the entry (timeframe, kind, entry type, with / against, visit, cost over risk, stop over ATR, session, trend, efficiency ratio) shrunk into one score, fitted on 2018-21 (66,834 trades) and judged on 2022-26 (92,504), net of $0.30. **FAIL** (the USEFUL-TO-AVOID branch): the kept fifth made +0.018R a trade after costs (n 18,763, month t 0.53), so no better-quality set exists; the avoided fifth lost −0.232R (Welch t −7.4 against the rest). The placebo of 40 shuffled refits was beaten 34 times, under the bar of 38. The separation is mostly cost against risk (cost over 0.20 of the stop: −0.29R in both windows; before costs every group is near zero). Cut test 2024 identical. Nothing live changed; do not refit on these years. Test: `tests/mosha-6r-quality.test.mjs`.

## The auto-researcher's USD/CHF lead at the broker's own ticks (25 Nov 2026)
`research/edge/usdchf-blk-exec/` (PREREGISTRATION.md pushed alone first; `orders.mjs`, `run.mjs orders|queries|report`, MEANING.md, RESULT.md, result.json). The researcher's one lead (USD/CHF, the 19:00 UTC H1 close beyond the previous 3 candles' range faded at the 20:00 open, stop 1 ATR, target 0.5R, out at 00:00 UTC; +0.081R on mid candles) filled at the demo broker's bid / ask, 185 orders 2023-12 to 2026-11 (every order quoted and resolved). **FAIL**: −0.011R a trade after commission (month t −0.26); tick minus mid −0.059R (month t −2.10). 138 of 185 trades were open inside the 21:00-22:59 UTC rollover and made −0.076R against +0.179R for the 47 that were not (found after the result, not a rule). No forward record, no variants on these years. A lead of the auto-researcher must be re-priced at the broker's quotes before anything else. Test: `tests/usdchf-blk-exec.test.mjs`.

## Wheel bar on the Charts (25 Nov 2026, owner: "change time frame and currency like that" with a phone picker screenshot, "make the chart occupy more space of the window")
Display only, `market-structure.html` (`<style id="ms-wb-css">` + `<script id="ms-wb-js">` before the phone view's script). Up to 700 px, on Charts and not for guests, a bar `#ms-wb` above the tab bar shows the market and the timeframe; each opens a bottom sheet (`#ms-wb-sheet`) with a scroll-snap wheel (the one in the middle is bold, tap an item or scroll, Done applies, Cancel / a tap outside closes). It calls the page's own mechanisms: `window.msOneTf(id)` for a timeframe (an analysed one opens its pane) and a `?s=<market>#charts` link for a market (the page loads again, as the header's market list does); `window.msMarkets()` lists the markets, `window.msTfGroups()` the timeframes. It stores nothing and sends no order. On the phone's simple view the toolbar's market button `#ms-ch-mk` is hidden (the bar replaces it) and one chart is `100dvh - 314px` tall (was 300 with no bar). `window.msWheelBar()` is the read-only view. Test: `tests/charts-wheel-bar.test.mjs`. Not checked on a real phone.

## FVG tap after a continuation move, then an H1 QM or an M15 CHoCH (25 Nov 2026, owner's chart idea: "Fvg tap after continue move, qm, entry, target low")
`research/edge/fvg-qm-continuation/` (PREREGISTRATION.md committed alone first; `run.mjs`, RESULT.md, MEANING.md, result.json, trades.json;
`tests/fvg-qm-continuation.test.mjs`). The owner's answers fixed the rule: H1 for the gap and the QM, "continue move" = an H1 BO in the trade's
direction, target the low the move came from, and at the tap either the H1 QM confirms (entry A) or an M15 CHoCH does (entry B). An H1 BO, an
H1 FVG formed from the broken swing to three candles after the break (gap >= 0.25 ATR), the first M5 tap, a stop past the pullback's high + one
cost, one position at a time, five markets on the toolkit's M5 cache, 2010-19 replication / 2020-23 / 2024 on, month-sum t, Holm over two.
**Verdict: FAIL.** Entry A: 81 trades in 15 years, 18 since 2024 (-0.285R a trade after costs, month t -0.74): too few to judge, negative. Entry B:
353 trades since 2024, -0.146R after costs (month t -1.74), -0.083R on 2010-2019 (n 1,265, t -2.08); about -0.11R before costs. Gold alone
with B +0.095R since 2024 (n 72, t 0.45) and -0.178R before: noise, not tested. Nothing live changed; no variant on these years.


## Worker 10: the auto-researcher on NQ alone (25 Nov 2026, owner: "have one worker just for NQ try all the edges possible and do combinations")
`research/edge/auto-researcher/engine.mjs` `FAMILY[10] = ['nq']`, `NQ_WORKER` 10, `NQ_COST`: the same engine, grids, three stages and bars as the other nine (still `auto-1`; like workers 6-9 only the market and the seed differ), but every rule is on NAS100 (OANDA H1 mid, the cache or the candle service; data starts about 2010, so window A is 2010-14), every trigger kind (breakout, fade, pullback, big candle, block break, deviation, engulf, sweep), one trigger or two combined (half each), with the usual filters and exits. **No cost is charged** (owner, 25 Nov 2026: "no cost because will be futures"; `NQ_COST` 0), so every NQ figure of this worker is BEFORE costs, against rule 4's usual "net of costs": micro futures still pay a tick and about a dollar a side, so a lead is re-priced at real quotes before it means anything. The engine can charge a share of the entry price (`D.costRel`; the demo's measured NAS100 spread was 2.7e-5, `index-vol-breakout-hourcost`) if `NQ_COST` is set. Its state is `worker-10.json` (and lanes `worker-10-<lane>.json`) in council-data `research/auto/`; `report` counts its looks in the same Holm. `researcher.yml` runs 1-10 (`worker=10` starts it alone). A lead stays a lead until it is re-priced at the broker's own quotes (`usdchf-*-exec`) and then judged forward. Test: `tests/auto-researcher.test.mjs` (the NQ-only test).

## The auto-researcher's second USD/CHF lead at the broker's own ticks (25 Nov 2026)
`research/edge/usdchf-fade-exec/` (PREREGISTRATION.md pushed alone first; `orders.mjs`, `run.mjs orders|queries|report`, MEANING.md, RESULT.md, result.json). The researcher's `usdchf|fade|short` lead (a close above the previous 5 H1 highs sold at the next open at 20-22 UTC; stop 0.75 x ATR(14), 1R, out after 12 candles; +0.240R on mid candles 2020 on, Holm 0.0036) filled at the demo broker's bid / ask, 127 orders 2023-12 to 2026-11. **TOO FEW as pre-registered**: 33 orders had no quote to enter on (the rollover), 94 resolved (bar 100). Mid +0.225R; at the broker +0.011R before and −0.034R after commission (month t −0.25); tick minus mid −0.214R (t −2.31). Both researcher leads are mid-candle results the broker's quotes remove. No forward record; no variant on these years. Test: `tests/usdchf-fade-exec.test.mjs`.

**Second runner for five workers (25 Nov 2026, owner: "More speed")**: `researcher.yml` has a matrix `shard` 0 / 1; shard 1 (lanes 4-7, files `worker-<W>-4..7.json`, same engine and seeds-by-lane) runs for workers 1-6 and 10 (17 research jobs in all; 25 Nov 2026 owner: "double the worker and jobs": the free plan's 20 concurrent jobs are the ceiling, so 17 leaves room for the council loop and CI), so the council loop and CI always find a free runner (a free plan allows 20 at once). Only shard 0 dispatches the next run (it starts both shards); the input `shard` (0 or 1) starts one shard alone. Never add shards to every worker: 20 jobs would starve the council loop.

## The auto-researcher's NAS100 breakout lead, tested on its own (25 Nov 2026, owner: "NAS100 breakout, long, focus on that")
`research/edge/nas100-brk-long-focus/` (PREREGISTRATION.md committed alone first, one wording amendment before any result; `run.mjs`,
RESULT.md, result.json; `tests/nas100-brk-long-focus.test.mjs`). The rule: worker 10's lead `nas100|brk|long` on OANDA NAS100 H1,
long when the close beats the previous 20 highs, entry 14-21 UTC, close above the 200-bar average, stop 1 ATR, 4R, out after 96 h.
Gate: the engine on the full file (131,132 bars from 2005) gives A n 1,018 +0.198R, B n 473 +0.370R, C n 645 +0.484R. **PASS on the
five pre-registered tests, so a CANDIDATE for a forward record, never an edge**: at an assumed 6e-5 cost C is +0.464R (t 4.86);
the same long filters with no breakout +0.098R and 2,000 random filter-only draws none near it; 16 of 16 one-at-a-time neighbours
positive in A, B and C; other indices positive but about a fifth the size (US500 +0.155R, pooled +0.095R, month t 2.28, JP225 0);
best year 25 % of the C total. Weak points said in RESULT.md: the other indices are one bull market seen five times, 2026 so far
is −0.05R (n 74), the rule came out of 118 million tries, and the cost is assumed, not a futures quote. Expect nearer +0.1R than
+0.46R forward. Proposed next (owner): a forward record from 26 Nov 2026, then a measured broker cost. Nothing live changed.
Local reruns of research fetches need `node --use-env-proxy`; the engine's `loadMarket` prefers a local 5-minute cache, so the
study reads its own fetched H1 file.

**NQ1: the auto-researcher's Nasdaq leads, one Equinox desk** (25 Nov 2026, owner: "all nasdaq studies put it altogether and call it NQ1 in
equinox, and fill from january till now", then "NQ1 should be the nasdaq leads"; it replaces the same-day NAS100 breakout desk, and turnaround
Tuesday and the breakout of the day were on it for a few hours and taken off). `council/edge-desks-2.mjs` `nq1Trades` (`DESKS2.nq1`, market nas100,
`extra: { '5m': 60 }` days; loop line `--only fade,…,jpyvb,nq1,lyriac,dom`; `nq1/desk.json` + `detail/`; kinds `nq1-l1`, `l2`, `l4`, `l5`, `l6`, `nq1-t1`; `datahealth.mjs`,
`mosha-desk.mjs` `clean` know them). Five of the seven NAS100 leads the auto-researcher had on 25 Nov 2026 (Holm below 0.05 over every holdout look;
`NQ1_LEADS`, genomes FROZEN, a lead found later joins only by a deliberate change; `l3`, the rule of `research/edge/nas100-brk-long-focus`, and `l7` were
taken off at the owner's word: "remove 3 and 7", both slightly negative in 2026) read
on H1 candles built from the 5-minute ones (closed bars only, thin bars dropped) with the engine's own `sig`, `atr`, `sma`, `atrPct` (the engine
now exports `sig` and `atrPct`; behaviour unchanged), the entry the next hour's open, managed on 5-minute candles like every desk, ONE position at a
time PER READING; **plus `nq1-t1` = index-vol-breakout T1 on NAS100** (`vbDays`, k 0.5: the UTC open +/- 0.5 x the previous range, stop back at the open, out at 21:00 UTC; it lost its placebo test; owner: "Nasdaq breakout of the day should be in NQ1"). Not in it: the NQ open run (a council system) and anything of the ICT desk (a separate edge). **Readings overlap (several are long
at once): totals are not additive, and the leads are probably one effect, the Nasdaq's rise, found in several forms.** Before costs (the research
ran at none: futures). **The January-onward history is NOT new evidence: 2026 lies inside the years the search and the follow-up already read;
only trades from 26 Nov 2026 are forward.** Filled with `node --use-env-proxy council/edge-desks.mjs <dir> --days 330 --from 2026-01-01 --only nq1`.
Tests: `tests/nq1-desk.test.mjs`.

**ZERO: turnaround Tuesday on the Nasdaq, one Equinox desk** (25 Nov 2026, owner: "put it in another strategy and call it ZERO"; "NQ1 and ZERO are 2 different
things"; the Nasdaq breakout of the day went back to NQ1). `council/edge-desks-2.mjs` `zeroTrades` (`DESKS2.zero`, market nas100; loop line `--only …,nq1,zero,lyriac,dom`;
`zero/desk.json`; kind `zero-tue`): turnaround-tuesday R2 on NAS100 by the study's own `tradingDays`, `weekPairs`, `buildDays`, `trade` (the first trading day of a week closed
down more than 1 %, buy that close, stop 2 ATR(20 days), out at the next trading day's close; R before costs and financing; an open trade is read to the last candle).
Before costs; 1 Jan - 25 Nov 2026: 5 trades, 4 won, +0.169R (inside the years the study read). Tests: `tests/nq1-desk.test.mjs`.

**The NAS100 breakout as an Equinox desk** (25 Nov 2026, owner: "make it an edge for equinox and fill the months from January").
`council/edge-desks-2.mjs` `nasbrkTrades` (`DESKS2.nasbrk`, kind `nasbrk-h1`, market nas100, `extra: { '5m': 60 }` days of warm-up for the 200-bar
average and the ATR; the loop line is `--only fade,…,jpyvb,nasbrk,lyriac,dom`): the study's rule read on H1 candles built from the 5-minute ones
(closed bars only, thin bars dropped as the engine does), the engine's own `atr` and `sma`; a long at the next open when that hour is 14-21 UTC,
stop 1 ATR(14) below, 4R, out after 96 hours, ONE position at a time (a signal waits until the hour after the last trade's exit; an open trade
blocks later ones). It is managed on 5-minute candles like every desk, so the order of stop and target inside an hour is read exactly (the study
read hourly candles, stop first). Before costs. Page: Equinox tab "NAS100 breakout" (`#v-nasbrk`), `desk-trades.js` `DESKS.nasbrk`,
`desk-live.js`; `datahealth.mjs` lists `nasbrk/desk.json`; `mosha-desk.mjs` `clean` takes the kind. History filled from 1 Jan 2026 with
`node council/edge-desks.mjs <dir> --days 330 --from 2026-01-01 --only nasbrk` (74 closed trades, 16 won, −2.4R before costs, −0.032R a trade:
the study's own 2026, n 74, was −0.05R after its assumed cost). A paper record of a candidate that passed its follow-up but is not an edge;
2026 so far is flat to slightly negative. Tests: `tests/nasbrk-desk.test.mjs` (signal bars checked one by one, one position at a time, the
engine's first trade, no look-ahead, wiring).

**Box fade without gold, silver and USD/CAD** (25 Nov 2026, owner: "in box fade remove usdcad silver gold"). `council/edge-desks-2.mjs` `BOX_MARKETS` = the study's ten markets less
xau, xag and usdcad (seven: EUR/USD, GBP/USD, USD/JPY, AUD/USD, NZD/USD, USD/CHF, EUR/JPY); `DESKS2.boxfade.markets` reads them; the other fade / gap desks keep their ten.
`council/edge-desks.mjs` `buildDesk` now drops a stored record of a market the desk no longer reads, so the three markets' Box fade records leave `boxfade/desk.json` on the
loop's next run after this merges (every other desk's markets list is the full list its records come from; nothing else changes). Test: `tests/edge-desks-2.test.mjs`.

**DOM zone desk on eight markets** (25 Nov 2026, owner: "DOM zone remove euraud cadjpy gbpjpy usdchf nzdusd dax40 sp500 silver eurusd and gbpusd"). `council/edge-desks-2.mjs`
`DOM_DESK_MARKETS` = the job's eighteen less those ten = gold, AUD/USD, USD/JPY, USD/CAD, EUR/JPY, AUD/JPY, EUR/GBP, Nasdaq 100; `DESKS2.dom.markets` reads them. The desk's stored
records of the ten leave `dom/desk.json` on the loop's next run after this merges (`buildDesk` drops a record of a market the desk no longer reads). The demo JOB (`council/dom-demo.mjs`,
its `config.dom.markets`, the $100 account) is NOT changed: it still arms its eighteen unless `config.dom.markets` narrows them; ask the owner if that is meant too. Test: `tests/edge-desks-2.test.mjs`.

**FVG return without GBP/USD** (25 Nov 2026, owner: "FVG return GBPUSD remove"). `council/edge-desks-2.mjs` `FVG_MARKETS` = the study's ten markets less GBP/USD (nine); `DESKS2.fvg.markets`
reads them. The desk's GBP/USD records leave `fvg/desk.json` on the loop's next run after this merges (`buildDesk` drops a record of a market the desk no longer reads). The other
fade / gap desks keep their markets. Test: `tests/edge-desks-2.test.mjs`.

**Round-number fade on five markets** (25 Nov 2026, owner: "Round-number fade trades remove gold silver nzdusd usdjpy eurjpy"). `council/edge-desks-2.mjs` `ROUND_MARKETS` = the study's ten markets less
those five = EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF; `DESKS2.roundfade.markets` reads them (the round levels in play are the forex 0.0050 ones). The five markets' records leave
`roundfade/desk.json` on the loop's next run after this merges. Test: `tests/edge-desks-2.test.mjs`.

**Break fade without gold** (25 Nov 2026, owner: "Brake fade remove gold" = the Break fade desk). `council/edge-desks-2.mjs` `BREAK_MARKETS` = the study's ten markets less gold (nine);
`DESKS2.fade.markets` reads them; gold's records leave `fade/desk.json` on the loop's next run after this merges. Note: the Lyriac desk still trades its gold breakout (a different rule).
Test: `tests/edge-desks-2.test.mjs`.

**Orders follow the edge's markets** (25 Nov 2026, owner: "All the orders must be the ones included in the edge"). The demo mirror's Equinox book (`council/ctrader-mirror.mjs` `EQX.not`: Break fade not gold, FVG return not GBP/USD) and the bridge feed (`api/_eqx-bridge.js` `NOT`) never copy a record of a market its desk dropped, even an older stored one; the DOM demo job (`council/dom-demo.mjs` `DESK_MARKETS`) arms only the DOM desk's eight markets (`config.dom.markets` may narrow them, never widen). A test compares each list with `DESKS2` in `council/edge-desks-2.mjs`: change a desk's markets and these lists together. Positions already open on a dropped market run to their own exits with their stops.

**Box fade without EUR/JPY** (25 Nov 2026, owner: "Box fade remove eurjpy"): `BOX_MARKETS` is now six markets (EUR/USD, GBP/USD, USD/JPY, AUD/USD, NZD/USD, USD/CHF); its stored EUR/JPY records leave `boxfade/desk.json` on the loop's next run.

## Agent Farm (25 Nov 2026, owner: "do more interactive and funny … make it live on the site and allow to put as widget for android and iphone")
`farm.html` at `/farm` (vercel.json rewrite, copied by build.sh; manifest shortcut "Agent Farm" → `/farm`; the widget view is its button or `/farm#widget`): the auto-researcher's ten workers as 3D characters (three.js from jsdelivr, a blocky agent a desk). Signed-in members only (`/api/me`; signed out sees a line). Live: every lane file of every worker (`research/auto/worker-<w>[-<lane>].json`) through `/cdata` with `If-None-Match`, re-read every 3 minutes (a missing lane is asked again after 10 minutes); a lane is "working" when it saved within 40 minutes (lanes 8-11 of workers 3-6 are the laptop's). Speed is a made-up scale, one try = one metre (3.6 km/h per try a second), from the lane files' tries over their running time, then from the change between two readings; the distance is tries / 1000. Fun, cosmetic only: coffee, dance party, race, poke, jokes, "zzz" when a worker has not saved for an hour. `#widget` (Widget view button) is a compact list for a pinned window. **A website cannot be a native Android or iPhone widget**: installed from the browser (Add to Home Screen / Install) it is an app icon and, on Android, a long-press shortcut; a true widget needs a native app or a widget app that reads a data address. Display only: no order, no storage, no POST (`tests/farm.test.mjs`). Not checked in a real WebGL browser (the build sandbox has none): the list, the numbers and the page wiring were run in a headless browser.
**Portuguese voices, new characters, a cosy office** (26 Nov 2026, owner: "improve the farm make it more enjoyable to watch and see, they can speak portuguese so i can hear, improve the characters, the environment and design"). Still one page, display only, nothing stored (not even a preference). (1) **Voices**: the browser's own speech (`speechSynthesis`; `pickVoice`: a `pt-PT` voice, else `pt-BR`, else any `pt`), OFF until "Voices" is tapped (`VO.on`; browsers want a tap first), a volume slider, a pitch and pace per agent (`PITCH`, `PACE`). One speaker at a time through a queue of at most four with a pause between lines (`talk` / `pump` / `endTalk`); the speaker has a pulsing ring, a highlighted name tag and list row, a speech bubble with the same line, and the line under the buttons (`#nowsay`). No Portuguese voice on the device = bubbles only, said once (`#vnote`). The lines are European Portuguese, between `/* PT-LINES */` and `/* END PT-LINES */` (about 130; the page's own text stays English); **a line carries no digit of its own**: a number is a `{token}` filled by `fill()` from the files just read (tries, results, km/h, lanes, checks, totals; `ptNum` says "2,3 milhões de"), and a line whose number is missing is not spoken. (2) **Characters**: rounded heads, eyes that blink, a mouth that moves while speaking, a different hat / hair / headphones / glasses each (`dress`), typing, sipping, stretching, looking around, waving when poked, walking to the coffee corner, the wall board, the cooler and the sofa. (3) **Office**: wood floor, rug, a window whose sky follows the visitor's clock (`skyPaint`: sun or moon, stars, and the room's light with it), two lamps, plants, a bookshelf, desk monitors with a small moving chart (decoration) and the agent's real speed, and a wall board with the live totals (`boardPaint`). The camera sways slowly, drag looks around, a tap on an agent focuses it and opens its stats card (`#card`). (4) **Look**: the `--au-*` tokens and `/assets/soft.css`, dark in every system theme (`data-theme="dark"`), Inter, 12 px text and 44 px targets; reduced motion = no sway, no dance, no limb animation (voices still work). (5) **Data**: files of research version `auto-2` carry `cPasses` ("results") and `cLooks` ("checks"); only files of the newest `version` seen are counted (`verOf`); the page says "results (low bar: many are luck)" wherever it shows them. Shared geometries and materials, pixel ratio capped at 2, nothing drawn in a hidden tab. Without WebGL the list, totals, card and spoken lines still work (`html.nogl`). Checked in headless Chromium with software WebGL and stubbed files (1440 and 390 px, with and without WebGL): no page error, no sideways scroll, no request but GET. **Not checked**: a real Portuguese voice (the headless browser has none, so only the bubble path ran), a real phone's frame rate, Safari.

**What each one is doing, and the results board** (26 Nov 2026, owner: "improve the whole design of the farm and i would like to see what each one is doing and a big board showing results"). Display only, `farm.html`. Under the office: a card an agent (`#crew`, `doing(i)`, `drawRows`): working / not saving / no file yet, what it searches and where (`FAM`, `WHERE`: research version auto-2, every agent the same four kinds; worker 10 the Nasdaq only), rules a second over its lanes, and the LAST RULE IT TOOK TO A CHECK from its newest lane file's `looks` in plain words (`ruleText`, `trigText`, `sideText`) with whether it became a result; then the **Results board** (`#rb`, `results()`): four large totals, results a market, and the strongest result of each rule group over every agent's `results` (15 rows, "Show 200"): market, rule, trades, R a trade, t since 2019, t 2023 on, found by. Every value from a file goes through `esc`. The board says about one random rule in forty clears the bar by luck: a list to look through, never an edge. The office is full width (the stats card takes a column only while an agent is selected). `msFarm()` gained `board` and each agent's `doing`. **The board is inside the office too** (owner, same day: "the board is inside the farm environment"): the wall board is a large panel (10.6 x 5.3 units, canvas 1536 x 768, `boardPaint`) with the totals, the seven strongest results (market, rule, trades, R a trade, t, the agent's colour and name) and the luck caveat, repainted only when something on it changed; the page's own board under the office stays for the full list.
**25 Nov 2026, Desk fix**: with live OANDA candles the owner's Desk threw "Cannot read properties of undefined (reading 'low')" in `P.draw` (CI's `pages` smoke test failed on `/` and `/market-structure.html` from 22:03 UTC): `msInternalLeg` took `bars[ti]` of an origin index past the loaded candles. It now returns null then (display only; `tests/market-cycle.test.mjs`). The smoke test reads candles from `MD_ORIGIN` (the workers.dev host); a sandbox that cannot reach it runs on fallbacks and misses this: run it with `MD_ORIGIN=https://aureumdesk.co.uk`.

**Mosha 6R barrier moved to the Shadows + LIT account** (25 Nov 2026, owner: "swap mosha barrier to the shadows lit account"): `council/ctrader-accounts.json` `mosha6` = `10152146` (it was `*155`, which the token never held: `mirror-155.json` said "CTRADER_ACCOUNT_ID not found for this token" and nothing was copied). That account also holds the shadow and LIT books and runs the gotobi and breakout jobs; its mirror state is `mirror-10152146.json`. Rules unchanged (6R barrier reading, gold, first-hand fills within 2 h, one per side and fill time, 0.25 % risk, the late-copy and spread checks, the 2 % day stop). The `*155` mechanism (`pickAccount`) stays in the code. `mirror-155.json` on council-data is stale and can be ignored.
**No daily stop on the Mosha 6R barrier book** (25 Nov 2026, owner: "no stop for the day"): `mirrorRound` skips the `LIMITS.dayStop` check for ids starting `mosha6:`; every copy still has its own stop (rule 1). Other books keep the 2 % stop (`bfade` 15 %). Still filtered, on purpose: one copy per side and fill time (several 6R records fill in one second at near-identical levels), copies only within 2 h of the fill, the late-copy / spread / settle guards, the open-risk and margin caps.

**The Replica demo account is the Box fade book** (25 Nov 2026, owner: "replace replica with box fade and 2%risk"): `council/ctrader-accounts.json` `boxfade` = `10152148` (the former Replica account) and `replica` has no number of its own (it trades on the base account like any book without one; the old replica copies on 10152148 are still managed by its round). `council/ctrader-mirror.mjs` `boxfadeCandidates` = the Equinox rules on council-data `boxfade/desk.json` alone, ids `boxfade:<record id>`, only the desk's six markets (`EQX.not.boxfade`: not gold, silver, USD/CAD, EUR/JPY; keep it equal to `council/edge-desks-2.mjs`), stop required, fresh within 1 h and under 0.75R from the entry, risk `LIMITS.risk.boxfade` 2 % a trade, NO daily stop (owner: "no day stop"; `mirrorRound` skips the check for ids `mosha6:` and `boxfade:`; every copy keeps its own stop). The rule loses after costs on its studies: a demo record, not an edge. Test: `tests/ctrader-mirror.test.mjs` ("Box fade book").
**Every Mosha 6R record is its own copy** (25 Nov 2026, owner: "yes, every record"): `moshaCandidates` no longer keeps one record per side and fill time. The mirror's `dropTwins` still drops an EXACT duplicate (same side, second, entry, stop and target), and the freshness (2 h), late-copy, spread, margin and open-risk caps still apply, so several records at one second can still be held back by the caps.

**Copied desks are read every minute** (26 Nov 2026, owner: "We need to fix these delays and late entries"). The Box fade demo copies went out 17 to 42 minutes after the desk's fill (the Equinox trackers ran every 3rd round), about 0.3R worse than the desk, with their stop and target measured from the late fill, so desk and demo results differed (26 Nov: desk +3R on nine trades, the account down). `council.yml` now runs `council/edge-desks.mjs data --only fade,bigfade,boxfade,fvg,goldvb` (the desks the mirror copies; about 6 s, `timeout 60`, never fails the loop) every round and every quick pass, BEFORE the Trader and the mirror. The every-3rd-round line still reads all the Equinox desks. Still late by design: a copy can wait while a round's heavy members run (a few minutes), and the Mosha 6R tracker (heavy, every 3rd round) is unchanged.
**Fast copy, every 20 seconds** (same day, owner: "More speed"): `council.yml` `fastcopy()` reads the five copied desks again and, only when `council/copy-due.mjs` (read only: an OPEN record first written in the last `FRESH_S` 180 s in one of `DESKS`; unsure = no) says so, runs the mirror at once. Called twice inside each minute of the wait (`nap; fastcopy; nap; fastcopy; nap`, then the usual quick pass; `nap` = 20 s, or shorter so that it wakes 4 s after a 5-minute candle closes, the first moment a desk fill can be read) and five times between a round's heavy members. The mirror is not run when no desk has a fresh fill, so the broker is not contacted more often on quiet minutes. Keep `DESKS` equal to the desks the mirror copies (a test compares). Test: `tests/copy-due.test.mjs`.
**The forming candle gives the fill** (26 Nov 2026, owner: "More faster"): the first fast copy still came about 6 minutes after the desk's fill, because a market entry fills at the OPEN of the candle after the signal and the desks read closed candles only, so the fill was first seen when its own 5-minute candle had closed. `council/edge-desks.mjs --live` (the three fast lines of `council.yml` only) reads the 5-minute candle now forming (`liveBar`, `B.live5`; any failure = none) and `council/edge-desks-2.mjs` `withLive` appends it for the FILL in the fade, big-candle fade, round-number fade, box fade and FVG adapters. Signals still come from closed candles only (`frames(M5)`; the FVG study's signal code is run once more with the forming candle and only a fill ON that candle is taken); on the forming candle a stop or target already traded is booked, never a time exit (`walk`: `!b.live`). A test compares every record read on a forming candle with the record read once it has closed (same id, side, entry, stop, target). `nap` wakes 2 s after a 5-minute close (4 before). So a desk fill is read about 2-10 s after its candle opens. The every-3rd-round line reads closed candles as before.
**No daily stop on the desk-copy books** (26 Nov 2026, owner: "dont worry the daily stops OFF"): `mirrorRound` skips the daily loss stop for ids `mosha6:`, `boxfade:`, `eqx:` and `bfade:` (the Equinox account had stopped copying at 3.1 % down). Every copy keeps its own stop (rule 1); the council, shadow and ICT books keep the 2 % stop. `LIMITS.dayStopBfade` is no longer read. Demo accounts only: the mirror still refuses any account whose `isLive` is true.

**Gold DOM 4R, a second demo record** (26 Nov 2026, owner: "yes do gold dom 4r on demo"): `node council/dom-demo.mjs data --variant gold4r` (`VARIANTS.gold4r`; council.yml runs it right after the base job, each round and quick pass, `timeout 45`). The base job's zone, order, stop and guards on GOLD ONLY with a 4R target; its own label `dom4` (comment `dom4 <id>`), file council-data `dom4/trades.json` and config key `config.dom4 = { on, account, risk }`; account = `config.dom4.account`, else the gotobi job's (`accountFor`: the Shadows + LIT demo account), 0.25 % of the balance a trade. The base job and it only ever touch their own label. Why: `research/edge/dom-gold-hourcost` made +0.072R a trade at measured costs in 2024-now and -0.015R in 2021-23 (FAIL): a forward demo record to see which half repeats, never an edge. The job arms on H1 closes with a 24 h order, the study filled on M5 touches with a 12-candle life: the record is not the study's exact rule. Test: `tests/dom-demo.test.mjs`.

## After costs on every desk (26 Nov 2026, owner: "on all edges add the option after costs")
Display only. Every desk's trade card (Mosha, Engulfing, MSNR, LIT and the Equinox desks) has an "After costs" switch beside Refresh (`data-sop-costs` / `data-dk-costs`). On, each trade's R (and an open trade's floating R) has one round trip taken off, measured on the risk it opened with: `assets/mosha-sop.js` `COSTS` (price units a market: the demo broker's figures for gold, the majors and the Nasdaq, ASSUMED for the rest, the studies' own table), `costR`, `costed(rows)`; tiles, filters' totals, the calendar and "By entry type" follow, and the labels read "after costs". No financing. The choice is `window.MS_DESK_COSTS` (memory, shared by the desks for the visit; nothing stored, the stored records are never changed). The trade chart dialog still shows the record's own R. Test: `tests/desk-costs.test.mjs`.

## Box fade as the entry at a Mosha barrier, 6R target (26 Nov 2026, owner: "Why not use box fade for entry for barrier 6", "Run")
`research/edge/boxfade-barrier-6r/` (PREREGISTRATION.md committed alone first; one amendment committed alone before any result was read; `run.mjs year <Y> <dir> | cut <Y> <dir> | report <dir> <mosha-6r-quality year files>`, RESULT.md, result.json). The Equinox Box fade signal (`grid6-box-in-box` `signals`, the `fade-breaks-holdout` F1 cell, its 07-17 UTC filter kept, imported) taken on gold only when its fill is inside (or within 0.25 x ATR(14, M15) of the near edge of) a standing Mosha barrier zone of its own side that price came back to within the desk's watch (`assets/mosha-sop.js` `zonesOf`, one-candle structure, D1 to M15; BO / iBO origin and engulf boxes; sweep barriers and the sequence's CF / VR zones left out), the Box fade stop, a 6R target, out after 5 days, one position at a time, $0.30 a round trip, in sample 2018-21, out of sample 2022 to Oct 2026. **FAIL**: out of sample −0.003R a trade after costs (n 1,294, month t −0.04; +0.065R before costs, 18 % winners), in sample −0.108R (n 994), −0.070R at twice the cost. "At a barrier" selects almost nothing: 92 % of Box fade signals qualify (about 17,000 zones a year), and it does not pick the better trades (against the signals not at a barrier: Welch t 1.04 out of sample, −1.14 in sample). Beside it: the desk's own 6R barrier entries −0.082R out of sample (n 92,504), the at-barrier Box fade with its own 1R exit −0.053R (n 2,765). Cut tests 2020 and 2024 identical. Nothing live changed; no variant on these years. Test: `tests/boxfade-barrier-6r.test.mjs`.

## The Nasdaq leads at the broker's own ticks (26 Nov 2026, owner: "re price the nasdaq leads at fusion real quotes")
`research/edge/nq1-leads-exec/` (PREREGISTRATION.md pushed alone first, one amendment committed alone before any tick R was read; `orders.mjs`, `run.mjs orders|queries|dead|report <probe dir>`, MEANING.md, RESULT.md, result.json). The six NAS100 leads (NQ1's l1, l2, l4, l5, l6 and l3 = the 20-hour breakout), 2,386 orders 2023-12-01 to 2026-11-20, entered at the demo broker's NAS100 ask / bid (tick probe `marks` / `fills`, tags `nq1-entry-*`, `nq1-f2-*`, `nq1-dead-1`), stop and target at the broker's own ticks, financing 0.62 points a night on a buy. **2 of 6 pass (l1, l5)**; every rule stays positive after financing: l1 +0.269R (n 365, month t 3.19, Holm 0.0035), l5 +0.364R (n 317, t 3.98), l2 +0.189R (t 1.85), l3 +0.206R (t 1.55), l4 +0.139R (t 1.81), l6 +0.094R (t 1.49). Cost is small: entry spread about 0.013R, financing under 0.01R; 69 orders had no entry quote, none an unresolved exit. **Not new evidence**: these years lie inside the auto-researcher's holdout where the rules were chosen out of about 118 million tries; all six are long readings of one rising market, overlap heavily, earn only on trades held over the 21:00-22:59 UTC break, and fade by year (l1 +0.46R in 2024, +0.12R in 2026). A candidate for NQ1's forward record from 26 Nov 2026, never an edge. **The broker's NAS100 is not on the candles' price basis** (mid a median 15.9 points under the OANDA open at entry, 1st-99th percentile −82.9 to +8.9): a tick-exec study on an index must look for a level L on candles at L − b0 with a wide margin (`queriesOf`), or it misses the broker's own crossings (the first pass left 557 orders unresolved). Nothing live changed. Test: `tests/nq1-leads-exec.test.mjs`.

## The two Nasdaq leads on a demo account (26 Nov 2026, owner: "Get the nasdaq ready to live this night"; rules "l1 and l5 only", risk 0.5 % a trade)
`council/nq-demo.mjs` (council.yml: each round and quick pass after the DOM jobs, `timeout 45`, never fails the round). The two leads that passed `nq1-leads-exec` (NQ1_LEADS `l1`, `l5`, frozen genomes read from `council/edge-desks-2.mjs`): once an hour, in its first 12 minutes (`LOOK_FROM` 8 s to `LOOK_UNTIL` 720 s; `J.looked` = the hour already read), it reads 900 OANDA H1 candles of NAS100, builds the engine's arrays from the CLOSED ones (`frame`) and reads the signal at the last closed candle with the engine's own `sig` / `atr` / `sma` / `atrPct` (`signalAt`, one bar of the study's `orders()`; a test compares). A signal = a market BUY with `relativeStopLoss` = `g.stop` x ATR(14) and `relativeTakeProfit` = `g.rr` x that distance (both measured from the FILL: the broker's NAS100 sits about 16 points under the candles), volume = balance x 1 % / stop distance (owner, same day: "1% for both"; 0.5 % in his first answer) (one unit loses $1 a point; under the smallest volume only while a stop-out costs at most 1 %), labels `nq-l1` / `nq-l5`, comment `<label> <hour>`. Not sent when the forming candle has already moved over `MAX_DRIFT` 0.25 of the risk from the hour's open (`missed`), when the hour has no candle (market shut), or twice for one hour (a position found by label and comment is adopted). One position at a time a rule. Each later hour, while a position is open: rule 1 guard (no stop at the broker: amend to the record's stop, refused: closed at once), the time exit after `g.hold` CLOSED H1 candles since the fill bar (48 for l1, 240 for l5; candles, not clock hours, as the engine counts), and a position the broker closed is booked from the H1 candles moved onto the broker's price basis (`inferExit`, stop first, `inferred: true`; the allowlist has no deal list). With no signal and no open position it does not connect. Record: council-data `nq/trades.json`. Config: `config.nq = { on, account, risk }` (risk 0.0005-0.01, default 0.01; account default = the gotobi job's, the Shadows + LIT demo account); `{ on: false }` stops it.
**Demo only, said plainly**: the owner answered "Live tonight, real money" for this one job, but no real-money account is open, funded or authorised for the cTrader app, so the job runs on DEMO and cannot reach a live account: it goes through the gotobi job's `connect()` (demo host, `CTRADER_ENV=demo`, refuses any account whose `isLive` is not false; a test sends a live account and sees no account auth and no order). A live switch needs (1) the owner's live account authorised for the app and its last digits, (2) a deliberate, separate change for THIS job only (its own host and account check, never the shared `connect()` or the mirror), (3) the exception to absolute rule 2 written into the rules at the top and `docs/owner-decisions.md` (item 46 says paper and demo until at least November 2027). Never widen the demo lock of any other job.
What the evidence is: `nq1-leads-exec` (l1 +0.269R, l5 +0.364R a trade after financing at the broker's ticks, 2023-12 to 2026-11) on years the search had already read; both are long readings of one rising market, earn only on trades held over the 21:00-22:59 UTC break, and fade by year. A candidate judged by this forward record, never an edge. Order up to 12 minutes after the hour (the loop's heavy members can hold a pass): `lateS` and `drift` are on each record. Not checked against the real broker (a MARKET order carrying both relative levels on NAS100; the fake broker of the test stands in). Tests: `tests/nq-demo.test.mjs` (10).

**NQ2: the two leads the demo job trades, as an Equinox desk** (26 Nov 2026, owner: "Put the edge on the desk with the results since january on calendar"). `council/edge-desks-2.mjs` `nq2Trades` (`DESKS2.nq2`, `NQ2_IDS` l1 + l5, market nas100, `extra: { '5m': 60 }`; kinds `nq2-l1` / `nq2-l5`; `leadTrades(L, ctx, from, desk)` now takes the desk name): exactly the trades the NQ1 desk reads for those two leads (a test compares), one position at a time a reading. Loop line `--only …,nq1,zero,nq2,lyriac,dom`; `nq2/desk.json` + `detail/`; `mosha-desk.mjs` `clean`, `datahealth.mjs`, `desk-trades.js` `DESKS.nq2`, `desk-live.js`, `equinox.html` `#v-nq2` (tab "NQ2" after ZERO). Filled with `node --use-env-proxy council/edge-desks.mjs <dir> --days 330 --from 2026-01-01 --only nq2`: 202 closed trades to 26 Nov 2026, before costs: l1 112 trades, 30 won, +8.8R (October −8.0R, November −6.0R); l5 90 trades, 25 won, +6.4R. **Not new evidence**: 2026 lies inside the years the search and the tick study read; only trades from 26 Nov 2026 are forward. The readings overlap: totals are not additive. This is the PAPER reading on OANDA candles; the demo job's own fills are council-data `nq/trades.json`. Test: `tests/nq1-desk.test.mjs` ("NQ2").
**Gold breakout added to NQ2** (26 Nov 2026, owner: "add the gold break out on nq2"): `nq2Trades` with market `xau` = the Gold breakout desk's own T1 trades (`vbDays`, the same entries, stops and R as `goldvb`: a test compares) under kind `nq2-t1`, label "Gold breakout: UTC open ± ½ the previous range"; `DESKS2.nq2.markets` = `['nas100', 'xau']`. The desk is then the owner's planned book for a later live account less the USD/JPY breakout. Three readings on two markets: totals are not additive across the Nasdaq leads, and a desk total is never evidence.
**The gold 8-swing break added to NQ2** (27 Nov 2026, owner: "Put it in nq2"): `NQ2_GOLD` (kind `nq2-bo8`, the genome of
`research/edge/gold-bo8-exec` `G`, a test compares) read by `leadTrades` on gold H1 built from the 5-minute candles: an H1 close above the
last unbroken 8-a-side swing high, long at the next open, stop 0.75 x ATR(14), 6R, out after 24 hours, one position at a time, the
researcher's own skip when the stop is under twice the cost. Filled from 1 Jan 2026: 76 closed, 24 won, +41.7R before costs. Those months
lie inside the years the search and the tick study read: not new evidence; only trades from 27 Nov 2026 on are forward.

**The live account's planned book** (26 Nov 2026, owner: "Lyriac (no gotobi) should be in the same live account as well"): when the owner's real account exists, the plan is the Nasdaq job (l1, l5) AND Lyriac's two breakouts (gold and USD/JPY, `council/vb-demo.mjs`), never the gotobi fade, on that ONE account. Today both jobs already share one DEMO account (the Shadows + LIT demo account, `accountFor`); nothing live is wired, and the three conditions of the section above apply to the breakout job as well (its own deliberate change, the account's digits from the owner, the exception written into the rules). The gotobi job stays demo. Risk on that account (owner: "1% for both"): 1 % a trade for the Nasdaq rules and for the breakouts (the breakouts were already 1 %, `config.vb.risk`).

## The researcher looks for rules that follow market structure (26 Nov 2026, owner: "Tell the researcher to look the edges following market structure")
`research/edge/auto-researcher` workers **11** and **12** (PREREGISTRATION.md section "Two market-structure workers", committed alone first; version, windows, bars, stages and the Holm rule over every C look unchanged; workers 1-10 draw exactly what they drew before, checked against main's engine on 30,000 draws). `engine.mjs` `struct(D, P)`: swings of `P` candles a side, known only `P` candles later; a close beyond the last unbroken swing = a break; `bk` (+1 / -1), `kd` (1 = bos, with the structure; 2 = choch, against it), `st` (the structure's direction), `dp` (how far a non-break candle that closed with the structure pulled back into the leg). Triggers `bos`, `choch` (followed or faded), `mspb` (pullback of at least `d`); filter `ms` / `msP` = the same structure with a larger swing (with / against / none), read in `simulate` only when a rule carries it. Grids `MS_SPACE` (P 2-8, d 0.382-0.786, msP 8-30). Worker 11 = one structure trigger; worker 12 = a structure trigger plus a second trigger that must agree (structure or one of the eight older kinds). Markets `MS_MARKETS` = the ten and `nas100` (Nasdaq before costs, as worker 10). **Runner budget**: the workflow already used the 20 jobs a free plan allows, so workers 7 and 9 (duplicates of 5 / 6 and of 3) stopped: `researcher.yml` maps a start of worker 7 to 11 and of 9 to 12 (their own chains hand over by themselves after the merge), one runner each; the files of 7 and 9 stay and are still counted. The Agent Farm shows 11 and 12 ("Sol", "Ivy") at those two desks (`IDS`). A lead from these workers is a lead like any other: re-priced at the broker's quotes before it means anything. Earlier hand-made structure studies (`ltf-structure`, `direction-chain-gate`, `vb-structure-filter`) all failed, so the prior is low. Tests: `tests/auto-researcher.test.mjs` (two new).


## ICT on the Nasdaq and FVG return (gold, silver) on the Nasdaq job's demo account (26 Nov 2026, owner: "find the best setup of ict", "add 1 and 2 to nq live", "and 3", "add fvg return (gold and silver) to nq live account")
Two new mirror books on the Shadows + LIT demo account 10152146 (`council/ctrader-accounts.json`), where the Nasdaq job, the breakouts, gotobi and the Mosha 6R copies already trade. **Demo only** ("live" in the owner's words is the planned real account, which does not exist yet; the mirror refuses any account whose `isLive` is true). Both 1 % a trade, no daily stop (desk-copy books), every copy with its stop.
- **`ictnq`** (`council/ctrader-mirror.mjs` `ictnqCandidates(ict, shadow, nowS, on)`, `ictnqSetups`, `ICTNQ`): the three ICT setups the review of the 24 ICT studies ranked best, NQ only, from the ICT desk's OWN records: (1) dip-buy = `ict/shadow.json` variant `dip` (`ict-index-longonly` PASS on 2018-26, `ict-dipbuy-oos` FAIL on 2008-17); (2) an A-setup with `feat.htfFvg` (`ict-variants` V3, not strong); (3) an A-setup whose signal candle did not close on a New York Friday (`ict-filters`, weak). Ids `ict:x:<record id>` (still an `ict:` id: the stop distance is copied from the fill, the desk's trail and break-even are followed, rolls absorbed), one copy a signal (the dip twin of an A record is dropped; the plain `ict:` candidate of a taken record is left out of the round), only a record opened within 2 h is OPENED, flat 1 % (the desk's size multiplier is not applied), a stop on the losing side or no candidate. Off-switch: `config.mirrorIctNq = false`. The 24 Nov "Stop ICT copies" rule (`mirrorIct`) still stops every OTHER ICT copy. ICT stays Fred's separate edge: nothing under `ict/` changed, and these copies are never counted with a council system or the Nasdaq leads. Not priced at the broker's ticks; the tracker runs every 3rd round, so a copy can be up to about 35 minutes after the desk's entry.
- **`fvgm`** (`fvgmCandidates`, `FVGM.markets` xau, xag): the FVG return desk's records of gold and silver only, the Equinox copy rules (fresh within 1 h, under 0.75R from the entry), ids `fvgm:<record id>`. The Equinox account (…144) copies the same desk independently. The rule is about zero after costs on its studies.
- **Desk slices `egd1` and `litr`** (same day, owner: "D1 engulf zone nasdaq eurusd silver add to nq live", "add LIT the rule (audusd,usdcad) to nq live account"; `SLICES`, `sliceCandidates(book, file, nowS)`): one kind of one desk file on named markets, by the Equinox copy rules: `egd1` = `eg/desk.json` kind `eg-1d` on nas100, eurusd, xag; `litr` = `lit/desk.json` kind `lit-rule` on audusd, usdcad. Ids `<book>:<record id>`, 1 % a trade. `SYMBOLS` gained `nas100`. Their trackers run every 3rd round (a copy can be about 35 minutes late; the 1 h / 0.75R guards hold). Paper readings before costs, never tested as edges on these markets.
All are demo records of rules that are not proven: never an edge. Tests: `tests/ctrader-mirror.test.mjs` ("ICT Nasdaq book", "FVG return (gold and silver) book", "desk slices").

## The auto-researcher, version auto-2: EG, EF and BO only, 2019 to now, t above 1 (26 Nov 2026, owner: "save what we got now and make it focus only in EG EF BO, and i only want results from 2019 till today t above 1 is okey")
`research/edge/auto-researcher/PREREGISTRATION.md` section "Version auto-2" (committed alone first). **auto-1 is saved and stopped**: its 96 worker files are council-data `research/auto-1/`, its last report (593.7 million tries, 6,915 holdout looks, 9 leads, all long NAS100) is `research/edge/auto-researcher/auto-1-final.json`. `engine.mjs` `VERSION` is `auto-2`; a worker file of another version is started afresh, and `report` counts auto-2 files only. auto-1's `WIN`, `BAR`, `FAMILY`, `genome`, `sig` kinds and `simulate` stay exported unchanged (the desks, the Nasdaq demo job and the tick studies import them).
- **Rules** (`genome2`, `K2`): one trigger or two agreeing on the same H1 candle, of `eg` (an engulf completes; `egAt`), `egr` (the first return to a standing engulf zone that closes back out on the engulf's side), `ef` (the first close through a standing zone's far side, traded in the direction of the failure; `zones(D, life)`, one causal pass, life 12 / 24 / 48 / 96 candles) and `bo` (a close beyond the last unbroken swing, `struct`, P 2 / 3 / 5 / 8; any break, with the structure, or against it). Filters and exits as auto-1. Markets: the ten and the Nasdaq (before costs); worker 10 Nasdaq only. Every worker draws the same kind of rule (only seeds differ).
- **Windows and bars** (`WIN2`, `BAR2`, `resultOk`): search 2019-2022 (n >= 100, mean > 0, month t >= 1, the flipped twin negative), check 2023 to now once per group (n >= 50, mean > 0, t >= 1), and 2019 to now t >= 1. A rule clearing all three is a **result** (each file keeps its best 200 by the 2019-now t; `report` lists them). A **lead** still needs check n >= 100, t >= 2 and Holm under 0.05 over every check look.
- **What a result is worth**: about one random rule in forty clears these bars by luck, and a worker makes about a hundred tries a second: a one-minute trial gave 64 results. The list is something to look through, never an edge or evidence; anything taken further is re-priced at the broker's quotes first. Never quote a result's t without saying this.
- `researcher.yml` is unchanged (workers 1-6, 8, 10, 11, 12; a worker missing a market's candles skips that market). Read the state: `node research/edge/auto-researcher/engine.mjs report <dir with the worker files>`. Tests: `tests/auto-researcher.test.mjs` (two new).

## DOM zone on gold: can the better trades be told apart at the fill? (26 Nov 2026, owner: "DOM ZONE gold is good after costs but we need to improve it or filter the good trades")
`research/edge/dom-gold-quality/` (PREREGISTRATION.md pushed alone first; `run.mjs <ticks-XAUUSD.json at 0459ec37>`, RESULT.md, result.json). `dom-gold-hourcost`'s own gold trades (4R exit, measured costs C1), ten features known at the fill (side, session, cost share, stop size, sideways, H1 trend, 20-day move, efficiency ratio, zone age, weekday) shrunk into one score fitted on 2021-23 (8,850 trades) and judged on 2024 to now (8,909). **PASS on the pre-registered bar, with a large caveat**: the kept third made +0.190R a trade after costs on 2024-now (n 2,965, month t 5.01) against +0.072R for all trades (Welch t 3.86 against the rest, 40 of 40 shuffled refits beaten), and was positive in every year 2021-26 (+0.07R in 2021-23, in sample). But the score does not order the trades: the third it said to AVOID made +0.094R on 2024-now (more than the middle third, -0.056R), though it was the worst in 2021-23 (-0.146R). What agrees in both windows: with the H1 trend, a wide stop, not the 17-21 UTC hours. The side and 20-day-move gaps on 2024-now are the gold rise, not the fit. In-sample years (the grids read 2020-26), one demo broker's quotes on mid candles (at the broker's own ticks the limit filled worse, `dom-tick-exec`): a hypothesis for a forward record, never an edge; nothing live changed and the demo job (`dom-demo.mjs --variant gold4r`) takes every zone as before. The current council-data probe file has an empty hour profile (a later probe run overwrote it): the study reads the file at commit 0459ec37. One run: no variant on these years. Test: `tests/dom-gold-quality.test.mjs`.

## The auto-researcher, version auto-3: engulf (EG) and engulf failure (EF) only, 2021 to now (27 Nov 2026, owner: "from now on focus only 2021 till today, specially engulfing eg and ef")
`research/edge/auto-researcher/PREREGISTRATION.md` section "Version auto-3" (committed alone first). auto-2 is saved and stopped:
its 104 worker files are council-data `research/auto-2/`, its last report (2.37 billion tries, 5.17 million checks, 3,605 results,
0 leads) is `research/edge/auto-researcher/auto-2-final.json`. `engine.mjs` `VERSION` is `auto-3`; `K2` = `eg`, `egr`, `ef` and
the new `efr` (the first return to a FAILED engulf zone, which then serves the other side until a close back through it, closing
back out on the failure's side; `zones()` returns it, causal like the others); `bo` is dropped. `WIN2`: search 2021-2023, check
2024 to now, all 2021 to now. Bars, filters, exits, markets and the workflow are unchanged; the structure workers 11 and 12 draw
the same engulf rules now. 2021 to now has been read by every earlier version and the desks: a result is a list to look through,
never an edge; anything taken further is re-priced at the broker's quotes first. Tests: `tests/auto-researcher.test.mjs`.

## The researcher's EUR/JPY engulf-retest sell at the broker's own ticks (28 Nov 2026, owner: "yes price the eurjpy sell")
`research/edge/eurjpy-egr-exec/` (PREREGISTRATION.md pushed alone first; `orders.mjs`, `run.mjs orders|queries|report <probe dir>`,
MEANING.md, RESULT.md, result.json; probe tags `ejegr-entry`, `ejegr-dead`, `ejegr-fills-1..10`). The auto-3 lead
`eurjpy|egr48|short|none|0.75|1.5` (the first return to a standing H1 engulf zone up to 48 candles old that closes back out, sold at
the next open at 10-15 UTC with the ATR in the top 70 % of its last 500; stop 0.75 x ATR(14), 1.5R, out after 24 H1 candles; gate:
equal to the engine's `simulate`), 106 orders 2023-12 to 2026-11, filled at the demo broker's bid and closed at its ask, after its
commission (0.000045 a round trip) and swap on a short (1.007 pips a night). **PASS**: +0.409R a trade after costs (n 106, month t
4.69; mid +0.364R; every order quoted and resolved; entry spread 0.004R, swap 0.005R). Lead 2 (12-candle zones, 07-18 UTC, out after
96 candles) beside it: +0.347R (n 176, month t 5.08), the same idea. Found among about 1.1 million looks on these same years, one
market, sells only: a candidate for a forward record, never an edge. Nothing live changed. The researcher was paused for the run
(owner: "pause the researcher") and restarted after it. Test: `tests/eurjpy-egr-exec.test.mjs`.

**Its forward record** (28 Nov 2026, owner: "Nice keep going"): `research/edge/eurjpy-egr-forward/` (PREREGISTRATION.md pushed
alone first; `run.mjs baseline|fetch|run`). The same orders (`eurjpy-egr-exec/orders.mjs` `orders(D, G)`) on OANDA mid H1 read
from 2025-06-01, filled from 2026-11-30 and counted once all 24 hold candles are on file; cost = the engine's round trip + the
demo's commission + the short's swap (frozen); bands from the exec study's 106 window orders on mid (gated n 106, mid +0.364R;
net mean +0.320R). Readings and checkpoints as `gold-vol-breakout-forward` (too few under 20, 120 / 240; "confirmed" also needs the
total at twice the cost above zero). `vb-forward.yml` writes council-data `research/forward/eurjpy-egr.json`; the Edge lab's
Forward records card has its row. About three trades a month: 20 take half a year. On the fetched H1 the 2026 orders match the
cached ones 28 of 28 (one extra order on a thin hour). Nothing trades. Test: `tests/eurjpy-egr-forward.test.mjs`.

## The auto-researcher's USD/JPY morning breakout at the broker's own ticks (26 Nov 2026, owner: "usdjpy run")
`research/edge/usdjpy-brk-exec/` (PREREGISTRATION.md pushed alone first; `orders.mjs`, `run.mjs orders|queries|report <probe dir>`, MEANING.md, RESULT.md, result.json). The near-lead of auto-1 (USD/JPY: an H1 close above the previous 10 highs and above the 200-hour average, bought at the next open at 07-12 UTC on a Tuesday, Wednesday or Thursday; stop 3 x ATR(14), 3R, out after 8 H1 candles; Holm p 0.067, so not a lead by the researcher's rule), 131 orders 2023-12 to 2026-11, filled at the demo broker's ask and closed at its bid (tick probe tags `jpyb-entry`, `jpyb-dead`, `jpyb-fills-1`). **PASS**: +0.250R a trade after commission (n 131, month t 3.31), equal to the mid-candle +0.252R; every order had an entry quote, no exit unresolved; 107 time exits (+0.50R), 23 stops, 1 target; 2024 +0.32R, 2025 +0.24R, 2026 +0.20R. The cost is not what it rests on (a stop of about 54 pips, never open in the rollover). **Not answered by the pass**: found on these years out of about 554 million tries; the weekday filter may be luck (Mon + Fri 0.000R, every weekday +0.129R on the search data); buys only in a rising USD/JPY; it overlaps the USD/JPY breakout of the day. A candidate for a forward paper / demo record, never an edge; no variant on these years. Nothing live changed. Test: `tests/usdjpy-brk-exec.test.mjs`.

## USD/JPY morning breakout on the Nasdaq job's demo account, 2 % a trade (26 Nov 2026, owner: "So the usdjpy risk 2%")
`council/nq-demo.mjs` has a third rule `uj` (`UJ`): the genome of `research/edge/usdjpy-brk-exec` (`G`, a test compares), market `usdjpy`, broker symbol USDJPY, label `nq-uj`, **2 % of the balance a trade** (`UJ.risk`, `maxRisk` 0.02; `config.nq.ujRisk` may lower it), the same hourly look, market BUY with a relative stop (3 x ATR(14)) and target (3R) on the order, time exit after 8 closed H1 candles, rule-1 guard, the 0.25R late-order guard. The job now reads one H1 feed a market (`MARKETS`, `oandaH1(now, mk)`; a market with no candle of the hour is skipped alone) and sizes by `usdPerUnit` (a USD/JPY unit loses dist / price dollars). The Nasdaq rules keep 1 %. Records stay in `nq/trades.json` (`market` on each). Demo only (the shared `connect()`); a candidate from in-sample years, never an edge. Test: `tests/nq-demo.test.mjs` ("the USD/JPY rule").
## The FVG tap after a continuation move, other timeframes, on the holdout (25 Nov 2026, owner's chart idea: "FVG tap after continue move, QM, entry, target low")
`research/edge/fvg-qm-timeframes/` (PREREGISTRATION.md committed alone first; `run.mjs`, RESULT.md, MEANING.md, result.json, trades.json). The
follow-up of `fvg-qm-continuation` (H1 only, five markets 2010 on, FAIL: that data is spent for this idea and is NOT loaded here). Five fixed
readings with the owner's parts kept (continuation BO on the gap timeframe, FVG formed in the move, tap, QM or lower-timeframe CHoCH, stop past the
pullback extreme + one cost, target the move's low, 1R minimum, one position at a time, 240 gap-candles hold): R1 H4 gap + H1 QM, R2 H4 + H1 CHoCH,
R3 M15 + M5 QM, R4 M15 + M5 CHoCH, R5 H1 gap + H1 QM with the zone-reach clause dropped. Judged on the untouched holdout (gold, EUR/USD, GBP/USD,
USD/JPY, AUD/USD 2005-2009; NZD/USD, USD/CAD, USD/CHF, EUR/JPY, silver 2005 to now; gold and silver start in 2006; Set B costs ASSUMED), pooled,
month-sum t, Holm over five, bar: mean > 0 in both sets and both halves, 2x costs, 100+ trades. **FAIL, 0 of 5**: R1 -0.035R (n 418, month t -0.44),
R2 -0.064R (n 1,003, -1.19), R3 -0.097R (n 3,301, -3.79), R4 -0.099R (n 8,751, -6.11), R5 +0.042R (n 180, t 0.40, Set A -0.196R). Before costs every
reading is about zero (-0.03 to +0.09R). Not an edge; no variants on these years. Nothing live changed. The candle cache was rebuilt in the session
(`fetch-cache.mjs`, EDGE_DATA). Test: `tests/fvg-qm-timeframes.test.mjs`.

## The researcher's gold 8-swing break at the broker's own ticks (27 Nov 2026, owner: "Yes" to pricing the gold result)
`research/edge/gold-bo8-exec/` (PREREGISTRATION.md pushed alone first; `orders.mjs`, `run.mjs orders|queries|report <probe dir>`,
MEANING.md, RESULT.md, result.json; probe tags `gbo8-entry`, `gbo8-dead`, `gbo8-fills-1/2`). The auto-2 result
`xau|bo8any|long|none|0.75|6` (an H1 close above the last unbroken 8-a-side H1 swing high, bought at the next open; stop 0.75 x
ATR(14), target 6R, out after 24 H1 candles; gate: equal to the engine's `simulate`), 282 orders 2023-12 to 2026-11, filled at the
demo broker's ask and closed at its bid, after commission (0.000024 a side) and the demo's overnight financing on a gold buy.
**PASS**: +0.714R a trade after costs (n 280, month t 4.02; mid +0.739R; 2 without an entry quote, none unresolved); every year
positive; without the ten best trades +0.52R. Found among about 4 million looks on these same years and long only in a rising gold:
a candidate for a forward record, never an edge; the rollover split in RESULT.md is a selection effect. Nothing live changed.
Test: `tests/gold-bo8-exec.test.mjs`.

## The live account (27 Nov 2026, owner: "Ima set up the live account now, risk 0.5 per trade -15% daily stop"; rules "All")
The one exception to absolute rule 2 (docs/owner-decisions.md item 64). `council/live.mjs`: `liveConfig(cfg)` (config.json `live =
{ on, account: '*<last digits of the live login>', risk 0.005 (at most 0.01), dayStop 0.15 }`), `liveEnvOk(env)` (`CTRADER_LIVE=on`,
the app id and secret, `CTRADER_LIVE_ACCESS_TOKEN` else the demo token), `pickLive` (exactly ONE account with `isLive === true` whose
login ends in the digits; a demo account is never picked), `liveConnect` (the live host through `ctrader-mirror.mjs` `liveSession`;
`session()` still refuses every host but the demo's), `dayGate` (the UTC day's first balance seen = its start, `live/day.json`; no
NEW order once the balance is `dayStop` under it; open positions keep their own stops and exits), `modeOf`. The jobs: `node
council/nq-demo.mjs data --live` (l1, l5, uj and `BO8` = the gold 8-swing break, `LIVE_IDS`; every rule at `live.risk`; the
researcher's cost skip for bo8) and `node council/vb-demo.mjs data --live` (gold and USD/JPY breakouts), each round and quick pass
in council.yml; records `live/nq.json`, `live/vb.json`, labels `lv-<demo label>`; the demo records and labels are untouched and the
demo runs go on beside it. Every order carries its stop and is read back (rule 1). OFF until the owner (1) authorises the live
account for the cTrader app, (2) sets `CTRADER_LIVE=on`, (3) gives the login's last digits for config.json. Not checked against the
real live server (the build sandbox reaches no broker): the live host name is cTrader Open API's documented `live.ctraderapi.com:5036`.
Named 27 Nov 2026: owner rule `live-on-7653` = the Fusion USD live account ending 7653 (the GBP live account ending 7681 is never picked).
Faster orders (owner, 27 Nov 2026: "make sure the orders are faster"): council.yml `fastorder` (inside every 20-second `fastcopy`) runs the Nasdaq job (live and demo) in the first 12 minutes of each hour and the breakout job in the first 20 minutes of a UTC day, and `nap` wakes 9 s after the hour, so an hourly rule's order goes out soon after the candle close. Then ("more faster"): an hour watcher runs in the background beside the rounds, wakes 1 s after every hour and runs the order jobs every 2 s for a minute (live first), whatever member the round is on; every order-job call goes through `job` (one flock per job and mode, so the same job never runs twice at once and a live job never waits for a demo one); `nq-demo.mjs` `LOOK_FROM` 1 s, and a missing candle of the new hour counts as a shut market only after `SHUT_AFTER` 60 s (it marked the hour looked at once before).
Gold at 3 % (owner, 27 Nov 2026: "on gold change risk to 3 %", live): rule `live-gold-3` sets `live.goldRisk` 0.03 (`LIVE.maxGold` 3 %): the gold breakout and the gold 8-swing break risk 3 % a trade on the live account; the Nasdaq and USD/JPY rules stay 0.5 %. Then 5 % (owner: "gold change to 5%"): rule `live-gold-5`, `LIVE.maxGold` 5 %.
Tests: `tests/live-account.test.mjs`.
**Live account card** (27 Nov 2026, owner: "okey" to a card): `council/live-account.mjs` (council.yml every 2nd round, `timeout 40`) connects through `liveConnect` and sends only TRADER_REQ, RECONCILE_REQ and SYMBOLS_LIST_REQ (no order message, a test reads the file), writing council-data `live/account.json` (balance, the day's loss against the daily stop from `live/day.json`, open positions with stop / target, resting orders, `noStop`; login masked). `/cdata` serves `live/*` to the owner's session only (`api/data.js`; the council-data branch itself is still readable on GitHub while the repository is public). Profile card `#ms-pf-live` (`#ms-lv-css`, `#ms-lv-js`, owner only, read only): balance, today, room before the daily stop, open positions, the live trades of `live/nq.json` + `live/vb.json`. Test: `tests/live-account-card.test.mjs`.

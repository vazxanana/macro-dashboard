# macro-dashboard — working notes

Single-file gold trading platform: everything lives in `gold-trading.html`
(HTML + CSS + JS inline). Deployed to GitHub Pages via
`.github/workflows/deploy.yml` on every push to `main`.

## Locked features — do NOT remove or replace in redesigns

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

15 weighted drivers feed `computeDailyBias()` (real yields, macro composite,
daily structure, S/D block location, VIX, real-yield momentum, breakeven,
2Y, DXY momentum, COT, yield curve, HY spreads, Dollar Smile regime,
Eurozone growth pulse, Yen carry-unwind risk). The last three are mined
from an institutional macro handbook the owner supplied (Dollar Smile
theory, global dollar liquidity, Germany/Eurozone, Japan) — see
`dollarSmileRegime()`, and the `fundX.euGrowth` / `fundX.jpyMom` / `fundX.sofr`
fetches in `refreshFundamentalsX()`. The Yen carry-unwind row is
deliberately always `dir: null` (a volatility warning, not a directional
call) — don't "fix" it to always vote a direction.

## Conventions

- Any change to `gold-trading.html` should keep the file self-contained
  (no build step, no external JS beyond the Lightweight Charts CDN and
  keyless public data APIs).
- Test headlessly with Playwright before deploying; verify the Pages
  deploy run goes green after merging.

## Public / admin split (6 Nov 2026, owner request)

`market-structure.html` has two modes: **public** (default) shows only trades (market, side, entry, stop, target, result)
and the chart markups; **admin** (footer "Admin login", SHA-256 of the password compared with `MS_ADMIN_HASH` in the head
script, token kept in localStorage `ms-admin`) shows everything (Setup, Scanner, system cards, shadow trades, scorecards,
reviews, notes). Anything that describes a rule, a system name, a note or a reason must sit inside an element with class
`adm`, or be guarded by `PUB` in the JS templates; `pubonly` is the public-only counterpart. Keep it that way in redesigns.
To change the password: compute `sha256` of the new one (e.g. `printf %s 'new' | sha256sum`) and replace both copies of the hash.

### Accounts and sign-in (6 Nov 2026)

The page opens on a centred sign-in card (`#ms-gate`, shown while `html[data-gate]`) unless the visitor is signed in or
chose **Continue as guest** (localStorage `ms-guest`, public view). Sign-in is password only (6 Nov): the password picks the account (owner = `MS_ADMIN_HASH`, others matched against
`MS_USERS` hashes), so every password must be unique.
Reviewers live in `window.MS_USERS` (head script: `{ <username>: { name, hash: sha256(password), role: 'reviewer' } }`;
currently **Fred**); a reviewer session stores `ms-admin` = their hash and `ms-user` = the user name, gets the admin view
read-only (`html[data-role="reviewer"] .own` hides the owner's journal, log-trade button, CSV loader and Telegram
settings) and can write loss reviews, which carry `by: <name>`. The footer is hidden; log in / log out live in the account menu (`#ms-me`), which clicks the hidden `#ms-admin-link`. To add a reviewer, add an entry with the SHA-256 of their password.
Viewers (`role: 'viewer'`, currently **Orlando**, **Luxus** and **Carlos**; `VIEWER` in the main script) are read-only with a reduced site: Home
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
branded "Aurum Desk" with a gold chart background (no system names on it).

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

## Users page (6 Nov 2026)

Owner-only view `#users` (sidebar "Users"): lists the built-in accounts (`MS_USERS` in the head script) and the ones
added or changed on the page, which live in `council-data/users.json` (`{ users: { key: { name, hash, role, disabled? } } }`,
written with the owner's GitHub token, `msGhTok`). users.json overrides built-ins (`msMergeUsers`); `disabled: true`
removes one. Sign-in fetches the list; a signed-in non-owner is re-checked after load and signed out if removed or if the
password changed (`ms-user-rec` keeps an added user's record between visits). Passwords must stay unique per account.

## Gold playbook check (6 Nov 2026, owner's skills)

Admin card `#ms-pb` on the Setup view (`renderPlaybook()`, called from `renderHome()`), from the owner's skill collection
(gold-msnr-playbook §2-5, Mosha S.CODE, Zlankator, MMXM): context tiles (council Weekly structure `goldW1` vs the setup,
Daily regime = 20-day efficiency ratio on closed D1 candles, countdown to the 17:00 New York Daily close, NY midnight
open and price above/below it, session / kill zone), the playbook's pre-trade checklist (auto items + manual ticks kept
per day in localStorage `msPb-<inst>-<NY date>`), a verdict, and the management rules. Guidance only: the Daily-ER filter
failed the council's own 2023-26 test (council-data research/log.md, 6 Nov), so it is not a council rule.

## ICT desk (6 Nov 2026, owner: a separate edge)

ICT is its own edge and approach: never mix it into the council systems, their rules, filters or reports.
Rules and research live in `.claude/skills/ICT/SKILL.md` (results also in council-data `research/ict/`).
- Tracker: `ict/tracker.mjs`, workflow `.github/workflows/ict.yml` (every 15 min), data in council-data `ict/`
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
- Audit (7 Nov): CNBC intraday requests start on the hour (bars are anchored at the request's start minute); bars in the
  17:00-18:00 ET halt are dropped; an H1 candle / 5m bar counts only once the feed has a later bar (or it is 20+ min old);
  the time exit is at the close of the 36th H1 candle; replay trades whose window has a > 4-day data hole are dropped
  (`replay.json` `gaps`); Both does not count a live signal twice. Tests: `node ict/audit-test.mjs <copy of council-data ict/>`.
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

## Coach evolution (7 Nov 2026, owner: members evolve without overfitting)
`council/coach.mjs`, wired into the statistical Coach in `council/trader.mjs`. Filter changes (D1 / structure / session) need
`solid()` plus a shrunk expectancy ≥ 0.10R (empirical-Bayes prior around 0R), and each runs as a champion/challenger trial
(`config.coachTrials`): the old rule is followed as a shadow on the same signals and comes back by itself unless the new one wins
by ≥ +0.05R shrunk per disagreeing signal over 20 of them (60-day limit). Every Coach change lands in `coach.json` `ledger` with
its evidence and a 30-day result, shown in analysis/latest.md (`<!-- coach-ledger -->` block). Owner rules (`userOwned`) and
live setups (`focusSetups`) stay out of the Coach's reach. Tests: `tests/coach-*.test.mjs`.

## Main systems first (7 Nov 2026, owner: "our main edge looks horrible")
The council calendar (`renderCalendar`) defaults to the main systems (`SYS_K` live trades + their replays + NQ paper); the
admin switch `.cal-src` ("Main systems" / "+ Shadow", localStorage `msCalSrc`) adds the shadow book and its back-filled
replay (research/shadow-replay.json, about −1,200R Jun–Oct, setups the live rules block). The Home Today strip
(`renderToday`) headlines `sysClosed()` and floating live R; shadow and retired-engine trades sit on the second line.

## Gold trend fast (7 Nov 2026, owner goal: more profit from the skills)
Second gold-trend leg `gtrend5` (user rule `gold-trend-fast`, `config.goldTrendFast = { n: 5, k: 2 }`): the gold trend rule on
the prior 5 daily highs, its own position and add next to the 20-day leg (`gtrend`); the trader runs both from one loop
(`LEG`). Sizing guide 0.25% (bridges: the shared gold risk). Replay 2023-Oct 2026 in research/replay-2w.json (39 trades).
Adopted on return per drawdown of the gold book (+39.3% → +45.5% | +68.6% → +79.9%, worst drawdown −2.34 → −2.61% |
−6.21 → −6.47%), positive every year 2019-26 alone.


## Gold playbook view (7 Nov 2026, owner: "make dashboard only for this skill")
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
floating R, month/year totals, "Every signal" / "Ones I took" switch `msGpCalSrc`). Tweaks tested on spot gold 2018-26 (exits,
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

## Vercel (7 Nov 2026, owner: move to Vercel Pro) — stage 1
`vercel.json` (no build, static from the repo root, `/macro-dashboard/*` rewritten to the root so index.html's asset paths work,
`/gold`, no-cache on HTML) and `api/kick.js`: Vercel crons (Pro: per-minute) start the GitHub workflows through the API —
`job=ict` dispatches ict.yml at :04/:19/:34/:49, `job=council` starts council.yml every 10 min only when no loop runs. Env on
Vercel: `GH_DISPATCH_TOKEN` (fine-grained, this repo, Actions read/write) and `CRON_SECRET`; never commit either. GitHub Pages
keeps deploying in parallel until the Vercel site is proven.
Status 7 Nov: Vercel project `macro-dashboard` (prj_4krxNideb9D2LfdcXkAWtAwzPLST) in team `xau` (team_40SuZQP47lNHxjlzDc8PeRH5),
production https://meridianx.dev. Protection: previews only (production public). The build copies only the pages,
assets and icons to out/; council/ and ict/ ship inside the api/run.js bundle and are never served. Owner wants the repo PRIVATE:
- api/data.js serves council-data files at /cdata/* with GH_TOKEN/GH_READ_TOKEN (falls back to the public raw file while none is set);
  the site uses /cdata on Vercel (window.MS_CDATA) and raw.githubusercontent elsewhere; MT5/cTrader bridges default to /cdata/mt5/signals.csv.
- api/run.js runs one council round (cron every 4 min, ~75 s) or ICT round (:04/:19/:34/:49, ~35 s): downloads only the files the job
  reads, runs the unchanged script in /tmp, commits the changed files to council-data via the Git Data API. RUN_MODE=live commits and
  sends alerts; otherwise dry run (no commit, alerts off). Cut-over: set GH_TOKEN (Contents read/write) and the trader's NTFY/Telegram/FUT
  env on Vercel, set RUN_MODE=live and remove the GitHub council/ICT schedules and loop in the same step, then make the repo private.
Not yet linked to GitHub (the owner's Vercel login needs a GitHub connection); until then deploys are file uploads through the Vercel API. Later stages: server-side login + private repo (the council and ICT
loops then have to run off GitHub Actions or on paid minutes), then broker-order functions.

### Vercel Pro features in use (7 Nov 2026)
- **Firewall** (project WAF): custom rules "Block scanner probes" (PHP/WordPress/dot-file paths, deny), "Only reads outside the API" (POST/PUT/PATCH/DELETE outside /api → deny), "Rate limit data" (/cdata 600/min per IP), "Rate limit API" (/api 30/min per IP); OWASP php/lfi/rfi/java/scanner-detection on deny, sqli/xss/rce/generic on log; managed AI-bot blocking. No persistent (timed) blocks: a shared mobile IP must never lose the site for an hour. Bot protection is NOT on: MT5/cTrader read /cdata/mt5/signals.csv without a browser.
- **Edge Config** store `meridian-flags` (ecfg_cma62alpxbxii4mkvlvxnixfi257), env `EDGE_CONFIG`, read by `api/_flags.js`: `runMode` (overrides RUN_MODE, no redeploy), `paused` (["council"], ["ict"], ["all"]), `notice` + `noticeLevel` (bar across the dashboard top). Edit it in Vercel → Storage → Edge Config.
- **Market data: OANDA** (`api/bars.js`, served at `/md/bars?sym=&tf=&n=` or `&from=&to=`): spot XAU/USD and forex mid candles, UTC daily alignment, edge-cached 2–60 s (past windows a day). Env `OANDA_TOKEN` (+ `OANDA_ENV=live` for a live account; default practice). Without the token it answers 503 and the page falls back to Binance/Kraken/Bitstamp with the PAXG→spot offset; with OANDA the offset is 0. Firewall "Rate limit market data": /md 900/min per IP. Crypto stays on Binance/Kraken. The bots (council/ict) still use their own feeds.
- **Live ticks**: `api/stream.js` at `/md/stream?sym=` streams OANDA prices as Server-Sent Events (≤5/s, closes after 270 s, EventSource reconnects); the page opens it only while the market is open and moves the forming candle on every timeframe. Instrument map in `api/_oanda.js`.
- **Link previews**: `api/og.mjs` (@vercel/og 0.11.1; 1.0.x fails to load in plain Node) draws a 1200×630 PNG with gold spot, 24 h change and a 2-day line from /md/bars; og:image / twitter:image point at it (edge-cached 10 min).
- **OANDA-only markets**: XAG/USD, NAS100, US500, USD/JPY (pip 0.01) have no exchange fallback.
- **Price alerts (Web Push)**: dialog `#ms-pa` (chart bell, Settings → Price alerts, Ctrl K). Device list in localStorage `ms-pa` + Blob `push/<device>/…` via `api/push.js` (with the push subscription). `api/alert-cron.js` runs every minute: OANDA S5 candles since each alert was set, web-push (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env), removes fired alerts and dead subscriptions. `sw.js` shows the notification (it no longer caches data/API calls). `app.webmanifest` makes the dashboard installable (needed for iPhone push).
- **Users: Vercel Blob** (private store `meridian-users`, store_9ViGtEotT2PeSlXc, env `BLOB_READ_WRITE_TOKEN`): `api/users.js` GET returns the list (falls back to council-data users.json if the store is empty); POST saves the whole list when `ownerPw` hashes to the owner hash. Each save is a new `users/<time>-<rand>.json`, older ones deleted. The page asks the owner password once per tab (sessionStorage). GitHub Pages / local copies still use the GitHub token path. `package.json` holds only `@vercel/blob`.
- **`/api/status`**: notice + age of each bot's last round; the dashboard shows "Council bot behind" / "ICT tracker behind" to signed-in users (council > 20 min; ICT > 45 min outside the weekend).
- **Web Analytics** (custom events: View {view}, Sign in {result}, Guest, Trade review) and **Speed Insights**, loaded from /_vercel/* only on the Vercel site. Fluid compute, skew protection (12 h) and preview-only deployment protection are on.

## Macro strategist (7 Nov 2026, owner: a council member for macro, paper only)
`council/macro.mjs`, run by council.yml every 6th round (~25 min, `timeout 180`, a failure never stops the loop). Mixes the
15-driver stack of `gold-trading.html` (`computeDailyBias`, `dollarSmileRegime`, `refreshFundamentalsX`, ported, not imported)
with the handbook knowledge encoded there, a VIX/VIX3M term-structure input, and net liquidity / the FOMC calendar as context.
Free keyless sources only, each with a timeout and a fallback: FRED fredgraph.csv (Cboe CSV for VIX/VIX3M), ECB data API (EA 2Y),
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
trade. Admin card `#ms-c-macro` in the Council research pane reads `/cdata/macro/forecast.json`. Tests: `tests/macro.test.mjs`.

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

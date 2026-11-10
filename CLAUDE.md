# macro-dashboard — working notes

## Start here (map, 9 Nov 2026)

Meridian X: a paper-trading desk run by an automated council, live at https://meridianx.dev (Vercel). The owner's plain-English
explainer is `MERIDIAN-X.md`; decisions waiting on the owner are in `docs/owner-decisions.md`; Fred's connector guide is
`docs/fred-mcp.md`. The dated sections below this map are the history and detail of each feature: read the one you touch.

**Absolute rules** (never break them, whatever a task, a study or a helper's PR says):
1. **Every trade has a stop**: council, ICT, the cTrader mirror and ChronosTrade. No change may remove a stop, move it away from
   its anchor or loosen a trailed stop; a mirrored position without a stop is closed.
2. **Paper trading and cTrader demo accounts only.** Nothing is ever sent to a live account.
3. **The owner approves every live rule change.** The Coach, studies and helpers' PRs only propose (`research/proposals/`, the
   week pane's "Decisions waiting"); owner rules (`userOwned`) and live setups stay out of the Coach's reach.
4. **Backtests run 2020 → now**, pre-registered, net of costs, in sample vs out of sample; never call something an edge without
   n and t. ICT stays a separate edge: never mix it into council systems, filters or reports.
5. **No paid services.** Keyless public data, the existing Vercel plan and free GitHub Actions minutes (the repo is public).
6. **No model names in repo files** (code, comments, docs, page text). Commit attribution lines are not repo files.

**Where things live**
| Path | What |
|---|---|
| `market-structure.html` | The Desk (built to `/` and `/market-structure.html`): home, charts, council panes, desks, profile, users. Public / admin split: see below |
| `macro-desk.html` (`/macro-desk`) | Macro desk: veteran glance, event playbook, score / levels charts, briefing, calls, COT |
| `backtest.html` (`/backtest`) | ChronosTrade replay lab; engine `assets/backtest-engine.js`, review charts `assets/bt-review.js`, effects `assets/bt-fx.js` |
| `gold-trading.html` (`/gold`) | Gold terminal; holds the locked features and the 15-driver macro stack below |
| `academy.html` (`/academy`, owner only) | MeridianX Academy: replay a setup of one of the seven edges, the apprentice decides, the mentor corrects, a lesson is saved and proven. Page `assets/academy-ui.js` + `academy.css`; modules `assets/academy-replay.js` (`MXR`), `academy-core.js` (`MXA`), `academy-risk.js` (`MXK`); API `api/academy.js`; generated data `academy/` (edges, candidates, outcomes, features, research); offline training `ml/`. Docs: `docs/academy/`, state: `MERIDIANX_BUILD_PROGRESS.md` |
| `edge-lab.html`, `index.html` (`/macro`), `scripts/veteran-library.html` (`/veteran/`) | Side pages; shared look `assets/mx-page.css` + `assets/mx-nav.js` |
| `app.webmanifest`, `sw.js`, `offline.html`, `icons/`, `assets/pwa.js` | Installable app (head tags added at build by `scripts/pwa.mjs`, never by hand) |
| `api/` | Vercel functions (`_*.js` are shared modules): sign-in (`login`, `logout`, `me`, `_session`, `_accounts`, `_guard`), `/cdata` (`data.js`), `/md/bars` + `/md/stream` (OANDA), `mcp.js` + `_ictlab.js` (Fred's connector), `ctrader-link`, `users`, `profile`, `notify`, `sounds`, `push` + `alert-cron`, `run.js` (cron runner), `status`, `bridge`, `tv-webhook`, `pine`, `og.mjs` |
| `council/` | Council members: `trader`, `analyst`, `coach`, `macro`, `macroscore`, `veteran` (+ `briefing`, `glance`, `calibration`, `playbook`, `outlook`), `cot`, `ctrader-*` (demo mirror), `datacheck` / `datahealth` / `health`, `digest`, `research-ledger`, `datasync` / `jsonio`, `live` (VPS runner) |
| `ict/` | ICT desk tracker, replay, CME calendar; its rule book is `.claude/skills/ICT/SKILL.md` |
| `research/edge/<topic>/` | Pre-registered studies (preregistration, `RESULT.md`, `result.json`), published to the Edge lab; `research/proposals/` = owner proposals; `research/macro-veteran/` = the veteran batch |
| `tests/` | `node:test`, offline; pinned council-data copies in `tests/fixtures/` |
| `scripts/` | `build.sh`, `audit/` (`smoke.cjs`, `chronostrade.cjs`), `live/` (VPS runner install), `daily-cache.mjs`, `make-icons.mjs` |
| `out/` | The built site, **committed** (CI fails when it is stale) |
| `council-data` branch | Everything the bots write (trades.json, snapshot.json, `ict/`, `macro/`, `ctrader/`, health.json, digest.json, `research/…`); the site reads it through `/cdata`. Never commit bot output to `main` |
| `.github/workflows/` | `council.yml` (the loop), `watchdog.yml`, `tests.yml` + `ci.yml` (CI), `deploy.yml` (GitHub Pages copy), research / cache workflows (mostly manual) |

**Build, test, CI**
```sh
sh scripts/build.sh                    # builds out/; commit out/ with every page, asset or study change
for f in council/*.mjs ict/*.mjs api/*.js api/*.mjs research/edge/*.mjs; do node --check "$f" || break; done
node --test tests/*.test.mjs tests/*.test.js
node ict/audit-test.mjs && node council/alerts-test.mjs && node council/proposals-test.mjs
# page checks (Playwright): serve out/ on $PORT (default 8766), e.g. python3 -m http.server 8766 --directory out, then
node --use-env-proxy scripts/audit/smoke.cjs && node --use-env-proxy scripts/audit/chronostrade.cjs
```
CI on every PR and push to `main`: `tests.yml` (syntax, unit tests, pinned audits) and `ci.yml` (build matches `out/`, page smoke
test, ChronosTrade audit). Keep new tests offline. Vercel deploys from `main` only when a served file changes
(`scripts/vercel-ignore.sh`); GitHub Pages still gets a copy from `deploy.yml` (no API there, so no sign-in).

**How it runs**: `council.yml` is the loop (GitHub Actions, restarts itself every ~5 h). One round takes **about 11-12 minutes**
(the members' work, then a 4-minute wait in which the Trader and the mirror run again every minute), so "every 2nd round" is
~23 min, "every 3rd" ~35 min (ICT desk, research ledger) and "every 6th" ~70 min (Macro strategist, veteran, COT). Older notes
below that say "5-minute round" or "~25 min" predate the quick pass. The Vercel crons in `vercel.json` (`/api/run?job=council`
every 4 min, `job=ict` at :04/:19/:34/:49, `/api/alert-cron` every minute) are the backup runner: the council job stands down
while Actions saved in the last 10 min, and both only commit when `RUN_MODE` / Edge Config `runMode` says live. With the
owner's VPS runner (`council/live.mjs`) alive, it owns the Trader and mirror. `watchdog.yml` pages when the loop stops.

**Sections below, by topic** (each is dated; later sections win where two disagree):
- Accounts and security: Public / admin split, Accounts and sign-in, Users page, Accounts, desks…, Per-member permissions,
  Server-side sign-in, API hardening, Profile photo and name on the server.
- The Desk page: Council layout, Home and navigation, Guests (three sections), Sign-in and guest polish, Profile page, Charts:
  markup switch, Desk smoothness, Exchange price ticks, Styled dialogs, Desk notifications, Installable app, This week report,
  Edge scoreboard, Loss review.
- Council systems and trading: Coach evolution, Main systems first, NQ open run regime tags, LIT paper shadow / LIT replay / LIT
  and NQ SDV desks, Gold trend fast, Gold playbook check / view, Trader paper fills, Book weights, What to expect, Futures tickets.
- cTrader demo: cTrader demo mirror, Mirror stop safety, cTrader demo accounts on the profile, cTrader symbol specs.
- ICT: ICT desk, ICT MCP server (with `docs/fred-mcp.md`).
- Macro: Macro driver stack (gold terminal), Macro strategist, Macro veteran (+ revision 1.3), Veteran's calls (+ track record),
  The veteran's briefing, The veteran at a glance, Macro desk charts, The veteran's event playbook, COT positioning desk.
- ChronosTrade: Backtest lab (passes 1-11, review, instant orders, chart design, analytics, onboarding), trade effects, sounds chosen by the owner.
- Running and reliability: Vercel (stage 1 + Pro features), Council live runner, Council quick pass, Reliability: tests and data
  health, Loop watchdog, Council data files health, council-data sync and safe writes, Daily owner digest, Research ledger.
- Side pages: Side pages: /macro, /veteran/, Edge lab, gold terminal.

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
`MAX_AGE`) drops it as "no data", but `gold-trading.html` still shows the 2024 value (open: docs/owner-decisions.md, item 16).

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
Viewers (`role: 'viewer'`, currently **Luxus** and **Carlos**; Orlando became a reviewer on 8 Nov, see "Accounts, desks";
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

Owner-only view `#users` (sidebar "Users"): lists the built-in accounts (server side, `api/_accounts.js`; their public records
come from `/api/users`) and the ones added or changed on the page, which live in the private Blob list (see Vercel below; since
9 Nov saved with the owner's session, hashes never in the browser). The stored list overrides built-ins (`msMergeUsers`);
`disabled: true` removes one. A signed-in account is re-checked by `/api/me` after load and signed out if removed or if the
password changed. Passwords must stay unique per account (the server refuses a duplicate).

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
`vercel.json` (build `sh scripts/build.sh` into `out/`, `/macro-dashboard/*` rewritten to the root so index.html's asset paths
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
  happened; a private repo would end the free Actions minutes the loop relies on (see docs/owner-decisions.md).
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
not the fill) is a proposal for the owner. Crypto venue, owner's decision 7 Nov: the council trades through cTrader (CFD), so crypto
paper trades pay the costs study's CFD round trip (0.04% of price, `CFD_CRYPTO` in `council/fills.mjs`) instead of Kraken spot fees.
Gold fidelity (8 Nov, research/edge/gold-fidelity): `manageLive` / `addUnit` / `expireOrder` / `sizeR` in fills.mjs are the Trader's
"Manage open trades" step for one candle as pure functions (trail, beAt, maxHold, pyramid add included), used by that replay;
`tests/fills-live.test.mjs` lifts the Trader's loop text out of trader.mjs and checks parity, so a change to the live loop must be
mirrored there. A pyramid add inherits its parent's `shadow` flag (a blocked Mosha chain's add is not a live trade).

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

## Book weights, paper comparison (8 Nov 2026; portfolio-v2 proposal, owner undecided)
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

## LIT and NQ SDV desks (8 Nov 2026)
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

## Guests on the charts, wide-screen density (8 Nov 2026)
Guests (`PUB`) may open `#charts` on any market (watchlist chips `?s=<market>#charts`, header picker live only on the charts view;
`html[data-view]` set by showView). Their markup is Clean only: `setMode` forces clean, Meridian / ICT buttons show a lock and open
the gate; `planLinesDraw` and `klList` return nothing for guests; `#ms-mtf`, readouts, chips and `.ms-role` are hidden. The guest
overview carries an "Open the charts" button; the charts a "← Gold overview" link and a members note. `#ms-dense-css`: from 1400 px
the app is 1760 px wide (2000 px from 1800 px), tighter gaps and paddings, the home markets grid auto-fills 168 px cards.

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
- `/cdata` guest allowlist `GUEST_OK` (api/data.js, public edge cache + CORS): trades.json, snapshot.json, ict/replay.json,
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

## Installable app (9 Nov 2026, owner: "installable on phones and desktops")
`app.webmanifest` (id `/`, "Meridian X", standalone, `#08090c` = the desk's dark `--bg`, shortcuts /gold, /macro-desk, /backtest)
with icons in `icons/` drawn from the coin favicon by `scripts/make-icons.mjs` (any 192/512, maskable 192/512, apple-touch-icon 180,
badge-96 for push; run it by hand with Playwright, commit the PNGs). The old GOLD `manifest.json` and root icon-192/512 stay for old installs.
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
  after 10+ minutes hidden with no dialog open. Push / notificationclick handlers unchanged (icons now /icons/).
- Kill switch: Vercel env `MX_SW_KILL=1` + redeploy -> the worker stops handling fetches and deletes its caches but stays
  registered (price-alert pushes keep working). One device: open any page with `?sw-reset` (unregisters + clears caches; that
  device's price alerts need turning on again).
- Install: iPhone Safari -> Share -> Add to Home Screen (needed for iPhone push); Android Chrome -> menu -> Install app; desktop
  Chrome / Edge -> install icon in the address bar.

## The veteran's event playbook (9 Nov 2026, owner: "be the best of all times veteran", "keep improving all the bits")
`council/playbook.mjs` (pure, no fetch; built by `veteran.mjs` → `veteran.json.events`, `eventsRecord`): one card per red-folder
release on the strategist's calendar within `WINDOW_H` 72 h (kept `KEEP_H` 12 h after the print), same time + country grouped
(Core first). Expectations: the consensus `captureExpectations` froze before the release, the forecast cluster only where the
repo has one (the batch's CPI pilot 0.255% and its captured Cleveland core nowcast 0.21%, `cpiPilot().comparator`), range n/a.
Hot / in-line / cool rows (the strategist's `rule`, Fed path, dollar, gold, the action: act after the release, not before; a ¼
starter after the first hour on a retest, the skill's rule G; funded accounts flat). History: `council/event-base.json`, built by
`node research/edge/event-reaction/build.mjs <council-data>` from HistData M1 gold + dollar index (85 CPI 2018-26, 51 NFP and 34
FOMC 2022-26; CPI 2018-21 dates spike-checked, 16 dropped), split by the dollar's first 5-minute read (±`READ_PCT` 0.05%, not a
consensus surprise) and, CPI 2022-24, by the core print vs the Cleveland nowcast; the release-day move from the daily closes at
run time; rows and days cut at `now`. The one pre-registered test (CPI T+5→T+60 follows the dollar's read) FAILED (34/72, p 0.72),
so every figure is labelled "Descriptive, not a tested edge". HistData clock: the files are UTC−5, and UTC−4 while Europe is on
summer time (release spikes; preregistration Amendment 1), not "EST without DST" all year. The call: P(gold's release-day UTC close
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

## Post-merge QA sweep (9 Nov 2026, PRs #682-#705)
Every page at 390 / 1440 px in dark / light / midnight as owner, reviewer, viewer and signed out (stubbed /api/me, real council-data
at /cdata). Fixed: the side pages' header ring spun forever (`assets/mx-page.css`, now one sweep on hover / focus like the desk);
offline.html was 9 px too wide on phones; the Edge lab donut label fell to 10.8 px on phones; the macro desk jumped (layout shift
~0.45) while its story loaded (`main[data-loading]` until the first load); macro desk light green / red / link text and ChronosTrade's
quick Buy / Sell labels under AA; the gold terminal had no way back to the desk (the installed app's "Gold" shortcut). Checks:
`tests/qa-sweep.test.mjs` (also pins the owner's grey / black light-mode candles) and `scripts/audit/smoke.cjs` (offline.html, and no
visible endless animation of a custom property or box-shadow on any page).

## MeridianX Academy (10 Nov 2026, owner's build directive; development branch, not on `main` until the owner approves)
Owner-only page `/academy` (`academy.html`): a discretionary-trading school on top of the seven live Meridian systems (the seven edges
of `council/decay.mjs`; ICT stays separate). Edges produce candidates, the deterministic decision engine decides, the risk engine allows.
Read `docs/academy/ARCHITECTURE.md` (contract), `docs/academy/MODULES.md` (as built), `TRAINING.md`, `RESEARCH.md`; the running state is
`MERIDIANX_BUILD_PROGRESS.md`. Rules that must hold in any change:
- **No look-ahead.** A decision only ever sees `MXR.snapshot` (bars closed at or before t; the guard throws otherwise). Outcomes live in
  `academy/data/out-<edge>.json` and leave the API only after an attempt for that setup is stored. History rows carry no ids.
- **Exam pool** (whole months, `poolOf` in `academy/edges.mjs`) is for tests on new setups only: never trained on, never read by the
  research or training code, an exam setup is decided once. Same-trade replays prove recall only; the page says so.
- **Flagged setups** (`rule.clockShift`: the research candles are an hour early in those weeks; `rule.pre2020`) stay out of lists and tests.
- **Lessons are explicit and versioned** (conditions on features → an effect; relative level rules, never raw prices). Research only
  proposes inactive drafts; the mentor saves them. No scorer is used unless the owner registers and promotes it; none is promoted.
- **Paper only, isolated**: nothing under `academy/`, `ml/`, `assets/academy-*` or `api/academy*.js` imports the council, the mirror or
  any order code (tests pin this). The language-model adapter is off without `ACADEMY_LLM_KEY` and has daily / monthly / hard budgets.
- Regenerate data (candles outside the repo): `ACADEMY_CANDLES=<dir> node academy/gen/run.mjs`, then `features.mjs`, `evaluate.mjs`,
  `research.mjs`, `calendar.mjs`. Local run: `sh scripts/build.sh && node scripts/academy-dev.mjs` (recorded candles; `--live` for the
  candle proxy). Audit: `node scripts/audit/academy.cjs` (in `ci.yml`). Tests: `tests/academy-*.test.mjs`.

# macro-dashboard — working notes

## Start here (map, 9 Nov 2026; checked against the code 11 Nov)

Meridian X: a paper-trading desk run by an automated council, live at https://meridianx.dev (Vercel). The owner's plain-English
explainer is `MERIDIAN-X.md`; decisions waiting on the owner are in `docs/owner-decisions.md`; Fred's connector guide is
`docs/fred-mcp.md`. The dated sections below this map are the history and detail of each feature: read the one you touch.

**Absolute rules** (never break them, whatever a task, a study or a helper's PR says):
1. **Every trade has a stop**: council, ICT, the cTrader mirror and ChronosTrade. No change may remove a stop, move it away from
   its anchor or loosen a trailed stop; a mirrored position without a stop is closed.
2. **Paper trading and cTrader demo accounts only.** Nothing is ever sent to a live account.
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
| `market-structure.html` | The Desk (built to `/` and `/market-structure.html`): home, charts, council panes, desks (ICT, Gold, Mosha, Crypto, LIT, NQ SDV), profile, users. Public / admin split: see below. The Mosha desk's scripts are `assets/mosha-*.js` |
| `macro-desk.html` (`/macro-desk`) | Macro desk: veteran glance, event playbook, score / levels charts, briefing, calls, COT |
| `backtest.html` (`/backtest`) | ChronosTrade replay lab; engine `assets/backtest-engine.js`, review charts `assets/bt-review.js`, effects `assets/bt-fx.js` |
| `gold-trading.html` (`/gold`) | Gold terminal; holds the locked features and the 15-driver macro stack below |
| `academy.html` (`/academy`, owner only) | MeridianX Academy: replay a setup of one of the seven edges, the apprentice decides, the mentor corrects, a lesson is saved and proven. Page `assets/academy-ui.js` + `academy.css`; modules `assets/academy-replay.js` (`MXR`), `academy-core.js` (`MXA`), `academy-risk.js` (`MXK`); API `api/academy.js`; generated data `academy/` (edges, candidates, outcomes, features, research); offline training `ml/`. Docs: `docs/academy/`, state: `MERIDIANX_BUILD_PROGRESS.md` |
| `edge-lab.html`, `index.html` (`/macro`), `scripts/veteran-library.html` (`/veteran/`) | Side pages; shared look `assets/mx-page.css` + `assets/mx-nav.js` |
| `app.webmanifest`, `sw.js`, `offline.html`, `icons/`, `assets/pwa.js` | Installable app (head tags added at build by `scripts/pwa.mjs`, never by hand) |
| `api/` | Vercel functions (`_*.js` are shared modules): sign-in (`login`, `logout`, `me`, `_session`, `_accounts`, `_guard`), `/cdata` (`data.js`), `/md/bars` + `/md/stream` (OANDA), `mcp.js` + `_ictlab.js` (Fred's connector), `academy.js` + `academy-mcp.js` (the Academy and its assistant connector), `ctrader-link`, `users`, `profile`, `notify`, `sounds`, `mosha` (the Mosha desk's trade log), `mosha-lessons` (the lessons its teacher sends), `edge-analyst` (AI second opinion on each live entry), `push` + `alert-cron`, `run.js` (cron runner), `status`, `bridge`, `tv-webhook`, `pine`, `og.mjs` |
| `council/` | Council members: `trader`, `analyst`, `coach`, `macro`, `macroscore`, `veteran` (+ `briefing`, `glance`, `calibration`, `playbook`, `outlook`), `cot`, `ctrader-*` (demo mirror), `datacheck` / `datahealth` / `health`, `digest`, `research-ledger`, `datasync` / `jsonio`, `live` (VPS runner) |
| `ict/` | ICT desk tracker, replay, CME calendar; its rule book is `.claude/skills/ICT/SKILL.md` |
| `research/edge/<topic>/` | Pre-registered studies (preregistration, `RESULT.md`, `result.json`), published to the Edge lab; `research/proposals/` = owner proposals; `research/macro-veteran/` = the veteran batch |
| `tests/` | `node:test`, offline; pinned council-data copies in `tests/fixtures/` |
| `scripts/` | `build.sh`, `audit/` (`smoke.cjs`, `chronostrade.cjs`), `live/` (VPS runner install), `daily-cache.mjs`, `make-icons.mjs` |
| `out/` | The built site, **committed** (CI fails when it is stale) |
| `council-data` branch | Everything the bots write (trades.json, snapshot.json, `ict/`, `macro/`, `ctrader/`, health.json, digest.json, `research/…`); the site reads it through `/cdata`. Never commit bot output to `main` |
| `.github/workflows/` | `council.yml` (the loop), `watchdog.yml`, `tests.yml` + `ci.yml` (CI), `deploy.yml` (GitHub Pages copy), `ict-apply.yml` + `ict-apply-merge.yml` (applied ICT changes: on for Fred since 10 Nov), research / cache workflows (mostly manual) |

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
- Accounts and security: Public / admin split, Accounts and sign-in, Users page, Accounts, desks…, Per-member permissions (the `mosha` key is in "Mosha desk"),
  Server-side sign-in, API hardening, Profile photo and name on the server.
- The Desk page: Simple phone view (the default on phones), Council layout, Home and navigation, Guests (three sections), Sign-in and guest polish, Profile page, Charts:
  markup switch, Desk smoothness, Exchange price ticks, Styled dialogs, Desk notifications, Installable app, This week report,
  Edge scoreboard, Loss review.
- Council systems and trading: Supported book / financing / replica mirror (11 Nov: which systems are live), Financing, the rest (baselines, replay rows), Path to live + Forward record of the live book (12 Nov), Coach evolution, Main systems first, NQ open run regime tags, LIT paper shadow / LIT replay / LIT
  and NQ SDV desks, Mosha desk, Gold trend fast, Gold playbook check / view, Trader paper fills, Near-stop market fills, Book weights, What to expect, Futures tickets.
- cTrader demo: cTrader demo mirror, Mirror stop safety, cTrader demo accounts on the profile, cTrader symbol specs.
- ICT: ICT desk, ICT desk: every result traceable to its execution (+ frozen history), ICT MCP server (with `docs/fred-mcp.md`),
  Fred applies ICT changes (on for Fred since 10 Nov).
- Macro: Macro driver stack (gold terminal), Macro strategist, Macro veteran (+ revision 1.3), Veteran's calls (+ track record),
  The veteran's briefing, The veteran at a glance, Macro desk charts, The veteran's event playbook, COT positioning desk.
- ChronosTrade: Backtest lab (passes 1-11, review, instant orders, chart design, analytics, onboarding), trade effects, sounds chosen by the owner.
- Loading: Load performance: delivery layer (9 Nov), Desk load: one request per file, late loading (11 Nov).
- Running and reliability: Vercel (stage 1 + Pro features), Council live runner, Council quick pass, One feed per market (12 Nov), Reliability: tests and data
  health, Loop watchdog, Council data files health, council-data sync and safe writes, Daily owner digest, Research ledger,
  Browser audits (false failures traced to their causes).
- Side pages: Side pages: /macro, /veteran/, Edge lab, gold terminal.
- Academy: MeridianX Academy (owner only). Research notes: Research candle clock, Mosha level reversal study. QA: Post-merge QA sweeps (9, 11 and 12 Nov).
- Academy: MeridianX Academy (owner only). Research notes: Research candle clock, Mosha level reversal study, Gold carry (cost of holding a gold buy, 12 Nov). QA: Post-merge QA sweeps (9 and 11 Nov).

**Owner-facing docs** (11 Nov 2026: both re-checked against the code): `MERIDIAN-X.md` is the plain-English explainer;
`docs/owner-decisions.md` opens with "What needs you now" and every item carries a dated status line. Item numbers are stable
(1-53 today; add new ones at the end, never renumber), because this file, the studies and the tests cite them.

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
branded "Aurum Desk" with a gold chart background (no system names on it).

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
trailed) changes where the trail puts the stop, so it is a proposal: `research/proposals/2026-11-12-nq-open-r0.md`. Never
compute an NQ open-run R from the current stop. Test: `tests/nq-open-r0.test.mjs` (lifts the loop from the trader's text).

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
trade OPENED with, never `|entry - stop|` once a trail, break-even or ratchet has moved the stop. Every Trader loop but the NQ
open run's (item 50) reads a stamped `r0`: pushed with the record for every system whose stop moves (also outside the loop: the
gold trend and crypto ratchets, the LIT swing break-even), stamped on the first managed candle otherwise (`tr.r0 || (tr.r0 =
...)` before any move); a test lists every `.stop = ` in trader.mjs, so a new stop move must be audited. Readers use
`fills.mjs` `openRisk(x)` (`r0`; else `|entry - stop|` while unmoved; else `stop0`; else the NQ open run's 2R mark / 2; else
null = leave the figure out): the mirror's `fillQuality` (imported as `riskAtOpen`: the round has a local `openRisk` = cash),
the reconciliation report, the digest's floating R; copies in `api/_edge-analyst.js` (`stopAtEntry`; an unknown opening stop is
not studied) and the page (`risk0`: Active trades, the trade table's live R, the guest trade card, "R now"), compared by
`tests/moved-stop-audit.test.mjs`. On the replica `stop0` is the level BEFORE the round-number step, not the opening stop.
Open for the owner (item 51): a market copy of a trade whose stop is already past its entry gets its demo stop on the losing
side (ICT A-setups copied late; council trades without a fresh price), and the late-copy check reads 1R from the moved stop.

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

## Meridian markup: closed candles, failed breaks, line chart, more history (12 Nov 2026, owner)
Display only (`market-structure.html`); the council's own engine copy in `council/trader.mjs` is unchanged.
- **A BO needs a close** ("if it doesn't close it is not a BO"): panes, split chart and scanner analyse closed candles only
  (`msClosedN`); the forming candle never draws a BO, ChoCh, VR or moved extreme.
- **A low that failed to break the low becomes the new low**: in `msAnalyze` a wick through the protected swing with no close
  beyond it moves the protected level and the Origin edge to that wick (`sweepProt`); only a close beyond the new level is a BO.
- **Chart type** (Settings → Chart, `#ms-cs`, localStorage `ms-cs`): Candles, Line (closes) or Candles + line; the markup stays
  on the candle series (invisible candles in Line mode, `P.setStyle`, re-applied on a theme change).
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

## Meridian markup: the Mosha layer (12 Nov 2026, owner: "build the mosha layer")
Display only, Meridian markup only (layer "Mosha storyline (VR, CF, barriers)", `G.show.mosha`, orange); no rule, trade or
alert reads it and it is not a tested rule (the mechanical Mosha studies failed). `msMosha(htf, ltf, buf)` (pure, next to
`msCycle`; `moshaNow(id, bars)` feeds it): the last BO of the timeframe above (D1 for H4, H4 for H1, H1 for M15, M15 for M5)
read on this chart. VR = the first break of this chart AGAINST it after the BO, box from the extreme the BO made to the level
the VR broke (wicks); CF = the first break back WITH it after the VR, its origin is the CF zone. Case 1 CF clear of the VR box,
2 inside it, 3 through the VR's extreme ("read one TF lower"). Entry where price pulls back into the zone, stop past the zone
($0.30 on gold), target the VR's extreme (the HTF extreme in case 3 or once price is past it); status waiting / in the zone /
stopped / target reached (stop first when one candle holds both). Barriers = the breaks with the BO since it (last four).
Tests: `tests/market-cycle.test.mjs` ("Mosha").

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
  crossed one, and `broken` names the level that was the one to watch at the close. The sentence says "Gold has traded below
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
  3.6, the scanner's tags, the sidebar's gold "Aurum"), about 190 texts under AA in light; the macro pane's "agree" / "disagree"
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
  35 px on a phone's first visit. Tests: `tests/qa-sweep.test.mjs` ("QA 12 Nov", six tests), `scripts/audit/smoke.cjs`.

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
- Tests: `tests/mosha-desk.test.mjs` (permissions, the stop rule, R on the server, `pre`, the locks, statistics, the candle check,
  CSV, page wiring, the studies' figures). The page smoke test opens `#mosha`.

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

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
- **Users: Vercel Blob** (private store `meridian-users`, store_9ViGtEotT2PeSlXc, env `BLOB_READ_WRITE_TOKEN`): `api/users.js` GET returns the list (falls back to council-data users.json if the store is empty); POST saves the whole list when `ownerPw` hashes to the owner hash. Each save is a new `users/<time>-<rand>.json`, older ones deleted. The page asks the owner password once per tab (sessionStorage). GitHub Pages / local copies still use the GitHub token path. `package.json` holds only `@vercel/blob`.
- **`/api/status`**: notice + age of each bot's last round; the dashboard shows "Council bot behind" / "ICT tracker behind" to signed-in users (council > 20 min; ICT > 45 min outside the weekend).
- **Web Analytics** (custom events: View {view}, Sign in {result}, Guest, Trade review) and **Speed Insights**, loaded from /_vercel/* only on the Vercel site. Fluid compute, skew protection (12 h) and preview-only deployment protection are on.

## Macro strategist (7 Nov 2026, owner: a council member for macro, paper only)
`council/macro.mjs`, run by council.yml every 6th round (~25 min, `timeout 180`, a failure never stops the loop). Mixes the
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
- **Data health** `council/datacheck.mjs` (council loop, every 2nd round): 5m candles from the OANDA proxy, Kraken (crypto) and the ICT
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
loop it watches; it trades nothing and restarts nothing (council.yml's cron job does). Watchdog review of 6-8 Nov: 489 saves in 48 h
(one per 5.9 min), two outages (80 min: 330-min timeout; 262 min: a push cancelled the loop and GitHub fired the cron only twice that
day), zero data-branch push rejections in the logs read; the loop now aborts a stuck rebase and retries the hand-over dispatch.
Tests: `tests/health.test.mjs`.

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

## Macro veteran (8 Nov 2026; revision 1.2 the same evening)
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
Coach, Macro, veteran, data check, digest, ledger) keep the 5-minute round. Owner: "ok build it, start at 2 minutes". If the
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
is skipped. Minimum-lot orders risking over `LIMITS.maxMinLotRisk` (2%) wait for a bigger balance. Closed market, holidays and the
capacity caps are waits (symbol paused `LIMITS.pause`), broker rejections skips; notes live while the council trade is open or pending.
One demo account per book (8 Nov, owner): `bookOf` (ict / lit / replica / shadow / council), `accountsFor(env, cfg)` from council-data
config.json `mirrorAccounts` or env `CTRADER_ACCOUNTS` ("council:1,ict:2,shadow:3,lit:4"; wins), books without a number trade on
CTRADER_ACCOUNT_ID; the CLI runs one round per account (the token pair is shared and handed on), writes mirror.json for the base
account and mirror-<account>.json for the others, plus mirror-accounts.json (the map); alerts carry [book]. When the council moves an open trade's stop or target (break-even, trailing, a re-planned target) the demo position's protection follows
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

## Guests on the charts, wide-screen density (8 Nov 2026)
Guests (`PUB`) may open `#charts` on any market (watchlist chips `?s=<market>#charts`, header picker live only on the charts view;
`html[data-view]` set by showView). Their markup is Clean only: `setMode` forces clean, Meridian / ICT buttons show a lock and open
the gate; `planLinesDraw` and `klList` return nothing for guests; `#ms-mtf`, readouts, chips and `.ms-role` are hidden. The guest
overview carries an "Open the charts" button; the charts a "← Gold overview" link and a members note. `#ms-dense-css`: from 1400 px
the app is 1760 px wide (2000 px from 1800 px), tighter gaps and paddings, the home markets grid auto-fills 168 px cards.

## Profile page and guest view (8 Nov 2026)
`#profile` (v-profile, in VIEWS and the viewer allow-list) holds the identity card (copied from the account menu) and the council's
demo accounts rendered by the cTrader module in page mode (`MODE = 'page'` → `#ms-pf-b`; the dialog stays for the cTrader link
return). The account menu's first item is "Profile and demo accounts"; the old "My cTrader account" item is hidden. The saved user
record (`ms-user-rec`) carries `ct` so the right survives the reload that stores it. Light theme defines `--panel-hover`,
`--line-strong`, `--accent-soft`, `--buy-soft`, `--sell-soft` (hovers used to fall back to the dark values). Guest view: the trade in
words (`#g-setup`), named price lines, a chart that follows the page theme with coloured candles, the header pinned to XAU/USD, and an
invitation (`.g-join`) whose Sign in opens the gate.

## Accounts, desks, header switch, gate (8 Nov 2026)
Users (market-structure.html `MS_USERS`): Fred reviewer + ICT (reviews), Orlando reviewer (sees everything) + ICT read-only, Carlos
viewer; `ct: true` (all three) shows the council's demo accounts on "My cTrader account" with edge labels only, never account numbers
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

## ICT MCP server for outside helpers (8 Nov 2026, owner: "make an MCP for ChatGPT, my friend will use it")
`api/mcp.js`, served at `https://meridianx.dev/api/mcp/<key>` (vercel.json rewrite → `/api/mcp?key=`; must stay under /api: the firewall denies POST elsewhere). MCP Streamable HTTP,
stateless JSON-RPC over POST (ChatGPT connectors / Claude / Cursor). One key per person in Vercel env `MCP_KEYS`
(`"fred:<24+ random chars>,orlando:<…>"`); the name goes on their notes and PRs. Reads use `GH_READ_TOKEN` (fallback
`GH_TOKEN`), writes `GH_MCP_TOKEN` (fallback `GH_TOKEN`; needs Contents write for the branch and Pull requests write for the
PR, else the tool returns the compare link). Tools: `ict_rules` (skill sections + live `P`/`MARKETS`), `ict_trades` (live +
replay with stats and filters; Both never counts a live signal twice), `ict_trade`, `ict_status`, `ctrader_results` (labels
only: `scrub` drops every id / login / account key and 7+ digit numbers), `ict_file_list` / `ict_file_read` (allowlist
`okPath`: ict/*.mjs, .claude/skills/ICT/*.md, tests/ict-*.test.mjs, tests/fixtures/ict/*, research/ict/*,
research/edge/ict-*/*), `ict_note` (append to council-data `ict/mcp-notes.json`, shown in `ict_status`), `ict_propose_change`
(branch `mcp/<name>/…` + DRAFT PR to main; the owner merges; nothing reaches the tracker before that), and `search` /
`fetch` for ChatGPT deep research. Fred's key needs no env: `derivedKey` = HMAC(CTRADER_LINK_KEY or CRON_SECRET, "mcp:fred"), 32 chars; `MCP_KEYS` is optional (more people, or an override). Profile card (Fred only, `PROFILE_USERS`): POST `/api/mcp` `{action:"mykey", user, pw}` checks the password with ctrader-link's `identify` and returns his connector URL; the page shows `#ms-pf-mcp` only when `ms-user` is fred. Never: council files, api/, workflows, users, tokens, cTrader orders. Tests
`tests/mcp.test.mjs`. Rule: a helper's PR is reviewed like any rule change (tests, 2020-now evidence) before merging.

## Per-member permissions (8 Nov 2026, owner: "select on members what they can and can't do or see")
Keys `MS_PERM_KEYS`: charts, scanner, journal, desks (Gold / Crypto / LIT / NQ SDV), council (every tab; off = overview only),
macro (Macro desk switch), ct (demo accounts' results, labels only), mcp (ChatGPT connector on the profile), ict (false | 'read' |
'write'). `MS_PERM_DEFAULTS` per role (viewer: macro only; reviewer: all but ct / mcp / ict), then the record's flags (ict, ct, mcp)
and its `perms` override key by key (`msPerms(R, owner)`; the owner has everything). Bootstrap sets `html[data-deny="…"]` /
`data-allow`, and the ict / ictRo / ct / mcp flags follow; CSS gates use `html[data-deny~="key"]` (the old viewer-role rules for
charts / scanner / journal / desks / council were converted); the router sends a denied view home (`VIEW_PERM`, `msDenied`).
Users page: a "Permissions…" button per member opens `permDialog` (checkboxes + ICT radio, "Back to role defaults"); saved on the
record as `perms` plus ict / ct / mcp for the older checks. `api/users.js` `cleanPerms` whitelists keys and values (a bad perms
object rejects the save). Login records (`ms-user-rec`) carry perms; the post-load check reloads when they changed. MCP: derived
keys are `<name>.<HMAC>` for any member; `granted(name)` is checked on every call (record's mcp / perms.mcp; perms.mcp false
revokes; an MCP_KEYS entry is a grant; Fred built in). Tests: `tests/users-perms.test.mjs`, `tests/mcp.test.mjs`.

## Backtest lab (8 Nov 2026, owner: "build a manual backtesting like TradeZella … and he can simulate prop-firm challenges")
`backtest.html` at `/backtest` (vercel rewrite; build copies it; sidebar entry `.bt-nav` for signed-in members; the page itself
needs `ms-admin` in localStorage). Engine `assets/backtest-engine.js` (`window.BT`, also `module.exports` for tests): accounts,
`place` (market / limit / stop; a stop is required; sides checked), `onBar` (fills when touched or gapped through, stop / target
with the worst case when both sit in one bar, gap exits at the open, MFE / MAE in R), `stats` (win rate, PF, expectancy, max DD,
streaks, by weekday / hour / tag / side / exit, equity curve), `byDay`, and the prop-firm model: `FIRMS` presets (FTMO 2-step,
FundingPips 2-step, Topstep 50K / 100K, Lucid 50K, custom; all editable in the page, each with a "check the firm" note),
`newChallenge`, `evaluate(ch, acct, px, t)` per bar: daily loss against the day's starting equity, static or trailing floor
(eod trails end-of-day balance highs and locks at the start balance; intraday trails equity), time limit, target on closed
balance, minimum trading days, consistency (best day share), phases (next phase resets the account), funded. Page: OANDA candles
through `/md/bars` in 4999-bar windows (300 bars of context before the start, N days after), bar-by-bar replay (→ / Space /
speed / skip day), click-to-set entry / stop / target, risk-% sizing, open positions (BE, close, edit SL / TP), journal with
editable tags / notes, statistics, calendar, challenge log, sessions in localStorage `btLab:sessions` (+ JSON / CSV export,
import). Tests: `tests/backtest.test.mjs`. Paper only; nothing reaches the council or the mirror.

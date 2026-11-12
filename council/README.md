# Mosha council

A paper-trading desk with four members: the **Trader** trades, the **Coach** tunes the Trader's rules inside fixed limits,
the **Analyst** writes a weekly brief, and the **Macro strategist** forecasts next-day macro odds and event days (paper only). No real money is involved. All results live on the `council-data` branch (never on
`main`), and the site (meridianx.dev, **AI council** view) reads them from there.

## The members

| Member | What it does | When it runs | Reads | Writes |
|---|---|---|---|---|
| **Trader** (`council/trader.mjs`) | Scans every market with the same engine as the site (`council/engine.mjs`), opens, manages and closes paper trades for every live system, follows blocked signals as shadow trades, sends phone alerts (ntfy / Telegram, with a futures ticket from `futures.mjs`) and writes the MT5/cTrader signal file. | Every ~4 min, 24/7 (see "Runner" below). | `config.json`, `state.json`, `trades.json`, `backtest.json`, `reviews/losses.json`, `reviews/analyst.json`, `research/replay-2w.json`, `analysis/latest.md` | `trades.json`, `state.json`, `snapshot.json`, `research.json`, `mt5/signals.csv`, `reviews/analyst.json`, the Analyst's data-built blocks in `analysis/latest.md` |
| **Coach**, statistical (inside `trader.mjs`) | Learns and drops filters, tunes stop buffer / minimum stop / reward:risk / break-even / dollar cap, reads the daily replay, runs the live-sleeve guard, and writes proposals for the owner. | Once a UTC day on the first Trader round; condition filters and break-even every 6 h; the guard and proposals every round (proposals only recompute when the replay or the rules change). | `trades.json`, `backtest.json`, `config.json` | `config.json` (with every change in `history`), `coach.json` (stats, lessons, notes, `proposals`, `decay`) |
| **Coach**, AI review | A scheduled assistant session (set up outside this repo) that reads the day's losses and writes a review; may make at most 2 rule changes a day inside the limits below. | Daily. | everything above | `reviews/latest.md`, `config.json` (logged `by: "coach-ai"`) |
| **Analyst** | A scheduled assistant session (outside this repo) that writes the weekly brief: bias per market, key levels, likely setups, news. Between the markers `<!-- live-rule:start -->` / `<!-- live-rule:end -->` the Trader rewrites a **Live Scalp rule check** every round (`council/analyst.mjs`): each market's D1 trend and its source, which side the live Scalp may take now, and the replay under that rule. The Trader round also runs the Analyst's **loss post-mortems** (every closed losing live trade, once the after-exit watch is done: MFE/MAE in R, time to the stop, whether price came back to the target, session open / news timing, higher-timeframe trends; tags hunt / noise / late / news only on clear evidence) into `reviews/analyst.json` (`by: "analyst"`; the lesson rules use them only where the owner wrote no review) and a daily **What changed** block (each setup's last 20 trades vs its whole record, Welch t, confidence; no edge claimed without n and t). Reporting and review tags only. | Weekly (Mondays); the data blocks every Trader round (What changed once a UTC day). | `snapshot.json`, `config.json`, `backtest.json`, `trades.json`, `reviews/losses.json` | `analysis/latest.md`, `reviews/analyst.json` |
| **Macro strategist** (`council/macro.mjs`) | Paper only. Next-day up/down odds for gold, EUR/USD (DXY), USD/JPY, NQ and ES from the macro driver stack of gold-trading.html, an event playbook for the next 1-5 days (consensus, previous, hot / in-line / cool moves per market, expected move size) and a plain-language brief. Fetches its own free data (FRED, Forex Factory calendar, Fed / ECB / BoJ RSS, CFTC, ECB, Cboe, OANDA via /md/bars). Scores itself on a walk-forward replay and an append-only live log (hit rate vs base rate, Brier, calibration, Pesaran-Timmermann). Move size: four simple models (event median × vol ratio, EWMA, HAR-lite, VIX-implied for ES / NQ) against the naive 20-day mean on MAE and QLIKE, with CPI / NFP / FOMC days from `council/events.mjs`; a market uses a model only if it wins the first half of the replay and beats naive again on the second, otherwise it keeps the naive forecast (research/edge/macro-vol). The Analyst and Coach can read `macro/forecast.json`; it changes no rule or trade. | Every 6th Trader round (~25 min). | its own fetches, `macro/*.json` | `macro/forecast.json`, `macro/history.json`, `macro/events.json`, `macro/cache.json`, the "Macro strategist" block in `analysis/latest.md` |

Supporting scripts:

| Script | Job |
|---|---|
| `backtest.mjs` | The daily replay: the last 30 days of real candles through the Trader's engine and rules → `backtest.json`. Also records the paper exit `R_pt1` (half off at +1R, the rest trailing 1R) next to the live exit, never traded (`research/meridian-exits.md`); `BT_DUMP=<dir>` writes fills and 1m candles for exit studies. Fills and exits follow the Trader's rules via `fills.mjs` (`replayBar`): gapped stops fill at the open, fill + target in one candle is missed, shut-spot candles are skipped. |
| `fidelity.mjs` | Replay fidelity check: does the replay produce the same signals and outcomes as the live Trader on the same days? → `research/fidelity.json`. |
| `proposals.mjs` | Builds the Coach's owner-facing proposals from `backtest.json` (never applies them). |
| `coach.mjs` | The Coach's evolution helpers: shrunk expectancy, champion/challenger trials for its filter rules, the change ledger and its `analysis/latest.md` block. |
| `decay.mjs` | The Coach's edge-decay monitor: every live system's record after costs against its own backtest (rolling expectancy, one-sided CUSUM vs the backtest and vs zero with a per-system limit, drawdown vs its worst) → `coach.json` `decay` (healthy / watch / decaying) every 6 h. Status and alert only, never a rule change. Baselines in `decay-base.json`, built and back-tested by `research/edge/decay-monitor/run.mjs`. |
| `analyst.mjs` | Builds the Live Scalp rule check, Coach rule changes, desk status, loss post-mortem and What changed blocks, and the post-mortems in `reviews/analyst.json`. |
| `clean.mjs` | Bad-print cleaner shared by the Trader and the replay, so both read the same candles. |
| `review.mjs` | Post-mortem of every closed trade (`pm` on the trade). |
| `krakenhist.mjs`, `duka.mjs`, `yahoo.mjs` | History feeds for the replay (Kraken trade history first, then Yahoo, then Dukascopy). |
| `krakenfill.mjs` | Time-boxed Kraken backfill of the replay's crypto trade-history cache (workflow `kraken-backfill.yml`, every 30 min). |
| `replay.mjs` | Minute-by-minute replay of one market's morning, printed to the job log (manual). |
| `choch.mjs`, `futures.mjs`, `futures-test.mjs` | M15 CHoCH helper; futures tickets in alerts; one sample ticket (manual). |
| `engine.mjs` | Generated from the market-structure page's engine; regenerate it when the page's setup rules change. |
| `datacheck.mjs` | Candle-feed monitor: the OANDA proxy (`/md/bars`), Kraken and the ICT desk's CNBC futures, 5m candles → `health.json` (stale in market hours, gaps, zero/negative prices, broken candles, jumps > 25x ATR) and one deduplicated phone alert per bad episode (confirmed on 2 checks, 12 h reminder, all-clear). Weekend / daily halt / US holidays are not errors. |
| `digest.mjs` | Daily owner digest: ONE phone message after the US close (from 21:15 UTC, Mon-Fri, not on a CME full-closure holiday) and a Sunday-evening preview of the past 7 days: closed paper R gross / after costs (Meridian live, ICT A-setups), the cTrader demo balance and day P&L, open positions with floating R, the macro regime and next-day event, what waits on the owner (Coach proposals, data feeds, robustness verdict changes, a live system the edge-decay monitor calls decaying) and edge scoreboard movers. Deduplicated per UTC day in `digest.json`; `COUNCIL_ALERTS=off` sends nothing. `--dry` prints it, `--force` sends now. |

## When things run

| What | Workflow / place | Schedule |
|---|---|---|
| Trader loop | `.github/workflows/council.yml`, job `trade` | Each run does 60 rounds 4 min apart (~4.5 h), then starts the next run itself. A push to `main` touching `council/**` or `council.yml` starts a fresh loop (it cancels the old one). |
| Watchdog | `council.yml`, job `watchdog` | :07, :22, :37, :52 every hour: starts a loop only if none is running. |
| Vercel fallback | `api/run.js?job=council`, Vercel cron | Every 4 min, but **stands down** while GitHub Actions saved to `council-data` in the last 10 minutes. If Actions stops, Vercel takes over on its own (only when its run mode is `live` or `council`; otherwise it is a dry run that commits and alerts nothing). |
| Daily replay + fidelity | `.github/workflows/backtest.yml` | 03:17 UTC daily, on pushes to the replay's files, or by hand (choose the number of days). |
| 90-day research replay | `.github/workflows/research-replay.yml` | By hand only. Writes `research/replay-90d.json` (or a path you choose); never touches `backtest.json`. |
| Bars snapshot | `.github/workflows/bars.yml` | By hand: saves recent candles to `research/bars/` so a day can be replayed exactly. |
| Data check | `council.yml`, inside the Trader loop | Every 2nd round (~11 min): `node council/datacheck.mjs data` (150 s cap, never fails the round). |
| Owner digest | `council.yml`, inside the Trader loop | Every round, but it sends once per UTC day: from 21:15 UTC Mon-Fri and Sunday (`node council/digest.mjs data`, 120 s cap, never fails the round). |
| Tests | `.github/workflows/tests.yml` | Every pull request and push to `main`: syntax check, `node --test tests/`, the ICT audit and the alert checks on pinned council-data copies (`tests/fixtures/`). Offline: no secrets, no network. |
| Morning replay | `.github/workflows/replay.yml` | By hand: prints one market's morning to the log. |
| ICT desk | `ict.yml`, `ict-replay.yml`, `api/run.js?job=ict` | A separate system with its own files (`ict/`); not part of the council. |

## Stop and start

- **Stop the Trader on GitHub:** Actions → "Council trader" → ⋯ → *Disable workflow*, then cancel the run in progress.
  Disabling also stops the watchdog and the self-restart.
- **Stop it everywhere:** also set `paused: ["council"]` (or `["all"]`) in Vercel → Storage → Edge Config (`meridian-flags`).
  Otherwise Vercel picks the work up about 10 minutes after Actions stops saving (if its run mode is live).
- **Start it:** enable the workflow and press *Run workflow* (or wait for the next watchdog tick). Remove `council` from the
  Edge Config `paused` list to let the Vercel fallback run again.
- **One runner at a time:** Actions is the runner (owner, 7 Nov). Vercel only fills in when Actions is silent.
- **Alerts:** repository secrets `NTFY_TOPIC`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; futures-ticket sizing from the
  repository variables `FUT_ACCOUNT` / `FUT_RISK`. Remove a secret to silence that channel.

## Whose rules are whose

**Owner rules.** Each owner decision is an entry in `USER_RULES` in `trader.mjs`. The Trader applies each one once, adds its
id to `config.userRules` and logs it in `config.history` with `by: "user"` and the reason. To change a live rule, add a new user
rule (removing an id from `config.userRules` does not undo it; the new rule has to set the config back). Filter fields an owner
rule sets are marked `src: "user"` (for example the live Scalp's "against D1" and "not in Asia"), and the statistical Coach never
drops, re-tests or overwrites those (`userOwned` in `trader.mjs`, checked by both the statistical and the backtest learner).

**Coach rules.** Everything else in `config.json` the Coach may change on its own, always logged in `history`
(`coach`, `coach-backtest`, `coach-guard` or `coach-ai`), only within these limits:

| Setting | Range |
|---|---|
| `buf` stop buffer | 0.10–0.25 × ATR |
| `minRisk` minimum stop | 0.4–1.2 × ATR |
| `minRR` minimum reward:risk | 1.2–2.5 |
| `be` break-even | off, +1R, +1.5R or +2R |
| `fresh` signal age | 6–12 candles |
| `newsGuard` | on / off |
| `maxUsd` dollar cap | 2–4 trades betting the same way on the US dollar |
| `filters[setup]` | D1 with/against, structure main/internal, sessions to skip |
| pauses | a setup ≤ 7 days, a market ≤ 3 days |

Pauses are switched off by the owner (`no-pause`): the Coach records what it would have paused in `config.wouldPause` instead.
Blocked signals are always followed as shadow trades (`shadow: true`, `blockedBy`), so every rule can be judged.

**How the Coach learns its filters (`coach.mjs`).** A D1 / structure / session filter is added or dropped only when the group it
acts on passes `solid()` (30+ trades, |t| ≥ 2, the same sign in both halves) AND its shrunk expectancy is at least 0.10R away
from 0 (a Normal prior centred on 0R; its spread tau estimated from all setup × condition groups, empirical Bayes, clamped
0.05–0.5R). Each such change is a **champion/challenger trial** (`config.coachTrials`): the new rule trades, the old one is
followed as a shadow on the same recorded signals; after 20 forward signals where the two disagree the change stays if its
shrunk edge is ≥ +0.05R a signal, otherwise (or after 60 days without 20) the old rule comes back by itself (`by: "coach-trial"`,
reason in `why`). A rule under trial or changed in the last 14 days is not touched again. Setups that trade live
(`config.focusSetups`) and owner rules are never changed by this learner: proposals only.
**Knobs and backtest filters (robustness audit, 7 Nov).** Stop buffer, minimum stop, reward:risk, break-even, signal age, news
guard and dollar cap move only on 30+ trades of evidence and at most once in 14 days (`knobGate`); the backtest learner's
filters hold 14 days too and leave live setups alone. Promotion proposals (`proposals.mjs`) need t >= 2 and a shrunk expectancy
over the bar (tau from every setup / condition group in the window). Replayed on the audit's data (`tests/coach-audit.test.mjs`):
the 9 promotions of the old rule (windows +0.24R, next week −0.02R over 319) all blocked; of the 35 Coach changes, 5 pass
(4 backtest filters, 1 knob), none on fewer than 30 trades, no topic flips.
**Change ledger.** Every Coach change in `history` gets an entry in `coach.json` → `ledger` (evidence, before/after numbers on the
sample it used, trial progress, and 30 days later the result: champion vs challenger for trials, the scope's record before vs
after for the rest). The Trader shows the last 20 in `analysis/latest.md` ("Coach change ledger").

**Live-sleeve guard (`coach-guard`).** A setup the owner put live on every market (`config.focusSetups`, today `scalp`) goes back
to shadow by itself once its live trades since that day lose 0.3R or more a trade over 20+ closed trades. It is logged, the date
lands in `config.sleeveStopped`, and only a new owner rule puts it back.

## What trades live (paper)

Live systems and their owner rules (details and test numbers are in each rule's `why` in `config.history`):

| System | Market(s) | Owner rules |
|---|---|---|
| Live Scalp sleeve (engine M15 → M1) | every market | `scalp-against-live`: against the D1 trend, not in Asia; the other engine setups stay shadow |
| Gold replica | gold | `replica-live`, `gold-vol-gate`, `gold-adaptive-gate`, `gold-top-be`, `gold-d1-with`, `gold-no-eg`, `gold-4r`, `gold-add`, `gold-add-1.5`, `replica-msnr-size`, `gold-news-veto` |
| Mosha BO | gold | `mosha-bo`, `mosha-bo-weekly`, `mosha-add`, `mosha-slow` |
| Gold trend (20-day and 5-day legs) | gold | `gold-trend`, `gold-trend-add`, `gold-trend-fast` |
| Gold H4 trendline | gold | `gold-h4-trendline` |
| Gold daily engulf | gold | `gold-daily-engulf` |
| Crypto trend | BTC, ETH, SOL, XRP | `pairs-best`, `crypto-add` |
| NQ New York open run | NQ | `nq-runner` (paper record in `research.json`, shown as "our system") |

On test or research only: gold momentum pullback (`gold-momentum-pullback`, shadow trades marked `test`), forex replica signals,
NQ Asian-open sweeps, NQ 80% rule and opening-4H trackers (`research.json`). Older owner rules (`gold-only`, `gold-shadow`,
`retire-legacy`, `take-all`, `research-150d`, `pairs-live`, …) are kept in `config.userRules` as history; later rules replaced them.

**D1 trend source (7 Nov).** For gold and the forex pairs the "with / against D1" label comes from OANDA spot daily candles (the
same feed as the site's charts); the candles the systems trade on stay Kraken. If OANDA can't be read, the Kraken trend is used.
Per market the source is in `snapshot.d1src` (live) and `backtest.json` → `markets.d1src` (replay).

## How proposals reach you

1. After each daily replay the Trader runs `proposals.mjs` and stores the result in `coach.json` → `proposals`. Kinds:
   - `skipMarket` / `skipSession`: a market or session that loses clearly for a live setup (20+ replay trades at −0.30R or worse
     while the rest are positive);
   - `stability`: the live setup's replay result in each half of the window, flagged if one half lost;
   - `promote`: a shadow setup with 100+ replay trades, +0.10R or better a trade and profitable in both halves → "make it live";
   - `promoteIf`: the same, restricted to one D1 side or one session (80+ trades, +0.15R or better, both halves positive);
   - `demote`: a live setup that loses on average over 80+ replay trades, or loses in both halves → "move back to shadow".
2. They show on the site as **"Coach suggests (needs your OK)"** in the *Live setups · paper* card.
3. **Nothing is applied automatically.** To accept one, ask for a new owner rule in `trader.mjs` (e.g. add a setup to
   `focusSetups` or a market to a setup's `noMarket`). The only automatic move is the live-sleeve guard above.

The Analyst brief and the Coach's AI review are the other two places the council talks to the owner.

## Replay and fidelity

- **Daily replay** (`backtest.mjs` → `backtest.json`): every timeframe through the shared cleaner; gold and crypto from Kraken
  trade history (gold as PAXG shifted onto spot by OANDA spot H1 closes), the forex pairs from Kraken trade history built into 1m
  candles, falling back to Binance / Yahoo / Dukascopy when a feed is short (`markets.source`, `markets.feeds` per timeframe,
  `markets.fallback`, `markets.coverage`, `markets.krakenCoverage`). A market is always replayed on one feed, never a mix.
  Trades still open at the end are written with status `open`. Each trade carries its spread in R. The Coach
  uses it once per new replay (`coach-backtest`); research setups such as the sweeps are reported, never learned from.
- **Kraken backfill** (`krakenfill.mjs`, workflow `kraken-backfill.yml`, every 30 min): fills the replay's per-day Kraken trade
  cache in 25-minute boxes (calls paced 1.1 s apart, cursors kept in `.part.json`), fewest missing days first. BTC needs ~175
  calls a day, ~5,600 for a 30-day window, far more than the nightly replay spends; a coin replays on Kraken from the first run
  after its cache covers the window. Both workflows save the cache even when cancelled and merge the newest saved copy first.
  `node council/krakenfill.mjs --status <cacheDir>` shows the coverage.
- **Fidelity** (`fidelity.mjs` → `research/fidelity.json`): matches live signals (live and shadow) to replay rows by market,
  setup, side and signal time (±10 min) and compares outcomes. Runs after every daily replay. Not shown on the site yet.
- **90-day research replay** (`research-replay.yml` → `research/replay-90d.json`): the same replay over a longer window, by hand.

## Where to see it on the site

AI council view (meridianx.dev). Tabs:

| Tab | Card | Shows |
|---|---|---|
| (header) | status line | last scan, markets watched, feed errors, which markets' D1 came from OANDA vs Kraken |
| Overview | Active trades; Calendar | what is open now; R by day (main systems, shadow optional) |
| Trades | Trader | every paper trade (live / shadow / journal / all), tap for its chart |
| Systems | **Live setups · paper** | the live sleeve, its record vs the replay, the guard progress, and the Coach's proposals |
| Systems | Edge finder; NQ; Gold replica; Pairs | where the council makes money; each live system's record |
| Review | Loss review; Trade reviews | the owner's loss reviews (`reviews/losses.json`); the automatic post-mortems |
| Research (admin) | Analyst · weekly brief | `analysis/latest.md`, including the Live Scalp rule check |
| Research (admin) | Coach · daily review and rules | the current rules, today's statistics check, rule changes (`history`), the AI review |
| Research (admin) | Edge decay · early warning | each live system's status (healthy / watch / decaying) from `coach.json` `decay`: rolling R, CUSUM vs its limit, drawdown vs its limit, and why |
| Research (admin) | Scorecard; Backtest | results by setup and market; the 30-day replay, with the D1 label source |

## Files on `council-data`

| File | Written by | What's in it |
|---|---|---|
| `trades.json` | Trader | every paper trade, live and shadow, with `feat`, `ctx` and the post-mortem `pm` |
| `state.json` | Trader | signal memory, gold basis, open watches |
| `snapshot.json` | Trader | per-market state of the last scan, `d1src`, `lessons`, `ownerReviews`, system summaries, errors |
| `config.json` | Owner rules, Coach | the live rules, `userRules`, `focusSetups`, `filters`, `history` |
| `coach.json` | Coach | daily statistics, lessons, notes, `proposals` |
| `research.json` | Trader | NQ and other research records |
| `backtest.json` | daily replay | the 30-day replay |
| `research/fidelity.json` | fidelity check | replay vs live match |
| `research/replay-90d.json` | research replay | longer replay |
| `research/replay-2w.json`, `research/shadow-replay.json` | research runs | long histories of the live systems and of the shadow book (calendar) |
| `analysis/latest.md` | Analyst (+ Trader's rule-check block) | weekly brief |
| `reviews/latest.md` | AI Coach | daily review |
| `reviews/losses.json` | owner, from the Loss review card | owner's loss reviews; the Trader counts their tags |
| `reviews/analyst.json` | Trader round (Analyst post-mortems) | post-mortems of live losses (`by: "analyst"`); their tags count only where the owner wrote no review. Kept apart from `losses.json` so the bot never overwrites a review the page just saved |
| `mt5/signals.csv` | Trader | live systems for the MT5 / cTrader bridges |

## Guide for the AI Coach (read before every review)

**The standard.** The trader's own marked trades in `examples.json` are the reference; every rule change is checked against
them. From the 2 Nov gold chart: (1) liquidity first: enter right after a swing high/low is swept, inside the base, not after
the breakout; (2) structure confirms: a VR or CHoCH on M5/M15, then an M1 BO; (3) tight stops at the structure that made the
entry; (4) targets are the opposing liquidity or Origin; (5) don't fight the flip.

**Trade fields** in `trades.json`: `status` (pending, open, win, loss, be, missed, expired), `R`, `k` (setup), `market`,
`feat` (d1, struct, session, cf, choch, m15c at the signal), `mfe` / `mae`, `shadow` + `blockedBy`, `ctx` (entry conditions),
`pm` (post-mortem: `verdict` system|market, `cause`, `lesson`, `factors`, `after`).

**Post-mortem causes** (`review.mjs`). System: `noise` (stop inside one normal candle), `hunt` (stopped, then went to target),
`gaveback` (was +1R first), `late` (filled 0.25R+ worse, or signal 8+ candles old), `against` (against D1), `becost` (break-even
exit, then target), `leftmoney`. Market: `news`, `gap`, `retrace-fail`, `reversal`, `normal`. Only `pm.phase: done` reviews
drive rule changes.

**Each daily review:** a "Trade by trade" section for every loss of the day (setup, what the market did, system error or market,
and why if you disagree with `pm`); "What we learn" (at most three lessons, each tied to a cause that repeats); "Did the rules
help?" (scored vs shadow trades per blocking reason).

**You may change** at most 2 settings a day, each with 5+ closed trades behind it, within the Coach limits above, in steps of
`buf` ±0.02, `minRisk` ±0.1, `minRR` ±0.1, `fresh` ±2, `maxUsd` ±1. Never touch an owner-owned field (`src: "user"`), the owner
rules, or `focusSetups` (proposals only). Log every change in `history` with `"by": "coach-ai"`, a `why`, and the real current
UTC time (`date -u`). Never edit `trades.json`, `state.json` or `snapshot.json`.

## History

The dated research notes behind each owner rule (3–6 Nov: the gold replica versions, Mosha BO, pairs, crypto trend, NQ
trackers, gold trend / trendline / engulf, momentum pullback, bad prints, gold pricing) were kept in this file until 7 Nov:
`git show da94547:council/README.md`. Each rule's change and reason are also in `USER_RULES` (`trader.mjs`) and
`config.history`.

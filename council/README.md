# Mosha council

Three roles work the Mosha market-structure setups:

| Role | Runs | What it does |
|---|---|---|
| **Analyst** | Claude, Mondays | Reads the week's snapshot of every market and writes `analysis/latest.md`: bias per market, key levels, which setups are likely, news to watch. |
| **Trader** | GitHub Actions, every ~4 min, 24/7 (`.github/workflows/council.yml` loops and restarts itself) | Runs `council/trader.mjs`: the same engine as the page (`council/engine.mjs`), paper-trades every Ready setup (max 2 live trades per market, never long and short together), manages fills, stops and targets, writes `trades.json` and `snapshot.json`. |
| **Coach** | Statistics daily in the trader job, plus a Claude daily review | Pauses losing setups, tunes the stop buffer and minimum reward:risk inside fixed limits, logs every change in `config.json` → `history`, and writes `reviews/latest.md`. |

All results live on the `council-data` branch. Limits the Coach may change on its own:
break-even at +1R on/off, stop buffer 0.10–0.25 × ATR, minimum stop distance 0.4–1.2 × ATR, minimum reward:risk 1.2–2.5, pause a setup for up to 7 days, pause a losing market for 3 days.

`council/engine.mjs` is generated from the market-structure page's engine; regenerate it when the page's setup rules change.

## Scorecard

The Council page groups closed paper trades by setup and by market. A verdict needs at least 5 trades: "trust" averages more than +0.2R a trade, "avoid" loses more than 0.2R.

## Self-evolution

Every trade records its conditions at the signal (`feat`: D1 with/against, main/internal structure, session).
Once a setup has 8+ closed trades (scored trades plus shadow trades blocked for unrelated reasons such as reward:risk, exposure, duplicate or the dollar cap), the daily Coach adds a rule when one condition loses (≤ −0.2R over 5+) while another wins
(e.g. "swing: only with D1"), stored in `config.json` → `filters`. A condition that loses badly on its own (against D1 or internal structure, 6+ trades at −0.6R or worse) is filtered even before the other side has proven itself. Condition filters and the break-even switch (on when 4+ and 25%+ of 6+ recent live/shadow losers were +1R first) are re-checked every 6 hours, and a setup is paused for 3 days on any run where it loses (6+ trades worse than −0.25R each, or 4 losses in a row while its trades are losing overall and the backtest doesn't show it at break-even or better over 50+ trades, counting live trades plus shadows blocked only by exposure, the dollar cap or a duplicate; a setup paused on a streak resumes once its 6+ trades and that backtest both pay); the other Coach rules run once a day. Setups a rule blocks are still followed as **shadow** trades
(`shadow: true`, `blockedBy`), never scored; if they make more than +0.2R over 5+, the rule is dropped. Every rule is re-tested after 21 days,
and a paused setup resumes early if its shadow trades recover.

## Trade reviews (post-mortems)

`council/review.mjs` studies every closed trade. At entry it saves `ctx` (ATR of the entry timeframe, the stop in ATR and in spreads,
the planned entry, how old the signal was, the D1/H4/H1 trend). When the trade closes it records the exit candle, any high-impact
news from the ForexFactory calendar during the trade, and the fill slippage. Then it **keeps watching price after the exit**
(4 h for M15 pairs, 12 h for H1, 2 days for H4, 5 days for D1), because what happens next separates a bad stop from a real reversal.
The result is `pm` on the trade:

| Verdict | Cause | Meaning |
|---|---|---|
| system | `noise` | Stop inside one normal candle (< 0.5 × ATR or < 5 spreads). |
| system | `hunt` | Stopped out, price turned within ~0.6R past the stop and then went to the target: right idea, stop in the sweep zone. |
| system | `gaveback` | The trade was +1R or more before it hit the stop: management. |
| system | `late` | Filled 0.25R+ worse than planned, or the signal was 8+ candles old. |
| system | `against` | Against the D1 trend (not for retracement trades, which are counter-trend by design). |
| system | `becost` | Break-even exit, then price went to the target. |
| system | `leftmoney` | Win, but price ran 1R+ past the target. |
| market | `news` | High-impact news for the market's currency during the trade. |
| market | `gap` | The exit candle opened 0.2R+ past the stop. |
| market | `retrace-fail` | A retracement trade that never got going: the higher-timeframe trend carried on. |
| market | `reversal` | Never went for us, then carried on 2R+ against: a valid loss, the stop did its job. |
| market | `normal` | Rules followed, the market didn't follow through. |

`pm.phase` is `watch` until the watch window ends, then `done`; only `done` reviews drive rule changes. `pm.factors` lists other causes that also matched.
Every run writes `snapshot.json` → `lessons` (counts by cause, system vs market, top lessons) and the daily Coach copies it into `coach.json`.
The statistical Coach acts on repeated system errors (6+ reviewed losses in 14 days): 3+ `hunt` (30%+) → buffer +0.02; 3+ `noise` → minimum stop +0.1;
3+ `late` (30%+) → `fresh` −2 candles (min 6); 3+ `news` → `newsGuard` on (no M15/H1 trades from 15 min before to 45 min after high-impact news; re-tested after 21 days);
3+ `becost` outnumbering saves → break-even moves 0.5R later.
The dollar cap (`maxUsd`, 2–4, default 3) rises by 1 when trades blocked only by it make more than +0.3R over 5+ (14 days), and falls by 1 when those would have lost and live gold/forex trades lose too.

## The trader's method (the guide)

The trader's own marked trades are the reference: `examples.json` lists them with entry, stop, target and an entry window, and every new rule, setup or review is checked against them (would the Trader have taken them?). From the marked gold chart of 2 Nov 2026 (XAU/USD spot, M30; times UTC):

- **Context.** Friday's sell-off ran from about 3,995 to 3,868, breaking 3,975 and then 3,888 (purple lines: breaks of structure). The low is the VR (green box) with the Origin of the reversal just above it (lavender, 3,871–3,886). The H1 Origin of the sell-off, the zone it broke down from, is 3,965–3,975.
- **Short, about 07:00.** Sunday night's rally topped at 3,913 (purple). The M30 high at about 3,916–3,918 swept it, then structure broke down through 3,902 (purple). Sell 3,908.27, stop 3,916.10 just past the sweep high, take profit 3,891.46 at the prior swing low: 2.1R, hit about 08:00.
- **Long, about 11:45.** The short's target swept the 3,891 low and price based at 3,891–3,907 (green box). M5 turned up and M1 broke up. Buy 3,900.71, stop 3,896.79 just under the M1 origin (pink), take profit 3,965.08 at the bottom of the H1 Origin of the sell-off: 16.4R, hit about 14:12.

**How the chart is marked** (the engine's own vocabulary): purple lines are swing levels at a wick, the liquidity a break or a sweep takes; green boxes are VRs, the reversal formation at an extreme (the engine's `vrBox`: from the extreme to the last internal swing before it, in once the extreme has held for 6 candles: on M30, 3 hours: the 08:00 low held to ~11:00 and the long came at 11:45); lavender boxes are Origins, the base an impulse left from; pink and grey are the trade's risk and reward. The same sequence repeats three times on one chart: liquidity taken → VR → Origin → entry at the Origin with the stop just past it → target the opposing Origin (Friday's low → Sunday's rally; Sunday's high → the short; the short's target → the long).

**What the Trader did that day.** Its H1 retracement buy (`rintra`) had the long's idea from Sunday 23:08: buy 3,894.38, stop 3,883.8, target 3,955.2. At +1R the break-even rule (on from 06:04 to 11:52) moved the stop to 3,894.38, just above the 3,891 liquidity; the 08:00 sweep (the short's target) took it at 08:18 for 0R, then price ran to the target: +5.7R lost. Break-even is now off and owned by the backtest (−0.04R per trade). The M15 scalp sold into the sweep at 08:29 (shadow, lost). The retracement then waited for an M5 break up, which came only with the 13:35 breakout. The sweep model saw the 3,913 sweep but never got its M5 VR, and lost the 3,891 one.

**What it teaches.**
1. **Liquidity first.** The entries come right after a swing high or low is swept (a wick beyond it, a close back inside), inside the base, not after the breakout. The Trader's H1 retracement buy signalled at 13:43, after the move, and its pullback order never filled.
2. **Structure confirms.** After the sweep the lower timeframes break the other way: a VR or CHoCH on M5 (or M15), then an M1 BO. In the trader's words: "once we had a CHoCH in M15 or M5 we enter".
3. **Tight stops at the structure that made the entry.** The stop goes just past the sweep extreme, or just under the M1 origin. The reward:risk comes from the stop, not from waiting for a better price.
4. **Targets are the opposing liquidity or Origin.** For the short, the prior swing low. For the long, the near edge of the H1 Origin of the sell-off (the last H1 break's Origin), not the start of the whole leg.
5. **Don't fight the flip.** The Trader's M15 scalp sold the low at 08:29, after the short had played out. The trader flipped long there.

The backtest replays this model as the research setups `sweep_vr` / `sweep_ext` (see Backtest). Neither caught these two trades yet: matching them is the target.

## Guide for the AI Coach (read before every review)

Read **The trader's method** above and `examples.json` first: they are the standard every review and rule change is held to. Stamp every change (`history[].at`, a filter's `since`) with the actual current UTC time (`date -u`), never a rounded or future one: the Trader resets future times to the moment it sees them.

**Trade fields** in `trades.json`:
- `status`: pending | open | win | loss | `be` (break-even, 0R) | missed | expired
- `R`: the result in risk units. `k`: the setup key. `market`: the market.
- `feat`: the conditions at the signal (`d1` with/against, `struct` main/internal, `session` asia/london/overlap/newyork/late, `cf` choch/bo, `choch` yes/no, `m15c` yes/no). Tapping a trade on the page shows them under its chart.
- `entryMode: 'market'`: filled at market because the Coach set this setup to market entry.
- `mfe` / `mae`: how far the trade went for and against, in R.
- `shadow: true` + `blockedBy`: the trade was blocked by a rule and is followed but never scored. The reasons are paused, market, minRR, d1, cf, choch, m15c, struct, session, exposure, news, duplicate (same stop and target as a live trade; a setup re-signalling the same side and target while that idea is still open is not recorded at all) and usd (already 3 live gold/forex trades betting the same way on the US dollar).
- `ctx`: conditions at entry. `pm`: the trade review (see "Trade reviews" above): `verdict` system|market, `cause`, `title`, `detail`, `lesson`, `factors`, `after` (best/worst in R after the exit, `hitT1`), `news`, `gap`, `slip`.

**Rules** in `config.json`: `buf`, `minRisk`, `minRR`, `be`, `paused` (setups), `pausedMarkets`, `filters` (learned rules per setup, with `since` dates), and `history`. The statistical coach in `trader.mjs` applies the mechanical rules daily. Your job is judgement on top of that.

**Study every loss of the day first.** For each loss, read its `pm` and the candles around it, then write a short post-mortem in a
"Trade by trade" section: what the setup was, what the market did, and your verdict: *system error* (our rules or management
caused or worsened it, say which rule to change) or *market* (taken as designed, an accepted cost). You may disagree with the automatic
verdict; say why. End with "What we learn": at most three concrete lessons, each tied to a cause that repeats across trades,
never a rule change from a single trade.

**Add to every daily review:** a "Did the rules help?" section. For each blocking reason, compare scored trades with shadow trades, and say which rules kept the council out of losers and which blocked winners.

**You may change** (at most 2 changes a day, only with 5+ closed trades behind each):
- `buf` 0.10–0.25 (±0.02)
- `minRisk` 0.4–1.2 (±0.1)
- `minRR` 1.2–2.5 (±0.1)
- `be`: null, 1, 1.5 or 2
- `fresh` 6–12 candles (±2), `newsGuard` true/false
- `maxUsd` 2–4 (±1)
- pause a setup for at most 7 days, or a market for at most 3 days, or resume either early
- add or remove `filters[k]` entries (`d1`, `struct`, `noSession`), setting `since`

Log every change in `history` with `"by": "coach-ai"` and a `why`. Never edit `trades.json`, `state.json` or `snapshot.json`.

## Backtest

`backtest.mjs` replays the last 30 days of real candles (Binance 1m history for BTC, ETH, SOL, XRP and gold via PAXG; for the five forex pairs Kraken's own trade history built into 1m candles (`krakenhist.mjs`: the feed the live Trader uses, and it answers GitHub's runners; whole UTC days, newest first, finished days kept in the workflow's cache, at most `KRAKEN_BUDGET` = 400 calls per pair and run, so a busy pair such as EUR/USD, ~90,000 trades a day, fills its 38 days over a few runs and the replay covers the newest contiguous days it has: `markets.coverage`), then Yahoo Finance (`yahoo.mjs`), then Dukascopy (`duka.mjs`)) through the same engine and entry rules as the Trader: every 5 minutes it rebuilds the 720-candle view of each timeframe, including the forming candle, takes every fresh Ready setup and manages it on 1m candles. Each trade carries its spread in R (forex 1 pip, gold 0.3, crypto 0.02% of price; one spread per round trip) and the Coach and the page judge every result after it. Each trade is scored four ways (no break-even, break-even at +1R, at +1.5R, and holding to the second target `t2`, one Origin height past `t1`). The results go to `backtest.json` on `council-data` (expectancy by setup, by condition, by reward:risk and by market, plus every trade), refreshed daily by the "Council backtest" workflow.

The Coach uses it (`learnFromBacktest`, once per new backtest, logged as `coach-backtest`). Trades on the same market and UTC day are not independent (one move fires several setups), so every mean comes with a standard error clustered by market-day, and each rule needs a clear t-value besides its size and holding in both halves of the period: a D1 filter needs one side ≥ +0.1R and the other ≤ −0.1R each over 30+ trades per side with a gap of t ≥ 3 (about 7 setups are tested at once, so a looser bar would find chance rules); it replaces a live-learned D1 filter, is re-checked by every backtest instead of the 21-day rule, and is dropped once the side it excludes is no longer worse. Break-even is compared trade by trade with no break-even and used only if it adds ≥ 0.02R per trade at t ≥ 2 and in both halves. A setup is paused for 3 days when, as it trades now, it has 10+ trades at −0.3R or worse (or 8+ at −0.5R or worse) at t ≤ −2, negative in both halves; a setup clearly profitable as it trades now (≥ +0.1R over 100+ trades, t ≥ 2.5, positive in both halves) is not paused on fewer than 15 live trades, and such a pause is lifted.

**Research setups** (backtested, not traded yet): `sweep_vr` / `sweep_ext` = liquidity sweep → VR → BO, from the user's marked gold trade of 2 Nov. An M30 candle wicks beyond a recent M30 swing high (low) and closes back inside it (the sweep, within the last ~6 h, not closed beyond since); then M5 breaks structure the other way (the VR, its Origin still valid); then a fresh M1 BO the same way (≤ 12 min old) is the entry, at market. Target: the nearest valid opposing M30/H1 Origin, else the other end of the prior ~30 h M30 range; only taken at ≥ 1.2R. `sweep_vr` puts the stop past the M5 VR structure, `sweep_ext` past the sweep extreme (the trader's short, 2 Nov), `sweep_m1` just past the M1 BO's origin (the trader's long, 2 Nov: 3.9 points of risk for 16R), never inside the engine's minimum stop (0.6 × M1 ATR, 5 spreads); `sweep_h1` is `sweep_m1` held to the nearest valid opposing H1 Origin worth at least 1.2R instead of the nearest M30/H1 one (the long went past the spent supply 1.3 points above its entry to the H1 Origin of the sell-off; on a rebuilt 2 Nov scenario it buys 3,900.7, stop 3,897.1, target 3,965.08, 17.9R, against the trader's 3,900.71 / 3,896.79 / 3,965.08). A sweep counts when the candle that trades beyond the swing, or one of the next two M30 candles, closes back inside. The Coach decides only on the setups the Trader trades; research setups are reported, not learned from.

**The trader's examples in the backtest.** For each trade in `examples.json` inside the replay, `backtest.json` → `examples` lists the signals any setup took in its entry window (with their result), every change of the setups' states on that side, and the sweep model's stage at each step (no sweep / sweep failed / waiting for the M5 VR / waiting for the M1 BO / no target / reward:risk under 1.2 / signal), so a missed example says exactly which condition stopped it. The Backtest card shows each one as taken (by which setup, for how much) or missed (and where the sweep model stopped).

**Entry style.** By default a Ready setup rests an order at the CF level and waits for the pullback; strong moves often never come back, so the order misses (e.g. the 2 Nov 13:43 gold retracement buy: entry 3,921.9, price ran to the 3,957.5 target without filling). The backtest gives every signal a twin entered at market (`<setup>@mkt`) and keeps resting orders that never fill as 0R rows (`fill: 0`). The Coach compares the two signal by signal, after spread, on the signals the setup's D1 filter lets through, and sets `config.entry[setup] = 'market'` only when entering at market adds ≥ 0.05R per signal at t ≥ 2.5 and wins in both halves (kept while it stays ahead); the Trader then fills that setup at market as soon as it is Ready (`entryMode: 'market'` on the trade).

**Research rule set (2 Nov, `research-150d`).** A 150-day replay (5 Jun – 2 Nov, all ten markets, 20,524 signals) of the rules as they stood lost −0.09R a trade. Rules picked on the first 100 days and kept only if they also helped on the last 50: Position off (`filters.position.off`); Swing only against D1; Intraday reward:risk ≤ 10 (`maxRR`); Scalp skips AUD/USD (`noMarket`); Retrace M15→M1 only at reward:risk ≥ 3 (`minRR`); Retrace H1→M5 skips USD/CHF; dollar cap 2. Together: about break-even over the whole period, +0.031R a trade on the held-out last 50 days. Blocked signals are followed as shadow trades (`off`, `rrBand`, `market`). Ideas tested and not adopted because they did worse out of sample: Janda (BO Structure then BO), H4 → M15 confirmation, trading only with the higher timeframe (Photon chain: with the timeframe above did worse in every setup), a lower-timeframe CHoCH after the CF, time stops, slot replacement, entering at market, daily trade caps.

**Research setup: the Daily Cycle (paper only).** From the trader's Liquidity Trading notes: London (07:00–12:00 UTC) sets the bias (its low before its high and a close above its open = bullish, mirrored for bearish); in the New York open (12:00–15:00 UTC) a retracement into 62–70% of the London leg is bought (sold) at market, stop past the London low (high), target 3R, otherwise closed 8 hours after entry (replaced the 21:00 UTC close on 3 Nov). On the 150-day replay cleaned of bad prints, the 8-hour exit made +0.17R a trade (t 2.1) against +0.11R holding for the target, and it was the only exit still positive in the last third (+0.10R). Crypto only: the 150-day replay made +0.17R a trade there (gold/forex −0.04R), positive in both thirds but weaker in the last. Its trades live in `council-data/research.json`, never in `trades.json`, so the Coach's statistics, filters, pauses and lessons never use them; `snapshot.json` → `research` keeps the running total. It goes live only once its forward paper results confirm the replay.

**No pauses (3 Nov, `no-pause`).** The trader wants every setup and market trading for study, so `config.noPause` is on: the Coach pauses nothing (statistical, backtest or market pauses) and records what it would have paused in `config.wouldPause` instead.

**Target per setup.** By default a trade takes profit at its first target; a retracement's first target is the 50% line of the higher-timeframe leg and its second is that timeframe's Origin, where the main trend resumes. `config.target[setup] = 't2'` holds the trade to the second target instead (`target: 't2'` and the passed first target `tp1` on the trade), and a resting order then stays valid until price reaches it. The backtest's `R_tp2` column is the same trades held to the second target. The Coach sets it at ≥ +0.05R per trade, t ≥ 2.5, both halves, keeps it while it stays ahead, and judges the entry style at the target each setup uses.

**The trader's rules** (`USER_RULES` in `trader.mjs`, applied once, logged with `by: 'user'`, listed in `config.userRules`). The Coach overrides a trader's rule only when a backtest shows it clearly losing (≤ −0.05R per trade, t ≤ −2, both halves), and logs that it did. History: `rintra-origin` (2 Nov 16:10) held the H1 → M5 retracement to the engine's H1 Origin (4,019.8, the start of the whole sell-off leg) after "no reason to miss this buy till the H1 origin"; the trader's marked chart then showed their H1 origin is the Origin of the sell-off's last H1 break (TP 3,965.08), which the first target already matched, so `rintra-origin-chart` undid it.

**Gold prices.** Gold trades on Kraken PAXG candles shifted onto XAU/USD spot (gold-api.com). The shift is the median of the last 2 hours of samples (`state.basis`), each spot quote matched to the PAXG minute it was quoted in; a stale quote adds nothing and the last shift is kept. One quote per run used to move every gold level by $2.70 per run on average (up to $8), more than a gold scalp's whole risk.

**Signal memory** (`state.seen`) is per market (`<market>|<signature>`): the signature is only the setup and two candle times, which correlated markets share.

**The trader's M15 CHoCH** (`choch.mjs`, 2 Nov): "M15 CHoCH is a sign to enter: it tells when the trend is changing, or we move from pullback/retracement to continuation and vice versa." A CHoCH up: the M15 leg down from the last 12 h's high to the lowest low after it (at least 2 M15 ATR), then an M15 candle closes above the last lower high before that low (an M15 swing high, 2 candles each side); a CHoCH down mirrors it. On 2 Nov the pullback 3,918 → lower high ~3,905 → 3,891 ended with an M15 close back above ~3,905, and the buy ran to 3,965. This is not the engine's VR confirmation (it only counts swings beyond the break level, so a straight drop like that never confirms) nor its structure flip (that came only with the 13:30 breakout). Every signal, live and in the backtest, records `m15c`: did that CHoCH in its direction close within the hour; the Coach learns it like D1 (`blockedBy: m15c`). The research setup `m15choch` enters on it at market within two M15 candles, stop just past the low (high), target the nearest valid opposing M30/H1 Origin worth ≥ 1.2R (rebuilt 2 Nov: buy 3,907, stop 3,889.5, target 3,965.08, 3.3R). The trader's examples log each step's M15 state (`m15`).

**Market-structure conditions (CHoCH).** The user's rule: once M15 or M5 prints a CHoCH (a change of character: the first break that flips that timeframe's structure, the engine's `structure: true` event, shown as "BO Structure"), enter. Every signal records two conditions, live and in the backtest: `cf` — is the confirming lower-timeframe break itself a CHoCH (`choch`) or a continuation BO (`bo`); `choch` — has M15 or M5 printed a CHoCH in the trade's direction within its last 12 candles (`yes`/`no`). The Coach treats them exactly like D1 (`CONDS` in `trader.mjs`): a filter needs one side ≥ +0.1R and the other ≤ −0.1R over 30+ trades each, a gap at t ≥ 3, both halves, after spread; the Trader then blocks the other side (`blockedBy: cf` / `choch`, followed as shadow trades). Combined with the entry-style rule this covers "CHoCH on M15/M5 → enter at market" — adopted only where the data shows it pays.

## Bad prints

Kraken's forex and PAXG candles are built from thin trade flow and carry the odd off-market tick (a 150-day replay found
20–40 per forex pair on 1m, and one 1,000-pip EUR/USD candle that made a fake +160R scalp). Before analysing, the Trader
clips any wick longer than 50 median candle ranges (of the last 100 candles) back to the body plus one range, and flattens a
candle whose body jumps 50 ranges and comes straight back. Real news candles are mostly body and are not touched. Forex also clips (on 1m–30m only, so the H1/H4/D1 structure is left alone) a lone wick
longer than 15 ranges when the next 3 candles never trade back into its outer half: on 3 Nov at 10:12 a single Kraken order
spiked AUD/USD 35 pips for one minute (Yahoo showed nothing) and stopped five shadow trades. Real news spikes get revisited. Counts
per market and timeframe go to `snapshot.cleaned`.

Because a lone spike can only be judged once 3 later candles exist, forex trades are managed on 1m candles at least 3
minutes old (exits come up to 3 minutes late, never on a spike that is about to be clipped). Trades already closed by a
bad print (listed in `BAD_PRINT_CLOSES`, found with the raw-candle probe) are reopened once, keep the old result in
`badPrint`, and finish on the cleaned candles.

## Take all signals (user rule, 3 Nov)

`config.takeAll` (user rule `take-all`): every signal trades (paper), including the ones a filter, the exposure limit, the
dollar cap, the minimum reward:risk or a session rule would block. Those trades keep the reasons in `blockedBy` (and say so
in their note), so the results can always be split into what the rules would take and what they would block. Only a
literal duplicate (same stop and target as an open trade) is still a shadow. The 150-day replay says trading every signal
loses about 0.2R a trade; this is the trader's forward test of that. Remove the user rule (and `config.takeAll`) to go back.

## Scalp re-entry block (3 Nov)

A Scalp signal in the same direction within 3 hours of a Scalp loss on the same market stays a shadow trade (`reentry`), even under take-all, the same way a duplicate does. On the 150-day gold replay (take-all, every signal) these re-entries lost in every one of the six months: −0.24R a trade on the first 100 days and −0.52R (t −4.1) on the last 50, −80R in all, while the other Scalps netted +0.6R. 1, 2 and 6 hour windows give the same picture. Retrace scalp and M30 → M1 re-entries are mixed, so they are not blocked. On 3 Nov it would have kept the 11:27 and 12:10 gold sells (both −1R) off the live book.

## Gold only (user rule, 3 Nov)

`config.focus = ['xau']` (user rule `gold-only`): only XAU/USD trades live. Signals on the other markets are still taken as
shadow trades with `blockedBy` containing `focus`, so their statistics keep building. Remove the user rule (and
`config.focus`) to trade every market again.

## Gold M30 → M1 (3 Nov)

Gold also reads M30 candles and trades a fifth main setup, `m30m1` (M30 Origin, M1 CF, the engine's normal rules), filtered
to trades against D1 (user rule `gold-m30`). The trader's 3 Nov markups (BO BUY 3,916 and the 3,891.5–3,916.1 box) are M30
structure. On the 150-day replay it was the one new gold setup positive in both halves (+0.13R / +0.20R a trade against
D1; portfolio +12R → +33R), but concentrated in a few big winners.

## NQ New York open sweep (research, paper only, 3 Nov)

The trader's NQ rule: wait for the 9:30 New York open, let price take liquidity, then trade the other way, target 1.2R.
Built as: after 9:30 ET, NQ (Yahoo NQ=F, 1-minute) trades through the overnight (18:00–9:30 ET), previous-day (9:30–16:00)
or pre-market (8:00–9:30) high or low; the first 1-minute candle in the first hour that closes back inside that level,
in the reversal's direction, is the signal. Market entry at its close, stop 2 points past the sweep's extreme, target 1.2R,
out at 16:00, one trade a day. Yahoo delays these candles by 10 minutes, so the trader sees each signal late and records it at the signal candle's close (paper, as on the backtest). Kept in research.json (`k: 'nq-open'`), totals in snapshot.research.nq.
History: about break-even (5-minute, 50 days: +0.02R a trade over 36; 1-minute, 21 days: −0.06R over 15); waiting for an
M5/M1 CHoCH after the sweep, or keeping only one kind of level, splits the halves (positive in one, negative in the other).
It goes live only if the forward record pays.

## NQ Tokyo and Shanghai open sweeps (research, paper only, 4 Nov)

The same rule at the Asian opens: Tokyo 00:00 UTC and Shanghai 01:30 UTC. Liquidity = the previous New York session's high/low,
the evening high/low since the 18:00 ET reopen and the high/low of the hour before the open; the first 1-minute close back inside a
swept level in the first hour → the other way, stop 2 points past the extreme, 1.2R, out at 07:00 UTC. One trade per session a
day, in research.json (`k: 'nq-open'`, `session: 'tokyo' | 'shanghai'`), totals in snapshot.research.nq_tokyo / nq_shanghai.
History: Tokyo −0.19R a trade on 50 days of 5-minute candles, +0.29R on the last 21 days of 1-minute; Shanghai about break-even
to negative; 2-month replay Tokyo −1.35R over 25, Shanghai −0.73R over 20. Paper only until the forward record pays.

## Gold replica exit: trailing stop (4 Nov)

Live replica trades no longer take a fixed 2R: once the trade is +1.5R the stop follows 1R behind the best price (`trail: [1.5, 1]`),
capped at 10R and out after 48 h; a stop hit after the trail moved is a `trailing stop` exit at its real R. Year replay of v5:
fixed 2R +74.8R (Jan–Jun +0.08R / Jun–Nov +0.22R a trade); trailing +98.7R (+0.17R / +0.23R), 9 of 11 months positive. Every nearby
setting (start +1 to +2.5R, trail 0.75 to 1.5R) beat 2R on January–June; on v4's 1,020 trades it lifts the year from +81.5R to +149R.

## Gold replica v5: only against the H4 trend (4 Nov)

Live replica trades now also need the H4 trend (Mosha N=6) to run against the trade; v4-passing signals with the H4 trend stay
in research.json (`v5: false`, `h4`). Year replay with the Trader's own code on Binance PAXG 1m (1 Jan – 3 Nov): v4 +81.5R over
1,020 trades with January–May −11.2R; v5 +74.8R over 500 with January–May +26.2R, 9 of 11 months positive, worst drawdown −23.6R
(v4 −29.9R). The H4 split was logged as a candidate on June–November data before January–May was downloaded, so those months are
its out-of-sample test. October was v5's bad month (−19.3R).

## Gold replica live (3 Nov, 22:00)

User rule `replica-live` (`config.replicaLive = ['xau']`, take-all off): gold trades the replica live. Every passing v4
signal (clear of live H1 Origins or a ★ engulfing at the extreme, stop at least one M15 ATR) goes on the live book as
`k: 'replica'`: market entry, stop past the extreme, target 2R, out after 48 h (`maxHold`), no break-even move, no slot
limit (as on the replay). The research record in research.json keeps every signal, passing or not. The engine's gold
setups run as shadow trades with `replica` in blockedBy (their other blockers still recorded, so "the rules would take
it" stays measurable). Why: on the 150-day replay the replica made +0.19R / +0.13R a trade in the two halves with no losing
month, while the engine's gold setups lose about 0.2R a trade with every signal taken. Check after about 30 live trades;
to go back, remove `replicaLive` from config.json.

## Gold replica (research, paper only, 3 Nov)

Rebuilt from the trader's four marked gold trades (2–3 Nov, `council/examples.json`): a leg of at least 2 M15 ATRs in the
last 3 h or 6 h, then an M5 close (1-candle swings) back through the last swing against the leg (the CHoCH). Limit entry at
the 30% retest from the CHoCH level toward the extreme (valid 4 h), stop just past the extreme, target the leg's start, out
after 48 h. On the cleaned 150-day gold replay it fires on all four of his trades (3 of 4 win on his days, the 4th never
fills) but is about break-even overall (−15R / +3R over 762 trades), so it runs on paper in `research.json` (gold only),
reported in `snapshot.json` → `research.replica`, to compare with his trades day by day and learn which turns he takes.

**Replica v2 (3 Nov, later):** market entry at the M5 CHoCH, stop past the extreme, target 2R. Every signal is recorded with
`h1clear` (entry outside every live H1 Origin), `eg` (an M5 engulfing at the extreme) and `pass` = either of them; the
snapshot reports `research.replica.pass` and `.all`. On the 150-day gold replay the passing signals made +0.075R a trade
on the first 100 days (593) and +0.077R on the last 50 (352), keeping all four of the trader's trades; all signals +0.035 / +0.000.

**Replica v3 (3 Nov, later):** the engulfing check is now the gold platform's own (`detectEngulfings` in gold-trading.html:
body ≥ the 20-candle average and > the engulfed body, 15% tolerance) on M5 and M15 at the extreme, with its ★ = the
engulfing's mid within 0.12% of PDH/PDL, the Asia high/low or a $50/$100 level. On the 150-day gold replay (market entry,
2R) ★ signals made +0.31R a trade on the first 100 days (163, t 3.3) and +0.16R on the last 50 (104); every full month
positive (+3, +20, +17, +14, +18R), +58R without the top 5, both sides and every session positive. `pass` = clear of H1
Origins or ★ (+0.14R / +0.07R, keeps all four of the trader's trades); the snapshot also reports `research.replica.star`.

**Replica v4 (3 Nov, night):** `pass` also needs a stop of at least one M15 ATR (`riskAtr`). Stops tighter than that lost
on the replay (−0.04R / −0.13R a trade). Clear of H1 or ★, with stop ≥ 1 ATR: +0.188R a trade on the first 100 days (319,
t 2.9) and +0.125R on the last 50 (208, t 1.9), no losing month, keeps all four of the trader's trades; on 3 Nov it would
have taken 5 of the 8 signals for +0.4R instead of −2.9R. Range location and room-to-target were tested and rejected.

## Live hygiene (4 Nov)

- **Latency guard:** gold replica entries more than 8 min after the CHoCH candle closes are skipped (`stale` in research.json); every record stores `lag`. Year replay of v5 + trailing + 0.30 spread: on time +0.20R a trade, 4–5 min late +0.19R (+0.16R with 0.2 slippage), 10 min +0.14R; a limit entry back at the signal close was worse (+0.08R).
- **Method test:** the replica runs unchanged on every market as research (paper, 2R, no spread, 0.1 ATR stop buffer off gold); `snapshot.research.replicaX` sums the v5 signals per market. Only gold trades it live.
- **Retired older strategies:** live trades left from the engine setups close at market (`exit: 'retired'`); they keep running as shadows.
- **NQ Shanghai dropped** (negative on every test); Tokyo and New York stay on paper.
- **Phone alerts:** ntfy.sh topic `mosha-council-d200fdc484` (or the `NTFY_TOPIC` secret) gets a push when a live trade or an NQ paper trade opens or closes.

## NQ London sweep before New York (paper, 4 Nov)

From the trader's 4 Nov NQ chart (v2: buys only, sweeps of the London low; 5-minute history buys +0.47R a trade over 27, sells −0.20R over 22): the London range is 02:00–05:00 ET. Between 05:00 and 09:25 ET, the first 1-minute close back inside after a sweep of the London low (high) is a buy (sell); stop 2 points past the extreme, 2R, out at 11:00 ET. Recorded in research.json (k `nq-open`, session `london`, `nq-london-<day>`). History has no reliable edge yet (5-minute, 44 days: +0.21R a trade, t 0.9), so it is paper only. NQ wins now score their real R (the London target is 2R, not 1.2R).

## NQ swing sweep before New York (paper, 4 Nov)

The trader's own rule ("either a sweep of a low or a high"): M15 swing points of the day (2 candles each side); between 05:00 and 09:25 ET, a sweep of one and a 1-minute close back past it within 15 min, the candle the trade's way → the reversal; stop 2 points past the extreme, 2R, out at 11:00 ET. On 4 Nov it finds the trader's buy (swing low 28,308.5 swept at 07:55, buy 28,323 at 08:02, 2R). History: 1-minute (17 days) +0.46R a trade over 20; 5-minute replay (44 days) −0.11R, so paper only. Records `nq-swing-<day>`.

## NQ open sweeps before New York (paper, 4 Nov)

The trader: "NQ works mostly by sweeping the opens and trading the opposite way." The opening price of the midnight (00:00 ET), London (03:00) and 08:30 opens; within 90 min of each, price runs ≥ 15 points through it and a 1-minute close comes back across within 15 min of the first cross → the other way; stop 2 points past the extreme, 2R, out at 11:00 ET, one trade at a time. Records `nq-opens-<day>-<minute>`, session `opens`.

Tested on 1-minute NQ (Yahoo NQ=F + CNBC @ND.1, 11 Sep – 4 Nov, 39 days; both feeds gave identical signals where they overlap): 38 trades, +15.3R, +0.40R a trade (t 1.7), September +11.7R and October +3.6R, buys +4.7R and sells +10.6R. Across all 10 open setups tested (open price and prior-range sweeps at midnight, 02:00, 03:00, 08:30, 09:30), shallow sweeps lose (−0.20R a trade over 282 with no depth rule) and the edge peaks at 15–20 points. New York 09:30 open sweeps lose (−0.45R a trade over 27: they tend to run). The New York exclusion and the 15-point depth were picked on this data, so it is paper only until it holds forward.

## NQ focus (4 Nov, evening)

Same 1-minute history for every NQ setup (Yahoo NQ=F + CNBC @ND.1, 11 Sep – 4 Nov): New York open run +0.73R a trade (27), open sweeps before New York +0.40R (38), London low sweep +0.23R (19), swing sweep +0.15R (38, September −4.6R), New York open sweep (reversal) 0.00R (26), Tokyo −0.14R (30). Only the first two run (`NQ_ON` in trader.mjs); the calendar counts only them (`NQ_SYS` in the page).

**New York open run:** the open-sweep signal at the 09:30 opening price (≥ 15 points through it, 1-minute close back across within 15 min), traded with the sweep: at New York the reclaim fails and the move runs (the reversal version loses −0.45R a trade). Stop the same distance on the other side, 2R, out at 11:00 ET. 27 trades +19.8R, 67% wins, t 2.8, September +4.9R and October +14.9R; every depth 0–30 points and reclaim window 5–30 min positive. Records `nq-nyflip-<day>`.

*5 Nov:* the run threshold and stop buffer are now fractions of the opening price, 0.08% and 0.011% (≈20 and ≈2.8 points at
25,000), the values the 8-year backtest used. The fixed 15 points had drifted to 0.06% as NQ rose; across thresholds 0.06–0.10%
the live rule makes +0.11 to +0.14R a trade (0.06%: +0.005R in 2018–22; 0.08%: +0.017R; 0.10%: +0.047R).

Losing open-sweep trades: 7 of 20 were +1R before reversing, but break-even, partials and trailing all scored below the plain 2R; trades on the side of the 18:00 ET daily open did better (+0.67R vs +0.25R) but the other side flipped sign between months, so no filter.

## Gold: the NQ open rules carried over (research, 4 Nov)

The NQ open-sweep rules tested on gold unchanged (1-minute, 22 Dec – 3 Nov, 227 days, 0.30 spread; depth scaled to price, 15 NQ points ≈ 0.054%): pre-New York open reversals −0.12R a trade over 301 (3 of 12 months positive), so they do not carry over. The New York open run does, weakly: 143 trades +18.1R, +0.13R a trade, 7 of 11 months positive, but January–June +19.6R and June–November −1.5R; every depth (0–0.12%) and reclaim window (5–30 min) positive. It runs as research on paper (`k: 'gold-nyrun'`, `snapshot.research.goldNyrun`), next to the replica; it does not trade live.

## Gold replica: round-number stops (4 Nov)

From the trader's XAUUSD price-action PDF (a ChatGPT synthesis citing the New York Fed stop-cluster studies): stops cluster just beyond round prices and price runs to them. A replica stop sitting within $2 in front of a $10 level now moves to $0.50 past it (`stop0` keeps the original; the entry filter still judges `stop0`, so the trades taken are unchanged). Year replay of v5 + trailing with the 4-minute entry lag: the 76 trades it changes gain +16.7R (+0.22R each, paired t 1.8), both halves positive; every $10 setting tested gains, $5 levels gain less and fade past a $2 window. The PDF's other testable ideas did not help: a wick-sized buffer (+0.190R vs +0.197R) and its M15 direction gate (keeps 87 of 500 trades, −77R).

## NQ: three-year out-of-sample test (4 Nov, night)

The trader's NQ futures file (1-minute, 27 Dec 2022 – 11 Dec 2025, 763 full days; timestamps are candle closes, shifted back a minute) tested both live NQ rules unchanged:
- **New York open run:** 447 trades +62.3R, +0.14R a trade (t 2.15), 42% wins; 2023 +35.9R, 2024 +7.6R, 2025 +19.4R; 24 of 37 months positive; buys +25.9R, sells +36.3R. **Kept** (paper).
- **Open sweeps before New York:** 352 trades −22.4R (−0.06R), 2023 −11.3R, 2024 +4.8R, 2025 −15.9R; London −17.6R, 08:30 −8.4R, midnight +3.6R. **Switched off.**
The calendar's NQ replay now runs from Dec 2022 (this file to 11 Dec 2025, Dukascopy cash index 12 Dec – 8 Mar, Yahoo + CNBC futures from 11 Sep).

## NQ New York open run: midnight-open filter (4 Nov, night)

From the trader's NQ research report ("the New Day Open should be the next logical target"): the New York open run trades only when the 00:00 ET opening price lies ahead of the trade. 3-year futures file: ahead +0.22R a trade over 237 (t 2.4, every year positive), behind +0.05R over 210 (2024 negative). Outside the file (Dukascopy Dec–Mar, futures Sep–Nov 2026): ahead +0.68R over 29, behind +0.19R over 32. The report's other checks: a next-minute fill gives the same +0.14R (no fill sensitivity); every target 1R–3R is positive (2R kept); its prior-RTH high/low sweep fade scored −0.04R over 309 on the same file.

## NQ is the system; gold is research (4 Nov, night)

With the trader's agreement: on 8 years of HistData spot gold (2019–2026) the gold replica lost every year 2019–2025 (−312.5R over 4,484 trades; gross ≈ 0 before the spread) and only 2026 was positive; DXY filters, session windows and Asian-range sweeps added nothing. User rule `gold-shadow`: no gold or engine setup opens live paper trades (`replicaLive: []`, `focus: ['none']`); replica signals keep recording in research.json. The page's "our system" is the NQ New York open run (forward records + replay since Dec 2022), shown in its own Council card; the calendar opens on NQ; the gold card is labelled research.

### Gold volatility gate (4 Nov, user rule `gold-vol-gate`)

The gold replica trades live again, but only while gold's 20-day average daily range (last 20 closed daily bars) is at least
1.5% of price (`config.goldVolMin`). Below that, signals are recorded as research with `calm: true`. Every replica research
record carries `vol`; the snapshot carries `goldVol` / `goldVolMin` and the gold card shows them.

Why: on 8 years of spot gold (HistData) the replica's per-trade result rises with volatility — bottom fifth −0.21R a trade
(negative in 6 of 7 years), top fifth +0.05R (positive in 6 of 8 years). With the risk rules and a 1.5% gate, 2019–2025
make +18.9R instead of −312.5R, and 2026 makes +43.2R. 2026 is the most volatile gold year in the sample (2.2% vs 0.9–1.5%),
which is why the replica looked good this year. NQ stays the main system.

News-day check on the NQ New York open run (3-year futures file): no filter adopted — 08:30 release mornings and overnight-range
splits change sign between samples; FOMC days were weak (7 live-rule trades, −4.9R) but too few to act on.

### Telegram alerts (4 Nov)

The same trade alerts as ntfy (opens and closes from the last 15 min, each once) also go to Telegram when the repository
secret `TELEGRAM_BOT_TOKEN` is set (create a bot with @BotFather). `TELEGRAM_CHAT_ID` is optional: without it the Trader
reads the bot's updates, uses the first private chat that messaged the bot (send it /start), remembers it in
`state.tgChat` and sends a one-time "connected" message. Send errors land in `snapshot.errors.telegram`.

### Gold replica exit v2 (4 Nov, night)

New live replica trades trail from +2R, 2R behind the best price (was +1.5R / 1R); cap 10R and 48 h unchanged. 8-year spot
gold with the 1.5% volatility gate and the risk rules: 2019-22 +13.8R → +44.8R, 2023-26 +47.3R → +87.4R. Every wider
setting tested beat the old one in both halves. Also tested and rejected the same night: a 15-minute trigger (no better
agreement between feeds), dropping the H1/★ filter, and the NQ-style New York open run on gold (−177R over 8 years of spot).

### Gold: daily-trend rule, judged on the last 4 years (4 Nov, night; user rule `gold-d1-with`)

At the owner's request gold is now judged on 2023-2026 only. Live replica trades must be in the daily trend direction
(still against the H4 trend, i.e. a pullback entry); others are research with `d1Skip: true`. 2023-26 spot, 1.5% gate,
exit v2, risk rules: 602 trades +87.4R, drawdown −35.2R → 325 trades +63.8R, drawdown −15.8R. Chosen on 2023-24
(+8.1R vs −22.2R), held on 2025-26 (+55.7R). In 2019-22 the opposite split held, so this is a last-4-years rule.
Also checked on 2023-26: gate 1.5% kept (2023-24 has few gated trades), trading with the H4 trend loses (−52.7R),
exit v2 kept (3R trails win 2025-26 but lose more in 2023-24), buys-only rejected (a bet on gold's direction).

### Gold: H1 engulfing barriers (4 Nov, night; user rule `gold-eg-barrier`)

The owner: Mosha's edge is market structure plus barriers (EG / OB). Tested on 2023-2026 spot gold, rules fixed first:
a barrier model (fresh H1 OB or EG, touch, M5 CHoCH), a pure-structure model (H1 BOS trend, M15 pullback CHoCH) and the
replica split by barrier. Pure structure lost (−16R to −246R by exit/gate); barrier-only lost overall, OB clearly; EG with
gate + trailing +37.6R (both halves positive). The replica's signals whose extreme sits at a live H1 EG: +0.293R a trade
over 151 (both halves positive), at an OB −0.124R. Live gold now: v5 + 1.5% gate + (daily trend direction OR extreme at a
live H1 EG) → 392 trades +71.9R, drawdown −15.8R (was D1-with alone 325, +63.8R). `h1EgZones()` in the trader matches the
research zones exactly on three 2026 checkpoints; research records carry `atEG`. Mosha's 2 Nov sell started inside a fresh
H1 bearish EG (3,914.8-3,927.7, formed 03:00 UTC).

### Mosha BO system (4 Nov, night; user rule `mosha-bo`)

From the owner's screenshots of Mosha's posts ("All you need is this Breakout System": BO sell → BO buy → BO sell →
pullback entry, one timeframe lower each step). Live paper trades (k `mosha-bo`, gold only): H4 BO in a direction, then the
last H1 BO the other way after it, then a fresh M15 BO back in the H4 direction that flips M15 structure (closed candles
only) → limit at the broken M15 level, stop $0.30 past the M15 Origin, target 3R, valid 24 h (`validFor`), out after 72 h,
max 2 open. Exempt from the legacy retirement. Research (spot gold, engine events causal, limit with the trader's own
"missed" rule): H4→H1→M15 2019-22 +7.5R / 104 (2R +11.5R), 2023-26 +15.1R / 114; H4→H1→M30 positive both periods (smaller);
D1→H4→H1 flat; H1→M15→M5 −61R and H1→M30→M15 −16R (not used).

**Weekly structure filter (4 Nov, late; user rule `mosha-bo-weekly`).** From Mosha's multi-timeframe slides (father / mother /
son). The system now trades only in the direction of the weekly structure, and the M15 BO no longer has to flip M15 structure.
Weekly = Monday-aligned weeks built from the last 720 days of spot gold daily candles (CNBC `XAU=`), swing size 3, the
direction of the last weekly BO on a closed week (`snapshot.goldW1`, source in `snapshot.goldW1Src`). PAXG daily candles are
the fallback only: PAXG's premium over spot drifts over months, so its weekly swings break elsewhere (3 Nov: spot closed the
week of 26 Oct through the weekly low at 3,886, PAXG did not), while CNBC matched the HistData spot weeks in 95 of 95 weeks
since January 2025. Research (spot 2019-26, H4→H1→M15, limit at the broken level, 3R, weekly read from the same 720-day
window): weekly agrees 2019-22 +32.2R / 87 (+0.37R a trade), 2023-26 +34.2R / 99 (+0.35R), 7 of 8 years positive, worst
drawdown −18.4R; weekly against −28.3R / −15.8R; old flip-only rule +7.5R / +15.1R. Daily-trend agreement points the same
way (+0.20R / +0.19R). Caveat: the weekly filter did not help the other chains (H4→H1→M30, H1→M15→M5, …), and swing size 3
on the same chain lost, so this is one good cell in a grid. The kill switch watches it.

**Out-of-sample check (4 Nov, late) — the weekly rule did not hold.** The identical rule (H4→H1→M15, swing 6, weekly
agrees, limit at the broken level, 3R; market-sized spread and stop buffer) on HistData 1m 2019-26: silver −48.9R / +22.8R,
EUR/USD −29.7R / −14.2R, GBP/USD −29.7R / +4.7R, USD/JPY −1.5R / −56.9R, Nasdaq +14.7R / −16.5R, S&P −45.8R / −19.3R
(2019-22 / 2023-26). Placebo on gold (weekly direction shifted in time, 400 shifts): only 3% beat the real +59.4R, but the
cell was picked from ~80. Also tested from the Private Room Notes PDF, all without a consistent edge: "50% of the range"
(retracement depth), QM-style VR/CF, Janda (BO structure → BO → pullback), the barrier formula (D→H1, H4→M15, H1→M5 with
the weekly direction), and a "50% of the range" structure engine (pullbacks must retrace half the visible leg). So the Mosha
BO system runs on paper as a forward test with an expectation near zero; the kill switch applies as before.

### Pairs join the council (5 Nov; user rule `pairs-live`)

Owner: "include gold and the other pairs in council". Every market (gold, the five forex pairs, BTC, ETH, SOL, XRP) now
trades the replica live on paper with gold's rules (v5, daily trend or H1 engulfing barrier, trail from +2R 2R behind, cap
10R, 48 h; max 3 open per market, −1.5R daily stop). Gold keeps its 1.5% volatility gate; a pair trades only while its 20-day
range is in the top fifth of its own last 365 daily candles (`config.pairVolPct` 80; `snapshot.pairs[key]` shows vol, gate,
on/off, forward trades and R). Kill switch: a pair stops trading live once its forward replica total reaches −10R
(`config.pairStopR`), its signals stay research. Mosha BO stays gold-only (its weekly read is a spot-gold feed, and the rule
lost on six other markets).

Also fixed: replica research and live records rounded prices to 2 decimals, so forex research trades (1.12288 → 1.12) were
meaningless; prices now round to the market's decimals + 1, and the H1 engulfing-barrier tolerance is $1 on gold, 0.1 M15 ATR
elsewhere.

Replay with these rules, 2023 - Oct 2026 (after spread; forex HistData 1m, crypto Binance 5m):
EUR/USD −15.5R (128 trades), GBP/USD −31.2R (123), AUD/USD −25.4R (142), USD/CAD −22.6R (115), USD/CHF −37.5R (106),
BTC −46.2R (271), ETH +1.9R (293), SOL +10.5R (133), XRP +4.3R (156): pairs together −161.7R over 1,467 trades. In 2019-22 the
forex pairs were also negative except EUR/USD (+53R). Gold in the same harness: +86R over 377 (2023-26). These records are in
`research/replay-2w.json`, so the site's "our system" total includes what the pairs cost.

### Pairs: best settings (5 Nov; user rule `pairs-best`)

Owner: "check the best settings and edge for the other pairs, not NQ and gold". Walk-forward only (settings picked on
2019-22 forex / 2022-23 crypto, judged on 2023-26 / 2024-26; daily systems on 2018-21 vs 2022-26):
- **Replica**, ~11,000 settings per pair (filter, stop size, H4/D1 direction, own-history volatility high/low, EG barrier,
  session, 7 exits): the 20 best on the early years lost in the later years on 7 of 9 pairs; only 7-21% of all settings
  were positive later. No edge. Kraken crypto fees (~0.25-0.4% a side) make the intraday crypto replica worse still.
- **Asia range** (00:00-07:00 UTC) breakouts and fades at London, **open sweeps** at 07:00 and 13:00 UTC (with / fade):
  negative after costs on forex and crypto (one tiny positive cell, 55 trades).
- **Daily trend-following**: forex lost in 2023-26 on all 5 pairs (Donchian 20/55/100, 4 ATR, MA 20/100, 50/200).
  Crypto (Binance daily 2017-2026, 10 coins, 0.8% round trip) held: chosen on 2018-21, the 55-day breakout long-only with
  a 4 ATR trail made +1.05R a trade, then +0.30R in 2022-26 with 8 of 10 coins positive (100-day: +0.42R, 9 of 10).
  Tight 2 ATR trails lose on every coin. Council coins 2022-26: BTC +0.50R (13 trades), ETH +0.39R (13), SOL +0.74R (13),
  XRP +1.29R (10), worst drawdown 2-4R. 2022 (bear market) was negative.

Live from now (paper): **crypto trend** on BTC, ETH, SOL, XRP (k `trend`): buy the first run after a daily close above the
prior 55 daily highs, stop 4 ATR(20) below; after each daily close the stop rises to 4 ATR under the best close; out on a
daily close under the prior 27 daily lows; one trade per coin; a coin stops at −8R forward (`snapshot.trend[key]`).
**Forex is research only** (replica signals still recorded) and the crypto replica stops trading live
(`config.replicaLive = ['xau']`). The replay file now counts crypto trend 2023 - Oct 2026 (44 trades, +37.0R) instead of
the pairs' replica records.

### NQ opening-4H standard-deviation trackers (5 Nov; research, paper)

From the owner's indicator ("NQ Opening 4H Candle High/Low"): the CME day's first 4H candle (18:00-22:00 ET) and SD levels
H + k·range / L − k·range. Two research records (`research.json`, k `nq-open`, sessions `sd2ifvg` and `sd3mom`), not counted
in our system, to build a forward record:
- `sd2ifvg`: at the 2 SD line a 1-minute IFVG (an FVG of the push inverted by a close through it, within 60 min) → fade;
  stop 1 pt past the extreme; target 1 SD back; out 16:00 ET. Backtest +0.04 to +0.16R a trade, not significant.
- `sd3mom`: at 3 SD → with the move; stop 0.25 range; target 4 SD; out 16:00 ET. Backtest +0.19 to +0.41R a trade
  (t 1.6-2.5), chosen after seeing the data. Judge both after ~60 forward trades.
The NQ fetch now also runs 22:00-24:00 ET (Sun-Thu) for these.

**Crypto trend v2 (5 Nov, loop).** Two slots per coin: the 55-day breakout (out under the 27-day low) and the 100-day breakout
(out under the 50-day low), both with a 5 ATR(20) trail from the best close (was 4 ATR, 55-day only). Walk-forward on Binance
daily 2018-21 → 2022-26, 10 coins, 0.8% costs: 5 ATR was the best of 3.5/4/5/6 on 2018-21 and held (+0.40R vs +0.30R a trade);
55 + 100 together +96.5R over 186 (+0.52R); council coins +52.3R over 70 (+0.75R), worst drawdown −7.9R (4 ATR 55-day: +34.1R).
A BTC-above-200-day filter helped 2022-26 slightly but not 2018-21, so it is not used. Trades carry `sys` (55/100) and `kATR`.

**Record everything (5 Nov, owner).** Signals that fit a system but are skipped by one of its filters are now recorded too, outside
our system: the NQ New York open run when the midnight open lies behind (research session `nyflip-x`), and Mosha BO chains that
fail the weekly filter, the 2-open cap or the price check (shadow trades with `blockedBy` weekly / cap / price). The gold replica
and forex/crypto replica signals were already recorded as research.

## NQ 80% rule tracker (5 Nov, research only, paper)

From the owner's video ("Worlds BEST NQ Scalper Reveals His A+ Trading Strategy", auction market theory). Yesterday's value
area is 70% of its 09:30–16:00 ET time-at-price (2-point bins grown from the POC). When NQ opens outside it and then makes 30
consecutive 1-minute closes back inside before 12:00 ET, the trader records a paper trade toward the far edge, stop 0.03% past
the extreme since the open, out at 16:00 ET. Research session `80pct` (k `nq-open`), id `nq-80pct-<day>`; summary in
`snapshot.research.nq_80pct` (the summary now also lists `nyflip-x`, `sd2ifvg`, `sd3mom`). Nasdaq cash 2018–22 +0.04R (153
trades), 2023–26 +0.05R (106), about 30 a year: weak (t ~1). Corrected 5 Nov: the first backtest dropped trades still open at
16:00 and showed +0.10R / +0.12R. Kept as a cheap paper tracker, not a candidate for live trading on this evidence.


## Crypto trend v3 exit (5 Nov)

New crypto trend trades exit on a daily close under the ratcheting midpoint of their own N-day channel (55 or 100 days), the
exit from Zarattini, Pagani & Barbon (2025). The 5 ATR stop stays as a fixed catastrophe stop and no longer trails. Trades opened
before this change keep the old exit (`exitRule` unset). Daily-equity test on BTC/ETH/SOL/XRP, 0.8% round trip, equal notional
(`lab/crypto_ens2.py`): Sharpe 2018–21 1.67 vs 1.50, 2022–26 0.81 vs 0.58; worst drawdown −28% vs −39% and −21% vs −27%. A
7-lookback ensemble (20–360 days) and volatility-target sizing did not beat this in 2022–26 (vol targeting only cuts drawdown).
`snapshot.trend[key].midStop` shows the current exit level.

## Gold adaptive volatility gate (5 Nov, user rule `gold-adaptive-gate`)

The gold replica now trades live when the 20-day average daily range is ≥ 1.5% **or** in the top fifth (`config.goldVolPct` 80)
of gold's own 20-day ranges over the last 365 daily candles (`snapshot.goldVolP`). Live config, trail exit, spot gold:
1.5% only +0.093R (214 trades, 2019–22) / +0.164R (443, 2023–26); 1.5% or top fifth +0.104R (341) / +0.192R (513).
Tested at the same time and **not** adopted: tighter stops (0.5–0.85× the current distance lost expectancy in both halves:
45% of trades that reached +2R first went more than half-way to the stop) and fixed 2/2.5/3/3.5/4R targets (4R +0.08 / +0.19R
≈ the current trail +0.09 / +0.16R).

## Gold replica fixed 4R target (5 Nov, user rule `gold-4r`)

Owner: judge gold on the last 2–3 years. The replica now takes a fixed 4R target (stop unchanged, out after 48 h) instead of
trailing 2R behind from +2R. Replay with the live risk rules, spot gold: 2025–26 +84.7R vs +64.2R with the trail; 2023–26
+102.7R (439 trades) vs +95.2R (456); but 2024 +25.6R vs +37.4R, 2026 +29.9R vs +32.8R, and the worst drawdown −24.7R vs
−15.8R. To revert, drop `gold-4r` from `config.userRules` and unset `config.goldFixedR`.

## Gold replica: engulfing-barrier exception off (5 Nov, user rule `gold-no-eg`)

With the 4R exit, trades against the daily trend taken from an H1 engulfing barrier lose in every year 2023–26 (−15R over 82),
while daily-trend trades make +0.42R / +0.25R a trade (2023–24 / 2025–26). `config.goldEgBarrier` is now false; the gold
replica trades only with the daily trend. `atEG` is still recorded on every signal for research.

## Gold replica: top-fifth gate and breakeven at +2R (5 Nov, user rule `gold-top-be`)

Owner: more profit, less drawdown, judged on 2023 onwards. The gate is now the percentile leg only (`goldVolMin` null,
`goldVolPct` 80): live while gold's 20-day range is in the top fifth of its own last year. Trades at ≥1.5% but below that made
+0.02R a trade (168, 2025–26); top-fifth trades +0.40R in both halves. Once a trade reaches +2R its stop moves to the entry
(`beAt` on the trade). With the live risk rules: current gate +111R / worst drawdown −25.1R (ratio 4.4) → top fifth only
+88R / −14.8R (6.0) → top fifth + breakeven +93R / −11.7R (7.9), better in both halves (2023–24 +37.9R vs +34.0R, 2025–26
+55.0R vs +54.4R). At equal drawdown the new rule earns about 80% more.

## Gold replica: pyramid add at +2R and runner after +4R (5 Nov, user rule `gold-add`)

Owner: scale on profitable running trades and catch more of the move. When a gold replica trade reaches +2R (the same bar
that moves its stop to breakeven), a second unit opens at that level (`<id>-add`, `addOf`), stop at the first entry, so its
2R-wide stop counts as 2R of risk (`size` 2 scales its R). After the first trade's +4R the whole position trails 1R behind the
best price (parent `trail [4, 1]`, add `[1, 0.5]` in its own R), cap 10R, instead of exiting at 4R. Adds do not count toward
the max-3-open cap; their losses count toward the −1.5R daily stop. Spot gold 2023–26 with the live rules: base +93.0R /
worst drawdown −11.7R (ratio 7.9) → add + runner +185.9R / −17.6R (10.6), better in both halves and every year. The gold
history in `research/replay-2w.json` records one combined R per signal.

## NQ New York open run: 1R runner after +2R (5 Nov, user rule `nq-runner`)

After +2R the research record's stop trails 1R behind the best price (`trail [2, 1]`, `tp1` keeps the 2R mark, `t1` is a
10R cap) instead of exiting at 2R; the 11:00 ET exit stays. Nasdaq cash 1m 2018–Oct 2026, live rule: fixed 2R +7.4R
(2018–22, worst drawdown −23.4R) / +76.9R (2023–26, −7.7R); runner +21.1R (−19.3R) / +93.7R (−7.9R). Adds at +1R were
rejected (2018–22 −17R, drawdown −52R). The NQ history in `research/replay-2w.json` is rebuilt on the runner.

## Mosha BO: breakeven, add at +1.5R and runner after +3R (5 Nov, user rule `mosha-add`)

Same mechanism as the gold replica add (`beAt`, `addAt`/`addSize`, `trail`): at +1.5R the stop moves to the entry and a second
unit opens (`<id>-add`, k `mosha-bo`, `addOf`), stop at the first entry, counted as 1.5R of risk (`size` 1.5); after +3R both
trail 1R behind the best price (parent `trail [3, 1]`, add `[1, 0.667]`), cap 10R; `tp1` keeps the 3R mark. Spot gold 2023–26
(`lab/bo_lever.mjs`, 101 fills): fixed 3R +6.3R / +21.0R (2023–24 / 2025–26), drawdown −18.4R → add + runner +8.8R /
+35.3R, −20.3R. The add block in the management loop now carries the parent's `k` and name, so it serves any system.

## Gold replica: US data-window veto (5 Nov, user rule `gold-news-veto`)

No new gold replica entry between 08:25 and 08:45 ET on weekdays (`config.goldNewsVeto`, minutes of the New York day);
the signal is still recorded as research with `news: true`. 2023–26 the 5 signals inside that window all lost (−5.2R);
with the live rules the veto makes +95.7R vs +93.0R, same drawdown. Open trades and adds are not affected.

## Crypto trend: one add at +1R (5 Nov, user rule `crypto-add`)

Owner: "we are leaving money on the table in crypto, try scaling". On Binance daily candles 2018–26 (0.8% costs, R on the
first unit's 5 ATR risk) the live midpoint exit keeps about 45% of each trade's best excursion, and every other exit tested
(10- and 20-day lows, 3 and 4 ATR trails, half off at +1R or +2R) keeps less: the giveback is the price of the big winners.
Scaling in does add: when a daily close is +1R (5 ATR) above the entry, a second unit buys at market with its own 5 ATR
(at entry) catastrophe stop and leaves with the first trade on the midpoint close (`config.cryptoAdd = { atR: 1, size: 1 }`,
record `<id>-add`, `addOf`). Council coins 2023–26: +103.6R vs +61.6R, worst drawdown −6.7R vs −5.5R (ratio 15.5 vs 11.3);
2023–24 +108.9R vs +62.1R at the same −5.5R; 2025–26 −5.3R vs −0.5R (flat period). The six other coins: +169.9R vs +106.2R,
ratio 8.9 vs 6.3. Adds at +0.5R, +1.5R, +2R, two adds, and turtle pyramids raise drawdown faster than profit.
Sizing guide: 0.5% on the first unit, 0.5% on the add. The add counts toward the crypto kill switch like any other trade.

## Gold trend (5 Nov, user rule `gold-trend`)

From the owner's "OmniBook" cBot: its daily breakout was the one gold edge that held on 8 years of spot gold 1m. Rule
(`config.goldTrend = { n: 20, k: 2 }`, records `k: 'gtrend'`): a closed daily candle above the prior 20 daily highs buys
gold at market on the next run (within a day of that close); stop 2 × ATR(D1,14) below the entry; on every newly closed
day the stop is lifted to (daily close − 2 ATR) and never lowered; no target, no time limit, one position at a time.
Spot gold 2019–22 | 2023–24 | 2025–26: +0.31 | +1.07 | +2.42R a trade (n29/12/10), worst drawdown −4.4 | −1.4 | −0.9R;
N10, N55 and a 3 ATR trail are positive in every period too; the mirrored short loses in every period, so long only.
About 6 trades a year, half of them winners, best +13R, worst −1.02R. Sizing guide 0.5% per trade. `snapshot.goldTrend`
shows the 20-day high, the last close and the open position's stop.

## Gold H4 trendline (6 Nov, user rule `gold-h4-trendline`)

Owner's request to find the best SOP timeframe for a trendline break, judged on 2023 onwards. Rule
(`config.goldTL = { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 }`, records `k: 'gtl'`): on closed H4 candles, the falling
line through the last two confirmed pivot highs (half-width 3 bars, at most 120 bars apart); a close above the line, while
the H4 direction SOP (Malaysian SnR: H4 external breakout after a tapped Daily level, pivot width 2) reads up, buys gold at
market on the next run (within an hour of that H4 close); stop 0.3 under the lowest low since the second anchor; after +2R
the stop trails 1R behind the best price (cap 10R); out after 96 h; one trade per line, one position, buys only.
Spot gold 2023–24 | 2025–26: +0.44 | +0.67R a trade (n54/49), worst drawdown −4.1 | −6.6R, every year positive (2023 +3.3,
2024 +20.5, 2025 +29.4, 2026 +3.5); pivot width 2–4 and hold 48–240 h all positive in both halves; entry 4 min late still
+0.37 | +0.62. M15/M30 versions lose, H1 is flat; sells are inconsistent and not traded. Two thirds of the trades fire
while the gold trend system is flat. About 25 trades a year. Sizing guide 0.25% per trade. `snapshot.goldTL` shows the
current line, its anchors, the last H4 close and whether the direction blocked a break.

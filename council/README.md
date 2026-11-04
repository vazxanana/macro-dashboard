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

Losing open-sweep trades: 7 of 20 were +1R before reversing, but break-even, partials and trailing all scored below the plain 2R; trades on the side of the 18:00 ET daily open did better (+0.67R vs +0.25R) but the other side flipped sign between months, so no filter.

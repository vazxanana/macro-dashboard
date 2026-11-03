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

**Target per setup.** By default a trade takes profit at its first target; a retracement's first target is the 50% line of the higher-timeframe leg and its second is that timeframe's Origin, where the main trend resumes. `config.target[setup] = 't2'` holds the trade to the second target instead (`target: 't2'` and the passed first target `tp1` on the trade), and a resting order then stays valid until price reaches it. The backtest's `R_tp2` column is the same trades held to the second target. The Coach sets it at ≥ +0.05R per trade, t ≥ 2.5, both halves, keeps it while it stays ahead, and judges the entry style at the target each setup uses.

**The trader's rules** (`USER_RULES` in `trader.mjs`, applied once, logged with `by: 'user'`, listed in `config.userRules`). The Coach overrides a trader's rule only when a backtest shows it clearly losing (≤ −0.05R per trade, t ≤ −2, both halves), and logs that it did. History: `rintra-origin` (2 Nov 16:10) held the H1 → M5 retracement to the engine's H1 Origin (4,019.8, the start of the whole sell-off leg) after "no reason to miss this buy till the H1 origin"; the trader's marked chart then showed their H1 origin is the Origin of the sell-off's last H1 break (TP 3,965.08), which the first target already matched, so `rintra-origin-chart` undid it.

**Gold prices.** Gold trades on Kraken PAXG candles shifted onto XAU/USD spot (gold-api.com). The shift is the median of the last 2 hours of samples (`state.basis`), each spot quote matched to the PAXG minute it was quoted in; a stale quote adds nothing and the last shift is kept. One quote per run used to move every gold level by $2.70 per run on average (up to $8), more than a gold scalp's whole risk.

**Signal memory** (`state.seen`) is per market (`<market>|<signature>`): the signature is only the setup and two candle times, which correlated markets share.

**The trader's M15 CHoCH** (`choch.mjs`, 2 Nov): "M15 CHoCH is a sign to enter: it tells when the trend is changing, or we move from pullback/retracement to continuation and vice versa." A CHoCH up: the M15 leg down from the last 12 h's high to the lowest low after it (at least 2 M15 ATR), then an M15 candle closes above the last lower high before that low (an M15 swing high, 2 candles each side); a CHoCH down mirrors it. On 2 Nov the pullback 3,918 → lower high ~3,905 → 3,891 ended with an M15 close back above ~3,905, and the buy ran to 3,965. This is not the engine's VR confirmation (it only counts swings beyond the break level, so a straight drop like that never confirms) nor its structure flip (that came only with the 13:30 breakout). Every signal, live and in the backtest, records `m15c`: did that CHoCH in its direction close within the hour; the Coach learns it like D1 (`blockedBy: m15c`). The research setup `m15choch` enters on it at market within two M15 candles, stop just past the low (high), target the nearest valid opposing M30/H1 Origin worth ≥ 1.2R (rebuilt 2 Nov: buy 3,907, stop 3,889.5, target 3,965.08, 3.3R). The trader's examples log each step's M15 state (`m15`).

**Market-structure conditions (CHoCH).** The user's rule: once M15 or M5 prints a CHoCH (a change of character: the first break that flips that timeframe's structure, the engine's `structure: true` event, shown as "BO Structure"), enter. Every signal records two conditions, live and in the backtest: `cf` — is the confirming lower-timeframe break itself a CHoCH (`choch`) or a continuation BO (`bo`); `choch` — has M15 or M5 printed a CHoCH in the trade's direction within its last 12 candles (`yes`/`no`). The Coach treats them exactly like D1 (`CONDS` in `trader.mjs`): a filter needs one side ≥ +0.1R and the other ≤ −0.1R over 30+ trades each, a gap at t ≥ 3, both halves, after spread; the Trader then blocks the other side (`blockedBy: cf` / `choch`, followed as shadow trades). Combined with the entry-style rule this covers "CHoCH on M15/M5 → enter at market" — adopted only where the data shows it pays.

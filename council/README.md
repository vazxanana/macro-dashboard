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
(e.g. "swing: only with D1"), stored in `config.json` → `filters`. A condition that loses badly on its own (against D1 or internal structure, 6+ trades at −0.6R or worse) is filtered even before the other side has proven itself. Condition filters and the break-even switch (on when 4+ and 25%+ of 6+ recent live/shadow losers were +1R first) are re-checked every 6 hours; the other Coach rules run once a day. Setups a rule blocks are still followed as **shadow** trades
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

## Guide for the AI Coach (read before every review)

**Trade fields** in `trades.json`:
- `status`: pending | open | win | loss | `be` (break-even, 0R) | missed | expired
- `R`: the result in risk units. `k`: the setup key. `market`: the market.
- `feat`: the conditions at the signal (`d1` with/against, `struct` main/internal, `session` asia/london/overlap/newyork/late).
- `mfe` / `mae`: how far the trade went for and against, in R.
- `shadow: true` + `blockedBy`: the trade was blocked by a rule and is followed but never scored. The reasons are paused, market, minRR, d1, struct, session, exposure, news, duplicate (same stop and target as a live trade; a setup re-signalling the same side and target while that idea is still open is not recorded at all) and usd (already 3 live gold/forex trades betting the same way on the US dollar).
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

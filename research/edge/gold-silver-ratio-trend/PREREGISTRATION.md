# Pre-registration: weekly momentum of the gold / silver ratio, traded as a pair (14 Nov 2026)

Written and pushed alone, before any R of this rule was computed. Only the signal weeks were counted (below). Paper research
only: a stand-alone relative-value rule on two metals. It is **not** a gate, exit, entry or size of the live gold book, it
reads none of that book's 2006-17 positions (owner decision 44), and nothing live changes whatever the result.

## Why this rule, and why it is not a duplicate

What the earlier studies taught: intraday gold rules with small stops die on the cost, gains on the buy side equal gold's
drift, and every short has lost. A pair that is long one metal and short the other carries no net exposure to gold's drift,
so a positive result could not be the drift again. The ratio's own **trend** (time-series momentum of the spread) has not
been tested here:

- `gold-silver-ratio` (#829) FADED a 2-sd stretch of the same ratio (reversion), 34 trades in nineteen years. This study
  FOLLOWS the sign of the ratio's change, every week, both directions.
- `gold-platinum-ratio` traded spot gold alone on ratio signals (one leg). This study trades both legs.
- `gold-silver-divergence` (intraday H1 gold extremes unconfirmed by silver), `gold-silver-vol-ratio` (a volatility ratio as
  a gold signal), `drd-metals-book`, `gold-drd-silver`: other rules.
- `eth-btc-ratio` tested the same family (4-week ratio trend as a two-leg spread) on crypto, not metals. `tsmom` and
  `commodity-xs-momentum` rank single markets on 12-1 month returns, not a two-metal spread week by week.
- Prior: relative (spread) momentum between related commodities is a documented family (cross-sectional and pairs
  momentum in commodity futures); no paper's figure is relied on here.

## Data and market set (named before any result)

- council-data `research/daily/xau.json`, `xag.json`, `xpt.json` (OANDA mid daily candles, UTC days), read with
  `git show origin/council-data:…` (commit `d5a081937f76f9ea10dba83d0842623bbf65245a`); weekend stubs folded into the next
  weekday with `council/fills.mjs` `foldWeekend`. Cache outside git, deleted at the end.
- Markets: gold (XAU/USD) with silver (XAG/USD) and with platinum (XPT/USD). Nothing else.

## The rule

- Joint days = days both markets have a candle (matched by the UTC day stamp). Weeks are Monday-based calendar weeks; a
  week's signal close is its last joint day. L = ln(gold close / metal close).
- Signal at the close of week i: m = L(week i) − L(week i − look). m > 0 (gold has been gaining on the metal) → in week
  i + 1 **long gold, short the metal**; m < 0 → short gold, long the metal. Week i + 1 must be the next calendar week.
  Uses only closes at or before the signal close (no look-ahead).
- Each leg: entry at its first daily open of week i + 1; a fixed stop at 3 x ATR(20) of that market, ATR from the 20
  candles ending at the signal day; the stop fills at the open when a candle opens through it, else at the stop; out at the
  close of the leg's last candle of the week. Every leg always has a stop.
- Risk: each leg risks 0.5R at its stop, so 1R = both stops together; a week's R = 0.5 x leg R (gold) + 0.5 x leg R (metal).
  Each week is a separate trade with a full round trip on both legs (conservative: a kept side is not carried over).

## Costs

- Round trip a leg: gold **$0.60** ($0.30 spread + half a spread of slippage on entry and on exit); silver **$0.06** (the
  $0.03 spread used by `gold-drd-silver` / `gold-silver-ratio`, doubled the same way); platinum **$2.00** (an assumed $1.00
  spread, doubled; no measured platinum spread exists in the repository: an assumption, said as one).
- Financing on every LONG leg: `nights(entry, exit)` (Mon-Fri 22:00 UTC rollovers, Wednesday three) x
  `FIN.xau.long` = 0.000148 of the entry price a night (the cTrader demo XAUUSD swap of 11 Nov 2026, `council/fills.mjs`),
  silver and platinum assumed at the same rate (as `gold-silver-ratio` did). Short legs are credited nothing.
- Also reported at 2x costs (trading cost and financing doubled).

## Windows (by entry date)

- In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31.
- Signal weeks counted before this was written (no R computed): T1 522 IS / 513 OOS; T2 519 / 508; T3 522 / 513. Every
  window has at least 100.

## The three tests (Holm over these three, nothing else)

| Test | Pair | look | Role |
|---|---|---|---|
| T1 | gold / silver | 13 weeks | primary |
| T2 | gold / platinum | 13 weeks | second metal |
| T3 | gold / silver | 4 weeks | shorter lookback |

## Statistics and pass bar

- t on calendar-month sums of net R (by exit month, every calendar month of the window, empty months 0); one-sided normal p
  on the OOS t; Holm over T1-T3.
- **Baseline / placebo**: the same pair trade entered every one of the same weeks with a random side (40 seeded draws,
  mulberry32 seeds 1-40). Also reported, not judged: the same pair every week always long the ratio and always short it.
- A test passes only if ALL hold: (1) OOS net month-sum t >= 2 and Holm-adjusted p < 0.05; (2) in-sample mean net R > 0
  (same sign); (3) OOS mean net R > 0 at 2x costs; (4) the OOS mean net R is above at least 38 of the 40 random-side
  draws; (5) n >= 100 in each window.
- Verdict: PASS if T1 passes; PARTIAL if only T2 or T3 passes; else FAIL. A pass would be a lead to replicate, never an
  edge by itself, and would change nothing live.

## Deliverables

`run.mjs` (fetch / count / full), `result.json`, `RESULT.md` (verdict reason inside the bold verdict line, headline under
220 characters), `tests/gold-silver-ratio-trend.test.mjs` (offline: the rule on hand-made candles, no look-ahead, the
report against result.json), `out/` rebuilt.

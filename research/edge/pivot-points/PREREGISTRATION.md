# Floor-trader pivot points as intraday support and resistance: pre-registration

Written and committed on 14 Nov 2026, before any candle was read for this study and before any trade was computed. Paper
research only: no live rule, size, filter, cost model or mirror setting changes because of this study, whatever it finds. A pass
would only be a proposal to the owner for a paper shadow (`research/proposals/`), never a live change.

## Why

Retail lore says that classic floor-trader pivot levels, computed from the prior day, act as intraday support and resistance:
price reverses at R1 / S1, and a break of R1 / S1 runs on to R2 / S2. The academic evidence is thin. Osler (2000, Federal
Reserve Bank of New York, "Support for resistance: technical analysis and intraday exchange rates"; cited from memory, the
paper was not reopened for this study) reported that support and resistance levels published by dealers had some power to
predict intraday interruptions of FX trends. Pivot levels have not been tested in this repository: the round-number studies
(`fx-round-numbers`, and `index-round-numbers` running in parallel), `london-fix` and `fx-ny-cut` use other levels. Both claims
are tested here as two fixed rules, once, with the pass bar written before any result exists.

## Data

- OANDA mid M5 candles through the council's keyless proxy (`/md/bars?sym=<key>&tf=5m&from=&to=`, 4,999-candle windows,
  paced), from 2015-11-01 (warm-up for the ATR) to 2026-11-14 00:00 UTC. Only complete candles. Files kept outside git.
- **Markets, fixed now** (OANDA keys of `api/_oanda.js`), three groups:
  - indices: `spx500`, `nas100`, `us30`, `de40`, `uk100`;
  - forex: `eurusd`, `gbpusd`, `usdjpy`, `audusd`;
  - metals: `xag`.
  Gold (`xau`) is left out on purpose: no further test on the gold book (owner decision item 44) and the gold book is frozen.
- **In sample: trades entered 2016-01-01 to 2020-12-31. Out of sample: trades entered 2021-01-01 to 2026-11-13.** Nothing is
  tuned on either window: every number below is fixed now.
- A candle belongs to a session by its open time.

## The day (the "prior day" of the pivot)

- **Forex and silver: the 17:00 New York day** (17:00 New York of the previous calendar day to 17:00 New York; daylight time
  handled by the time-zone database). A day labelled Monday starts at the Sunday 17:00 reopen, so there is no weekend stub.
- **Indices: the prior cash session**, in the exchange's local time with its own daylight time: `spx500`, `nas100`, `us30`
  09:30-16:00 America/New_York; `de40` 09:00-17:30 Europe/Berlin; `uk100` 08:00-16:30 Europe/London. Only candles inside the
  cash session count (the CFD's other hours are ignored for the levels and are not traded).
- A session is **valid** only if it holds at least 80 % of its full number of M5 candles (forex / silver 288, US 78, DAX 102,
  FTSE 102). This drops exchange holidays and half days on which the CFD still prints a few hours (the rule is the count, so no
  holiday list is typed in). A valid session takes its levels from the most recent earlier valid session.
- Prior session high H, low L, close C (the close of its last candle). P = (H + L + C) / 3, R1 = 2P − L, S1 = 2P − H,
  R2 = P + (H − L), S2 = P − (H − L). A session whose prior H equals L is skipped.
- Daily ATR(14) = the simple mean of the true range (max of H − L, |H − previous C|, |L − previous C|) of the 14 valid
  sessions before the one traded. Nothing of the traded session is read to set a level, a stop or a target.

## The two rules

Both run inside the traded session only and are **flat at the session end** (the close of its last candle). One open position
at a time per market per rule. Each of R1 and S1 can trigger at most once per session (its first touch / first close beyond);
a trigger that comes while a position of the same rule is open is spent and not taken. A level is **void for the session** if
the session's first candle opens at or beyond it (the first touch was the open itself, not an approach).

- **T1 (primary), fade.** First touch of R1 (a candle's high reaches R1): sell at R1 (limit, filled at the level). First touch of
  S1 (low reaches S1): buy at S1. Stop at the level + 0.25 x ATR (sell) or − 0.25 x ATR (buy). Target P. On the fill candle only
  the stop counts (the order of the high and the low inside it is unknown, so the worse case); on later candles an open
  beyond the stop or the target fills at that open, then the stop is checked before the target.
- **T2, break.** First M5 close above R1: buy at the next candle's open; first close below S1: sell at the next open. Stop at the
  level − 0.1 x ATR (buy) or + 0.1 x ATR (sell). Target R2 (buy) or S2 (sell). Skipped when the entry open is already at or
  beyond the target or the stop, or when the close is the session's last candle. On the entry candle and later: an open beyond
  the stop / target fills at that open, then stop first, then target.
- R = side x (exit − entry) / |entry − stop|.

## Costs

Round trip as a share of the entry price, charged once per trade and converted to R by the trade's own risk: forex 0.015 %
(the trend-breadth table, about 1.5 pips on EUR/USD, spread plus commission), indices 0.04 % (index CFDs), silver 0.10 % (the
trend-breadth "mid" figure). No slippage beyond that and no financing: every trade is flat before its session ends, which is
before the 17:00 New York rollover for forex and silver and inside the cash session for indices. Net at 2x costs is reported
for every figure.

## Statistics and the pass bar

- Pools: all ten markets, indices, forex, metals (silver alone). t on calendar-month sums of net R (every trade of the pool in a
  month summed; months with no trade count as 0). One-sided p from the t (normal approximation).
- **Holm over eight tests**: {T1, T2} x {all, indices, forex, metals}, out of sample, net.
- **Placebo**: 40 seeds (mulberry32, seeds 1-40). For every session of every market, the whole ladder (P, R1, S1, R2, S2) is
  shifted by delta = s x u x (R1 − P), u uniform in [0.3, 0.7], s = +1 or −1 with equal chance, drawn per session; stops,
  targets and every other rule unchanged. The out-of-sample net R a trade of each pool is compared with its 40 placebo values.
- **Primary test: T1, all ten markets.** It PASSES only if all hold: out-of-sample n >= 300; out-of-sample net R a trade > 0;
  out-of-sample month-sum t >= 2; Holm-adjusted p < 0.05; in-sample net R a trade > 0 (same sign); out-of-sample net R a trade at
  2x costs > 0; out-of-sample net R a trade above the placebo's 95th percentile. The other seven tests are judged on the same
  bar and are secondary: a secondary pass alone is a hypothesis for a new pre-registration, not a finding.
- Reported, not judged: per market, by year, exits, gross figures.

## What would be done with a result

FAIL: the pivot levels are not used as a rule, filter or claim of an edge. PASS: a written proposal to the owner for a paper
shadow, with the numbers above. Nothing live changes either way.

# The FX carry trade on the G10 majors, out of sample: pre-registration

Written and committed **before** any return below was computed (13 Nov 2026). The universe, the data, the rule, the costs,
the windows, the tests and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config, cost constant or mirror setting changes, whatever the outcome.
A PASS leads at most to a proposal (`research/proposals/2026-11-13-fx-carry.md`) for a paper shadow book, for the owner to
approve (absolute rule 3). Nothing of ICT is read or touched. This is not the multi-asset momentum portfolio studied elsewhere.

## Why

The published carry literature (Lustig, Roussanov and Verdelhan 2011, "Common risk factors in currency markets"; Menkhoff,
Sarno, Schmeling and Schrimpf 2012, "Carry trades and global foreign exchange volatility") finds that being long the
currencies with high short-term interest rates against those with low rates earned a premium over decades, with crashes when
global FX volatility jumps. The council trades the USD majors on a cTrader demo; this asks whether the simplest version of
that premium survives on those seven pairs, with the council's own candles, a broker-like swap and measured costs, in the
years after the papers' samples.

## What is already known (seen before this was written)

- The council-data daily candle cache (`research/daily/<key>.json`, OANDA mid, complete UTC days) holds all seven pairs:
  `eurusd gbpusd usdjpy audusd usdcad usdchf` from May 2002 and `nzdusd` from 24 Sep 2002, all to 6 Nov 2026. Only row
  counts and first / last dates were read; no return was computed.
- The demo broker (Fusion Markets, raw-spread account) quotes the majors bid = ask most of the time outside the rollover and
  charges a commission of 22.5 USD per million of notional a side (`CLAUDE.md` "Forex spreads: a raw-spread account",
  `tests/fixtures/ctrader/symbols-raw-12nov.json` `commission.preciseRate` 2250000000 = 22.5 / 1e8 scale).
- **The build sandbox's network refuses `fred.stlouisfed.org`** (and ALFRED, the FRED API, the ECB, OECD and DBnomics data
  hosts) at the time of writing. The council's `macro/cache.json` holds US series only (no foreign short rate). If the rates
  below cannot be fetched, the study stops with "data not reachable": no rate is typed in, guessed or taken from memory.

## Universe

USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD: eight currencies, expressed through seven OANDA USD pairs
`eurusd gbpusd usdjpy audusd usdcad usdchf nzdusd`. For each non-USD currency c, `P_c` = USD per one unit of c: the pair's
close for EUR, GBP, AUD, NZD; `1 / close` for JPY, CAD, CHF (highs and lows swapped and inverted). USD's own `P` is 1.

## Short rates (FRED, keyless `fredgraph.csv`, fetched with `council/macro.mjs`'s parser and headers)

Primary, one per currency (OECD Main Economic Indicators, 3-month interbank rate, percent a year, monthly average, dated the
first day of the month):

| currency | primary | fallback (immediate / overnight rate) |
|---|---|---|
| USD | `IR3TIB01USM156N` | `IRSTCI01USM156N` |
| EUR | `IR3TIB01EZM156N` | `IRSTCI01EZM156N` |
| GBP | `IR3TIB01GBM156N` | `IRSTCI01GBM156N` |
| JPY | `IR3TIB01JPM156N` | `IRSTCI01JPM156N` |
| AUD | `IR3TIB01AUM156N` | `IRSTCI01AUM156N` |
| CAD | `IR3TIB01CAM156N` | `IRSTCI01CAM156N` |
| CHF | `IR3TIB01CHM156N` | `IRSTCI01CHM156N` |
| NZD | `IR3TIB01NZM156N` | `IRSTCI01NZM156N` |

A month with no primary value (a series that stopped, as some interbank series did when LIBOR ended) takes the fallback's
value for that month; with neither, the currency is left out of that month's ranking. Revisions are not modelled (the
current vintage is used; interbank averages are rarely revised). The fetched files are cached outside git.

**Publication lag (no look-ahead).** These monthly averages are published around the middle of the following month. At the
rebalance on the last trading day of month M, the ranking may use only observations dated month M−2 or earlier (the latest
such, per currency): an observation for month m counts as known from the first day of month m+2. This is stricter than the
real lag on purpose. Carry ACCRUAL (what a swap pays while a leg is held during month M+1) uses the observation of the month
held, M+1, when it exists (that is what was paid, not a signal), else the latest earlier one.

## The rule

- **Rebalance**: the close of the last daily candle of each calendar month (UTC days). Positions are opened at that close and
  held to the next month's last close.
- **Ranking**: the currencies with a known rate (≥ 6 needed, else the month is flat) sorted by the lagged rate, highest first
  (ties by currency code). Long the top 2, short the bottom 2. A USD leg is no position (USD is the account's numeraire: its
  excess return is 0 and it is counted as a leg of 0 R); every other leg is the USD pair, long or short `P_c`.
- **Equal risk, every leg has a stop**: ATR(20) = Wilder's 20-day average true range of `P_c`'s daily candles up to and
  including the rebalance candle. 1R of a leg = 3 × ATR(20). The stop sits 3 × ATR(20) on the losing side of the entry (the
  catastrophe stop). Each leg is sized to risk the same 1R; the book's month result = the mean of its four legs' R (a USD leg
  counts as 0 R), so a month where every leg stops is −1R of book risk.
- **Inside the month**: each daily candle after entry, in order: a candle that opens beyond the stop exits at its open; one
  whose high / low touches the stop exits at the stop. A stopped leg stays flat until the next rebalance. Otherwise the leg is
  closed at the month's last close (and the new ranking reopened; a leg kept from one month to the next is still charged a
  full round trip: conservative).

## Returns

Per leg, in R (its own 1R), side s = +1 long c, −1 short c:

- price: `s × (P_exit − P_entry) / (3 × ATR20)`;
- carry, as the broker's swap: `(s × (r_c − r_USD) − markup) / 100 × (calendar days held / 365) × P_entry / (3 × ATR20)`,
  with `r` the accrual rates in percent and `markup` = **1.0 % a year per leg** (the swap is the differential less the broker's
  markup, charged whichever side, never credited): conservative;
- costs, per round trip (entry + exit, every month and on a stop): `(spread + commission) × P_entry / (3 × ATR20)` as a
  fraction of price, spread **1 pip** of the pair (0.0001; 0.01 for USD/JPY) divided by the pair's price (an assumed spread
  plus slippage, above the measured raw-account median of about 0) and commission **0.000045** of notional a round trip
  (22.5 USD per million a side, measured). A run at **2 × costs** (spread, commission and markup doubled) is reported.

## Variant (pre-registered, one)

**Volatility skip**: G10 FX volatility of a month = the mean over the seven pairs of the standard deviation of daily log
returns of the close inside that month. Skip (stay flat for) month M+1 when month M's volatility is in the top 20 % of all
months known by then (from the first month of data through M, at least 36 months, expanding window; percentile rank of M ≥
0.8). Otherwise the variant trades as the base rule.

## Windows and tests

Monthly book R series (one value per holding month, a flat month = 0).

- **Replication**: holding months 2008-01 → 2015-12.
- **Decisive**: holding months 2016-01 → the last complete month on file (October 2026).
- Statistics per window and stream: n months, mean, standard deviation, annualised Sharpe = mean / sd × √12, t on monthly
  sums = mean / (sd / √n), total R, worst drawdown of the cumulative monthly R, share of months positive, and the same at 2 ×
  costs.
- Two tests on the decisive window: base, volatility variant. One-sided p from t (normal approximation), Holm over the two.

**Pass (per stream)**: in 2016 → now, annualised Sharpe > 0.3 AND month-sum t ≥ 2 AND Holm-adjusted p < 0.05; AND the mean
monthly R in 2008-15 > 0. **Verdict**: PASS if either stream passes (the base first), else FAIL. Never an edge without n and t.

## Gates (run before any statistic is read)

1. Every pair has a daily candle for each rebalance date's month (no month with fewer than 15 candles in 2007-10 → 2026-10).
2. Every currency has a usable rate for at least 95 % of rebalance months 2007-11 → 2026-09; otherwise the run reports "rates
   incomplete" and stops.
3. Data reachability: if FRED cannot be read, `result.json` says `verdict: "not run: data not reachable"` and nothing else is
   computed.

## Files

`run.mjs` (`fetch <dir>`: rates from FRED into `<dir>`; `full <dir> [daily dir]`: the study), `result.json`, `RESULT.md`
(verdict first), `tests/fx-carry.test.mjs` (offline: ranking, the lag, carry accrual, the stop, RESULT.md against
result.json).

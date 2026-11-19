# Overnight drift on index CFDs no earlier study used: pre-registration

Written and committed on 14 Nov 2026, before any candle of the markets below was read for a return and before any trade
of this study was simulated. Paper research only: no live rule, size, filter, council member, page or mirror setting is
changed by this study, whatever it finds. Not an ICT study.

## Why, and what this is not

`research/edge/index-overnight` (branch `index-overnight`, FAIL net) held a long US500 / NAS100 CFD from the New York cash
close to the next 09:30 New York open with a 1 x ATR20 stop. Before costs the night was positive with month-sum t +2.3 to
+4.7 in both 2005-15 and 2016-26; after its spread (0.03 % of price a round trip) and financing (US 2Y + 2.5 % a year) it
lost. `overnight-drift` (SPX500, NAS100, US30, a 2 x ATR stop, point spreads) found the same, `index-futures-cost`
re-costed the trades at CME micro futures cost (NAS100 +0.015R, t 2.02, a route chosen after the fact, no verdict), and
`cost-floor-map` lists the rule among tests blocked only by cost.

This study asks two narrow questions on index CFDs neither of the two overnight studies used: **does the same frozen rule
show the gross (before-cost) overnight gain there, and what is left after the frozen cost model?** It is a replication of
the gross effect and a cost check. It is not a search for the best market: every market below is fixed now, before any
return is read, and no rule, stop, cost or window is tuned.

## Markets used before (excluded)

- `index-overnight`: US500 (`spx500`), NAS100 (`nas100`), OANDA mid M30, 2005-01-01 to 2026-10-31 (decisive 2016-01-01 to
  2026-10-31, replication 2005-01-01 to 2015-12-31).
- `overnight-drift`: SPX500, NAS100, US30 (`us30`) on OANDA mid M30, and gold (XAU) on H1 (descriptive), 2007-10-01 to
  2026-10-31 (decisive 2016-01-01 to 2026-10-31, replication 2008-01-01 to 2015-12-31).
- `index-futures-cost`: no market of its own (re-costs index-overnight's US500 / NAS100 trades, and two other studies').
- `cost-floor-map`: no market of its own (a table of earlier tests).

## The unused set (fixed now)

Every OANDA index CFD key of the site's candle map (`api/_oanda.js`) not used above, fourteen markets:
`us2000` (US Russell 2000), `de40` (Germany), `uk100` (UK), `eu50` (Euro Stoxx 50), `fr40` (France), `ch20`
(Switzerland), `nl25` (Netherlands), `es35` (Spain), `jp225` (Japan), `au200` (Australia), `hk33` (Hong Kong), `cn50`
(China A50), `sg30` (Singapore), `in50` (India).

A probe of three 4,999-candle windows a market (January 2005, January 2010, January 2015) was made only to see which keys
the proxy serves and from when (candle counts and first timestamps, no price read): `nl25` from 2010, `cn50` and `in50` from
2015, `es35` returned no candle in any probe window; the others from 2005. A market **qualifies** when its fetched M30
file gives at least 300 trades (index-overnight's `MIN_N`) in the decisive window. **If fewer than 3 markets qualify the
study stops: NOT MEASURABLE.**

## Data

OANDA mid **M30** candles through the site's keyless candle proxy (`/md/bars?sym=<key>&tf=30m`), 1 January 2005 to
31 October 2026, fetched with index-overnight's own loop (windows of 4,999 candles, complete candles only), kept out of git
(`/tmp`). M30 for the same reason as index-overnight: most cash opens and closes fall on a half hour, which H1 cannot place.
Daily candles for the ATR are index-overnight's own (`dailyBars`: the CFD's 17:00-to-17:00 New York day) built from the
same file. Rates: FRED DGS2 weekly, index-overnight's `rates.json` (copied byte for byte).

## The frozen rule

index-overnight's `run.mjs` is copied byte for byte as `frozen.mjs` (its sha256 is pinned in the test) and never edited.
Everything below that it already does is taken from it by import: `makeSeries`, `dailyBars`, `atrAt` (ATR20 of days ended
at or before the entry), `simulate` (stop checks on every M30 candle between entry and exit, gap at the open, the exit
candle's open is the exit), `nightsHeld` (weekday 17:00 New York rollovers inside the hold, Friday three), `costTrade` (spread
0.0003 x entry a round trip, financing (DGS2 + 2.5 %) / 365 x entry a night, both in R of the trade's own stop), `summary`,
`monthSums`, `tStat`, `pOne`, `holm`, `mulberry32`, `windowTrade`, and its NYSE calendar for `us2000`.

The trade, per market: on every cash day D, long at the **close of the M30 candle ending at D's cash close**, exit at the
**open of the M30 candle starting at the cash open of the next cash day**, stop `entry - 1.0 x ATR20`, no target, long only.
`R = (exit - entry) / (entry - stop)`.

### The wrapper (the only new trading code)

index-overnight's `overnight()` computes New York times itself, so it cannot be called for another exchange. `wrapper`
code in `run.mjs` repeats its six lines with the market's own close and open times (UTC seconds from the exchange's local
time, through the platform's IANA time-zone database, `Intl`), and calls the frozen `atrAt`, `simulate` and `costTrade`.
The test proves that the wrapper given New York times gives index-overnight's own trades (same entry, stop, exit, R) on
synthetic candles, and the gate below proves it on the real US500 / NAS100 files.

### Sessions (from each exchange's published regular trading hours; no data looked at)

Local time, the exchange's own zone (daylight saving by the IANA rules of each date). Close = end of continuous trading
or the scheduled close of the closing auction where that is on a half hour; open = start of continuous trading.

| Key | Exchange (underlying) | Zone | Open | Close |
|---|---|---|---|---|
| us2000 | NYSE / Nasdaq (Russell 2000) | America/New_York | 09:30 | 16:00 (13:00 on index-overnight's early-close days) |
| de40 | Xetra (DAX) | Europe/Berlin | 09:00 | 17:30 |
| uk100 | London Stock Exchange (FTSE 100) | Europe/London | 08:00 | 16:30 |
| eu50 | Eurex / Xetra hours (Euro Stoxx 50) | Europe/Berlin | 09:00 | 17:30 |
| fr40 | Euronext Paris (CAC 40) | Europe/Paris | 09:00 | 17:30 |
| ch20 | SIX Swiss Exchange (SMI) | Europe/Zurich | 09:00 | 17:30 |
| nl25 | Euronext Amsterdam (AEX) | Europe/Amsterdam | 09:00 | 17:30 |
| es35 | BME Madrid (IBEX 35) | Europe/Madrid | 09:00 | 17:30 |
| jp225 | Tokyo Stock Exchange (Nikkei 225) | Asia/Tokyo | 09:00 | 15:00; 15:30 from 5 Nov 2024 (the TSE's extension) |
| au200 | ASX (S&P/ASX 200) | Australia/Sydney | 10:00 | 16:00 |
| hk33 | HKEX (Hang Seng) | Asia/Hong_Kong | 10:00 before 7 Mar 2011; 09:30 from then (HKEX's extension) | 16:00 |
| cn50 | Shanghai / Shenzhen (FTSE China A50) | Asia/Shanghai | 09:30 | 15:00 |
| sg30 | SGX (MSCI Singapore) | Asia/Singapore | 09:00 | 17:00 |
| in50 | NSE (Nifty 50) | Asia/Kolkata | 09:15, **exit at 09:30** | 15:30 |

Notes, decided now: Xetra, Euronext, SIX and BME closing auctions run a few minutes past 17:30 (and the LSE's past 16:30);
the M30 candle ending at 17:30 / 16:30 is the nearest half-hour boundary, so its close is the entry. India's 09:15 IST open
is 03:45 UTC, not an M30 boundary: the exit is the open of the M30 candle starting 09:30 IST (the first boundary after the
open), so the trade holds the session's first 15 minutes too. The lunch breaks of Tokyo, Hong Kong, Shanghai and Singapore
do not matter (the trade is out before the open and in after the close). cn50 is a CFD on the FTSE China A50 futures,
which trade longer hours than the A-share session; the A-share session is used as "the cash session". jp225, hk33 and the
others' CFDs may quote outside the cash session too; those candles are only used for stop checks, as in index-overnight.

### Cash days (outside the US)

index-overnight's NYSE calendar is used for `us2000` unchanged (`isCashDay`, `closeHour`, `cashDays`). No holiday
calendar is written for the thirteen other exchanges (thirteen rule sets would be more new code than the rule itself).
Instead, decided now: a **cash day** of such a market is a local weekday (Monday to Friday) on which the M30 candle ending
at the close AND the M30 candle starting at the open both exist in the file (candle existence only, no price read); the
trade of day D exits at the open of the **next** cash day, provided it is at most 5 calendar days later (a weekend or a
holiday is held through, as index-overnight does). A local holiday on which the CFD still quotes both candles is counted as
a cash day; this mixes a few non-session prices in and is a stated departure. No early closes outside the US.

## Windows

- **Decisive: 1 Jan 2016 to 31 Oct 2026** (entry date; the end of index-overnight's file, kept so that the frozen
  calendar code runs unchanged).
- **Replication: from the market's first candle (ATR warm-up of 21 days) to 31 Dec 2015.** A market with fewer than 100
  replication trades has no replication figures of its own (it still enters the decisive pool).

## Costs (the frozen model, applied unchanged)

Base cost = index-overnight's: spread 0.0003 x entry a round trip, financing (US 2Y + 2.5 %) / 365 x entry a night. Also
reported: 0 cost (gross), 2 x the spread, and financing on its own. Said now: the frozen financing uses the US 2Y rate for
every market; a non-US CFD is financed on its own currency's rate, which was lower than the US rate for most of 2009-22
(euro, franc and yen near or below zero). This study charges the frozen model on purpose; the financing column lets a
reader re-cost it. The frozen spread (0.03 % of price) is narrower than the quoted spread of some of these CFDs (hk33,
cn50, in50, sg30, es35 are typically wider); not re-measured.

## Primary tests (two, Holm over the two at 5 %, one-sided p from t by index-overnight's `pOne`)

Pooled = every qualifying market's trades together; monthly sums of R added across markets month by month (one unit a
trade); t = mean / (sd / sqrt(months)) over months with a trade; "R a trade" = total R / total trades.

- **H1 gross**: pooled mean before-cost R a trade > 0 with month-sum t >= 2.0 in the decisive window, AND pooled mean
  before-cost R a trade > 0 in the replication window, AND Holm p < 0.05.
- **H2 net**: pooled mean R a trade after the frozen base cost > 0 with month-sum t >= 2.0 in the decisive window, AND
  Holm p < 0.05.

## Verdict (fixed here; two words)

- Gross: **REPLICATES** when H1 holds, else **DOES NOT REPLICATE**.
- Net: **PASS** when H2 holds, else **FAIL**.
- **NOT MEASURABLE (inconclusive: …)** instead of both when fewer than 3 markets qualify, naming what is missing.

No per-market result changes the verdict. A REPLICATES gross with FAIL net says the drift is there on these markets and
the frozen CFD cost takes it, nothing more; never an edge without n and t.

## Reported per market (never a verdict)

Decisive and replication: n, win rate, mean R gross / at base cost / at 2 x spread, spread and financing in R, month-sum t
gross and net, Holm-adjusted p over the qualifying markets (gross and net separately, decisive), total, worst drawdown in R
(closed, base cost), stops, median stop as % of price, mean nights, dropped days, by year.

## Placebo (reported, not part of the verdict)

40 seeds (mulberry32, seed = s + 1). Per market and window: the same number of trades as the real test, each on a weekday
drawn uniformly from the window and a start drawn uniformly from the 48 M30 boundaries of that UTC day, held for the
market's **median weekday overnight hold** in that window (the hold of its real trades with one rollover, rounded to the
M30; this replaces index-overnight's fixed 7.5 h so the control is duration-matched), through index-overnight's
`windowTrade` (same entry, stop, stop checks, costs). Pooled per seed as the real test. Reported: the real pooled gross and
net mean R and t against the placebo's 5th / 50th / 95th percentiles, and each market's real gross mean against its
placebo percentiles.

## Gate (before any figure of the unused set is read)

index-overnight's published T1 / T2 rows must be reproduced exactly: `frozen.mjs full` run in a temporary folder on a fresh
fetch of US500 / NAS100 M30 must write a `result.json` whose T1 and T2 rows (decisive and replication: n, gross, spread,
financing, net, t gross, t net, total, max DD, placebo) equal the committed `research/edge/index-overnight/result.json` on
its branch; and the wrapper given New York sessions must give the same T1 / T2 trades as the frozen `runMarket`. If the
gate fails nothing else is run and the study reports why.

## What happens next

Nothing changes live on any outcome. A REPLICATES / PASS would be a hypothesis for a forward paper shadow with its own
pre-registration, never a live rule. A bug found after the run is fixed, said in RESULT.md, and everything re-run.

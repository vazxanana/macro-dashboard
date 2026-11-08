# Open run breadth 2: the NQ open run at seven more cash opens

**Verdict: NQ-ONLY (FAIL): none of the seven cash opens (FTSE, Nikkei, Hang Seng, ASX 200, Euro Stoxx 50, CAC 40, Russell 2000) passes even the 2023-26 half of the bar, all seven lose after costs in both windows, and the Russell, which shares NQ's clock, is flat at +0.01R.**

Paper research only. No live rule, config or tracker was changed. Follow-up to `research/edge/open-run-breadth` (#543), which
found the NQ New York open run (`council/trader.mjs` `nqOpenSweep` + `nyflip`) does nothing on ES, YM and DAX. The rule,
sessions, costs and pass bar were pre-registered and pushed before any of these candles were downloaded (`preregistration.md`).

## Verdict

- **Zero of seven pass L (2023-26 net R > 0 and t ≥ 2); zero pass E (early net R ≥ 0).** Pre-registered label: **NQ-ONLY**.
  Together with #543 that is 0 of 10 non-NQ index markets.

  | Market (cash open) | Cost (pts) | Clean 1m years | Early net R/trade (n, t) | 2023-26 net R/trade (n, t) | Gross early | Gross 2023-26 | L | E |
  |---|---|---|---|---|---|---|---|---|
  | NQ (reference, #543 primary) | 1.37 | 2004-26 | −0.122 (1,561, −3.26) | **+0.303** (309, 3.37) | +0.107 | +0.337 | pass | fail |
  | FTSE 100 (08:00 London) | 2.0 | 2004-26 | −0.135 (1,120, −3.34) | −0.146 (206, −1.97) | +0.044 | −0.002 | fail | fail |
  | Nikkei 225 (09:00 Tokyo) | 18.0 | 2016-26 (9) | −0.273 (384, −3.67) | −0.212 (298, −2.63) | +0.102 | −0.008 | fail | fail |
  | Hang Seng (09:30 HK) | 14.0 | 2012-26 | −0.143 (914, −3.05) | −0.224 (308, −2.97) | +0.107 | +0.024 | fail | fail |
  | ASX 200 (10:00 Sydney) | 4.0 | 2015-26 | −0.306 (527, −4.98) | −0.202 (199, −2.33) | +0.082 | +0.115 | fail | fail |
  | Euro Stoxx 50 (09:00 Paris) | 3.5 | 2015-26 (7) | −0.417 (241, −4.60) | −0.486 (203, −5.61) | +0.039 | −0.087 | fail | fail |
  | CAC 40 (09:00 Paris) | 2.2 | 2004-26 | −0.275 (1,323, −7.51) | −0.217 (240, −2.39) | −0.020 | −0.053 | fail | fail |
  | Russell 2000 (09:30 New York) | 0.55 | 2004-26 | −0.164 (1,768, −4.71) | +0.011 (343, 0.13) | +0.089 | +0.108 | fail | fail |
  | **Pooled, 7 new** | | | **−0.207 (6,277, −11.7)** | **−0.194 (1,797, −6.1)** | | | | |
  | Pooled, all 10 non-NQ (with #543 ES, YM, DAX) | | | −0.191 (9,882, −13.6) | −0.182 (2,529, −6.9) | | | | |

- **Before costs there is nothing for costs to remove.** Gross 2023-26 is between −0.09R and +0.12R on every market (the
  best, ASX +0.115, has t 1.3). NQ gross is +0.34R. The pattern's small gross tilt in the early years (+0.04 to +0.11R on
  five markets) is the same one #511 found on NQ 2004-13: a few points of edge that any realistic cost erases.
- **Year by year, the seven markets are positive in 3 of 28 market-years since 2023** (FTSE 2023, Russell 2024 and 2025) and
  in 12 of 84 before 2023. NQ is positive in 4 of 4 years since 2023 (+0.27, +0.29, +0.22, +0.44).

  | Year | NQ | FTSE | Nikkei | HSI | ASX | EU50 | CAC | Russell |
  |---|---|---|---|---|---|---|---|---|
  | 2023 | +0.269 | +0.140 | −0.274 | −0.242 | −0.119 | −0.368 | −0.142 | −0.053 |
  | 2024 | +0.289 | −0.321 | −0.237 | −0.081 | −0.380 | −0.188 | −0.220 | +0.083 |
  | 2025 | +0.220 | −0.186 | −0.151 | −0.431 | −0.227 | −0.572 | −0.281 | +0.118 |
  | 2026 (to 6 Nov) | +0.436 | −0.255 | −0.194 | −0.168 | −0.085 | −0.800 | −0.223 | −0.141 |

- **Halves of 2023-26** (net R/trade, first | second): FTSE −0.07 | −0.22; Nikkei −0.22 | −0.20; HSI −0.19 | −0.26;
  ASX −0.27 | −0.13; EU50 −0.29 | −0.68; CAC −0.15 | −0.28; Russell 0.00 | +0.02. No half of any market is positive at t > 0.3.
- **Cost ×2** makes every late number worse by 0.1-0.4R (FTSE −0.29, Nikkei −0.42, HSI −0.47, ASX −0.52, EU50 −0.89,
  CAC −0.38, Russell −0.09). Cost scaled to price (so the early years are not over-charged) changes nothing material:
  FTSE −0.09 | −0.15, Nikkei −0.12 | −0.21, HSI −0.18 | −0.23, ASX −0.21 | −0.20, EU50 −0.28 | −0.49, CAC −0.17 | −0.22,
  Russell −0.02 | +0.01 (early | late).
- **The Russell does not share NQ's days in the way that would make NQ's result look broad.** In 2023-26 the Russell fired on
  113 of NQ's 309 trade days, 85 of them on the same side (R correlation 0.15). On those same-side days NQ made +0.33R a
  trade and the Russell −0.14R. The Russell's whole late result comes from the 230 days NQ did not fire (+0.10R, t 0.9);
  on NQ's days it lost −0.17R. The reverse split is the striking one: NQ made **+0.40R** (n 113, t 2.7) on the days the Russell
  also signalled and +0.25R (n 196) on the others, so a Russell signal marks NQ's better days without being tradable itself
  (an observation, not a pre-registered test, and not a rule proposal).
- The other six trade on other clocks; 29-34% of their trade dates are also NQ trade dates, and they lose on those dates
  too (FTSE −0.20, Nikkei −0.04, HSI −0.36, ASX −0.29, EU50 −0.56, CAC −0.33 on shared dates). There is no "NQ day" effect
  that reaches other markets.
- **Diversification subtracts.** The equal-weight daily basket of NQ plus the seven makes −0.099R a day in 2023-26 (t −2.9)
  against +0.303R for NQ alone. The seven alone: −0.177R a day (t −4.9).

**So:** across ten non-NQ index markets, two continents and five time zones, the unchanged open-run rule has no echo of NQ's
2023-26 run, before or after costs. This closes the "broad change in how index opens trade" explanation. What is left is
what #543 said: an NQ-specific quirk of the last four years, or a rule fitted to the window it was built on (#486 rated its
t 3.67 as just under the multiple-testing bar). Nothing here argues for adding markets, for more size, or for a new paper
stream. If the NQ run is kept, it stays a regime bet with the CUSUM review as its kill switch. The owner decides; nothing was
changed.

## What was tested (exactly as pre-registered)

- **Rule.** `research/edge/open-run-breadth/lib.mjs` (#543) is imported unchanged: open-candle level O, run ≥ 0.08% of O,
  reclaim close within 15 minutes of the first cross, trade with the run from the reclaim close, stop at the run extreme plus a
  0.011% buffer mirrored to the other side, local-midnight price ahead, 10R cap, trail 1R from +2R, out at open + 90 minutes.
- **Sessions** (local time; midnight = 00:00 local): FTSE 08:00 London, out 09:30; Nikkei 09:00 Tokyo, out 10:30; Hang Seng
  09:30 Hong Kong, out 11:00; ASX 200 10:00 Sydney, out 11:30; Euro Stoxx 50 and CAC 40 09:00 Paris, out 10:30; Russell 2000
  09:30 New York, out 11:00.
- **Data.** OANDA 1-minute mid candles through the site's keyless proxy (`meridianx.dev/md/bars`), 2003 to 6 Nov 2026, cached in
  the session scratchpad (about 90 MB, not committed). Clean years use the #511/#543 thresholds (open candle on ≥ 93% of
  weekdays, ≥ 93% of the 91 session minutes present, a midnight price on ≥ 90% of weekdays).
- **Costs** (round trip, index points, fixed in the pre-registration): FTSE 2.0, Nikkei 18.0, Hang Seng 14.0, ASX 4.0,
  Euro Stoxx 3.5, CAC 2.2 (OANDA typical spread + one futures tick each way, as #543 did for DAX), Russell 0.55 (M2K, from the
  cost study). They are 9-42% of the median stop (Russell 9%, FTSE 14%, Nikkei 19%, HSI 22%, CAC 16%, ASX 32%, EU50 39%
  in 2023-26), so the cost assumption matters most on Euro Stoxx and the ASX; the gross rows above show it is not the cause.
- **Windows.** Early: clean years from the first clean year to 2022. Late: 2023 to 6 Nov 2026. Scored separately.

### Calibration gate (passed before any new-market number was read)

The imported code on the #511 NQ cache with the live 2-point buffer and 1-point cost reproduces #511 and #543 exactly:
−0.018R (n 1,560) in 2004-22 and +0.318R (n 309) in 2023-26. The script exits if this fails.

### Data history: what the OANDA feed covers, and the 5-minute fallback

The 1-minute history is short on four markets, and the reason differs:

- **Nikkei (JP225_USD):** no quotes at all in the Tokyo morning before 2010 (the CFD traded only European/US hours; the midnight
  price is there, the 09:00-10:30 window is empty). Thin 1-minute quotes 2010-15, 2017 and 2019. Clean 1m years: 2016, 2018,
  2020-26.
- **Hang Seng (HK33_HKD):** no 09:30 candle before 2011, because the Hong Kong cash market opened at 10:00 until March 2011.
  The pre-registered 09:30 open does not exist in those years, on 1-minute or 5-minute candles, so 2004-11 are dropped (not a
  data-quality problem but a market-hours change). Clean 1m years: 2012-26.
- **ASX 200 (AU200_AUD):** thin 1-minute quotes before 2015. Clean 1m years: 2015-26.
- **Euro Stoxx 50 (EU50_EUR):** thin 1-minute quotes before 2013 and in 2016-19 and 2021 (73-93% of the session minutes).
  Clean 1m years: 2015, 2020, 2022-26.

FTSE, CAC and Russell are clean on 1-minute candles for every year 2004-26.

**5-minute fallback (pre-registered):** years that fail the 1-minute test but pass it on 5-minute candles (≥ 18 of 19 candles
o..o+90) were run on 5-minute candles, same code, and are reported here separately. Every market has ≥ 2 clean 1-minute years
in 2023-26, so the bar was judged on 1-minute data for all seven; the 5-minute years only extend the early window.

| Market | 5m years | Early net R/trade (n, t) | Gross |
|---|---|---|---|
| Nikkei | 2013, 2014, 2015, 2017, 2019 | −0.531 (266, −7.61) | −0.045 |
| ASX 200 | 2006-10, 2014 | −0.244 (333, −3.56) | +0.081 |
| Euro Stoxx 50 | 2013, 2014, 2016-19, 2021 | −0.520 (351, −8.37) | −0.021 |

The reclaim on a 5-minute close is not the live rule, so these are indicative, but their sign is the same.

## Sensitivity (net R/trade, early | 2023-26)

| Variant | FTSE | Nikkei | HSI | ASX | EU50 | CAC | Russell |
|---|---|---|---|---|---|---|---|
| Primary | −0.135 \| −0.146 | −0.273 \| −0.212 | −0.143 \| −0.224 | −0.306 \| −0.202 | −0.417 \| −0.486 | −0.275 \| −0.217 | −0.164 \| +0.011 |
| Gross | +0.044 \| −0.002 | +0.102 \| −0.008 | +0.107 \| +0.024 | +0.082 \| +0.115 | +0.039 \| −0.087 | −0.020 \| −0.053 | +0.089 \| +0.108 |
| Cost ×2 | −0.313 \| −0.290 | −0.649 \| −0.415 | −0.393 \| −0.472 | −0.694 \| −0.519 | −0.873 \| −0.885 | −0.531 \| −0.381 | −0.416 \| −0.087 |
| Cost scaled to price | −0.087 \| −0.150 | −0.118 \| −0.212 | −0.183 \| −0.227 | −0.207 \| −0.198 | −0.275 \| −0.485 | −0.168 \| −0.217 | −0.020 \| +0.008 |
| Midnight filter off | −0.138 \| −0.149 | −0.223 \| −0.153 | −0.234 \| −0.226 | −0.319 \| −0.253 | −0.438 \| −0.475 | −0.276 \| −0.210 | −0.197 \| −0.047 |
| Midnight behind (skipped trades) | −0.150 \| −0.139 | −0.160 \| −0.092 | −0.342 \| −0.218 | −0.346 \| −0.301 | −0.448 \| −0.462 | −0.279 \| −0.195 | −0.241 \| −0.119 |
| Buffer 0 | −0.155 \| −0.195 | −0.318 \| −0.208 | −0.190 \| −0.248 | −0.377 \| −0.241 | −0.477 \| −0.582 | −0.284 \| −0.223 | −0.163 \| +0.031 |
| Fixed 2R exit (no runner) | −0.159 \| −0.104 | −0.317 \| −0.243 | −0.152 \| −0.215 | −0.333 \| −0.167 | −0.408 \| −0.473 | −0.277 \| −0.252 | −0.173 \| −0.052 |

No variant makes any market positive in 2023-26 beyond the Russell's +0.03 (buffer 0, t 0.4). The midnight filter, which
#511 found carries most of NQ's edge, adds nothing on any of the seven (on five of them the skipped "midnight behind" trades
do about as well as the taken ones).

## Dependence on NQ (2023-26)

| Market | Trades | Also an NQ trade date | Same side | R correlation (same side) | Market R on same-side days | NQ R on them | Market R on non-NQ dates |
|---|---|---|---|---|---|---|---|
| Russell | 343 | 113 | 85 | 0.15 | −0.14 | +0.33 | +0.10 |
| FTSE | 206 | 67 | 26 | 0.26 | −0.53 | +0.09 | −0.12 |
| Nikkei | 298 | 100 | 50 | 0.12 | −0.21 | +0.17 | −0.30 |
| Hang Seng | 308 | 90 | 46 | 0.05 | −0.28 | +0.22 | −0.17 |
| ASX 200 | 199 | 59 | 32 | −0.04 | −0.21 | +0.26 | −0.17 |
| Euro Stoxx 50 | 203 | 68 | 40 | 0.10 | −0.73 | +0.02 | −0.45 |
| CAC 40 | 240 | 76 | 45 | 0.17 | −0.52 | +0.25 | −0.17 |

Only the Russell shares NQ's open minute; the others are date overlaps across time zones. No market earns anything on NQ's
days, and NQ keeps its edge whether or not another market fires.

## Files

- `preregistration.md`: rule, sessions, costs, data rules and pass bar, pushed before the data.
- `markets.mjs`: the seven sessions and costs, plus a midnight helper that covers Asian and Australian time zones.
- `fetch.mjs`: OANDA download through the site proxy, per market and year, 1-minute or 5-minute, with the #543 midnight
  lookback fill.
- `run.mjs`: calibration gate, data quality and the 5-minute fallback, per-market runs, sensitivity, pooled rows, dependence
  and basket. It imports the #543 rule and writes `result.json` (every trade included).

Re-run:

```
node research/edge/open-run-breadth-2/fetch.mjs <cacheDir> uk100     # likewise jp225 hk33 au200 eu50 fr40 us2000
node research/edge/open-run-breadth-2/run.mjs <cacheDir> <nqCacheDir> --need5m   # lists the market-years to fetch on 5m
node research/edge/open-run-breadth-2/fetch.mjs <cacheDir> jp225 2004 2020-01-01T00:00:00Z 5m
node research/edge/open-run-breadth-2/run.mjs <cacheDir> <nqCacheDir>
```

The candle caches (about 90 MB) are not committed.

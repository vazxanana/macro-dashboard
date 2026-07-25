# Refresh targets — `trading-levels-and-closes`

Entry point for an `update trading-levels-and-closes` run. Produces a delta in `diffs/`.

---

## 0. Re-run first if WebFetch works

WebFetch was blocked org-side for this entire investigation (HTTP 403 on every domain,
`example.com` included — re-confirmed, second session running). All 59 sources are
search-derived. Priority fetches, in order of how much weight the report puts on them:

| Priority | Target | Verifies |
|---|---|---|
| 1 | **Osler** (NY Fed) — round-number order clustering + the bootstrap vs 10,000 randomised controls | The entire §3 grading; 60.8% vs 56.2%, +4–8pp, 9,655 orders |
| 2 | **LBMA / ICE Benchmark Administration** auction methodology | 10:30 & 15:00 times, 10,000 oz threshold |
| 3 | **GLD prospectus/FAQ** — NAV struck on LBMA PM since 20 Mar 2015 | F1's strongest institutional-significance claim |
| 4 | **Hauptfleisch, Putniņš & Lucey (JFM 2016)** | COMEX-leads-discovery claim |
| 5 | **Batten, Lucey & Peat (2016, Resources Policy)** | Fix-time anomalies |
| 6 | **Bogousslavsky & Muravyev, "Who Trades at the Close?"** | The counter-argument that closes carry no new information |
| 7 | **Kohli (2012)** gold day-of-week | Friday/Monday IV asymmetry |
| 8 | CME GC options expiry calendar | Whether daily weeklies still dilute expiry signal |

## 1. Numbers to re-pull

| Number | Current | Source |
|---|---|---|
| US closing-auction volume share | ~9–10% (from 3.1% in 2010) | 10 |
| FTSE closing-auction share | 55% (2023), from 31% (2019) | 10 |
| Osler bounce frequency vs control | 60.8% vs 56.2%, +4–8pp, ~5-day decay | 30s |
| LBMA auction imbalance threshold | 10,000 oz | 01–02 |
| Gold median AISC | $1,500–1,650/oz | 50 |
| Expiry pinning distortion (S&P futures) | ~16.5 bps | 42 |

## 2. Things that could change the conclusions

- **CME publishing a free strike-level gold options OI endpoint** → would unblock GEX/pinning
  levels, currently ruled out on the data constraint (F3).
- **Any gold-specific academic study of level reactions** → would replace the FX/equity
  extrapolation that everything in §3 currently rests on. This is the biggest gap.
- **LBMA changing auction times or GLD changing its NAV reference** → would invalidate the
  single highest-value recommendation.
- **Day-of-week decay** — the Kohli Friday/Monday effect is exactly the kind of anomaly that
  erodes post-publication. Re-check before weighting it.

## 3. Hypotheses

| # | Verdict | Re-test trigger |
|---|---|---|
| H1 (closes privileged) | PARTIALLY REFUTED for gold | Evidence of order-flow concentration at 5pm ET |
| H2 (close-confirmation beats wick) | **UNTESTED — still open** | Any study, or the §7 harness run on real data |
| H3 (prior closes as levels) | REFUTED / grade D | A rigorous PDC study |
| H4 (weekly > daily close) | REFUTED | — mechanically settled; weekly close *is* Friday's close |

## 4. The empirical arbiter (supersedes everything above)

**Run the §7 harness on real gold data in the browser.** For each level type, measure max
favourable excursion after price approaches within 0.1×ATR, **benchmarked against randomly
chosen control points** (Osler's bootstrap method).

That produces gold-specific, own-data grades and replaces the borrowed FX/equity grades in §3.
If it contradicts the grading table, **the measurement wins.**

Cross-check against the Edge Tracker: if strategies keying off high-grade levels (reaction
zones, round numbers) outperform those keying off PDH/PDL/PDC, that independently corroborates
F2.

## 5. Platform state at time of writing (drift detection)

```
Levels currently computed: vwap, ema20/50, pdh, pdl, pdc, asianH, asianL, r100, r50
Weekly data used ONLY for: rzWeeklyState (reactionZones on 1w candles)
NOT present: LBMA PM print, COMEX settlement marker, COMEX warehouse stocks,
             Friday-squaring flag, options expiry tier
COT weighting: flat w1, no decay through the week   → F3 recommends decay
nearLevel() references: VWAP, PDH, PDL, Asia H/L, r100, r50  → F2 says demote PDC-class,
                                                                keep round numbers
```

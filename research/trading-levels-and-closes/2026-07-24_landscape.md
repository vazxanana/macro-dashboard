# Levels, edges, and closing prices — what the evidence actually supports

**Date:** 2026-07-24 · **Genre:** landscape → decision · **Slug:** `trading-levels-and-closes`
**Corpus:** 59 sources (16 academic, 14 primary, 21 industry, 6 discussion)
**Findings:** F1–F3 in `findings/`

---

## 0. Sourcing constraint (unchanged from the previous investigation)

**WebFetch remains blocked organization-side** — re-tested this session, `example.com` returns
HTTP 403. WebSearch works. Every source file is labelled SEARCH-DERIVED and unverified against
primary text. No agent invented a URL or a quote. Figures below should be re-verified before
external citation; the *mechanisms* are corroborated across multiple independent passes.

---

## 1. Headline: you're right that some prices matter more — but not the ones on your chart

You asked me to pay special attention to weekly and daily closes. The evidence says your
instinct is sound and your target is wrong.

**The 5pm New York "daily close" on a gold chart is a data-vendor convention.** Platform
providers document it as an *administrative reset point for rollover*. There is no auction, no
trading halt, no order-flow concentration — the market trades straight through it. Every
mechanism that makes an equity close meaningful (auction-concentrated liquidity, NAV striking,
index-tracking mandates) is **absent** from that timestamp.

For contrast, in equities those mechanisms are enormous: US closing-auction share grew from
~3.1% (2010) to **~9–10% of daily volume** today (~20% on rebalance days), and FTSE's closing
auction went from **31% (2019) to 55% (2023)**. Gold has no equivalent at 5pm ET.

**And the weekly close is just Friday's daily close.** It contains no data the daily close
doesn't. Of ~30+ claims found asserting weekly superiority, the large majority were uncited
vendor content ("80%+ success rate", "reliability increases exponentially"). **H4 refuted.**

### What actually carries institutional weight in gold

| Time | Mechanism | Why it forces transactions |
|---|---|---|
| **15:00 London** | **LBMA Gold Price PM auction** | Global settlement benchmark. **GLD's NAV has struck on it since 20 Mar 2015.** Physical delivery contracts, miner hedges, CB accounting |
| **10:30 London** | LBMA AM auction | Same mechanism, lighter reference use |
| **13:29–13:30 ET** | **COMEX settlement window** | Exchange-defined 60-second VWAP for margin and mark-to-market |

These are moments where size **must transact or must mark** — the property the 5pm candle lacks.
The LBMA auction runs iteratively until net imbalance falls below **10,000 oz**.

Supporting: **Batten, Lucey & Peat (2016, Resources Policy)** — peer-reviewed — confirms
anomalous statistical behaviour around fix times. **Hauptfleisch, Putniņš & Lucey (JFM 2016)**
reportedly finds COMEX futures lead price discovery *despite trading under one-tenth of
London's volume*, with leadership rotating by regional session.

### The one real thing about Friday

Not information — **positioning**. Gold day-of-week work (Kohli 2012) reportedly finds implied
vol **lower Friday, higher Monday**, consistent with pre-weekend squaring and gap-risk
avoidance. Prop firms mandate Friday flatten windows. Trade the *positioning event*, not the
close price. ⚠ Day-of-week effects are the canonical case of anomalies that decay once published.

---

## 2. Hypothesis scorecard

| # | Hypothesis | Verdict |
|---|---|---|
| **H1** | Closes are informationally privileged | **PARTIALLY REFUTED.** True for equities (auction mechanics); **false for gold's 5pm convention**. Real institutional prints exist at other times (F1) |
| **H2** | Close-confirmation beats wick-confirmation for breaks | **UNTESTED — insufficient evidence.** No study located. Still defensible as *noise filtering*, but not on institutional-significance grounds |
| **H3** | Prior closes are distinct reference levels | **REFUTED / grade D.** Rests on behavioural anchoring by inference; the "70% of traders watch this" stats have no visible source (F2) |
| **H4** | Weekly close > daily close | **REFUTED.** Weekly close *is* Friday's daily close (F1) |

---

## 3. Levels that actually have evidence

The single rigorous foundation is **Carol Osler's** NY Fed order-book work — **9,655 real orders,
$55B+ face value**. It's the strongest evidence in this entire space because it has order-flow
causality rather than chart-reading.

**What it found:** take-profit orders cluster on the *approach* to round numbers (braking →
reversal); stop-losses cluster *just past* them (cascade → acceleration). A companion paper
tested published desk levels against **10,000 randomised controls**: **60.8% vs 56.2% bounce
frequency — a +4–8pp edge decaying over ~5 business days.**

That +4–8pp is the honest magnitude of "levels work." Real, tradeable, not overwhelming.

| Level | Grade | Note |
|---|---|---|
| Round numbers | **B+** | Osler causality; gold extrapolated, not directly studied |
| Published/consensus S/R | **B** | +4–8pp vs randomised control |
| VWAP | **B** | Structural: institutional flow mechanically routed to it |
| General S/R | C | Studies exist by title; findings unretrievable |
| Opening range breakout | C, contested | 2024 paper claims 2.4 Sharpe; 2026 arXiv falsification finds ORB fails on MNQ |
| **PDH / PDL** | **C/D** | No rigorous study found — retail blog stats only |
| **Prior day close** | **D** | Anchoring theory by inference; unsourced stats |
| **Prior week H/L/close** | **D** | Even thinner |

**Uncomfortable implication:** your engine leans on PDH/PDL/PDC in `structState` and the
engulfing `nearLevel()` filter — grades **C/D**. Meanwhile your home-grown `reactionZones()` is
conceptually closest to Osler's published-S/R construct (grade **B**) and is your best-evidenced
level type. Best-to-worst of what you already have: **reaction zones ≈ round numbers ≈ VWAP >
PDH/PDL > prior closes** — roughly the inverse of how prominently prior-day levels feature.

**On self-fulfilment:** "levels only work because people watch them" is true and *not*
disqualifying — Osler's mechanism *is* self-fulfilling. But it means reflexivity is a
**necessary condition** (the level must be widely watched) and implies **fragility**.

---

## 4. Information sources — the freshness filter

An information source is usable only if **freshness ≤ decision frequency**.

| Source | Cadence | Real lag | Daily-usable? |
|---|---|---|---|
| LBMA auction (10:30/15:00 London) | Twice daily | Real-time | ✅ **Best in class** |
| COMEX settlement | Daily | Real-time | ✅ |
| **COMEX warehouse stocks** | **Daily** | **~1 day** | ✅ **Best daily-fresh fundamental — you don't have it** |
| Futures aggregate OI (CME) | Daily | ~1 day | ✅ |
| ETF flows (WGC Goldhub) | Weekly | 2–7 days | ⚠️ Weekly backdrop |
| **CFTC COT** | Weekly | Tue data, Fri release → **up to ~9 days stale** | ❌ Backdrop only |
| CB purchases (IMF IFS) | Monthly | **~2 months** | ❌ |
| WGC Demand Trends | Quarterly | ~1 month | ❌ |

**Two actionable gaps:** (a) COMEX warehouse stocks is the only genuinely daily-fresh gold
fundamental and you carry none of it; (b) your COT driver is weighted like a same-day feed but
can be **nine days stale** by Thursday.

**Don't build:** options-derived levels fail the free/keyless constraint — strike-level gold
options OI sits behind CME QuikStrike (interactive JS, registration), and every GEX vendor
covers SPX/SPY only. Max pain is additionally weak on evidence (concentrated in small-cap
illiquid names — the opposite of gold). AISC (~$1,500–1,650/oz) is far below current price and
irrelevant as a floor. Seasonality sources actively contradict each other.

---

## 5. Adversarial pass

**Steel-man of doing nothing:** the effects here are *modest* (+4–8pp, decaying in ~5 days) and
measured in FX, not gold. Adding LBMA/COMEX levels could be complexity for an edge too small to
survive spread and slippage. **This is a fair objection** — the honest response is that these
additions are cheap and testable, not that they're guaranteed.

**Strongest case against my own headline:** even if 5pm ET has no auction, it may still matter
*reflexively* — millions of traders draw daily candles on it, so the level becomes watched
regardless of mechanism. By Osler's own logic (watched levels matter), the 5pm close could work
for exactly the reason I dismissed it. **I cannot refute this with the evidence gathered**, and
it's a real limitation of my conclusion. The distinction I'd defend: LBMA/COMEX have *both*
mechanism and watchers; 5pm has only watchers.

**What would refute the recommendations:** a measurement on real gold data showing PDC/prior-week
levels produce reactions equal to or better than reaction zones and round numbers. That test is
cheap — see §7.

**Corpus limitations:** zero gold-specific academic evidence on levels; Osler is FX-only and
from 1999–2000; nothing verified against primary text.

---

## 6. Build list, ranked by (evidence × feasibility)

| # | Change | Effort | Basis |
|---|---|---|---|
| 1 | **Track the LBMA PM print (15:00 London)** as a level and session marker | S | F1 — highest-value addition |
| 2 | **Add COMEX settlement (13:29–13:30 ET)** as a second reference/marker | S | F1 |
| 3 | **Decay the COT driver's weight through the week** (or show its true as-of date) | XS | F3 |
| 4 | **Add COMEX warehouse stocks** — the only daily-fresh fundamental available free | M | F3 |
| 5 | **Flag the Friday position-squaring window** rather than the weekly close | S | F1 |
| 6 | **Demote prior-day close** in `nearLevel()`; promote round numbers / reaction zones | XS | F2 |
| 7 | Distinguish monthly/quarterly gold options expiry from daily weeklies for event risk | S | F3 |
| — | ❌ Do **not** build: max pain, GEX, AISC floor, seasonality weighting | — | F3 |

---

## 7. What I could not establish — and the test that settles it

**No gold-specific academic evidence exists for any level type.** Everything above extrapolates
from FX (Osler) or equities (closing auctions, pinning). That extrapolation is plausible but
unproven.

I also **could not test any of this on real gold data** — the sandbox blocks market-data hosts
(Binance/Kraken) exactly as it blocks WebFetch, and the Playwright harness runs on synthetic
candles.

**The test you can run, in your own browser, where the data works:**

For each candidate level type (PDC, PDH/PDL, prior-week close, round $25/$50/$100, reaction
zones, VWAP), over the last ~2 years of daily and H1 candles:

1. Mark every instance where price came within 0.1×ATR of the level.
2. Measure the **maximum favourable excursion** over the next N bars (N = 4, 12, 24).
3. Compare against **randomly-chosen control price points** in the same sessions — this is the
   Osler bootstrap method, and it is the step that separates evidence from confirmation bias.
4. A level type earns its place only if it beats the random control by a margin that survives
   spread.

That harness would give you *gold-specific, your-data* grades to replace the borrowed FX/equity
grades in §3 — and it's the same instrument logic as your existing Edge Tracker. Say the word
and I'll build it.

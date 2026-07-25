# F3 — Information sources, ranked by whether a *daily* engine can actually use them

**Status:** CONFIRMED
**Evidence type:** primary (exchange/regulator publication schedules) + industry
**Confidence:** high on cadence/lag facts; figures search-derived.

---

## The filter that matters

For a daily-horizon engine, an information source is only usable if **freshness ≤ decision
frequency**. Quarterly data cannot drive a daily signal no matter how good it is. Sorting the
gold information stack by that criterion:

| Source | Cadence | Real lag | Daily-usable? |
|---|---|---|---|
| **LBMA Gold Price auction** (10:30 & 15:00 London) | **Twice daily** | **Real-time** | **✅ Yes — best in class** |
| **COMEX settlement** (13:29–13:30 ET) | **Daily** | Real-time | **✅ Yes** |
| **COMEX warehouse stocks** (registered/eligible) | **Daily** | ~1 business day (T published T+1) | **✅ Yes — best daily-fresh *fundamental*** |
| Gold futures aggregate open interest (CME) | Daily | ~1 day | ✅ Yes |
| Gold ETF holdings/flows (WGC Goldhub) | Weekly snapshot | Published following Monday (~2–7 days) | ⚠️ Weekly backdrop only |
| **CFTC COT** | Weekly (Fri) | Data as of **prior Tuesday** → 3-day lag at release, **up to ~9 days stale** before the next one | ❌ Positioning backdrop only |
| Central bank purchases (IMF IFS via WGC) | Monthly | **~2 months**, longer for non-compliant reporters | ❌ Slow macro layer |
| WGC Gold Demand Trends | Quarterly | ~1 month after quarter-end | ❌ Structural narrative only |
| CTA trigger levels | No schedule | Proprietary bank-desk estimates, not an auditable feed | ❌ Qualitative flag at best |

## The two headline takeaways

### 1. COMEX warehouse stocks is the best daily fundamental you're not using

It is **daily, ~1-day lag, free, and published by CME** — the only genuinely daily-fresh
fundamental data point found in the entire gold stack. Everything else on the fundamental side
is weekly-to-quarterly. Your platform currently carries none of it.

### 2. Your COT driver is staler than it looks

COT data is collected **Tuesday**, published **Friday**, and then sits unchanged until the next
Friday. So on a Thursday, the engine's "positioning" input reflects the market **nine days ago**.
It is currently weighted the same (w1) as same-day feeds. That is a mismatch worth encoding —
either decay its weight through the week or mark its true as-of date prominently.

---

## What is NOT obtainable (and should be dropped from consideration)

**Options-derived levels — gamma exposure, zero-gamma flip, max pain — fail the platform's
free/keyless constraint.**

- Aggregate gold *futures* OI is free (CME, Goldhub, CFTC).
- But **strike-level *options* OI**, which GEX/max-pain require, sits behind **CME QuikStrike** —
  an interactive JS app pushing registration, not a keyless JSON/CSV endpoint. Not fetchable
  from a static client-side page.
- Every GEX vendor found (SpotGamma, GEXboard, FlashAlpha, ApexVol) computes **SPX/SPY only** —
  no free gold equivalent exists.

The underlying mechanism is real — **Golez & Jackwerth (JFE)** quantified expiry pinning in S&P
500 *futures* at ~16.5bps average distortion via dealer delta-hedging — but there is **no
gold-specific pinning study**, and the data blocker is decisive regardless.

**Max pain specifically: don't build it.** The one rigorous paper found (Filippou, Garcia-Ares
& Zapatero, 25-year US sample) reportedly finds the effect concentrated in **small-cap/illiquid**
names — weak for large, liquid, arbitraged instruments. Gold is large, liquid and macro-driven:
exactly the profile where it fails.

**One caveat on expiry as event risk:** CME expanded GC weekly options to Monday+Wednesday
(May 2023) then Tuesday+Thursday (Jan 2024), so gold options now expire **nearly every business
day**. "Expiry day" is no longer informative unless you distinguish high-OI monthly/quarterly
expiries from daily weeklies.

---

## Fundamental "levels" — mostly not actionable right now

- **AISC (all-in sustaining cost) floor:** global median reportedly **$1,500–$1,650/oz** (S&P
  Global 2026 outlook). With gold trading at a large multiple of that, AISC is **currently
  irrelevant as a tradeable floor** — a slow structural reference that only matters in a deep,
  sustained drawdown.
- **Central bank buying:** verdict is **mostly programmatic** (mandate-driven reserve
  diversification), with a plausible-but-unproven "buy dips, don't sell rips" tilt. No rigorous
  event study found. Combined with the ~2-month IMF reporting lag, it cannot function as a
  timing input — only as a structural bid narrative.
- **Seasonality:** **low confidence.** One study finds September and November significant
  ("autumn effect"); an independent critique claims reliability is *lowest* in
  November/December — a direct contradiction between sources. Treat as low-weight at most.

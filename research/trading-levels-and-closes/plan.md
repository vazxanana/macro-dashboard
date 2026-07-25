# Plan — Trading Levels, Edges, and the Significance of Closing Prices

**Slug:** `trading-levels-and-closes`
**Started:** 2026-07-24
**Depth:** deep
**Genre:** landscape (map the space of tradeable levels + information sources) → decision

---

## Phase 1 — Reframe

### As asked
"Find edges and sources of information important for trading. Find levels to trade from mixing
technicals and fundamentals, paying special attention to weekly and daily closing prices."

### The decision underneath
The platform currently derives levels almost entirely from **intraday price geometry**: swing
structure (`structureMap`), supply/demand order blocks, and historical reaction zones. The real
question is:

> **Which additional reference prices should the engine compute and display — and is there
> evidence that closing prices specifically deserve privileged treatment over the intraday
> highs/lows the platform already uses?**

### The insight the emphasis points at
The user singled out weekly and daily *closes*. That is a substantive instinct worth testing,
because a close is not just "another price" — it is the price at which the **largest
concentration of institutional volume actually transacts** (closing auctions, market-on-close
orders, benchmark fixings, index rebalancing, and for gold specifically the **LBMA Gold Price
auction**, which is the global settlement benchmark).

If that is true, then closes are *informationally privileged*, and levels derived from closes
should behave differently from levels derived from intraday extremes. The platform's
`structureMap` already half-believes this — it requires a **body close** through a level to
confirm `bos`/`ChoCh` rather than a wick touch. This investigation tests whether that instinct
generalises to level *selection*, not just break *confirmation*.

### Falsifiable hypotheses

| # | Hypothesis | Refuted if |
|---|-----------|-----------|
| **H1** | Closing prices are informationally privileged because institutional/benchmark volume concentrates at the close (closing auctions, MOC, LBMA fix); this makes close-derived levels more meaningful than arbitrary intraday prices. | Evidence that volume/price discovery is uniformly distributed through the session, or that closes carry no special informational content. |
| **H2** | Close-based confirmation (body close through a level) materially reduces false breaks vs wick/touch confirmation. | Evidence that close-confirmation adds no accuracy, or merely adds lag without reducing false signals. |
| **H3** | Prior-period closes (PDC, prior *weekly* close) function as distinct reference levels with measurable reaction, separate from prior highs/lows. | Evidence that prior closes show no more reaction than random price points. |
| **H4** | The **weekly** close carries disproportionate weight vs the daily close for regime/trend determination — i.e. higher timeframe closes are not just slower, they are qualitatively more informative. | Evidence that weekly closes are simply smoothed daily closes with no additional information, or that the apparent edge is an artifact of fewer observations. |

### Explicitly out of scope
- Anything requiring paid/real-time data feeds (platform is keyless/free-feed only).
- Order-flow / tick-level microstructure (not consumable in-browser).
- Level *drawing* aesthetics — this is about which levels have evidence behind them.

---

## Phase 2 — Genre & blocks

**Genre:** landscape → decision

**Blocks:**
1. Why closes matter (mechanism: where institutional volume actually prints)
2. The level taxonomy — every candidate level, with evidence grade
3. Information sources that matter for gold specifically (and their real cadence/lag)
4. What the platform already has vs what's missing
5. Adversarial pass — the case that levels are self-fulfilling / that this is astrology
6. Concrete build list, ranked

---

## Phase 3 — Sourcing strategy

### Subtopic → agent map (parallel fan-out)
| Agent | Subtopic | Source range |
|---|---|---|
| 1 | Gold benchmark & settlement mechanics: LBMA auction, COMEX settlement, what the "official" gold price even is | 01–09 |
| 2 | Closing-price informational efficiency: closing auctions, MOC volume concentration, close-to-close vs intraday | 10–19 |
| 3 | Weekly / higher-timeframe close edges; HTF close as trend filter | 20–29 |
| 4 | Reference levels with documented reactions: PDH/PDL/PDC, prior week levels, round numbers, opening range | 30–39 |
| 5 | Options-derived levels for gold: gamma exposure, max pain, large OI strikes, expiry effects | 40–49 |
| 6 | Fundamental/flow levels + information sources: central bank buying, ETF flows, production cost, CTA triggers | 50–59 |

### Opposition queries (mandatory, run regardless of confirming evidence)
- "support resistance levels do not work / no statistical evidence"
- "technical analysis self-fulfilling prophecy criticism"
- "round number effect disappeared / not exploitable after costs"
- "max pain theory debunked"
- "closing price no more informative than intraday"

### Triangulation rule
≥3 independent, differently-typed sources per thesis. Below that → labelled *insufficient
evidence*.

### Risk register
| Risk | Mitigation |
|---|---|
| **WebFetch blocked org-side** (confirmed again this session: `example.com` → 403) | Investigation runs at reduced evidentiary standard; every source file labelled unverified; findings that rest on code/arithmetic flagged as the reliable tier |
| Retail TA content dominates search results and is marketing | Cap broker/vendor credibility at ≤2 unless methodology is published; require academic/primary corroboration for any thesis |
| Level-based claims are unfalsifiable as usually stated | Demand *specific, testable* formulations; anything untestable ships as opinion not finding |
| No real market data available in sandbox (proxy blocks Binance/Kraken too) | **Deliver a runnable empirical harness** the user executes in their own browser, rather than asserting untested numbers |

### Stop criteria
Each of H1–H4 has ≥3 differently-typed sources OR is explicitly marked insufficient; opposition
queries run and incorporated; a concrete build list exists.

---

## Changelog
- 2026-07-24 — plan created; hypotheses committed before searching.
- 2026-07-24 — Phase 3.5: WebFetch re-tested and **still blocked** (`example.com` → HTTP 403),
  though the proxy's `recentRelayFailures` log had rotated to 0. WebSearch functional.
- 2026-07-24 — Phase 4: 6 sub-agents in parallel; **59 source files** written (16 academic,
  14 primary, 21 industry, 6 discussion). Telling agents up front that WebFetch was blocked
  avoided the rediscovery cost that consumed budget in the previous investigation — every agent
  produced source files this time (vs 2 of 6 last run).
- 2026-07-24 — Phase 5: `sources.csv` built. Credibility spread 5:15 / 4:15 / 3:11 / 2:17 / 1:1.
  Discussion-source gap from the previous investigation is closed.
- 2026-07-24 — Phase 6: F1–F3 written. **H1 partially refuted, H3 and H4 refuted** — the
  hypotheses committed in Phase 1 did not survive contact with the evidence, which is the
  intended behaviour. Adversarial pass includes a counter-argument I could not refute (5pm ET
  may matter reflexively even without an auction mechanism).
- 2026-07-24 — Phase 6.5: 14 load-bearing claims spot-checked — all traced. 59/59 files carry
  an explicit unverified label.
- 2026-07-24 — Phase 7: `refresh_targets.md` written with drift detection and an empirical
  harness spec (Osler bootstrap on real gold data) as the arbiter.

# macro-dashboard — working notes

Single-file gold trading platform: everything lives in `gold-trading.html`
(HTML + CSS + JS inline). Deployed to GitHub Pages via
`.github/workflows/deploy.yml` on every push to `main`.

## Locked features — do NOT remove or replace in redesigns

- **Market structure engine** (`structureMap` + `makeStructPrimitive` +
  `renderStructReadout`): major-structure mapping on the Multi-Timeframe
  charts — `bos` only at the ratcheting trend extreme, `ChoCh` only at the
  protected origin swing, dashed gray `idm` inducement marks, dashed amber
  liquidity `sweep` marks, and the plain-language structure readout under
  each chart. The owner explicitly asked to keep this. Display preference
  (also owner-requested): all MTF charts hide the HH/HL/LH/LL swing tags
  and the "bos" label text (`structOpts: { hideTags, hideBosLabel }`);
  break lines still draw and ChoCh stays labelled.
- **Supply/demand order-block zones** (`sdZones` via `structureMap(...).zones`):
  green demand / red supply boxes at break-leg origins on the MTF charts
  (ChoCh origins drawn brighter), live until a body close through the far
  side. These replaced the engulfing zones on the MTF tab — do not bring
  the engulfing zones back there. The EG desk charts keep their own
  engulfing zones (that is the strategy being traded there).

## Macro driver stack

15 rows feed `computeDailyBias()` — **13 voting drivers + 2 context rows**.
Voting: real yields, structural demand & seasonality, daily structure, S/D
block location, VIX, real-yield momentum, breakeven, 2Y, DXY momentum, COT,
yield curve, HY spreads, Eurozone growth pulse. Several are mined from an
institutional macro handbook the owner supplied (Dollar Smile theory, global
dollar liquidity, Germany/Eurozone, Japan) — see `dollarSmileRegime()` and
the `fundX.euGrowth` / `fundX.jpyMom` / `fundX.sofr` fetches in
`refreshFundamentalsX()`.

### Rules that must not be "fixed" away

- **Context rows** (`addCtx`, `ctx: true`, `w: 0`) are non-directional **by
  design** and are excluded from `wVote`, `wTot`, coverage and cluster
  ratios. Two exist: **Yen carry-unwind risk** (a volatility warning — don't
  make it vote a direction) and **Dollar Smile regime**.
- **Dollar Smile is a regime MODIFIER, not a vote.** It is a deterministic
  function of DXY momentum, HY spreads, DGS2, VIX, swap lines and SOFR−EFFR
  — five of which already vote on their own rows — so voting it too was
  double-counting dressed as independent breadth. It now scales
  `st.regimeMult` (0.8 stress / ±0.85–1.1 aligned-or-not) which multiplies
  the confidence **excess over 50**, so it can never flip `st.dir`.
- **`src` on every voting row** names the underlying data series.
  `st.concentration` reports the largest single-series share of the vote
  (currently ~33% on DFII10) and is surfaced in the confidence line — the
  dependency is disclosed, not silently corrected.
- **`st.coverage` means feed health only** — weight lost to rows whose
  detail says `no data`. A live feed reading neutral must not count as an
  outage.
- The Analysis-tab composite (`computeMacroScore`) still contains real
  yields + DXY + VIX; the Daily Bias driver deliberately keeps only the
  orthogonal slice (WGC central-bank flows + `macroSeasonalScore()`).

## Conventions

- Any change to `gold-trading.html` should keep the file self-contained
  (no build step, no external JS beyond the Lightweight Charts CDN and
  keyless public data APIs).
- Test headlessly with Playwright before deploying; verify the Pages
  deploy run goes green after merging.

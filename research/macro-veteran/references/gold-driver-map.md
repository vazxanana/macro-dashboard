# Gold Driver Map: Mechanisms, Evidence, and Tests

**Use:** A research framework for XAU/USD and gold-linked markets. This is a causal map and a set of research tests, not a price forecast or trading signal. Gold reacts to the marginal buyer and the opportunity cost of holding it; no single indicator explains every regime.

## Executive model

Think of gold through two linked horizons:

- **Short-run price formation:** investment demand, currency and rate repricing, risk hedging, flows, positioning, and momentum can move the marginal price quickly.
- **Long-run demand and valuation:** real wealth/income, reserve allocation, jewelry/technology demand, mine supply, recycling, and the stock of above-ground metal shape the market more slowly.

The World Gold Council's Gold Return Attribution Model groups drivers into economic expansion, risk and uncertainty, opportunity cost (FX and interest rates), and momentum. It is useful as a structured historical decomposition, but it is an industry model and its attributed contribution is not proof of a causal effect. [GRAM and its stated limits](https://www.gold.org/goldhub/tools/gold-return-attribution-model)

## Channel map

| Channel | Mechanism | Evidence to watch | Why a simple rule fails |
|---|---|---|---|
| **Real-rate opportunity cost** | Gold has no coupon. A rise in expected real returns on safe interest-bearing assets can raise the opportunity cost of holding gold and weigh on price, all else equal. | TIPS real yields by maturity; rate futures/OIS; central-bank path repricing; gold response after rate surprises. | Nominal yields alone conflate expected inflation, expected real policy, and term premium. The historical relationship is regime-dependent; long-run co-movement does not mechanically forecast daily returns. A Chicago Fed study finds an inverse real-rate relationship across several specifications, but its daily model explains only a small share of daily variation. [Chicago Fed empirical study](https://www.chicagofed.org/publications/chicago-fed-letter/2021/464) |
| **Inflation and inflation expectations** | Gold may preserve purchasing power over long horizons and may attract demand when confidence in fiat purchasing power weakens. | Survey inflation expectations; breakevens; inflation surprises; inflation-risk discussion in central-bank communication. | A hot CPI print may lift expected tightening, real yields, and the dollar, initially pressuring gold. Breakeven inflation is not a pure expectation measure: it also reflects inflation-risk and TIPS-liquidity premia. Chicago Fed results differ by frequency/specification, a warning against the slogan “inflation up, gold up.” [Chicago Fed study](https://www.chicagofed.org/publications/chicago-fed-letter/2021/464), [IMF Working Paper on economic news and commodity prices](https://www.imf.org/-/media/websites/imf/imported-full-text-pdf/external/pubs/ft/wp/2009/_wp09140.pdf) |
| **US dollar and currency denomination** | Gold is quoted globally in USD. A weaker dollar can make USD gold cheaper for non-US buyers and often coincides with supportive macro conditions; gold can also be a hedge against dollar depreciation. | Broad USD indices; major currency crosses; local-currency gold prices; FX rate differentials and policy divergence. | USD and gold can rise together during stress, or both fall when liquidity demand dominates. Check gold in EUR, JPY, GBP, INR, and CNY terms; USD-price changes can hide a different local-market experience. Correlation is not a stable conversion rule. |
| **Growth and income** | Higher global income can support jewelry, technology, and investment demand. Growth also changes yields, currencies, and risk appetite. | Global output/income; manufacturing and consumption; jewelry/technology demand; local-currency prices and physical-market indicators. | Growth has offsetting channels: it can increase consumer demand while raising real yields and reducing defensive allocation. A single “risk-on means gold down” label discards these mechanisms. The Chicago Fed analysis finds real world GDP important in long-run real gold prices, while quarterly GDP news was not precisely estimated in its sample. [Chicago Fed study](https://www.chicagofed.org/publications/chicago-fed-letter/2021/464) |
| **Risk, safe haven, and liquidity** | Investors may buy gold as protection against geopolitical, financial, or macroeconomic risk. | Geopolitical-risk measures; credit spreads; funding stress; volatility; ETF flows; response of gold to separately identified risk events. | Safe-haven behavior is conditional. In a liquidity squeeze, investors may sell liquid gold to meet margin calls or raise cash. A 2026 BIS working paper finds geopolitical shocks raise gold returns more in looser financial conditions and suggests investors' capacity to rebalance is central; this is a working paper, not a universal law. [BIS Working Paper 1380](https://www.bis.org/publications/working-paper-1380-chasing-el-dorado-gold-under-shifting-geopolitical-and-financial-condition) |
| **Official reserves and central banks** | Reserve managers may diversify, seek liquidity, or reduce exposure to other reserve assets. Official buying can be less sensitive to short-term rate moves than tactical investment demand. | IMF IFS and central-bank statements; WGC country-reserve files; quarterly WGC demand estimates; compare tonnage with price-valuation effects. | Published reserve values rise mechanically when gold's price rises; value growth is not the same as purchases. Reported changes are delayed and may miss unreported transactions. WGC monthly country data are typically two months in arrears. [WGC reserves data and timing](https://www.gold.org/goldhub/data/gold-reserves-by-country); [IMF note on central-bank gold reserves](https://www.elibrary.imf.org/view/journals/068/2026/007/article-A001-en.xml) |
| **Investment flows and positioning** | ETF demand, futures positioning, and momentum can amplify the price response of the marginal investment buyer. | Gold ETF holdings/flows; CFTC COT categories; COMEX volume/open interest; options implied volatility and skew where licensed. | COT is delayed and covers reportable futures positions, not the whole market. ETF flows are one channel, not all investment demand. Open interest does not reveal who owns options or dealer direction. Treat positioning as crowding/fragility context, not a standalone direction call. |
| **Physical supply, recycling, and local demand** | Mine output and recycling respond more slowly than many financial flows. Consumer demand and local premiums vary with income, seasonality, policy, FX, and price. | WGC quarterly supply/demand; mine-company reports; exchange stocks; customs data; local premiums and import rules where reliable. | There is no single public ledger for global physical gold flows. Some data are delayed, estimated, or commercially held. Exchange warehouse stocks, London vault holdings, and ETF metal are different inventories and should not be added without checking definitions. |

## Event interpretation: use the chain, not the headline

For a macro or geopolitical event, write the chain explicitly:

**New information → change in expected real rates / USD / risk / liquidity → investor or physical demand response → observed XAU and cross-asset reaction.**

For example, an inflation surprise has at least two opposing paths:

1. Higher expected inflation may increase demand for inflation protection.
2. If markets expect a stronger central-bank response, real yields and the dollar may rise, increasing gold's opportunity cost.

The observed move tells you which forces dominated in that window; it does not establish which will dominate next. Record the actual, timestamped consensus, prior and revised values, and a defined price-response window.

## A practical weekly evidence panel

1. **Rates:** 2-, 5-, and 10-year TIPS real yields; nominal yields; breakevens; next-meeting and 6–12 month policy pricing.
2. **FX:** broad USD plus EUR, JPY, GBP, INR, and CNY; gold return in local currencies.
3. **Risk/funding:** credit spreads, volatility, repo/funding measures, and clearly defined geopolitical event indicators.
4. **Flows/positioning:** ETF tonnage and flows; COT net positions, percentile, and weekly change; COMEX volume and open-interest change.
5. **Official/physical demand:** reported central-bank purchases separated from valuation changes; WGC supply/demand estimates; local premiums and exchange stocks with date/coverage labels.
6. **Price confirmation:** spot/benchmark source, futures curve, realized volatility, and event-window return. Check the benchmark and feed licensing before storing or redistributing prices.

For each series, preserve the reference period, actual publication timestamp, retrieval timestamp, units, revision/vintage, and coverage. Use the [Macro and Gold Source Registry](macro-gold-source-registry.md) for publisher links and known lags.

## Gold evidence crosswalk: stocks, flows, positions, and turnover

These indicators describe different layers of the gold system. Keep their units and perimeters separate; do not add them into a single “physical demand” number.

| Observation | What is actually measured | Valid use | Do not infer |
|---|---|---|---|
| **Gold ETF holdings and flows** | WGC reports holdings in tonnes and estimated investor cash flows in USD; it defines ETF demand as the change in gold holdings. Holdings/AUM, holdings change, and USD fund flow are distinct series and may diverge over short windows. | Measure the listed physically-backed ETF channel; compare regional/fund contributions with price and other investment demand. Preserve the WGC methodology vintage. | AUM change as net investor buying; tonne change and USD flow as interchangeable; ETF holdings as additional stock to London vault totals without checking overlap. [WGC ETF methodology](https://www.gold.org/node/16223) |
| **LBMA London vault holdings** | End-month stock in tonnes of gold physically held in London-area custodial vaults, including commercial vaults and Bank of England holdings; reported one month in arrears. It covers vaults within the M25 and begins July 2016. | Track the reported custody-stock level and month-to-month change; compare with cross-border customs and ETF changes. | Freely available float, investor-owned gold, mine supply, or a change in global stock. ETF bars may be among the vault bars; the published total does not disclose owner-purpose composition. [LBMA vault data and definitions](https://www.lbma.org.uk/prices-and-data/london-vault-data) |
| **LBMA clearing / trade activity** | Net physical transfers settled through Loco London clearing members, published as daily averages; LBMA Trade Data is a separate transaction dataset with its own coverage. | Measure activity within the stated reporting/clearing perimeter and compare its change with price/liquidity conditions. | A count of all OTC trades, global turnover, directional buying, or a change in physical stock. [LBMA clearing data](https://www.lbma.org.uk/prices-and-data/clearing-data) |
| **COMEX warehouse stocks and delivery** | Daily registered and eligible inventories at approved depositories, plus notices/receipts/withdrawals. “Eligible” meets specifications but is not necessarily warranted for delivery. | Assess deliverable-market positioning and warehouse movement alongside calendar spreads, delivery notices, and basis. | All global inventory, immediate deliverability of eligible metal, or final-consumer demand. [CME stocks and delivery reports](https://www.cmegroup.com/clearing/operations-and-deliveries/registrar-reports.html) |
| **SHFE gold warrants and futures** | Weekly SHFE gold inventory equals gold registered as standard warehouse warrants, in kilograms; daily futures prices are CNY/g and volume/open interest are lots (1 kg per lot). | Track exchange-registered deliverable stock and separately analyze local futures curve, volume, and open interest. | All gold in approved depots, all Chinese stocks, or physical end-user demand. Keep warrant stock separate from SHFE open-interest contracts. [SHFE statistical reports](https://www.shfe.com.cn/eng/reports/) |
| **SGE delivery and withdrawal** | Monthly SGE highlights report delivery volume, trading volume, delivery ratio, and withdrawal volume in kg as separate measures. For October 2026 they report 613,288.68 kg delivery, 92,083.24 kg withdrawal, and a 51.03% delivery ratio in the report's delivery table. | Track exchange delivery and subsequent withdrawal as separate stages of SGE account activity. Compare with SGE price/premium, customs and other inventory. Preserve the delivery table's own denominator: it differs from the wider Au-products trading-volume total elsewhere in the same report. | Final Chinese consumption: delivery is not the same as withdrawal, and withdrawal does not establish whether bullion was consumed, re-deposited, transformed, or exported. Do not recompute delivery ratio with the wider product turnover series. [SGE October 2026 report](https://en.sge.com.cn/upload/file/202611/04/daed424d-8d57-4769-8409-74547a3fc1af.pdf) |
| **Swiss customs gold flows** | FOCBS/SwissImpex reports monthly partner-country imports and exports of unwrought gold (tariff 7108.1200) from 2012. Since 2021 imports distinguish mined gold (911), refined ≥99.5% (912/913), and refined <99.5% (914). On the 7 November brief cutoff, September was the latest available month; October was scheduled for 19 November. | Measure declared border movements through a major refining/transit hub and compare partner mix with London vault/clearing and other customs routes. Preserve month, partner, tariff, import subdivision, gross-weight/value units and release vintage. | This is movement, not ownership, final consumption, net demand or stock change. Reported import category/country does not prove mine origin after refining; exports lack the same category split. Doré gross weight is not fine-gold content. FOCBS requires attribution; commercial reuse requires permission. Do not quote totals unless checked against the raw official export. [FOCBS gold statistics](https://www.bazg.admin.ch/en/swiss-foreign-trade-statistics-gold-silver-and-coins), [release calendar](https://www.bazg.admin.ch/en/swiss-foreign-trade-statistics-database-opendata), [I14Y import data](https://opendata.swiss/en/dataset/waren-aussenhandel-goldimporte-nach-landern) |
| **CFTC COT positions** | Weekly reportable futures/options positions by trader category, in contracts, as of the report's position date. | Describe listed positioning, crowding, and potential fragility with open interest, gross long/short, spreads, and publication lag. | Physical buying/selling, trader identity, motive, or the complete global net book. [CFTC COT reports and definitions](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm) |
| **Customs trade flows** | Reported imports/exports by national tariff code, quantity and value, with a customs reference period and revision process. | Measure declared border flows for the exact product code; use quantity and partner detail where available. | Domestic consumption, all transit/re-export channels, or contemporaneous market demand. Reconcile reporting definitions before comparing countries. [Issuer and physical-flow data map](issuer-and-physical-flow-data-map.md) |

For price conversion, convert the local gold quote and FX rate at matched timestamps and retain the exact price basis, contract/product, tax treatment, and trading session. If USD/CNY is quoted as CNY per USD, a CNY-per-gram price converts to USD per troy ounce as `CNY_per_gram ÷ USD/CNY × 31.1034768`. A resulting local premium is still not a shortage measure until differences in tax, product, financing, delivery location, and market hours are addressed.

## Analysis design: prevent common false conclusions

- **Use returns or changes for short-horizon questions.** Regressing persistent price and yield levels can produce spurious relationships. The Chicago Fed paper explicitly discusses persistence concerns and reports very low explanatory power in its daily specification.
- **Separate horizon and regime.** Estimate event-window responses, monthly relationships, and structural trends separately; do not apply an annual relationship mechanically to intraday trading.
- **Control for overlapping drivers.** Real yields, USD, growth expectations, and risk often move together. Use a transparent multivariate model or event study, then report collinearity and omitted-variable risks.
- **Use surprises, not raw releases.** For event studies, use consensus captured before the release. If unavailable, label the analysis as a reaction study, not a surprise study.
- **Test nonlinearities.** Compare ordinary conditions with liquidity stress, geopolitical escalation, and policy regime changes. BIS research documents state-dependent geopolitical effects.
- **Treat flow variables as endogenous.** ETF inflows and futures positioning may respond to price as well as influence it. Lagged flows and event timing help describe sequencing but do not by themselves prove causality.
- **Validate out of sample.** Freeze definitions and parameters before the holdout period, include transaction costs where relevant, and compare against simple baselines. Report failure cases, not only periods the model explains well.
- **Keep model residuals visible.** Unexplained moves can signal omitted drivers, data problems, or regime change. Do not rename a residual “geopolitical premium” without independent evidence.

## Reading the model evidence correctly

The Chicago Fed study uses different frequencies and specifications; its findings support real-rate sensitivity but show that inflation and growth results vary with method and horizon. It cautions that regressions on nonexperimental data establish associations, not causality. The BIS 2026 paper adds evidence that geopolitical-risk effects vary with financial conditions. The WGC attribution model provides a practical set of driver categories, but it is a proprietary industry model and should be cross-checked against independently sourced data and research.

## Before publishing a gold view

- [ ] State timeframe and as-of timestamp.
- [ ] Identify the marginal channel believed to matter now and the evidence for it.
- [ ] Show at least one plausible counter-channel.
- [ ] Check whether the USD quote and local-currency prices tell the same story.
- [ ] Separate physical/official demand from price-driven valuation effects.
- [ ] State whether positioning is current, lagged, estimated, or partial-market.
- [ ] Distinguish event reaction from a causal claim or forecast.
- [ ] Name the next observable event or condition that would change the view.

## Research references

- Barsky, Epstein, Lafont-Mueller, and Yoo, *What Drives Gold Prices?*, Chicago Fed Letter 464 (2021): [article](https://www.chicagofed.org/publications/chicago-fed-letter/2021/464).
- Guerra and Zelpo, *Chasing El Dorado: gold under shifting geopolitical and financial conditions*, BIS Working Paper 1380 (6 Oct 2026): [paper page](https://www.bis.org/publications/working-paper-1380-chasing-el-dorado-gold-under-shifting-geopolitical-and-financial-condition). Authors note views are their own, not necessarily those of BIS/member central banks.
- IMF, *Gold in Central Bank Reserves: Strategic Considerations, Market Risks, and Practical Guidance* (2026): [IMF note](https://www.elibrary.imf.org/view/journals/068/2026/007/article-A001-en.xml).
- Roache and Rossi, *The Effects of Economic News on Commodity Prices: Is Gold Just Another Commodity?*, IMF Working Paper 09/140: [paper PDF](https://www.imf.org/-/media/websites/imf/imported-full-text-pdf/external/pubs/ft/wp/2009/_wp09140.pdf).
- World Gold Council, [Gold Return Attribution Model](https://www.gold.org/goldhub/tools/gold-return-attribution-model) and its linked [model methodology PDF](https://www.gold.org/download/file/17021/GRAM%20Methodology%20Document.pdf).

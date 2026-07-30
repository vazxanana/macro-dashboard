# Study the relationship between VIX and COMEX gold futures price
- **URL:** https://dl.acm.org/doi/10.1145/3690001.3690025
- **Type:** academic (conference paper, Proceedings of the 2024 4th International Conference on Internet and E-Business, ACM Digital Library)
- **Date:** 2024
- **Credibility:** 2 (a minor-conference paper, not a top finance journal; ACM E-Business conference proceedings are not a specialist financial-econometrics venue, so methodology rigor and peer-review depth are uncertain — treat findings as suggestive, not authoritative)
- **Recency:** 4 (2024 publication; dataset reportedly spans January 1990 to July 2023)
- **Bias:** None apparent — academic/conference paper, no commercial affiliation identified.
- **Horizon of claims:** appears to use daily VIX and COMEX gold futures price data with VAR/Granger-causality testing over a full multi-decade sample (1990-2023) — a statistical lead-lag relationship over a long sample, not a claim about any specific day.

## Note on sourcing method
WebFetch to dl.acm.org returned HTTP 403, consistent with the systemic egress block documented across all sources in this batch. Content reconstructed from a WebSearch query restricted to the dl.acm.org domain. Not independently verified against primary-source text.

## Reported quotes/paraphrases (not independently verified against primary-source text)
> Using data "from January 1990 to July 2023 to explore the price discovery relationship during a complete market cycle of market rise, decline, and stability," the study found that "the VIX index was the Granger cause of the COMEX price, but the COMEX price was not the Granger cause of the VIX index" — i.e., a unidirectional lead-lag relationship running from VIX to gold futures, not the reverse.

> Despite the directional (Granger) finding, the paper is reported to note "VIX has little impact on Comex gold futures" in magnitude, and that "the impact of the VIX index on gold futures price may be delayed in time, meaning that changes in the VIX index may significantly impact gold futures prices after a certain amount of time."

> "The current market sentiment is unstable, and the VIX index may rise, but investors do not invest money in gold, resulting in a small impact of gold futures price on the VIX index" — describing episodes where a VIX spike does not translate into gold buying.

## Relevance
This is the one source in this batch that explicitly frames the VIX→gold relationship as directionally predictive rather than purely contemporaneous (Granger causality, by construction, is a lagged-predictability test) — but its own reported characterization undercuts its usefulness for a daily bias engine: the effect size is described as small ("little impact"), the lag length is unspecified ("after a certain amount of time," not confirmed to be one trading day), and the paper itself flags episodes where VIX rises without any accompanying gold buying. Given the low credibility (minor conference venue) and the vague lag specification, this should be read as weak, unverified suggestive evidence of *some* lagged VIX-to-gold relationship over a multi-decade sample — not as confirmation of a reliable next-day tradeable signal. It should be triangulated against, not substituted for, the stronger contemporaneous/short-lived findings in sources 20-21.

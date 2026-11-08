# Macro veteran (gptmacro_v.1) — the owner's research skill as a council member

Uploaded by the owner on 8 Nov 2026 ("add this as macro veteran so he will discuss with the macro of the council").
`council/veteran.mjs` is a code port of the parts of this skill a deterministic council member can run without an LLM or
a data budget: the shock fingerprint (cross-asset regime framework §2 and §7), the gold driver panel (gold driver map), the
discussion discipline (operating standard: facts vs interpretation, stance per topic, named invalidation) and the forecast
ledger (calibration playbook + ledger schema). The case studies, source registries and data maps of the full pack are not
copied here; the skill itself stays in the owner's Claude skills for research requests.

The veteran never fetches; it reads the Macro strategist's data (macro/forecast.json, macro/cache.json) and the council's daily
candles. Its output is a paper reading: it can lower the strategist's conviction, never flip the tested Gold Macro Score's
direction, and never issues a macro SELL (the score test found no short edge in any sub-period).

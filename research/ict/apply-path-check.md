# Apply path check (10 Nov 2026)

This note was merged by the apply workflows, with no manual merge, to check that the path works on GitHub after the owner
switched it on for Fred ("let fred have 100% control of ict"). It was sent by the assistant on the owner's instruction, not
by Fred, and it changes no rule: it adds this one file under `research/ict/`.

What ran, in order: main's verifier (`scripts/ict-apply-check.mjs`), the stop guard (`tests/desk-ict-guard.test.mjs`), the
unit suite, the build check, then the merge by `ict-apply-merge.yml`.

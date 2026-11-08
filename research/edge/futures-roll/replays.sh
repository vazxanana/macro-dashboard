#!/bin/bash
# The three replays compared in RESULT.md, all on the CNBC dump with the clock of the council-data replay (7 Nov 2026 21:16 UTC):
#   base   = origin/main's ict/replay.mjs (code root $2)
#   stage1 = this branch with bars stripped of volume (liquidFrom cuts nothing: the daily-roll fix alone)
#   final  = this branch (both fixes)
# bash replays.sh <scratch dir with cnbc.json.gz, probe.json.gz, rdata/ (council-data research/candles copy)> <old code root> <xau 5m json>
set -e
S=$1; OLD=$2; X=$3; HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../../.." && pwd)
run() { ROLL_XAU5=$X ROLL_DUMP=$S/cnbc.json.gz ROLL_PROBE=$S/probe.json.gz ROLL_NOW=2026-11-07T21:16:04Z node --import "$HERE/stub.mjs" "$1/ict/replay.mjs" "$S/rdata/ict" 2025-08-01 > "$S/$2.log" 2>&1; cp "$S/rdata/ict/replay.json" "$S/$2.json"; grep '^totals' "$S/$2.log" | cut -c1-120; }
run "$OLD" replay-base
ROLL_NOVOL=1 run "$ROOT" replay-stage1
run "$ROOT" replay-final

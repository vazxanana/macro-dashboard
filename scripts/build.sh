#!/bin/sh
# Vercel build (vercel.json buildCommand must stay under 256 characters, so the steps live here).
set -e
mkdir -p out/macro
cp -r market-structure.html gold-trading.html manifest.json app.webmanifest sw.js icon-192.png icon-512.png robots.txt assets out/
cp market-structure.html out/index.html
cp index.html out/macro/index.html
cp edge-lab.html out/
node research/edge/build.mjs out

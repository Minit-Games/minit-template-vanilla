#!/usr/bin/env bash
# Assemble, verify, and produce the ZIP to upload at https://console.minit.games
#
#   npm run package
#
# There is no build step -- the files the browser loads are the files in this
# folder. dist/ is a STAGING copy, not a build output: it holds exactly what
# the ZIP should contain, so the checks run against the real shipped shape.
#
# The Creator Console rejects an upload that still looks like a source tree, so
# package.json, tools/ and node_modules are deliberately left out, and the game
# code lives in js/ rather than src/ for the same reason.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="minit-template-vanilla"
OUT="dist/${NAME}.zip"

echo "==> staging"
rm -rf dist
mkdir -p dist
cp index.html meta.json THIRD-PARTY-NOTICES.txt dist/
cp -R js vendor dist/
# The vendoring note is for this repo, not for players.
rm -f dist/vendor/minit-sdk/README.md

echo "==> pre-flight"
node tools/check-meta.mjs

echo "==> audio"
# A build that is silent inside the app looks healthy from every other angle,
# so this measures the audio graph rather than trusting a flag. It is in the
# packaging path deliberately: a silent build cannot be shipped.
node tools/verify-audio.mjs

echo "==> packaging"
rm -f "$OUT"
(cd dist && zip -qr "${NAME}.zip" . -x "${NAME}.zip")

echo
echo "wrote ${OUT} ($(du -h "$OUT" | cut -f1 | tr -d ' '))"
unzip -l "$OUT" | tail -n +2
echo
echo "Upload ${OUT} at https://console.minit.games"

# Vendored from @minit-games/sdk@1.11.0

These files are copied VERBATIM by `tools/vendor-sdk.mjs`. Do not edit them
here -- re-run that script to update, and change the file list there if the
game starts importing more of the SDK.

The package's barrel (`dist/index.js`) is deliberately not vendored: it
statically re-exports `modules/random.js`, which imports `seedrandom`, a
CommonJS package with no ESM build that a browser cannot resolve without a
bundler or an import map. Nothing here uses seeded random, so the modules are
imported directly instead.

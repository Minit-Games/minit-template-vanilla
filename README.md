# minit-template-vanilla

> **Learn page:** [Building with AI tools](https://minit.studio/docs/build-with-ai-tools) — the official guide this template implements, and where these four starter templates are listed.

A complete, working Minit game in **plain HTML5, CSS and JavaScript**. No
bundler, no framework, no build step: the files the browser loads are the files
in this folder, and the ZIP is those same files. It is the smallest of the
templates and the one to start from when you want to see the whole thing at
once.

**The game.** A ball sits on the grass. Tap it and it bounces, and every tap
scores. Hit it again in mid-air to build a rally; let it land and the rally
resets. A 30 second clock ends the run and posts the result.

```bash
npm run dev        # a static file server on :5173 — no install needed
npm run package    # verify and write dist/minit-template-vanilla.zip
```

There is nothing to `npm install`: the template has no runtime dependencies,
and the scripts under `tools/` use only Node built-ins.

Upload `dist/minit-template-vanilla.zip` at
[console.minit.games](https://console.minit.games).

**Size.** ~177 KB zipped, and the music loop is most of it (241 KB uncompressed). The game code
is about 27 KB and the vendored SDK 13 KB.

## Tools and configuration

Everything in `tools/` needs **Node 22 or newer** and a Chromium-based browser.
There is nothing else to install — the scripts use only Node built-ins.

**The browser.** The audio gate drives a real browser over the DevTools
protocol, so it needs one present. It takes the first that exists on disk, which
on most machines means there is nothing to configure:

| OS | Tried, in order |
|---|---|
| macOS | Google Chrome, Microsoft Edge, Chromium |
| Windows | Google Chrome, Microsoft Edge *(Edge ships with Windows)* |
| Linux | `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser`, `microsoft-edge` |

Set `CHROME` to override it with any Chromium build. On macOS and Linux:

```bash
CHROME="/path/to/chrome" npm run package
```

and on Windows, from `cmd`:

```
set CHROME=C:\path\to\msedge.exe
npm run package
```

If none is found the run stops immediately and lists every path it tried.
Opera is deliberately *not* tried: it is Chromium, but several builds refuse
remote debugging and then fail exactly like a missing browser.

### On Windows, use `cmd` rather than PowerShell

PowerShell's execution policy blocks `npm.ps1`, so any `npm run …` fails with
*"running scripts is disabled on this system"* before this template runs at all.
That is a Windows security setting rather than anything here, and you do not
need to weaken it — use `cmd`, or call Node directly:

```
node tools/package.mjs
```
## Layout

```
index.html                  the page, and the Minit audio repair (read the comment)
js/main.js                  SDK lifecycle, scoring, the round clock
js/game.js                  the world: physics, rendering, and the HUD
js/layout.js                viewport-driven layout; there is no design resolution
js/audio.js                 one AudioContext: the music loop and synthesised effects
js/music.js                 generated — the loop, as inlined mu-law bytes
vendor/minit-sdk/           the SDK modules used, copied verbatim from npm
meta.json                   title, controls, logic, description, config knobs
THIRD-PARTY-NOTICES.txt
tools/                      dev server, packaging, the audio gate, the vendoring script
```

There is no `dist/` build output — `dist/` is a **staging copy** holding exactly
what the ZIP should contain, so the checks run against the real shipped shape.

### Why `js/` and not `src/`

The Creator Console rejects an upload that still looks like a source tree: no
`src/` folder, no `vite.config.*`, no `package.json` at the ZIP root. With no
build step there is no `dist/` to hide behind, so the shipped code lives in
`js/`, and `package.json` and `tools/` are simply left out of the archive.

### Why the SDK is vendored

The SDK is an npm package, and with no bundler the browser cannot resolve
`import { reportResult } from '@minit-games/sdk'` — it needs a real path.
`tools/vendor-sdk.mjs` copies the modules this game imports into
`vendor/minit-sdk/`, unmodified, and prints what it took:

```bash
npm run vendor:sdk
```

It deliberately does not vendor the package's barrel (`dist/index.js`). That
barrel statically re-exports `modules/random.js`, which imports `seedrandom` — a
CommonJS package with no ESM build that a browser cannot load without a bundler
or an import map. Nothing here uses seeded random, so the modules are imported
directly instead: no shim, no import map, and every vendored byte identical to
what npm ships.

`initializeSDK()` lives in that same barrel. The one thing it does that matters
here — `installAudioVisibilityListener()` — is called directly in `js/main.js`;
the rest is optional background and meta-tag helpers this template does not use.

**A project with a bundler should skip all of this** and
`npm install @minit-games/sdk`, importing from the package name as the docs
show. The other templates do exactly that.

### Why the HUD is drawn on the canvas

The SDK's `@minit-games/sdk/ui` module ships the standard header bar, feedback
pops and flying rewards, and the engine templates all use it. It also bundles
two woff2 faces as base64 — about 188 KB against this whole game's ~294 KB. This
template exists to be the smallest one, so the score, the clock and the feedback
banners are a few `fillText` calls in `js/game.js` instead. If you want the
platform-standard HUD, import that module and delete `drawHud`.

## The three calls that matter

A Minit drop is one session: load → play → result. There is no title screen, no
"tap to begin", and no replay menu — the host owns both ends, and the run ends
itself on a 30 second clock rather than asking the player to press a button.

| Call | When | Where |
| --- | --- | --- |
| `loadingDone()` | the first interactive frame is on screen | in the frame loop |
| `reportResult(score, { flavorText, userData })` | once, when the clock runs out | `endGame()` |
| `getConfigValue(key, default)` | wherever a knob is read | top of `js/main.js` |

Until `loadingDone()` fires the app holds its own loading screen over the
WebView, so it goes as soon as there is a real frame. After `reportResult` the
app overlays its result screen and takes focus, so the loop stops rather than
animating for nobody.

`flavorText` is a session moment rendered by the host, never in-game, and never
the score again — this template sends the best rally.

## Config values

Declared once in `meta.json`, read at runtime with `getConfigValue`. They are
what let other creators post mods of the game without touching code.

| Key | Type | Default | Effect |
| --- | --- | --- | --- |
| `pointsPerTap` | number, 1–100 | `10` | Points per tap on the ball |
| `sound` | boolean | `true` | Sound effects |
| `music` | boolean | `true` | Background music loop |

**Values always arrive as strings**, including `"false"`, so coerce every one:
`Number(...)` or `=== 'true'`. Test locally by appending them yourself:

```
http://localhost:5173/?pointsPerTap=25&music=false
```

## Audio, and why index.html is the way it is

A game can be perfectly healthy — context running, buffers queued — and
completely inaudible inside the Minit app. The app replaces every game's
`AudioContext` with a subclass whose `destination` is a mute gain it owns,
seeded at `0`, then states the real volume. Two defects can stop that landing
(both tracked in DROP-8164), and the repair for both is inline at the top of
`index.html`:

1. **On iOS the volume message is thrown away.** The game is served from
   `minitlocal://`, a custom scheme with an opaque origin, and the app posts the
   volume with `postMessage(payload, window.location.origin)` — which for an
   opaque origin is the string `"null"`, and `postMessage` *throws* rather than
   ignoring it. Retrying the same-window post with `'*'` delivers the app's own
   message, so its real intent still decides the volume.
2. **The volume is stated once, at document load.** A game whose `AudioContext`
   appears later is constructed into a `0` nobody chose, and nothing restates it
   until the next foreground transition — the "no sound until I background the
   app and come back" symptom.

The second is why the repair tracks whether the app ever spoke *at all*. From
inside the page a deliberate mute and a silence nobody asked for are identical:
both are a mute gain at `0`. An explicit `0` is honoured untouched; a `0` we
were never addressed about is repaired, and only after a real gesture.

The game's own half is in `js/audio.js`: never start audio before a gesture has
resumed the context — audio played into a suspended context is *discarded*, not
queued — and hand the context to `registerAudioContext` so the SDK suspends and
resumes it with the page.

### Verify it, don't assume it

`npm run package` will not produce a ZIP for a silent build.
`tools/verify-audio.mjs` boots the staged bundle behind a test double for the
app's audio injection, with autoplay disabled so the context starts suspended
exactly as it does in a WKWebView, taps the ball, and measures peak RMS off an
`AnalyserNode` spliced in after the mute gain. Two cases, both of which must
hold:

```
host never states a volume : audible   (the bug fixed)
host explicitly mutes      : 0.00000   (a real mute still mutes)
```

## Platform rules this template is built around

Most are enforced by `tools/check-meta.mjs`, which runs during packaging.

- **No `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, or external
  URLs.** The WebView is sandboxed with no network. This is why the music
  travels as mu-law bytes inside `js/music.js` rather than being fetched, and
  why the SDK is vendored rather than pulled from a CDN.
- **Relative paths everywhere.** The app does not serve the game from a domain
  root — on iOS it is behind the `minitlocal://` custom scheme — so an absolute
  path resolves to nothing.
- **Touch only.** Pointer events throughout, tap targets past 44 px, no hover
  and no keyboard.
- **Portrait, any aspect ratio.** The app's slot is nearer 2:3 than the 9:18 a
  phone screen suggests, and differs again on the web player — so nothing is
  hardcoded and `js/layout.js` measures the viewport every frame.

## Regenerating the music

```bash
npm run gen:music
```

Downloads the CC0 source pack (cached in `.cache/`), resamples to mono 16 kHz,
encodes as G.711 mu-law, and writes `js/music.js`. It prints the loop-seam
measurement and the round-trip SNR rather than asserting the result is fine —
swap the track and the numbers tell you whether it still loops cleanly.

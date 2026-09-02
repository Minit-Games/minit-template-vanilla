/* ==========================================================================
   Lifecycle and scoring -- the part of the template worth copying.

   The host wraps every game in the same three-call contract:

     loadingDone()     once the first interactive frame is ready
     reportResult()    once, when the run ends
     getConfigValue()  the knobs declared in meta.json

   A Minit drop is one session: load, play, result. There is deliberately no
   title screen, no "tap to begin" and no replay menu -- the host owns what
   happens either side of the run.

   There is NO BUILD STEP here. The SDK modules are imported by real path from
   vendor/ (see vendor/minit-sdk/README.md), and the browser loads these files
   as native ES modules exactly as they are written. A project with a bundler
   should `npm install @minit-games/sdk` and import from the package name.
   ========================================================================== */
import { getConfigValue } from '../vendor/minit-sdk/modules/config.js';
import { reportResult } from '../vendor/minit-sdk/modules/result.js';
import { loadingDone } from '../vendor/minit-sdk/modules/loadingDone.js';
import { installAudioVisibilityListener } from '../vendor/minit-sdk/modules/audioVisibility.js';

import { createLayout } from './layout.js';
import { createGame } from './game.js';
import { createAudio } from './audio.js';

// What initializeSDK() does that matters here. The rest of that function is
// optional background/meta-tag helpers this template does not use, and it
// lives in the package barrel, which cannot be loaded without a bundler.
installAudioVisibilityListener();

/* ---- config ----------------------------------------------------------
   Config values always arrive as strings -- the host appends every declared
   key to the game URL. Coerce, and keep a default so opening the file
   directly still works. The keys are declared in meta.json; the two must stay
   in step. */
const POINTS_PER_TAP = Math.max(1, Number(getConfigValue('pointsPerTap', '10')) || 10);
const SOUND_ON = getConfigValue('sound', 'true') === 'true';
const MUSIC_ON = getConfigValue('music', 'true') === 'true';

/* How long a run lasts. The host owns everything either side of the run, so
   the game ends itself on a clock rather than offering a button to press. */
const ROUND_SECONDS = 30;

const canvas = document.getElementById('game');
const layout = createLayout(canvas);
const audio = createAudio({ sound: SOUND_ON, music: MUSIC_ON });

let score = 0;
let rally = 0;          // taps since the ball last touched the grass
let bestRally = 0;
let bounces = 0;
let finished = false;
let remaining = ROUND_SECONDS;

const game = createGame(canvas, layout, {
	onTap() {
		rally++;
		if (rally > bestRally) { bestRally = rally; }
		score += POINTS_PER_TAP;
		audio.tap();
		game.floatText(`+${POINTS_PER_TAP}`, '#ffe27a');

		// Feedback on moments the player feels, not on every tap.
		if (rally === 3) { game.flash('RALLY x3!', '#8ee06a'); }
		else if (rally === 6) { game.flash('RALLY x6!', '#8ee06a'); }
		else if (rally >= 10 && rally % 5 === 0) { game.flash(`RALLY x${rally}!`, '#8ee06a'); }
	},

	onBounce(strength) {
		// A ball settling onto the grass produces a long tail of ever-smaller
		// bounces; counting all of them makes the end-of-run stat meaningless.
		if (strength > 0.12) { bounces++; }
		audio.bounce();
		if (rally >= 3) { game.flash('RALLY LOST', '#ffb03a'); }
		rally = 0;
	},
});

/* ---- input -----------------------------------------------------------
   Pointer events cover touch and mouse from one path, so the game is testable
   on a desktop and correct on the phone it ships to. No hover, no keyboard --
   neither exists on the device this runs on. */
canvas.addEventListener('pointerdown', (e) => {
	if (finished) { return; }
	// The gesture that starts the game is also the one that unlocks audio: a
	// context resumed outside a gesture stays suspended, and everything played
	// into it is discarded rather than queued.
	audio.unlock();
	const rect = canvas.getBoundingClientRect();
	game.tryHit(e.clientX - rect.left, e.clientY - rect.top);
}, { passive: true });

/* ---- ending the run --------------------------------------------------- */
function endGame() {
	if (finished) { return; }
	finished = true;
	remaining = 0;
	audio.finish();

	// flavorText is a session moment the host renders beneath the score --
	// never the score again, and never drawn in-game.
	const flavorText = bestRally >= 3
		? `Best rally: ${bestRally} taps without a bounce`
		: `${bounces} bounce${bounces === 1 ? '' : 's'} off the grass`;

	// Persisting anything non-empty marks this player as having played.
	reportResult(score, { flavorText, userData: 'played' });
}

/* ---- frame loop ------------------------------------------------------- */
let last = performance.now();
let ready = false;

function frame(now) {
	const raw = (now - last) / 1000;
	last = now;
	// Physics gets a hard clamp: a backgrounded tab returns with a huge delta,
	// which would teleport the ball through the ground on the first frame back.
	const dt = Math.min(raw, 1 / 20);
	// The clock gets a looser one. Sharing the physics clamp donates every slow
	// frame back to the player, and a 30 s round measurably overruns.
	const tick = Math.min(raw, 0.5);

	if (layout.measure()) { game.resize(); }

	if (ready && !finished) {
		remaining -= tick;
		if (remaining <= 0) { endGame(); }
	}

	game.step(dt);
	game.render({ score, time: Math.max(0, Math.ceil(remaining)) });

	if (!ready) {
		ready = true;
		// The app holds a loading screen over the WebView until this fires, so
		// it goes as soon as there is a real frame -- not on a timer, and never
		// behind a start button.
		loadingDone();
	}

	// After reportResult the host overlays its result screen and takes focus,
	// so anything still animating is work nobody sees. One last frame renders
	// the clock at zero, then the loop stops.
	if (!finished) { requestAnimationFrame(frame); }
}

requestAnimationFrame(frame);

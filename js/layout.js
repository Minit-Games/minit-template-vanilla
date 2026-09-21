/* ==========================================================================
   Layout.

   Minit Games' recommended convention -- not an unconditional platform
   requirement -- is to author every game against one fixed design surface
   and scale that whole surface uniformly to whatever viewport the host
   hands you, rather than deriving gameplay coordinates from the viewport
   every frame. The canonical write-up (the full rationale, the crop/fit
   math, and why the viewport meta and re-run hooks matter) lives in the
   @minit-games/sdk package README, "Screen, viewport, and scaling" --
   NOT vendored into this repo (tools/vendor-sdk.mjs vendors only the
   dist/ JS modules this game imports, and synthesizes its own short note
   at vendor/minit-sdk/README.md rather than copying the package's real
   README) -- see
   https://github.com/Minit-Games/minit-sdk#screen-viewport-and-scaling.

   The design surface here is 960x1480. Every position, size, and hitbox in
   this file and in js/game.js is authored in that fixed space; #wrapper in
   index.html is the one element that gets scaled, via a single uniform CSS
   transform recomputed in the scaler below whenever the real viewport
   changes.

   The canvas is sized in device pixels and the context is scaled, so the
   rest of the game can work in CSS pixels and still render sharply on a
   phone.
   ========================================================================== */

/** The fixed design surface, per the Minit Games house convention. */
const SURFACE_WIDTH = 960;
const SURFACE_HEIGHT = 1480;

/** Horizon as a fraction of height: sky above, grass below. */
const HORIZON = 0.62;

/** Cap the crop at 5% per axis before falling back from cover to fit. */
const MAX_CROP = 0.05;

export function createLayout(canvas, wrapper) {
	// Cap the pixel ratio: a 3x buffer on a large phone costs real frame
	// time and buys nothing visible on shapes this simple.
	const dpr = Math.min(window.devicePixelRatio || 1, 2);

	const layout = {
		width: SURFACE_WIDTH,
		height: SURFACE_HEIGHT,
		dpr,
		horizon: Math.round(SURFACE_HEIGHT * HORIZON),
		// The short edge drives scale, so a tall narrow slot and a squat wide
		// one both get a ball that fits and reads at the same size.
		unit: Math.min(SURFACE_WIDTH, SURFACE_HEIGHT * 0.62) / 100,
		ballRadius: 0,
		groundY: 0,        // y the ball's centre rests at
	};
	layout.ballRadius = Math.max(22, layout.unit * 11);
	layout.groundY = layout.horizon - layout.ballRadius * 0.35;

	canvas.width = Math.round(SURFACE_WIDTH * dpr);
	canvas.height = Math.round(SURFACE_HEIGHT * dpr);

	/* ---- the SDK's scaler recipe, adapted to this file's names ----------
	   Recomputes the uniform scale/offset for #wrapper from the real
	   viewport, cover-then-fit with a 5% max crop per axis, and reveals the
	   wrapper only once a correct first transform is in place. */
	function scaleToViewport() {
		const vw = window.innerWidth, vh = window.innerHeight;
		if (vw < 1 || vh < 1) { return; }

		const cover = Math.max(vw / SURFACE_WIDTH, vh / SURFACE_HEIGHT);
		const cropX = (SURFACE_WIDTH * cover - vw) / (SURFACE_WIDTH * cover);
		const cropY = (SURFACE_HEIGHT * cover - vh) / (SURFACE_HEIGHT * cover);
		let scale = cover;
		if (cropX > MAX_CROP || cropY > MAX_CROP) {
			// Too much loss -- fit instead, letterboxing rather than cropping.
			scale = Math.min(vw / (1 - MAX_CROP) / SURFACE_WIDTH, vh / (1 - MAX_CROP) / SURFACE_HEIGHT);
		}

		wrapper.style.transform = `scale(${scale})`;
		wrapper.style.left = `${(vw - SURFACE_WIDTH * scale) / 2}px`;
		wrapper.style.top = `${(vh - SURFACE_HEIGHT * scale) / 2}px`;
		wrapper.style.visibility = 'visible';
	}

	window.addEventListener('resize', scaleToViewport);
	window.addEventListener('orientationchange', scaleToViewport);
	window.addEventListener('load', scaleToViewport);
	window.visualViewport?.addEventListener('resize', scaleToViewport);
	new ResizeObserver(scaleToViewport).observe(document.documentElement);
	scaleToViewport();

	return {
		get: () => layout,
		/** Reset the transform every frame; a lost context comes back unscaled. */
		applyTransform(ctx) { ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0); },
	};
}

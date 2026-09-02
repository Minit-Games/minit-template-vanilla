/* ==========================================================================
   Layout.

   There is no design resolution. The game area inside the Minit app is not the
   9:18-ish phone screen the platform docs imply -- measured, it is nearer 2:3,
   and it changes again on the web player and in a desktop preview. Anything
   built around a fixed width is wrong somewhere, so every position here is
   derived from the viewport as measured on this frame.

   The canvas is sized in device pixels and the context is scaled, so the rest
   of the game can work in CSS pixels and still render sharply on a phone.
   ========================================================================== */

/** Horizon as a fraction of height: sky above, grass below. */
const HORIZON = 0.62;

export function createLayout(canvas) {
	const layout = {
		width: 0, height: 0, dpr: 1,
		horizon: 0,        // y of the grass surface
		ballRadius: 0,
		groundY: 0,        // y the ball's centre rests at
		unit: 0,           // one scale-independent unit, for sizing everything else
	};

	function measure() {
		// visualViewport is the honest number when a mobile keyboard or the
		// app's own chrome is overlapping; clientWidth is the fallback.
		const vv = window.visualViewport;
		const width = Math.round(vv ? vv.width : document.documentElement.clientWidth);
		const height = Math.round(vv ? vv.height : document.documentElement.clientHeight);
		// Cap the pixel ratio: a 3x buffer on a large phone costs real frame
		// time and buys nothing visible on shapes this simple.
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		if (width === layout.width && height === layout.height && dpr === layout.dpr) { return false; }

		layout.width = width;
		layout.height = height;
		layout.dpr = dpr;
		layout.horizon = Math.round(height * HORIZON);
		// The short edge drives scale, so a tall narrow slot and a squat wide
		// one both get a ball that fits and reads at the same size.
		layout.unit = Math.min(width, height * 0.62) / 100;
		layout.ballRadius = Math.max(22, layout.unit * 11);
		layout.groundY = layout.horizon - layout.ballRadius * 0.35;

		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';
		return true;
	}

	measure();
	return {
		get: () => layout,
		measure,
		/** Reset the transform every frame; a lost context comes back unscaled. */
		applyTransform(ctx) { ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0); },
	};
}

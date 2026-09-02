/* ==========================================================================
   The world: a ball on grass, and everything drawn behind it.

   Physics is a few lines -- gravity, a bounce with restitution, a little
   horizontal drift -- and the rest of this file is presentation. Nothing here
   knows about the SDK or scoring; it reports what happened through the
   callbacks passed to create(), and main.js decides what that is worth.
   ========================================================================== */

const GRAVITY = 2600;          // px/s^2 at unit scale 1
const RESTITUTION = 0.62;      // energy kept across a bounce
const AIR_DRAG = 0.4;
const TAP_IMPULSE = 1150;
const REST_SPEED = 40;         // below this at the surface, the ball settles

export function createGame(canvas, layout, { onTap, onBounce }) {
	const ctx = canvas.getContext('2d', { alpha: false });
	const L = () => layout.get();

	const ball = { x: 0, y: 0, vx: 0, vy: 0, squash: 0, spin: 0 };
	const clouds = [];
	const particles = [];
	let blades = [];
	let started = false;
	// Whether the ball has settled. Without this the ball never stops bouncing:
	// gravity adds GRAVITY * dt to vy every frame -- about 43 px/s at 60 fps,
	// 130 at the clamped 20 fps floor -- which is already above REST_SPEED, so
	// the settle test passes, then fails again on the very next frame. The
	// result is a permanent micro-bounce that fires the impact sound and throws
	// a burst of grass on every single frame. Raising the threshold cannot fix
	// it, because the number to beat depends on the frame rate; latching the
	// state and switching gravity off does, at any frame rate.
	// Starts true: the ball begins already at rest on the grass, and letting
	// gravity run on frame one fires a bounce -- sound and all -- before the
	// player has touched anything.
	let resting = true;

	function reset() {
		const l = L();
		ball.x = l.width / 2;
		ball.y = l.groundY;
		ball.vx = 0; ball.vy = 0; ball.squash = 0; ball.spin = 0;
	}

	/* Clouds and grass blades are generated once per size, not per frame --
	   both are static geometry that only a resize invalidates. */
	function buildScenery() {
		const l = L();
		clouds.length = 0;
		for (let i = 0; i < 5; i++) {
			clouds.push({
				x: Math.random() * l.width,
				y: l.horizon * (0.12 + Math.random() * 0.55),
				scale: 0.6 + Math.random() * 0.8,
				speed: 4 + Math.random() * 7,
			});
		}
		blades = [];
		const count = Math.round(l.width / 7);
		for (let i = 0; i < count; i++) {
			blades.push({
				x: Math.random() * l.width,
				h: l.unit * (1.6 + Math.random() * 3.4),
				lean: (Math.random() - 0.5) * 0.5,
				shade: Math.random(),
			});
		}
	}

	function resize() { buildScenery(); reset(); }

	/* ---- input ---------------------------------------------------------
	   The hit area is deliberately larger than the ball: a fingertip is about
	   44 px across and the ball is a moving target, so testing against the
	   drawn radius alone makes the game feel broken rather than hard. */
	function tryHit(x, y) {
		const l = L();
		const reach = Math.max(l.ballRadius * 1.45, 30);
		const dx = x - ball.x, dy = y - ball.y;
		if (dx * dx + dy * dy > reach * reach) { return false; }

		started = true;
		resting = false;
		const scale = l.unit / 3.9;
		// A tap SETS the upward velocity, so every hit lifts the ball the same
		// distance from wherever it already is -- which means a rally climbs,
		// and reaches the top of the sky on its second or third hit. Slamming
		// into the ceiling there sends it all the way back to the grass and
		// kills the rally exactly when the player is doing well.
		//
		// So the impulse is capped by the headroom actually left above the
		// ball. Low down it is the full pop; near the top it becomes a small
		// hop that keeps the ball hanging in the easiest place to hit it. The
		// rally can then run as long as the player keeps up, which is the
		// point of having one.
		const headroom = Math.max(0, ball.y - l.ballRadius * 1.35);
		const vMax = Math.sqrt(2 * GRAVITY * scale * headroom);
		ball.vy = -Math.min(TAP_IMPULSE * scale, vMax);
		// Hitting the ball off-centre pushes it sideways, so the player can
		// steer it rather than only pumping it straight up.
		ball.vx += (dx / reach) * 320 * scale;
		ball.spin += (dx / reach) * 6;
		ball.squash = -0.45;
		burst(ball.x, ball.y + l.ballRadius * 0.3, 14, '#fff6b0');
		onTap();
		return true;
	}

	/* Two tiny text systems standing in for the SDK's reward and feedback
	   helpers: one number floating up off the ball, one banner across the
	   middle for the moments worth calling out. */
	const floaters = [];
	const flashes = [];

	function floatText(text, color) {
		floaters.push({ text, color, x: ball.x, y: ball.y - L().ballRadius, age: 0, life: 0.8 });
	}

	function flash(text, color) {
		flashes.push({ text, color, age: 0, life: 1.0 });
	}

	function burst(x, y, n, color) {
		const l = L();
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2;
			const speed = (60 + Math.random() * 200) * (l.unit / 3.9);
			particles.push({
				x, y,
				vx: Math.cos(a) * speed,
				vy: Math.sin(a) * speed - 60,
				life: 0.45 + Math.random() * 0.35,
				age: 0,
				size: l.unit * (0.6 + Math.random() * 1.1),
				color,
			});
		}
	}

	/* ---- simulation ---------------------------------------------------- */
	function step(dt) {
		const l = L();
		const scale = l.unit / 3.9;

		if (!resting) { ball.vy += GRAVITY * scale * dt; }
		ball.vx -= ball.vx * AIR_DRAG * dt;
		ball.x += ball.vx * dt;
		ball.y += ball.vy * dt;
		ball.spin += ball.vx * dt * 0.02;

		// Walls, so a hard sideways tap cannot lose the ball off-screen.
		const r = l.ballRadius;
		if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * 0.6; }
		if (ball.x > l.width - r) { ball.x = l.width - r; ball.vx = -Math.abs(ball.vx) * 0.6; }

		// And a ceiling. A tap SETS the upward velocity rather than adding to
		// it, so each mid-air hit lifts the ball a fixed distance from wherever
		// it already was -- meaning a good rally climbs, and without this the
		// ball leaves the top of the screen exactly when the player is doing
		// well. It cannot be tapped up there, so the rally it earned dies
		// waiting for it to fall back. Bouncing it keeps it in play.
		if (ball.y < r) {
			ball.y = r;
			ball.vy = Math.abs(ball.vy) * 0.5;
			ball.squash = 0.3;
			burst(ball.x, r, 6, '#ffffff');
		}

		if (ball.y >= l.groundY) {
			ball.y = l.groundY;
			if (!resting && ball.vy > REST_SPEED * scale) {
				const impact = ball.vy;
				ball.vy = -ball.vy * RESTITUTION;
				ball.vx *= 0.86;
				ball.squash = Math.min(0.5, impact / (900 * scale));
				burst(ball.x, l.groundY + r * 0.55, 8, '#8ee06a');
				onBounce(impact / (1400 * scale));
			} else {
				ball.vy = 0;
				ball.vx *= 0.9;
				resting = true;          // a tap wakes it again
			}
		}

		ball.squash += (0 - ball.squash) * Math.min(1, dt * 11);

		for (const c of clouds) {
			c.x += c.speed * dt;
			if (c.x - 120 * c.scale > l.width) { c.x = -120 * c.scale; }
		}

		for (let i = floaters.length - 1; i >= 0; i--) {
			const f = floaters[i];
			f.age += dt;
			f.y -= 70 * (l.unit / 3.9) * dt;
			if (f.age >= f.life) { floaters.splice(i, 1); }
		}
		for (let i = flashes.length - 1; i >= 0; i--) {
			flashes[i].age += dt;
			if (flashes[i].age >= flashes[i].life) { flashes.splice(i, 1); }
		}

		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.age += dt;
			if (p.age >= p.life) { particles.splice(i, 1); continue; }
			p.vy += 900 * scale * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
		}
	}

	/* ---- rendering ------------------------------------------------------ */
	function drawSky(l) {
		const sky = ctx.createLinearGradient(0, 0, 0, l.horizon);
		sky.addColorStop(0, '#1b4a8f');
		sky.addColorStop(0.55, '#4b9fd6');
		sky.addColorStop(1, '#9fd8ee');
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, l.width, l.horizon);

		const sunX = l.width * 0.78, sunY = l.horizon * 0.24, sunR = l.unit * 7;
		const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 3.4);
		glow.addColorStop(0, 'rgba(255,241,168,0.85)');
		glow.addColorStop(1, 'rgba(255,241,168,0)');
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, l.width, l.horizon);
		ctx.fillStyle = '#fff4bd';
		ctx.beginPath();
		ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = 'rgba(255,255,255,0.82)';
		for (const c of clouds) {
			const s = c.scale * l.unit;
			ctx.beginPath();
			ctx.arc(c.x, c.y, s * 3.2, 0, Math.PI * 2);
			ctx.arc(c.x + s * 3.4, c.y + s * 0.5, s * 2.4, 0, Math.PI * 2);
			ctx.arc(c.x - s * 3.1, c.y + s * 0.7, s * 2.1, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function drawGround(l) {
		const g = ctx.createLinearGradient(0, l.horizon, 0, l.height);
		g.addColorStop(0, '#5fbf4a');
		g.addColorStop(0.25, '#3f9c35');
		g.addColorStop(1, '#1f5c22');
		ctx.fillStyle = g;
		ctx.fillRect(0, l.horizon, l.width, l.height - l.horizon);

		// Blades sit ON the horizon line, which is what sells it as a surface
		// the ball is resting on rather than a colour change.
		for (const b of blades) {
			ctx.strokeStyle = b.shade > 0.5 ? 'rgba(126,224,96,0.85)' : 'rgba(43,120,44,0.9)';
			ctx.lineWidth = Math.max(1, l.unit * 0.35);
			ctx.beginPath();
			ctx.moveTo(b.x, l.horizon + l.unit * 0.5);
			ctx.quadraticCurveTo(b.x + b.lean * b.h, l.horizon - b.h * 0.55, b.x + b.lean * b.h * 1.8, l.horizon - b.h);
			ctx.stroke();
		}
	}

	function drawBall(l) {
		const r = l.ballRadius;
		// Squash and stretch, volume-preserving, so impacts read at a glance.
		const sx = 1 + ball.squash, sy = 1 - ball.squash;

		const drop = Math.max(0, Math.min(1, (l.groundY - ball.y) / (l.height * 0.4)));
		const shadowR = r * (1.05 - drop * 0.4);
		ctx.fillStyle = `rgba(12,48,16,${0.34 - drop * 0.22})`;
		ctx.beginPath();
		ctx.ellipse(ball.x, l.groundY + r * 0.62, shadowR, shadowR * 0.3, 0, 0, Math.PI * 2);
		ctx.fill();

		ctx.save();
		ctx.translate(ball.x, ball.y);
		ctx.scale(sx, sy);
		ctx.rotate(ball.spin);

		const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
		body.addColorStop(0, '#fff1f1');
		body.addColorStop(0.35, '#ff6b6b');
		body.addColorStop(1, '#b3202f');
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, Math.PI * 2);
		ctx.fill();

		// A stripe, so the spin is visible.
		ctx.strokeStyle = 'rgba(255,255,255,0.9)';
		ctx.lineWidth = r * 0.16;
		ctx.beginPath();
		ctx.arc(0, 0, r * 0.62, -0.6, 1.5);
		ctx.stroke();
		ctx.restore();
	}

	function drawParticles() {
		for (const p of particles) {
			const t = 1 - p.age / p.life;
			ctx.globalAlpha = Math.max(0, t);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	/** A label above a value, the layout every Minit HUD uses. */
	function drawStat(l, x, align, label, value) {
		ctx.textAlign = align;
		ctx.textBaseline = 'alphabetic';
		ctx.shadowColor = 'rgba(0,0,0,0.45)';
		ctx.shadowBlur = l.unit * 0.9;
		ctx.shadowOffsetY = Math.max(1, l.unit * 0.18);

		ctx.fillStyle = 'rgba(255,255,255,0.86)';
		ctx.font = `600 ${Math.round(l.unit * 3.0)}px system-ui, -apple-system, sans-serif`;
		ctx.fillText(label, x, l.unit * 7.0);

		ctx.fillStyle = '#ffffff';
		ctx.font = `700 ${Math.round(l.unit * 4.6)}px system-ui, -apple-system, sans-serif`;
		ctx.fillText(String(value), x, l.unit * 12.2);

		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetY = 0;
	}

	function drawHud(l, score, time) {
		const pad = Math.max(14, l.unit * 4.2);
		drawStat(l, pad, 'left', 'TIME', `0:${String(time).padStart(2, '0')}`);
		drawStat(l, l.width - pad, 'right', 'SCORE', score);
	}

	function drawTexts(l) {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (const f of floaters) {
			const t = 1 - f.age / f.life;
			ctx.globalAlpha = Math.max(0, t);
			ctx.fillStyle = f.color;
			ctx.font = `700 ${Math.round(l.unit * 3.6)}px system-ui, -apple-system, sans-serif`;
			ctx.fillText(f.text, f.x, f.y);
		}
		for (const f of flashes) {
			// Pop in, hold, fade out -- the shape the SDK's own feedback uses.
			const t = f.age / f.life;
			const scale = t < 0.18 ? 0.7 + (t / 0.18) * 0.3 : 1;
			ctx.globalAlpha = Math.max(0, t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1);
			ctx.fillStyle = f.color;
			ctx.font = `700 ${Math.round(l.unit * 4.4 * scale)}px system-ui, -apple-system, sans-serif`;
			ctx.fillText(f.text, l.width / 2, l.height * 0.30);
		}
		ctx.globalAlpha = 1;
	}

	function render(hud) {
		const l = L();
		layout.applyTransform(ctx);
		drawSky(l);
		drawGround(l);
		drawParticles();
		drawBall(l);
		drawTexts(l);
		if (hud) { drawHud(l, hud.score, hud.time); }
	}

	buildScenery();
	reset();

	return {
		step, render, resize, tryHit, floatText, flash,
		get ball() { return ball; },
		get started() { return started; },
		/** True while the ball is off the surface -- used to score rallies. */
		get airborne() { return ball.y < L().groundY - 1; },
	};
}

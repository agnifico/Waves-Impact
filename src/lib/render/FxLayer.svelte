<script lang="ts">
	import type { EngineState } from '$lib/types/state';
	import type { Position } from '$lib/types/common';
	import { chebyshev, step8Toward, samePos } from '$lib/combat/board';
	import { subscribe } from '$lib/combat/events';
	import { resolveTheme } from '$lib/render/char-theme'; // ← adjust to where char-theme.ts lives
	import { onMount } from 'svelte';

	let { gs, now = 0 }: { gs: EngineState; now: number } = $props();

	const TILE = 36;
	const cx = (p: Position) => p.x * TILE + TILE / 2;
	const cy = (p: Position) => p.y * TILE + TILE / 2;
	/** A character's colour ramp from its resolved theme (element-default fallback baked in). */
	function rampOf(id: string): string[] {
		const c = gs.party.find((p) => p.id === id);
		if (!c) return ['var(--gold)', 'var(--gold-bright)'];
		const t = resolveTheme(c.def);
		return [t.primary, t.secondary];
	}
	function skin(id: string): string | boolean {
		const c = gs.party.find((p) => p.id === id);
		if (!c) return false;
		const t = resolveTheme(c.def);
		return t.skin;
	}
	function mix(ramp: string[], t: number): string {
		if (ramp.length === 1) return ramp[0];
		return `color-mix(in srgb, ${ramp[0]} ${Math.round((1 - t) * 100)}%, ${ramp[ramp.length - 1]})`;
	}
	/** Find the fx block for whatever ability/BA produced this hit (matched by name). */
	function fxFor(charId: string, abilityName: string): any | null {
		const c = gs.party.find((p) => p.id === charId);
		if (!c) return null;
		const d: any = c.def;
		for (const slot of ['X', 'C', 'V'])
			if (d.abilities?.[slot]?.name === abilityName) return d.abilities[slot].fx ?? null;
		if (d.basicChain)
			for (const ba of d.basicChain) if (ba.name === abilityName) return ba.fx ?? null;
		const ctx = d.contextualBasic;
		if (ctx?.base?.name === abilityName) return ctx.base.fx ?? null;
		if (ctx?.withStack?.name === abilityName) return ctx.withStack.fx ?? null;
		return null;
	}
	function lineTiles(from: Position, to: Position): Position[] {
		const out: Position[] = [];
		let p = { ...from };
		let g = 0;
		while (!samePos(p, to) && g++ < 32) {
			p = step8Toward(p, to);
			out.push({ ...p });
		}
		return out;
	}

	type Burst = { id: number; kind: 'burst'; x: number; y: number; color: string; ttl: number };
	type WaveTile = { x: number; y: number; color: string; delay: number };
	type Wave = { id: number; kind: 'wave'; tiles: WaveTile[]; ttl: number };
	type Projectile = {
		id: number;
		kind: 'projectile';
		x: number;
		y: number;
		dx: number;
		dy: number;
		rot: number;
		dur: number;
		shape: string;
		size: string;
		trail: boolean;
		color: string;
		tail: string;
		ttl: number;
	};
	type Swipe = {
		id: number;
		kind: 'swipe';
		x: number;
		y: number;
		rot: number;
		color: string;
		ttl: number;
	};

	type ZoneBurst = {
		id: number;
		kind: 'zoneburst';
		x: number;
		y: number;
		radius: number;
		color: string;
		ttl: number;
	};
	type Fx = Burst | Wave | Projectile | Swipe | ZoneBurst;

	let fx = $state<Fx[]>([]);
	let fxId = 0;
	function spawn(e: Omit<Fx, 'id'>) {
		const id = fxId++;
		fx.push({ ...(e as Fx), id });
		setTimeout(() => (fx = fx.filter((f) => f.id !== id)), e.ttl);
	}
	function spawnBurst(p: Position, color: string) {
		spawn({ kind: 'burst', x: p.x, y: p.y, color, ttl: 440 });
	}

	const SIZE_PX: Record<string, number> = { s: 10, m: 14, l: 20 };

	onMount(() => {
		const unsubs = [
			subscribe('zone:created', (e) => {
				const z = gs.zones.find((zz) => zz.id === e.zoneId);
				if (!z) return;
				spawn({
					kind: 'zoneburst',
					x: z.center.x,
					y: z.center.y,
					radius: z.radius,
					color: rampOf(e.ownerId)[0],
					ttl: 560
				});
			}),
			subscribe('damage:dealt', (e) => {
				const tgt = gs.enemies.find((en) => en.id === e.target);
				if (!tgt) return;
				const src = gs.party.find((p) => p.id === e.source);
				const f = fxFor(e.source, e.abilityName);
				const ramp = (f?.colors as string[]) ?? rampOf(e.source);
				const head = ramp[0];

				if (src && f?.strike === 'projectile') {
					const fromX = cx(src.pos),
						fromY = cy(src.pos);
					const dx = cx(tgt.pos) - fromX,
						dy = cy(tgt.pos) - fromY;
					const dur = Math.min(360, Math.max(90, chebyshev(src.pos, tgt.pos) * (f.speed ?? 40)));
					spawn({
						kind: 'projectile',
						x: fromX,
						y: fromY,
						dx,
						dy,
						rot: (Math.atan2(dy, dx) * 180) / Math.PI,
						dur,
						shape: f.shape ?? 'bolt',
						size: f.size ?? 'm',
						trail: !!f.trail,
						color: head,
						tail: mix(ramp, 1),
						ttl: dur + 40
					});
					setTimeout(() => spawnBurst(tgt.pos, head), dur);
				} else if (src && f?.strike === 'swipe') {
					const dx = cx(tgt.pos) - cx(src.pos),
						dy = cy(tgt.pos) - cy(src.pos);
					spawn({
						kind: 'swipe',
						x: tgt.pos.x,
						y: tgt.pos.y,
						rot: (Math.atan2(dy, dx) * 180) / Math.PI,
						color: head,
						ttl: 240
					});
					spawnBurst(tgt.pos, head);
				} else {
					spawnBurst(tgt.pos, head);
				}
			}),
			subscribe('movement:player', (e) => {
				if (chebyshev(e.from, e.to) <= 1) return; // dashes only, not single steps
				const ramp = rampOf(e.characterId);
				const path = lineTiles(e.from, e.to);
				const STEP = 45;
				spawn({
					kind: 'wave',
					ttl: path.length * STEP + 320,
					tiles: path.map((p, i) => ({
						x: p.x,
						y: p.y,
						color: mix(ramp, path.length > 1 ? i / (path.length - 1) : 0),
						delay: i * STEP
					}))
				});
			})
		];
		return () => unsubs.forEach((u) => u());
	});
</script>

<div class="fx-layer">
	{#each gs.zones as z (z.id)}
		{@const d = (z.radius * 2 + 1) * TILE}
		{@const ramp = rampOf(z.ownerId)}
		{@const _skin = skin(z.ownerId)}
		<div
			class="fx-zone {_skin ? 'fx-zone-' + _skin : 'fx-zone-default'}"
			style="left:{z.center.x * TILE + 18}px;top:{z.center.y * TILE +
				18}px;width:{d}px;height:{d}px;margin:{-d / 2}px 0 0 {-d /
				2}px;--c:{ramp[0]};--c2:{ramp[1] ?? ramp[0]};"
		></div>
		<div
			class="fx-zone"
			style="left:{z.center.x * TILE + 18}px;top:{z.center.y * TILE +
				18}px;width:{d}px;height:{d}px;margin:{-d / 2}px 0 0 {-d /
				2}px;--c:{ramp[0]};--c2:{ramp[1] ?? ramp[0]};"
		></div>
	{/each}
	{#each fx as f (f.id)}
		{#if f.kind === 'burst'}
			<div
				class="fx-burst"
				style="left:{f.x * TILE + 18}px;top:{f.y * TILE + 18}px;--c:{f.color};"
			></div>
		{:else if f.kind === 'wave'}
			{#each f.tiles as t (`${t.x},${t.y}`)}
				<div
					class="fx-wave-tile"
					style="left:{t.x * TILE}px;top:{t.y * TILE}px;--c:{t.color};animation-delay:{t.delay}ms;"
				></div>
			{/each}
		{:else if f.kind === 'projectile'}
			<div
				class="fx-proj {f.shape}"
				class:trail={f.trail}
				style="left:{f.x}px;top:{f.y}px;--dx:{f.dx}px;--dy:{f.dy}px;--rot:{f.rot}deg;--dur:{f.dur}ms;--c:{f.color};--t:{f.tail};--sz:{SIZE_PX[
					f.size
				] ?? 14}px;"
			>
				<span class="head"></span>
			</div>
		{:else if f.kind === 'swipe'}
			<div
				class="fx-swipe"
				style="left:{f.x * TILE + 18}px;top:{f.y * TILE + 18}px;--rot:{f.rot}deg;--c:{f.color};"
			></div>
		{:else if f.kind === 'zoneburst'}
			{@const d = (f.radius * 2 + 1) * TILE}
			<div
				class="fx-zoneburst"
				style="left:{f.x * TILE + 18}px;top:{f.y * TILE +
					18}px;width:{d}px;height:{d}px;margin:{-d / 2}px 0 0 {-d / 2}px;--c:{f.color};"
			></div>
		{/if}
	{/each}
</div>

<style>
	.fx-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 50;
	}

	/* ── Impact burst — white-hot core + ring, no blend dependency ──────── */
	.fx-burst {
		position: absolute;
		width: 18px;
		height: 18px;
		margin: -9px 0 0 -9px;
		border-radius: 50%;
		/* background: #fff; */
		box-shadow:
			0 0 10px 4px var(--c),
			0 0 24px 12px color-mix(in srgb, var(--c) 65%, transparent);
		opacity: 0;
		transform: scale(0.4);
		animation: fx-burst 0.4s ease-out forwards;
		z-index: 2;
	}
	.fx-burst::after {
		content: '';
		position: absolute;
		inset: -7px;
		border-radius: 50%;
		border: 3px solid var(--c);
		opacity: 0;
		animation: fx-burst-ring 0.45s ease-out forwards;
	}

	.fx-wave-tile {
		position: absolute;
		width: 36px;
		height: 36px;
		box-sizing: border-box;
		border: 1px solid var(--c);
		background: color-mix(in srgb, var(--c) 22%, transparent);
		opacity: 0;
		animation: fx-wave-flash 0.32s ease-out forwards;
	}

	/* ── Projectiles — element travels source→target, head faces travel ── */
	.fx-proj {
		position: absolute;
		width: 0;
		height: 0;
		animation: fx-proj-travel var(--dur) linear forwards;
		mix-blend-mode: screen;
	}
	.fx-proj .head {
		position: absolute;
		left: 0;
		top: 0;
		width: var(--sz);
		height: var(--sz);
		margin: calc(var(--sz) / -2) 0 0 calc(var(--sz) / -2);
		transform: rotate(var(--rot));
		background: var(--c);
		box-shadow: 0 0 8px 1px var(--c);
	}
	.fx-proj.trail .head::before {
		content: '';
		position: absolute;
		right: 50%;
		top: 50%;
		width: calc(var(--sz) * 2.8);
		height: calc(var(--sz) * 0.5);
		transform: translateY(-50%);
		background: linear-gradient(to left, var(--c), transparent);
		border-radius: 999px;
	}
	.fx-proj.orb .head {
		border-radius: 50%;
	}
	.fx-proj.orb .head::after {
		content: '';
		position: absolute;
		right: 60%;
		top: 50%;
		width: calc(var(--sz) * 1.8);
		height: calc(var(--sz) * 0.45);
		transform: translateY(-50%);
		background: linear-gradient(to left, var(--c), transparent);
		border-radius: 999px;
	}
	.fx-proj.bolt .head {
		width: calc(var(--sz) * 1.7);
		border-radius: 999px;
	}
	.fx-proj.leaf .head {
		border-radius: 0 100% 0 100%;
	}
	.fx-proj.arrow .head {
		width: calc(var(--sz) * 1.9);
		height: calc(var(--sz) * 0.55);
		margin: calc(var(--sz) * -0.275) 0 0 calc(var(--sz) * -0.95);
		background: linear-gradient(to right, var(--t), var(--c));
		clip-path: polygon(0 25%, 70% 25%, 70% 0, 100% 50%, 70% 100%, 70% 75%, 0 75%);
	}

	/* ── Forward Wave Projectile ──────── */
	.fx-proj.wave .head {
		width: calc(var(--sz) * 3);
		height: calc(var(--sz) * 3);
		/* Center the larger circle */
		margin: calc(var(--sz) * -1.5) 0 0 calc(var(--sz) * -1.5);
		border-radius: 50%;
		background: transparent;
		box-shadow: none;

		/* We use border-right to create the crescent. 
       Since your inline style applies --rot based on trajectory, 
       the "right" side will automatically point exactly where it's traveling! */
		border: 0 solid transparent;
		border-right: calc(var(--sz) * 0.6) solid var(--c);
		filter: drop-shadow(0 0 6px var(--c));
	}

	/* ── Melee swipe — a slash that sweeps through the facing ───────────── */
	.fx-swipe {
		position: absolute;
		/* Create a larger square container for the circular arc */
		width: 64px;
		height: 64px;
		margin: -32px 0 0 -32px;

		/* Tapered Crescent Magic */
		border-radius: 50%;
		background: transparent;
		border: 0 solid transparent;
		border-top: 12px solid color-mix(in srgb, rgb(255, 255, 255) 20%, var(--c));

		/* Use drop-shadow instead of box-shadow so it glows around the crescent, not the bounding box */
		filter: drop-shadow(0 0 5px var(--c));

		/* Snappier cubic-bezier easing for a "whip" effect */
		animation: fx-slash 0.25s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
	}

	@keyframes fx-slash {
		0% {
			opacity: 0;
			/* Start wound back and small */
			transform: rotate(calc(var(--rot) - 50deg)) scale(0.5);
		}
		30% {
			opacity: 1;
			/* Peak of the swing: stretches slightly to simulate motion blur */
			transform: rotate(calc(var(--rot) + 15deg)) scale(1.1) scaleY(0.85);
		}
		100% {
			opacity: 0;
			/* Dissipates and expands at the end of the follow-through */
			transform: rotate(calc(var(--rot) + 120deg)) scale(1.4);
		}
	}

	/* Persistent zone aura — donut so the unit at centre stays visible; spinning ember edge */
	.fx-zone {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
		border: 2px solid color-mix(in srgb, var(--c) 80%, transparent);
		background: radial-gradient(
			circle,
			transparent 40%,
			color-mix(in srgb, var(--c) 16%, transparent) 60%,
			transparent 80%
		);
		animation: fx-zone-pulse 1.4s ease-in-out infinite;
	}
	.fx-zone::before {
		content: '';
		position: absolute;
		inset: -3px;
		border-radius: 50%;
		background: conic-gradient(
			from 0deg,
			transparent 0 6%,
			color-mix(in srgb, var(--c) 75%, transparent) 14%,
			transparent 28% 56%,
			color-mix(in srgb, var(--c2) 75%, transparent) 64%,
			transparent 78%
		);
		-webkit-mask: radial-gradient(
			farthest-side,
			transparent calc(100% - 5px),
			#000 calc(100% - 5px)
		);
		mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px));
		animation: fx-zone-spin 3s linear infinite;
		opacity: 0.9;
	}
	.fx-zoneburst {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
		border: 3px solid var(--c);
		box-shadow:
			0 0 24px 6px color-mix(in srgb, var(--c) 60%, transparent),
			inset 0 0 30px 10px color-mix(in srgb, var(--c) 35%, transparent);
		opacity: 0;
		transform: scale(0.2);
		animation: fx-zoneburst 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
	}
	@keyframes fx-zone-pulse {
		0%,
		100% {
			box-shadow:
				0 0 16px 2px color-mix(in srgb, var(--c) 45%, transparent),
				inset 0 0 24px 4px color-mix(in srgb, var(--c) 26%, transparent);
		}
		50% {
			box-shadow:
				0 0 28px 6px color-mix(in srgb, var(--c) 65%, transparent),
				inset 0 0 36px 9px color-mix(in srgb, var(--c) 40%, transparent);
		}
	}
	@keyframes fx-zone-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes fx-zoneburst {
		0% {
			opacity: 0;
			transform: scale(0.2);
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.15);
		}
	}

	/* ── Keyframes (kept in-component so they can't go missing or collide) ─ */
	@keyframes fx-burst {
		0% {
			opacity: 0;
			transform: scale(0.4);
		}
		15% {
			opacity: 1;
			transform: scale(0.95);
		}
		100% {
			opacity: 0;
			transform: scale(1.85);
		}
	}
	@keyframes fx-burst-ring {
		0% {
			opacity: 0.9;
			transform: scale(0.55);
		}
		100% {
			opacity: 0;
			transform: scale(1.7);
		}
	}
	@keyframes fx-wave-flash {
		0% {
			opacity: 0;
			transform: scale(0.9);
		}
		30% {
			opacity: 1;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(1);
		}
	}
	@keyframes fx-proj-travel {
		from {
			transform: translate(0, 0);
		}
		to {
			transform: translate(var(--dx), var(--dy));
		}
	}
	@keyframes fx-swipe {
		0% {
			opacity: 0;
			transform: rotate(calc(var(--rot) - 95deg)) scale(0.6);
		}
		35% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: rotate(calc(var(--rot) + 55deg)) scale(1.25);
		}
	}

	/* ── Mecha Nature ──────── */
	.fx-zone-mecha {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
		border: 2px dashed var(--c);
		/* Synthetic grid background */
		background: repeating-linear-gradient(
			45deg,
			color-mix(in srgb, var(--c) 10%, transparent),
			color-mix(in srgb, var(--c) 10%, transparent) 10px,
			transparent 10px,
			transparent 20px
		);
		/* Stepped rotation looks robotic */
		animation: fx-spin-fast 8s steps(12) infinite;
	}
	.fx-zone-mecha::before {
		content: '';
		position: absolute;
		inset: 4px;
		border: 2px solid color-mix(in srgb, var(--c2) 80%, transparent);
		/* Rigid Octagon shape */
		clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
		animation: fx-mecha-pulse 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
	}

	@keyframes fx-mecha-pulse {
		0%,
		100% {
			transform: scale(0.95) rotate(-15deg);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.05) rotate(0deg);
			opacity: 1;
			border-color: var(--c);
		}
	}

	/* ── Flames & Black Flames ──────── */
	.fx-zone-flame {
		position: absolute;
		pointer-events: none;
		border-radius: 50%;
		box-shadow:
			0 0 15px 2px color-mix(in srgb, var(--c) 70%, transparent),
			inset 0 0 20px 5px color-mix(in srgb, var(--c2) 50%, transparent);
		animation: fx-flame-waver 2s ease-in-out infinite alternate;
	}
	.fx-zone-flame::before {
		content: '';
		position: absolute;
		inset: -4px;
		/* Morphing blob shape */
		border-radius: 40% 60% 60% 40% / 50% 50% 50% 50%;
		border: 2px solid var(--c);
		animation: fx-flame-flicker 3s linear infinite;
		filter: drop-shadow(0 0 8px var(--c));
	}

	@keyframes fx-flame-waver {
		0% {
			border-radius: 50%;
			opacity: 0.8;
			transform: scale(0.98);
		}
		50% {
			border-radius: 47% 53% 45% 55%;
			opacity: 1;
			transform: scale(1.02);
		}
		100% {
			border-radius: 55% 45% 58% 42%;
			opacity: 0.9;
			transform: scale(1);
		}
	}
	@keyframes fx-flame-flicker {
		0% {
			transform: rotate(0deg) scale(0.95);
		}
		50% {
			transform: rotate(180deg) scale(1.05);
		}
		100% {
			transform: rotate(360deg) scale(0.95);
		}
	}
	/* ── Whirlwind ──────── */
	.fx-zone-wind {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
		border: 3px solid transparent;
		border-left: 3px solid var(--c);
		border-right: 3px solid color-mix(in srgb, var(--c2) 80%, transparent);
		animation: fx-spin-fast 0.6s linear infinite;
		box-shadow: inset 0 0 20px 2px color-mix(in srgb, var(--c) 20%, transparent);
	}
	.fx-zone-wind::before {
		content: '';
		position: absolute;
		inset: 6px;
		border-radius: 50%;
		border: 2px solid transparent;
		border-top: 2px solid var(--c2);
		border-bottom: 2px solid var(--c);
		animation: fx-spin-reverse 0.4s linear infinite;
	}

	@keyframes fx-spin-fast {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes fx-spin-reverse {
		to {
			transform: rotate(-360deg);
		}
	}

	/* ── 1. Void / Light-Darkness (fx-zone-void) ──────── */
	.fx-zone-void {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
		/* Deep abyss center */
		background: radial-gradient(circle, rgba(0, 0, 0, 0.8) 20%, transparent 70%);
		box-shadow:
			0 0 15px 2px var(--c2),
			inset 0 0 25px 8px #000;
		animation: fx-void-breathe 4s ease-in-out infinite alternate;
	}
	.fx-zone-void::before {
		content: '';
		position: absolute;
		inset: -2px;
		border-radius: 50%;
		/* Eclipse rim: stark contrasting halves */
		border: 2px solid transparent;
		border-top: 3px solid var(--c); /* Light / Primary */
		border-bottom: 3px solid var(--c2); /* Dark / Secondary */
		animation: fx-spin-fast 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
		filter: drop-shadow(0 0 6px var(--c));
	}

	@keyframes fx-void-breathe {
		0% {
			transform: scale(0.98);
			opacity: 0.9;
		}
		100% {
			transform: scale(1.02);
			opacity: 1;
		}
	}

	/* ── 2. Watery & Wavy (fx-zone-water) ──────── */
	.fx-zone-water {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
		border: 2px solid color-mix(in srgb, var(--c) 30%, transparent);
		box-shadow: inset 0 0 30px color-mix(in srgb, var(--c2) 40%, transparent);
	}
	/* Concentric ripples */
	.fx-zone-water::before,
	.fx-zone-water::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 2px solid var(--c);
		opacity: 0;
		animation: fx-water-ripple 2.5s cubic-bezier(0.1, 0.5, 0.3, 1) infinite;
	}
	.fx-zone-water::after {
		animation-delay: 1.25s; /* Stagger the second ripple */
	}

	@keyframes fx-water-ripple {
		0% {
			transform: scale(0.7);
			opacity: 0.8;
			border-width: 4px;
		}
		100% {
			transform: scale(1.1);
			opacity: 0;
			border-width: 1px;
		}
	}

	/* ── 3. Omni-Slash / Keqing Burst (fx-zone-slashes) ──────── */
	.fx-zone-slashes {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
		border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
		overflow: hidden; /* Contains the slashes inside the zone */
		box-shadow: inset 0 0 20px color-mix(in srgb, var(--c2) 30%, transparent);
	}
	/* Flashing intersection lines */
	.fx-zone-slashes::before,
	.fx-zone-slashes::after {
		content: '';
		position: absolute;
		inset: -20%;
		/* Multiple sharp lines at different angles */
		background:
			linear-gradient(transparent 49%, var(--c) 50%, transparent 51%),
			linear-gradient(75deg, transparent 49%, var(--c) 50%, transparent 51%),
			linear-gradient(-35deg, transparent 49%, var(--c2) 50%, transparent 51%);
		background-size: 200% 200%;
		opacity: 0;
		/* steps() makes it look like jagged, instant anime frames rather than smooth sliding */
		animation: fx-omni-slash 0.5s steps(5) infinite;
		mix-blend-mode: screen;
	}
	.fx-zone-slashes::after {
		transform: rotate(90deg) scale(1.2);
		animation-duration: 1s;
		animation-direction: reverse;
	}

	@keyframes fx-omni-slash {
		0% {
			background-position: 0% 0%;
			opacity: 0;
		}
		25% {
			opacity: 1;
		}
		50% {
			background-position: 100% 100%;
			opacity: 1;
		}
		75% {
			background-position: -50% 50%;
			opacity: 0.8;
		}
		100% {
			background-position: 50% -50%;
			opacity: 0;
		}
	}
</style>

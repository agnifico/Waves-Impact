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
		if (d.basicChain) for (const ba of d.basicChain) if (ba.name === abilityName) return ba.fx ?? null;
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
		id: number; kind: 'projectile'; x: number; y: number; dx: number; dy: number;
		rot: number; dur: number; shape: string; size: string; trail: boolean;
		color: string; tail: string; ttl: number;
	};
	type Swipe = { id: number; kind: 'swipe'; x: number; y: number; rot: number; color: string; ttl: number };
	type Fx = Burst | Wave | Projectile | Swipe;

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
			subscribe('damage:dealt', (e) => {
				const tgt = gs.enemies.find((en) => en.id === e.target);
				if (!tgt) return;
				const src = gs.party.find((p) => p.id === e.source);
				const f = fxFor(e.source, e.abilityName);
				const ramp = (f?.colors as string[]) ?? rampOf(e.source);
				const head = ramp[0];

				if (src && f?.strike === 'projectile') {
					const fromX = cx(src.pos), fromY = cy(src.pos);
					const dx = cx(tgt.pos) - fromX, dy = cy(tgt.pos) - fromY;
					const dur = Math.min(360, Math.max(90, chebyshev(src.pos, tgt.pos) * (f.speed ?? 40)));
					spawn({
						kind: 'projectile', x: fromX, y: fromY, dx, dy,
						rot: (Math.atan2(dy, dx) * 180) / Math.PI, dur,
						shape: f.shape ?? 'bolt', size: f.size ?? 'm', trail: !!f.trail,
						color: head, tail: mix(ramp, 1), ttl: dur + 40
					});
					setTimeout(() => spawnBurst(tgt.pos, head), dur);
				} else if (src && f?.strike === 'swipe') {
					const dx = cx(tgt.pos) - cx(src.pos), dy = cy(tgt.pos) - cy(src.pos);
					spawn({ kind: 'swipe', x: tgt.pos.x, y: tgt.pos.y, rot: (Math.atan2(dy, dx) * 180) / Math.PI, color: head, ttl: 240 });
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
					kind: 'wave', ttl: path.length * STEP + 320,
					tiles: path.map((p, i) => ({
						x: p.x, y: p.y,
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
	{#each fx as f (f.id)}
		{#if f.kind === 'burst'}
			<div class="fx-burst" style="left:{f.x * TILE + 18}px;top:{f.y * TILE + 18}px;--c:{f.color};"></div>
		{:else if f.kind === 'wave'}
			{#each f.tiles as t (`${t.x},${t.y}`)}
				<div class="fx-wave-tile" style="left:{t.x * TILE}px;top:{t.y * TILE}px;--c:{t.color};animation-delay:{t.delay}ms;"></div>
			{/each}
		{:else if f.kind === 'projectile'}
			<div
				class="fx-proj {f.shape}"
				class:trail={f.trail}
				style="left:{f.x}px;top:{f.y}px;--dx:{f.dx}px;--dy:{f.dy}px;--rot:{f.rot}deg;--dur:{f.dur}ms;--c:{f.color};--t:{f.tail};--sz:{SIZE_PX[f.size] ?? 14}px;"
			>
				<span class="head"></span>
			</div>
		{:else if f.kind === 'swipe'}
			<div class="fx-swipe" style="left:{f.x * TILE + 18}px;top:{f.y * TILE + 18}px;--rot:{f.rot}deg;--c:{f.color};"></div>
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
		width: 56px;
		height: 56px;
		margin: -28px 0 0 -28px;
		border-radius: 50%;
		background: radial-gradient(circle, #fff 0%, var(--c) 32%, transparent 70%);
		opacity: 0;
		transform: scale(0.4);
		animation: fx-burst 0.42s ease-out forwards;
	}
	.fx-burst::after {
		content: '';
		position: absolute;
		inset: -3px;
		border-radius: 50%;
		border: 2.5px solid var(--c);
		opacity: 0;
		animation: fx-burst-ring 0.42s ease-out forwards;
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

	/* ── Melee swipe — a slash that sweeps through the facing ───────────── */
	.fx-swipe {
		position: absolute;
		width: 40px;
		height: 5px;
		margin: -2.5px 0 0 -20px;
		background: linear-gradient(to right, transparent, var(--c), transparent);
		border-radius: 999px;
		box-shadow: 0 0 8px var(--c);
		opacity: 0;
		mix-blend-mode: screen;
		animation: fx-swipe 0.24s ease-out forwards;
	}

	/* ── Keyframes (kept in-component so they can't go missing or collide) ─ */
	@keyframes fx-burst {
		0%   { opacity: 0; transform: scale(0.4); }
		15%  { opacity: 1; transform: scale(0.95); }
		100% { opacity: 0; transform: scale(1.85); }
	}
	@keyframes fx-burst-ring {
		0%   { opacity: 0.9; transform: scale(0.55); }
		100% { opacity: 0;   transform: scale(1.7); }
	}
	@keyframes fx-wave-flash {
		0%   { opacity: 0; transform: scale(0.9); }
		30%  { opacity: 1; transform: scale(1); }
		100% { opacity: 0; transform: scale(1); }
	}
	@keyframes fx-proj-travel {
		from { transform: translate(0, 0); }
		to   { transform: translate(var(--dx), var(--dy)); }
	}
	@keyframes fx-swipe {
		0%   { opacity: 0; transform: rotate(calc(var(--rot) - 30deg)) scaleX(0.5); }
		40%  { opacity: 1; }
		100% { opacity: 0; transform: rotate(calc(var(--rot) + 20deg)) scaleX(1.1); }
	}
</style>
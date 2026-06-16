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
	const distPx = (a: Position, b: Position) => Math.hypot(cx(b) - cx(a), cy(b) - cy(a));
	const angleDeg = (from: Position, to: Position) =>
		(Math.atan2(cy(to) - cy(from), cx(to) - cx(from)) * 180) / Math.PI;

	/** A character's colour ramp from its resolved theme (element-default fallback baked in). */
	function rampOf(id: string): string[] {
		const c = gs.party.find((p) => p.id === id);
		if (!c) return ['var(--gold)', 'var(--gold-bright)'];
		const t = resolveTheme(c.def);
		return [t.primary, t.secondary];
	}
	/** Zone skin now comes from the zone ABILITY's fx (theme.skin is deprecated). */
	function zoneSkin(z: { ownerId: string }): string {
		const c = gs.party.find((p) => p.id === z.ownerId);
		if (!c) return 'default';
		const ab = Object.values(c.def.abilities ?? {}).find(
			(a: any) => a?.behavior === 'zone' && a?.fx?.zone
		) as any;
		return (ab?.fx?.zone as string) ?? 'default';
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
		if (d.enhancedBasic?.ba?.name === abilityName) return d.enhancedBasic.ba.fx ?? null; // ← ADD
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

	const ELEMENT_COLOR: Record<string, string> = {
		water: 'var(--frost)',
		wind: 'var(--wind)',
		fire: 'var(--coral)',
		nature: 'var(--verdant)',
		light: 'var(--gold-bright)',
		dark: '#9a7bd0'
	};
	/** Jagged lightning path between two pixel points (chain strike). */
	function jagged(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		segs: number,
		amp: number
	): string {
		const dx = x2 - x1,
			dy = y2 - y1,
			len = Math.hypot(dx, dy) || 1;
		const px = -dy / len,
			py = dx / len;
		let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
		for (let i = 1; i <= segs; i++) {
			const t = i / segs;
			const off = i === segs ? 0 : (Math.random() - 0.5) * 2 * amp;
			const x = x1 + dx * t + px * off;
			const y = y1 + dy * t + py * off;
			d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	}

	function elementColor(el: string | undefined): string {
		return ELEMENT_COLOR[el ?? ''] ?? 'var(--gold)';
	}

	type ConstructRing = {
		id: number;
		kind: 'construct_ring';
		x: number;
		y: number;
		radius: number;
		color: string;
		isCatalyst: boolean;
		ttl: number;
	};

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
	type ReverseSwipe = {
		id: number;
		kind: 'reverseswipe';
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
	type Claw = {
		id: number;
		kind: 'claw';
		x: number;
		y: number;
		rot: number;
		gashes: { a: number; d: number }[];
		color: string;
		ttl: number;
	};
	type Stab = {
		id: number;
		kind: 'stab';
		x: number;
		y: number;
		rot: number;
		len: number;
		color: string;
		ttl: number;
	};
	type Flurry = {
		id: number;
		kind: 'flurry';
		x: number;
		y: number;
		ticks: { jx: number; jy: number; a: number; delay: number }[];
		color: string;
		ttl: number;
	};
	type Slam = {
		id: number;
		kind: 'slam';
		x: number;
		y: number;
		debris: { ex: number; ey: number }[];
		color: string;
		ttl: number;
	};
	type Uppercut = {
		id: number;
		kind: 'uppercut';
		x: number;
		y: number;
		sparks: { ex: number; d: number }[];
		color: string;
		ttl: number;
	};
	type Bullet = {
		id: number;
		kind: 'bullet';
		x: number;
		y: number;
		rot: number;
		len: number;
		color: string;
		ttl: number;
	};
	type Beam = {
		id: number;
		kind: 'beam';
		x: number;
		y: number;
		rot: number;
		len: number;
		color: string;
		ttl: number;
	};
	type Chain = {
		id: number;
		kind: 'chain';
		d: string;
		w: number;
		h: number;
		color: string;
		ttl: number;
	};
	type Fx =
		| Burst
		| Wave
		| Projectile
		| Swipe
		| ReverseSwipe
		| ZoneBurst
		| Claw
		| Stab
		| Flurry
		| Slam
		| Uppercut
		| Bullet
		| Beam
		| Chain
		| ConstructRing;

	let fx = $state<Fx[]>([]);
	let fxId = 0;
	let layerEl: HTMLDivElement;
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
				const strike = f?.strike;

				if (src && strike === 'projectile') {
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
				} else if (src && strike === 'swipe') {
					spawn({
						kind: 'swipe',
						x: tgt.pos.x,
						y: tgt.pos.y,
						rot: angleDeg(src.pos, tgt.pos),
						color: head,
						ttl: 240
					});
					spawnBurst(tgt.pos, head);
				} else if (src && strike === 'reverseswipe') {
					spawn({
						kind: 'reverseswipe',
						x: tgt.pos.x,
						y: tgt.pos.y,
						rot: angleDeg(src.pos, tgt.pos),
						color: head,
						ttl: 240
					});
					spawnBurst(tgt.pos, head);
				} else if (src && strike === 'claw') {
					const n = f.gashes ?? 3,
						spread = 48;
					const gashes = Array.from({ length: n }, (_, i) => ({
						a: n === 1 ? 0 : -spread / 2 + (spread / (n - 1)) * i,
						d: i * 55
					}));
					spawn({
						kind: 'claw',
						x: cx(tgt.pos),
						y: cy(tgt.pos),
						rot: angleDeg(src.pos, tgt.pos),
						gashes,
						color: head,
						ttl: 460
					});
					setTimeout(() => spawnBurst(tgt.pos, head), 120);
				} else if (src && strike === 'stab') {
					spawn({
						kind: 'stab',
						x: cx(src.pos),
						y: cy(src.pos),
						rot: angleDeg(src.pos, tgt.pos),
						len: distPx(src.pos, tgt.pos) + 14,
						color: head,
						ttl: 320
					});
					setTimeout(() => spawnBurst(tgt.pos, head), 135);
				} else if (strike === 'flurry') {
					const N = f.hits ?? 6;
					const ticks = Array.from({ length: N }, (_, i) => ({
						jx: (Math.random() - 0.5) * 16,
						jy: (Math.random() - 0.5) * 16,
						a: Math.random() * 90 - 45,
						delay: i * 68
					}));
					spawn({
						kind: 'flurry',
						x: cx(tgt.pos),
						y: cy(tgt.pos),
						ticks,
						color: head,
						ttl: N * 68 + 260
					});
					setTimeout(() => spawnBurst(tgt.pos, head), N * 68);
				} else if (strike === 'slam') {
					const debris = Array.from({ length: 7 }, (_, i) => {
						const ang = (i / 7) * Math.PI * 2 + Math.random();
						const r = 26 + Math.random() * 14;
						return { ex: Math.cos(ang) * r, ey: -Math.abs(Math.sin(ang)) * r - 6 };
					});
					spawn({ kind: 'slam', x: cx(tgt.pos), y: cy(tgt.pos), debris, color: head, ttl: 820 });
					setTimeout(() => spawnBurst(tgt.pos, head), 255);
				} else if (strike === 'uppercut') {
					const sparks = Array.from({ length: 6 }, (_, i) => ({
						ex: (Math.random() - 0.5) * 26,
						d: i * 45
					}));
					spawn({
						kind: 'uppercut',
						x: cx(tgt.pos),
						y: cy(tgt.pos),
						sparks,
						color: head,
						ttl: 760
					});
					spawnBurst(tgt.pos, head);
				} else if (src && strike === 'bullet') {
					spawn({
						kind: 'bullet',
						x: cx(src.pos),
						y: cy(src.pos),
						rot: angleDeg(src.pos, tgt.pos),
						len: distPx(src.pos, tgt.pos),
						color: head,
						ttl: 240
					});
					setTimeout(() => spawnBurst(tgt.pos, head), 110);
				} else if (src && strike === 'beam') {
					spawn({
						kind: 'beam',
						x: cx(src.pos),
						y: cy(src.pos),
						rot: angleDeg(src.pos, tgt.pos),
						len: distPx(src.pos, tgt.pos),
						color: head,
						ttl: 480
					});
					setTimeout(() => spawnBurst(tgt.pos, head), 110);
					setTimeout(() => spawnBurst(tgt.pos, head), 280);
				} else if (src && strike === 'chain') {
					const w = layerEl?.clientWidth ?? 600,
						h = layerEl?.clientHeight ?? 400;
					spawn({
						kind: 'chain',
						d: jagged(cx(src.pos), cy(src.pos), cx(tgt.pos), cy(tgt.pos), 8, 11),
						w,
						h,
						color: head,
						ttl: 420
					});
					setTimeout(() => spawnBurst(tgt.pos, head), 120);
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
			}),
			subscribe('construct:pulse', (e) => {
				spawn({
					kind: 'construct_ring',
					x: cx(e.pos),
					y: cy(e.pos),
					radius: e.radius,
					color: elementColor(e.element),
					isCatalyst: false,
					ttl: 480
				});
			}),
			subscribe('construct:catalyst', (e) => {
				spawn({
					kind: 'construct_ring',
					x: cx(e.pos),
					y: cy(e.pos),
					radius: e.radius,
					color: elementColor(e.element),
					isCatalyst: true,
					ttl: 360
				});
			}),
			subscribe('construct:turret', (e) => {
				const color = elementColor(e.element);
				spawn({
					kind: 'bullet',
					x: cx(e.pos),
					y: cy(e.pos),
					rot: angleDeg(e.pos, e.targetPos),
					len: distPx(e.pos, e.targetPos),
					color,
					ttl: 240
				});
				setTimeout(() => spawnBurst(e.targetPos, color), 110);
			}),
			subscribe('summon:attack', (e) => {
				const color = elementColor(e.element);
				if (e.isRanged) {
					const fromX = cx(e.fromPos),
						fromY = cy(e.fromPos);
					const dx = cx(e.toPos) - fromX,
						dy = cy(e.toPos) - fromY;
					const dur = Math.min(360, Math.max(90, chebyshev(e.fromPos, e.toPos) * 40));
					spawn({
						kind: 'projectile',
						x: fromX,
						y: fromY,
						dx,
						dy,
						rot: (Math.atan2(dy, dx) * 180) / Math.PI,
						dur,
						shape: 'orb',
						size: 's',
						trail: false,
						color,
						tail: color,
						ttl: dur + 40
					});
					setTimeout(() => spawnBurst(e.toPos, color), dur);
				} else {
					spawn({
						kind: 'swipe',
						x: e.toPos.x,
						y: e.toPos.y,
						rot: angleDeg(e.fromPos, e.toPos),
						color,
						ttl: 220
					});
					spawnBurst(e.toPos, color);
				}
			})
		];
		return () => unsubs.forEach((u) => u());
	});
</script>

<div class="fx-layer" bind:this={layerEl}>
	{#each gs.zones as z (z.id)}
		{@const d = (z.radius * 2 + 1) * TILE}
		{@const ramp = rampOf(z.ownerId)}
		{@const zs = zoneSkin(z)}
		<div
			class={zs === 'default' ? 'fx-zone' : 'fx-zone-' + zs}
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
		{:else if f.kind === 'reverseswipe'}
			<div
				class="fx-reverseswipe"
				style="left:{f.x * TILE + 18}px;top:{f.y * TILE + 18}px;--rot:{f.rot}deg;--c:{f.color};"
			></div>
		{:else if f.kind === 'claw'}
			<div class="fx-claw" style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;">
				{#each f.gashes as g}
					<div class="gash" style="--a:{g.a}deg;--d:{g.d}ms;--c:{f.color};"></div>
				{/each}
			</div>
		{:else if f.kind === 'stab'}
			<div
				class="fx-stab"
				style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--len:{f.len}px;--c:{f.color};"
			>
				<div class="spike"></div>
			</div>
		{:else if f.kind === 'flurry'}
			{#each f.ticks as t, i (i)}
				<div
					class="fx-tick"
					style="left:{f.x + t.jx}px;top:{f.y +
						t.jy}px;--a:{t.a}deg;--c:{f.color};animation-delay:{t.delay}ms;"
				></div>
			{/each}
		{:else if f.kind === 'slam'}
			<div class="fx-slam" style="left:{f.x}px;top:{f.y}px;--c:{f.color};">
				<div class="rock"></div>
				<div class="crater"></div>
				{#each f.debris as dbr, i (i)}
					<div class="debris" style="--ex:{dbr.ex}px;--ey:{dbr.ey}px;"></div>
				{/each}
			</div>
		{:else if f.kind === 'uppercut'}
			<div class="fx-upper" style="left:{f.x}px;top:{f.y}px;--c:{f.color};">
				<div class="ring"></div>
				<div class="streak"></div>
				{#each f.sparks as s, i (i)}
					<div class="spark" style="--ex:{s.ex}px;--d:{s.d}ms;"></div>
				{/each}
			</div>
		{:else if f.kind === 'bullet'}
			<div class="fx-muzzle" style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--c:{f.color};"></div>
			<div
				class="fx-tracer"
				style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--len:{f.len}px;--c:{f.color};"
			></div>
		{:else if f.kind === 'beam'}
			<div class="fx-charge" style="left:{f.x}px;top:{f.y}px;--c:{f.color};"></div>
			<div
				class="fx-beam"
				style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--len:{f.len}px;--c:{f.color};"
			></div>
		{:else if f.kind === 'chain'}
			<svg
				class="fx-chain"
				viewBox="0 0 {f.w} {f.h}"
				width={f.w}
				height={f.h}
				style="--c:{f.color};"
			>
				<path d={f.d}></path>
				<path class="core" d={f.d}></path>
			</svg>
		{:else if f.kind === 'zoneburst'}
			{@const dd = (f.radius * 2 + 1) * TILE}
			<div
				class="fx-zoneburst"
				style="left:{f.x * TILE + 18}px;top:{f.y * TILE +
					18}px;width:{dd}px;height:{dd}px;margin:{-dd / 2}px 0 0 {-dd / 2}px;--c:{f.color};"
			></div>
		{:else if f.kind === 'construct_ring'}
			{@const d = (f.radius * 2 + 1) * TILE}
			<div
				class="fx-construct-ring"
				class:catalyst={f.isCatalyst}
				style="left:{f.x}px;top:{f.y}px;width:{d}px;height:{d}px;margin:{-d / 2}px 0 0 {-d /
					2}px;--c:{f.color};"
			></div>
		{/if}
	{/each}
</div>

<style>
	/* All FX visuals live in the global stylesheets fx-strikes.css + fx-zones.css
	   (imported once in +layout). Only the layer box stays here. */
	.fx-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 50;
	}
</style>

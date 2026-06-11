<script lang="ts">
	import type { CharacterState, EngineState } from '$lib/types/state';
	import type { Position } from '$lib/types/common';
	import { samePos, chebyshev, step8Toward } from '$lib/combat/board';
	import { resolveTiles } from '$lib/combat/shapes';
	import { holdState } from '$lib/input/intent-state';
	import { subscribe, clear } from '$lib/combat/events';
	import { onMount } from 'svelte';
	import Gem from './Gem.svelte';
	import type { Ability } from '$lib/types/ability';
	import FxLayer from './FxLayer.svelte';
	import { resolveTheme } from './char-theme';

	let { gs, now = 0 }: { gs: EngineState; now: number } = $props();

	// Aim reticle cursor — recomputes every frame via `now`
	let reticle = $derived.by(() => {
		void now;
		if (holdState.holdingSlot && holdState.holdBehavior === 'aim' && holdState.reticle) {
			return { x: holdState.reticle.x, y: holdState.reticle.y };
		}
		return null;
	});

	// Preview tiles as a Set, recomputed each frame (for outline-only borders)
	let preview = $derived.by(() => {
		void now;
		const active = gs.party[gs.activeSlot];
		if (!active || gs.over || !holdState.holdingSlot) return null;
		const ability = active.def.abilities[holdState.holdingSlot as 'X' | 'C' | 'V'];
		if (!ability) return null;
		const tiles = computePreviewTiles(active, ability);
		if (tiles.length === 0) return null;
		return { keys: new Set(tiles.map((t) => `${t.x},${t.y}`)) }; // cls removed — themed via --ba-tint
	});
	function pickTarget(from: Position) {
		if (gs.focusTargetId) {
			const f = gs.enemies.find((e) => e.id === gs.focusTargetId && e.hp > 0);
			if (f) return f;
		}
		let best: (typeof gs.enemies)[number] | null = null;
		let bestD = Infinity;
		for (const e of gs.enemies) {
			if (e.hp <= 0) continue;
			const d = chebyshev(from, e.pos);
			if (d < bestD) {
				bestD = d;
				best = e;
			}
		}
		return best;
	}

	let baTint = $derived.by(() => {
		const active = gs.party[gs.activeSlot];
		return active ? resolveTheme(active.def).primary : 'var(--gold)';
	});

	// Sefyra X (track): red crosshair on the designated / locked enemy
	let trackCrosshair = $derived.by(() => {
		void now;
		if (holdState.holdingSlot === 'X' && holdState.holdBehavior === 'track') {
			const id = holdState.trackTargetId ?? gs.focusTargetId;
			if (id) {
				const e = gs.enemies.find((en) => en.id === id && en.hp > 0);
				if (e) return { x: e.pos.x, y: e.pos.y };
			}
			if (holdState.reticle) return { x: holdState.reticle.x, y: holdState.reticle.y };
		}
		return null;
	});

	// Sefyra X charge level (0/1/2) → aura on the caster while holding
	let chargeAura = $derived.by(() => {
		void now;
		const active = gs.party[gs.activeSlot];
		if (!active || gs.over) return null;
		if (holdState.holdingSlot === 'X' && holdState.holdBehavior === 'track') {
			return { x: active.pos.x, y: active.pos.y, tier: holdState.tier };
		}
		return null;
	});

	function computePreviewTiles(active: CharacterState, ability: Ability): Position[] {
		let tiles: Position[] = [];
		if (ability.shape === 'circle') {
			let center = active.pos;
			if (holdState.holdBehavior === 'aim' && holdState.reticle) {
				center = holdState.reticle;
			} else if (ability.allowSelfTarget && holdState.abilityHoldIsSelf) {
				center = active.pos;
			} else if (ability.autoTargetEnemy) {
				const enemy = gs.enemies.find(
					(e) => e.hp > 0 && chebyshev(active.pos, e.pos) <= (ability.shapeParams?.range ?? 99)
				);
				if (enemy) center = enemy.pos;
			}
			tiles = resolveTiles(
				'circle',
				center,
				active.facing,
				{ radius: ability.shapeParams?.radius ?? 1 },
				gs.board,
				center
			);
		} else if (ability.behavior === 'zone') {
			tiles = resolveTiles(
				'circle',
				active.pos,
				active.facing,
				{ radius: ability.shapeParams?.radius ?? 2 },
				gs.board,
				active.pos
			);
		} else if (ability.behavior === 'dash') {
			// shapeParams is Record<string, number> but dir is actually stored as a string.
			// Cast through unknown to satisfy TS without lying about the runtime type.
			const sp = ability.shapeParams ?? {};
			const spDir = (sp as Record<string, unknown>).dir as string | undefined;
			if (spDir === 'forward') {
				// Aimed directional dash (Sefyra C): a line along the aim direction.
				const aim = holdState.aimDir ?? active.facing;
				const ux = Math.sign(aim.x);
				const uy = Math.sign(aim.y);
				if (ux !== 0 || uy !== 0) {
					const len = sp.tiles ?? sp.range ?? 3;
					let p = { ...active.pos };
					for (let i = 0; i < len; i++) {
						const nx = p.x + ux,
							ny = p.y + uy;
						if (nx < 0 || nx >= gs.board.size.width || ny < 0 || ny >= gs.board.size.height) break;
						p = { x: nx, y: ny };
						tiles.push({ ...p });
					}
				}
			} else {
				// Legacy gap-closer (June9 C): filled disk of the dash range — unchanged.
				const effRange =
					holdState.holdBehavior === 'charge' ? holdState.chargedRange : (sp.range ?? 3);
				for (let dx = -effRange; dx <= effRange; dx++) {
					for (let dy = -effRange; dy <= effRange; dy++) {
						if (Math.max(Math.abs(dx), Math.abs(dy)) > effRange) continue;
						const tx = active.pos.x + dx,
							ty = active.pos.y + dy;
						if (tx >= 0 && tx < gs.board.size.width && ty >= 0 && ty < gs.board.size.height)
							tiles.push({ x: tx, y: ty });
					}
				}
			}
		} else if (ability.shape) {
			tiles = resolveTiles(
				ability.shape,
				active.pos,
				active.facing,
				ability.shapeParams ?? {},
				gs.board
			);
		}
		return tiles;
	}

	// Unified BA range: the LIVE basic's reach as a Chebyshev disk, themed + faint.
	// Hidden while aiming an ability so the preview owns the board.
	let baRange = $derived.by(() => {
		void now;
		const active = gs.party[gs.activeSlot];
		if (!active || gs.over || holdState.holdingSlot) return null;

		let ba: { range?: number } | null = null;
		if (active.def.basicChain) {
			ba = active.def.basicChain[active.baChainIndex] ?? null;
		} else if (active.def.contextualBasic) {
			const cb = active.def.contextualBasic;
			ba = active.stacks.current > 0 ? cb.withStack : cb.base;
		}
		if (!ba) return null;

		const range = ba.range ?? 1;
		const keys = new Set<string>();
		for (let dy = -range; dy <= range; dy++) {
			for (let dx = -range; dx <= range; dx++) {
				if (Math.max(Math.abs(dx), Math.abs(dy)) > range) continue;
				const tx = active.pos.x + dx,
					ty = active.pos.y + dy;
				if (tx < 0 || tx >= gs.board.size.width || ty < 0 || ty >= gs.board.size.height) continue;
				keys.add(`${tx},${ty}`);
			}
		}
		return keys;
	});

	/** Perimeter outline for a tile set, in the active char's tint. pct = outline strength. */
	function edgeBorders(keys: Set<string>, x: number, y: number, pct = 70): string {
		const c = `color-mix(in srgb, var(--ba-tint) ${pct}%, transparent)`;
		let s = '';
		if (!keys.has(`${x},${y - 1}`)) s += `border-top:1px solid ${c};`;
		if (!keys.has(`${x + 1},${y}`)) s += `border-right:1px solid ${c};`;
		if (!keys.has(`${x},${y + 1}`)) s += `border-bottom:1px solid ${c};`;
		if (!keys.has(`${x - 1},${y}`)) s += `border-left:1px solid ${c};`;
		return s;
	}

	// Bind the board element for input handler
	let boardEl: HTMLDivElement;
	export function getBoardEl() {
		return boardEl;
	}

	// ─── Floating text ───────────────────────────────────────────────────────
	type FloatEntry = { id: number; x: number; y: number; text: string; kind: string };
	let floats: FloatEntry[] = $state([]);
	let floatId = 0;

	function addFloat(pos: Position, text: string, kind: string) {
		const id = floatId++;
		floats.push({ id, x: pos.x, y: pos.y, text, kind });
		setTimeout(() => {
			floats = floats.filter((f) => f.id !== id);
		}, 900);
	}

	// ─── Event bus subscribers ───────────────────────────────────────────────
	onMount(() => {
		const unsubs = [
			subscribe('damage:dealt', (e) => {
				// Read gs at call time — not at subscribe time — so enemy switches
				// don't leave us searching a stale array.
				const target = gs.enemies.find((en) => en.id === e.target);
				if (target) {
					addFloat(target.pos, '-' + e.amount, 'dmg');
				}
			}),
			subscribe('basic:missed', (e) => {
				const target = gs.enemies.find((en) => en.id === e.target);
				if (target) addFloat(target.pos, 'Miss', 'miss');
			}),
			subscribe('damage:taken', (e) => {
				const target = gs.party.find((p) => p.id === e.target);
				if (target) addFloat(target.pos, '-' + e.amount, 'dmg');
			}),
			subscribe('heal:applied', (e) => {
				const target = gs.party.find((p) => p.id === e.target);
				if (target) addFloat(target.pos, '+' + e.amount, 'heal');
			})
		];
		return () => unsubs.forEach((u) => u());
	});

	// ─── Derived: tile classification ────────────────────────────────────────
	function tileClass(x: number, y: number, _now: number): string {
		const pos = { x, y };
		const classes: string[] = [];
		const active = gs.party[gs.activeSlot];
		if (!active || gs.over) return '';
		return classes.join(' ');
	}

	// ─── Entity lookups per tile ─────────────────────────────────────────────
	function entityAt(x: number, y: number) {
		const pos = { x, y };
		const active = gs.party[gs.activeSlot];
		if (active && samePos(active.pos, pos)) return { type: 'player' as const, data: active };
		for (const enemy of gs.enemies) {
			if (enemy.hp > 0 && samePos(enemy.pos, pos)) return { type: 'enemy' as const, data: enemy };
		}
		for (const summon of gs.summons) {
			if (samePos(summon.pos, pos)) return { type: 'summon' as const, data: summon };
		}
		for (const summon of gs.constructs) {
			if (samePos(summon.pos, pos)) return { type: 'construct' as const, data: summon };
		}
		return null;
	}

	// owner is a party member (zones are player-cast); party holds all defs, on- or off-field
	function zoneTintAt(x: number, y: number): string | null {
		for (const zone of gs.zones) {
			if (now >= zone.expiresAt) continue;
			if (chebyshev({ x, y }, zone.center) > zone.radius) continue;
			const ownerDef = gs.party.find((p) => p.id === zone.ownerId)?.def;
			return ownerDef ? resolveTheme(ownerDef).primary : 'var(--verdant)';
		}
		return null;
	}
</script>

<div
	class="board"
	bind:this={boardEl}
	style="grid-template-columns: repeat({gs.board.size.width}, 36px); --ba-tint: {baTint};"
>
	{#each { length: gs.board.size.height } as _, y}
		{#each { length: gs.board.size.width } as _, x}
			<!-- {@const extra = tileClass(x, y, now)} -->
			{@const entity = entityAt(x, y)}
			{@const pv = !!preview && preview.keys.has(`${x},${y}`)}
			{@const inRange = !pv && !!baRange && baRange.has(`${x},${y}`)}
			{@const edge = pv
				? edgeBorders(preview!.keys, x, y, 70)
				: inRange
					? edgeBorders(baRange!, x, y, 55)
					: ''}
			{@const zoneTint = zoneTintAt(x, y)}
			<div
				// class="tile {extra}"
				class="tile"
				class:cone-preview={pv}
				class:ba-range={inRange}
				style="{edge}{zoneTint ? `--zone-tint:${zoneTint};` : ''}"
			>
				{#if reticle && reticle.x === x && reticle.y === y}
					<div class="reticle-cursor"></div>
				{/if}
				{#if trackCrosshair && trackCrosshair.x === x && trackCrosshair.y === y}
					<div class="track-crosshair"></div>
				{/if}
				{#if entity?.type === 'player'}
					{#if chargeAura && chargeAura.x === x && chargeAura.y === y}
						<div class="charge-aura tier-{chargeAura.tier}">
							<span class="charge-pips">
								<span class="cpip lit"></span>
								<span class="cpip" class:lit={chargeAura.tier >= 1}></span>
								<span class="cpip" class:lit={chargeAura.tier >= 2}></span>
							</span>
						</div>
					{/if}
					<Gem type="player" character={entity.data} {now} />
				{:else if entity?.type === 'enemy'}
					<Gem
						type="enemy"
						enemy={entity.data}
						{now}
						locked={entity.data.id === gs.focusTargetId}
					/>
				{:else if entity?.type === 'summon'}
					<Gem type="summon" summon={entity.data} {now} />
				{:else if entity?.type === 'construct'}
					<Gem type="construct" construct={entity.data} {now} />
				{/if}
			</div>
		{/each}
	{/each}

	<!-- Floating text layer -->
	{#each floats as f (f.id)}
		{@const left = f.x * 36 + 18}
		{@const top = f.y * 36}
		<div class="float-text {f.kind}" style="left:{left}px;top:{top}px;">
			{f.text}
		</div>
	{/each}
	<FxLayer {gs} {now} />
</div>

<style>
	.board {
		display: grid;
		/* gap: 1px; */
		/* padding: 3px; */
		border: 2px solid var(--panel-2);
		box-sizing: border-box;
		border-radius: 9px;
		position: relative;
		background: radial-gradient(120% 120% at 50% 30%, #1c2230 0%, var(--panel) 70%);
	}
	.tile {
		width: 36px;
		height: 36px;
		/* background: #141414; */
		position: relative;
		transition: background 0.1s;
		box-sizing: border-box;
		box-shadow:
			1px 1px rgba(94, 94, 94, 0.3) inset,
			-1px -1px rgba(94, 94, 94, 0.3) inset;
	}

	.tile.ba-range {
		background: color-mix(in srgb, var(--ba-tint) 2%, transparent);
	}
	.tile.cone-preview {
		background: color-mix(in srgb, var(--ba-tint) 14%, transparent);
	}

	.tile.range-ring-far {
		background: rgba(14, 37, 41, 0.5);
		/* box-shadow: inset 0 0 0 1px rgba(110, 199, 214, 0.45); */
	}
	.reticle-cursor {
		position: absolute;
		margin: auto;
		inset: 2px;
		/* border: 1px solid var(--gold-bright); */
		border-radius: 50%;
		/* box-shadow: 0 0 10px var(--gold-bright); */
		pointer-events: none;
		z-index: 40;
		animation: pulse 0.8s infinite;
		height: 80%;
		aspect-ratio: 1;
		box-shadow: inset 0 0 0 3px rgba(140, 232, 160, 0.4);
	}

	.float-text {
		position: absolute;
		pointer-events: none;
		z-index: 60;
		font-size: 12px;
		font-weight: bold;
		animation: float-up 0.9s ease-out forwards;
	}
	.float-text.dmg {
		color: #ff8060;
	}
	.float-text.heal {
		color: var(--verdant-bright);
	}
	.float-text.miss {
		color: var(--text-dim, #9aa0a8);
		font-style: italic;
		font-weight: 600;
	}

	.track-crosshair {
		position: absolute;
		inset: 3px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 2px var(--coral);
		pointer-events: none;
		z-index: 45;
		animation: pulse 0.7s infinite;
	}
	.track-crosshair::before,
	.track-crosshair::after {
		content: '';
		position: absolute;
		background: var(--coral);
	}
	.track-crosshair::before {
		left: 50%;
		top: 14%;
		bottom: 14%;
		width: 2px;
		transform: translateX(-50%);
	}
	.track-crosshair::after {
		top: 50%;
		left: 14%;
		right: 14%;
		height: 2px;
		transform: translateY(-50%);
	}

	.charge-aura {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 30;
		border-radius: 6px;
	}
	.charge-aura.tier-0 {
		box-shadow: inset 0 0 8px 1px rgba(232, 184, 74, 0.35);
	}
	.charge-aura.tier-1 {
		box-shadow: inset 0 0 12px 2px var(--gold);
	}
	.charge-aura.tier-2 {
		box-shadow: inset 0 0 16px 3px var(--gold-bright);
		animation: pulse 0.5s infinite;
	}

	.charge-pips {
		position: absolute;
		top: 2px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 2px;
		padding: 1px 3px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.45);
		z-index: 46;
	}
	.charge-pips .cpip {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
	}
	.charge-pips .cpip.lit {
		background: var(--gold-bright);
		box-shadow: 0 0 3px var(--gold-bright);
	}
</style>

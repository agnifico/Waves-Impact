<script lang="ts">
	import type { CharacterState, EngineState } from '$lib/types/state';
	import type { Position } from '$lib/types/common';
	import { samePos, chebyshev, step8Toward, occupies, inBounds } from '$lib/combat/board';
	import { resolveTiles } from '$lib/combat/shapes';
	import { CREATIONS } from '$lib/data/creations';
	import { holdState, camera, ZOOM_LEVELS, zoomIn, zoomOut, zoomReset, isDown, wasdVec } from '$lib/input/intent-state';
	import { subscribe, clear } from '$lib/combat/events';
	import { onMount } from 'svelte';
	import Gem from './Gem.svelte';
	import type { Ability } from '$lib/types/ability';
	import FxLayer from './FxLayer.svelte';
	import { resolveTheme } from './char-theme';

	let { gs, now = 0 }: { gs: EngineState; now: number } = $props();

	// ─── Camera: zoom + follow + elastic look ────────────────────────────────
	// The whole board lives in a `.world` layer that scales+pans inside a fixed
	// `.viewport`. All TILE=36 math downstream is untouched — the camera is one
	// transform on top, so gems, FX, everything magnifies together.
	const TILE = 36;
	const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

	let vpW = $derived(gs.board.size.width * TILE);   // viewport = board size at 1×
	let vpH = $derived(gs.board.size.height * TILE);
	// `camera` is a plain object (like holdState), so gate on `now` to stay live.
	let zoom = $derived.by(() => {
		void now;
		return ZOOM_LEVELS[camera.zoomIndex] ?? 1;
	});
	let zoomPct = $derived.by(() => {
		void now;
		return Math.round((ZOOM_LEVELS[camera.zoomIndex] ?? 1) * 100);
	});

	// Elastic look-offset (px). While `cameraLook` (Z) is held, WASD pans the
	// camera; on release it returns to 0 and the CSS transition eases home.
	let lookX = $state(0);
	let lookY = $state(0);
	let lastNow = now;
	$effect(() => {
		const dt = Math.min(50, now - lastNow); // cap dt so a tab-stall can't jump
		lastNow = now;
		if (isDown('cameraLook')) {
			const v = wasdVec();
			if (v) {
				const SPEED = 0.6; // px/ms — peek speed
				lookX = clampN(lookX + v.x * SPEED * dt, -vpW, vpW);
				lookY = clampN(lookY + v.y * SPEED * dt, -vpH, vpH);
			}
		} else if (lookX !== 0 || lookY !== 0) {
			lookX = 0; // snap target → transition eases the camera back to centre
			lookY = 0;
		}
	});

	// Pan to centre the active unit (+ look offset), clamped so the board edge is
	// never overshot. If the zoomed world is smaller than the viewport, centre it.
	let cam = $derived.by(() => {
		void now;
		const active = gs.party[gs.activeSlot];
		const worldW = vpW * zoom, worldH = vpH * zoom;
		const fx = ((active?.pos.x ?? gs.board.size.width / 2 - 0.5) + 0.5) * TILE;
		const fy = ((active?.pos.y ?? gs.board.size.height / 2 - 0.5) + 0.5) * TILE;
		let panX = vpW / 2 - fx * zoom + lookX;
		let panY = vpH / 2 - fy * zoom + lookY;
		panX = worldW <= vpW ? (vpW - worldW) / 2 : clampN(panX, vpW - worldW, 0);
		panY = worldH <= vpH ? (vpH - worldH) / 2 : clampN(panY, vpH - worldH, 0);
		return { panX, panY, zoom };
	});

	// Off-screen enemies → a red glow bleeding in from the border edge in their
	// direction. Pulses brighter while that enemy is winding up an attack.
	let edgeMarkers = $derived.by(() => {
		void now;
		const { panX, panY, zoom: z } = cam;
		const cx0 = vpW / 2, cy0 = vpH / 2;
		const M = 8; // inset from the very edge
		const out: { id: string; x: number; y: number; ang: number; winding: boolean }[] = [];
		for (const e of gs.enemies) {
			if (e.hp <= 0) continue;
			const sx = panX + (e.pos.x + 0.5) * TILE * z;
			const sy = panY + (e.pos.y + 0.5) * TILE * z;
			if (sx >= 0 && sx <= vpW && sy >= 0 && sy <= vpH) continue; // on-screen
			const dx = sx - cx0, dy = sy - cy0;
			if (dx === 0 && dy === 0) continue;
			let t = Infinity;
			if (dx > 0) t = Math.min(t, (vpW - M - cx0) / dx);
			if (dx < 0) t = Math.min(t, (M - cx0) / dx);
			if (dy > 0) t = Math.min(t, (vpH - M - cy0) / dy);
			if (dy < 0) t = Math.min(t, (M - cy0) / dy);
			out.push({
				id: e.id,
				x: cx0 + dx * t,
				y: cy0 + dy * t,
				ang: (Math.atan2(dy, dx) * 180) / Math.PI,
				winding: !!e.pendingAttack
			});
		}
		return out;
	});

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
		const d = ability.delivery;
		const shape = d?.shape;
		const sp = d?.shapeParams ?? {};
		const aimRange = d?.aimRange ?? sp.range;

		const zoneCenter =
			d?.holdBehavior === 'aim' && holdState.reticle ? holdState.reticle : active.pos;

		if (shape === 'circle') {
			let center: Position = active.pos;
			if (holdState.holdBehavior === 'aim' && holdState.reticle) {
				center = holdState.reticle;
			} else if (d?.allowSelfTarget && holdState.abilityHoldIsSelf) {
				center = active.pos;
			} else if (d?.autoTargetEnemy) {
				const enemy = gs.enemies.find(
					(e) => e.hp > 0 && chebyshev(active.pos, e.pos) <= (aimRange ?? 99)
				);
				if (enemy) center = enemy.pos;
			}
			tiles = resolveTiles(
				'circle',
				center,
				active.facing,
				{ radius: sp.radius ?? 1 },
				gs.board,
				center
			);
		} else if (ability.behavior === 'zone') {
			tiles = resolveTiles(
				'circle',
				zoneCenter,
				active.facing,
				{ radius: sp.radius ?? 2 },
				gs.board,
				zoneCenter
			);
		} else if (ability.behavior === 'multi_construct' && ability.multiConstructOffsets) {
			for (const off of ability.multiConstructOffsets) {
				const tx = active.pos.x + off.x;
				const ty = active.pos.y + off.y;
				if (tx >= 0 && tx < gs.board.size.width && ty >= 0 && ty < gs.board.size.height) {
					tiles.push({ x: tx, y: ty });
				}
			}
		} else if (ability.behavior === 'dash') {
			const spDir = (sp as Record<string, unknown>).dir as string | undefined;
			if (spDir === 'forward') {
				const aim = holdState.aimDir ?? active.facing;
				const ux = Math.sign(aim.x);
				const uy = Math.sign(aim.y);
				if (ux !== 0 || uy !== 0) {
					const len = (sp.tiles as number | undefined) ?? sp.range ?? 3;
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
		} else if (shape === 'footprint' && ability.creationId) {
			// Auto-derive placement preview from the construct/summon's footprint.
			let center: Position = active.pos;
			if (holdState.holdBehavior === 'aim' && holdState.reticle) {
				center = holdState.reticle;
			} else if (d?.autoTargetEnemy) {
				const enemy = gs.enemies.find(
					(e) => e.hp > 0 && chebyshev(active.pos, e.pos) <= (aimRange ?? 99)
				);
				if (enemy) center = enemy.pos;
			}
			const creationDef = CREATIONS[ability.creationId];
			const offsets = creationDef?.footprint ?? [{ x: 0, y: 0 }];
			tiles = offsets
				.map((o) => ({ x: center.x + o.x, y: center.y + o.y }))
				.filter((p) => inBounds(gs.board, p));
		} else if (shape) {
			tiles = resolveTiles(shape, active.pos, active.facing, sp, gs.board);
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
		const c = `color-mix(in srgb, var(--ba-tint) 30%, transparent);`;
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
	type FloatEntry = {
		id: number;
		x: number;
		y: number;
		text: string;
		kind: string;
		color: string;
		big: boolean;
	};
	let floats: FloatEntry[] = $state([]);
	let floatId = 0;

	// ─── Element → damage colour ─────────────────────────────────────────────────
	const ELEMENT_DMG_COLOR: Record<string, string> = {
		fire: 'var(--fire-bright)',
		water: 'var(--water-bright)',
		wind: 'var(--wind-bright)',
		nature: 'var(--nature-bright)',
		light: 'var(--light-bright)',
		dark: 'var(--dark-bright)',
		normal: 'var(--gold)'
	};
	function dmgColor(element: string | undefined): string {
		return ELEMENT_DMG_COLOR[element ?? ''] ?? '#ff8060';
	}

	// ─── Rolling DPS + combat stats ──────────────────────────────────────────────
	const DPS_WINDOW_MS = 5000;
	let damageLog: { t: number; amount: number }[] = [];
	let rollingDps = $state(0);
	let totalDamage = $state(0);
	let charDamage = $state<Record<string, number>>({});
	let combatStartedAt = $state<number | null>(null);
	let combatEndedAt = $state<number | null>(null);

	// Freeze elapsed on fight end; reset everything when a new fight begins.
	$effect(() => {
		if (gs.over) {
			if (combatStartedAt !== null && combatEndedAt === null) combatEndedAt = now;
		} else if (combatEndedAt !== null) {
			combatStartedAt = null;
			combatEndedAt = null;
			totalDamage = 0;
			charDamage = {};
			damageLog = [];
			rollingDps = 0;
		}
	});

	let elapsedMs = $derived(combatStartedAt !== null ? (combatEndedAt ?? now) - combatStartedAt : 0);

	function fmtTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
	}

	function recordPlayerDmg(amount: number, sourceId: string) {
		const t = performance.now();
		if (combatStartedAt === null) combatStartedAt = t;
		totalDamage += amount;
		charDamage[sourceId] = (charDamage[sourceId] ?? 0) + amount;
		damageLog.push({ t, amount });
		const cutoff = t - DPS_WINDOW_MS;
		damageLog = damageLog.filter((d) => d.t >= cutoff);
		const windowTotal = damageLog.reduce((s, d) => s + d.amount, 0);
		const span = damageLog.length > 1 ? t - damageLog[0].t : DPS_WINDOW_MS;
		rollingDps = Math.round((windowTotal / span) * 1000);
	}
	function isBig(amount: number): boolean {
		// return amount > Math.max(rollingDps * 2, 40);
		return amount > 49;
	}
	function isPlayerSource(sourceId: string): boolean {
		return gs.party.some((p) => p.id === sourceId);
	}

	function addFloat(pos: Position, text: string, kind: string, color = '', big = false) {
		const id = floatId++;
		floats.push({ id, x: pos.x, y: pos.y, text, kind, color, big });
		setTimeout(
			() => {
				floats = floats.filter((f) => f.id !== id);
			},
			big ? 1200 : 900
		);
	}

	// ─── Event bus subscribers ───────────────────────────────────────────────
	onMount(() => {
		const unsubs = [
			subscribe('damage:dealt', (e) => {
				const target = gs.enemies.find((en) => en.id === e.target);
				if (target) {
					const sourceChar = gs.party.find((p) => p.id === e.source);
					const element = (e as any).element ?? sourceChar?.def.element;
					const color = dmgColor(element);
					if (isPlayerSource(e.source)) recordPlayerDmg(e.amount, e.source);
					addFloat(target.pos, '-' + e.amount, 'dmg', color, isBig(e.amount));
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
	// Movers (player/enemy/summon). Footprint-aware; isHead marks the icon cell.
	function entityAt(x: number, y: number) {
		const pos = { x, y };
		const active = gs.party[gs.activeSlot];
		if (active && occupies(active, pos))
			return { type: 'player' as const, data: active, isHead: samePos(active.pos, pos) };
		for (const enemy of gs.enemies) {
			if (enemy.hp > 0 && occupies(enemy, pos))
				return { type: 'enemy' as const, data: enemy, isHead: samePos(enemy.pos, pos) };
		}
		for (const summon of gs.summons) {
			if (occupies(summon, pos))
				return { type: 'summon' as const, data: summon, isHead: samePos(summon.pos, pos) };
		}
		return null;
	}

	// Constructs render in their own sub-layer, beneath movers — so the icon is
	// never hidden by anything standing on (or transiently over) a footprint cell.
	function constructCellAt(x: number, y: number) {
		const pos = { x, y };
		for (const c of gs.constructs) {
			if (occupies(c, pos)) return { c, isHead: samePos(c.pos, pos) };
		}
		return null;
	}

	/** Bounding-box span of a footprint (in tiles) + its top-left origin offset. */
	function fpSpan(offs: { x: number; y: number }[] | undefined) {
		if (!offs || offs.length === 0) return { w: 1, h: 1, ox: 0, oy: 0 };
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const o of offs) {
			if (o.x < minX) minX = o.x;
			if (o.x > maxX) maxX = o.x;
			if (o.y < minY) minY = o.y;
			if (o.y > maxY) maxY = o.y;
		}
		return { w: maxX - minX + 1, h: maxY - minY + 1, ox: minX, oy: minY };
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

<div class="viewport" bind:this={boardEl} style="width:{vpW}px; height:{vpH}px;">
	<div
		class="world"
		style="transform: translate({cam.panX}px, {cam.panY}px) scale({cam.zoom}); --ba-tint: {baTint};"
	>
		<div class="grid" style="grid-template-columns: repeat({gs.board.size.width}, 36px);">
	{#each { length: gs.board.size.height } as _, y}
		{#each { length: gs.board.size.width } as _, x}
			<!-- {@const extra = tileClass(x, y, now)} -->
			{@const entity = entityAt(x, y)}
			{@const con = constructCellAt(x, y)}
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
				{#if con}
					{@const mode = con.c.footprintRender ?? 'all'}
					{@const multi = (con.c.footprint?.length ?? 1) > 1}
					{#if !multi || mode === 'all'}
						<Gem type="construct" construct={con.c} {now} />
					{:else if mode === 'head'}
						{#if con.isHead}
							<Gem type="construct" construct={con.c} {now} />
						{:else}
							<div class="fp-slab"></div>
						{/if}
					{:else if mode === 'scaled'}
						<!-- rendered in scaled overlay above the grid -->
					{/if}
				{/if}
				{#if entity?.type === 'player' && entity.isHead}
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
				{:else if entity?.type === 'enemy' && entity.isHead}
					<Gem
						type="enemy"
						enemy={entity.data}
						{now}
						party={gs.party}
						locked={entity.data.id === gs.focusTargetId}
					/>
				{:else if entity?.type === 'summon'}
					{@const s = entity.data}
					{@const mode = s.footprintRender ?? 'all'}
					{@const multi = (s.footprint?.length ?? 1) > 1}
					{#if !multi || mode === 'all'}
						<Gem type="summon" summon={s} {now} />
					{:else if mode === 'head'}
						{#if entity.isHead}
							<Gem type="summon" summon={s} {now} />
						{:else}
							<div class="fp-slab"></div>
						{/if}
					{:else if mode === 'scaled'}
						<!-- rendered in scaled overlay above the grid -->
					{/if}
				{/if}
			</div>
		{/each}
	{/each}

	<!-- Scaled multi-tile entities — rendered above the grid to avoid stacking-context clipping -->
	{#each gs.constructs as c}
		{#if (c.footprint?.length ?? 1) > 1 && (c.footprintRender ?? 'all') === 'scaled'}
			{@const sp = fpSpan(c.footprint)}
			<div
				class="scaled-entity"
				style="left:{(c.pos.x + sp.ox) * 36}px; top:{(c.pos.y + sp.oy) * 36}px; width:{sp.w * 36}px; height:{sp.h * 36}px;{c.profileImage ? ` background-image:url(${c.profileImage});` : ''}"
			></div>
		{/if}
	{/each}
	{#each gs.summons as s}
		{#if (s.footprint?.length ?? 1) > 1 && (s.footprintRender ?? 'all') === 'scaled'}
			{@const sp = fpSpan(s.footprint)}
			<div
				class="scaled-entity"
				style="left:{(s.pos.x + sp.ox) * 36}px; top:{(s.pos.y + sp.oy) * 36}px; width:{sp.w * 36}px; height:{sp.h * 36}px;{s.profileImage ? ` background-image:url(${s.profileImage});` : ''}"
			></div>
		{/if}
	{/each}

	<!-- Floating text layer -->
	{#each floats as f (f.id)}
		{@const left = f.x * 36 + 18}
		{@const top = f.y * 36}
		<div
			class="float-text {f.kind}"
			class:big={f.big}
			style="left:{left}px;top:{top}px;{f.color ? `color:${f.color};` : ''}"
		>
			{f.text}
		</div>
	{/each}
	<FxLayer {gs} {now} />
		</div>
	</div>

	<!-- Off-screen enemy markers: red glow bleeding in from the border edge -->
	{#each edgeMarkers as m (m.id)}
		<div
			class="edge-marker"
			class:winding={m.winding}
			style="left:{m.x}px; top:{m.y}px; --ang:{m.ang}deg;"
		></div>
	{/each}

	{#if totalDamage > 0}
		<div class="stats-panel">
			<div class="stats-header">
				<span class="elapsed">{fmtTime(elapsedMs)}</span>
				<span class="total-dmg">{totalDamage.toLocaleString()}</span>
				<span class="dps-val">{rollingDps}<span class="dim"> DPS</span></span>
			</div>
			{#each gs.party as pc}
				{@const dmg = charDamage[pc.id] ?? 0}
				{#if dmg > 0}
					{@const col = resolveTheme(pc.def).primary}
					{@const pct = Math.round((dmg / totalDamage) * 100)}
					<div class="stats-row">
						<span class="char-name" style="color:{col}">{pc.def.name}</span>
						<div class="bar-and-num">
							<div class="char-bar-track">
								<div class="char-bar-fill" style="width:{pct}%; background:{col}"></div>
							</div>
							<span class="char-dmg">{dmg.toLocaleString()}</span>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- On-page zoom controls (mirror the 0 / − / = hotkeys). stopPropagation so a
	     click here never registers as a board basic-attack via the viewport listener. -->
	<div class="zoom-controls" onmousedown={(e) => e.stopPropagation()}>
		<button class="zoom-btn" onclick={zoomOut} title="Zoom out (−)" aria-label="Zoom out">−</button>
		<button class="zoom-pct" onclick={zoomReset} title="Reset zoom (0)" aria-label="Reset zoom">{zoomPct}%</button>
		<button class="zoom-btn" onclick={zoomIn} title="Zoom in (=)" aria-label="Zoom in">+</button>
	</div>
</div>

<style>
	.viewport {
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
		border-radius: 9px;
		box-shadow: 0 0 0 2px var(--panel-2);
		background: radial-gradient(120% 120% at 50% 30%, #1c2230 0%, var(--panel) 70%);
	}
	.world {
		position: relative;
		transform-origin: 0 0;
		transition: transform 180ms ease-out;
		will-change: transform;
	}
	.grid {
		display: grid;
		position: relative;
	}
	/* Off-screen enemy direction marker — red glow bleeding in from the border. */
	.edge-marker {
		position: absolute;
		width: 46px;
		height: 12px;
		transform: translate(-50%, -50%) rotate(var(--ang, 0deg));
		transform-origin: 50% 50%;
		pointer-events: none;
		z-index: 55;
		border-radius: 6px;
		background: linear-gradient(
			to right,
			transparent 0%,
			color-mix(in srgb, var(--blood, #e04040) 35%, transparent) 55%,
			var(--blood, #e04040) 100%
		);
		filter: drop-shadow(0 0 5px color-mix(in srgb, var(--blood, #e04040) 70%, transparent));
		opacity: 0.85;
	}
	.edge-marker.winding {
		opacity: 1;
		animation: edge-pulse 0.5s ease-in-out infinite;
	}
	@keyframes edge-pulse {
		0%, 100% {
			opacity: 0.6;
			filter: drop-shadow(0 0 4px color-mix(in srgb, var(--blood, #e04040) 60%, transparent));
		}
		50% {
			opacity: 1;
			filter: drop-shadow(0 0 10px var(--blood, #e04040));
		}
	}
	.zoom-controls {
		position: absolute;
		left: 8px;
		bottom: 8px;
		z-index: 56;
		display: flex;
		align-items: stretch;
		gap: 2px;
		padding: 2px;
		background: rgba(8, 12, 18, 0.78);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		backdrop-filter: blur(3px);
		user-select: none;
		font-family: 'JetBrains Mono', monospace;
	}
	.zoom-controls button {
		pointer-events: auto;
		cursor: pointer;
		border: none;
		background: var(--panel-2);
		color: var(--text);
		border-radius: 4px;
		font-family: inherit;
		transition: color 0.12s, background 0.12s;
	}
	.zoom-controls button:hover {
		color: var(--gold);
		background: var(--panel-raised, var(--panel-2));
	}
	.zoom-btn {
		width: 22px;
		height: 22px;
		font-size: 16px;
		font-weight: 700;
		line-height: 1;
	}
	.zoom-pct {
		min-width: 44px;
		font-size: 11px;
		font-weight: 600;
		padding: 0 6px;
		color: var(--text-dim);
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
		background: color-mix(in srgb, var(--ba-tint) 5%, transparent);
	}
	.tile.cone-preview {
		background: color-mix(in srgb, var(--ba-tint) 14%, transparent);
	}

	.tile.range-ring-far {
		background: rgba(14, 37, 41, 0.5);
	}
	/* Non-icon footprint cell ('head' render mode): a raised, glowing slab. */
	.fp-slab {
		position: absolute;
		inset: 2px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--gold) 14%, transparent);
		box-shadow:
			0 0 8px color-mix(in srgb, var(--gold) 35%, transparent),
			0 1px 0 rgba(255, 255, 255, 0.18) inset,
			0 -1px 2px rgba(0, 0, 0, 0.4) inset;
		pointer-events: none;
	}
	/* Scaled multi-tile entity rendered in an overlay above the grid. */
	.scaled-entity {
		position: absolute;
		z-index: 15;
		pointer-events: none;
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		border-radius: 4px;
		box-shadow: 0 0 12px rgba(0, 0, 0, 0.5);
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
		margin: auto;
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
		/* color: #ff8060; */
	}
	.float-text.big {
		font-size: 20px;
		font-weight: 900;
		letter-spacing: -0.5px;
		text-shadow:
			0 0 10px currentColor,
			0 2px 6px rgba(0, 0, 0, 0.7);
		animation: float-up-big 1.2s ease-out forwards;
		font-family: 'DePixel';
	}

	@keyframes float-up-big {
		0% {
			transform: translateY(0) scale(1.3);
			opacity: 1;
		}
		15% {
			transform: translateY(-6px) scale(1.15);
			opacity: 1;
		}
		100% {
			transform: translateY(-52px) scale(1);
			opacity: 0;
		}
	}

	.stats-panel {
		position: absolute;
		bottom: 8px;
		right: 8px;
		z-index: 50;
		min-width: 185px;
		padding: 6px 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: rgba(8, 12, 18, 0.78);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 4px;
		backdrop-filter: blur(3px);
		pointer-events: none;
		user-select: none;
		font-family: 'JetBrains Mono', monospace;
		font-size: 9px;
	}
	.stats-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding-bottom: 4px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	}
	.elapsed {
		color: rgba(255, 255, 255, 0.28);
	}
	.total-dmg {
		color: rgba(255, 255, 255, 0.65);
		font-weight: 700;
	}
	.dps-val {
		color: var(--gold);
	}
	.dim {
		color: rgba(255, 255, 255, 0.28);
		font-weight: 400;
	}

	.stats-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.char-name {
		width: 54px;
		font-size: 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex-shrink: 0;
		letter-spacing: 0.3px;
	}
	.bar-and-num {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
	}
	.char-bar-track {
		flex: 1;
		height: 3px;
		background: rgba(255, 255, 255, 0.07);
		border-radius: 2px;
		overflow: hidden;
	}
	.char-bar-fill {
		height: 100%;
		border-radius: 2px;
		opacity: 0.75;
		transition: width 0.25s ease;
	}
	.char-dmg {
		min-width: 34px;
		text-align: right;
		color: rgba(255, 255, 255, 0.45);
		font-size: 8px;
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
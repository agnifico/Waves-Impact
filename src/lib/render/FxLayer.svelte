<script lang="ts">
	import type { EngineState } from '$lib/types/state';
	import type { Position } from '$lib/types/common';
	import { chebyshev, step8Toward, samePos } from '$lib/combat/board';
	import { subscribe } from '$lib/combat/events';
	import { resolveTheme, elementRamp } from '$lib/render/char-theme'; // ← adjust to where char-theme.ts lives
	import type { FxSpec } from '$lib/types/ability';
	import { onMount } from 'svelte';

	let { gs, now = 0 }: { gs: EngineState; now: number } = $props();

	const TILE = 36;
	const cx = (p: Position) => p.x * TILE + TILE / 2;
	const cy = (p: Position) => p.y * TILE + TILE / 2;
	const distPx = (a: Position, b: Position) => Math.hypot(cx(b) - cx(a), cy(b) - cy(a));
	const angleDeg = (from: Position, to: Position) =>
		(Math.atan2(cy(to) - cy(from), cx(to) - cx(from)) * 180) / Math.PI;

	// ─── Cast-FX direction + tile-layout helpers (ported from the FX library) ──
	/** Snap a facing vector to one of 8 directions → unit step + degrees. */
	function snapDir(f: Position): { dx: number; dy: number; deg: number } {
		const dx = Math.sign(f.x || 0);
		const dy = Math.sign(f.y || 0);
		if (dx === 0 && dy === 0) return { dx: 0, dy: -1, deg: -90 }; // default up
		return { dx, dy, deg: (Math.atan2(dy, dx) * 180) / Math.PI };
	}
	type TilePart = { tx: number; ty: number; d: number }; // px offsets from center + stagger
	/** Forward line of N tiles along the snapped facing (fx-cast-line). */
	function castLineTiles(d: { dx: number; dy: number }, n: number): TilePart[] {
		const out: TilePart[] = [];
		for (let i = 1; i <= n; i++) out.push({ tx: i * d.dx * TILE, ty: i * d.dy * TILE, d: (i - 1) * 70 });
		return out;
	}
	/** Cone tiles: orthogonal → Pascal fan (1·3·5), diagonal → filled square quadrant.
	 *  Must match pconeFrom in combat/shapes/pcone.ts exactly. */
	function coneTiles(d: { dx: number; dy: number }, range: number): TilePart[] {
		const out: TilePart[] = [];
		if (d.dx === 0 || d.dy === 0) {
			const px = -d.dy, py = d.dx;
			for (let r = 1; r <= range; r++)
				for (let k = -(r - 1); k <= r - 1; k++)
					out.push({ tx: (r * d.dx + k * px) * TILE, ty: (r * d.dy + k * py) * TILE, d: (r - 1) * 70 });
		} else {
			// Filled quadrant: all tiles in the dir.x/dir.y quadrant out to range
			for (let i = 0; i <= range; i++)
				for (let j = 0; j <= range; j++) {
					if (i === 0 && j === 0) continue;
					const ring = Math.max(i, j);
					out.push({ tx: i * d.dx * TILE, ty: j * d.dy * TILE, d: (ring - 1) * 70 });
				}
		}
		return out;
	}
	/** Filled circle (chebyshev radius) tiles, center-out by ring for stagger + color ramp. */
	function circleTiles(radius: number): { tx: number; ty: number; d: number; ring: number; maxRing: number }[] {
		const out: { tx: number; ty: number; d: number; ring: number; maxRing: number }[] = [];
		for (let dx = -radius; dx <= radius; dx++)
			for (let dy = -radius; dy <= radius; dy++) {
				const ring = Math.max(Math.abs(dx), Math.abs(dy));
				if (ring > radius) continue;
				out.push({ tx: dx * TILE, ty: dy * TILE, d: ring * 45, ring, maxRing: radius });
			}
		return out;
	}

	/** 4-side converge tiles for construct spawn (fx-construct-spawn). */
	function constructTiles(): { mx: number; my: number; d: number }[] {
		return [
			{ mx: 0, my: -TILE, d: 0 },
			{ mx: TILE, my: 0, d: 18 },
			{ mx: 0, my: TILE, d: 36 },
			{ mx: -TILE, my: 0, d: 54 }
		];
	}

	/** Resolve ANY combat entity id → its [primary, secondary] colour ramp.
	 *  Party characters use their resolved theme; enemies / summons / constructs
	 *  use their element ramp. ONE resolver for every owner — strikes, casts,
	 *  zones, spawns and heals all read colour from here. */
	function rampOf(id: string): [string, string] {
		const pc = gs.party.find((p) => p.id === id);
		if (pc) {
			const t = resolveTheme(pc.def);
			return [t.primary, t.secondary];
		}
		const en = gs.enemies.find((e) => e.id === id);
		if (en) return elementRamp(en.def.element);
		const sm = gs.summons?.find((s) => s.id === id);
		if (sm) return elementRamp(sm.element);
		const ct = gs.constructs?.find((c) => c.id === id);
		if (ct) return elementRamp(ct.element);
		return elementRamp(undefined); // gold default
	}
	/** The two-colour ramp for a strike/cast: explicit fx.colors wins, else the
	 *  owner's ramp. This is the whole colour contract in one line, applied
	 *  identically to player strikes and enemy strikes. */
	function colorsFor(fx: FxSpec | null | undefined, ownerId: string): [string, string] {
		const ramp = rampOf(ownerId);
		const head = fx?.colors?.[0] ?? ramp[0];
		const tail = fx?.colors?.[1] ?? ramp[1] ?? head;
		return [head, tail];
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
		if (d.enhancedBasic?.ba?.name === abilityName) return d.enhancedBasic.ba.fx ?? null;
		if (d.channelBasic?.name === abilityName) return d.channelBasic.fx ?? null;
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
		return elementRamp(el)[0];
	}

	type ConstructRing = {
		id: number;
		kind: 'construct_ring';
		x: number;
		y: number;
		radius: number;
		color: string;
		color2?: string;
		isCatalyst: boolean;
		ttl: number;
	};

	type Burst = { id: number; kind: 'burst'; x: number; y: number; color: string; color2?: string; ttl: number };
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
		color2?: string;
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
		color2?: string;
		ttl: number;
	};
	type ReverseSwipe = {
		id: number;
		kind: 'reverseswipe';
		x: number;
		y: number;
		rot: number;
		color: string;
		color2?: string;
		ttl: number;
	};
	type ZoneBurst = {
		id: number;
		kind: 'zoneburst';
		x: number;
		y: number;
		radius: number;
		color: string;
		color2?: string;
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
		color2?: string;
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
		color2?: string;
		ttl: number;
	};
	type Flurry = {
		id: number;
		kind: 'flurry';
		x: number;
		y: number;
		ticks: { jx: number; jy: number; a: number; delay: number }[];
		color: string;
		color2?: string;
		ttl: number;
	};
	type Slam = {
		id: number;
		kind: 'slam';
		x: number;
		y: number;
		debris: { ex: number; ey: number }[];
		color: string;
		color2?: string;
		ttl: number;
	};
	type Uppercut = {
		id: number;
		kind: 'uppercut';
		x: number;
		y: number;
		sparks: { ex: number; d: number }[];
		color: string;
		color2?: string;
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
		color2?: string;
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
		color2?: string;
		ttl: number;
	};
	type Chain = {
		id: number;
		kind: 'chain';
		d: string;
		w: number;
		h: number;
		color: string;
		color2?: string;
		ttl: number;
	};
	type Stream = { id: number; kind: 'stream'; x: number; y: number; rot: number; len: number; color: string; color2?: string; ttl: number };
	type Thread = { id: number; kind: 'thread'; x: number; y: number; rot: number; len: number; color: string; color2?: string; ttl: number };
	type CastFlash = { id: number; kind: 'castflash'; x: number; y: number; color: string; color2?: string; ttl: number };
	type CastAoe = { id: number; kind: 'castaoe'; x: number; y: number; d: number; color: string; color2?: string; ttl: number };
	type CastTiles = {
		id: number; kind: 'casttiles'; cls: 'fx-cast-line' | 'fx-cast-pcone' | 'fx-cast-circle';
		x: number; y: number; ttl: number;
		tiles: { tx: number; ty: number; d: number; color: string }[];
	};
	type ConstructSpawn = {
		id: number; kind: 'constructspawn'; x: number; y: number; color: string; color2?: string; ttl: number;
		tiles: { mx: number; my: number; d: number }[];
	};
	type TeamHeal = {
		id: number; kind: 'teamheal'; x: number; y: number; color: string; color2?: string; ttl: number;
		motes: { mx: number; d: number }[];
	};
	type StatusFx = { id: number; kind: 'stun' | 'slow'; x: number; y: number; color: string; color2?: string; ttl: number };
	type Knockback = { id: number; kind: 'knockback'; x: number; y: number; rot: number; color: string; color2?: string; ttl: number };
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
		| Stream
		| Thread
		| CastFlash
		| CastAoe
		| CastTiles
		| ConstructSpawn
		| TeamHeal
		| StatusFx
		| Knockback
		| ConstructRing;

	let fx = $state<Fx[]>([]);
	let fxId = 0;
	let layerEl: HTMLDivElement;
	function spawn(e: Omit<Fx, 'id'>) {
		const id = fxId++;
		fx.push({ ...(e as Fx), id });
		setTimeout(() => (fx = fx.filter((f) => f.id !== id)), e.ttl);
	}
	function spawnBurst(p: Position, color: string, color2?: string) {
		spawn({ kind: 'burst', x: p.x, y: p.y, color, color2, ttl: 440 });
	}

	const SIZE_PX: Record<string, number> = { s: 10, m: 14, l: 20 };

	/**
	 * Render a strike from `from` → `to` in the given two colours. This is the
	 * ONE strike renderer — player hits and enemy hits both call it. It is purely
	 * cosmetic and RANGE-AGNOSTIC: the kind is read from `fx.strike`, never from
	 * distance. A melee swipe at range 7 shows a swipe; a projectile at range 1
	 * shows a projectile. Whatever you put on `fx`, this draws.
	 */
	function renderStrike(
		from: Position,
		to: Position,
		fx: FxSpec | null | undefined,
		head: string,
		tail: string
	) {
		const strike = fx?.strike;
		const rot = angleDeg(from, to);

		if (strike === 'projectile') {
			const fromX = cx(from), fromY = cy(from);
			const dx = cx(to) - fromX, dy = cy(to) - fromY;
			const dur = Math.min(360, Math.max(90, chebyshev(from, to) * (fx?.speed ?? 40)));
			spawn({
				kind: 'projectile', x: fromX, y: fromY, dx, dy,
				rot: (Math.atan2(dy, dx) * 180) / Math.PI, dur,
				shape: fx?.shape ?? 'bolt', size: fx?.size ?? 'm', trail: !!fx?.trail,
				color: head, color2: tail, tail, ttl: dur + 40
			});
			setTimeout(() => spawnBurst(to, head, tail), dur);
		} else if (strike === 'swipe' || strike === 'reverseswipe') {
			spawn({ kind: strike, x: to.x, y: to.y, rot, color: head, color2: tail, ttl: 240 });
			spawnBurst(to, head, tail);
		} else if (strike === 'claw') {
			const n = fx?.gashes ?? 3, spread = 48;
			const gashes = Array.from({ length: n }, (_, i) => ({
				a: n === 1 ? 0 : -spread / 2 + (spread / (n - 1)) * i, d: i * 55
			}));
			spawn({ kind: 'claw', x: cx(to), y: cy(to), rot, gashes, color: head, color2: tail, ttl: 460 });
			setTimeout(() => spawnBurst(to, head, tail), 120);
		} else if (strike === 'stab') {
			spawn({ kind: 'stab', x: cx(from), y: cy(from), rot, len: distPx(from, to) + 14, color: head, color2: tail, ttl: 320 });
			setTimeout(() => spawnBurst(to, head, tail), 135);
		} else if (strike === 'flurry') {
			const N = fx?.hits ?? 6;
			const ticks = Array.from({ length: N }, (_, i) => ({
				jx: (Math.random() - 0.5) * 16, jy: (Math.random() - 0.5) * 16,
				a: Math.random() * 90 - 45, delay: i * 68
			}));
			spawn({ kind: 'flurry', x: cx(to), y: cy(to), ticks, color: head, color2: tail, ttl: N * 68 + 260 });
			setTimeout(() => spawnBurst(to, head, tail), N * 68);
		} else if (strike === 'slam') {
			const debris = Array.from({ length: 7 }, (_, i) => {
				const ang = (i / 7) * Math.PI * 2 + Math.random(); const r = 26 + Math.random() * 14;
				return { ex: Math.cos(ang) * r, ey: -Math.abs(Math.sin(ang)) * r - 6 };
			});
			spawn({ kind: 'slam', x: cx(to), y: cy(to), debris, color: head, ttl: 820 });
			setTimeout(() => spawnBurst(to, head, tail), 255);
		} else if (strike === 'uppercut') {
			const sparks = Array.from({ length: 6 }, (_, i) => ({ ex: (Math.random() - 0.5) * 26, d: i * 45 }));
			spawn({ kind: 'uppercut', x: cx(to), y: cy(to), sparks, color: head, color2: tail, ttl: 760 });
			spawnBurst(to, head, tail);
		} else if (strike === 'bullet') {
			spawn({ kind: 'bullet', x: cx(from), y: cy(from), rot, len: distPx(from, to), color: head, color2: tail, ttl: 240 });
			setTimeout(() => spawnBurst(to, head, tail), 110);
		} else if (strike === 'beam') {
			spawn({ kind: 'beam', x: cx(from), y: cy(from), rot, len: distPx(from, to), color: head, color2: tail, ttl: 480 });
			setTimeout(() => spawnBurst(to, head, tail), 110);
			setTimeout(() => spawnBurst(to, head, tail), 280);
		} else if (strike === 'stream') {
			// Channel stream (Carla's Stream Buffer): a short pulsing beam per shot.
			// At ~4 shots/sec with ~220ms ttl it reads as a continuous stream.
			spawn({ kind: 'stream', x: cx(from), y: cy(from), rot, len: distPx(from, to), color: head, color2: tail, ttl: 220 });
			spawnBurst(to, head, tail);
		} else if (strike === 'chain') {
			const w = layerEl?.clientWidth ?? 600, h = layerEl?.clientHeight ?? 400;
			spawn({ kind: 'chain', d: jagged(cx(from), cy(from), cx(to), cy(to), 8, 11), w, h, color: head, color2: tail, ttl: 420 });
			setTimeout(() => spawnBurst(to, head, tail), 120);
		} else {
			// no strike specified → plain impact spark
			spawnBurst(to, head, tail);
		}
	}

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
				const [head, tail] = colorsFor(f, e.source);
				renderStrike(src?.pos ?? tgt.pos, tgt.pos, f, head, tail);
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
			subscribe('entity:dash', (e) => {
				// Gap-close leap (summon / enemy) — same dash-trail as the player, in
				// the entity's own ramp, a touch snappier.
				const ramp = rampOf(e.id);
				const path = lineTiles(e.from, e.to);
				const STEP = 36;
				spawn({
					kind: 'wave',
					ttl: path.length * STEP + 260,
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
			}),
			// ── Generic cast-time caster flash ──────────────────────────────────
			subscribe('ability:cast', (e) => {
				const caster = gs.party.find((p) => p.id === e.caster);
				if (!caster) return;
				const ramp = rampOf(e.caster);
				spawn({ kind: 'castflash', x: cx(caster.pos), y: cy(caster.pos), color: ramp[0], color2: ramp[1], ttl: 420 });
			}),
			// ── Shape-erupt telegraph (circle / line / wide_line / pcone) ───────
			subscribe('cast:shape', (e) => {
				const ramp = rampOf(e.caster);                 // [primary, secondary]
				const ox = cx(e.center), oy = cy(e.center);
				const dir = snapDir(e.facing);
				if (e.shape === 'circle') {
					const ct = circleTiles(e.radius ?? 1);
					const tiles = ct.map((t) => ({
						tx: t.tx, ty: t.ty, d: t.d,
						color: mix(ramp, t.maxRing > 0 ? t.ring / t.maxRing : 0)
					}));
					spawn({ kind: 'casttiles', cls: 'fx-cast-circle', x: ox, y: oy, ttl: 520, tiles });
					const diameter = ((e.radius ?? 1) * 2 + 1) * TILE;
					spawn({ kind: 'castaoe', x: ox, y: oy, d: diameter, color: ramp[0], color2: ramp[1], ttl: 420 });
				} else if (e.shape === 'pcone') {
					const ct = coneTiles(dir, e.range ?? 3);
					const maxR = ct.reduce((m, t) => Math.max(m, t.d), 0) || 1;
					const tiles = ct.map((t) => ({ ...t, color: mix(ramp, t.d / maxR) }));
					spawn({ kind: 'casttiles', cls: 'fx-cast-pcone', x: ox, y: oy, ttl: 700, tiles });
				} else {
					const lt = castLineTiles(dir, e.range ?? 4);
					const maxD = lt.reduce((m, t) => Math.max(m, t.d), 0) || 1;
					const tiles = lt.map((t) => ({ ...t, color: mix(ramp, t.d / maxD) }));
					spawn({ kind: 'casttiles', cls: 'fx-cast-line', x: ox, y: oy, ttl: 650, tiles });
				}
			}),
			// ── Status: stun (real event — stun is stunnedUntil, not an effect) ─
			subscribe('combat:stun', (e) => {
				const tgt = gs.enemies.find((en) => en.id === e.target) ?? gs.party.find((p) => p.id === e.target);
				if (!tgt) return;
				spawn({ kind: 'stun', x: cx(tgt.pos), y: cy(tgt.pos), color: '#ffe08a', color2: '#e8b84a', ttl: Math.max(800, e.durationMs) });
			}),
			subscribe('combat:knockback', (e) => {
				const tgt = gs.enemies.find((en) => en.id === e.target);
				const rot = (Math.atan2(e.fromPos.y - e.ownerPos.y, e.fromPos.x - e.ownerPos.x) * 180) / Math.PI;
				const px = tgt ? cx(tgt.pos) : cx(e.fromPos);
				const py = tgt ? cy(tgt.pos) : cy(e.fromPos);
				spawn({ kind: 'knockback', x: px, y: py, rot, color: '#ffffff', color2: '#cfd8ff', ttl: 360 });
			}),
			// ── June 9 team-heal bloom on each healed ally ──────────────────────
			subscribe('heal:applied', (e) => {
				const ally = gs.party.find((p) => p.id === e.target);
				if (!ally) return;
				const ramp = rampOf(e.source);
				const motes = [
					{ mx: -14, d: 0 }, { mx: -4, d: 130 }, { mx: 7, d: 70 },
					{ mx: 15, d: 200 }, { mx: 0, d: 260 }
				];
				spawn({ kind: 'teamheal', x: cx(ally.pos), y: cy(ally.pos), color: ramp[0] || '#5fc26a', color2: ramp[1], ttl: 600, motes });
			}),
			// ── Generic construct/summon spawn ──────────────────────────────────
			subscribe('construct:placed', (e) => {
				const pos = e.pos ?? gs.constructs?.find((k) => k.id === e.constructId)?.pos
					?? gs.party.find((p) => p.id === e.ownerId)?.pos;
				if (!pos) return;
				const ramp = rampOf(e.ownerId);
				spawn({ kind: 'constructspawn', x: cx(pos), y: cy(pos), color: ramp[0], color2: ramp[1], ttl: 460, tiles: constructTiles() });
			}),
			subscribe('summon:spawned', (e) => {
				const pos = e.pos ?? gs.summons?.find((k) => k.id === e.summonId)?.pos
					?? gs.party.find((p) => p.id === e.owner)?.pos;
				if (!pos) return;
				const ramp = rampOf(e.owner);
				spawn({ kind: 'constructspawn', x: cx(pos), y: cy(pos), color: ramp[0], color2: ramp[1], ttl: 460, tiles: constructTiles() });
			}),
			// ── Enemy strike: render the attack's fx, exactly like an ability strike.
			//    Purely cosmetic — fx.strike has NOTHING to do with atk.range. A melee
			//    swipe at range 7 shows a swipe; a projectile at range 1 shows a projectile.
			subscribe('enemy:strike', (e) => {
				const en = gs.enemies.find((x) => x.id === e.enemy);
				const tgt = gs.party.find((p) => p.id === e.target);
				if (!tgt || !en) return;
				const f = e.fx ?? null;
				const [head, tail] = colorsFor(f, en.id);
				renderStrike(en.pos, tgt.pos, f, head, tail);
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
				style="left:{f.x * TILE + 18}px;top:{f.y * TILE + 18}px;--c:{f.color};--c2:{f.color2 ?? f.color};"
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
				style="left:{f.x}px;top:{f.y}px;--dx:{f.dx}px;--dy:{f.dy}px;--rot:{f.rot}deg;--dur:{f.dur}ms;--c:{f.color};--c2:{f.color2 ?? f.tail ?? f.color};--t:{f.tail};--sz:{SIZE_PX[
					f.size
				] ?? 14}px;"
			>
				<span class="head"></span>
			</div>
		{:else if f.kind === 'swipe'}
			<div
				class="fx-swipe"
				style="left:{f.x * TILE + 18}px;top:{f.y * TILE + 18}px;--rot:{f.rot}deg;--c:{f.color};--c2:{f.color2 ?? f.color};"
			></div>
		{:else if f.kind === 'reverseswipe'}
			<div
				class="fx-reverseswipe"
				style="left:{f.x * TILE + 18}px;top:{f.y * TILE + 18}px;--rot:{f.rot}deg;--c:{f.color};--c2:{f.color2 ?? f.color};"
			></div>
		{:else if f.kind === 'claw'}
			<div class="fx-claw" style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;">
				{#each f.gashes as g}
					<div class="gash" style="--a:{g.a}deg;--d:{g.d}ms;--c:{f.color};--c2:{f.color2 ?? f.color};"></div>
				{/each}
			</div>
		{:else if f.kind === 'stab'}
			<div
				class="fx-stab"
				style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--len:{f.len}px;--c:{f.color};--c2:{f.color2 ?? f.color};"
			>
				<div class="spike"></div>
			</div>
		{:else if f.kind === 'flurry'}
			{#each f.ticks as t, i (i)}
				<div
					class="fx-tick"
					style="left:{f.x + t.jx}px;top:{f.y +
						t.jy}px;--a:{t.a}deg;--c:{f.color};--c2:{f.color2 ?? f.color};animation-delay:{t.delay}ms;"
				></div>
			{/each}
		{:else if f.kind === 'slam'}
			<div class="fx-slam" style="left:{f.x}px;top:{f.y}px;--c:{f.color};--c2:{f.color2 ?? f.color};">
				<div class="rock"></div>
				<div class="crater"></div>
				{#each f.debris as dbr, i (i)}
					<div class="debris" style="--ex:{dbr.ex}px;--ey:{dbr.ey}px;"></div>
				{/each}
			</div>
		{:else if f.kind === 'uppercut'}
			<div class="fx-upper" style="left:{f.x}px;top:{f.y}px;--c:{f.color};--c2:{f.color2 ?? f.color};">
				<div class="ring"></div>
				<div class="streak"></div>
				{#each f.sparks as s, i (i)}
					<div class="spark" style="--ex:{s.ex}px;--d:{s.d}ms;"></div>
				{/each}
			</div>
		{:else if f.kind === 'bullet'}
			<div class="fx-muzzle" style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--c:{f.color};--c2:{f.color2 ?? f.color};"></div>
			<div
				class="fx-tracer"
				style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--len:{f.len}px;--c:{f.color};--c2:{f.color2 ?? f.color};"
			></div>
		{:else if f.kind === 'beam'}
			<div class="fx-charge" style="left:{f.x}px;top:{f.y}px;--c:{f.color};--c2:{f.color2 ?? f.color};"></div>
			<div
				class="fx-beam"
				style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--len:{f.len}px;--c:{f.color};--c2:{f.color2 ?? f.color};"
			></div>
		{:else if f.kind === 'stream'}
			<div
				class="fx-stream"
				style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--len:{f.len}px;--c:{f.color};--c2:{f.color2 ?? f.color};"
			></div>
		{:else if f.kind === 'thread'}
			<div
				class="fx-thread"
				style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--len:{f.len}px;--c:{f.color};--c2:{f.color2 ?? f.color};"
			></div>
		{:else if f.kind === 'castflash'}
			<div class="fx-cast" style="left:{f.x}px;top:{f.y}px;--c:{f.color};--c2:{f.color2 ?? f.color};"></div>
		{:else if f.kind === 'castaoe'}
			<div class="fx-cast-aoe" style="left:{f.x}px;top:{f.y}px;--d:{f.d}px;--c:{f.color};--c2:{f.color2 ?? f.color};"></div>
		{:else if f.kind === 'casttiles'}
			<div class={f.cls} style="left:{f.x}px;top:{f.y}px;">
				{#each f.tiles as t, i (i)}
					<div class="fx-tile" style="transform:translate(calc(-50% + {t.tx}px),calc(-50% + {t.ty}px));--d:{t.d}ms;--c:{t.color};"></div>
				{/each}
			</div>
		{:else if f.kind === 'constructspawn'}
			<div class="fx-construct-spawn" style="left:{f.x}px;top:{f.y}px;--c:{f.color};--c2:{f.color2 ?? f.color};">
				{#each f.tiles as t, i (i)}
					<div class="ctile" style="--mx:{t.mx}px;--my:{t.my}px;--d:{t.d}ms;"></div>
				{/each}
				<div class="core"></div>
				<div class="settle"></div>
			</div>
		{:else if f.kind === 'teamheal'}
			<div class="fx-teamheal" style="left:{f.x}px;top:{f.y}px;--c:{f.color};--c2:{f.color2 ?? f.color};">
				{#each f.motes as m, i (i)}
					<div class="mote" style="--mx:{m.mx}px;--d:{m.d}ms;"></div>
				{/each}
			</div>
		{:else if f.kind === 'stun'}
			<div class="fx-stun" style="left:{f.x}px;top:{f.y}px;--c:{f.color};--c2:{f.color2 ?? f.color};"></div>
		{:else if f.kind === 'slow'}
			<div class="fx-slow" style="left:{f.x}px;top:{f.y}px;--c:{f.color};--c2:{f.color2 ?? f.color};"></div>
		{:else if f.kind === 'knockback'}
			<div class="fx-knockback" style="left:{f.x}px;top:{f.y}px;--rot:{f.rot}deg;--c:{f.color};--c2:{f.color2 ?? f.color};"></div>
		{:else if f.kind === 'chain'}
			<svg
				class="fx-chain"
				viewBox="0 0 {f.w} {f.h}"
				width={f.w}
				height={f.h}
				style="--c:{f.color};--c2:{f.color2 ?? f.color};"
			>
				<path d={f.d}></path>
				<path class="core" d={f.d}></path>
			</svg>
		{:else if f.kind === 'zoneburst'}
			{@const dd = (f.radius * 2 + 1) * TILE}
			<div
				class="fx-zoneburst"
				style="left:{f.x * TILE + 18}px;top:{f.y * TILE +
					18}px;width:{dd}px;height:{dd}px;margin:{-dd / 2}px 0 0 {-dd / 2}px;--c:{f.color};--c2:{f.color2 ?? f.color};"
			></div>
		{:else if f.kind === 'construct_ring'}
			{@const d = (f.radius * 2 + 1) * TILE}
			<div
				class="fx-construct-ring"
				class:catalyst={f.isCatalyst}
				style="left:{f.x}px;top:{f.y}px;width:{d}px;height:{d}px;margin:{-d / 2}px 0 0 {-d /
					2}px;--c:{f.color};--c2:{f.color2 ?? f.color};"
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
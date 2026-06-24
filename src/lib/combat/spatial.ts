import type { Position, Vector, Stratum, Terrain, Guard } from '$lib/types/common';
import type { Board, EngineState } from '$lib/types/state';
import { samePos, occupiedTiles, occupies, chebyshev, inBounds } from './board';

// Footprint helpers live in board.ts (to avoid an import cycle); surfaced here
// so the whole spatial vocabulary imports from one place.
export { occupiedTiles, occupies };

export function terrainAt(board: Board, pos: Position): Terrain {
	return board.water?.some((w) => samePos(w, pos)) ? 'water' : 'land';
}

const STRATUM_TERRAIN: Record<Stratum, Terrain[]> = {
	ground: ['land'],
	swimming: ['water'],
	flying: ['land', 'water'] // flying ignores terrain
};

/** Flying ignores terrain; everyone else must match unless `traversal` overrides. */
export function canEnter(
	stratum: Stratum,
	pos: Position,
	board: Board,
	traversal?: Terrain[]
): boolean {
	if (stratum === 'flying') return true;
	const allowed = traversal ?? STRATUM_TERRAIN[stratum];
	return allowed.includes(terrainAt(board, pos));
}

/** No `hits` declared → reaches every stratum. */
export function coversStratum(hits: Stratum[] | undefined, target: Stratum): boolean {
	if (!hits || hits.length === 0) return true;
	return hits.includes(target);
}

/** Is `attackerPos` outside the target's guarded arc (flank/backstab)? Scaffold — not yet wired to damage. */
export function isFlanked(
	targetPos: Position,
	facing: Vector,
	guard: Guard,
	attackerPos: Position
): boolean {
	if (guard === 'all') return false;
	const dx = Math.sign(attackerPos.x - targetPos.x);
	const dy = Math.sign(attackerPos.y - targetPos.y);
	return dx * facing.x + dy * facing.y < 0;
}
// ─── Gap-close (shared dash-to-target) ───────────────────────────────────────

/** isBlocked, but a tile occupied ONLY by `self` reads as free (the mover is
 *  vacating it), and constructs block landings too. */
function tileBlockedForLanding(
	state: EngineState,
	pos: Position,
	self: object
): boolean {
	if (state.board.obstacles.some((o) => samePos(o, pos))) return true;
	if (state.enemies.some((e) => e.hp > 0 && e !== self && occupies(e, pos))) return true;
	const active = state.party[state.activeSlot];
	if (active && active !== self && occupies(active, pos)) return true;
	if (state.summons.some((s) => s !== self && occupies(s, pos))) return true;
	if (state.constructs.some((c) => samePos(c.pos, pos))) return true;
	return false;
}

/**
 * Gap-close landing tile. A `mover` that wants to attack `targetPos` from within
 * `attackRange` leaps to the passable, unoccupied tile in that range band nearest
 * to it. Returns null when the mover is already in range (no dash) or no tile is
 * free (the dash fizzles — caller should fall through / skip).
 *
 * Shared by summons (dash to their enemy target) and enemies (dash to the
 * player/summon). The mover is excluded from occupancy so it can't block itself.
 */
export function gapCloseLanding(
	state: EngineState,
	mover: { pos: Position; stratum: Stratum; def?: { traversal?: Terrain[] } },
	targetPos: Position,
	attackRange: number
): Position | null {
	if (chebyshev(mover.pos, targetPos) <= attackRange) return null; // already in range

	const r = Math.max(1, attackRange);
	let best: Position | null = null;
	let bestDist = Infinity;

	for (let dy = -r; dy <= r; dy++) {
		for (let dx = -r; dx <= r; dx++) {
			if (dx === 0 && dy === 0) continue;                 // not on the target
			const t = { x: targetPos.x + dx, y: targetPos.y + dy };
			if (chebyshev(t, targetPos) > attackRange) continue; // inside the range band
			if (!inBounds(state.board, t)) continue;
			if (!canEnter(mover.stratum, t, state.board, mover.def?.traversal)) continue;
			if (tileBlockedForLanding(state, t, mover)) continue;
			const d = chebyshev(mover.pos, t);
			if (d < bestDist) { bestDist = d; best = t; }
		}
	}
	return best;
}

// ─── Juggernaut (multi-tile mover collision) ─────────────────────────────────

/**
 * Can a multi-tile mover step to `newPos`?
 * Checks every footprint cell at the new position for:
 *   – in bounds
 *   – passable terrain
 *   – no obstacles
 *   – no constructs
 * Ignores units — the juggernaut shoves through them.
 */
export function canJuggernautStep(
	state: EngineState,
	footprint: Position[],
	newPos: Position,
	stratum: Stratum,
	traversal?: Terrain[]
): boolean {
	const offsets = footprint.length > 0 ? footprint : [{ x: 0, y: 0 }];
	for (const o of offsets) {
		const t = { x: newPos.x + o.x, y: newPos.y + o.y };
		if (!inBounds(state.board, t)) return false;
		if (!canEnter(stratum, t, state.board, traversal)) return false;
		if (state.board.obstacles.some((ob) => samePos(ob, t))) return false;
		if (state.constructs.some((c) => occupies(c, t))) return false;
	}
	return true;
}

/**
 * Shove any single-tile unit off the tiles a juggernaut is about to occupy.
 * Each displaced unit lands on the nearest free tile (not in the juggernaut's
 * new footprint, not blocked). Call BEFORE assigning the mover's new pos.
 */
export function juggerShove(
	state: EngineState,
	moverId: string,
	newTiles: Position[],
	publish: (evt: string, data: unknown) => void
): void {
	const isNew = (p: Position) => newTiles.some((t) => samePos(t, p));

	// Collect displaced units — enemies, player, other summons
	const displaced: { entity: { id: string; pos: Position }; kind: string }[] = [];
	for (const e of state.enemies) {
		if (e.hp > 0 && e.id !== moverId && isNew(e.pos)) displaced.push({ entity: e, kind: 'enemy' });
	}
	for (const p of state.party) {
		if (p.id !== moverId && isNew(p.pos)) displaced.push({ entity: p, kind: 'player' });
	}
	for (const s of state.summons) {
		if (s.id !== moverId && isNew(s.pos)) displaced.push({ entity: s, kind: 'summon' });
	}

	for (const { entity, kind } of displaced) {
		const landing = nearestShoveTarget(state, entity.pos, newTiles, moverId);
		if (landing) {
			const from = { ...entity.pos };
			entity.pos = landing;
			if (kind === 'enemy') {
				publish('movement:enemy', { enemyId: entity.id, from, to: landing });
			} else if (kind === 'player') {
				publish('movement:player', { characterId: entity.id, from, to: landing });
			}
		}
	}
}

/** Nearest passable tile not in `exclude` and not blocked. Ring-search outward. */
function nearestShoveTarget(
	state: EngineState,
	from: Position,
	exclude: Position[],
	moverId: string
): Position | null {
	const isExcluded = (p: Position) => exclude.some((e) => samePos(e, p));
	for (let r = 1; r <= 4; r++) {
		let best: Position | null = null;
		let bestDist = Infinity;
		for (let dy = -r; dy <= r; dy++) {
			for (let dx = -r; dx <= r; dx++) {
				if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring only
				const t = { x: from.x + dx, y: from.y + dy };
				if (!inBounds(state.board, t)) continue;
				if (state.board.obstacles.some((o) => samePos(o, t))) continue;
				if (state.constructs.some((c) => occupies(c, t))) continue;
				if (isExcluded(t)) continue;
				// Don't land on another entity (except the mover, who's vacating)
				if (state.enemies.some((e) => e.hp > 0 && e.id !== moverId && samePos(e.pos, t))) continue;
				if (state.party.some((p) => p.id !== moverId && samePos(p.pos, t))) continue;
				if (state.summons.some((s) => s.id !== moverId && samePos(s.pos, t))) continue;
				const d = chebyshev(from, t);
				if (d < bestDist) { bestDist = d; best = t; }
			}
		}
		if (best) return best;
	}
	return null;
}

// ─── Spawn-shove (push enemies when a creation lands on them) ────────────────

/**
 * Push same-stratum enemies off a set of tiles (used at construct/summon spawn).
 * Only displaces enemies — the player chose to cast there, summons are friendly.
 */
export function shoveEnemiesOff(
	state: EngineState,
	tiles: Position[],
	stratum: Stratum,
	publish: (evt: string, data: unknown) => void
): void {
	const onTile = (p: Position) => tiles.some((t) => samePos(t, p));
	for (const enemy of state.enemies) {
		if (enemy.hp <= 0 || enemy.stratum !== stratum || !onTile(enemy.pos)) continue;
		const landing = nearestShoveTarget(state, enemy.pos, tiles, '');
		if (landing) {
			const from = { ...enemy.pos };
			enemy.pos = landing;
			publish('movement:enemy', { enemyId: enemy.id, from, to: landing });
		}
	}
}
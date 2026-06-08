import type { Position, Vector, Stratum, Terrain, Guard } from '$lib/types/common';
import type { Board } from '$lib/types/state';
import { samePos, occupiedTiles, occupies } from './board';

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
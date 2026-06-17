import type { Position, Vector } from '$lib/types/common';
import type { Board, EngineState } from '$lib/types/state';

// ─── Distance ────────────────────────────────────────────────────────────────

/** Chebyshev (king-move) distance. Used for range checks everywhere. */
export function chebyshev(a: Position, b: Position): number {
	return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Manhattan distance. Useful for some pathfinding heuristics. */
export function manhattan(a: Position, b: Position): number {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function samePos(a: Position, b: Position): boolean {
	return a.x === b.x && a.y === b.y;
}

// ─── Board bounds ────────────────────────────────────────────────────────────

export function inBounds(board: Board, p: Position): boolean {
	return p.x >= 0 && p.x < board.size.width && p.y >= 0 && p.y < board.size.height;
}

export function clamp(board: Board, p: Position): Position {
	return {
		x: Math.max(0, Math.min(board.size.width - 1, p.x)),
		y: Math.max(0, Math.min(board.size.height - 1, p.y))
	};
}

// ─── Obstacle / blockedness (Data Contract §14) ─────────────────────────────
// ─── Footprint / occupancy (multi-tile scaffold) ─────────────────────────────

interface HasFootprint {
	pos: Position;
	def?: { footprint?: Position[] };
}

/** Tiles an entity occupies. 1×1 today; a real footprint makes it multi-tile. */
export function occupiedTiles(entity: HasFootprint): Position[] {
	const fp = entity.def?.footprint;
	if (!fp || fp.length === 0) return [entity.pos];
	return fp.map((o) => ({ x: entity.pos.x + o.x, y: entity.pos.y + o.y }));
}

/** Does any tile of `entity` sit on `pos`? */
export function occupies(entity: HasFootprint, pos: Position): boolean {
	return occupiedTiles(entity).some((t) => samePos(t, pos));
}

export function isBlocked(state: EngineState, pos: Position): boolean {
	if (state.board.obstacles.some((o) => samePos(o, pos))) return true;
	if (state.enemies.some((e) => e.hp > 0 && occupies(e, pos))) return true;
	const active = state.party[state.activeSlot];
	if (active && occupies(active, pos)) return true;
	if (state.summons.some((s) => occupies(s, pos))) return true;
	return false;
}

/** Check if a tile is blocked by obstacles only (ignoring entities). */
export function isObstacle(board: Board, pos: Position): boolean {
	return board.obstacles.some((o) => samePos(o, pos));
}

// ─── Stepping / movement ─────────────────────────────────────────────────────

/**
 * 4-directional step toward target, alternating axes on diagonal approach.
 * Used by enemies with canMoveDiagonal: false.
 */
let axisFlip = false;
export function step4Toward(from: Position, to: Position): Position {
	const dx = Math.sign(to.x - from.x);
	const dy = Math.sign(to.y - from.y);
	if (dx === 0 && dy === 0) return from;
	if (dx === 0) return { x: from.x, y: from.y + dy };
	if (dy === 0) return { x: from.x + dx, y: from.y };
	axisFlip = !axisFlip;
	return axisFlip ? { x: from.x + dx, y: from.y } : { x: from.x, y: from.y + dy };
}

/** 8-directional step toward target. */
export function step8Toward(from: Position, to: Position): Position {
	return {
		x: from.x + Math.sign(to.x - from.x),
		y: from.y + Math.sign(to.y - from.y)
	};
}

/** 8-directional step away from target. */
export function step8Away(from: Position, to: Position): Position {
	return {
		x: from.x - Math.sign(to.x - from.x),
		y: from.y - Math.sign(to.y - from.y)
	};
}

/** Snap a position offset to one of 8 normalized direction vectors. */
export function aimToward(from: Position, to: Position): Vector | null {
	const dx = Math.sign(to.x - from.x);
	const dy = Math.sign(to.y - from.y);
	if (dx === 0 && dy === 0) return null;
	return { x: dx, y: dy };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createBoard(
	width: number,
	height: number,
	obstacles: Position[] = []
): Board {
	return { size: { width, height }, obstacles };
}

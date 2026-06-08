import type { Position, Vector } from '$lib/types/common';

/**
 * 1-tile-wide line of `range` tiles from caster in direction.
 * Diagonal lines reach the same Chebyshev distance as cardinal.
 */
export function lineFrom(from: Position, dir: Vector, range: number): Position[] {
	const tiles: Position[] = [];
	for (let i = 1; i <= range; i++) {
		tiles.push({ x: from.x + dir.x * i, y: from.y + dir.y * i });
	}
	return tiles;
}

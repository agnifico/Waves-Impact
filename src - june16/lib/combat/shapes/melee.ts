import type { Position } from '$lib/types/common';

/**
 * Returns all tiles within Chebyshev range of the origin.
 * For melee (range 1), this is the 8 surrounding tiles.
 * The caster's own tile is excluded.
 */
export function meleeFrom(from: Position, range: number = 1): Position[] {
	const tiles: Position[] = [];
	for (let dx = -range; dx <= range; dx++) {
		for (let dy = -range; dy <= range; dy++) {
			if (dx === 0 && dy === 0) continue;
			tiles.push({ x: from.x + dx, y: from.y + dy });
		}
	}
	return tiles;
}

import type { Position } from '$lib/types/common';

/**
 * Filled Chebyshev disk of `radius` centered on a target point.
 * A radius-1 circle covers 9 tiles (3×3). Radius-2 covers 25 (5×5).
 */
export function circleAt(center: Position, radius: number): Position[] {
	const tiles: Position[] = [];
	for (let dx = -radius; dx <= radius; dx++) {
		for (let dy = -radius; dy <= radius; dy++) {
			tiles.push({ x: center.x + dx, y: center.y + dy });
		}
	}
	return tiles;
}

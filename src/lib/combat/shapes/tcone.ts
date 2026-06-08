import type { Position, Vector } from '$lib/types/common';

/**
 * T-shaped cleave: stem of length range−1 in direction,
 * then a 3-wide crossbar perpendicular at the far end.
 * At range=2: 1 stem tile + 3 crossbar tiles = 4 tiles total.
 */
export function tconeFrom(from: Position, dir: Vector, range: number): Position[] {
	const tiles: Position[] = [];
	const perp: Vector = { x: -dir.y, y: dir.x };

	// Stem tiles (all rows before the far end)
	for (let i = 1; i < range; i++) {
		tiles.push({ x: from.x + dir.x * i, y: from.y + dir.y * i });
	}

	// Far-end crossbar: 3 tiles perpendicular
	const farEnd: Position = { x: from.x + dir.x * range, y: from.y + dir.y * range };
	tiles.push({ x: farEnd.x - perp.x, y: farEnd.y - perp.y });
	tiles.push(farEnd);
	tiles.push({ x: farEnd.x + perp.x, y: farEnd.y + perp.y });

	return tiles;
}

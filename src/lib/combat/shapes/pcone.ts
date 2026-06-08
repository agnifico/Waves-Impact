import type { Position, Vector } from '$lib/types/common';

/**
 * Forward cone, anisotropic by necessity in 8-dir space:
 * - Cardinal facing → Pascal fan: row N is 2N−1 wide (1, 3, 5, …), a triangle.
 * - Diagonal facing → filled square quadrant of side `range`, bounded by the
 *   two cardinal axes flanking the diagonal.
 * Caster tile is excluded in both cases.
 */
export function pconeFrom(from: Position, dir: Vector, range: number): Position[] {
	const tiles: Position[] = [];

	// Diagonal: filled quadrant
	if (dir.x !== 0 && dir.y !== 0) {
		for (let i = 0; i <= range; i++) {
			for (let j = 0; j <= range; j++) {
				if (i === 0 && j === 0) continue; // skip caster
				tiles.push({ x: from.x + dir.x * i, y: from.y + dir.y * j });
			}
		}
		return tiles;
	}

	// Cardinal: Pascal fan (unchanged)
	const perp: Vector = { x: -dir.y, y: dir.x };
	for (let i = 1; i <= range; i++) {
		const center: Position = { x: from.x + dir.x * i, y: from.y + dir.y * i };
		const hw = i - 1;
		for (let w = -hw; w <= hw; w++) {
			tiles.push({ x: center.x + perp.x * w, y: center.y + perp.y * w });
		}
	}
	return tiles;
}
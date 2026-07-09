import type { Position, Vector } from '$lib/types/common';
import type { ShapeParams } from '$lib/types/ability';

/**
 * Wide-line / rectangle in front of the caster.
 *
 * Cardinal facing: a proper W×range rectangle centered on the facing axis.
 *   perp = 90° CCW rotation of dir; k = −hw..+hw tiles along perp.
 *
 * Diagonal facing: 3 (or 5, …) tiles per depth, no holes.
 *   At depth d the center tile is (d·dx, d·dy); the hw "side" tiles step
 *   back one unit along dx (−dx, 0) and one unit along dy (0, −dy) per k.
 *   For hw=1 (width=3) this gives exactly the 3 corner tiles that share a
 *   face with the diagonal — no gaps, no cheese.
 *
 * params.width  : tiles wide (default 3)
 * params.range  : tiles deep (default 4)
 */
export function wideLineFrom(from: Position, dir: Vector, params: ShapeParams): Position[] {
	const range = params.range ?? 4;
	const width = params.width ?? 3;
	const hw = Math.floor(width / 2);
	const tiles: Position[] = [];

	if (dir.x === 0 || dir.y === 0) {
		// Cardinal: symmetric rectangle via 90° CCW perp
		const px = -dir.y;
		const py = dir.x;
		for (let d = 1; d <= range; d++) {
			for (let k = -hw; k <= hw; k++) {
				tiles.push({
					x: from.x + dir.x * d + px * k,
					y: from.y + dir.y * d + py * k
				});
			}
		}
	} else {
		// Diagonal: step back along each axis — produces connected L-corner bands
		// e.g. for {1,-1} at d=1: center (1,-1), sideX (0,-1), sideY (1,0) — no holes
		for (let d = 1; d <= range; d++) {
			const cx = from.x + dir.x * d;
			const cy = from.y + dir.y * d;
			tiles.push({ x: cx, y: cy });
			for (let k = 1; k <= hw; k++) {
				tiles.push({ x: cx - dir.x * k, y: cy });  // step back along x-axis
				tiles.push({ x: cx, y: cy - dir.y * k });  // step back along y-axis
			}
		}
	}

	return tiles;
}

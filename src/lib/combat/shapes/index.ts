import type { Position, Vector } from '$lib/types/common';
import type { Board } from '$lib/types/state';
import { inBounds, clamp } from '../board';
import { lineFrom } from './line';
import { pconeFrom } from './pcone';
import { tconeFrom } from './tcone';
import { circleAt } from './circle';
import { meleeFrom } from './melee';
import { wideLineFrom } from './wide_line';
import type { ShapeParams } from '$lib/types/ability';


/** Signature every shape function conforms to. */
export type ShapeFn = (
	from: Position,
	dir: Vector,
	params: ShapeParams,
	targetPoint?: Position
) => Position[];

/**
 * Shape registry. Maps ShapeId → geometry function.
 * Adding a new shape: write the geometry file, add one entry here.
 */
const registry: Record<string, ShapeFn> = {
	line: (from, dir, params) => lineFrom(from, dir, params.range ?? 1),

	pcone: (from, dir, params) => pconeFrom(from, dir, params.range ?? 1),

	tcone: (from, dir, params) => tconeFrom(from, dir, params.range ?? 1),

	circle: (_from, _dir, params, targetPoint) =>
		circleAt(targetPoint ?? _from, params.radius ?? 1),

	melee: (from, _dir, params) => meleeFrom(from, params.range ?? 1),

	wide_line: wideLineFrom
};

/**
 * Resolve tiles for a shape, clamped and filtered to board bounds.
 *
 * ```ts
 * const tiles = resolveTiles('pcone', caster.pos, caster.facing, { range: 5 }, board);
 * ```
 */
export function resolveTiles(
	shapeId: string,
	from: Position,
	dir: Vector,
	params: ShapeParams,
	board: Board,
	targetPoint?: Position
): Position[] {
	const fn = registry[shapeId];
	if (!fn) {
		console.warn(`[shapes] Unknown shape: ${shapeId}`);
		return [];
	}

	return fn(from, dir, params, targetPoint)
		.map((p) => clamp(board, p))
		.filter((p) => inBounds(board, p));
}

/** Register a new shape at runtime (for modding / testing). */
export function registerShape(id: string, fn: ShapeFn): void {
	registry[id] = fn;
}

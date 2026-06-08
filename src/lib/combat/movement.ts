import type { EngineState, CharacterState } from '$lib/types/state';
import { clamp, samePos, step8Toward, step8Away } from './board';

type Vec = { x: number; y: number };

/**
 * Shared movement primitive (Combat Roadmap §3-B).
 *
 * One walker that every dash / leap / reposition routes through. It steps tile
 * by tile in a direction, honouring board edges, obstacles, and (optionally) a
 * terrain predicate — unless told to pass through. Consumers: Sefyra's C
 * (forward, through-obstacles), Yara's dashBack (back), Amber's BA forward/back,
 * the ranged-omni "step forward every basic", etc. Adding a consumer = pass a spec.
 */

export type DashDir = 'forward' | 'back' | 'toward' | 'away';

export interface WalkSpec {
	/** Max tiles to travel. */
	tiles: number;
	/** Direction mode. forward/back use `aim`; toward/away use `anchor`. */
	dir: DashDir;
	/** Travel direction for forward/back (any vector; reduced to one of 8 steps). */
	aim?: Vec;
	/** Anchor point for toward/away (e.g. an enemy's pos). */
	anchor?: Vec;
	/**
	 * Teleport-style: pass over blocked tiles, land on the furthest valid one.
	 * Default false = stop in front of the first blocked tile (Data Contract §14).
	 */
	throughObstacles?: boolean;
	/** Override the blocked test (default: obstacles + entities, ignoring the caster). */
	blockedBy?: (state: EngineState, pos: Vec) => boolean;
	/**
	 * Reserved. i-frames belong here (§3-B) but applying invulnerability needs the
	 * status engine (Roadmap §2). Typed now so consumers can declare it; no-op until then.
	 */
	iframesMs?: number;
}

export interface WalkResult {
	from: Vec;
	/** Final tile the caster ends on. */
	to: Vec;
	/** Tiles travelled across, in order (excludes start; includes passed-over tiles). */
	path: Vec[];
	/**
	 * Full intended line of tiles, clamped to the board (excludes start). Use this
	 * for "first enemy in the dash line" hit-scans — it includes tiles passed over.
	 */
	trajectory: Vec[];
}

/** Reduce any vector to one of the 8 grid steps (or {0,0}). */
function unit8(v: Vec): Vec {
	return { x: Math.sign(v.x), y: Math.sign(v.y) };
}

/**
 * A tile is blocked if it holds an obstacle, a living enemy, a living summon, or
 * the active character — or is off the board (Data Contract §14). The caster's own
 * tile is excluded via `ignoreId`.
 */
export function isBlocked(
	state: EngineState,
	pos: Vec,
	opts: { ignoreId?: string } = {}
): boolean {
	const { width, height } = state.board.size;
	if (pos.x < 0 || pos.y < 0 || pos.x >= width || pos.y >= height) return true;
	for (const o of state.board.obstacles) if (samePos(o, pos)) return true;
	for (const e of state.enemies)
		if (e.hp > 0 && e.id !== opts.ignoreId && samePos(e.pos, pos)) return true;
	for (const s of state.summons)
		if ((s.hp === undefined || s.hp > 0) && s.id !== opts.ignoreId && samePos(s.pos, pos))
			return true;
	const active = state.party[state.activeSlot];
	if (active && active.id !== opts.ignoreId && samePos(active.pos, pos)) return true;
	return false;
}

/**
 * Walk the caster up to `spec.tiles` steps. Mutates `caster.pos` to the landing
 * tile and returns the path + trajectory for the behavior to resolve hits against.
 */
export function walk(state: EngineState, caster: CharacterState, spec: WalkSpec): WalkResult {
	const from: Vec = { ...caster.pos };
	const blocked = spec.blockedBy ?? ((s, q) => isBlocked(s, q, { ignoreId: caster.id }));

	const trajectory: Vec[] = [];
	const path: Vec[] = [];
	let p: Vec = { ...caster.pos };
	let landing: Vec = { ...caster.pos };

	const u = unit8(spec.aim ?? { x: 0, y: 0 });
	const fwd = spec.dir === 'back' ? { x: -u.x, y: -u.y } : u;

	for (let i = 0; i < spec.tiles; i++) {
		let next: Vec;
		if (spec.dir === 'forward' || spec.dir === 'back') {
			if (fwd.x === 0 && fwd.y === 0) break; // no aim → no movement
			next = clamp(state.board, { x: p.x + fwd.x, y: p.y + fwd.y });
		} else {
			if (!spec.anchor) break;
			next = clamp(
				state.board,
				spec.dir === 'away' ? step8Away(p, spec.anchor) : step8Toward(p, spec.anchor)
			);
		}
		if (samePos(next, p)) break; // hit a board edge

		trajectory.push({ ...next });
		const blk = blocked(state, next);
		if (!spec.throughObstacles) {
			if (blk) break; // stop in front of it
			p = next;
			landing = { ...next };
			path.push({ ...next });
		} else {
			p = next; // pass over
			if (!blk) landing = { ...next }; // only ever land on a valid tile
			path.push({ ...next });
		}
	}

	caster.pos = landing;
	return { from, to: landing, path, trajectory };
}
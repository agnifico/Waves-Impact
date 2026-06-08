import type { Position } from '$lib/types/common';
import type { EngineState, CharacterState, EnemyState } from '$lib/types/state';
import { chebyshev } from './board';

/** An entity that can be returned by a query. */
export type QueryEntity = (CharacterState | EnemyState) & { pos: Position };

/** Predicate function for filtering query results. */
export type Predicate = (entity: QueryEntity) => boolean;

/** Sort key for ordering query results. */
export type SortKey = 'distance' | 'hp_asc' | 'hp_desc' | 'random';

/**
 * Query criteria. (Data Contract §13)
 *
 * ```ts
 * // Nearest enemy within 5 tiles:
 * query(state, { side: 'enemy', sort: 'distance', origin: caster.pos, within: 5, take: 1 })
 *
 * // All allies below 50% HP:
 * query(state, { side: 'ally', filter: [e => e.hp < e.def.maxHp * 0.5], take: 'all' })
 * ```
 */
export interface QueryCriteria {
	side: 'enemy' | 'ally' | 'self' | 'any';
	filter?: Predicate[];
	sort?: SortKey;
	origin?: Position;
	within?: number;
	take?: number | 'all';
}

/**
 * Query for entities matching criteria.
 */
export function query(state: EngineState, criteria: QueryCriteria): QueryEntity[] {
	let pool = getCandidatePool(state, criteria.side);

	// Filter: remove dead enemies
	pool = pool.filter((e) => e.hp > 0);

	// Apply distance filter
	if (criteria.within !== undefined && criteria.origin) {
		const origin = criteria.origin;
		const maxDist = criteria.within;
		pool = pool.filter((e) => chebyshev(e.pos, origin) <= maxDist);
	}

	// Apply custom predicates
	if (criteria.filter) {
		for (const pred of criteria.filter) {
			pool = pool.filter(pred);
		}
	}

	// Sort
	if (criteria.sort && criteria.origin) {
		const origin = criteria.origin;
		switch (criteria.sort) {
			case 'distance':
				pool.sort((a, b) => chebyshev(a.pos, origin) - chebyshev(b.pos, origin));
				break;
			case 'hp_asc':
				pool.sort((a, b) => a.hp - b.hp);
				break;
			case 'hp_desc':
				pool.sort((a, b) => b.hp - a.hp);
				break;
			case 'random':
				pool.sort(() => Math.random() - 0.5);
				break;
		}
	}

	// Take
	if (criteria.take === 'all' || criteria.take === undefined) {
		return pool;
	}
	return pool.slice(0, criteria.take);
}

/** Convenience: nearest enemy to a position. */
export function nearestEnemy(
	state: EngineState,
	origin: Position,
	maxRange?: number
): EnemyState | null {
	const results = query(state, {
		side: 'enemy',
		sort: 'distance',
		origin,
		within: maxRange,
		take: 1
	});
	return (results[0] as EnemyState) ?? null;
}

export function focusTarget(state: EngineState, origin: Position): EnemyState | null {
	if (state.focusTargetId) {
		const locked = state.enemies.find((e) => e.id === state.focusTargetId && e.hp > 0);
		if (locked) return locked;
	}
	return nearestEnemy(state, origin);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function getCandidatePool(state: EngineState, side: QueryCriteria['side']): QueryEntity[] {
	switch (side) {
		case 'enemy':
			return [...state.enemies];
		case 'ally':
			return [...state.party];
		case 'self':
			return [state.party[state.activeSlot]];
		case 'any':
			return [...state.party, ...state.enemies];
	}
}

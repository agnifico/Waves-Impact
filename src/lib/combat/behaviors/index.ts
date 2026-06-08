import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';

import * as damageAoe from './damage-aoe';
import * as damageFirstInLine from './damage-first-in-line';
import * as summon from './summon';
import * as dash from './dash';
import * as zone from './zone';
import * as cloudpiercer from './cloudpiercer';
import * as construct from './construct';

/** Generic resolve signature every behavior handler must implement. */
export type BehaviorResolveFn = (
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number,
	opts?: Record<string, unknown>
) => boolean;

/**
 * Behavior registry. Maps BehaviorId → resolve function.
 * Adding a new behavior: write the handler file, add one entry here.
 */
const registry: Record<string, BehaviorResolveFn> = {
	damage_aoe: damageAoe.resolve as BehaviorResolveFn,
	damage_first_in_line: damageFirstInLine.resolve as BehaviorResolveFn,
	summon: summon.resolve as BehaviorResolveFn,
	construct: construct.resolve as BehaviorResolveFn,   // ← NEW
	dash: dash.resolve as BehaviorResolveFn,
	zone: zone.resolve as BehaviorResolveFn,
	cloudpiercer: cloudpiercer.resolve as BehaviorResolveFn,
};

/**
 * Resolve an ability by dispatching to its behavior handler.
 * Returns false if the behavior is unknown or the handler rejects the cast.
 */
export function resolveBehavior(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number,
	opts: Record<string, unknown> = {}
): boolean {
	const fn = registry[ability.behavior];
	if (!fn) {
		console.warn(`[behaviors] Unknown behavior: ${ability.behavior}`);
		return false;
	}
	return fn(state, caster, ability, now, opts);
}

/** Register a new behavior at runtime (for modding / testing). */
export function registerBehavior(id: string, fn: BehaviorResolveFn): void {
	registry[id] = fn;
}

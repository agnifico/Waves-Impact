import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { publish } from '../events';

/**
 * zone: create a persistent ground field centered on caster.
 * The zone ticks periodically (handled by zoneTick in the engine). (Data Contract §6)
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number
): boolean {
	if (!ability.zoneBuff) return false;

	const zoneId = `${ability.id}-${now}`;

	state.zones.push({
		id: zoneId,
		center: { ...caster.pos },
		follows: ability.zoneFollows ?? 'fixed',
		ownerId: caster.id,
		radius: ability.shapeParams?.radius ?? 2,
		expiresAt: now + (ability.durationMs ?? 8000),
		lastTickAt: now,
		buff: ability.zoneBuff
	});

	publish('zone:created', { zoneId, ownerId: caster.id });
	return true;
}

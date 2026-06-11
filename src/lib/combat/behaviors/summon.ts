import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { step8Toward, samePos, clamp } from '../board';
import { nearestEnemy } from '../query';
import { publish } from '../events';
import { getSummonDef } from '$lib/data/registry';

/**
 * summon: spawn a summon entity adjacent to caster, biased toward
 * nearest enemy. (Data Contract §6)
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number
): boolean {
	const summonId = ability.summonId;
	if (!summonId) return false;

	// Only one summon of the same type at a time
	if (state.summons.some((s) => s.defId === summonId)) {
		return false;
	}

	// Place adjacent to caster, biased toward nearest enemy
	const enemy = nearestEnemy(state, caster.pos);
	let pos: { x: number; y: number };

	if (enemy) {
		pos = clamp(state.board, step8Toward(caster.pos, enemy.pos));
		// Don't overlap with enemy
		if (samePos(pos, enemy.pos)) {
			pos = clamp(state.board, { x: caster.pos.x, y: caster.pos.y - 1 });
		}
	} else {
		pos = clamp(state.board, { x: caster.pos.x, y: caster.pos.y - 1 });
	}

	const def = getSummonDef(summonId);
	state.summons.push({
		id: `${summonId}-${now}`,
		defId: summonId,
		ownerId: caster.id,
		pos,
		profileImage: ability.summonImage,
		expiresAt: now + (ability.summonDurationMs ?? 10000),
		nextMoveAt: now + (def?.moveCooldownMs ?? 500),
		nextAttackAt: now + (def?.attackCooldownMs ?? 1000)
	});

	publish('summon:spawned', { summonId, owner: caster.id });
	return true;
}

import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { chebyshev } from '../board';
import { calculateDamage } from '../pipeline';
import { coversStratum } from '../spatial';
import { publish } from '../events';

/**
 * zone: create a persistent field. Single-instance per caster+ability (recast refreshes,
 * never stacks). Optionally deals a one-time burst to enemies in range on cast. (§6)
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number
): boolean {
	if (!ability.zoneBuff) return false;

	const radius = ability.shapeParams?.radius ?? 2;
	const prefix = `${ability.id}-`;
	state.zones = state.zones.filter((z) => !(z.ownerId === caster.id && z.id.startsWith(prefix)));

	const zoneId = `${ability.id}-${now}`;
	state.zones.push({
		id: zoneId,
		center: { ...caster.pos },
		follows: ability.zoneFollows ?? 'fixed',
		ownerId: caster.id,
		radius,
		expiresAt: now + (ability.durationMs ?? 8000),
		lastTickAt: now,
		buff: ability.zoneBuff
	});
	publish('zone:created', { zoneId, ownerId: caster.id });

	// One-time cast burst — enemies within radius of the caster (Maria's 50 on cast).
	if (ability.damage && ability.damage > 0) {
		for (const enemy of state.enemies) {
			if (enemy.hp <= 0) continue;
			if (chebyshev(enemy.pos, caster.pos) > radius) continue;
			if (!coversStratum(ability.hits, enemy.stratum)) continue;
			const dmg = calculateDamage(ability.damage, {
				source: caster, target: enemy, ability, element: caster.def.element, state
			});
			enemy.hp = Math.max(0, enemy.hp - dmg);
			publish('damage:dealt', {
				source: caster.id, target: enemy.id, amount: dmg,
				abilityName: ability.name, element: caster.def.element
			});
			if (enemy.hp <= 0) publish('enemy:defeated', { enemyId: enemy.id, killer: caster.id });
		}
	}
	return true;
}
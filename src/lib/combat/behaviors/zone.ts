import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { chebyshev } from '../board';
import { applyDelivery, applyOnHit, canHitStratum, type ResolveSource } from '../resolve';
import { publish } from '../events';

/**
 * zone: create a persistent field. Single-instance per caster+ability (recast
 * refreshes, never stacks). Optionally deals a one-time burst to enemies in range
 * on cast — that burst now flows through the unified resolver (applyOnHit), so a
 * zone's cast burst can splash, stun, lifesteal, etc. like any other hit. (§6)
 *
 * Aimed placement: opts.reticle (set by holdBehavior 'aim') overrides the center,
 * letting the zone spawn away from the caster (Sefyra's vortex).
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number,
	opts: Record<string, unknown> = {}
): boolean {
	if (!ability.zoneBuff) return false;

	const radius = ability.delivery?.shapeParams?.radius ?? 2;
	const prefix = `${ability.id}-`;
	state.zones = state.zones.filter((z) => !(z.ownerId === caster.id && z.id.startsWith(prefix)));

	// Center: aimed reticle → caster pos
	const reticle = opts.reticle as { x: number; y: number } | null | undefined;
	const center = reticle ? { ...reticle } : { ...caster.pos };

	const zoneId = `${ability.id}-${now}`;
	state.zones.push({
		id: zoneId,
		center,
		follows: ability.zoneFollows ?? 'fixed',
		ownerId: caster.id,
		radius,
		expiresAt: now + (ability.durationMs ?? 8000),
		lastTickAt: now,
		buff: ability.zoneBuff,
		persistsAfterDeath: ability.persistsAfterDeath ?? false
	});
	publish('zone:created', { zoneId, ownerId: caster.id });

	// Guaranteed cast-time floor (heal/shield/energy/stack that lands regardless of hits).
	const src: ResolveSource = {
		owner: caster,
		abilityName: ability.name,
		element: caster.def.element,
		ability,
		sourcePos: center   // zone proximity + knockback origin = the zone center
	};
	applyDelivery(state, ability.delivery, src, now);

	// One-time cast burst — enemies within radius of the zone CENTER (aimed or self).
	const burst = ability.delivery?.damage ?? 0;
	if (burst > 0 || ability.onHit) {
		const strata = ability.delivery?.hitsStrata;
		for (const enemy of state.enemies) {
			if (enemy.hp <= 0) continue;
			if (chebyshev(enemy.pos, center) > radius) continue;
			if (!canHitStratum(strata, enemy.stratum)) continue;
			applyOnHit(state, enemy, burst, ability.onHit, src, now);
		}
	}
	return true;
}
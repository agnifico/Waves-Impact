import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { resolveTiles } from '../shapes';
import { samePos, chebyshev } from '../board';
import { applyDelivery, applyOnHit, canHitStratum, type ResolveSource } from '../resolve';

/**
 * damage_first_in_line: resolve line tiles sorted by distance from caster,
 * damage the FIRST enemy encountered. (Data Contract §6)
 *
 * Damage / CC / sustain flow through the unified resolver — so a first-in-line
 * hit can splash off the struck enemy, stun, lifesteal, etc. The guaranteed
 * floor lands once via applyDelivery even if the line connects with nothing.
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number
): boolean {
	const tiles = resolveTiles(
		ability.delivery?.shape ?? 'line',
		caster.pos,
		caster.facing,
		ability.delivery?.shapeParams ?? {},
		state.board
	);
	if (tiles.length === 0) return false;

	const src: ResolveSource = {
		owner: caster,
		abilityName: ability.name,
		element: caster.def.element,
		ability
	};

	// Guaranteed cast-time floor — lands whether or not the line hits anything.
	applyDelivery(state, ability.delivery, src, now);

	const baseDmg = ability.delivery?.damage ?? 0;
	const strata = ability.delivery?.hitsStrata;

	// Sort tiles near → far, damage the first enemy found.
	const sorted = tiles.slice().sort((a, b) => chebyshev(a, caster.pos) - chebyshev(b, caster.pos));
	for (const tile of sorted) {
		for (const enemy of state.enemies) {
			if (enemy.hp <= 0) continue;
			if (!samePos(tile, enemy.pos)) continue;
			if (!canHitStratum(strata, enemy.stratum)) continue;
			applyOnHit(state, enemy, baseDmg, ability.onHit, src, now);
			return true; // stop at first hit
		}
	}

	return true; // line hit nothing — still a valid cast
}
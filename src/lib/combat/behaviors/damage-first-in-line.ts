import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { resolveTiles } from '../shapes';
import { samePos, chebyshev } from '../board';
import { calculateDamage } from '../pipeline';
import { publish } from '../events';
import { coversStratum } from '../spatial';

/**
 * damage_first_in_line: resolve line tiles sorted by distance from caster,
 * damage the first enemy encountered. (Data Contract §6)
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	_now: number
): boolean {
	const tiles = resolveTiles(
		ability.shape!,
		caster.pos,
		caster.facing,
		ability.shapeParams ?? {},
		state.board
	);

	if (tiles.length === 0) return false;

	// Sort tiles by distance from caster (near → far)
	const sorted = tiles.slice().sort((a, b) => chebyshev(a, caster.pos) - chebyshev(b, caster.pos));

	// Find first enemy in the line
	for (const tile of sorted) {
		for (const enemy of state.enemies) {
			if (enemy.hp <= 0) continue;
			if (!samePos(tile, enemy.pos)) continue;
			if (!coversStratum(ability.hits, enemy.stratum)) continue;

			const baseDmg = ability.damage ?? 0;
			const finalDmg = calculateDamage(baseDmg, {
				source: caster,
				target: enemy,
				ability,
				element: caster.def.element,
				state
			});

			enemy.hp = Math.max(0, enemy.hp - finalDmg);

			publish('damage:dealt', {
				source: caster.id,
				target: enemy.id,
				amount: finalDmg,
				abilityName: ability.name,
				element: caster.def.element
			});

			if (enemy.hp <= 0) {
				publish('enemy:defeated', { enemyId: enemy.id, killer: caster.id });
			}

			return true; // Stop at first hit
		}
	}

	// Line hit nothing
	return true; // Still counts as a valid cast (ability was fired)
}

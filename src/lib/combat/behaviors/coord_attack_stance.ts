import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability, AbilityOpts } from '$lib/types/ability';
import { applyDelivery, type ResolveSource } from '../resolve';
import { applyEffect } from '../effects';

/**
 * coord_attack_stance: activates the caster's personal CA stance.
 *
 * Reads ability.caStance for the stance config. On activation:
 *   duration = baseDurationMs + caPendingStacks * stacksPerExtendMs
 *   if caPendingMaxReached → sets dmgMultiplier: 1.5 on the embedded caConfig
 * Resets caPendingStacks and caPendingMaxReached after consuming them.
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number,
	_opts: AbilityOpts = {}
): boolean {
	const stance = ability.caStance;
	if (!stance) return false;

	const src: ResolveSource = {
		owner: caster,
		abilityName: ability.name,
		element: caster.def.element,
		ability,
		tags: ['ability']
	};
	applyDelivery(state, ability.delivery, src, now);

	const pendingStacks = caster.caPendingStacks ?? 0;
	const maxReached = caster.caPendingMaxReached ?? false;

	const duration = stance.baseDurationMs + pendingStacks * stance.stacksPerExtendMs;

	// Reset before applying so the effect sees a clean slate on refresh
	caster.caPendingStacks = 0;
	caster.caPendingMaxReached = false;

	const effectId = stance.effectId ?? 'ca_stance';
	applyEffect(caster, effectId, caster.id, duration, now);

	const inst = caster.activeEffects[effectId];
	if (inst) {
		inst.caConfig = maxReached
			? { ...stance.config, dmgMultiplier: 1.5, grantingAbilityName: ability.name }
			: { ...stance.config, grantingAbilityName: ability.name };
	}

	return true;
}

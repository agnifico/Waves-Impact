import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability, AbilityOpts } from '$lib/types/ability';
import { resolveTiles } from '../shapes';
import { samePos } from '../board';
import { applyDelivery, applyOnHit, canHitStratum, type ResolveSource } from '../resolve';
import { applyEffect } from '../effects';
import { publish } from '../events';

/**
 * coord_attack_grant: deals an optional AoE burst then grants a Coordinated
 * Attack buff to self or the whole party.
 *
 * Reads ability.caGrant for the grant config (targets, duration, CA config).
 * The CA config is embedded directly on the EffectInstance after applyEffect
 * so it survives without a matching registry Effect def carrying it.
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number,
	_opts: AbilityOpts = {}
): boolean {
	const grant = ability.caGrant;
	if (!grant) return false;

	const src: ResolveSource = {
		owner: caster,
		abilityName: ability.name,
		element: caster.def.element,
		ability,
		tags: ['ability', 'ult']
	};

	applyDelivery(state, ability.delivery, src, now);

	// Optional AoE burst on cast
	const burst = ability.delivery?.damage ?? 0;
	if (burst > 0 || ability.onHit) {
		const shape = ability.delivery?.shape ?? 'circle';
		const sp = ability.delivery?.shapeParams ?? {};
		const tiles = resolveTiles(shape, caster.pos, caster.facing, sp, state.board);

		if (tiles.length > 0) {
			publish('cast:shape', {
				caster: caster.id,
				shape,
				center: { ...caster.pos },
				facing: { ...caster.facing },
				radius: sp.radius,
				range: sp.range,
				fxCls: ability.fx?.castCls,
				color: caster.def.theme?.primary
			});
		}

		const strata = ability.delivery?.hitsStrata;
		for (const enemy of state.enemies) {
			if (enemy.hp <= 0) continue;
			if (!tiles.some((t) => samePos(t, enemy.pos))) continue;
			if (!canHitStratum(strata, enemy.stratum)) continue;
			applyOnHit(state, enemy, burst, ability.onHit, src, now);
		}
	}

	// Grant the CA effect
	const effectId = grant.effectId ?? 'party_ca';
	const targets = grant.targets === 'party' ? state.party : [caster];
	for (const pc of targets) {
		if (pc.hp <= 0) continue;
		applyEffect(pc, effectId, caster.id, grant.durationMs, now);
		// Embed the CA config on the live instance — bypasses the registry def
		const inst = pc.activeEffects[effectId];
		if (inst) inst.caConfig = { ...grant.config, grantingAbilityName: ability.name };
	}

	return true;
}

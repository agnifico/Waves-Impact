import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability, AbilityOpts } from '$lib/types/ability';
import { resolveTiles } from '../shapes';
import { samePos } from '../board';
import { focusTarget } from '../query';
import { applyDelivery, applyOnHit, canHitStratum, type ResolveSource } from '../resolve';
import { publish } from '../events';

/**
 * damage_aoe: resolve shape tiles, damage every enemy standing in them.
 * Target point priority: reticle > self-cast > focus/locked enemy > nearest.
 *
 * Damage / CC / sustain all flow through the unified resolver. Each enemy in the
 * shape is a full applyOnHit connect (so an AoE can splash/stun/lifesteal/etc.),
 * and the guaranteed floor (cast-time heal/shield/energy/stack) lands once via
 * applyDelivery regardless of how many — or whether any — enemies are caught.
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number,
	opts: AbilityOpts = {}
): boolean {
	let targetPoint = caster.pos;
	if (opts.reticle) {
		targetPoint = opts.reticle;
	} else if (opts.selfTarget && ability.delivery?.allowSelfTarget) {
		targetPoint = { ...caster.pos };
	} else if (ability.delivery?.autoTargetEnemy) {
		const target = focusTarget(state, caster.pos);
		if (target) targetPoint = target.pos;
	}

	const tiles = resolveTiles(
		ability.delivery?.shape ?? 'circle',
		caster.pos,
		caster.facing,
		ability.delivery?.shapeParams ?? {},
		state.board,
		targetPoint
	);
	if (tiles.length === 0) return false;

	const sp = ability.delivery?.shapeParams ?? {};
	publish('cast:shape', {
		caster: caster.id,
		shape: ability.delivery?.shape ?? 'circle',
		center: { ...targetPoint },
		facing: { ...caster.facing },
		range: sp.range,
		radius: sp.radius,
		fxCls: ability.fx?.castCls,
		color: caster.def.theme?.primary
	});

	const src: ResolveSource = {
		owner: caster,
		abilityName: ability.name,
		element: caster.def.element,
		ability
	};

	// Guaranteed cast-time floor (heal/shield/energy/stack — lands regardless of hits).
	applyDelivery(state, ability.delivery, src, now);

	// Per-enemy connect for everyone in the shape.
	const baseDmg = ability.delivery?.damage ?? 0;
	const strata = ability.delivery?.hitsStrata;
	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		if (!tiles.some((t) => samePos(t, enemy.pos))) continue;
		if (!canHitStratum(strata, enemy.stratum)) continue;
		applyOnHit(state, enemy, baseDmg, ability.onHit, src, now);
	}

	return true;
}
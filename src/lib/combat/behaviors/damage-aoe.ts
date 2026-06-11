import type { EngineState, CharacterState, EnemyState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { resolveTiles } from '../shapes';
import { samePos } from '../board';
import { calculateDamage } from '../pipeline';
import { focusTarget } from '../query';
import { publish } from '../events';
import { coversStratum } from '../spatial';

export interface AoeOpts {
	reticle?: { x: number; y: number } | null;
	selfTarget?: boolean;
}

/**
 * damage_aoe: resolve shape tiles, damage every enemy standing in them.
 * Target point priority: reticle > self-cast > focus/locked enemy > nearest.
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number,
	opts: AoeOpts = {}
): boolean {
	let targetPoint = caster.pos;
	if (opts.reticle) {
		targetPoint = opts.reticle;
	} else if (opts.selfTarget && ability.allowSelfTarget) {
		targetPoint = { ...caster.pos };
	} else if (ability.autoTargetEnemy) {
		const target = focusTarget(state, caster.pos);
		if (target) targetPoint = target.pos;
	}

	const tiles = resolveTiles(
		ability.shape!,
		caster.pos,
		caster.facing,
		ability.shapeParams ?? {},
		state.board,
		targetPoint
	);
	
	if (tiles.length === 0) return false;
	
	// Damage enemies in tiles
	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		if (!tiles.some((t) => samePos(t, enemy.pos))) continue;
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

		if (ability.stunMs) {
			enemy.stunnedUntil = now + ability.stunMs;
		}

		if (enemy.hp <= 0) {
			publish('enemy:defeated', { enemyId: enemy.id, killer: caster.id });
		}
	}

	// Self-heal if any party member is in the AoE
	if (ability.selfHeal) {
		for (const pc of state.party) {
			if (tiles.some((t) => samePos(t, pc.pos))) {
				const before = pc.hp;
				pc.hp = Math.min(pc.def.maxHp, pc.hp + ability.selfHeal);
				const healed = pc.hp - before;
				if (healed > 0) {
					publish('heal:applied', {
						target: pc.id,
						source: caster.id,
						amount: healed,
						abilityName: ability.name
					});
				}
			}
		}
	}

	// Whole-party heal — position-independent (June 9's Greenshackle). The ghost
	// stays intact; we just stop letting position gate the heal.
	if (ability.teamHeal) {
		for (const pc of state.party) {
			if (pc.hp <= 0) continue;
			const before = pc.hp;
			pc.hp = Math.min(pc.def.maxHp, pc.hp + ability.teamHeal);
			const healed = pc.hp - before;
			if (healed > 0) {
				publish('heal:applied', {
					target: pc.id,
					source: caster.id,
					amount: healed,
					abilityName: ability.name
				});
			}
		}
	}

	return true;
}
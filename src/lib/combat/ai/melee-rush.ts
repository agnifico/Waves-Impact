import type { EngineState, EnemyState } from '$lib/types/state';
import type { Position } from '$lib/types/common';
import { chebyshev, step4Toward, step8Toward, step8Away, samePos, clamp } from '../board';
import { publish } from '../events';
import { canEnter } from '../spatial';
import { absorbDamage, getStatModifier } from '../effects';

/**
 * melee_rush AI: move toward the highest-threat target, attack when in range.
 * Covers both bear (4-dir, melee) and dragon (8-dir, ranged) from the prototype.
 */
export function tick(state: EngineState, enemy: EnemyState, now: number): void {
	if (state.over) return;
	if (enemy.hp <= 0) return;
	if (enemy.stunnedUntil > now) return;

	const def = enemy.def;
	const active = state.party[state.activeSlot];

	// Aggro target: nearest *mobile* summon (wolf etc.) or active character.
	// Constructs (state.constructs) are intentionally excluded — they are
	// environmental objects, not threat actors. Targeting them would cause
	// enemies to pathfind into the pylon and freeze.
	let target: Position = active.pos;
	let targetIsChar = true;

	for (const summon of state.summons) {
		if (chebyshev(summon.pos, enemy.pos) < chebyshev(active.pos, enemy.pos)) {
			target = summon.pos;
			targetIsChar = false;
		}
	}

	// Try attacks (priority-sorted, highest first)
	const sorted = def.attacks.slice().sort((a, b) => b.priority - a.priority);
	for (const atk of sorted) {
		const cdReady = (enemy.attackCooldowns[atk.id] ?? 0) <= now;
		const inRange = chebyshev(enemy.pos, target) <= atk.range;

		if (cdReady && inRange) {
			enemy.attackCooldowns[atk.id] = now + atk.cooldownMs;

			if (targetIsChar) {
				const red = Math.min(1, getStatModifier(active, 'damageReduction'));
				const dmg = Math.max(0, Math.round(atk.damage * (1 - red)));
				const toHp = absorbDamage(active, dmg); // shields soak first
				active.hp = Math.max(0, active.hp - toHp);

				publish('damage:taken', { target: active.id, source: enemy.id, amount: toHp, abilityName: atk.name });

				if (atk.stunMs) active.stunnedUntil = now + atk.stunMs;
				if (active.hp <= 0) { /* auto-swap handled by engine tick */ }
			} else {
				// Hit summon (absorbed — summons are currently unkillable)
			}

			return; // One attack per tick
		}
	}

	// Movement
	const lowestPrio = def.attacks.slice().sort((a, b) => a.priority - b.priority)[0];
	const desiredRange = lowestPrio?.range ?? 1;

	if (now >= enemy.nextMoveAt) {
		const dist = chebyshev(enemy.pos, target);
		const from = { ...enemy.pos };
		let candidate = enemy.pos;

		if (dist > desiredRange) {
			// Close distance
			candidate = clamp(
				state.board,
				def.canMoveDiagonal ? step8Toward(enemy.pos, target) : step4Toward(enemy.pos, target)
			);
		} else if (dist < 1 && def.attacks.some((a) => a.range >= 2)) {
			// Too close for ranged — back off
			candidate = clamp(
				state.board,
				def.canMoveDiagonal ? step8Away(enemy.pos, target) : step4Toward(enemy.pos, target)
			);
		}

		// Only move onto terrain this enemy can occupy
		if (canEnter(enemy.stratum, candidate, state.board, def.traversal)) {
			enemy.pos = candidate;
		}

		if (!samePos(from, enemy.pos)) {
			publish('movement:enemy', { enemyId: enemy.id, from, to: enemy.pos });
		}

		// Pursuit hysteresis, computed ONCE per move so it can't stack into a freeze:
		// if the player repositioned since our last move, the next move waits a beat
		// longer. Sustained fleeing slows the chase (kiting still works) but never stops it.
		const fleeing = targetIsChar && !samePos(enemy.lastPlayerPos, active.pos);
		enemy.lastPlayerPos = { ...active.pos };
		enemy.nextMoveAt = now + def.moveTickMs + (fleeing ? def.moveResumeAfterPlayerFleeMs : 0);
	}
}
import type { EngineState, EnemyState } from '$lib/types/state';
import { chebyshev, step4Toward, step8Toward, step8Away, samePos, clamp } from '../board';
import { publish } from '../events';
import { canEnter } from '../spatial';
import { resolveTarget, tryAttacks } from './utils';

/**
 * melee_rush: close to melee range and attack. Backs off slightly if too close
 * for a ranged variant. Respects ignoresSummons and handles knockback via
 * attack data (atk.knockback / atk.knockbackSmart) — no extra code needed here.
 */
export function tick(state: EngineState, enemy: EnemyState, now: number): void {
    if (state.over || enemy.hp <= 0 || enemy.stunnedUntil > now) return;

    const def = enemy.def;
    const active = state.party[state.activeSlot];
    const { pos: target, isChar: targetIsChar } = resolveTarget(state, enemy);

    if (tryAttacks(state, enemy, target, targetIsChar, now)) return;

    const desiredRange = def.attacks.slice().sort((a, b) => a.priority - b.priority)[0]?.range ?? 1;

    if (now >= enemy.nextMoveAt) {
        const dist = chebyshev(enemy.pos, target);
        const from = { ...enemy.pos };
        let candidate = enemy.pos;

        if (dist > desiredRange) {
            candidate = clamp(state.board,
                def.canMoveDiagonal
                    ? step8Toward(enemy.pos, target)
                    : step4Toward(enemy.pos, target)
            );
        } else if (dist < 1 && def.attacks.some((a) => a.range >= 2)) {
            candidate = clamp(state.board,
                def.canMoveDiagonal
                    ? step8Away(enemy.pos, target)
                    : step4Toward(enemy.pos, target)
            );
        }

        if (canEnter(enemy.stratum, candidate, state.board, def.traversal)) {
            enemy.pos = candidate;
        }
        if (!samePos(from, enemy.pos)) {
            publish('movement:enemy', { enemyId: enemy.id, from, to: enemy.pos });
        }

        const fleeing = targetIsChar && !samePos(enemy.lastPlayerPos, active.pos);
        enemy.lastPlayerPos = { ...active.pos };
        enemy.nextMoveAt = now + def.moveTickMs + (fleeing ? def.moveResumeAfterPlayerFleeMs : 0);
    }
}
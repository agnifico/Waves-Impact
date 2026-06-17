import type { EngineState, EnemyState } from '$lib/types/state';
import { chebyshev, step4Toward, step8Toward, step8Away, samePos, clamp } from '../board';
import { publish } from '../events';
import { canEnter } from '../spatial';
import { resolveTarget, tileBlockedByConstruct, tryAttacks } from './utils';

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
            const raw = clamp(state.board,
                def.canMoveDiagonal
                    ? step8Toward(enemy.pos, target)
                    : step4Toward(enemy.pos, target)
            );
            // Try to route around constructs on the direct path
            if (tileBlockedByConstruct(state, raw, enemy)) {
                // Try 8 neighbours, pick closest to target that isn't construct-blocked
                const alternatives = [
                    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
                    { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
                ]
                    .map(o => clamp(state.board, { x: enemy.pos.x + o.x, y: enemy.pos.y + o.y }))
                    .filter(p => !tileBlockedByConstruct(state, p, enemy) && canEnter(enemy.stratum, p, state.board, def.traversal))
                    .sort((a, b) => chebyshev(a, target) - chebyshev(b, target));
                candidate = alternatives[0] ?? raw; // fall back to raw if all blocked
            } else {
                candidate = raw;
            }
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
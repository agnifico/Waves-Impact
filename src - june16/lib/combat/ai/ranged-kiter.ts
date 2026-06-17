import type { EngineState, EnemyState } from '$lib/types/state';
import { chebyshev, step8Toward, step8Away, samePos, clamp } from '../board';
import { publish } from '../events';
import { canEnter } from '../spatial';
import { resolveTarget, tileBlockedByConstruct, tryAttacks } from './utils';

/**
 * ranged_kiter: maintain the enemy's maximum attack range.
 * Backs off when the player closes in, advances when the player retreats.
 * Ideal for archers, casters, and any enemy that wants to stay at distance.
 *
 * Band: [maxRange-1, maxRange+1]. Inside the band → hold. Outside → adjust.
 */
export function tick(state: EngineState, enemy: EnemyState, now: number): void {
    if (state.over || enemy.hp <= 0 || enemy.stunnedUntil > now) return;

    const def = enemy.def;
    const active = state.party[state.activeSlot];
    const { pos: target, isChar: targetIsChar } = resolveTarget(state, enemy);

    if (tryAttacks(state, enemy, target, targetIsChar, now)) return;

    // Preferred range = the highest-range attack available
    const maxRange = def.attacks.reduce((m, a) => Math.max(m, a.range), 1);

    if (now >= enemy.nextMoveAt) {
        const dist = chebyshev(enemy.pos, target);
        const from = { ...enemy.pos };
        let candidate = enemy.pos;

        if (dist < maxRange - 1) {
            // Player too close — back off
            candidate = clamp(state.board, step8Away(enemy.pos, target));
        } else if (dist > maxRange + 1) {
            const raw = clamp(state.board, step8Toward(enemy.pos, target));
            if (tileBlockedByConstruct(state, raw, enemy)) {
                const alternatives = [
                    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
                    { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
                ]
                    .map(o => clamp(state.board, { x: enemy.pos.x + o.x, y: enemy.pos.y + o.y }))
                    .filter(p => !tileBlockedByConstruct(state, p, enemy) && canEnter(enemy.stratum, p, state.board, def.traversal))
                    .sort((a, b) => chebyshev(a, target) - chebyshev(b, target));
                candidate = alternatives[0] ?? raw;
            } else {
                candidate = raw;
            }
        }
        // In band [maxRange-1, maxRange+1] — hold position

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
import type { EngineState, EnemyState } from '$lib/types/state';
import type { Position } from '$lib/types/common';
import { chebyshev, step8Toward, samePos, clamp } from '../board';
import { publish } from '../events';
import { canEnter } from '../spatial';
import { resolveTarget, tileBlockedForEnemy, tryAttacks } from './utils';

/**
 * flanker: approach from the player's blind side.
 * Scores three non-frontal positions (left, right, behind relative to player
 * facing) and moves toward whichever is closest to itself.
 * Once adjacent, attacks normally.
 *
 * Pairs with low moveTickMs for the fast, evasive feel.
 */
export function tick(state: EngineState, enemy: EnemyState, now: number): void {
    if (state.over || enemy.hp <= 0 || enemy.stunnedUntil > now) return;

    const def = enemy.def;
    const active = state.party[state.activeSlot];
    const { pos: target, isChar: targetIsChar } = resolveTarget(state, enemy);

    if (tryAttacks(state, enemy, target, targetIsChar, now)) return;

    if (now >= enemy.nextMoveAt) {
        const from = { ...enemy.pos };
        let candidate = enemy.pos;

        if (targetIsChar) {
            const already = chebyshev(enemy.pos, active.pos) <= 1;
            if (!already) {
                // Three approach angles that avoid the frontal arc
                const f = active.facing;
                // Scale lateral offset by distance — wide arc when far, tightens on approach.
                // Minimum 2 so the waypoint is never trivially close to the player.
                const scale = Math.max(2, Math.ceil(chebyshev(enemy.pos, active.pos) / 2));
                const perpL = clamp(state.board, { x: active.pos.x + f.y * scale, y: active.pos.y - f.x * scale });
                const perpR = clamp(state.board, { x: active.pos.x - f.y * scale, y: active.pos.y + f.x * scale });
                const flankTarget = chebyshev(perpL, enemy.pos) <= chebyshev(perpR, enemy.pos) ? perpL : perpR;
                const raw = clamp(state.board, step8Toward(enemy.pos, flankTarget));
                if (tileBlockedForEnemy(state, raw, enemy)) {
                    const alternatives = [
                        { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
                        { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
                    ]
                        .map(o => clamp(state.board, { x: enemy.pos.x + o.x, y: enemy.pos.y + o.y }))
                        .filter(p => !tileBlockedForEnemy(state, p, enemy) && canEnter(enemy.stratum, p, state.board, def.traversal))
                        .sort((a, b) => chebyshev(a, flankTarget) - chebyshev(b, flankTarget));
                    candidate = alternatives[0] ?? raw;
                } else {
                    candidate = raw;
                }
            }
            // Already adjacent: hold and let tryAttacks fire next tick when cd clears
        } else {
            // Chasing a summon — approach with construct routing
            const raw = clamp(state.board, step8Toward(enemy.pos, target));
            if (tileBlockedForEnemy(state, raw, enemy)) {
                const alternatives = [
                    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
                    { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
                ]
                    .map(o => clamp(state.board, { x: enemy.pos.x + o.x, y: enemy.pos.y + o.y }))
                    .filter(p => !tileBlockedForEnemy(state, p, enemy) && canEnter(enemy.stratum, p, state.board, def.traversal))
                    .sort((a, b) => chebyshev(a, target) - chebyshev(b, target));
                candidate = alternatives[0] ?? raw;
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
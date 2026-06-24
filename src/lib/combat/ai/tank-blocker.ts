import type { EngineState, EnemyState } from '$lib/types/state';
import type { Position } from '$lib/types/common';
import { chebyshev, step4Toward, step8Toward, samePos, clamp } from '../board';
import { publish } from '../events';
import { canEnter } from '../spatial';
import { resolveTarget, tileBlockedForEnemy, tryAttacks } from './utils';

/**
 * tank_blocker: physically screen for allied enemies by positioning
 * between the player and the nearest other living enemy.
 *
 * Movement: toward the midpoint of (player, nearest_other_enemy).
 * Attack: fires normally when adjacent to the player.
 * Pairs with high maxHp, low moveTickMs, and a short-range attack.
 */
export function tick(state: EngineState, enemy: EnemyState, now: number): void {
    if (state.over || enemy.hp <= 0 || enemy.stunnedUntil > now) return;

    const def = enemy.def;
    const active = state.party[state.activeSlot];
    const { pos: targetPos, isChar: targetIsChar } = resolveTarget(state, enemy);

    if (tryAttacks(state, enemy, targetPos, targetIsChar, now)) return;

    if (now >= enemy.nextMoveAt) {
        const from = { ...enemy.pos };

        // Find another living enemy to screen for (any kind)
        const ally = state.enemies.find((e) => e.hp > 0 && e.id !== enemy.id);

        let moveTarget: Position;
        if (ally) {
            // Intercept: midpoint between player and the ally
            moveTarget = {
                x: Math.round((active.pos.x + ally.pos.x) / 2),
                y: Math.round((active.pos.y + ally.pos.y) / 2),
            };
        } else {
            // No ally to screen for — fall back to plain approach
            moveTarget = active.pos;
        }

        const raw = clamp(
            state.board,
            def.canMoveDiagonal
                ? step8Toward(enemy.pos, moveTarget)
                : step4Toward(enemy.pos, moveTarget)
        );
        const candidate = tileBlockedForEnemy(state, raw, enemy)
            ? ([
                { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
                { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
            ]
                .map(o => clamp(state.board, { x: enemy.pos.x + o.x, y: enemy.pos.y + o.y }))
                .filter(p => !tileBlockedForEnemy(state, p, enemy) && canEnter(enemy.stratum, p, state.board, def.traversal))
                .sort((a, b) => chebyshev(a, moveTarget) - chebyshev(b, moveTarget))[0] ?? raw)
            : raw;

        if (canEnter(enemy.stratum, candidate, state.board, def.traversal)) {
            enemy.pos = candidate;
        }
        if (!samePos(from, enemy.pos)) {
            publish('movement:enemy', { enemyId: enemy.id, from, to: enemy.pos });
        }

        // No fleeing hysteresis: the blocker tracks a midpoint, not the player directly
        enemy.lastPlayerPos = { ...active.pos };
        enemy.nextMoveAt = now + def.moveTickMs;
    }
}
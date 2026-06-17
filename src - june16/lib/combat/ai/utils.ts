import type { EngineState, EnemyState } from '$lib/types/state';
import type { Position } from '$lib/types/common';
import { chebyshev, step8Toward, step8Away, samePos, clamp } from '../board';
import { publish } from '../events';
import { absorbDamage, getStatModifier } from '../effects';

/**
 * Resolve the aggro target for an enemy this tick.
 * Returns the nearest summon if it is closer than the active character,
 * UNLESS enemy.def.ignoresSummons is true (boss-tier enemies walk through summons).
 */
export function resolveTarget(
    state: EngineState,
    enemy: EnemyState
): { pos: Position; isChar: boolean } {
    const active = state.party[state.activeSlot];
    let target: Position = active.pos;
    let isChar = true;

    if (!enemy.def.ignoresSummons) {
        for (const summon of state.summons) {
            if (chebyshev(summon.pos, enemy.pos) < chebyshev(active.pos, enemy.pos)) {
                target = summon.pos;
                isChar = false;
            }
        }
    }

    return { pos: target, isChar };
}

/**
 * Try to fire the highest-priority ready attack against `target`.
 * Handles damage, shields, stun, and knockback (from atk.knockback / atk.knockbackSmart).
 * Returns true if an attack fired — caller should early-return on true.
 */
export function tryAttacks(
    state: EngineState,
    enemy: EnemyState,
    target: Position,
    targetIsChar: boolean,
    now: number
): boolean {
    const active = state.party[state.activeSlot];
    const sorted = enemy.def.attacks.slice().sort((a, b) => b.priority - a.priority);

    for (const atk of sorted) {
        if ((enemy.attackCooldowns[atk.id] ?? 0) > now) continue;
        if (chebyshev(enemy.pos, target) > atk.range) continue;

        enemy.attackCooldowns[atk.id] = now + atk.cooldownMs;

        if (targetIsChar) {
            const red = Math.min(1, getStatModifier(active, 'damageReduction'));
            const dmg = Math.max(0, Math.round(atk.damage * (1 - red)));
            const toHp = absorbDamage(active, dmg);
            active.hp = Math.max(0, active.hp - toHp);
            active.lastHitAt = now;
            publish('damage:taken', {
                target: active.id, source: enemy.id,
                amount: toHp, abilityName: atk.name
            });
            if (atk.stunMs) active.stunnedUntil = Math.max(active.stunnedUntil, now + atk.stunMs);
            if ((atk as any).knockback > 0) {
                applyKnockback(state, enemy, (atk as any).knockback, !!(atk as any).knockbackSmart);
            }
        }
        // summon hit: absorbed — summons are currently unkillable

        return true;
    }
    return false;
}

/**
 * Push the active character N tiles.
 * smart = false → push away from the attacking enemy (standard knockback).
 * smart = true  → push toward the nearest OTHER living enemy (combo setup).
 */
export function applyKnockback(
    state: EngineState,
    enemy: EnemyState,
    tiles: number,
    smart: boolean
): void {
    const active = state.party[state.activeSlot];
    const from = { ...active.pos };

    let pushToward: Position | null = null;
    if (smart) {
        const others = state.enemies.filter((e) => e.hp > 0 && e.id !== enemy.id);
        if (others.length) {
            pushToward = others.reduce((a, b) =>
                chebyshev(a.pos, active.pos) <= chebyshev(b.pos, active.pos) ? a : b
            ).pos;
        }
    }

    for (let i = 0; i < tiles; i++) {
        const next = pushToward
            ? clamp(state.board, step8Toward(active.pos, pushToward))
            : clamp(state.board, step8Away(active.pos, enemy.pos));
        if (samePos(next, active.pos)) break;
        active.pos = next;
    }

    if (!samePos(from, active.pos)) {
        publish('movement:player', { characterId: active.id, from, to: active.pos });
    }
}

/**
 * Returns true if a construct on this tile should block this enemy's pathing.
 * Flying enemies pass over ground constructs freely.
 */
export function tileBlockedByConstruct(
    state: EngineState,
    pos: Position,
    enemy: EnemyState
): boolean {
    if (enemy.stratum === 'flying') return false;
    return state.constructs.some((c) => 
        samePos(c.pos, pos) && c.stratum === enemy.stratum
    );
}
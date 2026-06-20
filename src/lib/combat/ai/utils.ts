import type { EngineState, EnemyState } from '$lib/types/state';
import type { Position } from '$lib/types/common';
import type { FxSpec } from '$lib/types/ability';
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
    // A committed wind-up is in flight — hold until it resolves (drained elsewhere).
    if (enemy.pendingAttack) return true;

    const sorted = enemy.def.attacks.slice().sort((a, b) => b.priority - a.priority);

    for (const atk of sorted) {
        if ((enemy.attackCooldowns[atk.id] ?? 0) > now) continue;
        if (chebyshev(enemy.pos, target) > atk.range) continue;

        enemy.attackCooldowns[atk.id] = now + atk.cooldownMs;

        const wu = atk.windUpMs ?? 0;
        if (wu > 0) {
            // Telegraph: commit the strike now, land it after the wind-up. Direction
            // points at the target (enemy.facing is unused), so the gem lunges right.
            enemy.pendingAttack = {
                attackId: atk.id,
                firesAt: now + wu,
                damage: atk.damage,
                stunMs: atk.stunMs,
                knockback: atk.knockback,
                knockbackSmart: atk.knockbackSmart,
                name: atk.name,
                targetIsChar,
                windUpStyle: atk.windUpStyle,
                fx: atk.fx,
                dirX: Math.sign(target.x - enemy.pos.x),
                dirY: Math.sign(target.y - enemy.pos.y)
            };
            publish('enemy:windup', { enemy: enemy.id, durationMs: wu, attackName: atk.name });
        } else {
            applyEnemyHit(state, enemy, {
                damage: atk.damage, stunMs: atk.stunMs,
                knockback: atk.knockback, knockbackSmart: atk.knockbackSmart,
                name: atk.name, targetIsChar, fx: atk.fx
            }, now);
        }
        return true;
    }
    return false;
}

/** Land an enemy strike on the active character (shared by instant + wind-up paths). */
export function applyEnemyHit(
    state: EngineState,
    enemy: EnemyState,
    hit: { damage: number; stunMs?: number; knockback?: number; knockbackSmart?: boolean; name: string; targetIsChar: boolean; fx?: FxSpec },
    now: number
): void {
    if (!hit.targetIsChar) return; // summon hit: absorbed (summons currently unkillable)
    const active = state.party[state.activeSlot];
    const red = Math.min(1, getStatModifier(active, 'damageReduction'));
    const dmg = Math.max(0, Math.round(hit.damage * (1 - red)));
    const toHp = absorbDamage(active, dmg);
    active.hp = Math.max(0, active.hp - toHp);
    active.lastHitAt = now;
    publish('damage:taken', { target: active.id, source: enemy.id, amount: toHp, abilityName: hit.name });
    publish('enemy:strike', { enemy: enemy.id, target: active.id, fx: hit.fx });
    if (hit.stunMs) {
        active.stunnedUntil = Math.max(active.stunnedUntil, now + hit.stunMs);
        publish('combat:stun', { target: active.id, durationMs: hit.stunMs });
    }
    if (hit.knockback && hit.knockback > 0) {
        applyKnockback(state, enemy, hit.knockback, !!hit.knockbackSmart);
    }
}

/**
 * Resolve any enemy attack wind-up whose timer elapsed. Called once per engine
 * tick (from fireWindUpCasts). Re-checks range — dash out and the swing whiffs.
 */
export function fireEnemyAttacks(state: EngineState, now: number): void {
    for (const enemy of state.enemies) {
        const pa = enemy.pendingAttack;
        if (!pa || now < pa.firesAt) continue;
        enemy.pendingAttack = undefined;
        if (enemy.hp <= 0) continue;
        const { pos: target, isChar } = resolveTarget(state, enemy);
        const atk = enemy.def.attacks.find((a) => a.id === pa.attackId);
        if (chebyshev(enemy.pos, target) > (atk?.range ?? 1)) continue; // whiffed
        applyEnemyHit(state, enemy, {
            damage: pa.damage, stunMs: pa.stunMs,
            knockback: pa.knockback, knockbackSmart: pa.knockbackSmart,
            name: pa.name, targetIsChar: isChar, fx: pa.fx
        }, now);
    }
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
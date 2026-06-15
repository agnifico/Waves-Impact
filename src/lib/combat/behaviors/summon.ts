import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { step8Toward, samePos, clamp } from '../board';
import { nearestEnemy } from '../query';
import { publish } from '../events';
import { getCreationDef } from '$lib/data/creations';

/**
 * summon: spawn a summon entity adjacent to the caster, biased toward
 * the nearest enemy. Only one summon of the same defId at a time.
 *
 * All summon behaviour parameters (targeting, movement, attack, fx)
 * live in the CreationDef in data/creations.ts.
 * The ability only carries: creationId, cooldown, energy, stack grant.
 */
export function resolve(
    state: EngineState,
    caster: CharacterState,
    ability: Ability,
    now: number
): boolean {
    const creationId = ability.creationId;
    if (!creationId) return false;

    const def = getCreationDef(creationId);
    if (!def || def.kind !== 'summon') return false;

    // One instance of this summon at a time
    if (state.summons.some((s) => s.defId === creationId)) return false;

    // Place adjacent to caster, biased toward nearest enemy
    const enemy = nearestEnemy(state, caster.pos);
    let pos: { x: number; y: number };
    if (enemy) {
        pos = clamp(state.board, step8Toward(caster.pos, enemy.pos));
        if (samePos(pos, enemy.pos)) {
            pos = clamp(state.board, { x: caster.pos.x, y: caster.pos.y - 1 });
        }
    } else {
        pos = clamp(state.board, { x: caster.pos.x, y: caster.pos.y - 1 });
    }

    state.summons.push({
        id:           `${creationId}-${now}`,
        defId:        creationId,
        ownerId:      caster.id,
        pos,
        name:         def.name,
        profileImage: def.image,
        receiveBuffs: def.receiveBuffs ?? false,
        expiresAt:    now + (def.durationMs ?? 10_000),
        nextMoveAt:   now + (def.moveCooldownMs ?? 500),
        nextAttackAt: now + (def.attackCooldownMs ?? 1000),
        element: caster.def.element,
    });

    publish('summon:spawned', { summonId: creationId, owner: caster.id });
    return true;
}
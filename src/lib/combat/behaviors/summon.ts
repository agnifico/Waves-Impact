import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability, AbilityOpts } from '$lib/types/ability';
import { step8Toward, samePos, clamp } from '../board';
import { nearestEnemy } from '../query';
import { publish } from '../events';
import { shoveEnemiesOff } from '../spatial';
import { getCreationDef } from '$lib/data/creations';
import { applyDelivery, type ResolveSource } from '../resolve';

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
    now: number,
    opts: AbilityOpts = {}
): boolean {
    const creationId = ability.creationId;
    if (!creationId) return false;

    const def = getCreationDef(creationId);
    if (!def || def.kind !== 'summon') return false;

    // One instance of this summon at a time
    if (state.summons.some((s) => s.defId === creationId)) return false;

    // Aimed placement (Frosty's wolf has holdBehavior:'aim') — drop the summon on
    // the reticle tile. Falls back to adjacent-toward-nearest-enemy when not aimed.
    let pos: { x: number; y: number };
    if (opts.reticle) {
        pos = clamp(state.board, { ...opts.reticle });
    } else {
        const enemy = nearestEnemy(state, caster.pos);
        if (enemy) {
            pos = clamp(state.board, step8Toward(caster.pos, enemy.pos));
            if (samePos(pos, enemy.pos)) {
                pos = clamp(state.board, { x: caster.pos.x, y: caster.pos.y - 1 });
            }
        } else {
            pos = clamp(state.board, { x: caster.pos.x, y: caster.pos.y - 1 });
        }
    }

    state.summons.push({
        id:           `${creationId}-${now}`,
        defId:        creationId,
        ownerId:      caster.id,
        pos,
        stratum:      def.stratum ?? 'ground',
        name:         def.name,
        profileImage: def.image,
        receiveBuffs: def.receiveBuffs ?? false,
        expiresAt:    now + (def.durationMs ?? 10_000),
        nextMoveAt:   now + (def.moveCooldownMs ?? 500),
        nextAttackAt: now + (def.attackCooldownMs ?? 1000),
        element: caster.def.element,
        footprint: def.footprint,   // offsets; occupiedTiles maps to absolute
        footprintRender: def.footprintRender,
        juggernaut: def.juggernaut,
    });

    // Push same-stratum enemies off the summon's footprint
    const sstratum = def.stratum ?? 'ground';
    const sTiles = (def.footprint ?? [{ x: 0, y: 0 }]).map((o) => ({ x: pos.x + o.x, y: pos.y + o.y }));
    shoveEnemiesOff(state, sTiles, sstratum, publish);

    const src: ResolveSource = { owner: caster, abilityName: ability.name ?? ability.id, element: caster.def.element, ability, tags: ['ability'] };
    applyDelivery(state, ability.delivery, src, now);

    publish('summon:spawned', { summonId: `${creationId}-${now}`, owner: caster.id, pos: { ...pos } });
    return true;
}
import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { samePos, clamp } from '../board';
import { publish } from '../events';
import { getCreationDef } from '$lib/data/creations';

/**
 * construct: place a stationary construct on the board.
 *
 * All construct behaviour parameters live in the CreationDef in
 * data/creations.ts. The ability only carries: creationId, charges,
 * cooldown, energy, stack grant.
 *
 * Placement: one tile forward in caster's facing direction (reticle
 * override support deferred to next pass).
 * Duplicate guard: same defId + same tile → silently returns false,
 * charge not spent.
 * Element is always inherited from the caster at spawn.
 */
export function resolve(
    state: EngineState,
    caster: CharacterState,
    ability: Ability,
    now: number,
    opts: Record<string, unknown> = {}
): boolean {
    const creationId = ability.creationId;
    if (!creationId) return false;

    const def = getCreationDef(creationId);
    if (!def || def.kind !== 'construct') return false;

    const reticle = opts.reticle as { x: number; y: number } | null | undefined;
    const pos = reticle
        ? clamp(state.board, { ...reticle })
        : clamp(state.board, {
                x: caster.pos.x + Math.sign(caster.facing.x || 0),
                y: caster.pos.y + Math.sign(caster.facing.y || 0)
          });

    if (state.constructs.some((c) => c.defId === creationId && samePos(c.pos, pos))) {
        return false;
    }

    const pulseMs = def.pulseMs ?? 2_000;

    state.constructs.push({
        id:            `${creationId}-${now}`,
        defId:         creationId,
        ownerId:       caster.id,
        pos,
        stratum:       def.stratum ?? 'ground',
        name:          def.name,
        profileImage:  def.image,
        element:       caster.def.element,
        receiveBuffs:  def.receiveBuffs ?? false,
        constructType: def.constructType ?? 'inert',
        targetingType: def.targetingType ?? 'pulse',
        pulseDmg:      def.pulseDmg    ?? 0,
        pulseMs,
        pulseRadius:   def.pulseRadius ?? 1,
        stunMs:        def.stunMs      ?? 0,
        nextPulseAt:   now + pulseMs,
        expiresAt:     now + (def.durationMs ?? 10_000),
        footprint:     def.footprint?.map((o) => ({ x: pos.x + o.x, y: pos.y + o.y })) ?? [{ ...pos }],
    });

    publish('construct:placed', { constructId: `${creationId}-${now}`, ownerId: caster.id, pos: { ...pos } });
    return true;
}
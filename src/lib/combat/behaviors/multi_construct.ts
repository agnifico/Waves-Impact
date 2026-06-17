import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { clamp, samePos } from '../board';
import { getCreationDef } from '$lib/data/creations';
import { publish } from '../events';

export function resolve(
    state: EngineState,
    caster: CharacterState,
    ability: Ability,
    now: number,
    _opts: Record<string, unknown> = {}
): boolean {
    const creationId = ability.creationId;
    if (!creationId) return false;

    const def = getCreationDef(creationId);
    if (!def || def.kind !== 'construct') return false;

    const offsets = ability.multiConstructOffsets;
    if (!offsets || offsets.length === 0) return false;

    const pulseMs = def.pulseMs ?? 2_000;
    let placed = 0;

    for (const offset of offsets) {
        const pos = clamp(state.board, {
            x: caster.pos.x + offset.x,
            y: caster.pos.y + offset.y,
        });

        // Skip if a construct of the same def already occupies this tile
        if (state.constructs.some((c) => c.defId === creationId && samePos(c.pos, pos))) continue;

        const id = `${creationId}-${now}-${placed}`;
        state.constructs.push({
            id,
            defId:         creationId,
            ownerId:       caster.id,
            pos,
            name:          def.name,
            profileImage:  def.image,
            element:       caster.def.element,
            receiveBuffs:  def.receiveBuffs ?? false,
            constructType: def.constructType ?? 'inert',
            targetingType: def.targetingType ?? 'pulse',
            pulseDmg:      def.pulseDmg    ?? 0,
            pulseMs,
            pulseRadius:   def.pulseRadius ?? 1,
            stunMs: def.onHit?.stunMs ?? 0,
            nextPulseAt:   now + pulseMs,
            expiresAt:     now + (def.durationMs ?? 10_000),
            stratum: def.stratum ?? 'ground',
        });

        publish('construct:placed', { constructId: id, ownerId: caster.id });
        placed++;
    }

    // Always returns true — charge is spent regardless of how many were placed
    return true;
}
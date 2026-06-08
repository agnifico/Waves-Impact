import type { EngineState } from '$lib/types/state';
import type { CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { samePos, clamp } from '../board';
import { publish } from '../events';

/**
 * construct: place a stationary ConstructState on the field.
 * Constructs live in state.constructs (not state.summons) and are
 * ticked by tickConstructs in engine.ts. They are invisible to enemy
 * aggro AI (melee-rush targets state.summons only).
 *
 * Placement priority:
 *   1. reticle opt (if aim holdBehavior is added later)
 *   2. One tile forward in caster's facing direction (default)
 *
 * Constraints:
 *   - Cannot place on the same tile as an existing construct of the same defId.
 *     Returns false silently — charge is not spent.
 *
 * Recognised ability fields:
 *   summonId             — defId for the construct (reused field, same concept)
 *   summonImage          — profile image path
 *   summonDurationMs     — lifetime ms (default 10 000)
 *   constructPulseDmg    — damage per pulse (default 0)
 *   constructPulseMs     — ms between pulses (default 2 000)
 *   constructPulseRadius — Chebyshev radius (default 1)
 *   constructStunMs      — stun on pulse hit in ms (default 0)
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number,
	opts: Record<string, unknown> = {}
): boolean {
	if (!ability.summonId) return false;

	// ── Placement ─────────────────────────────────────────────────────────────
	// Use reticle if supplied, else one tile forward in facing direction.
	// Facing is always a unit vector so adding it steps exactly one tile.
	const reticle = opts.reticle as { x: number; y: number } | null | undefined;
	const pos = reticle
		? clamp(state.board, { ...reticle })
		: clamp(state.board, {
				x: caster.pos.x + Math.sign(caster.facing.x || 0),
				y: caster.pos.y + Math.sign(caster.facing.y || 0)
		  });

	// ── Same-tile guard ───────────────────────────────────────────────────────
	// Refuse placement if a construct of the same type already occupies this tile.
	const duplicate = state.constructs.some(
		(c) => c.defId === ability.summonId && samePos(c.pos, pos)
	);
	if (duplicate) return false;

	// ── Place ─────────────────────────────────────────────────────────────────
	state.constructs.push({
		id: `${ability.summonId}-${now}`,
		defId: ability.summonId!,
		ownerId: caster.id,
		pos,
		profileImage: ability.summonImage,
		expiresAt: now + (ability.summonDurationMs ?? 10_000),
		pulseDmg:    ability.constructPulseDmg    ?? 0,
		pulseMs:     ability.constructPulseMs     ?? 2_000,
		pulseRadius: ability.constructPulseRadius ?? 1,
		stunMs:      ability.constructStunMs      ?? 0,
		// First pulse fires one full interval after placement — not immediately.
		nextPulseAt: now + (ability.constructPulseMs ?? 2_000),
	});

	publish('construct:placed', { constructId: `${ability.summonId}-${now}`, ownerId: caster.id });
	return true;
}
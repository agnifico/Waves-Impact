import type { EngineState } from '$lib/types/state';
import type { AbilitySlot } from '$lib/types/ability';
import { resolveBehavior } from './behaviors';
import { hasEffect, removeEffect } from './effects';
import { publish } from './events';
import type { Vector } from '$lib/types';

export interface AbilityOpts {
	reticle?: { x: number; y: number } | null;
	selfTarget?: boolean;
	chargedRange?: number;
	tier?: number;
	lockedTargetId?: string;
	aimDir?: Vector;
}

/** Lazily regenerate charges: one per rechargeMs, chaining until full. */
function refreshCharges(
	entry: { count: number; rechargeAt: number },
	max: number,
	rechargeMs: number,
	now: number
): void {
	if (entry.rechargeAt === 0) return; // full / not recharging
	while (entry.count < max && now >= entry.rechargeAt) {
		entry.count += 1;
		entry.rechargeAt = entry.count < max ? entry.rechargeAt + rechargeMs : 0;
	}
}

/**
 * Attempt to cast an ability. Checks stun, cooldown, energy cost,
 * then dispatches to the behavior handler.
 */
export function tryAbility(
	state: EngineState,
	slot: AbilitySlot,
	now: number,
	opts: AbilityOpts = {}
): void {
	if (state.over) return;

	const char = state.party[state.activeSlot];
	if (char.stunnedUntil > now) return;

	const ability = char.def.abilities[slot];
	if (!ability) return;

	// Cooldown check
	// Cooldown / charges check
	const maxCharges = ability.charges ?? 1;
	const isCharge = maxCharges > 1;
	const rechargeMs = ability.rechargeMs ?? ability.cooldownMs ?? 0;

	if (isCharge) {
		const entry = (char.charges[slot] ??= { count: maxCharges, rechargeAt: 0 });
		refreshCharges(entry, maxCharges, rechargeMs, now);
		if (entry.count <= 0) return;
	} else {
		if (char.cooldowns[slot] > now) return;
	}

	// Energy cost check
	if (ability.energyCost && char.energy < ability.energyCost) return;

	// Reset BA chain on any ability use
	char.baChainIndex = 0;

	// Resolve unchained bonus (consume if active). Legacy mechanic — bumps the
	// delivery's primary damage when Unchained is up. (Daylight: generalize this.)
	let abilityWithBonus = ability;
	if (ability.unchainedBonus && hasEffect(char, 'unchained')) {
		abilityWithBonus = {
			...ability,
			delivery: {
				...ability.delivery,
				damage: (ability.delivery?.damage ?? 0) + ability.unchainedBonus
			}
		};
		removeEffect(char, 'unchained');
	}

	// Dispatch to the behavior handler.
	const fired = resolveBehavior(state, char, abilityWithBonus, now, opts as Record<string, unknown>);
	if (!fired) return;

	// Post-resolution bookkeeping.
	// Energy COST is spent on cast (behaviors grant energy GAIN via applyDelivery/applyOnHit).
	if (ability.energyCost) {
		char.energy -= ability.energyCost;
	}

	// Cooldowns and charges
	if (isCharge) {
		const entry = char.charges[slot]!;
		const wasFull = entry.count === maxCharges;
		entry.count -= 1;
		if (wasFull) entry.rechargeAt = now + rechargeMs; // start clock only when leaving full
		char.cooldowns[slot] = entry.count > 0 ? 0 : entry.rechargeAt; // mirror for the CD overlay
	} else {
		char.cooldowns[slot] = now + (ability.cooldownMs ?? 0);
	}

	// Timestamp
	char.lastActionTimestamp = now;
	char.lastAction = { tag: 'cast_' + slot, at: now };

	publish('ability:cast', { caster: char.id, abilityId: ability.id, slot });
}
import type { EngineState } from '$lib/types/state';
import type { AbilitySlot } from '$lib/types/ability';
import { resolveBehavior } from './behaviors';
import { grantStack } from './stacks';
import { hasEffect, removeEffect } from './effects';
import { publish, subscribe } from './events';
import { grantOffFieldShare, WHIFF_SELF_RATIO } from './energy';
import type { Vector } from '$lib/types';
import { grantShield } from './effects';

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

	// Shield grant — declarative, behavior-agnostic
	if (ability.shield) {
		const s = ability.shield;
		const targets = s.target === 'party' ? state.party : [char];
		for (const t of targets) {
			if (t.hp > 0) {
				grantShield(t, s.amount, char.id, now, {
					durationMs: s.durationMs,
					maxTotal: s.maxTotal,
					effectId: s.effectId
				});
			}
		}
	}

	// Reset BA chain on any ability use
	char.baChainIndex = 0;

	// Resolve unchained bonus (consume if active)
	let abilityWithBonus = ability;
	if (ability.unchainedBonus && hasEffect(char, 'unchained')) {
		// Create a modified copy with boosted damage
		abilityWithBonus = {
			...ability,
			damage: (ability.damage ?? 0) + ability.unchainedBonus
		};
		removeEffect(char, 'unchained');
	}

	// Dispatch, observing whether the cast actually damages an enemy
	let dealtDamage = false;
	const unsub = subscribe('damage:dealt', (e) => {
		if (e.source === char.id) dealtDamage = true;
	});
	const fired = resolveBehavior(state, char, abilityWithBonus, now, opts as Record<string, unknown>);
	unsub();
	if (!fired) return;

	// Post-resolution bookkeeping
	// Energy: cost is spent on cast; energyGain is hit/whiff-aware
	if (ability.energyCost) {
		char.energy -= ability.energyCost;
	} else if (ability.energyGain) {
		const isDamage = (ability.damage ?? 0) > 0;
		const connected = isDamage ? dealtDamage : true; // utility skills don't whiff
		const self = connected ? ability.energyGain : ability.energyGain * WHIFF_SELF_RATIO;
		char.energy = Math.min(char.def.maxEnergy, char.energy + self);
		if (connected) grantOffFieldShare(state, ability.energyGain);
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

	if (ability.grantsStack) {
		grantStack(state, char, ability.grantsStack, now);
	}

	publish('ability:cast', { caster: char.id, abilityId: ability.id, slot });
}
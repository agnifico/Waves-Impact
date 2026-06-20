import type { CharacterState, EnemyState, EngineState } from '$lib/types/state';
import type { AbilitySlot } from '$lib/types/ability';
import { resolveBehavior } from './behaviors';
import { hasEffect, removeEffect } from './effects';
import { publish } from './events';
import type { Vector } from '$lib/types';
import { applyBasicHit } from './basic-attack';
import { fireEnemyAttacks } from './ai/utils';

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

	// ── Wind-up branch: commit cost/cooldown NOW, defer the behavior ──────────
	const windUpMs = ability.delivery?.windUpMs ?? 0;
	if (windUpMs > 0) {
		commitCast(state, char, slot, ability, isCharge, maxCharges, rechargeMs, now);
		char.pendingCast = {
			slot,
			firesAt: now + windUpMs,
			opts: opts as Record<string, unknown>
		};
		publish('cast:windup', { caster: char.id, slot, durationMs: windUpMs });
		return;
	}

	// Dispatch to the behavior handler (instant cast).
	const fired = resolveBehavior(state, char, abilityWithBonus, now, opts as Record<string, unknown>);
	if (!fired) return;

	commitCast(state, char, slot, ability, isCharge, maxCharges, rechargeMs, now);
	publish('ability:cast', { caster: char.id, abilityId: ability.id, slot });
}

/** Spend energy cost + start cooldown/charge clock + timestamp. Shared by instant
 *  and wind-up casts (a committed wind-up pays up front, then fires later). */
function commitCast(
	state: EngineState,
	char: EngineState['party'][number],
	slot: AbilitySlot,
	ability: NonNullable<EngineState['party'][number]['def']['abilities'][AbilitySlot]>,
	isCharge: boolean,
	maxCharges: number,
	rechargeMs: number,
	now: number
): void {
	if (ability.energyCost) char.energy -= ability.energyCost;

	if (isCharge) {
		const entry = char.charges[slot]!;
		const wasFull = entry.count === maxCharges;
		entry.count -= 1;
		if (wasFull) entry.rechargeAt = now + rechargeMs;
		char.cooldowns[slot] = entry.count > 0 ? 0 : entry.rechargeAt;
	} else {
		char.cooldowns[slot] = now + (ability.cooldownMs ?? 0);
	}

	char.lastActionTimestamp = now;
	char.lastAction = { tag: 'cast_' + slot, at: now };
}

/**
 * Fire any wind-up cast whose timer has elapsed. Called once per engine tick.
 * The committed behavior resolves here, windUpMs after the original press.
 */
export function fireWindUpCasts(state: EngineState, now: number): void {
	for (const char of state.party) {
		// ── Ability wind-ups ──
		const pending = char.pendingCast;
		if (pending && now >= pending.firesAt) {
			char.pendingCast = undefined;
			if (char.hp > 0) {
				const ability = char.def.abilities[pending.slot];
				if (ability) {
					resolveBehavior(state, char, ability, now, pending.opts);
					publish('ability:cast', { caster: char.id, abilityId: ability.id, slot: pending.slot });
				}
			}
		}

		// ── Basic-attack wind-ups (rhythmic) ──
		const pb = char.pendingBasic;
		if (pb && now >= pb.firesAt) {
			char.pendingBasic = undefined;
			if (char.hp > 0) {
				const enemy = state.enemies.find((e) => e.id === pb.enemyId && e.hp > 0);
				if (enemy) applyBasicHit(state, char, pb.ba as any, enemy, now);
			}
		}
	}

	// ── Enemy attack wind-ups (telegraph) — drained in the same tick ──
	fireEnemyAttacks(state, now);
}
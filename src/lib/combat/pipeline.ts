import type { EngineState, CharacterState, EnemyState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { getStatModifier } from './effects';
import { chebyshev } from './board';

/**
 * Context passed through every pipeline stage.
 * Stages can read anything here but should only modify `amount`.
 */
export interface DamageContext {
	source: CharacterState;
	target: EnemyState | CharacterState;
	ability?: Ability;
	element?: string;
	state: EngineState;
}

type PipelineStage = (amount: number, ctx: DamageContext) => number;

// ─── Stage 2: source effects (bloomstride, buff stacks, etc.) ────────────────
function applySourceEffects(amount: number, ctx: DamageContext): number {
	const bonus = getStatModifier(ctx.source, 'damageBonus');
	return Math.round(amount * (1 + bonus));
}

// ─── Stage 3: zone bonuses ───────────────────────────────────────────────────
function applyZoneBonuses(amount: number, ctx: DamageContext): number {
	const { source, state } = ctx;
	let bonus = 0;
	for (const zone of state.zones) {
		if (!zone.buff?.damageBonus) continue;
		// friendly zones only (owned by a party member)
		if (!state.party.some((p) => p.id === zone.ownerId)) continue;
		// the attacker must be standing inside the zone
		if (chebyshev(source.pos, zone.center) > zone.radius) continue;
		bonus += zone.buff.damageBonus; // additive across overlaps (tunable)
	}
	return bonus > 0 ? Math.round(amount * (1 + bonus)) : amount;
}

// ─── Stage 4: elemental matrix ───────────────────────────────────────────────
function applyElementalMatrix(amount: number, _ctx: DamageContext): number {
	// TODO: element advantage/disadvantage multiplier
	return amount;
}

// ─── Stage 5: gear modifiers (future) ────────────────────────────────────────
function applyGearModifiers(amount: number, _ctx: DamageContext): number {
	return amount;
}

// ─── Stage 6: defense (future) ───────────────────────────────────────────────
function applyDefense(amount: number, _ctx: DamageContext): number {
	return amount;
}

// ─── Stage 7: crit (future) ──────────────────────────────────────────────────
function applyCrit(amount: number, _ctx: DamageContext): number {
	return amount;
}

// ─── Stage 8: target effects (damage reduction, vulnerability marks) ─────────
function applyTargetEffects(amount: number, ctx: DamageContext): number {
	const reduction = getStatModifier(ctx.target, 'damageReduction');
	return Math.round(amount * (1 - reduction));
}

// ─── Stage 9: clamp ──────────────────────────────────────────────────────────
function clampDamage(amount: number, _ctx: DamageContext): number {
	return Math.max(0, amount);
}

/** The ordered stage chain. New systems add a stage to this array. */
const stages: PipelineStage[] = [
	applySourceEffects,
	applyZoneBonuses,
	applyElementalMatrix,
	applyGearModifiers,
	applyDefense,
	applyCrit,
	applyTargetEffects,
	clampDamage
];

/**
 * Run a base damage amount through every pipeline stage.
 *
 * ```ts
 * const final = calculateDamage(15, { source: char, target: enemy, state });
 * ```
 */
export function calculateDamage(baseAmount: number, ctx: DamageContext): number {
	return stages.reduce((amount, stage) => stage(amount, ctx), baseAmount);
}

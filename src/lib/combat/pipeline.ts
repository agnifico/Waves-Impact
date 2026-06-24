import type { EngineState, CharacterState, EnemyState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import type { DamageTag } from '$lib/types/effect';
import { getStatModifier, getAuraModifier } from './effects';
import { chebyshev } from './board';
import type { Position } from '$lib/types';

/**
 * Context passed through every pipeline stage.
 * Stages can read anything here but should only modify `amount`.
 */
export interface DamageContext {
	source: CharacterState;
	target: EnemyState | CharacterState;
	ability?: Ability;
	element?: string;
	originZoneId?: string;
	state: EngineState;
	sourcePos?: Position;   // overrides source.pos for zone proximity checks
	/** Damage taxonomy tags for this hit. Buffs filter on these. Omit = untagged
	 *  (only unfiltered buffs apply). e.g. ['ba'], ['ability','ult'], ['creation']. */
	tags?: DamageTag[];
}

type PipelineStage = (amount: number, ctx: DamageContext) => number;

// ─── Stage 2: source effects (typed buffs, stack auras, etc.) ────────────────
function applySourceEffects(amount: number, ctx: DamageContext): number {
	// Tag resolution: explicit tags win; otherwise a hit carrying an ability is
	// ability damage by default (behaviors can set explicit tags to refine, e.g.
	// ['ability','ult'] / ['ability','zone']). BA/creation/zone set tags explicitly.
	const tags = ctx.tags ?? (ctx.ability ? (['ability'] as DamageTag[]) : undefined);
	let bonus = getStatModifier(ctx.source, 'damageBonus', { tags, state: ctx.state });

	// Cross-entity: benched party members broadcasting target:'active' auras buff
	// whoever is on field (Frosty's per-stack BA aura). Only applies to the active unit.
	const active = ctx.state.party[ctx.state.activeSlot];
	if (active && active.id === ctx.source.id) {
		bonus += getAuraModifier(ctx.state, ctx.source, 'damageBonus', tags);
	}

	return Math.round(amount * (1 + bonus));
}

// ─── Stage 3: zone bonuses ───────────────────────────────────────────────────
function applyZoneBonuses(amount: number, ctx: DamageContext): number {
	const { source, state, originZoneId } = ctx;
	let bonus = 0;
	for (const zone of state.zones) {
		if (!zone.buff?.damageBonus) continue;
		// friendly zones only (owned by a party member)
		if (!state.party.some((p) => p.id === zone.ownerId)) continue;
		// A zone's damageBonus applies if:
		//   (a) this hit originates from the zone itself, OR
		//   (b) the attacker is standing inside the zone
		const isSelf = originZoneId === zone.id;
		const inZone = chebyshev(ctx.sourcePos ?? source.pos, zone.center) <= zone.radius;
		if (!isSelf && !inZone) continue;
		bonus += zone.buff.damageBonus;
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
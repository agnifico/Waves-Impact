import type { ShieldParams } from './ability';

/**
 * A heal amount: flat, or a percentage of a chosen HP basis.
 *
 *   selfHeal: 40                              → flat 40
 *   teamHeal: { pct: 0.1 }                    → 10% of each target's MAX hp (default)
 *   selfHeal: { pct: 0.1, pctOf: 'missing' }  → 10% of the caster's MISSING hp
 *
 * pctOf:
 *   'max'     — % of maxHp           (predictable; default)
 *   'current' — % of current hp      (Genshin-style; rewards topping off)
 *   'missing' — % of (maxHp - hp)    (clutch-heal feel; scales with how hurt you are)
 */
export type HealAmount =
	| number
	| { pct: number; pctOf?: 'max' | 'current' | 'missing' };

/**
 * The four shared resources — damage, heal, shield, energy (+ stack grant) — that
 * appear in BOTH Delivery and OnHit with identical shape.
 *
 *   • In `Delivery`  → the GUARANTEED FLOOR. Granted on cast, whether or not
 *                      anything is hit. (A healer's cast-time heal still lands
 *                      when her ability whiffs into empty air.)
 *   • In `OnHit`     → the PER-CONNECT BONUS. Granted once per enemy struck,
 *                      ON TOP OF the floor.
 *
 * The engine adds the two: total = delivery floor + Σ(per-hit bonus per target).
 * Every field optional — presence is opt-in per entity.
 */
export interface ResourcePayload {
	/** Damage dealt. In Delivery this is the primary hit; in OnHit it's bonus per target. */
	damage?: number;

	/** Heal to the caster. */
	selfHeal?: HealAmount;

	/** Heal to the caster's whole party. */
	teamHeal?: HealAmount;

	/** Shield granted (routes through grantShield — see effects.ts). */
	shield?: ShieldParams;

	/** Energy granted to the owner/caster. */
	energyGain?: number;

	/** Stack type granted to the owner/caster (e.g. 'eclipse', 'gale'). */
	grantsStack?: string;
}
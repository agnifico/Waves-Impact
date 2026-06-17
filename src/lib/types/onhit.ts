import type { ResourcePayload } from './resource';

/**
 * Splash: when a hit lands, also strike tiles around the primary target.
 *
 *   splash: { radius: 2 }                          → 2-tile Chebyshev splash, full dmg, no extra effects
 *   splash: { radius: 2, falloff: 0.5 }            → splashed targets take 50% of the bonus damage
 *   splash: { radius: 1, includeEffects: true }    → splashed targets ALSO get stun/effects/sustain triggers
 *   splash: { radius: 2, includesPrimary: true }   → primary tile is re-counted in the splash set
 */
export interface Splash {
	/** Chebyshev radius around the primary hit tile. */
	radius: number;
	/** Damage multiplier for splashed (non-primary) targets. Default 1 (no falloff). */
	falloff?: number;
	/** If true, the primary target is also included in the splash pass. Default false
	 *  (the primary already took its full hit; this avoids double-counting). */
	includesPrimary?: boolean;
	/** If true, splashed targets also receive the OnHit's CC + trigger its per-target
	 *  sustain (stun, appliesEffects, lifesteal-per-target). Default false: splash is
	 *  damage-only. This is the switch for a "heal-per-enemy-hit" bruiser. */
	includeEffects?: boolean;
}

/**
 * OnHit — everything that happens PER ENEMY STRUCK, on top of the Delivery floor.
 *
 * Embeds ResourcePayload (the per-connect bonus copy of damage/heal/shield/energy/stack)
 * and adds the target-side concerns that only make sense when something is actually hit:
 * splash, knockback, stun, applied effects, lifesteal.
 *
 * Fired once per target per hit. A multi-hit delivery (Delivery.hits > 1) fires the
 * full OnHit for each hit — multi-hit is intentionally resource-rich.
 */
export interface OnHit extends ResourcePayload {
	// ── damage shaping ──────────────────────────────────────────────
	splash?: Splash;
	knockback?: number;        // tiles the struck enemy is pushed from the hit source
	knockbackSmart?: boolean;  // push toward nearest OTHER enemy (combo setup) instead of away
	poiseDamage?: number;

	// ── crowd control ───────────────────────────────────────────────
	stunMs?: number;
	appliesEffects?: string[]; // effect ids applied to the struck target

	// ── sustain that requires a connect ─────────────────────────────
	/** Heal the caster for this % of damage actually dealt. Always %-of-damage,
	 *  so it's OnHit-only (no damage to steal on a whiff). e.g. 8 = 8%. */
	lifestealPct?: number;

	// ── miss handling (the only survivor of on-miss logic) ──────────
	/** If the cast connects with nothing, refund its cooldown / charge so a
	 *  whiffed high-CD skill isn't fully punished. Default false. */
	refundOnMiss?: boolean;
}
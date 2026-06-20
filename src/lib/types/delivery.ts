import type { ResourcePayload } from './resource';
import type { ShapeId, ShapeParams, HoldBehavior } from './ability';
import type { Stratum } from './common';

/**
 * Delivery — HOW an action is aimed, shaped, and timed, plus the GUARANTEED
 * resource floor it grants on cast.
 *
 * Embedded by both `Ability` and `BasicAttack`. The two share this completely:
 * a BA can charge (Delivery.holdBehavior) just as an ability can, and an ability's
 * primary damage is simply `delivery.damage` (the cast-time floor).
 *
 * Embeds ResourcePayload — here it means the GUARANTEED grant: damage/heal/shield/
 * energy/stack the caster gets for pressing the button, whether or not anything
 * is hit. Per-connect bonuses live in OnHit instead.
 *
 * NOTE: constructs/summons do NOT use Delivery — they don't aim or charge. They
 * carry their own placement/lifecycle fields on CreationDef and use OnHit for their
 * pulse/attack consequences.
 */
export interface Delivery extends ResourcePayload {
	// ── geometry ────────────────────────────────────────────────────
	shape?: ShapeId;
	shapeParams?: ShapeParams;
	/** Strata this action can hit. Omit = hits all strata. (Renamed from the old
	 *  `hits: Stratum[]` to free up `hits` for the multi-hit COUNT below.) */
	hitsStrata?: Stratum[];

	// ── multi-hit (visual variation; each hit fires the full OnHit) ──
	/** Number of discrete hits this delivery produces. Default 1. A 3-hit flurry
	 *  dealing 5+5+5 reads differently from one 15 and is resource-rich: each hit
	 *  fires OnHit, so energy/lifesteal/stacks all trigger per hit. */
	hits?: number;

	// ── targeting ───────────────────────────────────────────────────
	autoTargetEnemy?: boolean;
	allowSelfTarget?: boolean;

	// ── hold / aim / charge (shared with BA now) ────────────────────
	holdBehavior?: HoldBehavior;
	aimRange?: number;
	chargeMaxRange?: number;
	chargeMsPerTile?: number;

	/** Committed wind-up: ms the cast charges before resolving. The gem plays a
	 *  charge/pull-back telegraph during this window; the behavior fires when it
	 *  elapses. Cannot be cancelled. Omit = instant. For heavy/nuke abilities. */
	windUpMs?: number;
	/** Which fx-wu-* gem animation plays during the wind-up. Default 'charge'. */
	windUpStyle?: 'charge' | 'melee' | 'ranged' | 'pistol' | 'bow' | 'fire';
}
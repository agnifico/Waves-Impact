import type { Stratum } from './common';
import type { Delivery } from './delivery';
import type { OnHit } from './onhit';

// ─── Shape / Behavior / Hold ─────────────────────────────────────────────────

/**
 * Shape = pure geometry. Maps (casterPos, direction, shapeParams) → tiles.
 * Shapes know nothing about damage, effects, or resolution. (Data Contract §2, §7)
 */
export type ShapeId =
	| 'line'
	| 'wide_line'
	| 'pcone'
	| 'pcone_inverted'
	| 'tcone'
	| 'tcone_inverted'
	| 'circle'
	| 'perpendicular_line'
	| 'circle_follows_caster'
	| 'melee'
	| 'footprint'
	| (string & {}); // extensible

/**
 * Behavior = resolution class. Handles what gets damaged, statuses applied,
 * state changed. (Data Contract §2, §6)
 */
export type BehaviorId =
	| 'damage_aoe'
	| 'damage_first_in_line'
	| 'summon'
	| 'construct'
	| 'multi_construct'
	| 'tactical_detonate'
	| 'dash'
	| 'zone'
	| 'channel_beam'
	| 'chain'
	| 'displace'
	| 'marker'
	| (string & {}); // extensible

/** Hold modifier — orthogonal to behavior. (Data Contract §5.1) */
export type HoldBehavior = 'aim' | 'charge' | 'channel' | 'track' | 'aim_dir';

/** Ability slot keys. */
export type AbilitySlot = 'X' | 'C' | 'V';

// ─── Sub-interfaces ───────────────────────────────────────────────────────────

/** Periodic buff / damage applied by a zone tile. (behavior === 'zone')
 *  NOTE: ZoneBuff is a THIRD payload kind — a continuous per-tick field, distinct
 *  from Delivery (per-cast) and OnHit (per-connect). Intentionally NOT unified. */
export interface ZoneBuff {
	tickMs: number;
	healPerTick?: number;
	activeBonusHeal?: number;
	dmgPerTick?: number;
	damageBonus?: number;
	ownerEnergyDrainPerTick?: number;
	upkeepReductionPerStack?: number;
	/** Pull enemies within the zone toward its center each tick (Sefyra's Venti vortex). */
	gatherPerTick?: { steps: number };
}

export interface ShapeParams {
	range?: number;
	radius?: number;
	width?: number;
	dir?: 'forward' | 'back' | 'away' | 'toward';
	tiles?: number;
	throughObstacles?: boolean;
	iframesMs?: number;
	blastDamage?: number;
	blastRadius?: number;
	[key: string]: number | string | boolean | undefined; // extensible
}

/** Shield granted on cast — drained by absorbDamage. */
export interface ShieldParams {
	amount: number;
	target?: 'self' | 'party';  // default 'self'
	durationMs?: number;         // default -1 (until depleted)
	maxTotal?: number;           // pool cap for stacking re-casts
	effectId?: string;           // named shield for independent tracking
}

// ─── Ability ─────────────────────────────────────────────────────────────────

/**
 * Full ability definition.
 *
 * An ability is now assembled from two shared payloads plus its own delivery
 * geometry and cast economy:
 *
 *   • `delivery`  — HOW it's aimed/shaped/charged + the GUARANTEED resource floor
 *                   (damage/heal/shield/energy granted on cast regardless of hits).
 *                   The ability's primary damage is `delivery.damage`.
 *   • `onHit`     — what additionally happens PER ENEMY STRUCK (splash, knockback,
 *                   stun, per-hit energy/heal/stack, lifesteal).
 *
 * Top-level fields below are the things that are NEITHER delivery nor on-hit:
 * behavior dispatch, cast economy (cooldown/charges/energyCost), creation refs,
 * zone/gather sub-behaviors, and lifecycle.
 *
 * Most fields optional — presence depends on behavior. (Data Contract §5)
 */
export interface Ability {
	id: string;
	name: string;
	behavior: BehaviorId;
	description?: string;

	/** How it's delivered + the guaranteed cast-time floor. */
	delivery?: Delivery;
	/** Per-connect bonus + target-side effects. */
	onHit?: OnHit;

	// ── Cast economy (neither delivery nor on-hit) ──────────────────
	cooldownMs?: number;
	charges?: number;       // >1 → multi-charge; omit/1 = single cooldown
	rechargeMs?: number;    // per-charge regen time; defaults to cooldownMs
	energyCost?: number;
	unchainedBonus?: number; // legacy: consumed-Unchained damage bump (de-hardcode later)

	// ── Lifecycle ───────────────────────────────────────────────────
	durationMs?: number;
	persistsAfterDeath?: boolean;   // zone: keep ticking after owner dies

	// ── Caster movement / control sub-behaviors ─────────────────────
	gather?: { radius: number; steps: number }; // pull enemies toward caster

	// ── Sub-behaviors ───────────────────────────────────────────────
	zoneBuff?: ZoneBuff;
	zoneFollows?: 'caster' | 'fixed' | 'active';

	creationId?: string;                       // registry key into data/creations.ts
	multiConstructOffsets?: { x: number; y: number }[]; // multi_construct placement

	// Visual
	fx?: FxSpec;
}

// ─── FX ──────────────────────────────────────────────────────────────────────

export interface FxSpec {
	strike?:
		| 'swipe' | 'reverseswipe' | 'claw' | 'stab' | 'flurry' | 'slam' | 'uppercut'
		| 'projectile' | 'bullet' | 'beam' | 'chain' | 'stream'
		| 'zone';
	zone?: string;
	shape?: 'bolt' | 'arrow' | 'orb' | 'leaf' | 'wave';
	size?: 's' | 'm' | 'l';
	trail?: boolean;
	speed?: number;
	colors?: string[];
	gashes?: number;
	hits?: number;
	skin?:
		| 'default' | 'mecha' | 'flame' | 'wind' | 'void' | 'water'
		| 'slashes' | 'pulse' | 'earth' | 'poison' | 'frost' | 'holy' | 'storm';
}
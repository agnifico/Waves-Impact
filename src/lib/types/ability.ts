import type { Vector } from './common';

/**
 * Shape = pure geometry. A function from (casterPos, direction, shapeParams) → tiles.
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
	| (string & {}); // extensible

/**
 * Behavior = resolution class. An engine handler that knows how to resolve
 * an ability — what gets damaged, statuses applied, state changed. (Data Contract §2, §6)
 */
export type BehaviorId =
	| 'damage_aoe'
	| 'damage_first_in_line'
	| 'summon'
	| 'construct'
	| 'dash'
	| 'zone'
	| 'channel_beam'
	| 'chain'
	| 'displace'
	| 'marker'
	| (string & {}); // extensible

/** Hold modifier orthogonal to behavior. (Data Contract §5.1) */
export type HoldBehavior = 'aim' | 'charge' | 'channel' | 'track' | 'aim_dir';


/** Ability slot keys on a character's kit. */
export type AbilitySlot = 'X' | 'C' | 'V';

/** Periodic buff applied by a zone. */
export interface ZoneBuff {
	damageBonus?: number;
	healPerTick?: number;
	activeBonusHeal?: number;
	tickMs: number;
	/** Damage dealt to each enemy inside the zone per tick. */
	dmgPerTick?: number;          // ← NEW (Ryoma, Maria Elena V)
	/** Energy drained from the zone owner per tick. Zone self-destructs at 0. */
	ownerEnergyDrainPerTick?: number;  // ← NEW (Maria Elena V)
	upkeepReductionPerStack?: number;
}



export interface ShapeParams {
	// geometry
	range?: number;
	radius?: number;
	width?: number;
	// directional dash / travel (movement.ts + behaviors/dash.ts)
	dir?: 'forward' | 'back' | 'away' | 'toward';
	tiles?: number;
	throughObstacles?: boolean;
	iframesMs?: number;
	// terminal blast (dash stop-point detonation)
	blastDamage?: number;
	blastRadius?: number;
	// escape hatch so new shapes don't need a type edit each time
	[key: string]: number | string | boolean | undefined;
}

/**
 * Full ability definition. Most fields are optional — presence depends
 * on behavior. (Data Contract §5)
 */
export interface Ability {
	id: string;
	name: string;

	// The shape/behavior split (Data Contract §2)
	behavior: BehaviorId;
	shape?: ShapeId;
	shapeParams?: ShapeParams;
	description?: string;
	// Effect parameters
	damage?: number;
	poiseDamage?: number;
	cooldownMs?: number;
	charges?: number;     // >1 → multi-charge ability; omitted/1 = normal single cooldown
	rechargeMs?: number;  // per-charge regen time; defaults to cooldownMs
	energyCost?: number;
	energyGain?: number;
	stunMs?: number;
	knockback?: number;
	selfHeal?: number;
	durationMs?: number;
	unchainedBonus?: number;
	appliesEffects?: string[];

	teamHeal?: number;                            // flat whole-party heal
	gather?: { radius: number; steps: number };   // pull enemies within radius toward caster

	/** Grant a shield on cast (drained by absorbDamage). Any ability can use this. */
	shield?: {
		amount: number;
		target?: 'self' | 'party';   // default 'self'
		durationMs?: number;         // default -1 (until depleted)
		maxTotal?: number;           // optional pool cap (for stacking re-casts)
		effectId?: string;           // optional, for an independent named shield
	};

	// Targeting flags
	autoTargetEnemy?: boolean;
	allowSelfTarget?: boolean;

	// Stack interaction
	grantsStack?: string;

	// Hold modifier (Data Contract §5.1)
	holdBehavior?: HoldBehavior;
	chargeMaxRange?: number;
	chargeMsPerTile?: number;

	// Zone parameters (behavior === 'zone')
	zoneBuff?: ZoneBuff;
	zoneFollows?: 'caster' | 'fixed' | 'active';

	// Summon parameters (behavior === 'summon')
	summonId?: string;
	summonDurationMs?: number;
	summonImage?: string;

	// Construct parameters (behavior === 'construct')
	constructPulseDmg?: number;    // damage per pulse
	constructPulseMs?: number;     // ms between pulses
	constructPulseRadius?: number; // Chebyshev radius
	constructStunMs?: number;      // stun duration on hit (ms)

	// Visual
	impactClass?: string;

	/** Strata this ability can hit. Omitted = all. */
	hits?: import('./common').Stratum[];
	fx?: FxSpec;

}

export interface FxSpec {
	strike?: 'projectile' | 'swipe';
	shape?: 'orb' | 'arrow' | 'leaf' | 'bolt' | 'wave';
	size?: 's' | 'm' | 'l';
	trail?: boolean;
	speed?: number;     // ms per tile of travel (lower = faster; the snipe is low)
	colors?: string[];  // ramp; defaults to the character theme
}

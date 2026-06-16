import type { Stratum } from './common';

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
    | 'multi_construct'   // ← ADD
    | 'dash'
    | 'zone'
    | 'channel_beam'
    | 'chain'
    | 'displace'
    | 'marker'
    | (string & {});

/** Hold modifier — orthogonal to behavior. (Data Contract §5.1) */
export type HoldBehavior = 'aim' | 'charge' | 'channel' | 'track' | 'aim_dir';

/** Ability slot keys. */
export type AbilitySlot = 'X' | 'C' | 'V';

// ─── Sub-interfaces ───────────────────────────────────────────────────────────

/** Periodic buff / damage applied by a zone tile. (behavior === 'zone') */
export interface ZoneBuff {
	tickMs: number;
	healPerTick?: number;
	activeBonusHeal?: number;
	dmgPerTick?: number;
	damageBonus?: number;
	ownerEnergyDrainPerTick?: number;
	upkeepReductionPerStack?: number;
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
 * Full ability definition. Most fields are optional — presence depends on
 * behavior. (Data Contract §5)
 */
export interface Ability {
	id: string;
	name: string;
	behavior: BehaviorId;
	shape?: ShapeId;
	shapeParams?: ShapeParams;
	description?: string;

	// Core effect params
	damage?: number;
	poiseDamage?: number;
	cooldownMs?: number;
	charges?: number;       // >1 → multi-charge; omit/1 = single cooldown
	rechargeMs?: number;    // per-charge regen time; defaults to cooldownMs
	energyCost?: number;
	energyGain?: number;
	stunMs?: number;
	knockback?: number;
	selfHeal?: number;
	teamHeal?: number;
	durationMs?: number;
	unchainedBonus?: number;
	appliesEffects?: string[];
	persistsAfterDeath?: boolean;   // zone: keep ticking after owner dies
	aimRange?: number;

	gather?: { radius: number; steps: number }; // pull enemies toward caster

	// Targeting
	autoTargetEnemy?: boolean;
	allowSelfTarget?: boolean;

	// Stack interaction
	grantsStack?: string;

	// Hold modifier (Data Contract §5.1)
	holdBehavior?: HoldBehavior;
	chargeMaxRange?: number;
	chargeMsPerTile?: number;

	// Sub-behaviors
	shield?:   ShieldParams;
	zoneBuff?: ZoneBuff;
	zoneFollows?: 'caster' | 'fixed' | 'active';

	creationId?: string;   // registry key into data/creations.ts
	multiConstructOffsets?: { x: number; y: number }[];
	// Visual
	impactClass?: string;
	hits?: Stratum[];  // strata this ability can hit; omit = all
	fx?: FxSpec;
}

// ─── FX ──────────────────────────────────────────────────────────────────────

export interface FxSpec {
	strike?:
		| 'swipe' | 'reverseswipe' | 'claw' | 'stab' | 'flurry' | 'slam' | 'uppercut'
		| 'projectile' | 'bullet' | 'beam' | 'chain'
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
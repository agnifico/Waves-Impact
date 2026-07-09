import type { Vector } from './common';
import type { Delivery } from './delivery';
import type { OnHit } from './onhit';
import type { CoordAttackConfig } from './effect';

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
NOTE: ZoneBuff is a continuous per-tick field, distinct in shape from Delivery
(per-cast) and OnHit (per-connect) — it has no caster/aim, just a radius that
ticks. But the DAMAGE half of a tick (dmgPerTick) is still "an enemy got hit",
so it routes through the same OnHit payload everything else uses: set
`onHit.energyGain` / `grantsStack` / `splash` / etc. and a zone's damage tick
awards the owner exactly like a BA, ability, summon, or construct pulse does.
Heal/drain/gather stay zone-only fields below — no enemy is struck for those. */

export interface ZoneBuff {
	/** Tick interval ms. Omit for zones that have no periodic effect (e.g. pure-reactive). */
	tickMs?: number;
	healPerTick?: number;
	activeBonusHeal?: number;
	dmgPerTick?: number;
	damageBonus?: number;
	/** Per-connect consequences of dmgPerTick — energyGain/grantsStack/splash/stun/
	lifestealPct/appliesEffects, same payload abilities and creations use.
	Ignored if dmgPerTick is unset or zero. */
	onHit?: OnHit;
	ownerEnergyDrainPerTick?: number;
	upkeepReductionPerStack?: number;
	/** Pull enemies within the zone toward its center each tick (Sefyra's Venti vortex). */
	gatherPerTick?: { steps: number };
	/**
	 * Albedo-style reactive config: any damage dealt to an enemy inside this zone
	 * also fires a fixed hit from the zone owner (per-enemy cooldown).
	 */
	reactive?: { dmg: number; cooldownMs: number };
}

/** Passed to coord_attack_grant behavior — grants a CA effect to self or whole party. */
export interface CoordAttackGrant {
	targets: 'self' | 'party';
	durationMs: number;
	/** Registry effect id for the granted buff. Defaults to 'party_ca'. */
	effectId?: string;
	config: CoordAttackConfig;
}

/** Passed to coord_attack_stance behavior — activates the caster's personal CA stance. */
export interface CoordAttackStance {
	baseDurationMs: number;
	/** Added ms per pending CA stack consumed on activation. */
	stacksPerExtendMs: number;
	/** Max stacks that can be buffered; reaching max sets the 50% dmg bonus flag. */
	stackMax: number;
	/** Registry effect id for the stance buff. Defaults to 'ca_stance'. */
	effectId?: string;
	config: CoordAttackConfig;
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

	/** coord_attack_grant behavior: grant a CA buff to self or party on cast. */
	caGrant?: CoordAttackGrant;
	/** coord_attack_stance behavior: activate the caster's personal CA stance. */
	caStance?: CoordAttackStance;

	creationId?: string;                       // registry key into data/creations.ts
	multiConstructOffsets?: { x: number; y: number }[]; // multi_construct placement

	// Visual
	fx?: FxSpec;
}

// ─── FX ──────────────────────────────────────────────────────────────────────

/**
 * Runtime opts passed from the input layer to behavior handlers at cast time.
 * Behaviors read only the fields they need — unused fields are safely ignored.
 * Defined here (not in ability-resolver.ts) so behaviors can import it without
 * creating a circular dependency through the resolver.
 */
export interface AbilityOpts {
	reticle?: { x: number; y: number } | null; // aimed tile (holdBehavior:'aim')
	chargedRange?: number;                      // held charge distance (holdBehavior:'charge')
	aimDir?: Vector;                            // explicit direction (holdBehavior:'aim_dir')
	tier?: number;                              // hold-time tier (cloudpiercer)
	lockedTargetId?: string;                    // currently locked enemy id
	selfTarget?: boolean;                       // self-targeting flag
}

export interface FxSpec {
	// ── strike kind ─────────────────────────────────────────────────────────────
	// Melee / impact
	strike?:
		| 'swipe' | 'reverseswipe' | 'claw' | 'stab' | 'flurry' | 'slam' | 'uppercut'
	// Ranged / projectile
		| 'projectile' | 'bullet' | 'beam' | 'chain' | 'stream'
	// Special / elemental
		| 'seeker' | 'splash' | 'bloom'
	// Environmental / supernatural
		| 'smite' | 'mortar' | 'laserarc'
	// Zone pulse
		| 'zone';

	// ── cast-shape tile class override ──────────────────────────────────────────
	/** Override the default casttiles CSS class. Built-ins: 'fx-cast-line' |
	 *  'fx-cast-pcone' | 'fx-cast-circle' | 'fx-cast-wave'. Pass any custom class. */
	castCls?: string;

	// ── zone skin ───────────────────────────────────────────────────────────────
	zone?: string;
	skin?:
		| 'default' | 'mecha' | 'flame' | 'wind' | 'void' | 'water'
		| 'slashes' | 'pulse' | 'earth' | 'poison' | 'frost' | 'holy' | 'storm';

	// ── projectile shape & motion ────────────────────────────────────────────────
	/** Visual shape of the projectile. */
	shape?: 'bolt' | 'arrow' | 'orb' | 'leaf' | 'wave';
	/** Size of the projectile: s / m / l. */
	size?: 's' | 'm' | 'l';
	/** Pixels per ms travel speed (projectile). Lower = slower. Default 40. */
	speed?: number;
	/** Enable motion trail on projectile. */
	trail?: boolean;

	// ── multi-shot / beam volley ─────────────────────────────────────────────────
	/** 'single' (default, 1 shot) | 'double' (2, slight spread) | 'flurry' (~5 fanned). */
	volley?: 'single' | 'double' | 'flurry';

	// ── seeker-specific ──────────────────────────────────────────────────────────
	/** Number of seeker bullets. Default 3. */
	bullets?: number;
	/** Where seekers arc in from.
	 *  'left' | 'right' | 'both' — launch from caster, arc in from that flank.
	 *  true — legacy alias for 'right'.
	 *  false / omit — converge from random flanks (each cast unique). */
	fromCaster?: boolean | 'left' | 'right' | 'both';

	// ── laserarc-specific ────────────────────────────────────────────────────────
	/** Which side the arc swings from. Omit = random each cast. */
	side?: 'left' | 'right';

	// ── melee-specific ──────────────────────────────────────────────────────────
	/** Number of claw gashes (claw strike). Default 3. */
	gashes?: number;
	/** Explicit hit count (flurry strike, beam double-burst, etc.). */
	hits?: number;

	// ── tint ────────────────────────────────────────────────────────────────────
	/** [primary, secondary] colour override. Falls back to character theme ramp. */
	colors?: string[];
}
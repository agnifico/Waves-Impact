import type { Element, Guard, Position, Stratum, Terrain } from './common';
import type { Ability, AbilitySlot, FxSpec } from './ability';
import type { Delivery } from './delivery';
import type { OnHit } from './onhit';

/**
 * A single hit in a basic-attack chain. (Data Contract §4.1)
 *
 * Like Ability, a BasicAttack is now assembled from the two shared payloads:
 *
 *   • `delivery` — shape/aim/charge + the guaranteed cast-time floor. The BA's
 *                  primary damage is `delivery.damage`; its baseline energy is
 *                  `delivery.energyGain`.
 *   • `onHit`    — per-connect bonus + target-side effects (splash, knockback,
 *                  stun, lifesteal, per-hit energy/heal/stack). This is what
 *                  finally lets a BA shield-on-hit, splash, or lifesteal.
 *
 * Top-level fields are BA-only: combo mechanics (stack consume, gap-close,
 * dash-back), the chain-advance gate, and `range` (the BA's reach, kept flat
 * because the engine's target-acquisition reads it on the hot path).
 */
export interface BasicAttack {
	name: string;
	description?: string;

	/** Reach (Chebyshev). Kept flat — acquireTarget reads it directly. */
	range: number;

	/** Geometry + guaranteed floor (damage, energy, etc.). */
	delivery?: Delivery;
	/** Per-connect bonus + target effects. */
	onHit?: OnHit;

	// ── targeting / chain flow (BA-only) ────────────────────────────
	omniTarget?: boolean;
	advanceOnlyIfMelee?: boolean;

	// ── combo mechanics (BA-only) ───────────────────────────────────
	consumesStack?: string;   // BA finisher: stack type to spend
	consumeBonus?: number;    // bonus damage when a stack is consumed
	gapClose?: boolean;       // close to the target before striking
	dashBack?: number;        // retreat N tiles after the hit

	fx?: FxSpec;
}

export type EnhancedCondition =
	| { type: 'stacks_min'; n: number }
	| { type: 'stacks_exact'; n: number }
	| { type: 'post_ability'; windowMs: number }
	| { type: 'post_hit'; windowMs: number }
	| { type: 'post_dash'; windowMs: number }
	| { type: 'chain_finisher' }
	| { type: 'energy_threshold'; pct: number };   // 0–1

/**
 * Contextual basic: variant selected by character state. (Data Contract §4.2)
 * Two variants today; could evolve to N-way.
 */
export interface ContextualBasic {
	base: BasicAttack;
	withStack: BasicAttack & {
		consumesStack: string;
		dashBack?: number;
	};
	fx?: FxSpec;
	selectBy?: 'stacks' | 'hold';
}

/**
 * Full character definition. The "recipe" the engine reads.
 * Adding a new character is a data-file change, not new code. (Data Contract §1, §3)
 */
export interface Character {
	id: string;
	name: string;
	element: Element;

	maxHp: number;
	maxEnergy: number;
	moveMs?: number;

	description?: string;
	hints?: string[];

	baCooldownMs: number | number[]; // single, or per-chain-step (gates firing step i)
	baChainResetMs: number;

	// Basic-attack style — exactly one of chain or contextual
	basicStyle: 'chain' | 'contextual';
	basicChain?: BasicAttack[];
	contextualBasic?: ContextualBasic;

	abilities: Record<AbilitySlot, Ability>;

	// Stack system (Data Contract §9)
	stackType: string;
	stackName: string;
	stackMax: number;
	onStackFull: string; // EffectId to apply when stacks reach max
	onStackFullTarget?: 'self' | 'party'; // who receives the effect (default: 'self')
	/** Own-cast stack cap (self-grants stop here; external grants can still reach stackMax). */
	selfStackCap?: number;
	/** Per-stack threshold effects: each entry applies effectId while stacks >= minStacks. */
	stackEffects?: { effectId: string; minStacks: number }[];
	/** If set, stacks decay to 0 when this many ms pass without a new stack being granted. */
	stackDecayMs?: number;

	// Poise (Data Contract §15.6)
	maxPoise?: number;
	poiseRegenPerSec?: number;

	// Swap-in / swap-out skills (future: Forte/Intro/Outro)
	introSkill?: Ability;
	outroSkill?: Ability;

	enhancedBasic?: {
		ba: BasicAttack;                  // same shape as basicChain entries
		conditions: EnhancedCondition[];  // OR logic — any one true = available
		requireHold?: boolean;            // default false. true = must hold even when available
		interruptsChain?: boolean;        // default true. false = only fires at last chain step
	};

	/**
	 * Channel basic (hold-to-fire sustained stream — Carla's Stream Buffer).
	 * Held BA enters a channel firing every `intervalMs`, draining one stack every
	 * `drainPerStackMs` (1 stack = 1 second of fire). Auto-targets nearest; sputters
	 * without fuel or target. Tapping still fires the normal chain.
	 */
	channelBasic?: {
		name: string;
		intervalMs: number;        // time between shots (e.g. 250 = 4/sec)
		drainPerStackMs: number;   // ms of fire per stack (e.g. 1000 = 1 stack/sec)
		range: number;
		delivery?: Delivery;       // damage + hitsStrata per shot
		onHit?: OnHit;             // per-shot effects (e.g. refresh the mark)
		fx?: FxSpec;
	};

	offFieldStackBonus?: number; // ×multiplier on off-field energy while holding stacks - Sefyra

	/** Arch 3 CA: this character gains 1 pending CA stack whenever any party member uses V. */
	caPendingStackOnPartyV?: boolean;
	/** Maximum pending CA stacks that can be buffered (reaching max sets the 50% dmg bonus). */
	caPendingStackMax?: number;

	art?: {
		gem: string;
		profile: string;
		poster: string;
		bannerPoster?: string;
	};
	theme?: CharacterTheme;

	stratum?: Stratum;      // default 'ground'
	traversal?: Terrain[];  // terrain override; default derived from stratum
	guard?: Guard;          // default 'front'
	footprint?: Position[]; // tile offsets for multi-tile; default 1×1
	/** Unit can walk onto tiles occupied by same-stratum constructs. */
	ignoresConstructs?: boolean;
}

export interface CharacterTheme {
	/** Identity color: name, active border, default glow, facing arrow. */
	primary?: string;
	secondary?: string;
	/** Bar fills — any CSS value (color, gradient, url()). Default to globals. */
	hp?: string;
	energy?: string;
	/** Extra resource bars (forte/stacks). */
	resources?: { id: string; fill: string; label?: string }[];
	/** Named glow colors for ability-button states. */
	glow?: Record<string, string>;
	/** CSS class for this character's signature ambient gem effect (applied to the
	 *  player gem while on field). One bespoke flourish per unit; fill in over time. */
	signatureFx?: string;
	/** CSS class suffix applied to the HP bar fill for character-specific visual treatments.
	 *  e.g. 'cryo' → crystalline facet overlay, 'solar' → leading-edge bloom pulse. */
	hpStyle?: string;
	/** Custom pip shape + colors for the stack tracker in the Unit Banner. */
	pip?: {
		/** CSS class suffix: 'crystal' (ice shard), 'circuit' (power cell), etc. */
		shape?: string;
		/** Fill color for filled pips. Defaults to --char-primary. */
		color?: string;
		/** Glow color for filled pips. Defaults to --char-glow. */
		glow?: string;
	};
}
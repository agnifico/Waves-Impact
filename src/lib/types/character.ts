import type { Element, Guard, Position, Stratum, Terrain } from './common';
import type { Ability, AbilitySlot, FxSpec, ShapeId } from './ability';

/**
 * A single hit in a basic-attack chain. (Data Contract §4.1)
 */
export interface BasicAttack {
	name: string;
	damage: number;
	description?: string;
	shape: ShapeId;
	shapeParams?: Record<string, number>;
	range: number;
	energyGain: number;
	poiseDamage?: number;
	omniTarget?: boolean;
	advanceOnlyIfMelee?: boolean;
	grantsStack?: string;
	appliesEffects?: string[];
	hits?: Stratum[];
	// in BasicAttack
	consumesStack?: string;   // BA3: stack type to spend
	consumeBonus?: number;    // bonus damage when a stack is consumed
	teamHeal?: number;        // heal applied to the whole party when consumed
	fx?: FxSpec;
	dashBack?: number;
	gapClose?: boolean;
}

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

	// Poise (Data Contract §15.6)
	maxPoise?: number;
	poiseRegenPerSec?: number;

	// Swap-in / swap-out skills (future: Forte/Intro/Outro)
	introSkill?: Ability;
	outroSkill?: Ability;

	// in Character
	offFieldStackBonus?: number; // ×multiplier on off-field energy while holding stacks - Sefyra

	art?: {
		gem: string;
		profile: string;
		poster: string;
	};
	theme?: CharacterTheme;

	stratum?: Stratum;      // default 'ground'
	traversal?: Terrain[];  // terrain override; default derived from stratum
	guard?: Guard;          // default 'front'
	footprint?: Position[]; // tile offsets for multi-tile; default 1×1

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
}

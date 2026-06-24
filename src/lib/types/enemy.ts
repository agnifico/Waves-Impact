import type { Element, Guard, Position, Stratum, Terrain } from './common';
import type { FxSpec, ShapeId } from './ability';

/**
 * A single attack in an enemy's kit. (Data Contract §17)
 */
export interface EnemyAttack {
	id: string;
	name: string;
	range: number;
	shape?: ShapeId;
	shapeParams?: Record<string, number>;
	damage: number;
	poiseDamage?: number;
	cooldownMs: number;
	priority: number;
	appliesEffects?: string[];
	stunMs?: number;
	telegraphMs?: number;
	hits?: Stratum[];
	knockback?: number;         // tiles to push the active character on hit
	knockbackSmart?: boolean;   // push toward nearest other enemy instead of away
	/** Leap adjacent to the target as part of this attack (per-attack, so a lunge
	 *  can leap while the same enemy's other attacks don't). */
	gapClose?: boolean;
	/** Max Chebyshev distance the leap triggers from; beyond it the enemy approaches
	 *  normally. Omit = leap from any distance the attack is otherwise ready. */
	gapCloseRange?: number;
	windUpMs?: number;
	windUpStyle?: 'charge' | 'melee' | 'ranged' | 'pistol' | 'bow' | 'fire';
	fx?: FxSpec;
}

/**
 * Full enemy definition. (Data Contract §17)
 * aiPattern dispatches to an engine AI module.
 */
export interface Enemy {
	id: string;
	name: string;
	element: Element;
	maxHp: number;
	maxPoise?: number;
	canMoveDiagonal: boolean;
	moveTickMs: number;
	moveResumeAfterPlayerFleeMs: number;
	aiPattern:
	| 'melee_rush'
	| 'flanker'
	| 'ranged_kiter'
	| 'tank_blocker';
	attacks: EnemyAttack[];
	stratum?: Stratum;      // default 'ground'
	traversal?: Terrain[];  // terrain override; default derived from stratum
	guard?: Guard;          // default 'front'
	footprint?: Position[]; // tile offsets for multi-tile; default 1×1
	profileImage?: string;
	ignoresSummons?: boolean;
}
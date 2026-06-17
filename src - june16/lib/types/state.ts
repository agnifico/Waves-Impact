import type { Position, Vector, EntityId, Stratum } from './common';
import type { Character } from './character';
import type { Enemy } from './enemy';
import type { EffectInstance } from './effect';
import type { ZoneBuff, AbilitySlot } from './ability';

/**
 * The combat board. Obstacles block movement, dashes, and knockback. (Data Contract §14)
 */
export interface Board {
	size: { width: number; height: number };
	obstacles: Position[];
	water?: Position[];
}

/**
 * Runtime state for one player character. (Data Contract §16)
 */
export interface CharacterState {
	id: string;
	def: Character;
	hp: number;
	energy: number;
	pos: Position;
	facing: Vector;

	stacks: { current: number };
	activeEffects: Record<string, EffectInstance>;

	baChainIndex: number;
	lastBaIndexLanded: number;
	lastBaTimestamp: number;
	lastActionTimestamp: number;

	stunnedUntil: number;
	cooldowns: Record<AbilitySlot, number>;

	poise: number;
	stratum: Stratum;
	lastAction?: { tag: string; at: number };
	charges: Partial<Record<AbilitySlot, { count: number; rechargeAt: number }>>;
	lastHitAt?: number;
}

/**
 * Runtime state for one enemy. (Data Contract §16)
 * state.enemies is an array — multi-target from day one. (§15.1)
 */
export interface EnemyState {
	id: string;
	def: Enemy;
	pos: Position;
	hp: number;
	nextMoveAt: number;
	attackCooldowns: Record<string, number>;
	lastPlayerPos: Position;
	stunnedUntil: number;
	activeEffects: Record<string, EffectInstance>;
	poise: number;
	facing: Vector;
	stratum: Stratum;
}

/**
 * Runtime state for a persistent zone. (Data Contract §16)
 */
export interface ZoneState {
	id: string;
	center: Position;
	follows: 'caster' | 'fixed' | 'active';
	ownerId: EntityId;
	radius: number;
	expiresAt: number;
	lastTickAt: number;
	buff: ZoneBuff;
	persistsAfterDeath?: boolean;
}

/**
 * Runtime state for a summon entity. (Data Contract §16)
 */
export interface SummonState {
	id: string;
	name?: string;
	defId: string;
	profileImage?: string;
	ownerId: EntityId;
	pos: Position;
	hp?: number;
	expiresAt: number;
	nextMoveAt: number;
	nextAttackAt: number;
	receiveBuffs?: boolean;
	stickyTargetId?: string;   // current locked target
	stickyUntil?: number;      // timestamp; don't switch before this
	element?: string;
	stratum: Stratum;
}

/**
 * Runtime state for a stationary construct entity. (distinct from SummonState)
 * Constructs are placed objects — they don't move, don't attack, but pulse
 * area effects on a timer. They are NOT summons and do not appear in
 * state.summons. (Data Contract extension)
 */
export interface ConstructState {
	id: string;
	defId: string;
	ownerId: EntityId;
	pos: Position;
	profileImage?: string;
	expiresAt: number;
	pulseDmg: number;
	pulseMs: number;
	pulseRadius: number;
	stunMs: number;
	nextPulseAt: number;
	constructType: 'inert' | 'source' | 'catalyst';
	element?: string;
	targetingType: 'pulse' | 'turret';
	name?: string;
	receiveBuffs?: boolean;
	stratum: Stratum;
}


/**
 * Top-level engine state. Everything the combat engine reads and writes. (Data Contract §16)
 * This object is wrapped in Svelte 5's $state at the route level.
 * The engine mutates it directly; Svelte reactivity handles re-renders.
 *
 * Serialization: JSON.stringify(state) works because all fields are
 * primitives, plain objects, and arrays. (§15.7)
 */
export interface EngineState {
	party: CharacterState[];
	activeSlot: number;
	lastSwapAt: number;
	swapCooldownMs: number;

	enemies: EnemyState[];
	summons: SummonState[];
	constructs: ConstructState[];
	zones: ZoneState[];

	board: Board;

	over: boolean;
	outcome: 'victory' | 'defeat' | null;
	focusTargetId: string | null;
}

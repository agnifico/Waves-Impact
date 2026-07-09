import type { Position, Vector, EntityId, Stratum } from './common';
import type { Character } from './character';
import type { Enemy } from './enemy';
import type { EffectInstance } from './effect';
import type { ZoneBuff, AbilitySlot, AbilityOpts, FxSpec } from './ability';

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
	/** Timestamp of the last stack gain — used for decay timers (stackDecayMs on Character). */
	stackLastGainedAt?: number;
	activeEffects: Record<string, EffectInstance>;

	baChainIndex: number;
	lastBaIndexLanded: number;
	lastBaTimestamp: number;
	lastActionTimestamp: number;

	stunnedUntil: number;
	cooldowns: Record<AbilitySlot, number>;

	poise: number;

	/**
	 * Arch 3 CA stack buffer — stacks granted by party V casts before the stance
	 * activates. Consumed on the next coord_attack_stance activation.
	 */
	caPendingStacks?: number;
	/** True once caPendingStacks has reached the character's caPendingStackMax. */
	caPendingMaxReached?: boolean;
	stratum: Stratum;
	lastAction?: { tag: string; at: number };
	charges: Partial<Record<AbilitySlot, { count: number; rechargeAt: number }>>;
	lastHitAt?: number;
	pendingCast?: {
		slot: AbilitySlot;
		firesAt: number;
		opts: AbilityOpts;
	};
	pendingBasic?: {
		enemyId: string;
		firesAt: number;
		ba: unknown;
		dirX?: number;
		dirY?: number;
		fx?: FxSpec;
	};
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
	// Enemy attack wind-up (telegraph): a committed strike landing when firesAt elapses.
	pendingAttack?: {
		attackId: string;
		firesAt: number;
		damage: number;
		stunMs?: number;
		knockback?: number;
		knockbackSmart?: boolean;
		name: string;
		targetIsChar: boolean;
		windUpStyle?: string;
		dirX?: number;
		dirY?: number;
		fx?: FxSpec;
	};
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
	/**
	 * Albedo-style reactive field: any damage dealt to an enemy inside this zone
	 * also fires a fixed-damage hit from the zone owner. Per-enemy cooldown prevents
	 * burst chains from cascading infinitely.
	 */
	reactive?: {
		dmg: number;
		cooldownMs: number;
		abilityName: string;
		lastFiredAt: Record<string, number>;
	};
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
	/** Footprint offsets relative to pos. Omit/empty = 1×1. occupiedTiles maps to absolute. */
	footprint?: Position[];
	footprintRender?: 'all' | 'head' | 'scaled';
	/** Multi-tile movers shove units aside instead of being blocked by them. */
	juggernaut?: boolean;
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
	/** Footprint offsets relative to pos. Omit/empty = 1×1. occupiedTiles maps to absolute. */
	footprint?: Position[];
	footprintRender?: 'all' | 'head' | 'scaled';
}


/** One enemy entry in a wave definition. */
export interface WaveEnemy {
	enemyId: string;
	spawnPos?: Position;
}

/** Definition of a single wave of enemies. */
export interface WaveDef {
	enemies: WaveEnemy[];
	/** Pause before this wave spawns (ms). Default 3000. */
	intermissionMs?: number;
	/** Optional hard limit to clear this wave; defeat if exceeded. */
	timeLimitMs?: number;
}

/** Runtime wave context — present only in challenge mode. */
export interface WaveContext {
	waves: WaveDef[];
	/** 0-based index of the current/incoming wave. */
	current: number;
	phase: 'fighting' | 'intermission';
	/** When the current fighting phase began (for time-limit checks). */
	waveStartedAt: number;
	/** Absolute timestamp when the intermission ends and next wave spawns. */
	intermissionEndsAt?: number;
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

	lastMoveAt: number;
	lastEnergyRegenAt: number;

	/** Present only in challenge (wave) mode. Absent in sandbox. */
	wave?: WaveContext;
}
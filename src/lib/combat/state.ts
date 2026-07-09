import type { Position, Vector } from '$lib/types/common';
import type {
	EngineState,
	CharacterState,
	EnemyState,
	Board,
	WaveDef,
	WaveContext
} from '$lib/types/state';
import type { Character } from '$lib/types/character';
import type { Enemy } from '$lib/types/enemy';
import { createBoard } from './board';

const DEFAULT_BOARD_SIZE = 11;

/**
 * Create a fresh CharacterState from a Character definition.
 */
export function newCharacterState(def: Character, pos?: Position): CharacterState {
	const charges: CharacterState['charges'] = {};
	for (const slot of ['X', 'C', 'V'] as const) {
		const ab = def.abilities[slot];
		if (ab?.charges && ab.charges > 1) charges[slot] = { count: ab.charges, rechargeAt: 0 };
	}
	return {
		id: def.id,
		def,
		hp: def.maxHp,
		energy: 0,
		pos: pos ?? { x: Math.floor(DEFAULT_BOARD_SIZE / 2), y: Math.floor(DEFAULT_BOARD_SIZE / 2) },
		facing: { x: 0, y: -1 } as Vector,

		stacks: { current: 0 },
		activeEffects: {},

		baChainIndex: 0,
		lastBaIndexLanded: 0,
		lastBaTimestamp: 0,
		lastActionTimestamp: 0,

		stunnedUntil: 0,
		cooldowns: { X: 0, C: 0, V: 0 },
		charges,
		poise: def.maxPoise ?? 0,
		stratum: def.stratum ?? 'ground',
	};
}

/**
 * Create a fresh EnemyState from an Enemy definition.
 * Pass idOverride to guarantee a unique instance ID when the same enemy type
 * appears more than once (e.g. two bears in the same wave).
 */
export function newEnemyState(def: Enemy, pos: Position, now: number, idOverride?: string): EnemyState {
	return {
		id: idOverride ?? def.id,
		def,
		pos,
		hp: def.maxHp,
		nextMoveAt: now + def.moveTickMs,
		attackCooldowns: {},
		lastPlayerPos: { x: Math.floor(DEFAULT_BOARD_SIZE / 2), y: Math.floor(DEFAULT_BOARD_SIZE / 2) },
		stunnedUntil: 0,
		activeEffects: {},
		poise: def.maxPoise ?? 0,
		stratum: def.stratum ?? 'ground',
		facing: { x: 0, y: 1 }
	};
}

/**
 * Create a fresh EngineState for a new fight.
 *
 * ```ts
 * const state = newEngineState([frosty, june9], [bear], performance.now());
 * ```
 */
export function newEngineState(
	partyDefs: Character[],
	enemyDefs: Enemy[],
	now: number,
	boardSize: number = DEFAULT_BOARD_SIZE
): EngineState {
	const center = Math.floor(boardSize / 2);
	const board: Board = createBoard(20, 10);

	const party = partyDefs.map((def) => newCharacterState(def, { x: center, y: center }));

	// Suffix the ID when the same enemy type appears more than once in the list.
	const idCount = new Map<string, number>();
	const enemies = enemyDefs.map((def, i) => {
		const count = idCount.get(def.id) ?? 0;
		idCount.set(def.id, count + 1);
		const hasDupe = enemyDefs.some((d, j) => j !== i && d.id === def.id);
		return newEnemyState(def, { x: center, y: 1 + i }, now, hasDupe ? `${def.id}-${i}` : undefined);
	});

	return {
		party,
		activeSlot: 0,
		lastSwapAt: -9999,
		swapCooldownMs: 1000,

		enemies,
		summons: [],
		constructs: [],
		zones: [],

		board,

		over: false,
		outcome: null,
		focusTargetId: null,

		lastMoveAt: 0,
		lastEnergyRegenAt: 0,
	};
}

/**
 * Create a fresh EngineState configured for wave/challenge mode.
 * The first wave spawns after a brief intermission so the player can orient.
 */
export function newChallengeEngineState(
	partyDefs: Character[],
	waves: WaveDef[],
	now: number,
	boardSize: number = DEFAULT_BOARD_SIZE
): EngineState {
	const state = newEngineState(partyDefs, [], now, boardSize);
	const firstIntermissionMs = waves[0]?.intermissionMs ?? 3000;
	const wave: WaveContext = {
		waves,
		current: 0,
		phase: 'intermission',
		waveStartedAt: now,
		intermissionEndsAt: now + firstIntermissionMs,
	};
	state.wave = wave;
	return state;
}

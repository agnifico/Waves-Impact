import type { Position, Vector } from '$lib/types/common';
import type {
	EngineState,
	CharacterState,
	EnemyState,
	Board
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
 */
export function newEnemyState(def: Enemy, pos: Position, now: number): EnemyState {
	return {
		id: def.id,
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
 * const state = newEngineState([frosty, yara], [bear], performance.now());
 * ```
 */
export function newEngineState(
	partyDefs: Character[],
	enemyDefs: Enemy[],
	now: number,
	boardSize: number = DEFAULT_BOARD_SIZE
): EngineState {
	const center = Math.floor(boardSize / 2);
	const board: Board = createBoard(boardSize + Math.floor(boardSize/2), boardSize - Math.floor(boardSize/2));

	const party = partyDefs.map((def) => newCharacterState(def, { x: center, y: center }));

	const enemies = enemyDefs.map((def, i) =>
		newEnemyState(def, { x: center, y: 1 + i }, now)
	);

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
	};
}

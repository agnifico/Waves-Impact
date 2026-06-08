import { describe, it, expect, beforeEach } from 'vitest';
import { lineFrom } from '$lib/combat/shapes/line';
import { pconeFrom } from '$lib/combat/shapes/pcone';
import { tconeFrom } from '$lib/combat/shapes/tcone';
import { circleAt } from '$lib/combat/shapes/circle';
import { meleeFrom } from '$lib/combat/shapes/melee';
import { resolveTiles } from '$lib/combat/shapes';
import { chebyshev, samePos, inBounds, clamp, isBlocked, createBoard } from '$lib/combat/board';
import { calculateDamage } from '$lib/combat/pipeline';
import { applyEffect, removeEffect, hasEffect, tickEffects } from '$lib/combat/effects';
import { grantStack, consumeStack } from '$lib/combat/stacks';
import { query, nearestEnemy } from '$lib/combat/query';
import { subscribe, publish, clear } from '$lib/combat/events';
import { newEngineState } from '$lib/combat/state';
import { frosty } from '$lib/data/characters/frosty';
import { yara } from '$lib/data/characters/yara';
import { bear } from '$lib/data/enemies/bear';
import { dragon } from '$lib/data/enemies/dragon';

// ─── Shapes ──────────────────────────────────────────────────────────────────

describe('shapes', () => {
	it('line produces correct tiles', () => {
		const tiles = lineFrom({ x: 5, y: 5 }, { x: 0, y: -1 }, 3);
		expect(tiles).toHaveLength(3);
		expect(tiles[0]).toEqual({ x: 5, y: 4 });
		expect(tiles[1]).toEqual({ x: 5, y: 3 });
		expect(tiles[2]).toEqual({ x: 5, y: 2 });
	});

	it('pcone widens correctly', () => {
		const tiles = pconeFrom({ x: 5, y: 5 }, { x: 0, y: -1 }, 3);
		// Row 1: 1 tile, Row 2: 3 tiles, Row 3: 5 tiles = 9 total
		expect(tiles).toHaveLength(9);
	});

	it('tcone has stem + crossbar', () => {
		const tiles = tconeFrom({ x: 5, y: 5 }, { x: 0, y: -1 }, 2);
		// range=2: 1 stem tile + 3 crossbar tiles = 4
		expect(tiles).toHaveLength(4);
	});

	it('circle produces filled disk', () => {
		const tiles = circleAt({ x: 5, y: 5 }, 1);
		// radius 1 = 3×3 = 9 tiles
		expect(tiles).toHaveLength(9);
	});

	it('melee surrounds caster', () => {
		const tiles = meleeFrom({ x: 5, y: 5 }, 1);
		// 8 surrounding tiles (excludes center)
		expect(tiles).toHaveLength(8);
	});

	it('resolveTiles clamps to board', () => {
		const board = createBoard(11, 11);
		const tiles = resolveTiles('line', { x: 0, y: 0 }, { x: -1, y: 0 }, { range: 3 }, board);
		// All tiles would be out of bounds on the left — clamped to x=0
		// Line from (0,0) going left: (-1,0), (-2,0), (-3,0) → all clamp to (0,0)
		expect(tiles.length).toBeLessThanOrEqual(3);
	});
});

// ─── Board ───────────────────────────────────────────────────────────────────

describe('board', () => {
	it('chebyshev distance', () => {
		expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
		expect(chebyshev({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
		expect(chebyshev({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1);
	});

	it('samePos', () => {
		expect(samePos({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
		expect(samePos({ x: 1, y: 2 }, { x: 2, y: 2 })).toBe(false);
	});

	it('inBounds', () => {
		const board = createBoard(11, 11);
		expect(inBounds(board, { x: 0, y: 0 })).toBe(true);
		expect(inBounds(board, { x: 10, y: 10 })).toBe(true);
		expect(inBounds(board, { x: 11, y: 5 })).toBe(false);
		expect(inBounds(board, { x: -1, y: 5 })).toBe(false);
	});

	it('clamp', () => {
		const board = createBoard(11, 11);
		expect(clamp(board, { x: -3, y: 15 })).toEqual({ x: 0, y: 10 });
	});

	it('isBlocked detects obstacles', () => {
		const state = newEngineState([frosty], [bear], 0);
		state.board.obstacles.push({ x: 3, y: 3 });
		expect(isBlocked(state, { x: 3, y: 3 })).toBe(true);
		expect(isBlocked(state, { x: 4, y: 4 })).toBe(false);
	});

	it('isBlocked detects enemy positions', () => {
		const state = newEngineState([frosty], [bear], 0);
		expect(isBlocked(state, state.enemies[0].pos)).toBe(true);
	});
});

// ─── Event bus ───────────────────────────────────────────────────────────────

describe('event bus', () => {
	beforeEach(() => clear());

	it('subscribe and publish', () => {
		let received: unknown = null;
		subscribe('damage:dealt', (e) => {
			received = e;
		});
		publish('damage:dealt', {
			source: 'frosty',
			target: 'bear',
			amount: 15,
			abilityName: 'Ice on Fire'
		});
		expect(received).toEqual({
			source: 'frosty',
			target: 'bear',
			amount: 15,
			abilityName: 'Ice on Fire'
		});
	});

	it('unsubscribe works', () => {
		let count = 0;
		const unsub = subscribe('damage:dealt', () => {
			count++;
		});
		publish('damage:dealt', { source: '', target: '', amount: 0, abilityName: '' });
		expect(count).toBe(1);
		unsub();
		publish('damage:dealt', { source: '', target: '', amount: 0, abilityName: '' });
		expect(count).toBe(1);
	});

	it('clear removes all', () => {
		let count = 0;
		subscribe('damage:dealt', () => count++);
		clear();
		publish('damage:dealt', { source: '', target: '', amount: 0, abilityName: '' });
		expect(count).toBe(0);
	});
});

// ─── Damage pipeline ─────────────────────────────────────────────────────────

describe('pipeline', () => {
	it('pass-through returns base amount', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		const enemy = state.enemies[0];
		const result = calculateDamage(15, { source: char, target: enemy, state });
		expect(result).toBe(15);
	});

	it('clamps negative to zero', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		const enemy = state.enemies[0];
		const result = calculateDamage(-5, { source: char, target: enemy, state });
		expect(result).toBe(0);
	});
});

// ─── Effects ─────────────────────────────────────────────────────────────────

describe('effects', () => {
	beforeEach(() => clear());

	it('apply and check', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		applyEffect(char, 'unchained', 'frosty', -1, 1000);
		expect(hasEffect(char, 'unchained')).toBe(true);
		expect(hasEffect(char, 'bloomstride')).toBe(false);
	});

	it('remove', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		applyEffect(char, 'unchained', 'frosty', -1, 1000);
		removeEffect(char, 'unchained');
		expect(hasEffect(char, 'unchained')).toBe(false);
	});

	it('timed effects expire', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		applyEffect(char, 'bloomstride', 'yara', 5000, 1000);
		expect(hasEffect(char, 'bloomstride')).toBe(true);
		tickEffects(char, 5999);
		expect(hasEffect(char, 'bloomstride')).toBe(true);
		tickEffects(char, 6001);
		expect(hasEffect(char, 'bloomstride')).toBe(false);
	});

	it('permanent effects do not expire', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		applyEffect(char, 'unchained', 'frosty', -1, 1000);
		tickEffects(char, 999999);
		expect(hasEffect(char, 'unchained')).toBe(true);
	});
});

// ─── Stacks ──────────────────────────────────────────────────────────────────

describe('stacks', () => {
	beforeEach(() => clear());

	it('grant increments', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		grantStack(state, char, 'eclipse', 1000);
		expect(char.stacks.current).toBe(1);
		grantStack(state, char, 'eclipse', 1001);
		expect(char.stacks.current).toBe(2);
	});

	it('reaching max triggers onStackFull and resets', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		// Frosty: stackMax=3, onStackFull='unchained'
		grantStack(state, char, 'eclipse', 1000);
		grantStack(state, char, 'eclipse', 1001);
		grantStack(state, char, 'eclipse', 1002);
		expect(char.stacks.current).toBe(0);
		expect(hasEffect(char, 'unchained')).toBe(true);
	});

	it('consume returns false if not enough', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		expect(consumeStack(char, 'eclipse', 1)).toBe(false);
	});

	it('consume succeeds and decrements', () => {
		const state = newEngineState([frosty], [bear], 0);
		const char = state.party[0];
		grantStack(state, char, 'eclipse', 1000);
		expect(consumeStack(char, 'eclipse', 1)).toBe(true);
		expect(char.stacks.current).toBe(0);
	});
});

// ─── Target query ────────────────────────────────────────────────────────────

describe('query', () => {
	it('finds nearest enemy', () => {
		const state = newEngineState([frosty], [bear], 0);
		const result = nearestEnemy(state, state.party[0].pos);
		expect(result).not.toBeNull();
		expect(result!.id).toBe('bear');
	});

	it('respects range filter', () => {
		const state = newEngineState([frosty], [bear], 0);
		const result = nearestEnemy(state, state.party[0].pos, 1);
		// Bear starts at y=1, player at center (y=5), distance = 4 > 1
		expect(result).toBeNull();
	});

	it('query with side=ally returns party', () => {
		const state = newEngineState([frosty, yara], [bear], 0);
		const results = query(state, { side: 'ally', take: 'all' });
		expect(results).toHaveLength(2);
	});

	it('query with side=enemy filters dead', () => {
		const state = newEngineState([frosty], [bear, dragon], 0);
		state.enemies[0].hp = 0;
		const results = query(state, { side: 'enemy', take: 'all' });
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('dragon');
	});
});

// ─── State factory ───────────────────────────────────────────────────────────

describe('state factory', () => {
	it('creates valid engine state', () => {
		const state = newEngineState([frosty, yara], [bear], 0);
		expect(state.party).toHaveLength(2);
		expect(state.enemies).toHaveLength(1);
		expect(state.summons).toHaveLength(0);
		expect(state.zones).toHaveLength(0);
		expect(state.over).toBe(false);
		expect(state.outcome).toBeNull();
		expect(state.board.size).toEqual({ width: 11, height: 11 });
		expect(state.board.obstacles).toHaveLength(0);
	});

	it('characters start at full HP, zero energy', () => {
		const state = newEngineState([frosty], [bear], 0);
		expect(state.party[0].hp).toBe(100);
		expect(state.party[0].energy).toBe(0);
		expect(state.party[0].activeEffects).toEqual({});
		expect(state.party[0].stacks.current).toBe(0);
	});

	it('multi-enemy state', () => {
		const state = newEngineState([frosty], [bear, dragon], 0);
		expect(state.enemies).toHaveLength(2);
		expect(state.enemies[0].id).toBe('bear');
		expect(state.enemies[1].id).toBe('dragon');
	});
});

import { describe, it, expect } from 'vitest';
import { createBoard, occupiedTiles, occupies } from '$lib/combat/board';
import { terrainAt, canEnter, coversStratum, isFlanked } from '$lib/combat/spatial';
import type { Board } from '$lib/types/state';
import type { Position } from '$lib/types/common';

describe('occupiedTiles', () => {
	it('single tile when no footprint', () => {
		expect(occupiedTiles({ pos: { x: 3, y: 4 } })).toEqual([{ x: 3, y: 4 }]);
	});
	it('expands a footprint to anchor-relative tiles', () => {
		const e = { pos: { x: 2, y: 2 }, def: { footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] } };
		expect(occupiedTiles(e)).toEqual([{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }]);
	});
	it('occupies() matches any footprint tile', () => {
		const e = { pos: { x: 2, y: 2 }, def: { footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }] } };
		expect(occupies(e, { x: 3, y: 2 })).toBe(true);
		expect(occupies(e, { x: 2, y: 3 })).toBe(false);
	});
});

describe('terrain', () => {
	const board: Board = { ...createBoard(11, 11), water: [{ x: 5, y: 5 }] };
	it('reports water vs land', () => {
		expect(terrainAt(board, { x: 5, y: 5 })).toBe('water');
		expect(terrainAt(board, { x: 0, y: 0 })).toBe('land');
	});
	it('ground blocked from water; swimming blocked from land', () => {
		expect(canEnter('ground', { x: 5, y: 5 }, board)).toBe(false);
		expect(canEnter('ground', { x: 0, y: 0 }, board)).toBe(true);
		expect(canEnter('swimming', { x: 5, y: 5 }, board)).toBe(true);
		expect(canEnter('swimming', { x: 0, y: 0 }, board)).toBe(false);
	});
	it('flying ignores terrain', () => {
		expect(canEnter('flying', { x: 5, y: 5 }, board)).toBe(true);
	});
	it('traversal override = amphibious', () => {
		expect(canEnter('ground', { x: 5, y: 5 }, board, ['land', 'water'])).toBe(true);
	});
});

describe('coversStratum', () => {
	it('no hits → reaches everything', () => {
		expect(coversStratum(undefined, 'flying')).toBe(true);
		expect(coversStratum([], 'flying')).toBe(true);
	});
	it('restricted coverage misses out-of-band strata', () => {
		expect(coversStratum(['ground'], 'flying')).toBe(false);
		expect(coversStratum(['ground'], 'ground')).toBe(true);
	});
});

describe('isFlanked', () => {
	const t: Position = { x: 5, y: 5 };
	const up = { x: 0, y: -1 };
	it('behind facing = flank', () => expect(isFlanked(t, up, 'front', { x: 5, y: 7 })).toBe(true));
	it('in front = not flank', () => expect(isFlanked(t, up, 'front', { x: 5, y: 2 })).toBe(false));
	it("guard 'all' never flanked", () => expect(isFlanked(t, up, 'all', { x: 5, y: 7 })).toBe(false));
});
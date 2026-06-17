/** 2D board coordinate. */
export type Position = { x: number; y: number };

/** Normalized direction vector (each component is -1, 0, or 1). */
export type Vector = { x: number; y: number };

/** Elemental affinity. Declared but not yet applied in combat. (Data Contract §8) */
export type Element =
	| 'water'
	| 'wind'
	| 'nature'
	| 'fire'
	| 'light'
	| 'dark'
	| 'normal';

/** Unique string identifying any entity (character, enemy, summon). */
export type EntityId = string;

/** Which plane an entity occupies. Categorical, not a coordinate. */
export type Stratum = 'ground' | 'flying' | 'swimming';
/** Tile terrain archetype. */
export type Terrain = 'land' | 'water';
/** How much of its perimeter an entity defends against flanking. */
export type Guard = 'front' | 'all';

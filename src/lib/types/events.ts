import type { Position, EntityId } from './common';
import type { AbilitySlot, FxSpec } from './ability';

/**
 * Typed event payloads for the combat event bus. (Data Contract §12)
 * Adding a new event = adding a key here. Subscribers and publishers
 * are type-checked against this map.
 */
export type CombatEventMap = {
	'damage:dealt': {
		source: EntityId;
		target: EntityId;
		amount: number;
		abilityName: string;
		element?: string;
	};
	'shield:gained': {
		target: string;
		source: string;
		amount: number;
		total: number
	};
	'shield:absorbed': {
		target: string;
		effectId: string;
		remaining: number
	};
	'damage:taken': {
		target: EntityId;
		source: EntityId;
		amount: number;
		abilityName: string;
	};
	'heal:applied': {
		target: EntityId;
		source: EntityId;
		amount: number;
		abilityName?: string;
	};
	'effect:applied': {
		target: EntityId;
		effectId: string;
		source: EntityId;
		duration: number;
	};
	'effect:expired': {
		target: EntityId;
		effectId: string;
	};
	'ability:cast': {
		caster: EntityId;
		abilityId: string;
		slot: AbilitySlot;
	};
	'ability:hit': {
		caster: EntityId;
		target: EntityId;
		abilityId: string;
	};
	'character:swap': {
		from: EntityId;
		to: EntityId;
	};
	'enemy:spawn': {
		enemyId: string;
	};
	'enemy:defeated': {
		enemyId: string;
		killer: EntityId;
	};
	'stack:gained': {
		characterId: EntityId;
		stackType: string;
		current: number;
	};
	'poise:broken': {
		target: EntityId;
	};
	'zone:created': {
		zoneId: string;
		ownerId: EntityId;
	};
	'zone:expired': {
		zoneId: string;
	};
	'summon:spawned': {
		summonId: string;
		owner: EntityId;
		pos?: Position;
	};
	'summon:expired': {
		summonId: string;
	};
	'movement:player': {
		characterId: EntityId;
		from: Position;
		to: Position;
	};
	'movement:enemy': {
		enemyId: string;
		from: Position;
		to: Position;
	};
	'basic:missed': {
		target: EntityId;
		abilityName: string;
	};
	'construct:placed': {
		constructId: string;
		ownerId: EntityId;
		pos?: Position;
	};
	'construct:expired': {
		constructId: string;
		ownerId: EntityId;
	};
	'construct:pulse': { constructId: string; pos: Position; element?: string; radius: number; };
	'construct:catalyst': { constructId: string; pos: Position; element?: string; radius: number; };
	'construct:turret': { constructId: string; pos: Position; targetPos: Position; element?: string; };
	'summon:attack': { summonId: string; ownerId: string; fromPos: Position; toPos: Position; isRanged: boolean; element?: string; };
	'cast:windup': { caster: string; slot: string; durationMs: number };
	'combat:stun': { target: EntityId; durationMs: number };
	'combat:knockback': { target: EntityId; fromPos: Position; ownerPos: Position };
	'enemy:windup': { enemy: EntityId; durationMs: number; attackName: string };
	'enemy:strike': { enemy: string; target: string; fx?: FxSpec };
	'detonate:thread': { caster: string; casterPos: Position; targetPos: Position; index: number; total: number; color?: string };
	/** Cast-time shape telegraph. Published by damaging behaviors at resolve with the
	 *  geometry they computed, so FxLayer can erupt the affected area in its shape. */
	'wave:start': { waveIndex: number; total: number };
	'wave:cleared': { waveIndex: number; total: number };
	'cast:shape': {
		caster: string;
		shape: 'circle' | 'line' | 'wide_line' | 'pcone' | string;
		center: Position;          // erupt origin (caster for self-centered, reticle for aimed)
		facing: Position;          // direction unit vector (for line/cone orientation)
		range?: number;            // tiles outward (line/cone length)
		radius?: number;           // tiles (circle)
		width?: number;            // tiles wide (wide_line)
		fxCls?: string;            // override the default casttiles CSS class
		color?: string;
	};
};

export type CombatEventName = keyof CombatEventMap;
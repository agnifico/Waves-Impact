import type { Position, EntityId } from './common';
import type { AbilitySlot } from './ability';

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
	};
	'construct:expired': {
		constructId: string;
		ownerId: EntityId;
	};
	'construct:pulse': { constructId: string; pos: Position; element?: string; radius: number; };
	'construct:catalyst': { constructId: string; pos: Position; element?: string; radius: number; };
	'construct:turret': { constructId: string; pos: Position; targetPos: Position; element?: string; };
	'summon:attack': { summonId: string; ownerId: string; fromPos: Position; toPos: Position; isRanged: boolean; element?: string; };

};

export type CombatEventName = keyof CombatEventMap;

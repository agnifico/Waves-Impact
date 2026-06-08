import type { Character } from '$lib/types/character';
import type { Enemy } from '$lib/types/enemy';
import type { Effect } from '$lib/types/effect';
import type { SummonDef } from '$lib/types/summon';

import { frosty } from './characters/frosty';
import { yara } from './characters/yara';
import { bear } from './enemies/bear';
import { dragon } from './enemies/dragon';
import { unchained } from './effects/unchained';
import { bloomstride } from './effects/bloomstride';

// ─── Character registry ──────────────────────────────────────────────────────

const characters: Record<string, Character> = {
	frosty,
	yara
};

export function getCharacter(id: string): Character | undefined {
	return characters[id];
}

export function getAllCharacters(): Character[] {
	return Object.values(characters);
}

// ─── Enemy registry ──────────────────────────────────────────────────────────

const enemies: Record<string, Enemy> = {
	bear,
	dragon
};

export function getEnemy(id: string): Enemy | undefined {
	return enemies[id];
}

export function getAllEnemies(): Enemy[] {
	return Object.values(enemies);
}

// ─── Effect registry ─────────────────────────────────────────────────────────

const effects: Record<string, Effect> = {
	unchained,
	bloomstride
};

export function getEffectDef(id: string): Effect | undefined {
	return effects[id];
}

export function getAllEffects(): Effect[] {
	return Object.values(effects);
}

// ─── Summon registry ─────────────────────────────────────────────────────────

const summons: Record<string, SummonDef> = {
	leo: {
		id: 'leo',
		name: 'Leo (The Revenant Wolf)',
		attackDamage: 15,
		attackCooldownMs: 1000,
		moveCooldownMs: 500,
		mirrorsOwnerBA: true
	}
};

export function getSummonDef(id: string): SummonDef | undefined {
	return summons[id];
}

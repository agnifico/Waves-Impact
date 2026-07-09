import type { Character } from '$lib/types/character';
import type { Enemy } from '$lib/types/enemy';
import type { Effect } from '$lib/types/effect';
import type { SummonDef } from '$lib/types/summon';

import { frosty } from './characters/frosty';
import { june9 } from './characters/june9';
import { maria_elena } from './characters/maria_elena';
import { sefyra } from './characters/sefyra';
import { ryoma } from './characters/ryoma';
import { carla } from './characters/carla';
import { jamilya } from './characters/jamilya';
import { midorima } from './characters/midorima';
import { nepthys } from './characters/nepthys';
import { luna } from './characters/luna';

import { bear } from './enemies/bear';
import { dragon } from './enemies/dragon';
import { unchained } from './effects/unchained';
import { bloomstride } from './effects/bloomstride';
import { glacial_resonance } from './effects/glacial-resonance';
import { frost_aura } from "./effects/frost-aura";
import { shield } from './effects/shield';
import { party_ca } from './effects/party_ca';
import { ca_stance } from './effects/ca_stance';
import { forest_prowler } from './enemies/forest-prowler';
import { punching_tortoise } from './enemies/punching-tortoise';
import { vanguard_siren } from './enemies/vanguard-siren';
import { solis_sentinel } from './enemies/solis-sentinel';
import { bob } from './enemies/bob';

// ─── Character registry ──────────────────────────────────────────────────────

const characters: Record<string, Character> = {
	nepthys, luna, frosty, jamilya, maria_elena, june9, sefyra, carla, midorima,
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
	dragon,
	bob,
	forest_prowler,
	punching_tortoise,
	vanguard_siren,
	solis_sentinel,
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
	bloomstride,
	shield,
	frost_aura,
	glacial_resonance,
	party_ca,
	ca_stance
};

export function getEffectDef(id: string): Effect | undefined {
	return effects[id];
}

export function getAllEffects(): Effect[] {
	return Object.values(effects);
}


import type { Character } from '$lib/types/character';

// Export symbol stays `june9` so imports don't break. id/display are 'june9' / 'June 9'.
export const june9: Character = {
	id: 'june9',
	name: 'June 9',
	element: 'nature',
	maxHp: 400,
	maxEnergy: 100,
	baCooldownMs: 250,
	baChainResetMs: 2000,

	basicStyle: 'contextual',
	contextualBasic: {
		selectBy: 'hold',
		base: {
			name: 'Verdant Arc',
			damage: 12,
			range: 2,
			energyGain: 10,
			shape: 'melee',
			omniTarget: true,
			grantsStack: 'verdance',
			fx: { strike: 'swipe', colors: ['#2A9D8F', '#E9C46A'] }
		},
		withStack: {
			name: 'Lifebloom',
			damage: 12,
			range: 2,
			energyGain: 10,
			shape: 'melee',
			omniTarget: true,
			consumesStack: 'verdance',
			teamHeal: 35,
			fx: { strike: 'projectile', shape: 'bolt', colors: ['#E9C46A', '#E9C46A'] }
		}
	},

	abilities: {
		X: {
			id: 'greenshackle',          // internal id kept; display rebranded
			name: 'Stillpoint',
			behavior: 'damage_aoe',
			shape: 'circle',
			shapeParams: { radius: 1, range: 4 },
			damage: 10,
			stunMs: 2000,
			cooldownMs: 6000,
			energyGain: 15,
			grantsStack: 'verdance',
			teamHeal: 40,
			autoTargetEnemy: true,
			allowSelfTarget: true,
			holdBehavior: 'aim'
		},
		C: {
			id: 'bramble_snare',         // internal id kept
			name: 'Worldroot',
			behavior: 'dash',
			shapeParams: { range: 3 },
			damage: 10,
			cooldownMs: 6000,
			energyGain: 15,
			grantsStack: 'verdance',
			gather: { radius: 2, steps: 1 },
			shield: { amount: 60, target: 'party' },
			holdBehavior: 'charge',
			chargeMaxRange: 7,
			chargeMsPerTile: 200
		},
		V: {
			id: 'sanctum',               // internal id kept
			name: 'Garden of Genesis',
			behavior: 'zone',
			shape: 'circle',
			shapeParams: { radius: 3 },
			durationMs: 16000,
			cooldownMs: 16000,
			energyCost: 50,
			grantsStack: 'verdance',
			zoneBuff: { damageBonus: .5, healPerTick: 10, activeBonusHeal: 10, tickMs: 1500,}
		}
	},

	stackType: 'verdance',       // internal id kept (self-contained to this file)
	stackName: 'Genesis',        // display
	stackMax: 5,
	onStackFull: 'bloomstride',  // effect id — rename its display in effects/bloomstride.ts if you want
	onStackFullTarget: 'party',

	art: {
		gem: '/characters/june9_gem.png',
		profile: '/characters/avatars/june9_profile.png',
		poster: '/characters/june9_poster.png'
	},

	theme: {
		primary: '#2eb872',                                 // verdant green
		secondary: '#f5c04a',                               // radiant gold — bright accent
		glow: { ready: '#74f0a8', bloomstride: '#ffd66b' },
		energy: 'linear-gradient(180deg,#f5c04a 0%, #e0a020 100%);',
		hp: 'linear-gradient(180deg,#74f0a8 0%, #2eb872 100%);',
		skin: 'mecha' 
	}
};
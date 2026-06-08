import type { Character } from '$lib/types/character';

export const yara: Character = {
	id: 'yara',
	name: 'Yara',
	element: 'nature',
	maxHp: 400,
	maxEnergy: 100,
	baCooldownMs: 250,
	baChainResetMs: 2000,

	basicStyle: 'contextual',
	contextualBasic: {
		base: {
			name: 'Verdant Edge',
			damage: 2,
			range: 3,
			energyGain: 10,
			shape: 'melee',
			omniTarget: true,
			fx: { strike: 'projectile', shape: 'leaf', colors: ['var(--verdant-bright)', 'var(--verdant)'] }
		},
		withStack: {
			name: 'Receding Tide',
			damage: 2,
			range: 3,
			energyGain: 10,
			shape: 'melee',
			omniTarget: true,
			consumesStack: 'verdance',
			dashBack: 3,
			fx: { strike: 'projectile', shape: 'leaf', colors: ['var(--bloomstride)', '#e0b020'] }
		}
	},

	abilities: {
		X: {
			id: 'greenshackle',
			name: 'Greenshackle',
			behavior: 'damage_aoe',
			shape: 'circle',
			shapeParams: { radius: 1, range: 4 },
			damage: 10,
			stunMs: 2000,
			cooldownMs: 6000,
			energyGain: 15,
			grantsStack: 'verdance',
			selfHeal: 40,
			autoTargetEnemy: true,
			allowSelfTarget: true,
			impactClass: 'impact-verdant',
			holdBehavior: 'aim'
		},
		C: {
			id: 'severing_step',
			name: 'Severing Step',
			behavior: 'dash',
			shapeParams: { range: 3 },
			damage: 10,
			knockback: 1,
			cooldownMs: 6000,
			energyGain: 15,
			grantsStack: 'verdance',
			holdBehavior: 'charge',
			chargeMaxRange: 7,
			chargeMsPerTile: 200
		},
		V: {
			id: 'sanctum',
			name: 'Sanctum of Verdance',
			behavior: 'zone',
			shape: 'circle',
			shapeParams: { radius: 2 },
			durationMs: 16000,
			cooldownMs: 16000,
			energyCost: 40,
			grantsStack: 'verdance',
			zoneBuff: {
				damageBonus: 0.5,
				healPerTick: 10,
				activeBonusHeal: 10,
				tickMs: 1500
			}
		}
	},

	stackType: 'verdance',
	stackName: 'Verdance',
	stackMax: 3,
	onStackFull: 'bloomstride',
	onStackFullTarget: 'party',
	art: {
		gem: '/characters/yara_gem.png',
		profile: '/characters/avatars/yara.png',
		poster: '/characters/yara_poster3.png'
	},
	theme: {
		primary: 'var(--verdant)',
		secondary: 'var(--verdant-bright)',
		glow: { ready: 'var(--verdant-bright)', bloomstride: 'var(--bloomstride)' },
		energy: 'linear-gradient(180deg,#936639 0%, #a68a64 100%);',
		hp: 'linear-gradient(180deg,#fcbf49 0%, rgba(50, 150, 82, 1) 100%);',
	},
};

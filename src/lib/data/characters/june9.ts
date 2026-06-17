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
			name: 'Solarfuel Blasters',
			range: 3,
			omniTarget: true,
			delivery: { damage: 12, energyGain: 10, shape: 'melee', grantsStack: 'verdance' },
			fx: { strike: 'projectile', shape: 'bolt', speed: 22, colors: ['#E9C46A'] }
		},
		withStack: {
			name: 'Solar Beam',
			range: 3,
			omniTarget: true,
			consumesStack: 'verdance',
			delivery: { damage: 12, energyGain: 10, shape: 'melee' },
			// teamHeal self-gates: withStack only fires when a verdance stack exists.
			onHit: { teamHeal: 35 },
			fx: { strike: 'beam', hits: 6, colors: ['#2eb872'] }
		}
	},

	abilities: {
		X: {
			id: 'spatial_recovery',
			name: 'Spatial Recovery',
			behavior: 'damage_aoe',
			cooldownMs: 6000,
			delivery: {
				damage: 10,
				energyGain: 15,
				grantsStack: 'verdance',
				teamHeal: 100,          // guaranteed cast-time heal (position-independent)
				shape: 'circle',
				shapeParams: { radius: 1, range: 4 },
				autoTargetEnemy: true,
				holdBehavior: 'aim'
			},
			onHit: { stunMs: 2000 }     // stun lands on enemies actually struck
		},
		C: {
			id: 'thruster_bash',
			name: 'Thruster Bash',
			behavior: 'dash',
			cooldownMs: 6000,
			gather: { radius: 2, steps: 1 },
			delivery: {
				damage: 10,
				energyGain: 15,
				grantsStack: 'verdance',
				shield: { amount: 600, target: 'party' },   // cast-time party shield
				shapeParams: { range: 3 },
				holdBehavior: 'charge',
				chargeMaxRange: 7,
				chargeMsPerTile: 200
			}
		},
		V: {
			id: 'genesis_garden',
			name: 'Garden of Genesis',
			behavior: 'zone',
			durationMs: 16000,
			cooldownMs: 16000,
			energyCost: 50,
			zoneFollows: 'active',
			persistsAfterDeath: true,
			zoneBuff: { damageBonus: 0.5, healPerTick: 40, activeBonusHeal: 30, tickMs: 1000 },
			delivery: {
				grantsStack: 'verdance',
				shape: 'circle',
				shapeParams: { radius: 3 }
			},
			fx: { zone: 'mecha' }
		}
	},

	stackType: 'verdance',
	stackName: 'Genesis',
	stackMax: 5,
	onStackFull: 'bloomstride',
	onStackFullTarget: 'party',

	art: {
		gem: '/characters/june9_gem.png',
		profile: '/characters/avatars2/june9.png',
		poster: '/characters/june9_poster4.png',
		bannerPoster: '/characters/june9_banner_full.png'
	},

	theme: {
		primary: '#2eb872',
		secondary: '#f5c04a',
		glow: { ready: '#b5e48c', bloomstride: '#ffd66b' },
		energy: 'linear-gradient(180deg,#f5c04a 0%, #e0a020 100%);',
		hp: 'linear-gradient(180deg,#74f0a8 0%, #2eb872 100%);',
	}
};
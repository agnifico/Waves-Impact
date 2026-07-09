import type { Character } from '$lib/types/character';

export const midorima: Character = {
	id: 'midorima',
	name: 'Midorima',
	element: 'wind',
	maxHp: 200,
	maxEnergy: 100,
	baCooldownMs: [160, 160, 50, 50],
	baChainResetMs: 1600,

	basicStyle: 'chain',
	basicChain: [
		{
			name: 'Gale Draw (1)',
			range: 3,
			omniTarget: true,
			delivery: { damage: 15, energyGain: 10, shape: 'line' },
			fx: { strike: 'projectile', shape: 'wave', colors: ['#48cae4', '#a8e0ec'] }
		},
		{
			name: 'Whirlwind Cut (2)',
			range: 3,
			omniTarget: true,
			delivery: { damage: 25, energyGain: 15, shape: 'pcone' },
			fx: { strike: 'projectile', shape: 'wave', colors: ['#48cae4', '#6be9e3'] }
		},
		{
			name: 'Zephyr Dash-Strike (3)',
			range: 3,
			omniTarget: true,
			delivery: { damage: 30, energyGain: 15, shape: 'line', grantsStack: 'gale' },
			fx: { strike: 'swipe', colors: ['#6be9e3', '#fff8ec'] }
		},
		{
			name: 'Zephyr Dash-Strike (4)',
			range: 3,
			omniTarget: true,
			delivery: { damage: 30, energyGain: 15, shape: 'line', grantsStack: 'gale' },
			fx: { strike: 'reverseswipe', colors: ['#fff8ec', '#6be9e3'] }
		}
	],

	abilities: {
		// X — Sakura Rush: low-cooldown gap-closer dash
		X: {
			id: 'sakura_rush',
			name: 'Sakura Rush',
			behavior: 'damage_first_in_line',
			cooldownMs: 8000,
			delivery: {
				damage: 100,
				energyGain: 15,
				grantsStack: 'gale',
				shape: 'line',
				shapeParams: { range: 3, respectsObstacles: true },
			},
		},

		// C — Wind Tower: 4-tower diagonal multi-construct
		C: {
			id: 'wind_tower',
			name: 'Wind Tower',
			behavior: 'multi_construct',
			creationId: 'wind_tower',
			multiConstructOffsets: [
				{ x: 0, y: -2 },
				{ x: 2, y: -1 },
				{ x: 1, y: 1 },
				{ x: -1, y: 2 },
				{ x: -2, y: 0 }
			],
			charges: 2,
			rechargeMs: 12_000,
			delivery: { energyGain: 10, grantsStack: 'gale', },
			fx: { shape: 'orb', colors: ['#eaf6ff', 'var(--frost)', '#00b4d8'] }
		},

		// V — Sakura Monsoon: personal following storm zone
		V: {
			id: 'sakura_monsoon',
			name: 'Sakura Monsoon',
			behavior: 'zone',
			durationMs: 3000,
			cooldownMs: 10000,
			energyCost: 100,
			zoneFollows: 'active',
			persistsAfterDeath: true,
			zoneBuff: { damageBonus: 0.15, dmgPerTick: 75, tickMs: 250 },
			delivery: {
				shape: 'circle',
				shapeParams: { radius: 2 },
				hitsStrata: ['ground', 'flying']
			},
			fx: { zone: 'slashes', colors: ['#fff8ec', '#6be9e3'] }
		}
	},

	stackType: 'gale',
	stackName: 'Gale Stance',
	stackMax: 3,
	onStackFull: 'cyclone_veil',
	onStackFullTarget: 'self',

	stratum: 'ground',

	art: {
		gem: '/characters/gem-midorima.png',
		profile: '/characters/avatars2/midorima.png',
		poster: '/characters/midorima_v.png',
		bannerPoster: '/characters/midorima_poster3.png'
	},
	theme: {
		primary: '#17c3b2',
		secondary: '#006d77',
		glow: { ready: '#6be9e3', cyclone_veil: '#ffe9a8' },
		hp: 'linear-gradient(-90deg, #114b4f 0%, #2a6f6d 50%, #86e89a 100%);',
		energy: 'linear-gradient(to left, #205072, #329d9c);',
	}
};
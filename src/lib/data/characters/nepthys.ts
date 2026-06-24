import type { Character } from '$lib/types/character';

export const nepthys: Character = {
	id: 'nepthys',
	name: 'Nepthys',
	element: 'water',
	maxHp: 200,
	maxEnergy: 100,
	baCooldownMs: [100, 100, 100],
	baChainResetMs: 1600,

	basicStyle: 'chain',
	basicChain: [
		{
			name: 'Dark Waves (1)',
			range: 4,
			// omniTarget: true,
			delivery: { damage: 5, energyGain: 20, shape: 'pcone', windUpMs:150, windUpStyle: 'pistol'},
			fx: { strike: 'projectile', shape: 'orb', size: 'l', colors: ['#06d6a0', '#00a7e1'] }
		},
		{
			name: 'Dark Waves (2)',
			range: 4,
			omniTarget: true,
			delivery: { damage: 25, energyGain: 30, shape: 'pcone', windUpMs:250, windUpStyle: 'pistol' },
			fx: { strike: 'projectile', shape: 'orb', size: 'l', colors: ['#06d6a0', '#00a7e1'] }
		},
		{
			name: 'Dark Waves (3)',
			range: 4,
			omniTarget: true,
			delivery: { damage: 30, energyGain:  40, shape: 'pcone', windUpMs:350, windUpStyle: 'melee' },
			fx: { strike: 'projectile', shape: 'bolt', size: 'l', colors: ['#4361ee', '#3a0ca3'] }
		}
	],

	abilities: {
		// X — Sakura Rush: low-cooldown gap-closer dash
		X: {
			id: 'tidal_wave',
			name: 'Tidal Wave',
			behavior: 'damage_aoe',
			cooldownMs: 2_000,
			delivery: {
				damage: 80,
				energyGain: 6,
				grantsStack: 'gale',
				shape: 'circle',
				shapeParams: { range: 4, respectsObstacles: true, radius: 4 },
				holdBehavior: 'aim',
			},
			onHit: { knockback: 4, poiseDamage: 30 },
			energyCost: 10,
		},
		
		// C — Wind Tower: 4-tower diagonal multi-construct
		C: {
			id: 'captains_call', name: 'Captain\'s Call',
			behavior: 'summon',
			creationId: 'spectral_ship',
			cooldownMs: 20_000, 
			energyCost: 50,
			delivery: {
				grantsStack: 'eclipse',
				aimRange: 4,
				holdBehavior: 'aim',
				shape: 'footprint',
			}
		},
		
		// V — Sakura Monsoon: personal following storm zone
		V: {
			id: 'summoner_deep', name: 'Summoner of the Deep',
			behavior: 'summon',
			creationId: 'leviathan',
			cooldownMs: 15_000, 
			energyCost: 40,
			delivery: {
				grantsStack: 'eclipse',
				aimRange: 10,
				holdBehavior: 'aim',
			}
		}
	},
	
	stackType: 'gale',
	stackName: 'Gale Stance',
	stackMax: 3,
	onStackFull: 'cyclone_veil',
	onStackFullTarget: 'self',

	stratum: 'ground',

	art: {
		gem: '/characters/gem-nepthys.png',
		profile: '/characters/avatars2/nepthys.png',
		poster: '/characters/nepthys_v.png',
		bannerPoster: '/characters/nepthys4.png'
	},
	theme: {
		primary: '#22d3ee',
		secondary: '#4f39f6',
		// glow: { ready: '#6be9e3', cyclone_veil: '#ffe9a8' },
		hp: 'linear-gradient( -90deg,  #22d3ee 11.2%, #4f39f6 100.2% );',
		// energy: 'linear-gradient(to left, #205072, #329d9c);',
	}
};
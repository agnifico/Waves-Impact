import type { Character } from '$lib/types/character';

export const midorima: Character = {
	id: 'midorima',
	name: 'Midorima',
	element: 'wind', // Coincides with her teal palette and breeze-skirting agility
	maxHp: 200,       // Agile glass-skirmisher health scaling
	maxEnergy: 100,
	baCooldownMs: [160, 160, 350], // Extremely fast, low-frame recovery sword draws
	baChainResetMs: 1600,
    stratum: 'swimming',

	// Basic-Attack Style: Rapid directional slashes that generate Gale stacks
	basicStyle: 'chain',
	basicChain: [
		{
			name: 'Gale Draw (1)',
			damage: 5,
			range: 2,
			energyGain: 8,
			shape: 'line', // Linear forward katana thrust
			omniTarget: false, // Strongly directionally manual
			advanceOnlyIfMelee: true,
			fx: { strike: 'swipe', colors: ['#48cae4', '#a8e0ec'] }
		},
		{
			name: 'Whirlwind Cut (2)',
			damage: 8,
			range: 2,
			energyGain: 8,
			shape: 'pcone', // A wide, short frontal sweep
			fx: { strike: 'swipe', colors: ['#48cae4', '#6be9e3'] }
		},
		{
			name: 'Zephyr Dash-Strike (3)',
			damage: 14,
			range: 3,
			energyGain: 12,
			shape: 'line', // Lunges forward through the enemy
			grantsStack: 'gale',
			fx: { strike: 'impact', colors: ['#6be9e3', '#fff8ec'] }
		}
	],

	abilities: {
		// X — Sakura Rush: A tactical non-teleport dash that tracks open ground paths
		X: {
			id: 'sakura_rush',
			name: 'Sakura Rush',
			behavior: 'dash',
			shape: 'line', // Translates to non_teleport_dash pathing internally
			shapeParams: { 
				range: 4,
				respectsObstacles: true // Interrupted if slamming into terrain or enemies
			},
			damage: 12,
			cooldownMs: 4000, // Highly spammable, low-cooldown skirmish tool
			energyGain: 10,
			grantsStack: 'gale',
			holdBehavior: null
		},

		// C — Tempest Wheel: A mid-distance circular zoning bomb thrown from her blade
		C: {
			id: 'tempest_wheel',
			name: 'Tempest Wheel',
			behavior: 'damage_aoe',
			shape: 'circle', // Places a rotating vortex on the field
			shapeParams: { radius: 2, range: 5 },
			damage: 20,
			poiseDamage: 15,
			cooldownMs: 8000,
			energyGain: 15,
			grantsStack: 'gale',
			autoTargetEnemy: true,
			holdBehavior: 'aim' // Can be manually thrown via directional reticle steering
		},

		// V — Sakura Monsoon: Unleashes her spent energy to envelope herself in a moving aura
		V: {
			id: 'sakura_monsoon',
			name: 'Sakura Monsoon',
			behavior: 'zone',
			shape: 'circle', // Generates a personal protective hurricane
			shapeParams: { radius: 2 },
			durationMs: 8000,
			cooldownMs: 20000,
			energyCost: 50,
			zoneFollows: 'caster', // The storm actively tracks her as she dashes around
			zoneBuff: {
				damageBonus: 0.3,
				tickMs: 1000
			}
		}
	},

	// Stack System: Convert-at-max Paradigm (§9)
	stackType: 'gale',
	stackName: 'Gale Stance',
	stackMax: 3,
	onStackFull: 'cyclone_veil', // At 3 stacks, auto-resets to 0 and injects 'cyclone_veil' buff
	onStackFullTarget: 'self',

	stratum: 'ground', // Operates tightly as an earthbound horizontal speedster

	art: {
		gem: '/characters/midorima1.png',
		profile: '/characters/avatars/midorima.png',
		poster: '/characters/midorima3.png' // Utilizing full action file
	},
	theme: {
		panel: '#2a6f6d',   // Deep teal/breeze base color
		btn: '#48cae4',     // Sky wind cyan accent
		border: '#a8e0ec',  // Soft aero border framing
		text: 'rgba(0,0,0,0.6)',
		key: '#f0fbfc',
		glow: { ready: '#6be9e3', cyclone_veil: '#ffe9a8' },
		hp: 'linear-gradient(-90deg, #114b4f 0%, #2a6f6d 50%, #86e89a 100%);',
		energy: 'linear-gradient(to left, #205072, #329d9c);'
	}
};
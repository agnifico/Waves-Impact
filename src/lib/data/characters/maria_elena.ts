import type { Character } from '$lib/types/character';

export const maria_elena: Character = {
	id: 'maria_elena',
	name: 'Maria Elena',
	element: 'fire',
	maxHp: 300,
	maxEnergy: 100,
	moveMs: 75,

	description: 'The Goddess of Fire, Maria Elena is a gap-closing, sustained main damage dealer, with strong off-field DMG capabilities.',

	baCooldownMs: [350, 350, 350, 250],
	baChainResetMs: 2000,

	basicStyle: 'chain',
	basicChain: [
		{
			name: 'Flash Fire (1)',
			range: 1,
			omniTarget: true,
			advanceOnlyIfMelee: true,
			delivery: { damage: 18, energyGain: 8, shape: 'melee', hitsStrata: ['ground'] },
            onHit: {
                splash: {radius: 1},
            },
			fx: { strike: 'swipe', colors: ['#f83600', '#ff4422'] }
            
		},
		{
			name: 'Flash Fire (2)',
			range: 1,
			omniTarget: true,
			advanceOnlyIfMelee: true,
			delivery: { damage: 22, energyGain: 8, shape: 'melee', hitsStrata: ['ground'] },
            onHit: {
                splash: {radius: 1},
            },
			fx: { strike: 'reverseswipe', colors: ['#e9c46a', '#f5d88a'] }
		},
		{
			name: 'Flash Fire (3)',
			range: 1,
			omniTarget: true,
			advanceOnlyIfMelee: true,
			delivery: { damage: 22, energyGain: 8, shape: 'melee', hitsStrata: ['ground'] },
            onHit: {
                splash: {radius: 1},
            },
			fx: { strike: 'swipe', colors: ['#e9c46a', '#f5d88a'] }
		},
		{
			name: 'Flash Fire (4)',
			range: 1,
			omniTarget: true,
			delivery: { damage: 45, energyGain: 14, shape: 'melee', grantsStack: 'immortal_flame', hitsStrata: ['ground'] },
            onHit: {
                splash: {radius: 1},
            },
			fx: { strike: 'uppercut', colors: ['#f83600', '#ff1a00'] }
		}
	],

	enhancedBasic: {
		ba: {
			name: 'Furious Flames',
			range: 4,
			omniTarget: true,
			consumesStack: 'immortal_flame',
			gapClose: true,
			delivery: { damage: 5, energyGain: 10, shape: 'melee' },
            onHit: {
                splash: {radius: 1},
            },
			fx: { strike: 'uppercut', colors: ['#ee9b00', '#bb3e03'] }
		},
		conditions: [{ type: 'stacks_min', n: 1 }],
		requireHold: true,
		interruptsChain: true
	},

	abilities: {
		// X — Shield Bash: charging gap-closer dash with knockback
		X: {
			id: 'shield_bash',
			name: 'Shield Bash',
			behavior: 'dash',
			cooldownMs: 10000,
			charges: 2,
			delivery: {
				damage: 100,
				energyGain: 7,
				grantsStack: 'immortal_flame',
				shield: { amount: 20, target: 'self' },     // cast-time self shield
				shape: 'line',
				shapeParams: { range: 4, throughObstacles: false },
				holdBehavior: 'charge',
				chargeMaxRange: 7,
				chargeMsPerTile: 150
			},
			onHit: { knockback: 4, poiseDamage: 30 },
			description: 'Maria Elena dashes to the nearest/locked-on enemy and knocks them back 4 tiles, while dealing damage. Hold X to charge up the dash range, up to 7 tiles. Grants one stack of Immortal Flame. 2 charges.'
		},

		// C — Blazing Trail: directional dash, hits all in line + terminal blast
		C: {
			id: 'blazing_trail',
			name: 'Blazing Trail',
			behavior: 'dash',
			cooldownMs: 10000,
			charges: 3,
			delivery: {
				damage: 100,
				energyGain: 7,
				grantsStack: 'immortal_flame',
				shield: { amount: 20, target: 'self' },
				hitsStrata: ['ground'],
				shapeParams: {
					dir: 'forward',
					tiles: 4,
					throughObstacles: true,
					allInLine: true,        // hit every enemy along the path (was first-only)
					blastDamage: 50,
					blastRadius: 2
				},
				holdBehavior: 'track'
			},
			description: 'Maria Elena dashes in a line, dealing DMG to all enemies in path, with enemies at the end taking an additional blast. Hold Shift + WASD to aim in place. 3 charges.'
		},

		// V — Here We Stand: following ring zone + cast burst
		V: {
			id: 'here_we_stand',
			name: 'Here We Stand',
			behavior: 'zone',
			durationMs: 20_000,
			cooldownMs: 1_000,
			energyCost: 0,
			zoneFollows: 'active',
			persistsAfterDeath: false,
			zoneBuff: {
				damageBonus: 0.2,
				dmgPerTick: 50,
				ownerEnergyDrainPerTick: 5,
				upkeepReductionPerStack: 0.05,
				tickMs: 1000
			},
			delivery: {
				damage: 50,                 // one-time cast burst
				grantsStack: 'immortal_flame',
				shape: 'circle',
				shapeParams: { radius: 1 }
			},
			fx: { zone: 'flame' },
			description: 'A 1-tile ring that follows the active unit, dealing damage per second, with a cast-time burst. Costs energy per second to upkeep, reduced 5% per Immortal Flame stack.'
		}
	},

	stackType: 'immortal_flame',
	stackName: 'Immortal Flame',
	stackMax: 10,
	onStackFull: 'none',

	stratum: 'ground',
	offFieldStackBonus: 1.0,

	maxPoise: 200,
	poiseRegenPerSec: 25,

	art: {
		gem: '/characters/maria_elena6.png',
		profile: '/characters/avatars2/maria_elena.png',
		poster: '/characters/maria_poster77.png',
		bannerPoster: '/characters/maria_poster2.png'
	},
	theme: {
		primary: '#f83600',
		secondary: '#e9c46a',
		glow: { ready: '#e9c46a' },
		hp: 'linear-gradient(to left, #f83600 0%, #f9d423 100%);',
		energy: 'linear-gradient(to top, #ff0844 0%, #ffb199 100%);',
	}
};
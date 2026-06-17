import type { Character } from '$lib/types/character';

export const frosty: Character = {
	id: 'frosty',
	name: 'Frosty',
	element: 'water',
	maxHp: 300,
	maxEnergy: 100,
	baCooldownMs: [200, 200, 500],
	baChainResetMs: 2000,

	basicStyle: 'chain',
	basicChain: [
		{
			name: 'Snowball (1)',
			range: 5,
			omniTarget: true,
			delivery: { damage: 5, energyGain: 10, shape: 'melee' },
			fx: { strike: 'projectile', shape: 'orb', colors: ['#ade8f4', '#ffffff'] }
		},
		{
			name: 'Snowball (2)',
			range: 5,
			omniTarget: true,
			delivery: { damage: 10, energyGain: 10, shape: 'melee' },
			fx: { strike: 'projectile', shape: 'orb', colors: ['#ade8f4', '#ffffff'] }
		},
		{
			name: 'Giant Snowball',
			range: 5,
			omniTarget: true,
			delivery: { damage: 15, energyGain: 10, shape: 'melee', grantsStack: 'eclipse' },
			fx: { strike: 'projectile', shape: 'orb', size: 'l', colors: ['#00b4d8', '#ffffff'] }
		}
	],

	abilities: {
		X: {
			id: 'ice_on_fire',
			name: 'Ice on Fire',
			behavior: 'damage_first_in_line',
			cooldownMs: 4000,
			unchainedBonus: 10,
			delivery: {
				damage: 15,
				energyGain: 15,
				grantsStack: 'eclipse',
				shape: 'line',
				shapeParams: { range: 5 },
				hitsStrata: ['ground']
			},
			fx: { strike: 'projectile', shape: 'wave', size: 'l', colors: ['#219ebc', '#ffffff'] }
		},

		// ── C: Glacial Pylon ───────────────────────────────────────────────────────
		// Places a stationary ice construct at the aimed tile (1×1 cursor, autoTarget
		// snaps to nearest enemy on hold). Cannot be placed on a tile that already
		// holds a pylon (cast silently rejected, charge not spent).
		//
		// Pulse math (in the creation def): pulseMs 2000 / stunMs 800 → 1200ms escape
		// window for one pylon; two pylons' offset pulses create a soft lock.
		// Constructs don't draw aggro — enemies walk the gauntlet to reach Frosty.
		C: {
			id: 'glacial_pylon', name: 'Glacial Pylon',
			behavior: 'construct',
			creationId: 'glacial_pylon',
			charges: 2, rechargeMs: 12_000,
			delivery: {
				damage: 10,
				energyGain: 10,
				grantsStack: 'eclipse',
				aimRange: 5,
				holdBehavior: 'aim',
				autoTargetEnemy: true
			},
			fx: { shape: 'orb', colors: ['#eaf6ff', 'var(--frost)', '#00b4d8'] }
		},

		V: {
			id: 'revenant_wolf', name: 'The Revenant Wolf',
			behavior: 'summon',
			creationId: 'wolfie',
			cooldownMs: 20_000, energyCost: 10,
			delivery: {
				grantsStack: 'eclipse',
				aimRange: 4,
				holdBehavior: 'aim',
			}
		}
	},

	stackType: 'eclipse',
	stackName: 'Eclipse',
	stackMax: 2,
	onStackFull: 'unchained',
	onStackFullTarget: 'self',
	art: {
		gem: '/characters/frosty_gem.png',
		profile: '/characters/avatars2/frosty.png',
		poster: '/characters/frosty4.png',
		bannerPoster: '/characters/frosty_poster101.png',
	},
	theme: {
		primary: '#00b4d8',
		secondary: '#023e8a',
		glow: { ready: 'var(--frost-bright)', unchained: 'var(--unchained)' },
		hp: 'linear-gradient( -90deg,  rgba(75,228,255,1) 11.2%, rgba(188,204,251,1) 100.6% );',
		energy: 'linear-gradient(to left, #26a0da, #314755);',
	},
};
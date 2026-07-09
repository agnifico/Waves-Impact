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
			delivery: { damage: 5, energyGain: 10, shape: 'melee', windUpMs: 200, windUpStyle: 'pistol' },
			fx: { strike: 'projectile', shape: 'bolt', volley: 'single', colors: ['#ade8f4', '#90e0ef'] }
		},
		{
			name: 'Snowball (2)',
			range: 5,
			omniTarget: true,
			delivery: { damage: 10, energyGain: 10, shape: 'melee', windUpMs: 200, windUpStyle: 'pistol' },
			fx: { strike: 'projectile', shape: 'bolt', volley: 'double', colors: ['#ade8f4', '#90e0ef'] }
		},
		{
			name: 'Giant Snowball',
			range: 5,
			omniTarget: true,
			delivery: { damage: 15, energyGain: 10, shape: 'melee', windUpMs: 200, windUpStyle: 'recoil' },
			fx: { strike: 'projectile', shape: 'bolt', volley: 'flurry', colors: ['#00b4d8', '#90e0ef'] }
		}
	],

	abilities: {
		X: {
			id: 'ice_on_fire',
			name: 'Ice on Fire',
			behavior: 'damage_aoe',
			cooldownMs: 4000,
			unchainedBonus: 10,
			delivery: {
				damage: 100,
				energyGain: 15,
				grantsStack: 'eclipse',
				shape: 'pcone',
				shapeParams: { range: 5 },
				hitsStrata: ['ground', 'flying'],
				windUpMs: 200, windUpStyle: 'levitate'
			},
			fx: { strike: 'uppercut', colors: ['#219ebc', '#ffffff'], }
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
				shape: 'footprint',
				autoTargetEnemy: true,
				windUpMs: 300, windUpStyle: 'tremor'
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
				windUpMs: 200, windUpStyle: 'heavy-drag'
			}
		}
	},

	stackType: 'eclipse',
	stackName: 'Eclipse',
	stackMax: 5,
	selfStackCap: 5,
	onStackFull: 'none',      // hold-and-express — stacks drive persistent buffs, no convert
	stackDecayMs: 13_000,     // stacks wink out 13 s after the last ability cast
	stackEffects: [
		{ effectId: 'frost_aura', minStacks: 1 },       // +10% BA per stack to active unit (incl. Frosty)
		{ effectId: 'glacial_resonance', minStacks: 1 } // +20% creation dmg to self
	],
	art: {
		gem: '/characters/gem-frosty.png',
		profile: '/characters/avatars2/frosty.png',
		poster: '/characters/frosty_v.png',
		bannerPoster: '/characters/frosty_poster100.png',
	},
	theme: {
		primary: '#caf0f8',
		secondary: '#ced4da',
		// glow: { ready: 'var(--frost-bright)', unchained: 'var(--unchained)' },
		hp: 'linear-gradient(180deg,#eaffff,#7ad4ff 50%,#2f7fd6)',
		energy: 'linear-gradient(to left, #26a0da, #314755)',
		hpStyle: 'cryo',
		pip: { shape: 'crystal', color: '#90e0ef', glow: '#caf0f8' },
	},
};
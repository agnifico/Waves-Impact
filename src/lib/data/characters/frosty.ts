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
			damage: 5,
			range: 5,
			energyGain: 10,
			shape: 'melee',
			omniTarget: true,
			fx: { strike: 'projectile', shape: 'orb', colors: ['#ade8f4', '#ffffff'] }
		},
		{
			name: 'Snowball (2)',
			damage: 10,
			range: 5,
			energyGain: 10,
			shape: 'melee',
			fx: { strike: 'projectile', shape: 'orb', colors: ['#ade8f4', '#ffffff'] }
		},
		{
			name: 'Giant Snowball',
			damage: 15,
			range: 5,
			energyGain: 10,
			shape: 'melee',
			grantsStack: 'eclipse',
			fx: { strike: 'projectile', shape: 'orb', size: 'l', colors: ['#00b4d8', '#ffffff'] }
		}
	],

	abilities: {
		X: {
			id: 'ice_on_fire',
			name: 'Ice on Fire',
			behavior: 'damage_first_in_line',
			shape: 'line',
			shapeParams: { range: 5 },
			damage: 15,
			cooldownMs: 4000,
			energyGain: 15,
			grantsStack: 'eclipse',
			unchainedBonus: 10,
			fx: { strike: 'projectile', shape: 'wave', size: "l", colors: ['#219ebc', '#ffffff'] },
		},

		// ── C: Glacial Pylon ───────────────────────────────────────────────────────
		// Places a stationary ice construct ONE TILE FORWARD in Frosty's facing
		// direction. Cannot be placed on the same tile as an existing pylon
		// (the cast is silently rejected, charge not spent).
		//
		// Pulse math:
		//   pulseMs  = 2000ms  stunMs = 800ms  → escape window = 1200ms (one pylon)
		//   Two pylons placed separately will have offset nextPulseAt values.
		//   Their combined effective pulse rate (~1000ms) covers the 800ms stun,
		//   creating a soft lock while both are active.
		//
		// Synergy note: constructs do NOT attract enemy aggro (they live in
		// state.constructs, not state.summons). The enemy will walk through the
		// pylon's range, take damage and a brief stun, then continue to the player.
		// Two pylons across the enemy's path create a meaningful gauntlet.
		C: {
			id: 'glacial_pylon', name: 'Glacial Pylon',
			behavior: 'construct',
			creationId: 'glacial_pylon',
			charges: 2, rechargeMs: 12_000, energyGain: 10, grantsStack: 'eclipse',
			shapeParams: { radius: 1, range: 5 },
			holdBehavior: 'aim',
			damage: 10,
			fx: { shape: 'orb', colors: ['#eaf6ff', 'var(--frost)', '#00b4d8'] }
		},

		V: {
			id: 'revenant_wolf', name: 'The Revenant Wolf',
			behavior: 'summon',
			creationId: 'test_ranged',          // ← replaces the entire summon:{} block
			cooldownMs: 20_000, energyCost: 10, grantsStack: 'eclipse',
		}
	},

	stackType: 'eclipse',
	stackName: 'Eclipse',
	stackMax: 2,
	onStackFull: 'unchained',
	onStackFullTarget: 'self',
	art: {
		gem: '/characters/frosty_gem.png',
		profile: '/characters/avatars/frosty.png',
		poster: '/characters/frosty_poster100.png'
	},
	theme: {
		primary: '#00b4d8',
		secondary: '#023e8a',
		glow: { ready: 'var(--frost-bright)', unchained: 'var(--unchained)' },
		hp: 'linear-gradient( -90deg,  rgba(75,228,255,1) 11.2%, rgba(188,204,251,1) 100.6% );',
		energy: 'linear-gradient(to left, #26a0da, #314755);',
	},
};
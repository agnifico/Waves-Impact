import type { Character } from '$lib/types/character';

// ⚠️ PLACEHOLDER UNIT — Carla is a rough draft (the Dark dealer slated for a proper
// redesign). This file is migrated to the new delivery/onHit structure so it
// type-checks and runs, but the kit itself is NOT balanced or final. In particular,
// her V's original multi-stage `stages[]` scaffolding (lock → execute) doesn't exist
// in the engine; it's been collapsed to a single board-wide damage_aoe burst so she
// runs. Redesign properly later.

export const carla: Character = {
	id: 'carla',
	name: 'Carla',
	element: 'dark',
	maxHp: 200,
	maxEnergy: 100,
	baCooldownMs: [50, 50, 50],
	baChainResetMs: 1000,

	basicStyle: 'chain',
	basicChain: [
		{
			name: 'Tactical Draw (1)',
			range: 8,
			omniTarget: true,
			dashBack: 1,
			delivery: { damage: 6, energyGain: 12, shape: 'melee' },
			onHit: { poiseDamage: 10 },
			fx: { strike: 'bullet', colors: ['#f35b04', '#c084fc'] }
		},
		{
			name: 'Crimson Sheath (2)',
			range: 8,
			omniTarget: true,
			delivery: { damage: 10, energyGain: 12, shape: 'melee' },
			onHit: { poiseDamage: 12 },
			fx: { strike: 'bullet', colors: ['#f7b801', 'var(--gold-bright)'] }
		},
		{
			name: 'Glint of Execution (3)',
			range: 8,
			omniTarget: true,
			delivery: { damage: 18, energyGain: 15, shape: 'melee', grantsStack: 'discipline' },
			onHit: { poiseDamage: 25, appliesEffects: ['tactical_mark'] },
			fx: { strike: 'bullet', gashes: 7, colors: ['#7678ed', '#ff003c'] }
		}
	],

	abilities: {
		// X — Nightshade Lunge: aimed dash that marks along its path
		X: {
			id: 'nightshade_lunge',
			name: 'Nightshade Lunge',
			behavior: 'dash',
			cooldownMs: 5000,
			delivery: {
				damage: 16,
				energyGain: 10,
				grantsStack: 'discipline',
				shapeParams: { range: 4, throughObstacles: false },
				holdBehavior: 'aim'
			},
			onHit: { appliesEffects: ['tactical_mark'] }
		},

		// C — Command: Ominous Sweep: aimed AoE burst with stun
		C: {
			id: 'ominous_sweep',
			name: 'Command: Ominous Sweep',
			behavior: 'damage_aoe',
			cooldownMs: 6000,
			charges: 2,
			delivery: {
				damage: 10,
				energyGain: 15,
				grantsStack: 'discipline',
				shape: 'circle',
				shapeParams: { radius: 1, range: 4 },
				autoTargetEnemy: true,
				holdBehavior: 'aim'
			},
			onHit: { stunMs: 2000, poiseDamage: 20 }
		},

		// V — Absolute Midnight: PLACEHOLDER. Original design was a 2-stage
		// lock-then-execute on marked targets, scaling with discipline stacks. The
		// staged system doesn't exist yet — collapsed to a single board-wide burst.
		// Redesign when Carla gets her proper pass.
		V: {
			id: 'absolute_midnight',
			name: 'Absolute Midnight',
			behavior: 'damage_aoe',
			durationMs: 8000,
			cooldownMs: 24000,
			energyCost: 60,
			unchainedBonus: 30,   // legacy hook retained; not the intended per-stack scaling
			delivery: {
				damage: 60,
				shape: 'circle',
				shapeParams: { radius: 8, range: 8 },
				autoTargetEnemy: true
			}
		}
	},

	stackType: 'discipline',
	stackName: 'Tactical Discipline',
	stackMax: 4,
	onStackFull: 'none',

	stratum: 'ground',
	offFieldStackBonus: 1.2,

	art: {
		gem: '/characters/carla5.png',
		profile: '/characters/avatars2/carla.png',
		poster: '/characters/carla1.png',
		bannerPoster: '/characters/carla4.png'
	},
	theme: {
		primary: '#9b5de5',
		secondary: '#e26d5c',
		glow: { ready: '#c084fc' },
		hp: 'linear-gradient(-90deg, #1f1135 0%, #4c1d95 50%, #ff003c 100%);',
		energy: 'linear-gradient(to right, #2e1065, #7c3aed);'
	}
};
import type { Character } from '$lib/types/character';

export const jamilya: Character = {
	id: 'jamilya',
	name: 'jamilya',
	element: 'wind',
	maxHp: 200,
	maxEnergy: 100,
	// baCooldownMs: [100, 100, 100, 100, 100], 
	baChainResetMs: 1200,

	description: 'A robotic maid of cold precision. Builds Memory with her gunfire, burns it on a sustained stream or detonates her marks all at once. Loyal beyond reason to a master across the dark.',

	basicStyle: 'chain',
	basicChain: [
		{
			name: 'Boot Sequence',
			range: 10,
			omniTarget: true,
			delivery: { damage: 10, energyGain: 12, shape: 'melee', windUpMs: 150, windUpStyle: 'bow', },
			fx: { strike: 'bullet', trail: true, colors: ['#da627d', '#f48498'] }
		},
		{
		name: 'Process Spawn',
			range: 8,
			omniTarget: true,
			delivery: { damage: 15, energyGain: 12, shape: 'melee', windUpMs: 150, windUpStyle: 'pistol', },
			fx: { strike: 'bullet', trail: true, colors: ['#da627d', '#f48498'] }
		},
		{
			name: 'Thread Execution',
			range: 8,
			omniTarget: true,
			delivery: { damage: 15, energyGain: 12, shape: 'melee', windUpMs: 100, windUpStyle: 'pistol', },
			fx: { strike: 'bullet', trail: true, colors: ['#da627d', '#f48498'] }
		},
		{
			name: 'Buffer Overflow',
			range: 8,
			omniTarget: true,
			delivery: { damage: 20, energyGain: 12, shape: 'melee', windUpMs: 200, windUpStyle: 'bow', },
			fx: { strike: 'beam', volley: 'single', colors: ['#f48498', '#e63946'] }
		},
		{
			name: 'Kernel Panic',
			range: 8,
			omniTarget: true,
			delivery: { damage: 30, energyGain: 14, shape: 'melee', grantsStack: 'memory', windUpMs: 300, windUpStyle: 'bow', },
			fx: { strike: 'beam', volley: 'double', colors: ['#f48498', '#e63946'] }
			// fx: { strike: 'laserarc', gashes: 5, colors: ['#e63946', '#ff003c'] }
		}
	],

	// Hold BA -> Stream Buffer: sustained 4-shots/sec stream, 1 Memory per second.
	channelBasic: {
		name: 'Stream Buffer',
		intervalMs: 250, // 4 shots/sec
		drainPerStackMs: 1000, // 1 Memory = 1 second of fire
		range: 7,
		delivery: { damage: 15 },
		onHit: { appliesEffects: ['thread'] }, // each shot refreshes the mark on its target
		fx: { strike: 'stream', colors: ['#c084fc', '#ff003c'] }
	},

	abilities: {
		// X — Mass Indexing: mid AoE, small damage, marks everything in range.
		X: {
			id: 'mass_indexing',
			name: 'Mass Indexing',
			behavior: 'damage_aoe',
			cooldownMs: 8000,
			delivery: {
				windUpMs: 300, windUpStyle: 'ranged',
				damage: 10,
				energyGain: 10,
				grantsStack: 'memory',
				shape: 'circle',
				shapeParams: { radius: 2, range: 5 },
				autoTargetEnemy: true,
				holdBehavior: 'aim'
			},
			onHit: { appliesEffects: ['thread'] }
		},

		// C — Deploy Pointer: single-tile hit, marks one (locked, else first on tile).
		C: {
			id: 'deploy_pointer',
			name: 'Deploy Pointer',
			behavior: 'damage_aoe',
			cooldownMs: 5000,
			charges: 2,
			delivery: {
				damage: 14,
				energyGain: 10,
				grantsStack: 'memory',
				shape: 'circle',
				shapeParams: { radius: 0, range: 6 },
				autoTargetEnemy: true,
				holdBehavior: 'aim'
			},
			onHit: { appliesEffects: ['thread'] }
		},

		// V — Protocol Override: dump all Memory as a barrage across all marked targets.
		V: {
			id: 'protocol_override',
			name: 'Protocol Override',
			behavior: 'tactical_detonate',
			cooldownMs: 18000,
			energyCost: 40,
			delivery: { windUpMs: 1000, windUpStyle: 'melee' }, // gem charges 500ms, then the barrage
			onHit: {},
			fx: { strike: 'laserarc', colors: ['#c084fc', '#ff003c'] } // beam to each marked enemy
		}
	},

	stackType: 'memory',
	stackName: 'Memory',
	stackMax: 10,
	onStackFull: 'none', // hold-and-spend fuel tank; never auto-converts

	stratum: 'ground',
	offFieldStackBonus: 1.2,

	art: {
		gem: '/jamilya/gem.png',
		profile: '/jamilya/3.png',
		poster: '/jamilya/6.png',
		bannerPoster: '/jamilya/9.png'
	},
	theme: {
		primary: '#7f4f24',
		secondary: '#0353a4',
		glow: { ready: '#00b4d8' },
		signatureFx: 'sig-threads',
		hp: 'linear-gradient(-90deg, #936639 0%, #7f4f24 50%, #f6bd60 100%);',
		energy: 'linear-gradient(to right, #2e1065, #06d6a0);',
		resources: [{ id: 'memory', fill: 'linear-gradient(180deg,#c084fc,#7c3aed)', label: 'Memory' }]
	},
	baCooldownMs: 0
};
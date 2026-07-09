import type { Character } from '$lib/types/character';

/**
 * Luna — CA test character. Three abilities cover all three CA archetypes:
 *   X  → Resonance Stance  (Arch 3: stance with stack-buffered duration)
 *   C  → Surge Field       (Arch 2: Albedo-style reactive zone)
 *   V  → Chain Resonance   (Arch 1: party-wide CA burst)
 */
export const luna: Character = {
	id: 'luna',
	name: 'Luna',
	element: 'water',
	maxHp: 180,
	maxEnergy: 100,
	baCooldownMs: [220, 220, 350],
	baChainResetMs: 1800,

	basicStyle: 'chain',
	basicChain: [
		{
			name: 'Resonant Strike I',
			range: 3,
			omniTarget: true,
			delivery: { damage: 20, energyGain: 8, grantsStack: 'depth_charge' },
			fx: { strike: 'seeker', castCls: 'fx-cast-wave', shape: 'wave', fromCaster: 'left', colors: ['#7AF5FF', '#2A6FD6'] }
		},
		{
			name: 'Resonant Strike II',
			range: 3,
			omniTarget: true,
			delivery: { damage: 20, energyGain: 8, grantsStack: 'depth_charge' },
			fx: { strike: 'seeker', castCls: 'fx-cast-wave', shape: 'wave', fromCaster: 'right', colors: ['#00F5D4', '#0488C9'] }
		},
		{
			name: 'Resonant Strike III',
			range: 3,
			omniTarget: true,
			delivery: { damage: 30, energyGain: 12, grantsStack: 'depth_charge' },
			fx: { strike: 'seeker', fromCaster: 'both', colors: ['#1B4A8A', '#AEF6FF'] }
		}
	],


	abilities: {
		// ── X: Resonance Stance (Arch 3) ──────────────────────────────────────────
		// Activates a personal CA stance. Duration = 10 s base + 4 s per pending stack.
		// At max stacks (4): stance gets +50 % CA damage on activation.
		// Pending stacks build whenever any party member uses their V.
		X: {
			id: 'resonance_stance',
			name: 'Resonance Stance',
			behavior: 'coord_attack_stance',
			energyCost: 0,
			cooldownMs: 6000,
			caStance: {
				baseDurationMs: 10_000,
				stacksPerExtendMs: 4_000,
				stackMax: 4,
				config: {
					trigger: 'both',
					hitCount: 3,
					dmgPerHit: 25,
					targeting: 'locked',
					internalCooldownMs: 600,
					triggerPer: 'hit',
					energyPerHit: 3
				}
			},
			fx: { strike: 'splash', colors: ['#7c3aed', '#a78bfa'], }
		},

		// ── C: Surge Field (Arch 2) ────────────────────────────────────────────────
		// Drops a reactive zone (radius 2). Any damage dealt to an enemy inside
		// also triggers a 30-dmg hit from Luna (1.5 s per-enemy cooldown).
		C: {
			id: 'surge_field',
			name: 'Surge Field',
			behavior: 'zone',
			energyCost: 0,
			cooldownMs: 12_000,
			durationMs: 10_000,
			zoneFollows: 'active',
			delivery: {
				shape: 'circle',
				shapeParams: { radius: 5 },
				damage: 25,
			},
			zoneBuff: {
				reactive: { dmg: 30, cooldownMs: 500 }
			},
			fx: { strike: 'uppercut', colors: ['#90e0ef', '#0077b6'] }
		},

		// ── V: Chain Resonance (Arch 1) ────────────────────────────────────────────
		// AoE burst (radius 3, 40 dmg) then grants the whole party a 12 s CA buff:
		// each BA hit fires 4 CA hits (2 locked + 2 random nearby, 15 dmg each).
		V: {
			id: 'chain_resonance',
			name: 'Chain Resonance',
			behavior: 'coord_attack_grant',
			energyCost: 50,
			cooldownMs: 15_000,
			delivery: {
				damage: 40,
				energyGain: 20,
				shape: 'circle',
				shapeParams: { radius: 3 }
			},
			caGrant: {
				targets: 'party',
				durationMs: 12_000,
				config: {
					trigger: 'ba',
					hitCount: 4,
					dmgPerHit: 15,
					targeting: 'split',
					splitRange: 3,
					internalCooldownMs: 800,
					triggerPer: 'hit',
					energyPerHit: 2
				}
			},
			fx: { strike: 'splash', colors: ['#4361ee', '#4cc9f0'] }
		}
	},

	// Minimal stack system — Luna's BA doesn't grant stacks, so this never fires.
	stackType: 'depth_charge',
	stackName: 'Depth Charge',
	stackMax: 5,
	// onStackFull: 'shield',

	// Arch 3 stack buffering — a V cast by anyone in the party adds 1 pending stack.
	caPendingStackOnPartyV: true,
	caPendingStackMax: 4,

	stratum: 'ground',

	art: {
		gem: '/characters/luna5.png',     // placeholder until Luna art exists
		profile: '/characters/avatars2/luna.png',
		poster: '/characters/luna2.png',
		bannerPoster: '/characters/luna7.png'
	},
	theme: {
		primary: '#4cc9f0',
		secondary: '#006494',
		glow: { ready: '#a78bfa' },
		hp: 'linear-gradient(-90deg, #00a896 0%, #62b6cb 50%, #cae9ff 100%)',
		energy: 'linear-gradient(to left, #00a896, #62b6cb)'
	}
};

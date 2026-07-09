import type { WaveDef } from '$lib/types/state';

export interface ChallengeDef {
	id: string;
	label: string;
	waves: WaveDef[];
}

export const CHALLENGES: Record<string, ChallengeDef> = {
	trial_1: {
		id: 'trial_1',
		label: 'Trial I — 4 Waves',
		waves: [
			{ enemies: [{ enemyId: 'bear' }], intermissionMs: 2500 },
			{ enemies: [{ enemyId: 'forest_prowler' }, { enemyId: 'bear' }], intermissionMs: 3000 },
			{ enemies: [{ enemyId: 'vanguard_siren' }, { enemyId: 'solis_sentinel' }], intermissionMs: 3000 },
			{ enemies: [{ enemyId: 'dragon' }], intermissionMs: 3000 },
		]
	},
	gauntlet_5: {
		id: 'gauntlet_5',
		label: 'Gauntlet — 5 Waves',
		waves: [
			{ enemies: [{ enemyId: 'bob' }, { enemyId: 'bear' }], intermissionMs: 2500 },
			{ enemies: [{ enemyId: 'forest_prowler' }, { enemyId: 'vanguard_siren' }], intermissionMs: 3000 },
			{ enemies: [{ enemyId: 'punching_tortoise' }, { enemyId: 'solis_sentinel' }], intermissionMs: 3000 },
			{ enemies: [{ enemyId: 'forest_prowler' }, { enemyId: 'vanguard_siren' }, { enemyId: 'bear' }], intermissionMs: 3500 },
			{ enemies: [{ enemyId: 'dragon' }, { enemyId: 'solis_sentinel' }], intermissionMs: 3500 },
		]
	},
	timed_gauntlet: {
		id: 'timed_gauntlet',
		label: 'Timed Gauntlet — 3 Waves',
		waves: [
			{ enemies: [{ enemyId: 'bear' }, { enemyId: 'bob' }], intermissionMs: 2500, timeLimitMs: 30000 },
			{ enemies: [{ enemyId: 'forest_prowler' }, { enemyId: 'solis_sentinel' }], intermissionMs: 3000, timeLimitMs: 25000 },
			{ enemies: [{ enemyId: 'dragon' }, { enemyId: 'vanguard_siren' }], intermissionMs: 3000, timeLimitMs: 45000 },
		]
	}
};

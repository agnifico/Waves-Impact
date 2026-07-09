import type { Effect } from '$lib/types/effect';

/** Minimal registry entry for a personal CA stance granted by coord_attack_stance.
 *  Duration and caConfig are both set at runtime by the behavior. */
export const ca_stance: Effect = {
	id: 'ca_stance',
	durationMs: 10000,
	stacking: 'refresh',
	onApply: [],
	onTick: [],
	onExpire: [],
	modifies: []
};

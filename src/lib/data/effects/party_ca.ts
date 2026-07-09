import type { Effect } from '$lib/types/effect';

/** Minimal registry entry for the party-wide CA buff granted by coord_attack_grant.
 *  The live caConfig is embedded on EffectInstance by the behavior, not here. */
export const party_ca: Effect = {
	id: 'party_ca',
	durationMs: 12000,
	stacking: 'refresh',
	onApply: [],
	onTick: [],
	onExpire: [],
	modifies: []
};

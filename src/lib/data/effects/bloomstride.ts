import type { Effect } from '$lib/types/effect';

/**
 * Bloomstride: June9's stack-full buff, applied to entire party.
 * +50% damage, heals active character 10/sec for 10 seconds.
 */
export const bloomstride: Effect = {
	id: 'bloomstride',
	durationMs: 10000,
	stacking: 'refresh',
	onApply: [],
	onTick: [{ type: 'heal', amount: 10, tickMs: 1000, activeOnly: true }],
	onExpire: [],
	modifies: [{ stat: 'damageBonus', value: 0.5 }],
	tickMs: 1000
};

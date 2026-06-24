import type { Effect } from '$lib/types/effect';

export const frost_aura: Effect = {
	id: 'frost_aura',
	durationMs: -1,
	stacking: 'refresh',
	onApply: [],
	onTick: [],
	onExpire: [],
	scalesWithSourceStacks: true,
	modifies: [
		{ stat: 'damageBonus', value: 0.10, appliesTo: ['ba'], target: 'active' }
	]
}

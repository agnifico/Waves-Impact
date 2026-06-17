import type { Effect } from '$lib/types/effect';
export const shield: Effect = {
	id: 'shield', durationMs: -1, stacking: 'add',
	onApply: [], onTick: [], onExpire: [], modifies: []
};
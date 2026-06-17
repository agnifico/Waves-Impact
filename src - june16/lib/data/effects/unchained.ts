import type { Effect } from '$lib/types/effect';

/**
 * Unchained: Frosty's stack-full buff.
 * Permanent until consumed by the next ability cast with unchainedBonus.
 * No passive stat mods — the bonus is applied at consumption time.
 */
export const unchained: Effect = {
	id: 'unchained',
	durationMs: -1, // permanent until consumed
	stacking: 'replace',
	onApply: [],
	onTick: [],
	onExpire: [],
	modifies: []
};

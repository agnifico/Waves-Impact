import type { Effect } from '$lib/types/effect';

/**
 * thread — Carla's mark ("Thread"). An inert tag applied by her abilities and
 * refreshed by her channel (Stream Buffer). Does nothing on its own; her ult
 * (Protocol Override) reads it to pick detonation targets, then strips it.
 *
 * Decays on its own after durationMs — marks are a maintenance resource, so a
 * mark left untended expires and is lost. Refreshing (channel hit) resets the timer.
 */
export const thread: Effect = {
	id: 'thread',
	durationMs: 6000,        // mark window — detonate before it decays
	stacking: 'refresh',     // re-applying resets the timer (channel keeps it alive)
	onApply: [],
	onTick: [],
	onExpire: [],
	modifies: []
};
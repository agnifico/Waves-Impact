import type { CombatEventMap, CombatEventName } from '$lib/types/events';

type Handler<T> = (payload: T) => void;

const listeners = new Map<string, Handler<unknown>[]>();

/**
 * Subscribe to a combat event. Returns an unsubscribe function.
 *
 * ```ts
 * const unsub = subscribe('damage:dealt', e => {
 *   if (e.amount > 20) shakeScreen();
 * });
 * // later: unsub();
 * ```
 */
export function subscribe<E extends CombatEventName>(
	event: E,
	handler: Handler<CombatEventMap[E]>
): () => void {
	if (!listeners.has(event)) listeners.set(event, []);
	listeners.get(event)!.push(handler as Handler<unknown>);

	return () => {
		const list = listeners.get(event);
		if (list) {
			const idx = list.indexOf(handler as Handler<unknown>);
			if (idx >= 0) list.splice(idx, 1);
		}
	};
}

/**
 * Publish a combat event. All subscribers for this event name
 * are called synchronously with the payload.
 */
export function publish<E extends CombatEventName>(
	event: E,
	payload: CombatEventMap[E]
): void {
	const list = listeners.get(event);
	if (!list) return;
	for (const fn of list) fn(payload);
}

/** Remove all subscribers. Call on fight reset. */
export function clear(): void {
	listeners.clear();
}

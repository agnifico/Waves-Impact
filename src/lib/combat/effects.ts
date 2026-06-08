import type { EffectInstance } from '$lib/types/effect';
import { publish } from './events';

/** Any entity that carries active effects. */
type HasEffects = { id: string; activeEffects: Record<string, EffectInstance> };

/**
 * Apply an effect to an entity. If the effect already exists,
 * the timer is refreshed (stacking modes will use the Effect registry
 * once populated — for now, refresh is the default).
 */
export function applyEffect(
	entity: HasEffects,
	effectId: string,
	source: string,
	durationMs: number,
	now: number
): void {
	const existing = entity.activeEffects[effectId];

	if (existing) {
		// Refresh: reset expiry timer, update source
		existing.expiresAt = durationMs === -1 ? -1 : now + durationMs;
		existing.appliedAt = now;
		existing.source = source;
	} else {
		entity.activeEffects[effectId] = {
			id: effectId,
			appliedAt: now,
			expiresAt: durationMs === -1 ? -1 : now + durationMs,
			stacks: 1,
			source,
			lastTickAt: now
		};
	}

	publish('effect:applied', {
		target: entity.id,
		effectId,
		source,
		duration: durationMs
	});
}

/**
 * Remove an effect from an entity. Publishes 'effect:expired'.
 */
export function removeEffect(entity: HasEffects, effectId: string): void {
	if (effectId in entity.activeEffects) {
		delete entity.activeEffects[effectId];
		publish('effect:expired', { target: entity.id, effectId });
	}
}

/**
 * Check if an entity has an active effect.
 */
export function hasEffect(entity: HasEffects, effectId: string): boolean {
	return effectId in entity.activeEffects;
}

/**
 * Get an effect instance, or undefined if not active.
 */
export function getEffect(entity: HasEffects, effectId: string): EffectInstance | undefined {
	return entity.activeEffects[effectId];
}

/**
 * Tick all active effects on an entity: expire timed effects,
 * fire onTick hooks. Called once per frame for each entity.
 */
export function tickEffects(entity: HasEffects, now: number): void {
	for (const id in entity.activeEffects) {
		const inst = entity.activeEffects[id];

		// Expire timed effects
		if (inst.expiresAt !== -1 && now >= inst.expiresAt) {
			removeEffect(entity, id);
			continue;
		}

		// TODO: onTick hooks (damage-over-time, heal-over-time)
		// Will use Effect registry lookup: getEffectDef(id).onTick
	}
}

/**
 * Sum all stat modifiers of a given type across active effects.
 * Used by the damage pipeline and other systems.
 *
 * ```ts
 * const bonus = getStatModifier(char, 'damageBonus'); // e.g. 0.5
 * ```
 */
export function getStatModifier(entity: HasEffects, stat: string): number {
	// TODO: look up each active effect's definition from the Effect registry,
	// sum matching StatMod values. For now, returns 0 (no modification).
	// This will be wired up when the Effect registry is populated.
	return 0;
}

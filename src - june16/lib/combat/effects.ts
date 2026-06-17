import type { EffectInstance } from '$lib/types/effect';
import type { EngineState } from '$lib/types/state';
import { publish } from './events';
import { getEffectDef } from '$lib/data/registry';

type HasEffects = { id: string; activeEffects: Record<string, EffectInstance> };
type LivingEntity = HasEffects & { hp: number; def?: { maxHp?: number } };

// ── Apply / remove / query ───────────────────────────────────────────────────

/** Apply an effect, honoring its StackingMode: refresh (default) / add / replace / block. */
export function applyEffect(entity: HasEffects, effectId: string, source: string, durationMs: number, now: number): void {
	const mode = getEffectDef(effectId)?.stacking ?? 'refresh';
	const existing = entity.activeEffects[effectId];
	const expiresAt = durationMs === -1 ? -1 : now + durationMs;

	if (existing) {
		if (mode === 'block') return;
		if (mode === 'add') existing.stacks += 1;
		if (mode === 'replace') existing.stacks = 1;
		existing.expiresAt = expiresAt;
		existing.appliedAt = now;
		existing.source = source;
	} else {
		entity.activeEffects[effectId] = { id: effectId, appliedAt: now, expiresAt, stacks: 1, source, lastTickAt: now };
	}
	publish('effect:applied', { target: entity.id, effectId, source, duration: durationMs });
}

export function removeEffect(entity: HasEffects, effectId: string): void {
	if (effectId in entity.activeEffects) {
		delete entity.activeEffects[effectId];
		publish('effect:expired', { target: entity.id, effectId });
	}
}
export function hasEffect(entity: HasEffects, effectId: string): boolean {
	return effectId in entity.activeEffects;
}
export function getEffect(entity: HasEffects, effectId: string): EffectInstance | undefined {
	return entity.activeEffects[effectId];
}

// ── Stat modifiers ───────────────────────────────────────────────────────────

/** Sum a stat modifier across active effects (× stacks). Read by the pipeline + mitigation. */
export function getStatModifier(entity: HasEffects, stat: string): number {
	let total = 0;
	for (const id in entity.activeEffects) {
		const inst = entity.activeEffects[id];
		const def = getEffectDef(id);
		if (!def) continue;
		for (const mod of def.modifies) if (mod.stat === stat) total += mod.value * inst.stacks;
	}
	return total;
}

// ── Shields — flexible, reusable absorb pools ────────────────────────────────

export interface ShieldOpts {
	/** Store under a custom id for independent named shields (default 'shield'). */
	effectId?: string;
	/** Lifetime; -1 = until depleted (default). */
	durationMs?: number;
	/** Cap on the pool for this id (e.g. 3×100 = 300). Default uncapped. */
	maxTotal?: number;
}

/** Grant or top-up a shield. The pool lives on the effect instance, so it times out
 *  and shows in UI like any effect. Call from any ability/passive. */
export function grantShield(entity: HasEffects, amount: number, source: string, now: number, opts: ShieldOpts = {}): void {
	if (amount <= 0) return;
	const id = opts.effectId ?? 'shield';
	const cap = opts.maxTotal ?? Infinity;
	const expiresAt = (opts.durationMs ?? -1) === -1 ? -1 : now + (opts.durationMs as number);
	const existing = entity.activeEffects[id];

	if (existing) {
		existing.absorbRemaining = Math.min((existing.absorbRemaining ?? 0) + amount, cap);
		existing.stacks += 1;
		existing.expiresAt = expiresAt;
		existing.appliedAt = now;
		existing.source = source;
	} else {
		entity.activeEffects[id] = { id, appliedAt: now, expiresAt, stacks: 1, source, lastTickAt: now, absorbRemaining: Math.min(amount, cap) };
	}
	publish('shield:gained', { target: entity.id, source, amount, total: entity.activeEffects[id].absorbRemaining ?? 0 });
}

/** Drain incoming damage through absorb pools first; returns leftover that hits HP.
 *  Any effect carrying `absorbRemaining` counts — an effect can buff AND shield. */
export function absorbDamage(entity: HasEffects, amount: number): number {
	let remaining = amount;
	for (const id in entity.activeEffects) {
		if (remaining <= 0) break;
		const inst = entity.activeEffects[id];
		if (!inst.absorbRemaining || inst.absorbRemaining <= 0) continue;
		const used = Math.min(inst.absorbRemaining, remaining);
		inst.absorbRemaining -= used;
		remaining -= used;
		publish('shield:absorbed', { target: entity.id, effectId: id, amount: used });
		if (inst.absorbRemaining <= 0) removeEffect(entity, id);
	}
	return remaining;
}

// ── Per-frame tick ───────────────────────────────────────────────────────────

/** Expire timed effects + fire onTick hooks (DoT/HoT). `state` lets activeOnly hooks
 *  (e.g. heal only the on-field unit) know if this entity is active. */
export function tickEffects(state: EngineState, entity: LivingEntity, now: number): void {
	const isActive = state.party[state.activeSlot]?.id === entity.id;

	for (const id in entity.activeEffects) {
		const inst = entity.activeEffects[id];

		// Expiry — def-independent, so shields without a registry def still expire
		if (inst.expiresAt !== -1 && now >= inst.expiresAt) {
			removeEffect(entity, id);
			continue;
		}

		const def = getEffectDef(id);
		if (!def || !def.tickMs || def.onTick.length === 0) continue;

		if (now - (inst.lastTickAt ?? inst.appliedAt) >= def.tickMs) {
			inst.lastTickAt = now;
			for (const hook of def.onTick) fireTickHook(hook, entity, inst, isActive);
		}
	}
}

function fireTickHook(hook: { type: string; amount?: number; activeOnly?: boolean }, entity: LivingEntity, inst: EffectInstance, isActive: boolean): void {
	const amt = (hook.amount ?? 0) * inst.stacks;
	if (amt <= 0) return;

	if (hook.type === 'heal') {
		if (hook.activeOnly && !isActive) return;
		const before = entity.hp;
		entity.hp = Math.min(entity.def?.maxHp ?? Infinity, before + amt);
		const healed = entity.hp - before;
		if (healed > 0) publish('heal:applied', { target: entity.id, source: inst.source, amount: healed });
	} else if (hook.type === 'damage') {
		entity.hp = Math.max(0, entity.hp - amt);
		publish('damage:dealt', { source: inst.source, target: entity.id, amount: amt, abilityName: inst.id });
		// death/auto-swap handled by the engine's existing post-tick checks
	}
}
import type { EngineState, CharacterState } from '$lib/types/state';
import { applyEffect, removeEffect, hasEffect } from './effects';
import { publish } from './events';
import { getEffectDef } from '$lib/data/registry';

/**
 * Grant one stack of the given type to a character.
 * If stacks reach max, resets to 0 and triggers onStackFull.
 */
export function grantStack(
	state: EngineState,
	char: CharacterState,
	stackType: string,
	now: number,
	opts?: { external?: boolean }
): void {
	if (char.def.stackType !== stackType) return;

	const fullEffect = char.def.onStackFull;
	const converts = !!fullEffect && fullEffect !== 'none'; // 'none' / absent = hold-and-spend

	// Convert-at-max characters can't gain while their buff is up
	if (converts && hasEffect(char, fullEffect)) return;

	// Self-grant cap: a character's OWN sources build only to selfStackCap; stacks
	// beyond it require an external grant (opts.external) from a teammate's mechanic.
	// Default selfStackCap = stackMax (no special cap). Frosty: 3 own, 2 external → 5.
	const cap = opts?.external ? char.def.stackMax : (char.def.selfStackCap ?? char.def.stackMax);
	if (char.stacks.current >= cap) return;

	char.stacks.current = Math.min(char.def.stackMax, char.stacks.current + 1);

	publish('stack:gained', {
		characterId: char.id,
		stackType,
		current: char.stacks.current
	});

	// Only convert-at-max characters reset + trigger; hold-and-spend characters
	// just cap and keep their stacks (Sefyra sits at 6 until she spends them).
	if (converts && char.stacks.current >= char.def.stackMax) {
		char.stacks.current = 0;
		triggerStackFull(state, char, now);
	}

	reconcileStackBuffs(char, now);
}

/**
 * Apply/remove persistent stack-gated buffs to match the character's current
 * stack count. Declared on the character as `stackEffects: [{ effectId, minStacks }]`.
 * Portable: any character can gate effects on stacks (Frosty's per-stack BA aura
 * at ≥1, her creation buff at 5). Driven each tick + on every stack change.
 */
export function reconcileStackBuffs(char: CharacterState, now: number): void {
	const specs = char.def.stackEffects;
	if (!specs) return;
	for (const spec of specs) {
		const shouldHave = char.stacks.current >= spec.minStacks;
		const has = hasEffect(char, spec.effectId);
		if (shouldHave && !has) {
			const def = getEffectDef(spec.effectId);
			applyEffect(char, spec.effectId, char.id, def?.durationMs ?? -1, now);
		} else if (!shouldHave && has) {
			removeEffect(char, spec.effectId);
		}
	}
}

/**
 * Consume N stacks. Returns true if successful, false if not enough.
 */
export function consumeStack(
	char: CharacterState,
	stackType: string,
	n: number = 1
): boolean {
	if (char.def.stackType !== stackType) return false;
	if (char.stacks.current < n) return false;
	char.stacks.current -= n;
	return true;
}

/**
 * Triggered when stacks reach max. Applies the onStackFull effect
 * to the appropriate targets (self or party). (Data Contract §9)
 */
function triggerStackFull(
	state: EngineState,
	char: CharacterState,
	now: number
): void {
	const effectId = char.def.onStackFull;
	if (!effectId) return;

	// Determine duration from the Effect definition if available
	const def = getEffectDef(effectId);
	const durationMs = def?.durationMs ?? -1;

	// Apply to self or entire party based on character data
	const target = char.def.onStackFullTarget ?? 'self';
	const targets = target === 'party' ? state.party : [char];

	for (const t of targets) {
		applyEffect(t, effectId, char.id, durationMs, now);
	}
}
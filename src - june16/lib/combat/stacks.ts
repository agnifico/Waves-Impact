import type { EngineState, CharacterState } from '$lib/types/state';
import { applyEffect, hasEffect } from './effects';
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
	now: number
): void {
	if (char.def.stackType !== stackType) return;

	const fullEffect = char.def.onStackFull;
	const converts = !!fullEffect && fullEffect !== 'none'; // 'none' / absent = hold-and-spend

	// Convert-at-max characters can't gain while their buff is up
	if (converts && hasEffect(char, fullEffect)) return;

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

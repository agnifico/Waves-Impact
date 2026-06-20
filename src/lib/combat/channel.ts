import type { EngineState, CharacterState } from '$lib/types/state';
import { chebyshev } from './board';
import { focusTarget, nearestEnemy } from './query';
import { consumeStack } from './stacks';
import { applyOnHit, canHitStratum, type ResolveSource } from './resolve';

/**
 * Channel basic-attack driver (Carla's Stream Buffer).
 *
 * A character with `channelBasic` enters channel mode by HOLDING the basic-attack
 * key (set by the input layer: char.channeling = true, one Memory consumed up
 * front). While channeling, this runs each engine tick and:
 *
 *   • fires a shot every `intervalMs` at the focus/nearest target (auto-aim),
 *     routed through applyOnHit (so it refreshes `thread`, lifesteals, etc.)
 *   • drains one Memory stack every `drainPerStackMs` (1 stack = 1 second of fire)
 *
 * Sputters (no fire, no drain) when there's no valid target — you don't burn
 * fuel shooting at nothing. Ends when Memory hits 0, the key is released
 * (channeling=false), or the character is swapped/stunned.
 *
 * Call once per tick from engine.tick(), before/after enemy AI.
 */
export function tickChannel(state: EngineState, now: number): void {
	const char = state.party[state.activeSlot];
	if (!char.channeling) return;

	const cb = char.def.channelBasic;
	if (!cb || char.stunnedUntil > now) {
		char.channeling = false;
		return;
	}

	// Out of fuel → channel ends.
	if (char.stacks.current <= 0) {
		char.channeling = false;
		return;
	}

	// Target: focus/locked first, else nearest; must be within range + stratum.
	const strata = cb.delivery?.hitsStrata;
	let target = focusTarget(state, char.pos);
	if (!target || target.hp <= 0 || chebyshev(char.pos, target.pos) > cb.range || !canHitStratum(strata, target.stratum)) {
		target = nearestEnemy(state, char.pos, cb.range) ?? null;
	}
	if (!target || !canHitStratum(strata, target.stratum)) return; // sputter — no fuel spent

	const src: ResolveSource = {
		owner: char,
		abilityName: cb.name,
		element: char.def.element
	};

	// Fire on the shot interval.
	if (now - (char.channelLastShotAt ?? 0) >= cb.intervalMs) {
		char.channelLastShotAt = now;
		applyOnHit(state, target, cb.delivery?.damage ?? 0, cb.onHit, src, now);
	}

	// Drain Memory on the per-stack interval (decoupled from fire rate).
	if (now - (char.channelLastDrainAt ?? 0) >= cb.drainPerStackMs) {
		char.channelLastDrainAt = now;
		consumeStack(char, char.def.stackType, 1);
	}
}

/** Begin channeling: pay one stack up front, seed timers. Called by the input layer. */
export function startChannel(char: CharacterState, now: number): boolean {
	if (!char.def.channelBasic || char.stacks.current <= 0) return false;
	char.channeling = true;
	char.channelLastShotAt = now - char.def.channelBasic.intervalMs; // fire first shot immediately
	char.channelLastDrainAt = now;                                   // next drain one interval out
	consumeStack(char, char.def.stackType, 1);                       // pay for the first second up front
	return true;
}

/** Stop channeling (key released / swap). */
export function stopChannel(char: CharacterState): void {
	char.channeling = false;
}
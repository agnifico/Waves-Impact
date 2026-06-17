import type { EngineState } from '$lib/types/state';
import { publish } from './events';

/**
 * Attempt to swap to a different party member.
 * The incoming character inherits the outgoing character's board position.
 */
export function trySwap(state: EngineState, slotIdx: number, now: number): void {
	if (state.over) return;
	if (slotIdx >= state.party.length) return;
	if (slotIdx === state.activeSlot) return;
	if (state.party[slotIdx].hp <= 0) return;
	if (now - state.lastSwapAt < state.swapCooldownMs) return;

	const from = state.party[state.activeSlot];
	const oldPos = { ...from.pos };

	// TODO: fire outroSkill if from.def.outroSkill exists

	state.activeSlot = slotIdx;
	const to = state.party[state.activeSlot];
	to.pos = oldPos;
	to.baChainIndex = 0; // swap breaks chain
	state.lastSwapAt = now;

	// TODO: fire introSkill if to.def.introSkill exists

	publish('character:swap', { from: from.id, to: to.id });
}

/**
 * Check if the active character is dead and auto-swap to a living ally.
 * Returns true if a living ally was found, false if party wipe.
 */
export function checkAutoSwap(state: EngineState): boolean {
	const active = state.party[state.activeSlot];
	if (active.hp > 0) return true;

	const aliveIdx = state.party.findIndex((p) => p.hp > 0);
	if (aliveIdx >= 0) {
		const from = active;
		state.activeSlot = aliveIdx;
		publish('character:swap', { from: from.id, to: state.party[aliveIdx].id });
		return true;
	}

	return false; // Party wipe
}

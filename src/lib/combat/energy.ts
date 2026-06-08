import type { EngineState, CharacterState } from '$lib/types/state';

/** Passive trickle for benched members, per OFF_FIELD_REGEN_MS. */
export const OFF_FIELD_REGEN_MS = 1000;
export const OFF_FIELD_REGEN_AMOUNT = 1;
/** Share of a hit's energyGain handed to each off-field member. */
export const OFF_FIELD_HIT_SHARE = 1 / 5;
/** Caster keeps this fraction of energyGain on a whiff. */
export const WHIFF_SELF_RATIO = 0.5;

/**
 * Multiplier on ALL energy a benched character receives (passive + shares).
 * Sefyra's "Advent of the Light" plugs in here → return 1.5 while
 * pc.stacks.current > 0. Defaults to 1 for everyone today.
 */
export function offFieldMultiplier(pc: CharacterState): number {
	if (pc.def.offFieldStackBonus && pc.stacks.current > 0) return pc.def.offFieldStackBonus;
	return 1;
}

/** Passive trickle to every living off-field member. */
export function regenOffField(state: EngineState): void {
	for (let i = 0; i < state.party.length; i++) {
		if (i === state.activeSlot) continue;
		const pc = state.party[i];
		if (pc.hp <= 0) continue;
		pc.energy = Math.min(
			pc.def.maxEnergy,
			pc.energy + OFF_FIELD_REGEN_AMOUNT * offFieldMultiplier(pc)
		);
	}
}

/** Each living off-field member gets their share of a hit's base energy. */
export function grantOffFieldShare(state: EngineState, base: number): void {
	const share = base * OFF_FIELD_HIT_SHARE;
	if (share <= 0) return;
	for (let i = 0; i < state.party.length; i++) {
		if (i === state.activeSlot) continue;
		const pc = state.party[i];
		if (pc.hp <= 0) continue;
		pc.energy = Math.min(pc.def.maxEnergy, pc.energy + share * offFieldMultiplier(pc));
	}
}
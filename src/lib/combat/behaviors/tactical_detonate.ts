import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { hasEffect, removeEffect } from '../effects';
import { applyOnHit, type ResolveSource } from '../resolve';

/**
 * tactical_detonate — Carla's ultimate (Protocol Override).
 *
 * Takes ALL her current Memory (N stacks), forms a damage pool of N × PER_STACK
 * (one stack ≈ one second of channel output), and detonates every enemy carrying
 * her `thread` mark, dividing the pool EVENLY among them. More marked targets →
 * less each (the even split IS the falloff — keeps her flexible, never pole-best:
 * dump-on-one is a nuke, spread is AoE, neither beats the dedicated single-target
 * or AoE units). Strips the mark from each, then empties Memory.
 *
 * Cast is rejected (stacks kept) if there are no marked targets or no Memory.
 */
const PER_STACK = 60; // one stack = one second of channel = 4 shots × 15

export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number
): boolean {
	const memory = caster.stacks.current;
	if (memory <= 0) return false;

	const marked = state.enemies.filter((e) => e.hp > 0 && hasEffect(e, 'thread'));
	if (marked.length === 0) return false;

	const pool = memory * PER_STACK;

	// ─── Easter egg: sun_mark synergy (undocumented) ──────────────────────────
	// If ANY marked enemy also carries 'sun_mark' (a future unit's mark), Carla
	// does NOT divide the pool — every marked target takes the FULL pool. Secret
	// cross-unit interaction; hinted only in flavor text, never in her data.
	// DO NOT DELETE as a mystery: this is intentional, pending the sun unit.
	const sunSynergy = marked.some((e) => hasEffect(e, 'sun_mark'));
	const perTarget = sunSynergy ? pool : Math.round(pool / marked.length);

	const src: ResolveSource = {
		owner: caster,
		abilityName: ability.name,
		element: caster.def.element,
		ability
	};

	marked.forEach((enemy, i) => {
		applyOnHit(state, enemy, perTarget, ability.onHit, src, now);
		removeEffect(enemy, 'thread');
	});

	caster.stacks.current = 0; // spend all Memory
	return true;
}
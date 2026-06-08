import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { chebyshev } from '../board';
import { calculateDamage } from '../pipeline';
import { publish } from '../events';
import { consumeStack } from '../stacks';
import { coversStratum } from '../spatial';

// Tier index 0/1/2 ← hold-time tier, clamped to affordable stacks (see below).
const TIER_DAMAGE = [120, 135, 175];
const TIER_STACK_COST = [0, 1, 2];
const TAP_RANGE = 5; // tier-0 is range-gated; charged tiers ignore range/obstacles

/** Focus/locked enemy if set and alive, else nearest alive. */
function pickTarget(state: EngineState, from: { x: number; y: number }, lockedId?: string) {
	if (lockedId) {
		const l = state.enemies.find((e) => e.id === lockedId && e.hp > 0);
		if (l) return l;
	}
	if (state.focusTargetId) {
		const f = state.enemies.find((e) => e.id === state.focusTargetId && e.hp > 0);
		if (f) return f;
	}
	let best: (typeof state.enemies)[number] | null = null;
	let bestD = Infinity;
	for (const e of state.enemies) {
		if (e.hp <= 0) continue;
		const d = chebyshev(from, e.pos);
		if (d < bestD) { bestD = d; best = e; }
	}
	return best;
}

/**
 * Cloudpiercer: auto-locked tiered shot.
 * `opts.tier` is the hold-time tier (0/1/2) supplied by the input layer;
 * absent → tier 0 (a tap). Effective tier is clamped down to what Divinity
 * can afford, then that many stacks are consumed. X never grants stacks.
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	_now: number,
	opts: Record<string, unknown> = {}
): boolean {
	const target = pickTarget(state, caster.pos, opts.lockedTargetId as string | undefined);
	if (!target) return false;
	if (!coversStratum(ability.hits, target.stratum)) return false;

	const timeTier = Math.max(0, Math.min(2, (opts.tier as number) ?? 0));
	const stacks = caster.stacks.current;
	let tier = timeTier;
	while (tier > 0 && stacks < TIER_STACK_COST[tier]) tier--; // cap to affordable

	// Tier 0 must be in lock range; charged tiers hit from anywhere.
	if (tier === 0 && chebyshev(caster.pos, target.pos) > TAP_RANGE) return false;

	if (TIER_STACK_COST[tier] > 0 && caster.def.stackType) {
		consumeStack(caster, caster.def.stackType, TIER_STACK_COST[tier]);
	}

	const dmg = calculateDamage(TIER_DAMAGE[tier], {
		source: caster,
		target,
		ability,
		element: caster.def.element,
		state
	});
	target.hp = Math.max(0, target.hp - dmg);
	publish('damage:dealt', {
		source: caster.id,
		target: target.id,
		amount: dmg,
		abilityName: ability.name,
		element: caster.def.element
	});
	if (target.hp <= 0) publish('enemy:defeated', { enemyId: target.id, killer: caster.id });
	return true;
}
import type { EngineState, CharacterState, EnemyState } from '$lib/types/state';
import { chebyshev, samePos, step8Away, step8Toward, clamp } from './board';
import { resolveTiles } from './shapes';
import { consumeStack } from './stacks';
import { focusTarget } from './query';
import { publish } from './events';
import { coversStratum } from './spatial';
import { applyDelivery, applyOnHit, type ResolveSource } from './resolve';
import type { EnhancedCondition } from '$lib/types';

/**
 * Basic attacks. Both styles (chain / contextual) share ONE target-acquisition
 * path (acquireTarget) and ONE hit-application path (applyBasicHit). The style
 * functions only own their control flow: chain owns index/advance, contextual
 * owns base/withStack selection.
 *
 * Target model (single-target focus, as the engine has always done):
 *   • omniTarget        → focus enemy within `range` (Chebyshev), facing-agnostic
 *   • shape === 'melee'  → focus enemy within `range`; wrong stratum = whiff event
 *   • any other shape    → focus enemy must lie inside resolveTiles(shape, …)
 *
 * `hold` is the tap-vs-hold signal from the input layer. It only matters for a
 * contextual BA whose contextualBasic.selectBy === 'hold' (June 9): tap → base,
 * hold → enhanced. Everyone else ignores it.
 */
export function tryBasicAttack(state: EngineState, now: number, hold: boolean = false): void {
	if (state.over) return;
	const char = state.party[state.activeSlot];
	if (char.stunnedUntil > now) return;

	// Rhythmic wind-up: a committed swing is in flight — no new swing until it lands.
	if (char.pendingBasic) return;

	const baCd = char.def.baCooldownMs;
	let cd: number;
	if (Array.isArray(baCd)) {
		const reset = now - char.lastBaTimestamp > char.def.baChainResetMs;
		const idx = reset ? 0 : char.baChainIndex;
		cd = baCd[idx] ?? baCd[0] ?? 0;
	} else {
		cd = baCd;
	}
	if (now - char.lastActionTimestamp < cd) return;

	if (shouldFireEnhanced(char, now, hold)) {
		resolveEnhanced(state, char, now);
	} else if (char.def.basicStyle === 'contextual' && char.def.contextualBasic) {
		resolveContextual(state, char, now, hold);
	} else if (char.def.basicStyle === 'chain' && char.def.basicChain) {
		resolveChain(state, char, now);
	}
}

// ─── Shared target acquisition ───────────────────────────────────────────────

type BasicAttackData = NonNullable<CharacterState['def']['basicChain']>[number];

// ─── Enhanced BA — condition checks ─────────────────────────────────────────

function meetsCondition(c: EnhancedCondition, char: CharacterState, now: number): boolean {
	switch (c.type) {
		case 'stacks_min':
			return char.stacks.current >= c.n;
		case 'stacks_exact':
			return char.stacks.current === c.n;
		case 'post_ability':
			return !!char.lastAction
				&& !char.lastAction.tag.startsWith('ba')
				&& (now - char.lastAction.at <= c.windowMs);
		case 'post_hit':
			return !!char.lastHitAt && (now - char.lastHitAt <= c.windowMs);
		case 'post_dash':
			return !!char.lastAction
				&& char.lastAction.tag === 'dash'
				&& (now - char.lastAction.at <= c.windowMs);
		case 'chain_finisher': {
			const chain = char.def.basicChain;
			return !!chain && char.baChainIndex === chain.length - 1;
		}
		case 'energy_threshold':
			return char.def.maxEnergy > 0
				&& (char.energy / char.def.maxEnergy) >= c.pct;
	}
}

/**
 * Exported so the UI layer can read availability to show the BA button glow.
 * Does NOT check requireHold — that's a trigger concern, not an availability concern.
 */
export function isEnhancedAvailable(char: CharacterState, now: number): boolean {
	const enh = char.def.enhancedBasic;
	if (!enh) return false;
	return enh.conditions.some((c) => meetsCondition(c, char, now));
}

function shouldFireEnhanced(char: CharacterState, now: number, hold: boolean): boolean {
	const enh = char.def.enhancedBasic;
	if (!enh || !isEnhancedAvailable(char, now)) return false;
	if (enh.requireHold && !hold) return false;
	if (enh.interruptsChain === false) {
		const chain = char.def.basicChain;
		if (chain && char.baChainIndex !== chain.length - 1) return false;
	}
	return true;
}

// ─── Enhanced BA — resolution ────────────────────────────────────────────────

function resolveEnhanced(state: EngineState, char: CharacterState, now: number): void {
	const ba = char.def.enhancedBasic!.ba;
	const acq = acquireTarget(state, char, ba);
	if (!acq.ok) {
		if (acq.whiff) publish('basic:missed', { target: acq.whiff.id, abilityName: acq.whiff.name });
		char.lastActionTimestamp = now;
		return;
	}
	maybeDeferBasic(state, char, ba, acq.enemy, now);
	char.baChainIndex = 0;           // reset combo after enhanced hit
	char.lastBaTimestamp = now;
	char.lastActionTimestamp = now;
	char.lastAction = { tag: 'ba_enhanced', at: now };
}

type Acq =
	| { ok: true; enemy: EnemyState }
	| { ok: false; whiff?: { id: string; name: string } };

/** Resolve whether this BA has a legal focus target right now. */
function acquireTarget(state: EngineState, char: CharacterState, ba: BasicAttackData): Acq {
	const enemy = focusTarget(state, char.pos);
	if (!enemy) return { ok: false };

	const shape = ba.delivery?.shape;
	const inStratum = coversStratum(ba.delivery?.hitsStrata, enemy.stratum);

	if (ba.omniTarget) {
		if (!inStratum || chebyshev(char.pos, enemy.pos) > ba.range) return { ok: false };
		return { ok: true, enemy };
	}

	if (shape === 'melee' || !shape) {
		if (chebyshev(char.pos, enemy.pos) > ba.range) return { ok: false };
		// in range but wrong stratum (e.g. ground swing vs a flier) → whiff
		if (!inStratum) return { ok: false, whiff: { id: enemy.id, name: ba.name } };
		return { ok: true, enemy };
	}

	// Shaped AoE gate — fires if ANY live enemy is inside the shape, regardless
	// of which enemy happens to be the focus target.  The focus target is preferred
	// for the nominal return value (wind-up direction, events), but the actual hit
	// list is re-resolved at fire time by applyBasicHitAoe.
	const tiles = resolveTiles(shape, char.pos, char.facing, { range: ba.range }, state.board);
	const inShape = state.enemies.find(
		(e) => e.hp > 0 && coversStratum(ba.delivery?.hitsStrata, e.stratum) && tiles.some((t) => samePos(t, e.pos))
	);
	if (!inShape) return { ok: false };
	// Prefer the current focus target if it's in the shape; otherwise use whoever is.
	const primary = (inStratum && tiles.some((t) => samePos(t, enemy.pos))) ? enemy : inShape;
	return { ok: true, enemy: primary };
}

// ─── Shared hit application ──────────────────────────────────────────────────

/** Apply one landed BA: damage (+finisher), heal, energy, stack, dash-back, events. */
export function applyBasicHit(
	state: EngineState,
	char: CharacterState,
	ba: BasicAttackData,
	enemy: EnemyState,
	now: number
): void {
	// Finisher: spend a stack for bonus damage (+ optional team heal / dash-back).
	const consumed = !!ba.consumesStack && char.stacks.current > 0;
	if (consumed) consumeStack(char, ba.consumesStack!, 1);

	// Gap-close BEFORE the hit (it shapes where the strike lands from).
	if (ba.gapClose) {
		const from = { ...char.pos };
		let p = char.pos;
		for (let i = 0; i < ba.range; i++) {
			if (chebyshev(p, enemy.pos) <= 1) break;
			const next = clamp(state.board, step8Toward(p, enemy.pos));
			if (samePos(next, p) || samePos(next, enemy.pos)) break;
			p = next;
		}
		char.pos = p;
		if (!samePos(from, p)) publish('movement:player', { characterId: char.id, from, to: p });
	}

	const src: ResolveSource = {
		owner: char,
		abilityName: ba.name,
		element: char.def.element,
		tags: ['ba']
	};

	// Guaranteed floor — cast-time energy/heal/shield/stack from delivery (with
	// off-field energy share). Lands regardless of whether the swing connects.
	applyDelivery(state, ba.delivery, src, now);

	// Per-hit: base + finisher bonus, through the unified resolver (splash/stun/
	// lifesteal/knockback all via ba.onHit). delivery.hits>1 fires applyOnHit per hit.
	const base = (ba.delivery?.damage ?? 0) + (consumed ? (ba.consumeBonus ?? 0) : 0);
	const shots = Math.max(1, ba.delivery?.hits ?? 1);
	for (let i = 0; i < shots; i++) {
		applyOnHit(state, enemy, base, ba.onHit, src, now);
		if (enemy.hp <= 0) break; // stop multi-hit once dead (defeat event already fired by resolver)
	}

	// Dash back (withStack variant, or any BA that declares it) — AFTER the hit.
	if (ba.dashBack) {
		let p = char.pos;
		for (let i = 0; i < ba.dashBack; i++) {
			const next = clamp(state.board, step8Away(p, enemy.pos));
			if (samePos(next, p)) break;
			p = next;
		}
		char.pos = p;
	}
}

/**
 * AoE variant: hit ALL enemies whose tile falls inside the BA's shape.
 * applyDelivery fires ONCE (guaranteed floor); applyOnHit fires per enemy struck.
 * Used for non-omniTarget shaped BAs where every enemy in the arc gets hit.
 */
export function applyBasicHitAoe(
	state: EngineState,
	char: CharacterState,
	ba: BasicAttackData,
	dir: { x: number; y: number },
	now: number
): void {
	const consumed = !!ba.consumesStack && char.stacks.current > 0;
	if (consumed) consumeStack(char, ba.consumesStack!, 1);

	const src: ResolveSource = {
		owner: char,
		abilityName: ba.name,
		element: char.def.element,
		tags: ['ba']
	};

	applyDelivery(state, ba.delivery, src, now);

	const shape = ba.delivery?.shape;
	if (!shape) return;
	const tiles = resolveTiles(shape, char.pos, dir, { range: ba.range }, state.board);

	// Telegraph the shape eruption so FxLayer can play the wave/erupt animation.
	publish('cast:shape', { caster: char.id, shape, center: char.pos, facing: dir, range: ba.range });

	const base = (ba.delivery?.damage ?? 0) + (consumed ? (ba.consumeBonus ?? 0) : 0);
	const shots = Math.max(1, ba.delivery?.hits ?? 1);

	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		if (!coversStratum(ba.delivery?.hitsStrata, enemy.stratum)) continue;
		if (!tiles.some((t) => samePos(t, enemy.pos))) continue;
		for (let i = 0; i < shots; i++) {
			applyOnHit(state, enemy, base, ba.onHit, src, now);
			if (enemy.hp <= 0) break;
		}
	}
}

/**
 * Rhythmic wind-up: if this BA declares delivery.windUpMs, defer the hit by that
 * long and play the gem wind-up telegraph; the swing pacing IS the wind-up (the
 * next swing is gated on pendingBasic). Otherwise hit immediately. Returns true
 * if the hit was deferred.
 */
function maybeDeferBasic(
	state: EngineState,
	char: CharacterState,
	ba: BasicAttackData,
	enemy: EnemyState,
	now: number
): boolean {
	const wu = ba.delivery?.windUpMs ?? 0;
	// AoE check: any non-omniTarget shaped BA hits all enemies in the shape, not just the locked one.
	const isAoe = !ba.omniTarget && !!ba.delivery?.shape && ba.delivery.shape !== 'melee';
	if (wu <= 0) {
		if (isAoe) {
			applyBasicHitAoe(state, char, ba, char.facing, now);
		} else {
			applyBasicHit(state, char, ba, enemy, now);
		}
		return false;
	}
	char.pendingBasic = {
		enemyId: enemy.id,
		firesAt: now + wu,
		ba,
		// AoE shaped BAs lock to the current facing (what the visual arc shows).
		// Single-target BAs lock to the direction toward the specific enemy.
		dirX: isAoe ? char.facing.x : (Math.sign(enemy.pos.x - char.pos.x) || char.facing.x),
		dirY: isAoe ? char.facing.y : (Math.sign(enemy.pos.y - char.pos.y) || char.facing.y)
	};
	publish('cast:windup', { caster: char.id, slot: 'BA' as never, durationMs: wu });
	return true;
}


// ─── Chain style (Frosty / Sefyra) ───────────────────────────────────────────

function resolveChain(state: EngineState, char: CharacterState, now: number): void {
	const chain = char.def.basicChain!;
	if (now - char.lastBaTimestamp > char.def.baChainResetMs) char.baChainIndex = 0;

	const ba = chain[char.baChainIndex];
	const acq = acquireTarget(state, char, ba);
	if (!acq.ok) {
		if (acq.whiff) publish('basic:missed', { target: acq.whiff.id, abilityName: acq.whiff.name });
		char.lastActionTimestamp = now; // swing-and-miss still gates the next swing
		return;
	}

	maybeDeferBasic(state, char, ba, acq.enemy, now);

	char.lastBaIndexLanded = char.baChainIndex;
	char.lastBaTimestamp = now;
	char.lastActionTimestamp = now;
	char.lastAction = { tag: char.baChainIndex === chain.length - 1 ? 'ba_chain_end' : 'ba', at: now };
	// Advance (gated by advanceOnlyIfMelee). Note: read pos AFTER any dash-back.
	if (!ba.advanceOnlyIfMelee || chebyshev(char.pos, acq.enemy.pos) <= 1) {
		char.baChainIndex = (char.baChainIndex + 1) % chain.length;
	}
}

// ─── Contextual style (June 9 / Maria Elena) ──────────────────────────────────

function resolveContextual(
	state: EngineState,
	char: CharacterState,
	now: number,
	hold: boolean
): void {
	const cb = char.def.contextualBasic!;
	const hasStack = char.stacks.current > 0;

	// 'hold'   → player picks: tap = base, hold = enhanced (only if a stack is bankable).
	// 'stacks' → (default/legacy) auto-enhance whenever a stack exists.
	const useEnhanced = cb.selectBy === 'hold' ? hold && hasStack : hasStack;
	const ba = useEnhanced ? cb.withStack : cb.base;

	const acq = acquireTarget(state, char, ba);
	if (!acq.ok) {
		if (acq.whiff) publish('basic:missed', { target: acq.whiff.id, abilityName: acq.whiff.name });
		char.lastActionTimestamp = now;
		return;
	}

	maybeDeferBasic(state, char, ba, acq.enemy, now);
	char.lastActionTimestamp = now;
	char.lastAction = { tag: 'ba', at: now };
}
import type { EngineState, CharacterState, EnemyState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import type { OnHit, Splash } from '$lib/types/onhit';
import type { Delivery } from '$lib/types/delivery';
import type { HealAmount, ResourcePayload } from '$lib/types/resource';
import type { Position, Stratum } from '$lib/types/common';
import type { DamageTag } from '$lib/types/effect';
import { chebyshev, step8Toward, step8Away, samePos, clamp } from './board';
import { calculateDamage } from './pipeline';
import { grantShield, applyEffect, getEffect } from './effects';
import { grantStack } from './stacks';
import { grantOffFieldShare } from './energy';
import { coversStratum } from './spatial';
import { getEffectDef } from '$lib/data/registry';
import { publish } from './events';

/**
 * resolve.ts — the single home for "what happens when something connects."
 *
 * Replaces the hit-resolution logic that used to be duplicated across
 * basic-attack.ts, dash.ts, zone.ts, and engine.ts (construct pulse + summon
 * attack). Every damage source now funnels through these two functions:
 *
 *   • applyDelivery(...)  — the GUARANTEED cast-time floor: damage/heal/shield/
 *                           energy/stack the caster gets for casting, regardless
 *                           of whether anything is hit. (Healer's cast heal lands
 *                           even on a whiff.)
 *   • applyOnHit(...)     — PER ENEMY STRUCK: primary damage + splash, knockback,
 *                           stun, applied effects, lifesteal, and the per-connect
 *                           resource bonus. Routes owner-bound resources (energy,
 *                           stack) to the OWNER (caster for abilities/BAs; the
 *                           placing character for constructs/summons).
 *
 * Total resource granted = delivery floor (once) + Σ onHit bonus (per target).
 */

// ─── recipient context ───────────────────────────────────────────────────────

/**
 * Who owns this damage and what cosmetic label/element it carries. The owner is
 * the character who gets energy/stacks/heal back — the caster for an ability or
 * BA, the placing character for a construct/summon pulse.
 */
export interface ResolveSource {
	owner: CharacterState;     // receives energyGain / grantsStack / selfHeal / teamHeal / lifesteal
	abilityName: string;       // for damage:dealt events
	element?: string;          // for damage:dealt events + pipeline
	ability?: Ability;         // for pipeline zone/effect lookups (optional)
	originZoneId?: string;     // zone self-bonus marker (optional)
	sourcePos?: Position;      // override for entity-position zone checks (constructs/summons)
	/** Skip the damage pipeline and deal raw, unbuffed damage. Used by creations with
	 *  receiveBuffs:false — the owner's damageBonus/zone buffs must NOT apply. Owner-bound
	 *  resources (energy/stack/heal) still route normally. Default false (pipelined). */
	flatDamage?: boolean;
	/** Damage taxonomy tags for hits from this source. The pipeline filters buffs on
	 *  these. e.g. ['ba'], ['ability'], ['ability','ult'], ['creation'], ['creation','reaction']. */
	tags?: DamageTag[];
}

// ─── heal resolution ───────────────────────────────────────────────────────────

/** Resolve a HealAmount against an entity's HP basis into a flat number. */
export function resolveHeal(amount: HealAmount, maxHp: number, currentHp: number): number {
	if (typeof amount === 'number') return amount;
	const basis =
		amount.pctOf === 'current' ? currentHp
		: amount.pctOf === 'missing' ? Math.max(0, maxHp - currentHp)
		: maxHp; // 'max' (default)
	return Math.round(basis * amount.pct);
}

function healEntity(entity: CharacterState, flat: number, source: string, abilityName: string): void {
	if (flat <= 0) return;
	const before = entity.hp;
	entity.hp = Math.min(entity.def.maxHp, before + flat);
	const healed = entity.hp - before;
	if (healed > 0) {
		publish('heal:applied', { target: entity.id, source, amount: healed, abilityName });
	}
}

// ─── shared resource grants (heal / shield / energy / stack) ─────────────────

/**
 * Apply the owner-bound + team-bound resources of a ResourcePayload (heal, shield,
 * energy, stack). Damage is handled separately by the caller (delivery floor vs
 * on-hit per-target). `now` and `state` thread through for stacks/shields.
 */
function applyResources(
	state: EngineState,
	payload: ResourcePayload,
	src: ResolveSource,
	now: number
): void {
	const owner = src.owner;

	// self heal
	if (payload.selfHeal !== undefined) {
		healEntity(owner, resolveHeal(payload.selfHeal, owner.def.maxHp, owner.hp), owner.id, src.abilityName);
	}
	// team heal
	if (payload.teamHeal !== undefined) {
		for (const pc of state.party) {
			if (pc.hp <= 0) continue;
			healEntity(pc, resolveHeal(payload.teamHeal, pc.def.maxHp, pc.hp), owner.id, src.abilityName);
		}
	}
	// shield
	if (payload.shield) {
		const s = payload.shield;
		const targets = s.target === 'party' ? state.party : [owner];
		for (const t of targets) {
			if (t.hp > 0) {
				grantShield(t, s.amount, owner.id, now, {
					durationMs: s.durationMs, maxTotal: s.maxTotal, effectId: s.effectId
				});
			}
		}
	}
	// energy → owner (+ share to off-field party, as ability/BA energy always has)
	if (payload.energyGain) {
		owner.energy = Math.min(owner.def.maxEnergy, owner.energy + payload.energyGain);
		grantOffFieldShare(state, payload.energyGain);
	}
	// stack → owner
	if (payload.grantsStack) {
		grantStack(state, owner, payload.grantsStack, now);
	}
}

// ─── DELIVERY: the guaranteed cast-time floor ────────────────────────────────

/**
 * Grant the guaranteed floor of a Delivery payload. Call ONCE per cast, before
 * (or regardless of) any hit resolution. Does NOT deal damage to a target —
 * delivery.damage is the *primary hit amount* handed to applyOnHit by the caller;
 * the floor's job here is the non-damage resources that land even on a whiff.
 *
 * (Energy split example: delivery.energyGain:2 always lands; onHit.energyGain:8
 * lands per connect. A whiff yields 2; a clean hit yields 10.)
 */
export function applyDelivery(
	state: EngineState,
	delivery: Delivery | undefined,
	src: ResolveSource,
	now: number
): void {
	if (!delivery) return;
	applyResources(state, delivery, src, now);
}

// ─── ONHIT: per-enemy-struck resolution ──────────────────────────────────────

/**
 * Resolve a single connect against `primary`. Deals `baseDmg` (already chosen by
 * the caller — usually delivery.damage, possibly + bonuses) through the pipeline,
 * then fires the OnHit: splash, knockback, stun, effects, lifesteal, and the
 * per-connect resource bonus.
 *
 * Returns total damage dealt (primary + splash) so callers can track DPS/lifesteal.
 *
 * NOTE on multi-hit: a Delivery with hits>1 calls applyOnHit once per hit. Each
 * call fires the full OnHit (intentionally resource-rich).
 */
export function applyOnHit(
	state: EngineState,
	primary: EnemyState,
	baseDmg: number,
	onHit: OnHit | undefined,
	src: ResolveSource,
	now: number
): number {
	let totalDealt = 0;

	// ── primary damage ──────────────────────────────────────────────
	if (baseDmg > 0) {
		totalDealt += dealDamageTo(state, primary, baseDmg, src);
	}

	if (!onHit) {
		return totalDealt;
	}

	// ── splash ───────────────────────────────────────────────────────
	if (onHit.splash) {
		totalDealt += resolveSplash(state, primary, baseDmg, onHit, onHit.splash, src, now);
	}

	// ── per-target CC + effects on the PRIMARY ───────────────────────
	applyTargetEffects(state, primary, onHit, src, now);

	// ── owner/team resources (per-connect bonus) ─────────────────────
	applyResources(state, onHit, src, now);

	// ── lifesteal (% of total damage dealt this connect) ─────────────
	if (onHit.lifestealPct && totalDealt > 0) {
		healEntity(src.owner, Math.round(totalDealt * (onHit.lifestealPct / 100)), src.owner.id, src.abilityName);
	}

	return totalDealt;
}

// ─── internals ───────────────────────────────────────────────────────────────

/** Pipeline-damage one enemy + publish the canonical events. Returns dmg dealt. */
function dealDamageTo(state: EngineState, enemy: EnemyState, base: number, src: ResolveSource): number {
	const dmg = src.flatDamage
		? Math.max(0, Math.round(base))
		: calculateDamage(base, {
			source: src.owner,
			target: enemy,
			ability: src.ability,
			element: src.element,
			originZoneId: src.originZoneId,
			sourcePos: src.sourcePos,
			tags: src.tags,
			state
		});
	enemy.hp = Math.max(0, enemy.hp - dmg);
	publish('damage:dealt', {
		source: src.owner.id, target: enemy.id, amount: dmg,
		abilityName: src.abilityName, element: src.element
	});
	if (enemy.hp <= 0) publish('enemy:defeated', { enemyId: enemy.id, killer: src.owner.id });
	return dmg;
}

/** Strike tiles around the primary at falloff dmg. Returns total splash dmg dealt. */
function resolveSplash(
	state: EngineState,
	primary: EnemyState,
	baseDmg: number,
	onHit: OnHit,
	splash: Splash,
	src: ResolveSource,
	now: number
): number {
	const falloff = splash.falloff ?? 1;
	const splashDmg = Math.round(baseDmg * falloff);
	let dealt = 0;

	for (const e of state.enemies) {
		if (e.hp <= 0) continue;
		if (e.id === primary.id && !splash.includesPrimary) continue;
		if (chebyshev(e.pos, primary.pos) > splash.radius) continue;

		if (splashDmg > 0) dealt += dealDamageTo(state, e, splashDmg, src);

		// includeEffects: splashed targets also get CC + trigger per-target effects
		if (splash.includeEffects) {
			applyTargetEffects(state, e, onHit, src, now);
		}
	}
	return dealt;
}

/** Apply knockback + stun + appliesEffects to a single struck target. */
function applyTargetEffects(
	state: EngineState,
	enemy: EnemyState,
	onHit: OnHit,
	src: ResolveSource,
	now: number
): void {
	// knockback
	if (onHit.knockback && onHit.knockback > 0) {
		applyKnockbackTo(state, enemy, onHit.knockback, !!onHit.knockbackSmart, src);
		publish('combat:knockback', { target: enemy.id, fromPos: { ...enemy.pos }, ownerPos: { ...(src.sourcePos ?? src.owner.pos) } });
	}
	// stun
	if (onHit.stunMs && onHit.stunMs > 0) {
		enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + onHit.stunMs);
		publish('combat:stun', { target: enemy.id, durationMs: onHit.stunMs });
	}
	// applied effects
	if (onHit.appliesEffects) {
		for (const effId of onHit.appliesEffects) {
			const dur = getEffectDef(effId)?.durationMs ?? -1;
			applyEffect(enemy, effId, src.owner.id, dur, now);
		}
	}
}

/**
 * Push one enemy N tiles. smart=false → away from the owner (standard);
 * smart=true → toward the nearest OTHER enemy (combo gather).
 */
function applyKnockbackTo(
	state: EngineState,
	enemy: EnemyState,
	tiles: number,
	smart: boolean,
	src: ResolveSource
): void {
	const from = { ...enemy.pos };
	let pushToward: Position | null = null;
	if (smart) {
		const others = state.enemies.filter((e) => e.hp > 0 && e.id !== enemy.id);
		if (others.length) {
			pushToward = others.reduce((a, b) =>
				chebyshev(a.pos, enemy.pos) <= chebyshev(b.pos, enemy.pos) ? a : b
			).pos;
		}
	}
	const origin = src.sourcePos ?? src.owner.pos;
	let ep = enemy.pos;
	for (let i = 0; i < tiles; i++) {
		const next = pushToward
			? clamp(state.board, step8Toward(ep, pushToward))
			: clamp(state.board, step8Away(ep, origin));
		if (samePos(next, ep)) break;
		ep = next;
	}
	if (!samePos(from, ep)) {
		enemy.pos = ep;
		publish('movement:enemy', { enemyId: enemy.id, from, to: ep });
	}
}

/** Stratum gate convenience — re-exported so callers don't import spatial directly. */
export function canHitStratum(hitsStrata: Stratum[] | undefined, enemyStratum: Stratum): boolean {
	return coversStratum(hitsStrata, enemyStratum);
}
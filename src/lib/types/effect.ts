/**
 * How reapplication of the same effect is handled. (Data Contract §10)
 * - replace: reset stacks to 1, reset timer
 * - refresh: keep stacks, reset timer (default)
 * - add:     increment stacks, reset timer
 * - extend:  keep stacks, ADD duration to remaining time (sustained-pressure reward)
 * - block:   first application wins; reapply is a no-op until expiry
 */
export type StackingMode = 'replace' | 'refresh' | 'add' | 'extend' | 'block';

/**
 * Damage taxonomy. Every damage instance carries a set of these tags; every buff
 * can filter by them. Roots: ba / ability / creation. The rest refine a root
 * (ult & zone are kinds of ability; dot/reaction refine their source).
 * A buff with no filter touches all damage; `['ba']` catches enhanced BA + BA
 * splash (all carry 'ba'); `['ability']` catches casts/hits/ticks/ult/zone.
 */
export type DamageTag =
	| 'ba'        // basic attack (any chain step, enhanced, channel, splash from a BA)
	| 'ability'   // ability cast/hit/tick
	| 'creation'  // summon attack, construct pulse, catalyst-source reaction
	| 'ult'       // refines 'ability' — the V slot
	| 'zone'      // refines 'ability' — zone ticks
	| 'enhanced'  // refines 'ba' — enhanced/consumed-stack BA
	| 'dot'       // refines source — damage-over-time tick (burn/poison)
	| 'reaction'; // refines 'creation' — Elemental Alchemy (catalyst↔source)

/**
 * A continuous stat modification while an effect is active.
 * Example: { stat: 'damageBonus', value: 0.5 } → +50% damage.
 * `appliesTo` filters damageBonus by tag: omit = all damage; ['ba'] = BA only.
 * `target` routes the mod: 'self' (the effect holder, default) or — for auras —
 * 'active' (whoever is on field) / 'creations' (the owner's summons+constructs).
 */
export interface StatMod {
	stat: string;
	value: number;
	appliesTo?: DamageTag[];
	target?: 'self' | 'active' | 'creations';
}


export interface EffectInstance {
	id: string;
	appliedAt: number;
	expiresAt: number;
	stacks: number;
	source: string;
	lastTickAt?: number;
	/** Shield absorb pool — set by grantShield, drained by absorbDamage. */
	absorbRemaining?: number;
}
/**
 * A hook that fires at a lifecycle point (onApply, onTick, onExpire).
 * The `type` field determines what the hook does; additional fields
 * are type-specific.
 */
export interface EffectHook {
	type: string;
	amount?: number;
	tickMs?: number;
	activeOnly?: boolean;
	[key: string]: unknown;
}

/**
 * Effect definition — the "recipe" for a buff/debuff.
 * Lives in data/effects/. (Data Contract §10)
 */
export interface Effect {
	id: string;
	durationMs: number; // 0 = instant, -1 = permanent until removed
	stacking: StackingMode;
	onApply: EffectHook[];
	onTick: EffectHook[];
	onExpire: EffectHook[];
	modifies: StatMod[];
	tickMs?: number;
	/** Multiply this effect's `modifies` magnitudes by the SOURCE's live stack
	 *  count each time it's read (Frosty's per-stack BA aura). The source is
	 *  resolved by `source` id on the instance. */
	scalesWithSourceStacks?: boolean;
	/** While active, override the holder's runtime stratum (e.g. grants flying). */
	stratum?: string;
}
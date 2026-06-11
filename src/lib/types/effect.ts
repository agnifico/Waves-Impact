/**
 * How reapplication of the same effect is handled. (Data Contract §10)
 */
export type StackingMode = 'replace' | 'refresh' | 'add' | 'block';

/**
 * A continuous stat modification while an effect is active.
 * Example: { stat: 'damageBonus', value: 0.5 } → +50% damage.
 */
export interface StatMod {
	stat: string;
	value: number;
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
}

/**
 * Runtime instance of an active effect on an entity.
 * CharacterState.activeEffects and EnemyState.activeEffects
 * are Record<string, EffectInstance>. (Data Contract §10)
 */
export interface EffectInstance {
	id: string;
	appliedAt: number;
	expiresAt: number; // -1 = permanent until consumed/removed
	stacks: number;
	source: string; // EntityId of who applied this
	lastTickAt?: number;
}

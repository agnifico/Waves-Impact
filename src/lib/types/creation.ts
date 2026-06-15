import type { FxSpec } from './ability';

export type CreationKind = 'summon' | 'construct';

export type SummonTargeting =
    | 'nearest'
    | 'highest_hp'
    | 'lowest_hp'
    | 'guardian'
    | 'stationary';

/**
 * Unified definition for anything a character places on the board.
 * Lives in data/creations.ts; referenced by id from ability data.
 *
 * kind === 'summon'    → mobile agent; uses movement + attack fields.
 * kind === 'construct' → stationary object; uses pulse fields.
 * Shared fields apply to both.
 */
export interface CreationDef {
    id:    string;
    name:  string;
    kind:  CreationKind;
    image?: string;
    durationMs?: number;

    // ── Shared ───────────────────────────────────────────────────
    receiveBuffs?: boolean;   // routes damage through calculateDamage pipeline
    stunMs?: number;          // stun on hit / pulse
    appliesEffects?: string[];
    attackFx?: FxSpec;

    // ── Summon ───────────────────────────────────────────────────
    targeting?: SummonTargeting;
    guardianRadius?: number;  // tiles around caster to protect (default 3)
    stickyTargetMs?: number;  // ms before switching targets (default 1500)
    moveCooldownMs?: number;
    attackCooldownMs?: number;
    attackDamage?: number;
    attackRange?: number;     // stop moving when within this range (default 1)
    aoeRadius?: number;       // splash radius around primary target
    mirrorsOwnerBA?: boolean;

    // ── Construct ─────────────────────────────────────────────────
    constructType?: 'inert' | 'source' | 'catalyst';
    targetingType?: 'pulse' | 'turret';
    pulseDmg?: number;
    pulseMs?: number;
    pulseRadius?: number;
}
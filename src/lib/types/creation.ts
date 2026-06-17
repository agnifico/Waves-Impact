import type { FxSpec } from './ability';
import type { Stratum, Position } from './common';
import type { OnHit } from './onhit';

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
 *
 * Creations don't use Delivery (they don't aim or charge — the ability that
 * places them does). But their pulse/attack DOES land on enemies, so they embed
 * `onHit`: the per-hit consequences (stun, splash, energy→owner, stack→owner,
 * lifesteal, applied effects) flow through the SAME shared payload as abilities
 * and basic attacks. Primary damage stays named (`pulseDmg` / `attackDamage`)
 * because the construct-tick and summon-tick loops read them on different paths.
 */
export interface CreationDef {
    id: string;
    name: string;
    kind: CreationKind;
    image?: string;
    durationMs?: number;

    stratum?: Stratum;        // physical layer; defaults 'ground'
    hitsStrata?: Stratum[];   // strata the pulse/attack can damage; omit = all

    /** Tiles occupied, relative to the placement origin. Omit = [{0,0}] (1×1).
     *  A medium wall is [{-1,0},{0,0},{1,0}]; a ring is its full circle matrix.
     *  ONE construct occupies many tiles — one timer, one icon, many footprint
     *  cells for pathfinding. The origin {0,0} is the visual head (icon tile). */
    footprint?: Position[];

    // ── Shared on-hit (pulse / attack consequences) ──────────────
    /** What happens to each enemy this creation's pulse/attack strikes — and what
     *  the OWNER gets back (energyGain → owner, grantsStack → owner). Replaces the
     *  old flat energyPerHit / grantsOwnerStack / stunMs / appliesEffects. */
    onHit?: OnHit;

    receiveBuffs?: boolean;   // routes damage through calculateDamage pipeline
    attackFx?: FxSpec;

    // ── Summon ───────────────────────────────────────────────────
    targeting?: SummonTargeting;
    guardianRadius?: number;  // tiles around caster to protect (default 3)
    stickyTargetMs?: number;  // ms before switching targets (default 1500)
    moveCooldownMs?: number;
    attackCooldownMs?: number;
    attackDamage?: number;    // primary (summon attack)
    attackRange?: number;     // stop moving when within this range (default 1)
    aoeRadius?: number;       // splash radius around primary target
    mirrorsOwnerBA?: boolean;

    // ── Construct ─────────────────────────────────────────────────
    constructType?: 'inert' | 'source' | 'catalyst';
    targetingType?: 'pulse' | 'turret';
    pulseDmg?: number;        // primary (construct pulse)
    pulseMs?: number;
    pulseRadius?: number;
}
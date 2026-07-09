import type { CreationDef } from '$lib/types/creation';

/**
 * Registry of all summons and constructs.
 * Characters reference these by id via ability.creationId.
 * Element is always inherited from the caster at spawn — not stored here.
 *
 * Per-hit consequences (the damage's CC + the owner's energy/stack payback) all
 * live on `onHit`, the SAME shared payload abilities and basic attacks use. The
 * engine funnels every construct pulse and summon attack through
 * resolve.applyOnHit, so whatever you put on `onHit` here — stun, knockback,
 * energyGain, grantsStack, splash, appliesEffects — just works. Primary damage
 * stays named (`attackDamage` / `pulseDmg`); geometry stays flat (`attackRange`
 * / `pulseRadius`).
 */
export const CREATIONS: Record<string, CreationDef> = {

    // ── Summons ──────────────────────────────────────────────────────────────

    wolfie: {
        id: 'wolfie', name: 'Wolfie', kind: 'summon',
        image: '/characters/wolfie.png',
        durationMs: 16_000,
        targeting: 'nearest',
        stickyTargetMs: 1500,
        moveCooldownMs: 500,
        attackCooldownMs: 1000,
        attackDamage: 75,
        attackRange: 1,
        gapClose: true,
        gapCloseRange: 5,        // lurks until within 5 tiles, then pounces
        receiveBuffs: true,
        onHit: { energyGain: 5 },
    },
    spectral_ship: {
        id: 'spectral_ship', name: 'Paris', kind: 'summon',
        image: '/characters/spectral_ship.png',
        durationMs: 30_000,
        targeting: 'nearest',
        stickyTargetMs: 1500,
        moveCooldownMs: 3000,
        attackCooldownMs: 5000,
        attackDamage: 300,
        attackRange: 7,
        footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
        // footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 },],
        footprintRender: 'scaled',
        juggernaut: true,
        receiveBuffs: true,
        onHit: {
            energyGain: 5,
            grantsStack: 'depths',
            stunMs: 2500,
            knockback: 2,            // heavy cannon — shoves the target back
            splash: { radius: 3 },
        },
        guardianRadius: 1,
    },
    leviathan: {
        id: 'leviathan', name: 'Leviathan', kind: 'summon',
        image: '/characters/leviathan.png',
        durationMs: 15_000,
        targeting: 'nearest',
        stickyTargetMs: 1500,
        moveCooldownMs: 500,
        attackCooldownMs: 2000,
        attackDamage: 125,
        attackRange: 2,
        receiveBuffs: true,
        guardianRadius: 3,
        onHit: {
            energyGain: 5,
            grantsStack: 'depths',
            stunMs: 500,
            knockback: 1,
            splash: { radius: 2 },
        },
    },

    // ── Constructs ───────────────────────────────────────────────────────────

    glacial_pylon: {
        id: 'glacial_pylon', name: 'Glacial Pylon', kind: 'construct',
        image: '/characters/glacial_pylon.png',
        durationMs: 12_000,
        constructType: 'source',
        targetingType: 'pulse',
        pulseMs: 2_000,
        pulseRadius: 3,
        pulseDmg: 25,
        // footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
        // footprintRender: 'scaled',
        receiveBuffs: true,
        onHit: {
            stunMs: 1000,
            energyGain: 5,
            // knockback: 1,            // pulse shoves enemies off the pylon
        },
    },

    wind_tower: {
        id: 'wind_tower', name: 'Wind Tower', kind: 'construct',
        image: '/characters/wind_tower.png',
        durationMs: 12_000,
        constructType: 'catalyst',
        targetingType: 'pulse',
        pulseDmg: 15,
        pulseMs: 2_000,
        pulseRadius: 2,
        receiveBuffs: true,
        stratum: 'ground',                // sits on ground, ground enemies path around it
        hitsStrata: ['ground', 'flying'], // pulse damages both strata (was the dead `hits` field)
        onHit: {
            energyGain: 8,
            // knockback: 2,            // gusts push hard
        },
    },

    // ── Test summons (cover all targeting modes + AoE + ranged) ──────────────────
    test_guardian: {
        id: 'test_guardian', name: 'Guardian Test', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20000,
        targeting: 'guardian', guardianRadius: 3, stickyTargetMs: 1500,
        moveCooldownMs: 400, attackCooldownMs: 800,
        attackDamage: 10, attackRange: 1,
    },
    test_lowest: {
        id: 'test_lowest', name: 'Lowest HP Hunter', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20000,
        targeting: 'lowest_hp', stickyTargetMs: 2000,
        moveCooldownMs: 400, attackCooldownMs: 800,
        attackDamage: 10, attackRange: 1,
    },
    test_aoe: {
        id: 'test_aoe', name: 'AoE Test', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20000,
        targeting: 'nearest', stickyTargetMs: 1000,
        moveCooldownMs: 400, attackCooldownMs: 1200,
        attackDamage: 8, attackRange: 1,
        onHit: { splash: { radius: 1 }, knockback: 1 }, // isolated AoE + knockback test
    },
    test_ranged: {
        id: 'test_ranged', name: 'Ranged Test', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20000,
        targeting: 'nearest', stickyTargetMs: 1500,
        moveCooldownMs: 600, attackCooldownMs: 1200,
        attackDamage: 12, attackRange: 3,
    },
    test_stationary: {
        id: 'test_stationary', name: 'Stationary Test', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20000,
        targeting: 'stationary', moveCooldownMs: 99999,
        attackCooldownMs: 1000, attackDamage: 15, attackRange: 2,
    },

    // ── Test construct ────────────────────────────────────────────────────────────
    test_turret: {
        id: 'test_turret', name: 'Turret Test', kind: 'construct',
        image: '/characters/glacial_pylon.png', durationMs: 15000,
        constructType: 'inert', targetingType: 'turret',
        pulseDmg: 20, pulseMs: 1500, pulseRadius: 3,
        onHit: { knockback: 1 }, // single-target turret knockback test
    },

};

export function getCreationDef(id: string): CreationDef | undefined {
    return CREATIONS[id];
}
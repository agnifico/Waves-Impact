import type { CreationDef } from '$lib/types/creation';

/**
 * Registry of all summons and constructs.
 * Characters reference these by id via ability.creationId.
 * Element is always inherited from the caster at spawn — not stored here.
 */
const CREATIONS: Record<string, CreationDef> = {

    // ── Summons ──────────────────────────────────────────────────────────────

    wolfie: {
        id: 'wolfie', name: 'Wolfie', kind: 'summon',
        image: '/characters/wolfie.png',
        durationMs: 16_000,
        targeting: 'nearest',
        stickyTargetMs: 1500,
        moveCooldownMs: 500,
        attackCooldownMs: 1000,
        attackDamage: 40,
        attackRange: 1,
        receiveBuffs: true,
        energyPerHit: 5,
        grantsOwnerStack: 'eclipse',
    },

    // ── Constructs ───────────────────────────────────────────────────────────

    glacial_pylon: {
        id: 'glacial_pylon', name: 'Glacial Pylon', kind: 'construct',
        image: '/characters/glacial_pylon.png',
        durationMs: 12_000,
        constructType: 'source',
        targetingType: 'pulse',
        pulseDmg: 25,
        pulseMs: 2_000,
        pulseRadius: 3,
        stunMs: 800,
        receiveBuffs: false,
        energyPerHit: 5,
        grantsOwnerStack: 'eclipse',
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
        receiveBuffs: false,
        energyPerHit: 8,
        stratum: 'ground',        // sits on ground, ground enemies path around it
        hits: ['ground', 'flying'], // pulse damages both strata
    },

    // ── Test summons (cover all targeting modes + AoE + ranged) ──────────────────
    test_guardian: {
        id: 'test_guardian', name: 'Guardian Test', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20_000,
        targeting: 'guardian', guardianRadius: 3, stickyTargetMs: 1500,
        moveCooldownMs: 400, attackCooldownMs: 800,
        attackDamage: 10, attackRange: 1,
    },
    test_lowest: {
        id: 'test_lowest', name: 'Lowest HP Hunter', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20_000,
        targeting: 'lowest_hp', stickyTargetMs: 2000,
        moveCooldownMs: 400, attackCooldownMs: 800,
        attackDamage: 10, attackRange: 1,
    },
    test_aoe: {
        id: 'test_aoe', name: 'AoE Test', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20_000,
        targeting: 'nearest', stickyTargetMs: 1000,
        moveCooldownMs: 400, attackCooldownMs: 1200,
        attackDamage: 8, attackRange: 1, aoeRadius: 1,
    },
    test_ranged: {
        id: 'test_ranged', name: 'Ranged Test', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20_000,
        targeting: 'nearest', stickyTargetMs: 1500,
        moveCooldownMs: 600, attackCooldownMs: 1200,
        attackDamage: 12, attackRange: 3,
    },
    test_stationary: {
        id: 'test_stationary', name: 'Stationary Test', kind: 'summon',
        image: '/characters/wolfie.png', durationMs: 20_000,
        targeting: 'stationary', moveCooldownMs: 99999,
        attackCooldownMs: 1000, attackDamage: 15, attackRange: 2,
    },

    // ── Test construct ────────────────────────────────────────────────────────────
    test_turret: {
        id: 'test_turret', name: 'Turret Test', kind: 'construct',
        image: '/characters/glacial_pylon.png', durationMs: 15_000,
        constructType: 'inert', targetingType: 'turret',
        pulseDmg: 20, pulseMs: 1_500, pulseRadius: 3,
    },

};

export function getCreationDef(id: string): CreationDef | undefined {
    return CREATIONS[id];
}
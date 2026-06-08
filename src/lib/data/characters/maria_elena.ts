import type { Character } from '$lib/types/character';

export const maria_elena: Character = {
    id: 'maria_elena',
    name: 'Maria Elena',
    element: 'fire',
    maxHp: 300,                     // High baseline health for a frontliner
    maxEnergy: 100,
    baCooldownMs: [200, 200, 200],  // Deliberate, heavy swing pacing
    baChainResetMs: 1000,

    // Basic-Attack Style: Sequenced multi-hit chain utilizing Poise mechanics
    basicStyle: 'chain',
    basicChain: [
        {
            name: 'Shield Batter (1)',
            damage: 8,
            range: 1,
            energyGain: 10,
            poiseDamage: 15,        // Drives enemies closer to stagger
            shape: 'melee',
            omniTarget: false,
            advanceOnlyIfMelee: true,
            fx: { strike: 'swipe', colors: ['#9a7b56', '#d4af37'] }
        },
        {
            name: 'Iron Sweep (2)',
            damage: 12,
            range: 1,
            energyGain: 10,
            poiseDamage: 20,
            omniTarget: false,
            advanceOnlyIfMelee: true,
            shape: 'melee', // Defensive opening sweep across his flanks
            fx: { strike: 'swipe', colors: ['#b58953', '#896032'] }
        },
        {
            name: 'Tectonic Finisher (3)',
            damage: 22,
            range: 2,
            energyGain: 20,
            poiseDamage: 40,        // Heavy posture breaking potential
            omniTarget: false,
            advanceOnlyIfMelee: true,
            shape: 'melee',          // Committed forward smash
            grantsStack: 'fortress',
            fx: { strike: 'swipe', colors: ['#ffe9a8', '#654321'] }
        }
    ],

    abilities: {
        // X — Iron Rampart: Non-teleport charging dash that stops at obstacles/enemies
        X: {
            id: 'iron_rampart',
            name: 'Iron Rampart',
            behavior: 'dash',
            shape: 'line',         // Uses non_teleport_dash rules behind the scenes
            shapeParams: {
                range: 4,
                throughObstacles: false, // Interrupted by walls, summons, and large targets
            },
            chargeMaxRange: 7,
            chargeMsPerTile: 150,
            damage: 18,
            poiseDamage: 30,
            knockback: 4,           // Plows enemies backward during the charge
            cooldownMs: 7000,
            energyGain: 5,
            grantsStack: 'fortress',
            holdBehavior: 'charge', // Hold to increase run distance
            impactClass: 'impact-earth-shatter',
            energyCost: 30,
            charges: 3,
        },

        // C — Aegis Pulse: Inverted defensive cone that protects flanks and punishes up-close threats
        C: {
            id: 'aegis_pulse',
            name: 'Aegis Pulse',
            behavior: 'damage_aoe',
            shape: 'pcone', // Wide near caster, narrows further away
            shapeParams: { range: 3 },
            damage: 15,
            poiseDamage: 25,
            stunMs: 1500,           // Concusses enemies directly adjacent to him
            cooldownMs: 9000,
            energyGain: 25,
            grantsStack: 'fortress',
            allowSelfTarget: true
        },

        // V — Tremor Core: A heavy seismic zone that damages enemies and anchors Ignis
        V: {
            id: 'tremor_core',
            name: 'Tremor Core',
            behavior: 'zone',
            shape: 'circle',
            shapeParams: { radius: 1 },
            durationMs: 60000,
            cooldownMs: 0,
            energyCost: 10,
            zoneFollows: 'caster',
            zoneBuff: {
                damageBonus: 0.2,   // Minor damage increase inside the zone
                tickMs: 1000,
                // Engine reads custom status injection via general effects framework:
                appliesEffects: ['fortress_grounding']
            }
        }
    },

    // Stack System: Hold-and-Spend paradigm (similar to Sefyra's Divinity, different usage)
    stackType: 'fortress',
    stackName: 'Fortress Iron',
    stackMax: 4,
    onStackFull: 'none',            // Hold-and-spend: stacks cap at 4 and don't auto-convert

    stratum: 'ground',              // Heavily bound to the earth
    offFieldStackBonus: 1.0,

    // Poise System Integration (§15.6)
    maxPoise: 200,                  // Incredibly high stance threshold; difficult to stagger
    poiseRegenPerSec: 25,

    art: {
        gem: '/characters/maria_elena6.png',
        profile: '/characters/avatars/maria_elena.png',
        poster: '/characters/maria_elena1.png',
    },
    theme: {
        primary: '#b58953',
        secondary: '#d4af37',
        glow: { ready: '#e9c46a' },
        hp: 'linear-gradient(to left, #f83600 0%, #f9d423 100%);',
        energy: 'linear-gradient(to top, #ff0844 0%, #ffb199 100%);'
    }
};
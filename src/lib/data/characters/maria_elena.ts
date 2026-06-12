import type { Character } from '$lib/types/character';

export const maria_elena: Character = {
    id: 'maria_elena',
    name: 'Maria Elena',
    element: 'fire',
    maxHp: 300,                     // High baseline health for a frontliner
    maxEnergy: 100,
    baCooldownMs: [400],  // Deliberate, heavy swing pacing
    baChainResetMs: 1000,
    moveMs: 75,

    description: 'The Goddess of Fire, Maria Elena is a gap-closing, sustained main damage dealer, with strong off-field DMG capabilities.',

    // Basic-Attack Style: Sequenced multi-hit chain utilizing Poise mechanics
    // basicStyle: 'chain',
    // basicChain: [
    //     {
    //         name: 'Shield Batter (1)',
    //         damage: 8,
    //         range: 1,
    //         energyGain: 10,
    //         poiseDamage: 15,        // Drives enemies closer to stagger
    //         shape: 'melee',
    //         omniTarget: false,
    //         advanceOnlyIfMelee: true,
    //         fx: { strike: 'swipe', colors: ['#9a7b56', '#d4af37'] }
    //     },
    //     {
    //         name: 'Iron Sweep (2)',
    //         damage: 12,
    //         range: 1,
    //         energyGain: 10,
    //         poiseDamage: 20,
    //         omniTarget: false,
    //         advanceOnlyIfMelee: true,
    //         shape: 'melee', // Defensive opening sweep across his flanks
    //         fx: { strike: 'swipe', colors: ['#b58953', '#896032'] }
    //     },
    //     {
    //         name: 'Tectonic Finisher (3)',
    //         damage: 22,
    //         range: 2,
    //         energyGain: 20,
    //         poiseDamage: 40,        // Heavy posture breaking potential
    //         omniTarget: false,
    //         advanceOnlyIfMelee: true,
    //         shape: 'melee',          // Committed forward smash
    //         grantsStack: 'fortress',
    //         fx: { strike: 'swipe', colors: ['#ffe9a8', '#654321'] }
    //     }
    // ],
    basicStyle: 'contextual',
    contextualBasic: {
        selectBy: 'hold',
        base: {
            name: 'Flash Fire',
            damage: 25,
            range: 1,
            energyGain: 10,
            shape: 'melee',
            omniTarget: true,
            fx: { strike: 'swipe', colors: ['#f83600', '#f9d423'] },
            description: 'Maria Elena swings her fiery sword at the nearest enemy in 1 tile range.'
        },
        withStack: {
            name: 'Furious Flames',
            damage: 50,
            range: 4,                       // was 1 — acquires up to 3 tiles
            energyGain: 10,
            shape: 'melee',
            omniTarget: true,               // nearest, or locked target via focusTarget
            consumesStack: 'immortal_flame',
            gapClose: true,                 // was dashBack: 3 — now closes the gap
            fx: { strike: 'uppercut', colors: ['#ee9b00', '#bb3e03'] },
            description: 'When Maria Elena has <Immortal Flame>, hold <kbd>Space</kbd> to consume one stack and enhance her basic attack. She will dash to the nearest/locked-on target in a 4 tiles range, and deal enhanced damage.'
        }
    },

    abilities: {
        // X — Iron Rampart: Non-teleport charging dash that stops at obstacles/enemies
        X: {
            id: 'shield_bash',
            name: 'Shield Bash',
            behavior: 'dash',
            shape: 'line',         // Uses non_teleport_dash rules behind the scenes
            shapeParams: {
                range: 4,
                throughObstacles: false, // Interrupted by walls, summons, and large targets
            },
            chargeMaxRange: 7,
            chargeMsPerTile: 150,
            damage: 30,
            poiseDamage: 30,
            knockback: 4,           // Plows enemies backward during the charge
            cooldownMs: 10000,
            energyGain: 7,
            grantsStack: 'immortal_flame',
            holdBehavior: 'charge', // Hold to increase run distance
            charges: 2,
            description: 'Maria Elena dashes to the nearest/locked-on enemy and knocks them back 4 tiles, while dealing damage. Hold <kbd>X</kbd> to charge up the dash range, up to a range of 7 tiles. Grants her one stack of <Immortal Flame>. Has 2 initial charges.'
        },

        //  — Aegis Pulse: Inverted defensive cone that protects flanks and punishes up-close threats


        C: {
            id: 'blazing_trail',
            name: 'Blazing Trail',
            behavior: 'dash',
            // no `shape` — dash travels by rule, not geometry
            shapeParams: {
                dir: 'forward',          // aim-directional (not the legacy gap-closer)
                tiles: 4,                // dashes ~4 tiles down the aim line
                throughObstacles: true,  // flying: passes through, lands on the furthest valid tile
                blastDamage: 50,         // radius-2 detonation at the stop point
                blastRadius: 2
                // iframesMs: 200,       // reserved — wires up with the status engine
            },
            energyGain: 7,

            charges: 3,
            damage: 40,                  // to the first enemy hit along the line
            cooldownMs: 10000,
            grantsStack: 'immortal_flame',     // +1 Divinity (declarative, as your placeholder is today)
            holdBehavior: 'track',         // hold C to aim a direction; release to dash (see note)
            description: 'Maria Elena dashes in a line, dealing 40 DMG to all enemies in path, with enemies at the end of the path taking an additional 50 DMG. Hold <kbd>Shift</kbd> + <kbd>WASD</kbd>/<kbd>Arrows</kbd> to aim in place. Has 3 initial charges.'
        },

        // V — Here We Stand: Ring of the Defiant Flame.
        // Radius-1 zone that FOLLOWS the active unit (Maria can bench and still upkeep it).
        // Cast: 50 dmg to enemies in range + 1 stack. While up: holder +15% DMG (stage 3),
        // enemies inside take 20/sec, Maria pays 1 EN/sec reduced 15%/stack → free at 7.
        V: {
            id: 'here_we_stand',
            name: 'Here We Stand',
            behavior: 'zone',
            shape: 'circle',
            shapeParams: { radius: 1 },
            durationMs: 60_000,
            cooldownMs: 1_000,
            energyCost: 0,
            damage: 75,
            grantsStack: 'immortal_flame',
            zoneFollows: 'active',
            zoneBuff: {
                damageBonus: 0.2,
                dmgPerTick: 30,
                ownerEnergyDrainPerTick: 5,
                upkeepReductionPerStack: 0.15,
                tickMs: 1000
            },
            fx: {zone: 'flame'},
            description: "Maria Elena summons a [Ring of the Defiant Flame]: a 1 tile circle that follows the active unit, dealing 20 DMG to all enemies in range, per second. The ring costs Maria Elena 5 energy per second to upkeep. At the time of casting this ability, she will also inflict a one-time 75 DMG to all enemies in the same range. [Defender of the Realm] : Each <Immortal Flame> stack reduces her energy upkeep for [Ring of the Defiant Flame] by 15%, up to 7 stacks. Grants one stack of <Immortal Flame>."
        }
    },

    // Stack System: Hold-and-Spend paradigm (similar to Sefyra's Divinity, different usage)
    stackType: 'immortal_flame',
    stackName: 'Immortal Flame',
    stackMax: 10,
    onStackFull: 'none',            // Hold-and-spend: stacks cap at 4 and don't auto-convert

    stratum: 'ground',              // Heavily bound to the earth
    offFieldStackBonus: 1.0,

    // Poise System Integration (§15.6)
    maxPoise: 200,                  // Incredibly high stance threshold; difficult to stagger
    poiseRegenPerSec: 25,

    art: {
        gem: '/characters/maria_elena6.png',
        profile: '/characters/avatars/maria_elena.png',
        poster: '/characters/maria_elena_poster.png',
    },
    theme: {
        primary: '#f83600',
        secondary: '#e9c46a',
        glow: { ready: '#e9c46a' },
        hp: 'linear-gradient(to left, #f83600 0%, #f9d423 100%);',
        energy: 'linear-gradient(to top, #ff0844 0%, #ffb199 100%);',
    }
};
import type { Character } from '$lib/types/character';

export const ryoma: Character = {
    id: 'ryoma',
    name: 'Ryoma',
    element: 'dark', // Using the dark element classification
    maxHp: 200,       // High-precision glass cannon profile
    maxEnergy: 100,
    baCooldownMs: [180, 180, 450], // Extremely swift, calculated execution pacing
    baChainResetMs: 1800,

    basicStyle: 'chain',
    basicChain: [
        {
            name: 'Tactical Draw (1)',
            damage: 6,
            range: 2, // Slight reach due to his blade profile
            energyGain: 12,
            poiseDamage: 10,
            shape: 'line', // Crisp, straight-line thrust geometry
            omniTarget: true,
            advanceOnlyIfMelee: true,
            fx: { strike: 'swipe', colors: ['#7c3aed', '#c084fc'] }
        },
        {
            name: 'Crimson Sheath (2)',
            damage: 10,
            range: 2,
            energyGain: 12,
            poiseDamage: 12,
            shape: 'line',
            fx: { strike: 'swipe', colors: ['#7c3aed', 'var(--gold-bright)'] }
        },
        {
            name: 'Glint of Execution (3)',
            damage: 18,
            range: 3, // Extended lunge step
            energyGain: 15,
            poiseDamage: 25,
            shape: 'line',
            grantsStack: 'discipline', // Strategic collection of tactical insight
            appliesEffects: ['tactical_mark'], // Places an assassination mark on hit via the status engine
            fx: { strike: 'impact', colors: ['#4c1d95', '#ff003c'] }
        }
    ],

    abilities: {
        // X — Nightshade Lunge: A quick tactical pass that leaves marks behind
        X: {
            id: 'nightshade_lunge',
            name: 'Nightshade Lunge',
            behavior: 'dash', // Dash behavior tracking his physical traversal line
            shapeParams: { 
                range: 4,
                throughObstacles: false // Slips along open tiles, stopped by clean blockades
            },
            damage: 16,
            cooldownMs: 5000, // Short cooldown for constant field repositioning
            energyGain: 10,
            grantsStack: 'discipline',
            appliesEffects: ['tactical_mark'], // Marks targets cut along his dash path
            holdBehavior: null, // Rapid tap-cast asset[cite: 5]
            impactClass: 'impact-shadow-edge'
        },

        // C — Command: Ominous Sweep: A wider, controlled execution zone in front of him
        C: {
            id: 'ominous_sweep',
            name: 'Command: Ominous Sweep',
            behavior: 'damage_aoe',
            shape: 'pcone', // Widening fan projecting directly from his stance
            shapeParams: { range: 4 },
            damage: 22,
            poiseDamage: 20,
            cooldownMs: 9000,
            energyGain: 15,
            grantsStack: 'discipline',
            holdBehavior: 'aim' // Can hold and pivot to perfectly choose his angle of sweep[cite: 5]
        },

        // V — Absolute Midnight: Multi-stage tracking array that executes marked targets anywhere on board
        V: {
            id: 'absolute_midnight',
            name: 'Absolute Midnight',
            behavior: 'damage_aoe', // Resolves across specific query domains
            shapeParams: { range: 8 },
            durationMs: 8000, // Duration window to complete his execution pattern
            cooldownMs: 24000,
            energyCost: 60,
            // Multi-stage architecture scaffolding (§15.9):
            stages: [
                {
                    prompt: 'lock_targets', // Stage 1: Scans board and consumes 'discipline' stacks
                    shape: 'circle',
                    shapeParams: { radius: 8 }
                },
                {
                    prompt: 'execute', // Stage 2: Fires tracking strikes onto targets holding 'tactical_mark'
                    damage: 60, 
                    unchainedBonus: 30 // Deals massive bonus damage per stack of 'discipline' spent
                }
            ]
        }
    },

    // Stack System: Hold-and-Spend paradigm (§9)
    stackType: 'discipline',
    stackName: 'Tactical Discipline',
    stackMax: 4,
    onStackFull: 'none', // Holds resources manually to power his final execution stages

    stratum: 'ground', // Bound firmly to tactical terrain lines
    offFieldStackBonus: 1.2, // Grants a minor energy generation modifier while holding stacks off-field

    art: {
        gem: '/characters/ryoma3.png',
        profile: '/characters/avatars/ryoma.png',
        poster: '/characters/ryoma_poster1.png'
    },
    theme: {
        primary: '#4c1d95', // Deep Obsidian Purple matching the new dark palette matrix
        secondary: '#7c3aed', // Royal Violet
        glow: { ready: '#c084fc' }, // Vivid Lavender glow
        hp: 'linear-gradient(-90deg, #1f1135 0%, #4c1d95 50%, #ff003c 100%);', // Infused with deep violet and eye-crimson
        energy: 'linear-gradient(to right, #2e1065, #7c3aed);'
    }
};
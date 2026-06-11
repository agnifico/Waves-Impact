import type { Character } from '$lib/types/character';

export const sefyra: Character = {
    id: 'sefyra',
    name: 'Sefyra',
    element: 'light',
    maxHp: 200,            // low-survivability stand-in until a real DEF stat exists
    maxEnergy: 100,
    baCooldownMs: [200, 200, 1000], // BA3 is the channeled shot
    baChainResetMs: 1500,

    basicStyle: 'chain',
    basicChain: [
        {
            name: 'Skymark (1)',
            damage: 10, range: 7, energyGain: 10, shape: 'melee', omniTarget: true, grantsStack: 'divinity',
            fx: { strike: 'projectile', shape: 'arrow', colors: ['#a8e0ec', '#48cae4'] }
        },
        {
            name: 'Skymark (2)',
            damage: 15, range: 7, energyGain: 10, shape: 'melee', omniTarget: true, grantsStack: 'divinity',
            fx: { strike: 'projectile', shape: 'arrow', colors: ['#a8e0ec', '#48cae4'] }
        },
        {
            name: 'Skymark (3)',
            damage: 15, range: 7, energyGain: 10, shape: 'melee', omniTarget: true, consumesStack: 'divinity', consumeBonus: 20, teamHeal: 25,
            fx: { strike: 'projectile', shape: 'arrow', colors: ['#ffe9a8', 'var(--gold-bright)'] }
        }
    ],

    abilities: {
        // X — Cloudpiercer (tiered auto-lock shot; tier from hold time in 3c, charges in 3a)
        X: {
            id: 'cloudpiercer', name: 'Cloudpiercer', behavior: 'cloudpiercer', holdBehavior: 'track', shapeParams: { range: 8 }, energyGain: 15, charges: 2, rechargeMs: 10000,
            fx: { strike: 'projectile', shape: 'arrow', size: 'l', trail: true, speed: 22, colors: ['#fff0c4', 'var(--gold-bright)'] }
        },
        // PROVISIONAL (chunk 4 = directional dash + radius-2 blast)
        C: {
            id: 'photonic-transfiguration',
            name: 'Photonic Transfiguration',

            behavior: 'dash',
            // no `shape` — dash travels by rule, not geometry
            shapeParams: {
                dir: 'forward',          // aim-directional (not the legacy gap-closer)
                tiles: 4,                // dashes ~4 tiles down the aim line
                throughObstacles: true,  // flying: passes through, lands on the furthest valid tile
                blastDamage: 15,         // radius-2 detonation at the stop point
                blastRadius: 2
                // iframesMs: 200,       // reserved — wires up with the status engine
            },

            damage: 100,                  // to the first enemy hit along the line
            cooldownMs: 10000,
            grantsStack: 'divinity',     // +1 Divinity (declarative, as your placeholder is today)
            holdBehavior: 'track',         // hold C to aim a direction; release to dash (see note)

            // carry over from your current C:
            // energyGain: <your value>,
            // impactClass: '<your vfx hook>',
            // hits: [<strata>]          // add to stratum-gate the hit + blast; omit = hits all
        },
        // PROVISIONAL (chunk 5 = gather + whirlwind + 3-stack VV buff)
        V: { id: 'goddess', name: 'Goddess of the Divine Gale', behavior: 'zone', shape: 'circle', shapeParams: { radius: 8 }, durationMs: 16000, cooldownMs: 20000, energyCost: 40, zoneBuff: { damageBonus: .5, tickMs: 1500 } }
    },

    stackType: 'divinity',
    stackName: 'Divinity',
    stackMax: 6,
    onStackFull: 'none',   // Sefyra has no at-max effect — see note
    onStackFullTarget: 'self',

    stratum: 'flying',     // immune to ground-only attacks, overtakes obstacles

    offFieldStackBonus: 1.5,

    art: {
        gem: '/characters/sefyra_profile2.png',
        profile: '/characters/avatars/sefyra.png',
        poster: '/characters/sefyra_poster.png'
    },
    theme: {
        primary: '#fcbf49',
        secondary: '#48cae4',
        glow: { ready: '#eddd53' },
        hp: 'linear-gradient(-90deg,#3586c4 0%, #4896b8 28%, #b1b68a 62%, #eddd53 100%);',
        energy: 'linear-gradient(to right, #e1f5c4, #ede574);',
        skin: 'wind'
    }
};
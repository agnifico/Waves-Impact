import type { Character } from '$lib/types/character';

export const sefyra: Character = {
    id: 'sefyra',
    name: 'Sefyra',
    element: 'light',
    maxHp: 200,
    maxEnergy: 100,
    baCooldownMs: [50, 50, 50],
    baChainResetMs: 1500,

    basicStyle: 'chain',
    basicChain: [
        {
            name: 'Skymark (1)',
            range: 7,
            omniTarget: true,
            delivery: { damage: 10, energyGain: 10, shape: 'melee', grantsStack: 'divinity', windUpMs: 150, windUpStyle: 'bow' },
            fx: { strike: 'projectile', shape: 'arrow', colors: ['#a8e0ec', '#48cae4'] }
        },
        {
            name: 'Skymark (2)',
            range: 7,
            omniTarget: true,
            delivery: { damage: 15, energyGain: 10, shape: 'melee', grantsStack: 'divinity', windUpMs: 150, windUpStyle: 'bow' },
            fx: { strike: 'projectile', shape: 'arrow', colors: ['#a8e0ec', '#48cae4'] }
        },
        {
            name: 'Skymark (3)',
            range: 7,
            omniTarget: true,
            consumesStack: 'divinity',
            consumeBonus: 20,
            delivery: { damage: 15, energyGain: 10, shape: 'melee', windUpMs: 350, windUpStyle: 'ranged' },
            onHit: { teamHeal: 25 },   // self-gates: BA3 finisher; heal lands on the consume hit
            fx: { strike: 'chain', shape: 'arrow', colors: ['#ffe9a8', 'var(--gold-bright)'] }
        }
    ],

    abilities: {
        // X — Cloudpiercer: tiered auto-lock shot (unique behavior; tier from hold time)
        X: {
            id: 'cloudpiercer',
            name: 'Cloudpiercer',
            behavior: 'cloudpiercer',
            charges: 2,
            rechargeMs: 10000,
            delivery: {
                windUpMs: 350, windUpStyle: 'pistol',
                energyGain: 15,
                holdBehavior: 'track',
                shapeParams: { range: 8 }
            },
            fx: { strike: 'bullet', trail: true, speed: 22, colors: ['#fff0c4', 'var(--gold-bright)'] }
        },

        // C — Photonic Transfiguration: aimed directional dash + terminal blast
        C: {
            id: 'photonic-transfiguration',
            name: 'Photonic Transfiguration',
            behavior: 'dash',
            cooldownMs: 10000,
            delivery: {
                damage: 100,
                grantsStack: 'divinity',
                holdBehavior: 'track',
                shapeParams: {
                    dir: 'forward',
                    tiles: 4,
                    throughObstacles: true,
                    blastDamage: 15,
                    blastRadius: 2
                }
            }
        },

        // V — Divine Vortex: aimed board-spanning gather zone (Venti ult)
        V: {
            id: 'divine_vortex',
            name: 'Divine Vortex',
            behavior: 'zone',
            durationMs: 8000,
            cooldownMs: 20000,
            energyCost: 40,
            zoneFollows: 'fixed',
            zoneBuff: {
                tickMs: 600,
                dmgPerTick: 8,
                damageBonus: 0.2,
                gatherPerTick: { steps: 1 }
            },
            delivery: {
                grantsStack: 'divinity',
                aimRange: 12,
                holdBehavior: 'aim',
                shapeParams: { radius: 5 }
            },
            fx: { zone: 'holy' }
        }
    },

    stackType: 'divinity',
    stackName: 'Divinity',
    stackMax: 6,
    onStackFull: 'none',
    onStackFullTarget: 'self',

    stratum: 'flying',
    offFieldStackBonus: 1.5,

    art: {
        gem: '/characters/gem-sefyra.png',
        profile: '/characters/avatars2/sefyra.png',
        poster: '/characters/sefyra_v.png',
        bannerPoster: '/characters/sefyra100.png'
    },
    theme: {
        primary: '#fcbf49',
        secondary: '#48cae4',
        glow: { ready: '#eddd53' },
        hp: 'linear-gradient(-90deg,#3586c4 0%, #4896b8 28%, #b1b68a 62%, #eddd53 100%);',
        energy: 'linear-gradient(to right, #e1f5c4, #ede574);',
    }
};
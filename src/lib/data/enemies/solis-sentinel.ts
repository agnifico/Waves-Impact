import type { Enemy } from "$lib/types/enemy";

export const solis_sentinel: Enemy = {
    id: 'solis_sentinel', name: 'Solis Sentinel', element: 'light',
    maxHp: 2000, maxPoise: 180,
    canMoveDiagonal: false, moveTickMs: 500, moveResumeAfterPlayerFleeMs: 200,
    aiPattern: 'tank_blocker',
    profileImage: '/enemies/solis_sentinel.png',
    attacks: [{
        id: 'solar_lance', name: 'Solar Lance',
        range: 2, damage: 5, poiseDamage: 30, cooldownMs: 2000, priority: 1,
        windUpMs: 400,
        windUpStyle: 'fire',
        fx: { strike: 'stab', colors: ['#ff8800', '#ffdd00'] }
    }]
};
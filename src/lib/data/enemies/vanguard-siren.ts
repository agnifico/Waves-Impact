import type { Enemy } from "$lib/types/enemy";

export const vanguard_siren: Enemy = {
    id: 'vanguard_siren', name: 'Vanguard Siren', element: 'water',
    maxHp: 2200, maxPoise: 60,
    canMoveDiagonal: true, moveTickMs: 300, moveResumeAfterPlayerFleeMs: 80,
    aiPattern: 'ranged_kiter',
    profileImage: '/enemies/vanguard_siren.png',
    attacks: [{
        id: 'trident_throw', name: 'Trident Throw',
        range: 4, damage: 5, cooldownMs: 1800, priority: 1,
    }]
};
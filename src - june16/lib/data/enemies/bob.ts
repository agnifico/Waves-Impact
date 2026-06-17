import type { Enemy } from "$lib/types/enemy";

export const bob: Enemy = {
    id: 'bob', name: 'Bob', element: 'water',
    maxHp: 5000, maxPoise: 400,
    canMoveDiagonal: true, moveTickMs: 260, moveResumeAfterPlayerFleeMs: 80,
    aiPattern: 'melee_rush',
    ignoresSummons: true,
    profileImage: '/enemies/bob.png',
    attacks: [
        {
            id: 'sea_claw', name: 'Sea Claw',
            range: 1, damage: 39, poiseDamage: 40, cooldownMs: 1100, priority: 2,
        },
        {
            id: 'tidal_surge', name: 'Tidal Surge',
            range: 2, damage: 26, cooldownMs: 2200, priority: 1,
            knockback: 2,
        }
    ]
};
import type { Enemy } from "$lib/types/enemy";

export const punching_tortoise: Enemy = {
    id: 'punching_tortoise', name: 'Punching Tortoise', element: 'nature',
    maxHp: 1800, maxPoise: 350,
    canMoveDiagonal: false, moveTickMs: 700, moveResumeAfterPlayerFleeMs: 300,
    aiPattern: 'melee_rush',
    profileImage: '/enemies/punching_tortoise.png',
    attacks: [{
        id: 'spike_punch', name: 'Spike Punch',
        range: 1, damage: 5, poiseDamage: 55, cooldownMs: 2500, priority: 1,
        knockback: 3, knockbackSmart: false,
        windUpMs: 400,
        windUpStyle: 'fire',
        fx: { strike: 'stab', colors: ['#798478', '#4d6a6d'] }

    }]
};
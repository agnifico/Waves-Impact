import type { Enemy } from "$lib/types/enemy";

export const forest_prowler: Enemy = {
    id: 'forest_prowler', name: 'Forest Prowler', element: 'dark',
    maxHp: 1500, maxPoise: 80,
    canMoveDiagonal: true, moveTickMs: 200, moveResumeAfterPlayerFleeMs: 50,
    aiPattern: 'flanker',
    profileImage: '/enemies/forest_prowler.png',
    attacks: [{
        id: 'runic_claw', name: 'Runic Claw',
        range: 1, damage: 5, poiseDamage: 15, cooldownMs: 1200, priority: 1,
        windUpMs: 400,
			windUpStyle: 'fire',
			fx: { strike: 'claw', gashes: 5, colors: ['#606c38', '#38b000'] }
    }]
};
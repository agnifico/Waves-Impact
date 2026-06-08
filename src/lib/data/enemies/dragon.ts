import type { Enemy } from '$lib/types/enemy';

export const dragon: Enemy = {
	id: 'dragon',
	name: 'Green Dragon',
	element: 'wind',
	maxHp: 1000,
	canMoveDiagonal: true,
	moveTickMs: 1000,
	moveResumeAfterPlayerFleeMs: 100,
	aiPattern: 'melee_rush',
	profileImage: '/enemies/dragon.png',
	attacks: [
		{
			id: 'dragonbreath',
			name: 'Dragonbreath',
			range: 4,
			damage: 25,
			cooldownMs: 3000,
			priority: 2
		},
		{
			id: 'tail_swipe',
			name: 'Tail Swipe',
			range: 1,
			damage: 50,
			cooldownMs: 10000,
			priority: 1
		}
	],
	stratum: 'flying'
};

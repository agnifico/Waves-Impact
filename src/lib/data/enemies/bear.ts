import type { Enemy } from '$lib/types/enemy';

export const bear: Enemy = {
	id: 'bear',
	name: 'Brawler Bear',
	element: 'nature',
	maxHp: 500,
	canMoveDiagonal: false,
	stratum: 'ground',
	moveTickMs: 2000,
	moveResumeAfterPlayerFleeMs: 200,
	aiPattern: 'melee_rush',
	profileImage: '/enemies/bear.png',
	attacks: [
		{
			id: 'body_slam',
			name: 'Body Slam',
			range: 1,
			damage: 60,
			cooldownMs: 10000,
			priority: 2,
			stunMs: 1000
		},
		{
			id: 'fury_claws',
			name: 'Fury Claws',
			range: 1,
			damage: 25,
			cooldownMs: 1500,
			priority: 1
		}
	]
};

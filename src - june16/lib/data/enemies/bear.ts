import type { Enemy } from '$lib/types/enemy';

export const bear: Enemy = {
	id: 'bear',
	name: 'Brawler Bear',
	element: 'nature',
	maxHp: 750,
	canMoveDiagonal: false,
	stratum: 'ground',
	moveTickMs: 1200,
	moveResumeAfterPlayerFleeMs: 200,
	aiPattern: 'tank_blocker',
	profileImage: '/enemies/bear.png',
	attacks: [
		{
			id: 'body_slam',
			name: 'Body Slam',
			range: 1,
			damage: 6,
			cooldownMs: 10000,
			priority: 2,
			stunMs: 1000
		},
		{
			id: 'fury_claws',
			name: 'Fury Claws',
			range: 1,
			damage: 3,
			cooldownMs: 1500,
			priority: 1
		}
	]
};

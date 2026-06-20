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
			id: 'rock_slam',
			name: 'Rock Slam',
			range: 1,
			damage: 6,
			cooldownMs: 10000,
			priority: 2,
			stunMs: 1000,
			windUpMs: 400,
			windUpStyle: 'pistol',
			fx: { strike: 'slam', colors: ['#a98467', '#6c584c'] }
		},
		{
			id: 'fury_claws',
			name: 'Fury Claws',
			range: 1,
			damage: 3,
			cooldownMs: 1500,
			priority: 1,
			windUpMs: 200,
			windUpStyle: 'melee',
			fx: { strike: 'reverseswipe', colors: ['#a98467', '#6c584c'] }
		}
	]
};

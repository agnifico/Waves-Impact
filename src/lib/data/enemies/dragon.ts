import type { Enemy } from '$lib/types/enemy';

export const dragon: Enemy = {
	id: 'dragon',
	name: 'Green Dragon',
	element: 'wind',
	maxHp: 10000,
	canMoveDiagonal: true,
	moveTickMs: 1000,
	moveResumeAfterPlayerFleeMs: 1000,
	aiPattern: 'flanker',
	profileImage: '/enemies/dragon.png',
	attacks: [
		{
			id: 'dragonbreath',
			name: 'Dragonbreath',
			range: 4,
			damage: 4,
			cooldownMs: 2600,
			priority: 1,
			windUpMs: 400,
			windUpStyle: 'fire',
			fx: { strike: 'projectile', shape: "orb", size: 'l', trail: true, colors: ['#ae2012', '#ee9b00'] }
		},
		{
			id: 'tail_swipe',
			name: 'Tail Swipe',
			range: 2,
			damage: 5,
			cooldownMs: 1600,
			priority: 2,
			windUpMs: 400,
			windUpStyle: 'melee',
			fx: { strike: 'swipe', colors: ['#a7c957', '#386641'] },
		}
	],
	// stratum: 'flying',
	ignoresSummons: true
};

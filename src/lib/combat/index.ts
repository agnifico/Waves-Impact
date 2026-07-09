// Re-export the public API of the combat engine.
// Consumers import from '$lib/combat' instead of reaching into submodules.

export { tick } from './engine';
export { newEngineState, newCharacterState, newEnemyState } from './state';
export { tryBasicAttack } from './basic-attack';
export { tryAbility } from './ability-resolver';
export { trySwap, checkAutoSwap } from './swap';
export { subscribe, publish, clear } from './events';
export {
	chebyshev,
	samePos,
	inBounds,
	clamp,
	isBlocked,
	createBoard,
	step8Toward,
	step8Away,
	aimToward
} from './board';
export { calculateDamage } from './pipeline';
export { applyEffect, removeEffect, hasEffect, getEffect, tickEffects } from './effects';
export { grantStack, consumeStack } from './stacks';
export { query, nearestEnemy } from './query';
export { resolveTiles, registerShape } from './shapes';
export { resolveBehavior, registerBehavior } from './behaviors';

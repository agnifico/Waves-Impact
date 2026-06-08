import type { EngineState, EnemyState } from '$lib/types/state';
import * as meleeRush from './melee-rush';

type AiTickFn = (state: EngineState, enemy: EnemyState, now: number) => void;

/**
 * AI pattern registry. Maps aiPattern string → tick function.
 * Adding a new AI: write the module, add one entry here.
 */
const registry: Record<string, AiTickFn> = {
	melee_rush: meleeRush.tick
};

/**
 * Tick the AI for a single enemy, dispatching to its declared pattern.
 */
export function tickEnemyAi(state: EngineState, enemy: EnemyState, now: number): void {
	const fn = registry[enemy.def.aiPattern];
	if (!fn) {
		console.warn(`[ai] Unknown pattern: ${enemy.def.aiPattern}`);
		return;
	}
	fn(state, enemy, now);
}

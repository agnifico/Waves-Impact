import type { EngineState, EnemyState } from '$lib/types/state';
import * as meleeRush   from './melee-rush';
import * as rangedKiter from './ranged-kiter';
import * as flanker     from './flanker';
import * as tankBlocker from './tank-blocker';
export { fireEnemyAttacks } from './utils';

type AiTickFn = (state: EngineState, enemy: EnemyState, now: number) => void;

/**
 * AI pattern registry. Maps aiPattern string → tick function.
 * Adding a new AI: write the module, register one entry here.
 *
 * Knockback is data-driven (EnemyAttack.knockback / .knockbackSmart) and
 * handled inside utils.tryAttacks — no separate pattern needed.
 */
const registry: Record<string, AiTickFn> = {
    melee_rush:   meleeRush.tick,
    ranged_kiter: rangedKiter.tick,
    flanker:      flanker.tick,
    tank_blocker: tankBlocker.tick,
};

export function tickEnemyAi(state: EngineState, enemy: EnemyState, now: number): void {
    const fn = registry[enemy.def.aiPattern];
    if (!fn) {
        console.warn(`[ai] Unknown pattern: ${enemy.def.aiPattern}`);
        return;
    }
    fn(state, enemy, now);
}
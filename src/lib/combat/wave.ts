import type { EngineState } from '$lib/types/state';
import { newEnemyState } from './state';
import { getEnemy } from '$lib/data/registry';
import { publish } from './events';

/**
 * Spawn the enemies for wave `waveIndex`, replacing any dead enemies from
 * the previous wave. IDs are unique per wave instance so duplicate enemy
 * types in the same wave never collide.
 */
export function spawnWave(state: EngineState, waveIndex: number, now: number): void {
	const waveCtx = state.wave!;
	const waveDef = waveCtx.waves[waveIndex];
	const centerX = Math.floor(state.board.size.width / 2);
	const spacing = 2;
	const total = waveDef.enemies.length;
	const startX = centerX - Math.floor(((total - 1) * spacing) / 2);

	// Clear dead enemies from the previous wave.
	for (let i = state.enemies.length - 1; i >= 0; i--) {
		if (state.enemies[i].hp <= 0) state.enemies.splice(i, 1);
	}

	waveDef.enemies.forEach(({ enemyId, spawnPos }, i) => {
		const def = getEnemy(enemyId);
		if (!def) return;
		const pos = spawnPos ?? { x: Math.min(state.board.size.width - 1, startX + i * spacing), y: 1 };
		const id = `${def.id}-w${waveIndex}-${i}`;
		const enemy = newEnemyState(def, pos, now, id);
		state.enemies.push(enemy);
		publish('enemy:spawn', { enemyId: id });
	});

	waveCtx.phase = 'fighting';
	waveCtx.waveStartedAt = now;
	publish('wave:start', { waveIndex, total: waveCtx.waves.length });
}

/**
 * Called when all enemies in the current wave are dead.
 * Either starts the next wave's intermission or ends the challenge.
 */
export function onWaveCleared(state: EngineState, now: number): void {
	const waveCtx = state.wave!;
	const clearedIndex = waveCtx.current;
	publish('wave:cleared', { waveIndex: clearedIndex, total: waveCtx.waves.length });

	const nextIndex = clearedIndex + 1;
	if (nextIndex >= waveCtx.waves.length) {
		state.over = true;
		state.outcome = 'victory';
		return;
	}

	const nextWave = waveCtx.waves[nextIndex];
	waveCtx.current = nextIndex;
	waveCtx.phase = 'intermission';
	waveCtx.intermissionEndsAt = now + (nextWave.intermissionMs ?? 3000);
}

/**
 * Called every engine tick when wave mode is active.
 * Handles two things:
 *  - intermission countdown → spawn next wave
 *  - per-wave time limit → defeat if exceeded
 */
export function checkWaveAdvance(state: EngineState, now: number): void {
	const waveCtx = state.wave!;

	if (waveCtx.phase === 'intermission') {
		if (waveCtx.intermissionEndsAt && now >= waveCtx.intermissionEndsAt) {
			spawnWave(state, waveCtx.current, now);
		}
		return;
	}

	// fighting phase — check time limit
	const timeLimitMs = waveCtx.waves[waveCtx.current]?.timeLimitMs;
	if (timeLimitMs && now - waveCtx.waveStartedAt > timeLimitMs) {
		state.over = true;
		state.outcome = 'defeat';
	}
}

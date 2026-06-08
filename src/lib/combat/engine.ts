import type { CharacterState, EngineState } from '$lib/types/state';
import { tickEffects } from './effects';
import { tickEnemyAi } from './ai';
import { chebyshev, samePos, clamp, step8Toward } from './board';
import { checkAutoSwap } from './swap';
import { publish } from './events';
import { nearestEnemy } from './query';
import { canEnter } from './spatial';
import { OFF_FIELD_REGEN_MS, regenOffField } from './energy';

/** Player movement speed (ms between steps). */
const PLAYER_MOVE_MS = 150;


let lastEnergyRegenAt = 0;


/** Last player movement timestamp (module-level, reset on new fight). */
let lastMoveAt = 0;

/**
 * Reset engine-local state. Call when starting a new fight.
 */
export function resetEngine(): void {
	lastMoveAt = 0;
	lastEnergyRegenAt = 0;
}

/**
 * Run one engine tick. Called every requestAnimationFrame by the orchestrator.
 * The engine mutates state directly; Svelte's $state proxy handles reactivity.
 *
 * @param state - the reactive EngineState
 * @param now - current timestamp (performance.now())
 * @param moveDir - player movement direction from input layer, or null
 */
export function tick(
	state: EngineState,
	now: number,
	moveDir: { x: number; y: number } | null
): void {
	if (state.over) return;

	const active = state.party[state.activeSlot];

	// 1. Player movement
	if (active.stunnedUntil <= now && moveDir && now - lastMoveAt >= PLAYER_MOVE_MS) {
		const next = clamp(state.board, {
			x: active.pos.x + Math.sign(moveDir.x),
			y: active.pos.y + Math.sign(moveDir.y)
		});

		// Don't walk into enemies
		const blocked = state.enemies.some((e) => e.hp > 0 && samePos(next, e.pos));
		const passable = canEnter(active.stratum, next, state.board, active.def.traversal);
		if (!blocked && passable && !samePos(next, active.pos)) {
			const from = { ...active.pos };
			active.pos = next;
			lastMoveAt = now;
			publish('movement:player', { characterId: active.id, from, to: next });
		}

	}

	// 2. Enemy AI ticks
	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		tickEnemyAi(state, enemy, now);
	}

	// 3. Summon ticks
	tickSummons(state, now);

	// 3b. Construct ticks (separate from summons — not targeted by AI aggro)
	tickConstructs(state, now);

	// 4. Zone ticks
	tickZones(state, now);

	// Off-field energy regen (rules in energy.ts)
	if (now - lastEnergyRegenAt >= OFF_FIELD_REGEN_MS) {
		lastEnergyRegenAt = now;
		regenOffField(state);
	}

	// 5. Effect expiry / tick hooks for all entities
	for (const pc of state.party) tickEffects(pc, now);
	for (const enemy of state.enemies) tickEffects(enemy, now);

	// 6. Death checks
	if (!checkAutoSwap(state)) {
		state.over = true;
		state.outcome = 'defeat';
	}

	if (state.enemies.every((e) => e.hp <= 0)) {
		state.over = true;
		state.outcome = 'victory';
	}
}

// ─── Off-field energy regen ─────────────────────────────────────────────────

/**
 * Benched (non-active), living party members trickle energy over time.
 * The active character does not — it charges through its own actions.
 */
function tickOffFieldEnergy(state: EngineState, now: number): void {
	if (now - lastEnergyRegenAt < OFF_FIELD_REGEN_MS) return;
	lastEnergyRegenAt = now;

	for (let i = 0; i < state.party.length; i++) {
		if (i === state.activeSlot) continue;
		const pc = state.party[i];
		if (pc.hp <= 0) continue;
		pc.energy = Math.min(
			pc.def.maxEnergy,
			pc.energy + OFF_FIELD_REGEN_MS * offFieldEnergyMultiplier(pc)
		);
	}
}

/**
 * Per-character multiplier on off-field regen. Extension seam for passives —
 * Sefyra's "Advent of the Light" plugs in here: return 1.5 while she holds
 * Divinity (pc.stacks.current > 0). Defaults to 1 for everyone today.
 */
function offFieldEnergyMultiplier(_pc: CharacterState): number {
	return 1;
}

// ─── Summon tick ──────────────────────────────────────────────────────────────

function tickSummons(state: EngineState, now: number): void {
	for (let i = state.summons.length - 1; i >= 0; i--) {
		const summon = state.summons[i];

		// Expire
		if (now >= summon.expiresAt) {
			publish('summon:expired', { summonId: summon.id });
			state.summons.splice(i, 1);
			continue;
		}

		// ── Mobile summons only (wolf, etc.) ─────────────────────────────
		if (summon) {
			const enemy = nearestEnemy(state, summon.pos);
			if (enemy && now >= summon.nextMoveAt) {
				if (chebyshev(summon.pos, enemy.pos) > 1) {
					summon.pos = clamp(state.board, step8Toward(summon.pos, enemy.pos));
				}
				summon.nextMoveAt = now + 500;
			}

			if (enemy && now >= summon.nextAttackAt && chebyshev(summon.pos, enemy.pos) <= 1) {
				const owner = state.party.find((p) => p.id === summon.ownerId);
				let dmg = 5;
				if (owner?.def.basicChain) {
					const idx = Math.max(0, owner.lastBaIndexLanded);
					dmg = owner.def.basicChain[idx]?.damage ?? 5;
				}
				enemy.hp = Math.max(0, enemy.hp - dmg);
				publish('damage:dealt', {
					source: summon.ownerId,
					target: enemy.id,
					amount: dmg,
					abilityName: 'Summon attack'
				});
				if (enemy.hp <= 0) {
					publish('enemy:defeated', { enemyId: enemy.id, killer: summon.ownerId });
				}
				summon.nextAttackAt = now + 1000;
			}
		}

	}
}

// ─── Construct tick ───────────────────────────────────────────────────────────
// Constructs live in state.constructs (not state.summons). They are stationary,
// pulse-only, and invisible to enemy aggro AI.

function tickConstructs(state: EngineState, now: number): void {
	for (let i = state.constructs.length - 1; i >= 0; i--) {
		const construct = state.constructs[i];

		// Expire
		if (now >= construct.expiresAt) {
			publish('construct:expired', { constructId: construct.id, ownerId: construct.ownerId });
			state.constructs.splice(i, 1);
			continue;
		}

		// Pulse
		if (now < construct.nextPulseAt) continue;
		construct.nextPulseAt = now + construct.pulseMs;

		for (const enemy of state.enemies) {
			if (enemy.hp <= 0) continue;
			if (chebyshev(enemy.pos, construct.pos) > construct.pulseRadius) continue;

			if (construct.pulseDmg > 0) {
				enemy.hp = Math.max(0, enemy.hp - construct.pulseDmg);
				publish('damage:dealt', {
					source: construct.ownerId,
					target: enemy.id,
					amount: construct.pulseDmg,
					abilityName: 'Construct pulse'
				});
				if (enemy.hp <= 0) {
					publish('enemy:defeated', { enemyId: enemy.id, killer: construct.ownerId });
				}
			}

			// Stun: only extend if the new deadline is later than what's already set.
			// One pylon (stunMs 800, pulseMs 2000) leaves a 1200ms escape window.
			// Two pylons with offset schedules can cover that gap for a soft lock.
			if (construct.stunMs > 0) {
				enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + construct.stunMs);
			}
		}
	}
}

// ─── Zone tick ────────────────────────────────────────────────────────────────

function tickZones(state: EngineState, now: number): void {
	for (let i = state.zones.length - 1; i >= 0; i--) {
		const zone = state.zones[i];

		// Update center if zone follows caster
		if (zone.follows === 'caster') {
			const owner = state.party.find((p) => p.id === zone.ownerId);
			if (owner) zone.center = { ...owner.pos };
		}

		// Expire
		if (now >= zone.expiresAt) {
			publish('zone:expired', { zoneId: zone.id });
			state.zones.splice(i, 1);
			continue;
		}

		// Tick: heal allies inside the zone
		if (zone.buff.tickMs && now - zone.lastTickAt >= zone.buff.tickMs) {
			zone.lastTickAt = now;

			for (const pc of state.party) {
				if (chebyshev(pc.pos, zone.center) <= zone.radius) {
					let heal = zone.buff.healPerTick ?? 0;
					if (pc.id === state.party[state.activeSlot].id) {
						heal += zone.buff.activeBonusHeal ?? 0;
					}

					if (heal > 0) {
						const before = pc.hp;
						pc.hp = Math.min(pc.def.maxHp, pc.hp + heal);
						const healed = pc.hp - before;
						if (healed > 0) {
							publish('heal:applied', {
								target: pc.id,
								source: zone.ownerId,
								amount: healed
							});
						}
					}

					// Zone damage to enemies (Ryoma, Maria Elena V, etc.)
					if (zone.buff.dmgPerTick && zone.buff.dmgPerTick > 0) {
						for (const enemy of state.enemies) {
							if (enemy.hp <= 0) continue;
							if (chebyshev(enemy.pos, zone.center) > zone.radius) continue;
							enemy.hp = Math.max(0, enemy.hp - zone.buff.dmgPerTick);
							publish('damage:dealt', {
								source: zone.ownerId,
								target: enemy.id,
								amount: zone.buff.dmgPerTick,
								abilityName: 'Zone tick'
							});
							if (enemy.hp <= 0) {
								publish('enemy:defeated', { enemyId: enemy.id, killer: zone.ownerId });
							}
						}
					}

					// Owner energy drain — zone self-destructs when owner runs dry
					if (zone.buff.ownerEnergyDrainPerTick && zone.buff.ownerEnergyDrainPerTick > 0) {
						const owner = state.party.find((p) => p.id === zone.ownerId);
						if (owner) {
							owner.energy -= zone.buff.ownerEnergyDrainPerTick;
							if (owner.energy <= 0) {
								owner.energy = 0;
								// Force-expire the zone — splice handled next frame by the loop guard
								zone.expiresAt = now;
							}
						}
					}
				}
			}
		}
	}
}
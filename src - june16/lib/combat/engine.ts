import type { CharacterState, EnemyState, EngineState, SummonState } from '$lib/types/state';
import { tickEffects } from './effects';
import { tickEnemyAi } from './ai';
import { chebyshev, samePos, clamp, step8Toward } from './board';
import { checkAutoSwap } from './swap';
import { publish } from './events';
import { nearestEnemy } from './query';
import { canEnter } from './spatial';
import { OFF_FIELD_REGEN_MS, regenOffField } from './energy';
import { calculateDamage } from './pipeline';
import { getCreationDef } from '$lib/data/creations';
import { grantStack } from './stacks';

/** Fallback movement step interval (ms) when a character omits moveMs. */
const DEFAULT_MOVE_MS = 150;

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
	const moveMs = active.def.moveMs ?? DEFAULT_MOVE_MS;
	if (active.stunnedUntil <= now && moveDir && now - lastMoveAt >= moveMs) {
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
	for (const pc of state.party) tickEffects(state, pc, now);
	for (const enemy of state.enemies) tickEffects(state, enemy, now);

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

function selectSummonTarget(state: EngineState, summon: SummonState, now: number): EnemyState | undefined {
	const alive = state.enemies.filter((e) => e.hp > 0);
	if (!alive.length) return undefined;

	// Sticky: stay on current target until window expires
	if (summon.stickyTargetId && summon.stickyUntil && now < summon.stickyUntil) {
		const sticky = alive.find((e) => e.id === summon.stickyTargetId);
		if (sticky) return sticky;
	}

	const def = getCreationDef(summon.defId);
	const targeting = def?.targeting ?? 'nearest';

	switch (targeting) {
		case 'highest_hp':
			return alive.reduce((a, b) => (a.hp >= b.hp ? a : b));
		case 'lowest_hp':
			return alive.reduce((a, b) => (a.hp <= b.hp ? a : b));
		case 'guardian': {
			const owner = state.party.find((p) => p.id === summon.ownerId);
			const radius = def?.guardianRadius ?? 3;
			if (owner) {
				const threats = alive
					.filter((e) => chebyshev(e.pos, owner.pos) <= radius)
					.sort((a, b) => chebyshev(a.pos, summon.pos) - chebyshev(b.pos, summon.pos));
				if (threats.length) return threats[0];
			}
			return nearestEnemy(state, summon.pos) ?? undefined;
		}
		case 'stationary': {
			const def2 = getCreationDef(summon.defId);
			return alive.find((e) => chebyshev(e.pos, summon.pos) <= (def2?.attackRange ?? 1));
		}
		case 'nearest':
		default:
			return nearestEnemy(state, summon.pos) ?? undefined;
	}
}

function tickSummons(state: EngineState, now: number): void {
	for (let i = state.summons.length - 1; i >= 0; i--) {
		const summon = state.summons[i];

		if (now >= summon.expiresAt) {
			publish('summon:expired', { summonId: summon.id });
			state.summons.splice(i, 1);
			continue;
		}

		const def = getCreationDef(summon.defId);
		const moveMs = def?.moveCooldownMs ?? 500;
		const attackMs = def?.attackCooldownMs ?? 1000;
		const attackRange = def?.attackRange ?? 1;
		const targeting = def?.targeting ?? 'nearest';

		const target = selectSummonTarget(state, summon, now);

		// Commit sticky target
		if (target && target.id !== summon.stickyTargetId) {
			summon.stickyTargetId = target.id;
			summon.stickyUntil = now + (def?.stickyTargetMs ?? 1500);
		}

		// Movement
		if (now >= summon.nextMoveAt) {
			if (targeting === 'guardian') {
				const owner = state.party.find((p) => p.id === summon.ownerId);
				const distToOwner = owner ? chebyshev(summon.pos, owner.pos) : 999;
				const guardRadius = def?.guardianRadius ?? 3;
				const threatNear = owner
					? state.enemies.some((e) => e.hp > 0 && chebyshev(e.pos, owner.pos) <= guardRadius)
					: false;
				if (distToOwner > 2) {
					summon.pos = clamp(state.board, step8Toward(summon.pos, owner!.pos));
				} else if (!threatNear && target && chebyshev(summon.pos, target.pos) > attackRange) {
					summon.pos = clamp(state.board, step8Toward(summon.pos, target.pos));
				}
			} else if (targeting !== 'stationary' && target) {
				if (chebyshev(summon.pos, target.pos) > attackRange) {
					summon.pos = clamp(state.board, step8Toward(summon.pos, target.pos));
				}
			}
			summon.nextMoveAt = now + moveMs;
		}

		// Attack
		const inRange = target && chebyshev(summon.pos, target.pos) <= attackRange;
		if (inRange && now >= summon.nextAttackAt) {
			let baseDmg = def?.attackDamage ?? 0;
			if (def?.mirrorsOwnerBA) {
				const owner = state.party.find((p) => p.id === summon.ownerId);
				if (owner?.def.basicChain) {
					const idx = Math.max(0, owner.lastBaIndexLanded);
					baseDmg = owner.def.basicChain[idx]?.damage ?? baseDmg;
				}
			}

			const owner = summon.receiveBuffs
				? state.party.find((p) => p.id === summon.ownerId)
				: undefined;

			const dmg = owner
				? calculateDamage(baseDmg, { source: owner, target: target!, state, sourcePos: summon.pos })
				: baseDmg;

			target!.hp = Math.max(0, target!.hp - dmg);
			publish('damage:dealt', { source: summon.ownerId, target: target!.id, amount: dmg, abilityName: 'Summon attack' });

			if (def?.stunMs && def.stunMs > 0) {
				target!.stunnedUntil = Math.max(target!.stunnedUntil, now + def.stunMs);
			}
			if (target!.hp <= 0) {
				publish('enemy:defeated', { enemyId: target!.id, killer: summon.ownerId });
			}

			// AoE splash
			if (def?.aoeRadius && def.aoeRadius > 0) {
				for (const enemy of state.enemies) {
					if (enemy.hp <= 0 || enemy.id === target!.id) continue;
					if (chebyshev(enemy.pos, target!.pos) > def.aoeRadius) continue;
					const splash = owner
						? calculateDamage(baseDmg, { source: owner, target: enemy, state, sourcePos: summon.pos })
						: baseDmg;
					enemy.hp = Math.max(0, enemy.hp - splash);
					publish('damage:dealt', { source: summon.ownerId, target: enemy.id, amount: splash, abilityName: 'Summon attack' });
					if (enemy.hp <= 0) publish('enemy:defeated', { enemyId: enemy.id, killer: summon.ownerId });
					rewardOwner(state, summon.ownerId, summon.defId, now);
				}
			}

			summon.nextAttackAt = now + attackMs;
			publish('summon:attack', { summonId: summon.id, ownerId: summon.ownerId, fromPos: { ...summon.pos }, toPos: { ...target!.pos }, isRanged: attackRange > 1, element: summon.element });
			publish('summon:attack', {
				summonId: summon.id,
				ownerId: summon.ownerId,
				fromPos: { ...summon.pos },
				toPos: { ...target!.pos },
				isRanged: attackRange > 1,
				element: summon.element
			});
		}
	}
}

function rewardOwner(state: EngineState, ownerId: string, defId: string, now: number): void {
	const def = getCreationDef(defId);
	if (!def) return;
	const owner = state.party.find((p) => p.id === ownerId);
	if (!owner || owner.hp <= 0) return;
	if (def.energyPerHit) {
		owner.energy = Math.min(owner.def.maxEnergy, owner.energy + def.energyPerHit);
	}
	if (def.grantsOwnerStack) {
		grantStack(state, owner, def.grantsOwnerStack, now);
	}
}

// ─── Construct tick ───────────────────────────────────────────────────────────
// Constructs live in state.constructs (not state.summons). They are stationary,
// pulse-only, and invisible to enemy aggro AI.

function tickConstructs(state: EngineState, now: number): void {
	for (let i = state.constructs.length - 1; i >= 0; i--) {
		const construct = state.constructs[i];
		const def = getCreationDef(construct.defId);
		if (now >= construct.expiresAt) {
			publish('construct:expired', { constructId: construct.id, ownerId: construct.ownerId });
			state.constructs.splice(i, 1);
			continue;
		}

		if (now < construct.nextPulseAt) continue;
		const owner = construct.receiveBuffs
			? state.party.find((p) => p.id === construct.ownerId)
			: undefined;
		construct.nextPulseAt = now + construct.pulseMs;
		// Ring FX — once per tick, before the damage loop
		if (construct.pulseDmg > 0 && construct.targetingType !== 'turret') {
			publish('construct:pulse', { constructId: construct.id, pos: { ...construct.pos }, element: construct.element, radius: construct.pulseRadius });
		}

		// Own pulse — all types
		// Own pulse — branches on targetingType
		if (construct.pulseDmg > 0) {
			if (construct.targetingType === 'turret') {
				// Scan: find nearest enemy in range, hit only them
				const target = state.enemies
					.filter((e) => e.hp > 0 && chebyshev(e.pos, construct.pos) <= construct.pulseRadius)
					.sort((a, b) => chebyshev(a.pos, construct.pos) - chebyshev(b.pos, construct.pos))[0];
				if (target) {
					const dmg = owner
						? calculateDamage(construct.pulseDmg, { source: owner, target: target, state, sourcePos: construct.pos, element: construct.element })
						: construct.pulseDmg;
					target.hp = Math.max(0, target.hp - dmg);
					publish('construct:turret', { constructId: construct.id, pos: { ...construct.pos }, targetPos: { ...target.pos }, element: construct.element });
					publish('damage:dealt', {
						source: construct.ownerId,
						target: target.id,
						amount: dmg,
						abilityName: 'Construct turret',
						element: construct.element
					});
					if (target.hp <= 0) publish('enemy:defeated', { enemyId: target.id, killer: construct.ownerId });
					rewardOwner(state, construct.ownerId, construct.defId, now);
				}
			} else {
				// Pulse (default): hit all enemies in radius
				for (const enemy of state.enemies) {
					if (enemy.hp <= 0) continue;
					if (chebyshev(enemy.pos, construct.pos) > construct.pulseRadius) continue;
					if (def?.hits && !def.hits.includes(enemy.stratum)) continue;
					const dmg = owner
						? calculateDamage(construct.pulseDmg, { source: owner, target: enemy, state, sourcePos: construct.pos, element: construct.element })
						: construct.pulseDmg;
					enemy.hp = Math.max(0, enemy.hp - dmg);
					publish('damage:dealt', {
						source: construct.ownerId,
						target: enemy.id,
						amount: dmg,
						abilityName: 'Construct pulse',
						element: construct.element
					});
					if (enemy.hp <= 0) publish('enemy:defeated', { enemyId: enemy.id, killer: construct.ownerId });
					rewardOwner(state, construct.ownerId, construct.defId, now);
				}
			}
		}

		// Stun still applies to all enemies in range regardless of targeting type
		for (const enemy of state.enemies) {
			if (enemy.hp <= 0 || construct.stunMs <= 0) continue;
			if (chebyshev(enemy.pos, construct.pos) > construct.pulseRadius) continue;
			if (def?.hits && !def.hits.includes(enemy.stratum)) continue;
			enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + construct.stunMs);
		}

		// Catalyst: one extra pulse per allied source in range, skipping same element
		if (construct.constructType === 'catalyst' && construct.pulseDmg > 0) {
			const sources = state.constructs.filter(c =>
				c.id !== construct.id &&
				c.constructType === 'source' &&
				c.element &&
				c.element !== construct.element &&
				state.party.some(p => p.id === c.ownerId) &&
				chebyshev(c.pos, construct.pos) <= construct.pulseRadius
			);
			for (const source of sources) {
				publish('construct:catalyst', { constructId: construct.id, pos: { ...construct.pos }, element: source.element, radius: construct.pulseRadius });
				for (const enemy of state.enemies) {
					if (enemy.hp <= 0) continue;
					if (chebyshev(enemy.pos, construct.pos) > construct.pulseRadius) continue;
					if (def?.hits && !def.hits.includes(enemy.stratum)) continue;
					const dmg = owner
						? calculateDamage(construct.pulseDmg, { source: owner, target: enemy, state, sourcePos: construct.pos, element: construct.element })
						: construct.pulseDmg;
					enemy.hp = Math.max(0, enemy.hp - dmg);
					publish('damage:dealt', {
						source: construct.ownerId,
						target: enemy.id,
						amount: dmg,
						abilityName: 'Catalyst pulse',
						element: source.element       // carries the source's element
					});
					if (enemy.hp <= 0) publish('enemy:defeated', { enemyId: enemy.id, killer: construct.ownerId });
					rewardOwner(state, construct.ownerId, construct.defId, now);
				}
			}
		}
	}
}

// ─── Zone tick ────────────────────────────────────────────────────────────────

function tickZones(state: EngineState, now: number): void {
	for (let i = state.zones.length - 1; i >= 0; i--) {
		const zone = state.zones[i];

		// Update center if zone follows caster or active unit
		if (zone.follows === 'caster') {
			const owner = state.party.find((p) => p.id === zone.ownerId);
			if (owner) zone.center = { ...owner.pos };
		} else if (zone.follows === 'active') {
			zone.center = { ...state.party[state.activeSlot].pos };
		}

		// Expire
		if (now >= zone.expiresAt) {
			publish('zone:expired', { zoneId: zone.id });
			state.zones.splice(i, 1);
			continue;
		}


		// Tick: periodic heal / damage / drain
		if (zone.buff.tickMs && now - zone.lastTickAt >= zone.buff.tickMs) {
			zone.lastTickAt = now;

			// Heal allies inside the zone
			for (const pc of state.party) {
				if (chebyshev(pc.pos, zone.center) > zone.radius) continue;
				let heal = zone.buff.healPerTick ?? 0;
				if (pc.id === state.party[state.activeSlot].id) {
					heal += zone.buff.activeBonusHeal ?? 0;
				}
				if (heal > 0) {
					const before = pc.hp;
					pc.hp = Math.min(pc.def.maxHp, pc.hp + heal);
					const healed = pc.hp - before;
					if (healed > 0) {
						publish('heal:applied', { target: pc.id, source: zone.ownerId, amount: healed });
					}
				}
			}

			// Damage enemies inside the zone — once per tick, party-independent
			if (zone.buff.dmgPerTick && zone.buff.dmgPerTick > 0) {
				const owner = state.party.find((p) => p.id === zone.ownerId);
				if (owner) {
					// owner alive — full pipeline
					for (const enemy of state.enemies) {
						if (enemy.hp <= 0) continue;
						if (chebyshev(enemy.pos, zone.center) > zone.radius) continue;
						const dmg = calculateDamage(zone.buff.dmgPerTick, {
							source: owner,
							target: enemy,
							originZoneId: zone.id,
							state
						});
						enemy.hp = Math.max(0, enemy.hp - dmg);
						publish('damage:dealt', {
							source: zone.ownerId,
							target: enemy.id,
							amount: dmg,
							abilityName: 'Zone tick'
						});
						if (enemy.hp <= 0) {
							publish('enemy:defeated', { enemyId: enemy.id, killer: zone.ownerId });
						}
					}
				} else if (zone.persistsAfterDeath) {
					// owner dead, zone opted in — flat dmgPerTick, no pipeline
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
			}

			// Owner upkeep drain — reduced per owner stack (Ascension). ceil() keeps
			// it integer; at reductionPerStack 0.15, 7 stacks → free upkeep.
			if (zone.buff.ownerEnergyDrainPerTick && zone.buff.ownerEnergyDrainPerTick > 0) {
				const owner = state.party.find((p) => p.id === zone.ownerId);
				if (owner) {
					const base = zone.buff.ownerEnergyDrainPerTick;
					const red = zone.buff.upkeepReductionPerStack ?? 0;
					const stacks = owner.stacks?.current ?? 0;
					const drain = red > 0 ? Math.max(0, Math.ceil(base * (1 - red * stacks))) : base;
					if (drain > 0) {
						owner.energy = Math.max(0, owner.energy - drain);
						if (owner.energy <= 0) zone.expiresAt = now; // ran dry → ring collapses
					}
				}
			}
		}

		// Per-tick gather — pull enemies toward zone center
		if (zone.buff.gatherPerTick) {
			const { steps } = zone.buff.gatherPerTick;
			for (const enemy of state.enemies) {
				if (enemy.hp <= 0) continue;
				if (chebyshev(enemy.pos, zone.center) > zone.radius) continue;
				if (samePos(enemy.pos, zone.center)) continue;
				const efrom = { ...enemy.pos };
				let ep = enemy.pos;
				for (let i = 0; i < steps; i++) {
					if (samePos(ep, zone.center)) break;
					const next = clamp(state.board, step8Toward(ep, zone.center));
					if (samePos(next, ep)) break;
					ep = next;
				}
				if (!samePos(efrom, ep)) {
					enemy.pos = ep;
					publish('movement:enemy', { enemyId: enemy.id, from: efrom, to: ep });
				}
			}
		}
	}
}


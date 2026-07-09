import type { EnemyState, EngineState, SummonState } from '$lib/types/state';
import { tickEffects } from './effects';
import { reconcileStackBuffs, tickStackDecay } from './stacks';
import { fireEnemyAttacks, tickEnemyAi } from './ai';
import { tileBlockedByConstruct } from './ai/utils';
import { chebyshev, samePos, clamp, step8Toward, occupies } from './board';
import { checkAutoSwap } from './swap';
import { publish } from './events';
import { nearestEnemy } from './query';
import { canEnter, gapCloseLanding, canJuggernautStep, juggerShove } from './spatial';
import { OFF_FIELD_REGEN_MS, regenOffField } from './energy';
import { calculateDamage } from './pipeline';
import { getCreationDef } from '$lib/data/creations';
import { applyOnHit, canHitStratum, type ResolveSource } from './resolve';
import { tickChannel } from './channel';
import { fireWindUpCasts } from './ability-resolver';
import { checkWaveAdvance, onWaveCleared } from './wave';

/** Fallback movement step interval (ms) when a character omits moveMs. */
const DEFAULT_MOVE_MS = 150;

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
	if (active.stunnedUntil <= now && moveDir && now - state.lastMoveAt >= moveMs) {
		const next = clamp(state.board, {
			x: active.pos.x + Math.sign(moveDir.x),
			y: active.pos.y + Math.sign(moveDir.y)
		});

		// Don't walk into enemies, constructs, or summons
		const blocked = state.enemies.some((e) => e.hp > 0 && samePos(next, e.pos))
			|| tileBlockedByConstruct(state, next, active.stratum, active.def.ignoresConstructs)
			|| state.summons.some((s) => occupies(s, next));
		const passable = canEnter(active.stratum, next, state.board, active.def.traversal);
		if (!blocked && passable && !samePos(next, active.pos)) {
			const from = { ...active.pos };
			active.pos = next;
			state.lastMoveAt = now;
			publish('movement:player', { characterId: active.id, from, to: next });
		}

	}


	// 2. Enemy AI ticks
	for (const enemy of state.enemies) {
		if (enemy.hp <= 0) continue;
		tickEnemyAi(state, enemy, now);
		fireEnemyAttacks(state, now);
	}

	tickChannel(state, now);
	fireWindUpCasts(state, now);

	// 3. Summon ticks
	tickSummons(state, now);

	// 3b. Construct ticks (separate from summons — not targeted by AI aggro)
	tickConstructs(state, now);

	// 4. Zone ticks
	tickZones(state, now);

	// Off-field energy regen (rules in energy.ts)
	if (now - state.lastEnergyRegenAt >= OFF_FIELD_REGEN_MS) {
		state.lastEnergyRegenAt = now;
		regenOffField(state);
	}

	// 5. Effect expiry / tick hooks for all entities
	for (const pc of state.party) tickEffects(state, pc, now);
	for (const enemy of state.enemies) tickEffects(state, enemy, now);
	// Stack-gated persistent buffs (e.g. Frosty's per-stack aura / creation buff)
	for (const pc of state.party) reconcileStackBuffs(pc, now);
	// Expire stacks for characters with a decay timer (e.g. Frosty's eclipse stacks)
	tickStackDecay(state, now);

	// 6. Wave advance (intermission countdown + time-limit check) — before death checks.
	if (state.wave) {
		checkWaveAdvance(state, now);
		if (state.over) return;
	}

	// 7. Death checks
	if (!checkAutoSwap(state)) {
		state.over = true;
		state.outcome = 'defeat';
	}

	// Victory: all enemies dead. In wave mode, delegate to the wave system
	// (which either starts the next wave's intermission or ends the challenge).
	// Guard with length > 0 to avoid vacuous true on an empty array during intermission.
	if (state.enemies.length > 0 && state.enemies.every((e) => e.hp <= 0)) {
		if (state.wave && state.wave.phase === 'fighting') {
			onWaveCleared(state, now);
		} else if (!state.wave) {
			state.over = true;
			state.outcome = 'victory';
		}
	}
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
			/** Step toward `toward` only if the target tile is clear.
			 *  Juggernauts shove units aside; normal summons are blocked. */
			const tryStep = (toward: Position) => {
				const next = clamp(state.board, step8Toward(summon.pos, toward));
				if (samePos(next, summon.pos)) return;
				const fp = summon.footprint ?? [{ x: 0, y: 0 }];
				if (summon.juggernaut) {
					if (!canJuggernautStep(state, fp, next, summon.stratum)) return;
					const newTiles = fp.map((o) => ({ x: next.x + o.x, y: next.y + o.y }));
					juggerShove(state, summon.id, newTiles, publish);
					summon.pos = next;
				} else {
					if (state.board.obstacles.some((o) => samePos(o, next))) return;
					if (tileBlockedByConstruct(state, next, summon.stratum)) return;
					summon.pos = next;
				}
			};

			if (targeting === 'guardian') {
				const owner = state.party.find((p) => p.id === summon.ownerId);
				const distToOwner = owner ? chebyshev(summon.pos, owner.pos) : 999;
				const guardRadius = def?.guardianRadius ?? 3;
				const threatNear = owner
					? state.enemies.some((e) => e.hp > 0 && chebyshev(e.pos, owner.pos) <= guardRadius)
					: false;
				if (distToOwner > 2) {
					tryStep(owner!.pos);
				} else if (!threatNear && target && chebyshev(summon.pos, target.pos) > attackRange) {
					tryStep(target.pos);
				}
			} else if (targeting !== 'stationary' && target) {
				// A gap-close summon within leap range holds position and waits to
				// pounce (the leap fires on the attack beat); otherwise it walks in.
				const willLeap = !!def?.gapClose &&
					chebyshev(summon.pos, target.pos) <= (def.gapCloseRange ?? Infinity);
				if (!willLeap && chebyshev(summon.pos, target.pos) > attackRange) {
					tryStep(target.pos);
				}
			}
			summon.nextMoveAt = now + moveMs;
		}

		// Attack (with optional gap-close leap on the attack beat)
		let inRange = !!target && chebyshev(summon.pos, target.pos) <= attackRange;
		if (
			target && !inRange && def?.gapClose && now >= summon.nextAttackAt &&
			chebyshev(summon.pos, target.pos) <= (def.gapCloseRange ?? Infinity)
		) {
			const landing = gapCloseLanding(state, summon, target.pos, attackRange);
			if (landing) {
				const from = { ...summon.pos };
				summon.pos = landing;
				inRange = chebyshev(summon.pos, target.pos) <= attackRange;
				publish('entity:dash', { id: summon.id, from, to: { ...landing } });
			}
		}
		if (inRange && now >= summon.nextAttackAt) {
			let baseDmg = def?.attackDamage ?? 0;
			if (def?.mirrorsOwnerBA) {
				const owner = state.party.find((p) => p.id === summon.ownerId);
				if (owner?.def.basicChain) {
					const idx = Math.max(0, owner.lastBaIndexLanded);
					baseDmg = owner.def.basicChain[idx]?.delivery?.damage ?? baseDmg;
				}
			}

			const owner = state.party.find((p) => p.id === summon.ownerId);
			if (owner) {
				// Merge def.onHit with the summon's aoeRadius splash (if any) so both the
				// unified onHit AND the legacy aoeRadius field produce splash.
				const onHit = def?.aoeRadius && def.aoeRadius > 0
					? { ...(def.onHit ?? {}), splash: def.onHit?.splash ?? { radius: def.aoeRadius } }
					: def?.onHit;

				const src: ResolveSource = {
					owner,
					abilityName: 'Summon attack',
					element: summon.element,
					sourcePos: summon.pos,
					tags: ['creation'],
					flatDamage: !summon.receiveBuffs   // unbuffed unless the def opts into pipeline
				};
				applyOnHit(state, target!, baseDmg, onHit, src, now);
			}

			summon.nextAttackAt = now + attackMs;
			publish('summon:attack', { summonId: summon.id, ownerId: summon.ownerId, fromPos: { ...summon.pos }, toPos: { ...target!.pos }, isRanged: attackRange > 1, element: summon.element });
		}
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
		const owner = state.party.find((p) => p.id === construct.ownerId);
		construct.nextPulseAt = now + construct.pulseMs;
		// Ring FX — once per tick, before the damage loop
		if (construct.pulseDmg > 0 && construct.targetingType !== 'turret') {
			publish('construct:pulse', { constructId: construct.id, pos: { ...construct.pos }, element: construct.element, radius: construct.pulseRadius });
		}

		if (!owner) continue; // owner gone (dead + not persisted) — nothing to attribute

		// Build the per-hit payload from the def, injecting the construct's denormalized
		// stun so a construct stuns through the same onHit path as everything else.
		const baseOnHit = def?.onHit ?? {};
		const onHit = construct.stunMs > 0 && !baseOnHit.stunMs
			? { ...baseOnHit, stunMs: construct.stunMs }
			: baseOnHit;

		const src: ResolveSource = {
			owner,
			abilityName: 'Construct pulse',
			element: construct.element,
			sourcePos: construct.pos,
			tags: ['creation'],
			flatDamage: !construct.receiveBuffs
		};

		const strata = def?.hitsStrata;

		// Own pulse — branches on targetingType
		if (construct.pulseDmg > 0) {
			if (construct.targetingType === 'turret') {
				// Scan: nearest enemy in range, hit only them.
				const target = state.enemies
					.filter((e) => e.hp > 0 && chebyshev(e.pos, construct.pos) <= construct.pulseRadius && canHitStratum(strata, e.stratum))
					.sort((a, b) => chebyshev(a.pos, construct.pos) - chebyshev(b.pos, construct.pos))[0];
				if (target) {
					publish('construct:turret', { constructId: construct.id, pos: { ...construct.pos }, targetPos: { ...target.pos }, element: construct.element });
					applyOnHit(state, target, construct.pulseDmg, onHit, { ...src, abilityName: 'Construct turret' }, now);
				}
			} else {
				// Pulse (default): hit all enemies in radius.
				for (const enemy of state.enemies) {
					if (enemy.hp <= 0) continue;
					if (chebyshev(enemy.pos, construct.pos) > construct.pulseRadius) continue;
					if (!canHitStratum(strata, enemy.stratum)) continue;
					applyOnHit(state, enemy, construct.pulseDmg, onHit, src, now);
				}
			}
		}

		// Catalyst: one extra pulse per allied source in range, skipping same element.
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
				const catSrc: ResolveSource = { ...src, abilityName: 'Catalyst pulse', element: source.element, tags: ['creation', 'reaction'] };
				for (const enemy of state.enemies) {
					if (enemy.hp <= 0) continue;
					if (chebyshev(enemy.pos, construct.pos) > construct.pulseRadius) continue;
					if (!canHitStratum(strata, enemy.stratum)) continue;
					applyOnHit(state, enemy, construct.pulseDmg, onHit, catSrc, now);
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
					// owner alive — route through the unified resolver, same as BAs/
					// abilities/summons/constructs. This is what makes onHit.energyGain,
					// grantsStack, splash, stun, lifesteal, etc. work on a zone tick.
					const src: ResolveSource = {
						owner,
						abilityName: 'Zone tick',
						element: owner.def.element,
						originZoneId: zone.id,
						sourcePos: zone.center
					};
					for (const enemy of state.enemies) {
						if (enemy.hp <= 0) continue;
						if (chebyshev(enemy.pos, zone.center) > zone.radius) continue;
						applyOnHit(state, enemy, zone.buff.dmgPerTick, zone.buff.onHit, src, now);
					}
				} else if (zone.persistsAfterDeath) {
					// owner dead, zone opted in — flat dmgPerTick, no pipeline, no owner
					// resources (there's no owner to receive them). onHit's CC/splash
					// still wouldn't make sense to skip here, but there's no owner for
					// the resource half — keep this branch as plain damage.
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
					if (state.board.obstacles.some((o) => samePos(o, next))) break;
					if (tileBlockedByConstruct(state, next, enemy.stratum)) break;
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
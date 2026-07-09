import type { EngineState, CharacterState, EnemyState } from '$lib/types/state';
import type { Ability, AbilityOpts } from '$lib/types/ability';
import { chebyshev, step8Toward, step8Away, samePos, clamp } from '../board';
import { nearestEnemy } from '../query';
import { publish } from '../events';
import { applyDelivery, applyOnHit, canHitStratum, type ResolveSource } from '../resolve';
import { walk } from '../movement';

type Vec = { x: number; y: number };

/**
 * dash: caster repositions; optional damage / displacement (Data Contract §6).
 *
 * Two shapes of dash, chosen by `delivery.shapeParams.dir`:
 *   • 'toward' (default) — legacy gap-closer: teleport adjacent to the nearest
 *     enemy in range, optional knockback + damage.  (June9's C.)
 *   • 'forward' | 'back' | 'away' — aim-directional travel via the shared walker
 *     (movement.ts). Hits the first enemy along the line, then an optional radius
 *     blast at the stop point.  (Sefyra's C — Photonic Transfiguration.)
 *
 * Damage / CC / resources all flow through the unified resolver (applyOnHit), so
 * a dash hit splashes/stuns/lifesteals like anything else. `gather` stays here —
 * it's caster-relative repositioning of enemies, not a per-hit consequence.
 *
 * Recognised `delivery.shapeParams` (all optional):
 *   dir, tiles, throughObstacles, blastDamage, blastRadius, iframesMs, range.
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	now: number,
	opts: AbilityOpts = {}
): boolean {
	const sp = (ability.delivery?.shapeParams ?? {}) as Record<string, unknown>;
	const dir = (sp.dir as string | undefined) ?? 'toward';
	const baseDmg = ability.delivery?.damage ?? 0;
	const strata = ability.delivery?.hitsStrata;

	const canHit = (e: EnemyState) => canHitStratum(strata, e.stratum);

	const src: ResolveSource = {
		owner: caster,
		abilityName: ability.name,
		element: caster.def.element,
		ability
	};

	// Guaranteed cast-time floor (energy/heal/shield/stack regardless of hits).
	applyDelivery(state, ability.delivery, src, now);

	// ── Directional dash (forward / back / away) — Sefyra's C ────────────────────
	if (dir === 'forward' || dir === 'back' || dir === 'away') {
		const aim = resolveAim(state, caster, opts);
		const tiles =
			(sp.tiles as number | undefined) ??
			opts.chargedRange ??
			(sp.range as number | undefined) ??
			3;

		const res = walk(state, caster, {
			tiles,
			dir: dir as 'forward' | 'back' | 'away',
			aim,
			throughObstacles: (sp.throughObstacles as boolean | undefined) ?? false,
			iframesMs: sp.iframesMs as number | undefined
		});
		publish('movement:player', { characterId: caster.id, from: res.from, to: res.to });

		// Enemies struck along the dash line. `allInLine` (shapeParams) sweeps every
		// enemy on the trajectory; default hits only the first.
		if (baseDmg > 0) {
			const allInLine = sp.allInLine === true;
			const struck = new Set<string>();
			scan: for (const t of res.trajectory) {
				for (const e of state.enemies) {
					if (e.hp > 0 && canHit(e) && samePos(e.pos, t) && !struck.has(e.id)) {
						applyOnHit(state, e, baseDmg, ability.onHit, src, now);
						struck.add(e.id);
						if (!allInLine) break scan;
					}
				}
			}
		}

		// Terminal blast at the stop point.
		const blastDamage = sp.blastDamage as number | undefined;
		if (blastDamage && blastDamage > 0) {
			const radius = (sp.blastRadius as number | undefined) ?? 1;
			for (const e of state.enemies) {
				if (e.hp > 0 && canHit(e) && chebyshev(e.pos, res.to) <= radius) {
					// Blast uses the same onHit (splash/stun/etc.) at blast damage.
					applyOnHit(state, e, blastDamage, ability.onHit, src, now);
				}
			}
		}

		// Caster-relative gather (pull toward the stop point).
		runGather(state, caster, ability, now);

		return true; // movement / utility ability — always "connects" (Data Contract §11.5)
	}

	// ── Legacy gap-closer (dir: 'toward') — June9's C ─────────────────────────────
	const effRange = opts.chargedRange ?? (sp.range as number | undefined) ?? 3;

	const enemy = nearestEnemy(state, caster.pos, effRange);
	if (!enemy) return false;

	const from = { ...caster.pos };
	let p = caster.pos;
	for (let i = 0; i < effRange + 1; i++) {
		if (chebyshev(p, enemy.pos) <= 1) break;
		const next = clamp(state.board, step8Toward(p, enemy.pos));
		if (samePos(next, enemy.pos)) break;
		p = next;
	}
	caster.pos = p;
	publish('movement:player', { characterId: caster.id, from, to: p });

	// Caster-relative gather (pull toward the landing).
	runGather(state, caster, ability, now);

	// Primary hit on the gap-closed enemy (knockback/stun/etc. via onHit).
	if (baseDmg > 0 && canHit(enemy)) {
		applyOnHit(state, enemy, baseDmg, ability.onHit, src, now);
	}

	return true;
}

/**
 * Gather: pull enemies within `radius` of the caster toward the caster.
 * Caster-relative repositioning — lives in dash, not in applyOnHit (which is
 * target-relative). radius = catch reach (Chebyshev); steps = tiles pulled in.
 */
function runGather(state: EngineState, caster: CharacterState, ability: Ability, _now: number): void {
	const gather = ability.gather;
	if (!gather) return;
	for (const e of state.enemies) {
		if (e.hp <= 0) continue;
		if (chebyshev(e.pos, caster.pos) > gather.radius) continue;
		const efrom = { ...e.pos };
		let ep = e.pos;
		for (let i = 0; i < gather.steps; i++) {
			if (chebyshev(ep, caster.pos) <= 1) break;
			const next = clamp(state.board, step8Toward(ep, caster.pos));
			if (samePos(next, ep) || samePos(next, caster.pos)) break;
			ep = next;
		}
		if (!samePos(efrom, ep)) {
			e.pos = ep;
			publish('movement:enemy', { enemyId: e.id, from: efrom, to: ep });
		}
	}
}

/** Resolve a travel direction: explicit aimDir → reticle → facing → toward nearest → +x. */
function resolveAim(state: EngineState, caster: CharacterState, opts: AbilityOpts): Vec {
	if (opts.aimDir && (opts.aimDir.x !== 0 || opts.aimDir.y !== 0)) return opts.aimDir;
	if (opts.reticle && !samePos(opts.reticle, caster.pos)) {
		return { x: opts.reticle.x - caster.pos.x, y: opts.reticle.y - caster.pos.y };
	}
	if (caster.facing && (caster.facing.x !== 0 || caster.facing.y !== 0)) return caster.facing;
	const reach = Math.max(state.board.size.width, state.board.size.height);
	const near = nearestEnemy(state, caster.pos, reach);
	if (near) return { x: near.pos.x - caster.pos.x, y: near.pos.y - caster.pos.y };
	return { x: 1, y: 0 };
}
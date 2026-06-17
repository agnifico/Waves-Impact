import type { EngineState, CharacterState } from '$lib/types/state';
import type { Ability } from '$lib/types/ability';
import { chebyshev, step8Toward, step8Away, samePos, clamp } from '../board';
import { nearestEnemy } from '../query';
import { calculateDamage } from '../pipeline';
import { publish } from '../events';
import { coversStratum } from '../spatial';
import { walk } from '../movement';

type Vec = { x: number; y: number };

export interface DashOpts {
	chargedRange?: number; // holdBehavior 'charge'
	reticle?: Vec | null; // holdBehavior 'aim' release point → sets travel direction
	aimDir?: Vec; // optional explicit travel direction (input layer may supply)
	lockedTargetId?: string;
}

/**
 * dash: caster repositions; optional damage / displacement (Data Contract §6).
 *
 * Two shapes of dash, chosen by `shapeParams.dir`:
 *   • 'toward' (default) — legacy gap-closer: teleport adjacent to the nearest
 *     enemy in range, optional knockback + damage.  (June9's C — unchanged.)
 *   • 'forward' | 'back' | 'away' — aim-directional travel via the shared walker
 *     (movement.ts). Hits the first enemy along the line for `damage`, then an
 *     optional radius blast at the stop point.  (Sefyra's C — Photonic Transfiguration.)
 *
 * Recognised `shapeParams` (all optional):
 *   dir, tiles, throughObstacles, blastDamage, blastRadius, iframesMs, range.
 */
export function resolve(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	_now: number,
	opts: DashOpts = {}
): boolean {
	const sp = (ability.shapeParams ?? {}) as Record<string, unknown>;
	const dir = (sp.dir as string | undefined) ?? 'toward';

	const canHit = (e: (typeof state.enemies)[number]) =>
		!ability.hits || coversStratum(ability.hits, e.stratum);

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

		// First enemy struck along the dash line.
		if (ability.damage && ability.damage > 0) {
			let hit: (typeof state.enemies)[number] | null = null;
			scan: for (const t of res.trajectory) {
				for (const e of state.enemies) {
					if (e.hp > 0 && canHit(e) && samePos(e.pos, t)) {
						hit = e;
						break scan;
					}
				}
			}
			if (hit) dealDamage(state, caster, ability, hit, ability.damage);
		}

		// Terminal blast at the stop point.
		const blastDamage = sp.blastDamage as number | undefined;
		if (blastDamage && blastDamage > 0) {
			const radius = (sp.blastRadius as number | undefined) ?? 1;
			for (const e of state.enemies) {
				if (e.hp > 0 && canHit(e) && chebyshev(e.pos, res.to) <= radius) {
					dealDamage(state, caster, ability, e, blastDamage);
				}
			}
		}

		return true; // movement / utility ability — always "connects" (Data Contract §11.5)
	}

	// ── Legacy gap-closer (dir: 'toward') — June9's C, unchanged ──────────────────
	const effRange = opts.chargedRange ?? (ability.shapeParams?.range as number | undefined) ?? 3;

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

	if (ability.knockback) {
		const enemyFrom = { ...enemy.pos };
		let ep = enemy.pos;
		for (let i = 0; i < ability.knockback; i++) {
			const next = clamp(state.board, step8Away(ep, caster.pos));
			if (samePos(next, ep)) break;
			ep = next;
		}
		enemy.pos = ep;
		publish('movement:enemy', { enemyId: enemy.id, from: enemyFrom, to: ep });
	}

	// Gather: pull enemies within `radius` of the landing toward the caster.
	// radius = catch reach (Chebyshev); steps = tiles pulled in. Net effect: a tight
	// cluster in the 3×3 ring around her. (Sefyra scales this up later.)
	const gather = ability.gather;
	if (gather) {
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

	if (ability.damage && ability.damage > 0) {
		const finalDmg = calculateDamage(ability.damage, {
			source: caster,
			target: enemy,
			ability,
			element: caster.def.element,
			state
		});
		enemy.hp = Math.max(0, enemy.hp - finalDmg);
		publish('damage:dealt', {
			source: caster.id,
			target: enemy.id,
			amount: finalDmg,
			abilityName: ability.name,
			element: caster.def.element
		});
		if (enemy.hp <= 0) {
			publish('enemy:defeated', { enemyId: enemy.id, killer: caster.id });
		}
	}

	return true;
}

/** Resolve a travel direction: explicit aimDir → reticle → facing → toward nearest → +x. */
function resolveAim(state: EngineState, caster: CharacterState, opts: DashOpts): Vec {
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

/** Damage one enemy through the pipeline + publish the canonical events. */
function dealDamage(
	state: EngineState,
	caster: CharacterState,
	ability: Ability,
	enemy: (typeof state.enemies)[number],
	base: number
): void {
	const dmg = calculateDamage(base, {
		source: caster,
		target: enemy,
		ability,
		element: caster.def.element,
		state
	});
	enemy.hp = Math.max(0, enemy.hp - dmg);
	publish('damage:dealt', {
		source: caster.id,
		target: enemy.id,
		amount: dmg,
		abilityName: ability.name,
		element: caster.def.element
	});
	if (enemy.hp <= 0) publish('enemy:defeated', { enemyId: enemy.id, killer: caster.id });
}
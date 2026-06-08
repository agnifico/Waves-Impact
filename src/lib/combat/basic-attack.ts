import type { EngineState, CharacterState } from '$lib/types/state';
import { chebyshev, samePos, step8Away, clamp } from './board';
import { resolveTiles } from './shapes';
import { calculateDamage } from './pipeline';
import { grantStack, consumeStack } from './stacks';
import { focusTarget } from './query';
import { publish } from './events';
import { coversStratum } from './spatial';
import { grantOffFieldShare } from './energy';

/**
 * Attempt a basic attack with the active character.
 * Dispatches to chain or contextual style based on character data.
 */
export function tryBasicAttack(state: EngineState, now: number): void {
	if (state.over) return;
	const char = state.party[state.activeSlot];
	if (char.stunnedUntil > now) return;


	const baCd = char.def.baCooldownMs;
	let cd: number;
	if (Array.isArray(baCd)) {
		const reset = now - char.lastBaTimestamp > char.def.baChainResetMs;
		const idx = reset ? 0 : char.baChainIndex;
		cd = baCd[idx] ?? baCd[0] ?? 0;
	} else {
		cd = baCd;
	}
	if (now - char.lastActionTimestamp < cd) return;

	if (char.def.basicStyle === 'contextual' && char.def.contextualBasic) {
		resolveContextual(state, char, now);
	} else if (char.def.basicStyle === 'chain' && char.def.basicChain) {
		resolveChain(state, char, now);
	}
}

// ─── Chain style (Frosty) ────────────────────────────────────────────────────

function resolveChain(state: EngineState, char: CharacterState, now: number): void {
	const chain = char.def.basicChain!;

	// Reset chain if too much time has passed
	if (now - char.lastBaTimestamp > char.def.baChainResetMs) {
		char.baChainIndex = 0;
	}

	const ba = chain[char.baChainIndex];
	const enemy = focusTarget(state, char.pos);

	if (ba.shape === 'pcone' || ba.shape === 'melee') {
		// Range check
		if (ba.omniTarget) {
			// Omni: check Chebyshev distance directly
			if (!enemy || !coversStratum(ba.hits, enemy.stratum) || chebyshev(char.pos, enemy.pos) > ba.range) {
				char.lastActionTimestamp = now;
				return;
			}
		} else if (ba.shape === 'melee') {
			if (!enemy || chebyshev(char.pos, enemy.pos) > ba.range) {
				char.lastActionTimestamp = now;
				return;
			}
			if (!coversStratum(ba.hits, enemy.stratum)) {
				// in range but wrong stratum (ground-only swing vs a flier) → whiff
				publish('basic:missed', { target: enemy.id, abilityName: ba.name });
				char.lastActionTimestamp = now;
				return;
			}
		} else {
			// Directional: check if enemy is in the shape tiles
			const tiles = resolveTiles(ba.shape, char.pos, char.facing, { range: ba.range }, state.board);
			if (!enemy || !coversStratum(ba.hits, enemy.stratum) || !tiles.some((t) => samePos(t, enemy.pos))) {
				char.lastActionTimestamp = now;
				return;
			}
		}

		// Finisher (BA3): spend a stack for bonus damage + a team heal
		const consumed = !!ba.consumesStack && char.stacks.current > 0;
		if (consumed) consumeStack(char, ba.consumesStack!, 1);

		const finalDmg = calculateDamage(ba.damage + (consumed ? (ba.consumeBonus ?? 0) : 0), {
			source: char,
			target: enemy,
			element: char.def.element,
			state
		});

		enemy.hp = Math.max(0, enemy.hp - finalDmg);

		publish('damage:dealt', {
			source: char.id,
			target: enemy.id,
			amount: finalDmg,
			abilityName: ba.name,
			element: char.def.element
		});

		if (consumed && ba.teamHeal) {
			for (const pc of state.party) {
				if (pc.hp <= 0) continue;
				const before = pc.hp;
				pc.hp = Math.min(pc.def.maxHp, pc.hp + ba.teamHeal);
				if (pc.hp > before) {
					publish('heal:applied', { target: pc.id, source: char.id, amount: pc.hp - before, abilityName: ba.name });
				}
			}
		}

		// Energy gain
		char.energy = Math.min(char.def.maxEnergy, char.energy + ba.energyGain);

		// Off-field energy
		grantOffFieldShare(state, ba.energyGain);

		// Stack
		if (ba.grantsStack) grantStack(state, char, ba.grantsStack, now);

		// Chain advance
		char.lastBaIndexLanded = char.baChainIndex;
		char.lastBaTimestamp = now;
		char.lastActionTimestamp = now;

		char.lastActionTimestamp = now;
		char.lastAction = {
			tag: char.baChainIndex === chain.length - 1 ? 'ba_chain_end' : 'ba',
			at: now
		};

		// Advance only if melee range (advanceOnlyIfMelee)
		if (ba.advanceOnlyIfMelee) {
			if (chebyshev(char.pos, enemy.pos) <= 1) {
				char.baChainIndex = (char.baChainIndex + 1) % chain.length;
			}
		} else {
			char.baChainIndex = (char.baChainIndex + 1) % chain.length;
		}

		if (enemy.hp <= 0) {
			publish('enemy:defeated', { enemyId: enemy.id, killer: char.id });
		}
	}
}

// ─── Contextual style (Yara) ─────────────────────────────────────────────────

function resolveContextual(state: EngineState, char: CharacterState, now: number): void {
	const ctx = char.def.contextualBasic!;
	const hasStack = char.stacks.current > 0;
	const ba = hasStack ? ctx.withStack : ctx.base;

	const enemy = focusTarget(state, char.pos);
	if (!enemy || !coversStratum(ba.hits, enemy.stratum) || chebyshev(char.pos, enemy.pos) > ba.range) {
		char.lastActionTimestamp = now;
		return;
	}

	const finalDmg = calculateDamage(ba.damage, {
		source: char,
		target: enemy,
		element: char.def.element,
		state
	});

	enemy.hp = Math.max(0, enemy.hp - finalDmg);

	publish('damage:dealt', {
		source: char.id,
		target: enemy.id,
		amount: finalDmg,
		abilityName: ba.name,
		element: char.def.element
	});

	char.energy = Math.min(char.def.maxEnergy, char.energy + ba.energyGain);
	grantOffFieldShare(state, ba.energyGain);
	char.lastActionTimestamp = now;

	char.lastActionTimestamp = now;
	char.lastAction = { tag: 'ba', at: now };

	// Consume stack + dash back (withStack variant)
	if (hasStack) {
		const ws = ctx.withStack;
		consumeStack(char, ws.consumesStack, 1);

		if (ws.dashBack) {
			let p = char.pos;
			for (let i = 0; i < ws.dashBack; i++) {
				const next = clamp(state.board, step8Away(p, enemy.pos));
				if (samePos(next, p)) break;
				p = next;
			}
			char.pos = p;
		}
	}

	if (enemy.hp <= 0) {
		publish('enemy:defeated', { enemyId: enemy.id, killer: char.id });
	}
}


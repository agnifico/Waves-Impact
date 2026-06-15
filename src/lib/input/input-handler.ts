import type { EngineState } from '$lib/types/state';
import type { AbilitySlot } from '$lib/types/ability';
import { intentFor } from './keybinds';
import {
	setDown,
	setUp,
	holdState,
	resetHoldState,
	setLockHoldStart,
	shouldUnlockOnRelease,
	clearLockHold,
	setLockedEnemy,
	getLockedEnemyId,
	wasdVec,
	gameNow,
	isPaused,
	togglePause
} from './intent-state';
import { tryBasicAttack } from '$lib/combat/basic-attack';
import { tryAbility } from '$lib/combat/ability-resolver';
import { trySwap } from '$lib/combat/swap';
import { nearestEnemy } from '$lib/combat/query';
import { chebyshev } from '$lib/combat/board';

/**
 * Bind keyboard and mouse event listeners.
 * Returns an unbind function for cleanup.
 *
 * `canAct` gates gameplay input: it returns false during the select screen and
 * while paused, so keys don't drive the engine then. The pause key itself
 * bypasses the gate (so you can always unpause). All timestamps come from
 * gameNow() so they stay consistent with the paused game clock.
 */
export function bindInputEvents(
	getState: () => EngineState | null,
	boardEl?: HTMLElement,
	canAct: () => boolean = () => true
): () => void {
	const BA_HOLD_MS = 200; // tap < 200ms → base; hold ≥ 200ms → enhanced (feel knob)
	let baHolding = false;
	let baHoldStart = 0;

	function baUsesHold(state: EngineState): boolean {
		const char = state.party[state.activeSlot];
		if (char?.def.basicStyle === 'contextual' && char.def.contextualBasic?.selectBy === 'hold') return true;
		if (char?.def.enhancedBasic?.requireHold) return true;
		return false;
	}
	function press(raw: string, isRepeat: boolean): void {
		const intent = intentFor(raw);
		const now = gameNow();
		const state = getState();
		if (!intent || !state) return;

		// Pause toggle — always available, even while paused.
		if (intent === 'pause') {
			if (!isRepeat) {
				togglePause();
				if (isPaused()) {
					resetHoldState(); // cancel any in-progress charge/aim
					baHolding = false;
				}
			}
			return;
		}

		if (!canAct()) return; // select screen or paused → ignore gameplay input

		// Lock-on: tap to lock/cycle
		if (intent === 'lockOn' && !isRepeat) {
			setLockHoldStart(now);
			cycleLock(state);
			setDown(intent);
			return;
		}

		setDown(intent);
		if (isRepeat) return;

		// Swap
		if (intent === 'swap1') trySwap(state, 0, now);
		if (intent === 'swap2') trySwap(state, 1, now);
		if (intent === 'swap3') trySwap(state, 2, now);
		if (intent === 'swap4') trySwap(state, 3, now);
		if (intent === 'swap5') trySwap(state, 4, now);
		if (intent === 'swap6') trySwap(state, 5, now);

		// Basic attack
		if (intent === 'basicAttack') {
			if (baUsesHold(state)) {
				baHolding = true;
				baHoldStart = now; // defer: decide tap vs hold on release
			} else {
				tryBasicAttack(state, now); // legacy: fire immediately
			}
		}

		// Abilities: V is tap-fire, X and C support hold
		if (intent === 'abilityV') tryAbility(state, 'V', now);
		if (intent === 'abilityX') beginHold(state, 'X', now);
		if (intent === 'abilityC') beginHold(state, 'C', now);
	}

	function release(raw: string): void {
		const intent = intentFor(raw);
		const now = gameNow();
		if (!intent) return;

		const state = getState();

		setUp(intent); // always clear the held-key set, even when gated
		if (!canAct()) return; // don't fire anything during select / pause

		if (intent === 'lockOn') {
			if (shouldUnlockOnRelease(now)) setLockedEnemy(null);
			clearLockHold();
			return;
		}

		// Basic attack (tap vs hold) — fire on release for hold-select characters
		if (intent === 'basicAttack' && baHolding) {
			baHolding = false;
			if (state) tryBasicAttack(state, now, now - baHoldStart >= BA_HOLD_MS);
			return;
		}

		// Release held ability
		if (
			(intent === 'abilityX' && holdState.holdingSlot === 'X') ||
			(intent === 'abilityC' && holdState.holdingSlot === 'C')
		) {
			if (!holdState.cancelNextRelease && state) {
				fireHeldAbility(state, holdState.holdingSlot as AbilitySlot, now);
			}
			resetHoldState();
		}
	}

	function cycleLock(state: EngineState): void {
		const origin = state.party[state.activeSlot].pos;
		const alive = state.enemies
			.filter((e) => e.hp > 0)
			.sort((a, b) => chebyshev(origin, a.pos) - chebyshev(origin, b.pos));

		let next: string | null;
		if (alive.length === 0) {
			next = null;
		} else {
			const current = getLockedEnemyId();
			next =
				current === null
					? alive[0].id
					: alive[(alive.findIndex((e) => e.id === current) + 1) % alive.length].id;
		}

		setLockedEnemy(next);
		state.focusTargetId = next; // keep engine focus + the Gem lock ring in sync
		if (holdState.holdingSlot && holdState.holdBehavior === 'track') {
			holdState.trackTargetId = next; // re-designate an in-flight charge (spec §4c)
		}
	}

	// ─── Hold mechanics ────────────────────────────────────────────────────

	function beginHold(state: EngineState, slot: AbilitySlot, now: number): void {
		const char = state.party[state.activeSlot];
		const ability = char.def.abilities[slot];
		if (!ability) return;

		holdState.holdingSlot = slot;
		holdState.holdBehavior = ability.holdBehavior ?? null;
		holdState.holdStartAt = now;
		holdState.reticle = null;
		holdState.reticleMovedThisHold = false;
		holdState.chargedRange = ability.shapeParams?.range ?? 0;
		holdState.abilityHoldIsSelf = false;
		holdState.cancelNextRelease = false;

		if (ability.holdBehavior === 'aim') {
			// Reticle starts on nearest enemy if in range, else self
			const enemy = nearestEnemy(state, char.pos, ability.shapeParams?.range);
			if (ability.autoTargetEnemy && enemy) {
				holdState.reticle = { ...enemy.pos };
			} else {
				holdState.reticle = { ...char.pos };
			}
		} else if (ability.holdBehavior === 'track') {
			const locked = getLockedEnemyId();
			const acq =
				locked && state.enemies.some((e) => e.id === locked && e.hp > 0)
					? state.enemies.find((e) => e.id === locked)!
					: nearestEnemy(state, char.pos, ability.shapeParams?.range);
			holdState.trackTargetId = acq ? acq.id : null;
			holdState.reticle = acq ? { ...acq.pos } : { ...char.pos };
		} else if (ability.holdBehavior === 'aim_dir') {
			// Seed a direction so an instant tap still dashes somewhere sane.
			holdState.aimDir = wasdVec() ?? { ...char.facing };
		}
	}

	function fireHeldAbility(state: EngineState, slot: AbilitySlot, now: number): void {
		const char = state.party[state.activeSlot];
		const ability = char.def.abilities[slot];
		if (!ability) return;

		if (holdState.holdBehavior === 'aim') {
			const held = now - holdState.holdStartAt;
			if (!holdState.reticleMovedThisHold && ability.allowSelfTarget && held > 250) {
				tryAbility(state, slot, now, { selfTarget: true });
			} else {
				tryAbility(state, slot, now, {
					reticle: holdState.reticle ? { ...holdState.reticle } : null
				});
			}
		} else if (holdState.holdBehavior === 'charge') {
			tryAbility(state, slot, now, { chargedRange: holdState.chargedRange });
		} else if (holdState.holdBehavior === 'track') {
			tryAbility(state, slot, now, {
				tier: holdState.tier,
				lockedTargetId: (holdState.trackTargetId ?? getLockedEnemyId()) ?? undefined
			});
		} else if (holdState.holdBehavior === 'aim_dir') {
			tryAbility(state, slot, now, { aimDir: holdState.aimDir ?? undefined });
		} else {
			tryAbility(state, slot, now);
		}
	}

	// ─── DOM event binding ─────────────────────────────────────────────────

	function onKeyDown(e: KeyboardEvent): void {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const raw = e.key.toLowerCase();
		if (intentFor(raw)) e.preventDefault();
		press(raw, e.repeat);
	}

	function onKeyUp(e: KeyboardEvent): void {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		release(e.key.toLowerCase());
	}

	function mouseBtnName(btn: number): string | null {
		if (btn === 0) return 'mouse0';
		if (btn === 1) return 'mouse1';
		if (btn === 2) return 'mouse2';
		return null;
	}

	function onMouseDown(e: MouseEvent): void {
		const name = mouseBtnName(e.button);
		if (!name) return;
		if (name === 'mouse1' || name === 'mouse2') e.preventDefault();
		press(name, false);
	}

	function onMouseUp(e: MouseEvent): void {
		const name = mouseBtnName(e.button);
		if (name) release(name);
	}

	function onContextMenu(e: Event): void {
		e.preventDefault();
	}

	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	window.addEventListener('mouseup', onMouseUp);

	if (boardEl) {
		boardEl.addEventListener('mousedown', onMouseDown);
		boardEl.addEventListener('contextmenu', onContextMenu);
	}

	// Return cleanup function
	return () => {
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		window.removeEventListener('mouseup', onMouseUp);
		if (boardEl) {
			boardEl.removeEventListener('mousedown', onMouseDown);
			boardEl.removeEventListener('contextmenu', onContextMenu);
		}
	};
}
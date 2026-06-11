import type { Position, Vector } from '$lib/types/common';

// ─── Held intents ────────────────────────────────────────────────────────────

const down = new Set<string>();

export function isDown(intent: string): boolean {
	return down.has(intent);
}

export function setDown(intent: string): void {
	down.add(intent);
}

export function setUp(intent: string): void {
	down.delete(intent);
}

export function clearAll(): void {
	down.clear();
}

// ─── WASD → direction vector ─────────────────────────────────────────────────

export function wasdVec(): Vector | null {
	let dx = 0;
	let dy = 0;
	if (isDown('moveUp')) dy -= 1;
	if (isDown('moveDown')) dy += 1;
	if (isDown('moveLeft')) dx -= 1;
	if (isDown('moveRight')) dx += 1;
	return dx || dy ? { x: dx, y: dy } : null;
}

/**
 * Movement direction: WASD unless manualLook (shift) is held,
 * or unless holding an aim ability (rooted while aiming).
 */
export function getMoveDir(): Vector | null {
	if (isDown('manualLook')) return null;
	if (holdState.holdingSlot && holdState.holdBehavior === 'aim') return null;
	return wasdVec();
}

// ─── Hold-ability state ──────────────────────────────────────────────────────

export const holdState = {
	holdingSlot: null as string | null,
	holdBehavior: null as string | null,
	holdStartAt: 0,
	reticle: null as Position | null,
	reticleMovedThisHold: false,
	chargedRange: 0,
	abilityHoldIsSelf: false,
	cancelNextRelease: false,
	trackTargetId: null as string | null,
	tier: 0,
	aimDir: null as Vector | null, // committed travel direction for 'aim_dir' (Sefyra C)
	fireNow: false
};

const RETICLE_STEP_MS = 110;
let lastReticleStepAt = 0;

/**
 * Per-tick: steer reticle (aim) or grow charge range (charge).
 * Called from the game loop each frame.
 */
export function updateHoldState(
	now: number, casterPos: Position, abilityRange: number, chargeMsPerTile?: number, chargeMaxRange?: number,
	trackPos?: Position | null): void {
	if (!holdState.holdingSlot) return;

	if (holdState.holdBehavior === 'aim') {
		const v = wasdVec();
		if (v && now - lastReticleStepAt >= RETICLE_STEP_MS && holdState.reticle) {
			lastReticleStepAt = now;
			holdState.reticleMovedThisHold = true;
			const want = {
				x: holdState.reticle.x + Math.sign(v.x),
				y: holdState.reticle.y + Math.sign(v.y)
			};
			// Chebyshev clamp to ability range from caster
			const dist = Math.max(Math.abs(want.x - casterPos.x), Math.abs(want.y - casterPos.y));
			if (dist <= abilityRange) {
				holdState.reticle = want;
			}
		}

		// Self-cast indicator
		const held = now - holdState.holdStartAt;
		holdState.abilityHoldIsSelf = !holdState.reticleMovedThisHold && held > 250;
	} else if (holdState.holdBehavior === 'charge' && chargeMsPerTile) {
		const extra = Math.floor((now - holdState.holdStartAt) / chargeMsPerTile);
		holdState.chargedRange = Math.min(chargeMaxRange ?? abilityRange, abilityRange + extra);
	} else if (holdState.holdBehavior === 'track') {
		// Fallback designator (spec §4c): charge by held time — even with no enemy on
		// field — and fire on release only. The reticle just marks the designated target.
		const held = now - holdState.holdStartAt;
		holdState.tier = held >= 1500 ? 2 : held >= 500 ? 1 : 0; // caps at tier 2
		if (trackPos) {
			holdState.reticle = { x: trackPos.x, y: trackPos.y }; // 2×2 box rides the target
		}
		// No auto-fire: not on range-exit, not at a time cap, not on target loss.
	} else if (holdState.holdBehavior === 'aim_dir') {
		// Sefyra C: aim a travel direction from WASD, decoupled from facing/lock.
		// Move-vs-root is handled in getMoveDir (manualLook/shift roots → sweep mode).
		const v = wasdVec();
		if (v) holdState.aimDir = commitAim(v, now);
	}
}

export function resetHoldState(): void {
	holdState.holdingSlot = null;
	holdState.holdBehavior = null;
	holdState.holdStartAt = 0;
	holdState.reticle = null;
	holdState.reticleMovedThisHold = false;
	holdState.chargedRange = 0;
	holdState.abilityHoldIsSelf = false;
	holdState.cancelNextRelease = false;
	holdState.trackTargetId = null;
	holdState.tier = 0;
	holdState.fireNow = false;
	holdState.aimDir = null;
}

// ─── Lock-on state ───────────────────────────────────────────────────────────

export let lockedEnemyId: string | null = null;
let lockHoldStart = 0;
const LOCK_HOLD_UNLOCK_MS = 300;

export function setLockedEnemy(id: string | null): void {
	lockedEnemyId = id;
}

export function getLockedEnemyId(): string | null {
	return lockedEnemyId;
}

export function setLockHoldStart(now: number): void {
	lockHoldStart = now;
}

export function shouldUnlockOnRelease(now: number): boolean {
	return lockHoldStart > 0 && now - lockHoldStart >= LOCK_HOLD_UNLOCK_MS;
}

export function clearLockHold(): void {
	lockHoldStart = 0;
}

export function resetLock(): void {
	lockedEnemyId = null;
	lockHoldStart = 0;
}

// ─── Diagonal hysteresis ─────────────────────────────────────────────────────

let lastAimVec: Vector = { x: 0, y: -1 };
let lastFullVecAt = 0;
const DIAG_GRACE_MS = 80;

/**
 * Commit an aim vector with diagonal hysteresis.
 * Prevents near-simultaneous two-key release from briefly flicking to cardinal.
 */
export function commitAim(v: Vector, now: number): Vector {
	const isDiag = v.x !== 0 && v.y !== 0;
	if (isDiag) {
		lastAimVec = v;
		lastFullVecAt = now;
		return v;
	}
	// Cardinal: hold diagonal briefly if we just were diagonal
	const wasDiag = lastAimVec.x !== 0 && lastAimVec.y !== 0;
	if (wasDiag && now - lastFullVecAt < DIAG_GRACE_MS) {
		return lastAimVec;
	}
	lastAimVec = v;
	return v;
}

// ─── Facing direction ────────────────────────────────────────────────────────

/**
 * Compute the facing direction for the active character this frame.
 * Priority: shift+WASD (manual aim) > Z/right-click (auto-look at enemy) > WASD (movement).
 * Returns null if no direction change this frame.
 */
export function computeFacing(
	casterPos: Position,
	targetPos: Position | null,
	now: number,
	locked: boolean = false
): Vector | null {
	// shift+WASD → manual aim (look without moving)
	if (isDown('manualLook')) {
		const v = wasdVec();
		if (v) return commitAim(v, now);
		return null;
	}
	// Z auto-look (held) OR F lock (persistent) → face the target every frame
	if (isDown('autoLook') || locked) {
		if (targetPos) {
			const dx = Math.sign(targetPos.x - casterPos.x);
			const dy = Math.sign(targetPos.y - casterPos.y);
			if (dx !== 0 || dy !== 0) return { x: dx, y: dy };
		}
		return null;
	}
	// otherwise WASD sets facing as you move
	const v = wasdVec();
	if (v) return commitAim(v, now);
	return null;
}

// ─── Game clock / pause ──────────────────────────────────────────────────────
// gameNow() = real elapsed time minus all time spent paused, so the game clock
// freezes while paused and resumes seamlessly (no cooldown/stun drift, no jump).
// Feed gameNow() — NOT performance.now() — into the loop and the input layer.

let _paused = false;
let _pauseStartedAt = 0;
let _pausedTotal = 0;

export function gameNow(): number {
	if (_paused) return _pauseStartedAt - _pausedTotal; // frozen at the pause instant
	return performance.now() - _pausedTotal;
}

export function isPaused(): boolean {
	return _paused;
}

export function setPaused(p: boolean): void {
	if (p === _paused) return;
	if (p) {
		_pauseStartedAt = performance.now();
		_paused = true;
	} else {
		_pausedTotal += performance.now() - _pauseStartedAt; // bank the elapsed pause
		_paused = false;
	}
}

export function togglePause(): void {
	setPaused(!_paused);
}

/** Fresh clock for a new fight: unpause and zero the accumulated pause offset. */
export function resetClock(): void {
	_paused = false;
	_pauseStartedAt = 0;
	_pausedTotal = 0;
}
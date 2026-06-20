/**
 * Canonical keybind scheme. Engine reads intents, never raw keys. (Data Contract §18)
 * Rebinding is a data change: edit this object.
 */
export const KEYBINDS: Record<string, string[]> = {
	moveUp: ['w', 'arrowup'],
	moveDown: ['s', 'arrowdown'],
	moveLeft: ['a', 'arrowleft'],
	moveRight: ['d', 'arrowright'],
	basicAttack: [' ', 'mouse0'],
	abilityX: ['x'],
	abilityC: ['c'],
	abilityV: ['v'],
	swap1: ['1'],
	swap2: ['2'],
	swap3: ['3'],
	swap4: ['4'],
	swap5: ['5'],
	swap6: ['6'],
	swap7: ['7'],
	lockOn: ['f', 'mouse2'],
	autoLook: ['mouse1'],
	manualLook: ['shift'],
	pause: ['p'],
	cameraLook: ['z'],
	zoomIn: ['='],
	zoomOut: ['-'],
	zoomReset: ['0'],
};

/** Reverse map: raw key/button → intent name. Built once at init. */
const KEY_TO_INTENT: Record<string, string> = {};

for (const intent in KEYBINDS) {
	for (const key of KEYBINDS[intent]) {
		KEY_TO_INTENT[key] = intent;
	}
}

/** Look up the intent for a raw key/button string. */
export function intentFor(raw: string): string | null {
	return KEY_TO_INTENT[raw] ?? null;
}
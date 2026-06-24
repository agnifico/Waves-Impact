import type { Effect } from '$lib/types/effect';

export const glacial_resonance: Effect = {
    id: 'glacial_resonance',
    durationMs: -1,
    stacking: 'refresh',
    onApply: [],
    onTick: [],
    onExpire: [],
    modifies: [
        { stat: 'damageBonus', value: 0.20, appliesTo: ['creation'], target: 'self' }
    ]
}

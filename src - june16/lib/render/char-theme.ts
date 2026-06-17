import type { Character } from '$lib/types/character';

export interface ResolvedTheme {
	primary: string;
	secondary: string;
	hp: string;
	energy: string;
	glow: Record<string, string>;
}

const ELEMENT_DEFAULTS: Record<string, { primary: string; secondary: string }> = {
	fire:    { primary: 'var(--fire)',    secondary: 'var(--fire-bright)' },
	water:   { primary: 'var(--water)',   secondary: 'var(--water-bright)' },
	wind:    { primary: 'var(--wind)',    secondary: 'var(--wind-bright)' },
	nature:  { primary: 'var(--nature)',  secondary: 'var(--nature-bright)' },
	light:   { primary: 'var(--light)',   secondary: 'var(--light-bright)' },
	dark:    { primary: 'var(--dark)',    secondary: 'var(--dark-bright)' },
	default: { primary: 'var(--gold)',    secondary: 'var(--gold-bright)' }
};

export function resolveTheme(def: Character): ResolvedTheme {
	const el = ELEMENT_DEFAULTS[def.element] ?? ELEMENT_DEFAULTS.default;
	const t = def.theme ?? {};
	const primary = t.primary ?? el.primary;
	return {
		primary,
		secondary: t.secondary ?? el.secondary,
		hp: t.hp ?? 'var(--hp)',
		energy: t.energy ?? 'var(--energy)',
		glow: { ready: primary, ...(t.glow ?? {}) }
	};
}

/** Flatten a resolved theme into a CSS-var string for a wrapper's `style`. */
export function themeVars(def: Character): string {
	const t = resolveTheme(def);
	const parts = [
		`--char-primary:${t.primary}`,
		`--char-secondary:${t.secondary}`,
		`--char-glow:${t.glow.ready}`,
		`--char-hp:${t.hp}`,
		`--char-energy:${t.energy}`
	];
	for (const [k, v] of Object.entries(t.glow)) parts.push(`--char-glow-${k}:${v}`);
	return parts.join(';');
}
<script lang="ts">
	import type { EngineState, CharacterState, EnemyState } from '$lib/types/state';

	let {
		state,
		now,
		side = 'ally'
	}: { state: EngineState; now: number; side?: 'ally' | 'enemy' } = $props();

	const ELEMENT_COLOR: Record<string, string> = {
		water: 'var(--frost)',
		wind: 'var(--verdant)',
		fire: 'var(--coral)',
		nature: '#a07050',
		light: 'var(--gold-bright)',
		dark: '#9a7bd0',
		normal: 'var(--gold)'
	};

	let ally = $derived(side === 'ally' ? state.party[state.activeSlot] : null);
	let foe = $derived.by(() => {
		if (side === 'ally') return null;
		const locked = state.focusTargetId
			? state.enemies.find((e) => e.id === state.focusTargetId && e.hp > 0)
			: null;
		return locked ?? state.enemies.find((e) => e.hp > 0) ?? null;
	});
	let unit = $derived((ally ?? foe) as CharacterState | EnemyState | null);

	let hpPct = $derived(unit ? Math.max(0, Math.min(100, (100 * unit.hp) / unit.def.maxHp)) : 0);
	let low = $derived(hpPct < 30);
	let enPct = $derived(
		ally ? Math.max(0, Math.min(100, (100 * ally.energy) / ally.def.maxEnergy)) : 0
	);
	let rim = $derived(unit ? (ELEMENT_COLOR[unit.def.element] ?? 'var(--gold)') : 'var(--gold)');
</script>

<div class="unit-banner">
	{#if unit}
		<div class="unit-banner" class:enemy={!ally} style={ally ? '' : `--char-primary:${rim}`}>
			<div
				class="portrait"
				// style="background-color: var(--char-primary, var(--gold)); {ally?.def.art?.gem
				// 	? `background-image: url(${ally.def.art.gem})`
				// 	: ''}"
				style="background-color: var(--char-primary, var(--gold)); {ally
					? `background-image: url(${ally?.def?.art?.gem})`
					: `background-image: url(${unit?.def?.profileImage})`}"
			></div>

			<div class="banner-body">
				<div class="nameplate"><span class="name">{unit.def.name}</span></div>

				<div class="vitals">
					<div class="bar-set">
						<div class="bar-track hp">
							<div class="bar-fill" class:low style="width:{hpPct}%"></div>
						</div>
						<span>{unit.hp}</span>
					</div>
					{#if ally}
						<div class="bar-set">
							<!-- <span>
								{ally.energy}
							</span> -->
							<div class="bar-track">
								<div class="bar-fill energy" style="width:{enPct}%"></div>
							</div>
						</div>
					{/if}
				</div>

				{#if ally}
					<div class="resource">
						<div class="pips">
							{#each { length: ally.def.stackMax } as _, i}
								<span class="pip" class:filled={i < ally.stacks.current}></span>
							{/each}
						</div>
						{#if 'unchained' in ally.activeEffects}<span class="buff buff--unchained"
								>UNCHAINED</span
							>{/if}
						{#if 'bloomstride' in ally.activeEffects}
							{@const bs = ally.activeEffects['bloomstride']}
							{@const rem = bs.expiresAt > 0 ? Math.ceil((bs.expiresAt - now) / 1000) : '∞'}
							<span class="buff buff--bloomstride">BLOOMSTRIDE {rem}s</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Fixed-footprint character banner. Layered front-to-back:
	   portrait (z3) over nameplate (z2) over vitals (z1) over resource strip (z0). */
	.unit-banner {
		position: relative;
		width: 250px;
		height: 100px;
		display: flex;
		gap: 0.5rem;
		top: 8px;
		/* padding: 10px; */
		left: 20px;
	}

	/* z3 — portrait disc, overlaps the left edge (nudge top/left to taste) */
	.portrait {
		position: absolute;
		top: -5px;
		left: -40px;
		z-index: 3;
		width: 80px;
		height: 80px;
		border-radius: 50%;
		border: 2px solid var(--char-primary, var(--gold));
		background-color: var(--char-primary, var(--gold));
		background-size: cover;
		background-position: center;
		box-shadow:
			inset 0 2px 0 rgba(255, 255, 255, 0.35),
			inset 0 -3px 0 rgba(0, 0, 0, 0.3),
			0 2px 6px rgba(0, 0, 0, 0.4);
	}

	.banner-body {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	/* z2 — nameplate */
	.nameplate {
		position: relative;
		/* z-index: 2; */
		/* top: -5px; */
		width: fit-content;
		padding: 4px 20px 8px 40px;
		background: rgb(91, 91, 91);
		clip-path: polygon(0 0, 90% 0, 100% 100%, 0 100%);
		background-color: color-mix(in srgb, black 80%, var(--char-secondary));
	}
	.name {
		font-family: 'DePixel', 'JetBrains Mono', monospace;
		font-size: 14px;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--char-primary, var(--gold));
	}

	/* z1 — vitals */
	.vitals {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		/* left: -10px; */
		top: -8px;
		padding: 8px 8px 8px 50px;
		background: rgb(49, 49, 49);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 3px 0 rgba(0, 0, 0, 0.3),
			0 5px 12px rgba(0, 0, 0, 0.35);
	}
	.bar-set {
		display: flex;
		gap: 4px;
		justify-content: stretch;
		align-items: flex-end;
	}
	.bar-track {
		flex: 1;
		display: unset;
		height: 8px;
		background: var(--bg);
		border-radius: 2px;
		overflow: hidden;
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.45);
	}
	.bar-track.hp {
		height: 15px;
	}
	.bar-fill {
		height: 100%;
		background: var(--char-hp, var(--hp));
		transition: width 0.2s;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
	}
	.bar-fill.energy {
		background: var(--char-energy, var(--energy));
	}
	.bar-fill.low {
		background: var(--hp-low);
	}

	/* z0 — resource strip */
	.resource {
		position: relative;
		top: -8px;
		left: 0px;
		z-index: 0;
		/* width: fit	-content; */
		width: 100%;
		display: flex;
		gap: 6px;
		padding: 4px 30px 8px 25px;
		clip-path: polygon(0 0, 100% 0, 90% 100%, 20px 100%);
		background: linear-gradient(-15deg, var(--bg) 0%, var(--bg) 40%, var(--char-secondary) 100%);
		/* background: linear-gradient(0deg,transparent 0%, color-mix(in srgb, black 20%, var(--char-secondary)) 50%, transparent 100%); */
	}
	.pips {
		display: flex;
		gap: 6px;
		margin-top: 0.25rem;
	}
	.pip {
		width: 10px;
		height: 10px;
		transform: rotate(45deg);
		border: 1px solid var(--char-primary, var(--gold));
		border-radius: 25%;
		background: transparent;
		transition: all 0.2s;
	}
	.pip.filled {
		background: var(--char-primary, var(--gold));
		box-shadow: 0 0 6px var(--char-glow, var(--gold));
	}

	.buff {
		align-self: flex-start;
		padding: 2px 7px;
		font-size: 9px;
		letter-spacing: 1px;
		border-radius: 3px;
		color: var(--bg);
		animation: pulse 1.2s infinite;
		text-wrap: nowrap;
	}
	.buff--unchained {
		background: var(--unchained);
	}
	.buff--bloomstride {
		background: var(--bloomstride);
	}

	.unit-banner.enemy .bar-fill {
		background: var(--coral, #e97973);
	}
	.unit-banner.enemy {
		transform: rotateY(180deg);
		left: -60px;
	}
	.unit-banner.enemy .portrait {
		transform: rotateY(180deg);
		background-size: 100%;
		background-position: center top;
		border-color: var(--coral);
	}
	.unit-banner.enemy .nameplate {
		transform: rotateY(180deg);
		padding: 4px 40px 8px 20px;
		clip-path: polygon(10% 0, 100% 0, 100% 100%, 0 100%);
		.name {
			color: white;
		}
	}
	.unit-banner.enemy .vitals {
		box-shadow:
			0 3px 0 rgba(0, 0, 0, 0.3),
			0 5px 12px rgba(0, 0, 0, 0.35);
		/* left: -12px; */
	}
</style>

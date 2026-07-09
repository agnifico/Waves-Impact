<script lang="ts">
	let {
		current = 0,
		max = 100,
		type = 'hp',
		label = undefined,
		hpStyle = ''
	}: {
		current?: number;
		max?: number;
		type?: 'hp' | 'energy' | 'enemy';
		label?: string;
		hpStyle?: string;
	} = $props();

	let pct = $derived(max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0);
	let low = $derived(pct < 30);
	// HP / EN (was HP / AS). Enemy reuses the HP label.
	let displayLabel = $derived(label ?? (type === 'energy' ? 'EN' : 'HP'));
</script>

<div class="hp-bar-row" class:thin={type === 'energy'}>
	<span class="bar-label" class:energy={type === 'energy'} class:enemy={type === 'enemy'}>
		{displayLabel}
	</span>
	<div class="bar-track" class:thin={type === 'energy'}>
		<div class="bar-fill {type}" class:low class:cryo={hpStyle === 'cryo'} class:solar={hpStyle === 'solar'} style="width: {pct}%"></div>
		<span class="bar-text">{Math.max(0, Math.round(current))}/{Math.round(max)}</span>
	</div>
</div>

<style>
	.hp-bar-row {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 5px;
	}

	.bar-label {
		font-size: 0.55rem;
		color: #8ab09a;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		flex-shrink: 0;
		width: fit-content;
		background-color: #000000cc;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-family-pixel);
	}
	/* thinner label box for the energy row so it lines up with the slim track */
	.hp-bar-row.thin .bar-label {
		padding: 2px 4px;
		font-size: 0.5rem;
	}

	.bar-label.energy {
		color: #5bcbf5;
	}
	.bar-label.enemy {
		color: #ff9696;
	}

	.bar-track {
		position: relative;
		flex: 1;
		height: 18px; /* thick HP */
		background-color: var(--panel-2);
		border-radius: 6px;
		border: 2px solid #000000;
		box-shadow: #00000056 0 -2px 0 0 inset;
		overflow: hidden;
		min-width: 60px;
	}
	/* thin energy track */
	.bar-track.thin {
		height: 11px;
		border-width: 1.5px;
		border-radius: 5px;
	}

	.bar-fill {
		position: absolute;
		inset: 0;
		height: 100%;
		border-radius: 4px;
		transition: width 0.35s ease-in-out;
	}

	.bar-fill.hp {
		background: var(--char-hp, var(--hp));
		box-shadow:
			#00000056 0 -2px 0 0 inset,
			hsla(0, 0%, 0%, 0.2) -2px 0 2px 0 inset,
			hsla(0, 0%, 0%, 0.4) 2px 0 3px 0;
	}

	.bar-fill.energy {
		background: var(--char-energy, var(--energy));
		box-shadow:
			#00000056 0 -2px 0 0 inset,
			hsla(0, 0%, 0%, 0.2) -2px 0 2px 0 inset;
	}

	.bar-fill.enemy {
		background-image: linear-gradient(to bottom, #f07070, #e05252);
		box-shadow:
			#00000056 0 -2px 0 0 inset,
			hsla(0, 0%, 0%, 0.2) -2px 0 2px 0 inset,
			hsla(0, 0%, 0%, 0.4) 2px 0 3px 0;
	}

	.bar-fill.low {
		background: var(--hp-low);
	}

	.bar-text {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.6rem;
		color: #ffffff;
		text-shadow:
			0 1px 2px #000,
			1px 0 2px #000;
		pointer-events: none;
		letter-spacing: 0.02em;
		font-family: var(--font-family-pixel);
	}
	.bar-track.thin .bar-text {
		font-size: 0.5rem;
	}

	/* ── Cryo Core (Frosty) — crystal facet texture + shimmer sweep ──── */
	.bar-fill.cryo {
		background:
			repeating-linear-gradient(118deg, rgba(255, 255, 255, 0.18) 0 2px, transparent 2px 15px),
			var(--char-hp, var(--hp));
	}
	.bar-fill.cryo::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(100deg, transparent 34%, rgba(255, 255, 255, 0.6) 50%, transparent 66%);
		animation: barShimmer 3.8s ease-in-out infinite;
		pointer-events: none;
	}

	/* ── Solar Bloom (June 9) — dappled light spots + shimmer sweep ─── */
	.bar-fill.solar {
		background:
			radial-gradient(circle at 18% 32%, rgba(255, 255, 255, 0.3), transparent 22%),
			radial-gradient(circle at 62% 64%, rgba(255, 255, 255, 0.22), transparent 20%),
			radial-gradient(circle at 88% 40%, rgba(255, 255, 255, 0.18), transparent 18%),
			var(--char-hp, var(--hp));
	}
	.bar-fill.solar::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(100deg, transparent 34%, rgba(255, 255, 255, 0.5) 50%, transparent 66%);
		animation: barShimmer 4.4s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes barShimmer {
		0%   { transform: translateX(-130%) skewX(-18deg); }
		100% { transform: translateX(360%)  skewX(-18deg); }
	}
</style>
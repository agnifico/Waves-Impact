<script lang="ts">
	let {
		current = 0,
		max = 100,
		type = 'hp',
		label = undefined,
		selectedCharacter = undefined,
	}: {
		current: number;
		max: number;
		type?: 'hp' | 'energy' | 'enemy';
		label?: string | undefined;
	} = $props();

	let pct = $derived(max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0);
	let low = $derived(pct < 30);
	let textColorFlip = $derived(pct < 0);
	let displayLabel = $derived(label ?? (type === 'hp' ? 'HP' : type === 'energy' ? 'AS' : 'HP'));
</script>

<div class="hp-bar-row" class:textFlip={type === 'enemy'}>
	<span class="bar-label" class:energy={type === 'energy'} class:enemy={type === 'enemy'}>
		{displayLabel}
	</span>
	<div class="bar-track">
		<div
			class="bar-fill {type}"
			class:low
			style="width: {pct}%"
		></div>
		<span class="bar-text" class:textColorFlip
			>{Math.max(0, Math.round(current))}/{Math.round(max)}</span
		>
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

	.bar-label.energy {
		color: #5bcbf5;
	}
	.bar-label.enemy {
		color: #ff9696;
	}

	.bar-track {
		position: relative;
		flex: 1;
		height: 18px;
		background-color: var(--panel-2);
		border-radius: 6px;
		border: 2px solid #000000;
		box-shadow: #00000056 0 -2px 0 0 inset;
		overflow: hidden;
		min-width: 60px;
	}

	.bar-fill {
		position: absolute;
		inset: 0;
		height: 100%;
		border-radius: 4px;
		transition: width 0.35s ease-in-out;
	}

	.bar-fill.hp {
		background: linear-gradient(
			225deg,
			#166383 0%,
			#237f7e 20%,
			#399e80 40%,
			#55bc88 60%,
			#74d496 80%,
			#94e3a8 100%
		);
		background: var(--char-hp, var(--hp));
		box-shadow:
			#00000056 0 -2px 0 0 inset,
			hsla(0, 0%, 0%, 0.2) -2px 0 2px 0 inset,
			hsla(0, 0%, 0%, 0.4) 2px 0 3px 0;
	}

	.bar-fill.energy {
		background: linear-gradient(90deg, #399dcd 0%, #2b7eb8 25%, #226098 50%, #214973 75%, #273d51);
		box-shadow:
			#00000056 0 -2px 0 0 inset,
			hsla(0, 0%, 0%, 0.2) -2px 0 2px 0 inset,
			hsla(0, 0%, 0%, 0.4) 2px 0 3px 0;
		background: var(--char-energy, var(--energy));
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
			0 0 4px #000;
		text-shadow:
			0 1px 2px #000,
			1px 0 2px #000;
		pointer-events: none;
		letter-spacing: 0.02em;
		font-family: var(--font-family-pixel);
	}
	.textFlip {
		transform: rotateY(180deg);
	}

	.textColorFlip {
		color: #000000;
		text-shadow:
			0 1px 2px #6d6d6d,
			0 0 4px #6d6d6d;
		text-shadow:
			0 1px 2px #000,
			1px 0 2px #6d6d6d;
	}
</style>

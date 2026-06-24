<script lang="ts">
	import type { EngineState, EnemyState } from '$lib/types/state';

	let {
		state,
		now,
		segments = 4
	}: {
		state: EngineState;
		now: number;
		/** chunk count for the boss bar */
		segments?: number;
	} = $props();

	const clamp = (v: number) => Math.max(0, Math.min(100, v));

	const ELEMENT_COLOR: Record<string, string> = {
		water: '#0096c7',
		wind: '#83c5be',
		fire: '#d00000',
		nature: '#588157',
		light: 'var(--gold-bright)',
		dark: '#9a7bd0',
		normal: 'var(--gold)'
	};

	let foe = $derived.by(() => {
		const locked = state.focusTargetId
			? state.enemies.find((e) => e.id === state.focusTargetId && e.hp > 0)
			: null;
		return (locked ?? state.enemies.find((e) => e.hp > 0) ?? null) as EnemyState | null;
	});

	let accent = $derived(foe ? (ELEMENT_COLOR[foe.def.element] ?? 'var(--coral)') : 'var(--coral)');
	let element = $derived(foe?.def.element ?? 'normal');
	let extraTags = $derived(((foe?.def as any)?.tags as string[] | undefined) ?? []);
	let isBoss = $derived(!!(foe?.def as any)?.isBoss);

	let hpPct = $derived(foe ? clamp((100 * foe.hp) / foe.def.maxHp) : 0);
	let segPct = $derived(100 / Math.max(1, segments));
	// per-chunk fill: chunk i drains only once chunks above it are empty
	let chunks = $derived(
		Array.from({ length: segments }, (_, i) => clamp(((hpPct - i * segPct) / segPct) * 100))
	);
	let hpText = $derived(
		foe ? `${Math.round(foe.hp).toLocaleString()} / ${foe.def.maxHp.toLocaleString()}` : ''
	);
</script>

{#if foe}
	<!-- Unbounded, right-aligned. Portrait sits BEHIND the content via grid stacking + z-index
	     (no absolute positioning); the bar therefore extends across the image, and the image's
	     base is darkened by a vignette so the HP readout over it stays legible. -->
	<div class="enemy-banner" style="--accent:{accent}">
		<div class="content">
			<div class="eyebrow">{isBoss ? 'BOSS' : 'ENEMY'}</div>

			<div class="name-row">
				<span class="name">{foe.def.name}</span>
				<span class="name-rule"></span>
			</div>

			<!-- red 4-chunk boss bar — extends into the image -->
			<div class="seg-bar">
				{#each chunks as w}
					<div class="seg"><div class="seg-fill" style="width:{w}%"></div></div>
				{/each}
			</div>

			<!-- element tags (left) · HP label + number (right), sitting over the vignette -->
			<div class="foot">
				<div class="tags">
					<span class="tag" style="--tint:{accent}">{element}</span>
					{#each extraTags as t}<span class="tag tag--secondary">{t}</span>{/each}
				</div>
				<div class="readout">
					<span class="hp-label">HP</span>
					<span class="hp-num">{hpText}</span>
				</div>
			</div>
		</div>

		{#if foe.def.profileImage}
			<!-- bare PNG, no frame/bg; bottom vignette baked in as the top background layer -->
			<div class="enemy-portrait" style="--portrait:url('{foe.def.profileImage}')"></div>
		{/if}
	</div>
{/if}

<style>
	/* grid with a single shared cell — children stack and overlap by z-index, not absolute pos */
	.enemy-banner {
		width: min(440px, 100%);
		margin-left: auto;
		display: flex;
		/* flex-direction: row-reverse; */
		grid-template-columns: 1fr;
		isolation: isolate;
		padding: 6px 11px 20px 11px;
		position: relative;
		/* left: -60px; */
		box-sizing: border-box;
		border-radius: 9px;
		background:
			linear-gradient(135deg, var(--accent), transparent 42%),
			linear-gradient(
				315deg,
				color-mix(in srgb, var(--accent) 50%, transparent),
				rgba(0, 0, 0, 0.626) 50%
			);
		/* backdrop-filter: blur(10px); */
		/* -webkit-backdrop-filter: blur(10px); */

		box-shadow:
			0px -6px 0 3px rgba(0, 0, 0, 0.5) inset,
			0px 3px 0 0px rgba(0, 0, 0, 0.5) inset;
		background-color: #2d2d2d;
	}

	.content {
		grid-area: 1 / 1;
		z-index: 1; /* above the portrait */
		align-self: end; /* anchor stats to the image's base */
		display: flex;
		flex-direction: column;
		gap: 5px; /* tight */
		/* padding-right: 6px; */
		flex: 1;
	}

	.enemy-portrait {
		grid-area: 1 / 1;
		z-index: 0; /* behind the content/bar */
		justify-self: end;
		align-self: end;
		width: 80px;
		height: 80px;
		padding-bottom: 2rem;
		margin-left: -0rem;
		margin-bottom: -0.5rem;
		pointer-events: none;
		/* vignette layer over the portrait darkens its base; PNG underneath */
		background:
			/* linear-gradient(-165deg, transparent 50%, rgba(6, 4, 4, 0.55) 70%, rgba(4, 3, 3, 0.95) 100%), */ var(
				--portrait
			)
			center bottom / contain no-repeat;
		filter: drop-shadow(0 5px 9px rgba(0, 0, 0, 0.5));
	}

	.eyebrow {
		font-family: var(--font-family-pixel);
		font-size: 9px;
		letter-spacing: 2px;
		color: rgba(255, 255, 255, 0.6);
		font-family: 'Pixelify Sans';
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.name {
		font-family: 'Depixel';
		/* font-weight: 600; */
		font-size: 17px;
		letter-spacing: 2px;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--accent) 70%, #ffffff);
		text-shadow: 0 0 12px color-mix(in srgb, var(--accent) 55%, transparent);
		white-space: nowrap;
	}
	/* dash only on the right of the name */
	.name-rule {
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, var(--accent), transparent);
	}

	.seg-bar {
		display: flex;
		gap: 4px;
	}
	.seg {
		position: relative;
		flex: 1;
		height: 15px;
		background: #160a0a;
		border-radius: 2px;
		overflow: hidden;
		box-shadow: inset 0 0 0 1px rgba(255, 120, 110, 0.25);
	}
	.seg-fill {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, #f78b82, #cf483f 60%, #b3342d);
		box-shadow:
			0 0 10px rgba(223, 82, 74, 0.6),
			inset 0 2px 0 rgba(255, 255, 255, 0.2);
		transition: width 0.2s linear;
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.tags {
		display: flex;
		gap: 5px;
	}
	.tag {
		font-family: var(--font-family-pixel);
		font-size: 8px;
		letter-spacing: 1px;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 4px;
		white-space: nowrap;
		color: color-mix(in srgb, var(--tint, var(--gold)) 60%, white);
		background: color-mix(in srgb, var(--tint, var(--gold)) 18%, transparent);
		background: transparent;
		border: 1px solid color-mix(in srgb, var(--tint, var(--gold)) 45%, transparent);
	}
	.tag--secondary {
		--tint: #60a0ff;
	}
	.readout {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.hp-label {
		font-family: 'DePixel';
		font-size: 8px;
		letter-spacing: 0.5px;
		background: #000000cc;
		color: #ff9696;
		padding: 2px 5px;
		border-radius: 4px;
	}
	.hp-num {
		font-size: 10px;
		color: #fff;
		font-family: 'DePixel';
		font-feature-settings: 'tnum';
		text-shadow: 0 1px 2px #000;
		white-space: nowrap;
	}
</style>

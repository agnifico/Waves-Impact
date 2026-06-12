<script lang="ts">
	import type { CharacterState, EnemyState, SummonState, ConstructState } from '$lib/types/state';

	type GemType = 'player' | 'enemy' | 'summon' | 'construct';
	let {
		type,
		character = null,
		enemy = null,
		summon = null,
		construct = null,
		locked = false,
		now = 0
	}: {
		type: GemType;
		character?: CharacterState | null;
		enemy?: EnemyState | null;
		summon?: SummonState | null;
		construct?: ConstructState | null;
		locked?: boolean;
		now?: number;
	} = $props();

	const ELEMENT_COLOR: Record<string, string> = {
		water: 'var(--frost)',
		wind: 'var(--verdant)',
		fire: 'var(--coral)',
		nature: '#a07050',
		light: 'var(--gold-bright)',
		dark: '#9a7bd0',
		normal: 'var(--gold)'
	};
	const rimOf = (el: string) => ELEMENT_COLOR[el] ?? 'var(--gold)';
	const facingDeg = (f: { x: number; y: number }) => (Math.atan2(f.x, -f.y) * 180) / Math.PI;

	let hit = $state(false);
	export function flash() {
		hit = true;
		setTimeout(() => (hit = false), 300);
	}

</script>

{#if type === 'player' && character}
	{@const rim = rimOf(character.def.element)}
	{@const img = character.def.art?.gem}
	{@const lift = character.stratum === 'flying' ? -10 : 0}
	<div class="gem-root" class:hit>
		<div class="shadow" class:swimming={character?.stratum === 'swimming'} ></div>
		<div
			class="body"
			style="border-color:{rim}; transform:translateY({lift}px); {img
				? `background-image:url(${img});`
				: `background-color:${rim};`}"
		>
			{#if !img}<span class="glyph">◆</span>{/if}
		</div>
		<div class="facing" style="transform:translateY({lift}px) rotate({facingDeg(character.facing)}deg);">
			<svg viewBox="-18 -18 36 36"
				><path
					d="M0 -28 L8 -16 L0 -19 L-8 -16 Z"
					fill="var(--char-primary)"
					stroke="var(--char-primary)"
					stroke-width="0.75"
					stroke-linejoin="round"
				/></svg
			>
		</div>
	</div>
{:else if type === 'enemy' && enemy}
	{@const rim = rimOf(enemy.def.element)}
	{@const hpPct = Math.max(0, (100 * enemy.hp) / enemy.def.maxHp)}
	{@const lift = enemy.stratum === 'flying' ? -5 : 0}
	<div class="gem-root" class:hit class:locked class:stunned={enemy.stunnedUntil > now}>
		<div class="shadow"></div>
		<div
			class="body"
			style="border-color:#ffffff56; border-style:dashed; transform:translateY({lift}px); background-color:var(--bg);"
			// style="border-color:{rim}; transform:translateY({lift}px); background-color:var(--bg);"
			// style="background-image: url({enemy?.def?.profileImage})"
		>
			<!-- <span class="glyph">◆</span> -->
		</div>
		{#if locked}
			<!-- <div class="facing" style="transform:rotate({facingDeg(enemy.facing)}deg)">
				<svg viewBox="-18 -18 36 36"><path d="M0 -28 L8 -16 L0 -19 L-8 -16 Z" fill="var(--coral)" stroke="var(--gold-bright)" stroke-width="0.75" stroke-linejoin="round"/></svg>
			</div> -->
			<div class="nameplate">
				<div class="np-bar"><i style="width:{hpPct}%; background:{rim};"></i></div>
				<!-- <span class="np-label">{enemy.def.name} {enemy.hp}</span> -->
			</div>
		{:else}
		{/if}
	</div>
{:else if type === 'summon' && summon}
	{@const img = summon.profileImage}
	<!-- Mobile summon (wolf, etc): circular gem -->
	<div class="gem-root">
		<div class="shadow"></div>
		<div
			class="body summon"
			style="border-color:var(--wolf); {img
				? `background-image:url(${img});`
				: `background-color:var(--wolf);`}"
		>
			{#if !img}<span class="glyph">♦</span>{/if}
		</div>
		<div class="nameplate"><span class="np-label">Leo</span></div>
	</div>
{:else if type === 'construct' && construct}
	{@const img = construct.profileImage}
	<!-- Construct: square board-game-piece silhouette with tall drop shadow -->
	<div class="gem-root construct-root">
		<div class="construct-shadow"></div>
		<div
			class="construct-body"
			style="{img ? `background-image:url(${img});` : ''}"
		>
			{#if !img}<span class="construct-glyph">◼</span>{/if}
		</div>
	</div>
{/if}

<style>
	.gem-root {
		position: absolute;
		inset: 0;
		z-index: 6;
		pointer-events: none;
	}
	.gem-root.hit {
		animation: hit-shake 0.3s;
	}
	.gem-root.stunned .body {
		animation: stunned-pulse 0.6s infinite;
	}

	.shadow {
		position: absolute;
		left: 50%;
		bottom: 0px;
		transform: translateX(-50%);
		width: 22px;
		height: 6px;
		border-radius: 50%;
		background: rgba(0, 0, 0, .9);
		&.swimming {
			background: rgba(255, 255, 255, 0.9);
			
		}
	}
	.shadow.swimming {
		position: absolute;
		left: 50%;
		top: 0px;
		transform: translateX(-50%) translateY(-32px);
		z-index: 99;
		width: 22px;
		height: 6px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.9);
	}
	.body {
		position: absolute;
		top: 40%;
		left: 40%;
		width: 32px;
		height: 32px;
		margin: -13px 0 0 -13px;
		border: 2px solid var(--gold);
		border-radius: 99px;
		background-size: 150%;
		background-position: center;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.12s;
	}
	.gem-root.locked .body {
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.45),
			0 0 0 3px var(--coral),
			0 0 12px rgba(240, 113, 103, 0.55);
	}
	.glyph {
		font-size: 14px;
		font-weight: bold;
		color: var(--bg);
	}

	.facing {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 7;
		transform-origin: center;
	}
	.facing svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.nameplate {
		position: absolute;
		top: -7px;
		left: 50%;
		transform: translateX(-50%);
		width: 40px;
		z-index: 8;
	}
	.np-bar {
		height: 4px;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: 1px;
		overflow: hidden;
	}
	.np-bar i {
		display: block;
		height: 100%;
		transition: width 0.2s;
	}
	.np-label {
		display: block;
		text-align: center;
		font-size: 9px;
		color: var(--text-dim);
		white-space: nowrap;
		margin-top: 1px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
	}

	/* ── Construct (anchored summon) ── board-game-piece look ──────────── */
	.construct-root {
		z-index: 5; /* sits below player gems */
	}

	/*
	 * Tall hard drop-shadow: simulates the piece casting a shadow on the
	 * board as if it has physical height. Two layers:
	 *   1. A wide flat ellipse at the base (ground contact)
	 *   2. A sharper rectangle offset downward (the "wall" face shadow)
	 */
	.construct-shadow {
		position: absolute;
		left: 50%;
		bottom: 2px;
		transform: translateX(-50%);
		/* Base footprint — same width as the piece */
		width: 26px;
		height: 10px;
		background: rgba(0, 0, 0, 0.55);
		/* Perspective skew: wider at bottom edge, compressed vertically */
		border-radius: 0 0 4px 4px;
		/* The "height" shadow: a sharp rectangular shadow offset downward */
		box-shadow:
			0 6px 0 0  rgba(0, 0, 0, 0.38),
			0 10px 0 0 rgba(0, 0, 0, 0.18),
			0 14px 0 0 rgba(0, 0, 0, 0.07);
	}

	/*
	 * The piece body: square, elevated off the tile, sharp corners.
	 * Positioned slightly above center to reinforce the "raised" read.
	 * A 1px inset border adds the top-face highlight of a block.
	 */
	.construct-body {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 26px;
		height: 26px;
		/* Lift the piece above its shadow */
		transform: translate(-50%, -62%);
		border-radius: 3px;
		/* Frost-tinted face with a crisp top-light border */
		background-color: #0d2a3a;
		background-size: cover;
		background-position: center;
		border: 1.5px solid var(--frost, #48cae4);
		/* Sharp outer drop shadow — the piece's own silhouette */
		box-shadow:
			0 4px 0 0   rgba(0, 0, 0, 0.7),
			0 8px 0 0   rgba(0, 0, 0, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		/* Gentle frost pulse — tells the player it's active/ticking */
		animation: construct-idle 2s ease-in-out infinite;
	}

	.construct-glyph {
		font-size: 11px;
		color: var(--frost, #48cae4);
		opacity: 0.9;
		text-shadow: 0 0 6px var(--frost, #48cae4);
	}

	@keyframes construct-idle {
		0%, 100% { box-shadow: 0 4px 0 0 rgba(0,0,0,0.7), 0 8px 0 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0px rgba(72,202,228,0); }
		50%       { box-shadow: 0 4px 0 0 rgba(0,0,0,0.7), 0 8px 0 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 8px rgba(72,202,228,0.45); }
	}
</style>
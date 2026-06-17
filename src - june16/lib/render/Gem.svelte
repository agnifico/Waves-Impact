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

	let hasShield = $derived(type === 'player' && !!character?.activeEffects?.['shield']);

	const ELEMENT_COLOR: Record<string, string> = {
		water: 'var(--frost)',
		wind: 'var(--wind)',
		fire: 'var(--coral)',
		nature: 'var(--verdant)',
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
		<div class="shadow" class:swimming={character.stratum === 'swimming'}></div>
		<div
			class="body square"
			style="border-color:{rim}; transform:translateY({lift}px); {img
				? `background-image:url(${img});`
				: `background-color:${rim};`}"
		>
			{#if !img}<span class="glyph">◆</span>{/if}
		</div>
		<div
			class="facing"
			style="transform:translateY({lift}px) rotate({facingDeg(character.facing)}deg);"
		>
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
		{#if hasShield}
			<div class="shield-ring" style="transform:translateY({lift}px)"></div>
		{/if}
	</div>
{:else if type === 'enemy' && enemy}
	{@const rim = rimOf(enemy.def.element)}
	{@const hpPct = Math.max(0, (100 * enemy.hp) / enemy.def.maxHp)}
	{@const lift = enemy.stratum === 'flying' ? -5 : 0}
	<div class="gem-root" class:hit class:locked class:stunned={enemy.stunnedUntil > now}>
		<div class="shadow"></div>
		<div
			class="body square"
			// style="border-color:#ffffff56; border-style:dashed; transform:translateY({lift}px); background-color:var(--bg);"
			// style="border-color:{rim}; transform:translateY({lift}px); background-color:var(--bg);"
			style="background-image: url({enemy?.def?.profileImage}); border: none;"
		></div>
		{#if locked}
			<div class="nameplate">
				<div class="np-bar"><i style="width:{hpPct}%; background:{rim};"></i></div>
			</div>
		{/if}
	</div>
{:else if type === 'summon' && summon}
	{@const img = summon.profileImage}
	<div class="gem-root">
		<div class="shadow"></div>
		<div
			class="body summon square"
			style="border: none; {img
				? `background-image:url(${img});`
				: `background-color:var(--wolf);`}"
		>
			{#if !img}<span class="glyph">♦</span>{/if}
		</div>
		<div class="nameplate"><span class="np-label">{summon.name ?? summon.defId}</span></div>
	</div>
{:else if type === 'construct' && construct}
	{@const img = construct.profileImage}
	{@const elColor = ELEMENT_COLOR[construct.element ?? ''] ?? 'var(--gold)'}
	<div class="gem-root construct-root" style="--cel:{elColor}">
		<div class="construct-shadow"></div>
		<div class="construct-body square" style={img ? `background-image:url(${img});` : ''}>
			{#if !img}<span class="construct-glyph">◼</span>{/if}
		</div>
	</div>
{/if}

<style>
	/* ── Base gem ───────────────────────────────────────────────────────────── */
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
		bottom: 0;
		transform: translateX(-50%);
		width: 22px;
		height: 6px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.9);
	}
	.shadow.swimming {
		top: 0;
		bottom: auto;
		transform: translateX(-50%) translateY(-32px);
		z-index: 99;
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

	/* ── Shield ring ────────────────────────────────────────────────────────── */
	.shield-ring {
		position: absolute;
		top: 40%;
		left: 40%;
		width: 44px;
		height: 44px;
		margin: -19px 0 0 -19px;
		border-radius: 50%;
		border: 1.5px solid rgba(96, 210, 255, 0.55);
		box-shadow:
			0 0 8px rgba(96, 210, 255, 0.4),
			inset 0 0 6px rgba(96, 210, 255, 0.12);
		animation: shield-pulse 2s ease-in-out infinite;
		pointer-events: none;
	}
	@keyframes shield-pulse {
		0%,
		100% {
			opacity: 0.65;
			box-shadow:
				0 0 6px rgba(96, 210, 255, 0.3),
				inset 0 0 4px rgba(96, 210, 255, 0.1);
		}
		50% {
			opacity: 1;
			box-shadow:
				0 0 14px rgba(96, 210, 255, 0.65),
				inset 0 0 8px rgba(96, 210, 255, 0.2);
		}
	}

	/* ── Nameplate (enemy lock-on, summon label) ────────────────────────────── */
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

	/* ── Construct ──────────────────────────────────────────────────────────── */
	.construct-root {
		z-index: 5;
	}

	.construct-shadow {
		position: absolute;
		left: 50%;
		bottom: 2px;
		transform: translateX(-50%);
		width: 26px;
		height: 10px;
		background: rgba(0, 0, 0, 0.55);
		border-radius: 0 0 4px 4px;
		box-shadow:
			0 6px 0 0 rgba(0, 0, 0, 0.38),
			0 10px 0 0 rgba(0, 0, 0, 0.18),
			0 14px 0 0 rgba(0, 0, 0, 0.07);
	}

	.construct-body {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 26px;
		height: 26px;
		transform: translate(-50%, -62%);
		border-radius: 3px;
		background-color: #0d2a3a;
		background-size: cover;
		background-position: center;
		border: 1.5px solid var(--cel, var(--frost));
		box-shadow:
			0 4px 0 0 rgba(0, 0, 0, 0.7),
			0 8px 0 0 rgba(0, 0, 0, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: construct-idle 2s ease-in-out infinite;
		border: none;
		border-radius: 3px;
	}
	.construct-glyph {
		font-size: 11px;
		opacity: 0.9;
		color: var(--cel, var(--frost));
		text-shadow: 0 0 6px var(--cel, var(--frost));
	}
	@keyframes construct-idle {
		0%,
		100% {
			box-shadow:
				0 4px 0 0 rgba(0, 0, 0, 0.7),
				0 8px 0 0 rgba(0, 0, 0, 0.35),
				inset 0 1px 0 rgba(255, 255, 255, 0.18),
				0 0 0px transparent;
		}
		50% {
			box-shadow:
				0 4px 0 0 rgba(0, 0, 0, 0.7),
				0 8px 0 0 rgba(0, 0, 0, 0.35),
				inset 0 1px 0 rgba(255, 255, 255, 0.18),
				0 0 8px color-mix(in srgb, var(--cel, var(--frost)) 60%, transparent);
		}
	}

	.square {
		border-radius: 3px;
		background-size: contain;
		box-shadow: none;
	}
</style>

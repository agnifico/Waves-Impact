<script lang="ts">
	import type { EngineState } from '$lib/types/state';
	import { trySwap } from '$lib/combat/swap';

	let { state, now }: { state: EngineState; now: number } = $props();
</script>

<div class="party-row">
	{#each state.party as pc, i}
		{@const isActive = i === state.activeSlot}
		{@const isDead = pc.hp <= 0}
		<div class="card" class:active={isActive}>
			<kbd class="pc-slot">&nbsp;{i + 1}&nbsp;</kbd>

			<button
				class="party-card"
				class:active={isActive}
				class:dead={isDead}
				onclick={() => trySwap(state, i, performance.now())}
				style="background-image: url({pc.def.art?.profile})"
			>
				<div class="details">
					<div class="pc-name">{pc.def.name}</div>
					<!-- <div class="pc-name">{pc.def.element.toUpperCase()}</div> -->
				</div>
				<div class="pc-thumb"></div>
				<div class="pc-bars">
					<div class="pc-mini-bar">
						<div class="hp" style="width:{(100 * pc.hp) / pc.def.maxHp}%"></div>
					</div>
					<div class="pc-mini-bar"><div class="en" style="width:{pc.energy}%"></div></div>
				</div>
				<!-- <div class="pc-pct">{pc.hp}hp · {pc.energy}en</div> -->
			</button>
		</div>
	{/each}
</div>

<style>
	.party-row {
		position: relative;
		display: flex;
		gap: 6px;
		margin-top: 1rem;
		width: 100%;
		/* width: 75%; */
	}
	.card {
		position: relative;
		display: flex;
		width: 25%;
	}
	.card.active {
		position: relative;
		display: flex;
		width: 25%;
		kbd {
			visibility: hidden;
		}
	}
	kbd {
		position: absolute;
		right: 6px;
		top: 4px;
		background: var(--panel-raised);
		padding: 4px;
		font-size: 12px;
		text-align: center;
		font-size: 16px;
		color: var(--text);
		font-family: 'DePixel';
		padding-left: 4px;
		z-index: 2;
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-radius: 9px;
		box-shadow:
			0 0 0 2px rgba(0, 0, 0, 0.4) inset,
			0 -2px 0 2px rgba(0, 0, 0, 0.37) inset;
	}
	.party-card {
		position: relative;
		flex: 1;
		background: var(--panel);
		background-color: color-mix(in srgb, black 30%, var(--char-primary));
		border: 1px solid transparent;
		border-radius: 12px;
		/* padding: 6px 0; */
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
		color: inherit;
		text-align: left;
		padding: 0.5rem;
		transition: all 0.3s;
		background-size: cover;
		background-position: center;
		border: 2px solid transparent;
		border-radius: 12px;
		box-shadow:
			0 0 0 2px rgba(0, 0, 0, 0.4) inset,
			0 -5px 0 2px rgba(0, 0, 0, 0.37) inset,
			0 6px 18px rgba(0, 0, 0, 0.5);
		filter: grayscale(0.7) brightness(0.6);
	}
	.party-card.active {
		filter: grayscale(0);
		border: 2px solid var(--gold);
		box-shadow:
			0 0 0 2px rgba(0, 0, 0, 0.4) inset,
			0 -5px 0 2px rgba(0, 0, 0, 0.37) inset,
			0 6px 18px rgba(0, 0, 0, 0.5);
		transform: translateY(-6px);

		.pc-bars {
			visibility: hidden;
		}
	}
	.party-card.dead {
		opacity: 0.4;
	}

	.details {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		/* position: absolute; */
		/* background-color: rgba(0, 0, 0, 0.5); */
		left: 0;
		right: 0;
		top: 0;
		/* padding: 4px 4px 0; */
	}
	.pc-name {
		font-size: 12px;
		letter-spacing: -1px;
		color: var(--text);
		/* font-weight: 600; */
		font-style: italic;
		font-family: 'Silkscreen';
		background-color: #00000096;
		padding: 4px;
		width: 100%;
	}
	.pc-slot {
	}
	.pc-bars {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 4px 8px;
	}
	.pc-mini-bar {
		background: var(--bg);
		/* background: transparent; */
		background-color: #00000056;
		border-radius: 3px;
		overflow: hidden;
		border: 1px solid rgb(0, 0, 0);
	}
	.pc-mini-bar > .hp {
		height: 10px;
	}
	.pc-mini-bar > .en {
		height: 6px;
	}
	.pc-mini-bar > div {
		height: 100%;
		transition: width 0.2s;
	}
	.pc-thumb {
		width: 100%;
		height: 75px;
		background-size: cover;
		background-position: center;
		/* border-radius: 3px; */
		margin-bottom: 4px;
	}
	.hp {
		background: var(--hp);
		border-right: 1px solid rgba(255, 255, 255, 0.179);
	}
	.en {
		background: var(--energy);
		border-right: 1px solid rgba(255, 255, 255, 0.4);
	}
	.pc-pct {
		font-size: 8px;
		color: var(--text-dim);
	}
</style>

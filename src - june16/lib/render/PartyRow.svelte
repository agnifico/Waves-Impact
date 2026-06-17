<script lang="ts">
	import type { EngineState } from '$lib/types/state';
	import { trySwap } from '$lib/combat/swap';

	let { state, now }: { state: EngineState; now: number } = $props();
</script>

<div class="party-row">
	<div class="heading">Team</div>
	{#each state.party as pc, i}
		{@const isActive = i === state.activeSlot}
		{@const isDead = pc.hp <= 0}
		<div class="card" class:active={isActive}>
			<button
				class="party-card"
				class:active={isActive}
				class:dead={isDead}
				onclick={() => trySwap(state, i, performance.now())}
				style:background-image="url({isActive ? pc.def.art?.bannerPoster : ''})"
			>
				<kbd class="pc-slot">&nbsp;{i + 1}&nbsp;</kbd>
				<div class="pc-thumb" style="background-image: url({pc.def.art?.profile})"></div>
				<div class="container">
					<div class="details">
						<div class="pc-name">{pc.def.name}</div>
						<!-- <div class="pc-name">{pc.def.element.toUpperCase()}</div> -->
					</div>
					<div class="pc-bars">
						<div class="pc-mini-bar">
							<div class="hp" style="width:{(100 * pc.hp) / pc.def.maxHp}%"></div>
						</div>
						<div class="pc-mini-bar"><div class="en" style="width:{pc.energy}%"></div></div>
					</div>
					<!-- <div class="pc-pct">{pc.hp}hp · {pc.energy}en</div> -->
				</div>
			</button>
		</div>
	{/each}
</div>

<style>
	.party-row {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 1rem;
		width: 100%;
		/* width: 75%; */
		background-color: var(--panel-raised);
		padding: 1.25rem;
		padding-top: 0.75rem;
		border-radius: 12px;
		height: 100%;

		box-shadow:
			0 0 0px 2px rgba(0, 0, 0, 0.6) inset,
			0 -4px 0 6px rgba(0, 0, 0, 0.6) inset;
		padding-bottom: 1.5rem;
	}
	.heading {
		text-align: left;
		font-family: 'Jersey 10';
		text-transform: uppercase;
		font-weight: 600;
		font-style: italic;
		font-size: 2rem;
		line-height: 1.5rem;
		letter-spacing: 2px;
		margin: 0;
		padding: 0;
		color: var(--panel-2);
	}
	.card {
		position: relative;
		display: flex;
		min-width: 200px;
		height: auto;
		/* width: 25%; */
	}
	.card.active {
		position: relative;
		display: flex;
		/* width: 25%; */
		kbd {
			visibility: hidden;
		}
	}
	kbd {
		position: absolute;
		right: 0px;
		top: 0px;
		/* left: -4px; */
		background: var(--panel-raised);
		padding: 4px;
		padding-bottom: 6px;
		font-size: 12px;
		text-align: center;
		font-size: 8px;
		color: var(--text);
		font-family: 'DePixel';
		z-index: 2;
		/* border: 2px solid rgba(255, 255, 255, 0.2); */
		border-radius: 6px;
		box-shadow:
			0 0 0 2px rgba(0, 0, 0, 0.4) inset,
			0 -2px 0 2px rgba(0, 0, 0, 0.37) inset;
	}
	.party-card {
		position: relative;
		flex: 1;
		display: flex;
		background: var(--panel-2);
		border: 1px solid transparent;
		/* padding: 6px 0; */
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
		color: inherit;
		text-align: left;
		padding: 0.25rem;
		padding-bottom: 0.5rem;
		transition: all 0.3s;
		border: none;
		/* border: 2px solid transparent; */
		border-radius: 9px;
		box-shadow:
			0 0 0 2px rgba(0, 0, 0, 0.4) inset,
			0 -5px 0 2px rgba(0, 0, 0, 0.37) inset;
		/* filter: grayscale(0.7) brightness(0.6); */
		/* background-size: cover; */
		/* background-position: left 80%; */
	}
	.party-card.active {
		/* filter: grayscale(0) brightness(1); */
		/* border: 2px solid var(--gold); */
		box-shadow:
			0 0 0 2px rgba(0, 0, 0, 0.4) inset,
			0 -1px 0 2px rgba(0, 0, 0, 0.37) inset;
		/* transform: translateX(6px); */
		background-color: color-mix(in srgb, black 0%, var(--char-secondary));
		background-size: cover;
		background-position: center 20%;

		.pc-name {
			visibility: hidden;
		}

		.pc-bars {
			visibility: hidden;
		}

		.pc-thumb {
			visibility: hidden;
		}
	}
	.party-card.dead {
		opacity: 0.4;
		kbd {
			visibility: hidden;
		}
	}
	.container {
		display: flex;
		flex-direction: column;
		width: 100%;
		justify-content: space-between;
	}

	.details {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		/* position: absolute; */
		/* background-color: rgba(0, 0, 0, 0.5); */
		/* padding: 4px 4px 0; */
	}
	.pc-name {
		font-size: 12px;
		letter-spacing: -1px;
		color: var(--text);
		/* font-weight: 600; */
		/* font-style: italic; */
		font-family: 'Silkscreen';
		/* background-color: #00000096; */
		padding: 4px;
		width: 100%;
	}
	.pc-slot {
	}
	.pc-bars {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 4px 8px 8px;
		width: 100%;
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
		border-radius: 6px 0px 0 6px;
		width: 60px;
		height: 60px;
		aspect-ratio: 1;
		background-size: cover;
		background-position: center;
		/* border-radius: 3px; */
		/* margin-bottom: 4px; */
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

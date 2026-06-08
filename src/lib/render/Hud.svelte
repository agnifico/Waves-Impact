<script lang="ts">
	import type { EngineState } from '$lib/types/state';

	let { state, now }: { state: EngineState; now: number } = $props();

	let char = $derived(state.party[state.activeSlot]);
	let hpPct = $derived(Math.max(0, Math.min(100, (100 * char.hp) / char.def.maxHp)));
	let enPct = $derived(Math.max(0, Math.min(100, (100 * char.energy) / char.def.maxEnergy)));
	let low = $derived(hpPct < 30);
	let element = $derived(char.def.element.charAt(0).toUpperCase() + char.def.element.slice(1));
</script>

<div class="hud">
	<div class="hud-top-row">
		<div class="id">
			<div class="badge" style="background-image: url({char.def.art?.gem})"></div>
		</div>

		<div class="right-side">
			<div class="name-element">
				<div class="name">{char.def.name}</div>
				<!-- <div class="element">◆ {element}</div> -->
			</div>
			<div class="bars">
				<div class="bar">
					<!-- <div class="bar-top"><span>HP</span><span>{char.hp} / {char.def.maxHp}</span></div> -->
					<div class="track hp"><div class="fill" class:low style="width:{hpPct}%"></div></div>
				</div>
				<div class="bar">
					<div class="bar-top">
						<!-- <span>Energy</span><span>{char.energy} / {char.def.maxEnergy}</span> -->
					</div>
					<div class="track"><div class="fill energy" style="width:{enPct}%"></div></div>
				</div>
			</div>
			<div class="stacks-info">
				<div class="pips">
					<!-- <span class="pips-label">{char.def.stackName}</span> -->
					<div class="pips-row">
						{#each { length: char.def.stackMax } as _, i}
							<div class="pip" class:filled={i < char.stacks.current}></div>
						{/each}
					</div>
				</div>

				{#if 'unchained' in char.activeEffects}
					<span class="buff unchained">UNCHAINED</span>
				{/if}
				{#if 'bloomstride' in char.activeEffects}
					{@const bs = char.activeEffects['bloomstride']}
					{@const rem = bs.expiresAt > 0 ? Math.ceil((bs.expiresAt - now) / 1000) : '∞'}
					<span class="buff bloomstride">BLOOMSTRIDE {rem}s</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.hud {
		width: 250px;
		height: 100px;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 10px 10px;
		/* background: var(--panel); */
		/* background-color: rgb(49, 49, 49); */
		/* border: 1px solid var(--border); */
		border-radius: 12px;
	}
	.hud-top-row {
		position: relative;
		display: flex;
		height: fit-content;
		gap: 0.5rem;
	}
	.id {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.badge {
		position: absolute;
		top: -5px;
		left: -50px;
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		font-size: 20px;
		color: var(--bg);
		background: var(--char-primary, var(--gold));
		border-radius: 12px;
		border-radius: 50%;
		box-shadow:
			inset 0 2px 0 rgba(255, 255, 255, 0.35),
			inset 0 -3px 0 rgba(0, 0, 0, 0.3);
		background-size: cover;
		background-position: center;
		border: 2px solid var(--char-primary, var(--gold));
		z-index: 2;
	}
	.name-element {
		display: flex;
		justify-content: space-between;
		padding-left: 30px;
		padding-right: 20px;
		background-color: rgb(91, 91, 91);
		width: fit-content;
		padding-top: 4px;
		clip-path: polygon(0 0, 90% 0, 100% 100%, 0% 100%);
	}
	.name {
		font-size: 14px;
		letter-spacing: 0.5px;
		color: var(--char-primary, var(--gold));
		font-family: 'DePixel';
		text-transform: uppercase;
	}
	.element {
		font-size: 10px;
		letter-spacing: 1px;
		text-transform: uppercase;
		color: var(--char-secondary, var(--text-dim));
	}
	.right-side {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		/* gap: 6px; */
	}
	.bars {
		gap: 6px;
		display: flex;
		flex-direction: column;
		padding: 8px;
		padding-left: 30px;
		/* padding-right: 50px; */
		background-color: rgb(49, 49, 49);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 3px 0 rgba(0, 0, 0, 0.3),
			0 5px 12px rgba(0, 0, 0, 0.35);
		/* clip-path: polygon(90% 0, 100% 50%, 90% 100%, 0 100%, 0 0); */
		/* margin-bottom: 4px; */
		z-index: 1;
	}

	.stacks-info {
		position: relative;
		gap: 6px;
		display: flex;
		/* flex-direction: column; */
		background-color: var(--char-primary);
		padding: 4px;
		padding-left: 15px;
        padding-bottom: 8px;
		padding-left: 35px;
		padding-right: 30px;
		clip-path: polygon(0 0, 100% 0, 90% 100%, 20px 100%);
        width: fit-content;
		left: -25px;
		background: linear-gradient(
			-15deg,
			var(--bg) 0%,
			var(--bg) 40%,
			var(--char-primary) 100%
		);
	}

	.bar {
		display: flex;
		flex-direction: column;
		gap: 0px;
	}
	.bar-top {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		letter-spacing: 1px;
		text-transform: uppercase;
		color: var(--text-dim);
	}
	.track {
		height: 8px;
		background: var(--bg);
		border-radius: 2px;
		overflow: hidden;
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.45);
	}
	.track.hp {
		height: 15px;
	}
	.fill {
		height: 100%;
		background: var(--char-hp, var(--hp));
		transition: width 0.2s;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
	}
	.fill.low {
		background: var(--hp-low);
	}
	.fill.energy {
		background: var(--char-energy, var(--energy));
	}

	.pips {
		margin-top: 0.25rem;
		display: flex;
		/* flex-direction: column; */
		gap: 5px;
	}
	.pips-label {
		font-size: 14px;
		/* letter-spacing: -.5px; */
		text-transform: uppercase;
		color: var(--text-dim);
		font-family: 'DePixel';
	}
	.pips-row {
		display: flex;
		gap: 6px;
	}
	.pip {
		width: 10px;
		height: 10px;
		transform: rotate(45deg);
		border: 1px solid var(--char-primary, var(--gold));
		background: transparent;
		transition: all 0.2s;
		border-radius: 25%;
	}
	.pip.filled {
		background: var(--char-primary, var(--gold));
		box-shadow: 0 0 6px var(--char-primary, var(--gold));
	}

	.buff {
		align-self: flex-start;
		padding: 2px 7px;
		font-size: 9px;
		letter-spacing: 1px;
		border-radius: 3px;
		color: var(--bg);
		animation: pulse 1.2s infinite;
	}
	.buff.unchained {
		background: var(--unchained);
	}
	.buff.bloomstride {
		background: var(--bloomstride);
	}
</style>

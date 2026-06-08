<script lang="ts">
	import type { EngineState } from '$lib/types/state';
	let { state: gs }: { state: EngineState } = $props();
	let char = $derived(gs.party[gs.activeSlot]);
</script>

<div class="portrait-box">
	<div class="poster" style="background-image: url({char.def.art?.poster})"></div>
    <!-- <div class="name-plate" style="color: var(--char-primary)">
		{char.def.name}
	</div> -->
</div>

<style>
	.portrait-box {
		flex: 0 0 190px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-self: stretch;
		filter: grayscale(1);
	}
	.poster {
		flex: 1;
		min-height: 0;
		background-size: cover;
		background-position: center top;
		/* border: 1px solid var(--border-strong); */
		border-radius: 8px;
	}
	.name-plate {
		text-align: center;
		font-size: 14px;
		letter-spacing: 2px;
		padding: 5px;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 6px;
	}
</style>

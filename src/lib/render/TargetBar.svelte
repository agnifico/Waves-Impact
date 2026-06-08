<script lang="ts">
	import type { EngineState } from '$lib/types/state';
	let { state }: { state: EngineState } = $props();
	let target = $derived(
		state.focusTargetId ? (state.enemies.find((e) => e.id === state.focusTargetId && e.hp > 0) ?? null) : null
	);
</script>

{#if target}
	{@const pct = Math.max(0, (100 * target.hp) / target.def.maxHp)}
	<div class="target-bar">
		<div class="tb-top">
			<span class="tb-name">{target.def.name}</span>
			<span class="tb-hp">{target.hp} / {target.def.maxHp}</span>
		</div>
		<div class="tb-track"><div class="tb-fill" style="width:{pct}%"></div></div>
	</div>
{/if}

<style>
	.target-bar {
        box-sizing: border-box;
		position: relative; left: 50%; transform: translateX(-50%);
		width: 300px;height: fit-content; z-index: 50; pointer-events: none;
		background: rgba(20, 14, 24, 0.82); border: 1px solid var(--coral);
		border-radius: 6px; padding: 6px 10px;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 3px 10px rgba(0, 0, 0, 0.4);
	}
	.tb-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
	.tb-name { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: var(--text); }
	.tb-hp { font-size: 10px; color: var(--text-dim); }
	.tb-track { height: 8px; background: var(--panel-2); border-radius: 2px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5); }
	.tb-fill { height: 100%; background: var(--coral); transition: width 0.2s; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25); }
</style>
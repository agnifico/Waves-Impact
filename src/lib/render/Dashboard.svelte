<script lang="ts">
	import type { EngineState } from '$lib/types/state';

	let { state: gs, now }: { state: EngineState; now: number } = $props();

	let char = $derived(gs.party[gs.activeSlot]);
	let hpPct = $derived(100 * char.hp / char.def.maxHp);
</script>

<div class="char-info">
	<div class="char-header">
		<div class="portrait {char.def.id}">{char.def.name[0]}</div>
		<div>
			<div class="char-name" style="color: var(--char-primary)">
				{char.def.name}
			</div>
			<div class="char-element {char.def.element}">
				◆ {char.def.element.charAt(0).toUpperCase() + char.def.element.slice(1)}
			</div>
		</div>
	</div>

	<div class="bar">
		<div class="bar-label"><span>HP</span><span>{char.hp} / {char.def.maxHp}</span></div>
		<div class="bar-track">
			<div class="bar-fill hp" style="width:{hpPct}%; background: {hpPct < 30 ? 'var(--hp-low)' : 'var(--char-hp)'};"></div>
		</div>
	</div>

	<div class="bar">
		<div class="bar-label"><span>Energy</span><span>{char.energy} / {char.def.maxEnergy}</span></div>
		<div class="bar-track">
			<div class="bar-fill energy" style="width:{char.energy}%"></div>
		</div>
	</div>

	<div class="status-row">
		<span>{char.def.stackName}:</span>
		{#each { length: char.def.stackMax } as _, i}
			{@const filled = i < char.stacks.current}
			{@const isVerdance = char.def.stackType === 'verdance'}
			<div class="stack-pip" class:filled class:verdance={isVerdance}></div>
		{/each}
		{#if 'unchained' in char.activeEffects}
			<span class="buff-badge unchained">UNCHAINED</span>
		{/if}
		{#if 'bloomstride' in char.activeEffects}
			{@const bs = char.activeEffects['bloomstride']}
			{@const remaining = bs.expiresAt > 0 ? Math.ceil((bs.expiresAt - now) / 1000) : '∞'}
			<span class="buff-badge bloomstride">BLOOMSTRIDE {remaining}s</span>
		{/if}
	</div>
</div>

<style>
	.char-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.char-header { display: flex; align-items: center; gap: 10px; }
	.portrait {
		width: 42px; height: 42px;
		border: 1px solid var(--gold);
		border-radius: 4px;
		display: flex; align-items: center; justify-content: center;
		color: var(--bg); font-weight: bold; font-size: 14px;
	}
	.portrait.frosty { background: linear-gradient(135deg, var(--frost), var(--frost-bright)); }
	.portrait.yara { background: linear-gradient(135deg, var(--verdant), var(--verdant-bright)); }
	.char-name { font-size: 1.2rem; letter-spacing: 1px; }
	.char-element { font-size: 1rem; letter-spacing: 1px; text-transform: uppercase; }
	.char-element.water { color: var(--frost); }
	.char-element.wind { color: var(--verdant); }

	.bar { display: flex; flex-direction: column; gap: 2px; }
	.bar-label {
		display: flex; justify-content: space-between;
		font-size: 9px; color: var(--text-dim);
		letter-spacing: 1px; text-transform: uppercase;
	}
	.bar-track {
		height: 8px; background: var(--panel-2);
		border: 1px solid var(--border); border-radius: 2px; overflow: hidden;
	}
	.bar-fill { height: 100%; transition: width 0.2s; }
	.bar-fill.energy { background: var(--char-energy); }

	.status-row {
		display: flex; gap: 6px; align-items: center;
		font-size: 10px; color: var(--text-dim);
		min-height: 16px; flex-wrap: wrap;
	}
	.stack-pip {
		width: 10px; height: 10px; transform: rotate(45deg);
		border: 1px solid var(--eclipse); background: transparent; transition: all 0.2s;
	}
	.stack-pip.filled { background: var(--eclipse); box-shadow: 0 0 6px var(--eclipse); }
	.stack-pip.verdance { border-color: var(--verdant); }
	.stack-pip.verdance.filled { background: var(--verdant); box-shadow: 0 0 6px var(--verdant); }
	.buff-badge {
		padding: 2px 6px; font-size: 8px; letter-spacing: 1px; border-radius: 2px;
		animation: pulse 1.2s infinite; color: var(--bg);
	}
	.buff-badge.unchained { background: var(--unchained); }
	.buff-badge.bloomstride { background: var(--bloomstride); }
</style>
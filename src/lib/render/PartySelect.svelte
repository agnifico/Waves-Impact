<script lang="ts">
	import type { Character } from '$lib/types/character';

	let {
		roster,
		selected = $bindable([]),
		enemyKey = $bindable('dragon'),
		enemyOptions = [],
		onbegin,
		onopencodex
	}: {
		roster: Character[];
		selected: string[];
		enemyKey: string;
		enemyOptions: string[];
		onbegin: () => void;
		onopencodex?: () => void;
	} = $props();

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}
	function pretty(s: string) {
		return s.replace(/_/g, ' ');
	}
</script>

<div class="select-overlay">
	<div class="panel">
		<header>
			<h1>Choose Your Heroes</h1>
			<p class="hint">{selected.length} selected · tap to toggle</p>
		</header>

		<div class="roster">
			{#each roster as c (c.id)}
				{@const on = selected.includes(c.id)}
				<button
					class="char"
					class:on
					style="--accent:{c.theme?.primary ?? 'var(--gold)'}"
					onclick={() => toggle(c.id)}
				>
					<div class="portrait" style="background-image:url({c.art?.profile})"></div>
					<div class="nm">{c.name}</div>
					{#if on}<div class="check">✓</div>{/if}
				</button>
			{/each}
		</div>

		<div class="foot">
			<div class="enemy">
				<span class="lbl">Enemy</span>
				{#each enemyOptions as ek (ek)}
					<button class="ek" class:on={ek === enemyKey} onclick={() => (enemyKey = ek)}>
						{pretty(ek)}
					</button>
				{/each}
			</div>
			<div class="actions">
				{#if onopencodex}
					<button class="ghost" onclick={onopencodex}>Archive</button>
				{/if}
				<button class="begin" disabled={selected.length === 0} onclick={onbegin}>Begin</button>
			</div>
		</div>
	</div>
</div>

<style>
	.select-overlay {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: grid;
		place-items: center;
		background: rgba(8, 6, 14, 0.78);
		backdrop-filter: blur(3px);
	}
	.panel {
		width: min(700px, 92vw);
		max-height: 88vh;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 24px;
		border-radius: 18px;
		background: var(--panel, #1b2433);
		box-shadow:
			0 0 0 4px rgba(0, 0, 0, 0.4) inset,
			0 -8px 0 8px rgba(0, 0, 0, 0.35) inset;
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	h1 {
		margin: 0;
		font-family: 'DePixel', monospace;
		font-size: 20px;
		letter-spacing: 2px;
		color: var(--gold, #f5c04a);
		text-transform: uppercase;
	}
	.hint {
		margin: 0;
		font-family: 'Andale Mono', monospace;
		font-size: 11px;
		color: var(--text-dim, #9aa6b8);
	}

	.roster {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 12px;
		overflow-y: auto;
		padding: 4px;
	}
	.char {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		border: none;
		border-radius: 12px;
		background: var(--panel-2, #11161f);
		cursor: pointer;
		color: var(--text, #e7ecf3);
		font-family: inherit;
		opacity: 0.55;
		filter: grayscale(0.6);
		transition:
			transform 0.12s,
			opacity 0.12s,
			filter 0.12s,
			box-shadow 0.12s;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.4) inset;
	}
	.char:hover {
		opacity: 0.85;
		transform: translateY(-2px);
	}
	.char.on {
		opacity: 1;
		filter: none;
		box-shadow:
			0 0 0 2px var(--accent) inset,
			0 0 14px -2px var(--accent);
	}
	.portrait {
		aspect-ratio: 1;
		border-radius: 9px;
		background-size: cover;
		background-position: center 20%;
	}
	.nm {
		font-family: 'Silkscreen', monospace;
		font-size: 12px;
		letter-spacing: -1px;
		text-align: center;
		color: var(--text, #e7ecf3);
	}
	.check {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--accent);
		color: #0a0710;
		font-size: 12px;
		font-weight: 700;
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.enemy {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.lbl {
		font-family: 'Andale Mono', monospace;
		font-size: 11px;
		color: var(--text-dim, #9aa6b8);
		text-transform: uppercase;
	}
	.ek,
	.ghost,
	.begin {
		font-family: 'Andale Mono', monospace;
		font-size: 12px;
		font-weight: 600;
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid #00000080;
		background: var(--panel-raised, #2a3340);
		color: var(--text, #e7ecf3);
		cursor: pointer;
		text-transform: capitalize;
	}
	.ek.on {
		border-color: var(--gold, #f5c04a);
		color: var(--gold, #f5c04a);
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	.begin {
		background: var(--gold, #f5c04a);
		color: #0a0710;
		border-color: #00000080;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		padding: 8px 22px;
	}
	.begin:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
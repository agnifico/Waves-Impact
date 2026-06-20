<script lang="ts">
	import { subscribe } from '$lib/combat/events';
	import { onMount } from 'svelte';

	type LogEntry = { id: number; kind: string; msg: string; time: string };
	let entries = $state<LogEntry[]>([]);
	let logId = 0;
	let scrollEl: HTMLDivElement;
	let isHidden = $state(false);

	function addLog(kind: string, msg: string) {
		const t = new Date();
		const time = `${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`;
		entries.push({ id: logId++, kind, msg, time });
		// Keep last 200 entries
		if (entries.length > 200) entries = entries.slice(-200);
		// Auto-scroll
		requestAnimationFrame(() => {
			if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
		});
	}

	onMount(() => {
		addLog('system', '◆ Combat started');

		const unsubs = [
			subscribe('damage:dealt', (e) => {
				addLog(e.source, `${e.source} hits ${e.target} for ${e.amount} (${e.abilityName})`);
			}),
			subscribe('damage:taken', (e) => {
				addLog('enemy', `${e.source} hits ${e.target} for ${e.amount} (${e.abilityName})`);
			}),
			subscribe('heal:applied', (e) => {
				addLog(e.source, `${e.target} healed for ${e.amount}`);
			}),
			subscribe('effect:applied', (e) => {
				addLog('system', `${e.target} gains ${e.effectId}`);
			}),
			subscribe('enemy:defeated', (e) => {
				addLog('victory', `${e.enemyId} defeated!`);
			}),
			subscribe('character:swap', (e) => {
				addLog('system', `Swapped: ${e.from} → ${e.to}`);
			}),
			subscribe('summon:spawned', (e) => {
				addLog('wolf', `${e.summonId} summoned`);
			}),
			subscribe('summon:expired', (e) => {
				addLog('wolf', `${e.summonId} expired`);
			}),
			subscribe('zone:created', () => {
				addLog('system', 'Zone created');
			}),
			subscribe('zone:expired', () => {
				addLog('system', 'Zone expired');
			}),
			subscribe('stack:gained', (e) => {
				addLog(e.characterId, `${e.stackType} stack: ${e.current}`);
			})
		];

		return () => unsubs.forEach((u) => u());
	});

	export function logVictory() {
		addLog('victory', '◆ VICTORY ◆');
	}
	export function logDefeat() {
		addLog('defeat', '◆ DEFEAT ◆');
	}
	export function reset() {
		entries = [];
		logId = 0;
	}
</script>

<div class="log-panel">
	<div class="panel-head">
		<div class="log-header">◆ Combat Log</div>
		<button
			class="hide-btn"
			onclick={() => {
				isHidden = !isHidden;
			}}
		>
			Hide
		</button>
	</div>
	<div class="log-scroll" bind:this={scrollEl} class:isHidden={isHidden}>
		{#each entries as entry (entry.id)}
			<div class="log-line {entry.kind}">
				<span class="time">{entry.time}</span>{entry.msg}
			</div>
		{/each}
	</div>
</div>

<style>
	.log-panel {
		/* height: 100%; */
		/* flex: 1; */
		/* min-height: 0; */
		background: var(--panel);
		/* border: 1px solid var(--border); */
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		/* overflow: hidden; */
		width: 100%;
		padding: 10px 12px 20px 12px;
		box-shadow:
		0 0 0px 4px rgba(0, 0, 0, 0.4) inset,
		0 -8px 0 8px rgba(0, 0, 0, 0.37) inset;
	}
	.log-header {
		color: var(--panel-raised);
		font-size: 1rem;
		/* letter-spacing: 2px; */
		text-transform: uppercase;
		margin-bottom: 8px;
		font-family: 'DePixel';
	}
	.panel-head {
		display: flex;
		justify-content: space-between;
	}
	.hide-btn {
		margin-block: auto;
		height: fit-content;
		background-color: transparent;
		border: none;
		color: #d49060;
		font-family: 'DePixel';
		cursor: pointer;
	}

	.log-scroll {
		height: 200px;
		display: block;
		background-color: var(--panel);
		overflow-y: auto;
		font-size: 12px;
		line-height: 1.5;
		scrollbar-width: thin;
		border-radius: 6px;
		border: 2px solid rgb(0, 0, 0);
		box-shadow: inset 0px 10px 20px 0 rgba(0, 0, 0, 0.7);
		scrollbar-width: none;
	}
	.log-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.log-scroll::-webkit-scrollbar-track {
		background: var(--bg);
	}
	.log-scroll::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 3px;
	}
	.log-line {
		padding: 4px;
		color: var(--text-dim);
		background-color: rgba(0, 0, 0, 0.379);
	}
	.log-line.frosty {
		color: var(--frost);
	}
	.log-line.june9 {
		color: var(--verdant);
	}
	.log-line.enemy {
		color: #d49060;
	}
	.log-line.wolf {
		color: var(--wolf);
	}
	.log-line.system {
		color: var(--gold);
		font-style: italic;
	}
	.log-line.victory {
		color: var(--hp);
		font-weight: bold;
		letter-spacing: 1px;
	}
	.log-line.defeat {
		color: var(--hp-low);
		font-weight: bold;
		letter-spacing: 1px;
	}
	.time {
		color: var(--panel-raised);
		font-size: 9px;
		margin-right: 6px;
	}
	.isHidden {
		visibility: hidden;
		position: absolute;
	}
</style>

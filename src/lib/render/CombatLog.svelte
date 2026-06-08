<script lang="ts">
	import { subscribe } from '$lib/combat/events';
	import { onMount } from 'svelte';

	type LogEntry = { id: number; kind: string; msg: string; time: string };
	let entries = $state<LogEntry[]>([]);
	let logId = 0;
	let scrollEl: HTMLDivElement;

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
	<div class="log-header">◆ Combat Log</div>
	<div class="log-scroll" bind:this={scrollEl}>
		{#each entries as entry (entry.id)}
			<div class="log-line {entry.kind}">
				<span class="time">{entry.time}</span>{entry.msg}
			</div>
		{/each}
	</div>
</div>

<style>
	.log-panel {
		height: 100%;
		min-height: 0;
		background: var(--panel);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		/* overflow: hidden; */
		width: 100%;
	}
	.log-header {
		color: var(--gold);
		font-size: 11px;
		letter-spacing: 2px;
		text-transform: uppercase;
		margin-bottom: 8px;
	}
	.log-scroll {
		flex: 1;
		overflow-y: auto;
		font-size: 11px;
		line-height: 1.5;
		padding-right: 8px;
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
		padding: 1px 0;
		color: var(--text-dim);
	}
	.log-line.frosty {
		color: var(--frost);
	}
	.log-line.yara {
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
		color: var(--border);
		font-size: 9px;
		margin-right: 6px;
	}
</style>

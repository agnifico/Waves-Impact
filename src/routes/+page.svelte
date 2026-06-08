<script lang="ts">
	import { onMount } from 'svelte';
	import { tick as engineTick, resetEngine } from '$lib/combat/engine';
	import { newEngineState } from '$lib/combat/state';
	import { clear as clearEvents } from '$lib/combat/events';
	import { bindInputEvents } from '$lib/input/input-handler';
	import {
		getMoveDir,
		updateHoldState,
		holdState,
		computeFacing,
		clearAll as clearInput,
		resetLock,
		getLockedEnemyId,
		resetHoldState
	} from '$lib/input/intent-state';
	import { focusTarget, nearestEnemy } from '$lib/combat/query';
	import { frosty } from '$lib/data/characters/frosty';
	import { yara } from '$lib/data/characters/yara';
	import { sefyra } from '$lib/data/characters/sefyra';
	import { maria_elena } from '$lib/data/characters/maria_elena';
	import { bear } from '$lib/data/enemies/bear';
	import { dragon } from '$lib/data/enemies/dragon';
	import type { Character } from '$lib/types/character';
	import type { Enemy } from '$lib/types/enemy';
	import type { AbilitySlot } from '$lib/types/ability';
	import Board from '$lib/render/Board.svelte';
	import Dashboard from '$lib/render/Dashboard.svelte';
	import PartyRow from '$lib/render/PartyRow.svelte';
	import AbilityBar from '$lib/render/AbilityBar.svelte';
	import CombatLog from '$lib/render/CombatLog.svelte';
	import ActivePortrait from '$lib/render/ActivePortrait.svelte';
	import { themeVars } from '$lib/render/char-theme';
	import Hud from '$lib/render/Hud.svelte';
	import TargetBar from '$lib/render/TargetBar.svelte';
	import UnitBanner from '$lib/render/UnitBanner.svelte';
	import { tryAbility } from '$lib/combat/ability-resolver';
	import { ryoma } from '$lib/data/characters/ryoma';
	import { midorima } from '$lib/data/characters/midorima';

	const PARTY_OPTIONS: Record<string, Character[]> = {
		'full_team': [maria_elena, frosty, yara, sefyra, ryoma, midorima],
		frosty: [frosty],
		yara: [yara],
		sefyra: [sefyra]
	};
	const ENEMY_OPTIONS: Record<string, Enemy[]> = {
		bear: [bear],
		dragon: [dragon],
		both: [bear, dragon]
	};

	let selectedParty = $state('full_team');
	let selectedEnemy = $state('dragon');
	let gs = $state(
		newEngineState(
			PARTY_OPTIONS[selectedParty],
			ENEMY_OPTIONS[selectedEnemy],
			performance.now(),
			15
		)
	);
	let activeThemeVars = $derived(themeVars(gs.party[gs.activeSlot].def));
	let now = $state(performance.now());
	let boardComponent: Board;
	let logComponent: CombatLog;

	function resetFight() {
		clearInput();
		resetEngine();
		resetLock();
		const fresh = newEngineState(
			PARTY_OPTIONS[selectedParty],
			ENEMY_OPTIONS[selectedEnemy],
			performance.now(),
			15
		);
		Object.assign(gs, fresh);
	}

	onMount(() => {
		const unbindInput = bindInputEvents(() => gs, boardComponent?.getBoardEl());
		let rafId: number;
		function gameLoop() {
			now = performance.now();
			if (!gs.over) {
				const char = gs.party[gs.activeSlot];
				const enemy = nearestEnemy(gs, char.pos);
				const lockedId = getLockedEnemyId();
				gs.focusTargetId =
					lockedId && gs.enemies.some((e) => e.id === lockedId && e.hp > 0) ? lockedId : null;
				const target = focusTarget(gs, char.pos);
				const newFacing = computeFacing(
					char.pos,
					target?.pos ?? null,
					now,
					gs.focusTargetId !== null
				);
				if (newFacing) char.facing = newFacing;
				if (holdState.holdingSlot) {
					const ability = char.def.abilities[holdState.holdingSlot as AbilitySlot];
					if (ability) {
						let trackPos: { x: number; y: number } | null = null;
						if (holdState.holdBehavior === 'track' && holdState.trackTargetId) {
							const te = gs.enemies.find((e) => e.id === holdState.trackTargetId && e.hp > 0);
							trackPos = te ? te.pos : null;
						}
						updateHoldState(
							now,
							char.pos,
							ability.shapeParams?.range ?? 0,
							ability.chargeMsPerTile,
							ability.chargeMaxRange,
							trackPos
						);
						if (holdState.fireNow) {
							const slot = holdState.holdingSlot as AbilitySlot;
							const tier = holdState.tier;
							const lockedTargetId = holdState.trackTargetId ?? undefined;
							resetHoldState();
							tryAbility(gs, slot, now, { tier, lockedTargetId });
						}
					}
				}
				const moveDir = getMoveDir();
				engineTick(gs, now, moveDir);
			}
			rafId = requestAnimationFrame(gameLoop);
		}
		rafId = requestAnimationFrame(gameLoop);
		return () => {
			cancelAnimationFrame(rafId);
			unbindInput();
			clearEvents();
		};
	});
</script>

<div class="page">
	<div class="arena" style={activeThemeVars}>
		<!-- LEFT: board + abilities -->
		<!-- <ActivePortrait {state} /> -->

		<div class="center">
			<div class="hud-col">
				<div class="banner banner-ally"><UnitBanner side="ally" state={gs} {now} /></div>
				<div class="banner banner-enemy"><UnitBanner side="enemy" state={gs} {now} /></div>
			</div>
			<div class="board-col">
				<div class="board-wrap">
					<Board bind:this={boardComponent} {gs} {now} />
					{#if gs.over && gs.outcome === 'victory'}
						<div class="overlay victory"><h1>VICTORY</h1></div>
					{/if}
					{#if gs.over && gs.outcome === 'defeat'}
						<div class="overlay defeat"><h1>DEFEAT</h1></div>
					{/if}
					{#if gs.party[gs.activeSlot].stunnedUntil > now}
						<div class="overlay stun">STUNNED</div>
					{/if}
				</div>
				<AbilityBar state={gs} {now} />
			</div>
			<div class="party-row">
				<PartyRow state={gs} {now} />
			</div>
		</div>

		<!-- RIGHT: party, char info, log, keys -->
		<div class="sidebar">
			<!-- <Dashboard state={gs} {now} /> -->
			<div class="log-wrap">
				<CombatLog bind:this={logComponent} />
			</div>
			<div class="keys-area">
				<div class="top-controls">
					<select
						bind:value={selectedParty}
						onchange={(e) => {
							selectedParty = e.currentTarget.value;
							resetFight();
						}}
					>
						<option value="full_team">Full Team</option>
						<option value="frosty">Frosty</option>
						<option value="yara">Yara</option>
						<option value="sefyra">Sefyra</option>
					</select>
					<select
						bind:value={selectedEnemy}
						onchange={(e) => {
							selectedEnemy = e.currentTarget.value;
							resetFight();
						}}
					>
						<option value="bear">Bear</option>
						<option value="dragon">Dragon</option>
						<option value="both">Bear + Dragon</option>
					</select>
					<button onclick={() => resetFight()}>Reset</button>
				</div>
				<div class="keys-grid">
					<kbd>WASD</kbd><span>move</span>
					<kbd>↑↓←→</kbd><span>move</span>
					<kbd>Spc</kbd><span>basic</span>
					<kbd>X C V</kbd><span>skills</span>
					<kbd>1 2 3</kbd><span>swap</span>
					<kbd>Z</kbd><span>auto-look</span>
					<kbd>Shift</kbd><span>aim</span>
					<kbd>F</kbd><span>Lock-On</span>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.page {
		height: 100vh;
		/* padding: 16px; */
		display: grid;
		place-items: center;
		/* background: url('/characters/group2.png');
		background-size: cover;
		background-position: center 60%;
		background-repeat: no-repeat; */
	}
	
	.arena {
		width: fit-content;
		/* height: 100%; */
		/* width: 100%; */
		/* display: grid; */
		/* grid-template-columns: 1fr auto 1fr; */
		display: flex;
		/* flex-direction: column; */
		column-gap: 24px;
		align-items: stretch;
		justify-content: center;
		backdrop-filter: blur(2px) grayscale(1) brightness(.25);
	}

	.center {
		display: flex;
		flex-direction: column;
	}

	.hud-col {
		position: relative;
		/* top: 10%; */
		/* grid-column: 1; */
		display: flex;
		align-content: flex-end;
		align-items: flex-end;
		width: 100%;
		/* width: 250px; */
		/* position: absolute;
		left: 10%;
		top: 5%; */
		margin-bottom: 1rem;
		z-index: 1;
		justify-content: space-between;
	}

	.party-row {
		display: flex;
		justify-content: space-between;
	}

	/* ─── Left column: board + abilities ─────────────── */
	.board-col {
		grid-column: 2;
		justify-self: center;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: min-content;
	}
	.board-wrap {
		padding: 0;
	}

	/* ─── Right column: hud, stretches to match left ─── */
	.sidebar {
		grid-column: 3;
		/* justify-self: end; */
		/* align-self: center; */
		width: 300px;
		max-height: calc(100vh - 32px);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.log-wrap {
		flex: 1 0 0;
		min-height: 250px;
	}
	.keys-area {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: var(--panel);
		border: 3px solid var(--panel-raised);
		border-radius: 8px;
		padding: 8px;
		margin-top: 8px;
	}
	.top-controls {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.top-controls select,
	.top-controls button {
		background: var(--panel-2);
		border: 1px solid var(--border);
		border: 1px solid #000000a0;
		color: var(--text);
		padding: 3px 6px;
		font-family: inherit;
		font-size: 10px;
		cursor: pointer;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		font-family: "Andale Mono";
	}
	.top-controls button:hover {
		border-color: var(--gold);
		color: var(--gold);
	}
	.keys-grid {
		display: grid;
		grid-template-columns: auto 1fr auto 1fr;
		gap: 4px 8px;
		font-size: 9px;
		align-items: center;
	}
	.keys-grid kbd {
		background: var(--panel-2);
		/* border: 1px solid var(--border-strong); */
		border: 1px solid #00000056;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		font-family: "Andale Mono";
		text-align: center;
		box-shadow: 0 1px 1px 1px #00000056;
	}
	.keys-grid span {
		color: var(--text-dim);
		font-size: 10px;
		font-family: "Andale Mono";
	}

	/* ─── Overlays ────────────────────────────────────── */
	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		border-radius: 8px;
	}
	.overlay.victory,
	.overlay.defeat {
		background: rgba(26, 17, 42, 0.88);
	}
	.overlay.victory h1 {
		color: var(--hp);
		font-size: 28px;
		letter-spacing: 4px;
	}
	.overlay.defeat h1 {
		color: var(--hp-low);
		font-size: 28px;
		letter-spacing: 4px;
	}
	.overlay.stun {
		background: rgba(196, 66, 58, 0.15);
		pointer-events: none;
		z-index: 10;
		color: var(--blood);
		font-size: 18px;
		letter-spacing: 4px;
		text-transform: uppercase;
		animation: pulse 0.5s infinite;
	}
</style>
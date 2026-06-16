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
		resetHoldState,
		gameNow,
		isPaused,
		setPaused,
		resetClock
	} from '$lib/input/intent-state';
	import { focusTarget, nearestEnemy } from '$lib/combat/query';
	import { tryAbility } from '$lib/combat/ability-resolver';
	import { tryBasicAttack } from '$lib/combat/basic-attack';
	import { getAllCharacters, getEnemy } from '$lib/data/registry';
	import type { AbilitySlot } from '$lib/types/ability';
	import Board from '$lib/render/Board.svelte';
	import PartyRow from '$lib/render/PartyRow.svelte';
	import AbilityBar from '$lib/render/AbilityBar.svelte';
	import CombatLog from '$lib/render/CombatLog.svelte';
	import { themeVars } from '$lib/render/char-theme';
	import UnitBanner from '$lib/render/UnitBanner.svelte';
	import CharacterCodex from '$lib/render/CharacterCodex.svelte';
	import PartySelect from '$lib/render/PartySelect.svelte';

	// ── Roster & encounters ───────────────────────────────────────────────────

	const ROSTER = getAllCharacters();

	const DEFAULT_PARTY = ['carla', 'maria_elena', 'midorima', 'frosty', 'june9', 'sefyra'];

	const ENEMY_OPTIONS = {
		dragon: [getEnemy('dragon')!],
		bob: [getEnemy('bob')!],
		hunt: [getEnemy('forest_prowler')!, getEnemy('vanguard_siren')!],
		wall: [getEnemy('solis_sentinel')!, getEnemy('punching_tortoise')!],
		gauntlet: [
			getEnemy('forest_prowler')!,
			getEnemy('solis_sentinel')!,
			getEnemy('vanguard_siren')!
		],
		old_duo: [getEnemy('bear')!, getEnemy('dragon')!],
		all: [
			getEnemy('bear')!,
			getEnemy('dragon')!,
			getEnemy('forest_prowler')!,
			getEnemy('solis_sentinel')!,
			getEnemy('vanguard_siren')!,
			getEnemy('punching_tortoise')!
		]
	};

	const ENCOUNTER_LABELS: Record<string, string> = {
		dragon: 'Dragon',
		bob: 'Bob',
		hunt: 'The Hunt',
		wall: 'The Wall',
		gauntlet: 'The Gauntlet',
		old_duo: 'Bear + Dragon',
		all: 'All'
	};

	const SKINS = [
		{ label: 'Default', url: 'none' },
		{ label: 'Marble', url: '/skins/marble.jpg' },
		{ label: 'Wooden', url: '/skins/wooden.jpg' },
		{ label: 'Yellow', url: '/skins/yellow.jpg' },
		{ label: 'Techno', url: '/skins/techno.jpg' },
		{ label: 'Frosted', url: '/skins/frosted.jpg' },
		{ label: "Dawn's Journey", url: '/skins/NEW_WORLD.png' }
	];

	// ── State ─────────────────────────────────────────────────────────────────

	let isCodexOpen = $state(false);
	let phase = $state<'select' | 'combat'>('select');
	let paused = $state(false);
	let selectedIds = $state<string[]>([...DEFAULT_PARTY]);
	let selectedEnemy = $state('dragon');
	let selectedSkin = $state('/skins/wooden.jpg');
	let hudHidden = $state(false);

	let gs = $state(
		newEngineState(
			ROSTER.filter((c) => DEFAULT_PARTY.includes(c.id)),
			ENEMY_OPTIONS[selectedEnemy as keyof typeof ENEMY_OPTIONS],
			performance.now(),
			15
		)
	);
	let activeThemeVars = $derived(themeVars(gs.party[gs.activeSlot].def));
	let now = $state(performance.now());
	let boardComponent: Board;
	let logComponent: CombatLog;

	// ── Fight management ──────────────────────────────────────────────────────

	function buildParty() {
		return ROSTER.filter((c) => selectedIds.includes(c.id));
	}

	function loadFight() {
		clearInput();
		resetEngine();
		resetLock();
		resetClock();
		const enemies = ENEMY_OPTIONS[selectedEnemy as keyof typeof ENEMY_OPTIONS];
		const fresh = newEngineState(buildParty(), enemies, gameNow(), 15);
		Object.assign(gs, fresh);
	}

	function beginCombat() {
		if (selectedIds.length === 0) return;
		loadFight();
		phase = 'combat';
	}

	function resetFight() {
		loadFight();
	}
	function toSelect() {
		phase = 'select';
	}

	// ── Game loop ─────────────────────────────────────────────────────────────

	onMount(() => {
		const unbindInput = bindInputEvents(
			() => gs,
			boardComponent?.getBoardEl(),
			() => phase === 'combat' && !isPaused()
		);

		let rafId: number;
		function gameLoop() {
			now = gameNow();
			paused = isPaused();
			if (phase === 'combat' && !paused && !gs.over) {
				const char = gs.party[gs.activeSlot];
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
							ability.aimRange ?? ability.shapeParams?.range ?? 0,
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

				engineTick(gs, now, getMoveDir());
			}
			rafId = requestAnimationFrame(gameLoop);
		}
		rafId = requestAnimationFrame(gameLoop);

		// Tab-hidden → auto-pause; stays paused on return (resume with P).
		function onVisibility() {
			if (document.hidden && phase === 'combat') setPaused(true);
		}
		document.addEventListener('visibilitychange', onVisibility);

		// H toggles minimal mode (board + ability bar only).
		function onHudKey(e: KeyboardEvent) {
			if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
			if (e.key.toLowerCase() === 'h') hudHidden = !hudHidden;
		}
		window.addEventListener('keydown', onHudKey);

		return () => {
			cancelAnimationFrame(rafId);
			unbindInput();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('keydown', onHudKey);
			clearEvents();
		};
	});
</script>

<div class="page">
	{#if isCodexOpen}
		<CharacterCodex onclose={() => (isCodexOpen = false)} />
	{/if}

	<div
		class="arena"
		class:hud-hidden={hudHidden}
		style="{activeThemeVars}; --arena-bg: url('{selectedSkin}')"
	>
		<div class="party-row">
			<PartyRow state={gs} {now} />
		</div>

		<div class="center">
			<div class="board-col">
				<div class="hud-col">
					<div class="banner banner-ally"><UnitBanner side="ally" state={gs} {now} /></div>
					<div class="banner banner-enemy"><UnitBanner side="enemy" state={gs} {now} /></div>
				</div>
				<div class="board-wrap">
					<div class="console-name">Chessboard Battlefield</div>
					<Board bind:this={boardComponent} {gs} {now} />
					{#if gs.over && gs.outcome === 'victory'}
						<div class="overlay victory"><h1>VICTORY</h1></div>
					{/if}
					{#if gs.over && gs.outcome === 'defeat'}
						<div class="overlay defeat"><h1>DEFEAT</h1></div>
					{/if}
					{#if paused && !gs.over}
						<div class="overlay paused"><h1>PAUSED</h1></div>
					{/if}
					{#if gs.party[gs.activeSlot].stunnedUntil > now}
						<div class="overlay stun">STUNNED</div>
					{/if}
				</div>
				<AbilityBar
					state={gs}
					{now}
					onability={(slot) => {
						if (slot === 'basic') tryBasicAttack(gs, now, false);
						else tryAbility(gs, slot, now);
					}}
				/>
			</div>
		</div>

		<div class="sidebar">
			<div class="log-wrap">
				<button class="codex-btn" onclick={() => (isCodexOpen = true)}>Character Archive</button>
				<CombatLog bind:this={logComponent} />
			</div>
			<div class="keys-area">
				<div class="top-controls">
					<select bind:value={selectedEnemy} onchange={resetFight}>
						{#each Object.keys(ENEMY_OPTIONS) as key}
							<option value={key}>{ENCOUNTER_LABELS[key] ?? key}</option>
						{/each}
					</select>
					<button onclick={resetFight}>Reset</button>
					<button onclick={toSelect}>Team</button>
				</div>
				<div class="keys-grid">
					<kbd>WASD</kbd><span>Move</span>
					<kbd>↑↓←→</kbd><span>Move</span>
					<kbd>Spc</kbd><span>Basic</span>
					<kbd>X C V</kbd><span>Skills</span>
					<kbd>1 2 3 ..</kbd><span>Swap</span>
					<kbd>P</kbd><span>Pause</span>
					<kbd>Z</kbd><span>Auto-look</span>
					<kbd>Shift</kbd><span>Aim</span>
					<kbd>F</kbd><span>Lock-On</span>
					<kbd>H</kbd><span>Hide HUD</span>
				</div>
			</div>
			<div class="skin-area">
				{#each SKINS as s (s.url)}
					<button
						class="skin"
						class:on={selectedSkin === s.url}
						title={s.label}
						aria-label={s.label}
						style="background-image: url('{s.url}')"
						onclick={() => (selectedSkin = s.url)}
					></button>
				{/each}
			</div>
		</div>
	</div>

	{#if phase === 'select'}
		<PartySelect
			roster={ROSTER}
			bind:selected={selectedIds}
			bind:enemyKey={selectedEnemy}
			enemyOptions={Object.keys(ENEMY_OPTIONS)}
			onbegin={beginCombat}
			onopencodex={() => (isCodexOpen = true)}
		/>
	{/if}
</div>

<style>
	.page {
		height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem;
	}

	.arena {
		width: fit-content;
		display: flex;
		column-gap: 24px;
		align-items: stretch;
		justify-content: center;
		padding: 0.75rem 2.5rem 3.5rem 2.5rem;
		border-radius: 24px;
		background-color: #415a77;
		background-image: var(--arena-bg, url('/characters/group2.png'));
		background-size: cover;
		background-position: center 60%;
		background-repeat: no-repeat;
		box-shadow:
			0 0 0px 4px rgba(0, 0, 0, 0.4) inset,
			0 -15px 0 10px rgba(0, 0, 0, 0.6) inset;
	}

	.center {
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.hud-col {
		position: relative;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		width: 100%;
		z-index: 1;
	}

	.party-row {
		margin-top: auto;
		display: flex;
		height: 100%;
	}

	.console-name {
		text-align: center;
		font-family: 'Jersey 10';
		text-transform: uppercase;
		font-weight: 600;
		font-style: italic;
		font-size: 2rem;
		letter-spacing: 2px;
		margin: 0 0 0.25rem;
		color: var(--text);
	}

	.codex-btn {
		box-sizing: border-box;
		flex: 1;
		width: 100%;
		padding: 8px 10px;
		margin-bottom: 1rem;
		background-color: var(--hp-low);
		border: 2px solid var(--panel);
		border-radius: 8px;
		cursor: pointer;
		color: var(--text);
		text-align: center;
		text-transform: uppercase;
		font-family: 'DePixel';
		position: relative;
		overflow: hidden;
		box-shadow: 0px -2px 0 2px rgba(0, 0, 0, 0.564) inset;
		transition:
			transform 0.08s,
			box-shadow 0.08s,
			background-color 0.3s,
			border-color 0.15s;
		&:hover {
			transform: translateY(2px);
			box-shadow: 0px -2px 0 0px rgba(0, 0, 0, 0.564) inset;
		}
	}

	/* ─── Left column: board + abilities ─────────────── */
	.board-col {
		grid-column: 2;
		justify-self: center;
		display: flex;
		flex-direction: column;
		width: min-content;
		gap: 8px;
	}
	.board-wrap {
		background-color: var(--panel-raised);
		padding: 0.5rem 1.5rem 2rem 1.5rem;
		border-radius: 18px;
		box-shadow:
			0 0 0px 4px rgba(0, 0, 0, 0.4) inset,
			0 -8px 0 8px rgba(0, 0, 0, 0.37) inset;
	}

	/* ─── Right column ────────────────────────────────── */
	.sidebar {
		grid-column: 3;
		align-self: flex-end;
		width: 300px;
		height: fit-content;
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
		padding: 8px;
		margin-top: 4rem;
		background: var(--panel);
		border: 3px solid var(--panel-raised);
		border-radius: 8px;
	}
	.top-controls {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.top-controls select,
	.top-controls button {
		background: var(--panel-raised);
		border: 1px solid #000000a0;
		color: var(--text);
		padding: 3px 6px;
		font-size: 12px;
		font-weight: 600;
		font-family: 'Andale Mono';
		cursor: pointer;
		border-radius: 4px;
	}
	.top-controls button:hover {
		border-color: var(--gold);
		color: var(--gold);
	}
	.keys-grid {
		display: grid;
		grid-template-columns: auto 1fr auto 1fr;
		gap: 4px 8px;
		align-items: center;
	}
	.keys-grid kbd {
		background: var(--panel-2);
		border: 1px solid #00000056;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 600;
		font-family: 'Andale Mono';
		text-align: center;
		box-shadow: 0 1px 1px 1px #00000056;
	}
	.keys-grid span {
		color: var(--text-dim);
		font-size: 10px;
		font-family: 'Andale Mono';
	}

	/* ─── Skin selector ───────────────────────────────── */
	.skin-area {
		display: flex;
		gap: 6px;
		padding: 6px;
		background: var(--panel);
		border: 3px solid var(--panel-raised);
		border-radius: 8px;
	}
	.skin {
		flex: 1;
		height: 34px;
		padding: 0;
		border: 2px solid #00000080;
		border-radius: 6px;
		background-size: cover;
		background-position: center;
		cursor: pointer;
		opacity: 0.6;
		box-shadow: 0 1px 2px 1px #00000056;
		transition:
			opacity 0.15s,
			border-color 0.15s,
			transform 0.1s;
	}
	.skin:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}
	.skin.on {
		opacity: 1;
		border-color: var(--gold);
		box-shadow: 0 0 8px -1px var(--gold);
	}

	/* ─── Minimal mode (H) ────────────────────────────── */
	.arena.hud-hidden .hud-col,
	.arena.hud-hidden .party-row,
	.arena.hud-hidden .sidebar {
		display: none;
	}

	/* ─── Overlays ────────────────────────────────────── */
	.overlay {
		position: absolute;
		inset: 0;
		margin: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		border-radius: 8px;
		width: 200px;
		height: 150px;
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
	.overlay.paused {
		inset: 0;
		background: rgba(10, 7, 16, 0.8);
		z-index: 120;
	}
	.overlay.paused h1 {
		color: var(--gold);
		font-size: 28px;
		letter-spacing: 6px;
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

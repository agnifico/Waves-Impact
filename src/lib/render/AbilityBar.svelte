<script lang="ts">
	import type { EngineState } from '$lib/types/state';
	import { holdState, isDown } from '$lib/input/intent-state';

	let { state, now }: { state: EngineState; now: number } = $props();

	// Per-element ability-bar palette (monochrome depth stays in CSS; only hue swaps)
	const AB: Record<
    string,
    { panel: string; btn: string; border: string; text: string; key: string }
> = {
    water: {
        panel: '#0f4c81',   // Deep ocean blue
        btn: '#1da1f2',     // Sky/cyan blue
        border: '#6be9e3',  // Vibrant sky teal
        text: 'rgba(0,0,0,0.6)',
        key: '#f3fbff'
    },
    wind: {
        panel: '#2a6f6d',   // Deep teal/breeze
        btn: '#48cae4',     // Bright sky wind
        border: '#a8e0ec',  // Soft aerodynamic cyan
        text: 'rgba(0,0,0,0.6)',
        key: '#f0fbfc'
    },
    fire: {
        panel: '#9c3a1f',
        btn: '#d8632f',
        border: '#f0a06b',
        text: 'rgba(0,0,0,0.6)',
        key: '#fff3ec'
    },
    nature: {
        panel: '#1f7a3a',
        btn: '#3fb95a',
        border: '#86e89a',
        text: 'rgba(0,0,0,0.6)',
        key: '#f0fff4'
    },
    light: {
        panel: '#b58612',   // Rich golden amber
        btn: '#fbbf24',     // Golden yellow
        border: '#fef08a',  // Radiant light yellow
        text: 'rgba(0,0,0,0.6)',
        key: '#fefce8'
    },
    dark: {
        panel: '#4c1d95',   // Deep obsidian purple
        btn: '#7c3aed',     // Royal violet
        border: '#c084fc',  // Vivid neon lavender
        text: 'rgba(255,255,255,0.8)', // Lightened text for dark-mode readability
        key: '#faf5ff'
    }
};

	let char = $derived(state.party[state.activeSlot]);
	let pal = $derived(AB[char.def.element] ?? AB.nature);
	let abStyle = $derived(
		`--ab-panel:${pal.panel};--ab-btn:${pal.btn};--ab-btn-border:${pal.border};--ab-text:${pal.text};--ab-key:${pal.key};`
	);
	let basicName = $derived(
		char.def.contextualBasic?.base.name ?? char.def.basicChain?.[0]?.name ?? 'Basic'
	);
	let chainActive = $derived(
		char.def.basicChain &&
			char.baChainIndex > 0 &&
			now - char.lastBaTimestamp < char.def.baChainResetMs
	);
</script>

<div class="ability-bar" style={abStyle}>
	<button
		class="ability-btn basic"
		class:chain-ready={chainActive}
		class:pressed={isDown('basicAttack')}
	>
		<span class="ability-info">
			<span class="ability-name">{basicName}</span>
			<span class="ability-meta"><span class="tag basic">Basic</span></span>
		</span>
		<span class="key-badge">Spc</span>
	</button>

	{#each ['X', 'C', 'V'] as slot}
		{@const ability = char.def.abilities[slot as 'X' | 'C' | 'V']}
		{#if ability}
			{@const cdLeft = Math.max(0, (char.cooldowns[slot as 'X' | 'C' | 'V'] ?? 0) - now)}
			{@const cost = ability.energyCost ?? 0}
			{@const noEnergy = cost > 0 && char.energy < cost}
			{@const isUlt = slot === 'V'}
			{@const canHold = (ability.chargeMsPerTile ?? 0) > 0 || (ability.chargeMaxRange ?? 0) > 0}
			{@const maxCharges = ability.charges ?? 1}
			{@const charge = char.charges?.[slot as 'X' | 'C' | 'V']}
			{@const rechargeMs = ability.rechargeMs ?? ability.cooldownMs ?? 0}
			{@const recovered =
				charge &&
				charge.count < maxCharges &&
				rechargeMs > 0 &&
				charge.rechargeAt &&
				now >= charge.rechargeAt
					? 1 + Math.floor((now - charge.rechargeAt) / rechargeMs)
					: 0}
			{@const chargesLeft = charge ? Math.min(maxCharges, charge.count + recovered) : maxCharges}
			{@const hasCharges = maxCharges > 1}
			{@const onCd = hasCharges ? chargesLeft === 0 : cdLeft > 0}
			{@const isPressed = isDown('ability' + slot) || holdState.holdingSlot === slot}
			<button
				class="ability-btn"
				class:ult={isUlt}
				class:on-cooldown={onCd || noEnergy}
				class:pressed={isPressed}
			>
				<span class="ability-info">
					<span class="ability-name">{ability.name}</span>
					<span class="ability-meta">
						{#if isUlt}<span class="tag ult">Ult</span>{/if}
						{#if cost > 0}<span class="tag cost">{cost} EN</span>{/if}
						{#if canHold}<span class="tag hold">Hold</span>{/if}
						{#if hasCharges}
							<span class="charge-pips">
								{#each { length: maxCharges } as _, i}
									<span class="pip" class:filled={i < chargesLeft}></span>
								{/each}
							</span>
						{/if}
					</span>
				</span>
				<span class="key-badge">{slot}</span>
				{#if cdLeft > 100 && (!hasCharges || chargesLeft === 0)}
					<span class="cd-sweep"><span class="cd-text">{(cdLeft / 1000).toFixed(1)}</span></span>
				{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.ability-bar {
		display: flex;
		gap: 8px;
		width: 100%;
		padding: 10px 12px 18px;
		background-color: var(--ab-panel);
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-radius: 12px;
		border: none;
		box-shadow:
			0 0 0 2px rgba(0, 0, 0, 0.4) inset,
			0 -5px 0 2px rgba(0, 0, 0, 0.37) inset;
		transition: background-color 0.3s;
	}
	.ability-btn {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		background-color: var(--ab-btn);
		border: 2px solid var(--ab-btn-border);
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		color: var(--text);
		text-align: left;
		position: relative;
		overflow: hidden;
		box-shadow: var(--btn-shadow);
		transform: translateY(0);
		transition:
			transform 0.08s,
			box-shadow 0.08s,
			background-color 0.3s,
			border-color 0.15s;
	}
	.ability-btn:active,
	.ability-btn.pressed {
		transform: translateY(2px);
		box-shadow: var(--btn-shadow-pressed);
	}
	.ability-btn.ult {
		border-color: #fff;
		box-shadow:
			var(--btn-shadow),
			0 0 14px -2px var(--char-glow, var(--ab-btn-border));
	}
	.ability-btn.on-cooldown {
		opacity: 0.5;
		box-shadow: var(--btn-shadow-disabled);
	}
	.ability-btn.chain-ready {
		border-color: var(--gold-bright);
	}

	.ability-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.ability-name {
		font-family: 'Rubik', 'JetBrains Mono', sans-serif;
		font-style: italic;
		font-weight: 600;
		font-size: 0.9rem;
		line-height: 1;
		color: var(--ab-text);
		white-space: nowrap;
		overflow: hidden;
		width: 13ch;
		text-overflow: ellipsis;
	}
	.ability-meta {
		display: flex;
		gap: 5px;
		align-items: center;
	}
	.tag {
		font-family: 'JetBrains Mono', monospace;
		font-size: 8px;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		font-weight: 700;
		padding: 2px 5px;
		border-radius: 4px;
		white-space: nowrap;
		background: rgba(0, 0, 0, 0.32);
		color: rgba(255, 255, 255, 0.82);
	}
	.tag.cost {
		background: rgba(0, 0, 0, 0.45);
		color: var(--energy-bright, #ffc56e);
	}
	.tag.hold {
		background: rgba(0, 0, 0, 0.3);
		color: #fff;
	}
	.tag.ult {
		background: rgba(255, 255, 255, 0.9);
		color: #111;
	}
	.tag.basic {
		background: rgba(0, 0, 0, 0.3);
		color: rgba(255, 255, 255, 0.9);
	}

	.key-badge {
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		background: rgba(0, 0, 0, 0.5);
		border: 2px solid rgba(0, 0, 0, 0.25);
		border-radius: 7px;
		display: grid;
		place-items: center;
		font-family: 'Silkscreen', 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		text-transform: uppercase;
		color: var(--ab-key, #fff);
		box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.18);
	}
	.cd-sweep {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: grid;
		place-items: center;
		pointer-events: none;
	}
	.cd-text {
		font-family: 'Silkscreen', monospace;
		font-size: 13px;
		color: #fff;
		text-shadow: 0 1px 3px #000;
	}

	.charge-pips {
		display: flex;
		gap: 3px;
		align-items: center;
	}
	.charge-pips .pip {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.4);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
	}
	.charge-pips .pip.filled {
		background: var(--ab-key, #fff);
		box-shadow: 0 0 5px var(--ab-btn-border);
	}
</style>

<script lang="ts">
	import type { EngineState, CharacterState } from '$lib/types/state';
	import HPBar from './HPBar.svelte';
	import EnemyBanner from './EnemyBanner.svelte';

	let {
		state,
		now,
		side = 'ally',
		ultPct: ultPctProp = undefined
	}: {
		state: EngineState;
		now: number;
		side?: 'ally' | 'enemy';
		/** 0–100 charge toward the V / ultimate. If omitted, falls back to energy %. */
		ultPct?: number;
	} = $props();

	const clamp = (v: number) => Math.max(0, Math.min(100, v));

	const ELEMENT_COLOR: Record<string, string> = {
		water: 'var(--frost)',
		wind: 'var(--verdant)',
		fire: 'var(--coral)',
		nature: '#a07050',
		light: 'var(--gold-bright)',
		dark: '#9a7bd0',
		normal: 'var(--gold)'
	};

	// translucent bg + border colour for an element tag
	function tagTint(el: string) {
		return ELEMENT_COLOR[el] ?? 'var(--gold)';
	}

	// active-effect chips (everything except shield, which renders next to HP)
	const EFFECT_META: Record<string, { color: string; label: string }> = {
		unchained: { color: 'var(--unchained, #f59433)', label: 'Unchained' },
		bloomstride: { color: 'var(--bloomstride, #56c069)', label: 'Bloomstride' }
	};

	let ally = $derived(side === 'ally' ? (state.party[state.activeSlot] as CharacterState) : null);

	let shield = $derived(ally?.activeEffects?.['shield']);
	let hasShield = $derived(!!shield);
	let shieldAmt = $derived(Math.round(shield?.absorbRemaining ?? 0));

	let hpPct = $derived(ally ? clamp((100 * ally.hp) / ally.def.maxHp) : 0);
	let low = $derived(hpPct < 30);

	let element = $derived(ally?.def.element ?? 'normal');
	// extra type tags (e.g. FLYING) if the def carries them; primary element is always shown
	let extraTags = $derived(((ally?.def as any)?.tags as string[] | undefined) ?? []);

	// stack pip label is character-specific (e.g. FLAME for Maria); optional.
	let stackLabel = $derived((ally?.def as any)?.stackLabel as string | undefined);

	// V / ultimate ring. Prefer the prop, then any explicit charge field, else energy %.
	let ultPct = $derived.by(() => {
		if (ultPctProp != null) return clamp(ultPctProp);
		if (!ally) return 0;
		const a = ally as unknown as Record<string, number | undefined>;
		const raw = a.ultCharge ?? a.ult ?? a.vCharge;
		if (raw != null) return clamp(raw <= 1 ? raw * 100 : raw);
		// fallback — swap this for your real V-charge source
		return clamp((100 * ally.energy) / ally.def.maxEnergy);
	});
	let ultReady = $derived(ultPct >= 99.5);

	let pipShape = $derived(ally?.def.theme?.pip?.shape ?? '');

	let effectChips = $derived.by(() => {
		if (!ally) return [];
		return Object.entries(ally.activeEffects ?? {})
			.filter(([k]) => k !== 'shield')
			.map(([key, eff]) => {
				const meta = EFFECT_META[key] ?? { color: 'var(--gold)', label: key };
				const expiresAt = (eff as any)?.expiresAt ?? 0;
				const rem = expiresAt > 0 ? `${Math.ceil((expiresAt - now) / 1000)}s` : '';
				return { key, color: meta.color, label: meta.label, rem };
			});
	});
</script>

{#if side === 'enemy'}
	<EnemyBanner {state} {now} />
{:else if ally}
	<div
		class="ally-banner"
		class:low
		style="--ult-deg:{(ultPct / 100) * 360}deg"
		role="group"
		aria-label="{ally.def.name} status"
	>
		<!-- portrait + V ring -->
		<div class="portrait-wrap" class:ready={ultReady}>
			<div class="ult-ring"></div>
			<div class="portrait">
				{#if ally.def.art?.gem || ally.def.profileImage}
					<img class="ally-img" src={ally.def.art?.gem ?? ally.def.profileImage} alt="" />
				{/if}
			</div>
			<span class="ult-badge">{Math.round(ultPct)}%</span>
			<!-- <span class="ult-badge">{element.toUpperCase}</span> -->
		</div>

		<div class="body">
			<div class="name-row">
				<span class="name">{ally.def.name}</span>
				<span class="tag" style="--tint:{tagTint(element)}">{element}</span>
				{#each extraTags as t}
					<span class="tag tag--secondary">{t}</span>
				{/each}
			</div>

			<!-- HP + shield on one line -->
			<div class="bar-row">
				<HPBar current={ally.hp} max={ally.def.maxHp} type="hp" hpStyle={ally.def.theme?.hpStyle} />
				{#if hasShield}
					<span class="shield-pill" title="Shield">
						<svg width="9" height="10" viewBox="0 0 10 11" fill="none">
							<path
								d="M5 0.5L9 2.5V5.5C9 7.5 7 9.5 5 10.5C3 9.5 1 7.5 1 5.5V2.5L5 0.5Z"
								fill="rgba(96,210,255,.2)"
								stroke="rgba(96,210,255,.85)"
								stroke-width="1"
							/>
						</svg>
						{shieldAmt}
					</span>
				{/if}
			</div>

			<!-- thin energy bar -->
			<!-- <HPBar current={ally.energy} max={ally.def.maxEnergy} type="energy" /> -->

			<!-- pips (#2 diamonds) + compact effect chips -->
			<div class="resource-row">
				<div class="pips" title="Stacks">
					{#if stackLabel}<span class="pip-label">{stackLabel}</span>{/if}
					{#each { length: ally.def.stackMax } as _, i}
						<span
							class="pip"
							class:pip-crystal={pipShape === 'crystal'}
							class:pip-circuit={pipShape === 'circuit'}
							class:filled={i < ally.stacks.current}
						></span>
					{/each}
					<span class="pip-count">{ally.stacks.current}/{ally.def.stackMax}</span>
				</div>

				<div class="chips">
					{#each effectChips as fx (fx.key)}
						<span class="fx" style="--fx:{fx.color}" title={fx.label}>
							<svg class="fx-arrow" viewBox="0 0 8 8"
								><path d="M4 1 L7 5 L1 5 Z" fill="currentColor" /></svg
							>
							{#if fx.rem}<span class="fx-time">{fx.rem}</span>{/if}
						</span>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Ally is bounded: a glassy pill tinted with the character's primary/secondary. */
	.ally-banner {
		position: relative;
		display: flex;
		align-items: center;
		gap: 14px;
		width: max(300px, 100%);
		padding: 11px 11px 20px 11px;
		border-radius: 9px;
		background:
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--char-primary) 100%, transparent),
				transparent 35%
			),
			linear-gradient(
				315deg,
				color-mix(in srgb, var(--char-secondary) 100%, transparent),
				transparent 35%
			);
		/* backdrop-filter: blur(10px); */
		/* -webkit-backdrop-filter: blur(10px); */
		/* border: 4px solid rgba(0, 0, 0, .5) ; */
		background-color: #202020;
		box-shadow: 0px -6px 0 3px rgba(0, 0, 0, .5) inset,  0px 3px 0 0px rgba(0, 0, 0, .5) inset;
	}

	/* portrait disc wrapped by the V-charge ring (conic fill = how close to ult) */
	.portrait-wrap {
		position: relative;
		flex-shrink: 0;
		width: 72px;
		height: 72px;
	}
	.ult-ring {
		position: absolute;
		inset: 0;
		border-radius: 12px;
		padding: 5px;
		scale: 1.1;
		background: conic-gradient(
			from -90deg,
			var(--char-primary, var(--coral)) 0deg,
			var(--char-glow, var(--gold-bright)) var(--ult-deg),
			rgba(255, 255, 255, 0.08) var(--ult-deg)
		);
		box-shadow: 0 0 12px color-mix(in srgb, var(--char-primary, var(--coral)) 45%, transparent);
	}
	.portrait-wrap.ready .ult-ring {
		animation: ringPulse 1.1s ease-in-out infinite;
	}
	.portrait {
		width: 100%;
		height: 100%;
		position: absolute;
		/* inset: 5px; */
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid rgba(13, 20, 28, 0.92);
		background: color-mix(in srgb, var(--char-primary, var(--coral)) 35%, #0c1019);
		box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.25);
	}
	.portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.ult-badge {
		position: absolute;
		bottom: -4px;
		/* left: 50%; */
		left: 14px;
		transform: translateX(-50%);
		font-family: 'DePixel';
		font-size: 8px;
		letter-spacing: 0.5px;
		color: #1a120c;
		background: linear-gradient(
			180deg,
			var(--char-glow, var(--gold-bright)),
			var(--char-primary, var(--coral))
		);
		background: color-mix(in srgb, var(--char-primary) 70%, black);
		/* font-weight: 600; */
		color: var(--text);
		border-radius: 8px;
		padding: 3px 7px 0;
		white-space: nowrap;
		/* box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55); */
	}

	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.name {
		font-family: 'DePixel';
		font-style: italic;
		/* font-weight: 600; */
		font-size: 14px;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: #f2f5fa;
		white-space: nowrap;
	}
	.tag {
		font-family: var(--font-family-pixel);
		font-size: 8px;
		letter-spacing: 1px;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 20px;
		white-space: nowrap;
		color: color-mix(in srgb, var(--tint, var(--gold)) 70%, white);
		background: color-mix(in srgb, var(--tint, var(--gold)) 16%, transparent);
		border: 1px solid color-mix(in srgb, var(--tint, var(--gold)) 45%, transparent);
	}
	.tag--secondary {
		--tint: #60a0ff;
	}

	.bar-row {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.shield-pill {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		flex-shrink: 0;
		font-family: var(--font-family-pixel);
		font-size: 9px;
		color: #bfeeff;
		background: rgba(96, 210, 255, 0.14);
		border: 1px solid rgba(96, 210, 255, 0.45);
		border-radius: 7px;
		padding: 2px 6px;
	}

	.resource-row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		min-height: 16px;
	}
	.pips {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.pip-label {
		font-family: var(--font-family-pixel);
		font-size: 8px;
		letter-spacing: 1px;
		color: color-mix(in srgb, var(--char-secondary, var(--gold)) 60%, white);
		margin-right: 1px;
	}
	.pip {
		width: 9px;
		height: 9px;
		transform: rotate(45deg);
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.05);
		box-shadow: inset 0 0 0 1px
			color-mix(in srgb, var(--char-secondary, var(--gold)) 45%, transparent);
		transition: all 0.2s;
	}
	.pip.filled {
		background: linear-gradient(
			135deg,
			var(--char-glow, var(--gold-bright)),
			var(--char-primary, var(--coral))
		);
		box-shadow: 0 0 6px color-mix(in srgb, var(--char-primary, var(--coral)) 80%, transparent);
	}
	.pip-count {
		font-family: var(--font-family-pixel);
		font-size: 8.5px;
		color: color-mix(in srgb, var(--char-glow, var(--gold-bright)) 75%, white);
		margin-left: 2px;
	}

	.chips {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-left: auto;
	}
	/* compact buff: arrow + colour + time remaining (no long label) */
	.fx {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 6px;
		border-radius: 20px;
		font-family: var(--font-family-pixel);
		font-size: 8.5px;
		color: color-mix(in srgb, var(--fx) 55%, white);
		background: color-mix(in srgb, var(--fx) 22%, transparent);
		border: 1px solid color-mix(in srgb, var(--fx) 50%, transparent);
	}
	.fx-arrow {
		width: 7px;
		height: 7px;
		color: var(--fx);
	}
	.fx-time {
		font-feature-settings: 'tnum';
	}

	/* ── Frostbite (tall-diamond ice shard pips) ───────────────────── */
	.pip.pip-crystal {
		width: 16px;
		height: 26px;
		transform: none;
		border-radius: 0;
		clip-path: polygon(50% 0, 78% 50%, 50% 100%, 22% 50%);
		background: radial-gradient(circle at 50% 32%, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.3));
		box-shadow: none;
	}
	.pip.pip-crystal.filled {
		background: linear-gradient(160deg, #eaffff, #7ad4ff 50%, #2f7fd6);
		box-shadow: none;
		filter: drop-shadow(0 0 5px rgba(122, 212, 255, 0.85));
		animation: crystalGlow 2.6s ease-in-out infinite;
	}

	/* ── Circuit (vertical power-cell pips) ─────────────────────────── */
	.pip.pip-circuit {
		width: 14px;
		height: 24px;
		transform: none;
		border-radius: 3px;
		background: radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.34));
		box-shadow: inset 0 0 0 1px
			color-mix(in srgb, var(--char-pip-color, var(--char-primary)) 40%, transparent);
	}
	.pip.pip-circuit.filled {
		background: linear-gradient(180deg, #caff7a, #6fd83e 55%, #3f9e2a);
		box-shadow: none;
		filter: drop-shadow(0 0 5px rgba(111, 216, 62, 0.8));
		animation: circuitGlow 2s ease-in-out infinite;
	}

	@keyframes crystalGlow {
		0%, 100% { filter: drop-shadow(0 0 4px rgba(122, 212, 255, 0.7)); }
		50%       { filter: drop-shadow(0 0 9px rgba(122, 212, 255, 1)); }
	}
	@keyframes circuitGlow {
		0%, 100% { filter: drop-shadow(0 0 4px rgba(111, 216, 62, 0.7)); }
		50%       { filter: drop-shadow(0 0 9px rgba(111, 216, 62, 1)); }
	}

	@keyframes ringPulse {
		0%,
		100% {
			box-shadow: 0 0 10px color-mix(in srgb, var(--char-primary, var(--coral)) 45%, transparent);
		}
		50% {
			box-shadow: 0 0 18px color-mix(in srgb, var(--char-primary, var(--coral)) 80%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.portrait-wrap.ready .ult-ring {
			animation: none;
		}
	}
</style>

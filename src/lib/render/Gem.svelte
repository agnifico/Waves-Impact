<script lang="ts">
	import type { CharacterState, EnemyState, SummonState, ConstructState } from '$lib/types/state';

	type GemType = 'player' | 'enemy' | 'summon' | 'construct';
	let {
		type,
		character = null,
		enemy = null,
		summon = null,
		construct = null,
		locked = false,
		now = 0,
		party = []
	}: {
		type: GemType;
		character?: CharacterState | null;
		enemy?: EnemyState | null;
		summon?: SummonState | null;
		construct?: ConstructState | null;
		locked?: boolean;
		now?: number;
		party?: CharacterState[];
	} = $props();

	let hasShield = $derived(type === 'player' && !!character?.activeEffects?.['shield']);
	// Marked-enemy bracket: if this enemy carries a 'thread' mark, show corner brackets
	// in the marking character's primary colour. (source = who applied the mark.)
	let markColor = $derived.by(() => {
		if (type !== 'enemy' || !enemy?.activeEffects?.['thread']) return null;
		const src = party.find((p) => p.id === enemy.activeEffects['thread'].source);
		return src?.def.theme?.primary ?? 'var(--gold)';
	});
	// Enemy attack wind-up: style + lunge direction (enemies lunge TOWARD the player,
	// i.e. along their facing — opposite of the player's pull-back-from-facing).
	let enemyWindUp = $derived.by(() => {
		if (type !== 'enemy' || !enemy?.pendingAttack) return null;
		const style = enemy.pendingAttack.windUpStyle ?? 'charge';
		// const motion = style === 'melee' || style === 'pistol' || style === 'ranged' || style === 'bow';
		const motion = style !== 'charge';
		return { style, motion };
	});
	let enemyWindUpVars = $derived.by(() => {
		if (!enemyWindUp?.motion || !enemy?.pendingAttack) return '';
		const dx = enemy.pendingAttack.dirX ?? 0;
		const dy = enemy.pendingAttack.dirY ?? 1;
		const mag = 8;
		// lunge toward the target: small anticipation pull-back, then strike toward player
		return `--pull-x:${-dx * 4}px;--pull-y:${-dy * 4}px;--push-x:${dx * mag}px;--push-y:${dy * mag}px;`;
	});
	// Wind-up: gem charges while a committed cast OR basic-attack swing is pending.
	let windingUp = $derived(type === 'player' && (!!character?.pendingCast || !!character?.pendingBasic));
	// Which fx-wu-* variant + how long. Abilities read the pending ability's delivery;
	// BA wind-ups read the deferred basic's delivery (rhythmic swing telegraph).
	let windUp = $derived.by(() => {
		if (type !== 'player' || !character) return null;
		let d: { windUpStyle?: string; windUpMs?: number } | undefined;
		if (character.pendingCast) {
			d = character.def.abilities?.[character.pendingCast.slot]?.delivery;
		} else if (character.pendingBasic) {
			d = (character.pendingBasic.ba as { delivery?: { windUpStyle?: string; windUpMs?: number } })?.delivery;
		} else {
			return null;
		}
		const style = d?.windUpStyle ?? 'charge';
		// melee/pistol/ranged/bow animate the BODY (recoil/pull-back); charge/fire are OVERLAY visuals.
		// const motion = style === 'melee' || style === 'pistol' || style === 'ranged' || style === 'bow';
		const motion = style !== 'charge';
		return { style, motion, ms: d?.windUpMs ?? 500 };
	});
	// Recoil direction for body wind-ups. Prefer the stored direction toward the
	// actual target (set at defer time) so omni/auto-target attacks point correctly;
	// fall back to facing only when no target direction was captured.
	let windUpVars = $derived.by(() => {
		if (!windUp?.motion || !character) return '';
		const pb = character.pendingBasic;
		let dx: number, dy: number;
		if (pb && (pb.dirX !== undefined || pb.dirY !== undefined)) {
			dx = pb.dirX ?? 0;
			dy = pb.dirY ?? 0;
		} else {
			const f = character.facing ?? { x: 0, y: -1 };
			dx = f.x; dy = f.y;
		}
		const mag = 7;
		return `--pull-x:${-dx * mag}px;--pull-y:${-dy * mag}px;--push-x:${dx * mag}px;--push-y:${dy * mag}px;--cd:${windUp.ms}ms;`;
	});
	// Per-unit signature ambient FX class (theme.signatureFx), applied to the player gem.
	let signature = $derived(type === 'player' ? (character?.def.theme?.signatureFx ?? '') : '');

	const ELEMENT_COLOR: Record<string, string> = {
		water: 'var(--frost)',
		wind: 'var(--wind)',
		fire: 'var(--coral)',
		nature: 'var(--verdant)',
		light: 'var(--gold-bright)',
		dark: '#9a7bd0',
		normal: 'var(--gold)'
	};
	const rimOf = (el: string) => ELEMENT_COLOR[el] ?? 'var(--gold)';
	const facingDeg = (f: { x: number; y: number }) => (Math.atan2(f.x, -f.y) * 180) / Math.PI;

	let hit = $state(false);
	export function flash() {
		hit = true;
		setTimeout(() => (hit = false), 300);
	}
</script>

{#if type === 'player' && character}
	{@const rim = rimOf(character.def.element)}
	{@const img = character.def.art?.gem}
	{@const lift = character.stratum === 'flying' ? -10 : 0}
	<div class="gem-root" class:hit class:winding-up={windingUp} class:{signature}>
		<div class="shadow" class:swimming={character.stratum === 'swimming'}></div>
		<div
			class="body square {windUp?.motion ? `fx-wu-${windUp.style}` : ''}"
			style="border:none; transform:translateY({lift}px); {windUp?.motion ? windUpVars : ''} {img
				? `background-image:url(${img});`
				: `background-color:${rim};`}"
		>
			{#if !img}<span class="glyph">◆</span>{/if}
		</div>
		<div
			class="facing"
			style="transform:translateY({lift}px) rotate({facingDeg(character.facing)}deg);"
		>
			<svg viewBox="-18 -18 36 36"
				><path
					d="M0 -28 L8 -16 L0 -19 L-8 -16 Z"
					fill="var(--char-primary)"
					stroke="var(--char-primary)"
					stroke-width="0.75"
					stroke-linejoin="round"
				/></svg
			>
		</div>
		{#if hasShield}
			<div class="shield-ring" style="transform:translateY({lift}px)"></div>
		{/if}
		{#if windingUp && windUp && !windUp.motion}
			{#key character.pendingCast?.firesAt ?? character.pendingBasic?.firesAt}
				<div
					class="fx-wu-{windUp.style}"
					style="left:50%;top:50%;--c:var(--char-primary);--c2:var(--char-secondary);--cd:{windUp.ms}ms;"
				></div>
			{/key}
		{/if}
	</div>
{:else if type === 'enemy' && enemy}
	{@const rim = rimOf(enemy.def.element)}
	{@const hpPct = Math.max(0, (100 * enemy.hp) / enemy.def.maxHp)}
	{@const lift = enemy.stratum === 'flying' ? -5 : 0}
	<div class="gem-root" class:hit class:locked class:stunned={enemy.stunnedUntil > now} class:enemy-winding={!!enemy.pendingAttack && !enemyWindUp?.motion}>
		<div class="shadow"></div>
		{#if enemy.pendingAttack && (!enemyWindUp || !enemyWindUp.motion)}
			<div class="enemy-windup-ring" style="--ewc:{rim};"></div>
		{/if}
		{#if markColor}
			<div class="mark-frame" style="--mc:{markColor};">
				<span class="mc tl"></span><span class="mc tr"></span>
				<span class="mc bl"></span><span class="mc br"></span>
			</div>
		{/if}
		<div
			class="body square {enemyWindUp?.motion ? `fx-wu-${enemyWindUp.style}` : ''}"
			style="background-image: url({enemy?.def?.profileImage}); border: none; {enemyWindUp?.motion ? enemyWindUpVars : ''}"
		></div>
		<!-- <div
			class="facing"
			style="transform:translateY({lift}px) rotate({facingDeg(enemy.facing)}deg);"
		>
			<svg viewBox="-18 -18 36 36"
				><path
					d="M0 -28 L8 -16 L0 -19 L-8 -16 Z"
					fill="var(--char-primary)"
					stroke="var(--char-primary)"
					stroke-width="0.75"
					stroke-linejoin="round"
				/></svg
			>
		</div> -->
		{#if locked}
			<div class="nameplate">
				<div class="np-bar"><i style="width:{hpPct}%; background:{rim};"></i></div>
			</div>
		{/if}
	</div>
{:else if type === 'summon' && summon}
	{@const img = summon.profileImage}
	<div class="gem-root">
		<div class="shadow"></div>
		<div
			class="body summon square"
			style="border: none; {img
				? `background-image:url(${img});`
				: `background-color:var(--wolf);`}"
		>
			{#if !img}<span class="glyph">♦</span>{/if}
		</div>
		<div class="nameplate"><span class="np-label">{summon.name ?? summon.defId}</span></div>
	</div>
{:else if type === 'construct' && construct}
	{@const img = construct.profileImage}
	{@const elColor = ELEMENT_COLOR[construct.element ?? ''] ?? 'var(--gold)'}
	<div class="gem-root construct-root" style="--cel:{elColor}">
		<div class="construct-shadow"></div>
		<div class="construct-body square" style={img ? `background-image:url(${img});` : ''}>
			{#if !img}<span class="construct-glyph">◼</span>{/if}
		</div>
	</div>
{/if}

<style>
	/* ── Base gem ───────────────────────────────────────────────────────────── */
	.gem-root {
		position: absolute;
		inset: 0;
		z-index: 6;
		pointer-events: none;
	}
	.gem-root.hit {
		animation: hit-shake 0.3s;
	}
	.gem-root.winding-up .body {
		filter: brightness(1.25);
		transition: filter 0.15s ease-in;
	}
	.gem-root.stunned .body {
		animation: stunned-pulse 0.6s infinite;
	}

	.shadow {
		position: absolute;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: 22px;
		height: 6px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.9);
	}
	.shadow.swimming {
		top: 0;
		bottom: auto;
		transform: translateX(-50%) translateY(-32px);
		z-index: 99;
		background: rgba(255, 255, 255, 0.9);
	}

	.body {
		position: absolute;
		top: 40%;
		left: 40%;
		width: 32px;
		height: 32px;
		margin: -13px 0 0 -13px;
		border: 2px solid var(--gold);
		border-radius: 99px;
		background-size: 150%;
		background-position: center;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.12s;
	}
	.gem-root.locked .body {
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.45),
			0 0 0 3px var(--coral),
			0 0 12px rgba(240, 113, 103, 0.55);
	}
	.glyph {
		font-size: 14px;
		font-weight: bold;
		color: var(--bg);
	}

	.facing {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 7;
		transform-origin: center;
	}
	.facing svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	/* ── Enemy attack wind-up telegraph ───────────────────────────────────────── */
	.enemy-windup-ring {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 40px;
		height: 40px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		border: 2px solid var(--ewc, #ff5a5a);
		box-shadow: 0 0 10px var(--ewc, #ff5a5a), inset 0 0 8px var(--ewc, #ff5a5a);
		opacity: 0;
		pointer-events: none;
		z-index: 8;
		animation: enemy-windup 0.45s ease-in infinite;
	}
	@keyframes enemy-windup {
		0% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
		70% { opacity: 0.9; transform: translate(-50%, -50%) scale(1); }
		100% { opacity: 0.4; transform: translate(-50%, -50%) scale(0.92); }
	}
	.gem-root.enemy-winding .body {
		animation: enemy-tell 0.4s ease-in-out infinite;
	}
	@keyframes enemy-tell {
		0%, 100% { filter: brightness(1); }
		60% { filter: brightness(1.5) saturate(1.3); }
	}

	/* ── Marked-enemy corner brackets (Carla's thread, etc.) ──────────────────── */
	.mark-frame {
		position: absolute;
		inset: 2px;
		pointer-events: none;
		z-index: 7;
		animation: mark-pulse 1.6s ease-in-out infinite;
	}
	.mark-frame .mc {
		position: absolute;
		width: 8px;
		height: 8px;
		border: 2px solid var(--mc);
		filter: drop-shadow(0 0 3px var(--mc));
	}
	.mark-frame .tl { top: 0; left: 0; border-right: none; border-bottom: none; }
	.mark-frame .tr { top: 0; right: 0; border-left: none; border-bottom: none; }
	.mark-frame .bl { bottom: 0; left: 0; border-right: none; border-top: none; }
	.mark-frame .br { bottom: 0; right: 0; border-left: none; border-top: none; }
	@keyframes mark-pulse {
		0%, 100% { opacity: 0.7; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.06); }
	}

	/* ── Shield ring ────────────────────────────────────────────────────────── */
	.shield-ring {
		position: absolute;
		top: 40%;
		left: 40%;
		width: 44px;
		height: 44px;
		margin: -19px 0 0 -19px;
		border-radius: 50%;
		border: 1.5px solid rgba(96, 210, 255, 0.55);
		box-shadow:
			0 0 8px rgba(96, 210, 255, 0.4),
			inset 0 0 6px rgba(96, 210, 255, 0.12);
		animation: shield-pulse 2s ease-in-out infinite;
		pointer-events: none;
	}
	@keyframes shield-pulse {
		0%,
		100% {
			opacity: 0.65;
			box-shadow:
				0 0 6px rgba(96, 210, 255, 0.3),
				inset 0 0 4px rgba(96, 210, 255, 0.1);
		}
		50% {
			opacity: 1;
			box-shadow:
				0 0 14px rgba(96, 210, 255, 0.65),
				inset 0 0 8px rgba(96, 210, 255, 0.2);
		}
	}

	/* ── Nameplate (enemy lock-on, summon label) ────────────────────────────── */
	.nameplate {
		position: absolute;
		top: -7px;
		left: 50%;
		transform: translateX(-50%);
		width: 40px;
		z-index: 8;
	}
	.np-bar {
		height: 4px;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: 1px;
		overflow: hidden;
	}
	.np-bar i {
		display: block;
		height: 100%;
		transition: width 0.2s;
	}
	.np-label {
		display: block;
		text-align: center;
		font-size: 9px;
		color: var(--text-dim);
		white-space: nowrap;
		margin-top: 1px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
	}

	/* ── Construct ──────────────────────────────────────────────────────────── */
	.construct-root {
		z-index: 5;
	}

	.construct-shadow {
		position: absolute;
		left: 50%;
		bottom: 2px;
		transform: translateX(-50%);
		width: 26px;
		height: 10px;
		background: rgba(0, 0, 0, 0.55);
		border-radius: 0 0 4px 4px;
		box-shadow:
			0 6px 0 0 rgba(0, 0, 0, 0.38),
			0 10px 0 0 rgba(0, 0, 0, 0.18),
			0 14px 0 0 rgba(0, 0, 0, 0.07);
	}

	.construct-body {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 26px;
		height: 26px;
		transform: translate(-50%, -62%);
		border-radius: 3px;
		background-color: #0d2a3a;
		background-size: cover;
		background-position: center;
		border: 1.5px solid var(--cel, var(--frost));
		box-shadow:
			0 4px 0 0 rgba(0, 0, 0, 0.7),
			0 8px 0 0 rgba(0, 0, 0, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: construct-idle 2s ease-in-out infinite;
		border: none;
		border-radius: 3px;
	}
	.construct-glyph {
		font-size: 11px;
		opacity: 0.9;
		color: var(--cel, var(--frost));
		text-shadow: 0 0 6px var(--cel, var(--frost));
	}
	@keyframes construct-idle {
		0%,
		100% {
			box-shadow:
				0 4px 0 0 rgba(0, 0, 0, 0.7),
				0 8px 0 0 rgba(0, 0, 0, 0.35),
				inset 0 1px 0 rgba(255, 255, 255, 0.18),
				0 0 0px transparent;
		}
		50% {
			box-shadow:
				0 4px 0 0 rgba(0, 0, 0, 0.7),
				0 8px 0 0 rgba(0, 0, 0, 0.35),
				inset 0 1px 0 rgba(255, 255, 255, 0.18),
				0 0 8px color-mix(in srgb, var(--cel, var(--frost)) 60%, transparent);
		}
	}

	.square {
		border-radius: 3px;
		background-size: contain;
		box-shadow: none;
	}
</style>
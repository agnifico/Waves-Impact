<script lang="ts">
	import { resolveTheme } from '$lib/render/char-theme';

	// Roster (imported directly — registry is still partial). Order = sidebar order.
	import { frosty } from '$lib/data/characters/frosty';
	import { maria_elena } from '$lib/data/characters/maria_elena';
	import { midorima } from '$lib/data/characters/midorima';
	import { ryoma } from '$lib/data/characters/ryoma';
	import { sefyra } from '$lib/data/characters/sefyra';
	import { june9 } from '$lib/data/characters/june9';
	import HPBar from './HPBar.svelte';

	interface Props {
		onclose: () => void;
	}
	let { onclose }: Props = $props();

	const allCharacters = [frosty, maria_elena, midorima, ryoma, sefyra, june9];

	let selectedCharacter = $state(allCharacters[0]);

	let activeTheme = $derived(selectedCharacter ? resolveTheme(selectedCharacter) : null);
	let abilitySlots = $derived(
		selectedCharacter?.abilities ? Object.keys(selectedCharacter.abilities) : []
	);

	let overviewText = $derived(
		selectedCharacter?.description ||
			'No database entry recorded yet for this candidate. Files are currently being decrypted.'
	);

	// ── Inline rich-text tokenizer ──────────────────────────────────────────────
	// Author description / hint strings with these tokens:
	//   <kbd>Shift</kbd>   → keycap chip
	//   <Stack>            → this character's stack name, tinted (special token)
	//   <Eclipse>, <Foo>   → any keyword, tinted to --char-primary
	//   100 DMG · 25 HP · 40 EN · 40 EP · 15% · 4 tiles · 2s  → auto stat highlight
	// Everything else renders as plain text. No {@html}, so it's injection-safe.
	type Seg = { t: 'text' | 'kbd' | 'kw' | 'stat'; v: string };
	const TOKEN_RX =
		'<kbd>([\\s\\S]*?)<\\/kbd>' + // 1: keycap
		'|<([^<>]+)>' + // 2: keyword
		'|(\\b\\d+(?:\\.\\d+)?\\s?(?:DMG|HP|EN|EP|tiles?|s)\\b|\\b\\d+(?:\\.\\d+)?%)'; // 3: stat

	function tokenize(text: string | undefined, stackName?: string): Seg[] {
		if (!text) return [];
		const out: Seg[] = [];
		const rx = new RegExp(TOKEN_RX, 'gi');
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = rx.exec(text))) {
			if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
			if (m[1] !== undefined) {
				out.push({ t: 'kbd', v: m[1].trim() });
			} else if (m[2] !== undefined) {
				const raw = m[2].trim();
				out.push({ t: 'kw', v: /^stack$/i.test(raw) ? (stackName ?? 'Stack') : raw });
			} else {
				out.push({ t: 'stat', v: m[3] });
			}
			last = m.index + m[0].length;
		}
		if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
		return out;
	}

	const secs = (ms?: number) => (ms != null ? `${ms / 1000}s` : '');

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<svelte:window onkeydown={onKey} />

<!-- Inline rich text. Kept on one line so no stray whitespace is injected between tokens. -->
{#snippet fmt(
	raw: string | undefined
)}{#each tokenize(raw, selectedCharacter?.stackName) as seg}{#if seg.t === 'kbd'}<kbd
				class="tok-kbd">{seg.v}</kbd
			>{:else if seg.t === 'kw'}<span class="tok-kw">{seg.v}</span>{:else if seg.t === 'stat'}<span
				class="tok-stat">{seg.v}</span
			>{:else}{seg.v}{/if}{/each}{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick}>
	<div
		class="codex"
		role="dialog"
		aria-modal="true"
		aria-label="{selectedCharacter?.name} archive"
		style="--char-primary: {activeTheme?.primary || 'var(--gold)'}; --char-glow: {activeTheme?.glow
			?.ready || 'var(--gold-bright)'};"
	>
		<!-- ── Sidebar ─────────────────────────────────────────────── -->
		<aside class="sidebar">
			<h2 class="sidebar-title">Archives</h2>
			<div class="roster">
				{#each allCharacters as char}
					{@const ct = resolveTheme(char)}
					<button
						class="roster-item"
						class:active={selectedCharacter?.id === char.id}
						style="--item-tint: {ct.primary}"
						onclick={() => (selectedCharacter = char)}
					>
						{#if char.art?.profile}
							<img src={char.art.profile} alt={char.name} />
						{:else}
							<div class="avatar-fallback">{char.name?.[0] ?? '?'}</div>
						{/if}
						<span class="roster-name">{char.name}</span>
					</button>
				{/each}
			</div>
		</aside>

		<!-- ── Main ────────────────────────────────────────────────── -->
		<main class="main">
			{#if selectedCharacter}
				<header class="header">
					<div>
						<h1>{selectedCharacter.name}</h1>
						<div class="tag-row">
							{#if selectedCharacter.element}
								<span class="tag tag-element">{selectedCharacter.element}</span>
							{/if}
							{#if selectedCharacter.stratum}
								<span class="tag tag-stratum">Stratum: {selectedCharacter.stratum}</span>
							{/if}
							{#if selectedCharacter.stackName}
								<span class="tag tag-stack">
									{selectedCharacter.stackName}{selectedCharacter.stackMax
										? ` (${selectedCharacter.stackMax} max)`
										: ''}
								</span>
							{/if}
						</div>
					</div>
					<button class="close-btn" onclick={onclose} aria-label="Close">&times;</button>
				</header>

				<div class="body">
					<!-- Overview -->
					<section class="overview">
						{#if selectedCharacter.art?.poster}
							<div class="poster">
								<img src={selectedCharacter.art.poster} alt="{selectedCharacter.name} art" />
							</div>
						{/if}
						<div class="overview-content">
							<h3 class="kicker">Overview</h3>
							<p class="prose">{@render fmt(overviewText)}</p>
							<div class="vitals">
								<HPBar
									current={selectedCharacter.maxHp}
									max={selectedCharacter.maxHp}
									type="hp"
									{selectedCharacter}
								/>
								<HPBar
									current={selectedCharacter.maxEnergy}
									max={selectedCharacter.maxEnergy}
									type="energy"
									{selectedCharacter}
								/>
							</div>
						</div>
					</section>

					<!-- Basic Attacks -->
					<section>
						<h2 class="section-title">
							<span class="keycap">Space</span>Basic Attacks · {selectedCharacter.basicStyle ??
								'normal'}
						</h2>

						{#if selectedCharacter.basicStyle === 'chain' && selectedCharacter.basicChain}
							<div class="card-row">
								{#each selectedCharacter.basicChain as hit, i}
									<div class="card">
										<div class="card-head">
											<h3>{hit.name || `Sequence ${i + 1}`}</h3>
											<span class="badge">{i + 1}</span>
										</div>
										<div class="tag-row">
											{#if hit.damage !== undefined}<span class="tag tag-dmg">{hit.damage} DMG</span
												>{/if}
											{#if hit.range === 1}<span class="tag">Melee</span
												>{:else if hit.range !== undefined}<span class="tag">Range {hit.range}</span
												>{/if}
											{#if hit.omniTarget}<span class="tag tag-outline">Omni</span>{/if}
											{#if hit.energyGain}<span class="tag tag-energy">+{hit.energyGain} EN</span
												>{/if}
											{#if hit.consumesStack}<span class="tag tag-stack"
													>Spends {selectedCharacter.stackName}</span
												>{/if}
											{#if hit.grantsStack}<span class="tag tag-stack"
													>+{selectedCharacter.stackName}</span
												>{/if}
											{#if hit.teamHeal}<span class="tag tag-heal">Team +{hit.teamHeal} HP</span
												>{/if}
										</div>
										{#if hit.description}<p class="prose small">
												{@render fmt(hit.description)}
											</p>{/if}
									</div>
								{/each}
							</div>
						{:else if selectedCharacter.contextualBasic}
							{@const cb = selectedCharacter.contextualBasic}
							<div class="card-row">
								{#if cb.base}
									<div class="card">
										<div class="card-head">
											<h3>{cb.base.name}</h3>
											<span class="badge">Basic</span>
										</div>
										<div class="tag-row">
											<span class="tag tag-dmg">{cb.base.damage} DMG</span>
											{#if cb.base.range === 1}<span class="tag">Melee</span>{:else}<span
													class="tag">Range {cb.base.range}</span
												>{/if}
											{#if cb.base.omniTarget}<span class="tag tag-outline">Omni</span>{/if}
										</div>
										{#if cb.base.description}<p class="prose small">
												{@render fmt(cb.base.description)}
											</p>{/if}
									</div>
								{/if}
								{#if cb.withStack}
									<div class="card accent">
										<div class="card-head">
											<h3>{cb.withStack.name}</h3>
											<span class="badge">Enhanced</span>
										</div>
										<div class="tag-row">
											<span class="tag tag-dmg">{cb.withStack.damage} DMG</span>
											{#if cb.withStack.range === 1}<span class="tag">Melee</span
												>{:else if cb.withStack.range !== undefined}<span class="tag"
													>Range {cb.withStack.range}</span
												>{/if}
											{#if cb.withStack.consumesStack}<span class="tag tag-stack"
													>Spends {selectedCharacter.stackName}</span
												>{/if}
											{#if cb.withStack.gapClose}<span class="tag tag-move">Gap-close</span>{/if}
											{#if cb.withStack.dashBack}<span class="tag tag-move"
													>Disengage {cb.withStack.dashBack}</span
												>{/if}
										</div>
										{#if cb.withStack.description}<p class="prose small">
												{@render fmt(cb.withStack.description)}
											</p>{/if}
									</div>
								{/if}
							</div>
						{/if}
					</section>

					<!-- Kit abilities -->
					<section>
						<h2 class="section-title">Kit Abilities</h2>
						<div class="card-col">
							{#each abilitySlots as slot}
								{@const ab = selectedCharacter.abilities[slot]}
								{@const isConstruct = ['summon', 'construct', 'zone', 'dash'].includes(
									ab.behavior || ''
								)}
								<div class="card" class:accent={isConstruct}>
									<div class="card-head">
										<h3><span class="keycap">{slot}</span> {ab.name || 'In evaluation'}</h3>
										<div class="tag-row">
											{#if ab.energyCost}<span class="tag tag-energy-cost">{ab.energyCost} EP</span
												>{/if}
											{#if ab.holdBehavior}<span class="tag tag-outline"
													>Hold: {ab.holdBehavior}</span
												>{/if}
											{#if ab.charges}<span class="tag tag-charge">{ab.charges} charges</span>{/if}
											{#if ab.cooldownMs}<span class="tag tag-cooldown"
													>CD {secs(ab.cooldownMs)}</span
												>{/if}
										</div>
									</div>

									<div class="tag-row">
										{#if ab.behavior}<span class="tag tag-behavior">{ab.behavior}</span>{/if}
										{#if ab.damage !== undefined}<span class="tag tag-dmg">{ab.damage} DMG</span
											>{/if}
										{#if ab.shapeParams?.range !== undefined}<span class="tag"
												>Range {ab.shapeParams.range}</span
											>{/if}
										{#if ab.shapeParams?.tiles !== undefined}<span class="tag tag-move"
												>Travel {ab.shapeParams.tiles}</span
											>{/if}
										{#if ab.shapeParams?.radius !== undefined}<span class="tag"
												>Radius {ab.shapeParams.radius}</span
											>{/if}
										{#if ab.shapeParams?.blastDamage}<span class="tag tag-dmg"
												>Blast {ab.shapeParams.blastDamage}</span
											>{/if}
										{#if ab.shapeParams?.blastRadius}<span class="tag"
												>Blast r{ab.shapeParams.blastRadius}</span
											>{/if}
										{#if ab.knockback}<span class="tag tag-move">Knock {ab.knockback}</span>{/if}
										{#if ab.stunMs}<span class="tag tag-alert">Stun {secs(ab.stunMs)}</span>{/if}
										{#if ab.poiseDamage}<span class="tag tag-alert">Poise {ab.poiseDamage}</span
											>{/if}
										{#if ab.selfHeal}<span class="tag tag-heal">Heal +{ab.selfHeal} HP</span>{/if}
										{#if ab.energyGain}<span class="tag tag-energy">+{ab.energyGain} EN</span>{/if}
										{#if ab.grantsStack}<span class="tag tag-stack"
												>+{selectedCharacter.stackName}</span
											>{/if}
									</div>

									{#if ab.description}<p class="prose small">{@render fmt(ab.description)}</p>{/if}

									{#if ab.summonImage || ab.summonId}
										<div class="summon">
											{#if ab.summonImage}<img src={ab.summonImage} alt={ab.summonId} />{/if}
											<div>
												<p class="summon-title">
													{ab.behavior === 'construct' ? 'Construct' : 'Summon'}: {ab.summonId}
												</p>
												{#if ab.summonDurationMs}<span class="tag"
														>Duration {secs(ab.summonDurationMs)}</span
													>{/if}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</section>

					<!-- Hints (authored later in data: character.hints: string[]) -->
					<section>
						<h2 class="section-title">Hints</h2>
						{#if selectedCharacter.hints?.length}
							<ul class="hints">
								{#each selectedCharacter.hints as hint}
									<li class="prose small">{@render fmt(hint)}</li>
								{/each}
							</ul>
						{:else}
							<p class="prose small muted">
								Combat notes pending — to be transcribed once the kit is finalised.
							</p>
						{/if}
					</section>

					<!-- Controls legend (static guide) -->
					<section class="controls">
						<h2 class="section-title">Controls</h2>
						<div class="controls-grid">
							<span
								><kbd class="tok-kbd">W</kbd><kbd class="tok-kbd">A</kbd><kbd class="tok-kbd">S</kbd
								><kbd class="tok-kbd">D</kbd> move</span
							>
							<span><kbd class="tok-kbd">Spc</kbd> basic</span>
							<span
								><kbd class="tok-kbd">X</kbd><kbd class="tok-kbd">C</kbd><kbd class="tok-kbd">V</kbd
								> skills</span
							>
							<span
								><kbd class="tok-kbd">1</kbd><kbd class="tok-kbd">2</kbd><kbd class="tok-kbd">3</kbd
								> swap</span
							>
							<span><kbd class="tok-kbd">Shift</kbd> aim</span>
							<span><kbd class="tok-kbd">Z</kbd> auto-look</span>
							<span><kbd class="tok-kbd">F</kbd> lock-on</span>
						</div>
					</section>
				</div>
			{/if}
		</main>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.86);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
		padding: 1.5rem;
	}

	.codex {
		--surface: #140d10;
		--surface-2: #1c1317;
		--line: rgba(234, 172, 139, 0.14);
		width: 100%;
		max-width: 1000px;
		height: 86vh;
		display: flex;
		overflow: hidden;
		border-radius: 12px;
		background: var(--surface);
		color: var(--text, #f0ece4);
		font-family: 'JetBrains Mono', ui-monospace, 'Courier New', monospace;
		border: 1px solid color-mix(in srgb, var(--char-primary) 30%, var(--border, #eaac8b));
		box-shadow:
			0 24px 60px rgba(0, 0, 0, 0.6),
			0 0 0 1px rgba(0, 0, 0, 0.4),
			0 0 32px color-mix(in srgb, var(--char-glow) 28%, transparent);
		transition:
			border-color 0.25s ease,
			box-shadow 0.25s ease;
	}

	/* ── Sidebar ── */
	.sidebar {
		width: 232px;
		flex-shrink: 0;
		background: #100a0c;
		border-right: 1px solid var(--line);
		display: flex;
		flex-direction: column;
	}
	.sidebar-title {
		font-size: 1.5rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 1.1rem 1rem 0.5rem;
		margin: 0;
		color: var(--text-dim, #9e94b0);
		font-family: 'DePixel';
	}
	.roster {
		/* flex-grow: 1; */
		overflow-y: auto;
		padding: 0.4rem;
		display: grid;
		grid-template-columns: 1fr 1fr;
		/* flex-direction: column; */
		gap: 0.25rem;
	}
	.roster-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		height: fit-content;
		gap: 0.7rem;
		padding: 0.45rem 0.6rem;
		border-radius: 8px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-dim, #9e94b0);
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		transition:
			background 0.12s,
			color 0.12s,
			border-color 0.12s;
	}
	.roster-item:hover {
		background: rgba(255, 255, 255, 0.04);
		color: var(--text, #f0ece4);
	}
	.roster-item.active {
		background: color-mix(in srgb, var(--item-tint) 14%, transparent);
		border-color: color-mix(in srgb, var(--item-tint) 55%, transparent);
		color: #fff;
	}
	.roster-item img,
	.avatar-fallback {
		width: 80px;
		height: 80px;
		/* border-radius: 50%; */
		border-radius: 5px;
		object-fit: cover;
		background: #000;
		border: 1px solid color-mix(in srgb, var(--item-tint) 45%, #2a1f24);
	}
	.avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		color: #fff;
	}
	.roster-name {
		font-size: 0.85rem;
		font-family: 'DePixel';
		text-transform: uppercase;
		max-width: 10ch;
		text-align: center;
		/* font-weight: 600; */
	}

	/* ── Main ── */
	.main {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		background: #0c0709;
		overflow: hidden;
	}
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.1rem 1.4rem;
		border-bottom: 1px solid var(--line);
	}
	.header h1 {
		margin: 0 0 0.4rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: #fff;
		letter-spacing: 0.01em;
		font-family: 'DePixel';
		text-transform: uppercase;
	}
	.close-btn {
		background: transparent;
		border: none;
		color: var(--text-dim, #9e94b0);
		font-size: 1.8rem;
		line-height: 1;
		cursor: pointer;
	}
	.close-btn:hover {
		color: #fff;
	}

	.keycap {
		font-size: 0.85rem;
		background-color: rgb(113, 125, 147);
		box-shadow: 0 -2px 0 2px #0000008e inset;
		padding: 4px 8px;
		border-radius: 6px;
		color: #00000073;
		margin-right: 4px;
	}

	.body {
		padding: 1.4rem;
		overflow-y: auto;
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		gap: 1.6rem;
	}
	.section-title {
		font-size: 1.3rem;
		font-weight: 400;
		text-transform: uppercase;
		/* letter-spacing: 0.12em; */
		font-family: 'Silkscreen';
		color: var(--gold, #e8b84a);
		margin: 0 0 0.75rem;
	}
	.kicker {
		font-size: 1rem;
		text-transform: uppercase;
		/* letter-spacing: 0.12em; */
		color: var(--char-glow);
		margin: 0 0 0.5rem;
		font-weight: 400;
		font-family: 'Silkscreen';
	}

	/* ── Overview ── */
	.overview {
		display: flex;
		gap: 1.4rem;
		padding: 1.1rem;
		border-radius: 10px;
		background: var(--surface-2);
		border: 1px solid var(--line);
		border-left: 3px solid var(--char-primary);
		align-items: flex-start;
	}
	.poster {
		width: 150px;
		height: 200px;
		flex-shrink: 0;
		border-radius: 8px;
		overflow: hidden;
		background: #000;
		border: 1px solid color-mix(in srgb, var(--char-primary) 35%, transparent);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
	}
	.poster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.overview-content {
		flex-grow: 1;
		min-width: 0;
	}
	.vitals {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem;
		margin-top: 1rem;
	}

	.prose {
		font-size: 1.2rem;
		line-height: 1.65;
		color: #d8cfd0;
		margin: 0;
		font-family: 'Lexend';
	}
	.prose.small {
		font-size: 1rem;
		margin-top: 0.55rem;
		font-family: 'Lexend';
	}
	.muted {
		color: var(--text-dim, #9e94b0);
		font-style: italic;
	}

	/* ── Cards ── */
	.card-col {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.card-row {
		display: flex;
		/* flex-direction: column; */
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.card-row .card {
		flex: 1 1 220px;
	}
	.card {
		background: var(--surface-2);
		border: 1px solid var(--line);
		border-left: 3px solid #4a3a40;
		border-radius: 8px;
		padding: 0.8rem 1rem;
		/* height: fit-content; */
	}
	.card.accent {
		/* border-left-color: var(--char-primary); */
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.card-head h3 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 400;
		color: #f2ecee;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: 'DePixel';
	}
	.badge {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		background: rgba(255, 255, 255, 0.07);
		color: var(--text-dim, #9e94b0);
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-family: 'Silkscreen';
	}

	/* ── Tags ── */
	.tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}
	.tag {
		font-size: 0.72rem;
		font-weight: 400;
		padding: 0.18rem 0.5rem;
		border-radius: 5px;
		background: rgba(234, 172, 139, 0.1);
		color: var(--text, #f0ece4);
		white-space: nowrap;
		font-family: 'Lexend';
	}
	.tag-element {
		background: var(--char-primary);
		border: 1px solid color-mix(in srgb, var(--char-primary) 55%, transparent);
		color: #0000008e;
		font-weight: 400;
		text-transform: uppercase;
	}
	.tag-stratum {
		background: #2b6cb0;
		color: #fff;
		text-transform: uppercase;
	}
	.tag-stack {
		background: color-mix(in srgb, var(--char-primary) 22%, transparent);
		border: 1px solid color-mix(in srgb, var(--char-primary) 55%, transparent);
		color: var(--char-glow);
	}
	.tag-dmg {
		background: color-mix(in srgb, var(--blood, #dc4e47) 30%, transparent);
		color: #ffd9d2;
	}
	.tag-cooldown {
		background: #9a4a1f;
		color: #ffe6cf;
	}
	.tag-charge {
		background: #2f6b48;
		color: #d6f5e2;
	}
	.tag-energy,
	.tag-energy-cost {
		background: #8a6a1f;
		color: #fff0cf;
	}
	.tag-heal {
		background: #2f7a52;
		color: #d6f5e2;
	}
	.tag-alert {
		background: #7d2b2b;
		color: #ffd9d2;
	}
	.tag-move {
		background: rgba(120, 160, 255, 0.16);
		color: #cdd8ff;
	}
	.tag-behavior {
		background: transparent;
		border: 1px solid var(--line);
		color: var(--text-dim, #9e94b0);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.tag-outline {
		background: transparent;
		border: 1px solid color-mix(in srgb, var(--char-glow) 60%, transparent);
		color: var(--char-glow);
	}

	/* ── Summon asset ── */
	.summon {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-top: 0.7rem;
		padding: 0.55rem 0.7rem;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.35);
		border: 1px dashed var(--line);
	}
	.summon img {
		width: 40px;
		height: 40px;
		object-fit: contain;
		border-radius: 4px;
		background: #000;
	}
	.summon-title {
		margin: 0 0 0.2rem;
		font-size: 1rem;
		font-weight: 400;
		color: #fff;
		font-family: 'DePixel';
	}

	/* ── Hints + controls ── */
	.hints {
		margin: 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.hints li::marker {
		color: var(--char-primary);
	}
	.controls-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.2rem;
		font-size: 0.76rem;
		color: var(--text-dim, #9e94b0);
	}
	.controls-grid span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	/* ── Inline tokens ── */
	.tok-kw {
		color: var(--char-glow);
		background: color-mix(in srgb, var(--char-primary) 14%, transparent);
		padding: 0.02em 0.34em;
		border-radius: 4px;
		font-weight: 600;
	}
	.tok-stat {
		color: var(--gold-bright, #f5d060);
		font-weight: 700;
	}
	.tok-kbd {
		display: inline-block;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-size: 0.72em;
		font-weight: 700;
		line-height: 1;
		padding: 0.2em 0.45em;
		color: #f0ece4;
		background: #241a1e;
		border: 1px solid rgba(234, 172, 139, 0.25);
		border-radius: 4px;
		box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5);
		margin: 0 0.05em;
	}

	@media (max-width: 760px) {
		.codex {
			flex-direction: column;
			height: 92vh;
		}
		.sidebar {
			width: 100%;
			max-height: 130px;
		}
		.roster {
			flex-direction: row;
			overflow-x: auto;
		}
		.overview {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}
	}
</style>

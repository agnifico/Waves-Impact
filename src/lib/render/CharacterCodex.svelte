<script lang="ts">
	import { resolveTheme } from '$lib/render/char-theme';

	// Import the character data roster modules
	import { frosty } from '$lib/data/characters/frosty';
	import { maria_elena } from '$lib/data/characters/maria_elena';
	import { midorima } from '$lib/data/characters/midorima';
	import { ryoma } from '$lib/data/characters/ryoma';
	import { sefyra } from '$lib/data/characters/sefyra';
	import { yara } from '$lib/data/characters/yara';

	// Define explicit Svelte 5 Component Props
	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	// Array tracking all character file contexts
	const allCharacters = [frosty, maria_elena, midorima, ryoma, sefyra, yara];

	// Runes State Manager
	let selectedCharacter = $state(allCharacters[0]);

	// Runes Derived States matching the current selection framework
	let activeTheme = $derived(selectedCharacter ? resolveTheme(selectedCharacter) : null);
	let abilitySlots = $derived(
		selectedCharacter?.abilities ? Object.keys(selectedCharacter.abilities) : []
	);

	// Safe placeholder text mapping if a character description property is missing
	let characterDescription = $derived(
		selectedCharacter?.description ||
			'No database entry recorded yet for this candidate. Files are currently being decrypted.'
	);

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<!-- svelte-ignore event_directive_deprecated -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" on:click={handleBackdropClick} role="dialog" aria-modal="true">
	<div
		class="codex-container"
		style="--char-glow: {activeTheme?.glow?.ready ||
			'var(--gold)'}; --char-primary: {activeTheme?.primary || 'var(--gold)'};"
	>
		<aside class="codex-sidebar">
			<h2 class="sidebar-title">ARCHIVES</h2>
			<div class="character-grid">
				{#each allCharacters as char}
					{@const charTheme = resolveTheme(char)}
					<button
						class="grid-item"
						class:active={selectedCharacter?.id === char.id}
						style="--item-glow: {charTheme.glow.ready}"
						on:click={() => (selectedCharacter = char)}
					>
						{#if char.art?.profile}
							<img src={char.art.profile} alt={char.name} />
						{:else}
							<div class="avatar-placeholder">{char.name?.[0] || '?'}</div>
						{/if}
						<span class="grid-name">{char.name}</span>
					</button>
				{/each}
			</div>
		</aside>

		<main class="codex-main">
			{#if selectedCharacter}
				<header class="codex-header">
					<div class="character-identity">
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
										{selectedCharacter.stackName}
										{selectedCharacter.stackMax ? `(${selectedCharacter.stackMax} Max)` : ''}
									</span>
								{/if}
							</div>
						</div>
					</div>
					<button class="close-btn" on:click={onclose} aria-label="Close modal">&times;</button>
				</header>

				<div class="codex-body">
					<section class="section presentation-block">
						{#if selectedCharacter.art?.poster}
							<div class="poster-frame">
								<img
									src={selectedCharacter.art.poster}
									alt="{selectedCharacter.name} Full Poster Art"
									class="poster-image"
								/>
							</div>
						{/if}
						<div class="bio-content">
							<h3 class="subsection-title">Overview</h3>
							<p class="character-bio-text">{characterDescription}</p>
							<div class="vital-section">
								{#if selectedCharacter.maxHp !== undefined}
									<div class="vital-bar-container">
										<span class="vital-label">Base HP: {selectedCharacter.maxHp}</span>
										<div class="vital-bar" style="background: {activeTheme?.hp || 'var(--hp)'}"></div>
									</div>
								{/if}
								{#if selectedCharacter.maxEnergy !== undefined}
									<div class="vital-bar-container">
										<span class="vital-label">Max Energy: {selectedCharacter.maxEnergy}</span>
										<div
											class="vital-bar"
											style="background: {activeTheme?.energy || 'var(--energy)'}"
										></div>
									</div>
								{/if}
							</div>
						</div>
					</section>

					<section class="section">
						<h2 class="section-title">
							Attack Parameters ({selectedCharacter.basicStyle || 'Normal'})
						</h2>

						{#if selectedCharacter.basicStyle === 'chain' && selectedCharacter.basicChain}
							<div class="layout-stack flex-row">
								{#each selectedCharacter.basicChain as hit, i}
									<div class="skill-card">
										<div class="card-header">
											<h3>{hit.name || `Attack Sequence ${i + 1}`}</h3>
											<!-- <span class="badge">Combo {i + 1}</span> -->
										</div>
										<div class="tag-group">
											{#if hit.damage !== undefined}<span class="tag">DMG: {hit.damage}</span>{/if}
											{#if hit.range !== undefined}<span class="tag">Range: {hit.range}</span>{/if}
											{#if hit.energyGain !== undefined}<span class="tag"
													>Energy: +{hit.energyGain}</span
												>{/if}
											{#if hit.shape}<span class="tag uppercase">{hit.shape}</span>{/if}
											{#if hit.omniTarget}<span class="tag tag-highlight">Omni-Target</span>{/if}
											{#if hit.grantsStack}<span class="tag tag-stack">+{hit.grantsStack}</span
												>{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else if selectedCharacter.contextualBasic}
							<div class="layout-stack flex-row">
								{#if selectedCharacter.contextualBasic.base}
									{@const base = selectedCharacter.contextualBasic.base}
									<div class="skill-card">
										<div class="card-header">
											<h3>{base.name}</h3>
											<span class="badge">Standard Base</span>
										</div>
										<div class="tag-group">
											<span class="tag">DMG: {base.damage}</span>
											<span class="tag">Range: {base.range}</span>
											<span class="tag uppercase">{base.shape}</span>
										</div>
									</div>
								{/if}
								{#if selectedCharacter.contextualBasic.withStack}
									{@const wStack = selectedCharacter.contextualBasic.withStack}
									<div class="skill-card accent-card">
										<div class="card-header">
											<h3>{wStack.name}</h3>
											<span class="badge">Empowered Burst</span>
										</div>
										<div class="tag-group">
											<span class="tag">DMG: {wStack.damage}</span>
											<span class="tag tag-stack">Consumes: {wStack.consumesStack}</span>
											{#if wStack.dashBack}<span class="tag"
													>Disengage: {wStack.dashBack} Tiles</span
												>{/if}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</section>

					<hr class="divider" />

					<section class="section">
						<h2 class="section-title">Kit Abilities</h2>
						<div class="layout-stack">
							{#each abilitySlots as slotKey}
								{@const ab = selectedCharacter.abilities[slotKey]}
								<div
									class="skill-card"
									class:accent-card={['summon', 'construct', 'zone', 'dash'].includes(
										ab.behavior || ''
									)}
								>
									<div class="card-header">
										<h3>[{slotKey}] {ab.name || 'In Evaluation'}</h3>
										<div class="tag-row">
											{#if ab.energyCost}<span class="tag tag-energy-cost"
													>Cost: {ab.energyCost} EP</span
												>{/if}
											{#if ab.cooldownMs}<span class="tag tag-cooldown"
													>CD: {ab.cooldownMs / 1000}s</span
												>{/if}
											{#if ab.charges}<span class="tag tag-charge">Charges: {ab.charges}</span>{/if}
										</div>
									</div>

									{#if ab.description}
										<p class="skill-description">{ab.description}</p>
									{/if}

									<div class="tag-group">
										{#if ab.behavior}<span class="tag uppercase sub-accent">{ab.behavior}</span
											>{/if}
										{#if ab.damage !== undefined}<span class="tag">DMG: {ab.damage}</span>{/if}
										{#if ab.shape}<span class="tag uppercase"
												>{ab.shape}
												{#if ab.shapeParams?.range || ab.shapeParams?.radius}(R: {ab.shapeParams
														.range || ab.shapeParams.radius}){/if}</span
											>{/if}
										{#if ab.stunMs}<span class="tag tag-alert">Stun: {ab.stunMs / 1000}s</span>{/if}
										{#if ab.selfHeal}<span class="tag tag-charge">Heal: +{ab.selfHeal} HP</span
											>{/if}
										{#if ab.grantsStack}<span class="tag tag-stack">Grants: {ab.grantsStack}</span
											>{/if}
									</div>

									{#if ab.summonImage || ab.summonId}
										<div class="summon-asset">
											{#if ab.summonImage}
												<img src={ab.summonImage} alt={ab.summonId} />
											{/if}
											<div>
												<p class="asset-title">
													{ab.behavior === 'construct' ? 'Construct Object' : 'Active Summon'}: {ab.summonId}
												</p>
												{#if ab.summonDurationMs}
													<span class="tag">Duration: {ab.summonDurationMs / 1000}s</span>
												{/if}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</section>
				</div>
			{/if}
		</main>
	</div>
</div>

<style>
	/* System Shell Variables matching core aesthetics layout */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
		padding: 1.5rem;
	}

	.codex-container {
		background: #0d0f14;
		color: #f0ece4;
		width: 100%;
		max-width: 980px;
		height: 85vh;
		border-radius: 12px;
		border: 1px solid #2d3748;
		box-shadow:
			0 0 25px rgba(0, 0, 0, 0.6),
			0 0 3px var(--char-glow);
		display: flex;
		overflow: hidden;
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
	}

	.codex-sidebar {
		width: 250px;
		background: #121620;
		border-right: 1px solid #1e2533;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	.sidebar-title {
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		padding: 1.25rem 1rem 0.5rem 1rem;
		margin: 0;
		color: #718096;
	}

	.character-grid {
		flex-grow: 1;
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.grid-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		text-align: left;
		color: #a0aec0;
		transition: all 0.15s ease;
	}

	.grid-item img,
	.avatar-placeholder {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid #4a5568;
		background: #1a202c;
	}

	.avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		color: #fff;
	}

	.grid-name {
		font-size: 0.9rem;
		font-weight: 600;
	}
	.grid-item:hover {
		background: rgba(255, 255, 255, 0.03);
		color: #fff;
	}

	.grid-item.active {
		background: #1e2533;
		border-color: var(--item-glow);
		color: #ffffff;
	}

	.codex-main {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		background: #090b0f;
		overflow: hidden;
	}

	.codex-header {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #1e2533;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.codex-header h1 {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
		color: #ffffff;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: #718096;
		font-size: 2rem;
		cursor: pointer;
		line-height: 1;
	}
	.close-btn:hover {
		color: #ffffff;
	}

	.codex-body {
		padding: 1.5rem;
		overflow-y: auto;
		flex-grow: 1;
	}
	.section {
		margin-bottom: 1.75rem;
	}
	.section-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: #ffffff;
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* PRESENTATION BLOCK: Poster and Bio Text Style */
	.presentation-block {
		display: flex;
		gap: 1.5rem;
		background: #121620;
		border: 1px solid #1e2533;
		padding: 1rem;
		border-radius: 8px;
		align-items: flex-start;
	}

	.poster-frame {
		width: 140px;
		height: 190px;
		flex-shrink: 0;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: #000;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
	}

	.poster-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.bio-content {
		flex-grow: 1;
	}

	.subsection-title {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--char-glow);
		margin: 0 0 0.5rem 0;
	}

	.character-bio-text {
		font-size: 0.9rem;
		line-height: 1.6;
		color: #cbd5e0;
		margin: 0;
	}

	/* Vitals */
	.vital-section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		background: #121620;
		padding: 1rem;
		border-radius: 8px;
		border: 1px solid #1e2533;
	}
	.vital-bar-container {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.vital-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: #a0aec0;
	}
	.vital-bar {
		height: 6px;
		border-radius: 3px;
		width: 100%;
	}

	/* Tags */
	.tag-row,
	.tag-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.4rem;
	}
	.tag {
		background: #1e2533;
		color: #e2e8f0;
		padding: 0.2rem 0.55rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.tag-element {
		background: var(--char-primary);
		color: #000;
		font-weight: 700;
		text-transform: uppercase;
	}
	.tag-stratum {
		background: #2b6cb0;
		text-transform: uppercase;
	}
	.tag-stack {
		background: #6b46c1;
	}
	.tag-cooldown {
		background: #c05621;
	}
	.tag-charge {
		background: #2f855a;
	}
	.tag-alert {
		background: #9b2c2c;
	}
	.tag-energy-cost {
		background: #b7791f;
	}
	.tag-highlight {
		border: 1px solid var(--char-glow);
		color: #fff;
	}
	.sub-accent {
		border: 1px solid #4a5568;
		background: transparent;
	}

	.uppercase {
		text-transform: uppercase;
	}

	.layout-stack {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.skill-card {
		background: #121620;
		padding: 0.85rem 1.2rem;
		border-radius: 8px;
		border: 1px solid #1e2533;
		border-left: 3px solid #4a5568;
	}
	.accent-card {
		border-left-color: var(--char-glow);
	}
	.skill-card .card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.skill-card h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #edf2f7;
	}
	.badge {
		font-size: 0.7rem;
		background: rgba(255, 255, 255, 0.08);
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		color: #a0aec0;
	}
	.skill-description {
		font-size: 0.85rem;
		color: #cbd5e0;
		margin: 0.5rem 0;
		line-height: 1.5;
	}

	.divider {
		border: 0;
		height: 1px;
		background: #1e2533;
		margin: 1.5rem 0;
	}

	.summon-asset {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: rgba(0, 0, 0, 0.4);
		padding: 0.6rem;
		border-radius: 6px;
		margin-top: 0.75rem;
		border: 1px dashed rgba(255, 255, 255, 0.1);
	}
	.summon-asset img {
		width: 42px;
		height: 42px;
		object-fit: contain;
		border-radius: 4px;
		background: #000;
	}
	.asset-title {
		margin: 0 0 0.15rem 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: #ffffff;
	}

	/* Responsive scaling adjustments if modal context compresses */
	@media (max-width: 768px) {
		.presentation-block {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}
		.poster-frame {
			width: 100%;
			max-width: 200px;
			height: 270px;
		}
	}

	.flex-row {
		display: flex;
		flex-direction: row;
	}
</style>

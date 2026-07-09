# DJv2 — Project Guide

Everything a fresh session needs to work on this project without re-deriving context.

---

## The Law

**Characters, enemies, and creations are pure data. Adding content is always a data-file change, never engine code.**

If you feel you need character-specific code, stop — that's a signal of a missing engine primitive. Extend the engine generically, then express the character as data. This is the single most important architectural commitment in the project.

---

## Stack

SvelteKit + TypeScript + Svelte 5 runes. State is one `EngineState` `$state` object at the route level. The engine mutates it directly; Svelte reactivity re-renders. All state is JSON-serializable (primitives, plain objects, arrays — no classes).

---

## The Three-Axis Combat Model

Every ability composes from three orthogonal axes:

- **Shape** — pure geometry: `(casterPos, dir, shapeParams) → tiles`. Knows nothing about damage or effects. Lives in `combat/shapes/`.
- **Behavior** — resolution class: what gets damaged, what statuses apply, what state changes. Lives in `combat/behaviors/`.
- **Hold** — orthogonal cast modifier: `aim` / `charge` / `channel` / `track` / `aim_dir`.

---

## The Resolve Boundary — The Most Important Architectural Fact

**All combat damage flows through `resolve.ts`.** There are exactly two entry points:

### `applyDelivery(state, delivery, src, now)`
The **guaranteed floor** on cast. Grants heal/shield/energy/stacks to the caster once — regardless of whether anything was hit. Call once per cast before any hit resolution.

### `applyOnHit(state, enemy, baseDmg, onHit, src, now)`
**Per enemy struck.** Deals damage through the pipeline, then fires: splash, knockback, stun, applied effects, lifesteal, and per-connect owner resources (energy, stacks, selfHeal, teamHeal).

Every code path — BA, ability, summon attack, construct pulse, zone damage tick — uses these two functions and nothing else. If you find yourself writing another damage or resource loop anywhere, stop and route through `resolve.ts` instead. That is the unification boundary.

---

## Ability Data Shape

```
Ability {
  delivery  → HOW it's aimed/shaped/charged
              + GUARANTEED FLOOR: damage, energyGain, heal, shield, grantsStack on cast
  onHit     → PER ENEMY STRUCK: splash, knockback, stun, energyGain per hit,
              lifesteal, grantsStack per hit, appliesEffects
  zoneBuff  → behavior:zone only; continuous tick fields (dmgPerTick routes through onHit)
  
  behavior  → dispatch key (damage_aoe, dash, zone, summon, construct, ...)
  cooldownMs / charges / energyCost → cast economy
  creationId → for summon/construct behaviors
}
```

**Resource split pattern:**
- `delivery.energyGain` = flat to owner once on cast (+ small share to off-field members)
- `onHit.energyGain` = flat to owner per enemy struck (+ small share to off-field)
- `zoneBuff.onHit.energyGain` = same, per enemy struck per zone tick

---

## Energy Model

All rules live in `combat/energy.ts`:
- `OFF_FIELD_REGEN_AMOUNT` (1/sec) — passive trickle to benched members
- `OFF_FIELD_HIT_SHARE` (1/5) — fraction of any `energyGain` each off-field member receives
- `offFieldMultiplier(pc)` — per-character multiplier; plug per-character passive bonuses here

Active member earns energy only through `delivery.energyGain` + `onHit.energyGain`. Never passive trickle.

---

## `AbilityOpts` — Typed Input-Layer Bridge

`AbilityOpts` (defined in `types/ability.ts`, re-exported from `ability-resolver.ts`) is the typed bag of runtime data the input layer passes to behavior handlers at cast time.

```typescript
interface AbilityOpts {
  reticle?:       { x: number; y: number } | null  // holdBehavior:'aim'
  chargedRange?:  number                            // holdBehavior:'charge'
  aimDir?:        Vector                            // holdBehavior:'aim_dir'
  tier?:          number                            // cloudpiercer hold-time tier
  lockedTargetId?: string                           // locked enemy
  selfTarget?:    boolean
}
```

Behaviors declare `opts: AbilityOpts = {}` and read only what they need. No `Record<string, unknown>` casts.

---

## `ResolveSource` — Who Owns the Hit

```typescript
interface ResolveSource {
  owner:        CharacterState   // receives energy/stacks/heal back
  abilityName:  string
  element?:     string
  ability?:     Ability          // for pipeline lookups
  originZoneId?: string          // zone self-bonus marker
  sourcePos?:   Position         // override for zone/construct/summon position
  flatDamage?:  boolean          // skip pipeline (creations with receiveBuffs:false)
  tags?:        DamageTag[]      // ['ba'] | ['ability'] | ['ability','ult'] | ['creation'] | ...
}
```

`flatDamage: true` bypasses `calculateDamage` — raw damage only, no buffs applied. Used for creation attacks when `receiveBuffs: false`. Owner-bound resources (energy/stacks) still route normally.

---

## Adding Content

| What | Where | Notes |
|------|-------|-------|
| New character | `data/characters/[name].ts` | Export a `Character` object; import in `data/registry.ts` |
| New enemy | `data/enemies/[name].ts` | Export an `Enemy` object; import in registry |
| New creation | `data/creations.ts` | Add to `CREATIONS` registry |
| New effect | `data/effects/[name].ts` | Import in `data/registry.ts` |
| New behavior | `combat/behaviors/[name].ts` | Export `resolve()`; register in `behaviors/index.ts` |
| New AI pattern | `combat/ai/[name].ts` | Export `tick()`; register in `ai/index.ts` |
| New shape | `combat/shapes/[name].ts` | Export shape fn; register in `shapes/index.ts` |

---

## Key File Map

```
src/lib/
  combat/
    engine.ts            tick loop: movement, summons, constructs, zones, regen, effects, death
    resolve.ts           applyDelivery + applyOnHit — THE unification boundary
    ability-resolver.ts  tryAbility, fireWindUpCasts, AbilityOpts re-export
    basic-attack.ts      BA acquisition (tryBasicAttack) + application (applyBasicHit)
    pipeline.ts          calculateDamage stage chain (source buffs → zone → element/gear/def/crit stubs)
    energy.ts            off-field regen constants + helpers (offFieldMultiplier, regenOffField, grantOffFieldShare)
    effects.ts           tickEffects, stat modifiers, grantShield, absorbDamage, applyEffect
    stacks.ts            grantStack, consumeStack, reconcileStackBuffs
    events.ts            CombatEventMap + publish/subscribe
    board.ts             geometry, occupiedTiles, occupies, isBlocked, stepping helpers
    spatial.ts           canEnter, gapCloseLanding, canJuggernautStep, juggerShove, shoveEnemiesOff
    query.ts             nearestEnemy, focusTarget — footprint-aware Chebyshev distTo
    channel.ts           channel-basic (Carla's channeled BA)
    movement.ts          shared walk/dash walker (movement.walk)
    swap.ts              trySwap, checkAutoSwap
    state.ts             newEngineState, newCharacterState, newEnemyState
    shapes/{index,...}   pure geometry functions
    behaviors/{index,...} resolution classes
    ai/{index,...}       enemy AI patterns (melee_rush, ranged_kiter, flanker, tank_blocker)
  render/
    Board.svelte         viewport/world/grid/reticle/entity rendering
    Gem.svelte           entity icons + wind-up animations
    FxLayer.svelte       combat event subscriptions → transient visuals
    char-theme.ts        resolveTheme, elementRamp, rampOf — color source of truth
  types/
    ability.ts    Ability, ZoneBuff, ShapeId, BehaviorId, AbilityOpts, FxSpec
    state.ts      EngineState, CharacterState, EnemyState, SummonState, ConstructState, ZoneState
    character.ts  Character def
    enemy.ts      Enemy, EnemyAttack def
    creation.ts   CreationDef (summons + constructs)
    delivery.ts   Delivery
    onhit.ts      OnHit, Splash
    effect.ts     EffectDef, EffectInstance, DamageTag
    resource.ts   ResourcePayload, HealAmount
    common.ts     Position, Vector, Stratum, EntityId
  data/
    characters/   one file per character
    enemies/      one file per enemy
    creations.ts  CREATIONS registry
    effects/      effect definitions (bloomstride, shield, thread, unchained, ...)
    registry.ts   getAllCharacters, getEnemy, getEffectDef, getCreationDef
  input/
    input-handler.ts   keyboard/mouse event binding
    intent-state.ts    getMoveDir, holdState, gameNow, isPaused, ...
    keybinds.ts        key → action mapping
  styles/
    fx-strikes.css     projectile/melee strike visuals
    fx-zones.css       persistent zone visuals
    fx-casts.css       cast flash, shape-erupt, wind-up gem animations (fx-wu-*)
```

---

## Damage Pipeline Stages (`pipeline.ts`)

1. Source effects (damageBonus from active effects + cross-entity auras)
2. Zone bonuses (standing in / originating from a damage-bonus zone)
3. Elemental matrix — **stub, no-op**
4. Gear modifiers — **stub, no-op**
5. Defense — **stub, no-op**
6. Crit — **stub, no-op**
7. Target effects (damageReduction)
8. Clamp to ≥ 0

Adding a new stage = add a function + one entry in the `stages` array. Existing stages are untouched.

---

## FX System

Engine publishes events; `FxLayer.svelte` subscribes and spawns transient visuals. The engine knows nothing about visuals.

**Color contract (settled — do not relitigate):**
- **Strikes** — colors from `ability.fx.colors` (`[0]` → `--c`, `[1]` → `--c2`)
- **Cast / status / construct / wind-up** — colors from the character/entity theme via `rampOf(id)` in `char-theme.ts`

**Wind-ups:** `delivery.windUpMs` defers the behavior. `fireWindUpCasts` in `ability-resolver.ts` drains it per tick — this is the only proven per-tick drainer, use it for any deferred fire.

---

## Hard-Won Rules

1. **All damage routes through `resolve.ts`.** No new hand-rolled damage loops anywhere.
2. **Wind-ups drain in `fireWindUpCasts`** — the one proven per-tick drainer.
3. **Motion wind-up keyframes are displacement-only** — no `-50%` centering.
4. **CSS grid items clip overflow.** Multi-tile scaled entities render in an overlay layer in `Board.svelte`, not as tile children.
5. **FxLayer cone geometry must stay in sync with `pconeFrom` in `shapes/pcone.ts`.** Divergence causes FX to light the wrong tiles.
6. **Occupancy checks only matter if movement consults them.** Audit every `.pos =` assignment when changing collision rules.
7. **`flatDamage: true` skips the pipeline** — use for creations with `receiveBuffs: false`. Owner resources still apply.
8. **`ZoneBuff.onHit` is how zone ticks grant energy/stacks.** Heal/drain/gather stay as zone-only fields (no enemy is struck for those).
9. **`EngineState` is the single serializable source of truth.** All timers (`lastMoveAt`, `lastEnergyRegenAt`) live in it, not as module-level variables. `newEngineState()` resets everything — no separate reset function needed.

---

## Open Work (priority order)

1. **Nepthys directional cone BA** — first non-omni BA, first AoE-BA. Sets the pattern. Touches BA acquisition (`acquireTarget`), cursor render (`Board.svelte`), and multi-hit BA application.
2. **Elemental matrix, crit, defense** in pipeline — stubs exist, wire when a character needs them.
3. **Land/water terrain** — `canEnter` scaffold + `Board.water` field exist; gameplay not wired.
4. **Effect-driven stratum override** — add optional `stratum?` to `EffectInstance`; revert on expiry. Architecture supports it.
5. **Player knockback FX** — mirror the enemy knockback handler in `FxLayer.svelte`.
6. **Enemy wind-up duration parity** — thread `windUpMs` → `--cd` so motion wind-ups match actual timing.

## Settled (do not revisit without a design reason)

- `resolve.ts` as the single damage/resource boundary
- `AbilityOpts` as the typed input-layer → behavior bridge (defined in `types/ability.ts`)
- `ZoneBuff.onHit` for zone damage tick resources
- `EngineState` as the fully serializable source of truth
- FX color contract: strikes from `fx.colors`, everything else from character theme
- Summons do NOT block enemies (walk-through by design)
- Constructs block same-stratum units; `ignoresConstructs` flag bypasses

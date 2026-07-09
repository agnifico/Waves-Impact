# FX Catalogue — Chessboard Battlefield

All visual FX options available in character data files. Reference for authoring `fx`, `delivery.windUpStyle`, and cast-shape overrides.

---

## 1. Strike Types — `fx.strike`

Attached to basic attacks and abilities via `fx: { strike: '...' }`. Rendered by `FxLayer.svelte`. All strikes accept `fx.colors: [primary, secondary]`; omit to inherit the character's theme ramp.

### Melee / Impact

| Value | Visual | Notes |
|---|---|---|
| `swipe` | Fast horizontal arc slash at target | Default melee feel |
| `reverseswipe` | Swipe in the opposite arc direction | Mirror of swipe |
| `claw` | Multiple radiating gash marks | `fx.gashes` — count (default 3) |
| `stab` | Caster-anchored thrust line to target | Origin jitters L/R each cast so repeated stabs don't look identical |
| `flurry` | Rapid burst of small hit marks | `fx.hits` — count (default 6); each hit staggered 68ms |
| `slam` | Heavy impact + debris burst upward | 7-piece debris shower |
| `uppercut` | Rising sparks burst upward from target | 6 spark slivers, staggered |

### Ranged / Projectile

| Value | Visual | Notes |
|---|---|---|
| `projectile` | Moving shape travels from caster to target | See **Projectile options** below |
| `bullet` | Instant straight line from caster to target | No travel time |
| `beam` | Sustained energy line from caster to target | See **Volley** below |
| `chain` | Jagged lightning arc between caster and target | Uses the same jagged-path generator as `smite` |
| `stream` | Short pulsing beam (~220ms) for channelled shots | Use at ~4 shots/sec for a continuous-stream feel |

### Special / Elemental

| Value | Visual | Notes |
|---|---|---|
| `seeker` | Homing bullets arc in from the flanks | See **Seeker options** below |
| `splash` | Ink/paint splatter burst at target | `fx.fromCaster` — flies in from caster before exploding |
| `bloom` | Floral/energy petal bloom at target | Soft nature/magic feel |

### Environmental / Supernatural

| Value | Visual | Notes |
|---|---|---|
| `smite` | Jagged lightning bolt falls from above; path is re-generated each cast | Heavenly / curse feel; path never repeats |
| `mortar` | Arcing shell with shrinking telegraph, shockwave + random shrapnel | `N = 8–12` fragments randomised each cast |
| `laserarc` | Single energy line that swings onto target along an arc | `fx.side` — which flank it swings from |

### Zone Pulse

| Value | Visual | Notes |
|---|---|---|
| `zone` | Zone pulse from the zone origin | Used by zone-behavior abilities; skin set via `fx.zone` |

---

## 2. Projectile Options

Applies when `strike: 'projectile'`.

| Field | Type | Effect |
|---|---|---|
| `fx.shape` | `'bolt' \| 'arrow' \| 'orb' \| 'leaf' \| 'wave'` | Visual shape of the travelling projectile |
| `fx.size` | `'s' \| 'm' \| 'l'` | Projectile size (px: s=10, m=14, l=20) |
| `fx.speed` | `number` | Pixels/ms. Lower = slower. Default 40. A range-5 bolt at speed 40 ≈ 210ms travel |
| `fx.trail` | `boolean` | Enable a motion trail |

---

## 3. Volley — `fx.volley`

Applies to `projectile` and `beam` strikes. Controls how many copies fire.

| Value | Count | Behaviour |
|---|---|---|
| `'single'` (or omit) | 1 | One shot / beam |
| `'double'` | 2 | Two shots slightly spread perpendicularly; beams fire simultaneously |
| `'flurry'` | 5 | ~5 fanned shots staggered by 50–55ms each |

---

## 4. Seeker Options

Applies when `strike: 'seeker'`.

| Field | Type | Effect |
|---|---|---|
| `fx.bullets` | `number` | How many seeker bullets (default 3) |
| `fx.fromCaster` | `'left' \| 'right' \| 'both' \| true \| false` | Arc origin. `'left'`/`'right'` launch from caster, arc in from that flank. `'both'` alternates sides. `true` = legacy alias for `'right'`. `false`/omit = converge from random flanks (unique each cast) |

---

## 5. Laserarc Options

Applies when `strike: 'laserarc'`.

| Field | Type | Effect |
|---|---|---|
| `fx.side` | `'left' \| 'right'` | Which flank the arc swings from. Omit = random each cast |

---

## 6. Wind-Up Styles — `delivery.windUpStyle`

Animates the **gem token** during the wind-up window. The gem plays a `.fx-wu-<name>` keyframe from `fx-casts.css` for `delivery.windUpMs` milliseconds, then the behavior fires.

### Charge / Pull-back

| Value | Motion | Best for |
|---|---|---|
| `'charge'` | Glowing orb implodes toward the caster | Magical charge-up, energy builds |
| `'melee'` | Pull back away from target then lunge forward | Short-range strikes, punches |
| `'recoil'` | Sharp kick away from target then snap back | Gun shots, kick-backs |
| `'pounce'` | Squat/compress then leap toward target | Animal attacks, dashes |
| `'heavy-drag'` | Slow draw back + rotation, then slam release | Heavy weapons, anchors, summons |

### Footwork

| Value | Motion | Best for |
|---|---|---|
| `'sidestep-l'` | Quick lateral dash left | Dodge-based abilities |
| `'sidestep-r'` | Quick lateral dash right | Dodge-based abilities |
| `'shuffle'` | Rapid L–R shuffle (4 steps) | Rapid feint / stance change |
| `'back-circle'` | Arc step back-and-around (behind the target angle) | Acrobatic / flanker |

### Ranged / Aim

| Value | Motion | Best for |
|---|---|---|
| `'ranged'` | Aim-up with brightness pulse + micro shake | Rifles, snipers, bows at medium range |
| `'pistol'` | Micro push toward target then snap forward | Pistol / quick-draw |
| `'bow'` | Draw back, hold at tension, release | Bow, crossbow |

### Elemental / Supernatural

| Value | Motion | Best for |
|---|---|---|
| `'fire'` | Quick flare (fast grid-fade; no displacement) | Fire casts, instant flares |
| `'levitate'` | Rise off ground + brightness surge, drop on fire | Caster AOEs, mage nukes |
| `'tremor'` | Rapid vibration shake (seismic) | Earth / shock abilities |
| `'spin'` | Full rotation | Spin attacks, whirlwind |

---

## 7. Cast-Shape Tile Class — `fx.castCls`

Overrides the **CSS animation class** applied to the tile eruption when an ability fires. The tile geometry is still controlled by `delivery.shape`.

| Value | Visual | Default for |
|---|---|---|
| `'fx-cast-wave'` | Animated water-wave on each tile | `wide_line` shape |
| `'fx-cast-line'` | Straight line flash | `line` shape and fallback |
| `'fx-cast-pcone'` | Fan eruption | `pcone` shape |
| `'fx-cast-circle'` | Radial burst | `circle` shape |
| *(any string)* | Your own CSS class from `fx-casts.css` | Custom |

Usage — make a `pcone` ability use the wave animation instead of the cone flash:
```typescript
fx: { castCls: 'fx-cast-wave' }
```

---

## 8. Zone Skins — `fx.zone`

Set on zone-behavior abilities. Controls the tileset rendered inside the zone footprint by `fx-zones.css`.

| Value | Theme |
|---|---|
| `'default'` | Generic glow |
| `'mecha'` | Tech grid, circuit lines (June 9) |
| `'flame'` | Fire tiles |
| `'wind'` | Swirling air |
| `'void'` | Dark void pulses |
| `'water'` | Ripple wave |
| `'slashes'` | Katana-mark grid |
| `'pulse'` | Concentric ring pulse |
| `'earth'` | Stone / crack pattern |
| `'poison'` | Bubbling toxin |
| `'frost'` | Ice crystal spread |
| `'holy'` | Divine radiance |
| `'storm'` | Static discharge |

---

## 9. Quick Reference — Full `FxSpec`

```typescript
fx: {
    // Strike
    strike: 'swipe' | 'reverseswipe' | 'claw' | 'stab' | 'flurry' | 'slam' | 'uppercut'
          | 'projectile' | 'bullet' | 'beam' | 'chain' | 'stream'
          | 'seeker' | 'splash' | 'bloom'
          | 'smite' | 'mortar' | 'laserarc'
          | 'zone',

    // Colour
    colors: ['#primary', '#secondary'],

    // Projectile
    shape:  'bolt' | 'arrow' | 'orb' | 'leaf' | 'wave',
    size:   's' | 'm' | 'l',
    speed:  number,          // px/ms, default 40
    trail:  boolean,

    // Multi-shot / beam
    volley: 'single' | 'double' | 'flurry',

    // Seeker
    bullets:     number,                              // default 3
    fromCaster:  'left' | 'right' | 'both' | true | false,

    // Laserarc
    side: 'left' | 'right',

    // Melee
    gashes: number,   // claw gash count, default 3
    hits:   number,   // flurry hit count, default 6

    // Cast-shape override
    castCls: 'fx-cast-line' | 'fx-cast-pcone' | 'fx-cast-circle' | 'fx-cast-wave' | string,

    // Zone
    zone: string,
    skin: 'default' | 'mecha' | 'flame' | 'wind' | 'void' | 'water'
        | 'slashes' | 'pulse' | 'earth' | 'poison' | 'frost' | 'holy' | 'storm',
}
```

---

## 10. Quick Reference — `delivery.windUpStyle`

```typescript
windUpStyle:
    // Charge / pull-back
    'charge' | 'melee' | 'recoil' | 'pounce' | 'heavy-drag'
    // Footwork
  | 'sidestep-l' | 'sidestep-r' | 'shuffle' | 'back-circle'
    // Ranged / aim
  | 'ranged' | 'pistol' | 'bow'
    // Elemental
  | 'fire' | 'levitate' | 'tremor' | 'spin'
```

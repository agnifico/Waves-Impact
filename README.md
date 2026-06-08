# Dawn's Journey v2

A fast-paced, 2D action-RPG engine built for seamless combat, dynamic team rotations, and deep mechanical expression. Inspired by modern action titles (Genshin Impact, Wuthering Waves), DJv2 prioritizes crisp game feel, precise geometry, and composable combat primitives.

## ⚔️ The Roster

| Character | Description |
| :---: | :--- |
| <img src="static/characters/avatars/sefyra.png" width="80" alt="Sefyra"> | **Sefyra**<br>**Wind ranged DPS.** Long range sniper who can charge up her shots and cut through crowds to hit her target. Can also group up large crowds of enemies. (Venti from Genshin // Elsu/Shouyue from AoV/HoK) |
| <img src="static/characters/avatars/frosty.png" width="80" alt="Frosty"> | **Frosty**<br>**Ice Summoner-Constructor.** A summoner-constructor who can call on Wolfie to fight her enemies, and raise icy pylons if enemies get too close. (Fischl/Zhongli skills from Genshin, Ishar from AoV) |
| <img src="static/characters/avatars/maria_elena2.png" width="80" alt="Maria Elena"> |**Maria Elena** <br> **Fire Close Combat Tank.** Fights close range, dealing tons of damage over time through her creation of burning zones. (Roxie from AoV) |
| <img src="static/characters/avatars/yara.png" width="80" alt="Yara"> | **Yara**<br>**Nature Healer.** Creates the *Sanctum of Verdance*, a persistent field zone that provides sustained healing and vital team buffs. (Verina from Wuthering Waves, Alice from AoV) |
| <img src="static/characters/avatars/ryoma.png" width="80" alt="Ryoma"> | **Ryoma**<br>**Dark Control Master.** Undecided - Synergy with Maria Elena with zone overlap. |
| <img src="static/characters/avatars/midorima.png" width="80" alt="midorima"> | **Midorima** <br> **Wind Ninja.** Relies on fast, AoE basic attacks and agility to move around on Constructs, dealing high damage and being elusive. Also has a strong finisher. |
| <img src="static/characters/avatars/cedric.png" width="80" alt="Cedric"> | **Cedric**<br>**Earth Defender.** Undecided - Main DPS. Undying, will sleep for 10s before resurrecting. |
| <img src="static/characters/avatars/marina.png" width="80" alt="Marina"> |**Marina** <br> **Hydro Enchanter.** Undecided - Summons Water fields, utilising them for damage, control, and elusiveness. |

## 🛠️ Combat Engine Architecture

The core of DJv2 is its **Data Contract Philosophy**: *Characters are data, never code.* Adding a new character is simply a matter of authoring a new JSON recipe. 

* **Shape / Behavior Split:** "Shapes" (pure geometric targeting like cones, lines, and circles) are strictly separated from "Behaviors" (resolution classes like `damage_aoe`, `summon`, `dash`). This matrix allows for endless, robust combinations without bloating the engine.
* **Status Engine:** A comprehensive effect pipeline where statuses can stack, decay, modify stats, intercept damage, and transform via reaction tables.
* **Dynamic Rotations:** Fast, responsive off-field energy sharing, precise intro/outro action triggers, and lazy-recharging multi-charge abilities maintain combat momentum.
* **Strata & Terrain:** Advanced spatial logic supporting `ground`, `flying`, and `swimming` combatants, plus obstacle height and platforming interactions.

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the SvelteKit dev server: `npm run dev`
4. Jump in and test the roster!

---
*Built for the love of 2D action.*
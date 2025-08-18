# 🌌 Warhammer 40K: Omega Vault

**Warhammer 40K: Omega Vault** is a web-based, multiplayer online board game set in the grimdark universe of Warhammer 40,000. Choose iconic characters from legendary factions and battle for galactic supremacy — or race to unlock the mysterious Omega Vault at the center of the board.

---

## 🎮 Core Gameplay Mechanics

- **Turn-Based Play**: Players act in a fixed order. Only the active player can move or act during their turn.
- **Dice Movement**: Movement is determined by rolling a die. The number rolled equals the number of spaces the player must move.
- **Interactive Board**: After rolling, valid movement paths are highlighted. Players click to confirm their chosen direction.

---

## 🗺️ Game Board

- **Structure**: 40 circular tiles arranged in two concentric rings (outer and inner).
- **Transition Points**: Only 4 tiles allow movement between rings.
- **Faction Zones**:
  - Space Marines
  - Eldar
  - Orks
  - Chaos
- **Omega Vault**: A 41st tile at the center of the board — the ultimate objective.
- **Unique Tile Names**: Each tile has a distinct name for immersion and strategy.

---

![Warhammer 40K: Omega Vault](w40k.jpeg)


## 👥 Multiplayer & Character Selection

- **Player Setup**: Players enter a name and select a unique character. No duplicates allowed.
- **Faction-Based Characters**: 12 starting characters (3 per faction), each with lore-accurate stats and abilities.
- **Spawn Points**: Each character spawns on a fixed tile based on their faction.

### 🧬 Stats System

| Stat | Description |
|------|-------------|
| HP   | Health Points |
| ATK  | Attack |
| DEF  | Defense |
| PSY  | Psychic Power |
| RES  | Resistance |

- **Death & Elimination**: If HP ≤ 0, the character dies and is removed from the game.

---

## 🎒 Inventory System

- Players maintain an inventory of items acquired through loot or PvP.
- Items can modify character stats and influence combat outcomes.

---

## 🃏 Deck System

There are 6 modular decks stored in separate files:

### Faction Event Decks (4 total)
- 20 cards per faction
- On own faction tile: minor negative event
- On enemy faction tile: major challenge (battle) + loot

### Item Deck
- 20 equipment cards that modify stats

### Enemy Deck
- 20 enemy cards used in PvE battles
- Each card reveals its effects upon draw

---

## ⚔️ Combat System

### PvE Combat
- Triggered by drawing a battle card from a faction deck
- Player draws an enemy from the enemy deck

**Combat Formula**:

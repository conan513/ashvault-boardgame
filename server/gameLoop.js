const cdDeck = require("./decks/cyber_dwarves.json");
const okDeck = require("./decks/order_of_knights.json");
const gbDeck = require("./decks/graveborn.json");
const hgDeck = require("./decks/the_hollow_grove.json");
const eqDeck = require("./decks/equipment.json");
const enDeck = require("./decks/enemies.json");
const gyDeck = require("./decks/graveyard.json");
const tpDeck = require("./decks/temple.json");
const vlDeck = require("./decks/village.json");
const tvDeck = require("./decks/tavern.json");
const acDeck = require("./decks/ashen_circle.json"); // Ashen Circle

let decksState = {};    // aktív húzópaklik
let discardsState = {}; // dobópaklik

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Eredeti teljes pakli betöltése és keverése
function initDeck(faction) {
  let src;
  switch (faction) {
    case "Order of Knights": src = okDeck; break;
    case "The Hollow Grove": src = hgDeck; break;
    case "Cyber Dwarves":    src = cdDeck; break;
    case "Graveborn":        src = gbDeck; break;

    case "Graveyard":        src = gyDeck; break;
    case "Temple":           src = tpDeck; break;
    case "Village":          src = vlDeck; break;
    case "Tavern":           src = tvDeck; break;

    // ÚJ eset:
    case "Ashen Circle":     src = acDeck; break;

    case "Equipment":        src = eqDeck; break;
    case "Enemies":          src = enDeck; break;
  }
  decksState[faction]   = shuffle(src);
  discardsState[faction] = [];
}

// Dobópakli visszakeverése húzópakliba
function reshuffleDeck(faction) {
  if (!discardsState[faction] || discardsState[faction].length === 0) return;
  // keverjük a dobópaklit
  const shuffledDiscard = shuffle(discardsState[faction]);
  // hozzáadjuk a húzópaklihoz
  decksState[faction].push(...shuffledDiscard);
  // ürítjük a dobópaklit
  discardsState[faction] = [];
}

// Húzás bármilyen pakliból
function drawCard(faction) {
  // ha nincs húzópakli → dobópakli visszakeverés
  if (!decksState[faction] || decksState[faction].length === 0) {
    reshuffleDeck(faction);
    // ha még így sincs lap → teljes újrainit
    if (!decksState[faction] || decksState[faction].length === 0) {
      initDeck(faction);
    }
  }
  return decksState[faction].shift();
}

// Lap eldobása (pl. elhasználás után)
function discardCard(faction, card) {
  if (!discardsState[faction]) discardsState[faction] = [];
  discardsState[faction].push(card);
}

// Speciális draw segédfüggvények
function drawFactionCard(faction) { return drawCard(faction); }
function drawEquipmentCard()      { return drawCard("Equipment"); }
function drawEnemyCard()          { return drawCard("Enemies"); }

function resetDecksState() {
  initDeck("Order of Knights");
  initDeck("The Hollow Grove");
  initDeck("Cyber Dwarves");
  initDeck("Graveborn");

  initDeck("Graveyard");
  initDeck("Temple");
  initDeck("Village");
  initDeck("Tavern");

  // ÚJ
  initDeck("Ashen Circle");

  initDeck("Equipment");
  initDeck("Enemies");
}

module.exports = {
  drawFactionCard,
  drawEquipmentCard,
  drawEnemyCard,
  discardCard,
  resetDecksState
};

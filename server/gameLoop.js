const smDeck = require("./decks/spaceMarines.json");
const elDeck = require("./decks/eldar.json");
const okDeck = require("./decks/orks.json");
const chDeck = require("./decks/chaos.json");
const eqDeck = require("./decks/equipment.json");
const enDeck = require("./decks/enemies.json");

let decksState = {};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Inicializál egy adott paklit
function initDeck(faction) {
  switch (faction) {
    case "Space Marines": decksState[faction] = shuffle(smDeck); break;
    case "Eldar":         decksState[faction] = shuffle(elDeck); break;
    case "Orks":          decksState[faction] = shuffle(okDeck); break;
    case "Chaos":         decksState[faction] = shuffle(chDeck); break;
    case "Equipment":     decksState[faction] = shuffle(eqDeck); break;
    case "Enemies":       decksState[faction] = shuffle(enDeck); break;
  }
}

// Húzás adott frakcióból
function drawFactionCard(faction) {
  if (!decksState[faction] || decksState[faction].length === 0) {
    initDeck(faction);
  }
  return decksState[faction].shift();
}

// Húzás item pakliból
function drawEquipmentCard() {
  if (!decksState["Equipment"] || decksState["Equipment"].length === 0) {
    initDeck("Equipment");
  }
  return decksState["Equipment"].shift();
}

// Húzás enemy pakliból
function drawEnemyCard() {
  if (!decksState["Enemies"] || decksState["Enemies"].length === 0) {
    initDeck("Enemies");
  }
  return decksState["Enemies"].shift();
}

// Összes pakli resetelése (pl. új játék induláskor)
function resetDecksState() {
  initDeck("Space Marines");
  initDeck("Eldar");
  initDeck("Orks");
  initDeck("Chaos");
  initDeck("Equipment");
  initDeck("Enemies");
}

module.exports = { drawFactionCard, drawEquipmentCard, drawEnemyCard, resetDecksState };

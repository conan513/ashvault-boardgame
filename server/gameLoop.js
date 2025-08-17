// server/gameLoop.js
const smDeck = require("./decks/spaceMarines.json");
const elDeck = require("./decks/eldar.json");
const okDeck = require("./decks/orks.json");
const chDeck = require("./decks/chaos.json");
const eqDeck = require("./decks/equipment.json");
const enDeck = require("./decks/enemies.json");

let decksState = null;
function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function resetDecksState(){
  decksState = {
    "Space Marines": shuffle(smDeck),
    "Eldar": shuffle(elDeck),
    "Orks": shuffle(okDeck),
    "Chaos": shuffle(chDeck),
    "Equipment": shuffle(eqDeck),
    "Enemies": shuffle(enDeck)
  };
}
function drawFactionCard(faction){
  if (!decksState || !decksState[faction] || decksState[faction].length===0) resetDecksState();
  return decksState[faction].shift();
}
function drawEquipmentCard(){
  if (!decksState || decksState["Equipment"].length===0) resetDecksState();
  return decksState["Equipment"].shift();
}
function drawEnemyCard(){
  if (!decksState || decksState["Enemies"].length===0) resetDecksState();
  return decksState["Enemies"].shift();
}
module.exports = { drawFactionCard, drawEquipmentCard, drawEnemyCard, resetDecksState };

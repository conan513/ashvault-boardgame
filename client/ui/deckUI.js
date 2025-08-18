// client/ui/deckUI.js
function renderCard(payload) {
  const v = document.getElementById("cardView");
  if (!payload) { v.innerHTML = ""; return; }

  const { type, faction, card } = payload;
  let fcls = "";

  if (faction) {
    fcls = faction === "Space Marines" ? "faction-sm"
    : faction === "Eldar" ? "faction-el"
    : faction === "Orks" ? "faction-ok"
    : faction === "Chaos" ? "faction-ch"
    : "";
  }

  // Korábbi tartalom törlése
  v.innerHTML = '';

  // Kártya típusának megfelelő feldolgozás
  let content = '';

  // Faction kártya renderelése
  if (type === "FACTION") {
    let effectText = [];

    // Self effect kezelése
    if (card.selfEffect) {
      if (card.selfEffect.effect === "battle") {
        effectText.push("<b>Önálló hatás:</b> Harc");
      } else {
        effectText.push(`<b>Self:</b> ${JSON.stringify(card.selfEffect)}`);
      }
    }

    // Other effect kezelése
    if (card.otherEffect) {
      if (card.otherEffect.hpDelta) {
        effectText.push(`<b>Ellenséges hatás:</b> HP csökkentés: ${card.otherEffect.hpDelta}`);
      } else {
        effectText.push(`<b>Other:</b> ${JSON.stringify(card.otherEffect)}`);
      }
    }

    content = `
    <div class="card">
    <div class="title">${card.name}</div>
    <div class="faction ${fcls}">${faction}</div>
    <div class="text">${card.description}</div>
    <div class="meta">${effectText.join(" | ")}</div>
    </div>`;
  }

  v.innerHTML = content;
  console.log('Rendered card:', content);
}

function renderEnemy(enemy) {
  const v = document.getElementById("cardView");
  v.innerHTML = `
  <div class="card">
  <div class="title">Ellenfél</div>
  <div class="text"><b>${enemy.name}</b> — ATK:${enemy.ATK} DEF:${enemy.DEF} HP:${enemy.HP}</div>
  </div>`;
}

window.renderCard = renderCard;
window.renderEnemy = renderEnemy;

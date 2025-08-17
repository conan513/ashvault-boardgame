// client/ui/deckUI.js
function renderCard(payload) {
  const v = document.getElementById("cardView");
  if (!payload) { v.innerHTML = ""; return; }
  const fcls = payload.faction === "Space Marines" ? "faction-sm"
              : payload.faction === "Eldar" ? "faction-el"
              : payload.faction === "Orks" ? "faction-ok"
              : "faction-ch";
  const { card } = payload;
  v.innerHTML = `
    <div class="card">
      <div class="title">${card.title}</div>
      <div class="faction ${fcls}">${payload.faction}</div>
      <div class="text">${card.text}</div>
      <div class="meta">effect: <b>${card.effect}</b> | loot: <b>${card.loot ? 'igen':'nem'}</b> ${card.hpDelta ? '| HP: '+card.hpDelta:''}</div>
    </div>`;
}
function renderEnemy(enemy) {
  const v = document.getElementById("cardView");
  const prev = v.innerHTML;
  v.innerHTML = prev + `
    <div class="card" style="margin-top:6px">
      <div class="title">Ellenfél</div>
      <div class="text"><b>${enemy.name}</b> — ATK:${enemy.ATK} DEF:${enemy.DEF} HP:${enemy.HP}</div>
    </div>`;
}
window.renderCard = renderCard;
window.renderEnemy = renderEnemy;

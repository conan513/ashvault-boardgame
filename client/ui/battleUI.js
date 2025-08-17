// client/ui/battleUI.js
function renderBattle(data) {
  const v = document.getElementById("battleView");
  if (!data) { v.innerHTML = ""; return; }

  if (data.type === "PVE") {
    const { result, playerId, enemy } = data;
    v.innerHTML = `
      <div class="line"><b>PVE csata</b> ${short(playerId)} vs <i>${enemy.name}</i></div>
      <div class="line">Dobások: Játékos ${result.rollP} (össz: ${result.totalP}) | Ellenfél ${result.rollE} (össz: ${result.totalE})</div>
      <div class="line">Győztes: <b>${result.winner === "player" ? short(playerId) : enemy.name}</b> | Sebzés: ${result.damage}</div>`;
  } else if (data.type === "PVP") {
    const { result, aId, bId } = data;
    v.innerHTML = `
      <div class="line"><b>PVP csata</b> ${short(aId)} vs ${short(bId)}</div>
      <div class="line">Dobások: ${short(aId)} ${result.rolls.A} (össz: ${result.totals.A}) | ${short(bId)} ${result.rolls.B} (össz: ${result.totals.B})</div>
      <div class="line">Győztes: <b>${result.winner === "A" ? short(aId) : short(bId)}</b> | Sebzéskülönbség: ${result.damage} (vesztes -5 HP)</div>`;
  }
}
function short(id){ const p = window.GAME?.players?.[id]; return p ? p.name : id?.slice(0,4); }
window.renderBattle = renderBattle;

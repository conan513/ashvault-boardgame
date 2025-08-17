// client/app.js
const socket = io();
let MY_ID = null;
window.GAME = null;
let LAST_DICE = null;
let LAST_TARGETS = [];

const $ = sel => document.querySelector(sel);

const rollBtn = $("#rollBtn");
const diceOut = $("#diceOut");

socket.on("connect", () => {
  MY_ID = socket.id;
});

// a szoba kiválasztás után jön a hello
socket.on("hello", ({ factions, characters }) => {
  renderCharacterSelect(characters);
});

socket.on("updateGame", (state) => {
  window.GAME = state;
  renderBoard(GAME);
  renderPlayers(GAME);
  updateTurnUI();
  if (!GAME.pvpPending) renderBattle(null);
});

socket.on("turnChanged", (playerId) => {
  updateTurnUI(playerId);
});

socket.on("diceResult", ({ dice, targets }) => {
  LAST_DICE = dice;
  LAST_TARGETS = targets;
  diceOut.textContent = `Dobás: ${dice}`;
  highlightTargets(targets, (targetId) => {
    socket.emit("confirmMove", { dice, targetCellId: targetId });
    clearHighlights();
  });
});

socket.on("cardDrawn", (payload) => { renderCard(payload); });
socket.on("enemyDrawn", (enemy) => { renderEnemy(enemy); });
socket.on("battleResult", (data) => { renderBattle(data); });
socket.on("itemLooted", ({ playerId, item }) => { showToast(`🎁 ${shortName(playerId)} kapta: ${item.name}`); });
socket.on("itemStolen", ({ from, to, item }) => { showToast(`🗡️ ${shortName(to)} ellopta ${shortName(from)} tárgyát: ${item.name}`); });
socket.on("playerDied", ({ playerId }) => { showToast(`💀 ${shortName(playerId)} elesett!`); });
socket.on("pvpStarted", ({ aId, bId, cellName }) => {
  showToast(`⚔️ PVP ${shortName(aId)} vs ${shortName(bId)} @ ${cellName}`);
  socket.emit("resolvePVP");
});
socket.on("errorMsg", (m) => alert(m));

function shortName(pid){ const p = GAME?.players?.[pid]; return p ? p.name : pid; }

// Join form + Room form
document.addEventListener("DOMContentLoaded", () => {

  // szoba form
  $("#roomForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#roomName").value.trim();
    if (!name) return;
    socket.emit("createOrJoinRoom", { roomName: name });
  });

  socket.on("roomJoined", ({ roomName }) => {
    $("#roomPanel").style.display = "none";   // szoba panel eltűnik
    $("#joinPanel").style.display = "block";  // karakterválasztó megjelenik
  });

  // karakter választó
  $("#joinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#playerName").value.trim();
    const sel = document.querySelector("input[name='charPick']:checked");
    if (!sel) return alert("Válassz karaktert!");
    socket.emit("joinGame", { playerName: name, characterId: sel.value });
    $("#joinPanel").style.display = "none";
  });

  rollBtn.addEventListener("click", () => {
    socket.emit("rollDice");
  });
});

function updateTurnUI() {
  if (!GAME) return;
  const current = GAME.currentPlayer;
  const mine = (current === MY_ID);
  $("#turnInfo").innerHTML = mine
  ? `<span class="badge turn">A te köröd</span>`
  : `Most: <b>${shortName(current) || "-"}</b>`;
  rollBtn.disabled = !mine;
}

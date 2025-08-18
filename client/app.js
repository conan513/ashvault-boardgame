// client/app.js
const socket = io();
let MY_ID = null;
window.GAME = null;
let LAST_DICE = null;
let LAST_TARGETS = [];
let canRoll = true; // Hozzáadva a dobás engedélyezésének ellenőrzéséhez

const $ = sel => document.querySelector(sel);

const rollBtn = $("#rollBtn");
const endTurnBtn = $("#endTurnBtn");
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
  const mine = (playerId === MY_ID);
  $("#turnInfo").innerHTML = mine
  ? `<span class="badge turn">A te köröd</span>`
  : `Most: <b>${shortName(playerId) || "-"}</b>`;

  // Ellenőrizzük, hogy dobhatok-e (csak az aktuális játékosnak)
  rollBtn.disabled = !mine || !canRoll;
  endTurnBtn.disabled = !mine;

  // Reset the roll button state after the turn changes
  if (mine) {
    canRoll = true;  // Ha én következem, akkor újra dobhatok
  }
});


socket.on("diceResult", ({ dice, targets, playerId }) => {
  LAST_DICE = dice;
  LAST_TARGETS = targets;

  if (playerId === MY_ID) {
    diceOut.textContent = `Dobás: ${dice}`;

    const myCell = GAME.board.find(c => c.id === GAME.players[MY_ID].position);
    if (!myCell) return;

    const myRing = myCell.ring;
    // összes mező ebben a gyűrűben, sorrendben ID szerint
    const ringCells = GAME.board
    .filter(c => c.ring === myRing)
    .sort((a,b) => a.id - b.id);

    // pozícióm indexe a gyűrűn belül
    const myIdx = ringCells.findIndex(c => c.id === myCell.id);
    const size = ringCells.length;

    // két irányban a 'dice' lépésnyire lévő mezők
    const target1 = ringCells[(myIdx + dice) % size].id;
    const target2 = ringCells[(myIdx - dice + size) % size].id;

    highlightTargets([target1, target2], (targetId) => {
      socket.emit("confirmMove", { dice, targetCellId: targetId });
      clearHighlights();
    });
  } else {
    showToast(`🎲 ${shortName(playerId)} dobott: ${dice}`);
  }
});

socket.on("cardDrawn", (payload) => { renderCard(payload); });
socket.on("enemyDrawn", (enemy) => { renderEnemy(enemy); });
socket.on("battleResult", (data) => { renderBattle(data); });
socket.on("itemLooted", ({ playerId, item }) => {
  showToast(`🎁 ${shortName(playerId)} kapta: ${item.name}`);

  const view = document.getElementById("cardView");
  view.innerHTML = `
  <div class="card">
  <div class="title">${item.name}</div>
  <img src="${item.image}" alt="${item.name}" style="max-width:100%; border-radius:6px; margin-top:6px;" />
  </div>
  `;
});
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
    if (canRoll) { // Csak akkor engedélyezett, ha nem dobtam még
      socket.emit("rollDice");
      canRoll = false; // Lezárjuk a dobást a kör végéig
    }
  });

  endTurnBtn.addEventListener("click", () => {
    socket.emit("endTurn");
    canRoll = true; // Újra engedélyezzük a dobást, amikor a kör véget ér
  });
});

function updateTurnUI() {
  if (!GAME) return;
  const current = GAME.currentPlayer;
  const mine = (current === MY_ID);
  $("#turnInfo").innerHTML = mine
  ? `<span class="badge turn">A te köröd</span>`
  : `Most: <b>${shortName(current) || "-"}</b>`;
  rollBtn.disabled = !mine || !canRoll; // Ha nem az én köröm, vagy már dobtam, akkor letiltva
  endTurnBtn.disabled = !mine;
}

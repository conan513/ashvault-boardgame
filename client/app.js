// client/app.js
const socket = io();
let MY_ID = null;
window.GAME = null;
let LAST_DICE = null;
let LAST_TARGETS = [];
let canRoll = true; // dobás engedélyezésének ellenőrzéséhez

// reconnect adatok megőrzése
let LAST_ROOM = null;
let LAST_NAME = null;
let LAST_CHAR = null;

const $ = sel => document.querySelector(sel);

const rollBtn = $("#rollBtn");
const endTurnBtn = $("#endTurnBtn");
const diceOut = $("#diceOut");

socket.on("connect", () => {
  MY_ID = socket.id;

  // ha újracsatlakoztunk és volt szoba/név
  if (LAST_ROOM && LAST_NAME && LAST_CHAR) {
    socket.emit("createOrJoinRoom", { roomName: LAST_ROOM });
    setTimeout(() => {
      socket.emit("joinGame", { playerName: LAST_NAME, characterId: LAST_CHAR });
    }, 500);
  }
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

  rollBtn.disabled = !mine || !canRoll;
  endTurnBtn.disabled = !mine;

  if (mine) {
    canRoll = true;
  }
});

socket.on("diceResult", ({ dice, targets, playerId }) => {
  LAST_DICE = dice;
  LAST_TARGETS = targets;

  if (playerId === MY_ID) {
    //diceOut.textContent = `Dobás: ${dice}`;

    const myCell = GAME.board.find(c => c.id === GAME.players[MY_ID].position);
    if (!myCell) return;

    const myRing = myCell.ring;
    const ringCells = GAME.board
    .filter(c => c.ring === myRing)
    .sort((a,b) => a.id - b.id);

    const myIdx = ringCells.findIndex(c => c.id === myCell.id);
    const size = ringCells.length;

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

socket.on("diceResult", ({ dice }) => {
  const diceIcon = $("#diceIcon");
  const diceNumber = $("#diceNumber");

  diceIcon.classList.remove("rolling");
  diceNumber.textContent = dice;
});

socket.on("cardDrawn", ({ playerId, card, type }) => {
  if (type === "FACTION") {
    showToast(`🃏 ${shortName(playerId)} húzott egy frakció lapot: ${card.name}`);
  }

  const view = document.getElementById("cardView");
  view.innerHTML = `
  <div class="card">
  <div class="title">${card.name}</div>
  <p>${card.description || ""}</p>
  ${card.image ? `<img src="${card.image}" alt="${card.name}" style="max-width:100%; border-radius:6px; margin-top:6px;" />` : ""}
  </div>
  `;
});

// Chat küldés
sendChatBtn.addEventListener("click", () => {
  const message = chatInput.value.trim();
  if (message) {
    socket.emit("sendChat", { message, playerId: MY_ID });
    chatInput.value = ''; // Törlés
  }
});

// Chat üzenet fogadás
socket.on("receiveChat", ({ playerId, message }) => {
  const player = GAME?.players?.[playerId] || { name: playerId };
  chatLog.innerHTML += `<p><strong>${player.name}:</strong> ${message}</p>`;
  chatLog.scrollTop = chatLog.scrollHeight;
  const chatPanel = document.getElementById("chatPanel");
  const toggleChatBtn = document.getElementById("toggleChatBtn");

  // Ha a chatpanel épp nincs nyitva, jelezz a gombon
  if (!chatPanel.classList.contains("show")) {
    toggleChatBtn.classList.add("notify");
  }
});

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
  // Chat popup nyitás/zárás
  const chatPanel = document.getElementById("chatPanel");
  const toggleChatBtn = document.getElementById("toggleChatBtn");

  toggleChatBtn.addEventListener("click", () => {
    chatPanel.classList.toggle("show");

    // Ha kinyitottad a chatet, szedd le az értesítő animációt
    if (chatPanel.classList.contains("show")) {
      toggleChatBtn.classList.remove("notify");
    }
  });

  // szoba form
  $("#roomForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#roomName").value.trim();
    if (!name) return;
    LAST_ROOM = name; // elmentjük reconnecthez
    socket.emit("createOrJoinRoom", { roomName: name });
  });

  socket.on("roomJoined", ({ roomName }) => {
    document.getElementById("roomPanel").style.display = "none";
    document.getElementById("charOverlay").style.display = "flex"; // overlay megnyit
  });

  // karakter választó
  $("#joinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#playerName").value.trim();
    const sel = document.querySelector("input[name='charPick']:checked");
    if (!sel) return alert("Válassz karaktert!");
    LAST_NAME = name;       // reconnecthez mentjük
    LAST_CHAR = sel.value;
    socket.emit("joinGame", { playerName: name, characterId: sel.value });
    $("#joinPanel").style.display = "none";
  });

  rollBtn.addEventListener("click", () => {
    if (!canRoll) return;

    canRoll = false;

    const icon = $("#diceIcon");
    const number = $("#diceNumber");
    icon.classList.add("rolling");

    let animInterval = setInterval(() => {
      number.textContent = Math.floor(Math.random() * 6) + 1;
    }, 100);

    setTimeout(() => {
      clearInterval(animInterval);
      icon.classList.remove("rolling");
      socket.emit("rollDice");
    }, 1000);
  });

  endTurnBtn.addEventListener("click", () => {
    socket.emit("endTurn");
    canRoll = true;
  });

});

function updateTurnUI() {
  if (!GAME) return;
  const current = GAME.currentPlayer;
  const mine = (current === MY_ID);
  $("#turnInfo").innerHTML = mine
  ? `<span class="badge turn">A te köröd</span>`
  : `Most: <b>${shortName(current) || "-"}</b>`;
  rollBtn.disabled = !mine || !canRoll;
  endTurnBtn.disabled = !mine;
}

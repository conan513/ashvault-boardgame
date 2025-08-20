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
const chatLog = $("#chatLog");
const chatInput = $("#chatInput");
const sendChatBtn = $("#sendChatBtn");

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

  if (mine) canRoll = true;
});

socket.on("diceResult", ({ dice, targets, playerId }) => {
  LAST_DICE = dice;
  LAST_TARGETS = targets;

  if (playerId === MY_ID) {
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

  const view = $("#cardView");
  view.innerHTML = `
  <div class="card">
  <div class="title">${card.name}</div>
  <p>${card.description || ""}</p>
  ${card.image ? `<img src="${card.image}" alt="${card.name}" style="max-width:100%; border-radius:6px; margin-top:6px;" />` : ""}
  </div>
  `;
});

socket.on("enemyDrawn", (enemy) => { renderEnemy(enemy); });
socket.on("battleResult", (data) => { renderBattle(data); });
socket.on("itemLooted", ({ playerId, item }) => {
  showToast(`🎁 ${shortName(playerId)} kapta: ${item.name}`);
  const view = $("#cardView");
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

socket.on("receiveChat", ({ playerId, message }) => {
  const player = GAME?.players?.[playerId] || { name: playerId };
  chatLog.innerHTML += `<p><strong>${player.name}:</strong> ${message}</p>`;
  chatLog.scrollTop = chatLog.scrollHeight;
  if (!$("#chatPanel").classList.contains("show")) $("#toggleChatBtn").classList.add("notify");
});

sendChatBtn.addEventListener("click", () => {
  const message = chatInput.value.trim();
  if (message) {
    socket.emit("sendChat", { message, playerId: MY_ID });
    chatInput.value = '';
  }
});

function shortName(pid){ const p = GAME?.players?.[pid]; return p ? p.name : pid; }

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

document.addEventListener("DOMContentLoaded", () => {
  const chatPanel = $("#chatPanel");
  const toggleChatBtn = $("#toggleChatBtn");

  toggleChatBtn.addEventListener("click", () => {
    chatPanel.classList.toggle("show");
    if (chatPanel.classList.contains("show")) toggleChatBtn.classList.remove("notify");
  });

    // === FŐMENÜ kezelése ===
    const menuOverlay = $("#menuOverlay");
    const createRoomForm = $("#createRoomForm");
    const createRoomName = $("#createRoomName");
    const menuLangSelect = $("#menuLangSelect");
    const howToBtn = $("#howToBtn");
    const creditsBtn = $("#creditsBtn");
    const howToOverlay = $("#howToOverlay");
    const creditsOverlay = $("#creditsOverlay");
    const closeHowTo = $("#closeHowTo");

    menuLangSelect.addEventListener("change", () => {
      showToast(`Language set to: ${menuLangSelect.value}`);
    });
    howToBtn.addEventListener("click", () => { howToOverlay.style.display = "flex"; });
    creditsBtn.addEventListener("click", () => { creditsOverlay.style.display = "flex"; });
    closeHowTo.addEventListener("click", () => { howToOverlay.style.display = "none"; });

    // === Szoba létrehozás ===
    createRoomForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = createRoomName.value.trim();
      if (!name) return;
      LAST_ROOM = name;
      socket.emit("createOrJoinRoom", { roomName: name });
    });

    // === Szobalista és csatlakozás ===
    const joinOverlay = $("#joinOverlay");
    const roomListDiv = $("#roomList");
    $("#openJoinOverlayBtn").addEventListener("click", () => {
      joinOverlay.style.display = "flex";
      socket.emit("listRooms");
    });
    $("#closeJoinOverlay").addEventListener("click", () => {
      joinOverlay.style.display = "none";
    });

    socket.on("roomList", (rooms) => {
      roomListDiv.innerHTML = "";
      if (rooms.length === 0) {
        roomListDiv.innerHTML = "<p>Nincsenek aktív szobák.</p>";
        return;
      }
      rooms.forEach(room => {
        const btn = document.createElement("button");
        btn.textContent = `${room.name} (${room.players} játékos)`;
        btn.addEventListener("click", () => {
          LAST_ROOM = room.name;
          socket.emit("createOrJoinRoom", { roomName: room.name });
          joinOverlay.style.display = "none";
          menuOverlay.style.display = "none";
        });
        roomListDiv.appendChild(btn);
      });
    });

    // Ha sikerült csatlakozni a szobához
    socket.on("roomJoined", ({ roomName }) => {
      menuOverlay.style.display = "none";
      $("#charOverlay").style.display = "flex";
    });

    // === Karakter választó ===
    $("#joinForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#playerName").value.trim();
      const sel = document.querySelector("input[name='charPick']:checked");
      if (!sel) return alert("Válassz karaktert!");
      LAST_NAME = name;
      LAST_CHAR = sel.value;
      socket.emit("joinGame", { playerName: name, characterId: sel.value });
      $("#charOverlay").style.display = "none";
    });

    // === Vissza gomb a karakterválasztón ===
    $("#backFromCharBtn")?.addEventListener("click", () => {
      socket.emit("leaveRoom");
      $("#charOverlay").style.display = "none";
      menuOverlay.style.display = "flex";
      LAST_ROOM = null;
      LAST_NAME = null;
      LAST_CHAR = null;
    });

    // Dice roll
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

    // End turn
    endTurnBtn.addEventListener("click", () => {
      socket.emit("endTurn");
      canRoll = true;
    });
});

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

const playerNameInput = $("#playerName"); // főmenü név mező

// === NÉV kezelése localStorage-ban ===
window.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("playerName");
  if (savedName) {
    $("#playerName").value = savedName;
    LAST_NAME = savedName;
  }
});

$("#playerName").addEventListener("input", () => {
  LAST_NAME = $("#playerName").value.trim();
  localStorage.setItem("playerName", LAST_NAME);
});

function ensurePlayerName() {
  const name = playerNameInput.value.trim();
  if (!name) {
    alert("⚠️ Please enter your name first!");
    playerNameInput.focus();
    return false;
  }
  LAST_NAME = name;
  localStorage.setItem("playerName", name);
  return true;
}

// === SOCKET események ===
socket.on("errorMsg", (m) => {
  showToast(`❌ ${m}`);

  // Ha szoba létrehozás / csatlakozás közben jön hiba, akkor vissza a menübe
  const menuOverlay = $("#menuOverlay");
  const joinOverlay = $("#joinOverlay");
  const charOverlay = $("#charOverlay");
  const lobbyOverlay = $("#lobbyOverlay");

  if (joinOverlay) joinOverlay.style.display = "none";
  if (charOverlay) charOverlay.style.display = "none";
  if (lobbyOverlay) lobbyOverlay.style.display = "none";
  if (menuOverlay) menuOverlay.style.display = "flex";

  LAST_ROOM = null;
  LAST_NAME = null;
  LAST_CHAR = null;
});

socket.on("connect", () => {
  MY_ID = socket.id;

  // ha újracsatlakoztunk és volt szoba/név
  if (LAST_ROOM && LAST_NAME && LAST_CHAR) {
    socket.emit("createOrJoinRoom", { roomName: LAST_ROOM, create: false, playerName: LAST_NAME });
    setTimeout(() => {
      socket.emit("joinGame", { playerName: LAST_NAME, characterId: LAST_CHAR });
    }, 500);
  }
});

socket.on("hello", ({ factions, characters }) => {
  console.log("Received characters:", characters);  // Ellenőrizd, hogy itt van-e adat
  renderCharacterSelect(characters);  // Karakterek renderelése
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
  ? `<span class="badge turn">Your turn</span>`
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
  console.log("Card Data:", card);  // Debugging

  if (type === "FACTION") {
    showToast(`🃏 ${shortName(playerId)} drew a faction card: ${card.name}`);
  }

  // Kártya adatok megjelenítése
  if (card) {
    const cardName = $("#cardName");
    const cardFaction = $("#cardFaction");
    const cardDescription = $("#cardDescription");
    const cardEffect = $("#cardEffect");
    const cardImageContainer = $("#cardImageContainer");

    cardName.textContent = card.name || "No name";
    cardFaction.textContent = card.faction || "No faction";
    cardDescription.textContent = card.description || "No description available.";
    cardEffect.textContent = card.effect || "No effect";

    // Kép megjelenítése, ha van
    if (card.image) {
      cardImageContainer.innerHTML = `<img src="${card.image}" alt="${card.name}" style="max-width:100%; border-radius:6px; margin-top:6px;" />`;
    } else {
      cardImageContainer.innerHTML = "";
    }

    const cardOverlay = $("#cardOverlay");
    if (cardOverlay) {
      cardOverlay.style.display = "flex";  // Overlay megjelenítése
      console.log("Card overlay displayed");
    }
  } else {
    console.error("No card data received!");
  }
});


$("#closeCardViewBtn").addEventListener("click", () => {
  const cardOverlay = $("#cardOverlay");
  cardOverlay.style.display = "none";  // Elrejtjük az overlay-t
});

socket.on("enemyDrawn", (enemy) => { renderEnemy(enemy); });
socket.on("battleResult", (data) => { renderBattle(data); });
socket.on("itemLooted", ({ playerId, item }) => {
  showToast(`🎁 ${shortName(playerId)} received: ${item.name}`);
  const view = $("#cardView");
  view.innerHTML = `
  <div class="card">
  <div class="title">${item.name}</div>
  <img src="${item.image}" alt="${item.name}" style="max-width:100%; border-radius:6px; margin-top:6px;" />
  </div>
  `;
});
socket.on("itemStolen", ({ from, to, item }) => { showToast(`🗡️ ${shortName(to)} stole ${shortName(from)}'s item: ${item.name}`); });
socket.on("playerDied", ({ playerId }) => { showToast(`💀 ${shortName(playerId)} has fallen!`); });
socket.on("pvpStarted", ({ aId, bId, cellName }) => {
  showToast(`⚔️ PVP ${shortName(aId)} vs ${shortName(bId)} @ ${cellName}`);
  socket.emit("resolvePVP");
});
socket.on("errorMsg", (m) => alert(m));

socket.on("receiveChat", ({ playerId, message }) => {
  if (playerId === null) {
    // rendszerüzenet (system)
    chatLog.innerHTML += `<p style="color:#50d1ff; font-style:italic;">💬 ${message}</p>`;
  } else {
    // normál játékos üzenet
    const player = GAME?.players?.[playerId] || { name: playerId };
    chatLog.innerHTML += `<p><strong>${player.name}:</strong> ${message}</p>`;
  }

  chatLog.scrollTop = chatLog.scrollHeight;

  if (!$("#chatPanel").classList.contains("show")) {
    $("#toggleChatBtn").classList.add("notify");
  }
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

function renderLobby(players) {
  const list = $("#lobbyPlayers");
  list.innerHTML = "";

  players.forEach(p => {
    const div = document.createElement("div");
    div.className = "lobby-player";

    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    // Ha még nincs név (Várakozó…), használjuk p.name-et vagy fallback-et
    nameSpan.textContent = p.name || "Waiting...";

    div.appendChild(nameSpan);
    list.appendChild(div);
  });
}

// Lobby frissítése a szervertől
socket.on("updateLobby", (players) => {
  renderLobby(players);
});

// Szoba csatlakozás
socket.on("roomJoined", ({ roomName, isHost, players }) => {
  $("#menuOverlay").style.display = "none";
  $("#joinOverlay").style.display = "none";
  $("#charOverlay").style.display = "none";
  $("#lobbyOverlay").style.display = "flex";

  renderLobby(players);

  // csak a host látja a Start gombot
  const startBtn = $("#startGameBtn");
  startBtn.style.display = isHost ? "block" : "none";
});

// Lobby indítás
socket.on("lobbyStarted", () => {
  $("#lobbyOverlay").style.display = "none";
  $("#charOverlay").style.display = "flex";
});

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
      if (!ensurePlayerName()) return; // név ellenőrzés
      const name = createRoomName.value.trim();
      if (!name) return;
      LAST_ROOM = name;
      socket.emit("createOrJoinRoom", { roomName: name, create: true, playerName: LAST_NAME });
    });

    // === Szobalista és csatlakozás ===
    const joinOverlay = $("#joinOverlay");
    const roomListDiv = $("#roomList");

    $("#openJoinOverlayBtn").addEventListener("click", () => {
      if (!ensurePlayerName()) return; // név ellenőrzés
      joinOverlay.style.display = "flex";
      socket.emit("listRooms");
    });

    $("#closeJoinOverlay").addEventListener("click", () => {
      joinOverlay.style.display = "none";
    });

    // Szobalista frissítése
    socket.on("roomList", (rooms) => {
      const roomListDiv = $("#roomList");
      roomListDiv.innerHTML = "";

      // Csak azok a szobák, ahol még nem indult el a karakterválasztó
      const filteredRooms = rooms.filter(r => !r.characterSelectStarted);

      if (filteredRooms.length === 0) {
        roomListDiv.innerHTML = "<p>No active rooms.</p>";
        return;
      }

      filteredRooms.forEach(room => {
        const btn = document.createElement("button");
        btn.textContent = `${room.name} (${room.players} játékos)`;
        btn.addEventListener("click", () => {
          LAST_ROOM = room.name;
          socket.emit("createOrJoinRoom", { roomName: room.name, create: false, playerName: LAST_NAME });
          $("#joinOverlay").style.display = "none";
          $("#menuOverlay").style.display = "none";
        });
        roomListDiv.appendChild(btn);
      });
    });

    // === valós idejű szobalista-frissítés ===
    socket.on("roomUpdated", (updatedRoom) => {
      // csak ha nyitva van a joinOverlay
      if (!joinOverlay || joinOverlay.style.display !== "flex") return;
      socket.emit("listRooms");
    });

    // === LOBBY események ===
    socket.on("roomJoined", ({ roomName, isHost, players }) => {
      menuOverlay.style.display = "none";
      joinOverlay.style.display = "none";
      $("#charOverlay").style.display = "none";
      $("#lobbyOverlay").style.display = "flex";
      renderLobby(players);

      // csak a host látja a Start gombot
      const startBtn = $("#startGameBtn");
      startBtn.style.display = isHost ? "block" : "none";
    });

    socket.on("updateLobby", (players) => {
      renderLobby(players);
    });

    socket.on("lobbyStarted", () => {
      $("#lobbyOverlay").style.display = "none";
      $("#charOverlay").style.display = "flex";
    });

    // === Lobby gombok ===
    $("#startGameBtn").addEventListener("click", () => {
      socket.emit("startLobby");
    });

    $("#leaveLobbyBtn").addEventListener("click", () => {
      socket.emit("leaveRoom");
      $("#lobbyOverlay").style.display = "none";
      menuOverlay.style.display = "flex";
      LAST_ROOM = null;
      LAST_NAME = null;
      LAST_CHAR = null;
    });

    // === Karakter választó ===
    $("#joinForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#playerName").value.trim();
      const sel = document.querySelector("input[name='charPick']:checked");
      if (!sel) return alert("Please select a character!");
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

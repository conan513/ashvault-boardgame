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

socket.on("dayNightChanged", (cycle) => {
  const bg = document.getElementById("skyBackground");
  const label = document.getElementById("dayNightLabel");
  const icon = document.getElementById("dayNightIcon");
  const stars = document.getElementById("stars");

  icon.classList.add("fade-out");

  setTimeout(() => {
    if (cycle === "day") {
      bg.setAttribute("fill", "skyblue");
      icon.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "/icons/sun.png");
      label.textContent = "Nappal van";
      document.body.classList.remove("night");
    } else {
      bg.setAttribute("fill", "#0b1a3b");
      icon.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "/icons/moon.png");
      label.textContent = "Éjszaka van";
      document.body.classList.add("night");
      generateStars(stars);
    }
    icon.classList.remove("fade-out");
  }, 500);
});

function generateStars(starsGroup) {
  starsGroup.innerHTML = "";
  for (let i = 0; i < 20; i++) {
    const star = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    star.setAttribute("cx", Math.random() * 400);
    star.setAttribute("cy", Math.random() * 200);
    star.setAttribute("r", Math.random() * 2 + 1);
    starsGroup.appendChild(star);
  }
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

// === TILT FUNKCIÓ ===
// container = az a doboz, amin belül mozog az egér
// item = maga a mozgatni/dönteni kívánt elem (pl. pawn kép vagy kártya kép)
function attachTilt(container, item, options = {}) {
  const maxTilt = options.maxTilt ?? 10; // fokban a döntés mértéke
  const scale   = options.scale ?? 1;    // nagyítás (1 = nincs)

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  if (!container || !item || reduceMotion || noHover) return;

  container.classList.add('tilt-container');
  item.classList.add('tilt-item');

  let rafId;

  function onMove(e) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotateX = ((y - cy) / cy) * maxTilt;   // fel/le
      const rotateY = ((x - cx) / cx) * -maxTilt;  // bal/jobb
      item.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
    });
  }

  function onLeave() {
    if (rafId) cancelAnimationFrame(rafId);
    item.style.transform = 'rotateX(0) rotateY(0) scale(1)';
  }

  container.addEventListener('mousemove', onMove);
  container.addEventListener('mouseleave', onLeave);
}

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

;

// ===== Állapotkezelés =====
const cardQueue = [];
let isOverlayOpen = false;
let closingInProgress = false;
let overlaySnapshot = null;

// ===== Közös kártya-hozzáadás =====
function enqueueCardDraw(data) {
  if (isOverlayOpen) {
    cardQueue.push(data);
  } else {
    showCardInOverlay(data);
  }
}

// ===== Overlay megjelenítés =====
function showCardInOverlay(data) {
  overlaySnapshot = { ...data };
  isOverlayOpen = true;

  const { playerName, pawn, card } = data;
  $("#playerName").textContent = playerName || "";
  $("#playerPawn").src = pawn || "";

  if (card) {
    $("#cardName").textContent = card.name || "No name";
    $("#cardFaction").textContent = card.faction || "";
    $("#cardDescription").textContent = card.description || "";
    $("#cardEffect").textContent = card.effect || "";

    const statsEl = $("#cardStats");
    if (statsEl) {
      if (card.stats && Object.keys(card.stats).length > 0) {
        statsEl.innerHTML = `
        ${card.stats.attack !== undefined ? `<div>ATK: ${card.stats.attack}</div>` : ""}
        ${card.stats.defense !== undefined ? `<div>DEF: ${card.stats.defense}</div>` : ""}
        ${card.stats.health !== undefined ? `<div>HP: ${card.stats.health}</div>` : ""}
        `;
      } else {
        statsEl.innerHTML = "";
      }
    }

    if (card.image) {
      $("#cardImageContainer").innerHTML =
      `<img src="${card.image}" alt="${card.name}" />`;
    } else {
      $("#cardImageContainer").innerHTML = "";
    }
  }

  // Sima overlay, gomb látszik
  openCardOverlay(false);
}



function openCardOverlay(hideCloseBtn = false) {
  // Bezárás gomb állapota a paraméter alapján
  document.querySelectorAll('#cardOverlay .close-btn, #closeCardViewBtn')
  .forEach(btn => btn.style.display = hideCloseBtn ? "none" : "");

  const overlay = $("#cardOverlay");

  if (closingInProgress) {
    overlay.style.display = "flex";
    overlay.classList.remove("is-hiding");
    closingInProgress = false;
  }

  overlay.classList.remove("is-hiding", "is-visible");
  overlay.style.display = "flex";
  overlay.style.opacity = "0";

  const img = $("#cardImageContainer img");
  if (img && !img.complete) {
    img.onload = startFadeIn;
  } else {
    startFadeIn();
  }

  function startFadeIn() {
    void overlay.offsetWidth; // reflow trükk
    overlay.classList.add("is-visible");
  }
}

// ===== Overlay nyitás (animációval) =====
function openCardOverlay() {
  // Alaphelyzetbe állítás overlay nyitáskor
  document.querySelectorAll('#cardOverlay .close-btn, #closeCardViewBtn')
  .forEach(btn => btn.style.display = ""); // vagy "block", ha az a default

  const overlay = $("#cardOverlay");

  if (closingInProgress) {
    overlay.style.display = "flex";
    overlay.classList.remove("is-hiding");
    closingInProgress = false;
  }

  overlay.classList.remove("is-hiding", "is-visible");
  overlay.style.display = "flex";
  overlay.style.opacity = "0";

  const img = $("#cardImageContainer img");
  if (img && !img.complete) {
    img.onload = startFadeIn;
  } else {
    startFadeIn();
  }

  function startFadeIn() {
    void overlay.offsetWidth; // reflow trükk
    overlay.classList.add("is-visible");
  }
}
// ===== Overlay zárás =====
$("#closeCardViewBtn").addEventListener("click", () => {
  const overlay = $("#cardOverlay");
  const cardImg = $("#cardImageContainer img");

  if (cardImg) {
    cardImg.classList.add("card-activate");
    cardImg.addEventListener("animationend", () => {
      cardImg.classList.remove("card-activate");
    }, { once: true });
  }

  overlay.classList.remove("is-visible");
  overlay.classList.add("is-hiding");
  closingInProgress = true;

  const thisCardData = overlaySnapshot;
  overlaySnapshot = null;

  overlay.addEventListener("animationend", function handler() {
    if (overlay.classList.contains("is-hiding")) {
      finishClose(overlay, thisCardData);
    }
    overlay.removeEventListener("animationend", handler);
  });

  // biztosíték, ha nincs animationend
  setTimeout(() => {
    if (closingInProgress) {
      finishClose(overlay, thisCardData);
    }
  }, 600);
});

// Faction card
socket.on("cardDrawn", (data) => {
  enqueueCardDraw(data);
});

// Enemy (statokkal)
socket.on("enemyDrawn", (enemy) => {
  enqueueCardDraw({
    type: "enemy",
    playerId: enemy.playerId,
    card: {
      id: enemy.id,
      name: enemy.name,
      faction: enemy.faction || "Enemy",
      description: enemy.description,
      effect: enemy.effect,
      stats: enemy.stats || {
        attack: enemy.attack,
        defense: enemy.defense,
        health: enemy.health
      },
      image: enemy.image
    }
  });
});

// Loot (nincs stats)
socket.on("itemLooted", ({ playerId, item }) => {
  const looter = GAME?.players?.[playerId];

  enqueueCardDraw({
    type: "loot",
    playerId,
    pawn: looter?.pawn || "",   // 🔹 A helyes pawn átadása
    card: {
      id: item.id,
      name: item.name,
      faction: "Loot",
      description: item.description,
      effect: item.effect,
      stats: {},
      image: item.image
    }
  });
});



socket.on("battleResult", (data) => {
  hideCardOverlay();
  renderBattle(data);

  // Biztos reset
  overlaySnapshot = null;
  isOverlayOpen = false;
});


socket.on("itemStolen", ({ from, to, item }) => { showToast(`🗡️ ${shortName(to)} stole ${shortName(from)}'s item: ${item.name}`); });
socket.on("playerDied", ({ playerId }) => { showToast(`💀 ${shortName(playerId)} has fallen!`); });
socket.on("pvpStarted", ({ aId, bId, cellName }) => {
  showToast(`⚔️ PVP ${shortName(aId)} vs ${shortName(bId)} @ ${cellName}`);
  socket.emit("resolvePVP");
});
;

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

function showCardOverlay() {
  const overlay = document.getElementById("cardOverlay");
  overlay.style.display = "flex"; // Make the overlay visible
  setTimeout(() => {
    overlay.classList.add('show'); // Trigger animation after display
  }, 10); // Slight delay to allow display change to take effect
}

function hideCardOverlay(cardData) {
  const overlay = $("#cardOverlay");
  overlay.classList.remove('show');
  setTimeout(() => {
    overlay.style.display = "none";
    closingInProgress = false;
    isOverlayOpen = false;

    // FONTOS: reset snapshot
    overlaySnapshot = null;

    // Kártya aktiválás, ha nem battleRoll
    if (cardData && cardData.type && cardData.type.toLowerCase() !== "battleroll") {
      socket.emit("activateCard", {
        playerId: cardData.playerId,
        type: cardData.type,
        cardId: cardData.card?.id
      });
    }

    if (cardQueue.length > 0) {
      showCardInOverlay(cardQueue.shift());
    }
  }, 500);
}

function showBattleRollOverlay(data) {
  closingInProgress = false;
  isOverlayOpen = false;
  overlaySnapshot = null;

  overlaySnapshot = { ...data, type: "battleRoll" };
  isOverlayOpen = true;

  const playerNameEl   = $("#playerName");
  const pawnEl         = $("#playerPawn");
  const cardNameEl     = $("#cardName");
  const cardFactionEl  = $("#cardFaction");
  const cardDescEl     = $("#cardDescription");
  const cardEffectEl   = $("#cardEffect");
  const cardStatsEl    = $("#cardStats");
  const cardImageEl    = $("#cardImageContainer");

  if (playerNameEl) playerNameEl.textContent = "Csata kezdődik!";

  if (pawnEl) {
    if (data?.pawn) {
      pawnEl.src = data.pawn;
    } else if (data?.playerId && GAME?.players?.[data.playerId]?.pawn) {
      pawnEl.src = GAME.players[data.playerId].pawn;
    } else if (data?.aId && GAME?.players?.[data.aId]?.pawn) {
      pawnEl.src = GAME.players[data.aId].pawn;
    } else {
      pawnEl.src = "";
    }
  }

  if (cardNameEl) {
    cardNameEl.textContent = data.type === "PVE"
    ? `${shortName(data.playerId)} vs ${data.enemy.name}`
    : `${shortName(data.aId)} vs ${shortName(data.bId)}`;
  }
  if (cardFactionEl) cardFactionEl.textContent = data.type;
  if (cardDescEl) cardDescEl.textContent = "Kattints a dobás gombra a csata indításához.";

  if (cardEffectEl) {
    const amIPlayerA = data?.aId && data.aId === MY_ID;
    const amIPlayerB = data?.bId && data.bId === MY_ID;
    const amIPve     = data?.playerId && data.playerId === MY_ID;

    if (amIPlayerA || amIPlayerB || amIPve) {
      cardEffectEl.innerHTML = `<button id="battleRollBtn">🎲 Dobás</button>`;
    } else {
      cardEffectEl.innerHTML = `<span>Várakozás a másik játékos dobására...</span>`;
    }
  }

  // --- Tisztítás ---
  if (cardStatsEl) cardStatsEl.innerHTML = "";
  if (cardImageEl) cardImageEl.innerHTML = "";

  // Battle overlay: gomb rejtve (LEGUTOLSÓ LÉPÉSKÉNT!)
  openCardOverlay(false); // nyitás animációval
  document.querySelectorAll('#cardOverlay .close-btn, #closeCardViewBtn')
  .forEach(btn => btn.style.display = "none");

  // --- Dobás gomb esemény ---
  const rollBtn = document.getElementById("battleRollBtn");
  if (rollBtn) {
    rollBtn.onclick = () => {
      rollBtn.disabled = true;
      rollBtn.textContent = "Dobás folyamatban...";
      socket.emit("manualRoll", { battleId: data.id });
    };
  }
}

function finishClose() {
  const cardData = overlaySnapshot;

  // Ha van érvényes kártyaadat és nem harci dobás overlayről van szó:
  if (cardData && cardData.type && cardData.type.toLowerCase() !== "battleroll") {
    socket.emit("activateCard", {
      playerId: cardData.playerId,
      type: cardData.type,
      cardId: cardData.card?.id
    });
  }

  // Overlay állapot teljes reset
  overlaySnapshot = null;
  isOverlayOpen = false;

  // UI bezárás
  hideOverlayUI();
}


document.getElementById("closeCardViewBtn").addEventListener("click", hideCardOverlay);


document.querySelectorAll('.tilt-item').forEach(tilt => {
  tilt.addEventListener('mousemove', (e) => {
    const { width, height, left, top } = tilt.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;
    const rotateX = ((y / height) - 0.5) * 15;
    const rotateY = ((x / width) - 0.5) * -15;
    tilt.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
  tilt.addEventListener('mouseleave', () => {
    tilt.style.transform = 'rotateX(0) rotateY(0)';
  });
});

const chatPanel = $("#chatPanel");
const toggleChatBtn = $("#toggleChatBtn");

toggleChatBtn.addEventListener("click", () => {
  chatPanel.classList.toggle("show");
  if (chatPanel.classList.contains("show")) toggleChatBtn.classList.remove("notify");
});

document.addEventListener("DOMContentLoaded", () => {
  const closeCardViewBtn = document.getElementById("closeCardViewBtn");
  if (closeCardViewBtn) {
    closeCardViewBtn.addEventListener("click", () => {
      document.getElementById("cardOverlay").style.display = "none";
    });
  }
  const playerNameEl = $("#playerName");
  if (playerNameEl) playerNameEl.textContent = playerName;

  // Pawn tilt
  const pawnContainer = document.querySelector('.cardColumn');
  const pawnImg = document.getElementById('playerPawn');
  attachTilt(pawnContainer, pawnImg, { maxTilt: 10, scale: 1 });

  // Kártya tilt
  const cardContainer = document.getElementById('cardImageContainer');
  const cardImg = cardContainer?.querySelector('img');
  attachTilt(cardContainer, cardImg, { maxTilt: 8, scale: 1 });

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
    ;

    ;

    ;

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

socket.on("battleStart", (battleData) => {
  console.log("[battleStart] új harc érkezett:", battleData);

  // --- Állapotok reset ---
  closingInProgress = false;
  isOverlayOpen = false;
  overlaySnapshot = null;

  // Töröljük a kártya-queue-t is, ha biztos új csata jön
  cardQueue.length = 0;

  // Overlay megnyitása
  showBattleRollOverlay(battleData);
});

socket.once("battleResult", (data) => {
  hideCardOverlay(); // bezár, resetel és feldolgozza a queue-t
  renderBattle(data);
});

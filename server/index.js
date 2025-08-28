// server/index.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const board = require('./board');
const { initBoard, assignSpecialAreas, adjacencyAtDistance, cellById } = board;
const { factions } = require("./factions");
const { characters } = require("./characters");
const { battlePVE, battlePVP } = require("./battleSystem");
const { applyItemToPlayer } = require("./inventory");
const {
  drawFactionCard,
  drawEquipmentCard,
  drawEnemyCard,
  resetDecksState
} = require("./gameLoop");

const {
  specialTargetNames,
  gatewaysOuter,
  gatewaysInner,
  teleportPlayerIfOnSpecial
} = require("./board");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/", express.static(path.join(__dirname, "..", "client")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/** ---- TÖBB SZOBÁS JÁTÉK ---- **/
let rooms = {}; // roomName -> gameState

// --- Helpers: room summary & broadcasting ---
function buildRoomSummary(state, name) {
  return {
    name,
    players: Object.keys(state.players || {}).length,
    characterSelectStarted: !!state.characterSelectStarted
  };
}

// --- Helpers: room summary & broadcasting ---
function buildRoomSummary(state, name) {
  return {
    name,
    players: Object.keys(state.players || {}).length,
    characterSelectStarted: !!state.characterSelectStarted
  };
}

function broadcastRoomList() {
  const list = Object.entries(rooms).map(([name, state]) => buildRoomSummary(state, name));
  io.emit("roomList", list);
}

// --- Helper: centralize day/night toggle ---
function checkAndRotateDayNight(gameState, roomName) {
  if (!gameState) return;
  const activePlayers = Object.keys(gameState.players || {});
  const allDone = activePlayers.length > 0 && activePlayers.every(id => gameState.turnCompleted && gameState.turnCompleted[id]);
  if (allDone) {
    gameState.dayNightCycle = gameState.dayNightCycle === "day" ? "night" : "day";
    io.to(roomName).emit("dayNightChanged", gameState.dayNightCycle);
    gameState.turnCompleted = {};
  }
}

// --- Improved tryDeleteRoom: removes empty rooms and broadcasts updated list ---
function tryDeleteRoom(roomName) {
  try {
    const room = io.sockets.adapter.rooms.get(roomName);
    if (!room || room.size === 0) {
      delete rooms[roomName];
      broadcastRoomList();
    }
  } catch (e) {
    // fallback: if adapter doesn't support .get, attempt older API
    if (!io.sockets.adapter.rooms[roomName] || io.sockets.adapter.rooms[roomName].length === 0) {
      delete rooms[roomName];
      broadcastRoomList();
    }
  }
}

// --- Helper normalizálás és d6 ---
function getATK(entity) {
  const s = entity?.stats ?? entity ?? {};
  return Number(s.ATK ?? s.attack ?? 0);
}
function getDEF(entity) {
  const s = entity?.stats ?? entity ?? {};
  return Number(s.DEF ?? s.defense ?? 0);
}
function getHP(entity) {
  const s = entity?.stats ?? entity ?? {};
  return Number(s.HP ?? s.health ?? 0);
}
function d6(){ return Math.floor(Math.random()*6) + 1; }

// ---- TEMP BUFF/DEBUFF RENDSZER ----
function applyTempEffect(unit, effect, isBuff) {
  if (!effect) return;

  if (isBuff) {
    effect.stats.forEach(stat => {
      unit.stats[stat] = (unit.stats[stat] || 0) + effect.amount;
    });
    unit.activeBuffs.push({
      ...effect,
      type: "buff",
      sourceCard: effect.sourceCard || effect.name || null
    });
  } else {
    unit.stats[effect.stat] = (unit.stats[effect.stat] || 0) + effect.amount;
    unit.activeDebuffs.push({
      ...effect,
      type: "debuff",
      sourceCard: effect.sourceCard || effect.name || null
    });
  }
}

function processEndOfTurnEffects(unit) {
  unit.activeBuffs = unit.activeBuffs.filter(buff => {
    buff.duration -= 1;
    if (buff.duration <= 0) {
      buff.stats.forEach(stat => {
        unit.stats[stat] -= buff.amount;
      });
      return false;
    }
    return true;
  });

  unit.activeDebuffs = unit.activeDebuffs.filter(debuff => {
    debuff.duration -= 1;
    if (debuff.duration <= 0) {
      unit.stats[debuff.stat] -= debuff.amount;
      return false;
    }
    return true;
  });
}

function makeGameState() {
  const board = initBoard();
  assignSpecialAreas(board); // kiosztja a 4 speciális frakciót

  return {
    board,
    players: {},
    turnOrder: [],
    currentTurnIndex: 0,
    lastDrawn: null,
    pvpPending: null,
    waitingForCharacters: {},
    hostId: null,
    lobbyStarted: false,
    dayNightCycle: "day",
    turnCompleted: {}
  };
}

// Jelenlegi játékos azonosítójának megszerzése
function getCurrentPlayerId(state) {
  return state.turnOrder[state.currentTurnIndex] || null;
}

// Ellenőrizzük, hogy a játékosnak van-e köre
function isPlayersTurn(state, socketId) {
  return socketId === getCurrentPlayerId(state);
}

// Állapot frissítése minden szobába
function broadcast(roomName) {
  const state = rooms[roomName];
  if (!state) return;
  io.to(roomName).emit("updateGame", sanitizeGameStateForClients(state));
}

// Kör előrehaladása
function advanceTurn(roomName) {
  const state = rooms[roomName];
  if (!state || state.turnOrder.length === 0) return;

  const prevPlayerId = getCurrentPlayerId(state);
  const prevPlayer = state.players[prevPlayerId];
  if (prevPlayer) {
    processEndOfTurnEffects(prevPlayer);
    io.to(roomName).emit("statsChanged", { playerId: prevPlayer.id, stats: prevPlayer.stats });
  }

  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  const newCurrentPlayerId = getCurrentPlayerId(state);

  io.to(roomName).emit("turnChanged", newCurrentPlayerId);
  io.to(roomName).emit("updateGame", sanitizeGameStateForClients(state));
}

// Játékállapot tisztítása a kliensek számára
function sanitizeGameStateForClients(state) {
  const players = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = {
      id: p.id,
      name: p.name,
      faction: p.faction,
      characterId: p.characterId,
      characterName: p.characterName,
      characterImg: p.characterImg,   // 🔹 kliens is látja a képet
      pawn: p.pawn,
      stats: p.stats,
      position: p.position,
      inventory: p.inventory,
      alive: p.alive,
      activeBuffs: p.activeBuffs || [],
      activeDebuffs: p.activeDebuffs || [],
      level: p.level || 1,
      exp: p.exp || 0,
      levelUpAvailable: !!p.levelUpAvailable
    };
  }
  return {
    board: state.board,
    players,
    turnOrder: state.turnOrder,
    currentTurnIndex: state.currentTurnIndex,
    currentPlayer: getCurrentPlayerId(state),
    lastDrawn: state.lastDrawn,
    pvpPending: state.pvpPending
  };
}

/** ---- SZOBA TÖRLÉS SEGÉDFÜGGVÉNY ---- **/
function tryDeleteRoom(roomName) {
  if (!roomName) return;
  const gameState = rooms[roomName];
  if (!gameState) return;

  const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
  const playersCount = Object.keys(gameState.players).length;
  const waitingCount = Object.keys(gameState.waitingForCharacters || {}).length;

  if ((!socketsInRoom || socketsInRoom.size === 0) && playersCount === 0 && waitingCount === 0) {
    delete rooms[roomName];
    console.log(`Szoba törölve: ${roomName}`);
  }
}

/** ---- SOCKET.IO ---- **/
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  function sendSystemMessage(roomName, message) {
    io.to(roomName).emit("receiveChat", {
      playerId: null,
      message: message
    });
  }

  // Szobák listázása – csak elérhető szobák
  socket.on('listRooms', () => {
  const list = Object.entries(rooms).map(([name, state]) => buildRoomSummary(state, name));

// --- Level up assign handler ---
socket.on('levelUpAssign', ({ stat }) => {
  try {
    console.log('[levelUpAssign] received', socket.id, stat);
    // determine room
    let roomName = socket.currentRoom;
    if (!roomName) {
      // find room containing this player
      for (const [rn, gs] of Object.entries(rooms)) {
        if (gs.players && gs.players[socket.id]) {
          roomName = rn; break;
        }
      }
    }
    if (!roomName) return socket.emit('errorMsg', 'No room');
    const gameState = rooms[roomName];
    if (!gameState) return socket.emit('errorMsg', 'No game state');
    const player = gameState.players[socket.id];
    if (!player) return socket.emit('errorMsg', 'Player not found');
    if (!player.levelUpAvailable) return socket.emit('errorMsg', 'No level-up available');

    // normalize stat (allow lowercase)
    stat = String(stat || '').toUpperCase();

    // apply stat
    if (!player.stats || !Object.prototype.hasOwnProperty.call(player.stats, stat)) {
      console.log('[levelUpAssign] invalid stat', stat, 'player.stats=', player.stats);
      return socket.emit('errorMsg', 'Invalid stat');
    }
    player.stats[stat] = (player.stats[stat] || 0) + 1;
    console.log('[levelUpAssign] applied stat', stat, 'new value', player.stats[stat]);

    // consume exp needed and increase level
    const need = 2 + (player.level || 1);
    player.exp = Math.max(0, (player.exp || 0) - need);
    player.level = (player.level || 1) + 1;
    player.levelUpAvailable = false;

    // notify room
    io.to(roomName).emit('playerLevelUpdated', { playerId: player.id, level: player.level, exp: player.exp, stats: player.stats });
    broadcast(roomName);
  } catch (e) {
    console.error('levelUpAssign err', e);
    socket.emit('errorMsg', 'Level up failed');
  }
});

  socket.emit('roomList', list);
});
// Szoba létrehozás / csatlakozás
  socket.on("createOrJoinRoom", ({ roomName, create, playerName }) => {
    if (create) {
      if (rooms[roomName]) {
        return socket.emit("errorMsg", "❌ A szoba név már foglalt!");
      }
      rooms[roomName] = makeGameState();
      rooms[roomName].hostId = socket.id;
      resetDecksState();
    } else {
      if (!rooms[roomName]) {
        return socket.emit("errorMsg", "❌ Nincs ilyen szoba!");
      }
    }

    const gameState = rooms[roomName];
    socket.join(roomName);
    socket.currentRoom = roomName;

    // Ide kerül a várakozó játékos a lobbyban
    gameState.waitingForCharacters[socket.id] = {
      id: socket.id,
      name: playerName || "Várakozó..."
    };

    // Kliens értesítése, hogy csatlakozott a szobához
    socket.emit("roomJoined", {
      roomName,
      isHost: gameState.hostId === socket.id,
      players: Object.values(gameState.waitingForCharacters)
    });

    socket.emit("hello", { factions, characters });

    // Frissítjük a lobby minden tagja számára
    io.to(roomName).emit("updateLobby", Object.values(gameState.waitingForCharacters));
  });

  socket.on("activateCard", () => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState || !gameState.lastDrawn) return;

    const { playerId, faction, card } = gameState.lastDrawn;
    const player = gameState.players[playerId];
    if (!player || !player.alive) return;

    const sameFaction = (player.faction === faction);
    const effect = sameFaction ? card.selfEffect : card.otherEffect;

    if (effect.effect === "battle") {
      // Csak a harc előkészítése marad
      const enemy = drawEnemyCard();
      io.to(socket.currentRoom).emit("enemyDrawn", enemy);

      gameState.pendingBattle = {
        type: "PVE",
        playerId: player.id,
        enemy,
        sameFaction,
        card
      };

      io.to(socket.currentRoom).emit('battleStart', {
        type: 'PVE',
        id: Date.now(),
        aId: player.id,
        aName: player.name,
        aStats: player.stats,
        bId: 'ENEMY_'+(enemy.id||'0'),
        bName: enemy.name || enemy.title || 'Enemy',
        bStats: enemy.stats || {},
        enemy
      });

    } else {
      // Nem-battle effektek
      if (effect.loot) {
        const item = drawEquipmentCard();
        applyItemToPlayer(player, item);
        io.to(socket.currentRoom).emit("itemLooted", { playerId: player.id, item });
        sendSystemMessage(socket.currentRoom, `${player.name} looted an item: ${item.name}`);
      }
      if (effect.hpDelta) {
        player.stats.HP += effect.hpDelta;
        if (player.stats.HP <= 0) {
          player.alive = false;
          io.to(socket.currentRoom).emit("playerDied", { playerId: player.id, cause: "Event" });
          sendSystemMessage(socket.currentRoom, `${player.name} has died due to an event.`);
        }
      }
      if (effect.statMods) {
        for (const [k, v] of Object.entries(effect.statMods)) {
          player.stats[k] = Math.max(0, player.stats[k] + v);
        }
        io.to(socket.currentRoom).emit("statsChanged", { playerId: player.id, stats: player.stats });
        sendSystemMessage(socket.currentRoom, `${player.name} received stat modifications: ${JSON.stringify(effect.statMods)}`);
      }
      if (effect.tempBuff) {
        applyTempEffect(player, effect.tempBuff, true);
        io.to(socket.currentRoom).emit("statsChanged", { playerId: player.id, stats: player.stats });
        sendSystemMessage(socket.currentRoom, `${player.name} received a temporary buff: ${JSON.stringify(effect.tempBuff)}`);
      }
      if (effect.tempDebuff) {
        applyTempEffect(player, effect.tempDebuff, false);
        io.to(socket.currentRoom).emit("statsChanged", { playerId: player.id, stats: player.stats });
        sendSystemMessage(socket.currentRoom, `${player.name} received a temporary debuff: ${JSON.stringify(effect.tempDebuff)}`);
      }
    }

    gameState.lastDrawn = null;
    broadcast(socket.currentRoom);
  });

  // Host elindítja a lobbyt → mehet karakterválasztás
  socket.on("startLobby", () => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;

    if (gameState.hostId !== socket.id) {
      return socket.emit("errorMsg", "Csak a host indíthatja a játékot!");
    }

    // Beállítjuk, hogy elindult a karakterválasztó
    gameState.lobbyStarted = true;
    gameState.characterSelectStarted = true;

    // Értesítjük a szoba minden tagját, hogy a lobby elindult
    io.to(socket.currentRoom).emit("lobbyStarted");

    // Frissítjük a szobalistát minden kliensnél, hogy eltűnjön az indított szoba
    const updatedRooms = Object.values(rooms).map(r => ({
      name: r.name,
      players: Object.keys(r.players).length,
                                                        characterSelectStarted: !!r.characterSelectStarted
    }));
    broadcastRoomList();
  });

  // Kilépés lobbyból
  socket.on("leaveRoom", () => {
    if (!socket.currentRoom) return;
    const roomName = socket.currentRoom;
    const gameState = rooms[roomName];

    socket.leave(roomName);
    delete socket.currentRoom;

    if (gameState) {
      delete gameState.waitingForCharacters[socket.id];
      delete gameState.players[socket.id];

      // Mindenki frissítése a lobbyban
      io.to(roomName).emit("updateLobby", Object.values(gameState.waitingForCharacters));

      tryDeleteRoom(roomName);
    }
  });


  // Játékos csatlakozása a játékhoz (karakter választás)
  socket.on("joinGame", ({ playerName, characterId }) => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;

    if (!gameState.lobbyStarted) {
      return socket.emit("errorMsg", "A host még nem indította el a játékot!");
    }

    if (Object.keys(gameState.players).length >= 4) {
      return socket.emit("errorMsg", "This room is full (max 4 players).");
    }

    const c = characters.find(ch => ch.id === characterId);
    if (!c) return socket.emit("errorMsg", "Unknown character.");
    if (Object.values(gameState.players).some(p => p.characterId === characterId)) {
      return socket.emit("errorMsg", "This character is already taken!");
    }

    // Eltávolítjuk a várakozók közül
    delete gameState.waitingForCharacters[socket.id];

    // Hozzáadjuk a játékosok közé
    gameState.players[socket.id] = {
      id: socket.id,
      name: playerName || "Névtelen",
      faction: c.faction,
      characterId: c.id,
      characterName: c.name,
      characterImg: c.img,   // portré
      pawn: c.pawn,          // 🔹 bábu ikon
      stats: { HP: c.HP, ATK: c.ATK, DEF: c.DEF, PSY: c.PSY, RES: c.RES },
      position: c.spawn,
      inventory: [],
      alive: true,
      activeBuffs: [],
      activeDebuffs: []
    , level: 1
    , exp: 0
    , levelUpAvailable: false
    };

    gameState.turnOrder.push(socket.id);
    if (gameState.turnOrder.length === 1) {
      gameState.currentTurnIndex = 0;
      io.to(socket.currentRoom).emit("turnChanged", socket.id);
    }

    sendSystemMessage(socket.currentRoom, `${playerName} has joined the game.`);
    broadcast(socket.currentRoom);

    // Minden kliens frissítése a lobbyban
    io.to(socket.currentRoom).emit("updateLobby", Object.values(gameState.players));

    // Kliensnek küldjük a karaktereket
    socket.emit("characterList", characters);
  });

  // Dobás
  // Dobás
  // --- teljes rollDice handler (helyettesítse a meglévőt) ---
  socket.on("rollDice", () => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;
    if (!isPlayersTurn(gameState, socket.id)) {
      return socket.emit("errorMsg", "Nem a te köröd!");
    }

    const dice = Math.floor(Math.random() * 6) + 1;
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    // Aktuális cella és a hozzá tartozó ring mezői
    const myCell = gameState.board.find(c => c.id === player.position);
    if (!myCell) return;

    // FONTOS: itt határozzuk meg a ring sorrendjét — alapból id szerint rendezünk.
    // Ha a board-on van kifejezetten index/sequence mező (pl. `order`), akkor érdemes
    // arra váltani: .sort((a,b) => a.order - b.order)
    const ringCells = gameState.board
    .filter(c => c.ring === myCell.ring)
    .sort((a, b) => a.id - b.id);

    const myIdx = ringCells.findIndex(c => c.id === myCell.id);
    const size = ringCells.length;

    // Két cél: előre (myIdx + dice) és hátra (myIdx - dice)
    const forwardIdx = (myIdx + dice) % size;
    const backwardIdx = (myIdx - dice + size) % size;
    const target1 = ringCells[forwardIdx].id;
    const target2 = ringCells[backwardIdx].id;
    const targets = [target1, target2];

    // Útvonalak összeállítása (lista: következő mezőtől a cél felé)
    const pathForward = [];
    const pathBackward = [];
    for (let i = 1; i <= dice; i++) {
      pathForward.push(ringCells[(myIdx + i) % size].id);
      pathBackward.push(ringCells[(myIdx - i + size) % size].id);
    }

    // Szerveroldali debug log
    console.log("[rollDice]", {
      playerId: socket.id,
      dice,
      myIdx,
      size,
      ringCellIds: ringCells.map(c => c.id),
                forwardIdx,
                  backwardIdx,
                  targets,
                  pathForward,
                  pathBackward
    });

    // Emit — küldünk részletes debug mezőt (ideiglenes)
    io.to(socket.currentRoom).emit("diceResult", {
      dice,
      targets,
      paths: {
        [target1]: pathForward,
        [target2]: pathBackward
      },
      playerId: socket.id,
      debug: {
        myIdx,
        size,
        ringCellIds: ringCells.map(c => c.id),
                                   forwardIdx,
                                     backwardIdx
      }
    });
  });


  // Chat
  socket.on("sendChat", ({ message, playerId }) => {
    io.to(socket.currentRoom).emit("receiveChat", { playerId, message });
  });

  // Kör vége
  socket.on("endTurn", () => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;

    if (!isPlayersTurn(gameState, socket.id)) {
      return socket.emit("errorMsg", "Nem a te köröd!");
    }

    // Mark the player's turn as completed
    gameState.turnCompleted[socket.id] = true;

    // Check if all players have completed their turn
    const allPlayersCompleted = Object.keys(gameState.players).every(playerId => gameState.turnCompleted[playerId]);

    if (allPlayersCompleted) {
      // Switch the day-night cycle
      checkAndRotateDayNight(gameState, socket.currentRoom);
// Reset the turn completion status
      gameState.turnCompleted = {};
    }

    advanceTurn(socket.currentRoom);
    io.to(socket.currentRoom).emit("turnChanged", getCurrentPlayerId(gameState));
  });


  // requestMove (helyettesítsd a meglévőt vagy szúrd be az elejére)
  socket.on("requestMove", ({ playerId, path, targetCellId, dice }) => {
    console.log("[requestMove] recv:", {
      fromSocket: socket.id,
      playerId,
      path,
      targetCellId,
      dice,
      room: socket.currentRoom
    });

    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;
    if (!isPlayersTurn(gameState, socket.id)) return;

    const player = gameState.players[playerId];
    if (!player || !player.alive) return;

    io.to(socket.currentRoom).emit("playerStartMove", {
      playerId,
      path,
      targetCellId,
      dice
    });
  });

  // Mozgás megerősítése
  socket.on("confirmMove", ({ dice, targetCellId, path }) => {
    console.log("[confirmMove] recv:", {
      fromSocket: socket.id,
      dice,
      targetCellId,
      path,
      room: socket.currentRoom
    });

    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;
    if (!isPlayersTurn(gameState, socket.id)) {
      return socket.emit("errorMsg", "Nem a te köröd!");
    }

    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    // 🔹 Ugyanazt a két targetet számoljuk, amit a rollDice is
    const myCell = gameState.board.find(c => c.id === player.position);
    const ringCells = gameState.board
    .filter(c => c.ring === myCell.ring)
    .sort((a, b) => a.id - b.id);
    const myIdx = ringCells.findIndex(c => c.id === myCell.id);
    const size = ringCells.length;
    const target1 = ringCells[(myIdx + dice) % size].id;
    const target2 = ringCells[(myIdx - dice + size) % size].id;
    const targets = [target1, target2];

    // 🔹 Validáció
    if (!targets.includes(targetCellId)) {
      return socket.emit("errorMsg", "Invalid target cell.");
    }

    // Állítsuk be a cél cellát
    player.position = targetCellId;

    // --- TELEPORT CHECK ---
    const beforeTeleport = player.position;
    teleportPlayerIfOnSpecial(gameState.board, player);
    const afterTeleport = player.position;

    if (afterTeleport !== beforeTeleport) {
      io.to(socket.currentRoom).emit("playerMoved", {
        playerId: player.id,
        path: [beforeTeleport, afterTeleport]
      });
    }

    // PvP vagy kártyaellenőrzés
    const cell = cellById(gameState.board, player.position);
    const othersHere = Object.values(gameState.players)
    .filter(p => p.id !== player.id && p.alive && p.position === player.position);
    const differentFaction = othersHere.find(p => p.faction !== player.faction);

    if (differentFaction) {
      gameState.pvpPending = { aId: player.id, bId: differentFaction.id, cellId: player.position };
      io.to(socket.currentRoom).emit('battleStart', {
        type: 'PVP',
        id: Date.now(),
                                     aId: player.id,
                                     aName: player.name,
                                     aStats: player.stats,
                                     bId: differentFaction.id,
                                     bName: differentFaction.name || differentFaction.characterName || 'Opponent',
                                     bStats: differentFaction.stats || {},
                                     cellId: gameState.pvpPending.cellId
      });
    } else {
      if (cell.faction && cell.faction !== "NEUTRAL" && player.alive) {
        const card = drawFactionCard(cell.faction);
        gameState.lastDrawn = {
          type: "FACTION",
          faction: cell.faction,
          card,
          playerId: player.id
        };
        io.to(socket.id).emit("cardDrawn", {
          playerId: player.id,
          playerName: player.characterName,
          pawn: player.pawn,
          type: "FACTION",
          faction: cell.faction,
          card
        });
      }
    }

    broadcast(socket.currentRoom);

    if (!gameState.pvpPending) {
      gameState.turnCompleted[socket.id] = true;
      const activePlayers = Object.keys(gameState.players);
      const allPlayersCompleted = activePlayers.every(id => gameState.turnCompleted[id]);

      if (allPlayersCompleted) {
        checkAndRotateDayNight(gameState, socket.currentRoom);
        gameState.turnCompleted = {};
      }

      advanceTurn(socket.currentRoom);
    }
  });



  socket.on("manualRoll", ({ battleId }) => {
    const roomId = socket.currentRoom;
    const gameState = rooms?.[roomId];
    if (!gameState) return;

    // --- PVE ---
    if (gameState.pendingBattle) {
      const { playerId, enemy } = gameState.pendingBattle;
      const player = gameState.players?.[playerId];
      if (!player || !player.alive) return;

      // normalizált statok
      const aStats = { ATK: getATK(player), DEF: getDEF(player), HP: getHP(player) };
      const bStats = { ATK: getATK(enemy),  DEF: getDEF(enemy),  HP: getHP(enemy) };

      const aRoll = d6();
      const bRoll = d6();
      const aTotal = aRoll + aStats.ATK - bStats.DEF; // player formula
      const bTotal = bRoll + bStats.ATK - aStats.DEF; // enemy formula

      const winner = (aTotal >= bTotal) ? "A" : "B";

      // Küldjük explicit, egyszerű struktúrában
      io.to(roomId).emit("battleResult", {
        type: "PVE",
        a: { id: player.id, name: player.name, stats: aStats, roll: aRoll, total: aTotal },
        b: { id: "ENEMY", name: enemy.name || "Enemy", stats: bStats, roll: bRoll, total: bTotal },
        winner
      });

      // opcionális: sebzés/HP update (megtarthatod a meglévő logikát)
      if (winner === "B") {
        player.stats.HP = (player.stats.HP ?? aStats.HP) - 1;
        if (player.stats.HP <= 0) {
          player.alive = false;
          io.to(roomId).emit("playerDied", { playerId: player.id, cause: "PVE" });
        }
      } else {
        // győztes loot/exp stb. (maradhat a meglévő logika)
      }

      delete gameState.pendingBattle;
      broadcast(roomId);
      return;
    }

    // --- PVP ---
    if (gameState.pvpPending) {
      const { aId, bId, cellId } = gameState.pvpPending;
      const A = gameState.players?.[aId];
      const B = gameState.players?.[bId];
      if (!A || !B || !A.alive || !B.alive) {
        gameState.pvpPending = null;
        broadcast(roomId);
        advanceTurn(roomId);
        return;
      }

      const aStats = { ATK: getATK(A), DEF: getDEF(A), HP: getHP(A) };
      const bStats = { ATK: getATK(B), DEF: getDEF(B), HP: getHP(B) };

      const aRoll = d6();
      const bRoll = d6();
      const aTotal = aRoll + aStats.ATK - bStats.DEF;
      const bTotal = bRoll + bStats.ATK - aStats.DEF;
      const winner = (aTotal >= bTotal) ? "A" : "B";

      io.to(roomId).emit("battleResult", {
        type: "PVP",
        a: { id: A.id, name: A.name, stats: aStats, roll: aRoll, total: aTotal },
        b: { id: B.id, name: B.name, stats: bStats, roll: bRoll, total: bTotal },
        winner,
        cellId
      });

      // vesztes HP csökkentés (példa)
      const loser = (winner === "A") ? B : A;
      loser.stats.HP = (loser.stats.HP ?? (winner === "A" ? getHP(B) : getHP(A))) - 1;
      if (loser.stats.HP <= 0) {
        loser.alive = false;
        io.to(roomId).emit("playerDied", { playerId: loser.id, cause: "PVP" });
      }

      gameState.pvpPending = null;
      broadcast(roomId);
      advanceTurn(roomId);
    }
  });

    // PVP megoldása
    socket.on("resolvePVP", () => {
      const gameState = rooms[socket.currentRoom];
      if (!gameState) return;
      const pending = gameState.pvpPending;
      if (!pending) return;
      const A = gameState.players[pending.aId];
      const B = gameState.players[pending.bId];
      if (!A || !B || !A.alive || !B.alive) {
        gameState.pvpPending = null;
        broadcast(socket.currentRoom);
        advanceTurn(socket.currentRoom);
        return;
      }

      const result = battlePVP(A, B, io);

      io.to(socket.currentRoom).emit("battleResult", {
        type: "PVP",
        result,
        aId: A.id,
        bId: B.id,
        cellId: pending.cellId
      });

      const loser = result.winner === "A" ? B : A;
      loser.stats.HP -= 1;
      if (loser.stats.HP <= 0) {
        loser.alive = false;
        io.to(socket.currentRoom).emit("playerDied", { playerId: loser.id, cause: "PVP" });
        sendSystemMessage(socket.currentRoom, `${loser.name} has died in PvP combat.`);
      }

      const winner = result.winner === "A" ? A : B;
      if (loser.inventory.length > 0) {
        const stolen = loser.inventory.pop();
        applyItemToPlayer(winner, stolen);
        io.to(socket.currentRoom).emit("itemStolen", { from: loser.id, to: winner.id, item: stolen });
        sendSystemMessage(socket.currentRoom, `${winner.name} stole an item from ${loser.name}: ${stolen.name}`);
      }

      const detailMsg =
      `${A.name} dobása: ${result.rolls.A} + ATK(${A.stats.ATK}) - DEF(${B.stats.DEF}) = ${result.totals.A}\n` +
      `${B.name} dobása: ${result.rolls.B} + ATK(${B.stats.ATK}) - DEF(${A.stats.DEF}) = ${result.totals.B}\n` +
      `Győztes: ${winner.name}, vesztes: ${loser.name}, vesztes HP veszteség: ${result.damage}`;

      sendSystemMessage(socket.currentRoom, `${A.name} challenged ${B.name} to a 1v1 PvP battle.\n${detailMsg}`);

      gameState.pvpPending = null;
      broadcast(socket.currentRoom);
      advanceTurn(socket.currentRoom);
    });

    // Leállás esetén
    socket.on("disconnect", () => {
      const roomName = socket.currentRoom;
      if (!roomName) return;
      const gameState = rooms[roomName];

      if (gameState) {
        const leavingPlayer = gameState.players[socket.id];
        if (leavingPlayer) {
          sendSystemMessage(roomName, `${leavingPlayer.name} has left the game.`);
          delete gameState.players[socket.id];
          gameState.turnOrder = gameState.turnOrder.filter(id => id !== socket.id);
          if (gameState.currentTurnIndex >= gameState.turnOrder.length) {
            gameState.currentTurnIndex = 0;
          }
          broadcast(roomName);
        }

        if (gameState.waitingForCharacters[socket.id]) {
          delete gameState.waitingForCharacters[socket.id];
        }

        io.to(roomName).emit("updateLobby", Object.values(gameState.waitingForCharacters));
      }

      tryDeleteRoom(roomName);
    });

});


const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Szerver fut: http://0.0.0.0:${PORT}`);
});

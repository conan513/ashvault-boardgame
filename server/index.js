// server/index.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const { initBoard, adjacencyAtDistance, cellById } = require("./board");
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

const app = express();
app.use(cors());
app.use(express.json());
app.use("/", express.static(path.join(__dirname, "..", "client")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/** ---- TÖBB SZOBÁS JÁTÉK ---- **/
let rooms = {}; // roomName -> gameState

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
  return {
    board: initBoard(),
    players: {},
    turnOrder: [],
    currentTurnIndex: 0,
    lastDrawn: null,
    pvpPending: null,
    waitingForCharacters: {}, // ide kerülnek lobbyban várakozók
    hostId: null,
    lobbyStarted: false
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
      activeDebuffs: p.activeDebuffs || []
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
  socket.on("listRooms", () => {
    const list = Object.entries(rooms)
    .filter(([name, state]) => {
      // csak azok a szobák, ahol még van várakozó játékos karakterválasztóra
      return Object.keys(state.waitingForCharacters || {}).length > 0;
    })
    .map(([name, state]) => ({
      name,
      players: Object.keys(state.players).length
    }));

    socket.emit("roomList", list);
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
    io.emit("roomList", updatedRooms);
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
  socket.on("rollDice", () => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;
    if (!isPlayersTurn(gameState, socket.id)) return socket.emit("errorMsg", "It's not your turn!");

    const dice = Math.floor(Math.random() * 6) + 1;
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;
    const targets = adjacencyAtDistance(gameState.board, player.position, dice);

    io.to(socket.currentRoom).emit("diceResult", {
      dice,
      targets,
      playerId: socket.id
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

    advanceTurn(socket.currentRoom);
    io.to(socket.currentRoom).emit("turnChanged", getCurrentPlayerId(gameState));
  });

  // Mozgás megerősítése
  socket.on("confirmMove", ({ dice, targetCellId, path }) => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;
    if (!isPlayersTurn(gameState, socket.id))
      return socket.emit("errorMsg", "Nem a te köröd!");
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    const targets = adjacencyAtDistance(gameState.board, player.position, dice);
    if (!targets.includes(targetCellId)) {
      return socket.emit("errorMsg", "Invalid target cell.");
    }

    // 🔹 Broadcast animációs path minden kliensnek
    if (path && path.length > 0) {
      io.to(socket.currentRoom).emit("playerMoved", {
        playerId: player.id,
        path
      });
    }

    // 🔹 Végső pozíció frissítése
    player.position = targetCellId;

    const othersHere = Object.values(gameState.players)
    .filter(p => p.id !== player.id && p.alive && p.position === targetCellId);
    const differentFaction = othersHere.find(p => p.faction !== player.faction);
    const cell = cellById(gameState.board, targetCellId);

    if (differentFaction) {
      gameState.pvpPending = { aId: player.id, bId: differentFaction.id, cellId: targetCellId };
      io.to(socket.currentRoom).emit("pvpStarted", {
        aId: player.id,
        bId: differentFaction.id,
        cellName: cell.name
      });
    } else {
      if (cell.faction && cell.faction !== "NEUTRAL" && player.alive) {
        const card = drawFactionCard(cell.faction);
        gameState.lastDrawn = { type: "FACTION", faction: cell.faction, card };
        io.to(socket.currentRoom).emit("cardDrawn", {
          playerId: player.id,
          type: "FACTION",
          faction: cell.faction,
          card
        });

        const sameFaction = (player.faction === cell.faction);
        const effect = sameFaction ? card.selfEffect : card.otherEffect;

        if (effect.effect === "battle") {
          const enemy = drawEnemyCard();
          io.to(socket.currentRoom).emit("enemyDrawn", enemy);

          const result = battlePVE(player, enemy, io, socket.id);
          io.to(socket.currentRoom).emit("battleResult", {
            type: "PVE",
            result,
            playerId: player.id,
            enemy
          });

          // 🔹 System üzenet PvE részletekkel
          const detailMsg =
          `${player.name} dobása: ${result.rollP} + ATK(${player.stats.ATK}) - DEF(${enemy.DEF}) = ${result.totalP}\n` +
          `${enemy.name || "Ellenség"} dobása: ${result.rollE} + ATK(${enemy.ATK}) - DEF(${player.stats.DEF}) = ${result.totalE}\n` +
          `Győztes: ${result.winner === "player" ? player.name : (enemy.name || "Ellenség")}, sebzés: ${result.damage}`;

          sendSystemMessage(socket.currentRoom, `${player.name} PvE harcot vívott a(z) ${enemy.name || "ellenfél"} ellen.\n${detailMsg}`);

          if (result.winner === "enemy") {
            if (player.stats.HP <= 0) {
              player.alive = false;
              io.to(socket.currentRoom).emit("playerDied", { playerId: player.id, cause: "PVE" });
              sendSystemMessage(socket.currentRoom, `${player.name} has died in PvE combat.`);
            }
          } else {
            if (!sameFaction || card.loot) {
              const item = drawEquipmentCard();
              applyItemToPlayer(player, item);
              io.to(socket.currentRoom).emit("itemLooted", { playerId: player.id, item });
              sendSystemMessage(socket.currentRoom, `${player.name} looted an item: ${item.name}`);
            }
          }
        } else {
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
      }
    }

    broadcast(socket.currentRoom);
    if (!gameState.pvpPending) advanceTurn(socket.currentRoom);
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

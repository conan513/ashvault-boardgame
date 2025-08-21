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

// Játék állapot létrehozása
function makeGameState() {
  return {
    board: initBoard(),
    players: {},
    turnOrder: [],
    currentTurnIndex: 0,
    lastDrawn: null,
    pvpPending: null,
    waitingForCharacters: {} // karakterválasztón várakozók
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
/** ---- SOCKET.IO ---- **/
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Segédfüggvény system chathez
  function sendSystemMessage(roomName, message) {
    io.to(roomName).emit("receiveChat", {
      playerId: "system",
      message: `🔵 ${message}`
    });
  }

  // Szobák listázása
  socket.on("listRooms", () => {
    const list = Object.entries(rooms).map(([name, state]) => ({
      name,
      players: Object.keys(state.players).length
    }));
    socket.emit("roomList", list);
  });

  // Szoba létrehozása vagy csatlakozás
  socket.on("createOrJoinRoom", ({ roomName, create }) => {
    if (create) {
      // 🔹 Szoba létrehozás
      if (rooms[roomName]) {
        return socket.emit("errorMsg", "❌ A szoba név már foglalt!");
      }
      rooms[roomName] = makeGameState();
      resetDecksState();
    } else {
      // 🔹 Csatlakozás meglévő szobához
      if (!rooms[roomName]) {
        return socket.emit("errorMsg", "❌ Nincs ilyen szoba!");
      }
    }

    const gameState = rooms[roomName];

    socket.join(roomName);
    socket.currentRoom = roomName;
    gameState.waitingForCharacters[socket.id] = true;

    socket.emit("roomJoined", { roomName });
    socket.emit("hello", { factions, characters });
  });


  // Kilépés szobából
  socket.on("leaveRoom", () => {
    if (!socket.currentRoom) return;
    const roomName = socket.currentRoom;
    const gameState = rooms[roomName];

    socket.leave(roomName);
    delete socket.currentRoom;

    if (gameState && gameState.waitingForCharacters[socket.id]) {
      delete gameState.waitingForCharacters[socket.id];
    }

    tryDeleteRoom(roomName);
  });

  // Játékos csatlakozása a játékhoz (karakter választás)
  socket.on("joinGame", ({ playerName, characterId }) => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;

    if (Object.keys(gameState.players).length >= 4) {
      return socket.emit("errorMsg", "This room is full (max 4 players).");
    }

    const c = characters.find(ch => ch.id === characterId);
    if (!c) return socket.emit("errorMsg", "Unknown character.");
    if (Object.values(gameState.players).some(p => p.characterId === characterId)) {
      return socket.emit("errorMsg", "This character is already taken!");
    }

    if (gameState.waitingForCharacters[socket.id]) {
      delete gameState.waitingForCharacters[socket.id];
    }

    gameState.players[socket.id] = {
      id: socket.id,
      name: playerName || "Névtelen",
      faction: c.faction,
      characterId: c.id,
      characterName: c.name,
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

    // ⚡ System üzenet, hogy csatlakozott
    sendSystemMessage(socket.currentRoom, `${playerName} has joined the game.`);

    broadcast(socket.currentRoom);
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
  socket.on("confirmMove", ({ dice, targetCellId }) => {
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
        const wasCurrent = getCurrentPlayerId(gameState) === socket.id;

        if (gameState.players[socket.id]) {
          const leavingPlayer = gameState.players[socket.id];
          sendSystemMessage(roomName, `${leavingPlayer.name} has left the game.`);

          delete gameState.players[socket.id];
          gameState.turnOrder = gameState.turnOrder.filter(id => id !== socket.id);
          if (gameState.currentTurnIndex >= gameState.turnOrder.length) {
            gameState.currentTurnIndex = 0;
          }
          broadcast(roomName);
          if (wasCurrent) {
            io.to(roomName).emit("turnChanged", getCurrentPlayerId(gameState));
          }
        }

        if (gameState.waitingForCharacters[socket.id]) {
          delete gameState.waitingForCharacters[socket.id];
        }
      }

      tryDeleteRoom(roomName);
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Szerver fut: http://0.0.0.0:${PORT}`);
});

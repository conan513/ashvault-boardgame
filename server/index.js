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

function makeGameState() {
  return {
    board: initBoard(),
    players: {},
    turnOrder: [],
    currentTurnIndex: 0,
    lastDrawn: null,
    pvpPending: null
  };
}

function getCurrentPlayerId(state) {
  return state.turnOrder[state.currentTurnIndex] || null;
}
function isPlayersTurn(state, socketId) {
  return socketId === getCurrentPlayerId(state);
}
function broadcast(roomName) {
  const state = rooms[roomName];
  if (!state) return;
  io.to(roomName).emit("updateGame", sanitizeGameStateForClients(state));
}
function advanceTurn(roomName) {
  const state = rooms[roomName];
  if (!state || state.turnOrder.length === 0) return;
  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  io.to(roomName).emit("turnChanged", getCurrentPlayerId(state));
}

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
      alive: p.alive
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

/** ---- SOCKET.IO ---- **/
io.on("connection", (socket) => {
  console.log("Kapcsolódott:", socket.id);

  socket.on("createOrJoinRoom", ({ roomName }) => {
    if (!rooms[roomName]) {
      rooms[roomName] = makeGameState();
      resetDecksState();
    }
    socket.join(roomName);
    socket.currentRoom = roomName;
    socket.emit("roomJoined", { roomName });
    socket.emit("hello", { factions, characters });
  });

  socket.on("joinGame", ({ playerName, characterId }) => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;

    const c = characters.find(ch => ch.id === characterId);
    if (!c) return socket.emit("errorMsg", "Ismeretlen karakter.");

    if (Object.values(gameState.players).some(p => p.characterId === characterId)) {
      return socket.emit("errorMsg", "Ez a karakter már foglalt!");
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
      alive: true
    };

    gameState.turnOrder.push(socket.id);
    if (gameState.turnOrder.length === 1) {
      gameState.currentTurnIndex = 0;
      io.to(socket.currentRoom).emit("turnChanged", socket.id);
    }
    broadcast(socket.currentRoom);
  });

  socket.on("rollDice", () => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;
    if (!isPlayersTurn(gameState, socket.id)) return socket.emit("errorMsg", "Nem a te köröd!");

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

  socket.on("endTurn", () => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;
    if (!isPlayersTurn(gameState, socket.id)) return socket.emit("errorMsg", "Nem a te köröd!");
    advanceTurn(socket.currentRoom);
  });

  socket.on("confirmMove", ({ dice, targetCellId }) => {
    const gameState = rooms[socket.currentRoom];
    if (!gameState) return;
    if (!isPlayersTurn(gameState, socket.id)) return socket.emit("errorMsg", "Nem a te köröd!");

    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    // Get the current position of the player
    const currentCell = gameState.board.find(c => c.id === player.position);

    // Determine valid movement options based on current cell (inner or outer ring)
    const validTargets = adjacencyAtDistance(gameState.board, player.position, dice);

    // Ensure the target is within the valid set based on the ring and distance
    const isInOuterRing = currentCell.ring === "OUTER";
    const isInInnerRing = currentCell.ring === "INNER";

    // Ensure the target is within the valid set based on the player's current ring
    if (isInOuterRing) {
      // Can only move in the outer ring
      if (!validTargets.includes(targetCellId) || gameState.board[targetCellId].ring !== "OUTER") {
        return socket.emit("errorMsg", "Érvénytelen célmező az Outer gyűrűben.");
      }
    } else if (isInInnerRing) {
      // Can only move in the inner ring
      if (!validTargets.includes(targetCellId) || gameState.board[targetCellId].ring !== "INNER") {
        return socket.emit("errorMsg", "Érvénytelen célmező az Inner gyűrűben.");
      }
    }

    // Ensure that the target is exactly the right distance from the current position
    const distance = Math.abs(currentCell.id - targetCellId);
    if (distance !== dice) {
      return socket.emit("errorMsg", "A mozgás távolsága nem egyezik meg a dobott számú mezővel.");
    }

    // Move the player to the target cell
    player.position = targetCellId;

    // Handle potential battle or events at the new position
    const othersHere = Object.values(gameState.players)
    .filter(p => p.id !== player.id && p.alive && p.position === targetCellId);
    const differentFaction = othersHere.find(p => p.faction !== player.faction);

    const cell = cellById(gameState.board, targetCellId);

    if (differentFaction) {
      gameState.pvpPending = { aId: player.id, bId: differentFaction.id, cellId: targetCellId };
      io.to(socket.currentRoom).emit("pvpStarted", { aId: player.id, bId: differentFaction.id, cellName: cell.name });
    } else {
      if (cell.faction && cell.faction !== "NEUTRAL" && player.alive) {
        const card = drawFactionCard(cell.faction);
        gameState.lastDrawn = { type: "FACTION", faction: cell.faction, card };
        io.to(socket.currentRoom).emit("cardDrawn", gameState.lastDrawn);

        const sameFaction = (player.faction === cell.faction);

        if (card.effect === "battle") {
          const enemy = drawEnemyCard();
          io.to(socket.currentRoom).emit("enemyDrawn", enemy);
          const result = battlePVE(player, enemy, io, socket.id);
          io.to(socket.currentRoom).emit("battleResult", { type: "PVE", result, playerId: player.id, enemy });
          if (result.winner === "enemy") {
            if (player.stats.HP <= 0) {
              player.alive = false;
              io.to(socket.currentRoom).emit("playerDied", { playerId: player.id, cause: "PVE" });
            }
          } else {
            if (!sameFaction || card.loot) {
              const item = drawEquipmentCard();
              applyItemToPlayer(player, item);
              io.to(socket.currentRoom).emit("itemLooted", { playerId: player.id, item });
            }
          }
        } else {
          if (card.loot) {
            const item = drawEquipmentCard();
            applyItemToPlayer(player, item);
            io.to(socket.currentRoom).emit("itemLooted", { playerId: player.id, item });
          }
          if (card.hpDelta) {
            player.stats.HP += card.hpDelta;
            if (player.stats.HP <= 0) {
              player.alive = false;
              io.to(socket.currentRoom).emit("playerDied", { playerId: player.id, cause: "Event" });
            }
          }
          if (card.statMods) {
            for (const [k, v] of Object.entries(card.statMods)) {
              player.stats[k] = Math.max(0, player.stats[k] + v);
            }
            io.to(socket.currentRoom).emit("statsChanged", { playerId: player.id, stats: player.stats });
          }
        }
      }
    }

    broadcast(socket.currentRoom);
    if (!gameState.pvpPending) advanceTurn(socket.currentRoom);
  });


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
      io.to(socket.currentRoom).emit("battleResult", { type: "PVP", result, aId: A.id, bId: B.id, cellId: pending.cellId });

      const loser = result.winner === "A" ? B : A;
      loser.stats.HP -= 5;
      if (loser.stats.HP <= 0) {
        loser.alive = false;
        io.to(socket.currentRoom).emit("playerDied", { playerId: loser.id, cause: "PVP" });
      }

      const winner = result.winner === "A" ? A : B;
      if (loser.inventory.length > 0) {
        const stolen = loser.inventory.pop();
        applyItemToPlayer(winner, stolen);
        io.to(socket.currentRoom).emit("itemStolen", { from: loser.id, to: winner.id, item: stolen });
      }

      gameState.pvpPending = null;
      broadcast(socket.currentRoom);
      advanceTurn(socket.currentRoom);
    });

    socket.on("disconnect", () => {
      const gameState = rooms[socket.currentRoom];
      if (!gameState) return;
      const wasCurrent = getCurrentPlayerId(gameState) === socket.id;
      delete gameState.players[socket.id];
      gameState.turnOrder = gameState.turnOrder.filter(id => id !== socket.id);
      if (gameState.currentTurnIndex >= gameState.turnOrder.length) {
        gameState.currentTurnIndex = 0;
      }
      broadcast(socket.currentRoom);
      if (wasCurrent) io.to(socket.currentRoom).emit("turnChanged", getCurrentPlayerId(gameState));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Szerver fut: http://localhost:${PORT}`);
});

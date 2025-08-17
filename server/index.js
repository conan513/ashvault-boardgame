// server/index.js
// Főindító: Express + Socket.IO + statikus fájlok kiszolgálása
// Hivatkozik: ./gameLoop.js, ./board.js, ./characters.js, ./battleSystem.js, ./inventory.js, ./decks/*.json

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
} = require("./gameLoop"); // itt tároljuk a paklik állapotát és húzást

const app = express();
app.use(cors());
app.use(express.json());
app.use("/", express.static(path.join(__dirname, "..", "client")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/** ---- JÁTÉK ÁLLAPOT ---- **/
let gameState = {
  board: initBoard(),
  players: {}, // socketId -> player
  turnOrder: [],
  currentTurnIndex: 0,
  lastDrawn: null, // utolsó húzott kártya UI-hoz
  pvpPending: null // {aId,bId,cellId}
};

resetDecksState(); // paklik keverése

function getCurrentPlayerId() {
  return gameState.turnOrder[gameState.currentTurnIndex] || null;
}
function isPlayersTurn(socketId) {
  return socketId === getCurrentPlayerId();
}
function broadcast() {
  io.emit("updateGame", sanitizeGameStateForClients(gameState));
}
function advanceTurn() {
  if (gameState.turnOrder.length === 0) return;
  gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
  io.emit("turnChanged", getCurrentPlayerId());
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
    currentPlayer: getCurrentPlayerId(),
    lastDrawn: state.lastDrawn,
    pvpPending: state.pvpPending
  };
}

/** ---- SOCKET.IO ---- **/
io.on("connection", (socket) => {
  console.log("Kapcsolódott:", socket.id);
  socket.emit("hello", { factions, characters });

  socket.on("joinGame", ({ playerName, characterId }) => {
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
      io.emit("turnChanged", getCurrentPlayerId());
    }
    broadcast();
  });

  socket.on("rollDice", () => {
    if (!isPlayersTurn(socket.id)) return socket.emit("errorMsg", "Nem a te köröd!");
    const dice = Math.floor(Math.random() * 6) + 1;
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;
    const targets = adjacencyAtDistance(gameState.board, player.position, dice);
    socket.emit("diceResult", { dice, targets });
  });

  socket.on("confirmMove", ({ dice, targetCellId }) => {
    if (!isPlayersTurn(socket.id)) return socket.emit("errorMsg", "Nem a te köröd!");
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    const targets = adjacencyAtDistance(gameState.board, player.position, dice);
    if (!targets.includes(targetCellId)) {
      return socket.emit("errorMsg", "Érvénytelen célmező.");
    }

    player.position = targetCellId;

    const othersHere = Object.values(gameState.players)
      .filter(p => p.id !== player.id && p.alive && p.position === targetCellId);
    const differentFaction = othersHere.find(p => p.faction !== player.faction);

    const cell = cellById(gameState.board, targetCellId);

    if (differentFaction) {
      gameState.pvpPending = { aId: player.id, bId: differentFaction.id, cellId: targetCellId };
      io.emit("pvpStarted", { aId: player.id, bId: differentFaction.id, cellName: cell.name });
    } else {
      if (cell.faction && cell.faction !== "NEUTRAL" && player.alive) {
        const card = drawFactionCard(cell.faction);
        gameState.lastDrawn = { type: "FACTION", faction: cell.faction, card };
        io.emit("cardDrawn", gameState.lastDrawn);

        const sameFaction = (player.faction === cell.faction);

        if (card.effect === "battle") {
          const enemy = drawEnemyCard();
          io.emit("enemyDrawn", enemy);
          const result = battlePVE(player, enemy, io, socket.id);
          io.emit("battleResult", { type: "PVE", result, playerId: player.id, enemy });
          if (result.winner === "enemy") {
            if (player.stats.HP <= 0) {
              player.alive = false;
              io.emit("playerDied", { playerId: player.id, cause: "PVE" });
            }
          } else {
            if (!sameFaction || card.loot) {
              const item = drawEquipmentCard();
              applyItemToPlayer(player, item);
              io.emit("itemLooted", { playerId: player.id, item });
            }
          }
        } else {
          if (card.loot) {
            const item = drawEquipmentCard();
            applyItemToPlayer(player, item);
            io.emit("itemLooted", { playerId: player.id, item });
          }
          if (card.hpDelta) {
            player.stats.HP += card.hpDelta;
            if (player.stats.HP <= 0) {
              player.alive = false;
              io.emit("playerDied", { playerId: player.id, cause: "Event" });
            }
          }
          if (card.statMods) {
            for (const [k, v] of Object.entries(card.statMods)) {
              player.stats[k] = Math.max(0, player.stats[k] + v);
            }
            io.emit("statsChanged", { playerId: player.id, stats: player.stats });
          }
        }
      }
    }

    broadcast();
    if (!gameState.pvpPending) advanceTurn();
  });

  socket.on("resolvePVP", () => {
    const pending = gameState.pvpPending;
    if (!pending) return;
    const A = gameState.players[pending.aId];
    const B = gameState.players[pending.bId];
    if (!A || !B || !A.alive || !B.alive) {
      gameState.pvpPending = null;
      broadcast();
      advanceTurn();
      return;
    }
    const result = require("./battleSystem").battlePVP(A, B, io);
    io.emit("battleResult", { type: "PVP", result, aId: A.id, bId: B.id, cellId: pending.cellId });

    const loser = result.winner === "A" ? B : A;
    loser.stats.HP -= 5;
    if (loser.stats.HP <= 0) {
      loser.alive = false;
      io.emit("playerDied", { playerId: loser.id, cause: "PVP" });
    }

    const winner = result.winner === "A" ? A : B;
    if (loser.inventory.length > 0) {
      const stolen = loser.inventory.pop();
      applyItemToPlayer(winner, stolen);
      io.emit("itemStolen", { from: loser.id, to: winner.id, item: stolen });
    }

    gameState.pvpPending = null;
    broadcast();
    advanceTurn();
  });

  socket.on("disconnect", () => {
    const wasCurrent = getCurrentPlayerId() === socket.id;
    delete gameState.players[socket.id];
    gameState.turnOrder = gameState.turnOrder.filter(id => id !== socket.id);
    if (gameState.currentTurnIndex >= gameState.turnOrder.length) {
      gameState.currentTurnIndex = 0;
    }
    broadcast();
    if (wasCurrent) io.emit("turnChanged", getCurrentPlayerId());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Szerver fut: http://localhost:${PORT}`);
});

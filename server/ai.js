// server/ai.js
const { adjacencyAtDistance, cellById } = require("./board");
const { characters } = require("./characters");
const { applyItemToPlayer } = require("./inventory");
const { drawFactionCard, drawEquipmentCard, drawEnemyCard } = require("./gameLoop");
const { battlePVE } = require("./battleSystem");

let ioRef = null;
let roomsRef = null;
let broadcastRef = null;
let advanceTurnRef = null;

function initAI(io, rooms, broadcast, advanceTurn) {
    ioRef = io;
    roomsRef = rooms;
    broadcastRef = broadcast;
    advanceTurnRef = advanceTurn;
}

// Új AI játékos létrehozása
function createAIPlayer(roomName, aiId) {
    const gameState = roomsRef[roomName];
    if (!gameState) return;

    // Random karakter
    const freeCharacters = characters.filter(
        ch => !Object.values(gameState.players).some(p => p.characterId === ch.id)
    );
    if (freeCharacters.length === 0) return;

    const c = freeCharacters[Math.floor(Math.random() * freeCharacters.length)];

    gameState.players[aiId] = {
        id: aiId,
        name: `AI_${aiId.slice(0, 4)}`,
        faction: c.faction,
        characterId: c.id,
        characterName: c.name,
        stats: { HP: c.HP, ATK: c.ATK, DEF: c.DEF, PSY: c.PSY, RES: c.RES },
        position: c.spawn,
        inventory: [],
        alive: true,
        activeBuffs: [],
        activeDebuffs: [],
        isAI: true
    };

    gameState.turnOrder.push(aiId);
    if (gameState.turnOrder.length === 1) {
        gameState.currentTurnIndex = 0;
        ioRef.to(roomName).emit("turnChanged", aiId);
    }

    ioRef.to(roomName).emit("receiveChat", {
        playerId: aiId,
        message: `${gameState.players[aiId].name} csatlakozott a játékhoz!`
    });

    broadcastRef(roomName);
}

// AI körének lejátszása
function aiTakeTurn(roomName, aiId) {
    const gameState = roomsRef[roomName];
    if (!gameState) return;
    const player = gameState.players[aiId];
    if (!player || !player.alive) return;

    // 1) dobás
    const dice = Math.floor(Math.random() * 6) + 1;
    const targets = adjacencyAtDistance(gameState.board, player.position, dice);

    if (targets.length === 0) {
        ioRef.to(roomName).emit("receiveChat", {
            playerId: aiId,
            message: `${player.name} dobott ${dice}-t, de nincs elérhető mező.`
        });
        advanceTurnRef(roomName);
        return;
    }

    // 2) random cél kiválasztás
    const targetCellId = targets[Math.floor(Math.random() * targets.length)];
    ioRef.to(roomName).emit("diceResult", { dice, targets, playerId: aiId });
    ioRef.to(roomName).emit("receiveChat", {
        playerId: aiId,
        message: `${player.name} dobott ${dice}-t és ${targetCellId} mezőre lépett.`
    });

    // 3) mozgás feldolgozása
    handlePlayerMove(roomName, aiId, dice, targetCellId);
}

// AI (vagy emberi) mozgás logika
function handlePlayerMove(roomName, playerId, dice, targetCellId) {
    const gameState = roomsRef[roomName];
    if (!gameState) return;
    const player = gameState.players[playerId];
    if (!player || !player.alive) return;

    const targets = adjacencyAtDistance(gameState.board, player.position, dice);
    if (!targets.includes(targetCellId)) return;

    player.position = targetCellId;

    const othersHere = Object.values(gameState.players)
    .filter(p => p.id !== player.id && p.alive && p.position === targetCellId);
    const differentFaction = othersHere.find(p => p.faction !== player.faction);
    const cell = cellById(gameState.board, targetCellId);

    if (differentFaction) {
        gameState.pvpPending = { aId: player.id, bId: differentFaction.id, cellId: targetCellId };
        ioRef.to(roomName).emit("pvpStarted", {
            aId: player.id,
            bId: differentFaction.id,
            cellName: cell.name
        });
        ioRef.to(roomName).emit("receiveChat", {
            playerId: player.id,
            message: `${player.name} összefutott ${differentFaction.name} játékossal, PvP kezdődik!`
        });
    } else {
        if (cell.faction && cell.faction !== "NEUTRAL" && player.alive) {
            const card = drawFactionCard(cell.faction);
            gameState.lastDrawn = { type: "FACTION", faction: cell.faction, card };
            ioRef.to(roomName).emit("cardDrawn", {
                playerId: player.id,
                type: "FACTION",
                faction: cell.faction,
                card
            });

            ioRef.to(roomName).emit("receiveChat", {
                playerId: player.id,
                message: `${player.name} húzott egy frakciókártyát (${cell.faction}).`
            });

            const sameFaction = (player.faction === cell.faction);
            const effect = sameFaction ? card.selfEffect : card.otherEffect;

            if (effect.effect === "battle") {
                const enemy = drawEnemyCard();
                ioRef.to(roomName).emit("enemyDrawn", enemy);

                const result = battlePVE(player, enemy, ioRef, player.id);
                ioRef.to(roomName).emit("battleResult", {
                    type: "PVE",
                    result,
                    playerId: player.id,
                    enemy
                });

                if (result.winner === "enemy") {
                    if (player.stats.HP <= 0) {
                        player.alive = false;
                        ioRef.to(roomName).emit("playerDied", { playerId: player.id, cause: "PVE" });
                        ioRef.to(roomName).emit("receiveChat", {
                            playerId: player.id,
                            message: `${player.name} meghalt a harcban!`
                        });
                    }
                } else {
                    if (!sameFaction || card.loot) {
                        const item = drawEquipmentCard();
                        applyItemToPlayer(player, item);
                        ioRef.to(roomName).emit("itemLooted", { playerId: player.id, item });
                        ioRef.to(roomName).emit("receiveChat", {
                            playerId: player.id,
                            message: `${player.name} zsákmányolt egy tárgyat: ${item.name}`
                        });
                    }
                }
            }
        }
    }

    broadcastRef(roomName);
    if (!gameState.pvpPending) advanceTurnRef(roomName);
}

module.exports = {
    initAI,
    createAIPlayer,
    aiTakeTurn,
    handlePlayerMove
};

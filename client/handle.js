// client/handle.js
import { socket } from "./socket";
import { renderBoard, updatePlayer, removePlayer } from "./uiBoard";
import { showMessage, showError, updateChat } from "./uiChat";
import { showCard, showEnemy, showBattleResult, showLoot } from "./uiEvents";
import { updateStats, markDead } from "./uiStats";

export function initHandlers(gameState) {
    /** ---- HELLO (meta adatok) ---- */
    socket.on("hello", ({ factions, characters }) => {
        console.log("Frakciók és karakterek betöltve:", factions, characters);
        gameState.factions = factions;
        gameState.characters = characters;
    });

    /** ---- JÁTÉK ÁLLAPOT ---- */
    socket.on("updateGame", (state) => {
        gameState.board = state.board;
        gameState.players = state.players;
        gameState.turnOrder = state.turnOrder;
        gameState.currentTurnIndex = state.currentTurnIndex;
        gameState.currentPlayer = state.currentPlayer;
        gameState.lastDrawn = state.lastDrawn;
        gameState.pvpPending = state.pvpPending;

        renderBoard(gameState.board, gameState.players);
    });

    /** ---- TURN ---- */
    socket.on("turnChanged", (playerId) => {
        gameState.currentPlayer = playerId;
        showMessage(`Most ${gameState.players[playerId]?.name || "?"} köre van.`);
    });

    /** ---- KOCKADOBÁS ---- */
    socket.on("diceResult", ({ dice, targets, playerId }) => {
        showMessage(`${gameState.players[playerId]?.name} dobott: ${dice}`);
        console.log("Lehetséges mezők:", targets);
    });

    /** ---- CHAT ---- */
    socket.on("receiveChat", ({ playerId, message }) => {
        updateChat(playerId, message);
    });

    /** ---- KÁRTYÁK ---- */
    socket.on("cardDrawn", ({ playerId, type, faction, card }) => {
        showCard(playerId, type, faction, card);
    });

    socket.on("enemyDrawn", (enemy) => {
        showEnemy(enemy);
    });

    /** ---- LOOT ---- */
    socket.on("itemLooted", ({ playerId, item }) => {
        showLoot(playerId, item);
    });

    socket.on("itemStolen", ({ from, to, item }) => {
        showMessage(`${gameState.players[to]?.name} ellopta ${gameState.players[from]?.name} tárgyát: ${item.name}`);
    });

    /** ---- STAT VÁLTOZÁS ---- */
    socket.on("statsChanged", ({ playerId, stats }) => {
        updateStats(playerId, stats);
    });

    /** ---- HALÁL ---- */
    socket.on("playerDied", ({ playerId, cause }) => {
        markDead(playerId, cause);
    });

    /** ---- PVP ---- */
    socket.on("pvpStarted", ({ aId, bId, cellName }) => {
        showMessage(`⚔️ PVP kezdődik ${gameState.players[aId]?.name} és ${gameState.players[bId]?.name} között (${cellName})!`);
    });

    socket.on("battleResult", (result) => {
        showBattleResult(result);
    });

    /** ---- HIBÁK ---- */
    socket.on("errorMsg", (msg) => {
        showError(msg);
    });
}

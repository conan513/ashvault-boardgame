// Két gyűrűs: külső 24 mező, belső 12 mező + 1 központ. 4 átjáró.

const { factions } = require("./factions");

const gatewaysOuter = [0, 6, 12, 18];
const gatewaysInner = [24, 27, 30, 33];

function factionForIndex(i) {
  if (i < 24) {
    const idx = i % 24;
    if (idx < 6) return "Space Marines";
    if (idx < 12) return "Eldar";
    if (idx < 18) return "Orks";
    if (idx < 24) return "Chaos";
  } else if (i < 36) {
    const idx = (i - 24) % 12;
    if (idx < 3) return "Space Marines";
    if (idx < 6) return "Eldar";
    if (idx < 9) return "Orks";
    if (idx < 12) return "Chaos";
  }
  return "NEUTRAL";
}

function nameForCell(i) {
  const namesOuter = [
    // 24 külső mező neve
    "Macragge Watch","Titus’ Rampart","Astartes Bastion","Librarium Gate","Techmarine Forge","Honor Guard Keep",
    "Ulthwé Path","Biel-Tan Grove","Saim-Hann Way","Iyanden Veil","Alaitoc Ridge","Webway Portal",
    "Waaagh! Cliff","Grot Tunnels","Big Mek Yard","Squig Plain","Warboss Roost","Deff Docks",
    "Vox of Chaos","Daemon Rift","Warp Scar","Black Legion Way","Eightfold Spire","Oblivion Post"
  ];
  const namesInner = [
    // 12 belső mező neve
    "Inner Macragge","Servo Reliquary","Astartes Shrine","Infinity Circuit","Spirit Gate","Seer Council",
    "Teef Market","Ork Scrapway","Zogwort Den","Dark Creed","Warp Altar","Plague Chapel"
  ];
  if (i < 24) return namesOuter[i];
  if (i >= 24 && i < 36) return namesInner[i - 24];
  return "The Omega Vault";
}

function initBoard() {
  const cells = [];
  for (let i = 0; i < 24; i++) {
    cells.push({ id:i, ring:"OUTER", name:nameForCell(i), faction:factionForIndex(i) });
  }
  for (let i = 24; i < 36; i++) {
    cells.push({ id:i, ring:"INNER", name:nameForCell(i), faction:factionForIndex(i) });
  }
  cells.push({ id:36, ring:"CENTER", name:nameForCell(36), faction:"NEUTRAL" });
  return cells;
}

function neighbors(board, id) {
  const cell = board.find(c => c.id === id);
  if (!cell) return [];
  if (cell.ring === "CENTER") return [];
  const res = [];
  if (cell.ring === "OUTER") {
    const left = (id + 23) % 24;
    const right = (id + 1) % 24;
    res.push(left, right);
    const gi = gatewaysOuter.indexOf(id);
    if (gi >= 0) res.push(gatewaysInner[gi]);
  } else if (cell.ring === "INNER") {
    const innerIdx = id - 24;
    const left = 24 + ((innerIdx + 11) % 12);
    const right = 24 + ((innerIdx + 1) % 12);
    res.push(left, right);
    const gi = gatewaysInner.indexOf(id);
    if (gi >= 0) res.push(gatewaysOuter[gi]);
  }
  return res;
}

function adjacencyAtDistance(board, startId, dist) {
  let frontier = new Set([startId]);
  for (let step = 0; step < dist; step++) {
    const next = new Set();
    for (const id of frontier) neighbors(board, id).forEach(n => next.add(n));
    frontier = next;
  }
  frontier.delete(startId);
  return Array.from(frontier.values());
}

function cellById(board, id) {
  return board.find(c => c.id === id);
}

module.exports = { initBoard, neighbors, adjacencyAtDistance, cellById };

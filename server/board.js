// server/board.js
// Két gyűrűs 40 mező + 41. központ. 4 átjáró.

const { factions } = require("./factions");

const gatewaysOuter = [0, 5, 10, 15];
const gatewaysInner = [20, 25, 30, 35];

function factionForIndex(i) {
  const idx = i % 20;
  if (idx >= 0 && idx <= 4) return "Space Marines";
  if (idx >= 5 && idx <= 9) return "Eldar";
  if (idx >= 10 && idx <= 14) return "Orks";
  if (idx >= 15 && idx <= 19) return "Chaos";
  return "NEUTRAL";
}

function nameForCell(i) {
  const namesOuter = [
    "Macragge Watch","Titus’ Rampart","Astartes Bastion","Librarium Gate","Techmarine Forge",
    "Ulthwé Path","Biel-Tan Grove","Saim-Hann Way","Iyanden Veil","Alaitoc Ridge",
    "Waaagh! Cliff","Grot Tunnels","Big Mek Yard","Squig Plain","Warboss Roost",
    "Vox of Chaos","Daemon Rift","Warp Scar","Black Legion Way","Eightfold Spire"
  ];
  const namesInner = [
    "Inner Macragge","Inner Librarium","Servo Reliquary","Astartes Shrine","Honor Hall",
    "Infinity Circuit","Crystal Dome","Spirit Gate","Seer Council","Wraith Hall",
    "Teef Market","Stompa Pit","Ork Scrapway","Zogwort Den","Green Tide",
    "Dark Creed","Eye of Terror","Warp Altar","Despoiler Route","Plague Chapel"
  ];
  if (i < 20) return namesOuter[i];
  if (i >= 20 && i < 40) return namesInner[i - 20];
  return "No Man’s Land";
}

function initBoard() {
  const cells = [];
  for (let i = 0; i < 20; i++) cells.push({ id:i, ring:"OUTER", name:nameForCell(i), faction:factionForIndex(i) });
  for (let i = 20; i < 40; i++) cells.push({ id:i, ring:"INNER", name:nameForCell(i), faction:factionForIndex(i) });
  cells.push({ id:40, ring:"CENTER", name:nameForCell(40), faction:"NEUTRAL" });
  return cells;
}

function neighbors(board, id) {
  const cell = board.find(c => c.id === id);
  if (!cell) return [];
  if (cell.ring === "CENTER") return [];
  const res = [];
  if (cell.ring === "OUTER") {
    const left = (id + 19) % 20;
    const right = (id + 1) % 20;
    res.push(left, right);
    const gi = gatewaysOuter.indexOf(id);
    if (gi >= 0) res.push(gatewaysInner[gi]);
  } else if (cell.ring === "INNER") {
    const innerIdx = id - 20;
    const left = 20 + ((innerIdx + 19) % 20);
    const right = 20 + ((innerIdx + 1) % 20);
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

// Két gyűrűs: külső 24 mező, belső 12 mező + 1 központ. 4 átjáró.

const { factions } = require("./factions");

const gatewaysOuter = [0, 6, 12, 18];
const gatewaysInner = [24, 27, 30, 33];

function factionForIndex(i) {
  if (i < 24) {
    const idx = i % 24;
    if (idx < 6) return "Order of Knights";
    if (idx < 12) return "The Hollow Grove";
    if (idx < 18) return "Cyber Dwarves";
    if (idx < 24) return "Graveborn";
  } else if (i < 36) {
    const idx = (i - 24) % 12;
    if (idx < 3) return "Order of Knights";
    if (idx < 6) return "The Hollow Grove";
    if (idx < 9) return "Cyber Dwarves";
    if (idx < 12) return "Graveborn";
  }
  return "NEUTRAL";
}

function nameForCell(i) {
  const namesOuter = [
    // Order of Knights (0–5)
    "Caelis Gate","Granite Bastion","Goldvoice Chapel","Knight’s Keep","Oathsworn Watch","Sanctum of Steel",
    // The Hollow Grove (6–11)
    "Whispering Thicket","Moonpetal Glade","Elderwood Path","Thornwisp Vale","Wildmother’s Grove","Heartroot Circle",
    // Cyber Dwarves (12–17)
    "Ironstep Gate","Sparkfist Forge","Cogspire Yard","Data Mines","Scrapline Outpost","Codeflare Nexus",
    // Graveborn (18–23)
    "Butcher’s Moor","Rustheart Chains","Bonebrand Spire","Whisperveil Marsh","Grave Mother’s Den","Oblivion Crypt"
  ];
  const namesInner = [
    // Order of Knights (24–26)
    "Inner Keep","Reliquary of Valor","Hall of Oaths",
    // The Hollow Grove (27–29)
    "Spirit Hollow","Ancient Grove","Seer’s Arbor",
    // Cyber Dwarves (30–32)
    "Core Reactor","Mech-Forge","Circuit Sanctum",
    // Graveborn (33–35)
    "Dark Reliquary","Plague Chapel","Warped Sepulcher"
  ];
  if (i < 24) return namesOuter[i];
  if (i >= 24 && i < 36) return namesInner[i - 24];
  return "The Last Flame"; // center
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

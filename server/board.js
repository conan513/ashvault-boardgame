// board.js

const gatewaysOuter = [0, 6, 12, 18];
const gatewaysInner = [24, 27, 30, 33];

const specialTargetNames = [
  "Caelis Gate",
"Butcher’s Moor",
"Ironstep Gate",
"Whispering Thicket"
];

const specialFactions = ["Graveyard", "Temple", "Village", "Tavern"];

// Külső / belső gyűrű frakció-meghatározás
function factionForIndex(i) {
  if (i < 24) {
    const idx = i % 24;
    if (idx < 6) return "Order of Knights";
    if (idx < 12) return "The Hollow Grove";
    if (idx < 18) return "Cyber Dwarves";
    return "Graveborn";
  } else if (i < 36) {
    const idx = (i - 24) % 12;
    if (idx < 3) return "Order of Knights";
    if (idx < 6) return "The Hollow Grove";
    if (idx < 9) return "Cyber Dwarves";
    return "Graveborn";
  }
  return "NEUTRAL";
}

function nameForCell(i) {
  const namesOuter = [
    "Caelis Gate","Granite Bastion","Goldvoice Chapel","Knight’s Keep","Oathsworn Watch","Sanctum of Steel",
    "Whispering Thicket","Moonpetal Glade","Elderwood Path","Thornwisp Vale","Wildmother’s Grove","Heartroot Circle",
    "Ironstep Gate","Sparkfist Forge","Cogspire Yard","Data Mines","Scrapline Outpost","Codeflare Nexus",
    "Butcher’s Moor","Rustheart Chains","Bonebrand Spire","Whisperveil Marsh","Grave Mother’s Den","Oblivion Crypt"
  ];
  const namesInner = [
    "Inner Keep","Reliquary of Valor","Hall of Oaths",
    "Spirit Hollow","Ancient Grove","Seer’s Arbor",
    "Core Reactor","Mech-Forge","Circuit Sanctum",
    "Dark Reliquary","Plague Chapel","Warped Sepulcher"
  ];
  if (i < 24) return namesOuter[i];
  if (i < 36) return namesInner[i - 24];
  return "The Last Flame";
}

// --- Board létrehozása ---
function initBoard() {
  const cells = [];
  for (let i = 0; i < 24; i++) {
    cells.push({ id: i, ring: "OUTER", name: nameForCell(i), faction: factionForIndex(i) });
  }
  for (let i = 24; i < 36; i++) {
    cells.push({ id: i, ring: "INNER", name: nameForCell(i), faction: factionForIndex(i) });
  }
  cells.push({ id: 36, ring: "CENTER", name: nameForCell(36), faction: "NEUTRAL" });
  return cells;
}

// --- Speciális mezők kiosztása ---
function assignSpecialAreas(board) {
  const shuffled = [...specialFactions].sort(() => Math.random() - 0.5);
  specialTargetNames.forEach((targetName, idx) => {
    const cell = board.find(c => c.name === targetName);
    if (cell) {
      cell.faction = shuffled[idx];
      cell.specialType = shuffled[idx]; // ha máshol kell jelölés
    }
  });
}

// --- Szomszédok ---
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

// --- Távolságra lévő mezők ---
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

module.exports = {
  initBoard,
  assignSpecialAreas,
  neighbors,
  adjacencyAtDistance,
  cellById
};

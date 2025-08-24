// board.js
const { factions } = require("./factions");
const specialFactions = ["Graveyard", "Temple", "Village", "Tavern"];
const gatewaysOuter = [0, 6, 12, 18];
const gatewaysInner = [24, 27, 30, 33];

const specialTargetNames = [
  "Caelis Gate",
"Butcher’s Moor",
"Ironstep Gate",
"Whispering Thicket"
];

// --- English lore descriptions ---
const descOuter = [
  "Ancient gate leading into the realm of knights.",
"Unyielding stone bastion guarding the border.",
"Chapel where golden‑tongued priests preach.",
"Stronghold of the kingdom’s finest knights.",
"Tower of oathbound sentinels.",
"Sanctum forged of steel and faith.",
"Grove where trees whisper forgotten secrets.",
"Glade bathed in silver moonlight.",
"Path winding through elderwood shadows.",
"Vale crowned with thorn and mist.",
"Sacred grove of the Wildmother.",
"Circle surrounding the ancient Heartroot.",
"Iron‑shod gate to the lands of machines.",
"Forge alive with sparks and fury.",
"Courtyard of towering clockworks.",
"Depths where data and ore entwine.",
"Forward post along the rust‑scarred line.",
"Nexus crackling with codefire.",
"Blood‑soaked moor of grim renown.",
"Chains heavy with rust and sorrow.",
"Spire crowned with the mark of bone.",
"Marsh veiled in whispering fog.",
"Den of the Grave Mother.",
"Crypt where even oblivion stirs."
];

const descInner = [
  "Heart of the inner keep.",
"Vault preserving relics of valor.",
"Hall where sacred oaths are sworn.",
"Hollow where spirits gather in silence.",
"Ancient grove untouched by time.",
"Arbor blessed by gifted seers.",
"Reactor pulsing in the machine’s core.",
"Forge deep in dwarven halls.",
"Sanctum of intricate circuits.",
"Reliquary steeped in dark power.",
"Chapel tainted by plague.",
"Sepulcher warped by foul magic."
];

const centerDesc = "The final flame, consuming or renewing all that touches it.";

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
    cells.push({
      id: i,
      ring: "OUTER",
      name: nameForCell(i),
               faction: factionForIndex(i),
               desc: descOuter[i]
    });
  }
  for (let i = 24; i < 36; i++) {
    cells.push({
      id: i,
      ring: "INNER",
      name: nameForCell(i),
               faction: factionForIndex(i),
               desc: descInner[i - 24]
    });
  }
  cells.push({
    id: 36,
    ring: "CENTER",
    name: nameForCell(36),
             faction: "NEUTRAL",
             desc: centerDesc
  });
  return cells;
}

// --- Speciális mezők kiosztása ---
function assignSpecialAreas(board) {
  const shuffled = [...specialFactions].sort(() => Math.random() - 0.5);
  specialTargetNames.forEach((targetName, idx) => {
    const cell = board.find(c => c.name === targetName);
    if (cell) {
      cell.faction = shuffled[idx];
      cell.specialType = shuffled[idx];
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

function teleportPlayerIfOnSpecial(board, player) {
  const currentCell = cellById(board, player.position);
  if (!currentCell) return;

  // Külső -> belső
  if (specialTargetNames.includes(currentCell.name)) {
    const gi = gatewaysOuter.indexOf(currentCell.id);
    if (gi >= 0) {
      player.position = gatewaysInner[gi];
    }
    return;
  }

  // Belső -> külső
  const giInner = gatewaysInner.indexOf(currentCell.id);
  if (giInner >= 0) {
    player.position = gatewaysOuter[giInner];
  }
}


module.exports = {
  initBoard,
  assignSpecialAreas,
  neighbors,
  adjacencyAtDistance,
  cellById,
  specialTargetNames,
  gatewaysOuter,
  gatewaysInner,
  teleportPlayerIfOnSpecial // <- tényleg legyen itt
};

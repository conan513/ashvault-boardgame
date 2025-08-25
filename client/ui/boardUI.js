let BOARD_CACHE = null;
let HIGHLIGHTS = [];



// --- Globális frakció ikon mapping ---
// Hexák / mezők ikonjai (SVG-ben a cellákhoz)
const factionIcons = {
  "Order of Knights": "./icons/ok.png",
  "The Hollow Grove": "./icons/hg.png",
  "Cyber Dwarves": "./icons/cd.png",
  "Graveborn": "./icons/gb.png",
  "NEUTRAL": "./icons/ne.png",
  "Graveyard": "./icons/gy.png",
  "Temple": "./icons/tp.png",
  "Village": "./icons/vl.png",
  "Tavern": "./icons/tv.png",
  "Ashen Circle": "./icons/ac.png"
};

// Játékos bábuk ikonjai (tooltipnél vagy tokeneknél)
const pawnIcons = {
  "Order of Knights": "./images/characters/ok.png",
  "The Hollow Grove": "./images/characters/hg.png",
  "Cyber Dwarves": "./images/characters/cd.png",
  "Graveborn": "./images/characters/gh.png",
  "NEUTRAL": "./images/characters/ne.png"
};


// --- Csak speciális INNER ↔ OUTER ---

const specialPairs = [
  ["Butcher’s Moor", "Dark Reliquary"],
["Caelis Gate", "Inner Keep"],
["Ironstep Gate", "Core Reactor"],
["Whispering Thicket", "Spirit Hollow"]
];

function renderBoard(state) {
  BOARD_CACHE = state.board;
  const svg = document.getElementById("boardSVG");
  svg.innerHTML = "";

  const cx = 450, cy = 450;
  const rOuter = 360;
  const rInner = 240;

  svg.insertAdjacentHTML("beforeend", `
  <defs>
  <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
  <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="black"/>
  </filter>
  </defs>
  `);

  function posFor(cell) {
    if (cell.ring === "CENTER") return { x: cx, y: cy };
    if (cell.ring === "OUTER") {
      const ringIdx = cell.id;
      const angle = (ringIdx / 24) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * rOuter, y: cy + Math.sin(angle) * rOuter };
    } else if (cell.ring === "INNER") {
      const ringIdx = cell.id - 24;
      const angle = (ringIdx / 12) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(angle) * rInner, y: cy + Math.sin(angle) * rInner };
    }
  }



  // --- INNER ↔ INNER ---
  const innerCells = state.board.filter(c => c.ring === "INNER");
  innerCells.forEach((cell, idx) => {
    const next = innerCells[(idx + 1) % innerCells.length];
    const p1 = posFor(cell);
    const p2 = posFor(next);
    svg.insertAdjacentHTML("beforeend",
                           `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#1a2535" stroke-width="2"/>`
    );
  });

  // --- OUTER ↔ OUTER ---
  const outerCells = state.board.filter(c => c.ring === "OUTER");
  outerCells.forEach((cell, idx) => {
    const next = outerCells[(idx + 1) % outerCells.length];
    const p1 = posFor(cell);
    const p2 = posFor(next);
    svg.insertAdjacentHTML("beforeend",
                           `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#1a2535" stroke-width="2"/>`
    );
  });


  function centerOfCellByName(name) {
    const cell = state.board.find(c => c.name === name);
    return cell ? posFor(cell) : null;
  }

  specialPairs.forEach(([fromName, toName]) => {
    const from = centerOfCellByName(fromName);
    const to = centerOfCellByName(toName);
    if (from && to) {
      svg.insertAdjacentHTML("beforeend",
                             `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"
                             stroke="#d9534f" stroke-width="2"/>`
      );
    }
  });

  const ringStyle = "stroke:#2a3d5b; stroke-width:3; fill:none";
  svg.insertAdjacentHTML("beforeend",
                         `<circle cx="${cx}" cy="${cy}" r="${rInner}" style="${ringStyle}" />` +
                         `<circle cx="${cx}" cy="${cy}" r="${rOuter}" style="${ringStyle}" />`
  );

  function hexPath(x, y, r) {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      return [x + Math.cos(angle) * r, y + Math.sin(angle) * r].join(",");
    }).join(" ");
  }

  const SCALE = 1.5;

  for (const cell of state.board) {
    const { x, y } = posFor(cell);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("cell");

    const fcls = ({
      "Order of Knights": "ok",
      "The Hollow Grove": "hg",
      "Cyber Dwarves": "cd",
      "Graveborn": "gb",
      "NEUTRAL": "ne",
      "Graveyard": "gy",
      "Temple": "tp",
      "Village": "vl",
      "Tavern": "tv",
      "Ashen Circle": "ac"
    })[cell.faction] || "ne";
    g.classList.add(fcls);
    g.dataset.id = cell.id;

    // hexagon háttér
    const hexRadius = 22 * SCALE;
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", hexPath(x, y, hexRadius));
    poly.setAttribute("stroke", "#555");

    let fillColor = "rgba(30,30,40,0.8)";
    if (["Graveyard","Temple","Village","Tavern"].includes(cell.faction)) {
      fillColor = "rgba(255,255,255,0.85)";
    }
    poly.setAttribute("fill", fillColor);
    g.appendChild(poly);

    // frakció ikon
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "image");
    icon.setAttribute("href", `/icons/${fcls}.png`);
    const iconSize = 44 * SCALE;
    icon.setAttribute("x", x - iconSize / 2);
    icon.setAttribute("y", y - iconSize / 2);
    icon.setAttribute("width", iconSize);
    icon.setAttribute("height", iconSize);
    g.appendChild(icon);

    // név
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y - (28 * SCALE));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", 12 * SCALE);
    label.textContent = cell.name;
    g.appendChild(label);

    svg.appendChild(g);
  }

  // ---- player tokenek ----
  const playersByCell = {};
  for (const p of Object.values(state.players)) {
    if (!p.alive) continue;
    playersByCell[p.position] = playersByCell[p.position] || [];
    playersByCell[p.position].push(p);
  }

  for (const [cellId, players] of Object.entries(playersByCell)) {
    const cell = state.board.find(c => c.id == cellId);
    if (!cell) continue;
    const { x, y } = posFor(cell);

    const count = players.length;
    const radius = count > 1 ? 16 : 0;

    players.forEach((p, idx) => {
      const angle = (idx / count) * 2 * Math.PI;
      const offsetX = radius * Math.cos(angle);
      const offsetY = radius * Math.sin(angle);

      const token = document.createElementNS("http://www.w3.org/2000/svg", "g");
      token.classList.add("playerToken");
      token.setAttribute("data-player", p.name);
      token.setAttribute("data-player-id", p.id);
      token.setAttribute("transform", `translate(${x + offsetX}, ${y + offsetY})`);

      const pawnIcons = {
        "Order of Knights": "./images/characters/ok.png",
        "The Hollow Grove": "./images/characters/hg.png",
        "Cyber Dwarves": "./images/characters/cd.png",
        "Graveborn": "./images/characters/gh.png",
        "NEUTRAL": "./images/characters/ne.png"
      };

      const pawnImg = document.createElementNS("http://www.w3.org/2000/svg", "image");
      pawnImg.setAttribute("href", p.pawn || pawnIcons[p.faction]);
      pawnImg.setAttribute("x", -48);
      pawnImg.setAttribute("y", -80);
      pawnImg.setAttribute("width", 96);
      pawnImg.setAttribute("height", 96);
      token.appendChild(pawnImg);

      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", 0);
      txt.setAttribute("y", 6);
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("font-size", "8px");
      txt.textContent = p.name.slice(0, 2).toUpperCase();
      txt.setAttribute("pointer-events", "none");
      token.appendChild(txt);

      token.addEventListener("click", function(e) {
        const prev = token.style.pointerEvents;
        token.style.pointerEvents = "none";
        const under = document.elementFromPoint(e.clientX, e.clientY);
        token.style.pointerEvents = prev || "all";
        if (under) {
          under.dispatchEvent(new MouseEvent("click", {
            clientX: e.clientX,
            bubbles: true,
            cancelable: true,
            view: window
          }));
        }
      });

      svg.appendChild(token);
    });
  }

  // Aktuális játékos kiemelése
  const current = state.currentPlayer;
  if (current && state.players[current]) {
    const cid = state.players[current].position;
    const sel = svg.querySelector(`.cell[data-id="${cid}"]`);
    if (sel) sel.classList.add("current");
  }

  // Tooltip rendszer újrainicializálása
  initTileAndPlayerTooltips();

  socket.on("dayNightChanged", (cycle) => {
    console.log("Érkezett cycle:", JSON.stringify(cycle));

    const iconPathBase = cycle === "day"
    ? "/icons/sun.png"
    : "/icons/moon.png";
    const iconPath = `${iconPathBase}?v=${Date.now()}`;

    const svg = document.getElementById("boardSVG");
    const svgRect = svg.getBoundingClientRect();

    // Dobókocka ikon HTML eleme
    const diceIcon = document.getElementById("diceIcon");
    const rect = diceIcon.getBoundingClientRect();

    // HTML pozícióból SVG koordináta
    const x = rect.left - svgRect.left;
    const y = rect.top - svgRect.top;

    let icon = document.getElementById("dayNightIcon");
    if (icon) {
      icon.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", iconPath);
      icon.setAttribute("x", x);
      icon.setAttribute("y", y);
    } else {
      icon = document.createElementNS("http://www.w3.org/2000/svg", "image");
      icon.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", iconPath);
      icon.setAttribute("width", 50);
      icon.setAttribute("height", 50);
      icon.setAttribute("x", x);
      icon.setAttribute("y", y);
      icon.id = "dayNightIcon";
      svg.appendChild(icon);
    }
  });
}

function animateMove(player, path, callback) {
  const svg = document.getElementById("boardSVG");
  const token = svg.querySelector(`.playerToken[data-player-id="${player.id}"]`);
  if (!token) {
    if (callback) callback();
    return;
  }

  let step = 0;
  function moveNext() {
    if (step >= path.length) {
      if (callback) callback();
      return;
    }

    const cell = BOARD_CACHE.find(c => c.id === path[step]);
    const { x, y } = (function posFor(cell) {
      const cx = 450, cy = 450;
      const rOuter = 360, rInner = 240;
      if (cell.ring === "CENTER") return { x: cx, y: cy };
      if (cell.ring === "OUTER") {
        const angle = (cell.id / 24) * Math.PI * 2 - Math.PI / 2;
        return { x: cx + Math.cos(angle) * rOuter, y: cy + Math.sin(angle) * rOuter };
      } else if (cell.ring === "INNER") {
        const angle = ((cell.id - 24) / 12) * Math.PI * 2 - Math.PI / 2;
        return { x: cx + Math.cos(angle) * rInner, y: cy + Math.sin(angle) * rInner };
      }
    })(cell);

    const oldTransform = token.getAttribute("transform") || "translate(0,0)";
    const match = oldTransform.match(/translate\(([^,]+),([^)]+)\)/);
    let oldX = 0, oldY = 0;
    if (match) {
      oldX = parseFloat(match[1]);
      oldY = parseFloat(match[2]);
    }

    token.animate([
      { transform: `translate(${oldX}px, ${oldY}px)` },
                  { transform: `translate(${x}px, ${y}px)` }
    ], { duration: 400, fill: "forwards" });

    token.setAttribute("transform", `translate(${x}, ${y})`);

    step++;
    setTimeout(moveNext, 400);
  }

  moveNext();
}

function highlightTargets(targetIds, onPick) {
  clearHighlights();
  const svg = document.getElementById("boardSVG");
  for (const id of targetIds) {
    const g = svg.querySelector(`.cell[data-id="${id}"]`);
    if (!g) continue;
    g.classList.add("highlight");
    const handler = () => {
      const me = GAME.players[MY_ID];
      const myCell = GAME.board.find(c => c.id === me.position);
      const ringCells = GAME.board.filter(c => c.ring === myCell.ring).sort((a, b) => a.id - b.id);
      const myIdx = ringCells.findIndex(c => c.id === myCell.id);
      const targetIdx = ringCells.findIndex(c => c.id === id);
      const N = ringCells.length;

      let pathRight = [];
      for (let step = 1; step <= LAST_DICE; step++) {
        pathRight.push(ringCells[(myIdx + step) % N].id);
      }

      let pathLeft = [];
      for (let step = 1; step <= LAST_DICE; step++) {
        pathLeft.push(ringCells[(myIdx - step + N) % N].id);
      }

      let chosenPath = pathRight;
      if (pathLeft[pathLeft.length - 1] === id) {
        chosenPath = pathLeft;
      }

      animateMove(me, chosenPath, () => {
        socket.emit("confirmMove", { dice: LAST_DICE, targetCellId: id, path: chosenPath });
        clearHighlights();
      });
    };
    g.addEventListener("click", handler, { once: true });
    HIGHLIGHTS.push({ g, handler });
  }
}

function clearHighlights() {
  for (const h of HIGHLIGHTS) {
    h.g.classList.remove("highlight");
    h.g.removeEventListener("click", h.handler);
  }
  HIGHLIGHTS = [];
}

function showToast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.position = "fixed";
  el.style.bottom = "16px";
  el.style.right = "16px";
  el.style.padding = "8px 10px";
  el.style.background = "#132338";
  el.style.border = "1px solid #24324a";
  el.style.borderRadius = "6px";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function initTileAndPlayerTooltips() {
  const svg = document.getElementById("boardSVG");

  function positionTooltip(tooltip, mouseX, mouseY, offsetX = 15, offsetY = 15) {
    const padding = 10;
    const rect = tooltip.getBoundingClientRect();
    let left = mouseX + offsetX;
    let top = mouseY + offsetY;

    if (left + rect.width > window.innerWidth - padding) {
      left = window.innerWidth - rect.width - padding;
    }
    if (left < padding) left = padding;
    if (top + rect.height > window.innerHeight - padding) {
      top = window.innerHeight - rect.height - padding;
    }
    if (top < padding) top = padding;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  // --- CELL TOOLTIP ---
  const tileTooltip = document.getElementById("tileTooltip");
  const tileTooltipImg = tileTooltip.querySelector("img");
  const tileTooltipLabel = document.getElementById("tileTooltipLabel");

  svg.querySelectorAll(".cell").forEach(cell => {
    cell.addEventListener("mouseenter", () => {
      const pt = document.getElementById("tooltip");
      if (pt) pt.style.display = "none";

      const icon = cell.querySelector("image");
      const label = cell.querySelector("text");

      const cellId = parseInt(cell.dataset.id, 10);
      const cellData = GAME.board.find(c => c.id === cellId);

      tileTooltipImg.src = icon ? icon.getAttribute("href") : "";
      tileTooltipImg.style.width = "100px";
      tileTooltipImg.style.height = "100px";
      tileTooltipImg.style.borderRadius = "10px";

      let html = "";
      if (label) {
        html += `<strong>${label.textContent}</strong>`;
      }
      if (cellData?.desc) {
        html += `<br><span style="font-size:0.9em; color:#ccc;">${cellData.desc}</span>`;
      }
      tileTooltipLabel.innerHTML = html;

      tileTooltip.style.display = "block";
    });

    cell.addEventListener("mousemove", e => {
      positionTooltip(tileTooltip, e.clientX, e.clientY, 15, 15);
    });

    cell.addEventListener("mouseleave", () => {
      tileTooltip.style.display = "none";
    });
  });

  // --- PLAYER TOOLTIP ---
  const playerTooltip = document.getElementById("tooltip");
  const tooltipImg = document.getElementById("tooltipImg");
  const tooltipLabel = document.getElementById("tooltipLabel");

  svg.querySelectorAll(".playerToken").forEach(token => {
    token.addEventListener("mouseenter", () => {
      if (tileTooltip) tileTooltip.style.display = "none";

      const playerId = token.getAttribute("data-player-id");
      const player = GAME.players?.[playerId];
      if (!player) return;

      const factionIcon = factionIcons[player.faction] || "";

      const portraitSrc =
      player.pawn ||
      player.portrait ||
      pawnIcons[player.faction] ||
      "/defaultPlayer.png";

  tooltipImg.src = portraitSrc;
  tooltipImg.style.width = "180px";
  tooltipImg.style.height = "180px";
  tooltipImg.style.borderRadius = "12px";

  const get = (...candidates) => {
    for (const c of candidates) {
      const val = c();
      if (val !== undefined && val !== null) return val;
    }
    return "?";
  };

  const hp  = get(() => player.hp,  () => player.stats?.hp,  () => player.health);
  const atk = get(() => player.atk, () => player.stats?.atk, () => player.attack);
  const def = get(() => player.def, () => player.stats?.def, () => player.defense);
  const psy = get(() => player.psy, () => player.stats?.psy, () => player.psychic);
  const res = get(() => player.res, () => player.stats?.res, () => player.resistance, () => player.resources);

  tooltipLabel.innerHTML = `
  <div style="text-align:center; padding:8px; min-width:240px;">
  <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:6px;">
  <img src="${factionIcon}" alt="${player.faction}" style="width:32px; height:32px;"/>
  <h3 style="margin:0; font-size:1.3em;">${player.name}</h3>
  </div>
  <div style="margin-top:10px; font-size:1em; line-height:1.4;">
  <div>❤️ HP: <strong>${hp}</strong></div>
  <div>⚔️ ATK: <strong>${atk}</strong></div>
  <div>🛡️ DEF: <strong>${def}</strong></div>
  <div>🔮 PSY: <strong>${psy}</strong></div>
  <div>💎 RES: <strong>${res}</strong></div>
  </div>
  </div>
  `;

  playerTooltip.style.display = "block";
    });

    token.addEventListener("mousemove", e => {
      positionTooltip(playerTooltip, e.clientX, e.clientY, 20, 20);
    });

    token.addEventListener("mouseleave", () => {
      playerTooltip.style.display = "none";
      tooltipImg.style.width = "100px";
      tooltipImg.style.height = "100px";
      tooltipImg.style.borderRadius = "8px";
    });
  });
}


socket.on("playerMoved", ({ playerId, path }) => {
  const player = GAME.players[playerId];
  if (!player) return;

  const fromCellId = player.position;
  const toCellId = path[path.length - 1];

  player.position = toCellId;

  // Ellenőrzés: kapu teleport történt-e
  const fromCell = BOARD_CACHE.find(c => c.id === fromCellId);
  const toCell = BOARD_CACHE.find(c => c.id === toCellId);

  const isTeleport = specialPairs.some(([outerName, innerName]) =>
  (fromCell?.name === outerName && toCell?.name === innerName) ||
  (fromCell?.name === innerName && toCell?.name === outerName)
  );

  if (isTeleport) {
    showToast(`${fromCell.name} ➡ ${toCell.name} (Teleport!)`);

    // Ide opcionálisan berajzolhatunk egy animált vonalat
    // vagy kiemelhetjük röviden a két cellát
    highlightTeleportCells(fromCell.id, toCell.id);
  }

  animateMove(player, path);
});

function highlightTeleportCells(fromId, toId) {
  const svg = document.getElementById("boardSVG");
  [fromId, toId].forEach(id => {
    const g = svg.querySelector(`.cell[data-id="${id}"]`);
    if (g) {
      g.classList.add("teleportHighlight");
      setTimeout(() => g.classList.remove("teleportHighlight"), 1000);
    }
  });
}


window.renderBoard = renderBoard;
window.highlightTargets = highlightTargets;
window.clearHighlights = clearHighlights;
window.showToast = showToast;
window.animateMove = animateMove;

let BOARD_CACHE = null;
let HIGHLIGHTS = [];

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

  // sugaras háttér
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const x2 = cx + Math.cos(angle) * rOuter;
    const y2 = cy + Math.sin(angle) * rOuter;
    svg.insertAdjacentHTML("beforeend",
                           `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#1a2535" stroke-width="2"/>`
    );
  }

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

  for (const cell of state.board) {
    const { x, y } = posFor(cell);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("cell");
    const fcls = ({ "Order of Knights": "ok", "The Hollow Grove": "hg", "Cyber Dwarves": "cd", "Graveborn": "gb", "NEUTRAL": "ne" })[cell.faction] || "ne";
    g.classList.add(fcls);
    g.dataset.id = cell.id;

    // hexagon háttér
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", hexPath(x, y, 22));
    poly.setAttribute("fill", "rgba(30,30,40,0.8)");
    poly.setAttribute("stroke", "#555");
    g.appendChild(poly);

    // frakció ikon
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "image");
    icon.setAttribute("href", `/icons/${fcls}.png`);
    icon.setAttribute("x", x - 15);
    icon.setAttribute("y", y - 15);
    icon.setAttribute("width", 30);
    icon.setAttribute("height", 30);
    g.appendChild(icon);

    // név
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y - 28);
    label.setAttribute("text-anchor", "middle");
    label.textContent = cell.name;
    g.appendChild(label);

    svg.appendChild(g);
  }

  // ---- player tokenek rajzolása (csoportosan, körívben elosztva) ----
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
      token.setAttribute("data-player-id", p.id);   // 🔹 új sor
      token.setAttribute("transform", `translate(${x + offsetX}, ${y + offsetY})`);

      // --- bábu ikon a frakció szerint ---
      const pawnIcons = {
        "Order of Knights": "./images/characters/ok.png",
        "The Hollow Grove": "./images/characters/hg.png",
        "Cyber Dwarves": "./images/characters/cd.png",
        "Graveborn": "./images/characters/gh.png",
        "NEUTRAL": "./images/characters/ne.png"
      };

      const pawnImg = document.createElementNS("http://www.w3.org/2000/svg", "image");

      if (p.pawn) {
        pawnImg.setAttribute("href", p.pawn); // egyedi bábu
      } else {
        pawnImg.setAttribute("href", pawnIcons[p.faction]); // ha nincs egyedi, frakció ikon
      }

      pawnImg.setAttribute("x", -48);
      pawnImg.setAttribute("y", -80);
      pawnImg.setAttribute("width", 96);
      pawnImg.setAttribute("height", 96);
      token.appendChild(pawnImg);

      // --- név rövidítés a token alá ---
      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", 0);
      txt.setAttribute("y", 6); // alá tolva
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("font-size", "8px");
      txt.textContent = p.name.slice(0, 2).toUpperCase();
      txt.setAttribute("pointer-events", "none");
      token.appendChild(txt);

      // KATTINTÁS ÁTENGEDÉSE
      token.addEventListener("click", function(e) {
        const prev = token.style.pointerEvents;
        token.style.pointerEvents = "none";
        const under = document.elementFromPoint(e.clientX, e.clientY);
        token.style.pointerEvents = prev || "all";
        if (under) {
          under.dispatchEvent(new MouseEvent("click", {
            clientX: e.clientX,
            clientY: e.clientY,
            bubbles: true,
            cancelable: true,
            view: window
          }));
        }
      });

      svg.appendChild(token);
    });
  }

  const current = state.currentPlayer;
  if (current && state.players[current]) {
    const cid = state.players[current].position;
    const sel = svg.querySelector(`.cell[data-id="${cid}"]`);
    if (sel) sel.classList.add("current");
  }

  // --- cursor melletti tooltip bekapcsolása ---
  enableTileHoverPopup();
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

// --- tooltip logó + név az egér mellett ---
function enableTileHoverPopup() {
  const svg = document.getElementById("boardSVG");
  const tooltip = document.getElementById("tileTooltip");
  const tooltipImg = tooltip.querySelector("img");
  const tooltipLabel = document.getElementById("tileTooltipLabel");

  svg.querySelectorAll(".cell").forEach(cell => {
    cell.addEventListener("mouseenter", () => {
      // Ha a cellákhoz tartozó tooltip jelenik meg, elrejtjük a playerTooltip-ot
      document.getElementById("playerTooltip").style.display = "none";

      const icon = cell.querySelector("image");
      const label = cell.querySelector("text");

      if (icon) {
        tooltipImg.setAttribute("src", icon.getAttribute("href"));
      } else {
        tooltipImg.setAttribute("src", "");
      }

      tooltipImg.style.width = "70px";
      tooltipImg.style.height = "70px";
      tooltipImg.style.borderRadius = "8px";

      tooltipLabel.innerHTML = label ? `<strong>${label.textContent}</strong>` : "";
      tooltip.style.display = "block";
    });

    cell.addEventListener("mousemove", e => {
      tooltip.style.left = e.clientX + 15 + "px";
      tooltip.style.top = e.clientY + 15 + "px";
    });

    cell.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  });
}

  // ---- PLAYER TOKEN TOOLTIP ----
  // ---- PLAYER TOKEN TOOLTIP ----
  const svg = document.getElementById("boardSVG"); // Győződj meg róla, hogy az svg változó helyesen van inicializálva


  svg.querySelectorAll(".playerToken").forEach(token => {
    token.addEventListener("mouseenter", () => {
      // Ha egy másik tooltip jelen van, elrejtjük azt
      const tileTooltip = document.getElementById("tileTooltip");
      if (tileTooltip) tileTooltip.style.display = "none"; // Elrejtjük a cellákhoz tartozó tooltipet

      const playerName = token.getAttribute("data-player");
      const player = Object.values(GAME.players).find(p => p.name === playerName);
      if (!player) return;

      const factionIcon = factionIcons[player.faction] || "";

      // Tooltip frissítése
      const tooltipImg = document.getElementById("tooltipImg");
      const tooltipLabel = document.getElementById("tooltipLabel");

      tooltipImg.setAttribute("src", player.portrait || "/defaultPlayer.png");
      tooltipImg.style.width = "120px";
      tooltipImg.style.height = "120px";
      tooltipImg.style.borderRadius = "12px";

      tooltipLabel.innerHTML = `
      <div style="text-align:center; padding:8px; min-width:200px;">
      <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:6px;">
      <img src="${factionIcon}" alt="${player.faction}" style="width:32px; height:32px;"/>
      <h3 style="margin:0; font-size:1.2em;">${player.name}</h3>
      </div>

      <div style="margin-top:10px; font-size:0.95em; line-height:1.4;">
      <div>❤️ HP: <strong>${player.hp}</strong></div>
      <div>⚔️ ATK: <strong>${player.atk}</strong></div>
      <div>🛡️ DEF: <strong>${player.def}</strong></div>
      <div>🔮 PSY: <strong>${player.psy}</strong></div>
      <div>💎 RES: <strong>${player.res}</strong></div>
      </div>
      </div>
      `;

      // Tooltip megjelenítése
      const tooltip = document.getElementById("tooltip");
      tooltip.style.display = "block";
    });

    token.addEventListener("mousemove", e => {
      const tooltip = document.getElementById("tooltip");
      tooltip.style.left = e.clientX + 20 + "px";
      tooltip.style.top = e.clientY + 20 + "px";
    });

    token.addEventListener("mouseleave", () => {
      const tooltip = document.getElementById("tooltip");
      tooltip.style.display = "none";
      const tooltipImg = document.getElementById("tooltipImg");
      tooltipImg.style.width = "70px";
      tooltipImg.style.height = "70px";
      tooltipImg.style.borderRadius = "8px";
    });
  });

socket.on("playerMoved", ({ playerId, path }) => {
  const player = GAME.players[playerId];
  if (!player) return;
  player.position = path[path.length-1]; // állapot frissítése
  animateMove(player, path);             // animáció lefuttatása
});


window.renderBoard = renderBoard;
window.highlightTargets = highlightTargets;
window.clearHighlights = clearHighlights;
window.showToast = showToast;
window.animateMove = animateMove;

// client/ui/boardUI.js
let BOARD_CACHE = null;
let HIGHLIGHTS = [];

function renderBoard(state) {
  BOARD_CACHE = state.board;
  const svg = document.getElementById("boardSVG");
  svg.innerHTML = "";

  const cx = 450, cy = 450;
  const rOuter = 360;
  const rInner = 240;

  function posFor(cell) {
    if (cell.ring === "CENTER") return { x: cx, y: cy };
    const isOuter = cell.ring === "OUTER";
    const ringIdx = isOuter ? cell.id : (cell.id - 20);
    const angle = (ringIdx / 20) * Math.PI * 2 - Math.PI / 2;
    const r = isOuter ? rOuter : rInner;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  const ringStyle = "stroke:#2a3d5b; stroke-width:3; fill:none";
  svg.insertAdjacentHTML("beforeend",
    `<circle cx="${cx}" cy="${cy}" r="${rInner}" style="${ringStyle}" />` +
    `<circle cx="${cx}" cy="${cy}" r="${rOuter}" style="${ringStyle}" />`
  );

  for (const cell of state.board) {
    const { x, y } = posFor(cell);
    const g = document.createElementNS("http://www.w3.org/2000/svg","g");
    g.classList.add("cell");
    const fcls = ({"Space Marines":"sm","Eldar":"el","Orks":"ok","Chaos":"ch","NEUTRAL":"ne"})[cell.faction] || "ne";
    g.classList.add(fcls);
    g.dataset.id = cell.id;

    const circ = document.createElementNS("http://www.w3.org/2000/svg","circle");
    circ.setAttribute("cx", x); circ.setAttribute("cy", y); circ.setAttribute("r", 20);

    const label = document.createElementNS("http://www.w3.org/2000/svg","text");
    label.setAttribute("x", x); label.setAttribute("y", y - 28);
    label.textContent = cell.name;

    g.appendChild(circ); g.appendChild(label);
    svg.appendChild(g);
  }

  for (const p of Object.values(state.players)) {
    if (!p.alive) continue;
    const cell = state.board.find(c => c.id === p.position);
    if (!cell) continue;
    const { x, y } = posFor(cell);
    const token = document.createElementNS("http://www.w3.org/2000/svg","g");
    token.classList.add("playerToken");
    const color = ({"Space Marines":"#2a7fff","Eldar":"#32d1a0","Orks":"#70d13e","Chaos":"#c04ff0"})[p.faction] || "#fff";
    const disk = document.createElementNS("http://www.w3.org/2000/svg","circle");
    disk.setAttribute("cx", x); disk.setAttribute("cy", y);
    disk.setAttribute("r", 12); disk.setAttribute("fill", color);
    const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
    txt.setAttribute("x", x); txt.setAttribute("y", y + 4);
    txt.setAttribute("text-anchor", "middle");
    txt.textContent = p.name.slice(0,2).toUpperCase();

    token.appendChild(disk); token.appendChild(txt);
    svg.appendChild(token);
  }

  const current = state.currentPlayer;
  if (current && state.players[current]) {
    const cid = state.players[current].position;
    const sel = svg.querySelector(`.cell[data-id="${cid}"]`);
    if (sel) sel.classList.add("current");
  }
}

function highlightTargets(targetIds, onPick) {
  clearHighlights();
  const svg = document.getElementById("boardSVG");
  for (const id of targetIds) {
    const g = svg.querySelector(`.cell[data-id="${id}"]`);
    if (!g) continue;
    g.classList.add("highlight");
    const handler = () => onPick(id);
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

window.renderBoard = renderBoard;
window.highlightTargets = highlightTargets;
window.clearHighlights = clearHighlights;
window.showToast = showToast;

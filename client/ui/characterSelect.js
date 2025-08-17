// client/ui/characterSelect.js
let ALL_CHARS = [];

function renderCharacterSelect(characters) {
  ALL_CHARS = characters;
  const wrap = document.getElementById("charSelect");
  wrap.innerHTML = "";
  const byFaction = {};
  for (const c of characters) (byFaction[c.faction] ||= []).push(c);

  for (const [faction, list] of Object.entries(byFaction)) {
    const box = document.createElement("div");
    box.className = "panel";
    box.innerHTML = `<h3>${faction}</h3>`;
    for (const c of list) {
      const id = `pick_${c.id}`;
      const row = document.createElement("label");
      row.style.display = "block";
      row.style.margin = "6px 0";
      row.innerHTML = `
        <input type="radio" name="charPick" id="${id}" value="${c.id}" />
        <b>${c.name}</b> — HP:${c.HP} ATK:${c.ATK} DEF:${c.DEF} PSY:${c.PSY} RES:${c.RES}
        <small> (Spawn: ${c.spawn})</small>
      `;
      box.appendChild(row);
    }
    wrap.appendChild(box);
  }
}

function renderPlayers(state) {
  const list = document.getElementById("playersList");
  list.innerHTML = "";
  const pickedIds = new Set(Object.values(state.players).map(p => p.characterId));
  for (const input of document.querySelectorAll("input[name='charPick']")) {
    input.disabled = pickedIds.has(input.value);
  }
  for (const p of Object.values(state.players)) {
    const li = document.createElement("li");
    li.className = "playerRow";
    const factionClass = p.faction === "Space Marines" ? "faction-sm"
                       : p.faction === "Eldar" ? "faction-el"
                       : p.faction === "Orks" ? "faction-ok"
                       : "faction-ch";
    const alive = p.alive ? "" : `<span class="dead">[ELHUNYT]</span>`;
    li.innerHTML = `
      <div>
        <div><b class="${factionClass}">${p.name}</b> — <i>${p.characterName}</i> ${alive}</div>
        <div class="stats">HP:${p.stats.HP} ATK:${p.stats.ATK} DEF:${p.stats.DEF} PSY:${p.stats.PSY} RES:${p.stats.RES}</div>
        <div class="stats">Tárgyak: ${p.inventory.map(i=>i.name).join(", ") || "-"}</div>
      </div>
      <div>${state.currentPlayer === p.id ? '<span class="badge turn">Kör</span>': ''}</div>
    `;
    list.appendChild(li);
  }
}

window.renderCharacterSelect = renderCharacterSelect;
window.renderPlayers = renderPlayers;

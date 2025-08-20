// client/ui/characterSelect.js
let ALL_CHARS = [];

function renderCharacterSelect(characters) {
  ALL_CHARS = characters;
  const wrap = document.getElementById("charSelect");
  wrap.innerHTML = "";

  const factions = {
    "Space Marines": [],
    "Eldar": [],
    "Orks": [],
    "Chaos": []
  };

  // Szétosztás
  for (const c of characters) {
    factions[c.faction].push(c);
  }

  // Konténerek létrehozása
  for (const [faction, chars] of Object.entries(factions)) {
    const col = document.createElement("div");
    col.className = "faction-col";
    col.innerHTML = `<h3 class="faction-title">${faction}</h3>`;

    for (const c of chars) {
      const id = `pick_${c.id}`;
      const factionClass =
      c.faction === "Space Marines" ? "faction-sm"
      : c.faction === "Eldar" ? "faction-el"
      : c.faction === "Orks" ? "faction-ok"
      : "faction-ch";

      const card = document.createElement("label");
      card.className = `char-card ${factionClass}`;
      card.innerHTML = `
      <input type="radio" name="charPick" id="${id}" value="${c.id}" />
      <img src="${c.img}" alt="${c.name}" />
      <div><b>${c.name}</b></div>
      <small>HP:${c.HP} ATK:${c.ATK} DEF:${c.DEF} PSY:${c.PSY} RES:${c.RES}</small>
      `;
      col.appendChild(card);
    }

    wrap.appendChild(col);
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

    // --- stat ikonok
    const statIcons = {
      HP: "❤️",
      ATK: "⚔️",
      DEF: "🛡️",
      PSY: "🔮",
      RES: "✨"
    };

    const statsCol = document.createElement("div");
    statsCol.className = "stats-vertical";

    ["HP", "ATK", "DEF", "PSY", "RES"].forEach(stat => {
      let val = p.stats[stat];
      let buffs = p.activeBuffs?.filter(b => b.stats?.includes(stat)) || [];
      let debuffs = p.activeDebuffs?.filter(d => d.stat === stat) || [];

      const row = document.createElement("div");
      row.className = "stat-row";

      // ikon + érték
      const left = document.createElement("span");
      left.textContent = `${statIcons[stat]} ${val}`;
      row.appendChild(left);

      // buff/debuff nyilak jobbra
      const right = document.createElement("span");
      right.className = "modifiers";

      buffs.forEach(buff => {
        const up = document.createElement("span");
        up.textContent = "⬆";
        up.style.color = "green";
        up.title = `Buff: ${buff.name || 'Ismeretlen'}`;
        right.appendChild(up);
      });

      debuffs.forEach(debuff => {
        const down = document.createElement("span");
        down.textContent = "⬇";
        down.style.color = "red";
        down.title = `Debuff: ${debuff.name || 'Ismeretlen'}`;
        right.appendChild(down);
      });

      row.appendChild(right);
      statsCol.appendChild(row);
    });

    li.innerHTML = `
    <div>
    <div><b class="${factionClass}">${p.name}</b> — <i>${p.characterName}</i> ${alive}</div>
    </div>
    <div>${state.currentPlayer === p.id ? '<span class="badge turn">Kör</span>': ''}</div>
    `;

    // stat blokk beszúrása
    li.querySelector("div").appendChild(statsCol);

    // inventory sor
    const invRow = document.createElement("div");
    invRow.className = "stats";
    invRow.textContent = `Tárgyak: ${p.inventory.map(i=>i.name).join(", ") || "-"}`;
    li.querySelector("div").appendChild(invRow);

    list.appendChild(li);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  const joinForm = document.getElementById("joinForm");
  if (joinForm) {
    joinForm.addEventListener("submit", (e) => {
      // ha van kiválasztott karakter
      const pick = document.querySelector("input[name='charPick']:checked");
      if (!pick) {
        e.preventDefault();
        alert("Válassz egy karaktert!");
        return;
      }

      // overlay eltüntetése
      const overlay = document.getElementById("charOverlay");
      overlay.style.display = "none";
    });
  }
});

window.renderCharacterSelect = renderCharacterSelect;
window.renderPlayers = renderPlayers;

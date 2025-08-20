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

  const statIcons = {
    HP: "❤️",
    ATK: "⚔️",
    DEF: "🛡️",
    PSY: "🔮",
    RES: "✨"
  };

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
      `;

      // --- stat ikonok vízszintesen
      const statsRow = document.createElement("div");
      statsRow.className = "stats-horizontal";

      ["HP", "ATK", "DEF", "PSY", "RES"].forEach(stat => {
        const span = document.createElement("span");
        span.className = "stat-item";
        span.textContent = `${statIcons[stat]} ${c[stat]}`;
        statsRow.appendChild(span);
      });

      card.appendChild(statsRow);
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

      const left = document.createElement("span");
      left.textContent = `${statIcons[stat]} ${val}`;
      row.appendChild(left);

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
    <div>${state.currentPlayer === p.id ? '<span class="badge turn">Kör</span>' : ''}</div>
    `;

    li.querySelector("div").appendChild(statsCol);

    const invRow = document.createElement("div");
    invRow.className = "stats";
    invRow.textContent = `Tárgyak: ${p.inventory.map(i => i.name).join(", ") || "-"}`;
    li.querySelector("div").appendChild(invRow);

    list.appendChild(li);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const charOverlay = document.getElementById("charOverlay");
  const joinForm = document.getElementById("joinForm");
  if (joinForm) {
    const nameInput = document.getElementById("playerName");

    // Flex konténer létrehozása
    const flexWrap = document.createElement("div");
    flexWrap.style.display = "flex";
    flexWrap.style.alignItems = "center";
    flexWrap.style.justifyContent = "center"; // középre rendezés
    flexWrap.style.gap = "10px";
    flexWrap.style.marginBottom = "1rem";

    // Vissza gomb
    const backBtn = document.createElement("button");
    backBtn.textContent = "← Vissza";
    backBtn.className = "btn-back"; // későbbi CSS-hez
    backBtn.addEventListener("click", () => {
      // UI: vissza a menübe
      charOverlay.style.display = "none";
      document.getElementById("menuOverlay").style.display = "flex";

      // Szerver: jelezni hogy kilépett
      if (window.socket) {
        window.socket.emit("leaveRoom");
      }
    });

    // Áthelyezzük a mezőt és a gombot a flexWrap-be
    nameInput.parentNode.insertBefore(flexWrap, nameInput);
    flexWrap.appendChild(backBtn);
    flexWrap.appendChild(nameInput);

    // Join gomb alá
    const joinBtn = joinForm.querySelector("button[type='submit']");
    joinBtn.style.display = "block";
    joinBtn.style.margin = "0 auto"; // középre

    joinForm.addEventListener("submit", (e) => {
      const pick = document.querySelector("input[name='charPick']:checked");
      if (!pick) {
        e.preventDefault();
        alert("Válassz egy karaktert!");
        return;
      }
      charOverlay.style.display = "none";
    });
  }
});

function scaleOverlay() {
  const overlay = document.querySelector('.overlay-content');
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // alapméret: 800x600
  const scaleX = vw / 800;
  const scaleY = vh / 600;
  const scale = Math.min(scaleX, scaleY, 1); // max 1, kisebb viewportnál scale

  overlay.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', scaleOverlay);
window.addEventListener('load', scaleOverlay);

window.renderCharacterSelect = renderCharacterSelect;
window.renderPlayers = renderPlayers;

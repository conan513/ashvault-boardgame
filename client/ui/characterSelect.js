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
    li.style.display = "flex";
    li.style.flexDirection = "column";
    li.style.alignItems = "center";

    const factionClass = p.faction === "Space Marines" ? "faction-sm"
    : p.faction === "Eldar" ? "faction-el"
    : p.faction === "Orks" ? "faction-ok"
    : "faction-ch";
    const alive = p.alive ? "" : `<span class="dead">[ELHUNYT]</span>`;

    // === karakter kép teljes szélességben ===
    const char = ALL_CHARS.find(c => c.id == p.characterId);
    if (char) {
      const imgWrap = document.createElement("div");
      imgWrap.className = "player-img-wrap";
      imgWrap.style.position = "relative";
      imgWrap.style.width = "100%";

      const img = document.createElement("img");
      img.src = char.img;
      img.alt = char.name;
      img.className = "player-char-img";
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.borderRadius = "10px";
      imgWrap.appendChild(img);

      // név overlay
      const nameOverlay = document.createElement("div");
      nameOverlay.className = "player-name-overlay";
      nameOverlay.innerHTML = `<b class="${factionClass}">${p.name}</b> ${alive}`;
      nameOverlay.style.position = "absolute";
      nameOverlay.style.bottom = "5px";
      nameOverlay.style.left = "50%";
      nameOverlay.style.transform = "translateX(-50%)";
      nameOverlay.style.background = "rgba(0,0,0,0.6)";
      nameOverlay.style.color = "white";
      nameOverlay.style.padding = "2px 6px";
      nameOverlay.style.borderRadius = "6px";
      nameOverlay.style.fontSize = "0.9rem";
      nameOverlay.style.whiteSpace = "nowrap";
      imgWrap.appendChild(nameOverlay);

      // "Kör" jelző overlay
      if (state.currentPlayer === p.id) {
        const turnBadge = document.createElement("div");
        turnBadge.innerHTML = `<span class="badge turn">Kör</span>`;
        turnBadge.style.position = "absolute";
        turnBadge.style.top = "5px";
        turnBadge.style.right = "5px";
        imgWrap.appendChild(turnBadge);
      }

      li.appendChild(imgWrap);
    }

    // === stat ikonok kép alatt ===
    const statIcons = {
      HP: "❤️",
      ATK: "⚔️",
      DEF: "🛡️",
      PSY: "🔮",
      RES: "✨"
    };

    const statsCol = document.createElement("div");
    statsCol.className = "stats-vertical";
    statsCol.style.marginTop = "8px";
    statsCol.style.width = "100%";
    statsCol.style.display = "flex";
    statsCol.style.flexDirection = "column";
    statsCol.style.alignItems = "flex-start";

    ["HP", "ATK", "DEF", "PSY", "RES"].forEach(stat => {
      let val = p.stats[stat];

      let buffs = p.activeBuffs?.filter(
        b => Array.isArray(b.stats) && b.stats.some(s => s.toUpperCase() === stat.toUpperCase())
      ) || [];

      let debuffs = p.activeDebuffs?.filter(
        d => typeof d.stat === "string" && d.stat.toUpperCase() === stat.toUpperCase()
      ) || [];

      const row = document.createElement("div");
      row.className = "stat-row";

      const statValueContainer = document.createElement("span");
      statValueContainer.className = "stat-value";
      statValueContainer.textContent = `${statIcons[stat]} ${val}`;

      buffs.forEach(buff => {
        const up = document.createElement("span");
        up.textContent = "⬆";
        up.style.color = "green";
        const source = buff.sourceCard || buff.name || "Ismeretlen kártya";
        up.title = `Buff forrása: ${source} (+${buff.amount})`;
        statValueContainer.appendChild(up);
      });

      debuffs.forEach(debuff => {
        const down = document.createElement("span");
        down.textContent = "⬇";
        down.style.color = "red";
        const source = debuff.sourceCard || debuff.name || "Ismeretlen kártya";
        down.title = `Debuff forrása: ${source} (${debuff.amount})`;
        statValueContainer.appendChild(down);
      });

      row.appendChild(statValueContainer);
      statsCol.appendChild(row);
    });

    li.appendChild(statsCol);

    // === inventory ===
    const invRow = document.createElement("div");
    invRow.className = "stats";
    invRow.style.marginTop = "5px";
    invRow.textContent = `Tárgyak: ${p.inventory.map(i => i.name).join(", ") || "-"}`;
    li.appendChild(invRow);

    list.appendChild(li);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const charOverlay = document.getElementById("charOverlay");
  const joinForm = document.getElementById("joinForm");
  if (joinForm) {
    const nameInput = document.getElementById("playerName");

    const flexWrap = document.createElement("div");
    flexWrap.style.display = "flex";
    flexWrap.style.alignItems = "center";
    flexWrap.style.justifyContent = "center";
    flexWrap.style.gap = "10px";
    flexWrap.style.marginBottom = "1rem";

    const backBtn = document.createElement("button");
    backBtn.textContent = "← Vissza";
    backBtn.className = "btn-back";
    backBtn.addEventListener("click", () => {
      charOverlay.style.display = "none";
      document.getElementById("menuOverlay").style.display = "flex";
      if (window.socket) {
        window.socket.emit("leaveRoom");
      }
    });

    nameInput.parentNode.insertBefore(flexWrap, nameInput);
    flexWrap.appendChild(backBtn);
    flexWrap.appendChild(nameInput);

    const joinBtn = joinForm.querySelector("button[type='submit']");
    joinBtn.style.display = "block";
    joinBtn.style.margin = "0 auto";

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
  const scaleX = vw / 800;
  const scaleY = vh / 600;
  const scale = Math.min(scaleX, scaleY, 1);
  overlay.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', scaleOverlay);
window.addEventListener('load', scaleOverlay);

window.renderCharacterSelect = renderCharacterSelect;
window.renderPlayers = renderPlayers;

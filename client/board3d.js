// board3d.js
// 3D Warhammer 40k board Three.js-zel, űr háttérrel és nebula effekttel.
// A globális GAME, MY_ID, LAST_DICE, socket változókat a meglévő kódod biztosítja.

(() => {
    // ===== Alap Three.js setup =====
    const root = document.getElementById("board3d");
    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.shadowMap.enabled = true;
    root.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(55, root.clientWidth / root.clientHeight, 0.1, 5000);
    camera.position.set(0, 560, 720);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    // Fények
    const hemi = new THREE.HemisphereLight(0x8fb3ff, 0x080820, 0.6);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(300, 600, 300);
    dir.castShadow = true;
    scene.add(dir);

    // ===== Űr háttér: csillagmező + nebula rétegek =====
    // Csillagmező részecskék
    function createStarfield(count = 4000, spread = 2000) {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = spread * (0.35 + Math.random() * 0.65);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ size: 1.2, sizeAttenuation: true });
        const stars = new THREE.Points(geo, mat);
        stars.renderOrder = -10;
        scene.add(stars);
        return stars;
    }
    createStarfield();

    // Nebula „füst” rétegek: nagy, áttetsző, lassan forgó plane-ek procedurális textúrával
    function makeNebulaCanvas(hue = 260) {
        const c = document.createElement("canvas");
        c.width = 1024; c.height = 1024;
        const ctx = c.getContext("2d");
        // Radial több rétegű füst
        const layers = 6;
        for (let i = 0; i < layers; i++) {
            const g = ctx.createRadialGradient(
                512 + (Math.random() * 200 - 100),
                                               512 + (Math.random() * 200 - 100),
                                               40 + i * 20,
                                               512, 512,
                                               480
            );
            const sat = 55 + Math.random() * 25;
            const alpha = 0.08 + i * 0.04;
            g.addColorStop(0, `hsla(${hue + Math.random()*20 - 10}, ${sat}%, 60%, ${alpha})`);
            g.addColorStop(1, `hsla(${hue + 30}, 40%, 10%, 0)`);
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(512, 512, 512, 0, Math.PI * 2);
            ctx.fill();
        }
        return c;
    }

    function createNebulaPlanes() {
        const group = new THREE.Group();
        const hues = [260, 200, 320]; // kékes-lilás paletta WH40K hangulathoz
        hues.forEach((h, i) => {
            const tex = new THREE.CanvasTexture(makeNebulaCanvas(h));
            tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.needsUpdate = true;

            const mat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                depthWrite: false,
                opacity: 0.55 - i * 0.12,
                blending: THREE.AdditiveBlending
            });
            const geo = new THREE.PlaneGeometry(4000, 4000);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, -400 - i * 120, 0);
            mesh.rotation.x = -Math.PI / 2;
            mesh.renderOrder = -5 + i;
            group.add(mesh);
        });
        scene.add(group);
        return group;
    }
    const nebula = createNebulaPlanes();

    // ===== Board geometria =====
    // Hex „csonka henger” 6 oldalú cylinderrel
    function hexGeometry(radius = 22, height = 8) {
        return new THREE.CylinderGeometry(radius, radius, height, 6, 1, false);
    }

    const R_OUTER = 360;
    const R_INNER = 240;
    const CX = 0, CY = 0;
    const TILE_Y = 0;

    // Frakció színek + emissive
    const F_COL = {
        "Space Marines": { base: 0x2a7fff, emis: 0x326bff },
 "Eldar": { base: 0x32d1a0, emis: 0x2eb593 },
 "Orks": { base: 0x70d13e, emis: 0x66ba39 },
 "Chaos": { base: 0xc04ff0, emis: 0xa73ed4 },
 "NEUTRAL": { base: 0x6b7592, emis: 0x44506c },
    };

    // Tárolók
    let tilesById = new Map();      // id -> Mesh
    let tokensByPlayer = new Map(); // name -> Mesh
    let highlighted = new Set();    // id

    // Tooltip DOM
    const tileTooltip = document.getElementById("tileTooltip");
    const tileTooltipImg = document.getElementById("tileTooltipImg");
    const tileTooltipLabel = document.getElementById("tileTooltipLabel");

    // Raycaster a kattintáshoz/hoverhez
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // ===== Segédfüggvények =====
    function angleOuter(i) { return (i / 24) * Math.PI * 2 - Math.PI / 2; }
    function angleInner(i) { return (i / 12) * Math.PI * 2 - Math.PI / 2; }

    function posFor(cell) {
        if (cell.ring === "CENTER") return new THREE.Vector3(CX, TILE_Y, CY);
        if (cell.ring === "OUTER") {
            const a = angleOuter(cell.id);
            return new THREE.Vector3(
                CX + Math.cos(a) * R_OUTER,
                                     TILE_Y,
                                     CY + Math.sin(a) * R_OUTER
            );
        } else if (cell.ring === "INNER") {
            const idx = cell.id - 24;
            const a = angleInner(idx);
            return new THREE.Vector3(
                CX + Math.cos(a) * R_INNER,
                                     TILE_Y,
                                     CY + Math.sin(a) * R_INNER
            );
        }
    }

    function matForFaction(faction, highlight = false) {
        const c = F_COL[faction] || F_COL["NEUTRAL"];
        return new THREE.MeshStandardMaterial({
            color: highlight ? 0xffffff : c.base,
            emissive: highlight ? 0xffffff : c.emis,
            roughness: 0.6,
            metalness: 0.35
        });
    }

    function createTile(cell) {
        const geo = hexGeometry(22, 8);
        const mat = matForFaction(cell.faction);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.userData.cellId = cell.id;
        mesh.userData.cellName = cell.name;
        mesh.userData.faction = cell.faction;

        const p = posFor(cell);
        mesh.position.copy(p);
        mesh.rotation.y = Math.PI / 6; // szépen álljon a hex
        scene.add(mesh);

        // Lebegő frakció „plakett”
        const label = makeFloatingLabel(cell);
        label.position.set(p.x, p.y + 10, p.z);
        scene.add(label);
        mesh.userData.label = label;

        tilesById.set(cell.id, mesh);
    }

    function makeFloatingLabel(cell) {
        const g = new THREE.Group();

        const plate = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 12),
                                     new THREE.MeshBasicMaterial({
                                         color: 0x0a0f1a, transparent: true, opacity: 0.85
                                     })
        );
        plate.position.set(0, 0, 0);
        plate.lookAt(camera.position);
        g.add(plate);

        const tex = makeTextTexture(cell.name, 128, 32);
        const text = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 12),
                                    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
        text.position.set(0, 0, 0.01);
        text.lookAt(camera.position);
        g.add(text);

        // billboarding effekt frissítve tickben
        g.userData.billboard = true;
        return g;
    }

    function makeTextTexture(text, w = 256, h = 64) {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.fillRect(0, 0, w, h);
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#e6eefc";
        ctx.strokeStyle = "#2a3d5b";
        ctx.lineWidth = 3;
        ctx.strokeText(text, w/2, h/2);
        ctx.fillText(text, w/2, h/2);
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    }

    function makeTokenForPlayer(p) {
        // Kör alakú henger + monogram
        const color =
        (F_COL[p.faction] && F_COL[p.faction].base) || 0xffffff;

        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(10, 10, 5, 32),
                                    new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.45, emissive: 0x111111 })
        );
        body.castShadow = true;
        body.receiveShadow = true;

        const monogram = (p.name || "??").slice(0, 2).toUpperCase();
        const tex = makeTextTexture(monogram, 128, 128);
        const cap = new THREE.Mesh(
            new THREE.CircleGeometry(10, 48),
                                   new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
        cap.rotation.x = -Math.PI / 2;
        cap.position.y = 2.6;

        const g = new THREE.Group();
        g.add(body);
        g.add(cap);
        g.userData.playerName = p.name;
        return g;
    }

    // ===== Nyilvános API-k – kompatibilis nevekkel =====
    let BOARD_CACHE = null;
    let HIGHLIGHTS = [];

    function renderBoard(state) {
        // Első hívás: teljes pálya felépítése
        BOARD_CACHE = state.board;

        // Tisztítás, ha újrarajzolás
        tilesById.forEach(mesh => {
            scene.remove(mesh);
            if (mesh.userData.label) scene.remove(mesh.userData.label);
        });
            tilesById.clear();

            tokensByPlayer.forEach(mesh => scene.remove(mesh));
            tokensByPlayer.clear();

            // RING „guide” — vékony emissive körök (látvány)
            scene.getObjectByName("ringGroup")?.removeFromParent();
            const ringGroup = new THREE.Group(); ringGroup.name = "ringGroup";
            const mkRing = (r) => {
                const geo = new THREE.RingGeometry(r - 1, r + 1, 128);
                const mat = new THREE.MeshBasicMaterial({ color: 0x2a3d5b, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
                const ring = new THREE.Mesh(geo, mat);
                ring.rotation.x = -Math.PI / 2;
                ring.position.y = TILE_Y - 0.1;
                return ring;
            };
            ringGroup.add(mkRing(R_INNER));
            ringGroup.add(mkRing(R_OUTER));
            scene.add(ringGroup);

            // Tile-ok
            for (const cell of state.board) createTile(cell);

            // Tokenek
            const playersByCell = {};
        for (const p of Object.values(state.players)) {
            if (!p.alive) continue;
            playersByCell[p.position] = playersByCell[p.position] || [];
            playersByCell[p.position].push(p);
        }
        for (const [cellId, players] of Object.entries(playersByCell)) {
            const base = tilesById.get(+cellId);
            if (!base) continue;
            const count = players.length;
            const radius = count > 1 ? 16 : 0;
            players.forEach((p, idx) => {
                const a = (idx / count) * Math.PI * 2;
                const dx = radius * Math.cos(a);
                const dz = radius * Math.sin(a);
                const token = makeTokenForPlayer(p);
                token.position.set(base.position.x + dx, TILE_Y + 8, base.position.z + dz);
                scene.add(token);
                tokensByPlayer.set(p.name, token);
            });
        }

        // „Current player” kiemelése
        if (state.currentPlayer && state.players[state.currentPlayer]) {
            const cid = state.players[state.currentPlayer].position;
            const m = tilesById.get(cid);
            if (m) {
                m.userData._origScale = m.scale.clone();
                m.scale.set(1.15, 1.05, 1.15);
            }
        }

        enableTileHoverPopup();
    }

    function animateMove(player, path, callback) {
        // Token keresése
        const token = tokensByPlayer.get(player.name);
        if (!token) { callback && callback(); return; }

        let step = 0;
        const duration = 420;

        const tickStep = () => {
            if (step >= path.length) {
                callback && callback();
                return;
            }
            const cell = BOARD_CACHE.find(c => c.id === path[step]);
            const tile = tilesById.get(cell.id);
            if (!tile) { step++; requestAnimationFrame(tickStep); return; }

            const from = token.position.clone();
            const to = new THREE.Vector3(tile.position.x, TILE_Y + 8, tile.position.z);

            const t0 = performance.now();
            const ease = (t)=> t<.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOutQuad
            const animate = () => {
                const t = Math.min(1, (performance.now() - t0) / duration);
                const e = ease(t);
                token.position.lerpVectors(from, to, e);
                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    step++;
                    setTimeout(tickStep, 30);
                }
            };
            animate();
        };
        tickStep();
    }

    function highlightTargets(targetIds, onPick) {
        clearHighlights();
        targetIds.forEach(id => {
            const m = tilesById.get(id);
            if (!m) return;
            m.userData._origMat = m.material;
            m.material = matForFaction(m.userData.faction, true);
            m.userData._pulse = true;
            highlighted.add(id);
        });

        // Click kezelés raycasterrel
        const clickHandler = (ev) => {
            const pick = pickTile(ev);
            if (pick && highlighted.has(pick.userData.cellId)) {
                // útvonal kiszámítása a te logikáddal a kliensen
                const me = GAME.players[MY_ID];
                const myCell = GAME.board.find(c => c.id === me.position);
                const ringCells = GAME.board
                .filter(c => c.ring === myCell.ring)
                .sort((a,b)=>a.id-b.id);
                const myIdx = ringCells.findIndex(c => c.id === myCell.id);
                const targetIdx = ringCells.findIndex(c => c.id === pick.userData.cellId);
                const N = ringCells.length;
                const pathRight = []; for (let s=1; s<=LAST_DICE; s++) pathRight.push(ringCells[(myIdx + s) % N].id);
                const pathLeft  = []; for (let s=1; s<=LAST_DICE; s++) pathLeft .push(ringCells[(myIdx - s + N) % N].id);

                let chosen = pathRight;
                if (pathLeft[pathLeft.length - 1] === pick.userData.cellId) chosen = pathLeft;

                animateMove(me, chosen, () => {
                    socket.emit("confirmMove", { dice: LAST_DICE, targetCellId: pick.userData.cellId });
                    clearHighlights();
                });
            }
        };
        // ideiglenesen bekötjük
        window.addEventListener("pointerdown", clickHandler, { once: true });
        HIGHLIGHTS.push({ type: "click", handler: clickHandler });
    }

    function clearHighlights() {
        highlighted.forEach(id => {
            const m = tilesById.get(id);
            if (!m) return;
            if (m.userData._origMat) m.material = m.userData._origMat;
            m.userData._pulse = false;
            delete m.userData._origMat;
        });
        highlighted.clear();

        HIGHLIGHTS.forEach(h => window.removeEventListener("pointerdown", h.handler));
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
        el.style.color = "#e6eef7";
        el.style.zIndex = "9999";
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    // ===== Tooltip és interakció =====
    function enableTileHoverPopup() {
        renderer.domElement.addEventListener("pointermove", (e) => {
            const hit = pickTile(e);
            if (hit) {
                const name = hit.userData.cellName || "Unknown";
                const fac = hit.userData.faction || "NEUTRAL";
                const fcls = ({ "Space Marines": "sm", "Eldar": "el", "Orks": "ok", "Chaos": "ch", "NEUTRAL": "ne" })[fac] || "ne";
                tileTooltipImg.src = `/icons/${fcls}.png`;
                tileTooltipLabel.innerHTML = `<strong>${name}</strong>`;
                tileTooltip.style.display = "block";
                tileTooltip.style.left = (e.clientX + 15) + "px";
                tileTooltip.style.top  = (e.clientY + 15) + "px";
            } else {
                tileTooltip.style.display = "none";
            }
        });
        renderer.domElement.addEventListener("pointerleave", () => {
            tileTooltip.style.display = "none";
        });
    }

    function pickTile(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const meshes = [...tilesById.values()];
        const hit = raycaster.intersectObjects(meshes, true)[0];
        return hit ? (hit.object.userData.cellId !== undefined ? hit.object : hit.object.parent) : null;
    }

    // ===== Render loop =====
    function onResize() {
        const w = root.clientWidth, h = root.clientHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    function loop() {
        const dt = clock.getDelta();

        // Nebula lassú forgás
        nebula.children.forEach((p, i) => {
            p.rotation.z += 0.002 * (i + 1) * dt * 60;
        });

        // Highlight pulzálás emissive/intenzitással
        highlighted.forEach(id => {
            const m = tilesById.get(id);
            if (!m) return;
            const t = performance.now() * 0.005;
            const k = 0.5 + 0.5 * Math.sin(t);
            m.emissiveIntensity = 0.5 + 0.5 * k;
            const s = 1.02 + 0.02 * Math.sin(t);
            m.scale.set(s, 1.03, s);
        });

        // Billboarding a lebegő címkéknél
        tilesById.forEach(m => {
            const lbl = m.userData.label;
            if (lbl && lbl.userData.billboard) {
                lbl.children.forEach(ch => ch.lookAt(camera.position));
            }
        });

        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
    }
    loop();

    // ===== Globális névterek a kompatibilitáshoz =====
    window.renderBoard = renderBoard;
    window.highlightTargets = highlightTargets;
    window.clearHighlights = clearHighlights;
    window.showToast = showToast;
    window.animateMove = animateMove;
})();

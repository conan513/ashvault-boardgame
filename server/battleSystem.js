// server/battleSystem.js

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function effectiveAttack(attacker, defender) {
  const d = rollD6();
  const raw = (attacker.stats.ATK || 0) + d;
  const afterDef = Math.max(0, raw - (defender.stats.DEF || 0));
  return { d, raw, total: afterDef };
}

function battlePVE(player, enemy, io, socketId) {
  const P = effectiveAttack(player, { stats: { DEF: enemy.DEF || 0 } });
  const E = effectiveAttack({ stats: { ATK: enemy.ATK || 0 } }, player);

  let winner = "player";
  if (E.total > P.total) winner = "enemy";

  const damage = 1; // mindig 1 HP veszteség

  if (winner === "enemy") {
    player.stats.HP -= damage;
  } else {
    // ha a játékos nyer, az ellenfél megsemmisül
    enemy.HP = 0;
  }

  return {
    winner,
    rollP: P.d, totalP: P.total, rawP: P.raw,
    rollE: E.d, totalE: E.total, rawE: E.raw,
    damage
  };
}

function battlePVP(A, B, io) {
  const Pa = effectiveAttack(A, B);
  const Pb = effectiveAttack(B, A);

  let winner = "A";
  if (Pb.total > Pa.total) winner = "B";

  const damage = 1; // mindig 1 HP veszteség

  if (winner === "A") {
    B.stats.HP -= damage;
  } else {
    A.stats.HP -= damage;
  }

  return {
    winner,
    rolls: { A: Pa.d, B: Pb.d },
    totals: { A: Pa.total, B: Pb.total },
    raw: { A: Pa.raw, B: Pb.raw },
    damage
  };
}

module.exports = { battlePVE, battlePVP };

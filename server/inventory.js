// server/inventory.js
function applyItemToPlayer(player, item) {
  player.inventory.push(item);
  if (item.statMods) {
    for (const [k, v] of Object.entries(item.statMods)) {
      player.stats[k] = Math.max(0, (player.stats[k] || 0) + v);
    }
  }
}
function removeItemFromPlayer(player, itemId) {
  const idx = player.inventory.findIndex(i => i.id === itemId);
  if (idx >= 0) {
    const [item] = player.inventory.splice(idx,1);
    if (item.statMods) {
      for (const [k, v] of Object.entries(item.statMods)) {
        player.stats[k] = Math.max(0, (player.stats[k] || 0) - v);
      }
    }
    return item;
  }
  return null;
}
module.exports = { applyItemToPlayer, removeItemFromPlayer };

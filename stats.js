const fs = require('fs');
const path = require('path');

function loadStats(statsFilePath) {
  if (!fs.existsSync(statsFilePath)) return {};
  return JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
}

function saveStats(statsFilePath, stats) {
  fs.mkdirSync(path.dirname(statsFilePath), { recursive: true });
  fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

// Los usos se cuentan por chat (stats[chatId][command]), no en un único totalizador
// global, para poder ver en /estadisticas qué comandos se usan en cada grupo.
function incrementUsage(stats, chatId, command) {
  const chatStats = stats[chatId] || {};
  return {
    ...stats,
    [chatId]: { ...chatStats, [command]: (chatStats[command] || 0) + 1 },
  };
}

// Para /resetestadisticas <chat>: quita solo la entrada de ese chat, deja el resto tal cual.
function resetChatStats(stats, chatId) {
  const { [chatId]: _removed, ...rest } = stats;
  return rest;
}

module.exports = { loadStats, saveStats, incrementUsage, resetChatStats };

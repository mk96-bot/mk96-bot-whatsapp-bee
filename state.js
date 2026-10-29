const fs = require('fs');
const path = require('path');

function loadState(stateFilePath) {
  if (!fs.existsSync(stateFilePath)) return {};
  return JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
}

function saveState(stateFilePath, state) {
  fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
  fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
}

function pickNext(state, chatId, command, items) {
  if (items.length === 0) {
    return { chosenItem: null, nextState: state };
  }

  const chatState = state[chatId] || {};
  const seen = chatState[command] || [];
  let available = items.map((_, i) => i).filter((i) => !seen.includes(i));
  let baseSeen = seen;

  if (available.length === 0) {
    available = items.map((_, i) => i);
    baseSeen = [];
  }

  const chosenIndex = available[Math.floor(Math.random() * available.length)];
  const nextState = {
    ...state,
    [chatId]: {
      ...chatState,
      [command]: [...baseSeen, chosenIndex],
    },
  };

  return { chosenItem: items[chosenIndex], nextState };
}

// Para /resetmemoria <chat>: olvida qué frases/recomendaciones ya se dieron en ese
// chat (pickNext vuelve a elegir libremente entre toda la lista), sin tocar el resto.
function resetChatState(state, chatId) {
  const { [chatId]: _removed, ...rest } = state;
  return rest;
}

module.exports = { loadState, saveState, pickNext, resetChatState };

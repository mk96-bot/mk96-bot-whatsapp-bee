const fs = require('fs');
const path = require('path');

function loadAllowedChats(configFilePath) {
  if (!fs.existsSync(configFilePath)) return [];
  return JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
}

function saveAllowedChats(configFilePath, chats) {
  fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
  fs.writeFileSync(configFilePath, JSON.stringify(chats, null, 2));
}

function loadAliases(configFilePath) {
  if (!fs.existsSync(configFilePath)) return {};
  return JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
}

function saveAliases(configFilePath, aliases) {
  fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
  fs.writeFileSync(configFilePath, JSON.stringify(aliases, null, 2));
}

module.exports = { loadAllowedChats, saveAllowedChats, loadAliases, saveAliases };

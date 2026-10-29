const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MELON_COMMANDS,
  MELON_DESCRIPTIONS,
  MELON_EMOJIS,
  isMelonCommand,
  loadMelonItems,
  resolveEmojiAlias,
} = require('../commands');

test('isMelonCommand reconoce comandos de melón y rechaza el resto', () => {
  assert.equal(isMelonCommand('/melon'), true);
  assert.equal(isMelonCommand('/abeja'), true);
  assert.equal(isMelonCommand('/reto'), true);
  assert.equal(isMelonCommand('/caña'), true);
  assert.equal(isMelonCommand('/avispa'), true);
  assert.equal(isMelonCommand('/hola'), true);
  assert.equal(isMelonCommand('/piropo'), true);
  assert.equal(isMelonCommand('/suerte'), true);
  assert.equal(isMelonCommand('/consejo'), true);
  assert.equal(isMelonCommand('/destino'), true);
  assert.equal(isMelonCommand('/picame'), true);
  assert.equal(isMelonCommand('/plan'), true);
  assert.equal(isMelonCommand('/dato'), true);
  assert.equal(isMelonCommand('/elige'), true);
  assert.equal(isMelonCommand('/confesion'), true);
  assert.equal(isMelonCommand('/hello'), false);
  assert.equal(isMelonCommand('/inventado'), false);
});

test('cada comando de melón tiene una descripción', () => {
  for (const command of Object.keys(MELON_COMMANDS)) {
    assert.equal(typeof MELON_DESCRIPTIONS[command], 'string');
    assert.ok(MELON_DESCRIPTIONS[command].length > 0);
  }
});

test('cada comando de melón tiene un emoji asignado', () => {
  for (const command of Object.keys(MELON_COMMANDS)) {
    assert.equal(typeof MELON_EMOJIS[command], 'string');
    assert.ok(MELON_EMOJIS[command].length > 0);
  }
});

test('resolveEmojiAlias sustituye el emoji por el comando de texto', () => {
  const map = { '🐝': '/abeja', '✂️': '/ppt' };
  assert.equal(resolveEmojiAlias('/🐝', map), '/abeja');
});

test('resolveEmojiAlias conserva el resto del mensaje tras el emoji', () => {
  const map = { '✂️': '/ppt' };
  assert.equal(resolveEmojiAlias('/✂️ piedra', map), '/ppt piedra');
});

test('resolveEmojiAlias deja el comando de texto tal cual', () => {
  const map = { '🐝': '/abeja' };
  assert.equal(resolveEmojiAlias('/abeja', map), '/abeja');
});

test('resolveEmojiAlias deja intactos mensajes sin emoji conocido', () => {
  const map = { '🐝': '/abeja' };
  assert.equal(resolveEmojiAlias('/inventado', map), '/inventado');
  assert.equal(resolveEmojiAlias('hola, ¿qué tal?', map), 'hola, ¿qué tal?');
});

test('loadMelonItems lee el array JSON del comando', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'melon-content-'));
  fs.writeFileSync(path.join(tmpDir, 'melon.json'), JSON.stringify(['a', 'b']));
  const items = loadMelonItems(tmpDir, '/melon');
  assert.deepEqual(items, ['a', 'b']);
  fs.rmSync(tmpDir, { recursive: true });
});

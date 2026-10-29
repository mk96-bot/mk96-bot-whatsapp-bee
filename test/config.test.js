const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadAllowedChats, saveAllowedChats, loadAliases, saveAliases } = require('../config');

test('loadAllowedChats devuelve la lista del archivo', () => {
  const tmpFile = path.join(os.tmpdir(), `allowed-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(['123@g.us']));
  assert.deepEqual(loadAllowedChats(tmpFile), ['123@g.us']);
  fs.rmSync(tmpFile);
});

test('loadAllowedChats devuelve [] si el archivo no existe', () => {
  const missing = path.join(os.tmpdir(), `missing-allowed-${process.pid}.json`);
  assert.deepEqual(loadAllowedChats(missing), []);
});

test('saveAllowedChats escribe la lista y loadAllowedChats la vuelve a leer', () => {
  const tmpFile = path.join(os.tmpdir(), `save-allowed-${process.pid}-${Date.now()}.json`);
  saveAllowedChats(tmpFile, ['456@g.us', '789@c.us']);
  assert.deepEqual(loadAllowedChats(tmpFile), ['456@g.us', '789@c.us']);
  fs.rmSync(tmpFile);
});

test('loadAliases devuelve {} si el archivo no existe', () => {
  const missing = path.join(os.tmpdir(), `missing-aliases-${process.pid}.json`);
  assert.deepEqual(loadAliases(missing), {});
});

test('saveAliases escribe el mapa y loadAliases lo vuelve a leer', () => {
  const tmpFile = path.join(os.tmpdir(), `save-aliases-${process.pid}-${Date.now()}.json`);
  saveAliases(tmpFile, { trabajo: '123@g.us', amigos: '456@g.us' });
  assert.deepEqual(loadAliases(tmpFile), { trabajo: '123@g.us', amigos: '456@g.us' });
  fs.rmSync(tmpFile);
});

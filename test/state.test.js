const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadState, saveState, pickNext, resetChatState } = require('../state');

test('pickNext no repite hasta agotar la lista', () => {
  const items = ['a', 'b', 'c'];
  let state = {};
  const chosen = new Set();
  for (let i = 0; i < 3; i++) {
    const result = pickNext(state, 'chat1', '/melon', items);
    chosen.add(result.chosenItem);
    state = result.nextState;
  }
  assert.equal(chosen.size, 3);
});

test('pickNext reinicia el ciclo tras agotar la lista', () => {
  const items = ['a', 'b'];
  let state = {};
  for (let i = 0; i < 2; i++) {
    state = pickNext(state, 'chat1', '/melon', items).nextState;
  }
  assert.deepEqual(state.chat1['/melon'].slice().sort(), [0, 1]);
  const { nextState } = pickNext(state, 'chat1', '/melon', items);
  assert.equal(nextState.chat1['/melon'].length, 1);
});

test('pickNext devuelve null si la categoría está vacía', () => {
  const { chosenItem } = pickNext({}, 'chat1', '/melon', []);
  assert.equal(chosenItem, null);
});

test('resetChatState borra solo el chat indicado', () => {
  const state = { chat1: { '/melon': [0, 1] }, chat2: { '/melon': [2] } };
  const next = resetChatState(state, 'chat1');
  assert.deepEqual(next, { chat2: { '/melon': [2] } });
});

test('resetChatState no falla si el chat no tenía memoria guardada', () => {
  const state = { chat2: { '/melon': [2] } };
  assert.deepEqual(resetChatState(state, 'chat1'), { chat2: { '/melon': [2] } });
});

test('saveState y loadState hacen round-trip', () => {
  const tmpFile = path.join(os.tmpdir(), `state-test-${process.pid}-${Date.now()}.json`);
  const state = { chat1: { '/melon': [0, 1] } };
  saveState(tmpFile, state);
  assert.deepEqual(loadState(tmpFile), state);
  fs.rmSync(tmpFile);
});

test('loadState devuelve {} si el archivo no existe', () => {
  const missing = path.join(os.tmpdir(), `missing-state-${process.pid}.json`);
  assert.deepEqual(loadState(missing), {});
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { isRateLimited, recordCall, msUntilAllowed, formatRemaining } = require('../ratelimit');

test('isRateLimited devuelve false si no hay llamada previa', () => {
  const map = new Map();
  assert.equal(isRateLimited(map, 'chat1', 1000, 600000), false);
});

test('isRateLimited devuelve true dentro de la ventana de cooldown', () => {
  const map = new Map();
  recordCall(map, 'chat1', 1000);
  assert.equal(isRateLimited(map, 'chat1', 1000 + 500000, 600000), true);
});

test('isRateLimited devuelve false una vez pasado el cooldown', () => {
  const map = new Map();
  recordCall(map, 'chat1', 1000);
  assert.equal(isRateLimited(map, 'chat1', 1000 + 600001, 600000), false);
});

test('isRateLimited es independiente por chat', () => {
  const map = new Map();
  recordCall(map, 'chat1', 1000);
  assert.equal(isRateLimited(map, 'chat2', 1000 + 1, 600000), false);
});

test('msUntilAllowed devuelve 0 si no hay llamada previa', () => {
  const map = new Map();
  assert.equal(msUntilAllowed(map, 'chat1', 1000, 600000), 0);
});

test('msUntilAllowed devuelve el tiempo restante dentro del cooldown', () => {
  const map = new Map();
  recordCall(map, 'chat1', 1000);
  assert.equal(msUntilAllowed(map, 'chat1', 1000 + 400000, 600000), 200000);
});

test('msUntilAllowed devuelve 0 una vez pasado el cooldown', () => {
  const map = new Map();
  recordCall(map, 'chat1', 1000);
  assert.equal(msUntilAllowed(map, 'chat1', 1000 + 600001, 600000), 0);
});

test('formatRemaining formatea minutos y segundos', () => {
  assert.equal(formatRemaining(392000), '6 min 32s');
  assert.equal(formatRemaining(60000), '1 min');
  assert.equal(formatRemaining(45000), '45s');
});

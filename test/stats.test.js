const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadStats, saveStats, incrementUsage, resetChatStats } = require('../stats');

test('loadStats devuelve {} si el archivo no existe', () => {
  const missing = path.join(os.tmpdir(), `missing-stats-${process.pid}.json`);
  assert.deepEqual(loadStats(missing), {});
});

test('incrementUsage suma uno al comando dentro de su chat y no toca el resto', () => {
  const stats = { chat1: { '/melon': 3 } };
  const next = incrementUsage(stats, 'chat1', '/melon');
  assert.equal(next.chat1['/melon'], 4);
  const next2 = incrementUsage(next, 'chat1', '/picame');
  assert.equal(next2.chat1['/picame'], 1);
  assert.equal(next2.chat1['/melon'], 4);
});

test('incrementUsage mantiene separados los contadores de cada chat', () => {
  const stats = { chat1: { '/melon': 1 } };
  const next = incrementUsage(stats, 'chat2', '/melon');
  assert.equal(next.chat1['/melon'], 1);
  assert.equal(next.chat2['/melon'], 1);
});

test('resetChatStats borra solo el chat indicado', () => {
  const stats = { chat1: { '/melon': 3 }, chat2: { '/melon': 5 } };
  const next = resetChatStats(stats, 'chat1');
  assert.deepEqual(next, { chat2: { '/melon': 5 } });
});

test('resetChatStats no falla si el chat no tenía estadísticas', () => {
  const stats = { chat2: { '/melon': 5 } };
  assert.deepEqual(resetChatStats(stats, 'chat1'), { chat2: { '/melon': 5 } });
});

test('saveStats y loadStats hacen round-trip', () => {
  const tmpFile = path.join(os.tmpdir(), `stats-test-${process.pid}-${Date.now()}.json`);
  const stats = { chat1: { '/melon': 5, '/avispa': 2 } };
  saveStats(tmpFile, stats);
  assert.deepEqual(loadStats(tmpFile), stats);
  fs.rmSync(tmpFile);
});

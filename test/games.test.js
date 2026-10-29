const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  flipCoin,
  rollDice,
  formatCoinResult,
  formatDiceResult,
  normalizePptChoice,
  playPpt,
  formatPptResult,
  formatEmojiPollQuestion,
  formatEmojiResults,
  loadTrivialPlusQuestions,
  formatTrivialPlusPollQuestion,
  formatTrivialPlusResults,
} = require('../games');

test('flipCoin siempre devuelve cara o cruz', () => {
  const results = new Set();
  for (let i = 0; i < 200; i++) {
    const result = flipCoin();
    assert.ok(result === 'cara' || result === 'cruz');
    results.add(result);
  }
  assert.equal(results.size, 2);
});

test('rollDice siempre devuelve un número entre 1 y 6', () => {
  const results = new Set();
  for (let i = 0; i < 200; i++) {
    const roll = rollDice();
    assert.ok(Number.isInteger(roll) && roll >= 1 && roll <= 6);
    results.add(roll);
  }
  assert.equal(results.size, 6);
});

test('formatCoinResult incluye el resultado', () => {
  assert.match(formatCoinResult('cara'), /cara/);
});

test('formatDiceResult incluye el número', () => {
  assert.match(formatDiceResult(4), /4/);
});

test('normalizePptChoice acepta piedra/papel/tijera en cualquier mayúscula/espacio', () => {
  assert.equal(normalizePptChoice(' Piedra '), 'piedra');
  assert.equal(normalizePptChoice('TIJERA'), 'tijera');
  assert.equal(normalizePptChoice('papel'), 'papel');
});

test('normalizePptChoice devuelve null si no es una opción válida', () => {
  assert.equal(normalizePptChoice('lagarto'), null);
  assert.equal(normalizePptChoice(''), null);
  assert.equal(normalizePptChoice(undefined), null);
});

test('playPpt siempre devuelve un resultado válido', () => {
  const results = new Set();
  for (let i = 0; i < 200; i++) {
    const { botChoice, result } = playPpt('piedra');
    assert.ok(['piedra', 'papel', 'tijera'].includes(botChoice));
    assert.ok(['gana', 'pierde', 'empate'].includes(result));
    results.add(result);
  }
  assert.equal(results.size, 3);
});

test('playPpt calcula bien quién gana', () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0; // fuerza botChoice = 'piedra' (primer elemento de PPT_OPTIONS)
    assert.deepEqual(playPpt('papel'), { botChoice: 'piedra', result: 'gana' });
    assert.deepEqual(playPpt('tijera'), { botChoice: 'piedra', result: 'pierde' });
    assert.deepEqual(playPpt('piedra'), { botChoice: 'piedra', result: 'empate' });
  } finally {
    Math.random = originalRandom;
  }
});

test('formatPptResult incluye ambas elecciones y el resultado', () => {
  const text = formatPptResult('piedra', 'tijera', 'gana');
  assert.match(text, /piedra/);
  assert.match(text, /tijera/);
  assert.match(text, /Ganas tú/);
});

test('formatEmojiPollQuestion antepone el aviso al clue', () => {
  const question = { clue: '🦁👑🌍' };
  assert.equal(formatEmojiPollQuestion(question), '🎭 Adivina con los emojis:\n🦁👑🌍');
});

test('formatEmojiResults marca la opción correcta', () => {
  const question = { options: ['a', 'b', 'c', 'd'] };
  const text = formatEmojiResults(question, [1, 3, 0, 0], 4, 1);
  assert.match(text, /✅ b — 75% \(3\)/);
});

test('formatTrivialPlusPollQuestion avisa de contenido +18 y muestra la pregunta', () => {
  const question = { question: '¿Qué postura te gusta más?' };
  assert.equal(
    formatTrivialPlusPollQuestion(question),
    '🌶️ Trivial+ (encuesta +18):\n¿Qué postura te gusta más?',
  );
});

test('formatTrivialPlusResults destaca la opción más votada', () => {
  const question = { options: ['a', 'b', 'c', 'd'] };
  const text = formatTrivialPlusResults(question, [1, 3, 0, 0], 4);
  assert.match(text, /La opción más votada: b/);
  assert.match(text, /🏆 b — 75% \(3\)/);
});

test('formatTrivialPlusResults marca empate si hay dos opciones con el mismo máximo', () => {
  const question = { options: ['a', 'b', 'c', 'd'] };
  const text = formatTrivialPlusResults(question, [2, 2, 0, 0], 4);
  assert.match(text, /Empate entre: a y b/);
});

test('formatTrivialPlusResults avisa si nadie ha votado', () => {
  const question = { options: ['a', 'b', 'c', 'd'] };
  const text = formatTrivialPlusResults(question, [0, 0, 0, 0], 0);
  assert.match(text, /Nadie ha votado esta vez\./);
});

test('el contenido real de trivialplus.json tiene al menos 100 preguntas únicas y válidas', () => {
  const contentDir = path.join(__dirname, '..', 'content');
  const questions = loadTrivialPlusQuestions(contentDir);
  assert.ok(questions.length >= 100, `hay ${questions.length}, se esperaban >= 100`);
  const texts = questions.map((q) => q.question);
  assert.equal(new Set(texts).size, texts.length, 'hay preguntas duplicadas');
  for (const q of questions) {
    assert.equal(q.options.length, 4, `"${q.question}" no tiene 4 opciones`);
    assert.equal(new Set(q.options).size, 4, `"${q.question}" tiene opciones duplicadas`);
  }
});

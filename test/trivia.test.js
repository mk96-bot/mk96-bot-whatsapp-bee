const test = require('node:test');
const assert = require('node:assert/strict');
const { tallyVotes, formatCountdown, formatResults, formatPollQuestion, CATEGORY_COLORS } = require('../trivia');

const OPTIONS = ['Madrid', 'Barcelona', 'Sevilla', 'Valencia'];

test('tallyVotes cuenta votos por opción y el total', () => {
  const votes = [
    { selectedOptions: [{ name: 'Madrid' }] },
    { selectedOptions: [{ name: 'Madrid' }] },
    { selectedOptions: [{ name: 'Sevilla' }] },
  ];
  const { counts, total } = tallyVotes(votes, OPTIONS);
  assert.deepEqual(counts, [2, 0, 1, 0]);
  assert.equal(total, 3);
});

test('tallyVotes ignora votos deseleccionados (selectedOptions vacío)', () => {
  const votes = [{ selectedOptions: [] }, { selectedOptions: [{ name: 'Valencia' }] }];
  const { counts, total } = tallyVotes(votes, OPTIONS);
  assert.deepEqual(counts, [0, 0, 0, 1]);
  assert.equal(total, 1);
});

test('formatCountdown incluye los segundos restantes', () => {
  assert.match(formatCountdown(42), /42s/);
});

test('formatResults calcula porcentajes sobre el total de votos', () => {
  const question = { options: OPTIONS };
  const text = formatResults(question, [3, 1, 0, 0], 4, 0);
  assert.match(text, /Madrid — 75% \(3\)/);
  assert.match(text, /Barcelona — 25% \(1\)/);
  assert.match(text, /✅ Madrid/);
  assert.match(text, /Total de votos: 4/);
});

test('formatResults avisa si nadie ha votado', () => {
  const question = { options: OPTIONS };
  const text = formatResults(question, [0, 0, 0, 0], 0, 2);
  assert.match(text, /Nadie ha votado esta vez\./);
});

test('formatResults incluye la categoría con su color', () => {
  const question = { options: OPTIONS, category: 'Ciencia' };
  const text = formatResults(question, [0, 0, 0, 0], 0, 2);
  assert.match(text, new RegExp(`^${CATEGORY_COLORS.Ciencia} Ciencia`));
});

test('formatPollQuestion antepone el color de la categoría a la pregunta', () => {
  const question = { question: '¿Cuál es la capital de Francia?', category: 'Geografía' };
  const text = formatPollQuestion(question);
  assert.equal(text, `${CATEGORY_COLORS.Geografía} Geografía\n¿Cuál es la capital de Francia?`);
});

test('formatResults incluye la dificultad junto a la categoría', () => {
  const question = { options: OPTIONS, category: 'Ciencia', difficulty: 'difícil' };
  const text = formatResults(question, [0, 0, 0, 0], 0, 2);
  assert.match(text, new RegExp(`^${CATEGORY_COLORS.Ciencia} Ciencia \\(Difícil\\)`));
});

test('formatPollQuestion incluye la dificultad junto a la categoría', () => {
  const question = { question: '¿Cuál es la capital de Francia?', category: 'Geografía', difficulty: 'fácil' };
  const text = formatPollQuestion(question);
  assert.equal(
    text,
    `${CATEGORY_COLORS.Geografía} Geografía (Fácil)\n¿Cuál es la capital de Francia?`,
  );
});

test('tallyVotes usa localId como respaldo cuando falta el nombre de la opción', () => {
  const votes = [{ selectedOptions: [{ name: undefined, localId: 2 }] }];
  const { counts, total } = tallyVotes(votes, OPTIONS);
  assert.deepEqual(counts, [0, 0, 1, 0]);
  assert.equal(total, 1);
});

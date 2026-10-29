const fs = require('fs');
const path = require('path');

// Un color (círculo emoji) fijo por categoría, para que se distinga de un vistazo
// qué tipo de pregunta es sin depender de leer el texto.
const CATEGORY_COLORS = {
  Ciencia: '🔵',
  Historia: '🟤',
  Geografía: '🟢',
  Arte: '🟣',
  Deportes: '🟠',
  Literatura: '🟡',
  Música: '⚫',
  Cine: '🔴',
  'Cultura general': '⚪',
  Disney: '🏰',
};
const DEFAULT_CATEGORY_COLOR = '⚪';

function loadTriviaQuestions(contentDir) {
  return JSON.parse(fs.readFileSync(path.join(contentDir, 'trivia.json'), 'utf8'));
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function formatCategoryLine(question) {
  const color = CATEGORY_COLORS[question.category] || DEFAULT_CATEGORY_COLOR;
  const difficulty = question.difficulty ? ` (${capitalize(question.difficulty)})` : '';
  return `${color} ${question.category}${difficulty}`;
}

function formatPollQuestion(question) {
  return `${formatCategoryLine(question)}\n${question.question}`;
}

function tallyVotes(pollVotes, options) {
  const counts = options.map(() => 0);
  let total = 0;
  for (const vote of pollVotes) {
    for (const selected of vote.selectedOptions || []) {
      const index =
        selected.name !== undefined
          ? options.indexOf(selected.name)
          : selected.localId;
      if (index !== -1 && index !== undefined && counts[index] !== undefined) {
        counts[index]++;
        total++;
      }
    }
  }
  return { counts, total };
}

function formatCountdown(secondsLeft) {
  return `⏳ Trivia en marcha: quedan ${secondsLeft}s para votar en la encuesta de arriba.`;
}

function formatResults(question, counts, total, correctIndex) {
  const lines = question.options.map((option, index) => {
    const pct = total > 0 ? Math.round((counts[index] / total) * 100) : 0;
    const mark = index === correctIndex ? '✅' : '▫️';
    return `${mark} ${option} — ${pct}% (${counts[index]})`;
  });
  return [
    formatCategoryLine(question),
    `📊 ¡Tiempo! La respuesta correcta era: ${question.options[correctIndex]}`,
    '',
    ...lines,
    '',
    total > 0 ? `Total de votos: ${total}` : 'Nadie ha votado esta vez.',
  ].join('\n');
}

module.exports = {
  loadTriviaQuestions,
  tallyVotes,
  formatCountdown,
  formatResults,
  formatPollQuestion,
  CATEGORY_COLORS,
};

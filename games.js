const fs = require('fs');
const path = require('path');

function flipCoin() {
  return Math.random() < 0.5 ? 'cara' : 'cruz';
}

function rollDice() {
  return 1 + Math.floor(Math.random() * 6);
}

function formatCoinResult(result) {
  return `🪙 La moneda cae... ¡${result}!`;
}

function formatDiceResult(roll) {
  return `🎲 Ha salido un... ¡${roll}!`;
}

const PPT_OPTIONS = ['piedra', 'papel', 'tijera'];
const PPT_EMOJI = { piedra: '🪨', papel: '📄', tijera: '✂️' };
// Qué gana a qué: la clave gana a su valor.
const PPT_BEATS = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' };

function normalizePptChoice(text) {
  const normalized = (text || '').trim().toLowerCase();
  return PPT_OPTIONS.includes(normalized) ? normalized : null;
}

function playPpt(userChoice) {
  const botChoice = PPT_OPTIONS[Math.floor(Math.random() * PPT_OPTIONS.length)];
  let result;
  if (userChoice === botChoice) result = 'empate';
  else if (PPT_BEATS[userChoice] === botChoice) result = 'gana';
  else result = 'pierde';
  return { botChoice, result };
}

function formatPptResult(userChoice, botChoice, result) {
  const resultLine =
    result === 'empate' ? '🤝 ¡Empate!' : result === 'gana' ? '🎉 ¡Ganas tú!' : '🤖 ¡Gano yo!';
  return [
    `${PPT_EMOJI[userChoice]} Tú: ${userChoice}`,
    `${PPT_EMOJI[botChoice]} Yo: ${botChoice}`,
    resultLine,
  ].join('\n');
}

function loadTarotCards(contentDir) {
  return JSON.parse(fs.readFileSync(path.join(contentDir, 'tarot.json'), 'utf8'));
}

function loadEmojiQuestions(contentDir) {
  return JSON.parse(fs.readFileSync(path.join(contentDir, 'emoji.json'), 'utf8'));
}

function formatEmojiPollQuestion(question) {
  return `🎭 Adivina con los emojis:\n${question.clue}`;
}

function formatEmojiResults(question, counts, total, correctIndex) {
  const lines = question.options.map((option, index) => {
    const pct = total > 0 ? Math.round((counts[index] / total) * 100) : 0;
    const mark = index === correctIndex ? '✅' : '▫️';
    return `${mark} ${option} — ${pct}% (${counts[index]})`;
  });
  return [
    `📊 ¡Tiempo! La respuesta correcta era: ${question.options[correctIndex]}`,
    '',
    ...lines,
    '',
    total > 0 ? `Total de votos: ${total}` : 'Nadie ha votado esta vez.',
  ].join('\n');
}

function loadTrivialPlusQuestions(contentDir) {
  return JSON.parse(fs.readFileSync(path.join(contentDir, 'trivialplus.json'), 'utf8'));
}

// Mismo límite de contenido que /avispa: se nombran los actos/preferencias
// directamente, nunca se describen gráficamente. Se avisa siempre del contenido +18
// al principio de la pregunta, ya que la encuesta es visible para todo el grupo.
// No es trivia (no hay respuesta "correcta"): es una encuesta de preferencias, y al
// acabar el tiempo se destaca la opción más votada por el grupo.
function formatTrivialPlusPollQuestion(question) {
  return `🌶️ Trivial+ (encuesta +18):\n${question.question}`;
}

function formatTrivialPlusResults(question, counts, total) {
  const maxCount = Math.max(...counts);
  const winners = question.options.filter((_, index) => maxCount > 0 && counts[index] === maxCount);
  const lines = question.options.map((option, index) => {
    const pct = total > 0 ? Math.round((counts[index] / total) * 100) : 0;
    const mark = maxCount > 0 && counts[index] === maxCount ? '🏆' : '▫️';
    return `${mark} ${option} — ${pct}% (${counts[index]})`;
  });
  const headline =
    winners.length === 0
      ? '📊 ¡Tiempo!'
      : winners.length === 1
        ? `📊 ¡Tiempo! La opción más votada: ${winners[0]}`
        : `📊 ¡Tiempo! Empate entre: ${winners.join(' y ')}`;
  return [
    headline,
    '',
    ...lines,
    '',
    total > 0 ? `Total de votos: ${total}` : 'Nadie ha votado esta vez.',
  ].join('\n');
}

module.exports = {
  flipCoin,
  rollDice,
  formatCoinResult,
  formatDiceResult,
  PPT_OPTIONS,
  normalizePptChoice,
  playPpt,
  formatPptResult,
  loadTarotCards,
  loadEmojiQuestions,
  formatEmojiPollQuestion,
  formatEmojiResults,
  loadTrivialPlusQuestions,
  formatTrivialPlusPollQuestion,
  formatTrivialPlusResults,
};

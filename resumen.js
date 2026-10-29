const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const BASE_SYSTEM_INSTRUCTION =
  'Eres un asistente que resume conversaciones de un grupo de WhatsApp en español. ' +
  'No inventes nada que no esté en la conversación.';

// Instrucción añadida según el tipo de resumen pedido. Para el modo "tema" se combina
// con la instrucción del tema (ver buildSystemInstruction) si además se pidió un tipo.
const MODE_INSTRUCTIONS = {
  normal: 'Sé claro y breve, destaca los temas principales, decisiones tomadas y cualquier cosa importante.',
  corto: 'Hazlo muy breve: 2-3 frases como mucho, solo lo más importante.',
  largo: 'Hazlo detallado: no omitas matices, puedes usar varios párrafos o puntos si hace falta.',
  tareas: 'Céntrate solo en decisiones tomadas, tareas pendientes y acuerdos concretos. Ignora la charla informal sin relevancia.',
};

function buildSystemInstruction(mode) {
  if (mode.type === 'tema') {
    const styleInstruction = mode.style ? MODE_INSTRUCTIONS[mode.style] : '';
    return (
      `${BASE_SYSTEM_INSTRUCTION} Céntrate únicamente en los mensajes relacionados con "${mode.topic}"; ` +
      'ignora por completo el resto de la conversación (saludos, charla sin relación, etc.), sé tú quien ' +
      'decida qué mensajes tienen que ver con ese tema y cuáles no. Si no encuentras nada relacionado, ' +
      `dilo claramente en vez de inventar.${styleInstruction ? ` ${styleInstruction}` : ''}`
    );
  }
  return `${BASE_SYSTEM_INSTRUCTION} ${MODE_INSTRUCTIONS[mode.type] || MODE_INSTRUCTIONS.normal}`;
}

// Descartamos comandos ("/algo") y las propias frases de la Abejita (empiezan por 🐝)
// para que el resumen no se contamine con ruido del propio bot.
function isBotNoise(body) {
  if (!body) return true;
  const trimmed = body.trim();
  if (trimmed.startsWith('/')) return true;
  if (trimmed.startsWith('🐝')) return true;
  return false;
}

function buildTranscript(entries) {
  return entries.map((entry) => `${entry.name}: ${entry.body}`).join('\n');
}

const TIME_UNIT_MS = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

// Interpreta solo la parte de rango: un número a secas es cantidad de mensajes
// ("100"), un número + m/h/d es un rango de tiempo ("2h", "3d").
// Devuelve null si no se reconoce el formato.
function parseResumenArg(arg) {
  if (!arg) return null;
  const trimmed = arg.trim().toLowerCase();
  const timeMatch = trimmed.match(/^(\d+)(m|h|d)$/);
  if (timeMatch) {
    const amount = parseInt(timeMatch[1], 10);
    if (amount <= 0) return null;
    return { type: 'time', ms: amount * TIME_UNIT_MS[timeMatch[2]] };
  }
  const countMatch = trimmed.match(/^(\d+)$/);
  if (countMatch) {
    const amount = parseInt(countMatch[1], 10);
    if (amount <= 0) return null;
    return { type: 'count', value: amount };
  }
  return null;
}

const MODE_KEYWORDS = new Set(['corto', 'largo', 'tareas']);
const QUOTED_TOPIC_RE = /"([^"]*)"/;

// Sintaxis completa de /resumen y /resumengrupo: [tipo] ["tema"] [rango], en ese
// orden fijo. El tipo (corto/largo/tareas) es una palabra reservada opcional; el tema
// va siempre entre comillas para que no haya ambigüedad con el resto del texto; el
// rango (n | nh | nd) va siempre al final si se indica. Cualquier combinación de los
// tres es válida (incluidas todas vacías). Devuelve null si el texto no encaja con
// esta gramática (p.ej. texto suelto sin comillas que no sea una palabra reservada).
function parseResumenCommand(arg) {
  const trimmed = (arg || '').trim();
  if (!trimmed) return { parsedArg: null, mode: { type: 'normal' } };

  let rest = trimmed;
  let topic = null;
  const quoteMatch = rest.match(QUOTED_TOPIC_RE);
  if (quoteMatch) {
    topic = quoteMatch[1].trim() || null;
    rest = (rest.slice(0, quoteMatch.index) + rest.slice(quoteMatch.index + quoteMatch[0].length)).trim();
  }

  const tokens = rest.split(/\s+/).filter(Boolean);

  let parsedArg = null;
  if (tokens.length > 0) {
    const maybeRange = parseResumenArg(tokens[tokens.length - 1]);
    if (maybeRange) {
      parsedArg = maybeRange;
      tokens.pop();
    }
  }

  let modeType = 'normal';
  if (tokens.length > 0) {
    const keyword = tokens.join(' ').toLowerCase();
    if (!MODE_KEYWORDS.has(keyword)) return null;
    modeType = keyword;
  }

  const mode = topic ? { type: 'tema', topic, style: modeType !== 'normal' ? modeType : undefined } : { type: modeType };
  return { parsedArg, mode };
}

// Errores con un .code para que el llamante pueda dar un mensaje específico en vez de
// uno genérico: 'auth' (clave inválida), 'quota' (cuota agotada), 'not_found' (modelo
// inexistente), 'blocked' (filtros de seguridad de Gemini) o 'unknown'.
class GeminiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
  }
}

function codeForStatus(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'quota';
  if (status === 404) return 'not_found';
  return 'unknown';
}

async function summarizeTranscript(transcript, apiKey, mode) {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemInstruction(mode || { type: 'normal' }) }] },
      contents: [{ parts: [{ text: `Resume esta conversación:\n\n${transcript}` }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new GeminiError(`Gemini respondió ${response.status}: ${errorText}`, codeForStatus(response.status));
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  if (!candidate) {
    const blockReason = data.promptFeedback && data.promptFeedback.blockReason;
    throw new GeminiError(`Gemini no devolvió respuesta (blockReason: ${blockReason || 'desconocido'})`, 'blocked');
  }
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
    throw new GeminiError('Gemini bloqueó la respuesta por sus filtros de contenido', 'blocked');
  }

  const part = candidate.content && candidate.content.parts && candidate.content.parts[0];
  if (!part || !part.text) {
    throw new GeminiError('Gemini no devolvió texto', 'empty');
  }
  return part.text.trim();
}

module.exports = {
  isBotNoise,
  buildTranscript,
  parseResumenArg,
  parseResumenCommand,
  buildSystemInstruction,
  summarizeTranscript,
  GeminiError,
  GEMINI_MODEL,
  GEMINI_API_URL,
};

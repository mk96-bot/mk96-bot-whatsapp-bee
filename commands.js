const fs = require('fs');
const path = require('path');

// Orden de los comandos visibles (no secretos) pensado para que el listado tenga un
// hilo: /melon siempre primero (abre el tema), luego la escala picante (abeja →
// avispa, siempre juntas), después los comandos de "hacer algo" con el grupo (caña →
// reto → confesion), y cierra con utilidad/random (elige → dato → plan).
// Los comandos secretos van al final con su propio hilo aparte: /hola primero (abre
// la sección), luego los dirigidos a ti (piropo → picame, cumplido vs. pulla) y
// cierra con predicciones/consejo (consejo → suerte → destino).
const MELON_COMMANDS = {
  '/melon': 'melon.json',
  '/abeja': 'picame.json',
  '/avispa': 'avispa.json',
  '/caña': 'cana.json',
  '/reto': 'reto.json',
  '/confesion': 'confesion.json',
  '/elige': 'elige.json',
  '/dato': 'dato.json',
  '/plan': 'plan.json',
  '/hola': 'hola.json',
  '/adios': 'adios.json',
  '/piropo': 'piropo.json',
  '/picame': 'aguijon.json',
  '/consejo': 'consejo.json',
  '/suerte': 'suerte.json',
  '/destino': 'destino.json',
};

const MELON_DESCRIPTIONS = {
  '/melon': 'un tema de charla para romper el hielo',
  '/abeja': 'picante pero no mucho',
  '/avispa': 'cuidado que esta pica más fuerte',
  '/caña': 'un tema polémico para discutir',
  '/reto': 'un reto para hacer en el grupo',
  '/confesion': 'a veces suave, a veces sin filtros',
  '/elige': '¿qué prefieres? mezcla de simple y burrada',
  '/dato': 'un dato curioso random',
  '/plan': 'una idea de plan para hacer con el grupo',
  '/hola': 'saludo personalizado',
  '/adios': 'despedida personalizada',
  '/piropo': 'un piropo random dirigido a ti',
  '/picame': 'una pulla cariñosa, todo en broma',
  '/consejo': 'un consejo random, serio o no tanto',
  '/suerte': 'una predicción de buena suerte para ti',
  '/destino': 'un horóscopo disparatado del día',
};

// Emoji por comando: se muestra en los listados (/ayuda, /presentate) separado con un
// guión para que quede claro que no forma parte del texto del comando. Pendiente para
// el futuro: permitir lanzar el comando también como "/" + este emoji, no solo con el
// texto (p.ej. "/🐝" equivalente a "/abeja").
const MELON_EMOJIS = {
  '/melon': '🍈',
  '/abeja': '🐝',
  '/avispa': '🌶️',
  '/caña': '🔥',
  '/reto': '🕸️',
  '/confesion': '🤫',
  '/elige': '🤔',
  '/dato': '🧠',
  '/plan': '📅',
  '/hola': '👋',
  '/adios': '🚪',
  '/piropo': '😘',
  '/picame': '😜',
  '/consejo': '💡',
  '/suerte': '🍀',
  '/destino': '🔮',
};

function isMelonCommand(command) {
  return Object.prototype.hasOwnProperty.call(MELON_COMMANDS, command);
}

// Alias de emoji: cada comando se puede lanzar también como "/" + su emoji asignado
// (p.ej. "/🐝" equivalente a "/abeja"). Solo se sustituye la primera palabra del
// mensaje, así que "/🐝" o "/✂️ piedra" funcionan igual que su versión en texto.
function resolveEmojiAlias(rawCommand, emojiToCommand) {
  const spaceIndex = rawCommand.indexOf(' ');
  const firstToken = spaceIndex === -1 ? rawCommand : rawCommand.slice(0, spaceIndex);
  const rest = spaceIndex === -1 ? '' : rawCommand.slice(spaceIndex);
  if (!firstToken.startsWith('/')) return rawCommand;
  const resolvedCommand = emojiToCommand[firstToken.slice(1)];
  return resolvedCommand ? `${resolvedCommand}${rest}` : rawCommand;
}

function loadMelonItems(contentDir, command) {
  const filePath = path.join(contentDir, MELON_COMMANDS[command]);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  MELON_COMMANDS,
  MELON_DESCRIPTIONS,
  MELON_EMOJIS,
  isMelonCommand,
  loadMelonItems,
  resolveEmojiAlias,
};

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const {
  MELON_COMMANDS,
  MELON_DESCRIPTIONS,
  MELON_EMOJIS,
  isMelonCommand,
  loadMelonItems,
  resolveEmojiAlias,
} = require('./commands');
const { loadState, saveState, pickNext, resetChatState } = require('./state');
const { loadAllowedChats, saveAllowedChats, loadAliases, saveAliases } = require('./config');
const { recordCall, msUntilAllowed, formatRemaining } = require('./ratelimit');
const { loadStats, saveStats, incrementUsage, resetChatStats } = require('./stats');
const { loadTriviaQuestions, tallyVotes, formatCountdown, formatResults, formatPollQuestion } = require('./trivia');
const {
  flipCoin,
  rollDice,
  formatCoinResult,
  formatDiceResult,
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
} = require('./games');
const {
  resolveGenre,
  listGenres,
  pickRandomGenre,
  loadRecommendations,
  filterByGenre,
  formatRecommendation,
} = require('./recommendations');
const { isBotNoise, buildTranscript, parseResumenCommand, summarizeTranscript, GeminiError } = require('./resumen');

const QR_SERVER_PORT = process.env.QR_SERVER_PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const RESUMEN_DEFAULT_LIMIT = 200;
const RESUMEN_MAX_LIMIT = 500;
// Para "/resumen 2h" o "/resumen 3d" no sabemos de antemano cuántos mensajes hacen
// falta para cubrir ese rango, así que vamos pidiendo tandas cada vez más grandes
// (fetchMessages ya pagina hacia atrás solo) hasta cubrir el rango o llegar a este tope.
const RESUMEN_MAX_TIME_FETCH = 3000;
const AUTH_DATA_PATH = path.join(__dirname, '.wwebjs_auth');
const CONTENT_SOURCE_DIR = path.join(__dirname, 'content');
const CONTENT_DIR = path.join(__dirname, 'data', 'content');
const ALLOWED_CHATS_PATH = path.join(__dirname, 'data', 'allowed-chats.json');
const ALIASES_PATH = path.join(__dirname, 'data', 'aliases.json');
const STATE_PATH = path.join(__dirname, 'data', 'seen-state.json');
const STATS_PATH = path.join(__dirname, 'data', 'stats.json');
const ADMIN_CHAT_PATH = path.join(__dirname, 'data', 'admin-chat.json');
const ADMIN_GROUP_NAME = 'whats-management';
// Un grupo recién creado (o incluso con un mensaje reciente) puede tardar en aparecer
// en client.getChats() mientras WhatsApp Web sincroniza. Reintentamos con esperas
// crecientes antes de asumir que no existe y crear uno nuevo, para no duplicar grupos.
const ADMIN_GROUP_RETRY_DELAYS_MS = [3000, 5000, 10000, 15000, 20000];
// En grupos (menos el de administración) limitamos un comando de melón cada 5 minutos,
// para evitar que mucha gente a la vez sature el grupo pidiendo comandos de golpe. Los
// comandos secretos (hola, adios, piropo...) quedan fuera de este límite porque son
// respuestas puntuales a la gente, no el "dame algo random" que este límite regula.
const MELON_GROUP_COOLDOWN_MS = 20 * 1000;
// Aviso de "tienes que esperar": como mucho uno por minuto y por chat, para no
// contestar ese mismo mensaje cada vez que alguien insiste con el comando de golpe.
const RATE_LIMIT_NOTICE_COOLDOWN_MS = 5 * 1000;
const TRIVIA_ROUND_SECONDS = 60;
// Espera antes de reintentar tras un fallo de initialize(), para no entrar en un
// bucle cerrado de destroy→create→initialize si el fallo es persistente (ver reinitialize).
const REINITIALIZE_RETRY_DELAY_MS = 10 * 1000;

// content/ en el repo es la lista que editamos; en cada arranque se sincroniza tal cual
// a data/content (dentro del volumen persistente), que es de donde lee el bot en tiempo
// de ejecución. Así, editar content/*.json y redesplegar siempre aplica los cambios.
function syncContentDir() {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  for (const fileName of fs.readdirSync(CONTENT_SOURCE_DIR)) {
    fs.copyFileSync(path.join(CONTENT_SOURCE_DIR, fileName), path.join(CONTENT_DIR, fileName));
  }
  console.log('Contenido sincronizado en data/content.');
}

syncContentDir();
const allowedChats = loadAllowedChats(ALLOWED_CHATS_PATH);
const aliases = loadAliases(ALIASES_PATH);

// Los alias son un atajo para no tener que copiar el ID largo de WhatsApp cada vez que
// se conecta/desconecta un chat: se guardan en minúsculas y sin espacios de sobra, y
// /conecta y /desconecta aceptan tanto el alias como el ID real.
function normalizeAlias(alias) {
  return (alias || '').trim().toLowerCase();
}

function resolveAliasOrId(input) {
  const normalized = normalizeAlias(input);
  return Object.prototype.hasOwnProperty.call(aliases, normalized) ? aliases[normalized] : input;
}

function aliasForId(id) {
  return Object.keys(aliases).find((alias) => aliases[alias] === id) || null;
}

// /caña existe y funciona con normalidad, pero para esta primera versión no lo anunciamos
// en /ayuda ni /presentate — sigue siendo un comando "secreto" para quien ya lo conozca.
const HIDDEN_FROM_LISTINGS = ['/caña'];
// Estos aparecen listados en /ayuda y /presentate, pero sin revelar qué hacen realmente.
const SECRET_COMMANDS = new Set(['/hola', '/adios', '/piropo', '/consejo', '/picame']);
const SECRET_COMMANDS_HEADER = '🤫 Comandos secretos ¿?:';

// /destino y /suerte usan la misma mecánica de "frase random de una lista" que el resto
// de comandos de melón (MELON_COMMANDS/pickNext), pero se muestran en su propia sección
// "Predicciones" junto a /tarot en vez de en "abre-melón" ni en "secretos".
const PREDICTIONS_COMMANDS = new Set(['/destino', '/suerte']);

function visibleMelonCommands() {
  return Object.keys(MELON_COMMANDS).filter((command) => !HIDDEN_FROM_LISTINGS.includes(command));
}

function nonSecretVisibleCommands() {
  return visibleMelonCommands().filter(
    (command) => !SECRET_COMMANDS.has(command) && !PREDICTIONS_COMMANDS.has(command),
  );
}

function secretVisibleCommands() {
  return visibleMelonCommands()
    .filter((command) => SECRET_COMMANDS.has(command))
    .map((command) => `${command} - ${MELON_EMOJIS[command]}`);
}

// Sección aparte para minijuegos (encuestas, dados, piedra-papel-tijera...), separada
// de los comandos de melón porque no dan una frase random sino que son una mecánica.
const GAMES_HEADER = '🎮 Comandos de juegos:';
const GAMES = [
  { command: '/trivial', emoji: '❓', description: 'una pregunta de cultura general con 4 opciones' },
  { command: '/moneda', emoji: '🪙', description: 'cara o cruz' },
  { command: '/dado', emoji: '🎲', description: 'tira un dado del 1 al 6' },
  { command: '/ppt', emoji: '✂️', description: 'juega con (/ppt piedra, /ppt papel, /ppt tijera)' },
  { command: '/emoji', emoji: '🎭', description: 'adivina la peli a partir de unos emojis, encuesta con 4 opciones' },
  { command: '/trivialplus', emoji: '😈', description: 'encuesta +18 de preferencias (mismo rollo que /avispa), gana la opción más votada' },
];
const GAME_LINES = GAMES.map((game) => `${game.command} - ${game.emoji} — ${game.description}`);

// Predicciones: tarot (mecánica propia, ver games.js) + destino y suerte (mecánica de
// melón, MELON_DESCRIPTIONS/MELON_EMOJIS), unificados aquí solo a efectos de menú.
const PREDICTIONS_HEADER = '🔮 Predicciones:';
const PREDICTIONS = [
  { command: '/tarot', emoji: '🎴', description: 'saca una carta del tarot con su significado' },
  { command: '/destino', emoji: MELON_EMOJIS['/destino'], description: MELON_DESCRIPTIONS['/destino'] },
  { command: '/suerte', emoji: MELON_EMOJIS['/suerte'], description: MELON_DESCRIPTIONS['/suerte'] },
];
const PREDICTIONS_LINES = PREDICTIONS.map((p) => `${p.command} - ${p.emoji} — ${p.description}`);

// Recomendaciones: piden un género como argumento (p.ej. "/peliculas accion"), así que
// no llevan alias de emoji (el emoji no puede llevar el género pegado).
const RECOMMENDATIONS_HEADER = '🎬 Comandos de recomendación:';
const RECOMMENDATION_TYPES = [
  { command: '/peliculas', type: 'peliculas', emoji: '🎬', label: 'una película' },
  { command: '/libros', type: 'libros', emoji: '📚', label: 'un libro' },
  { command: '/musica', type: 'musica', emoji: '🎵', label: 'una canción' },
];
// Con tantos géneros por tipo ya no caben todos en la línea del menú: se explica el
// uso (con género, sin género = al azar, o "?" para ver la lista) en vez de listarlos.
const RECOMMENDATION_LINES = RECOMMENDATION_TYPES.map(
  (rec) =>
    `${rec.command} [género] - ${rec.emoji} — recomienda ${rec.label}; sin género elige uno al azar, "${rec.command} ?" lista los géneros`,
);

// Mapa emoji → comando para el alias de emoji (ver resolveEmojiAlias en commands.js):
// junta los emojis de los comandos de melón con los de juegos y predicciones.
const EMOJI_TO_COMMAND = {};
for (const [command, emoji] of Object.entries(MELON_EMOJIS)) {
  EMOJI_TO_COMMAND[emoji] = command;
}
for (const game of [...GAMES, ...PREDICTIONS]) {
  EMOJI_TO_COMMAND[game.emoji] = game.command;
}

function buildHelpText() {
  const lines = nonSecretVisibleCommands().map(
    (command) => `${command} - ${MELON_EMOJIS[command]} — ${MELON_DESCRIPTIONS[command]}`,
  );
  const secretCommands = secretVisibleCommands();
  return [
    '🍈 Comandos de abre-melón:',
    ...lines,
    '',
    PREDICTIONS_HEADER,
    ...PREDICTIONS_LINES,
    '',
    GAMES_HEADER,
    ...GAME_LINES,
    '',
    RECOMMENDATIONS_HEADER,
    ...RECOMMENDATION_LINES,
    '',
    ...(secretCommands.length ? [SECRET_COMMANDS_HEADER, ...secretCommands, ''] : []),
    'Cada comando te da algo al azar de esa categoría, sin repetir hasta agotar la lista. Escríbelo tal cual, sin nada más.',
  ].join('\n');
}

function buildConnectAnnouncement() {
  return '🐝 ¡Llegó la Abejita Zumbona! Empieza la polinización 🌼. Escribe /ayuda o /presentate si quieres más información.';
}

function buildDisconnectAnnouncement() {
  return '🐝 La Abejita Zumbona se despide de este chat, ¡buzz, buzz! Recordad que no es bueno picar... mucho. 👋';
}

function buildRateLimitedText(remainingMs) {
  return `🐝 Perdón, perdón... la Abejita Zumbona está agotada de tanto polinizar, necesita descansar: Hay que esperar ${formatRemaining(remainingMs)} más.`;
}

// Antepone abeja + bocadillo de cómic a las frases de melón/secretos, para que se
// distinga a simple vista que habla la Abejita Zumbona y no la persona del chat.
function formatBeeSpeech(text) {
  return `🐝💬\n${text}`;
}

// Traduce los errores tipados de resumen.js (GeminiError.code) a un mensaje concreto
// en vez del genérico "ha habido un problema", para saber si hay que revisar la clave,
// esperar a que se renueve la cuota gratuita, o si el propio tema pedido chocó con los
// filtros de contenido de Gemini.
function describeResumenError(err) {
  const code = err instanceof GeminiError ? err.code : null;
  if (code === 'auth') return 'La clave de Gemini no es válida o ha caducado. Revisa GEMINI_API_KEY.';
  if (code === 'quota') return 'Se ha agotado la cuota gratuita de Gemini por ahora. Prueba otra vez más tarde.';
  if (code === 'not_found') return 'El modelo de Gemini configurado ya no existe. Hay que actualizar GEMINI_MODEL en resumen.js.';
  if (code === 'blocked') return 'Gemini ha bloqueado la respuesta por sus filtros de contenido (puede pasar con temas sensibles).';
  return 'Ha habido un problema generando el resumen. Inténtalo más tarde.';
}

function buildAdminHelpText() {
  return [
    '🛠️ Comandos de administración:',
    '/grupos ["texto"] — lista tus grupos, o filtra por nombre parcial',
    '/chats ["texto"] — lista tus chats 1:1, o filtra por nombre parcial',
    '/alias <alias> <id> — le pone un alias a un chat o grupo para no tener que usar el ID',
    '/alias — lista los alias guardados',
    '/desalias <alias> — elimina un alias',
    '/conecta <id o alias> — autoriza un chat o grupo para usar los comandos de melón',
    '/desconecta <id o alias> — retira la autorización a un chat o grupo',
    '/conexiones — lista los chats actualmente conectados',
    '/limpia — vacía los mensajes de este grupo',
    '/estadisticas — uso de comandos por chat',
    '/resetestadisticas <id o alias> | todo — reinicia las estadísticas de un chat, o de todos',
    '/resetmemoria <id o alias> | todo — olvida qué frases/recomendaciones ya se dieron en un chat, o en todos',
    `/resumen [corto|largo|tareas] ["tema"] [n | nh | nd] — resume con IA este chat (de momento solo aquí, en el grupo de administración; por defecto ${RESUMEN_DEFAULT_LIMIT} mensajes, máx. ${RESUMEN_MAX_LIMIT})`,
    '/resumengrupo <id o alias> [corto|largo|tareas] ["tema"] [n | nh | nd] — resume con IA cualquier chat, esté conectado o no',
  ].join('\n');
}

function buildIntroText() {
  const lines = nonSecretVisibleCommands().map(
    (command) => `${command} - ${MELON_EMOJIS[command]} — ${MELON_DESCRIPTIONS[command]}`,
  );
  const secretCommands = secretVisibleCommands();
  return [
    '🐝 ¡Bzzzz!, ¡bzzzz!, aquí llegó la Abejita Zumbona,',
    'que llega zumbando sin pedir corona.',
    'Si el silencio incómodo empieza a asomar,',
    'yo traigo melones pa\' animar.',
    '',
    'Este es mi menú, coge el que te pique:',
    '',
    ...lines,
    '',
    PREDICTIONS_HEADER,
    ...PREDICTIONS_LINES,
    '',
    GAMES_HEADER,
    ...GAME_LINES,
    '',
    RECOMMENDATIONS_HEADER,
    ...RECOMMENDATION_LINES,
    '',
    ...(secretCommands.length ? [SECRET_COMMANDS_HEADER, ...secretCommands, ''] : []),
    'Escríbelo tal cual, sin adornos ni lío,',
    'y te suelto uno al azar, que este panal es mío.',
    'No repito melón hasta agotar la cesta...',
    'así que dale caña, que la fiesta no cuesta. 🐝',
  ].join('\n');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadPersistedAdminChatId() {
  if (!fs.existsSync(ADMIN_CHAT_PATH)) return null;
  const data = JSON.parse(fs.readFileSync(ADMIN_CHAT_PATH, 'utf8'));
  return data.id || null;
}

function savePersistedAdminChatId(id) {
  fs.mkdirSync(path.dirname(ADMIN_CHAT_PATH), { recursive: true });
  fs.writeFileSync(ADMIN_CHAT_PATH, JSON.stringify({ id }, null, 2));
}

async function findAdminGroup(client) {
  try {
    const chats = await client.getChats();
    return chats.find((chat) => chat.isGroup && chat.name === ADMIN_GROUP_NAME) || null;
  } catch (err) {
    console.log(`No se pudo leer la lista de chats todavía (${err.message}).`);
    return null;
  }
}

async function resolveAdminChatId(client) {
  const persistedId = loadPersistedAdminChatId();
  if (persistedId) {
    console.log(`Grupo de administración (persistido): ${persistedId}`);
    return persistedId;
  }

  for (const ms of ADMIN_GROUP_RETRY_DELAYS_MS) {
    const existingGroup = await findAdminGroup(client);
    if (existingGroup) {
      console.log(`Grupo de administración encontrado: ${existingGroup.id._serialized}`);
      savePersistedAdminChatId(existingGroup.id._serialized);
      return existingGroup.id._serialized;
    }
    console.log(`Grupo "${ADMIN_GROUP_NAME}" no encontrado todavía, reintentando en ${ms / 1000}s...`);
    await delay(ms);
  }

  const existingGroup = await findAdminGroup(client);
  if (existingGroup) {
    console.log(`Grupo de administración encontrado: ${existingGroup.id._serialized}`);
    savePersistedAdminChatId(existingGroup.id._serialized);
    return existingGroup.id._serialized;
  }

  console.log(`Grupo "${ADMIN_GROUP_NAME}" no encontrado tras esperar, creándolo...`);
  const result = await client.createGroup(ADMIN_GROUP_NAME, []);
  const newGroupId = result.gid._serialized;
  await client.sendMessage(
    newGroupId,
    '🐝 Grupo de administración creado. Aquí se gestionará el bot (añadir chats, consultar chats, preguntas, etc).',
  );
  console.log(`Grupo de administración creado: ${newGroupId}`);
  savePersistedAdminChatId(newGroupId);
  return newGroupId;
}

function existsAsLinkOrFile(targetPath) {
  try {
    fs.lstatSync(targetPath);
    return true;
  } catch (err) {
    return false;
  }
}

function clearStaleChromiumLocks() {
  if (!fs.existsSync(AUTH_DATA_PATH)) return;
  for (const profileDir of fs.readdirSync(AUTH_DATA_PATH)) {
    for (const lockName of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      const lockPath = path.join(AUTH_DATA_PATH, profileDir, lockName);
      if (existsAsLinkOrFile(lockPath)) {
        fs.rmSync(lockPath, { force: true });
        console.log(`Lock de Chromium obsoleto eliminado: ${lockPath}`);
      }
    }
  }
}

let latestQrDataUrl = null;
let statusMessage = 'Esperando código QR...';

function createClient() {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      protocolTimeout: 120000,
    },
  });

  client.on('qr', async (qr) => {
    latestQrDataUrl = await QRCode.toDataURL(qr);
    statusMessage = 'QR listo, escanéalo desde WhatsApp';
    console.log(`Nuevo QR generado. Ábrelo en http://localhost:${QR_SERVER_PORT}`);
  });

  let myIds = new Set();
  let adminChatId = null;
  const lastMelonAt = new Map();
  const lastRateLimitNoticeAt = new Map();

  function shouldNotifyRateLimit(chatId, now) {
    const last = lastRateLimitNoticeAt.get(chatId);
    if (last !== undefined && now - last < RATE_LIMIT_NOTICE_COOLDOWN_MS) return false;
    lastRateLimitNoticeAt.set(chatId, now);
    return true;
  }

  // Comprueba el límite de "un comando de melón cada X" en grupos (ver
  // MELON_GROUP_COOLDOWN_MS); si toca esperar, avisa (con su propio cooldown) y
  // devuelve false para que el llamante corte aquí sin ejecutar el comando.
  async function checkMelonRateLimit(message, chatId) {
    const remainingMs = msUntilAllowed(lastMelonAt, chatId, Date.now(), MELON_GROUP_COOLDOWN_MS);
    if (remainingMs <= 0) return true;
    if (shouldNotifyRateLimit(chatId, Date.now())) {
      await message.reply(buildRateLimitedText(remainingMs));
    }
    return false;
  }

  // Patrón repetido en varios comandos de melón: guarda el uso en stats.json.
  function recordUsage(chatId, command) {
    saveStats(STATS_PATH, incrementUsage(loadStats(STATS_PATH), chatId, command));
  }

  // Patrón repetido en varios comandos de melón: elige el siguiente ítem sin repetir
  // (ver pickNext en state.js) y persiste el nuevo estado.
  function pickAndRemember(chatId, key, items) {
    const state = loadState(STATE_PATH);
    const { chosenItem, nextState } = pickNext(state, chatId, key, items);
    saveState(STATE_PATH, nextState);
    return chosenItem;
  }
  const activePollChats = new Set();
  // getPollVotes() consulta una tabla interna de WhatsApp Web que puede no estar
  // sincronizada justo al acabar la cuenta atrás. Escuchamos los votos en tiempo real
  // vía 'vote_update' y los guardamos aquí (por mensaje de encuesta -> último voto de
  // cada votante), en vez de depender solo de una consulta puntual al final.
  const livePollVotes = new Map();

  // WhatsApp Web renombró internamente `_serialized` a `$1` en las claves de mensaje;
  // según el objeto que cruce el puente de Puppeteer puede llegar con uno u otro nombre.
  function getSerializedKeyId(key) {
    return (key && (key._serialized || key.$1)) || undefined;
  }

  client.on('vote_update', (vote) => {
    try {
      const pollId =
        getSerializedKeyId(vote.parentMessage && vote.parentMessage.id) ||
        getSerializedKeyId(vote.parentMsgKey);
      if (!pollId) return;
      // Solo aceptamos el voto si la ronda para ese pollId sigue abierta (existe su
      // entrada en livePollVotes). Si ya se cerró (runTriviaRound la borró al acabar
      // la cuenta atrás), lo ignoramos en vez de recrear la entrada: así la ronda se
      // cierra de verdad y no queda escuchando votos para siempre en memoria.
      if (!livePollVotes.has(pollId)) return;
      livePollVotes.get(pollId).set(vote.voter, vote.selectedOptions);
    } catch (err) {
      console.error('Error procesando vote_update:', err);
    }
  });

  // Mecánica genérica de "encuesta con cuenta atrás y resultados", usada tanto por
  // /trivial como por /emoji: crea la Poll, cuenta atrás editando el mismo mensaje,
  // recoge los votos en vivo (con fallback a getPollVotes) y publica el resultado.
  async function runPollRound({ chatId, command, loadItems, formatQuestion, formatQuestionResults }) {
    const items = loadItems();
    const state = loadState(STATE_PATH);
    const { chosenItem: question, nextState } = pickNext(state, chatId, command, items);
    saveState(STATE_PATH, nextState);
    if (!question) return;

    const poll = new Poll(formatQuestion(question), question.options, { allowMultipleAnswers: false });
    const pollMessage = await client.sendMessage(chatId, poll);
    const pollId = pollMessage.id._serialized;
    livePollVotes.set(pollId, new Map());
    let secondsLeft = TRIVIA_ROUND_SECONDS;
    const countdownMessage = await client.sendMessage(chatId, formatCountdown(secondsLeft));

    while (secondsLeft > 0) {
      await delay(1000);
      secondsLeft--;
      if (secondsLeft > 0) {
        try {
          await countdownMessage.edit(formatCountdown(secondsLeft));
        } catch (err) {
          console.error('No se pudo editar la cuenta atrás de la encuesta:', err);
        }
      }
    }

    const voterMap = livePollVotes.get(pollId) || new Map();
    let votes = Array.from(voterMap.values()).map((selectedOptions) => ({ selectedOptions }));
    console.log('DEBUG votos en vivo recogidos:', JSON.stringify(votes));

    if (votes.length === 0) {
      try {
        votes = await client.getPollVotes(pollId);
        console.log('DEBUG votos vía getPollVotes (fallback):', JSON.stringify(votes));
      } catch (err) {
        console.error('No se pudieron obtener los votos de la encuesta (fallback):', err);
      }
    }
    livePollVotes.delete(pollId);

    const { counts, total } = tallyVotes(votes, question.options);
    const resultsText = formatQuestionResults(question, counts, total, question.correctIndex);
    try {
      await countdownMessage.edit(resultsText);
    } catch (err) {
      console.error('No se pudo editar el resultado final de la encuesta:', err);
      await client.sendMessage(chatId, resultsText);
    }

    recordUsage(chatId, command);
  }

  function runTriviaRound(chatId) {
    return runPollRound({
      chatId,
      command: '/trivial',
      loadItems: () => loadTriviaQuestions(CONTENT_DIR),
      formatQuestion: formatPollQuestion,
      formatQuestionResults: formatResults,
    });
  }

  function runEmojiRound(chatId) {
    return runPollRound({
      chatId,
      command: '/emoji',
      loadItems: () => loadEmojiQuestions(CONTENT_DIR),
      formatQuestion: formatEmojiPollQuestion,
      formatQuestionResults: formatEmojiResults,
    });
  }

  function runTrivialPlusRound(chatId) {
    return runPollRound({
      chatId,
      command: '/trivialplus',
      loadItems: () => loadTrivialPlusQuestions(CONTENT_DIR),
      formatQuestion: formatTrivialPlusPollQuestion,
      formatQuestionResults: formatTrivialPlusResults,
    });
  }

  client.on('ready', async () => {
    latestQrDataUrl = null;
    statusMessage = `Conectado como ${client.info.pushname}`;
    console.log(statusMessage);

    const myId = client.info.wid._serialized;
    myIds = new Set([myId]);
    try {
      const [{ lid, pn }] = await client.getContactLidAndPhone([myId]);
      if (lid) myIds.add(lid);
      if (pn) myIds.add(pn);
    } catch (err) {
      console.error('No se pudo resolver el lid propio:', err.message);
    }
    console.log('Identificadores propios:', [...myIds]);

    try {
      adminChatId = await resolveAdminChatId(client);
      await client.sendMessage(adminChatId, '✅ Bot conectado.');
    } catch (err) {
      console.error('No se pudo resolver el grupo de administración:', err);
    }

    for (const chatId of allowedChats) {
      try {
        await client.sendMessage(chatId, buildConnectAnnouncement());
      } catch (err) {
        console.error(`No se pudo avisar al chat ${chatId} de la reconexión:`, err.message);
      }
    }
  });

  client.on('disconnected', (reason) => {
    console.log(`Sesión desconectada (${reason}). Reiniciando cliente...`);
    reinitialize(client);
  });

  client.on('auth_failure', (message) => {
    console.log(`Fallo de autenticación (${message}). Reiniciando cliente...`);
    reinitialize(client);
  });

  function isSelfChat(message) {
    return message.fromMe && myIds.has(message.to);
  }

  function isAuthorizedChat(message) {
    const chatId = resolveChatId(message);
    return isSelfChat(message) || chatId === adminChatId || allowedChats.includes(chatId);
  }

  function resolveChatId(message) {
    return message.fromMe ? message.to : message.from;
  }

  function isAdminMessage(message) {
    return message.fromMe && resolveChatId(message) === adminChatId;
  }

  function normalizeForSearch(text) {
    const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
    return text.normalize('NFD').replace(COMBINING_DIACRITICS, '').toLowerCase();
  }

  function parseSearchTerm(command, commandName) {
    const rest = command.slice(commandName.length).trim();
    if (!rest) return null;
    const quoted = rest.match(/^"(.*)"$/);
    return quoted ? quoted[1] : rest;
  }

  async function findChatsBy({ isGroup, searchTerm }) {
    const chats = await client.getChats();
    let filtered = chats.filter((chat) => chat.isGroup === isGroup);
    if (searchTerm) {
      const needle = normalizeForSearch(searchTerm);
      filtered = filtered.filter((chat) => normalizeForSearch(chat.name || '').includes(needle));
    }
    return filtered;
  }

  async function resolveSenderName(message) {
    // Resolver el propio contacto (getContactById sobre uno mismo) falla en whatsapp-web.js
    // ("getAlternateUserWid - Invalid get call"), así que para tus propios mensajes usamos
    // directamente el nombre de la cuenta en vez de pasar por getContact().
    if (message.fromMe) {
      return client.info.pushname || 'amigo/a';
    }
    try {
      const contact = await message.getContact();
      // Solo el nombre que la otra persona se ha puesto ella misma en WhatsApp (pushname),
      // nunca el nombre con el que la tengamos guardada como contacto.
      return contact.pushname || contact.number || 'amigo/a';
    } catch (err) {
      console.error('No se pudo resolver el nombre del remitente:', err.message);
      return 'amigo/a';
    }
  }

  // Nombre para mostrar en confirmaciones de /resetestadisticas, /resetmemoria y
  // similares: nombre real del chat (si se puede resolver) + alias si tiene.
  async function describeTarget(targetId) {
    const alias = aliasForId(targetId);
    try {
      const chat = await client.getChatById(targetId);
      return alias ? `${chat.name} (${alias})` : chat.name;
    } catch {
      return alias ? `${targetId} (${alias})` : targetId;
    }
  }

  // Compartido entre /resumen (chat actual) y /resumengrupo (chat arbitrario, solo
  // admin): fetchMessages ya pagina hacia atrás sola cuando pides más de lo cargado,
  // así que para un rango de tiempo vamos doblando el límite hasta cubrirlo.
  async function fetchMessagesForResumen(chat, parsedArg) {
    if (parsedArg.type === 'count') {
      const limit = Math.min(parsedArg.value, RESUMEN_MAX_LIMIT);
      return chat.fetchMessages({ limit });
    }
    const cutoffSeconds = Math.floor((Date.now() - parsedArg.ms) / 1000);
    let limit = RESUMEN_DEFAULT_LIMIT;
    let rawMessages = [];
    while (limit <= RESUMEN_MAX_TIME_FETCH) {
      rawMessages = await chat.fetchMessages({ limit });
      const oldest = rawMessages[0];
      if (!oldest || oldest.timestamp <= cutoffSeconds || rawMessages.length < limit) break;
      limit *= 2;
    }
    return rawMessages.filter((m) => m.timestamp >= cutoffSeconds);
  }

  async function buildResumenSummary(chat, parsedArg, mode) {
    const rawMessages = await fetchMessagesForResumen(chat, parsedArg);
    const entries = [];
    for (const rawMessage of rawMessages) {
      if (isBotNoise(rawMessage.body)) continue;
      const name = await resolveSenderName(rawMessage);
      entries.push({ name, body: rawMessage.body });
    }
    if (entries.length === 0) return null;
    const transcript = buildTranscript(entries);
    return summarizeTranscript(transcript, GEMINI_API_KEY, mode);
  }

  client.on('message_create', async (message) => {
    try {
      await handleMessage(message);
    } catch (err) {
      console.error('Error procesando mensaje:', err);
    }
  });

  async function handleMessage(message) {
    const command = resolveEmojiAlias(message.body.trim(), EMOJI_TO_COMMAND);

    if (command === '/grupos' || command.startsWith('/grupos ')) {
      if (!isAdminMessage(message)) return;
      const searchTerm = parseSearchTerm(command, '/grupos');
      const groups = await findChatsBy({ isGroup: true, searchTerm });
      const lines = groups.map((g) => `${g.name}: ${g.id._serialized}`);
      const emptyMessage = searchTerm
        ? `No se encontró ningún grupo que contenga "${searchTerm}".`
        : 'No perteneces a ningún grupo.';
      await message.reply(lines.length ? lines.join('\n') : emptyMessage);
      return;
    }

    if (command === '/chats' || command.startsWith('/chats ')) {
      if (!isAdminMessage(message)) return;
      const searchTerm = parseSearchTerm(command, '/chats');
      const chats = await findChatsBy({ isGroup: false, searchTerm });
      const lines = chats.map((c) => `${c.name}: ${c.id._serialized}`);
      const emptyMessage = searchTerm
        ? `No se encontró ningún chat que contenga "${searchTerm}".`
        : 'No tienes chats 1:1.';
      await message.reply(lines.length ? lines.join('\n') : emptyMessage);
      return;
    }

    if (command === '/ayuda') {
      if (!isAuthorizedChat(message)) return;
      const text = isAdminMessage(message)
        ? buildHelpText() + '\n\n' + buildAdminHelpText()
        : buildHelpText();
      await message.reply(text);
      return;
    }

    if (command === '/presentate') {
      if (!isAuthorizedChat(message)) return;
      await message.reply(buildIntroText());
      return;
    }

    if (command === '/conecta' || command.startsWith('/conecta ')) {
      if (!isAdminMessage(message)) return;
      const rawInput = command.slice('/conecta'.length).trim();
      if (!rawInput) {
        await message.reply('Uso: /conecta <id o alias de chat o grupo>. Usa /grupos o /chats para encontrar el ID, o /alias para ponerle uno.');
        return;
      }
      const targetId = resolveAliasOrId(rawInput);
      if (allowedChats.includes(targetId)) {
        await message.reply(`Ese chat ya estaba conectado: ${targetId}`);
        return;
      }
      try {
        await client.sendMessage(targetId, buildConnectAnnouncement());
      } catch (err) {
        console.error('No se pudo enviar el mensaje de bienvenida:', err.message);
        await message.reply(`No he podido conectar con ese chat (¿el ID es correcto?): ${targetId}`);
        return;
      }
      allowedChats.push(targetId);
      saveAllowedChats(ALLOWED_CHATS_PATH, allowedChats);
      const connectedAlias = aliasForId(targetId);
      const aliasSuffix = connectedAlias ? ` (alias: ${connectedAlias})` : '';
      await message.reply(`✅ Conectado. Ese chat ya puede usar los comandos de melón: ${targetId}${aliasSuffix}`);
      return;
    }

    if (command === '/desconecta' || command.startsWith('/desconecta ')) {
      if (!isAdminMessage(message)) return;
      const rawInput = command.slice('/desconecta'.length).trim();
      if (!rawInput) {
        await message.reply('Uso: /desconecta <id o alias de chat o grupo>.');
        return;
      }
      const targetId = resolveAliasOrId(rawInput);
      const index = allowedChats.indexOf(targetId);
      if (index === -1) {
        await message.reply(`Ese chat no estaba conectado: ${targetId}`);
        return;
      }
      try {
        await client.sendMessage(targetId, buildDisconnectAnnouncement());
      } catch (err) {
        console.error('No se pudo enviar el mensaje de despedida:', err.message);
      }
      allowedChats.splice(index, 1);
      saveAllowedChats(ALLOWED_CHATS_PATH, allowedChats);
      await message.reply(`👋 Desconectado. Ese chat ya no puede usar los comandos de melón: ${targetId}`);
      return;
    }

    if (command === '/conexiones') {
      if (!isAdminMessage(message)) return;
      if (allowedChats.length === 0) {
        await message.reply('No hay ningún chat conectado ahora mismo.');
        return;
      }
      const chats = await client.getChats();
      const lines = allowedChats.map((id) => {
        const chat = chats.find((c) => c.id._serialized === id);
        const name = chat ? chat.name : '(nombre no disponible)';
        const alias = aliasForId(id);
        const aliasSuffix = alias ? ` (alias: ${alias})` : '';
        return `${name}: ${id}${aliasSuffix}`;
      });
      await message.reply(lines.join('\n'));
      return;
    }

    if (command === '/alias' || command.startsWith('/alias ')) {
      if (!isAdminMessage(message)) return;
      const rest = command.slice('/alias'.length).trim();
      if (!rest) {
        const lines = Object.entries(aliases).map(([alias, id]) => `${alias} → ${id}`);
        await message.reply(lines.length ? lines.join('\n') : 'No hay ningún alias guardado todavía.');
        return;
      }
      const [aliasArg, idArg] = rest.split(/\s+/);
      if (!idArg) {
        await message.reply('Uso: /alias <alias> <id de chat o grupo>. Usa /grupos o /chats para encontrar el ID.');
        return;
      }
      const alias = normalizeAlias(aliasArg);
      aliases[alias] = idArg;
      saveAliases(ALIASES_PATH, aliases);
      await message.reply(`✅ Alias guardado: ${alias} → ${idArg}`);
      return;
    }

    if (command === '/desalias' || command.startsWith('/desalias ')) {
      if (!isAdminMessage(message)) return;
      const aliasArg = command.slice('/desalias'.length).trim();
      if (!aliasArg) {
        await message.reply('Uso: /desalias <alias>.');
        return;
      }
      const alias = normalizeAlias(aliasArg);
      if (!Object.prototype.hasOwnProperty.call(aliases, alias)) {
        await message.reply(`Ese alias no existe: ${alias}`);
        return;
      }
      delete aliases[alias];
      saveAliases(ALIASES_PATH, aliases);
      await message.reply(`🗑️ Alias eliminado: ${alias}`);
      return;
    }

    if (command === '/limpia') {
      if (!isAdminMessage(message)) return;
      const chat = await client.getChatById(adminChatId);
      await chat.clearMessages();
      await message.reply('🐝 Grupo limpio. Zzzumba y a empezar de cero.');
      return;
    }

    if (command === '/estadisticas') {
      if (!isAdminMessage(message)) return;
      const stats = loadStats(STATS_PATH);
      // stats.json guarda { [chatId]: { [comando]: usos } } (ver stats.js), así que
      // aquí se desglosa por chat en vez de por comando, y ya no hace falta limitarse
      // a los comandos de melón: sale cualquier comando que se haya usado en cada chat.
      const chatEntries = Object.entries(stats).filter(([, counts]) => counts && typeof counts === 'object');

      if (chatEntries.length === 0) {
        await message.reply('📊 Estadísticas:\nTodavía no se ha usado ningún comando.');
        return;
      }

      const chats = await client.getChats();
      let grandTotal = 0;
      const sections = chatEntries
        .map(([id, counts]) => ({ id, counts, chatTotal: Object.values(counts).reduce((sum, n) => sum + n, 0) }))
        .sort((a, b) => b.chatTotal - a.chatTotal)
        .map(({ id, counts, chatTotal }) => {
          grandTotal += chatTotal;
          const chat = chats.find((c) => c.id._serialized === id);
          const alias = aliasForId(id);
          const name = chat ? chat.name : id === adminChatId ? 'Grupo de administración' : id;
          const label = alias ? `${name} (${alias})` : name;
          const commandLines = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([cmd, n]) => `  ${cmd}: ${n}`);
          return [`🐝 ${label} — ${chatTotal}`, ...commandLines].join('\n');
        });

      await message.reply(
        [
          '📊 Estadísticas:',
          `Chats conectados: ${allowedChats.length}`,
          `Uso total (todos los chats): ${grandTotal}`,
          '',
          sections.join('\n\n'),
        ].join('\n'),
      );
      return;
    }

    if (command === '/resetestadisticas' || command.startsWith('/resetestadisticas ')) {
      if (!isAdminMessage(message)) return;
      const arg = command.slice('/resetestadisticas'.length).trim();
      if (!arg) {
        await message.reply('Uso: /resetestadisticas <id o alias> | todo.');
        return;
      }
      if (arg.toLowerCase() === 'todo') {
        saveStats(STATS_PATH, {});
        await message.reply('🗑️ Estadísticas reiniciadas para todos los chats.');
        return;
      }
      const targetId = resolveAliasOrId(arg);
      const stats = loadStats(STATS_PATH);
      if (!stats[targetId]) {
        await message.reply(`Ese chat no tenía estadísticas guardadas: ${targetId}`);
        return;
      }
      saveStats(STATS_PATH, resetChatStats(stats, targetId));
      await message.reply(`🗑️ Estadísticas reiniciadas para: ${await describeTarget(targetId)}`);
      return;
    }

    if (command === '/resetmemoria' || command.startsWith('/resetmemoria ')) {
      if (!isAdminMessage(message)) return;
      const arg = command.slice('/resetmemoria'.length).trim();
      if (!arg) {
        await message.reply(
          'Uso: /resetmemoria <id o alias> | todo. Olvida qué frases/recomendaciones ya se dieron, para volver a repetir desde el principio de cada lista.',
        );
        return;
      }
      if (arg.toLowerCase() === 'todo') {
        saveState(STATE_PATH, {});
        await message.reply('🗑️ Memoria de "no repetir" reiniciada para todos los chats.');
        return;
      }
      const targetId = resolveAliasOrId(arg);
      const state = loadState(STATE_PATH);
      if (!state[targetId]) {
        await message.reply(`Ese chat no tenía memoria guardada: ${targetId}`);
        return;
      }
      saveState(STATE_PATH, resetChatState(state, targetId));
      await message.reply(`🗑️ Memoria de "no repetir" reiniciada para: ${await describeTarget(targetId)}`);
      return;
    }

    if (command === '/resumen' || command.startsWith('/resumen ')) {
      // De momento solo desde el grupo de administración, mientras se prueba el
      // consumo de la cuota gratuita de Gemini con el resto de comandos ya en marcha.
      if (!isAdminMessage(message)) return;
      const chatId = resolveChatId(message);

      if (!GEMINI_API_KEY) {
        await message.reply(
          formatBeeSpeech('No tengo configurada la clave de Gemini (GEMINI_API_KEY). Pide al admin que la añada.'),
        );
        return;
      }

      const arg = command.slice('/resumen'.length).trim();
      const parsedCommand = parseResumenCommand(arg);
      if (!parsedCommand) {
        await message.reply(
          formatBeeSpeech(
            'Uso: /resumen [corto|largo|tareas] ["tema"] [n | nh | nd], en ese orden. Todo es opcional. ' +
              'Ejemplos: "/resumen", "/resumen 2h", "/resumen corto 1d", "/resumen \\"picante\\" 6h", "/resumen tareas \\"el viaje\\" 3d".',
          ),
        );
        return;
      }
      const parsedArg = parsedCommand.parsedArg || { type: 'count', value: RESUMEN_DEFAULT_LIMIT };
      const mode = parsedCommand.mode;

      try {
        const chat = await message.getChat();
        const summary = await buildResumenSummary(chat, parsedArg, mode);
        if (!summary) {
          await message.reply(formatBeeSpeech('No he encontrado mensajes suficientes para hacer un resumen.'));
          return;
        }
        await message.reply(formatBeeSpeech(summary));
        recordUsage(chatId, '/resumen');
      } catch (err) {
        console.error('Error generando el resumen:', err.message);
        await message.reply(formatBeeSpeech(describeResumenError(err)));
      }
      return;
    }

    if (command === '/resumengrupo' || command.startsWith('/resumengrupo ')) {
      if (!isAdminMessage(message)) return;

      if (!GEMINI_API_KEY) {
        await message.reply('No tengo configurada la clave de Gemini (GEMINI_API_KEY). Añádela y recrea el contenedor.');
        return;
      }

      const rest = command.slice('/resumengrupo'.length).trim();
      const [targetArg, ...restParts] = rest.split(/\s+/).filter(Boolean);
      if (!targetArg) {
        await message.reply(
          'Uso: /resumengrupo <id o alias> [corto|largo|tareas] ["tema"] [n | nh | nd]. Usa /grupos, /chats o /alias para encontrar el ID/alias.',
        );
        return;
      }

      const argRest = restParts.join(' ').trim();
      const parsedCommand = parseResumenCommand(argRest);
      if (!parsedCommand) {
        await message.reply(
          'Formato inválido. Ejemplos: "/resumengrupo trabajo 100", "/resumengrupo trabajo corto 2h", "/resumengrupo trabajo \\"picante\\" 6h".',
        );
        return;
      }
      const parsedArg = parsedCommand.parsedArg || { type: 'count', value: RESUMEN_DEFAULT_LIMIT };
      const mode = parsedCommand.mode;

      const targetId = resolveAliasOrId(targetArg);

      let chat;
      try {
        chat = await client.getChatById(targetId);
      } catch (err) {
        console.error('No se pudo encontrar el chat para /resumengrupo:', err.message);
        await message.reply(`No he podido encontrar ese chat (¿el ID/alias "${targetArg}" es correcto?).`);
        return;
      }

      try {
        const summary = await buildResumenSummary(chat, parsedArg, mode);
        const alias = aliasForId(targetId);
        const label = alias ? `${chat.name} (${alias})` : chat.name;
        if (!summary) {
          await message.reply(`No he encontrado mensajes suficientes en "${label}" para hacer un resumen.`);
          return;
        }
        await message.reply(`🧾 Resumen de "${label}":\n\n${summary}`);
        recordUsage(targetId, '/resumengrupo');
      } catch (err) {
        console.error('Error generando el resumen de otro grupo:', err.message);
        await message.reply(describeResumenError(err));
      }
      return;
    }

    if (command === '/trivial' || command === '/emoji' || command === '/trivialplus') {
      if (!isAuthorizedChat(message)) return;
      const chatId = resolveChatId(message);

      if (activePollChats.has(chatId)) return;

      const isRateLimitedGroup = chatId.endsWith('@g.us') && chatId !== adminChatId;
      if (isRateLimitedGroup && !(await checkMelonRateLimit(message, chatId))) return;

      const roundRunners = {
        '/trivial': runTriviaRound,
        '/emoji': runEmojiRound,
        '/trivialplus': runTrivialPlusRound,
      };

      activePollChats.add(chatId);
      try {
        await roundRunners[command](chatId);
      } finally {
        activePollChats.delete(chatId);
        if (isRateLimitedGroup) recordCall(lastMelonAt, chatId, Date.now());
      }
      return;
    }

    if (command === '/moneda' || command === '/dado') {
      if (!isAuthorizedChat(message)) return;
      const chatId = resolveChatId(message);

      const isRateLimitedGroup = chatId.endsWith('@g.us') && chatId !== adminChatId;
      if (isRateLimitedGroup && !(await checkMelonRateLimit(message, chatId))) return;

      const resultText = command === '/moneda' ? formatCoinResult(flipCoin()) : formatDiceResult(rollDice());
      await message.reply(formatBeeSpeech(resultText));
      recordUsage(chatId, command);
      if (isRateLimitedGroup) recordCall(lastMelonAt, chatId, Date.now());
      return;
    }

    if (command === '/tarot') {
      if (!isAuthorizedChat(message)) return;
      const chatId = resolveChatId(message);

      const isRateLimitedGroup = chatId.endsWith('@g.us') && chatId !== adminChatId;
      if (isRateLimitedGroup && !(await checkMelonRateLimit(message, chatId))) return;

      const cards = loadTarotCards(CONTENT_DIR);
      const chosenItem = pickAndRemember(chatId, command, cards);
      if (chosenItem) {
        await message.reply(formatBeeSpeech(chosenItem));
        recordUsage(chatId, command);
      }
      if (isRateLimitedGroup) recordCall(lastMelonAt, chatId, Date.now());
      return;
    }

    const recommendationType = RECOMMENDATION_TYPES.find(
      (rec) => command === rec.command || command.startsWith(`${rec.command} `),
    );
    if (recommendationType) {
      if (!isAuthorizedChat(message)) return;
      const chatId = resolveChatId(message);

      const genreArg = command.slice(recommendationType.command.length).trim();
      if (genreArg === '?') {
        await message.reply(
          formatBeeSpeech(`Géneros de ${recommendationType.command}: ${listGenres(recommendationType.type)}.`),
        );
        return;
      }
      const genre = genreArg
        ? resolveGenre(recommendationType.type, genreArg)
        : pickRandomGenre(recommendationType.type);
      if (!genre) {
        await message.reply(
          formatBeeSpeech(
            `No conozco ese género. Escribe "${recommendationType.command} ?" para ver los géneros disponibles.`,
          ),
        );
        return;
      }

      const isRateLimitedGroup = chatId.endsWith('@g.us') && chatId !== adminChatId;
      if (isRateLimitedGroup && !(await checkMelonRateLimit(message, chatId))) return;

      const allItems = loadRecommendations(CONTENT_DIR, recommendationType.type);
      const items = filterByGenre(allItems, genre);
      const stateKey = `${recommendationType.command}:${genre}`;
      const chosenItem = pickAndRemember(chatId, stateKey, items);
      if (chosenItem) {
        await message.reply(formatBeeSpeech(formatRecommendation(recommendationType.type, genre, chosenItem)));
        recordUsage(chatId, recommendationType.command);
      }
      if (isRateLimitedGroup) recordCall(lastMelonAt, chatId, Date.now());
      return;
    }

    if (command === '/ppt' || command.startsWith('/ppt ')) {
      if (!isAuthorizedChat(message)) return;
      const chatId = resolveChatId(message);

      const userChoice = normalizePptChoice(command.slice('/ppt'.length));
      if (!userChoice) {
        await message.reply(formatBeeSpeech('Dime piedra, papel o tijera: escribe "/ppt piedra", "/ppt papel" o "/ppt tijera".'));
        return;
      }

      const isRateLimitedGroup = chatId.endsWith('@g.us') && chatId !== adminChatId;
      if (isRateLimitedGroup && !(await checkMelonRateLimit(message, chatId))) return;

      const { botChoice, result } = playPpt(userChoice);
      await message.reply(formatBeeSpeech(formatPptResult(userChoice, botChoice, result)));
      recordUsage(chatId, '/ppt');
      if (isRateLimitedGroup) recordCall(lastMelonAt, chatId, Date.now());
      return;
    }

    if (isMelonCommand(command)) {
      if (!isAuthorizedChat(message)) return;
      const chatId = resolveChatId(message);

      // Los comandos secretos (hola, adios, piropo...) no pasan por este límite: son
      // respuestas puntuales a la gente, no el "dame algo random" que se quiere frenar.
      const isRateLimitedGroup =
        !SECRET_COMMANDS.has(command) && chatId.endsWith('@g.us') && chatId !== adminChatId;
      if (isRateLimitedGroup && !(await checkMelonRateLimit(message, chatId))) return;

      const items = loadMelonItems(CONTENT_DIR, command);
      const chosenItem = pickAndRemember(chatId, command, items);
      if (chosenItem) {
        const finalText = chosenItem.includes('{name}')
          ? chosenItem.replace('{name}', await resolveSenderName(message))
          : chosenItem;
        await message.reply(formatBeeSpeech(finalText));
        recordUsage(chatId, command);
      }

      if (isRateLimitedGroup) recordCall(lastMelonAt, chatId, Date.now());
    }
  }

  return client;
}

async function reinitialize(previousClient) {
  statusMessage = 'Reconectando, generando nuevo QR...';
  latestQrDataUrl = null;
  try {
    await previousClient.destroy();
  } catch (err) {
    console.error('Error al destruir el cliente anterior:', err.message);
  }
  clearStaleChromiumLocks();
  const client = createClient();
  client.initialize().catch(async (err) => {
    console.error('Error al inicializar el cliente:', err.message);
    // Si initialize() falla de forma persistente (p.ej. sesión corrupta), reintentar
    // sin espera destruiría y recrearía el cliente en bucle cerrado sin parar. Se
    // espera antes de reintentar para no saturar CPU/red con reintentos inmediatos.
    await delay(REINITIALIZE_RETRY_DELAY_MS);
    reinitialize(client);
  });
}

http
  .createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const body = latestQrDataUrl
      ? `<img src="${latestQrDataUrl}" alt="QR" />`
      : `<p>${statusMessage}</p>`;
    res.end(`<!doctype html>
<html>
<head>
  <meta http-equiv="refresh" content="5">
  <title>WhatsApp bot QR</title>
  <style>
    body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
  </style>
</head>
<body>
  <h1>${statusMessage}</h1>
  ${body}
</body>
</html>`);
  })
  .listen(QR_SERVER_PORT, () => {
    console.log(`Servidor de QR escuchando en http://localhost:${QR_SERVER_PORT}`);
  });

clearStaleChromiumLocks();
const initialClient = createClient();
initialClient.initialize().catch((err) => {
  console.error('Error al inicializar el cliente:', err.message);
  reinitialize(initialClient);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isBotNoise,
  buildTranscript,
  parseResumenArg,
  parseResumenCommand,
  buildSystemInstruction,
  summarizeTranscript,
  GeminiError,
} = require('../resumen');

test('isBotNoise descarta comandos', () => {
  assert.equal(isBotNoise('/melon'), true);
  assert.equal(isBotNoise('/resumen 50'), true);
});

test('isBotNoise descarta las frases de la Abejita', () => {
  assert.equal(isBotNoise('🐝💬\nAlgo random'), true);
});

test('isBotNoise descarta mensajes vacíos', () => {
  assert.equal(isBotNoise(''), true);
  assert.equal(isBotNoise(undefined), true);
});

test('isBotNoise deja pasar mensajes normales', () => {
  assert.equal(isBotNoise('Hola, ¿qué tal el finde?'), false);
});

test('buildTranscript arma "Nombre: texto" por línea', () => {
  const entries = [
    { name: 'Ana', body: 'Hola a todos' },
    { name: 'Luis', body: '¿Quedamos mañana?' },
  ];
  assert.equal(buildTranscript(entries), 'Ana: Hola a todos\nLuis: ¿Quedamos mañana?');
});

test('buildTranscript devuelve cadena vacía si no hay mensajes', () => {
  assert.equal(buildTranscript([]), '');
});

test('parseResumenArg interpreta un número a secas como cantidad de mensajes', () => {
  assert.deepEqual(parseResumenArg('100'), { type: 'count', value: 100 });
});

test('parseResumenArg interpreta número + m/h/d como rango de tiempo', () => {
  assert.deepEqual(parseResumenArg('30m'), { type: 'time', ms: 30 * 60 * 1000 });
  assert.deepEqual(parseResumenArg('2h'), { type: 'time', ms: 2 * 60 * 60 * 1000 });
  assert.deepEqual(parseResumenArg('3d'), { type: 'time', ms: 3 * 24 * 60 * 60 * 1000 });
});

test('parseResumenArg ignora mayúsculas y espacios', () => {
  assert.deepEqual(parseResumenArg('  2H  '), { type: 'time', ms: 2 * 60 * 60 * 1000 });
});

test('parseResumenArg devuelve null con formato inválido o cero/negativo', () => {
  assert.equal(parseResumenArg('abc'), null);
  assert.equal(parseResumenArg('2x'), null);
  assert.equal(parseResumenArg('0'), null);
  assert.equal(parseResumenArg('0h'), null);
  assert.equal(parseResumenArg(''), null);
});

test('parseResumenCommand sin argumentos es modo normal sin rango', () => {
  assert.deepEqual(parseResumenCommand(''), { parsedArg: null, mode: { type: 'normal' } });
});

test('parseResumenCommand con solo rango', () => {
  assert.deepEqual(parseResumenCommand('2h'), {
    parsedArg: { type: 'time', ms: 2 * 60 * 60 * 1000 },
    mode: { type: 'normal' },
  });
});

test('parseResumenCommand con tipo (palabra reservada) y rango', () => {
  assert.deepEqual(parseResumenCommand('corto 2h'), {
    parsedArg: { type: 'time', ms: 2 * 60 * 60 * 1000 },
    mode: { type: 'corto' },
  });
});

test('parseResumenCommand con tipo a secas, sin rango', () => {
  assert.deepEqual(parseResumenCommand('tareas'), { parsedArg: null, mode: { type: 'tareas' } });
});

test('parseResumenCommand con tema entre comillas', () => {
  assert.deepEqual(parseResumenCommand('"picante" 6h'), {
    parsedArg: { type: 'time', ms: 6 * 60 * 60 * 1000 },
    mode: { type: 'tema', topic: 'picante', style: undefined },
  });
});

test('parseResumenCommand con tema de varias palabras y sin rango', () => {
  assert.deepEqual(parseResumenCommand('"el viaje a roma"'), {
    parsedArg: null,
    mode: { type: 'tema', topic: 'el viaje a roma', style: undefined },
  });
});

test('parseResumenCommand combina tipo + tema + rango, en ese orden', () => {
  assert.deepEqual(parseResumenCommand('corto "picante" 6h'), {
    parsedArg: { type: 'time', ms: 6 * 60 * 60 * 1000 },
    mode: { type: 'tema', topic: 'picante', style: 'corto' },
  });
  assert.deepEqual(parseResumenCommand('tareas "el viaje a roma" 3d'), {
    parsedArg: { type: 'time', ms: 3 * 24 * 60 * 60 * 1000 },
    mode: { type: 'tema', topic: 'el viaje a roma', style: 'tareas' },
  });
});

test('parseResumenCommand rechaza texto suelto sin comillas que no sea palabra reservada', () => {
  assert.equal(parseResumenCommand('picante'), null);
  assert.equal(parseResumenCommand('picante 6h'), null);
});

test('buildSystemInstruction para modo "tema" incluye el tema', () => {
  const text = buildSystemInstruction({ type: 'tema', topic: 'picante' });
  assert.match(text, /picante/);
});

test('buildSystemInstruction combina tema + estilo cuando hay ambos', () => {
  const text = buildSystemInstruction({ type: 'tema', topic: 'picante', style: 'corto' });
  assert.match(text, /picante/);
  assert.match(text, /2-3 frases/);
});

test('buildSystemInstruction usa la instrucción de cada tipo sin tema', () => {
  assert.match(buildSystemInstruction({ type: 'corto' }), /2-3 frases/);
  assert.match(buildSystemInstruction({ type: 'tareas' }), /tareas pendientes/);
});

test('summarizeTranscript lanza GeminiError con code "auth" en 401/403', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 403, text: async () => 'forbidden' });
    await assert.rejects(summarizeTranscript('hola', 'key', { type: 'normal' }), (err) => {
      assert.ok(err instanceof GeminiError);
      assert.equal(err.code, 'auth');
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('summarizeTranscript lanza GeminiError con code "quota" en 429', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited' });
    await assert.rejects(summarizeTranscript('hola', 'key', { type: 'normal' }), (err) => {
      assert.equal(err.code, 'quota');
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('summarizeTranscript lanza GeminiError con code "not_found" en 404', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 404, text: async () => 'model not found' });
    await assert.rejects(summarizeTranscript('hola', 'key', { type: 'normal' }), (err) => {
      assert.equal(err.code, 'not_found');
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('summarizeTranscript lanza GeminiError con code "blocked" si no hay candidates', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }),
    });
    await assert.rejects(summarizeTranscript('hola', 'key', { type: 'normal' }), (err) => {
      assert.equal(err.code, 'blocked');
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('summarizeTranscript lanza GeminiError con code "blocked" si finishReason es SAFETY', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ finishReason: 'SAFETY', content: null }] }),
    });
    await assert.rejects(summarizeTranscript('hola', 'key', { type: 'normal' }), (err) => {
      assert.equal(err.code, 'blocked');
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('summarizeTranscript devuelve el texto cuando todo va bien', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '  Resumen generado  ' }] } }],
      }),
    });
    const summary = await summarizeTranscript('hola', 'key', { type: 'normal' });
    assert.equal(summary, 'Resumen generado');
  } finally {
    global.fetch = originalFetch;
  }
});

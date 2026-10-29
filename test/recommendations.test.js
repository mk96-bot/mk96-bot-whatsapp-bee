const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PELICULAS_GENRES,
  LIBROS_GENRES,
  MUSICA_GENRES,
  resolveGenre,
  listGenres,
  pickRandomGenre,
  loadRecommendations,
  filterByGenre,
  formatRecommendation,
} = require('../recommendations');

test('resolveGenre reconoce el género exacto', () => {
  assert.equal(resolveGenre('peliculas', 'accion'), 'accion');
  assert.equal(resolveGenre('libros', 'fantasia'), 'fantasia');
  assert.equal(resolveGenre('musica', 'pop'), 'pop');
});

test('resolveGenre ignora tildes, mayúsculas y espacios', () => {
  assert.equal(resolveGenre('peliculas', 'Acción'), 'accion');
  assert.equal(resolveGenre('libros', '  Fantasía  '), 'fantasia');
  assert.equal(resolveGenre('musica', 'ELECTRÓNICA'), 'electronica');
});

test('resolveGenre acepta alias conocidos', () => {
  assert.equal(resolveGenre('peliculas', 'sci-fi'), 'ciencia-ficcion');
  assert.equal(resolveGenre('libros', 'fantasy'), 'fantasia');
  assert.equal(resolveGenre('musica', 'hiphop'), 'hip-hop');
  assert.equal(resolveGenre('musica', 'reggaeton'), 'latino');
});

test('resolveGenre devuelve null si el género no existe', () => {
  assert.equal(resolveGenre('peliculas', 'inventado'), null);
  assert.equal(resolveGenre('peliculas', ''), null);
  assert.equal(resolveGenre('peliculas', undefined), null);
});

test('resolveGenre reconoce los géneros nuevos y sus alias', () => {
  assert.equal(resolveGenre('peliculas', 'musical'), 'musical');
  assert.equal(resolveGenre('peliculas', 'suspense'), 'thriller');
  assert.equal(resolveGenre('peliculas', 'guerra'), 'belica');
  assert.equal(resolveGenre('libros', 'terror'), 'terror');
  assert.equal(resolveGenre('libros', 'juvenil'), 'infantil-juvenil');
  assert.equal(resolveGenre('musica', 'r&b'), 'rnb');
  assert.equal(resolveGenre('musica', 'k-pop'), 'kpop');
});

test('pickRandomGenre siempre devuelve un género válido del tipo', () => {
  const genres = new Set();
  for (let i = 0; i < 200; i++) {
    const genre = pickRandomGenre('peliculas');
    assert.ok(Object.prototype.hasOwnProperty.call(PELICULAS_GENRES, genre));
    genres.add(genre);
  }
  assert.equal(genres.size, Object.keys(PELICULAS_GENRES).length);
});

test('listGenres lista todos los géneros del tipo', () => {
  assert.equal(listGenres('peliculas'), Object.keys(PELICULAS_GENRES).join(', '));
});

test('filterByGenre solo devuelve los elementos del género pedido', () => {
  const items = [{ title: 'a', genre: 'accion' }, { title: 'b', genre: 'drama' }];
  assert.deepEqual(filterByGenre(items, 'accion'), [{ title: 'a', genre: 'accion' }]);
});

test('formatRecommendation formatea cada tipo con su emoji', () => {
  assert.match(formatRecommendation('peliculas', 'accion', { title: 'X' }), /^🎬 Acción: X$/);
  assert.match(
    formatRecommendation('libros', 'fantasia', { title: 'X', author: 'Y' }),
    /^📚 Fantasía: X — Y$/,
  );
  assert.match(
    formatRecommendation('musica', 'pop', { artist: 'X', song: 'Y' }),
    /^🎵 Pop: X — Y$/,
  );
});

test('loadRecommendations lee el JSON del tipo pedido', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-content-'));
  fs.writeFileSync(path.join(tmpDir, 'peliculas.json'), JSON.stringify([{ title: 'a', genre: 'accion' }]));
  assert.deepEqual(loadRecommendations(tmpDir, 'peliculas'), [{ title: 'a', genre: 'accion' }]);
  fs.rmSync(tmpDir, { recursive: true });
});

test('cada género de cada tipo tiene al menos 100 recomendaciones únicas en el contenido real', () => {
  const contentDir = path.join(__dirname, '..', 'content');
  const keyFns = {
    peliculas: (i) => i.title,
    libros: (i) => `${i.title}|${i.author}`,
    musica: (i) => `${i.artist}|${i.song}`,
  };
  const genresByType = { peliculas: PELICULAS_GENRES, libros: LIBROS_GENRES, musica: MUSICA_GENRES };
  for (const type of ['peliculas', 'libros', 'musica']) {
    const items = loadRecommendations(contentDir, type);
    for (const genre of Object.keys(genresByType[type])) {
      const subset = filterByGenre(items, genre);
      const keys = subset.map(keyFns[type]);
      assert.ok(keys.length >= 100, `${type}/${genre} tiene ${keys.length}, se esperaban >= 100`);
      assert.equal(new Set(keys).size, keys.length, `${type}/${genre} tiene duplicados`);
    }
  }
});

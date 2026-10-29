const fs = require('fs');
const path = require('path');

const PELICULAS_GENRES = {
  accion: 'Acción',
  comedia: 'Comedia',
  drama: 'Drama',
  terror: 'Terror',
  'ciencia-ficcion': 'Ciencia Ficción',
  animacion: 'Animación',
  fantasia: 'Fantasía',
  romance: 'Romance',
  thriller: 'Thriller',
  belica: 'Bélica',
  musical: 'Musical',
  western: 'Western',
};

const LIBROS_GENRES = {
  fantasia: 'Fantasía',
  'ciencia-ficcion': 'Ciencia Ficción',
  misterio: 'Misterio',
  romance: 'Romance',
  clasicos: 'Clásicos',
  terror: 'Terror',
  aventura: 'Aventura',
  historica: 'Histórica',
  'infantil-juvenil': 'Infantil/Juvenil',
  ensayo: 'Ensayo',
  poesia: 'Poesía',
};

const MUSICA_GENRES = {
  pop: 'Pop',
  rock: 'Rock',
  'hip-hop': 'Hip-Hop',
  electronica: 'Electrónica',
  latino: 'Latino',
  rnb: 'R&B/Soul',
  metal: 'Metal',
  jazz: 'Jazz',
  reggae: 'Reggae',
  country: 'Country',
  clasica: 'Clásica',
  indie: 'Indie/Alternativo',
  kpop: 'K-pop',
};

const GENRES_BY_TYPE = { peliculas: PELICULAS_GENRES, libros: LIBROS_GENRES, musica: MUSICA_GENRES };

// Alias para que el usuario no tenga que escribir el género exacto: sin tildes, con
// espacio en vez de guion, sinónimos en inglés, etc. Todo se normaliza antes de buscar.
const GENRE_ALIASES = {
  peliculas: {
    'sci-fi': 'ciencia-ficcion',
    scifi: 'ciencia-ficcion',
    'ciencia ficcion': 'ciencia-ficcion',
    miedo: 'terror',
    animacion: 'animacion',
    animada: 'animacion',
    animadas: 'animacion',
    suspense: 'thriller',
    guerra: 'belica',
    bellica: 'belica',
    oeste: 'western',
  },
  libros: {
    fantasy: 'fantasia',
    'sci-fi': 'ciencia-ficcion',
    scifi: 'ciencia-ficcion',
    'ciencia ficcion': 'ciencia-ficcion',
    mystery: 'misterio',
    clasico: 'clasicos',
    clasica: 'clasicos',
    clasica_: 'clasicos',
    'infantil juvenil': 'infantil-juvenil',
    infantil: 'infantil-juvenil',
    juvenil: 'infantil-juvenil',
    historia: 'historica',
    biografia: 'ensayo',
    'no ficcion': 'ensayo',
    poema: 'poesia',
    poemas: 'poesia',
  },
  musica: {
    hiphop: 'hip-hop',
    rap: 'hip-hop',
    electronic: 'electronica',
    edm: 'electronica',
    reggaeton: 'latino',
    reggaetón: 'latino',
    'r&b': 'rnb',
    'r & b': 'rnb',
    soul: 'rnb',
    clasico: 'clasica',
    'musica clasica': 'clasica',
    indie: 'indie',
    alternativo: 'indie',
    alternativa: 'indie',
    'k-pop': 'kpop',
  },
};

function stripAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function slugifyGenre(rawInput) {
  return stripAccents((rawInput || '').trim().toLowerCase()).replace(/\s+/g, ' ').trim();
}

function resolveGenre(type, rawInput) {
  const genres = GENRES_BY_TYPE[type];
  if (!genres || !rawInput) return null;
  const slug = slugifyGenre(rawInput);
  const dashSlug = slug.replace(/\s+/g, '-');
  const aliased = (GENRE_ALIASES[type] && GENRE_ALIASES[type][slug]) || dashSlug;
  return Object.prototype.hasOwnProperty.call(genres, aliased) ? aliased : null;
}

function listGenres(type) {
  const genres = GENRES_BY_TYPE[type];
  return Object.keys(genres).join(', ');
}

// Sin género (comando "a pelo"): se elige uno al azar entre todos los disponibles.
function pickRandomGenre(type) {
  const keys = Object.keys(GENRES_BY_TYPE[type]);
  return keys[Math.floor(Math.random() * keys.length)];
}

function genreLabel(type, genre) {
  return GENRES_BY_TYPE[type][genre];
}

function loadRecommendations(contentDir, type) {
  return JSON.parse(fs.readFileSync(path.join(contentDir, `${type}.json`), 'utf8'));
}

function filterByGenre(items, genre) {
  return items.filter((item) => item.genre === genre);
}

function formatRecommendation(type, genre, item) {
  const label = genreLabel(type, genre);
  if (type === 'peliculas') return `🎬 ${label}: ${item.title}`;
  if (type === 'libros') return `📚 ${label}: ${item.title} — ${item.author}`;
  return `🎵 ${label}: ${item.artist} — ${item.song}`;
}

module.exports = {
  PELICULAS_GENRES,
  LIBROS_GENRES,
  MUSICA_GENRES,
  GENRES_BY_TYPE,
  resolveGenre,
  listGenres,
  pickRandomGenre,
  genreLabel,
  loadRecommendations,
  filterByGenre,
  formatRecommendation,
};

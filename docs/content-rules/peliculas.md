# Reglas de contenido: /peliculas

**Objetivo:** recomendar una película según el género que pida quien escribe (`/peliculas <género>`). Mínimo 100 películas distintas por género.

**Formato del archivo (`peliculas.json`):** array de objetos:
```json
{ "title": "Mad Max: Fury Road", "genre": "accion" }
```
- `genre` debe ser una de las claves definidas en `PELICULAS_GENRES` (`recommendations.js`): `accion`, `comedia`, `drama`, `terror`, `ciencia-ficcion`, `animacion`, `fantasia`, `romance`, `thriller`, `belica`, `musical`, `western`.
- `title` no se repite dentro del mismo género.
- Si se añade un género nuevo, hay que añadirlo también a `PELICULAS_GENRES` y, si aplica, a `GENRE_ALIASES.peliculas`.

**Mecánica:** el usuario escribe `/peliculas <género>` (acepta variantes sin tilde, con espacio en vez de guion, y algún alias en inglés como `sci-fi`). Sin género, el bot elige uno al azar. Escribiendo `/peliculas ?` se listan los géneros disponibles. Con un género inválido, avisa de que use `?`. Elige sin repetir hasta agotar la lista de ese género (dedupe por chat+género).

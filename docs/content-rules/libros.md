# Reglas de contenido: /libros

**Objetivo:** recomendar un libro según el género que pida quien escribe (`/libros <género>`). Mínimo 100 libros distintos por género.

**Formato del archivo (`libros.json`):** array de objetos:
```json
{ "title": "El Nombre del Viento", "author": "Patrick Rothfuss", "genre": "fantasia" }
```
- `genre` debe ser una de las claves definidas en `LIBROS_GENRES` (`recommendations.js`): `fantasia`, `ciencia-ficcion`, `misterio`, `romance`, `clasicos`, `terror`, `aventura`, `historica`, `infantil-juvenil`, `ensayo`, `poesia`.
- La combinación `title` + `author` no se repite dentro del mismo género (mismo título de autores distintos sí estaría permitido, aunque no se ha dado el caso).
- Si se añade un género nuevo, hay que añadirlo también a `LIBROS_GENRES` y, si aplica, a `GENRE_ALIASES.libros`.

**Mecánica:** igual que `/peliculas` — `/libros <género>` con alias tolerantes a tildes/espacios/inglés, sin género elige uno al azar, `/libros ?` lista los géneros, con uno inválido avisa de que use `?`, sin repetir hasta agotar la lista de ese género.

# Reglas de contenido: /musica

**Objetivo:** recomendar una canción según el género que pida quien escribe (`/musica <género>`). Mínimo 100 canciones distintas por género.

**Formato del archivo (`musica.json`):** array de objetos:
```json
{ "artist": "Daft Punk", "song": "One More Time", "genre": "electronica" }
```
- `genre` debe ser una de las claves definidas en `MUSICA_GENRES` (`recommendations.js`): `pop`, `rock`, `hip-hop`, `electronica`, `latino`, `rnb`, `metal`, `jazz`, `reggae`, `country`, `clasica`, `indie`, `kpop`.
- La combinación `artist` + `song` no se repite dentro del mismo género.
- Si se añade un género nuevo, hay que añadirlo también a `MUSICA_GENRES` y, si aplica, a `GENRE_ALIASES.musica`.

**Mecánica:** igual que `/peliculas`/`/libros` — `/musica <género>` con alias tolerantes (`hiphop`/`rap` → `hip-hop`, `reggaeton` → `latino`, `edm`/`electronic` → `electronica`, `r&b`/`soul` → `rnb`, `k-pop` → `kpop`), sin género elige uno al azar, `/musica ?` lista los géneros, con uno inválido avisa de que use `?`, sin repetir hasta agotar la lista de ese género.

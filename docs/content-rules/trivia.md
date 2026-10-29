# Reglas de contenido: /trivia

**Objetivo:** cultura general variada (historia, ciencia, geografía, cine, deportes, arte...), formato pregunta con 4 opciones y una sola correcta. 100 preguntas por categoría, repartidas entre las 3 dificultades.

**Formato del archivo (`trivia.json`):** distinto al resto de categorías — no es un array de strings, sino de objetos:
```json
{
  "question": "¿Cuál es el planeta más grande del sistema solar?",
  "options": ["Tierra", "Júpiter", "Saturno", "Marte"],
  "correctIndex": 1,
  "category": "Ciencia",
  "difficulty": "fácil"
}
```
- `options` debe tener **exactamente 4** elementos.
- `correctIndex` es el índice (0-3) de la opción correcta.
- Nunca dos opciones idénticas ni ambigüedad sobre cuál es la correcta.
- `category` debe ser una de las claves definidas en `CATEGORY_COLORS` (`trivia.js`): Ciencia, Historia, Geografía, Arte, Deportes, Literatura, Música, Cine, Cultura general, Disney. Cada categoría tiene un color/icono fijo asignado, que se muestra junto al nombre de la categoría tanto en la pregunta de la encuesta como en el mensaje de resultados. Si se añade una categoría nueva, hay que añadirle también su color en `CATEGORY_COLORS`.
- `difficulty` es uno de `"fácil"`, `"medio"`, `"difícil"` (con esas tildes exactas). Cada categoría mantiene ~100 preguntas repartidas aproximadamente a partes iguales entre los tres niveles. De momento el bot no filtra por dificultad al elegir pregunta (`pickNext` elige de toda la lista de la categoría por igual); el campo queda guardado para un futuro modo por dificultad.
- **Cine vs. Disney:** `Cine` cubre cualquier película/director/actor que NO sea propiedad de Disney. Todo lo que sea Disney (animación clásica y Pixar), Marvel, Star Wars/Lucasfilm, Piratas del Caribe, Disney Channel, remakes live-action, etc. va en la categoría `Disney` — no solo películas de princesas, también Marvel/Star Wars/Pixar cuentan como Disney y no deben ir en `Cine`.

**Mecánica (no es un simple "pick random y responde"):**
1. Se crea una encuesta nativa de WhatsApp (`Poll`) con la pregunta y las 4 opciones, respuesta única.
2. Se manda un segundo mensaje de cuenta atrás que se va editando cada segundo, de 60 a 1.
3. Al llegar a 0, se consultan los votos reales de la encuesta (`client.getPollVotes`) y se edita ese mismo mensaje con la respuesta correcta y el % de gente que votó cada opción (sobre el total de quien votó, no sobre el total de miembros del grupo).

**Bloqueo por chat:** mientras una trivia está en marcha en un chat, una nueva petición de `/trivia` en ese mismo chat se ignora en silencio hasta que termine la actual.

**Reutiliza:** el mismo límite de 10 minutos entre comandos en grupos (no admin) que ya aplica a los comandos de melón, y el mismo motor de anti-repetición (`pickNext`/`seen-state.json`) para no repetir pregunta hasta agotar la lista por chat.

**Visibilidad:** comando visible (no secreto), aparece en `/ayuda` y `/presentate` con línea propia (no forma parte del listado dinámico de categorías porque su formato de contenido es distinto).

**Tono:** preguntas neutras, sin trampas ambiguas ni temas polémicos (eso es terreno de `/caña`, no de trivia).

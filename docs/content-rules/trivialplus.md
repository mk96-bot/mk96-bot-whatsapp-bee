# Reglas de contenido: /trivialplus

**Objetivo:** encuesta de preferencias sexuales +18 — la gente vota la opción que más le representa (postura favorita, tipo de sexo, edad de la primera vez, frecuencia, fantasías, kinks...). **No es trivia** (no hay respuesta correcta): al acabar el tiempo se destaca la opción más votada del grupo, igual que un "¿cuál gana?". Mismo mecanismo de encuesta+cuenta atrás que `/trivial`/`/emoji`.

**Mismo límite que `/avispa` (no negociable):** se pueden **nombrar** los actos/preferencias directamente (sexo oral, anal, masturbación, posturas, fetiches, BDSM ligero...) pero **nunca describir gráficamente** el acto en sí. El contenido es directo en los TEMAS, siempre en formato pregunta con opciones concretas, nunca como narración de un acto. Cero contenido pornográfico o con descripciones paso a paso.

**Formato del archivo (`trivialplus.json`):** array de objetos, sin `correctIndex` (no aplica, no hay respuesta correcta):
```json
{
  "question": "¿Qué postura te gusta más?",
  "options": ["Misionero", "Perrito", "Vaquera", "Cucharita"]
}
```
- `options` debe tener **exactamente 4** elementos, sin duplicados — cada uno una opción de preferencia concreta y corta (para que quepa bien como opción de encuesta de WhatsApp).
- Nunca preguntas de trivia con dato objetivo — todas deben ser de **preferencia personal**, sin respuesta "correcta".

**Aviso de contenido:** `formatTrivialPlusPollQuestion` (`games.js`) antepone siempre "🌶️ Trivial+ (encuesta +18):" a la pregunta, para que quede claro de qué va antes de votar — la encuesta es visible para todo el grupo, así que nadie se lo encuentra por sorpresa. Al acabar, `formatTrivialPlusResults` marca con 🏆 la opción (u opciones, si hay empate) más votada.

**Regla de respeto (igual que `/avispa`):** nunca preguntas ancladas a "alguien del grupo" ni que fuercen a valorar a una persona concreta del chat — todo son preferencias sobre uno mismo, nunca sobre otra persona presente en el chat.

**No solapar con `/avispa`:** `/avispa` da una frase/dilema en respuesta directa (mecánica de melón, sin encuesta); `/trivialplus` es una encuesta de grupo con opciones cerradas y resultado visible al final.

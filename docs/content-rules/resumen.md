# Reglas de contenido: /resumen

No es un comando de contenido random como el resto — no lee de `content/`, llama a una IA externa (Google Gemini) para resumir la conversación real del chat. Se documenta aquí solo para explicar su mecánica.

**Uso:** `/resumen [corto|largo|tareas] ["tema"] [n | nh | nd]`, siempre en ese orden. Las tres partes son opcionales e independientes entre sí:
- **Tipo** (palabra reservada, sin comillas): `corto` (2-3 frases), `largo` (detallado), `tareas` (solo decisiones y pendientes, ignora la charla informal). Si no se indica, resumen normal.
- **Tema** (entre comillas dobles, obligatorias): la propia IA decide qué mensajes tienen que ver con ese tema y resume solo esa parte, ignorando el resto (saludos, charla sin relación...). Sin comillas no se reconoce como tema — cualquier palabra suelta que no sea `corto`/`largo`/`tareas` hace que el comando dé error de uso, precisamente para no confundir texto suelto con un tema.
- **Rango**: cantidad de mensajes (`100`, por defecto `RESUMEN_DEFAULT_LIMIT` = 200, tope `RESUMEN_MAX_LIMIT` = 500) o tiempo (`2h`, `3d`, `30m`). Siempre va al final si se indica.

Tipo y tema se pueden combinar (`/resumen corto "picante" 6h`); el resultado combina ambas instrucciones en el prompt. Todo se interpreta con `parseResumenCommand` (`resumen.js`).

**Requisito:** variable de entorno `GEMINI_API_KEY` (clave gratuita de https://aistudio.google.com/apikey). Sin ella, el comando avisa y no hace nada. Se pasa al contenedor vía `docker-compose.yml` (`environment: GEMINI_API_KEY=${GEMINI_API_KEY}`) leyendo de un archivo `.env` local (ver `.env.example`) — nunca se commitea la clave real.

**Mecánica (`resumen.js` + `index.js`):**
1. `chat.fetchMessages({ limit })` no se limita a lo ya cargado en memoria: cuando se le pide más mensajes de los que tiene, pagina hacia atrás sola (`WAWebChatLoadMessages.loadEarlierMsgs`) hasta cubrir el `limit` o quedarse sin histórico. Para el modo "cantidad" se pide ese `limit` directamente, topado a `RESUMEN_MAX_LIMIT`. Para el modo "rango de tiempo" se va doblando el `limit` (`RESUMEN_DEFAULT_LIMIT` → ×2 → ×2...) hasta que el mensaje más antiguo traído sea anterior al corte de tiempo, hasta `RESUMEN_MAX_TIME_FETCH`, o hasta que no queden más mensajes en el chat; luego se filtra por `timestamp`.
2. Se descartan con `isBotNoise` los comandos (`/algo`) y las propias frases de la Abejita (empiezan por 🐝), para no meter ruido del bot en el resumen.
3. Se arma un transcript `Nombre: texto` por línea (`buildTranscript`) y se manda a la API de Gemini (`gemini-3.6-flash`), con la instrucción de sistema que corresponda al tipo/tema (`buildSystemInstruction`) — el filtrado por tema no se hace en código, se le pide directamente a la IA en el prompt que decida qué es relevante.
4. Usa el mismo cooldown de grupo que el resto de comandos (`MELON_GROUP_COOLDOWN_MS`).

**Errores (`GeminiError.code` en `resumen.js`, traducidos por `describeResumenError` en `index.js`):**
- `auth` (401/403) — la clave `GEMINI_API_KEY` no es válida o ha caducado.
- `quota` (429) — se agotó la cuota gratuita, hay que esperar.
- `not_found` (404) — el modelo configurado (`GEMINI_MODEL`) ya no existe en la API; Google los va retirando con el tiempo.
- `blocked` — Gemini bloqueó la respuesta por sus filtros de contenido (puede pasar con temas sensibles, p.ej. `/resumen "picante"`; Gemini aplica moderación por defecto y no se ha tocado esa configuración).
- Cualquier otro fallo cae en un mensaje genérico.

**Privacidad:** este comando envía el contenido real de la conversación a un servicio externo (Google). Es una decisión consciente de quien administra el bot, no algo transparente para quien está en el grupo — considera avisar al grupo antes de activarlo.

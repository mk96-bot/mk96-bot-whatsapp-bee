# Reglas de contenido: /adios (comando secreto)

**Objetivo:** despedida personalizada con el nombre real de quien escribe. Es el equivalente de `/hola` pero para despedirse.

**Es un comando secreto:** aparece listado en `/ayuda` y `/presentate`, pero sin descripción real — solo el teaser genérico "🤫 pruébalo y lo descubrirás" (ver `SECRET_COMMANDS` en `index.js`). No añadir descripciones que revelen qué hace.

**Tono:** cercano, con la personalidad de "la Abejita Zumbona" (zumbidos, colmena, panal, abeja, miel). Frases cortas y cálidas de despedida.

**Placeholder `{name}`:** **obligatorio en cada frase**. El bot sustituye `{name}` por el nombre real de quien escribió el comando (resuelto vía `pushname` de WhatsApp, no por cómo lo tengamos guardado en la agenda).

**Ámbito de uso:** funciona en cualquier chat autorizado (grupo conectado, chat 1:1 conectado, tu chat personal, grupo de administración) — no es exclusivo del grupo de administración.

**No solapar con:** `/hola` (hola es saludo de llegada, adios es despedida — nunca mezclar el tono de uno en el otro).

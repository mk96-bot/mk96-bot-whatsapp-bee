# Reglas de contenido: /hola (comando secreto)

**Objetivo:** saludo personalizado con el nombre real de quien escribe.

**Es un comando secreto:** aparece listado en `/ayuda` y `/presentate`, pero sin descripción real — solo el teaser genérico "🤫 pruébalo y lo descubrirás" (ver `SECRET_COMMANDS` en `index.js`). No añadir descripciones que revelen qué hace.

**Tono:** cercano, con la personalidad de "la Abejita Zumbona" (zumbidos, colmena, panal, abeja). Frases cortas, de saludo genuino.

**Placeholder `{name}`:** **obligatorio en cada frase**. El bot sustituye `{name}` por el nombre real de quien escribió el comando (resuelto vía `pushname` de WhatsApp, no por cómo lo tengamos guardado en la agenda).

**Ámbito de uso:** funciona en cualquier chat autorizado (grupo conectado, chat 1:1 conectado, tu chat personal, grupo de administración) — no es exclusivo del grupo de administración.

**No solapar con:** `/piropo` (hola es saludo neutro, piropo es cumplido positivo específico).

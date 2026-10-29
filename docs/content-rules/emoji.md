# Reglas de contenido: /emoji

**Objetivo:** adivinar una película/serie a partir de una secuencia de emojis, formato pregunta con 4 opciones y una sola correcta (mismo mecanismo de encuesta+cuenta atrás que `/trivial`). 100 preguntas en total.

**Formato del archivo (`emoji.json`):** array de objetos:
```json
{
  "clue": "🦁👑🌍",
  "options": ["El Rey León", "Madagascar", "Kung Fu Panda", "Zootrópolis"],
  "correctIndex": 0
}
```
- `clue` son 2-4 emojis que representen la película sin usar texto.
- `options` debe tener **exactamente 4** elementos, sin duplicados.
- `correctIndex` es el índice (0-3) de la opción correcta.
- Preferir películas/series ampliamente conocidas para que el emoji sea reconocible.

**Mecánica:** igual que `/trivial` — encuesta nativa de WhatsApp, 60 segundos de cuenta atrás y resultados con porcentajes al final.

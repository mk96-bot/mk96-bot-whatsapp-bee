# mk96-bot-whatsapp-bee

Bot de WhatsApp ("la Abejita Zumbona") basado en [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js). Rompe el hielo en grupos con frases, retos, juegos, recomendaciones y predicciones, y resume conversaciones con IA.

> **No usa la API oficial de WhatsApp.** Se conecta suplantando a un cliente de WhatsApp Web normal, iniciando sesión con un QR como si abrieras WhatsApp Web en el navegador. WhatsApp puede bloquear números que usan clientes no oficiales, así que usa un número dedicado para el bot y no el personal.

## Qué hace

El bot responde a comandos que empiezan por `/` en los chats que un administrador ha autorizado. Todo se administra desde un grupo especial llamado `whats-management`, que el bot crea solo la primera vez.

- **No repite frases** en un mismo chat hasta agotar la lista de ese comando.
- **Espera de 20 segundos** por chat entre comandos de conversación.
- **Alias de emoji:** cada comando se puede lanzar con su emoji, por ejemplo `/🐝` equivale a `/abeja`.
- Las listas de frases y preguntas están en `content/` y vienen incluidas en el repositorio.

### Conversación

| Comando | Qué hace |
|---|---|
| `/melon` 🍈 | Un tema de charla para romper el hielo |
| `/abeja` 🐝 | Picante, pero no mucho |
| `/avispa` 🌶️ | Más picante que `/abeja` |
| `/reto` 🕸️ | Un reto para hacer en el grupo |
| `/confesion` 🤫 | Una confesión, a veces suave y a veces sin filtros |
| `/elige` 🤔 | ¿Qué prefieres? Mezcla de simple y burrada |
| `/dato` 🧠 | Un dato curioso al azar |
| `/plan` 📅 | Una idea de plan para hacer con el grupo |
| `/hola` 👋 | Saludo personalizado |
| `/adios` 🚪 | Despedida personalizada |
| `/piropo` 😘 | Un piropo dirigido a ti |
| `/picame` 😜 | Una pulla cariñosa, todo en broma |
| `/consejo` 💡 | Un consejo, serio o no tanto |
| `/caña` 🔥 | Un tema polémico para discutir. Existe, pero no aparece en `/ayuda` |

`/hola`, `/adios`, `/piropo`, `/consejo` y `/picame` salen en `/ayuda` como "comandos secretos", sin explicar qué hacen.

### Juegos

| Comando | Qué hace |
|---|---|
| `/trivial` ❓ | Una pregunta de cultura general con 4 opciones, en encuesta con cuenta atrás y resultados |
| `/trivialplus` 😈 | Encuesta +18 de preferencias. Gana la opción más votada |
| `/emoji` 🎭 | Adivina la película a partir de unos emojis, en encuesta con 4 opciones |
| `/moneda` 🪙 | Cara o cruz |
| `/dado` 🎲 | Tira un dado del 1 al 6 |
| `/ppt` ✂️ | Piedra, papel o tijera: `/ppt piedra`, `/ppt papel` o `/ppt tijera` |

### Predicciones

| Comando | Qué hace |
|---|---|
| `/tarot` 🎴 | Saca una carta del tarot con su significado |
| `/suerte` 🍀 | Una predicción de buena suerte para ti |
| `/destino` 🔮 | Un horóscopo disparatado del día |

### Recomendaciones

| Comando | Qué hace |
|---|---|
| `/peliculas [género]` 🎬 | Recomienda una película |
| `/libros [género]` 📚 | Recomienda un libro |
| `/musica [género]` 🎵 | Recomienda una canción |

Sin género elige uno al azar. Con `?` (por ejemplo `/peliculas ?`) lista los géneros disponibles.

### Ayuda

| Comando | Qué hace |
|---|---|
| `/ayuda` | Lista los comandos disponibles. En el grupo de administración añade los de administración |
| `/presentate` | La Abejita se presenta |

### Administración (solo en el grupo `whats-management`)

| Comando | Qué hace |
|---|---|
| `/grupos ["texto"]` | Lista tus grupos, o filtra por nombre parcial |
| `/chats ["texto"]` | Lista tus chats 1:1, o filtra por nombre parcial |
| `/alias <alias> <id>` | Pone un alias a un chat o grupo para no usar el ID |
| `/alias` | Lista los alias guardados |
| `/desalias <alias>` | Elimina un alias |
| `/conecta <id o alias>` | Autoriza un chat o grupo para usar los comandos |
| `/desconecta <id o alias>` | Retira la autorización a un chat o grupo |
| `/conexiones` | Lista los chats conectados ahora mismo |
| `/limpia` | Vacía los mensajes del grupo de administración |
| `/estadisticas` | Uso de comandos por chat |
| `/resetestadisticas <id o alias> \| todo` | Reinicia las estadísticas de un chat o de todos |
| `/resetmemoria <id o alias> \| todo` | Olvida qué frases ya se dieron, para empezar de nuevo las listas |
| `/resumen [corto\|largo\|tareas] ["tema"] [n \| nh \| nd]` | Resume con IA el chat actual. Por defecto 200 mensajes, máximo 500 |
| `/resumengrupo <id o alias> [corto\|largo\|tareas] ["tema"] [n \| nh \| nd]` | Resume con IA cualquier chat, esté conectado o no |

Ejemplos de `/resumen`: `/resumen`, `/resumen 2h`, `/resumen corto 1d`, `/resumen "picante" 6h`, `/resumen tareas "el viaje" 3d`. Aquí `n` es un número de mensajes, `nh` son horas y `nd` son días.

## Requisitos

- Docker y Docker Compose (`docker compose` o `docker-compose`, cualquiera de los dos).
- Un número de WhatsApp para el bot. Al escanear el QR, ese número queda vinculado como sesión de WhatsApp Web y no puede tener otra sesión de WhatsApp Web activa a la vez.
- Opcional, solo para `/resumen` y `/resumengrupo`: una clave de la API gratuita de [Google Gemini](https://aistudio.google.com/apikey).

No hace falta tener Node.js instalado: todo corre dentro del contenedor.

## Arranque rápido

No hace falta crear volúmenes ni nada más: Docker Compose los crea al arrancar.

1. Clona el repositorio y entra en la carpeta.
2. Opcional: configura la clave de Gemini (ver [Claves y datos privados](#claves-y-datos-privados)). Sin ella todo funciona, salvo `/resumen` y `/resumengrupo`.
3. Arranca:
   ```bash
   docker compose up -d --build
   ```
4. Sigue los logs hasta que aparezca el aviso de que hay un QR listo:
   ```bash
   docker compose logs -f
   ```
5. Abre `http://localhost:3000` en un navegador y verás el QR como imagen. Si el bot corre en un servidor remoto, tuneliza el puerto: `ssh -L 3000:localhost:3000 usuario@servidor`.
6. Escanéalo desde el móvil del número del bot: WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo.
7. Cuando la sesión queda activa, el log muestra `ready` y el bot crea (si no existe) el grupo `whats-management` y añade a él al propio número del bot.
8. Desde `whats-management`, usa `/conecta <id o alias>` para autorizar los grupos o chats donde quieres que el bot responda. Para encontrar el ID usa `/grupos` o `/chats`. Sin autorizar, el bot ignora los comandos en ese chat.

La sesión de WhatsApp solo hay que iniciarla una vez: mientras el volumen `mk96-bot-whatsapp-bee_wwebjs_auth` no se borre, los reinicios no piden QR.

## Claves y datos privados

**Nada de esto se sube al repositorio.** El `.gitignore` y el `.dockerignore` lo impiden.

| Dato | Para qué sirve | Dónde se pone o dónde vive |
|---|---|---|
| `GEMINI_API_KEY` | Clave de Google Gemini. Solo la usan `/resumen` y `/resumengrupo` | Archivo `.env` junto a `docker-compose.yml` |
| Sesión de WhatsApp | Equivale a estar con la sesión iniciada | Volumen Docker `mk96-bot-whatsapp-bee_wwebjs_auth` |
| Estado de los chats | Chats autorizados, alias, estadísticas y memoria de frases | Volumen Docker `mk96-bot-whatsapp-bee_whats_data` |

### Cómo configurar la clave de Gemini

1. Crea una clave gratuita en [Google AI Studio](https://aistudio.google.com/apikey).
2. Copia la plantilla y edítala:
   ```bash
   cp .env.example .env
   ```
3. Escribe tu clave en `.env`, sin comillas ni espacios:
   ```
   GEMINI_API_KEY=tu_clave_aquí
   ```
4. Recrea el contenedor para que la lea:
   ```bash
   docker compose up -d --force-recreate
   ```

Docker Compose lee `.env` y pasa la clave al contenedor. Está en `.gitignore`, así que no se sube por error. Solo `.env.example`, que no lleva ninguna clave, forma parte del repositorio.

### Precauciones

- Si la clave se filtra, revócala en Google AI Studio y crea otra.
- `/resumen` y `/resumengrupo` **envían los mensajes del chat a la API de Google** para resumirlos. Úsalos solo en chats donde eso sea aceptable.
- La sesión de WhatsApp da acceso a la cuenta del bot. No la compartas ni la subas a ningún sitio.

## Qué persiste y dónde

El `docker-compose.yml` define dos volúmenes con nombre. Los gestiona Docker y no son carpetas del repositorio.

- **`mk96-bot-whatsapp-bee_wwebjs_auth`**, montado en `/app/.wwebjs_auth`: la sesión de WhatsApp Web. Si se pierde, hay que volver a escanear el QR.
- **`mk96-bot-whatsapp-bee_whats_data`**, montado en `/app/data`: el estado del bot.
  - `allowed-chats.json`: qué chats están autorizados (`/conecta` y `/desconecta`).
  - `aliases.json`: alias de chats (`/alias`).
  - `seen-state.json`: qué frases ya se han dado a cada chat, para no repetir (`/resetmemoria`).
  - `stats.json`: uso de comandos por chat (`/estadisticas`).
  - `admin-chat.json`: el ID del grupo de administración ya creado.

El código de este repositorio solo trae las listas de partida (`content/*.json`). El progreso de cada grupo vive únicamente en los volúmenes.

### Migrar el bot a otra máquina

Para conservar sesión, autorizaciones, alias, estadísticas y progreso, hay que copiar el contenido de los dos volúmenes.

En la máquina origen (comprueba el nombre real de tus volúmenes con `docker volume ls`):

```bash
docker run --rm -v <volumen_origen_wwebjs_auth>:/from -v "$PWD":/to alpine tar czf /to/wwebjs_auth.tgz -C /from .
docker run --rm -v <volumen_origen_whats_data>:/from -v "$PWD":/to alpine tar czf /to/whats_data.tgz -C /from .
```

En la máquina destino, antes de arrancar el bot por primera vez:

```bash
docker volume create mk96-bot-whatsapp-bee_wwebjs_auth
docker volume create mk96-bot-whatsapp-bee_whats_data
docker run --rm -v mk96-bot-whatsapp-bee_wwebjs_auth:/to -v "$PWD":/from alpine tar xzf /from/wwebjs_auth.tgz -C /to
docker run --rm -v mk96-bot-whatsapp-bee_whats_data:/to -v "$PWD":/from alpine tar xzf /from/whats_data.tgz -C /to
docker compose up -d --build
```

Los `.tgz` contienen la sesión de WhatsApp: bórralos cuando termines. Git los ignora, pero no los dejes en ningún sitio compartido.

Si no importas los volúmenes, el bot arranca de cero: pide QR otra vez y no recuerda ningún chat autorizado, alias, estadística ni frase ya dada.

## Comandos útiles del día a día

```bash
docker compose up -d --build     # construir y arrancar (o reconstruir tras un cambio de código)
docker compose logs -f           # ver logs en vivo (para leer el QR o depurar errores)
docker compose restart           # reiniciar sin reconstruir
docker compose down              # parar y eliminar el contenedor (los volúmenes NO se borran)
docker compose down -v           # ⚠️ parar y borrar también los volúmenes (sesión y datos)
```

## Tests

Los tests usan `node --test` (Node 20+). Si tu Node es más antiguo, ejecútalos dentro de un contenedor en vez de instalar Node:

```bash
docker run --rm -v "$PWD":/app -w /app node:20-slim node --test
```

`Dockerfile.test` está pensado para integración continua: construye la imagen, copia el código y los tests, y falla el build si algún test falla:

```bash
docker build -f Dockerfile.test -t mk96-bot-whatsapp-bee-test .
```

## Reglas de contenido

Las listas de frases y preguntas de cada comando (`content/*.json`) tienen sus reglas de tono, límites y formato documentadas una a una en `docs/content-rules/<comando>.md`. Antes de añadir o modificar frases de un comando, lee el `.md` correspondiente: cada categoría tiene límites específicos. Por ejemplo, `/avispa` nombra actos sexuales pero nunca los describe gráficamente y nunca ancla nada a "alguien del grupo", y `/abeja` es atracción y ligoteo sin nombrar actos sexuales explícitos.

## Estructura del repositorio

```
.
├── index.js                 Arranque del bot, enrutado de comandos y servidor del QR
├── commands.js              Comandos de conversación, descripciones y emojis
├── games.js                 Moneda, dado, piedra-papel-tijera, tarot, emoji y trivial +18
├── trivia.js                Trivial de cultura general (encuestas con cuenta atrás)
├── recommendations.js       Recomendaciones de películas, libros y música
├── resumen.js               Resúmenes con IA (Google Gemini)
├── state.js                 Memoria de frases ya dadas, para no repetir
├── stats.js                 Estadísticas de uso por chat
├── config.js                Lectura y guardado de chats autorizados y alias
├── ratelimit.js             Espera entre comandos por chat
├── patch-wwebjs.js          Parches a whatsapp-web.js aplicados al construir la imagen
├── package.json
├── Dockerfile               Imagen del bot
├── Dockerfile.test          Imagen que ejecuta los tests (para integración continua)
├── docker-compose.yml       Servicio, puerto 3000 y los dos volúmenes con nombre
├── .env.example             Plantilla de las variables de entorno (sin claves)
├── .gitignore
├── .dockerignore
├── README.md
├── content/                 Listas de frases y preguntas de cada comando
│   ├── adios.json
│   ├── aguijon.json
│   ├── avispa.json
│   ├── cana.json
│   ├── confesion.json
│   ├── consejo.json
│   ├── dato.json
│   ├── destino.json
│   ├── elige.json
│   ├── emoji.json
│   ├── hola.json
│   ├── libros.json
│   ├── melon.json
│   ├── musica.json
│   ├── peliculas.json
│   ├── picame.json
│   ├── piropo.json
│   ├── plan.json
│   ├── reto.json
│   ├── suerte.json
│   ├── tarot.json
│   ├── trivia.json
│   └── trivialplus.json
├── docs/content-rules/      Reglas de tono y límites de cada lista
│   ├── abeja.md
│   ├── adios.md
│   ├── avispa.md
│   ├── cana.md
│   ├── confesion.md
│   ├── consejo.md
│   ├── dato.md
│   ├── destino.md
│   ├── elige.md
│   ├── emoji.md
│   ├── hola.md
│   ├── libros.md
│   ├── melon.md
│   ├── musica.md
│   ├── peliculas.md
│   ├── picame.md
│   ├── piropo.md
│   ├── plan.md
│   ├── resumen.md
│   ├── reto.md
│   ├── suerte.md
│   ├── tarot.md
│   ├── trivia.md
│   └── trivialplus.md
└── test/                    Tests de la lógica
    ├── commands.test.js
    ├── config.test.js
    ├── games.test.js
    ├── ratelimit.test.js
    ├── recommendations.test.js
    ├── resumen.test.js
    ├── state.test.js
    ├── stats.test.js
    └── trivia.test.js
```

## Problemas conocidos

- **(Solucionado)** El contenedor se quedaba en crash-loop con `Error [TypeError]: Cannot read properties of null (reading 'Socket')` en `Client.inject` (whatsapp-web.js / puppeteer). Causa raíz: `whatsapp-web.js@1.34.7` reinyecta el script en cada evento `framenavigated` de puppeteer sin comprobar si el frame es el principal (los iframes internos de WhatsApp Web también disparan ese evento) y sin `try/catch`. Cuando esa reinyección concurrente caía justo cuando los módulos internos aún no estaban listos, lanzaba una excepción no capturada que tumbaba el proceso Node entero. Es el mismo bug que [wwebjs/whatsapp-web.js#201653](https://github.com/wwebjs/whatsapp-web.js/pull/201653) (fusionado en su `main` pero sin publicar todavía en npm a día de hoy). El arreglo está aplicado como parche manual en `patch-wwebjs.js`. Si en el futuro reaparece con un mensaje distinto (por ejemplo, leyendo otra propiedad en vez de `'Socket'`), es probable que WhatsApp Web haya vuelto a cambiar su estructura interna: compara con la versión de `whatsapp-web.js` instalada (`npm view whatsapp-web.js versions`) y revisa issues recientes en su repositorio antes de tocar el código del bot.

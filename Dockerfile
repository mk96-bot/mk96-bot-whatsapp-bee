FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY patch-wwebjs.js ./
RUN node patch-wwebjs.js && rm patch-wwebjs.js

COPY index.js state.js commands.js config.js ratelimit.js stats.js trivia.js games.js recommendations.js resumen.js ./
COPY content ./content

CMD ["node", "index.js"]

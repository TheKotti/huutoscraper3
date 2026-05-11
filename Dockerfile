FROM node:20-slim AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY src/client/ src/client/
RUN npm run build:client

FROM node:20-slim AS server-build
WORKDIR /app
COPY package.json package-lock.json tsconfig.server.json ./
RUN npm ci
COPY src/server/ src/server/
RUN npm run build:server

FROM node:20-slim
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=server-build /app/dist/server/ ./dist/server/
COPY --from=client-build /app/dist/client/ ./dist/client/

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "dist/server/index.js"]

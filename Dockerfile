FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4321

# contents/ はここでは焼き込まない。実行時に実vaultをbind mountする前提
# (docker-compose.yml参照)。そのためbuildはイメージ作成時ではなく起動時に行う。
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:4321/ || exit 1

CMD ["sh", "-c", "npm run build && npm run preview -- --host 0.0.0.0 --port 4321"]

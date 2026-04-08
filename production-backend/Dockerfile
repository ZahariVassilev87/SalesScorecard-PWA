# -----------------------------------------------------------------------------
# Stage 1: React admin SPA (homepage /public-admin/react-admin in package.json)
# This runs on every `docker build` so the admin UI is never forgotten.
# -----------------------------------------------------------------------------
FROM node:18-alpine AS admin-builder

WORKDIR /admin
COPY admin-panel/package*.json ./
RUN npm ci

COPY admin-panel/ ./
ENV CI=false
ENV NODE_ENV=production
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: API server + admin static files from stage 1
# -----------------------------------------------------------------------------
FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY package*.json ./
RUN npm install --omit=dev

# Fresh admin bundle (host copy of public/react-admin is excluded via .dockerignore)
COPY --from=admin-builder /admin/build ./public/react-admin

COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]

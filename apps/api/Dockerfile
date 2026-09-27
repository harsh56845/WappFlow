# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package descriptors
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm install --workspaces --include-workspace-root

# Copy sources
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared and API
RUN npm run build --workspace=@whatsflow/shared
RUN npm run build --workspace=@whatsflow/api

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm install --omit=dev --workspaces --include-workspace-root

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src/swagger.json ./apps/api/dist/swagger.json

WORKDIR /app/apps/api

EXPOSE 5000

USER node

CMD ["node", "dist/server.js"]

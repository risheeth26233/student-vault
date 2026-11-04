FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci && npm run prisma:generate
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/backend
COPY backend/requirements-documents.txt ./
RUN python3 -m venv /opt/documents && /opt/documents/bin/pip install --no-cache-dir -r requirements-documents.txt
COPY --from=build --chown=node:node /workspace/backend/package*.json ./
COPY --from=build --chown=node:node /workspace/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/backend/prisma ./prisma
COPY --from=build --chown=node:node /workspace/backend/dist ./dist
COPY --chown=node:node backend/scripts ./scripts
COPY --from=build --chown=node:node /workspace/frontend/dist /workspace/frontend/dist
ENV NODE_ENV=production PORT=10000 PDF_PYTHON_BIN=/opt/documents/bin/python FRONTEND_DIST_DIR=/workspace/frontend/dist
USER node
EXPOSE 10000
# Migrations are intentionally a separate, reviewed release operation.
CMD ["node", "dist/index.js"]

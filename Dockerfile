FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY src ./src
COPY deployment/extension-identity.json ./deployment/extension-identity.json
COPY scripts/build-server.mjs ./scripts/build-server.mjs
RUN node scripts/build-server.mjs

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
# Railway mounts the quota volume as root. No source or development dependencies are shipped.
COPY --from=build /app/.server/main.mjs ./main.mjs
CMD ["node", "main.mjs"]
